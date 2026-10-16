// Зал Витрины: фото-зал, ряды магазинов идут вертикально (слева и справа), вещи на каталках,
// «путь вещи» по скроллу (вращение 360° из видео продавца + приближение деталей), общий пакет на несколько магазинов.
import { sb, photoUrl, spinUrl, loadCatalog } from './sb.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const RUB=n=>Number(n).toLocaleString('ru-RU')+' ₽';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const BG={women:'/proby/hall-white-2x.webp',men:'/proby/a-men-2x.webp'};
const BGD={women:[3344,1880],men:[2688,1536]}; // размеры фонов в px — по ним считается cover
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
  return {id:p.id,productId:p.id,hex:p.color||null,kind,img:ph?photoUrl(ph.storage_path):sil(p.color||'#888'),ar:ph?null:.5,f:'saturate(1)',color:'',name:p.name,price:p.price,
    shop:sh.name,shopId:sh.id,city:sh.city,sizes:p.sizes&&p.sizes.length?p.sizes:SIZES_W,spec,chips:d.occasions||[],
    spin:p.spin_frames?{n:p.spin_frames,url:i=>spinUrl(p,i)}:null};
}
const dbShops=CATALOG.shops.map(s=>({id:s.id,name:s.name,city:s.city,note:s.note||'',whatsapp:s.whatsapp||'',items:[]}));
const dbById=Object.fromEntries(dbShops.map(s=>[s.id,s]));
CATALOG.products.forEach(p=>{const sh=dbById[p.shop_id];if(sh)sh.items.push(fromDb(p,sh))});
// тестовый магазин из базы показываем как пример (только на фронте, в базу не пишем): без заказа
dbShops.filter(s=>/^тест/i.test(s.name.trim())).forEach(s=>{s.demo=true;s.items.forEach(it=>{it.demo=true})});
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
// название на табличке целиком: коэффициент --k (кегль в долях ширины каталки) от доли, что влезает; от глубины не зависит
function fitPlaques(){document.querySelectorAll('.plaque b').forEach(b=>{b.style.setProperty('--k',1);if(b.clientWidth)b.style.setProperty('--k',Math.max(.5,Math.min(1,(b.clientWidth-1)/b.scrollWidth)).toFixed(3))})}
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
  document.documentElement.setAttribute('data-hall',h); // women — белый зал (светлая тема), men — тёмный
  document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.h===h));
  $('sub').textContent=h==='men'?'Мужской зал':'Женский зал';
  bgEl.style.backgroundImage=`url(${BG[h]})`; // один фон на зал, без перекрёстных переходов
  renderLane();
}

