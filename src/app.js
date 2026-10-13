import * as THREE from 'three';
import { sb, photoUrl, loadCatalog } from './sb.js';
const $=id=>document.getElementById(id);

const RUB = n => n.toLocaleString('ru-RU') + ' ₽';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Данные из базы ----
let CATALOG;
try{CATALOG=await loadCatalog()}catch(e){CATALOG={shops:[],products:[],error:e}}
const PALETTE_SIZES=['42','44','46','48','50'];
const SHOPS=CATALOG.shops.map(s=>({id:s.id,slug:s.slug,name:s.name,city:s.city,note:s.note||'',whatsapp:s.whatsapp||''}));
const shopIds=new Set(SHOPS.map(s=>s.id));
const ITEMS=CATALOG.products.filter(p=>shopIds.has(p.shop_id)).map(p=>{
  const ph=(p.product_photos||[]).slice().sort((a,b)=>a.sort-b.sort)[0];
  return {id:p.id,shop:p.shop_id,type:p.type==='other'?'dress':p.type,name:p.name,price:p.price,
    color:parseInt((p.color||'#888888').replace('#',''),16)||0x888888,gloss:.1,
    sizes:(p.sizes&&p.sizes.length?p.sizes:PALETTE_SIZES),isNew:!!p.is_new,photo:ph?photoUrl(ph.storage_path):null}});
if(!SHOPS.length){document.getElementById('hint').textContent=CATALOG.error?'Не удалось загрузить магазины. Обнови страницу.':'Витрина скоро откроется: магазины заполняют ниши.';}
// Раскладка: стеллажи стоят по сторонам экрана зигзагом (слева, справа ниже, слева ещё ниже…)
const STEP=1.5;
SHOPS.forEach((s,i)=>{s.side=i%2?1:-1;s.x=s.side*1.9;s.y=-i*STEP;s.ry=0;s.off=new THREE.Vector3(s.side*5,0,0)});
const FIT_Y=(SHOPS.length?SHOPS[SHOPS.length-1].y:0)-2.8; // примерочная в конце коридора
const MAX_SCROLL=-FIT_Y;
const CATS = {dress:'Платья', abaya:'Абайи', blouse:'Блузки', skirt:'Юбки'};
const byId = Object.fromEntries(ITEMS.map(i=>[i.id,i]));
const shopById = Object.fromEntries(SHOPS.map(s=>[s.id,s]));
SHOPS.forEach(sh=>sh.hasNew=ITEMS.some(i=>i.shop===sh.id&&i.isNew));
const hex = c => '#'+c.toString(16).padStart(6,'0');

// ---- Тариф доставки (пример): база + доплата за каждый доп. магазин в маршруте ----
const DELIVERY_BASE=250, DELIVERY_PER_SHOP=150; // тот же тариф считает place_order в базе

// ---- Three.js сцена ----
const stage=document.getElementById('stage'), canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.useLegacyLights=true;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xf3f1ee);
scene.fog=new THREE.Fog(0xf3f1ee,14,34);
const camera=new THREE.PerspectiveCamera(40,1,0.1,80);

const hemi=new THREE.HemisphereLight(0xffffff,0xd9d4cc,0.85); scene.add(hemi);
const fill=new THREE.DirectionalLight(0xfff6ea,0.45); fill.position.set(-4,8,7); scene.add(fill);

// Чистый белый шоурум: без пола и стен, стеллажи висят в светлом пространстве
const key=new THREE.DirectionalLight(0xffffff,0.55); key.position.set(2,4,8); scene.add(key);

// Тележка-вешалка
const metal=new THREE.MeshStandardMaterial({color:0xbab3a7,metalness:.85,roughness:.3});
const rubber=new THREE.MeshStandardMaterial({color:0x111111,roughness:.8});
const RAIL_Y=1.78, HALF=1.32;
function rod(a,b,r){const d=new THREE.Vector3().subVectors(b,a);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),12),metal);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());m.castShadow=true;return m}
// Бутик-фиксация вместо тележки: латунная штанга на тросах в подсвеченной арочной нише
const brass=new THREE.MeshStandardMaterial({color:0xb8925a,metalness:.92,roughness:.22});
const nicheMat=new THREE.MeshStandardMaterial({color:0xece4d7,roughness:.9,emissive:0xfff1dc,emissiveIntensity:.12});
function archShape(w,h){const s=new THREE.Shape();s.moveTo(-w,0);s.lineTo(-w,h);s.absarc(0,h,w,Math.PI,0,true);s.lineTo(w,0);s.lineTo(-w,0);return s}
function buildRack(sh){
  const g=new THREE.Group(), V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const sp=archShape(1.6,2.1);
  const niche=new THREE.Mesh(new THREE.ShapeGeometry(sp,40),nicheMat); niche.position.set(0,-.35,-.5); g.add(niche);
  const edge=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp.getPoints(60).slice(0,-1).map(p=>V(p.x,p.y,0))),120,.018,6),brass);
  edge.position.copy(niche.position).z+=.02; g.add(edge);
  const gm=new THREE.MeshBasicMaterial({color:0xfff4e2}); if(sh)sh.glowMat=gm;
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(2.6,sh&&sh.hasNew?.09:.05),gm);glow.position.set(0,-.33,-.48);g.add(glow);
  const rr=rod(V(-HALF-.06,RAIL_Y,0),V(HALF+.06,RAIL_Y,0),.022); rr.material=brass; g.add(rr);
  [-HALF-.06,HALF+.06].forEach(x=>{const c=rod(V(x,RAIL_Y,0),V(x,RAIL_Y+1.6,0),.004);c.material=brass;g.add(c);
    const cap=new THREE.Mesh(new THREE.SphereGeometry(.035,16,12),brass);cap.position.set(x,RAIL_Y,0);g.add(cap)});
  return g;
}
// Группа магазина: стеллаж + заполнители, едет целиком при появлении
SHOPS.forEach(sh=>{const g=new THREE.Group();g.add(buildRack(sh));g.position.set(sh.x,sh.y,0).add(sh.off);g.rotation.y=sh.ry;sh.g=g;scene.add(g)});

