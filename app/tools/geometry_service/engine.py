"""MEMO native geometry worker. No network or dependency installation at runtime.
Run under a provisioned CPython 3.12 image with NVIDIA usd-brep + OpenUSD + IfcOpenShell.
Unsupported geometry remains in the coverage manifest; it is never replaced with boxes.
"""
import hashlib,json,math,os,pathlib,time,tempfile,shutil,resource,uuid,importlib.util
FT=.3048
VERSION="MEMO-GEOMETRY-2"
class Unsupported(ValueError):pass
def canonical(v):
    def clean(v):
        if isinstance(v,dict):return {k:clean(v[k]) for k in sorted(v)}
        if isinstance(v,list):return [clean(x) for x in v]
        if isinstance(v,float):
            if not math.isfinite(v):raise ValueError("Nonfinite number")
            v=round(v,8)
            return int(v) if v.is_integer() else v
        return v
    return json.dumps(clean(v),sort_keys=True,separators=(",",":"),ensure_ascii=False)
def digest(v):return hashlib.sha256(canonical(v).encode()).hexdigest()
def atomic_json(path,data):
    path=pathlib.Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w",dir=path.parent,delete=False) as f:json.dump(data,f,allow_nan=False);tmp=f.name
    os.replace(tmp,path)
def capabilities():
    modules={n:bool(importlib.util.find_spec(n)) for n in ["usd_brep","pxr","ifcopenshell","OCP"]}
    return {"python":__import__("sys").version.split()[0],"modules":modules,"nativeReady":modules["usd_brep"] and modules["pxr"],"ifcReady":modules["ifcopenshell"],"stepReady":False,"limitations":["STEP conversion adapter is not configured.","Tessellation from native solids is not implemented; browser preview remains parametric.","Kernel AssertValid and native mass properties are not yet integrated."]}
def area(r):return abs(sum(a[0]*r[(i+1)%len(r)][1]-r[(i+1)%len(r)][0]*a[1] for i,a in enumerate(r))/2)
def signed_area(r):return sum(a[0]*r[(i+1)%len(r)][1]-r[(i+1)%len(r)][0]*a[1] for i,a in enumerate(r))/2
def crossing(a,b,c,d):
    cross=lambda a,b,c:(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    return cross(a,b,c)*cross(a,b,d)<-1e-12 and cross(c,d,a)*cross(c,d,b)<-1e-12
def inside(q,r):
    yes=False
    for i,a in enumerate(r):
        b=r[(i+1)%len(r)]
        if (a[1]>q[1])!=(b[1]>q[1]) and q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0]:yes=not yes
    return yes
def descriptor_check(d):
    if not isinstance(d,dict) or not isinstance(d.get("id"),str) or len(d["id"])>500:raise ValueError("Invalid element identifier")
    if d.get("generator")!=VERSION:raise ValueError("Generator version mismatch")
    if len(d.get("transform",[]))!=3 or not all(math.isfinite(v) for v in d["transform"]):raise ValueError("Invalid placement")
    if d["shape"]["type"]!="profile_set":raise Unsupported("No native adapter for "+d["shape"]["type"])
    if not d["shape"].get("parts"):raise Unsupported("Empty profile set")
    if d.get("validation",{}).get("profileErrors"):raise ValueError("Client profile screening failed")
    volume=0
    for p in d["shape"]["parts"]:
        r=p["polygon"]
        if len(r)<3 or len(r)>20000:raise ValueError("Invalid profile vertex count")
        if not all(len(q)==2 and all(isinstance(x,(int,float)) and math.isfinite(x) for x in q) for q in r):raise ValueError("Invalid profile coordinate")
        if not math.isfinite(p["height"]) or p["height"]<=0 or not math.isfinite(p["z"]):raise ValueError("Invalid extrusion")
        if area(r)<1e-10:raise ValueError("Degenerate profile")
        for ring in [r,*p.get("holes",[])]:
            if len(ring)<3 or any(not math.isfinite(v) for q in ring for v in q):raise ValueError("Invalid ring")
            for i,a in enumerate(ring):
                for j in range(i+2,len(ring)):
                    if i==0 and j==len(ring)-1:continue
                    if crossing(a,ring[(i+1)%len(ring)],ring[j],ring[(j+1)%len(ring)]):raise ValueError("Self-intersecting profile")
        for hole in p.get("holes",[]):
            if not all(inside(q,r) for q in hole):raise ValueError("Hole lies outside outer profile")
        elevations=p.get("elevations")
        if elevations:
            if len(elevations)!=len(r) or not all(math.isfinite(v) for v in elevations):raise ValueError("Invalid elevations")
            a,b,c=r[:3];det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
            if abs(det)<1e-12:raise Unsupported("Sloped profile needs a non-collinear plane basis")
            dz1=elevations[1]-elevations[0];dz2=elevations[2]-elevations[0]
            gx=(dz1*(c[1]-a[1])-dz2*(b[1]-a[1]))/det;gy=((b[0]-a[0])*dz2-(c[0]-a[0])*dz1)/det
            if any(abs(elevations[i]-elevations[0]-gx*(q[0]-a[0])-gy*(q[1]-a[1]))>1e-6 for i,q in enumerate(r)):raise Unsupported("Nonplanar base requires a ruled-solid adapter")
            if p.get("holes"):raise Unsupported("Sloped holed profiles require exact trim coordination")
        volume+=(area(r)-sum(area(h) for h in p.get("holes",[])))*p["height"]*FT**3
    if not math.isfinite(volume) or volume<=0:raise ValueError("Non-positive analytic volume")
    return volume
