import assert from 'node:assert/strict';
import {circularCorePlan} from '../public/circular-core.js';
const d={half:99.46,levels:15,donors:Array.from({length:4},(_,k)=>{const a=k*Math.PI/2+.7,c=[110*Math.cos(a),110*Math.sin(a)];return {building:'B'+(k+1),servicePolygon:[[-1,-1],[1,-1],[1,1],[-1,1]].map(q=>q.map((v,i)=>v+c[i]))};})};
const base=circularCorePlan(d);assert.equal(base.pods.length,4);assert.equal(base.polygon.length,96);assert(base.polygon.every(p=>Math.abs(Math.hypot(...p)-99.46)<1e-9));
for(const angle of [0,1,2,4,2]){const next=circularCorePlan({...d,runPerStorey:angle});assert.deepEqual(next.polygon,base.polygon);assert.deepEqual(next.pods.map(p=>p.polygon),base.pods.map(p=>p.polygon));}
for(const p of base.pods){assert.equal(p.core.holes.length,3);assert.equal(p.levels,15);assert.equal(p.discharge.level,0);assert.equal(p.core.liftOrigins.length,2);assert.equal(p.core.courtyardDoors,true);}
console.log('PASS: fixed circular diameter across V angles, four stable radial groups, two elevator shafts and stair per group, ground exits.');
