import { sb, photoUrl, TYPES } from './sb.js';

const app = document.getElementById('app'), who = document.getElementById('who');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RUB = n => Number(n).toLocaleString('ru-RU') + ' ₽';
const SIZES = ['40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60'];
const STATUS = { new: 'Новый', confirmed: 'Подтверждён', collecting: 'Курьер собирает', delivering: 'В пути', done: 'Доставлен', cancelled: 'Отменён' };
const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ы:'y',э:'e',ю:'yu',я:'ya' };
const slugify = s => s.toLowerCase().split('').map(c => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'shop';

let state = { user: null, isAdmin: false, shops: [], shopId: null, tab: 'goods' };

// ---------- Вход ----------
function renderLogin(mode = 'in', note = '') {
  who.textContent = '';
  app.innerHTML = `<section class="card" style="max-width:420px;margin:0 auto;width:100%">
    <h1>${mode === 'in' ? 'Вход для магазинов' : 'Регистрация продавца'}</h1>
    <p class="muted">${mode === 'in' ? 'Добавляйте вещи с телефона, и они сразу появятся в нише вашего магазина.' : 'После регистрации администратор Витрины привяжет вас к магазину.'}</p>
    ${note}
    <form id="lf" class="card" style="padding:0;border:0">
      <label class="fld"><span>Email</span><input id="em" type="email" required autocomplete="email"></label>
      <label class="fld"><span>Пароль</span><input id="pw" type="password" required minlength="8" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}"></label>
      <div id="lerr"></div>
      <button class="btn" type="submit" id="lgo">${mode === 'in' ? 'Войти' : 'Зарегистрироваться'}</button>
    </form>
    <button class="btn quiet" type="button" id="sw">${mode === 'in' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}</button>
  </section>`;
  document.getElementById('sw').onclick = () => renderLogin(mode === 'in' ? 'up' : 'in');
  document.getElementById('lf').onsubmit = async e => {
    e.preventDefault();
    const em = document.getElementById('em').value.trim(), pw = document.getElementById('pw').value, go = document.getElementById('lgo'), err = document.getElementById('lerr');
    go.disabled = true; err.innerHTML = '';
    const res = mode === 'in'
      ? await sb.auth.signInWithPassword({ email: em, password: pw })
      : await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: location.origin + '/kabinet.html' } });
    go.disabled = false;
    if (res.error) {
      const m = /not confirmed/i.test(res.error.message) ? 'Email ещё не подтверждён. Откройте письмо от Supabase и нажмите ссылку, или попросите администратора добавить вас в магазин.'
        : /invalid login/i.test(res.error.message) ? 'Неверный email или пароль.' : res.error.message;
      err.innerHTML = `<div class="msg err">${esc(m)}</div>`; return;
    }
    if (mode === 'up' && !res.data.session) {
      renderLogin('in', `<div class="msg ok">Готово. Подтвердите email по ссылке из письма (если откроется пустая страница, это нормально), затем войдите. Или сообщите администратору свой email, он подключит вас сразу.</div>`);
      return;
    }
    boot();
  };
}

// ---------- Загрузка профиля ----------
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderLogin();
  state.user = session.user;
  const [adm, mem] = await Promise.all([
    sb.from('admins').select('user_id').eq('user_id', state.user.id).maybeSingle(),
    sb.from('shop_members').select('shop_id,role').eq('user_id', state.user.id)
  ]);
  state.isAdmin = !!adm.data;
  const shopQ = sb.from('shops').select('id,slug,name,city,note,whatsapp,sort,active').order('sort');
  const { data: shops } = state.isAdmin ? await shopQ : await shopQ.in('id', (mem.data || []).map(m => m.shop_id).concat(['00000000-0000-0000-0000-000000000000']));
  state.shops = shops || [];
  if (!state.shops.find(s => s.id === state.shopId)) state.shopId = state.shops[0]?.id || null;
  who.innerHTML = `<span>${esc(state.user.email)}${state.isAdmin ? ' · админ' : ''}</span><button class="btn quiet" type="button" id="out" style="min-height:36px;padding:6px 10px">Выйти</button>`;
  document.getElementById('out').onclick = async () => { await sb.auth.signOut(); renderLogin(); };
  render();
}