def native_bodies(d,k):
    bodies=[]
    def sweep(r,z,h,elevations=None):
        pts=[(q[0]*FT,-q[1]*FT,(z+(elevations[i] if elevations else 0))*FT) for i,q in enumerate(r)]
        curves=[k.create_line_segment(pts[i],pts[(i+1)%len(pts)]) for i in range(len(pts))]
        return k.linear_sweep(curves,(0.,0.,1.),h*FT)
    for p in d["shape"]["parts"]:
        b=sweep(p["polygon"],p["z"],p["height"],p.get("elevations"))
        for hole in p.get("holes",[]):
            cutter=sweep(hole,p["z"]-.01,p["height"]+.02)
            b=k.booleans.boolean_difference(b,cutter)
        if not k.is_manifold_solid(b):raise ValueError("Kernel closed-manifold test failed")
        bodies.append(b)
    return bodies
def build_shape(d,cache):
    start=time.perf_counter();volume=descriptor_check(d)
    import usd_brep as k
    key=digest({"generator":VERSION,"shape":d["shape"]});folder=pathlib.Path(cache);folder.mkdir(parents=True,exist_ok=True)
    dst=folder/(key+".usdc");meta=folder/(key+".json")
    if dst.exists() and meta.exists():
        data=json.loads(meta.read_text())
        if data.get("fileHash")==hashlib.sha256(dst.read_bytes()).hexdigest():
            return {**data,"cacheHit":True,"seconds":time.perf_counter()-start}
    bodies=native_bodies(d,k);fd,tmp=tempfile.mkstemp(suffix=".usdc",dir=folder);os.close(fd)
    try:
        k.usd.export_breps(bodies,tmp)
        reread=k.usd.import_breps(tmp)
        if len(reread)!=len(bodies) or any(not k.is_manifold_solid(b) for b in reread):raise ValueError("Native round-trip validation failed")
        os.replace(tmp,dst)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
    data={"nativeHash":key,"file":dst.name,"fileHash":hashlib.sha256(dst.read_bytes()).hexdigest(),"solidCount":len(bodies),"analyticVolumeM3":volume,"status":"converted_validated","validationScope":"closed manifold + per-definition USD reimport; analytic volume, not native mass-property verification","bytes":dst.stat().st_size}
    atomic_json(meta,data);return {**data,"cacheHit":False,"seconds":time.perf_counter()-start}
