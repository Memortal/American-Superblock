/* MEMO Social Evolution v1 — deterministic, reversible courtyard study.
 * This uncalibrated ABM never changes BIM objects or approved geometry.
 * Spatial attendance uses courtyard centroids and conceptual capacities;
 * route accessibility, structural/MEP clearance and code compliance are NOT validated.
 */
export const SOCIAL_SCHEMA = 'MEMO-SOCIAL-EVOLUTION-1';
export const SOCIAL_PROGRAMS = ['open','commons','garden','culture','maker','quiet'];
export const SOCIAL_GENOME = Object.freeze({seats:[0,4],shade:[0,2],program:SOCIAL_PROGRAMS});
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const round=v=>Math.round(v*1000)/1000;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function hash(...items){
 let h=2166136261>>>0;
 for(const item of items){for(const ch of String(item)){h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;}h=Math.imul(h^127,16777619)>>>0;}
 return h>>>0;
}
const random=(...keys)=>hash(...keys)/4294967296;
const center=poly=>({x:poly.reduce((s,p)=>s+p[0],0)/poly.length,z:poly.reduce((s,p)=>s+p[1],0)/poly.length});
const circleRadius=poly=>{const x=poly.map(p=>p[0]),z=poly.map(p=>p[1]);return clamp(Math.min(Math.max(...x)-Math.min(...x),Math.max(...z)-Math.min(...z))*.15,10,23);};
const clone=x=>JSON.parse(JSON.stringify(x));

