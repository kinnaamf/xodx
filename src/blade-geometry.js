import * as THREE from 'three';

// A sealed, double-sided blade surface. There are deliberately no vertical
// extrusion walls: both faces meet at exactly the same razor-thin boundary.
export function createBladeBuilder(shapes, metadata) {
  const width=metadata.width||4.5,height=metadata.height||4.078;
  const cellSize=.12,edgeCells=new Map(),tipCells=new Map(),vertexCache=new Map();
  const tips=metadata.tips||[];
  for(const shape of shapes)for(const loop of [shape.outline,...shape.holes])for(let i=0;i<loop.length;i++){
    const a=loop[i],b=loop[(i+1)%loop.length];
    for(let x=Math.floor((Math.min(a[0],b[0])-.1)/cellSize);x<=Math.floor((Math.max(a[0],b[0])+.1)/cellSize);x++){
      for(let y=Math.floor((Math.min(a[1],b[1])-.1)/cellSize);y<=Math.floor((Math.max(a[1],b[1])+.1)/cellSize);y++){
        const key=`${x},${y}`;
        if(!edgeCells.has(key))edgeCells.set(key,[]);
        edgeCells.get(key).push([a,b]);
      }
    }
  }
  for(const tip of tips){
    const [x,y]=tip.position,r=tip.radius;
    for(let ix=Math.floor((x-r)/cellSize);ix<=Math.floor((x+r)/cellSize);ix++)for(let iy=Math.floor((y-r)/cellSize);iy<=Math.floor((y+r)/cellSize);iy++){
      const key=`${ix},${iy}`;
      if(!tipCells.has(key))tipCells.set(key,[]);
      tipCells.get(key).push(tip);
    }
  }
  const gaussian=(x,y,cx,cy,r)=>Math.exp(-((x-cx)**2+(y-cy)**2)/(r*r));
  const smoothPositive=(value,min)=>min+.5*(value-min+Math.sqrt((value-min)**2+.000225));
  function sample(x,y){
    const key=`${Math.floor(x/cellSize)},${Math.floor(y/cellSize)}`;
    let distance=.1;
    for(const [a,b]of edgeCells.get(key)||[]){
      const dx=b[0]-a[0],dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
      distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));
    }
    // C2 blending removes shading breaks where a bevel joins the body.
    const d=Math.min(1,distance/.065);
    const envelope=Math.pow(d*d*(3-2*d),1.3);
    const taper=1; // Zero-thickness boundaries already form the sharp tips.
    const waves=.014*Math.sin(3.1*x+1.3*y)+.012*Math.cos(3.2*y-1.8*x);
    const bulges=.22*gaussian(x,y,-1.25,.6,.43)+.19*gaussian(x,y,.95,.8,.47)+.2*gaussian(x,y,-.55,-1.15,.4)+.16*gaussian(x,y,1.3,-.65,.38)
      +.11*gaussian(x,y,-1.65,-.3,.24)+.095*gaussian(x,y,.36,1.12,.3)+.12*gaussian(x,y,.55,-.52,.31);
    const dents=.068*gaussian(x,y,-1.45,-.55,.26)+.075*gaussian(x,y,.45,.2,.3)+.06*gaussian(x,y,1.05,-1.15,.33);
    const thickness=1+.09*Math.sin(2.7*x+1.4*y)+.05*Math.cos(4.1*y-x);
    const bend=.022*Math.sin(2.1*x+1.7*y);
    // Warped, tapering folds follow the existing body rather than adding
    // disconnected growths. All displacement vanishes at the original edge.
    const flow=7.4*x+3.6*y+.8*Math.sin(2.8*y-1.2*x);
    const ridge=Math.exp(-Math.pow(Math.sin(flow),2)/.14);
    const foldMask=.65*gaussian(x,y,-.85,.1,.95)+.8*gaussian(x,y,1.05,-.25,.8);
    const folds=.052*ridge*foldMask-.018*Math.cos(flow*1.1)*foldMask;
    const medium=.016*Math.sin(12*x+2.2*Math.sin(3*y))*Math.sin(8*y-2*x);
    const micro=.0028*Math.sin(37*x+4*Math.sin(8*y))*Math.cos(31*y-5*x);
    const relief=.038+waves+bulges-dents+folds+medium+micro;
    const front=smoothPositive(.105*thickness+relief,.045)*envelope*taper;
    const back=smoothPositive(.1*thickness+.62*relief,.04)*envelope*taper;
    return {front:bend+front,back:bend-back,distance};
  }
  const bodyColor=new THREE.Color(0x303338),edgeColor=new THREE.Color(0x88939b);
  function vertex(x,y){
    const key=`${Math.round(x*1000000)},${Math.round(y*1000000)}`;
    if(vertexCache.has(key))return vertexCache.get(key);
    const center=sample(x,y),e=.012;
    // Filter the normal field over a small continuous footprint. Nearest-edge
    // distance has medial ridges; unfiltered derivatives turn those into bands.
    const filtered=(sx,sy)=>{
      let front=0,back=0,total=0;
      for(let ix=-1;ix<=1;ix++)for(let iy=-1;iy<=1;iy++){
        const weight=(ix===0?2:1)*(iy===0?2:1);
        const p=sample(sx+ix*.025,sy+iy*.025);
        front+=p.front*weight;back+=p.back*weight;total+=weight;
      }
      return {front:front/total,back:back/total};
    };
    const px=filtered(x+e,y),mx=filtered(x-e,y),py=filtered(x,y+e),my=filtered(x,y-e);
    // Continuous surface derivatives, independent of triangulation, make the
    // reflected light flow across triangle boundaries without stair-steps.
    const frontNormal=new THREE.Vector3(-(px.front-mx.front)/(2*e),-(py.front-my.front)/(2*e),1).normalize();
    const backNormal=new THREE.Vector3((px.back-mx.back)/(2*e),(py.back-my.back)/(2*e),-1).normalize();
    const edgeTint=Math.exp(-((center.distance/.022)**2))*.88;
    const swelling=Math.max(0,Math.min(1,(center.front-center.back-.15)/.38));
    const facing=Math.max(0,frontNormal.z);
    const reliefLight=Math.min(1,.18*facing+swelling*(.35+.65*facing));
    // Graphite follows raised, front-facing geometry; hollows remain black.
    const color=new THREE.Color(0x0b0d10)
      .lerp(new THREE.Color(0x87909b),reliefLight)
      .lerp(edgeColor,edgeTint*.72);
    const result={x,y,...center,frontNormal,backNormal,color};
    vertexCache.set(key,result);
    return result;
  }
  function build(source){
    const shape=new THREE.Shape(source.outline.map(point=>new THREE.Vector2(...point)));
    for(const hole of source.holes)shape.holes.push(new THREE.Path(hole.map(point=>new THREE.Vector2(...point))));
    const indexed=new THREE.ShapeGeometry(shape,1);
    const base=indexed.index?indexed.toNonIndexed():indexed;
    if(base!==indexed)indexed.dispose();
    const input=base.attributes.position;
    const positions=[],normals=[],colors=[];
    let boundaryError=0;
    function emit(point,front){
      const v=vertex(point[0],point[1]),normal=front?v.frontNormal:v.backNormal;
      positions.push(v.x,v.y,front?v.front:v.back);
      normals.push(normal.x,normal.y,normal.z);
      colors.push(v.color.r,v.color.g,v.color.b);
      if(v.distance<1e-7)boundaryError=Math.max(boundaryError,Math.abs(v.front-v.back));
    }
    function emitTriangle(a,b,c){
      emit(a,true);emit(b,true);emit(c,true);
      emit(c,false);emit(b,false);emit(a,false);
    }
    const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
    const length2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
    function triangle(a,b,c,depth=0){
      const lengths=[length2(a,b),length2(b,c),length2(c,a)];
      const edge=lengths.indexOf(Math.max(...lengths));
      const limit=.018;
      if(lengths[edge]>limit*limit&&depth<16){
        if(edge===0){const m=mid(a,b);triangle(a,m,c,depth+1);triangle(m,b,c,depth+1);}
        else if(edge===1){const m=mid(b,c);triangle(a,b,m,depth+1);triangle(a,m,c,depth+1);}
        else{const m=mid(c,a);triangle(a,b,m,depth+1);triangle(m,b,c,depth+1);}
      }else emitTriangle(a,b,c);
    }
    for(let i=0;i<input.count;i+=3)triangle([input.getX(i),input.getY(i)],[input.getX(i+1),input.getY(i+1)],[input.getX(i+2),input.getY(i+2)]);
    base.dispose();
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeBoundingBox();
    geometry.userData.boundaryError=boundaryError;
    return geometry;
  }
  return {build,sample,tips:tips.length,release(){vertexCache.clear();edgeCells.clear();tipCells.clear();}};
}