def usd_master(descriptors,results,cache,out):
    from pxr import Usd,UsdGeom,Sdf,Gf
    if Usd.GetVersion()[:2]==(0,25):raise Unsupported("Use compatible OpenUSD 26.8; 25.11 may conflict with the bundled kernel")
    out=pathlib.Path(out);out.mkdir(parents=True,exist_ok=True)
    stage=Usd.Stage.CreateNew(str(out/"master.usda"));UsdGeom.SetStageUpAxis(stage,UsdGeom.Tokens.z);UsdGeom.SetStageMetersPerUnit(stage,1)
    root=UsdGeom.Xform.Define(stage,"/AMERICAN_SUPERBLOCK");stage.SetDefaultPrim(root.GetPrim())
    library="/AMERICAN_SUPERBLOCK/SHARED_COMPONENT_LIBRARY";UsdGeom.Scope.Define(stage,library);UsdGeom.Imageable(stage.GetPrimAtPath(library)).CreateVisibilityAttr().Set(UsdGeom.Tokens.invisible)
    made=set()
    for d in descriptors:
        r=results[d["id"]]
        if r.get("status")!="converted_validated":continue
        key=r["nativeHash"];definition=library+"/S_"+key
        if key not in made:
            prim=UsdGeom.Xform.Define(stage,definition).GetPrim()
            src=Usd.Stage.Open(str(pathlib.Path(cache)/(key+".usdc")))
            for i,child in enumerate(src.GetPseudoRoot().GetChildren()):
                p=stage.DefinePrim(definition+"/Body_"+str(i));p.GetReferences().AddReference(str(pathlib.Path(cache)/(key+".usdc")),child.GetPath())
            made.add(key)
        building={"B1":"BUILDING_01","B2":"BUILDING_02","B3":"BUILDING_03","B4":"BUILDING_04","CORE":"CENTRAL_CORE"}.get(d["building"],"SITE")
        path="/AMERICAN_SUPERBLOCK/"+building+"/"+d["category"]+"/L_"+str(d["level"]).replace("-","B")+"/E_"+hashlib.sha256(d["id"].encode()).hexdigest()[:24]
        p=UsdGeom.Xform.Define(stage,path);p.GetPrim().GetReferences().AddInternalReference(definition);p.GetPrim().SetInstanceable(True)
        x,y,z=d["transform"];p.AddTranslateOp().Set(Gf.Vec3d(x*FT,-y*FT,z*FT))
        for name,val in [("sourceId",d["id"]),("geometryHash",d["geometryHash"]),("ifcClass",d["ifcClass"])]:p.GetPrim().CreateAttribute("memo:"+name,Sdf.ValueTypeNames.String).Set(val)
    stage.GetRootLayer().Save()
    # Flatten external geometry layers into a single portable binary stage.
    final=out/"superblock.usdc";stage.Flatten().Export(str(final))
    check=Usd.Stage.Open(str(final))
    count=sum(1 for p in check.Traverse() if p.HasAttribute("memo:sourceId"))
    expected=sum(r.get("status")=="converted_validated" for r in results.values())
    if count!=expected:raise ValueError("USD component identity count mismatch")
    return {"file":final.name,"bytes":final.stat().st_size,"reimportedComponents":count}
