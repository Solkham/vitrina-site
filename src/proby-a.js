// Проба А: пререндер зала + точки-вещи. Позиции точек — в процентах кадра (x, y).
const HALLS = {
  women: {
    bg: '/proby/a-women.jpg', sub: 'Женский зал · проба А',
    items: [
      { x: 18, y: 58, img: '/proby/p1.jpg', name: 'Платье в пол, атлас', shop: 'Лейла · Назрань', price: 8900 },
      { x: 33, y: 55, img: '/proby/p2.jpg', name: 'Абайя с золотой вышивкой', shop: 'Амина · Назрань', price: 15400 },
      { x: 68, y: 55, img: '/proby/p3.jpg', name: 'Платье пудровое, кружево', shop: 'Амина · Назрань', price: 13200 },
      { x: 83, y: 58, img: '/proby/p4.jpg', name: 'Платье изумрудное, бархат', shop: 'Магас Мода · Магас', price: 12100 }
    ]
  },
  men: {
    bg: '/proby/a-men.jpg', sub: 'Мужской зал · проба А',
    items: [
      { x: 22, y: 56, img: '/proby/m1.jpg', name: 'Пиджак шерсть, тёмно-синий', shop: 'Барс · Назрань', price: 16900 },
      { x: 78, y: 56, img: '/proby/m2.jpg', name: 'Камис белый, хлопок', shop: 'Магас Men · Магас', price: 5900 }
    ]
  }
};
const RUB = n => n.toLocaleString('ru-RU') + ' ₽';
const $ = id => document.getElementById(id);
const bg = $('bg'), dots = $('dots'), card = $('card');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let hall = 'women';

function render() {
  const h = HALLS[hall];
  if (hall === 'men') document.documentElement.setAttribute('data-hall', 'men');
  else document.documentElement.removeAttribute('data-hall');
  bg.style.backgroundImage = `url(${h.bg})`;
  $('sub').textContent = h.sub;
  card.hidden = true;
  dots.innerHTML = '';
  h.items.forEach(it => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'dot';
    b.style.left = it.x + '%'; b.style.top = it.y + '%';
    b.setAttribute('aria-label', it.name);
    b.innerHTML = `<span>${it.name}</span>`;
    b.onclick = () => open(it);
    dots.appendChild(b);
  });
  document.querySelectorAll('.sw button').forEach(x => x.setAttribute('aria-pressed', x.dataset.h === hall));
}
function open(it) {
  card.innerHTML = `<img src="${it.img}" alt="${it.name}"><div class="b"><div class="m">${it.shop}</div><h3>${it.name}</h3><div class="p">${RUB(it.price)}</div>
    <div class="row"><button class="btn" type="button">В пакет</button><button class="btn q" type="button" id="cx">Закрыть</button></div></div>`;
  card.hidden = false;
  $('cx').onclick = () => card.hidden = true;
}
document.querySelectorAll('.sw button').forEach(b => b.onclick = () => { hall = b.dataset.h; render(); });

// Прокрутка = шаг вглубь: кадр приближается и чуть опускается, точки едут вместе с ним
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const t = max > 0 ? Math.min(1, scrollY / max) : 0;
  const s = 1 + t * 0.45, y = -t * 4;
  const tr = reduce ? 'none' : `scale(${s}) translateY(${y}%)`;
  bg.style.transform = tr; dots.style.transform = tr; dots.style.transformOrigin = '50% 55%';
  dots.style.position = 'absolute'; dots.style.inset = '-4%';
  $('hint').style.opacity = t > 0.05 ? 0 : 0.85;
}
addEventListener('scroll', onScroll, { passive: true });
render(); onScroll();
