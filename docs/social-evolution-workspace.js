/* MEMO Social Evolution UI. Linked to existing Life Lab, never commits to BIM. */
import {makeSocialContext,evolveSocial,validateSocialDesign,SOCIAL_SCHEMA} from './social-evolution-engine.js';
const COLORS={open:0x9cb5a5,commons:0xc9ad72,garden:0x6d9f6d,culture:0xaf91b8,maker:0x83a8bc,quiet:0x93a9a0};
export function mountSocialEvolution({THREE,scene,getModel,onClose=()=>{}}){
 if(window.memoSocial){window.memoSocial.open();return window.memoSocial;}
 let context=makeSocialContext(getModel()),report=null,abort=null,preview=false,running=false;
 const group=new THREE.Group();group.name='MEMO Social Evolution - reversible schematic proposal';scene.add(group);
 const shell=document.createElement('aside');shell.id='memoSocialEvolution';
 shell.innerHTML='<header><small>MEMO STUDIO / LIFE LAB</small><button id="msClose" title="Close">×</button><h2>Social Evolution</h2><p>Objective: voluntary, lasting social connection.</p></header>'+
 '<main><div class="msNotice">Existing architecture retained. Four courtyard programs may evolve; all 16 entrances and protected geometry stay locked. Proposed assets are visualization only.</div>'+
 '<div class="msInputs"><label>Residents<input id="msAgents" type="number" min="20" max="240" value="80"></label><label>Days / run<input id="msDays" type="number" min="7" max="90" value="30"></label><label>Generations<input id="msGens" type="number" min="1" max="12" value="4"></label></div>'+
 '<button class="msPrimary" id="msRun">▶ Evolve social connection</button><button id="msCancel" disabled>Stop</button>'+
 '<div id="msStatus" role="status">Ready. Baseline is the four existing unprogrammed courtyards.</div>'+
 '<div id="msScores"></div><div id="msHistory"></div><div id="msZones"></div>'+
 '<button id="msPreview" disabled>Show evolved proposal in 3D</button><button id="msRestore">Restore original view</button><button id="msExport" disabled>Export study JSON</button>'+
 '<p class="msFoot">Research prototype: synthetic, uncalibrated resident behavior. Results are not real-world predictions. Geometry overlays are not validated for accessibility, egress, structure, drainage or MEP, and are never applied to BIM.</p></main>';
 const style=document.createElement('style');
 style.textContent='#memoSocialEvolution{position:fixed;top:90px;left:15px;bottom:16px;width:355px;max-width:calc(100vw - 30px);overflow:auto;background:#fffefa;color:#273b2c;border:1px solid #c7d1c6;box-shadow:0 12px 40px #0003;z-index:60;font:12px Arial,sans-serif}#memoSocialEvolution header{background:#244231;color:#fff;padding:18px}#memoSocialEvolution header small{font-size:9px;letter-spacing:1.5px;color:#d7c8a4}#memoSocialEvolution header h2{font-size:24px;font-weight:500;margin:9px 0}#memoSocialEvolution header p{font-size:11px;margin:0;color:#e1e8db}#memoSocialEvolution main{padding:14px}#memoSocialEvolution button{padding:9px 10px;background:#f3f5ef;border:1px solid #c9d4c9;color:#253b2c;cursor:pointer;margin:4px 4px 4px 0;font:11px Arial}#memoSocialEvolution button:disabled{opacity:.5;cursor:default}#memoSocialEvolution .msPrimary{background:#294d37;color:white}#msClose{float:right;background:transparent!important;border:0!important;color:#fff!important;font-size:24px!important;padding:0!important}#memoSocialEvolution .msNotice{background:#edf3e9;padding:10px;font-size:10px;line-height:1.5}#memoSocialEvolution .msInputs{display:flex;gap:8px;margin:12px 0}#memoSocialEvolution label{flex:1;min-width:0;font-size:10px}#memoSocialEvolution input{width:100%;padding:8px 5px;margin-top:5px;box-sizing:border-box;border:1px solid #b7c4b9}#msStatus{background:#f7f1e6;padding:9px;font-size:10px;margin:10px 0;line-height:1.5}#memoSocialEvolution table{width:100%;border-collapse:collapse;margin:9px 0;font-size:10px}#memoSocialEvolution th,#memoSocialEvolution td{text-align:left;border-bottom:1px solid #e3e8e1;padding:6px 3px}#memoSocialEvolution .msHistoryRow{display:flex;align-items:center;gap:7px;font-size:10px;margin:7px 0}#memoSocialEvolution .msHistoryRow span{width:60px}#memoSocialEvolution .msBar{flex:1;height:9px;background:#e4e9dd}#memoSocialEvolution .msBar i{display:block;background:#82a88b;height:100%}#memoSocialEvolution .msHistoryRow b{width:40px;text-align:right}#memoSocialEvolution .msFoot{font-size:9px;color:#778779;line-height:1.5;border-top:1px solid #dae3d9;padding-top:10px;margin-top:14px}@media(max-width:700px){#memoSocialEvolution{top:76px;left:8px;bottom:8px;width:min(355px,calc(100vw - 16px));max-height:70vh}}';
 document.head.append(style);document.body.append(shell);
 const $=id=>shell.querySelector('#'+id);
 const dispose=()=>{while(group.children.length){const obj=group.children[0];group.remove(obj);obj.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [].concat(o.material))m.dispose?.();});}};
 function showProposal(){
  dispose();if(!preview||!report)return;
  const fresh=makeSocialContext(getModel());
  if(fresh.sourceFingerprint!==context.sourceFingerprint){preview=false;$('msStatus').textContent='Geometry changed. Proposal hidden; rerun against the current building.';return;}
  const design=report.best.design;
  if(!validateSocialDesign(fresh,design).valid){preview=false;return;}
  for(const d of design.zones){
   const z=context.zones.find(z=>z.id===d.id);if(!z)continue;
   if(!d.seats&&!d.shade&&d.program==='open')continue;
   const g=new THREE.Group();g.name='SOCIAL PROPOSAL '+d.id;g.position.set(z.x,.2,z.z);group.add(g);
   const color=COLORS[d.program]||COLORS.open;
   const mat=new THREE.MeshStandardMaterial({color,roughness:.88});
   const wood=new THREE.MeshStandardMaterial({color:0xb19e82,roughness:.85});
   const translucent=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false});
   const disk=new THREE.Mesh(new THREE.CircleGeometry(z.radius*.63,30),translucent);disk.rotation.x=-Math.PI/2;disk.position.y=.1;g.add(disk);
   const place=(x,y,zz,w,h,l,m)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),m.clone());mesh.position.set(x,y,zz);g.add(mesh);};
   for(let i=0;i<d.seats;i++){const angle=(i+.5)*Math.PI*2/Math.max(1,d.seats),r=z.radius*.37;place(Math.cos(angle)*r,.7,Math.sin(angle)*r,4,1.4,1.4,wood);}
   for(let j=0;j<d.shade;j++){const x=(j===0?-1:1)*z.radius*.33;
    place(x,6,0,5,.45,6,mat);for(const dz of [-2.5,2.5])place(x,3,dz,.27,6,.27,wood);}
   if(d.program!=='open')place(0,.5,0,Math.min(7,z.radius*.5),.6,3,mat);
  }
  window.memoInvalidate?.();
 }
 const metricNames=[['voluntaryInteractionsPerPersonDay','Interactions / resident / day'],['meaningfulTies','Repeated relationships'],['repeatedRelationshipCoverage','Residents with lasting ties'],['crossBuildingTieShare','Cross-building relationships'],['participationRate','Regular participation'],['isolatedRate','Without lasting relationships'],['overcrowdingRate','Overcrowding proxy']];
 function renderResult(){
  if(!report)return;
  const b=report.baseResult,m=report.best.evaluation;
  $('msScores').innerHTML='<h3>Baseline vs evolved concept</h3><table><thead><tr><th>Metric</th><th>Before</th><th>After</th></tr></thead><tbody>'+
  '<tr><td><b>Fitness score</b></td><td>'+b.fitness+'</td><td><b>'+m.fitness+'</b></td></tr>'+
  metricNames.map(([k,label])=>'<tr><td>'+label+'</td><td>'+b.metrics[k]+'</td><td>'+m.metrics[k]+'</td></tr>').join('')+'</tbody></table>';
  $('msHistory').innerHTML='<h3>Evolution history</h3>'+report.history.map(x=>'<div class="msHistoryRow"><span>Gen '+x.generation+'</span><div class="msBar"><i style="width:'+Math.max(0,Math.min(100,x.fitness))+'%"></i></div><b>'+x.fitness+'</b></div>').join('');
  $('msZones').innerHTML='<h3>Proposed courtyard mutations</h3><table><thead><tr><th>Courtyard</th><th>Program</th><th>Seats</th><th>Shade</th></tr></thead><tbody>'+
    report.best.design.zones.map(z=>'<tr><td>'+z.id.replace(/[<>&"]/g,'')+'</td><td>'+z.program+'</td><td>'+z.seats+'</td><td>'+z.shade+'</td></tr>').join('')+'</tbody></table>';
  $('msPreview').disabled=false;$('msExport').disabled=false;
 }
 $('msRun').onclick=async()=>{
  if(running)return;running=true;preview=false;dispose();report=null;$('msRun').disabled=true;$('msCancel').disabled=false;
  $('msPreview').disabled=true;$('msExport').disabled=true;$('msScores').innerHTML='';$('msHistory').innerHTML='';$('msZones').innerHTML='';
  context=makeSocialContext(getModel());abort=new AbortController();
  const agents=Math.max(20,Math.min(240,Number($('msAgents').value)||80));
  const days=Math.max(7,Math.min(90,Number($('msDays').value)||30));
  const generations=Math.max(1,Math.min(12,Number($('msGens').value)||4));
  $('msStatus').textContent='Running deterministic matched scenarios without AI/API calls…';
  try{
   const output=await evolveSocial(context,{agents,days,generations,candidates:5,seeds:[20261026,20261027,20261028],signal:abort.signal,
    onGeneration:r=>{$('msStatus').textContent='Generation '+r.generation+' / '+generations+' · best fitness '+r.fitness+' (synthetic score)';}});
   report=output;renderResult();
   $('msStatus').textContent=(output.cancelled?'Stopped; partial study. ':'Complete. ')+output.evaluations+' candidate evaluations · '+output.rejected+' geometry-guard rejections · 3 matched seeds per evaluation. BIM unchanged.';
  }catch(e){$('msStatus').textContent='Simulation error: '+e.message;}
  finally{running=false;$('msRun').disabled=false;$('msCancel').disabled=true;}
 };
 $('msCancel').onclick=()=>abort?.abort();
 $('msPreview').onclick=()=>{preview=!preview;showProposal();$('msPreview').textContent=preview?'Hide evolved proposal':'Show evolved proposal in 3D';};
 $('msRestore').onclick=()=>{preview=false;dispose();$('msPreview').textContent='Show evolved proposal in 3D';$('msStatus').textContent='Original building view restored. BIM geometry unchanged.';window.memoInvalidate?.();};
 $('msExport').onclick=()=>{
  if(!report)return;const output={...report,best:{...report.best,evaluation:{...report.best.evaluation,runs:report.best.evaluation.runs.map(r=>({...r,examples:r.examples.slice(0,15)}))}}};
  const u=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='MEMO-Social-Evolution.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);
 };
 const api={
  open(){shell.hidden=false;group.visible=true;},
  close(){abort?.abort();preview=false;dispose();shell.hidden=true;group.visible=false;onClose();window.memoInvalidate?.();},
  dispose(){api.close();shell.remove();style.remove();group.removeFromParent();delete window.memoSocial;},
  getReport(){return report;},schema:SOCIAL_SCHEMA
 };
 $('msClose').onclick=api.close;
 window.memoSocial=api;return api;
}