// ---- Каталка: «листаешь» вещи, как рукой по вешалкам ----
function makeRack(shop,side){
  const r=document.createElement('div'); r.className='rack '+side;
  const spr=(l)=>`<picture><source media="(max-width:760px)" srcset="/zal/rack-${l}-m.webp"><img class="spr" src="/zal/rack-${l}.webp" alt="" draggable="false" decoding="async"></picture>`;
  r.innerHTML=`<span class="floor"><i></i></span>${spr('front').replace('class="spr"','class="spr refl"')}${spr('back')}<div class="items"></div>${spr('front')}<span class="fog"></span>
    <button class="plaque" type="button" aria-label="Открыть магазин ${esc(shop.name)}"><b>${esc(shop.name)}</b><span>${esc(shop.city)}${shop.note?' · '+esc(shop.note):''}${shop.demo?' · пример':''}</span><i>Открыть магазин →</i></button>
    <div class="acts" hidden><button class="pill ghost" type="button" data-a="look">Рассмотреть</button><button class="pill solid" type="button" data-a="take">В пакет</button></div>`;
  const box=r.querySelector('.items'), acts=r.querySelector('.acts'); r._sw=[]; r._fl=r.querySelector('.floor'); r._ct=r.querySelector('.floor i'); r._fg=r.querySelector('.fog'); r._dd=side==='l'?-1:1;
  r.querySelector('.plaque').onclick=()=>openShop(shop);
  // клик по каркасу: 1-й приближает каталку, 2-й открывает магазин (вещи и табличка — свои клики)
  r.addEventListener('click',e=>{if(e.target.closest('button,.plaque,.acts'))return;e.stopPropagation();if(ZF===r)openShop(shop);else zoomRack(r)});
  const els=shop.items.map((it,i)=>{const b=document.createElement('button');b.type='button';b.className='it';b.setAttribute('aria-label',`${it.name}${it.color?', '+it.color:''}, ${RUB(it.price)}`);
    b.style.setProperty('--f',it.f);b.innerHTML=`<span class="sw"><svg class="hg" viewBox="0 0 120 40" aria-hidden="true"><use href="#hanger"/></svg><img src="${it.img}" alt="" loading="lazy" decoding="async"></span><span class="tag">${it.color?esc(it.color)+' · ':''}${RUB(it.price)}</span>`;
    registerSway(r,b.firstChild);
    b.onclick=e=>{e.stopPropagation();if(Math.abs((r._k??-9)-i)<.6||e.detail===0)openJourney(it);else{r._k=i;layout()}};
    b.onfocus=()=>{r._k=i;layout()};
    box.appendChild(b);return b});
  const n=els.length;
  function layout(){
    const cw=box.clientWidth, iw=els[0]?els[0].offsetWidth:0, span=Math.max(1,cw-iw), k=r._k;
    els.forEach((el,i)=>{const x=i*span/Math.max(1,n-1);let tr;
      if(k==null){tr=`translateX(${x}px) rotateY(${side==='l'?55:-55}deg)`;el.style.zIndex=side==='l'?100-i:i;el.classList.remove('open')}
      else{const d=i-k,ad=Math.abs(d),o=Math.max(0,1-ad);const sgn=d<0?-1:1;
        const shift=ad<1e-3?0:sgn*iw*.5*Math.min(1,ad)*Math.exp(-Math.max(0,ad-1)*.5);
        // как на настоящей штанге: вещь поворачивается к тебе и чуть выходит вперёд, соседи раздвигаются — без увеличения
        const ang=(1-o)*sgn*-55, z=o*16;
        tr=`translateX(${x+shift}px) translateZ(${z}px) rotateY(${ang}deg)`;
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

// ---- Лента: ряд = пара магазинов зигзагом (левый выше, правый чуть ниже); вниз по ленте = дальше по залу ----
// каталки выкатываются из глубины зала по скроллу (scrub): положение считает общий цикл кадров, IO отбирает только ряды рядом с экраном
const near=new IntersectionObserver(es=>{
  es.forEach(e=>e.target.querySelectorAll('.rack').forEach(r=>{r._near=r._on=e.isIntersecting;r._dirty=true;if(!e.isIntersecting)swayStop(r)}));
  kick();
},{root:lane,rootMargin:'60% 0px 60% 0px'});
// интро: первый экран скролла камера отъезжает (поле зрения раскрывается, у стен появляются магазины 3–6),
// дальше шаг вперёд — интро-каталки проходят мимо, ряды начинаются со следующего магазина
const IR=[], IN={t:0,B:1,_last:-1}; let IT=null;
function renderLane(){
  const list=SHOPS[hall], other=hall==='men'?'women':'men', NI=Math.min(list.length,INTRO[mob()?'m':'d'].length);
  unzoom(); near.disconnect(); if(IT){IT.scrollTrigger.kill();IT.kill();IT=null}
  lane.innerHTML=''; rows=[]; SW.length=0; IR.length=0;
  const intro=document.createElement('section'); intro.className='intro'; intro.style.zIndex=list.length+2;
  intro.setAttribute('aria-label',list.slice(0,NI).map(s=>s.name).join(', '));
  intro.innerHTML='<div class="stage"></div>';
  list.slice(0,NI).forEach((s,i)=>{const r=makeRack(s,i%2?'r':'l');r._i=i;r._on=true;intro.firstChild.appendChild(r);IR.push(r)});
  lane.appendChild(intro); lane.insertAdjacentHTML('beforeend','<div class="pad"></div>');
  for(let i=NI;i<list.length;i+=2){
    const row=document.createElement('section'); row.className='row'; row.setAttribute('aria-label',list.slice(i,i+2).map(s=>s.name).join(' и '));
    [list[i]&&makeRack(list[i],'l'),list[i+1]&&makeRack(list[i+1],'r')].filter(Boolean).forEach(r=>row.appendChild(r));
    row.style.zIndex=list.length-i; // ближние ряды перекрывают дальние
    lane.appendChild(row); rows.push(row); near.observe(row);
  }
  const end=document.createElement('div'); end.className='end';
  end.innerHTML=`<span>Конец зала · ${list.length} магазинов</span><b>${other==='men'?'Дальше — мужской зал':'Дальше — женский зал'}</b><button type="button">Перейти →</button>`;
  end.querySelector('button').onclick=()=>setHall(other);
  lane.appendChild(end);
  rows.forEach(rw=>rw.querySelectorAll('.rack').forEach(r=>r._layout()));
  fitPlaques(); document.fonts&&document.fonts.ready.then(fitPlaques); requestAnimationFrame(()=>requestAnimationFrame(fitPlaques));
  $('walk').innerHTML=rows.map((rw,i)=>`<button type="button" aria-label="${rw.getAttribute('aria-label')}" data-i="${i}"></button>`).join('');
  $('walk').querySelectorAll('button').forEach(b=>b.onclick=()=>toRow(+b.dataset.i));
  wheelT=null; lane.scrollTop=0; measure();
  RK.forEach(r=>{r._near=r._on=true}); // до первого отчёта IO считаем все рядом
  lagTop=lane.scrollTop; IN.t=reduce?1:0;
  // GSAP ScrollTrigger: прогресс интро по скроллу ленты со scrub-сглаживанием; DOM пишет только frame()
  if(!reduce&&IR.length)IT=gsap.to(IN,{t:1,ease:'none',onUpdate:kick,scrollTrigger:{scroller:lane,trigger:intro,start:'top top',end:'bottom bottom',scrub:.6}});
  stepRacks(.016); laneFrame(); kick();
}
const mob=()=>matchMedia('(max-width:760px)').matches;
// перспектива зала берётся из фото: точка схода VP (доли кадра фото) переводится в экран с учётом cover и inset фона.
// Всё стоит на полу: низ плиты на глубине s — hy+G·s, высота каталки H1·s (верх у линии глаз, как у вешалок в фото)
const VP={women:[.497,.58],men:[.5,.58]};
const VANISH_SPREAD={d:.04,m:.07}, FAR=.45, DS=.82, B0=1.6;
// мир интро в общем плане: [глубина s, центр x в долях экрана]; 0–1 — стартовая пара, дальше по стенам (чёт — левая)
const INTRO={d:[[.74,.37],[.64,.66],[.52,.065],[.48,.935],[.38,.2],[.36,.81]],m:[[.8,.28],[.68,.74],[.42,.08],[.38,.93]]};
const GEO={vx:0,hy:0,G:1,H1:1,ar:1.2775,sb:.953};
function geo(){
  const vw=innerWidth, vh=innerHeight, m=mob();
  const Ew=vw*1.14, Eh=vh*1.14, [iw,ih]=BGD[hall], c=Math.max(Ew/iw,Eh/ih), Dw=iw*c, Dh=ih*c, [u,v]=VP[hall];
  const ex=(Ew-Dw)*.5+u*Dw, ey=(Eh-Dh)*.4+v*Dh; // фон: inset -7%, background-position center 40%
  bgEl.style.transformOrigin=`${ex.toFixed(1)}px ${ey.toFixed(1)}px`; // камера масштабирует фон вокруг точки схода
  GEO.vx=ex-vw*.07; GEO.hy=ey-vh*.07; GEO.ar=m?2.5:1.2775; GEO.sb=m?.976:.953;
  GEO.G=Math.min(vh*.93,vh-30)-GEO.hy;
  GEO.H1=Math.min(GEO.G*1.35,(m?vw*.5:Math.min(vw*.38,560))*GEO.ar);
  GEO.mx=m?vw*.03:Math.max(18,vw*.04);
}
function put(r,s,cx,cTop){const H=GEO.H1*s, w=H/GEO.ar, yb=GEO.hy+GEO.G*s;
  r.style.width=w.toFixed(1)+'px'; r.style.left=(cx-w/2).toFixed(1)+'px'; r.style.top=(yb-GEO.sb*H-cTop).toFixed(1)+'px'; r.style.zIndex=Math.round(s*100); r._s=s}
function place(){
  const vw=innerWidth, vh=innerHeight, k=mob()?'m':'d', w1=GEO.H1/GEO.ar;
  IR.forEach((r,i)=>{const [s,x]=INTRO[k][i]||INTRO.d[i];put(r,s,x*vw,0);r._x0=parseFloat(r.style.left);r._y0=parseFloat(r.style.top)});
  IN._last=-1;
  rows.forEach(rw=>{const top=(vh-rw.offsetHeight)/2, l=rw.querySelector('.rack.l'), rr=rw.querySelector('.rack.r');
    if(l)put(l,1,GEO.mx+w1/2,top); if(rr)put(rr,DS,vw-GEO.mx-w1*DS/2,top)}); // правая чуть дальше: выше и мельче
}
// интро-кадр: B — во сколько раз камера ближе общего плана (фон и стены ×B, стартовая пара ×B^0.4 — эффект dolly),
// d — шаг вперёд: глубина 1/s уменьшается, каталка растёт и уходит за край
function stepIntro(){
  if(!IR.length||IN.t===IN._last)return; IN._last=IN.t;
  const T=IN.t*1.9, a=Math.min(1,T), ea=a*a*(3-2*a), d=Math.max(0,T-1)/.9*2.5;
  const B=1+(B0-1)*(1-ea); IN.B=B;
  for(const r of IR){
    const m=r._i<2?Math.pow(B,.4):B, sc=r._s*m, gap=1-d*sc;
    let op=(r._i<2?1:Math.min(1,ea*2))*Math.min(1,Math.max(0,(gap-.12)/.3));
    const vis=op>.01; r._on=vis; if(!vis)swayStop(r);
    r.style.visibility=vis?'':'hidden'; if(!vis)continue;
    const F=m/gap;
    r.style.transform=F===1?'':`translate3d(${((GEO.vx-r._x0)*(1-F)).toFixed(1)}px,${((GEO.hy-r._y0)*(1-F)).toFixed(1)}px,0) scale(${F.toFixed(4)})`;
    r.style.opacity=op>.99?'':op.toFixed(3); r.style.pointerEvents=op<.15?'none':'';
    r._fg.style.opacity=(Math.max(0,1-sc/gap)*.45).toFixed(3);
  }
}
// геометрия каталок кэшируется (offset* — без layout-чтений в цикле): верх в ленте, откуда и когда выкатываться
const RK=[];
function measure(){
  RK.length=0; geo(); place();
  const vw=innerWidth, vh=innerHeight, k=mob()?'m':'d', max=Math.max(0,lane.scrollHeight-vh);
  rows.forEach(rw=>{rw._c=rw.offsetTop+rw.offsetHeight/2;
    rw.querySelectorAll('.rack').forEach(r=>{const isL=r.classList.contains('l');
      r._fx=rw.offsetLeft+r.offsetLeft; r._top=rw.offsetTop+r.offsetTop;
      r._S=Math.max(0,Math.min(max,rw._c-vh/2)); // прокрутка, при которой ряд встал на место
      r._D=vh*(k==='m'?.62:.7)*(isL?1:.85); // путь выката в пикселях прокрутки: левая стартует чуть раньше правой
      r._vx=GEO.vx+(isL?-1:1)*vw*VANISH_SPREAD[k]; r._vy=GEO.hy; r._dirty=true; RK.push(r)})});
  // первый ряд начинает выкатываться ещё до конца интро: пока интро-каталки уходят за край, зал не пустой
  const ie=IR.length&&rows[0]?lane.querySelector('.intro').offsetHeight-vh-vh*.8:0;
  if(ie>0)rows[0].querySelectorAll('.rack').forEach(r=>{r._D=Math.max(r._D,r._S-ie)});
}
let wheelT=null, wheelRaf=0;
function toRow(i,instant){const rw=rows[Math.max(0,Math.min(rows.length-1,i))];if(!rw)return;wheelT=null;lane.scrollTo({top:rw.offsetTop+rw.offsetHeight/2-innerHeight/2,behavior:reduce||instant?'auto':'smooth'})}
// колесо и тачпад: крутишь вниз — содержимое едет вверх, идём дальше по залу; плавно, с инерцией
// клик-зум: вся лента (и фон) масштабируется вокруг выбранной каталки, ≈85% высоты экрана; выход — скролл, тап мимо, Esc
let ZF=null;
function zoomRack(r){
  const c=r.getBoundingClientRect(), vw=innerWidth, vh=innerHeight, k=Math.min(vh*.85/c.height,vw*.92/c.width);
  lane.style.transition=reduce?'none':'transform .6s cubic-bezier(.2,.7,.2,1)';
  lane.style.transform=`translate3d(${(vw/2-k*(c.left+c.width/2)).toFixed(1)}px,${(vh/2-k*(c.top+c.height/2)).toFixed(1)}px,0) scale(${k.toFixed(3)})`;
  ZF?.classList.remove('zf'); ZF=r; r.classList.add('zf'); document.body.classList.add('zoom');
}
function unzoom(){if(!ZF)return;ZF.classList.remove('zf');ZF=null;document.body.classList.remove('zoom');lane.style.transform=''}
lane.addEventListener('click',e=>{if(ZF&&!e.target.closest('.rack'))unzoom()});
addEventListener('touchmove',unzoom,{passive:true});
addEventListener('wheel',unzoom,{passive:true});
lane.addEventListener('wheel',e=>{if(e.ctrlKey)return;e.preventDefault();if(ZF){unzoom();return}
  const max=lane.scrollHeight-lane.clientHeight, d=e.deltaMode===1?e.deltaY*32:e.deltaY;
  wheelT=Math.max(0,Math.min(max,(wheelT??lane.scrollTop)+d));
  if(reduce){lane.scrollTop=wheelT;wheelT=null;return}
  if(!wheelRaf)wheelRaf=requestAnimationFrame(function step(){if(wheelT==null){wheelRaf=0;return}
    const cur=lane.scrollTop, nx=cur+(wheelT-cur)*.18; lane.scrollTop=Math.abs(wheelT-nx)<.5?wheelT:nx;
    if(lane.scrollTop===wheelT){wheelT=null;wheelRaf=0}else wheelRaf=requestAnimationFrame(step)})},{passive:false});
lane.addEventListener('touchstart',()=>{wheelT=null},{passive:true});
function curRow(){let best=0,bd=1e9;const mid=lane.scrollTop+innerHeight/2;rows.forEach((rw,i)=>{const d=Math.abs(rw._c-mid);if(d<bd){bd=d;best=i}});return best}

const desk=matchMedia('(min-width:761px)').matches;
const view={p:0};
function laneFrame(){
  // p — проход по залу после отъезда камеры (первый экран скролла — интро)
  const vh=innerHeight, s0=reduce?0:vh, max=Math.max(1,lane.scrollHeight-vh-s0), p=Math.min(1,Math.max(0,(lane.scrollTop-s0)/max));
  view.p=p; kick();
  const ci=curRow(); $('walk').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('on',i===ci));
  if(lane.scrollTop>vh*.04)$('hint').style.opacity=0;
}
let lfRaf=0;
const schedLane=()=>{if(!lfRaf)lfRaf=requestAnimationFrame(()=>{lfRaf=0;laneFrame()})};
lane.addEventListener('scroll',schedLane,{passive:true});
addEventListener('resize',()=>{measure();schedLane()});

// ---- Живой фон и качание вещей: один цикл кадров (rAF), только transform; спит, когда всё стоит ----
// фон резкий и идёт за скроллом: медленный наезд вперёд и сдвиг вверх (медленнее ленты), с инерцией, без ступенек; плюс лёгкий параллакс за курсором
const aim={x:0,y:0,gx:innerWidth/2,gy:innerHeight*.4}, cur={x:0,y:0,gx:innerWidth/2,gy:innerHeight*.4,p:0};
const BG_ZOOM=.32;
const SW=[]; // вещи на плечиках: маятник со своей частотой, затуханием и размахом
let fRaf=0, fLast=0, sTop=0, sv=0, svPrev=0, lagTop=0; // lagTop — сглаженная прокрутка: каталки «догоняют» ленту с запозданием
function kick(){if(!fRaf){fLast=0;sTop=lane.scrollTop;sv=svPrev=0;fRaf=requestAnimationFrame(frame)}}
function frame(ts){
  const dt=fLast?Math.min(.034,(ts-fLast)/1000):.016; fLast=ts;
  const k=reduce?1:1-Math.pow(.925,dt*60); let moving=false;
  for(const n of ['x','y','gx','gy']){cur[n]+=(aim[n]-cur[n])*k;if(Math.abs(aim[n]-cur[n])>.002)moving=true}
  cur.p+=(view.p-cur.p)*k*.8; if(Math.abs(view.p-cur.p)>.0002)moving=true;
  const st=lane.scrollTop;
  if(reduce)lagTop=st; else{lagTop+=(st-lagTop)*(1-Math.pow(.9,dt*60)); if(Math.abs(st-lagTop)<.3)lagTop=st; else moving=true}
  if(stepRacks(dt))moving=true;
  const mv=reduce?0:1; stepIntro();
  // фон масштабируется только вокруг точки схода (горизонт стоит на месте, каталки не съезжают с пола); параллакс — лёгкий, по горизонтали
  bgEl.style.transform=`translate3d(${(-cur.x*8*mv).toFixed(2)}px,0,0) scale(${(IN.B*(1+cur.p*BG_ZOOM*mv)).toFixed(4)})`;
  $('glow').style.transform=`translate(${cur.gx.toFixed(1)}px,${cur.gy.toFixed(1)}px)`;
  if(!reduce){
    // скорость ленты сглажена; её изменение подталкивает вещи, дальше они качаются сами и затухают
    const top=lane.scrollTop; sv+=((top-sTop)/dt-sv)*.3; sTop=top;
    const dv=sv-svPrev; svPrev=sv; if(Math.abs(sv)>2||Math.abs(dv)>.5)moving=true;
    for(const s of SW){if(!s.r._on)continue;
      s.w+=dv*.022*s.amp; s.w+=(-s.kk*s.th-s.cc*s.w)*dt; s.th=Math.max(-9,Math.min(9,s.th+s.w*dt));
      if(Math.abs(s.th)>.04||Math.abs(s.w)>.25){moving=true;if(!s.on){s.on=true;s.el.style.willChange='transform'}s.el.style.transform=`rotate(${s.th.toFixed(2)}deg)`}
      else if(s.on){s.on=false;s.th=s.w=0;s.el.style.transform='';s.el.style.willChange=''}}
  }
  fRaf=moving?requestAnimationFrame(frame):0;
}
// выкат каталок из глубины по скроллу: чистый масштаб вокруг точки схода (scale ∝ расстоянию от горизонта) —
// стойка едет по диагонали вниз к своему месту и растёт; глубина z линейна по сглаженному прогрессу, поэтому вдали медленно, вблизи быстрее, в конце мягко.
// Тень на полу едет вместе с плитой (вдали бледнее и мельче, вблизи плотнее); встала — вещи докачиваются по инерции
function stepRacks(dt){
  const st=lane.scrollTop, L=lagTop; let moving=false;
  for(const r of RK){
    if(!r._near&&!r._dirty&&!r._mv)continue; r._dirty=false;
    let sg=1, op=1, q=1, ty=0, tx=0;
    const e=reduce?1:Math.min(1,Math.max(0,1-(r._S-L)/r._D));
    if(!reduce){
      const g=e*e*(3-2*e); sg=1/(1/FAR+(1-1/FAR)*g); q=(sg-FAR)/(1-FAR);
      const o=Math.min(1,e/.33); op=o*o*(3-2*o);
      tx=(r._vx-r._fx)*(1-sg); ty=r._vy+(r._top-Math.max(L,r._S)-r._vy)*sg-(r._top-st);
    }
    const vs=(sg-(r._sg??sg))/dt; r._sg=sg; r._v=(r._v||0)+(vs-(r._v||0))*.3;
    const av=Math.abs(r._v), dir=(r._v>0?1:-1)*r._dd;
    if(av>(r._pk||0)){r._pk=av;r._dir=dir}
    if(av<.04&&r._pk>.25){ // встала: вещи по инерции уходят вперёд по ходу и возвращаются
      const g=Math.min(1,r._pk/1.1); r._sw.forEach(s=>{s.w+=-r._dir*s.amp*(8+Math.random()*6)*g}); r._pk=0; moving=true}
    else if(av<.04)r._pk=0;
    if(av>.04)moving=true;
    const rest=e>=1&&Math.abs(ty)<.2, vis=op>.01;
    if(rest){if(r._mv){r._mv=false;r._vis=undefined;r.style.transform=r.style.opacity=r.style.willChange=r.style.visibility=r.style.pointerEvents='';r._fl.style.opacity=r._ct.style.opacity=r._fg.style.opacity=''}}
    else{
      if(!r._mv){r._mv=true;r._vis=undefined}
      if(vis!==r._vis){r._vis=vis;r.style.willChange=vis?'transform,opacity':'';r.style.visibility=vis?'':'hidden'}
      r.style.transform=`translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${sg.toFixed(4)})`;
      r.style.opacity=op.toFixed(3);
      r.style.pointerEvents=op<.15?'none':'';
      r._fl.style.opacity=(.3+.7*q).toFixed(3); r._ct.style.opacity=(q*q).toFixed(3); r._fg.style.opacity=((1-q)*.4).toFixed(3)}
  }
  return moving;
}
function registerSway(r,el){
  const f=.55+Math.random()*.35, w0=Math.PI*2*f, z=.3+Math.random()*.15;
  const s={r,el,th:0,w:0,on:false,amp:.6+Math.random()*.8,kk:w0*w0,cc:2*z*w0};
  SW.push(s); r._sw.push(s);
}
// каталка ушла за экран — вещи встают ровно, слой освобождается
function swayStop(r){r._sw.forEach(s=>{s.th=s.w=0;if(s.on){s.on=false;s.el.style.transform='';s.el.style.willChange=''}})}
addEventListener('pointermove',e=>{aim.x=e.clientX/innerWidth*2-1;aim.y=e.clientY/innerHeight*2-1;aim.gx=e.clientX;aim.gy=e.clientY;kick()},{passive:true});
if(window.DeviceOrientationEvent&&!desk)addEventListener('deviceorientation',e=>{if(e.gamma==null)return;aim.x=Math.max(-1,Math.min(1,e.gamma/25));aim.y=Math.max(-1,Math.min(1,(e.beta-45)/25));kick()},{passive:true});

addEventListener('keydown',e=>{if(!$('jr').hidden||!$('shopv').hidden||$('drawer').classList.contains('on'))return;
  if(ZF&&/Arrow|Page/.test(e.key))unzoom();
  const st=lane.scrollTop, r0=rows[0]?rows[0]._c-innerHeight/2:lane.scrollHeight;
  if(!reduce&&st<r0-10&&/Arrow(Up|Down)|Page(Up|Down)/.test(e.key)){e.preventDefault();wheelT=null; // в интро: общий план → первый ряд
    const dn=/Down/.test(e.key);lane.scrollTo({top:dn?(st<innerHeight*.9?innerHeight:r0):(st>innerHeight*1.1?innerHeight:0),behavior:'smooth'});return}
  if(e.key==='ArrowDown'||e.key==='PageDown'){e.preventDefault();toRow(curRow()+1)}
  if(e.key==='ArrowUp'||e.key==='PageUp'){e.preventDefault();toRow(curRow()-1)}});
document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>setHall(b.dataset.h));

// ---- Путь вещи: скролл ведёт камеру — целиком, вращение 360° (если продавец снял видео), вырез, крой, ткань, длина, размер ----
let STEPS=[];
function stepsFor(it){
  const K=KIND[it.kind]||KIND.dress;
  // сразу после общего вида — «врезаемся» в ткань, потом вырез, крой, длина
  const mid=['fab','neck','cut','len'].map(k=>{const [s,x,y,ry]=K.path[k];return{key:k,label:K.lbl[k],s:k==='fab'?Math.max(s,4.6):s,x,y,ry,dx:0}});
  const spin=it.spin?[{key:'spin',label:'360°',s:1,x:.5,y:.5,ry:0,dx:0}]:[];
  const [fab,...rest]=mid;
  return [{key:'full',label:'Целиком',s:1,x:.5,y:.5,ry:-8,dx:.1},fab,...spin,...rest,{key:'buy',label:'Размер',s:1,x:.5,y:.5,ry:12,dx:-.13}];
}
const jr=$('jr'), cam=$('cam'), cap=$('cap'), jspin=$('jspin');
let J=null, jSize=null, frames=[];
function openJourney(it){
  J=it; jSize=null; STEPS=stepsFor(it);
  ensureAudio(); fabArmed=true; $('macro').style.opacity=0; prepFabric(it); setSound(soundOn);
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
addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('modal').hidden)$('modal').hidden=true;else if(!jr.hidden)closeJourney();else if($('drawer').classList.contains('on'))bag(false);else if(!$('shopv').hidden)closeShop();else unzoom()}});
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
  let camBase=1;
  if(J.spin){const si=STEPS.findIndex(st=>st.key==='spin'), d=t-si, vis=Math.max(0,Math.min(1,1.6-Math.abs(d)*2.2));
    jspin.style.opacity=vis; camBase=1-vis;
    if(vis>0&&frames.length){const k=Math.max(0,Math.min(1,(d+.7)/1.4)), im=frames[Math.round(k*(frames.length-1))];if(im.complete&&im.naturalWidth&&jspin.src!==im.src)jspin.src=im.src}}
  fabFrame(t,camBase);
  const ri=Math.round(t), dd=Math.abs(t-ri), op=Math.max(0,1-dd*2.4);
  const st=STEPS[ri];
  if(st.key==='full'){cap.innerHTML=`<span class="n">${esc(J.shop)} · ${esc(J.city)}</span><h3>${esc(J.name)}</h3><p>${J.color?`Цвет «${esc(J.color)}». `:''}Крути вниз — покажем ${J.spin?'вещь со всех сторон, ':''}вырез, крой, ткань и длину вблизи.</p>${J.chips.length?`<div class="chips">${J.chips.map(c=>`<span>${esc(c)}</span>`).join('')}</div>`:''}`}
  else if(st.key==='spin'){cap.innerHTML=`<span class="n">0${ri+1} · 360°</span><h3>Со всех сторон</h3><p>Крути — вещь поворачивается. Снято продавцом в магазине.</p>`}
  else if(st.key==='buy'){cap.innerHTML=''}
  else{const [hh,pp]=J.spec[st.key];cap.innerHTML=`<span class="n">0${ri+1} · ${st.key==='fab'?'Из чего сделано':st.label}</span><h3>${esc(hh)}</h3>${pp?`<p>${esc(pp)}</p>`:''}`}
  cap.style.opacity=st.key==='buy'?0:op; cap.style.visibility=st.key==='buy'?'hidden':''; cap.style.transform=(innerWidth>760?'translateY(-50%) ':'')+`translateY(${(1-op)*14}px)`;
  const fin=t>=STEPS.length-1.4; $('final').classList.toggle('off',!fin); $('steps').style.opacity=fin?0:1;
  $('cue').style.opacity=p<.03?1:0;
  $('steps').querySelectorAll('button').forEach((b,bi)=>b.classList.toggle('on',bi===ri));
}
jr.addEventListener('scroll',()=>{const max=Math.max(1,jr.scrollHeight-innerHeight);pT=Math.min(1,Math.max(0,jr.scrollTop/max));if(!jRaf)jRaf=requestAnimationFrame(jTick)},{passive:true});
addEventListener('resize',()=>{if(J)frameJ()});

