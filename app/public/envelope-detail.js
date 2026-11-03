// Reference-inspired cavity wall / water-table cornice, dimensions in feet.
// Small fasteners, membranes and cavity components are documented rather than tessellated site-wide.
import {exteriorFacadeEdges,rotateEdge} from './daylight-facades.js';
export const ASSEMBLY={stud:6/12,sheathing:.625/12,ci:2.5/12,cavity:1.5/12,veneer:3.625/12,projection:10/12,description:'Reference-inspired steel-stud cavity wall with continuous insulation, brick veneer and profiled precast / composite cornice'};
const dist=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
function strip(a,b,d0,d1,z,height){const L=dist(a,b),n=[-(b[1]-a[1])/L,(b[0]-a[0])/L],at=(p,d)=>[p[0]+n[0]*d,p[1]+n[1]*d];return {polygon:[at(a,d0),at(b,d0),at(b,d1),at(a,d1)],z,height,holes:[]};}
function near(q,a,b){const L=dist(a,b),u=[(b[0]-a[0])/L,(b[1]-a[1])/L];return q.polygon.every(p=>{const x=(p[0]-a[0])*u[0]+(p[1]-a[1])*u[1],y=-(p[0]-a[0])*u[1]+(p[1]-a[1])*u[0];return x>-.6&&x<L+.6&&Math.abs(y)<1.6;});}
export function applyEnvelopeDetail(elements,pieces,buildings,solarReport){
 const original=elements.filter(e=>!e.envelopeDetail),groups=new Map(),profiles=solarReport?.profiles||[],report={facadeTiers:0,bands:0,opaquePanels:0,buildings:[],assembly:ASSEMBLY};elements.splice(0,elements.length,...original);
 for(const e of original.filter(e=>e.facade&&!e.piece.core)){const key=e.piece.id+'|'+e.level;if(!groups.has(key))groups.set(key,{p:e.piece,l:e.level,es:[]});groups.get(key).es.push(e);}
 const emitted=new Set();
 for(const {p,l,es} of groups.values()){
  const b=buildings.find(b=>b.id===p.building);if(!b)continue;const poly=p.office?p.officeEnvelope:l>=p.upperStart?p.upperPolygon:l===0?p.groundPolygon:p.designPolygon;if(!poly)continue;
  const layerParts={insulation:[],veneer:[],cornice:[]};let used=false;
  const emit=(name,parts,material)=>{if(!parts.length)return;elements.push({id:p.id+'-L'+(l+1)+'-envelope-'+name,building:p.building,piece:p,level:l,layer:l<3?'valley':'upper',type:'IFCWALL',wall:true,component:true,facade:true,envelopeDetail:true,material,assembly:ASSEMBLY,role:'Envelope detail — '+name,color:name==='insulation'?0xe8e8e6:0xffffff,parts});};
  for(const [i,e] of exteriorFacadeEdges(poly,b,p).entries()){
   const f=profiles.find(f=>f.piece===p.id&&f.level===l&&f.face===i)||rotateEdge(e.A,e.B,0),path=[f.A,f.C,f.D,f.B];
   for(let j=1;j<path.length;j++){
    const a=path[j-1],c=path[j];if(dist(a,c)<.15)continue;const on=es.flatMap(e=>e.parts.filter(q=>near(q,a,c)).map(q=>({e,q})));if(!on.length)continue;used=true;
    const top=Math.max(...on.map(x=>x.q.z+x.q.height)),z=top+.025,h=.72;
    // Keep a flush facade: the repeating stepped cornice/band is intentionally removed.
    for(const {e:source,q} of on){if(!source.wall||source.envelopeDetail||source.role?.includes('return')||q.polygon.length!==4||q.height<1.5)continue;const aa=q.polygon[0],bb=q.polygon[1];if(dist(aa,bb)<.25)continue;const edge=[c[0]-a[0],c[1]-a[1]],v=[bb[0]-aa[0],bb[1]-aa[1]];if((edge[0]*v[0]+edge[1]*v[1])/(dist(a,c)*dist(aa,bb))<.95)continue;
     const skin=ASSEMBLY.sheathing,ci=ASSEMBLY.ci,cavity=ASSEMBLY.cavity,brick=ASSEMBLY.veneer;
     layerParts.insulation.push(strip(aa,bb,-skin-ci,-skin,q.z,q.height));layerParts.veneer.push(strip(aa,bb,-skin-ci-cavity-brick,-skin-ci-cavity,q.z,q.height));report.opaquePanels++;
    }
   }
  }
  if(used){report.facadeTiers++;if(!report.buildings.includes(p.building))report.buildings.push(p.building);}
  emit('continuous insulation',layerParts.insulation,'Rigid continuous insulation, 2.5 in');emit('white brick veneer',layerParts.veneer,'Brick veneer, nominal 3 5/8 in, white finish');emit('profiled sill and cornice',layerParts.cornice,'Precast sill / composite profile, schematic');
 }
 report.parts=elements.filter(e=>e.envelopeDetail).reduce((n,e)=>n+e.parts.length,0);return report;
}
export function envelopeDetailSheet(report={}){
 const line=(x,y,a,b)=>`<path d="M${x} ${y}L${a} ${b}" fill="none" stroke="#111" stroke-width="2"/>`,txt=(x,y,t,size=22)=>`<text x="${x}" y="${y}" font-size="${size}">${t}</text>`,rect=(x,y,w,h,fill='white')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#111" stroke-width="3"/>`;
 const labels=[['Brick veneer — nominal 3 5/8 in',1240,330],['1 1/2 in drained air cavity',1178,400],['2 1/2 in continuous insulation',1140,470],['Air / vapor barrier over sheathing',1110,540],['Cap flashing, drip and weeps',1400,720],['Profiled precast water-table sill',1380,780],['Steel support / thermal-break coordination',1150,840],['Composite cornice profile',1265,940],['Soffit finish and insulation return',950,1052]];
 return {count:report.parts||0,mepCount:0,structureCount:0,clipped:false,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="36in" height="24in" viewBox="0 0 2592 1728"><defs><pattern id="brick" width="72" height="36" patternUnits="userSpaceOnUse"><rect width="72" height="36" fill="white"/><path d="M0 0H72M0 36H72M36 0V36" stroke="#777"/></pattern><pattern id="insul" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 18L18 0" stroke="#888"/></pattern><pattern id="concrete" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="6" cy="8" r="1.5"/><circle cx="22" cy="21" r="1"/></pattern></defs><rect width="2592" height="1728" fill="white"/><g font-family="Arial,Helvetica,sans-serif" fill="#111">${rect(36,36,2520,1656,'none')}${txt(72,85,'MEMO STUDIO / AMERICAN SUPERBLOCK',26)}${txt(1700,85,'SCHEMATIC — NOT FOR CONSTRUCTION',21)}${txt(250,190,'ENVELOPE / FLOOR-EDGE ASSEMBLY',34)}${txt(250,240,'Reference-inspired typical detail · diagrammatic · not to scale',22)}
${rect(980,310,120,395,'url(#insul)')}${rect(1100,310,12.5,395)}${rect(1112.5,310,50,395,'url(#insul)')}${rect(1162.5,310,30,395)}${rect(1192.5,310,72.5,395,'url(#brick)')}${line(1111,305,1111,712)}${line(980,320,980,705)}${line(1100,320,1100,705)}
${rect(690,705,422.5,90,'url(#concrete)')}${rect(980,795,132.5,250,'url(#insul)')}${rect(1112.5,795,50,250,'url(#insul)')}
<path d="M1162 705L1425 725L1425 798L1395 798L1395 820L1350 820L1350 845L1280 845L1280 865L1162 865Z" fill="url(#concrete)" stroke="#111" stroke-width="4"/>
<path d="M1162 875H1360V900H1335V925H1300V950H1255V975H1205V1000H1162Z" fill="white" stroke="#111" stroke-width="4"/>
<path d="M1111 680V710L1435 730V750M1111 795V1060H970V1045H700" fill="none" stroke="#111" stroke-width="5"/>
${line(1090,805,1220,805)}${line(1220,805,1220,864)}${rect(700,1045,280,12.5)}${txt(690,1170,'INTERIOR',22)}${txt(1330,1170,'EXTERIOR',22)}
${labels.map(([t,x,y],i)=>line(x,y,1600,330+i*82)+line(1600,330+i*82,1660,330+i*82)+txt(1680,338+i*82,t,20)).join('')}
${line(1035,435,760,435)}${txt(260,405,'6 in steel stud backing',22)}${txt(260,440,'16 in O.C. shown in reference',20)}${line(1030,900,750,900)}${txt(260,870,'Perimeter insulation / firestop',22)}${txt(260,905,'Maintain barrier continuity at slab edge',20)}${txt(250,1280,'APPLICATION RULES',24)}${txt(250,1325,'Exterior and courtyard faces; profiles follow the current rotated wall geometry.',22)}${txt(250,1360,'Cornice bands above opening heads. No band crosses a door or the open Level 4 valley.',22)}${txt(250,1395,'Brick / insulation are modeled at opaque piers. Membranes, ties, studs, firestop and weeps: detail / metadata only.',22)}${txt(250,1430,'Profile dimensions are schematic; masonry support, movement joints, fire performance and drainage need project design.',22)}${line(36,1550,2556,1550)}${txt(72,1600,'EXTERIOR WALL / WATER-TABLE CORNICE',32)}${txt(72,1645,`${report.facadeTiers||0} facade tiers · ${report.bands||0} profile runs · ${report.opaquePanels||0} opaque wall panels`,22)}${txt(2200,1610,'A501',48)}${txt(2200,1650,'NTS / DETAIL 01',20)}</g></svg>`};
}
