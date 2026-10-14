// Проба Б: богатый живой 3D. three 0.160 + аддоны: HDRI, отражающий пол, bloom.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const lowEnd = matchMedia('(max-width:640px)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf1e4df);
scene.fog = new THREE.Fog(0xf1e4df, 14, 26);
const camera = new THREE.PerspectiveCamera(lowEnd ? 55 : 45, innerWidth / innerHeight, 0.1, 60);
const camBase = new THREE.Vector3(0, 1.55, 6.8), look = new THREE.Vector3(0, 1.25, -2);

const manager = new THREE.LoadingManager(() => { document.getElementById('load').hidden = true; });
const tex = new THREE.TextureLoader(manager);
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader(manager).load('/proby/hdr.hdr',
  hdr => { scene.environment = pmrem.fromEquirectangular(hdr).texture; hdr.dispose(); },
  undefined,
  () => { scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; });

// ---- Мрамор (фото-текстуры Poly Haven), подкрашен в розовый ----
function marble(rep, tint, opts = {}) {
  const set = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t; };
  const map = set(tex.load('/proby/marble_diff.jpg')); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map, color: tint, roughnessMap: set(tex.load('/proby/marble_rough.jpg')),
    normalMap: set(tex.load('/proby/marble_nor.jpg')), normalScale: new THREE.Vector2(.4, .4),
    roughness: .55, metalness: 0, ...opts
  });
}
const brass = new THREE.MeshStandardMaterial({ color: 0xd2a96c, metalness: 1, roughness: .22 });
const plaster = new THREE.MeshStandardMaterial({ color: 0xf6ece6, roughness: .92 });
const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 1.2) }); // ярче 1 — ловит bloom

