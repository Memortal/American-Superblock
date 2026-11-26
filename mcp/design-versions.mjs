import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeParameters, applyParameters } from './architecture.mjs';

const patch=z.object({
  setback:z.number().int().min(8).max(40).optional(),
  runPerStorey:z.number().min(0).max(4).optional(),
  stepFloors:z.number().int().min(1).max(3).optional()
}).strict();
const complete=patch.required();
const id=z.string().regex(/^[a-f0-9]{24}$/);
const revision=z.object({id,parent:id.nullable(),parameters:complete}).strict();
const manifest=z.object({schema:z.literal('memo-superblock-design-1'),cursor:z.number().int().min(0).max(19),revisions:z.array(revision).min(1).max(20)}).strict();
const makeRevision=(parameters,parent=null)=>{
  const p=normalizeParameters(parameters);
  const hash=createHash('sha256').update(JSON.stringify([parent,p])).digest('hex').slice(0,24);
  return {id:hash,parent,parameters:p};
};
export function validateDesign(input){
  const m=manifest.parse(input);
  if(m.cursor>=m.revisions.length)throw Error('Invalid cursor');
  m.revisions.forEach((r,i)=>{
    const expected=makeRevision(r.parameters,i?m.revisions[i-1].id:null);
    if(expected.id!==r.id||expected.parent!==r.parent)throw Error('Invalid revision chain');
  });
  return m;
}
export function createDesign(parameters={}){
  return {schema:'memo-superblock-design-1',cursor:0,revisions:[makeRevision(parameters)]};
}
export function editDesign(input,changes){
  const m=validateDesign(input),current=m.revisions[m.cursor];
  const next=makeRevision({...current.parameters,...patch.parse(changes)},current.id);
  if(JSON.stringify(next.parameters)===JSON.stringify(current.parameters))return m;
  if(m.cursor>=19)throw Error('History limit of 20; start a new design from current parameters');
  return {...m,cursor:m.cursor+1,revisions:[...m.revisions.slice(0,m.cursor+1),next]};
}
export function navigateDesign(input,delta){
  const m=validateDesign(input),cursor=m.cursor+delta;
  if(cursor<0||cursor>=m.revisions.length)throw Error('No revision in that direction');
  return {...m,cursor};
}
const describe=m=>({manifest:m,current:m.revisions[m.cursor],canUndo:m.cursor>0,canRedo:m.cursor<m.revisions.length-1,storage:'Portable client-held JSON; save the entire manifest to resume. No server-side project persistence.'});

async function measure(withBrowser,p){
  return withBrowser(async page=>{
    await applyParameters(page,p);
    const metrics=await page.evaluate(()=>{
      const parse=s=>Number(s.replace(/,/g,'').match(/-?\d+(?:\.\d+)?/)?.[0]);
      const cards=[...document.querySelectorAll('#proposalMetrics .program-card')];
      const program=Object.fromEntries(cards.map(c=>[c.querySelector('.program-count span').textContent,{count:parse(c.querySelector('.program-count').textContent),basePlanSf:parse(c.querySelector('.program-sf').textContent)}]));
      return {homes:parse(document.querySelector('#proposalMetrics .metric-total strong').textContent),basePlanProgramSf:parse(document.querySelector('#proposalMetrics .metric-area b').textContent),maxVShiftFt:window.memoVAppliedReport?.maxShift,program};
    });
    if(Object.keys(metrics.program).length!==5||![metrics.homes,metrics.basePlanProgramSf,metrics.maxVShiftFt,...Object.values(metrics.program).flatMap(p=>[p.count,p.basePlanSf])].every(Number.isFinite))throw Error('Invalid model metrics');
    return metrics;
  });
}

const artifacts=new Map();
async function prune(max=2){
  for(const [key,a] of artifacts)if(Date.now()-a.created>3600000||artifacts.size>max){
    artifacts.delete(key);await unlink(a.path).catch(()=>{});
  }
}
export async function lookupDesignExport(key){await prune();return artifacts.get(key);}
export function registerVersionTools(server,{withBrowser,publicBase,httpMode,workdir,caveat}){
  const add=(name,description,inputSchema,fn)=>server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async args=>{
    try{return {content:[{type:'text',text:JSON.stringify(await fn(args))}]};}
    catch(e){console.error(name,e.message);return {isError:true,content:[{type:'text',text:'Design operation failed: '+(e instanceof z.ZodError?'invalid design input':e.message.slice(0,180))}]};}
  });
  add('create_design','Create a portable parameter version manifest. Save the full returned manifest to continue later. No model build is performed.',{parameters:patch.optional()},({parameters})=>describe(createDesign(parameters)));
  add('edit_design','Append a revision with changed supported design parameters. Editing after undo discards the redo branch in the returned manifest only. Model build is separate.',{manifest,changes:patch},({manifest,changes})=>describe(editDesign(manifest,changes)));
  add('undo_design','Move to the previous design revision, returning the updated portable manifest.',{manifest},({manifest})=>describe(navigateDesign(manifest,-1)));
  add('redo_design','Move to the next design revision, returning the updated portable manifest.',{manifest},({manifest})=>describe(navigateDesign(manifest,1)));
  add('compare_designs','Rebuild two revisions from a manifest sequentially, comparing actual browser schedule metrics and V geometry shift. Not an engineering analysis.',{manifest,from:id,to:id},async({manifest,from,to})=>{
    const m=validateDesign(manifest),a=m.revisions.find(r=>r.id===from),b=m.revisions.find(r=>r.id===to);
    if(!a||!b)throw Error('Revision not found');
    const before=await measure(withBrowser,a.parameters),after=from===to?before:await measure(withBrowser,b.parameters);
    const delta=Object.fromEntries(['homes','basePlanProgramSf','maxVShiftFt'].map(k=>[k,after[k]-before[k]]));
    return {from:{...a,metrics:before},to:{...b,metrics:after},delta,areaBasis:'undeformed base-plan schedule including offices; not GFA/FAR or deformed floor area',caveat};
  });
  add('export_design','Rebuild the selected design revision and export actual variant IFC4 or geometry JSON. Temporary download; baseline export remains separate.',{manifest,revisionId:id.optional(),format:z.enum(['json','ifc'])},async({manifest,revisionId,format})=>{
    const m=validateDesign(manifest),r=revisionId?m.revisions.find(x=>x.id===revisionId):m.revisions[m.cursor];
    if(!r)throw Error('Revision not found');
    const key=randomUUID(),path=join(workdir,key+'.'+format),filename='MEMO-'+r.id+'.'+format;
    try{
      const bytes=await withBrowser(async page=>{
        await applyParameters(page,r.parameters);
        await prune(1);
        const pending=page.waitForEvent('download',{timeout:120000});
        await page.evaluate(id=>document.getElementById(id).click(),format==='json'?'exportJson':'exportIfc');
        const download=await pending;
        await download.saveAs(path);
        const size=(await stat(path)).size;
        if(!size||size>256*1024*1024)throw Error('Unexpected export size');
        artifacts.set(key,{path,filename,format,created:Date.now()});
        return size;
      });
      return {revision:r,format,bytes,...(httpMode?{downloadUrl:publicBase?publicBase+'/design-exports/'+key:null}:{localPath:path}),expiresInSeconds:3600,mayEvictEarlier:true,caveat};
    }catch(e){await unlink(path).catch(()=>{});throw e;}
  });
}
