package main

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"
)

func TestTrackingHealth(t *testing.T) {
	t.Setenv("META_PIXEL_ID", "1")
	t.Setenv("META_CAPI_ACCESS_TOKEN", "t")
	t.Setenv("GA4_MEASUREMENT_ID", "")
	t.Setenv("GA4_API_SECRET", "")
	t.Setenv("OFFLINE_CONVERSIONS", "")
	old := trackingHealthQuery
	t.Cleanup(func() { trackingHealthQuery = old })
	var since time.Time
	trackingHealthQuery = func(s time.Time) ([]healthCount, []healthError, error) {
		since = s
		return []healthCount{{Name: "Lead", Layer: "meta", Status: "sent", Count: 7}}, nil, nil
	}

	rec := httptest.NewRecorder()
	handleTrackingHealth(rec, httptest.NewRequest("GET", "/api/analytics/tracking-health?days=7", nil))
	if rec.Code != 200 {
		t.Fatalf("código %d: %s", rec.Code, rec.Body)
	}
	var out healthReport
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if out.Days != 7 || !out.Configured["meta"] || out.Configured["ga4"] || !out.Offline || len(out.Counts) != 1 || out.Errors == nil {
		t.Errorf("relatório: %+v", out)
	}
	if d := time.Since(since); d < 6*24*time.Hour || d > 8*24*time.Hour {
		t.Errorf("janela: %v", d)
	}

	// days fora do limite volta para 30.
	rec = httptest.NewRecorder()
	handleTrackingHealth(rec, httptest.NewRequest("GET", "/api/analytics/tracking-health?days=9999", nil))
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if out.Days != 30 {
		t.Errorf("days padrão: %d", out.Days)
	}

	if scope, public := routeScope(httptest.NewRequest("GET", "/api/analytics/tracking-health", nil)); scope != "leads:read" || public {
		t.Errorf("escopo: %q público=%v", scope, public)
	}
}
