// The sketch's four-stage topology. Physical service routes remain below grade.
export function applyHierarchy({nodes,edges,objects,contexts,systems,node,connect,equip,near,ringRoute,atZ,dist,issue,roots,model}){
 const hubs=[],links=[];
 const old=new Set(nodes.filter(n=>n.key.endsWith('-ROOT')||n.key.endsWith('-HUB')||n.building==='CORE').map(n=>n.id));
 for(let i=edges.length-1;i>=0;i--)if(old.has(edges[i].source)||old.has(edges[i].destination))edges.splice(i,1);
 for(let i=objects.length-1;i>=0;i--)if(old.has(objects[i].node))objects.splice(i,1);
 for(let i=nodes.length-1;i>=0;i--)if(old.has(nodes[i].id))nodes.splice(i,1);
 for(const s of systems)roots[s.id]=[roots[s.id]].flat().filter(id=>id&&!old.has(id));
 const parking=model.buildings.find(b=>b.parking),parkingCenter=parking?parking.outer.reduce((a,q)=>[a[0]+q[0]/parking.outer.length,a[1]+q[1]/parking.outer.length],[0,0]):[0,0];
 const parkStations=[];
 for(const ctx of contexts){
  const b=ctx.b,ring=b.corridorOuter.map((p,i)=>p.map((v,k)=>v+(b.outer[i][k]-v)*.22));
  const oi=ring.reduce((a,p,i)=>Math.hypot(...p)>Math.hypot(...ring[a])?i:a,0),N=ring.length,orange=ring[oi],yellow=ring[(oi+Math.floor(N/2))%N],purple=[ring[(oi+1)%N],ring[(oi+N-1)%N]],red=orange.map(v=>Math.sign(v)*330);
  const markers=[{tier:'RED',point:red,label:'Site corner hub'},{tier:'ORANGE',point:orange,label:'First landing / proposed service room'},...purple.map(point=>({tier:'PURPLE',point,label:'Secondary distribution hub'})),{tier:'YELLOW',point:yellow,label:'Inner distribution hub'}].map((m,i)=>({...m,id:b.id+'-H'+i,building:b.id,point:[...m.point,-8]}));
  hubs.push(...markers);for(const [a,c] of [[0,1],[1,2],[1,3],[2,4],[3,4]])links.push({source:markers[a].id,destination:markers[c].id,building:b.id,tier:markers[c].tier,route:a===0?[markers[a].point,markers[c].point]:ringRoute(markers[a].point.slice(0,2),markers[c].point.slice(0,2),ring).map(q=>atZ(q,-8))});
  for(const s of systems){
   if(['SUPPLY_AIR','EXHAUST','VENT','RETURN_AIR'].includes(s.id))continue;
   const service=nodes.find(n=>n.key===s.id+'-'+b.id+'-SERVICE');if(!service)continue;
   // Replace radial basement spaghetti with the corner-fed hierarchy.
   const removed=new Set(edges.filter(e=>e.building===b.id&&e.zone==='UNDERGROUND').map(e=>e.id));
   for(let i=edges.length-1;i>=0;i--)if(removed.has(edges[i].id)&&edges[i].system===s.id)edges.splice(i,1);
   const gravity=['SANITARY','STORM'].includes(s.id),z=gravity?-22:-8+(s.lane%4)*.65;
   const ns=markers.map((m,i)=>node(s.id+'-'+m.id,i===1?'MECHANICAL_ROOM':'BRANCH',s.id,[m.point[0],m.point[1],gravity?z+i*2:z],{building:b.id,level:-1,label:m.label,tier:m.tier}));
   const path=(a,c,route)=>{if(gravity){let lengths=[0];for(let i=1;i<route.length;i++)lengths.push(lengths.at(-1)+dist(route[i-1].slice(0,2),route[i].slice(0,2)));const total=lengths.at(-1)||1;route=route.map((p,i)=>[p[0],p[1],a.point[2]+(c.point[2]-a.point[2])*lengths[i]/total]);}return connect(a,c,s,route,{zone:'UNDERGROUND',building:b.id,tier:c.tier,size:s.size,serviceZone:'BURIED_BUILDING_SERVICE_BAND'});};
   roots[s.id].push(ns[0].id);ns[0].type=gravity?'SEWER_CONNECTION':'UTILITY_CONNECTION';ns[0].label='Corner '+b.name+' / '+s.source;path(ns[0],ns[1],[ns[0].point,ns[1].point]);
   for(const [a,c] of [[1,2],[1,3],[2,4],[3,4]])path(ns[a],ns[c],ringRoute(ns[a].point.slice(0,2),ns[c].point.slice(0,2),ring).map(q=>atZ(q,z)));
   const targets=nodes.filter(n=>n.system===s.id&&n.building===b.id&&(n.key.endsWith('-SERVICE')||n.key.endsWith('-EQUIPMENT')||n.key.endsWith('-BASE')||n.key.endsWith('-LANDSCAPE')));
   for(const t of targets){const closest=ns.slice(1).reduce((a,n)=>dist(n.point.slice(0,2),t.point.slice(0,2))<dist(a.point.slice(0,2),t.point.slice(0,2))?n:a,ns[1]);const oldZ=t.point[2],r=ringRoute(closest.point.slice(0,2),t.point.slice(0,2),ring);let len=0;for(let i=1;i<r.length;i++)len+=dist(r[i-1],r[i]);
    if(gravity){t.point[2]=closest.point[2]+len*.011;for(const e of edges)if(e.source===t.id||e.destination===t.id)for(const p of e.route)if(Math.abs(p[0]-t.point[0])<.001&&Math.abs(p[1]-t.point[1])<.001&&Math.abs(p[2]-oldZ)<.001)p[2]=t.point[2];}
    const route=r.map(q=>atZ(q,z));route[0]=closest.point;route[route.length-1]=t.point;path(closest,t,route);
   }
   // The first room is an actual connected equipment node; room envelope remains provisional.
   ns[1].roomStatus='PROPOSED_SERVICE_ROOM';
   if(parking&&['FIRE_PROTECTION','NORMAL_POWER','EMERGENCY_POWER','DATA'].includes(s.id)){
    const q=near(yellow,parking.outer).point,v=[parkingCenter[0]-q[0],parkingCenter[1]-q[1]],L=Math.hypot(...v)||1,blue=[q[0]+v[0]/L*8,q[1]+v[1]/L*8];
    const pn=node(s.id+'-'+b.id+'-BLUE','CORE',s.id,atZ(blue,z),{building:'CORE',level:-1,tier:'BLUE',label:b.id+' parking core feed'});connect(ns[4],pn,s,[ns[4].point,pn.point],{zone:'UNDERGROUND',building:'CORE',tier:'BLUE',size:s.size});parkStations.push({b,blue,s,entry:pn});
    if(s.id==='NORMAL_POWER'){const marker={id:b.id+'-BLUE',tier:'BLUE',point:atZ(blue,-8),building:'CORE',label:'Aligned parking service core'};hubs.push(marker);links.push({source:markers[4].id,destination:marker.id,tier:'BLUE',building:'CORE',route:[markers[4].point,marker.point]});}
   }
  }
 }
 // No disconnected legacy junctions or outfalls survive removal of the site spine.
 const used=new Set(edges.flatMap(e=>[e.source,e.destination]));for(let i=nodes.length-1;i>=0;i--)if(!used.has(nodes[i].id)){const id=nodes[i].id;nodes.splice(i,1);for(let j=objects.length-1;j>=0;j--)if(objects[j].node===id)objects.splice(j,1);}
 if(parking){
  const maxLevel=parking.levels,baseStations=parkStations.filter(p=>p.s.id==='NORMAL_POWER');
  for(const station of baseStations){const s=systems.find(s=>s.id==='EXHAUST'),entry=node('EXHAUST-'+station.b.id+'-BLUE-ROOF','PLANT',s.id,atZ(station.blue,maxLevel*12+6),{building:'CORE',level:maxLevel,tier:'BLUE',label:'Parking exhaust discharge / '+station.b.id});roots.EXHAUST.push(entry.id);equip(entry,entry.label,[5,4,3]);parkStations.push({...station,s,entry});}
  for(const p of parkStations){let prev=p.entry;const levels=[-1,...Array.from({length:maxLevel-3},(_,i)=>i+3)];if(p.s.reverse)levels.reverse();
   for(const l of levels){const fn=node(p.s.id+'-'+p.b.id+'-PARK-L'+l,'FLOOR_MAIN',p.s.id,atZ(p.blue,l*12+9),{building:'CORE',level:l,tier:'BLUE'});connect(prev,fn,p.s,[prev.point,fn.point],{zone:'RISER',building:'CORE',level:l,tier:'BLUE',shaft:p.b.id+'-BLUE',size:p.s.size});prev=fn;
    for(const x of [-45,-15,15,45])for(const y of [-45,-15,15,45]){const q=[x,y],closest=baseStations.reduce((a,b)=>dist(a.blue,q)<dist(b.blue,q)?a:b);if(closest.b.id!==p.b.id)continue;const t=node(p.s.id+'-PARK-'+l+'-'+x+'-'+y,'TERMINAL',p.s.id,atZ(q,l*12+9),{building:'CORE',level:l,label:'Parking '+p.s.terminal});connect(fn,t,p.s,[fn.point,[q[0],p.blue[1],l*12+9],t.point],{zone:'FLOOR',building:'CORE',level:l,tier:'BLUE',size:p.s.size*.5});equip(t,t.label,[.4,.4,.3],'TERMINAL');}
   }
  }
 }
 issue('HUB_ROOM_RESERVATIONS','MODEL','Orange landings are proposed basement service-room locations. Separate wet/dry rooms, equipment access and capacities remain to be designed.');
 return {hubs,links,description:'Red corner hub → orange landing → purple distribution → yellow inner hub. Network routes are buried or inside residential service bands; markers are diagram symbols.'};
}
