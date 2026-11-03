// Ground-floor privacy protection. Coordinates and lengths are in feet.
// The generator occupies the existing recessed residential strip: it never
// widens into the public sidewalk or shifts the building envelope.
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const mix=(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t);
const nearSegment=(p,a,b)=>{
 const dx=b[0]-a[0],dy=b[1]-a[1],ll=dx*dx+dy*dy||1;
 const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/ll));
 const q=[a[0]+t*dx,a[1]+t*dy];return {point:q,distance:distance(p,q)};
};
const extrude=(a,b,normal,lo,hi)=>[
 [a[0]+normal[0]*lo,a[1]+normal[1]*lo],
 [b[0]+normal[0]*lo,b[1]+normal[1]*lo],
 [b[0]+normal[0]*hi,b[1]+normal[1]*hi],
 [a[0]+normal[0]*hi,a[1]+normal[1]*hi]
];
function nearestFrontage(a,b,perimeter){
 const mid=mix(a,b,.5),len=distance(a,b),axis=[(b[0]-a[0])/len,(b[1]-a[1])/len];
 let best=null;
 for(let i=0;i<perimeter.length;i++){
  const c=perimeter[i],d=perimeter[(i+1)%perimeter.length],ll=distance(c,d);
  if(!ll)continue;
  const tangent=[(d[0]-c[0])/ll,(d[1]-c[1])/ll];
  if(Math.abs(axis[0]*tangent[0]+axis[1]*tangent[1])<.96)continue;
  const candidate=nearSegment(mid,c,d);
  if(!best||candidate.distance<best.distance)best=candidate;
 }
 if(!best||best.distance<1||best.distance>7.5)return null;
 return {distance:best.distance,normal:[(best.point[0]-mid[0])/best.distance,(best.point[1]-mid[1])/best.distance]};
}
export function createResidentialPrivacyBuffers(buildings,pieces,entrances=[],settings={}){
 const elems=[],report={screenedFrontageFt:0,plantedModules:0,verticalFins:0,protectedUnits:0,skippedEntranceModules:0,unprotectedUnits:[],review:[]};
 const maxDepth=Math.max(1,Math.min(6,Number(settings.maxDepth)||5.5));
 const wallClearanceFt=3.0, hedgeClearanceFt=4.0;
 const excludes=entrances.filter(e=>e.position&&e.normal).map(e=>({
  start:e.position,
  end:[e.position[0]+e.normal[0]*(e.airlockDepth+e.canopyDepth+9),e.position[1]+e.normal[1]*(e.airlockDepth+e.canopyDepth+9)],
  half:e.width/2+3
 }));
 for(const p of pieces){
  if(p.core||p.retail||p.office||!p.kind?.startsWith('outer')||!p.groundPolygon?.length)continue;
  const b=buildings.find(b=>b.id===p.building);if(!b?.outer)continue;
  let protection=0;
  const ring=p.groundPolygon;
  for(let i=0;i<ring.length;i++){
   const a=ring[i],c=ring[(i+1)%ring.length],len=distance(a,c);
   if(len<9)continue;
   const front=nearestFrontage(a,c,b.outer);if(!front)continue;
   const usable=len-4,count=Math.max(1,Math.ceil(usable/10)),moduleLen=usable/count;
   const far=Math.min(maxDepth,front.distance-.6);
   // Shallow setbacks cannot safely accommodate shrubs: leave clean paving instead.
   if(far<hedgeClearanceFt+.8)continue;
   for(let k=0;k<count;k++){
    const a0=mix(a,c,(2+k*moduleLen)/len),b0=mix(a,c,(2+(k+1)*moduleLen)/len);
    const middle=mix(a0,b0,.5);
    // Preserve every modeled entrance's forecourt, core discharge and approach.
    if(excludes.some(e=>nearSegment(middle,e.start,e.end).distance<e.half+moduleLen*.5)){
     report.skippedEntranceModules++;continue;
    }
    const stem=p.id+'-PRIV-E'+i+'-'+k,n=front.normal;
    const common={building:p.building,piece:p,level:0,layer:'valley',component:true,facade:true,privacy:true,designStage:'SCHEMATIC'};
    const emit=(suffix,type,role,polygon,z,height,color)=>elems.push({...common,id:stem+'-'+suffix,type,role,parts:[{polygon,z,height}],color});
    // All elements stay between the recessed façade and the original perimeter.
    emit('rain-bed','IFCBUILDINGELEMENTPROXY','Ground-floor residential planted setback',extrude(a0,b0,n,wallClearanceFt,far),.55,.25,0x9a9d90);
    emit('hedge','IFCFURNISHINGELEMENT','Layered evergreen screening / 3.5 ft high',extrude(a0,b0,n,hedgeClearanceFt,Math.min(far-.25,hedgeClearanceFt+.7)),.85,2.25,0x345d43);
    // Spaced vertical fins provide filtered views, not an opaque wall across windows.
    const fins=Math.max(1,Math.floor(moduleLen/3.5));
    for(let j=1;j<=fins;j++){
     const q=mix(a0,b0,j/(fins+1)),dir=[(b0[0]-a0[0])/moduleLen,(b0[1]-a0[1])/moduleLen];
     const q0=[q[0]-dir[0]*.10,q[1]-dir[1]*.10],q1=[q[0]+dir[0]*.10,q[1]+dir[1]*.10];
     emit('fin-'+j,'IFCBUILDINGELEMENTPROXY','Filtered residential sightline fin',extrude(q0,q1,n,1.6,Math.min(far,2.2)),.75,6.6,0x846f55);report.verticalFins++;
    }
    report.plantedModules++;report.screenedFrontageFt+=moduleLen;protection++;
   }
  }
  if(protection)report.protectedUnits++;else report.unprotectedUnits.push(p.id);
 }
 report.screenedFrontageFt=Math.round(report.screenedFrontageFt*10)/10;
 if(report.unprotectedUnits.length)report.review.push('Unprotected outer residential units require local setback/clearance review: '+report.unprotectedUnits.length);
 report.review.push('Privacy fins and planting are schematic; check daylight, fire access, drainage, soil volume, sightlines and minimum public clear width.');
 return {elements:elems,report};
}
