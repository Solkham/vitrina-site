// Проба В: три 3D-каталки в одной сцене (сцена, свет, пол, фон — из пробы Б). three 0.160.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const lowEnd = matchMedia('(max-width:640px)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const portrait = innerWidth / innerHeight < .8;
const basePR = Math.min(devicePixelRatio, lowEnd ? 1.5 : 2);

// шрифт нужен для подписи на каталке (рисуется в canvas), ждём не дольше 1.5 с
try { await Promise.race([Promise.all([document.fonts.load('64px "Tenor Sans"'), document.fonts.load('500 32px "Golos Text"')]), new Promise(r => setTimeout(r, 1500))]); } catch {}

const renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: 'high-performance' });
renderer.setPixelRatio(basePR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // дешёвые мягкие тени: 1 источник, радиус размытия
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf1e4df); // резкий фон, без размытия
scene.fog = new THREE.Fog(0xf1e4df, 14, 26);
const camera = new THREE.PerspectiveCamera(lowEnd ? 55 : 45, innerWidth / innerHeight, 0.1, 60);
const RACK_Z = -.4, LOOK = new THREE.Vector3(0, 1.2, RACK_Z);

const manager = new THREE.LoadingManager(() => { document.getElementById('load').hidden = true; });
const tex = new THREE.TextureLoader(manager);
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader(manager).load('/proby/hdr.hdr',
  hdr => { scene.environment = pmrem.fromEquirectangular(hdr).texture; hdr.dispose(); },
  undefined,
  () => { scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; });

// ---- Материалы ----
function marble(rep, tint, opts = {}) {
  const set = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t; };
  const map = set(tex.load('/proby/marble_diff.jpg')); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map, color: tint, roughnessMap: set(tex.load('/proby/marble_rough.jpg')),
    normalMap: set(tex.load('/proby/marble_nor.jpg')), normalScale: new THREE.Vector2(.4, .4),
    roughness: .55, metalness: 0, ...opts
  });
}
const brass = new THREE.MeshStandardMaterial({ color: 0xd2a96c, metalness: 1, roughness: .2 });
const brassMirror = new THREE.MeshStandardMaterial({ color: 0xdcb272, metalness: 1, roughness: .07, envMapIntensity: 1.4 }); // зеркальная латунь
const plaster = new THREE.MeshStandardMaterial({ color: 0xf6ece6, roughness: .92 });
const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a42, roughness: .5, metalness: 0 });
const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.55, 1.3) });

// ---- Пол: зеркало + полупрозрачный мрамор (как в пробе Б) ----
const mirror = new Reflector(new THREE.PlaneGeometry(30, 30), {
  textureWidth: innerWidth * (lowEnd ? .5 : .8), textureHeight: innerHeight * (lowEnd ? .5 : .8), color: 0xb9a9a6
});
mirror.rotation.x = -Math.PI / 2; scene.add(mirror);
const floorMat = marble(6, 0xf4cfd2, { transparent: true, opacity: .78, roughness: .3 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.y = .002; floor.receiveShadow = true; scene.add(floor);

// ---- Стены и одна большая арочная ниша за каталкой ----
const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 9), plaster); back.position.set(0, 4.5, -4); scene.add(back);
[-7, 7].forEach(x => { const w = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), plaster); w.position.set(x, 4.5, 3); w.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(w); });
function arch(w, h) { const s = new THREE.Shape(); s.moveTo(-w, 0); s.lineTo(-w, h); s.absarc(0, h, w, Math.PI, 0, true); s.lineTo(w, 0); s.lineTo(-w, 0); return s; }
{
  const g = new THREE.Group(); g.position.set(0, 0, -3.95); scene.add(g);
  const sp = arch(2.2, 2.6);
  const n = new THREE.Mesh(new THREE.ShapeGeometry(sp, 48), marble(2, 0xfbe6e6, { roughness: .6 })); n.position.z = .01; g.add(n);
  const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp.getPoints(80).slice(0, -1).map(p => new THREE.Vector3(p.x, p.y, 0))), 160, .028, 8), brass);
  edge.position.z = .03; g.add(edge);
  const wash = new THREE.SpotLight(0xfff0e0, 16, 0, .6, .8, 2); wash.position.set(0, 4.6, -2.2); wash.target.position.set(0, 1.6, -4); scene.add(wash, wash.target);
}

