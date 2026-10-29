// Rocznik v2 — app: hash router, the workbook chrome (row numbers, column letters, sheet tabs, status bar),
// cell selection with the name box and formula bar, row snapping, theme and the delegated event wiring.

const $app = $('#app');
const $sheet = $('#sheet');
const LOGO_SVG = `<span class="logo logo--sm" aria-hidden="true"><svg class="logo__mark" viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="currentColor"/><path d="M8.5 3.5v17M15.5 3.5v17M3.5 9h17M3.5 15h17" stroke="#fff" stroke-width="1.4" opacity=".5"/><rect x="8.5" y="9" width="7" height="6" fill="#fff"/></svg><span class="logo__word">Rocznik</span></span>`;
const HOME_ROUTES = ['cennik', 'faq', 'zrodla', 'wczoraj', 'zestawienia'];
let LAST_ROUTE = null;

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

function route(keepScroll) {
  const { parts, params } = parseHash();
  const [p0, p1, p2] = parts;
  let html, title = 'Rocznik · wyniki finansowe spółek z KRS', key = parts.join('/'), scrollTo = null, nav = '', tab = 'Arkusz1', doc = 'rocznik.example';
  if (p0 !== 'silnik') engineLeave();
  document.body.classList.toggle('is-engine', p0 === 'silnik');
  document.body.classList.toggle('is-report', p0 === 'raport');
  document.body.classList.toggle('is-home', !p0 || HOME_ROUTES.includes(p0));

  if (!p0 || HOME_ROUTES.includes(p0)) { html = renderHome(); key = 'home'; scrollTo = p0 || null; nav = p0 === 'cennik' ? 'cennik' : 'home'; }
  else if (p0 === 'szukaj') { html = renderSearch(params.q || ''); title = `Szukaj: ${params.q || ''} · Rocznik`; tab = 'Wyniki wyszukiwania'; doc += '/szukaj'; }
  else if (p0 === 'firma') {
    const krs = (p1 || '').slice(0, 10);
    key = 'firma/' + krs;
    scrollTo = p2 || null;
    // same company, different section: just scroll
    if (!keepScroll && LAST_ROUTE === key && $('.co')) { scrollToSec(scrollTo || 'top'); return; }
    html = renderCompany(krs);
    const c = BY_KRS.get(krs);
    if (c) { title = `${c.fullName}: sprawozdania finansowe, KRS ${c.krs} · Rocznik`; doc = seoUrl(c); }
  }
  else if (p0 === 'ranking') { html = renderRanking(params); title = 'Rankingi spółek · Rocznik'; nav = 'ranking'; tab = 'Ranking'; doc += '/ranking'; }
  else if (p0 === 'obserwowane') { html = renderWatch(); title = 'Obserwowane · Rocznik'; nav = 'obserwowane'; tab = 'Obserwowane'; doc += '/obserwowane'; }
  else if (p0 === 'raport') { html = renderReport(p1); const c = BY_KRS.get(p1); if (c) title = `Raport: ${c.fullName}`; tab = 'Raport PDF'; doc += `/raport/${p1}.pdf`; }
  else if (p0 === 'silnik') { html = renderEngine(p1 || '', params); title = 'Maszynownia · Rocznik'; nav = 'silnik'; doc = 'rocznik.internal/silnik' + (p1 ? '/' + p1 : ''); }
  else { html = `<section class="wrap page"><h1 class="h1">#ADR! Nie ma takiej strony</h1><p><a class="btn" href="#/">Strona główna</a></p></section>`; }

  const sameView = keepScroll && LAST_ROUTE === key;
  const y = scrollY;
  $app.innerHTML = html;
  LAST_ROUTE = key;
  document.title = title;
  $$('[data-nav]').forEach(a => a.classList.toggle('is-on', a.dataset.nav === nav));
  $('#sheetTabs').innerHTML = sheetTabs(p0, p1, tab);
  $('#docName').textContent = doc;
  updateWatchCount();
  if (!sameView) clearSel();
  snapAll();
  if (sameView) { window.scrollTo(0, y); placeSel(); }
  else if (scrollTo) requestAnimationFrame(() => scrollToSec(scrollTo, true));
  else window.scrollTo(0, 0);
  spy();
  if (!keepScroll) $app.focus({ preventScroll: true });
}
function rerender() { route(true); }

// the part of the header that stays on screen (on phones the ribbon scrolls away)
function headOffset() {
  const h = $('#xlHead');
  return h.offsetHeight + Math.min(0, parseFloat(getComputedStyle(h).top) || 0);
}
function scrollToSec(id, instant) {
  if (id === 'top') { window.scrollTo({ top: 0, behavior: REDUCED || instant ? 'auto' : 'smooth' }); return; }
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - headOffset(), behavior: REDUCED || instant ? 'auto' : 'smooth' });
}

