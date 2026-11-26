package main

import (
	"database/sql"
	"errors"
	"log"
	"os"
	"strings"
	"time"
)

// Conversões offline: as etapas do CRM voltam para a Meta (API de Conversões) e para o GA4 (Measurement Protocol)
// como eventos do servidor, para as campanhas otimizarem por lead bom e por venda, não só por formulário enviado.
//
//   etapa                         Meta (action_source system_generated)   GA4 (evento recomendado de lead)
//   lead qualificado              QualifiedLead (+ valor estimado)        qualify_lead
//   oportunidade em etapa Ganha   Purchase (valor da oportunidade, BRL)   close_convert_lead
//
// Correspondência (nota de qualidade da Meta): cada evento sai com os MESMOS dados do lead original. E-mail,
// telefone, nome e sobrenome (com hash), external_id (hash do e-mail, igual ao do evento Lead), país, fbp, fbc
// (cookie ou montado do fbclid guardado), mais o IP e o navegador de quem enviou o formulário, guardados no lead
// na entrada (customData.match). No GA4 vai o client_id do navegador (attribution.ga_client_id).
//
// Só leads INBOUND e fora do modo de teste (chave kld_test_): outbound não veio de anúncio e ensinaria a campanha
// errado. Uma vez por lead e por etapa: o event_id é fixo (qualified-<lead>, won-<oportunidade>) e passa pela
// TrackingEvent, então sair e voltar para Ganho, clique duplo ou nova tentativa não reenviam. A Meta também
// descarta event_id repetido.
//
// Liga sozinho quando a Meta (META_PIXEL_ID + META_CAPI_ACCESS_TOKEN) ou o GA4 (GA4_MEASUREMENT_ID +
// GA4_API_SECRET) estão configurados. OFFLINE_CONVERSIONS=0 desliga só esta parte.

// matchData: o que fica no lead para as conversões offline. Só o necessário para a correspondência.
func matchData(ip, ua, eventID string) map[string]string {
	m := map[string]string{}
	if ip = clean(ip, 64); ip != "" {
		m["ip"] = ip
	}
	if ua = clean(ua, 400); ua != "" {
		m["ua"] = ua
	}
	if eventID = clean(eventID, 64); eventID != "" {
		m["event_id"] = eventID
	}
	return m
}

func offlineConversionsOn(cfg trackingConfig) bool {
	if v := strings.ToLower(strings.TrimSpace(os.Getenv("OFFLINE_CONVERSIONS"))); v == "0" || v == "false" || v == "off" {
		return false
	}
	return cfg.metaOn() || cfg.ga4On()
}

// stringMap lê um objeto do customData (map[string]any) como texto.
func stringMap(v any) map[string]string {
	out := map[string]string{}
	m, ok := v.(map[string]any)
	if !ok {
		return out
	}
	for k, val := range m {
		if s := clean(strOf(val), 500); s != "" {
			out[k] = s
		}
	}
	return out
}

var errNotOffline = errors.New("lead fora das conversões offline")

// offlineEvent monta o evento a partir do lead. Erro errNotOffline = lead que não deve ir (outbound, teste).
func offlineEvent(l LeadDTO, metaName, ga4Name, eventID string, value *float64) (conversionEvent, error) {
	if l.Origin != "INBOUND" || l.CustomData["test"] == true {
		return conversionEvent{}, errNotOffline
	}
	if strings.TrimSpace(l.Email) == "" && strings.TrimSpace(l.Phone) == "" {
		return conversionEvent{}, errNotOffline // sem e-mail nem telefone a Meta não tem com o que casar
	}
	if pid := strOf(l.CustomData["projectId"]); pid != "" && !projectMediaOn(pid) {
		return conversionEvent{}, errNotOffline // lead de projeto conectado sem conversões de mídia (opt-in)
	}
	match := stringMap(l.CustomData["match"])
	source := firstNonEmpty(strOf(l.CustomData["formSource"]), strOf(l.CustomData["formName"]), l.SourceName)
	return conversionEvent{
		EventID: eventID, Name: metaName, GA4Name: ga4Name, ActionSource: "system_generated",
		Value: value, Currency: "BRL", Time: time.Now(),
		Email: l.Email, Phone: l.Phone, FullName: l.Name, Source: source,
		IP: match["ip"], UserAgent: match["ua"], Attr: stringMap(l.CustomData["attribution"]),
	}, nil
}

