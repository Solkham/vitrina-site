// Зал Витрины: фото-зал, ряды магазинов идут вертикально (слева и справа), вещи на тросах или каталках,
// «путь вещи» по скроллу (вращение 360° из видео продавца + приближение деталей), общий пакет на несколько магазинов.
import { sb, photoUrl, spinUrl, loadCatalog } from './sb.js';

const RUB=n=>Number(n).toLocaleString('ru-RU')+' ₽';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const BG={women:'/proby/a-women.jpg',men:'/proby/a-men.jpg'};
const DEMO_IMG={P1:'/zal/p1.webp',P3:'/zal/p3.webp',P4:'/zal/p4.webp',M1:'/zal/m1.webp',M2:'/zal/m2.webp'};
const SIZES_W=['42','44','46','48','50'], SIZES_M=['46','48','50','52','54'];

// ---- Как камера идёт по вещи каждого типа: [приближение, x, y, поворот] для выреза, кроя, ткани и длины ----
const KIND={
  dress:{lbl:{neck:'Вырез',cut:'Талия',fab:'Ткань',len:'Подол'},sheen:1,sway:1,path:{neck:[2.7,.5,.08,0],cut:[2.1,.5,.2,10],fab:[3.2,.56,.55,-4],len:[2,.56,.9,-10]}},
  lace:{lbl:{neck:'Вырез',cut:'Рукав',fab:'Ткань',len:'Длина'},sheen:.35,path:{neck:[2.6,.5,.1,0],cut:[2.3,.8,.3,14],fab:[3.4,.5,.68,0],len:[2.1,.5,.88,-6]}},
  long:{lbl:{neck:'Застёжка',cut:'Рукав',fab:'Ткань',len:'Длина'},sheen:.5,sway:.6,path:{neck:[2.6,.5,.22,0],cut:[2,.38,.45,8],fab:[3.1,.56,.62,0],len:[2.3,.56,.95,-8]}},
  skirt:{lbl:{neck:'Пояс',cut:'Силуэт',fab:'Ткань',len:'Длина'},sheen:.5,sway:.8,path:{neck:[2.4,.5,.08,0],cut:[1.8,.5,.35,10],fab:[3.2,.5,.6,0],len:[2.1,.5,.92,-8]}},
  jacket:{lbl:{neck:'Лацкан',cut:'Плечо',fab:'Ткань',len:'Длина'},sheen:.3,path:{neck:[2.3,.6,.32,-12],cut:[2.2,.86,.26,16],fab:[3.3,.74,.72,0],len:[2,.5,.9,-8]}},
  kamis:{lbl:{neck:'Воротник',cut:'Крой',fab:'Ткань',len:'Длина'},sheen:.3,path:{neck:[2.6,.5,.15,0],cut:[1.9,.5,.55,10],fab:[3.2,.3,.62,0],len:[2.2,.5,.95,-6]}}
};
const TYPE_KIND={dress:'dress',abaya:'long',blouse:'lace',skirt:'skirt',other:'dress'};
const GENERIC={neck:['Вырез и отделка','Крупно, как будто держишь в руках'],cut:['Крой и посадка','Как вещь сидит по фигуре'],fab:['Ткань','Фактура и плотность вблизи'],len:['Длина','Где заканчивается вещь']};

// ---- Магазины и вещи из базы (кабинет продавца) ----
let CATALOG={shops:[],products:[]};
try{CATALOG=await loadCatalog()}catch(e){console.error(e)}
const sil=c=>'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200"><path d="M42 6h16l4 10 8 4-3 30 20 140H13L33 50l-3-30 8-4z" fill="${c}"/></svg>`);
function fromDb(p,sh){
  const ph=(p.product_photos||[]).slice().sort((a,b)=>a.sort-b.sort)[0], d=p.details||{};
  const kind=TYPE_KIND[p.type]||'dress';
  const spec={}; ['neck','cut','fab','len'].forEach(k=>spec[k]=d[k]?[d[k],'']:GENERIC[k]);
  return {id:p.id,productId:p.id,kind,img:ph?photoUrl(ph.storage_path):sil(p.color||'#888'),ar:ph?null:.5,f:'saturate(1)',color:'',name:p.name,price:p.price,
    shop:sh.name,shopId:sh.id,city:sh.city,sizes:p.sizes&&p.sizes.length?p.sizes:SIZES_W,spec,chips:d.occasions||[],
    spin:p.spin_frames?{n:p.spin_frames,url:i=>spinUrl(p,i)}:null};
}
const dbShops=CATALOG.shops.map(s=>({id:s.id,name:s.name,city:s.city,note:s.note||'',items:[]}));
const dbById=Object.fromEntries(dbShops.map(s=>[s.id,s]));
CATALOG.products.forEach(p=>{const sh=dbById[p.shop_id];if(sh)sh.items.push(fromDb(p,sh))});
const liveShops=dbShops.filter(s=>s.items.length);

