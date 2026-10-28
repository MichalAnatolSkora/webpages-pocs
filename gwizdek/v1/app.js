// Gwizdek v1 — shell and router: the demo bar with the role switch, sidebar (staff) or phone frame
// with a tab bar (parent), notifications, the three dashboards and live redraws from other tabs.

const app = $('#app');
const VOC = { anna: 'Anno', marek: 'Marku', kasia: 'Katarzyno' };

const NAV = {
  coord: [['', 'Pulpit', 'home'], ['kalendarz', 'Kalendarz', 'cal'], ['obiekty', 'Obiekty', 'pitch'], ['zawodnicy', 'Zawodnicy', 'users'], ['zdrowie', 'Zdrowie', 'heart'],
    ['treningi', 'Treningi', 'book'], ['skladki', 'Składki', 'coins'], ['komunikacja', 'Komunikacja', 'chat'], ['nabory', 'Nabory', 'form']],
  coach: [['', 'Pulpit', 'home'], ['kalendarz', 'Kalendarz', 'cal'], ['treningi', 'Treningi', 'book'], ['tablica', 'Tablica taktyczna', 'board'], ['zawodnicy', 'Zawodnicy', 'users'],
    ['zdrowie', 'Zdrowie', 'heart'], ['skladki', 'Składki', 'coins'], ['komunikacja', 'Komunikacja', 'chat']],
  parent: [['', 'Start', 'home'], ['kalendarz', 'Kalendarz', 'cal'], ['dzieci', 'Dzieci', 'users'], ['skladki', 'Składki', 'coins'], ['komunikacja', 'Czat', 'chat']],
};

// ---------- routing ----------
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, q: new URLSearchParams(qs || '') };
}

const ROUTES = {
  '': () => (isParent() ? dashParent() : isCoord() ? dashCoord() : dashCoach()),
  kalendarz: q => (isParent() ? parentCalendar(q) : calendarView(q)),
  wydarzenie: (q, id) => eventView(id, q),
  obiekty: q => facilitiesView(q),
  treningi: q => trainingView(q),
  konspekt: (q, id) => planEditor(id, q),
  cwiczenie: (q, id) => exerciseView(id),
  tablica: (q, id) => (id ? boardPage(id) : boardsList()),
  zawodnicy: q => playersView(q),
  zawodnik: (q, id) => playerView(id, q),
  dzieci: () => kidsView(),
  zdrowie: q => healthView(q),
  skladki: q => feesView(q),
  komunikacja: q => commsView(q),
  nabory: q => recruitView(q),
  nabor: () => publicForm(),
};
const PARENT_OK = new Set(['', 'kalendarz', 'wydarzenie', 'zawodnik', 'dzieci', 'skladki', 'komunikacja', 'nabor']);

