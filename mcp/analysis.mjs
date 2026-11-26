import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { readFile, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeParameters, applyParameters } from './architecture.mjs';

const parameters=z.object({setback:z.number().int().min(8).max(40).optional(),runPerStorey:z.number().min(0).max(4).optional(),stepFloors:z.number().int().min(1).max(3).optional()}).strict();
const building=z.enum(['all','B1','B2','B3','B4','CORE']).default('all');
const scope=(data,b='all')=>data.elements.filter(e=>b==='all'||e.building===b);
const round=n=>Math.round(n*100)/100;
const types={frame:new Set(['IFCCOLUMN','IFCBEAM','IFCMEMBER']),glazing:new Set(['IFCWINDOW','IFCCURTAINWALL']),wall:new Set(['IFCWALL','IFCWALLSTANDARDCASE']),duct:new Set(['IFCDUCTSEGMENT','IFCDUCTFITTING']),pipe:new Set(['IFCPIPESEGMENT','IFCPIPEFITTING']),slab:new Set(['IFCSLAB'])};
const isType=(e,key)=>types[key].has(e.type);
function bounds(p){
  if(!Array.isArray(p.polygon)||p.polygon.length<3||!Number.isFinite(p.z)||!Number.isFinite(p.height)||p.height<=0)return null;
  const xy=[...p.polygon,...(p.topPolygon||[])],elev=p.elevations||[];
  if(xy.some(q=>!Array.isArray(q)||!Number.isFinite(q[0])||!Number.isFinite(q[1]))||elev.some(x=>!Number.isFinite(x)))return null;
  return [Math.min(...xy.map(q=>q[0])),Math.min(...xy.map(q=>q[1])),p.z+Math.min(0,...elev),Math.max(...xy.map(q=>q[0])),Math.max(...xy.map(q=>q[1])),p.z+p.height+Math.max(0,...elev)];
}
export function efficiency(data){
  const ps=data.pieces.filter(p=>!p.core&&!p.office&&!p.parking);
  const triplex=ps.filter(p=>!p.retail&&!p.streetDuplex),street=ps.filter(p=>p.streetDuplex),roof=ps.filter(p=>p.levels>3&&!p.singleUpper);
  const sum=(a,fn)=>a.reduce((n,p)=>n+fn(p),0),apartments=sum(ps,p=>p.apartmentCount??0);
  const homes=triplex.length+street.length+roof.length+apartments;
  const residentialSf=sum(triplex,p=>p.lowerTotalArea)+sum(street,p=>p.lowerTotalArea)+sum(ps,p=>p.apartmentCount?p.apartmentCount*p.upperArea:0)+sum(roof,p=>2*p.upperArea-96);
  const siteSf=data.site[0]*data.site[1];
  if(![homes,residentialSf,siteSf].every(Number.isFinite)||siteSf<=0)throw Error('Missing schedule data');
  return {homes,triplex:triplex.length,streetDuplex:street.length,roofDuplex:roof.length,apartments,residentialBasePlanSf:round(residentialSf),siteSf,homesPerAcre:round(homes*43560/siteSf),averageProgramSfPerHome:homes?round(residentialSf/homes):null,residentialProgramToSiteRatio:round(residentialSf/siteSf),netToGross:null,areaBasis:'Undeformed base-plan residential program; not actual deformed floor area, GFA, FAR or net-to-gross efficiency. Offices, retail lower premises and circulation excluded.'};
}
export function daylight(data,{building='all',azimuth=180,altitude=35}={}){
  const rad=Math.PI/180,sun=[Math.sin(azimuth*rad),Math.cos(azimuth*rad)],factor=Math.cos(altitude*rad);
  const bins=Array.from({length:8},(_,i)=>({axisDegrees:i*22.5,glazingPartCount:0,projectedVerticalAreaSf:0}));
  let area=0,projected=0,parts=0,skipped=0;
  for(const e of scope(data,building).filter(e=>isType(e,'glazing')&&e.facade&&!e.specPilot)){
    for(const p of e.parts||[]){
      if(!bounds(p)||p.elevations){skipped++;continue;}
      let best=null;
      for(let i=0;i<p.polygon.length;i++){
        const a=p.polygon[i],b=p.polygon[(i+1)%p.polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
        if(!best||len>best.len)best={dx,dy,len};
      }
      if(!best||best.len<1e-6){skipped++;continue;}
      const normal=[-best.dy/best.len,best.dx/best.len],a=best.len*p.height;
      const axis=((Math.atan2(normal[0],normal[1])/rad)%180+180)%180;
      const bin=bins[Math.round(axis/22.5)%8];bin.glazingPartCount++;bin.projectedVerticalAreaSf+=a;
      area+=a;projected+=a*Math.abs(normal[0]*sun[0]+normal[1]*sun[1])*factor;parts++;
    }
  }
  return {status:parts?'orientation_proxy':'no_supported_facade_glazing',parts,skipped,azimuth,altitude,azimuthBasis:'Clockwise from positive model Y; no geographic north or location inferred',glazingVerticalAreaProxySf:round(area),unshadedTwoSidedProjectedAreaProxySf:round(projected),orientationBins:bins.map(b=>({...b,projectedVerticalAreaSf:round(b.projectedVerticalAreaSf)})),limitations:['Longest base-polygon edge times height; approximate vertical glazing area, not exact loft surface area.','Two-sided orientation proxy; outward normals, solar position, shading, weather, illuminance and daylight autonomy are not calculated.']};
}
export function clashes(data,{building='all',groupA='frame',groupB='glazing',toleranceFt=.05,limit=50,pairBudget=250000}={}){
  if(groupA===groupB)throw Error('Choose distinct groups');
  const selected=scope(data,building).filter(e=>!e.specPilot&&!e.site&&!e.landscape);
  let skipped=0;
  const boxes=group=>selected.filter(e=>isType(e,group)).flatMap(e=>(e.parts||[]).flatMap((p,i)=>{const b=bounds(p);if(!b){skipped++;return [];}return [{id:e.id,part:i,building:e.building,b}];}));
  const a=boxes(groupA),b=boxes(groupB).sort((x,y)=>x.b[0]-y.b[0]),hits=[];
  let checked=0,count=0,truncated=false;
  outer:for(const x of a)for(const y of b){
    if(++checked>pairBudget){truncated=true;break outer;}
    if(y.b[0]>=x.b[3]-toleranceFt)break;
    if(y.b[3]<=x.b[0]+toleranceFt||x.id===y.id)continue;
    const overlap=[0,1,2].map(i=>Math.min(x.b[i+3],y.b[i+3])-Math.max(x.b[i],y.b[i]));
    if(overlap.every(v=>v>toleranceFt)){count++;if(hits.length<limit)hits.push({a:x.id,aPart:x.part,b:y.id,bPart:y.part,overlapAabbFt:overlap.map(round),overlapAabbSfFt3:round(overlap.reduce((p,v)=>p*v,1))});}
  }
  return {status:!a.length||!b.length?'insufficient_exported_geometry':truncated?'partial_screen':'screen_complete',groupA,groupB,partCounts:[a.length,b.length],skipped,checks:Math.min(checked,pairBudget),candidatePartPairs:count,returned:hits.length,truncated,candidates:hits,method:'3D axis-aligned bounding-box overlap screening only; includes loft top polygons and conservative ramp bounds. Expected joints and false positives are possible. Not solid intersections or clash-free certification. Unexported MEP is not assessed.'};
}
export function egress(data){
  const r=data.egress;
  if(data.vSection?.enabled||r?.status==='INVALIDATED_BY_V_SECTION')return {status:'INVALIDATED_BY_V_SECTION',distancesAvailable:false,reason:'Applied V-section invalidates earlier egress route geometry. Recompute paths before reporting distances or compliance.',compliance:'not evaluated'};
  return {status:r?.status||'schematic_only',distancesAvailable:false,reportAvailable:!!r,reason:'No validated route-distance extraction implemented for this model; do not infer travel distances from straight-line geometry.',compliance:'not evaluated'};
}
export function structure(data,b='all'){
  const es=scope(data,b).filter(e=>!e.specPilot&&!e.site&&!e.landscape),groups={};
  for(const e of es.filter(e=>isType(e,'frame')||isType(e,'slab'))){
    const k=e.type,g=groups[k]??={elements:0,parts:0,loftParts:0,minZFt:null,maxZFt:null};
    g.elements++;
    for(const p of e.parts||[]){const box=bounds(p);if(!box)continue;g.parts++;if(p.topPolygon)g.loftParts++;g.minZFt=g.minZFt===null?box[2]:Math.min(g.minZFt,box[2]);g.maxZFt=g.maxZFt===null?box[5]:Math.max(g.maxZFt,box[5]);}
  }
  return {building:b,geometryInventory:groups,vSection:{enabled:data.vSection?.enabled??null,maxShiftFt:data.vSection?.maxShift??null,unresolved:data.vSection?.unresolved??[]},status:'schematic_inventory_only',limitations:'Counts and vertical extent of exported geometry; no load paths, sizing, stress, buckling, lateral stability or code approval.'};
}
export function rankCandidates(results,weights){
  const keys=['homes','residentialBasePlanSf','maxVShiftFt'];
  const values=r=>[r.metrics.homes,r.metrics.residentialBasePlanSf,-r.metrics.maxVShiftFt];
  const w=[weights.homes,weights.area,weights.lowShift],sum=w.reduce((a,b)=>a+b,0);if(!sum)throw Error('At least one weight must be positive');
  const v=results.map(values),ranges=keys.map((_,i)=>[Math.min(...v.map(a=>a[i])),Math.max(...v.map(a=>a[i]))]);
  return results.map((r,i)=>({...r,score:round(v[i].reduce((s,x,j)=>s+w[j]*(ranges[j][0]===ranges[j][1]?0.5:(x-ranges[j][0])/(ranges[j][1]-ranges[j][0])),0)/sum),pareto:!v.some((a,j)=>j!==i&&a.every((x,k)=>x>=v[i][k])&&a.some((x,k)=>x>v[i][k]))})).sort((a,b)=>b.score-a.score);
}
export function registerAnalysisTools(server,{snapshot,withBrowser,workdir,caveat}){
  async function load(p){
    const normalized=normalizeParameters(p);
    if(normalized.setback===18&&normalized.runPerStorey===2&&normalized.stepFloors===2)return (await snapshot()).data;
    return withBrowser(async page=>{
      const path=join(workdir,randomUUID()+'.json');
      try{
        await applyParameters(page,normalized);
        const pending=page.waitForEvent('download',{timeout:120000});
        await page.evaluate(()=>document.getElementById('exportJson').click());
        await (await pending).saveAs(path);
        const size=(await stat(path)).size;if(!size||size>256*1024*1024)throw Error('Invalid export size');
        const data=JSON.parse(await readFile(path,'utf8'));
        if(!Array.isArray(data.elements)||!data.elements.length||!Array.isArray(data.pieces)||!Array.isArray(data.site))throw Error('Invalid model export');
        return data;
      }finally{await unlink(path).catch(()=>{});}
    });
  }
  const add=(name,description,inputSchema,fn)=>server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async args=>{
    try{return {content:[{type:'text',text:JSON.stringify({...await fn(args),caveat})}]};}
    catch(e){console.error(name,e.message);return {isError:true,content:[{type:'text',text:'Analysis unavailable: invalid parameters, model export or browser resource limit.'}]};}
  });
  const base={parameters:parameters.optional()};
  const analyze=(fn)=>async({parameters,...opts})=>({...fn(await load(parameters),opts),parameters:normalizeParameters(parameters)});
  add('analyze_daylight','Unshaded, two-sided facade glazing orientation proxy from real exported geometry; not daylight simulation.',{...base,building,azimuth:z.number().min(0).max(360).default(180),altitude:z.number().min(0).max(90).default(35)},analyze(daylight));
  const group=z.enum(Object.keys(types));
  add('check_clashes','Bounded broad-phase 3D AABB candidate screening for two distinct exported element groups; not exact solid clashes.',{...base,building,groupA:group.default('frame'),groupB:group.default('glazing'),toleranceFt:z.number().min(.001).max(2).default(.05),limit:z.number().int().min(1).max(100).default(50)},analyze(clashes));
  add('analyze_egress','Report whether egress data remains valid; no fabricated route distances or code approval.',base,analyze(egress));
  add('analyze_structure','Inventory actual structural-type geometry and V-section unresolved engineering issues; no structural certification.',{...base,building},analyze((data,opts)=>structure(data,opts.building)));
  add('analyze_efficiency','Calculate actual model residential base-plan program and density; do not label as GFA/FAR or net-to-gross.',base,analyze(efficiency));
  add('optimize_design','Compare two or three explicit design candidates using real model exports. Rank successful candidates by weighted normalized homes, area and low V shift; report Pareto set and failures. Not a global optimizer.',{candidates:z.array(parameters).min(2).max(3),weights:z.object({homes:z.number().min(0).max(10),area:z.number().min(0).max(10),lowShift:z.number().min(0).max(10)}).default({homes:1,area:1,lowShift:1})},async({candidates,weights})=>{
    if(!Object.values(weights).some(x=>x>0))throw Error('Zero weights');
    const valid=[],failures=[];
    for(const [i,p] of candidates.entries()){
      try{const normalized=normalizeParameters(p),d=await load(normalized),shift=d.vSection?.maxShift;if(!Number.isFinite(shift))throw Error('Missing shift metric');valid.push({candidate:i+1,parameters:normalized,metrics:{...efficiency(d),maxVShiftFt:shift}});}
      catch(e){failures.push({candidate:i+1,error:'Model or parameter evaluation failed'});}
    }
    return {status:valid.length<2?'insufficient_successful_candidates':failures.length?'partial':'compared',weights,ranked:valid.length>=2?rankCandidates(valid,weights):valid,failures,method:'Bounded candidate comparison, min-max scaling over successful candidates only. Equal metrics receive 0.5; Pareto considers all three objectives. No cost, daylight, egress or structural constraints certified.'};
  });
}
