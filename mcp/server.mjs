import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { chromium } from 'playwright';
import { z } from 'zod';
import { registerArchitectureTools, lookupDrawing } from './architecture.mjs';
import { registerVersionTools, lookupDesignExport } from './design-versions.mjs';
import { registerAnalysisTools } from './analysis.mjs';
import { registerStudyTools } from './design-study.mjs';
import { registerCityTools, lookupCityExport } from './city-maker.mjs';
import { downloadModelExport, exportLimit } from './export-validation.mjs';
import { readFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../app/public/', import.meta.url));
const httpMode = process.argv.includes('--http');
exportLimit('ifc'); // Reject invalid size configuration at startup.
const release = JSON.parse(await readFile(new URL('./package.json',import.meta.url),'utf8')).version;
const publicBase = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL)?.replace(/\/$/, '');
if (publicBase && !/^https:\/\/[^/]+$/.test(publicBase)) throw new Error('PUBLIC_BASE_URL must be an HTTPS origin');
const view = 'https://memortal.github.io/American-Superblock/';
const source = 'https://github.com/Memortal/American-Superblock';
const caveat = 'Design research prototype; not a certified building design. V-section egress and MEP may be invalidated; base-plan program areas are not gross floor area.';
const formats = { json: { button: 'exportJson', file: 'Superblock_geometry.json', mime: 'application/json' }, ifc: { button: 'exportIfc', file: 'Superblock_IFC_Base.ifc', mime: 'application/x-step' } };
let snapshotPromise, ifcPromise;
const workdir = await mkdtemp(join(tmpdir(), 'superblock-mcp-'));
process.on('exit', () => { /* OS temp directory is removed on graceful shutdown below. */ });

