// Procura containers com efeito de hover (transform, sombra) que se CORTAM a si mesmos: o elemento, ao passar o mouse,
// ou a sombra dele, passa da área visível de um ancestral com overflow diferente de visible.
// Uso: BASE=http://localhost:3000 node docs/po/design/hover-clip-check.mjs   (só lê o site; não altera nada)
// Como funciona: lê as regras `:hover` do CSSOM, acha os alvos, move o mouse (CDP) para o centro de cada um, mede o retângulo
// final (com transform) mais a extensão da box-shadow e compara com a área de cada ancestral que corta (overflow != visible).
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const ROUTES = (process.env.ROUTES ?? '/sobre-nos,/treinamento-corporativo-ia,/advisory,/execucao,/solucoes,/kognis,/spectra').split(',');
const WIDTHS = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9100 + Math.floor(Math.random() * 500);
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'hc-'))}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;

// roda dentro da página: lista alvos de hover com um índice estável
const COLLECT = `(() => {
  const out = [];
  const walk = (rules) => { for (const r of rules) {
    if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; }
    if (!r.selectorText || !r.selectorText.includes(':hover')) continue;
    for (const sel of r.selectorText.split(',')) {
      const i = sel.indexOf(':hover'); if (i < 0) continue;
      const prefix = sel.slice(0, i).trim(); const rest = sel.slice(i + 6).trim();
      if (!prefix || /:not\\(:disabled\\)/.test(prefix)) continue;
      let hosts; try { hosts = [...document.querySelectorAll(prefix)]; } catch { continue; }
      hosts.forEach((h) => out.push({ prefix, rest, host: h }));
    }
  } };
  for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch {} }
  window.__hov = out;
  return out.map((o, n) => ({ n, prefix: o.prefix, rest: o.rest }));
})()`;

// mede um elemento (rect final + sombra) contra os ancestrais que cortam
const MEASURE = (n, which) => `(() => {
  const o = window.__hov[${n}]; const hostEl = o.host;
  const targets = ${which === 'host' ? '[hostEl]' : 'o.rest ? [...hostEl.querySelectorAll(o.rest.replace(/^[>+~\\s]+/, ""))] : [hostEl]'};
  const res = [];
  for (const el of targets.slice(0, 3)) {
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    const cs = getComputedStyle(el); let ext = { l: 0, r: 0, t: 0, b: 0 };
    for (const part of (cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\\))/))) {
      if (/inset/.test(part)) continue;
      const nums = (part.match(/-?[\\d.]+px/g) || []).map(parseFloat); const [x = 0, y = 0, b = 0, sp = 0] = nums; const g = b + sp;
      ext = { l: Math.max(ext.l, g - x), r: Math.max(ext.r, g + x), t: Math.max(ext.t, g - y), b: Math.max(ext.b, g + y) };
    }
    const box = { l: r.left - ext.l, r: r.right + ext.r, t: r.top - ext.t, b: r.bottom + ext.b };
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const acs = getComputedStyle(a); if (acs.overflowX === 'visible' && acs.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect();
      const clip = { l: ar.left + a.clientLeft, r: ar.left + a.clientLeft + a.clientWidth, t: ar.top + a.clientTop, b: ar.top + a.clientTop + a.clientHeight };
      const cutX = acs.overflowX !== 'visible', cutY = acs.overflowY !== 'visible';
      const over = { l: cutX ? Math.max(0, clip.l - box.l) : 0, r: cutX ? Math.max(0, box.r - clip.r) : 0, t: cutY ? Math.max(0, clip.t - box.t) : 0, b: cutY ? Math.max(0, box.b - clip.b) : 0 };
      const worst = Math.max(over.l, over.r, over.t, over.b);
      if (worst > 0.5) res.push({ el: el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0], clipper: a.tagName.toLowerCase() + '.' + String(a.className).split(' ')[0] + ' (overflow ' + acs.overflowX + '/' + acs.overflowY + ')', over: Object.fromEntries(Object.entries(over).filter(([, v]) => v > 0.5).map(([k, v]) => [k, Math.round(v)])), shadow: ext.l + ext.r + ext.t + ext.b > 0 });
    }
  }
  return res;
})()`;

const rows = new Map();
await send('Page.enable');
for (const w of WIDTHS) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const route of ROUTES) {
    await send('Page.navigate', { url: BASE + route });
    for (let i = 0; i < 60; i++) { if (await ev(`document.readyState==='complete' && !!document.querySelector('main')`)) break; await sleep(250); }
    await sleep(900);
    // rola até o fim para disparar os Reveal
    const h = await ev('document.documentElement.scrollHeight');
    for (let y = 0; y < h; y += 300) { await ev(`window.scrollTo(0,${y})`); await sleep(60); }
    await sleep(500);
    const hosts = await ev(COLLECT);
    const seen = new Set();
    for (const hst of hosts) {
      const key = hst.prefix + '|' + hst.rest;
      // centro do host, rolado para dentro da viewport
      const pos = await ev(`(() => { const e = window.__hov[${hst.n}].host; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2, w: r.width }; })()`);
      if (!pos || !pos.w) continue;
      // repouso: mouse fora
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
      await sleep(120);
      const rest = await ev(MEASURE(hst.n, hst.rest ? 'affected' : 'host'));
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.min(pos.x, w - 2), y: pos.y });
      await sleep(420);
      const hov = await ev(MEASURE(hst.n, hst.rest ? 'affected' : 'host'));
      for (const [state, list] of [['hover', hov], ['repouso', rest]]) {
        for (const c of list) {
          const k = [route, w, state, hst.prefix, hst.rest, c.clipper].join('|');
          if (!rows.has(k)) rows.set(k, { route, w, state, host: hst.prefix, rest: hst.rest, ...c });
          seen.add(k);
        }
      }
    }
  }
}
const list = [...rows.values()];
// um hover que corta só no hover (não no repouso) é o caso que interessa
for (const r of list) console.log(`${r.state === 'hover' ? 'CORTA NO HOVER' : 'CORTA EM REPOUSO'}  ${r.route} @${r.w}  alvo=${r.host}${r.rest ? ' ' + r.rest : ''}  elemento=${r.el}  cortado por ${r.clipper}  excesso(px)=${JSON.stringify(r.over)}${r.shadow ? '  [sombra]' : ''}`);
if (!list.length) console.log('nenhum corte encontrado');
ws.close(); chrome.kill(); process.exit(0);
