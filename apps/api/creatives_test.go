package main

import (
	"regexp"
	"strings"
	"testing"
)

func TestCreativeInput(t *testing.T) {
	ok := creativeInput{Title: " Reels de IA ", Format: "Reels", Campaign: "Guia de IA", Destination: "diagnostico", PostURLs: []string{"https://instagram.com/p/x", "https://instagram.com/p/x", " "}}
	c, err := ok.toCreative()
	if err != nil {
		t.Fatal(err)
	}
	if c.Title != "Reels de IA" || c.Format != "reels" || c.Campaign != normalizeUTM("Guia de IA") || c.Destination != "/diagnostico" || len(c.PostURLs) != 1 {
		t.Errorf("normalização: %+v", c)
	}
	bad := map[string]func(*creativeInput){
		"sem nome":             func(i *creativeInput) { i.Title = "  " },
		"sem tema":             func(i *creativeInput) { i.Campaign = "" },
		"formato":              func(i *creativeInput) { i.Format = "outdoor" },
		"destino externo":      func(i *creativeInput) { i.Destination = "https://exemplo.com/x" },
		"imagem javascript":    func(i *creativeInput) { i.MediaURL = "javascript:alert(1)" },
		"publicação sem https": func(i *creativeInput) { i.PostURLs = []string{"instagram.com/p/x"} },
		"legenda longa demais": func(i *creativeInput) { i.Caption = strings.Repeat("a", 3001) },
	}
	for name, mut := range bad {
		in := ok
		mut(&in)
		if _, err := in.toCreative(); err == nil {
			t.Errorf("%s: deveria recusar", name)
		}
	}
}

func TestCreativeID(t *testing.T) {
	re := regexp.MustCompile(`^cr[a-z0-9]{6}$`)
	if id := newCreativeID(); !re.MatchString(id) || id == newCreativeID() {
		t.Errorf("id inesperado: %s", id)
	}
}
