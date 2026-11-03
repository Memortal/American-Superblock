import assert from 'node:assert/strict';
import {classifyUnitEdges,facadeOpenings,auditFacadeDesign} from '../public/facade-opening-rules.js';
const poly=[[0,0],[30,0],[30,24],[0,24]];
const p={carve:{entry:[15,0],u:[1,0]}};
const roles=classifyUnitEdges(p,poly);
assert.equal(roles.filter(e=>e.role==='entrance').length,1);
assert.equal(roles.filter(e=>e.role==='rear').length,1);
assert.equal(roles.filter(e=>e.role==='side').length,2);
for(const edge of roles){
 const openings=facadeOpenings(edge.role,edge.len,48.75,59.25);
 if(edge.role==='side')assert.equal(openings.length,0);
 if(edge.role==='entrance')assert(openings.every(o=>o.kind!=='window'||o.bottom>=52.75));
}
assert.equal(auditFacadeDesign(p,poly,48.75,59.25).sideGlazing,0);
const returnPoly=[[0,0],[30,0],[30,1],[27,1],[27,24],[0,24]];
assert.equal(classifyUnitEdges(p,returnPoly).filter(e=>e.role==='side').length>=3,true);
console.log('Facade role/opening regression checks passed');
