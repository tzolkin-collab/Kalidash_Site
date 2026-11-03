const fs=require('fs');const zlib=require('zlib');
const [,, pdf, out]=process.argv; const b=fs.readFileSync(pdf); const s=b.toString('latin1');
const re=/(\d+) 0 obj\s*<<([\s\S]*?)>>\s*stream\r?\n/g; let m,n=0,rows=[];
while((m=re.exec(s))){const d=m[2]; if(!/\/Subtype\s*\/Image/.test(d)) continue;
 const len=+(/\/Length (\d+)/.exec(d)||[])[1]; const start=m.index+m[0].length;
 const w=+(/\/Width (\d+)/.exec(d)||[])[1], h=+(/\/Height (\d+)/.exec(d)||[])[1];
 const f=(/\/Filter\s*\[?\s*\/(\w+)/.exec(d)||[])[1]; const cs=(/\/ColorSpace\s*\/?(\w+)/.exec(d)||[])[1];
 const data=b.subarray(start,start+len); const id=m[1];
 rows.push({id,w,h,f,cs,len});
 if(f==='DCTDecode'){fs.writeFileSync(`${out}/img-${id}-${w}x${h}.jpg`,data);n++;}
}
console.log(JSON.stringify(rows.map(r=>`${r.id}:${r.w}x${r.h}:${r.f}:${r.cs}:${Math.round(r.len/1024)}KB`)));console.log('jpg extraidos',n);
