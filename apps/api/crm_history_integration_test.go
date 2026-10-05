package main

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func historyCall(method, path, body, ip string) crmReply {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("X-Forwarded-For", ip)
	rec := httptest.NewRecorder()
	handleHistory(rec, req)
	return crmReply{rec.Code, rec.Body.Bytes(), rec.Header()}
}

func TestIntegrationHistorico(t *testing.T) {
	crmDB(t)
	db.Exec("DELETE FROM ChangeLog")
	now := time.Now().UTC()
	iso := func(d time.Duration) string { return now.Add(d).Format("2006-01-02T15:04:05.000Z") }

	// 1. uma entrada: grava, devolve sem o IP, e o IP fica guardado
	r := historyCall("POST", "/api/crm/history", `{"id":"h-1","at":"`+iso(-time.Minute)+`","actor":"Carol","entity":"person","entityId":"p1","entityName":"Ana","kind":"edit","field":"Cargo","from":"Dir","to":"Diretora"}`, "10.0.0.1")
	if r.code != 201 || !strings.Contains(string(r.body), `"saved":1`) {
		t.Fatalf("primeira entrada: %d %s", r.code, r.body)
	}
	var ip sql.NullString
	db.QueryRow(`SELECT ip FROM ChangeLog WHERE id = 'h-1'`).Scan(&ip)
	if ip.String != "10.0.0.1" {
		t.Errorf("o IP deveria estar guardado: %q", ip.String)
	}

	// 2. reenviar o mesmo id não duplica (retry do front)
	r = historyCall("POST", "/api/crm/history", `{"id":"h-1","actor":"Outro","entity":"person","entityId":"p1","kind":"edit","note":"tentativa de sobrescrever"}`, "10.0.0.1")
	var n int
	db.QueryRow(`SELECT COUNT(*) FROM ChangeLog`).Scan(&n)
	var actor string
	db.QueryRow(`SELECT actor FROM ChangeLog WHERE id = 'h-1'`).Scan(&actor)
	if r.code != 200 || !strings.Contains(string(r.body), `"duplicates":1`) || n != 1 || actor != "Carol" {
		t.Errorf("reenvio: %d %s, %d linhas, autor %q (a original não pode ser sobrescrita)", r.code, r.body, n, actor)
	}

	// 3. lote com 4 entradas em registros e tipos diferentes
	batch := `[
	 {"id":"h-2","at":"` + iso(-50*time.Second) + `","actor":"Carol","entity":"person","entityId":"p1","entityName":"Ana","kind":"lifecycle","field":"Ciclo de vida","from":"Lead","to":"Cliente"},
	 {"id":"h-3","at":"` + iso(-40*time.Second) + `","actor":"Lucas","entity":"lead","entityId":"l1","entityName":"Renata","kind":"qualify","note":"Virou oportunidade"},
	 {"id":"h-4","at":"` + iso(-30*time.Second) + `","actor":"Carol","entity":"company","entityId":"c1","entityName":"Acme","kind":"create","note":"Cadastro criado"},
	 {"id":"h-5","at":"` + iso(-20*time.Second) + `","actor":"Lucas","entity":"person","entityId":"p1","entityName":"Ana","kind":"reveal","field":"CPF","note":"CPF exibido inteiro"}
	]`
	if r := historyCall("POST", "/api/crm/history", batch, "10.0.0.2"); r.code != 201 || !strings.Contains(string(r.body), `"saved":4`) {
		t.Fatalf("lote: %d %s", r.code, r.body)
	}
	// um lote com uma entrada inválida não grava NADA (valida tudo antes)
	bad := `[{"id":"h-6","entity":"lead","entityId":"l1","kind":"edit"},{"id":"h-7","entity":"banana","entityId":"l1","kind":"edit"}]`
	if r := historyCall("POST", "/api/crm/history", bad, "10.0.0.2"); r.code != 422 {
		t.Errorf("lote inválido: %d", r.code)
	}
	db.QueryRow(`SELECT COUNT(*) FROM ChangeLog WHERE id IN ('h-6','h-7')`).Scan(&n)
	if n != 0 {
		t.Errorf("lote inválido não podia gravar nada: %d", n)
	}

	// 4. leitura: mais recente primeiro, total, filtros e paginação
	var list []ChangeDTO
	lr := historyCall("GET", "/api/crm/history", "", "10.0.0.3")
	lr.into(t, &list)
	ids := func(l []ChangeDTO) string {
		var s []string
		for _, c := range l {
			s = append(s, c.ID)
		}
		return strings.Join(s, ",")
	}
	if ids(list) != "h-5,h-4,h-3,h-2,h-1" || lr.header.Get("X-Total-Count") != "5" {
		t.Errorf("ordem/total: %s (%s)", ids(list), lr.header.Get("X-Total-Count"))
	}
	if strings.Contains(string(lr.body), `"ip"`) || strings.Contains(string(lr.body), "10.0.0") {
		t.Error("o IP não pode sair em nenhuma resposta")
	}
	if list[4].Field != "Cargo" || list[4].From != "Dir" || list[4].To != "Diretora" || list[4].Actor != "Carol" || list[4].At == nil {
		t.Errorf("campos da entrada: %+v", list[4])
	}
	check := func(q, want string) {
		t.Helper()
		var l []ChangeDTO
		historyCall("GET", "/api/crm/history?"+q, "", "10.0.0.3").into(t, &l)
		if got := ids(l); got != want {
			t.Errorf("%s: %s (queria %s)", q, got, want)
		}
	}
	check("entity=person&entityId=p1", "h-5,h-2,h-1")
	check("kind=qualify", "h-3")
	check("entity=company", "h-4")
	check("q=Lucas", "h-5,h-3")
	check("q=exibido", "h-5")
	check("entityId=l1", "h-3")
	check("limit=2", "h-5,h-4")
	check("limit=2&offset=2", "h-3,h-2")
	check("since="+iso(-45*time.Second), "h-5,h-4,h-3")
	check("until="+iso(-45*time.Second), "h-2,h-1")
	check("entity=lixo", "h-5,h-4,h-3,h-2,h-1") // valor desconhecido é ignorado, não vira erro

	// 5. relógio: uma entrada de 30 dias atrás é gravada com a hora do servidor
	historyCall("POST", "/api/crm/history", `{"id":"h-velha","at":"`+iso(-30*24*time.Hour)+`","entity":"lead","entityId":"l9","kind":"event"}`, "10.0.0.4")
	var at string
	db.QueryRow(`SELECT at FROM ChangeLog WHERE id = 'h-velha'`).Scan(&at)
	if got := parseDT(at); time.Since(got) > time.Minute || got.After(time.Now().Add(time.Minute)) {
		t.Errorf("hora da entrada antiga deveria ser a do servidor: %s", at)
	}

	// 6. só-acréscimo: nada de PUT, PATCH ou DELETE, e a tabela não muda
	var before int
	db.QueryRow(`SELECT COUNT(*) FROM ChangeLog`).Scan(&before)
	for _, m := range []string{http.MethodPut, http.MethodPatch, http.MethodDelete} {
		if r := historyCall(m, "/api/crm/history?id=h-1", `{"id":"h-1"}`, "10.0.0.5"); r.code != 405 {
			t.Errorf("%s: %d", m, r.code)
		}
	}
	var after int
	db.QueryRow(`SELECT COUNT(*) FROM ChangeLog`).Scan(&after)
	if before != after || before != 6 {
		t.Errorf("a tabela não podia mudar: %d → %d", before, after)
	}
}
