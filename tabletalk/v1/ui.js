// TableTalk v1 — helpers shared by the guest phone, the staff panel, the owner's office and the TV:
// DOM, formats, storage, toasts, sheets, icons, sounds, the bottle-cap table badge, pocha tables seen
// from above, seven-segment digits, dish drawings and QR codes.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SEC = 1e3, MIN = 6e4, HOUR = 36e5;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const sum = (a, f = x => x) => a.reduce((s, x) => s + f(x), 0);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

function plural(n, one, few, many) {
  if (n === 1) return one;
  const t = n % 10, h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
}
const nOf = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;

// ---------- formats ----------
const CURRENCIES = {
  PLN: { locale: 'pl-PL', unit: 'zł' },
  CZK: { locale: 'cs-CZ', unit: 'Kč' },
  EUR: { locale: 'de-DE', unit: '€' },
};
function fmtMoney(n, cur = 'PLN') {
  const c = CURRENCIES[cur] || CURRENCIES.PLN;
  const s = n.toLocaleString(c.locale, Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${s} ${c.unit}`;
}
const fmtTime = ts => new Date(ts).toTimeString().slice(0, 5);
const fmtClock = ms => { const s = Math.max(0, Math.floor(ms / SEC)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function fmtWait(ms) {
  const m = Math.floor(ms / MIN);
  if (m < 1) return `${Math.max(0, Math.floor(ms / SEC))} s`;
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}
const isoDay = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---------- storage: localStorage is "the server", sessionStorage is this tab's phone ----------
function wrap(area) {
  return {
    get(k, fallback) { try { return JSON.parse(window[area].getItem(k)) ?? fallback; } catch (e) { return fallback; } },
    set(k, v) { try { window[area].setItem(k, JSON.stringify(v)); } catch (e) {} },
    drop(k) { try { window[area].removeItem(k); } catch (e) {} },
  };
}
const store = wrap('localStorage');
const sess = wrap('sessionStorage');

// xorshift seeded from a string, so table tokens survive a demo reset
function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = h || 1;
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
}
const TOKEN_ABC = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeToken = (r = Math.random) => Array.from({ length: 10 }, () => TOKEN_ABC[Math.floor(r() * TOKEN_ABC.length)]).join('');

// ---------- icons (24 px grid, stroked) ----------
const I = {
  menu: '<path d="M3 11.5h18a9 9 0 0 1-18 0z"/><path d="M8 20.5h8M14.5 3l-3.2 8.5M20 4.5l-6.6 7"/>',
  chat: '<path d="M4 5h16v11H9.5L4 20z"/><path d="M8 9.5h8M8 12.5h5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  table: '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="3.6" r="1.6"/><circle cx="12" cy="20.4" r="1.6"/><circle cx="3.6" cy="12" r="1.6"/><circle cx="20.4" cy="12" r="1.6"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  receipt: '<path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 11.5h6M9 15h3"/>',
  gift: '<rect x="4" y="9.5" width="16" height="10.5" rx="1"/><path d="M3 9.5h18V7H3zM12 7v13M12 7C10 3.5 7 4 7.5 6S11 7 12 7zM12 7c2-3.5 5-3 4.5-1S13 7 12 7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.6h.01M15 9.6h.01"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  block: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5z"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.2c2.6.3 4.5 2.6 4.5 5.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  fire: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.3 2.4-5.2 3.4-8.4 1.9 1.3 2.6 3.2 2.5 4.8 1.4-.6 2.3-2 2.3-3.9 2.6 2 4.8 4.6 4.8 7.6 0 3.5-2.6 6-6.5 6z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l7-7"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.3a9.5 9.5 0 0 1 13 0M8.6 15.6a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r=".9"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.5.9-1.6 2.5-3.2 3.8M6.6 7.6C4.6 8.9 3.2 10.8 2.5 12c1 1.8 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1M9.9 10a3 3 0 0 0 4.1 4.1"/>',
  volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  volumeOff: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
  door: '<path d="M6 20.5V4h10v16.5M3.5 20.5h17M13 12.5h.01"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  pot: '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM2 11.5h2M20 11.5h2M9 6.5c0-1 1-1.5 1-2.5M13 6.5c0-1 1-1.5 1-2.5"/>',
  glass: '<path d="M6 4h12l-1.6 15.2a1.5 1.5 0 0 1-1.5 1.3H9.1a1.5 1.5 0 0 1-1.5-1.3zM6.6 9.5h10.8"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.5M4 4.5v3.5h3.5M4 13a8 8 0 0 0 14.3 4.5M20 19.5V16h-3.5"/>',
  cloudOff: '<path d="M3 3l18 18M8 7.2A5.5 5.5 0 0 1 17 10.5a4 4 0 0 1 2.9 6.2M16.5 19H7a4.5 4.5 0 0 1-1.2-8.8"/>',
  homeAdd: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
  alert: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.3h.01"/>',
  swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  merge: '<path d="M6 4v5a5 5 0 0 0 5 5h7M18 14l-3-3M18 14l-3 3M6 20v-6"/>',
  chatOff: '<path d="M3 3l18 18M20 16V5H8.5M5 5H4v15l5.5-4H16"/>',
  sparkle: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6zM18.5 16l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z"/>',
  drop: '<path d="M12 3.5s6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 6-10.5 6-10.5z"/>',
  chop: '<path d="M7 3l2 18M12 3l-1.5 18M16 5c2 2 2 5 0 7l-1 9"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.3-.9.8-.9 1.5v.6M12 16.8h.01"/>',
  dots: '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M8 21h8M12 17v4"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l2.5 2.5M14 9l1.8 1.8"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>',
  logout: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
};
const ic = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name] || I.info}</svg>`;

// ---------- event registries: each view adds its handlers, app.js dispatches ----------
// clicks on [data-act], input on [data-in], change on [data-ch], submit of form[data-submit]
const ACTS = {}, INPUTS = {}, CHANGES = {}, SUBMITS = {};

// ---------- toasts and layers ----------
function toast(html, { icon = 'info', kind = '', ms = 3800, action } = {}) {
  const box = $('.toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast${kind ? ' toast--' + kind : ''}`;
  el.innerHTML = `${ic(icon)}<span>${html}</span>${action ? `<button type="button" class="toast__act">${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { el.remove(); action.run(); };
  box.append(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

// One layer at a time: a bottom sheet on the phone, a dialog in the staff panel and the office.
let layer = null;
function openLayer(html, { cls = '', onClose, root } = {}) {
  closeLayer(true);
  const host = root || $('.layers') || document.body;
  const el = document.createElement('div');
  el.className = `layer ${cls}`;
  el.innerHTML = `<div class="layer__scrim" data-close></div><div class="layer__box" role="dialog" aria-modal="true">${html}</div>`;
  host.append(el);
  el.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeLayer(); });
  layer = { el, onClose };
  tickClocks();
  requestAnimationFrame(() => el.classList.add('in'));
  const f = el.querySelector('[autofocus]');
  if (f) setTimeout(() => f.focus({ preventScroll: true }), 60);
  return el.querySelector('.layer__box');
}
function closeLayer(silent) {
  if (!layer) return;
  const { el, onClose } = layer;
  layer = null;
  el.remove();
  if (!silent && onClose) onClose();
}
const layerBox = () => layer?.el.querySelector('.layer__box') || null;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && layer) closeLayer(); });

// ---------- sound: the two-tone "ding-dong" of a Korean table-bell receiver, and friends ----------
let actx = null;
let soundOn = sess.get('tabletalk-sound', true);
function audio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { actx = null; }
  return actx;
}
document.addEventListener('pointerdown', () => audio(), { once: true });
function tone(freq, at, dur, type = 'sine', vol = 0.16) {
  const a = audio();
  if (!a || !soundOn) return;
  const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + at;
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
const SOUNDS = {
  dingdong: () => { tone(1319, 0, 0.55, 'triangle'); tone(1047, 0.3, 0.9, 'triangle'); },
  blip: () => tone(880, 0, 0.12, 'sine', 0.07),
  gift: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.09, 0.4, 'triangle', 0.11)),
  ok: () => { tone(660, 0, 0.12, 'sine', 0.1); tone(990, 0.09, 0.22, 'sine', 0.1); },
  flick: () => { tone(320, 0, 0.06, 'square', 0.06); tone(1800, 0.02, 0.08, 'triangle', 0.05); },
};
function sound(name) { try { SOUNDS[name]?.(); } catch (e) {} }
function setSound(on) { soundOn = on; sess.set('tabletalk-sound', on); }

