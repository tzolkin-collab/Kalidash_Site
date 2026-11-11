package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// memTrackingStore: TrackingEvent em memória, com a mesma regra do MySQL.
type memTrackingStore struct {
	mu   sync.Mutex
	rows map[string]map[string]any
}

func newMemTracking() *memTrackingStore { return &memTrackingStore{rows: map[string]map[string]any{}} }

func (m *memTrackingStore) Claim(id, name, source string) (claimResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	row, ok := m.rows[id]
	if !ok {
		m.rows[id] = map[string]any{"leadSaved": false}
		return claimNew, nil
	}
	if row["leadSaved"].(bool) {
		return claimDone, nil
	}
	return claimRetry, nil
}

func (m *memTrackingStore) MarkLeadSaved(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rows[id]["leadSaved"] = true
	return nil
}

func (m *memTrackingStore) MarkDelivery(id, channel, status, msg string, attempts int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rows[id][channel] = status
	return nil
}

func (m *memTrackingStore) get(id, k string) any {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.rows[id][k]
}

// O mesmo event_id grava 1 lead e dispara 1 conversão, por mais vezes que chegue.
func TestPublicLeadIdempotent(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "")
	t.Setenv("SITE_URL", "")
	t.Setenv("META_PIXEL_ID", "123")
	t.Setenv("META_CAPI_ACCESS_TOKEN", "tok")
	store := newMemTracking()
	saves, dispatched := 0, []conversionEvent{}
	oldStore, oldSaver, oldDispatch := tracking, leadSaver, dispatchConversion
	tracking = store
	leadSaver = func(in leadInput, ip string) error { saves++; return nil }
	dispatchConversion = func(ev conversionEvent) { dispatched = append(dispatched, ev) }
	t.Cleanup(func() { tracking, leadSaver, dispatchConversion = oldStore, oldSaver, oldDispatch })

	body := `{"name":"Ana Souza","email":"Ana@X.com","phone":"(11) 98888-7777","source":"site-home-diagnostico","event_id":"0b6e1f4e-3c1a-4c7e-9d1e-2f9b8a7c6d5e","attribution":{"utm_source":"meta","_fbp":"fb.1.1.2","ga_client_id":"111.222"}}`
	post := func(ip string) (int, map[string]any) {
		req := httptest.NewRequest("POST", "/api/public/leads", strings.NewReader(body))
		req.Header.Set("X-Forwarded-For", ip)
		req.Header.Set("X-Client-User-Agent", "Mozilla/5.0 teste")
		rec := httptest.NewRecorder()
		handlePublicLead(rec, req)
		var out map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		return rec.Code, out
	}

	code, out := post("8.0.0.1")
	if code != 201 || out["eventId"] != "0b6e1f4e-3c1a-4c7e-9d1e-2f9b8a7c6d5e" {
		t.Fatalf("1º envio: %d %v", code, out)
	}
	if ss := out["serverSide"].(map[string]any); ss["meta"] != true || ss["ga4"] != false {
		t.Errorf("serverSide: %v", ss)
	}
	code, out = post("8.0.0.2")
	if code != 200 || out["duplicate"] != true {
		t.Fatalf("reenvio deve responder duplicado: %d %v", code, out)
	}
	if saves != 1 || len(dispatched) != 1 {
		t.Fatalf("gravou %d lead(s) e disparou %d conversão(ões), queria 1 e 1", saves, len(dispatched))
	}
	ev := dispatched[0]
	if ev.IP != "8.0.0.1" || ev.UserAgent != "Mozilla/5.0 teste" || ev.Attr["_fbp"] != "fb.1.1.2" {
		t.Errorf("evento: %+v", ev)
	}
}

