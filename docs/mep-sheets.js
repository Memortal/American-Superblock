const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const names=['Site utility plan','Basement MEP plan','Typical triplex MEP plan','Typical upper residential MEP plan','Level 4 transfer diagram','Roof mechanical plan','Core riser diagram','Plumbing riser diagram','Electrical single-line concept','Mechanical system diagram','Sanitary flow diagram','Stormwater diagram','Building section — MEP routing'];
export function mepDrawing(d,index,bw=true){
 if(index===0&&d.hierarchy){
  const C={RED:'#e73438',ORANGE:'#ed8526',PURPLE:'#9852cd',YELLOW:'#d8b011',BLUE:'#278dde'},P=q=>[720+q[0]*.94,450+q[1]*.94],pt=q=>P(q).join(','),color=t=>bw?'#111':C[t];
  let g='';for(const b of d.architecture)g+='<polygon points="'+b.outer.map(pt).join(' ')+'" fill="none" stroke="#aaa"/><polygon points="'+b.courtyard.map(pt).join(' ')+'" fill="none" stroke="#ccc"/>';
  for(const l of d.hierarchy.links)g+='<polyline points="'+l.route.map(pt).join(' ')+'" fill="none" stroke="'+color(l.tier)+'" stroke-width="3"/>';
  for(const h of d.hierarchy.hubs){const [x,y]=P(h.point);g+='<circle cx="'+x+'" cy="'+y+'" r="11" fill="'+(bw?'white':color(h.tier))+'" stroke="'+color(h.tier)+'" stroke-width="2"/><text x="'+(x+16)+'" y="'+(y-12)+'" font-size="11">'+h.tier+' / '+h.building+'</text>';}
  return '<svg xmlns="http://www.w3.org/2000/svg" width="36in" height="24in" viewBox="0 0 1440 960"><rect width="1440" height="960" fill="white"/><g font-family="Arial"><rect x="25" y="25" width="1390" height="910" fill="none" stroke="black"/><text x="55" y="65" font-size="22">MEMO STUDIO / AMERICAN SUPERBLOCK</text><text x="55" y="96" font-size="17">MEP-01 / CORNER-FED INFRASTRUCTURE</text>'+g+'<text x="55" y="835" font-size="15">RED: SITE HUB → ORANGE: FIRST LANDING → PURPLE: DISTRIBUTION → YELLOW: INNER HUB</text><text x="55" y="865" font-size="12">4 corner hubs · 4 proposed service-room landings · 8 secondary hubs · 4 inner hubs · 4 blue parking cores</text><text x="55" y="895" font-size="12">Diagram symbols. Physical mains below grade; local distribution inside building service bands. Alleys and courtyards remain open.</text><text x="55" y="922" font-size="10">SCHEMATIC · NTS · ROOM ENCLOSURES, CAPACITIES AND FULL CLASH COORDINATION PENDING</text></g></svg>';
 }

 const sys=new Map(d.systems.map(s=>[s.id,s])),byId=new Map(d.nodes.map(n=>[n.id,n])),section=[6,7,12].includes(index),diagram=[8,9,10].includes(index);
 let edges=d.edges.filter(e=>!e.blocked&&!e.sharedRiser),title=names[index];
 if(index<=1)edges=edges.filter(e=>e.zone==='UNDERGROUND');
 if(index===2)edges=edges.filter(e=>e.building==='B1'&&e.level>=0&&e.level<3);
 if(index===3)edges=edges.filter(e=>e.building==='B1'&&e.level===4);
 if(index===4)edges=edges.filter(e=>e.zone==='TRANSFER'||e.zone==='RISER');
 if(index===5)edges=edges.filter(e=>e.discipline==='Mechanical'&&e.zone==='RISER');
 if(index===6)edges=edges.filter(e=>e.zone==='RISER'&&e.building==='B1');
 if(index===7)edges=edges.filter(e=>e.discipline==='Plumbing'&&e.building==='B1');
 if(index===8)edges=edges.filter(e=>e.system==='NORMAL_POWER'||e.system==='EMERGENCY_POWER');
 if(index===9)edges=edges.filter(e=>e.discipline==='Mechanical');
 if(index===10)edges=edges.filter(e=>e.system==='SANITARY');
 if(index===11)edges=edges.filter(e=>e.system==='STORM'||e.system==='IRRIGATION');
 let content='',legend='';
 const color=e=>bw?'#111':'#'+sys.get(e.system).color.toString(16).padStart(6,'0'),dash=e=>bw?['','7 3','2 3','12 3 2 3'][sys.get(e.system).lane%4]:'';
 const text=(x,y,s,size=12)=>'<text x="'+x+'" y="'+y+'" font-size="'+size+'">'+esc(s)+'</text>';
 if(diagram){
  const systems=[...new Set(edges.map(e=>e.system))];let row=0;
  for(const system of systems){
   const es=edges.filter(e=>e.system===system),start=es.find(e=>e.zone==='UNIT')||es.at(-1),adj=new Map();
   for(const e of es)for(const [a,b] of [[e.source,e.destination],[e.destination,e.source]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push({id:b,edge:e});}
   const roots=new Set([d.roots[system]].flat()),origin=start?.destination,queue=[origin],parent=new Map([[origin,null]]);let end;
   for(let i=0;i<queue.length;i++){const id=queue[i];if(roots.has(id)){end=id;break;}for(const n of adj.get(id)||[])if(!parent.has(n.id)){parent.set(n.id,{from:id,edge:n.edge});queue.push(n.id);}}
   const nodes=[];let id=end;while(id){nodes.push(byId.get(id));id=parent.get(id)?.from;}if(!nodes.length)continue;
   if(sys.get(system).reverse)nodes.reverse();
   const compact=nodes.filter((n,i)=>i===0||i===nodes.length-1||n.type!==nodes[i-1].type).slice(0,9),y=150+row*95;
   content+=text(55,y-18,system+' / '+es.length+' routes',12);
   compact.forEach((n,i)=>{const x=55+i*140;content+='<rect x="'+x+'" y="'+y+'" width="126" height="48" fill="white" stroke="'+color(start)+'"/>'+text(x+5,y+18,n.type,9)+text(x+5,y+34,n.id+' · '+n.building,9);if(i)content+='<path d="M'+(x-14)+','+(y+24)+'h14" fill="none" stroke="'+color(start)+'" marker-end="url(#arrow)"/>';});row++;
  }
  content+=text(55,790,'Representative paths from the actual network graph. Branch counts represent the full system.',12);
 }else{
  const all=edges.flatMap(e=>e.route),xx=all.map(q=>q[0]),yy=all.map(q=>section?-q[2]:q[1]),xmin=xx.reduce((a,b)=>Math.min(a,b),-340),xmax=xx.reduce((a,b)=>Math.max(a,b),340),ymin=section?-d.maxLevel*12-15:yy.reduce((a,b)=>Math.min(a,b),-340),ymax=section?35:yy.reduce((a,b)=>Math.max(a,b),340),k=Math.min(1220/(xmax-xmin),650/(ymax-ymin)),ox=90-xmin*k,oy=120-ymin*k;
  const P=q=>[ox+q[0]*k,oy+(section?-q[2]:q[1])*k],pstr=p=>p.map(q=>q.map(v=>v.toFixed(2)).join(',')).join(' ');
  if(!section)for(const b of d.architecture)content+='<polygon points="'+pstr(b.outer.map(q=>P([...q,0])))+'" fill="none" stroke="#aaa" stroke-width=".6"/><polygon points="'+pstr(b.courtyard.map(q=>P([...q,0])))+'" fill="none" stroke="#bbb" stroke-width=".5"/>';
  const seen=new Set();for(const e of edges){const key=e.system+JSON.stringify(e.route);if(seen.has(key))continue;seen.add(key);content+='<polyline points="'+pstr(e.route.map(P))+'" fill="none" stroke="'+color(e)+'" stroke-width="'+(e.zone==='UNDERGROUND'?1.4:.7)+'" stroke-dasharray="'+dash(e)+'"/>';}
  if(section)for(let l=-1;l<=d.maxLevel;l++){const y=oy-l*12*k;content+='<path d="M60,'+y+'H1340" stroke="#aaa" stroke-width=".4" stroke-dasharray="7 5"/>'+text(1345,y+3,l===-1?'B1':l===d.maxLevel?'ROOF':'L'+(l+1),9);}
  content+=text(55,790,section?'Projected service section / diagram — not a cut-only architectural section.':'Model-coordinate utility diagram — feet. Use architectural sheets for dimensioned plans.',11);
 }
 const shown=[...new Set(edges.map(e=>e.system))];shown.forEach((s,i)=>{const x=55+(i%5)*265,y=835+Math.floor(i/5)*20,e={system:s};legend+='<path d="M'+x+','+y+'h25" stroke="'+color(e)+'" stroke-width="1.2" stroke-dasharray="'+dash(e)+'"/>'+text(x+32,y+4,s.replaceAll('_',' '),9);});
 return '<svg xmlns="http://www.w3.org/2000/svg" width="36in" height="24in" viewBox="0 0 1440 960"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z"/></marker></defs><rect width="1440" height="960" fill="white"/><g font-family="Arial" fill="#111"><rect x="25" y="25" width="1390" height="910" fill="none" stroke="#111"/>'+text(55,65,'MEMO STUDIO / AMERICAN SUPERBLOCK',21)+text(55,95,'MEP-'+String(index+1).padStart(2,'0')+'  '+title.toUpperCase(),17)+content+legend+text(55,922,'SCHEMATIC · NTS · PROVISIONAL SIZING / LOCATIONS · '+d.summary.errors+' BLOCKING CHECKS · '+new Date().toISOString().slice(0,10),10)+'</g></svg>';
}
export function openMEPDrawings(d){
 const w=window.open('','_blank');if(!w)return;
 w.document.write('<!doctype html><html><head><title>MEMO MEP Drawings</title><style>@page{size:36in 24in;margin:0}body{margin:0;background:#e5e5e5;font:14px Arial}header{position:sticky;top:0;padding:15px;background:white;display:flex;gap:10px}main{padding:25px}svg{width:100%;height:auto;background:white}button,select{padding:8px}@media print{header{display:none}main{padding:0}svg{width:36in;height:24in;break-after:page}}</style></head><body><header><select id="sheet"></select><label><input id="bw" type="checkbox" checked>Black / white</label><button id="download">SVG</button><button id="print">Print / PDF</button><button id="all">Full set</button></header><main id="paper"></main></body></html>');w.document.close();
 const $=id=>w.document.getElementById(id);$('sheet').innerHTML=names.map((n,i)=>'<option value="'+i+'">'+n+'</option>').join('');
 const render=()=>$('paper').innerHTML=mepDrawing(d,+$('sheet').value,$('bw').checked);
 $('sheet').onchange=render;$('bw').onchange=render;$('print').onclick=()=>w.print();
 $('all').onclick=()=>{$('paper').innerHTML=names.map((_,i)=>mepDrawing(d,i,$('bw').checked)).join('');w.print();};
 $('download').onclick=()=>{const a=w.document.createElement('a'),u=URL.createObjectURL(new Blob([mepDrawing(d,+$('sheet').value,$('bw').checked)],{type:'image/svg+xml'}));a.href=u;a.download='MEMO-MEP-'+(+$('sheet').value+1)+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};render();
}