let current = '';
function route() {
  const { parts, q } = parseHash();
  if (q.get('as') && ROLES[q.get('as')]) {
    q.delete('as');
    const clean = '#/' + parts.join('/') + (q.toString() ? '?' + q : '');
    history.replaceState(null, '', clean);
  }
  let key = parts[0] || '';
  if (!ROUTES[key]) key = '';
  if (isParent() && !PARENT_OK.has(key)) key = '';
  if (!isParent() && key === 'dzieci') key = '';
  document.body.classList.toggle('is-public', key === 'nabor');
  const changed = current !== location.hash;
  current = location.hash;
  renderShell(key);
  try {
    ROUTES[key](q, parts[1]);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="page"><div class="empty">${ic('alert')}<p>Coś poszło nie tak przy rysowaniu tej strony.</p><a class="btn btn--primary" href="#/">Wróć na pulpit</a></div></div>`;
  }
  if (changed) { scrollBox().scrollTop = 0; app.focus({ preventScroll: true }); }
}
const render = () => { const y = scrollBox().scrollTop; route(); scrollBox().scrollTop = y; };
// the parent's phone frame scrolls inside .main; staff pages scroll the window
const scrollBox = () => (isParent() ? $('.main') : document.scrollingElement);
window.addEventListener('hashchange', route);

// Another tab changed the data: redraw, but not under someone's fingers while typing or in a dialog.
let pendingRefresh = false;
function liveRefresh() {
  const a = document.activeElement;
  const typing = a && a.matches?.('input, textarea, select, [contenteditable]') && (a.closest('#app') || a.closest('.modal'));
  if (typing || $('#modalRoot').children.length || $('.bed')) { pendingRefresh = true; renderChrome(); return; }
  render();
}
document.addEventListener('focusout', () => setTimeout(() => {
  if (pendingRefresh && !$('#modalRoot').children.length && !document.activeElement?.matches?.('input, textarea, select')) { pendingRefresh = false; render(); }
}, 50));

// ---------- shell ----------
function renderShell(key) {
  document.body.classList.toggle('is-parent', isParent());
  document.body.dataset.role = role;
  renderDemoBar();
  const u = person(me());
  if (isParent()) {
    $('#side').innerHTML = '';
    $('#top').innerHTML = `<div class="appbar">
      <a class="appbar__logo" href="#/">${logoMark()}<span>Iskra</span></a>
      <span class="grow"></span>
      ${bellBtn()}
      <span class="appbar__me">${avatar(u.name, '#0f7b53', 'ava--sm')}</span></div>`;
    $('#tabbar').innerHTML = NAV.parent.map(([k, label, icon]) => {
      const badge = k === 'komunikacja' ? unreadThreads().length : k === 'skladki' ? myKids().reduce((a, kid) => a + overdueOf(kid.id).length, 0) : 0;
      return `<a href="#/${k}" class="tab ${k === key ? 'is-on' : ''}" ${k === key ? 'aria-current="page"' : ''}>${ic(icon)}<span>${label}</span>${badge ? `<i class="tab__b">${badge}</i>` : ''}</a>`;
    }).join('');
  } else {
    $('#tabbar').innerHTML = '';
    $('#side').innerHTML = `
      <a class="brand" href="#/">${logoMark()}<span class="brand__w">gwizdek</span></a>
      <div class="club"><span class="club__crest" aria-hidden="true">${crest()}</span><span><b>${CLUB.name}</b><small>Sezon ${db.season}</small></span></div>
      <nav class="nav" aria-label="Główna">${NAV[role].map(([k, label, icon]) => {
        const badge = k === 'komunikacja' ? unreadThreads().length : k === 'nabory' ? db.apps.filter(a => a.status === 'new').length : 0;
        return `<a href="#/${k}" class="nav__i ${k === key || (k === 'treningi' && ['konspekt', 'cwiczenie'].includes(key)) || (k === 'zawodnicy' && key === 'zawodnik') || (k === 'kalendarz' && key === 'wydarzenie') ? 'is-on' : ''}">${ic(icon)}<span>${label}</span>${badge ? `<i class="nav__b">${badge}</i>` : ''}</a>`;
      }).join('')}</nav>
      <div class="me">${avatar(u.name, u.color)}<span><b>${esc(u.name)}</b><small>${esc(u.role)}</small></span></div>`;
    $('#top').innerHTML = `<div class="topbar">
      <button type="button" class="icon-btn topbar__menu" id="menuBtn" aria-label="Menu">${ic('menu')}</button>
      <a class="topbar__logo" href="#/">${logoMark()}<span>gwizdek</span></a>
      <span class="grow"></span>
      <span class="chip chip--soft">${ic('cal')} ${fmtLong(Date.now())}</span>
      ${bellBtn()}
      ${themeBtn()}</div>`;
    $('#menuBtn').addEventListener('click', () => document.body.classList.toggle('side-open'));
    $('#side').onclick = e => { if (e.target.closest('a')) document.body.classList.remove('side-open'); };
  }
  bindChrome();
}

// Badges and the bell only (for a live update while a form is open)
function renderChrome() {
  const n = unreadNotes().length;
  $$('.bell__n').forEach(x => { x.textContent = n; x.hidden = !n; });
}

const logoMark = () => `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--pitch)"/><path d="M6.5 16.5a6 6 0 1 0 12 0V14h7.5v-3.5H12.5a6 6 0 0 0-6 6z" fill="var(--lime)"/><circle cx="12.5" cy="16.5" r="2" fill="var(--pitch)"/></svg>`;
const crest = () => `<svg viewBox="0 0 32 36" aria-hidden="true"><path d="M16 1l14 5v11c0 9-6 15.5-14 18C8 32.5 2 26 2 17V6z" fill="#c9302c"/><path d="M16 4.5l11 4v8.5c0 7.2-4.6 12.4-11 14.6-6.4-2.2-11-7.4-11-14.6V8.5z" fill="#fff"/><path d="M18.5 7l-7 12h5l-2.5 10 8.5-13.5h-5.5z" fill="#c9302c"/></svg>`;
const bellBtn = () => { const n = unreadNotes().length; return `<button type="button" class="icon-btn bell" id="bellBtn" aria-label="Powiadomienia${n ? `: ${n} nowe` : ''}" aria-haspopup="dialog">${ic('bell')}<i class="bell__n" ${n ? '' : 'hidden'}>${n}</i></button>`; };
const themeBtn = () => `<button type="button" class="icon-btn" id="themeBtn" aria-label="Zmień motyw">${ic(document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches) ? 'sun' : 'moon')}</button>`;

function bindChrome() {
  $('#bellBtn')?.addEventListener('click', openNotes);
  $('#themeBtn')?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    store.set('gwizdek-theme', document.documentElement.dataset.theme);
    render();
  });
}

