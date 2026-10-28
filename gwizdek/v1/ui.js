// Shared helpers: DOM, dates, numbers, storage, icons, modal, toast, push banner and the small SVG charts
// (radar, line, bars) used by profiles, tests and reports.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DAY = 864e5;
const MIN = 6e4;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const zl = n => (Number.isInteger(n) ? n.toLocaleString('pl-PL') : n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' zł';
const num = (n, d = 0) => n.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d });

function plural(n, one, few, many) {
  if (n === 1) return one;
  const t = n % 10, h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
}
const nOf = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;

// ---------- dates (calendar days are local midnight timestamps) ----------
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return +d; };
const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return +d; };
const atTime = (day, hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(day); d.setHours(h, m, 0, 0); return +d; };
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
const startOfWeek = ts => { const d = startOfDay(ts); return addDays(d, -((new Date(d).getDay() + 6) % 7)); };
const sameDay = (a, b) => startOfDay(a) === startOfDay(b);
const ym = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const ymAdd = (key, n) => { const [y, m] = key.split('-').map(Number); return ym(+new Date(y, m - 1 + n, 1)); };
const ymDate = (key, day = 1) => { const [y, m] = key.split('-').map(Number); return +new Date(y, m - 1, day); };
const age = (birth, at = Date.now()) => { const b = new Date(birth), a = new Date(at); return a.getFullYear() - b.getFullYear() - (a < new Date(a.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0); };

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const WD = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const WD_SHORT = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const ymLabel = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const ymShort = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`; };

const fmtTime = ts => new Date(ts).toTimeString().slice(0, 5);
const fmtDay = ts => `${WD_SHORT[new Date(ts).getDay()]} ${new Date(ts).getDate()} ${MONTHS_SHORT[new Date(ts).getMonth()]}`;
const fmtDate = ts => new Date(ts).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtFull = ts => new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtLong = ts => new Date(ts).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtRange = (a, b) => `${fmtTime(a)}–${fmtTime(b)}`;
const isoDay = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return +new Date(y, m - 1, d); };

function relDay(ts, now = Date.now()) {
  const d = daysBetween(now, ts);
  if (d === 0) return 'dziś';
  if (d === 1) return 'jutro';
  if (d === -1) return 'wczoraj';
  if (d > 1 && d < 7) return WD[new Date(ts).getDay()];
  return fmtDay(ts);
}
function ago(ts, now = Date.now()) {
  const m = Math.round((now - ts) / MIN);
  if (m < 1) return 'przed chwilą';
  if (m < 60) return `${m} min temu`;
  const h = Math.round(m / 60);
  if (h < 24 && sameDay(ts, now)) return `${h} godz. temu`;
  if (daysBetween(ts, now) === 1) return `wczoraj, ${fmtTime(ts)}`;
  return `${fmtDay(ts)}, ${fmtTime(ts)}`;
}

const store = {
  get(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch (e) { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  },
  drop(k) {
    try { localStorage.removeItem(k); } catch (e) {}
  },
};

// xorshift seeded from a string, so the demo club comes out the same every reset
function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = h || 1;
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
}

const I = {
  home: '<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  whistle: '<path d="M3 11.5a5.5 5.5 0 1 0 11 0V9h7V6H8.5A5.5 5.5 0 0 0 3 11.5z"/><circle cx="8.5" cy="11.5" r="1.6"/><path d="M14 9V6"/>',
  board: '<rect x="3" y="4" width="18" height="14" rx="1.5"/><path d="M12 4v14"/><circle cx="12" cy="11" r="2.6"/><path d="M8 21h8M12 18v3"/>',
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.2c2.6.3 4.5 2.6 4.5 5.3"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/><path d="M7 12h2.5l1.2-2.2 2 4.4 1.3-2.2H17"/>',
  coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5 1 0 2-.1 2.8-.4"/><ellipse cx="16" cy="15" rx="4.5" ry="2"/><path d="M11.5 15v3c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-3"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  pitch: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.5"/><path d="M3 9h3v6H3M21 9h-3v6h3"/>',
  form: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  sms: '<path d="M4 5h16v11H9l-5 4z"/><circle cx="8.5" cy="10.5" r=".6"/><circle cx="12" cy="10.5" r=".6"/><circle cx="15.5" cy="10.5" r=".6"/>',
  ycard: '<rect x="7" y="3.5" width="10" height="17" rx="1.5"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  bank: '<path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 16v4h16v-4"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  ruler: '<path d="M3 15L15 3l6 6L9 21z"/><path d="M7 11l2 2M10 8l2 2M13 5l2 2"/>',
  bandage: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M10 10l4 4M10.5 13.5h.01M13.5 10.5h.01"/>',
  steth: '<path d="M6 3v6a5 5 0 0 0 10 0V3"/><path d="M11 14v1a5 5 0 0 0 10 0v-2"/><circle cx="21" cy="11" r="2"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
  ball: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4zM12 7.5V3.5M15.8 10.3l3.9-1.3M14.3 14.7l2.4 3.4M9.7 14.7l-2.4 3.4M8.2 10.3L4.3 9"/>',
  cone: '<path d="M9 4h6l4 15H5z"/><path d="M3 19h18M7.5 12h9"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  zone: '<rect x="4" y="5" width="16" height="14" rx="1" stroke-dasharray="3 2"/>',
  goal: '<path d="M4 18V7h16v11"/><path d="M4 11h16M4 15h16M8 7v11M12 7v11M16 7v11" stroke-width="1"/>',
  eraser: '<path d="M8 20l-4-4L15 5l5 5-9 10zM20 20H8M9.5 9.5l5 5"/>',
  layers: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  thumb: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.5 2.5L13 10h5.5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.3 20H7"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  dots: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  undo: '<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>',
};
const ic = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name] || ''}</svg>`;
const initials = name => name.split(' ').map(w => w[0]).slice(0, 2).join('');
const avatar = (name, color = 'var(--pitch)', cls = '') => `<span class="ava ${cls}" style="--c:${color}" aria-hidden="true">${esc(initials(name))}</span>`;

// ---------- modal ----------
function modal({ html, cls = '', dismissable = true, onClose, label = '' }) {
  const root = $('#modalRoot');
  const wrap = document.createElement('div');
  const opener = document.activeElement;
  wrap.className = 'modal ' + cls;
  wrap.innerHTML = `<div class="modal__backdrop"></div><div class="modal__panel" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">${html}</div>`;
  root.append(wrap);
  document.body.classList.add('has-modal');
  const panel = $('.modal__panel', wrap);
  requestAnimationFrame(() => { wrap.classList.add('is-open'); panel.focus({ preventScroll: true }); });

  let closed = false;
  const close = result => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      wrap.remove();
      if (!root.children.length) document.body.classList.remove('has-modal');
    }, 200);
    if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
    if (onClose) onClose(result);
  };
  const onKey = e => {
    if (e.key === 'Escape' && dismissable && root.lastElementChild === wrap) close();
  };
  document.addEventListener('keydown', onKey);
  if (dismissable) $('.modal__backdrop', wrap).addEventListener('click', () => close());
  $$('[data-close]', wrap).forEach(b => b.addEventListener('click', () => close()));
  return { el: panel, close };
}

