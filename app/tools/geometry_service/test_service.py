import unittest,subprocess,tempfile,os,sys,secrets,time,json,urllib.request,urllib.error,socket
from test_engine import sample
class Service(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();cls.token=secrets.token_urlsafe(36)
  s=socket.socket();s.bind(('127.0.0.1',0));cls.port=s.getsockname()[1];s.close()
  cls.proc=subprocess.Popen([sys.executable,'service.py'],cwd=os.path.dirname(__file__),env={**os.environ,'PORT':str(cls.port),'GEOMETRY_STORAGE':cls.temp.name,'GEOMETRY_SERVICE_TOKEN':cls.token},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  for _ in range(50):
   try:cls.call('/geometry/capabilities');break
   except OSError:time.sleep(.1)
 @classmethod
 def tearDownClass(cls):cls.proc.terminate();cls.proc.wait(timeout=10);cls.temp.cleanup()
 @classmethod
 def call(cls,path,data=None,auth=True):
  req=urllib.request.Request('http://127.0.0.1:'+str(cls.port)+path,data=json.dumps(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+cls.token} if auth else {})
  try:
   with urllib.request.urlopen(req,timeout=10) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
 def test_auth(self):self.assertEqual(self.call('/geometry/capabilities',auth=False)[0],401)
 def test_capabilities(self):self.assertIn('nativeReady',self.call('/geometry/capabilities')[1])
 def test_missing_runtime_is_not_success(self):
  caps=self.call('/geometry/capabilities')[1]
  if not caps['nativeReady']:self.assertEqual(self.call('/export/usd',{'elements':[sample()]})[0],503)
 def test_validate_job(self):
  status,r=self.call('/geometry/validate',{'elements':[sample()],'revision':'test'});self.assertEqual(status,202)
  for _ in range(50):
   _,state=self.call('/geometry/status/'+r['jobId'])
   if state['status'] not in ('queued','running'):break
   time.sleep(.1)
  self.assertEqual(state['status'],'complete');_,manifest=self.call('/geometry/manifest/'+r['jobId']);self.assertEqual(manifest['metrics']['processed'],1)
  if not self.call('/geometry/capabilities')[1]['nativeReady']:self.assertEqual(manifest['metrics']['validatedElements'],0)
 def test_no_path_traversal(self):self.assertEqual(self.call('/geometry/artifact/not-a-uuid/../secret')[0],400)
 def test_step_explicit(self):self.assertEqual(self.call('/export/step',{'elements':[sample()]})[0],422)
if __name__=='__main__':unittest.main(verbosity=2)