// Силуэты одежды: левая половина от горловины до подола, зеркалится
const SIL={
  dress:[[-.1,0],[-.2,-.05],[-.17,-.27],[-.13,-.4],[-.3,-1.02]],
  abaya:[[-.1,0],[-.22,-.05],[-.43,-.56],[-.36,-.62],[-.21,-.32],[-.31,-1.26]],
  blouse:[[-.1,0],[-.21,-.05],[-.37,-.42],[-.3,-.46],[-.18,-.24],[-.21,-.66]],
  skirt:[[-.16,0],[-.17,-.06],[-.34,-.8]]
};
function garmentGeo(type){
  const L=SIL[type], s=new THREE.Shape();
  s.moveTo(L[0][0],L[0][1]); for(let i=1;i<L.length;i++)s.lineTo(L[i][0],L[i][1]);
  for(let i=L.length-1;i>=0;i--)s.lineTo(-L[i][0],L[i][1]);
  if(type==='skirt')s.lineTo(L[0][0],L[0][1]); else s.quadraticCurveTo(0,-.09,L[0][0],L[0][1]);
  const g=new THREE.ExtrudeGeometry(s,{depth:.03,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,curveSegments:14});
  g.translate(0,0,-.015); return g;
}
const geos={}; Object.keys(SIL).forEach(k=>geos[k]=garmentGeo(k));
const wood=new THREE.MeshStandardMaterial({color:0x8a6a48,roughness:.6,transparent:true});
function tube(pts,r){return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,r,6),wood)}
function hanger(type){
  const g=new THREE.Group(), V=(x,y)=>new THREE.Vector3(x,y,.03);
  const hook=new THREE.Mesh(new THREE.TorusGeometry(.03,.005,6,16,Math.PI*1.3),metal); hook.rotation.z=-Math.PI*.15; hook.position.set(0,-.005,0); g.add(hook);
  g.add(rod(new THREE.Vector3(0,-.02,0),new THREE.Vector3(0,-.08,.02),.005));
  if(type==='skirt'){g.add(tube([V(-.2,-.09),V(0,-.09),V(.2,-.09)],.012))}
  else{g.add(tube([V(-.23,-.15),V(-.1,-.1),V(0,-.08),V(.1,-.1),V(.23,-.15)],.014));g.add(tube([V(-.21,-.16),V(0,-.16),V(.21,-.16)],.005))}
  return g;
}

// Плотная развеска: вещи висят боком к зрителю, как в реальном стеллаже
const texLoader=new THREE.TextureLoader(); texLoader.setCrossOrigin('anonymous');
const FAN=1.3, SLOTS=14, SLOT=2.1/(SLOTS-1), pickables=[];
const slotX=i=>-1.05+i*SLOT;
ITEMS.forEach(it=>{
  const sh=shopById[it.shop], list=ITEMS.filter(i=>i.shop===it.shop), idx=list.indexOf(it);
  const n=Math.min(list.length,SLOTS); if(idx>=SLOTS)return;
  const slot=n<=5?idx*3+1:Math.round(idx*(SLOTS-1)/(n-1)); it.slot=slot;
  const lx=slotX(slot);
  const grp=new THREE.Group(); grp.userData.item=it;
  const mat=new THREE.MeshStandardMaterial({color:it.color,roughness:.85-it.gloss,metalness:it.gloss*.3,transparent:true});
  let m;
  if(it.photo){ // фото вещи на плоскости: верх у плечиков, ширина по пропорции фото
    mat.color.set(0xffffff); mat.roughness=.9; mat.metalness=0; mat.alphaTest=.05; // PNG с прозрачным фоном: без белого прямоугольника
    m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat); m.scale.set(.62,1,1); m.position.y=-.6; mat.side=THREE.DoubleSide;
    texLoader.load(it.photo,t=>{t.colorSpace=THREE.SRGBColorSpace;mat.map=t;mat.needsUpdate=true;const a=t.image.width/t.image.height;const h=it.type==='abaya'?1.25:1;m.scale.set(h*a,h,1);m.position.y=-.1-h/2});
  } else { m=new THREE.Mesh(geos[it.type],mat); m.position.y=it.type==='skirt'?-.11:-.1; }
  m.castShadow=true; grp.add(m);
  grp.add(hanger(it.type));
  const rot=new THREE.Matrix4().makeRotationY(sh.ry);
  const home=new THREE.Vector3(lx,RAIL_Y,0).applyMatrix4(rot).add(new THREE.Vector3(sh.x,sh.y,0));
  const fwd=new THREE.Vector3(0,0,1).applyMatrix4(rot);
  it.g=grp; it.mat=mat; it.base=home; it.home=home.clone().add(sh.off); it.sh=sh; it.fwd=fwd; it.rackRot=sh.ry; it.phase=Math.random()*6;
  it.tPos=it.home.clone(); it.tRot=sh.ry+FAN; it.op=1;
  grp.position.copy(it.home); grp.rotation.y=it.tRot; scene.add(grp); pickables.push(grp);
});

for(let i=ITEMS.length-1;i>=0;i--)if(!ITEMS[i].g){delete byId[ITEMS[i].id];ITEMS.splice(i,1)}
// Заполнители между товарами — плотная развеска
const PAL=[0xd9d2c7,0xcfc6b8,0xe4ded4,0xbfb5a6,0xd3cabd]; // нейтральные заполнители, чтобы стеллаж не пустовал
const decoMats=PAL.map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.85}));
const TYPES=Object.keys(SIL);
SHOPS.forEach(sh=>{const used=new Set(ITEMS.filter(it=>it.shop===sh.id).map(it=>it.slot));for(let i=0;i<SLOTS;i++){if(used.has(i))continue;
  const m=new THREE.Mesh(geos[TYPES[(Math.random()*TYPES.length)|0]],decoMats[(Math.random()*PAL.length)|0]);
  m.position.set(slotX(i),RAIL_Y-.1,0);m.rotation.y=FAN+(Math.random()-.5)*.12;sh.g.add(m)}});

// ---- Примерочная: зеркало в латунной арке и манекен-форма с последней вещью из пакета ----
const fitG=new THREE.Group(); fitG.position.set(0,FIT_Y,0); scene.add(fitG);
(function(){
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const pod=new THREE.Mesh(new THREE.CylinderGeometry(.75,.8,.18,48),new THREE.MeshStandardMaterial({color:0xe9e3da,roughness:.4}));pod.position.set(-.5,.09,0);fitG.add(pod);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.76,.012,8,64),brass);ring.rotation.x=Math.PI/2;ring.position.set(-.5,.18,0);fitG.add(ring);
  const prof=[[0,0],[.15,0],[.19,.16],[.14,.45],[.2,.7],[.17,.86],[.07,.93],[.045,1.02],[0,1.04]].map(p=>new THREE.Vector2(p[0],p[1]));
  const form=new THREE.Mesh(new THREE.LatheGeometry(prof,40),new THREE.MeshStandardMaterial({color:0x2a2622,roughness:.7}));form.scale.set(1,1,.75);form.position.set(-.5,.62,0);fitG.add(form);
  const pole=rod(V(-.5,.18,0),V(-.5,.64,0),.018);pole.material=brass;fitG.add(pole);
  const sp=archShape(.55,1.5);
  const mirror=new THREE.Mesh(new THREE.ShapeGeometry(sp,40),new THREE.MeshStandardMaterial({color:0xd9e0e3,metalness:.95,roughness:.06}));
  mirror.position.set(1.15,.05,-.2);mirror.rotation.y=-.35;fitG.add(mirror);
  const edge=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp.getPoints(60).slice(0,-1).map(p=>V(p.x,p.y,0))),120,.02,6),brass);
  edge.position.set(1.15,.05,-.18);edge.rotation.y=-.35;fitG.add(edge);
})();
let worn=null;
function dressOn(it){ if(worn){fitG.remove(worn);worn=null} if(!it)return;
  worn=new THREE.Mesh(geos[it.type],new THREE.MeshStandardMaterial({color:it.color,roughness:.85-it.gloss,metalness:it.gloss*.3}));
  worn.position.set(-.5,it.type==='skirt'?1.05:1.62,.17); fitG.add(worn); }

