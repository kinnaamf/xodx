/* A small, dependency-free chrome study. The final video can replace this canvas. */
(() => {
  const canvas = document.getElementById('sculpture');
  const gl = canvas.getContext('webgl', {alpha:true, antialias:true, premultipliedAlpha:false, preserveDrawingBuffer:false});
  if (!gl) return;
  const vertex = `attribute vec3 aPosition; attribute vec3 aNormal; uniform mat4 uModel; uniform mat4 uProjection; varying vec3 vNormal; varying vec3 vPosition; void main(){vec4 p=uModel*vec4(aPosition,1.); vPosition=p.xyz; vNormal=mat3(uModel)*aNormal; gl_Position=uProjection*p;}`;
  const fragment = `precision highp float;
    varying vec3 vNormal; varying vec3 vPosition;
    vec3 environment(vec3 r){
      float y=r.y*.5+.5;
      vec3 base=mix(vec3(.045,.055,.042),vec3(.45,.47,.39),smoothstep(.30,.65,y));
      base=mix(base,vec3(.095,.115,.083),smoothstep(.80,.95,y));
      float horizon=exp(-pow((y-.54)*22.,2.));
      base+=vec3(.75,.76,.65)*horizon;
      float band=exp(-pow((y-.73)*34.,2.));
      base+=vec3(1.5,1.48,1.30)*band;
      float strip=pow(max(0.,dot(r,normalize(vec3(-.65,.65,1.)))),32.);
      base+=vec3(1.6,1.58,1.43)*strip;
      float side=pow(max(0.,dot(r,normalize(vec3(1.,.1,.6)))),48.);
      base+=vec3(.75,.83,.74)*side;
      float low=pow(max(0.,dot(r,normalize(vec3(-.5,-.8,.7)))),24.);
      base+=vec3(.27,.31,.23)*low;
      return base;
    }
    void main(){
      vec3 n=normalize(vNormal); vec3 eye=normalize(vec3(0.,0.,0.)-vPosition); vec3 r=reflect(-eye,n);
      vec3 color=environment(r);
      float fresnel=pow(1.-max(dot(n,eye),0.),3.);
      color=mix(color,color*1.22+vec3(.08,.085,.065),fresnel);
      float ao=.78+.22*smoothstep(-1.5,1.5,vPosition.y);
      color*=ao;
      color=pow(color/(color+vec3(.52)),vec3(.87));
      gl_FragColor=vec4(color,1.);
    }`;
  function shader(type, src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))return null;return s;}
  const vs=shader(gl.VERTEX_SHADER,vertex), fs=shader(gl.FRAGMENT_SHADER,fragment);
  if(!vs||!fs)return;
  const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;
  const positions=[],normals=[];
  const normalize=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
  function add(a,b,c,na,nb,nc){positions.push(...a,...b,...c);normals.push(...na,...nb,...nc);}
  function rotate(p,a,offset){const c=Math.cos(a),s=Math.sin(a);return [p[0]*c-p[1]*s+offset[0],p[0]*s+p[1]*c+offset[1],p[2]+offset[2]];}
  function bevelBox(dims,r,angle,offset){
    const n=14, half=dims.map(x=>x/2), core=half.map(x=>x-r);
    const faces=[{axis:0,u:1,v:2,sign:1},{axis:0,u:1,v:2,sign:-1},{axis:1,u:2,v:0,sign:1},{axis:1,u:2,v:0,sign:-1},{axis:2,u:0,v:1,sign:1},{axis:2,u:0,v:1,sign:-1}];
    for(const f of faces){
      function sample(i,j){const p=[0,0,0];p[f.axis]=half[f.axis]*f.sign;p[f.u]=(i/n*2-1)*half[f.u];p[f.v]=(j/n*2-1)*half[f.v];const q=p.map((x,k)=>Math.max(-core[k],Math.min(core[k],x)));const norm=normalize(p.map((x,k)=>x-q[k]));const point=q.map((x,k)=>x+norm[k]*r);return [rotate(point,angle,offset),rotate(norm,angle,[0,0,0])];}
      for(let i=0;i<n;i++)for(let j=0;j<n;j++){const a=sample(i,j),b=sample(i+1,j),c=sample(i+1,j+1),d=sample(i,j+1);if(f.sign>0){add(a[0],b[0],c[0],a[1],b[1],c[1]);add(a[0],c[0],d[0],a[1],c[1],d[1]);}else{add(a[0],c[0],b[0],a[1],c[1],b[1]);add(a[0],d[0],c[0],a[1],d[1],c[1]);}}
    }
  }
  bevelBox([.39,2.04,.41],.13,-.61,[-.72,0,.015]);
  bevelBox([.39,2.04,.41],.13,.61,[-.72,0,0]);
  function ring(){
    const seg=144,sides=36,R=.66,r=.205;
    function sample(i,j){const a=i/seg*Math.PI*2,b=j/sides*Math.PI*2;const c=Math.cos(a),s=Math.sin(a);return [[.74+(R+r*Math.cos(b))*c,(R+r*Math.cos(b))*s*1.2,r*Math.sin(b)],normalize([c*Math.cos(b),s*Math.cos(b)/1.2,Math.sin(b)])];}
    for(let i=0;i<seg;i++)for(let j=0;j<sides;j++){const a=sample(i,j),b=sample(i+1,j),c=sample(i+1,j+1),d=sample(i,j+1);add(a[0],b[0],c[0],a[1],b[1],c[1]);add(a[0],c[0],d[0],a[1],c[1],d[1]);}
  }
  ring();
  gl.useProgram(program);
  function attribute(name,data){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);}
  attribute('aPosition',positions);attribute('aNormal',normals);
  gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
  const model=gl.getUniformLocation(program,'uModel'),proj=gl.getUniformLocation(program,'uProjection');
  function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
  const rx=a=>new Float32Array([1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1]);
  const ry=a=>new Float32Array([Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1]);
  const rz=a=>new Float32Array([Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1,0,0,0,0,1]);
  let aspect=1,mouseX=0,mouseY=0,px=0,py=0,frame,last=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function resize(){const dpr=Math.min(window.devicePixelRatio||1,1.75);canvas.width=Math.round(canvas.clientWidth*dpr);canvas.height=Math.round(canvas.clientHeight*dpr);aspect=canvas.width/canvas.height;gl.viewport(0,0,canvas.width,canvas.height);const near=.1,far=50,f=1/Math.tan(.51);gl.uniformMatrix4fv(proj,false,new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]));}
  function draw(t){if(t-last<30&&!reduced.matches){frame=requestAnimationFrame(draw);return;}last=t;px+=(mouseX-px)*.04;py+=(mouseY-py)*.04;const angle=reduced.matches?-.24:t*.00017-.3;let m=mul(rz(-.19),mul(rx(.10+py*.1),ry(angle+px*.16)));const mobile=canvas.clientWidth<700;const scale=mobile?1.04:1.20;for(let i=0;i<12;i++)m[i]*=scale;m[13]=.11;m[14]=mobile?-4.5:-(aspect>2.6?5.15:5.5);gl.uniformMatrix4fv(model,false,m);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,positions.length/3);if(!reduced.matches)frame=requestAnimationFrame(draw);}
  window.addEventListener('pointermove',e=>{mouseX=e.clientX/window.innerWidth*2-1;mouseY=e.clientY/window.innerHeight*2-1;},{passive:true});
  new ResizeObserver(()=>{resize();if(reduced.matches)draw(0);}).observe(canvas);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(frame);else frame=requestAnimationFrame(draw);});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();canvas.hidden=true;document.getElementById('fallback-logo').hidden=false;cancelAnimationFrame(frame);});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  document.getElementById('fallback-logo').hidden=true;resize();frame=requestAnimationFrame(draw);
})();