// ---------- sheet tabs: sections of the page, engine pages, or one tab named after the page ----------
const HOME_SECS = [['top', 'Start'], ['wczoraj', 'Wczoraj w KRS'], ['zestawienia', `Rankingi ${LAST_FY}`], ['zrodla', 'Źródła'], ['cennik', 'Cennik'], ['faq', 'Pytania']];
const CO_SECS = [['przeglad', 'Przegląd'], ['finanse', 'Finanse'], ['ryzyko', 'Ryzyko'], ['dokumenty', 'Dokumenty'], ['krs', 'KRS'], ['powiazania', 'Powiązania'], ['podobne', 'Podobne']];
function sheetTabs(p0, p1, title) {
  let tabs;
  if (p0 === 'firma' && $('.co')) tabs = CO_SECS.filter(([id]) => document.getElementById(id)).map(([id, l]) => `<a class="stab" href="#/firma/${CUR.krs}/${id}" data-scrollto="${id}">${l}</a>`);
  else if (!p0 || HOME_ROUTES.includes(p0)) tabs = HOME_SECS.map(([id, l]) => `<a class="stab" href="#/${id === 'top' ? '' : id}" data-scrollto="${id}">${l}</a>`);
  else if (p0 === 'silnik') { const cur = ENG_PAGES.some(p => p[0] === (p1 || '')) ? (p1 || '') : ''; tabs = ENG_PAGES.map(([k, l]) => `<a class="stab${k === cur ? ' is-on' : ''}" href="#/silnik${k ? '/' + k : ''}"${k === cur ? ' aria-current="page"' : ''}>${l}</a>`); }
  else tabs = [`<span class="stab is-on">${esc(title)}</span>`];
  return `<div class="sheettabs__in">${tabs.join('')}</div><button type="button" class="sheettabs__add" data-act="sheet-add" aria-label="Nowy arkusz">${icon('plus')}</button>`;
}
ACTIONS['sheet-add'] = () => toast('Makieta: własne arkusze z eksportem do XLSX będą w planie Pro');

