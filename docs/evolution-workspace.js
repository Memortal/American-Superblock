import {createCoupleAutonomy,autonomousAcceptanceTests} from './couple-autonomy.js';
import {inspectFunctionalLayout,validateNewFurniture,findFurnitureLocation,repairDoorFurnitureClashes,STORES,coupleDay} from './furnishing-engine.js';
import {defaults,entranceRoute} from './evolution-engine.js';
import {resolveContext as context,generateDesign as generate,simulatePopulation as simulate,evolvePopulation,semanticElements as elements,studyEntrances,schedule} from './evolution-population.js';
export function mountEvolution({THREE,scene,camera,controls,renderer,architecture,getModel,meshForElement}){
 if(window.memoEvolution){window.memoEvolution.open();return window.memoEvolution;}
 const model=getModel();let c=context(model,'apartment'),baseline=generate(c,{...defaults,vestibuleDepth:c.entrance?.airlockDepth||12});
 let connection=c.connection;c.connection=connection;let originalFingerprint=JSON.stringify(c.piece.groundPolygon);const boxGeo=new THREE.BoxGeometry(1,1,1),sphereGeo=new THREE.SphereGeometry(.65,8,6);
 const materials=new Map(),material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.85}));return materials.get(color);};
 const group=new THREE.Group(),appliedGroup=new THREE.Group();scene.add(group);architecture.add(appliedGroup);group.name='MEMO Evolution comparison';appliedGroup.name='MEMO applied interiors';
 const panel=document.createElement('aside');panel.id='evolutionWorkspace';panel.innerHTML='<header><small>MEMO / COUPLE LIVING LAB</small><button id="evClose">×</button><h2>Two people.<br>Upper apartment.</h2><p>Automated daily living · functional layout screening</p></header><main><p id="evIdentity"></p><section id="evAutoHead"><p>Autonomous simulation starts on open. Two residents follow daily routines, identify new needs, and try clearance-safe furniture placements. Orders are simulated only.</p><button class="primary" id="evAutoRun">Run 14 days automatically</button><button id="evAutoStop">Stop</button><button id="evAutoExport">Export household report</button><div id="evAutoStatus" role="status"></div><div id="evAutoResults"></div></section><details id="evAdvanced"><summary>Advanced / legacy simulation controls</summary><label>Typology<select id="evTypology"><option value="triplex">Triplex · Levels 1–3</option><option value="apartment">Upper apartment · Level 5</option></select></label><label>Resident scenarios<select id="evAgentCount"><option>100</option><option>250</option><option>500</option></select></label><label>Generations<select id="evGenerations"><option>20</option><option>30</option><option>50</option></select></label><button id="evSim" class="primary">Simulate population</button><button id="evEvolve" class="primary">Evolve population</button><div id="evStatus" role="status">Not simulated yet.</div><label>Generation<select id="evGeneration"><option value="0">Original</option></select></label><label>Retained alternative<select id="evAlternative"><option>Run evolution first</option></select></label><div id="evScores"></div><label><input id="evPrivacy" type="checkbox"> Entry privacy exposure map</label><label><input id="evPaths" type="checkbox"> Resident path traces</label><label><input id="evCompare" type="checkbox" checked> Before / after comparison</label><label><input id="evInteriors" type="checkbox" checked> Furnished interiors</label><label>Floor cut<select id="evFloor"><option value="0">Level 1</option><option value="1">Level 2</option><option value="2">Level 3</option><option value="all">All floors</option></select></label><button id="evPlan">Plan</button><button id="evAxon">3D</button><button id="evFrontDoor">View front door</button><button id="evFurnish">Furnishing / Couple Lab</button><button id="evBackDoor">View back door</button><button id="evTour">Walk route</button><button id="evStop">Stop / cancel</button><label>Visit room<select id="evRoom"></select></label><button id="evApply">Apply selected</button><button id="evRevert">Revert</button><button id="evExport">Export schema + asset schedule</button><button id="evEntrances">Audit four entrances</button><div id="evEntranceResults"></div><details><summary>Constraints and scope</summary><p id="evConstraints"></p><p>Ground-floor clearance is a geometric screen. Upper rooms use stairs and are not wheelchair-accessible. Daylight and privacy are proxies, not certified analyses. Door operation, headroom, structure and MEP require coordination.</p><p>Entrance locations and public vestibule dimensions are locked. The four entrance locations are retained. Entrance geometry mutations and full-building replication are deferred until clearance and discipline checks pass. The population is a scenario load test, not 100 people living in one home.</p></details></details><section id="evFurnishingLab" hidden><h3>Couple · Daily Living</h3><button id="evNextDay">Simulate next day</button><div id="evCoupleReport"></div><h3>Functional planning</h3><div id="evFitReport"></div><button id="evRepair">Resolve movable door clashes</button><h3>Shop & place — no automatic purchasing</h3><label>Furniture type<select id="evProductKind"><option value="sofa">Sofa</option><option value="bed">Bed</option><option value="table">Table</option><option value="desk">Desk</option><option value="wardrobe">Wardrobe</option><option value="cabinet">Cabinet</option><option value="chair">Chair</option></select></label><label>Width (ft)<input id="evProductW" type="number" min=".25" step=".1" value="3"></label><label>Depth (ft)<input id="evProductD" type="number" min=".25" step=".1" value="2"></label><label>Height (ft)<input id="evProductH" type="number" min=".25" step=".1" value="3"></label><label>Product / manufacturer URL<input id="evProductURL" type="url" placeholder="Paste exact official product page"></label><label>Product image URL<input id="evProductImage" type="url" placeholder="Direct HTTPS image (optional)"></label><label>Licensed GLB model URL<input id="evProductModel" type="url" placeholder="Direct HTTPS .glb (optional)"></label><label>Clearance (ft)<input id="evProductClearance" type="number" min=".5" step=".5" value="2.5"></label><button id="evPlaceProduct">Find valid placement</button><div id="evPlaceReport"></div><div id="evStores"></div></section></main>';
 const style=document.createElement('style');style.textContent='body.evolution-mode>.panel,body.evolution-mode .legend{display:none}body.evolution-mode #scene{left:350px;right:0}#evolutionWorkspace{position:fixed;z-index:100;left:14px;top:90px;bottom:14px;width:320px;overflow:auto;background:#fff;border:1px solid #bec7bd;box-shadow:0 12px 40px #0002;font:12px Arial;color:#25382e}#evolutionWorkspace header{padding:19px;background:#203a2c;color:#fff}#evolutionWorkspace small{letter-spacing:2px;color:#ccb998}#evolutionWorkspace h2{font-size:25px;margin:12px 0}#evolutionWorkspace main{padding:17px}#evolutionWorkspace button{cursor:pointer;border:1px solid #c6cdc4;padding:9px;background:#f3f4ee;color:#25382e;margin:4px 3px 4px 0}#evolutionWorkspace .primary{background:#294c37;color:white}#evolutionWorkspace button:disabled{opacity:.45;cursor:wait}#evolutionWorkspace label{display:block;margin:12px 0}#evolutionWorkspace select{display:block;width:100%;padding:7px;margin-top:5px;background:white;color:#222;border:1px solid #bcc4b9}#evolutionWorkspace p{font-size:11px;line-height:1.6}#evStatus{padding:10px;background:#f1eadf;line-height:1.5;margin:8px 0}#evScores table{width:100%;border-collapse:collapse;font-size:11px}#evScores td,#evScores th{text-align:left;border-bottom:1px solid #ddd;padding:7px 2px}#evClose{float:right}body.evolution-mode .view-tools{max-width:calc(100vw - 370px)}@media(max-width:700px){body.evolution-mode #scene{left:0;bottom:42vh}#evolutionWorkspace{top:auto;bottom:0;left:0;right:0;width:100%;height:40vh}#evolutionWorkspace header{padding:8px}#evolutionWorkspace h2{font-size:18px;margin:4px 0}body.evolution-mode .view-tools{display:none}}';style.textContent+='@media(max-width:760px){body.evolution-mode #evolutionWorkspace:not([hidden]){top:auto;bottom:0;left:0;right:0;width:auto;height:48dvh;max-height:48dvh;border-radius:12px 12px 0 0}body.evolution-mode #scene{top:var(--memo-header-h,66px);bottom:48dvh;left:0;right:0}#evolutionWorkspace header{position:sticky;top:0;z-index:3;padding:8px 14px}#evolutionWorkspace header h2{font-size:16px;margin:3px 0}#evolutionWorkspace header h2 br{display:none}#evolutionWorkspace header p{display:none}#evolutionWorkspace main{padding:12px 16px}}';document.head.append(style);document.body.append(panel);
 const $=id=>panel.querySelector('#'+id);$('evTypology').value='apartment';$('evFloor').innerHTML='<option value="0">Level '+(c.baseLevel+1)+'</option>';$('evBackDoor').hidden=true;$('evIdentity').textContent=c.id+' · Building '+c.building+' · Level '+(c.baseLevel+1)+' · '+baseline.rooms.length+' rooms';
 $('evConstraints').textContent=connection.valid?'Ground-wall route found. A five-foot connector floor closes the existing gap between vestibule and core. Route sampling: 0.75 ft. Other disciplines remain unverified.':connection.reason;
 const savedVisibility=new Map(),savedCamera={position:camera.position.clone(),target:controls.target.clone(),near:camera.near,minDistance:controls.minDistance};
 let archive=[],abort=null,entranceAudits=[];const appliedByUnit=new Map();
 repairDoorFurnitureClashes(baseline);let coupleDayNo=0,catalogAssets=[],current=baseline,history=[],baselineResult=null,result=null,applied=null,appliedElements=[],open=false,oldVisibility=true,animation=0,tour=null,agents=null,agentPaths=[],lastTime=0,playing=false,playTime=0;
 const invalidate=()=>window.memoInvalidate?.(),clear=g=>{while(g.children.length){const o=g.children.pop();o.traverse(x=>{if(x.geometry&&x.geometry!==boxGeo&&x.geometry!==sphereGeo)x.geometry.dispose();if(x.userData.ownedMaterial){x.material?.map?.dispose();x.material?.dispose();}});}};
 const world=(q,offset=0)=>{const p=c.toWorld(q[0]+offset,q[1]);return new THREE.Vector3(p[0],q[2]+(c.baseZ||0),p[1]);};
 function addBox(g,id,x,y,w,d,z,h,color,level){
  const mesh=new THREE.Mesh(boxGeo,material(color));mesh.position.copy(world([x+w/2,y+d/2,z+h/2]));mesh.rotation.y=Math.atan2(-c.u[1],c.u[0]);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={id,level};g.add(mesh);return mesh;
 }
 // The comparison deliberately has no floating room-name or ORIGINAL/SELECTED sprites.
 // The sidebar table already identifies Original vs Selected without obscuring the model.
 function drawUnitEntrance(layer,design,side='front'){
  const isFront=side==='front';
  const entry=design.doors?.find(o=>o.kind==='door'&&/apartment-door|[-]entry$/.test(o.id))||design.doors?.[0];
  if(isFront&&!entry)return;
  // Positions are resolved in the unit's local coordinates, not viewport pixels.
  // The rear triplex leaf is a schematic assembly pending source façade coordination.
  const width=isFront?(entry?.clearWidthFt||3.5):3.5;
  const x=isFront?(entry.x+(entry.w-width)/2):Math.max(.65,Math.min(c.W-width-.65,design.entry-width/2));
  const y=isFront?entry.y:c.D-.18;
  const z=isFront?entry.z:.75;
  const h=7.9,depth=.42,frame=.16;
  const id=design.id+(isFront?'-FRONT-ENTRY':'-BACK-ENTRY');
  const put=(suffix,x0,y0,w,d,z0,height,color)=>{
   const mesh=addBox(layer,id+'-'+suffix,x0,y0,w,d,z0,height,color,0);
   mesh.userData.doorAssembly=id;mesh.userData.doorPart=suffix;return mesh;
  };
  // Distinct jambs and transom frame wrap a proper height door leaf.
  put('left-jamb',x-frame,y-depth/2,frame,depth,z,h+.21,0x3c443e);
  put('right-jamb',x+width,y-depth/2,frame,depth,z,h+.21,0x3c443e);
  put('head-frame',x-frame,y-depth/2,width+2*frame,depth,z+h,.21,0x3c443e);
  put('threshold',x-frame,y-depth/2-.13,width+2*frame,depth+.26,z-.065,.065,0x777a72);
  put('door-leaf',x+.065,y-.078,width-.13,.156,z+.08,h-.14,0x92775a);
  // Stiles and recessed inset panel emphasize that this is an operable door.
  for(const sx of [x+.12,x+width-.22])put('stile-'+sx,sx,y-.10,.1,.2,z+.18,h-.38,0x574d3f);
  put('upper-inset',x+.40,y-.094,Math.max(.15,width-.8),.022,z+h*.56,h*.34,0xb7c9c6);
  put('kickplate',x+.32,y-.101,Math.max(.15,width-.64),.025,z+.18,.38,0x5f665f);
  // Door hardware projects on both the exterior and interior faces.
  const handleX=x+width-.34;
  for(const sign of [-1,1]){
   put('rose-'+sign,handleX-.09,y+sign*.14-.02,.18,.04,z+3.35,.25,0xb6a889);
   put('lever-'+sign,handleX-.36,y+sign*.18-.025,.35,.05,z+3.46,.065,0xcbb990);
  }
  for(const hz of [z+.8,z+h/2,z+h-.8]){
   put('hinge-'+hz,x+.05,y-.15,.1,.3,hz,.19,0xb5a78a);
  }
  // Local recessed return / jamb lining; keep inside wall plane, no outward vestibule.
  put('recess-left-return',x-frame-.25,y-.52,.25,.52,z,h+.2,0xecebe7);
  put('recess-right-return',x+width+frame,y-.52,.25,.52,z,h+.2,0xecebe7);
  put('recess-head-soffit',x-frame-.25,y-.52,width+2*frame+.5,.52,z+h+.2,.22,0xecebe7);
  put('recess-floor',x-frame-.25,y-.55,width+2*frame+.5,.55,z-.13,.12,0xb3ada0);
  // The complete door assembly stays part of the scene even when furniture is hidden.
  // This is presentation geometry; never report unverified placement as fabrication-ready.
 }
 function connectorElements(){
  if(!connection.valid)return [];
  const e=c.entrance;if(!e)return [];const core=model.pieces.find(p=>p.id===e.coreId),out=[];
  for(let i=1;i<e.route.length-1;i++){const a=e.route[i],b=e.route[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[-(b[1]-a[1])/len*2.5,(b[0]-a[0])/len*2.5],poly=[[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]];
   const pieces=window.polygonClipping.difference([poly],[core.polygon]);out.push({id:e.id+'-EV-connector-'+i,building:c.building,piece:core,level:0,type:'IFCSLAB',role:'Entrance to core connector floor',slab:true,evolution:true,color:0xd6d3c7,parts:pieces.map(p=>({polygon:p[0],holes:p.slice(1),z:.5,height:.25}))});
  }return out.filter(e=>e.parts.length);
 }
 let connectors=connectorElements();
 function draw(g,design,offset=0,withContext=false){
  const level=$('evFloor').value,limit=level==='all'?2:Number(level);
  const layer=new THREE.Group();layer.name=design.id;layer.position.set(c.u[0]*offset,0,c.u[1]*offset);g.add(layer);
  if(withContext&&c.typology==='triplex'){
   for(const e of model.elements.filter(e=>e.level===0&&(e.piece?.id===c.entrance.coreId||e.pieceId===c.entrance.coreId||e.designEntrance===c.entrance.id)&&!e.space&&!e.roof&&!e.id.endsWith('-canopy')&&!e.id.includes('clerestory'))){
    const m=meshForElement(e,true);if(e.type==='IFCDOOR'){m.geometry.computeBoundingBox();const ctr=m.geometry.boundingBox.getCenter(new THREE.Vector3());m.geometry.translate(-ctr.x,-ctr.y,-ctr.z);m.geometry.rotateY(Math.PI/2);m.position.copy(ctr);}m.userData.ownedMaterial=true;layer.add(m);
   }
   for(const e of connectors){const m=meshForElement(e,true);m.userData.ownedMaterial=true;layer.add(m);}
  }
  // Reuse actual unit façade and shared-wall geometry; cutaway is view-only.
  for(const e of model.elements.filter(e=>(e.piece?.id===(c.sourcePieceId||c.id)||e.pieceId===(c.sourcePieceId||c.id))&&e.level>=(c.baseLevel||0)&&e.level<=limit+(c.baseLevel||0)&&!e.space&&!e.roof&&!e.terrace&&!e.envelopeDetail&&!e.frame&&e.type!=='IFCDOOR'&&e.type!=='IFCWINDOW'&&e.type!=='IFCCURTAINWALL')){
   if(e.level<limit+(c.baseLevel||0)&&level!=='all')continue;
   if(e.parts?.length){const parts=e.parts.filter(p=>p.height>.15).map(p=>({...p,height:Math.min(p.height,e.facade?2.8:3)}));const m=meshForElement({...e,parts},true);m.userData.ownedMaterial=true;layer.add(m);}
  }
  for(const f of design.floors.filter(f=>f.level<=limit)){const e=elements(c,{...design,objects:[],rooms:[],floors:[f]})[0],m=meshForElement(e,true);m.userData.ownedMaterial=true;layer.add(m);}
  if(level==='all'||limit===0){
   drawUnitEntrance(layer,design,'front');
   if(c.typology==='triplex')drawUnitEntrance(layer,design,'back');
  }
  // Window and entry openings are generated in the actual BIM façade.
  // The isolated cutaway no longer overlays opaque blocks on window apertures.
  if($('evInteriors').checked){
   // Shared box definition/materials. IDs remain on semantic instances.
   for(const o of [...design.objects,...(design===current?[...catalogAssets,...(autoEngine?.furniture||[])]:[])].filter(o=>o.level<=limit)){
    if(level!=='all'&&o.level<limit&&!['tread','landing','rail'].includes(o.kind))continue;
    const colors={sofa:0x466b52,bed:0xddd3bb,wardrobe:0x927858,partition:0xf1ede3,rug:0xb5baa6,shower:0xc3d4cb,sink:0xf1f0e9,toilet:0xf1f0e9,stove:0x3d423d,fridge:0xc2c6bc,door:0x7e7157,rail:0x69563e};
    if(o.elevations){const e=elements(c,{...design,objects:[o],rooms:[],floors:[]})[0],m=meshForElement(e,true);m.userData.ownedMaterial=true;layer.add(m);continue;}
    if(o.kind==='door'){if(design.doors?.[0]===o)continue;addBox(layer,o.id,o.x,o.y,o.axis==='y'?o.d:.12,o.axis==='y'?.12:o.w,o.z,7.5,colors.door,o.level);continue;}
    addBox(layer,o.id,o.x,o.y,o.w,o.d,o.z,o.kind==='partition'?Math.min(o.h,3):o.h,colors[o.kind]||0xa18a69,o.level);
    if(o.kind==='bed'){addBox(layer,o.id+'-pillow',o.x+.35,o.y+.3,o.w-.7,1.2,o.z+o.h,.3,0xfaf8f1,o.level);}
    if(o.kind==='sofa')addBox(layer,o.id+'-back',o.x,o.y,.4,o.d,o.z+o.h,1,0x355540,o.level);
   }
  }
  return layer;
 }
 function updateScores(){
  if(!result||!baselineResult){$('evScores').textContent='Run Simulate to measure this layout.';return;}
  $('evScores').innerHTML='<table><tr><th>Metric</th><th>Original</th><th>Selected</th></tr>'+[['Privacy',baselineResult.privacy,result.privacy],['Routes complete %',baselineResult.circulation,result.circulation],['Walk / resident (ft)',baselineResult.walkingFt,result.walkingFt],['Daylight proxy',baselineResult.daylight,result.daylight],['Complexity points',baselineResult.complexity,result.complexity],['Queue mean (s)',baselineResult.meanQueueSeconds,result.meanQueueSeconds],['Peak sampled occupancy',baselineResult.peakCellOccupancy,result.peakCellOccupancy],['Score',baselineResult.score,result.score]].map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</table>';
 }
 function render(){clear(group);if($('evCompare').checked)draw(group,baseline,-c.W-12,false);draw(group,current,0,!$('evCompare').checked);agents=null;
  if(result&&$('evPrivacy').checked)for(const q of result.privacyMap){const m=new THREE.Mesh(boxGeo,material(q.exposed?0xb65344:0x4a7c56));m.position.copy(world([q.x,q.y,1]));m.scale.set(.8,.06,.8);group.add(m);}
  if(result&&$('evPaths').checked)for(const r of result.routines){const geom=new THREE.BufferGeometry().setFromPoints(r.path.map(q=>{const p=world(q);p.y+=.2;return p;})),m=new THREE.Line(geom,new THREE.LineBasicMaterial({color:0x9f7044}));m.userData.ownedMaterial=true;group.add(m);}
  updateScores();invalidate();}
 function frame(plan=false){const x=$('evCompare').checked?-6:c.W/2,y=12,level=$('evFloor').value==='all'?1:+$('evFloor').value,p=world([x,y,level*12+2]),eye=world([x+(plan?.01:38),y-(plan?0:65),plan?120:85]);controls.enabled=true;camera.near=.15;camera.position.copy(eye);controls.target.copy(p);camera.updateProjectionMatrix();for(let i=0;i<20;i++)controls.update();invalidate();}
 function stop(){playing=false;tour=null;controls.enabled=true;if(animation)cancelAnimationFrame(animation);animation=0;}
 function installAgents(){
  if(agents)group.remove(agents);agents=new THREE.InstancedMesh(sphereGeo,material(0xa45c36),result.agents.length);agents.name='Deterministic scenario residents';group.add(agents);
  const worldPaths=new Map();agentPaths=result.agents.map(a=>{if(!worldPaths.has(a.routine))worldPaths.set(a.routine,a.path.map(q=>world(q)));return worldPaths.get(a.routine);});playTime=0;lastTime=performance.now();playing=true;tick();
 }
 function tick(now=performance.now()){
  if(!open||(!playing&&!tour)){animation=0;return;}
  const dt=Math.max(0,Math.min(.05,(now-lastTime)/1000||0));lastTime=now;playTime+=dt;
  if(playing&&agents){const matrix=new THREE.Matrix4();agentPaths.forEach((path,i)=>{if(!path.length)return;const f=(playTime*7+i*11)%path.length,j=Math.floor(f),v=path[j].clone().lerp(path[(j+1)%path.length],f-j);v.y+=2;matrix.makeTranslation(v.x,v.y,v.z);agents.setMatrixAt(i,matrix)});agents.instanceMatrix.needsUpdate=true;}
  if(tour){tour.progress+=dt*6;const j=Math.floor(tour.progress);if(j>=tour.path.length-1){tour=null;controls.enabled=true;}else{const q=tour.path[j].clone().lerp(tour.path[j+1],tour.progress-j),look=tour.path[Math.min(j+3,tour.path.length-1)].clone();q.y+=5.3;look.y+=5.3;camera.position.copy(q);camera.lookAt(look);controls.target.copy(look);}}
  invalidate();animation=requestAnimationFrame(tick);
 }
 function run(){stop();baselineResult=simulate(c,baseline,{agents:+$('evAgentCount').value});result=simulate(c,current,{agents:+$('evAgentCount').value});$('evStatus').textContent=result.valid?'Executed '+result.agentCount+' scenarios / '+result.profileCount+' profiles · '+result.steps+' navigation samples · '+result.ms+' ms'+(result.cached?' · cached':''):result.errors.join('; ');render();if(result.valid)installAgents();}
 $('evSim').onclick=run;
 $('evEvolve').onclick=async()=>{stop();abort=new AbortController();$('evEvolve').disabled=true;$('evSim').disabled=true;$('evTypology').disabled=true;try{
 baselineResult=simulate(c,baseline,{agents:+$('evAgentCount').value});
 const e=await evolvePopulation(c,baseline.params,{agents:+$('evAgentCount').value,generations:+$('evGenerations').value,signal:abort.signal},h=>$('evStatus').textContent='Generation '+h.generation+' / '+$('evGenerations').value+' · '+h.accepted+' valid candidates');
 history=e.history;archive=e.archive;current=e.best.geometry;repairDoorFurnitureClashes(current);result=e.best.result;
 $('evGeneration').innerHTML=history.map((h,i)=>'<option value="'+i+'">Generation '+i+' · '+h.result.score+'</option>').join('');$('evGeneration').value=String(history.length-1);
 $('evAlternative').innerHTML='<option value=-1>Current best candidate</option>'+archive.map((h,i)=>'<option value="'+i+'">Alternative '+(i+1)+' · privacy '+h.result.privacy+' / complexity '+h.result.complexity+'</option>').join('');
 render();$('evStatus').textContent=(e.cancelled?'Stopped after ':'Executed ')+e.evaluations+' candidate evaluations · '+e.rejected+' rejected · '+archive.length+' retained alternatives.';
 }catch(e){$('evStatus').textContent=e.message;}finally{abort=null;$('evEvolve').disabled=false;$('evSim').disabled=false;$('evTypology').disabled=false;}};
 $('evAlternative').onchange=()=>{stop();const h=archive[+$('evAlternative').value];if(h){current=h.geometry;repairDoorFurnitureClashes(current);result=simulate(c,current,{agents:+$('evAgentCount').value});render();}};

 $('evGeneration').onchange=()=>{stop();const h=history[+$('evGeneration').value];if(h){current=h.geometry;repairDoorFurnitureClashes(current);result=simulate(c,current,{agents:+$('evAgentCount').value});}render();};
 for(const id of ['evCompare','evInteriors','evFloor','evPrivacy','evPaths'])$(id).onchange=()=>{stop();render();frame();};
 $('evPlan').onclick=()=>{stop();frame(true)};$('evAxon').onclick=()=>{stop();frame()};
 function viewDoor(side){
  stop();$('evCompare').checked=false;$('evFloor').value='0';render();
  const o=current.doors?.find(q=>q.kind==='door'&&/apartment-door|[-]entry$/.test(q.id))||current.doors?.[0];
  if(!o)return;
  const back=side==='back',w=back?3.5:(o.clearWidthFt||3.5);
  const x=back?Math.max(.65,Math.min(c.W-w-.65,current.entry-w/2))+w/2:o.x+o.w/2;
  const y=back?c.D-.18:o.y,z=back?.75:o.z;
  const target=world([x,y,z+4.2]),eye=world([x+11,y+(back?18:-18),z+10]);
  camera.position.copy(eye);controls.target.copy(target);controls.enabled=true;camera.near=.1;camera.updateProjectionMatrix();controls.update();invalidate();
 }
 let autoEngine=null,autoBusy=false,autoCancelled=false;
 async function autonomousRun(){
  if(autoBusy)return;
  autoBusy=true;autoCancelled=false;$('evAutoRun').disabled=true;
  $('evCompare').checked=false;$('evInteriors').checked=true;$('evFloor').value='0';
  repairDoorFurnitureClashes(current);
  autoEngine=createCoupleAutonomy(current,{days:14});
  const checks=autonomousAcceptanceTests(current);
  $('evAutoStatus').textContent='Running 14-day deterministic household simulation. '+checks.filter(x=>!x.passed).length+' test checks need review.';
  try{
   while(!autoCancelled&&autoEngine.day<14){
    const day=autoEngine.step();if(!day)break;
    $('evAutoResults').textContent='Day '+day.day+' · '+day.residents.map(r=>r.resident+': '+r.walkFt+' ft').join(' / ')+' · '+day.shopping.length+' simulated product selection(s) · '+day.rejects.length+' rejected · '+day.doorClashes+' door clashes · '+day.blockedRooms+' unreachable rooms.';
    if(day.day===1||day.day===14||day.shopping.length)render();
    await new Promise(resolve=>setTimeout(resolve,30));
   }
   const final=autoEngine.report();
   $('evAutoStatus').textContent=(autoCancelled?'Stopped after ':'Completed ')+final.daysCompleted+' days · '+final.addedFurniture+' safe furnishing proxies added · '+final.rejectedItems+' rejected items · 0 real purchases · '+(final.lastDay?.unreachableRoutes??0)+' unresolved route segments. The design is not compliance-certified.';
   if(!$('evFurnishingLab').hidden)refreshFurnishing();
  }catch(error){$('evAutoStatus').textContent='Simulation stopped: '+error.message;}
  finally{autoBusy=false;$('evAutoRun').disabled=false;}
 }
 $('evAutoRun').onclick=autonomousRun;
 $('evAutoStop').onclick=()=>{autoCancelled=true;autoEngine?.stop();};
 $('evAutoExport').onclick=()=>{if(!autoEngine){$('evAutoStatus').textContent='Run the household simulation first.';return;}const url=URL.createObjectURL(new Blob([JSON.stringify(autoEngine.export(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='MEMO-Couple-Living-Lab.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 function showFurnishing(){
  const lab=$('evFurnishingLab');lab.hidden=!lab.hidden;
  if(!lab.hidden){refreshFurnishing();lab.scrollIntoView({block:'nearest'});}
 }
 function refreshFurnishing(){
  const fit=inspectFunctionalLayout(current,[...catalogAssets,...(autoEngine?.furniture||[])]);
  $('evFitReport').textContent=(fit.valid?'All checked objects and areas pass the schematic checks.':'Unresolved layout issues: ')+fit.issues.slice(0,7).map(x=>x.type+': '+x.a+' / '+x.b).join('; ')+(fit.inaccessible.length?' · Inaccessible uses: '+fit.inaccessible.slice(0,6).join(', '):'')+(fit.blockedRooms.length?' · Rooms unreachable: '+fit.blockedRooms.join(', '):'');
  const day=coupleDay(current,coupleDayNo||1,[...catalogAssets,...(autoEngine?.furniture||[])]);
  $('evCoupleReport').textContent='Day '+(coupleDayNo||1)+' · '+day.residents.map(r=>r.resident+': '+r.walkFt+' ft, '+r.unreachable.length+' unmet routes').join(' · ')+'. Shopping needs: '+(day.needs.map(n=>n.label).join(', ')||'basic needs represented');
 }
 $('evFurnish').onclick=showFurnishing;
 $('evRepair').onclick=()=>{const r=repairDoorFurnitureClashes(current);$('evPlaceReport').textContent=r.repairs.length+' furniture positions repaired; '+r.unresolved.length+' require manual redesign.';render();refreshFurnishing();};
 $('evNextDay').onclick=()=>{coupleDayNo++;refreshFurnishing();};
 $('evStores').innerHTML='<p>Browse official products. Enter exact item dimensions and its official page; pictures are shown only when a supplied URL permits it. Exact 3D likeness requires a licensed, matching GLB.</p>'+STORES.map(v=>'<a href="'+v.url+'" target="_blank" rel="noopener noreferrer">'+v.name+'</a> · ').join('');
 $('evPlaceProduct').onclick=()=>{
  const kind=$('evProductKind').value,id='catalog-'+String(catalogAssets.length+1).padStart(3,'0');
  const item={id,kind,widthFt:+$('evProductW').value,depthFt:+$('evProductD').value,heightFt:+$('evProductH').value,clearanceFt:+$('evProductClearance').value};
  const page=$('evProductURL').value.trim(),image=$('evProductImage').value.trim(),glb=$('evProductModel').value.trim();
  if(page&&!/^https:\/\//i.test(page)){ $('evPlaceReport').textContent='Official product URL must be HTTPS.';return;}
  if(image&&!/^https:\/\//i.test(image)){ $('evPlaceReport').textContent='Image URL must be HTTPS.';return;}
  if(glb&&!/^https:\/\//i.test(glb)){ $('evPlaceReport').textContent='3D model URL must be HTTPS.';return;}
  const chosen=findFurnitureLocation(current,item,{level:0,additional:catalogAssets});
  if(!chosen){$('evPlaceReport').textContent='No valid position with current clearance and route tests. Item not placed.';return;}
  const q=validateNewFurniture(current,{...item,widthFt:chosen.object.w,depthFt:chosen.object.d},chosen.object.x,chosen.object.y,0,catalogAssets);
  if(!q.valid){$('evPlaceReport').textContent=q.reasons.join('; ');return;}
  const asset={...chosen.object,productUrl:page||null,productImageUrl:image||null,modelUrl:glb||null,rotationDeg:chosen.rotation,catalogStatus:glb?'Licensed model URL supplied, not verified':'Schematic dimensions; exact manufacturer model model not available',nonBlocking:false};
  catalogAssets.push(asset);
  $('evPlaceReport').textContent='Placed '+id+' at ('+asset.x.toFixed(1)+', '+asset.y.toFixed(1)+') ft. '+asset.catalogStatus+' · No checkout performed.';
  if(image){const img=document.createElement('img');img.src=image;img.alt='User supplied product photo';img.referrerPolicy='no-referrer';img.loading='lazy';img.style.cssText='max-width:100%;max-height:140px;display:block';$('evPlaceReport').append(img);}
  if(page){const a=document.createElement('a');a.href=page;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' Open exact product page';$('evPlaceReport').append(a);}
  refreshFurnishing();render();
 };
 $('evFrontDoor').onclick=()=>viewDoor('front');
 $('evBackDoor').onclick=()=>viewDoor('back');

 $('evRoom').innerHTML=current.rooms.map((r,i)=>'<option value="'+i+'">'+r.name+'</option>').join('');
 $('evRoom').onchange=()=>{const r=current.rooms[+$('evRoom').value];$('evFloor').value=String(r.level);render();const p=world([r.target[0],r.target[1],r.level*12+6]);camera.position.copy(p);const q=world([r.target[0]+3,r.target[1]+3,r.level*12+6]);camera.lookAt(q);controls.target.copy(q);invalidate();};
 $('evTour').onclick=()=>{stop();if(!result)run();stop();const interior=result.agents[0].path.map(q=>world(q)),path=connection.valid?[...connection.path.map(q=>new THREE.Vector3(...q)),...interior]:interior;$('evCompare').checked=false;$('evFloor').value=c.typology==='triplex'?'all':'0';render();tour={path,progress:0};controls.enabled=false;lastTime=performance.now();tick();$('evStatus').textContent=connection.valid?'Walking the sampled entrance and furnished unit. Stop to orbit.':'Interior-only tour: upper corridor/core connection is not verified.';};$('evStop').onclick=()=>{abort?.abort();stop();};
 function appliedRender(){clear(appliedGroup);if(!appliedElements.length)return;const old=$('evFloor').value,interior=$('evInteriors').checked;$('evFloor').value='all';$('evInteriors').checked=true;
  // Only new elements: no duplicated source shell.
  for(const e of appliedElements.filter(e=>!e.space)){const mesh=meshForElement(e,true);mesh.userData.ownedMaterial=true;appliedGroup.add(mesh);}
  $('evFloor').value=old;$('evInteriors').checked=interior;
 }
 $('evApply').onclick=()=>{const s=simulate(c,current);if(!s.valid)return void($('evStatus').textContent='Invalid candidate; apply rejected.');if(JSON.stringify(getModel().pieces.find(p=>p.id===(c.sourcePieceId||c.id))?.groundPolygon)!==originalFingerprint)return void($('evStatus').textContent='Source changed; reopen Evolution Lab before applying.');applied=structuredClone(current.params);appliedByUnit.set(c.id,[...elements(c,current),...connectors]);appliedElements=[...appliedByUnit.values()].flat();appliedRender();$('evStatus').textContent='Applied to this session: '+appliedElements.length+' semantic elements. Base geometry unchanged. Close to see the model.';invalidate();};
 $('evRevert').onclick=()=>{stop();applied=null;appliedByUnit.clear();appliedElements=[];clear(appliedGroup);current=baseline;result=baselineResult;render();$('evGeneration').value='0';$('evStatus').textContent='Reverted all Evolution additions. Original model unchanged.';};
 $('evExport').onclick=()=>{const data={...schedule(c,current),entranceAudits:entranceAudits.map(({path,...r})=>r),simulation:result?{...result,agents:result.agents.map(({path,...a})=>a),routines:result.routines.map(({path,...r})=>r)}:null,generations:history.map(h=>({generation:h.generation,parameters:h.geometry.params,score:h.result.score,privacy:h.result.privacy,complexity:h.result.complexity})),alternatives:archive.map(h=>({parameters:h.geometry.params,privacy:h.result.privacy,walkingFt:h.result.walkingFt,complexity:h.result.complexity}))};const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='MEMO-Evolution-'+c.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 $('evEntrances').onclick=async()=>{const b=$('evEntrances');b.disabled=true;$('evEntranceResults').textContent='Checking existing wall clearances…';try{entranceAudits=await studyEntrances(model,'B1');$('evEntranceResults').innerHTML=entranceAudits.map(e=>'<p><b>'+e.id+' / '+e.type+' / '+e.portalWidthFt+' ft</b><br>'+(e.valid?'Sampled route found; full access audit pending.':'BLOCKED: '+e.reason)+'</p>').join('');}catch(e){$('evEntranceResults').textContent=e.message;}finally{b.disabled=false;}};
 $('evTypology').onchange=()=>{
 stop();try{c=context(model,$('evTypology').value);connection=c.typology==='triplex'?entranceRoute(c):c.connection;c.connection=connection;baseline=generate(c,{...defaults,vestibuleDepth:c.entrance?.airlockDepth||12});originalFingerprint=JSON.stringify(c.piece.groundPolygon);current=baseline;history=[];archive=[];result=null;baselineResult=null;connectors=c.typology==='triplex'?connectorElements():[];
 $('evIdentity').textContent=c.id+' · Building '+c.building+' · Level '+(c.baseLevel+1)+' · '+baseline.rooms.length+' rooms';
 $('evBackDoor').hidden=c.typology!=='triplex';$('evFloor').innerHTML=c.typology==='triplex'?'<option value="0">Level 1</option><option value="1">Level 2</option><option value="2">Level 3</option><option value="all">All floors</option>':'<option value="0">Level '+(c.baseLevel+1)+'</option>';
 $('evRoom').innerHTML=current.rooms.map((r,i)=>'<option value="'+i+'">'+r.name+'</option>').join('');$('evGeneration').innerHTML='<option value="0">Original</option>';$('evAlternative').innerHTML='<option>Run evolution first</option>';
 $('evConstraints').textContent=connection.reason;$('evStatus').textContent='Not simulated yet. Interior geometry fitted to existing envelope.';render();frame();if(!$('evFurnishingLab').hidden)refreshFurnishing();
 }catch(e){$('evStatus').textContent=e.message;}
 };

 function close(){autoCancelled=true;autoEngine?.stop();abort?.abort();stop();open=false;panel.hidden=true;group.visible=false;for(const [o,v] of savedVisibility)o.visible=v;savedVisibility.clear();architecture.visible=oldVisibility;document.body.classList.remove('evolution-mode');window.dispatchEvent(new Event('resize'));camera.position.copy(savedCamera.position);camera.near=savedCamera.near;controls.minDistance=savedCamera.minDistance;controls.target.copy(savedCamera.target);camera.updateProjectionMatrix();controls.update();invalidate();}
 function show(){if(!open)oldVisibility=architecture.visible;if(!open){for(const o of scene.children){savedVisibility.set(o,o.visible);if(o!==group&&!o.isLight&&!o.children.some(x=>x.isLight))o.visible=false;}}open=true;controls.minDistance=.5;architecture.visible=false;group.visible=true;panel.hidden=false;document.body.classList.add('evolution-mode');window.dispatchEvent(new Event('resize'));render();frame();}
 $('evClose').onclick=close;
 const api={open:show,close,getAppliedElements:()=>appliedElements,getState:()=>({unit:c.id,typology:c.typology,alternatives:archive.length,entranceAudits:entranceAudits.map(({path,...r})=>r),entrance:c.entrance?.id||null,params:current.params,result,history:history.map(h=>({generation:h.generation,score:h.result.score,valid:h.result.valid})),connection,applied:!!applied,sourceUnchanged:JSON.stringify(c.piece.groundPolygon)===originalFingerprint,rooms:current.rooms,assets:current.objects}),getContext:()=>c};
 window.memoEvolution=api;show();$('evFurnishingLab').hidden=false;autonomousRun();return api;
}
