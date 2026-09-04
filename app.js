/* ورقة حُب — order back-office. Single-page app, data in browser storage on this phone. */
'use strict';

// ---------- State & persistence ----------
const KEY = 'waraqat-hob-state';
const SCHEMA = 1;
let S = null; // state

const SEED = {
  menu: [
    { name: 'تشيزي شريمب', category: 'رولات', price: 22, pieces: 7 },
    { name: 'تيمبورا رول', category: 'رولات', price: 22, pieces: 7 },
    { name: 'كريزي ماكي', category: 'رولات', price: 22, pieces: 7 },
    { name: 'كاليفورنيا رول', category: 'رولات', price: 22, pieces: 7 },
    { name: 'شيتوس رول (دجاج)', category: 'رولات', price: 19, pieces: 7 },
    { name: 'فيلادلفيا سالمون مدخن رول', category: 'رولات', price: 25, pieces: 7 },
    { name: 'بوكس مشكل', category: 'بوكسات', price: 99, pieces: 30, isBundle: true },
    { name: 'كيكة السوشي', category: 'الكيك', price: 49, leadTimeDays: 1, variants: [{ name: 'صغير', price: 29 }, { name: 'وسط', price: 49 }, { name: 'كبير', price: 100 }] },
  ],
  addons: [
    { name: 'سبايسي مايو', price: 2 }, { name: 'سجنتشر صوص', price: 2 }, { name: 'صوص التيرياكي', price: 2 },
    { name: 'صوص ورقة حب', price: 2 }, { name: 'مخلل الزنجبيل', price: 2 }, { name: 'صويا صوص (مجاناً)', price: 0 },
  ],
  methods: [
    { name: 'توصيلي', kind: 'self_her' }, { name: 'زوجي الغالي وصّلها', kind: 'self_husband' },
    { name: 'مندوب', kind: 'driver' }, { name: 'بارسل', kind: 'courier' }, { name: 'استلام', kind: 'pickup' },
  ],
  messages: [
    { trigger: 'delivered', text: 'طلب آخر وصل بسلام. فخور بك… وبكل رول لفّيتيه.' },
    { trigger: 'delivered', text: 'خطوة أقرب لحلمك. شفتِ؟ صار أوضح من أمس.' },
    { trigger: 'delivered', text: 'اللي يشتري منك مرة، يرجع. لأن اللي تسويه فيه حب فعلاً.' },
    { trigger: 'delivered', text: 'تعبك اليوم ما راح هدر. كل طلب هو دليل إنك قدها.' },
    { trigger: 'delivered', text: 'مبروك، وصلت. خذي نفس، اشربي ماء، وتذكري إني أحبك.' },
    { trigger: 'milestone_orders', threshold: 1, text: 'الطلب الأول. هنا يبدأ كل شي. مبروك يا صاحبة ورقة حُب.' },
    { trigger: 'milestone_orders', threshold: 10, text: 'عشرة طلبات. عشر مرات اختارك أحد بدل غيرك. وهذي البداية فقط.' },
    { trigger: 'milestone_orders', threshold: 50, text: 'خمسين طلب. اللي كان فكرة في المطبخ صار اسم يوصّى عليه.' },
    { trigger: 'milestone_orders', threshold: 100, text: 'مئة طلب. مئة مرة صدّق أحد فيك… وأنا كنت الأول.' },
    { trigger: 'milestone_husband', threshold: 10, text: 'زوجك وصّل عشر طلبات. عاد يستاهل رول تشيزي شريمب على الأقل.' },
    { trigger: 'milestone_husband', threshold: 25, text: 'خمسة وعشرين توصيلة من زوجك. أرخص مندوب في الرياض… وأحبهم لك.' },
    { trigger: 'milestone_husband', threshold: 50, text: 'خمسين توصيلة. الشغل شغلك، لكن الطريق طريقنا سوا.' },
  ],
};

let _id = 0;
const uid = () => `${Date.now().toString(36)}${(_id++).toString(36)}`;
const nowISO = () => new Date().toISOString();

function freshState() {
  return {
    schema: SCHEMA, businessName: 'ورقة حُب', nextOrderNumber: 1,
    menu: SEED.menu.map((m, i) => ({ id: uid(), active: true, sort: i, pieces: null, leadTimeDays: 0, isBundle: false, variants: [], ...m })),
    addons: SEED.addons.map((a, i) => ({ id: uid(), active: true, sort: i, ...a })),
    methods: SEED.methods.map((m, i) => ({ id: uid(), active: true, sort: i, ...m })),
    messages: SEED.messages.map((m) => ({ id: uid(), active: true, threshold: null, ...m })),
    orders: [],
    settings: { onedrive: { clientId: '', connected: false, account: '', lastBackup: '' }, wizardOrder: 'items' },
  };
}

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { S = JSON.parse(raw); migrate(); return; } } catch (e) { console.error(e); }
  S = freshState(); persist(false);
}
function migrate() { if (!S.settings) S.settings = {}; if (!S.settings.onedrive) S.settings.onedrive = { clientId: '', connected: false, account: '', lastBackup: '' }; S.menu.forEach((m) => { if (!('photo' in m)) m.photo = ''; }); S.methods.forEach((m) => { if (!('photo' in m)) m.photo = ''; }); if (!S.settings.wizardOrder) S.settings.wizardOrder = 'items'; }
let backupTimer = null;
function persist(triggerBackup = true) {
  localStorage.setItem(KEY, JSON.stringify(S));
  if (triggerBackup && S.settings.onedrive.connected) { clearTimeout(backupTimer); backupTimer = setTimeout(() => OneDrive.backup().catch(() => {}), 4000); }
}

// ---------- Helpers ----------
const LATN = 'ar-u-ca-gregory-nu-latn';
const money = (n) => `${Number.isInteger(+n) ? +n : (+n).toFixed(2)} ريال`;
const pad3 = (n) => String(n).padStart(3, '0');
const dayISO = (d = new Date()) => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtTime = (iso) => new Date(iso).toLocaleTimeString(LATN, { hour: 'numeric', minute: '2-digit' });
const fmtDay = (iso) => new Date(iso).toLocaleDateString(LATN, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (iso) => new Date(iso).toLocaleDateString(LATN, { day: 'numeric', month: 'short' });
function relDay(iso) {
  const t = dayISO(), d = dayISO(iso), tm = dayISO(new Date(Date.now() + 864e5));
  if (d === t) return 'اليوم'; if (d === tm) return 'غداً'; if (d < t) return 'متأخر'; return fmtDay(iso);
}
const toLocalInput = (iso) => { const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = ['new', 'preparing', 'ready', 'delivered'];
const statusLabel = (s) => ({ new: 'جديد', preparing: 'قيد التحضير', ready: 'جاهز', delivered: 'تم التوصيل' }[s]);
const payLabel = (p) => ({ unpaid: 'غير مدفوع', partial: 'مدفوع جزئياً', paid: 'مدفوع' }[p]);
const payMethodLabel = (p) => ({ cash: 'كاش', transfer: 'تحويل', stcpay: 'STC Pay', other: 'أخرى' }[p] || '');
const methodById = (id) => S.methods.find((m) => m.id === id);
const orderById = (id) => S.orders.find((o) => o.id === id);
function totals(o) { const itemsTotal = o.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0); return { itemsTotal, total: Math.max(0, itemsTotal + (+o.deliveryCharge || 0) - (+o.discount || 0)) }; }
function waPhone(raw) { const d = raw.replace(/\D/g, ''); if (d.startsWith('05') && d.length === 10) return '966' + d.slice(1); if (d.startsWith('5') && d.length === 9) return '966' + d; if (d.startsWith('00966')) return d.slice(2); return d; }
function confirmationText(o) {
  const items = o.lines.filter((l) => l.kind === 'item').map((l) => `• ${l.itemName}${l.variantName ? ` (${l.variantName})` : ''} × ${l.qty}`);
  const addons = o.lines.filter((l) => l.kind === 'addon' && l.unitPrice > 0).map((l) => `• ${l.itemName} × ${l.qty}`);
  return [
    `${S.businessName} 🍣`, `تم تأكيد طلبك رقم #${pad3(o.number)}`, '', ...items, ...(addons.length ? ['إضافات:', ...addons] : []), '',
    o.deliveryCharge > 0 ? `التوصيل: ${money(o.deliveryCharge)}` : null, o.discount > 0 ? `الخصم: ${money(o.discount)}` : null, `الإجمالي: ${money(o.total)}`, '',
    `${o.fulfilment === 'pickup' ? 'الاستلام' : 'التوصيل'}: ${relDay(o.dueAt)} ${fmtTime(o.dueAt)}`, o.paymentStatus === 'paid' ? 'الدفع: تم ✅' : null, '', 'شكراً لاختيارك ورقة حُب ❤️',
  ].filter((x) => x !== null).join('\n');
}
function toast(msg, ms = 2200) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }


