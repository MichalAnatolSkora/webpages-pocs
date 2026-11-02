// ClientTracker v1 — UI: login with TOTP, the time-recorder header, the dashboard rack, clients, the client card, the ticket card with its SLA trace,
// time entries, the monthly time card with the report, and settings. Everything typed by the user is escaped before it reaches innerHTML (T-4).

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = $('#root'), dlg = $('#dlg');

// ---------- account and login (L) — simulated, the real check lives on the server ----------
const ACCOUNT = { email: 'wlasciciel@clienttracker.test', password: 'makieta-demo-2026', role: 'owner', secret: 'JBSWY3DPEHPK3PXPMKTR' };
const BAD_LOGIN = 'Nieprawidłowy e-mail, hasło lub kod.';
const login = { step: 'password', err: '' };
// a client session ends when the owner turns the panel off or deactivates the client
const sessionValid = () => {
  const s = store.get('session', null);
  if (!s || Date.now() - s.last >= 7 * DAY) return false;
  if (s.role === 'client' && !portalClients().some(c => c.id === s.clientId)) { store.del('session'); return false; }
  return true;
};
// the client whose panel is on screen: a logged-in client, or the owner previewing one
const portalId = () => { const s = store.get('session', null); return s ? (s.role === 'client' ? s.clientId : s.as && clientById(s.as) ? s.as : null) : null; };
const startSession = (role, clientId) => {
  store.set('session', role === 'client' ? { email: clientById(clientId).email, role, clientId, last: Date.now() } : { email: ACCOUNT.email, role: 'owner', last: Date.now() });
  login.step = 'password'; login.err = '';
  location.hash = '#/';
  render(true);
};
const touchSession = () => { const s = store.get('session', null); if (s) store.set('session', { ...s, last: Date.now() }); };
function totpCode(step) {
  let h = 2166136261;
  for (const ch of ACCOUNT.secret + ':' + step) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return String((h >>> 0) % 1e6).padStart(6, '0');
}
const totpStep = () => Math.floor(Date.now() / 30000);
const totpOk = code => [0, -1].some(d => totpCode(totpStep() + d) === code);
// L-4: 5 attempts a minute from one IP, 10 failures in a row lock the account for 15 minutes
function loginGate() {
  const now = Date.now(), lock = store.get('lockUntil', 0);
  if (lock > now) return `Konto zablokowane po 10 nieudanych próbach. Spróbuj ponownie za ${Math.ceil((lock - now) / MIN)} min.`;
  const recent = store.get('attempts', []).filter(t => now - t < MIN);
  if (recent.length >= 5) return 'Za dużo prób z tego adresu IP. Spróbuj ponownie za minutę.';
  store.set('attempts', [...recent, now]);
  return null;
}
function loginFailed() {
  const f = store.get('fails', 0) + 1;
  if (f >= 10) { store.set('lockUntil', Date.now() + 15 * MIN); store.set('fails', 0); } else store.set('fails', f);
  login.err = BAD_LOGIN;
}
function loginSucceeded() {
  store.set('fails', 0);
  store.set('session', { email: ACCOUNT.email, role: ACCOUNT.role, last: Date.now() });
  login.step = 'password'; login.err = '';
  if (!location.hash || location.hash === '#/login') location.hash = '#/';
  render(true);
}

function fakeQR(seed) {
  const N = 25;
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  const finder = (x, y) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
  let d = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!finder(x, y) && rnd() < 0.48) d += `M${x} ${y}h1v1h-1z`;
  for (const [x, y] of [[0, 0], [N - 7, 0], [0, N - 7]]) d += `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`;
  return `<svg class="qr" viewBox="-2 -2 ${N + 4} ${N + 4}" role="img" aria-label="Kod QR do aplikacji uwierzytelniającej (makieta, nie do zeskanowania)"><rect x="-2" y="-2" width="${N + 4}" height="${N + 4}" fill="#fff"/><path d="${d}" fill="#111" fill-rule="evenodd"/></svg>`;
}

function renderLogin() {
  document.title = 'Logowanie · ClientTracker';
  const setup = login.step === 'setup', code = login.step === 'code' || setup;
  const key = ACCOUNT.secret.match(/.{4}/g).join(' ');
  root.innerHTML = `
<main class="login" id="app" tabindex="-1">
  <div class="wrap login__in">
    <section class="login__machine" aria-label="ClientTracker">
      ${plate()}
      ${lcd()}
      <p class="login__slogan">Odbij kartę, żeby wejść.</p>
      <p class="login__fine">Bez rejestracji: konto zakłada polecenie <code>create-user --email</code> na serwerze.</p>
    </section>
    <form class="login__card card" id="loginForm" novalidate>
      <p class="card__print"><span>Karta wejścia</span><span>${setup ? 'krok 2 z 2 · konfiguracja' : code ? 'krok 2 z 2' : 'krok 1 z 2'}</span></p>
      ${login.step === 'password' ? `
        <h1 class="login__h">Logowanie</h1>
        <div class="fld"><label for="lEmail">E-mail</label><input id="lEmail" name="email" type="email" autocomplete="username" required></div>
        <div class="fld"><label for="lPass">Hasło</label><input id="lPass" name="password" type="password" autocomplete="current-password" required minlength="12"></div>
        ${login.err ? `<p class="formerr" role="alert">${esc(login.err)}</p>` : ''}
        <button class="btn btn--ink btn--wide" type="submit">Dalej</button>
        <div class="login__demo">
          <p><b>Makieta:</b> ${esc(ACCOUNT.email)}, hasło <code>${esc(ACCOUNT.password)}</code>. Zły e-mail, hasło albo kod dają ten sam komunikat.</p>
          <div class="login__demo-acts">
            <button type="button" class="btn btn--small" data-act="fill-login">Wpisz dane demo</button>
            <button type="button" class="btn btn--small btn--ink" data-act="skip-login">Wejdź bez logowania</button>
          </div>
          <p class="login__skipnote">Tylko w makiecie: pomija hasło i kod TOTP. Prawdziwa aplikacja nie ma takiego wejścia.</p>
          <p><b>Klient:</b> e-mail kontaktowy z dostępem do panelu, hasło <code>${CLIENT_PASSWORD}</code>, np. ${esc(portalClients()[0]?.email || '—')}.</p>
          <div class="login__demo-acts"><button type="button" class="btn btn--small" data-act="skip-login-client">Wejdź jako klient</button></div>
        </div>` : setup ? `
        <h1 class="login__h">Skonfiguruj kod z aplikacji</h1>
        <p class="login__p">To konto nie ma jeszcze drugiego składnika. Bez niego nie ma dostępu do aplikacji. Zeskanuj kod w aplikacji uwierzytelniającej albo przepisz klucz.</p>
        <div class="setup">${fakeQR(ACCOUNT.secret)}<div><p class="lbl">Klucz</p><p class="setup__key mono">${key}</p><p class="login__p">TOTP · 6 cyfr · co 30 s</p></div></div>
        <div class="fld"><label for="lCode">Kod z aplikacji (6 cyfr)</label><input id="lCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" class="codein" required></div>
        ${login.err ? `<p class="formerr" role="alert">${esc(login.err)}</p>` : ''}
        <button class="btn btn--ink btn--wide" type="submit">Potwierdź i wejdź</button>
        <button type="button" class="linkbtn" data-act="login-back">← Wróć do hasła</button>` : `
        <h1 class="login__h">Kod z aplikacji</h1>
        <p class="login__p">Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.</p>
        <div class="fld"><label for="lCode">Kod (6 cyfr)</label><input id="lCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" class="codein" required></div>
        ${login.err ? `<p class="formerr" role="alert">${esc(login.err)}</p>` : ''}
        <button class="btn btn--ink btn--wide" type="submit">Zaloguj</button>
        <button type="button" class="linkbtn" data-act="login-back">← Wróć do hasła</button>`}
    </form>
    ${code ? `
    <aside class="authapp" aria-label="Aplikacja uwierzytelniająca (symulacja)">
      <p class="authapp__bar">Aplikacja uwierzytelniająca · symulacja</p>
      <p class="authapp__acct">ClientTracker<br><span>${esc(ACCOUNT.email)}</span></p>
      <p class="authapp__code" id="authCode">${totpCode(totpStep()).replace(/(\d{3})/, '$1 ')}</p>
      <p class="authapp__ttl"><span class="authapp__ring" id="authRing" aria-hidden="true"></span><span id="authTtl"></span></p>
      <button type="button" class="btn btn--small" data-act="fill-code">Przepisz kod</button>
    </aside>` : ''}
  </div>
</main>`;
  tick();
  const first = $('#loginForm input');
  if (first) first.focus();
}

function submitLogin(form) {
  const fd = new FormData(form);
  const gate = loginGate();
  if (gate) { login.err = gate; return renderLogin(); }
  if (login.step === 'password') {
    const client = clientByLogin(fd.get('email'));
    if (client && fd.get('password') === CLIENT_PASSWORD) { store.set('fails', 0); return startSession('client', client.id); }
    const ok = String(fd.get('email')).trim().toLowerCase() === ACCOUNT.email && fd.get('password') === ACCOUNT.password;
    if (!ok) { loginFailed(); return renderLogin(); }
    login.err = ''; login.step = store.get('totp', false) ? 'code' : 'setup';
    return renderLogin();
  }
  if (!totpOk(String(fd.get('code')).replace(/\s/g, ''))) { loginFailed(); return renderLogin(); }
  if (login.step === 'setup') store.set('totp', true);
  loginSucceeded();
}

// ---------- shared bits ----------
function plate() {
  return `<a class="plate" href="#/" aria-label="ClientTracker, pulpit">
    <span class="plate__rivet" aria-hidden="true"></span><span class="plate__rivet" aria-hidden="true"></span>
    <span class="plate__name">ClientTracker</span>
    <span class="plate__sub">zegar kontrolny zgłoszeń</span>
  </a>`;
}
function lcd() {
  return `<div class="lcd" aria-label="Czas w strefie Europe/Warsaw">
    <span class="lcd__glass"><span class="lcd__time" id="lcdTime">--:--</span><span class="lcd__sec" id="lcdSec">:--</span></span>
    <span class="lcd__date" id="lcdDate"></span>
    <span class="lcd__tz">Europe/Warsaw${clock.offset ? ' · zegar przesunięty' : ''}</span>
  </div>`;
}
function nextOpening(now, kind, win) {
  for (let dn = wParts(now).dn, i = 0; i < 30; dn++, i++) { const w = windowOn(dn, kind, win); if (w && w[0] > now) return w[0]; }
  return NaN;
}
function lampsHTML() {
  const now = clock.now(), win = DB.settings;
  return [['biz', 'Okno dni roboczych'], ['day', 'Okno codzienne']].map(([k, name]) => {
    const on = isWindowOpen(now, k, win);
    const w = windowOn(wParts(now).dn, k, win);
    const state = on ? `otwarte, do ${fmtT(w[1])}` : `zamknięte, otwarcie ${DOW_SHORT[wParts(nextOpening(now, k, win)).dow]} ${fmtT(nextOpening(now, k, win))}`;
    return `<div class="lamp${on ? ' lamp--on' : ''}"><span class="lamp__bulb" aria-hidden="true"></span><span class="lamp__name">${name} ${fmtMin(win[k].from)}–${fmtMin(win[k].to)}</span><span class="lamp__st">${state}</span></div>`;
  }).join('');
}
const PRIO_CODE = { Krytyczny: 'K', Wysoki: 'W', Normalny: 'N' };
const prioTag = p => `<span class="prio prio--${PRIO_CODE[p]}"><span class="prio__bars" aria-hidden="true"><i></i><i></i><i></i></span>${p}</span>`;
const STATUS_CODE = { 'Nowe': 'new', 'W toku': 'prog', 'Czeka na klienta': 'wait', 'Zrobione': 'done', 'Odrzucone': 'rej' };
const statusTag = s => `<span class="st st--${STATUS_CODE[s]}">${s}</span>`;
function slaTag(t, now = clock.now()) {
  const s = slaState(t, now);
  let fuse = '';
  if (s.k === 'left') {
    const used = Math.min(1, Math.max(0, (now - t.receivedAt) / (t.deadline - t.receivedAt || 1)));
    fuse = `<span class="fuse" aria-hidden="true"><i style="width:${(used * 100).toFixed(1)}%"></i></span>`;
  }
  return `<span class="sla sla--${s.k}" data-sla="${t.no}">${s.text}${fuse}</span>`;
}
const KIND_CODE = { Pula: 'PUL', Utrzymanie: 'UTR', Dodatkowe: 'DOD' };
const kindTag = k => `<span class="kind kind--${KIND_CODE[k]}"><b aria-hidden="true">${KIND_CODE[k]}</b> ${k}</span>`;
const pkgClass = pkg => 'pkg-' + pkg.toLowerCase();
const poolText = (used, pool) => `${fmtHours(used)} z ${fmtHours(pool)} h`;
function holes(used, pool) {
  const n = Math.round(pool * 4), u = Math.round(used * 4), total = Math.max(n, u);
  if (!total) return `<div class="holes holes--none">pakiet bez puli godzin</div>`;
  let out = '';
  for (let h = 0; h < Math.ceil(total / 4); h++) {
    out += '<span class="holes__h">';
    for (let i = h * 4; i < Math.min(h * 4 + 4, total); i++) out += `<i class="${i < u ? (i >= n ? 'over' : 'on') : ''}"></i>`;
    out += '</span>';
  }
  return `<div class="holes" aria-hidden="true">${out}</div>`;
}
const ticketLink = t => `<a href="#/z/${t.no}">${esc(t.title)}</a>`;
const clientLink = c => `<a href="#/klient/${c.id}">${esc(c.name)}</a>`;
const todayISO = () => isoOf(wParts(clock.now()).dn);
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' toast--' + kind : '');
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('toast--out'), 3600);
  setTimeout(() => el.remove(), 4200);
}

