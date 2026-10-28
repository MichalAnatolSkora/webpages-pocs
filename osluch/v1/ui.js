// Osłuch v1 — shared helpers: DOM, dates, money, storage, icons, illustrated people, modals, toasts and the fake SMS.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const MIN = 60e3, DAY = 864e5;
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0');
const uid = (p = '') => p + Math.random().toString(36).slice(2, 7).toUpperCase();
const digits = n => Array.from({ length: n }, (_, i) => Math.floor(Math.random() * (i ? 10 : 9)) + (i ? 0 : 1)).join('');

const zl = n => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';

function plural(n, one, few, many) {
  if (n === 1) return one;
  const t = n % 10, h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
}
const lata = n => `${n} ${plural(n, 'rok', 'lata', 'lat')}`;
const dni = n => `${n} ${plural(n, 'dzień', 'dni', 'dni')}`;
const opak = n => `${n} ${plural(n, 'opakowanie', 'opakowania', 'opakowań')}`;

// ---------- dates ----------
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return +d; };
const fmtTime = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fmtDMY = ts => { const d = new Date(ts); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
const fmtLong = ts => new Date(ts).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
const isoDay = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return +new Date(y, m - 1, d); };
function fmtDay(ts) {
  const diff = Math.round((startOfDay(ts) - startOfDay(Date.now())) / DAY);
  if (diff === 0) return 'dziś';
  if (diff === 1) return 'jutro';
  if (diff === -1) return 'wczoraj';
  return new Date(ts).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
}
const fmtWhen = ts => `${fmtDay(ts)}, ${fmtTime(ts)}`;
const fmtClock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); };
function fromNow(ts) {
  const m = Math.round((ts - Date.now()) / MIN);
  if (Math.abs(m) < 1) return 'teraz';
  if (m > 0) return m < 60 ? `za ${m} min` : `za ${Math.round(m / 60)} h`;
  return -m < 60 ? `${-m} min temu` : `${Math.round(-m / 60)} h temu`;
}
function ageOf(born) {
  const b = new Date(born), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}
const monthsSince = iso => (Date.now() - fromIso(iso)) / (30.44 * DAY);

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

