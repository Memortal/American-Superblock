const inside=(q,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>q[1])!==(r[j][1]>q[1])&&q[0]<(r[j][0]-r[i][0])*(q[1]-r[i][1])/(r[j][1]-r[i][1])+r[i][0])c=!c;return c;};
const key=q=>q.map(v=>v.toFixed(2)).join('|');
const boundary=(q,r)=>r.some((a,i)=>{const b=r[(i+1)%r.length],v=b.map((x,j)=>x-a[j]),d=v[0]**2+v[1]**2,t=Math.max(0,Math.min(1,((q[0]-a[0])*v[0]+(q[1]-a[1])*v[1])/(d||1)));return Math.hypot(q[0]-a[0]-v[0]*t,q[1]-a[1]-v[1]*t)<.1;});
// Four longitudinal lines / three bays, with transverse axes at architectural unit divisions.
export function donutGrid(model){const result=new Map(),lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
for(const b of model.buildings.filter(b=>b.id!=='CORE'&&b.courtyard?.length===b.outer.length)){const segments=[],lines=[],points=new Map();
 for(let i=0;i<b.outer.length;i++){const a=b.outer[i],z=b.outer[(i+1)%b.outer.length],c=b.courtyard[i],d=b.courtyard[(i+1)%b.outer.length],len=distance(a,z),u=z.map((v,k)=>(v-a[k])/len),project=q=>((q[0]-a[0])*u[0]+(q[1]-a[1])*u[1])/len;
 const edgeDistance=q=>Math.abs((q[0]-a[0])*u[1]-(q[1]-a[1])*u[0]);const values=[];
 for(const p of model.pieces.filter(p=>p.building===b.id&&p.kind==='outer-wing')){const near=p.polygon.filter(q=>edgeDistance(q)<.15);if(near.length>=2)for(const q of near)values.push(Math.max(0,Math.min(1,project(q))));}
 if(values.length<2)continue;
 const mid=lerp(a,z,.5),cc=b.courtyard.reduce((c,q)=>[c[0]+q[0]/b.courtyard.length,c[1]+q[1]/b.courtyard.length],[0,0]),n=[-u[1],u[0]];if((cc[0]-mid[0])*n[0]+(cc[1]-mid[1])*n[1]<0){n[0]*=-1;n[1]*=-1;}const depths=b.courtyard.map((q,k)=>{const r=b.courtyard[(k+1)%b.courtyard.length],v=[r[0]-q[0],r[1]-q[1]],l=Math.hypot(...v);return Math.abs((v[0]*u[0]+v[1]*u[1])/l)>.999?((q[0]-mid[0])*n[0]+(q[1]-mid[1])*n[1]):Infinity;}).filter(x=>x>0),depth=Math.min(...depths);if(!Number.isFinite(depth))continue;const ts=[...new Set(values.map(t=>Math.round(t*100000)/100000))].sort((a,b)=>a-b);const rows=ts.map(t=>Array.from({length:4},(_,j)=>{const q=lerp(a,z,t);return [q[0]+n[0]*depth*[0,20/65,45/65,1][j],q[1]+n[1]*depth*[0,20/65,45/65,1][j]];}));
 rows.forEach((row,k)=>{lines.push({id:b.id+'-W'+(i+1)+'-'+(k+1),label:'W'+(i+1)+'.'+(k+1),a:row[0],b:row[3],role:'DEMISING',wing:i});row.forEach(q=>points.set(q.map(v=>v.toFixed(2)).join('|'),q));for(let j=1;j<4;j++)segments.push({a:row[j-1],b:row[j],wing:i});});
 for(let j=0;j<4;j++){lines.push({id:b.id+'-W'+(i+1)+'-'+String.fromCharCode(65+j),label:'W'+(i+1)+String.fromCharCode(65+j),a:rows[0][j],b:rows.at(-1)[j],role:j===0||j===3?'EXTERIOR':'LONGITUDINAL',wing:i});for(let k=1;k<rows.length;k++)segments.push({a:rows[k-1][j],b:rows[k][j],wing:i});}
 }
 const cornerApproved=new Set(),offices=model.pieces.filter(p=>p.building===b.id&&p.office&&p.cornerGrid),cornerPoints=[];
 for(const [ci,p]of offices.entries()){const g=p.cornerGrid,at=(x,y)=>g.origin.map((v,i)=>v+g.u[i]*x+g.v[i]*y),rows=[0,20,45,65],core=model.pieces.find(q=>q.id===p.officeCoreId),local=[];
 for(const x of rows)for(const y of rows){const q=at(x,y);if((inside(q,p.officeEnvelope)||boundary(q,p.officeEnvelope))&&(!core||!inside(q,core.polygon))){cornerApproved.add(key(q));cornerPoints.push(q);local.push({x,y,q});}}
 for(const axis of ['x','y'])for(const v of rows){const line=local.filter(q=>q[axis]===v).sort((a,b)=>a[axis==='x'?'y':'x']-b[axis==='x'?'y':'x']);if(line.length<2)continue;lines.push({id:b.id+'-C'+ci+'-'+axis+v,label:'C'+(ci+1)+axis.toUpperCase()+v,a:line[0].q,b:line.at(-1).q,role:'CORNER-APPROVED'});for(let i=1;i<line.length;i++)segments.push({a:line[i-1].q,b:line[i].q,corner:true});}
 if(core){const c=core.core,at=(x,y)=>c.origin.map((v,i)=>v+c.u[i]*x+c.v[i]*y),qs=[[.75,11.75],[15.25,11.75],[15.25,35.25],[.75,35.25]].map(q=>at(...q));for(const q of qs){cornerApproved.add(key(q));cornerPoints.push(q);}for(let i=0;i<4;i++){const a=qs[i],z=qs[(i+1)%4];segments.push({a,b:z,corner:true});lines.push({id:core.id+'-S'+i,label:'S'+(ci+1)+'.'+(i+1),a,b:z,role:'STAIR-CORNER'});}}
 }
 const allowed=q=>!offices.some(p=>inside(q,p.officeEnvelope)||boundary(q,p.officeEnvelope))||cornerApproved.has(key(q));
 const approved=[...points.values()].filter(allowed);for(const q of cornerPoints)approved.push(q);const unique=new Map(approved.map(q=>[key(q),q]));
 result.set(b.id,{lines:lines.filter(l=>allowed(l.a)&&allowed(l.b)),segments:segments.filter(g=>allowed(g.a)&&allowed(g.b)),points:[...unique.values()],bays:3,cornerStations:cornerPoints,approvedCornerGrid:true});
}return result;}