// ---- Ткань вблизи: «врезаемся» в ткань — нити и ворсинки крупным планом; рисуется под цвет и тип ткани вещи ----
const FABRIC_KW=[[/атлас|ш[её]лк|сатин/,'satin'],[/кружев|гипюр/,'lace'],[/шерст|твид|кашемир|драп/,'wool'],[/л[её]н|хлоп/,'linen'],[/вискоз|шифон|креп|штапел/,'viscose'],[/трикот|вязан|джерси/,'knit']];
const FABRIC_BY_KIND={dress:'satin',lace:'lace',long:'viscose',jacket:'wool',kamis:'linen',skirt:'viscose'};
const specOf=it=>it.spec||(KIND[it.kind]&&KIND[it.kind].spec)||{};
function fabricOf(it){const t=(specOf(it).fab||[]).join(' ').toLowerCase();for(const [re,k] of FABRIC_KW)if(re.test(t))return k;return FABRIC_BY_KIND[it.kind]||'linen'}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const c255=v=>Math.max(0,Math.min(255,Math.round(v)));
const tone=(c,k,a=1)=>{const m=k>=1?c.map(v=>v+(255-v)*Math.min(1,k-1)):c.map(v=>v*k);return `rgba(${m.map(c255).join(',')},${a})`};
function thread(x,x0,y0,w,h,vert,c,R,spun){
  const j=.9+R()*.2, g=vert?x.createLinearGradient(x0,0,x0+w,0):x.createLinearGradient(0,y0,0,y0+h);
  g.addColorStop(0,tone(c,.5*j));g.addColorStop(.3,tone(c,.97*j));g.addColorStop(.5,tone(c,1.14));g.addColorStop(.7,tone(c,.93*j));g.addColorStop(1,tone(c,.48*j));
  x.fillStyle=g;x.beginPath();x.roundRect?x.roundRect(x0,y0,w,h,Math.min(w,h)*.42):x.rect(x0,y0,w,h);x.fill();
  // волокна вдоль нити: тонкие светлые и тёмные филаменты
  x.lineWidth=.7;const L=vert?h:w,T=vert?w:h;
  for(let k=1.5;k<T-1;k+=2.2){x.strokeStyle=R()<.5?tone(c,1.35,.16):tone(c,.55,.18);x.beginPath();
    if(vert){x.moveTo(x0+k,y0+1);x.lineTo(x0+k+(R()-.5)*1.5,y0+L-1)}else{x.moveTo(x0+1,y0+k);x.lineTo(x0+L-1,y0+k+(R()-.5)*1.5)}x.stroke()}
  if(spun){x.strokeStyle=tone(c,.5,.22);x.lineWidth=1;x.beginPath();
    if(vert)for(let yy=y0;yy<y0+h;yy+=5){x.moveTo(x0,yy);x.lineTo(x0+w,yy+w*.55)}else for(let xx=x0;xx<x0+w;xx+=5){x.moveTo(xx,y0);x.lineTo(xx+h*.55,y0+h)}x.stroke()}
}
function hairs(x,W,H,c,R,n,len,alpha){x.lineCap='round';
  for(let k=0;k<n;k++){const px=R()*W,py=R()*H,a=R()*Math.PI*2,l=len*(.3+R()),b=(R()-.5)*1.4;
    x.strokeStyle=tone(c,R()<.55?1.4:.55,alpha*(.35+R()*.65));x.lineWidth=.45+R()*1.1;x.beginPath();x.moveTo(px,py);
    x.quadraticCurveTo(px+Math.cos(a+b)*l*.6,py+Math.sin(a+b)*l*.6,px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}}
function weave(x,W,H,c,R,cell,gap,over,spun){
  x.fillStyle=tone(c,.42);x.fillRect(0,0,W,H);const n=Math.ceil(W/cell)+2;
  for(let j=-1;j<n;j++)thread(x,0,j*cell+gap/2+(R()-.5)*gap*.4,W,cell-gap,false,c,R,spun);
  for(let i=-1;i<n;i++){const x0=i*cell+gap/2+(R()-.5)*gap*.4;
    for(let j=-1;j<n;j++){if(!over(i,j))continue;const run=over(i,j+1)?cell:cell; x.fillStyle='rgba(0,0,0,.22)';x.fillRect(x0+1.5,j*cell-gap*.2,cell-gap,run+gap*.4);
      thread(x,x0,j*cell-gap*.4,cell-gap,run+gap*.8,true,c,R,spun)}}}
function drawFabric(cv,kind,c){
  const x=cv.getContext('2d'),W=cv.width,H=cv.height,R=mulberry(kind.length*977+c[0]*3+c[1]*7+c[2]);
  x.save();x.clearRect(0,0,W,H);
  if(kind==='satin'){weave(x,W,H,c,R,26,1,(i,j)=>((i*3-j)%5+5)%5!==0,false);hairs(x,W,H,c,R,500,14,.35);
    x.globalCompositeOperation='screen';const g=x.createLinearGradient(0,H*.15,W,H*.85);g.addColorStop(.25,'rgba(255,255,255,0)');g.addColorStop(.48,'rgba(255,250,240,.42)');g.addColorStop(.56,'rgba(255,250,240,.12)');g.addColorStop(.75,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,W,H)}
  else if(kind==='wool'){weave(x,W,H,c,R,26,2,(i,j)=>((i-j)%4+4)%4<2,true);hairs(x,W,H,c,R,5200,34,.6)}
  else if(kind==='viscose'){weave(x,W,H,c,R,24,1.5,(i,j)=>(i+j)%2===0,false);hairs(x,W,H,c,R,900,16,.35)}
  else if(kind==='knit'){x.fillStyle=tone(c,.3);x.fillRect(0,0,W,H);
    for(let yy=-40;yy<H+40;yy+=34)for(let xx=-30;xx<W+30;xx+=32){x.save();x.translate(xx+16,yy);x.rotate(-.5);thread(x,-7,0,14,40,true,c,R,true);x.restore();x.save();x.translate(xx+16,yy);x.rotate(.5);thread(x,-7,0,14,40,true,c,R,true);x.restore()}
    hairs(x,W,H,c,R,2600,22,.5)}
  else if(kind==='lace'){x.fillStyle=tone(c,.5);x.fillRect(0,0,W,H);
    // сетка тюля: нити с тенью, чтобы было видно объём
    x.shadowColor='rgba(0,0,0,.35)';x.shadowBlur=5;x.shadowOffsetY=2;x.strokeStyle=tone(c,1.08);x.lineWidth=4;x.beginPath();const s=54;
    for(let yy=0;yy<H+s;yy+=s*.86)for(let xx=(Math.round(yy/(s*.86))%2)*s/2;xx<W+s;xx+=s){x.moveTo(xx,yy);x.lineTo(xx+s/2,yy+s*.86);x.moveTo(xx,yy);x.lineTo(xx-s/2,yy+s*.86);x.moveTo(xx-s/2,yy);x.lineTo(xx+s/2,yy)}
    x.stroke();
    // узор: крупные цветы из плотного шнура
    for(let k=0;k<6;k++){const cx=(k%3+.2+R()*.6)*W/3,cy=(Math.floor(k/3)+.2+R()*.6)*H/2,rr=120+R()*60;x.save();x.translate(cx,cy);x.rotate(R()*Math.PI);
      for(let pp=0;pp<7;pp++){x.rotate(Math.PI*2/7);x.fillStyle=tone(c,1.02,.75);x.strokeStyle=tone(c,1.25);x.lineWidth=11;x.beginPath();x.ellipse(rr*.52,0,rr*.4,rr*.19,0,0,Math.PI*2);x.fill();x.stroke();
        x.lineWidth=2;x.strokeStyle=tone(c,.6,.5);for(let q=-2;q<=2;q++){x.beginPath();x.moveTo(rr*.2,q*rr*.05);x.lineTo(rr*.85,q*rr*.03);x.stroke()}}
      x.fillStyle=tone(c,1.2);x.beginPath();x.arc(0,0,rr*.17,0,Math.PI*2);x.fill();x.restore()}
    x.shadowColor='transparent';x.shadowBlur=0;x.shadowOffsetY=0;
    hairs(x,W,H,c,R,1200,14,.45)}
  else{weave(x,W,H,c,R,36,3,(i,j)=>(i+j)%2===0,true);hairs(x,W,H,c,R,2400,26,.5)}
  x.globalCompositeOperation='source-over';
  const v=x.createRadialGradient(W/2,H/2,W*.18,W/2,H/2,W*.72);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.5)');x.fillStyle=v;x.fillRect(0,0,W,H);x.restore();
}
// цвет ткани берём с фото вещи в той точке, куда «врезаемся»
function sampleColor(im,it,fx,fy){
  try{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d',{willReadFrequently:true});
    if('filter' in x&&it.f)x.filter=it.f;x.drawImage(im,0,0,64,64);const d=x.getImageData(0,0,64,64).data;
    const pick=(r0)=>{let r=0,g=0,b=0,n=0;const cx=Math.round(fx*63),cy=Math.round(fy*63);
      for(let yy=Math.max(0,cy-r0);yy<=Math.min(63,cy+r0);yy++)for(let xx=Math.max(0,cx-r0);xx<=Math.min(63,cx+r0);xx++){const i=(yy*64+xx)*4;if(d[i+3]>200){r+=d[i];g+=d[i+1];b+=d[i+2];n++}}
      return n>4?[r/n,g/n,b/n]:null};
    return pick(3)||pick(10)||pick(40)}catch(e){return null}}
