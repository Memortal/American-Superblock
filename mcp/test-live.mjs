// Node 22+, no npm dependencies. Default checks avoid launching Chromium.
import assert from 'node:assert/strict';
const args=process.argv.slice(2),base=(args.find(s=>!s.startsWith('--'))||'https://american-superblock-mcp.onrender.com').replace(/\/$/,'');
const browser=args.includes('--browser')||args.includes('--ifc'),ifc=args.includes('--ifc');
let nextId=1,passed=0,failed=0;
async function rpc(method,params={}){
  const res=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:nextId++,method,params}),signal:AbortSignal.timeout(240000)});
  assert.ok(res.ok,'HTTP '+res.status+' '+await (res.ok?Promise.resolve(''):res.text()));
  const r=await res.json();assert.ok(!r.error,JSON.stringify(r.error));return r.result;
}
async function call(name,args={}){
  const r=await rpc('tools/call',{name,arguments:args});
  assert.ok(!r.isError,r.content?.[0]?.text||name+' failed');
  const text=JSON.parse(r.content.find(c=>c.type==='text').text);
  assert.ok(!text.error,text.error);
  return {text,content:r.content};
}
async function test(label,fn){
  try{await fn();passed++;console.log('PASS  '+label);}
  catch(e){failed++;console.error('FAIL  '+label+': '+e.message);}
}
const parcel={boundary:[[0,0],[400,0],[400,600],[0,600]],setbackFt:15};
let optionId;
await test('Health and release',async()=>{
  const r=await fetch(base+'/health',{signal:AbortSignal.timeout(90000)});assert.ok(r.ok);
  const h=await r.json();assert.equal(h.status,'ok');assert.equal(h.mcpVersion,'0.6.2');assert.equal(h.toolCount,35);
  console.log('      release '+h.mcpVersion+'; commit '+(h.revision||'unreported'));
});
await test('MCP handshake and 35-tool catalog',async()=>{
  const init=await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'memo-live-test',version:'1'}});
  assert.equal(init.serverInfo.version,'0.6.2');
  const r=await rpc('tools/list');assert.equal(r.tools.length,35);
});
await test('V1 project metadata',async()=>{assert.equal((await call('get_project')).text.mcpVersion,'0.6.2');});
await test('V3 create, edit, undo and redo',async()=>{
  const a=(await call('create_design')).text,b=(await call('edit_design',{manifest:a.manifest,changes:{setback:20}})).text;
  assert.equal(b.current.parameters.setback,20);
  const u=(await call('undo_design',{manifest:b.manifest})).text;assert.equal(u.current.id,a.current.id);
  assert.equal((await call('redo_design',{manifest:u.manifest})).text.current.id,b.current.id);
});
let study;
await test('V5 start and preview study',async()=>{
  study=(await call('start_design_study',{budget:2,vary:['runPerStorey']})).text;
  assert.equal(study.evaluated,0);
  assert.equal((await call('propose_next_design',{studyToken:study.studyToken})).text.parameters.runPerStorey,2);
});
await test('V6 parcel and proposal generation',async()=>{
  assert.equal((await call('analyze_parcel',{parcel})).text.areaSf,240000);
  const o=(await call('generate_city_options',{parcel})).text;
  assert.ok(o.options.length>0);optionId=o.options[0].id;
});
await test('V6 download SVG plan',async()=>{
  assert.ok(optionId,'No generated option');
  const a=(await call('export_city_proposal',{parcel,optionId,format:'svg'})).text;
  const r=await fetch(base+new URL(a.downloadUrl).pathname,{signal:AbortSignal.timeout(30000)});
  assert.ok(r.ok);assert.ok((await r.text()).startsWith('<svg'));
});
if(browser){
  await test('V1 actual BIM model',async()=>{assert.ok((await call('get_superblock')).text.elementCount>0);});
  await test('V2 actual floor plan PNG',async()=>{const r=await call('get_floor_plan',{building:'B1',level:0});assert.ok(r.content.some(c=>c.type==='image'&&c.mimeType==='image/png'));});
  await test('V4 actual housing efficiency',async()=>{assert.ok((await call('analyze_efficiency')).text.homes>0);});
  await test('V5 actual baseline evaluation',async()=>{const s=(await call('advance_design_study',{studyToken:study.studyToken})).text;assert.ok(s.ranked[0]?.metrics.homes>0);});
}
if(ifc)await test('V1 full IFC4 export',async()=>{
  const a=(await call('export_model',{format:'ifc'})).text;assert.ok(a.bytes>0);
  console.log('      IFC size: '+(a.bytes/1024/1024).toFixed(1)+' MiB');
  const url=base+new URL(a.downloadUrl).pathname;
  const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(30000)});
  assert.ok(r.ok);assert.equal(Number(r.headers.get('content-length')),a.bytes);
  console.log('      Download: '+url);
});
console.log('\n'+passed+' passed, '+failed+' failed'+(browser?'':' (browser tools skipped; use --browser or --ifc)'));
process.exitCode=failed?1:0;
