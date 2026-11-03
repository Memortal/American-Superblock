/* MEMO Door Graph — derived register plus explicitly qualified connectivity.
 * Feet, world axes x/z. Inferred locations and links are never 'verified'.
 */
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],(a[2]-b[2]));
const center=poly=>[poly.reduce((s,p)=>s+p[0],0)/poly.length,poly.reduce((s,p)=>s+p[1],0)/poly.length];
function middle(e){const a=e?.parts?.[0];if(!a?.polygon?.length)return null;const c=center(a.polygon);return [c[0],(a.z||0)+(a.height||0)/2,c[1]];}
export function buildDoorGraph(model){
 if(model.elements.some(e=>e.doorRecord))return actualDoorGraph(model);
 const doors=[],nodes=new Map(),edges=new Map(),warnings=[];
 const link=(a,b,kind,verified=false,extra={})=>{if(!nodes.has(a)||!nodes.has(b)||a===b)return;const length=distance(nodes.get(a).xyz,nodes.get(b).xyz);const edge={from:a,to:b,length,kind,verified,...extra};for(const [u,v] of [[a,b],[b,a]]){if(!edges.has(u))edges.set(u,[]);edges.get(u).push({...edge,from:u,to:v});}};
 const space=(id,xyz,building,level,kind)=>{if(!nodes.has(id))nodes.set(id,{id,xyz,building,level,kind});return id;};
 const add=(id,type,xyz,building,level,unit,from,to,source,verified=false)=>{if(!xyz||nodes.has(id))return;const door={id,type,xyz,building,level,unit:unit||null,from,to,widthFt:null,accessible:null,locked:false,open:true,sourceElementId:source||null,verified,provenance:source?'IFCDOOR geometry':'Location inferred from model polygon; needs door placement'};doors.push(door);space(id,xyz,building,level,'door');if(from){link(id,from,'portal',false)}if(to){link(id,to,'portal',false)}return door;};
 const buildings=model.buildings.filter(b=>!b.parking),pieces=model.pieces||[],elements=model.elements||[];
 const byPiece=new Map();for(const e of elements){if(!e.piece?.id)continue;if(!byPiece.has(e.piece.id))byPiece.set(e.piece.id,[]);byPiece.get(e.piece.id).push(e);}
 const entrances=model.entrances||[];
 space('PUBLIC:STREET',[0,0,0],'SITE',0,'public'); // symbolic domain; not connected until topologically substantiated
 for(const b of buildings){
  const bPieces=pieces.filter(p=>p.building===b.id);
  const courtyard=center(b.courtyard?.length?b.courtyard:b.outer);
  for(let l=0;l<b.levels;l++){
   // model corridor hubs are inferred, not proof of actual wall-free travel
   space('CORRIDOR:'+b.id+':'+l,[courtyard[0],l*12+5,courtyard[1]],b.id,l,'corridor-inferred');
  }
  space('COURTYARD:'+b.id,[courtyard[0],1,courtyard[1]],b.id,0,'courtyard');
  for(const p of bPieces){
   const poly=p.polygon||[];if(poly.length<3)continue;
   const xy=center(poly),own=byPiece.get(p.id)||[],floor=p.levels||0;
   if(p.core){
    for(const l of p.occupiedLevels||Array.from({length:floor},(_,i)=>i)){
     const loc=[xy[0],l*12+5,xy[1]],landing=space('CORE:'+p.id+':'+l,loc,b.id,l,'core-landing');
     add('STAIR:'+p.id+':'+l,'stair',loc,b.id,l,null,'CORRIDOR:'+b.id+':'+l,landing,null,false);
     add('LIFT:'+p.id+':'+l,'elevator',[loc[0]+2,loc[1],loc[2]],b.id,l,null,'CORRIDOR:'+b.id+':'+l,landing,null,false);
    }
    const levels=(p.occupiedLevels||[]).slice().sort((a,b)=>a-b);
    for(let k=1;k<levels.length;k++){const a=levels[k-1],c=levels[k];if(c!==a+1)continue;link('CORE:'+p.id+':'+a,'CORE:'+p.id+':'+c,'stair-vertical',false,{accessible:false});link('LIFT:'+p.id+':'+a,'LIFT:'+p.id+':'+c,'elevator-vertical',false,{accessible:true});}
    continue;
   }
   const existing=own.filter(e=>e.type==='IFCDOOR'&&e.entry&&e.level===0);
   const ground=existing[0];
   if(p.retail){const id=p.id+'-RETAIL';space(id,[xy[0],5,xy[1]],b.id,0,'retail');add('DOOR:'+id,'retail',middle(ground)||[xy[0],5,xy[1]],b.id,0,id,id,'COURTYARD:'+b.id,ground?.id,!!ground);continue;}
   const trip=p.id+'-TRIPLEX';space(trip,[xy[0],5,xy[1]],b.id,0,'triplex');
   add('DOOR:'+trip+':FRONT','triplex-front',middle(ground)||[xy[0],5,xy[1]],b.id,0,trip,trip,'COURTYARD:'+b.id,ground?.id,!!ground);
   add('DOOR:'+trip+':BACK','triplex-back',[xy[0],5,xy[1]],b.id,0,trip,trip,'CORRIDOR:'+b.id+':0',null,false);
   for(let l=Math.max(3,p.upperStart||4);l<Math.min(floor,p.duplexBase??floor);l++){
    const id=p.id+'-APT-L'+(l+1),s=space(id,[xy[0],l*12+5,xy[1]],b.id,l,'apartment');
    add('DOOR:'+id,'apartment',[xy[0],l*12+5,xy[1]],b.id,l,id,s,'CORRIDOR:'+b.id+':'+l,null,false);
   }
   if(p.duplexBase>=3&&p.duplexBase<floor){const l=p.duplexBase,id=p.id+'-DUPLEX';space(id,[xy[0],l*12+5,xy[1]],b.id,l,'duplex');add('DOOR:'+id,'duplex',[xy[0],l*12+5,xy[1]],b.id,l,id,id,'CORRIDOR:'+b.id+':'+l,null,false);}
  }
  const records=entrances.filter(r=>r.building===b.id||r.buildingId===b.id);
  // Entrances may be stored with a different building key; preserve source attribution.
  for(let j=0;j<Math.max(4,records.length);j++){
   const r=records[j],loc=r?.xyz||r?.position||null,xyz=Array.isArray(loc)&&loc.length===3?loc:[courtyard[0],5,courtyard[1]];
   const vestibule=space('VESTIBULE:'+b.id+':'+j,xyz,b.id,0,'vestibule');
   add('ENTRANCE:'+b.id+':'+j+':STREET','building-street',xyz,b.id,0,null,'CORRIDOR:'+b.id+':0',vestibule,r?.id,false);
   add('ENTRANCE:'+b.id+':'+j+':COURT','building-courtyard',xyz,b.id,0,null,vestibule,'COURTYARD:'+b.id,r?.id,false);
  }
 }
 // Explicitly do not connect spatial hubs without validated corridor/portal traversal.
 warnings.push('Many unit-back, upper-unit, entrance, elevator and stair door locations are inferred; validate wall openings and landing geometry.');
 warnings.push('No interbuilding, courtyard-to-street, or corridor-crossing shortcut is assumed. Verified-only routes may be unavailable.');
 const findRoute=(from,to,{verifiedOnly=false,accessible=false,speedFtSec=4,doorDelaySec=2,elevatorWaitSec=30}={})=>{
  if(!nodes.has(from)||!nodes.has(to))return {found:false,reason:'Unknown node ID'};
  const best=new Map([[from,0]]),prev=new Map(),queue=[[0,from]];
  while(queue.length){queue.sort((a,b)=>a[0]-b[0]);const [cost,u]=queue.shift();if(cost>best.get(u))continue;if(u===to)break;for(const e of edges.get(u)||[]){if(verifiedOnly&&!e.verified||accessible&&e.accessible===false)continue;const d=doors.find(q=>q.id===e.to);if(d&&(d.locked||!d.open))continue;const w=e.length/Math.max(.1,speedFtSec)+(e.kind==='portal'?doorDelaySec:0)+(e.kind==='elevator-vertical'?elevatorWaitSec:0);if(cost+w<(best.get(e.to)??Infinity)){best.set(e.to,cost+w);prev.set(e.to,{node:u,edge:e});queue.push([cost+w,e.to]);}}}
  if(!best.has(to))return {found:false,reason:verifiedOnly?'No validated connection between those doors':'No connected modeled path'};
  const path=[to],segments=[];let curr=to,ft=0,unverified=0;while(curr!==from){const p=prev.get(curr);if(!p)break;segments.push(p.edge);ft+=p.edge.length;unverified+=!p.edge.verified;curr=p.node;path.unshift(curr);}
  return {found:true,path,distanceFt:ft,timeSec:best.get(to),unverifiedEdges:unverified,verified:unverified===0,segments:segments.reverse()};
 };
 return {doors,nodes:[...nodes.values()],edges:[...edges.values()].flat(),warnings,route:findRoute,validate:()=>({doors:doors.length,types:Object.fromEntries([...new Set(doors.map(d=>d.type))].map(t=>[t,doors.filter(d=>d.type===t).length])),unverified:doors.filter(d=>!d.verified).length,issues:warnings})};
}

function actualDoorGraph(model){
 const doors=model.elements.filter(e=>e.type==='IFCDOOR'&&e.doorRecord).map(e=>{const d=e.doorRecord;return {id:d.id,type:d.category,xyz:[d.center[0],d.z+d.height/2,d.center[1]],building:d.building,level:d.level,unit:d.unitId,from:d.unitId,to:null,widthFt:d.width,sourceElementId:e.id,verified:true,provenance:'Dimensioned IFCDOOR assembly; route validation separate',schedule:d};});
 const nodes=doors.map(d=>({id:d.id,xyz:d.xyz,kind:'door'})),edges=[];
 // No straight lines through rooms masquerading as checked navigation routes.
 return {doors,nodes,edges,warnings:['Door geometry is modeled. Door-to-door navigation remains subject to room and corridor clearance validation.'],route:(a,b)=>a===b?{found:true,path:[a],distanceFt:0,timeSec:0,verified:true}:{found:false,reason:'No validated traversable connection; use the unit egress / household navigation studies.'},validate:()=>({doors:doors.length,types:Object.fromEntries([...new Set(doors.map(d=>d.type))].map(t=>[t,doors.filter(d=>d.type===t).length])),unverified:0,routeValidation:'Pending'})};
}
