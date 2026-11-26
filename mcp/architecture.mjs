import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const defaults = { setback:18, runPerStorey:2, stepFloors:2 };
const fields = {
  setback:z.number().int().min(8).max(40).optional(),
  runPerStorey:z.number().min(0).max(4).optional(),
  stepFloors:z.number().int().min(1).max(3).optional()
};
const parameters=z.object(fields).strict();
const scope=z.enum(['all','B1','B2','B3','B4','CORE']).default('all');
const lod=z.enum(['100','200','300','350','400']).default('100');
const drawingLod=z.enum(['200','300','350','400']).default('300');
export function normalizeParameters(input={}) {
  const p={...defaults,...parameters.parse(input)};
  if(Math.abs(p.runPerStorey*4-Math.round(p.runPerStorey*4))>1e-8) throw new Error('runPerStorey must use quarter-foot increments');
  return p;
}
export function describeParameters() {
  return {defaults,units:'feet',scope:'isolated per request; the original model is never edited',parameters:{
    setback:{min:8,max:40,step:1,unit:'ft',description:'Block setback; existing footprint lock is released only in the temporary browser'},
    runPerStorey:{min:0,max:4,step:0.25,unit:'ft/storey',description:'Applied V-section outward run'},
    stepFloors:{min:1,max:3,step:1,unit:'storeys',description:'Inner V-section step interval'}
  }};
}
async function apply(page,p) {
  await page.evaluate(p=>{
    const change=(id,value)=>{const el=document.getElementById(id);if(!el)throw Error('Missing control '+id);if(el.type==='checkbox')el.checked=value;else el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}));};
    if(p.setback!==18){change('lockGeometry',false);change('setback',p.setback);}
  },p);
  if(p.runPerStorey!==2||p.stepFloors!==2){
    await page.evaluate(()=>document.getElementById('openVSection').click());
    await page.waitForSelector('#vApply',{state:'attached',timeout:60000});
    await page.evaluate(p=>{
      document.getElementById('vRun').value=String(p.runPerStorey);
      document.getElementById('vStep').value=String(p.stepFloors);
      document.getElementById('vApply').click();
    },p);
    await page.waitForFunction(p=>{const s=window.memoVAppliedReport?.settings;return s?.runPerStorey===p.runPerStorey&&s?.stepFloors===p.stepFloors;},p,{timeout:120000});
  }
  const actual=await page.evaluate(()=>({setback:Number(document.getElementById('setback').value),runPerStorey:window.memoVAppliedReport?.settings?.runPerStorey,stepFloors:window.memoVAppliedReport?.settings?.stepFloors}));
  if(Object.keys(p).some(k=>actual[k]!==p[k]))throw Error('Browser parameters do not match requested values');
  return actual;
}

