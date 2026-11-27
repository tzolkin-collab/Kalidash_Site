package main

import (
	"net/http"
	"os"
	"sort"
	"strings"
)

// GET /api/newsletter/emails: os três e-mails da newsletter para a tela Newsletter > E-mails do admin, já montados
// para pré-visualizar, com o que falta para cada um funcionar. Só leitura; nada é enviado daqui.

type newsletterEmailDTO struct {
	ID      string   `json:"id"`
	Title   string   `json:"title"`
	When    string   `json:"when"`
	Auto    bool     `json:"auto"`
	Active  bool     `json:"active"`
	Missing []string `json:"missing"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

type newsletterMaterialDTO struct {
	Slug    string `json:"slug"`
	Title   string `json:"title"`
	HasLink bool   `json:"hasLink"`
}

type newsletterEmailsDTO struct {
	From      string                  `json:"from"`
	Emails    []newsletterEmailDTO    `json:"emails"`
	Materials []newsletterMaterialDTO `json:"materials"`
}

const previewName = "Ana Ribeiro"

func newsletterEmailsPayload() (newsletterEmailsDTO, error) {
	links := materialURLs()
	from := strings.TrimSpace(os.Getenv("NEWSLETTER_FROM"))
	hasKey := strings.TrimSpace(os.Getenv("RESEND_API_KEY")) != ""
	hasSegment := strings.TrimSpace(os.Getenv("RESEND_NEWSLETTER_SEGMENT_ID")) != ""

	autoMissing := []string{}
	if !hasKey {
		autoMissing = append(autoMissing, "Chave do Resend (RESEND_API_KEY)")
	}
	if from == "" {
		autoMissing = append(autoMissing, "Remetente: quem assina e de qual e-mail sai (NEWSLETTER_FROM)")
	}

	out := newsletterEmailsDTO{From: from}

	// 1. Edição mensal: modelo para preencher e colar no Resend.
	edicao, err := newsletterEmailFS.ReadFile("emails/edicao.html")
	if err != nil {
		return out, err
	}
	edMissing := []string{}
	if !hasKey || !hasSegment {
		edMissing = append(edMissing, "Resend com o segmento \"Newsletter do blog\" (RESEND_NEWSLETTER_SEGMENT_ID)")
	}
	out.Emails = append(out.Emails, newsletterEmailDTO{
		ID: "edicao", Title: "Newsletter mensal", When: "Uma vez por mês, enviada pela equipe no Resend",
		Auto: false, Active: len(edMissing) == 0, Missing: edMissing,
		Subject: "Kalidash · Nº [N] — [tema do mês]", HTML: string(edicao),
	})

	// 2. Boas-vindas.
	welcome, _ := buildNewsletterMail(leadInput{Name: previewName, Source: newsletterSource + "-topo"}, nil)
	html, _, err := renderNewsletterMail(welcome)
	if err != nil {
		return out, err
	}
	out.Emails = append(out.Emails, newsletterEmailDTO{
		ID: "boas-vindas", Title: "Boas-vindas", When: "Sozinho, quando alguém se inscreve no blog pela primeira vez",
		Auto: true, Active: len(autoMissing) == 0, Missing: autoMissing, Subject: welcome.Subject, HTML: html,
	})

	// 3. Material gratuito: a prévia usa um material com link (ou o primeiro, com link de exemplo).
	slugs := make([]string, 0, len(newsletterMaterials))
	for slug := range newsletterMaterials {
		slugs = append(slugs, slug)
	}
	sort.Strings(slugs)
	sample, withLinks := slugs[0], 0
	for _, slug := range slugs {
		has := links[slug] != ""
		if has {
			withLinks++
			if links[sample] == "" {
				sample = slug
			}
		}
		out.Materials = append(out.Materials, newsletterMaterialDTO{Slug: slug, Title: newsletterMaterials[slug].Title, HasLink: has})
	}
	previewLinks := map[string]string{sample: links[sample]}
	if previewLinks[sample] == "" {
		previewLinks[sample] = newsletterSiteURL() + "/blog/" + sample
	}
	mat, _ := buildNewsletterMail(leadInput{Name: previewName, Source: newsletterSource + "-material-" + sample}, previewLinks)
	if html, _, err = renderNewsletterMail(mat); err != nil {
		return out, err
	}
	matMissing := append([]string{}, autoMissing...)
	if withLinks == 0 {
		matMissing = append(matMissing, "Link de pelo menos um material (NEWSLETTER_MATERIAL_URLS)")
	}
	out.Emails = append(out.Emails, newsletterEmailDTO{
		ID: "material", Title: "Material gratuito", When: "Sozinho, quando alguém pede um material num artigo",
		Auto: true, Active: len(matMissing) == 0, Missing: matMissing, Subject: mat.Subject, HTML: html,
	})
	return out, nil
}

func handleNewsletterEmails(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "use GET"})
		return
	}
	payload, err := newsletterEmailsPayload()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "não consegui montar os e-mails"})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}
