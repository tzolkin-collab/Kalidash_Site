/*! Kalidash Connect — servido pela API em /connect.js
 *
 * Instalação: uma tag de script com a chave PUBLICÁVEL do projeto (escopo forms:write, emitida em Projetos > Chaves).
 *   <script src="https://API/connect.js" data-key="kld_live_..." defer></script>
 *
 * Não renderiza nem estiliza nada e não impede o envio normal do formulário: no evento "submit" ele lê os
 * campos, monta sempre o mesmo JSON e manda para a API em segundo plano. Quais formulários observar vem do
 * painel (Projetos > formulários rastreados), pela rota /api/connect/config.
 * Evento para a página: window "kalidash:lead" com detail { ok, status, form, eventId }.
 *
 * Conversão: cada envio leva um event_id. A API grava 1 lead por id e manda o Lead pela API de Conversões da Meta
 * (e o generate_lead pelo GA4, se configurado) com esse id. No mesmo submit o connect.js dispara, se a página tiver:
 *   - Pixel da Meta: fbq('track','Lead',…,{eventID}) — a Meta junta com o do servidor e conta 1 lead;
 *   - GA4 (gtag): generate_lead, só quando o servidor NÃO manda o GA4 (config.serverSide.ga4);
 *   - dataLayer: lead_form_submitted (para o GTM), e Microsoft Clarity (tags e evento).
 * A LP NÃO deve disparar o próprio Lead no envio (contaria em dobro). data-pixel="off" e data-ga="off" na tag
 * desligam o disparo no navegador. O mesmo lead reenviado (clique duplo) reaproveita o event_id e não dispara de
 * novo; envio que a API recusaria (sem contato, robô) não dispara.
 */
