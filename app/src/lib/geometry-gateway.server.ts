// Native work stays off the Cloudflare Worker. Secrets never reach the browser.
export async function geometryGateway(request:Request,env:Record<string,string|undefined>):Promise<Response>{
 const headers={"content-type":"application/json","cache-control":"no-store"};
 const fail=(error:string,status:number)=>new Response(JSON.stringify({error}),{status,headers});
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\/native/,"");
 if(path==="/geometry/capabilities"&&(!env.GEOMETRY_SERVICE_URL||!env.GEOMETRY_SERVICE_TOKEN))
  return new Response(JSON.stringify({configured:false,nativeReady:false,ifcReady:false,stepReady:false,error:"No native Python geometry host is provisioned. Parametric capture, comparison and preview exports remain available."}),{headers});
 if(!env.GEOMETRY_SERVICE_URL||!env.GEOMETRY_SERVICE_TOKEN)return fail("Native service is not configured",503);
 if(!env.GEOMETRY_EDITOR_TOKEN)return fail("Geometry editor authentication is not configured",503);
 const expected=new TextEncoder().encode("Bearer "+env.GEOMETRY_EDITOR_TOKEN),provided=new TextEncoder().encode(request.headers.get("authorization")||"");
 const [a,b]=await Promise.all([crypto.subtle.digest("SHA-256",expected),crypto.subtle.digest("SHA-256",provided)]);
 const aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];if(diff)return fail("Editor authentication required",401);
 if(request.headers.get("origin")&&request.headers.get("origin")!==url.origin)return fail("Cross-origin request rejected",403);
 if(!/^\/(geometry\/(capabilities|generate|update|validate|status\/[a-f0-9-]+|manifest\/[a-f0-9-]+|cancel\/[a-f0-9-]+|artifact\/[a-f0-9-]+\/(superblock\.(usdc|ifc)|manifest\.json))|export\/(usd|ifc|step))$/.test(path))return fail("Unknown geometry operation",404);
 if(!["GET","POST"].includes(request.method))return fail("Method not allowed",405);
 const base=new URL(env.GEOMETRY_SERVICE_URL);if(base.protocol!=="https:"||base.username||base.password)return fail("Host must use HTTPS",503);
 const length=Number(request.headers.get("content-length")||0);if(length>64*1024*1024)return fail("Request too large",413);
 let body:ArrayBuffer|undefined;if(request.method==="POST"){body=await request.arrayBuffer();if(body.byteLength>64*1024*1024)return fail("Request too large",413);}
 try{
 const upstream=await fetch(new URL(path,base),{method:request.method,headers:{"authorization":"Bearer "+env.GEOMETRY_SERVICE_TOKEN,"content-type":"application/json"},body,redirect:"error",signal:AbortSignal.timeout(30000)});
 return new Response(upstream.body,{status:upstream.status,headers:{"content-type":upstream.headers.get("content-type")||"application/json","cache-control":"no-store",...(upstream.headers.get("content-disposition")?{"content-disposition":upstream.headers.get("content-disposition")!}:{})}});
 }catch{return fail("Native service unavailable or timed out",502);}
}

