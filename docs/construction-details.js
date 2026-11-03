// MEMO American Superblock — construction-detail preparation drawings.
// Architectural coordination diagrams, NOT sealed construction documents.
// Published component dimensions and manufacturer source provenance are separated
// from assumptions requiring an architect / engineer / manufacturer review.
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>Number(n).toFixed(1).replace(/\.0$/,'');
const R=(x,y,w,h,fill='white',stroke='#222',sw=2,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
const L=(x,y,X,Y,sw=2,dash='',stroke='#171b19')=>`<line x1="${x}" y1="${y}" x2="${X}" y2="${Y}" stroke="${stroke}" stroke-width="${sw}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const P=(d,fill='none',stroke='#111',sw=2)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const T=(x,y,t,size=19,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" ${extra}>${E(t)}</text>`;
const C=(x,y,r=24,txt='',weight=3)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="white" stroke="#161a18" stroke-width="${weight}"/>${txt?T(x,y+6,txt,20,'font-weight="bold" text-anchor="middle"'):''}`;
const ruler=(x1,y1,x2,y2,label,off=0)=>{const vertical=x1===x2;if(vertical){const x=x1+off;return L(x,y1,x,y2,1.3,'','#333')+L(x-8,y1-7,x+8,y1+7,2)+L(x-8,y2-7,x+8,y2+7,2)+T(x+14,(y1+y2)/2,label,17);}const y=y1+off;return L(x1,y,x2,y,1.3)+L(x1-7,y-7,x1+7,y+7,2)+L(x2-7,y-7,x2+7,y+7,2)+T((x1+x2)/2,y-10,label,17,'text-anchor="middle"');};
const callout=(sx,sy,x,y,label,subtitle='')=>`${C(sx,sy,5,'',2)}${P(`M${sx} ${sy} L${x-22} ${y-7} L${x-6} ${y-7}`,'none','#343b37',1.3)}${T(x,y,label,19)}${subtitle?T(x,y+23,subtitle,14,'fill="#555"'):''}`;
const datum=(x,y,label)=>`${P(`M${x-17} ${y} l17 -13 l17 13 z`,'white','#222',2)}${L(x+17,y,x+220,y,1.2,'12 5','#555')}${T(x+29,y-9,label,19)}`;
const defs=`<defs><pattern id="ct-concrete" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#efefec"/><path d="M0 22L22 0 M-6 6L6 -6 M16 28L28 16" stroke="#959a96" stroke-width="1.3"/></pattern><pattern id="ct-insulation" width="28" height="16" patternUnits="userSpaceOnUse"><rect width="28" height="16" fill="#fff"/><path d="M0 8Q7 -2 14 8T28 8" fill="none" stroke="#7c8e83" stroke-width="1.5"/></pattern><pattern id="ct-earth" width="35" height="35" patternUnits="userSpaceOnUse"><rect width="35" height="35" fill="#fbfaf7"/><circle cx="7" cy="8" r="3" fill="#bec2b9"/><circle cx="23" cy="27" r="2" fill="#bec2b9"/><path d="M0 32l9 -7 M21 2l12 8" stroke="#bbb"/></pattern><pattern id="ct-steel" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#e7e9eb"/><path d="M0 16L16 0" stroke="#8e99a0" stroke-width="1.5"/></pattern><pattern id="ct-gypsum" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#faf9f7"/><path d="M0 10h10" stroke="#999" stroke-width=".65"/></pattern><pattern id="ct-paving" width="54" height="26" patternUnits="userSpaceOnUse"><rect width="54" height="26" fill="#f4f3ef"/><path d="M0 0H54M0 13H54M27 0V13M0 13V26M54 13V26" fill="none" stroke="#a2a6a0" stroke-width="1"/></pattern><pattern id="ct-water" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 0L28 28M-10 18L10 38M18 -10L38 10" stroke="#8196a4" stroke-width="3"/></pattern><pattern id="ct-glass" width="12" height="26" patternUnits="userSpaceOnUse"><rect width="12" height="26" fill="#eef4f6"/><path d="M1 26L11 0" stroke="#b2cbd5" stroke-width="1"/></pattern></defs>`;
const footer=(id,title,scope,stamp)=>`<path d="M38 1520H2554 M2015 1520V1690" fill="none" stroke="#121612" stroke-width="2.4"/>${T(74,1572,title.toUpperCase(),28,'font-weight="600"')}${T(74,1607,'MEMO STUDIO  /  AMERICAN SUPERBLOCK  /  '+scope,15)}${T(74,1640,'REV 02 · '+stamp+' · 36 x 24 IN · UNVERIFIED ITEMS MARKED VERIFY',14)}${T(74,1666,'PRELIMINARY DETAILING BASIS — NOT FOR CONSTRUCTION / NOT A SHOP DRAWING',14,'font-weight="bold"')}${T(2070,1588,id,42,'font-weight="700"')}${T(2070,1630,'NTS · diagrammatic',18)}${T(2070,1662,'memo studio',20)}`;
const page=(id,title,body,scope='BUILDING A / REPRESENTATIVE',extra='')=>{
 const stamp=new Date().toISOString().slice(0,10);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="36in" height="24in" viewBox="0 0 2592 1728" role="img" aria-label="${E(title)}">${defs}<rect width="2592" height="1728" fill="white"/><g font-family="Arial,Helvetica,sans-serif" fill="#111"><rect x="38" y="38" width="2516" height="1652" fill="none" stroke="#111" stroke-width="2"/>${T(74,82,'MEMO STUDIO  /  TECHNICAL DETAILING PROGRAM',21,'font-weight="700"')}${T(74,119,id+'   /   '+title.toUpperCase(),28)}${T(2510,82,'COORDINATION STUDY · NOT FOR CONSTRUCTION',16,'text-anchor="end" fill="#7a392b"')}${extra}${body}${footer(id,title,scope,stamp)}</g></svg>`;
};
const rule=()=>`${L(1660,154,1660,1475,1,'','#a6aea7')}`;
const info=(x,y,title,rows)=>`${T(x,y,title,24,'font-weight="bold"')}${rows.map((r,i)=>T(x,y+44+i*30,'• '+r,18)).join('')}`;
const form=(x,y,title,rows)=>`${T(x,y,title,23,'font-weight="bold"')}${rows.map((r,i)=>`${C(x+10,y+38+i*37,5)}${T(x+32,y+45+i*37,r,17)}`).join('')}`;
const register=[
 ['G001','LINE TYPES + MATERIAL GRAPHICS','legend','20 standard line conventions and hatches'],
 ['G002','DETAIL INDEX + READINESS','register','Model anchors, requirements, coordination and gaps'],
 ['A510','VERTICAL WALL SECTION / DATUMS','wallSection','Triplex / Level 4 void / apartments / B1 / roof'],
 ['A511','EXTERIOR WALL / SLAB EDGE','exterior','StoTherm ci layers + insulation / firestop interfaces'],
 ['A512','UNIT DEMISING WALL / FLOOR','demising','USG / ProSTUD / ROCKWOOL acoustic separation'],
 ['A513','WINDOW HEAD / SILL / JAMB','window','YKK AP 350 XT, Vitro glazing, drainage'],
 ['A514','RECESSED ENTRANCE / VESTIBULE','entrance','YKK AP 35XT, thresholds, air and water barrier'],
 ['A515','ROOF PARAPET / LEVEL 4 TERRACE','roof','Carlisle TPO + PAC-CLAD / pavers / pedestals'],
 ['A516','BASEMENT / RETAINING / RAMP','basement','Foundation and water-control coordination'],
 ['A517','CURTAIN WALL / SLAB EDGE','curtain','Kawneer 1600, safing, movement, glazing'],
 ['A518','STAIR / LANDING / EGRESS','stairs','Core stair geometry and access/egress criteria']
].map(([id,title,detailKind,description])=>({id,title,kind:'construction-detail',detailKind,description}));
export const constructionDetailSheets=register;
function data(model,opt){const scope=opt.scope==='all'?'B1':opt.scope;const hosts=model.elements.filter(e=>e.building===scope&&!e.specPilot),byType=t=>hosts.filter(e=>e.type===t).length,anchor=e=>e?`${e.id}  /  L${(e.level||0)+1}`:'NO RESOLVED HOST';return {scope,levels:Math.max(8,...model.buildings.filter(b=>b.id===scope).map(b=>b.levels)),walls:byType('IFCWALL'),windows:byType('IFCWINDOW'),doors:byType('IFCDOOR'),roofs:hosts.filter(e=>e.roof).length,demising:hosts.filter(e=>e.demising).length,datum:12,anchors:{wall:anchor(hosts.find(e=>e.facade&&e.type==='IFCWALL')),demising:anchor(hosts.find(e=>e.demising)),window:anchor(hosts.find(e=>e.type==='IFCWINDOW')),door:anchor(hosts.find(e=>e.type==='IFCDOOR')),roof:anchor(hosts.find(e=>e.roof)),curtain:anchor(hosts.find(e=>e.type==='IFCCURTAINWALL')),stair:anchor(hosts.find(e=>e.type==='IFCSTAIRFLIGHT')),basement:anchor(hosts.find(e=>e.level===-1))}};}
const product=(catalog,idx)=>{const p=catalog?.products?.[idx];return p?{brand:p.Manufacturer,name:p['Verified product / family'],url:p['Official technical source URL'],dim:p['Published dimensions / make-up']}:null;};
function sourcePanel(d,c,ids){const lines=ids.map(i=>product(c,i)).filter(Boolean);return `${T(1715,950,'SPECIFICATION SOURCES',22,'font-weight="bold"')}${lines.map((p,i)=>`${T(1715,1002+i*72,`${i+1}. ${p.brand} — ${p.name}`,17)}${T(1740,1025+i*72,'SPEC LIBRARY / verify exact catalog configuration',13,'fill="#575f59"')}`).join('')}${T(1715,1355,'OPEN SPECS WORKSPACE FOR SOURCE URLS',15,'font-weight="bold"')}`;}
function legend(d){const types=[
 ['CONTINUOUS HEAVY','Cut structural wall / primary cut','8'],['CONTINUOUS MEDIUM','Visible outlines / cut edge','3'],['CONTINUOUS THIN','Dimensions / leaders / detail lines','1'],['HIDDEN','Concealed component edges','7 5'],['CENTER','Centerlines and axial symmetry','26 7 4 7'],['PHANTOM','Alternate position / travel','25 4 5 4 5 4'],['BREAK / ZIGZAG','Portion intentionally omitted','break'],['CUTTING PLANE','Section call / direction','cut'],['SECTION POCHE','Material in section','hatch'],['DIMENSION','Measured limits with ticks','dimension'],['EXTENSION','Witness line beyond component','extension'],['LEADER','Material and assembly note','leader'],['PROPERTY LINE','Legal boundary / survey only','28 7 3 7'],['GRID AXIS','Structural coordination centerline','24 6 4 6'],['MATCH LINE','Continuation to adjoining sheet','12 4 12 4'],['DEMOLITION','Existing work to remove','12 6'],['REVISION CLOUD','Change boundary','cloud'],['ELEVATION DATUM','FFL / TOS / TOW level','datum'],['SLOPE ARROW','Drainage / ramp gradient','slope'],['SPACE BOUNDARY','Spatial extent, no physical wall','7 6']];
 let body=T(95,180,'DRAWING LINEWEIGHT HIERARCHY',24,'font-weight="bold"')+T(95,214,'Black-and-white / monochrome: cut 0.70 mm, outline 0.35 mm, annotation 0.18 mm, hatch 0.13 mm',17);
 types.forEach(([name,desc,kind],i)=>{const col=i<10?0:1,rr=i%10,x=120+col*1240,y=278+rr*111;let sample='';if(kind==='break')sample=P(`M${x} ${y}h95l20 -14l13 27l20 -14h95`,'none','#111',2.5);else if(kind==='cut')sample=L(x,y,x+262,y,4,'22 6')+P(`M${x+265} ${y}l-24 -12v24z`,'#111');else if(kind==='hatch')sample=R(x,y-16,262,31,'url(#ct-concrete)','#111',2);else if(kind==='dimension')sample=ruler(x,y,x+250,y,'',0);else if(kind==='extension')sample=L(x+25,y-18,x+25,y+16,1)+L(x+234,y-18,x+234,y+16,1);else if(kind==='leader')sample=P(`M${x} ${y+16}L${x+100} ${y-12}H${x+260}`,'none','#111',1.4)+C(x,y+16,4);else if(kind==='cloud')sample=P(`M${x} ${y}q16 -28 32 0q16 -28 32 0q16 -28 32 0q16 -28 32 0q16 -28 32 0q16 -28 32 0q16 -28 32 0q16 -28 32 0`,'none','#111',1.8);else if(kind==='datum')sample=datum(x+22,y,'+12\' 0"');else if(kind==='slope')sample=L(x,y,x+255,y-20,2)+P(`M${x+255} ${y-20}l-21 -9v18z`,'#111');else sample=L(x,y,x+265,y,i===0?7:i===1?3.5:1.4,kind==='8'||kind==='3'||kind==='1'?'':kind);
 body+=sample+T(x+290,y-3,String(i+1).padStart(2,'0')+'  '+name,18,'font-weight="bold"')+T(x+290,y+21,desc,14,'fill="#5a665c"');});
 body+=L(85,1410,2520,1410,2)+T(115,1455,'MATERIAL HATCHES / SECTIONS',20,'font-weight="bold"');['CONCRETE','ACOUSTIC BATT','EARTH','METAL','GYPSUM','PAVERS','GLAZING'].forEach((s,i)=>{const x=130+i*340,fill=['ct-concrete','ct-insulation','ct-earth','ct-steel','ct-gypsum','ct-paving','ct-glass'][i];body+=R(x,1470,65,37,'url(#'+fill+')','#111',1.3)+T(x+75,1492,s,13);});
 return page('G001','Drafting convention / 20 line types',body,'ALL BUILDINGS');
}
function index(d,c){let b=T(92,181,'DETAIL COMPLETENESS MATRIX',27,'font-weight="bold"')+T(93,220,'Source geometry is linked; manufacturer candidates are not automatically construction-approved.',18);
 const columns=[80,230,880,1700,2300];b+=R(77,254,2448,55,'#e9ece8','#222',1)+T(98,288,'SHEET',17,'font-weight="bold"')+T(230,288,'DETAIL / INTERFACE',17,'font-weight="bold"')+T(925,288,'REQUIRED BEFORE ISSUE',17,'font-weight="bold"')+T(2190,288,'STATUS',17,'font-weight="bold"');
 const rows=[
 ['A510','Full wall section','Confirm level datums, roof steps, foundation / slab edges','MODEL-LINKED'],
 ['A511','Exterior wall / slab','Sto selector assembly, insulation R, NFPA 285, support and joint','VERIFY'],
 ['A512','Unit separation','UL / GA fire-rated assembly, STC, penetrations, acoustic flanking','VERIFY'],
 ['A513','Window head / sill','YKK shop drawing, rough opening, flashing, SHGC / U-factor','VERIFY'],
 ['A514','Recessed entry','Vestibule thermal break, clearances, accessibility, waterproofing','VERIFY'],
 ['A515','Roof / parapet','Complete Carlisle roof build-up, edge uplift, drainage, slope','VERIFY'],
 ['A516','Basement / ramp','Soil report, groundwater, waterproofing, surcharge, drain','VERIFY'],
 ['A517','Curtain wall / slab','Anchors, live-load deflection, fire safing, curtain wall calc','VERIFY'],
 ['A518','Egress stair / landing','Structural stair design, guard, code, fire enclosure, clearance','VERIFY']
 ];
 rows.forEach((r,i)=>{const y=326+i*92;b+=R(78,y,2448,90,i%2?'#fff':'#f8f9f7','#d5d8d4',.8)+T(100,y+39,r[0],23,'font-weight="bold"')+T(230,y+36,r[1],21)+T(925,y+36,r[2],17)+T(2192,y+36,r[3],18,r[3]==='VERIFY'?'fill="#943f2b"':'fill="#4a6658"');});
 b+=info(95,1240,'COORDINATION INPUTS',['Building and grid IDs; floor-to-floor elevations and cut locations','Wall / roof assembly sequences and manufacturer technical documents','Element IDs, openings, exact sizes, tested fire + acoustic ratings','Waterproofing drainage continuity, flashings, penetrations, fixings','MEP riser and slab-edge coordination; structural movement and tolerances']);
 b+=info(1485,1240,'SCOPE / MODEL AUDIT',[`Building ${d.scope} · ${d.walls} wall objects · ${d.windows} windows`,` ${d.doors} doors · ${d.demising} shared / demising wall objects`,` ${d.roofs} roof-tagged model objects · geometry: schematic`,`Manufacturer data mapped to catalog; native BRep not verified`]);
 return page('G002','Detail index / readiness register',b,'ALL BUILDINGS');}
function wallSection(d){const left=480,right=1110,base=1330,delta=119;let b=R(155,194,1345,1250,'#fff','#d8ddd8',1);
 b+=T(195,247,'REPRESENTATIVE VERTICAL CUT — 12 FT FLOOR-TO-FLOOR',22,'font-weight="bold"')+T(200,281,'Geometry follows the project level module; exact façade attachments remain provisional.',16);
 b+=R(300,base-116*1.0,250,119,'url(#ct-earth)','#888',1.2);b+=R(550,base-119*9,77,119*9,'url(#ct-insulation)','#111',3.5);
 // Actual eight typical levels with L4 void between valley and upper residences.
 for(let i=0;i<=8;i++){const y=base-i*delta;b+=R(556,y-15,615,18,'url(#ct-concrete)','#111',3.8);b+=datum(1200,y+1,(i===0?'FFL 00':`L${i+1} · +${i*12}'-0"`)+'  /  TOS VERIFY');}
 for(let i=0;i<3;i++){const y=base-(i+.65)*delta;b+=R(760,y-30,115,48,'url(#ct-glass)','#333',1.4);b+=T(895,y-6,'TRIPLEX L'+(i+1),16);}
 const v4=base-3.5*delta;b+=R(615,v4-51,540,105,'white','#999',1,'stroke-dasharray="11 7"')+T(805,v4,'L4 OPEN VOID',20,'font-weight="bold"');
 for(let i=4;i<8;i++){const y=base-(i+.65)*delta;b+=R(760,y-30,115,48,'url(#ct-glass)','#333',1.4);b+=T(895,y-4,'APARTMENT L'+(i+1),16);}
 b+=R(528,base+10,670,44,'url(#ct-concrete)','#111',4)+R(285,base+55,915,145,'url(#ct-earth)','#aaa',.5)+R(552,base+10,82,160,'url(#ct-concrete)','#111',4);
 b+=L(580,base+20,580,base+160,6,'','#181a19')+R(552,base-9,72,19,'#222','#222',1);
 b+=P(`M1120 ${base-8*delta-5}H1205V${base-8*delta+17}H1120`,'none','#111',3);
 b+=callout(1140,base-8*delta,1682,280,'07 / A515 · ROOF PARAPET','Membrane / coping / thermal and drainage');
 b+=callout(583,base-5*delta,1682,410,'03 / A513 · WINDOW HEAD + SILL','Sill, jamb, flashings, thermally broken frame');
 b+=callout(1140,base-4*delta,1682,540,'06 / A517 · CURTAIN / SLAB','Smoke / fire safing and anchor deflection');
 b+=callout(578,base-2*delta,1682,670,'02 / A512 · DEMISING WALL','Continuous acoustic separation / floor interface');
 b+=callout(595,base-17,1682,800,'01 / A514 · ENTRY THRESHOLD','Recessed lobby / accessible approach');
 b+=callout(595,base+95,1682,930,'08 / A516 · BASEMENT','Waterproofing / ramp / groundwater review');
 b+=info(1682,1090,'DATUM RULES',[`Building ${d.scope} · ${d.levels} model levels, roof steps vary`,'FFL / TOS to be extracted and coordinated per slab','B1 tunnel and parking walls are schematic','L4 architectural void is protected; no horizontal MEP','Do not infer floor assembly or parapet build-up']);
 return page('A510','Vertical wall section / building datums',b,'BUILDING '+d.scope);}
function exterior(d,c){let b=rule()+R(180,255,1380,1030,'#fff','#ddd',1)+T(215,301,'SECTION DETAIL — EXTERIOR / INTERIOR',21,'font-weight="bold"');
 // Modelized wall layers are not represented as certified assembly.
 b+=R(420,391,345,700,'url(#ct-gypsum)','#111',3)+R(480,391,200,700,'url(#ct-insulation)','#111',2);
 b+=R(752,391,10,700,'#444','#111',2)+R(763,391,170,700,'url(#ct-insulation)','#111',2)+R(942,391,18,700,'#b4b9b4','#111',2)+R(970,391,65,700,'#e6e4df','#111',2);
 b+=R(450,825,840,85,'url(#ct-concrete)','#111',4.5)+R(1040,380,55,720,'url(#ct-concrete)','#111',3);
 b+=L(954,400,954,1080,4,'8 4','#426757')+R(1028,812,60,82,'url(#ct-steel)','#333',2);
 b+=ruler(767,1110,938,1110,'CI / system thickness: SELECT');
 b+=T(440,1180,'INTERIOR',23)+T(1180,1180,'EXTERIOR',23);
 b+=callout(754,486,1682,305,'StoTherm ci 5200 · drained EIFS','Selected thickness / NFPA 285 assembly REQUIRED');
 b+=callout(950,634,1682,390,'Air-water barrier / sheathing','Continuous through slab edge; seal at openings');
 b+=callout(488,828,1682,475,'Firestop / safing at slab','Tested assembly reference NOT SELECTED');
 b+=callout(1058,854,1682,560,'Support and thermal bridge','Movement / deflection / bracket calculation');
 b+=callout(540,555,1682,645,'Inner lining / cavity','USG, studs, batt; support system VERIFY');
 b+=info(1690,767,'REQUIRED SPECS',['StoTherm ci: complete approved build-up','Substrate, WRB, EIFS insulation R/U','Fire resistance and NFPA 285 configuration','Stud load / fasteners / deflection / movement','Continuous insulation and opening termination']);
 b+=sourcePanel(d,c,[0,3,5]);b+=T(210,1390,'ASSEMBLY IS A DESIGN STUDY. Do not order or fabricate from this drawing.',19,'font-weight="bold"');
 return page('A511','Exterior wall / slab edge / weather barrier',b,'BUILDING '+d.scope);}
function demising(d,c){let b=rule()+R(170,250,1360,1030,'white','#ddd',1);
 b+=T(211,303,'TYPICAL UNIT SEPARATION / FLOOR JUNCTION',24,'font-weight="bold"');
 b+=R(490,360,65,715,'url(#ct-gypsum)','#111',3)+R(555,360,260,715,'url(#ct-insulation)','#111',2)+R(815,360,65,715,'url(#ct-gypsum)','#111',3);
 for(const x of [570,700,793])b+=R(x,365,12,710,'url(#ct-steel)','#171b19',1.7);
 b+=R(260,926,945,86,'url(#ct-concrete)','#111',5)+R(400,912,570,12,'#444','#222',1);
 b+=R(510,889,344,20,'url(#ct-insulation)','#111',1)+R(505,1021,350,17,'url(#ct-insulation)','#111',1);
 b+=ruler(489,1108,554,1108,'5/8 in')+ruler(559,1161,810,1161,'3-5/8 in stud web')+ruler(816,1108,879,1108,'5/8 in');
 b+=callout(500,444,1682,305,'USG Sheetrock Firecode X','5/8 in board · layer count per listed assembly');
 b+=callout(700,541,1682,403,'ClarkDietrich ProSTUD','3-5/8 in framing · 18 mil option');
 b+=callout(722,660,1682,501,'ROCKWOOL AFB evo','3-1/2 in batt; STC is assembly-dependent');
 b+=callout(658,943,1682,599,'Deflection / head and base track','Continuous fire + acoustic seal across junction');
 b+=info(1682,760,'VERIFY BEFORE DETAIL APPROVAL',['UL/GA design and fire resistance rating','Acoustic STC / OITC and flanking paths','Stud gauge/spacing, framing height, deflection','Floor finish, resilient layer and penetrations','Wall continuity through floor/roof edges']);
 b+=sourcePanel(d,c,[3,5,6]);
 b+=T(240,1330,'NOMINAL DIMENSIONS SHOWN. TYPICAL ASSEMBLY NOT YET SELECTED / FIRE-TESTED.',17,'font-weight="bold"');
 return page('A512','Demising wall / acoustic and fire separation',b,'BUILDING '+d.scope);}
function windowDetail(d,c){let b=rule()+R(160,244,1400,1110,'white','#ddd',1);
 b+=T(210,287,'YKK AP YOW 350 XT — HEAD / SILL / JAMB STUDY',22,'font-weight="bold"');
 // Sill + head in vertical section, jamb in horizontal section.
 b+=R(440,390,115,630,'url(#ct-concrete)','#111',3)+R(560,380,150,650,'url(#ct-insulation)','#111',2)+R(714,388,27,628,'url(#ct-gypsum)','#111',1.7);
 b+=R(742,425,120,55,'url(#ct-steel)','#111',2.5)+R(742,892,120,55,'url(#ct-steel)','#111',2.5);
 b+=R(796,480,14,410,'url(#ct-glass)','#27383a',3)+R(817,480,14,410,'url(#ct-glass)','#27383a',3);
 b+=R(845,893,105,27,'url(#ct-concrete)','#111',3)+P('M746 904L900 904L975 945L975 956','none','#111',4);
 b+=P('M738 920L918 920L958 960','none','#51839a',3)+P('M970 957l-26 -13v26z','#51839a','#51839a',1);
 b+=ruler(744,1040,863,1040,'3-1/2 in frame depth (nominal)');
 b+=L(321,1143,1438,1143,1.8,'10 4','#555')+T(300,1190,'PLAN / JAMB SECTION',20,'font-weight="bold"');
 b+=R(545,1220,280,70,'url(#ct-concrete)','#111',2)+R(692,1220,44,70,'url(#ct-steel)','#111',2)+R(730,1217,6,76,'url(#ct-glass)','#111',2);
 b+=callout(791,470,1690,310,'Thermally broken operable frame','Extrusion face / sash depth to manufacturer CAD');
 b+=callout(813,629,1690,412,'Insulating glass unit / Vitro','Solarban 70 candidate; confirm exact IGU');
 b+=callout(913,925,1690,510,'Sloped sill / pan flashing','End dams / outward drainage / backdam');
 b+=callout(596,487,1690,610,'Continuous insulated rough opening','Weather barrier turns into opening');
 b+=info(1690,759,'REQUIRED SUBMITTALS',['YKK full-sized head/sill/jamb CAD details','Rough opening, tolerances, fasteners, anchors','Complete NFRC U-factor / SHGC and air/water','Glazing safety, fall protection and accessibility','Operability, insect screen and hardware']);
 b+=sourcePanel(d,c,[32,38]);
 return page('A513','Apartment window / head sill jamb',b,'BUILDING '+d.scope);}
function entrance(d,c){let b=rule()+R(158,240,1410,1140,'white','#ddd',1)+T(205,287,'PLAN / RECESSED CONDITION — DOORS WITHIN FOOTPRINT',23,'font-weight="bold"');
 b+=R(290,353,1090,75,'url(#ct-concrete)','#111',4)+R(290,828,1090,75,'url(#ct-concrete)','#111',4);
 b+=R(341,428,65,400,'url(#ct-concrete)','#111',3)+R(1260,428,65,400,'url(#ct-concrete)','#111',3);
 b+=R(405,457,852,342,'white','#555',1,'stroke-dasharray="11 7"');
 b+=T(606,618,'AIRLOCK / VESTIBULE',26,'font-weight="bold"');
 b+=L(470,426,470,600,3)+P('M470 426A175 175 0 0 1 645 600','none','#777',1.7);
 b+=L(655,904,655,723,3)+P('M655 904A181 181 0 0 0 836 723','none','#777',1.7);
 b+=R(467,416,300,14,'url(#ct-steel)','#111',2)+R(652,899,300,15,'url(#ct-steel)','#111',2);
 b+=ruler(419,969,1257,969,'Vestibule clear depth — VERIFY accessibility',0);
 b+=T(324,1012,'STREET / SIDEWALK',19)+T(1040,1032,'INTERIOR LOBBY',19);
 b+=L(445,1100,1315,1100,2)+R(446,1095,240,14,'url(#ct-paving)','#111',2)+R(695,1095,495,14,'url(#ct-concrete)','#111',2)+R(684,1087,21,19,'url(#ct-steel)','#111',2);
 b+=T(475,1160,'SECTION / THRESHOLD TRANSITION',18,'font-weight="bold"');
 b+=callout(472,421,1680,304,'YKK AP 35XT entrance','Thermally broken / hardware and glass verify');
 b+=callout(658,901,1680,399,'Secondary lobby door','Air-trapping; avoid adjacent unit sight lines');
 b+=callout(685,1100,1680,498,'Threshold / drainage / flush approach','Pemko 176 candidate; ADA slopes not approved');
 b+=info(1680,700,'ENTRANCE COORDINATION',['All 16 entrances remain recessed inside envelope','Door swing, clear width and maneuvering clearance','Continuous weather seal and thermal break','Door release / egress / accessibility / security','Drainage slope away from airlock and nearby homes']);
 b+=sourcePanel(d,c,[21,29]);
 return page('A514','Recessed entry / vestibule transition',b,'BUILDING '+d.scope);}
function roof(d,c){let b=rule()+R(160,250,1400,1080,'white','#ddd',1)+T(205,290,'ROOF EDGE + LEVEL 4 TERRACE / WATERPROOF CONTINUITY',23,'font-weight="bold"');
 b+=R(255,897,1110,97,'url(#ct-concrete)','#111',4)+R(255,777,1110,118,'url(#ct-insulation)','#111',2)+R(255,763,1110,14,'url(#ct-steel)','#111',1);
 b+=R(255,750,1110,12,'#dfe8ea','#111',1)+R(257,503,83,258,'url(#ct-concrete)','#111',3);
 b+=P('M263 748H323V487H360V500','none','#222',8)+R(241,476,140,26,'url(#ct-steel)','#111',3);
 for(let x=555;x<1295;x+=190){b+=R(x,644,59,102,'url(#ct-steel)','#111',2)+R(x-34,629,125,16,'url(#ct-paving)','#111',2);}
 b+=R(518,611,820,19,'url(#ct-paving)','#111',2)+P('M1320 740L1375 761l-52 -15','none','#397f97',2.4);
 b+=ruler(400,777,400,895,'R / slope / taper: VERIFY',-30);
 b+=callout(350,491,1680,319,'PAC-CLAD PAC-TITE coping','ES-1 assembly and wall width selection');
 b+=callout(322,715,1680,408,'Carlisle Sure-Weld 60-mil TPO','Continuous upstand / termination, lap + protection');
 b+=callout(598,694,1680,498,'Bison pedestal support','Versadjust range 0–24 in; final height TBD');
 b+=callout(775,626,1680,588,'Hanover roof / plaza pavers','Size, thickness and uplift design TBD');
 b+=info(1680,758,'ROOF DESIGN HOLD POINTS',['Slope and drain outlets / overflow scuppers','Complete tested roof deck + vapor + cover board','Uplift / wind zone / pedestrian live loads','Parapet height / guard requirements','TPO compatibility with coping/paver components']);
 b+=sourcePanel(d,c,[12,15,16,18]);
 return page('A515','Roof parapet / Level 4 terrace',b,'BUILDING '+d.scope);}
function basement(d){let b=rule()+R(155,245,1400,1120,'white','#ddd',1)+T(198,290,'BASEMENT / RETAINING WALL AND RAMP TRANSITION',23,'font-weight="bold"');
 b+=R(244,499,460,700,'url(#ct-earth)','#aaa',1)+R(704,385,115,830,'url(#ct-concrete)','#111',4)+R(819,1090,645,122,'url(#ct-concrete)','#111',4);
 b+=R(690,423,12,755,'url(#ct-water)','#527a91',1.4)+P('M684 1190H818V1206H1060','none','#527a91',5)+C(1060,1207,18);
 b+=R(600,389,230,36,'url(#ct-paving)','#111',2)+P('M610 386H839L1295 450','none','#111',3);
 b+=R(818,879,650,72,'url(#ct-concrete)','#111',4)+P('M839 889L1475 777','none','#111',2.2);
 b+=T(288,688,'SOIL',27)+T(972,844,'RAMP / PARKING',24);
 b+=datum(890,879,'B1 FFL -12\'-0" PROJECT DATUM (VERIFY)');
 b+=callout(698,692,1685,315,'Waterproofing / protection / drainage board','Manufacturer / product NOT SELECTED');
 b+=callout(762,562,1685,411,'Reinforced retaining / foundation wall','Soil pressure, surcharge, thickness, strength TBD');
 b+=callout(970,1202,1685,515,'Perimeter drain, footing and sump','Waterproof continuity under slab and wall');
 b+=callout(1085,855,1685,612,'Ramp slab / trench drainage','Vehicle clearances, slopes and movement joints');
 b+=info(1685,795,'REQUIRES ENGINEERING INPUT',['Site geotechnical report and water-table design','Retaining structure: lateral + hydrostatic load','Foundation footing type, rebar / concrete strength','Drain / sump capacity and connection','Waterstop, joints, tunnel portal watertightness']);
 b+=T(178,1395,'NO FOUNDATION OR WATERPROOFING PRODUCT IS APPROVED. NO STRUCTURAL CERTIFICATION IMPLIED.',17,'font-weight="bold"');
 return page('A516','Basement foundation / retaining wall / ramp',b,'CORE / BUILDING '+d.scope);}
function curtain(d,c){let b=rule()+R(158,235,1390,1150,'white','#ddd',1)+T(198,283,'CURTAIN WALL / SLAB EDGE FIRE SAFING — SECTION',23,'font-weight="bold"');
 b+=R(480,334,89,780,'url(#ct-concrete)','#111',4)+R(569,765,780,116,'url(#ct-concrete)','#111',4);
 b+=R(720,333,26,740,'url(#ct-steel)','#111',3)+R(810,333,26,740,'url(#ct-steel)','#111',3)+R(758,344,17,390,'url(#ct-glass)','#111',2.6)+R(780,344,17,390,'url(#ct-glass)','#111',2.6);
 b+=R(758,884,17,245,'url(#ct-glass)','#111',2.6)+R(780,884,17,245,'url(#ct-glass)','#111',2.6);
 b+=R(575,880,175,43,'url(#ct-insulation)','#111',2)+R(738,875,83,17,'url(#ct-steel)','#111',2)+P('M575 750H744L755 764','none','#111',2);
 b+=R(550,866,19,40,'url(#ct-steel)','#111',1.5);b+=ruler(723,1190,837,1190,'2-1/2 in typical system sightline',0);
 b+=T(291,1320,'INTERIOR · FLOOR EDGE',21)+T(969,1320,'EXTERIOR · GLASS FACADE',21);
 b+=callout(790,442,1690,320,'Kawneer 1600 Wall System 1','Select 6 / 7.5 / 10.5 in profile depth');
 b+=callout(779,882,1690,419,'Spandrel / floor slab / perimeter safing','Listed fire-containment test and movement joint');
 b+=callout(636,772,1690,527,'Anchors and support bracket','Deflection, thermal isolation, connection to slab');
 b+=callout(766,603,1690,628,'IGU / vision and spandrel zones','Thermal, safety glazing, wind, condensation');
 b+=info(1690,772,'REQUIRED STRUCTURAL + FACADE CHECKS',['Curtain-wall structural calculations and spans','Anchor reactions and movements / live-load drift','Fire-resistant perimeter joint listing','Condensation / U-factor / air/water tests','Continuous vapor and waterproofing interfaces']);
 b+=sourcePanel(d,c,[34,38]);
 return page('A517','Curtain wall / slab edge / fire containment',b,'BUILDING '+d.scope);}
function stairs(d){let b=rule()+R(160,240,1400,1100,'white','#ddd',1)+T(198,285,'CORE STAIR FLIGHT / INTERMEDIATE LANDING SECTION',23,'font-weight="bold"');
 b+=R(295,1195,1135,78,'url(#ct-concrete)','#111',4)+R(980,550,465,76,'url(#ct-concrete)','#111',4);
 const x=415,y=1186,w=78,h=66;let points=`M${x} ${y}`;for(let i=0;i<8;i++)points+=`v-${h}h${w}`;points+=`h90v62H${x}Z`;
 b+=P(points,'url(#ct-concrete)','#111',3);
 b+=P('M415 785L1010 267M1010 267H1400','none','#222',4);
 for(let i=0;i<7;i++){const xx=470+i*75,yy=730-i*61;b+=L(xx,yy,xx,yy-100,2.5);}
 b+=T(1100,468,'LANDING',23)+T(390,1330,'LOWER FLOOR',23)+datum(1130,551,'UPPER FFL / TOS VERIFY');
 b+=callout(630,779,1670,323,'Stair treads / risers / nosing','Geometries exist; dimensions and code review TBD');
 b+=callout(971,395,1670,414,'Continuous railing / wall bracket','Height, returns, graspability, guard criteria TBD');
 b+=callout(1190,593,1670,509,'Landing and fire enclosure','Width, clear floor area, structural support');
 b+=callout(404,1198,1670,609,'Fire-rated enclosure / door access','Self-closer, panic hardware as applicable');
 b+=info(1670,762,'EGRESS APPROVAL DEPENDS ON',['Adopted local code / use / occupant load','Common path, exit capacity and travel distance','Minimum riser/tread, landing width and headroom','Structural load, guard and handrail design','Core fire separation, smoke and door ratings']);
 b+=T(210,1410,'NO EGRESS PASS CLAIM. FOR FINAL DIMENSIONS VERIFY THE MODEL EGRESS WORKSPACE.',18,'font-weight="bold"');
 return page('A518','Stair landing / egress coordination',b,'BUILDING '+d.scope);}
export function constructionSheet(sheet,model,catalog,opt={}){
 const d=data(model,opt);let svg;switch(sheet.detailKind){case'legend':svg=legend(d);break;case'register':svg=index(d,catalog);break;case'wallSection':svg=wallSection(d);break;case'exterior':svg=exterior(d,catalog);break;case'demising':svg=demising(d,catalog);break;case'window':svg=windowDetail(d,catalog);break;case'entrance':svg=entrance(d,catalog);break;case'roof':svg=roof(d,catalog);break;case'basement':svg=basement(d);break;case'curtain':svg=curtain(d,catalog);break;case'stairs':svg=stairs(d);break;default:throw Error('Unknown construction detail '+sheet.detailKind);}
 return {svg,count:model.elements.filter(e=>e.building===d.scope&&!e.specPilot).length,mepCount:0,structureCount:0,detail:true,scope:d.scope,modelAnchors:d.anchors};
}
