import {context,defaults,generate,valid,gridPath,route,inside,entranceRoute,elements} from './evolution-engine.js';
export const SCHEMA='MEMO-EVOLUTION-2';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),round=n=>Math.round(n*100)/100;
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i])),rect=(x,y,w,d)=>[[x,y],[x+w,y],[x+w,y+d],[x,y+d]];
const profiles=[
 {id:'professional',speed:4,routine:['entry','work','kitchen','living','bedroom','bathroom','entry']},
 {id:'couple',speed:3.6,routine:['entry','kitchen','living','bedroom','bathroom','entry']},
 {id:'family-child',speed:2.8,routine:['entry','living','kitchen','bedroom','bathroom','living','entry']},
 {id:'family-two-children',speed:2.5,routine:['entry','bathroom','kitchen','living','bedroom','entry']},
 {id:'elderly',speed:2.2,routine:['entry','living','bathroom','kitchen','bedroom','entry']},
 {id:'guest',speed:3.5,routine:['entry','living','bathroom','entry']},
 {id:'delivery',speed:3.8,routine:['entry','foyer','entry']},
 {id:'maintenance',speed:3.4,routine:['entry','kitchen','bathroom','entry']},
 {id:'retail-visitor',speed:3.8,routine:['entry','foyer','entry']}
];
export const GENOME={screen:{min:0,max:4,step:.5},furniture:{min:-.5,max:.5,step:.25},foyer:{min:0,max:1,step:.5},partition:{min:-.5,max:.5,step:.25},workspace:{min:0,max:1,step:1},storage:{min:0,max:1,step:1}};
export function resolveContext(model,type='triplex'){
 if(type==='triplex'){const c=context(model);c.typology=type;c.baseLevel=0;c.baseZ=0;return c;}
 // Prefer the highest *actual* apartment space in Building 1; try other upper
 // apartments if a stepped envelope cannot contain the interior kit.
 const candidates=model.elements.filter(e=>e.type==='IFCSPACE'&&e.level>=4&&e.dwellingId?.includes('-APT-'))
   .sort((a,b)=>(a.building==='B1'?0:1)-(b.building==='B1'?0:1)||b.level-a.level||String(a.dwellingId).localeCompare(String(b.dwellingId)));
 if(!candidates.length)throw Error('No actual upper-apartment IFC spaces found above the Level 4 VOID.');
 const rejected=[];
 for(const s of candidates){
  try{
   const p=model.pieces.find(p=>p.id===(s.piece?.id||s.pieceId));
   if(!p?.carve?.u||!s.parts?.[0]?.polygon)throw Error('Source geometry unavailable');
   const poly=s.parts[0].polygon,u=p.carve.u;
   let anchor=null,best=Infinity;
   for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],m=[(a[0]+b[0])/2,(a[1]+b[1])/2],d=dist(m,p.carve.entry);if(dist(a,b)>15&&d<best){best=d;anchor=m;}}
   if(!anchor)throw Error('No supported apartment access edge');
   const n=[-u[1],u[0]];if(!inside([anchor[0]+n[0],anchor[1]+n[1]],poly)){n[0]*=-1;n[1]*=-1;}
   const local=q=>[(q[0]-anchor[0])*u[0]+(q[1]-anchor[1])*u[1],(q[0]-anchor[0])*n[0]+(q[1]-anchor[1])*n[1]],lp=poly.map(local);
   const xmin=Math.min(...lp.map(p=>p[0]))+.7,W=Math.max(...lp.map(p=>p[0]))-.7-xmin;
   const deep=lp.filter(q=>q[1]>5);if(!deep.length)throw Error('Not deep enough');
   const D=Math.min(...deep.map(p=>p[1]))-.7;
   if(W<25||D<17)throw Error('Too small for the apartment interior kit');
   const toWorld=(x,y)=>[anchor[0]+u[0]*(x+xmin)+n[0]*y,anchor[1]+u[1]*(x+xmin)+n[1]*y];
   for(const q of rect(.1,.6,W-.2,D-.6))if(!inside(toWorld(...q),poly))throw Error('Interior kit escapes source envelope');
   const entrance=model.entrances?.find(e=>e.building===p.building)||null;
   return {typology:type,baseLevel:s.level,baseZ:s.level*12,piece:p,id:s.dwellingId,sourcePieceId:p.id,building:p.building,W,D,xmin,toWorld,local,origin:anchor,u,n,doorX:-xmin,entrance,model,sourcePolygon:poly,
    connection:{valid:false,path:[],reason:'Upper apartment interior test only. Gallery, elevator and stair access are unverified; do not infer a direct path to grade.'}};
  }catch(e){rejected.push(s.dwellingId+': '+e.message);}
 }
 throw Error('No upper apartment supports the current interior kit. '+rejected.slice(0,3).join('; '));
}
function metadata(c,g){
 for(const o of g.objects){const center=[o.x+o.w/2,o.y+o.d/2],room=g.rooms.find(r=>r.level===o.level&&inside(center,r.polygon));
  o.roomId=room?.id||null;o.sourceUnitId=c.id;o.material=['partition','toilet','sink','vanity'].includes(o.kind)?'warm-white':['rail','stove','light'].includes(o.kind)?'dark-bronze':o.kind==='sofa'?'muted-fabric':'light-oak';
  o.quantity=1;o.sizeFt=[o.w,o.d,o.h];o.volumeCF=round(o.w*o.d*o.h);o.costBasis='Relative fabrication complexity points; not a priced estimate';o.complexity=['partition','wardrobe','cabinet','shower'].includes(o.kind)?3:1;
 }
 for(const r of g.rooms){r.unitId=c.id;r.material='warm-white / light-oak';r.areaSF=round(Math.abs(r.polygon.reduce((s,a,i)=>{const b=r.polygon[(i+1)%r.polygon.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2));r.adjacency=g.rooms.filter(q=>q.level===r.level&&q.id!==r.id).map(q=>q.id);r.adjacencyStatus='Same-level relationship; doorway graph stored separately';}
 g.typology=c.typology;g.baseLevel=c.baseLevel;return g;
}
export function generateDesign(c,p={}){
 p={...defaults,workspace:0,storage:0,...p};
 if(c.typology==='triplex'){
  const g=generate(c,p),midKinds=new Set(['sofa','coffee-table','rug','media','kitchen-cabinets','sink','stove','fridge','dining-table','chair-0','chair-2.5']);
  const suffix=o=>o.id.slice(g.id.length+1);
  g.objects=g.objects.filter(o=>!['bed-1','bedside-a-1','bedside-b-1','wardrobe-1','bed-front-a-1','bed-front-b-1','bedroom-door-1'].includes(suffix(o)));
  for(const o of g.objects){if(midKinds.has(suffix(o))){o.level=1;o.z+=12;}else if(o.level===1&&!['rail','tread','landing','stringer'].includes(o.kind)&&!o.id.includes('stair')){o.level=0;o.z-=12;}}
  for(const r of g.rooms){if(r.name==='Living room'||r.name==='Kitchen / dining'){r.level=1;r.target[2]=1;}else if(r.level===1){r.level=0;r.target[2]=0;if(r.name.startsWith('Bedroom'))r.name='Guest / work lounge';if(r.name.startsWith('Upper hall'))r.name='Utility / guest hall';}}
  const extra=(key,kind,x,y,w,d,h,level=0)=>g.objects.push({id:g.id+'-'+key,kind,x,y,w,d,z:level*12+.75,h,level});
  extra('guest-sofa','sofa',1,7,3,5,2.5);extra('laundry','cabinet',12,g.D-3,2.5,2.5,3);
  if(p.workspace)extra('work-desk','desk',5,9,4,2,2.5);if(p.storage)extra('extra-storage','cabinet',.7,5.4,3,1,2);
  extra('entry-light','light',g.entry,2,.3,.3,.2);g.objects.at(-1).z=9;g.objects.at(-1).nonBlocking=true;
  g.targets={entry:[g.entry,1.5,0],foyer:[g.entry,3,0],living:[10,10,1],kitchen:[16,g.D-5,1],bedroom:[11,8,2],bathroom:[6,17+p.partition,2],work:[11,9,0]};
  g.obstacles=g.objects.filter(o=>!o.nonBlocking&&!['door','rail','tread','landing','mirror','rug','sink','stove'].includes(o.kind));
  return metadata(c,g);
 }
 const {W,D}=c,id=c.id+'-EV',objects=[],rooms=[],doors=[];
 const add=(key,kind,x,y,w,d,h,extra={})=>{const o={id:id+'-'+key,kind,x,y,w,d,z:.75,h,level:0,...extra};objects.push(o);return o;};
 const room=(key,name,x,y,w,d,target)=>rooms.push({id:id+'-room-'+key,name,level:0,polygon:rect(x,y,w,d),target});
 const door=(key,x,y,w,axis='x')=>{const o=add(key,'door',x,y,axis==='x'?w:.12,axis==='x'?.12:w,8,{axis,nonBlocking:true,clearWidthFt:w});doors.push(o);};
 room('foyer','Foyer / transition',10,.5,7,5,[13,3,0]);room('kitchen','Kitchen / dining',.3,.5,10,7,[8,4.5,0]);
 room('living','Living room',.3,7,16,D-7,[11,12,0]);room('bedroom','Bedroom',17.5,8,W-17.5,D-8,[19,12,0]);room('bath','Bathroom',17.5,.5,W-17.5,7.2,[21,5.5,0]);
 door('entry',c.doorX-1.75,0,3.5);
 add('private-wall-a','partition',17,.5,.35,1.5,9.5);add('private-wall-b','partition',17,5.5,.35,5.5,9.5);add('private-wall-c','partition',17,14.5,.35,D-14.5,9.5);
 add('bed-bath-wall','partition',17.35,7.7,W-17.35,.35,9.5);door('bath-door',17,2,3.5,'y');door('bed-door',17,11,3.5,'y');
 add('bench','bench',11,.6,1.5,1.3,1.5);add('closet','wardrobe',15.5,.7,1,1.8,7);add('shoes','cabinet',4,3.2,1,1.2,1.5);add('mirror','mirror',16.8,1,.08,2,5,{nonBlocking:true});
 add('cabinets','cabinet',.6,.8,8,2,3);add('sink','sink',2,1,2,1.6,3.1,{nonBlocking:true});add('stove','stove',5,1,2,1.6,3.1,{nonBlocking:true});add('fridge','fridge',.7,3.2,2.5,2.5,6.5);
 add('sofa','sofa',1,8+p.furniture,3,5.5,2.7);add('coffee','table',5.5,10+p.furniture,2.5,2,1.4);add('media','console',.7,D-1.5,6,1.2,2);
 add('dining','table',8,6.5,4,3,2.5);for(const [j,x,y] of [[0,8,5.1],[1,10.5,5.1],[2,8,9.7],[3,10.5,9.7]])add('chair-'+j,'chair',x,y,1.1,1.1,2.5);
 add('bed','bed',21,10+p.furniture,5,6.5,2);add('bedside','table',19.2,10,1.3,1.3,1.8);add('wardrobe','wardrobe',18,D-2.3,2,2,7);
 add('toilet','toilet',18.4,.9,1.5,2.4,2);add('shower','shower',W-3.5,.8,3,3,.2);add('vanity','vanity',W-3.5,5,3,1.7,3);
 if(p.screen)add('screen','partition',c.doorX-3,5.5,p.screen,.3,7);
 if(p.workspace)add('desk','desk',12.3,D-2,3.3,1.7,2.5);if(p.storage)add('storage','cabinet',4,3.2,2,1.1,3);
 const g={id,params:p,objects,rooms,doors,floors:[],stairs:[],sx:Infinity,sy:0,W,D,entry:c.doorX,targets:{entry:[c.doorX,3.5,0],foyer:[13,4,0],living:[14,12,0],kitchen:[6.5,4.5,0],bedroom:[19,13,0],bathroom:[21,5.5,0],work:[14,D-3,0]}};
 return metadata(c,g);
}
const navCache=new Map();
function analyzeLayout(c,g){
 const key=JSON.stringify([SCHEMA,c.id,c.W,c.D,g.params]);if(navCache.has(key))return {...navCache.get(key),cached:true};
 const t=performance.now(),memo=new Map(),errors=[...valid(g).errors],routines=[];
 for(const p of profiles){let path=[],complete=true,length=0;for(let j=1;j<p.routine.length;j++){const a=p.routine[j-1],b=p.routine[j],k=a+'>'+b;if(!memo.has(k))memo.set(k,route(g,g.targets[a],g.targets[b]));const seg=memo.get(k);if(!seg){complete=false;errors.push('Blocked '+k);continue;}length+=seg.slice(1).reduce((s,q,i)=>s+dist(q,seg[i]),0);path.push(...seg);}routines.push({profile:p.id,path,complete,lengthFt:round(length),speed:p.speed});}
 const privacyMap=[];for(let x=5;x<=12;x+=1)for(let y=7;y<=12;y+=1){let hidden=false;for(let t=0;t<=1;t+=.025){const q=[g.entry+(x-g.entry)*t,1+(y-1)*t];if(g.objects.some(o=>o.kind==='partition'&&o.level===0&&q[0]>=o.x&&q[0]<=o.x+o.w&&q[1]>=o.y&&q[1]<=o.y+o.d)){hidden=true;break;}}privacyMap.push({x,y,exposed:!hidden});}
 const privacy=round(100*privacyMap.filter(p=>!p.exposed).length/privacyMap.length),walkingFt=round(routines.reduce((s,r)=>s+r.lengthFt,0)/routines.length),circulation=round(100*routines.filter(r=>r.complete).length/routines.length);
 const complexity=g.objects.reduce((s,o)=>s+o.complexity,0),volumeCF=round(g.objects.reduce((s,o)=>s+o.volumeCF,0)),daylight=round(100*Math.max(0,1-g.objects.filter(o=>o.h>5&&o.y>g.D-4).reduce((s,o)=>s+o.w,0)/g.W));
 const groundAccessible=!!gridPath(g,g.targets.entry,g.targets.foyer,1.5),score=round(.32*privacy+.4*circulation+.12*daylight+.08*(groundAccessible?100:0)+.08*(g.params.workspace?100:50)-walkingFt*.025-complexity*.025);
 const navigationGraph={nodes:Object.entries(g.targets).map(([id,point])=>({id:c.id+'-nav-'+id,name:id,point})),edges:[...memo].map(([key,path])=>{const [from,to]=key.split('>');return {from:c.id+'-nav-'+from,to:c.id+'-nav-'+to,connected:!!path,lengthFt:path?round(path.slice(1).reduce((s,q,i)=>s+dist(q,path[i]),0)):null};})};
 const result={navigationGraph,valid:errors.length===0,errors:[...new Set(errors)],routines,privacyMap,privacy,walkingFt,circulation,complexity,volumeCF,daylight,accessibleGround:groundAccessible,upperAccessible:c.typology==='apartment'?null:false,score,ms:round(performance.now()-t),cached:false};
 if(navCache.size>=300)navCache.delete(navCache.keys().next().value);navCache.set(key,result);return result;
}
export function simulatePopulation(c,g,{agents=100}={}){
 agents=clamp(Math.round(agents),100,500);const a=analyzeLayout(c,g),list=[],occupancy=new Map();let queued=0,maxQueue=0,nextService=0;
 // Scheduled scenario population: a two-hour arrival test, not a claim that
 // 100 people inhabit this one prototype home.
 for(let i=0;i<agents;i++){
  const r=a.routines[i%profiles.length],start=i*6+(i%4),service=4+(i%profiles.length===6?8:0),wait=Math.max(0,nextService-start);nextService=Math.max(start,nextService)+service;queued+=wait;maxQueue=Math.max(maxQueue,Math.ceil(wait/service));
  const agent={id:c.id+'-agent-'+String(i+1).padStart(3,'0'),type:r.profile,routine:i%profiles.length,path:r.path,startSecond:start+wait,speed:r.speed,lengthFt:r.lengthFt,completed:r.complete,queueSeconds:wait};list.push(agent);
  // Occupancy samples are aggregated; geometry is never regenerated per agent.
  for(let j=0;j<r.path.length;j+=5){const p=r.path[j],time=Math.floor((agent.startSecond+j*.5/r.speed)/5),k=[Math.floor(p[0]/3),Math.floor(p[1]/3),Math.floor(p[2]/12),time].join(':');occupancy.set(k,(occupancy.get(k)||0)+1);}
 }
 return {...a,agents:list,agentCount:agents,profileCount:profiles.length,steps:list.reduce((s,a)=>s+a.path.length,0),meanQueueSeconds:round(queued/agents),maxQueue,peakCellOccupancy:Math.max(0,...occupancy.values()),congestionSamples:[...occupancy.values()].filter(v=>v>2).length,
  scope:'Interior scenario population. Queue uses one service point; occupancy is sampled, not crowd dynamics.',entranceConnected:c.connection?.valid===true,thermalProxy:null,acousticProxy:null,emergencyCertified:false};
}
const dominates=(a,b)=>a.privacy>=b.privacy&&a.walkingFt<=b.walkingFt&&a.complexity<=b.complexity&&(a.privacy>b.privacy||a.walkingFt<b.walkingFt||a.complexity<b.complexity);
export async function evolvePopulation(c,baseline={},options={},onGeneration=()=>{}){
 const generations=clamp(options.generations||20,20,50),count=clamp(options.agents||100,100,500);let seed=options.seed||20261026;
 const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 let first={geometry:generateDesign(c,baseline),generation:0,index:0};first.result=analyzeLayout(c,first.geometry);
 let population=[first],archive=[first],history=[first],rejected=0,completed=0;
 for(let gen=1;gen<=generations;gen++){
  if(options.signal?.aborted)break;
  const batch=[];for(let i=0;i<6;i++){
   const a=population[Math.floor(rng()*population.length)],b=population[Math.floor(rng()*population.length)],params={...baseline};
   for(const [k,v] of Object.entries(GENOME)){const base=rng()<.5?a.geometry.params[k]:b.geometry.params[k];params[k]=rng()<.65?Math.round((v.min+rng()*(v.max-v.min))/v.step)*v.step:base;params[k]=clamp(params[k]??v.min,v.min,v.max);}
   const geometry=generateDesign(c,params),result=analyzeLayout(c,geometry),candidate={geometry,result,generation:gen,index:i};completed++;if(result.valid)batch.push(candidate);else rejected++;
  }
  const unique=new Map([...population,...batch].map(x=>[JSON.stringify(x.geometry.params),x]));population=[...unique.values()].filter(x=>x.result.valid).sort((a,b)=>b.result.score-a.result.score).slice(0,6);
  if(!population.length)population=[first];
  const pool=[...new Map([...archive,...batch].filter(x=>x.result.valid).map(x=>[JSON.stringify(x.geometry.params),x])).values()];
  archive=pool.filter(x=>!pool.some(y=>dominates(y.result,x.result))).sort((a,b)=>b.result.score-a.result.score).slice(0,12);
  const winner=population[0];history.push({...winner,generation:gen,accepted:batch.length,rejected:6-batch.length});
  onGeneration(history.at(-1));await new Promise(r=>setTimeout(r,0));
 }
 const best=history.at(-1);return {history,best:{...best,result:simulatePopulation(c,best.geometry,{agents:count})},archive,evaluations:completed,rejected,cancelled:!!options.signal?.aborted,seed:options.seed||20261026};
}
export function semanticElements(c,g){
 const out=elements(c,g);for(const e of out){const asset=g.objects.find(o=>o.id===e.id);const classes={light:'IFCLIGHTFIXTURE',rail:'IFCRAILING',stringer:'IFCMEMBER',sink:'IFCSANITARYTERMINAL',toilet:'IFCSANITARYTERMINAL',shower:'IFCSANITARYTERMINAL'};if(classes[asset?.kind])e.type=classes[asset.kind];if(asset?.kind==='door'&&asset.axis==='y')e.parts=[{polygon:rect(asset.x,asset.y,asset.d,.12).map(q=>c.toWorld(...q)),z:asset.z,height:asset.h}];e.level+=c.baseLevel||0;e.layer=c.baseLevel?'upper':'valley';for(const p of e.parts)p.z+=c.baseZ||0;const o=g.objects.find(o=>o.id===e.id)||g.rooms.find(o=>o.id===e.id);Object.assign(e,{roomId:o?.roomId,sourceUnitId:c.id,material:o?.material,quantity:o?.quantity||1,volumeCF:o?.volumeCF,complexity:o?.complexity,nativeValidated:false});}return out;
}
export function schedule(c,g){return {schema:SCHEMA,units:'feet',unitId:c.id,typology:c.typology,baseLevel:c.baseLevel,genome:GENOME,parameters:g.params,rooms:g.rooms,objects:g.objects,relationships:g.rooms.flatMap(r=>r.adjacency.map(to=>({from:r.id,to,relation:'same-level'}))),validation:{nativeBRep:false,structure:false,MEP:false,codeCompliance:false},roadmap:['Audit all four entrance routes against structure and MEP','Resolve upper apartment corridor door and core route','Validate vestibule/door mutations before applying','Provision native BRep host and run exact checks','Replicate only validated typologies'],metricsDefinitions:{privacy:'Plan sight-line exposure from open unit entrance into test zone',daylight:'Unobstructed rear-wall fraction proxy; no climate or ray-traced illuminance',complexity:'Relative asset fabrication points; not money',queuing:'Scheduled arrival service queue',circulation:'Fraction of nine routine graphs successfully routed'}};}
export async function studyEntrances(model,building='B1',onEntry=()=>{}){
 const list=[];for(const e of model.entrances.filter(e=>e.building===building)){
  const candidates=model.pieces.filter(p=>p.building===building&&!p.core&&!p.retail&&!p.office&&p.groundPolygon?.length===4&&p.carve?.entry).sort((a,b)=>dist(a.carve.entry,e.corePoint)-dist(b.carve.entry,e.corePoint));
  let audit={valid:false,reason:'No compatible adjacent triplex'};
  if(candidates[0])try{const c=context(model,candidates[0].id);c.entrance=e;audit=entranceRoute(c);}catch(err){audit={valid:false,reason:err.message};}
  const row={id:e.id,type:e.type,portalWidthFt:e.width,vestibuleWidthFt:e.vestibuleWidth,depthFt:e.airlockDepth,core:e.coreId,...audit,accessibleVerified:false,mutationsLocked:true};list.push(row);onEntry(row);await new Promise(r=>setTimeout(r,0));
 }return list;
}