function renderDemoBar() {
  const twin = isParent() ? 'coach' : 'parent';
  $('#demo').innerHTML = `<div class="demo__in">
    <span class="demo__badge">POC v1</span>
    <div class="seg" role="radiogroup" aria-label="Rola w demo">${Object.entries(ROLES).map(([k, r]) =>
      `<button type="button" role="radio" aria-checked="${k === role}" class="seg__b ${k === role ? 'is-on' : ''}" data-role="${k}">${ic(r.icon)}<span>${r.label}</span></button>`).join('')}</div>
    <span class="demo__note">${esc(personName(ROLES[role].user))} · dane fikcyjne, płatności i SMS-y symulowane</span>
    <span class="grow"></span>
    <a class="demo__link" href="${location.pathname}#/?as=${twin}" target="_blank" rel="noopener" title="Obie karty dzielą dane — zmiany widać na żywo">${ic('copy')} <span>Druga karta: ${ROLES[twin].label.toLowerCase()}</span></a>
    <button type="button" class="demo__btn" id="resetBtn">${ic('refresh')} <span>Reset danych</span></button></div>`;
  $$('[data-role]', $('#demo')).forEach(b => b.addEventListener('click', () => {
    if (b.dataset.role === role) return;
    role = b.dataset.role;
    saveRole(role);
    location.hash = '#/';
    route();
    toast(`Jesteś teraz: ${personName(me())} (${ROLES[role].label.toLowerCase()})`, ROLES[role].icon);
  }));
  $('#resetBtn').addEventListener('click', async () => {
    if (!(await confirmBox({ title: 'Przywrócić dane demo?', body: 'Wszystkie zmiany z tej sesji (obecności, wpłaty, wiadomości, konspekty) znikną we wszystkich kartach.', ok: 'Przywróć', danger: true }))) return;
    resetDb();
    location.hash = '#/';
    route();
    toast('Dane demo przywrócone', 'refresh');
  });
}

// ---------- notifications popover ----------
function openNotes() {
  const list = myNotes(), fresh = list.filter(n => !n.read), old = list.filter(n => n.read).slice(0, 12);
  const row = n => `<button type="button" class="note ${n.read ? 'is-read' : ''}" data-note="${n.id}">
    <span class="note__i">${ic(n.icon)}</span><span class="note__t"><b>${esc(n.title)}</b><span>${esc(n.body)}</span><small>${ago(n.at)}</small></span></button>`;
  const m = modal({
    cls: 'modal--notes', label: 'Powiadomienia',
    html: `${modalHead('Powiadomienia', fresh.length ? nOf(fresh.length, 'nowe', 'nowe', 'nowych') : 'Wszystko przeczytane')}
      <div class="mb notes">
        ${fresh.length ? fresh.map(row).join('') : `<p class="empty-s">${ic('check')} Nic nowego. Przeczytane powiadomienia nie wiszą na liście — są niżej.</p>`}
        ${old.length ? `<details class="notes__old"><summary>Wcześniejsze (${old.length})</summary>${old.map(row).join('')}</details>` : ''}
      </div>
      ${fresh.length ? `<footer class="mf"><button type="button" class="btn btn--ghost" data-all>${ic('check')} Oznacz wszystkie jako przeczytane</button></footer>` : ''}`,
  });
  m.el.addEventListener('click', e => {
    const b = e.target.closest('[data-note]');
    if (b) { const n = db.notes.find(x => x.id === b.dataset.note); markRead([n.id]); m.close(); location.hash = n.link; render(); }
    if (e.target.closest('[data-all]')) { markRead(fresh.map(n => n.id)); m.close(); render(); }
  });
}

// ---------- shared bits ----------
const pageHead = (eyebrow, title, actions = '', sub = '') => `<header class="ph"><div class="ph__t"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${sub ? `<p class="ph__s">${sub}</p>` : ''}</div>${actions ? `<div class="ph__a">${actions}</div>` : ''}</header>`;
const badge = (text, cls = '') => `<span class="badge badge--${cls}">${text}</span>`;
const teamDot = t => `<span class="tdot" style="--c:${teamColor(t)}" aria-hidden="true"></span>`;
const teamTag = t => `<span class="ttag" style="--c:${teamColor(t)}">${t === 'all' ? 'Klub' : team(t).cat}</span>`;
const kpi = (label, value, sub = '', cls = '', href = '') => `<${href ? `a href="${href}"` : 'div'} class="kpi ${cls}"><span class="kpi__l">${label}</span><b class="kpi__v">${value}</b>${sub ? `<span class="kpi__s">${sub}</span>` : ''}</${href ? 'a' : 'div'}>`;
const card = (title, body, { action = '', cls = '' } = {}) => `<section class="card ${cls}"><header class="card__h"><h2>${title}</h2>${action}</header>${body}</section>`;