// ---- Свет: один софтбокс с мягкой тенью (единственный источник теней) ----
scene.add(new THREE.HemisphereLight(0xfff6ef, 0xe8cfc9, .6));
const key = new THREE.SpotLight(0xffe8d2, 70, 0, .46, .75, 2); key.position.set(1.6, 5.6, 4.6); key.target.position.set(0, 1.2, RACK_Z);
key.castShadow = true; key.shadow.mapSize.set(lowEnd ? 512 : 1024, lowEnd ? 512 : 1024);
key.shadow.bias = -.0005; key.shadow.normalBias = .02; key.shadow.radius = 3.5;
scene.add(key, key.target);

// ---- Вещи: фото-вырезки (public/zal/*.webp, прозрачный фон) ----
const KINDS = {
  p1: { src: '/zal/p1.webp', ar: 419 / 820, h: 1.3 },
  p3: { src: '/zal/p3.webp', ar: 364 / 756, h: 1.2 },
  p4: { src: '/zal/p4.webp', ar: 226 / 820, h: 1.35 }
};
const ORDER = ['p1', 'p3', 'p4']; // m1/m2 — мужские вырезки с обрезанным краем, в женский зал не берём
for (const k of Object.values(KINDS)) {
  const map = tex.load(k.src, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; });
  k.mat = new THREE.MeshStandardMaterial({
    map, roughness: .88, alphaTest: .5, side: THREE.DoubleSide, alphaToCoverage: !lowEnd,
    emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .22 // фото уже со светом, не даём ему потемнеть
  });
  // слегка изогнутая плоскость: ткань выгибается вперёд, к низу складки
  const w = k.ar * k.h, geo = new THREE.PlaneGeometry(w, k.h, 10, 16); geo.translate(0, -k.h / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (w / 2), d = -p.getY(i) / k.h;
    p.setZ(i, .05 * (1 - u * u) * (.5 + .5 * d) + Math.sin(u * 3.2 + d * 2) * .012 * d);
  }
  geo.computeVertexNormals(); k.geo = geo; k.w = w;
}

