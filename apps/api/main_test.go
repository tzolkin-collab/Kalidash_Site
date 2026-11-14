package main

import (
	"os"
	"testing"
)

// TestMain mantém nos testes o ambiente de antes de o login virar padrão (14/11/2026): sem AUTH_API
// definido, os testes rodam com o login desligado. Os testes de login passam AUTH_API=1 explicitamente,
// e TestLoginLigadoPorPadrao cobre o padrão de produção (sem a variável, o login fica ligado).
func TestMain(m *testing.M) {
	if _, set := os.LookupEnv("AUTH_API"); !set {
		os.Setenv("AUTH_API", "0")
	}
	os.Exit(m.Run())
}
