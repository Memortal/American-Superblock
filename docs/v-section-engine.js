// Independent design option. Feet; x is section depth, y is bay length, z is elevation.
// Does not certify or overwrite the coordinated model.
export function generateVSection(raw={}){
 const s={levels:13,storey:12,width:65,valley:6,runPerStorey:2,stepFloors:2,bay:25,slab:.75,wall:.5,column:1.5,...raw};
 if(!Number.isInteger(s.levels)||s.levels<5||s.levels>30||s.width<=s.valley||s.valley<6||s.runPerStorey<0||s.runPerStorey>4||![1,2,3].includes(s.stepFloors))throw Error('Invalid V-section parameters');
 const slope=s.runPerStorey/s.storey,half=s.valley/2,depth=(s.width-s.valley)/2,elements=[];
 const add=(id,type,side,level,profile,y0=0,y1=s.bay)=>elements.push({id:'V-'+id,type,side,level,profile:profile.map(([x,z])=>[side*x,z]),y0,y1,designOption:'V section',engineeringStatus:'Concept only; sizing and connections unresolved'});
 const inner=l=>half+s.runPerStorey*(Math.floor(l/s.stepFloors)*s.stepFloors);
 const outer=z=>half+depth+slope*z;
 for(const side of [-1,1]){
  for(let l=0;l<=s.levels;l++){
   const z=l*s.storey,ix=inner(Math.min(l,s.levels-1)),ox=outer(z);
   add(side+'-SLAB-'+l,'IFCSLAB',side,l,[[ix,z],[ox,z],[ox-slope*s.slab,z-s.slab],[ix,z-s.slab]]);
   if(l===s.levels)continue;
   const top=z+s.storey-s.slab;
   if(l!==3){
    add(side+'-OUTER-'+l,'IFCCURTAINWALL',side,l,[[outer(z)-s.wall,z],[outer(z),z],[outer(top),top],[outer(top)-s.wall,top]]);
    add(side+'-INNER-'+l,'IFCCURTAINWALL',side,l,[[ix,z],[ix+s.wall,z],[ix+s.wall,top],[ix,top]]);
   }
   // Frame members follow continuous oblique axes, including the open fourth floor.
   for(const [j,d] of [0,depth/2,depth].entries())for(const [k,y] of [0,s.bay].entries()){
    const x=half+d+slope*z,w=s.column/2;
    add(side+'-COLUMN-'+j+'-'+k+'-'+l,'IFCCOLUMN',side,l,[[x-w,z],[x+w,z],[x+w+s.runPerStorey,z+s.storey],[x-w+s.runPerStorey,z+s.storey]],y-w,y+w);
   }
   for(const [k,y] of [0,s.bay].entries())add(side+'-BEAM-'+k+'-'+l,'IFCBEAM',side,l,[[half+slope*z,z-s.slab],[outer(z),z-s.slab],[outer(z),z-s.slab-1.5],[half+slope*z,z-s.slab-1.5]],y-.6,y+.6);
  }
 }
 return {settings:s,elements,angleDegrees:Math.atan(slope)*180/Math.PI,barDepth:depth,roofWidth:s.width+2*s.runPerStorey*s.levels,unresolved:['Vertical-core connections and accessible landings at shifted floor edges','Oblique-frame thrust, stability, lateral system and foundations','Core/MEP risers and all egress routes must be recoordinated','Projection beyond current envelope; corner intersections and site boundaries','Member sizes are placeholders; fourth-floor transfer and terrace interfaces require design'],source:'Parametric section option informed by existing model heights; not the coordinated Superblock geometry'};
}
export function sectionSVG(data){const {settings:s}=data,w=1100,h=850,extent=data.roofWidth+24,k=Math.min(850/extent,680/(s.levels*s.storey+15)),cx=550,base=765,pt=([x,z])=>`${(cx+x*k).toFixed(2)},${(base-z*k).toFixed(2)}`;let body='';for(const e of data.elements.filter(e=>e.y0<=0&&e.y1>=0)){body+=`<polygon points="${e.profile.map(pt).join(' ')}" fill="${e.type==='IFCCURTAINWALL'?'#dce7e5':'#161a18'}" stroke="#111" stroke-width="0.65"/>`;}
 for(let l=0;l<=s.levels;l++){const y=base-l*s.storey*k;body+=`<line x1="80" x2="1020" y1="${y}" y2="${y}" stroke="#9aaba2" stroke-width=".45" stroke-dasharray="6 5"/><text x="38" y="${y+4}" font-size="11">${l===s.levels?'ROOF':'L'+(l+1)}</text>`;}
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="1100" height="850" fill="white"/><text x="38" y="35" font-size="22" font-family="Arial">MEMO STUDIO / V SECTION</text><text x="38" y="58" font-size="12" font-family="Arial">DESIGN OPTION · ${data.angleDegrees.toFixed(2)}° from vertical · ${s.runPerStorey} ft / storey · inner step every ${s.stepFloors} floors</text>${body}<text x="38" y="805" font-size="12" font-family="Arial">Base ${s.width} ft · valley ${s.valley} ft · bars ${data.barDepth} ft · roof span ${data.roofWidth} ft · L4 open</text><text x="38" y="827" font-size="11" font-family="Arial">SCHEMATIC — Core connections, egress, MEP, site projection and structural design unresolved. Not for construction.</text></svg>`;
}
