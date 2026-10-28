// Osłuch v1 — router, header and footer, the demo bar, theme, and live sync between tabs.

let current = null, sig = '', sessionSig = '', pendingScroll = null;

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

const needP = fn => arg => {
  if (!currentPatient()) { nextHash = location.hash; go('#/logowanie'); return null; }
  return fn(arg);
};
const needD = fn => arg => {
  if (!currentDoctor()) { nextHash = location.hash; go('#/lekarz/logowanie'); return null; }
  return fn(arg);
};

const PATIENT_ROUTES = { '': viewHome, logowanie: viewLogin, konto: needP(viewAccount), umow: needP(viewBook), wizyta: needP(viewVisit) };
const DOCTOR_ROUTES = { '': needD(viewDoctorHome), logowanie: viewDoctorLogin, dokumenty: needD(viewDoctorDocs), wizyta: needD(viewDoctorVisit), konsultacja: needD(viewConsult) };

// Only structural changes re-render a view; the call's progress is read straight from the db by the player.
const coarse = () => JSON.stringify([db.visits.map(v => [v.id, v.status, (v.docs || []).length, v.rating, v.call && v.call.auto]), db.docs.length]);

function route() {
  if (current && current.leave) current.leave();
  current = null;
  document.body.classList.remove('is-room');
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const pro = parts[0] === 'lekarz';
  if (pro) parts.shift();
  const [name = '', arg] = parts;
  const view = (pro ? DOCTOR_ROUTES : PATIENT_ROUTES)[name] || (pro ? DOCTOR_ROUTES[''] : viewHome);
  document.body.classList.toggle('is-pro', pro);
  renderHeader(pro, name);
  app.innerHTML = '';
  current = view(arg ? decodeURIComponent(arg) : undefined) || null;
  sig = coarse();
  sessionSig = JSON.stringify(db.session);
  $$('.demo-bar__side a').forEach(a => a.classList.toggle('is-on', (a.dataset.side === 'doctor') === pro));
  const el = pendingScroll && document.getElementById(pendingScroll);
  pendingScroll = null;
  if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth' }));
  else window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

window.addEventListener('storage', e => {
  if (e.key !== DB_KEY) return;
  db = loadDb();
  if (JSON.stringify(db.session) !== sessionSig) return route();
  const s = coarse();
  if (s === sig) return;
  sig = s;
  if (current && current.sync) current.sync();
});

document.addEventListener('click', e => {
  const a = e.target.closest('[data-scroll]');
  if (!a) return;
  e.preventDefault();
  const el = document.getElementById(a.dataset.scroll);
  if (el && !location.hash.replace(/^#\/?/, '')) el.scrollIntoView({ behavior: 'smooth' });
  else { pendingScroll = a.dataset.scroll; go('#/'); }
});

// ---------- header / footer ----------
function renderHeader(pro, name) {
  const h = $('#header');
  if (pro) {
    const dr = currentDoctor();
    h.innerHTML = `<div class="wrap site-header__in"><a class="logo" href="#/lekarz">${logoMark()}<span class="logo__word">osłuch</span><span class="logo__pro">PRO</span></a>
      ${dr ? `<nav class="nav" aria-label="Panel lekarza"><a href="#/lekarz" class="${['', 'wizyta', 'konsultacja'].includes(name) ? 'is-on' : ''}">${ic('cal')}Grafik</a><a href="#/lekarz/dokumenty" class="${name === 'dokumenty' ? 'is-on' : ''}">${ic('doc')}Dokumenty</a></nav>` : '<span style="flex:1"></span>'}
      <div class="header-side">${dr ? `<span class="chip chip--ai">${ic('spark')}Asystent AI włączony</span>` : ''}${themeBtn()}
        ${dr ? `<span class="me">${avatar(dr, 30)}<span>${esc(dr.full)}<small>PWZ ${dr.pwz}</small></span></span><button type="button" class="icon-btn" id="drOut" title="Wyloguj">${ic('logout')}</button>` : ''}</div></div>`;
    $('#drOut')?.addEventListener('click', () => { logout('doctor'); toast('Wylogowano z panelu lekarza', 'logout'); go('#/lekarz/logowanie'); });
  } else {
    const pt = currentPatient();
    h.innerHTML = `<div class="wrap site-header__in"><a class="logo" href="#/">${logoMark()}<span class="logo__word">osłuch</span></a>
      <nav class="nav" aria-label="Główna"><a href="#/" data-scroll="jak">Jak to działa</a><a href="#/" data-scroll="lekarze">Lekarze</a><a href="#/" data-scroll="cennik">Cennik</a><a href="#/" data-scroll="faq">Pytania</a></nav>
      <div class="header-side">${themeBtn()}${name !== 'umow' ? '<a class="btn btn--primary btn--sm" href="#/umow">Umów wizytę</a>' : ''}
        ${pt ? `<a class="me" href="#/konto">${avatar(pt, 30)}<span>${esc(pt.first)}<small>Moje konto</small></span></a>` : name !== 'logowanie' ? '<a class="btn btn--ghost btn--sm" href="#/logowanie">Zaloguj</a>' : ''}</div></div>`;
  }
  $('#themeBtn').addEventListener('click', toggleTheme);
}

$('#footer').innerHTML = `<div class="wrap site-footer__in">
  <div><span class="logo__word">osłuch</span><p>${CLINIC.legal} · ${CLINIC.address}<br>Firma, lekarze, pacjenci i ceny są fikcyjne — to mock produktu, nie porada medyczna.</p>
    <span class="footer-112">${ic('alert')}Stan nagły? Dzwoń 112</span></div>
  <p><b>Pacjenci</b><br><a href="#/umow">Umów wizytę</a><br><a href="#/konto/recepty">Moje e-recepty</a><br><a href="../index.html">Projekt rozwiązania</a></p>
  <p><b>Kontakt</b><br>${CLINIC.phone}<br>${CLINIC.email}<br><a href="#/lekarz">Panel lekarza</a></p></div>`;

// ---------- theme ----------
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && darkMQ.matches);
const themeBtn = () => `<button type="button" class="icon-btn" id="themeBtn" aria-pressed="${isDark()}" title="Tryb jasny / ciemny">${ic(isDark() ? 'sun' : 'moon')}</button>`;
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const b = $('#themeBtn');
  if (b) { b.setAttribute('aria-pressed', isDark()); b.innerHTML = ic(isDark() ? 'sun' : 'moon'); }
}
function toggleTheme() {
  const t = isDark() ? 'light' : 'dark';
  store.set('osluch-theme', t);
  applyTheme(t);
}
applyTheme(store.get('osluch-theme', null));
darkMQ.addEventListener('change', () => applyTheme(store.get('osluch-theme', null)));

// ---------- demo bar ----------
$('#testData').innerHTML = `<div class="wrap test-data__in">
  <div><p class="test-data__t">Pacjentka</p><ul><li><code>${PATIENTS[0].email}</code></li><li><code>${PATIENT_PASSWORD}</code> hasło</li><li>Kod SMS przychodzi w powiadomieniu</li></ul></div>
  <div><p class="test-data__t">Lekarze</p><ul>${DOCTORS.map(d => `<li><code>${d.email}</code></li>`).join('')}<li><code>${DOCTOR_PASSWORD}</code> hasło · 2FA: dowolne 6 cyfr</li></ul></div>
  <div><p class="test-data__t">Płatność i podpis</p><ul><li><code>dowolne 6 cyfr</code> BLIK</li><li><code>000 000</code> kod wygasł</li><li>Pakiet firmowy: bez kodu</li><li><code>dowolne</code> hasło certyfikatu</li></ul></div>
  <div><p class="test-data__t">Demo</p><ul><li>Otwórz pacjenta i lekarza w dwóch kartach — synchronizują się na żywo</li><li>Scenariusze: ból gardła (alergia na penicylinę), zapalenie pęcherza, recepta na Euthyrox</li></ul>
    <button type="button" class="btn btn--ghost btn--sm" id="resetMock">Wyczyść dane mocka</button></div></div>`;
$('#testDataBtn').addEventListener('click', () => {
  const box = $('#testData'), open = box.hidden;
  box.hidden = !open;
  $('#testDataBtn').setAttribute('aria-expanded', open);
});
$('#otherTabBtn').addEventListener('click', () => {
  const pro = document.body.classList.contains('is-pro');
  window.open(location.pathname + (pro ? '#/konto' : '#/lekarz'), '_blank');
});
$('#resetMock').addEventListener('click', () => {
  [DB_KEY, DRAFT, 'osluch-speed', 'osluch-theme'].forEach(store.drop);
  location.hash = '#/';
  location.reload();
});

route();