// ---- Пример, пока магазины заполняют витрину: вещи-заглушки, отмечены «пример», заказать их нельзя ----
const COLORS={
  dress:{'Бордо':'brightness(.72) saturate(1.1)','Красный':'saturate(1)','Изумруд':'hue-rotate(140deg) saturate(.9) brightness(.85)','Тёмно-синий':'hue-rotate(225deg) brightness(.62)','Чёрный':'grayscale(1) brightness(.5) contrast(1.25)','Шампань':'hue-rotate(28deg) saturate(.35) brightness(1.4)'},
  lace:{'Пудра':'saturate(1)','Белый':'grayscale(1) brightness(1.12)','Персик':'hue-rotate(18deg) saturate(1.1)','Лаванда':'hue-rotate(-42deg)','Мята':'hue-rotate(115deg) saturate(.7)'},
  long:{'Шалфей':'saturate(1)','Олива':'hue-rotate(-35deg) brightness(.8)','Песок':'hue-rotate(-95deg) saturate(.45) brightness(1.15)','Небесный':'hue-rotate(75deg)','Графит':'grayscale(1) brightness(.55)','Чёрный':'grayscale(1) brightness(.48) contrast(1.25)'},
  jacket:{'Небесный':'saturate(1)','Тёмно-синий':'brightness(.45) saturate(1.5)','Серый':'grayscale(1) brightness(.95)','Антрацит':'grayscale(1) brightness(.58)','Беж':'hue-rotate(175deg) saturate(.45) brightness(1.08)','Олива':'hue-rotate(250deg) saturate(.5) brightness(.75)'},
  kamis:{'Белый':'saturate(1)','Песок':'sepia(.55) brightness(.96)','Графит':'brightness(.56) contrast(1.15)','Голубой':'sepia(.35) hue-rotate(170deg) saturate(1.7)','Олива':'sepia(.6) hue-rotate(40deg) brightness(.7)'}
};
const DEMO_KIND={
  dress:{img:'P1',ar:.51,name:'Платье в пол, атлас',price:8900,spec:{neck:['V-вырез, тонкие бретели','Подклад до бедра, лиф держит форму'],cut:['Приталенный лиф, юбка-солнце','Шов по завышенной талии стройнит'],fab:['Атлас, мягкий блеск','Плотный, не просвечивает · 100% полиэстер'],len:['Длина в пол','145 см от плеча · на рост 165–175']},chips:['Свадьба','Вечер','Никах']},
  lace:{img:'P3',ar:.48,name:'Платье-миди, кружево',price:7400,spec:{neck:['Круглый вырез','Мягкая присборка по горловине'],cut:['Свободный крой, рукав 3/4','Не облегает, удобно весь день'],fab:['Хлопковое кружево','Шифон сверху, подклад — хлопок'],len:['Миди, два яруса','110 см от плеча']},chips:['Праздник','В гости']},
  long:{img:'P4',ar:.28,name:'Платье-абайя, вискоза',price:6900,spec:{neck:['Закрытый вырез','Застёжка на пуговицах до груди'],cut:['Прямой силуэт, длинный рукав','Скромный крой, не по фигуре'],fab:['Вискоза, струящаяся','Дышит, не мнётся в дороге'],len:['Длина в пол','150 см · подходит для намаза']},chips:['Каждый день','Закрытое']},
  jacket:{img:'M1',ar:.79,name:'Пиджак, шерсть',price:16900,spec:{neck:['Лацкан «нотч»','Классический, 8 см'],cut:['Приталенный, два шлица','Плечо с лёгкой подплечной'],fab:['Шерсть 80%','Камвольная, держит форму'],len:['Классическая длина','Закрывает пояс брюк']},chips:['Свадьба','Офис']},
  kamis:{img:'M2',ar:.48,name:'Камис, хлопок',price:5900,spec:{neck:['Воротник-стойка','Планка на 4 пуговицы'],cut:['Свободный прямой крой','Боковые разрезы, удобно сидеть'],fab:['Хлопок с льном','Плотный, не просвечивает'],len:['Длина до щиколотки','140 см · на рост 175–185']},chips:['Пятница','Праздник']}
};
const DEMO={
  women:[{name:'Лейла',city:'Назрань',note:'вечерние платья',kinds:['dress','lace']},{name:'Магас Мода',city:'Магас',note:'абайи и закрытое',kinds:['long','dress']},
    {name:'Амина',city:'Назрань',note:'свадебное',kinds:['dress','lace']},{name:'Сунжа Стиль',city:'Сунжа',note:'на каждый день',kinds:['long','lace']}],
  men:[{name:'Барс',city:'Назрань',note:'костюмы',kinds:['jacket','kamis']},{name:'Магас Men',city:'Магас',note:'камисы и классика',kinds:['kamis','jacket']},
    {name:'Сунжа Стрит',city:'Сунжа',note:'на каждый день',kinds:['jacket','kamis']},{name:'Эльбрус',city:'Малгобек',note:'верхняя одежда',kinds:['jacket','kamis']}]
};
function demoShop(s,si,hall){
  const out=[];let n=0;
  s.kinds.forEach((k,ki)=>Object.entries(COLORS[k]).forEach(([cn,f],ci)=>{if(n>=11)return;const K=DEMO_KIND[k];
    out.push({id:`demo-${hall}-${si}-${n}`,productId:null,demo:true,kind:k,img:DEMO_IMG[K.img],ar:K.ar,f,color:cn,name:K.name,price:K.price+((si*7+ci*3+ki*5)%6-2)*400,
      shop:s.name,shopId:'demo-'+hall+si,city:s.city,sizes:k==='jacket'||k==='kamis'?SIZES_M:SIZES_W,spec:K.spec,chips:K.chips,spin:null});n++}));
  return {id:'demo-'+hall+si,name:s.name,city:s.city,note:s.note,demo:true,items:out.sort((a,b)=>((a.id.length*37+a.color.length*13)%7)-((b.id.length*37+b.color.length*13)%7))};
}
// Женский зал: настоящие магазины первыми; пока вещей мало — дополняем примером. Мужской зал пока пример.
const liveCount=liveShops.reduce((a,s)=>a+s.items.length,0);
const SHOPS={
  women:liveShops.concat(liveCount<12?DEMO.women.map((s,i)=>demoShop(s,i,'w')):[]),
  men:DEMO.men.map((s,i)=>demoShop(s,i,'m'))
};
const ITEM_BY_ID={}; Object.values(SHOPS).flat().forEach(s=>s.items.forEach(it=>ITEM_BY_ID[it.id]=it));