function prepFabric(it){
  const cv=$('macro'), kind=fabricOf(it), K=KIND[it.kind]||KIND.dress, [,fx,fy]=K.path.fab;
  const fallback=it.hex?[1,3,5].map(i=>parseInt(it.hex.slice(i,i+2),16)):[150,118,108];
  const im=new Image(); if(!/^data:/.test(it.img))im.crossOrigin='anonymous';
  im.onload=()=>{if(J!==it)return;drawFabric(cv,kind,sampleColor(im,it,fx,fy)||fallback)};
  im.onerror=()=>{if(J===it)drawFabric(cv,kind,fallback)};
  im.src=it.img;
}
// звук: «вжух» при входе в ткань и короткий шорох нитей (синтез, без файлов)
const AC=window.AudioContext||window.webkitAudioContext; let actx=null, soundOn=true, fabArmed=true;
try{soundOn=localStorage.getItem('vitrina-sound')!=='off'}catch(e){}
function ensureAudio(){try{if(!actx&&AC)actx=new AC();if(actx&&actx.state==='suspended')actx.resume()}catch(e){}}
function whoosh(){
  if(!soundOn||!actx)return;const t0=actx.currentTime+.01,n=Math.floor(actx.sampleRate*1.2),buf=actx.createBuffer(1,n,actx.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const src=actx.createBufferSource();src.buffer=buf;const bp=actx.createBiquadFilter();bp.type='bandpass';bp.Q.value=1.1;
  bp.frequency.setValueAtTime(260,t0);bp.frequency.exponentialRampToValueAtTime(2800,t0+.5);bp.frequency.exponentialRampToValueAtTime(700,t0+1.1);
  const g=actx.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.5,t0+.32);g.gain.exponentialRampToValueAtTime(.0001,t0+1.1);
  src.connect(bp).connect(g).connect(actx.destination);src.start(t0);src.stop(t0+1.15);
  for(let k=0;k<6;k++){const s=actx.createBufferSource();s.buffer=buf;const hp=actx.createBiquadFilter();hp.type='highpass';hp.frequency.value=2400+Math.random()*2600;
    const gg=actx.createGain(),st=t0+.42+k*.08+Math.random()*.04;gg.gain.setValueAtTime(.0001,st);gg.gain.exponentialRampToValueAtTime(.14,st+.015);gg.gain.exponentialRampToValueAtTime(.0001,st+.11);
    s.connect(hp).connect(gg).connect(actx.destination);s.start(st,Math.random()*.6,.13)}
}
function setSound(on){soundOn=on;try{localStorage.setItem('vitrina-sound',on?'on':'off')}catch(e){}const b=$('jsnd');b.setAttribute('aria-pressed',on);b.classList.toggle('off',!on);if(on)ensureAudio()}
$('jsnd').onclick=()=>setSound(!soundOn);
// кадр ткани: подлетаем (растёт из точки на фото), «врезаемся», пролетаем насквозь и выходим к следующей детали
function fabFrame(t,camBase){
  const fi=STEPS.findIndex(s=>s.key==='fab'), mac=$('macro');
  if(fi<0){mac.style.opacity=0;cam.style.opacity=camBase;return 0}
  const d=t-fi, vis=Math.max(0,Math.min(1,1.35-Math.abs(d)*2.2)), sc=1.25*Math.pow(2.3,d);
  mac.style.opacity=vis.toFixed(3); mac.style.transform=`translate(-50%,-50%) scale(${sc.toFixed(4)}) rotate(${(d*7).toFixed(2)}deg)`;
  cam.style.opacity=(camBase*(1-vis)).toFixed(3);
  $('stage').classList.toggle('deep',vis>.35);
  if(d<-.75)fabArmed=true; if(fabArmed&&d>-.5&&d<.3){fabArmed=false;whoosh()}
  return vis;
}

