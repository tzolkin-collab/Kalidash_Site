// uso: node shot-diag.mjs <pasta-saida> <prefixo>   (site em :3300, servidor falso de lead em :8199)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const OUT = process.argv[2]; const PRE = process.argv[3] || 'diag';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3300';
const port = 9600 + Math.floor(Math.random()*300);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new',`--remote-debugging-port=${port}`,`--user-data-dir=${mkdtempSync(join(tmpdir(),'cap-'))}`,'--hide-scrollbars','--no-first-run','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let t; for(let i=0;i<50;i++){try{t=await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if(t.length)break;}catch{} await sleep(200);}
const ws = new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map(); ws.onmessage=m=>{const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){pend.get(d.id)(d);pend.delete(d.id);}};
const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result?.result?.value;
await send('Page.enable');
const type = async (sel, text) => { await ev(`document.querySelector(${JSON.stringify(sel)}).focus()`); await send('Input.insertText',{text}); };
const click = (txt) => ev(`(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.includes(${JSON.stringify(txt)})); if(b){b.click();return true}return false})()`);
const shot = async (name, w, full) => {
  let clip;
  if (full) { const h = await ev('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)'); clip = {x:0,y:0,width:w,height:Math.min(h,9000),scale:1}; }
  let r = await send("Page.captureScreenshot",{format:"png", captureBeyondViewport: !!full, ...(clip?{clip}:{})});
  if(!r.result){ await sleep(800); r = await send("Page.captureScreenshot",{format:"png"}); }
  writeFileSync(join(OUT,`${PRE}-${name}-${w}.png`), Buffer.from(r.result.data,'base64'));
  console.log('ok', name, w);
};
const open = async (w, h) => {
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<600});
  await send('Page.navigate',{url:BASE+'/diagnostico'}); await sleep(4000);
};
const sizes = [[1440,900],[1024,768],[768,1024],[390,844]];
for (const [w,h] of sizes) {
  await open(w, h);
  await shot('1-passo1', w, true);
  await click('Continuar'); await sleep(400); await shot('2-passo1-erros', w, true);
  await type('#name','Marina Souza'); await type('#email','marina@empresa.com.br'); await type('#phone','11987654321');
  await click('Continuar'); await sleep(500); await shot('3-passo2', w, true);
  await click('Continuar'); await sleep(400); await shot('4-passo2-erros', w, true);
  await type('#company','Empresa de Teste'); await type('#role','Diretora de Operações'); await type('#teamSize','80 pessoas');
  await click('Continuar'); await sleep(500); await shot('5-passo3', w, true);
  await click('Solicitar diagnóstico'); await sleep(400); await shot('6-passo3-erro', w, true);
  await ev(`document.querySelectorAll('[aria-pressed]')[0].click(); document.querySelectorAll('[aria-pressed]')[2].click()`); await sleep(300);
  await type('#challenge','Texto de teste do desafio.'); await shot('7-passo3-selecionado', w, true);
  await click('Solicitar diagnóstico'); await sleep(1500); await shot('8-sucesso', w, true);
}
for (const [w,h] of sizes) {
  await open(w, h);
  await type('#name','Falha Teste'); await type('#email','a@b.co'); await type('#phone','11987654321'); await click('Continuar'); await sleep(300);
  await type('#company','X'); await type('#role','Y'); await type('#teamSize','1'); await click('Continuar'); await sleep(300);
  await ev(`document.querySelectorAll('[aria-pressed]')[0].click()`); await sleep(200);
  await click('Solicitar diagnóstico'); await sleep(1500); await shot('9-erro-envio', w, true);
}
ws.close(); chrome.kill();
