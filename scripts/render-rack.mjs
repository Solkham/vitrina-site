// Рендер каркаса каталки (сцена Б «Мраморная» из src/proby-c.js) в два прозрачных спрайта:
//   public/zal/rack-back.webp  — задние стойки, торцевые перекладины, верхняя штанга
//   public/zal/rack-front.webp — плита белого мрамора с фаской, передние стойки, пустая латунная табличка
// Вещи зала лежат между слоями. Запуск: node scripts/render-rack.mjs
// Нужны: playwright (из проекта или из кэша npx) и установленный Chromium; sharp — из проекта.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public/zal');
const MAX_KB = 150;

// ---- геометрия спрайта (CSS-размеры; файл выходит в 2x) ----
// Спрайт шире каталки на 12% (по 6% с каждой стороны) и по высоте равен ей: rack{aspect-ratio:1/1.2775}
const CSS_W = 640;
// два формата: десктоп (каталка 1 : 1.2775) и узкий телефон (1 : 2.5 — вещи там крупнее относительно каталки)
const VARIANTS = [{ suffix: '', css_h: 730, dpr: 2 }, { suffix: '-m', css_h: 1428, dpr: 1 }] // на телефоне каталка ~180 px: хватает 640 px ширины;
const VIEW_W = 3.79;            // ширина кадра в единицах сцены на плоскости штанги
const SLAB_W = 3.6, SLAB_D = 1.0, SLAB_H = .56, BEV = .03;
const POST_X = SLAB_W * .4727, POST_Z = .32;
const FOV = 20;

const pageHtml = (CSS_H, DPR) => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<body><script type="module">
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const P = ${JSON.stringify({ CSS_W, CSS_H, DPR, VIEW_W, SLAB_W, SLAB_D, SLAB_H, BEV, POST_X, POST_Z, FOV })};
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(P.DPR); renderer.setSize(P.CSS_W, P.CSS_H); renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const manager = new THREE.LoadingManager();
const tex = new THREE.TextureLoader(manager);
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader(manager).load('/proby/hdr.hdr',
  hdr => { scene.environment = pmrem.fromEquirectangular(hdr).texture; hdr.dispose(); },
  undefined,
  () => { scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; });

function marble(rep, tint, opts = {}) {
  const set = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t; };
  const map = set(tex.load('/proby/marble_diff.jpg')); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map, color: tint, roughnessMap: set(tex.load('/proby/marble_rough.jpg')),
    normalMap: set(tex.load('/proby/marble_nor.jpg')), normalScale: new THREE.Vector2(.4, .4),
    roughness: .55, metalness: 0, ...opts
  });
}
const brassMirror = new THREE.MeshStandardMaterial({ color: 0xdcb272, metalness: 1, roughness: .07, envMapIntensity: 1.4 });
const cyl = (r, len, mat, rot) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 28), mat); if (rot === 'x') m.rotation.z = Math.PI / 2; if (rot === 'z') m.rotation.x = Math.PI / 2; return m; };
const ball = (r, mat) => new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);

// ---- свет как в пробе Б ----
scene.add(new THREE.HemisphereLight(0xfff8f0, 0xe9e0d2, .6));
const key = new THREE.SpotLight(0xffeedd, 98, 0, .6, .75, 2); key.position.set(2.0, 7.0, 6.0); key.target.position.set(0, 1.9, 0);
scene.add(key, key.target);

// ---- кадр: ширина VIEW_W на плоскости штанги, низ плиты на 4,6% выше низа спрайта ----
const aspect = P.CSS_W / P.CSS_H, viewH = P.VIEW_W / aspect;
const yBot = -.2, yTop = yBot + viewH, yc = (yTop + yBot) / 2;
const dist = viewH / 2 / Math.tan(P.FOV / 2 * Math.PI / 180);
const camera = new THREE.PerspectiveCamera(P.FOV, aspect, 1, 80);
camera.position.set(0, yc, dist); camera.lookAt(0, yc, 0);
const topY = yTop - viewH * .10; // штанга на 10% высоты от верха — там же, где top у .items в зале

// ---- задний слой ----
const back = new THREE.Group(), front = new THREE.Group(); scene.add(back, front);
const postR = .032, postLen = topY - P.SLAB_H;
[-1, 1].forEach(s => {
  [[-1, back], [1, front]].forEach(([t, g]) => {
    const post = cyl(postR, postLen, brassMirror); post.position.set(s * P.POST_X, P.SLAB_H + postLen / 2, t * P.POST_Z); g.add(post);
    const foot = cyl(.062, .02, brassMirror); foot.position.set(s * P.POST_X, P.SLAB_H + .01, t * P.POST_Z); g.add(foot);
    const kn = ball(.054, brassMirror); kn.position.set(s * P.POST_X, topY + .01, t * P.POST_Z); g.add(kn);
  });
  const cr = cyl(.028, P.POST_Z * 2, brassMirror, 'z'); cr.position.set(s * P.POST_X, topY, 0); back.add(cr);
});
const rail = cyl(.03, P.POST_X * 2, brassMirror, 'x'); rail.position.set(0, topY, 0); back.add(rail);

