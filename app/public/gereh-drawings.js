import {TYPES} from './gereh-engine.js';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function entranceSheet(records,type='corner',fabrication=false){
 const e=records.find(e=>e.id===type)||records.find(e=>e.type===type);if(!e)return '<svg xmlns="http://www.w3.org/2000/svg"/>';
 if(e.placementResolved===false)return '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="300"><rect width="100%" height="100%" fill="white"/><text x="40" y="70" font-size="24">MEMO / '+esc(e.id)+' — RECESSED ENTRANCE UNRESOLVED</text><text x="40" y="120" font-size="16">Existing exit retained. No vestibule modeled: protected core geometry prevents fit.</text></svg>';
 const W=1400,H=960,scale=12,v=e.vestibuleWidth/2,w=e.width/2,d=e.airlockDepth,front=d+e.canopyDepth;
 const tx=x=>320+x*scale,ty=y=>720-y*scale;
 let s='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'"><rect width="100%" height="100%" fill="white"/><style>text{font-family:Arial,sans-serif;fill:#111;font-size:13px}.small{font-size:11px}.title{font-size:27px;font-weight:600}.heavy{stroke:#111;stroke-width:3;fill:none}.thin{stroke:#111;stroke-width:1;fill:none}.dash{stroke:#777;stroke-width:1;stroke-dasharray:6 4;fill:none}</style>';
 const text=(x,y,t,cl='')=>s+='<text x="'+x+'" y="'+y+'" class="'+cl+'">'+esc(t)+'</text>';
 const line=(a,b,cl='thin')=>s+='<path d="M'+a.join(' ')+'L'+b.join(' ')+'" class="'+cl+'"/>';
 const box=(x,y,ww,hh,cl='thin')=>s+='<rect x="'+x+'" y="'+y+'" width="'+ww+'" height="'+hh+'" class="'+cl+'"/>';
 text(45,45,'MEMO STUDIO  /  AMERICAN SUPERBLOCK','title');
 text(45,72,fabrication?'A610 · GEREH FABRICATION + COMPONENT SCHEDULE':'A60'+(TYPES.findIndex(t=>t.key===e.type)+1)+' · '+e.label.toUpperCase()+' ENTRANCE / '+e.id);
 line([45,90],[1355,90]);text(45,112,'RECESSED ENTRANCE · exterior door 3 in behind existing facade · no projecting enclosure');
 if(fabrication){
  text(55,125,'TENFOLD PARENT → BOUNDARY-PRESERVING CHILDREN');
  const cx=300,cy=365,r=210;
  for(const c of e.pattern.cells)s+='<polygon points="'+c.polygon.map(p=>[cx+p[0]*r,cy+p[1]*r].join(',')).join(' ')+'" class="thin"/>';
  text(55,610,e.pattern.cells.length+' flat cells · '+e.pattern.edges.length+' unique shared edges · recursion '+e.recursion);
  text(55,633,'Every child retains a parent ID. Adjacency degree ≤ 2: '+(e.pattern.valid?'PASS':'FAIL'));
  text(55,656,'Fabrication translation of GF60 principles; not a recovered 60-generation source file.');
  const notes=['KIT OF PARTS','01  Warm-white concrete / light stone plinth','02  Straight steel posts and edge beams; bronze finish','03  Flat laser-cut bronze aluminum screen cassettes','04  Opaque lower side walls and translucent clerestories','05  Two independent 42 in nominal self-closing leaves','06  Scraper / absorbent mats and threshold slot drain','07  Polygonal planting pockets, seating and 2700 K LEDs','Panel gaps are schematic. Alloy, gauge, anchors, wind loads,','waterproofing, thermal breaks and shop tolerances remain open.'];
  notes.forEach((n,i)=>text(650,135+i*27,n));
  let y=460;text(650,y,'ENTRANCE / PORTAL / AIRLOCK / PANELS / CORE');y+=25;
  for(const a of records){text(650,y,a.id+'   '+a.width+' ft   '+a.airlockAreaSF+' SF   '+a.panelCount+'   '+a.coreId,'small');y+=20;}
 }else{
  text(55,120,'01  ENLARGED PLAN — FEET');
  box(tx(-v),ty(d),v*2*scale,d*scale,'heavy');
  line([tx(-w),ty(d+.25)],[tx(w),ty(d+.25)],'dash');text(tx(-w),ty(d+.25)-8,'EXISTING FACADE','small');
  box(tx(-w),ty(front+9),w*2*scale,9*scale,'thin');
  for(const yy of [0,d]){
   const off=yy===d?(e.privacy?.outerDoorOffsetFt||0):0;
   line([tx(-v),ty(yy)],[tx(off-2.5),ty(yy)],'heavy');line([tx(off+2.5),ty(yy)],[tx(v),ty(yy)],'heavy');
   line([tx(off-2.5),ty(yy)],[tx(off-2.5),ty(yy+3.5)],'heavy');
   line([tx(off+2.5),ty(yy)],[tx(off+2.5),ty(yy+1.5)],'heavy');
  }
  box(tx(-2.5),ty(d-1),5*scale,(d-2)*scale,'dash');
  text(tx(-v)+8,ty(d/2),'PRIVACY PROTECTED AIRLOCK','small');
  text(tx(-w),ty(front+5),'LANDSCAPE FORECOURT','small');
  text(tx(-w),ty(d+e.canopyDepth/2),'OPEN FORECOURT','small');
  text(tx(-v),ty(0)+25,'EXISTING OPENING → LOBBY → '+e.coreLabel,'small');
  const px=tx(w)+35;
  line([px,ty(0)],[px,ty(d)]);line([px-5,ty(0)],[px+5,ty(0)]);line([px-5,ty(d)],[px+5,ty(d)]);
  text(px+8,ty(d/2),d+' ft');
  line([tx(-w),ty(front+9)-22],[tx(w),ty(front+9)-22]);text(tx(-w)+25,ty(front+9)-30,e.width+' ft architectural portal');
  for(const side of [-1,1]){const x=side*(w+e.planterSize/2+.8),y=front+2;s+='<polygon points="'+[[x-2,y-3],[x+2,y-2],[x+2,y+2],[x,y+3],[x-2,y+1]].map(q=>[tx(q[0]),ty(q[1])].join(',')).join(' ')+'" class="heavy"/>';}
  text(720,125,'02  LONGITUDINAL SECTION — FEET');
  const sx=y=>740+y*11,sy=z=>410-z*11;
  box(sx(0),sy(.75),d*11,.75*11,'heavy');
  box(sx(d),sy(.75),(e.canopyDepth+9)*11,.2*11,'heavy');
  box(sx(0),sy(e.height+.65),d*11,.65*11,'heavy');
  box(sx(0),sy(e.height),d*11,.1*11,'heavy');
  for(const y of [0,d])line([sx(y),sy(.75)],[sx(y),sy(e.height)],'heavy');
  line([sx(d+.25),sy(0)],[sx(d+.25),sy(e.height+3)],'dash');
  text(740,445,'LOBBY  |  RECESSED AIRLOCK  |  OPEN FORECOURT','small');
  const notes=[
   'Portal '+e.width+' ft ≠ door clear width: nominal 42 in leaf / assumed 39 in clear.',
   'Two self-closing door banks; 42 in active + 18 in secondary leaves.',
   'Offset outer door '+(e.privacy?.outerDoorOffsetFt||0)+' ft; lower walls opaque.',
   'Street-facing homes receive planted setback buffers; clearance requires review.',
   'Door-bank spacing '+d+' ft; one open leaf leaves '+(d-3.5)+' ft between banks.',
   'Recessed scraper outside; absorbent walk-off mat inside.',
   'Recessed soffit; no projecting canopy or exterior support posts.',
   'Drainage outfall, thermal specifications and site grades require coordination.',
   'Core connection: '+e.coreId+'; existing exit opening retained.',
   'Architecture overlaps: '+e.conflicts.length+'. '+(e.serviceAudit?'Service envelope candidates: '+e.serviceConflicts.length:'Structure / MEP audit pending.'),
   ...e.issues
  ];
  notes.forEach((n,i)=>{const lines=n.match(/.{1,83}(?:\s|$)|.{1,83}/g)||[n];lines.forEach(t=>text(720,495+(notes.slice(0,i).reduce((v,t)=>v+Math.ceil(t.length/83),0))*22+lines.indexOf(t)*22,t,'small'));});
 }
 line([45,860],[1355,860]);text(45,891,'SCHEMATIC DESIGN · NOT FOR CONSTRUCTION · Dimensions in feet unless noted');
 text(45,916,'Plain entrance assemblies. Gereh ornament disabled. Interface conflicts remain reported.');
 text(1175,916,'MEMO / ENTRANCES');
 return s+'</svg>';
}
export function downloadGereh(name,data,type='text/plain'){
 const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
}

