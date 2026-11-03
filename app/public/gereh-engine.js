import {booleanPolys} from './office-corners.js';
import {coreRegistry} from './egress-cores.js';
import './vendor/clipper.js';
export const TYPES=[
 {key:'corner',label:'Corner',width:28,depth:14,canopy:16,levels:3},
 {key:'street',label:'Street',width:18,depth:12,canopy:12,levels:2},
 {key:'valley',label:'Valley',width:18,depth:12,canopy:12,levels:2},
 {key:'court',label:'Courtyard',width:12,depth:10,canopy:8,levels:1}
];
const len=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),add=(a,b,k=1)=>a.map((v,i)=>v+b[i]*k);
const center=p=>p.reduce((s,q)=>s.map((v,i)=>v+q[i]/p.length),[0,0]);
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2);
const inside=(p,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>p[1])!==(r[j][1]>p[1])&&p[0]<(r[j][0]-r[i][0])*(p[1]-r[i][1])/(r[j][1]-r[i][1])+r[i][0])c=!c;return c;};
const world=(e,x,y)=>[e.position[0]+e.normal[1]*x+e.normal[0]*y,e.position[1]-e.normal[0]*x+e.normal[1]*y];
const rect=(e,x0,x1,y0,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(q=>world(e,...q));
const strip=(a,b,w)=>{const d=len(a,b)||1,n=[-(b[1]-a[1])/d*w/2,(b[0]-a[0])/d*w/2];return [add(a,n),add(b,n),add(b,n,-1),add(a,n,-1)];};
const overlap=(a,b)=>{for(let k=0;k<2;k++)if(Math.max(...a.map(q=>q[k]))<=Math.min(...b.map(q=>q[k]))||Math.max(...b.map(q=>q[k]))<=Math.min(...a.map(q=>q[k])))return 0;const C=window.ClipperLib,S=1000,c=new C.Clipper(),out=[];const path=p=>p.map(q=>({X:Math.round(q[0]*S),Y:Math.round(q[1]*S)}));c.AddPath(path(a),C.PolyType.ptSubject,true);c.AddPath(path(b),C.PolyType.ptClip,true);c.Execute(C.ClipType.ctIntersection,out,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);return out.reduce((s,p)=>s+Math.abs(C.Clipper.Area(p))/S/S,0);};
let edits={};try{edits=JSON.parse(localStorage.getItem('memo-gereh-kit-v2')||'{}')}catch{}
export function setEntranceParameters(id,values){edits[id]={...edits[id],...values};localStorage.setItem('memo-gereh-kit-v2',JSON.stringify(edits));}
export function gerehCells(depth=2){
 // Boundary-preserving tenfold fan. Recursive children inherit entire parent edges.
 const ring=Array.from({length:20},(_,i)=>{const a=i*Math.PI/10,r=i%2?.72:1;return [Math.cos(a)*r,Math.sin(a)*r]});
 let cells=ring.map((p,i)=>({id:'G'+i,parent:null,generation:1,polygon:[[0,0],p,ring[(i+1)%20]]}));
 for(let g=2;g<=depth;g++)cells=cells.flatMap(c=>{const m=center(c.polygon);return c.polygon.map((p,i)=>({id:c.id+'.'+i,parent:c.id,generation:g,polygon:[p,c.polygon[(i+1)%3],m]}));});
 const edges=new Map();for(const c of cells)for(let i=0;i<3;i++){const a=c.polygon[i],b=c.polygon[(i+1)%3],key=[a,b].map(p=>p.map(v=>v.toFixed(7)).join(',')).sort().join('|');if(!edges.has(key))edges.set(key,{id:'E'+edges.size,a,b,cells:[]});edges.get(key).cells.push(c.id);}
 return {cells,edges:[...edges.values()],valid:[...edges.values()].every(e=>e.cells.length<=2),area:cells.reduce((s,c)=>s+area(c.polygon),0)};
}
export function computeGerehEntrances(buildings,pieces,elements=[]){
 const registry=coreRegistry({buildings,pieces,elements}),records=[];
 for(const b of buildings.filter(b=>b.id!=='CORE'&&!b.parking)){
  const cs=registry.filter(c=>c.building===b.id),valley=cs.find(c=>c.parking);
  const rest=cs.filter(c=>!c.parking).sort((a,b)=>Math.hypot(...b.position)-Math.hypot(...a.position));
  const order=[rest[0],rest[1],valley,rest[2]];
  TYPES.forEach((t,i)=>{
   const c=order[i];if(!c)return;const dis=c.piece.discharge,position=dis?.door||c.position;
   const out=dis?.outside||add(position,c.piece.core.v,-4),d=len(out,position)||1,normal=out.map((v,i)=>(v-position[i])/d);
   const e={id:b.id+'-G'+(i+1),building:b.id,buildingName:b.name,type:t.key,label:t.label,width:t.width,airlockDepth:t.depth,canopyDepth:t.canopy,recursion:t.levels,porosity:.55,planterSize:4,material:'stone',lighting:true,...edits[b.id+'-G'+(i+1)],position,normal,coreId:c.id,corePoint:c.position,coreLabel:c.label,existingExit:!!dis,issues:[]};
   e.width=Math.max(10,Math.min(32,+e.width));e.airlockDepth=Math.max(10,Math.min(18,+e.airlockDepth));e.canopyDepth=Math.max(6,Math.min(20,+e.canopyDepth));e.recursion=Math.max(1,Math.min(3,Math.round(e.recursion)));
   e.vestibuleWidth=Math.min(e.width-2,e.type==='corner'?12:10);e.height=e.type==='corner'?11.25:e.type==='court'?10:11;
   const office=pieces.find(p=>p.id===c.piece.sharedOfficeId||p.id===dis?.office),envelope=office?.officeEnvelope||c.piece.polygon;
   const protectedParts=elements.filter(o=>o.level===0&&!o.girih&&(o.piece?.id===c.id||o.building===b.id)&&!o.office&&!o.sharedDischarge&&['IFCWALL','IFCCOLUMN','IFCSTAIRFLIGHT','IFCSPACE'].includes(o.type)&&!(o.type==='IFCSPACE'&&o.piece?.core)).flatMap(o=>o.parts.filter(p=>p.z<e.height&&p.z+p.height>1).map(p=>p));
   let fit=null;
   for(let j=0;j<envelope.length;j++){
    const a=envelope[j],bb=envelope[(j+1)%envelope.length],L=len(a,bb),u=bb.map((v,k)=>(v-a[k])/L),n=[u[1],-u[0]],m=add(a,u,L/2);
    if(inside(add(m,n,.5),envelope))n.forEach((v,k)=>n[k]=-v);
    for(let at=e.vestibuleWidth/2+.4;at<L-e.vestibuleWidth/2-.4;at+=1){
     const anchor=add(a,u,at);if(len(anchor,position)>65)continue;
     const candidate={...e,normal:n,position:add(anchor,n,-e.airlockDepth-.25)},foot=rect(candidate,-e.vestibuleWidth/2-.22,e.vestibuleWidth/2+.22,-.15,e.airlockDepth+.2);
     if(foot.some(q=>!inside(q,envelope))||protectedParts.some(p=>overlap(foot,p.polygon)>.02))continue;
     const score=len(anchor,position);if(!fit||score<fit.score)fit={...candidate,anchor,score};
    }
   }
   e.placementResolved=!!fit;e.facadeAnchor=fit?.anchor||[...position];e.recessed=true;e.recessDepth=e.airlockDepth+.25;e.normal=fit?.normal||normal;e.position=fit?.position||add(position,normal,-e.recessDepth);e.envelope=envelope;
   if(!fit)e.issues.push('No collision-free recessed vestibule fits this entrance. Existing core exit retained; vestibule withheld.');
   e.innerDoor=[...e.position];e.privacy={sideWallOpaqueHeightFt:7.25,outerDoorOffsetFt:e.vestibuleWidth>=10?1.25:.75,frontage:'Protected privacy threshold',screening:'Opaque lower side walls, high clerestory, filtered entry wing screens'};e.outerDoor=world(e,e.privacy.outerDoorOffsetFt,e.airlockDepth);e.doorLeafWidth=3.5;e.doorClearIn=39;e.floor=.75;
   const at=(x,y)=>c.piece.core.origin.map((v,i)=>v+c.piece.core.u[i]*x+c.piece.core.v[i]*y);
   e.route=dis?.route?[position,...dis.route.slice(0,-1).reverse().map(q=>q.slice(0,2))]:[position,at(25,12),c.position];
   const tail=e.route.slice(1);let nearest=0;for(let j=1;j<tail.length;j++)if(len(tail[j],e.innerDoor)<len(tail[nearest],e.innerDoor))nearest=j;e.route=[e.outerDoor,e.innerDoor,...tail.slice(nearest)];e.routeLength=e.route.slice(1).reduce((s,q,i)=>s+len(e.route[i],q),0);
   if(!fit){e.route=dis?.route?[position,...dis.route.slice(0,-1).reverse().map(q=>q.slice(0,2))]:[position,c.position];e.componentCount=0;e.panelCount=0;e.airlockAreaSF=0;}
   e.connectionStatus=dis?'Recessed inside existing facade; ground-floor core connection requires clearance audit':'UNRESOLVED: no ground-floor exit';
   e.frontageMatches=t.key==='valley'||t.key==='court'||normal[0]*position[0]+normal[1]*position[1]>0;
   if(!e.frontageMatches)e.issues.push('Frontage: this core exits toward the courtyard; the requested '+t.label.toLowerCase()+' street connection remains unresolved.');
   if(!dis)e.issues.push('No physical exit opening found. Do not treat the connector as accessible.');
   e.clearance={doorClearIn:39,nominalLeafIn:42,secondaryLeafIn:18,bankNominalIn:60,betweenBanksFt:e.airlockDepth,clearBetweenOpenLeavesFt:e.airlockDepth-3.5,thresholdIn:0,routeTargetFt:5,review:'Dimensional screening only; opening force, maneuvering clearance, grade and egress capacity require review.'};
   e.pattern={cells:[],edges:[],valid:true,area:0};e.ornamentEnabled=false;records.push(e);
  });
 }
 return records;
}
export function createGerehIfcProxies(records,pieces){
 const all=[];
 for(const e of records){
  if(!e.placementResolved)continue;
  const p=pieces.find(p=>p.id===e.coreId);if(!p)continue;
  const common={building:e.building,piece:p,level:0,layer:'valley',component:true,entry:true,facade:true,girih:true,designEntrance:e.id,designStage:'SCHEMATIC',coreId:e.coreId};
  const palette={stone:0xe8e4db,concrete:0xf3f1eb,bronze:0x806746,glass:0xb0cbc4,green:0x234e3b,dark:0x333b36};
  const put=(id,type,role,parts,color,extra={})=>{all.push({...common,id:e.id+'-'+id,type,role,parts,color,...extra});};
  const box=(id,type,role,x0,x1,y0,y1,z,h,color,extra={})=>put(id,type,role,[{polygon:rect(e,x0,x1,y0,y1),z,height:h}],color,extra);
  const w=e.width/2,v=e.vestibuleWidth/2,d=e.airlockDepth,h=e.height,front=d+e.canopyDepth;
  box('floor','IFCSLAB','Flush enclosed vestibule floor',-v,v,0,d,0,.75,palette.stone,{slab:true,circulation:true});
  box('forecourt','IFCSLAB','Slip-resistant forecourt',-w,w,d,front+3,.55,.20,palette.stone,{slab:true,circulation:true});
  put('grade-transition','IFCSLAB','1:20 modeled transition from 0.75 ft threshold to 1.05 ft site paving',[{polygon:rect(e,-w,w,front+3,front+9),z:.55,height:.2,elevations:[0,0,.3,.3]}],palette.stone,{slab:true,circulation:true});
  box('roof','IFCSLAB','Insulated airlock roof',-v-.2,v+.2,0,d+.2,h,.65,palette.concrete,{slab:true,roof:true});
  box('canopy','IFCSLAB','Recessed entrance soffit within facade',-v,v,0,d,h-.1,.1,palette[e.material]||palette.stone,{slab:true,roof:true});
  for(const side of [-1,1]){
   const x=side*v;
   box('side-'+side,'IFCWALL','Opaque residential privacy wall — prevents views into adjacent ground-floor homes',x-.11,x+.11,0,d,.75,e.privacy.sideWallOpaqueHeightFt,palette.concrete,{privacy:true,opaque:true});
   box('side-clerestory-'+side,'IFCWINDOW','Translucent high-performance clerestory over privacy wall',x-.09,x+.09,0,d,.75+e.privacy.sideWallOpaqueHeightFt,h-.75-e.privacy.sideWallOpaqueHeightFt,palette.glass,{glazing:true,privacy:true,translucent:true});
   for(const y of [0,d])box('mullion-'+side+'-'+y,'IFCMEMBER','Bronze vestibule mullion',x-.09,x+.09,y-.09,y+.09,.75,h-.75,palette.bronze);
  }
  for(const [name,y] of [['inner',0],['outer',d]]){
   const leaf=5,hh=8,offset=name==='outer'?e.privacy.outerDoorOffsetFt:0;
   box(name+'-door','IFCDOOR',name+' independently operable self-closing glazed door',offset-leaf/2,offset+leaf/2,y-.07,y+.07,.75,hh,palette.glass,{glazing:true,doorWidth:leaf,doorHeight:hh,activeLeafWidth:3.5,secondaryLeafWidth:1.5,doubleDoor:true,selfClosing:true,independentOperation:true,clearWidthIn:39,operation:'DOUBLE_DOOR_SINGLE_SWING',exitDoor:name==='inner'});
   for(const s of [-1,1]){
    box(name+'-fixed-'+s,'IFCWALL','Fixed glazed sidelight',s<0?-v:offset+leaf/2,s<0?offset-leaf/2:v,y-.06,y+.06,.75,hh,palette.glass,{glazing:true});
    box(name+'-jamb-'+s,'IFCMEMBER','Door jamb',offset+s*leaf/2-.06,offset+s*leaf/2+.06,y-.11,y+.11,.75,hh,palette.bronze);
   }
   box(name+'-meeting-stile','IFCMEMBER','Operable unequal-leaf meeting stile; no fixed center mullion',offset+.97,offset+1.03,y-.09,y+.09,.75,hh,palette.bronze);
   box(name+'-transom','IFCWALL','Sealed glazed transom',-v,v,y-.06,y+.06,8.75,h-8.75,palette.glass,{glazing:true});
   box(name+'-head','IFCMEMBER','Door head and concealed closer',-v,v,y-.12,y+.12,8.65,.2,palette.bronze);
  }
  box('mat-inner','IFCFURNISHINGELEMENT','Recessed moisture-absorbing walk-off mat',-2.5,2.5,1,d-1,.72,.03,palette.dark);
  box('mat-outer','IFCFURNISHINGELEMENT','Recessed scraper mat',e.privacy.outerDoorOffsetFt-2.5,e.privacy.outerDoorOffsetFt+2.5,d+.3,d+6.3,.72,.03,palette.dark);
  box('drain','IFCBUILDINGELEMENTPROXY','Threshold slot drain; outfall unresolved',-v,v,d+.1,d+.22,.68,.06,palette.dark);
  const panels=[],pavers=[],screens=[],inlays=[];
  for(const [i,c] of e.pattern.cells.entries()){
   // Repeated flat panel family; shared boundaries remain identical for all descendants.
   const q=c.polygon.map(p=>[p[0]*(w-.55),d+e.canopyDepth/2+p[1]*(e.canopyDepth/2-.4)]);
   const m=center(q),inset=q.map(p=>add(m,add(p,m,-1),.965));
   panels.push({polygon:inset.map(p=>world(e,...p)),z:h+.72,height:.04,panelId:c.id,parent:c.parent});
   const pav=c.polygon.map(p=>world(e,p[0]*(w-.4),front+4+p[1]*3.6));
   if(i%4===0)pavers.push({polygon:pav,z:.75,height:.025,elevations:c.polygon.map(p=>Math.max(0,4+p[1]*3.6-3)*.05),panelId:c.id});
   if(i%4!==0)for(const side of [-1,1]){
    // A flat perforated screen cassette: scaled inset cells create actual open joints.
    const k=Math.sqrt(1-e.porosity),poly=c.polygon.map(p=>[p[0]*3,p[1]*3]),cm=center(poly),shape=poly.map(p=>add(cm,add(p,cm,-1),k));
    const ys=shape.map(p=>d+e.canopyDepth*.55+p[0]),zs=shape.map(p=>h/2+p[1]);
    // Vertical polygon represented as a thin prism with per-vertex elevations.
    screens.push({polygon:shape.map((p,j)=>world(e,side*(w-.12)+(j===1?.12:0),ys[j])),z:0,elevations:zs,height:.07,panelId:c.id});
   }
  }
  put('cassettes','IFCBUILDINGELEMENTPROXY','Flat Gereh canopy cassettes / traceable parent cells',panels,palette.bronze);
  put('paving-inlays','IFCSLAB','Gereh dark-stone paving cells',pavers,palette.bronze,{slab:true});
  // Screen diamonds are modeled with triangulated vertical faces by the common prism renderer.
  put('screens','IFCBUILDINGELEMENTPROXY','Porous bronze Gereh screen cells',screens,palette.bronze);
  for(const edge of e.pattern.edges){
   const a=world(e,edge.a[0]*(w-.4),front+4+edge.a[1]*3.6),b=world(e,edge.b[0]*(w-.4),front+4+edge.b[1]*3.6);
   const linePoly=strip(a,b,.025);inlays.push({polygon:linePoly,z:.755,height:.012,elevations:linePoly.map(q=>Math.max(0,(q[0]-e.position[0])*e.normal[0]+(q[1]-e.position[1])*e.normal[1]-front-3)*.05),sharedEdge:edge.id});
  }
  put('shared-edges','IFCBUILDINGELEMENTPROXY','Reciprocal bronze paving joints',inlays,palette.bronze);
  for(const s of [-1,1]){
   const size=e.planterSize,x=s*(w+size/2+.8),y=front+2;
   const poly=[[x-size/2,y-3],[x+size/2,y-2],[x+size/2,y+2],[x,y+3],[x-size/2,y+1]];
   put('planter-'+s,'IFCBUILDINGELEMENTPROXY','Polygonal rain-garden pocket; overflow connection pending',[{polygon:poly.map(q=>world(e,...q)),z:.55,height:.75}],palette.dark);
   const c=center(poly);put('soil-'+s,'IFCFURNISHINGELEMENT','Native planting bed',[{polygon:poly.map(q=>world(e,...add(c,add(q,c,-1),.88))),z:1.3,height:.16}],palette.green);
   box('seat-'+s,'IFCFURNISHINGELEMENT','Stone seat; outside clear entrance route',x-size/2,x+size/2,y+3.2,y+4.7,.75,1.5,palette.stone);
   for(let k=0;k<3;k++){const xx=x+(k-1)*size/4,yy=y+(k%2)*1.3;
    const shrub=Array.from({length:8},(_,j)=>world(e,xx+Math.cos(j*2*Math.PI/8)*.48,yy+Math.sin(j*2*Math.PI/8)*.48));
    put('plant-'+s+'-'+k,'IFCFURNISHINGELEMENT','Native shrub mass',[{polygon:shrub,z:1.46,height:.75+k*.12}],palette.green);
   }
   if(e.type==='corner'||e.type==='valley'){
    box('tree-trunk-'+s,'IFCFURNISHINGELEMENT','Canopy tree trunk',x-.18,x+.18,y-.18,y+.18,1.4,8,palette.bronze);
    const crown=Array.from({length:7},(_,j)=>world(e,x+Math.cos(j*2*Math.PI/7)*2.5,y+Math.sin(j*2*Math.PI/7)*2.5));
    put('tree-crown-'+s,'IFCFURNISHINGELEMENT','Faceted canopy tree',[{polygon:crown,z:7.4,height:3}],palette.green);
   }
  }
  if(e.lighting)for(const s of [-1,1])box('led-'+s,'IFCBUILDINGELEMENTPROXY','Concealed 2700 K LED strip',s*(v-.3)-.035,s*(v-.3)+.035,0,d,h-.02,.04,0xffe2a4,{emissive:true});
  e.componentCount=all.filter(a=>a.designEntrance===e.id).length;e.privacy.components=all.filter(a=>a.designEntrance===e.id&&a.privacy).length;e.panelCount=panels.length;e.pavingAreaSF=e.width*(e.canopyDepth+9);e.airlockAreaSF=e.vestibuleWidth*d;
 }
 return all;
}
export function auditEntrances(records,elements,components){
 const obstacles=elements.filter(e=>!e.girih&&e.level===0&&['IFCWALL','IFCCOLUMN','IFCSPACE'].includes(e.type)&&!e.circulation&&!e.hideMass);
 for(const e of records){
  const footprint=rect(e,-e.vestibuleWidth/2,e.vestibuleWidth/2,.35,e.airlockDepth);
  const clashes=[];
  for(const o of obstacles)for(const p of o.parts){
   if(p.z>=e.height||p.z+p.height<1.1)continue;
   const minX=Math.min(...p.polygon.map(q=>q[0])),maxX=Math.max(...p.polygon.map(q=>q[0])),minY=Math.min(...p.polygon.map(q=>q[1])),maxY=Math.max(...p.polygon.map(q=>q[1]));
   if(!footprint.some(q=>q[0]>=minX-20&&q[0]<=maxX+20&&q[1]>=minY-20&&q[1]<=maxY+20))continue;
   if(overlap(footprint,p.polygon)>.3){clashes.push({id:o.id,role:o.role||o.type,areaSF:+overlap(footprint,p.polygon).toFixed(2)});break;}
  }
  e.conflicts=clashes;e.coordination={architecture:clashes.length?'CONFLICT':'No volumetric vestibule overlap found',structure:'Pending detailed member clearance check',MEP:'Pending service clearance check',egress:'Existing core exit retained; full accessible route audit pending',drainage:'Outfall and site grades pending'};
  if(clashes.length)e.issues.push(clashes.length+' architecture / core overlaps require resolution.');
  e.issues.push('Structure, MEP, door maneuvering clearances and site grades require coordination.');
 }
 return records;
}


export async function auditEntranceServices(records,model){
 const [{generateStructure},{generateMEP}]=await Promise.all([import('./structure-engine.js'),import('./mep-network.js')]);
 const base={...model,elements:model.elements.filter(e=>!e.girih)};
 const structure=generateStructure(base),mep=window.memoMEP?.data||generateMEP(base);
 const boxes=structure.members.filter(m=>['BEAM','COLUMN','WALL','EXISTING_COLUMN'].includes(m.type)).map(m=>{
  const ps=m.polygon||[m.a,m.b].filter(Boolean);if(!ps.length)return null;
  const pad=(m.width||0)/2;return {id:m.id,discipline:'Structure',lo:[Math.min(...ps.map(p=>p[0]))-pad,Math.min(...ps.map(p=>p[1]))-pad,m.type==='BEAM'?m.z-m.height:m.z],hi:[Math.max(...ps.map(p=>p[0]))+pad,Math.max(...ps.map(p=>p[1]))+pad,m.type==='BEAM'?m.z:m.z+m.height]};
 }).filter(Boolean);
 for(const edge of mep.edges){if(edge.blocked)continue;for(let i=1;i<edge.route.length;i++){const a=edge.route[i-1],b=edge.route[i],pad=Math.max(Number(edge.size)||.2,Number(edge.height)||.2)/2;boxes.push({id:edge.id,discipline:'MEP',lo:a.map((v,j)=>Math.min(v,b[j])-pad),hi:a.map((v,j)=>Math.max(v,b[j])+pad)});}}
 for(const e of records){
  const polys=[rect(e,-e.vestibuleWidth/2,e.vestibuleWidth/2,.4,e.airlockDepth),rect(e,-e.width/2,e.width/2,e.airlockDepth,e.airlockDepth+e.canopyDepth)];
  const zones=polys.map((p,i)=>({lo:[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),i?e.height-.8:.85],hi:[Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1])),e.height+.75]}));
  const hits=boxes.filter(b=>zones.some(z=>b.lo.every((v,j)=>v<z.hi[j]&&b.hi[j]>z.lo[j])));
  e.serviceConflicts=[...new Map(hits.map(h=>[h.id,{id:h.id,discipline:h.discipline}])).values()];
  for(const discipline of ['Structure','MEP']){const count=e.serviceConflicts.filter(c=>c.discipline===discipline).length;e.coordination[discipline.toLowerCase()==='structure'?'structure':'MEP']=count+' conservative envelope candidates';}
  e.serviceAudit={method:'Conservative AABB screening; candidates need exact solid and maintenance clearance review. No primary members or services removed.',structureMembers:structure.members.length,mepEdges:mep.edges.length};
 }
 return records;
}


// Reserve the recessed airlock in office infill and passage partitions only.
// Core walls, stairs, columns, beams and services remain protected and audited.
export function reserveRecessedEntrances(records,elements){
 for(const e of records){
  if(!e.placementResolved)continue;
  const cut=rect(e,-e.vestibuleWidth/2-.22,e.vestibuleWidth/2+.22,-.15,e.airlockDepth+.5);
  for(const o of elements){
   if(o.level!==0||o.girih||!(o.office||o.sharedDischarge)||!['IFCWALL','IFCCURTAINWALL','IFCSPACE'].includes(o.type))continue;
   o.parts=o.parts.flatMap(p=>{if(p.z>=e.height||p.z+p.height<=.75||overlap(cut,p.polygon)<.001)return [p];
    const end=p.z+p.height,top=Math.min(end,e.height);
    const result=booleanPolys([[p.polygon,...(p.holes||[])]],[[cut]]).map(r=>({...p,polygon:r[0],holes:r.slice(1),height:top-p.z}));
    if(end>e.height)result.push({...p,z:e.height,height:end-e.height});return result;
   });
  }
 }
}