function render() {
  if (!state.isAdmin && !state.shops.length) {
    app.innerHTML = `<section class="card"><h1>Почти готово</h1><p>Вы зарегистрированы как <b>${esc(state.user.email)}</b>. Сообщите этот email администратору Витрины: он привяжет вас к магазину, и здесь появятся ваши вещи.</p></section>`;
    return;
  }
  const shop = state.shops.find(s => s.id === state.shopId);
  const tabs = [['goods', 'Вещи'], ['orders', 'Заказы']].concat(state.isAdmin ? [['shops', 'Магазины']] : []);
  app.innerHTML = `
    ${state.shops.length > 1 || state.isAdmin ? `<label class="fld"><span>Магазин</span><select id="shopSel">${state.shops.map(s => `<option value="${s.id}" ${s.id === state.shopId ? 'selected' : ''}>${esc(s.name)} · ${esc(s.city)}${s.active ? '' : ' (скрыт)'}</option>`).join('')}${state.shops.length ? '' : '<option>Магазинов пока нет</option>'}</select></label>` : `<h1>${esc(shop.name)}</h1>`}
    <div class="tabs" role="group" aria-label="Разделы">${tabs.map(([k, v]) => `<button type="button" data-t="${k}" aria-pressed="${state.tab === k}">${v}</button>`).join('')}</div>
    <div id="pane"></div>`;
  const sel = document.getElementById('shopSel');
  if (sel) sel.onchange = () => { state.shopId = sel.value; render(); };
  app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { state.tab = b.dataset.t; render(); });
  const pane = document.getElementById('pane');
  if (state.tab === 'shops') return renderShops(pane);
  if (!shop) { pane.innerHTML = `<p class="muted">Сначала создайте магазин во вкладке «Магазины».</p>`; return; }
  if (state.tab === 'orders') return renderOrders(pane, shop);
  renderGoods(pane, shop);
}

// ---------- Вещи магазина ----------
async function renderGoods(pane, shop) {
  pane.innerHTML = `<button class="btn" type="button" id="addP">+ Добавить вещь</button><div id="form"></div><div class="list" id="plist"><p class="muted">Загружаю вещи…</p></div>`;
  document.getElementById('addP').onclick = () => productForm(document.getElementById('form'), shop);
  const { data, error } = await sb.from('products').select('id,type,name,price,color,sizes,is_new,active,product_photos(storage_path,sort)').eq('shop_id', shop.id).order('created_at', { ascending: false });
  const list = document.getElementById('plist');
  if (error) { list.innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return; }
  if (!data.length) { list.innerHTML = `<p class="muted">Вещей пока нет. Нажмите «Добавить вещь», сфотографируйте её на вешалке, и она появится в нише «${esc(shop.name)}».</p>`; return; }
  list.innerHTML = data.map(p => {
    const ph = (p.product_photos || []).sort((a, b) => a.sort - b.sort)[0];
    return `<div class="prod ${p.active ? '' : 'off'}">
      ${ph ? `<img class="th" src="${photoUrl(ph.storage_path)}" alt="" loading="lazy">` : `<span class="sw" style="background:${esc(p.color)}"></span>`}
      <div><b>${esc(p.name)}</b><div class="meta">${RUB(p.price)} · ${TYPES[p.type] || ''} · ${esc((p.sizes || []).join(', ') || 'размеры не указаны')}</div>
        <div class="row" style="margin-top:4px">${p.is_new ? '<span class="pill">новинка</span>' : ''}${p.active ? '' : '<span class="pill grey">снято с витрины</span>'}</div></div>
      <div class="row" style="flex-direction:column;align-items:stretch">
        <button class="btn quiet" type="button" data-new="${p.id}" data-v="${!p.is_new}">${p.is_new ? 'Не новинка' : 'Новинка'}</button>
        <button class="btn quiet" type="button" data-act="${p.id}" data-v="${!p.active}">${p.active ? 'Снять' : 'Вернуть'}</button>
      </div></div>`;
  }).join('');
  list.querySelectorAll('[data-new]').forEach(b => b.onclick = async () => { b.disabled = true; await sb.from('products').update({ is_new: b.dataset.v === 'true', updated_at: new Date().toISOString() }).eq('id', b.dataset.new); renderGoods(pane, shop); });
  list.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => { b.disabled = true; await sb.from('products').update({ active: b.dataset.v === 'true', updated_at: new Date().toISOString() }).eq('id', b.dataset.act); renderGoods(pane, shop); });
}