// ---------- shell ----------
const NAV = [['', 'Pulpit'], ['klienci', 'Klienci'], ['czas', 'Czas pracy'], ['ustawienia', 'Ustawienia']];
function renderShell() {
  root.innerHTML = `
<header class="machine">
  <div class="wrap machine__in">
    ${plate()}
    ${lcd()}
    <div class="lamps" id="lamps">${lampsHTML()}</div>
    <div class="machine__keys">
      <button type="button" class="key key--red" data-act="new-ticket">+ Zgłoszenie</button>
      <button type="button" class="key" data-act="new-entry">+ Czas</button>
    </div>
  </div>
  <nav class="tabs" aria-label="Główna">
    <div class="wrap tabs__in">
      ${NAV.map(([p, l]) => `<a href="#/${p}" data-nav="${p}">${l}</a>`).join('')}
      <span class="tabs__who"><span>${esc(ACCOUNT.email)}</span><span class="tabs__role">owner</span></span>
      <button type="button" class="tabs__out" data-act="logout">Wyloguj</button>
    </div>
  </nav>
</header>
<main id="app" class="wrap page" tabindex="-1"></main>
<footer class="foot">
  <div class="wrap foot__in">
    <p class="foot__name">ClientTracker</p>
    <p>Zgłoszenia klientów w abonamencie: pula godzin z pakietu, termin reakcji z SLA liczony przez okna obsługi i święta, karta miesięczna z raportem dla klienta. Każde zgłoszenie to karta w stojaku, każda reakcja i każdy przepracowany kwadrans zostaje odbity.</p>
    <p class="foot__fine">Makieta v1 według <a href="../specyfikacja.md">specyfikacji</a>. Czas zawsze w strefie Europe/Warsaw, niezależnie od strefy przeglądarki.</p>
  </div>
</footer>`;
}

// ---------- router ----------
let lastRoute = null;
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: Object.fromEntries(new URLSearchParams(qs || '')) };
}
function render(force) {
  if (!sessionValid()) { lastRoute = null; syncRoleSelect(); return renderLogin(); }
  touchSession();
  syncRoleSelect();
  const pid = portalId();
  if (pid) return renderPortal(pid, force);
  if (force || !$('.machine') || $('.machine--portal')) renderShell();
  const { parts, q } = parseHash();
  const route = parts.join('/');
  let v;
  switch (parts[0]) {
    case undefined: v = viewDashboard(q); break;
    case 'klienci': v = viewClients(q); break;
    case 'klient': v = parts[2] ? viewMonth(parts[1], parts[2]) : viewClient(parts[1], q); break;
    case 'z': v = viewTicket(+parts[1]); break;
    case 'czas': v = viewTime(q); break;
    case 'ustawienia': v = viewSettings(q); break;
    default: v = notFound();
  }
  const app = $('#app');
  app.innerHTML = v.html;
  document.title = `${v.title} · ClientTracker`;
  const sect = parts[0] === 'klient' ? 'klienci' : parts[0] === 'z' ? '' : parts[0] || '';
  $$('[data-nav]').forEach(a => { if (a.dataset.nav === sect) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#lamps').innerHTML = lampsHTML();
  if (route !== lastRoute) { window.scrollTo(0, 0); if (lastRoute !== null) app.focus({ preventScroll: true }); }
  lastRoute = route;
  tick();
}
const notFound = () => ({ title: 'Nie ma takiej strony', html: `<div class="empty"><p class="empty__stamp">404</p><p>Nie ma takiej karty w stojaku.</p><p><a href="#/">Wróć na pulpit</a></p></div>` });
const pageHead = (h, sub = '', side = '') => `<div class="pagehead"><div><h1>${h}</h1>${sub ? `<p class="pagehead__sub">${sub}</p>` : ''}</div>${side ? `<div class="pagehead__side">${side}</div>` : ''}</div>`;
const clientOptions = (sel, { activeOnly = false, all = '' } = {}) =>
  (all ? `<option value="">${all}</option>` : '') +
  DB.clients.filter(c => !activeOnly || c.active).sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    .map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}${c.active ? '' : ' (nieaktywny)'}</option>`).join('');

// ---------- dashboard (P) ----------
function rackRow(t, now, { client = true } = {}) {
  const c = clientById(t.clientId);
  return `<tr class="slot ${pkgClass(t.pkg)}" data-href="#/z/${t.no}">
    <td class="slot__no"><span class="stampno">#${t.no}</span></td>
    ${client ? `<td class="slot__client" data-label="Klient"><span>${esc(c.name)}</span><small>${c.pkg}</small></td>` : ''}
    <td class="slot__title" data-label="Tytuł">${ticketLink(t)}<small>${t.byClient ? 'panel klienta' : t.source} · przyjęte ${fmtDT(t.receivedAt)}</small></td>
    <td data-label="Priorytet">${prioTag(t.priority)}</td>
    <td data-label="Status">${statusTag(t.status)}</td>
    <td class="mono slot__dl" data-label="Termin reakcji">${fmtDTdow(t.deadline)}</td>
    <td data-label="Stan SLA">${slaTag(t, now)}</td>
  </tr>`;
}
function viewDashboard(q) {
  const now = clock.now();
  const cid = clientById(q.klient) ? q.klient : '';
  const list = openTickets(cid);
  const waiting = list.filter(t => t.reactedAt == null), rest = list.filter(t => t.reactedAt != null);
  const overdue = waiting.filter(t => now > t.deadline).length;
  const head = `<tr><th scope="col"><span class="sr-only">Numer</span>Nr</th><th scope="col">Klient</th><th scope="col">Tytuł</th><th scope="col">Priorytet</th><th scope="col">Status</th><th scope="col">Termin reakcji</th><th scope="col">Stan SLA</th></tr>`;
  const group = (label, note, rows) => rows.length ? `<tr class="rack__group"><th colspan="7" scope="rowgroup">${label}<small>${note}</small></th></tr>${rows.map(t => rackRow(t, now)).join('')}` : '';
  return {
    title: 'Pulpit',
    html: `
${pageHead('Pulpit', 'Otwarte zgłoszenia wszystkich klientów: Nowe, W toku, Czeka na klienta.', `
  <div class="fld fld--inline"><label for="dashClient">Klient</label><select id="dashClient" data-filter="dash">${clientOptions(cid, { all: 'wszyscy klienci' })}</select></div>`)}
<dl class="counter">
  <div><dt>Otwarte</dt><dd>${list.length}</dd></div>
  <div><dt>Bez reakcji</dt><dd>${waiting.length}</dd></div>
  <div class="${overdue ? 'counter--red' : ''}"><dt>Po terminie</dt><dd>${overdue}</dd></div>
  <div><dt>Po reakcji</dt><dd>${rest.length}</dd></div>
</dl>
${list.length ? `
<div class="rack">
  <table class="rack__t">
    <caption class="sr-only">Otwarte zgłoszenia: najpierw bez reakcji według terminu, potem pozostałe od najstarszego przyjęcia</caption>
    <thead>${head}</thead>
    <tbody>
      ${group('Czeka na reakcję', 'według terminu reakcji', waiting)}
      ${group('Po reakcji', 'od najstarszego przyjęcia', rest)}
    </tbody>
  </table>
</div>` : `<div class="empty"><p class="empty__stamp">0</p><p>Stojak pusty: brak otwartych zgłoszeń${cid ? ' tego klienta' : ''}.</p></div>`}`,
  };
}

// ---------- clients (K) ----------
function clientCard(c, ym) {
  const used = poolUsed(c.id, ym);
  const open = DB.tickets.filter(t => t.clientId === c.id && isOpenStatus(t.status)).length;
  return `<a class="tcard ${pkgClass(c.pkg)}${c.active ? '' : ' tcard--off'}" href="#/klient/${c.id}">
    <span class="tcard__notch" aria-hidden="true"></span>
    <span class="tcard__print"><span>Karta klienta</span><span>${ymLabel(ym)}</span></span>
    <span class="tcard__name">${esc(c.name)}</span>
    <span class="tcard__pkg">Pakiet ${c.pkg}</span>
    <span class="tcard__row"><span class="lbl">Pula</span><span class="val">${poolText(used, c.pool)}</span></span>
    ${holes(used, c.pool)}
    <span class="tcard__row"><span class="lbl">Otwarte zgłoszenia</span><span class="val">${open}</span></span>
    <span class="tcard__row"><span class="lbl">Abonament</span><span class="val">${fmtMoney(c.price)}</span></span>
    <span class="tcard__row"><span class="lbl">Panel klienta</span><span class="val">${c.portal ? 'tak' : 'nie'}</span></span>
    ${c.active ? '' : '<span class="tcard__stamp">Nieaktywny</span>'}
  </a>`;
}
function viewClients(q) {
  const all = q.nieaktywni === '1', ym = ymNow();
  const list = DB.clients.filter(c => all || c.active).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  const hidden = DB.clients.filter(c => !c.active).length;
  return {
    title: 'Klienci',
    html: `
${pageHead('Klienci', `Pula w bieżącym miesiącu (${ymLabel(ym)}): jeden otwór to 0,25 h. Klienta się nie usuwa, tylko oznacza jako nieaktywnego.`, `
  <label class="check"><input type="checkbox" data-filter="inactive"${all ? ' checked' : ''}> pokaż nieaktywnych${hidden ? ` (${hidden})` : ''}</label>
  <button type="button" class="btn btn--ink" data-act="new-client">+ Dodaj klienta</button>`)}
<div class="cards">${list.map(c => clientCard(c, ym)).join('') || '<p class="empty">Brak klientów.</p>'}</div>`,
  };
}

function viewClient(id, q) {
  const c = clientById(id);
  if (!c) return notFound();
  const ym = ymNow(), used = poolUsed(c.id, ym), now = clock.now();
  const st = STATUSES.includes(q.status) ? q.status : '';
  const mine = DB.tickets.filter(t => t.clientId === id);
  const list = mine.filter(t => !st || t.status === st).sort((a, b) => b.receivedAt - a.receivedAt || b.no - a.no);
  const filt = ['', ...STATUSES].map(s => {
    const n = s ? mine.filter(t => t.status === s).length : mine.length;
    const href = `#/klient/${id}${s ? '?status=' + encodeURIComponent(s) : ''}`;
    return `<a href="${href}"${s === st ? ' aria-current="true"' : ''}>${s || 'Wszystkie'} <span>${n}</span></a>`;
  }).join('');
  return {
    title: c.name,
    html: `
<nav class="crumbs" aria-label="Ścieżka"><a href="#/klienci">Klienci</a><span aria-hidden="true">/</span><span>${esc(c.name)}</span></nav>
<div class="client">
  <section class="client__card card ${pkgClass(c.pkg)}${c.active ? '' : ' tcard--off'}" aria-labelledby="cName">
    <p class="card__print"><span>Karta klienta</span><span>${c.active ? 'aktywny' : 'nieaktywny'}</span></p>
    <h1 class="client__name" id="cName">${esc(c.name)}</h1>
    <dl class="form-rows">
      <div><dt>E-mail kontaktowy</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</dd></div>
      <div><dt>Pakiet</dt><dd>${c.pkg}</dd></div>
      <div><dt>Abonament miesięcznie</dt><dd class="mono">${fmtMoney(c.price)}</dd></div>
      <div><dt>Pula godzin</dt><dd class="mono">${fmtHours(c.pool)} h</dd></div>
      <div><dt>Pula · ${ymLabel(ym)}</dt><dd class="mono">${poolText(used, c.pool)}</dd></div>
    </dl>
    ${holes(used, c.pool)}
    ${c.active ? '' : '<span class="tcard__stamp">Nieaktywny</span>'}
    <div class="client__acts">
      <a class="btn btn--ink" href="#/klient/${c.id}/${ym}">Karta miesiąca →</a>
      <button type="button" class="btn" data-act="new-ticket" data-client="${c.id}"${c.active ? '' : ' disabled aria-describedby="offNote"'}>+ Zgłoszenie</button>
      <button type="button" class="btn" data-act="new-entry" data-client="${c.id}">+ Czas</button>
      <button type="button" class="btn" data-act="edit-client" data-id="${c.id}">Edytuj</button>
    </div>
    ${c.active ? '' : '<p class="note" id="offNote">Nieaktywnemu klientowi nie można dodać zgłoszenia. Włączysz go w edycji.</p>'}
    <div class="portalbox">
      <p class="card__print"><span>Panel klienta</span><span>${c.portal ? 'dostęp włączony' : 'bez dostępu'}</span></p>
      <p class="note">${c.portal ? `Klient loguje się e-mailem ${esc(c.email)}. Widzi swoje zgłoszenia, godziny i raporty, może dodać zgłoszenie. Kwot nie widzi.` : 'Klient nie ma konta. Po włączeniu loguje się e-mailem kontaktowym.'}</p>
      <div class="client__acts"><button type="button" class="btn btn--small" data-act="portal-toggle" data-id="${c.id}">${c.portal ? 'Wyłącz dostęp' : 'Włącz dostęp'}</button>${c.portal && c.active ? `<button type="button" class="btn btn--small" data-act="portal-preview" data-id="${c.id}">Podgląd jako klient</button>` : ''}</div>
    </div>
  </section>
  <section class="client__tickets" aria-labelledby="cTickets">
    <div class="subhead"><h2 id="cTickets">Zgłoszenia</h2><p>od najnowszego</p></div>
    <nav class="seg" aria-label="Filtr po statusie">${filt}</nav>
    ${list.length ? `<div class="rack rack--compact"><table class="rack__t">
      <caption class="sr-only">Zgłoszenia klienta ${esc(c.name)}${st ? `, status ${st}` : ''}</caption>
      <thead><tr><th scope="col">Nr</th><th scope="col">Tytuł</th><th scope="col">Priorytet</th><th scope="col">Status</th><th scope="col">Termin reakcji</th><th scope="col">Stan SLA</th></tr></thead>
      <tbody>${list.map(t => rackRow(t, now, { client: false })).join('')}</tbody></table></div>`
      : `<p class="empty empty--small">Brak zgłoszeń${st ? ` ze statusem „${st}”` : ''}.</p>`}
  </section>
</div>`,
  };
}

