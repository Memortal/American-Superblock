import fs from 'node:fs';import assert from 'node:assert/strict';
import {resolveContext,generateDesign,simulatePopulation,evolvePopulation,semanticElements,studyEntrances,schedule} from '../../public/evolution-population.js';
const m=JSON.parse(fs.readFileSync(process.argv[2])),fingerprint=JSON.stringify(m.pieces),reports=[];
for(const type of ['triplex','apartment']){
 const c=resolveContext(m,type),g=generateDesign(c),s=simulatePopulation(c,g,{agents:100}),e=await evolvePopulation(c,{}, {generations:20,agents:100});
 assert(s.valid,s.errors.join(';'));assert.equal(s.circulation,100);assert.equal(s.agents.length,100);assert.equal(new Set(s.agents.map(a=>a.type)).size,9);
 assert.equal(e.evaluations,120);assert.equal(e.history.length,21);assert(e.archive.length>1);assert(e.best.result.valid);assert(e.best.result.score>=s.score);
 const els=semanticElements(c,e.best.geometry);assert.equal(new Set(els.map(e=>e.id)).size,els.length);assert(els.every(e=>e.parts.every(p=>Number.isFinite(p.z))));
 if(type==='apartment'){assert.equal(c.baseLevel,4);assert(els.every(e=>e.level===4));assert(els.every(e=>e.parts.every(p=>p.z>=48)));}else assert(g.rooms.find(r=>r.name==='Living room').level===1);
 assert(schedule(c,g).validation.nativeBRep===false);assert.equal(JSON.stringify(m.pieces),fingerprint);
 const rerun=await evolvePopulation(c,{}, {generations:20,agents:100});assert.deepEqual(e.best.geometry.params,rerun.best.geometry.params);
 reports.push({type,unit:c.id,agents:100,profiles:9,evaluations:120,retained:e.archive.length,before:s.score,after:e.best.result.score,privacy:[s.privacy,e.best.result.privacy]});
}
const entrances=await studyEntrances(m);assert.equal(entrances.length,4);assert.equal(entrances.filter(e=>e.valid).length,3);assert(entrances.every(e=>!e.accessibleVerified));
console.log(JSON.stringify({reports,entrances:entrances.map(e=>({id:e.id,routeFound:e.valid})),sourceUnchanged:true}));