function eventRow(e, { showTeam = true, link = true } = {}) {
  const live = isLive(e), past = isPast(e);
  const meta = [fmtRange(e.start, e.end), e.type === 'match' && !e.home ? 'wyjazd' : facNames(e.fac) || e.place].filter(Boolean).join(' · ');
  let right = '';
  if (e.type === 'match' && e.live && !e.fest) right = `<b class="score ${e.live.status === 'live' ? 'is-live' : ''}">${e.live.us}:${e.live.them}</b>`;
  else if (live) right = badge('trwa', 'live');
  else if (e.type === 'training' && past && Object.keys(e.att).length) right = badge(`${Object.values(e.att).filter(v => v === 'present' || v === 'late').length}/${Object.keys(e.att).length}`, 'ok');
  return `<${link ? `a href="#/wydarzenie/${e.id}"` : 'div'} class="erow erow--${e.type} ${past ? 'is-past' : ''}" style="--c:${teamColor(e.team)}">
    <span class="erow__time">${fmtTime(e.start)}</span>
    <span class="erow__body"><b>${showTeam ? `${teamTag(e.team)} ` : ''}${esc(e.type === 'match' ? e.title : e.title)}</b><small>${esc(meta)}</small></span>
    ${right}</${link ? 'a' : 'div'}>`;
}

