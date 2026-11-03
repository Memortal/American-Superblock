// Courtyard polygons can have a different start vertex or winding than corridors.
// Match nested offset corners spatially; never pair unrelated polygon indices.
export function serviceBand(building,outer=true,fraction=.22){
 const base=outer?building.corridorOuter:building.corridorInner,target=outer?building.outer:building.courtyard;
 if(!base?.length||!target?.length)return [];
 return base.map(q=>{const p=target.reduce((best,v)=>Math.hypot(v[0]-q[0],v[1]-q[1])<Math.hypot(best[0]-q[0],best[1]-q[1])?v:best,target[0]);return q.map((v,k)=>v+(p[k]-v)*fraction);});
}
