package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"
)

// Leitura por anúncio da Meta para o admin > Tráfego > Pago. SOMENTE LEITURA (só GET): uma linha por anúncio e por
// dia com entrega, mais a estrutura e o criativo de cada anúncio. Nada é gravado no banco; cache em memória. Usa as
// mesmas variáveis do investimento (META_ADS_ACCESS_TOKEN, META_AD_ACCOUNT_ID), com ads_read.

type adRow struct {
	Date           string `json:"date"`
	AccountID      string `json:"accountId"`
	AccountName    string `json:"accountName"`
	CampaignID     string `json:"campaignId"`
	CampaignName   string `json:"campaignName"`
	CampaignStatus string `json:"campaignStatus"`
	CampaignBudget int64  `json:"campaignBudget,omitempty"` // centavos por dia
	AdsetID        string `json:"adsetId"`
	AdsetName      string `json:"adsetName"`
	AdsetStatus    string `json:"adsetStatus"`
	AdsetBudget    int64  `json:"adsetBudget,omitempty"`
	AdID           string `json:"adId"`
	AdName         string `json:"adName"`
	AdStatus       string `json:"adStatus"`
	CreativeID     string `json:"creativeId"`
	AssetKey       string `json:"assetKey,omitempty"`
	ThumbnailURL   string `json:"thumbnailUrl,omitempty"`
	Format         string `json:"format"`
	Spend          int64  `json:"spend"` // centavos
	Impressions    int64  `json:"impressions"`
	Clicks         int64  `json:"clicks"` // cliques no link
	PageViews      int64  `json:"pageViews"`
	Views3s        int64  `json:"views3s"`
}

type adsReport struct {
	From       string    `json:"from"`
	To         string    `json:"to"`
	Configured bool      `json:"configured"`
	Currency   string    `json:"currency,omitempty"`
	Rows       []adRow   `json:"rows"`
	Error      string    `json:"error,omitempty"`
	FetchedAt  time.Time `json:"fetchedAt"`
}

// metaAdsMaxDays: uma linha por anúncio e por dia cresce rápido; períodos maiores não cabem numa resposta.
const metaAdsMaxDays = 92

var (
	adsMu    sync.Mutex
	adsCache = map[string]adsReport{}
)

// metaPages percorre uma lista paginada da Meta com o token só no cabeçalho.
func metaPages(ctx context.Context, c spendConfig, first string, each func(json.RawMessage) error) error {
	next := first
	for page := 0; next != ""; page++ {
		if page >= metaMaxPages {
			return errors.New("Meta: lista incompleta, escolha um período menor")
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, next, nil)
		if err != nil {
			return errors.New("Meta: endereço inválido")
		}
		req.Header.Set("Authorization", "Bearer "+c.MetaToken)
		var body struct {
			Data   []json.RawMessage `json:"data"`
			Paging struct {
				Next string `json:"next"`
			} `json:"paging"`
			Error *struct {
				Message string `json:"message"`
				Code    int    `json:"code"`
			} `json:"error"`
		}
		err = doJSON(req, &body)
		if body.Error != nil {
			return fmt.Errorf("Meta (%d): %s", body.Error.Code, body.Error.Message)
		}
		if err != nil {
			return fmt.Errorf("Meta: %w", err)
		}
		for _, item := range body.Data {
			if err := each(item); err != nil {
				return err
			}
		}
		next = withoutQueryParam(body.Paging.Next, "access_token")
	}
	return nil
}

type metaAction struct {
	Type  string `json:"action_type"`
	Value string `json:"value"`
}

func actionValue(list []metaAction, kind string) int64 {
	for _, a := range list {
		if a.Type == kind {
			return atoi64(a.Value)
		}
	}
	return 0
}

type metaParent struct {
	Status string `json:"effective_status"`
	Budget string `json:"daily_budget"`
}

type metaAd struct {
	ID       string     `json:"id"`
	Status   string     `json:"effective_status"`
	Campaign metaParent `json:"campaign"`
	Adset    metaParent `json:"adset"`
	Creative struct {
		ID         string `json:"id"`
		ImageHash  string `json:"image_hash"`
		VideoID    string `json:"video_id"`
		IGMediaID  string `json:"effective_instagram_media_id"`
		StoryID    string `json:"effective_object_story_id"`
		Thumbnail  string `json:"thumbnail_url"`
		ObjectType string `json:"object_type"`
	} `json:"creative"`
}

// assetKey: o que identifica a peça independentemente do anúncio (arquivo antes de publicação).
func (a metaAd) assetKey() string {
	cr := a.Creative
	switch {
	case cr.VideoID != "":
		return "video:" + cr.VideoID
	case cr.ImageHash != "":
		return "image:" + cr.ImageHash
	case cr.IGMediaID != "":
		return "ig:" + cr.IGMediaID
	case cr.StoryID != "":
		return "post:" + cr.StoryID
	}
	return ""
}

func activeOrPaused(status string) string {
	if status == "ACTIVE" {
		return "ACTIVE"
	}
	return "PAUSED"
}

