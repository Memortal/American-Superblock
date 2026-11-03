import fs from 'node:fs';import assert from 'node:assert/strict';
const model=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const inside=(p,r)=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>p[1])!==(r[j][1]>p[1])&&p[0]<(r[j][0]-r[i][0])*(p[1]-r[i][1])/(r[j][1]-r[i][1])+r[i][0])yes=!yes;return yes;};
assert.equal(model.entrances.length,16);let resolved=0,withheld=0,vertices=0;
for(const e of model.entrances){
 const parts=model.elements.filter(o=>o.designEntrance===e.id);
 if(!e.placementResolved){withheld++;assert.equal(parts.length,0);assert(model.elements.some(o=>o.pieceId===e.coreId&&o.level===0&&o.exitDoor));continue;}
 resolved++;assert(parts.some(o=>o.id===e.id+'-inner-door'));assert(parts.some(o=>o.id===e.id+'-outer-door'));
 for(const o of parts.filter(o=>!/-forecourt|-grade-transition|-mat-outer|-drain|-planter-|-soil-|-seat-|-plant-|-tree-|-paving|-shared-edges/.test(o.id)))for(const p of o.parts)for(const q of p.polygon){
  assert(inside(q,e.envelope),`${o.id} outside envelope`);
  assert((q[0]-e.facadeAnchor[0])*e.normal[0]+(q[1]-e.facadeAnchor[1])*e.normal[1]<=.001,`${o.id} projects past facade`);vertices++;
 }
 assert(!e.conflicts.some(c=>!/space$/.test(c.id)),`${e.id}: protected wall clash`);
}
assert.equal(resolved,12);assert.equal(withheld,4);console.log({resolved,withheld,checkedEnclosedVertices:vertices,allExistingExitsPreserved:true});
