package main

import (
	"encoding/json"
	"testing"
)

// seedBasePipeline cria os funis "q4" e "b2b" que os testes de CRM, de escopo "own" e de oportunidades usam como
// pano de fundo. Desde o WP4-1 o servidor recusa lead/oportunidade em etapa que não existe, então os funis precisam
// existir. Sem requisitos: o gate só entra nos testes que o exercitam.
func seedBasePipeline(t *testing.T) {
	t.Helper()
	for _, p := range []*PipelineDTO{
		{ID: "q4", Name: "Q4 Base", Stages: []PStage{
			{ID: "q4:novos", Name: "Novos", Kind: "LEAD"},
			{ID: "q4:contato", Name: "Em contato", Kind: "LEAD"},
			{ID: "q4:neg", Name: "Negociação", Kind: "OPEN"},
			{ID: "q4:ass", Name: "Assinatura", Kind: "OPEN"},
			{ID: "q4:ganho", Name: "Ganho", Kind: "WON"},
			{ID: "q4:perdido", Name: "Perdido", Kind: "LOST"},
		}},
		{ID: "b2b", Name: "B2B Base", Position: 1, Stages: []PStage{
			{ID: "b2b:novos", Name: "Novos", Kind: "LEAD"},
			{ID: "b2b:ganho", Name: "Ganho", Kind: "WON"},
			{ID: "b2b:perdido", Name: "Perdido", Kind: "LOST"},
		}},
	} {
		if err := validatePipeline(p); err != nil {
			t.Fatal(err)
		}
		if err := writePipeline(p, false, nil); err != nil {
			t.Fatal(err)
		}
	}
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}
