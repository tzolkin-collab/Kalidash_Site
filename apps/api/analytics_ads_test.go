package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Uma Meta falsa: confere que só há GET, que o token vai no cabeçalho (nunca na URL) e que as duas listas se juntam.
func TestMetaAdRows(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("método %s", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer segredo" || strings.Contains(r.URL.RawQuery, "segredo") {
			t.Errorf("token fora do cabeçalho: %s", r.URL.RawQuery)
		}
		switch {
		case strings.HasSuffix(r.URL.Path, "/insights") && r.URL.Query().Get("after") == "":
			w.Write([]byte(`{"data":[{"date_start":"2026-11-01","account_id":"1","account_name":"Conta","account_currency":"BRL","campaign_id":"c","campaign_name":"Camp","adset_id":"s","adset_name":"Set","ad_id":"a1","ad_name":"Vídeo","spend":"12.34","impressions":"1000","inline_link_clicks":"20","actions":[{"action_type":"landing_page_view","value":"15"},{"action_type":"video_view","value":"300"}]}],"paging":{"next":"` + srv.URL + `/v26.0/act_1/insights?after=x&access_token=segredo"}}`))
		case strings.HasSuffix(r.URL.Path, "/insights"):
			w.Write([]byte(`{"data":[{"date_start":"2026-11-02","ad_id":"apagado","spend":"1"}]}`))
		default:
			if f := r.URL.Query().Get("filtering"); !strings.Contains(f, `"ad.id"`) || !strings.Contains(f, `"a1"`) || !strings.Contains(f, `"apagado"`) {
				t.Errorf("estrutura só dos anúncios com entrega: %q", f)
			}
			w.Write([]byte(`{"data":[{"id":"a1","effective_status":"ACTIVE","campaign":{"effective_status":"ACTIVE","daily_budget":"15000"},"adset":{"effective_status":"CAMPAIGN_PAUSED"},"creative":{"id":"cr","video_id":"v9","image_hash":"h","thumbnail_url":"https://x/t.jpg"}}]}`))
		}
	}))
	defer srv.Close()
	old := metaGraphBase
	metaGraphBase = srv.URL
	defer func() { metaGraphBase = old }()

	rows, currency, err := metaAdRows(context.Background(), spendConfig{MetaToken: "segredo", MetaAccount: "1", MetaVersion: "v26.0"}, "2026-11-01", "2026-11-02")
	if err != nil || currency != "BRL" || len(rows) != 2 {
		t.Fatalf("linhas: %v %s %+v", err, currency, rows)
	}
	a := rows[0]
	if a.Spend != 1234 || a.Clicks != 20 || a.PageViews != 15 || a.Views3s != 300 || a.AssetKey != "video:v9" || a.Format != "video" || a.CampaignBudget != 15000 || a.AdStatus != "ACTIVE" || a.AdsetStatus != "PAUSED" {
		t.Errorf("anúncio: %+v", a)
	}
	if rows[1].Spend != 100 || rows[1].CreativeID != "" || rows[1].AdStatus != "PAUSED" {
		t.Errorf("anúncio apagado mantém os números: %+v", rows[1])
	}
}

func TestAnalyticsAdsRoute(t *testing.T) {
	t.Setenv("META_ADS_ACCESS_TOKEN", "")
	get := func(q string) (int, string) {
		w := httptest.NewRecorder()
		handleAnalyticsAds(w, httptest.NewRequest(http.MethodGet, "/api/analytics/ads?"+q, nil))
		return w.Code, w.Body.String()
	}
	if code, body := get("from=2026-11-01&to=2026-11-30"); code != 200 || !strings.Contains(body, `"configured":false`) || !strings.Contains(body, `"rows":[]`) {
		t.Errorf("sem credencial: %d %s", code, body)
	}
	if code, _ := get("from=2026-01-01&to=2026-11-30"); code != 400 {
		t.Errorf("período longo demais: %d", code)
	}
}
