// Real openings and arrival slabs; no columns are introduced in the valley.
export function openCornerStairs(elements,pieces){
 const pc=window.polygonClipping,round=x=>Array.isArray(x)?x.map(round):Math.round(x*10000)/10000;
 const cut=(p,holes)=>{if(!holes.length)return [p];let poly=[[p.polygon,...(p.holes||[])]];for(const h of holes)poly=pc.difference(round(poly),round([h]));return poly.filter(x=>x[0].length>3).map(x=>({...p,polygon:x[0].slice(0,-1),holes:x.slice(1).map(r=>r.slice(0,-1))}));};
 for(const p of pieces.filter(p=>p.monumentalStair)){
  const stair=p.monumentalStair,flights=elements.filter(e=>e.piece.id===p.id&&e.monumental&&e.type==='IFCSTAIRFLIGHT').flatMap(e=>e.parts);
  for(const e of elements.filter(e=>e.building===p.building&&!e.monumental)){
   if(e.type==='IFCSLAB'||e.space)e.parts=e.parts.flatMap(q=>cut(q,flights.filter(f=>q.z>=f.z+f.height-.05&&q.z<f.z+f.height+7.5).map(f=>f.polygon)));
   if(e.parapet&&e.level===3)e.parts=e.parts.flatMap(q=>cut(q,[stair.top]));
  }
 }
 for(const e of elements.filter(e=>e.parapet||e.id.includes('gallery-guards'))){const landings=elements.filter(q=>q.stairLanding&&q.building===e.building&&q.level===e.level).flatMap(q=>q.parts.map(p=>p.polygon));if(landings.length)e.parts=e.parts.flatMap(q=>cut(q,landings));}
}
export function connectCoreLandings(elements,pieces,add,part,offset){
 const pc=window.polygonClipping,rnd=v=>Array.isArray(v)?v.map(rnd):Math.round(v*10000)/10000;
 for(const p of pieces.filter(p=>p.core&&!p.serviceCore))for(let l=3;l<p.levels;l++){
  const occupied=pieces.filter(q=>q.building===p.building&&!q.core&&q.levels>l&&q.upperStart<=l).map(q=>q.upperSlabPolygon||q.upperPolygon),boundary=offset(p.polygon,-7);
  const polys=pc.difference(rnd([boundary]),rnd([p.polygon]),...occupied.map(q=>rnd([q])));
  add(p,l,'IFCSLAB','gallery-core-threshold',polys.map(q=>part(q[0].slice(0,-1),l*12,.75,q.slice(1).map(h=>h.slice(0,-1)))),{role:'Gallery to core arrival apron',slab:true,circulation:true,entry:true,component:true,coreConnection:true,stairLanding:true,designStatus:'Wall-supported arrival slab; local framing, guards and fire doors require engineering review'});
 }
}
export function connectEntryThresholds(elements,add,part){
 const project=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return [a[0]+t*dx,a[1]+t*dy];};
 const doors=elements.filter(e=>e.french),gallery=elements.filter(e=>e.circulation&&e.type==='IFCSLAB'&&e.id.includes('upper-gallery-floor'));
 for(const e of doors){let best=null;for(const q of e.parts){const a=q.polygon[0],b=q.polygon[1],m=[(a[0]+b[0])/2,(a[1]+b[1])/2],w=Math.hypot(b[0]-a[0],b[1]-a[1]);for(const f of gallery.filter(f=>f.building===e.building&&f.level===e.level))for(const g of f.parts)for(let i=0;i<g.polygon.length;i++){const n=project(m,g.polygon[i],g.polygon[(i+1)%g.polygon.length]),d=Math.hypot(m[0]-n[0],m[1]-n[1]);if(d>.02&&d<1&&(!best||d<best.d))best={m,n,d,w};}}
  if(!best)continue;const {m,n,d,w}=best,u=[(n[0]-m[0])/d,(n[1]-m[1])/d],v=[-u[1],u[0]],width=Math.min(4,w-.2),at=(x,y)=>[m[0]+u[0]*x+v[0]*y,m[1]+u[1]*x+v[1]*y];
  add(e.piece,e.level,'IFCSLAB','entry-threshold',[part([at(-.5,-width/2),at(d+.5,-width/2),at(d+.5,width/2),at(-.5,width/2)],e.level*12,.75)],{role:'Flush apartment door threshold to gallery',slab:true,circulation:true,entry:true,component:true,threshold:true});
 }
}