// ---- Подпись магазина на латуни: рисуем в canvas ----
function plaqueTexture(name, sub, ratio) {
  const W = 1024, H = Math.round(W / ratio), c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#dcb677'); g.addColorStop(.5, '#e9cd96'); g.addColorStop(1, '#c79c5e');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(70,45,18,.45)'; x.lineWidth = 3; x.strokeRect(14, 14, W - 28, H - 28);
  x.fillStyle = '#35230f'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `${Math.round(H * .46)}px "Tenor Sans", Georgia, serif`; x.fillText(name, W / 2, H * .40);
  x.font = `500 ${Math.round(H * .17)}px "Golos Text", system-ui, sans-serif`; x.fillText(sub, W / 2, H * .79);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function plaqueMat(name, sub, ratio) { return new THREE.MeshStandardMaterial({ map: plaqueTexture(name, sub, ratio), metalness: .85, roughness: .32 }); }
const SHOP = 'ЛЕЙЛА', SHOP_SUB = 'НАЗРАНЬ · ВЕЧЕРНИЕ ПЛАТЬЯ';

// ---- Деревянное плечико + латунный крюк, качается вокруг крюка ----
const sways = [];
function hangerItem(kind, x, y, z, i) {
  const k = KINDS[kind], pivot = new THREE.Group(); pivot.position.set(x, y, z);
  const hw = Math.min(.46, k.w * 1.02);
  const hc = new THREE.CatmullRomCurve3([[-hw / 2, -.15], [-hw / 4, -.095], [0, -.07], [hw / 4, -.095], [hw / 2, -.15]].map(([a, b]) => new THREE.Vector3(a, b, 0)));
  const h = new THREE.Mesh(new THREE.TubeGeometry(hc, 20, .008, 6), wood); h.scale.z = .75; h.position.z = .012; h.castShadow = true; pivot.add(h);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.0035, .0035, .05, 6), brass); stem.position.y = -.05; pivot.add(stem);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.024, .0035, 6, 20, Math.PI * 1.5), brass); ring.rotation.set(0, Math.PI / 2, Math.PI / 2); pivot.add(ring);
  const cloth = new THREE.Mesh(k.geo, k.mat); cloth.position.set(0, -.12, 0); cloth.castShadow = true; pivot.add(cloth);
  pivot.rotation.y = ((i * 37) % 7 - 3) * .022; // базовый разворот у каждой вещи свой
  sways.push({ g: pivot, baseY: pivot.rotation.y, ph: i * 1.7 + 1, wx: 1.9 + (i % 3) * .21, wz: 1.3 + (i % 4) * .17, amp: .05 + (i % 3) * .015, t0: -i * 1.3, next: 2 + i * .9 });
  return pivot;
}
// ряд вещей на штанге, слои по глубине (разный z у соседей)
const ZL = [0, .09, .04];
function garmentRow(group, n, y, z, startKind = 0, spacing = .46, shift = 0) {
  const x0 = shift - (n - 1) * spacing / 2;
  for (let i = 0; i < n; i++) group.add(hangerItem(ORDER[(i + startKind) % 3], x0 + i * spacing, y, z + ZL[i % 3], i + startKind * 3));
}
const cyl = (r, len, mat, rot) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20), mat); if (rot === 'x') m.rotation.z = Math.PI / 2; if (rot === 'z') m.rotation.x = Math.PI / 2; return m; };
const ball = (r, mat) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
// мягкое пятно-тень на полу под основанием (дёшево, вместо второй карты теней)
const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 6, 64, 64, 64); g.addColorStop(0, 'rgba(40,20,22,.7)'); g.addColorStop(1, 'rgba(40,20,22,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
function blob(w, d) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: .6 })); m.rotation.x = -Math.PI / 2; m.position.y = .006; m.renderOrder = 1; return m; }

const N = portrait ? 4 : 6; // на узком экране вещей меньше
const variants = {};

// ======== А «Подвесная»: латунные штанги на тросах от потолка, ничего не стоит на полу ========
{
  const g = new THREE.Group(); g.position.z = RACK_Z;
  const bar = (len, y, z) => {
    const b = cyl(.018, len, brass, 'x'); b.position.set(0, y, z); g.add(b);
    [-1, 1].forEach(s => {
      const cx = s * (len / 2 - .12);
      const cable = cyl(.0035, 6 - y, brass); cable.position.set(cx, y + (6 - y) / 2, z); g.add(cable);
      const clamp = cyl(.014, .05, brassMirror); clamp.position.set(cx, y + .02, z); g.add(clamp);
    });
  };
  const len = N * .46 + (portrait ? 1.5 : 2.0);
  bar(len, 2.05, 0); garmentRow(g, N, 2.05, 0, 0, .46, -.45);
  bar(len - .9, 2.2, -.55); g.children[g.children.length - 1].position.x = -.45; garmentRow(g, N - 1, 2.2, -.55, 1, .46, -.45); // вторая штанга сзади — глубина
  // подпись: латунная табличка висит на двух тонких стержнях с правого края передней штанги
  const pw = portrait ? 1.0 : .72, ph = pw * .26, px = len / 2 - pw / 2 - .08;
  const pl = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, .012), plaqueMat(SHOP, SHOP_SUB, pw / ph)); pl.position.set(px, 1.55, .06); pl.castShadow = true; g.add(pl);
  [-1, 1].forEach(s => { const r = cyl(.003, .42, brassMirror); r.position.set(px + s * pw * .4, 1.55 + ph / 2 + .21, .06); g.add(r); });
  g.userData = { half: len / 2 + .1, top: 2.3 }; variants.a = g;
}

