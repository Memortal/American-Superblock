/*
 * MEMO Studio / American Superblock — Life Lab
 * Small experimental agent-based community simulator. Spatial changes are
 * reversible overlays, not modifications of base BIM or approved designs.
 */
const PROGRAMS=[
  {id:'food',name:'Community food garden',role:'Grower',color:0x6e9b75,kind:'planters',effects:{food:.48,belonging:.06,purpose:.07}},
  {id:'care',name:'Care & rest hub',role:'Carer',color:0xcb95a1,kind:'shelter',effects:{rest:.32,safety:.25,belonging:.08}},
  {id:'social',name:'Community commons',role:'Host',color:0xd7a666,kind:'tables',effects:{belonging:.48,rest:.08,purpose:.06}},
  {id:'play',name:'Play & culture',role:'Artist',color:0xb3a0d4,kind:'stage',effects:{belonging:.32,purpose:.35,rest:.06}},
  {id:'maker',name:'Workshop / repair',role:'Maker',color:0x83a8bc,kind:'workshop',effects:{purpose:.52,safety:.10,belonging:.08}},
  {id:'quiet',name:'Quiet garden',role:'Steward',color:0x86ae92,kind:'shade',effects:{rest:.48,safety:.16,belonging:.06}}
];
const EMPTY={id:'open',name:'Unassigned courtyard',role:'Neighbor',color:0x9da99e,kind:'none',effects:{rest:.07,belonging:.025}};
const NAMES=['Mina','Ari','Sam','Tara','Nika','Eli','Omid','Dara','Noor','Leila','Roya','Max','Sana','Iris','Kian','Yara','Alex','Luna','Milo','Nina','Rumi','Nima','Ala','Mika','Jules','Ida','Cleo','Arman','Pasha','Rana'];
const SKILLS=['grow','care','host','art','make','teach','fix'];
const clamp=(x,min=0,max=1)=>Math.min(max,Math.max(min,x));
const pc=x=>Math.round(100*clamp(x))+'%';
const rand=Math.random;
function program(id){return PROGRAMS.find(p=>p.id===id)||EMPTY;}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function mountLife({THREE,scene,camera,controls,renderer,getModel}){
  if(window.memoLife){window.memoLife.open();return window.memoLife;}
  const buildings=getModel().buildings.filter(b=>!b.parking&&b.courtyard?.length>=3);
  const zones=buildings.map((b,i)=>({
    id:b.id,name:'Building '+(b.name||'ABCD'[i])+' courtyard',
    x:b.courtyard.reduce((s,v)=>s+v[0],0)/b.courtyard.length,
    z:b.courtyard.reduce((s,v)=>s+v[1],0)/b.courtyard.length,
    radius:clamp(Math.min(
      Math.max(...b.courtyard.map(v=>v[0]))-Math.min(...b.courtyard.map(v=>v[0])),
      Math.max(...b.courtyard.map(v=>v[1]))-Math.min(...b.courtyard.map(v=>v[1]))
    )*.17,10,24),
    program:'open',assigned:null,visits:0,mesh:null,lastVote:-100
  }));
  if(!zones.length)throw new Error('Superblock courtyards are not available.');
  const pieces=getModel().pieces||[];
  const homes=[],known=new Set();
  for(const p of pieces){
    if(p.core||p.office||p.parking||p.retail||!p.polygon?.length||p.levels<3)continue;
    const cx=p.polygon.reduce((v,q)=>v+q[0],0)/p.polygon.length,cz=p.polygon.reduce((v,q)=>v+q[1],0)/p.polygon.length;
    const add=(id,level,type)=>{if(known.has(id))return;known.add(id);homes.push({id,building:p.building,x:cx,z:cz,level,type,people:[],capacity:type==='triplex'?5:3,food:5});};
    add(p.id+'-TRIPLEX',0,'triplex');
    for(let l=Math.max(3,p.upperStart||4);l<Math.min(p.levels,p.duplexBase??p.levels);l++)add(p.id+'-APT-L'+(l+1),l,'apartment');
    if(p.duplexBase>=3)add(p.id+'-DUPLEX',p.duplexBase,'duplex');
  }
  const groups=[],heritage=[],ancestors=[];
  const state={day:0,agents:[],playing:false,speed:1,arrival:0,assembly:0,autoBuild:true,relations:0,selected:null,events:[],decisions:[],aiEnabled:false,aiPending:false,births:0,deaths:0};
  let serial=0;
  const group=new THREE.Group();group.name='MEMO LIFE — reversible intervention layer';scene.add(group);
  const humanGroup=new THREE.Group();group.add(humanGroup);
  const interventionGroup=new THREE.Group();group.add(interventionGroup);
  const headGeo=new THREE.SphereGeometry(1.15,10,8),bodyGeo=new THREE.CylinderGeometry(.8,1,3.2,8);
  const headMat=new THREE.MeshStandardMaterial({color:0xe5c8ae,roughness:.9});
  const bodyColors=[0x557c73,0xa88979,0x767ca2,0x8c9b75,0x8b768f];
  const bodyMats=bodyColors.map(color=>new THREE.MeshStandardMaterial({color,roughness:.84}));
  const shadowMat=new THREE.MeshBasicMaterial({color:0x5f8274,transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false});
  const haloGeo=new THREE.RingGeometry(1.8,2.55,16);
  function mesh(parent,geometry,material,x,y,z){
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;
  }
  function disposeContents(parent){
    for(const obj of [...parent.children]){
      parent.remove(obj);
      obj.traverse(o=>{
        if(o.geometry&&o.geometry!==headGeo&&o.geometry!==bodyGeo&&o.geometry!==haloGeo)o.geometry.dispose();
        if(o.material&&!bodyMats.includes(o.material)&&o.material!==headMat&&o.material!==shadowMat)
          for(const m of [].concat(o.material))m.dispose?.();
      });
    }
  }
  const shell=document.createElement('section');
  shell.className='memo-life';
  shell.setAttribute('aria-label','Superblock Life Simulation');
  shell.innerHTML=`
    <header class="life-header">
      <div><div class="life-kicker">MEMO STUDIO / LIFE LAB <span>AGENT SYSTEM · EXPERIMENTAL</span></div>
        <h2>Life makes space.</h2><p>People arrive, connect, organize, and reshape the commons.</p></div>
      <div class="life-head-buttons"><button type="button" data-action="fullscreen" class="life-enlarge" title="Open fullscreen simulation">⛶ Fullscreen</button><button type="button" data-action="close" class="life-close" aria-label="Close Life Lab">×</button></div>
    </header>
    <div class="life-metrics">
      <div><b id="lifePeople">0</b><small>PEOPLE</small></div><div><b id="lifeWellbeing">—</b><small>WELLBEING</small></div>
      <div><b id="lifeDay">0</b><small>DAY</small></div><div><b id="lifeTies">0</b><small>SOCIAL TIES</small></div>
    </div>
    <div class="life-actions"><button data-action="toggle" class="life-dark">▶ Start life</button><button data-action="arrive">+ One person</button>
      <button data-action="vote">Hold assembly</button><button data-action="reset">↺ Reset</button><button data-action="social">Social Evolution ↗</button></div>
    <div class="life-settings"><label>Simulation speed <select id="lifeSpeed"><option value="1">1× observe</option><option value="4">4× grow</option><option value="12">12× evolve</option></select></label>
      <label class="life-tick"><input id="lifeBuilding" type="checkbox" checked> Let communities build</label>
      <label class="life-tick"><input id="lifeAI" type="checkbox"> Individual AI decisions (requires server connection)</label><span id="lifeAIStatus">AI: checking provider…</span></div>
    <div class="life-explain">Each person seeks food, rest, safety, belonging and purpose. A simulated community assembly votes on courtyard uses. Built objects are <b>proposals only</b>, separate from the BIM model.</div>
    <section class="life-block"><h3>Homes, families & community <span>EVOLVING</span></h3><div id="lifeHousing" class="life-person"></div></section>
    <section class="life-block"><h3>Spatial evolution <span id="lifeAssigned">0 / 4</span></h3><div id="lifeZones"></div></section>
    <section class="life-block"><h3>Collective needs <span>SIMULATED</span></h3><div id="lifeNeeds"></div>
      <div class="life-person" id="lifeSelected">Select a person to examine their needs.</div></section>
    <section class="life-block"><h3>Community decisions <span>CHRONOLOGY</span></h3><div id="lifeLog"></div>
      <button data-action="export" class="life-export">↓ Export decisions + agents as JSON</button></section>
    <footer class="life-disclaimer">Concept simulation, not a prediction of residents' behavior or happiness. Base housing, MEP, structural systems, protected circulation, egress and the Level 4 VOID are unchanged. Each intervention needs physical and code review before implementation.</footer>
  `;
  const cinema=document.createElement('div');
  cinema.className='life-cinema';
  cinema.hidden=true;
  cinema.innerHTML=`<div class="life-cinema-top"><div class="life-cinema-brand"><span class="life-cinema-kicker">MEMO STUDIO / LIVING SUPERBLOCK</span><strong>SIMULATION OF LIFE</strong></div>
     <div class="life-cinema-center"><span id="lifeCinemaDay">DAY 000</span><span class="life-divider">/</span><span id="lifeCinemaPop">1 RESIDENT</span><span class="life-divider">/</span><span id="lifeCinemaHappy">— WELLBEING</span></div>
     <div class="life-cinema-top-actions"><button data-cinema="panel" title="Show simulation settings">☷ Controls</button><button data-cinema="exit" title="Leave fullscreen">✕ Exit</button></div></div>
     <div class="life-cinema-bottom"><div class="life-cinema-controls">
       <button data-cinema="play" id="lifeCinemaPlay">▶ Start</button><button data-cinema="add">+ Resident</button>
       <span class="life-cinema-sep"></span><button data-cinema="isometric">3D</button><button data-cinema="top">Plan</button><button data-cinema="ground">Human view</button><button data-cinema="follow" id="lifeCinemaFollow">◎ Follow</button>
       <span class="life-cinema-sep"></span><label>Quality <select id="lifeQuality"><option value="1">Balanced</option><option value="1.5">High</option><option value="2">Ultra</option></select></label><label>Speed <select id="lifeCinemaSpeed"><option value="1">1×</option><option value="4">4×</option><option value="12">12×</option></select></label>
     </div><div class="life-cinema-note">DRAG TO ORBIT · SCROLL TO ZOOM · SELECT A RESIDENT · ESC TO EXIT</div></div>
     <div class="life-cinema-selected" id="lifeCinemaSelected">A living city shaped by its residents.</div>`;
  document.body.append(cinema);
  const styles=document.createElement('style');
  styles.textContent=`
    .memo-life{position:fixed;left:16px;top:99px;bottom:94px;width:348px;overflow:auto;z-index:27;background:#fffefa;box-shadow:0 15px 55px #202d2733;border:1px solid #e1e7e1;border-radius:9px;font:12px Arial,sans-serif;color:#252d27;scrollbar-width:thin}
    .memo-life[hidden]{display:none}.life-header{display:flex;gap:8px;justify-content:space-between;background:#f7f9f5;padding:18px 17px 15px;border-bottom:1px solid #e6ebe5}
    .life-kicker{color:#668672;font-size:9px;font-weight:700;letter-spacing:1.1px}.life-kicker span{color:#9ca8a1;letter-spacing:.1px;display:block;font-size:8px;margin-top:7px}
    .life-header h2{font-weight:500;font-size:24px;margin:12px 0 5px;letter-spacing:-.9px}.life-header p{font-size:11px;line-height:1.5;color:#6a7770;margin:0}
    .memo-life button{cursor:pointer}.memo-life .life-close{background:transparent;border:0;padding:0 3px;font-size:27px;align-self:flex-start}
    .life-metrics{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #e7ebe7;padding:16px 10px;text-align:center}
    .life-metrics b{font-size:22px;font-weight:500;display:block}.life-metrics small{display:block;font-size:8px;letter-spacing:.6px;color:#89998d;margin-top:5px}
    .life-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:13px 14px 9px}
    .life-actions button{padding:10px 5px;font-size:10px}.life-actions .life-dark{background:#25392f;border-color:#25392f;color:white}
    .life-settings{padding:4px 15px 12px;display:flex;flex-direction:column;gap:12px;font-size:10px;color:#536459}
    .life-settings label:first-child{display:flex;align-items:center;justify-content:space-between}
    .life-settings select{font-size:10px}.life-settings .life-tick{display:flex;align-items:center;gap:6px}
    .life-settings input{accent-color:#315a42}.life-explain{padding:11px 15px;background:#f1f5f0;color:#68776a;font-size:10px;line-height:1.6}
    .life-block{padding:16px 15px;border-top:1px solid #e8eee8}
    .life-block h3{font-size:11px!important;text-transform:none!important;letter-spacing:0!important;margin:0 0 10px!important;color:#263b2e!important;display:flex;justify-content:space-between;font-weight:700!important}
    .life-block h3 span{font-size:9px;font-weight:400;color:#9ba9a0}
    .life-zone{display:flex;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid #e8eee8}
    .life-zone .swatch{width:10px;height:10px;border-radius:3px;flex:none}
    .life-zone .info{flex:1;min-width:0}.life-zone .info b{font-size:11px;display:block}.life-zone .info small{display:block;color:#96a49b;font-size:9px;margin-top:4px}
    .life-zone .program{font-size:10px;text-align:right;max-width:104px}
    .life-meter{display:grid;grid-template-columns:78px 1fr 37px;gap:7px;margin:10px 0;align-items:center;font-size:10px;color:#68756c}
    .life-meter .track{background:#edf1ec;height:5px;border-radius:4px;overflow:hidden}.life-meter .track i{height:100%;background:#80a592;display:block}
    .life-meter strong{font-weight:500;text-align:right;color:#304238}
    .life-person{padding:12px;background:#f7f9f6;margin-top:16px;color:#607064;font-size:10px;line-height:1.65}
    .life-person b{color:#304b3a}.life-people{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
    .memo-life .life-people button{padding:5px;font-size:9px}.memo-life .life-people button.current{background:#d9ebdd}
    .life-event{border-left:2px solid #d1e2d6;padding:0 0 0 10px;margin:10px 0;font-size:10px;line-height:1.55;color:#667267}
    .life-event b{display:block;color:#2d4033}.life-event small{color:#9ba8a0;font-weight:400}
    .memo-life .life-export{margin-top:12px;width:100%;font-size:10px}.life-disclaimer{background:#fafcf9;padding:14px;color:#9aaca0;font-size:9px;line-height:1.65}
    @media(max-width:1000px){.memo-life{left:9px;width:300px;top:78px;bottom:58px}}
    @media(max-width:700px){.memo-life{left:7px;right:7px;width:auto;top:73px;bottom:52vh;box-shadow:0 8px 30px #202d2733}.life-header{padding:11px 13px}.life-header h2{font-size:19px;margin:8px 0 3px}.life-actions{padding:8px 10px}}
  `;
  styles.textContent+=`
   .life-head-buttons{display:flex;gap:8px;align-items:flex-start}.memo-life .life-enlarge{padding:7px 10px;background:#263a2d;color:white;border-color:#263a2d;white-space:nowrap;font-size:10px}
   .life-cinema[hidden]{display:none!important}
   body.life-fullscreen{background:#fafbf9}
   body.life-fullscreen .masthead,body.life-fullscreen .panel,body.life-fullscreen .view-tools,body.life-fullscreen .legend,body.life-fullscreen .title{display:none!important}
   body.life-fullscreen #scene{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:35!important;background:#f9faf8}
   body.life-fullscreen #scene canvas{width:100%!important;height:100%!important}
   body.life-fullscreen .memo-life{z-index:51!important;left:16px!important;top:84px!important;bottom:92px!important;right:auto!important;width:340px!important;height:auto!important;max-width:calc(100vw - 32px)!important;border:1px solid #dce4dd!important;box-shadow:0 12px 55px #142b2033!important;background:#fffffff2!important}
   .life-cinema{position:fixed;inset:0;z-index:46;pointer-events:none;color:#263c2f;font-family:Arial,sans-serif}
   .life-cinema button,.life-cinema select{pointer-events:auto;cursor:pointer}
   .life-cinema-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:space-between;padding:18px 26px;gap:20px;background:linear-gradient(180deg,#ffffffed,#ffffff80 70%,transparent);min-height:85px}
   .life-cinema-brand{display:flex;flex-direction:column;gap:6px}.life-cinema-kicker{font-size:9px;letter-spacing:2.1px;color:#74877a;font-weight:700}.life-cinema-brand strong{font-size:19px;letter-spacing:-.6px;font-weight:700}
   .life-cinema-center{display:flex;gap:17px;align-items:center;font-size:10px;letter-spacing:1.15px;font-weight:700;color:#506457}.life-divider{opacity:.35}
   .life-cinema-top-actions{display:flex;gap:8px}.life-cinema button{background:#ffffffd9;border:1px solid #d8e2d9;border-radius:5px;color:#2e4635;padding:9px 13px;font-size:11px;white-space:nowrap}
   .life-cinema button:hover{background:#dfece3}.life-cinema-top-actions button:last-child{background:#263b30;color:#fff}
   .life-cinema-bottom{position:absolute;left:50%;transform:translateX(-50%);bottom:14px;display:flex;flex-direction:column;gap:10px;align-items:center;max-width:calc(100vw - 24px)}
   .life-cinema-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;background:#fffcf2ee;border:1px solid #dae4d9;padding:8px 9px;border-radius:9px;box-shadow:0 8px 30px #132c1a21}
   .life-cinema-controls>button:first-child{background:#263b30;color:white;border-color:#263b30}
   .life-cinema-controls label{display:flex;align-items:center;gap:6px;padding:0 6px;color:#6d7f72;font-size:10px}
   .life-cinema-controls select{font-size:10px;max-width:85px;background:white;border:1px solid #dce7dd;padding:7px;border-radius:4px}
   .life-cinema-sep{width:1px;height:20px;background:#d7ded7;margin:0 4px}
   .life-cinema-note{font-size:9px;letter-spacing:1.2px;color:#6d8475;text-shadow:0 1px 3px #fff}
   .life-cinema-selected{position:absolute;left:22px;bottom:34px;background:#ffffffe2;border:1px solid #e3ebe2;border-radius:5px;padding:10px 12px;color:#4c6654;font-size:11px;max-width:230px}
   @media(max-width:750px){.life-cinema-top{padding:12px;gap:6px}.life-cinema-brand strong{font-size:14px}.life-cinema-kicker{font-size:7px;letter-spacing:1px}.life-cinema-center{display:none}.life-cinema-top-actions button{padding:8px}.life-cinema-controls{gap:3px;padding:5px}.life-cinema-controls button{padding:7px!important;font-size:9px}.life-cinema-controls label{padding:0 2px}.life-cinema-note{display:none}.life-cinema-selected{display:none}.life-cinema-bottom{bottom:7px}}
  `;
  document.head.append(styles);document.body.append(shell);
  const el=id=>shell.querySelector('#'+id);
  const ce=id=>cinema.querySelector('#'+id);
  let fullscreen=false,follow=false,quality=1,focusTarget=null;
  const syncSize=()=>{const node=document.querySelector('#scene');if(!node)return;const width=Math.max(1,node.clientWidth),height=Math.max(1,node.clientHeight);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,fullscreen?quality:1.25));renderer.setSize(width,height,false);renderer.shadowMap.needsUpdate=true;window.memoInvalidate?.();};
  function viewPreset(preset){
    if(preset==='top'){camera.position.set(0,1250,.01);controls.target.set(0,0,0);}
    else if(preset==='ground'){camera.position.set(410,55,365);controls.target.set(0,15,0);}
    else{camera.position.set(760,430,760);controls.target.set(0,65,0);}
    controls.update();window.memoInvalidate?.();
  }
  function enterFullscreen(){
    if(fullscreen)return;
    fullscreen=true;follow=false;document.body.classList.add('life-fullscreen');cinema.hidden=false;shell.hidden=true;
    // Browser-level fullscreen on the iframe document; CSS remains an accessible fallback.
    const host=document.documentElement;
    if(host.requestFullscreen)host.requestFullscreen().catch(()=>{});
    viewPreset('isometric');requestAnimationFrame(syncSize);setTimeout(syncSize,90);
  }
  function exitFullscreen(){
    if(!fullscreen)return;
    fullscreen=false;follow=false;document.body.classList.remove('life-fullscreen');cinema.hidden=true;shell.hidden=false;quality=1;
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    requestAnimationFrame(syncSize);setTimeout(syncSize,80);
  }
  document.addEventListener('fullscreenchange',()=>{if(fullscreen&&!document.fullscreenElement)exitFullscreen();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&fullscreen)exitFullscreen();});
  cinema.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    switch(button.dataset.cinema){
      case 'exit':exitFullscreen();break;
      case 'panel':shell.hidden=!shell.hidden;break;
      case 'play':if(!state.agents.length)addPerson();state.playing=!state.playing;render();break;
      case 'add':addPerson();render();break;
      case 'isometric':follow=false;viewPreset('isometric');break;
      case 'top':follow=false;viewPreset('top');break;
      case 'ground':follow=false;viewPreset('ground');break;
      case 'follow':follow=!follow;button.textContent=follow?'◎ Unfollow':'◎ Follow';break;
    }
    window.memoInvalidate?.();
  });
  ce('lifeQuality').addEventListener('change',e=>{quality=+e.target.value;syncSize();});
  ce('lifeCinemaSpeed').addEventListener('change',e=>{state.speed=+e.target.value;el('lifeSpeed').value=String(state.speed);});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!fullscreen)return;
    const rect=renderer.domElement.getBoundingClientRect();
    const mouse=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    const ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);
    const hit=ray.intersectObjects(humanGroup.children,true).find(h=>h.object.parent?.userData?.personId);
    if(hit){state.selected=hit.object.parent.userData.personId;focusTarget=state.selected;render();}
  });

  function event(title,details){state.events.unshift({day:state.day,title,details});state.events.length=Math.min(state.events.length,45);}
  function addPerson(){
    serial++;
    const home=zones[(serial-1)%zones.length],side=serial%4;
    const entry=[{x:-318,z:0},{x:318,z:0},{x:0,z:-318},{x:0,z:318}][side];
    const a={
      id:serial,name:NAMES[(serial-1)%NAMES.length]+(serial>NAMES.length?' '+(Math.floor((serial-1)/NAMES.length)+1):''),
      age:19+Math.floor(rand()*61),home:home.id,skill:SKILLS[Math.floor(rand()*SKILLS.length)],
      x:entry.x,z:entry.z,target:null,role:'New arrival',friends:new Set(),homeId:null,
      ageStarted:state.day,generation:1,parents:[],children:[],memories:[],attachments:{},bonds:{},resources:{food:4,credits:20,materials:3},
      groupId:null,invites:[],activity:'arriving',lastActivity:-2,aiTurns:0,appearance:{height:4.5+rand()*1.9,body:rand(),hair:rand(),tone:rand()},
      needs:{food:.7+rand()*.26,rest:.7+rand()*.26,safety:.76+rand()*.2,belonging:.47+rand()*.37,purpose:.48+rand()*.37}
    };
    const free=homes.filter(h=>h.people.length<h.capacity).sort((h,k)=>h.people.length/h.capacity-k.people.length/k.capacity)[0];
    if(free){free.people.push(a.id);a.homeId=free.id;}else{a.activity='seeking home';event('Housing pressure',a.name+' arrives without a vacant dwelling.');}
    const g=new THREE.Group();g.name=a.name;g.userData.personId=a.id;
    const torso=mesh(g,bodyGeo,new THREE.MeshStandardMaterial({color:bodyColors[serial%bodyColors.length],roughness:.84}),0,2.6,0);
    torso.scale.set(.68+a.appearance.body*.7,a.appearance.height/5.3,.68+a.appearance.body*.6);
    mesh(g,headGeo,new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.065+a.appearance.tone*.055,.27+a.appearance.tone*.22,.48+a.appearance.tone*.23),roughness:.95}),0,a.appearance.height,0);
    const hair=mesh(g,new THREE.SphereGeometry(.95+a.appearance.hair*.26,9,7),new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.045+a.appearance.hair*.11,.18,.13+a.appearance.hair*.28)}),0,a.appearance.height+.45,0);
    hair.scale.y=.45;
    for(const side of [-1,1]){const leg=mesh(g,new THREE.CylinderGeometry(.17,.21,1.4,6),bodyMats[(serial+2)%bodyMats.length],side*.41,.75,0);}

    const ring=mesh(g,haloGeo,shadowMat,0,.15,0);ring.rotation.x=-Math.PI/2;
    g.position.set(a.x,.1,a.z);humanGroup.add(g);a.mesh=g;
    state.agents.push(a);state.selected=a.id;
    event(a.name+' arrives','Enters the site and joins '+home.name+'. Expertise: '+a.skill+'.');
  }
  function average(){const result={};for(const key of ['food','rest','safety','belonging','purpose'])result[key]=state.agents.length?state.agents.reduce((v,a)=>v+a.needs[key],0)/state.agents.length:0;return result;}
  function wellbeing(a){const n=a.needs;return clamp(.26*n.food+.20*n.rest+.17*n.safety+.20*n.belonging+.17*n.purpose-.18*(1-Math.min(n.food,n.rest,n.safety)));}
  function destination(a){
    let best=zones[0],score=-Infinity;
    for(const z of zones){
      const p=program(z.program);
      let s=Object.entries(p.effects).reduce((total,[k,v])=>total+(1-a.needs[k])*v,0);
      s+=(a.home===z.id? .035:0)-(dist(a,z)/1400)+rand()*.038;
      if(s>score){best=z;score=s;}
    }return best;
  }
  function stepAgents(days){
    // Spatial institutions have a shared catchment: food growing, rest
    // facilities and culture benefit neighbors beyond each courtyard.
    // Capacity is finite: excessive population puts pressure on services.
    const count=state.agents.length||1;
    const foodCount=zones.filter(z=>z.program==='food').length;
    const restCount=zones.filter(z=>z.program==='care'||z.program==='quiet').length;
    const socialCount=zones.filter(z=>z.program==='social'||z.program==='play').length;
    const makerCount=zones.filter(z=>z.program==='maker'||z.program==='play').length;
    const foodCapacity=Math.min(1,44*foodCount/count);
    const restCapacity=Math.min(1,56*restCount/count);
    const socialCapacity=Math.min(1,65*socialCount/count);
    const makerCapacity=Math.min(1,65*makerCount/count);
    const hour=Math.floor((state.day%1)*24);
    for(const a of state.agents){
      const n=a.needs;
      // Basic domestic living provides a floor. Organized space adds a
      // finite distributed benefit, making collective decisions consequential.
      n.food=clamp(n.food+(-.014+.006+.023*foodCapacity)*days);
      n.rest=clamp(n.rest+(-.013+.009+.011*restCapacity)*days);
      n.safety=clamp(n.safety+(-.003+.0035+.003*restCapacity)*days);
      n.belonging=clamp(n.belonging+(-.013+.003+.010*socialCapacity)*days);
      n.purpose=clamp(n.purpose+(-.012+.003+.010*makerCapacity)*days);
      if(n.food<.15||n.rest<.15)n.safety=clamp(n.safety-.008*days);
      let goal=zones.find(z=>z.id===a.target);
      if(!goal||rand()<.027*days){goal=destination(a);a.target=goal.id;}
      const d=dist(a,goal),step=Math.min(d,16*days);
      if(d>.01){a.x+=(goal.x-a.x)*step/d;a.z+=(goal.z-a.z)*step/d;}
      if(d<Math.max(16,goal.radius)){
        const p=program(goal.program);
        for(const [k,v] of Object.entries(p.effects))n[k]=clamp(n[k]+.043*v*days);
        a.role=p.role;goal.visits+=days;a.attachments[goal.id]=clamp((a.attachments[goal.id]||0)+.002*days);
      }
      // Each person has a home and a diurnal schedule. Home visits are private.
      const home=homes.find(h=>h.id===a.homeId);
      if(home){
        const sleeping=hour<7||hour>=23;
        const meal=(hour===8||hour===19||n.food<.35);
        if(sleeping){a.activity='sleeping';n.rest=clamp(n.rest+.019*days);a.x+=(home.x-a.x)*Math.min(1,.17*days);a.z+=(home.z-a.z)*Math.min(1,.17*days);}
        else if(meal&&a.resources.food>.2){a.activity='eating';a.resources.food=Math.max(0,a.resources.food-.013*days);n.food=clamp(n.food+.028*days);a.x+=(home.x-a.x)*Math.min(1,.11*days);a.z+=(home.z-a.z)*Math.min(1,.11*days);}
        else if(rand()<.003*days){a.activity='socializing';}
        if(a.resources.food<1&&a.resources.credits>2){a.resources.credits-=2;a.resources.food+=2;a.memories.unshift({day:state.day,event:'Bought food for home'});}
        if(a.invites.length&&hour>17&&hour<22){const invite=a.invites.shift();const h=homes.find(h=>h.id===invite.homeId);if(h){a.x+=(h.x-a.x)*.1*days;a.z+=(h.z-a.z)*.1*days;a.activity='visiting '+invite.name;}}
      }else{const vacancy=homes.find(h=>h.people.length<h.capacity);if(vacancy){vacancy.people.push(a.id);a.homeId=vacancy.id;a.activity='settled';}}
      // Vision and comfort spacing: 4–8 ft depending on familiarity.
      const neighbors=state.agents.slice(Math.max(0,state.agents.indexOf(a)-30),state.agents.indexOf(a)+31).filter(b=>b!==a&&Math.abs(b.x-a.x)<9&&Math.abs(b.z-a.z)<9).slice(0,8);
      for(const b of neighbors){const d2=dist(a,b),gap=a.friends.has(b.id)?4:7;if(d2<gap&&d2>.05){a.x+=(a.x-b.x)/d2*(gap-d2)*.34;a.z+=(a.z-b.z)/d2*(gap-d2)*.34;}}
      a.mesh.position.x=a.x;a.mesh.position.z=a.z;
      a.mesh.visible=a.activity!=='sleeping';
    }
    // Proximity can create persistent relationships, rather than only animation.
    for(let i=0;i<state.agents.length;i++)for(let j=i+1;j<Math.min(state.agents.length,i+26);j++){
      const a=state.agents[i],b=state.agents[j];if(dist(a,b)>24||rand()>.007*days)continue;
      a.needs.belonging=clamp(a.needs.belonging+.08);b.needs.belonging=clamp(b.needs.belonging+.08);
      if(!a.friends.has(b.id)){
        a.friends.add(b.id);b.friends.add(a.id);state.relations++;
        a.bonds[b.id]={trust:.2,help:0};b.bonds[a.id]={trust:.2,help:0};
        a.memories.unshift({day:state.day,event:'Met '+b.name});b.memories.unshift({day:state.day,event:'Met '+a.name});
        if(rand()<.15)event('New social connection',a.name+' and '+b.name+' became friends.');
      }
    }
  }
  function intervene(z){
    if(z.mesh){disposeContents(z.mesh);interventionGroup.remove(z.mesh);}
    const p=program(z.program);if(p.id==='open')return;
    const g=new THREE.Group();g.name='Proposal: '+p.name;g.position.set(z.x,.3,z.z);interventionGroup.add(g);z.mesh=g;
    const r=z.radius,main=new THREE.MeshStandardMaterial({color:p.color,roughness:.85});
    const timber=new THREE.MeshStandardMaterial({color:0xa99c87,roughness:.9});
    const pale=new THREE.MeshStandardMaterial({color:0xe0ded1,roughness:.9});
    const translucent=new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.14,side:THREE.DoubleSide,depthWrite:false});
    const tile=mesh(g,new THREE.CircleGeometry(r,36),translucent,0,.20,0);tile.rotation.x=-Math.PI/2;
    const box=(w,h,d,x,y,z,material=main)=>mesh(g,new THREE.BoxGeometry(w,h,d),material,x,y,z);
    if(p.kind==='planters')for(let i=0;i<6;i++){const x=(-1.2+i%3)*r*.5,z=(Math.floor(i/3)-.5)*r*.65;box(r*.35,1.4,3.4,x,.9,z,timber);box(r*.31,.3,3,x,1.8,z);}
    if(p.kind==='shelter'||p.kind==='shade'){for(const x of [-r*.53,r*.53])for(const z of [-r*.53,r*.53])box(.65,7,.65,x,3.5,z,timber);box(r*1.2,.8,r*1.2,0,7.5,0,p.kind==='shade'?main:pale);box(r*.6,.7,3.7,0,.6,0,timber);}
    if(p.kind==='tables'){box(r*1.15,.65,4,0,2.4,0,timber);for(const x of [-r*.45,r*.45])for(const z of [-1.3,1.3])box(.8,2.4,.8,x,1.2,z,timber);for(const z of [-6.8,6.8])box(r*1.1,.9,2,0,.8,z);}
    if(p.kind==='stage'){box(r*1.2,1.7,r*.7,0,1,0,timber);box(r*1.2,4,.5,0,3.4,r*.35,main);}
    if(p.kind==='workshop'){for(const x of [-r*.38,r*.38]){box(r*.65,2.4,4,x,1.3,0,timber);box(r*.58,.5,3.8,x,2.8,0,pale);}}
    const marker=mesh(g,new THREE.RingGeometry(r+1,r+1.5,48),new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.65,side:THREE.DoubleSide}),0,.22,0);marker.rotation.x=-Math.PI/2;
  }
  function cooperativeLife(){
    for(const a of state.agents){
      if(!a.groupId&&a.friends.size>=2){
        const friends=state.agents.filter(b=>b!==a&&!b.groupId&&a.friends.has(b.id)).slice(0,5);
        if(friends.length<2)continue;
        const g={id:'G'+(groups.length+1),name:['Garden cooperative','Makers guild','Neighborhood circle','Care collective'][groups.length%4],
          members:[a.id,...friends.map(b=>b.id)],food:3,credits:12,materials:3,projects:[],formedDay:state.day};
        groups.push(g);for(const personId of g.members){const member=state.agents.find(b=>b.id===personId);if(member){member.groupId=g.id;member.memories.unshift({day:state.day,event:'Joined '+g.name});}}
        event('Neighbors organize',g.name+' · '+g.members.length+' founding members.');
      }
    }
    for(const g of groups){
      if(rand()<.07){g.food+=1;g.materials+=.4;g.credits+=1;}
      if(g.food>5&&rand()<.03){
        const member=state.agents.find(a=>g.members.includes(a.id)&&a.resources.food<2);
        if(member){g.food--;member.resources.food++;member.memories.unshift({day:state.day,event:'Food shared by '+g.name});}
      }
    }
    if(state.agents.length>homes.reduce((n,h)=>n+h.capacity,0)*.85&&rand()<.2){
      const g=groups.find(g=>g.materials>=2);
      if(g){g.materials-=2;g.projects.push({day:state.day,kind:'housing capacity study',status:'concept only'});event('Housing negotiation',g.name+' proposed more housing capacity rather than excluding new people.');}
    }
  }
  function assembly(){
    if(state.agents.length<3){event('Assembly postponed','At least three people need to arrive before a collective decision.');return;}
    const available=zones.filter(z=>z.program==='open').length?zones.filter(z=>z.program==='open'):zones.filter(z=>state.day-z.lastVote>=30);
    if(!available.length){event('Programs in place','Residents are using the established spaces; no immediate rezoning.');return;}
    const used=new Set(zones.map(z=>z.program).filter(id=>id!=='open'));
    let winner;
    for(const z of available){
      const counts=new Map(PROGRAMS.map(p=>[p.id,0]));
      for(const a of state.agents){
        let choice=PROGRAMS[0],best=-Infinity;
        for(const p of PROGRAMS){
          let score=Object.entries(p.effects).reduce((v,[key,gain])=>v+(1-a.needs[key])*gain,0);
          if(used.has(p.id)&&p.id!==z.program)score-=.15;
          if(a.skill==='grow'&&p.id==='food'||a.skill==='care'&&p.id==='care'||a.skill==='make'&&p.id==='maker'||a.skill==='art'&&p.id==='play'||a.skill==='host'&&p.id==='social')score+=.06;
          score+=rand()*.018;if(score>best){best=score;choice=p;}
        }counts.set(choice.id,counts.get(choice.id)+1);
      }
      const [id,votes]=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0];
      const score=votes/state.agents.length+(z.program==='open'?.20:0);
      if(!winner||score>winner.score)winner={z,id,votes,score};
    }
    if(!winner||winner.z.program===winner.id){event('Assembly result','The current arrangement was maintained.');return;}
    const {z,id,votes}=winner,old=program(z.program).name,newProgram=program(id);
    const attached=state.agents.filter(a=>(a.attachments[z.id]||0)>.35).length;
    const defendingGroups=groups.filter(g=>g.members.some(id=>state.agents.some(a=>a.id===id&&(a.attachments[z.id]||0)>.35)));
    if(z.program!=='open'&&(attached>state.agents.length*.2||defendingGroups.length&&attached>state.agents.length*.08)){event('Residents resist demolition',attached+' people protected '+z.name+' due to emotional attachment.');return;}
    if(z.program!=='open'&&votes/state.agents.length<.40){event('Proposal lacks consensus',z.name+' retains its program.');return;}
    z.program=id;z.assigned=state.day;z.lastVote=state.day;
    if(state.autoBuild)intervene(z);
    else if(z.mesh){disposeContents(z.mesh);interventionGroup.remove(z.mesh);z.mesh=null;}
    heritage.push({day:state.day,space:z.id,from:old,to:newProgram.name,protectedBy:defendingGroups.map(g=>g.id),permanentRecord:true});
    for(const a of state.agents.filter(a=>a.attachments[z.id]>.14)){
      a.memories.unshift({day:state.day,event:'Our courtyard changed from '+old+' into '+newProgram.name});
      if(a.memories.length>24)a.memories.length=24;
    }
    state.decisions.push({day:+state.day.toFixed(2),space:z.id,previous:old,newProgram:newProgram.name,votes,totalResidents:state.agents.length,proposal:{type:newProgram.kind,placement:[z.x,0,z.z],status:state.autoBuild?'schematic visualization':'program only',reviewRequired:['accessible paths and egress','structure','fire access','landscape/site drainage','MEP','community and regulatory review']}});
    event('Community chose '+newProgram.name,z.name+' · '+votes+' / '+state.agents.length+' votes · reversible space proposal.');
    window.memoInvalidate?.();
  }
  function render(){
    el('lifePeople').textContent=state.agents.length;
    ce('lifeCinemaDay').textContent='DAY '+Math.floor(state.day).toLocaleString();
    ce('lifeCinemaPop').textContent=state.agents.length.toLocaleString()+' RESIDENTS';
    ce('lifeCinemaHappy').textContent=(state.agents.length?pc(state.agents.reduce((total,a)=>total+wellbeing(a),0)/state.agents.length):'—')+' WELLBEING';
    ce('lifeCinemaPlay').textContent=state.playing?'Ⅱ Pause':'▶ Start';
    if(fullscreen&&follow){
      const a=state.agents.find(a=>a.id===focusTarget)||state.agents.at(-1);
      if(a){controls.target.lerp(new THREE.Vector3(a.x,3,a.z),.13);camera.position.lerp(new THREE.Vector3(a.x+50,35,a.z+65),.08);controls.update();}
    }
    if(fullscreen){const a=state.agents.find(a=>a.id===state.selected);ce('lifeCinemaSelected').textContent=a?a.name+' · '+a.activity+' · '+(a.homeId||'Looking for a home'):'Select a person to inspect';}

    el('lifeDay').textContent=Math.floor(state.day);
    el('lifeTies').textContent=state.relations;
    el('lifeWellbeing').textContent=state.agents.length?pc(state.agents.reduce((s,a)=>s+wellbeing(a),0)/state.agents.length):'—';
    shell.querySelector('[data-action="toggle"]').textContent=state.playing?'Ⅱ Pause':'▶ Start life';
    el('lifeHousing').textContent=state.agents.filter(a=>a.homeId).length+' housed in '+homes.filter(h=>h.people.length).length+' of '+homes.length+' modeled units · '+state.agents.filter(a=>!a.homeId).length+' seeking homes · '+state.births+' births · '+state.deaths+' deaths · '+groups.length+' community groups';
    el('lifeAssigned').textContent=zones.filter(z=>z.program!=='open').length+' / '+zones.length;
    el('lifeZones').innerHTML=zones.map(z=>{const p=program(z.program);return `<div class="life-zone"><span class="swatch" style="background:#${p.color.toString(16).padStart(6,'0')}"></span><div class="info"><b>${z.name}</b><small>${z.assigned===null?'Waiting for a community vote':'Program agreed on day '+Math.floor(z.assigned)}</small></div><span class="program">${p.name}</span></div>`;}).join('');
    el('lifeNeeds').innerHTML=Object.entries(average()).map(([k,v])=>`<div class="life-meter"><span>${k.charAt(0).toUpperCase()+k.slice(1)}</span><span class="track"><i style="width:${pc(v)}"></i></span><strong>${pc(v)}</strong></div>`).join('');
    const a=state.agents.find(a=>a.id===state.selected)||state.agents.at(-1);
    el('lifeSelected').innerHTML=a?`<b>${a.name}</b> · age ${a.age} · ${a.role}<div>Expertise: ${a.skill} · Friends: ${a.friends.size} · Happiness: ${pc(wellbeing(a))} · Unit: ${a.homeId||'housing needed'} · ${a.activity}</div><div>Personal needs: ${Object.entries(a.needs).map(([k,v])=>k+' '+pc(v)).join(' / ')}</div><div class="life-people">${state.agents.slice(-9).map(p=>`<button type="button" data-person="${p.id}" class="${p.id===a.id?'current':''}">${p.name}</button>`).join('')}</div>`:'People appear here as they arrive.';
    el('lifeLog').innerHTML=state.events.slice(0,9).map(e=>`<div class="life-event"><b>${e.title} <small>Day ${Math.floor(e.day)}</small></b>${e.details}</div>`).join('');
  }
  function reset(){
    state.playing=false;state.day=0;state.arrival=0;state.assembly=0;state.agents.length=0;
    state.events.length=0;state.decisions.length=0;state.relations=0;state.selected=null;state.births=0;state.deaths=0;serial=0;groups.length=0;heritage.length=0;ancestors.length=0;for(const h of homes)h.people=[];
    disposeContents(humanGroup);disposeContents(interventionGroup);
    for(const z of zones){z.program='open';z.assigned=null;z.visits=0;z.mesh=null;z.lastVote=-100;}
    event('An empty Superblock','The architecture exists. Community life has not yet assigned its spaces.');
    render();window.memoInvalidate?.();
  }
  function exportData(){
    const output={name:'MEMO American Superblock LIFE LAB',version:1,day:state.day,population:state.agents.length,
      meanNeeds:average(),socialTies:state.relations,
      spaces:zones.map(z=>({id:z.id,center:[z.x,z.z],program:program(z.program).name,assignedDay:z.assigned,visits:z.visits})),
      residents:state.agents.map(a=>({id:a.id,name:a.name,age:a.age,home:a.home,skill:a.skill,role:a.role,needs:a.needs,friends:[...a.friends]})),
      homes,groups,heritage,ancestors,communityDecisions:state.decisions,limitations:'A conceptual uncalibrated model; proposals are not applied to BIM or approved for construction.'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const link=document.createElement('a');
    link.href=url;link.download='MEMO-Life-Lab-day-'+Math.floor(state.day)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  shell.addEventListener('click',e=>{
    const btn=e.target.closest('button');if(!btn)return;
    if(btn.dataset.person){state.selected=+btn.dataset.person;render();return;}
    if(btn.dataset.action==='toggle'){if(!state.agents.length)addPerson();state.playing=!state.playing;}
    if(btn.dataset.action==='arrive')addPerson();
    if(btn.dataset.action==='vote')assembly();
    if(btn.dataset.action==='reset')reset();
    if(btn.dataset.action==='export')exportData();
    if(btn.dataset.action==='social'){
      import('./social-evolution-workspace.js').then(({mountSocialEvolution})=>{
        mountSocialEvolution({THREE,scene,getModel,onClose:()=>{if(shell.isConnected&&group.visible)shell.hidden=false;}});
        shell.hidden=true;
      }).catch(err=>event('Social Evolution unavailable',err.message));
      return;
    }
    if(btn.dataset.action==='fullscreen')enterFullscreen();
    if(btn.dataset.action==='close')api.close();
    render();window.memoInvalidate?.();
  });
  el('lifeSpeed').addEventListener('change',e=>state.speed=+e.target.value);
  el('lifeBuilding').addEventListener('change',e=>{
    state.autoBuild=e.target.checked;
    if(state.autoBuild){zones.filter(z=>z.program!=='open'&&!z.mesh).forEach(intervene);}
    else{for(const z of zones){if(z.mesh){disposeContents(z.mesh);interventionGroup.remove(z.mesh);z.mesh=null;}}}
    window.memoInvalidate?.();
  });
  const interval=setInterval(()=>{
    if(!state.playing||document.hidden)return;
    const days=.14*state.speed;state.day+=days;state.arrival+=days;state.assembly+=days;
    if(state.arrival>=1.9){state.arrival=0;addPerson();}
    stepAgents(days);
    if(state.assembly>=5){state.assembly=0;cooperativeLife();assembly();}
    if(state.day>0&&Math.floor(state.day)!==Math.floor(state.day-days)){
      for(const a of state.agents)a.age+=1/365;
      if(rand()<.10&&state.agents.length>=2){
        const parent=state.agents[Math.floor(rand()*state.agents.length)],home=homes.find(h=>h.id===parent.homeId);
        if(parent.age>23&&parent.age<48&&home&&home.people.length<home.capacity){
          addPerson();const child=state.agents.at(-1);if(child.homeId){homes.find(h=>h.id===child.homeId).people=homes.find(h=>h.id===child.homeId).people.filter(id=>id!==child.id);}
          child.homeId=home.id;home.people.push(child.id);child.age=0;child.generation=parent.generation+1;child.parents=[parent.id];parent.children.push(child.id);state.births++;event('New generation',child.name+' was born into '+home.id);
        }
      }
      for(const a of state.agents.slice())if(a.age>89&&rand()<.007){state.agents.splice(state.agents.indexOf(a),1);humanGroup.remove(a.mesh);ancestors.push({name:a.name,generation:a.generation,memories:a.memories.slice(0,10)});state.deaths++;const h=homes.find(h=>h.id===a.homeId);if(h)h.people=h.people.filter(id=>id!==a.id);event('A life remembered',a.name+' · generation '+a.generation);}
    }

    // Ask at most one sampled resident for a model-directed choice at a time.
    // The other agents keep their independent local routines.
    if(state.aiEnabled&&!state.aiPending&&state.agents.length&&Math.floor(state.day*2)!==Math.floor((state.day-days)*2))think();
    render();window.memoInvalidate?.();
  },155);
  let providerReady=false;
  fetch('/api/life/think').then(r=>r.json()).then(d=>{providerReady=!!d.enabled;el('lifeAIStatus').textContent=providerReady?'AI provider connected (rate-limited)':'AI provider not connected · local brains active';}).catch(()=>{el('lifeAIStatus').textContent='AI unavailable · local brains active';});
  el('lifeAI').addEventListener('change',e=>{
    if(!providerReady){e.target.checked=false;state.aiEnabled=false;event('AI offline','Set server-side OPENAI_API_KEY and LIFE_AI_ENABLED=true to enable model-directed decisions.');}
    else state.aiEnabled=e.target.checked;
    render();
  });
  async function think(){
    if(!providerReady||!state.aiEnabled||state.aiPending)return;
    const a=state.agents[Math.floor(rand()*state.agents.length)];if(!a)return;
    state.aiPending=true;
    const payload={name:a.name,age:a.age,trait:a.skill,home:a.homeId,needs:a.needs,resources:a.resources,
      memories:a.memories.slice(0,9),attachments:a.attachments,relationships:Object.entries(a.bonds).slice(0,9),
      world:{day:state.day,population:state.agents.length,zones:zones.map(z=>({id:z.id,program:z.program})),friends:[...a.friends].slice(0,12)}};
    try{
      const r=await fetch('/api/life/think',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      if(!r.ok){if(r.status===503){state.aiEnabled=false;el('lifeAI').checked=false;}return;}
      const decision=await r.json();a.aiTurns++;
      a.memories.unshift({day:state.day,event:'AI choice: '+decision.action+' · '+decision.reason});
      a.memories.length=Math.min(a.memories.length,22);
      if(decision.action==='rest'){a.needs.rest=clamp(a.needs.rest+.14);a.activity='resting by choice';}
      else if(decision.action==='eat'){a.needs.food=clamp(a.needs.food+.14);a.resources.food=Math.max(0,a.resources.food-.3);a.activity='eating by choice';}
      else if(decision.action==='work'){a.resources.credits+=2;a.needs.purpose=clamp(a.needs.purpose+.12);a.activity='working';}
      else if(decision.action==='invite'){const f=state.agents.find(b=>String(b.id)===decision.target&&b!==a);if(f){f.invites.push({homeId:a.homeId,name:a.name});a.activity='inviting '+f.name;}}
      else if(decision.action==='negotiate'||decision.action==='propose'){assembly();}
      else{a.activity=decision.action;if(decision.target&&zones.some(z=>z.id===decision.target))a.target=decision.target;}
      if(a.aiTurns%4===1)event(a.name+' decides',decision.action+' · '+decision.reason);
    }catch{}finally{state.aiPending=false;}
  }
  const originalAppearance=new Map();
  function ghost(enable){
    const base=scene.getObjectByName('Landscape / streets / site');
    for(const obj of scene.children){
      if(obj===group||obj===base)continue;
      obj.traverse(o=>{
        if(!o.isMesh||!o.material)return;
        if(!originalAppearance.has(o))originalAppearance.set(o,o.material);
        if(enable){
          const source=originalAppearance.get(o);
          if(!o.userData.lifeGhost){const mats=[].concat(source).map(m=>{const copy=m.clone();copy.transparent=true;copy.opacity=Math.min(m.opacity??1,.19);copy.depthWrite=false;return copy;});o.material=Array.isArray(source)?mats:mats[0];o.userData.lifeGhost=true;}
        }else if(o.userData.lifeGhost){for(const m of [].concat(o.material))m.dispose();o.material=originalAppearance.get(o);delete o.userData.lifeGhost;}
      });
    }
    scene.background.set(enable?0xf9faf8:0xffffff);window.memoInvalidate?.();
  }
  ghost(true);
  const api={open(){shell.hidden=false;group.visible=true;ghost(true);window.memoInvalidate?.();},
    close(){window.memoSocial?.close();if(fullscreen)exitFullscreen();shell.hidden=true;group.visible=false;state.playing=false;ghost(false);window.memoInvalidate?.();},
    reset,getState(){return {people:state.agents.length,days:state.day,votes:state.decisions.length,playing:state.playing,programs:zones.map(z=>z.program),interventions:zones.filter(z=>z.mesh).length,homes:homes.length,housed:state.agents.filter(a=>a.homeId).length,births:state.births,deaths:state.deaths}},
    dispose(){window.memoSocial?.dispose();if(fullscreen)exitFullscreen();ghost(false);clearInterval(interval);cinema.remove();disposeContents(humanGroup);disposeContents(interventionGroup);group.removeFromParent();shell.remove();styles.remove();delete window.memoLife;}};
  window.memoLife=api;reset();addPerson();render();window.memoInvalidate?.();return api;
}
