// ClientTracker v3 — the tracker as a helpdesk inbox: sidebar with views and the client list, a compact ticket list,
// and the selected ticket open beside it. Keyboard: j/k move, n new ticket, t time entry, / filter clients, Esc close.
// Everything typed by the user is escaped before innerHTML (T-4).

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const root = $('#root'), dlg = $('#dlg');

// ---------- account and login (L) — simulated, the real check lives on the server ----------
const ACCOUNT = { email: 'wlasciciel@clienttracker.test', password: 'makieta-demo-2026', role: 'owner', secret: 'JBSWY3DPEHPK3PXPMKTR' };
const BAD_LOGIN = 'Nieprawidłowy e-mail, hasło lub kod.';
const login = { step: 'password', err: '', user: 'u1' };
const loginUser = () => staffById(login.user) || STAFF[0];
const totpKey = u => u.id === 'u1' ? 'totp' : 'totp-' + u.id;
// a client session ends when the owner turns the panel off or deactivates the client
const sessionValid = () => {
  const s = store.get('session', null);
  if (!s || Date.now() - s.last >= 7 * DAY) return false;
  if (s.role === 'client' && !portalClients().some(c => c.id === s.clientId)) { store.del('session'); return false; }
  if (s.role !== 'client' && !staffActive(s.userId || 'u1')) { store.del('session'); return false; }
  return true;
};
// the client whose panel is on screen: a logged-in client, or the owner previewing one
const portalId = () => { const s = store.get('session', null); return s ? (s.role === 'client' ? s.clientId : s.as && clientById(s.as) ? s.as : null) : null; };
const startSession = (role, clientId) => {
  const u = role === 'client' ? null : staffById(role === 'employee' ? 'u2' : 'u1');
  if (u && !staffActive(u.id)) return toast(`Konto ${u.name} jest zablokowane.`, 'danger');
  store.set('session', role === 'client' ? { email: clientById(clientId).email, role, clientId, last: Date.now() } : { email: u.email, role: u.role, userId: u.id, last: Date.now() });
  login.step = 'password'; login.err = '';
  location.hash = '#/';
  render(true);
};
const touchSession = () => { const s = store.get('session', null); if (s) store.set('session', { ...s, last: Date.now() }); };
function totpCode(step, secret = loginUser().secret) {
  let h = 2166136261;
  for (const ch of secret + ':' + step) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
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
  const u = loginUser();
  store.set('session', { email: u.email, role: u.role, userId: u.id, last: Date.now() });
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
  const err = login.err ? `<p class="note note--danger" role="alert">${esc(login.err)}</p>` : '';
  root.innerHTML = `
<main class="auth" id="app" tabindex="-1">
  <div class="auth__in">
    <p class="brand brand--big"><span class="brand__mark" aria-hidden="true"></span>ClientTracker</p>
    <form class="auth__card" id="loginForm" novalidate>
      ${login.step === 'password' ? `
        <h1>Zaloguj się</h1>
        <p class="dim">Konto zakłada polecenie <code>create-user</code> na serwerze.</p>
        <div class="fld"><label for="lEmail">E-mail</label><input id="lEmail" name="email" type="email" autocomplete="username" required></div>
        <div class="fld"><label for="lPass">Hasło</label><input id="lPass" name="password" type="password" autocomplete="current-password" required minlength="12"></div>
        ${err}
        <button class="btn btn--primary btn--block" type="submit">Dalej</button>
        <div class="auth__demo">
          <p><b>Makieta:</b> ${esc(ACCOUNT.email)} / <code>${esc(ACCOUNT.password)}</code></p>
          <div class="hrow"><button type="button" class="btn btn--sm" data-act="fill-login">Wpisz dane demo</button><button type="button" class="btn btn--sm" data-act="skip-login">Wejdź bez logowania</button></div>
          <p><b>Pracownik:</b> ${esc(STAFF[1].email)} / <code>${esc(STAFF[1].password)}</code>, mniej uprawnień</p>
          <div class="hrow"><button type="button" class="btn btn--sm" data-act="skip-login-employee">Wejdź jako pracownik</button></div>
          <p><b>Klient:</b> e-mail kontaktowy z dostępem do panelu, hasło <code>${CLIENT_PASSWORD}</code>, np. ${esc(portalClients()[0]?.email || '—')}</p>
          <div class="hrow"><button type="button" class="btn btn--sm" data-act="skip-login-client">Wejdź jako klient</button></div>
        </div>` : setup ? `
        <h1>Włącz kod z aplikacji</h1>
        <p class="dim">Bez drugiego składnika nie ma dostępu. Zeskanuj kod albo przepisz klucz.</p>
        <div class="setup">${fakeQR(loginUser().secret)}<div><p class="cap">Klucz</p><p class="mono">${loginUser().secret.match(/.{4}/g).join(' ')}</p><p class="dim small">TOTP, 6 cyfr, co 30 s</p></div></div>
        <div class="fld"><label for="lCode">Kod z aplikacji</label><input id="lCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" class="codein" required></div>
        ${err}
        <button class="btn btn--primary btn--block" type="submit">Potwierdź i wejdź</button>
        <button type="button" class="btn btn--text" data-act="login-back">Wróć</button>` : `
        <h1>Kod z aplikacji</h1>
        <p class="dim">Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.</p>
        <div class="fld"><label for="lCode">Kod</label><input id="lCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" class="codein" required></div>
        ${err}
        <button class="btn btn--primary btn--block" type="submit">Zaloguj</button>
        <button type="button" class="btn btn--text" data-act="login-back">Wróć</button>`}
    </form>
    ${code ? `<aside class="auth__card authapp" aria-label="Aplikacja uwierzytelniająca (symulacja)"><p class="cap">Aplikacja uwierzytelniająca · symulacja</p><p class="authapp__code mono" id="authCode"></p><p class="dim small" id="authTtl"></p><button type="button" class="btn btn--sm" data-act="fill-code">Przepisz kod</button></aside>` : ''}
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
    const u = STAFF.find(x => x.email === String(fd.get('email')).trim().toLowerCase() && x.password === fd.get('password') && staffActive(x.id));
    if (!u) { loginFailed(); return renderLogin(); }
    login.user = u.id; login.err = ''; login.step = store.get(totpKey(u), false) ? 'code' : 'setup';
    return renderLogin();
  }
  if (!totpOk(String(fd.get('code')).replace(/\s/g, ''))) { loginFailed(); return renderLogin(); }
  if (login.step === 'setup') store.set(totpKey(loginUser()), true);
  loginSucceeded();
}

// ---------- small pieces ----------
const ST_CODE = { 'Nowe': 'new', 'W toku': 'prog', 'Czeka na klienta': 'wait', 'Zrobione': 'done', 'Odrzucone': 'rej' };
const PRIO_CODE = { Krytyczny: 'k', Wysoki: 'w', Normalny: 'n' };
const KIND_CODE = { Pula: 'pool', Utrzymanie: 'maint', Dodatkowe: 'extra' };
const statusChip = s => `<span class="chip st-${ST_CODE[s]}"><i aria-hidden="true"></i>${s}</span>`;
const prioTag = p => `<span class="prio prio--${PRIO_CODE[p]}">${p}</span>`;
const kindChip = k => `<span class="chip kind--${KIND_CODE[k]}">${k}</span>`;
function slaTag(t, now = clock.now()) {
  const s = slaState(t, now);
  const soon = s.k === 'left' && t.deadline - now < 0.25 * (t.deadline - t.receivedAt);
  return `<span class="sla sla--${s.k}${soon ? ' sla--soon' : ''}" data-sla="${t.no}">${s.text}</span>`;
}
function meter(used, pool) {
  if (!pool && !used) return '<span class="dim">bez puli</span>';
  const over = used > pool, w = pool ? Math.min(100, used / pool * 100) : 100;
  return `<span class="meter${over ? ' meter--over' : ''}"><span class="meter__bar" aria-hidden="true"><i style="width:${w.toFixed(1)}%"></i></span><span>${fmtHours(used)} z ${fmtHours(pool)} h${over ? ` · ponad pulę o ${fmtHours(used - pool)} h` : ''}</span></span>`;
}
const todayISO = () => isoOf(wParts(clock.now()).dn);
const plural3 = (n, a, b, c) => `${n} ${plural(n, a, b, c)}`;
const shortDT = ms => { const p = wParts(ms); return `${pad(p.d)}.${pad(p.m)} ${pad(p.hh)}:${pad(p.mi)}`; };
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' toast--' + kind : '');
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('toast--out'), 3600);
  setTimeout(() => el.remove(), 4200);
}
const clientOptions = (sel, { activeOnly = false, all = '' } = {}) =>
  (all ? `<option value="">${all}</option>` : '') +
  DB.clients.filter(c => !activeOnly || c.active).sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    .map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}${c.active ? '' : ' (nieaktywny)'}</option>`).join('');
const ymNav = (ym, href) => `<nav class="stepper" aria-label="Miesiąc"><a href="${href(ymShift(ym, -1))}" aria-label="Poprzedni miesiąc: ${ymLabel(ymShift(ym, -1))}">‹</a><span>${ymLabel(ym)}</span><a href="${href(ymShift(ym, 1))}" aria-label="Następny miesiąc: ${ymLabel(ymShift(ym, 1))}">›</a></nav>`;

// ---------- views of the inbox ----------
const VIEWS = {
  otwarte: { name: 'Otwarte', hint: 'Najpierw bez reakcji według terminu, potem pozostałe od najstarszego.' },
  moje: { name: 'Moje', hint: 'Otwarte, prowadzone przeze mnie, według terminu.' },
  'bez-reakcji': { name: 'Bez reakcji', hint: 'Otwarte, jeszcze bez reakcji, według terminu.' },
  'po-terminie': { name: 'Po terminie', hint: 'Bez reakcji i już po terminie reakcji.' },
  czeka: { name: 'Czeka na klienta', hint: 'Od najstarszego przyjęcia.' },
  zamkniete: { name: 'Zamknięte w tym miesiącu', short: 'Zamknięte', hint: 'Zrobione i Odrzucone, od ostatnio zamkniętego.' },
  wszystkie: { name: 'Wszystkie', hint: 'Od najnowszego przyjęcia.' },
};
function viewList(view, clientId, now) {
  const mine = DB.tickets.filter(t => !clientId || t.clientId === clientId), ym = ymNow();
  const byDl = (a, b) => a.deadline - b.deadline || a.no - b.no, byRec = (a, b) => a.receivedAt - b.receivedAt || a.no - b.no;
  switch (view) {
    case 'otwarte': return openTickets(clientId);
    case 'moje': return mine.filter(t => isOpenStatus(t.status) && t.assignee === actor()?.id).sort(byDl);
    case 'bez-reakcji': return mine.filter(t => isOpenStatus(t.status) && t.reactedAt == null).sort(byDl);
    case 'po-terminie': return mine.filter(t => isOpenStatus(t.status) && t.reactedAt == null && now > t.deadline).sort(byDl);
    case 'czeka': return mine.filter(t => t.status === 'Czeka na klienta').sort(byRec);
    case 'zamkniete': return mine.filter(t => isClosed(t.status) && t.closedAt != null && ymOf(t.closedAt) === ym).sort((a, b) => b.closedAt - a.closedAt);
    default: return mine.slice().sort((a, b) => b.receivedAt - a.receivedAt || b.no - a.no);
  }
}

