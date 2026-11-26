import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { normalizeParameters } from './architecture.mjs';
import { efficiency, daylight, clashes, egress, structure, rankCandidates } from './analysis.mjs';
import { createDesign, editDesign, navigateDesign, validateDesign } from './design-versions.mjs';
test('portable V3 revisions, undo, redo and input validation',()=>{
  const a=createDesign();const b=editDesign(a,{setback:20});const c=editDesign(b,{runPerStorey:3});
  assert.equal(a.revisions.length,1);assert.equal(c.revisions.length,3);
  const back=navigateDesign(c,-1);assert.equal(back.cursor,1);assert.deepEqual(navigateDesign(back,1),c);
  const fork=editDesign(back,{stepFloors:3});assert.equal(fork.revisions.length,3);assert.notEqual(fork.revisions[2].id,c.revisions[2].id);
  assert.deepEqual(editDesign(c,{runPerStorey:3}),c);assert.throws(()=>navigateDesign(a,-1));
  assert.throws(()=>editDesign(a,{runPerStorey:3.1}));assert.throws(()=>editDesign(a,{setback:99}));
  const tampered=structuredClone(c);tampered.revisions[1].parameters.setback=21;assert.throws(()=>validateDesign(tampered));
  assert.deepEqual(validateDesign(JSON.parse(JSON.stringify(c))),c);
});
test('variant validation and default isolation',()=>{
  assert.deepEqual(normalizeParameters(),{setback:18,runPerStorey:2,stepFloors:2});
  assert.deepEqual(normalizeParameters({runPerStorey:3.25}),{setback:18,runPerStorey:3.25,stepFloors:2});
  assert.throws(()=>normalizeParameters({runPerStorey:3.1}));
  assert.throws(()=>normalizeParameters({setback:41}));
  assert.throws(()=>normalizeParameters({unknown:true}));
  assert.equal(normalizeParameters().runPerStorey,2);
});
test('MCP handshake and real model exports', {timeout:600000}, async()=>{
  const client=new Client({name:'superblock-smoke',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],stderr:'inherit'});
  try{
    await client.connect(transport);
    const {tools}=await client.listTools();
    assert.equal(tools.length,24);
    for(const name of ['analyze_daylight','check_clashes','analyze_egress','analyze_structure','analyze_efficiency','optimize_design'])assert.ok(tools.some(t=>t.name===name));
    for(const name of ['get_model_view','get_floor_plan','get_section','get_parameters','modify_parameters'])assert.ok(tools.some(t=>t.name===name));
    const call=async(name,args={})=>{
      const r=await client.callTool({name,arguments:args},undefined,{timeout:300000});
      assert.equal(r.isError??false,false,r.content[0]?.text);
      return JSON.parse(r.content[0].text);
    };
    assert.equal((await call('get_parameters')).defaults.setback,18);
    assert.equal((await call('get_project')).studio,'MEMO Studio');
    for(const name of ['create_design','edit_design','undo_design','redo_design','compare_designs','export_design'])assert.ok(tools.some(t=>t.name===name));
    const created=await call('create_design');
    const edited=await call('edit_design',{manifest:created.manifest,changes:{setback:19}});
    assert.equal(edited.current.parameters.setback,19);
    const undone=await call('undo_design',{manifest:edited.manifest});
    assert.equal(undone.current.id,created.current.id);
    assert.equal((await call('redo_design',{manifest:undone.manifest})).current.id,edited.current.id);
    const model=await call('get_superblock');assert.ok(model.elementCount>0);
    const list=await call('list_elements',{limit:1});assert.equal(list.elements.length,1);
    assert.equal((await call('inspect_element',{id:list.elements[0].id})).found,true);
    assert.ok((await call('analyze_density')).homes>0);
    assert.ok((await call('export_model',{format:'json'})).bytes>0);
    if(process.env.TEST_IFC==='1')assert.ok((await call('export_model',{format:'ifc'})).bytes>0);
  }finally{await client.close();}
});

test('V2 real drawings, screenshots and temporary variant', {timeout:900000,skip:process.env.TEST_V2!=='1'},async()=>{
  const client=new Client({name:'superblock-v2-smoke',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],stderr:'inherit'});
  try{
    await client.connect(transport);
    const call=async(name,args={})=>{
      const r=await client.callTool({name,arguments:args},undefined,{timeout:300000});
      assert.equal(r.isError??false,false,r.content[0]?.text);
      const metadata=JSON.parse(r.content[0].text);assert.ok(!metadata.error,metadata.error);
      return {metadata,content:r.content};
    };
    const checkImage=r=>{const img=r.content.find(c=>c.type==='image');assert.equal(img?.mimeType,'image/png');assert.ok(Buffer.from(img.data,'base64').subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));};
    const variant=await call('modify_parameters',{setback:19,runPerStorey:2.25,stepFloors:3});
    assert.deepEqual(variant.metadata.parameters,{setback:19,runPerStorey:2.25,stepFloors:3});
    assert.equal(variant.metadata.summary.vSection.settings.runPerStorey,2.25);
    const view=await call('get_model_view',{parameters:variant.metadata.parameters});checkImage(view);
    const plan=await call('get_floor_plan',{building:'B1',level:0});checkImage(plan);assert.equal(plan.metadata.sheet.level,0);assert.ok(plan.metadata.count>0);assert.ok(plan.metadata.svgPath);
    const section=await call('get_section',{sheet:'A301'});checkImage(section);assert.equal(section.metadata.sheet.id,'A301');assert.ok(section.metadata.count>0);
    assert.deepEqual(section.metadata.parameters,normalizeParameters());
  }finally{await client.close();}
});