func metaAdRows(ctx context.Context, c spendConfig, from, to string) ([]adRow, string, error) {
	base := fmt.Sprintf("%s/%s/act_%s", metaGraphBase, c.MetaVersion, url.PathEscape(c.MetaAccount))
	tr, _ := json.Marshal(map[string]string{"since": from, "until": to})
	q := url.Values{
		"level":          {"ad"},
		"time_increment": {"1"},
		"time_range":     {string(tr)},
		"fields":         {"account_id,account_name,account_currency,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,inline_link_clicks,actions"},
		"limit":          {"500"},
	}
	rows := []adRow{}
	currency := ""
	err := metaPages(ctx, c, base+"/insights?"+q.Encode(), func(raw json.RawMessage) error {
		var d struct {
			Date         string       `json:"date_start"`
			AccountID    string       `json:"account_id"`
			AccountName  string       `json:"account_name"`
			Currency     string       `json:"account_currency"`
			CampaignID   string       `json:"campaign_id"`
			CampaignName string       `json:"campaign_name"`
			AdsetID      string       `json:"adset_id"`
			AdsetName    string       `json:"adset_name"`
			AdID         string       `json:"ad_id"`
			AdName       string       `json:"ad_name"`
			Spend        string       `json:"spend"`
			Impressions  string       `json:"impressions"`
			LinkClicks   string       `json:"inline_link_clicks"`
			Actions      []metaAction `json:"actions"`
		}
		if err := json.Unmarshal(raw, &d); err != nil {
			return errors.New("Meta: resposta inesperada")
		}
		if currency == "" {
			currency = d.Currency
		}
		rows = append(rows, adRow{
			Date: d.Date, AccountID: d.AccountID, AccountName: d.AccountName, CampaignID: d.CampaignID, CampaignName: d.CampaignName,
			AdsetID: d.AdsetID, AdsetName: d.AdsetName, AdID: d.AdID, AdName: d.AdName,
			CampaignStatus: "PAUSED", AdsetStatus: "PAUSED", AdStatus: "PAUSED", Format: "image",
			Spend: toCentsStr(d.Spend), Impressions: atoi64(d.Impressions), Clicks: atoi64(d.LinkClicks),
			PageViews: actionValue(d.Actions, "landing_page_view"), Views3s: actionValue(d.Actions, "video_view"),
		})
		return nil
	})
	if err != nil || len(rows) == 0 {
		return rows, currency, err
	}
	ads := map[string]metaAd{}
	aq := url.Values{
		"fields": {"id,effective_status,campaign{effective_status,daily_budget},adset{effective_status,daily_budget},creative{id,image_hash,video_id,effective_instagram_media_id,effective_object_story_id,thumbnail_url,object_type}"},
		"limit":  {"100"},
	}
	err = metaPages(ctx, c, base+"/ads?"+aq.Encode(), func(raw json.RawMessage) error {
		var a metaAd
		if err := json.Unmarshal(raw, &a); err != nil {
			return errors.New("Meta: resposta inesperada")
		}
		ads[a.ID] = a
		return nil
	})
	if err != nil {
		return nil, "", err
	}
	for i := range rows {
		a, ok := ads[rows[i].AdID]
		if !ok { // anúncio apagado: os números continuam, sem estrutura
			continue
		}
		r := &rows[i]
		r.AdStatus, r.CampaignStatus, r.AdsetStatus = activeOrPaused(a.Status), activeOrPaused(a.Campaign.Status), activeOrPaused(a.Adset.Status)
		// orçamento vem na menor unidade da moeda (centavos)
		r.CampaignBudget, _ = strconv.ParseInt(a.Campaign.Budget, 10, 64)
		r.AdsetBudget, _ = strconv.ParseInt(a.Adset.Budget, 10, 64)
		r.CreativeID, r.AssetKey, r.ThumbnailURL = a.Creative.ID, a.assetKey(), a.Creative.Thumbnail
		if a.Creative.VideoID != "" || a.Creative.ObjectType == "VIDEO" {
			r.Format = "video"
		}
	}
	return rows, currency, nil
}

// fetchMetaAds é trocável nos testes.
var fetchMetaAds = metaAdRows

func handleAnalyticsAds(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	from, err1 := time.Parse(dateLayout, r.URL.Query().Get("from"))
	to, err2 := time.Parse(dateLayout, r.URL.Query().Get("to"))
	if err1 != nil || err2 != nil || to.Before(from) || to.Sub(from) > (metaAdsMaxDays-1)*24*time.Hour {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("from e to no formato AAAA-MM-DD, com no máximo %d dias", metaAdsMaxDays)})
		return
	}
	f, t := from.Format(dateLayout), to.Format(dateLayout)
	cfg := loadSpendConfig()
	rep := adsReport{From: f, To: t, Configured: cfg.metaOn(), Rows: []adRow{}, FetchedAt: time.Now()}
	if !cfg.metaOn() {
		writeJSON(w, http.StatusOK, rep)
		return
	}
	key := cfg.MetaAccount + "|" + f + "|" + t
	adsMu.Lock()
	cached, ok := adsCache[key]
	adsMu.Unlock()
	ttl := spendTTL
	if cached.Error != "" {
		ttl = time.Minute // erro fica pouco tempo, para não martelar a Meta
	}
	if ok && time.Since(cached.FetchedAt) < ttl {
		writeJSON(w, http.StatusOK, cached)
		return
	}
	// contexto próprio: o resultado vai para o cache mesmo que a aba seja fechada
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	rows, currency, err := fetchMetaAds(ctx, cfg, f, t)
	if err != nil {
		log.Printf("❌ analytics (anúncios Meta): %v", err)
		rep.Error = err.Error()
	} else {
		rep.Rows, rep.Currency = rows, currency
	}
	adsMu.Lock()
	if len(adsCache) > 50 {
		adsCache = map[string]adsReport{}
	}
	adsCache[key] = rep
	adsMu.Unlock()
	writeJSON(w, http.StatusOK, rep)
}
