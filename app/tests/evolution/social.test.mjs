import assert from 'node:assert/strict';
import test from 'node:test';
import {makeSocialContext,baselineSocialDesign,validateSocialDesign,simulateSocial,evaluateSocial,evolveSocial} from '../../public/social-evolution-engine.js';
const model={
 buildings:[{id:'B1',courtyard:[[-150,-150],[-100,-150],[-100,-100],[-150,-100]]},
           {id:'B2',courtyard:[[100,-150],[150,-150],[150,-100],[100,-100]]},
           {id:'B3',courtyard:[[100,100],[150,100],[150,150],[100,150]]},
           {id:'B4',courtyard:[[-150,100],[-100,100],[-100,150],[-150,150]]}],
 entrances:Array.from({length:16},(_,i)=>({id:'E'+i,building:'B'+(1+Math.floor(i/4)),position:[i*2,i*2],coreId:'C'+i,existingExit:true})),
 elements:[{id:'UNIT-1'}]
};
test('uses existing four courtyards without mutating source and locks entrances',()=>{
 const before=JSON.stringify(model),c=makeSocialContext(model),base=baselineSocialDesign(c);
 assert.equal(c.zones.length,4);assert.equal(c.entranceCount,16);
 assert(validateSocialDesign(c,base).valid);assert.equal(JSON.stringify(model),before);
 const invalid=JSON.parse(JSON.stringify(base));invalid.zones[0].seats=99;assert(!validateSocialDesign(c,invalid).valid);
 const changed=JSON.parse(JSON.stringify(c));changed.sourceFingerprint+='-bad';assert(!validateSocialDesign(changed,base).valid);
});
test('seeded experiments are deterministic, agent consent/privacy are modeled',()=>{
 const c=makeSocialContext(model),d=baselineSocialDesign(c);
 const x=simulateSocial(c,d,{agents:80,days:30,seed:123}),y=simulateSocial(c,d,{agents:80,days:30,seed:123});
 assert.deepEqual(x,y);assert(x.valid);assert(x.metrics.isolatedRate>=0&&x.metrics.isolatedRate<=1);
 assert(x.metrics.contactRespect>=0&&x.metrics.contactRespect<=1);
 const v=evaluateSocial(c,d,{agents:80,days:30,seeds:[123,234,345]});
 assert.equal(v.seedCount,3);
});
test('evolves multiple design scenarios, baseline preserved, proposals reversible',async()=>{
 const c=makeSocialContext(model),d=baselineSocialDesign(c),t=performance.now();
 const r=await evolveSocial(c,{agents:80,days:30,generations:4,candidates:5,seeds:[123,234,345]});
 assert.equal(r.history.length,5);assert(r.evaluations>=2);assert(r.best.evaluation.fitness>=r.baseResult.fitness);
 assert(validateSocialDesign(c,r.best.design).valid);assert.deepEqual(baselineSocialDesign(c),d);
 assert.equal(model.entrances.length,16);
 console.log(JSON.stringify({ms:Math.round(performance.now()-t),baseline:r.baseResult.fitness,best:r.best.evaluation.fitness,evaluations:r.evaluations,bestDesign:r.best.design.zones}));
});