// mark the sheet tab of the section in view
let _spyRaf = 0;
function spy() {
  const links = $$('#sheetTabs a[data-scrollto]');
  if (!links.length) return;
  const off = headOffset() + 60;
  let cur = links[0].dataset.scrollto;
  for (const a of links) { const s = document.getElementById(a.dataset.scrollto); if (s && s.getBoundingClientRect().top - off <= 0) cur = a.dataset.scrollto; }
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = links[links.length - 1].dataset.scrollto;
  links.forEach(a => { const on = a.dataset.scrollto === cur; a.classList.toggle('is-on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  const on = links.find(a => a.classList.contains('is-on'));
  const strip = on && on.parentElement;
  if (strip && (on.offsetLeft < strip.scrollLeft || on.offsetLeft + on.offsetWidth > strip.scrollLeft + strip.clientWidth)) strip.scrollLeft = on.offsetLeft - 20;
}
addEventListener('scroll', () => { cancelAnimationFrame(_spyRaf); _spyRaf = requestAnimationFrame(spy); }, { passive: true });

// ---------- the grid: column letters, row numbers, blocks snapped to whole rows ----------
const RH = 24;
const COLS = Array.from({ length: 40 }, (_, i) => i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(39 + i));
$('#colHead').innerHTML = COLS.map(c => `<span>${c}</span>`).join('');
let GEO = { g: 46, cw: 104 };
function measure() {
  const root = document.documentElement, cs = getComputedStyle(root);
  const ncol = parseFloat(cs.getPropertyValue('--ncol')) || 14, g = parseFloat(cs.getPropertyValue('--g')) || 46;
  const cw = Math.floor(Math.min(ncol > 4 ? 112 : 400, (root.clientWidth - g) / ncol));
  root.style.setProperty('--cw', cw + 'px');
  GEO = { g, cw };
}
const GRIDS = '.hero__in, .statband__in, .grid2, .grid3, .kpis, .ov-grid, .risk-grid, .krs-grid, .lanes, .delta-grid, .pz-grid, .watch-grid, .plans, .sources, .stat-row, .tables, .similar, .co-head, .eng-top__in';
const SNAP_SEL = `:is(.section, .page, .co-sec, .eng-main, #finCard, #pzOut, .co-top, .co-body, .statband, .eng-top) > *, :is(${GRIDS}) > *, .watch-grid > div > *, #app > *, .site-footer`;
let ROWS_N = 0;
function snapAll() {
  const els = $$(SNAP_SEL, $sheet).filter(e => !e.parentElement.closest('.card'));
  for (const e of els) e.style.minHeight = '';
  const hs = els.map(e => e.getBoundingClientRect().height);
  els.forEach((e, i) => { const s = Math.ceil(hs[i] / RH - 0.02) * RH; if (s - hs[i] > 0.5) e.style.minHeight = s + 'px'; });
  const n = Math.ceil($sheet.offsetHeight / RH);
  if (n !== ROWS_N) { ROWS_N = n; $('#rowNumsN').textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); }
}
let _snapRaf = 0;
const snapSoon = () => { cancelAnimationFrame(_snapRaf); _snapRaf = requestAnimationFrame(() => { snapAll(); placeSel(); }); };
new ResizeObserver(snapSoon).observe($app);
addEventListener('resize', () => { measure(); snapSoon(); });
if (document.fonts) document.fonts.ready.then(snapSoon);

// ---------- selection: green frame, name box, formula bar, sums in the status bar ----------
let SEL = null;   // { mode: 'cell' | 'row', els } or { mode: 'grid', gc, gr }
const colName = i => COLS[Math.max(0, Math.min(COLS.length - 1, i))];
function gridPos(x, y) { return [Math.floor((x - GEO.g) / GEO.cw), Math.floor(y / RH) + 1]; }
function selRect() {
  if (SEL.mode === 'grid') return { l: GEO.g + SEL.gc * GEO.cw, t: (SEL.gr - 1) * RH, r: GEO.g + (SEL.gc + 1) * GEO.cw, b: SEL.gr * RH };
  const s = $sheet.getBoundingClientRect();
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const e of SEL.els) { const q = e.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
  return { l: l - s.left, t: t - s.top, r: r - s.left, b: b - s.top };
}
function placeSel() {
  const box = $('#selBox');
  if (SEL && SEL.els && !SEL.els.every(e => e.isConnected && e.offsetParent)) SEL = null;
  if (!SEL) {
    box.hidden = true; $('#rowHl').hidden = true;
    $$('#colHead span.is-sel').forEach(s => s.classList.remove('is-sel'));
    return;
  }
  const q = selRect();
  Object.assign(box.style, { left: q.l - 1 + 'px', top: q.t - 1 + 'px', width: q.r - q.l + 2 + 'px', height: q.b - q.t + 2 + 'px' });
  box.hidden = false;
  box.classList.toggle('is-range', SEL.mode === 'row');
  const [c0, r0] = gridPos(q.l + 1, q.t + 1), [c1, r1] = gridPos(q.r - 2, q.b - 2);
  $('#nameBox').textContent = c0 === c1 && r0 === r1 ? `${colName(c0)}${r0}` : `${colName(c0)}${r0}:${colName(c1)}${r1}`;
  $$('#colHead span').forEach((s, i) => s.classList.toggle('is-sel', i >= c0 && i <= c1));
  const hl = $('#rowHl');
  hl.hidden = false; hl.style.top = (r0 - 1) * RH + 'px'; hl.style.height = (r1 - r0 + 1) * RH + 'px';
}
function clearSel() { SEL = null; placeSel(); showFormula(null); sbCalc([], 0); $('#nameBox').textContent = 'A1'; }

function hlFormula(f) {
  return esc(f).replace(/(&quot;.*?&quot;)|([A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ0-9_.]*)(?=\()|\b([A-Z]{2}(?:\.[A-Z0-9]+)+)\b|(\b\d+(?:[.,]\d+)?\b)/g,
    (m, s, fn, ref, n) => s ? `<span class="f-s">${s}</span>` : fn ? `<span class="f-fn">${fn}</span>` : ref ? `<span class="f-r">${ref}</span>` : `<span class="f-n">${n}</span>`);
}
function showFormula(f, src) {
  const b = $('#fbFormula');
  if (!b) return;
  if (f == null || f === '') { b.hidden = true; b.innerHTML = ''; return; }
  b.innerHTML = `<span class="fbar__f">${hlFormula(f)}</span>${src ? `<span class="fbar__src">${esc(src)}</span>` : ''}`;
  b.title = src ? `${f}\n${src}` : f;
  b.hidden = false;
}
function sbCalc(vals, count) {
  const el = $('#sbCalc');
  if (count < 2) { el.innerHTML = ''; return; }
  if (!vals.length) { el.innerHTML = `<span>Licznik: <b>${count}</b></span>`; return; }
  const sum = vals.reduce((a, b) => a + b, 0);
  el.innerHTML = `<span>Średnia: <b>${fmtMoney(sum / vals.length)}</b></span><span>Licznik: <b>${count}</b></span><span>Suma: <b>${fmtMoney(sum)}</b></span>`;
}
const cellText = e => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 240);
const numOf = e => e.dataset.v != null && e.dataset.v !== '' && Number.isFinite(+e.dataset.v) ? +e.dataset.v : null;
function selectEls(els, mode = 'cell') {
  SEL = { mode, els };
  placeSel();
  const e = els[0];
  showFormula(e.dataset.f || cellText(e), e.dataset.src || '');
  sbCalc(els.map(numOf).filter(v => v != null), els.length);
}
function selectGrid(gc, gr) {
  SEL = { mode: 'grid', gc: Math.max(0, gc), gr: Math.max(1, gr) };
  placeSel(); showFormula(null); sbCalc([], 1);
}
function setStatus(t, busy) { const s = $('#sbState'); s.textContent = t; s.classList.toggle('is-busy', !!busy); }

const SEL_SKIP = 'a, button, input, select, textarea, label, summary, .ac, .modal';
document.addEventListener('click', e => {
  if (!e.target.closest('#sheet') || e.target.closest(SEL_SKIP)) return;
  const rowTh = e.target.closest('table.fin tbody tr:not(.t-group) > th[scope="row"]');
  if (rowTh) {
    const tds = $$('td', rowTh.parentElement).filter(td => !td.matches('.t-yoy, .t-code'));
    if (tds.length) { selectEls(tds, 'row'); return; }
  }
  const cell = e.target.closest('[data-f], td, th');
  if (cell && !cell.closest('.code, .xml__body')) { selectEls([cell]); return; }
  if (!e.target.closest('.card, svg, .code, .pill, .stamp, .ai, .stat, .source, .faq, .results, .docs, .alerts, .flow')) {
    const s = $sheet.getBoundingClientRect();
    const [gc, gr] = gridPos(e.clientX - s.left, e.clientY - s.top);
    if (gc >= 0) selectGrid(gc, gr);
  }
});
document.addEventListener('keydown', e => {
  if (!SEL || e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('input, select, textarea, .modal'))) return;
  if (e.key === 'Escape') { clearSel(); return; }
  if (!e.key.startsWith('Arrow')) return;
  const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
  if (SEL.mode === 'grid') { e.preventDefault(); selectGrid(SEL.gc + dx, SEL.gr + dy); return; }
  const c = SEL.els[0];
  if (!c.matches('td, th')) return;
  const tr = c.parentElement, rows = $$('tr', c.closest('table')), ci = [...tr.children].indexOf(c);
  const nr = rows[rows.indexOf(tr) + dy];
  const nc = dy ? nr && nr.children[Math.min(ci, nr.children.length - 1)] : tr.children[ci + dx];
  if (nc) { e.preventDefault(); selectEls([nc]); nc.scrollIntoView({ block: 'nearest', inline: 'nearest' }); placeSel(); }
});

// ---------- delegated events ----------
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a && ACTIONS[a.dataset.act]) {
    const link = e.target.closest('a[href]');
    if (link && link !== a && a.contains(link)) return;
    e.preventDefault();
    ACTIONS[a.dataset.act](a, e);
    return;
  }
  const s = e.target.closest('[data-scrollto]');
  if (s) { e.preventDefault(); history.replaceState(null, '', s.getAttribute('href')); scrollToSec(s.dataset.scrollto); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  const a = e.target.closest && e.target.closest('[data-act]');
  if (a && (e.key === 'Enter' || e.key === ' ') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && ACTIONS[a.dataset.act]) { e.preventDefault(); ACTIONS[a.dataset.act](a, e); }
});
document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el, e); });
document.addEventListener('input', e => { const el = e.target.closest('[data-input]'); if (el && INPUTS[el.dataset.input]) INPUTS[el.dataset.input](el, e); });

