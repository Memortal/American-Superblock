import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { chromium } from 'playwright';
import { z } from 'zod';
import { readFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../app/public/', import.meta.url));
const httpMode = process.argv.includes('--http');
const publicBase = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
if (publicBase && !/^https:\/\/[^/]+$/.test(publicBase)) throw new Error('PUBLIC_BASE_URL must be an HTTPS origin');
const view = 'https://memortal.github.io/American-Superblock/';
const source = 'https://github.com/Memortal/American-Superblock';
const caveat = 'Design research prototype; not a certified building design. V-section egress and MEP may be invalidated; base-plan program areas are not gross floor area.';
const formats = { json: { button: 'exportJson', file: 'Superblock_geometry.json', mime: 'application/json' }, ifc: { button: 'exportIfc', file: 'Superblock_IFC_Base.ifc', mime: 'application/x-step' } };
let snapshotPromise, ifcPromise;
const workdir = await mkdtemp(join(tmpdir(), 'superblock-mcp-'));
process.on('exit', () => { /* OS temp directory is removed on graceful shutdown below. */ });

async function capture(format) {
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
    const cfg = formats[format];
    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    await page.evaluate(id => document.getElementById(id).click(), cfg.button);
    const download = await downloadPromise;
    const file = join(workdir, cfg.file);
    await download.saveAs(file);
    const info = await stat(file);
    if (!info.size || info.size > 256 * 1024 * 1024) throw new Error('Unexpected export size');
    return file;
  } finally {
    try { await browser?.close(); } finally { await new Promise(ok => listener.close(ok)); }
  }
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
  catch (e) { console.error('MCP tool failed:', e.message); return { isError: true, content: [{ type:'text', text:'Model export or query failed. Check the server logs and browser dependencies.' }] }; }
};
const readOnly = { readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false };
const textFilter = z.string().max(100).optional();
const elementSummary = e => ({ id:e.id, type:e.type, role:e.role, building:e.building, level:e.level, pieceId:e.pieceId, dwellingId:e.dwellingId, partCount:e.parts?.length ?? 0 });
function makeServer() {
  const server = new McpServer({name:'american-superblock',version:'0.1.0'}, {instructions:'Read-only access to the real American Superblock default browser model. Do not present schematic studies as engineering approvals.'});
  const add = (name, description, inputSchema, handler) => server.registerTool(name, {description,inputSchema,annotations:readOnly}, safe(handler));
  add('get_project', 'Get project links, capabilities and limitations without launching the browser.', {}, async () => ({name:'American Superblock',studio:'MEMO Studio',viewer:view,source,siteFeet:[660,660],capabilities:['default model geometry','element queries','program metrics','geometry JSON and IFC4 export'],limitations:caveat}));
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
  app.get('/health',(_req,res)=>res.json({status:'ok',model:'lazy-loaded'}));
  app.get('/artifacts/:format',async(req,res)=>{
    const f=req.params.format;
    if(!Object.hasOwn(formats,f))return res.sendStatus(404);
    try {const path=f==='json'?(await snapshot()).file:await getIfc();res.type(formats[f].mime).download(path,formats[f].file);}
    catch(e){console.error(e.message);res.status(503).send('Export unavailable');}
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
