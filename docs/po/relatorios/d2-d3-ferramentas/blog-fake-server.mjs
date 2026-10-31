// Servidor falso do blog (DADOS DE TESTE, não é conteúdo real). Porta 8199.
import http from 'node:http';
const covers = ['/home/g21-cba-premio.jpg','/home/evento-palestra.jpg',null,'/home/g03-imersao-claude.jpg','/home/front-2-comite.jpg','/home/g01-cupula.jpg','/home/metodo-reuniao.jpg'];
const cats = [['Cases'],['Posts'],['Posts','AI Culture'],['Cases'],['Posts'],['Advisory'],['Posts']];
const body = `<p>Parágrafo de abertura do artigo de teste. Ele serve para medir a medida de leitura e o ritmo do corpo exportado pelo editor, com um trecho longo o bastante para quebrar em várias linhas em telas largas e em telas estreitas, sem depender de conteúdo real.</p>
<h2>Um título de seção (h2)</h2>
<p>Texto corrido com <strong>ênfase</strong>, <em>itálico</em> e um <a href="#">link no meio da frase</a>. O corpo continua por mais algumas linhas para que se veja a entrelinha e o espaço entre parágrafos.</p>
<p>Segundo parágrafo da seção, também de teste, para conferir o espaçamento vertical entre blocos de texto consecutivos.</p>
<h3>Um subtítulo (h3)</h3>
<ul><li>Primeiro item de lista de teste</li><li>Segundo item, um pouco mais longo para quebrar linha e mostrar o recuo e o marcador da lista</li><li>Terceiro item</li></ul>
<ol><li>Primeiro passo numerado de teste</li><li>Segundo passo numerado, também longo o suficiente para quebrar em duas linhas no desktop</li><li>Terceiro passo</li></ol>
<blockquote><p>Uma citação de teste em bloco, para ver como o corpo destaca uma frase de apoio.</p></blockquote>
<figure data-text-alignment="center"><img src="/home/evento-mesa.jpg" alt="Imagem de teste" width="1200" height="800"><figcaption>Legenda de teste da figura.</figcaption></figure>
<h2>Outra seção (h2)</h2>
<p>Mais texto de teste depois da figura, para ver o retorno ao ritmo de leitura.</p>`;
const mk = (i) => ({
  id: 'id'+i, title: ['Artigo de teste com um título longo o bastante para quebrar em duas linhas no destaque','Segundo artigo de teste','Terceiro artigo de teste, sem capa','Quarto artigo de teste','Quinto artigo de teste','Sexto artigo de teste','Sétimo artigo de teste'][i-1],
  slug: 'artigo-'+i, excerpt: 'Resumo fictício do artigo '+i+' para teste de layout. '+(i===1?'Este resumo é um pouco mais longo para o destaque, com duas ou três linhas de texto, só para ver a medida.':''),
  body, bodyJson: null, coverImageUrl: covers[i-1], coverImagePos: 50, featured: i===1, published: true,
  authorName: i%2 ? 'Equipe Kalidash' : 'Autor de Teste', categories: cats[i-1], createdAt:'2026-10-0'+i+'T10:00:00Z', updatedAt:'2026-10-0'+i+'T10:00:00Z', publishedAt:'2026-10-0'+i+'T10:00:00Z',
});
const all = [1,2,3,4,5,6,7].map(mk);
const hero = { ...mk(1), slug:'blog-global', title:'blog-global', body:'' };
http.createServer((req,res)=>{
  res.setHeader('access-control-allow-origin','*'); res.setHeader('access-control-allow-headers','*');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='POST'&&req.url.startsWith('/api/public/leads')){let b='';req.on('data',d=>b+=d);req.on('end',()=>{const bad=/Falha/.test(b);res.writeHead(bad?500:200,{'content-type':'application/json'});res.end('{}');});return;}
  const u = new URL(req.url,'http://x'); const j=(o,c=200)=>{res.writeHead(c,{'content-type':'application/json'});res.end(JSON.stringify(o));};
  if(u.pathname==='/api/blog/articles') return j(all);
  if(u.pathname==='/api/blog/article'){ const s=u.searchParams.get('slug'); if(s==='blog-global') return j(hero); const a=all.find(x=>x.slug===s); return a?j(a):j({error:'nf'},404);}
  if(u.pathname==='/api/blog/categories') return j([]);
  return j({error:'nf'},404);
}).listen(8199,()=>console.log('fake on 8199'));