// ---------- Icons (inline SVG, stroke = currentColor) ----------
const I = {
  home: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" opacity=".9"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  roll: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M9.5 10.5a3 3 0 0 1 3 3"/>',
  bigbox: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  cake: '<path d="M4 20h16v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 16c2 1.5 4-1.5 6 0s4 1.5 6 0 2-1.5 4 0"/><path d="M12 8v4M12 8c-1.5-1.5 0-3 0-4 0 1 1.5 2.5 0 4z"/>',
  sauce: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 7c0-2 6-2 6 0"/>',
  bowl: '<path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M8 12V9a4 4 0 0 1 8 0v3"/>',
  her: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  husband: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 4l1.2 1.2L21.4 4a1.5 1.5 0 0 1 0 2.2L19 8.6l-2.4-2.4A1.5 1.5 0 0 1 19 4z" fill="currentColor"/>',
  driver: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-8h5l3 8M10 9V6h4"/>',
  courier: '<rect x="2" y="7" width="13" height="10" rx="1.5"/><path d="M15 10h4l3 3v4h-7z"/><circle cx="6" cy="18.5" r="1.8" fill="currentColor"/><circle cx="18" cy="18.5" r="1.8" fill="currentColor"/>',
  pickup: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
  transfer: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  other: '<circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/>',
  unpaid: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  partial: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
  paid: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4 4 0 0 1 1 8z"/>',
  wa: '<path d="M4 20l1.5-4A8 8 0 1 1 8.5 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a4 4 0 0 1-2-2l1-1-1-2z" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  pin: '<path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="M4 20h4l11-11-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};
const ico = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24">${I[n] || I.other}</svg>`;
const CAT_ICON = (cat) => /كيك/.test(cat) ? 'cake' : /بوكس/.test(cat) ? 'bigbox' : /صوص|إضاف/.test(cat) ? 'sauce' : 'roll';
const KIND_ICON = { self_her: 'her', self_husband: 'husband', driver: 'driver', courier: 'courier', pickup: 'pickup' };

// Photos: shrink to a small square JPEG so a full menu stays well under 1 MB.
function pickPhoto(cb) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; const img = new Image(); img.onload = () => {
    const S_ = 360, c = document.createElement('canvas'); c.width = c.height = S_; const x = c.getContext('2d');
    const r = Math.max(S_ / img.width, S_ / img.height), w = img.width * r, h = img.height * r; x.drawImage(img, (S_ - w) / 2, (S_ - h) / 2, w, h);
    cb(c.toDataURL('image/jpeg', 0.72)); URL.revokeObjectURL(img.src); }; img.src = URL.createObjectURL(f); };
  inp.click();
}
const initials = (n) => (n || '?').trim().charAt(0);
function recentCustomers(limit = 12) {
  const seen = new Map();
  S.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).forEach((o) => {
    const k = (o.customerPhone || '').replace(/\D/g, '') || o.customerName.trim(); if (!k || seen.has(k)) return;
    seen.set(k, { name: o.customerName, phone: o.customerPhone, address: o.address, mapsUrl: o.mapsUrl, deliveryMethodId: o.deliveryMethodId, fulfilment: o.fulfilment, count: 0 });
  });
  S.orders.forEach((o) => { const k = (o.customerPhone || '').replace(/\D/g, '') || o.customerName.trim(); if (seen.has(k)) seen.get(k).count++; });
  return [...seen.values()].filter((c) => c.name || c.phone).slice(0, limit);
}

// ---------- Router & chrome ----------
const $ = (sel, el = document) => el.querySelector(sel);
const app = $('#app'), hdr = $('#hdr'), tabsEl = $('#tabs'), overlay = $('#overlay');
const TABS = [['today', 'اليوم', 'home'], ['orders', 'الطلبات', 'list'], ['inventory', 'المخزون', 'box'], ['finance', 'المالية', 'chart'], ['settings', 'الإعدادات', 'gear']];
const go = (h) => { location.hash = h; };
const back = () => { if (history.length > 1) history.back(); else go('#/today'); };

function chrome(title, { backBtn = false, tab = null } = {}) {
  hdr.innerHTML = `${backBtn ? `<button class="back" id="backBtn" style="font-size:15px;font-weight:600">رجوع</button>` : '<span class="spacer"></span>'}<h1>${esc(title)}</h1><span class="spacer"></span>`;
  if (backBtn) $('#backBtn').onclick = back;
  tabsEl.style.display = tab ? 'flex' : 'none';
  if (tab) tabsEl.innerHTML = TABS.map(([k, l, g]) => `<a href="#/${k}" class="${tab === k ? 'on' : ''}">${ico(g)}${l}</a>`).join('');
  window.scrollTo(0, 0);
}

function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'today';
  const p = h.split('/');
  overlay.innerHTML = '';
  if (p[0] === 'today') return Screens.today();
  if (p[0] === 'orders') return Screens.orders();
  if (p[0] === 'order' && p[1] === 'new') return Screens.orderForm(null);
  if (p[0] === 'order' && p[2] === 'edit') return Screens.orderForm(p[1]);
  if (p[0] === 'order') return Screens.orderDetail(p[1]);
  if (p[0] === 'inventory') return Screens.placeholder('المخزون', 'يأتي في التحديث القادم: المكونات، التغليف، تنبيه النقص، وورقة التحضير اليومية.', 'inventory');
  if (p[0] === 'finance') return Screens.placeholder('المالية', 'يأتي في التحديث القادم: الإيراد، التكاليف، التوصيل، والربح لكل صنف.', 'finance');
  if (p[0] === 'settings' && p[1] === 'menu' && p[2]) return Screens.menuItem(p[2]);
  if (p[0] === 'settings' && p[1] === 'menu') return Screens.menu();
  if (p[0] === 'settings' && p[1] === 'addons') return Screens.addons();
  if (p[0] === 'settings' && p[1] === 'delivery') return Screens.delivery();
  if (p[0] === 'settings' && p[1] === 'messages') return Screens.messages();
  if (p[0] === 'settings' && p[1] === 'backup') return Screens.backup();
  if (p[0] === 'settings') return Screens.settings();
  return Screens.today();
}
window.addEventListener('hashchange', route);

// Sheets
function sheet(html, onMount) {
  overlay.innerHTML = `<div class="sheet-bg" id="sheetBg"><div class="sheet"><div class="grab"></div>${html}</div></div>`;
  $('#sheetBg').addEventListener('click', (e) => { if (e.target.id === 'sheetBg') closeSheet(); });
  onMount && onMount(overlay);
}
const closeSheet = () => { overlay.innerHTML = ''; };

const Screens = {};

// ---------- Shared pieces ----------
const emptyBlock = (t, b) => `<div class="empty"><h2>${t}</h2>${b ? `<div>${b}</div>` : ''}</div>`;
const nextStatus = (o) => { const i = STATUS.indexOf(o.status); return i < 3 ? STATUS[i + 1] : null; };
const nextLabel = (s) => ({ preparing: 'ابدئي التحضير', ready: 'جاهز للتوصيل', delivered: 'تم التوصيل ✓' }[s]);
const itemsSummary = (o) => o.lines.filter((l) => l.kind === 'item').map((l) => `${l.itemName}${l.variantName ? ' ' + l.variantName : ''}${l.qty > 1 ? ' ×' + l.qty : ''}`).join(' · ');
const methodIcon = (m) => m ? (m.photo ? `<img src="${m.photo}" alt="">` : ico(KIND_ICON[m.kind] || 'driver')) : ico('pickup');
const waHref = (o) => `https://wa.me/${waPhone(o.customerPhone)}?text=${encodeURIComponent(confirmationText(o))}`;

