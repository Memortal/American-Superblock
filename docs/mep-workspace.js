import {generateMEP,SYSTEMS} from './mep-network.js';
import {mepIFC} from './mep-export.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const save=(name,data,type='application/json')=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
export async function mountMEP({THREE,scene,camera,renderer,architecture,getModel}){
 if(window.memoMEP){document.getElementById('mepPanel').hidden=false;return;}
 const style=document.createElement('style');style.textContent=`
 #mepPanel{position:fixed;z-index:500;right:0;top:86px;bottom:0;width:460px;padding:24px;background:#fff;overflow:auto;border-left:1px solid #ccc;font:12px Arial;color:#171717}#mepPanel[hidden]{display:none}#mepPanel h2{font-size:24px;font-weight:500;margin:14px 0}#mepPanel p{line-height:1.6;color:#666}#mepPanel select,#mepPanel input[type=text]{width:100%;padding:9px;margin:5px 0 12px;border:1px solid #bbb}#mepPanel label{display:block;margin-top:12px}#mepPanel .mepActions{display:flex;gap:5px;flex-wrap:wrap;margin:12px 0}#mepPanel .mepStat{font-size:11px;line-height:1.8;padding:12px;background:#f4f4f2}#mepPanel details{border-top:1px solid #ddd;padding:12px 0}#mepPanel pre{white-space:pre-wrap;font:10px monospace;line-height:1.5}#mepPanel .sys{display:inline-flex;align-items:center;gap:5px;font-size:10px;margin:4px 10px 4px 0}#mepPanel i{height:7px;width:16px;display:inline-block}#mepStatus{padding:12px 0;line-height:1.6}@media(max-width:700px){#mepPanel{top:48vh;width:100%;height:52vh}}
 `;document.head.append(style);
 const panel=document.createElement('aside');panel.id='mepPanel';panel.innerHTML=`<div style="display:flex;justify-content:space-between"><b>MEMO / INFRASTRUCTURE</b><button id="mepClose">Close ×</button></div><h2>Service coordination.</h2><p>Red corner hubs → orange landings → purple distribution → yellow inner hubs → blue parking cores. Four corner site entries only. Hub hierarchy shows diagram symbols; physical services are buried or enclosed. Model-generated schematic networks. Select a route or equipment in 3D to inspect its source, destination and metadata.</p><label>System isolation</label><select id="mepView"><option>Architecture only</option><option>All MEP</option><option>Mechanical only</option><option>Plumbing only</option><option>Electrical only</option><option>Fire protection only</option><option>Storm only</option><option>Data / low voltage only</option><option>Underground infrastructure only</option><option selected>Hub hierarchy</option><option>Vertical risers only</option><option>Unit MEP only</option></select><label>Building</label><select id="mepBuilding"><option value="all">Entire site</option><option value="B1">Building A</option><option value="B2">Building B</option><option value="B3">Building C</option><option value="B4">Building D</option><option value="SITE">Site / central plant</option><option value="CORE">Parking Core</option></select><label>Level</label><select id="mepLevel"><option value="all">All levels</option></select><label><input type="checkbox" id="mepContext" checked> Ghosted architecture</label><label><input type="checkbox" id="mepShafts"> Proposed shaft envelopes</label><div class="mepActions"><button id="mepDiagrams">MEP drawing set</button><button id="mepGraph">Graph JSON</button><button id="mepIFC">MEP IFC</button><button id="mepReport">Coordination report</button><button id="mepSizing">Sizing study</button></div><div id="mepStatus" aria-live="polite">Generating connected networks…</div><div id="mepStats" class="mepStat"></div><div id="mepLegend"></div><label>Trace unit / object</label><input id="mepSearch" type="text" placeholder="Unit ID or click a route"><div class="mepActions"><button id="mepTrace">Trace selected route</button><button id="mepClear">Clear trace</button></div><pre id="mepInspect">Select a 3D service to inspect.</pre><details open><summary>Coordination / assumptions</summary><div id="mepIssues"></div></details>`;
 document.body.append(panel);const $=id=>document.getElementById(id);
 await new Promise(r=>setTimeout(r,30));
 const model=getModel(),data=generateMEP(model),group=new THREE.Group();group.name='MEMO MEP';scene.add(group);
 const systemMap=new Map(SYSTEMS.map(s=>[s.id,s])),nodeMap=new Map(data.nodes.map(n=>[n.id,n])),edgeMap=new Map(data.edges.map(e=>[e.id,e])),adj=new Map(data.nodes.map(n=>[n.id,[]]));
 data.edges.forEach(e=>{adj.get(e.source)?.push({to:e.destination,edge:e.id});adj.get(e.destination)?.push({to:e.source,edge:e.id});});
 const world=q=>new THREE.Vector3(q[0],q[2],q[1]),items=[],matCache=new Map();
 const addItem=(shape,point,size,system,ref,rotation=null)=>items.push({shape,point,size,system,ref,rotation});
 const segment=(a,b,e,index)=>{
  const A=world(a),B=world(b),delta=B.clone().sub(A),length=delta.length();if(length<.005)return;
  addItem(e.shape==='pipe'?'pipe':'tray',A.clone().add(B).multiplyScalar(.5),e.shape==='pipe'?[e.size,length,e.size]:[e.size,length,e.shape==='duct'?(e.height||e.size*.6):.15],e.system,{edge:e.id,building:e.building,hostBuilding:e.hostBuilding,level:e.level,zone:e.zone},new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
  if(index>1)addItem(e.shape==='pipe'?'fitting':'equipment',A,[e.size*1.08,e.size*1.08,e.size*1.08],e.system,{edge:e.id,building:e.building,hostBuilding:e.hostBuilding,level:e.level,zone:e.zone});
 };
 const seen=new Set();
 for(const e of data.edges){if(e.blocked||e.sharedRiser)continue;for(let i=1;i<e.route.length;i++){
  const key=e.system+'|'+[e.route[i-1],e.route[i]].map(q=>q.map(v=>v.toFixed(3)).join(',')).sort().join('|');
  if(seen.has(key))continue;seen.add(key);segment(e.route[i-1],e.route[i],e,i);
 }}
 for(const o of data.objects){if(o.blocked)continue;const n=nodeMap.get(o.node);addItem('equipment',world(o.point),[o.size[0],o.size[2],o.size[1]],o.system,{node:o.node,object:o.id,building:o.building,hostBuilding:o.hostBuilding,level:o.level,zone:n?.type==='PLANT'?'PLANT':'UNIT'});}
 const geometries={pipe:new THREE.CylinderGeometry(.5,.5,1,8),tray:new THREE.BoxGeometry(1,1,1),equipment:new THREE.BoxGeometry(1,1,1),fitting:new THREE.SphereGeometry(.5,7,5)},batches=new Map(),meshes=[];
 for(const item of items){const key=item.system+'-'+item.shape;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(item);}
 const dummy=new THREE.Object3D();
 for(const batch of batches.values()){
  const s=systemMap.get(batch[0].system),key=s.id+'-'+batch[0].shape,mat=new THREE.MeshStandardMaterial({color:s.color,roughness:.75}),mesh=new THREE.InstancedMesh(geometries[batch[0].shape],mat,batch.length);
  mesh.userData.items=batch;mesh.userData.system=s.id;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;
  batch.forEach((it,i)=>{dummy.position.copy(it.point);dummy.quaternion.copy(it.rotation||new THREE.Quaternion());dummy.scale.set(...it.size);dummy.updateMatrix();it.matrix=dummy.matrix.clone();mesh.setMatrixAt(i,it.matrix);});group.add(mesh);meshes.push(mesh);
 }
 const hierarchyGroup=new THREE.Group();group.add(hierarchyGroup);const tierColors={RED:0xe73438,ORANGE:0xf18b2c,PURPLE:0x9852cd,YELLOW:0xe7bf22,BLUE:0x278dde};
 for(const h of data.hierarchy.hubs){const m=new THREE.Mesh(new THREE.CylinderGeometry(h.tier==='RED'?7:5,h.tier==='RED'?7:5,2,20),new THREE.MeshBasicMaterial({color:tierColors[h.tier]}));m.position.copy(world(h.point));m.userData.hub=h;hierarchyGroup.add(m);}
 for(const l of data.hierarchy.links){const g=new THREE.BufferGeometry().setFromPoints(l.route.map(world));const m=new THREE.Line(g,new THREE.LineBasicMaterial({color:tierColors[l.tier]}));m.userData.hub=l;hierarchyGroup.add(m);}
 const shaftGroup=new THREE.Group();group.add(shaftGroup);
 for(const z of data.zones.filter(z=>z.type==='PROPOSED_WET_SHAFT')){
  const h=z.levelRange[1]*12+12,g=new THREE.BoxGeometry(z.size[0],h,z.size[1]),m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x777777,wireframe:true,transparent:true,opacity:.23}));
  m.position.copy(world([z.point[0],z.point[1],h/2-12]));shaftGroup.add(m);
 }
 shaftGroup.visible=false;
 let coordinationMode=false;let selected=null,traced=new Set();const original=new Map();
 architecture.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(!original.has(m))original.set(m,{opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite});});
 function restore(){for(const [m,v] of original){Object.assign(m,v);m.needsUpdate=true;}architecture.visible=true;}
 function filter(){
  const view=$('mepView').value,building=$('mepBuilding').value,level=$('mepLevel').value,arch=view==='Architecture only';
  group.visible=!arch;if(!coordinationMode)restore();
  if(!arch&&!coordinationMode){architecture.visible=$('mepContext').checked;if(architecture.visible)for(const [m] of original){m.opacity=.09;m.transparent=true;m.depthWrite=false;}}
  const disciplines={'Mechanical only':'Mechanical','Plumbing only':'Plumbing','Electrical only':'Electrical','Fire protection only':'Fire protection','Storm only':'Stormwater','Data / low voltage only':'Low voltage'};
  let visible=0;
  for(const mesh of meshes){const s=systemMap.get(mesh.userData.system);mesh.visible=view!=='Hub hierarchy'&&(!disciplines[view]||disciplines[view]===s.discipline);
   mesh.userData.visibleItems=[];let count=0;
   mesh.userData.items.forEach((it,i)=>{
    const r=it.ref,show=(building==='all'||r.building===building||r.hostBuilding===building)&&(level==='all'||r.level===+level)&&(!view.startsWith('Underground')||r.zone==='UNDERGROUND')&&(!view.startsWith('Vertical')||r.zone==='RISER')&&(!view.startsWith('Unit MEP')||r.zone==='UNIT')&&(!traced.size||traced.has(r.edge)||r.node&&[...traced].some(id=>{const e=edgeMap.get(id);return e.source===r.node||e.destination===r.node;}));
    if(show){mesh.setMatrixAt(count++,it.matrix);mesh.userData.visibleItems.push(it);if(mesh.visible)visible++;}
   });mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
  }
  hierarchyGroup.visible=view==='Hub hierarchy';for(const m of hierarchyGroup.children)m.visible=building==='all'||m.userData.hub.building===building;
  shaftGroup.visible=$('mepShafts').checked&&!arch;$('mepStatus').textContent=arch?'Architecture unchanged.':visible.toLocaleString()+' visible MEP parts · '+data.summary.errors+' scoped check failures · full clash review pending';
 }
 function inspect(ref){selected=ref;const e=ref.edge?edgeMap.get(ref.edge):nodeMap.get(ref.node);$('mepInspect').textContent=JSON.stringify(e,null,2);if(e?.unit)$('mepSearch').value=e.unit;}
 function trace(){
  let start=selected?.node||(selected?.edge?edgeMap.get(selected.edge).destination:null);
  const query=$('mepSearch').value.trim();if(query)start=data.nodes.find(n=>n.unit===query)?.id||start;
  if(!start){$('mepStatus').textContent='Select a route or enter a complete unit ID.';return;}
  const n=nodeMap.get(start),targets=new Set([data.roots[n.system]].flat()),queue=[start],parent=new Map([[start,null]]);let end=null;
  for(let i=0;i<queue.length;i++){const id=queue[i];if(targets.has(id)){end=id;break;}for(const next of adj.get(id)||[])if(!parent.has(next.to)){parent.set(next.to,{from:id,edge:next.edge});queue.push(next.to);}}
  traced=new Set();let p=end;while(p&&parent.get(p)){const step=parent.get(p);traced.add(step.edge);p=step.from;}filter();const blocked=[...traced].filter(id=>edgeMap.get(id)?.blocked).length;$('mepStatus').textContent=end?'Logical path: '+traced.size+' links to '+nodeMap.get(end).label+' · '+blocked+' blocked links · physical continuity not certified':'No source path found — see coordination report.';
 }
 const ray=new THREE.Raycaster();const handleMEPClick=event=>{
  if(panel.hidden||!group.visible)return;const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);
  if(hierarchyGroup.visible){const h=ray.intersectObjects(hierarchyGroup.children,false)[0];if(h){$('mepInspect').textContent=JSON.stringify(h.object.userData.hub,null,2);}return;}
  const hit=ray.intersectObjects(meshes.filter(m=>m.visible),false)[0];if(hit?.instanceId!==undefined)inspect(hit.object.userData.visibleItems[hit.instanceId].ref);
 };renderer.domElement.addEventListener('click',handleMEPClick);
 $('mepLevel').innerHTML='<option value="all">All levels</option>'+Array.from({length:data.maxLevel+2},(_,i)=>'<option value="'+(i-1)+'">'+(i===0?'B1':i===data.maxLevel+1?'Roof plant':'L'+i)+'</option>').join('');
 $('mepStats').textContent=data.nodes.length.toLocaleString()+' nodes / '+data.edges.length.toLocaleString()+' logical routes / '+data.objects.length.toLocaleString()+' equipment and terminals'+(data.coordination?' · '+data.coordination.rerouted+' rerouted · '+(data.coordination.relocatedNodes||0)+' ceiling junctions adjusted · '+data.coordination.blocked+' unresolved routes excluded · '+data.coordination.blockedObjects+' equipment locations unresolved':'');
 $('mepLegend').innerHTML=SYSTEMS.map(s=>'<span class="sys"><i style="background:#'+s.color.toString(16).padStart(6,'0')+'"></i>'+s.id.replaceAll('_',' ')+'</span>').join('');
 const categories={};for(const i of data.issues)categories[i.code]=(categories[i.code]||0)+1;
 $('mepIssues').innerHTML=Object.entries(categories).map(([k,v])=>'<p><b>'+esc(k.replaceAll('_',' '))+' · '+v+'</b></p>').join('')+data.assumptions.map(s=>'<p>'+esc(s)+'</p>').join('');
 for(const id of ['mepView','mepBuilding','mepLevel','mepContext','mepShafts'])$(id).onchange=filter;
 $('mepClose').onclick=()=>{panel.hidden=true;group.visible=false;restore();};
 $('mepSizing').onclick=async()=>{const {openSizingStudy}=await import('./mep-sizing.js');openSizingStudy(data);};
 $('mepGraph').onclick=()=>save('MEMO-MEP-network.json',JSON.stringify(data));
 $('mepReport').onclick=()=>save('MEMO-MEP-coordination.json',JSON.stringify({summary:data.summary,coordination:data.coordination,unresolvedRoutes:data.edges.filter(e=>e.blocked).map(e=>({id:e.id,system:e.system,building:e.building,level:e.level,unit:e.unit,blocker:e.blockerType,reason:e.blockReason,proposedRoute:e.proposedRoute})),issues:data.issues,assumptions:data.assumptions},null,2));
 $('mepIFC').onclick=()=>save('MEMO-MEP-schematic.ifc',mepIFC(data),'application/x-step');
 $('mepTrace').onclick=trace;$('mepClear').onclick=()=>{traced.clear();selected=null;filter();};
 $('mepDiagrams').onclick=async()=>{const {openMEPDrawings}=await import('./mep-sheets.js');openMEPDrawings(data);};
 window.memoMEP={data,dataModel:model.elements,group,filter,trace,inspect,items,coordinate:({view,building,level,visible})=>{coordinationMode=true;traced.clear();$('mepView').value=view;$('mepBuilding').value=building;$('mepLevel').value=level;filter();group.visible=visible;panel.hidden=true;},endCoordinate:()=>{coordinationMode=false;group.visible=false;restore();},dispose:()=>{renderer.domElement.removeEventListener('click',handleMEPClick);restore();scene.remove(group);const gs=new Set(),ms=new Set();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material)});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());panel.remove();delete window.memoMEP;},show:()=>{panel.hidden=false;filter();}};filter();
}
