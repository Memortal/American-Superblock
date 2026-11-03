import {profileAt,loftSection} from './loft-geometry.js';
import {vGridAt,vFields} from './v-applied.js';
import {doorSymbol} from './door-assemblies.js';
import {detailLevel} from './model-controls.js';
import {entranceSheet} from './gereh-drawings.js';
import {envelopeDetailSheet} from './envelope-detail.js';
import {coreRegistry} from './egress-cores.js';
import {gridDimensions} from './grid-dimensions.js';
import {generateStructure} from './structure-engine.js';
import {generateMEP} from './mep-network.js';
import {constructionDetailSheets,constructionSheet} from './construction-details.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number(v.toFixed(3));
const path=rings=>rings.map(r=>'M'+r.map(q=>q.map(n).join(',')).join('L')+'Z').join('');
const line=(x,y,a,b,extra='')=>'<line x1="'+n(x)+'" y1="'+n(y)+'" x2="'+n(a)+'" y2="'+n(b)+'" '+extra+'/>';
const text=(x,y,s,size=12,extra='')=>'<text x="'+n(x)+'" y="'+n(y)+'" font-size="'+size+'" '+extra+'>'+esc(s)+'</text>';
function intervals(poly,holes,u,v,offset){
 const hits=[];
 for(const ring of [poly,...holes])for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],da=a[0]*v[0]+a[1]*v[1]-offset,db=b[0]*v[0]+b[1]*v[1]-offset;
  if((da<=0&&db>0)||(db<=0&&da>0)){const t=da/(da-db);hits.push((a[0]+(b[0]-a[0])*t)*u[0]+(a[1]+(b[1]-a[1])*t)*u[1]);}
 }
 hits.sort((a,b)=>a-b);const out=[];for(let i=0;i+1<hits.length;i+=2)if(hits[i+1]-hits[i]>.001)out.push([hits[i],hits[i+1]]);return out;
}
function elevation(part,q){
 if(!part.elevations)return part.z;
 const [a,b,c]=part.polygon,dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1],det=dx*ey-dy*ex;
 if(Math.abs(det)<1e-8)return part.z;
 const x=q[0]-a[0],y=q[1]-a[1],s=(x*ey-y*ex)/det,t=(dx*y-dy*x)/det;
 return part.z+part.elevations[0]+s*(part.elevations[1]-part.elevations[0])+t*(part.elevations[2]-part.elevations[0]);
}
function clipRamp(poly,p,z){let out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ha=elevation(p,a),hb=elevation(p,b),ina=ha<=z,inb=hb<=z;if(ina)out.push(a);if(ina!==inb){const t=(z-ha)/(hb-ha);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}return out;}
export function mountDocumentation(getModel,catalog={products:[],requirements:[],propertyMap:[],designGaps:[]}){
 if(document.getElementById('docsWorkspace')){document.getElementById('docsWorkspace').hidden=false;window.memoDocumentation?.refresh();return;}
 const style=document.createElement('style');style.textContent=`
 #docsWorkspace{position:fixed;inset:0;z-index:10000;background:#e9e9e7;color:#111;font:13px Arial,sans-serif;display:grid;grid-template:64px 1fr/240px 1fr}#docsWorkspace[hidden]{display:none}
 #docsWorkspace header{grid-column:1/-1;background:#fff;border-bottom:1px solid #bbb;display:flex;align-items:center;padding:0 22px;gap:12px}#docsWorkspace header strong{font-size:18px;margin-right:auto}#docsWorkspace button,#docsWorkspace select,#docsWorkspace input{font:inherit;color:#111;background:white;border:1px solid #aaa;border-radius:3px;padding:8px;cursor:pointer}#docsWorkspace button:hover{background:#eee}#docsWorkspace aside{padding:18px;overflow:auto;background:#fafafa;border-right:1px solid #bbb}#docsWorkspace label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.6px;margin:18px 0 6px}#docsWorkspace select,#docsWorkspace input[type=range]{width:100%;box-sizing:border-box}#docsWorkspace .docsSheets button{display:block;width:100%;text-align:left;margin:4px 0;border:0;background:transparent}#docsWorkspace .docsSheets button.active{background:#111;color:white}#docsWorkspace main{overflow:auto;padding:28px}#docsWorkspace .drawingPaper{background:white;box-shadow:0 3px 18px #0002;min-width:800px}#docsWorkspace .drawingPaper svg{display:block;width:100%;height:auto}#docsWorkspace .docNote{font-size:11px;line-height:1.6;color:#555}#docsWorkspace .docsGroup{margin:18px 0 8px;font-size:10px;color:#536357;letter-spacing:1.2px;border-top:1px solid #c4d0c5;padding-top:12px}#docsWorkspace .docStatus{font-size:11px;margin:10px 0}#docsWorkspace .checkrow{display:flex;align-items:center;gap:7px;text-transform:none;letter-spacing:0}
 @media(max-width:800px){#docsWorkspace{grid-template:100px 1fr/185px 1fr}#docsWorkspace header{flex-wrap:wrap;gap:5px;padding:8px}#docsWorkspace header strong{width:100%;font-size:15px}#docsWorkspace main{padding:10px}}
 `;document.head.append(style);
 const root=document.createElement('div');root.id='docsWorkspace';
 root.innerHTML=`<header><strong>memo studio / Drawing set</strong><button id="docsLegend">Line types</button><button id="docsDetailIndex">Detail index</button><button id="docsDetails">Detail sheets</button><button id="docsRefresh">Refresh model</button><button id="docsSVG">Download SVG</button><button id="docsPrint">Print sheet / PDF</button><button id="docsSet">Print full set</button><button id="docsClose" aria-label="Close drawings">Close ×</button></header><aside><div class="docNote">ARCHITECTURAL STUDY<br>Vector drawings from the current model.</div><label>Drawing scope</label><select id="docsScope"><option value="all">Whole superblock</option><option value="B1">Building A</option><option value="B2">Building B</option><option value="B3">Building C</option><option value="B4">Building D</option><option value="CORE">The Core</option></select><label>Drawing geometry level</label><select id="docsDetailLOD"><option value="200">200 · Plans / basic walls</option><option value="300" selected>300 · Architectural plans + doors</option><option value="350">350 · Interfaces / frames</option><option value="400">400 · Available modeled detail</option></select><p class="docNote">Independent from the main 3D model LOD. Drawings always use this setting.</p><label>Sheet scale</label><select id="docsScale"><option value="auto">Automatic standard scale</option><option value="120">1″ = 10′-0″</option><option value="240">1″ = 20′-0″</option><option value="480">1″ = 40′-0″</option><option value="960">1″ = 80′-0″</option></select><label>Plan cut above floor</label><select id="docsCut"><option value="4">4′-0″</option><option value="5">5′-0″</option><option value="6">6′-0″</option></select><label>Section position <span id="docsOffsetValue">0′</span></label><input id="docsOffset" aria-label="Section offset in feet" type="range" min="-320" max="320" step="1" value="0"><label class="checkrow"><input type="checkbox" id="docsLabels" checked> Space labels</label><label class="checkrow"><input type="checkbox" id="docsDims" checked> Dimensions / levels</label><label class="checkrow"><input type="checkbox" id="docsStructure"> Structure + column grids</label><label>MEP overlay</label><select id="docsMEP"><option value="off">Off</option><option>All systems</option><option>Mechanical</option><option>Plumbing</option><option>Electrical</option><option>Fire protection</option><option>Stormwater</option><option>Low voltage</option></select><label class="checkrow"><input type="checkbox" id="docsMEPColor"> System colors</label><div class="docStatus" id="docsStatus" aria-live="polite"></div><label>Sheet index</label><nav class="docsSheets" id="docsSheets"></nav><p class="docNote">36 × 24 inch sheets. Print at 100% / actual size to preserve scale.<br><br>Plans and sections are model generated. New enlarged construction details are diagrammatic NTS, with VERIFY hold points for dimensions and compliance. Not for construction.</p></aside><main><div class="drawingPaper" id="docsPaper"></div></main>`;
 document.body.append(root);
 const $=id=>root.querySelector('#'+id);let model,parts,sheets,current=0,lastSVG='',mepData=null,structureData=null;
 const settings=()=>({scope:$('docsScope').value,scale:$('docsScale').value,cut:+$('docsCut').value,offset:+$('docsOffset').value,labels:$('docsLabels').checked,structure:$('docsStructure').checked,mep:$('docsMEP').value,mepColor:$('docsMEPColor').checked,dims:$('docsDims').checked,detailLOD:+$('docsDetailLOD').value});
 function refresh(){
  model=getModel();parts=[];mepData=null;structureData=null;if(model.elements.some(e=>e.vSection)){$('docsMEP').value='off';$('docsMEP').disabled=true;$('docsMEP').title='V geometry: MEP routing must be recoordinated';}
  for(const e of model.elements)if((!e.facadeSpace||e.office)&&!e.specPilot)for(const p of e.parts)if(p.polygon?.length>=3)parts.push({e,p,min:p.z+Math.min(0,...(p.elevations||[])),max:p.z+p.height+Math.max(0,...(p.elevations||[]))});
  const max=Math.max(...model.buildings.map(b=>b.levels));
  sheets=[...constructionDetailSheets.filter(s=>s.detailKind==='legend'||s.detailKind==='register'),{id:'A100',title:'SITE / GROUND FLOOR',kind:'plan',level:0},...Array.from({length:max+1},(_,i)=>({id:'A'+(101+i),title:i===0?'BASEMENT / TUNNEL': 'LEVEL '+String(i).padStart(2,'0')+' FLOOR PLAN',kind:'plan',level:i-1})),...['A','B','C','D'].map((s,i)=>({id:'A'+(301+i),title:'SECTION '+s+'–'+s,kind:'section',angle:[0,90,model.axes[0],model.axes[1]][i],letter:s}))];
  if(model.elements.some(e=>e.vSection))for(const [bid,fs]of vFields(model)){const f=[...fs].sort((a,b)=>(b.end-b.start)-(a.end-a.start))[0];if(!f)continue;const candidates=model.pieces.filter(p=>p.building===bid&&p.kind==='outer-wing').map(p=>{const near=p.polygon.filter(q=>Math.abs((q[0]-f.a[0])*f.n[0]+(q[1]-f.a[1])*f.n[1])<.2),ts=near.map(q=>(q[0]-f.a[0])*f.u[0]+(q[1]-f.a[1])*f.u[1]);return {p,t:ts.length>1?Math.min(...ts)*.55+Math.max(...ts)*.45:NaN};}).filter(q=>q.t>f.start+25&&q.t<f.end-25).sort((a,b)=>b.p.levels-a.p.levels);const station=candidates[0]?.t??(f.start+f.end)/2,c=f.a.map((x,i)=>x+f.u[i]*station),v=[-f.n[1],f.n[0]];sheets.push({id:'V30'+bid.slice(1),title:'APPLIED V SECTION — BUILDING '+bid.slice(1),kind:'section',angle:Math.atan2(f.n[1],f.n[0])*180/Math.PI,fixedOffset:c[0]*v[0]+c[1]*v[1],scope:bid,letter:'V'+bid.slice(1)});}
  for(const [i,type] of ['corner','street','valley','court'].entries())sheets.push({id:'A60'+(i+1),title:type.toUpperCase()+' ENTRANCE',kind:'gereh',entranceType:type});
  sheets.push({id:'A501',title:'ENVELOPE / CORNICE DETAIL',kind:'envelope'});sheets.push(...constructionDetailSheets.filter(s=>s.detailKind!=='legend'&&s.detailKind!=='register'));current=Math.min(current,sheets.length-1);$('docsSheets').innerHTML=sheets.map((s,i)=>(i===0||i===2||s.id==='A510'?'<h4 class=\"docsGroup\">'+(i===0?'DRAWING STANDARDS':i===2?'MODEL-GENERATED PLANS / SECTIONS':'ENLARGED CONSTRUCTION DETAILS')+'</h4>':'')+'<button data-sheet=\"'+i+'\">'+s.id+' · '+s.title+'</button>').join('');
  $('docsSheets').querySelectorAll('button').forEach(b=>b.onclick=()=>{current=+b.dataset.sheet;if(sheets[current].scope)$('docsScope').value=sheets[current].scope;render();});render();
 }
 function draw(sheet,opt){
 if(sheet.fixedOffset!==undefined)opt={...opt,offset:sheet.fixedOffset+opt.offset};
  const scoped=parts.filter(({e})=>!e.specPilot&&detailLevel(e)<=opt.detailLOD).filter(({e})=>opt.scope==='all'||e.building===opt.scope),bs=model.buildings.filter(b=>opt.scope==='all'||b.id===opt.scope);
  const bound=opt.scope==='all'?[[-330,-330],[330,330]]:bs.flatMap(b=>b.outer);
  const radians=(sheet.angle||0)*Math.PI/180,u=[Math.cos(radians),Math.sin(radians)],v=[-u[1],u[0]];
  let xmin,xmax,ymin,ymax;
  if(sheet.kind==='plan'){xmin=Math.min(...bound.map(q=>q[0]))-30;xmax=Math.max(...bound.map(q=>q[0]))+30;ymin=Math.min(...bound.map(q=>q[1]))-30;ymax=Math.max(...bound.map(q=>q[1]))+30;}
  else{const xx=bound.map(q=>q[0]*u[0]+q[1]*u[1]);xmin=Math.min(...xx)-25;xmax=Math.max(...xx)+65;ymin=-Math.max(...bs.map(b=>b.levels))*12-20;ymax=30;}
  const frame={x:100,y:130,w:2392,h:1350},needed=Math.max((xmax-xmin)*864/frame.w,(ymax-ymin)*864/frame.h);
  const denom=opt.scale==='auto'?([60,120,240,480,960,1920].find(s=>s>=needed)||3840):+opt.scale,k=864/denom;
  const ox=frame.x+(frame.w-(xmax-xmin)*k)/2-xmin*k,oy=frame.y+(frame.h-(ymax-ymin)*k)/2-ymin*k;
  const P=q=>[ox+q[0]*k,oy+q[1]*k],poly=(rings,fill,width=.5,extra='')=>'<path d="'+path(rings.map(r=>r.map(P)))+'" fill="'+fill+'" fill-rule="evenodd" stroke="#111" stroke-width="'+width+'" '+extra+'/>';
  let fine='',cuts='',labels='',count=0;
  if(sheet.kind==='plan'){
   const floor=sheet.level*12,z=floor+opt.cut;
   if(opt.scope==='all')fine+=poly([[[-330,-330],[330,-330],[330,330],[-330,330]]],'none',1,'stroke-dasharray="12 6"');
   for(const {e,p,min,max} of scoped){
    const intersects=min<z&&max>z,below=max<=z&&max>=floor-1;
    if(e.space){
     if(intersects&&!e.hideMass&&!e.circulation&&opt.labels){const c=p.polygon.reduce((a,q)=>[a[0]+q[0]/p.polygon.length,a[1]+q[1]/p.polygon.length],[0,0]),q=P(c);
      const id=e.piece.id+'-'+e.level;if(!labelled.has(id)){labelled.add(id);labels+=text(q[0],q[1],e.office?'OFFICE':e.piece.core?'SHARED CORE':e.retail?'RETAIL':e.dwellingId?.endsWith('DUPLEX')?'DUPLEX':e.level<3?'TRIPLEX':'HOME',8,'text-anchor="middle"');}
     }continue;
    }
    if(!intersects&&!below)continue;
    const cutProfile=profileAt(p,z),visiblePoly=p.elevations?clipRamp(p.polygon,p,z):cutProfile.polygon;if(visiblePoly.length<3)continue;const rings=[visiblePoly,...(cutProfile.holes||[])];
    if(intersects&&(e.wall||e.type==='IFCWALL'||e.type==='IFCCOLUMN')){cuts+=poly(rings,'#111',.5);count++;}
    else if(intersects||below&&(e.slab||e.type.includes('STAIR')||e.marking||e.ramp||e.parapet)){fine+=poly(rings,'none',e.glazing?.65:.3);count++;}
   }
   if(opt.detailLOD>=200)for(const d of window.memoDoorRegister?.records||[])if(d.level===sheet.level&&(opt.scope==='all'||d.building===opt.scope))labels+=doorSymbol(d,P);
   if(opt.labels)for(const c of coreRegistry(model).filter(c=>(opt.scope==='all'||c.building===opt.scope||opt.scope==='CORE'&&c.parking)&&sheet.level<c.levels)){const q=P(c.position);labels+=text(q[0],q[1]-14,c.label+(sheet.level===0?' · EXIT L1':''),9,'text-anchor="middle"');}
   for(const sec of sheets.filter(s=>s.kind==='section')){
    const a=sec.angle*Math.PI/180,du=[Math.cos(a),Math.sin(a)],dv=[-du[1],du[0]],L=500,center=[dv[0]*(sec.fixedOffset??opt.offset),dv[1]*(sec.fixedOffset??opt.offset)],q1=P([center[0]-du[0]*L,center[1]-du[1]*L]),q2=P([center[0]+du[0]*L,center[1]+du[1]*L]);
    fine+=line(...q1,...q2,'stroke="#555" stroke-width=".6" stroke-dasharray="14 5 2 5"');
    const q=P([center[0]-du[0]*Math.min(310,(xmax-xmin)/2-12),center[1]-du[1]*Math.min(310,(xmax-xmin)/2-12)]);
    labels+=text(q[0],q[1]-7,sec.letter+' / '+sec.id,10,'text-anchor="middle"');
   }
  }else{
   for(const {e,p} of scoped){
    if(p.topPolygon){const rings=loftSection(p,u,v,opt.offset).map(r=>r.map(q=>[q[0],-q[1]]));if(rings.length){if(e.space){if(!e.hideMass)fine+=poly(rings,'none',.25);}else{const solid=e.wall||e.slab||['IFCCOLUMN','IFCBEAM','IFCSTAIRFLIGHT'].includes(e.type);if(solid)cuts+=poly(rings,'#111',.4);else fine+=poly(rings,'none',.35);count++;}}continue;}
    const spans=intervals(p.polygon,p.holes||[],u,v,opt.offset);
    for(const [a,b] of spans){const qa=[u[0]*a+v[0]*opt.offset,u[1]*a+v[1]*opt.offset],qb=[u[0]*b+v[0]*opt.offset,u[1]*b+v[1]*opt.offset],za=elevation(p,qa),zb=elevation(p,qb),ring=[[a,-za],[b,-zb],[b,-zb-p.height],[a,-za-p.height]];
     if(e.space){if(!e.hideMass)fine+=poly([ring],'none',.25);continue;}
     const solid=e.wall||e.slab||e.type==='IFCCOLUMN'||e.type==='IFCSTAIRFLIGHT'||e.type==='IFCRAMPFLIGHT';
     if(solid)cuts+=poly([ring],'#111',.4);else fine+=poly([ring],'none',.35);count++;
    }
   }
   if(opt.dims)for(let l=-1;l<=Math.max(...bs.map(b=>b.levels));l++){
    const a=P([xmin,-l*12]),b=P([xmax,-l*12]);fine+=line(...a,...b,'stroke="#777" stroke-width=".35" stroke-dasharray="12 6"');
    labels+=text(b[0]-5,b[1]-5,(l===-1?'B1':l===0?'L1':l===Math.max(...bs.map(b=>b.levels))?'ROOF':'L'+(l+1))+'  '+l*12+'′-0″',11,'text-anchor="end"');
   }
  }
  if(opt.dims&&sheet.kind==='plan'){
   const lo=Math.min(...bound.map(q=>q[0])),hi=Math.max(...bound.map(q=>q[0])),yy=Math.max(...bound.map(q=>q[1]))+8,a=P([lo,yy]),b=P([hi,yy]);fine+=line(...a,...b,'stroke="#111" stroke-width=".6"');for(const q of [a,b])fine+=line(q[0]-4,q[1]+4,q[0]+4,q[1]-4,'stroke="#111" stroke-width="1"');labels+=text((a[0]+b[0])/2,a[1]-7,(hi-lo).toFixed(1)+'′ OVERALL',11,'text-anchor="middle"');
  }
  if(opt.structure&&structureData&&sheet.kind==='plan')for(const g of vGridAt(model,structureData.grids,sheet.level*12+opt.cut).filter(g=>opt.scope==='all'||g.building===opt.scope))for(const grid of g.lines||[]){const dx=grid.b[0]-grid.a[0],dy=grid.b[1]-grid.a[1],len=Math.hypot(dx,dy)||1,A=P([grid.a[0]-dx/len*6,grid.a[1]-dy/len*6]),B=P([grid.b[0]+dx/len*6,grid.b[1]+dy/len*6]);fine+=line(...A,...B,'data-grid="'+esc(grid.id)+'" stroke="#777" stroke-width=".55" stroke-dasharray="14 4 2 4"');for(const q of [A,B])labels+='<circle cx="'+q[0]+'" cy="'+q[1]+'" r="9" fill="white" stroke="#333" stroke-width=".7"/>'+text(q[0],q[1]+3,grid.label,8,'text-anchor="middle"');}
  if(opt.structure&&opt.dims&&structureData&&sheet.kind==='plan')labels+=gridDimensions(vGridAt(model,structureData.grids,sheet.level*12+opt.cut).filter(g=>opt.scope==='all'||g.building===opt.scope),P);
  let structureCount=0;
  if(opt.structure&&structureData){for(const m of structureData.members){if(m.geometryClearance===false||m.type==='COLUMN'&&m.existing||opt.scope!=='all'&&m.building!==opt.scope||!['BEAM','COLUMN'].includes(m.type)||!m.a||!m.b)continue;
   if(sheet.kind==='plan'&&m.type==='COLUMN'&&!(m.a[2]<sheet.level*12+opt.cut&&m.b[2]>sheet.level*12+opt.cut))continue;
   const a=m.a,b=m.b,va=sheet.kind==='plan'?a[2]:a[0]*v[0]+a[1]*v[1],vb=sheet.kind==='plan'?b[2]:b[0]*v[0]+b[1]*v[1],mn=sheet.kind==='plan'?sheet.level*12:opt.offset-3,mx=sheet.kind==='plan'?(sheet.level+1)*12:opt.offset+3,d=vb-va;let lo=0,hi=1;if(Math.abs(d)<1e-8){if(va<mn||va>mx)continue;}else{lo=Math.max(0,Math.min((mn-va)/d,(mx-va)/d));hi=Math.min(1,Math.max((mn-va)/d,(mx-va)/d));if(lo>hi)continue;}
   const proj=t=>{const q=a.map((x,i)=>x+(b[i]-x)*t);return sheet.kind==='plan'?P(q):P([q[0]*u[0]+q[1]*u[1],-q[2]])},A=proj(lo),B=proj(hi);if(Math.hypot(A[0]-B[0],A[1]-B[1])<.1){const w=Math.max(1.5,(m.width||1.5)*k);labels+='<rect x="'+(A[0]-w/2)+'" y="'+(A[1]-w/2)+'" width="'+w+'" height="'+w+'" fill="#111" stroke="#111" data-structure="'+m.id+'"/>';}else labels+=line(...A,...B,'data-structure="'+m.id+'" stroke="#111" stroke-width="1.0" stroke-dasharray="'+(sheet.kind==='plan'&&m.z>sheet.level*12+opt.cut?'6 3':'')+'"');structureCount++;
  }labels+=text(105,1485,'STRUCTURE + GRIDS: solid supports / dashed grid axes / unresolved members excluded / PRELIMINARY',12);}
  let mepCount=0;
  if(opt.mep!=='off'&&mepData){const sys=new Map(mepData.systems.map(s=>[s.id,s])),seen=new Set();for(const e of mepData.edges){if(e.blocked||e.sharedRiser||opt.scope!=='all'&&e.building!==opt.scope&&e.hostBuilding!==opt.scope||opt.mep!=='All systems'&&e.discipline!==opt.mep)continue;
   for(let i=1;i<e.route.length;i++){let a=e.route[i-1],b=e.route[i];let lo=0,hi=1;const va=sheet.kind==='plan'?a[2]:a[0]*v[0]+a[1]*v[1],vb=sheet.kind==='plan'?b[2]:b[0]*v[0]+b[1]*v[1],mn=sheet.kind==='plan'?sheet.level*12:opt.offset-3,mx=sheet.kind==='plan'?(sheet.level+1)*12:opt.offset+3,d=vb-va;if(Math.abs(d)<1e-8){if(va<mn||va>mx)continue;}else{const t1=(mn-va)/d,t2=(mx-va)/d;lo=Math.max(0,Math.min(t1,t2));hi=Math.min(1,Math.max(t1,t2));if(lo>hi)continue;}const lerp=t=>a.map((x,j)=>x+(b[j]-x)*t),aa=lerp(lo),bb=lerp(hi),proj=q=>sheet.kind==='plan'?P(q):P([q[0]*u[0]+q[1]*u[1],-q[2]]),A=proj(aa),B=proj(bb),key=e.system+JSON.stringify([A,B]);if(seen.has(key))continue;seen.add(key);const system=sys.get(e.system),c=opt.mepColor?'#'+system.color.toString(16).padStart(6,'0'):'#111',dash=opt.mepColor?'':['','6 3','2 2','10 3 2 3'][system.lane%4];const len=Math.hypot(B[0]-A[0],B[1]-A[1]),over=sheet.kind==='plan'&&Math.min(aa[2],bb[2])>sheet.level*12+opt.cut,attr='data-mep="'+esc(e.system)+'" stroke="'+c+'" stroke-width=".8" stroke-dasharray="'+(over?'6 3':dash)+'"';if(len<.1)labels+='<circle cx="'+A[0]+'" cy="'+A[1]+'" r="'+Math.max(1,e.size*k/2)+'" fill="none" '+attr+'/>';else if(sheet.kind==='plan'&&e.shape==='duct'){const nx=-(B[1]-A[1])/len*e.size*k/2,ny=(B[0]-A[0])/len*e.size*k/2;labels+='<path d="M'+[A[0]+nx,A[1]+ny]+'L'+[B[0]+nx,B[1]+ny]+'L'+[B[0]-nx,B[1]-ny]+'L'+[A[0]-nx,A[1]-ny]+'Z" fill="none" '+attr+'/>';}else labels+=line(...A,...B,attr);mepCount++;}
  }labels+=text(105,1505,'MEP: '+opt.mep+' / '+(sheet.kind==='plan'?'floor services; unresolved routes excluded':'6 ft section band')+' / schematic centerlines',12);}
  if(opt.mep!=='off'&&mepData&&sheet.kind==='plan')for(const o of mepData.objects){if(o.blocked||opt.scope!=='all'&&o.building!==opt.scope&&o.hostBuilding!==opt.scope||o.point[2]+o.size[2]/2<sheet.level*12||o.point[2]-o.size[2]/2>=(sheet.level+1)*12)continue;const sys=mepData.systems.find(s=>s.id===o.system);if(opt.mep!=='All systems'&&sys?.discipline!==opt.mep)continue;const [x,y]=o.point,w=o.size[0]/2,d=o.size[1]/2;labels+=poly([[[x-w,y-d],[x+w,y-d],[x+w,y+d],[x-w,y+d]]],'none',.8);}
  const clipped=needed>denom;const stamp=new Date().toISOString().slice(0,10),scope=opt.scope==='all'?'SUPERBLOCK':opt.scope==='CORE'?'THE CORE':'BUILDING '+String.fromCharCode(64+Number(opt.scope.slice(1)));
  const scale='1″ = '+denom/12+'′-0″',bar=40*k;
  return {count,mepCount,structureCount,clipped,svg:'<svg xmlns="http://www.w3.org/2000/svg" width="36in" height="24in" viewBox="0 0 2592 1728" role="img" aria-label="'+esc(sheet.title)+'"><defs><clipPath id="drawingClip"><rect x="72" y="100" width="2448" height="1425"/></clipPath></defs><rect width="2592" height="1728" fill="white"/><g font-family="Arial,Helvetica,sans-serif" fill="#111"><rect x="36" y="36" width="2520" height="1656" fill="none" stroke="#111" stroke-width="2"/>'+text(72,76,'MEMO STUDIO  /  AMERICAN SUPERBLOCK',18)+text(2520,76,(model.elements.some(e=>e.vSection)?'V SECTION APPLIED · ANALYSES PENDING':'SCHEMATIC DESIGN · NOT FOR CONSTRUCTION'),12,'text-anchor="end"')+'<g clip-path="url(#drawingClip)">'+fine+cuts+labels+'</g>'+line(36,1550,2556,1550,'stroke="#111" stroke-width="2"')+line(2020,1550,2020,1692,'stroke="#111"')+text(72,1590,sheet.title,27)+text(72,1620,scope+'  /  '+(sheet.kind==='plan'?'CUT '+opt.cut+'′ ABOVE FLOOR':'CUT OFFSET '+n(opt.offset)+'′ · ANGLE '+n(sheet.angle)+'°'),13)+text(72,1660,'MODEL-GENERATED · '+stamp+' · REV 01 · '+scale,12)+text(2070,1605,sheet.id,38)+text(2070,1636,'36 × 24 INCH',13)+text(2070,1662,'memo studio',20)+text(1200,1590,'660 × 660 FT / AMERICAN SUPERBLOCK',13)+text(1200,1620,'Black: cut walls, slabs and structure. Thin: visible model edges.',11)+text(1200,1640,'Interior layouts and structure are schematic; no invented partitions.',11)+line(1200,1670,1200+bar,1670,'stroke="#111" stroke-width="4"')+text(1200,1660,'0',10)+text(1200+bar,1660,'40 FT',10,'text-anchor="end"')+'</g></svg>'};
 }
 let labelled=new Set();
 function sheetSVG(s,opt){if(s.kind==='construction-detail')return constructionSheet(s,model,catalog,opt);if(s.kind==='gereh')return {svg:entranceSheet(window.memoGerehEntrances||[],s.entranceType,s.fabrication),count:0,mepCount:0,structureCount:0};if(s.kind==='envelope')return {svg:envelopeDetailSheet(window.memoEnvelopeReport),count:0,mepCount:0,structureCount:0};labelled=new Set();return draw(s,opt);}
 function render(){
  const result=sheetSVG(sheets[current],settings());lastSVG=result.svg;$('docsPaper').innerHTML=lastSVG;
  $('docsStatus').textContent=result.detail?'Detail preparation / NTS · model reference: Building '+result.scope+' · manufacturer candidates not approved':result.clipped?'Scale is too large for this scope. Choose Auto to fit.':result.count.toLocaleString()+' architectural parts · '+result.mepCount+' MEP segments · '+result.structureCount+' structural segments'+(mepData?.coordination?' · '+mepData.coordination.blocked+' unresolved MEP routes excluded':'');
  $('docsSheets').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===current));
  $('docsOffsetValue').textContent=$('docsOffset').value+'′';
 }
 async function print(all){
  const w=window.open('','_blank');if(!w){$('docsStatus').textContent='Allow pop-ups to open printable sheets.';return;}
  w.document.write('<!doctype html><html><head><title>MEMO Architectural Set</title><style>@page{size:36in 24in;margin:0}body{margin:0;background:#ddd}.sheet{width:36in;height:24in;background:white;break-after:page;page-break-after:always}.sheet:last-child{break-after:auto}svg{display:block;width:36in;height:24in}.actions{padding:18px;font:16px Arial;background:white}@media print{.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.print()">Print / Save as PDF</button> — 36 × 24 inch paper, actual size, no margins.</div><main id="pages"></main></body></html>');w.document.close();
  const list=all?sheets:[sheets[current]],opt=settings();
  for(let i=0;i<list.length;i++){if(w.closed)break;const el=w.document.createElement('section');el.className='sheet';el.innerHTML=sheetSVG(list[i],opt).svg;w.document.getElementById('pages').append(el);$('docsStatus').textContent='Prepared sheet '+(i+1)+' / '+list.length;await new Promise(r=>setTimeout(r,0));}
  if(!w.closed){w.focus();w.print();}
 }
 const openSheet=id=>{const i=sheets.findIndex(s=>s.id===id);if(i>=0){current=i;render();}}; $('docsLegend').onclick=()=>openSheet('G001');$('docsDetailIndex').onclick=()=>openSheet('G002');$('docsDetails').onclick=()=>openSheet('A510');
 $('docsClose').onclick=()=>root.hidden=true;$('docsRefresh').onclick=async()=>{refresh();await $('docsStructure').onchange();await $('docsMEP').onchange();};
 $('docsSVG').onclick=()=>{const url=URL.createObjectURL(new Blob([lastSVG],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download='MEMO-'+sheets[current].id+'-'+settings().scope+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('docsStructure').onchange=async()=>{if($('docsStructure').checked&&!structureData){$('docsStatus').textContent='Generating structural overlay…';await new Promise(r=>setTimeout(r,30));structureData=generateStructure(model,window.memoStructure?.data?.basis||{});}render();};
 $('docsMEP').onchange=async()=>{if($('docsMEP').value!=='off'&&!mepData){$('docsStatus').textContent='Generating MEP overlay…';await new Promise(r=>setTimeout(r,30));mepData=generateMEP(model);}render();};$('docsMEPColor').onchange=render;
 $('docsPrint').onclick=()=>print(false);$('docsSet').onclick=()=>print(true);
 for(const id of ['docsScope','docsScale','docsCut','docsOffset','docsLabels','docsDims','docsDetailLOD'])$(id).addEventListener('change',render);
 root.addEventListener('keydown',e=>{if(e.key==='Escape')root.hidden=true;});
 window.memoDocumentation={renderSheet:(index,opt={})=>sheetSVG(sheets[index],{...settings(),...opt}),refresh,get mep(){return mepData;},get sheets(){return sheets;},intervals,elevation};
 // Drawing LOD is intentionally independent from the 3D model.
 // Rebuilding the model is handled by the explicit Refresh model control.
 refresh();
}