function orderCard(o, { showDay = false } = {}) {
  const m = methodById(o.deliveryMethodId);
  const late = o.status !== 'delivered' && new Date(o.dueAt) < Date.now();
  const nx = nextStatus(o);
  const unpaid = o.paymentStatus !== 'paid';
  return `<div class="ocard ${late ? 'late' : ''}" data-o="${o.id}">
    <a class="top" href="#/order/${o.id}" style="text-decoration:none;color:inherit">
      <span class="seal md">#${pad3(o.number)}</span>
      <div class="grow">
        <div class="row between"><span class="strong ellip grow" style="font-size:17px">${esc(o.customerName) || 'بدون اسم'}</span><span class="strong gold">${money(o.total)}</span></div>
        <div class="row between small"><span class="${late ? 'red' : 'muted'}">${ico('clock')} ${showDay ? relDay(o.dueAt) + ' ' : ''}${fmtTime(o.dueAt)}</span><span class="row" style="gap:6px">${unpaid ? `<span class="red">${o.paymentStatus === 'partial' ? 'جزئي' : 'غير مدفوع'}</span>` : ''}<span class="pill ${o.status}">${statusLabel(o.status)}</span></span></div>
      </div>
      <span class="ic" style="width:36px;height:36px;border-radius:50%;background:var(--raised);display:flex;align-items:center;justify-content:center;color:var(--gold);overflow:hidden;flex-shrink:0">${methodIcon(m)}</span>
    </a>
    <div class="items ellip">${esc(itemsSummary(o))}${o.address ? ` · ${esc(o.address)}` : ''}</div>
    ${nx ? `<div class="act"><button class="btn ${nx === 'delivered' ? '' : 'goldline'}" data-adv="${o.id}">${nextLabel(nx)}</button>${o.customerPhone ? `<a class="btn ghost wa" href="${waHref(o)}" title="واتساب">${ico('wa')}</a>` : ''}</div>` : ''}
  </div>`;
}
function bindCardActions(root) {
  root.querySelectorAll('[data-adv]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); advanceOrder(orderById(b.dataset.adv), () => route()); }));
}
function advanceOrder(o, after) {
  const nx = nextStatus(o); if (!nx) return;
  const m = methodById(o.deliveryMethodId); const kind = m ? m.kind : null;
  const isSelf = ['self_her', 'self_husband', 'pickup'].includes(kind) || o.fulfilment === 'pickup';
  const finish = (cost) => { setStatus(o, 'delivered', cost); closeSheet(); const msg = pickDeliveredMessage(kind); after(); if (msg) showLove(msg); };
  if (nx !== 'delivered') { setStatus(o, nx); after(); return; }
  if (isSelf) return finish(0);
  sheet(`<h2>كم دفعتِ للتوصيل؟</h2><p class="muted">${esc(m ? m.name : '')} · العميلة دفعت ${money(o.deliveryCharge)}. اكتبي ما دفعتيه أنتِ فعلاً.</p>
    <input class="in big" id="cost" type="number" inputmode="decimal" value="${o.deliveryCharge || ''}" placeholder="0"><div style="height:16px"></div><button class="btn" id="costOk">تأكيد التوصيل</button>`,
    () => { $('#cost').focus(); $('#costOk').onclick = () => finish(+$('#cost').value || 0); });
}
function pickDeliveredMessage(kind) {
  const total = S.orders.filter((o) => o.status === 'delivered').length;
  const ms = S.messages.filter((m) => m.active);
  const mo = ms.find((m) => m.trigger === 'milestone_orders' && +m.threshold === total); if (mo) return mo.text;
  if (kind === 'self_husband') { const hc = S.orders.filter((o) => o.status === 'delivered' && (methodById(o.deliveryMethodId) || {}).kind === 'self_husband').length; const hm = ms.find((m) => m.trigger === 'milestone_husband' && +m.threshold === hc); if (hm) return hm.text; }
  const ev = ms.filter((m) => m.trigger === 'delivered'); return ev.length ? ev[total % ev.length].text : null;
}
function logChange(o, change) { (o.log = o.log || []).unshift({ at: nowISO(), change }); o.updatedAt = nowISO(); }
function setStatus(o, s, cost) { o.status = s; if (s === 'delivered') { o.deliveredAt = nowISO(); o.deliveryCost = cost == null ? null : cost; } else o.deliveredAt = null; logChange(o, `الحالة: ${statusLabel(s)}`); persist(); }
function showLove(msg) { sheet(`<div class="love"><div class="heart">❤</div><p>${esc(msg)}</p><div class="small muted">— زوجك</div><div style="height:14px"></div><button class="btn goldline" id="loveOk">يلا نكمل</button></div>`, () => { $('#loveOk').onclick = closeSheet; }); }

// ---------- Today ----------
Screens.today = () => {
  chrome('اليوم', { tab: 'today' });
  const d = dayISO();
  const today = S.orders.filter((o) => dayISO(o.dueAt) === d);
  const openToday = today.filter((o) => o.status !== 'delivered').sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const doneToday = today.filter((o) => o.status === 'delivered');
  const lateOthers = S.orders.filter((o) => o.status !== 'delivered' && dayISO(o.dueAt) < d).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const upcoming = S.orders.filter((o) => o.status !== 'delivered' && dayISO(o.dueAt) > d).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 6);
  const unpaid = S.orders.filter((o) => o.paymentStatus !== 'paid'); const unpaidAmt = unpaid.reduce((s, o) => s + Math.max(0, o.total - o.paidAmount), 0);
  const revenue = doneToday.reduce((s, o) => s + o.total, 0);
  const od = S.settings.onedrive;
  app.innerHTML = `<div class="stack pad-sticky tabbed" style="gap:14px">
    <div class="small muted">${fmtDay(nowISO())}</div>
    ${od.connected && od.needsLogin ? `<div class="banner err">انتهت جلسة OneDrive. <a href="#/settings/backup">أعيدي تسجيل الدخول</a> ليستمر النسخ التلقائي.</div>` : ''}
    <div class="row"><div class="stat"><span class="num gold">${openToday.length}</span><span class="small muted">مفتوحة اليوم</span></div>
      <div class="stat"><span class="num gold">${doneToday.length}</span><span class="small muted">وصلت اليوم</span></div>
      <div class="stat"><span class="num ${unpaid.length ? 'red' : 'gold'}">${unpaid.length ? money(unpaidAmt) : '—'}</span><span class="small muted">غير مدفوع</span></div></div>
    ${lateOthers.length ? `<div class="section" style="padding-top:4px"><h2 class="red">متأخرة</h2><span class="muted">${lateOthers.length}</span></div>${lateOthers.map((o) => orderCard(o, { showDay: true })).join('')}` : ''}
    <div class="section" style="padding-top:4px"><h2>اليوم</h2><span class="muted">${openToday.length}</span></div>
    ${openToday.length ? openToday.map((o) => orderCard(o)).join('') : `<div class="empty" style="padding:20px"><div style="font-size:40px">🍣</div><div class="muted">لا يوجد طلبات مفتوحة لليوم.</div></div>`}
    ${upcoming.length ? `<div class="section"><h2>القادم</h2><span class="muted">${upcoming.length}</span></div>${upcoming.map((o) => orderCard(o, { showDay: true })).join('')}` : ''}
    ${doneToday.length ? `<div class="section"><h2>تم توصيلها اليوم</h2><span class="gold strong">${money(revenue)}</span></div>${doneToday.map((o) => `<a class="orow" href="#/order/${o.id}"><span class="seal sm">#${pad3(o.number)}</span><div class="grow"><div class="row between"><span class="strong">${esc(o.customerName) || 'بدون اسم'}</span><span class="gold">${money(o.total)}</span></div><div class="small muted ellip">${esc(itemsSummary(o))}</div></div></a>`).join('')}` : ''}
  </div>
  <div class="sticky above-tabs"><a class="btn" href="#/order/new" style="font-size:17px;padding:14px">${ico('plus')} طلب جديد</a></div>`;
  bindCardActions(app);
};

// ---------- Orders list ----------
const F = { quick: 'open', methodId: null, q: '' };
Screens.orders = () => {
  chrome('الطلبات', { tab: 'orders' });
  let list = S.orders.slice();
  if (F.quick === 'open') list = list.filter((o) => o.status !== 'delivered');
  if (F.quick === 'delivered') list = list.filter((o) => o.status === 'delivered');
  if (F.quick === 'unpaid') list = list.filter((o) => o.paymentStatus !== 'paid');
  if (F.methodId) list = list.filter((o) => o.deliveryMethodId === F.methodId);
  if (F.q) { const q = F.q.toLowerCase(); list = list.filter((o) => (o.customerName || '').toLowerCase().includes(q) || (o.customerPhone || '').includes(q) || String(o.number).includes(q)); }
  list.sort((a, b) => (a.status === 'delivered') - (b.status === 'delivered') || (F.quick === 'delivered' ? b.dueAt.localeCompare(a.dueAt) : a.dueAt.localeCompare(b.dueAt)));
  const quicks = [['open', 'مفتوحة'], ['unpaid', 'غير مدفوعة'], ['delivered', 'تم توصيلها'], ['all', 'الكل']];
  app.innerHTML = `<div class="stack pad-sticky tabbed">
    <input class="in" id="q" placeholder="بحث بالاسم أو الجوال أو الرقم" value="${esc(F.q)}">
    <div class="chips">${quicks.map(([k, l]) => `<button class="chip ${F.quick === k ? 'on' : ''} ${k === 'unpaid' ? 'red' : ''}" data-q="${k}">${l}</button>`).join('')}</div>
    <div class="cattabs">${S.methods.filter((m) => m.active).map((m) => `<button class="chip ${F.methodId === m.id ? 'on' : ''}" data-m="${m.id}">${esc(m.name)}</button>`).join('')}</div>
    <div class="stack">${list.length ? list.map((o) => orderCard(o, { showDay: true })).join('') : emptyBlock('لا يوجد طلبات هنا', 'جرّبي فلتر مختلف أو أنشئي طلباً جديداً.')}</div>
  </div>
  <div class="sticky above-tabs"><a class="btn" href="#/order/new" style="font-size:17px;padding:14px">${ico('plus')} طلب جديد</a></div>`;
  $('#q').oninput = (e) => { F.q = e.target.value; const v = e.target.value; Screens.orders(); const i = $('#q'); i.focus(); i.value = v; i.setSelectionRange(v.length, v.length); };
  app.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { F.quick = b.dataset.q; Screens.orders(); }));
  app.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { F.methodId = F.methodId === b.dataset.m ? null : b.dataset.m; Screens.orders(); }));
  bindCardActions(app);
};
Screens.placeholder = (t, b, tab) => { chrome(t, { tab }); app.innerHTML = emptyBlock(t, b); };

// ---------- Order wizard (kiosk-style) ----------
const WIZ = { key: null, D: null, step: 0, at: 0 };
const STEPS = [['items', 'الأصناف', 'اختاري من المنيو'], ['addons', 'الإضافات', 'صوصات وإضافات'], ['delivery', 'التوصيل', 'كيف ومتى'], ['customer', 'العميلة', 'لمن الطلب؟'], ['payment', 'الدفع', 'الحالة والطريقة'], ['review', 'الملخص', 'راجعي واحفظي']];
const lineKey = (l) => `${l.kind}:${l.itemId}:${l.variantName || ''}`;