// ---- Камера ----
// Обзор сверху вниз по ряду магазинов; колесо/свайп прокручивают ряд, клик по магазину приближает
// Камера смотрит прямо; прокрутка опускает её вдоль стены стеллажей
const MID=new THREE.Vector3();
const cam={z:0,zt:0,target:new THREE.Vector3(0,.95,0),tt:new THREE.Vector3(0,.95,0),yaw:0,ty:0,pitch:.04,tp:.04,r:7,tr:7,scroll:0};
// дистанция камеры: чтобы обе колонки ниш (ширина ~7.6) целиком влезали в экран любой ширины
const fitDist=()=>Math.max(7,3.9/(Math.tan(camera.fov*Math.PI/360)*camera.aspect));
function overview(){cam.tt.set(0,.95-cam.scroll,0);cam.tr=fitDist();cam.tp=.04;cam.ty=0}
function placeCamera(){
  const k=reduce?1:.12;
  cam.target.lerp(cam.tt,k); cam.r+=(cam.tr-cam.r)*k; cam.pitch+=(cam.tp-cam.pitch)*k; cam.yaw+=(cam.ty-cam.yaw)*k; cam.z+=(cam.zt-cam.z)*k;
  // Режим «все витрины»: камера отъезжает так, чтобы влез весь зал
  const top=SHOPS[0].y+2.6, bot=FIT_Y-.2, H=top-bot, W=8, th=Math.tan(camera.fov*Math.PI/360);
  const fit=Math.max(H/2/th,W/2/(th*camera.aspect))*1.08;
  const z=cam.z, T=MID.set(0,(top+bot)/2,0).multiplyScalar(z).addScaledVector(cam.target,1-z), r=cam.r+(fit-cam.r)*z, yw=cam.yaw*(1-z), pt=cam.pitch*(1-z);
  camera.position.set(T.x+Math.sin(yw)*Math.cos(pt)*r, T.y+Math.sin(pt)*r, T.z+Math.cos(yw)*Math.cos(pt)*r);
  camera.lookAt(T);
}
function focusShop(sh){ cam.zt=0; if(!sh){cam.scroll=0;overview();return} cam.scroll=-sh.y;cam.tt.set(sh.x*.5,sh.y+1,0);cam.tr=4.4;cam.ty=sh.ry*.8;cam.tp=.06 }
let stepAcc=0;
function scrollBy(d){stepAcc+=Math.abs(d);if(stepAcc>.75){stepAcc=0;step()}cam.scroll=Math.max(0,Math.min(MAX_SCROLL,cam.scroll+d));overview()}
// Прогулка по бутику: впереди ниши ждут вдали, подъезжают к тебе, пройденные проплывают мимо и уходят за край
function slideShops(){SHOPS.forEach(sh=>{const dd=cam.target.y-(sh.y+1);const a=Math.max(0,Math.abs(dd)-.6)/2.4;let p=Math.min(1,a);p=p*p*(3-2*p);
  const f=1-cam.z; p*=f;
  if(dd>0)sh.off.set(sh.side*p*3.2,0,-p*7); else sh.off.set(sh.side*p*3.6,0,p*5.5);
  sh.g.position.set(sh.x,sh.y,0).add(sh.off)})}

function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<520?52:40;camera.updateProjectionMatrix();if(cam.tr>=6.9)overview()}
new ResizeObserver(resize).observe(stage);

// ---- Подписи магазинов ----
const labelsEl=document.getElementById('labels');
const labels=SHOPS.map(sh=>{const d=document.createElement('div');d.className='label';d.innerHTML=`<b>${sh.name}${sh.hasNew?'<span class="newb">новинки</span>':''}</b><span>${sh.city} · ${sh.note}</span>`;labelsEl.appendChild(d);return {sh,d}});
const FIT={name:'Примерочная',city:'зеркало',note:'последняя вещь из пакета',x:0,y:FIT_Y+.05,off:new THREE.Vector3()};
{const d=document.createElement('div');d.className='label';d.innerHTML=`<b>${FIT.name}</b><span>${FIT.note}</span>`;labelsEl.appendChild(d);labels.push({sh:FIT,d})}
const tmp=new THREE.Vector3();
function placeLabels(){const w=stage.clientWidth,h=stage.clientHeight;labels.forEach(({sh,d})=>{tmp.set(sh.x,sh.y+2.25,0).add(sh.off).project(camera);d.style.left=((tmp.x+1)/2*w)+'px';d.style.top=((1-tmp.y)/2*h)+'px';d.hidden=tmp.z>1||sh.off.z>1.5||sh.off.z<-4})}

// ---- Навигация и фильтры ----
const nav=document.getElementById('nav');
[{name:'Все витрины'}].concat(SHOPS,[{name:'Примерочная',fit:1}]).forEach(sh=>{const b=document.createElement('button');b.type='button';b.textContent=sh.name;b.onclick=()=>sh.fit?(cam.zt=0,cam.scroll=MAX_SCROLL,overview()):sh.id?focusShop(sh):(cam.zt=cam.zt>.5?0:1);nav.appendChild(b)});
let filter='all';
const chips=document.getElementById('chips');
[['all','Все'],['new','Новинки']].concat(Object.entries(CATS)).forEach(([k,v])=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=v;b.setAttribute('aria-pressed',k===filter);b.onclick=()=>{filter=k;[...chips.children].forEach(c=>c.setAttribute('aria-pressed',c===b))};chips.appendChild(b)});

// ---- Ввод: перетаскивание вещей и осмотр зала ----
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(), plane=new THREE.Plane(), hit=new THREE.Vector3();
let hover=null, drag=null, orbit=null;
const bagEl=document.getElementById('bag'), ghost=document.getElementById('ghost'), cartEl=document.getElementById('cart'), barEl=document.getElementById('cartbar');
function setNdc(e){const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1)}
function pick(e){setNdc(e);ray.setFromCamera(ndc,camera);const h=ray.intersectObjects(pickables,true)[0];if(!h)return null;let o=h.object;while(o&&!o.userData.item)o=o.parent;const it=o&&o.userData.item;return it&&visible(it)?it:null}
let look=null;
const visible=it=>(filter==='all'||(filter==='new'?it.isNew:it.type===filter))&&(!look||look.has(it.id));
function overDrop(e){for(const el of [cartEl,barEl,bagEl]){if(getComputedStyle(el).display==='none'||el.hidden)continue;const r=el.getBoundingClientRect();if(r.width&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)return true}return false}

