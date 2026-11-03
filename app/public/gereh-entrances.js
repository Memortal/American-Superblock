import {computeGerehEntrances,createGerehIfcProxies,reserveRecessedEntrances,auditEntrances,auditEntranceServices,setEntranceParameters,TYPES} from './gereh-engine.js';
import {entranceSheet,downloadGereh} from './gereh-drawings.js';
export {computeGerehEntrances,createGerehIfcProxies};
export function createGerehLayer(THREE,root){
 const layer=new THREE.Group();root.add(layer);layer.name='Gereh core route review';
 let records=[],components=[],options={paths:false},model=null;
 function rebuild(buildings,pieces,elements=[],axes=[]){
  model={buildings,pieces,elements,axes};records=[];components=[];
  // Vestibules removed by design instruction. Existing shared L1 exits remain authoritative.

  while(layer.children.length){const c=layer.children.pop();c.geometry?.dispose();c.material?.dispose();}
  for(const e of records){
   const geo=new THREE.BufferGeometry().setFromPoints(e.route.map(p=>new THREE.Vector3(p[0],1.2,p[1])));
   const line=new THREE.Line(geo,new THREE.LineDashedMaterial({color:0xa66e36,dashSize:1,gapSize:.5,depthTest:false}));
   line.computeLineDistances();line.userData={building:e.building,id:e.id};layer.add(line);
  }
  layer.visible=options.paths;window.memoGerehEntrances=records;window.memoGerehComponents=components;return records;
 }
 function visibility(focus='all',level='all',section='all'){layer.visible=options.paths&&(level==='all'||level==='0');for(const c of layer.children)c.visible=focus==='all'||c.userData.building===focus;window.memoInvalidate?.();}
 function highlight(id){for(const c of layer.children)c.visible=c.userData.id===id;window.memoInvalidate?.();}
 return {layer,rebuild,visibility,highlight,setOptions:v=>{options={...options,...v};visibility();},get records(){return records},get components(){return components},get options(){return options},get model(){return model}};
}
export function mountGerehWorkspace({system,camera,controls,updateView,rebuild}){
 document.getElementById('gerehWorkspace')?.remove();document.body.classList.add('gereh-mode');window.dispatchEvent(new Event('resize'));
 const panel=document.createElement('aside');panel.id='gerehWorkspace';
 panel.innerHTML='<header><small>MEMO STUDIO / GF60</small><button id="gwClose">×</button><h2>Gereh entrances</h2><p>16 core-linked thresholds · schematic coordination</p></header><main><label>Entrance<select id="gwSelect"></select></label><div id="gwFacts"></div><h3>Parametric kit</h3><div id="gwInputs"></div><label>Material<select id="gwMaterial"><option value="stone">Light natural stone</option><option value="concrete">Warm-white concrete</option><option value="bronze">Bronze metal</option></select></label><label><input id="gwLight" type="checkbox"> Concealed warm-white lighting</label><button id="gwApply" class="primary">Apply to selected entrance</button><button id="gwType">Apply to all four of this type</button><h3>Inspect</h3><button id="gwFocus">Frame entrance</button><button id="gwAll">Whole superblock</button><label><input id="gwPaths" type="checkbox"> Show core route reservations</label><button id="gwAudit">Check structure + MEP envelopes</button><div id="gwIssues"></div><h3>Documents + editable geometry</h3><button id="gwPlan">Plan + section SVG</button><button id="gwPanels">Fabrication + schedule SVG</button><button id="gwCSV">Component schedule CSV</button><button id="gwJSON">Editable geometry JSON</button><p class="note">A601–A604 and A610 are also in Documentation. Use the main IFC export for the same modeled components. Route lines are reservations, not certified accessible paths.</p></main>';
 const style=document.createElement('style');style.textContent='body.gereh-mode>.panel{display:none}body.gereh-mode #scene{right:0;left:370px}body.gereh-mode .legend{display:none}@media(max-width:700px){body.gereh-mode #scene{left:0;right:0;bottom:0}}#gerehWorkspace{position:fixed;left:20px;top:90px;width:345px;max-height:calc(100vh - 135px);overflow:auto;background:#fff;color:#171d19;z-index:40;box-shadow:0 12px 50px #0003;border:1px solid #a8afa9;font:12px Arial,sans-serif}#gerehWorkspace header{background:#203d31;color:white;padding:20px}#gerehWorkspace small{letter-spacing:2px;color:#c8aa7f}#gerehWorkspace h2{font-size:25px;margin:12px 0 8px}#gerehWorkspace p{line-height:1.5;font-size:11px}#gerehWorkspace main{padding:18px}#gerehWorkspace label{display:block;margin:9px 0}#gerehWorkspace select,#gerehWorkspace input[type=number]{width:100%;padding:8px;border:1px solid #bbb;background:#fff;color:#111;margin-top:5px;box-sizing:border-box}#gerehWorkspace button{padding:9px;border:1px solid #a5ada7;background:#f5f6f2;color:#22392d;margin:4px 4px 4px 0;cursor:pointer;font:11px Arial}#gerehWorkspace .primary{background:#244b38;color:white}#gerehWorkspace h3{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;border-top:1px solid #ddd;padding-top:16px;margin-top:20px}#gwClose{float:right!important;background:none!important;color:white!important;font-size:22px!important;border:none!important}#gwInputs{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}#gwFacts{padding:12px;background:#f1f3ed;line-height:1.8}#gwIssues{padding:10px;background:#f9f1e5;font-size:11px;line-height:1.6;margin-top:10px}#gerehWorkspace .note{color:#666}@media(max-width:700px){#gerehWorkspace{left:8px;top:70px;width:calc(100% - 16px);max-height:55vh}}';
 panel.append(style);document.body.append(panel);
 const $=id=>panel.querySelector('#'+id);
 let selected=window.memoGerehSelected||system.records[0]?.id;
 const fields=[['width','Portal width (ft)',10,32,1],['canopyDepth','Canopy depth (ft)',6,20,1],['airlockDepth','Airlock depth (ft)',10,18,1],['recursion','Gereh subdivision',1,3,1],['porosity','Screen open ratio',.2,.8,.05],['planterSize','Planter width (ft)',2,6,.5]];
 $('gwSelect').innerHTML=system.records.map(e=>'<option value="'+e.id+'">'+e.id+' / '+e.label+' / '+e.coreLabel+'</option>').join('');
 $('gwInputs').innerHTML=fields.map(([key,title,min,max,step])=>'<label>'+title+'<input id="gw-'+key+'" type="number" min="'+min+'" max="'+max+'" step="'+step+'"></label>').join('');
 const current=()=>system.records.find(e=>e.id===selected);
 function refresh(){const e=current();if(!e)return;$('gwSelect').value=selected;window.memoGerehSelected=selected;
  fields.forEach(([k])=>$('gw-'+k).value=e[k]);$('gwMaterial').value=e.material;$('gwLight').checked=e.lighting;
  $('gwFacts').innerHTML='<b>'+e.coreId+'</b><br>'+e.width+' ft recessed portal · '+e.airlockAreaSF+' SF enclosed airlock<br>2 self-closing doors · 39 in assumed clear<br>Opaque lower side walls · offset outside door '+e.privacy.outerDoorOffsetFt+' ft<br>Residential frontage screened: '+(window.memoPrivacyReport?.screenedFrontageFt||0)+' ft<br>'+e.panelCount+' flat canopy cells / '+e.recursion+' generations<br>'+e.componentCount+' scheduled components';
  $('gwIssues').innerHTML='<b>Coordination / unresolved</b><br>'+e.issues.join('<br>')+(e.conflicts.length?'<br><b>Overlap IDs:</b> '+e.conflicts.slice(0,4).map(c=>c.id).join(', '):'');
 }
 function focus(){const e=current(),q=e.position,n=e.normal,t=[n[1],-n[0]],dist=Math.max(50,e.width*2);camera.position.set(q[0]+n[0]*dist+t[0]*dist*.4,27,q[1]+n[1]*dist+t[1]*dist*.4);controls.target.set(q[0]+n[0]*e.airlockDepth,4,q[1]+n[1]*e.airlockDepth);controls.update();system.highlight(e.id);updateView?.();}
 function apply(all){const values={material:$('gwMaterial').value,lighting:$('gwLight').checked};
  for(const [k,,min,max] of fields){const val=+$('gw-'+k).value;if(!Number.isFinite(val)||val<min||val>max){alert(k+' must be between '+min+' and '+max);return;}values[k]=val;}
  const targets=all?system.records.filter(e=>e.type===current().type):[current()];targets.forEach(e=>setEntranceParameters(e.id,values));rebuild?.();refresh();focus();
 }
 $('gwApply').onclick=()=>apply(false);$('gwType').onclick=()=>apply(true);$('gwSelect').onchange=ev=>{selected=ev.target.value;refresh();focus();};
 $('gwAudit').onclick=async()=>{const btn=$('gwAudit');btn.disabled=true;btn.textContent='Checking modeled members and services…';await new Promise(r=>setTimeout(r,50));try{await auditEntranceServices(system.records,system.model);refresh();$('gwIssues').innerHTML+='<br><b>Service screening:</b> '+current().coordination.structure+'; '+current().coordination.MEP+'<br>'+current().serviceConflicts.slice(0,8).map(c=>c.discipline+' '+c.id).join(', ');}catch(err){$('gwIssues').textContent='Audit incomplete: '+err.message;}finally{btn.disabled=false;btn.textContent='Check structure + MEP envelopes';}};
 $('gwFocus').onclick=focus;$('gwClose').onclick=()=>{panel.remove();document.body.classList.remove('gereh-mode');window.dispatchEvent(new Event('resize'));system.setOptions({paths:false});};
 $('gwAll').onclick=()=>{camera.position.set(850,540,850);controls.target.set(0,65,0);controls.update();system.visibility();updateView?.();};
 $('gwPaths').onchange=e=>{system.setOptions({paths:e.target.checked});system.highlight(selected);};
 $('gwPlan').onclick=()=>downloadGereh('MEMO_'+selected+'_plan-section.svg',entranceSheet(system.records,current().id),'image/svg+xml');
 $('gwPanels').onclick=()=>downloadGereh('MEMO_Gereh_fabrication.svg',entranceSheet(system.records,current().id,true),'image/svg+xml');
 $('gwJSON').onclick=()=>downloadGereh('MEMO_Gereh_editable_geometry.json',JSON.stringify({version:2,units:'feet',entrances:system.records,elements:system.components.map(({piece,...e})=>({...e,pieceId:piece.id}))},null,2),'application/json');
 $('gwCSV').onclick=()=>{const rows=[['ID','Entrance','Building','Core','IFC type','Role','Parts','Area SF','Stage'],...system.components.map(e=>[e.id,e.designEntrance,e.building,e.coreId,e.type,e.role,e.parts.length,e.parts.reduce((s,p)=>s+Math.abs(p.polygon.reduce((s,a,i)=>{const b=p.polygon[(i+1)%p.polygon.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2),0).toFixed(2),e.designStage])];downloadGereh('MEMO_Gereh_components.csv',rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n'),'text/csv');};
 refresh();focus();return panel;
}
