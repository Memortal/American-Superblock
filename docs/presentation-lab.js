// Architectural presentation sheets derived from existing building footprints.
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stages=[['01','SITE DEFINITION','660 × 660 ft · 10 acres'],['02','PRIMARY MASSING','Four courtyard buildings'],['03','SPATIAL SUBTRACTION','Shared valleys and open courts'],['04','PROGRAM ORGANIZATION','Triplexes, offices and upper dwellings'],['05','ROOF EVOLUTION','Stepped duplexes + roof terraces'],['06','FINAL ARCHITECTURAL FORM','Four rings and the shared core']];
const svgHeader=(title,subtitle)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900"><rect width="1400" height="900" fill="#fff"/><g font-family="Arial,Helvetica,sans-serif"><text x="76" y="78" font-weight="700" font-size="22" fill="#242b28">memo<tspan font-weight="400">studio</tspan></text><text x="1324" y="78" text-anchor="end" font-size="14" letter-spacing="2" fill="#89908a">AMERICAN SUPERBLOCK / DESIGN PROCESS</text><path d="M76 98H1324" stroke="#dadbd5"/><text x="76" y="160" font-size="36" fill="#29352e">${safe(title)}</text><text x="76" y="190" font-size="16" fill="#868984">${safe(subtitle)}</text>`;
const closeSvg=`<path d="M76 810H1324" stroke="#ddd"/><text x="76" y="843" font-size="13" fill="#999">MODEL-DERIVED SCHEMATIC DESIGN · NOT FOR CONSTRUCTION</text><text x="1324" y="843" font-size="13" text-anchor="end" fill="#999">MEMO STUDIO / 660 FT × 660 FT</text></g></svg>`;
function isoPoint(q,z=0,scale=.67,ox=700,oy=520){return [ox+(q[0]-q[1])*scale,oy+(q[0]+q[1])*.34-z*.66]}
const pts=q=>q.map(v=>v.map(n=>n.toFixed(1)).join(',')).join(' ');
function block(poly,h,color,scale,ox,oy){if(!poly?.length)return '';const base=poly.map(q=>isoPoint(q,0,scale,ox,oy)),top=poly.map(q=>isoPoint(q,h,scale,ox,oy));let out='';for(let i=0;i<poly.length;i++){let j=(i+1)%poly.length;out+=`<polygon points="${pts([base[i],base[j],top[j],top[i]])}" fill="${i%2?'#dedbd4':'#eae7e0'}" stroke="#7d827b" stroke-width=".7"/>`;}return out+`<polygon points="${pts(top)}" fill="${color}" stroke="#646b64" stroke-width="1.1"/>`}
function diagram(model,index,scale=.67,ox=700,oy=520){const buildings=model.buildings.filter(b=>!b.parking),parts=model.pieces.filter(p=>!p.core&&!p.office),output=[];
 const ground=[[-330,-330],[330,-330],[330,330],[-330,330]];
 output.push(`<polygon points="${pts(ground.map(q=>isoPoint(q,0,scale,ox,oy)))}" fill="#f8f7f4" stroke="#aaa" stroke-width="1.2"/>`);
 if(index===0)return output.join('')+`<polygon points="${pts(ground.map(q=>isoPoint(q,1,scale,ox,oy)))}" fill="#ead9c2" fill-opacity=".42" stroke="#b89b7d" stroke-dasharray="10 6"/>`;
 for(const b of buildings){const h=index===1?48:index===2?36:index===3?60:index===4?Math.min(84,(b.levels||8)*10):Math.min(108,(b.levels||8)*12);
  output.push(block(b.outer,h,index===3?'#f0e4d4':'#f3f2ee',scale,ox,oy));
  if(index>=2&&b.courtyard)output.push(block(b.courtyard,h+1,'#f5f5f2',scale,ox,oy));
  if(index>=4&&b.corridorOuter)output.push(`<polyline points="${pts(b.corridorOuter.map(q=>isoPoint(q,h+1,scale,ox,oy)))}" fill="none" stroke="#d29f7b" stroke-width="3"/>`);
 }
 if(index>=3){for(const p of parts.filter((_,i)=>i%Math.max(1,Math.ceil(parts.length/55))===0)){const q=p.polygon?.reduce((a,v)=>[a[0]+v[0]/p.polygon.length,a[1]+v[1]/p.polygon.length],[0,0]);if(!q)continue;const a=isoPoint(q,62,scale,ox,oy);output.push(`<circle cx="${a[0]}" cy="${a[1]}" r="2.5" fill="#c99371"/>`);}}
 return output.join('');}
const download=(name,body)=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([body],{type:'image/svg+xml'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
export function mountPresentationLab({getModel,openDrawings}){
 let root=document.getElementById('memoPresentationLab');if(root){root.hidden=false;return;}
 root=document.createElement('div');root.id='memoPresentationLab';root.className='memo-presentation';
 root.innerHTML='<header><strong>MEMO / Presentation Lab</strong><button id="labSVG">Export vector SVG</button><button id="labSheets">Technical drawing set ↗</button><button id="labClose">Close ×</button></header><div class="lab-body"><aside id="labStages"></aside><main><div class="lab-paper" id="labPaper"></div></main></div>';
 document.body.append(root);const model=getModel();let selected=0;const side=root.querySelector('#labStages'),paper=root.querySelector('#labPaper');
 function render(){side.innerHTML=stages.map(([n,t],i)=>`<button data-i="${i}" class="${i===selected?'active':''}">${n} / ${safe(t)}</button>`).join('')+'<p>Diagrams use active building footprints and roof-level metadata. Construction details and drawing schedules remain in the existing drawing set.</p>';side.querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>{selected=+b.dataset.i;render()});paper.innerHTML=current();}
 function current(){const [n,t,d]=stages[selected];return svgHeader(`${n}  ${t}`,d)+diagram(model,selected)+closeSvg;}
 root.querySelector('#labSVG').onclick=()=>download('MEMO-Evolution-'+stages[selected][0]+'.svg',current());root.querySelector('#labClose').onclick=()=>{root.hidden=true};root.querySelector('#labSheets').onclick=()=>{root.hidden=true;openDrawings()};render();
}