// ---- Состояние ----
let hall='women';
let cart=[]; try{cart=(JSON.parse(localStorage.getItem('vitrina-zal-cart'))||[]).filter(c=>ITEM_BY_ID[c.id]).map(c=>({...ITEM_BY_ID[c.id],size:c.size||null}))}catch(e){cart=[]}
const saveCart=()=>{try{localStorage.setItem('vitrina-zal-cart',JSON.stringify(cart.map(c=>({id:c.id,size:c.size}))))}catch(e){}};
const lane=$('lane'), bgEl=$('bg');
let rows=[];

function setHall(h){
  hall=h;
  if(h==='men')document.documentElement.setAttribute('data-hall','men'); else document.documentElement.removeAttribute('data-hall');
  document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.h===h));
  $('sub').textContent=h==='men'?'Мужской зал':'Женский зал';
  // фон меняется мягко: гаснет, подменяется, проявляется
  if(!bgEl.style.backgroundImage)bgEl.style.backgroundImage=`url(${BG[h]})`;
  else{bgEl.classList.add('swap');setTimeout(()=>{bgEl.style.backgroundImage=`url(${BG[h]})`;bgEl.classList.remove('swap')},reduce?0:320)}
  renderLane();
}

// ---- Каталка: «листаешь» вещи, как рукой по вешалкам ----
function makeRack(shop,side){
  const r=document.createElement('div'); r.className='rack '+side;
  r.innerHTML=`<span class="rod a"></span><span class="rod b"></span><span class="post a"></span><span class="post b"></span><span class="base"></span><span class="wheel a"></span><span class="wheel b"></span><div class="rail"></div>
    <div class="plaque"><b>${esc(shop.name)}</b><span>${esc(shop.city)}${shop.note?' · '+esc(shop.note):''}${shop.demo?' · пример':''}</span></div>
    <div class="items"></div><div class="acts" hidden><button class="pill ghost" type="button" data-a="look">Рассмотреть</button><button class="pill solid" type="button" data-a="take">В пакет</button></div>`;
  const box=r.querySelector('.items'), acts=r.querySelector('.acts');
  const els=shop.items.map((it,i)=>{const b=document.createElement('button');b.type='button';b.className='it';b.setAttribute('aria-label',`${it.name}${it.color?', '+it.color:''}, ${RUB(it.price)}`);
    b.style.setProperty('--f',it.f);b.innerHTML=`<span class="hook"></span><img src="${it.img}" alt="" loading="lazy" decoding="async"><span class="tag">${it.color?esc(it.color)+' · ':''}${RUB(it.price)}</span>`;
    b.onclick=e=>{e.stopPropagation();if(Math.abs((r._k??-9)-i)<.6||e.detail===0)openJourney(it);else{r._k=i;layout()}};
    b.onfocus=()=>{r._k=i;layout()};
    box.appendChild(b);return b});
  const n=els.length;
  function layout(){
    const cw=box.clientWidth, iw=els[0]?els[0].offsetWidth:0, span=Math.max(1,cw-iw), k=r._k;
    els.forEach((el,i)=>{const x=i*span/Math.max(1,n-1);let tr;
      if(k==null){tr=`translateX(${x}px) rotateY(${side==='l'?58:-58}deg)`;el.style.zIndex=side==='l'?100-i:i;el.classList.remove('open')}
      else{const d=i-k,ad=Math.abs(d),o=Math.max(0,1-ad);const sgn=d<0?-1:1;
        const shift=ad<1e-3?0:sgn*iw*.5*Math.min(1,ad)*Math.exp(-Math.max(0,ad-1)*.5);
        const ang=(1-o)*sgn*-62, z=o*90-ad*4, s=1+o*.07;
        tr=`translateX(${x+shift}px) translateZ(${z}px) rotateY(${ang}deg) scale(${s})`;
        el.style.zIndex=Math.round(300-ad*10);el.classList.toggle('open',ad<.5)}
      el.style.transform=tr});
    if(k==null){acts.hidden=true;return}
    const ki=Math.round(k), x=ki*span/Math.max(1,n-1)+iw/2+box.offsetLeft;
    acts.hidden=false; r._cur=shop.items[ki];
    // кнопки не уезжают за край экрана
    const rr=r.getBoundingClientRect(), sc=rr.width/Math.max(1,r.offsetWidth), half=acts.offsetWidth/2+8, g=Math.min(innerWidth-half,Math.max(half,rr.left+x*sc));
    acts.style.left=((g-rr.left)/sc)+'px';
  }
  let leaveT;
  box.addEventListener('pointermove',e=>{clearTimeout(leaveT);const rc=box.getBoundingClientRect(),iw=els[0].getBoundingClientRect().width||els[0].offsetWidth;
    r._k=Math.max(0,Math.min(n-1,(e.clientX-rc.left-iw/2)/Math.max(1,rc.width-iw)*(n-1)));layout();$('hint').style.opacity=0});
  r.addEventListener('pointerleave',e=>{if(e.pointerType==='touch')return;leaveT=setTimeout(()=>{r._k=null;layout()},500)});
  acts.querySelector('[data-a="look"]').onclick=()=>r._cur&&openJourney(r._cur);
  acts.querySelector('[data-a="take"]').onclick=()=>{if(!r._cur)return;const el=els[Math.round(r._k)];take(r._cur,el.querySelector('img'))};
  r._layout=layout; new ResizeObserver(layout).observe(box);
  return r;
}

