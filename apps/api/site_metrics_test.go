package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSiteRanges(t *testing.T) {
	now := time.Date(2026, 11, 25, 15, 0, 0, 0, time.UTC) // 12h em Brasília
	cases := []struct{ period, from, to, pFrom, pTo string }{
		{"month", "2026-11-01", "2026-11-25", "2026-10-01", "2026-10-25"},
		{"30d", "2026-10-27", "2026-11-25", "2026-09-27", "2026-10-26"},
		{"year", "2026-01-01", "2026-11-25", "2025-01-01", "2025-11-25"},
	}
	for _, c := range cases {
		cur, prev := siteRanges(c.period, now)
		if cur.StartDate != c.from || cur.EndDate != c.to || prev == nil || prev.StartDate != c.pFrom || prev.EndDate != c.pTo {
			t.Errorf("%s: %+v %+v", c.period, cur, prev)
		}
	}
	if _, prev := siteRanges("all", now); prev != nil {
		t.Error("Tudo não tem período anterior")
	}
	// 31 de março: o mês anterior (fevereiro) termina no último dia dele, não em março.
	cur, prev := siteRanges("month", time.Date(2026, 3, 31, 15, 0, 0, 0, time.UTC))
	if cur.StartDate != "2026-03-01" || prev.EndDate != "2026-02-28" {
		t.Errorf("fim de mês: %+v %+v", cur, prev)
	}
}

func TestBuildSiteMetrics(t *testing.T) {
	raw := `[
	 {"rows":[{"dimensionValues":[{"value":"date_range_0"}],"metricValues":[{"value":"120"},{"value":"80"},{"value":"150"},{"value":"400"},{"value":"0.61"},{"value":"73.5"}]},
	          {"dimensionValues":[{"value":"date_range_1"}],"metricValues":[{"value":"100"},{"value":"70"},{"value":"130"},{"value":"350"},{"value":"0.55"},{"value":"60"}]}]},
	 {"rows":[{"dimensionValues":[{"value":"20261101"}],"metricValues":[{"value":"10"},{"value":"12"}]}]},
	 {"rows":[{"dimensionValues":[{"value":"/"},{"value":"Início"}],"metricValues":[{"value":"200"},{"value":"90"}]}]},
	 {"rows":[{"dimensionValues":[{"value":"Organic Search"}],"metricValues":[{"value":"70"}]}]},
	 {"rows":[{"dimensionValues":[{"value":"google / organic"}],"metricValues":[{"value":"68"}]}]}
	]`
	var reports []ga4Report
	if err := json.Unmarshal([]byte(raw), &reports); err != nil {
		t.Fatal(err)
	}
	cur, prev := siteRanges("month", time.Date(2026, 11, 25, 15, 0, 0, 0, time.UTC))
	m := buildSiteMetrics("month", cur, prev, reports)
	if m.Totals.Users != 120 || m.Totals.Sessions != 150 || m.Totals.Views != 400 || m.Totals.EngagementRate != 0.61 {
		t.Errorf("totais: %+v", m.Totals)
	}
	if m.Previous == nil || m.Previous.Users != 100 {
		t.Errorf("anterior: %+v", m.Previous)
	}
	if len(m.Daily) != 1 || m.Daily[0].Date != "2026-11-01" || m.Daily[0].Sessions != 12 {
		t.Errorf("dias: %+v", m.Daily)
	}
	if len(m.Pages) != 1 || m.Pages[0].Title != "Início" || len(m.Channels) != 1 || m.Sources[0].Label != "google / organic" {
		t.Errorf("listas: %+v %+v %+v", m.Pages, m.Channels, m.Sources)
	}
	// Relatório vazio (site sem visitas): listas vazias, não null, e anterior zerado.
	empty := buildSiteMetrics("month", cur, prev, nil)
	if empty.Daily == nil || empty.Pages == nil || empty.Previous == nil || empty.Previous.Users != 0 {
		t.Errorf("vazio: %+v", empty)
	}
}

func TestSiteMetricsSemConfiguracao(t *testing.T) {
	t.Setenv("GA4_PROPERTY_ID", "")
	t.Setenv("GA4_SERVICE_ACCOUNT", "")
	rec := httptest.NewRecorder()
	handleSiteMetrics(rec, httptest.NewRequest(http.MethodGet, "/api/site-metrics", nil))
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"configured":false`) {
		t.Fatalf("%d %s", rec.Code, rec.Body.String())
	}
	t.Setenv("GA4_PROPERTY_ID", "G-ABC123")
	t.Setenv("GA4_SERVICE_ACCOUNT", `{"client_email":"x@y.iam.gserviceaccount.com","private_key":"k"}`)
	rec = httptest.NewRecorder()
	handleSiteMetrics(rec, httptest.NewRequest(http.MethodGet, "/api/site-metrics", nil))
	if !strings.Contains(rec.Body.String(), "número da propriedade") {
		t.Fatalf("ID de medição deveria ser recusado: %s", rec.Body.String())
	}
}

func TestServiceAccountJWT(t *testing.T) {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	der, _ := x509.MarshalPKCS8PrivateKey(key)
	pemKey := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
	acc := &ga4Account{ClientEmail: "leitor@proj.iam.gserviceaccount.com", PrivateKey: pemKey, TokenURI: "https://oauth2.googleapis.com/token"}
	jwt, err := serviceAccountJWT(acc, time.Unix(1_800_000_000, 0))
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		t.Fatalf("JWT com %d partes", len(parts))
	}
	claims, _ := base64.RawURLEncoding.DecodeString(parts[1])
	var c map[string]any
	json.Unmarshal(claims, &c)
	if c["iss"] != acc.ClientEmail || c["scope"] != ga4Scope || c["aud"] != acc.TokenURI || c["exp"].(float64)-c["iat"].(float64) != 3600 {
		t.Errorf("claims: %v", c)
	}
	// Também aceita o JSON em base64 no GA4_SERVICE_ACCOUNT.
	j, _ := json.Marshal(acc)
	t.Setenv("GA4_PROPERTY_ID", "123456789")
	t.Setenv("GA4_SERVICE_ACCOUNT", base64.StdEncoding.EncodeToString(j))
	if p, a, err := ga4Config(); err != nil || p != "123456789" || a == nil || a.ClientEmail != acc.ClientEmail {
		t.Errorf("config base64: %v %v %v", p, a, err)
	}
}
