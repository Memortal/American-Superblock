import { z } from 'zod';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { normalizeParameters } from './architecture.mjs';
import { createDesign } from './design-versions.mjs';
import { createModelLoader, efficiency, egress } from './analysis.mjs';

const params=z.object({setback:z.number().int().min(8).max(40).optional(),runPerStorey:z.number().min(0).max(4).optional(),stepFloors:z.number().int().min(1).max(3).optional()}).strict();
const full=params.required();
const constraints=z.object({minHomes:z.number().int().min(0).max(100000).optional(),minResidentialSf:z.number().min(0).max(100000000).optional(),maxVShiftFt:z.number().min(0).max(200).optional()}).strict();
const weights=z.object({homes:z.number().min(0).max(10),area:z.number().min(0).max(10),lowShift:z.number().min(0).max(10)}).strict();
const config=z.object({baseline:params.default({}),constraints:constraints.default({}),weights:weights.default({homes:3,area:2,lowShift:1}),budget:z.number().int().min(2).max(8).default(4),vary:z.array(z.enum(['setback','runPerStorey','stepFloors'])).min(1).max(3).default(['setback','runPerStorey','stepFloors'])}).strict();
const metric=z.object({homes:z.number().int().nonnegative(),residentialBasePlanSf:z.number().nonnegative(),maxVShiftFt:z.number().nonnegative(),egressStatus:z.string().max(150)}).strict();
const trial=z.object({parameters:full,metrics:metric.nullable(),failure:z.string().max(150).nullable()}).strict();
const stateSchema=z.object({schema:z.literal('memo-design-study-1'),config,created:z.number().int(),trials:z.array(trial).max(8)}).strict();
const key=p=>JSON.stringify([p.setback,p.runPerStorey,p.stepFloors]);
const round=x=>Math.round(x*1e6)/1e6;
const fixedSteps={setback:[2,-2,1,-1,4,-4,8,-8],runPerStorey:[-.5,.5,-.25,.25,-1,1,-2,2],stepFloors:[-1,1,-2,2]};
const ranges={setback:[8,40],runPerStorey:[0,4],stepFloors:[1,3]};
export function startStudy(input,now=Date.now()){
  const c=config.parse(input);c.baseline=normalizeParameters(c.baseline);c.vary=[...new Set(c.vary)];
  if(!Object.values(c.weights).some(v=>v>0))throw Error('At least one objective weight must be positive');
  return {schema:'memo-design-study-1',config:c,created:now,trials:[]};
}
function baselineMetrics(s){return s.trials[0]?.metrics;}
export function assess(m,baseline,c){
  const v=c.constraints,w=c.weights;
  const checks=[
    ['minHomes',v.minHomes,m.homes,(x,t)=>x>=t,(x,t)=>Math.max(0,t-x)/Math.max(1,t)],
    ['minResidentialSf',v.minResidentialSf,m.residentialBasePlanSf,(x,t)=>x>=t,(x,t)=>Math.max(0,t-x)/Math.max(1,t)],
    ['maxVShiftFt',v.maxVShiftFt,m.maxVShiftFt,(x,t)=>x<=t,(x,t)=>Math.max(0,x-t)/Math.max(1,t)]
  ].filter(x=>x[1]!==undefined).map(([constraint,target,actual,pass,violation])=>({constraint,target,actual,pass:pass(actual,target),violation:violation(actual,target)}));
  const score=(w.homes*(m.homes-baseline.homes)/Math.max(1,baseline.homes)+w.area*(m.residentialBasePlanSf-baseline.residentialBasePlanSf)/Math.max(1,baseline.residentialBasePlanSf)-w.lowShift*(m.maxVShiftFt-baseline.maxVShiftFt)/Math.max(1,baseline.maxVShiftFt))/(w.homes+w.area+w.lowShift);
  return {score:round(score),feasible:checks.every(x=>x.pass),violation:round(checks.reduce((n,x)=>n+x.violation,0)),checks};
}
export function ranked(s){
  const base=baselineMetrics(s);if(!base)return [];
  return s.trials.flatMap((t,i)=>t.metrics?[{index:i+1,...t,...assess(t.metrics,base,s.config)}]:[]).sort((a,b)=>Number(b.feasible)-Number(a.feasible)||a.violation-b.violation||b.score-a.score||a.index-b.index);
}
export function nextCandidate(s){
  if(s.trials.length>=s.config.budget)return null;
  if(!s.trials.length)return s.config.baseline;
  if(!baselineMetrics(s))return null;
  const tried=new Set(s.trials.map(t=>key(t.parameters))),best=ranked(s)[0].parameters;
  // Round-robin across permitted dimensions before trying smaller/larger moves.
  const dims=s.config.vary;
  const ordered=[...dims.slice((s.trials.length-1)%dims.length),...dims.slice(0,(s.trials.length-1)%dims.length)];
  for(const origin of [best,s.config.baseline])for(let i=0;i<8;i++)for(const dim of ordered){
    const delta=fixedSteps[dim][i];if(delta===undefined)continue;
    const [lo,hi]=ranges[dim],value=origin[dim]+delta;
    if(value<lo||value>hi)continue;
    const p=normalizeParameters({...origin,[dim]:value});
    if(!tried.has(key(p)))return p;
  }
  return null;
}
export function summarize(s){
  const r=ranked(s),next=nextCandidate(s);
  return {status:!s.trials.length?'awaiting_baseline':!baselineMetrics(s)?'baseline_failed':next?'ready_for_next_trial':'search_complete',evaluated:s.trials.length,budget:s.config.budget,remaining:s.config.budget-s.trials.length,config:s.config,ranked:r,failed:s.trials.flatMap((t,i)=>t.failure?[{index:i+1,parameters:t.parameters,reason:t.failure}]:[]),bestFeasible:r.find(x=>x.feasible)||null,nextCandidate:next,limitations:['Only the three supported architectural parameters are varied.','Constraints are numeric schedule/geometry constraints, not engineering or code checks.','Egress and MEP remain unresolved when the V-section invalidates routes.','Local bounded coordinate search; no global optimum is guaranteed.']};
}
export async function advanceStudy(s,evaluate){
  const p=nextCandidate(s);if(!p)throw Error('Study has no next trial');
  let result;
  try{result={parameters:p,metrics:metric.parse(await evaluate(p)),failure:null};}
  catch{result={parameters:p,metrics:null,failure:'Model generation or metric evaluation failed'};}
  return {...s,trials:[...s.trials,result]};
}
export function selectStudy(s){
  const summary=summarize(s);
  const selected=summary.bestFeasible;
  return {status:!selected?'no_feasible_design':'selected_for_review',complete:!summary.nextCandidate,selected,designManifest:selected?createDesign(selected.parameters):null,selectionBasis:'Highest-scoring evaluated candidate satisfying the specified numeric constraints; ties retain earliest trial. This is not construction approval.',summary};
}
export function createCodec(secret=randomBytes(32)){
  const sign=b=>createHmac('sha256',secret).update(b).digest();
  return {
    encode(s){const b=Buffer.from(JSON.stringify(stateSchema.parse(s))).toString('base64url');return b+'.'+sign(b).toString('base64url');},
    decode(token,now=Date.now()){
      if(typeof token!=='string'||token.length>32000||!(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/).test(token))throw Error('Invalid study token');
      const [b,sig]=token.split('.'),actual=Buffer.from(sig,'base64url'),expected=sign(b);
      if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('Study token invalid or server restarted');
      const s=stateSchema.parse(JSON.parse(Buffer.from(b,'base64url').toString('utf8')));
      if(s.created>now+60000||now-s.created>86400000)throw Error('Study token expired');
      if(s.trials.length>s.config.budget)throw Error('Invalid study budget');
      return s;
    }
  };
}
const configuredSecret=process.env.STUDY_SIGNING_KEY;
if(configuredSecret&&configuredSecret.length<32)throw Error('STUDY_SIGNING_KEY must contain at least 32 characters');
const codec=createCodec(configuredSecret||randomBytes(32));
const token=z.string().min(20).max(32000);
export function registerStudyTools(server,{snapshot,withBrowser,workdir,caveat}){
  const load=createModelLoader({snapshot,withBrowser,workdir});
  const evaluate=async p=>{
    const d=await load(p),m=efficiency(d),shift=d.vSection?.maxShift;
    return {homes:m.homes,residentialBasePlanSf:m.residentialBasePlanSf,maxVShiftFt:shift,egressStatus:egress(d).status};
  };
  const add=(name,description,inputSchema,fn)=>server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:false}},async args=>{
    try{return {content:[{type:'text',text:JSON.stringify({...await fn(args),caveat})}]};}
    catch(e){console.error(name,e.message);return {isError:true,content:[{type:'text',text:'Study operation failed: '+(e instanceof z.ZodError?'invalid study inputs':e.message.slice(0,180))}]};}
  });
  const report=s=>({studyToken:codec.encode(s),...summarize(s),tokenLifetimeHours:24,restartSafe:!!configuredSecret});
  add('start_design_study','Create a bounded design study with numeric goals, allowed design parameters and an evaluation budget of 2–8. No geometry generated yet. Retain returned studyToken.',config.shape,async args=>report(startStudy(args)));
  add('advance_design_study','Evaluate exactly one automatically chosen candidate using real browser geometry. Returns signed updated studyToken and next proposal. Call again only with latest token; no background jobs.',{studyToken:token},async({studyToken})=>report(await advanceStudy(codec.decode(studyToken),evaluate)));
  add('get_design_study','Read signed study history, ranked trials, failures, progress and best feasible candidate without a browser build.',{studyToken:token},async({studyToken})=>report(codec.decode(studyToken)));
  add('propose_next_design','Preview the automatically selected next candidate and search budget without evaluating it.',{studyToken:token},async({studyToken})=>{const s=codec.decode(studyToken);return {parameters:nextCandidate(s),evaluated:s.trials.length,budget:s.config.budget,method:'Bounded adaptive coordinate search around the best evaluated design'};});
  add('finish_design_study','Select best evaluated feasible design for human review, return a V3 manifest for views and variant IFC/JSON export. May finish early; does not publish or modify original.',{studyToken:token},async({studyToken})=>selectStudy(codec.decode(studyToken)));
}
