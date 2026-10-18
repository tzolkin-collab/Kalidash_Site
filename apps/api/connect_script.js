/*! Kalidash Connect — servido pela API em /connect.js
 *
 * Instalação: uma tag de script com a chave PUBLICÁVEL do projeto (escopo forms:write, emitida em Projetos > Chaves).
 *   <script src="https://API/connect.js" data-key="kld_live_..." defer></script>
 *
 * Não renderiza nem estiliza nada e não impede o envio normal do formulário: no evento "submit" ele lê os
 * campos, monta sempre o mesmo JSON e manda para a API em segundo plano. Quais formulários observar vem do
 * painel (Projetos > formulários rastreados), pela rota /api/connect/config.
 * Evento para a página: window "kalidash:lead" com detail { ok, status, form }.
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
  var forms = [];
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

  function attribution() {
    var q = new URLSearchParams(location.search), a = { page_url: location.href.split('#')[0] };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) { if (q.get(k)) a[k] = q.get(k); });
    if (document.referrer) a.referrer = document.referrer;
    a.device = window.innerWidth < 768 ? 'mobile' : 'desktop';
    return a;
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
    var body = {
      form: cfg.selector,
      lead: lead,
      website: hp && hp.value ? hp.value : '',
      attribution: attribution(),
      context: { submittedAt: new Date().toISOString(), consent: consent ? true : null }
    };
    fetch(base + '/api/connect/leads', { method: 'POST', headers: headers, body: JSON.stringify(body), keepalive: true })
      .then(function (r) { notify({ ok: r.ok, status: r.status, form: cfg.selector }); })
      .catch(function () { notify({ ok: false, status: 0, form: cfg.selector }); });
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
    .then(function (cfg) { forms = (cfg && cfg.forms) || []; notify({ ready: true, forms: forms.length }); })
    .catch(function (s) { if (window.console) console.warn('[Kalidash Connect] não consegui carregar a configuração (' + s + ').'); });
})();