Screens.orderForm = (editId) => {
  const existing = editId ? orderById(editId) : null;
  if (editId && !existing) { chrome('الطلب', { backBtn: true }); app.innerHTML = emptyBlock('الطلب غير موجود'); return; }
  const key = editId || 'new';
  if (WIZ.key !== key || Date.now() - WIZ.at > 30 * 60e3) {
    const due = new Date(); due.setHours(due.getHours() + 2, 0, 0, 0);
    WIZ.D = existing ? JSON.parse(JSON.stringify(existing)) : { customerName: '', customerPhone: '', fulfilment: 'delivery', deliveryMethodId: null, address: '', mapsUrl: '', dueAt: due.toISOString(), notes: '', deliveryCharge: 0, discount: 0, paymentStatus: 'unpaid', paymentMethod: null, paidAmount: 0, lines: [] };
    if (!existing) { const soy = S.addons.find((a) => a.active && a.price === 0); if (soy) WIZ.D.lines.push({ itemId: soy.id, itemName: soy.name, variantName: null, unitPrice: 0, qty: 1, kind: 'addon' }); }
    WIZ.key = key; WIZ.step = 0;
  }
  WIZ.at = Date.now();
  const D = WIZ.D;
  const qtyOf = (k) => (D.lines.find((l) => lineKey(l) === k) || {}).qty || 0;
  const setQty = (c, q) => { D.lines = D.lines.filter((l) => lineKey(l) !== c.key); if (q > 0) D.lines.push({ itemId: c.itemId, itemName: c.itemName, variantName: c.variantName, unitPrice: c.unitPrice, qty: q, kind: c.kind || 'item' }); };
  const itemCount = () => D.lines.filter((l) => l.kind === 'item').reduce((s, l) => s + l.qty, 0);

  const render = () => {
    const [sid, title, sub] = STEPS[WIZ.step];
    chrome(existing ? `تعديل #${pad3(existing.number)}` : 'طلب جديد', { backBtn: true });
    const { total } = totals(D);
    const canNext = sid === 'items' ? itemCount() > 0 : sid === 'delivery' ? !!D.deliveryMethodId : true;
    app.innerHTML = `<div class="pad-sticky">
      <div class="dots">${STEPS.map((s, i) => `<span class="${i < WIZ.step ? 'done' : i === WIZ.step ? 'on' : ''}" data-step="${i}"></span>`).join('')}</div>
      <div class="steptitle"><h2>${title}</h2><div class="muted">${sub}</div></div>
      <div id="stepBody"></div></div>
      <div class="sticky"><div class="row between" style="margin-bottom:8px"><span class="muted small" id="sumLine">${itemCount()} صنف${D.deliveryCharge ? ` · توصيل ${D.deliveryCharge}` : ''}</span><span class="num gold" id="sumTotal">${money(total)}</span></div>
        <div class="wizbar">${WIZ.step > 0 ? `<button class="btn ghost" id="prev">السابق</button>` : ''}<button class="btn" id="next" ${canNext ? '' : 'disabled'}>${sid === 'review' ? (existing ? 'حفظ التعديلات' : 'حفظ الطلب') : 'التالي'}</button></div></div>`;
    app.querySelectorAll('[data-step]').forEach((d) => (d.onclick = () => { if (+d.dataset.step <= WIZ.step || itemCount() > 0) { WIZ.step = +d.dataset.step; render(); } }));
    if ($('#prev')) $('#prev').onclick = () => { WIZ.step--; render(); };
    $('#next').onclick = () => { if (sid === 'review') return save(); WIZ.step++; render(); };
    STEP[sid]();
  };
  const refreshBar = () => { const { total } = totals(D); $('#sumLine').textContent = `${itemCount()} صنف${D.deliveryCharge ? ` · توصيل ${D.deliveryCharge}` : ''}${D.discount ? ` − ${D.discount}` : ''}`; $('#sumTotal').textContent = money(total); const sid = STEPS[WIZ.step][0]; $('#next').disabled = sid === 'items' ? itemCount() === 0 : sid === 'delivery' ? !D.deliveryMethodId : false; };

  const STEP = {};
  // 1 — items grid
  let cat = null;
  STEP.items = () => {
    const menu = S.menu.filter((m) => m.active); const cats = [...new Set(menu.map((m) => m.category))]; if (!cat || !cats.includes(cat)) cat = cats[0];
    const body = $('#stepBody');
    const draw = () => {
      body.innerHTML = `<div class="cattabs">${cats.map((c) => `<button class="chip ${cat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        <div class="grid">${menu.filter((m) => m.category === cat).map((m) => {
          const hasV = m.variants && m.variants.length; const q = hasV ? m.variants.reduce((s, v) => s + qtyOf(`item:${m.id}:${v.name}`), 0) : qtyOf(`item:${m.id}:`);
          const price = hasV ? `${Math.min(...m.variants.map((v) => v.price))}–${Math.max(...m.variants.map((v) => v.price))} ريال` : money(m.price);
          return `<div class="tile ${q ? 'on' : ''}" data-i="${m.id}"><div class="ph">${m.photo ? `<img src="${m.photo}" alt="">` : ico(CAT_ICON(m.category))}</div><div class="cap"><div class="n">${esc(m.name)}</div><div class="p">${price}${m.pieces ? ` · ${m.pieces} قطع` : ''}</div></div>${q ? `<span class="badge">${q}</span><button class="minus" data-minus="${m.id}">−</button>` : ''}</div>`; }).join('')}</div>`;
      body.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { cat = b.dataset.c; draw(); }));
      body.querySelectorAll('.tile').forEach((t) => (t.onclick = (e) => {
        if (e.target.dataset.minus) return;
        const m = menu.find((x) => x.id === t.dataset.i);
        if (m.variants && m.variants.length) return variantSheet(m);
        const c = { key: `item:${m.id}:`, itemId: m.id, itemName: m.name, variantName: null, unitPrice: m.price }; setQty(c, qtyOf(c.key) + 1); draw(); refreshBar();
      }));
      body.querySelectorAll('[data-minus]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const m = menu.find((x) => x.id === b.dataset.minus);
        if (m.variants && m.variants.length) return variantSheet(m);
        const c = { key: `item:${m.id}:`, itemId: m.id, itemName: m.name, variantName: null, unitPrice: m.price }; setQty(c, Math.max(0, qtyOf(c.key) - 1)); draw(); refreshBar(); }));
    };
    const variantSheet = (m) => sheet(`<h2>${esc(m.name)}</h2><div class="stack" id="vlist" style="margin-top:8px">${m.variants.map((v) => `<div class="row between"><div><div class="strong">${esc(v.name)}</div><div class="small muted">${money(v.price)}</div></div><div class="stepper" data-v="${esc(v.name)}"><button data-d="-1">−</button><b class="${qtyOf(`item:${m.id}:${v.name}`) ? 'has' : ''}">${qtyOf(`item:${m.id}:${v.name}`)}</b><button data-d="1">+</button></div></div>`).join('')}</div><div style="height:16px"></div><button class="btn" id="vOk">تم</button>`,
      () => { overlay.querySelectorAll('.stepper').forEach((st) => { const v = m.variants.find((x) => x.name === st.dataset.v); const c = { key: `item:${m.id}:${v.name}`, itemId: m.id, itemName: m.name, variantName: v.name, unitPrice: v.price };
        st.querySelectorAll('button').forEach((b) => (b.onclick = () => { const q = Math.max(0, qtyOf(c.key) + +b.dataset.d); setQty(c, q); const bb = st.querySelector('b'); bb.textContent = q; bb.className = q ? 'has' : ''; refreshBar(); })); });
        $('#vOk').onclick = () => { closeSheet(); draw(); }; });
    draw();
  };
  // 2 — addons as round tiles
  STEP.addons = () => {
    const body = $('#stepBody');
    const draw = () => {
      body.innerHTML = `<div class="rounds">${S.addons.filter((a) => a.active).map((a) => { const k = `addon:${a.id}:`; const q = qtyOf(k); return `<div class="round ${q ? 'on' : ''}" data-a="${a.id}"><div class="c">${ico('sauce')}</div><div class="n">${esc(a.name)}</div><div class="p">${a.price ? money(a.price) : 'مجاناً'}</div>${q ? `<span class="badge">${q}</span>` : ''}</div>`; }).join('')}</div>
        <div class="small muted center" style="margin-top:10px">اضغطي للإضافة · اضغطي مطولاً للإنقاص</div>`;
      body.querySelectorAll('.round').forEach((r) => { const a = S.addons.find((x) => x.id === r.dataset.a); const c = { key: `addon:${a.id}:`, itemId: a.id, itemName: a.name, variantName: null, unitPrice: a.price, kind: 'addon' };
        let timer, held = false;
        const start = () => { held = false; timer = setTimeout(() => { held = true; setQty(c, Math.max(0, qtyOf(c.key) - 1)); draw(); refreshBar(); }, 450); };
        const end = () => { clearTimeout(timer); };
        r.addEventListener('touchstart', start, { passive: true }); r.addEventListener('touchend', end); r.addEventListener('mousedown', start); r.addEventListener('mouseup', end);
        r.onclick = () => { if (held) return; setQty(c, qtyOf(c.key) + 1); draw(); refreshBar(); };
        r.oncontextmenu = (e) => e.preventDefault(); });
    };
    draw();
  };
  // 3 — delivery method, address, time
  STEP.delivery = () => {
    const body = $('#stepBody');
    const draw = () => {
      const pickup = D.fulfilment === 'pickup';
      body.innerHTML = `<div class="bigopts">${S.methods.filter((m) => m.active).map((m) => `<div class="bigopt ${D.deliveryMethodId === m.id ? 'on' : ''}" data-m="${m.id}"><div class="ic">${methodIcon(m)}</div><div class="n">${esc(m.name)}</div></div>`).join('')}</div>
        ${D.deliveryMethodId && !pickup ? `<div class="stack" style="margin-top:16px">
          <label class="f"><span>${ico('pin')} العنوان / الحي</span><input class="in" id="fAddr" value="${esc(D.address)}" placeholder="الحي، الشارع، وصف مختصر"></label>
          <label class="f"><span>رابط الموقع (اختياري)</span><input class="in" id="fMaps" type="url" value="${esc(D.mapsUrl)}" placeholder="Google Maps / Apple Maps"></label>
          <label class="f"><span>رسوم التوصيل على العميلة</span><input class="in big" id="fCharge" type="number" inputmode="decimal" value="${D.deliveryCharge || ''}" placeholder="0"><div class="hint">تُضاف إلى الإجمالي. تكلفتك الفعلية تُسأل عند التوصيل.</div></label></div>` : ''}
        ${D.deliveryMethodId ? `<div class="stack" style="margin-top:20px"><h3>${ico('clock')} ${pickup ? 'وقت الاستلام' : 'وقت التوصيل'}</h3>
          <div class="row between"><span class="strong">${fmtDay(D.dueAt)}</span><span class="num gold">${fmtTime(D.dueAt)}</span></div>
          <div class="chips timechips"><button class="chip" data-q="h1">بعد ساعة</button><button class="chip" data-q="t18">اليوم ٦م</button><button class="chip" data-q="t21">اليوم ٩م</button><button class="chip" data-q="tm18">غداً ٦م</button></div>
          <input class="in" id="fDue" type="datetime-local" value="${toLocalInput(D.dueAt)}" step="900"></div>` : ''}`;
      body.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { const m = methodById(b.dataset.m); D.deliveryMethodId = m.id; D.fulfilment = m.kind === 'pickup' ? 'pickup' : 'delivery'; draw(); refreshBar(); }));
      const bind = (id, k, num) => { const el = $(id); if (el) el.oninput = (e) => { D[k] = num ? +e.target.value || 0 : e.target.value; refreshBar(); }; };
      bind('#fAddr', 'address'); bind('#fMaps', 'mapsUrl'); bind('#fCharge', 'deliveryCharge', true);
      body.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { const t = new Date(), q = b.dataset.q; if (q === 'h1') t.setHours(t.getHours() + 1, 0, 0, 0); if (q === 't18') t.setHours(18, 0, 0, 0); if (q === 't21') t.setHours(21, 0, 0, 0); if (q === 'tm18') { t.setDate(t.getDate() + 1); t.setHours(18, 0, 0, 0); } D.dueAt = t.toISOString(); draw(); }));
      const due = $('#fDue'); if (due) due.onchange = (e) => { if (e.target.value) { D.dueAt = new Date(e.target.value).toISOString(); draw(); } };
      const maxLead = Math.max(0, ...D.lines.filter((l) => l.kind === 'item').map((l) => (S.menu.find((m) => m.id === l.itemId) || {}).leadTimeDays || 0));
      if (maxLead && (new Date(D.dueAt) - Date.now()) / 36e5 < maxLead * 20) body.insertAdjacentHTML('beforeend', `<div class="banner err" style="margin-top:12px">تنبيه: الكيك يحتاج ${maxLead} يوم تحضير على الأقل.</div>`);
    };
    draw();
  };
  // 4 — customer with recents
  STEP.customer = () => {
    const body = $('#stepBody'); const rec = recentCustomers();
    body.innerHTML = `${rec.length ? `<div class="small strong muted">عميلات سابقات — اضغطي للتعبئة</div><div class="recent">${rec.map((c, i) => `<div class="rc ${D.customerPhone && waPhone(D.customerPhone) === waPhone(c.phone || '') ? 'on' : ''}" data-r="${i}"><div class="av">${esc(initials(c.name))}</div><div class="n ellip">${esc(c.name) || esc(c.phone)}</div><div class="s">${c.count} طلب</div></div>`).join('')}</div>` : ''}
      <div class="stack"><label class="f"><span>اسم العميلة</span><input class="in big" id="fName" value="${esc(D.customerName)}" placeholder="مثال: نورة"></label>
      <label class="f"><span>الجوال</span><input class="in big" id="fPhone" type="tel" value="${esc(D.customerPhone)}" placeholder="05xxxxxxxx" style="direction:ltr;text-align:right"></label>
      <label class="f"><span>ملاحظات</span><textarea class="in" id="fNotes" placeholder="بدون وسابي، تسليم للحارس…">${esc(D.notes)}</textarea></label></div>`;
    body.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => { const c = rec[+b.dataset.r]; D.customerName = c.name; D.customerPhone = c.phone; if (!D.address && c.address) D.address = c.address; if (!D.mapsUrl && c.mapsUrl) D.mapsUrl = c.mapsUrl; if (!D.deliveryMethodId && c.deliveryMethodId) { D.deliveryMethodId = c.deliveryMethodId; D.fulfilment = c.fulfilment; } STEP.customer(); toast(`تم تعبئة بيانات ${c.name}`); }));
    $('#fName').oninput = (e) => (D.customerName = e.target.value); $('#fPhone').oninput = (e) => (D.customerPhone = e.target.value); $('#fNotes').oninput = (e) => (D.notes = e.target.value);
  };
  // 5 — payment
  STEP.payment = () => {
    const body = $('#stepBody');
    const draw = () => {
      const { total } = totals(D);
      body.innerHTML = `<div class="bigopts" style="grid-template-columns:1fr 1fr 1fr">${[['unpaid', 'غير مدفوع'], ['partial', 'جزئي'], ['paid', 'مدفوع']].map(([k, l]) => `<div class="bigopt ${k === 'unpaid' ? 'red' : ''} ${D.paymentStatus === k ? 'on' : ''}" data-p="${k}"><div class="ic">${ico(k)}</div><div class="n">${l}</div></div>`).join('')}</div>
        ${D.paymentStatus !== 'unpaid' ? `<h3 style="margin:18px 0 8px">طريقة الدفع</h3><div class="bigopts">${[['cash', 'كاش'], ['transfer', 'تحويل'], ['stcpay', 'STC Pay'], ['other', 'أخرى']].map(([k, l]) => `<div class="bigopt ${D.paymentMethod === k ? 'on' : ''}" data-pm="${k}"><div class="ic">${ico(k === 'stcpay' ? 'phone' : k)}</div><div class="n">${l}</div></div>`).join('')}</div>` : ''}
        ${D.paymentStatus === 'partial' ? `<label class="f" style="margin-top:16px"><span>المبلغ المدفوع</span><input class="in big" id="fPaid" type="number" inputmode="decimal" value="${D.paidAmount || ''}" placeholder="0"><div class="hint">الإجمالي ${money(total)}</div></label>` : ''}
        <label class="f" style="margin-top:16px"><span>خصم (اختياري)</span><input class="in" id="fDisc" type="number" inputmode="decimal" value="${D.discount || ''}" placeholder="0"></label>`;
      body.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { D.paymentStatus = b.dataset.p; if (D.paymentStatus !== 'unpaid' && !D.paymentMethod) D.paymentMethod = 'cash'; draw(); refreshBar(); }));
      body.querySelectorAll('[data-pm]').forEach((b) => (b.onclick = () => { D.paymentMethod = b.dataset.pm; draw(); }));
      const paid = $('#fPaid'); if (paid) paid.oninput = (e) => (D.paidAmount = +e.target.value || 0);
      $('#fDisc').oninput = (e) => { D.discount = +e.target.value || 0; refreshBar(); };
    };
    draw();
  };
  // 6 — review
  STEP.review = () => {
    const { itemsTotal, total } = totals(D); const m = methodById(D.deliveryMethodId);
    const items = D.lines.filter((l) => l.kind === 'item'), addons = D.lines.filter((l) => l.kind === 'addon');
    $('#stepBody').innerHTML = `<div class="receipt" style="margin-top:14px"><span class="seal md">#${pad3(existing ? existing.number : S.nextOrderNumber)}</span>
      <div style="padding-top:20px"><div class="strong" style="font-size:18px">${esc(D.customerName) || '<span class="muted">بدون اسم</span>'}</div><div class="small muted">${esc(D.customerPhone)}</div></div>
      <div class="divider"></div>
      ${items.map((l) => `<div class="line"><span>${esc(l.itemName)}${l.variantName ? ' — ' + esc(l.variantName) : ''} <span class="muted">× ${l.qty}</span></span><span>${money(l.unitPrice * l.qty)}</span></div>`).join('')}
      ${addons.map((l) => `<div class="line small muted"><span>+ ${esc(l.itemName)} × ${l.qty}</span><span>${l.unitPrice ? money(l.unitPrice * l.qty) : 'مجاناً'}</span></div>`).join('')}
      ${D.deliveryCharge ? `<div class="line muted"><span>التوصيل</span><span>${money(D.deliveryCharge)}</span></div>` : ''}
      ${D.discount ? `<div class="line muted"><span>الخصم</span><span>− ${money(D.discount)}</span></div>` : ''}
      <div class="line tot"><span class="strong">الإجمالي</span><span class="num gold">${money(total)}</span></div>
      <div class="divider"></div>
      <div class="line"><span class="muted">${D.fulfilment === 'pickup' ? 'الاستلام' : 'التوصيل'}</span><span>${m ? esc(m.name) : '—'}</span></div>
      <div class="line"><span class="muted">الوقت</span><span>${relDay(D.dueAt)} · ${fmtTime(D.dueAt)}</span></div>
      ${D.address ? `<div class="line"><span class="muted">العنوان</span><span class="ellip" style="max-width:60%">${esc(D.address)}</span></div>` : ''}
      <div class="line"><span class="muted">الدفع</span><span class="${D.paymentStatus === 'paid' ? 'ok' : 'red'}">${payLabel(D.paymentStatus)}${D.paymentMethod && D.paymentStatus !== 'unpaid' ? ' · ' + payMethodLabel(D.paymentMethod) : ''}</span></div>
      ${D.notes ? `<div class="small muted" style="margin-top:8px">${esc(D.notes)}</div>` : ''}
    </div>
    <div class="small muted center" style="margin-top:12px">اضغطي على أي نقطة في الأعلى للرجوع وتعديل خطوة.</div>`;
  };

  const save = () => {
    const { itemsTotal, total } = totals(D); const t = nowISO();
    const o = Object.assign(existing || { id: uid(), number: S.nextOrderNumber, status: 'new', createdAt: t, deliveredAt: null, deliveryCost: null, log: [] }, {
      customerName: D.customerName.trim(), customerPhone: D.customerPhone.trim(), fulfilment: D.fulfilment, deliveryMethodId: D.deliveryMethodId, address: D.address.trim(), mapsUrl: D.mapsUrl.trim(), dueAt: D.dueAt, notes: D.notes.trim(),
      lines: D.lines.filter((l) => l.qty > 0), deliveryCharge: +D.deliveryCharge || 0, discount: +D.discount || 0, itemsTotal, total, paymentStatus: D.paymentStatus,
      paymentMethod: D.paymentStatus === 'unpaid' ? null : D.paymentMethod, paidAmount: D.paymentStatus === 'paid' ? total : D.paymentStatus === 'unpaid' ? 0 : Math.min(total, +D.paidAmount || 0), updatedAt: t });
    if (!existing) { S.nextOrderNumber++; S.orders.push(o); o.log.unshift({ at: t, change: 'أُنشئ الطلب' }); } else o.log.unshift({ at: t, change: 'عُدّل الطلب' });
    WIZ.key = null; persist(); location.replace(`#/order/${o.id}`);
  };
  render();
};

