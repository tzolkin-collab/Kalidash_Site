package main

import (
	"testing"
)

// D6 em MySQL de verdade (só com TEST_DSN): a captura pública cria Lead v2 com CRM_API=1.
//   TEST_DSN='root:@tcp(127.0.0.1:3337)/kalidash_test' go test -run IntegrationCapturaV2 -v .

func TestIntegrationCapturaV2(t *testing.T) {
	crmDB(t)
	t.Setenv("CRM_API", "1")
	t.Setenv("PUBLIC_LEAD_PIPELINE_ID", "")
	t.Setenv("PUBLIC_LEAD_STAGE_ID", "")
	t.Setenv("PUBLIC_LEAD_SOURCE", "")
	oldC := connectDB
	connectDB = sqlConnectStore{}
	t.Cleanup(func() { connectDB = oldC })

	db.Exec(`DELETE FROM PipelineStage`) // o funil de pano de fundo (q4) sai: aqui o cenário é "nenhum funil"
	db.Exec(`DELETE FROM Pipeline`)
	// sem funil com etapa Lead: erro claro, nada gravado
	if err := leadSaver(leadInput{Name: "Ana Souza", Email: "ana@x.com", Phone: "11999999999", Source: "home"}, "1.1.1.1"); err == nil {
		t.Fatal("sem funil de leads deveria falhar")
	}
	var n int
	db.QueryRow(`SELECT COUNT(*) FROM ` + leadTbl).Scan(&n)
	if n != 0 {
		t.Fatalf("nada deveria ter sido gravado: %d", n)
	}

	db.Exec(`DELETE FROM PipelineStage`)
	db.Exec(`DELETE FROM Pipeline`)
	db.Exec(`INSERT INTO Pipeline (id, name, offer, position, createdAt, updatedAt) VALUES ('pl-1', 'Vendas', '', 0, NOW(), NOW())`)
	db.Exec(`INSERT INTO PipelineStage (id, pipelineId, name, kind, position) VALUES ('pl-1:prop', 'pl-1', 'Proposta', 'OPEN', 1), ('pl-1:novos', 'pl-1', 'Novos', 'LEAD', 0)`)

	in := leadInput{Name: "Ana Souza", Email: "ana@x.com", Phone: "11999999999", Challenge: "vender mais", Source: "home"}
	for i := 0; i < 2; i++ { // 2 envios do mesmo e-mail: 1 pessoa, 2 leads
		if err := leadSaver(in, "1.1.1.1"); err != nil {
			t.Fatal(err)
		}
	}
	var stage, origin, source, msg string
	if err := db.QueryRow(`SELECT stageId, origin, sourceName, message FROM `+leadTbl+` LIMIT 1`).Scan(&stage, &origin, &source, &msg); err != nil {
		t.Fatal(err)
	}
	if stage != "pl-1:novos" || origin != "INBOUND" || source != "Site — home" || msg == "" {
		t.Errorf("lead: stage=%q origin=%q source=%q msg=%q", stage, origin, source, msg)
	}
	db.QueryRow(`SELECT COUNT(*) FROM ` + leadTbl).Scan(&n)
	if n != 2 {
		t.Errorf("leads: %d", n)
	}
	db.QueryRow(`SELECT COUNT(*) FROM Contact WHERE LOWER(email) = 'ana@x.com'`).Scan(&n)
	if n != 1 {
		t.Errorf("pessoas: %d", n)
	}
	db.QueryRow(`SELECT COUNT(*) FROM ChangeLog WHERE entity = 'lead' AND kind = 'create'`).Scan(&n)
	if n != 2 {
		t.Errorf("histórico: %d", n)
	}
	db.QueryRow(`SELECT COUNT(*) FROM Opportunity`).Scan(&n)
	if n != 0 {
		t.Errorf("não deve criar Oportunidade: %d", n)
	}

	// fixado por variável
	t.Setenv("PUBLIC_LEAD_PIPELINE_ID", "pl-1")
	t.Setenv("PUBLIC_LEAD_STAGE_ID", "pl-1:prop")
	t.Setenv("PUBLIC_LEAD_SOURCE", "Home Kalidash")
	if err := leadSaver(in, "1.1.1.1"); err != nil {
		t.Fatal(err)
	}
	db.QueryRow(`SELECT COUNT(*) FROM `+leadTbl+` WHERE stageId = 'pl-1:prop' AND sourceName = 'Home Kalidash'`).Scan(&n)
	if n != 1 {
		t.Errorf("destino fixado por variável: %d", n)
	}
}
