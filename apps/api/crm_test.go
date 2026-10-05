package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const testKey = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"

func TestCPFeCNPJ(t *testing.T) {
	// Documentos fictícios de apps/admin/src/mocks/people.ts. Alguns do mock NÃO fecham os dígitos
	// verificadores (o validador do admin também os recusa); a lista abaixo confere com ele.
	for _, cpf := range []string{"111.444.777-35", "529.982.247-25", "390.533.447-05", "168.995.350-09", "746.971.314-01"} {
		if !isValidCPF(cpf) {
			t.Errorf("CPF válido recusado: %s", cpf)
		}
	}
	for _, cpf := range []string{"111.444.777-34", "000.000.000-00", "123", "", "111.111.111-11", "905.112.660-79"} {
		if isValidCPF(cpf) {
			t.Errorf("CPF inválido aceito: %q", cpf)
		}
	}
	for _, cnpj := range []string{"11.222.333/0001-81", "12.ABC.345/01DE-35"} {
		if !isValidCNPJ(cnpj) {
			t.Errorf("CNPJ válido recusado: %s", cnpj)
		}
	}
	for _, cnpj := range []string{"11.222.333/0001-80", "00000000000000", "12.ABC.345/01DE-3A", "abc", "", "45.678.901/0001-23", "98.765.432/0001-10", "33.444.555/0001-66"} {
		if isValidCNPJ(cnpj) {
			t.Errorf("CNPJ inválido aceito: %q", cnpj)
		}
	}
	if maskCPF("111.444.777-35") != "•••.•••.•••-35" || !isMasked(maskCPF("11144477735")) || isMasked("111.444.777-35") {
		t.Error("máscara do CPF")
	}
	if stripDoc("12.abc.345/01de-35") != "12ABC34501DE35" {
		t.Error("stripDoc")
	}
}

func TestCriptografiaDoCPF(t *testing.T) {
	t.Setenv("DATA_KEY", "")
	if _, err := encryptDoc("111.444.777-35"); err != errNoKey {
		t.Errorf("sem chave deveria dar errNoKey: %v", err)
	}
	t.Setenv("DATA_KEY", "curta")
	if _, err := dataKey(); err == nil {
		t.Error("chave curta deveria ser recusada")
	}
	t.Setenv("DATA_KEY", testKey)
	a, err := encryptDoc("111.444.777-35")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := encryptDoc("111.444.777-35")
	if a == b || strings.Contains(a, "111") {
		t.Error("cifra deve usar nonce novo e não vazar o texto")
	}
	if plain, err := decryptDoc(a); err != nil || plain != "111.444.777-35" {
		t.Errorf("round trip: %q %v", plain, err)
	}
	if _, err := decryptDoc(a[:len(a)-4] + "AAAA"); err == nil {
		t.Error("adulterado deveria falhar (GCM autentica)")
	}
	h1, _ := docHash("11144477735")
	h2, _ := docHash("11144477735")
	h3, _ := docHash("52998224725")
	if h1 != h2 || h1 == h3 || len(h1) != 64 {
		t.Error("hash deve ser estável e distinguir documentos")
	}
	// base64 de 32 bytes também vale
	t.Setenv("DATA_KEY", "ABEiM0RVZneImaq7zN3u/wARIjNEVWZ3iJmqu8zd7v8=")
	if _, err := dataKey(); err != nil {
		t.Errorf("base64 deveria valer: %v", err)
	}
}

func TestFlexTime(t *testing.T) {
	var v struct{ D *FlexTime }
	for _, in := range []string{`{"D":"2026-10-05"}`, `{"D":"2026-10-05T14:30:00Z"}`, `{"D":"2026-10-05T11:30:00-03:00"}`, `{"D":"2026-10-05T14:30:00.123Z"}`} {
		v.D = nil
		if err := json.Unmarshal([]byte(in), &v); err != nil || v.D == nil || v.D.Year() != 2026 {
			t.Errorf("%s: %v", in, err)
		}
	}
	if err := json.Unmarshal([]byte(`{"D":"ontem"}`), &v); err == nil {
		t.Error("data inválida deveria falhar")
	}
	out, _ := json.Marshal(FlexTime{parseDT("2026-10-05 14:30:00").UTC()})
	if !strings.HasSuffix(string(out), `Z"`) {
		t.Errorf("saída deve ser RFC3339 UTC: %s", out)
	}
	if ptrTime(nil) != nil || ptrTime(&FlexTime{}) != nil {
		t.Error("data zero vira NULL")
	}
}

