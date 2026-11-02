import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const BASE='http://localhost:3199';
const port = 9600 + Math.floor(Math.random()*300);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new',`--remote-debugging-port=${port}`,`--user-data-dir=${mkdtempSync(join(tmpdir(),'cap-'))}`,'--no-first-run','--disable-gpu','about:blank'],{stdio:'ignore'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let t; for(let i=0;i<50;i++){try{t=await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if(t.length)break;}catch{} await sleep(200);}
const ws = new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map(); ws.onmessage=m=>{const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){pend.get(d.id)(d);pend.delete(d.id);}};
const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result?.result?.value;
await send('Page.enable');
const type = async (sel, text) => { await ev(`document.querySelector(${JSON.stringify(sel)}).focus()`); await send('Input.insertText',{text}); };
const click = async (txt) => { const r = await ev('(()=>{const b=[...document.querySelectorAll("button,a")].find(x=>x.textContent.includes('+JSON.stringify(txt)+'));if(!b)return null;b.scrollIntoView({block:"center"});const r=b.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()'); if(!r) return false; await sleep(100); for (const type of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent',{type,x:r[0],y:r[1],button:'left',clickCount:1}); return true; };
for (const [w,h] of [[1440,900],[1024,768],[768,1024],[390,844]]) {
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<600});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) window.__cls+=e.value}).observe({type:'layout-shift',buffered:true})`});
  await send('Page.navigate',{url:BASE+'/diagnostico'}); await sleep(3000);
  await click('Continuar'); await sleep(400);
  await type('#name','Marina Souza'); await type('#email','marina@empresa.com.br'); await type('#phone','11987654321');
  await click('Continuar'); await sleep(500); await click('Continuar'); await sleep(400);
  await type('#company','E'); await type('#role','R'); await type('#teamSize','1');
  await click('Continuar'); await sleep(500); await click('Solicitar diagnóstico'); await sleep(400);
  await ev(`document.querySelector('[aria-pressed]').scrollIntoView({block:'center'})`); { const r=await ev(`(()=>{const b=document.querySelector('[aria-pressed]').getBoundingClientRect();return [b.x+20,b.y+b.height/2]})()`); for (const type of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent',{type,x:r[0],y:r[1],button:'left',clickCount:1}); } await sleep(200);
  await click('Solicitar diagnóstico'); await sleep(1200);
  console.log(w, 'CLS total (passos 1-3, erros, sucesso):', (await ev('window.__cls')).toFixed(4));
}
ws.close(); chrome.kill();
