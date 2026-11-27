package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func resetSpendCache() {
	spendMu.Lock()
	spendCache = map[string]spendEntry{}
	spendMu.Unlock()
}

func setSpendEnv(t *testing.T, meta, google bool) {
	v := func(on bool, s string) string {
		if on {
			return s
		}
		return ""
	}
	t.Setenv("META_ADS_ACCESS_TOKEN", v(meta, "tok"))
	t.Setenv("META_AD_ACCOUNT_ID", v(meta, "act_123"))
	t.Setenv("GOOGLE_ADS_DEVELOPER_TOKEN", v(google, "dev"))
	t.Setenv("GOOGLE_ADS_CLIENT_ID", v(google, "cid"))
	t.Setenv("GOOGLE_ADS_CLIENT_SECRET", v(google, "sec"))
	t.Setenv("GOOGLE_ADS_REFRESH_TOKEN", v(google, "ref"))
	t.Setenv("GOOGLE_ADS_CUSTOMER_ID", v(google, "123-456-7890"))
	t.Setenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "")
}

func TestSpendRotaJuntaPlataformasECacheia(t *testing.T) {
	resetSpendCache()
	setSpendEnv(t, true, true)
	oldM, oldG := fetchMetaSpend, fetchGoogleSpend
	t.Cleanup(func() { fetchMetaSpend, fetchGoogleSpend = oldM, oldG; resetSpendCache() })
	calls := 0
	fetchMetaSpend = func(_ context.Context, c spendConfig, from, to string) ([]spendCampaign, string, error) {
		calls++
		if c.MetaAccount != "123" || from != "2026-10-01" || to != "2026-10-31" {
			t.Errorf("config/janela: %+v %s %s", c, from, to)
		}
		return []spendCampaign{{Platform: "meta", Name: "diag_202610", SpendCents: 150000}}, "BRL", nil
	}
	fetchGoogleSpend = func(_ context.Context, c spendConfig, _, _ string) ([]spendCampaign, string, error) {
		if c.GAdsCustomer != "1234567890" {
			t.Errorf("customer: %q", c.GAdsCustomer)
		}
		return nil, "", errors.New("Google Ads: HTTP 403")
	}

	get := func(q string) (int, spendReport) {
		rec := httptest.NewRecorder()
		handleSpend(rec, httptest.NewRequest("GET", "/api/analytics/spend?"+q, nil))
		var out spendReport
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		return rec.Code, out
	}
	code, rep := get("from=2026-10-01&to=2026-10-31")
	if code != 200 || len(rep.Campaigns) != 1 || rep.Campaigns[0].SpendCents != 150000 || rep.Currency["meta"] != "BRL" {
		t.Fatalf("relatório: %d %+v", code, rep)
	}
	if !rep.Configured["meta"] || !rep.Configured["google"] || !strings.Contains(rep.Errors["google"], "403") {
		t.Errorf("config/erros: %+v", rep)
	}
	get("from=2026-10-01&to=2026-10-31")
	if calls != 1 {
		t.Errorf("cache: %d chamadas à Meta", calls)
	}
	if code, _ := get("from=2026-10-31&to=2026-10-01"); code != 400 {
		t.Errorf("janela invertida: %d", code)
	}
	if code, _ := get("from=ontem&to=hoje"); code != 400 {
		t.Errorf("data inválida: %d", code)
	}
}

func TestSpendSemChavesNaoChamaNada(t *testing.T) {
	resetSpendCache()
	setSpendEnv(t, false, false)
	oldM := fetchMetaSpend
	t.Cleanup(func() { fetchMetaSpend = oldM })
	fetchMetaSpend = func(context.Context, spendConfig, string, string) ([]spendCampaign, string, error) {
		t.Error("não devia chamar a Meta")
		return nil, "", nil
	}
	rec := httptest.NewRecorder()
	handleSpend(rec, httptest.NewRequest("GET", "/api/analytics/spend?from=2026-10-01&to=2026-10-31", nil))
	if !strings.Contains(rec.Body.String(), `"configured":{"google":false,"meta":false}`) || !strings.Contains(rec.Body.String(), `"campaigns":[]`) {
		t.Errorf("corpo: %s", rec.Body)
	}
}