// ======== Б «Мраморная»: зеркальная латунь + монолитная плита розового мрамора с фаской, без колёс ========
{
  const g = new THREE.Group(); g.position.z = RACK_Z;
  const W = N * .46 + .55, D = 1.0, H = .32, bev = .028;
  const sh = new THREE.Shape(); sh.moveTo(-W / 2 + bev, -D / 2 + bev); sh.lineTo(W / 2 - bev, -D / 2 + bev); sh.lineTo(W / 2 - bev, D / 2 - bev); sh.lineTo(-W / 2 + bev, D / 2 - bev); sh.closePath();
  const slabGeo = new THREE.ExtrudeGeometry(sh, { depth: H - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 });
  slabGeo.rotateX(-Math.PI / 2); slabGeo.computeBoundingBox(); slabGeo.translate(0, -slabGeo.boundingBox.min.y, 0);
  const slab = new THREE.Mesh(slabGeo, marble(.45, 0xf2c3c8, { roughness: .2 })); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
  g.add(blob(W + .9, D + .9));
  // рама: две торцевые рамки (по 2 стойки + перекладина), по центру — длинная штанга
  const px = W / 2 - .16, pz = .32, top = 2.08;
  [-1, 1].forEach(s => {
    [-1, 1].forEach(t => {
      const post = cyl(.022, top - H, brassMirror); post.position.set(s * px, H + (top - H) / 2, t * pz); g.add(post);
      const foot = cyl(.04, .014, brassMirror); foot.position.set(s * px, H + .007, t * pz); g.add(foot);
      const kn = ball(.034, brassMirror); kn.position.set(s * px, top, t * pz); g.add(kn);
    });
    const cr = cyl(.02, pz * 2, brassMirror, 'z'); cr.position.set(s * px, top, 0); g.add(cr);
  });
  const rail = cyl(.02, px * 2, brassMirror, 'x'); rail.position.set(0, top, 0); g.add(rail);
  garmentRow(g, N, top, 0, 1);
  // подпись: латунная пластина в передней грани плиты
  const pw = Math.min(W - .5, portrait ? 1.7 : 1.15), ph = portrait ? .24 : .17;
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), plaqueMat(SHOP, SHOP_SUB, pw / ph)); pl.position.set(0, H / 2, D / 2 + bev + .002); g.add(pl);
  g.userData = { half: W / 2 + .3, top: 2.2 }; variants.b = g;
}