// ---- Магазин: клик по табличке — вся витрина магазина сеткой; вещь открывается «путём», «+» кладёт в пакет ----
let svShop=null, svSort='hang';
function openShop(shop){unzoom();svShop=shop;svSort='hang';renderShop();$('shopv').hidden=false;$('shopv').scrollTop=0;$('svback').focus()}
function closeShop(){$('shopv').hidden=true;svShop=null}
$('svback').onclick=closeShop;
function renderShop(){
  const sh=svShop, items=sh.items.slice();
  if(svSort==='asc')items.sort((a,b)=>a.price-b.price); if(svSort==='desc')items.sort((a,b)=>b.price-a.price);
  const prices=sh.items.map(i=>i.price), lo=Math.min(...prices), hi=Math.max(...prices);
  $('svname').textContent=sh.name; $('svmeta').textContent=sh.city+(sh.note?' · '+sh.note:'')+(sh.demo?' · пример':'');
  const wa=(sh.whatsapp||'').replace(/\D/g,'');
  $('svinfo').innerHTML=`<span><b>${sh.items.length}</b> ${sh.items.length%10===1&&sh.items.length%100!==11?'вещь':sh.items.length%10>=2&&sh.items.length%10<=4&&(sh.items.length%100<10||sh.items.length%100>=20)?'вещи':'вещей'}</span><span>от <b>${RUB(lo)}</b>${hi>lo?` до <b>${RUB(hi)}</b>`:''}</span>${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">Написать в WhatsApp</a>`:''}
    <div class="sv-sort" role="group" aria-label="Порядок">${[['hang','Как висят'],['asc','Дешевле'],['desc','Дороже']].map(([k,v])=>`<button type="button" data-s="${k}" aria-pressed="${svSort===k}">${v}</button>`).join('')}</div>`;
  $('svinfo').querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{svSort=b.dataset.s;renderShop()});
  $('svgrid').innerHTML=items.map(it=>`<div class="card" role="button" tabindex="0" data-id="${it.id}" aria-label="${esc(it.name+(it.color?', '+it.color:''))}, ${RUB(it.price)}">
    <div class="ph" style="--f:${it.f}"><img src="${it.img}" alt="" loading="lazy" decoding="async">${it.spin?'<span class="b360">360°</span>':''}<button class="add" type="button" data-add="${it.id}" aria-label="В пакет">+</button></div>
    <div class="nm">${esc(it.name)}${it.color?`<span>${esc(it.color)}</span>`:''}</div><div class="pr">${RUB(it.price)}</div></div>`).join('');
  const byId=Object.fromEntries(sh.items.map(i=>[i.id,i]));
  $('svgrid').querySelectorAll('.card').forEach(c=>{const open=()=>openJourney(byId[c.dataset.id]);c.onclick=open;c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
  $('svgrid').querySelectorAll('[data-add]').forEach(b=>b.onclick=e=>{e.stopPropagation();take(byId[b.dataset.add],b.closest('.ph').querySelector('img'))});
}

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

setBadge(); setHall('women');
setTimeout(()=>{$('hint').style.opacity=0},6000);