// Lead que falhou ao gravar: a nova tentativa com o mesmo id grava (claimRetry) e só então dispara.
func TestPublicLeadRetryAfterFailure(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "")
	t.Setenv("SITE_URL", "")
	store := newMemTracking()
	fail, saves, dispatched := true, 0, 0
	oldStore, oldSaver, oldDispatch := tracking, leadSaver, dispatchConversion
	tracking = store
	leadSaver = func(in leadInput, ip string) error {
		if fail {
			return errors.New("banco fora")
		}
		saves++
		return nil
	}
	dispatchConversion = func(ev conversionEvent) { dispatched++ }
	t.Cleanup(func() { tracking, leadSaver, dispatchConversion = oldStore, oldSaver, oldDispatch })

	body := `{"name":"Ana Souza","email":"ana@x.com","phone":"11988887777","event_id":"retry-0000-1111"}`
	do := func(ip string) int {
		req := httptest.NewRequest("POST", "/api/public/leads", strings.NewReader(body))
		req.Header.Set("X-Forwarded-For", ip)
		rec := httptest.NewRecorder()
		handlePublicLead(rec, req)
		return rec.Code
	}
	if c := do("8.0.1.1"); c != 500 || dispatched != 0 {
		t.Fatalf("falha: %d, disparos %d", c, dispatched)
	}
	fail = false
	if c := do("8.0.1.2"); c != 201 || saves != 1 || dispatched != 1 {
		t.Fatalf("nova tentativa: %d, gravações %d, disparos %d", c, saves, dispatched)
	}
	if c := do("8.0.1.3"); c != 200 || saves != 1 || dispatched != 1 {
		t.Fatalf("terceiro envio deveria ser duplicado: %d", c)
	}
}

func TestAttributionNote(t *testing.T) {
	got := attributionNote(map[string]any{"utm_campaign": "c1", "utm_source": "meta", "_fbp": "x", "ga_client_id": "1.2", "landing_page": "/?utm_source=meta"})
	want := "utm_source: meta\nutm_campaign: c1\nlanding_page: /?utm_source=meta"
	if got != want {
		t.Errorf("got %q want %q", got, want)
	}
	if attributionNote(nil) != "" {
		t.Error("sem atribuição, nota vazia")
	}
}

func TestNormalizeEventID(t *testing.T) {
	if got := normalizeEventID("0b6e1f4e-3c1a-4c7e-9d1e-2f9b8a7c6d5e"); got != "0b6e1f4e-3c1a-4c7e-9d1e-2f9b8a7c6d5e" {
		t.Errorf("uuid: %s", got)
	}
	for _, bad := range []string{"", "curto", "tem espaço aqui!!", strings.Repeat("a", 65), "x'; DROP TABLE"} {
		if got := normalizeEventID(bad); !strings.HasPrefix(got, "srv-") || !eventIDRe.MatchString(got) {
			t.Errorf("%q virou %q", bad, got)
		}
	}
}

func TestMetaPayload(t *testing.T) {
	at := time.Unix(1_800_000_000, 0)
	ev := conversionEvent{
		EventID: "evt-12345678", Name: "Lead", Time: at,
		Email: " Ana@X.com ", Phone: "(11) 98888-7777", FullName: "Ana Maria Souza", Source: "site-home-diagnostico",
		IP: "8.8.8.8", UserAgent: "UA",
		Attr: map[string]string{"fbclid": "ABC", "fbclid_at": "1799999999000", "_fbp": "fb.1.1.2", "page_url": "https://kalidash.com/", "utm_campaign": "c1"},
	}
	body := metaPayload(trackingConfig{MetaToken: "tok", MetaTestCode: "TEST1"}, ev)
	e := body["data"].([]any)[0].(map[string]any)
	u := e["user_data"].(map[string]any)
	if e["event_id"] != "evt-12345678" || e["event_name"] != "Lead" || e["action_source"] != "website" || e["event_time"] != int64(1_800_000_000) {
		t.Errorf("evento: %v", e)
	}
	if u["em"].([]string)[0] != sha256Hex("ana@x.com") {
		t.Error("e-mail precisa ir minúsculo, sem espaço e em SHA-256")
	}
	if u["ph"].([]string)[0] != sha256Hex("5511988887777") {
		t.Error("telefone precisa ir com 55 e só dígitos")
	}
	if u["fn"].([]string)[0] != sha256Hex("ana") || u["ln"].([]string)[0] != sha256Hex("souza") {
		t.Error("nome e sobrenome")
	}
	if u["fbc"] != "fb.1.1799999999000.ABC" || u["fbp"] != "fb.1.1.2" || u["client_ip_address"] != "8.8.8.8" {
		t.Errorf("fbc/fbp/ip: %v", u)
	}
	if e["event_source_url"] != "https://kalidash.com/" || body["test_event_code"] != "TEST1" {
		t.Errorf("url/test code: %v", body)
	}
	if e["custom_data"].(map[string]any)["utm_campaign"] != "c1" {
		t.Error("utm no custom_data")
	}
	// _fbc do navegador vence o montado.
	ev.Attr["_fbc"] = "fb.1.5.XYZ"
	if fbcFor(ev.Attr, at) != "fb.1.5.XYZ" {
		t.Error("_fbc do cookie deve vencer")
	}
}

