import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from '../public/vendor/three.module.js';
import {loftMesh,loftPositions} from '../public/loft-geometry.js';
import {prismPositions} from '../public/coordination-3d.js';
import {batchElements,elementFromHit} from '../public/render-batches.js';

// Exercise the actual main-view mesh builder without needing a WebGL device.
const html=readFileSync(new URL('../public/superblock.html',import.meta.url),'utf8');
const start=html.indexOf('function renderFacePositions(');
const end=html.indexOf('function meshForElement(',start);
const partGeometry=runInNewContext(html.slice(start,end)+'\npartGeometry',{THREE,loftPositions});
const volume=positions=>{
 let sum=0;
 for(let i=0;i<positions.length;i+=9){
  const a=new THREE.Vector3().fromArray(positions,i);
  const b=new THREE.Vector3().fromArray(positions,i+3);
  const c=new THREE.Vector3().fromArray(positions,i+6);
  sum+=a.dot(b.cross(c))/6;
 }
 return sum;
};
const polygon=[[0,0],[4,0],[4,4],[0,4]],base={polygon,z:0,height:12,holes:[]};
const cases=[
 ['box',base,192],
 ['clockwise box',{...base,polygon:[...polygon].reverse()},192],
 ['sloping ramp',{...base,elevations:[0,0,2,2]},192],
 ['clockwise ramp',{...base,polygon:[...polygon].reverse(),elevations:[2,2,0,0]},192],
 ['shaft',{...base,holes:[[[1,1],[3,1],[3,3],[1,3]]]},144],
 ['opposite-winding shaft',{...base,polygon:[...polygon].reverse(),holes:[[[1,3],[3,3],[3,1],[1,1]]]},144],
 ['V loft',{...base,topPolygon:polygon.map(([x,y])=>[x+1,y])},192],
 ['V loft with shaft',{...base,holes:[[[1,1],[3,1],[3,3],[1,3]]],topPolygon:polygon.map(([x,y])=>[x+1,y]),topHoles:[[[2,1],[4,1],[4,3],[2,3]]]},144],
 ['concave slab',{...base,polygon:[[0,0],[4,0],[4,2],[2,2],[2,4],[0,4]],height:1},12],
];
for(const [label,part,expected]of cases){
 const before=JSON.stringify(part),g=partGeometry(part);
 for(const [view,positions]of [['main',g.attributes.position.array],['coordinated',prismPositions(THREE,part)]]){
  assert(Math.abs(volume(positions)-expected)<1e-5,`${label}: ${view} solid must have outward winding and volume ${expected}, got ${volume(positions)}`);
  assert(positions.every(Number.isFinite),`${label}: finite coordinates`);
 }
 assert.equal(JSON.stringify(part),before,'Rendering must not mutate exported model geometry');
 g.dispose();
}
const loft={...base,topPolygon:polygon.map(([x,y])=>[x+1,y])};
const exported=loftMesh(THREE,loft);
assert.equal(volume(exported.faces.flatMap(f=>f.flatMap(i=>exported.vertices[i]))),192,'IFC Z-up mesh keeps its original outward winding');

// Positive total volume alone can conceal reversed side walls. Check every
// face of the convex render solids against an interior point as well.
for(const part of [base,{...base,polygon:[...polygon].reverse()},loft]){
 const center=new THREE.Vector3(part.topPolygon?2.5:2,6,2);
 const geometry=partGeometry(part);
 for(const positions of [geometry.attributes.position.array,prismPositions(THREE,part)])for(let i=0;i<positions.length;i+=9){
  const a=new THREE.Vector3().fromArray(positions,i),b=new THREE.Vector3().fromArray(positions,i+3),c=new THREE.Vector3().fromArray(positions,i+6);
  const normal=b.clone().sub(a).cross(c.clone().sub(a));
  assert(normal.dot(a.clone().sub(center))>0,'Each exterior face must point away from the interior');
 }
 geometry.dispose();
}

const element=(id,extra={})=>({id,type:'IFCWALL',building:'B1',level:0,layer:'valley',piece:{id:'U1',duplexBase:6},color:0xffffff,parts:[base],...extra});
const wall=element('wall'),other=element('other'),space=element('room',{type:'IFCSPACE',space:true,facadeSpace:true}),coreSpace=element('core-volume',{type:'IFCSPACE',space:true,piece:{core:true}});
const makeMesh=e=>new THREE.Mesh(partGeometry(e.parts[0]),new THREE.MeshStandardMaterial({color:e.color}));
const build=(lod,edges=false,elements=[wall,other,space,coreSpace])=>{const g=new THREE.Group();batchElements(THREE,elements,g,lod>=300,makeMesh,lod,{edges});return g;};
const plain=build(300);
assert(plain.children.every(m=>m.isMesh),'Shaded view has no line overlay');
assert.equal(plain.children.length,1,'Compatible solids remain batched');
assert.deepEqual(plain.children[0].userData.elements,[wall,other],'BIM view contains physical solids, not room proxies');
assert.equal(elementFromHit({object:plain.children[0],faceIndex:0}),wall);
assert.equal(elementFromHit({object:plain.children[0],faceIndex:12}),other,'Picking still resolves the second batched element');
const concept=build(100);
assert.deepEqual(concept.children.flatMap(m=>m.userData.elements),[space,coreSpace],'Concept view keeps the room masses');
for(const lod of [100,200,300,350,400]){
 const group=build(lod,true);
 assert(group.children.some(m=>m.isLineSegments),'Model edges can be enabled at every LOD');
 assert(group.children.filter(m=>m.isLineSegments).every(m=>!m.material.depthWrite),'Edge overlays do not occlude other surfaces');
 assert(group.children.filter(m=>m.isMesh).every(m=>m.material.polygonOffset),'Solids are offset behind optional outlines');
}
assert.equal(build(300,false,[wall,element('facade',{facade:true})]).children.length,2,'Different visibility rules must not share a representative batch');
assert.equal(build(100,false,[element('empty',{parts:[],alwaysVisible:true})]).children.length,0,'Empty always-visible elements do not produce invalid bounds');
console.log('PASS: outward main/coordinated normals, ramp/shaft/loft volumes, unchanged IFC geometry, clean LOD batches, optional non-occluding edges and stable picking');