// ---------- icons ----------
const I = {
  video: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3"/>',
  camOff: '<path d="M9 6h4.5A2.5 2.5 0 0 1 16 8.5v4M16 10.5l5-3v9l-3.4-2M13.5 18H5.5A2.5 2.5 0 0 1 3 15.5v-7c0-.9.4-1.6 1-2.1M3 3l18 18"/>',
  phone: '<path d="M5.2 4h3.3l1.6 4.4-2.1 1.4a11 11 0 0 0 6.2 6.2l1.4-2.1 4.4 1.6v3.3a1.6 1.6 0 0 1-1.7 1.6C10.7 19.9 4.1 13.3 3.6 5.7A1.6 1.6 0 0 1 5.2 4z"/>',
  chat: '<path d="M4 5h16v11H9.5L5 20v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  micOff: '<path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.9 2.3M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.4 12.5c.1-.5.1-1 .1-1.5M12 17.5V21M8.5 21h7M3 3l18 18"/>',
  hang: '<path d="M3 13.6c5-4.8 13-4.8 18 0l-2.4 2.6-3.6-1.4V12a10.6 10.6 0 0 0-6 0v2.8l-3.6 1.4z"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  rx: '<path d="M6 20V4h5.5a4 4 0 0 1 0 8H6M10.5 12l8.5 9M19 13l-7 7"/>',
  pill: '<path d="M10.2 20.2a4.8 4.8 0 0 1-6.8-6.8l6.4-6.4a4.8 4.8 0 0 1 6.8 6.8z"/><path d="M6.6 10.2l6.8 6.8"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14a6.5 6.5 0 0 1 4 6"/>',
  spark: '<path d="M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
  thermo: '<path d="M10 4.5a2 2 0 0 1 4 0V14a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
  drop: '<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  skip: '<path d="M5 5l9 7-9 7zM18 5v14"/>',
  restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4v4.5H9"/>',
  stetho: '<path d="M6 3v6a5 5 0 0 0 10 0V3"/><path d="M11 14v1.5a4.5 4.5 0 0 0 9 0V13"/><circle cx="20" cy="11" r="2"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  logout: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  quote: '<path d="M7 17c-2 0-3-1.5-3-3.5C4 10 6 7.5 9 7M17 17c-2 0-3-1.5-3-3.5C14 10 16 7.5 19 7"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
  bed: '<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
  home: '<path d="M4 11l8-7 8 7M6 9.5V20h12V9.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.5"/><path d="M10 9.5a2 2 0 0 1 4 0c0 1.2-1.2 1.6-1.2 2.8"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  bank: '<path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9zM12 9c2-4 6-4 6-1.5S14 9 12 9z"/>',
  sms: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  barcode: '<path d="M4 5v14M7 5v14M9.5 5v14M13 5v14M15.5 5v14M18 5v14M20 5v14"/>',
};
const ic = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name] || ''}</svg>`;

// ---------- illustrated people ----------
// Flat faces for avatars and the simulated video feeds. Colours belong to the person, not the theme,
// so somebody looks the same in light and dark mode. Drawn in a 100×100 box, shoulders at the bottom.
const HAIR = {
  short: { front: 'M32.5 41c-.5-15 8-23.5 17.8-23.5 10.2 0 18 7.5 17.4 22.5-3.2-7.5-9-11.5-17.6-11.5-8.5 0-14.6 4.3-17.6 12.5z' },
  bob: {
    back: 'M30 47c-2.5-20 7.5-31 20-31s23 10 20 32l1.5 14c-5 2.5-9.5-.5-10.5-5H39c-1 4.5-5.5 7.5-10.5 5z',
    front: 'M33 40c.5-13.5 8.5-20 18-20 10 0 16.5 7 16.5 17.5-8-6-19-7-26.5-2.5-3.2 1.5-5.8 3-8 5z',
  },
  long: {
    back: 'M29 48c-3-22 8-32.5 21-32.5S74 26 71 48l2.5 27c-7 3-13.5-.5-14.5-6.5H41c-1 6-7.5 9.5-14.5 6.5z',
    front: 'M33 40c.5-13.5 8.5-20 18-20 10 0 16.5 7 16.5 17.5-8-6-19-7-26.5-2.5-3.2 1.5-5.8 3-8 5z',
  },
  bun: {
    back: 'M42.5 16a7.5 7.5 0 1 0 15 0 7.5 7.5 0 1 0-15 0z',
    front: 'M33 41c0-14 7.5-21.5 17-21.5S67.5 27 67 41c-3.5-8.5-9.5-12.5-17-12.5S36.5 32.5 33 41z',
  },
  grey: { front: 'M32.6 46c-1.6-7-.8-12 1.6-15.5 1.4 4.5 2 8.5 1.8 13.5zM67.4 46c1.6-7 .8-12-1.6-15.5-1.4 4.5-2 8.5-1.8 13.5zM40 23.5c6-3 14-3 20 0-6-1.2-14-1.2-20 0z' },
  curly: { front: 'M32.5 40a6 6 0 0 1 5-9.5 7 7 0 0 1 11.5-6 7 7 0 0 1 11.5 3.5 6.5 6.5 0 0 1 7 11c-5-6-11.5-8.5-17.5-8.5s-12.5 3-17.5 9.5z' },
};

function personSvg(p, { coat = false } = {}) {
  const a = p.av, h = HAIR[a.hair] || HAIR.short;
  const coatParts = coat
    ? `<path d="M42 72.5l8 15 8-15z" fill="${a.shirt}"/><path d="M42 72.5l-6 27.5M58 72.5l6 27.5" stroke="#d6d8d2" stroke-width="1.4" fill="none"/>
       <path d="M38 75c-3.5 9-.5 17.5 6.5 17.5" stroke="#34444c" stroke-width="1.9" fill="none" stroke-linecap="round"/><circle cx="44.5" cy="92.5" r="2.7" fill="#8e9ca4"/>`
    : `<path d="M43 72.5q7 6 14 0" stroke="rgba(0,0,0,.14)" stroke-width="2" fill="none"/>`;
  return `
    ${h.back ? `<path d="${h.back}" fill="${a.hairColor}"/>` : ''}
    <path d="M14 101c2-19.5 16.5-29 36-29s34 9.5 36 29z" fill="${coat ? '#f4f4f0' : a.shirt}"/>
    ${coatParts}
    <rect x="43.5" y="57" width="13" height="17" rx="5" fill="${a.skin2}"/>
    <ellipse cx="33.3" cy="45" rx="3" ry="4.3" fill="${a.skin2}"/><ellipse cx="66.7" cy="45" rx="3" ry="4.3" fill="${a.skin2}"/>
    <ellipse cx="50" cy="42" rx="17" ry="20" fill="${a.skin}"/>
    ${a.beard ? `<path d="M34 46c1 11 7.5 16 16 16s15-5 16-16c-2.5 5-6.5 6.5-9.5 5.5-2-.8-4-1.3-6.5-1.3s-4.5.5-6.5 1.3c-3 1-7-.5-9.5-5.5z" fill="${a.hairColor}" opacity=".9"/>` : ''}
    <path d="${h.front}" fill="${a.hairColor}"/>
    <path d="M40.5 37.2h5.6M53.9 37.2h5.6" stroke="${a.hairColor === '#9aa0a3' ? '#6f7578' : a.hairColor}" stroke-width="1.7" stroke-linecap="round"/>
    <ellipse cx="39.5" cy="49" rx="3.2" ry="1.9" fill="#e5806b" opacity=".18"/><ellipse cx="60.5" cy="49" rx="3.2" ry="1.9" fill="#e5806b" opacity=".18"/>
    <g class="eyes"><ellipse cx="43.3" cy="43" rx="1.7" ry="2.1" fill="#1d2321"/><ellipse cx="56.7" cy="43" rx="1.7" ry="2.1" fill="#1d2321"/></g>
    ${a.glasses ? `<g fill="none" stroke="#2a3236" stroke-width="1.3"><rect x="37.8" y="39" width="10.8" height="8.2" rx="3.2"/><rect x="51.4" y="39" width="10.8" height="8.2" rx="3.2"/><path d="M48.6 42.4h2.8"/></g>` : ''}
    <path d="M49.5 46q1.3 3.6-1.3 4.1" stroke="${a.skin2}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <ellipse class="mouth" cx="50" cy="54" rx="4" ry="1.35" fill="#8a3f37"/>`;
}