// ---------- the status diagram, compact HTML version ----------
// Nowe → W pracy (W toku ⇅ Czeka na klienta) → Zamknięte (Zrobione, Odrzucone); a narrow pane stacks it vertically.
const GROUP_OF = s => s === 'Nowe' ? 'new' : isClosed(s) ? 'closed' : 'work';
const EDGE_OF = { 'new>work': 'react', 'new>closed': 'direct', 'work>work': 'swap', 'work>closed': 'close', 'closed>work': 'reopen' };
const edgesTaken = t => new Set(t.history.filter(h => h.field === 'status').map(h => EDGE_OF[GROUP_OF(h.from) + '>' + GROUP_OF(h.to)]).filter(Boolean));
const STATUS_HINT = { 'Nowe': 'czeka na reakcję', 'W toku': 'pracujemy nad tym', 'Czeka na klienta': 'potrzebujemy informacji od Ciebie', 'Zrobione': 'gotowe', 'Odrzucone': 'zamknięte bez realizacji' };
// readOnly: the client's view, the same diagram without buttons
function statusFlow(t, readOnly = false) {
  const visited = new Set(['Nowe', ...t.history.filter(h => h.field === 'status').map(h => h.to)]), done = edgesTaken(t);
  const locked = !readOnly && !mayWork(t);
  const node = s => {
    const cls = `snode st-${ST_CODE[s]}`;
    if (s === t.status) return `<span class="${cls} is-current" aria-current="step">${s}<small>${readOnly ? 'teraz' : 'aktualny'}</small></span>`;
    if (readOnly || locked) return `<span class="${cls}${visited.has(s) ? ' is-visited' : ' is-static'}">${s}</span>`;
    if (s === 'Nowe') return `<span class="${cls} is-locked" title="Do statusu Nowe nie da się wrócić">${s}<small>bez powrotu</small></span>`;
    return `<button type="button" class="${cls}${visited.has(s) ? ' is-visited' : ''}" data-act="status" data-no="${t.no}" data-to="${s}" aria-label="Ustaw status: ${s}">${s}${visited.has(s) ? '<small>wcześniej</small>' : ''}</button>`;
  };
  const arrow = (e, label, dir = '→') => `<span class="sarrow${done.has(e) ? ' is-done' : ''}"><span>${label}</span><b aria-hidden="true">${dir}</b></span>`;
  return `<div class="sflow" role="group" aria-label="Status zgłoszenia #${t.no}">
    <div class="sflow__new">${node('Nowe')}</div>
    <div class="sflow__link">${arrow('react', 'reakcja')}</div>
    <div class="sgroup"><p>W pracy</p>${node('W toku')}<span class="sswap${done.has('swap') ? ' is-done' : ''}" aria-hidden="true">⇅</span>${node('Czeka na klienta')}</div>
    <div class="sflow__link sflow__link--two">${arrow('close', 'zamknięcie')}${arrow('reopen', 'wznowienie', '←')}</div>
    <div class="sgroup"><p>Zamknięte</p>${node('Zrobione')}${node('Odrzucone')}</div>
  </div>
  <p class="dim small sflow__note">${readOnly ? `Teraz: <b>${t.status}</b>, ${STATUS_HINT[t.status]}.` : locked ? `Zgłoszenie prowadzi <b>${esc(staffName(t.assignee))}</b>. Pracownik zmienia status tylko swoich i nieprzypisanych.` : `${done.has('direct') ? '<b class="accent">Zamknięte od razu z Nowe.</b> ' : ''}${t.status === 'Nowe'
    ? `Kliknij status. Pierwsza zmiana z Nowe zapisze reakcję: <b>${fmtDT(Math.max(clock.now(), t.receivedAt))}</b>. Można też od razu zamknąć, np. pomyłkę jako Odrzucone.`
    : 'Kliknij status, żeby go zmienić. Zamknięcie zapisuje godzinę, wznowienie ją kasuje. Do Nowe nie ma powrotu.'}`}</p>`;
}

// ---------- shell: sidebar + main ----------
const sideUI = { q: '', scroll: 0, open: false };
const listUI = { key: '', scroll: 0 };
function sidebarHTML(route) {
  const now = clock.now();
  const counts = Object.fromEntries(Object.keys(VIEWS).map(v => [v, viewList(v, '', now).length]));
  const openBy = {}, lateBy = {};
  for (const t of DB.tickets) if (isOpenStatus(t.status)) {
    openBy[t.clientId] = (openBy[t.clientId] || 0) + 1;
    if (t.reactedAt == null && now > t.deadline) lateBy[t.clientId] = (lateBy[t.clientId] || 0) + 1;
  }
  const clients = DB.clients.filter(c => c.active).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  const page = route.page;
  return `
  <div class="side__top">
    <a class="brand" href="#/" aria-label="ClientTracker, skrzynka"><span class="brand__mark" aria-hidden="true"></span>ClientTracker</a>
    <button type="button" class="iconbtn side__close" data-act="side-close" aria-label="Zamknij menu">×</button>
  </div>
  <button type="button" class="btn btn--primary btn--block" data-act="new-ticket">Nowe zgłoszenie <kbd>N</kbd></button>
  <nav class="side__nav" aria-label="Widoki zgłoszeń">
    ${Object.entries(VIEWS).map(([k, v]) => `<a href="#/v/${k}" class="${page === 'inbox' && route.view === k && !route.klient ? 'is-active' : ''}${k === 'po-terminie' && counts[k] ? ' is-alert' : ''}"${page === 'inbox' && route.view === k && !route.klient ? ' aria-current="page"' : ''}><span>${v.short || v.name}</span><span class="side__n">${counts[k]}</span></a>`).join('')}
  </nav>
  <nav class="side__nav" aria-label="Pozostałe">
    <a href="#/czas" class="${page === 'czas' ? 'is-active' : ''}"${page === 'czas' ? ' aria-current="page"' : ''}><span>Czas pracy</span><kbd>T</kbd></a>
    <a href="#/klienci" class="${page === 'klienci' ? 'is-active' : ''}"${page === 'klienci' ? ' aria-current="page"' : ''}><span>Klienci</span><span class="side__n">${DB.clients.length}</span></a>
    ${can('settings') ? `<a href="#/ustawienia" class="${page === 'ustawienia' ? 'is-active' : ''}"${page === 'ustawienia' ? ' aria-current="page"' : ''}><span>Ustawienia</span></a>` : ''}
  </nav>
  <div class="side__clients">
    <div class="side__head"><span class="cap">Klienci aktywni</span><span class="dim small">${clients.length}</span></div>
    <label for="sideSearch" class="sr-only">Filtruj klientów</label>
    <input type="search" id="sideSearch" placeholder="Filtruj klientów  /" autocomplete="off" value="${esc(sideUI.q)}">
    <ul class="side__list" id="sideList">${clients.map(c => `<li data-search="${esc(norm(c.name))}"><a href="#/v/wszystkie?klient=${c.id}" class="${route.klient === c.id ? 'is-active' : ''}"${route.klient === c.id ? ' aria-current="page"' : ''}><span class="side__cname">${esc(c.name)}</span>${lateBy[c.id] ? `<span class="side__late" title="${lateBy[c.id]} po terminie">${lateBy[c.id]}</span>` : openBy[c.id] ? `<span class="side__n">${openBy[c.id]}</span>` : ''}</a></li>`).join('')}</ul>
    <p class="dim small side__none" id="sideNone" hidden>Brak klientów.</p>
  </div>
  <div class="side__foot">
    <span class="side__me" title="${esc(actor().email)}">${whoTag(actor().id)}<span>${esc(actor().name)}<small class="dim">${ROLE_LABEL[actor().role]}</small></span></span>
    <button type="button" class="btn btn--text btn--sm" data-act="logout">Wyloguj</button>
  </div>`;
}
function renderShell() {
  root.innerHTML = `
<div class="shell">
  <header class="topbar">
    <button type="button" class="iconbtn" data-act="side-open" aria-label="Menu" aria-controls="side">☰</button>
    <a class="brand" href="#/"><span class="brand__mark" aria-hidden="true"></span><span class="brand__name">ClientTracker</span></a>
    <button type="button" class="btn btn--primary btn--sm" data-act="new-ticket">+ Zgłoszenie</button>
  </header>
  <aside class="side" id="side" aria-label="Nawigacja"></aside>
  <div class="scrim" data-act="side-close"></div>
  <main class="main" id="app" tabindex="-1"></main>
</div>`;
}
function filterSide() {
  const q = norm(sideUI.q.trim());
  let shown = 0;
  $$('#sideList li').forEach(li => { const ok = !q || li.dataset.search.includes(q); li.hidden = !ok; shown += ok; });
  $('#sideNone').hidden = shown > 0;
}

// ---------- router ----------
let lastRoute = null;
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean), q = Object.fromEntries(new URLSearchParams(qs || ''));
  if (!parts.length) return { page: 'inbox', view: 'otwarte', klient: '', z: +q.z || 0 };
  if (parts[0] === 'v') return { page: 'inbox', view: VIEWS[parts[1]] ? parts[1] : 'otwarte', klient: clientById(q.klient) ? q.klient : '', z: +q.z || 0 };
  if (parts[0] === 'z') return { page: 'inbox', view: 'wszystkie', klient: '', z: +parts[1] || 0 };
  if (parts[0] === 'klient' && parts[2]) return { page: 'month', id: parts[1], ym: parts[2] };
  if (parts[0] === 'klient') return { page: 'inbox', view: 'wszystkie', klient: parts[1], z: 0 };
  return { page: parts[0], q };
}
const inboxHref = (r, patch = {}) => {
  const n = { ...r, ...patch };
  const qs = new URLSearchParams({ ...(n.klient && { klient: n.klient }), ...(n.z && { z: n.z }) }).toString();
  return `#/v/${n.view}${qs ? '?' + qs : ''}`;
};
function render(force) {
  if (!sessionValid()) { lastRoute = null; syncRoleSelect(); return renderLogin(); }
  touchSession();
  syncRoleSelect();
  const pid = portalId();
  if (pid) return renderPortal(pid, force);
  if (force || !$('.shell') || $('.shell--portal')) renderShell();
  const r = parseHash();
  const sl = $('#sideList');
  if (sl) sideUI.scroll = sl.scrollTop;
  const lp = $('.ilist__rows');
  if (lp) listUI.scroll = lp.scrollTop;
  $('#side').innerHTML = sidebarHTML(r);
  filterSide();
  $('#sideList').scrollTop = sideUI.scroll;
  let v;
  switch (r.page) {
    case 'inbox': v = viewInbox(r); break;
    case 'month': v = can('month') ? viewMonth(r.id, r.ym) : forbidden(); break;
    case 'klienci': v = viewClients(r.q); break;
    case 'czas': v = viewTime(r.q); break;
    case 'ustawienia': v = can('settings') ? viewSettings(r.q) : forbidden(); break;
    default: v = { title: 'Nie znaleziono', html: `<div class="page"><div class="empty"><h1>Nie ma takiej strony</h1><p><a href="#/">Wróć do skrzynki</a></p></div></div>` };
  }
  const app = $('#app');
  app.innerHTML = v.html;
  app.classList.toggle('main--inbox', r.page === 'inbox');
  app.classList.toggle('has-detail', r.page === 'inbox' && !!r.z);
  document.title = `${v.title} · ClientTracker`;
  if (v.after) v.after();
  const key = r.page + '|' + (r.view || '') + '|' + (r.klient || '');
  const rows = $('.ilist__rows');
  if (rows && key === listUI.key) rows.scrollTop = listUI.scroll;
  if (key !== listUI.key) { app.scrollTop = 0; window.scrollTo(0, 0); if (lastRoute !== null) app.focus({ preventScroll: true }); }
  const sel = $('.row.is-selected');
  if (sel && rows) { const a = sel.offsetTop - rows.offsetTop, b = a + sel.offsetHeight; if (a < rows.scrollTop || b > rows.scrollTop + rows.clientHeight) sel.scrollIntoView({ block: 'nearest' }); }
  const det = $('.detail');
  if (det && location.hash !== lastRoute) det.scrollTop = 0;
  listUI.key = key; lastRoute = location.hash;
  closeSide();
  $('#datasetSelect').value = DB.dataset || 'small';
  tick();
}
const forbidden = () => ({ title: 'Brak dostępu', html: '<div class="page"><div class="empty"><h1>Brak dostępu (403)</h1><p>Ta strona jest tylko dla właściciela.</p><p><a href="#/">Wróć do skrzynki</a></p></div></div>' });
const whoTag = id => id && staffById(id) ? `<span class="who who--${staffById(id).role}" title="Prowadzi: ${esc(staffName(id))}">${staffById(id).initials}</span>` : '';
const closeSide = () => { sideUI.open = false; document.body.classList.remove('side-open'); };