// Щипок двумя пальцами: свёл — видишь все витрины, развёл — обратно в бутик
const pts=new Map(); let pinch=null;
const pdist=()=>{const [a,b]=[...pts.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2){drag=null;orbit=null;ghost.hidden=true;pinch={d0:pdist(),z0:cam.zt};return}
  if(pts.size>2)return;
  const it=pick(e);
  if(it){
    const n=new THREE.Vector3();camera.getWorldDirection(n).negate();
    const start=it.home.clone().addScaledVector(it.fwd,.6);
    plane.setFromNormalAndCoplanarPoint(n,start);
    ray.ray.intersectPlane(plane,hit);
    drag={it,x:e.clientX,y:e.clientY,moved:false,off:start.clone().sub(hit||start)};
    canvas.classList.add('grabbing');
  }else{orbit={x:e.clientX,y:e.clientY,yaw:cam.ty};canvas.classList.add('grabbing')}
});
canvas.addEventListener('pointermove',e=>{
  if(pts.has(e.pointerId))pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&pts.size>=2){cam.zt=Math.max(0,Math.min(1,pinch.z0+(pinch.d0-pdist())/220));return}
  if(drag){
    if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6){drag.moved=true;ghost.hidden=false;ghost.textContent=`${drag.it.name} · ${RUB(drag.it.price)} → в пакет`}
    if(drag.moved){setNdc(e);ray.setFromCamera(ndc,camera);if(ray.ray.intersectPlane(plane,hit))drag.pos=hit.clone().add(drag.off);
      ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';const d=overDrop(e);cartEl.classList.toggle('drop',d);barEl.classList.toggle('drop',d);bagEl.classList.toggle('drop',d)}
  }else if(orbit){cam.ty=Math.max(-.45,Math.min(.45,orbit.yaw-(e.clientX-orbit.x)*.005));if(cam.ty!==cam.yaw)cam.yaw=cam.ty;
    const dy=e.clientY-orbit.y; if(Math.abs(dy)>2){scrollBy(-dy*.012);orbit.y=e.clientY}}
  else if(e.pointerType==='mouse'){const h=pick(e);if(h&&h!==hover)rustle();hover=h;canvas.style.cursor=hover?'pointer':''}
});
function endPointer(e){
  pts.delete(e.pointerId);
  if(pinch){if(pts.size<2){cam.zt=Math.round(cam.zt);pinch=null}orbit=null;drag=null;canvas.classList.remove('grabbing');return}
  if(drag){const it=drag.it;
    if(drag.moved&&overDrop(e))addToCart(it.id,null);
    else if(!drag.moved)openDetail(it);
    drag=null;ghost.hidden=true;cartEl.classList.remove('drop');barEl.classList.remove('drop');bagEl.classList.remove('drop')}
  orbit=null;canvas.classList.remove('grabbing');
}
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);
// Колесо — идти по бутику; Ctrl+колесо или щипок трекпадом — отдалить до всех витрин
let snapT;
canvas.addEventListener('wheel',e=>{e.preventDefault();
  if(e.ctrlKey||e.metaKey){cam.zt=Math.max(0,Math.min(1,cam.zt+e.deltaY*.012));clearTimeout(snapT);snapT=setTimeout(()=>cam.zt=Math.round(cam.zt),180)}
  else{if(cam.zt>.5)return;scrollBy(e.deltaY*.006)}},{passive:false});
addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,select,textarea'))return;if(e.key==='-')cam.zt=1;if(e.key==='='||e.key==='+')cam.zt=0});

// ---- Карточка вещи ----
const detail=document.getElementById('detail'); let detailSize=null, openId=null; const wish=new Set();
function openDetail(it){
  openId=it.id; detailSize=null; focusShop(shopById[it.shop]);
  const sh=shopById[it.shop];
  detail.innerHTML=`<button class="x" type="button" aria-label="Закрыть">×</button>
  <div><h3>${it.name}</h3><div class="meta">${sh.name}, ${sh.city} · ${CATS[it.type]}</div></div>
  <div class="row"><span class="sw" style="background:${hex(it.color)}"></span><span class="price">${RUB(it.price)}</span></div>
  <div class="row" role="group" aria-label="Размер">${it.sizes.map(s=>`<button type="button" class="size" data-s="${s}" aria-pressed="false">${s}</button>`).join('')}</div>
  <div class="row"><button class="btn" type="button" id="addBtn">В пакет</button><button class="wish" type="button" id="wishBtn" aria-pressed="${wish.has(it.id)}">${wish.has(it.id)?'♥ В избранном':'♡ В избранное'}</button></div>
  <div class="row"><button class="mini" type="button" id="callBtn">Видеозвонок продавцу</button><button class="mini" type="button" id="tryBtn">Примерить на своё фото</button></div>
  <div class="note">Без размера тоже можно: уточнишь в пакете.</div>`;
  detail.hidden=false;
  detail.querySelector('.x').onclick=()=>{detail.hidden=true;openId=null};
  detail.querySelectorAll('.size').forEach(b=>b.onclick=()=>{detailSize=+b.dataset.s;detail.querySelectorAll('.size').forEach(x=>x.setAttribute('aria-pressed',x===b))});
  detail.querySelector('#wishBtn').onclick=e=>{const b=e.currentTarget;wish.has(it.id)?wish.delete(it.id):wish.add(it.id);b.setAttribute('aria-pressed',wish.has(it.id));b.textContent=wish.has(it.id)?'♥ В избранном':'♡ В избранное';renderCart()};
  detail.querySelector('#callBtn').onclick=()=>videoCall(sh);
  detail.querySelector('#tryBtn').onclick=()=>tryOn(it);
  detail.querySelector('#addBtn').onclick=()=>{addToCart(it.id,detailSize);detail.hidden=true;openId=null};
}

// ---- Корзина ----
let cart=[]; try{cart=(JSON.parse(localStorage.getItem('vitrina-cart'))||[]).filter(c=>byId[c.id]&&c.qty>0)}catch(e){cart=[]}
const saveCart=()=>{try{localStorage.setItem('vitrina-cart',JSON.stringify(cart))}catch(e){}};
function wishHTML(){if(!wish.size)return '';return `<div class="shop"><h4>Избранное · ${wish.size}</h4>${[...wish].map(id=>{const it=byId[id];return `<div class="item"><span class="sw" style="background:${hex(it.color)}"></span><span class="nm">${it.name}<span class="meta"> · ${shopById[it.shop].name}</span></span><button class="btn quiet" type="button" data-w="${id}" style="padding:4px 8px;font-size:12px">В пакет</button></div>`}).join('')}</div>`}
function addToCart(id,size){const ex=cart.find(c=>c.id===id&&c.size===size);if(ex)ex.qty++;else cart.push({id,size,qty:1});renderCart();pulse(id);dressOn(byId[id]);bagEl.classList.remove('pop');void bagEl.offsetWidth;bagEl.classList.add('pop')}
function pulse(id){const it=byId[id];it.pulse=1}
function totals(){const goods=cart.reduce((s,c)=>s+byId[c.id].price*c.qty,0);const shops=[...new Set(cart.map(c=>byId[c.id].shop))];const del=shops.length?DELIVERY_BASE+DELIVERY_PER_SHOP*(shops.length-1):0;return {goods,shops,del,total:goods+del,count:cart.reduce((s,c)=>s+c.qty,0)}}
function renderCart(){saveCart();renderCart0();const body=document.getElementById('cartBody');body.insertAdjacentHTML('beforeend',wishHTML());
  body.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{const id=b.dataset.w;wish.delete(id);addToCart(id,null)})}