// Фото ужимаем на телефоне до 1400px, заодно берём средний цвет вещи для силуэта
async function prepPhoto(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, 1400 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(Math.round(c.width * .35), Math.round(c.height * .35), Math.max(1, Math.round(c.width * .3)), Math.max(1, Math.round(c.height * .3))).data;
  let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  const color = '#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('');
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', .85));
  return { blob, color, preview: c.toDataURL('image/jpeg', .6) };
}

function productForm(box, shop) {
  let photo = null;
  box.innerHTML = `<form class="card" id="pf">
    <h2>Новая вещь</h2>
    <label class="photo-drop" for="pfile" id="pdrop"><span>Сфотографировать или выбрать фото<br><small>вещь целиком, на светлом фоне</small></span></label>
    <input id="pfile" type="file" accept="image/*" capture="environment" hidden>
    <div class="grid2">
      <label class="fld"><span>Название</span><input id="pname" required maxlength="80" placeholder="Платье в пол, атлас"></label>
      <label class="fld"><span>Цена, ₽</span><input id="pprice" required type="number" min="1" step="1" inputmode="numeric"></label>
      <label class="fld"><span>Тип</span><select id="ptype">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="fld"><span>Цвет (для силуэта, если нет фото)</span><input id="pcolor" type="color" value="#7a1f2b"></label>
    </div>
    <fieldset class="fld" style="border:0;padding:0;margin:0"><legend style="margin-bottom:6px">Размеры в наличии</legend><div class="chips">${SIZES.map(s => `<label><input type="checkbox" value="${s}">${s}</label>`).join('')}</div></fieldset>
    <div class="chips"><label><input type="checkbox" id="pnew" checked>Новинка (подсветится в нише)</label></div>
    <div id="perr"></div>
    <div class="row"><button class="btn" type="submit" id="pgo">Повесить в нишу</button><button class="btn quiet" type="button" id="pcancel">Отмена</button></div>
  </form>`;
  document.getElementById('pcancel').onclick = () => box.innerHTML = '';
  document.getElementById('pfile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { photo = await prepPhoto(f); document.getElementById('pdrop').innerHTML = `<img src="${photo.preview}" alt="Фото вещи">`; document.getElementById('pcolor').value = photo.color; }
    catch { document.getElementById('perr').innerHTML = `<div class="msg err">Не удалось прочитать фото. Попробуйте другое.</div>`; }
  };
  document.getElementById('pf').onsubmit = async e => {
    e.preventDefault();
    const go = document.getElementById('pgo'), err = document.getElementById('perr'); go.disabled = true; go.textContent = 'Сохраняю…'; err.innerHTML = '';
    const sizes = [...box.querySelectorAll('.chips input[type=checkbox][value]')].filter(i => i.checked).map(i => i.value);
    const ins = await sb.from('products').insert({
      shop_id: shop.id, name: document.getElementById('pname').value.trim(), price: parseInt(document.getElementById('pprice').value, 10),
      type: document.getElementById('ptype').value, color: document.getElementById('pcolor').value, sizes, is_new: document.getElementById('pnew').checked
    }).select('id').single();
    if (ins.error) { err.innerHTML = `<div class="msg err">${esc(ins.error.message)}</div>`; go.disabled = false; go.textContent = 'Повесить в нишу'; return; }
    if (photo) {
      const path = `${shop.id}/${ins.data.id}-${Date.now()}.jpg`;
      const up = await sb.storage.from('product-photos').upload(path, photo.blob, { contentType: 'image/jpeg' });
      if (up.error) err.innerHTML = `<div class="msg err">Вещь сохранена без фото: ${esc(up.error.message)}</div>`;
      else await sb.from('product_photos').insert({ product_id: ins.data.id, storage_path: path, sort: 0 });
    }
    box.innerHTML = `<div class="msg ok">Вещь висит в нише. Можно добавить следующую.</div>`;
    renderGoods(document.getElementById('pane'), shop);
  };
}