// ---------- the bottle cap: every table number in the app wears one ----------
const CAP_PATH = (() => {
  const n = 21, pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 45.5 : 50;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
})();
const cap = (no, mod = '') => `<span class="cap ${mod}"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="${CAP_PATH}"/><circle cx="50" cy="50" r="37"/></svg><b>${esc(no)}</b></span>`;

// ---------- a round steel pocha table seen from above, with plastic stools ----------
function tableArt(seats) {
  const R = seats > 4 ? 6.3 : seats > 2 ? 5.3 : 4.5;
  const off = seats === 2 ? 0 : Math.PI / seats;
  const stools = Array.from({ length: seats }, (_, i) => {
    const a = (i / seats) * Math.PI * 2 + off;
    return `<circle class="stool" cx="${((R + 2.9) * Math.cos(a)).toFixed(2)}" cy="${((R + 2.9) * Math.sin(a)).toFixed(2)}" r="1.9"/>`;
  }).join('');
  return `<svg viewBox="-11 -11 22 22" aria-hidden="true">${stools}<circle class="top" r="${R}"/><circle class="rim" r="${(R - 0.9).toFixed(1)}"/></svg>`;
}

// ---------- seven-segment digits, for the call-bell receiver on the wall ----------
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
const SEG_RECT = {
  a: 'x="2.6" y="0" width="6.8" height="2"', b: 'x="10" y="2.4" width="2" height="7"', c: 'x="10" y="10.6" width="2" height="7"',
  d: 'x="2.6" y="18" width="6.8" height="2"', e: 'x="0" y="10.6" width="2" height="7"', f: 'x="0" y="2.4" width="2" height="7"', g: 'x="2.6" y="9" width="6.8" height="2"',
};
function seg7(text, cls = '') {
  const chars = String(text).split(''), W = 15;
  const body = chars.map((ch, i) => `<g transform="translate(${i * W} 0)">${Object.entries(SEG_RECT).map(([k, r]) => `<rect ${r} rx=".9" class="${(SEG[ch] ?? '').includes(k) ? 'on' : 'off'}"/>`).join('')}</g>`).join('');
  return `<svg class="seg7 ${cls}" viewBox="-1 -1 ${chars.length * W} 22" role="img" aria-label="${esc(text)}"><g transform="skewX(-7)">${body}</g></svg>`;
}

