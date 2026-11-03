// MEMO Superblock product catalog: research-only product mapping + five dimensioned pilot details.
// All source dimensions in feet; component provenance stays attached to each modeled part.
const inch=v=>v/12;
const product=(catalog,i)=>catalog.products[i];
const key=e=>String(e.role||'').toLowerCase();
export function candidateFor(e){
 const t=e.type||'',r=key(e);
 if(t==='IFCSPACE')return {category:'Spatial / non-manufactured',indices:[],status:'nonproduct'};
 if(e.specPilot)return {category:'Dimensioned pilot',indices:[e.specProductIndex],status:'dimensioned-prototype'};
 if(t==='IFCWALL'){
  if(e.demising||r.includes('demising')||r.includes('opaque side')||r.includes('shared wall'))return {category:'Demising walls',indices:[3,5,6],status:'assembly-candidate'};
  if(e.parapet||r.includes('parapet'))return {category:'Parapets',indices:[18,12],status:'assembly-candidate'};
  if(e.envelopeDetail||e.facade||r.includes('enclosure')||r.includes('facade'))return {category:'Exterior walls',indices:[0,1,2],status:'assembly-candidate'};
  if(e.piece?.core||r.includes('core'))return {category:'Core walls',indices:[3,5,6],status:'assembly-candidate'};
  return {category:'Interior partitions',indices:[3,4,5,6],status:'assembly-candidate'};
 }
 if(t==='IFCSLAB'){
  if(e.roof&&!e.terrace)return {category:'Roofs',indices:[12,13,14],status:'assembly-candidate'};
  if(e.terrace||r.includes('terrace'))return {category:'Terraces',indices:[15,16,17,12],status:'assembly-candidate'};
  if(r.includes('paving')||r.includes('courtyard'))return {category:'Site paving',indices:[],status:'needs-civil-catalog'};
  return {category:'Floors / slabs',indices:[8,9,10],status:'assembly-candidate'};
 }
 if(t==='IFCDOOR')return e.glazing||e.designEntrance?{category:'Exterior glazed doors',indices:[21,20,29],status:'assembly-candidate'}:e.exitDoor||r.includes('stair')?{category:'Rated / egress doors',indices:[24,25,26,27,29],status:'assembly-candidate'}:{category:'Interior doors',indices:[22,23,28,29],status:'assembly-candidate'};
 if(t==='IFCWINDOW')return {category:'Windows',indices:[32,33,38],status:'assembly-candidate'};
 if(t==='IFCCURTAINWALL')return {category:'Curtain walls',indices:[34,35,36,38],status:'assembly-candidate'};
 if(t==='IFCMEMBER'&&e.facade)return {category:'Mullions / transoms',indices:[37],status:'assembly-candidate'};
 if(t==='IFCCOVERING')return {category:'Finish / covering',indices:[1,2,9,10,11],status:'assembly-candidate'};
 if(t==='IFCRAILING')return {category:'Railings',indices:[],status:'awaiting-product-research'};
 if(t==='IFCDISCRETEACCESSORY'&&e.doorAssembly)return {category:'Door accessories',indices:[29,30,31],status:'assembly-candidate'};
 if(t==='IFCBUILDINGELEMENTPROXY'&&e.doorAssembly)return {category:'Door thresholds / seals',indices:[29,30,31],status:'assembly-candidate'};
 if(t==='IFCGEOGRAPHICELEMENT')return {category:'Site / landscape',indices:[],status:'outside-study-scope'};
 if(['IFCCOLUMN','IFCBEAM','IFCFOOTING','IFCSTAIRFLIGHT','IFCRAMPFLIGHT','IFCTRANSPORTELEMENT'].includes(t))return {category:'Structure / circulation',indices:[],status:'outside-study-scope'};
 return {category:'Additional BIM category',indices:[],status:'awaiting-product-research'};
}
function strip(a,b,n,from,to){return [a.map((v,i)=>v+n[i]*from),b.map((v,i)=>v+n[i]*from),b.map((v,i)=>v+n[i]*to),a.map((v,i)=>v+n[i]*to)];}
function add(a,b,t){return a.map((v,i)=>v+(b[i]-v)*t);}
function sampleEdge(poly,desired=4){if(!poly||poly.length<3)return null;let best=null;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d>(best?.len||0))best={a,b,len:d};}if(!best||best.len<2)return null;const center=add(best.a,best.b,.5),u=[(best.b[0]-best.a[0])/best.len,(best.b[1]-best.a[1])/best.len],n=[-u[1],u[0]],half=Math.min(desired,best.len-.2)/2;return {a:center.map((v,i)=>v-u[i]*half),b:center.map((v,i)=>v+u[i]*half),u,n};}
function prototype(source,number,suffix,type,parts,role,more={}){
 return {id:'SPEC-PILOT:'+source.id+':'+suffix,type,parts,role,
 piece:source.piece,building:source.building,level:source.level,layer:source.layer,
 specPilot:true,specProductIndex:number,specHostId:source.id,
 specDimensionalBasis:'Manufacturer-published dimensions; model geometry is a prototype, not a certified manufacturer family',
 specVerification:'CHECK — no manufacturer CAD cross-section or tested assembly imported',
 lodMin:350,component:true,facade:!!source.facade,color:more.color??0x879b8a,...more};
}
function pilotForWall(source,results){
 const p=source.parts?.find(x=>x.polygon?.length>=3&&x.height>=4);if(!p)return;
 const e=sampleEdge(p.polygon,4);if(!e)return;
 // Demonstration section: 3-5/8 in stud cavity, both 5/8 in Firecode X faces.
 // One local demising host; not asserted as a tested UL assembly or globally applied.
 const span=Math.min(p.height,8),z=p.z+.04,board=inch(5/8),cavity=inch(3+5/8),insulation=inch(3.5);
 const face=inch(5/8),start=-cavity/2;
 for(const [j,side] of [-1,1].entries()){
  const o=side<0?start-board:cavity/2;
  results.push(prototype(source,3,'USG-TYPE-X-'+j,'IFCCOVERING',[{polygon:strip(e.a,e.b,e.n,o,o+board),z,height:span}],'USG Sheetrock Firecode X / 5/8 in Type X board',{color:0xf6efe4,layerThicknessFt:board,side}));
 }
 // Exact purchased batt thickness, but its positioning is a study until assembly is approved.
 // Divide insulation into unobstructed stud bays: batt geometry never penetrates steel studs.
 const fullLength=Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]),gap=inch(1.25)+.01;
 const bayLimits=[0,...[0,1,2].flatMap(j=>{const c=fullLength*(j+.5)/3;return [c-gap,c+gap]}),fullLength],batts=[];
 for(let i=0;i<bayLimits.length-1;i+=2){const lo=Math.max(0,bayLimits[i]),hi=Math.min(fullLength,bayLimits[i+1]);if(hi-lo<.05)continue;
  const a=add(e.a,e.b,lo/fullLength),b=add(e.a,e.b,hi/fullLength);
  batts.push({polygon:strip(a,b,e.n,-insulation/2,insulation/2),z,height:Math.min(span,4)});
 }
 if(batts.length)results.push(prototype(source,6,'AFB-EVO','IFCCOVERING',batts,'ROCKWOOL AFB evo / 3-1/2 in acoustic batts / stud-bay separated',{color:0xb2a48b,layerThicknessFt:insulation}));
 // ProSTUD 20: 18 mil (0.018 in) steel; model as three cross-section webs and flanges.
 const gauge=inch(.018),flange=inch(1.25),studDepth=cavity;
 for(let j=0;j<3;j++){
  const point=add(e.a,e.b,(j+.5)/3),w=.025;
  const webA=point.map((v,i)=>v-e.u[i]*gauge/2),webB=point.map((v,i)=>v+e.u[i]*gauge/2);
  const parts=[{polygon:strip(webA,webB,e.n,-studDepth/2,studDepth/2),z,height:span}];
  for(const side of [-1,1]){
   const a=point.map((v,i)=>v-e.u[i]*gauge/2),b=point.map((v,i)=>v+e.u[i]*flange);
   parts.push({polygon:strip(a,b,e.n,side*studDepth/2-gauge/2,side*studDepth/2+gauge/2),z,height:span});
  }
  results.push(prototype(source,5,'PROSTUD-20-'+j,'IFCMEMBER',parts,'ClarkDietrich ProSTUD 20 / 3-5/8 in web, 1-1/4 in flange, 18 mil',{color:0x68737c,metalGaugeFt:gauge,studWebFt:studDepth,studFlangeFt:flange}));
 }
}
function pilotForRoof(source,results){
 const p=source.parts?.find(x=>x.polygon?.length>=3&&x.height>0);if(!p)return;
 const thickness=inch(.060); // 60 mil = 0.060 inches; render at actual thickness.
 results.push(prototype(source,12,'CARLISLE-60MIL','IFCCOVERING',[{polygon:p.polygon,holes:p.holes||[],z:p.z+p.height,height:thickness}],'Carlisle Sure-Weld TPO / 60-mil membrane, geometry-only',{color:0xe8e8e1,layerThicknessFt:thickness,roof:true}));
}
function pilotForWindow(source,results){
 const p=source.parts?.find(x=>x.polygon?.length>=3&&x.height>=2);if(!p)return;const ed=sampleEdge(p.polygon,Math.min(5,Math.max(2,Math.sqrt(4*Math.abs(p.height)))));if(!ed)return;
 const depth=inch(3.5),face=inch(1.5),height=Math.min(6,p.height),z=p.z;
 // 3.5 in YOW 350 XT nominal frame depth is manufacturer data; 1.5 in visible
 // face width is UNVERIFIED and must be replaced using exact YKK shop drawings.
 const parts=[
 {polygon:strip(ed.a,ed.a.map((v,i)=>v+ed.u[i]*face),ed.n,-depth/2,depth/2),z,height},
 {polygon:strip(ed.b.map((v,i)=>v-ed.u[i]*face),ed.b,ed.n,-depth/2,depth/2),z,height},
 {polygon:strip(ed.a,ed.b,ed.n,-depth/2,depth/2),z,height:face},
 {polygon:strip(ed.a,ed.b,ed.n,-depth/2,depth/2),z:z+height-face,height:face}
 ];
 results.push(prototype(source,32,'YKK-YOW350-XT-FRAME','IFCMEMBER',parts,'YKK AP YOW 350 XT / nominal 3-1/2 in frame depth; visible face placeholder',{color:0x596a6a,frameDepthFt:depth,provisionalFaceFt:face,geometryStatus:'Nominal depth exact; extrusion shape / visible sightline not yet verified'}));
}
export function applySpecs(model,catalog){
 const counts=new Map(),byClass=new Map();let mapped=0,unmapped=0;
 for(const e of model.elements){
  const c=candidateFor(e),p=c.indices.map(i=>product(catalog,i)).filter(Boolean);
  e.specs={
   scope:'MEMO Architecture & Facade manufacturer study (2026-10-27)',
   category:c.category,status:c.status,approved:false,manufactured:c.status!=='nonproduct',
   productIds:c.indices,primary:p[0]?{manufacturer:p[0].Manufacturer,family:p[0]['Verified product / family'],source:p[0]['Official technical source URL'],publishedDimensions:p[0]['Published dimensions / make-up'],publishedPerformance:p[0]['Published performance / standards']} :null,
   alternatives:p.slice(1).map(x=>({manufacturer:x.Manufacturer,family:x['Verified product / family']})),
   exactNativeBRep:false,complianceVerified:false
  };
  counts.set(c.category,(counts.get(c.category)||0)+1);byClass.set(e.type,(byClass.get(e.type)||0)+1);
  if(c.indices.length)mapped++;else unmapped++;
 }
 const sample=[],used=new Set();
 for(const e of model.elements){
  if(used.has(e.building)||!e.demising||!e.parts?.some(p=>p.height>4))continue;
  if(!['B1','B2','B3','B4'].includes(e.building))continue;
  pilotForWall(e,sample);used.add(e.building);
 }
 const usedRoof=new Set(),usedWindow=new Set();
 for(const e of model.elements){
  if(!['B1','B2','B3','B4'].includes(e.building))continue;
  if(e.type==='IFCSLAB'&&e.roof&&!e.terrace&&!usedRoof.has(e.building)){pilotForRoof(e,sample);usedRoof.add(e.building);}
  if(e.type==='IFCWINDOW'&&!usedWindow.has(e.building)){pilotForWindow(e,sample);usedWindow.add(e.building);}
 }
 for(const e of sample) {const c=candidateFor(e),p=product(catalog,e.specProductIndex);e.specs={scope:'Five product dimensioned prototype',category:c.category,status:c.status,approved:false,productIds:[e.specProductIndex],primary:{manufacturer:p.Manufacturer,family:p['Verified product / family'],source:p['Official technical source URL'],publishedDimensions:p['Published dimensions / make-up'],publishedPerformance:p['Published performance / standards']},exactNativeBRep:false,complianceVerified:false};}
 model.elements.push(...sample);
 return {total:counts.size?mapped+unmapped:0,mapped,unmapped,categories:Object.fromEntries(counts),ifcClasses:Object.fromEntries(byClass),pilotElements:sample.length,pilotProducts:[3,5,6,12,32].map(i=>product(catalog,i)['Verified product / family']),pilotHostCount:used.size,roofHostCount:usedRoof.size,windowHostCount:usedWindow.size};
}