function avatar(p, size = 40, cls = '') {
  return `<span class="av ${cls}" style="--s:${size}px;background:${p.av.bg}" aria-hidden="true"><svg viewBox="6 10 88 88">${personSvg(p, { coat: !!p.pwz })}</svg></span>`;
}

// A simulated camera picture: the person in front of a room that says who they are.
function feedSvg(p, role) {
  const room = role === 'doctor'
    ? `<rect width="160" height="100" fill="#e7eeeb"/><rect y="78" width="160" height="22" fill="#d9e3df"/>
       <rect x="14" y="16" width="24" height="17" rx="1.5" fill="#fff" stroke="#c9d2ce"/><path d="M18 21h16M18 25h12M18 29h9" stroke="#c9d2ce" stroke-width="1.2"/>
       <rect x="112" y="42" width="40" height="2.5" fill="#bccac4"/>
       <rect x="115" y="29" width="4" height="13" fill="#6d8f86"/><rect x="120" y="31" width="3.5" height="11" fill="#c08a6a"/><rect x="124.5" y="27" width="4.5" height="15" fill="#4c6a78"/><rect x="130" y="32" width="3" height="10" fill="#d3b26b"/>
       <path d="M141 42c-3-6-1-12 2-14 1 4 0 9-2 14zM144 42c1-7 5-10 8-10-1 4-4 8-8 10zM142 42c-5-3-7-8-6-11 3 1 6 5 6 11z" fill="#5d8f6f"/>
       <rect x="139" y="42" width="8" height="1" fill="#bccac4"/>`
    : `<rect width="160" height="100" fill="#f1e5d8"/><rect y="80" width="160" height="20" fill="#e6d6c4"/>
       <rect x="12" y="12" width="30" height="40" rx="2" fill="#cfe3ee"/><path d="M27 12v40M12 32h30" stroke="#fff" stroke-width="2"/><rect x="12" y="12" width="30" height="40" rx="2" fill="none" stroke="#e0cdb8" stroke-width="2"/>
       <path d="M9 10c4 10 4 32 0 46h-3V10z" fill="#d89a7a"/>
       <rect x="120" y="20" width="22" height="16" rx="1.5" fill="#fff" stroke="#e0cdb8" stroke-width="1.5"/><path d="M123 33l6-7 4 4 3-3 4 6z" fill="#e7b58f"/>
       <path d="M138 80V58M131 58h14l-3-9h-8z" stroke="#b8a48f" stroke-width="1.5" fill="#f6efe4"/>`;
  return `<svg class="feed__svg" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${room}<g class="feed__person" transform="translate(30 7)">${personSvg(p, { coat: role === 'doctor' })}</g></svg>`;
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
  return { el: panel, close, get closed() { return closed; } };
}

function confirmBox({ title, body, ok = 'Potwierdź', cancel = 'Anuluj', danger = false }) {
  return new Promise(resolve => {
    const m = modal({
      label: title,
      html: `<div class="modal__body"><h2 class="modal__title">${esc(title)}</h2><div class="modal__text">${body}</div>
        <div class="modal__actions"><button type="button" class="btn btn--ghost" data-close>${esc(cancel)}</button>
        <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-ok>${esc(ok)}</button></div></div>`,
      onClose: r => resolve(r === true),
    });
    $('[data-ok]', m.el).addEventListener('click', () => m.close(true));
  });
}

// ---------- toast ----------
function toast(msg, icon = 'check', tone = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + (tone ? 'toast--' + tone : '');
  t.innerHTML = `${icon ? ic(icon) : ''}<span>${msg}</span>`;
  $('#toasts').append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => {
    t.classList.remove('is-in');
    setTimeout(() => t.remove(), 300);
  }, 4200);
}

// ---------- phone notification (fake SMS / push) ----------
function notify({ app = 'Wiadomości', title, body, onTap, icon = 'sms' }) {
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

// A fake barcode for the pharmacy printout: stable for a given string, not a real symbology.
function barcodeSvg(str, h = 46) {
  let x = 0, bars = '';
  const seq = [...String(str)].flatMap(ch => { const n = ch.charCodeAt(0); return [1 + (n % 3), 1 + ((n >> 2) % 2), 1 + ((n >> 1) % 3), 1 + (n % 2)]; });
  seq.unshift(2, 1, 1, 1);
  seq.push(2, 1, 1, 2);
  seq.forEach((w, i) => { if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${h}"/>`; x += w; });
  return `<svg class="barcode" viewBox="0 0 ${x} ${h}" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
}

const groupDigits = (s, n = 4) => String(s).replace(new RegExp(`(.{${n}})(?=.)`, 'g'), '$1 ');