// ---------- dishes, drawn small: plates and pans from above, bottles and glasses from the side ----------
const ART = (() => {
  const plate = '<circle cx="50" cy="50" r="45" fill="#d9d3c8"/><circle cx="50" cy="50" r="39" fill="#f4f0e8"/>';
  const pan = '<circle cx="50" cy="50" r="46" fill="#2b2b2b"/><circle cx="50" cy="50" r="40" fill="#3a3a3a"/>';
  const gold = '<rect x="2" y="44" width="12" height="7" rx="3" fill="#b9862a"/><rect x="86" y="44" width="12" height="7" rx="3" fill="#b9862a"/><circle cx="50" cy="50" r="42" fill="url(#g-gold)"/><circle cx="50" cy="50" r="36" fill="#b9862a"/>';
  const steel = '<circle cx="50" cy="50" r="44" fill="url(#g-steel)"/><circle cx="50" cy="50" r="37" fill="#8d969c"/>';
  const blobs = (fill, hi, seed) => {
    const r = seeded(seed);
    return Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * 6.28 + r(), d = i ? 15 + r() * 6 : 0, x = 50 + d * Math.cos(a), y = 50 + d * Math.sin(a), rot = r() * 180;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(10 + r() * 3).toFixed(1)}" ry="${(7.5 + r() * 2).toFixed(1)}" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}"/><ellipse cx="${(x - 2).toFixed(1)}" cy="${(y - 2).toFixed(1)}" rx="4" ry="2" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${hi}"/>`;
    }).join('');
  };
  const seeds = (n, seed, box = 22) => { const r = seeded(seed); return Array.from({ length: n }, () => `<ellipse cx="${(50 + (r() - .5) * box * 2).toFixed(1)}" cy="${(50 + (r() - .5) * box * 2).toFixed(1)}" rx="1.1" ry=".6" fill="#fff6dc"/>`).join(''); };
  const cakes = (n, seed, fill = '#f3ede0') => {
    const r = seeded(seed);
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * 6.28 + r() * .5, d = 8 + r() * 20, x = 50 + d * Math.cos(a), y = 50 + d * Math.sin(a);
      return `<rect x="${(x - 7).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="14" height="6" rx="3" fill="${fill}" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }).join('');
  };
  const egg = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="6.5" fill="#fbf8ef"/><circle cx="${x}" cy="${y}" r="3.6" fill="#f2b632"/>`;
  const onion = (seed, n = 9) => { const r = seeded(seed); return Array.from({ length: n }, () => `<circle cx="${(28 + r() * 44).toFixed(1)}" cy="${(28 + r() * 44).toFixed(1)}" r="1.8" fill="none" stroke="#6fb24a" stroke-width="1.3"/>`).join(''); };
  const bottle = (label, capFill = '#2c8f57') => `<path d="M43 8h14v14c0 4 8 8 8 16v52a4 4 0 0 1-4 4H39a4 4 0 0 1-4-4V38c0-8 8-12 8-16z" fill="url(#g-bottle)"/><rect x="42.5" y="4" width="15" height="7" rx="1.5" fill="${capFill}"/><rect x="38" y="50" width="24" height="26" rx="2" fill="${label}"/><path d="M42 57h16M42 62h12M42 67h14" stroke="#1d5e3c" stroke-width="1.6"/><path d="M39 40v44" stroke="#bff0d4" stroke-opacity=".45" stroke-width="2.5" stroke-linecap="round"/>`;
  const glass = (liquid, top = 30) => {
    const k = 5 * (top - 14) / 76, l = 28 + k, r = 72 - k;
    return `<path d="M26 14h48l-5 76a5 5 0 0 1-5 4H36a5 5 0 0 1-5-4z" fill="#cfe3ea" fill-opacity=".3" stroke="#e5eef1" stroke-width="2"/><path d="M${l.toFixed(1)} ${top}H${r.toFixed(1)}L67.1 88a3 3 0 0 1-3 3H35.9a3 3 0 0 1-3-3z" fill="${liquid}"/>`;
  };
  return {
    chicken: `${plate}${blobs('#c58631', '#e6ac55', 'ch')}<rect x="70" y="68" width="18" height="18" rx="4" fill="#fbf7ee" stroke="#d9d3c8" stroke-width="1.5"/><rect x="73" y="71" width="5" height="5" fill="#f6f3d2"/><rect x="80" y="72" width="5" height="5" fill="#f6f3d2"/><rect x="76" y="78" width="5" height="5" fill="#f6f3d2"/>`,
    yangnyeom: `${plate}${blobs('#b3301b', '#e3603a', 'yn')}${seeds(16, 'yns')}`,
    wings: `${plate}${blobs('#6e3714', '#a35a26', 'wg')}${onion('wgo', 7)}`,
    tteok: `${pan}<circle cx="50" cy="50" r="37" fill="#c4271b"/>${cakes(11, 'tb')}<path d="M24 40l10-6 2 10zM62 70l10-3-3 9z" fill="#d9a65a"/>${egg(64, 36)}${onion('tbo')}`,
    rose: `${pan}<circle cx="50" cy="50" r="37" fill="#e57b52"/><path d="M34 34q8-6 14 2t14-2" stroke="#ffd9c0" stroke-width="5" fill="none" stroke-linecap="round"/>${cakes(10, 'rs')}<ellipse cx="44" cy="62" rx="9" ry="6" fill="#fff4d6"/><ellipse cx="62" cy="44" rx="7" ry="5" fill="#fff4d6"/>`,
    gungjung: `${pan}<circle cx="50" cy="50" r="37" fill="#8a5a2b"/>${cakes(10, 'gj', '#efe6d2')}<path d="M30 58l14-6M56 30l12 8M38 32l-4 14M64 62l-10 6" stroke="#4f9a3a" stroke-width="3" stroke-linecap="round"/><path d="M58 52l12 2M34 66l8-8" stroke="#e07b2a" stroke-width="3" stroke-linecap="round"/>${seeds(10, 'gjs')}`,
    ramen: `${gold}<circle cx="50" cy="50" r="34" fill="#d4521f"/><path d="M26 46c6-8 10 8 16 0s10 8 16 0 10 8 16 0M24 56c6-8 10 8 16 0s10 8 16 0 10 8 16 0M30 36c6-8 10 8 16 0s10 8 16 0" fill="none" stroke="#f2cf7a" stroke-width="3" stroke-linecap="round"/>${egg(58, 62)}${onion('rmo', 6)}`,
    odeng: `${steel}<circle cx="50" cy="50" r="35" fill="#e2bd78"/><path d="M20 30l60 40M22 64l58-30" stroke="#7a5230" stroke-width="2"/><path d="M30 38q4-6 8 0t8 0 8 0M56 52q4-6 8 0t8 0M34 58q4-6 8 0t8 0" fill="none" stroke="#c8893f" stroke-width="5" stroke-linecap="round"/><circle cx="64" cy="34" r="6" fill="#fbf7ee"/><circle cx="38" cy="72" r="5" fill="#fbf7ee"/>${onion('odo', 6)}`,
    kimchijeon: `${plate}<circle cx="50" cy="50" r="32" fill="#d9662b"/><path d="M50 18v64M18 50h64M27 27l46 46M73 27L27 73" stroke="#b94a1d" stroke-width="1.4"/><path d="M36 40l6 3M58 36l5 4M40 62l7-2M62 58l4 5M50 48l5 3" stroke="#a52a17" stroke-width="3.5" stroke-linecap="round"/><circle cx="82" cy="80" r="9" fill="#2b2420"/><circle cx="82" cy="80" r="6" fill="#5a2d18"/>`,
    pajeon: `${plate}<circle cx="50" cy="50" r="32" fill="#e3b552"/><path d="M50 18v64M18 50h64M27 27l46 46M73 27L27 73" stroke="#c7953a" stroke-width="1.4"/><path d="M30 36l40 10M28 56l42-6M34 68l32-4M36 28l26 6" stroke="#5aa03a" stroke-width="2.6" stroke-linecap="round"/><path d="M40 44a5 5 0 1 1 6 6M58 60a5 5 0 1 1 6 6" fill="none" stroke="#f08d7a" stroke-width="3" stroke-linecap="round"/>`,
    kimbap: `${plate}${[[50, 50], [34, 40], [66, 40], [34, 60], [66, 60], [50, 30], [50, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.5" fill="#1b1d1a"/><circle cx="${x}" cy="${y}" r="8" fill="#f7f4ec"/><rect x="${x - 4}" y="${y - 1.5}" width="3" height="3" fill="#f2b632"/><rect x="${x - 0.5}" y="${y - 3}" width="3" height="3" fill="#e07b2a"/><rect x="${x + 0.5}" y="${y + 0.5}" width="3" height="3" fill="#5aa03a"/><rect x="${x - 3}" y="${y + 1.5}" width="3" height="2.5" fill="#e88aa0"/>`).join('')}${seeds(8, 'kbs', 26)}`,
    fries: `<rect x="14" y="16" width="72" height="68" rx="6" fill="#d2b48a"/><rect x="18" y="20" width="64" height="60" rx="4" fill="#efe1c4"/>${Array.from({ length: 14 }, (_, i) => { const r = seeded('fr' + i); const x = 24 + r() * 46, y = 26 + r() * 44, a = r() * 180; return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="20" height="4.6" rx="1.5" fill="#f0c357" transform="rotate(${a.toFixed(0)} ${(x + 10).toFixed(1)} ${(y + 2).toFixed(1)})"/>`; }).join('')}<path d="M26 40q12-10 22 0t22 0M28 60q12-10 22 0t22 0" fill="none" stroke="#fff3c9" stroke-width="3"/><path d="M38 50l5 2M58 46l4 3M48 64l5-1" stroke="#c4271b" stroke-width="3.5" stroke-linecap="round"/>`,
    omelette: `${plate}${[30, 42, 54, 66].map(x => `<rect x="${x - 5}" y="34" width="11" height="32" rx="4" fill="#f4c64d"/><path d="M${x + .5} 44a3 3 0 1 1-.1 0M${x + .5} 56a3 3 0 1 1-.1 0" fill="none" stroke="#e09a2a" stroke-width="1.2"/>`).join('')}<path d="M26 74l6-4 6 4 6-4 6 4 6-4 6 4 6-4" fill="none" stroke="#c4271b" stroke-width="2.5" stroke-linecap="round"/>`,
    hotteok: `${plate}${[[38, 40], [62, 42], [50, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="#c98a3a"/><circle cx="${x}" cy="${y}" r="12" fill="#dca452"/><circle cx="${x}" cy="${y}" r="5" fill="#7a3f12"/>`).join('')}${seeds(10, 'htt', 22)}`,
    bingsu: `<circle cx="50" cy="50" r="45" fill="#e7eef0"/><circle cx="50" cy="50" r="38" fill="#fafcfd"/><circle cx="50" cy="50" r="30" fill="url(#g-snow)"/>${[[42, 42], [56, 40], [48, 54], [60, 54], [38, 56], [52, 30]].map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="8" rx="1.5" fill="#f5a524" transform="rotate(${(x * 7) % 40} ${x + 4} ${y + 4})"/>`).join('')}<path d="M30 46q10 6 20 0t20 2" fill="none" stroke="#fff6d8" stroke-width="3"/>`,
    soju: `${bottle('#eef7f0')}<path d="M70 70h14l-1.4 18a2 2 0 0 1-2 2h-7.2a2 2 0 0 1-2-2z" fill="#dfeef2" fill-opacity=".7" stroke="#eef4f6"/>`,
    fruitsoju: `${bottle('#ffd0c2', '#e86b5a')}<circle cx="50" cy="63" r="6" fill="#f59a7a"/><path d="M50 57c1-3 4-3 5-2" stroke="#4f9a3a" stroke-width="1.6" fill="none"/>`,
    somaek: `${glass('#f0b232', 26)}<rect x="31" y="18" width="38" height="12" rx="5" fill="#fffaf0"/><path d="M42 40h16l-1.5 22h-13z" fill="#dfeef2" fill-opacity=".8" stroke="#fff" stroke-width="1.2"/>${[48, 58, 70].map((y, i) => `<circle cx="${40 + i * 9}" cy="${y + 10}" r="1.4" fill="#fff6d0"/>`).join('')}`,
    beer: `${glass('#e9a425', 24)}<rect x="31" y="14" width="38" height="14" rx="6" fill="#fffaf0"/>${[44, 60, 74].map((y, i) => `<circle cx="${42 + i * 8}" cy="${y}" r="1.5" fill="#fff6d0"/>`).join('')}<path d="M74 34h6a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6h-8" fill="none" stroke="#e5eef1" stroke-width="3"/>`,
    makgeolli: `<path d="M10 52h80l-6 26a8 8 0 0 1-8 6H24a8 8 0 0 1-8-6z" fill="url(#g-gold)"/><ellipse cx="50" cy="52" rx="40" ry="8" fill="#f3efe3"/><ellipse cx="50" cy="52" rx="34" ry="6" fill="#fffdf6"/><path d="M60 12h14v8l4 6v22H56V26l4-6z" fill="#f6f6f2" stroke="#d6d3c8" stroke-width="1.5"/><rect x="58" y="30" width="18" height="10" fill="#4f9a3a"/>`,
    yuzu: `${glass('#f6cf3a', 30)}${[[40, 40], [54, 46], [44, 58]].map(([x, y]) => `<rect x="${x}" y="${y}" width="11" height="11" rx="2" fill="#fff" fill-opacity=".55"/>`).join('')}<circle cx="70" cy="22" r="10" fill="#f4c21f"/><circle cx="70" cy="22" r="7" fill="#fbe27a"/><path d="M70 15v14M63 22h14" stroke="#f4c21f" stroke-width="1.2"/>`,
    tea: `<path d="M22 34h52v32a14 14 0 0 1-14 14H36a14 14 0 0 1-14-14z" fill="url(#g-steel)"/><ellipse cx="48" cy="34" rx="26" ry="6" fill="#9c6b34"/><path d="M74 42h4a8 8 0 0 1 0 16h-4" fill="none" stroke="#b7bfc4" stroke-width="4"/><path d="M38 24c0-4 4-4 4-8M50 24c0-4 4-4 4-8" stroke="#c9b5a5" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    shot: `<path d="M32 36h36l-3 44a4 4 0 0 1-4 4H39a4 4 0 0 1-4-4z" fill="#dfeef2" fill-opacity=".55" stroke="#eef4f6" stroke-width="2"/><path d="M34.6 50h30.8l-1.9 29a3 3 0 0 1-3 3H39.5a3 3 0 0 1-3-3z" fill="#e8f6ee"/>`,
  };
})();
const art = (kind, cls = '') => `<svg class="art ${cls}" viewBox="0 0 100 100" aria-hidden="true">${ART[kind] || ART.shot}</svg>`;

// ---------- QR codes (qrcode-generator from unpkg; a plain placeholder if it did not load) ----------
function qrSVG(text, { margin = 2, cls = '' } = {}) {
  if (typeof qrcode !== 'function') return `<svg class="qr qr--missing ${cls}" viewBox="0 0 10 10" aria-label="Kod QR"><rect width="10" height="10" fill="#fff"/><text x="5" y="5.8" font-size="2.2" text-anchor="middle" fill="#111">QR</text></svg>`;
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount(), s = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!q.isDark(r, c)) { c++; continue; }
      let w = 1;
      while (c + w < n && q.isDark(r, c + w)) w++;
      d += `M${c + margin} ${r + margin}h${w}v1h-${w}z`;
      c += w;
    }
  }
  return `<svg class="qr ${cls}" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges" role="img" aria-label="Kod QR"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
}

// Keep the focused field, its caret and the marked scroll boxes across a full redraw.
function keepFocus(fn) {
  const a = document.activeElement;
  const id = a && a.id && a.matches('input, textarea, select') ? a.id : null;
  const st = id ? { v: a.value, s: a.selectionStart, e: a.selectionEnd, box: a.type === 'checkbox' || a.type === 'radio' } : null;
  const boxes = $$('[data-scroll]').map(el => [el.dataset.scroll, el.scrollTop, el.scrollHeight - el.scrollTop - el.clientHeight < 60]);
  fn();
  boxes.forEach(([k, top, atEnd]) => {
    const el = $(`[data-scroll="${k}"]`);
    if (el) el.scrollTop = 'stick' in el.dataset && atEnd ? el.scrollHeight : top;
  });
  if (!id) return;
  const n = document.getElementById(id);
  if (!n) return;
  if (!st.box) n.value = st.v;
  n.focus({ preventScroll: true });
  try { if (!st.box) n.setSelectionRange(st.s, st.e); } catch (e) {}
}

// Elapsed-time labels refresh themselves every second, without redrawing the page.
function tickClocks() {
  const now = Date.now();
  $$('[data-since]').forEach(el => {
    const ms = now - +el.dataset.since;
    el.textContent = el.dataset.fmt === 'clock' ? fmtClock(ms) : fmtWait(ms);
    if (el.dataset.warn) el.classList.toggle('is-late', ms > +el.dataset.warn * MIN);
    if (el.dataset.bad) el.classList.toggle('is-bad', ms > +el.dataset.bad * MIN);
  });
}
setInterval(tickClocks, 1000);
// the label stays empty in the markup, so a redraw with the same data produces the same HTML
const since = (ts, { fmt = '', warn, bad } = {}) => `<time data-since="${ts}"${fmt ? ` data-fmt="${fmt}"` : ''}${warn ? ` data-warn="${warn}"` : ''}${bad ? ` data-bad="${bad}"` : ''}></time>`;

// Swap a view's markup only when it actually changed: running animations, hover and the caret survive
// the simulation's frequent writes.
function paint(el, html) {
  if (!el || el.__html === html) return false;
  keepFocus(() => { el.innerHTML = html; });
  el.__html = html;
  tickClocks();
  return true;
}

function download(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
