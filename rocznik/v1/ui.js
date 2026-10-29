// Rocznik v1 — shared UI: DOM helpers, storage, icons, toasts, modal, tooltips and the SVG charts.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('rocznik-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rocznik-' + k, JSON.stringify(v)); } catch (e) {} },
};

// ---------- icons ----------
const ICONS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  alert: '<path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  octagon: '<path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z"/><path d="M12 7.5v5.5M12 16.3v.3"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  'bell-on': '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/><path d="M3.5 7.5A9 9 0 0 1 6.5 3.5M20.5 7.5a9 9 0 0 0-3-4"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  'file-code': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M10 12l-2 2 2 2M14 12l2 2-2 2"/>',
  'file-text': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15h6M9 18h4"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M4 19.5h16"/>',
  printer: '<path d="M7 9V3.5h10V9M7 17H4.5V10a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v7H17"/><path d="M7 14h10v6.5H7z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M11 7.3L6.2 15.8M13 7.3l4.8 8.5M7.5 18h9"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  trend: '<path d="M3 17l6-6 4 4 7-7M15 8h5v5"/>',
  'trend-down': '<path d="M3 7l6 6 4-4 7 7M15 16h5v-5"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.7-2.7-3-6-3"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  scale: '<path d="M12 4v16M7 20h10M4 8h16M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  skull: '<path d="M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/><path d="M10 20v-2M14 20v-2"/>',
  database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12.5 15H17"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M10 10h4v4h-4zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
  sparkle: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8zM18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  zap: '<path d="M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3M8 7h8M8 10.5h5"/>',
  gauge: '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="M12 13l4-4.5"/><circle cx="12" cy="13.5" r="1.4"/>',
};
const icon = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.info}</svg>`;

// ---------- toasts ----------
function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.innerHTML = `${icon(kind === 'warn' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('is-out'), 2800);
  setTimeout(() => el.remove(), 3200);
}

