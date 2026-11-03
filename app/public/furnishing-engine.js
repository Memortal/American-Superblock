/* MEMO Furnishing Lab — deterministic planning in local feet.
   These are conservative schematic clearances, not accessibility certification.
   Product imagery and 3D assets must be provided by their rights holder/user. */
import {route,gridPath} from './evolution-engine.js';
const round=n=>Math.round(n*100)/100;
const intersects=(a,b,margin=0)=>a.x<b.x+b.w+margin&&a.x+a.w+margin>b.x&&a.y<b.y+b.d+margin&&a.y+a.d+margin>b.y;
const box=o=>({x:o.x,y:o.y,w:o.w,d:o.d});
const inBounds=(a,g,margin=.15)=>a.x>=margin&&a.y>=margin&&a.x+a.w<=g.W-margin&&a.y+a.d<=g.D-margin;
const decoration=new Set(['rug','mirror','light','rail','tread','landing','stringer']);
const wallKinds=new Set(['partition']);
const mobility=new Set(['sofa','table','chair','bench','desk','wardrobe','cabinet','vanity','fridge','bed','console','nightstand']);
const fixtures=new Set(['vanity','toilet','sink','shower','stove','fridge','wardrobe','cabinet','bed','sofa','desk','table']);
const clearance={
  door:3.5,vanity:2.5,toilet:2.5,shower:2.5,sink:2.5,fridge:3,
  wardrobe:2.5,cabinet:2.5,bed:2,sofa:2.5,desk:3,table:2.5,
  chair:1.5,bench:2,default:1.5
};
function physical(o){return !decoration.has(o.kind)&&!o.nonBlocking&&o.h>.5;}
function safeObject(o){return o.kind!=='door'&&physical(o)}
export function doorZones(g){
 return (g.doors||g.objects.filter(o=>o.kind==='door')).map(d=>{
   const isAlongX=d.axis!=='y',width=d.clearWidthFt||3.5;
   // Include threshold / door leaf / approach on both sides, conservative to avoid vanity clashes.
   return {id:d.id,level:d.level,x:isAlongX?d.x-.5:d.x-width-.9,
      y:isAlongX?d.y-1.5:d.y-.7,
      w:isAlongX?Math.max(d.w,width)+1:width+1.8,
      d:isAlongX?5:Math.max(d.d,width)+1.4};
 });
}
function useZone(o){
 const clear=o.useClearanceFt??clearance[o.kind]??clearance.default;
 // Operational side of furniture: front of cabinet / vanity / bed / sofa.
 return {id:o.id,level:o.level,x:Math.max(0,o.x-.15),y:o.y+o.d,w:o.w+.3,d:clear};
}
export function conflicts(g,extra=[]){
 const all=[...g.objects,...extra],solid=all.filter(safeObject);
 const out=[],push=(type,a,b,description)=>out.push({type,a,b,description});
 for(const o of solid){
   if(!inBounds(box(o),g,0))push('bounds',o.id,'unit','Outside unit boundary');
   const dz=doorZones(g).filter(z=>z.level===o.level);
   for(const z of dz)if(intersects(o,z,.05))push('door-clearance',o.id,z.id,'Blocks unit doorway or door approach');
 }
 for(let i=0;i<solid.length;i++)for(let j=i+1;j<solid.length;j++){
  const a=solid[i],b=solid[j];if(a.level!==b.level)continue;
  // Fixtures mounted on cabinets and furniture overlays are meaningful composites;
  // do not mistake their occupied volumes for two furniture objects.
  if((['sink','stove'].includes(a.kind)&&b.kind==='cabinet')||(['sink','stove'].includes(b.kind)&&a.kind==='cabinet'))continue;
  if(intersects(a,b,.05))push('overlap',a.id,b.id,'Physical object intersection');
 }
 return out;
}
function accessibleUse(g,o,extra=[]){
 const clear=o.useClearanceFt??clearance[o.kind]??clearance.default;
 const zone=useZone(o),all=[...g.objects,...extra].filter(q=>q.id!==o.id&&q.level===o.level&&safeObject(q));
 if(!inBounds({x:zone.x,y:zone.y,w:zone.w,d:zone.d},g,0)||all.some(x=>intersects(x,zone,.02)))return false;
 const point=[Math.max(.9,Math.min(g.W-.9,o.x+o.w/2)),Math.max(.9,Math.min(g.D-.9,o.y+o.d+Math.min(clear/2,1.1))),o.level];
 const start=g.targets?.entry||[g.entry,2,0];
 if(o.level===start[2])return !!gridPath({...g,objects:[...g.objects,...extra]},start,point,.55);
 return !!route({...g,objects:[...g.objects,...extra]},start,point,.55);
}
export function inspectFunctionalLayout(g,extra=[]){
 const issues=conflicts(g,extra);
 const checked=[...g.objects,...extra].filter(o=>fixtures.has(o.kind)&&physical(o));
 const use=checked.map(o=>({id:o.id,kind:o.kind,level:o.level,reachable:accessibleUse(g,o,extra),requiredClearanceFt:o.useClearanceFt??clearance[o.kind]}));
 const rooms=g.rooms.map(r=>{
  const source=g.targets?.entry||[g.entry,2,0],point=r.target;
  const path=source[2]===point[2]?gridPath({...g,objects:[...g.objects,...extra]},source,point,.55):route({...g,objects:[...g.objects,...extra]},source,point,.55);
  return {id:r.id,name:r.name,level:r.level,reachable:!!path,pathLengthFt:path?.slice(1).reduce((s,q,i)=>s+Math.hypot(...q.map((v,k)=>v-path[i][k])),0)||null};
 });
 const inaccessible=use.filter(u=>!u.reachable).map(u=>u.id);
 const blockedRooms=rooms.filter(r=>!r.reachable).map(r=>r.id);
 return {valid:issues.length===0&&blockedRooms.length===0&&inaccessible.length===0,issues,rooms,use,inaccessible,blockedRooms,disclaimer:'Plan-level clearance screening only; not an accessibility or life-safety certification'};
}
export function validateNewFurniture(g,item,x,y,level=0,extra=[]){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!item||!(item.widthFt>0)||!(item.depthFt>0)||!(item.heightFt>0))
  return {valid:false,reasons:['Product must have verified dimensions in feet']};
 const o={id:item.id||'candidate',kind:item.kind||'cabinet',x,y,z:level*12+.75,w:item.widthFt,d:item.depthFt,h:item.heightFt,level,useClearanceFt:item.clearanceFt??clearance[item.kind]??2.5};
 const issues=conflicts(g,[...extra,o]).filter(e=>e.a===o.id||e.b===o.id);
 const reachable=!issues.length&&accessibleUse(g,o,extra);
 const reasons=issues.map(x=>x.description+' ('+x.b+')');
 if(!reachable)reasons.push('Required use zone has no verified room access or is obstructed');
 return {valid:!reasons.length,reasons,object:o};
}
export function findFurnitureLocation(g,item,{level=0,roomId=null,additional=[]}={}){
 const room=roomId?g.rooms.find(r=>r.id===roomId):null;
 function inside(p,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++)if((ring[i][1]>p[1])!==(ring[j][1]>p[1])&&p[0]<(ring[j][0]-ring[i][0])*(p[1]-ring[i][1])/(ring[j][1]-ring[i][1])+ring[i][0])c=!c;return c;}
 const trials=[];for(const turn of [false,true]){
  const candidate=turn?{...item,widthFt:item.depthFt,depthFt:item.widthFt,rotation:90}:{...item,rotation:0};
  for(let y=.5;y<=g.D-candidate.depthFt-.25;y+=.75)for(let x=.5;x<=g.W-candidate.widthFt-.25;x+=.75){
   if(room&&(!inside([x+.1,y+.1],room.polygon)||!inside([x+candidate.widthFt-.1,y+candidate.depthFt-.1],room.polygon)))continue;
   const check=validateNewFurniture(g,candidate,x,y,level,additional);
   if(check.valid)trials.push({object:check.object,rotation:turn?90:0,score:Math.hypot(x-g.W/2,y-g.D/2)});
  }
 }
 trials.sort((a,b)=>a.score-b.score);return trials[0]||null;
}
export function repairDoorFurnitureClashes(g){
 // Move only self-contained movable fixtures; keep openings and structural
 // partitions fixed. If no collision-free position exists, report unresolved.
 const repairs=[],unresolved=[],zones=doorZones(g);
 for(const z of zones){
  for(const o of g.objects.filter(o=>o.level===z.level&&mobility.has(o.kind)&&intersects(o,z,.05))){
   const origin={x:o.x,y:o.y},room=g.rooms.find(r=>r.level===o.level&&o.x+o.w/2>=Math.min(...r.polygon.map(p=>p[0]))&&o.x+o.w/2<=Math.max(...r.polygon.map(p=>p[0]))&&o.y+o.d/2>=Math.min(...r.polygon.map(p=>p[1]))&&o.y+o.d/2<=Math.max(...r.polygon.map(p=>p[1])));
   const options=[];for(let dx=-8;dx<=8;dx+=.5)for(let dy=-8;dy<=8;dy+=.5){
    const nx=origin.x+dx,ny=origin.y+dy,trial={...o,x:nx,y:ny};
    if(!inBounds(trial,g,.15)||zones.some(q=>q.level===o.level&&intersects(trial,q,.05)))continue;
    if(g.objects.some(a=>a!==o&&a.level===o.level&&safeObject(a)&&!(a.kind==='cabinet'&&['sink','stove'].includes(o.kind))&&intersects(a,trial,.05)))continue;
    if(room){const b=room.polygon;const minx=Math.min(...b.map(p=>p[0])),maxx=Math.max(...b.map(p=>p[0])),miny=Math.min(...b.map(p=>p[1])),maxy=Math.max(...b.map(p=>p[1]));if(nx<minx||ny<miny||nx+o.w>maxx||ny+o.d>maxy)continue;}
    options.push({x:nx,y:ny,cost:Math.hypot(dx,dy)});
   }
   options.sort((a,b)=>a.cost-b.cost);
   if(options.length){o.x=options[0].x;o.y=options[0].y;repairs.push({object:o.id,from:origin,to:{x:o.x,y:o.y},reason:'Door approach clearance'});}
   else unresolved.push({object:o.id,door:z.id,reason:'No conflict-free placement; manual redesign required'});
  }
 }
 return {repairs,unresolved};
}
export const STORES=[
 {name:'IKEA',url:'https://www.ikea.com/us/en/search/?q=',specialty:'Value furniture; some items offer official interactive 3D views'},
 {name:'Article',url:'https://www.article.com/search?query=',specialty:'Contemporary sofas, tables, bedroom furniture'},
 {name:'West Elm',url:'https://www.westelm.com/search/results.html?words=',specialty:'Modern retail furnishings'},
 {name:'Herman Miller',url:'https://www.hermanmiller.com/search/?q=',specialty:'Ergonomic furniture and seating'},
 {name:'BIMobject',url:'https://www.bimobject.com/en/search?query=',specialty:'Manufacturer BIM files with dimensions'},
 {name:'Sketchfab',url:'https://sketchfab.com/search?q=',specialty:'Licensed/downloadable glTF assets; may not represent retail SKU'}
];
export function coupleDay(g,day=1,placed=[]){
 const shopping=[
  {kind:'bed',label:'Comfortable bed',need:'sleep',priority:1},
  {kind:'table',label:'Dining table',need:'eat together',priority:2},
  {kind:'sofa',label:'Two-person sofa',need:'relax together',priority:3},
  {kind:'desk',label:'Work desk',need:'work from home',priority:4},
  {kind:'cabinet',label:'Entry storage',need:'store essentials',priority:5}
 ];
 const owned=new Set([...g.objects,...placed].map(o=>o.kind));
 const unmet=shopping.filter(q=>!owned.has(q.kind)).slice(0,Math.min(3,1+Math.floor(day/4)));
 const routines=[
  {resident:'Resident A',activity:'Wake · wash · cook · work · rest',steps:['bedroom','bathroom','kitchen','work','living','bedroom']},
  {resident:'Resident B',activity:'Wake · make breakfast · wash · relax · sleep',steps:['bedroom','kitchen','bathroom','living','bedroom']}
 ];
 const result=routines.map(r=>{
  const itinerary=['entry',...r.steps.filter(id=>g.targets?.[id]),'entry'],segments=[],missed=[];
  for(let i=1;i<itinerary.length;i++){
   const a=g.targets[itinerary[i-1]],b=g.targets[itinerary[i]];
   let p=null;try{p=route({...g,objects:[...g.objects,...placed]},a,b,.6);}catch{}
   if(!p){missed.push(itinerary[i]);continue;}
   segments.push(...(segments.length?p.slice(1):p));
  }
  return {...r,segments,unreachable:missed,walkFt:round(segments.slice(1).reduce((s,p,i)=>s+Math.hypot(...p.map((n,j)=>n-segments[i][j])),0))};
 });
 return {day,residents:result,needs:unmet,allRoomsReachable:result.every(r=>!r.unreachable.length),note:'Deterministic household routine; needs are illustrative, no purchases or live product inventory'};
}