// ---- Лента: ряды магазинов идут сверху вниз — слева и справа, ниже снова слева и справа ----
const io=new IntersectionObserver(es=>es.forEach(e=>{const racks=e.target.querySelectorAll('.rack');
  if(e.intersectionRatio>=.2)racks.forEach(r=>r.classList.add('in'));else if(!e.isIntersecting)racks.forEach(r=>r.classList.remove('in'))}),{root:lane,threshold:[0,.2]});
function setMount(m){
  if(m==='cart')document.documentElement.setAttribute('data-mount','cart');else document.documentElement.removeAttribute('data-mount');
  document.querySelectorAll('.mount button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===m));
  try{localStorage.setItem('vitrina-mount',m)}catch(e){}
  // проигрываем появление заново для рядов в кадре
  const live=[...lane.querySelectorAll('.rack.in')];
  live.forEach(r=>{r.classList.add('reset');r.classList.remove('in')}); void lane.offsetWidth;
  live.forEach(r=>r.classList.remove('reset'));
  requestAnimationFrame(()=>requestAnimationFrame(()=>live.forEach(r=>r.classList.add('in'))));
}
document.querySelectorAll('.mount button').forEach(b=>b.onclick=()=>setMount(b.dataset.m));
function renderLane(){
  const list=SHOPS[hall], other=hall==='men'?'women':'men';
  io.disconnect();
  // зал идёт сверху вниз: первая пара магазинов внизу экрана, следующие спускаются сверху
  lane.innerHTML='<div class="pad"></div>'; rows=[];
  for(let i=0;i<list.length;i+=2){
    const row=document.createElement('section'); row.className='row'; row.setAttribute('aria-label',list.slice(i,i+2).map(s=>s.name).join(' и '));
    [list[i]&&makeRack(list[i],'l'),list[i+1]&&makeRack(list[i+1],'r')].filter(Boolean).forEach(r=>row.appendChild(r));
    lane.insertBefore(row,lane.firstChild); rows.push(row); io.observe(row);
  }
  const end=document.createElement('div'); end.className='end';
  end.innerHTML=`<span>Конец зала · ${list.length} магазинов</span><b>${other==='men'?'Дальше — мужской зал':'Дальше — женский зал'}</b><button type="button">Перейти →</button>`;
  end.querySelector('button').onclick=()=>setHall(other);
  lane.insertBefore(end,lane.firstChild);
  rows.forEach(rw=>rw.querySelectorAll('.rack').forEach(r=>r._layout()));
  $('walk').innerHTML=rows.map((rw,i)=>`<button type="button" aria-label="${rw.getAttribute('aria-label')}" data-i="${i}"></button>`).join('');
  $('walk').querySelectorAll('button').forEach(b=>b.onclick=()=>toRow(+b.dataset.i));
  toRow(0,true); laneFrame();
}
let wheelT=null, wheelRaf=0;
function toRow(i,instant){const rw=rows[Math.max(0,Math.min(rows.length-1,i))];if(!rw)return;wheelT=null;lane.scrollTo({top:rw.offsetTop+rw.offsetHeight/2-innerHeight/2,behavior:reduce||instant?'auto':'smooth'})}
// колесо и тачпад: крутишь вниз — вещи едут сверху вниз, как будто спускаешься по залу; плавно, с инерцией
lane.addEventListener('wheel',e=>{if(e.ctrlKey)return;e.preventDefault();
  const max=lane.scrollHeight-lane.clientHeight, d=e.deltaMode===1?e.deltaY*32:e.deltaY;
  wheelT=Math.max(0,Math.min(max,(wheelT??lane.scrollTop)-d));
  if(reduce){lane.scrollTop=wheelT;wheelT=null;return}
  if(!wheelRaf)wheelRaf=requestAnimationFrame(function step(){if(wheelT==null){wheelRaf=0;return}
    const cur=lane.scrollTop, nx=cur+(wheelT-cur)*.18; lane.scrollTop=Math.abs(wheelT-nx)<.5?wheelT:nx;
    if(lane.scrollTop===wheelT){wheelT=null;wheelRaf=0}else wheelRaf=requestAnimationFrame(step)})},{passive:false});
lane.addEventListener('touchstart',()=>{wheelT=null},{passive:true});
function curRow(){let best=0,bd=1e9;rows.forEach((rw,i)=>{const b=rw.getBoundingClientRect(),d=Math.abs(b.top+b.height/2-innerHeight/2);if(d<bd){bd=d;best=i}});return best}

// ряд в фокусе — чёткий и в полный размер; уходящие вверх и вниз чуть мельче, мягче и размытее, как глубина резкости
const desk=matchMedia('(min-width:761px)').matches;
const view={sc:1.06,ty:0}; 
function laneFrame(){
  const vh=innerHeight, max=Math.max(1,lane.scrollHeight-vh), p=1-lane.scrollTop/max;
  rows.forEach(rw=>{const b=rw.getBoundingClientRect(), c=(b.top+b.height/2-vh/2)/vh, a=Math.abs(c);
    if(reduce){rw.style.opacity=1;return}
    rw.style.opacity=Math.max(0,1-Math.max(0,a-.42)*1.4).toFixed(3);
    rw.style.transform=`scale(${(1-Math.min(.09,a*.08)).toFixed(4)})`;
    if(desk)rw.style.filter=a>.45?`blur(${Math.min(3,(a-.45)*6).toFixed(2)}px)`:'none'});
  view.sc=1.06+p*.14; view.ty=-p*2.6; kick();
  const ci=curRow(); $('walk').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('on',i===ci));
  if(p>.04)$('hint').style.opacity=0;
}
lane.addEventListener('scroll',()=>requestAnimationFrame(laneFrame),{passive:true});
addEventListener('resize',()=>requestAnimationFrame(laneFrame));

