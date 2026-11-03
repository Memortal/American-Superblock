import {serviceBand} from './mep-service-band.js';
import {coordinateMEP} from './mep-coordination.js';
import {supportMEP} from './mep-supported.js';
import {sizeMEP} from './mep-sizing.js';
import {applyHierarchy} from './mep-hierarchy.js';
export const SYSTEMS=[
 ['COLD_WATER','Plumbing',0x2471ce,'pipe',.5,'City water','Fixture',false],
 ['HOT_WATER','Plumbing',0xe15b43,'pipe',.33,'Heat-pump water heater','Fixture',false],
 ['HOT_WATER_RETURN','Plumbing',0xd99145,'pipe',.2,'Heat-pump water heater','Recirculation valve',true],
 ['SANITARY','Plumbing',0x83503b,'pipe',.5,'Municipal sewer','Waste fixture',true],
 ['VENT','Plumbing',0xa89073,'pipe',.25,'Roof vent termination','Vent connection',true],
 ['STORM','Stormwater',0x159da6,'pipe',.5,'Cistern / controlled outfall','Roof drain',true],
 ['SUPPLY_AIR','Mechanical',0x48bce8,'duct',1.5,'Roof DOAS / outdoor intake','Supply diffuser',false],
 ['RETURN_AIR','Mechanical',0x6d8cb1,'duct',1,'Local heat-pump return','Return grille',true],
 ['EXHAUST','Mechanical',0xd09a3a,'duct',.8,'Roof exhaust fan / discharge','Exhaust grille',true],
 ['HEATING_SUPPLY','Mechanical',0xc83b56,'pipe',.33,'Air-to-water heat-pump plant','Fan coil',false],
 ['HEATING_RETURN','Mechanical',0x89386f,'pipe',.33,'Air-to-water heat-pump plant','Fan coil return',true],
 ['COOLING_SUPPLY','Mechanical',0x4375b9,'pipe',.33,'Air-to-water heat-pump plant','Fan coil',false],
 ['COOLING_RETURN','Mechanical',0x566090,'pipe',.33,'Air-to-water heat-pump plant','Fan coil return',true],
 ['NORMAL_POWER','Electrical',0xe3ac18,'tray',.8,'Utility transformer / switchgear','Unit panel',false],
 ['EMERGENCY_POWER','Electrical',0xea6f20,'tray',.5,'Generator / ATS','Emergency light / critical load',false],
 ['FIRE_PROTECTION','Fire protection',0xda3333,'pipe',.5,'Fire service / backflow / pump','Sprinkler head',false],
 ['DATA','Low voltage',0x9561bf,'tray',.35,'Street fiber / MDF','Data outlet / IDF',false],
 ['FIRE_ALARM','Low voltage',0xdd5e9c,'tray',.2,'Fire alarm control panel','Detector / alarm device',false],
 ['IRRIGATION','Stormwater',0x43936e,'pipe',.2,'Cistern reuse pump','Landscape irrigation',false]
].map((a,i)=>({id:a[0],discipline:a[1],color:a[2],shape:a[3],size:a[4],source:a[5],terminal:a[6],reverse:a[7],lane:i}));
export const inside=(q,r)=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>q[1])!==(r[j][1]>q[1])&&q[0]<(r[j][0]-r[i][0])*(q[1]-r[i][1])/(r[j][1]-r[i][1])+r[i][0])yes=!yes;return yes;};
const center=r=>r.reduce((a,q)=>[a[0]+q[0]/r.length,a[1]+q[1]/r.length],[0,0]);
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const atZ=(q,z)=>[q[0],q[1],z];
function near(q,ring){
 let best;
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],d=[b[0]-a[0],b[1]-a[1]],len=Math.hypot(...d),t=Math.max(0,Math.min(1,((q[0]-a[0])*d[0]+(q[1]-a[1])*d[1])/len**2)),p=[a[0]+d[0]*t,a[1]+d[1]*t],dd=dist(q,p);if(!best||dd<best.distance)best={point:p,edge:i,t,distance:dd};}
 return best;
}
function ringRoute(a,b,ring){
 const x=near(a,ring),y=near(b,ring),N=ring.length;
 const walk=dir=>{const pts=[a,x.point];let i=x.edge;
 if(x.edge===y.edge&&(dir===1?x.t<=y.t:x.t>=y.t))return [...pts,y.point,b];
 for(let k=0;k<=N;k++){pts.push(ring[dir===1?(i+1)%N:i]);i=(i+dir+N)%N;if(i===y.edge)break;}
 return [...pts,y.point,b];};
 const l=p=>p.slice(1).reduce((n,q,i)=>n+dist(q,p[i]),0),one=walk(1),two=walk(-1);return l(one)<l(two)?one:two;
}
function servicePoint(p,b,upper=false){
 const poly=upper?p.upperPolygon:(p.groundPolygon||p.designPolygon||p.polygon),c=center(poly),ring=p.kind.startsWith('outer')?b.corridorOuter:b.corridorInner,h=near(c,ring),d=[c[0]-h.point[0],c[1]-h.point[1]],len=Math.hypot(...d)||1;
 for(const t of [3,5,7,9,11]){const q=[h.point[0]+d[0]/len*t,h.point[1]+d[1]/len*t];if(inside(q,poly)&&!(p.designHoles||[]).some(r=>inside(q,r)))return {point:q,anchor:h.point,tangent:[-d[1]/len,d[0]/len]};}
 return {point:c,anchor:h.point,tangent:[-d[1]/len,d[0]/len],review:true};
}
export function generateMEP(model){
 const nodes=[],edges=[],objects=[],issues=[],zones=[],byId=new Map(),nodeByKey=new Map(),roots={};let serial=0;
 const issue=(code,id,detail,severity='review')=>issues.push({code,object:id,detail,severity});
 const node=(key,type,system,point,meta={})=>{
  if(nodeByKey.has(key))return nodeByKey.get(key);
  const n={id:'N'+(++serial),key,type,system,point,building:meta.building||'SITE',level:meta.level??-1,...meta};nodes.push(n);byId.set(n.id,n);nodeByKey.set(key,n);return n;
 };
 const connect=(a,b,s,pts,meta={})=>{
  let route=pts.filter((q,i)=>i===0||dist(q,pts[i-1])>.001);if(route.length<2)return null;
  if(s.reverse){[a,b]=[b,a];route=route.slice().reverse();}
  const e={id:'E'+(++serial),system:s.id,subsystem:meta.subsystem||s.id,discipline:s.discipline,source:a.id,destination:b.id,building:meta.building||b.building,level:meta.level??b.level,zone:meta.zone||'LOCAL',route,shape:s.shape,size:meta.size||s.size,flowDirection:'SOURCE_TO_DESTINATION',serviceType:s.source,provisional:true,...meta};edges.push(e);return e;
 };
 const equip=(n,label,size=[2,2,3],type='EQUIPMENT')=>objects.push({id:'O'+(++serial),type,node:n.id,system:n.system,building:n.building,level:n.level,source:n.id,destination:n.id,size,point:n.point,label,provisional:true});
 const maxLevel=Math.max(...model.buildings.map(b=>b.levels)),plantZ=maxLevel*12+3;
 const angle=model.axes[0]*Math.PI/180,U=[Math.cos(angle),Math.sin(angle)],V=[-U[1],U[0]];
 const world=(x,y,z)=>[x*U[0]+y*V[0],x*U[1]+y*V[1],z],local=q=>[q[0]*U[0]+q[1]*U[1],q[0]*V[0]+q[1]*V[1]];
 const homes=model.pieces.filter(p=>!p.core),buildings=model.buildings.filter(b=>!b.parking);
 // Explicit assumptions survive graph, schedule and geometry exports.
 const assumptions=['Conceptual all-electric four-pipe heat-pump / DOAS strategy; equipment capacities and pipe sizes are placeholders pending loads.','Service-zone reservations and fixture clusters are proposed MEP geometry, not approved interior or structural layouts.','No invented structural beams are used for clearance certification; model clashes and required penetrations are reported.','Kitchen grease exhaust and dryer exhaust require dedicated design; not combined into bathroom exhaust.','Emergency and normal power have separate pathways; generator ventilation and fuel strategy require design.'];
 const contexts=buildings.map(b=>{
  const cores=model.pieces.filter(p=>p.core&&p.building===b.id).sort((a,b)=>b.levels-a.levels),core=cores[0],poly=core.polygon,holes=core.core.holes||[];
  let best=null;const xs=poly.map(q=>q[0]),ys=poly.map(q=>q[1]);
  for(let x=Math.min(...xs)+1;x<Math.max(...xs)-1;x+=1)for(let y=Math.min(...ys)+1;y<Math.max(...ys)-1;y+=1){
   const test=[[x-1,y-1],[x+1,y-1],[x+1,y+1],[x-1,y+1]];
   if(test.every(q=>inside(q,poly)&&!holes.some(h=>inside(q,h)))){const score=Math.min(...holes.map(h=>near([x,y],h).distance),near([x,y],poly).distance);if(!best||score>best.score)best={point:[x,y],score};}
  }
  const shaft=best?.point||center(poly);
  zones.push({id:b.id+'-PRIMARY-SHAFT',building:b.id,type:'CORE_SERVICE_RESERVATION',polygon:poly,exclusions:holes,point:shaft,review:true});
  issue('SHAFT_RESERVATION',b.id,'Core free-space candidate selected outside stair/elevator footprints; bank sizes and access need shaft coordination.');
  const ring=b.corridorOuter.map((q,i)=>[(q[0]+b.corridorInner[i][0])/2,(q[1]+b.corridorInner[i][1])/2]);
  const slots={},allocated=[];
  for(const s of SYSTEMS.slice().sort((a,b)=>b.size-a.size)){
   const radius=s.size*(s.shape==='duct'?.7:.6)+.25,dry=['Electrical','Low voltage'].includes(s.discipline);let choice;
   for(let x=Math.min(...xs)+radius;x<Math.max(...xs)-radius;x+=.5)for(let y=Math.min(...ys)+radius;y<Math.max(...ys)-radius;y+=.5){
    const q=[x,y];if(!inside(q,poly)||near(q,poly).distance<radius||holes.some(h=>inside(q,h)||near(q,h).distance<radius+1))continue;
    if(allocated.some(a=>dist(q,a.q)<radius+a.radius+(a.dry!==dry?1:.15)))continue;
    const score=dist(q,shaft);if(!choice||score<choice.score)choice={q,score};
   }
   if(choice){slots[s.id]=choice.q;allocated.push({q:choice.q,radius,dry});}else{slots[s.id]=shaft;issue('SHAFT_CAPACITY',b.id+'-'+s.id,'Additional shaft reservation required.','error');}
  }
  const roomPoints=[];for(let x=Math.min(...b.outer.map(q=>q[0]))+3;x<Math.max(...b.outer.map(q=>q[0]))-3;x+=6)for(let y=Math.min(...b.outer.map(q=>q[1]))+3;y<Math.max(...b.outer.map(q=>q[1]))-3;y+=6){const q=[x,y];if(inside(q,b.outer)&&!inside(q,b.courtyard)&&near(q,b.outer).distance>3&&near(q,b.courtyard).distance>3)roomPoints.push(q);}
  roomPoints.sort((a,b)=>dist(a,shaft)-dist(b,shaft));const roofPoints=[];for(const q of roomPoints)if(roofPoints.every(a=>dist(a,q)>16)){roofPoints.push(q);if(roofPoints.length===3)break;}
  return {b,core,shaft,slots,roomPoints,roofPoints,ring,units:homes.filter(p=>p.building===b.id)};
 });
 const systems=SYSTEMS.filter(s=>s.id!=='RETURN_AIR');
 for(const s of systems){
  const lane=s.lane,gravity=s.id==='SANITARY'||s.id==='STORM',roof=['SUPPLY_AIR','EXHAUST','VENT','HEATING_SUPPLY','HEATING_RETURN','COOLING_SUPPLY','COOLING_RETURN','HOT_WATER','HOT_WATER_RETURN'].includes(s.id),shift=(lane-9)*1.2;
  const rootPoint=roof?world(-55+(lane%5)*23,-55+Math.floor(lane/5)*25,plantZ):world(-325,(lane-9)*7,gravity?-27:-7+(lane%4)*.7);
  const root=node(s.id+'-ROOT',roof?'PLANT':s.id==='SANITARY'?'SEWER_CONNECTION':s.id==='STORM'?'CISTERN':'UTILITY_CONNECTION',s.id,rootPoint,{label:s.source,level:roof?maxLevel:-1});
  roots[s.id]=root.id;equip(root,s.source,roof?[8,5,5]:[4,3,4]);
  if(s.id==='STORM'){const out=node('STORM-OUTFALL','UTILITY_CONNECTION',s.id,world(-340,shift,-28),{label:'Controlled municipal storm outfall'});connect(out,root,s,[out.point,root.point],{zone:'UNDERGROUND',size:.75});}
  let hub;
  if(roof){hub=node(s.id+'-HUB','BRANCH',s.id,world(shift,shift,-7+(lane%4)*.7));connect(root,hub,s,[root.point,[...rootPoint.slice(0,2),hub.point[2]],hub.point],{zone:'RISER',size:s.size*2,shaft:'CORE-PLANT'});}
  else{hub=node(s.id+'-HUB','BRANCH',s.id,world(shift,shift,gravity?-23.6:rootPoint[2]));connect(root,hub,s,[root.point,hub.point],{zone:'UNDERGROUND',size:s.size*2});}
  for(const ctx of contexts){
   const {b,shaft,ring,units}=ctx,slot=ctx.slots[s.id],loc=local(slot),junction=world(loc[0],shift,gravity?-23.6+Math.abs(loc[0]-shift)*.011:hub.point[2]);
   const serviceZ=gravity?junction[2]+Math.abs(loc[1]-shift)*.011:hub.point[2];
   const service=node(s.id+'-'+b.id+'-SERVICE',s.discipline==='Electrical'?'ELECTRICAL_ROOM':s.id==='DATA'?'IDF':'MECHANICAL_ROOM',s.id,atZ(slot,serviceZ),{building:b.id,label:b.name+' '+s.source});
   const j=node(s.id+'-'+b.id+'-JUNCTION','BRANCH',s.id,junction,{building:b.id});connect(hub,j,s,[hub.point,j.point],{zone:'UNDERGROUND',size:s.size*1.6,building:b.id});connect(j,service,s,[j.point,service.point],{zone:'UNDERGROUND',size:s.size*1.4,building:b.id});
   equip(service,s.id==='COLD_WATER'?'Meter + backflow + booster':s.id==='NORMAL_POWER'?'Main switchgear':s.id==='FIRE_PROTECTION'?'Fire backflow / pump allowance':s.id==='DATA'?'Building IDF':s.source,[2.5,2,3]);
   const equipment=objects.at(-1),roomPoint=ctx.roomPoints[lane]||slot;
   const inlet=node(s.id+'-'+b.id+'-EQUIPMENT','TERMINAL',s.id,atZ(roomPoint,serviceZ),{building:b.id,label:equipment.label});
   connect(service,inlet,s,[service.point,inlet.point],{zone:'UNDERGROUND',building:b.id,size:s.size});equipment.node=inlet.id;equipment.source=service.id;equipment.destination=inlet.id;equipment.point=inlet.point;
   if(s.id==='IRRIGATION'){
    const q=center(b.courtyard),t=node(s.id+'-'+b.id+'-LANDSCAPE','TERMINAL',s.id,atZ(q,.5),{building:b.id,level:0,label:'Courtyard drip irrigation'});connect(service,t,s,[service.point,[q[0],q[1],serviceZ],t.point],{zone:'UNDERGROUND',building:b.id,size:.12});equip(t,'Irrigation valve',[1,1,1]);continue;
   }
   if(gravity){
    for(const p of units){
     const sp=servicePoint(p,b),q=[sp.point[0]+(s.id==='STORM'?.8:s.id==='VENT'?-.8:0),sp.point[1]],d=dist(q,slot),baseZ=gravity?serviceZ+d*.011:-9;
     const base=node(s.id+'-'+p.id+'-BASE','RISER',s.id,atZ(q,baseZ),{building:b.id,label:p.id+' wet stack',unit:p.id,shaft:p.id+'-WET'});
     connect(service,base,s,[service.point,atZ(q,baseZ)],{zone:'UNDERGROUND',building:b.id,size:s.size,unit:p.id});
     const top=s.id==='STORM'?p.levels*12+.15:s.id==='VENT'?p.levels*12+3:Math.max(...p.occupiedLevels)*12+4;
     const riser=node(s.id+'-'+p.id+'-TOP',s.id==='STORM'?'ROOF_DRAIN':'RISER',s.id,atZ(q,top),{building:b.id,level:p.levels,unit:p.id,shaft:p.id+'-WET'});
     connect(base,riser,s,[base.point,riser.point],{zone:'RISER',building:b.id,unit:p.id,shaft:p.id+'-WET'});
     if(s.id==='STORM'||s.id==='VENT'){equip(riser,s.id==='STORM'?'Roof drain + overflow allowance':'Vent terminal',[.7,.7,.4]);continue;}
     for(const l of p.occupiedLevels){
      const z=l*12+1,branch=node(s.id+'-'+p.id+'-'+l,'BRANCH',s.id,atZ(q,z),{building:b.id,level:l,unit:p.id});
      // Insert a connected takeoff into the continuous stack, never a floating branch.
      connect(base,branch,s,[base.point,branch.point],{zone:'RISER',building:b.id,level:l,unit:p.id,shaft:p.id+'-WET',sharedRiser:true});
      for(const [i,name] of ['WC','Basin','Shower','Kitchen sink','Dishwasher','Laundry'].entries()){
       const qf=[q[0]+sp.tangent[0]*(i-2.5)*.65,q[1]+sp.tangent[1]*(i-2.5)*.65],t=node(s.id+'-'+p.id+'-'+l+'-'+i,'FIXTURE',s.id,atZ(qf,z+.3),{building:b.id,level:l,unit:p.id,label:name,provisionalLocation:true});
       connect(branch,t,s,[branch.point,t.point],{building:b.id,level:l,unit:p.id,size:i===0?.33:.17,fixture:name,zone:'UNIT'});equip(t,name,i===0?[1.3,2,1.5]:[1,.8,.6],'FIXTURE');
      }
     }
     zones.push({id:p.id+'-WET',type:'PROPOSED_WET_SHAFT',building:b.id,point:q,unit:p.id,levelRange:[-1,p.levels],size:[2,2],review:true});
    }continue;
   }
   const floorNodes=new Map(),isAir=['SUPPLY_AIR','EXHAUST','VENT'].includes(s.id);
   let riserSource=service;
   if(isAir){
    const plant=node(s.id+'-'+b.id+'-ROOF','PLANT',s.id,atZ(ctx.roofPoints[['SUPPLY_AIR','EXHAUST','VENT'].indexOf(s.id)]||slot,b.levels*12+7),{building:b.id,level:b.levels,label:s.id==='SUPPLY_AIR'?'DOAS + outdoor intake':'High-level exhaust / vent discharge'});
    equip(plant,plant.label,[7,4,4]);riserSource=plant;
    // Outdoor air is a local source; exhaust is a local destination. No underground air duct.
    roots[s.id]=Array.isArray(roots[s.id])?roots[s.id]:[];roots[s.id].push(plant.id);
   }
   let prev=riserSource;
   const levels=Array.from({length:b.levels},(_,l)=>l).filter(l=>l!==3);
   if(isAir)levels.reverse();
   for(const l of levels){
    const z=l*12+8.3+(lane%5)*.48,fn=node(s.id+'-'+b.id+'-L'+l,'FLOOR_MAIN',s.id,atZ(slot,z),{building:b.id,level:l,shaft:b.id+'-PRIMARY-SHAFT'});
    connect(prev,fn,s,[prev.point,atZ(slot,prev.point[2]),fn.point],{zone:'RISER',building:b.id,level:l,shaft:b.id+'-PRIMARY-SHAFT',size:s.size*1.2});prev=fn;floorNodes.set(l,fn);
    if(['NORMAL_POWER','EMERGENCY_POWER','DATA','FIRE_ALARM'].includes(s.id))equip(fn,s.id==='DATA'?'Floor IDF / PoE switch':'Floor distribution panel',[1.5,.5,2]);
    if(s.id==='FIRE_PROTECTION')equip(fn,'Standpipe landing valve',[.7,.7,1]);
   }
   for(const p of units)for(const l of p.occupiedLevels){
    const transfer=l===3,feed=floorNodes.get(transfer?2:l);if(!feed)continue;
    const sp=servicePoint(p,b,l>=p.upperStart),q=sp.point,z=feed.point[2],offset=(lane%4-1.5)*.35;
    const target=[q[0]+sp.tangent[0]*offset,q[1]+sp.tangent[1]*offset];
    const branch=node(s.id+'-'+p.id+'-'+l+'-BRANCH','BRANCH',s.id,atZ(target,z),{building:b.id,level:l,unit:p.id});
    const serviceRing=serviceBand(b,p.kind.startsWith('outer'));
    const route=ringRoute(slot,target,serviceRing).map(q=>atZ(q,z));
    connect(feed,branch,s,route,{zone:transfer?'TRANSFER':'FLOOR',building:b.id,level:transfer?2:l,unit:p.id,size:s.size*.75,serviceZone:'CORRIDOR_SERVICE_BAND',sharedMain:true});
    const tz=transfer?40:l*12+(s.shape==='tray'?6:s.id==='FIRE_PROTECTION'?10.5:8);
    const terminal=node(s.id+'-'+p.id+'-'+l+'-TERMINAL',s.discipline==='Electrical'?'UNIT':'TERMINAL',s.id,[...target,tz],{building:b.id,level:l,unit:p.id,label:s.terminal,provisionalLocation:true});
    connect(branch,terminal,s,[branch.point,terminal.point],{zone:'UNIT',building:b.id,level:l,unit:p.id,size:s.size*.4,shaft:transfer?p.id+'-WET':undefined});
    equip(terminal,s.terminal,s.shape==='duct'?[1.2,.6,.4]:s.id==='FIRE_PROTECTION'?[.2,.2,.15]:[.6,.35,.7],'TERMINAL');
    if(['COLD_WATER','HOT_WATER'].includes(s.id))for(const [i,name] of ['WC','Basin','Shower','Kitchen sink','Dishwasher','Laundry'].entries()){
     if(s.id==='HOT_WATER'&&i===0)continue;
     const t=node(s.id+'-'+p.id+'-'+l+'-FIXTURE-'+i,'FIXTURE',s.id,[q[0]+sp.tangent[0]*(i-2.5)*.65,q[1]+sp.tangent[1]*(i-2.5)*.65,l*12+1.3],{building:b.id,level:l,unit:p.id,label:name,provisionalLocation:true});
     connect(terminal,t,s,[terminal.point,[t.point[0],t.point[1],terminal.point[2]],t.point],{zone:'UNIT',building:b.id,level:l,unit:p.id,size:.06});
    }
    if(s.id==='NORMAL_POWER'){
     for(const [i,label] of ['Light','Outlet','Mechanical equipment circuit'].entries()){const t=node(s.id+'-'+p.id+'-'+l+'-'+i,'TERMINAL',s.id,[target[0]+sp.tangent[0]*(i+1),target[1]+sp.tangent[1]*(i+1),i===0?l*12+10:l*12+1.5],{building:b.id,level:l,unit:p.id,label});connect(terminal,t,s,[terminal.point,[...t.point.slice(0,2),terminal.point[2]],t.point],{zone:'UNIT',building:b.id,level:l,unit:p.id,size:.08});equip(t,label,[.25,.2,.15],'TERMINAL');}
    }
    if(s.id==='SUPPLY_AIR'){
     const local={...SYSTEMS.find(s=>s.id==='RETURN_AIR'),reverse:false},fc=node('RETURN-'+p.id+'-'+l,'TERMINAL','RETURN_AIR',[target[0]+1,target[1],tz],{building:b.id,level:l,unit:p.id,label:'Local return to fan coil'}),grille=node('RETURN-GRILLE-'+p.id+'-'+l,'TERMINAL','RETURN_AIR',[target[0]+1,target[1]+1,tz],{building:b.id,level:l,unit:p.id,label:'Local return grille'});
     roots.RETURN_AIR=roots.RETURN_AIR||[];roots.RETURN_AIR.push(grille.id);connect(grille,fc,local,[grille.point,fc.point],{zone:'UNIT',building:b.id,level:l,unit:p.id,size:.4});equip(fc,'Local recirculation fan coil',[1.5,.75,.6]);
    }
   }
  }
 }
 const parking=model.buildings.find(b=>b.parking);
 if(parking)for(const system of ['FIRE_PROTECTION','NORMAL_POWER','EMERGENCY_POWER','DATA','EXHAUST']){
  const s=SYSTEMS.find(s=>s.id===system),c=parking.outer[0],point=[c[0]*.55,c[1]*.55],isEx=system==='EXHAUST';
  const entry=node(system+'-PARKING','CORE',system,atZ(point,isEx?maxLevel*12+6:-7),{building:'CORE',level:isEx?maxLevel:-1,label:isEx?'Parking exhaust fan':'Parking service entry'});
  if(isEx){roots[system].push(entry.id);equip(entry,'Parking exhaust fan + CO control',[5,4,3]);}else{const hub=nodes.find(n=>n.key===system+'-HUB');connect(hub,entry,s,[hub.point,entry.point],{zone:'UNDERGROUND',building:'CORE',size:s.size});}
  let prev=entry;const levels=[-1,...Array.from({length:maxLevel-3},(_,i)=>i+3)];if(isEx)levels.reverse();
  for(const l of levels){const fn=node(system+'-PARKING-'+l,'FLOOR_MAIN',system,atZ(point,l*12+9),{building:'CORE',level:l});connect(prev,fn,s,[prev.point,fn.point],{zone:'RISER',building:'CORE',level:l,shaft:'PARKING-SERVICE'});prev=fn;
   for(const x of [-45,-15,15,45])for(const y of [-45,-15,15,45]){const q=world(x,y,l*12+9),t=node(system+'-PARKING-'+l+'-'+x+'-'+y,'TERMINAL',system,q,{building:'CORE',level:l,label:'Parking '+s.terminal});connect(fn,t,s,[fn.point,[q[0],fn.point[1],q[2]],q],{zone:'FLOOR',building:'CORE',level:l,size:s.size*.5});equip(t,t.label,[.4,.4,.3],'TERMINAL');}
  }
 }
 for(const o of objects){o.subsystem=o.system;o.flowDirection='SOURCE_TO_DESTINATION';o.serviceType=SYSTEMS.find(s=>s.id===o.system).source;}
 // Remove abandoned city-air placeholders; each DOAS / exhaust system has local roof roots.
 const air=new Set(['SUPPLY_AIR','EXHAUST','VENT']);
 const discarded=new Set(nodes.filter(n=>air.has(n.system)&&(['UTILITY_CONNECTION','MECHANICAL_ROOM'].includes(n.type)||n.key.endsWith('-ROOT')||n.key.endsWith('-HUB')||n.key.endsWith('-JUNCTION')||n.key.endsWith('-EQUIPMENT'))).map(n=>n.id));
 for(let i=edges.length-1;i>=0;i--)if(discarded.has(edges[i].source)||discarded.has(edges[i].destination))edges.splice(i,1);
 for(let i=objects.length-1;i>=0;i--)if(discarded.has(objects[i].node))objects.splice(i,1);
 for(let i=nodes.length-1;i>=0;i--)if(discarded.has(nodes[i].id))nodes.splice(i,1);
 const hierarchy=applyHierarchy({nodes,edges,objects,contexts,systems:SYSTEMS,node,connect,equip,near,ringRoute,atZ,dist,issue,roots,model});
 const support=supportMEP({nodes,edges,objects,contexts,model,hierarchy,systems:SYSTEMS,node,connect,atZ,inside,near,ringRoute,issue});
 const sizing=sizeMEP({nodes,edges,model,roots,systems:SYSTEMS,issue});
 // Model coordination: graph connectivity, slopes, void crossings, and protected core geometry.
 const coordination=coordinateMEP({model,nodes,edges,objects,contexts,ringRoute,issue});
 const live=new Map(nodes.map(n=>[n.id,n])),adj=new Map(nodes.map(n=>[n.id,[]]));
 for(const e of edges){adj.get(e.source)?.push(e.destination);adj.get(e.destination)?.push(e.source);
  for(let i=1;i<e.route.length;i++){
   const a=e.route[i-1],b=e.route[i],horizontal=Math.hypot(a[0]-b[0],a[1]-b[1]);
   if(['SANITARY','STORM'].includes(e.system)&&b[2]>a[2]+.001)issue('UPHILL_GRAVITY',e.id,'Drainage rises in the modeled flow direction.','error');
   if(e.building!=='CORE'&&horizontal>.1&&Math.max(a[2],b[2])>36&&Math.min(a[2],b[2])<48&&!['UNIT','RISER'].includes(e.zone))issue('LEVEL_4_CROSSING',e.id,'Horizontal main enters the open Level 4 band.','error');
   if(e.zone==='RISER'&&e.shaft?.endsWith('PRIMARY-SHAFT')){
    const ctx=contexts.find(c=>c.b.id===e.building),p=[a[0],a[1]];
    if(ctx&&ctx.core.core.holes.some(h=>inside(p,h)))issue('PROTECTED_CORE_CLASH',e.id,'Riser intersects a modeled stair / elevator exclusion.','error');
   }
  }
 }
 const seen=new Set();for(const root of Object.values(roots).flat()){if(!live.has(root))continue;const q=[root];seen.add(root);for(let i=0;i<q.length;i++)for(const next of adj.get(q[i])||[])if(!seen.has(next)){seen.add(next);q.push(next);}}
 for(const n of nodes)if(!seen.has(n.id))issue('DISCONNECTED_NODE',n.id,'Node cannot be traced to a system source or destination.','error');
 // A physical clash check against actual model wall/slab solids; report intentional penetrations separately.
 const architecture=model.elements.filter(e=>!e.space&&(e.wall||e.slab||e.type==='IFCCOLUMN'));
 let penetrationCount=0;
 for(const e of edges.filter(e=>e.zone==='RISER'))for(const a of architecture.filter(a=>a.building===e.building&&a.slab)){
  if(!e.route.length)continue;const lo=Math.min(...e.route.map(q=>q[2])),hi=Math.max(...e.route.map(q=>q[2])),q=e.route[0];
  if(a.parts.some(p=>p.z>lo&&p.z<hi&&inside(q,p.polygon)&&!(p.holes||[]).some(h=>inside(q,h))))penetrationCount++;
 }
 issue('PENETRATION_SCHEDULE','MODEL',penetrationCount+' riser/slab intersections require sleeves, firestopping and structural approval.');
 for(const ctx of contexts)issue('SERVICE_ROOM_ACCESS',ctx.b.id,'Proposed basement equipment node: room enclosure, access aisle and equipment clearances require architectural coordination.');
 issue('TERMINAL_LAYOUT','MODEL','Fixtures, heads, diffusers and outlets occupy proposed entry/wet-wall service zones; quantities are schematic, not a coverage or load calculation.');
 issue('SYSTEM_CLEARANCES','MODEL','Lane separation is preliminary. Cross-system swept-volume clashes and structural beam clearance require a full coordination model.');
 const equipment=objects.filter(o=>o.type==='EQUIPMENT');let overlaps=0;
 for(let i=0;i<equipment.length;i++)for(let j=i+1;j<equipment.length;j++){const a=equipment[i],b=equipment[j];if(a.system!==b.system&&a.point.every((v,k)=>Math.abs(v-b.point[k])<(a.size[k]+b.size[k])/2+.15)){overlaps++;if(overlaps<=100)issue('EQUIPMENT_CLEARANCE',a.id+' / '+b.id,'Equipment envelopes overlap.','error');}}
 issue('FULL_CLASH_SCOPE','MODEL','Core riser footprints and equipment envelopes checked. Full pipe/duct clashes, maintenance access, roof support and structural penetrations require engineering coordination.');
 return {version:'MEMO-MEP-1',units:'feet',hierarchy,sizing,support,coordination,nodes,edges,objects,zones,systems:SYSTEMS,roots,issues,assumptions,summary:{nodes:nodes.length,edges:edges.length,objects:objects.length,penetrations:penetrationCount,errors:issues.filter(i=>i.severity==='error').length},architecture:model.buildings.map(b=>({id:b.id,outer:b.outer,courtyard:b.courtyard,levels:b.levels})),maxLevel};
}
