// Confere a copy dos protótipos contra a baseline (docs/po/relatorios/copy-baseline/).
// Uso: node docs/po/design/proto/copy-check.mjs
// Para cada protótipo: texto visível (innerText do body, sem a etiqueta .tag) normalizado como em copy-diff.mjs.
//  - EXTRA = linha do protótipo que NÃO existe na baseline da(s) rota(s) NEM literalmente em pages.ts. Qualquer EXTRA reprova.
//  - Comparação sem distinção de caixa (eyebrows são caixa-alta por CSS).
//  - Cobertura = % das linhas da baseline que aparecem no protótipo (informativo: os protótipos mostram só seções-chave).
// Ignorados (não são copy): seta decorativa no fim da linha (→), numeral solto de 2 dígitos (índice), "+"/"–" do FAQ, traço.
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = join(here, '..', '..', 'relatorios', 'copy-baseline');
const MAP = {
  '01-sobre-nos.html': ['sobre-nos'],
  '02-kognis.html': ['kognis'],
  '03-advisory.html': ['advisory'],
  '04-execucao-solucoes.html': ['execucao', 'solucoes'],
  '05-ai-culture.html': ['treinamento-corporativo-ia'],
};
const chromePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9100 + Math.floor(Math.random() * 500);
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cc-'))}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;

const pagesSrc = readFileSync(join(here, '..', '..', '..', '..', 'apps/site/src/app/institucional/pages.ts'), 'utf8').toLowerCase();
const norm = (t) => (t ?? '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
const clean = (l) => l.replace(/\s*[→↗]\s*$/, '').trim().toLowerCase(); // caixa-alta é text-transform do CSS, não muda o texto
const ignorable = (l) => /^\d{2}$/.test(l) || l === '+' || l === '–' || l === '-' || l === '';

let failed = 0;
await send('Page.enable');
for (const [file, routes] of Object.entries(MAP)) {
  await send('Page.navigate', { url: pathToFileURL(join(here, file)).href });
  await sleep(1500);
  const text = await ev(`(()=>{document.querySelectorAll('.tag').forEach(e=>e.remove()); return document.body.innerText})()`);
  const lines = norm(text).map(clean).filter((l) => !ignorable(l));
  const baseLines = routes.flatMap((r) => norm(readFileSync(join(base, r + '.txt'), 'utf8')).map(clean).filter((l) => !ignorable(l)));
  const baseSet = new Set(baseLines);
  const protoSet = new Set(lines);
  const notInBase = [...new Set(lines.filter((l) => !baseSet.has(l)))];
  // Texto recolhido (<details> fechado) não entra no innerText da baseline: aceito se existir literal em pages.ts.
  const fromSource = notInBase.filter((l) => pagesSrc.includes(l));
  const extra = notInBase.filter((l) => !pagesSrc.includes(l));
  const covered = [...baseSet].filter((l) => protoSet.has(l)).length;
  console.log(`${extra.length ? 'DIF' : 'OK '} ${file}: ${lines.length} linhas, extras=${extra.length}, só-em-pages.ts=${fromSource.length}, cobertura da baseline=${covered}/${baseSet.size} (${Math.round((100 * covered) / baseSet.size)}%)`);
  extra.forEach((l) => console.log('   EXTRA: ' + l));
  if (extra.length) failed++;
}
ws.close(); chrome.kill();
process.exit(failed ? 1 : 0);
