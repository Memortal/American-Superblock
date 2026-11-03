export function supportMEP({nodes,edges,objects,contexts,model,hierarchy,systems,node,connect,atZ,inside,near,ringRoute,issue}){
 const park=model.buildings.find(b=>b.parking),stats={centralFloors:0,cappedRisers:0,rerouted:0,blocked:0},byId=new Map(nodes.map(n=>[n.id,n]));if(!park)return stats;
 const centroid=p=>p.reduce((a,q)=>[a[0]+q[0]/p.length,a[1]+q[1]/p.length],[0,0]),pc=centroid(park.outer);
 for(const ctx of contexts){const blue=hierarchy.hubs.find(h=>h.id===ctx.b.id+'-BLUE');if(!blue)continue;const central=blue.point.slice(0,2),cap=ctx.core.levels;
  for(const s of systems){const ns=nodes.filter(n=>n.system===s.id&&n.building===ctx.b.id&&n.type==='FLOOR_MAIN'&&n.shaft===ctx.b.id+'-PRIMARY-SHAFT').sort((a,b)=>a.level-b.level);if(!ns.length)continue;
   const high=ns.filter(n=>n.level>=cap),low=ns.filter(n=>n.level<cap),air=['SUPPLY_AIR','EXHAUST','VENT'].includes(s.id),service=nodes.find(n=>n.key===s.id+'-'+ctx.b.id+'-SERVICE');
   for(let i=edges.length-1;i>=0;i--)if(edges[i].system===s.id&&edges[i].building===ctx.b.id&&edges[i].shaft===ctx.b.id+'-PRIMARY-SHAFT'&&edges[i].zone==='RISER')edges.splice(i,1);
   const V=[pc[0]-central[0],pc[1]-central[1]],VL=Math.hypot(...V)||1,c=[central[0]+V[0]/VL*14+(s.lane%5-2)*3,central[1]+V[1]/VL*14+(Math.floor(s.lane/5)-1.5)*3],entry=node(s.id+'-'+ctx.b.id+'-CENTRAL-ENTRY','RISER',s.id,atZ(c,-8),{building:ctx.b.id,hostBuilding:'CORE',level:-1,label:'Parking-core upper residence services'});
   const meta={zone:'RISER',building:ctx.b.id,hostBuilding:'CORE',shaft:ctx.b.id+'-CENTRAL-UPPER',size:s.size};
   let prev=entry;
   if(air){const plant=nodes.find(n=>n.key===s.id+'-'+ctx.b.id+'-ROOF'),v=[pc[0]-c[0],pc[1]-c[1]],L=Math.hypot(...v),inset=12+['SUPPLY_AIR','EXHAUST','VENT'].indexOf(s.id)*14;plant.point=[c[0]+v[0]/L*inset,c[1]+v[1]/L*inset,park.levels*12+3];plant.level=park.levels;plant.hostBuilding='CORE';prev=plant;high.reverse();}
   else{const feed=nodes.find(n=>n.key===s.id+'-'+ctx.b.id+'-H4')||service;connect(feed,entry,s,[feed.point,entry.point],{zone:'UNDERGROUND',building:ctx.b.id,size:s.size});}
   for(const fn of high){fn.point=atZ(c,fn.point[2]);fn.hostBuilding='CORE';fn.shaft=meta.shaft;connect(prev,fn,s,[prev.point,atZ(c,prev.point[2]),fn.point],{...meta,level:fn.level});prev=fn;stats.centralFloors++;}
   if(air){connect(prev,entry,s,[prev.point,atZ(c,prev.point[2]),entry.point],meta);const original=low[0]?.point;if(original){const base=node(s.id+'-'+ctx.b.id+'-LOCAL-BASE','RISER',s.id,atZ(original,-8),{building:ctx.b.id,level:-1});connect(entry,base,s,ringRoute(c,original.slice(0,2),ctx.ring).map(q=>atZ(q,-8)),{zone:'UNDERGROUND',building:ctx.b.id,size:s.size,serviceZone:'B1_ENCLOSED_AIR_TRANSFER'});prev=base;}}
   else prev=service;
   for(const fn of low){connect(prev,fn,s,[prev.point,fn.point],{zone:'RISER',building:ctx.b.id,level:fn.level,shaft:ctx.b.id+'-PRIMARY-SHAFT',size:s.size});prev=fn;}stats.cappedRisers++;
  }
  const floors=new Map();
  for(const e of edges.filter(e=>e.building===ctx.b.id&&e.zone==='FLOOR'&&e.unit&&e.level>=cap)){
   const a=byId.get(e.source),b=byId.get(e.destination),start=a.type==='FLOOR_MAIN'?a:b,end=a.type==='FLOOR_MAIN'?b:a;
   let f=floors.get(e.level);if(!f){const ps=model.pieces.filter(p=>p.building===ctx.b.id&&p.levels>e.level&&!p.core).map(p=>p.upperPolygon);const polys=[park.outer,...ps],allowed=q=>polys.some(p=>inside(q,p)||near(q,p).distance<.6),clear=(a,b)=>{const N=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1]));for(let i=0;i<=N;i++){const t=N?i/N:0;if(!allowed([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]))return false;}return true;};const pts=[central,...ps.flatMap(p=>{const c=centroid(p);return[c,...p.map(q=>q.map((v,k)=>v+(c[k]-v)*.12))]})],adj=pts.map(()=>[]);for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)if(clear(pts[i],pts[j])){adj[i].push(j);adj[j].push(i);}f={pts,adj,clear};floors.set(e.level,f);}
   let route;if(f.clear(start.point,end.point))route=[start.point,end.point];else{const prev=new Map([[0,null]]),queue=[0];let found;for(let i=0;i<queue.length;i++){const v=queue[i];if(f.clear(f.pts[v],end.point)){found=v;break;}for(const n of f.adj[v])if(!prev.has(n)){prev.set(n,v);queue.push(n);}}if(found!==undefined){const ps=[end.point];let v=found;while(v!==null){ps.push(atZ(f.pts[v],start.point[2]));v=prev.get(v);}ps.push(start.point);route=ps.reverse();}}
   if(route){e.route=a===start?route:route.reverse();e.serviceZone='CENTRAL_CORE_SUPPORTED_UPPER_FLOOR';stats.rerouted++;}else{e.route=[];e.blocked=true;e.blockReason='No continuous upper floor path';stats.blocked++;}
  }
 }
 for(const o of objects){const n=byId.get(o.node);if(n?.type==='PLANT'&&(n.hostBuilding==='CORE'||n.building==='CORE')){const old=n.point[2],z=park.levels*12+o.size[2]/2;n.point[2]=z;for(const e of edges)if(e.source===n.id||e.destination===n.id)for(const q of e.route)if(Math.abs(q[2]-old)<.001)q[2]=z;}
if(n?.hostBuilding==='CORE'){o.point=n.point;o.level=n.level;o.hostBuilding='CORE';}}
 if(stats.blocked)issue('UPPER_ROUTE_UNRESOLVED','MODEL',stats.blocked+' logical links have no supported upper-floor path and are not drawn.','error');
 issue('CENTRAL_UPPER_FEED','MODEL','Local risers capped at actual core heights; higher floors and roof plant hosted by parking core. Full-width shafts and B1 air-transfer space need coordination.');
 return stats;
}
