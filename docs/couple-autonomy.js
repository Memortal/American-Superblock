/* MEMO Couple Living Lab — autonomous, deterministic household experiment.
   NOT an online purchaser or LLM. All purchases are hypothetical intentions.
   Every suggested object remains a proxy until its exact supplier model is verified. */
import {coupleDay,repairDoorFurnitureClashes,inspectFunctionalLayout,findFurnitureLocation,validateNewFurniture} from './furnishing-engine.js';

export const COUPLE_NEEDS=[
 {day:2,id:'work-desk',kind:'desk',label:'Compact work desk',widthFt:3,depthFt:1.6,heightFt:2.5,clearanceFt:3,search:'small writing desk'},
 {day:4,id:'reading-lamp',kind:'lamp',label:'Reading floor lamp',widthFt:.9,depthFt:.9,heightFt:5,clearanceFt:1.5,search:'reading floor lamp'},
 {day:6,id:'bookshelf',kind:'cabinet',label:'Bookshelf',widthFt:2.8,depthFt:1.1,heightFt:6,clearanceFt:2.5,search:'narrow bookshelf'},
 {day:8,id:'additional-seating',kind:'chair',label:'Second lounge chair',widthFt:2.4,depthFt:2.4,heightFt:3,clearanceFt:2,search:'lounge chair'},
 {day:12,id:'bedside-storage',kind:'cabinet',label:'Bedside storage',widthFt:1.6,depthFt:1.4,heightFt:2.3,clearanceFt:2,search:'bedside table'}
];
const unique=(xs)=>[...new Set(xs)];
export function createCoupleAutonomy(g,{days=14}={}){
 const furniture=[],journal=[],orders=[],rejects=[],snapshots=[],baselineSnapshot=structuredClone(g.objects);
 let day=0,stopped=false;
 const done=new Set();
 function step(){
  if(stopped||day>=days)return null;
  day++;
  const before=inspectFunctionalLayout(g,furniture);
  let repairs={repairs:[],unresolved:[]};
  if(day===1)repairs=repairDoorFurnitureClashes(g);
  const need=COUPLE_NEEDS.find(n=>n.day===day);
  if(need){
   const candidate={...need,id:'autonomy-'+need.id};
   const present=g.objects.concat(furniture).some(o=>o.id===candidate.id);
   if(!present){
    const position=findFurnitureLocation(g,candidate,{level:0,additional:furniture});
    if(position){
     const obj={...position.object,rotationDeg:position.rotation,source:'MEMO household-generated proxy',exactManufacturerModel:false,sourceProductUrl:null,simulationOrder:true};
     const fit=validateNewFurniture(g,{...candidate,widthFt:obj.w,depthFt:obj.d},obj.x,obj.y,0,furniture);
     if(fit.valid){
      furniture.push(obj);done.add(need.id);
      orders.push({day,product:need.label,category:need.kind,search:need.search,status:'simulated selection — not ordered or purchased',objectId:obj.id,dimensionsFt:[obj.w,obj.d,obj.h]});
     }else rejects.push({day,product:need.label,reason:fit.reasons.join('; ')});
    }else rejects.push({day,product:need.label,reason:'No collision-free position with a reachable operation zone'});
   }
  }
  const life=coupleDay(g,day,furniture),after=inspectFunctionalLayout(g,furniture);
  const result={
   day,residents:life.residents.map(x=>({resident:x.resident,walkFt:x.walkFt,unreachable:x.unreachable,path:x.segments})),
   repaired:repairs.repairs.length,repairUnresolved:repairs.unresolved.length,
   doorClashes:after.issues.filter(x=>x.type==='door-clearance').length,
   physicalClashes:after.issues.filter(x=>x.type==='overlap').length,
   blockedRooms:after.blockedRooms.length,inaccessible:after.inaccessible.length,
   worseThanBaseline:after.issues.length>before.issues.length,
   shopping:orders.filter(o=>o.day===day),rejects:rejects.filter(o=>o.day===day),
   note:'Automatic deterministic simulation; shopping is simulated'
  };
  journal.push({day,walkingFt:life.residents.map(r=>r.walkFt),unreachable:life.residents.map(r=>r.unreachable),orders:result.shopping,rejects:result.rejects,collisions:after.issues.length});
  snapshots.push(result);
  return result;
 }
 function report(){
  const last=snapshots.at(-1),failures=unique(rejects.map(x=>x.product));
  return {daysCompleted:day,simulatedResidents:2,originalFurniture:baselineSnapshot.length,
   addedFurniture:furniture.length,simulatedSelections:orders.length,realPurchases:0,
   rejectedItems:rejects.length,unresolvedProducts:failures,
   accessibilityVerified:false,manufacturerModelsVerified:false,
   lastDay:last?{day:last.day,doorClashes:last.doorClashes,physicalClashes:last.physicalClashes,blockedRooms:last.blockedRooms,inaccessible:last.inaccessible,unreachableRoutes:last.residents.reduce((s,r)=>s+r.unreachable.length,0)}:null,
   warnings:['Furniture collision and path checks are schematic and may be conservative','Product suggestions are generic proxies, not verified manufacturer SKUs','No external order, payment, tracking, or third-party account access']};
 }
 return {step,report,get day(){return day},get furniture(){return furniture},get snapshots(){return snapshots},get orders(){return orders},get rejects(){return rejects},get journal(){return journal},stop:()=>stopped=true,export:()=>({version:1,report:report(),days:journal,orders,rejected:rejects,simulatedFurniture:furniture})};
}
export function autonomousAcceptanceTests(g){
 const results=[];
 const oversized={id:'QA-oversized',kind:'sofa',widthFt:Math.max(100,g.W+20),depthFt:12,heightFt:3,clearanceFt:2.5};
 const big=findFurnitureLocation(g,oversized,{level:0});
 results.push({name:'Oversized object must be rejected',passed:big===null});
 const atDoor=(g.doors||[])[0];
 if(atDoor){
  const blocked=validateNewFurniture(g,{id:'QA-door-blocker',kind:'cabinet',widthFt:Math.min(3,g.W/3),depthFt:2,heightFt:4},atDoor.x,atDoor.y,atDoor.level);
  results.push({name:'Door approach cannot be occupied',passed:!blocked.valid});
 }
 const baseline=inspectFunctionalLayout(g);
 results.push({name:'Existing collision report is available',passed:Array.isArray(baseline.issues)&&Array.isArray(baseline.rooms)});
 return results;
}
