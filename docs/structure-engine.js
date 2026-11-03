import {vStructure} from './v-structure.js';
import {donutGrid} from './structural-grid.js';
// MEMO Structural V1. Units: feet, pounds/sf, kips, inches for section calculations.
// Tributary screening model, NOT a plate/frame FEM or a complete code design.
export const BASIS={location:'',code:'2024 IBC / ASCE 7-22 / ACI 318-19 / AISC 360-22 (reference only)',risk:'',siteClass:'',soilKsf:null,groundwater:null,frost:null,windSpeed:null,exposure:'',topography:null,Ss:null,S1:null,SDS:null,SD1:null,SDC:'',snow:null,rain:null,flood:'',tornado:'',netWindPsf:null,Cs:null,seismicK:1,concretePcf:150,fcPsi:5000,fyKsi:60,steelFyKsi:50,finishPsf:15,ceilingPsf:5,mepPsf:10,partitionPsf:15,facadePsf:15,roofPsf:20,equipmentPsf:10,landscapePsf:0,residentialPsf:40,corridorPsf:100,retailPsf:100,parkingPsf:40,stairPsf:100,roofLivePsf:20,terracePsf:100,mechanicalPsf:125,storagePsf:125,assemblyPsf:100,slabThicknessIn:0,maxBayFt:28,target:.85};
export const SOURCES=[{title:'ICC — 2024 structural reference standards',url:'https://shop.iccsafe.org/part-1-an-overview-of-the-structural-changes-to-the-2024-ibc-recording.html'},{title:'ASCE 7-22 — loading standard',url:'https://www.asce.org/publications-and-news/codes-and-standards/asce-sei-7-22/'},{title:'AISC — current standards',url:'https://www.aisc.org/aisc/publications/current-standards/'},{title:'AISC — serviceability guidelines',url:'https://www.aisc.org/media/bcgnjpze/serviceability-guidelines-for-steel-structures.pdf'}];
export const CHECKS=[['Geometry quantities','Calculated from model polygons, openings and thicknesses'],['Gravity reactions','Tributary perimeter approximation; equal end reactions; no live-load reduction'],['Beam sizing','Elastic simple-span demand; rectangular RC flexure screening; shear/detailing pending'],['Columns','Concentric tied-column axial screen only; P–M, slenderness and second order pending'],['Slabs','One-way strip demand and gross elastic deflection only; plate action, punching, PT and long-term deflection pending'],['L4 column continuity','Aligned columns carry upper-floor reactions continuously through L4 to B1; only actual offset/footprint conditions remain unresolved'],['Lateral','Optional prescribed net wind pressure and Cs force distribution; not code hazard derivation'],['Stability / drift','Not solved: needs connected 3D stiffness model, diaphragms and verified lateral system'],['Foundations','Service reaction and optional bearing-area screen; no geotechnical or reinforced footing design'],['MEP','Conservative bounding-box overlap screening; no automatic openings'],['Optimization','Discrete beam/column preliminary section families, not global code-constrained optimization'],['Robustness','Downstream dependency count; alternate-path nonlinear analysis not solved']];
export const SYSTEM_STUDY=[['A · RC flat plate','Shallow floors, repetitive forms','Punching and deflection govern; limited transfer spans','Moderate depth / high mass'],['B · PT concrete','Longer regular bays, reduced slab depth','Tendon paths and anchorage conflict with carvings; specialist design required','Lowest typical concrete depth candidate'],['C · Composite steel','Fast erection, lighter floors, long-span framing','Beam depth, fire protection, vibration and acoustic build-up','Lower dead mass / deeper service band'],['D · Hybrid — selected for study','PT/RC floors, RC cores, local steel/deep RC transfers','Use transfer only at actual discontinuities; verify column-supported L4 and local offsets','Best fit to mixed parking / stepped rings']];
export const area=r=>Math.abs(r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2);
export const netArea=p=>Math.max(0,area(p.polygon)-(p.holes||[]).reduce((s,h)=>s+area(h),0));
export const center=r=>r.reduce((s,q)=>[s[0]+q[0]/r.length,s[1]+q[1]/r.length],[0,0]);
export const inside=(q,r)=>{let b=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>q[1])!==(r[j][1]>q[1])&&q[0]<(r[j][0]-r[i][0])*(q[1]-r[i][1])/(r[j][1]-r[i][1])+r[i][0])b=!b;return b};
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const boundaryDistance=(q,r)=>Math.min(...r.map((a,i)=>{const z=r[(i+1)%r.length],dx=z[0]-a[0],dy=z[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return dist(q,[a[0]+t*dx,a[1]+t*dy]);}));
const inBoundary=(q,r,tol=.01)=>inside(q,r)||boundaryDistance(q,r)<=tol;
export function frameAxes(building){const r=building.outer,a=r[0],z=r[1],d=dist(a,z),u=[(z[0]-a[0])/d,(z[1]-a[1])/d],v=[-u[1],u[0]];return {u,v,local:q=>[q[0]*u[0]+q[1]*u[1],q[0]*v[0]+q[1]*v[1]],world:q=>[q[0]*u[0]+q[1]*v[0],q[0]*u[1]+q[1]*v[1]]};}
const pointIn=(q,p)=>inside(q,p.polygon)&&!(p.holes||[]).some(h=>inside(q,h));
const sum=(a,k)=>a.reduce((s,x)=>s+(+x[k]||0),0);
const demand=(D,L)=>Math.max(1.4*D,1.2*D+1.6*L);
const combo=(D,L)=>1.4*D>1.2*D+1.6*L?'1.4D':'1.2D + 1.6L';
export function beamScreen(span,D,L,basis,depthMin=12){
 const Mu=demand(D,L)*span/8,Vu=demand(D,L)/2,Ec=57000*Math.sqrt(basis.fcPsi)/1000;
 let result;
 for(let h=Math.ceil(depthMin/6)*6;h<=120;h+=6){const b=h>60?30:18,d=h-3,As=.012*b*d,a=As*basis.fyKsi/(.85*basis.fcPsi/1000*b),Mn=.9*As*basis.fyKsi*(d-a/2)/12,I=b*h**3/12,delta=5*((D+L)/(span*12))*(span*12)**4/(384*Ec*.35*I),dcr=Mu/Mn;
 result={span,widthIn:b,depthIn:h,AsIn2:As,Mukipft:Mu,Vukip:Vu,capacityKipft:Mn,dcr,deflectionIn:delta,deflectionLimitIn:span*12/360,section:b+' × '+h+' in RC',governing:combo(D,L),capacityScope:'ASSUMED 1.2% tension steel; flexure only. Shear, anchorage, LTB/PT and connections not verified.',EcKsi:Ec,Iin4:I};if(dcr<=basis.target&&delta<=span*12/360)break;
 }return result;
}
export function generateStructure(model,inputs={}){
 if(model.elements.some(e=>e.vSection))return vStructure(model,{...BASIS,...inputs});
 const b={...BASIS,...inputs},members=[],edges=[],issues=[],supports=new Map(),slabs=[],beams=[],columns=[],foundations=[],transfers=[],walls=[],sourceLoads=[],grids=[];let serial=0;
 const add=(type,o)=>{let x={id:'ST-'+type+'-'+(++serial),type,material:'CONCRETE',status:'REVIEW',code:b.code,capacity:null,dcr:null,designStatus:'PRELIMINARY / NOT CODE VERIFIED',...o};members.push(x);return x;};
 const link=(a,z,D,L)=>edges.push({from:a.id,to:z.id,D,L});
 const issue=(code,ref,message,severity='REVIEW')=>issues.push({code,ref,message,severity});
 const designedGrids=donutGrid(model);
 const bases=model.pieces.filter(p=>!p.core&&p.kind!=='parking');
 const key=(building,q)=>building+'|'+q.map(v=>(Math.round(v*10)/10).toFixed(1)).join('|');
 function support(building,q,kind='PROPOSED',source=null){const k=key(building,q);if(!supports.has(k))supports.set(k,{key:k,building,point:q.slice(),kind,source,loads:[],maxZ:-12});return supports.get(k);}
 // Existing columns are retained exactly. Core support stations are wall centroids, never lift/stair voids.
 for(const e of model.elements){if(e.type!=='IFCCOLUMN'&&!(e.type==='IFCWALL'&&(e.demising||e.piece?.core&&!e.parapet||/parking service tower/.test(e.role))))continue;
  for(const p of e.parts){if(netArea(p)<.05)continue;const c=center(p.polygon);let q=c;if(!pointIn(q,p)){const a=p.polygon[0],z=p.polygon[1];q=[a[0]*.49+z[0]*.49+c[0]*.02,a[1]*.49+z[1]*.49+c[1]*.02];}
   let cornerColumn=null;if(e.type==='IFCWALL'){const cols=model.elements.filter(c=>c.type==='IFCCOLUMN'&&c.building===e.building&&c.level===e.level);cornerColumn=cols.sort((a,b)=>dist(center(a.parts[0].polygon),q)-dist(center(b.parts[0].polygon),q))[0];if(cornerColumn)q=center(cornerColumn.parts[0].polygon);}
   const s=support(e.building,q,e.type==='IFCCOLUMN'||cornerColumn?'EXISTING_COLUMN':'CORE_WALL',cornerColumn?.id||e.id);s.minZ=Math.min(s.minZ??p.z,p.z);s.maxZ=Math.max(s.maxZ,p.z+p.height);s.existingArea=Math.max(s.existingArea||0,cornerColumn?netArea(cornerColumn.parts[0]):netArea(p));
   const w=add(e.type==='IFCCOLUMN'?'EXISTING_COLUMN':'WALL',{building:e.building,level:e.level,polygon:p.polygon,holes:p.holes||[],z:p.z,height:p.height,volume:netArea(p)*p.height,source:e.id,point:[...q,p.z],D:netArea(p)*p.height*b.concretePcf/1000,L:0,supportKey:s.key});walls.push(w);s.loads.push({z:p.z+p.height,D:w.D,L:0,from:w.id});
  }
 }
 for(const e of model.elements.filter(e=>e.stairSupport))for(const p of e.parts){const [a,z]=e.memberEnds;add('BEAM',{building:e.building,level:e.level,a,b:z,z:Math.max(a[2],z[2]),height:e.depth,width:e.width,polygon:p.polygon,source:e.id,material:'STEEL',existing:true,stairSupport:true,role:e.role,status:'REVIEW',D:0,L:0,capacity:null,dcr:null,method:'Geometry-only wall-supported stair member. Connections, loads, deflection, vibration, fire protection and bearing design not solved.'});}
 const actual=[...supports.values()];
 // Architecture footprints govern proposed residential supports. No columns in streets or courtyard holes.
 function legalBase(s,tol=.02){if(s.kind!=='PROPOSED')return true;const g=designedGrids.get(s.building),bb=model.buildings.find(b=>b.id===s.building);if(g?.segments.length&&bb)return inBoundary(s.point,bb.outer,tol)&&(!inside(s.point,bb.courtyard)||boundaryDistance(s.point,bb.courtyard)<=tol);return bases.some(p=>p.building===s.building&&inBoundary(s.point,p.polygon,tol)&&!(p.designHoles||[]).some(h=>inside(s.point,h)&&boundaryDistance(s.point,h)>.02));}
 function nearestActual(building,q){return actual.filter(s=>s.building===building).sort((a,z)=>dist(q,a.point)-dist(q,z.point));}
 // Primary slab inventory: retained openings and actual thickness; paving is soil supported.
 for(const e of model.elements.filter(e=>e.type==='IFCSLAB'||e.type==='IFCRAMPFLIGHT'))for(let pi=0;pi<e.parts.length;pi++){
  const p=e.parts[pi],A=netArea(p);if(A<.1)continue;const role=e.role||'',ground=/paving|entry courtyard|tunnel floor|turning apron/.test(role)||e.level===0&&role==='Floor'&&!e.piece?.core,roof=e.roof&&!e.terrace,terrace=e.terrace||e.cleanTerrace,stairs=/stair|landing|turn/.test(role)||e.type==='IFCRAMPFLIGHT';
  const use=terrace?'terrace':roof?'roof':e.building==='CORE'?'parking':stairs?'stair':e.circulation||e.piece?.core?'corridor':e.retail||e.piece?.retail&&e.level<3?'retail':'residential';
  const t=b.slabThicknessIn>0?b.slabThicknessIn/12:p.height,components={self:A*t*b.concretePcf/1000,finish:A*b.finishPsf/1000,ceiling:roof?0:A*b.ceilingPsf/1000,MEP:roof?0:A*b.mepPsf/1000,partitions:['residential','retail'].includes(use)?A*b.partitionPsf/1000:0,roofBuildUp:roof?A*b.roofPsf/1000:0,equipment:roof?A*b.equipmentPsf/1000:0,landscape:terrace?A*b.landscapePsf/1000:0};
  const D=Object.values(components).reduce((s,v)=>s+v,0),L=A*b[use+'Psf']/1000,z=p.z+(p.elevations?Math.max(...p.elevations):0),sl=add('SLAB',{building:e.building,level:e.level,source:e.id,sourcePart:pi,role,use,polygon:p.polygon,holes:p.holes||[],point:[...center(p.polygon),z],z,height:t,area:A,volume:A*t,D,L,unreducedL:L,reducedL:L,components,ground,roof,governing:combo(D,L),factored:demand(D,L),supports:[],method:'Perimeter-length tributary partition, simple-span edge beams. This is an explicit screening assumption, not a plate analysis.'});slabs.push(sl);sourceLoads.push(sl);
  if(ground){sl.status='SOIL_SUPPORTED';continue;}
  let polygon=p.polygon,segments=[];
  const beam=(aa,bb,Ds,Ls,trib,ns)=>{
   const span=dist(aa,bb);if(span<.05)return;
   let screen=beamScreen(span,Ds,Ls,b),self=0;for(let it=0;it<3;it++){self=screen.widthIn/12*Math.max(0,screen.depthIn/12-t)*span*b.concretePcf/1000;screen=beamScreen(span,Ds+self,Ls,b,screen.depthIn)}
   const bm=add('BEAM',{building:e.building,level:e.level,source:sl.id,a:[...aa,z],b:[...bb,z],z,height:screen.depthIn/12,width:screen.widthIn/12,volume:self*1000/b.concretePcf,selfD:self,D:Ds+self,L:Ls,tributaryArea:trib,tributaryWidth:trib/span,reactions:[{D:(Ds+self)/2,L:Ls/2},{D:(Ds+self)/2,L:Ls/2}],...screen,status:screen.dcr>1||screen.deflectionIn>screen.deflectionLimitIn?'FAIL':'REVIEW',geometryClearance:true,supports:ns.map(s=>s.key)});beams.push(bm);link(sl,bm,Ds,Ls);for(const s of ns){s.maxLoadZ=Math.max(s.maxLoadZ||0,z);s.loads.push({z,D:bm.D/2,L:bm.L/2,from:bm.id});sl.supports.push(s.key)}
  };
  if(e.building==='CORE'&&/parking.deck|parking.roof/.test(role)){
   const frame=frameAxes(model.buildings.find(b=>b.id==='CORE')),stations=actual.filter(s=>s.building==='CORE'&&s.kind==='EXISTING_COLUMN'&&s.maxZ>=z-.8).map(s=>({s,q:frame.local(s.point)}));
   // Both directions use the same rotated parking coordinates. No diagonal nearest-neighbor beams.
   for(let axis=0;axis<2;axis++){const lines=new Map();for(const n of stations){const k=n.q[1-axis].toFixed(2);if(!lines.has(k))lines.set(k,[]);lines.get(k).push(n)}for(const line of lines.values()){line.sort((a,b)=>a.q[axis]-b.q[axis]);for(let j=1;j<line.length;j++){const a=line[j-1].s,c=line[j].s;const clear=Array.from({length:21},(_,i)=>i/20).every(t=>pointIn([a.point[0]+t*(c.point[0]-a.point[0]),a.point[1]+t*(c.point[1]-a.point[1])],p));if(clear)segments.push({aa:a.point,bb:c.point,ns:[a,c]});}}}
   const total=segments.reduce((n,x)=>n+dist(x.aa,x.bb),0);if(total){for(const x of segments){const f=dist(x.aa,x.bb)/total;beam(x.aa,x.bb,D*f,L*f,A*f,x.ns)}sl.method='Rotated parking grid; beams between aligned existing columns, clipped at ramp and service openings. Tributary length allocation; plate action and concentrated vehicle loads not solved.';continue;}
  }
  if(e.piece?.core||e.building==='CORE'){
   const near=nearestActual(e.building,center(polygon)).filter(s=>s.maxZ>=z-.8).slice(0,4);
   if(near.length){near.forEach(s=>{s.loads.push({z,D:D/near.length,L:L/near.length,from:sl.id});sl.supports.push(s.key)});sl.method='Local core / ramp reaction allocation to existing supports; ramp fixity and plate action not solved.';continue;}
  }
  const grid=designedGrids.get(e.building);
  if(grid?.segments.length){
   const candidate=grid.segments.filter(g=>{if(!legalBase({kind:'PROPOSED',building:e.building,point:g.a})||!legalBase({kind:'PROPOSED',building:e.building,point:g.b}))return false;const mid=g.a.map((v,i)=>(v+g.b[i])/2);return inBoundary(mid,p.polygon,.15)&&!(p.holes||[]).some(h=>inside(mid,h));});
   if(candidate.length){const total=candidate.reduce((v,g)=>v+dist(g.a,g.b),0);for(const g of candidate){const f=dist(g.a,g.b)/total;beam(g.a,g.b,D*f,L*f,A*f,[support(e.building,g.a),support(e.building,g.b)]);}sl.method='Three depth bays on demising/exterior grids; length-weighted tributary load allocation.';continue;}
   const near=grid.points.filter(q=>legalBase({kind:'PROPOSED',building:e.building,point:q})).sort((a,b)=>dist(a,center(polygon))-dist(b,center(polygon))).slice(0,4).map(q=>support(e.building,q));
   if(near.length){for(const n of near){n.loads.push({z,D:D/near.length,L:L/near.length,from:sl.id});sl.supports.push(n.key)}sl.method='Local carved slab to nearest architectural grid stations; local slab/cantilever detailing required.';continue;}
  }
  const per=polygon.reduce((a,q,i)=>a+(dist(q,polygon[(i+1)%polygon.length])>=1?dist(q,polygon[(i+1)%polygon.length]):0),0);if(per<1){issue('NO_SUPPORT',sl.id,'Degenerate slab outline','FAIL');continue;}
  for(let i=0;i<polygon.length;i++){
   const qa=polygon[i],qb=polygon[(i+1)%polygon.length],len=dist(qa,qb);if(len<1)continue;
   const divisions=Math.max(1,Math.ceil(len/Math.max(8,b.maxBayFt))),points=Array.from({length:divisions+1},(_,j)=>[qa[0]+(qb[0]-qa[0])*j/divisions,qa[1]+(qb[1]-qa[1])*j/divisions]);
   // Exact facade axes remain constant through setbacks; columns may be exposed below upper slabs.
   for(let j=1;j<points.length;j++){const aa=points[j-1],bb=points[j],fraction=dist(aa,bb)/per,ns=[aa,bb].map(q=>support(e.building,q));beam(aa,bb,D*fraction,L*fraction,A*fraction,ns);}
  }
  const sides=polygon.map((q,i)=>dist(q,polygon[(i+1)%polygon.length])).filter(x=>x>3),span=Math.min(...sides),w=(D+L)/A/12,Ec=57000*Math.sqrt(b.fcPsi)/1000,I=12*(t*12)**3/12;
  sl.strip={spanFt:span,MukipftPerFt:demand(D,L)/A*span**2/8,deflectionIn:5*w*(span*12)**4/(384*Ec*.35*I),note:'1 ft simple-span strip; 0.35 Ig assumption. Punching, reinforcement, two-way action, creep and PT not checked.'};
 }
 // Adjacent slab tributaries share one physical beam on each grid bay.
 const beamGroups=new Map();for(const bm of beams){const k=bm.building+'|'+bm.z.toFixed(3)+'|'+bm.supports.slice().sort().join('~');if(!beamGroups.has(k))beamGroups.set(k,[]);beamGroups.get(k).push(bm);}
 const removed=new Set();for(const group of beamGroups.values()){if(group.length<2)continue;const first=group[0],ids=new Set(group.map(x=>x.id)),Ds=group.reduce((v,x)=>v+x.D-x.selfD,0),Ls=sum(group,'L'),span=first.span;let sc=beamScreen(span,Ds,Ls,b),self=0;for(let i=0;i<3;i++){self=sc.widthIn/12*Math.max(0,sc.depthIn/12-.75)*span*b.concretePcf/1000;sc=beamScreen(span,Ds+self,Ls,b,sc.depthIn)}Object.assign(first,sc,{D:Ds+self,L:Ls,selfD:self,volume:self*1000/b.concretePcf,height:sc.depthIn/12,width:sc.widthIn/12,tributaryArea:sum(group,'tributaryArea'),status:sc.dcr>1||sc.deflectionIn>sc.deflectionLimitIn?'FAIL':'REVIEW',reactions:[{D:(Ds+self)/2,L:Ls/2},{D:(Ds+self)/2,L:Ls/2}]});for(const bm of group.slice(1))removed.add(bm.id);for(const edge of edges)if(ids.has(edge.to))edge.to=first.id;for(const sk of first.supports){const n=supports.get(sk);n.loads=n.loads.filter(x=>!ids.has(x.from));n.loads.push({z:first.z,D:first.D/2,L:Ls/2,from:first.id});}}
 for(let i=members.length-1;i>=0;i--)if(removed.has(members[i].id))members.splice(i,1);for(let i=beams.length-1;i>=0;i--)if(removed.has(beams[i].id))beams.splice(i,1);
 // Nonstructural facade mass, with an explicit assumed areal weight, attached to the supporting floor.
 for(const e of model.elements.filter(e=>e.facade&&!e.frame&&!e.facadeSpace)){
  const load=e.parts.reduce((a,p)=>{const per=p.polygon.reduce((s,q,i)=>s+dist(q,p.polygon[(i+1)%p.polygon.length]),0);return a+per/2*p.height*b.facadePsf/1000},0);if(!load)continue;
  const ss=slabs.filter(s=>s.building===e.building&&s.level===e.level&&s.source.startsWith(e.piece.id+'-'));
  const sl=ss[0];if(!sl)continue;const ns=[...new Set(sl.supports)].map(k=>supports.get(k));const facade=add('LOAD',{source:e.id,D:load,L:0,building:e.building,level:e.level,ground:!ns.length,role:'Facade equivalent area × editable psf'});if(ns.length)for(const s of ns)s.loads.push({z:sl.z,D:load/ns.length,L:0,from:facade.id});sourceLoads.push(facade);
 }
 const unresolved=[];
 for(const s of [...supports.values()].sort((a,b)=>(b.minZ>=35?1:0)-(a.minZ>=35?1:0)||Math.hypot(...a.point)-Math.hypot(...b.point))){
  if(!s.loads.length)continue;
  // L4 is an occupied structural bay: aligned columns continue through the open level.
  // All loads at one XY station accumulate in a single stack down to B1 / foundation.
  const portions=[{loads:s.loads,base:s.building==='CORE'&&s.minZ>=35?36:s.kind==='PROPOSED'?-12:Math.min(-12,s.minZ??0),invalid:s.kind==='PROPOSED'&&!legalBase(s)}];
  for(const part of portions){
   let D=0,L=0,prior=null;const top=Math.max(part.base,...part.loads.map(x=>x.z)),knots=[...new Set([part.base,...part.loads.map(x=>Math.max(part.base,x.z)),...Array.from({length:Math.ceil((top-part.base)/12)},(_,i)=>part.base+i*12)])].sort((a,z)=>z-a);
   const loaded=part.loads.slice(),taken=new Set(),run=[];let lastWidth=0;
   for(let i=0;i<knots.length-1;i++){
    const hi=knots[i],lo=knots[i+1];for(const x of loaded)if(!taken.has(x)&&x.z>=hi-.001){D+=x.D;L+=x.L;taken.add(x)}
    if(hi-lo<.01)continue;let width=s.kind==='EXISTING_COLUMN'?Math.sqrt(s.existingArea)*12:Math.max(18,lastWidth),capacity=0;
    const axial=w=>.65*.8*(.85*b.fcPsi/1000*(w*w*.98)+b.fyKsi*w*w*.02);
    if(s.kind==='PROPOSED')while(width<96&&demand(D+(width/12)**2*(hi-lo)*b.concretePcf/1000,L)>axial(width)*b.target)width+=6;
    capacity=s.kind==='CORE_WALL'?null:axial(width);lastWidth=width;
    const self=s.kind==='PROPOSED'?(width/12)**2*(hi-lo)*b.concretePcf/1000:0;D+=self;
    const c=add('COLUMN',{building:s.building,level:Math.floor(lo/12),a:[...s.point,lo],b:[...s.point,hi],point:[...s.point,lo],height:hi-lo,width:width/12,widthIn:width,section:s.kind==='CORE_WALL'?'Existing core wall support':Math.round(width)+' × '+Math.round(width)+' in',z:lo,volume:self*1000/b.concretePcf,selfD:self,D,L,factored:demand(D,L),capacity,dcr:capacity?demand(D,L)/capacity:null,capacityScope:'Concentric tied-column axial only, 2% longitudinal steel assumption. P–M, buckling, slenderness and second order NOT checked.',governing:combo(D,L),supportKey:s.key,existing:s.kind!=='PROPOSED',status:part.invalid?'FAIL':capacity&&demand(D,L)>capacity?'FAIL':'REVIEW',supports:[],supported:[]});columns.push(c);run.push(c);if(prior)link(prior,c,prior.D,prior.L);
    for(const x of part.loads)if(x.z<=hi+.001&&x.z>lo+.001){edges.push({from:x.from,to:c.id,D:x.D,L:x.L});c.supported.push(x.from)}prior=c;
   }
   // Loads exactly at the base also reach the reaction ledger.
   for(const x of loaded)if(!taken.has(x)){D+=x.D;L+=x.L;taken.add(x)}
   if(s.kind==='PROPOSED'){const w=lastWidth/24;const fits=[[-w,-w],[w,-w],[w,w],[-w,w]].every(d=>legalBase({...s,point:[s.point[0]+d[0],s.point[1]+d[1]]},Math.SQRT2*w+.02));if(!fits){part.invalid=true;run.forEach(c=>{c.status='FAIL';c.geometryClearance=false})}}
   if(s.building==='CORE'&&part.base===36){
    const frame=frameAxes(model.buildings.find(b=>b.id==='CORE')),q=frame.local(s.point),axis=Math.abs(q[0])<.1?0:1;
    const eligible=[...supports.values()].filter(n=>n!==s&&n.building==='CORE'&&n.kind==='EXISTING_COLUMN').map(n=>({n,q:frame.local(n.point)})).filter(n=>Math.abs(n.q[1-axis]-q[1-axis])<.1);
    const left=eligible.filter(n=>n.q[axis]<q[axis]-.1).sort((a,b)=>b.q[axis]-a.q[axis])[0],right=eligible.filter(n=>n.q[axis]>q[axis]+.1).sort((a,b)=>a.q[axis]-b.q[axis])[0];
    if(left&&right){const span=dist(left.n.point,right.n.point),t=dist(left.n.point,s.point)/span;let screen=beamScreen(span,2*D,2*L,b),self=screen.widthIn/12*screen.depthIn/12*span*b.concretePcf/1000;screen=beamScreen(span,2*D+self,2*L,b,screen.depthIn);
     const tr=add('BEAM',{building:'CORE',level:3,a:[...left.n.point,36],b:[...right.n.point,36],z:36,height:screen.depthIn/12,width:screen.widthIn/12,volume:self*1000/b.concretePcf,selfD:self,D:D+self,L,source:prior?.id,transfer:true,classification:'PASSAGE TRANSFER GIRDER',supports:[left.n.key,right.n.key],geometryClearance:true,...screen,status:screen.dcr>1||screen.deflectionIn>screen.deflectionLimitIn?'FAIL':'REVIEW',method:'Upper column point load; conservative center-point flexure envelope, actual lever-arm reactions. Shear, anchorage and transfer deflection require engineering.'});beams.push(tr);if(prior)link(prior,tr,prior.D,prior.L);for(const x of part.loads.filter(x=>x.z<=part.base+.001))edges.push({from:x.from,to:tr.id,D:x.D,L:x.L});for(const [n,f] of [[left.n,1-t],[right.n,t]])n.loads.push({z:36,D:D*f+self/2,L:L*f,from:tr.id});s.runs=[run.map(c=>c.id)];continue;
    }part.invalid=true;issue('PARKING_TRANSFER',s.key,'No aligned transfer bearing pair available','FAIL');
   }
   if(part.invalid){
    const near=actual.filter(a=>(a.building===s.building||a.building==='CORE')&&a.maxZ>=part.base).sort((a,z)=>dist(a.point,s.point)-dist(z.point,s.point)),target=near[0],span=target?dist(s.point,target.point):null;
    const t=add('TRANSFER',{building:s.building,level:-1,point:[...s.point,part.base],a:[...s.point,part.base],b:target?[...target.point,part.base]:null,D,L,factored:demand(D,L),span,classification:'OFFSET / FOOTPRINT CLEARANCE REVIEW',Mukipft:span?demand(D,L)*span:null,Vukip:demand(D,L),status:'UNRESOLVED',source:prior?.id||part.loads[0].from,candidateTarget:target?.source,method:'Nearest-core cantilever demand envelope P×L only. Route, fixity, torsion, shear, stiffness and depth unverified; NOT an accepted member.',capacity:null,dcr:null,governing:combo(D,L)});transfers.push(t);unresolved.push(t);if(prior)link(prior,t,prior.D,prior.L);for(const x of part.loads.filter(x=>x.z<=part.base+.001))edges.push({from:x.from,to:t.id,D:x.D,L:x.L});issue('LOAD_PATH_OPEN',t.id,'Column station or sized envelope does not fit the lower footprint. Verify the offset or supporting grid; L4 itself is not a discontinuity.','FAIL');
   }else{
    const f=add('FOUNDATION',{building:s.building,level:-1,point:[...s.point,-14],a:[...s.point,-16],b:[...s.point,-12],D,L,service:D+L,factored:demand(D,L),bearingArea:b.soilKsf>0?(D+L)/b.soilKsf:null,width:b.soilKsf>0?Math.sqrt((D+L)/b.soilKsf):null,height:2,source:prior?.id||s.source,supportKey:s.key,governing:combo(D,L),status:'REVIEW',method:'Service D+L / allowable bearing. Footing weight, eccentricity, settlement, punching, one-way shear, flexure, sliding and uplift not checked.'});foundations.push(f);if(prior)link(prior,f,prior.D,prior.L);for(const x of part.loads.filter(x=>x.z<=part.base+.001))edges.push({from:x.from,to:f.id,D:x.D,L:x.L});
   }
   s.runs??=[];s.runs.push(run.map(c=>c.id));
  }
 }
 const invalidKeys=new Set(columns.filter(c=>c.geometryClearance===false).map(c=>c.supportKey));for(const bm of beams)if(bm.supports.some(k=>invalidKeys.has(k))){bm.geometryClearance=false;bm.status='FAIL';bm.supportStatus='Unresolved supporting column envelope';}
 // Soil-supported slabs are their own service reaction. Do not double-count them in columns.
 const soilD=sum(sourceLoads.filter(s=>s.ground),'D'),soilL=sum(sourceLoads.filter(s=>s.ground),'L');
 for(const building of model.buildings){
  const load=sourceLoads.filter(x=>x.building===building.id),self=walls.filter(x=>x.building===building.id),stories=[];
  for(let level=0;level<building.levels;level++){const at=load.filter(x=>x.level===level);stories.push({level,z:(level+1)*12,D:sum(at,'D')+sum(self.filter(x=>x.level===level),'D')+sum(beams.filter(x=>x.building===building.id&&x.level===level),'selfD')+sum(columns.filter(x=>x.building===building.id&&x.level===level),'selfD'),L:sum(at,'L')})}
  const xs=building.outer.map(q=>q[0]),ys=building.outer.map(q=>q[1]),W=sum(stories,'D'),V=b.Cs>0?b.Cs*W:null,den=stories.reduce((a,x)=>a+x.D*x.z**b.seismicK,0);
  stories.forEach(x=>{x.Fx=b.netWindPsf>0?b.netWindPsf*(Math.max(...ys)-Math.min(...ys))*12/1000:null;x.Fy=b.netWindPsf>0?b.netWindPsf*(Math.max(...xs)-Math.min(...xs))*12/1000:null;x.E=V!==null?V*x.D*x.z**b.seismicK/den:null});
  for(let i=stories.length-1;i>=0;i--){const a=stories[i],above=stories.slice(i);a.Vx=b.netWindPsf>0?sum(above,'Fx'):null;a.Vy=b.netWindPsf>0?sum(above,'Fy'):null;a.Ve=V!==null?sum(above,'E'):null}
  const frame=frameAxes(building),stations=[...supports.values()].filter(s=>s.building===building.id),local=building.outer.map(frame.local),gridLines=[];
  for(let axis=0;axis<2;axis++){const rows=new Map();for(const s of stations.filter(s=>building.id==='CORE'?s.kind==='EXISTING_COLUMN':s.kind==='PROPOSED'&&!invalidKeys.has(s.key))){const q=frame.local(s.point),k=q[axis].toFixed(2);if(!rows.has(k))rows.set(k,[]);rows.get(k).push(s)}const values=[...rows.entries()].filter(([k,a])=>a.length>=(building.id==='CORE'?2:4)).map(([k])=>+k).sort((a,b)=>a-b);values.forEach((value,i)=>{const a=[],c=[];a[axis]=c[axis]=value;a[1-axis]=Math.min(...local.map(q=>q[1-axis]))-9;c[1-axis]=Math.max(...local.map(q=>q[1-axis]))+9;gridLines.push({id:building.id+'-'+(axis===0?'X':'Y')+(i+1),label:(axis===0?'X':'Y')+(i+1),a:frame.world(a),b:frame.world(c),axis,value});});}
  grids.push({building:building.id,lines:designedGrids.get(building.id)?.lines||gridLines,rotation:Math.atan2(frame.u[1],frame.u[0]),axes:['A','B','C','D'],type:building.parking?'PARKING / CORE':'UNIT-EDGE SECONDARY + CORE PRIMARY',stations:[...supports.values()].filter(s=>s.building===building.id).map((s,i)=>({id:building.id+'-'+(i+1),point:s.point,kind:s.kind})),stories,W,V,windMx:b.netWindPsf>0?stories.reduce((a,x)=>a+x.Fx*x.z,0):null,windMy:b.netWindPsf>0?stories.reduce((a,x)=>a+x.Fy*x.z,0):null,seismicM:V!==null?stories.reduce((a,x)=>a+x.E*x.z,0):null});
 }
 for(const x of sourceLoads.filter(x=>x.ground)){const soil=add('SOIL_REACTION',{building:x.building,level:-1,D:x.D,L:x.L,source:x.id,status:'REVIEW'});link(x,soil,x.D,x.L)}
 const foundationKeys=new Set(foundations.map(f=>f.supportKey)),l4Columns=new Set(columns.filter(c=>!c.existing&&foundationKeys.has(c.supportKey)&&c.a[2]<48&&c.b[2]>36).map(c=>c.supportKey)).size;
 const sourceD=sum(sourceLoads,'D')+sum(walls,'D'),sourceL=sum(sourceLoads,'L'),addedD=sum(beams,'selfD')+sum(columns,'selfD'),reactionD=sum(foundations,'D')+sum(unresolved,'D')+soilD,reactionL=sum(foundations,'L')+sum(unresolved,'L')+soilL;
 issue('ESCAPE_STAIR_DESIGN','MODEL','Stair stringers and landing crossbeams are explicit schematic steel members; their flight live/dead loads, bearing reactions, fire protection, vibration and connections require a dedicated stair design. Landing loads are included; no completed stair strength check is claimed.');
 issue('TRIPLEX_INTERIORS','MODEL','Triplex L2/L3 internal floors are absent in the architecture. Their dead/live load is excluded until layouts and slab geometry exist.');
 issue('STRUCTURAL_BASIS','MODEL','Site hazards, geotechnical conditions and jurisdiction adoption are unverified. All sizes and load allocations are preliminary.');
 issue('GRAVITY_SCOPE','MODEL','Facade psf is applied to approximate face area. Non-core partitions are SDL. Separate equipment weights, all stair/ramp fixities, landscape saturated soil, retaining earth/water pressure and footing self-weight require reconciliation.');
 issue('L4_LATERAL','MODEL','L4 has continuous gravity columns. Its lateral stiffness, column effective lengths, diaphragm collectors, torsion and drift still require 3D analysis.','REVIEW');
 for(const s of slabs.filter(s=>s.building==='CORE'))s.parkingCheck='Uniform loading only; concentrated vehicles, barriers, ramps and clearances require verification';
 return {version:'Structural V1.3 — demising grids and passage transfers',basis:b,sources:SOURCES,checks:CHECKS,systems:SYSTEM_STUDY,members,edges,slabs,beams,columns,walls,foundations,transfers,grids,issues,summary:{l4Columns,supportRule:'CONTINUOUS_COLUMNS_THROUGH_L4',members:members.length,slabs:slabs.length,beams:beams.length,columns:columns.length,transfers:transfers.length,foundations:foundations.length,area:sum(slabs,'area'),concreteFt3:sum(slabs,'volume')+sum(walls,'volume')+sum(beams,'volume')+sum(columns,'volume'),sourceD,sourceL,addedD,reactionD,reactionL,balanceD:sourceD+addedD-reactionD,balanceL:sourceL-reactionL,unresolvedD:sum(unresolved,'D'),unresolvedL:sum(unresolved,'L'),soilD,soilL,failures:members.filter(x=>x.status==='FAIL').length},assumptions:['Level 4 is column-supported. Aligned column stations are continuous from the upper floors through L4 to B1 and foundations; no automatic transfer is introduced at L4.','Perimeter edge load allocation proportional to edge length; equal simply-supported end reactions. Slab plate compatibility not solved.','Donut framing uses four longitudinal lines and three equal depth bays, with transverse axes at demising walls and corner subdivisions. Parking upper columns at passage intersections bear on explicit transfer girders at L4. Egress and full member envelopes still need coordination.','No live-load reduction. Gravity combinations 1.4D and 1.2D+1.6L only; roof/environmental/full ASCE envelopes are not complete.','No ground snow/rain/wind/seismic defaults. Prescribed wind pressure and Cs generate force diagrams only.','Rebar/PT tonnage and total cost not computed without reinforcement/tendon detailing.','Unresolved offset/footprint reactions are held in a separate ledger, never reported as completed foundation load paths.']};
}
export function coordinateStructure(data,mep){
 const boxes=data.members.filter(m=>['BEAM','COLUMN','WALL'].includes(m.type)&&!m.existing).map(m=>{const pts=m.polygon||[m.a,m.b].filter(Boolean);return {m,lo:[Math.min(...pts.map(q=>q[0]))-(m.width||0)/2,Math.min(...pts.map(q=>q[1]))-(m.width||0)/2,m.type==='BEAM'?m.z-m.height:m.z],hi:[Math.max(...pts.map(q=>q[0]))+(m.width||0)/2,Math.max(...pts.map(q=>q[1]))+(m.width||0)/2,m.type==='BEAM'?m.z:m.z+m.height]}}),hits=[];
 const bins=new Map();for(const box of boxes){for(let l=Math.floor(box.lo[2]/12);l<=Math.floor(box.hi[2]/12);l++){const k=box.m.building+'|'+l;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(box)}}
 const seen=new Set();for(const e of mep.edges){if(e.blocked||e.sharedRiser)continue;for(let i=1;i<e.route.length;i++){const a=e.route[i-1],z=e.route[i],pad=(e.size||.1)/2,lo=a.map((x,j)=>Math.min(x,z[j])-pad),hi=a.map((x,j)=>Math.max(x,z[j])+pad);for(let l=Math.floor(lo[2]/12);l<=Math.floor(hi[2]/12);l++)for(const box of bins.get(e.building+'|'+l)||[]){const k=e.id+'|'+box.m.id;if(seen.has(k)||!lo.every((x,j)=>x<=box.hi[j]&&hi[j]>=box.lo[j]))continue;seen.add(k);hits.push({member:box.m.id,route:e.id,system:e.system,openingIn:[(e.size||.1)*12,(e.height||e.size||.1)*12],beamDepthIn:box.m.depthIn??null,distanceFromSupportFt:box.m.a?dist(a,box.m.a):null,status:'ENGINEERING REVIEW',method:'Conservative AABB candidate; not exact solid intersection. No opening cut.'})}}}
 return {candidates:hits,method:'Broad-phase envelope screening only. Primary members cannot be cut without engineering review.'};
}
