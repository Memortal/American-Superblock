import { open, stat } from 'node:fs/promises';
const MiB=1024*1024;
export function exportLimit(format,env=process.env){
  if(format==='json')return 256*MiB;
  if(format!=='ifc')throw Error('Unsupported export format');
  const limit=Number(env.IFC_MAX_MIB??768);
  if(!Number.isInteger(limit)||limit<256||limit>1024)throw Error('IFC_MAX_MIB must be an integer from 256 through 1024');
  return limit*MiB;
}
export async function validateExport(path,format,env=process.env){
  const {size}=await stat(path),limit=exportLimit(format,env);
  if(!size||size>limit)throw Error(format.toUpperCase()+' export size '+size+' bytes; permitted range 1–'+limit+' bytes');
  if(format==='ifc'){
    // Read only two small regions. Never load the entire IFC into Node memory.
    const handle=await open(path,'r');
    try{
      const first=Buffer.alloc(Math.min(size,8192)),last=Buffer.alloc(Math.min(size,1024));
      await handle.read(first,0,first.length,0);await handle.read(last,0,last.length,size-last.length);
      const head=first.toString('utf8'),tail=last.toString('utf8').trimEnd();
      if(!head.startsWith('ISO-10303-21;')||!head.includes("FILE_SCHEMA(('IFC4'))")||!tail.endsWith('END-ISO-10303-21;'))throw Error('Incomplete or unexpected IFC4 STEP export ('+size+' bytes)');
    }finally{await handle.close();}
  }
  return size;
}
export async function downloadModelExport(page,path,format){
  const button=format==='ifc'?'exportIfc':'exportJson';
  const pending=page.waitForEvent('download',{timeout:120000});
  await page.evaluate(id=>document.getElementById(id).click(),button);
  const download=await pending;
  const failure=await download.failure();
  if(failure)throw Error('Browser download failed: '+failure);
  await download.saveAs(path);
  const size=await validateExport(path,format);
  console.error(format.toUpperCase()+' export validated: '+size+' bytes');
  return size;
}