// ---------- inbox: list + detail ----------
function rowHTML(t, r, now, forClient = false) {
  const c = clientById(t.clientId), sel = t.no === r.z;
  return `<a class="row${sel ? ' is-selected' : ''}" href="${inboxHref(r, { z: t.no })}" data-no="${t.no}"${sel ? ' aria-current="true"' : ''}>
    <span class="row__prio prio-bar--${PRIO_CODE[t.priority]}" aria-hidden="true"></span>
    <span class="row__top"><span class="row__no mono">#${t.no}</span><span class="row__client">${forClient ? `przyjęte ${DOW_SHORT[wParts(t.receivedAt).dow]}` : esc(c.name)}${t.byClient && !forClient ? ' <span class="chip chip--outline">panel</span>' : ''}</span><span class="row__time mono">${shortDT(t.receivedAt)}</span></span>
    <span class="row__title">${esc(t.title)}</span>
    <span class="row__meta">${forClient ? '' : whoTag(t.assignee)}${statusChip(t.status)}${prioTag(t.priority)}<span class="row__dl">termin ${DOW_SHORT[wParts(t.deadline).dow]} ${shortDT(t.deadline)}</span>${slaTag(t, now)}</span>
  </a>`;
}
function clientStrip(c) {
  const ym = ymNow(), mine = DB.tickets.filter(t => t.clientId === c.id);
  return `<div class="cstrip">
    <div class="cstrip__name"><h1>${esc(c.name)}</h1><span class="chip chip--outline">${c.pkg}</span>${c.active ? '' : '<span class="chip">nieaktywny</span>'}</div>
    <dl class="cstrip__facts">
      <div><dt>Pula · ${MONTHS[+ym.slice(5) - 1]}</dt><dd>${meter(poolUsed(c.id, ym), c.pool)}</dd></div>
      ${can('money') ? `<div><dt>Abonament</dt><dd>${fmtMoney(c.price)}</dd></div>` : ''}
      <div><dt>Otwarte</dt><dd>${mine.filter(t => isOpenStatus(t.status)).length} z ${mine.length}</dd></div>
      <div><dt>E-mail</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</dd></div>
      <div class="cstrip__portal"><dt>Panel klienta</dt><dd>${c.portal ? `<span class="ok">dostęp włączony</span> · login ${esc(c.email)}` : '<span class="dim">bez dostępu</span>'}${can('clients.portal') ? ` <button type="button" class="btn btn--text btn--sm" data-act="portal-toggle" data-id="${c.id}">${c.portal ? 'Wyłącz' : 'Włącz'}</button>${c.portal && c.active ? `<button type="button" class="btn btn--text btn--sm" data-act="portal-preview" data-id="${c.id}">Podgląd jako klient</button>` : ''}` : ''}</dd></div>
    </dl>
    <div class="hrow">
      ${can('month') ? `<a class="btn btn--sm" href="#/klient/${c.id}/${ym}">Miesiąc i raport</a>` : ''}
      ${can('clients.edit') ? `<button type="button" class="btn btn--sm" data-act="edit-client" data-id="${c.id}">Edytuj</button>` : ''}
      <button type="button" class="btn btn--sm" data-act="new-entry" data-client="${c.id}">+ Czas</button>
      <button type="button" class="btn btn--sm" data-act="new-ticket" data-client="${c.id}"${c.active ? '' : ' disabled title="Nieaktywnemu klientowi nie można dodać zgłoszenia"'}>+ Zgłoszenie</button>
    </div>
  </div>`;
}
function viewInbox(r) {
  const now = clock.now(), V = VIEWS[r.view], c = r.klient ? clientById(r.klient) : null;
  const list = viewList(r.view, r.klient, now);
  let rows;
  if (r.view === 'otwarte') {
    const w = list.filter(t => t.reactedAt == null), rest = list.filter(t => t.reactedAt != null);
    rows = (w.length ? `<p class="ilist__group">Czeka na reakcję · ${w.length}</p>${w.map(t => rowHTML(t, r, now)).join('')}` : '') +
      (rest.length ? `<p class="ilist__group">Po reakcji · ${rest.length}</p>${rest.map(t => rowHTML(t, r, now)).join('')}` : '');
  } else rows = list.map(t => rowHTML(t, r, now)).join('');
  const tabs = c ? `<nav class="tabs" aria-label="Widok zgłoszeń klienta">${['wszystkie', 'otwarte', 'czeka', 'zamkniete'].map(k => `<a href="${inboxHref(r, { view: k, z: 0 })}"${k === r.view ? ' aria-current="page"' : ''}>${VIEWS[k].short || VIEWS[k].name}</a>`).join('')}</nav>` : '';
  const t = r.z ? ticketByNo(r.z) : null;
  return {
    title: t ? `#${t.no} ${t.title}` : c ? c.name : V.name,
    html: `
<div class="inbox">
  <section class="ilist" aria-label="Lista zgłoszeń">
    ${c ? clientStrip(c) : `<div class="ilist__head"><h1>${V.name}</h1><span class="count">${list.length}</span></div>`}
    ${tabs}
    <p class="ilist__hint dim small">${c ? `${VIEWS[r.view].name} · ${list.length}. ` : ''}${V.hint}${r.view === 'otwarte' ? ` <span class="nowrap">${windowsLine(now)}</span>` : ''}</p>
    <div class="ilist__rows" role="list">${rows || `<div class="empty"><p>Pusto. ${r.view === 'po-terminie' ? 'Nic nie jest po terminie.' : 'Brak zgłoszeń w tym widoku.'}</p></div>`}</div>
  </section>
  <section class="detail" aria-label="Szczegóły zgłoszenia">${t ? detailHTML(t, r) : `<div class="detail__empty"><p>Wybierz zgłoszenie z listy.</p><p class="dim small"><kbd>J</kbd> <kbd>K</kbd> następne i poprzednie · <kbd>N</kbd> nowe zgłoszenie · <kbd>T</kbd> czas pracy · <kbd>/</kbd> szukaj klienta</p></div>`}</section>
</div>`,
  };
}
function nextOpening(now, kind, win) {
  for (let dn = wParts(now).dn, i = 0; i < 30; dn++, i++) { const w = windowOn(dn, kind, win); if (w && w[0] > now) return w[0]; }
  return NaN;
}
function windowsLine(now) {
  const win = DB.settings;
  return [['biz', 'Okno robocze'], ['day', 'codzienne']].map(([k, name]) => {
    const on = isWindowOpen(now, k, win), w = windowOn(wParts(now).dn, k, win), nx = nextOpening(now, k, win);
    return `<span class="win${on ? ' win--on' : ''}">${name} ${on ? `do ${fmtT(w[1])}` : `od ${DOW_SHORT[wParts(nx).dow]} ${fmtT(nx)}`}</span>`;
  }).join(' · ');
}

