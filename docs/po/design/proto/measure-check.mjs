// Mede caracteres por linha do 1º parágrafo do corpo do artigo: antes (site de teste em :3299 + servidor falso) vs protótipo. Uso: node measure-check.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const OUT = 'D:/Códigos/Tzolkin/Projetos/carol/kalidash/docs/po/relatorios/antes/d2-d3';

const BASE = '';
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

const measure = `(()=>{const p=document.querySelector('[data-block="article-body"] p'); const r=document.createRange(); r.selectNodeContents(p); const rects=[...r.getClientRects()]; const lines=new Map(); const tn=p.firstChild; 
 // chars por linha: percorre caracteres do primeiro nó de texto e agrupa por top
 const t=p.textContent; const node=p.firstChild; const g=new Map(); for(let i=0;i<node.length;i++){const rr=document.createRange(); rr.setStart(node,i); rr.setEnd(node,i+1); const b=rr.getBoundingClientRect(); if(!b.height) continue; const k=Math.round(b.top); g.set(k,(g.get(k)||0)+1);} 
 const cs=getComputedStyle(p); return {fontSize:cs.fontSize, lh:cs.lineHeight, width:Math.round(p.getBoundingClientRect().width), color:cs.color, linhas:[...g.values()]}})()`;
for (const [label,url,w] of [['antes 1440','http://localhost:3299/blog/artigo-1',1440],['antes 390','http://localhost:3299/blog/artigo-1',390],['proto 1440','file:///D:/Códigos/Tzolkin/Projetos/carol/kalidash/docs/po/design/proto/09-blog-artigo.html',1440],['proto 390','file:///D:/Códigos/Tzolkin/Projetos/carol/kalidash/docs/po/design/proto/09-blog-artigo.html',390]]) {
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:900,deviceScaleFactor:1,mobile:w<600});
  await send('Page.navigate',{url}); await sleep(4000);
  console.log(label, JSON.stringify(await ev(measure)));
}
ws.close(); chrome.kill();
