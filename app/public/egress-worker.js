// Register immediately so a request cannot be lost while modules are loading.
globalThis.window=globalThis;
const ready=Promise.all([import('./egress-engine.js'),import('./vendor/three.module.js')]);
self.onmessage=async({data})=>{try{const [{analyzeEgress},THREE]=await ready;self.postMessage({result:analyzeEgress(data.model,data.pieceId,data.level,data.settings,THREE)});}catch(error){self.postMessage({error:error.message});}};
