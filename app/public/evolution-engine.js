// Feet throughout. Deterministic, dependency-free schematic navigation; no AI calls.
export const VERSION='memo-evolution-1';
export const inside=(p,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>p[1])!==(r[j][1]>p[1])&&p[0]<(r[j][0]-r[i][0])*(p[1]-r[i][1])/(r[j][1]-r[i][1])+r[i][0])c=!c;return c};
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const mid=r=>r.reduce((s,q)=>s.map((v,i)=>v+q[i]/r.length),[0,0]);
const rect=(x,y,w,d)=>[[x,y],[x+w,y],[x+w,y+d],[x,y+d]];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const round=v=>Math.round(v*100)/100;
export function context(model,selectedId){
 const candidates=model.pieces.filter(p=>!p.core&&!p.office&&!p.retail&&p.carve?.entry&&p.groundPolygon?.length===4);
 if(!candidates.length)throw Error('No supported rectangular triplex in the current model.');
 const p=candidates.find(p=>p.id===selectedId)||candidates[0],u=p.carve.u,n=[-u[1],u[0]],origin=p.carve.entry;
 if(!inside([origin[0]+n[0],origin[1]+n[1]],p.groundPolygon)){n[0]*=-1;n[1]*=-1;}
 const local=q=>[(q[0]-origin[0])*u[0]+(q[1]-origin[1])*u[1],(q[0]-origin[0])*n[0]+(q[1]-origin[1])*n[1]];
 const poly=p.groundPolygon.map(local),xmin=Math.min(...poly.map(q=>q[0]))+.65,xmax=Math.max(...poly.map(q=>q[0]))-.65,D=Math.max(...poly.map(q=>q[1]))-.65;
 const W=xmax-xmin,toWorld=(x,y)=>[origin[0]+u[0]*(x+xmin)+n[0]*y,origin[1]+u[1]*(x+xmin)+n[1]*y];
 if(W<25||D<23)throw Error('Triplex too small for the prototype kit; no geometry changed.');
 const entrances=(model.entrances||[]).filter(e=>e.building===p.building&&e.existingExit).sort((a,b)=>dist(a.corePoint,origin)-dist(b.corePoint,origin));
 if(!entrances.length)throw Error('No existing connected entrance found.');
 return {piece:p,id:p.id,building:p.building,W,D,xmin,toWorld,local,origin,u,n,entrance:entrances[0],model,doorX:-xmin};
}
export const defaults={entranceOffset:0,vestibuleDepth:12,screen:0,buffer:3,foyer:0,furniture:0,partition:0};
export function generate(c,p=defaults){
 p={...defaults,...p};const {W,D}=c,id=c.id+'-EV',objects=[],rooms=[],doors=[],obstacles=[],floors=[],stairs=[];
 const put=(key,kind,x,y,w,d,z,h,level=0,extra={})=>{const o={id:id+'-'+key,kind,x,y,w,d,z,h,level,...extra};objects.push(o);if(!['rug','mirror','floor','door','rail','tread','landing','light'].includes(kind)&&!extra.nonBlocking)obstacles.push(o);return o;};
 const room=(key,name,x,y,w,d,l,target)=>rooms.push({id:id+'-room-'+key,name,level:l,polygon:rect(x,y,w,d),target});
 const door=(key,x,y,w,l,axis='x')=>{const o=put(key,'door',x,y,axis==='x'?w:.12,axis==='x'?.12:w,l*12+.75,8,l,{clearWidthFt:w,axis,nonBlocking:true});doors.push(o);};
 const wall=(key,x,y,w,d,l)=>put(key,'partition',x,y,w,d,l*12+.75,9.5,l);
 const furniture=(key,kind,x,y,w,d,h,l=0,extra={})=>put(key,kind,x,y,w,d,l*12+.75,h,l,extra);
 const sx=W-8.5,sy=3.5,stairW=8,stairD=14,entry=c.doorX;
 room('foyer','Foyer',.1,.5,sx-.3,6,0,[entry,3.0,0]);
 room('living','Living room',.1,6,sx-.3,8,0,[8.5,9.5,0]);
 room('kitchen','Kitchen / dining',.1,14,sx-.3,D-14,0,[10,D-5,0]);
 door('apartment-door',entry-2,0,4,0);
 furniture('bench','bench',1+p.foyer,1,4,1.5,1.5);
 furniture('closet','wardrobe',1,3,4,2,7);
 furniture('shoe-storage','cabinet',6+p.foyer,1,2,1,2);
 furniture('mirror','mirror',.12,1,0.08,3,5);
 furniture('sofa','sofa',1,7+p.furniture,3,6,2.7);
 furniture('coffee-table','table',5.2,8.8+p.furniture,2,3,1.4);
 furniture('rug','rug',4.4,7,6,7,.04,0,{nonBlocking:true});
 furniture('media','console',.6,14,5,1.4,2);
 furniture('kitchen-cabinets','cabinet',1,D-2.2,8,2,3);
 furniture('sink','sink',3,D-2.1,2,1.8,3.15);
 furniture('stove','stove',6,D-2.1,2,1.8,3.15);
 furniture('fridge','fridge',.8,D-5.4,2.6,2.6,6.4);
 furniture('dining-table','table',11,D-5.5,3,4,2.5);
 for(const dy of [0,2.5])furniture('chair-'+dy,'chair',10,D-5.5+dy,.9,1.2,2.7);
 if(p.screen)wall('foyer-screen',entry-3.8,5.5,Math.min(p.screen,4),.35,0);
 // Independent floors and U stairs; 22 risers / 12 ft, 12 inch treads.
 const opening=rect(sx,sy,stairW,stairD);
 for(let l=1;l<3;l++)floors.push({id:id+'-floor-'+l,level:l,polygon:rect(0,.5,W,D-.5),holes:[opening],z:l*12,height:.75});
 for(let l=0;l<2;l++){
  const path=[[sx+1.8,sy-1,l*12+.75],[sx+1.8,sy,l*12+.75]];
  for(let f=0;f<2;f++)for(let i=0;i<11;i++){
   const x=sx+(f?4.25:0),y=f?sy+10-i:sy+i,z=l*12+.75+(f*11+i+1)*12/22;
   put('stair-'+l+'-'+f+'-'+i,'tread',x,y,3.75,1,z-.18,.18,l,{nonBlocking:true});
   path.push([x+1.875,y+.5,z]);
  }
  // Insert landing crossing between the flights in actual order.
  path.splice(13,0,[sx+1.875,sy+12, l*12+.75+6],[sx+6.125,sy+12,l*12+.75+6]);
  put('stair-landing-'+l,'landing',sx,sy+11,8,3,l*12+6+.57,.18,l,{nonBlocking:true});
  path.push([sx+6.125,sy-1,(l+1)*12+.75]);stairs.push({id:id+'-stair-'+l,path,from:l,to:l+1,riserFt:12/22,treadFt:1,clearWidthFt:3.75});
  for(let f=0;f<2;f++)for(const edge of [0,3.6]){
   const x=sx+f*4.25+edge,z=l*12+.75+f*6,el=f?[6,6,0,0]:[0,0,6,6];
   put('stringer-'+l+'-'+f+'-'+edge,'stringer',x,sy,.15,11,z-.5,.5,l,{nonBlocking:true,elevations:el});
   put('handrail-'+l+'-'+f+'-'+edge,'rail',x,sy,.1,11,z+3.1,.12,l,{nonBlocking:true,elevations:el});
  }
  for(const x of [sx-.15,sx+8])put('upper-guard-'+l+'-'+x,'rail',x,sy,.1,14,(l+1)*12+.75,3.5,l+1,{nonBlocking:true});
 }
 for(let l=1;l<3;l++){
  const by=14+p.partition;
  room('bedroom-'+l,'Bedroom '+l,.1,4,sx-.2,by-4,l,[8,8,l]);
  room('bathroom-'+l,'Bathroom '+l,.1,by,9,D-by,l,[6,by+3,l]);
  room('landing-'+l,'Upper hall '+l,9,by,sx-9,D-by,l,[12,by+2,l]);
  wall('bed-front-a-'+l,0,4,9,.3,l);wall('bed-front-b-'+l,12.5,4,sx-12.5,.3,l);door('bedroom-door-'+l,9,4,3.5,l);
  wall('bed-sep-a-'+l,0,by,4,.35,l);wall('bed-sep-b-'+l,7.5,by,sx-7.5,.35,l);
  door('bath-door-'+l,4,by,3.5,l);
  wall('bath-side-'+l,9,by,.35,D-by,l);
  furniture('bed-'+l,'bed',2.5,4.5+p.furniture,5,6.5,2,l);
  furniture('bedside-a-'+l,'table',.5,4.5,1.5,1.2,1.8,l);
  furniture('bedside-b-'+l,'table',8,4.5,1.5,1.5,1.8,l);
  furniture('wardrobe-'+l,'wardrobe',.7,1,5,2,7,l);
  furniture('toilet-'+l,'toilet',1,D-3,1.5,2.4,2,l);
  furniture('shower-'+l,'shower',.5,by+1,3,3,.15,l);
  furniture('vanity-'+l,'vanity',5.2,D-2.1,3,1.6,3,l);
 }
 return {id,params:p,objects,rooms,doors,floors,stairs,opening,sx,sy,W,D,entry};
}
export function valid(g){
 const errors=[];
 for(const o of g.obstacles||g.objects.filter(o=>!['door','floor','rail','tread','landing','mirror','rug'].includes(o.kind))){
  if(o.x<0||o.y<0||o.x+o.w>g.W+.01||o.y+o.d>g.D+.01)errors.push(o.id+' outside unit');
 }
 if(g.params.vestibuleDepth<10||g.params.vestibuleDepth>14)errors.push('vestibule depth out of range');
 return {valid:!errors.length,errors};
}
function blocked(g,x,y,l,r=.65){
 if(x<r||x>g.W-r||y<r||y>g.D-r)return true;
 if(l>0&&x>g.sx-r&&y>g.sy-r&&y<g.sy+14+r)return true;
 if(l<2&&x>g.sx-r&&y>g.sy-r&&y<g.sy+14+r)return true;
 return g.objects.some(o=>o.level===l&&!o.nonBlocking&&!['door','rail','tread','landing','mirror','rug','sink','stove'].includes(o.kind)&&x>o.x-r&&x<o.x+o.w+r&&y>o.y-r&&y<o.y+o.d+r);
}
export function gridPath(g,a,b,r=.65){
 const step=.5,nx=Math.ceil(g.W/step)+1,ny=Math.ceil(g.D/step)+1,l=a[2],key=(x,y)=>y*nx+x;
 const free=(x,y)=>x>=0&&y>=0&&x<nx&&y<ny&&!blocked(g,x*step,y*step,l,r);
 const closest=p=>{let best=null,d=Infinity;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=Math.round(p[0]/step)+dx,y=Math.round(p[1]/step)+dy;if(free(x,y)){const dd=Math.hypot(x*step-p[0],y*step-p[1]);if(dd<d){best=[x,y];d=dd;}}}return d<=1?best:null;};
 const s=closest(a),t=closest(b);if(!s||!t)return null;
 const queue=[s],prev=new Map([[key(...s),null]]);let end=null;
 for(let head=0;head<queue.length;head++){
  const q=queue[head];if(q[0]===t[0]&&q[1]===t[1]){end=q;break;}
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const n=[q[0]+dx,q[1]+dy],k=key(...n);if(!prev.has(k)&&free(...n)){prev.set(k,q);queue.push(n);}}
 }
 if(!end)return null;const out=[];for(let q=end;q;q=prev.get(key(...q)))out.push([q[0]*step,q[1]*step,l*12+.75]);return out.reverse();
}
export function route(g,a,b,r=.65){
 if(a[2]===b[2])return gridPath(g,a,b,r);
 const up=b[2]>a[2],l=up?a[2]:a[2]-1,s=g.stairs[l],path=up?s.path:[...s.path].reverse();
 const start=path[0],end=path.at(-1),first=gridPath(g,a,[start[0],start[1],a[2]],r);
 if(!first)return null;const next=route(g,[end[0],end[1],up?a[2]+1:a[2]-1],b,r);return next?[...first,...path,...next]:null;
}
const cache=new Map();
export function simulate(c,g){
 const key=JSON.stringify([VERSION,c.id,c.W,c.D,g.params]);if(cache.has(key))return {...cache.get(key),cached:true};
 const started=performance.now(),connection=c.connection||(c.connection=entranceRoute(c)),arrival=connection.path.map(q=>{const a=c.local([q[0],q[2]]);return [a[0]-c.xmin,a[1],q[1]]}),targets={entry:[g.entry,1.5,0],foyer:[g.entry,3,0],living:[10,10,0],kitchen:[16,g.D-5,0],bedroom:[11,8,2],bathroom:[6,17+g.params.partition,2]};
 const routines=[['entry','foyer','kitchen','living','bedroom','bathroom','bedroom','entry'],['entry','foyer','living','kitchen','bathroom','bedroom','entry'],['entry','foyer','kitchen','bedroom','bathroom','living','entry']];
 const memo=new Map(),agents=[],errors=[...valid(g).errors,...(connection.valid?[]:[connection.reason])];let sum=0,success=0,attempts=0;
 for(let i=0;i<20;i++){const names=routines[i%3],path=[];for(let j=1;j<names.length;j++){const k=names[j-1]+'>'+names[j];if(!memo.has(k))memo.set(k,route(g,targets[names[j-1]],targets[names[j]]));const segment=memo.get(k);attempts++;if(segment){success++;sum+=segment.slice(1).reduce((s,q,j)=>s+dist(q,segment[j]),0);path.push(...segment);}else errors.push('No navigable route '+k);}
 agents.push({id:c.id+'-resident-'+String(i+1).padStart(2,'0'),routine:i%3,path:connection.valid?[...arrival,...path,...[...arrival].reverse()]:path,startMinute:420+i*7});}
 // Direct sight-line samples from the open unit threshold into living room.
 let exposed=0,samples=0;for(let x=5;x<=12;x+=1)for(let y=7;y<=12;y+=1){samples++;let hidden=false;for(let t=0;t<=1;t+=.03){const q=[g.entry+(x-g.entry)*t,1+(y-1)*t];if(g.objects.some(o=>o.kind==='partition'&&o.level===0&&q[0]>=o.x&&q[0]<=o.x+o.w&&q[1]>=o.y&&q[1]<=o.y+o.d)){hidden=true;break;}}if(!hidden)exposed++;}
 const privacy=round(100*(1-exposed/samples)),circulation=round(100*success/attempts),walkingFt=round(sum/20);
 const access=!!gridPath(g,targets.entry,targets.living,1.5)&&!!gridPath(g,targets.living,targets.kitchen,1.5);
 const daylight=round(clamp(1-g.objects.filter(o=>o.level===0&&o.h>5&&o.y>g.D-4).reduce((s,o)=>s+o.w,0)/g.W)*100);
 const clearance=round(100*success/attempts),score=round(.28*privacy+.32*circulation+.15*daylight+.15*clearance+.1*(access?100:0)-walkingFt*.015);
 const approachFt=arrival.slice(1).reduce((s,q,i)=>s+dist(q,arrival[i]),0);
 const result={agents,entranceConnected:connection.valid,approachFt:round(approachFt),privacy,circulation,walkingFt,daylight,clearance,accessibleGround:access,upperAccessible:false,score,valid:errors.length===0,errors:[...new Set(errors)],steps:agents.reduce((s,a)=>s+a.path.length,0),ms:round(performance.now()-started),cached:false,proxyNote:'Schematic geometry proxies; no daylight analysis, crowd-capacity or code certification.'};
 if(cache.size>100)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
}
export async function evolve(c,baseline=defaults,onGeneration=()=>{}){
 let best={geometry:generate(c,baseline),generation:0,index:0};best.result=simulate(c,best.geometry);const history=[best],rejected=[];
 for(let gen=1;gen<=3;gen++){
  const batch=[];
  for(let i=0;i<6;i++){
   const params={...best.geometry.params,screen:2+(i%3),furniture:[-.5,0,.5][i%3],foyer:i%2,partition:[-.5,0,.5][(i+gen)%3]};
   // Existing public vestibules/core openings are protected. Entrance dimensions
   // are read but not mutated until the physical connection audit passes.
   const geometry=generate(c,params),result=simulate(c,geometry),candidate={geometry,result,generation:gen,index:i};
   if(result.valid)batch.push(candidate);else rejected.push({generation:gen,index:i,errors:result.errors});
  }
  batch.sort((a,b)=>b.result.score-a.result.score||a.index-b.index);if(batch[0]&&batch[0].result.score>best.result.score)best=batch[0];
  history.push({...best,generation:gen,candidates:batch.length,rejected:6-batch.length});onGeneration(history.at(-1));await new Promise(r=>setTimeout(r,0));
 }
 return {history,best:history.at(-1),rejected,evaluations:18};
}
export function elements(c,g){
 const part=(poly,z,height,holes=[])=>({polygon:poly.map(q=>c.toWorld(...q)),z,height,holes:holes.map(h=>h.map(q=>c.toWorld(...q)))});
 const common={building:c.building,piece:c.piece,evolution:true,component:true,layer:'valley'};
 return [...g.objects.map(o=>({...common,id:o.id,level:o.level,type:o.kind==='partition'?'IFCWALL':o.kind==='door'?'IFCDOOR':o.kind==='tread'?'IFCSTAIRFLIGHT':'IFCFURNISHINGELEMENT',role:o.kind,color:o.kind==='partition'?0xe8e5dd:o.kind==='sofa'?0x426451:0xa38b68,parts:[{...part(o.kind==='door'?rect(o.x,o.y,.12,o.w):rect(o.x,o.y,o.w,o.d),o.z,o.h),...(o.elevations?{elevations:o.elevations}:{})}],assetKind:o.kind})),...g.floors.map(o=>({...common,id:o.id,level:o.level,type:'IFCSLAB',role:'Triplex internal floor',slab:true,color:0xe1dcd0,parts:[part(o.polygon,o.z,o.height,o.holes)]})),...g.rooms.map(o=>({...common,id:o.id,level:o.level,type:'IFCSPACE',space:true,role:o.name,color:0xb9c7b7,parts:[part(o.polygon,o.level*12+.75,10.5)]}))];
}
export function entranceRoute(c){
 const e=c.entrance,b=c.model.buildings.find(b=>b.id===c.building),core=c.model.pieces.find(p=>p.id===e.coreId);
 if(e.placementResolved===false)return {valid:false,path:[],reason:'Recessed vestibule does not fit protected core geometry. Existing exit remains; entrance simulation withheld.'};
 const n=e.normal,t=[n[1],-n[0]],world=(x,y)=>[e.position[0]+t[0]*x+n[0]*y,e.position[1]+t[1]*x+n[1]*y];
 const start=world(0,e.airlockDepth+e.canopyDepth+8),end=c.toWorld(c.doorX,1.5);
 const poly=rect(-e.vestibuleWidth/2,0,e.vestibuleWidth,e.airlockDepth).map(q=>world(...q));
 const grounds=c.model.elements.filter(x=>x.level===0&&x.building===c.building);
 const walls=grounds.filter(x=>x.type==='IFCWALL').flatMap(x=>x.parts.filter(p=>p.z<5&&p.z+p.height>2).map(p=>({...p,id:x.id})));
 const doorPts=grounds.filter(x=>x.type==='IFCDOOR').flatMap(x=>x.parts.map(p=>mid(p.polygon)));
 const bound=[...b.corridorOuter,...poly,start,end],min=[Math.min(...bound.map(q=>q[0]))-3,Math.min(...bound.map(q=>q[1]))-3],max=[Math.max(...bound.map(q=>q[0]))+3,Math.max(...bound.map(q=>q[1]))+3],step=.75,nx=Math.ceil((max[0]-min[0])/step)+1,ny=Math.ceil((max[1]-min[1])/step)+1;
 const local=q=>[(q[0]-e.position[0])*t[0]+(q[1]-e.position[1])*t[1],(q[0]-e.position[0])*n[0]+(q[1]-e.position[1])*n[1]];
 const connector=e.route.slice(1);
 const onConnector=q=>connector.slice(1).some((z,i)=>{const a=connector[i],v=[z[0]-a[0],z[1]-a[1]],t=clamp(((q[0]-a[0])*v[0]+(q[1]-a[1])*v[1])/(v[0]*v[0]+v[1]*v[1]));return dist(q,[a[0]+v[0]*t,a[1]+v[1]*t])<2.5;});
 const walk=q=>{
  const a=local(q),unit=c.local(q),inUnit=inside(q,c.piece.groundPolygon)&&dist(q,end)<3;
  return (inside(q,b.corridorOuter)&&!inside(q,b.corridorInner))||inside(q,core.polygon)||onConnector(q)||inside(q,poly)||(Math.abs(a[0])<2.5&&a[1]>=e.airlockDepth&&a[1]<=e.airlockDepth+e.canopyDepth+9)||inUnit||dist(q,c.origin)<2;
 };
 const free=q=>{
  if(!walk(q))return false;
  // Existing doorway openings are intentionally traversable, not entire walls.
  if(doorPts.some(p=>dist(p,q)<1.6))return true;
  return !walls.some(p=>inside(q,p.polygon)&&!(p.holes||[]).some(h=>inside(q,h)));
 };
 const cells=new Map(),key=(x,y)=>y*nx+x,point=(x,y)=>[min[0]+x*step,min[1]+y*step];
 const clear=(x,y)=>{if(x<0||y<0||x>=nx||y>=ny)return false;const k=key(x,y);if(!cells.has(k)){const q=point(x,y);cells.set(k,[[0,0],[.55,0],[-.55,0],[0,.55],[0,-.55]].every(d=>free([q[0]+d[0],q[1]+d[1]])));}return cells.get(k);};
 const near=q=>{let best=null,d=Infinity;const ix=Math.round((q[0]-min[0])/step),iy=Math.round((q[1]-min[1])/step);for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const x=ix+dx,y=iy+dy,dd=dist(q,point(x,y));if(dd<d&&clear(x,y)){best=[x,y];d=dd;}}return d<2?best:null};
 const s=near(start),target=near(end);if(!s||!target)return {valid:false,path:[],reason:'Entrance or unit doorway clearance could not be resolved.'};
 const queue=[s],prev=new Map([[key(...s),null]]);let finish=null;
 for(let i=0;i<queue.length;i++){const q=queue[i];if(key(...q)===key(...target)){finish=q;break;}for(const d of [[1,0],[0,1],[-1,0],[0,-1]]){const z=[q[0]+d[0],q[1]+d[1]],k=key(...z);if(!prev.has(k)&&clear(...z)){prev.set(k,q);queue.push(z);}}}
 if(!finish)return {valid:false,path:[],reason:'Existing entrance-to-valley connection is blocked by modeled walls. No invented connector was drawn.'};
 const path=[];for(let q=finish;q;q=prev.get(key(...q))){const p=point(...q);path.push([p[0],.75,p[1]]);}
 return {valid:true,path:path.reverse(),entranceId:e.id,checkedCells:cells.size,clearanceFt:1.1,reason:'Existing ground-wall clearance sampled at 0.75 ft grid; structure/MEP and full accessibility audit pending.'};
}