func TestValidatePerson(t *testing.T) {
	p := PersonDTO{Name: "  Ana  ", Email: "ANA@Ex.com", ExtraEmails: []ContactPoint{{Value: "a2@ex.com"}, {Value: "  "}}}
	if err := validatePerson(&p); err != nil || p.Name != "Ana" || p.Email != "ana@ex.com" || p.Lifecycle != "LEAD" || len(p.ExtraEmails) != 1 || p.Tags == nil {
		t.Fatalf("válida: %v %+v", err, p)
	}
	for name, bad := range map[string]PersonDTO{
		"sem nome":        {Email: "a@b.co"},
		"email":           {Name: "A", Email: "x"},
		"email adicional": {Name: "A", ExtraEmails: []ContactPoint{{Value: "x"}}},
		"ciclo":           {Name: "A", Lifecycle: "VIP"},
	} {
		bad := bad
		if err := validatePerson(&bad); err == nil {
			t.Errorf("%s: deveria falhar", name)
		}
	}
}

func TestDocColumns(t *testing.T) {
	t.Setenv("DATA_KEY", testKey)
	if _, _, change, err := docColumns(maskCPF("11144477735")); err != nil || change {
		t.Error("valor mascarado = manter")
	}
	if enc, hash, change, err := docColumns(""); err != nil || !change || enc != nil || hash != nil {
		t.Error("vazio = apagar")
	}
	if _, _, _, err := docColumns("111.444.777-34"); err != errInvalidCPF {
		t.Errorf("CPF ruim: %v", err)
	}
	if enc, hash, change, err := docColumns("111.444.777-35"); err != nil || !change || enc == nil || hash == nil {
		t.Errorf("CPF bom: %v", err)
	}
	t.Setenv("DATA_KEY", "")
	if _, _, _, err := docColumns("111.444.777-35"); err != errNoKey {
		t.Errorf("sem chave: %v", err)
	}
}

func TestValidateCompany(t *testing.T) {
	c := CompanyDTO{Name: "Acme", Document: "11.222.333/0001-81", State: "sp", Stakeholders: []StakeholderDTO{{PersonID: "p1", Tag: "Decisor"}}}
	if err := validateCompany(&c); err != nil || c.Document != "11222333000181" || c.Status != "ACTIVE" || c.State != "SP" || c.Lifecycle != "LEAD" {
		t.Fatalf("válida: %v %+v", err, c)
	}
	sem := CompanyDTO{Name: "Sem CNPJ"}
	if err := validateCompany(&sem); err != nil || sem.Status != "REVIEW" || sem.Stakeholders == nil {
		t.Errorf("sem CNPJ deve ficar em análise: %v %+v", err, sem)
	}
	alnum := CompanyDTO{Name: "Tzolkin", Document: "12.ABC.345/01DE-35"}
	if err := validateCompany(&alnum); err != nil || alnum.Document != "12ABC34501DE35" {
		t.Errorf("CNPJ alfanumérico: %v %+v", err, alnum)
	}
	for name, bad := range map[string]CompanyDTO{
		"sem nome":        {},
		"cnpj":            {Name: "A", Document: "11.222.333/0001-80"},
		"pessoa repetida": {Name: "A", Stakeholders: []StakeholderDTO{{PersonID: "p1"}, {PersonID: "p1"}}},
		"id de pessoa":    {Name: "A", Stakeholders: []StakeholderDTO{{PersonID: "p 1"}}},
		"ciclo":           {Name: "A", Lifecycle: "X"},
	} {
		bad := bad
		if err := validateCompany(&bad); err == nil {
			t.Errorf("%s: deveria falhar", name)
		}
	}
}

