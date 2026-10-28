// Shared helpers: DOM, money, dates, storage, icons, modal, toast, the phone-style notification,
// the SMS code dialog and a fake QR code.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DAY = 864e5;
const HOUR = 36e5;
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sum = lines => lines.reduce((a, l) => a + l.amount, 0);
const digits = s => String(s).replace(/\D/g, '');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

const zl = n => (Number.isInteger(n) ? n.toLocaleString('pl-PL') : n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' zł';
const kg = n => n.toLocaleString('pl-PL') + ' kg';
const dni = n => (n === 1 ? '1 dzień' : `${n} dni`);
const rand6 = () => String(Math.floor(100000 + Math.random() * 900000));
const spaced = code => `${code.slice(0, 3)} ${code.slice(3)}`;

function plural(n, one, few, many) {
  if (n === 1) return one;
  const t = n % 10, h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
}

// ---------- dates (calendar days are stored as local midnight timestamps) ----------
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return +d; };
const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return +d; };
const atHour = (day, h) => { const d = new Date(day); d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0); return +d; };
const endOfDay = day => addDays(startOfDay(day), 1) - 1;
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

const fmtDay = ts => new Date(ts).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.,', ',');
const fmtLong = ts => new Date(ts).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDate = ts => new Date(ts).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtFull = ts => new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = ts => new Date(ts).toTimeString().slice(0, 5);
const fmtStamp = ts => `${fmtDay(ts)}, ${fmtTime(ts)}`;

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

// xorshift seeded from a string, for the fake QR codes and the city maps
function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = h || 1;
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
}

const I = {
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
  toolbox: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5h6v3M3 13h18M10 13v2.5h4V13"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  locker: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 9h8M4 15h8M12 12h8M6.5 6.2h2M6.5 12.2h2M6.5 18.2h2M14.5 7.5h3M14.5 16.5h3"/>',
  qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18v2h2M18 18h2v2"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  bank: '<path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/>',
  undo: '<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.3"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5zM14.5 6.5L17 4a4 4 0 0 0-5.6 4.7"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  weight: '<path d="M6 9h12l2 11H4z"/><circle cx="12" cy="6" r="2.5"/>',
  ruler: '<path d="M3 15L15 3l6 6L9 21z"/><path d="M7 11l2 2M10 8l2 2M13 5l2 2"/>',
  hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6.5 7-3 0-4.5-1.6-6-4l-2-3.5a1.5 1.5 0 0 1 2.6-1.5L8 14"/>',
  return: '<path d="M4 10h11a5 5 0 0 1 0 10H9M8 6l-4 4 4 4"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-1.5-4-6-4-6-1.5S10 9 12 9zM12 9c1.5-4 6-4 6-1.5S14 9 12 9z"/>',
};
const ic = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;

// Looks like a QR code, isn't one: a pattern seeded from the text plus the three finder squares.
function qrSvg(seed, n = 25) {
  const rnd = seeded(seed);
  const finders = [[0, 0], [n - 7, 0], [0, n - 7]];
  const nearFinder = (x, y) => finders.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!nearFinder(x, y) && rnd() > 0.52) d += `M${x} ${y}h1v1h-1z`;
  finders.forEach(([x, y]) => { d += `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`; });
  return `<svg class="qr" viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="Kod QR (symulacja)">
    <rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path fill="#111" fill-rule="evenodd" d="${d}"/></svg>`;
}

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

// spinner dialog for "the bank is thinking" moments; returns { set(text), close() }
function busy(text) {
  const m = modal({
    cls: 'modal--busy', dismissable: false, label: text,
    html: `<div class="busy"><span class="spinner" aria-hidden="true"></span><p class="busy__t" aria-live="polite">${esc(text)}</p></div>`,
  });
  return { set: t => { $('.busy__t', m.el).textContent = t; }, close: () => m.close() };
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

// ---------- phone notification (fake SMS / push) ----------
function notify({ app = 'SMS', title, body, onTap, icon = 'phone' }) {
  const n = document.createElement('button');
  n.type = 'button';
  n.className = 'push';
  n.innerHTML = `<span class="push__icon">${ic(icon)}</span>
    <span class="push__text"><span class="push__app">${esc(app)} · teraz</span><b>${esc(title)}</b><span>${esc(body)}</span></span>`;
  const hide = () => {
    n.classList.remove('is-in');
    setTimeout(() => n.remove(), 400);
  };
  n.addEventListener('click', () => { if (onTap) onTap(); hide(); });
  $('#notify').append(n);
  requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('is-in')));
  setTimeout(hide, 14000);
  return hide;
}

// ---------- one-time code sent by SMS (contract signing, 3-D Secure) ----------
// head: HTML above the form; sms(code) builds the message text. Resolves true when the right code is typed.
function codeDialog({ cls = '', label, head, sms, from = 'SKRZYNKA', cta = 'Potwierdź', lead }) {
  return new Promise(resolve => {
    let code = '', tries = 3, hidePush = null, ok = false;
    const m = modal({
      cls: 'modal--code ' + cls, label,
      onClose: () => { if (hidePush) hidePush(); resolve(ok); },
      html: `
      <form class="code" novalidate>
        ${head}
        <p class="code__lead">${lead}</p>
        <label class="field"><span>Kod z SMS-a</span>
          <input class="input code__input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"></label>
        <p class="code__err" role="alert" hidden></p>
        <div class="code__row">
          <button type="button" class="btn btn--ghost" data-close>Anuluj</button>
          <button type="submit" class="btn btn--dark">${cta}</button>
        </div>
        <button type="button" class="link code__resend">SMS nie dotarł? Wyślij ponownie</button>
      </form>`,
    });
    const input = $('.code__input', m.el), errEl = $('.code__err', m.el);
    const send = () => {
      code = rand6();
      if (hidePush) hidePush();
      setTimeout(() => {
        hidePush = notify({
          title: from, body: sms(code) + ' (dotknij, by wkleić)',
          onTap: () => { input.value = code; input.focus(); },
        });
      }, 1000);
    };
    send();
    setTimeout(() => input.focus(), 250);
    $('.code__resend', m.el).addEventListener('click', send);
    input.addEventListener('input', () => { input.value = digits(input.value).slice(0, 6); errEl.hidden = true; });
    $('.code', m.el).addEventListener('submit', e => {
      e.preventDefault();
      if (input.value === code) { ok = true; return m.close(); }
      tries--;
      if (!tries) return m.close();
      errEl.textContent = `Nieprawidłowy kod. ${tries === 1 ? 'Została 1 próba' : `Zostały ${tries} próby`}.`;
      errEl.hidden = false;
      input.select();
    });
  });
}
