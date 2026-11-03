#!/usr/bin/env python3
"""MEMO Phase 1 — exact USD BRep for one experimental Superblock corner entrance.
Requires CPython 3.12 and `pip install usd-brep` (NVIDIA 1.0.1).
Coordinates X = cross-entrance, Y = outward (from core), Z = vertical; units METRES.
Python generates preview component geometry and precise USD BRep from the SAME solids.
"""
import argparse, json, math, hashlib, pathlib, sys, time
FT=0.3048

def build(config):
    w=config['portal_width_ft']*FT/2
    v=config['vestibule_width_ft']*FT/2
    d=config['airlock_depth_ft']*FT
    c=config['canopy_depth_ft']*FT
    h=config['height_ft']*FT
    recursion=int(config['gereh_subdivisions'])
    if not (12<=config['portal_width_ft']<=32 and 8<=config['vestibule_width_ft']<=config['portal_width_ft']-2 and 10<=config['airlock_depth_ft']<=18 and 6<=config['canopy_depth_ft']<=20 and 1<=recursion<=3):
        raise ValueError('Entrance parameter out of schematic allowed range')
    pieces=[]
    def box(id,group,role,pos,size,material,ifc):
        assert all(s>0 for s in size),(id,size)
        pieces.append(dict(id=id,group=group,role=role,shape='box',origin=[round(a,6) for a in pos],size=[round(a,6) for a in size],material=material,ifc=ifc))
    def prism(id,group,role,points,axis,thickness,material,ifc):
        pts=[[round(p,6) for p in q] for q in points]
        pieces.append(dict(id=id,group=group,role=role,shape='prism',points=pts,axis=list(axis),thickness=round(thickness,6),material=material,ifc=ifc))
    # continuous walkway and enclosed air-trapping vestibule
    box('B01-G1-core-apron','paving','Indicative core apron, interface pending',(-v,-1.3,0),(2*v,1.3,.16),'stone','IFCSLAB')
    box('B01-G1-airlock-floor','paving','Flush vestibule floor',(-v,0,0),(2*v,d,.16),'stone','IFCSLAB')
    box('B01-G1-forecourt','paving','Flush accessible forecourt',(-w,d,0),(2*w,c+2.3,.16),'stone','IFCSLAB')
    box('B01-G1-airlock-roof','enclosure','Insulated vestibule roof',(-v-.12,-.1,h), (2*v+.24,d+.2,.2),'chalk','IFCSLAB')
    box('B01-G1-canopy-roof','portal','Protective canopy',(-w,d-.25,h+.16),(2*w,c+.25,.18),'chalk','IFCSLAB')
    for s,name in [(-1,'left'),(1,'right')]:
        x = -v-.065 if s==-1 else v-.045
        box(f'B01-G1-{name}-glass','enclosure','Sealed airlock side glazing',(x,0,.16),(.11,d,h-.16),'glass','IFCWALL')
        for y,tag in [(0,'inner'),(d,'outer')]:
            box(f'B01-G1-{name}-{tag}-mullion','enclosure','Glazed enclosure mullion',(x-.035,y-.06,.16),(.18,.12,h-.16),'bronze','IFCMEMBER')
        box(f'B01-G1-{name}-canopy-post','portal','Canopy structural post',(s*(w-.29)-.09,d+c-.43,.16),(.18,.18,h),'bronze','IFCCOLUMN')
        box(f'B01-G1-{name}-edge-beam','portal','Canopy edge beam',(s*(w-.24)-.08,d,h+.02),(.16,c,.26),'bronze','IFCBEAM')
    door=1.07 # 42 inch nominal leaf approx; clear opening NOT verified
    for bank,y in [('inner',0),('outer',d)]:
        box(f'B01-G1-{bank}-leaf','doors','Closed glazed operable leaf',(-door/2,y-.027,.16),(door,.054,2.55),'glass','IFCDOOR')
        box(f'B01-G1-{bank}-transom','enclosure','Sealed fixed transom',(-v,y-.028,2.8),(2*v,.056,h-2.8),'glass','IFCWALL')
        for s,side in [(-1,'left'),(1,'right')]:
            x0=-v if s==-1 else door/2
            width=v-door/2
            box(f'B01-G1-{bank}-{side}-sidelight','enclosure','Fixed sidelight',(x0,y-.029,.16),(width,.058,2.64),'glass','IFCWALL')
            box(f'B01-G1-{bank}-{side}-jamb','enclosure','Bronze door jamb',(s*door/2-.025,y-.055,.16),(.05,.11,2.64),'bronze','IFCMEMBER')
        box(f'B01-G1-{bank}-header','enclosure','Door header',(-v,y-.055,2.68),(2*v,.11,.12),'bronze','IFCMEMBER')
    box('B01-G1-internal-mat','paving','Absorbent recessed mat',(-.77,.4,.161),(1.54,d-.8,.012),'charcoal','IFCFURNISHINGELEMENT')
    box('B01-G1-outer-mat','paving','Scraper mat',(-.77,d+.35,.161),(1.54,1.5,.012),'charcoal','IFCFURNISHINGELEMENT')
    box('B01-G1-slot-drain','paving','Linear slot drain, outfall unresolved',(-v,d+.12,.161),(2*v,.09,.02),'charcoal','IFCBUILDINGELEMENTPROXY')
    # simple tenfold star around a shared centre; each division inherits its parent ID
    ring=[(math.cos(i*math.pi/10)*(1 if i%2==0 else .72),math.sin(i*math.pi/10)*(1 if i%2==0 else .72)) for i in range(20)]
    cells=[(f'G{i:02}',[(0,0),ring[i],ring[(i+1)%20]]) for i in range(20)]
    for g in range(2,recursion+1):
        child=[]
        for ident,t in cells:
            cx=sum(q[0] for q in t)/3;cy=sum(q[1] for q in t)/3
            for i in range(3):child.append((f'{ident}.{i}',[t[i],t[(i+1)%3],(cx,cy)]))
        cells=child
    edge_keys={}
    for cid,t in cells:
        for i in range(3):
            edge=tuple(sorted(((round(t[i][0],6),round(t[i][1],6)),(round(t[(i+1)%3][0],6),round(t[(i+1)%3][1],6)))))
            edge_keys.setdefault(edge,[]).append(cid)
    if max(len(a) for a in edge_keys.values())>2:raise ValueError('Non-manifold Gereh subdivisions')
    # two lateral screen cassettes, with negative space between each separate bronze triangle.
    for side,sgn in [('L',-1),('R',1)]:
        X=sgn*(w-.21)
        for cid,t in cells:
            cy=sum(p[1] for p in t)/3;cx=sum(p[0] for p in t)/3
            sh=[(cx+(u-cx)*.78,cy+(v-cy)*.78) for u,v in t]
            pts=[(X,d+c*.50+u*c*.38, h*.55+v*h*.37) for u,v in sh]
            prism(f'B01-G1-screen-{side}-{cid}','screen','GF60-inspired recessed triangular cassette',pts,(1,0,0),.046,'bronze','IFCBUILDINGELEMENTPROXY')
        # flat perimeter frame with 4 sides, avoiding floating detached screens
        yc=d+c*.12;yl=c*.76;zz=h*.18;zh=h*.74
        for tag,y in [('front',yc),('rear',yc+yl)]:box(f'B01-G1-frame-{side}-{tag}','screen','Vertical screen edge frame',(X-.04,y,zz),(.13,.085,zh),'bronze','IFCMEMBER')
        for tag,z in [('bottom',zz),('top',zz+zh)]:box(f'B01-G1-frame-{side}-{tag}','screen','Horizontal screen edge frame',(X-.04,yc,z),(.13,yl,.085),'bronze','IFCMEMBER')
    # planar bronzed Gereh panels on canopy roof: repetition uses shared tessellation logic
    for cid,t in cells:
        cx=sum(p[0] for p in t)/3;cy=sum(p[1] for p in t)/3
        sh=[(cx+(u-cx)*.91,cy+(v-cy)*.91) for u,v in t]
        pts=[(u*(w-.45),d+c*.48+v*c*.40,h+.344) for u,v in sh]
        prism(f'B01-G1-roof-panel-{cid}','screen','Flat folded-metal inlay',pts,(0,0,1),.025,'bronze','IFCCOVERING')
    # landscape safely outside entrance's central clear walk strip
    for s,side in [(-1,'L'),(1,'R')]:
        x0=s*(w+1.2)-.7
        box(f'B01-G1-planter-{side}','landscape','Raised bioretention planter',(x0,d+c+.15,.16),(1.4,1.55,.48),'charcoal','IFCBUILDINGELEMENTPROXY')
        box(f'B01-G1-soil-{side}','landscape','Planting soil',(x0+.09,d+c+.25,.65),(1.22,1.34,.13),'soil','IFCFURNISHINGELEMENT')
        for j in range(3):
            box(f'B01-G1-shrub-{side}-{j}','landscape','Native shrub indicative',(x0+.26+j*.34,d+c+.65+(j%2)*.30,.78),(.23,.22,.55),'green','IFCFURNISHINGELEMENT')
        box(f'B01-G1-bench-{side}','landscape','Seat outside clear walkway',(x0,d+c+1.83,.16),(1.4,.42,.43),'stone','IFCFURNISHINGELEMENT')
    for s,side in [(-1,'L'),(1,'R')]:
        box(f'B01-G1-LED-{side}','lighting','Concealed warm LED',(s*(w-.25)-.015,d,h+.1),(.03,c,.025),'light','IFCBUILDINGELEMENTPROXY')
    # running joints for the central corridor, not a trip obstruction
    for k in range(9):
        yy=d+c+.3+k*.23
        box(f'B01-G1-paving-line-{k:02}','paving','Contrasting inlaid stone joint',(-.77,yy,.161),(1.54,.025,.009),'bronze','IFCCOVERING')
    return { 'project':'MEMO / American Superblock', 'id':'B01-G1-Phase1', 'version':'1.0', 'units':'metre',
        'axes':{'X':'horizontal','Y':'outward-from-core','Z':'vertical'},
        'config':config,'geometry':pieces,
        'pattern':{'lineage':'GF60-inspired schematic; NOT an exact reproduction of the original study','cells':len(cells),'shared_edges':len(edge_keys),'manifold_adjacency':True},
        'disclaimer':'Schematic test geometry; no structural, egress, accessibility, thermal, wind or drainage certification. Core apron is indicative until exact as-built position is resolved.'}