// ---- Живой фон: лёгкий параллакс за курсором и шаг вглубь при прокрутке; тёплый блик идёт за рукой ----
const aim={x:0,y:0,gx:innerWidth/2,gy:innerHeight*.4}, cur={x:0,y:0,gx:innerWidth/2,gy:innerHeight*.4,sc:1.06,ty:0};
let bgRaf=0;
function kick(){if(!bgRaf)bgRaf=requestAnimationFrame(bgTick)}
function bgTick(){
  const k=reduce?1:.07; let moving=false;
  for(const [a,c] of [['x','x'],['y','y'],['gx','gx'],['gy','gy']]){cur[c]+=(aim[a]-cur[c])*k;if(Math.abs(aim[a]-cur[c])>.002)moving=true}
  cur.sc+=(view.sc-cur.sc)*k*1.4; cur.ty+=(view.ty-cur.ty)*k*1.4; if(Math.abs(view.sc-cur.sc)>.0005||Math.abs(view.ty-cur.ty)>.01)moving=true;
  bgEl.style.transform=`translate(${(-cur.x*16).toFixed(2)}px,${(-cur.y*10).toFixed(2)}px) translateY(${cur.ty.toFixed(3)}%) scale(${cur.sc.toFixed(4)})`;
  $('glow').style.transform=`translate(${cur.gx.toFixed(1)}px,${cur.gy.toFixed(1)}px)`;
  bgRaf=moving?requestAnimationFrame(bgTick):0;
}
addEventListener('pointermove',e=>{aim.x=e.clientX/innerWidth*2-1;aim.y=e.clientY/innerHeight*2-1;aim.gx=e.clientX;aim.gy=e.clientY;kick()},{passive:true});
if(window.DeviceOrientationEvent&&!desk)addEventListener('deviceorientation',e=>{if(e.gamma==null)return;aim.x=Math.max(-1,Math.min(1,e.gamma/25));aim.y=Math.max(-1,Math.min(1,(e.beta-45)/25));kick()},{passive:true});

addEventListener('keydown',e=>{if(!$('jr').hidden||$('drawer').classList.contains('on'))return;
  if(e.key==='ArrowDown'||e.key==='PageDown'){e.preventDefault();toRow(curRow()+1)}
  if(e.key==='ArrowUp'||e.key==='PageUp'){e.preventDefault();toRow(curRow()-1)}});
document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>setHall(b.dataset.h));