// ======== В «Витрина-куб»: стеклянный шкаф на тонкой латунной раме, тёплые лампы с конусами света ========
// transmission (?glass=hi): дорогой, рендерит сцену ещё раз; в тесте дал мутную заливку, поэтому по умолчанию — прозрачное стекло с отражением
const hiGlass = new URLSearchParams(location.search).get('glass') === 'hi';
const glassHi = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: .03, transmission: 1, thickness: .02, ior: 1.5, envMapIntensity: 1.3 });
const glassLo = new THREE.MeshPhysicalMaterial({ color: 0xf4fbff, metalness: 0, roughness: .03, transparent: true, opacity: .16, envMapIntensity: 2.2, ior: 1.5, depthWrite: false });
let glassPanes = [];
const coneLights = [], coneMeshes = [];
{
  const g = new THREE.Group(); g.position.z = RACK_Z;
  const W = N * .46 + .5, D = .95, H = 2.4, base = .12, fr = .013;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + .08, base, D + .08), brassMirror); plinth.position.y = base / 2; plinth.castShadow = true; plinth.receiveShadow = true; g.add(plinth);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(W - .02, .035, D - .02), marble(.5, 0xf2c3c8, { roughness: .22 })); shelf.position.y = base + .0175; shelf.receiveShadow = true; g.add(shelf);
  g.add(blob(W + .8, D + .8));
  const y0 = base + .035, y1 = y0 + H, hx = W / 2, hz = D / 2;
  // 12 рёбер рамы
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => { const p = cyl(fr, H, brass); p.position.set(sx * hx, y0 + H / 2, sz * hz); g.add(p); });
  [-1, 1].forEach(sy => {
    const y = sy < 0 ? y0 : y1;
    [-1, 1].forEach(s => { const a = cyl(fr, W, brass, 'x'); a.position.set(0, y, s * hz); g.add(a); const b = cyl(fr, D, brass, 'z'); b.position.set(s * hx, y, 0); g.add(b); });
  });
  // верхняя панель-карниз с подписью
  const capH = portrait ? .34 : .22, pw = Math.min(W - .3, portrait ? 2.0 : 1.2), ph = portrait ? .26 : .16;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(W + .08, capH, D + .08), brassMirror); cap.position.y = y1 + capH / 2; g.add(cap);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), plaqueMat(SHOP, SHOP_SUB, pw / ph)); pl.position.set(0, y1 + capH / 2, hz + .045); g.add(pl);
  // стёкла: перед, зад, бока (не отбрасывают тень)
  const pane = (w, h, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), hiGlass ? glassHi : glassLo); m.position.set(x, y0 + H / 2, z); m.rotation.y = ry; m.renderOrder = 2; g.add(m); glassPanes.push(m); };
  pane(W, H, 0, hz, 0); pane(W, H, 0, -hz, Math.PI); pane(D, H, hx, 0, Math.PI / 2); pane(D, H, -hx, 0, -Math.PI / 2);
  // штанга внутри и вещи
  const ry = y1 - .12;
  const rail = cyl(.016, W, brass, 'x'); rail.position.set(0, ry, 0); g.add(rail);
  garmentRow(g, N, ry, 0, 2, .43);
  // лампы под карнизом и мягкие конусы света
  [-1, 0, 1].forEach(s => {
    const lx = s * W * .3;
    const can = cyl(.034, .07, brassMirror); can.position.set(lx, y1 - .035, .02); g.add(can);
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(.026, 16), glowMat); bulb.rotation.x = Math.PI / 2; bulb.position.set(lx, y1 - .072, .02); g.add(bulb);
    const sl = new THREE.SpotLight(0xffd9a8, 5, 0, .55, 1, 2); sl.position.set(lx, y1 - .08, .02); sl.target.position.set(lx, y0, .02); g.add(sl, sl.target); coneLights.push(sl);
    const ch = 2.0, cone = new THREE.Mesh(new THREE.ConeGeometry(.5, ch, 28, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { col: { value: new THREE.Color(1, .82, .56) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec2 vU; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=-mv.xyz; vU=uv; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 col; varying vec3 vN; varying vec3 vV; varying vec2 vU; void main(){ float f=pow(abs(dot(normalize(vN),normalize(vV))),1.6); float a=f*pow(vU.y,1.3)*.2; gl_FragColor=vec4(col*a,a); }'
    }));
    cone.position.set(lx, y1 - .08 - ch / 2, .02); cone.renderOrder = 3; g.add(cone); coneMeshes.push(cone);
  });
  g.userData = { half: W / 2 + .4, top: 3.1 }; variants.c = g;
}
Object.values(variants).forEach(v => { v.visible = false; scene.add(v); });

// ---- Переключатель: A / Б / В (+ #a #b #c в адресе) ----
let current = null;
const tabs = [...document.querySelectorAll('#tabs button')];
let warmUntil = 0;
function show(id) {
  if (!variants[id]) id = 'a';
  current = id;
  for (const k in variants) variants[k].visible = k === id;
  tabs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === id)));
  history.replaceState(null, '', location.pathname + location.search + '#' + id);
  warmUntil = performance.now() + 2500;
  fitDist();
}
tabs.forEach(b => b.addEventListener('click', () => show(b.dataset.v)));