test('V3 real revision comparison and variant export',{timeout:900000,skip:process.env.TEST_V3!=='1'},async()=>{
  const client=new Client({name:'superblock-v3-smoke',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],stderr:'inherit'});
  try{
    await client.connect(transport);
    const call=async(name,args={})=>{
      const r=await client.callTool({name,arguments:args},undefined,{timeout:600000});
      assert.equal(r.isError??false,false,r.content[0]?.text);return JSON.parse(r.content[0].text);
    };
    const a=await call('create_design'),b=await call('edit_design',{manifest:a.manifest,changes:{runPerStorey:3}});
    const compare=await call('compare_designs',{manifest:b.manifest,from:a.current.id,to:b.current.id});
    assert.ok(compare.from.metrics.homes>0);assert.ok(compare.to.metrics.homes>0);
    assert.ok(compare.delta.maxVShiftFt>0);
    const artifact=await call('export_design',{manifest:b.manifest,format:'json'});
    assert.ok(artifact.bytes>0);assert.equal(artifact.revision.id,b.current.id);
    const {readFile}=await import('node:fs/promises');
    const data=JSON.parse(await readFile(artifact.localPath,'utf8'));
    assert.equal(data.vSection.settings.runPerStorey,3);
    assert.ok(data.elements.length>0);
  }finally{await client.close();}
});

test('V4 geometry analysis formulas and conservative failure states',()=>{
  const p={polygon:[[0,0],[4,0],[4,0.2],[0,0.2]],z:0,height:3};
  const d={site:[660,660],pieces:[{lowerTotalArea:1000,apartmentCount:0,levels:3}],vSection:{enabled:true,maxShift:4},elements:[{id:'W',type:'IFCWINDOW',facade:true,building:'B1',parts:[p]},{id:'C',type:'IFCCOLUMN',building:'B1',parts:[{polygon:[[1,-1],[2,-1],[2,1],[1,1]],z:0,height:10}]}]};
  assert.equal(efficiency(d).homes,1);assert.equal(efficiency(d).residentialBasePlanSf,1000);
  assert.equal(daylight(d,{azimuth:0,altitude:0}).unshadedTwoSidedProjectedAreaProxySf,12);
  assert.equal(daylight(d,{azimuth:90,altitude:0}).unshadedTwoSidedProjectedAreaProxySf,0);
  const c=clashes(d);assert.equal(c.candidatePartPairs,1);assert.equal(c.candidates[0].a,'C');
  assert.equal(clashes(d,{groupA:'pipe',groupB:'frame'}).status,'insufficient_exported_geometry');
  assert.equal(clashes(d,{pairBudget:0}).status,'partial_screen');
  assert.equal(egress(d).status,'INVALIDATED_BY_V_SECTION');assert.equal(egress(d).distancesAvailable,false);
  assert.equal(structure(d).geometryInventory.IFCCOLUMN.elements,1);
  const r=rankCandidates([{candidate:1,metrics:{homes:10,residentialBasePlanSf:100,maxVShiftFt:4}},{candidate:2,metrics:{homes:20,residentialBasePlanSf:200,maxVShiftFt:2}}],{homes:1,area:1,lowShift:1});
  assert.equal(r[0].candidate,2);assert.equal(r[0].pareto,true);assert.equal(r[1].pareto,false);
});
test('V4 analyses on actual model export',{timeout:900000,skip:process.env.TEST_V4!=='1'},async()=>{
  const client=new Client({name:'superblock-v4-smoke',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],stderr:'inherit'});
  try{
    await client.connect(transport);
    const call=async(name,args={})=>{
      const r=await client.callTool({name,arguments:args},undefined,{timeout:600000});
      assert.equal(r.isError??false,false,r.content[0]?.text);return JSON.parse(r.content[0].text);
    };
    const base=await call('analyze_efficiency');assert.ok(base.homes>0);assert.equal(base.netToGross,null);
    assert.equal((await call('analyze_density')).homes,base.homes);
    const day=await call('analyze_daylight');assert.ok(day.parts>0);assert.ok(day.glazingVerticalAreaProxySf>0);
    const clash=await call('check_clashes');assert.ok(clash.partCounts[0]>0);assert.ok(clash.checks<=250000);
    assert.equal((await call('analyze_egress')).status,'INVALIDATED_BY_V_SECTION');
    const st=await call('analyze_structure');assert.ok(st.geometryInventory.IFCCOLUMN.elements>0);
    const opt=await call('optimize_design',{candidates:[{}, {runPerStorey:3}]});
    assert.equal(opt.status,'compared');assert.equal(opt.ranked.length,2);
  }finally{await client.close();}
});
