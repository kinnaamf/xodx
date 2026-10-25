import * as THREE from 'three';
import { createBladeBuilder } from './blade-geometry.js';

(() => {
  const canvas = document.getElementById('emblem');
  const fallback = document.getElementById('emblem-fallback');
  if (!canvas || !window.DX_LOGO_SHAPES) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    canvas.hidden = true;
    return;
  }
  renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio || 1, 1.75), 2.25));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .66;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  const environmentScene = new THREE.Scene();
  environmentScene.background = new THREE.Color(0x010102);
  function lightCard(w, h, x, y, z, intensity) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(intensity, intensity, intensity), side: THREE.DoubleSide });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    card.position.set(x, y, z);
    card.lookAt(0, 0, 0);
    environmentScene.add(card);
  }
  lightCard(18, 14, 0, 0, 8, .006);
  lightCard(18, 14, 0, 0, -8, .004);
  lightCard(.28, 6, -3, 2.8, 4, 9);
  lightCard(.23, 7, 3.6, .5, 2.5, 7);
  lightCard(6, .27, 0, 4, .8, 11);
  lightCard(4, .16, -1, -4, 3, .9);
  lightCard(.48, 6, 3, 3, -4, 8);
  lightCard(.36, 6, -3, 1, -3, 7);
  lightCard(3.5, 5, -5, 2, 3, 2.5);
  lightCard(3, 5, 4, -1, 4, 1.4);
  lightCard(8, 2.5, 0, 5, 2, 1.6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, .09);
  scene.environment = environment.texture;
  pmrem.dispose();
  environmentScene.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });

  const emblem = new THREE.Group();
  const faceMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 1,
    roughness: .33,
    clearcoat: .32,
    clearcoatRoughness: .25,
    envMapIntensity: 1.05,
  });
  const blades=createBladeBuilder(window.DX_LOGO_SHAPES,window.DX_LOGO_META||{});
  let triangleCount=0,boundaryError=0;
  for(const source of window.DX_LOGO_SHAPES){
    const geometry=blades.build(source);
    triangleCount+=geometry.attributes.position.count/3;
    boundaryError=Math.max(boundaryError,geometry.userData.boundaryError);
    const mesh=new THREE.Mesh(geometry,faceMaterial);
    mesh.castShadow=true;
    // The object still casts a soft shadow; avoiding self-shadow acne on the
    // razor-thin edges keeps the reflected highlights clean and continuous.
    mesh.receiveShadow=false;
    emblem.add(mesh);
  }
  blades.release();
  scene.add(emblem);

  const key = new THREE.DirectionalLight(0xf1f4ff, .65);
  key.position.set(-3.2, 5.5, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -3.4;
  key.shadow.camera.right = key.shadow.camera.top = 3.4;
  key.shadow.normalBias = .018;
  key.shadow.bias = -.0006;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbec9da, .06);
  fill.position.set(4, -.5, 3);
  scene.add(fill);
  const back = new THREE.DirectionalLight(0xd8e1ee, 1.3);
  back.position.set(1, 3, -3);
  scene.add(back);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ color: 0x000000, opacity: .6 }));
  shadow.position.z = -.54;
  shadow.receiveShadow = true;
  scene.add(shadow);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0;
  let previousTime = 0, elapsed = 0, frame = 0;
  const visibleBounds = new THREE.Box3();
  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    const pixelRatio=Math.min(Math.max(devicePixelRatio||1,1.75),2.25,Math.max(1,Math.sqrt(4800000/(width*height))));
    renderer.setPixelRatio(pixelRatio);
    canvas.dataset.antialiasScale=pixelRatio.toFixed(2);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const desiredViewHeight = Math.max(4.8, 4.5 / (camera.aspect * .92));
    camera.position.z = Math.max(4.078/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*.84),4.5/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect*.92)) + .55;
    camera.updateProjectionMatrix();
    if (reduced.matches) render(0);
  }
  function render(time) {
    if (!reduced.matches && time - previousTime < 25) {
      frame = requestAnimationFrame(render);
      return;
    }
    const delta = Math.min(.06, previousTime ? (time - previousTime) / 1000 : 0);
    previousTime = time;
    if (!reduced.matches) elapsed += delta;
    smoothX += (pointerX - smoothX) * .045;
    smoothY += (pointerY - smoothY) * .045;
    emblem.rotation.y = -.22 + (reduced.matches ? 0 : elapsed * .16) + smoothX * .035;
    emblem.rotation.x = .035 + smoothY * .035;
    emblem.rotation.z = reduced.matches ? 0 : Math.sin(elapsed * .19) * .018;
    renderer.render(scene, camera);
    canvas.dataset.rotation = emblem.rotation.y.toFixed(3);
    if (!reduced.matches) frame = requestAnimationFrame(render);
  }
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('pointermove', event => {
    pointerX = event.clientX / innerWidth * 2 - 1;
    pointerY = event.clientY / innerHeight * 2 - 1;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    previousTime = 0;
    if (!document.hidden) frame = requestAnimationFrame(render);
  });
  reduced.addEventListener('change', () => {
    cancelAnimationFrame(frame);
    previousTime = 0;
    frame = requestAnimationFrame(render);
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    canvas.hidden = true;
    fallback.hidden = false;
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  canvas.dataset.triangles = String(triangleCount);
  canvas.dataset.surface = 'continuous-blade';
  canvas.dataset.edgeProfile='knife-all-boundaries';
  canvas.dataset.boundaryError=String(boundaryError);
  canvas.dataset.relief='ready';
  canvas.dataset.sharpTips=String(blades.tips);
  canvas.dataset.renderer = 'three-webgl';
  fallback.hidden = true;
  resize();
  frame = requestAnimationFrame(render);
})();
