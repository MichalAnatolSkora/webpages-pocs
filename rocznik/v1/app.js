// Rocznik v1 — app: hash router, header state, theme and the delegated event wiring.

const $app = $('#app');
const LOGO_SVG = '<span class="wordmark wordmark--sm" aria-hidden="true">Rocznik</span>';
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
  let html, title = 'Rocznik · wyniki finansowe spółek z KRS', key = parts.join('/'), scrollTo = null, nav = '';
  if (p0 !== 'silnik') engineLeave();
  document.body.classList.toggle('is-engine', p0 === 'silnik');
  document.body.classList.toggle('is-report', p0 === 'raport');
  document.body.classList.toggle('is-home', !p0 || ['cennik', 'faq', 'zrodla'].includes(p0));

  if (!p0 || ['cennik', 'faq', 'zrodla'].includes(p0)) { html = renderHome(); key = 'home'; scrollTo = p0 && p0 !== 'home' ? p0 : null; nav = p0 === 'cennik' ? 'cennik' : ''; }
  else if (p0 === 'szukaj') { html = renderSearch(params.q || ''); title = `Szukaj: ${params.q || ''} · Rocznik`; }
  else if (p0 === 'firma') {
    const krs = (p1 || '').slice(0, 10);
    key = 'firma/' + krs;
    scrollTo = p2 || null;
    // same company, different section: just scroll
    if (!keepScroll && LAST_ROUTE === key && $('.co')) { scrollToSec(scrollTo || 'top'); return; }
    html = renderCompany(krs);
    const c = BY_KRS.get(krs);
    if (c) title = `${c.fullName}: sprawozdania finansowe, KRS ${c.krs} · Rocznik`;
  }
  else if (p0 === 'ranking') { html = renderRanking(params); title = 'Rankingi spółek · Rocznik'; nav = 'ranking'; }
  else if (p0 === 'obserwowane') { html = renderWatch(); title = 'Obserwowane · Rocznik'; nav = 'obserwowane'; }
  else if (p0 === 'raport') { html = renderReport(p1); const c = BY_KRS.get(p1); if (c) title = `Raport: ${c.fullName}`; }
  else if (p0 === 'silnik') { html = renderEngine(p1 || '', params); title = 'Maszynownia · Rocznik'; nav = 'silnik'; }
  else { html = `<section class="wrap page"><h1 class="h1">Nie ma takiej strony</h1><p><a class="btn btn--ghost" href="#/">Strona główna</a></p></section>`; }

  const sameView = keepScroll && LAST_ROUTE === key;
  const y = scrollY;
  $app.innerHTML = html;
  LAST_ROUTE = key;
  document.title = title;
  $$('[data-nav]').forEach(a => a.classList.toggle('is-on', a.dataset.nav === nav));
  updateWatchCount();
  if (sameView) window.scrollTo(0, y);
  else if (scrollTo) requestAnimationFrame(() => scrollToSec(scrollTo, true));
  else window.scrollTo(0, 0);
  if (!keepScroll) $app.focus({ preventScroll: true });
}
function rerender() { route(true); }

function scrollToSec(id, instant) {
  if (id === 'top') { window.scrollTo({ top: 0, behavior: REDUCED || instant ? 'auto' : 'smooth' }); return; }
  const el = document.getElementById(id);
  if (!el) return;
  const off = (document.querySelector('.strip') || { offsetHeight: 0 }).offsetHeight + ((document.querySelector('.subnav') || { offsetHeight: 0 }).offsetHeight || 0) + 8;
  window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - off, behavior: REDUCED || instant ? 'auto' : 'smooth' });
}

// highlight the company subnav item for the section in view
let _spyRaf = 0;
addEventListener('scroll', () => {
  cancelAnimationFrame(_spyRaf);
  _spyRaf = requestAnimationFrame(() => {
    const links = $$('.subnav a');
    if (!links.length) return;
    const off = 140;
    let cur = links[0].dataset.scrollto;
    for (const a of links) { const s = document.getElementById(a.dataset.scrollto); if (s && s.getBoundingClientRect().top - off <= 0) cur = a.dataset.scrollto; }
    links.forEach(a => a.classList.toggle('is-on', a.dataset.scrollto === cur));
  });
}, { passive: true });

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
{
  const doy = Math.floor((TODAY - new Date(TODAY.getFullYear(), 0, 0)) / DAY);
  $('#dateline').innerHTML = `${cap(TODAY.toLocaleDateString('pl-PL', { weekday: 'long' }))}<br>${fmtDate(TODAY)}`;
  $('#edition').innerHTML = `Wydanie nr ${doy}<br>biuletyn KRS z ${fmtDateShort(YESTERDAY)}`;
}
$('#year').textContent = TODAY.getFullYear();
$('#headerSearch').innerHTML = searchBox('head');
$('#dbSize').textContent = num(COMPANIES.length);
applyThemeIcon();
addEventListener('hashchange', () => route(false));
route(false);
