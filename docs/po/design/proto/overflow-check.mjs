// Mede overflow horizontal dos protótipos em 390, 768, 1024 e 1440 (scrollWidth > innerWidth) e lista os elementos que passam da borda.
// Uso: node docs/po/design/proto/overflow-check.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const chromePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9100 + Math.floor(Math.random() * 500);
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ov-'))}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send('Page.enable');
let bad = 0;
for (const file of readdirSync(here).filter((f) => /^\d\d-.*\.html$/.test(f))) {
  for (const w of [390, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: pathToFileURL(join(here, file)).href });
    await sleep(1200);
    const r = await ev(`(()=>{const iw=document.documentElement.clientWidth; const sw=document.documentElement.scrollWidth; const off=[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>iw+1 && !e.closest('.tag')).slice(0,4).map(e=>e.tagName.toLowerCase()+'.'+(e.className||'')+' right='+Math.round(e.getBoundingClientRect().right)); return {iw,sw,off}})()`);
    const flag = r.sw > r.iw ? 'OVERFLOW' : 'ok';
    if (flag !== 'ok') bad++;
    console.log(`${flag.padEnd(8)} ${file} @${w}: clientWidth=${r.iw} scrollWidth=${r.sw}${r.off.length ? ' · ' + r.off.join(' | ') : ''}`);
  }
}
ws.close(); chrome.kill();
process.exit(bad ? 1 : 0);