// ---------- dashboards ----------
function dashCoord() {
  const now = Date.now(), today = startOfDay(now);
  const players = db.players.length;
  const att = TEAMS.map(t => ({ t, ...teamAttendance(t.id) }));
  const attAll = Math.round(avg(att.map(a => a.pct)));
  const overdue = db.charges.filter(c => chargeStatus(c) === 'overdue');
  const overdueSum = overdue.reduce((a, c) => a + c.amount, 0), overduePeople = new Set(overdue.map(c => c.player)).size;
  const medBad = db.players.filter(p => medStatus(p).cls === 'bad'), medWarn = db.players.filter(p => medStatus(p).cls === 'warn');
  const todays = db.events.filter(e => sameDay(e.start, now)).sort((a, b) => a.start - b.start);
  const todayRes = db.reservations.filter(r => sameDay(r.start, now));
  const paidFeed = db.charges.filter(c => c.paid).sort((a, b) => b.paid - a.paid).slice(0, 6);
  const newApps = db.apps.filter(a => a.status === 'new');
  const pendingCalls = db.events.filter(e => e.type === 'match' && e.start > now && Object.values(e.callup).includes('pending'));
  const injured = db.players.filter(p => activeInjury(p));
  const M = ym(now), monthCh = db.charges.filter(c => c.period === M), monthPaid = monthCh.filter(c => c.paid).reduce((a, c) => a + c.amount, 0), monthAll = monthCh.reduce((a, c) => a + c.amount, 0);

  const alerts = [
    overdue.length && { icon: 'coins', cls: 'bad', t: `${nOf(overduePeople, 'zawodnik', 'zawodników', 'zawodników')} z zaległą składką`, s: `razem ${zl(overdueSum)}`, href: '#/skladki?f=overdue', act: 'Przypomnij' },
    medBad.length && { icon: 'steth', cls: 'bad', t: `${nOf(medBad.length, 'nieważne badanie', 'nieważne badania', 'nieważnych badań')} lekarskie`, s: medBad.map(pname).join(', '), href: '#/zdrowie?t=med' },
    medWarn.length && { icon: 'steth', cls: 'warn', t: `${nOf(medWarn.length, 'badanie wygasa', 'badania wygasają', 'badań wygasa')} w ciągu 30 dni`, s: 'Przypomnienie wyślesz rodzicom jednym kliknięciem', href: '#/zdrowie?t=med' },
    newApps.length && { icon: 'form', cls: 'info', t: `${nOf(newApps.length, 'nowe zgłoszenie', 'nowe zgłoszenia', 'nowych zgłoszeń')} w naborze`, s: newApps.map(a => a.child).join(', '), href: '#/nabory' },
    injured.length && { icon: 'bandage', cls: 'warn', t: `${nOf(injured.length, 'zawodnik', 'zawodników', 'zawodników')} po urazie`, s: injured.map(p => `${pname(p)} (${team(p.team).cat})`).join(', '), href: '#/zdrowie?t=inj' },
    pendingCalls.length && { icon: 'flag', cls: 'info', t: 'Powołania bez odpowiedzi', s: pendingCalls.map(e => `${team(e.team).cat}: ${Object.values(e.callup).filter(v => v === 'pending').length}`).join(' · '), href: `#/wydarzenie/${pendingCalls[0].id}?t=call` },
  ].filter(Boolean);

  const facToday = FACILITIES.map(f => {
    const mins = [...todays.filter(e => e.fac?.includes(f.id)), ...todayRes.filter(r => r.fac.includes(f.id))].reduce((a, x) => a + (x.end - x.start) / MIN, 0);
    return { f, pct: Math.round((mins / (14 * 60)) * 100) };
  });

  app.innerHTML = `<div class="page">
    ${pageHead(fmtLong(now), `Dzień dobry, ${VOC.anna}`, `<a class="btn btn--ghost" href="#/komunikacja?t=mass">${ic('send')} Wiadomość do rodziców</a><a class="btn btn--primary" href="#/kalendarz?new=1">${ic('plus')} Wydarzenie</a>`)}
    <div class="kpis">
      ${kpi('Zawodnicy', players, `${TEAMS.length} drużyny · ${db.parents.length} rodziców`, '', '#/zawodnicy')}
      ${kpi('Frekwencja · 30 dni', `${attAll}%`, att.map(a => `${a.t.cat} ${a.pct}%`).join(' · '), '', '#/kalendarz')}
      ${kpi(`Składki · ${ymLabel(M)}`, `${pct(monthPaid, monthAll)}%`, `${zl(monthPaid)} z ${zl(monthAll)}`, '', '#/skladki')}
      ${kpi('Zaległości', zl(overdueSum), nOf(overduePeople, 'osoba', 'osoby', 'osób'), overdue.length ? 'kpi--bad' : '', '#/skladki?f=overdue')}
    </div>
    <div class="grid2">
      <div class="col">
        ${card(`Dziś w klubie <small>${nOf(todays.length, 'wydarzenie', 'wydarzenia', 'wydarzeń')}</small>`, todays.length ? `<div class="elist">${todays.map(e => eventRow(e)).join('')}</div>` : '<p class="empty-s">Dziś bez zajęć.</p>', { action: '<a class="link" href="#/obiekty">Grafik obiektów</a>' })}
        ${card('Wpłaty', `<ul class="feed">${paidFeed.map(c => { const p = player(c.player); return `<li><span class="feed__i">${ic(c.method === 'online' ? 'phone' : c.method === 'przelew' ? 'bank' : 'coins')}</span><span><b>${zl(c.amount)}</b> · ${esc(pname(p))} <small>${team(p.team).cat} · ${ymShort(c.period)} · ${PAY_METHOD[c.method]}</small></span><time>${ago(c.paid)}</time></li>`; }).join('')}</ul>`, { action: '<a class="link" href="#/skladki?t=report">Raport</a>' })}
      </div>
      <div class="col">
        ${card('Wymaga uwagi', alerts.length ? `<ul class="alerts">${alerts.map(a => `<li><a href="${a.href}" class="alert alert--${a.cls}"><span class="alert__i">${ic(a.icon)}</span><span><b>${a.t}</b><small>${esc(a.s)}</small></span>${ic('right', 'i--sm')}</a></li>`).join('')}</ul>` : '<p class="empty-s">Wszystko pod kontrolą.</p>')}
        ${card('Frekwencja drużyn · 30 dni', `<ul class="bars">${att.map(a => `<li><span>${teamTag(a.t.id)} ${a.t.name}</span>${meter(a.pct, 100, 'meter--team')}<b>${a.pct}%</b></li>`).join('')}</ul>`)}
        ${card('Obłożenie obiektów dziś', `<ul class="bars">${facToday.map(x => `<li><span>${x.f.short}</span>${meter(x.pct)}<b>${x.pct}%</b></li>`).join('')}</ul><p class="muted small">Dzień liczony 8:00–22:00.</p>`, { action: '<a class="link" href="#/obiekty">Rezerwacje</a>' })}
      </div>
    </div></div>`;
  $$('.meter--team', app).forEach((m, i) => m.style.setProperty('--c', TEAMS[i].color));
}

