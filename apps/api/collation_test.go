package main

import (
	"reflect"
	"testing"
)

func TestTablesToAlign(t *testing.T) {
	ref := "utf8mb4_unicode_ci"
	current := map[string]string{
		"Opportunity": ref,                  // do Prisma: fora da lista, nunca é tocada
		"TeamMember":  "utf8mb4_0900_ai_ci", // criada pela API com o padrão do MySQL 8
		"AuthSession": "utf8mb4_0900_ai_ci",
		"Pipeline":    ref, // já alinhada
		"Lead":        "utf8mb4_0900_ai_ci",
		"Article":     "", // view ou sem collation: ignora
	}
	got := tablesToAlign(ref, current)
	want := []string{"Lead", "TeamMember", "AuthSession"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("tablesToAlign = %v, quero %v", got, want)
	}
	if got := tablesToAlign(ref, map[string]string{"TeamMember": ref}); len(got) != 0 {
		t.Fatalf("tudo alinhado deveria dar vazio, deu %v", got)
	}
}