// ---- Пол: зеркало + полупрозрачный мрамор поверх = глянцевый мрамор с отражениями ----
const mirror = new Reflector(new THREE.PlaneGeometry(30, 30), {
  textureWidth: innerWidth * (lowEnd ? .5 : 1), textureHeight: innerHeight * (lowEnd ? .5 : 1), color: 0xb9a9a6
});
mirror.rotation.x = -Math.PI / 2; scene.add(mirror);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), marble(6, 0xf4cfd2, { transparent: true, opacity: .78, roughness: .3 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = .002; floor.receiveShadow = true; scene.add(floor);

// ---- Стены и три арочные ниши ----
const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 9), plaster); back.position.set(0, 4.5, -4); back.receiveShadow = true; scene.add(back);
[-7, 7].forEach(x => { const w = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), plaster); w.position.set(x, 4.5, 3); w.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(w); });
function arch(w, h) { const s = new THREE.Shape(); s.moveTo(-w, 0); s.lineTo(-w, h); s.absarc(0, h, w, Math.PI, 0, true); s.lineTo(w, 0); s.lineTo(-w, 0); return s; }
const nicheMat = marble(2, 0xfbe6e6, { roughness: .6 });
const products = ['/proby/p1.jpg', '/proby/p2.jpg', '/proby/p3.jpg', '/proby/p4.jpg'];
const garmentMats = products.map(src => {
  const m = new THREE.MeshStandardMaterial({ map: tex.load(src, t => { t.colorSpace = THREE.SRGBColorSpace; }), roughness: .85, alphaTest: .5, side: THREE.DoubleSide });
  // белый фон фото вырезаем прямо в шейдере: светлые и бесцветные пиксели становятся прозрачными
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { vec3 c = diffuseColor.rgb; float l = dot(c, vec3(.299,.587,.114)); float sat = max(c.r,max(c.g,c.b)) - min(c.r,min(c.g,c.b));
        if (l > .80 && sat < .09) diffuseColor.a = 0.0; }`);
  };
  return m;
});
[-3.4, 0, 3.4].forEach((x, ni) => {
  const g = new THREE.Group(); g.position.set(x, 0, -3.95); scene.add(g);
  const sp = arch(1.25, 2.4);
  const n = new THREE.Mesh(new THREE.ShapeGeometry(sp, 48), nicheMat); n.position.z = .01; g.add(n);
  const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp.getPoints(80).slice(0, -1).map(p => new THREE.Vector3(p.x, p.y, 0))), 160, .025, 8), brass);
  edge.position.z = .03; g.add(edge);
  const led = new THREE.Mesh(new THREE.BoxGeometry(2.3, .02, .02), glowMat); led.position.set(0, 3.55, .08); g.add(led);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 2.1, 16), brass); rail.rotation.z = Math.PI / 2; rail.position.set(0, 2.15, .35); rail.castShadow = true; g.add(rail);
  [-1.05, 1.05].forEach(rx => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1.4, 8), brass); r.position.set(rx, 2.85, .35); g.add(r); });
  for (let i = 0; i < 4; i++) {
    const it = new THREE.Mesh(new THREE.PlaneGeometry(.62, .93), garmentMats[(i + ni) % 4]);
    it.position.set(-.72 + i * .48, 1.66, .38 + (i % 2) * .04); it.rotation.y = (i - 1.5) * .06; it.castShadow = true;
    g.add(it);
  }
});

// ---- Остров из розового мрамора в центре (как в референсе VANDALL) ----
const island = new THREE.Mesh(new THREE.BoxGeometry(2.4, .9, 1.1), marble(1, 0xf2c3c8, { roughness: .25 }));
island.position.set(0, .45, -.2); island.castShadow = true; island.receiveShadow = true; scene.add(island);
const lip = new THREE.Mesh(new THREE.BoxGeometry(2.44, .02, 1.14), brass); lip.position.set(0, .905, -.2); scene.add(lip);

// ---- Люстра: латунные кольца + светящиеся лампы + хрусталь ----
const ch = new THREE.Group(); ch.position.set(0, 4.1, -.2); scene.add(ch);
[[.75, 0], [.45, .3]].forEach(([r, y]) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, .022, 12, 72), brass); t.rotation.x = Math.PI / 2; t.position.y = y; ch.add(t); });
const rod = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 2, 8), brass); rod.position.y = 1.2; ch.add(rod);
const crystal = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: .02, transmission: .9, thickness: .2, ior: 1.6 });
for (let i = 0; i < 12; i++) {
  const a = i / 12 * Math.PI * 2, r = i % 2 ? .45 : .75, y = i % 2 ? .3 : 0;
  const b = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), glowMat); b.position.set(Math.cos(a) * r, y + .08, Math.sin(a) * r); ch.add(b);
  for (let k = 1; k <= 3; k++) { const d = new THREE.Mesh(new THREE.OctahedronGeometry(.035), crystal); d.scale.y = 1.8; d.position.set(Math.cos(a) * r, y - .1 * k, Math.sin(a) * r); ch.add(d); }
}

// ---- Свет: тёплый софтбокс сверху с мягкими тенями + подсветка ниш ----
scene.add(new THREE.HemisphereLight(0xfff6ef, 0xe8cfc9, .6));
const key = new THREE.SpotLight(0xffe8d2, 60, 0, .7, .6, 2); key.position.set(0, 7, 3); key.target.position.set(0, 0, -1.5);
key.castShadow = true; key.shadow.mapSize.set(lowEnd ? 512 : 1024, lowEnd ? 512 : 1024); key.shadow.bias = -.0004; key.shadow.radius = 6;
scene.add(key, key.target);
[-3.4, 0, 3.4].forEach(x => { const s = new THREE.SpotLight(0xfff0e0, 14, 0, .5, .8, 2); s.position.set(x, 4.4, -2.6); s.target.position.set(x, 1.5, -4); scene.add(s, s.target); });

// ---- Пост-эффекты: мягкое свечение ламп ----
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .45, .55, .92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- Живая камера: лёгкий параллакс за мышью/пальцем ----
const aim = new THREE.Vector2(), cur = new THREE.Vector2();
addEventListener('pointermove', e => { aim.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

const fpsEl = document.getElementById('fps'); let frames = 0, t0 = performance.now();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  cur.lerp(aim, .05);
  camera.position.set(camBase.x + cur.x * .6, camBase.y - cur.y * .25, camBase.z);
  camera.lookAt(look);
  ch.rotation.y = t * .05;
  composer.render();
  frames++; const now = performance.now();
  if (now - t0 > 1000) { fpsEl.textContent = Math.round(frames * 1000 / (now - t0)) + ' кадр/с'; frames = 0; t0 = now; }
});