// ---------- Order detail ----------
Screens.orderDetail = (id) => {
  const o = orderById(id);
  if (!o) { chrome('الطلب', { backBtn: true }); app.innerHTML = emptyBlock('الطلب غير موجود'); return; }
  chrome(`طلب #${pad3(o.number)}`, { backBtn: true });
  const m = methodById(o.deliveryMethodId); const methodName = m ? m.name : o.fulfilment === 'pickup' ? 'استلام' : '';
  const nx = nextStatus(o); const idx = STATUS.indexOf(o.status); const remaining = Math.max(0, o.total - o.paidAmount);
  const items = o.lines.filter((l) => l.kind === 'item'), addons = o.lines.filter((l) => l.kind === 'addon');
  const mapsHref = o.mapsUrl || (o.address ? `http://maps.apple.com/?q=${encodeURIComponent(o.address)}` : '');
  app.innerHTML = `<div class="stack" style="gap:20px">
    <div class="row" style="gap:16px"><span class="seal lg">#${pad3(o.number)}</span>
      <div class="grow"><h2 style="font-size:22px">${esc(o.customerName) || 'بدون اسم'}</h2>${o.customerPhone ? `<a class="muted" style="text-decoration:none" href="tel:${esc(o.customerPhone)}">${esc(o.customerPhone)}</a>` : ''}</div>
      <span style="width:48px;height:48px;border-radius:50%;background:var(--raised);display:flex;align-items:center;justify-content:center;color:var(--gold);overflow:hidden;font-size:22px">${methodIcon(m)}</span></div>
    <div class="card" style="padding:14px 10px 10px">
      <div class="stops">${STATUS.map((s, i) => `<div class="st ${i < idx ? 'done' : i === idx ? 'on' : ''}" data-s="${s}"><div class="d">${i < idx ? ico('check') : i + 1}</div><div class="l">${statusLabel(s)}</div></div>`).join('')}</div>
      ${nx ? `<button class="btn" id="advance" style="margin-top:10px;font-size:17px;padding:14px">${nextLabel(nx)}</button>` : `<div class="small muted center" style="margin-top:8px">وصل ${o.deliveredAt ? fmtDay(o.deliveredAt) + ' ' + fmtTime(o.deliveredAt) : ''}${o.deliveryCost ? ' · تكلفة التوصيل ' + money(o.deliveryCost) : ''}</div>`}
    </div>
    <div class="card stack" style="gap:6px">
      <div class="row between"><span class="strong">${ico('clock')} ${o.fulfilment === 'pickup' ? 'الاستلام' : 'التوصيل'} · ${esc(methodName)}</span><span class="gold strong">${relDay(o.dueAt)} ${fmtTime(o.dueAt)}</span></div>
      ${o.address ? `<a href="${esc(mapsHref)}" target="_blank" style="color:var(--text)">${ico('pin')} ${esc(o.address)}</a>` : o.mapsUrl ? `<a href="${esc(o.mapsUrl)}" target="_blank">${ico('pin')} فتح الموقع</a>` : ''}
    </div>
    <div class="receipt"><span class="seal sm" style="top:-12px">#${pad3(o.number)}</span><div style="height:6px"></div>
      ${items.map((l) => `<div class="line"><span>${esc(l.itemName)}${l.variantName ? ' — ' + esc(l.variantName) : ''} <span class="muted">× ${l.qty}</span></span><span class="muted">${money(l.unitPrice * l.qty)}</span></div>`).join('')}
      ${addons.map((l) => `<div class="line small muted"><span>+ ${esc(l.itemName)} × ${l.qty}</span><span>${l.unitPrice ? money(l.unitPrice * l.qty) : 'مجاناً'}</span></div>`).join('')}
      ${o.deliveryCharge ? `<div class="line muted"><span>التوصيل</span><span>${money(o.deliveryCharge)}</span></div>` : ''}
      ${o.discount ? `<div class="line muted"><span>الخصم</span><span>− ${money(o.discount)}</span></div>` : ''}
      <div class="line tot"><span class="strong">الإجمالي</span><span class="num gold">${money(o.total)}</span></div>
      ${o.notes ? `<div class="small muted" style="margin-top:6px">${esc(o.notes)}</div>` : ''}
    </div>
    <div class="card stack" style="gap:8px">
      <div class="row between"><span class="strong ${o.paymentStatus !== 'paid' ? 'red' : 'ok'}">${ico(o.paymentStatus)} ${payLabel(o.paymentStatus)}${o.paymentMethod ? ' · ' + payMethodLabel(o.paymentMethod) : ''}</span>${o.paymentStatus !== 'paid' ? `<span class="red">متبقي ${money(remaining)}</span>` : ''}</div>
      ${o.paymentStatus !== 'paid' ? `<div class="row"><button class="btn goldline sm" id="payFull">تم الدفع بالكامل</button><button class="btn ghost sm" id="payPart">دفعة جزئية</button></div>` : ''}
    </div>
    <div class="stack" style="gap:8px">
      ${o.customerPhone ? `<a class="btn goldline" href="${waHref(o)}">${ico('wa')} إرسال التأكيد عبر واتساب</a>` : ''}
      <div class="row"><a class="btn ghost grow" href="#/order/${o.id}/edit">${ico('edit')} تعديل</a><button class="btn danger grow" id="del">${ico('trash')} حذف</button></div>
    </div>
    <div><div class="small strong muted">السجل</div>${(o.log || []).map((l) => `<div class="log">${fmtShort(l.at)} ${fmtTime(l.at)} — ${esc(l.change)}</div>`).join('')}</div>
  </div>`;
  const again = () => Screens.orderDetail(id);
  if ($('#advance')) $('#advance').onclick = () => advanceOrder(o, again);
  app.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { const s = b.dataset.s; if (s === o.status) return; if (s === 'delivered' && STATUS.indexOf(s) > idx) return advanceOrder(Object.assign(o, { status: 'ready' }), again); setStatus(o, s); again(); }));
  const paySheet = (prefill) => sheet(`<h2>تسجيل دفعة</h2><div class="bigopts" id="pmChips" style="grid-template-columns:1fr 1fr 1fr 1fr;margin-top:8px">${['cash', 'transfer', 'stcpay', 'other'].map((k) => `<div class="bigopt ${(o.paymentMethod || 'cash') === k ? 'on' : ''}" data-pm="${k}" style="padding:12px 4px 8px"><div class="ic" style="width:40px;height:40px">${ico(k === 'stcpay' ? 'phone' : k)}</div><div class="n" style="font-size:12px">${payMethodLabel(k)}</div></div>`).join('')}</div>
    <div style="height:12px"></div><label class="f"><span>المبلغ</span><input class="in big" id="amt" type="number" inputmode="decimal" value="${prefill || ''}" placeholder="${remaining}"></label><div style="height:16px"></div><button class="btn" id="payOk">حفظ</button>`,
    () => { let pm = o.paymentMethod || 'cash'; overlay.querySelectorAll('[data-pm]').forEach((b) => (b.onclick = () => { pm = b.dataset.pm; overlay.querySelectorAll('[data-pm]').forEach((x) => x.classList.toggle('on', x === b)); }));
      $('#payOk').onclick = () => { const amt = Math.min(o.total, o.paidAmount + (+$('#amt').value || 0)); o.paidAmount = amt; o.paymentMethod = pm; o.paymentStatus = amt >= o.total ? 'paid' : amt > 0 ? 'partial' : 'unpaid'; logChange(o, `الدفع: ${payLabel(o.paymentStatus)}`); persist(); closeSheet(); again(); }; });
  if ($('#payFull')) $('#payFull').onclick = () => paySheet(remaining);
  if ($('#payPart')) $('#payPart').onclick = () => paySheet('');
  $('#del').onclick = () => { if (confirm(`حذف الطلب #${pad3(o.number)} نهائياً؟`)) { S.orders = S.orders.filter((x) => x.id !== o.id); persist(); go('#/orders'); } };
};

