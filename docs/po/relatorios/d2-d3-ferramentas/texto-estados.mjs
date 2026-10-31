import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const OUT = 'D:/Códigos/Tzolkin/Projetos/carol/kalidash/docs/po/design/proto/copy-source';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3299';
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
  const r = await send('Page.captureScreenshot',{format:'png', captureBeyondViewport: !!full, ...(clip?{clip}:{})});
  writeFileSync(join(OUT,`${name}-${w}.png`), Buffer.from(r.result.data,'base64'));
  console.log('ok', name, w, full? clip.height: '');
};
const open = async (path, w, h) => {
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<600});
  await send('Page.navigate',{url:BASE+path}); await sleep(5000);
};
const slowScroll = async () => { await ev(`(async()=>{const h=document.documentElement.scrollHeight; for(let y=0;y<h;y+=500){window.scrollTo(0,y); await new Promise(r=>setTimeout(r,120));} window.scrollTo(0,0)})()`); await sleep(500); };

const txt = async () => ev(`(()=>{const m=document.querySelector('main')||document.body; return document.body.innerText})()`);
const parts = {};
const add = (k, t) => { parts[k] = t; };
await open('/diagnostico', 1440, 900);
add('p1', await txt());
await click('Continuar'); await sleep(400); add('p1-erro', await txt());
await type('#name','Marina Souza'); await type('#email','marina@empresa.com.br'); await type('#phone','11987654321');
await click('Continuar'); await sleep(500); add('p2', await txt());
await click('Continuar'); await sleep(400); add('p2-erro', await txt());
await type('#company','E'); await type('#role','R'); await type('#teamSize','1');
await click('Continuar'); await sleep(500); add('p3', await txt());
await click('Solicitar diagnóstico'); await sleep(400); add('p3-erro', await txt());
await ev(`document.querySelectorAll('[aria-pressed]')[0].click()`); await sleep(200);
await click('Solicitar diagnóstico'); await sleep(1200); add('sucesso', await txt());
await open('/diagnostico', 1440, 900);
await type('#name','Falha Teste'); await type('#email','a@b.co'); await type('#phone','11987654321'); await click('Continuar'); await sleep(300);
await type('#company','X'); await type('#role','Y'); await type('#teamSize','1'); await click('Continuar'); await sleep(300);
await ev(`document.querySelectorAll('[aria-pressed]')[0].click()`); await sleep(200);
await click('Solicitar diagnóstico'); await sleep(1500); add('envio-erro', await txt());
let all = Object.entries(parts).map(([k,v])=>`### ${k}\n${v}`).join('\n');
writeFileSync(join(OUT,'diagnostico-estados.txt'), all);
for (const [n,p] of [['blog-categoria','/blog/categoria/cases'],['blog-artigo-3','/blog/artigo-3'],['blog-vazio','/blog/categoria/inexistente']]) { await open(p,1440,900); writeFileSync(join(OUT,n+'.txt'), await txt()); }
ws.close(); chrome.kill();