def make_brep(comp,usd_brep):
    if comp['shape']=='box':return usd_brep.create_box(tuple(comp['origin']),*comp['size'])
    pts=comp['points'];cs=[usd_brep.create_line_segment(tuple(pts[i]),tuple(pts[(i+1)%len(pts)])) for i in range(len(pts))]
    return usd_brep.linear_sweep(cs,tuple(comp['axis']),comp['thickness'])

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--config',default=str(pathlib.Path(__file__).with_name('corner-config.json')));ap.add_argument('--out-dir',default=str(pathlib.Path(__file__).resolve().parents[2]/'public'/'phase1'))
    a=ap.parse_args();out=pathlib.Path(a.out_dir);out.mkdir(parents=True,exist_ok=True)
    cfg=json.loads(pathlib.Path(a.config).read_text());manifest=build(cfg)
    import usd_brep
    bodies=[];invalid=[]
    start=time.monotonic()
    for comp in manifest['geometry']:
        b=make_brep(comp,usd_brep);bodies.append(b)
        if not usd_brep.is_manifold_solid(b):invalid.append(comp['id'])
    if invalid:raise RuntimeError('Nonmanifold solids: '+', '.join(invalid))
    dst=out/'corner-entry-brep.usdc'
    usd_brep.usd.export_breps(bodies,str(dst))
    roundtrip=usd_brep.usd.import_breps(str(dst))
    if len(roundtrip)!=len(bodies):raise RuntimeError(f'Roundtrip count mismatch {len(roundtrip)} != {len(bodies)}')
    if any(not usd_brep.is_manifold_solid(b) for b in roundtrip):raise RuntimeError('Roundtrip imported nonmanifold bodies')
    manifest['validation']={'native_kernel':'NVIDIA usd-brep 1.0.1','closed_solid_count':len(bodies),'roundtrip_count':len(roundtrip),'all_manifold':True,'duration_seconds':round(time.monotonic()-start,2),'usdc_bytes':dst.stat().st_size}
    manifest['checksum_sha256']=hashlib.sha256(dst.read_bytes()).hexdigest()
    (out/'corner-entry-components.json').write_text(json.dumps(manifest,indent=2))
    print(json.dumps({'status':'passed',**manifest['validation'],'usd':str(dst)},indent=2))
if __name__=='__main__':main()