func TestMetaSpendLeInsightsComPaginacaoEErro(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok" || !strings.HasPrefix(r.URL.Path, "/v26.0/act_123/insights") {
			t.Errorf("pedido: %s %s", r.URL.Path, r.Header.Get("Authorization"))
		}
		if r.URL.Query().Get("after") == "" {
			if !strings.Contains(r.URL.Query().Get("time_range"), `"since":"2026-10-01"`) || r.URL.Query().Get("level") != "campaign" {
				t.Errorf("query: %s", r.URL.RawQuery)
			}
			_, _ = w.Write([]byte(`{"data":[{"campaign_id":"1","campaign_name":"diag_202610","spend":"1234.56","impressions":"1000","clicks":"40","account_currency":"BRL"}],"paging":{"next":"` + srv.URL + `/v26.0/act_123/insights?after=x"}}`))
			return
		}
		_, _ = w.Write([]byte(`{"data":[{"campaign_id":"2","campaign_name":"marca","spend":"10","impressions":"5","clicks":"1"}]}`))
	}))
	defer srv.Close()
	old := metaGraphBase
	metaGraphBase = srv.URL
	t.Cleanup(func() { metaGraphBase = old })

	c := spendConfig{MetaToken: "tok", MetaAccount: "123", MetaVersion: "v26.0"}
	camps, cur, err := metaSpend(context.Background(), c, "2026-10-01", "2026-10-31")
	if err != nil || cur != "BRL" || len(camps) != 2 || camps[0].SpendCents != 123456 || camps[0].Clicks != 40 || camps[1].SpendCents != 1000 {
		t.Fatalf("insights: %v %s %+v", err, cur, camps)
	}

	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(400)
		_, _ = w.Write([]byte(`{"error":{"message":"Invalid OAuth access token","code":190}}`))
	}))
	defer bad.Close()
	metaGraphBase = bad.URL
	if _, _, err := metaSpend(context.Background(), c, "2026-10-01", "2026-10-31"); err == nil || !strings.Contains(err.Error(), "190") {
		t.Errorf("erro da Meta: %v", err)
	}
}

func TestGoogleSpendTrocaTokenELeStream(t *testing.T) {
	tok := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		if r.Form.Get("refresh_token") != "ref" || r.Form.Get("grant_type") != "refresh_token" {
			t.Errorf("form: %v", r.Form)
		}
		_, _ = w.Write([]byte(`{"access_token":"acc"}`))
	}))
	defer tok.Close()
	ads := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v26/customers/1234567890/googleAds:searchStream" || r.Header.Get("developer-token") != "dev" || r.Header.Get("Authorization") != "Bearer acc" || r.Header.Get("login-customer-id") != "999" {
			t.Errorf("pedido: %s %v", r.URL.Path, r.Header)
		}
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		if !strings.Contains(body["query"], "BETWEEN '2026-10-01' AND '2026-10-31'") {
			t.Errorf("GAQL: %s", body["query"])
		}
		_, _ = w.Write([]byte(`[{"results":[{"customer":{"currencyCode":"BRL"},"campaign":{"id":"9","name":"Marca"},"metrics":{"costMicros":"12345678","impressions":"300","clicks":"12"}}]}]`))
	}))
	defer ads.Close()
	oldT, oldA := googleTokenURL, googleAdsBase
	googleTokenURL, googleAdsBase = tok.URL, ads.URL
	t.Cleanup(func() { googleTokenURL, googleAdsBase = oldT, oldA })

	c := spendConfig{GAdsDevToken: "dev", GAdsClientID: "cid", GAdsSecret: "sec", GAdsRefresh: "ref", GAdsCustomer: "1234567890", GAdsLoginCustomer: "999", GAdsVersion: "v26"}
	camps, cur, err := googleSpend(context.Background(), c, "2026-10-01", "2026-10-31")
	if err != nil || cur != "BRL" || len(camps) != 1 || camps[0].SpendCents != 1235 || camps[0].Name != "Marca" || camps[0].Platform != "google" {
		t.Fatalf("Google Ads: %v %s %+v", err, cur, camps)
	}
}

func TestMetaSpendNaoRepassaTokenELimitaPaginas(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("access_token") != "" {
			t.Errorf("token na query: %s", r.URL.RawQuery)
		}
		_, _ = w.Write([]byte(`{"data":[],"paging":{"next":"` + srv.URL + `/v26.0/act_123/insights?access_token=segredo&after=x"}}`))
	}))
	defer srv.Close()
	oldB, oldP := metaGraphBase, metaMaxPages
	metaGraphBase, metaMaxPages = srv.URL, 3
	t.Cleanup(func() { metaGraphBase, metaMaxPages = oldB, oldP })

	c := spendConfig{MetaToken: "tok", MetaAccount: "123", MetaVersion: "v26.0"}
	if _, _, err := metaSpend(context.Background(), c, "2026-10-01", "2026-10-31"); err == nil || !strings.Contains(err.Error(), "incompleta") {
		t.Errorf("limite de páginas: %v", err)
	}
}

func TestDoJSONTiraQueryDoErroDeRede(t *testing.T) {
	req, _ := http.NewRequest(http.MethodGet, "http://127.0.0.1:1/x?access_token=segredo", nil)
	err := doJSON(req, &struct{}{})
	if err == nil || strings.Contains(err.Error(), "segredo") {
		t.Errorf("erro: %v", err)
	}
}