// ---- Путь вещи: скролл ведёт камеру — целиком, вращение 360° (если продавец снял видео), вырез, крой, ткань, длина, размер ----
let STEPS=[];
function stepsFor(it){
  const K=KIND[it.kind]||KIND.dress;
  const mid=['neck','cut','fab','len'].map(k=>{const [s,x,y,ry]=K.path[k];return{key:k,label:K.lbl[k],s,x,y,ry,dx:0}});
  const spin=it.spin?[{key:'spin',label:'360°',s:1,x:.5,y:.5,ry:0,dx:0}]:[];
  return [{key:'full',label:'Целиком',s:1,x:.5,y:.5,ry:-8,dx:.1},...spin,...mid,{key:'buy',label:'Размер',s:1,x:.5,y:.5,ry:12,dx:-.13}];
}
const jr=$('jr'), cam=$('cam'), cap=$('cap'), jspin=$('jspin');
let J=null, jSize=null, frames=[];
function openJourney(it){
  J=it; jSize=null; STEPS=stepsFor(it);
  jr.classList.toggle('lite',['Белый','Шампань','Песок','Беж','Пудра'].includes(it.color));
  const img=$('jimg'); img.src=it.img; cam.style.setProperty('--m',`url("${it.img}")`); cam.style.setProperty('--f',it.f); cam.style.setProperty('--ar',it.ar||.6);
  if(!it.ar)img.onload=()=>{if(J===it&&img.naturalWidth)cam.style.setProperty('--ar',img.naturalWidth/img.naturalHeight);frameJ()};
  // кадры вращения грузим сразу, пока человек смотрит первый экран
  frames=it.spin?Array.from({length:it.spin.n},(_,i)=>{const im=new Image();im.decoding='async';im.src=it.spin.url(i);return im}):[];
  jspin.hidden=!it.spin; if(it.spin)jspin.src=frames[0].src;
  $('jname').textContent=it.name+(it.color?' · '+it.color:''); $('jshop').textContent=it.shop+' · '+it.city; $('jprice').textContent=RUB(it.price);
  $('steps').innerHTML=STEPS.map((s,i)=>`<button type="button" data-i="${i}"><span>${s.label}</span><i></i></button>`).join('');
  $('steps').querySelectorAll('button').forEach(b=>b.onclick=()=>{const max=jr.scrollHeight-innerHeight;jr.scrollTo({top:max*(+b.dataset.i)/(STEPS.length-1),behavior:reduce?'auto':'smooth'})});
  $('final').innerHTML=`<div class="fh"><span>${esc(it.shop)} · ${esc(it.city)}${it.demo?' · пример':''}</span><b>${esc(it.name)}</b><em>${it.color?esc(it.color)+' · ':''}${RUB(it.price)}</em></div>
    <div class="sizes" role="group" aria-label="Размер">${it.sizes.map(s=>`<button type="button" aria-pressed="false">${esc(s)}</button>`).join('')}</div>
    <div class="row"><button class="btn" type="button" id="jtake">В пакет · ${RUB(it.price)}</button><button class="btn q" type="button" disabled title="Скоро">Примерить на манекене</button></div>
    <div class="note">${it.demo?'Это вещь-пример: заказать её нельзя, но её можно положить в пакет и посмотреть, как всё работает.':'Курьер заберёт её из магазина вместе с вещами из других магазинов и привезёт одним заказом.'}</div>`;
  $('final').querySelectorAll('.sizes button').forEach(b=>b.onclick=()=>{jSize=b.textContent;$('final').querySelectorAll('.sizes button').forEach(x=>x.setAttribute('aria-pressed',x===b))});
  $('jtake').onclick=()=>{take(it,$('jimg'),jSize);closeJourney()};
  jr.hidden=false; jr.scrollTop=0; pT=pC=0; frameJ(); $('jback').focus();
  // снапы — на каждой точке маршрута
  $('snaps').innerHTML=STEPS.map((_,i)=>`<i class="snap" style="top:calc(520vh * ${i} / ${STEPS.length-1})"></i>`).join('');
}
function closeJourney(){jr.hidden=true;J=null;frames=[]}
$('jback').onclick=closeJourney;
addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('modal').hidden)$('modal').hidden=true;else if(!jr.hidden)closeJourney();else if($('drawer').classList.contains('on'))bag(false)}});
const sm=t=>t*t*(3-2*t), K0=()=>KIND[J.kind]||KIND.dress;
let pT=0,pC=0,jRaf=0;
function jTick(){pC+=(pT-pC)*(reduce?1:.13);if(Math.abs(pT-pC)<.0004)pC=pT;frameJ();jRaf=pC!==pT?requestAnimationFrame(jTick):0}
function frameJ(){
  if(!J)return;
  const p=pC; $('progI').style.transform=`scaleY(${p})`;
  const t=p*(STEPS.length-1), i=Math.min(STEPS.length-2,Math.floor(t)), f=sm(t-i), A=STEPS[i], B=STEPS[i+1];
  const L=(a,b)=>a+(b-a)*f, s=L(A.s,B.s), x=L(A.x,B.x), y=L(A.y,B.y), ry=L(A.ry,B.ry);
  const w=cam.offsetWidth, h=cam.offsetHeight;
  const sideShift=innerWidth>760?L(A.dx,B.dx)*innerWidth:0;
  const sway=K0().sway&&!reduce?Math.sin(p*Math.PI*3)*1.6*K0().sway:0;
  cam.style.transform=`translate(-50%,-50%) translate(${(.5-x)*w*s+sideShift}px,${(.5-y)*h*s}px) scale(${s}) rotateY(${ry}deg) rotateZ(${sway}deg)`;
  $('sheen').style.backgroundPosition=`${120-p*140}% 0`; $('sheen').style.opacity=K0().sheen;
  $('grain').style.opacity=Math.max(0,(s-2.2)/1.4)*.35;
  // вращение: на шаге «360°» скролл крутит кадры видео, фото на это время уходит
  if(J.spin){const si=STEPS.findIndex(st=>st.key==='spin'), d=t-si, vis=Math.max(0,Math.min(1,1.6-Math.abs(d)*2.2));
    jspin.style.opacity=vis; cam.style.opacity=1-vis;
    if(vis>0&&frames.length){const k=Math.max(0,Math.min(1,(d+.7)/1.4)), im=frames[Math.round(k*(frames.length-1))];if(im.complete&&im.naturalWidth&&jspin.src!==im.src)jspin.src=im.src}}
  else cam.style.opacity=1;
  const ri=Math.round(t), dd=Math.abs(t-ri), op=Math.max(0,1-dd*2.4);
  const st=STEPS[ri];
  if(st.key==='full'){cap.innerHTML=`<span class="n">${esc(J.shop)} · ${esc(J.city)}</span><h3>${esc(J.name)}</h3><p>${J.color?`Цвет «${esc(J.color)}». `:''}Крути вниз — покажем ${J.spin?'вещь со всех сторон, ':''}вырез, крой, ткань и длину вблизи.</p>${J.chips.length?`<div class="chips">${J.chips.map(c=>`<span>${esc(c)}</span>`).join('')}</div>`:''}`}
  else if(st.key==='spin'){cap.innerHTML=`<span class="n">0${ri+1} · 360°</span><h3>Со всех сторон</h3><p>Крути — вещь поворачивается. Снято продавцом в магазине.</p>`}
  else if(st.key==='buy'){cap.innerHTML=''}
  else{const [hh,pp]=J.spec[st.key];cap.innerHTML=`<span class="n">0${ri+1} · ${st.label}</span><h3>${esc(hh)}</h3>${pp?`<p>${esc(pp)}</p>`:''}`}
  cap.style.opacity=st.key==='buy'?0:op; cap.style.visibility=st.key==='buy'?'hidden':''; cap.style.transform=(innerWidth>760?'translateY(-50%) ':'')+`translateY(${(1-op)*14}px)`;
  const fin=t>=STEPS.length-1.4; $('final').classList.toggle('off',!fin); $('steps').style.opacity=fin?0:1;
  $('cue').style.opacity=p<.03?1:0;
  $('steps').querySelectorAll('button').forEach((b,bi)=>b.classList.toggle('on',bi===ri));
}
jr.addEventListener('scroll',()=>{const max=Math.max(1,jr.scrollHeight-innerHeight);pT=Math.min(1,Math.max(0,jr.scrollTop/max));if(!jRaf)jRaf=requestAnimationFrame(jTick)},{passive:true});
addEventListener('resize',()=>{if(J)frameJ()});

