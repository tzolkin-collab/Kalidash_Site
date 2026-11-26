package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Investimento em mídia para a página Analytics. Lido na hora das plataformas, com cache de 15 minutos em memória;
// nada é gravado no banco.
//
//   GET /api/analytics/spend?from=2026-09-01&to=2026-11-30   gasto por campanha no período (leads:read)
//
// Meta: Marketing API, insights da conta de anúncios por campanha. Google: Google Ads API (GAQL em
// googleAds:searchStream) com OAuth por refresh token. Cada plataforma só entra com as próprias variáveis; uma que
// falha não derruba a outra (o erro volta em `errors`). O admin casa campanha com `utm_campaign` pelo nome normalizado.

type spendCampaign struct {
	Platform    string `json:"platform"` // meta | google
	ID          string `json:"id"`
	Name        string `json:"name"`
	SpendCents  int64  `json:"spendCents"`
	Impressions int64  `json:"impressions"`
	Clicks      int64  `json:"clicks"`
}

type spendReport struct {
	From       string            `json:"from"`
	To         string            `json:"to"`
	Configured map[string]bool   `json:"configured"`
	Currency   map[string]string `json:"currency,omitempty"`
	Campaigns  []spendCampaign   `json:"campaigns"`
	Errors     map[string]string `json:"errors"`
	FetchedAt  time.Time         `json:"fetchedAt"`
}

type spendConfig struct {
	MetaToken, MetaAccount, MetaVersion                               string
	GAdsDevToken, GAdsClientID, GAdsSecret, GAdsRefresh, GAdsCustomer string
	GAdsLoginCustomer, GAdsVersion                                    string
}

func env(k string) string { return strings.TrimSpace(os.Getenv(k)) }

func loadSpendConfig() spendConfig {
	c := spendConfig{
		MetaToken:         env("META_ADS_ACCESS_TOKEN"),
		MetaAccount:       strings.TrimPrefix(env("META_AD_ACCOUNT_ID"), "act_"),
		MetaVersion:       env("META_ADS_GRAPH_VERSION"),
		GAdsDevToken:      env("GOOGLE_ADS_DEVELOPER_TOKEN"),
		GAdsClientID:      env("GOOGLE_ADS_CLIENT_ID"),
		GAdsSecret:        env("GOOGLE_ADS_CLIENT_SECRET"),
		GAdsRefresh:       env("GOOGLE_ADS_REFRESH_TOKEN"),
		GAdsCustomer:      digits(env("GOOGLE_ADS_CUSTOMER_ID")),
		GAdsLoginCustomer: digits(env("GOOGLE_ADS_LOGIN_CUSTOMER_ID")),
		GAdsVersion:       env("GOOGLE_ADS_API_VERSION"),
	}
	if c.MetaVersion == "" {
		c.MetaVersion = "v26.0"
	}
	if c.GAdsVersion == "" {
		c.GAdsVersion = "v26"
	}
	return c
}

func (c spendConfig) metaOn() bool { return c.MetaToken != "" && c.MetaAccount != "" }
func (c spendConfig) googleOn() bool {
	return c.GAdsDevToken != "" && c.GAdsClientID != "" && c.GAdsSecret != "" && c.GAdsRefresh != "" && c.GAdsCustomer != ""
}

var spendHTTP = &http.Client{Timeout: 20 * time.Second}

// Endereços das plataformas (trocáveis nos testes). O token OAuth usa googleTokenURL, de auth_google.go.
var (
	metaGraphBase = "https://graph.facebook.com"
	googleAdsBase = "https://googleads.googleapis.com"
)

// Busca por plataforma. Trocáveis nos testes.
var (
	fetchMetaSpend   = metaSpend
	fetchGoogleSpend = googleSpend
)

// ---- cache ----

const spendTTL = 15 * time.Minute

type spendEntry struct {
	at        time.Time
	campaigns []spendCampaign
	currency  string
	err       string
}

var (
	spendMu    sync.Mutex
	spendCache = map[string]spendEntry{}
)

func cachedSpend(platform, from, to string, fetch func() ([]spendCampaign, string, error)) spendEntry {
	key := platform + "|" + from + "|" + to
	spendMu.Lock()
	if e, ok := spendCache[key]; ok && time.Since(e.at) < spendTTL {
		spendMu.Unlock()
		return e
	}
	spendMu.Unlock()
	camps, cur, err := fetch()
	e := spendEntry{at: time.Now(), campaigns: camps, currency: cur}
	if err != nil {
		log.Printf("❌ analytics (investimento %s): %v", platform, err)
		e.err = err.Error()
		e.at = time.Now().Add(-spendTTL + time.Minute) // erro fica 1 minuto, para não martelar a plataforma
	}
	spendMu.Lock()
	if len(spendCache) > 200 {
		spendCache = map[string]spendEntry{}
	}
	spendCache[key] = e
	spendMu.Unlock()
	return e
}