function renderCart0(){
  const body=document.getElementById('cartBody'), sum=document.getElementById('sum'), t=totals();
  document.getElementById('cartCount').textContent=t.count?`${t.count} шт. · ${t.shops.length} маг.`:'';
  document.getElementById('bagN').textContent=t.count;document.getElementById('barText').textContent=t.count?`${t.count} шт. · ${RUB(t.total)}`:'Корзина пуста';
  if(!cart.length){body.innerHTML=`<div class="empty">Перетащи вещь с вешалки в пакет или сюда.<br>Можно собрать из разных магазинов: курьер заберёт всё и привезёт одним заказом.</div>`;sum.innerHTML='';return}
  body.innerHTML=t.shops.map(sid=>{const sh=shopById[sid];return `<div class="shop"><h4>${sh.name} · ${sh.city}</h4>${cart.map((c,i)=>({c,i})).filter(({c})=>byId[c.id].shop===sid).map(({c,i})=>{const it=byId[c.id];return `<div class="item"><span class="sw" style="background:${hex(it.color)}"></span><span class="nm">${it.name}</span><span class="price">${RUB(it.price*c.qty)}</span><div class="ctl"><label class="meta">Размер <select data-i="${i}" id="sz${i}"><option value="">выбрать</option>${it.sizes.map(s=>`<option ${String(s)===String(c.size)?'selected':''}>${s}</option>`).join('')}</select></label><span class="qty"><button type="button" data-d="-1" data-i="${i}" aria-label="Меньше">−</button>${c.qty}<button type="button" data-d="1" data-i="${i}" aria-label="Больше">+</button></span></div></div>`}).join('')}</div>`}).join('');
  body.querySelectorAll('select').forEach(s=>s.onchange=()=>{cart[+s.dataset.i].size=s.value||null;renderCart()});
  body.querySelectorAll('.qty button').forEach(b=>b.onclick=()=>{const c=cart[+b.dataset.i];c.qty+=+b.dataset.d;if(c.qty<1)cart.splice(+b.dataset.i,1);renderCart()});
  const missing=cart.some(c=>!c.size);
  sum.innerHTML=`<div class="ln"><span>Товары</span><span>${RUB(t.goods)}</span></div>
  <div class="ln"><span>Курьер: ${t.shops.length} ${t.shops.length===1?'магазин':'магазина'} → вам</span><span>${RUB(t.del)}</span></div>
  <div class="ln tot"><span>Итого</span><span>${RUB(t.total)}</span></div>
  <button class="btn" type="button" id="checkout" ${missing?'disabled style="opacity:.5;cursor:not-allowed"':''}>Оформить один заказ</button>
  <div class="note">${missing?'Выбери размер у каждой вещи. ':''}Доставка: ${DELIVERY_BASE} ₽ + ${DELIVERY_PER_SHOP} ₽ за каждый следующий магазин.</div>`;
  const cb=document.getElementById('checkout'); if(cb&&!missing)cb.onclick=checkout;
}
function checkout(){
  const t=totals(), m=document.getElementById('modal');
  m.innerHTML=`<form class="card" id="coForm" role="dialog" aria-label="Оформление заказа"><h3>Один заказ, ${t.shops.length} ${t.shops.length===1?'магазин':'магазина'}</h3>
  <ol class="route">${t.shops.map(sid=>{const sh=shopById[sid];const n=cart.filter(c=>byId[c.id].shop===sid).reduce((s,c)=>s+c.qty,0);return `<li><div><b>${sh.name}</b><div class="meta">${sh.city} · курьер заберёт ${n} шт.</div></div></li>`}).join('')}<li><div><b>Вам</b><div class="meta">один пакет · ${RUB(t.total)}</div></div></li></ol>
  <label class="fld"><span>Имя</span><input id="coName" required autocomplete="name"></label>
  <label class="fld"><span>Телефон</span><input id="coPhone" required type="tel" autocomplete="tel" placeholder="+7"></label>
  <label class="fld"><span>Адрес</span><input id="coAddr" required autocomplete="street-address" placeholder="Город, улица, дом"></label>
  <label class="fld"><span>Комментарий</span><input id="coCom" placeholder="Подъезд, время, примерка"></label>
  <div class="note" id="coErr" role="alert"></div>
  <div class="row"><button class="btn" type="submit" id="coGo">Заказать за ${RUB(t.total)}</button><button class="btn quiet" type="button" id="mclose">Назад</button></div>
  <div class="note">Оплата курьеру при получении. Перед выездом мы позвоним и подтвердим наличие.</div></form>`;
  m.hidden=false; document.getElementById('mclose').onclick=()=>m.hidden=true;
  document.getElementById('coForm').onsubmit=async e=>{e.preventDefault();
    const go=document.getElementById('coGo'), err=document.getElementById('coErr'); go.disabled=true; go.textContent='Отправляю…'; err.textContent='';
    const {data,error}=await sb.rpc('place_order',{p_customer_name:$('coName').value,p_phone:$('coPhone').value,p_address:$('coAddr').value,p_comment:$('coCom').value,
      p_items:cart.map(c=>({product_id:c.id,size:c.size||'',qty:c.qty}))});
    if(error){err.textContent=error.message||'Не получилось оформить. Попробуй ещё раз.';go.disabled=false;go.textContent=`Заказать за ${RUB(t.total)}`;return}
    cart=[];renderCart();
    m.innerHTML=`<div class="card" role="dialog" aria-label="Заказ принят"><h3>Заказ принят</h3><p class="meta">Номер ${String(data).slice(0,8).toUpperCase()}. Мы позвоним в течение 15 минут, подтвердим наличие и время доставки.</p><button class="btn" type="button" id="mclose">Отлично</button></div>`;
    document.getElementById('mclose').onclick=()=>m.hidden=true};
}
document.getElementById('barBtn').onclick=()=>{cartEl.classList.toggle('open');sheet()};
function sheet(){if(innerWidth<820)cartEl.hidden=!cartEl.classList.contains('open');else cartEl.hidden=false}
addEventListener('resize',sheet); sheet(); renderCart();

// ---- Цикл ----
// ---- Ночной режим: зал гаснет, светятся только ниши ----
let night=false, nt=0; const DAY=new THREE.Color(0xf3f1ee), NIGHT=new THREE.Color(0x0f0e11);
const nightBtn=document.getElementById('nightBtn');
nightBtn.onclick=()=>{night=!night;nightBtn.setAttribute('aria-pressed',night);if(night)document.documentElement.setAttribute('data-night','');else document.documentElement.removeAttribute('data-night')};

