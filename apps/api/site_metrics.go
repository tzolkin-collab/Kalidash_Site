package main

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Métricas do site na Dashboard, lidas do Google Analytics 4 (API de dados, runReport). O site já manda as visitas
// para o GA4 pelo gtag (apps/site/src/app/components/Analytics.tsx); aqui a API só LÊ os relatórios, com uma conta
// de serviço que tem acesso de Leitor à propriedade. A assinatura do JWT da conta de serviço é feita aqui mesmo
// (RS256), sem SDK do Google.
//
// Variáveis: GA4_PROPERTY_ID (o número da propriedade, não o G-XXXX) e GA4_SERVICE_ACCOUNT (o JSON da chave da
// conta de serviço, inteiro ou em base64). Sem elas a rota responde {configured:false} e a Dashboard explica.
//
// GET /api/site-metrics?period=month|30d|90d|year|all → totais (com o período anterior), visitas por dia, páginas
// mais vistas, canais e origem/mídia. Cache de 10 min por período: o GA4 tem cota por propriedade.

const (
	ga4Scope       = "https://www.googleapis.com/auth/analytics.readonly"
	ga4DataBase    = "https://analyticsdata.googleapis.com/v1beta"
	siteMetricsTTL = 10 * time.Minute
)

type siteTotals struct {
	Users          int64   `json:"users"`
	NewUsers       int64   `json:"newUsers"`
	Sessions       int64   `json:"sessions"`
	Views          int64   `json:"views"`
	EngagementRate float64 `json:"engagementRate"`
	AvgSessionSecs float64 `json:"avgSessionSeconds"`
}

type siteDay struct {
	Date     string `json:"date"`
	Users    int64  `json:"users"`
	Sessions int64  `json:"sessions"`
}

type sitePage struct {
	Path  string `json:"path"`
	Title string `json:"title"`
	Views int64  `json:"views"`
	Users int64  `json:"users"`
}

type siteRow struct {
	Label    string `json:"label"`
	Sessions int64  `json:"sessions"`
}

type siteMetrics struct {
	Configured bool        `json:"configured"`
	Period     string      `json:"period"`
	From       string      `json:"from"`
	To         string      `json:"to"`
	Totals     siteTotals  `json:"totals"`
	Previous   *siteTotals `json:"previous"`
	Daily      []siteDay   `json:"daily"`
	Pages      []sitePage  `json:"pages"`
	Channels   []siteRow   `json:"channels"`
	Sources    []siteRow   `json:"sources"`
	FetchedAt  time.Time   `json:"fetchedAt"`
}

// ---- configuração e token ------------------------------------------------------------------------------------------

type ga4Account struct {
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

func ga4Config() (property string, acc *ga4Account, err error) {
	property = strings.TrimSpace(os.Getenv("GA4_PROPERTY_ID"))
	property = strings.TrimPrefix(property, "properties/")
	raw := strings.TrimSpace(os.Getenv("GA4_SERVICE_ACCOUNT"))
	if property == "" || raw == "" {
		return "", nil, nil
	}
	if _, convErr := strconv.ParseUint(property, 10, 64); convErr != nil {
		return "", nil, errors.New("GA4_PROPERTY_ID deve ser o número da propriedade (Admin → Detalhes da propriedade), não o ID de medição G-…")
	}
	if !strings.HasPrefix(raw, "{") {
		if dec, decErr := base64.StdEncoding.DecodeString(raw); decErr == nil {
			raw = string(dec)
		}
	}
	var a ga4Account
	if json.Unmarshal([]byte(raw), &a) != nil || a.ClientEmail == "" || a.PrivateKey == "" {
		return "", nil, errors.New("GA4_SERVICE_ACCOUNT não é o JSON de uma chave de conta de serviço")
	}
	if a.TokenURI == "" {
		a.TokenURI = "https://oauth2.googleapis.com/token"
	}
	return property, &a, nil
}

var ga4Token struct {
	sync.Mutex
	value   string
	expires time.Time
	email   string
}

func parseRSAKey(pemKey string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemKey))
	if block == nil {
		return nil, errors.New("chave privada da conta de serviço ilegível")
	}
	if k, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rk, ok := k.(*rsa.PrivateKey); ok {
			return rk, nil
		}
		return nil, errors.New("a chave da conta de serviço não é RSA")
	}
	return x509.ParsePKCS1PrivateKey(block.Bytes)
}

