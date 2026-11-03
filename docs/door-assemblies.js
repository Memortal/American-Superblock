import {classifyUnitEdges} from './facade-opening-rules.js';
import {booleanPolys} from './office-corners.js';
const add=(a,b,k=1)=>a.map((v,i)=>v+b[i]*k),mid=p=>p.reduce((s,q)=>add(s,q,1/p.length),[0,0]);
const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const box=(d,a,b,c,f,z,h)=>({polygon:[[a,c],[b,c],[b,f],[a,f]].map(([x,y])=>add(add(d.center,d.u,x),d.n,y)),z,height:h});
const bounds=p=>[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))];
const inside=(q,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>q[1])!==(r[j][1]>q[1])&&q[0]<(r[j][0]-r[i][0])*(q[1]-r[i][1])/(r[j][1]-r[i][1])+r[i][0])c=!c;return c;};
const overlap=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
export function components(d){
 const w=d.width,h=d.height,z=d.z,f=.125,t=1.75/12,dp=.5,leaves=[],frames=[],hardware=[],seals=[];
 const B=(a,b,c,f,zz,hh)=>box(d,a,b,c,f,zz,hh),count=d.operation==='SLIDING'||w>4.5?2:1;
 for(let i=0;i<count;i++){const a=-w/2+i*w/count+.012,b=-w/2+(i+1)*w/count-.012;
  if(d.glazed){leaves.push(B(a+.15,b-.15,-.025,.025,z+.2,h-.4));frames.push(B(a,a+.15,-t/2,t/2,z,h),B(b-.15,b,-t/2,t/2,z,h),B(a+.15,b-.15,-t/2,t/2,z,.2),B(a+.15,b-.15,-t/2,t/2,z+h-.2,.2));}else leaves.push(B(a,b,-t/2,t/2,z,h));
  const hx=i?b:a,knob=i?a+.25:b-.25;
  if(d.operation!=='SLIDING')for(const zz of [z+.7,z+h/2,z+h-.7])hardware.push(B(hx-.035,hx+.035,t/2,t/2+.07,zz,.25));
  for(const s of [-1,1])hardware.push(B(knob-.2,knob+.08,s*.13-.025,s*.13+.025,z+3.2,.07),B(knob-.04,knob+.04,s*.11-.02,s*.11+.02,z+3,.35));
  if(d.closer)hardware.push(B(a+.2,a+.95,-.2,-.08,z+h-.3,.18));
  if(d.category==='stair'||d.category==='exit')hardware.push(B(a+.3,b-.3,-.25,-.16,z+3.1,.08));
 }
 frames.push(B(-w/2-f,-w/2,-dp/2,dp/2,z,h+f),B(w/2,w/2+f,-dp/2,dp/2,z,h+f),B(-w/2,w/2,-dp/2,dp/2,z+h,f));
 seals.push(B(-w/2-.02,-w/2+.01,.08,.11,z,h),B(w/2-.01,w/2+.02,.08,.11,z,h),B(-w/2,w/2,.08,.11,z+h-.03,.03));
 const spec=[['LEAF','IFCDOOR',leaves,200,d.glazed?0xc3d4d2:0xe3dfd6],['FRAME','IFCMEMBER',frames,300,0x59574f],['THRESHOLD','IFCBUILDINGELEMENTPROXY',[B(-w/2,w/2,-.25,.25,z,.02)],300,0x77756b],['HARDWARE','IFCDISCRETEACCESSORY',hardware,350,0x8d7e67],['SEALS','IFCBUILDINGELEMENTPROXY',seals,350,0x30332f]];
 return spec.map(([suffix,type,parts,lodMin,color])=>({id:d.id+':'+suffix,type,parts,lodMin,color,piece:d.piece,building:d.building,level:d.level,layer:d.level<3?'valley':'upper',role:d.category+' / '+suffix.toLowerCase(),component:true,entry:true,facade:true,alwaysVisible:suffix==='LEAF'||suffix==='FRAME',doorAssembly:d.id,doorComponent:suffix,doorRecord:suffix==='LEAF'?Object.fromEntries(Object.entries(d).filter(([k])=>k!=='piece')):undefined,glazing:suffix==='LEAF'&&d.glazed,frame:suffix==='FRAME',doorWidth:w,doorHeight:h,doubleDoor:count===2,selfClosing:d.closer,operation:d.operation,exitDoor:suffix==='LEAF'&&d.category==='exit',dwellingId:d.unitId}));
}
export function buildDoorAssemblies(model){
 const records=[],issues=[],source=model.elements,byPiece=new Map();
 for(const e of source){const id=e.piece?.id;if(!byPiece.has(id))byPiece.set(id,[]);byPiece.get(id).push(e);}
 const emit=(p,l,cat,q,u,w,h,z,sourceId=null,unit=null,id=null)=>{const d={id:id||'D:'+p.id+':L'+(l+1)+':'+cat,piece:p,building:p.building,level:l,category:cat,center:q,u,n:[-u[1],u[0]],width:w,height:h,z,unitId:unit,sourceElementId:sourceId,operation:cat==='elevator'?'SLIDING':w>4.5?'DOUBLE_DOOR_SINGLE_SWING':'SINGLE_SWING_LEFT',glazed:cat.includes('entrance')||cat==='rear'||cat==='facade',closer:!['rear','facade'].includes(cat),frameMaterial:cat==='elevator'?'Stainless steel':'Dark bronze hollow metal / aluminum',frameFaceIn:1.5,frameDepthIn:6,leafThicknessIn:1.75,fireRating:'TBD — listed assembly required',acousticRating:'TBD',manufacturer:'Unspecified',productModel:'MEMO schematic '+cat,hardwareSet:cat==='stair'?'EG-01':cat==='elevator'?'EL-01':'RE-01',finish:'Warm white / bronze',clearWidthIn:Math.max(0,w/(w>4.5?2:1)*12-1.75),nativeValidated:false,status:'Schematic; clearances and code not certified',openingCuts:0};const ring=l>=p.upperStart?p.upperPolygon:p.groundPolygon;if(ring&&!inside(add(q,d.n,.8),ring))d.n=d.n.map(v=>-v);if(cat==='stair')d.n=p.core.v.map(v=>-v);records.push(d);return d;};
 const used=new Set();
 for(const e of source.filter(e=>e.type==='IFCDOOR')){
  // Legacy valley marker duplicates the newer facade-generated unit entry.
  if(e.id.endsWith('valley-entry')&&(byPiece.get(e.piece?.id)||[]).some(x=>x.id.includes('unit-entry-doors')))continue;
  for(const [i,p]of e.parts.entries()){const edges=p.polygon.map((a,j)=>{const b=p.polygon[(j+1)%p.polygon.length],L=length(a,b);return {L,u:b.map((v,k)=>(v-a[k])/L)};}).sort((a,b)=>b.L-a.L),edge=edges[0];if(!edge||edge.L<1)continue;
   const cat=e.designEntrance?(e.id.includes('outer')?'entrance-outer':'entrance-inner'):e.exitDoor?'exit':e.french?'facade':e.level<3?'front':e.dwellingId?.endsWith('DUPLEX')?'duplex':'apartment',unit=e.dwellingId||(cat==='front'?e.piece.id+'-TRIPLEX':null);
   emit(e.piece,e.level,cat,mid(p.polygon),edge.u,edge.L,p.height,p.z,e.id,unit,'D:'+e.id+':'+i);if(unit)used.add(unit);
  }
 }
 for(const p of model.pieces){
  if(p.core){const at=(x,y)=>add(add(p.core.origin,p.core.u,x),p.core.v,y);for(const l of p.occupiedLevels||Array.from({length:p.levels},(_,i)=>i)){
   const sd=emit(p,l,'stair',at(...(p.core.stairDoorLocal||[6,12.75])),p.core.courtyardDoors?p.core.v:p.core.u,3.75,8,l*12+.75);if(p.core.courtyardDoors){sd.n=p.core.u.slice();sd.egress=true;sd.doorFacing='Courtyard';}
   for(let i=0;i<2;i++){const [x,y]=p.core.liftOrigins?.[i]||[p.core.compact?16:2+i*10,p.core.compact?14+i*10:2];const side=p.core.liftDoorSides?.[i]||1,d=emit(p,l,'elevator',p.core.courtyardDoors?at(x+8.25,y+4):at(x+4,y+(side===-1?-.25:8.25)),p.core.courtyardDoors?p.core.v:p.core.u,3.75,8,l*12+.75,null,null,'D:'+p.id+':L'+(l+1)+':LIFT'+(i+1));d.n=p.core.courtyardDoors?p.core.u.slice():p.core.v.map(v=>v*side);if(p.core.courtyardDoors)d.doorFacing='Courtyard';}
  }continue;}
  if(p.office||p.parking||p.streetDuplex||!p.carve)continue;
  const es=classifyUnitEdges(p,p.groundPolygon||p.polygon),rear=es.find(e=>e.role==='rear'&&e.len>4.5),front=es.find(e=>e.role==='entrance'&&e.len>4.5);
  if(rear){const face=(p.daylightFacades?.[0]||[]).find(f=>(length(f.A,rear.a)<.05&&length(f.B,rear.b)<.05)||(length(f.A,rear.b)<.05&&length(f.B,rear.a)<.05)),a=face?.C||rear.a,b=face?.D||rear.b,L=length(a,b);emit(p,0,'rear',mid([a,b]),b.map((v,i)=>(v-a[i])/L),3.5,8,.75,null,p.id+'-TRIPLEX');}else issues.push({unit:p.id,reason:'Rear entry face unresolved'});
  if(!used.has(p.id+'-TRIPLEX')&&front)emit(p,0,'front',front.mid,front.u,3.5,8,.75,null,p.id+'-TRIPLEX');
 }
 // Cut only affected facade infill, never demising walls or primary structure.
 for(const d of records.filter(d=>['front','rear','apartment','duplex'].includes(d.category))){const cut=box(d,-d.width/2-.125,d.width/2+.125,-.65,.65,d.z,d.height+.125),bb=bounds(cut.polygon),lo=d.z,hi=d.z+d.height+.125;
  for(const e of byPiece.get(d.piece.id)||[]){if(!['IFCWALL','IFCWINDOW','IFCCURTAINWALL','IFCMEMBER'].includes(e.type)||e.structural||e.demising||/party|demising/i.test(e.role||''))continue;e.parts=e.parts.flatMap(p=>{if(p.z>=hi||p.z+p.height<=lo||!overlap(bounds(p.polygon),bb))return[p];const a=Math.max(lo,p.z),b=Math.min(hi,p.z+p.height),out=[];if(a>p.z)out.push({...p,height:a-p.z});for(const r of booleanPolys([[p.polygon,...p.holes||[]]],[[cut.polygon]]))out.push({...p,polygon:r[0],holes:r.slice(1),z:a,height:b-a});if(p.z+p.height>b)out.push({...p,z:b,height:p.z+p.height-b});d.openingCuts++;return out;});}
 }
 const parts=records.flatMap(components);model.elements=source.filter(e=>e.type!=='IFCDOOR');model.elements.push(...parts);return {records,elements:parts,issues,version:2};
}
export function scheduleRows(r){return r.records.map(({piece,...d})=>({...d,pieceId:piece.id,hingeCount:d.operation==='SLIDING'?0:d.width>4.5?6:3,roughWidthIn:d.width*12+3,roughHeightIn:d.height*12+1.5,seal:'Continuous perimeter',threshold:'Flush',closerModel:'Unspecified',lockset:'TBD',accessControl:'TBD',thermalU:'TBD',designStage:'Schematic / not fabrication release'}));}
export function doorSymbol(d,P){const at=(x,y)=>P(add(add(d.center,d.u,x),d.n,y)),n=d.width>4.5?2:1;let s='';for(let i=0;i<n;i++){const w=d.width/n,x=i?d.width/2:-d.width/2,sign=i?-1:1;if(d.operation==='SLIDING'){s+=`<path d="M${at(x,0)}L${at(x+sign*w,0)}"/>`;continue;}s+=`<path d="M${at(x,0)}L${at(x,w)}"/><path d="M${Array.from({length:13},(_,j)=>at(x+sign*w*Math.cos(j*Math.PI/24),w*Math.sin(j*Math.PI/24))).join('L')}"/>`;}return `<g data-door="${d.id}" fill="none" stroke="#333" stroke-width=".55">${s}</g>`;}