// ---------- Settings ----------
const switchBtn = (on, attrs = '') => `<button class="switch ${on ? 'on' : ''}" ${attrs}></button>`;
Screens.settings = () => {
  chrome('الإعدادات', { tab: 'settings' });
  const od = S.settings.onedrive;
  const items = [['menu', 'roll', 'المنيو والأسعار', 'الأصناف، الصور، الأحجام، الأسعار'], ['addons', 'sauce', 'الإضافات', 'الصوصات والإضافات وأسعارها'], ['delivery', 'driver', 'طرق التوصيل', 'توصيلي، مندوب، بارسل… مع الصور'], ['messages', 'msg', 'رسائل', 'رسائل تظهر بعد كل توصيلة'],
    ['backup', 'cloud', 'النسخ الاحتياطي', od.connected ? `OneDrive متصل${od.lastBackup ? ' · آخر نسخة ' + fmtShort(od.lastBackup) + ' ' + fmtTime(od.lastBackup) : ''}` : 'تصدير واسترجاع، وربط OneDrive']];
  app.innerHTML = items.map(([k, ic, t, b]) => `<a class="srow" href="#/settings/${k}"><span class="ic">${ico(ic)}</span><div class="grow"><div class="strong">${t}</div><div class="small muted">${b}</div></div><span class="muted">‹</span></a>`).join('') +
    `<div class="small faint" style="padding-top:24px">ورقة حُب · نسخة الويب 2 · البيانات محفوظة على هذا الجهاز فقط.</div>`;
};

Screens.menu = () => {
  chrome('المنيو والأسعار', { backBtn: true });
  const cats = [...new Set(S.menu.map((m) => m.category))];
  app.innerHTML = `<div class="pad-sticky">${cats.map((cat) => `<h3 style="margin-top:12px">${esc(cat)}</h3>${S.menu.filter((m) => m.category === cat).map((m) => `
    <div class="item"><a class="row grow" href="#/settings/menu/${m.id}" style="text-decoration:none;color:inherit"><span style="width:52px;height:52px;border-radius:12px;background:var(--raised);overflow:hidden;display:flex;align-items:center;justify-content:center;color:var(--gold-dim);flex-shrink:0">${m.photo ? `<img src="${m.photo}" style="width:100%;height:100%;object-fit:cover">` : ico(CAT_ICON(m.category))}</span>
      <div class="grow"><div class="strong ${m.active ? '' : 'muted'}">${esc(m.name)}</div><div class="small muted">${m.variants && m.variants.length ? m.variants.map((v) => `${esc(v.name)} ${v.price}`).join(' · ') : money(m.price)}${m.pieces ? ` · ${m.pieces} قطع` : ''}${m.leadTimeDays ? ` · قبل ${m.leadTimeDays} يوم` : ''}</div></div></a>${switchBtn(m.active, `data-t="${m.id}"`)}</div>`).join('')}`).join('')}</div>
    <div class="sticky"><a class="btn" href="#/settings/menu/new">${ico('plus')} صنف جديد</a></div>`;
  app.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { const m = S.menu.find((x) => x.id === b.dataset.t); m.active = !m.active; persist(); Screens.menu(); }));
};