def ifc_export(descriptors,out):
    import ifcopenshell,ifcopenshell.validate
    f=ifcopenshell.file(schema="IFC4X3_ADD2")
    uid=lambda s:ifcopenshell.guid.compress(uuid.uuid5(uuid.NAMESPACE_URL,"memo:"+s).hex)
    pt=lambda q:f.create_entity("IfcCartesianPoint",Coordinates=tuple(float(x) for x in q))
    direction=lambda q:f.create_entity("IfcDirection",DirectionRatios=tuple(float(x) for x in q))
    axis=lambda q:f.create_entity("IfcAxis2Placement3D",Location=pt(q),Axis=direction((0,0,1)),RefDirection=direction((1,0,0)))
    placement=lambda q,parent=None:f.create_entity("IfcLocalPlacement",PlacementRelTo=parent,RelativePlacement=axis(q))
    ctx=f.create_entity("IfcGeometricRepresentationContext",ContextIdentifier="Model",ContextType="Model",CoordinateSpaceDimension=3,Precision=1e-7,WorldCoordinateSystem=axis((0,0,0)))
    units=f.create_entity("IfcUnitAssignment",Units=[f.create_entity("IfcSIUnit",UnitType="LENGTHUNIT",Name="METRE")])
    project=f.create_entity("IfcProject",GlobalId=uid("project"),Name="MEMO American Superblock",RepresentationContexts=[ctx],UnitsInContext=units)
    site=f.create_entity("IfcSite",GlobalId=uid("site"),Name="660 ft superblock",ObjectPlacement=placement((0,0,0)),CompositionType="ELEMENT")
    def aggregate(a,b,name):f.create_entity("IfcRelAggregates",GlobalId=uid(name),RelatingObject=a,RelatedObjects=b)
    aggregate(project,[site],"project-site");buildings={};storeys={};issues=[];count=0;materials={}
    mapping={x.upper():x for x in ["IfcWall","IfcSlab","IfcColumn","IfcBeam","IfcMember","IfcDoor","IfcWindow","IfcCurtainWall","IfcStairFlight","IfcRampFlight","IfcRailing","IfcFooting","IfcSpace","IfcFurnishingElement","IfcTransportElement","IfcBuildingElementProxy","IfcPipeSegment","IfcDuctSegment","IfcCovering"]}
    for d in descriptors:
        bid=d["building"];level=d["level"]
        if bid not in buildings:
            buildings[bid]=f.create_entity("IfcBuilding",GlobalId=uid(bid),Name=bid,ObjectPlacement=placement((0,0,0)),CompositionType="ELEMENT");aggregate(site,[buildings[bid]],"site-"+bid)
        key=(bid,level)
        if key not in storeys:
            storeys[key]=f.create_entity("IfcBuildingStorey",GlobalId=uid(str(key)),Name="Level "+str(level+1),Elevation=level*12*FT,ObjectPlacement=placement((0,0,0)),CompositionType="ELEMENT");aggregate(buildings[bid],[storeys[key]],"storey-"+str(key))
        cls=mapping.get(d["ifcClass"],"IfcBuildingElementProxy")
        if d["ifcClass"] not in mapping:issues.append({"id":d["id"],"reason":"Unmapped IFC type"})
        x,y,z=d["transform"];obj=f.create_entity(cls,GlobalId=uid(d["id"]),Name=d["id"],Description=d["properties"].get("role",""),ObjectPlacement=placement((x*FT,-y*FT,z*FT)))
        reps=[]
        try:
            descriptor_check(d)
            for p in d["shape"]["parts"]:
                rings=[p["polygon"],*p.get("holes",[])];bottom=[];top=[]
                for ri,ring in enumerate(rings):
                    b=[(q[0]*FT,-q[1]*FT,(p["z"]+(p.get("elevations",[0]*len(ring))[i] if ri==0 else 0))*FT) for i,q in enumerate(ring)]
                    if (signed_area(b)>0)!=(ri==0):b.reverse()
                    bottom.append(b);top.append([(q[0],q[1],q[2]+p["height"]*FT) for q in b])
                def face(rs):
                    bounds=[]
                    for i,r in enumerate(rs):
                        loop=f.create_entity("IfcPolyLoop",Polygon=[pt(q) for q in r]);bounds.append(f.create_entity("IfcFaceOuterBound" if i==0 else "IfcFaceBound",Bound=loop,Orientation=True))
                    return f.create_entity("IfcFace",Bounds=bounds)
                faces=[face([list(reversed(r)) for r in bottom]),face(top)]
                for ri,(b,t) in enumerate(zip(bottom,top)):
                    for i in range(len(b)):
                        j=(i+1)%len(b);q=[b[i],b[j],t[j],t[i]];faces.append(face([q]))
                reps.append(f.create_entity("IfcFacetedBrep",Outer=f.create_entity("IfcClosedShell",CfsFaces=faces)))
            rep=f.create_entity("IfcShapeRepresentation",ContextOfItems=ctx,RepresentationIdentifier="Body",RepresentationType="Brep",Items=reps)
            obj.Representation=f.create_entity("IfcProductDefinitionShape",Representations=[rep])
        except (ValueError,KeyError,TypeError) as e:issues.append({"id":d["id"],"reason":str(e)})
        material_key=str(d.get("material",{}).get("color","unspecified"))
        if material_key not in materials:materials[material_key]=f.create_entity("IfcMaterial",Name=("Glazing " if d.get("material",{}).get("glazing") else "Material ")+material_key)
        f.create_entity("IfcRelAssociatesMaterial",GlobalId=uid(d["id"]+"-material"),RelatedObjects=[obj],RelatingMaterial=materials[material_key])
        props=[f.create_entity("IfcPropertySingleValue",Name=k,NominalValue=f.create_entity("IfcLabel",str(v))) for k,v in {"SourceId":d["id"],"GeometryHash":d["geometryHash"],"GeometryStatus":d["validation"]["status"],"CodeCompliance":"Not assessed"}.items()]
        pset=f.create_entity("IfcPropertySet",GlobalId=uid(d["id"]+"-pset"),Name="MEMO_Geometry",HasProperties=props)
        f.create_entity("IfcRelDefinesByProperties",GlobalId=uid(d["id"]+"-props"),RelatedObjects=[obj],RelatingPropertyDefinition=pset)
        if cls=="IfcSpace":aggregate(storeys[key],[obj],d["id"]+"-space")
        else:f.create_entity("IfcRelContainedInSpatialStructure",GlobalId=uid(d["id"]+"-containment"),RelatingStructure=storeys[key],RelatedElements=[obj])
        count+=1
    dst=pathlib.Path(out)/"superblock.ifc";f.write(str(dst));check=ifcopenshell.open(str(dst));logger=ifcopenshell.validate.json_logger();ifcopenshell.validate.validate(check,logger)
    return {"file":dst.name,"bytes":dst.stat().st_size,"elements":count,"schema":check.schema,"schemaErrors":logger.statements,"unresolved":issues,"geometryReimport":"Schema reimport only; independent solid volume/placement verification pending"}
