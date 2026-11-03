"""Authenticated single-owner geometry service, bounded isolated native jobs.
No packages are fetched. Token and storage root are configured by the host.
"""
import os,sys,json,pathlib,uuid,time,threading,subprocess,hmac,urllib.parse
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from concurrent.futures import ThreadPoolExecutor
from engine import capabilities,process,atomic_json
ROOT=pathlib.Path(os.environ.get("GEOMETRY_STORAGE","/tmp/memo-geometry"))
LIMIT=64*1024*1024
def run_job(folder):
    payload=json.loads((folder/"request.json").read_text())
    def progress(n,total):atomic_json(folder/"status.json",{"status":"running","processed":n,"total":total})
    try:
        result=process(payload,folder,lambda:(folder/"cancel").exists(),progress)
        atomic_json(folder/"status.json",{"status":"complete","revision":payload.get("revision"),"metrics":result["metrics"],"artifacts":result["artifacts"]})
    except Exception as e:atomic_json(folder/"status.json",{"status":"cancelled" if isinstance(e,InterruptedError) else "failed","error":str(e)[:1500]})
def serve():
    token=os.environ.get("GEOMETRY_SERVICE_TOKEN","")
    if len(token)<32:raise SystemExit("GEOMETRY_SERVICE_TOKEN must contain at least 32 characters")
    os.umask(0o077);jobs=ROOT/"jobs";jobs.mkdir(parents=True,exist_ok=True)
    for file in jobs.glob("*/status.json"):
        if json.loads(file.read_text()).get("status") in ("queued","running"):atomic_json(file,{"status":"failed","error":"Interrupted by service restart; resubmit with cached geometry"})
    executor=ThreadPoolExecutor(max_workers=1);lock=threading.Lock();pending=set()
    def launch(jid):
        folder=jobs/jid
        try:
            if (folder/"cancel").exists():atomic_json(folder/"status.json",{"status":"cancelled"});return
            child=subprocess.Popen([sys.executable,__file__,"--job",str(folder)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            started=time.monotonic()
            while child.poll() is None:
                if (folder/"cancel").exists() or time.monotonic()-started>1800:
                    child.terminate()
                    try:child.wait(timeout=5)
                    except subprocess.TimeoutExpired:child.kill();child.wait()
                    atomic_json(folder/"status.json",{"status":"cancelled" if (folder/"cancel").exists() else "failed","error":"Cancelled or 30 minute execution limit"});break
                time.sleep(.3)
            if child.returncode and json.loads((folder/"status.json").read_text()).get("status")=="running":atomic_json(folder/"status.json",{"status":"failed","error":"Isolated native worker exited unexpectedly"})
        finally:
            with lock:pending.discard(jid)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def send(self,data,status=200):
            raw=json.dumps(data,allow_nan=False).encode();self.send_response(status);self.send_header("Content-Type","application/json");self.send_header("Content-Length",str(len(raw)));self.send_header("Cache-Control","no-store");self.end_headers();self.wfile.write(raw)
        def authorized(self):
            if not hmac.compare_digest(self.headers.get("Authorization",""),"Bearer "+token):self.send({"error":"Unauthorized"},401);return False
            return True
        def do_GET(self):
            if not self.authorized():return
            path=urllib.parse.urlsplit(self.path).path
            if path=="/geometry/capabilities":return self.send(capabilities())
            bits=path.strip("/").split("/")
            if len(bits)>=3 and bits[0]=="geometry" and bits[1] in ("status","manifest","artifact"):
                jid=bits[2]
                try:uuid.UUID(jid)
                except ValueError:return self.send({"error":"Invalid job ID"},400)
                folder=jobs/jid
                if bits[1]=="artifact":
                    if len(bits)!=4 or bits[3] not in ("superblock.usdc","superblock.ifc","manifest.json"):return self.send({"error":"Unknown artifact"},404)
                    file=folder/"manifest.json" if bits[3]=="manifest.json" else folder/"artifacts"/bits[3]
                    if not file.is_file():return self.send({"error":"Artifact not ready"},404)
                    self.send_response(200);self.send_header("Content-Type","application/octet-stream");self.send_header("Content-Length",str(file.stat().st_size));self.send_header("Content-Disposition",'attachment; filename="'+file.name+'"');self.end_headers()
                    with file.open("rb") as f:
                        while chunk:=f.read(1024*1024):self.wfile.write(chunk)
                    return
                file=folder/("status.json" if bits[1]=="status" else "manifest.json")
                if file.is_file():return self.send(json.loads(file.read_text()))
                return self.send({"error":"Job or manifest not found"},404)
            return self.send({"error":"Unknown endpoint"},404)
        def do_POST(self):
            if not self.authorized():return
            path=urllib.parse.urlsplit(self.path).path
            if path.startswith("/geometry/cancel/"):
                jid=path.rsplit("/",1)[-1]
                try:uuid.UUID(jid)
                except ValueError:return self.send({"error":"Invalid job ID"},400)
                if not (jobs/jid).exists():return self.send({"error":"Unknown job"},404)
                (jobs/jid/"cancel").touch();return self.send({"status":"cancellation_requested"})
            if path not in ("/geometry/generate","/geometry/update","/geometry/validate","/export/usd","/export/ifc","/export/step"):return self.send({"error":"Unknown endpoint"},404)
            try:
                length=int(self.headers.get("Content-Length","0"))
                if length<=0 or length>LIMIT:return self.send({"error":"Request limit: 64 MiB"},413)
                payload=json.loads(self.rfile.read(length),parse_constant=lambda s:(_ for _ in ()).throw(ValueError("Nonfinite JSON")))
                if not isinstance(payload.get("elements"),list) or len(payload["elements"])>100000:raise ValueError("Invalid elements")
                fmt=path.rsplit("/",1)[-1] if path.startswith("/export/") else "validate" if path.endswith("validate") else payload.get("format","usd")
                if fmt not in ("usd","ifc","step","validate"):raise ValueError("Unsupported format")
                payload["format"]=fmt
            except (ValueError,TypeError,AttributeError) as e:return self.send({"error":str(e)},400)
            caps=capabilities()
            if fmt=="usd" and not caps["nativeReady"]:return self.send({"error":"Native runtime unavailable","capabilities":caps},503)
            if fmt=="ifc" and not caps["ifcReady"]:return self.send({"error":"IfcOpenShell unavailable"},503)
            if fmt=="step":return self.send({"error":"STEP conversion not configured"},422)
            with lock:
                if len(pending)>=4:return self.send({"error":"Queue full: maximum four jobs"},429)
                jid=str(uuid.uuid4());pending.add(jid)
            folder=jobs/jid;folder.mkdir();atomic_json(folder/"request.json",payload);atomic_json(folder/"status.json",{"status":"queued","total":len(payload["elements"])})
            executor.submit(launch,jid);self.send({"jobId":jid,"status":"queued"},202)
    ThreadingHTTPServer((os.environ.get("GEOMETRY_BIND","127.0.0.1"),int(os.environ.get("PORT","8090"))),Handler).serve_forever()
if __name__=="__main__":
    if len(sys.argv)==3 and sys.argv[1]=="--job":run_job(pathlib.Path(sys.argv[2]))
    else:serve()