Screens.menuItem = (id) => {
  const ex = id === 'new' ? null : S.menu.find((m) => m.id === id);
  if (id !== 'new' && !ex) { go('#/settings/menu'); return; }
  chrome(ex ? ex.name : 'صنف جديد', { backBtn: true });
  const cats = [...new Set(S.menu.map((m) => m.category))];
  const W = { name: ex ? ex.name : '', cat: ex ? ex.category : cats[0] || 'رولات', newCat: '', price: ex ? ex.price : '', pieces: ex && ex.pieces ? ex.pieces : '', lead: ex && ex.leadTimeDays ? ex.leadTimeDays : '', bundle: ex ? !!ex.isBundle : false, photo: ex ? ex.photo || '' : '', variants: ex ? ex.variants.map((v) => ({ ...v })) : [] };
  const render = () => {
    app.innerHTML = `<div class="stack" style="gap:16px">
      <div class="row" style="gap:16px"><div class="photo-pick" id="ph">${W.photo ? `<img src="${W.photo}">` : ico('camera')}</div><div class="grow"><div class="strong">صورة الصنف</div><div class="small muted">من الكاميرا أو الاستوديو. تظهر في شبكة الطلب.</div>${W.photo ? `<button class="btn ghost sm" id="phX" style="margin-top:6px">إزالة الصورة</button>` : ''}</div></div>
      <label class="f"><span>الاسم</span><input class="in big" id="mName" value="${esc(W.name)}" placeholder="مثال: دراغون رول"></label>
      <div><span class="small strong muted">الفئة</span><div class="chips" style="margin:6px 0" id="cats">${cats.map((c) => `<button class="chip ${!W.newCat && W.cat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div><input class="in" id="mNewCat" value="${esc(W.newCat)}" placeholder="أو فئة جديدة…"></div>
      ${W.variants.length ? '' : `<label class="f"><span>السعر</span><input class="in big" id="mPrice" type="number" inputmode="decimal" value="${W.price}" placeholder="22"></label>`}
      <div class="row"><label class="f grow"><span>عدد القطع</span><input class="in" id="mPieces" type="number" inputmode="numeric" value="${W.pieces}" placeholder="7"></label>
        <label class="f grow"><span>يحتاج تحضير (أيام)</span><input class="in" id="mLead" type="number" inputmode="numeric" value="${W.lead}" placeholder="0"></label></div>
      <div class="row between"><div><div>بوكس / عرض مجمّع</div><div class="small muted">يتكوّن من أصناف أخرى</div></div>${switchBtn(W.bundle, 'id="mBundle"')}</div>
      <div><div class="row between"><span class="small strong muted">الأحجام (اختياري)</span><button class="btn ghost sm" id="addV">+ حجم</button></div>
        <div class="stack" id="vars" style="margin-top:8px">${W.variants.map((v, i) => `<div class="row"><input class="in grow" data-vn="${i}" value="${esc(v.name)}" placeholder="وسط" style="flex:2"><input class="in" data-vp="${i}" type="number" inputmode="decimal" value="${v.price}" placeholder="49" style="flex:1"><button class="btn ghost sm" data-vx="${i}">×</button></div>`).join('')}</div></div>
      <button class="btn" id="mSave">حفظ</button>${ex ? `<button class="btn danger" id="mDel">حذف الصنف</button>` : ''}
    </div>`;
    const sync = () => { W.name = $('#mName').value; W.newCat = $('#mNewCat').value; if ($('#mPrice')) W.price = $('#mPrice').value; W.pieces = $('#mPieces').value; W.lead = $('#mLead').value; W.bundle = $('#mBundle').classList.contains('on'); app.querySelectorAll('[data-vn]').forEach((i) => (W.variants[+i.dataset.vn].name = i.value)); app.querySelectorAll('[data-vp]').forEach((i) => (W.variants[+i.dataset.vp].price = +i.value || 0)); };
    $('#ph').onclick = () => pickPhoto((d) => { sync(); W.photo = d; render(); });
    if ($('#phX')) $('#phX').onclick = () => { sync(); W.photo = ''; render(); };
    app.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { sync(); W.cat = b.dataset.c; W.newCat = ''; render(); }));
    $('#mBundle').onclick = (e) => e.target.classList.toggle('on');
    $('#addV').onclick = () => { sync(); W.variants.push({ name: '', price: 0 }); render(); };
    app.querySelectorAll('[data-vx]').forEach((b) => (b.onclick = () => { sync(); W.variants.splice(+b.dataset.vx, 1); render(); }));
    $('#mSave').onclick = () => {
      sync(); const name = W.name.trim(); if (!name) return toast('اكتبي اسم الصنف');
      const vs = W.variants.filter((v) => v.name.trim()).map((v) => ({ name: v.name.trim(), price: +v.price || 0 }));
      const data = { name, category: W.newCat.trim() || W.cat, price: vs.length ? vs[0].price : +W.price || 0, pieces: +W.pieces || null, leadTimeDays: +W.lead || 0, isBundle: W.bundle, variants: vs, photo: W.photo };
      if (ex) Object.assign(ex, data); else S.menu.push({ id: uid(), active: true, sort: S.menu.length, ...data });
      persist(); go('#/settings/menu');
    };
    if (ex) $('#mDel').onclick = () => { if (confirm('حذف الصنف؟ الطلبات القديمة تحتفظ باسمه وسعره.')) { S.menu = S.menu.filter((m) => m.id !== ex.id); persist(); go('#/settings/menu'); } };
  };
  render();
};
Screens.addons = () => {
  chrome('الإضافات', { backBtn: true });
  app.innerHTML = `<div class="stack">${S.addons.map((a) => `<div class="row between"><div><div>${esc(a.name)}</div><div class="small muted">${a.price ? money(a.price) : 'مجاناً'}</div></div><button class="btn ghost sm" data-x="${a.id}">حذف</button></div>`).join('')}
    <div class="divider"></div><span class="small strong muted">إضافة جديدة</span>
    <div class="row"><input class="in" id="aName" placeholder="الاسم" style="flex:2"><input class="in" id="aPrice" type="number" inputmode="decimal" placeholder="2" style="flex:1"></div><button class="btn" id="aAdd">إضافة</button></div>`;
  app.querySelectorAll('[data-x]').forEach((b) => (b.onclick = () => { if (confirm('حذف؟')) { S.addons = S.addons.filter((a) => a.id !== b.dataset.x); persist(); Screens.addons(); } }));
  $('#aAdd').onclick = () => { const n = $('#aName').value.trim(); if (!n) return; S.addons.push({ id: uid(), active: true, sort: S.addons.length, name: n, price: +$('#aPrice').value || 0 }); persist(); Screens.addons(); };
};


const KINDS = [['driver', 'مندوب'], ['courier', 'شركة توصيل'], ['self_her', 'توصيل ذاتي'], ['pickup', 'استلام']];
Screens.delivery = () => {
  chrome('طرق التوصيل', { backBtn: true });
  let kind = 'courier';
  app.innerHTML = `<div class="stack"><div class="small muted">التكلفة الفعلية لكل توصيلة تُسأل عند الضغط على "تم التوصيل". اضغطي على الدائرة لإضافة صورة — صورة زوجك مثلاً.</div>
    ${S.methods.map((m) => `<div class="row between"><div class="row grow"><span class="photo-pick" data-ph="${m.id}" style="width:56px;height:56px;border-radius:50%;border-style:solid">${m.photo ? `<img src="${m.photo}">` : ico(KIND_ICON[m.kind] || 'driver')}</span><div><div class="${m.active ? '' : 'muted'}">${esc(m.name)}</div><div class="small muted">${(KINDS.find((k) => k[0] === m.kind) || [])[1] || (m.kind === 'self_husband' ? 'توصيل ذاتي (الزوج)' : m.kind)}</div></div></div>${switchBtn(m.active, `data-t="${m.id}"`)}</div>`).join('')}
    <div class="divider"></div><span class="small strong muted">طريقة جديدة</span><input class="in" id="dName" placeholder="مثال: مرسول">
    <div class="chips" id="kinds">${KINDS.map(([k, l]) => `<button class="chip ${kind === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div><button class="btn" id="dAdd">إضافة</button></div>`;
  app.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { const m = methodById(b.dataset.t); m.active = !m.active; persist(); Screens.delivery(); }));
  app.querySelectorAll('[data-ph]').forEach((p) => (p.onclick = () => { const m = methodById(p.dataset.ph); if (m.photo && confirm('إزالة الصورة؟ (إلغاء = اختيار صورة جديدة)')) { m.photo = ''; persist(); Screens.delivery(); return; } pickPhoto((d) => { m.photo = d; persist(); Screens.delivery(); }); }));
  app.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { kind = b.dataset.k; app.querySelectorAll('[data-k]').forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#dAdd').onclick = () => { const n = $('#dName').value.trim(); if (!n) return; S.methods.push({ id: uid(), active: true, sort: S.methods.length, name: n, kind, photo: '' }); persist(); Screens.delivery(); };
};
const TRIGGERS = [['delivered', 'بعد كل توصيلة'], ['milestone_orders', 'عند رقم معيّن من الطلبات'], ['milestone_husband', 'عند رقم من توصيلات الزوج']];
Screens.messages = () => {
  chrome('رسائل', { backBtn: true });
  let trig = 'delivered';
  app.innerHTML = `<div class="stack" style="gap:16px">${TRIGGERS.map(([t, l]) => `<div><h3>${l}</h3>${S.messages.filter((m) => m.trigger === t).map((m) => `<div class="row between" style="align-items:flex-start;padding:6px 0"><div class="grow">${m.threshold != null ? `<div class="small muted">عند #${m.threshold}</div>` : ''}<div>${esc(m.text)}</div></div><button class="btn ghost sm" data-x="${m.id}">حذف</button></div>`).join('')}</div>`).join('')}
    <div class="divider"></div><span class="small strong muted">رسالة جديدة</span>
    <div class="chips" id="trigs">${TRIGGERS.map(([t, l]) => `<button class="chip ${trig === t ? 'on' : ''}" data-tr="${t}">${l}</button>`).join('')}</div>
    <label class="f" id="thWrap" style="display:none"><span>عند الرقم</span><input class="in" id="msgTh" type="number" inputmode="numeric" placeholder="10"></label>
    <textarea class="in" id="msgText" placeholder="اكتب الرسالة…"></textarea><button class="btn" id="msgAdd">حفظ الرسالة</button></div>`;
  app.querySelectorAll('[data-x]').forEach((b) => (b.onclick = () => { if (confirm('حذف الرسالة؟')) { S.messages = S.messages.filter((m) => m.id !== b.dataset.x); persist(); Screens.messages(); } }));
  app.querySelectorAll('[data-tr]').forEach((b) => (b.onclick = () => { trig = b.dataset.tr; app.querySelectorAll('[data-tr]').forEach((x) => x.classList.toggle('on', x === b)); $('#thWrap').style.display = trig === 'delivered' ? 'none' : ''; }));
  $('#msgAdd').onclick = () => { const t = $('#msgText').value.trim(); const th = +$('#msgTh').value || null; if (!t || (trig !== 'delivered' && !th)) return toast('اكتبي الرسالة والرقم'); S.messages.push({ id: uid(), active: true, trigger: trig, threshold: trig === 'delivered' ? null : th, text: t }); persist(); Screens.messages(); };
};

// ---------- Backup: export / import / OneDrive ----------
const exportJSON = () => JSON.stringify({ app: 'waraqat-hob', exportedAt: nowISO(), state: S }, null, 1);
const backupName = () => `waraqat-hob-${dayISO()}.json`;
async function exportFile() {
  const blob = new Blob([exportJSON()], { type: 'application/json' });
  const file = new File([blob], backupName(), { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'نسخة ورقة حُب' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = backupName(); document.body.appendChild(a); a.click(); a.remove();
}
function importFromText(text) {
  const j = JSON.parse(text); const st = j.state || j;
  if (!st || !Array.isArray(st.orders) || !Array.isArray(st.menu)) throw new Error('bad file');
  S = st; migrate(); persist(false);
}

const OneDrive = {
  AUTH: 'https://login.microsoftonline.com/common/oauth2/v2.0',
  SCOPE: 'openid profile offline_access User.Read Files.ReadWrite.AppFolder',
  redirect: () => location.origin + location.pathname,
  cfg: () => S.settings.onedrive,
  tok: { get: () => { try { return JSON.parse(localStorage.getItem('wh-od-token') || 'null'); } catch { return null; } }, set: (t) => localStorage.setItem('wh-od-token', JSON.stringify(t)), clear: () => localStorage.removeItem('wh-od-token') },
  async pkce() {
    const rnd = crypto.getRandomValues(new Uint8Array(48)); const verifier = btoa(String.fromCharCode(...rnd)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]));
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]));
    localStorage.setItem('wh-od-verifier', verifier); return challenge;
  },
  async login(silent = false) {
    const c = this.cfg(); if (!c.clientId) throw new Error('no client id');
    const challenge = await this.pkce();
    const p = new URLSearchParams({ client_id: c.clientId, response_type: 'code', redirect_uri: this.redirect(), scope: this.SCOPE, code_challenge: challenge, code_challenge_method: 'S256', response_mode: 'query' });
    if (silent) p.set('prompt', 'none'); else p.set('prompt', 'select_account');
    location.href = `${this.AUTH}/authorize?${p}`;
  },
  async handleRedirect() {
    const q = new URLSearchParams(location.search); if (!q.has('code') && !q.has('error')) return false;
    const clean = () => history.replaceState(null, '', this.redirect() + '#/settings/backup');
    if (q.has('error')) { this.cfg().needsLogin = true; persist(false); clean(); return true; }
    try {
      const body = new URLSearchParams({ client_id: this.cfg().clientId, grant_type: 'authorization_code', code: q.get('code'), redirect_uri: this.redirect(), code_verifier: localStorage.getItem('wh-od-verifier') || '', scope: this.SCOPE });
      const r = await fetch(`${this.AUTH}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); const t = await r.json();
      if (!t.access_token) throw new Error(t.error_description || 'token');
      this.tok.set({ access: t.access_token, refresh: t.refresh_token, exp: Date.now() + (t.expires_in - 60) * 1000 });
      const me = await (await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
      Object.assign(this.cfg(), { connected: true, needsLogin: false, account: me.userPrincipalName || me.displayName || '' }); persist(false);
      await this.backup();
    } catch (e) { console.error(e); toast('تعذّر ربط OneDrive: ' + e.message, 4000); }
    clean(); return true;
  },
  async token() {
    let t = this.tok.get(); if (!t) throw new Error('not connected');
    if (Date.now() < t.exp) return t.access;
    const body = new URLSearchParams({ client_id: this.cfg().clientId, grant_type: 'refresh_token', refresh_token: t.refresh, scope: this.SCOPE });
    const r = await fetch(`${this.AUTH}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); const j = await r.json();
    if (!j.access_token) { this.cfg().needsLogin = true; persist(false); throw new Error('refresh failed'); }
    this.tok.set({ access: j.access_token, refresh: j.refresh_token || t.refresh, exp: Date.now() + (j.expires_in - 60) * 1000 }); return j.access_token;
  },
  async put(name, body, token) {
    const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodeURIComponent(name)}:/content`, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body });
    if (!r.ok) throw new Error('upload ' + r.status);
  },
  async backup() {
    const c = this.cfg(); if (!c.connected) return;
    const token = await this.token(); const data = exportJSON();
    await this.put('waraqat-hob-latest.json', data, token); await this.put(backupName(), data, token);
    c.lastBackup = nowISO(); c.needsLogin = false; persist(false);
    if (location.hash === '#/settings/backup') Screens.backup();
  },
  disconnect() { this.tok.clear(); Object.assign(this.cfg(), { connected: false, account: '', needsLogin: false }); persist(false); },
};

Screens.backup = () => {
  chrome('النسخ الاحتياطي', { backBtn: true });
  const c = S.settings.onedrive;
  app.innerHTML = `<div class="stack" style="gap:20px">
    <div class="card stack" style="gap:8px"><h2>نسخة يدوية</h2><div class="small muted">ملف واحد فيه كل شيء: الطلبات، المنيو، الأسعار، الإعدادات. احفظيه في iCloud Drive أو OneDrive من قائمة المشاركة.</div>
      <button class="btn goldline" id="exp">حفظ نسخة الآن</button>
      <label class="btn ghost" style="cursor:pointer">استرجاع من ملف<input type="file" id="imp" accept="application/json,.json" style="display:none"></label></div>
    <div class="card stack" style="gap:8px"><h2>OneDrive تلقائي</h2>
      ${c.connected ? `<div class="small ${c.needsLogin ? 'red' : 'ok'}">${c.needsLogin ? 'انتهت الجلسة — تسجيل دخول مطلوب' : 'متصل'} · ${esc(c.account)}</div>
        <div class="small muted">${c.lastBackup ? 'آخر نسخة: ' + fmtDay(c.lastBackup) + ' ' + fmtTime(c.lastBackup) : 'لم تُرفع نسخة بعد'} · تُرفع نسخة تلقائياً بعد كل تغيير إلى مجلد Apps/ورقة حُب.</div>
        ${c.needsLogin ? `<button class="btn" id="relogin">تسجيل الدخول</button>` : `<button class="btn goldline" id="now">نسخ الآن</button>`}
        <button class="btn ghost" id="disc">فصل OneDrive</button>` :
        `<div class="small muted">تسجيل دخول واحد بحساب مايكروسوفت، وبعدها كل تغيير يُرفع تلقائياً.</div>
        <label class="f"><span>Microsoft App Client ID</span><input class="in" id="cid" value="${esc(c.clientId)}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocapitalize="off" style="direction:ltr;text-align:left"><div class="hint">يُنشئه عبدالغني مرة واحدة (التعليمات في README).</div></label>
        <button class="btn" id="connect" ${c.clientId ? '' : 'disabled'}>ربط OneDrive</button>`}
    </div>
    <div class="small faint">عنوان إعادة التوجيه لتسجيل التطبيق: <span style="direction:ltr;display:inline-block">${esc(OneDrive.redirect())}</span></div>
  </div>`;
  $('#exp').onclick = exportFile;
  $('#imp').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; if (!confirm('سيتم استبدال كل البيانات الحالية بمحتوى الملف. متأكدة؟')) return; try { importFromText(await f.text()); toast('تم الاسترجاع'); go('#/today'); } catch { toast('الملف غير صالح'); } };
  const cid = $('#cid'); if (cid) { cid.oninput = () => { c.clientId = cid.value.trim(); persist(false); $('#connect').disabled = !c.clientId; }; $('#connect').onclick = () => OneDrive.login(false).catch((e) => toast(e.message)); }
  if ($('#now')) $('#now').onclick = () => { toast('جارٍ الرفع…'); OneDrive.backup().then(() => toast('تم رفع النسخة')).catch((e) => { toast('فشل الرفع: ' + e.message, 3500); Screens.backup(); }); };
  if ($('#relogin')) $('#relogin').onclick = () => OneDrive.login(false);
  if ($('#disc')) $('#disc').onclick = () => { if (confirm('فصل OneDrive؟ تبقى نسخك السابقة هناك.')) { OneDrive.disconnect(); Screens.backup(); } };
};

// ---------- Boot ----------
(async function boot() {
  load();
  if (await OneDrive.handleRedirect()) { /* fell through with hash set */ }
  else if (S.settings.onedrive.connected && !S.settings.onedrive.needsLogin) {
    // Refresh silently in the background; if the session is gone, show the banner instead of interrupting her.
    OneDrive.token().then(() => OneDrive.backup()).catch(() => { S.settings.onedrive.needsLogin = true; persist(false); if (location.hash === '#/today' || !location.hash) route(); });
  }
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