const modalHead = (title, sub = '') => `<header class="mh"><div><h2 class="mh__t">${title}</h2>${sub ? `<p class="mh__s">${sub}</p>` : ''}</div>
  <button type="button" class="icon-btn" data-close aria-label="Zamknij">${ic('x')}</button></header>`;

function confirmBox({ title, body, ok = 'Tak', cancel = 'Anuluj', danger = false }) {
  return new Promise(resolve => {
    let res = false;
    const m = modal({
      cls: 'modal--sm', label: title, onClose: () => resolve(res),
      html: `${modalHead(title)}<div class="mb"><p>${body}</p></div>
        <footer class="mf"><button type="button" class="btn btn--ghost" data-close>${cancel}</button>
        <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-ok>${ok}</button></footer>`,
    });
    $('[data-ok]', m.el).addEventListener('click', () => { res = true; m.close(); });
  });
}

// spinner dialog for "the bank is thinking" moments; returns { set(text), close() }
function busy(text) {
  const m = modal({
    cls: 'modal--busy', dismissable: false, label: text,
    html: `<div class="busy"><span class="spinner" aria-hidden="true"></span><p class="busy__t" aria-live="polite">${esc(text)}</p></div>`,
  });
  return { set: t => { $('.busy__t', m.el).textContent = t; }, close: () => m.close() };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- toast ----------
function toast(msg, icon = 'check') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${icon ? ic(icon) : ''}<span>${msg}</span>`;
  $('#toasts').append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => {
    t.classList.remove('is-in');
    setTimeout(() => t.remove(), 300);
  }, 3600);
}

// ---------- push banner (a notification that arrived from another tab or role) ----------
function push({ title, body, onTap, icon = 'bell' }) {
  const n = document.createElement('button');
  n.type = 'button';
  n.className = 'push';
  n.innerHTML = `<span class="push__icon">${ic(icon)}</span>
    <span class="push__text"><span class="push__app">Gwizdek · teraz</span><b>${esc(title)}</b><span>${esc(body)}</span></span>`;
  const hide = () => {
    n.classList.remove('is-in');
    setTimeout(() => n.remove(), 400);
  };
  n.addEventListener('click', () => { if (onTap) onTap(); hide(); });
  $('#pushes').append(n);
  requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('is-in')));
  setTimeout(hide, 9000);
}

// ---------- tabs inside a page (state lives in the hash query) ----------
function tabsBar(tabs, active, base) {
  return `<nav class="tabs" aria-label="Sekcje">${tabs.map(([id, label, badge]) =>
    `<a class="tabs__t ${id === active ? 'is-on' : ''}" href="${base}?t=${id}" ${id === active ? 'aria-current="page"' : ''}>${label}${badge ? ` <span class="tabs__b">${badge}</span>` : ''}</a>`).join('')}</nav>`;
}

// ---------- charts ----------
// Radar of skills on a 1–5 scale. series: [{ values: [..], color, label, dashed }]
function radarSvg(axes, series, { size = 260 } = {}) {
  const c = size / 2, r = c - 44, n = axes.length;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [c + Math.cos(a) * r * (v / 5), c + Math.sin(a) * r * (v / 5)];
  };
  let g = '';
  for (let lv = 1; lv <= 5; lv++) {
    g += `<polygon class="ch-grid" points="${axes.map((_, i) => pt(i, lv).join(',')).join(' ')}"/>`;
  }
  axes.forEach((a, i) => {
    const [x, y] = pt(i, 5), [lx, ly] = pt(i, 6.15);
    g += `<line class="ch-grid" x1="${c}" y1="${c}" x2="${x}" y2="${y}"/>`;
    const anchor = Math.abs(lx - c) < 6 ? 'middle' : lx > c ? 'start' : 'end';
    g += `<text class="ch-lbl" x="${lx}" y="${ly + 4}" text-anchor="${anchor}">${esc(a)}</text>`;
  });
  series.forEach(s => {
    const pts = s.values.map((v, i) => pt(i, v).join(',')).join(' ');
    g += `<polygon points="${pts}" fill="${s.color}" fill-opacity="${s.dashed ? 0 : 0.18}" stroke="${s.color}" stroke-width="2" ${s.dashed ? 'stroke-dasharray="4 3"' : ''} stroke-linejoin="round"/>`;
    if (!s.dashed) s.values.forEach((v, i) => { const [x, y] = pt(i, v); g += `<circle cx="${x}" cy="${y}" r="3" fill="${s.color}"/>`; });
  });
  return `<svg class="chart chart--radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Wykres umiejętności">${g}</svg>`;
}

// Line chart. series: [{ points: [[ts, value]], color, label, dashed }]; lowerBetter flips nothing, only the hint.
function lineSvg(series, { w = 420, h = 180, fmt = v => num(v, 1), unit = '' } = {}) {
  const all = series.flatMap(s => s.points);
  if (!all.length) return '<p class="muted">Brak danych.</p>';
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= DAY * 15; x1 += DAY * 15; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.18 || Math.abs(y1) * 0.1 || 1;
  y0 -= pad; y1 += pad;
  const L = 44, R = 12, T = 12, B = 26;
  const X = t => L + ((t - x0) / (x1 - x0)) * (w - L - R);
  const Y = v => T + (1 - (v - y0) / (y1 - y0)) * (h - T - B);
  let g = '';
  for (let i = 0; i <= 3; i++) {
    const v = y0 + ((y1 - y0) * i) / 3, y = Y(v);
    g += `<line class="ch-grid" x1="${L}" x2="${w - R}" y1="${y}" y2="${y}"/><text class="ch-ax" x="${L - 6}" y="${y + 4}" text-anchor="end">${fmt(v)}</text>`;
  }
  const ticks = [...new Set(xs)].sort((a, b) => a - b);
  ticks.forEach(t => { g += `<text class="ch-ax" x="${X(t)}" y="${h - 6}" text-anchor="middle">${MONTHS_SHORT[new Date(t).getMonth()]} ${String(new Date(t).getFullYear()).slice(2)}</text>`; });
  series.forEach(s => {
    const p = [...s.points].sort((a, b) => a[0] - b[0]);
    g += `<polyline fill="none" stroke="${s.color}" stroke-width="2.2" ${s.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round" points="${p.map(q => `${X(q[0])},${Y(q[1])}`).join(' ')}"/>`;
    if (!s.dashed) p.forEach(q => { g += `<circle cx="${X(q[0])}" cy="${Y(q[1])}" r="3.4" fill="var(--surface)" stroke="${s.color}" stroke-width="2"><title>${fmt(q[1])}${unit} · ${fmtDate(q[0])}</title></circle>`; });
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Wykres">${g}</svg>`;
}

// Grouped vertical bars. groups: [{ label, bars: [{ v, color, title }] }]
function barsSvg(groups, { w = 520, h = 200, fmt = v => num(v) } = {}) {
  const max = Math.max(1, ...groups.flatMap(g => g.bars.map(b => b.v)));
  const L = 52, R = 8, T = 10, B = 28;
  const gw = (w - L - R) / groups.length, per = groups[0]?.bars.length || 1, bw = Math.min(26, (gw - 14) / per);
  const Y = v => T + (1 - v / max) * (h - T - B);
  let g = '';
  for (let i = 0; i <= 3; i++) {
    const v = (max * i) / 3, y = Y(v);
    g += `<line class="ch-grid" x1="${L}" x2="${w - R}" y1="${y}" y2="${y}"/><text class="ch-ax" x="${L - 6}" y="${y + 4}" text-anchor="end">${fmt(v)}</text>`;
  }
  groups.forEach((gr, gi) => {
    const cx = L + gw * gi + gw / 2, start = cx - (bw * per + 3 * (per - 1)) / 2;
    gr.bars.forEach((b, bi) => {
      const x = start + bi * (bw + 3), y = Y(b.v);
      g += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(0, h - B - y)}" rx="3" fill="${b.color}"><title>${esc(b.title || fmt(b.v))}</title></rect>`;
    });
    g += `<text class="ch-ax" x="${cx}" y="${h - 8}" text-anchor="middle">${esc(gr.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Wykres słupkowy">${g}</svg>`;
}

// Tiny horizontal meter, used in tables
const meter = (v, max = 100, cls = '') => `<span class="meter ${cls}"><span style="width:${clamp((v / max) * 100, 0, 100)}%"></span></span>`;

function downloadFile(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: type + ';charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
