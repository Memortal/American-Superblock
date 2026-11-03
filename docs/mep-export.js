export function mepIFC(d){
 const lines=[],add=(t,...a)=>{lines.push('#'+(lines.length+1)+'='+t+'('+a.join(',')+');');return '#'+lines.length;},q=s=>"'"+String(s??'').replaceAll("'","''").replace(/[^\x20-\x7e]/g,' ')+"'",num=v=>{const n=Number(v.toFixed(7)).toString();return /[.eE]/.test(n)?n:n+'.';},vec=a=>'('+a.map(num).join(',')+')',guid=()=>{const a='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';return '0'+Array.from({length:21},()=>a[Math.floor(Math.random()*64)]).join('');},id=()=>q(guid()),pt=a=>add('IFCCARTESIANPOINT',vec(a)),dir=a=>add('IFCDIRECTION',vec(a)),O=pt([0,0,0]),Z=dir([0,0,1]),X=dir([1,0,0]),axis=add('IFCAXIS2PLACEMENT3D',O,Z,X),place=add('IFCLOCALPLACEMENT','$',axis),ctx=add('IFCGEOMETRICREPRESENTATIONCONTEXT','$',q('Model'),'3','0.00001',axis,'$'),unit=add('IFCSIUNIT','*','.LENGTHUNIT.','$','.METRE.'),units=add('IFCUNITASSIGNMENT','('+unit+')'),project=add('IFCPROJECT',id(),'$',q('MEMO American Superblock MEP'),'$','$','$','$','('+ctx+')',units),site=add('IFCSITE',id(),'$',q('American Superblock'),'$','$',place,'$','$','.ELEMENT.','$','$','$','$','$'),building=add('IFCBUILDING',id(),'$',q('Coordinated MEP schematic'),'$','$',place,'$','$','.ELEMENT.','$','$','$');
 add('IFCRELAGGREGATES',id(),'$','$','$',project,'('+site+')');add('IFCRELAGGREGATES',id(),'$','$','$',site,'('+building+')');
 const systems=new Map(),contained=[],groups=new Map(),F=.3048;
 for(const s of d.systems){const ref=add('IFCDISTRIBUTIONSYSTEM',id(),'$',q(s.id),q(s.discipline),'$',q(s.id),'.NOTDEFINED.');systems.set(s.id,ref);groups.set(s.id,[]);}
 const body=(point,tangent,size,pipe)=>{
  const P=point.map(v=>v*F),D=tangent,ref=Math.abs(D[2])>.9?[1,0,0]:[-D[1],D[0],0],length=Math.hypot(...ref),xd=ref.map(v=>v/length),ax=add('IFCAXIS2PLACEMENT3D',pt(P),dir(D),dir(xd));
  const profile=pipe?add('IFCCIRCLEPROFILEDEF','.AREA.','$','$',num(size[0]*F/2)):add('IFCRECTANGLEPROFILEDEF','.AREA.','$','$',num(size[0]*F),num(size[1]*F));
  const solid=add('IFCEXTRUDEDAREASOLID',profile,ax,Z,num(size[2]*F)),repr=add('IFCSHAPEREPRESENTATION',ctx,q('Body'),q('SweptSolid'),'('+solid+')');return add('IFCPRODUCTDEFINITIONSHAPE','$','$','('+repr+')');
 };
 const metadata=(entity,m)=>{
  const props=Object.entries(m).filter(([,v])=>v!==undefined).map(([k,v])=>add('IFCPROPERTYSINGLEVALUE',q(k),'$','IFCLABEL('+q(v)+')','$'));
  const set=add('IFCPROPERTYSET',id(),'$',q('MEMO_MEP_Network'),'$','('+props.join(',')+')');add('IFCRELDEFINESBYPROPERTIES',id(),'$','$','$','('+entity+')',set);
 };
 for(const e of d.edges){if(e.blocked||e.sharedRiser)continue;for(let i=1;i<e.route.length;i++){
  const a=e.route[i-1],b=e.route[i],v=b.map((x,j)=>x-a[j]),length=Math.hypot(...v);if(length<.001)continue;
  const type=e.shape==='pipe'?'IFCPIPESEGMENT':e.shape==='duct'?'IFCDUCTSEGMENT':'IFCCABLECARRIERSEGMENT',rep=body(a,v.map(x=>x/length),[e.size,e.shape==='duct'?(e.height||e.size*.6):.15,length],e.shape==='pipe'),entity=add(type,id(),'$',q(e.id+'-'+i),'$','$',place,rep,q(e.id),'.NOTDEFINED.');
  contained.push(entity);groups.get(e.system).push(entity);metadata(entity,{SYSTEM:e.system,SUBSYSTEM:e.subsystem,BUILDING:e.building,LEVEL:e.level,SOURCE:e.source,DESTINATION:e.destination,SIZE_FT:e.size,FLOW_DIRECTION:e.flowDirection,SERVICE_TYPE:e.serviceType,ZONE:e.zone,DESIGN_FLOW:e.designFlow,FLOW_UNIT:e.designFlowUnit,SIZE_LABEL:e.sizeLabel,SIZING_STATUS:e.sizingStatus,GRAPH_EDGE:e.id,STATUS:'SCHEMATIC / NOT ENGINEERED'});
 }}
 for(const o of d.objects){if(o.blocked)continue;const rep=body([o.point[0],o.point[1],o.point[2]-o.size[2]/2],[0,0,1],[o.size[0],o.size[1],o.size[2]],false),entity=add('IFCFLOWTERMINAL',id(),'$',q(o.label),'$','$',place,rep,q(o.id));contained.push(entity);groups.get(o.system)?.push(entity);metadata(entity,{SYSTEM:o.system,BUILDING:o.building,LEVEL:o.level,GRAPH_NODE:o.node,SOURCE:o.source,DESTINATION:o.destination,STATUS:'PROVISIONAL'});}
 add('IFCRELCONTAINEDINSPATIALSTRUCTURE',id(),'$','$','$','('+contained.join(',')+')',building);
 for(const [system,refs] of groups)if(refs.length)add('IFCRELASSIGNSTOGROUP',id(),'$','$','$','('+refs.join(',')+')','$',systems.get(system));
 return "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('MEMO schematic MEP; graph connections in property sets; coordination review required'),'2;1');\nFILE_NAME('MEMO_MEP.ifc','"+new Date().toISOString()+"',('MEMO Studio'),('MEMO Studio'),'MEMO MEP','MEMO','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n"+lines.join('\n')+"\nENDSEC;\nEND-ISO-10303-21;";
}
