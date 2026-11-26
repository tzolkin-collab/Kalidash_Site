package main

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func inboundLeadFixture() LeadDTO {
	v := 4500.0
	return LeadDTO{
		ID: "lead-abc", Name: "Maria da Silva", Email: " Maria@Exemplo.com ", Phone: "(11) 98888-7777",
		Origin: "INBOUND", SourceName: "Site", EstimatedValue: &v,
		CustomData: map[string]any{
			"formSource": "site-home-diagnostico",
			"attribution": map[string]any{
				"utm_source": "instagram", "utm_campaign": "material-ia", "fbclid": "FBCLID1", "fbclid_at": "1700000000000",
				"_fbp": "fb.1.1.2", "ga_client_id": "123.456", "ga_session_id": "999", "page_url": "https://kalidash.com.br/?x",
			},
			"match": map[string]any{"ip": "200.1.2.3", "ua": "Mozilla/5.0 Teste", "event_id": "evt-form-1"},
		},
	}
}

// O evento offline leva os mesmos dados de correspondência do lead original e sai como system_generated.
func TestOfflineEventPayload(t *testing.T) {
	l := inboundLeadFixture()
	ev, err := offlineEvent(l, "QualifiedLead", "qualify_lead", "qualified-"+l.ID, l.EstimatedValue)
	if err != nil {
		t.Fatal(err)
	}
	body := metaPayload(trackingConfig{MetaToken: "t"}, ev)
	e := body["data"].([]any)[0].(map[string]any)
	if e["action_source"] != "system_generated" || e["event_name"] != "QualifiedLead" || e["event_id"] != "qualified-lead-abc" {
		t.Errorf("evento: %v", e)
	}
	if _, ok := e["event_source_url"]; ok {
		t.Error("evento do CRM não leva event_source_url")
	}
	u := e["user_data"].(map[string]any)
	wantEm := sha256Hex("maria@exemplo.com")
	if u["em"].([]string)[0] != wantEm || u["external_id"].([]string)[0] != wantEm {
		t.Errorf("em/external_id: %v %v", u["em"], u["external_id"])
	}
	if u["ph"].([]string)[0] != sha256Hex("5511988887777") {
		t.Errorf("ph: %v", u["ph"])
	}
	if u["fn"].([]string)[0] != sha256Hex("maria") || u["ln"].([]string)[0] != sha256Hex("silva") {
		t.Errorf("nome: %v %v", u["fn"], u["ln"])
	}
	if u["client_ip_address"] != "200.1.2.3" || u["client_user_agent"] != "Mozilla/5.0 Teste" {
		t.Errorf("ip/ua: %v %v", u["client_ip_address"], u["client_user_agent"])
	}
	if u["fbp"] != "fb.1.1.2" || u["fbc"] != "fb.1.1700000000000.FBCLID1" {
		t.Errorf("fbp/fbc: %v %v", u["fbp"], u["fbc"])
	}
	c := e["custom_data"].(map[string]any)
	if c["value"] != 4500.0 || c["currency"] != "BRL" || c["utm_campaign"] != "material-ia" || c["lead_source"] != "site-home-diagnostico" {
		t.Errorf("custom_data: %v", c)
	}

	g := ga4Payload(ev)
	if g["client_id"] != "123.456" {
		t.Errorf("client_id: %v", g["client_id"])
	}
	gev := g["events"].([]any)[0].(map[string]any)
	p := gev["params"].(map[string]any)
	if gev["name"] != "qualify_lead" || p["value"] != 4500.0 || p["currency"] != "BRL" {
		t.Errorf("ga4: %v", gev)
	}
	if _, ok := p["session_id"]; ok {
		t.Error("evento do CRM não reaproveita a sessão do formulário")
	}
}

// O lead do formulário continua igual: website, generate_lead, com página e sessão.
func TestWebsiteEventUnchanged(t *testing.T) {
	ev := conversionEvent{EventID: "evt-1", Name: "Lead", Time: time.Now(), Attr: map[string]string{"page_url": "https://k/", "ga_session_id": "7"}}
	e := metaPayload(trackingConfig{}, ev)["data"].([]any)[0].(map[string]any)
	if e["action_source"] != "website" || e["event_source_url"] != "https://k/" {
		t.Errorf("meta: %v", e)
	}
	if _, ok := e["custom_data"].(map[string]any)["value"]; ok {
		t.Error("lead do formulário não tem valor")
	}
	gev := ga4Payload(ev)["events"].([]any)[0].(map[string]any)
	if gev["name"] != "generate_lead" || gev["params"].(map[string]any)["session_id"] != int64(7) {
		t.Errorf("ga4: %v", gev)
	}
}

