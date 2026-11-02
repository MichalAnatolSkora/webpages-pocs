// ClientTracker v2 — the same service in a plain layout: login with TOTP, dashboard, clients (up to ~100), client card,
// ticket with the status diagram, time entries, month with the report, settings. Everything typed by the user is escaped before innerHTML (T-4).

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
  const key = loginUser().secret.match(/.{4}/g).join(' ');
  const err = login.err ? `<p class="alert alert--danger" role="alert">${esc(login.err)}</p>` : '';
  root.innerHTML = `
<main class="auth" id="app" tabindex="-1">
  <div class="auth__in">
    <p class="logo logo--big"><span class="logo__mark" aria-hidden="true"></span>ClientTracker</p>
    <form class="panel auth__card" id="loginForm" novalidate>
      ${login.step === 'password' ? `
        <h1>Zaloguj się</h1>
        <p class="muted">Krok 1 z 2. Konta zakłada polecenie <code>create-user</code> na serwerze.</p>
        <div class="fld"><label for="lEmail">E-mail</label><input id="lEmail" name="email" type="email" autocomplete="username" required></div>
        <div class="fld"><label for="lPass">Hasło</label><input id="lPass" name="password" type="password" autocomplete="current-password" required minlength="12"></div>
        ${err}
        <button class="btn btn--primary btn--block" type="submit">Dalej</button>
        <div class="auth__demo">
          <p><b>Makieta:</b> ${esc(ACCOUNT.email)}, hasło <code>${esc(ACCOUNT.password)}</code>.</p>
          <div class="row-gap">
            <button type="button" class="btn btn--sm" data-act="fill-login">Wpisz dane demo</button>
            <button type="button" class="btn btn--sm" data-act="skip-login">Wejdź bez logowania</button>
          </div>
          <p><b>Pracownik:</b> ${esc(STAFF[1].email)}, hasło <code>${esc(STAFF[1].password)}</code>. Ten sam przebieg z kodem TOTP, mniej uprawnień.</p>
          <div class="row-gap"><button type="button" class="btn btn--sm" data-act="skip-login-employee">Wejdź jako pracownik</button></div>
          <p><b>Klient:</b> e-mail kontaktowy klienta z dostępem do panelu, hasło <code>${CLIENT_PASSWORD}</code>, np. ${esc(portalClients()[0]?.email || '—')}.</p>
          <div class="row-gap"><button type="button" class="btn btn--sm" data-act="skip-login-client">Wejdź jako klient</button></div>
          <p class="muted small">Wejścia bez logowania są tylko w makiecie.</p>
        </div>` : setup ? `
        <h1>Włącz kod z aplikacji</h1>
        <p class="muted">Krok 2 z 2. To konto nie ma jeszcze drugiego składnika, bez niego nie ma dostępu. Zeskanuj kod albo przepisz klucz.</p>
        <div class="setup">${fakeQR(loginUser().secret)}<div><p class="label">Klucz</p><p class="setup__key">${key}</p><p class="muted small">TOTP, 6 cyfr, co 30 s</p></div></div>
        <div class="fld"><label for="lCode">Kod z aplikacji</label><input id="lCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" class="codein" required></div>
        ${err}
        <button class="btn btn--primary btn--block" type="submit">Potwierdź i wejdź</button>
        <button type="button" class="btn btn--link" data-act="login-back">Wróć</button>` : `
        <h1>Kod z aplikacji</h1>
        <p class="muted">Krok 2 z 2. Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.</p>
        <div class="fld"><label for="lCode">Kod</label><input id="lCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" class="codein" required></div>
        ${err}
        <button class="btn btn--primary btn--block" type="submit">Zaloguj</button>
        <button type="button" class="btn btn--link" data-act="login-back">Wróć</button>`}
    </form>
    ${code ? `
    <aside class="panel authapp" aria-label="Aplikacja uwierzytelniająca (symulacja)">
      <p class="label">Aplikacja uwierzytelniająca · symulacja</p>
      <p class="authapp__code" id="authCode"></p>
      <p class="muted small" id="authTtl"></p>
      <button type="button" class="btn btn--sm" data-act="fill-code">Przepisz kod</button>
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
const statusBadge = s => `<span class="badge st-${ST_CODE[s]}"><i class="dot" aria-hidden="true"></i>${s}</span>`;
const prioBadge = p => `<span class="prio prio--${PRIO_CODE[p]}"><i aria-hidden="true"></i>${p}</span>`;
const pkgBadge = p => `<span class="badge badge--outline">${p}</span>`;
const kindBadge = k => `<span class="badge kind--${KIND_CODE[k]}">${k}</span>`;
function slaBadge(t, now = clock.now()) {
  const s = slaState(t, now);
  const soon = s.k === 'left' && t.deadline - now < 0.25 * (t.deadline - t.receivedAt);
  return `<span class="sla sla--${s.k}${soon ? ' sla--soon' : ''}" data-sla="${t.no}">${s.text}</span>`;
}
function meter(used, pool) {
  if (!pool && !used) return '<span class="muted">bez puli</span>';
  const over = used > pool, w = pool ? Math.min(100, used / pool * 100) : 100;
  return `<span class="meter${over ? ' meter--over' : ''}"><span class="meter__bar" aria-hidden="true"><i style="width:${w.toFixed(1)}%"></i></span><span class="meter__txt">${fmtHours(used)} z ${fmtHours(pool)} h${over ? `<small>ponad pulę o ${fmtHours(used - pool)} h</small>` : ''}</span></span>`;
}
const ticketLink = t => `<a href="#/z/${t.no}">${esc(t.title)}</a>`;
const clientLink = c => `<a href="#/klient/${c.id}">${esc(c.name)}</a>`;
const todayISO = () => isoOf(wParts(clock.now()).dn);
const plural3 = (n, a, b, c) => `${n} ${plural(n, a, b, c)}`;
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
const pageHead = (h, sub = '', side = '') => `<div class="pagehead"><div><h1>${h}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>${side ? `<div class="pagehead__side">${side}</div>` : ''}</div>`;
const ymNav = (ym, href) => `<nav class="monthnav" aria-label="Miesiąc"><a class="btn btn--icon" href="${href(ymShift(ym, -1))}" aria-label="Poprzedni miesiąc: ${ymLabel(ymShift(ym, -1))}">‹</a><span>${ymLabel(ym)}</span><a class="btn btn--icon" href="${href(ymShift(ym, 1))}" aria-label="Następny miesiąc: ${ymLabel(ymShift(ym, 1))}">›</a></nav>`;

// ---------- the status diagram ----------
// Nowe → W pracy (W toku ⇄ Czeka na klienta) → Zamknięte (Zrobione, Odrzucone), with reopening and closing straight from Nowe.
// Two layouts of the same diagram, CSS shows one: wide (horizontal) and narrow (vertical). Nodes are HTML, arrows are SVG.
const FLOW = {
  h: {
    w: 760, h: 274,
    nodes: { 'Nowe': [20, 101, 130, 48], 'W toku': [250, 56, 160, 48], 'Czeka na klienta': [250, 152, 160, 48], 'Zrobione': [560, 56, 160, 48], 'Odrzucone': [560, 152, 160, 48] },
    groups: [[230, 20, 200, 210, 'W pracy'], [540, 20, 200, 210, 'Zamknięte']],
    edges: {
      react: ['M150 125H226', 188, 116, 'reakcja'],
      swap: ['M330 108V148'],
      close: ['M430 96H536', 485, 87, 'zamknięcie'],
      reopen: ['M540 160H434', 487, 178, 'wznowienie'],
      direct: ['M85 149V244Q85 254 95 254H630Q640 254 640 244V234', 360, 270, 'od razu, np. pomyłka'],
    },
  },
  v: {
    w: 344, h: 366,
    nodes: { 'Nowe': [110, 10, 120, 44], 'W toku': [20, 116, 124, 48], 'Czeka na klienta': [166, 116, 124, 48], 'Zrobione': [20, 282, 124, 48], 'Odrzucone': [166, 282, 124, 48] },
    groups: [[10, 86, 290, 104, 'W pracy'], [10, 252, 290, 104, 'Zamknięte']],
    edges: {
      react: ['M170 54V82', 180, 73, 'reakcja', 'start'],
      swap: ['M148 140H162'],
      close: ['M110 190V248', 118, 224, 'zamknięcie', 'start'],
      reopen: ['M200 252V194', 208, 224, 'wznowienie', 'start'],
      direct: ['M230 32H318Q328 32 328 42V296Q328 306 318 306H304', 336, 170, 'od razu', 'middle', 90],
    },
  },
};
const GROUP_OF = s => s === 'Nowe' ? 'new' : isClosed(s) ? 'closed' : 'work';
const EDGE_OF = { 'new>work': 'react', 'new>closed': 'direct', 'work>work': 'swap', 'work>closed': 'close', 'closed>work': 'reopen' };
const edgesTaken = t => new Set(t.history.filter(h => h.field === 'status').map(h => EDGE_OF[GROUP_OF(h.from) + '>' + GROUP_OF(h.to)]).filter(Boolean));
let flowId = 0;
function statusFlow(node, done = new Set(), label = 'Diagram statusów') {
  const id = ++flowId;
  return `<div class="flowwrap" role="group" aria-label="${label}">` + ['h', 'v'].map(k => {
    const L = FLOW[k], pct = (v, d) => (v / d * 100).toFixed(3) + '%';
    const nodes = STATUSES.map(s => { const [x, y, w, h] = L.nodes[s]; return node(s, `left:${pct(x, L.w)};top:${pct(y, L.h)};width:${pct(w, L.w)};height:${pct(h, L.h)}`); }).join('');
    const groups = L.groups.map(([x, y, w, h, name]) => `<rect class="flow__grp" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/><text class="flow__glabel" x="${x + 12}" y="${y + 18}">${name}</text>`).join('');
    const edges = Object.entries(L.edges).map(([e, [d, lx, ly, text, anchor = 'middle', rot]]) => {
      const m = done.has(e) ? `ah${id}${k}d` : `ah${id}${k}`;
      return `<path class="flow__edge flow__edge--${e}${done.has(e) ? ' is-done' : ''}" d="${d}" marker-end="url(#${m})"${e === 'swap' ? ` marker-start="url(#${m})"` : ''}/>` +
        (text ? `<text class="flow__elabel${done.has(e) ? ' is-done' : ''}" x="${lx}" y="${ly}" text-anchor="${anchor}"${rot ? ` transform="rotate(${rot} ${lx} ${ly})"` : ''}>${text}</text>` : '');
    }).join('');
    const marker = (mid, cls) => `<marker id="${mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="${cls}" d="M0 0L10 5L0 10z"/></marker>`;
    return `<div class="flow flow--${k}" style="aspect-ratio:${L.w}/${L.h}"><svg viewBox="0 0 ${L.w} ${L.h}" aria-hidden="true"><defs>${marker(`ah${id}${k}`, 'flow__head')}${marker(`ah${id}${k}d`, 'flow__head is-done')}</defs>${groups}${edges}</svg>${nodes}</div>`;
  }).join('') + '</div>';
}
const flowNode = (tag, s, pos, cls, attrs, sub) =>
  `<${tag} class="flow__node st-${ST_CODE[s]}${cls}" style="${pos}"${attrs}><b>${s}</b>${sub != null ? `<small>${sub}</small>` : ''}</${tag}>`;