// ---------- ticket (Z) ----------
function traceView(t, now) {
  const tr = deadlineTrace(t.receivedAt, t.pkg, t.priority, t.win);
  if (tr.days.length > 16) return `<p class="note">Termin wypada ${tr.days.length} dni po przyjęciu, taśma pokazuje najwyżej 16 dni.</p>`;
  const pct = (dn, ms) => Math.min(100, Math.max(0, (ms - fromW(dn, 0)) / MIN / 14.4)).toFixed(2);
  const span = (dn, a, b, cls) => `<span class="${cls}" style="left:${pct(dn, a)}%;width:${(pct(dn, b) - pct(dn, a)).toFixed(2)}%"></span>`;
  const marks = [[t.receivedAt, 'in', 'przyjęte'], [t.deadline, 'dl', 'termin'], [t.reactedAt, 'rx', 'reakcja'], [t.reactedAt == null ? now : null, 'now', 'teraz']];
  const rows = tr.days.map(d => {
    const here = marks.filter(([ms]) => ms != null && wParts(ms).dn === d.dn);
    const notes = [
      d.holiday || ((d.dow === 0 || d.dow === 6) && tr.kind === 'biz' ? 'weekend' : ''),
      d.counted && tr.rule.h ? `+${fmtDur(d.counted[1] - d.counted[0])}` : d.n ? `${d.n}. dzień roboczy` : '',
      ...here.map(([ms, cls, label]) => `<span class="tr__tag tr__tag--${cls}">${label} ${fmtT(ms)}</span>`),
    ].filter(Boolean);
    return `<li class="tr${d.w ? '' : ' tr--off'}${d.counted ? ' tr--cnt' : ''}">
      <span class="tr__day"><b>${DOW_SHORT[d.dow]}</b> ${fmtDn(d.dn).slice(0, 5)}</span>
      <span class="tr__bar" aria-hidden="true">${d.w ? span(d.dn, d.w[0], d.w[1], 'tr__win') : ''}${d.counted ? span(d.dn, d.counted[0], d.counted[1], 'tr__cnt') : ''}${here.map(([ms, cls]) => `<span class="tr__mk tr__mk--${cls}" style="left:${pct(d.dn, ms)}%"></span>`).join('')}</span>
      <span class="tr__note">${d.w ? '' : '<span class="sr-only">okno zamknięte</span>'}${notes.join(' ')}</span>
    </li>`;
  }).join('');
  const w = t.win[tr.kind];
  return `<div class="trace">
    <p class="trace__rule"><b>${ruleLabel(tr.rule)}</b> · pakiet ${t.pkg} · okno ${tr.kind === 'biz' ? 'dni roboczych' : 'codzienne'} ${fmtMin(w.from)}–${fmtMin(w.to)}, zapamiętane przy przyjęciu</p>
    <div class="tr tr--scale" aria-hidden="true"><span></span><span class="tr__ticks">${[0, 6, 12, 18, 24].map(h => `<i style="left:${h / 24 * 100}%">${h}</i>`).join('')}</span><span></span></div>
    <ol class="tr__list">${rows}</ol>
    <p class="trace__legend"><span><i class="lg lg--win"></i>okno obsługi</span><span><i class="lg lg--off"></i>okno zamknięte</span><span><i class="lg lg--cnt"></i>czas liczony do terminu</span><span><i class="lg lg--dl"></i>termin reakcji</span></p>
  </div>`;
}
function viewTicket(no) {
  const t = ticketByNo(no);
  if (!t) return notFound();
  const c = clientById(t.clientId), now = clock.now();
  const entries = entriesOfTicket(t.no), sla = slaState(t, now);
  const late = t.reactedAt != null && t.reactedAt > t.deadline;
  const statusBtns = ['W toku', 'Czeka na klienta', 'Zrobione', 'Odrzucone'].map(s =>
    `<button type="button" class="pbtn pbtn--${STATUS_CODE[s]}" data-act="status" data-no="${t.no}" data-to="${s}" aria-pressed="${t.status === s}">${s}</button>`).join('');
  const hist = t.history.slice().reverse();
  return {
    title: `#${t.no} ${t.title}`,
    html: `
<nav class="crumbs" aria-label="Ścieżka"><a href="#/">Pulpit</a><span aria-hidden="true">/</span>${clientLink(c)}<span aria-hidden="true">/</span><span>#${t.no}</span></nav>
<header class="job__head">
  <span class="stampno stampno--xl">#${t.no}</span>
  <div class="job__hd">
    <h1 class="job__title">${esc(t.title)}</h1>
    <p class="job__meta">${clientLink(c)} <span>·</span> ${prioTag(t.priority)} <span>·</span> ${statusTag(t.status)} <span>·</span> źródło: ${t.source}${t.byClient ? ' <span>·</span> z panelu klienta' : ''}</p>
  </div>
  <button type="button" class="btn" data-act="edit-ticket" data-no="${t.no}">Edytuj</button>
</header>
<div class="job">
  <article class="job__main card ${pkgClass(t.pkg)}">
    <section class="job__sec">
      <h2 class="lbl">Opis</h2>
      ${t.desc ? `<p class="job__desc">${esc(t.desc)}</p>` : '<p class="note">Bez opisu.</p>'}
    </section>
    <section class="job__sec">
      <h2 class="lbl" id="stHead">Status</h2>
      <div class="pbtns" role="group" aria-labelledby="stHead">${t.status === 'Nowe' ? '<span class="pbtn pbtn--new" aria-current="true">Nowe</span>' : ''}${statusBtns}</div>
      <p class="note">${t.status === 'Nowe' ? `Pierwsza zmiana statusu odbije godzinę reakcji: ${fmtDT(Math.max(now, t.receivedAt))}. Do statusu Nowe nie da się wrócić.` : 'Zrobione i Odrzucone odbijają godzinę zamknięcia, powrót do W toku albo Czeka na klienta ją kasuje. Pomyłkę zamyka się statusem Odrzucone.'}</p>
    </section>
    <section class="job__sec">
      <h2 class="lbl">Jak liczony jest termin reakcji</h2>
      ${traceView(t, now)}
    </section>
    <section class="job__sec">
      <div class="subhead"><h2 class="lbl">Wpisy czasu</h2><button type="button" class="btn btn--small" data-act="new-entry" data-client="${c.id}" data-ticket="${t.no}">+ Czas</button></div>
      ${entries.length ? `<table class="ledger">
        <caption class="sr-only">Wpisy czasu przy zgłoszeniu #${t.no}</caption>
        <thead><tr><th scope="col">Data</th><th scope="col">Rodzaj</th><th scope="col" class="num">Godziny</th><th scope="col">Opis</th><th scope="col"><span class="sr-only">Akcje</span></th></tr></thead>
        <tbody>${entries.map(e => `<tr><td class="mono">${fmtDn(dnFromISO(e.date))}</td><td>${kindTag(e.kind)}</td><td class="num mono">${fmtHours(e.hours)}</td><td>${esc(e.desc) || '—'}</td><td class="ledger__acts">${entryActs(e)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row" colspan="2">Razem</th><td class="num mono">${fmtHours(sumHours(entries))}</td><td colspan="2"></td></tr></tfoot>
      </table>` : '<p class="note">Brak wpisów czasu.</p>'}
    </section>
    <section class="job__sec">
      <h2 class="lbl">Historia</h2>
      ${hist.length ? `<ol class="hist">${hist.map(h => `<li><span class="mono">${fmtDT(h.at)}</span> ${h.field}: ${esc(h.from)} → ${esc(h.to)}</li>`).join('')}</ol>` : '<p class="note">Bez zmian od przyjęcia.</p>'}
    </section>
  </article>
  <aside class="punch" aria-label="Odbicia">
    <p class="punch__print"><span>Odbicia</span><span>#${t.no}</span></p>
    <div class="punch__row"><span class="lbl">Przyjęte</span><span class="stamp">${fmtDT(t.receivedAt)}</span><small>${DOW_SHORT[wParts(t.receivedAt).dow]} · ${t.source}</small></div>
    <div class="punch__row punch__row--dl"><span class="lbl">Termin reakcji</span><span class="printed">${fmtDT(t.deadline)}</span><small>${DOW_SHORT[wParts(t.deadline).dow]} · ${ruleLabel(RULES[t.pkg][t.priority])}</small></div>
    <div class="punch__row"><span class="lbl">Reakcja</span>
      ${t.reactedAt != null ? `<span class="stamp${late ? ' stamp--red' : ''}">${fmtDT(t.reactedAt)}</span><small>po ${fmtDur(t.reactedAt - t.receivedAt)}</small>
      <details class="fix"><summary>Popraw godzinę reakcji</summary>
        <form data-form="reaction" data-no="${t.no}" novalidate>
          <div class="fld"><label for="rxIn">Reakcja o</label><input type="datetime-local" id="rxIn" name="reactedAt" value="${toLocalInput(t.reactedAt)}" aria-describedby="e-reactedAt"><p class="fld__err" id="e-reactedAt" data-err="reactedAt"></p></div>
          <p class="note">Np. gdy odpowiedź mailem poszła wcześniej. Nie wcześniej niż przyjęcie, nie w przyszłości.</p>
          <button type="submit" class="btn btn--small btn--ink">Zapisz</button>
        </form>
      </details>` : '<span class="stamp stamp--empty">czeka</span>'}
    </div>
    <div class="punch__row"><span class="lbl">Zamknięte</span>${t.closedAt != null ? `<span class="stamp">${fmtDT(t.closedAt)}</span><small>${t.status}</small>` : '<span class="stamp stamp--empty">otwarte</span>'}</div>
    <div class="punch__sla"><span class="lbl">Stan SLA</span>${slaTag(t, now)}</div>
    <div class="punch__sum"><span class="lbl">Czas przy zgłoszeniu</span><span class="mono">${fmtHours(sumHours(entries))} h</span></div>
  </aside>
</div>`,
  };
}
const entryActs = e => `<button type="button" class="ibtn" data-act="edit-entry" data-id="${e.id}" aria-label="Popraw wpis z ${fmtDn(dnFromISO(e.date))}, ${fmtHours(e.hours)} h">Popraw</button><button type="button" class="ibtn ibtn--red" data-act="del-entry" data-id="${e.id}" aria-label="Usuń wpis z ${fmtDn(dnFromISO(e.date))}, ${fmtHours(e.hours)} h">Usuń</button>`;

// ---------- time entries (C) ----------
const ymNav = (ym, href) => `<nav class="monthnav" aria-label="Miesiąc"><a href="${href(ymShift(ym, -1))}" aria-label="Poprzedni miesiąc: ${ymLabel(ymShift(ym, -1))}">←</a><span>${ymLabel(ym)}</span><a href="${href(ymShift(ym, 1))}" aria-label="Następny miesiąc: ${ymLabel(ymShift(ym, 1))}">→</a></nav>`;
function viewTime(q) {
  const ym = /^\d{4}-\d{2}$/.test(q.miesiac || '') ? q.miesiac : ymNow();
  const cid = clientById(q.klient) ? q.klient : '';
  const list = DB.entries.filter(e => e.date.startsWith(ym) && (!cid || e.clientId === cid))
    .sort((a, b) => b.date.localeCompare(a.date) || +b.id.slice(1) - +a.id.slice(1));
  const href = m => `#/czas?miesiac=${m}${cid ? '&klient=' + cid : ''}`;
  const days = [...new Set(list.map(e => e.date))];
  const tot = k => fmtHours(sumHours(list.filter(e => e.kind === k)));
  return {
    title: 'Czas pracy',
    html: `
${pageHead('Czas pracy', 'Wpis należy do miesiąca według swojej daty. Pula zmniejsza pakiet, Utrzymanie jest w cenie, Dodatkowe płatne stawką.', `
  ${ymNav(ym, href)}
  <div class="fld fld--inline"><label for="timeClient">Klient</label><select id="timeClient" data-filter="time" data-ym="${ym}">${clientOptions(cid, { all: 'wszyscy klienci' })}</select></div>
  <button type="button" class="btn btn--ink" data-act="new-entry" data-client="${cid}">+ Dodaj czas</button>`)}
<dl class="counter">
  <div><dt>Pula</dt><dd>${tot('Pula')} h</dd></div>
  <div><dt>Utrzymanie</dt><dd>${tot('Utrzymanie')} h</dd></div>
  <div><dt>Dodatkowe</dt><dd>${tot('Dodatkowe')} h</dd></div>
  <div><dt>Razem</dt><dd>${fmtHours(sumHours(list))} h</dd></div>
</dl>
${list.length ? `<div class="roll">${days.map(d => `
  <section class="roll__day" aria-label="${fmtDn(dnFromISO(d))}">
    <h2 class="roll__date"><span>${DOW_SHORT[dowOf(dnFromISO(d))]}</span> ${fmtDn(dnFromISO(d))}</h2>
    <ul class="roll__list">${list.filter(e => e.date === d).map(e => {
      const c = clientById(e.clientId), t = e.ticketNo ? ticketByNo(e.ticketNo) : null;
      return `<li class="roll__e">
        <span class="roll__h mono">${fmtHours(e.hours)}<small> h</small></span>
        ${kindTag(e.kind)}
        <span class="roll__what">${clientLink(c)}${t ? ` · <a href="#/z/${t.no}">#${t.no} ${esc(t.title)}</a>` : ' · <span class="note">bez zgłoszenia</span>'}<small>${esc(e.desc) || '—'}</small></span>
        <span class="roll__acts">${entryActs(e)}</span>
      </li>`;
    }).join('')}</ul>
  </section>`).join('')}</div>` : `<div class="empty"><p class="empty__stamp">0 h</p><p>Brak wpisów w miesiącu ${ymLabel(ym)}${cid ? ' dla tego klienta' : ''}.</p></div>`}`,
  };
}

// ---------- month and report (M) ----------
function viewMonth(id, ym) {
  const c = clientById(id);
  if (!c || !/^\d{4}-\d{2}$/.test(ym)) return notFound();
  const s = monthSummary(id, ym);
  const [y, m] = ym.split('-').map(Number);
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = wParts(clock.now()).dn;
  const rows = [];
  for (let d = 1; d <= daysIn; d++) {
    const dn = dnOf(y, m, d), iso = isoOf(dn), es = s.entries.filter(e => e.date === iso);
    const sum = k => { const h = sumHours(es.filter(e => e.kind === k)); return h ? fmtHours(h) : ''; };
    const hol = holidayName(dn), dow = dowOf(dn), off = hol || dow === 0 || dow === 6;
    const what = es.map(e => { const t = e.ticketNo ? ticketByNo(e.ticketNo) : null; return `<span>${t ? `<a href="#/z/${t.no}">#${t.no}</a> ` : ''}${esc(e.desc || (t ? t.title : '—'))}</span>`; }).join('');
    rows.push(`<tr class="${off ? 'tc--off' : ''}${dn === today ? ' tc--today' : ''}${es.length ? ' tc--has' : ''}">
      <th scope="row"><b>${pad(d)}</b> <span>${DOW_SHORT[dow]}</span></th>
      <td class="num">${sum('Pula')}</td><td class="num">${sum('Utrzymanie')}</td><td class="num">${sum('Dodatkowe')}</td>
      <td class="tc__what">${what || (hol ? `<span class="tc__hol">${hol}</span>` : '')}</td>
    </tr>`);
  }
  const href = m2 => `#/klient/${id}/${m2}`;
  return {
    title: `${c.name}: ${ymLabel(ym)}`,
    html: `
<nav class="crumbs" aria-label="Ścieżka"><a href="#/klienci">Klienci</a><span aria-hidden="true">/</span>${clientLink(c)}<span aria-hidden="true">/</span><span>${ymLabel(ym)}</span></nav>
${pageHead(`Karta miesiąca: ${esc(c.name)}`, `Pakiet ${c.pkg}. Cena abonamentu i stawka według bieżących danych klienta i Ustawień, także dla minionych miesięcy.`, `
  ${ymNav(ym, href)}
  <button type="button" class="btn btn--ink" data-act="report" data-client="${id}" data-ym="${ym}">Raport</button>`)}
<div class="month">
  <section class="tc card ${pkgClass(c.pkg)}" aria-label="Karta miesięczna">
    <p class="card__print"><span>Karta miesięczna · ${esc(c.name)}</span><span>${ymLabel(ym)}</span></p>
    <table class="tc__t">
      <caption class="sr-only">Godziny według dni i rodzaju, ${ymLabel(ym)}</caption>
      <thead><tr><th scope="col">Dzień</th><th scope="col" class="num">Pula</th><th scope="col" class="num">Utrzym.</th><th scope="col" class="num">Dodatk.</th><th scope="col">Zgłoszenie, opis</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot><tr><th scope="row">Razem</th><td class="num">${fmtHours(s.pool)}</td><td class="num">${fmtHours(s.maint)}</td><td class="num">${fmtHours(s.extra)}</td><td><b class="mono">${fmtHours(s.total)} h</b></td></tr></tfoot>
    </table>
  </section>
  <aside class="settle card" aria-labelledby="settleH">
    <p class="card__print"><span>Rozliczenie</span><span>dla właściciela</span></p>
    <h2 class="sr-only" id="settleH">Podsumowanie miesiąca</h2>
    <dl class="form-rows">
      <div><dt>Pula</dt><dd class="mono">${fmtHours(s.pool)} z ${fmtHours(s.poolMax)} h</dd></div>
      ${s.over ? `<div class="form-rows__red"><dt>Nadwyżka</dt><dd>ponad pulę o ${fmtHours(s.over)} h</dd></div>` : ''}
    </dl>
    ${holes(s.pool, s.poolMax)}
    <dl class="form-rows">
      <div><dt>Utrzymanie</dt><dd class="mono">${fmtHours(s.maint)} h</dd></div>
      <div><dt>Dodatkowe</dt><dd class="mono">${fmtHours(s.extra)} h · ${fmtMoney(s.extraAmount)}</dd></div>
      <div class="form-rows__total"><dt>Razem godzin</dt><dd class="mono">${fmtHours(s.total)} h</dd></div>
    </dl>
    <p class="lbl settle__h">Zgłoszenia przyjęte w miesiącu</p>
    <dl class="tally">
      <div><dt>wszystkie</dt><dd>${s.tickets}</dd></div>
      <div><dt>w terminie</dt><dd>${s.inTerm}</dd></div>
      <div class="${s.late ? 'tally--red' : ''}"><dt>spóźnione</dt><dd>${s.late}</dd></div>
      <div class="${s.noReaction ? 'tally--red' : ''}"><dt>bez reakcji</dt><dd>${s.noReaction}</dd></div>
    </dl>
    <div class="rate">
      <p class="lbl">Efektywna stawka</p>
      <p class="rate__v">${s.effective == null ? '—' : fmtMoney(s.effective) + '/h'}</p>
      <p class="note">(abonament ${fmtMoney(c.price)} + dodatkowe ${fmtMoney(s.extraAmount)}) / ${fmtHours(s.total)} h · stawka ${fmtMoney(DB.settings.rate)}/h</p>
    </div>
  </aside>
</div>`,
  };
}

// ---------- settings (U) ----------
function viewSettings(q) {
  const st = DB.settings;
  const year = /^\d{4}$/.test(q.rok || '') ? +q.rok : wParts(clock.now()).y;
  const hol = [...holidays(year)];
  const e = easter(year);
  const tests = SLA_EXAMPLES.map(([pkg, pr, rec, exp, what]) => {
    const got = reactionDeadline(fromLocalInput(rec), pkg, pr, DEFAULT_WINDOWS), ok = toLocalInput(got) === exp;
    return `<tr><td>${pkg}</td><td>${pr}</td><td class="mono">${fmtDTdow(fromLocalInput(rec))}</td><td class="mono">${fmtDTdow(got)}</td><td>${what}</td><td class="${ok ? 'ok' : 'bad'}">${ok ? '✓ zgodny' : '✗ inny niż ' + exp}</td></tr>`;
  }).join('');
  const t = (k, end) => `<input type="time" id="s-${k}-${end}" name="${k}-${end}" value="${pad(Math.floor(st[k][end] / 60))}:${pad(st[k][end] % 60)}" step="900" aria-describedby="e-${k}">`;
  return {
    title: 'Ustawienia',
    html: `
${pageHead('Ustawienia', 'Nowe godziny okien obowiązują tylko zgłoszenia przyjęte po zapisie. Istniejące zgłoszenia mają swoje reguły zapamiętane.')}
<div class="settings">
  <form class="card setform" data-form="settings" novalidate>
    <p class="card__print"><span>Okna obsługi i stawka</span><span>U-1 · U-2</span></p>
    <fieldset class="fset"><legend>Okno dni roboczych <small>pn–pt bez świąt</small></legend>
      <div class="fset__row"><div class="fld"><label for="s-biz-from">od</label>${t('biz', 'from')}</div><div class="fld"><label for="s-biz-to">do</label>${t('biz', 'to')}</div></div>
      <p class="fld__err" id="e-biz" data-err="biz"></p>
    </fieldset>
    <fieldset class="fset"><legend>Okno codzienne <small>każdy dzień, także święta</small></legend>
      <div class="fset__row"><div class="fld"><label for="s-day-from">od</label>${t('day', 'from')}</div><div class="fld"><label for="s-day-to">do</label>${t('day', 'to')}</div></div>
      <p class="fld__err" id="e-day" data-err="day"></p>
    </fieldset>
    <div class="fld"><label for="s-rate">Stawka za prace dodatkowe (zł/h)</label><input type="text" inputmode="decimal" id="s-rate" name="rate" value="${String(st.rate).replace('.', ',')}" aria-describedby="e-rate"><p class="fld__err" id="e-rate" data-err="rate"></p></div>
    <p class="note">Okno obejmuje godzinę otwarcia, ale nie zamknięcia: zgłoszenie z 17:00 przychodzi już po zamknięciu.</p>
    <button type="submit" class="btn btn--ink">Zapisz ustawienia</button>
  </form>

  <section class="card" aria-labelledby="holH">
    <p class="card__print"><span>Kalendarz świąt</span><span>S-6</span></p>
    <div class="subhead"><h2 id="holH">Święta ${year}</h2>
      <nav class="monthnav" aria-label="Rok"><a href="#/ustawienia?rok=${year - 1}" aria-label="Rok ${year - 1}">←</a><span>${year}</span><a href="#/ustawienia?rok=${year + 1}" aria-label="Rok ${year + 1}">→</a></nav></div>
    <p class="note">Liczone z reguł: Wielkanoc ${fmtDn(e)}, Zielone Świątki +49 dni, Boże Ciało +60 dni (${fmtDn(e + 60)}).${year >= 2025 ? ' Wigilia wolna od 2025.' : ''}</p>
    <ul class="hols">${hol.map(([dn, name]) => `<li class="${dowOf(dn) === 0 || dowOf(dn) === 6 ? 'hols--we' : ''}"><span class="mono">${fmtDn(dn).slice(0, 5)}</span><span>${DOW_SHORT[dowOf(dn)]}</span><span>${name}</span></li>`).join('')}</ul>
  </section>

  <section class="card settings__wide" aria-labelledby="slaH">
    <p class="card__print"><span>Kontrakt SLA</span><span>przykłady z tabeli S przy domyślnych oknach</span></p>
    <h2 id="slaH" class="sr-only">Przykłady terminów reakcji</h2>
    <div class="scroll"><table class="ledger ledger--tight">
      <thead><tr><th scope="col">Pakiet</th><th scope="col">Priorytet</th><th scope="col">Przyjęte</th><th scope="col">Termin reakcji</th><th scope="col">Co sprawdza</th><th scope="col">Wynik</th></tr></thead>
      <tbody>${tests}</tbody>
    </table></div>
    <p class="note">Ten sam kod liczy terminy w aplikacji i w danych demo. Reguły według pakietu i priorytetu:</p>
    <div class="scroll"><table class="ledger ledger--tight">
      <thead><tr><th scope="col">Priorytet</th>${PACKAGES.map(p => `<th scope="col">${p}</th>`).join('')}</tr></thead>
      <tbody>${PRIORITIES.map(pr => `<tr><th scope="row">${pr}</th>${PACKAGES.map(p => `<td>${ruleLabel(RULES[p][pr])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
  </section>

  <section class="card settings__wide" aria-labelledby="accH">
    <p class="card__print"><span>Konto i polecenia serwisowe</span><span>L · O · Q</span></p>
    <h2 id="accH" class="sr-only">Konto</h2>
    <dl class="form-rows">
      <div><dt>Konto</dt><dd>${esc(ACCOUNT.email)} · rola owner · TOTP ${store.get('totp', false) ? 'włączone' : 'nieskonfigurowane'}</dd></div>
      <div><dt>Sesja</dt><dd>ciasteczko HttpOnly, Secure, SameSite=Strict · ważna 7 dni od ostatniej aktywności</dd></div>
    </dl>
    <ul class="cmds">
      <li><code>dotnet run -- create-user --email &lt;e-mail&gt;</code><span>hasło ze standardowego wejścia, co najmniej 12 znaków</span></li>
      <li><code>dotnet run -- set-password --email &lt;e-mail&gt;</code><span>kończy wszystkie sesje konta</span></li>
      <li><code>dotnet run -- reset-totp --email &lt;e-mail&gt;</code><span>następne logowanie prowadzi do konfiguracji kodu</span></li>
      <li><code>dotnet run -- backup &lt;plik&gt;</code><span>spójna kopia bazy przy działającej aplikacji (VACUUM INTO)</span></li>
      <li><code>dotnet run -- reset-demo</code><span>dane demo od nowa, konta i sesje zostają; w Production odmawia</span></li>
    </ul>
  </section>
</div>`,
  };
}

// ---------- client panel (simulated client accounts) ----------
const STATUS_HINT = { 'Nowe': 'czeka na reakcję', 'W toku': 'pracujemy nad tym', 'Czeka na klienta': 'potrzebujemy informacji od Ciebie', 'Zrobione': 'gotowe', 'Odrzucone': 'zamknięte bez realizacji' };
function syncRoleSelect() {
  const sel = $('#roleSelect');
  if (!sel) return;
  const s = store.get('session', null), on = s && Date.now() - s.last < 7 * DAY;
  sel.innerHTML = `${on ? '' : '<option value="">niezalogowany</option>'}<option value="owner">Właściciel</option><optgroup label="Panel klienta (${portalClients().length})">${portalClients().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`;
  sel.value = !on ? '' : s.role === 'client' ? s.clientId : 'owner';
}
function renderPortalShell(c, preview) {
  root.innerHTML = `
${preview ? `<div class="previewbar"><div class="wrap previewbar__in"><span>Podgląd panelu klienta <b>${esc(c.name)}</b>: tak to widzi klient.</span><button type="button" class="btn btn--small" data-act="portal-exit">Wróć do widoku właściciela</button></div></div>` : ''}
<header class="machine machine--portal" data-pid="${c.id}">
  <div class="wrap machine__in">
    ${plate()}
    ${lcd()}
    <div class="lamps" id="lamps">${lampsHTML()}</div>
    <div class="machine__keys"><a class="key key--red" href="#/nowe">+ Zgłoszenie</a></div>
  </div>
  <nav class="tabs" aria-label="Panel klienta">
    <div class="wrap tabs__in">
      <a href="#/" data-nav="">Zgłoszenia</a><a href="#/godziny" data-nav="godziny">Godziny i raporty</a>
      <span class="tabs__who"><span>${esc(c.name)}</span><span class="tabs__role">klient</span></span>
      ${preview ? '' : '<button type="button" class="tabs__out" data-act="logout">Wyloguj</button>'}
    </div>
  </nav>
</header>
<main id="app" class="wrap page" tabindex="-1"></main>
<footer class="foot"><div class="wrap foot__in"><p class="foot__name">Panel klienta</p><p>${esc(c.name)} · pakiet ${c.pkg}. Lampki w nagłówku pokazują, czy teraz biegnie czas reakcji. Pilne sprawy poza panelem: telefon.</p></div></footer>`;
}
function renderPortal(pid, force) {
  const s = store.get('session', null), preview = s.role !== 'client', c = clientById(pid);
  const m = $('.machine--portal');
  if (force || !m || m.dataset.pid !== pid || !!$('.previewbar') !== preview) renderPortalShell(c, preview);
  const { parts, q } = parseHash();
  const route = 'p/' + parts.join('/');
  let v;
  switch (parts[0]) {
    case undefined: v = pList(c, q); break;
    case 'z': v = pTicket(c, +parts[1]); break;
    case 'nowe': v = pNew(c); break;
    case 'godziny': v = pHours(c, q); break;
    default: v = notFound();
  }
  const app = $('#app');
  app.innerHTML = v.html;
  document.title = `${v.title} · ${c.name} · ClientTracker`;
  const sect = parts[0] === 'godziny' ? 'godziny' : parts[0] === 'nowe' ? 'nowe' : '';
  $$('[data-nav]').forEach(a => { if (a.dataset.nav === sect) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#lamps').innerHTML = lampsHTML();
  if (v.after) v.after();
  if (route !== lastRoute) { window.scrollTo(0, 0); if (lastRoute !== null) app.focus({ preventScroll: true }); }
  lastRoute = route;
  tick();
}
function pList(c, q) {
  const ym = ymNow(), now = clock.now(), all = clientTickets(c.id), used = poolUsed(c.id, ym);
  const f = ['zamkniete', 'wszystkie'].includes(q.f) ? q.f : 'otwarte';
  const list = all.filter(t => f === 'wszystkie' || (f === 'otwarte' ? isOpenStatus(t.status) : isClosed(t.status)));
  const reacted = all.filter(t => t.reactedAt != null), waiting = all.filter(t => t.status === 'Czeka na klienta');
  const tab = (k, label, n) => `<a href="#/?f=${k}"${k === f ? ' aria-current="true"' : ''}>${label} <span>${n}</span></a>`;
  return {
    title: 'Zgłoszenia',
    html: `
${pageHead('Twoje zgłoszenia', `${esc(c.name)} · pakiet ${c.pkg}. Każde zgłoszenie to karta w stojaku, a reakcję odbijamy na niej z godziną.`, '<a class="btn btn--ink" href="#/nowe">+ Nowe zgłoszenie</a>')}
${waiting.length ? `<p class="formerr">Czekamy na Twoją odpowiedź: ${waiting.map(t => `<a href="#/z/${t.no}">#${t.no} ${esc(t.title)}</a>`).join(', ')}</p>` : ''}
<div class="pgrid">
  <section class="card ${pkgClass(c.pkg)}" aria-label="Twój pakiet">
    <p class="card__print"><span>Karta klienta</span><span>${ymLabel(ym)}</span></p>
    <dl class="form-rows"><div><dt>Pula na zmiany</dt><dd class="mono">${poolText(used, c.pool)}</dd></div></dl>
    ${holes(used, c.pool)}
    <p class="lbl">Czas reakcji w pakiecie ${c.pkg}</p>
    <dl class="form-rows">${PRIORITIES.map(p => `<div><dt>${p}</dt><dd>${ruleLabel(RULES[c.pkg][p])}</dd></div>`).join('')}</dl>
  </section>
  <div>
    <dl class="counter">
      <div><dt>Otwarte</dt><dd>${all.filter(t => isOpenStatus(t.status)).length}</dd></div>
      <div class="${waiting.length ? 'counter--red' : ''}"><dt>Czeka na Ciebie</dt><dd>${waiting.length}</dd></div>
      <div><dt>Reakcja w terminie</dt><dd>${reacted.filter(t => t.reactedAt <= t.deadline).length}/${reacted.length}</dd></div>
    </dl>
    <nav class="seg" aria-label="Filtr">${tab('otwarte', 'Otwarte', all.filter(t => isOpenStatus(t.status)).length)}${tab('zamkniete', 'Zamknięte', all.filter(t => isClosed(t.status)).length)}${tab('wszystkie', 'Wszystkie', all.length)}</nav>
    ${list.length ? `<div class="rack rack--compact"><table class="rack__t">
      <caption class="sr-only">Twoje zgłoszenia</caption>
      <thead><tr><th scope="col">Nr</th><th scope="col">Tytuł</th><th scope="col">Priorytet</th><th scope="col">Status</th><th scope="col">Termin reakcji</th><th scope="col">Stan SLA</th></tr></thead>
      <tbody>${list.map(t => rackRow(t, now, { client: false })).join('')}</tbody></table></div>`
      : `<div class="empty empty--small"><p>${f === 'otwarte' ? 'Nie masz otwartych zgłoszeń.' : 'Brak zgłoszeń.'}</p></div>`}
  </div>
</div>`,
  };
}
function pTicket(c, no) {
  const t = ticketByNo(no);
  if (!t || t.clientId !== c.id) return notFound();
  const now = clock.now(), entries = entriesOfTicket(t.no), late = t.reactedAt != null && t.reactedAt > t.deadline;
  const visited = new Set(['Nowe', ...t.history.filter(h => h.field === 'status').map(h => h.to)]);
  const st = s => `<span class="pbtn pbtn--${STATUS_CODE[s]}${visited.has(s) && s !== t.status ? ' pbtn--was' : ''}"${s === t.status ? ' aria-current="step"' : ''}>${s}</span>`;
  const hist = t.history.filter(h => h.field === 'status').slice().reverse();
  return {
    title: `#${t.no} ${t.title}`,
    html: `
<nav class="crumbs" aria-label="Ścieżka"><a href="#/">Zgłoszenia</a><span aria-hidden="true">/</span><span>#${t.no}</span></nav>
<header class="job__head">
  <span class="stampno stampno--xl">#${t.no}</span>
  <div class="job__hd"><h1 class="job__title">${esc(t.title)}</h1><p class="job__meta">${prioTag(t.priority)} <span>·</span> ${statusTag(t.status)} <span>·</span> ${STATUS_HINT[t.status]}</p></div>
</header>
<div class="job">
  <article class="job__main card ${pkgClass(t.pkg)}">
    <section class="job__sec">
      <h2 class="lbl">Gdzie jest Twoje zgłoszenie</h2>
      <div class="pflow" role="group" aria-label="Status zgłoszenia">
        <div class="pflow__col">${st('Nowe')}</div><span class="pflow__arrow" aria-hidden="true">→</span>
        <div class="pflow__col"><span class="lbl">W pracy</span>${st('W toku')}${st('Czeka na klienta')}</div><span class="pflow__arrow" aria-hidden="true">→</span>
        <div class="pflow__col"><span class="lbl">Zamknięte</span>${st('Zrobione')}${st('Odrzucone')}</div>
      </div>
      <p class="note">Teraz: <b>${t.status}</b>, ${STATUS_HINT[t.status]}. Gwarantujemy czas reakcji, nie naprawy.</p>
    </section>
    <section class="job__sec"><h2 class="lbl">Opis</h2>${t.desc ? `<p class="job__desc">${esc(t.desc)}</p>` : '<p class="note">Bez opisu.</p>'}</section>
    <section class="job__sec">
      <h2 class="lbl">Przepracowany czas</h2>
      ${entries.length ? `<table class="ledger"><caption class="sr-only">Czas pracy przy zgłoszeniu #${t.no}</caption>
        <thead><tr><th scope="col">Data</th><th scope="col">Rodzaj</th><th scope="col" class="num">Godziny</th><th scope="col">Opis</th></tr></thead>
        <tbody>${entries.map(e => `<tr><td class="mono">${fmtDn(dnFromISO(e.date))}</td><td>${kindTag(e.kind)}</td><td class="num mono">${fmtHours(e.hours)}</td><td>${esc(e.desc) || '—'}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row" colspan="2">Razem</th><td class="num mono">${fmtHours(sumHours(entries))}</td><td></td></tr></tfoot></table>` : '<p class="note">Jeszcze nie ma wpisów.</p>'}
    </section>
    <section class="job__sec"><h2 class="lbl">Historia</h2>${hist.length ? `<ol class="hist">${hist.map(h => `<li><span class="mono">${fmtDT(h.at)}</span> ${esc(h.from)} → ${esc(h.to)}</li>`).join('')}</ol>` : '<p class="note">Bez zmian od przyjęcia.</p>'}</section>
  </article>
  <aside class="punch" aria-label="Odbicia">
    <p class="punch__print"><span>Odbicia</span><span>#${t.no}</span></p>
    <div class="punch__row"><span class="lbl">Przyjęte</span><span class="stamp">${fmtDT(t.receivedAt)}</span><small>${DOW_SHORT[wParts(t.receivedAt).dow]}</small></div>
    <div class="punch__row punch__row--dl"><span class="lbl">Termin reakcji</span><span class="printed">${fmtDT(t.deadline)}</span><small>${ruleLabel(RULES[t.pkg][t.priority])}</small></div>
    <div class="punch__row"><span class="lbl">Reakcja</span>${t.reactedAt != null ? `<span class="stamp${late ? ' stamp--red' : ''}">${fmtDT(t.reactedAt)}</span><small>po ${fmtDur(t.reactedAt - t.receivedAt)}</small>` : '<span class="stamp stamp--empty">czeka</span>'}</div>
    <div class="punch__row"><span class="lbl">Zamknięte</span>${t.closedAt != null ? `<span class="stamp">${fmtDT(t.closedAt)}</span>` : '<span class="stamp stamp--empty">otwarte</span>'}</div>
    <div class="punch__sla"><span class="lbl">Stan SLA</span>${slaTag(t, now)}</div>
  </aside>
</div>`,
  };
}
function pNew(c) {
  return {
    title: 'Nowe zgłoszenie',
    html: `
<nav class="crumbs" aria-label="Ścieżka"><a href="#/">Zgłoszenia</a><span aria-hidden="true">/</span><span>Nowe</span></nav>
${pageHead('Nowe zgłoszenie', `Przyjmujemy je w chwili wysłania i od razu odbijamy godzinę. Termin reakcji liczymy według pakietu ${c.pkg}.`)}
<form class="card pform ${pkgClass(c.pkg)}" data-form="portal-ticket" novalidate>
  <p class="card__print"><span>Karta zgłoszenia</span><span>${esc(c.name)}</span></p>
  ${fld('title', 'Czego dotyczy?', `<input type="text" ${ctl('title', 'required maxlength="160" autocomplete="off" placeholder="np. Nie działa formularz kontaktowy"')}>`)}
  ${fld('desc', 'Opis', `<textarea ${ctl('desc', 'rows="5" placeholder="Co się dzieje, od kiedy, na której stronie"')}></textarea>`)}
  ${radios('priority', 'Jak pilne?', PRIORITIES, 'Normalny', Object.fromEntries(PRIORITIES.map(p => [p, ruleLabel(RULES[c.pkg][p])])))}
  <p class="note">Krytyczny: strona albo sprzedaż nie działa. Wysoki: ważna funkcja działa źle. Normalny: zmiany i drobne poprawki.</p>
  <output class="preview" id="pPreview" aria-live="polite"></output>
  <div class="client__acts"><button type="submit" class="btn btn--ink">Wyślij zgłoszenie</button><a class="btn" href="#/">Anuluj</a></div>
</form>`,
    after() { portalPreview($('[data-form="portal-ticket"]')); $('#f-title').focus(); },
  };
}
function portalPreview(form) {
  const c = clientById(portalId()), pr = new FormData(form).get('priority');
  $('#pPreview', form).innerHTML = `<span class="lbl">Jeśli wyślesz teraz, zareagujemy najpóźniej</span><b class="mono">${fmtDTdow(reactionDeadline(clock.now(), c.pkg, pr, DB.settings))}</b><span>${ruleLabel(RULES[c.pkg][pr])}</span>`;
}
function pHours(c, q) {
  const ym = /^\d{4}-\d{2}$/.test(q.miesiac || '') ? q.miesiac : ymNow();
  const s = monthSummary(c.id, ym);
  const [y, m] = ym.split('-').map(Number), daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows = [];
  for (let d = 1; d <= daysIn; d++) {
    const dn = dnOf(y, m, d), iso = isoOf(dn), es = s.entries.filter(e => e.date === iso), dow = dowOf(dn), hol = holidayName(dn);
    const sum = k => { const h = sumHours(es.filter(e => e.kind === k)); return h ? fmtHours(h) : ''; };
    const what = es.map(e => { const t = e.ticketNo ? ticketByNo(e.ticketNo) : null; return `<span>${t ? `<a href="#/z/${t.no}">#${t.no}</a> ` : ''}${esc(e.desc || (t ? t.title : '—'))}</span>`; }).join('');
    rows.push(`<tr class="${hol || dow === 0 || dow === 6 ? 'tc--off' : ''}${es.length ? ' tc--has' : ''}"><th scope="row"><b>${pad(d)}</b> <span>${DOW_SHORT[dow]}</span></th><td class="num">${sum('Pula')}</td><td class="num">${sum('Utrzymanie')}</td><td class="num">${sum('Dodatkowe')}</td><td class="tc__what">${what || (hol ? `<span class="tc__hol">${hol}</span>` : '')}</td></tr>`);
  }
  return {
    title: `Godziny i raporty · ${ymLabel(ym)}`,
    html: `
${pageHead('Godziny i raporty', `Pakiet ${c.pkg}: ${c.pool ? `${fmtHours(c.pool)} h zmian w miesiącu` : 'bez puli godzin na zmiany'}, utrzymanie w cenie abonamentu.`, ymNav(ym, m2 => `#/godziny?miesiac=${m2}`))}
<div class="month">
  <section class="tc card ${pkgClass(c.pkg)}" aria-label="Karta miesięczna">
    <p class="card__print"><span>Karta miesięczna · ${esc(c.name)}</span><span>${ymLabel(ym)}</span></p>
    <table class="tc__t"><caption class="sr-only">Godziny według dni, ${ymLabel(ym)}</caption>
      <thead><tr><th scope="col">Dzień</th><th scope="col" class="num">Pula</th><th scope="col" class="num">Utrzym.</th><th scope="col" class="num">Dodatk.</th><th scope="col">Zgłoszenie, opis</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot><tr><th scope="row">Razem</th><td class="num">${fmtHours(s.pool)}</td><td class="num">${fmtHours(s.maint)}</td><td class="num">${fmtHours(s.extra)}</td><td><b class="mono">${fmtHours(s.total)} h</b></td></tr></tfoot>
    </table>
  </section>
  <aside class="settle card" aria-label="Podsumowanie">
    <p class="card__print"><span>Podsumowanie</span><span>${ymLabel(ym)}</span></p>
    <dl class="form-rows"><div><dt>Pula na zmiany</dt><dd class="mono">${fmtHours(s.pool)} z ${fmtHours(s.poolMax)} h</dd></div>${s.over ? `<div class="form-rows__red"><dt>Nadwyżka</dt><dd>ponad pulę o ${fmtHours(s.over)} h</dd></div>` : ''}</dl>
    ${holes(s.pool, s.poolMax)}
    <dl class="form-rows">
      <div><dt>Utrzymanie</dt><dd class="mono">${fmtHours(s.maint)} h</dd></div>
      <div><dt>Prace dodatkowe</dt><dd class="mono">${fmtHours(s.extra)} h</dd></div>
      <div class="form-rows__total"><dt>Razem</dt><dd class="mono">${fmtHours(s.total)} h</dd></div>
    </dl>
    <p class="note">Utrzymanie jest w cenie abonamentu. Prace dodatkowe są poza pakietem i rozliczane osobno.</p>
  </aside>
</div>
<section class="card md" aria-label="Raport miesięczny"><p class="card__print"><span>Raport miesięczny</span><span>${ymLabel(ym)}</span></p>${mdToHtml(monthReport(c.id, ym))}</section>`,
  };
}

// ---------- dialogs ----------
const fld =(name, label, control, hint = '') => `<div class="fld"><label for="f-${name}">${label}</label>${control}${hint ? `<p class="fld__hint">${hint}</p>` : ''}<p class="fld__err" id="e-${name}" data-err="${name}"></p></div>`;
const ctl = (name, attrs = '') => `id="f-${name}" name="${name}" aria-describedby="e-${name}" ${attrs}`;
const radios = (name, legend, opts, sel, desc = {}) => `<fieldset class="fset fset--radios"><legend>${legend}</legend><div class="radios">${opts.map(o =>
  `<label class="radio radio--${(PRIO_CODE[o] || KIND_CODE[o] || o).toString().toLowerCase()}"><input type="radio" name="${name}" value="${o}"${o === sel ? ' checked' : ''}><span>${o}${desc[o] ? `<small>${desc[o]}</small>` : ''}</span></label>`).join('')}</div><p class="fld__err" id="e-${name}" data-err="${name}"></p></fieldset>`;

let dlgReturn = null;
function openDialog({ title, body, submit = 'Zapisz', danger = false, wide = false, onSubmit, onInput }) {
  dlgReturn = document.activeElement;
  dlg.className = 'dlg' + (wide ? ' dlg--wide' : '');
  dlg.innerHTML = `<form class="dlg__form" novalidate>
    <header class="dlg__head"><h2 id="dlgTitle">${title}</h2><button type="button" class="dlg__x" data-act="dlg-close" aria-label="Zamknij">×</button></header>
    <div class="dlg__body">${body}</div>
    <footer class="dlg__foot"><button type="button" class="btn" data-act="dlg-close">${submit ? 'Anuluj' : 'Zamknij'}</button>${submit ? `<button type="submit" class="btn ${danger ? 'btn--red' : 'btn--ink'}">${submit}</button>` : ''}</footer>
  </form>`;
  const form = $('form', dlg);
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    try {
      const msg = onSubmit(form);
      dlg.close();
      render();
      if (msg) toast(msg);
    } catch (err) {
      if (err instanceof Invalid) showErrors(form, err.errors); else throw err;
    }
  });
  if (onInput) { form.addEventListener('input', ev => onInput(form, ev)); form.addEventListener('change', ev => onInput(form, ev)); onInput(form, null); }
  dlg.showModal();
  const first = $('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea', form);
  if (first) first.focus();
}
function closeDialog() { dlg.close(); }
dlg.addEventListener('close', () => { if (dlgReturn && document.contains(dlgReturn)) dlgReturn.focus(); });
function showErrors(form, errors) {
  $$('[data-err]', form).forEach(el => { el.textContent = ''; });
  $$('[aria-invalid]', form).forEach(el => el.removeAttribute('aria-invalid'));
  let first = null;
  for (const [k, msg] of Object.entries(errors)) {
    const el = $(`[data-err="${k}"]`, form);
    if (el) el.textContent = msg;
    const input = $(`[name="${k}"]`, form) || $(`[name^="${k}-"]`, form);
    if (input) { input.setAttribute('aria-invalid', 'true'); first = first || input; }
  }
  if (first) first.focus();
}

function ticketDialog(no, presetClient) {
  const t = no ? ticketByNo(no) : null;
  const now = clock.now();
  const activeClients = DB.clients.filter(c => c.active);
  const sel = t ? t.clientId : presetClient && clientById(presetClient)?.active ? presetClient : '';
  if (!t && !activeClients.length) return toast('Najpierw dodaj aktywnego klienta.', 'red');
  openDialog({
    title: t ? `Edycja zgłoszenia #${t.no}` : 'Nowe zgłoszenie',
    submit: t ? 'Zapisz zmiany' : 'Przyjmij zgłoszenie',
    wide: true,
    body: `
      <div class="grid2">
        ${fld('clientId', 'Klient', `<select ${ctl('clientId', t ? 'disabled' : 'required')}>${t ? `<option>${esc(clientById(t.clientId).name)}</option>` : `<option value="">wybierz klienta</option>${clientOptions(sel, { activeOnly: true })}`}</select>`, t ? 'Zgłoszenie zostaje u tego klienta.' : 'Lista pokazuje tylko aktywnych klientów.')}
        ${fld('receivedAt', 'Przyjęte o', `<input type="datetime-local" ${ctl('receivedAt', `required max="${toLocalInput(now)}"`)} value="${toLocalInput(t ? t.receivedAt : now)}">`, 'Godzina z maila albo telefonu. Nie w przyszłości.')}
      </div>
      ${fld('title', 'Tytuł', `<input type="text" ${ctl('title', 'required maxlength="160" autocomplete="off"')} value="${t ? esc(t.title) : ''}">`)}
      ${fld('desc', 'Opis', `<textarea ${ctl('desc', 'rows="3"')}>${t ? esc(t.desc) : ''}</textarea>`)}
      <div class="grid2">
        ${radios('priority', 'Priorytet', PRIORITIES, t ? t.priority : 'Normalny')}
        ${fld('source', 'Źródło', `<select ${ctl('source')}>${SOURCES.map(s => `<option${(t ? t.source : 'Mail') === s ? ' selected' : ''}>${s}</option>`).join('')}</select>`)}
      </div>
      <output class="preview" id="dlPreview" aria-live="polite"></output>`,
    onInput(form) {
      const fd = new FormData(form);
      const c = t ? clientById(t.clientId) : clientById(fd.get('clientId'));
      const rec = fromLocalInput(fd.get('receivedAt')), pr = fd.get('priority');
      const out = $('#dlPreview', form);
      if (!c || isNaN(rec) || !pr) { out.innerHTML = '<span class="lbl">Termin reakcji</span><span>wybierz klienta, godzinę i priorytet</span>'; return; }
      const pkg = t ? t.pkg : c.pkg, win = t ? t.win : DB.settings;
      const r = RULES[pkg][pr];
      out.innerHTML = `<span class="lbl">Termin reakcji (liczy serwer)</span><b class="mono">${fmtDTdow(reactionDeadline(rec, pkg, pr, win))}</b><span>${ruleLabel(r)} · pakiet ${pkg}${t ? ' z chwili przyjęcia' : ''} · okno ${r.h && r.win === 'day' ? 'codzienne ' + fmtMin(win.day.from) + '–' + fmtMin(win.day.to) : 'dni roboczych ' + fmtMin(win.biz.from) + '–' + fmtMin(win.biz.to)}</span>`;
    },
    onSubmit(form) {
      const fd = new FormData(form);
      const d = { title: fd.get('title'), desc: fd.get('desc'), priority: fd.get('priority'), source: fd.get('source'), receivedAt: fromLocalInput(fd.get('receivedAt')) };
      if (t) { updateTicket(t.no, d); return `Zapisano #${t.no}. Termin reakcji: ${fmtDT(t.deadline)}.`; }
      const n = createTicket({ ...d, clientId: fd.get('clientId') });
      location.hash = `#/z/${n.no}`;
      return `Przyjęto #${n.no}. Termin reakcji: ${fmtDTdow(n.deadline)}.`;
    },
  });
}

function entryDialog(id, preset = {}) {
  const e = id ? DB.entries.find(x => x.id === id) : null;
  const cid = e ? e.clientId : preset.client || '';
  const tno = e ? e.ticketNo : preset.ticket ? +preset.ticket : null;
  const ticketOpts = (clientId, selNo) => `<option value="">— bez zgłoszenia —</option>` +
    DB.tickets.filter(t => t.clientId === clientId).sort((a, b) => b.no - a.no)
      .map(t => `<option value="${t.no}"${t.no === selNo ? ' selected' : ''}>#${t.no} ${esc(t.title)}${isClosed(t.status) ? ` (${t.status.toLowerCase()})` : ''}</option>`).join('');
  openDialog({
    title: e ? 'Popraw wpis czasu' : 'Odbij czas pracy',
    submit: e ? 'Zapisz zmiany' : 'Zapisz wpis',
    wide: true,
    body: `
      <div class="grid2">
        ${fld('clientId', 'Klient', `<select ${ctl('clientId', 'required')}><option value="">wybierz klienta</option>${clientOptions(cid)}</select>`)}
        ${fld('ticketNo', 'Zgłoszenie (opcjonalnie)', `<select ${ctl('ticketNo')}>${ticketOpts(cid, tno)}</select>`, 'Tylko zgłoszenia wybranego klienta.')}
      </div>
      <div class="grid2">
        ${fld('date', 'Data', `<input type="date" ${ctl('date', 'required')} value="${e ? e.date : todayISO()}">`)}
        <div class="fld"><label for="f-hours">Czas (godziny)</label><input type="text" inputmode="decimal" ${ctl('hours', 'required autocomplete="off" placeholder="np. 1,5"')} value="${e ? fmtHours(e.hours) : ''}">
          <div class="quick" role="group" aria-label="Szybki wybór czasu">${[0.25, 0.5, 1, 1.5, 2, 4].map(h => `<button type="button" class="quick__b" data-quick="${fmtHours(h)}">${fmtHours(h)}</button>`).join('')}</div>
          <p class="fld__hint">Od 0,25 do 24 h, co 0,25 h. Przyjmuje 1,5 i 1.5.</p><p class="fld__err" id="e-hours" data-err="hours"></p></div>
      </div>
      ${radios('kind', 'Rodzaj', KINDS, e ? e.kind : 'Utrzymanie', { Pula: 'zmiany i promocje, odejmowane od puli pakietu', Utrzymanie: 'awarie, aktualizacje, backupy, w cenie abonamentu', Dodatkowe: `poza pakietem, ${fmtMoney(DB.settings.rate)}/h` })}
      ${fld('desc', 'Opis', `<input type="text" ${ctl('desc', 'maxlength="200" autocomplete="off"')} value="${e ? esc(e.desc) : ''}">`)}`,
    onInput(form, ev) {
      if (ev && ev.target.name === 'clientId') $('#f-ticketNo', form).innerHTML = ticketOpts(ev.target.value, null);
    },
    onSubmit(form) {
      const fd = new FormData(form);
      const d = { clientId: fd.get('clientId'), ticketNo: fd.get('ticketNo'), date: fd.get('date'), hours: fd.get('hours'), kind: fd.get('kind'), desc: fd.get('desc') };
      const x = e ? updateEntry(e.id, d) : createEntry(d);
      return `${e ? 'Poprawiono' : 'Odbito'}: ${fmtHours(x.hours)} h ${x.kind}, ${fmtDn(dnFromISO(x.date))}.`;
    },
  });
}

function clientDialog(id) {
  const c = id ? clientById(id) : null;
  const pkg = c ? c.pkg : 'Standard';
  openDialog({
    title: c ? `Edycja: ${esc(c.name)}` : 'Nowy klient',
    submit: c ? 'Zapisz zmiany' : 'Dodaj klienta',
    body: `
      ${fld('name', 'Nazwa', `<input type="text" ${ctl('name', 'required maxlength="120" autocomplete="off"')} value="${c ? esc(c.name) : ''}">`, 'Musi być unikalna.')}
      ${fld('email', 'E-mail kontaktowy', `<input type="email" ${ctl('email', 'autocomplete="off"')} value="${c ? esc(c.email) : ''}">`)}
      ${radios('pkg', 'Pakiet', PACKAGES, pkg, Object.fromEntries(PACKAGES.map(p => [p, `${fmtMoney(PACKAGE_DEFAULTS[p].price)} · ${fmtHours(PACKAGE_DEFAULTS[p].pool)} h`])))}
      <div class="grid2">
        ${fld('price', 'Cena abonamentu miesięcznie (zł)', `<input type="text" inputmode="decimal" ${ctl('price', 'required')} value="${String(c ? c.price : PACKAGE_DEFAULTS[pkg].price).replace('.', ',')}">`)}
        ${fld('pool', 'Pula godzin w miesiącu', `<input type="text" inputmode="decimal" ${ctl('pool', 'required')} value="${fmtHours(c ? c.pool : PACKAGE_DEFAULTS[pkg].pool)}">`)}
      </div>
      <p class="note">Wybór pakietu podpowiada cenę i pulę, obie można zmienić. Zmiana pakietu nie przesuwa terminów istniejących zgłoszeń.</p>
      ${c ? `<label class="check check--box"><input type="checkbox" name="active"${c.active ? ' checked' : ''}> Aktywny <small>nieaktywny znika z listy i nie przyjmuje zgłoszeń</small></label>` : ''}`,
    onInput(form, ev) {
      if (ev && ev.target.name === 'pkg') {
        const d = PACKAGE_DEFAULTS[ev.target.value];
        $('#f-price', form).value = String(d.price);
        $('#f-pool', form).value = fmtHours(d.pool);
      }
    },
    onSubmit(form) {
      const fd = new FormData(form);
      const num = v => { const n = parseHoursInput(v); return n; };
      const d = { name: fd.get('name'), email: fd.get('email'), pkg: fd.get('pkg'), price: num(fd.get('price')), pool: num(fd.get('pool')), active: fd.get('active') === 'on' };
      if (c) { updateClient(c.id, d); return `Zapisano: ${c.name}.`; }
      const n = createClient(d);
      location.hash = `#/klient/${n.id}`;
      return `Dodano klienta: ${n.name}.`;
    },
  });
}

function reportDialog(id, ym) {
  const md = monthReport(id, ym), c = clientById(id);
  openDialog({
    title: `Raport: ${esc(c.name)}, ${ymLabel(ym)}`,
    submit: null,
    wide: true,
    body: `
      <div class="fld"><label for="f-report">Markdown dla klienta</label><textarea id="f-report" class="report" rows="22" readonly>${esc(md)}</textarea></div>
      <div class="report__bar"><button type="button" class="btn btn--ink" data-act="copy-report">Kopiuj do schowka</button><p class="note">Bez kwot i efektywnej stawki. Sekcje z „…” uzupełniasz ręcznie: narzędzie nie ma danych o dostępności, backupach ani atakach.</p></div>`,
    onSubmit() {},
  });
}

function confirmDialog(title, text, submit, fn) {
  openDialog({ title, submit, danger: true, body: `<p>${text}</p>`, onSubmit: fn });
}

// ---------- events ----------
document.addEventListener('click', ev => {
  const row = ev.target.closest('tr[data-href]');
  if (row && !ev.target.closest('a, button')) { location.hash = row.dataset.href; return; }
  const q = ev.target.closest('[data-quick]');
  if (q) { const i = $('#f-hours'); i.value = q.dataset.quick; i.dispatchEvent(new Event('input', { bubbles: true })); return; }
  const b = ev.target.closest('[data-act]');
  if (!b) return;
  const d = b.dataset;
  switch (d.act) {
    case 'theme': return cycleTheme();
    case 'clock-live': clock.live(); toast('Zegar na żywo.'); return rerenderAll();
    case 'reset-demo': return confirmDialog('reset-demo', 'Usunąć klientów, zgłoszenia, wpisy czasu i Ustawienia, a potem wgrać dane demo? Konta i sesje zostają.', 'Wgraj dane demo', () => {
      resetDemo(); return `reset-demo: ${DB.clients.length} klientów, ${DB.tickets.length} zgłoszeń, ${DB.entries.length} wpisów czasu, domyślne Ustawienia. Sesja zachowana.`;
    });
    case 'logout': store.del('session'); login.step = 'password'; login.err = ''; toast('Wylogowano.'); return render();
    case 'fill-login': $('#lEmail').value = ACCOUNT.email; $('#lPass').value = ACCOUNT.password; return $('#loginForm button[type=submit]').focus();
    case 'fill-code': { const i = $('#lCode'); i.value = totpCode(totpStep()); return i.focus(); }
    case 'skip-login': return loginSucceeded();
    case 'skip-login-client': { const c = portalClients().find(x => x.id === 'c2') || portalClients()[0]; return c ? startSession('client', c.id) : toast('Żaden klient nie ma dostępu do panelu.', 'red'); }
    case 'portal-toggle': {
      const c = clientById(d.id);
      try { setPortal(c.id, !c.portal); } catch (err) { if (err instanceof Invalid) return toast(err.errors.portal, 'red'); throw err; }
      render();
      return toast(c.portal ? `${c.name}: dostęp do panelu włączony. Login: ${c.email}.` : `${c.name}: dostęp do panelu wyłączony, sesje klienta zakończone.`);
    }
    case 'portal-preview': { const s = store.get('session', null); store.set('session', { ...s, as: d.id }); location.hash = '#/'; return render(true); }
    case 'portal-exit': { const s = store.get('session', null), id = s.as; delete s.as; store.set('session', s); location.hash = `#/klient/${id}`; return render(true); }
    case 'login-back': login.step = 'password'; login.err = ''; return renderLogin();
    case 'new-ticket': return ticketDialog(null, d.client);
    case 'edit-ticket': return ticketDialog(+d.no);
    case 'status': {
      const before = ticketByNo(+d.no), wasNew = before.status === 'Nowe';
      setStatus(+d.no, d.to);
      const t = ticketByNo(+d.no);
      render();
      return toast(wasNew ? `#${t.no}: ${t.status}. Odbito reakcję ${fmtDT(t.reactedAt)} (${slaState(t, clock.now()).text.toLowerCase()}).` : `#${t.no}: ${t.status}.`);
    }
    case 'new-entry': return entryDialog(null, { client: d.client, ticket: d.ticket });
    case 'edit-entry': return entryDialog(d.id);
    case 'del-entry': {
      const e = DB.entries.find(x => x.id === d.id);
      return confirmDialog('Usunąć wpis czasu?', `${fmtDn(dnFromISO(e.date))} · ${fmtHours(e.hours)} h ${e.kind} · ${esc(clientById(e.clientId).name)}${e.desc ? ' · ' + esc(e.desc) : ''}`, 'Usuń wpis', () => { deleteEntry(e.id); return 'Usunięto wpis.'; });
    }
    case 'new-client': return clientDialog(null);
    case 'edit-client': return clientDialog(d.id);
    case 'report': return reportDialog(d.client, d.ym);
    case 'copy-report': {
      const ta = $('#f-report');
      const done = () => toast('Raport skopiowany.');
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); document.execCommand('copy'); done(); });
      else { ta.select(); document.execCommand('copy'); done(); }
      return;
    }
    case 'dlg-close': return closeDialog();
  }
});
document.addEventListener('input', ev => {
  const pf = ev.target.closest('[data-form="portal-ticket"]');
  if (pf) portalPreview(pf);
});
document.addEventListener('change', ev => {
  if (ev.target.id === 'roleSelect') return ev.target.value === 'owner' ? startSession('owner') : ev.target.value ? startSession('client', ev.target.value) : null;
  const f = ev.target.dataset.filter;
  if (f === 'dash') location.hash = ev.target.value ? `#/?klient=${ev.target.value}` : '#/';
  if (f === 'inactive') location.hash = ev.target.checked ? '#/klienci?nieaktywni=1' : '#/klienci';
  if (f === 'time') location.hash = `#/czas?miesiac=${ev.target.dataset.ym}${ev.target.value ? '&klient=' + ev.target.value : ''}`;
});
document.addEventListener('submit', ev => {
  const form = ev.target;
  if (form.id === 'loginForm') { ev.preventDefault(); return submitLogin(form); }
  if (form.id === 'clockForm') {
    ev.preventDefault();
    const ms = fromLocalInput($('#clockInput').value);
    if (isNaN(ms)) return toast('Podaj datę i godzinę.', 'red');
    clock.set(ms); toast(`Zegar makiety: ${fmtDTdow(ms)}.`);
    return rerenderAll();
  }
  const kind = form.dataset.form;
  if (!kind) return;
  ev.preventDefault();
  try {
    if (kind === 'portal-ticket') {
      const fd = new FormData(form);
      const t = fileClientTicket(portalId(), { title: fd.get('title'), desc: fd.get('desc'), priority: fd.get('priority') });
      location.hash = `#/z/${t.no}`;
      toast(`Wysłano zgłoszenie #${t.no}. Zareagujemy najpóźniej ${fmtDTdow(t.deadline)}.`);
    }
    if (kind === 'reaction') { setReaction(+form.dataset.no, fromLocalInput(new FormData(form).get('reactedAt'))); render(); toast('Poprawiono godzinę reakcji.'); }
    if (kind === 'settings') {
      const fd = new FormData(form);
      const w = k => ({ from: parseHHMM(fd.get(k + '-from')), to: parseHHMM(fd.get(k + '-to')) });
      saveSettings({ biz: w('biz'), day: w('day'), rate: parseHoursInput(fd.get('rate')) });
      render(); toast('Zapisano ustawienia. Obowiązują nowe zgłoszenia.');
    }
  } catch (err) {
    if (err instanceof Invalid) showErrors(form, err.errors); else throw err;
  }
});
window.addEventListener('hashchange', () => { if (dlg.open) dlg.close(); render(); });

// ---------- theme ----------
const THEMES = ['auto', 'light', 'dark'], THEME_LABEL = { auto: 'Motyw: auto', light: 'Motyw: jasny', dark: 'Motyw: ciemny' };
function cycleTheme() {
  const cur = document.documentElement.dataset.theme || 'auto';
  const next = THEMES[(THEMES.indexOf(cur) + 1) % 3];
  if (next === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = next;
  store.set('theme', next === 'auto' ? null : next);
  $('#themeLabel').textContent = THEME_LABEL[next];
}
$('#themeLabel').textContent = THEME_LABEL[document.documentElement.dataset.theme || 'auto'];

// ---------- live clock ----------
function rerenderAll() { if (sessionValid()) render(true); else renderLogin(); }
let lastSlaTick = 0;
function tick() {
  const now = clock.now(), p = wParts(now);
  const t = $('#lcdTime'), s = $('#lcdSec'), d = $('#lcdDate');
  if (t) { t.textContent = `${pad(p.hh)}:${pad(p.mi)}`; s.textContent = ':' + pad(p.s); d.textContent = `${DOW_SHORT[p.dow].toUpperCase()} ${fmtD(now)}`; }
  const ci = $('#clockInput');
  if (ci && document.activeElement !== ci) ci.value = toLocalInput(now);
  const code = $('#authCode');
  if (code) {
    const left = 30 - Math.floor(Date.now() / 1000) % 30;
    code.textContent = totpCode(totpStep()).replace(/(\d{3})/, '$1 ');
    $('#authTtl').textContent = `nowy kod za ${left} s`;
    $('#authRing').style.setProperty('--p', left / 30);
  }
  if (Date.now() - lastSlaTick > 15000 && $('#lamps')) {
    lastSlaTick = Date.now();
    $('#lamps').innerHTML = lampsHTML();
    $$('[data-sla]').forEach(el => { const tk = ticketByNo(+el.dataset.sla); if (tk) el.outerHTML = slaTag(tk, now); });
  }
}
setInterval(tick, 1000);
render(true);