// ---- rota ----

func registerAnalyticsSpendRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/analytics/spend", enableCORS(handleSpend))
	logSpendConfig()
}

// logSpendConfig diz na subida quais plataformas de investimento estão ligadas e, das incompletas, só os NOMES das
// variáveis que faltam (nunca os valores).
func logSpendConfig() {
	groups := []struct {
		name string
		keys []string
	}{
		{"Meta", []string{"META_ADS_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"}},
		{"Google Ads", []string{"GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"}},
	}
	for _, g := range groups {
		var missing []string
		for _, k := range g.keys {
			if env(k) == "" {
				missing = append(missing, k)
			}
		}
		switch {
		case len(missing) == 0:
			log.Printf("✅ Investimento em mídia: %s ligado", g.name)
		case len(missing) < len(g.keys):
			log.Printf("⚠️ Investimento em mídia: %s incompleto, faltam %s", g.name, strings.Join(missing, ", "))
		default:
			log.Printf("Investimento em mídia: %s desligado (nenhuma das variáveis no ambiente)", g.name)
		}
	}
}

const dateLayout = "2006-01-02"

func handleSpend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	from, err1 := time.Parse(dateLayout, r.URL.Query().Get("from"))
	to, err2 := time.Parse(dateLayout, r.URL.Query().Get("to"))
	if err1 != nil || err2 != nil || to.Before(from) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "from e to no formato AAAA-MM-DD, com from <= to"})
		return
	}
	// A Meta guarda insights por 37 meses; mais que isso a chamada falha.
	if oldest := time.Now().AddDate(0, -37, 1); from.Before(oldest) {
		from = time.Date(oldest.Year(), oldest.Month(), oldest.Day(), 0, 0, 0, 0, time.UTC)
	}
	if to.Before(from) {
		to = from
	}
	f, t := from.Format(dateLayout), to.Format(dateLayout)
	cfg := loadSpendConfig()
	rep := spendReport{From: f, To: t, Configured: map[string]bool{"meta": cfg.metaOn(), "google": cfg.googleOn()}, Currency: map[string]string{}, Campaigns: []spendCampaign{}, Errors: map[string]string{}, FetchedAt: time.Now()}

	type result struct {
		platform string
		e        spendEntry
	}
	var wg sync.WaitGroup
	out := make(chan result, 2)
	if cfg.metaOn() {
		wg.Add(1)
		go func() {
			defer wg.Done()
			out <- result{"meta", cachedSpend("meta:"+cfg.MetaAccount, f, t, func() ([]spendCampaign, string, error) { return fetchMetaSpend(r.Context(), cfg, f, t) })}
		}()
	}
	if cfg.googleOn() {
		wg.Add(1)
		go func() {
			defer wg.Done()
			out <- result{"google", cachedSpend("google:"+cfg.GAdsCustomer, f, t, func() ([]spendCampaign, string, error) { return fetchGoogleSpend(r.Context(), cfg, f, t) })}
		}()
	}
	wg.Wait()
	close(out)
	for res := range out {
		if res.e.err != "" {
			rep.Errors[res.platform] = res.e.err
		}
		if res.e.currency != "" {
			rep.Currency[res.platform] = res.e.currency
		}
		rep.Campaigns = append(rep.Campaigns, res.e.campaigns...)
	}
	writeJSON(w, http.StatusOK, rep)
}

// ---- Meta (Marketing API) ----

func metaSpend(ctx context.Context, c spendConfig, from, to string) ([]spendCampaign, string, error) {
	tr, _ := json.Marshal(map[string]string{"since": from, "until": to})
	q := url.Values{
		"level":      {"campaign"},
		"fields":     {"campaign_id,campaign_name,spend,impressions,clicks,account_currency"},
		"time_range": {string(tr)},
		"limit":      {"500"},
	}
	next := fmt.Sprintf("%s/%s/act_%s/insights?%s", metaGraphBase, c.MetaVersion, url.PathEscape(c.MetaAccount), q.Encode())
	var out []spendCampaign
	currency := ""
	for page := 0; next != "" && page < 20; page++ {
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, next, nil)
		req.Header.Set("Authorization", "Bearer "+c.MetaToken)
		var body struct {
			Data []struct {
				CampaignID   string `json:"campaign_id"`
				CampaignName string `json:"campaign_name"`
				Spend        string `json:"spend"`
				Impressions  string `json:"impressions"`
				Clicks       string `json:"clicks"`
				Currency     string `json:"account_currency"`
			} `json:"data"`
			Paging struct {
				Next string `json:"next"`
			} `json:"paging"`
			Error *struct {
				Message string `json:"message"`
				Code    int    `json:"code"`
			} `json:"error"`
		}
		err := doJSON(req, &body)
		if body.Error != nil {
			return nil, "", fmt.Errorf("Meta (%d): %s", body.Error.Code, body.Error.Message)
		}
		if err != nil {
			return nil, "", fmt.Errorf("Meta: %w", err)
		}
		for _, d := range body.Data {
			out = append(out, spendCampaign{Platform: "meta", ID: d.CampaignID, Name: d.CampaignName, SpendCents: toCentsStr(d.Spend), Impressions: atoi64(d.Impressions), Clicks: atoi64(d.Clicks)})
			if currency == "" {
				currency = d.Currency
			}
		}
		next = body.Paging.Next
	}
	return out, currency, nil
}

