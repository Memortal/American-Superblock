// Preserve the current plan; convert only outer-wing ground occupancy and add L2 access.
export function applyParkingDuplexSection(model,{homeComponents,sectionPart,homeRect}){
 const pieces=model.pieces.filter(p=>p.streetDuplex),ids=new Set(pieces.map(p=>p.id)),report={streetDuplexes:pieces.length,innerTriplexes:model.pieces.filter(p=>p.kind==='inner-wing').length,parkingAreaFt2:0,removedGroundComponents:0,issues:[]};
 const originals=new Map();for(const p of pieces)originals.set(p.id,model.elements.find(e=>e.piece?.id===p.id&&e.type==='IFCDOOR'&&e.level===0&&e.id.includes('unit-entry-doors'))||model.elements.find(e=>e.piece?.id===p.id&&e.type==='IFCDOOR'&&e.level===0));
 model.elements=model.elements.flatMap(e=>{const convert=ids.has(e.piece?.id)||(e.adjacentUnits?.length&&e.adjacentUnits.every(id=>ids.has(id)));if(!convert)return[e];
 if(e.level>=3)return[e];
 if(e.type==='IFCCOLUMN'||e.type==='IFCBEAM'||(e.structural&&!e.demising))return[e];
 // Ground-level furniture, doors, screens, glazing and residential infill are removed.
 const parts=(e.parts||[]).filter(q=>q.z+q.height>12.001).map(q=>q.z<12?{...q,z:12,height:q.z+q.height-12}:q);
 if(!parts.length){report.removedGroundComponents++;return[];}
 const level=Math.max(1,e.level),unit=e.piece?.id;return[{...e,parts,level,dwellingId:e.dwellingId?unit+'-STREET-DUPLEX':undefined,role:e.space?'Street duplex home — Levels 2–3':e.role}];});
 const supportPoints=new Set(),supportEdges=new Set();
 for(const p of pieces){p.occupiedLevels=p.occupiedLevels.filter(l=>l!==0);p.lowerDwellingId=p.id+'-STREET-DUPLEX';p.lowerTotalArea=2*p.designArea-96;
 const add=(suffix,type,level,parts,extra={})=>model.elements.push({id:p.id+':STREET:'+suffix,type,building:p.building,piece:p,level,layer:'valley',parts,color:0xffffff,...extra});
 const footprint=p.polygon,area=Math.abs(footprint.reduce((s,a,i)=>{const b=footprint[(i+1)%footprint.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2);report.parkingAreaFt2+=area;
 add('PARKING','IFCSPACE',0,[sectionPart(footprint,.75,11.25)],{space:true,external:true,hideMass:true,parking:true,role:'Open ground-floor parking zone; stall / turning layout pending'});
 add('PARKING-PAVING','IFCSLAB',0,[sectionPart(footprint,0,.75)],{slab:true,parking:true,role:'Open parking ground slab'});
 for(let i=0;i<footprint.length;i++){const a=footprint[i],b=footprint[(i+1)%footprint.length],key=a.map(v=>v.toFixed(2)).join(','),other=b.map(v=>v.toFixed(2)).join(','),edge=[key,other].sort().join('|');
 if(!supportPoints.has(key)){supportPoints.add(key);add('PARKING-COLUMN-'+i,'IFCCOLUMN',0,[sectionPart([[a[0]-.75,a[1]-.75],[a[0]+.75,a[1]-.75],[a[0]+.75,a[1]+.75],[a[0]-.75,a[1]+.75]],.75,11.25)],{structural:true,component:true,role:'Provisional 18-inch parking support column; engineering sizing pending',engineeringStatus:'Unverified'});}
 if(!supportEdges.has(edge)){supportEdges.add(edge);const len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[-(b[1]-a[1])/len*.5,(b[0]-a[0])/len*.5];add('PARKING-BEAM-'+i,'IFCBEAM',0,[sectionPart([a.map((v,j)=>v+n[j]),b.map((v,j)=>v+n[j]),b.map((v,j)=>v-n[j]),a.map((v,j)=>v-n[j])],10.5,1.5)],{structural:true,component:true,role:'Provisional parking perimeter beam / wall transfer; engineering sizing pending',engineeringStatus:'Unverified'});}
 }

 add('FLOOR-L2','IFCSLAB',1,[sectionPart(p.designPolygon,12,.75,p.designHoles||[])],{slab:true,dwellingId:p.lowerDwellingId,role:'Street duplex entry floor over parking; support design pending'});
 const opening=homeRect(p,0,3,8,12);
 add('FLOOR-L3','IFCSLAB',2,[sectionPart(p.designPolygon,24,.75,[...p.designHoles||[],opening])],{slab:true,dwellingId:p.lowerDwellingId,role:'Street duplex upper floor with private stair opening'});
 for(const c of homeComponents(p,0))add('STAIR-'+c.id,c.type,1,c.parts.map(q=>({...q,z:q.z+12})),{component:true,dwellingId:p.lowerDwellingId,tread:c.tread||1.3,role:'Private street duplex stair L2–L3'});
 const door=originals.get(p.id);
 if(door){const q=door.parts[0].polygon,m=q.reduce((s,a)=>s.map((v,i)=>v+a[i]/q.length),[0,0]),building=model.buildings.find(b=>b.id===p.building);let best;
 for(let i=0;i<building.corridorOuter.length;i++){const a=building.corridorOuter[i],b=building.corridorOuter[(i+1)%building.corridorOuter.length],v=b.map((x,j)=>x-a[j]),len=Math.hypot(...v),t=Math.max(0,Math.min(1,((m[0]-a[0])*v[0]+(m[1]-a[1])*v[1])/(len*len))),near=a.map((x,j)=>x+v[j]*t),d=Math.hypot(m[0]-near[0],m[1]-near[1]);if(!best||d<best.d)best={near,d,u:v.map(x=>x/len)};}
 if(best&&best.d>.05&&best.d<18){const {near,u}=best,at=(a,k)=>a.map((v,i)=>v+u[i]*k);add('ENTRY-BRIDGE','IFCSLAB',1,[sectionPart([at(near,-2),at(near,2),at(m,2),at(m,-2)],12,.75)],{slab:true,circulation:true,entry:true,role:'Level 2 recessed entrance connection to gallery'});}
 }
 if(door)add('ENTRY','IFCDOOR',1,door.parts.map(q=>({...q,z:q.z+12})),{component:true,entry:true,facade:true,dwellingId:p.lowerDwellingId,role:'Street duplex entrance from Level 2 gallery'});else report.issues.push({piece:p.id,reason:'Level 2 entrance source unresolved'});
 }
 // A 4-foot open access gallery at L2 follows the valley's outer edge and reaches cores.
 for(const b of model.buildings.filter(b=>!b.parking&&b.id!=='CORE')){
 const owner={id:b.id+'-STREET-GALLERY',building:b.id,kind:'circulation',polygon:b.corridorOuter};
 const coreCuts=model.pieces.filter(p=>p.building===b.id&&p.core).map(p=>[p.polygon]);
 for(let i=0;i<b.corridorOuter.length;i++){const a=b.corridorOuter[i],c=b.corridorOuter[(i+1)%b.corridorOuter.length],innerA=b.corridorInner[i],innerC=b.corridorInner[(i+1)%b.corridorInner.length],t=4/7,q=[a,c,c.map((v,j)=>v+(innerC[j]-v)*t),a.map((v,j)=>v+(innerA[j]-v)*t)];
 const round=v=>Array.isArray(v)?v.map(round):Math.round(v*10000)/10000;
 const polys=coreCuts.length?window.polygonClipping.difference(round([q]),...coreCuts.map(round)):[[q]];
 model.elements.push({id:owner.id+'-'+i,type:'IFCSLAB',building:b.id,piece:owner,level:1,layer:'valley',parts:polys.map(r=>sectionPart(r[0].slice(0,-1),12,.75,r.slice(1).map(h=>h.slice(0,-1)))),slab:true,circulation:true,color:0xffffff,role:'Four-foot Level 2 open gallery to street duplexes; core landing coordination required'});
 const ga=q[3],gb=q[2],len=Math.hypot(gb[0]-ga[0],gb[1]-ga[1]),normal=[-(gb[1]-ga[1])/len*.06,(gb[0]-ga[0])/len*.06],rail=[ga.map((v,j)=>v+normal[j]),gb.map((v,j)=>v+normal[j]),gb.map((v,j)=>v-normal[j]),ga.map((v,j)=>v-normal[j])];
 const railPolys=coreCuts.length?window.polygonClipping.difference(round([rail]),...coreCuts.map(round)):[[rail]];
 const railParts=railPolys.map(r=>sectionPart(r[0].slice(0,-1),16.15,.1));
 for(let t=0;t<=len;t+=6){const c=ga.map((v,j)=>v+(gb[j]-v)*t/len);if(model.pieces.some(p=>p.core&&p.building===b.id&&p.polygon.some(a=>Math.hypot(a[0]-c[0],a[1]-c[1])<4)))continue;railParts.push(sectionPart([[c[0]-.06,c[1]-.06],[c[0]+.06,c[1]-.06],[c[0]+.06,c[1]+.06],[c[0]-.06,c[1]+.06]],12.75,3.5));}
 model.elements.push({id:owner.id+'-GUARD-'+i,type:'IFCRAILING',building:b.id,piece:owner,level:1,layer:'valley',parts:railParts,component:true,circulation:true,color:0x555555,role:'Open Level 2 gallery guard; infill and attachment design pending'});

 }
 }
 report.issues.push({reason:'Open parking turning paths, fire separation, accessible bays, L2 core landing connections and deck/ceiling cantilever structure (25-foot outer / 5-foot courtyard projection after inward shift) require coordination.'});return report;
}
