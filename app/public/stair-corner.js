// Place the 8 x 15 ft internal switchback stair against a true unit corner.
// All coordinates in the horizontal BIM plane (feet); no rendering dependencies.
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const area=poly=>poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+a[0]*b[1]-b[0]*a[1]},0)/2;
function inside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>p[1])!==(poly[j][1]>p[1])&&p[0]<(poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])hit=!hit;return hit;}
function clearRect(poly,origin,u,v,width,length){
 const at=(x,y)=>[origin[0]+u[0]*x+v[0]*y,origin[1]+u[1]*x+v[1]*y];
 // Sample the boundary and interior so non-convex and recessed footprints remain clear.
 for(let i=0;i<=8;i++)for(let j=0;j<=12;j++)if(!inside(at(width*i/8,length*j/12),poly))return false;
 return true;
}
export function chooseCornerStair(poly,entry=null,width=8,length=15){
 if(!poly||poly.length<3)return null;
 const ring=area(poly)<0?[...poly].reverse():poly;
 const options=[];
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],edgeLength=distance(a,b);
  if(edgeLength<width+1.5)continue;
  const u=[(b[0]-a[0])/edgeLength,(b[1]-a[1])/edgeLength],v=[-u[1],u[0]];
  // Start near either end of a side; the rectangle always extends toward the unit interior.
  // The reverse-end placement has to use the preceding edge's inward orientation.
  for(const pad of [.75,1.25,2]){
   const origin=[a[0]+u[0]*pad+v[0]*pad,a[1]+u[1]*pad+v[1]*pad];
   if(!clearRect(ring,origin,u,v,width,length))continue;
   const nearest=Math.min(...ring.map(q=>distance(q,origin)));
   const center=[origin[0]+u[0]*width/2+v[0]*length/2,origin[1]+u[1]*width/2+v[1]*length/2];
   const entryDist=entry?distance(center,entry):25;
   options.push({origin,u,v,width,length,openingSF:96,placement:'corner',cornerDistanceFt:nearest,score:nearest+Math.max(0,9-entryDist)*5});
  }
 }
 options.sort((a,b)=>a.score-b.score);
 return options[0]||null;
}