let browserTail=Promise.resolve(), browserJobs=0;
async function withBrowser(operation) {
  if(browserJobs>=2)throw Error('Browser busy; retry after the current model operation');
  browserJobs++;
  const previous=browserTail;
  let release;browserTail=new Promise(ok=>{release=ok;});
  await previous;
  try{return await runBrowser(operation);}finally{browserJobs--;release();}
}
async function runBrowser(operation) {
  const staticApp = express();
  staticApp.disable('x-powered-by');
  staticApp.use(express.static(root, { dotfiles: 'deny' }));
  const listener = await new Promise((ok, reject) => {
    const s = staticApp.listen(0, '127.0.0.1', () => ok(s)); s.on('error', reject);
  });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ acceptDownloads: true, viewport: {width: 1280, height: 900} });
    const origin = 'http://127.0.0.1:' + listener.address().port;
    await page.route('**/*', route => {
      const url = route.request().url();
      return url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:') ? route.continue() : route.abort();
    });
    await page.goto(origin + '/superblock.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof document.getElementById('exportJson')?.onclick === 'function' && !!window.memoBimRegistry, { }, { timeout: 180000 });
    await page.waitForFunction(()=>typeof window.memoInvalidate==='function',{}, {timeout:120000});
    return await operation(page);
  } finally {
    try { await browser?.close(); } finally { await new Promise(ok => listener.close(ok)); }
  }
}
async function capture(format) {
  return withBrowser(async page=>{
    const cfg = formats[format];
    const file=join(workdir,cfg.file);
    try{await downloadModelExport(page,file,format);return file;}
    catch(e){await rm(file,{force:true}).catch(()=>{});throw e;}
  });
}
async function snapshot() {
  if (!snapshotPromise) snapshotPromise = (async () => {
    const file = await capture('json');
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(data.elements) || !data.elements.length || !Array.isArray(data.site) || data.site.length !== 2) throw new Error('Invalid model export');
    return { data, file, elements: [...data.elements, ...(data.entranceElements || [])] };
  })().catch(e => { snapshotPromise = undefined; throw e; });
  return snapshotPromise;
}
async function getIfc() {
  if (!ifcPromise) ifcPromise = capture('ifc').catch(e => { ifcPromise = undefined; throw e; });
  return ifcPromise;
}
const result = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const safe = fn => async args => {
  try { return result(await fn(args)); }
  catch (e) { console.error('MCP tool failed:', e.message); return { isError: true, content: [{ type:'text', text:'Model export or query failed. '+(/^(IFC|JSON) export size |^Incomplete or unexpected IFC4 STEP export/.test(e.message)?e.message:'Check server logs and browser resources.') }] }; }
};
const readOnly = { readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false };
const textFilter = z.string().max(100).optional();
const elementSummary = e => ({ id:e.id, type:e.type, role:e.role, building:e.building, level:e.level, pieceId:e.pieceId, dwellingId:e.dwellingId, partCount:e.parts?.length ?? 0 });
function makeServer() {
  const server = new McpServer({name:'american-superblock',version:release}, {instructions:'Access the real American Superblock browser model, drawings and isolated temporary variants. Portable client-held design revision histories; no shared design changes. Do not present schematic studies as engineering approvals.'});
  const add = (name, description, inputSchema, handler) => server.registerTool(name, {description,inputSchema,annotations:readOnly}, safe(handler));
  add('get_project', 'Get project links, capabilities and limitations without launching the browser.', {}, async () => ({name:'American Superblock',studio:'MEMO Studio',mcpVersion:release,viewer:view,source,siteFeet:[660,660],capabilities:['default model geometry','element queries','program metrics','geometry JSON and IFC4 export','model PNG views','floor plans and sections with SVG','isolated design variants','portable design version history','undo and redo','model-based revision comparison','variant IFC4 and JSON export','facade orientation screening','bounding-box clash candidates','egress validity','structural geometry inventory','residential efficiency metrics','bounded candidate optimization','goal-driven design studies','adaptive candidate generation','signed study history','constraint-based selection','convex parcel feasibility','conceptual city massing','housing capacity estimates','city JSON and SVG exports'],limitations:caveat}));
  add('get_superblock', 'Read the default browser-generated site, building IDs, section metadata and element totals.', {}, async () => {
    const {data, elements} = await snapshot();
    const {parking,...section} = data.section || {};
    return {version:data.version,units:data.units,site:data.site,buildings:data.buildings.map(b=>({id:b.id,name:b.name,levels:b.levels,parking:b.parking})),section,elementCount:elements.length,egressStatus:data.egress?.status ?? 'not certified',viewer:view,caveat};
  });
  add('list_elements','List real exported BIM elements using exact case-insensitive filters. Levels are raw zero-based model indices; -1 is basement.',{type:textFilter,building:textFilter,level:z.number().int().optional(),offset:z.number().int().min(0).max(1000000).default(0),limit:z.number().int().min(1).max(100).default(25)},async ({type,building,level,offset,limit})=>{
    const {elements}=await snapshot();
    const eq=(a,b)=>String(a??'').toLowerCase()===b.toLowerCase();
    const found=elements.filter(e=>(!type||eq(e.type,type)||eq(e.role,type))&&(!building||eq(e.building,building))&&(level===undefined||e.level===level));
    return {total:found.length,offset,limit,elements:found.slice(offset,offset+limit).map(elementSummary),nextOffset:offset+limit<found.length?offset+limit:null};
  });
  add('inspect_element','Inspect one exported BIM element by its exact ID, including a bounded page of geometry parts in feet.',{id:z.string().min(1).max(200),partOffset:z.number().int().min(0).default(0),partLimit:z.number().int().min(1).max(10).default(3)},async ({id,partOffset,partLimit})=>{
    const {elements}=await snapshot(); const e=elements.find(e=>e.id===id);
    if(!e)return {found:false,id};
    const parts=e.parts||[];
    return {found:true,...elementSummary(e),parts:parts.slice(partOffset,partOffset+partLimit),nextPartOffset:partOffset+partLimit<parts.length?partOffset+partLimit:null,units:'feet'};
  });
  add('analyze_density','Compute home counts and base-plan residential program area from exported pieces, matching the browser schedule. Not gross FAR.',{},async()=>{
    const {data}=await snapshot(); const ps=data.pieces.filter(p=>!p.core&&!p.office&&!p.parking);
    const triplex=ps.filter(p=>!p.retail&&!p.streetDuplex),street=ps.filter(p=>p.streetDuplex),roof=ps.filter(p=>p.levels>3&&!p.singleUpper);
    const sum=(a,fn)=>a.reduce((n,p)=>n+fn(p),0);
    const apartments=sum(ps,p=>p.apartmentCount??0);
    const homes=triplex.length+street.length+roof.length+apartments;
    const siteAreaSf=data.site[0]*data.site[1];
    const residentialProgramSf=sum(triplex,p=>p.lowerTotalArea)+sum(street,p=>p.lowerTotalArea)+sum(ps,p=>p.apartmentCount?p.apartmentCount*p.upperArea:0)+sum(roof,p=>2*p.upperArea-96);
    if(!Number.isFinite(residentialProgramSf))throw new Error('Non-finite program area');
    return {siteAreaSf,acres:siteAreaSf/43560,homes,triplex:triplex.length,streetDuplex:street.length,apartments,roofDuplex:roof.length,homesPerAcre:homes/(siteAreaSf/43560),residentialProgramSf,areaBasis:'undeformed base-plan residential program; excludes offices and circulation; not GFA or FAR',caveat};
  });
  add('get_system_status','Return actual export egress status and explain limits of structural and MEP studies.',{},async()=>{
    const {data}=await snapshot(); return {egressStatus:data.egress?.status??'schematic route data available; not certified',vSectionEnabled:data.vSection?.enabled??null,structure:'schematic; professional review required',mep:'may require recomputation after V-section changes',caveat};
  });
  add('export_model','Generate or retrieve the default model geometry JSON or existing browser IFC4 export. No IFC4x3 or custom design generation.',{format:z.enum(['json','ifc'])},async({format})=>{
    const file=format==='json'?(await snapshot()).file:await getIfc();
    return {format,bytes:(await stat(file)).size,...(httpMode?{downloadUrl:publicBase?publicBase+'/artifacts/'+format:null,downloadPath:'/artifacts/'+format}:{localPath:file}),viewer:view,caveat};
  });
  registerArchitectureTools(server,{withBrowser,publicBase,httpMode,workdir,caveat,viewer:view,readOnly});
  registerVersionTools(server,{withBrowser,publicBase,httpMode,workdir,caveat});
  registerAnalysisTools(server,{snapshot,withBrowser,workdir,caveat});
  registerStudyTools(server,{snapshot,withBrowser,workdir,caveat});
  registerCityTools(server,{workdir,httpMode,publicBase});
  return server;
}
if (httpMode) {
  const app=express(); app.disable('x-powered-by');
  const bind=process.env.HOST||'127.0.0.1', port=Number(process.env.PORT||3000);
  const allowedOrigins=new Set([publicBase,...(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()),'http://localhost:'+port,'http://127.0.0.1:'+port].filter(Boolean));
  app.use((req,res,next)=>{
    if(req.headers.origin&&!allowedOrigins.has(req.headers.origin))return res.status(403).send('Origin not allowed');
    if(bind==='127.0.0.1'&&!['127.0.0.1','localhost'].includes(req.hostname))return res.status(403).send('Host not allowed');
    next();
  });
  app.get('/health',(_req,res)=>res.json({status:'ok',model:'lazy-loaded',mcpVersion:release,toolCount:35,browserJobs,browserQueueCapacity:2,ifcMaxBytes:exportLimit('ifc'),baselineExportRequested:!!snapshotPromise,revision:process.env.RENDER_GIT_COMMIT||null}));
  app.get('/artifacts/:format',async(req,res)=>{
    const f=req.params.format;
    if(!Object.hasOwn(formats,f))return res.sendStatus(404);
    try {const path=f==='json'?(await snapshot()).file:await getIfc();res.type(formats[f].mime).download(path,formats[f].file);}
    catch(e){console.error(e.message);res.status(503).send('Export unavailable');}
  });
  app.get('/drawings/:id',async(req,res)=>{
    if(!/^[0-9a-f-]{36}$/.test(req.params.id))return res.sendStatus(404);
    const file=await lookupDrawing(req.params.id);
    if(!file)return res.sendStatus(404);
    res.set('Cache-Control','no-store').type('image/svg+xml').download(file,'MEMO-Superblock.svg');
  });
  app.get('/design-exports/:id',async(req,res)=>{
    if(!/^[0-9a-f-]{36}$/.test(req.params.id))return res.sendStatus(404);
    const artifact=await lookupDesignExport(req.params.id);
    if(!artifact)return res.sendStatus(404);
    res.set('Cache-Control','no-store').type(formats[artifact.format].mime).download(artifact.path,artifact.filename);
  });
  app.get('/city-exports/:id',async(req,res)=>{
    if(!/^[0-9a-f-]{36}$/.test(req.params.id))return res.sendStatus(404);
    const artifact=await lookupCityExport(req.params.id);
    if(!artifact)return res.sendStatus(404);
    res.set('Cache-Control','no-store').type(artifact.format==='svg'?'image/svg+xml':'application/json').download(artifact.path,artifact.filename);
  });
  app.post('/mcp',express.json({limit:'256kb'}),async(req,res)=>{
    const server=makeServer(),transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    res.on('close',()=>{void server.close().catch(()=>{});});
    try {await server.connect(transport);await transport.handleRequest(req,res,req.body);}
    catch(e){console.error(e.message);if(!res.headersSent)res.status(500).json({jsonrpc:'2.0',error:{code:-32603,message:'Internal error'},id:null});}
  });
  app.all('/mcp',(_req,res)=>res.status(405).set('Allow','POST').json({jsonrpc:'2.0',error:{code:-32000,message:'Method not allowed'},id:null}));
  app.listen(port,bind,()=>console.error('American Superblock MCP listening on '+bind+':'+port));
} else {
  await makeServer().connect(new StdioServerTransport());
}
for (const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await rm(workdir,{recursive:true,force:true});process.exit(0);});