func TestGA4Payload(t *testing.T) {
	ev := conversionEvent{EventID: "evt-12345678", Time: time.Unix(1_800_000_000, 0), Source: "s",
		Attr: map[string]string{"ga_client_id": "111.222", "ga_session_id": "1799999000", "utm_source": "google"}}
	p := ga4Payload(ev)
	params := p["events"].([]any)[0].(map[string]any)["params"].(map[string]any)
	if p["client_id"] != "111.222" || params["session_id"] != int64(1799999000) || params["utm_source"] != "google" {
		t.Errorf("payload: %v", p)
	}
	delete(ev.Attr, "ga_client_id")
	if ga4Payload(ev)["client_id"] != "srv.evt-12345678" {
		t.Error("sem _ga usa um client_id do servidor")
	}
}

// Entrega real contra servidores falsos: 5xx repete, 4xx para, e o status fica na TrackingEvent.
func TestDeliverConversion(t *testing.T) {
	oldDelays, oldStore, oldMeta, oldGA := retryDelays, tracking, metaEndpoint, ga4Endpoint
	retryDelays = []time.Duration{0, 0, 0}
	store := newMemTracking()
	tracking = store
	t.Cleanup(func() { retryDelays, tracking, metaEndpoint, ga4Endpoint = oldDelays, oldStore, oldMeta, oldGA })

	var mu sync.Mutex
	metaCalls, gaCalls := 0, 0
	meta := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		metaCalls++
		n := metaCalls
		mu.Unlock()
		if n < 2 {
			w.WriteHeader(503)
			return
		}
		b, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(b), `"event_id":"evt-deliver-1"`) {
			w.WriteHeader(400)
			return
		}
		w.Write([]byte(`{"events_received":1}`))
	}))
	defer meta.Close()
	ga := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		gaCalls++
		mu.Unlock()
		w.WriteHeader(400) // erro de configuração: não repete
	}))
	defer ga.Close()
	metaEndpoint = func(trackingConfig) string { return meta.URL }
	ga4Endpoint = func(trackingConfig) string { return ga.URL }

	store.rows["evt-deliver-1"] = map[string]any{"leadSaved": true}
	cfg := trackingConfig{PixelID: "1", MetaToken: "t", GA4ID: "G-1", GA4Secret: "s", GraphVersion: "v21.0"}
	deliverConversion(cfg, conversionEvent{EventID: "evt-deliver-1", Name: "Lead", Time: time.Now(), Attr: map[string]string{}})

	if store.get("evt-deliver-1", "meta") != "sent" || metaCalls != 2 {
		t.Errorf("meta: %v em %d chamadas", store.get("evt-deliver-1", "meta"), metaCalls)
	}
	if store.get("evt-deliver-1", "ga4") != "failed" || gaCalls != 1 {
		t.Errorf("ga4: %v em %d chamadas", store.get("evt-deliver-1", "ga4"), gaCalls)
	}

	// Sem configuração: as duas camadas ficam "skipped" e nada sai.
	store.rows["evt-deliver-2"] = map[string]any{"leadSaved": true}
	deliverConversion(trackingConfig{}, conversionEvent{EventID: "evt-deliver-2", Attr: map[string]string{}})
	if store.get("evt-deliver-2", "meta") != "skipped" || store.get("evt-deliver-2", "ga4") != "skipped" {
		t.Error("sem configuração deve marcar skipped")
	}
}