function dashCoach() {
  const now = Date.now(), mine = myTeamIds();
  const todays = db.events.filter(e => mine.includes(e.team) && sameDay(e.start, now)).sort((a, b) => a.start - b.start);
  const nextMatches = mine.map(t => db.events.find(e => e.team === t && e.type === 'match' && e.start > now)).filter(Boolean);
  const upcoming = db.events.filter(e => mine.includes(e.team) && e.start > now && !sameDay(e.start, now)).slice(0, 5);
  const absences = db.events.filter(e => mine.includes(e.team) && e.start > now && e.start < now + 7 * DAY)
    .flatMap(e => Object.entries(e.absences).map(([pid, a]) => ({ e, p: player(pid), a }))).filter(x => x.a.by !== 'ola');
  const myPlayers = db.players.filter(p => mine.includes(p.team));
  const inj = myPlayers.filter(p => activeInjury(p));
  const med = myPlayers.filter(p => medStatus(p).cls !== 'ok');
  const loadFlags = myPlayers.filter(p => team(p.team).load).map(p => ({ p, a: acwr(p.id) })).filter(x => x.a.cls === 'bad' || x.a.cls === 'warn');

  const todayCard = e => {
    const pl = e.plan ? planById(e.plan) : null, done = Object.keys(e.att).length;
    return `<article class="today" style="--c:${teamColor(e.team)}">
      <div class="today__h">${teamTag(e.team)} <b>${esc(e.title)}</b><span class="muted">${fmtRange(e.start, e.end)} · ${esc(facNames(e.fac) || e.place || '')}</span></div>
      ${e.type === 'training' ? `<p class="today__plan">${pl ? `${ic('book')} <a href="#/konspekt/${pl.id}">${esc(pl.title)}</a> · ${pl.blocks.length} ćwiczeń, ${pl.blocks.reduce((a, b) => a + b.min, 0)} min` : `${ic('alert')} Brak konspektu — <a href="#/konspekt/new?event=${e.id}">dodaj</a>`}</p>` : ''}
      <div class="today__a">
        <a class="btn ${done ? 'btn--ghost' : 'btn--primary'}" href="#/wydarzenie/${e.id}?t=${e.type === 'match' ? 'live' : 'att'}">${ic(e.type === 'match' ? 'bolt' : 'check')} ${e.type === 'match' ? 'Relacja na żywo' : done ? `Obecność zapisana · ${Object.values(e.att).filter(v => v === 'present' || v === 'late').length}/${done}` : 'Sprawdź obecność'}</a>
        ${e.type === 'training' && isPast(e) && !e.eval ? `<a class="btn btn--ghost" href="#/wydarzenie/${e.id}?t=eval">${ic('star')} Oceń trening</a>` : ''}
        ${e.type === 'training' && team(e.team).load ? `<a class="btn btn--ghost" href="#/wydarzenie/${e.id}?t=rpe">${ic('gauge')} RPE</a>` : ''}
      </div></article>`;
  };
  const matchCard = e => {
    const v = Object.values(e.callup), yes = v.filter(x => x === 'yes').length, no = v.filter(x => x === 'no').length, pend = v.filter(x => x === 'pending').length;
    return `<a class="mcard" href="#/wydarzenie/${e.id}?t=call" style="--c:${teamColor(e.team)}">
      <span class="mcard__t">${teamTag(e.team)} ${relDay(e.start)} · ${fmtTime(e.start)} · ${e.home ? 'u siebie' : 'wyjazd'}</span>
      <b>${esc(e.opp)}</b>
      ${v.length ? `<span class="callbar"><i class="ok" style="flex:${yes}"></i><i class="bad" style="flex:${no}"></i><i class="pend" style="flex:${pend}"></i></span>
        <small>${ic('check', 'i--xs')} ${yes} potwierdzonych · ${ic('x', 'i--xs')} ${no} · ${pend} bez odpowiedzi</small>` : `<small class="warn-t">${ic('alert', 'i--xs')} Powołania nie zostały wysłane</small>`}
    </a>`;
  };

  app.innerHTML = `<div class="page">
    ${pageHead(fmtLong(now), `Cześć, ${VOC.marek}`, `<a class="btn btn--ghost" href="#/tablica/new">${ic('board')} Tablica</a><a class="btn btn--primary" href="#/konspekt/new">${ic('plus')} Konspekt</a>`, myTeams().map(t => `${teamTag(t.id)} ${t.name} · ${teamPlayers(t.id).length} zaw.`).join(' &nbsp; '))}
    <div class="grid2 grid2--wide">
      <div class="col">
        <section class="card"><header class="card__h"><h2>Dzisiaj</h2></header>${todays.length ? todays.map(todayCard).join('') : '<p class="empty-s">Dziś bez zajęć Twoich drużyn.</p>'}</section>
        ${card('Następne', `<div class="elist">${upcoming.map(e => eventRow(e)).join('')}</div>`, { action: '<a class="link" href="#/kalendarz">Kalendarz</a>' })}
      </div>
      <div class="col">
        ${card('Najbliższe mecze', nextMatches.map(matchCard).join(''))}
        ${card('Zdrowie i obciążenie', `<ul class="alerts">
          ${inj.map(p => { const i = activeInjury(p); return `<li><a class="alert alert--${INJ[i.status].cls}" href="#/zawodnik/${p.id}?t=health"><span class="alert__i">${ic('bandage')}</span><span><b>${esc(pname(p))} · ${team(p.team).cat}</b><small>${esc(i.type)} · ${INJ[i.status].label}${i.back ? `, powrót ok. ${fmtDay(i.back)}` : ''}</small></span></a></li>`; }).join('')}
          ${loadFlags.map(({ p, a }) => `<li><a class="alert alert--${a.cls}" href="#/zdrowie?t=load"><span class="alert__i">${ic('gauge')}</span><span><b>${esc(pname(p))} · ACWR ${num(a.ratio, 2)}</b><small>${ACWR_LABEL[a.cls]} — obciążenie z 7 dni dużo wyższe niż średnia z 4 tygodni</small></span></a></li>`).join('')}
          ${med.map(p => { const s = medStatus(p); return `<li><a class="alert alert--${s.cls}" href="#/zdrowie?t=med"><span class="alert__i">${ic('steth')}</span><span><b>${esc(pname(p))} · ${team(p.team).cat}</b><small>${s.label}</small></span></a></li>`; }).join('')}
        </ul>`)}
        ${absences.length ? card('Zgłoszone nieobecności', `<ul class="feed">${absences.map(x => `<li><span class="feed__i">${ic('user')}</span><span><b>${esc(pname(x.p))}</b> <small>${relDay(x.e.start)} ${fmtTime(x.e.start)} · ${esc(x.a.reason)} · zgłosił(a) ${esc(personName(x.a.by))}</small></span></li>`).join('')}</ul>`) : ''}
        ${card('Frekwencja · 30 dni', `<ul class="bars">${myTeams().map(t => { const a = teamAttendance(t.id); return `<li><span>${teamTag(t.id)} ${t.name}</span>${meter(a.pct)}<b>${a.pct}%</b></li>`; }).join('')}</ul>`)}
      </div>
    </div></div>`;
}