// ---- передний слой: плита с фаской ----
const W = P.SLAB_W, D = P.SLAB_D, H = P.SLAB_H, bev = P.BEV;
const sh = new THREE.Shape(); sh.moveTo(-W / 2 + bev, -D / 2 + bev); sh.lineTo(W / 2 - bev, -D / 2 + bev); sh.lineTo(W / 2 - bev, D / 2 - bev); sh.lineTo(-W / 2 + bev, D / 2 - bev); sh.closePath();
const slabGeo = new THREE.ExtrudeGeometry(sh, { depth: H - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 });
slabGeo.rotateX(-Math.PI / 2); slabGeo.computeBoundingBox(); slabGeo.translate(0, -slabGeo.boundingBox.min.y, 0);
// белый/кремовый мрамор под пол зала (фон ~ rgb 213,206,195): одна процедурная текстура на всю плиту, без повторов
const mc = document.createElement('canvas'); mc.width = 2048; mc.height = 600;
const mx = mc.getContext('2d');
const mg = mx.createLinearGradient(0, 0, mc.width, mc.height);
mg.addColorStop(0, '#f6f1e8'); mg.addColorStop(.5, '#efe9de'); mg.addColorStop(1, '#f4efe6'); mx.fillStyle = mg; mx.fillRect(0, 0, mc.width, mc.height);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 70; i++) { // мягкие облачные пятна тёплого серого
  const cx = rnd() * mc.width, cy = rnd() * mc.height, r = 60 + rnd() * 200, rg = mx.createRadialGradient(cx, cy, 0, cx, cy, r);
  rg.addColorStop(0, 'rgba(190,178,158,' + (.05 + rnd() * .07) + ')'); rg.addColorStop(1, 'rgba(190,178,158,0)'); mx.fillStyle = rg; mx.fillRect(cx - r, cy - r, r * 2, r * 2);
}
function vein(x0, y0, ang, len, w, col) { // ломаная прожилка со случайным дрожанием
  mx.strokeStyle = col; mx.lineWidth = w; mx.lineCap = 'round'; mx.beginPath(); mx.moveTo(x0, y0);
  let x = x0, y = y0, a = ang; const n = Math.round(len / 18);
  for (let k = 0; k < n; k++) { a += (rnd() - .5) * .5; x += Math.cos(a) * 18; y += Math.sin(a) * 18; mx.lineTo(x, y); if (rnd() < .05) vein(x, y, a + (rnd() - .5) * 1.6, len * .35, w * .6, col); }
  mx.stroke();
}
for (let i = 0; i < 9; i++) vein(rnd() * mc.width, rnd() * mc.height, rnd() * 6.28, 500 + rnd() * 600, 1.3 + rnd() * 1.4, 'rgba(176,146,92,.5)');
for (let i = 0; i < 12; i++) vein(rnd() * mc.width, rnd() * mc.height, rnd() * 6.28, 400 + rnd() * 500, 2 + rnd() * 3, 'rgba(160,150,135,.22)');
const mtex = new THREE.CanvasTexture(mc); mtex.colorSpace = THREE.SRGBColorSpace; mtex.anisotropy = 8; mtex.wrapS = mtex.wrapT = THREE.RepeatWrapping;
mtex.repeat.set(1 / P.SLAB_W, 1 / P.SLAB_D); mtex.offset.set(.5, .5);
front.add(new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({ map: mtex, roughness: .25, metalness: 0 })));

// пустая латунная пластина (подпись магазина кладёт HTML)
const pw = 2.5, ph = .38;
const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * ph / pw);
const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, c.width, c.height);
g.addColorStop(0, '#dcb677'); g.addColorStop(.5, '#e9cd96'); g.addColorStop(1, '#c79c5e'); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
x.strokeStyle = 'rgba(120,84,40,.55)'; x.lineWidth = 6; x.strokeRect(10, 10, c.width - 20, c.height - 20);
x.strokeStyle = 'rgba(255,240,205,.5)'; x.lineWidth = 2; x.strokeRect(18, 18, c.width - 36, c.height - 36);
const ct = new THREE.CanvasTexture(c); ct.colorSpace = THREE.SRGBColorSpace; ct.anisotropy = 8;
const plate = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: ct, metalness: .85, roughness: .32 }));
plate.position.set(0, H / 2, D / 2 + bev + .002); front.add(plate);

