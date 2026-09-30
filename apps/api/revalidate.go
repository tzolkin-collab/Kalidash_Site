package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// notifySite avisa o site (Next) que estas páginas mudaram, pra ele regenerar na hora em vez de
// esperar o revalidate de 60s. Dispara em segundo plano e nunca falha a requisição do admin:
// se SITE_URL/REVALIDATE_SECRET não estiverem configurados, não faz nada e o site continua com
// o revalidate normal.
func notifySite(paths []string) {
	siteURL := strings.TrimRight(os.Getenv("SITE_URL"), "/")
	secret := os.Getenv("REVALIDATE_SECRET")
	if siteURL == "" || secret == "" || len(paths) == 0 {
		return
	}
	go func() {
		body, _ := json.Marshal(map[string][]string{"paths": paths})
		req, err := http.NewRequest(http.MethodPost, siteURL+"/api/revalidate", bytes.NewReader(body))
		if err != nil {
			log.Println("⚠️ revalidate do site:", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Revalidate-Secret", secret)
		resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
		if err != nil {
			log.Println("⚠️ revalidate do site:", err)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			log.Printf("⚠️ revalidate do site: HTTP %d", resp.StatusCode)
		}
	}()
}

// articlePaths devolve as páginas do site afetadas por mudanças nestes slugs: sempre /blog
// (a galeria lista os artigos) e /blog/<slug> de cada um. A blog-global só existe na galeria.
func articlePaths(slugs ...string) []string {
	paths := []string{"/blog"}
	seen := map[string]bool{}
	for _, s := range slugs {
		if s == "" || s == "blog-global" || seen[s] {
			continue
		}
		seen[s] = true
		paths = append(paths, "/blog/"+s)
	}
	return paths
}