// serviceAccountJWT monta a asserção RS256 que o Google troca por um token de acesso.
func serviceAccountJWT(a *ga4Account, now time.Time) (string, error) {
	key, err := parseRSAKey(a.PrivateKey)
	if err != nil {
		return "", err
	}
	enc := base64.RawURLEncoding
	header := enc.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))
	claims, _ := json.Marshal(map[string]any{
		"iss": a.ClientEmail, "scope": ga4Scope, "aud": a.TokenURI,
		"iat": now.Unix(), "exp": now.Add(time.Hour).Unix(),
	})
	unsigned := header + "." + enc.EncodeToString(claims)
	sum := sha256.Sum256([]byte(unsigned))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, sum[:])
	if err != nil {
		return "", err
	}
	return unsigned + "." + enc.EncodeToString(sig), nil
}

var ga4HTTP = &http.Client{Timeout: 20 * time.Second}

func ga4AccessToken(a *ga4Account) (string, error) {
	ga4Token.Lock()
	defer ga4Token.Unlock()
	if ga4Token.value != "" && ga4Token.email == a.ClientEmail && time.Until(ga4Token.expires) > time.Minute {
		return ga4Token.value, nil
	}
	assertion, err := serviceAccountJWT(a, time.Now())
	if err != nil {
		return "", err
	}
	form := url.Values{"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"}, "assertion": {assertion}}
	res, err := ga4HTTP.PostForm(a.TokenURI, form)
	if err != nil {
		return "", fmt.Errorf("Google não respondeu ao pedir o token: %w", err)
	}
	defer res.Body.Close()
	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		Error       string `json:"error"`
		Description string `json:"error_description"`
	}
	json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&out)
	if res.StatusCode != http.StatusOK || out.AccessToken == "" {
		return "", fmt.Errorf("o Google recusou a conta de serviço (%s %s)", out.Error, out.Description)
	}
	ga4Token.value, ga4Token.email = out.AccessToken, a.ClientEmail
	ga4Token.expires = time.Now().Add(time.Duration(out.ExpiresIn) * time.Second)
	return out.AccessToken, nil
}

// ---- relatórios ----------------------------------------------------------------------------------------------------

type ga4Range struct {
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
}

type ga4Report struct {
	DimensionHeaders []struct{ Name string } `json:"dimensionHeaders"`
	MetricHeaders    []struct{ Name string } `json:"metricHeaders"`
	Rows             []struct {
		DimensionValues []struct{ Value string } `json:"dimensionValues"`
		MetricValues    []struct{ Value string } `json:"metricValues"`
	} `json:"rows"`
}

// siteRanges devolve o período atual e o anterior (nil em "Tudo"), em datas do fuso de Brasília, como na Dashboard.
func siteRanges(period string, now time.Time) (cur ga4Range, prev *ga4Range) {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.FixedZone("BRT", -3*3600)
	}
	today := now.In(loc)
	day := func(t time.Time) string { return t.Format("2006-01-02") }
	end := day(today)
	switch period {
	case "30d", "90d":
		n := 30
		if period == "90d" {
			n = 90
		}
		start := today.AddDate(0, 0, -(n - 1))
		return ga4Range{day(start), end}, &ga4Range{day(start.AddDate(0, 0, -n)), day(start.AddDate(0, 0, -1))}
	case "year":
		start := time.Date(today.Year(), 1, 1, 0, 0, 0, 0, loc)
		pStart := start.AddDate(-1, 0, 0)
		return ga4Range{day(start), end}, &ga4Range{day(pStart), day(pStart.AddDate(0, 0, today.YearDay()-1))}
	case "all":
		return ga4Range{"2020-01-01", end}, nil
	default: // month
		start := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, loc)
		pStart := start.AddDate(0, -1, 0)
		pEnd := pStart.AddDate(0, 0, today.Day()-1)
		if pEnd.Month() != pStart.Month() {
			pEnd = start.AddDate(0, 0, -1)
		}
		return ga4Range{day(start), end}, &ga4Range{day(pStart), day(pEnd)}
	}
}