function dashParent() {
  const now = Date.now(), kids = myKids(), filt = sessionKid();
  const shown = kids.filter(k => !filt || k.id === filt);
  const ids = shown.map(k => k.id);
  const evs = db.events.filter(e => e.end > now && e.start < now + 8 * DAY && shown.some(k => k.team === e.team || e.team === 'all')).slice(0, 8);
  const todo = [];
  db.events.filter(e => e.type === 'match' && e.start > now).forEach(e => ids.forEach(pid => { if (e.callup[pid] === 'pending') todo.push({ kind: 'call', e, p: player(pid) }); }));
  const owed = shown.flatMap(k => overdueOf(k.id));
  if (owed.length) todo.push({ kind: 'fee', owed });
  shown.forEach(k => { const s = medStatus(k); if (s.cls !== 'ok') todo.push({ kind: 'med', p: k, s }); });
  const post = db.posts.filter(p => p.scope === 'club' || shown.some(k => k.team === p.scope)).sort((a, b) => b.at - a.at)[0];
  const kidIdx = id => kids.findIndex(k => k.id === id);

  app.innerHTML = `<div class="pp">
    <h1 class="pp__hello">Dzień dobry, ${VOC.kasia} <span aria-hidden="true">👋</span></h1>
    ${kidChips(kids, filt)}
    ${todo.length ? `<section class="pp__sec"><h2 class="pp__h">Do zrobienia <span class="count">${todo.length}</span></h2>${todo.map(t => {
      if (t.kind === 'call') return `<article class="todo todo--call" style="--c:${kidColor(t.p, kidIdx(t.p.id))}">
        <p class="todo__k">${ic('flag')} Powołanie · ${esc(t.p.first)}</p>
        <b class="todo__t">${esc(t.e.title)}</b>
        <p class="todo__s">${fmtLong(t.e.start)}, ${fmtTime(t.e.start)} · zbiórka ${t.e.meet} · ${t.e.home ? 'u siebie' : esc(t.e.place)}</p>
        <div class="todo__a"><button type="button" class="btn btn--primary btn--xl" data-callup="${t.e.id}:${t.p.id}:yes">${ic('check')} Będzie</button><button type="button" class="btn btn--ghost btn--xl" data-callup="${t.e.id}:${t.p.id}:no">${ic('x')} Nie może</button></div></article>`;
      if (t.kind === 'fee') { const sum = t.owed.reduce((a, c) => a + c.amount, 0); return `<article class="todo todo--fee"><p class="todo__k">${ic('coins')} Zaległa składka</p><b class="todo__t">${zl(sum)}</b><p class="todo__s">${t.owed.map(c => `${player(c.player).first} · ${ymLabel(c.period)}`).join(', ')}</p><div class="todo__a"><a class="btn btn--primary btn--xl" href="#/skladki?pay=overdue">${ic('phone')} Zapłać BLIK-iem</a></div></article>`; }
      return `<article class="todo todo--med"><p class="todo__k">${ic('steth')} Badanie lekarskie · ${esc(t.p.first)}</p><b class="todo__t">${t.s.label}</b><p class="todo__s">Bez ważnego badania trener nie może wystawić zawodnika do meczu. Po wizycie wyślij zdjęcie zaświadczenia koordynatorce.</p><div class="todo__a"><a class="btn btn--ghost btn--xl" href="#/komunikacja?t=msg&c=t5">${ic('chat')} Napisz do koordynatorki</a></div></article>`;
    }).join('')}</section>` : `<p class="pp__ok">${ic('check')} Nic nie czeka na Ciebie.</p>`}
    <section class="pp__sec"><h2 class="pp__h">Najbliższe 7 dni</h2>
      <div class="agenda">${evs.map(e => agendaItem(e, shown)).join('') || '<p class="empty-s">Brak zajęć w tym tygodniu.</p>'}</div>
      <a class="link" href="#/kalendarz">Cały kalendarz ${ic('right', 'i--sm')}</a></section>
    ${post ? `<section class="pp__sec"><h2 class="pp__h">${post.scope === 'club' ? 'Ogłoszenie klubu' : `Szatnia ${team(post.scope).cat}`}</h2>${postCard(post, { compact: true })}</section>` : ''}
  </div>`;
  bindKidChips();
  bindCallupButtons();
}