def process(payload,root,cancel=lambda:False,progress=lambda n,total:None):
    start=time.perf_counter();elements=payload.get("elements",[]);fmt=payload.get("format","usd")
    if len(elements)>100000:raise ValueError("Element limit exceeded")
    ids=[d["id"] for d in elements]
    if len(set(ids))!=len(ids):raise ValueError("Duplicate IDs")
    root=pathlib.Path(root);out=root/"artifacts";out.mkdir(parents=True,exist_ok=True);cache=root.parent.parent/"cache";results={};times={"generation":0,"usd":0,"ifc":0,"tessellation":None};caps=capabilities()
    if fmt=="step":raise Unsupported("STEP converter not provisioned; no placeholder file generated")
    if fmt=="usd" and not caps["nativeReady"]:raise Unsupported("Native USD export requires usd_brep and compatible pxr runtime")
    if fmt=="ifc" and not caps["ifcReady"]:raise Unsupported("IFC4x3 export requires IfcOpenShell")
    for i,d in enumerate(elements):
        if cancel():raise InterruptedError("Cancelled")
        try:
            volume=descriptor_check(d)
            if caps["nativeReady"]:
                r=build_shape(d,cache);times["generation"]+=r["seconds"];results[d["id"]]=r
            else:results[d["id"]]={"status":"unresolved","reason":"Native kernel unavailable","analyticVolumeM3":volume}
        except (ValueError,RuntimeError,TypeError,KeyError) as e:results[d["id"]]={"status":"unresolved","reason":str(e)}
        progress(i+1,len(elements))
    artifacts=[];t=time.perf_counter()
    if fmt=="usd":artifacts.append(usd_master(elements,results,cache,out));times["usd"]=time.perf_counter()-t
    if fmt=="ifc":artifacts.append(ifc_export(elements,out));times["ifc"]=time.perf_counter()-t
    summary={"schema":VERSION,"revision":payload.get("revision"),"elements":{d["id"]:{**results[d["id"]],"geometryHash":d["geometryHash"]} for d in elements},"artifacts":artifacts,"metrics":{"processed":len(elements),"validatedElements":sum(r.get("status")=="converted_validated" for r in results.values()),"closedSolids":sum(r.get("solidCount",0) for r in results.values()),"unresolved":sum(r.get("status")!="converted_validated" for r in results.values()),"cacheHits":sum(r.get("cacheHit",False) for r in results.values()),"times":times,"totalSeconds":time.perf_counter()-start,"peakMemoryMB":resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024},"limitations":caps["limitations"]}
    atomic_json(root/"manifest.json",summary);return summary