// ---- Звук: шаги при прогулке и шорох ткани при наведении (синтез, без файлов) ----
let actx=null, soundOn=false; const soundBtn=document.getElementById('soundBtn');
soundBtn.onclick=()=>{try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();actx.resume();soundOn=!soundOn;soundBtn.setAttribute('aria-pressed',soundOn);if(soundOn)step()}catch(e){soundBtn.disabled=true}};
function burst(dur,type,freq,q,vol){if(!soundOn||!actx)return;const n=Math.floor(actx.sampleRate*dur),b=actx.createBuffer(1,n,actx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const src=actx.createBufferSource();src.buffer=b;const f=actx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;const g=actx.createGain(),t=actx.currentTime;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+dur*.15);g.gain.exponentialRampToValueAtTime(.0001,t+dur);src.connect(f).connect(g).connect(actx.destination);src.start()}
function step(){burst(.14,'lowpass',170,.8,.6)}
function rustle(){burst(.3,'bandpass',2600,.6,.07)}

// ---- Консьерж: подбор образа по поводу (демо — по ключевым словам; в рабочей версии ИИ) ----
const txt=it=>(it.name+' '+(shopById[it.shop].note||'')).toLowerCase();
const RULES=[
  [/свад|никах|торж|праздн|банкет|мовлид/, it=>/свадеб|праздн|вечерн|атлас|бархат|кружев/.test(txt(it))],
  [/офис|работ|делов|учеб|учёб|универ/, it=>it.type==='blouse'||/рубаш|трапец|плиссе|делов/.test(txt(it))],
  [/вечер|ресторан|выход|в гости/, it=>/вечерн|атлас|бархат|шифон/.test(txt(it))],
  [/кажд|повседн|прогул|город|кэжуал|просто/, it=>/кажд|повседн|трикотаж|деним|джинс|худи/.test(txt(it))],
  [/закрыт|хиджаб|мечет|скромн|абай|намаз/, it=>it.type==='abaya'||/в пол|макси|закрыт/.test(txt(it))],
  [/размер|полн|5[4-9]|60|больш/, it=>/больш|5[4-9]|60/.test(txt(it))],
  [/молод|студ|оверсайз|модн|стрит/, it=>/молод|оверсайз|худи|карго|принт/.test(txt(it))]
];
const lookEl=document.getElementById('look'), hintEl=document.getElementById('hint');
function kwPick(q){
  const bm=q.match(/до\s*([\d\s]+)/); const budget=bm?parseInt(bm[1].replace(/\s/g,''),10):Infinity;
  const rules=RULES.filter(r=>r[0].test(q));
  const found=ITEMS.filter(it=>it.price<=budget&&(rules.length?rules.some(r=>r[1](it)):isFinite(budget)));
  const byShop={};found.forEach(it=>(byShop[it.shop]=byShop[it.shop]||[]).push(it));
  const out=[];while(out.length<6&&Object.values(byShop).some(a=>a.length))Object.values(byShop).forEach(a=>{if(a.length&&out.length<6)out.push(a.shift())});
  return out;
}
async function aiPick(q){
  return null; // ИИ-консьерж подключим через серверную функцию
  const cat=ITEMS.map(i=>`${i.id}|${i.name}|${CATS[i.type]}|${shopById[i.shop].name} (${shopById[i.shop].note})|${i.price}`).join('\n');
  const prompt=`Ты стилист-консьерж бутика женской одежды магазинов Ингушетии. Покупательница пишет: «${q}».
Подбери от 2 до 6 вещей ТОЛЬКО из каталога ниже, которые подходят к поводу и бюджету (если он назван). Учитывай скромный стиль, если о нём просят. Старайся брать вещи из разных магазинов.
Каталог (id|название|тип|магазин|цена ₽):
${cat}
Ответь строго JSON: {"ids":["i3","i7"],"note":"одно короткое предложение по-русски, почему этот образ"}`;
  try{const r=await sample.json(prompt,{modelTier:'quick'});
    const ids=(r&&Array.isArray(r.ids)?r.ids:[]).filter(id=>byId[id]).slice(0,6);
    return ids.length?{items:ids.map(id=>byId[id]),note:typeof r.note==='string'?r.note.slice(0,200):''}:null}catch(e){return null}
}
function showLook(pick6,note,ai){
  hintEl.hidden=true; lookEl.hidden=false;
  if(!pick6.length){look=null;lookEl.innerHTML=`<b>Не понял повод</b><div class="meta">Попробуй: свадьба, офис, вечер, на каждый день, закрытое, большие размеры. Можно добавить бюджет: «до 10 000».</div><button class="btn quiet" type="button" id="lookX">Закрыть</button>`;
    document.getElementById('lookX').onclick=closeLook;return}
  look=new Set(pick6.map(i=>i.id)); pick6.forEach(i=>i.pulse=1);
  const nShops=new Set(pick6.map(i=>i.shop)).size, sum=pick6.reduce((s,i)=>s+i.price,0);
  lookEl.innerHTML=`<b>Подобрал ${pick6.length} ${pick6.length<5?'вещи':'вещей'} из ${nShops} ${nShops===1?'магазина':'магазинов'}</b>
  ${note?`<div class="meta"></div>`:''}
  <ul>${pick6.map(i=>`<li><span class="sw" style="background:${hex(i.color)}"></span>${i.name}<span class="price">${RUB(i.price)}</span></li>`).join('')}</ul>
  <div class="row"><button class="btn" type="button" id="lookAll">Всё в пакет · ${RUB(sum)}</button><button class="btn quiet" type="button" id="lookX">Сбросить</button></div>
  <div class="note">${ai?'Подобрал ИИ-консьерж. ':'Подбор по ключевым словам. '}Остальные вещи притушены.</div>`;
  if(note)lookEl.querySelector('.meta').textContent=note;
  cam.zt=1;
  document.getElementById('lookAll').onclick=()=>{pick6.forEach(i=>addToCart(i.id,null));closeLook()};
  document.getElementById('lookX').onclick=closeLook;
}
document.getElementById('ask').addEventListener('submit',async e=>{e.preventDefault();
  const q=document.getElementById('askIn').value.trim(); if(!q)return;
  const btn=e.target.querySelector('button'); btn.disabled=true; btn.textContent='Подбираю…';
  hintEl.hidden=true; lookEl.hidden=false; lookEl.innerHTML='<div class="meta">Консьерж смотрит все магазины…</div>';
  const ai=await aiPick(q);
  btn.disabled=false; btn.textContent='Подобрать';
  if(ai)showLook(ai.items,ai.note,true); else showLook(kwPick(q.toLowerCase()),'',false);
});
function closeLook(){look=null;lookEl.hidden=true;hintEl.hidden=false;cam.zt=0}

