import http from 'node:http';
import { appendFileSync } from 'node:fs';
http.createServer((req,res)=>{
  res.setHeader('access-control-allow-origin','*'); res.setHeader('access-control-allow-headers','*');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='POST'&&req.url.startsWith('/api/public/leads')){let b='';req.on('data',d=>b+=d);req.on('end',()=>{appendFileSync(process.env.LOG||'leads.log',b+'\n');const bad=/Falha/.test(b);res.writeHead(bad?500:200,{'content-type':'application/json'});res.end('{}');});return;}
  res.writeHead(404);res.end('{}');
}).listen(8199,()=>console.log('lead fake on 8199'));
