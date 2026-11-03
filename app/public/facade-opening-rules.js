/* MEMO unit frontage classifications. Every unit is treated as an entry-side,
 * exterior-side and two solid party/return walls. Values are feet.
 * Reused by IFC wall assemblies, isolated render and tests.
 */
export const FACADE_RULE_VERSION='memo-opaque-side-high-entry-v1';
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const middle=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
export function closestPoint(q,a,b){
 const v=[b[0]-a[0],b[1]-a[1]],den=dot(v,v)||1,t=clamp(dot([q[0]-a[0],q[1]-a[1]],v)/den,0,1);
 return [a[0]+v[0]*t,a[1]+v[1]*t];
}
export function classifyUnitEdges(p,poly){
 const edges=poly.map((a,i)=>{const b=poly[(i+1)%poly.length],len=dist(a,b),u=len?[((b[0]-a[0])/len),((b[1]-a[1])/len)]:[0,0];return {index:i,a,b,u,len,mid:middle(a,b),role:'side'};});
 const entry=p?.carve?.entry||p?.carve?.entryPoint;
 const tangent=p?.carve?.u;
 if(!entry||!tangent){return edges.map(e=>({...e,role:'side',verified:false}));}
 const aligned=edges.filter(e=>e.len>=3&&Math.abs(dot(e.u,tangent))>=.82);
 if(!aligned.length)return edges.map(e=>({...e,role:'side',verified:false}));
 aligned.sort((a,b)=>dist(closestPoint(entry,a.a,a.b),entry)-dist(closestPoint(entry,b.a,b.b),entry));
 const front=aligned[0];
 const opposite=aligned.slice(1).sort((a,b)=>dist(closestPoint(entry,b.a,b.b),entry)-dist(closestPoint(entry,a.a,a.b),entry))[0];
 // Do not infer a rear façade from a small jog only 2 ft behind an entry recess.
 const rear=opposite&&dist(closestPoint(entry,opposite.a,opposite.b),entry)>Math.max(5,dist(closestPoint(entry,front.a,front.b),entry)+3)?opposite:null;
 return edges.map(e=>({...e,role:e.index===front.index?'entrance':rear&&e.index===rear.index?'rear':'side',verified:true}));
}
export function facadeOpenings(role,length,bottom,top,{ground=false,retail=false,includeDoor=true}={}){
 if(!(length>0&&top>bottom))return [];
 if(role==='side'||length<4.75)return [];
 const height=top-bottom;
 if(role==='entrance'){
  // Explicit 3.5 ft entry aperture plus high-sill sidelights.
  const doorW=Math.min(3.5,length-1.2),doorX=(length-doorW)/2,doorHead=Math.min(top-.55,bottom+8.1);
  const out=includeDoor?[{kind:'door',x:doorX,w:doorW,bottom:bottom+.03,head:doorHead}]:[];
  const sill=bottom+(retail?3.25:4.0),head=top-.9;
  if(head>sill+1){
   for(const [a,b] of (includeDoor?[[.8,doorX-.8],[doorX+doorW+.8,length-.8]]:[[.8,length-.8]])){
    const w=b-a;if(w>=2.4)out.push({kind:'window',x:a+.3,w:w-.6,bottom:sill,head});
   }
  }
  return out;
 }
 // Only the opposite exterior/rear frontage gets broad daylight apertures.
 const sill=bottom+(ground?1.35:2.3),head=top-.85;
 if(head<=sill+1.5)return [];
 const n=Math.max(1,Math.floor(length/9)),slot=length/n,w=Math.min(5.25,slot-1.8);
 const out=[];for(let i=0;i<n;i++)if(w>=2.4)out.push({kind:'window',x:(i+.5)*slot-w/2,w,bottom:sill,head});
 return out;
}
export function auditFacadeDesign(p,poly,z,top){
 const edges=classifyUnitEdges(p,poly);
 return {edges:edges.map(e=>({index:e.index,role:e.role,len:e.len,openings:facadeOpenings(e.role,e.len,z,top)})),
  sideGlazing:edges.filter(e=>e.role==='side').reduce((s,e)=>s+facadeOpenings(e.role,e.len,z,top).length,0),
  entranceLowWindows:edges.filter(e=>e.role==='entrance').flatMap(e=>facadeOpenings(e.role,e.len,z,top)).filter(o=>o.kind==='window'&&o.bottom<z+3.5).length};
}