// ---- Карта бутика: точки справа, текущая подсвечена, клик — перейти ----
const STOPS=SHOPS.map(sh=>({name:sh.name,go:()=>focusShop(sh),at:-sh.y})).concat([{name:'Примерочная',go:()=>{cam.zt=0;cam.scroll=MAX_SCROLL;overview()},at:MAX_SCROLL}]);
const rail=document.getElementById('rail');
STOPS.forEach((st,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',st.name);b.innerHTML=`<span>${st.name}</span>`;b.onclick=st.go;rail.appendChild(b);st.b=b});
let curStop=-1;
function updateRail(){let best=0,bd=1e9;STOPS.forEach((st,i)=>{const d=Math.abs(st.at-cam.scroll);if(d<bd){bd=d;best=i}});
  if(cam.z>.5)best=-1; if(best!==curStop){curStop=best;STOPS.forEach((st,i)=>st.b.setAttribute('aria-current',i===best))}}

// ---- Ценник на нитке над вещью при наведении ----
const tagEl=document.getElementById('tag'), tv=new THREE.Vector3();
function placeTag(){const it=(drag&&drag.moved)?null:(hover||(openId&&byId[openId]));if(!it||!visible(it)){tagEl.hidden=true;return}
  tv.copy(it.g.position);tv.y+=.08;tv.project(camera);const w=stage.clientWidth,h=stage.clientHeight;
  tagEl.style.left=((tv.x+1)/2*w)+'px';tagEl.style.top=((1-tv.y)/2*h)+'px';
  const txt=`${it.name}${it.isNew?'<span class="newb">новинка</span>':''}<b>${RUB(it.price)}</b>`; if(tagEl.dataset.id!==it.id){tagEl.dataset.id=it.id;tagEl.innerHTML=txt} tagEl.hidden=false}

// ---- Клавиши: стрелки и PageUp/Down — идти по бутику ----
addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,select,textarea'))return;
  if(e.key==='ArrowDown'||e.key==='PageDown'){e.preventDefault();scrollBy(1.5)} if(e.key==='ArrowUp'||e.key==='PageUp'){e.preventDefault();scrollBy(-1.5)}});

// ---- Короткое знакомство при первом входе (3 шага) ----
const COACH=[
  ['Добро пожаловать в бутик','Здесь висят вещи из разных магазинов Ингушетии. Собираешь в один пакет, курьер объезжает магазины и привозит всё одним заказом.'],
  ['Как ходить','Крути колесо или листай пальцем вниз: ниши магазинов подплывают к тебе. Справа карта, можно прыгнуть к любому магазину. Сведи два пальца или нажми «Все витрины», чтобы увидеть весь зал.'],
  ['Как выбирать','Наведи на вещь, чтобы увидеть цену. Нажми, чтобы рассмотреть и выбрать размер. Перетащи в пакет справа внизу. Не знаешь, что надеть? Напиши консьержу сверху.']
];
const coach=document.getElementById('coach'); let seen=false; try{seen=localStorage.getItem('vitrina-coach')==='1'}catch(e){}
function showCoach(i){coach.hidden=false;const [h,p]=COACH[i];
  coach.innerHTML=`<div class="card" role="dialog" aria-label="${h}"><div class="dots">${COACH.map((_,j)=>`<i class="${j===i?'on':''}"></i>`).join('')}</div><h3>${h}</h3><p>${p}</p>
  <div class="row"><button class="btn" type="button" id="cNext">${i<COACH.length-1?'Дальше':'Начать'}</button><button class="btn quiet" type="button" id="cSkip">Пропустить</button></div></div>`;
  const done=()=>{coach.hidden=true;try{localStorage.setItem('vitrina-coach','1')}catch(e){}};
  document.getElementById('cNext').onclick=()=>i<COACH.length-1?showCoach(i+1):done(); document.getElementById('cSkip').onclick=done}
if(!seen)showCoach(0);

// ---- Видеозвонок продавцу (демо: в рабочей версии звонок прямо из ниши) ----
function videoCall(sh){const m=document.getElementById('modal');const num=(sh.whatsapp||'').replace(/\D/g,'');
  m.innerHTML=`<div class="card" role="dialog" aria-label="Видеозвонок"><h3>Видеозвонок в «${sh.name}»</h3>
  <p class="meta">Продавец покажет вещь вживую: ткань на свету, посадку, ответит про размеры.</p>
  ${num?`<div class="row"><b>WhatsApp:</b><span style="user-select:all">+${num}</span></div><a class="btn" href="https://wa.me/${num}?text=${encodeURIComponent('Здравствуйте! Пишу с Витрины, хочу посмотреть вещь по видео.')}" target="_blank" rel="noopener">Написать в WhatsApp</a>`:`<div class="note">Магазин ещё не указал номер для связи.</div>`}
  <button class="btn quiet" type="button" id="mclose">Закрыть</button></div>`;
  m.hidden=false;document.getElementById('mclose').onclick=()=>m.hidden=true}

