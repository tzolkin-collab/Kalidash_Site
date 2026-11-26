package main

import (
	"log"
	"net/http"
	"strconv"
	"time"
)

// Analytics (página Analytics do admin). Só leitura: nenhuma tabela nova e nada gravado. Os números de canais,
// campanhas e receita são calculados no admin a partir dos leads e oportunidades; aqui fica o que só a API vê.
//
//   GET /api/analytics/tracking-health?days=30   entregas para a Meta (CAPI) e o GA4 (Measurement Protocol) por
//                                                 evento e status, a partir de TrackingEvent (leads:read)

type healthCount struct {
	Name   string `json:"name"`
	Layer  string `json:"layer"` // meta | ga4
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type healthError struct {
	Name   string    `json:"name"`
	Source string    `json:"source"`
	Error  string    `json:"error"`
	At     *FlexTime `json:"at,omitempty"`
}

type healthReport struct {
	Days       int             `json:"days"`
	Configured map[string]bool `json:"configured"` // camadas com credencial na API (meta, ga4)
	Offline    bool            `json:"offline"`    // conversões offline ligadas (OFFLINE_CONVERSIONS)
	Counts     []healthCount   `json:"counts"`
	Errors     []healthError   `json:"errors"`
}

// trackingHealthQuery: SELECTs em TrackingEvent desde `since`. Trocável nos testes.
var trackingHealthQuery = func(since time.Time) ([]healthCount, []healthError, error) {
	rows, err := db.Query(`SELECT name, metaStatus, ga4Status, COUNT(*) FROM TrackingEvent WHERE createdAt >= ? GROUP BY name, metaStatus, ga4Status`, since)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	merged := map[[3]string]int{}
	for rows.Next() {
		var name, meta, ga4 string
		var n int
		if err := rows.Scan(&name, &meta, &ga4, &n); err != nil {
			return nil, nil, err
		}
		merged[[3]string{name, "meta", meta}] += n
		merged[[3]string{name, "ga4", ga4}] += n
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	counts := make([]healthCount, 0, len(merged))
	for k, n := range merged {
		counts = append(counts, healthCount{Name: k[0], Layer: k[1], Status: k[2], Count: n})
	}

	erows, err := db.Query(`SELECT name, source, lastError, updatedAt FROM TrackingEvent WHERE createdAt >= ? AND lastError IS NOT NULL AND lastError <> '' ORDER BY updatedAt DESC LIMIT 5`, since)
	if err != nil {
		return counts, nil, err
	}
	defer erows.Close()
	errs := []healthError{}
	for erows.Next() {
		var e healthError
		var at string
		if err := erows.Scan(&e.Name, &e.Source, &e.Error, &at); err != nil {
			return counts, errs, err
		}
		e.At = flexFrom(at)
		errs = append(errs, e)
	}
	return counts, errs, erows.Err()
}

func registerAnalyticsRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/analytics/tracking-health", enableCORS(handleTrackingHealth))
}

func handleTrackingHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 || days > 365 {
		days = 30
	}
	cfg := loadTrackingConfig()
	counts, errs, err := trackingHealthQuery(time.Now().AddDate(0, 0, -days))
	if err != nil {
		log.Println("❌ analytics (tracking-health):", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "não consegui ler os envios de conversão"})
		return
	}
	if counts == nil {
		counts = []healthCount{}
	}
	if errs == nil {
		errs = []healthError{}
	}
	writeJSON(w, http.StatusOK, healthReport{Days: days, Configured: cfg.serverSide(), Offline: offlineConversionsOn(cfg), Counts: counts, Errors: errs})
}
