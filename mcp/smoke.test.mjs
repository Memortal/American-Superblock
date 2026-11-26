import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
test('MCP handshake and real model exports', {timeout:600000}, async()=>{
  const client=new Client({name:'superblock-smoke',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],stderr:'inherit'});
  try{
    await client.connect(transport);
    const {tools}=await client.listTools();
    assert.equal(tools.length,7);
    const call=async(name,args={})=>{
      const r=await client.callTool({name,arguments:args},undefined,{timeout:300000});
      assert.equal(r.isError??false,false,r.content[0]?.text);
      return JSON.parse(r.content[0].text);
    };
    assert.equal((await call('get_project')).studio,'MEMO Studio');
    const model=await call('get_superblock');assert.ok(model.elementCount>0);
    const list=await call('list_elements',{limit:1});assert.equal(list.elements.length,1);
    assert.equal((await call('inspect_element',{id:list.elements[0].id})).found,true);
    assert.ok((await call('analyze_density')).homes>0);
    assert.ok((await call('export_model',{format:'json'})).bytes>0);
    if(process.env.TEST_IFC==='1')assert.ok((await call('export_model',{format:'ifc'})).bytes>0);
  }finally{await client.close();}
});
