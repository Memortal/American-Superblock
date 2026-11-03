import {serviceBand} from './mep-service-band.js';
import {generateStructure,inside} from './structure-engine.js';
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const edgeDistance=(q,p)=>Math.min(...p.map((a,i)=>{const b=p[(i+1)%p.length],d=[b[0]-a[0],b[1]-a[1]],t=Math.max(0,Math.min(1,((q[0]-a[0])*d[0]+(q[1]-a[1])*d[1])/(d[0]**2+d[1]**2||1)));return Math.hypot(q[0]-a[0]-t*d[0],q[1]-a[1]-t*d[1]);}));
export function coordinateMEP({model,nodes,edges,objects,contexts,ringRoute,issue}){
 const structure=generateStructure(model),solids=[],bins=new Map(),stats={rerouted:0,blocked:0,clear:0,blockedObjects:0,blockerCounts:{},relocatedNodes:0,method:'Swept-envelope sampling against modeled frame, slabs and protected cores; no structural openings authorized.'};
 for(const m of structure.members){if(m.geometryClearance===false||m.type==='COLUMN'&&m.existing)continue;if(!['BEAM','COLUMN','WALL','EXISTING_COLUMN','SLAB'].includes(m.type))continue;
 let polygon=m.polygon,lo=m.z,hi=m.z+m.height;
 if(m.type==='BEAM'){const [a,b]=[m.a,m.b],L=Math.hypot(b[0]-a[0],b[1]-a[1])||1,n=[-(b[1]-a[1])/L*m.width/2,(b[0]-a[0])/L*m.width/2];polygon=[[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]];lo=m.z-m.height;hi=m.z;}
 if(m.type==='COLUMN'){const q=m.a,w=m.width/2;polygon=[[q[0]-w,q[1]-w],[q[0]+w,q[1]-w],[q[0]+w,q[1]+w],[q[0]-w,q[1]+w]];lo=m.a[2];hi=m.b[2];}
 if(!polygon?.length)continue;const o={id:m.id,type:m.type,polygon,holes:m.holes||[],lo,hi,x0:Math.min(...polygon.map(q=>q[0])),x1:Math.max(...polygon.map(q=>q[0])),y0:Math.min(...polygon.map(q=>q[1])),y1:Math.max(...polygon.map(q=>q[1]))};solids.push(o);
 for(let x=Math.floor((o.x0-10)/32);x<=Math.floor((o.x1+10)/32);x++)for(let y=Math.floor((o.y0-10)/32);y<=Math.floor((o.y1+10)/32);y++)for(let z=Math.floor((lo-10)/12);z<=Math.floor((hi+10)/12);z++){const k=x+'|'+y+'|'+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(o);}
 }
 const buildings=model.buildings.filter(b=>b.id!=='CORE');
 function hit(q,r,h){if(q[2]+h>=0)for(const b of buildings){if(inside(q,b.courtyard)||edgeDistance(q,b.courtyard)<r)return 'COURTYARD';if(q[2]<36&&q[2]>=0&&inside(q,b.corridorOuter)&&!inside(q,b.corridorInner))return 'VALLEY';}
 for(const o of bins.get(Math.floor(q[0]/32)+'|'+Math.floor(q[1]/32)+'|'+Math.floor(q[2]/12))||[]){if(q[2]+h<=o.lo+.015||q[2]-h>=o.hi-.015||q[0]+r<o.x0||q[0]-r>o.x1||q[1]+r<o.y0||q[1]-r>o.y1)continue;if((inside(q,o.polygon)||edgeDistance(q,o.polygon)<r)&&!o.holes.some(p=>inside(q,p)&&edgeDistance(q,p)>r))return o.id;}return null;}
 function clear(route,r,h,gravity){if(route.length<2)return false;for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i];if(gravity&&b[2]>a[2]+.001)return false;const horizontal=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!gravity&&horizontal>.05&&Math.abs(b[2]-a[2])>.05)return false;if(gravity&&horizontal>.05&&Math.abs(b[2]-a[2])/horizontal>.08)return false;const N=Math.max(1,Math.ceil(distance(a,b)/.6));for(let j=0;j<=N;j++){const t=j/N,q=a.map((v,k)=>v+(b[k]-v)*t);if(hit(q,r,h))return false;}}return true;}
 // Relocate provisional ceiling junctions below beams, keeping XY and floor unchanged.
 // Fixed fixtures, shafts, fire heads and gravity stacks retain their design locations.
 const incident=new Map(),equipment=new Map(),solidById=new Map(solids.map(o=>[o.id,o]));
 for(const e of edges)for(const id of [e.source,e.destination]){if(!incident.has(id))incident.set(id,[]);incident.get(id).push(e);}
 for(const o of objects){if(!equipment.has(o.node))equipment.set(o.node,[]);equipment.get(o.node).push(o);}
 for(const n of nodes){if(!n.unit||!['BRANCH','TERMINAL','UNIT'].includes(n.type)||['SANITARY','STORM','FIRE_PROTECTION'].includes(n.system))continue;
 const es=incident.get(n.id)||[],os=equipment.get(n.id)||[],floor=n.level*12;if(n.point[2]<floor+7.5||n.point[2]>floor+11)continue;
 const r=Math.max(.12,...es.map(e=>(e.size||.1)/2+.12),...os.map(o=>Math.hypot(o.size[0],o.size[1])/2)),h=Math.max(.12,...es.map(e=>(e.shape==='duct'?(e.height||e.size*.6):e.shape==='tray'?.15:e.size||.1)/2+.12),...os.map(o=>o.size[2]/2));
 if(solidById.get(hit(n.point,r,h))?.type!=='BEAM')continue;
 const old=n.point.slice();let point=null;for(let z=old[2]-.25;z-h>=floor+7.5;z-=.25){const q=[old[0],old[1],z];if(!hit(q,r,h)){point=q;break;}}
 if(!point)continue;n.originalPoint=old;n.point=point;n.locationAdjustment='Lowered within ceiling service zone to clear modeled beam';stats.relocatedNodes++;
 for(const e of es){const route=e.route?.length?e.route:e.proposedRoute;if(!route)continue;for(let i=0;i<route.length;i++)if(distance(route[i],old)<.001)route[i]=point.slice();if(e.source===n.id)route[0]=point.slice();if(e.destination===n.id)route[route.length-1]=point.slice();}
 for(const o of os)o.point=point.slice();
 }
 // Form legal elbows without changing graph endpoints. Waste branches use a sloped
 // horizontal run plus a vertical drop rather than an impossible steep diagonal.
 function elbows(path,gravity,atEnd=false){const a=path[0],b=path.at(-1),xy=[a];for(const q of path.slice(1))if(Math.hypot(q[0]-xy.at(-1)[0],q[1]-xy.at(-1)[1])>.01)xy.push(q);if(xy.length===1)return[a,b];const cumulative=[0];for(let i=1;i<xy.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(xy[i][0]-xy[i-1][0],xy[i][1]-xy[i-1][1]));const total=cumulative.at(-1);
 if(gravity){if(a[2]-b[2]<total*.01-.001)return null;return[a,...xy.map((q,i)=>[q[0],q[1],b[2]+(total-cumulative[i])*.01]),b];}
 const z=atEnd?b[2]:a[2];return[a,...xy.map(q=>[q[0],q[1],z]),b];}
 for(const e of edges){if(e.blocked||e.sharedRiser||e.route.length<2)continue;const r=(e.size||.1)/2+.12,h=(e.shape==='duct'?(e.height||e.size*.6):e.shape==='tray'?.15:e.size||.1)/2+.12,gravity=['SANITARY','STORM'].includes(e.system),original=e.route.map(q=>q.slice());
 if(!(e.zone==='FLOOR'&&distance(original[0],original.at(-1))>30)&&clear(original,r,h,gravity)){e.coordinationStatus='ENVELOPE_CHECKED';stats.clear++;continue;}
 const start=original[0],end=original.at(-1),ctx=contexts.find(c=>c.b.id===e.building),candidates=[];if(e.zone!=='FLOOR'||distance(start,end)<=30){for(const atEnd of [false,true]){const q=elbows(original,gravity,atEnd);if(q)candidates.push(q);}}if(!gravity&&e.zone!=='FLOOR')candidates.push([start,[start[0],start[1],end[2]],end],[start,[end[0],end[1],start[2]],end]);
 if(ctx&&Math.abs(start[2]-end[2])<5&&start[2]>=0){for(const outer of [false,true]){const ring=serviceBand(ctx.b,outer),path=ringRoute(start.slice(0,2),end.slice(0,2),ring),planar=path.map(q=>[...q,start[2]]);planar[0]=start;planar[planar.length-1]=end;for(const atEnd of [false,true]){const q=elbows(planar,gravity,atEnd);if(q)candidates.push(q);}if(!gravity){const floor=Math.floor(Math.min(start[2],end[2])/12)*12;for(const z of [floor+7.5,floor+8,floor+8.5])candidates.push([start,...path.map(q=>[...q,z]),end]);}}}

 // Offset local service runs and drop below downstand beams, retaining fixed graph endpoints.
 if(!gravity&&Math.abs(start[2]-end[2])<4&&!(e.zone==='FLOOR'&&distance(start,end)>30)){const floor=Math.floor(Math.min(start[2],end[2])/12)*12;for(const z of [Math.min(start[2],end[2]),floor+8,floor+6,floor+4])for(const shift of [0,2,-2,4,-4,7,-7]){const dx=end[0]-start[0],dy=end[1]-start[1],L=Math.hypot(dx,dy)||1,n=[-dy/L*shift,dx/L*shift];candidates.push([start,[start[0],start[1],z],[start[0]+n[0],start[1]+n[1],z],[end[0]+n[0],end[1]+n[1],z],[end[0],end[1],z],end]);}}
 const valid=candidates.filter(q=>clear(q,r,h,gravity)).sort((a,b)=>a.reduce((n,q,i)=>n+(i?distance(q,a[i-1]):0),0)-b.reduce((n,q,i)=>n+(i?distance(q,b[i-1]):0),0))[0];
 if(valid){e.route=valid;e.coordinationStatus='REROUTED_AROUND_MODEL';stats.rerouted++;}else{e.proposedRoute=original;e.route=[];e.blocked=true;e.blockReason='No envelope-clear route within available service space; opening or shaft redesign required';e.coordinationStatus='UNRESOLVED';const obstruction=hit(start,r,h)||hit(end,r,h),kind=solidById.get(obstruction)?.type||obstruction||'PATH_OR_SLOPE';e.blockerType=kind;stats.blockerCounts[kind]=(stats.blockerCounts[kind]||0)+1;stats.blocked++;}
 }
 for(const o of objects){const r=Math.hypot(o.size[0],o.size[1])/2,h=o.size[2]/2;if(hit(o.point,r,h)){o.blocked=true;o.coordinationStatus='EQUIPMENT_LOCATION_REVIEW';stats.blockedObjects++;}}
 const active=new Set(edges.filter(e=>!e.blocked&&e.route.length>1).flatMap(e=>[e.source,e.destination]));for(const n of nodes)n.physicalConnection=active.has(n.id)?'HAS_DRAWN_CONNECTION':'UNRESOLVED';
 issue('PHYSICAL_ROUTING','MODEL',stats.rerouted+' routes rerouted; '+stats.blocked+' unresolved routes and '+stats.blockedObjects+' equipment conflicts withheld from physical drawings and IFC. Logical graph retained for review.',stats.blocked?'error':'review');return stats;
}