// ---- Примерка на своё фото: вещь поверх фото, двигаешь пальцем, масштаб ползунком ----
function tryOn(it){const m=document.getElementById('modal');
  m.innerHTML=`<div class="card tryon" role="dialog" aria-label="Примерка на фото"><h3>${it.name}</h3>
  <label class="btn quiet" for="tryFile" style="text-align:center">Выбрать фото в полный рост</label><input id="tryFile" type="file" accept="image/*" hidden>
  <canvas id="tryC" width="600" height="800"></canvas>
  <label class="meta" for="tryS">Размер вещи</label><input id="tryS" type="range" min="40" max="220" value="110">
  <div class="note">Перетащи вещь на себя. Фото остаётся только в твоём браузере, никуда не отправляется.</div>
  <button class="btn" type="button" id="mclose">Готово</button></div>`;
  m.hidden=false;document.getElementById('mclose').onclick=()=>m.hidden=true;
  const c=document.getElementById('tryC'),x=c.getContext('2d');let img=null,px=300,py=230,sc=1.1,dragT=null;
  function draw(){x.fillStyle=getComputedStyle(document.body).getPropertyValue('--bg')||'#eee';x.fillRect(0,0,600,800);
    if(img){const r=Math.max(600/img.width,800/img.height);x.drawImage(img,(600-img.width*r)/2,(800-img.height*r)/2,img.width*r,img.height*r)}
    else{x.fillStyle='#999';x.font='24px Golos Text, sans-serif';x.textAlign='center';x.fillText('Загрузи своё фото',300,420)}
    const L=SIL[it.type],k=sc*260;x.save();x.translate(px,py);x.beginPath();x.moveTo(L[0][0]*k,-L[0][1]*k);
    for(let i=1;i<L.length;i++)x.lineTo(L[i][0]*k,-L[i][1]*k);for(let i=L.length-1;i>=0;i--)x.lineTo(-L[i][0]*k,-L[i][1]*k);x.closePath();
    x.globalAlpha=.92;x.fillStyle=hex(it.color);x.fill();x.globalAlpha=1;x.strokeStyle='rgba(0,0,0,.25)';x.lineWidth=2;x.stroke();x.restore()}
  draw();
  document.getElementById('tryFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const u=URL.createObjectURL(f);const im=new Image();im.onload=()=>{img=im;draw()};im.src=u};
  document.getElementById('tryS').oninput=e=>{sc=e.target.value/100;draw()};
  const pos=e=>{const r=c.getBoundingClientRect();return [(e.clientX-r.left)*600/r.width,(e.clientY-r.top)*800/r.height]};
  c.onpointerdown=e=>{c.setPointerCapture(e.pointerId);const [a,b]=pos(e);dragT=[a-px,b-py]};
  c.onpointermove=e=>{if(!dragT)return;const [a,b]=pos(e);px=a-dragT[0];py=b-dragT[1];draw()};
  c.onpointerup=()=>dragT=null;
}

// ---- Шопинг с подругой: кто открыл бутик одновременно — видите друг друга и пакеты ----
const friendsEl=document.getElementById('friends'), friendBtn=document.getElementById('friendBtn');
const PEER_COLORS=['#c0567a','#3f7fb5','#5a9a5f','#c98a2c','#7b5bb3','#2f8f8a'];
let room=null, peers=[], showFriends=false;
const myKey=(()=>{try{let k=sessionStorage.getItem('vitrina-peer');if(!k){k=Math.random().toString(36).slice(2,10);sessionStorage.setItem('vitrina-peer',k)}return k}catch(e){return Math.random().toString(36).slice(2,10)}})();
const roomCode=(location.hash.match(/^#vmeste-([a-z0-9]{4,12})$/)||[])[1]||null;
const colorOf=p=>PEER_COLORS[[...p].reduce((a,ch)=>a+ch.charCodeAt(0),0)%PEER_COLORS.length];
friendBtn.onclick=()=>{showFriends=!showFriends;friendBtn.setAttribute('aria-pressed',showFriends);friendsEl.hidden=!showFriends;if(showFriends&&!room)joinRoom(roomCode||Math.random().toString(36).slice(2,8));renderFriends()};
function others(){return peers.filter(p=>p.key!==myKey)}
function renderFriends(){
  STOPS.forEach(st=>st.b.querySelectorAll('.pd').forEach(d=>d.remove()));
  others().forEach(p=>{const i=p.stop;if(typeof i==='number'&&STOPS[i]){const d=document.createElement('i');d.className='pd';d.style.background=colorOf(p.key);STOPS[i].b.appendChild(d)}});
  const k=others().length; friendBtn.textContent=k?`С подругой · ${k}`:'С подругой';
  if(!showFriends)return;
  const link=room?`${location.origin}${location.pathname}#vmeste-${room.code}`:'';
  const ps=others();
  friendsEl.innerHTML=`<h4>Шопинг с подругой</h4>
  <div class="meta">Отправь подруге ссылку. Откроет, и вы увидите друг друга на карте и пакеты друг друга.</div>
  <div class="row"><input class="lnk" readonly value="${link}" aria-label="Ссылка для подруги"><button class="mini" type="button" id="cpLink">Копировать</button></div>
  ${ps.map(p=>{const bag=(Array.isArray(p.bag)?p.bag:[]).filter(id=>byId[id]).slice(0,20),st=STOPS[p.stop];
    return `<div class="peer"><div class="who"><i style="background:${colorOf(p.key)}"></i><b data-n></b><button class="mini" type="button" data-go="${p.stop}">К ней</button></div>
    <div class="meta">${st?'сейчас: '+st.name:'смотрит все витрины'} · в пакете ${bag.length}</div>
    <ul>${bag.map(id=>`<li><span class="sw" style="background:${hex(byId[id].color)}"></span>${byId[id].name}<button class="mini" type="button" data-add="${id}">+ мне</button></li>`).join('')}</ul></div>`}).join('')}`;
  friendsEl.querySelectorAll('[data-n]').forEach((el,i)=>el.textContent=String(ps[i].name||'Подруга').slice(0,24));
  const cp=document.getElementById('cpLink'); if(cp)cp.onclick=()=>{const inp=friendsEl.querySelector('.lnk');navigator.clipboard.writeText(inp.value).then(()=>cp.textContent='Скопировано',()=>{inp.select()})};
  friendsEl.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const st=STOPS[+b.dataset.go];if(st)st.go()});
  friendsEl.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addToCart(b.dataset.add,null));
}
function joinRoom(code){
  const ch=sb.channel('vmeste-'+code,{config:{presence:{key:myKey}}});
  room={code,ch}; if(!location.hash)history.replaceState(null,'','#vmeste-'+code);
  ch.on('presence',{event:'sync'},()=>{const st=ch.presenceState();peers=Object.entries(st).map(([key,arr])=>({key,...(arr[arr.length-1]||{})}));renderFriends()});
  ch.subscribe(s=>{if(s==='SUBSCRIBED'){lastPres='';pushPresence()}});
}
let lastPres='';
function pushPresence(){if(!room)return;const p={stop:curStop,bag:cart.map(c=>c.id).slice(0,30)};const k=JSON.stringify(p);if(k===lastPres)return;lastPres=k;room.ch.track(p).catch(()=>{})}
setInterval(pushPresence,700);
if(roomCode){showFriends=true;friendBtn.setAttribute('aria-pressed',true);friendsEl.hidden=false;joinRoom(roomCode)}

const GLOW_A=new THREE.Color(0xfff4e2), GLOW_B=new THREE.Color(0xd9a441);
const clock=new THREE.Clock();
function frame(){
  const t=clock.getElapsedTime();
  slideShops();
  ITEMS.forEach(it=>{
    it.home.copy(it.base).add(it.sh.off);
    const dragging=drag&&drag.it===it&&drag.moved&&drag.pos;
    const lifted=!dragging&&(hover===it||openId===it.id);
    if(dragging){it.tPos.copy(drag.pos);it.tRot=it.rackRot}
    else if(lifted){it.tPos.copy(it.home).addScaledVector(it.fwd,.5);it.tRot=it.rackRot}
    else{it.tPos.copy(it.home);it.tRot=it.rackRot+FAN}
    it.g.position.lerp(it.tPos,dragging?.35:.14);
    it.g.rotation.y+=(it.tRot-it.g.rotation.y)*.14;
    it.g.rotation.z=reduce||dragging?0:Math.sin(t*1.1+it.phase)*.012;
    const sc=1+(dragging?.06:0)+(it.pulse||0)*.12; it.g.scale.setScalar(sc); if(it.pulse)it.pulse=Math.max(0,it.pulse-.04);
    const op=visible(it)?1:.12; it.op+=(op-it.op)*.15; it.mat.opacity=it.op; it.mat.depthWrite=it.op>.9;
  });
  nt+=((night?1:0)-nt)*.08;
  scene.background.copy(DAY).lerp(NIGHT,nt); scene.fog.color.copy(scene.background);
  hemi.intensity=.85-.7*nt; fill.intensity=.45-.38*nt; key.intensity=.55-.45*nt; nicheMat.emissiveIntensity=.12+.85*nt;
  const gp=(Math.sin(t*2.4)+1)/2; SHOPS.forEach(sh=>{if(sh.hasNew&&sh.glowMat)sh.glowMat.color.copy(GLOW_A).lerp(GLOW_B,gp)});
  placeCamera(); renderer.render(scene,camera); placeLabels(); placeTag(); updateRail();
  requestAnimationFrame(frame);
}
resize(); focusShop(null); if(cart.length)dressOn(byId[cart[cart.length-1].id]); frame();
