// MEMO geometry contract. Source coordinates: feet, X/Y plan, Z up.
// Native exchange coordinates: metres, X/-Y plan, Z up.
export const VERSION='MEMO-GEOMETRY-2';
const F=.3048,round=n=>Math.round(n*1e8)/1e8;
export const canonical=v=>JSON.stringify(sort(v));
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])]));return typeof v==='number'?round(v):v;}
export async function digest(v){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof v==='string'?v:canonical(v)));return [...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');}
const area=r=>r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1]},0)/2;
function crosses(a,b,c,d){const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);return turn(a,b,c)*turn(a,b,d)<-1e-12&&turn(c,d,a)*turn(c,d,b)<-1e-12;}
export function validatePart(p){
 const errors=[];if(!p.polygon||p.polygon.length<3)return ['Missing profile'];
 if(!Number.isFinite(p.z)||!Number.isFinite(p.height)||p.height<=0)errors.push('Non-positive or nonfinite height');
 const rings=[p.polygon,...p.holes||[]];
 for(const r of rings){if(r.some(q=>q.length!==2||q.some(v=>!Number.isFinite(v))))errors.push('Invalid coordinate');
 if(Math.abs(area(r))<1e-8)errors.push('Degenerate profile');
 for(let i=0;i<r.length;i++)for(let j=i+2;j<r.length;j++){if(i===0&&j===r.length-1)continue;if(crosses(r[i],r[(i+1)%r.length],r[j],r[(j+1)%r.length]))errors.push('Self-intersecting profile');}}
 if(p.elevations&&(p.elevations.length!==p.polygon.length||p.elevations.some(v=>!Number.isFinite(v))))errors.push('Invalid elevation array');
 if(p.topPolygon){if(p.topPolygon.length!==p.polygon.length)errors.push('Mismatched loft profiles');else errors.push(...validatePart({polygon:p.topPolygon,holes:p.topHoles||[],z:p.z,height:p.height}).map(x=>'Top: '+x));}
 return [...new Set(errors)];
}
export function category(e){
 if(e.designEntrance)return 'ENTRANCES';
 if(e.mep)return 'MEP';
 if(e.structural)return 'STRUCTURE';
 if(e.landscape)return 'LANDSCAPE';
 if(e.site)return 'SITE';
 if(e.parking||e.building==='CORE')return 'PARKING';
 if(e.circulation||['IFCSTAIRFLIGHT','IFCRAMPFLIGHT'].includes(e.type))return 'CIRCULATION';
 if(e.glazing||e.facade||e.roof)return 'ENVELOPE';
 if(e.space)return 'UNITS';
 return 'ARCHITECTURE';
}
export function normalizeElement(e){
 const parts=e.parts||[],pts=parts.flatMap(p=>[...p.polygon||[],...p.topPolygon||[]]),origin=pts.length?[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.min(...parts.map(p=>p.z+Math.min(0,...p.elevations||[])))]:[0,0,0];
 const local=parts.map(p=>({polygon:p.polygon.map(q=>q.map((v,i)=>round(v-origin[i]))),holes:(p.holes||[]).map(r=>r.map(q=>q.map((v,i)=>round(v-origin[i])))),z:round(p.z-origin[2]),height:round(p.height),...(p.elevations?{elevations:p.elevations.map(round)}:{}),...(p.topPolygon?{topPolygon:p.topPolygon.map(q=>q.map((v,i)=>round(v-origin[i]))),topHoles:(p.topHoles||[]).map(r=>r.map(q=>q.map((v,i)=>round(v-origin[i]))))}:{})}));
 const errors=parts.flatMap((p,i)=>validatePart(p).map(x=>'part '+i+': '+x));
 const sourceId=e.id;
 if(!sourceId)errors.push('Missing source identity');
 const identityWarnings=/column-[-\d]|ST-|^E\d+$|^O\d+$/.test(sourceId||'')?['Legacy generator identity may change after topology edits; lineage unresolved.']:[];
 const volume=parts.reduce((s,p)=>s+(Math.abs(area(p.polygon))-(p.holes||[]).reduce((s,r)=>s+Math.abs(area(r)),0))*p.height,0)*F**3;
 const shape=e.nativeShape||{type:parts.some(p=>p.topPolygon)?'loft_profile_set':'profile_set',parts:local};
 const d={id:sourceId,sourceId,building:e.building||'SITE',level:e.level??0,category:category(e),ifcClass:e.type||'IFCBUILDINGELEMENTPROXY',generator:VERSION,dependencies:[e.piece?.id||e.pieceId||sourceId,'building:'+e.building,'level:'+e.level],material:{color:e.color??0xffffff,glazing:!!e.glazing},properties:{bim:e.bim,role:e.role||e.type,identityWarnings,space:!!e.space,doorAssembly:e.doorAssembly,doorComponent:e.doorComponent,lodMin:e.lodMin,doorSchedule:e.doorRecord?Object.fromEntries(Object.entries(e.doorRecord).filter(([k])=>k!=='piece')):undefined},transform:origin,shape,sourceUnits:'ft',exchangeUnits:'m',dimensionsFt:pts.length?[Math.max(...pts.map(p=>p[0]))-origin[0],Math.max(...pts.map(p=>p[1]))-origin[1],Math.max(...parts.map(p=>p.z+p.height+Math.max(0,...p.elevations||[])))-origin[2]]:null,analyticVolumeM3:!parts.some(p=>p.topPolygon)&&parts.length&&Number.isFinite(volume)?volume:null,validation:{profileErrors:errors,status:errors.length?'unresolved':e.nativeShape?'approximated':'unresolved',reason:errors.length?'Profile validation failed':e.nativeShape?'Render mesh / conceptual route; no exact solid conversion':'Parametric profile checked; native BRep has not been run',nativeValidated:false}};
 return d;
}
export async function captureModel(model,previous=null,{signal,onProgress=()=>{}}={}){
 const t=performance.now(),descriptors=[],shapeCache=new Map(),ids=new Set(),changes={generated:[],modified:[],metadataOnly:[],moved:[],reused:[],removed:[]},old=new Map((previous?.elements||[]).map(d=>[d.id,d]));
 for(const d of previous?.elements||[])shapeCache.set(canonical({generator:VERSION,shape:d.shape}),d.geometryHash);
 const usedShapes=new Set();
 for(let i=0;i<model.elements.length;i++){
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  const d=normalizeElement(model.elements[i]);if(ids.has(d.id))throw Error('Duplicate source ID: '+d.id);ids.add(d.id);
  const shapeKey=canonical({generator:VERSION,shape:d.shape});
  let sh=shapeCache.get(shapeKey);if(!sh){sh=await digest(shapeKey);shapeCache.set(shapeKey,sh);}
  usedShapes.add(sh);const last=old.get(d.id);
  d.geometryHash=sh;d.sharedGeometryRef='shape_'+sh;const meta=x=>({building:x.building,level:x.level,category:x.category,ifcClass:x.ifcClass,properties:x.properties,material:x.material});d.metadataHash=last&&canonical(meta(last))===canonical(meta(d))?last.metadataHash:await digest(meta(d));
  d.placementHash=last&&canonical(last.transform)===canonical(d.transform)?last.placementHash:await digest(d.transform);
  const kind=!last?'generated':last.geometryHash!==sh?'modified':last.placementHash!==d.placementHash?'moved':last.metadataHash!==d.metadataHash?'metadataOnly':'reused';
  changes[kind].push(d.id);d.revision=(last?.revision||0)+Number(kind!=='reused');d.change=kind;descriptors.push(d);
  if(i%250===0){onProgress(i,model.elements.length);await new Promise(r=>setTimeout(r,0));}
 }
 changes.removed=[...old.keys()].filter(id=>!ids.has(id));
 const revision=await digest(descriptors.map(d=>[d.id,d.geometryHash,d.metadataHash,d.placementHash]));
 return {schema:VERSION,revision,createdAt:new Date().toISOString(),coordinates:{source:'feet / X,Y plan,Z up',usd:'metres / X,-Y,Z',scale:F},buildings:model.buildings.map(b=>({id:b.id,name:b.name,levels:b.levels})),elements:descriptors,changes,coverage:{total:descriptors.length,convertedValidated:0,approximated:descriptors.filter(d=>d.validation.status==='approximated').length,unresolved:descriptors.filter(d=>d.validation.status==='unresolved').length,unrepresentedSystems:model.unrepresentedSystems||[]},metrics:{captureMs:performance.now()-t,uniqueShapes:usedShapes.size,shapeInstances:descriptors.length,unchangedElements:changes.reused.length,descriptorReuseRatio:changes.reused.length/Math.max(1,descriptors.length),nativeGenerationSeconds:null,usdWritingSeconds:null,ifcExportSeconds:null,tessellationSeconds:null,nativePeakMemoryMB:null},limitations:['No native validation is inferred from a Three.js mesh or a positive analytic volume.','Source topology changes may invalidate legacy positional IDs.','This capture is incremental descriptor comparison; it does not replace the existing full architectural generator.']};
}
export function structuralAdapters(data){
 return data.members.filter(m=>!m.source&&['BEAM','COLUMN','FOUNDATION'].includes(m.type)).map(m=>{
  if(!m.a||!m.b||!m.width||!m.height)return {id:'STRUCTURE:'+m.id,building:m.building,level:m.level,type:'IFCBUILDINGELEMENTPROXY',structural:true,nativeShape:{type:'unresolved',source:m,reason:'Incomplete member dimensions'},parts:[]};
  const a=m.a,b=m.b,dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy),n=l?[-dy/l*m.width/2,dx/l*m.width/2]:[m.width/2,0];
  const poly=l?[[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]]:[[a[0]-m.width/2,a[1]-m.width/2],[a[0]+m.width/2,a[1]-m.width/2],[a[0]+m.width/2,a[1]+m.width/2],[a[0]-m.width/2,a[1]+m.width/2]];
  return {id:'STRUCTURE:'+m.id,building:m.building,level:m.level,type:m.type==='BEAM'?'IFCBEAM':m.type==='COLUMN'?'IFCCOLUMN':'IFCFOOTING',structural:true,role:m.section||m.type,parts:[{polygon:poly,z:m.type==='BEAM'?m.z-m.height:m.z,height:m.type==='COLUMN'?Math.abs(b[2]-a[2]):m.height}]};
 });
}
export function mepAdapters(data){
 return [...data.edges.map(e=>({id:'MEP:'+e.id,building:e.building,level:e.level,type:e.shape==='round'?'IFCPIPESEGMENT':'IFCDUCTSEGMENT',mep:true,role:e.system,parts:[],nativeShape:{type:'dimensioned_route',route:e.route,size:e.size,height:e.height,section:e.shape,blocked:!!e.blocked,source:e.source,destination:e.destination}})),...data.objects.map(o=>({id:'MEP:'+o.id,building:o.building,level:o.level,type:'IFCBUILDINGELEMENTPROXY',mep:true,role:o.label,parts:[],nativeShape:{type:'equipment_envelope',point:o.point,size:o.size,provisional:true}}))];
}