(function () {
  'use strict';
  var tag = document.currentScript || document.querySelector('script[data-key][src*="connect.js"]');
  if (!tag) return;
  var key = tag.getAttribute('data-key') || '';
  if (!/^kld_(live|test)_[A-Za-z0-9_-]{20,}$/.test(key)) {
    if (window.console) console.warn('[Kalidash Connect] data-key ausente ou inválido.');
    return;
  }
  var base = (tag.getAttribute('data-endpoint') || '').replace(/\/$/, '');
  if (!base) {
    try { base = new URL(tag.src, location.href).origin; } catch (e) { return; }
  }
  var headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key };
  var forms = [], serverSide = {}, env = 'live';
  var pixelOn = tag.getAttribute('data-pixel') !== 'off', gaOn = tag.getAttribute('data-ga') !== 'off';
  var FIELDS = ['nome', 'email', 'telefone', 'empresa', 'cargo', 'interesse', 'mensagem'];
  var ALIASES = {
    nome: ['nome', 'name', 'fullname', 'nomecompleto', 'yourname'],
    email: ['email', 'mail', 'youremail'],
    telefone: ['telefone', 'phone', 'tel', 'whatsapp', 'celular', 'fone'],
    empresa: ['empresa', 'company', 'organization'],
    cargo: ['cargo', 'role', 'job', 'jobtitle'],
    interesse: ['interesse', 'interest', 'assunto', 'subject'],
    mensagem: ['mensagem', 'message', 'msg', 'texto', 'desafio']
  };

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function pick(form, field, map) {
    var sel = map && map[field];
    if (sel) {
      var el = form.querySelector(sel) || document.querySelector(sel);
      return el && el.value ? String(el.value) : '';
    }
    var els = form.elements, list = ALIASES[field], i, e;
    for (i = 0; i < els.length; i++) {
      e = els[i];
      if (!e.name && !e.id) continue;
      if (e.type === 'password' || e.type === 'hidden' || e.type === 'file') continue;
      if (list.indexOf(norm(e.name)) >= 0 || list.indexOf(norm(e.id)) >= 0 ||
          (field === 'email' && e.type === 'email') || (field === 'telefone' && e.type === 'tel') ||
          (field === 'mensagem' && e.tagName === 'TEXTAREA')) {
        if (e.value) return String(e.value);
      }
    }
    return '';
  }

  /* Atribuição, mesma lógica do site (apps/site/src/lib/tracking.ts): as UTMs e ids de clique são guardados ao
   * chegar à página, não lidos só no envio. Assim quem entra com UTM e converte em outra página da LP (ou volta
   * depois por um link limpo) continua atribuído.
   *   · último toque (utm_*, ids de clique): troca inteiro quando chega uma nova campanha; expira em 90 dias.
   *   · primeiro toque (first_utm_*, landing_page, first_seen_at): gravado uma vez e nunca sobrescrito.
   * Guardado no localStorage do domínio da LP (kld_attr); referência externa no sessionStorage (kld_referrer). */
  var LAST_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'gbraid', 'wbraid'];
  var STORE_KEY = 'kld_attr', REFERRER_KEY = 'kld_referrer', TTL = 90 * 24 * 60 * 60 * 1000;

  function readStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function writeStore(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* modo privado */ } }

  function touchFromUrl() {
    var q = new URLSearchParams(location.search), t = {}, i, v;
    for (i = 0; i < LAST_KEYS.length; i++) {
      v = (q.get(LAST_KEYS[i]) || '').trim();
      // Convenção: UTMs em minúsculas e sem espaços (ids de clique ficam como vieram: diferenciam maiúsculas).
      if (v && LAST_KEYS[i].indexOf('utm_') === 0) v = v.toLowerCase().replace(/\s+/g, '_');
      if (v) t[LAST_KEYS[i]] = v.slice(0, 300);
    }
    return t;
  }
  function hasTouch(t) { for (var i = 0; i < LAST_KEYS.length; i++) if (t[LAST_KEYS[i]]) return true; return false; }

  function captureAttribution() {
    var now = Date.now(), store = readStore(), touch = touchFromUrl();
    if (hasTouch(touch)) {
      touch.at = now;
      if (touch.fbclid) touch.fbclid_at = store.last && store.last.fbclid === touch.fbclid && store.last.fbclid_at ? store.last.fbclid_at : now;
      store.last = touch;
    }
    if (!store.first) {
      var first = {}, k;
      for (k in touch) if (Object.prototype.hasOwnProperty.call(touch, k)) first[k] = touch[k];
      first.at = now;
      first.landing_page = location.pathname + location.search;
      store.first = first;
    }
    writeStore(store);
    try {
      if (!sessionStorage.getItem(REFERRER_KEY) && document.referrer) {
        var ref = new URL(document.referrer);
        if (ref.host !== location.host) sessionStorage.setItem(REFERRER_KEY, document.referrer.slice(0, 500));
      }
    } catch (e) { /* sem sessionStorage */ }
  }

  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;)\\s*' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* _ga = "GA1.1.<rand>.<ts>" → client_id "<rand>.<ts>". */
  function gaClientId() {
    var p = cookie('_ga').split('.');
    return p.length >= 4 ? p[p.length - 2] + '.' + p[p.length - 1] : '';
  }

  /* A URL atual vence o último toque guardado (o anúncio mais recente). */
  function attribution() {
    var now = Date.now(), store = readStore(), current = touchFromUrl(), last = {}, i, k;
    if (hasTouch(current)) {
      last = current;
      if (current.fbclid) last.fbclid_at = store.last && store.last.fbclid === current.fbclid && store.last.fbclid_at ? store.last.fbclid_at : now;
    } else if (store.last && store.last.at && now - store.last.at < TTL) {
      last = store.last;
    }
    var a = { page_url: location.href.split('#')[0], device: window.innerWidth < 768 ? 'mobile' : 'desktop' };
    for (i = 0; i < LAST_KEYS.length; i++) { k = LAST_KEYS[i]; if (last[k]) a[k] = last[k]; }
    if (last.fbclid && last.fbclid_at) a.fbclid_at = String(last.fbclid_at);

    var first = store.first;
    if (first) {
      if (first.utm_source) a.first_utm_source = first.utm_source;
      if (first.utm_medium) a.first_utm_medium = first.utm_medium;
      if (first.utm_campaign) a.first_utm_campaign = first.utm_campaign;
      if (first.landing_page) a.landing_page = first.landing_page;
      if (first.at) a.first_seen_at = new Date(first.at).toISOString();
    }

    var referrer = '';
    try { referrer = sessionStorage.getItem(REFERRER_KEY) || ''; } catch (e) { /* sem sessionStorage */ }
    if (!referrer && document.referrer && document.referrer.indexOf(location.origin) !== 0) referrer = document.referrer;
    if (referrer) a.referrer = referrer;

    try {
      var fbp = cookie('_fbp');
      if (fbp) a._fbp = fbp;
      // _fbc: o cookie do Pixel; sem ele (Pixel bloqueado no clique), monta a partir do fbclid guardado.
      var fbc = cookie('_fbc') || (last.fbclid ? 'fb.1.' + (last.fbclid_at || now) + '.' + last.fbclid : '');
      if (fbc) a._fbc = fbc;
      var cid = gaClientId();
      if (cid) a.ga_client_id = cid;
    } catch (e) { /* cookies bloqueados */ }
    return a;
  }

  /* Microsoft Clarity, se a página já o carrega: marca a gravação com a campanha e, no envio, com o lead.
   * O connect.js não instala o Clarity; só usa o que a LP já tem. */
  function clarity() {
    try { if (typeof window.clarity === 'function') window.clarity.apply(null, arguments); } catch (e) { /* bloqueado */ }
  }
  function tagClarity(a) {
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'first_utm_source', 'first_utm_campaign'], i;
    for (i = 0; i < keys.length; i++) if (a[keys[i]]) clarity('set', keys[i], String(a[keys[i]]));
  }

  captureAttribution();
  tagClarity(attribution());

  function newEventId() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* http sem localhost */ }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + '-' + Math.random().toString(36).slice(2, 12);
  }

  /* Conversão no navegador, no próprio submit (a página pode sair antes da resposta). Teste (kld_test_) não dispara. */
  function trackBrowser(eventId, cfg, attr) {
    if (env === 'test') return;
    var name = String(cfg.name || cfg.selector).slice(0, 100);
    if (pixelOn) {
      try { if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_name: name }, { eventID: eventId }); } catch (e) { /* bloqueado */ }
    }
    if (gaOn && !serverSide.ga4) {
      try { if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { form_name: name, event_id: eventId }); } catch (e) { /* bloqueado */ }
    }
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'lead_form_submitted', form_name: name, event_id: eventId, lead_source: 'connect', utm_source: attr.utm_source, utm_medium: attr.utm_medium, utm_campaign: attr.utm_campaign });
    } catch (e) { /* sem dataLayer */ }
    clarity('set', 'event_id', eventId);
  }

  /* Mesmas regras de handleConnectLead (connect_ingest.go): nome; e-mail válido ou telefone com 8 a 15 dígitos;
   * e-mail, se houver, válido. Um envio que a API recusaria não vira conversão no navegador. */
  function acceptable(lead) {
    var email = String(lead.email || '').trim(), phone = String(lead.telefone || '').replace(/\D/g, '');
    if (!String(lead.nome || '').trim()) return false;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    if (phone && (phone.length < 8 || phone.length > 15)) return false;
    return !!(email || phone);
  }

  /* Um event_id por lead: o mesmo formulário reenviado com os mesmos dados em até 10 minutos (clique duplo, nova
   * tentativa) reaproveita o id, e a API responde "duplicate" sem gravar o 2º lead nem mandar a 2ª conversão.
   * Dados diferentes (outra pessoa no mesmo formulário) ganham um id novo. */
  var SUBMISSION_TTL = 10 * 60 * 1000;
  function submission(form, lead) {
    var sig = JSON.stringify(lead), now = Date.now(), prev = form.__kldSubmission;
    if (prev && prev.sig === sig && now - prev.at < SUBMISSION_TTL) return prev;
    form.__kldSubmission = { id: newEventId(), sig: sig, at: now, tracked: false };
    return form.__kldSubmission;
  }

  function notify(detail) {
    try { window.dispatchEvent(new CustomEvent('kalidash:lead', { detail: detail })); } catch (e) { /* IE antigo: sem evento */ }
  }

  function send(form, cfg) {
    var consent = cfg.consentSelector && document.querySelector(cfg.consentSelector);
    if (consent && consent.type === 'checkbox' && !consent.checked) return;
    var lead = {}, i;
    for (i = 0; i < FIELDS.length; i++) lead[FIELDS[i]] = pick(form, FIELDS[i], cfg.fields) || null;
    var hp = form.querySelector('[name="website"], [name="_hp"]'); // armadilha para robôs, se a página tiver
    var attr = attribution(), sub = submission(form, lead), eventId = sub.id;
    var body = {
      event_id: eventId,
      form: cfg.selector,
      lead: lead,
      website: hp && hp.value ? hp.value : '',
      attribution: attr,
      context: { submittedAt: new Date().toISOString(), consent: consent ? true : null }
    };
    tagClarity(attr);
    clarity('set', 'lead_form', String(cfg.selector).slice(0, 100));
    clarity('event', 'lead_submitted');
    clarity('upgrade', 'lead_submitted');
    // Conversão no navegador só para o 1º envio de um lead que a API vai aceitar (mesmas regras do servidor):
    // honeypot vazio, nome e um contato válido. Reenvio do mesmo lead (clique duplo) não dispara de novo.
    if (!sub.tracked && !(hp && hp.value) && acceptable(lead)) {
      sub.tracked = true;
      trackBrowser(eventId, cfg, attr);
    }
    fetch(base + '/api/connect/leads', { method: 'POST', headers: headers, body: JSON.stringify(body), keepalive: true })
      .then(function (r) { notify({ ok: r.ok, status: r.status, form: cfg.selector, eventId: eventId }); })
      .catch(function () { notify({ ok: false, status: 0, form: cfg.selector, eventId: eventId }); });
  }

  // Ouve no documento (fase de captura): vale também para formulários criados depois, como modais.
  document.addEventListener('submit', function (ev) {
    var form = ev.target, i;
    if (!form || !form.matches) return;
    for (i = 0; i < forms.length; i++) {
      try { if (form.matches(forms[i].selector)) { send(form, forms[i]); return; } } catch (e) { /* seletor inválido: ignora */ }
    }
  }, true);

  fetch(base + '/api/connect/config', { headers: { Authorization: 'Bearer ' + key } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (cfg) {
      forms = (cfg && cfg.forms) || [];
      serverSide = (cfg && cfg.serverSide) || {};
      env = (cfg && cfg.env) || 'live';
      notify({ ready: true, forms: forms.length });
    })
    .catch(function (s) { if (window.console) console.warn('[Kalidash Connect] não consegui carregar a configuração (' + s + ').'); });
})();
