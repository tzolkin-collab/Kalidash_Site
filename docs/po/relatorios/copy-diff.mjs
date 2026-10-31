// Regenera o texto visível do <main> de cada rota e compara com a baseline de copy (checklist 3.1).
// Uso:
//   node docs/po/relatorios/copy-diff.mjs          -> compara com copy-baseline/ (sai com 1 se houver diferença)
//   node docs/po/relatorios/copy-diff.mjs --save   -> grava a baseline (só no commit de partida)
// Requer o site de produção no ar em BASE (padrão http://localhost:3199), ver docs/web-vitals.md.
// Usa o Chrome/Edge instalado via DevTools Protocol, sem dependências.
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://localhost:3199';
const SAVE = process.argv.includes('--save');
const baselineDir = join(here, 'copy-baseline');
const ROUTES = [
  '/sobre-nos',
  '/treinamento-corporativo-ia',
  '/advisory',
  '/execucao',
  '/solucoes',
  '/kognis',
  '/spectra',
  '/diagnostico',
  '/blog',
  '/blog/artigo-1',
];
const fileName = (route) => route.slice(1).replace(/\//g, '-') + '.txt';

const chromePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));
if (!chromePath) throw new Error('Chrome ou Edge não encontrado');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9100 + Math.floor(Math.random() * 500);
const chrome = spawn(
  chromePath,
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'copy-'))}`, '--no-first-run', '--disable-gpu', 'about:blank'],
  { stdio: 'ignore' },
);

let targets;
for (let i = 0; i < 50; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    if (targets.length) break;
  } catch {}
  await sleep(200);
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) {
    pending.get(d.id)(d);
    pending.delete(d.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;

// Normaliza: uma linha por bloco visível, espaços das pontas removidos, linhas vazias descartadas.
const normalize = (text) =>
  (text ?? '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l !== '')
    .join('\n') + '\n';

async function textOf(route) {
  await send('Page.navigate', { url: BASE + route });
  for (let i = 0; i < 60; i++) {
    const ready = await ev(`document.readyState === 'complete' && !!document.querySelector('main')`);
    if (ready) break;
    await sleep(250);
  }
  await sleep(800);
  return normalize(await ev(`document.querySelector('main')?.innerText ?? ''`));
}

// LCS simples por linha: devolve as linhas removidas (-) e adicionadas (+) em ordem.
function lineDiff(a, b) {
  const A = a.split('\n');
  const B = b.split('\n');
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(`- ${A[i++]}`);
    else out.push(`+ ${B[j++]}`);
  }
  while (i < n) out.push(`- ${A[i++]}`);
  while (j < m) out.push(`+ ${B[j++]}`);
  return out;
}

let failed = 0;
if (SAVE) mkdirSync(baselineDir, { recursive: true });
for (const route of ROUTES) {
  const now = await textOf(route);
  const file = join(baselineDir, fileName(route));
  if (SAVE) {
    writeFileSync(file, now);
    console.log(`gravado ${fileName(route)} (${now.split('\n').length - 1} linhas)`);
    continue;
  }
  if (!existsSync(file)) {
    console.log(`SEM BASELINE: ${fileName(route)}`);
    failed++;
    continue;
  }
  const diff = lineDiff(readFileSync(file, 'utf8'), now);
  if (diff.length === 0) console.log(`OK  ${route}`);
  else {
    failed++;
    console.log(`DIF ${route} (${diff.length} linhas)`);
    diff.slice(0, 40).forEach((l) => console.log('   ' + l));
  }
}

ws.close();
chrome.kill();
process.exit(failed ? 1 : 0);