// ---------- theme ----------
function applyThemeIcon() {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const b = $('#themeBtn');
  b.innerHTML = icon(dark ? 'sun' : 'moon');
  b.setAttribute('aria-label', dark ? 'Jasny motyw' : 'Ciemny motyw');
}
ACTIONS.theme = () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  store.set('theme', document.documentElement.dataset.theme);
  applyThemeIcon();
};

// ---------- boot ----------
$('#year').textContent = TODAY.getFullYear();
$('#headerSearch').innerHTML = searchBox('head') + '<button type="button" class="fbar__formula" id="fbFormula" hidden aria-label="Formuła zaznaczonej komórki; kliknij, żeby szukać"></button>';
$('#q-head').placeholder = 'Szukaj spółki: nazwa, KRS albo NIP · kliknij liczbę, żeby zobaczyć jej źródło';
$('#fbFormula').addEventListener('click', () => { showFormula(null); $('#q-head').focus(); });
$('#q-head').addEventListener('focus', () => showFormula(null));
$('#dbSize').textContent = num(COMPANIES.length);
$('#sbInfo').textContent = `Biuletyn KRS z ${fmtDateShort(YESTERDAY)} · ${num(COMPANIES.length)} spółek w makiecie`;
applyThemeIcon();
measure();
addEventListener('hashchange', () => route(false));
route(false);
