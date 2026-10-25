import lighthouse from 'lighthouse';
import * as cl from 'chrome-launcher';
import fs from 'fs';
const [,, label, runs='3'] = process.argv;
const base='http://localhost:3199';
const pages=(process.env.PAGES||'/,/treinamento-corporativo-ia,/advisory,/blog,/blog/artigo-1').split(',');
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
const out={};
for(const preset of (process.env.PRESETS||'mobile,desktop').split(',')){
  for(const p of pages){
    const res=[];
    for(let i=0;i<+runs;i++){
      const chrome=await cl.launch({chromePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',chromeFlags:['--headless=new','--no-sandbox']});
      const cfg=preset==='desktop'?{extends:'lighthouse:default',settings:{formFactor:'desktop',screenEmulation:{mobile:false,width:1350,height:940,deviceScaleFactor:1,disabled:false},throttling:{rttMs:40,throughputKbps:10240,cpuSlowdownMultiplier:1,requestLatencyMs:0,downloadThroughputKbps:0,uploadThroughputKbps:0},throttlingMethod:'simulate',onlyCategories:['performance']}}:{extends:'lighthouse:default',settings:{onlyCategories:['performance']}};
      try{
      const r=await lighthouse(base+p,{port:chrome.port,output:'json',logLevel:'error'},cfg);
      const a=r.lhr.audits;
      const bytes=t=>r.lhr.audits['network-requests'].details.items.filter(x=>x.resourceType===t).reduce((s,x)=>s+(x.transferSize||0),0)/1024;
      res.push({perf:r.lhr.categories.performance.score*100,lcp:a['largest-contentful-paint'].numericValue,cls:a['cumulative-layout-shift'].numericValue,tbt:a['total-blocking-time'].numericValue,fcp:a['first-contentful-paint'].numericValue,ttfb:a['server-response-time'].numericValue,js:bytes('Script'),img:bytes('Image'),font:bytes('Font'),total:a['total-byte-weight'].numericValue/1024,lcpEl:a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0,80)});
      }catch(e){console.error(p,e.message)}
      await chrome.kill();
    }
    if(!res.length)continue;
    const m={};for(const k of ['perf','lcp','cls','tbt','fcp','ttfb','js','img','font','total'])m[k]=+med(res.map(x=>x[k])).toFixed(k==='cls'?3:0);
    m.lcpEl=res[0].lcpEl;
    out[preset+' '+p]=m;console.log(preset,p,JSON.stringify(m));
  }
}
fs.writeFileSync(label+'.json',JSON.stringify(out,null,1));
