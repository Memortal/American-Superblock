import {classifyUnitEdges} from './facade-opening-rules.js';
import {booleanPolys} from './office-corners.js';
// Repair opaque side boundaries after facade articulation; preserve shared walls.
export function enforceUnitEnclosures(model){
 const report={units:0,sideFaces:0,filledParts:0,issues:[]},extra=[],byPiece=new Map(),shared=model.elements.filter(e=>e.demising);
 for(const e of model.elements){const k=e.piece?.id;if(!byPiece.has(k))byPiece.set(k,[]);byPiece.get(k).push(e);}
 for(const p of model.pieces.filter(p=>!p.core&&!p.office&&!p.parking&&p.carve)){
  report.units++;p.enclosureFaces={};
  for(const l of p.occupiedLevels){const poly=l>=p.upperStart?p.upperPolygon:l===0?p.groundPolygon:p.designPolygon;if(!poly?.length)continue;const faces=classifyUnitEdges(p,poly),side=faces.filter(e=>e.role==='side'),front=faces.find(e=>e.role==='entrance'),back=faces.find(e=>e.role==='rear');
   p.enclosureFaces[l]=faces.map(e=>({a:e.a,b:e.b,role:e.role}));if(!front||!back||side.length<2)report.issues.push({piece:p.id,level:l,reason:'Four-sided orientation requires review'});
   for(const e of side){if(e.len<.1)continue;report.sideFaces++;const n=[-e.u[1]*.25,e.u[0]*.25],strip=[e.a.map((v,i)=>v+n[i]),e.b.map((v,i)=>v+n[i]),e.b.map((v,i)=>v-n[i]),e.a.map((v,i)=>v-n[i])];
    for(const old of (byPiece.get(p.id)||[]).filter(q=>q.level===l&&q.type==='IFCWALL'&&!q.demising&&!q.structural))old.parts=old.parts.flatMap(t=>booleanPolys([[t.polygon,...t.holes||[]]],[[strip]]).map(r=>({...t,polygon:r[0],holes:r.slice(1)})));
    const cuts=shared.filter(q=>q.level===l&&q.adjacentUnits?.includes(p.id)).flatMap(q=>q.parts.map(t=>[t.polygon,...t.holes||[]]));const regions=booleanPolys([[strip]],cuts);
    if(regions.length){const parts=regions.map(r=>({polygon:r[0],holes:r.slice(1),z:l*12+.75,height:11.25}));extra.push({id:p.id+':L'+l+':SOLID-SIDE-'+e.index,type:'IFCWALL',role:'Continuous opaque side wall; preliminary enclosure',piece:p,building:p.building,level:l,layer:l<3?'valley':'upper',parts,wall:true,component:true,facade:true,solidSide:true,color:0xffffff});report.filledParts+=parts.length;}
    // Remove glazing only where it crosses a solid side boundary.
    for(const q of (byPiece.get(p.id)||[]).filter(q=>q.level===l&&q.glazing&&q.type!=='IFCDOOR'))q.parts=q.parts.flatMap(t=>booleanPolys([[t.polygon,...t.holes||[]]],[[strip]]).map(r=>({...t,polygon:r[0],holes:r.slice(1)})));
   }
  }
 }
 model.elements.push(...extra);return report;
}