// ---------- modal ----------
let _modalReturn = null;
function openModal(html, { wide = false, label = 'Okno' } = {}) {
  closeModal(true);
  _modalReturn = document.activeElement;
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(label)}">
    <div class="modal__backdrop" data-act="modal-close"></div>
    <div class="modal__box${wide ? ' modal__box--wide' : ''}" tabindex="-1">
      <button type="button" class="icon-btn modal__x" data-act="modal-close" aria-label="Zamknij">${icon('x')}</button>
      ${html}
    </div>
  </div>`;
  document.body.classList.add('has-modal');
  $('.modal__box', root).focus();
}
function closeModal(silent) {
  const root = $('#modalRoot');
  if (!root || !root.innerHTML) return;
  root.innerHTML = '';
  document.body.classList.remove('has-modal');
  if (!silent && _modalReturn && _modalReturn.focus) _modalReturn.focus();
}

// ---------- tooltips: any element with data-tip (HTML, already escaped by the caller) ----------
(function tooltips() {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(tip));
  let cur = null;
  const place = e => {
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > innerWidth - 8) x = e.clientX - w - pad;
    if (y + h > innerHeight - 8) y = e.clientY - h - pad;
    tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  };
  document.addEventListener('pointermove', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { if (cur) { cur.classList.remove('is-tip'); cur = null; tip.hidden = true; } return; }
    if (t !== cur) {
      if (cur) cur.classList.remove('is-tip');
      cur = t;
      t.classList.add('is-tip');
      tip.innerHTML = t.dataset.tip;
      tip.hidden = false;
    }
    place(e);
  });
  document.addEventListener('scroll', () => { if (cur) { cur.classList.remove('is-tip'); cur = null; tip.hidden = true; } }, { passive: true });
})();

// ---------- number helpers for charts ----------
function niceStep(range, n) {
  const raw = range / Math.max(1, n);
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const k = raw / p;
  return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 2.5 ? 2.5 : k <= 5 ? 5 : 10) * p;
}
function fmtCompact(v) {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e9) return s + (a / 1e9).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + ' mld';
  if (a >= 1e6) return s + (a / 1e6).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + ' mln';
  if (a >= 1e3) return s + (a / 1e3).toLocaleString('pl-PL', { maximumFractionDigits: 0 }) + ' tys.';
  return s + num(Math.round(a));
}

// ---------- column chart (one series, negatives drop below the baseline) ----------
// data: [{ x, v, est, tip }]
function columnChart(data, { h = 220, fmt = fmtCompact, label = '' } = {}) {
  const W = 640, padL = 56, padR = 10, padT = 18, padB = 28;
  const vals = data.map(d => d.v).filter(v => v != null);
  const lo0 = Math.min(0, ...vals), hi0 = Math.max(0, ...vals);
  const step = niceStep(hi0 - lo0 || 1, 4);
  const lo = Math.floor(lo0 / step) * step, hi = Math.ceil(hi0 / step) * step || step;
  const y = v => padT + (hi - v) / (hi - lo) * (h - padT - padB);
  const band = (W - padL - padR) / data.length;
  const bw = Math.min(28, band * 0.56);
  const ticks = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(t);
  const r = 1.5;
  const bar = (x0, v) => {
    const y0 = y(0), y1 = y(v), top = Math.min(y0, y1), ht = Math.abs(y1 - y0);
    if (ht < 1) return `M${x0} ${y0 - 0.5}h${bw}v1h${-bw}z`;
    const rr = Math.min(r, ht);
    return v >= 0
      ? `M${x0} ${y0}V${top + rr}Q${x0} ${top} ${x0 + rr} ${top}H${x0 + bw - rr}Q${x0 + bw} ${top} ${x0 + bw} ${top + rr}V${y0}z`
      : `M${x0} ${y0}V${top + ht - rr}Q${x0} ${top + ht} ${x0 + rr} ${top + ht}H${x0 + bw - rr}Q${x0 + bw} ${top + ht} ${x0 + bw} ${top + ht - rr}V${y0}z`;
  };
  const last = data.length - 1;
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}">
    <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="hatch-bg"/><path d="M0 0v6" class="hatch-ln"/></pattern></defs>
    ${ticks.map(t => `<line class="grid${t === 0 ? ' grid--zero' : ''}" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
    ${data.map((d, i) => {
      const x0 = padL + band * i + (band - bw) / 2;
      const cls = d.v == null ? '' : d.v < 0 ? 'col col--neg' : 'col';
      return `<g class="colg" data-tip="${esc(d.tip || '')}">
        <rect class="hit" x="${padL + band * i}" y="${padT}" width="${band}" height="${h - padT - padB + 4}"/>
        ${d.v == null ? `<text class="tick tick--na" x="${x0 + bw / 2}" y="${y(0) - 6}" text-anchor="middle">brak</text>` : `<path class="${cls}${d.est ? ' col--est' : ''}" d="${bar(x0, d.v)}"/>`}
        ${i === last && d.v != null ? `<text class="val" x="${x0 + bw / 2}" y="${d.v >= 0 ? y(d.v) - 6 : y(d.v) + 14}" text-anchor="middle">${fmt(d.v)}</text>` : ''}
        <text class="tick" x="${x0 + bw / 2}" y="${h - 8}" text-anchor="middle">${d.x}</text>
      </g>`;
    }).join('')}
  </svg>`;
}

// ---------- sparkline ----------
function sparkline(vals, { w = 96, h = 28, neg = false } = {}) {
  const v = vals.filter(x => x != null);
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = vals.map((x, i) => x == null ? null : [2 + i * (w - 6) / (vals.length - 1), 3 + (hi - x) / span * (h - 6)]).filter(Boolean);
  const lp = pts[pts.length - 1];
  const zero = lo < 0 && hi > 0 ? `<line class="spark-zero" x1="0" x2="${w}" y1="${3 + hi / span * (h - 6)}" y2="${3 + hi / span * (h - 6)}"/>` : '';
  return `<svg class="spark${neg ? ' spark--neg' : ''}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${zero}<polyline points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"/><circle cx="${lp[0]}" cy="${lp[1]}" r="2.6"/></svg>`;
}

// ---------- line chart (shared x, up to 3 series, % scale); hit columns carry the tooltip ----------
// series: [{ name, cls, vals }], xs: labels
function lineChart(xs, series, { h = 240, fmt = v => Math.round(v) + '%', max = 100, marks = [], label = '' } = {}) {
  const W = 640, padL = 44, padR = 16, padT = 14, padB = 30;
  const x = i => padL + i * (W - padL - padR) / (xs.length - 1);
  const y = v => padT + (max - v) / max * (h - padT - padB);
  const ticks = [0, 25, 50, 75, 100].map(t => t * max / 100);
  const colW = (W - padL - padR) / (xs.length - 1);
  return `<svg class="chart chart--line" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}">
    ${marks.map(m => `<rect class="band" x="${x(m.from)}" y="${padT}" width="${x(m.to) - x(m.from)}" height="${h - padT - padB}"/><text class="tick tick--band" x="${(x(m.from) + x(m.to)) / 2}" y="${padT + 12}" text-anchor="middle">${esc(m.label)}</text>`).join('')}
    ${ticks.map(t => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
    ${series.map(s => `<polyline class="ln ${s.cls}" points="${s.vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`).join('')}
    ${series.map(s => { const i = s.vals.length - 1; return `<circle class="dot ${s.cls}" cx="${x(i)}" cy="${y(s.vals[i])}" r="4.5"/>`; }).join('')}
    ${xs.map((lab, i) => `<g class="lcol" data-tip="${esc(`<b>${lab}</b>` + series.map(s => `<br><span class="tip-key ${s.cls}"></span>${s.name}: ${fmt(s.vals[i])}`).join(''))}"><rect class="hit" x="${x(i) - colW / 2}" y="${padT}" width="${colW}" height="${h - padT - padB}"/><line class="guide" x1="${x(i)}" x2="${x(i)}" y1="${padT}" y2="${h - padB}"/>${i % 2 === 0 ? `<text class="tick" x="${x(i)}" y="${h - 10}" text-anchor="middle">${lab}</text>` : ''}</g>`).join('')}
  </svg>`;
}

// ---------- misc ----------
function copyText(t) {
  try { navigator.clipboard.writeText(t).then(() => toast('Skopiowano: ' + t)); } catch (e) { toast('Nie udało się skopiować', 'warn'); }
}
const kbytes = b => b >= 1048576 ? (b / 1048576).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + ' MB' : Math.round(b / 1024) + ' kB';
const daysAgo = d => { const n = Math.round((TODAY - d) / DAY); return n <= 0 ? 'dziś' : n === 1 ? 'wczoraj' : `${n} dni temu`; };

// ---------- delegated handlers: modules register by name, app.js wires the listeners ----------
const ACTIONS = { 'modal-close': () => closeModal() };
const CHANGES = {};
const INPUTS = {};
