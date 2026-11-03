import unittest,tempfile,json,pathlib,copy
from engine import *
def sample():
 return {'id':'B1-wall-a','generator':VERSION,'building':'B1','level':0,'category':'ARCHITECTURE','ifcClass':'IFCWALL','transform':[12,34,0],'shape':{'type':'profile_set','parts':[{'polygon':[[0,0],[10,0],[10,1],[0,1]],'holes':[],'z':0,'height':9}]},'geometryHash':'test','properties':{'role':'Wall'},'validation':{'profileErrors':[],'status':'unresolved'}}
class Contract(unittest.TestCase):
 def test_volume_and_units(self):self.assertAlmostEqual(descriptor_check(sample()),90*.3048**3)
 def test_hash_placement_independent(self):
  a=sample();b=copy.deepcopy(a);b['transform']=[800,900,0];self.assertEqual(digest(a['shape']),digest(b['shape']))
 def test_hole_volume(self):
  a=sample();a['shape']['parts'][0]['polygon']=[[0,0],[10,0],[10,10],[0,10]];a['shape']['parts'][0]['holes']=[[[2,2],[4,2],[4,4],[2,4]]];self.assertAlmostEqual(descriptor_check(a),96*9*.3048**3)
 def test_bad_height(self):
  a=sample();a['shape']['parts'][0]['height']=-1
  with self.assertRaises(ValueError):descriptor_check(a)
 def test_bad_hole(self):
  a=sample();a['shape']['parts'][0]['holes']=[[[20,20],[21,20],[21,21],[20,21]]]
  with self.assertRaises(ValueError):descriptor_check(a)
 def test_nan(self):
  a=sample();a['transform'][0]=float('nan')
  with self.assertRaises(ValueError):descriptor_check(a)
 def test_unsupported(self):
  a=sample();a['shape']={'type':'dimensioned_route'}
  with self.assertRaises(Unsupported):descriptor_check(a)
 def test_atomic(self):
  with tempfile.TemporaryDirectory() as t:
   p=pathlib.Path(t)/'state.json';atomic_json(p,{'revision':1});atomic_json(p,{'revision':2});self.assertEqual(json.loads(p.read_text())['revision'],2)
 @unittest.skipUnless(capabilities()['nativeReady'],'Native usd_brep / pxr runtime absent')
 def test_native_roundtrip_cache(self):
  with tempfile.TemporaryDirectory() as t:
   a=build_shape(sample(),t);b=build_shape(sample(),t);self.assertEqual(a['solidCount'],1);self.assertFalse(a['cacheHit']);self.assertTrue(b['cacheHit'])
 @unittest.skipUnless(capabilities()['ifcReady'],'IfcOpenShell runtime absent')
 def test_ifc_roundtrip(self):
  with tempfile.TemporaryDirectory() as t:
   result=ifc_export([sample()],t);self.assertEqual(result['elements'],1);self.assertEqual(result['schemaErrors'],[])
if __name__=='__main__':unittest.main(verbosity=2)