// Outbound, teste e lead sem contato não viram conversão.
func TestOfflineEventSkips(t *testing.T) {
	out := inboundLeadFixture()
	out.Origin = "OUTBOUND"
	test := inboundLeadFixture()
	test.CustomData["test"] = true
	empty := inboundLeadFixture()
	empty.Email, empty.Phone = "", ""
	oldMedia := projectMediaOn
	t.Cleanup(func() { projectMediaOn = oldMedia })
	projectMediaOn = func(id string) bool { return id == "prj-on" }
	projOff := inboundLeadFixture()
	projOff.CustomData["projectId"] = "prj-off"
	projOn := inboundLeadFixture()
	projOn.CustomData["projectId"] = "prj-on"
	if _, err := offlineEvent(projOn, "Purchase", "close_convert_lead", "won-x", nil); err != nil {
		t.Errorf("projeto com opt-in deveria ir: %v", err)
	}
	for name, l := range map[string]LeadDTO{"outbound": out, "teste": test, "sem contato": empty, "projeto sem opt-in": projOff} {
		if _, err := offlineEvent(l, "Purchase", "close_convert_lead", "won-x", nil); err != errNotOffline {
			t.Errorf("%s deveria ficar de fora (err=%v)", name, err)
		}
	}
}

// Ganho: Purchase com o valor da oportunidade, uma vez só, mesmo voltando a Ganho de novo.
func TestOpportunityWonConversionOnce(t *testing.T) {
	t.Setenv("META_PIXEL_ID", "1")
	t.Setenv("META_CAPI_ACCESS_TOKEN", "t")
	t.Setenv("GA4_MEASUREMENT_ID", "")
	t.Setenv("GA4_API_SECRET", "")
	t.Setenv("OFFLINE_CONVERSIONS", "")
	oldStore, oldMeta, oldDispatch, oldLead, oldValue, oldDelays := tracking, metaEndpoint, dispatchOffline, leadForOpportunity, opportunityValue, retryDelays
	t.Cleanup(func() {
		tracking, metaEndpoint, dispatchOffline, leadForOpportunity, opportunityValue, retryDelays = oldStore, oldMeta, oldDispatch, oldLead, oldValue, oldDelays
	})
	store := newMemTracking()
	tracking = store
	retryDelays = []time.Duration{0}
	dispatchOffline = func(ev conversionEvent) { deliverOffline(loadTrackingConfig(), ev) } // síncrono no teste

	var mu sync.Mutex
	var bodies []map[string]any
	meta := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		var m map[string]any
		_ = json.Unmarshal(b, &m)
		mu.Lock()
		bodies = append(bodies, m)
		mu.Unlock()
		w.Write([]byte(`{"events_received":1}`))
	}))
	defer meta.Close()
	metaEndpoint = func(trackingConfig) string { return meta.URL }

	leadForOpportunity = func(oppID string) (LeadDTO, error) {
		if oppID != "opp-1" && oppID != "opp-sem-valor" {
			return LeadDTO{}, sql.ErrNoRows
		}
		return inboundLeadFixture(), nil
	}
	opportunityValue = func(string) (*float64, error) { v := 12000.0; return &v, nil }

	emitOpportunityWonConversion("opp-1")
	emitOpportunityWonConversion("opp-1")      // saiu e voltou para Ganho: não reenvia
	emitOpportunityWonConversion("opp-manual") // sem lead de origem: não vai

	if len(bodies) != 1 {
		t.Fatalf("esperava 1 envio, veio %d", len(bodies))
	}
	e := bodies[0]["data"].([]any)[0].(map[string]any)
	c := e["custom_data"].(map[string]any)
	if e["event_name"] != "Purchase" || e["event_id"] != "won-opp-1" || c["value"] != 12000.0 || c["currency"] != "BRL" {
		t.Errorf("evento: %v", e)
	}
	if store.get("won-opp-1", "meta") != "sent" {
		t.Errorf("TrackingEvent: %v", store.get("won-opp-1", "meta"))
	}

	// Oportunidade sem valor: Purchase vai com value 0 em BRL (a Meta recusa Purchase sem value).
	opportunityValue = func(string) (*float64, error) { return nil, nil }
	emitOpportunityWonConversion("opp-sem-valor")
	if len(bodies) != 2 {
		t.Fatalf("esperava 2 envios, veio %d", len(bodies))
	}
	c = bodies[1]["data"].([]any)[0].(map[string]any)["custom_data"].(map[string]any)
	if v, ok := c["value"]; !ok || v != 0.0 || c["currency"] != "BRL" {
		t.Errorf("Purchase sem valor: %v", c)
	}

	// OFFLINE_CONVERSIONS=0 desliga só esta parte.
	t.Setenv("OFFLINE_CONVERSIONS", "0")
	leadForOpportunity = func(string) (LeadDTO, error) { return inboundLeadFixture(), nil }
	emitOpportunityWonConversion("opp-2")
	if len(bodies) != 2 {
		t.Error("com OFFLINE_CONVERSIONS=0 nada deveria sair")
	}
}

func TestMatchData(t *testing.T) {
	m := matchData(" 1.2.3.4 ", "UA", "")
	if m["ip"] != "1.2.3.4" || m["ua"] != "UA" {
		t.Errorf("match: %v", m)
	}
	if _, ok := m["event_id"]; ok {
		t.Error("event_id vazio não entra")
	}
	if len(matchData("", "", "")) != 0 {
		t.Error("sem dados, sem match")
	}
}