// где табличка на спрайте (доли ширины/высоты) — для CSS
function proj(v) { const p = v.clone().project(camera); return [(p.x + 1) / 2, (1 - p.y) / 2]; }
const tl = proj(new THREE.Vector3(-pw / 2, H / 2 + ph / 2, D / 2 + bev)), br = proj(new THREE.Vector3(pw / 2, H / 2 - ph / 2, D / 2 + bev));
const slabTop = proj(new THREE.Vector3(0, H, D / 2)), slabTopFar = proj(new THREE.Vector3(0, H, -D / 2)), slabBottom = proj(new THREE.Vector3(0, 0, D / 2));
const railP = proj(new THREE.Vector3(0, topY, 0)), postL = proj(new THREE.Vector3(-P.POST_X, 0, 0)), postR_ = proj(new THREE.Vector3(P.POST_X, 0, 0));
window.metrics = { plaque: { l: tl[0], t: tl[1], r: br[0], b: br[1] }, slabTopFront: slabTop[1], slabTopFar: slabTopFar[1], slabBottom: slabBottom[1], rail: railP[1], postL: postL[0], postR: postR_[0] };

window.ready = new Promise(res => { manager.onLoad = res; });
window.show = layer => { back.visible = layer === 'back'; front.visible = layer === 'front'; renderer.render(scene, camera); };
</script></body>`;

// ---- статика: страница + three + /proby из public ----
const MIME = { '.js': 'text/javascript', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(pageHtml(...['h', 'dpr'].map(k => +new URL(req.url, 'http://x').searchParams.get(k)))); }
  const file = u.startsWith('/three/') ? path.join(root, 'node_modules', u) : path.join(root, 'public', u);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('no'); }
  res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// ---- playwright: из проекта, иначе из кэша npx ----
async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const npx = path.join(os.homedir(), '.npm/_npx');
  for (const d of fs.existsSync(npx) ? fs.readdirSync(npx) : []) {
    const p = path.join(npx, d, 'node_modules/playwright/index.mjs');
    if (fs.existsSync(p)) return import(pathToFileURL(p).href);
  }
  throw new Error('playwright не найден: npx playwright install chromium');
}
function findChromium() {
  const base = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const d of dirs) {
    for (const sub of ['chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-headless-shell-mac-x64/chrome-headless-shell']) {
      const p = path.join(base, d, sub); if (fs.existsSync(p)) return p;
    }
  }
}
const pw_ = await loadPlaywright();
const chromium = pw_.chromium || pw_.default.chromium;
const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
try {
  fs.mkdirSync(OUT, { recursive: true });
  for (const { suffix, css_h, dpr } of VARIANTS) {
    const page = await browser.newPage({ viewport: { width: CSS_W, height: css_h }, deviceScaleFactor: dpr });
    page.on('pageerror', e => console.error('page error:', e.message));
    page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
    await page.goto(base + `?h=${css_h}&dpr=${dpr}`);
    await page.waitForFunction(() => window.ready && window.metrics, null, { timeout: 60000 });
    await page.evaluate(() => window.ready);
    for (const layer of ['back', 'front']) {
      await page.evaluate(l => window.show(l), layer);
      const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: CSS_W, height: css_h } });
      let q = 82, buf;
      do { buf = await sharp(png).webp({ quality: q, alphaQuality: 90, effort: 6 }).toBuffer(); q -= 6; } while (buf.length > MAX_KB * 1024 && q > 30);
      const file = path.join(OUT, `rack-${layer}${suffix}.webp`);
      fs.writeFileSync(file, buf);
      const m = await sharp(buf).metadata();
      console.log(`${path.relative(root, file)}: ${m.width}x${m.height}, ${(buf.length / 1024).toFixed(1)} КБ, q=${q + 6}`);
    }
    const m = await page.evaluate(() => window.metrics);
    // доли относительно каталки: спрайт = left -6%, width 112%, высота та же
    const rx = v => ((v * 1.12 - .06) * 100).toFixed(2) + '%', ry = v => (v * 100).toFixed(2) + '%';
    console.log(`[${suffix || 'desktop'}] plaque in rack: left ${rx(m.plaque.l)} top ${ry(m.plaque.t)} width ${((m.plaque.r - m.plaque.l) * 112).toFixed(2)}% height ${((m.plaque.b - m.plaque.t) * 100).toFixed(2)}%`);
    console.log(`[${suffix || 'desktop'}] slab top front ${ry(m.slabTopFront)} far ${ry(m.slabTopFar)} bottom ${ry(m.slabBottom)} rail ${ry(m.rail)} posts ${rx(m.postL)} ${rx(m.postR)}`);
    await page.close();
  }
} finally {
  await browser.close(); server.close();
}
