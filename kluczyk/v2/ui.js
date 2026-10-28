// Shared helpers: DOM, money, storage, icons, modals, toasts and the phone-style notification.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DAY = 864e5;
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sum = lines => lines.reduce((a, l) => a + l.amount, 0);

const zl = n => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
const zl0 = n => Math.round(n).toLocaleString('pl-PL') + ' zł';

function plural(n, one, few, many) {
  if (n === 1) return one;
  const t = n % 10, h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
}
const doby = n => `${n} ${plural(n, 'doba', 'doby', 'dób')}`;

const fmtDay = ts => new Date(ts).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.,', ',');
const fmtLong = ts => new Date(ts).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = ts => new Date(ts).toTimeString().slice(0, 5);

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

const I = {
  seat: '<path d="M8 4h3a2 2 0 0 1 2 2v7h3.5a2 2 0 0 1 2 2v5M8 4v12h8M5 20h14"/>',
  bag: '<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M9 11v5M15 11v5"/>',
  gear: '<circle cx="6" cy="6" r="1.8"/><circle cx="12" cy="6" r="1.8"/><circle cx="18" cy="6" r="1.8"/><circle cx="6" cy="18" r="1.8"/><circle cx="12" cy="18" r="1.8"/><path d="M6 8v8M12 8v8M18 8v4H6"/>',
  fuel: '<path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11M5 10h9M14 8l3 2v7a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.8"/>',
  trunk: '<path d="M4 18h16v-5l-2-4H6l-2 4zM4 13h16M7 9L5 4h7"/>',
  horn: '<path d="M4 10v4h3l6 4V6l-6 4zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  bank: '<path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  plane: '<path d="M10 14L3 11l18-7-7 18-3-7zM10 14l4-4"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  undo: '<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
};
const ic = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;

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
    }, 220);
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
  }, 3800);
}

// ---------- phone notification (fake SMS) ----------
function notify({ app = 'Wiadomości', title, body, onTap }) {
  const n = document.createElement('button');
  n.type = 'button';
  n.className = 'push';
  n.innerHTML = `<span class="push__icon">${ic('phone')}</span>
    <span class="push__text"><span class="push__app">${esc(app)} · teraz</span><b>${esc(title)}</b><span>${esc(body)}</span></span>`;
  const hide = () => {
    n.classList.remove('is-in');
    setTimeout(() => n.remove(), 400);
  };
  n.addEventListener('click', () => { if (onTap) onTap(); hide(); });
  $('#notify').append(n);
  requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('is-in')));
  setTimeout(hide, 12000);
  return hide;
}