// The parent picks a child (or all) — remembered per tab
function sessionKid() { try { return sessionStorage.getItem('gwizdek-kid') || ''; } catch (e) { return ''; } }
function kidChips(kids, filt) {
  return `<div class="kids" role="radiogroup" aria-label="Dziecko">
    <button type="button" role="radio" aria-checked="${!filt}" class="kid ${!filt ? 'is-on' : ''}" data-kid="">Wszystkie</button>
    ${kids.map((k, i) => `<button type="button" role="radio" aria-checked="${filt === k.id}" class="kid ${filt === k.id ? 'is-on' : ''}" data-kid="${k.id}" style="--c:${kidColor(k, i)}"><i></i>${esc(k.first)} <small>${team(k.team).cat}</small></button>`).join('')}</div>`;
}
function bindKidChips() {
  $$('[data-kid]', app).forEach(b => b.addEventListener('click', () => { try { sessionStorage.setItem('gwizdek-kid', b.dataset.kid); } catch (e) {} render(); }));
}

function agendaItem(e, kids) {
  const all = myKids(), who = kids.filter(k => k.team === e.team || e.team === 'all');
  const abs = who.filter(k => e.absences[k.id]);
  const call = who.map(k => e.callup?.[k.id]).filter(Boolean);
  return `<a class="ag" href="#/wydarzenie/${e.id}">
    <span class="ag__d"><b>${new Date(e.start).getDate()}</b><small>${WD_SHORT[new Date(e.start).getDay()]}</small></span>
    <span class="ag__b"><span class="ag__who">${who.map(k => `<i style="--c:${kidColor(k, all.indexOf(k))}">${esc(k.first)}</i>`).join('')}</span>
      <b>${esc(e.type === 'match' ? e.title : e.title)}</b><small>${fmtRange(e.start, e.end)} · ${esc(e.type === 'match' && !e.home ? e.place : facNames(e.fac) || '')}</small></span>
    ${abs.length ? badge('zgłoszona nieobecność', 'info') : call.includes('pending') ? badge('potwierdź', 'warn') : call.includes('yes') ? badge('potwierdzone', 'ok') : isLive(e) ? badge('trwa', 'live') : ''}
  </a>`;
}

function bindCallupButtons() {
  $$('[data-callup]', app).forEach(b => b.addEventListener('click', () => {
    const [eid, pid, ans] = b.dataset.callup.split(':');
    answerCallup(eid, pid, ans);
  }));
}
function answerCallup(eid, pid, ans) {
  mutate(d => {
    const e = d.events.find(x => x.id === eid), p = d.players.find(x => x.id === pid);
    e.callup[pid] = ans;
    addNote(d, team(e.team).coach, { title: ans === 'yes' ? 'Potwierdzenie powołania' : 'Odmowa powołania', body: `${pname(p)} — ${e.title}: ${ans === 'yes' ? 'będzie' : 'nie może'}.`, link: `#/wydarzenie/${eid}?t=call`, icon: 'flag' });
    d.notes.forEach(n => { if (n.to === me() && n.link.includes(eid) && !n.read) n.read = true; });
  });
  toast(ans === 'yes' ? `Zapisane: ${player(pid).first} będzie. Trener już wie.` : `Zapisane: ${player(pid).first} nie może. Trener dostał informację.`, ans === 'yes' ? 'check' : 'info');
  render();
}

// ---------- boot ----------
try { const t = store.get('gwizdek-theme', null); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
route();