export function registerArchitectureTools(server,{withBrowser,publicBase,httpMode,workdir,caveat,viewer,readOnly}){
  const artifacts=new Map();
  const prune=async()=>{
    for(const [id,a] of artifacts)if(Date.now()-a.created>3600000||artifacts.size>=12){artifacts.delete(id);await unlink(a.path).catch(()=>{});}
  };
  async function saveSvg(svg){
    if(typeof svg!=='string'||!svg.startsWith('<svg')||Buffer.byteLength(svg)>24*1024*1024)throw Error('Invalid or oversized SVG');
    await prune();const id=randomUUID(),path=join(workdir,id+'.svg');
    await writeFile(path,svg,{flag:'wx'});artifacts.set(id,{path,created:Date.now()});
    return httpMode?{svgUrl:publicBase?publicBase+'/drawings/'+id:null,expiresInSeconds:3600,mayEvictEarlier:true}:{svgPath:path,expiresInSeconds:3600,mayEvictEarlier:true};
  }
  const lookupDrawing=async id=>{await prune();return artifacts.get(id)?.path;};
  const text=value=>({type:'text',text:JSON.stringify(value)});
  const image=png=>({type:'image',mimeType:'image/png',data:png.toString('base64')});
  const add=(name,description,inputSchema,handler,annotations=readOnly)=>server.registerTool(name,{description,inputSchema,annotations},async args=>{
    try{return {content:await handler(args)};}
    catch(e){console.error('Architecture tool:',name,e.message);return {isError:true,content:[text({error:'Architecture operation failed. Verify requested parameters or server browser resources.',caveat})]};}
  });
  add('get_parameters','List supported real browser design parameters, defaults, units and bounds.',{},async()=>[text(describeParameters())]);
  const variant=async(input,operation)=>{const p=normalizeParameters(input);return withBrowser(async page=>{await apply(page,p);return operation(page,p);});};
  async function renderView(page,{building,view,lod,shadows,cut}){
    await page.evaluate(({building,view,lod,shadows,cut})=>{
      const change=(id,value)=>{const el=document.getElementById(id);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
      change('memoLOD',lod);change('showModelEdges',false);change('showShadows',shadows);
      change('buildingFocus',building);change('sectionCut',cut);
      if(building==='all'||view!=='axon')document.getElementById(view).click();
      const scene=document.getElementById('scene');
      for(const el of document.body.children)if(el!==scene&&el.tagName!=='SCRIPT'&&el.tagName!=='STYLE')el.style.setProperty('display','none','important');
      Object.assign(scene.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',margin:'0'});
      window.dispatchEvent(new Event('resize'));window.memoInvalidate?.();
    },{building,view,lod,shadows,cut});
    await page.evaluate(()=>new Promise(resolve=>{let n=0;function tick(){if(++n>=8)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));
    return page.locator('#scene canvas').screenshot({timeout:120000,animations:'disabled'});
  }
  add('get_model_view','Render the actual model as a PNG image. Axonometric building focus or whole-site plan/street cameras; model edges are off.',{building:scope,view:z.enum(['axon','plan','low']).default('axon'),lod,shadows:z.boolean().default(true),cut:z.boolean().default(false),parameters:parameters.optional()},async({parameters,...opts})=>variant(parameters,async(page,p)=>{
    if(opts.building!=='all'&&opts.view!=='axon')throw Error('Plan and street camera views are whole-site; use axon for focused buildings');
    const png=await renderView(page,opts);return [text({parameters:p,...opts,viewer,caveat}),image(png)];
  }));
  async function drawing(page,p,request){
    await page.evaluate(()=>document.getElementById('openDocumentation').click());
    await page.waitForFunction(()=>!!window.memoDocumentation?.renderSheet,{}, {timeout:120000});
    const data=await page.evaluate(req=>{
      const doc=window.memoDocumentation,sheets=doc.sheets;
      const i=sheets.findIndex(s=>req.kind==='plan'?(req.site?s.id==='A100':s.kind==='plan'&&s.id!=='A100'&&s.level===req.level):s.kind==='section'&&s.id===req.sheet);
      if(i<0)return {available:sheets.filter(s=>s.kind===req.kind).map(({id,title,level,scope})=>({id,title,level,scope}))};
      const sheet=sheets[i],building=sheet.scope||req.building;
      if(sheet.scope&&req.building!=='all'&&req.building!==sheet.scope)throw Error('Sheet scope mismatch');
      const {svg,count,clipped}=doc.renderSheet(i,{scope:building,detailLOD:Number(req.lod),labels:req.labels,dims:req.dimensions,cut:req.cutHeight??4,offset:req.offset??0,scale:'auto',structure:false,mep:'off'});
      return {svg,count,clipped,sheet:{id:sheet.id,title:sheet.title,level:sheet.level,angle:sheet.angle,scope:building}};
    },request);
    if(!data.svg)return [text({error:'Requested sheet unavailable',available:data.available,parameters:p})];
    const {svg,...meta}=data,artifact=await saveSvg(svg);
    await page.setContent('<!doctype html><html><body style="margin:0;background:white">'+svg+'</body></html>');
    await page.locator('svg').evaluate(el=>{el.style.width='1200px';el.style.height='800px';el.style.display='block';});
    const png=await page.locator('svg').screenshot({timeout:120000,animations:'disabled'});
    return [text({...meta,...artifact,parameters:p,caveat}),image(png)];
  }
  const common={building:scope,lod:drawingLod,labels:z.boolean().default(true),dimensions:z.boolean().default(true),parameters:parameters.optional()};
  add('get_floor_plan','Generate the existing architectural drawing engine floor plan and return PNG plus downloadable vector SVG. Raw level -1 is basement, 0 is Level 01.',{...common,level:z.number().int().min(-1).max(30).default(0),site:z.boolean().default(false),cutHeight:z.union([z.literal(4),z.literal(5),z.literal(6)]).default(4)},async({parameters,...req})=>variant(parameters,(page,p)=>drawing(page,p,{...req,kind:'plan'})));
  add('get_section','Generate actual architectural section A301–A304 or building-specific V301–V304; PNG plus vector SVG. Offset in feet; V sheets have fixed building scope.',{...common,sheet:z.enum(['A301','A302','A303','A304','V301','V302','V303','V304']).default('A301'),offset:z.number().min(-320).max(320).default(0)},async({parameters,...req})=>variant(parameters,(page,p)=>drawing(page,p,{...req,kind:'section'})));
  add('modify_parameters','Rebuild a temporary design variation using the real browser controls. Returns verified applied parameters and model summary. Pass returned parameters explicitly into view/plan/section tools; no shared or persisted edits.',{...fields},async input=>variant(input,async(page,p)=>{
    const summary=await page.evaluate(()=>{
      const r=window.memoVAppliedReport;
      return {vSection:r,program:document.getElementById('proposalMetrics').innerText,roadWidth:document.getElementById('roadWidthReadout').innerText};
    });
    return [text({parameters:p,summary,persistence:'none; default unchanged',next:'Pass parameters into get_model_view, get_floor_plan or get_section',caveat})];
  }),{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false});
  return lookupDrawing;
}