func ga4BatchRun(property, token string, requests []map[string]any) ([]ga4Report, error) {
	body, _ := json.Marshal(map[string]any{"requests": requests})
	req, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/properties/%s:batchRunReports", ga4DataBase, property), bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	res, err := ga4HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("o Google Analytics não respondeu: %w", err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if res.StatusCode != http.StatusOK {
		var e struct {
			Error struct {
				Message string `json:"message"`
				Status  string `json:"status"`
			} `json:"error"`
		}
		json.Unmarshal(raw, &e)
		if e.Error.Status == "PERMISSION_DENIED" {
			msg := strings.ToLower(e.Error.Message)
			if strings.Contains(msg, "has not been used") || strings.Contains(msg, "is disabled") || strings.Contains(msg, "service_disabled") {
				return nil, errors.New("a Google Analytics Data API está desativada no projeto do Google Cloud da conta de serviço: ative-a em APIs e serviços → Biblioteca e espere alguns minutos")
			}
			return nil, errors.New("a conta de serviço não tem acesso a esta propriedade do GA4: adicione o e-mail dela como Leitor em Admin → Gerenciamento de acesso à propriedade")
		}
		return nil, fmt.Errorf("o Google Analytics recusou o relatório (%d): %s", res.StatusCode, e.Error.Message)
	}
	var out struct {
		Reports []ga4Report `json:"reports"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, errors.New("resposta do Google Analytics ilegível")
	}
	return out.Reports, nil
}

func metricInt(v string) int64 {
	n, _ := strconv.ParseFloat(v, 64)
	return int64(n + 0.5)
}

func metricFloat(v string) float64 {
	n, _ := strconv.ParseFloat(v, 64)
	return n
}

// buildSiteMetrics transforma as 5 respostas do batchRunReports no formato da Dashboard (separado para os testes).
func buildSiteMetrics(period string, cur ga4Range, prev *ga4Range, reports []ga4Report) siteMetrics {
	m := siteMetrics{Configured: true, Period: period, From: cur.StartDate, To: cur.EndDate, Daily: []siteDay{}, Pages: []sitePage{}, Channels: []siteRow{}, Sources: []siteRow{}}
	at := func(i int) ga4Report {
		if i < len(reports) {
			return reports[i]
		}
		return ga4Report{}
	}
	totalsOf := func(vals []struct{ Value string }) siteTotals {
		get := func(i int) string {
			if i < len(vals) {
				return vals[i].Value
			}
			return "0"
		}
		return siteTotals{Users: metricInt(get(0)), NewUsers: metricInt(get(1)), Sessions: metricInt(get(2)), Views: metricInt(get(3)), EngagementRate: metricFloat(get(4)), AvgSessionSecs: metricFloat(get(5))}
	}
	// 0: totais. Com dois intervalos o GA4 acrescenta a dimensão dateRange ("date_range_0" / "date_range_1").
	for _, row := range at(0).Rows {
		which := ""
		if len(row.DimensionValues) > 0 {
			which = row.DimensionValues[0].Value
		}
		t := totalsOf(row.MetricValues)
		if which == "date_range_1" {
			p := t
			m.Previous = &p
		} else {
			m.Totals = t
		}
	}
	if prev != nil && m.Previous == nil {
		m.Previous = &siteTotals{}
	}
	// 1: por dia (AAAAMMDD), já ordenado.
	for _, row := range at(1).Rows {
		if len(row.DimensionValues) == 0 || len(row.MetricValues) < 2 {
			continue
		}
		d := row.DimensionValues[0].Value
		if len(d) == 8 {
			d = d[:4] + "-" + d[4:6] + "-" + d[6:]
		}
		m.Daily = append(m.Daily, siteDay{Date: d, Users: metricInt(row.MetricValues[0].Value), Sessions: metricInt(row.MetricValues[1].Value)})
	}
	// 2: páginas (caminho, título).
	for _, row := range at(2).Rows {
		if len(row.DimensionValues) < 2 || len(row.MetricValues) < 2 {
			continue
		}
		m.Pages = append(m.Pages, sitePage{Path: row.DimensionValues[0].Value, Title: row.DimensionValues[1].Value, Views: metricInt(row.MetricValues[0].Value), Users: metricInt(row.MetricValues[1].Value)})
	}
	rowsOf := func(r ga4Report) []siteRow {
		out := []siteRow{}
		for _, row := range r.Rows {
			if len(row.DimensionValues) == 0 || len(row.MetricValues) == 0 {
				continue
			}
			out = append(out, siteRow{Label: row.DimensionValues[0].Value, Sessions: metricInt(row.MetricValues[0].Value)})
		}
		return out
	}
	m.Channels = rowsOf(at(3))
	m.Sources = rowsOf(at(4))
	return m
}

func fetchSiteMetrics(property string, acc *ga4Account, period string) (siteMetrics, error) {
	token, err := ga4AccessToken(acc)
	if err != nil {
		return siteMetrics{}, err
	}
	cur, prev := siteRanges(period, time.Now())
	totalRanges := []ga4Range{cur}
	if prev != nil {
		totalRanges = append(totalRanges, *prev)
	}
	metric := func(names ...string) []map[string]string {
		out := make([]map[string]string, len(names))
		for i, n := range names {
			out[i] = map[string]string{"name": n}
		}
		return out
	}
	dim := func(names ...string) []map[string]string { return metric(names...) }
	desc := func(name string) []map[string]any {
		return []map[string]any{{"metric": map[string]string{"metricName": name}, "desc": true}}
	}
	requests := []map[string]any{
		{"dateRanges": totalRanges, "metrics": metric("activeUsers", "newUsers", "sessions", "screenPageViews", "engagementRate", "averageSessionDuration")},
		{"dateRanges": []ga4Range{cur}, "dimensions": dim("date"), "metrics": metric("activeUsers", "sessions"), "orderBys": []map[string]any{{"dimension": map[string]string{"dimensionName": "date"}}}, "limit": 400},
		{"dateRanges": []ga4Range{cur}, "dimensions": dim("pagePath", "pageTitle"), "metrics": metric("screenPageViews", "activeUsers"), "orderBys": desc("screenPageViews"), "limit": 8},
		{"dateRanges": []ga4Range{cur}, "dimensions": dim("sessionDefaultChannelGroup"), "metrics": metric("sessions"), "orderBys": desc("sessions"), "limit": 8},
		{"dateRanges": []ga4Range{cur}, "dimensions": dim("sessionSourceMedium"), "metrics": metric("sessions"), "orderBys": desc("sessions"), "limit": 8},
	}
	reports, err := ga4BatchRun(property, token, requests)
	if err != nil {
		// Nem o ID da propriedade nem o e-mail da conta são segredos: mostrar os dois ajuda a achar o engano no GA4.
		return siteMetrics{}, fmt.Errorf("%w (propriedade %s, conta %s)", err, property, acc.ClientEmail)
	}
	m := buildSiteMetrics(period, cur, prev, reports)
	m.FetchedAt = time.Now()
	return m, nil
}

var siteCache struct {
	sync.Mutex
	items map[string]siteMetrics
}

func validSitePeriod(p string) string {
	switch p {
	case "month", "30d", "90d", "year", "all":
		return p
	}
	return "month"
}

func handleSiteMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "use GET"})
		return
	}
	property, acc, err := ga4Config()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"configured": false, "error": err.Error()})
		return
	}
	if acc == nil {
		writeJSON(w, http.StatusOK, map[string]any{"configured": false})
		return
	}
	period := validSitePeriod(r.URL.Query().Get("period"))
	key := property + "|" + period
	siteCache.Lock()
	if c, ok := siteCache.items[key]; ok && time.Since(c.FetchedAt) < siteMetricsTTL && r.URL.Query().Get("fresh") != "1" {
		siteCache.Unlock()
		writeJSON(w, http.StatusOK, c)
		return
	}
	siteCache.Unlock()
	m, err := fetchSiteMetrics(property, acc, period)
	if err != nil {
		log.Printf("⚠️ métricas do site (GA4): %v", err)
		writeJSON(w, http.StatusBadGateway, map[string]any{"configured": true, "error": err.Error()})
		return
	}
	siteCache.Lock()
	if siteCache.items == nil {
		siteCache.items = map[string]siteMetrics{}
	}
	siteCache.items[key] = m
	siteCache.Unlock()
	writeJSON(w, http.StatusOK, m)
}