function traceView(t, now) {
  const tr = deadlineTrace(t.receivedAt, t.pkg, t.priority, t.win);
  if (tr.days.length > 16) return `<p class="dim small">Termin wypada ${tr.days.length} dni po przyjęciu, rozpiska pokazuje najwyżej 16 dni.</p>`;
  const pct = (dn, ms) => Math.min(100, Math.max(0, (ms - fromW(dn, 0)) / MIN / 14.4)).toFixed(2);
  const span = (dn, a, b, cls) => `<span class="${cls}" style="left:${pct(dn, a)}%;width:${(pct(dn, b) - pct(dn, a)).toFixed(2)}%"></span>`;
  const marks = [[t.receivedAt, 'in', 'przyjęte'], [t.deadline, 'dl', 'termin'], [t.reactedAt, 'rx', 'reakcja'], [t.reactedAt == null ? now : null, 'now', 'teraz']];
  const w = t.win[tr.kind];
  return `<p class="dim small">${ruleLabel(tr.rule)}; okno ${tr.kind === 'biz' ? 'dni roboczych' : 'codzienne'} ${fmtMin(w.from)}–${fmtMin(w.to)} zapamiętane przy przyjęciu.</p><ol class="trace">${tr.days.map(d => {
    const here = marks.filter(([ms]) => ms != null && wParts(ms).dn === d.dn);
    const notes = [
      d.holiday || ((d.dow === 0 || d.dow === 6) && tr.kind === 'biz' ? 'weekend' : ''),
      d.counted && tr.rule.h ? `+${fmtDur(d.counted[1] - d.counted[0])}` : d.n ? `${d.n}. dzień roboczy` : '',
      ...here.map(([ms, cls, label]) => `<span class="tr__tag tr__tag--${cls}">${label} ${fmtT(ms)}</span>`),
    ].filter(Boolean);
    return `<li class="tr${d.w ? '' : ' tr--off'}"><span class="tr__day mono">${DOW_SHORT[d.dow]} ${fmtDn(d.dn).slice(0, 5)}</span><span class="tr__bar" aria-hidden="true">${d.w ? span(d.dn, d.w[0], d.w[1], 'tr__win') : ''}${d.counted ? span(d.dn, d.counted[0], d.counted[1], 'tr__cnt') : ''}${here.map(([ms, cls]) => `<span class="tr__mk tr__mk--${cls}" style="left:${pct(d.dn, ms)}%"></span>`).join('')}</span><span class="tr__note">${d.w ? '' : '<span class="sr-only">okno zamknięte</span>'}${notes.join(' · ')}</span></li>`;
  }).join('')}</ol>`;
}
const entryActs = e => !mayEditEntry(e) ? `<span class="dim small">${whoTag(entryBy(e))}</span>` : `${whoTag(entryBy(e))}<button type="button" class="btn btn--text btn--sm" data-act="edit-entry" data-id="${e.id}" aria-label="Popraw wpis z ${fmtDn(dnFromISO(e.date))}, ${fmtHours(e.hours)} h">Popraw</button><button type="button" class="btn btn--text btn--sm btn--danger" data-act="del-entry" data-id="${e.id}" aria-label="Usuń wpis z ${fmtDn(dnFromISO(e.date))}, ${fmtHours(e.hours)} h">Usuń</button>`;
function assignControl(t, me) {
  if (can('tickets.assign.any')) return `<label class="sr-only" for="assignSel">Prowadzi</label><select id="assignSel" class="sel--sm" data-assign="${t.no}"><option value="">nikt</option>${STAFF.map(u => `<option value="${u.id}"${u.id === t.assignee ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select>`;
  if (t.assignee == null) return `nikt <button type="button" class="btn btn--sm" data-act="assign" data-no="${t.no}" data-to="${me.id}">Biorę</button>`;
  if (t.assignee === me.id) return `${whoTag(me.id)} ${esc(me.name)} <button type="button" class="btn btn--text btn--sm" data-act="assign" data-no="${t.no}" data-to="">Oddaj</button>`;
  return `${whoTag(t.assignee)} ${esc(staffName(t.assignee))}`;
}
function detailHTML(t, r) {
  const c = clientById(t.clientId), now = clock.now(), entries = entriesOfTicket(t.no);
  const late = t.reactedAt != null && t.reactedAt > t.deadline;
  return `
  <div class="detail__bar"><a class="btn btn--text btn--sm detail__back" href="${inboxHref(r, { z: 0 })}">← Lista</a><span class="dim small">#${t.no} · <a href="#/v/wszystkie?klient=${c.id}">${esc(c.name)}</a></span><span class="grow"></span>${can('tickets.edit') ? `<button type="button" class="btn btn--sm" data-act="edit-ticket" data-no="${t.no}">Edytuj</button>` : ''}<a class="iconbtn detail__x" href="${inboxHref(r, { z: 0 })}" aria-label="Zamknij szczegóły (Esc)">×</a></div>
  <div class="detail__body">
    <h2 class="detail__title">${esc(t.title)}</h2>
    <p class="detail__meta">${statusChip(t.status)}${prioTag(t.priority)}<span class="dim">źródło: ${t.source}</span>${t.byClient ? '<span class="chip chip--outline">z panelu klienta</span>' : ''}<span class="dim">przyjęte ${fmtDTdow(t.receivedAt)}</span></p>
    <section class="block" aria-label="Status">${statusFlow(t)}<p class="assignline"><span class="dim">Prowadzi:</span> ${assignControl(t, actor())}</p></section>
    <section class="block block--sla" aria-labelledby="slaH">
      <div class="block__head"><h3 id="slaH">Termin reakcji</h3>${slaTag(t, now)}</div>
      <p class="deadline">${fmtDTdow(t.deadline)} <span class="dim small">· ${ruleLabel(RULES[t.pkg][t.priority])}, pakiet ${t.pkg}</span></p>
      <dl class="facts">
        <div><dt>Reakcja</dt><dd>${t.reactedAt != null ? `<span class="${late ? 'danger' : ''}">${fmtDTdow(t.reactedAt)}</span> <span class="dim">po ${fmtDur(t.reactedAt - t.receivedAt)}</span>` : '<span class="dim">jeszcze nie</span>'}</dd></div>
        <div><dt>Zamknięte</dt><dd>${t.closedAt != null ? fmtDTdow(t.closedAt) : '<span class="dim">otwarte</span>'}</dd></div>
      </dl>
      ${t.reactedAt != null && can('tickets.reaction') ? `<details class="more"><summary>Popraw godzinę reakcji</summary>
        <form data-form="reaction" data-no="${t.no}" class="hrow hrow--end" novalidate>
          <div class="fld"><label for="rxIn">Reakcja o</label><input type="datetime-local" id="rxIn" name="reactedAt" value="${toLocalInput(t.reactedAt)}" aria-describedby="e-reactedAt"><p class="fld__err" id="e-reactedAt" data-err="reactedAt"></p></div>
          <button type="submit" class="btn btn--sm btn--primary">Zapisz</button>
        </form><p class="dim small">Nie wcześniej niż przyjęcie i nie w przyszłości.</p></details>` : ''}
      <details class="more"><summary>Jak liczony jest termin</summary>${traceView(t, now)}</details>
    </section>
    <section class="block" aria-labelledby="dH"><div class="block__head"><h3 id="dH">Opis</h3></div>${t.desc ? `<p class="prewrap">${esc(t.desc)}</p>` : '<p class="dim">Bez opisu.</p>'}</section>
    <section class="block" aria-labelledby="eH">
      <div class="block__head"><h3 id="eH">Czas pracy <span class="count">${fmtHours(sumHours(entries))} h</span></h3><button type="button" class="btn btn--sm" data-act="new-entry" data-client="${c.id}" data-ticket="${t.no}">+ Czas</button></div>
      ${entries.length ? `<ul class="entries">${entries.map(e => `<li><span class="mono dim">${fmtDn(dnFromISO(e.date))}</span>${kindChip(e.kind)}<b class="mono">${fmtHours(e.hours)} h</b><span class="entries__desc">${esc(e.desc) || '—'}</span><span class="entries__acts">${entryActs(e)}</span></li>`).join('')}</ul>` : '<p class="dim">Brak wpisów.</p>'}
    </section>
    <section class="block" aria-labelledby="hH">
      <div class="block__head"><h3 id="hH">Historia</h3></div>
      ${t.history.length ? `<ol class="hist">${t.history.slice().reverse().map(h => `<li><time class="mono">${fmtDT(h.at)}</time> ${h.field}: ${esc(h.from)} → ${esc(h.to)}</li>`).join('')}</ol>` : '<p class="dim">Bez zmian od przyjęcia.</p>'}
    </section>
  </div>`;
}

// ---------- clients page (K) ----------
const clientUI = { q: '', pkg: '', inactive: false };
function viewClients(q) {
  const ym = ymNow(), now = clock.now();
  const sort = ['name', 'pool', 'open', 'price'].includes(q.sort) ? q.sort : 'name';
  const rows = DB.clients.map(c => {
    const open = DB.tickets.filter(t => t.clientId === c.id && isOpenStatus(t.status));
    return { c, used: poolUsed(c.id, ym), open: open.length, late: open.filter(t => t.reactedAt == null && now > t.deadline).length };
  });
  const by = {
    name: (a, b) => a.c.name.localeCompare(b.c.name, 'pl'),
    pool: (a, b) => (b.c.pool ? b.used / b.c.pool : b.used ? 9 : -1) - (a.c.pool ? a.used / a.c.pool : a.used ? 9 : -1) || by.name(a, b),
    open: (a, b) => b.late - a.late || b.open - a.open || by.name(a, b),
    price: (a, b) => b.c.price - a.c.price || by.name(a, b),
  };
  rows.sort(by[sort]);
  const th = (key, label, cls = '') => `<th scope="col" class="${cls}"${sort === key ? ` aria-sort="${key === 'name' ? 'ascending' : 'descending'}"` : ''}><a href="#/klienci?sort=${key}">${label}${sort === key ? ' ↓' : ''}</a></th>`;
  return {
    title: 'Klienci',
    html: `<div class="page">
<div class="phead"><div><h1>Klienci</h1><p class="dim">Pula za ${ymLabel(ym)}. Klienta się nie usuwa, tylko oznacza jako nieaktywnego.</p></div>${can('clients.edit') ? '<button type="button" class="btn btn--primary" data-act="new-client">+ Dodaj klienta</button>' : '<span class="dim small">Klientów dodaje i edytuje właściciel.</span>'}</div>
<div class="toolbar">
  <label for="clientSearch" class="sr-only">Szukaj klienta</label><input type="search" id="clientSearch" placeholder="Szukaj po nazwie albo e-mailu" autocomplete="off">
  <label for="clientPkg" class="sr-only">Pakiet</label><select id="clientPkg"><option value="">Wszystkie pakiety</option>${PACKAGES.map(p => `<option>${p}</option>`).join('')}</select>
  <label class="check"><input type="checkbox" id="clientInactive"> pokaż nieaktywnych</label>
  <span class="dim small toolbar__count" id="clientCount" aria-live="polite"></span>
</div>
<table class="tbl tbl--click" id="clientTable">
  <caption class="sr-only">Klienci</caption>
  <thead><tr>${th('name', 'Nazwa')}<th scope="col">Pakiet</th>${th('pool', 'Pula')}${th('open', 'Otwarte', 'num')}${can('money') ? th('price', 'Abonament', 'num') : ''}</tr></thead>
  <tbody>${rows.map(({ c, used, open, late }) => `
    <tr data-href="#/v/wszystkie?klient=${c.id}" data-search="${esc(norm(c.name + ' ' + c.email))}" data-pkg="${c.pkg}" data-active="${c.active}"${c.active ? '' : ' class="is-off"'}>
      <td data-label="Nazwa" class="tbl__main"><a href="#/v/wszystkie?klient=${c.id}">${esc(c.name)}</a>${c.active ? '' : ' <span class="chip">nieaktywny</span>'}${c.portal && c.active ? ' <span class="chip chip--outline" title="Ma dostęp do panelu klienta">panel</span>' : ''}<small>${esc(c.email) || '—'}</small></td>
      <td data-label="Pakiet">${c.pkg}</td>
      <td data-label="Pula">${meter(used, c.pool)}</td>
      <td class="num" data-label="Otwarte">${open}${late ? ` <span class="chip chip--danger">${late} po terminie</span>` : ''}</td>
      ${can('money') ? `<td class="num nowrap" data-label="Abonament">${fmtMoney(c.price)}</td>` : ''}
    </tr>`).join('')}</tbody>
</table>
<div class="empty" id="clientEmpty" hidden><p>Brak klientów pasujących do filtra.</p></div>
</div>`,
    after() { $('#clientSearch').value = clientUI.q; $('#clientPkg').value = clientUI.pkg; $('#clientInactive').checked = clientUI.inactive; filterClients(); },
  };
}
function filterClients() {
  const q = norm(clientUI.q.trim());
  let shown = 0;
  const rows = $$('#clientTable tbody tr');
  rows.forEach(r => { const ok = (!q || r.dataset.search.includes(q)) && (!clientUI.pkg || r.dataset.pkg === clientUI.pkg) && (clientUI.inactive || r.dataset.active === 'true'); r.hidden = !ok; shown += ok; });
  $('#clientCount').textContent = `${shown} z ${rows.length}`;
  $('#clientEmpty').hidden = shown > 0;
}

// ---------- time entries (C) ----------
function viewTime(q) {
  const ym = /^\d{4}-\d{2}$/.test(q.miesiac || '') ? q.miesiac : ymNow();
  const cid = clientById(q.klient) ? q.klient : '';
  const list = DB.entries.filter(e => e.date.startsWith(ym) && (!cid || e.clientId === cid)).sort((a, b) => b.date.localeCompare(a.date) || +b.id.slice(1) - +a.id.slice(1));
  const href = m => `#/czas?miesiac=${m}${cid ? '&klient=' + cid : ''}`;
  const sum = k => sumHours(list.filter(e => e.kind === k));
  const days = [...new Set(list.map(e => e.date))];
  return {
    title: 'Czas pracy',
    html: `<div class="page">
<div class="phead"><div><h1>Czas pracy</h1><p class="dim">Wpis należy do miesiąca według swojej daty.</p></div>
  <div class="hrow">${ymNav(ym, href)}<label for="timeClient" class="sr-only">Klient</label><select id="timeClient" data-filter="time" data-ym="${ym}">${clientOptions(cid, { all: 'Wszyscy klienci' })}</select><button type="button" class="btn btn--primary" data-act="new-entry" data-client="${cid}">+ Czas <kbd>T</kbd></button></div></div>
<dl class="sums">
  <div><dt>Pula</dt><dd>${fmtHours(sum('Pula'))} h</dd></div>
  <div><dt>Utrzymanie</dt><dd>${fmtHours(sum('Utrzymanie'))} h</dd></div>
  <div><dt>Dodatkowe</dt><dd>${fmtHours(sum('Dodatkowe'))} h <small>${can('money') ? fmtMoney(sum('Dodatkowe') * DB.settings.rate) : 'poza pakietem'}</small></dd></div>
  <div><dt>Razem</dt><dd>${fmtHours(sumHours(list))} h <small>${plural3(list.length, 'wpis', 'wpisy', 'wpisów')}</small></dd></div>
</dl>
${list.length ? days.map(d => `<section class="day" aria-label="${fmtDn(dnFromISO(d))}">
  <h2 class="day__h"><span>${DOW_SHORT[dowOf(dnFromISO(d))]} ${fmtDn(dnFromISO(d))}</span><span class="dim">${fmtHours(sumHours(list.filter(e => e.date === d)))} h</span></h2>
  <ul class="entries entries--wide">${list.filter(e => e.date === d).map(e => { const c = clientById(e.clientId), t = e.ticketNo ? ticketByNo(e.ticketNo) : null; return `<li>
    <b class="mono">${fmtHours(e.hours)} h</b>${kindChip(e.kind)}
    <span class="entries__desc"><a href="#/v/wszystkie?klient=${c.id}">${esc(c.name)}</a>${t ? ` · <a href="#/z/${t.no}">#${t.no} ${esc(t.title)}</a>` : ' · <span class="dim">bez zgłoszenia</span>'}<small>${esc(e.desc) || '—'}</small></span>
    <span class="entries__acts">${entryActs(e)}</span></li>`; }).join('')}</ul></section>`).join('') : `<div class="empty"><p>Brak wpisów w miesiącu ${ymLabel(ym)}${cid ? ' dla tego klienta' : ''}.</p></div>`}
</div>`,
  };
}

// ---------- month and report (M) ----------
function viewMonth(id, ym) {
  const c = clientById(id);
  if (!c || !/^\d{4}-\d{2}$/.test(ym)) return { title: 'Nie znaleziono', html: '<div class="page"><div class="empty"><h1>Nie ma takiej strony</h1></div></div>' };
  const s = monthSummary(id, ym), now = clock.now();
  const received = DB.tickets.filter(t => t.clientId === id && ymOf(t.receivedAt) === ym).sort((a, b) => a.receivedAt - b.receivedAt);
  const entries = s.entries.slice().sort((a, b) => a.date.localeCompare(b.date) || +a.id.slice(1) - +b.id.slice(1));
  return {
    title: `${c.name}: ${ymLabel(ym)}`,
    html: `<div class="page">
<p class="crumbs"><a href="#/v/wszystkie?klient=${id}">← ${esc(c.name)}</a></p>
<div class="phead"><div><h1>${esc(c.name)} · ${ymLabel(ym)}</h1><p class="dim">Pakiet ${c.pkg}. Cena i stawka według bieżących danych klienta i Ustawień, także dla minionych miesięcy.</p></div>
  <div class="hrow">${ymNav(ym, m => `#/klient/${id}/${m}`)}<button type="button" class="btn btn--primary" data-act="report" data-client="${id}" data-ym="${ym}">Raport dla klienta</button></div></div>
<dl class="sums">
  <div><dt>Pula</dt><dd>${fmtHours(s.pool)} z ${fmtHours(s.poolMax)} h${s.over ? `<small class="danger">ponad pulę o ${fmtHours(s.over)} h</small>` : ''}</dd></div>
  <div><dt>Utrzymanie</dt><dd>${fmtHours(s.maint)} h</dd></div>
  <div><dt>Dodatkowe</dt><dd>${fmtHours(s.extra)} h <small>${fmtMoney(s.extraAmount)}</small></dd></div>
  <div><dt>Razem</dt><dd>${fmtHours(s.total)} h</dd></div>
  <div><dt>Efektywna stawka</dt><dd>${s.effective == null ? '—' : fmtMoney(s.effective) + '/h'} <small>(${fmtMoney(c.price)} + ${fmtMoney(s.extraAmount)}) / ${fmtHours(s.total)} h</small></dd></div>
</dl>
<h2 class="sect">Zgłoszenia przyjęte w miesiącu <span class="count">${s.tickets}</span> <span class="dim small">w terminie ${s.inTerm} · spóźnione <span class="${s.late ? 'danger' : ''}">${s.late}</span> · bez reakcji <span class="${s.noReaction ? 'danger' : ''}">${s.noReaction}</span></span></h2>
${received.length ? `<div class="rowlist">${received.map(t => rowHTML(t, { view: 'wszystkie', klient: id, z: 0 }, now)).join('')}</div>` : '<p class="dim">Brak zgłoszeń w tym miesiącu.</p>'}
<h2 class="sect">Wpisy czasu <span class="count">${fmtHours(s.total)} h</span> <button type="button" class="btn btn--sm" data-act="new-entry" data-client="${id}">+ Czas</button></h2>
${entries.length ? `<ul class="entries entries--wide">${entries.map(e => { const t = e.ticketNo ? ticketByNo(e.ticketNo) : null; return `<li><span class="mono dim">${fmtDn(dnFromISO(e.date))}</span>${kindChip(e.kind)}<b class="mono">${fmtHours(e.hours)} h</b><span class="entries__desc">${t ? `<a href="#/z/${t.no}">#${t.no} ${esc(t.title)}</a>` : '<span class="dim">bez zgłoszenia</span>'}<small>${esc(e.desc) || '—'}</small></span><span class="entries__acts">${entryActs(e)}</span></li>`; }).join('')}</ul>` : '<p class="dim">Brak wpisów w tym miesiącu.</p>'}
</div>`,
  };
}

// ---------- settings (U) ----------
function viewSettings(q) {
  const st = DB.settings;
  const year = /^\d{4}$/.test(q.rok || '') ? +q.rok : wParts(clock.now()).y;
  const e = easter(year);
  const time = (k, end) => `<input type="time" id="s-${k}-${end}" name="${k}-${end}" value="${pad(Math.floor(st[k][end] / 60))}:${pad(st[k][end] % 60)}" step="900" aria-describedby="e-${k}">`;
  const tests = SLA_EXAMPLES.map(([pkg, pr, rec, exp, what]) => {
    const got = reactionDeadline(fromLocalInput(rec), pkg, pr, DEFAULT_WINDOWS), ok = toLocalInput(got) === exp;
    return `<tr><td>${pkg}</td><td>${pr}</td><td class="nowrap mono">${shortDT(fromLocalInput(rec))}</td><td class="nowrap mono">${DOW_SHORT[wParts(got).dow]} ${shortDT(got)}</td><td>${what}</td><td>${ok ? '<span class="chip st-done">zgodny</span>' : `<span class="chip chip--danger">inny niż ${exp}</span>`}</td></tr>`;
  }).join('');
  return {
    title: 'Ustawienia',
    html: `<div class="page page--narrow">
<div class="phead"><div><h1>Ustawienia</h1><p class="dim">Nowe godziny okien obowiązują tylko zgłoszenia przyjęte po zapisie.</p></div></div>
<form class="settings" data-form="settings" novalidate>
  <h2 class="sect">Okna obsługi i stawka</h2>
  <div class="srow"><div><p class="srow__l">Okno dni roboczych</p><p class="dim small">pn–pt bez świąt</p></div><div class="hrow"><label for="s-biz-from" class="sr-only">Okno dni roboczych od</label>${time('biz', 'from')}<span class="dim">–</span><label for="s-biz-to" class="sr-only">Okno dni roboczych do</label>${time('biz', 'to')}</div><p class="fld__err" id="e-biz" data-err="biz"></p></div>
  <div class="srow"><div><p class="srow__l">Okno codzienne</p><p class="dim small">każdy dzień, także święta</p></div><div class="hrow"><label for="s-day-from" class="sr-only">Okno codzienne od</label>${time('day', 'from')}<span class="dim">–</span><label for="s-day-to" class="sr-only">Okno codzienne do</label>${time('day', 'to')}</div><p class="fld__err" id="e-day" data-err="day"></p></div>
  <div class="srow"><div><p class="srow__l"><label for="s-rate">Stawka za prace dodatkowe</label></p><p class="dim small">zł za godzinę</p></div><div><input type="text" inputmode="decimal" id="s-rate" name="rate" value="${String(st.rate).replace('.', ',')}" aria-describedby="e-rate" class="w-short"></div><p class="fld__err" id="e-rate" data-err="rate"></p></div>
  <p class="dim small">Okno obejmuje godzinę otwarcia, ale nie zamknięcia: zgłoszenie z 17:00 przychodzi już po zamknięciu.</p>
  <button type="submit" class="btn btn--primary">Zapisz</button>
</form>
<h2 class="sect">Reguły SLA</h2>
<div class="scroll"><table class="tbl tbl--plain"><thead><tr><th scope="col">Priorytet</th>${PACKAGES.map(p => `<th scope="col">${p}</th>`).join('')}</tr></thead>
  <tbody>${PRIORITIES.map(pr => `<tr><th scope="row">${prioTag(pr)}</th>${PACKAGES.map(p => `<td>${ruleLabel(RULES[p][pr])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<details class="more"><summary>Przykłady ze specyfikacji (test przy domyślnych oknach)</summary><div class="scroll"><table class="tbl tbl--plain"><thead><tr><th scope="col">Pakiet</th><th scope="col">Priorytet</th><th scope="col">Przyjęte</th><th scope="col">Termin</th><th scope="col">Co sprawdza</th><th scope="col">Wynik</th></tr></thead><tbody>${tests}</tbody></table></div></details>
<h2 class="sect">Święta ${year} <nav class="stepper" aria-label="Rok"><a href="#/ustawienia?rok=${year - 1}" aria-label="Rok ${year - 1}">‹</a><span>${year}</span><a href="#/ustawienia?rok=${year + 1}" aria-label="Rok ${year + 1}">›</a></nav></h2>
<p class="dim small">Liczone z reguł: Wielkanoc ${fmtDn(e)}, Boże Ciało ${fmtDn(e + 60)}.${year >= 2025 ? ' Wigilia wolna od 2025.' : ''}</p>
<ul class="hols">${[...holidays(year)].map(([dn, name]) => `<li><span class="mono">${fmtDn(dn).slice(0, 5)}</span><span class="dim">${DOW_SHORT[dowOf(dn)]}</span><span>${name}</span></li>`).join('')}</ul>
<h2 class="sect">Zespół</h2>
<p class="dim small">Konta zakłada <code>create-user --email &lt;e-mail&gt; --role owner|employee</code>. Zablokowanie kończy sesje. Sesja: 7 dni od ostatniej aktywności.</p>
<table class="tbl"><thead><tr><th scope="col">Osoba</th><th scope="col">E-mail</th><th scope="col">Rola</th><th scope="col">TOTP</th><th scope="col">Konto</th><th scope="col"><span class="sr-only">Akcje</span></th></tr></thead>
  <tbody>${STAFF.map(u => `<tr><td class="tbl__main" data-label="Osoba">${whoTag(u.id)} ${esc(u.name)}</td><td data-label="E-mail">${esc(u.email)}</td><td data-label="Rola">${ROLE_LABEL[u.role]}</td><td data-label="TOTP">${store.get(totpKey(u), false) ? 'włączone' : 'nieskonfigurowane'}</td><td data-label="Konto">${staffActive(u.id) ? '<span class="chip st-done">aktywne</span>' : '<span class="chip chip--danger">zablokowane</span>'}</td><td class="num">${u.role === 'owner' ? '' : `<button type="button" class="btn btn--sm" data-act="staff-toggle" data-id="${u.id}">${staffActive(u.id) ? 'Zablokuj' : 'Odblokuj'}</button>`}</td></tr>`).join('')}</tbody></table>
<details class="more"><summary>Co może pracownik, a co tylko właściciel</summary><div class="scroll"><table class="tbl tbl--plain"><thead><tr><th scope="col">Uprawnienie</th><th scope="col">Właściciel</th><th scope="col">Pracownik</th></tr></thead>
  <tbody>${PERM_TABLE.map(([what, o, e]) => `<tr><td>${what}</td><td>${o}</td><td class="${e === 'nie' ? 'danger' : ''}">${e}</td></tr>`).join('')}</tbody></table></div></details>
<p class="dim small">Polecenia serwisowe przez <code>dotnet run --</code>: <code>create-user</code>, <code>set-password</code>, <code>reset-totp</code>, <code>backup</code>, <code>reset-demo</code>.</p>
</div>`,
  };
}

// ---------- client panel (simulated client accounts) ----------
const P_VIEWS = { otwarte: 'Otwarte', zamkniete: 'Zamknięte', wszystkie: 'Wszystkie' };
const pTickets = (c, view) => { const all = clientTickets(c.id); return view === 'otwarte' ? all.filter(t => isOpenStatus(t.status)) : view === 'zamkniete' ? all.filter(t => isClosed(t.status)) : all; };
function syncRoleSelect() {
  const sel = $('#roleSelect');
  if (!sel) return;
  const s = store.get('session', null), on = s && Date.now() - s.last < 7 * DAY;
  sel.innerHTML = `${on ? '' : '<option value="">niezalogowany</option>'}<optgroup label="Zespół">${STAFF.map(u => `<option value="${u.role}">${u.name}${staffActive(u.id) ? '' : ' (zablokowany)'}</option>`).join('')}</optgroup><optgroup label="Panel klienta (${portalClients().length})">${portalClients().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`;
  sel.value = !on ? '' : s.role === 'client' ? s.clientId : s.role;
}
function portalSideHTML(c, r, preview) {
  const ym = ymNow(), used = poolUsed(c.id, ym);
  const link = (href, label, n, on) => `<a href="${href}" class="${on ? 'is-active' : ''}"${on ? ' aria-current="page"' : ''}><span>${label}</span>${n != null ? `<span class="side__n">${n}</span>` : ''}</a>`;
  return `
  <div class="side__top">
    <a class="brand" href="#/" aria-label="ClientTracker, panel klienta"><span class="brand__mark" aria-hidden="true"></span>ClientTracker</a>
    <button type="button" class="iconbtn side__close" data-act="side-close" aria-label="Zamknij menu">×</button>
  </div>
  ${preview ? `<div class="side__preview"><p><b>Podgląd jako klient.</b> Tak ten panel widzi ${esc(c.name)}.</p><button type="button" class="btn btn--sm btn--block" data-act="portal-exit">Wróć do widoku właściciela</button></div>` : ''}
  <p class="side__who"><b>${esc(c.name)}</b><span class="dim small">panel klienta · pakiet ${c.pkg}</span></p>
  <a class="btn btn--primary btn--block" href="#/nowe">Nowe zgłoszenie <kbd>N</kbd></a>
  <nav class="side__nav" aria-label="Zgłoszenia">${Object.entries(P_VIEWS).map(([k, l]) => link(`#/v/${k}`, l, pTickets(c, k).length, r.page === 'inbox' && r.view === k)).join('')}</nav>
  <nav class="side__nav" aria-label="Pozostałe">${link('#/godziny', 'Godziny i raporty', null, r.page === 'godziny')}</nav>
  <div class="side__info">
    <p class="cap">Pula · ${MONTHS[+ym.slice(5) - 1]}</p>
    ${c.pool ? meter(used, c.pool) : '<p class="dim small">pakiet bez puli godzin</p>'}
    <p class="cap">Czas reakcji w pakiecie</p>
    <ul class="rules">${PRIORITIES.map(p => `<li>${prioTag(p)}<span>${ruleLabel(RULES[c.pkg][p])}</span></li>`).join('')}</ul>
  </div>
  <div class="side__foot"><span class="dim small">${esc(c.email)}</span>${preview ? '' : '<button type="button" class="btn btn--text btn--sm" data-act="logout">Wyloguj</button>'}</div>`;
}
function renderPortal(pid, force) {
  const s = store.get('session', null), preview = s.role !== 'client', c = clientById(pid);
  const shell = $('.shell--portal');
  if (force || !shell || shell.dataset.pid !== pid || shell.dataset.preview !== String(preview)) {
    root.innerHTML = `
<div class="shell shell--portal" data-pid="${c.id}" data-preview="${preview}">
  <header class="topbar">
    <button type="button" class="iconbtn" data-act="side-open" aria-label="Menu" aria-controls="side">☰</button>
    <a class="brand" href="#/"><span class="brand__mark" aria-hidden="true"></span><span class="brand__name">${esc(c.name)}</span></a>
    <a class="btn btn--primary btn--sm" href="#/nowe">+ Zgłoszenie</a>
  </header>
  <aside class="side" id="side" aria-label="Nawigacja panelu klienta"></aside>
  <div class="scrim" data-act="side-close"></div>
  <main class="main" id="app" tabindex="-1"></main>
</div>`;
  }
  const r = parseHash();
  if (r.page === 'inbox') { r.klient = ''; if (!P_VIEWS[r.view]) r.view = 'otwarte'; }
  const lp = $('.ilist__rows');
  if (lp) listUI.scroll = lp.scrollTop;
  $('#side').innerHTML = portalSideHTML(c, r, preview);
  let v;
  switch (r.page) {
    case 'inbox': v = pInbox(c, r); break;
    case 'nowe': v = pNew(c); break;
    case 'godziny': v = pHours(c, r.q); break;
    default: v = { title: 'Nie znaleziono', html: '<div class="page"><div class="empty"><h1>Nie ma takiej strony</h1><p><a href="#/">Wróć do zgłoszeń</a></p></div></div>' };
  }
  const app = $('#app');
  app.innerHTML = v.html;
  app.classList.toggle('main--inbox', r.page === 'inbox');
  app.classList.toggle('has-detail', r.page === 'inbox' && !!r.z);
  document.title = `${v.title} · ${c.name} · ClientTracker`;
  if (v.after) v.after();
  const key = 'p|' + r.page + '|' + (r.view || ''), rows = $('.ilist__rows');
  if (rows && key === listUI.key) rows.scrollTop = listUI.scroll;
  if (key !== listUI.key) { app.scrollTop = 0; window.scrollTo(0, 0); if (lastRoute !== null) app.focus({ preventScroll: true }); }
  listUI.key = key; lastRoute = location.hash;
  closeSide();
  $('#datasetSelect').value = DB.dataset || 'small';
  tick();
}
function pInbox(c, r) {
  const now = clock.now(), list = pTickets(c, r.view);
  const t = r.z ? ticketByNo(r.z) : null, own = t && t.clientId === c.id;
  const waiting = clientTickets(c.id).filter(x => x.status === 'Czeka na klienta');
  return {
    title: own ? `#${t.no} ${t.title}` : 'Zgłoszenia',
    html: `
<div class="inbox">
  <section class="ilist" aria-label="Twoje zgłoszenia">
    <div class="ilist__head"><h1>Twoje zgłoszenia</h1><span class="count">${list.length}</span></div>
    <nav class="tabs" aria-label="Filtr">${Object.entries(P_VIEWS).map(([k, l]) => `<a href="#/v/${k}"${k === r.view ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
    ${waiting.length ? `<p class="ilist__ask small">Czekamy na Twoją odpowiedź: ${waiting.map(x => `<a href="${inboxHref(r, { z: x.no })}">#${x.no}</a>`).join(', ')}</p>` : ''}
    <div class="ilist__rows" role="list">${list.map(x => rowHTML(x, r, now, true)).join('') || `<div class="empty"><p>${r.view === 'otwarte' ? 'Nie masz otwartych zgłoszeń.' : 'Brak zgłoszeń.'}</p><p><a href="#/nowe">Dodaj zgłoszenie</a></p></div>`}</div>
  </section>
  <section class="detail" aria-label="Szczegóły zgłoszenia">${own ? pDetail(t, r) : r.z ? '<div class="detail__empty"><p>Nie ma takiego zgłoszenia.</p></div>' : `<div class="detail__empty"><p>Wybierz zgłoszenie z listy.</p><p class="dim small">Tu zobaczysz, na jakim jest etapie i kiedy najpóźniej zareagujemy.</p></div>`}</section>
</div>`,
  };
}
function pDetail(t, r) {
  const now = clock.now(), entries = entriesOfTicket(t.no), hist = t.history.filter(h => h.field === 'status').slice().reverse();
  return `
  <div class="detail__bar"><a class="btn btn--text btn--sm detail__back" href="${inboxHref(r, { z: 0 })}">← Lista</a><span class="dim small">#${t.no} · ${t.priority.toLowerCase()}</span><span class="grow"></span><a class="iconbtn detail__x" href="${inboxHref(r, { z: 0 })}" aria-label="Zamknij szczegóły (Esc)">×</a></div>
  <div class="detail__body">
    <h2 class="detail__title">${esc(t.title)}</h2>
    <p class="detail__meta">${statusChip(t.status)}<span class="dim">${STATUS_HINT[t.status]}</span>${prioTag(t.priority)}<span class="dim">przyjęte ${fmtDTdow(t.receivedAt)}</span></p>
    <section class="block" aria-label="Gdzie jest zgłoszenie">${statusFlow(t, true)}</section>
    <section class="block" aria-labelledby="pslaH">
      <div class="block__head"><h3 id="pslaH">Termin reakcji</h3>${slaTag(t, now)}</div>
      <p class="deadline">${fmtDTdow(t.deadline)} <span class="dim small">· ${ruleLabel(RULES[t.pkg][t.priority])}, pakiet ${t.pkg}</span></p>
      <dl class="facts">
        <div><dt>Reakcja</dt><dd>${t.reactedAt != null ? `${fmtDTdow(t.reactedAt)} <span class="dim">po ${fmtDur(t.reactedAt - t.receivedAt)}</span>` : '<span class="dim">jeszcze nie</span>'}</dd></div>
        <div><dt>Zamknięte</dt><dd>${t.closedAt != null ? fmtDTdow(t.closedAt) : '<span class="dim">otwarte</span>'}</dd></div>
      </dl>
      <p class="dim small">Gwarantujemy czas reakcji, nie naprawy.</p>
    </section>
    <section class="block" aria-labelledby="pdH"><div class="block__head"><h3 id="pdH">Opis</h3></div>${t.desc ? `<p class="prewrap">${esc(t.desc)}</p>` : '<p class="dim">Bez opisu.</p>'}</section>
    <section class="block" aria-labelledby="peH">
      <div class="block__head"><h3 id="peH">Przepracowany czas <span class="count">${fmtHours(sumHours(entries))} h</span></h3></div>
      ${entries.length ? `<ul class="entries">${entries.map(e => `<li><span class="mono dim">${fmtDn(dnFromISO(e.date))}</span>${kindChip(e.kind)}<b class="mono">${fmtHours(e.hours)} h</b><span class="entries__desc">${esc(e.desc) || '—'}</span><span></span></li>`).join('')}</ul>` : '<p class="dim">Jeszcze nie ma wpisów.</p>'}
    </section>
    <section class="block" aria-labelledby="phH"><div class="block__head"><h3 id="phH">Historia</h3></div>
      ${hist.length ? `<ol class="hist">${hist.map(h => `<li><time class="mono">${fmtDT(h.at)}</time> ${esc(h.from)} → ${esc(h.to)}</li>`).join('')}</ol>` : '<p class="dim">Bez zmian od przyjęcia.</p>'}
    </section>
  </div>`;
}
function pNew(c) {
  return {
    title: 'Nowe zgłoszenie',
    html: `<div class="page page--narrow">
<p class="crumbs"><a href="#/">← Zgłoszenia</a></p>
<div class="phead"><div><h1>Nowe zgłoszenie</h1><p class="dim">Przyjmujemy je w chwili wysłania. Termin reakcji liczymy według pakietu ${c.pkg}.</p></div></div>
<form class="formcard" data-form="portal-ticket" novalidate>
  ${fld('title', 'Czego dotyczy?', `<input type="text" ${ctl('title', 'required maxlength="160" autocomplete="off" placeholder="np. Nie działa formularz kontaktowy"')}>`)}
  ${fld('desc', 'Opis', `<textarea ${ctl('desc', 'rows="5" placeholder="Co się dzieje, od kiedy, na której stronie"')}></textarea>`)}
  ${segmented('priority', 'Jak pilne?', PRIORITIES, 'Normalny', Object.fromEntries(PRIORITIES.map(p => [p, ruleLabel(RULES[c.pkg][p])])))}
  <p class="dim small">Krytyczny: strona albo sprzedaż nie działa. Wysoki: ważna funkcja działa źle. Normalny: zmiany i drobne poprawki.</p>
  <output class="preview" id="pPreview" aria-live="polite"></output>
  <div class="hrow"><button type="submit" class="btn btn--primary">Wyślij zgłoszenie</button><a class="btn" href="#/">Anuluj</a></div>
</form></div>`,
    after() { portalPreview($('[data-form="portal-ticket"]')); $('#f-title').focus(); },
  };
}
function portalPreview(form) {
  const c = clientById(portalId()), pr = new FormData(form).get('priority');
  $('#pPreview', form).innerHTML = `<span class="dim small">Jeśli wyślesz teraz, zareagujemy najpóźniej</span><b>${fmtDTdow(reactionDeadline(clock.now(), c.pkg, pr, DB.settings))}</b><span class="dim small">${ruleLabel(RULES[c.pkg][pr])}</span>`;
}
function pHours(c, q) {
  const ym = /^\d{4}-\d{2}$/.test(q.miesiac || '') ? q.miesiac : ymNow();
  const s = monthSummary(c.id, ym), entries = s.entries.slice().sort((a, b) => a.date.localeCompare(b.date));
  return {
    title: `Godziny i raporty · ${ymLabel(ym)}`,
    html: `<div class="page">
<div class="phead"><div><h1>Godziny i raporty</h1><p class="dim">Pakiet ${c.pkg}: ${c.pool ? `${fmtHours(c.pool)} h zmian w miesiącu` : 'bez puli godzin na zmiany'}, utrzymanie w cenie abonamentu.</p></div>${ymNav(ym, m => `#/godziny?miesiac=${m}`)}</div>
<dl class="sums">
  <div><dt>Pula na zmiany</dt><dd>${fmtHours(s.pool)} z ${fmtHours(s.poolMax)} h${s.over ? `<small class="danger">ponad pulę o ${fmtHours(s.over)} h</small>` : ''}</dd></div>
  <div><dt>Utrzymanie</dt><dd>${fmtHours(s.maint)} h <small>w cenie abonamentu</small></dd></div>
  <div><dt>Prace dodatkowe</dt><dd>${fmtHours(s.extra)} h <small>poza pakietem, osobno</small></dd></div>
  <div><dt>Razem</dt><dd>${fmtHours(s.total)} h</dd></div>
</dl>
<h2 class="sect">Raport miesięczny</h2>
<article class="md">${mdToHtml(monthReport(c.id, ym))}</article>
<h2 class="sect">Wpisy czasu <span class="count">${entries.length}</span></h2>
${entries.length ? `<ul class="entries entries--wide">${entries.map(e => { const t = e.ticketNo ? ticketByNo(e.ticketNo) : null; return `<li><span class="mono dim">${fmtDn(dnFromISO(e.date))}</span>${kindChip(e.kind)}<b class="mono">${fmtHours(e.hours)} h</b><span class="entries__desc">${t ? `<a href="#/z/${t.no}">#${t.no} ${esc(t.title)}</a>` : '<span class="dim">bez zgłoszenia</span>'}<small>${esc(e.desc) || '—'}</small></span><span></span></li>`; }).join('')}</ul>` : '<p class="dim">Brak wpisów w tym miesiącu.</p>'}
</div>`,
  };
}

// ---------- dialogs ----------
const fld =(name, label, control, hint = '') => `<div class="fld"><label for="f-${name}">${label}</label>${control}${hint ? `<p class="fld__hint">${hint}</p>` : ''}<p class="fld__err" id="e-${name}" data-err="${name}"></p></div>`;
const ctl = (name, attrs = '') => `id="f-${name}" name="${name}" aria-describedby="e-${name}" ${attrs}`;
const segmented = (name, legend, opts, sel, desc = {}) => `<fieldset class="fset"><legend>${legend}</legend><div class="seg">${opts.map(o =>
  `<label class="seg__opt"><input type="radio" name="${name}" value="${o}"${o === sel ? ' checked' : ''}><span>${o}${desc[o] ? `<small>${desc[o]}</small>` : ''}</span></label>`).join('')}</div><p class="fld__err" id="e-${name}" data-err="${name}"></p></fieldset>`;
let dlgReturn = null;
function openDialog({ title, body, submit = 'Zapisz', danger = false, wide = false, onSubmit, onInput }) {
  dlgReturn = document.activeElement;
  dlg.className = 'dlg' + (wide ? ' dlg--wide' : '');
  dlg.innerHTML = `<form class="dlg__form" novalidate>
    <header class="dlg__head"><h2 id="dlgTitle">${title}</h2><button type="button" class="iconbtn" data-act="dlg-close" aria-label="Zamknij">×</button></header>
    <div class="dlg__body">${body}</div>
    <footer class="dlg__foot"><button type="button" class="btn" data-act="dlg-close">${submit ? 'Anuluj' : 'Zamknij'}</button>${submit ? `<button type="submit" class="btn ${danger ? 'btn--dangerfill' : 'btn--primary'}">${submit}</button>` : ''}</footer>
  </form>`;
  const form = $('form', dlg);
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    try { const msg = onSubmit(form); dlg.close(); render(); if (msg) toast(msg); }
    catch (err) { if (err instanceof Invalid) showErrors(form, err.errors); else if (err.forbidden) toast(err.message, 'danger'); else throw err; }
  });
  if (onInput) { form.addEventListener('input', ev => onInput(form, ev)); form.addEventListener('change', ev => onInput(form, ev)); onInput(form, null); }
  dlg.showModal();
  const first = $('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea', form);
  if (first) first.focus();
}
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
  const t = no ? ticketByNo(no) : null, now = clock.now();
  const sel = t ? t.clientId : presetClient && clientById(presetClient)?.active ? presetClient : '';
  if (!t && !DB.clients.some(c => c.active)) return toast('Najpierw dodaj aktywnego klienta.', 'danger');
  openDialog({
    title: t ? `Edycja zgłoszenia #${t.no}` : 'Nowe zgłoszenie',
    submit: t ? 'Zapisz zmiany' : 'Przyjmij zgłoszenie', wide: true,
    body: `
      <div class="grid2">
        ${fld('clientId', 'Klient', `<select ${ctl('clientId', t ? 'disabled' : 'required')}>${t ? `<option>${esc(clientById(t.clientId).name)}</option>` : `<option value="">Wybierz klienta</option>${clientOptions(sel, { activeOnly: true })}`}</select>`, t ? '' : 'Tylko aktywni klienci. Wpisz pierwsze litery, żeby przeskoczyć.')}
        ${fld('receivedAt', 'Przyjęte o', `<input type="datetime-local" ${ctl('receivedAt', `required max="${toLocalInput(now)}"`)} value="${toLocalInput(t ? t.receivedAt : now)}">`, 'Godzina z maila albo telefonu, nie w przyszłości.')}
      </div>
      ${fld('title', 'Tytuł', `<input type="text" ${ctl('title', 'required maxlength="160" autocomplete="off"')} value="${t ? esc(t.title) : ''}">`)}
      ${fld('desc', 'Opis', `<textarea ${ctl('desc', 'rows="3"')}>${t ? esc(t.desc) : ''}</textarea>`)}
      <div class="grid2">
        ${segmented('priority', 'Priorytet', PRIORITIES, t ? t.priority : 'Normalny')}
        ${fld('source', 'Źródło', `<select ${ctl('source')}>${SOURCES.map(s => `<option${(t ? t.source : 'Mail') === s ? ' selected' : ''}>${s}</option>`).join('')}</select>`)}
      </div>
      <output class="preview" id="dlPreview" aria-live="polite"></output>`,
    onInput(form) {
      const fd = new FormData(form);
      const c = t ? clientById(t.clientId) : clientById(fd.get('clientId'));
      const rec = fromLocalInput(fd.get('receivedAt')), pr = fd.get('priority'), out = $('#dlPreview', form);
      if (!c || isNaN(rec) || !pr) { out.innerHTML = '<span class="dim">Termin reakcji pojawi się po wyborze klienta.</span>'; return; }
      const pkg = t ? t.pkg : c.pkg, win = t ? t.win : DB.settings;
      out.innerHTML = `<span class="dim small">Termin reakcji</span><b>${fmtDTdow(reactionDeadline(rec, pkg, pr, win))}</b><span class="dim small">${ruleLabel(RULES[pkg][pr])} · pakiet ${pkg}${t ? ' z chwili przyjęcia' : ''}</span>`;
    },
    onSubmit(form) {
      const fd = new FormData(form);
      const d = { title: fd.get('title'), desc: fd.get('desc'), priority: fd.get('priority'), source: fd.get('source'), receivedAt: fromLocalInput(fd.get('receivedAt')) };
      if (t) { updateTicket(t.no, d); return `Zapisano #${t.no}. Termin reakcji: ${fmtDT(t.deadline)}.`; }
      const n = createTicket({ ...d, clientId: fd.get('clientId') });
      location.hash = `#/v/otwarte?z=${n.no}`;
      return `Przyjęto #${n.no}. Termin reakcji: ${fmtDTdow(n.deadline)}.`;
    },
  });
}
function entryDialog(id, preset = {}) {
  const e = id ? DB.entries.find(x => x.id === id) : null;
  const cid = e ? e.clientId : preset.client || '';
  const tno = e ? e.ticketNo : preset.ticket ? +preset.ticket : null;
  const ticketOpts = (clientId, selNo) => `<option value="">Bez zgłoszenia</option>` + DB.tickets.filter(t => t.clientId === clientId).sort((a, b) => b.no - a.no)
    .map(t => `<option value="${t.no}"${t.no === selNo ? ' selected' : ''}>#${t.no} ${esc(t.title)}${isClosed(t.status) ? ` (${t.status.toLowerCase()})` : ''}</option>`).join('');
  openDialog({
    title: e ? 'Popraw wpis czasu' : 'Dodaj czas pracy',
    submit: e ? 'Zapisz zmiany' : 'Zapisz wpis', wide: true,
    body: `
      <div class="grid2">
        ${fld('clientId', 'Klient', `<select ${ctl('clientId', 'required')}><option value="">Wybierz klienta</option>${clientOptions(cid)}</select>`)}
        ${fld('ticketNo', 'Zgłoszenie', `<select ${ctl('ticketNo')}>${ticketOpts(cid, tno)}</select>`, 'Opcjonalnie, tylko zgłoszenia tego klienta.')}
      </div>
      <div class="grid2">
        ${fld('date', 'Data', `<input type="date" ${ctl('date', 'required')} value="${e ? e.date : todayISO()}">`)}
        <div class="fld"><label for="f-hours">Czas (godziny)</label><input type="text" inputmode="decimal" ${ctl('hours', 'required autocomplete="off" placeholder="np. 1,5"')} value="${e ? fmtHours(e.hours) : ''}">
          <div class="hrow" role="group" aria-label="Szybki wybór czasu">${[0.25, 0.5, 1, 1.5, 2, 4].map(h => `<button type="button" class="btn btn--sm" data-quick="${fmtHours(h)}">${fmtHours(h)}</button>`).join('')}</div>
          <p class="fld__hint">Od 0,25 do 24 h, co 0,25 h. Przyjmuje 1,5 i 1.5.</p><p class="fld__err" id="e-hours" data-err="hours"></p></div>
      </div>
      ${segmented('kind', 'Rodzaj', KINDS, e ? e.kind : 'Utrzymanie', { Pula: 'z puli pakietu', Utrzymanie: 'w cenie abonamentu', Dodatkowe: can('money') ? `${fmtMoney(DB.settings.rate)}/h` : 'poza pakietem' })}
      ${fld('desc', 'Opis', `<input type="text" ${ctl('desc', 'maxlength="200" autocomplete="off"')} value="${e ? esc(e.desc) : ''}">`)}`,
    onInput(form, ev) { if (ev && ev.target.name === 'clientId') $('#f-ticketNo', form).innerHTML = ticketOpts(ev.target.value, null); },
    onSubmit(form) {
      const fd = new FormData(form);
      const d = { clientId: fd.get('clientId'), ticketNo: fd.get('ticketNo'), date: fd.get('date'), hours: fd.get('hours'), kind: fd.get('kind'), desc: fd.get('desc') };
      const x = e ? updateEntry(e.id, d) : createEntry(d);
      return `${e ? 'Poprawiono' : 'Zapisano'}: ${fmtHours(x.hours)} h ${x.kind}, ${fmtDn(dnFromISO(x.date))}.`;
    },
  });
}
function clientDialog(id) {
  const c = id ? clientById(id) : null, pkg = c ? c.pkg : 'Standard';
  openDialog({
    title: c ? `Edycja: ${esc(c.name)}` : 'Nowy klient',
    submit: c ? 'Zapisz zmiany' : 'Dodaj klienta',
    body: `
      ${fld('name', 'Nazwa', `<input type="text" ${ctl('name', 'required maxlength="120" autocomplete="off"')} value="${c ? esc(c.name) : ''}">`, 'Musi być unikalna.')}
      ${fld('email', 'E-mail kontaktowy', `<input type="email" ${ctl('email', 'autocomplete="off"')} value="${c ? esc(c.email) : ''}">`)}
      ${segmented('pkg', 'Pakiet', PACKAGES, pkg, Object.fromEntries(PACKAGES.map(p => [p, `${fmtMoney(PACKAGE_DEFAULTS[p].price)} · ${fmtHours(PACKAGE_DEFAULTS[p].pool)} h`])))}
      <div class="grid2">
        ${fld('price', 'Abonament miesięcznie (zł)', `<input type="text" inputmode="decimal" ${ctl('price', 'required')} value="${String(c ? c.price : PACKAGE_DEFAULTS[pkg].price).replace('.', ',')}">`)}
        ${fld('pool', 'Pula godzin w miesiącu', `<input type="text" inputmode="decimal" ${ctl('pool', 'required')} value="${fmtHours(c ? c.pool : PACKAGE_DEFAULTS[pkg].pool)}">`)}
      </div>
      <p class="dim small">Pakiet podpowiada cenę i pulę, obie można zmienić. Zmiana pakietu nie przesuwa terminów istniejących zgłoszeń.</p>
      ${c ? `<label class="check check--box"><input type="checkbox" name="active"${c.active ? ' checked' : ''}><span>Aktywny<small>Nieaktywny klient znika z paska i nie przyjmuje zgłoszeń. Klienta nie da się usunąć.</small></span></label>` : ''}`,
    onInput(form, ev) {
      if (ev && ev.target.name === 'pkg') { const d = PACKAGE_DEFAULTS[ev.target.value]; $('#f-price', form).value = String(d.price); $('#f-pool', form).value = fmtHours(d.pool); }
    },
    onSubmit(form) {
      const fd = new FormData(form);
      const d = { name: fd.get('name'), email: fd.get('email'), pkg: fd.get('pkg'), price: parseHoursInput(fd.get('price')), pool: parseHoursInput(fd.get('pool')), active: fd.get('active') === 'on' };
      if (c) { updateClient(c.id, d); return `Zapisano: ${c.name}.`; }
      const n = createClient(d);
      location.hash = `#/v/wszystkie?klient=${n.id}`;
      return `Dodano klienta: ${n.name}.`;
    },
  });
}
function reportDialog(id, ym) {
  const md = monthReport(id, ym), c = clientById(id);
  openDialog({
    title: `Raport: ${esc(c.name)}, ${ymLabel(ym)}`, submit: null, wide: true,
    body: `<div class="fld"><label for="f-report">Markdown dla klienta</label><textarea id="f-report" class="report" rows="20" readonly>${esc(md)}</textarea></div>
      <div class="hrow"><button type="button" class="btn btn--primary" data-act="copy-report">Kopiuj do schowka</button><p class="dim small">Bez kwot i efektywnej stawki. Sekcje z „…” uzupełniasz ręcznie.</p></div>`,
    onSubmit() {},
  });
}
const confirmDialog = (title, text, submit, fn) => openDialog({ title, submit, danger: true, body: `<p>${text}</p>`, onSubmit: fn });

// ---------- events ----------
document.addEventListener('click', ev => {
  try { onClick(ev); } catch (err) { if (err.forbidden) return toast(err.message, 'danger'); throw err; }
});
function onClick(ev) {
  const row = ev.target.closest('tr[data-href]');
  if (row && !ev.target.closest('a, button')) { location.hash = row.dataset.href; return; }
  const q = ev.target.closest('[data-quick]');
  if (q) { const i = $('#f-hours'); i.value = q.dataset.quick; i.focus(); return; }
  const b = ev.target.closest('[data-act]');
  if (!b) return;
  const d = b.dataset;
  switch (d.act) {
    case 'theme': return cycleTheme();
    case 'demo-toggle': { const open = document.querySelector('.demo').classList.toggle('is-open'); b.setAttribute('aria-expanded', open); b.textContent = open ? 'Mniej' : 'Więcej'; return; }
    case 'side-open': sideUI.open = true; document.body.classList.add('side-open'); return $('#sideSearch').focus();
    case 'side-close': return closeSide();
    case 'clock-live': clock.live(); toast('Zegar na żywo.'); return rerenderAll();
    case 'reset-demo': return confirmDialog('reset-demo', 'Usunąć klientów, zgłoszenia, wpisy czasu i Ustawienia, a potem wgrać dane demo? Konta i sesje zostają.', 'Wgraj dane demo', () => {
      resetDemo(); return `reset-demo: ${DB.clients.length} klientów, ${DB.tickets.length} zgłoszeń, ${DB.entries.length} wpisów czasu. Sesja zachowana.`;
    });
    case 'logout': store.del('session'); login.step = 'password'; login.err = ''; toast('Wylogowano.'); return render();
    case 'fill-login': $('#lEmail').value = ACCOUNT.email; $('#lPass').value = ACCOUNT.password; return $('#loginForm button[type=submit]').focus();
    case 'skip-login': login.user = 'u1'; return loginSucceeded();
    case 'skip-login-employee': return startSession('employee');
    case 'assign': { const t = assignTicket(+d.no, d.to || null); render(); return toast(`#${t.no}: prowadzi ${staffName(t.assignee)}.`); }
    case 'staff-toggle': { const u = staffById(d.id); setStaffActive(u.id, !staffActive(u.id)); render(); return toast(`${u.name}: konto ${staffActive(u.id) ? 'odblokowane' : 'zablokowane, sesje zakończone'}.`); }
    case 'skip-login-client': { const c = portalClients().find(x => x.id === 'c2') || portalClients()[0]; return c ? startSession('client', c.id) : toast('Żaden klient nie ma dostępu do panelu.', 'danger'); }
    case 'portal-toggle': {
      const c = clientById(d.id);
      try { setPortal(c.id, !c.portal); } catch (err) { if (err instanceof Invalid) return toast(err.errors.portal, 'danger'); throw err; }
      render();
      return toast(c.portal ? `${c.name}: dostęp do panelu włączony. Login: ${c.email}.` : `${c.name}: dostęp do panelu wyłączony, sesje klienta zakończone.`);
    }
    case 'portal-preview': { const s = store.get('session', null); store.set('session', { ...s, as: d.id }); location.hash = '#/'; return render(true); }
    case 'portal-exit': { const s = store.get('session', null), id = s.as; delete s.as; store.set('session', s); location.hash = `#/v/wszystkie?klient=${id}`; return render(true); }
    case 'fill-code': { const i = $('#lCode'); i.value = totpCode(totpStep()); return i.focus(); }
    case 'login-back': login.step = 'password'; login.err = ''; return renderLogin();
    case 'new-ticket': return ticketDialog(null, d.client || parseHash().klient);
    case 'edit-ticket': return ticketDialog(+d.no);
    case 'status': {
      const wasNew = ticketByNo(+d.no).status === 'Nowe';
      setStatus(+d.no, d.to);
      const t = ticketByNo(+d.no);
      render();
      return toast(wasNew ? `#${t.no}: ${t.status}. Zapisano reakcję ${fmtDT(t.reactedAt)} (${slaState(t, clock.now()).text.toLowerCase()}).` : `#${t.no}: ${t.status}.`);
    }
    case 'new-entry': return entryDialog(null, { client: d.client || parseHash().klient, ticket: d.ticket });
    case 'edit-entry': return entryDialog(d.id);
    case 'del-entry': {
      const e = DB.entries.find(x => x.id === d.id);
      return confirmDialog('Usunąć wpis czasu?', `${fmtDn(dnFromISO(e.date))} · ${fmtHours(e.hours)} h ${e.kind} · ${esc(clientById(e.clientId).name)}${e.desc ? ' · ' + esc(e.desc) : ''}`, 'Usuń wpis', () => { deleteEntry(e.id); return 'Usunięto wpis.'; });
    }
    case 'new-client': return clientDialog(null);
    case 'edit-client': return clientDialog(d.id);
    case 'report': return reportDialog(d.client, d.ym);
    case 'copy-report': {
      const ta = $('#f-report'), done = () => toast('Raport skopiowany.');
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); document.execCommand('copy'); done(); });
      else { ta.select(); document.execCommand('copy'); done(); }
      return;
    }
    case 'dlg-close': return dlg.close();
  }
}
document.addEventListener('input', ev => {
  if (ev.target.id === 'clientSearch') { clientUI.q = ev.target.value; filterClients(); }
  if (ev.target.id === 'sideSearch') { sideUI.q = ev.target.value; filterSide(); }
  const pf = ev.target.closest('[data-form="portal-ticket"]');
  if (pf) portalPreview(pf);
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.dataset.assign) { try { const x = assignTicket(+t.dataset.assign, t.value || null); render(); return toast(`#${x.no}: prowadzi ${staffName(x.assignee)}.`); } catch (err) { if (err.forbidden) { render(); return toast(err.message, 'danger'); } throw err; } }
  if (t.id === 'roleSelect') return ['owner', 'employee'].includes(t.value) ? startSession(t.value) : t.value ? startSession('client', t.value) : null;
  if (t.id === 'clientPkg') { clientUI.pkg = t.value; return filterClients(); }
  if (t.id === 'clientInactive') { clientUI.inactive = t.checked; return filterClients(); }
  if (t.id === 'datasetSelect') {
    resetDemo(t.value); clientUI.q = ''; sideUI.q = '';
    if (parseHash().klient || parseHash().z) location.hash = '#/';
    toast(`Dane demo: ${DB.clients.length} klientów, ${DB.tickets.length} zgłoszeń. Sesja zachowana.`);
    return rerenderAll();
  }
  if (t.dataset.filter === 'time') location.hash = `#/czas?miesiac=${t.dataset.ym}${t.value ? '&klient=' + t.value : ''}`;
});
document.addEventListener('submit', ev => {
  const form = ev.target;
  if (form.id === 'loginForm') { ev.preventDefault(); return submitLogin(form); }
  if (form.id === 'clockForm') {
    ev.preventDefault();
    const ms = fromLocalInput($('#clockInput').value);
    if (isNaN(ms)) return toast('Podaj datę i godzinę.', 'danger');
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
      location.hash = `#/v/otwarte?z=${t.no}`;
      toast(`Wysłano zgłoszenie #${t.no}. Zareagujemy najpóźniej ${fmtDTdow(t.deadline)}.`);
    }
    if (kind === 'reaction') { setReaction(+form.dataset.no, fromLocalInput(new FormData(form).get('reactedAt'))); render(); toast('Poprawiono godzinę reakcji.'); }
    if (kind === 'settings') {
      const fd = new FormData(form);
      const w = k => ({ from: parseHHMM(fd.get(k + '-from')), to: parseHHMM(fd.get(k + '-to')) });
      saveSettings({ biz: w('biz'), day: w('day'), rate: parseHoursInput(fd.get('rate')) });
      render(); toast('Zapisano ustawienia. Obowiązują nowe zgłoszenia.');
    }
  } catch (err) { if (err instanceof Invalid) showErrors(form, err.errors); else if (err.forbidden) toast(err.message, 'danger'); else throw err; }
});
// keyboard: j/k move through the list, n new ticket, t time entry, / filter clients, Esc closes the detail or the menu
document.addEventListener('keydown', ev => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey || dlg.open || !$('.shell')) return;
  const typing = ev.target.closest('input, textarea, select, [contenteditable]');
  if (ev.key === 'Escape') {
    if (typing) { ev.target.blur(); return; }
    if (sideUI.open) return closeSide();
    const r = parseHash();
    if (r.page === 'inbox' && r.z) location.hash = inboxHref(r, { z: 0 });
    return;
  }
  if (typing) return;
  const k = ev.key.toLowerCase(), inPortal = !!portalId();
  if (inPortal && k === 'n') { ev.preventDefault(); location.hash = '#/nowe'; return; }
  if (inPortal && (k === 't' || k === '/')) return;
  if (k === 'n') { ev.preventDefault(); return ticketDialog(null, parseHash().klient); }
  if (k === 't') { ev.preventDefault(); return entryDialog(null, { client: parseHash().klient, ticket: parseHash().z || '' }); }
  if (k === '/') { ev.preventDefault(); if (innerWidth < 900) { sideUI.open = true; document.body.classList.add('side-open'); } return $('#sideSearch').focus(); }
  if (k === 'j' || k === 'k') {
    const rows = $$('.ilist .row');
    if (!rows.length) return;
    ev.preventDefault();
    const i = rows.findIndex(r => r.classList.contains('is-selected'));
    const next = rows[Math.max(0, Math.min(rows.length - 1, i < 0 ? 0 : i + (k === 'j' ? 1 : -1)))];
    location.hash = next.getAttribute('href');
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
  $('#themeBtn').textContent = THEME_LABEL[next];
}
$('#themeBtn').textContent = THEME_LABEL[document.documentElement.dataset.theme || 'auto'];

// ---------- live updates ----------
function rerenderAll() { if (sessionValid()) render(true); else renderLogin(); }
let lastSlaTick = 0;
function tick() {
  const now = clock.now(), ci = $('#clockInput');
  if (ci && document.activeElement !== ci) ci.value = toLocalInput(now);
  const code = $('#authCode');
  if (code) { code.textContent = totpCode(totpStep()).replace(/(\d{3})/, '$1 '); $('#authTtl').textContent = `nowy kod za ${30 - Math.floor(Date.now() / 1000) % 30} s`; }
  if (Date.now() - lastSlaTick > 15000) {
    lastSlaTick = Date.now();
    $$('[data-sla]').forEach(el => { const t = ticketByNo(+el.dataset.sla); if (t) el.outerHTML = slaTag(t, now); });
  }
}
setInterval(tick, 1000);
render(true);