// ---- Пакет: вещи из разных магазинов — один заказ, курьер объезжает магазины ----
const DELIVERY_BASE=250, DELIVERY_PER_SHOP=150; // тот же тариф считает place_order в базе
function setBadge(){$('bagN').textContent=cart.length;$('bagN').hidden=!cart.length}
function take(it,fromImg,size){
  cart.push({...it,size:size||null}); saveCart(); setBadge();
  if(fromImg&&!reduce){const a=fromImg.getBoundingClientRect(),b=$('bagBtn').getBoundingClientRect();
    const fl=document.createElement('img');fl.src=it.img;fl.className='flyer';fl.style.filter=it.f;
    Object.assign(fl.style,{left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px'});document.body.appendChild(fl);
    fl.animate([{transform:'none',opacity:1},{transform:`translate(${b.left+b.width/2-a.left-a.width/2}px,${b.top+b.height/2-a.top-a.height/2}px) scale(.08)`,opacity:.6}],{duration:700,easing:'cubic-bezier(.5,0,.2,1)'}).onfinish=()=>{fl.remove();$('bagBtn').classList.remove('pop');void $('bagBtn').offsetWidth;$('bagBtn').classList.add('pop')}}
  toast(`«${it.name}» в пакете`);
}
let tT;function toast(t){const el=$('toast');el.textContent=t;el.hidden=false;el.style.opacity=1;clearTimeout(tT);tT=setTimeout(()=>{el.style.opacity=0;setTimeout(()=>el.hidden=true,300)},1800)}
function bag(on){$('drawer').classList.toggle('on',on);$('scrim').classList.toggle('on',on);if(on)renderBag()}
$('bagBtn').onclick=()=>bag(true); $('dclose').onclick=()=>bag(false); $('scrim').onclick=()=>bag(false);
function totals(){const goods=cart.reduce((a,c)=>a+c.price,0), shops=[...new Set(cart.map(c=>c.shopId))];return {goods,shops,del:shops.length?DELIVERY_BASE+DELIVERY_PER_SHOP*(shops.length-1):0}}
function renderBag(){
  const body=$('dbody'), foot=$('dfoot');
  if(!cart.length){body.innerHTML='<div class="empty">Пакет пуст.<br>Наведи на каталку, веди по вещам и жми «В пакет».</div>';foot.innerHTML='';return}
  const {goods,shops,del}=totals();
  body.innerHTML=shops.map(sid=>{const first=cart.find(c=>c.shopId===sid);return `<div><h4>${esc(first.shop)} · ${esc(first.city)}${first.demo?' · пример':''}</h4>${cart.map((c,i)=>c.shopId!==sid?'':`<div class="li"><img src="${c.img}" alt="" style="--f:${c.f}"><div><b>${esc(c.name)}</b><span>${c.color?esc(c.color):''}${c.size?(c.color?' · ':'')+'размер '+esc(c.size):''}</span><br><button class="x" type="button" data-i="${i}">Убрать</button></div><div class="p">${RUB(c.price)}</div></div>`).join('')}</div>`}).join('');
  body.querySelectorAll('.x').forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.i,1);saveCart();setBadge();renderBag()});
  const demo=cart.some(c=>c.demo), noSize=cart.some(c=>!c.demo&&!c.size);
  foot.innerHTML=`<div class="ln"><span>Вещи · ${cart.length} шт.</span><span>${RUB(goods)}</span></div><div class="ln"><span>Курьер: ${shops.length} ${shops.length===1?'магазин':'магазина'} → вам</span><span>${RUB(del)}</span></div><div class="ln t"><span>Итого</span><span>${RUB(goods+del)}</span></div>
    <button class="btn q" type="button" disabled>Примерить всё на манекене · скоро</button><button class="btn" type="button" id="order" ${demo||noSize?'disabled':''}>Оформить один заказ</button>
    <div class="note">${demo?'В пакете есть вещи-примеры: их заказать нельзя. Уберите их, чтобы оформить заказ.':noSize?'Выберите размер у каждой вещи: откройте её и пролистайте до конца.':`Доставка: ${DELIVERY_BASE} ₽ + ${DELIVERY_PER_SHOP} ₽ за каждый следующий магазин. Оплата курьеру.`}</div>`;
  if(!demo&&!noSize)$('order').onclick=checkout;
}
function checkout(){
  const {goods,shops,del}=totals(), m=$('modal'), total=goods+del;
  m.innerHTML=`<form class="card" id="coForm" role="dialog" aria-label="Оформление заказа"><h3>Один заказ, ${shops.length} ${shops.length===1?'магазин':'магазина'}</h3>
    <label class="fld"><span>Имя</span><input id="coName" required autocomplete="name"></label>
    <label class="fld"><span>Телефон</span><input id="coPhone" required type="tel" autocomplete="tel" placeholder="+7"></label>
    <label class="fld"><span>Адрес</span><input id="coAddr" required autocomplete="street-address" placeholder="Город, улица, дом"></label>
    <label class="fld"><span>Комментарий</span><input id="coCom" placeholder="Подъезд, время, примерка"></label>
    <div class="note err" id="coErr" role="alert"></div>
    <div class="row"><button class="btn" type="submit" id="coGo">Заказать за ${RUB(total)}</button><button class="btn q" type="button" id="mclose">Назад</button></div>
    <div class="note">Оплата курьеру при получении. Перед выездом позвоним и подтвердим наличие.</div></form>`;
  m.hidden=false; $('mclose').onclick=()=>m.hidden=true; $('coName').focus();
  $('coForm').onsubmit=async e=>{e.preventDefault();
    const go=$('coGo'), err=$('coErr'); go.disabled=true; go.textContent='Отправляю…'; err.textContent='';
    const {data,error}=await sb.rpc('place_order',{p_customer_name:$('coName').value,p_phone:$('coPhone').value,p_address:$('coAddr').value,p_comment:$('coCom').value,
      p_items:cart.map(c=>({product_id:c.productId,size:c.size||'',qty:1}))});
    if(error){err.textContent=error.message||'Не получилось оформить. Попробуйте ещё раз.';go.disabled=false;go.textContent=`Заказать за ${RUB(total)}`;return}
    cart=[];saveCart();setBadge();bag(false);
    m.innerHTML=`<div class="card" role="dialog" aria-label="Заказ принят"><h3>Заказ принят</h3><p class="note">Номер ${esc(String(data).slice(0,8).toUpperCase())}. Позвоним в течение 15 минут, подтвердим наличие и время доставки.</p><div class="row"><button class="btn" type="button" id="mclose">Отлично</button></div></div>`;
    $('mclose').onclick=()=>m.hidden=true};
}

try{if(localStorage.getItem('vitrina-mount')==='cart')setMount('cart')}catch(e){}
setBadge(); setHall('women');
setTimeout(()=>{$('hint').style.opacity=0},6000);
