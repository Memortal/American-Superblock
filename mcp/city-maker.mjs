import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const EPS=1e-7, round=n=>Math.round(n*100)/100;
const point=z.tuple([z.number().min(-100000).max(100000),z.number().min(-100000).max(100000)]);
const parcelSchema=z.object({boundary:z.array(point).min(3).max(64),setbackFt:z.number().min(0).max(200).default(15),angleDeg:z.number().min(-360).max(360).optional()}).strict();
const unit=z.object({share:z.number().min(0).max(1),areaSf:z.number().min(150).max(3000),occupants:z.number().min(0).max(10)}).strict();
const defaults={studio:{share:.2,areaSf:300,occupants:1},oneBedroom:{share:.35,areaSf:500,occupants:2},twoBedroom:{share:.3,areaSf:800,occupants:3},threeBedroom:{share:.15,areaSf:1200,occupants:4}};
const mix=z.object({studio:unit,oneBedroom:unit,twoBedroom:unit,threeBedroom:unit}).strict();
const briefSchema=z.object({
  maxFAR:z.number().min(.1).max(20).default(3),maxCoverage:z.number().min(.05).max(.9).default(.6),
  maxFloors:z.number().int().min(1).max(40).default(8),floorHeightFt:z.number().min(8).max(25).default(12),
  netResidentialFraction:z.number().min(.2).max(.95).default(.78),barDepthFt:z.number().min(24).max(100).default(63),
  minGapFt:z.number().min(12).max(150).default(36),targetResidents:z.number().int().min(1).max(100000).optional(),
  unitMix:mix.default(defaults)
}).strict();
const typologies=['linear','parallel','L','U','courtyard'];
const caveat='Concept massing on a convex local-coordinate parcel; caller-supplied zoning assumptions only. Not legal entitlement, detailed BIM, code compliance or a construction design.';
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const dist=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
function signedArea(p){return p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2;}
const area=p=>Math.abs(signedArea(p));
function centroid(p){
  const a=signedArea(p);let x=0,y=0;
  for(let i=0;i<p.length;i++){const u=p[i],v=p[(i+1)%p.length],c=u[0]*v[1]-v[0]*u[1];x+=(u[0]+v[0])*c;y+=(u[1]+v[1])*c;}
  return [x/(6*a),y/(6*a)];
}
function clean(p){return p.filter((v,i)=>i===0||dist(v,p[i-1])>EPS).filter((v,i,a)=>i!==a.length-1||dist(v,a[0])>EPS);}
function clip(poly,a,b,setback){
  const len=dist(a,b),f=p=>cross(a,b,p)/len-setback,out=[];
  for(let i=0;i<poly.length;i++){
    const u=poly[i],v=poly[(i+1)%poly.length],du=f(u),dv=f(v),inside=du>=-EPS,next=dv>=-EPS;
    if(inside)out.push(u);
    if(inside!==next){const t=du/(du-dv);out.push([u[0]+t*(v[0]-u[0]),u[1]+t*(v[1]-u[1])]);}
  }
  return clean(out);
}
export function analyzeParcel(input){
  const p=parcelSchema.parse(input);let ring=clean(p.boundary);
  if(ring.length<3||area(ring)<100)throw Error('Parcel must have at least 100 square feet and three distinct vertices');
  if(signedArea(ring)<0)ring=[...ring].reverse();
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    if(dist(a,b)<EPS||ring.some((c,j)=>j!==i&&j!==(i+1)%ring.length&&cross(a,b,c)<=EPS))throw Error('Only strictly convex, ordered, non-self-intersecting parcel polygons are supported');
  }
  let inset=ring;
  for(let i=0;i<ring.length&&inset.length>=3;i++)inset=clip(inset,ring[i],ring[(i+1)%ring.length],p.setbackFt);
  if(inset.length<3||area(inset)<EPS)inset=[];
  const edges=ring.map((a,i)=>({a,b:ring[(i+1)%ring.length],len:dist(a,ring[(i+1)%ring.length])}));
  const longest=[...edges].sort((a,b)=>b.len-a.len)[0];
  const angle=p.angleDeg??Math.atan2(longest.b[1]-longest.a[1],longest.b[0]-longest.a[0])*180/Math.PI;
  return {boundary:ring,buildableBoundary:inset,areaSf:area(ring),perimeterFt:edges.reduce((s,e)=>s+e.len,0),buildableAreaSf:area(inset),setbackFt:p.setbackFt,angleDeg:angle,units:'local feet',status:inset.length?'buildable_envelope':'empty_setback_envelope',caveat};
}
export function createBrief(input={}){
  const b=briefSchema.parse(input),sum=Object.values(b.unitMix).reduce((s,u)=>s+u.share,0);
  if(Math.abs(sum-1)>1e-6)throw Error('Unit shares must sum to 1');
  return b;
}
function frame(parcel){
  const poly=parcel.buildableBoundary;if(!poly.length)return null;
  const center=centroid(poly),r=parcel.angleDeg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  const local=p=>{const x=p[0]-center[0],y=p[1]-center[1];return [c*x+s*y,-s*x+c*y];};
  const world=p=>[center[0]+c*p[0]-s*p[1],center[1]+s*p[0]+c*p[1]];
  const a=poly.map(local);
  const hx=Math.min(Math.max(...a.map(p=>p[0])),-Math.min(...a.map(p=>p[0]))),hy=Math.min(Math.max(...a.map(p=>p[1])),-Math.min(...a.map(p=>p[1])));
  const inside=p=>a.every((u,i)=>cross(u,a[(i+1)%a.length],p)>=-EPS);
  const fits=(x,y)=>[[-x,-y],[x,-y],[x,y],[-x,y]].every(inside);
  // Search aspect ratios for a conservative centered inscribed rectangle.
  let best={x:0,y:0};
  for(const ratio of [.35,.5,.7,1,1.4,2,2.8]){
    const x=Math.min(hx,hy*ratio),y=Math.min(hy,hx/ratio);let lo=0,hi=1;
    for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(fits(x*mid,y*mid))lo=mid;else hi=mid;}
    if(x*y*lo*lo>best.x*best.y)best={x:x*lo,y:y*lo};
  }
  // Include the full bounding-box aspect ratio so rectangular sites are not penalized.
  let lo=0,hi=1;
  for(let i=0;i<48;i++){const m=(lo+hi)/2;if(fits(hx*m,hy*m))lo=m;else hi=m;}
  if(hx*hy*lo*lo>best.x*best.y)best={x:hx*lo,y:hy*lo};
  return {...best,world};
}
function bars(type,x,y,d,g){
  const rect=(a,b,c,e)=>[a,b,c,e],w=2*x,h=2*y;
  if(w<d||h<d)return null;
  if(type==='linear')return [rect(-x,-d/2,x,d/2)];
  if(type==='L'){
    if(w<d+g||h<d+g)return null;
    return [rect(-x,-y,x,-y+d),rect(-x,-y+d,-x+d,y)];
  }
  if(h<2*d+g)return null;
  if(type==='parallel')return [rect(-x,-y,x,-y+d),rect(-x,y-d,x,y)];
  if(w<2*d+g)return null;
  // L/U/courtyard segments meet at edges, never overlap in area.
  const lower=rect(-x,-y,x,-y+d),left=rect(-x,-y+d,-x+d,y-d);
  const right=rect(x-d,-y+d,x,y-d);
  if(type==='U')return [lower,rect(-x,-y+d,-x+d,y),rect(x-d,-y+d,x,y)];
  return [lower,rect(-x,y-d,x,y),left,right];
}
function allocateUnits(net,b){
  const entries=Object.entries(b.unitMix),avg=entries.reduce((s,[,u])=>s+u.share*u.areaSf,0);
  let n=Math.floor(net/avg);
  const allocation=count=>{
    const rows=entries.map(([type,u])=>({type,...u,count:Math.floor(count*u.share),remainder:count*u.share%1}));
    let rest=count-rows.reduce((s,u)=>s+u.count,0);
    for(const u of [...rows].sort((a,b)=>b.remainder-a.remainder))if(rest-->0)u.count++;
    return rows;
  };
  let rows=allocation(n);
  while(n>0&&rows.reduce((s,u)=>s+u.count*u.areaSf,0)>net+EPS)rows=allocation(--n);
  return {homes:n,estimatedResidents:round(rows.reduce((s,u)=>s+u.count*u.occupants,0)),allocatedNetSf:round(rows.reduce((s,u)=>s+u.count*u.areaSf,0)),unitSchedule:rows.map(({type,count,areaSf,occupants})=>({type,count,areaSf,occupants}))};
}
export function generateOptions(parcelInput,briefInput={}){
  const p=analyzeParcel(parcelInput),b=createBrief(briefInput),f=frame(p),options=[],rejected=[];
  for(const type of typologies){
    let best=null;
    if(f)for(const depth of [...new Set([b.barDepthFt,Math.max(24,b.barDepthFt*.85),Math.max(24,b.barDepthFt*.7),24])]){
      const r=bars(type,f.x,f.y,depth,b.minGapFt);if(!r)continue;
      const footprint=r.reduce((s,[x,y,X,Y])=>s+(X-x)*(Y-y),0);
      if(footprint>p.areaSf*b.maxCoverage+EPS||footprint<EPS)continue;
      const maxFloors=Math.min(b.maxFloors,Math.floor((p.areaSf*b.maxFAR+EPS)/footprint));if(maxFloors<1)continue;
      // For a population target, test each permissible whole-floor count, not only maximum height.
      const counts=b.targetResidents===undefined?[maxFloors]:Array.from({length:maxFloors},(_,i)=>i+1);
      for(const floors of counts){
        const gfa=footprint*floors,net=gfa*b.netResidentialFraction,units=allocateUnits(net,b);
        const blocks=r.map(([x,y,X,Y],i)=>({id:type+'-'+(i+1),polygon:[[x,y],[X,y],[X,Y],[x,Y]].map(f.world),baseZFt:0,heightFt:floors*b.floorHeightFt,floors}));
        const metrics={footprintSf:round(footprint),grossMassingFloorAreaSf:round(gfa),netResidentialAssumptionSf:round(net),coverage:footprint/p.areaSf,FAR:gfa/p.areaSf,unbuiltSiteSf:round(p.areaSf-footprint),floors,heightFt:floors*b.floorHeightFt,barDepthFt:round(depth),...units,targetDifference:b.targetResidents===undefined?null:round(units.estimatedResidents-b.targetResidents)};
        const candidate={typology:type,blocks,metrics};
        const score=m=>b.targetResidents===undefined?m.estimatedResidents:-Math.abs(m.targetDifference);
        if(!best||score(metrics)>score(best.metrics)||(score(metrics)===score(best.metrics)&&metrics.grossMassingFloorAreaSf>best.metrics.grossMassingFloorAreaSf))best=candidate;
      }
    }
    if(best){best.id=createHash('sha256').update(JSON.stringify([p.boundary,b,p.setbackFt,p.angleDeg,best.typology])).digest('hex').slice(0,16);options.push(best);}
    else rejected.push({typology:type,reason:'No tested bar depth fits the conservative envelope, gap, coverage and FAR assumptions'});
  }
  return {schema:'memo-city-massing-1',parcel:p,brief:b,options,rejected,caveat,method:'Centered inscribed rectangle; five fixed bar typologies, tested depths and uniform whole floors; target mode evaluates all allowed floor counts. Gross massing area = footprint × floors; unit counts are estimated from net fraction and mix, not drawn apartments.'};
}
export function compareOptions(result,objective='population'){
  const value=o=>objective==='population'?o.metrics.estimatedResidents:objective==='openSpace'?o.metrics.unbuiltSiteSf:objective==='target'?-Math.abs(o.metrics.targetDifference):o.metrics.grossMassingFloorAreaSf;
  if(objective==='target'&&result.brief.targetResidents===undefined)throw Error('targetResidents is required for target ranking');
  return [...result.options].sort((a,b)=>value(b)-value(a)||a.typology.localeCompare(b.typology)).map((o,i)=>({rank:i+1,id:o.id,typology:o.typology,metrics:o.metrics}));
}
export function planSvg(result,option){
  const p=result.parcel.boundary,xs=p.map(q=>q[0]),ys=p.map(q=>q[1]),minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(...xs)-minX,h=Math.max(...ys)-minY;
  const scale=Math.min(680/w,480/h),xy=q=>[60+(q[0]-minX)*scale,90+(h-(q[1]-minY))*scale].map(round).join(',');
  const poly=(a,fill,stroke,dash='')=>a.length?'<polygon points="'+a.map(xy).join(' ')+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.5" '+(dash?'stroke-dasharray="'+dash+'"':'')+'/>':'';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 650" width="800" height="650"><rect width="800" height="650" fill="#fff"/><g font-family="Arial,sans-serif" fill="#142820"><text x="60" y="35" font-size="20">MEMO STUDIO / CITY MAKER</text><text x="60" y="59" font-size="13">'+option.typology.toUpperCase()+' / CONCEPT MASSING · '+option.metrics.floors+' FLOORS</text>'+poly(p,'#f2f4ef','#233b30')+poly(result.parcel.buildableBoundary,'none','#a39875','6 4')+option.blocks.map(b=>poly(b.polygon,'#729785','#28473a')).join('')+'<text x="60" y="597" font-size="13">Homes (estimate): '+option.metrics.homes+' · Residents (estimate): '+option.metrics.estimatedResidents+' · FAR (massing): '+round(option.metrics.FAR)+'</text><text x="60" y="623" font-size="11">Local feet · schematic footprints · not surveyed or approved</text></g></svg>';
}
const artifacts=new Map();
async function prune(max=12){for(const [id,a] of artifacts)if(Date.now()-a.created>3600000||artifacts.size>max){artifacts.delete(id);await unlink(a.path).catch(()=>{});}}
export async function lookupCityExport(id){await prune();return artifacts.get(id);}
export function registerCityTools(server,{workdir,httpMode,publicBase}){
  const add=(name,description,inputSchema,fn)=>server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async args=>{
    try{return {content:[{type:'text',text:JSON.stringify(await fn(args))}]};}
    catch(e){return {isError:true,content:[{type:'text',text:'City Maker: '+(e instanceof z.ZodError?'invalid inputs':e.message.slice(0,240))}]};}
  });
  const common={parcel:parcelSchema,brief:briefSchema.optional()},selection={...common,optionId:z.string().regex(/^[a-f0-9]{16}$/)};
  const select=args=>{const r=generateOptions(args.parcel,args.brief),option=r.options.find(o=>o.id===args.optionId);if(!option)throw Error('Option not found; use unchanged parcel and brief inputs');return {r,option};};
  add('analyze_parcel','Analyze a strictly convex polygon in local feet and calculate a uniform setback envelope. No geographic or zoning lookup.',{parcel:parcelSchema},({parcel})=>analyzeParcel(parcel));
  add('create_city_brief','Validate caller-provided zoning and residential program assumptions, including unit mix.',{brief:briefSchema.optional()},({brief})=>({brief:createBrief(brief),caveat}));
  add('generate_city_options','Generate up to five deterministic conceptual massing proposals and estimated program metrics for a local convex parcel.',common,({parcel,brief})=>generateOptions(parcel,brief));
  add('compare_city_options','Rank regenerated massing proposals by population, gross massing area, unbuilt site area or target proximity.',{...common,objective:z.enum(['population','area','openSpace','target']).default('population')},({parcel,brief,objective})=>{const r=generateOptions(parcel,brief);return {objective,ranked:compareOptions(r,objective),rejected:r.rejected,caveat};});
  add('get_city_proposal','Retrieve a generated proposal with real conceptual extrusion geometry, footprints and estimated program; not detailed BIM.',selection,args=>{const {r,option}=select(args);return {schema:r.schema,parcel:r.parcel,brief:r.brief,option,caveat};});
  add('export_city_proposal','Export the selected conceptual massing as JSON geometry or SVG plan; no detailed IFC or geospatial export.',{...selection,format:z.enum(['json','svg'])},async args=>{
    const {r,option}=select(args),format=args.format,body=format==='svg'?planSvg(r,option):JSON.stringify({schema:r.schema,parcel:r.parcel,brief:r.brief,option,caveat},null,2);
    await prune(11);const id=randomUUID(),path=join(workdir,id+'.'+format),filename='MEMO-City-'+option.id+'.'+format;
    await writeFile(path,body,{flag:'wx'});artifacts.set(id,{path,filename,format,created:Date.now()});
    return {format,optionId:option.id,bytes:Buffer.byteLength(body),...(httpMode?{downloadUrl:publicBase?publicBase+'/city-exports/'+id:null}:{localPath:path}),expiresInSeconds:3600,mayEvictEarlier:true,caveat};
  });
}