// ---- Google Ads API ----

func googleAccessToken(ctx context.Context, c spendConfig) (string, error) {
	form := url.Values{"client_id": {c.GAdsClientID}, "client_secret": {c.GAdsSecret}, "refresh_token": {c.GAdsRefresh}, "grant_type": {"refresh_token"}}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, googleTokenURL, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var tok struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		Description string `json:"error_description"`
	}
	if err := doJSON(req, &tok); err != nil {
		return "", err
	}
	if tok.AccessToken == "" {
		return "", fmt.Errorf("token OAuth recusado: %s %s", tok.Error, tok.Description)
	}
	return tok.AccessToken, nil
}

func googleSpend(ctx context.Context, c spendConfig, from, to string) ([]spendCampaign, string, error) {
	access, err := googleAccessToken(ctx, c)
	if err != nil {
		return nil, "", fmt.Errorf("Google Ads: %w", err)
	}
	query := fmt.Sprintf("SELECT customer.currency_code, campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date BETWEEN '%s' AND '%s' AND metrics.impressions > 0", from, to)
	payload, _ := json.Marshal(map[string]string{"query": query})
	endpoint := fmt.Sprintf("%s/%s/customers/%s/googleAds:searchStream", googleAdsBase, c.GAdsVersion, c.GAdsCustomer)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer "+access)
	req.Header.Set("developer-token", c.GAdsDevToken)
	req.Header.Set("Content-Type", "application/json")
	if c.GAdsLoginCustomer != "" {
		req.Header.Set("login-customer-id", c.GAdsLoginCustomer)
	}
	// searchStream devolve uma lista de lotes; os números int64 vêm como texto.
	var batches []struct {
		Results []struct {
			Customer struct {
				CurrencyCode string `json:"currencyCode"`
			} `json:"customer"`
			Campaign struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"campaign"`
			Metrics struct {
				CostMicros  string `json:"costMicros"`
				Impressions string `json:"impressions"`
				Clicks      string `json:"clicks"`
			} `json:"metrics"`
		} `json:"results"`
	}
	if err := doJSON(req, &batches); err != nil {
		return nil, "", fmt.Errorf("Google Ads: %w", err)
	}
	var out []spendCampaign
	currency := ""
	for _, b := range batches {
		for _, r := range b.Results {
			out = append(out, spendCampaign{Platform: "google", ID: r.Campaign.ID, Name: r.Campaign.Name, SpendCents: int64(math.Round(float64(atoi64(r.Metrics.CostMicros)) / 10_000)), Impressions: atoi64(r.Metrics.Impressions), Clicks: atoi64(r.Metrics.Clicks)})
			if currency == "" {
				currency = r.Customer.CurrencyCode
			}
		}
	}
	return out, currency, nil
}

// ---- utilitários ----

// doJSON faz a chamada e decodifica o JSON mesmo com status de erro (a Meta explica o erro no corpo). Status de
// erro vira erro com o começo do corpo; nenhuma credencial vai na mensagem.
func doJSON(req *http.Request, out any) error {
	res, err := spendHTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return err
	}
	jerr := json.Unmarshal(body, out)
	if res.StatusCode >= 400 {
		msg := strings.TrimSpace(string(body))
		if len(msg) > 300 {
			msg = msg[:300] + "…"
		}
		return fmt.Errorf("HTTP %d: %s", res.StatusCode, msg)
	}
	if jerr != nil {
		return errors.New("resposta inesperada da plataforma")
	}
	return nil
}

func atoi64(s string) int64 {
	n, _ := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
	return n
}

// toCentsStr: "123.45" (gasto da Meta, na moeda da conta) vira 12345.
func toCentsStr(s string) int64 {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0
	}
	return int64(math.Round(f * 100))
}
