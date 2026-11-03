import assert from 'node:assert/strict';globalThis.window=globalThis;globalThis.self=globalThis;
const {buildDoorAssemblies,scheduleRows}=await import('../../public/door-assemblies.js');
const {enforceUnitEnclosures}=await import('../../public/unit-enclosure.js');
const {normalizeElement}=await import('../../public/geometry-contract.js');
const poly=[[0,0],[24,0],[24,28],[0,28]],p={id:'B1-U1',building:'B1',carve:{entry:[12,0],u:[1,0]},polygon:poly,groundPolygon:poly,designPolygon:poly,upperPolygon:poly,upperStart:4,levels:3,occupiedLevels:[0,1,2]},wall=(id,poly)=>({id,piece:p,type:'IFCWALL',building:'B1',level:0,parts:[{polygon:poly,z:.75,height:35.25}]});
function fixture(){return {pieces:[p],elements:[wall('front',[[0,-.25],[24,-.25],[24,.25],[0,.25]]),wall('back',[[0,27.75],[24,27.75],[24,28.25],[0,28.25]])],buildings:[]};}
const m=fixture(),r=enforceUnitEnclosures(m);assert.equal(r.issues.length,0);assert.equal(r.sideFaces,6);const doors=buildDoorAssemblies(m);assert.equal(doors.records.length,2);assert.deepEqual(doors.records.map(d=>d.category).sort(),['front','rear']);assert(doors.records.every(d=>d.openingCuts>0));
assert.equal(new Set(doors.elements.map(e=>e.id)).size,doors.elements.length);assert(doors.elements.every(e=>e.parts.every(p=>Number.isFinite(p.height)&&p.height>0)));
for(const d of doors.records){assert.equal(doors.elements.filter(e=>e.doorAssembly===d.id).length,5);assert(scheduleRows(doors).find(r=>r.id===d.id).frameDepthIn===6);}
const sourceWalls=m.elements.filter(e=>['front','back'].includes(e.id));assert(sourceWalls.every(e=>e.parts.some(p=>p.z>=8.75)), 'Headers retained');
const descriptor=normalizeElement(doors.elements[0]);assert(descriptor.properties.doorAssembly);assert.equal(descriptor.validation.nativeValidated,false);assert.equal(descriptor.validation.profileErrors.length,0);
assert.deepEqual(buildDoorAssemblies(fixture()).records.map(d=>d.id),doors.records.map(d=>d.id));console.log('PASS: opaque sides, front/rear doors, infill openings, retained headers, assembly IDs, schedule and geometry metadata');

const articulated=fixture();articulated.pieces=[{...p,daylightFacades:{0:[{A:[24,28],B:[0,28],C:[23,30],D:[1,26]}]}}];for(const e of articulated.elements)e.piece=articulated.pieces[0];const rotated=buildDoorAssemblies(articulated).records.find(d=>d.category==='rear');assert(Math.abs(rotated.u[1])>.1,'Rear door follows articulated facade direction');console.log('PASS: rear door follows actual rotated facade');