// ---------- shell ----------
const NAV = [['', 'Pulpit'], ['klienci', 'Klienci'], ['czas', 'Czas pracy'], ['ustawienia', 'Ustawienia']];
function renderShell() {
  const me = actor();
  root.innerHTML = `
<header class="appbar">
  <div class="wrap appbar__in">
    <a class="logo" href="#/" aria-label="ClientTracker, pulpit"><span class="logo__mark" aria-hidden="true"></span>ClientTracker</a>
    <nav class="nav" aria-label="Główna">${NAV.filter(([p]) => p !== 'ustawienia' || can('settings')).map(([p, l]) => `<a href="#/${p}" data-nav="${p}">${l}</a>`).join('')}</nav>
    <div class="appbar__acts">
      <button type="button" class="btn btn--primary" data-act="new-ticket">+ Zgłoszenie</button>
      <button type="button" class="btn" data-act="new-entry">+ Czas</button>
      <span class="appbar__user" title="${esc(me.email)}"><span class="who who--${me.role}" aria-hidden="true">${me.initials}</span>${esc(me.name)} · ${ROLE_LABEL[me.role]}</span>
      <button type="button" class="btn btn--ghost" data-act="logout">Wyloguj</button>
    </div>
  </div>
</header>
<main id="app" class="wrap page" tabindex="-1"></main>
<footer class="foot"><div class="wrap">ClientTracker · makieta v2 według <a href="../specyfikacja.md">specyfikacji</a>. Czas zawsze w strefie Europe/Warsaw, niezależnie od strefy przeglądarki.</div></footer>`;
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
  if (force || !$('.appbar') || $('.appbar--portal')) renderShell();
  const { parts, q } = parseHash();
  const route = parts.join('/');
  let v;
  switch (parts[0]) {
    case undefined: v = viewDashboard(q); break;
    case 'klienci': v = viewClients(q); break;
    case 'klient': v = parts[2] ? (can('month') ? viewMonth(parts[1], parts[2]) : forbidden()) : viewClient(parts[1], q); break;
    case 'z': v = viewTicket(+parts[1]); break;
    case 'czas': v = viewTime(q); break;
    case 'ustawienia': v = can('settings') ? viewSettings(q) : forbidden(); break;
    default: v = notFound();
  }
  const app = $('#app');
  app.innerHTML = v.html;
  document.title = `${v.title} · ClientTracker`;
  const sect = parts[0] === 'klient' ? 'klienci' : parts[0] === 'z' ? '' : parts[0] || '';
  $$('[data-nav]').forEach(a => { if (a.dataset.nav === sect) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (v.after) v.after();
  if (route !== lastRoute) { window.scrollTo(0, 0); if (lastRoute !== null) app.focus({ preventScroll: true }); }
  lastRoute = route;
  $('#datasetSelect').value = DB.dataset || 'small';
  tick();
}
const forbidden = () => ({ title: 'Brak dostępu', html: `<div class="empty"><h1>Brak dostępu (403)</h1><p>Ta strona jest tylko dla właściciela.</p><p><a href="#/">Wróć na pulpit</a></p></div>` });
const whoTag = id => id ? `<span class="who who--${staffById(id).role}" title="Prowadzi: ${esc(staffName(id))}">${staffById(id).initials}</span>` : '';
const notFound = () => ({ title: 'Nie znaleziono', html: `<div class="empty"><h1>Nie ma takiej strony</h1><p><a href="#/">Wróć na pulpit</a></p></div>` });

// ---------- dashboard (P) ----------
function ticketRows(list, now, { client = true } = {}) {
  return list.map(t => {
    const c = clientById(t.clientId);
    return `<tr data-href="#/z/${t.no}">
      <td class="num muted" data-label="Nr">#${t.no}</td>
      ${client ? `<td data-label="Klient">${esc(c.name)}</td>` : ''}
      <td class="tbl__main" data-label="Tytuł">${ticketLink(t)}<small>${t.byClient ? 'panel klienta' : t.source} · przyjęte ${fmtDT(t.receivedAt)}</small></td>
      <td data-label="Priorytet">${prioBadge(t.priority)}</td>
      <td data-label="Status"><span class="stwho">${statusBadge(t.status)}${whoTag(t.assignee)}</span></td>
      <td class="nowrap" data-label="Termin reakcji">${fmtDTdow(t.deadline)}</td>
      <td data-label="Stan SLA">${slaBadge(t, now)}</td>
    </tr>`;
  }).join('');
}
function nextOpening(now, kind, win) {
  for (let dn = wParts(now).dn, i = 0; i < 30; dn++, i++) { const w = windowOn(dn, kind, win); if (w && w[0] > now) return w[0]; }
  return NaN;
}
function windowsLine(now) {
  const win = DB.settings;
  return [['biz', 'Okno dni roboczych'], ['day', 'Okno codzienne']].map(([k, name]) => {
    const on = isWindowOpen(now, k, win), w = windowOn(wParts(now).dn, k, win), nx = nextOpening(now, k, win);
    return `<span class="win${on ? ' win--on' : ''}"><i aria-hidden="true"></i>${name}: ${on ? `otwarte do ${fmtT(w[1])}` : `zamknięte, otwarcie ${DOW_SHORT[wParts(nx).dow]} ${fmtT(nx)}`}</span>`;
  }).join('');
}
function viewDashboard(q) {
  const now = clock.now(), ym = ymNow();
  const cid = clientById(q.klient) ? q.klient : '';
  const st = ['Nowe', 'W toku', 'Czeka na klienta'].includes(q.status) ? q.status : '';
  const kto = ['moje', 'nikt'].includes(q.kto) ? q.kto : '', me = actor();
  const byWho = t => !kto || (kto === 'moje' ? t.assignee === me.id : t.assignee == null);
  const open = openTickets(cid).filter(byWho);
  const list = open.filter(t => !st || t.status === st);
  const waiting = list.filter(t => t.reactedAt == null), rest = list.filter(t => t.reactedAt != null);
  const overdue = open.filter(t => t.reactedAt == null && now > t.deadline);
  const mine = DB.tickets.filter(t => !cid || t.clientId === cid);
  const link = patch => `#/?${new URLSearchParams(Object.entries({ klient: cid, status: st, kto, ...patch }).filter(([, v]) => v))}`;
  const href = s => link({ status: s && s !== st ? s : '' });
  const all = openTickets(cid);
  const ktoTab = (k, label, n) => `<a href="${link({ kto: k })}"${k === kto ? ' aria-current="true"' : ''}>${label} <span>${n}</span></a>`;
  const node = (s, pos) => {
    if (isClosed(s)) return flowNode('span', s, pos, ' is-static', '', `${mine.filter(t => t.status === s && t.closedAt != null && ymOf(t.closedAt) === ym).length} w tym mies.`);
    const n = open.filter(t => t.status === s).length;
    return flowNode('a', s, pos, s === st ? ' is-current' : '', ` href="${href(s)}"${s === st ? ' aria-current="true"' : ''}`, plural3(n, 'otwarte', 'otwarte', 'otwartych'));
  };
  const head = `<tr><th scope="col">Nr</th><th scope="col">Klient</th><th scope="col">Tytuł</th><th scope="col">Priorytet</th><th scope="col">Status</th><th scope="col">Termin reakcji</th><th scope="col">Stan SLA</th></tr>`;
  const group = (label, note, rows) => rows.length ? `<tr class="tbl__group"><th colspan="7" scope="rowgroup">${label} <span>${rows.length} · ${note}</span></th></tr>${ticketRows(rows, now)}` : '';
  return {
    title: 'Pulpit',
    html: `
${pageHead('Pulpit', 'Otwarte zgłoszenia: Nowe, W toku, Czeka na klienta.', `
  <div class="fld fld--inline"><label for="dashClient">Klient</label><select id="dashClient" data-filter="dash" data-status="${st}" data-kto="${kto}">${clientOptions(cid, { all: `Wszyscy klienci (${DB.clients.length})` })}</select></div>`)}
<p class="nowline"><span>Teraz ${fmtDTdow(now)}</span>${windowsLine(now)}</p>
${overdue.length ? `<p class="alert alert--danger"><b>${plural3(overdue.length, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń')} po terminie reakcji.</b> ${overdue.slice(0, 3).map(t => `<a href="#/z/${t.no}">#${t.no} ${esc(clientById(t.clientId).name)}</a>`).join(', ')}${overdue.length > 3 ? '…' : ''}</p>` : ''}
<section class="panel" aria-labelledby="flowH">
  <div class="panel__head"><h2 id="flowH">Statusy</h2><p class="muted small">Kliknij status otwarty, żeby zawęzić listę.${st ? ` <a href="${href('')}">Pokaż wszystkie otwarte</a>` : ''}</p></div>
  ${statusFlow(node, new Set(), 'Liczba zgłoszeń według statusu')}
</section>
<section class="panel panel--flush" aria-labelledby="listH">
  <div class="panel__head"><h2 id="listH">${st ? `Status: ${st}` : 'Otwarte zgłoszenia'} <span class="count">${list.length}</span></h2><nav class="tabsline" aria-label="Kto prowadzi">${ktoTab('', 'Wszystkie', all.length)}${ktoTab('moje', 'Moje', all.filter(t => t.assignee === me.id).length)}${ktoTab('nikt', 'Nieprzypisane', all.filter(t => t.assignee == null).length)}</nav></div>
  <p class="muted small listnote">Najpierw bez reakcji według terminu, potem pozostałe od najstarszego. Inicjały przy statusie: kto prowadzi.</p>
  ${list.length ? `<table class="tbl tbl--click">
    <caption class="sr-only">Otwarte zgłoszenia${st ? `, status ${st}` : ''}</caption>
    <thead>${head}</thead>
    <tbody>${group('Czeka na reakcję', 'według terminu', waiting)}${group('Po reakcji', 'od najstarszego przyjęcia', rest)}</tbody>
  </table>` : `<div class="empty"><p>Brak otwartych zgłoszeń${cid ? ' tego klienta' : ''}${st ? ` ze statusem „${st}”` : ''}.</p></div>`}
</section>`,
  };
}

// ---------- clients (K) ----------
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
  const th = (key, label, cls = '') => `<th scope="col" class="${cls}"${sort === key ? ' aria-sort="' + (key === 'name' ? 'ascending' : 'descending') + '"' : ''}><a href="#/klienci?sort=${key}">${label}${sort === key ? ' <span aria-hidden="true">↓</span>' : ''}</a></th>`;
  const active = DB.clients.filter(c => c.active).length;
  return {
    title: 'Klienci',
    html: `
${pageHead('Klienci', `${plural3(active, 'aktywny', 'aktywnych', 'aktywnych')}${DB.clients.length > active ? `, ${DB.clients.length - active} nieaktywnych` : ''}. Pula liczona za ${ymLabel(ym)}.`, `
  ${can('clients.edit') ? '<button type="button" class="btn btn--primary" data-act="new-client">+ Dodaj klienta</button>' : '<span class="muted small">Klientów dodaje i edytuje właściciel.</span>'}`)}
<section class="panel panel--flush" aria-label="Lista klientów">
  <div class="toolbar">
    <div class="fld fld--inline fld--grow"><label for="clientSearch" class="sr-only">Szukaj klienta</label><input type="search" id="clientSearch" placeholder="Szukaj po nazwie albo e-mailu" autocomplete="off"></div>
    <div class="fld fld--inline"><label for="clientPkg" class="sr-only">Pakiet</label><select id="clientPkg"><option value="">Wszystkie pakiety</option>${PACKAGES.map(p => `<option>${p}</option>`).join('')}</select></div>
    <label class="check"><input type="checkbox" id="clientInactive"> pokaż nieaktywnych</label>
    <span class="muted small toolbar__count" id="clientCount" aria-live="polite"></span>
  </div>
  <table class="tbl tbl--click" id="clientTable">
    <caption class="sr-only">Klienci</caption>
    <thead><tr>${th('name', 'Nazwa')}<th scope="col">Pakiet</th>${th('pool', `Pula · ${MONTHS[+ym.slice(5) - 1]}`)}${th('open', 'Otwarte', 'num')}${can('money') ? th('price', 'Abonament', 'num') : ''}</tr></thead>
    <tbody>${rows.map(({ c, used, open, late }) => `
      <tr data-href="#/klient/${c.id}" data-search="${esc(norm(c.name + ' ' + c.email))}" data-pkg="${c.pkg}" data-active="${c.active}"${c.active ? '' : ' class="is-off"'}>
        <td class="tbl__main" data-label="Nazwa">${clientLink(c)}${c.active ? '' : ' <span class="badge badge--muted">nieaktywny</span>'}${c.portal && c.active ? ' <span class="badge badge--outline" title="Ma dostęp do panelu klienta">panel</span>' : ''}<small>${esc(c.email) || '—'}</small></td>
        <td data-label="Pakiet">${pkgBadge(c.pkg)}</td>
        <td data-label="Pula">${meter(used, c.pool)}</td>
        <td class="num" data-label="Otwarte">${open}${late ? ` <span class="badge badge--danger">${late} po terminie</span>` : ''}</td>
        ${can('money') ? `<td class="num nowrap" data-label="Abonament">${fmtMoney(c.price)}</td>` : ''}
      </tr>`).join('')}</tbody>
  </table>
  <div class="empty" id="clientEmpty" hidden><p>Brak klientów pasujących do filtra.</p></div>
</section>`,
    after() {
      $('#clientSearch').value = clientUI.q; $('#clientPkg').value = clientUI.pkg; $('#clientInactive').checked = clientUI.inactive;
      filterClients();
    },
  };
}
function filterClients() {
  const q = norm(clientUI.q.trim());
  let shown = 0;
  const rows = $$('#clientTable tbody tr');
  rows.forEach(r => {
    const ok = (!q || r.dataset.search.includes(q)) && (!clientUI.pkg || r.dataset.pkg === clientUI.pkg) && (clientUI.inactive || r.dataset.active === 'true');
    r.hidden = !ok; shown += ok;
  });
  $('#clientCount').textContent = `Pokazano ${shown} z ${rows.length}`;
  $('#clientEmpty').hidden = shown > 0;
}

function viewClient(id, q) {
  const c = clientById(id);
  if (!c) return notFound();
  const ym = ymNow(), now = clock.now();
  const st = STATUSES.includes(q.status) ? q.status : '';
  const mine = DB.tickets.filter(t => t.clientId === id);
  const list = mine.filter(t => !st || t.status === st).sort((a, b) => b.receivedAt - a.receivedAt || b.no - a.no);
  const href = s => `#/klient/${id}${s && s !== st ? '?status=' + encodeURIComponent(s) : ''}`;
  const node = (s, pos) => {
    const n = mine.filter(t => t.status === s).length;
    return flowNode('a', s, pos, s === st ? ' is-current' : '', ` href="${href(s)}"${s === st ? ' aria-current="true"' : ''}`, String(n));
  };
  return {
    title: c.name,
    html: `
<nav class="crumbs" aria-label="Ścieżka"><a href="#/klienci">Klienci</a><span aria-hidden="true">›</span><span>${esc(c.name)}</span></nav>
${pageHead(`${esc(c.name)} ${pkgBadge(c.pkg)}${c.active ? '' : ' <span class="badge badge--muted">nieaktywny</span>'}`, '', `
  ${can('month') ? `<a class="btn" href="#/klient/${c.id}/${ym}">Miesiąc i raport</a>` : ''}
  <button type="button" class="btn" data-act="new-entry" data-client="${c.id}">+ Czas</button>
  ${can('clients.edit') ? `<button type="button" class="btn" data-act="edit-client" data-id="${c.id}">Edytuj</button>` : ''}
  <button type="button" class="btn btn--primary" data-act="new-ticket" data-client="${c.id}"${c.active ? '' : ' disabled title="Nieaktywnemu klientowi nie można dodać zgłoszenia"'}>+ Zgłoszenie</button>`)}
${c.active ? '' : '<p class="alert">Klient jest nieaktywny: nie przyjmuje nowych zgłoszeń. Włączysz go w edycji.</p>'}
<div class="cols">
  <section class="panel cols__side" aria-labelledby="cData">
    <div class="panel__head"><h2 id="cData">Dane</h2></div>
    <dl class="kv">
      <div><dt>E-mail kontaktowy</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</dd></div>
      <div><dt>Pakiet</dt><dd>${c.pkg}</dd></div>
      ${can('money') ? `<div><dt>Abonament</dt><dd>${fmtMoney(c.price)} / mies.</dd></div>` : ''}
      <div><dt>Pula godzin</dt><dd>${fmtHours(c.pool)} h / mies.</dd></div>
      <div><dt>Pula · ${ymLabel(ym)}</dt><dd>${meter(poolUsed(c.id, ym), c.pool)}</dd></div>
      <div><dt>Otwarte zgłoszenia</dt><dd>${mine.filter(t => isOpenStatus(t.status)).length}</dd></div>
    </dl>
    <div class="portalbox">
      <div class="panel__head"><h2>Panel klienta</h2><span class="badge ${c.portal ? 'st-done' : 'badge--muted'}">${c.portal ? 'dostęp włączony' : 'bez dostępu'}</span></div>
      <p class="muted small">${c.portal ? `Klient loguje się e-mailem ${esc(c.email)}. Widzi swoje zgłoszenia, godziny i raporty, może dodać zgłoszenie. Kwot nie widzi.` : 'Klient nie ma konta. Po włączeniu loguje się e-mailem kontaktowym.'}${c.active ? '' : ' Nieaktywny klient nie może się zalogować.'}</p>
      ${can('clients.portal') ? '' : '<p class="muted small">Dostępem do panelu zarządza właściciel.</p>'}
      <div class="row-gap"${can('clients.portal') ? '' : ' hidden'}><button type="button" class="btn btn--sm" data-act="portal-toggle" data-id="${c.id}">${c.portal ? 'Wyłącz dostęp' : 'Włącz dostęp'}</button>${c.portal ? `<button type="button" class="btn btn--sm" data-act="portal-preview" data-id="${c.id}">Podgląd jako klient</button>` : ''}</div>
    </div>
  </section>
  <section class="panel panel--flush cols__main" aria-labelledby="cTickets">
    <div class="panel__head"><h2 id="cTickets">Zgłoszenia <span class="count">${mine.length}</span></h2><p class="muted small">Kliknij status, żeby zawęzić listę.${st ? ` <a href="${href('')}">Pokaż wszystkie</a>` : ''}</p></div>
    <div class="panel__body">${statusFlow(node, new Set(), 'Zgłoszenia klienta według statusu')}</div>
    ${list.length ? `<table class="tbl tbl--click">
      <caption class="sr-only">Zgłoszenia klienta ${esc(c.name)}${st ? `, status ${st}` : ''}, od najnowszego</caption>
      <thead><tr><th scope="col">Nr</th><th scope="col">Tytuł</th><th scope="col">Priorytet</th><th scope="col">Status</th><th scope="col">Termin reakcji</th><th scope="col">Stan SLA</th></tr></thead>
      <tbody>${ticketRows(list, now, { client: false })}</tbody></table>`
      : `<div class="empty"><p>Brak zgłoszeń${st ? ` ze statusem „${st}”` : ''}.</p></div>`}
  </section>
</div>`,
  };
}

// ---------- ticket (Z) ----------
function traceView(t, now) {
  const tr = deadlineTrace(t.receivedAt, t.pkg, t.priority, t.win);
  if (tr.days.length > 16) return `<p class="muted small">Termin wypada ${tr.days.length} dni po przyjęciu, rozpiska pokazuje najwyżej 16 dni.</p>`;
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
    return `<li class="tr${d.w ? '' : ' tr--off'}">
      <span class="tr__day">${DOW_SHORT[d.dow]} ${fmtDn(d.dn).slice(0, 5)}</span>
      <span class="tr__bar" aria-hidden="true">${d.w ? span(d.dn, d.w[0], d.w[1], 'tr__win') : ''}${d.counted ? span(d.dn, d.counted[0], d.counted[1], 'tr__cnt') : ''}${here.map(([ms, cls]) => `<span class="tr__mk tr__mk--${cls}" style="left:${pct(d.dn, ms)}%"></span>`).join('')}</span>
      <span class="tr__note">${d.w ? '' : '<span class="sr-only">okno zamknięte</span>'}${notes.join(' · ')}</span>
    </li>`;
  }).join('');
  const w = t.win[tr.kind];
  return `<p class="small muted">Okno ${tr.kind === 'biz' ? 'dni roboczych' : 'codzienne'} ${fmtMin(w.from)}–${fmtMin(w.to)}, zapamiętane przy przyjęciu. Kolorem zaznaczony czas liczony do terminu.</p>
    <ol class="trace">${rows}</ol>`;
}
const entryActs = e => !mayEditEntry(e) ? `<span class="muted small">wpis: ${esc(staffName(entryBy(e)))}</span>` : `<button type="button" class="btn btn--sm btn--ghost" data-act="edit-entry" data-id="${e.id}" aria-label="Popraw wpis z ${fmtDn(dnFromISO(e.date))}, ${fmtHours(e.hours)} h">Popraw</button><button type="button" class="btn btn--sm btn--ghost btn--danger" data-act="del-entry" data-id="${e.id}" aria-label="Usuń wpis z ${fmtDn(dnFromISO(e.date))}, ${fmtHours(e.hours)} h">Usuń</button>`;
function viewTicket(no) {
  const t = ticketByNo(no);
  if (!t) return notFound();
  const c = clientById(t.clientId), now = clock.now();
  const entries = entriesOfTicket(t.no);
  const visited = new Set(['Nowe', ...t.history.filter(h => h.field === 'status').map(h => h.to)]);
  const work = mayWork(t), me = actor();
  const node = (s, pos) => {
    const cur = s === t.status;
    if (cur) return flowNode('span', s, pos, ' is-current', ' aria-current="step"', 'aktualny');
    if (s === 'Nowe') return flowNode('span', s, pos, ' is-locked', ' title="Do statusu Nowe nie da się wrócić"', 'bez powrotu');
    if (!work) return flowNode('span', s, pos, visited.has(s) ? ' is-visited is-static' : ' is-static', '', visited.has(s) ? 'wcześniej' : null);
    return flowNode('button', s, pos, visited.has(s) ? ' is-visited' : '', ` type="button" data-act="status" data-no="${t.no}" data-to="${s}" aria-label="Ustaw status: ${s}"`, visited.has(s) ? 'wcześniej' : null);
  };
  const lastSt = t.history.filter(h => h.field === 'status').pop();
  const late = t.reactedAt != null && t.reactedAt > t.deadline;
  const hist = t.history.slice().reverse();
  return {
    title: `#${t.no} ${t.title}`,
    html: `
<nav class="crumbs" aria-label="Ścieżka"><a href="#/">Pulpit</a><span aria-hidden="true">›</span>${clientLink(c)}<span aria-hidden="true">›</span><span>#${t.no}</span></nav>
<div class="pagehead">
  <div>
    <h1><span class="muted">#${t.no}</span> ${esc(t.title)}</h1>
    <p class="meta">${statusBadge(t.status)} ${prioBadge(t.priority)} <span>${clientLink(c)}</span> <span class="muted">źródło: ${t.source}</span>${t.byClient ? ' <span class="badge badge--outline">z panelu klienta</span>' : ''}</p>
  </div>
  <div class="pagehead__side">${can('tickets.edit') ? `<button type="button" class="btn" data-act="edit-ticket" data-no="${t.no}">Edytuj</button>` : ''}</div>
</div>
<div class="cols cols--ticket">
  <div class="cols__main stack">
    <section class="panel" aria-labelledby="stH">
      <div class="panel__head"><h2 id="stH">Status</h2><p class="muted small">${lastSt ? `Ostatnia zmiana ${fmtDT(lastSt.at)}: ${esc(lastSt.from)} → ${esc(lastSt.to)}.` : 'Bez zmian od przyjęcia.'}</p></div>
      ${statusFlow(node, edgesTaken(t), `Status zgłoszenia #${t.no}`)}
      <p class="muted small flownote">${!work ? `Zgłoszenie prowadzi <b>${esc(staffName(t.assignee))}</b>. Pracownik zmienia status tylko swoich i nieprzypisanych zgłoszeń.` : t.status === 'Nowe'
        ? `Kliknij status, żeby go ustawić.${t.assignee == null ? ' Zgłoszenie przypisze się do Ciebie.' : ''} Pierwsza zmiana z Nowe zapisze godzinę reakcji: <b>${fmtDT(Math.max(now, t.receivedAt))}</b>.`
        : 'Kliknij status, żeby go zmienić. Zrobione i Odrzucone zapisują godzinę zamknięcia, wznowienie ją kasuje. Do Nowe nie ma powrotu, pomyłkę zamyka się jako Odrzucone.'}</p>
    </section>
    <section class="panel" aria-labelledby="dH">
      <div class="panel__head"><h2 id="dH">Opis</h2></div>
      ${t.desc ? `<p class="prewrap">${esc(t.desc)}</p>` : '<p class="muted">Bez opisu.</p>'}
    </section>
    <section class="panel panel--flush" aria-labelledby="eH">
      <div class="panel__head"><h2 id="eH">Wpisy czasu <span class="count">${fmtHours(sumHours(entries))} h</span></h2><button type="button" class="btn btn--sm" data-act="new-entry" data-client="${c.id}" data-ticket="${t.no}">+ Czas</button></div>
      ${entries.length ? `<table class="tbl">
        <caption class="sr-only">Wpisy czasu przy zgłoszeniu #${t.no}</caption>
        <thead><tr><th scope="col">Data</th><th scope="col">Kto</th><th scope="col">Rodzaj</th><th scope="col" class="num">Godziny</th><th scope="col">Opis</th><th scope="col"><span class="sr-only">Akcje</span></th></tr></thead>
        <tbody>${entries.map(e => `<tr><td class="nowrap" data-label="Data">${fmtDn(dnFromISO(e.date))}</td><td data-label="Kto">${whoTag(entryBy(e))}</td><td data-label="Rodzaj">${kindBadge(e.kind)}</td><td class="num" data-label="Godziny">${fmtHours(e.hours)}</td><td data-label="Opis">${esc(e.desc) || '—'}</td><td class="tbl__acts">${entryActs(e)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row" colspan="3">Razem</th><td class="num">${fmtHours(sumHours(entries))}</td><td colspan="2"></td></tr></tfoot>
      </table>` : '<div class="empty"><p>Brak wpisów czasu.</p></div>'}
    </section>
    <section class="panel" aria-labelledby="hH">
      <div class="panel__head"><h2 id="hH">Historia</h2></div>
      ${hist.length ? `<ol class="hist">${hist.map(h => `<li><time>${fmtDT(h.at)}</time> ${h.field}: ${esc(h.from)} → ${esc(h.to)}</li>`).join('')}</ol>` : '<p class="muted">Bez zmian od przyjęcia.</p>'}
    </section>
  </div>
  <aside class="cols__side stack">
    <section class="panel" aria-labelledby="slaH">
      <div class="panel__head"><h2 id="slaH">Termin reakcji</h2>${slaBadge(t, now)}</div>
      <p class="deadline">${fmtDTdow(t.deadline)}</p>
      <p class="muted small">${ruleLabel(RULES[t.pkg][t.priority])} · pakiet ${t.pkg} · priorytet ${t.priority.toLowerCase()}</p>
      <dl class="kv kv--tight">
        <div><dt>Przyjęte</dt><dd>${fmtDTdow(t.receivedAt)}</dd></div>
        <div><dt>Reakcja</dt><dd>${t.reactedAt != null ? `<span class="${late ? 'text-danger' : ''}">${fmtDTdow(t.reactedAt)}</span><small>po ${fmtDur(t.reactedAt - t.receivedAt)}</small>` : '<span class="muted">jeszcze nie</span>'}</dd></div>
        <div><dt>Zamknięte</dt><dd>${t.closedAt != null ? fmtDTdow(t.closedAt) : '<span class="muted">otwarte</span>'}</dd></div>
      </dl>
      ${t.reactedAt != null && can('tickets.reaction') ? `<details class="disclosure"><summary>Popraw godzinę reakcji</summary>
        <form data-form="reaction" data-no="${t.no}" novalidate>
          <div class="fld"><label for="rxIn">Reakcja o</label><input type="datetime-local" id="rxIn" name="reactedAt" value="${toLocalInput(t.reactedAt)}" aria-describedby="e-reactedAt rxHint"><p class="fld__hint" id="rxHint">Np. gdy odpowiedź mailem poszła wcześniej. Nie wcześniej niż przyjęcie, nie w przyszłości.</p><p class="fld__err" id="e-reactedAt" data-err="reactedAt"></p></div>
          <button type="submit" class="btn btn--sm btn--primary">Zapisz</button>
        </form></details>` : ''}
      <details class="disclosure"><summary>Jak liczony jest termin</summary>${traceView(t, now)}</details>
    </section>
    <section class="panel" aria-labelledby="iH">
      <div class="panel__head"><h2 id="iH">Szczegóły</h2></div>
      <dl class="kv kv--tight">
        <div><dt>Prowadzi</dt><dd>${assignControl(t, me)}</dd></div>
        <div><dt>Klient</dt><dd>${clientLink(c)}</dd></div>
        <div><dt>Pakiet przy przyjęciu</dt><dd>${t.pkg}</dd></div>
        <div><dt>Źródło</dt><dd>${t.source}</dd></div>
        <div><dt>Czas łącznie</dt><dd>${fmtHours(sumHours(entries))} h</dd></div>
      </dl>
    </section>
  </aside>
</div>`,
  };
}

function assignControl(t, me) {
  if (can('tickets.assign.any')) return `<label class="sr-only" for="assignSel">Prowadzi</label><select id="assignSel" class="sel--sm" data-assign="${t.no}"><option value="">nikt</option>${STAFF.map(u => `<option value="${u.id}"${u.id === t.assignee ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select>`;
  if (t.assignee == null) return `<span class="muted">nikt</span> <button type="button" class="btn btn--sm" data-act="assign" data-no="${t.no}" data-to="${me.id}">Biorę</button>`;
  if (t.assignee === me.id) return `${whoTag(me.id)} ${esc(me.name)} <button type="button" class="btn btn--sm btn--ghost" data-act="assign" data-no="${t.no}" data-to="">Oddaj</button>`;
  return `${whoTag(t.assignee)} ${esc(staffName(t.assignee))}`;
}

// ---------- time entries (C) ----------
function viewTime(q) {
  const ym = /^\d{4}-\d{2}$/.test(q.miesiac || '') ? q.miesiac : ymNow();
  const cid = clientById(q.klient) ? q.klient : '';
  const list = DB.entries.filter(e => e.date.startsWith(ym) && (!cid || e.clientId === cid))
    .sort((a, b) => b.date.localeCompare(a.date) || +b.id.slice(1) - +a.id.slice(1));
  const href = m => `#/czas?miesiac=${m}${cid ? '&klient=' + cid : ''}`;
  const tot = k => fmtHours(sumHours(list.filter(e => e.kind === k)));
  return {
    title: 'Czas pracy',
    html: `
${pageHead('Czas pracy', 'Wpis należy do miesiąca według swojej daty.', `
  ${ymNav(ym, href)}
  <div class="fld fld--inline"><label for="timeClient" class="sr-only">Klient</label><select id="timeClient" data-filter="time" data-ym="${ym}">${clientOptions(cid, { all: 'Wszyscy klienci' })}</select></div>
  <button type="button" class="btn btn--primary" data-act="new-entry" data-client="${cid}">+ Dodaj czas</button>`)}
<div class="stats">
  <div class="stat"><p class="stat__label">Pula</p><p class="stat__value">${tot('Pula')} h</p><p class="muted small">odejmowana od pakietu</p></div>
  <div class="stat"><p class="stat__label">Utrzymanie</p><p class="stat__value">${tot('Utrzymanie')} h</p><p class="muted small">w cenie abonamentu</p></div>
  <div class="stat"><p class="stat__label">Dodatkowe</p><p class="stat__value">${tot('Dodatkowe')} h</p><p class="muted small">${can('money') ? fmtMoney(sumHours(list.filter(e => e.kind === 'Dodatkowe')) * DB.settings.rate) : 'poza pakietem'}</p></div>
  <div class="stat"><p class="stat__label">Razem</p><p class="stat__value">${fmtHours(sumHours(list))} h</p><p class="muted small">${plural3(list.length, 'wpis', 'wpisy', 'wpisów')}</p></div>
</div>
<section class="panel panel--flush" aria-label="Wpisy czasu">
  ${list.length ? `<table class="tbl">
    <caption class="sr-only">Wpisy czasu, ${ymLabel(ym)}</caption>
    <thead><tr><th scope="col">Data</th><th scope="col">Kto</th><th scope="col">Klient</th><th scope="col">Zgłoszenie</th><th scope="col">Rodzaj</th><th scope="col" class="num">Godziny</th><th scope="col">Opis</th><th scope="col"><span class="sr-only">Akcje</span></th></tr></thead>
    <tbody>${list.map(e => {
      const c = clientById(e.clientId), t = e.ticketNo ? ticketByNo(e.ticketNo) : null;
      return `<tr>
        <td class="nowrap" data-label="Data">${DOW_SHORT[dowOf(dnFromISO(e.date))]} ${fmtDn(dnFromISO(e.date))}</td>
        <td data-label="Kto">${whoTag(entryBy(e))}</td>
        <td data-label="Klient">${clientLink(c)}</td>
        <td data-label="Zgłoszenie">${t ? `<a href="#/z/${t.no}">#${t.no} ${esc(t.title)}</a>` : '<span class="muted">bez zgłoszenia</span>'}</td>
        <td data-label="Rodzaj">${kindBadge(e.kind)}</td>
        <td class="num" data-label="Godziny">${fmtHours(e.hours)}</td>
        <td data-label="Opis">${esc(e.desc) || '—'}</td>
        <td class="tbl__acts">${entryActs(e)}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>` : `<div class="empty"><p>Brak wpisów w miesiącu ${ymLabel(ym)}${cid ? ' dla tego klienta' : ''}.</p></div>`}
</section>`,
  };
}

// ---------- month and report (M) ----------
function viewMonth(id, ym) {
  const c = clientById(id);
  if (!c || !/^\d{4}-\d{2}$/.test(ym)) return notFound();
  const s = monthSummary(id, ym), now = clock.now();
  const received = DB.tickets.filter(t => t.clientId === id && ymOf(t.receivedAt) === ym).sort((a, b) => a.receivedAt - b.receivedAt);
  const entries = s.entries.slice().sort((a, b) => a.date.localeCompare(b.date) || +a.id.slice(1) - +b.id.slice(1));
  return {
    title: `${c.name}: ${ymLabel(ym)}`,
    html: `
<nav class="crumbs" aria-label="Ścieżka"><a href="#/klienci">Klienci</a><span aria-hidden="true">›</span>${clientLink(c)}<span aria-hidden="true">›</span><span>${ymLabel(ym)}</span></nav>
${pageHead(`${esc(c.name)}: ${ymLabel(ym)}`, `Pakiet ${c.pkg}. Cena i stawka według bieżących danych klienta i Ustawień, także dla minionych miesięcy.`, `
  ${ymNav(ym, m => `#/klient/${id}/${m}`)}
  <button type="button" class="btn btn--primary" data-act="report" data-client="${id}" data-ym="${ym}">Raport dla klienta</button>`)}
<div class="stats">
  <div class="stat"><p class="stat__label">Pula</p><p class="stat__value">${fmtHours(s.pool)} z ${fmtHours(s.poolMax)} h</p>${s.over ? `<p class="small text-danger">ponad pulę o ${fmtHours(s.over)} h</p>` : s.poolMax ? `<span class="meter__bar" aria-hidden="true"><i style="width:${(s.pool / s.poolMax * 100).toFixed(1)}%"></i></span>` : '<p class="muted small">pakiet bez puli</p>'}</div>
  <div class="stat"><p class="stat__label">Utrzymanie</p><p class="stat__value">${fmtHours(s.maint)} h</p><p class="muted small">w cenie abonamentu</p></div>
  <div class="stat"><p class="stat__label">Dodatkowe</p><p class="stat__value">${fmtHours(s.extra)} h</p><p class="muted small">${fmtMoney(s.extraAmount)} · ${fmtMoney(DB.settings.rate)}/h</p></div>
  <div class="stat"><p class="stat__label">Razem godzin</p><p class="stat__value">${fmtHours(s.total)} h</p></div>
  <div class="stat"><p class="stat__label">Efektywna stawka</p><p class="stat__value">${s.effective == null ? '—' : fmtMoney(s.effective) + '/h'}</p><p class="muted small">(${fmtMoney(c.price)} + ${fmtMoney(s.extraAmount)}) / ${fmtHours(s.total)} h</p></div>
</div>
<section class="panel panel--flush" aria-labelledby="mtH">
  <div class="panel__head"><h2 id="mtH">Zgłoszenia przyjęte w miesiącu <span class="count">${s.tickets}</span></h2>
    <p class="small">w terminie <b>${s.inTerm}</b> · spóźnione <b class="${s.late ? 'text-danger' : ''}">${s.late}</b> · bez reakcji <b class="${s.noReaction ? 'text-danger' : ''}">${s.noReaction}</b></p></div>
  ${received.length ? `<table class="tbl tbl--click">
    <caption class="sr-only">Zgłoszenia przyjęte w miesiącu ${ymLabel(ym)}</caption>
    <thead><tr><th scope="col">Nr</th><th scope="col">Tytuł</th><th scope="col">Priorytet</th><th scope="col">Status</th><th scope="col">Termin reakcji</th><th scope="col">Stan SLA</th></tr></thead>
    <tbody>${ticketRows(received, now, { client: false })}</tbody></table>` : '<div class="empty"><p>Brak zgłoszeń w tym miesiącu.</p></div>'}
</section>
<section class="panel panel--flush" aria-labelledby="meH">
  <div class="panel__head"><h2 id="meH">Wpisy czasu <span class="count">${fmtHours(s.total)} h</span></h2><button type="button" class="btn btn--sm" data-act="new-entry" data-client="${id}">+ Czas</button></div>
  ${entries.length ? `<table class="tbl">
    <caption class="sr-only">Wpisy czasu, ${ymLabel(ym)}</caption>
    <thead><tr><th scope="col">Data</th><th scope="col">Zgłoszenie</th><th scope="col">Rodzaj</th><th scope="col" class="num">Godziny</th><th scope="col">Opis</th><th scope="col"><span class="sr-only">Akcje</span></th></tr></thead>
    <tbody>${entries.map(e => { const t = e.ticketNo ? ticketByNo(e.ticketNo) : null; return `<tr>
      <td class="nowrap" data-label="Data">${fmtDn(dnFromISO(e.date))}</td>
      <td data-label="Zgłoszenie">${t ? `<a href="#/z/${t.no}">#${t.no} ${esc(t.title)}</a>` : '<span class="muted">bez zgłoszenia</span>'}</td>
      <td data-label="Rodzaj">${kindBadge(e.kind)}</td><td class="num" data-label="Godziny">${fmtHours(e.hours)}</td><td data-label="Opis">${esc(e.desc) || '—'}</td><td class="tbl__acts">${entryActs(e)}</td></tr>`; }).join('')}</tbody>
  </table>` : '<div class="empty"><p>Brak wpisów w tym miesiącu.</p></div>'}
</section>`,
  };
}

// ---------- settings (U) ----------
function viewSettings(q) {
  const st = DB.settings;
  const year = /^\d{4}$/.test(q.rok || '') ? +q.rok : wParts(clock.now()).y;
  const e = easter(year);
  const tests = SLA_EXAMPLES.map(([pkg, pr, rec, exp, what]) => {
    const got = reactionDeadline(fromLocalInput(rec), pkg, pr, DEFAULT_WINDOWS), ok = toLocalInput(got) === exp;
    return `<tr><td>${pkg}</td><td>${pr}</td><td class="nowrap">${fmtDTdow(fromLocalInput(rec))}</td><td class="nowrap">${fmtDTdow(got)}</td><td>${what}</td><td>${ok ? '<span class="badge st-done">zgodny</span>' : `<span class="badge badge--danger">inny niż ${exp}</span>`}</td></tr>`;
  }).join('');
  const time = (k, end) => `<input type="time" id="s-${k}-${end}" name="${k}-${end}" value="${pad(Math.floor(st[k][end] / 60))}:${pad(st[k][end] % 60)}" step="900" aria-describedby="e-${k}">`;
  return {
    title: 'Ustawienia',
    html: `
${pageHead('Ustawienia', 'Nowe godziny okien obowiązują tylko zgłoszenia przyjęte po zapisie.')}
<div class="cols cols--even">
  <form class="panel" data-form="settings" novalidate aria-labelledby="wH">
    <div class="panel__head"><h2 id="wH">Okna obsługi i stawka</h2></div>
    <fieldset class="fset"><legend>Okno dni roboczych <span class="muted">pn–pt bez świąt</span></legend>
      <div class="grid2"><div class="fld"><label for="s-biz-from">Od</label>${time('biz', 'from')}</div><div class="fld"><label for="s-biz-to">Do</label>${time('biz', 'to')}</div></div>
      <p class="fld__err" id="e-biz" data-err="biz"></p>
    </fieldset>
    <fieldset class="fset"><legend>Okno codzienne <span class="muted">każdy dzień, także święta</span></legend>
      <div class="grid2"><div class="fld"><label for="s-day-from">Od</label>${time('day', 'from')}</div><div class="fld"><label for="s-day-to">Do</label>${time('day', 'to')}</div></div>
      <p class="fld__err" id="e-day" data-err="day"></p>
    </fieldset>
    <div class="fld"><label for="s-rate">Stawka za prace dodatkowe (zł/h)</label><input type="text" inputmode="decimal" id="s-rate" name="rate" value="${String(st.rate).replace('.', ',')}" aria-describedby="e-rate"><p class="fld__err" id="e-rate" data-err="rate"></p></div>
    <p class="muted small">Okno obejmuje godzinę otwarcia, ale nie zamknięcia: zgłoszenie z 17:00 przychodzi już po zamknięciu.</p>
    <button type="submit" class="btn btn--primary">Zapisz ustawienia</button>
  </form>
  <section class="panel" aria-labelledby="holH">
    <div class="panel__head"><h2 id="holH">Święta ${year}</h2>
      <nav class="monthnav" aria-label="Rok"><a class="btn btn--icon" href="#/ustawienia?rok=${year - 1}" aria-label="Rok ${year - 1}">‹</a><span>${year}</span><a class="btn btn--icon" href="#/ustawienia?rok=${year + 1}" aria-label="Rok ${year + 1}">›</a></nav></div>
    <p class="muted small">Liczone z reguł: Wielkanoc ${fmtDn(e)}, Boże Ciało ${fmtDn(e + 60)}.${year >= 2025 ? ' Wigilia wolna od 2025.' : ''}</p>
    <ul class="hols">${[...holidays(year)].map(([dn, name]) => `<li><span>${fmtDn(dn).slice(0, 5)}</span><span class="muted">${DOW_SHORT[dowOf(dn)]}</span><span>${name}</span></li>`).join('')}</ul>
  </section>
</div>
<section class="panel" aria-labelledby="rH">
  <div class="panel__head"><h2 id="rH">Reguły SLA</h2><p class="muted small">Termin reakcji według pakietu i priorytetu</p></div>
  <div class="scroll"><table class="tbl tbl--plain">
    <thead><tr><th scope="col">Priorytet</th>${PACKAGES.map(p => `<th scope="col">${p}</th>`).join('')}</tr></thead>
    <tbody>${PRIORITIES.map(pr => `<tr><th scope="row">${prioBadge(pr)}</th>${PACKAGES.map(p => `<td>${ruleLabel(RULES[p][pr])}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  <details class="disclosure"><summary>Przykłady ze specyfikacji (test przy domyślnych oknach)</summary>
    <div class="scroll"><table class="tbl tbl--plain">
      <thead><tr><th scope="col">Pakiet</th><th scope="col">Priorytet</th><th scope="col">Przyjęte</th><th scope="col">Termin reakcji</th><th scope="col">Co sprawdza</th><th scope="col">Wynik</th></tr></thead>
      <tbody>${tests}</tbody>
    </table></div>
  </details>
</section>
<section class="panel panel--flush" aria-labelledby="aH">
  <div class="panel__head"><h2 id="aH">Zespół</h2><p class="muted small">Konta zakłada <code>create-user --email &lt;e-mail&gt; --role owner|employee</code>. Zablokowanie kończy sesje.</p></div>
  <table class="tbl">
    <thead><tr><th scope="col">Osoba</th><th scope="col">E-mail</th><th scope="col">Rola</th><th scope="col">TOTP</th><th scope="col">Konto</th><th scope="col"><span class="sr-only">Akcje</span></th></tr></thead>
    <tbody>${STAFF.map(u => `<tr><td class="tbl__main" data-label="Osoba">${whoTag(u.id)} ${esc(u.name)}</td><td data-label="E-mail">${esc(u.email)}</td><td data-label="Rola">${ROLE_LABEL[u.role]}</td><td data-label="TOTP">${store.get(totpKey(u), false) ? 'włączone' : 'nieskonfigurowane'}</td><td data-label="Konto">${staffActive(u.id) ? '<span class="badge st-done">aktywne</span>' : '<span class="badge badge--danger">zablokowane</span>'}</td><td class="tbl__acts">${u.role === 'owner' ? '' : `<button type="button" class="btn btn--sm" data-act="staff-toggle" data-id="${u.id}">${staffActive(u.id) ? 'Zablokuj' : 'Odblokuj'}</button>`}</td></tr>`).join('')}</tbody>
  </table>
  <div class="panel__body"><details class="disclosure"><summary>Co może pracownik, a co tylko właściciel</summary>
    <div class="scroll"><table class="tbl tbl--plain"><thead><tr><th scope="col">Uprawnienie</th><th scope="col">Właściciel</th><th scope="col">Pracownik</th></tr></thead>
      <tbody>${PERM_TABLE.map(([what, o, e]) => `<tr><td>${what}</td><td>${o}</td><td class="${e === 'nie' ? 'text-danger' : ''}">${e}</td></tr>`).join('')}</tbody></table></div>
  </details></div>
</section>
<section class="panel" aria-labelledby="sH">
  <div class="panel__head"><h2 id="sH">Sesje i polecenia</h2></div>
  <dl class="kv kv--tight">
    <div><dt>Sesja</dt><dd>7 dni od ostatniej aktywności</dd></div>
    <div><dt>Polecenia serwisowe</dt><dd><code>create-user</code>, <code>set-password</code>, <code>reset-totp</code>, <code>backup</code>, <code>reset-demo</code> przez <code>dotnet run --</code></dd></div>
  </dl>
</section>`,
  };
}

// ---------- client panel (simulated client accounts) ----------
const STATUS_HINT = { 'Nowe': 'czeka na reakcję', 'W toku': 'pracujemy nad tym', 'Czeka na klienta': 'potrzebujemy informacji od Ciebie', 'Zrobione': 'gotowe', 'Odrzucone': 'zamknięte bez realizacji' };
function syncRoleSelect() {
  const sel = $('#roleSelect');
  if (!sel) return;
  const s = store.get('session', null), on = s && Date.now() - s.last < 7 * DAY;
  sel.innerHTML = `${on ? '' : '<option value="">niezalogowany</option>'}<optgroup label="Zespół">${STAFF.map(u => `<option value="${u.role}">${u.name}${staffActive(u.id) ? '' : ' (zablokowany)'}</option>`).join('')}</optgroup><optgroup label="Panel klienta (${portalClients().length})">${portalClients().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`;
  sel.value = !on ? '' : s.role === 'client' ? s.clientId : s.role;
}
function renderPortalShell(c, preview) {
  root.innerHTML = `
${preview ? `<div class="previewbar"><div class="wrap previewbar__in"><span>Podgląd panelu klienta <b>${esc(c.name)}</b>: tak to widzi klient.</span><button type="button" class="btn btn--sm" data-act="portal-exit">Wróć do widoku właściciela</button></div></div>` : ''}
<header class="appbar appbar--portal" data-pid="${c.id}">
  <div class="wrap appbar__in">
    <a class="logo" href="#/" aria-label="ClientTracker, panel klienta"><span class="logo__mark" aria-hidden="true"></span>ClientTracker<span class="logo__sub">panel klienta</span></a>
    <nav class="nav" aria-label="Panel klienta"><a href="#/" data-nav="">Zgłoszenia</a><a href="#/godziny" data-nav="godziny">Godziny i raporty</a></nav>
    <div class="appbar__acts">
      <a class="btn btn--primary" href="#/nowe">+ Nowe zgłoszenie</a>
      <span class="appbar__user">${esc(c.email)}</span>
      ${preview ? '' : '<button type="button" class="btn btn--ghost" data-act="logout">Wyloguj</button>'}
    </div>
  </div>
</header>
<main id="app" class="wrap page" tabindex="-1"></main>
<footer class="foot"><div class="wrap">${esc(c.name)} · pakiet ${c.pkg}. Pilne sprawy poza panelem: telefon. Godziny reakcji liczymy według pakietu, w strefie Europe/Warsaw.</div></footer>`;
}
function renderPortal(pid, force) {
  const s = store.get('session', null), preview = s.role !== 'client', c = clientById(pid);
  const bar = $('.appbar--portal');
  if (force || !bar || bar.dataset.pid !== pid || !!$('.previewbar') !== preview) renderPortalShell(c, preview);
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
  if (v.after) v.after();
  if (route !== lastRoute) { window.scrollTo(0, 0); if (lastRoute !== null) app.focus({ preventScroll: true }); }
  lastRoute = route;
  $('#datasetSelect').value = DB.dataset || 'small';
  tick();
}
function pList(c, q) {
  const ym = ymNow(), now = clock.now(), all = clientTickets(c.id);
  const f = ['zamkniete', 'wszystkie'].includes(q.f) ? q.f : 'otwarte';
  const list = all.filter(t => f === 'wszystkie' || (f === 'otwarte' ? isOpenStatus(t.status) : isClosed(t.status)));
  const reacted = all.filter(t => t.reactedAt != null), inTerm = reacted.filter(t => t.reactedAt <= t.deadline).length;
  const waitingForMe = all.filter(t => t.status === 'Czeka na klienta');
  const used = poolUsed(c.id, ym);
  const tab = (k, label, n) => `<a href="#/?f=${k}"${k === f ? ' aria-current="true"' : ''}>${label} <span>${n}</span></a>`;
  return {
    title: 'Zgłoszenia',
    html: `
${pageHead('Twoje zgłoszenia', `${esc(c.name)} · pakiet ${c.pkg}`, '<a class="btn btn--primary" href="#/nowe">+ Nowe zgłoszenie</a>')}
${waitingForMe.length ? `<p class="alert alert--warn"><b>Czekamy na Twoją odpowiedź:</b> ${waitingForMe.map(t => `<a href="#/z/${t.no}">#${t.no} ${esc(t.title)}</a>`).join(', ')}</p>` : ''}
<div class="stats">
  <div class="stat"><p class="stat__label">Otwarte</p><p class="stat__value">${all.filter(t => isOpenStatus(t.status)).length}</p><p class="muted small">z ${all.length} wszystkich</p></div>
  <div class="stat"><p class="stat__label">Pula · ${ymLabel(ym)}</p><p class="stat__value">${fmtHours(used)} z ${fmtHours(c.pool)} h</p>${c.pool ? `<span class="meter__bar${used > c.pool ? ' meter__bar--over' : ''}" aria-hidden="true"><i style="width:${Math.min(100, used / c.pool * 100).toFixed(1)}%"></i></span>` : '<p class="muted small">pakiet bez puli godzin</p>'}</div>
  <div class="stat"><p class="stat__label">Reakcja w terminie</p><p class="stat__value">${inTerm} z ${reacted.length}</p><p class="muted small">wszystkie zgłoszenia z reakcją</p></div>
  <div class="stat"><p class="stat__label">Czas reakcji w pakiecie ${c.pkg}</p><ul class="rules">${PRIORITIES.map(p => `<li>${prioBadge(p)}<span>${ruleLabel(RULES[c.pkg][p])}</span></li>`).join('')}</ul></div>
</div>
<section class="panel panel--flush" aria-label="Zgłoszenia">
  <div class="toolbar"><nav class="tabsline" aria-label="Filtr">${tab('otwarte', 'Otwarte', all.filter(t => isOpenStatus(t.status)).length)}${tab('zamkniete', 'Zamknięte', all.filter(t => isClosed(t.status)).length)}${tab('wszystkie', 'Wszystkie', all.length)}</nav></div>
  ${list.length ? `<table class="tbl tbl--click">
    <caption class="sr-only">Twoje zgłoszenia</caption>
    <thead><tr><th scope="col">Nr</th><th scope="col">Tytuł</th><th scope="col">Status</th><th scope="col">Termin reakcji</th><th scope="col">Reakcja</th></tr></thead>
    <tbody>${list.map(t => `<tr data-href="#/z/${t.no}">
      <td class="num muted" data-label="Nr">#${t.no}</td>
      <td class="tbl__main" data-label="Tytuł"><a href="#/z/${t.no}">${esc(t.title)}</a><small>${t.priority} · przyjęte ${fmtDT(t.receivedAt)}</small></td>
      <td data-label="Status">${statusBadge(t.status)}<small class="muted block">${STATUS_HINT[t.status]}</small></td>
      <td class="nowrap" data-label="Termin reakcji">${fmtDTdow(t.deadline)}</td>
      <td data-label="Reakcja">${slaBadge(t, now)}</td></tr>`).join('')}</tbody>
  </table>` : `<div class="empty"><p>${f === 'otwarte' ? 'Nie masz otwartych zgłoszeń.' : 'Brak zgłoszeń.'}</p></div>`}
</section>`,
  };
}
function pTicket(c, no) {
  const t = ticketByNo(no);
  if (!t || t.clientId !== c.id) return notFound();
  const now = clock.now(), entries = entriesOfTicket(t.no);
  const visited = new Set(['Nowe', ...t.history.filter(h => h.field === 'status').map(h => h.to)]);
  const node = (s, pos) => flowNode('span', s, pos, s === t.status ? ' is-current' : visited.has(s) ? ' is-visited is-static' : ' is-static', s === t.status ? ' aria-current="step"' : '', s === t.status ? 'teraz' : null);
  const hist = t.history.filter(h => h.field === 'status').slice().reverse();
  return {
    title: `#${t.no} ${t.title}`,
    html: `
<nav class="crumbs" aria-label="Ścieżka"><a href="#/">Zgłoszenia</a><span aria-hidden="true">›</span><span>#${t.no}</span></nav>
<div class="pagehead"><div><h1><span class="muted">#${t.no}</span> ${esc(t.title)}</h1><p class="meta">${statusBadge(t.status)} <span class="muted">${STATUS_HINT[t.status]}</span> ${prioBadge(t.priority)}</p></div></div>
<div class="cols cols--ticket">
  <div class="cols__main stack">
    <section class="panel" aria-labelledby="pstH">
      <div class="panel__head"><h2 id="pstH">Gdzie jest Twoje zgłoszenie</h2></div>
      ${statusFlow(node, edgesTaken(t), `Status zgłoszenia #${t.no}`)}
      <ul class="legend">${STATUSES.map(s => `<li>${statusBadge(s)} ${STATUS_HINT[s]}</li>`).join('')}</ul>
    </section>
    <section class="panel" aria-labelledby="pdH"><div class="panel__head"><h2 id="pdH">Opis</h2></div>${t.desc ? `<p class="prewrap">${esc(t.desc)}</p>` : '<p class="muted">Bez opisu.</p>'}</section>
    <section class="panel panel--flush" aria-labelledby="peH">
      <div class="panel__head"><h2 id="peH">Przepracowany czas <span class="count">${fmtHours(sumHours(entries))} h</span></h2></div>
      ${entries.length ? `<table class="tbl"><caption class="sr-only">Czas pracy przy zgłoszeniu #${t.no}</caption>
        <thead><tr><th scope="col">Data</th><th scope="col">Rodzaj</th><th scope="col" class="num">Godziny</th><th scope="col">Opis</th></tr></thead>
        <tbody>${entries.map(e => `<tr><td data-label="Data">${fmtDn(dnFromISO(e.date))}</td><td data-label="Rodzaj">${kindBadge(e.kind)}</td><td class="num" data-label="Godziny">${fmtHours(e.hours)}</td><td data-label="Opis">${esc(e.desc) || '—'}</td></tr>`).join('')}</tbody></table>`
        : '<div class="empty"><p>Jeszcze nie ma wpisów.</p></div>'}
    </section>
  </div>
  <aside class="cols__side stack">
    <section class="panel" aria-labelledby="pslaH">
      <div class="panel__head"><h2 id="pslaH">Termin reakcji</h2>${slaBadge(t, now)}</div>
      <p class="deadline">${fmtDTdow(t.deadline)}</p>
      <p class="muted small">Pakiet ${t.pkg}, priorytet ${t.priority.toLowerCase()}: ${ruleLabel(RULES[t.pkg][t.priority])}. Gwarantujemy czas reakcji, nie naprawy.</p>
      <dl class="kv kv--tight">
        <div><dt>Przyjęte</dt><dd>${fmtDTdow(t.receivedAt)}</dd></div>
        <div><dt>Reakcja</dt><dd>${t.reactedAt != null ? fmtDTdow(t.reactedAt) : '<span class="muted">jeszcze nie</span>'}</dd></div>
        <div><dt>Zamknięte</dt><dd>${t.closedAt != null ? fmtDTdow(t.closedAt) : '<span class="muted">otwarte</span>'}</dd></div>
      </dl>
    </section>
    <section class="panel" aria-labelledby="phH"><div class="panel__head"><h2 id="phH">Historia</h2></div>
      ${hist.length ? `<ol class="hist">${hist.map(h => `<li><time>${fmtDT(h.at)}</time> ${esc(h.from)} → ${esc(h.to)}</li>`).join('')}</ol>` : '<p class="muted">Bez zmian od przyjęcia.</p>'}
    </section>
  </aside>
</div>`,
  };
}
function pNew(c) {
  const desc = Object.fromEntries(PRIORITIES.map(p => [p, `reakcja: ${ruleLabel(RULES[c.pkg][p])}`]));
  return {
    title: 'Nowe zgłoszenie',
    html: `
<nav class="crumbs" aria-label="Ścieżka"><a href="#/">Zgłoszenia</a><span aria-hidden="true">›</span><span>Nowe</span></nav>
${pageHead('Nowe zgłoszenie', `Przyjmujemy je w chwili wysłania. Termin reakcji liczymy według pakietu ${c.pkg}.`)}
<form class="panel narrow" data-form="portal-ticket" novalidate>
  ${fld('title', 'Czego dotyczy?', `<input type="text" ${ctl('title', 'required maxlength="160" autocomplete="off" placeholder="np. Nie działa formularz kontaktowy"')}>`)}
  ${fld('desc', 'Opis', `<textarea ${ctl('desc', 'rows="5" placeholder="Co się dzieje, od kiedy, na której stronie"')}></textarea>`)}
  ${segmented('priority', 'Jak pilne?', PRIORITIES, 'Normalny', desc)}
  <p class="muted small">Krytyczny: strona albo sprzedaż nie działa. Wysoki: ważna funkcja działa źle. Normalny: zmiany i drobne poprawki.</p>
  <output class="preview" id="pPreview" aria-live="polite"></output>
  <div class="row-gap"><button type="submit" class="btn btn--primary">Wyślij zgłoszenie</button><a class="btn" href="#/">Anuluj</a></div>
</form>`,
    after() { portalPreview($('[data-form="portal-ticket"]')); $('#f-title').focus(); },
  };
}
function portalPreview(form) {
  const pid = portalId(), c = clientById(pid), pr = new FormData(form).get('priority'), now = clock.now();
  $('#pPreview', form).innerHTML = `<span class="muted small">Jeśli wyślesz teraz, zareagujemy najpóźniej</span><b>${fmtDTdow(reactionDeadline(now, c.pkg, pr, DB.settings))}</b><span class="muted small">${ruleLabel(RULES[c.pkg][pr])}</span>`;
}
function pHours(c, q) {
  const ym = /^\d{4}-\d{2}$/.test(q.miesiac || '') ? q.miesiac : ymNow();
  const s = monthSummary(c.id, ym);
  const entries = s.entries.slice().sort((a, b) => a.date.localeCompare(b.date));
  return {
    title: `Godziny i raporty · ${ymLabel(ym)}`,
    html: `
${pageHead('Godziny i raporty', `Pakiet ${c.pkg}: ${c.pool ? `${fmtHours(c.pool)} h zmian w miesiącu` : 'bez puli godzin na zmiany'}, utrzymanie w cenie abonamentu.`, ymNav(ym, m => `#/godziny?miesiac=${m}`))}
<div class="stats">
  <div class="stat"><p class="stat__label">Pula na zmiany</p><p class="stat__value">${fmtHours(s.pool)} z ${fmtHours(s.poolMax)} h</p>${s.over ? `<p class="small text-danger">ponad pulę o ${fmtHours(s.over)} h</p>` : s.poolMax ? `<span class="meter__bar" aria-hidden="true"><i style="width:${(s.pool / s.poolMax * 100).toFixed(1)}%"></i></span>` : ''}</div>
  <div class="stat"><p class="stat__label">Utrzymanie</p><p class="stat__value">${fmtHours(s.maint)} h</p><p class="muted small">awarie, aktualizacje, kopie; w cenie</p></div>
  <div class="stat"><p class="stat__label">Prace dodatkowe</p><p class="stat__value">${fmtHours(s.extra)} h</p><p class="muted small">poza pakietem, rozliczane osobno</p></div>
  <div class="stat"><p class="stat__label">Razem</p><p class="stat__value">${fmtHours(s.total)} h</p></div>
</div>
<div class="cols cols--ticket">
  <section class="panel cols__main" aria-labelledby="prH"><div class="panel__head"><h2 id="prH">Raport miesięczny</h2></div><div class="md">${mdToHtml(monthReport(c.id, ym))}</div></section>
  <section class="panel panel--flush cols__side" aria-labelledby="pwH">
    <div class="panel__head"><h2 id="pwH">Wpisy czasu <span class="count">${entries.length}</span></h2></div>
    ${entries.length ? `<ul class="plainlist">${entries.map(e => { const t = e.ticketNo ? ticketByNo(e.ticketNo) : null; return `<li><span class="muted small">${fmtDn(dnFromISO(e.date))}</span> ${kindBadge(e.kind)} <b>${fmtHours(e.hours)} h</b><span class="small">${t ? `<a href="#/z/${t.no}">#${t.no} ${esc(t.title)}</a>` : esc(e.desc) || '—'}</span></li>`; }).join('')}</ul>` : '<div class="empty"><p>Brak wpisów w tym miesiącu.</p></div>'}
  </section>
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
    <header class="dlg__head"><h2 id="dlgTitle">${title}</h2><button type="button" class="btn btn--icon btn--ghost" data-act="dlg-close" aria-label="Zamknij">×</button></header>
    <div class="dlg__body">${body}</div>
    <footer class="dlg__foot"><button type="button" class="btn" data-act="dlg-close">${submit ? 'Anuluj' : 'Zamknij'}</button>${submit ? `<button type="submit" class="btn ${danger ? 'btn--dangerfill' : 'btn--primary'}">${submit}</button>` : ''}</footer>
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
      if (err instanceof Invalid) showErrors(form, err.errors); else if (err.forbidden) toast(err.message, 'danger'); else throw err;
    }
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
  const t = no ? ticketByNo(no) : null;
  const now = clock.now();
  const sel = t ? t.clientId : presetClient && clientById(presetClient)?.active ? presetClient : '';
  if (!t && !DB.clients.some(c => c.active)) return toast('Najpierw dodaj aktywnego klienta.', 'danger');
  openDialog({
    title: t ? `Edycja zgłoszenia #${t.no}` : 'Nowe zgłoszenie',
    submit: t ? 'Zapisz zmiany' : 'Przyjmij zgłoszenie',
    wide: true,
    body: `
      <div class="grid2">
        ${fld('clientId', 'Klient', `<select ${ctl('clientId', t ? 'disabled' : 'required')}>${t ? `<option>${esc(clientById(t.clientId).name)}</option>` : `<option value="">Wybierz klienta</option>${clientOptions(sel, { activeOnly: true })}`}</select>`, t ? '' : 'Tylko aktywni klienci.')}
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
      const rec = fromLocalInput(fd.get('receivedAt')), pr = fd.get('priority');
      const out = $('#dlPreview', form);
      if (!c || isNaN(rec) || !pr) { out.innerHTML = '<span class="muted">Termin reakcji pojawi się po wyborze klienta.</span>'; return; }
      const pkg = t ? t.pkg : c.pkg, win = t ? t.win : DB.settings, r = RULES[pkg][pr];
      out.innerHTML = `<span class="muted small">Termin reakcji</span><b>${fmtDTdow(reactionDeadline(rec, pkg, pr, win))}</b><span class="muted small">${ruleLabel(r)} · pakiet ${pkg}${t ? ' z chwili przyjęcia' : ''}</span>`;
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
  const ticketOpts = (clientId, selNo) => `<option value="">Bez zgłoszenia</option>` +
    DB.tickets.filter(t => t.clientId === clientId).sort((a, b) => b.no - a.no)
      .map(t => `<option value="${t.no}"${t.no === selNo ? ' selected' : ''}>#${t.no} ${esc(t.title)}${isClosed(t.status) ? ` (${t.status.toLowerCase()})` : ''}</option>`).join('');
  openDialog({
    title: e ? 'Popraw wpis czasu' : 'Dodaj czas pracy',
    submit: e ? 'Zapisz zmiany' : 'Zapisz wpis',
    wide: true,
    body: `
      <div class="grid2">
        ${fld('clientId', 'Klient', `<select ${ctl('clientId', 'required')}><option value="">Wybierz klienta</option>${clientOptions(cid)}</select>`)}
        ${fld('ticketNo', 'Zgłoszenie', `<select ${ctl('ticketNo')}>${ticketOpts(cid, tno)}</select>`, 'Opcjonalnie, tylko zgłoszenia tego klienta.')}
      </div>
      <div class="grid2">
        ${fld('date', 'Data', `<input type="date" ${ctl('date', 'required')} value="${e ? e.date : todayISO()}">`)}
        <div class="fld"><label for="f-hours">Czas (godziny)</label><input type="text" inputmode="decimal" ${ctl('hours', 'required autocomplete="off" placeholder="np. 1,5"')} value="${e ? fmtHours(e.hours) : ''}">
          <div class="quick" role="group" aria-label="Szybki wybór czasu">${[0.25, 0.5, 1, 1.5, 2, 4].map(h => `<button type="button" class="btn btn--sm" data-quick="${fmtHours(h)}">${fmtHours(h)} h</button>`).join('')}</div>
          <p class="fld__hint">Od 0,25 do 24 h, co 0,25 h. Przyjmuje 1,5 i 1.5.</p><p class="fld__err" id="e-hours" data-err="hours"></p></div>
      </div>
      ${segmented('kind', 'Rodzaj', KINDS, e ? e.kind : 'Utrzymanie', { Pula: 'odejmowana od puli pakietu', Utrzymanie: 'w cenie abonamentu', Dodatkowe: can('money') ? `płatne, ${fmtMoney(DB.settings.rate)}/h` : 'poza pakietem, płatne osobno' })}
      ${fld('desc', 'Opis', `<input type="text" ${ctl('desc', 'maxlength="200" autocomplete="off"')} value="${e ? esc(e.desc) : ''}">`)}`,
    onInput(form, ev) {
      if (ev && ev.target.name === 'clientId') $('#f-ticketNo', form).innerHTML = ticketOpts(ev.target.value, null);
    },
    onSubmit(form) {
      const fd = new FormData(form);
      const d = { clientId: fd.get('clientId'), ticketNo: fd.get('ticketNo'), date: fd.get('date'), hours: fd.get('hours'), kind: fd.get('kind'), desc: fd.get('desc') };
      const x = e ? updateEntry(e.id, d) : createEntry(d);
      return `${e ? 'Poprawiono' : 'Zapisano'}: ${fmtHours(x.hours)} h ${x.kind}, ${fmtDn(dnFromISO(x.date))}.`;
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
      ${segmented('pkg', 'Pakiet', PACKAGES, pkg, Object.fromEntries(PACKAGES.map(p => [p, `${fmtMoney(PACKAGE_DEFAULTS[p].price)} · ${fmtHours(PACKAGE_DEFAULTS[p].pool)} h`])))}
      <div class="grid2">
        ${fld('price', 'Abonament miesięcznie (zł)', `<input type="text" inputmode="decimal" ${ctl('price', 'required')} value="${String(c ? c.price : PACKAGE_DEFAULTS[pkg].price).replace('.', ',')}">`)}
        ${fld('pool', 'Pula godzin w miesiącu', `<input type="text" inputmode="decimal" ${ctl('pool', 'required')} value="${fmtHours(c ? c.pool : PACKAGE_DEFAULTS[pkg].pool)}">`)}
      </div>
      <p class="muted small">Pakiet podpowiada cenę i pulę, obie można zmienić. Zmiana pakietu nie przesuwa terminów istniejących zgłoszeń.</p>
      ${c ? `<label class="check check--box"><input type="checkbox" name="active"${c.active ? ' checked' : ''}><span>Aktywny<small>Nieaktywny klient jest ukryty na liście i nie przyjmuje zgłoszeń. Klienta nie da się usunąć.</small></span></label>` : ''}`,
    onInput(form, ev) {
      if (ev && ev.target.name === 'pkg') {
        const d = PACKAGE_DEFAULTS[ev.target.value];
        $('#f-price', form).value = String(d.price);
        $('#f-pool', form).value = fmtHours(d.pool);
      }
    },
    onSubmit(form) {
      const fd = new FormData(form);
      const d = { name: fd.get('name'), email: fd.get('email'), pkg: fd.get('pkg'), price: parseHoursInput(fd.get('price')), pool: parseHoursInput(fd.get('pool')), active: fd.get('active') === 'on' };
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
      <div class="fld"><label for="f-report">Markdown dla klienta</label><textarea id="f-report" class="report" rows="20" readonly>${esc(md)}</textarea></div>
      <div class="row-gap"><button type="button" class="btn btn--primary" data-act="copy-report">Kopiuj do schowka</button><p class="muted small">Bez kwot i efektywnej stawki. Sekcje z „…” uzupełniasz ręcznie.</p></div>`,
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
    case 'portal-exit': { const s = store.get('session', null), id = s.as; delete s.as; store.set('session', s); location.hash = `#/klient/${id}`; return render(true); }
    case 'fill-code': { const i = $('#lCode'); i.value = totpCode(totpStep()); return i.focus(); }
    case 'login-back': login.step = 'password'; login.err = ''; return renderLogin();
    case 'new-ticket': return ticketDialog(null, d.client);
    case 'edit-ticket': return ticketDialog(+d.no);
    case 'status': {
      const wasNew = ticketByNo(+d.no).status === 'Nowe';
      setStatus(+d.no, d.to);
      const t = ticketByNo(+d.no);
      render();
      return toast(wasNew ? `#${t.no}: ${t.status}. Zapisano reakcję ${fmtDT(t.reactedAt)} (${slaState(t, clock.now()).text.toLowerCase()}).` : `#${t.no}: ${t.status}.`);
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
    case 'dlg-close': return dlg.close();
  }
}
document.addEventListener('input', ev => {
  if (ev.target.id === 'clientSearch') { clientUI.q = ev.target.value; filterClients(); }
  const pf = ev.target.closest('[data-form="portal-ticket"]');
  if (pf) portalPreview(pf);
});
document.addEventListener('change', ev => {
  const t = ev.target, f = t.dataset.filter;
  if (t.dataset.assign) { try { const x = assignTicket(+t.dataset.assign, t.value || null); render(); return toast(`#${x.no}: prowadzi ${staffName(x.assignee)}.`); } catch (err) { if (err.forbidden) { render(); return toast(err.message, 'danger'); } throw err; } }
  if (t.id === 'roleSelect') return ['owner', 'employee'].includes(t.value) ? startSession(t.value) : t.value ? startSession('client', t.value) : null;
  if (t.id === 'clientPkg') { clientUI.pkg = t.value; return filterClients(); }
  if (t.id === 'clientInactive') { clientUI.inactive = t.checked; return filterClients(); }
  if (t.id === 'datasetSelect') {
    resetDemo(t.value); clientUI.q = ''; clientUI.pkg = '';
    toast(`Dane demo: ${DB.clients.length} klientów, ${DB.tickets.length} zgłoszeń. Sesja zachowana.`);
    return rerenderAll();
  }
  if (f === 'dash') location.hash = `#/?${new URLSearchParams({ ...(t.value && { klient: t.value }), ...(t.dataset.status && { status: t.dataset.status }), ...(t.dataset.kto && { kto: t.dataset.kto }) })}`;
  if (f === 'time') location.hash = `#/czas?miesiac=${t.dataset.ym}${t.value ? '&klient=' + t.value : ''}`;
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
    if (err instanceof Invalid) showErrors(form, err.errors); else if (err.forbidden) toast(err.message, 'danger'); else throw err;
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
  const now = clock.now();
  const ci = $('#clockInput');
  if (ci && document.activeElement !== ci) ci.value = toLocalInput(now);
  const code = $('#authCode');
  if (code) {
    code.textContent = totpCode(totpStep()).replace(/(\d{3})/, '$1 ');
    $('#authTtl').textContent = `nowy kod za ${30 - Math.floor(Date.now() / 1000) % 30} s`;
  }
  if (Date.now() - lastSlaTick > 15000) {
    lastSlaTick = Date.now();
    $$('[data-sla]').forEach(el => { const t = ticketByNo(+el.dataset.sla); if (t) el.outerHTML = slaBadge(t, now); });
  }
}
setInterval(tick, 1000);
render(true);