// ---------- Заказы ----------
async function renderOrders(pane, shop) {
  pane.innerHTML = `<p class="muted">Загружаю заказы…</p>`;
  const [stops, items] = await Promise.all([
    sb.from('order_stops').select('order_id,seq,status,created_at').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(50),
    sb.from('order_items').select('order_id,name,price,size,qty').eq('shop_id', shop.id).limit(500)
  ]);
  let full = {};
  if (state.isAdmin) {
    const ids = (stops.data || []).map(s => s.order_id);
    if (ids.length) { const { data } = await sb.from('orders').select('id,customer_name,phone,address,comment,status,total').in('id', ids); (data || []).forEach(o => full[o.id] = o); }
  }
  if (stops.error) { pane.innerHTML = `<div class="msg err">${esc(stops.error.message)}</div>`; return; }
  if (!stops.data.length) { pane.innerHTML = `<section class="card"><p class="muted">Заказов с вещами «${esc(shop.name)}» пока нет. Когда покупатель оформит пакет, здесь появится, что подготовить к приезду курьера.</p></section>`; return; }
  const byOrder = {}; (items.data || []).forEach(i => (byOrder[i.order_id] = byOrder[i.order_id] || []).push(i));
  pane.innerHTML = `<section class="card">${stops.data.map(s => {
    const o = full[s.order_id];
    return `<div class="order"><div class="row" style="justify-content:space-between"><b class="num">№ ${s.order_id.slice(0, 8).toUpperCase()}</b><span class="muted num">${new Date(s.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
      <ul>${(byOrder[s.order_id] || []).map(i => `<li>${esc(i.name)}${i.size ? ', размер ' + esc(i.size) : ''} × ${i.qty} · <span class="num">${RUB(i.price * i.qty)}</span></li>`).join('')}</ul>
      ${o ? `<div class="muted">${esc(o.customer_name)} · <span style="user-select:all">${esc(o.phone)}</span> · ${esc(o.address)}${o.comment ? ' · ' + esc(o.comment) : ''} · итого <span class="num">${RUB(o.total)}</span></div>
        <label class="fld"><span>Статус заказа</span><select data-ost="${s.order_id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
      <div class="row"><span class="pill ${s.status === 'pending' ? 'grey' : ''}">${s.status === 'pending' ? 'ждёт сборки' : s.status === 'ready' ? 'готово к выдаче' : 'курьер забрал'}</span>
        ${s.status === 'pending' ? `<button class="btn quiet" type="button" data-ready="${s.order_id}">Собрали, готово к выдаче</button>` : ''}
        ${s.status === 'ready' ? `<button class="btn quiet" type="button" data-picked="${s.order_id}">Курьер забрал</button>` : ''}</div></div>`;
  }).join('')}</section>`;
  const upd = async (oid, patch) => { await sb.from('order_stops').update(patch).eq('order_id', oid).eq('shop_id', shop.id); renderOrders(pane, shop); };
  pane.querySelectorAll('[data-ready]').forEach(b => b.onclick = () => { b.disabled = true; upd(b.dataset.ready, { status: 'ready' }); });
  pane.querySelectorAll('[data-picked]').forEach(b => b.onclick = () => { b.disabled = true; upd(b.dataset.picked, { status: 'picked', picked_at: new Date().toISOString() }); });
  pane.querySelectorAll('[data-ost]').forEach(s => s.onchange = async () => { await sb.from('orders').update({ status: s.value }).eq('id', s.dataset.ost); });
}

// ---------- Магазины (админ) ----------
function renderShops(pane) {
  pane.innerHTML = `<form class="card" id="sf"><h2>Новый магазин</h2>
    <div class="grid2">
      <label class="fld"><span>Название</span><input id="sname" required maxlength="60" placeholder="Лейла"></label>
      <label class="fld"><span>Город</span><input id="scity" required maxlength="40" placeholder="Назрань"></label>
      <label class="fld"><span>Чем славится (подпись в нише)</span><input id="snote" maxlength="60" placeholder="вечерние платья"></label>
      <label class="fld"><span>WhatsApp для видеозвонка</span><input id="swa" type="tel" placeholder="+7 928 …"></label>
    </div>
    <div id="serr"></div><button class="btn" type="submit" id="sgo">Открыть нишу</button></form>
  <section class="card"><h2>Магазины</h2>${state.shops.length ? state.shops.map(s => `<div class="prod ${s.active ? '' : 'off'}" style="grid-template-columns:minmax(0,1fr) auto">
      <div><b>${esc(s.name)}</b><div class="meta">${esc(s.city)}${s.note ? ' · ' + esc(s.note) : ''}${s.whatsapp ? ' · ' + esc(s.whatsapp) : ''}</div>
        <form class="row" data-mem="${s.id}" style="margin-top:8px"><input type="email" required placeholder="email продавца" style="flex:1;min-width:160px;font:inherit;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg)"><button class="btn quiet" type="submit">Подключить продавца</button></form><div data-mmsg="${s.id}"></div></div>
      <button class="btn quiet" type="button" data-sact="${s.id}" data-v="${!s.active}">${s.active ? 'Скрыть' : 'Показать'}</button></div>`).join('') : '<p class="muted">Пока ни одного.</p>'}</section>`;
  document.getElementById('sf').onsubmit = async e => {
    e.preventDefault(); const go = document.getElementById('sgo'); go.disabled = true;
    const name = document.getElementById('sname').value.trim();
    const { error } = await sb.from('shops').insert({ name, slug: slugify(name) + '-' + Math.random().toString(36).slice(2, 5), city: document.getElementById('scity').value.trim(),
      note: document.getElementById('snote').value.trim() || null, whatsapp: document.getElementById('swa').value.trim() || null, sort: state.shops.length + 1 });
    go.disabled = false;
    if (error) { document.getElementById('serr').innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return; }
    boot();
  };
  pane.querySelectorAll('[data-sact]').forEach(b => b.onclick = async () => { b.disabled = true; await sb.from('shops').update({ active: b.dataset.v === 'true' }).eq('id', b.dataset.sact); boot(); });
  pane.querySelectorAll('[data-mem]').forEach(f => f.onsubmit = async e => {
    e.preventDefault(); const em = f.querySelector('input').value.trim(), msg = pane.querySelector(`[data-mmsg="${f.dataset.mem}"]`);
    const { error } = await sb.rpc('admin_add_member', { p_shop: f.dataset.mem, p_email: em, p_role: 'seller' });
    msg.innerHTML = error ? `<div class="msg err">${esc(error.message)}</div>` : `<div class="msg ok">${esc(em)} теперь продавец этого магазина.</div>`;
  });
}

sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') renderLogin(); });
boot();