export function makeSocialContext(model){
 const buildings=(model.buildings||[]).filter(b=>!b.parking&&Array.isArray(b.courtyard)&&b.courtyard.length>=3);
 if(buildings.length!==4)throw Error('Social Evolution requires all four modeled Superblock courtyards; no geometry altered.');
 const zones=buildings.map(b=>{
  const p=center(b.courtyard);
  return {id:String(b.id),building:String(b.id),x:p.x,z:p.z,radius:circleRadius(b.courtyard),label:(b.name||b.id)+' courtyard',kind:'courtyard'};
 });
 if(new Set(zones.map(z=>z.id)).size!==4)throw Error('Duplicate courtyard identities.');
 const entrances=(model.entrances||[]).map(e=>({id:e.id,building:e.building,position:e.position,coreId:e.coreId,existingExit:e.existingExit,conflicts:e.conflicts?.length||0}));
 const blocked=(model.elements||[]).length; // Metadata only; not a physical clash solver.
 return {version:SOCIAL_SCHEMA,zones,entrances,entranceCount:entrances.length,modeledElementCount:blocked,
  sourceFingerprint:JSON.stringify([zones,entrances.map(e=>[e.id,e.building,e.position,e.coreId,e.existingExit])]),
  assumptions:['Courtyards are centroid-based social destinations, not audited walkable polygons',
   'Entrances, cores, residential privacy zones, paths, structural and MEP systems are immutable',
   'No physical mutation is construction-approved until accessibility, egress and coordination checks pass']};
}
export function baselineSocialDesign(context){
 return {schema:SOCIAL_SCHEMA,sourceFingerprint:context.sourceFingerprint,
  zones:context.zones.map(z=>({id:z.id,program:'open',seats:0,shade:0}))};
}
export function validateSocialDesign(context,design){
 const errors=[];
 if(design?.sourceFingerprint!==context.sourceFingerprint)errors.push('Source geometry changed; refresh Social Evolution.');
 if(!Array.isArray(design?.zones)||design.zones.length!==context.zones.length)errors.push('All four fixed courtyards must remain.');
 const ids=new Set();
 for(const q of design?.zones||[]){
  const z=context.zones.find(z=>z.id===q.id);
  if(!z||ids.has(q.id)){errors.push('Missing or duplicate courtyard ID: '+q.id);continue;}
  ids.add(q.id);
  if(!SOCIAL_PROGRAMS.includes(q.program))errors.push('Unknown program at '+q.id);
  if(!Number.isInteger(q.seats)||q.seats<0||q.seats>4)errors.push('Seats outside proposal range at '+q.id);
  if(!Number.isInteger(q.shade)||q.shade<0||q.shade>2)errors.push('Shade outside proposal range at '+q.id);
  const footprintSF=(q.seats||0)*18+(q.shade||0)*34+(q.program==='open'?0:48);
  if(footprintSF>Math.PI*z.radius*z.radius*.55)errors.push('Proposed footprint exceeds 55% of schematic courtyard buffer at '+q.id);
 }
 return {valid:errors.length===0,errors,scope:'Schematic envelope/area guard only; NOT egress, accessibility or site collision certification.'};
}
function makeAgents(context,n,seed){
 const interests=['garden','commons','culture','maker','quiet'];
 return Array.from({length:n},(_,i)=>({
  id:i,home:context.zones[i%context.zones.length].id,
  age:18+Math.floor(random(seed,'age',i)*63),
  sociality:random(seed,'sociality',i),
  privacy:random(seed,'privacy',i),
  mobility:random(seed,'mobility',i),
  interest:interests[Math.floor(random(seed,'interest',i)*interests.length)],
  schedule:Math.floor(random(seed,'schedule',i)*3),
  consent:random(seed,'consent',i),
  friends:new Map(),visits:0,encounters:0,positive:0,unwanted:0
 }));
}
function utility(agent,zone,design,day,slot,seed){
 const match=(design.program===agent.interest?1:0)+(design.program==='commons'?.35:0);
 return .22+match*.48+design.seats*.095+design.shade*.06+(design.program==='quiet'&&agent.privacy>.65?.16:0)
  +random(seed,'place-noise',day,slot,agent.id,zone.id)*.29;
}
const mean=(arr,fn)=>arr.length?arr.reduce((s,q)=>s+fn(q),0)/arr.length:0;
export function simulateSocial(context,design,{days=30,agents=80,seed=20261026}={}){
 const validation=validateSocialDesign(context,design);
 if(!validation.valid)return {valid:false,errors:validation.errors};
 days=Math.round(clamp(days,7,90));agents=Math.round(clamp(agents,20,240));
 const population=makeAgents(context,agents,seed);
 const world=context.zones.map(z=>({...z,design:design.zones.find(q=>q.id===z.id)}));
 const byId=new Map(world.map(z=>[z.id,z]));
 const ties=new Map(),events=[],visits=Object.fromEntries(world.map(z=>[z.id,0]));
 let positive=0,unwanted=0,overcrowding=0,participations=0;
 for(let day=0;day<days;day++)for(let slot=0;slot<2;slot++){
  const gathering=new Map(world.map(z=>[z.id,[]]));
  for(const a of population){
   const willingness=.27+.46*a.sociality-.30*a.privacy+.06*(a.schedule===slot)+.04*(day%7===5);
   if(random(seed,'go',day,slot,a.id)>willingness)continue;
   const home=byId.get(a.home);
   let chosen=null,best=-Infinity;
   for(const z of world){
    const d=z.design;
    const score=utility(a,z,d,day,slot,seed)-dist(home,z)*(.00045+.00045*(1-a.mobility));
    if(score>best){best=score;chosen=z;}
   }
   if(!chosen||best<.20+.30*a.privacy)continue;
   gathering.get(chosen.id).push(a);
   a.visits++;visits[chosen.id]++;participations++;
  }
  for(const z of world){
   const attendees=gathering.get(z.id);
   const capacity=5+z.design.seats*3+z.design.shade*2+(z.design.program==='commons'?8:z.design.program==='culture'?6:z.design.program==='garden'?5:2);
   if(attendees.length>capacity)overcrowding+=attendees.length-capacity;
   // Deterministic ranking prevents accidental dependence on insertion order.
   const accepted=attendees.slice().sort((a,b)=>random(seed,'capacity',day,slot,z.id,a.id)-random(seed,'capacity',day,slot,z.id,b.id)).slice(0,capacity);
   for(let i=0;i<accepted.length;i++)for(let j=i+1;j<accepted.length;j++){
    const a=accepted[i],b=accepted[j];
    if(random(seed,'meet',day,slot,a.id,b.id)>clamp(.105+(z.design.seats*.035)+(z.design.program==='commons'?.06:0)))continue;
    a.encounters++;b.encounters++;
    const reciprocal=a.consent>.23&&b.consent>.23&&random(seed,'mutual',day,slot,a.id,b.id)<(.29+.47*(a.sociality+b.sociality)/2);
    if(!reciprocal){unwanted++;a.unwanted++;b.unwanted++;continue;}
    const key=a.id+'|'+b.id;
    const bond=ties.get(key)||{a:a.id,b:b.id,days:[],strength:0};
    if(!bond.days.includes(day))bond.days.push(day);
    bond.strength++;
    ties.set(key,bond);
    a.positive++;b.positive++;positive++;
    if(events.length<400)events.push({day:day+1,slot,zone:z.id,a:a.id,b:b.id,meaningful:bond.days.length>=2});
   }
  }
 }
 const bonds=[...ties.values()];
 const sustained=bonds.filter(t=>t.days.length>=2);
 const linked=new Set(sustained.flatMap(t=>[t.a,t.b]));
 const repeated=linked.size/agents;
 const interaction=clamp(positive/(agents*days*.32));
 const diversity= sustained.length?sustained.filter(t=>population[t.a].home!==population[t.b].home).length/sustained.length:0;
 const participation=population.filter(a=>a.visits>=Math.max(3,Math.ceil(days/6))).length/agents;
 const lowContact=population.filter(a=>!linked.has(a.id)).length/agents;
 const privacy=clamp(1-unwanted/Math.max(1,positive+unwanted));
 const crowdRate=clamp(overcrowding/Math.max(1,participations));
 const socialFitness=100*(.30*interaction+.27*repeated+.16*diversity+.17*participation+.10*privacy);
 const cost=design.zones.reduce((s,q)=>s+q.seats*1.5+q.shade*3+(q.program==='open'?0:4),0);
 const fitness=round(clamp(socialFitness-18*crowdRate-9*(1-privacy)-.18*cost-8*lowContact,0,100));
 const nodeScores=world.map(z=>({id:z.id,building:z.building,visits:visits[z.id],visitsPerAgentDay:round(visits[z.id]/(agents*days)),program:z.design.program,seats:z.design.seats,shade:z.design.shade}));
 return {valid:true,fitness,seed,days,agentCount:agents,metrics:{positiveInteractions:positive,meaningfulTies:sustained.length,
  residentsWithRelationships:linked.size,repeatedRelationshipCoverage:round(repeated),
  crossBuildingTieShare:round(diversity),participationRate:round(participation),isolatedRate:round(lowContact),
  contactRespect:round(privacy),overcrowdingRate:round(crowdRate),
  voluntaryInteractionsPerPersonDay:round(positive*2/(agents*days)),proposalCostPoints:round(cost)},
  nodes:nodeScores,examples:events.slice(0,40),validation,assumptions:context.assumptions,
  warning:'Uncalibrated synthetic agents, schematic courtyard centroids and assumed social outcomes. Not empirical evidence or an accessibility/code-compliant design.'};
}
const avg = rows=>({fitness:round(mean(rows,r=>r.fitness)),metrics:Object.fromEntries(Object.keys(rows[0].metrics).map(k=>[k,round(mean(rows,r=>r.metrics[k]))]))});
export function evaluateSocial(context,design,opts={}){
 const seeds=opts.seeds||[20261026,20261027,20261028];
 const rows=seeds.map(seed=>simulateSocial(context,design,{...opts,seed}));
 if(rows.some(r=>!r.valid))return {valid:false,errors:rows.find(r=>!r.valid).errors};
 return {valid:true,...avg(rows),runs:rows,seedCount:seeds.length};
}
function mutate(context,design,seed,gen,index){
 const p=clone(design),z=p.zones[hash(seed,gen,index,'zone')%p.zones.length],
 key=['seats','shade','program'][hash(seed,gen,index,'key')%3];
 if(key==='program')z.program=SOCIAL_PROGRAMS[(SOCIAL_PROGRAMS.indexOf(z.program)+1+hash(seed,gen,index,'change')%(SOCIAL_PROGRAMS.length-1))%SOCIAL_PROGRAMS.length];
 else{const [lo,hi]=SOCIAL_GENOME[key];const direction=hash(seed,gen,index,'direction')%2?1:-1;z[key]=clamp(z[key]+direction,lo,hi);}
 return p;
}
export async function evolveSocial(context,{agents=80,days=30,generations=4,candidates=5,seeds=[20261026,20261027,20261028],signal,onGeneration}={}){
 generations=Math.round(clamp(generations,1,12));candidates=Math.round(clamp(candidates,2,12));
 const baseline=baselineSocialDesign(context),baseResult=evaluateSocial(context,baseline,{agents,days,seeds});
 let best={design:baseline,evaluation:baseResult,generation:0},evaluations=1,rejected=0;
 const history=[{generation:0,fitness:baseResult.fitness,design:clone(baseline),metrics:baseResult.metrics}];
 const visited=new Set([JSON.stringify(baseline.zones)]);
 const pool=[best];
 for(let gen=1;gen<=generations;gen++){
  if(signal?.aborted)break;
  let winner=best;
  const parents=pool.slice().sort((a,b)=>b.evaluation.fitness-a.evaluation.fitness).slice(0,3);
  for(let i=0;i<candidates;i++){
   if(signal?.aborted)break;
   const parent=parents[i%parents.length];
   const proposal=mutate(context,parent.design,seeds[0],gen,i);
   const key=JSON.stringify(proposal.zones);if(visited.has(key))continue;visited.add(key);
   const validation=validateSocialDesign(context,proposal);
   if(!validation.valid){rejected++;continue;}
   const evaluation=evaluateSocial(context,proposal,{agents,days,seeds});evaluations++;
   const candidate={design:proposal,evaluation,generation:gen};
   pool.push(candidate);
   if(evaluation.fitness>winner.evaluation.fitness+.000001)winner=candidate;
  }
  pool.sort((a,b)=>b.evaluation.fitness-a.evaluation.fitness);pool.splice(8);
  best=winner;
  const row={generation:gen,fitness:best.evaluation.fitness,design:clone(best.design),metrics:best.evaluation.metrics};
  history.push(row);onGeneration?.(row);
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 return {schema:SOCIAL_SCHEMA,context,baseline,baseResult,best,history,evaluations,rejected,cancelled:!!signal?.aborted,
  parameters:{agents,days,generations,candidates,seeds},note:'Optimization of a schematic, synthetic behavioral model. Changes are proposal overlays only.'};
}
