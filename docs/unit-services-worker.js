import {generateMEP} from './mep-network.js';
let data;
self.onmessage=({data:request})=>{try{if(!data)data=generateMEP(request.model);const {lo,hi}=request,edges=data.edges.filter(e=>!e.blocked&&!e.sharedRiser&&e.route.some((b,i)=>{if(!i)return false;const a=e.route[i-1];return a.every((v,j)=>Math.min(v,b[j])<=hi[j]&&Math.max(v,b[j])>=lo[j]);}));self.postMessage({id:request.id,edges});}catch(e){self.postMessage({id:request.id,error:e.message});}};