func TestValidateLeadRecord(t *testing.T) {
	val := 1500.555
	l := LeadDTO{Name: "Renata", Email: "R@x.co", PipelineID: "q4", StageID: "q4:novos", Origin: "INBOUND", SourceName: "LP", EstimatedValue: &val}
	if err := validateLeadRecord(&l); err != nil || l.Email != "r@x.co" || l.Status != "ACTIVE" || *l.EstimatedValue != 1500.56 {
		t.Fatalf("válido: %v %+v", err, l)
	}
	ok := func() LeadDTO {
		return LeadDTO{Name: "R", Email: "r@x.co", PipelineID: "q4", StageID: "q4:novos", Origin: "OUTBOUND", SourceName: "Carol"}
	}
	mut := map[string]func(*LeadDTO){
		"sem nome":       func(l *LeadDTO) { l.Name = "" },
		"sem contato":    func(l *LeadDTO) { l.Email = ""; l.Phone = "" },
		"origem":         func(l *LeadDTO) { l.Origin = "X" },
		"sem fonte":      func(l *LeadDTO) { l.SourceName = "" },
		"sem funil":      func(l *LeadDTO) { l.PipelineID = "" },
		"situação":       func(l *LeadDTO) { l.Status = "X" },
		"valor negativo": func(l *LeadDTO) { v := -1.0; l.EstimatedValue = &v },
		"vínculo":        func(l *LeadDTO) { l.PersonID = "p 1" },
	}
	for name, m := range mut {
		l := ok()
		m(&l)
		if err := validateLeadRecord(&l); err == nil {
			t.Errorf("%s: deveria falhar", name)
		}
	}
	l2 := ok()
	l2.Email, l2.Phone = "", "(11) 99999-0000"
	if err := validateLeadRecord(&l2); err != nil {
		t.Errorf("só telefone deve valer: %v", err)
	}
}

func TestSchemaListasEFlag(t *testing.T) {
	if got := len(splitStatements(crmTables)); got != 2 {
		t.Errorf("esperava 2 CREATE TABLE, achei %d", got)
	}
	t.Setenv("CRM_API", "")
	if crmEnabled() {
		t.Error("CRM deve vir desligado")
	}
	t.Setenv("CRM_API", "1")
	if !crmEnabled() {
		t.Error("CRM_API=1 deveria ligar")
	}
	seen := map[string]bool{}
	for _, c := range crmColumns {
		k := c.table + "." + c.col
		if seen[k] {
			t.Errorf("coluna repetida: %s", k)
		}
		seen[k] = true
	}
}

func TestPaginacao(t *testing.T) {
	get := func(q string) page { return readPage(httptest.NewRequest("GET", "/x?"+q, nil)) }
	if p := get(""); p.limit != 200 || p.offset != 0 {
		t.Errorf("padrão: %+v", p)
	}
	if p := get("limit=9999&offset=40"); p.limit != 500 || p.offset != 40 {
		t.Errorf("teto: %+v", p)
	}
	if p := get("limit=abc&offset=-3"); p.limit != 200 || p.offset != 0 {
		t.Errorf("lixo: %+v", p)
	}
}

// Caminhos dos handlers que respondem antes de tocar no banco.
func TestCRMHandlersSemBanco(t *testing.T) {
	do := func(h http.HandlerFunc, method, id, body string) int {
		req := httptest.NewRequest(method, "/api/crm/x", strings.NewReader(body))
		if id != "" {
			req.SetPathValue("id", id)
		}
		rec := httptest.NewRecorder()
		h(rec, req)
		return rec.Code
	}
	cases := []struct {
		name        string
		h           http.HandlerFunc
		m, id, body string
		want        int
	}{
		{"pessoas método", handlePeople, "PATCH", "", "", 405},
		{"pessoa json ruim", handlePeople, "POST", "", "nada", 400},
		{"pessoa sem nome", handlePeople, "POST", "", `{"name":""}`, 422},
		{"pessoa id ruim", handlePeople, "POST", "", `{"id":"a b","name":"A"}`, 422},
		{"pessoa PUT inválida", handlePersonByID, "PUT", "p1", `{"name":"","lifecycle":"X"}`, 422},
		{"pessoa id na rota", handlePersonByID, "GET", "a b", "", 400},
		{"documento id", handlePersonDocument, "GET", "a b", "", 400},
		{"documento método", handlePersonDocument, "POST", "p1", "", 400},
		{"empresa sem nome", handleCompanies, "POST", "", `{}`, 422},
		{"empresa cnpj ruim", handleCompanies, "POST", "", `{"name":"A","document":"1"}`, 422},
		{"empresa PUT inválida", handleCompanyByID, "PUT", "c1", `{"name":""}`, 422},
		{"lead sem fonte", handleCRMLeads, "POST", "", `{"name":"R","email":"r@x.co","pipelineId":"q","stageId":"q:n","origin":"INBOUND"}`, 422},
		{"lead método", handleCRMLeads, "PUT", "", "", 405},
		{"lead PUT inválido", handleCRMLeadByID, "PUT", "l1", `{}`, 422},
	}
	for _, c := range cases {
		if got := do(c.h, c.m, c.id, c.body); got != c.want {
			t.Errorf("%s: %d (queria %d)", c.name, got, c.want)
		}
	}
}