// ---- Качество: падаем по ступеням, если кадров < 30 ----
const qParam = new URLSearchParams(location.search).get('q'); // ?q=0|1|2 — зафиксировать качество (для проверки)
let level = qParam == null ? 0 : +qParam;
const fpsEl = document.getElementById('fps');
function applyLevel() {
  const pr = level === 0 ? basePR : level === 1 ? Math.min(basePR, 1.25) : 1;
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
  const rt = mirror.getRenderTarget(), f = level === 0 ? (lowEnd ? .5 : .8) : .35;
  rt.setSize(innerWidth * f, innerHeight * f);
  const glass = level === 0 && !lowEnd && hiGlass ? glassHi : glassLo;
  glassPanes.forEach(m => { m.material = glass; });
  if (level >= 2) { mirror.visible = false; floorMat.transparent = false; floorMat.opacity = 1; floorMat.needsUpdate = true; key.castShadow = false; coneLights.forEach(l => { l.visible = false; }); }
}
if (level) applyLevel();

// ---- Камера: живая от мыши/пальца + медленный дрейф вперёд ----
const aim = new THREE.Vector2(), cur = new THREE.Vector2();
addEventListener('pointermove', e => { aim.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); });
let dist0 = 4.7;
function fitDist() { // чтобы каталка помещалась по ширине и высоте на любом экране (с запасом на дрейф вперёд)
  const { half, top } = variants[current].userData, th = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  dist0 = Math.max(4.7, half / (th * camera.aspect) * 1.12, top * .62 / th * 1.25);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); fitDist();
  renderer.setSize(innerWidth, innerHeight);
});

show((location.hash || '#a').slice(1));
// шейдеры всех трёх вариантов собираем заранее, чтобы переключение не подвисало
{ const was = current; for (const k in variants) { show(k); renderer.compile(scene, camera); } show(was); }

const clock = new THREE.Clock(); const DRIFT = 22; // секунд на дрейф вперёд
let frames = 0, t0 = performance.now(), lowCount = 0;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  const ease = reduced ? 0 : (s => s * s * (3 - 2 * s))(Math.min(t / DRIFT, 1));
  const dist = dist0 * (1 - .22 * ease) + (reduced ? 0 : Math.sin(t * .35) * .04);
  cur.lerp(aim, .05);
  const k = reduced ? .4 : 1;
  camera.position.set(cur.x * .7 * k, 1.5 - cur.y * .28 * k, RACK_Z + dist);
  camera.lookAt(LOOK.x + cur.x * .15 * k, LOOK.y, LOOK.z);
  // маятник: удар лёгкого сквозняка, затем затухание; три колебания (вперёд-назад, вбок, кручение)
  if (!reduced) for (const s of sways) {
    if (t >= s.next) { s.t0 = t; s.amp = .05 + Math.random() * .05; s.next = t + 5 + Math.random() * 5; }
    const e = Math.exp(-(t - s.t0) * .38), tt = t - s.t0;
    s.g.rotation.x = s.amp * .5 * e * Math.sin(s.wx * tt + s.ph);
    s.g.rotation.z = s.amp * .55 * e * Math.sin(s.wz * tt + s.ph * 1.3) + Math.sin(t * .6 + s.ph) * .004;
    s.g.rotation.y = s.baseY + s.amp * 1.6 * e * Math.sin((s.wz * .6) * tt + s.ph * .7);
  }
  renderer.render(scene, camera);
  frames++; const now = performance.now();
  if (now - t0 > 1000) {
    const f = frames * 1000 / (now - t0);
    fpsEl.textContent = Math.round(f) + ' кадр/с' + (level ? ' · Q' + (3 - level) : '');
    if (now > warmUntil && !document.hidden && f < 30 && level < 2 && qParam == null) { if (++lowCount >= 2) { lowCount = 0; level++; applyLevel(); warmUntil = now + 2500; } } else lowCount = 0;
    frames = 0; t0 = now;
  }
});