// projectMediaOn: o projeto conectado de origem do lead tem conversões de mídia ligadas? Sem o módulo de projetos ou
// sem o projeto, não (na dúvida, nada sai para o pixel do Kalidash). Trocável nos testes.
var projectMediaOn = func(projectID string) bool {
	if connectDB == nil {
		return false
	}
	p, err := connectDB.ProjectByID(projectID)
	return err == nil && p.MediaConversions
}

// dispatchOffline: em segundo plano, uma vez por event_id (TrackingEvent). Trocável nos testes.
var dispatchOffline = func(ev conversionEvent) {
	go deliverOffline(loadTrackingConfig(), ev)
}

func deliverOffline(cfg trackingConfig, ev conversionEvent) {
	claim, err := tracking.Claim(ev.EventID, ev.Name, "crm")
	if err != nil {
		log.Printf("⚠️ conversão offline %s: %v", ev.EventID, err)
		return // sem a tabela não dá para garantir envio único: melhor não mandar do que mandar em dobro
	}
	if claim != claimNew {
		return
	}
	_ = tracking.MarkLeadSaved(ev.EventID) // marca como processado: reenvios caem em claimDone
	deliverConversion(cfg, ev)
}

// emitLeadQualified: chamado depois que o lead virou oportunidade (POST /api/crm/leads/{id}/qualify).
func emitLeadQualified(l LeadDTO) {
	if !offlineConversionsOn(loadTrackingConfig()) {
		return
	}
	ev, err := offlineEvent(l, "QualifiedLead", "qualify_lead", "qualified-"+l.ID, l.EstimatedValue)
	if err != nil {
		return
	}
	dispatchOffline(ev)
}

// leadForOpportunity: o lead que originou a oportunidade (Lead.convertedOpportunityId).
var leadForOpportunity = func(oppID string) (LeadDTO, error) {
	if db == nil || !crmEnabled() {
		return LeadDTO{}, sql.ErrNoRows
	}
	var id string
	if err := db.QueryRow(`SELECT id FROM `+leadTbl+` WHERE convertedOpportunityId = ? ORDER BY createdAt LIMIT 1`, oppID).Scan(&id); err != nil {
		return LeadDTO{}, err
	}
	return getLeadRecord(id)
}

var opportunityValue = func(oppID string) (*float64, error) {
	var v sql.NullFloat64
	if err := db.QueryRow(`SELECT value FROM Opportunity WHERE id = ?`, oppID).Scan(&v); err != nil {
		return nil, err
	}
	if !v.Valid {
		return nil, nil
	}
	return &v.Float64, nil
}

// emitOpportunityWonConversion: chamado depois de mover a oportunidade para uma etapa Ganha (/api/leads/move).
// Oportunidade sem lead de origem (criada à mão) não vai: não veio de anúncio.
func emitOpportunityWonConversion(oppID string) {
	if !offlineConversionsOn(loadTrackingConfig()) {
		return
	}
	l, err := leadForOpportunity(oppID)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			log.Printf("⚠️ conversão offline (ganho %s): %v", oppID, err)
		}
		return
	}
	value, err := opportunityValue(oppID)
	if err != nil {
		log.Printf("⚠️ conversão offline (ganho %s): %v", oppID, err)
	}
	if value == nil {
		// A Meta recusa Purchase sem value/currency: oportunidade sem valor vai com 0 (o evento ainda conta e casa).
		zero := 0.0
		value = &zero
	}
	ev, err := offlineEvent(l, "Purchase", "close_convert_lead", "won-"+oppID, value)
	if err != nil {
		return
	}
	dispatchOffline(ev)
}
