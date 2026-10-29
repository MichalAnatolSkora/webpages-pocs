// Peron v1 — app: state, search filters, the timetable, tender pages, season tickets (saved searches), the inbox and the router.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const store = {
  get(k, d) { try { const v = localStorage.getItem('peron-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('peron-' + k, JSON.stringify(v)); } catch (e) {} },
};

// ---------- formatting ----------
const PL = 'pl-PL';
const fmtMoney = v => Math.round(v).toLocaleString(PL) + ' zł';
const fmtTime = ms => new Date(ms).toLocaleTimeString(PL, { hour: '2-digit', minute: '2-digit' });
const fmtDate = ms => new Date(ms).toLocaleDateString(PL, { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDM = ms => new Date(ms).toLocaleDateString(PL, { day: '2-digit', month: '2-digit' });
const fmtDayLong = ms => new Date(ms).toLocaleDateString(PL, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtStamp = ms => `${fmtDate(ms)}, ${fmtTime(ms)}`;
function plural(n, a, b, c) { const d = n % 10, h = n % 100; return n === 1 ? a : d >= 2 && d <= 4 && (h < 12 || h > 14) ? b : c; }
const startOfDay = ms => new Date(ms).setHours(0, 0, 0, 0);
function dayLabel(ms) {
  const d = Math.round((startOfDay(ms) - startOfDay(Date.now())) / DAY);
  return d === 0 ? 'dziś' : d === 1 ? 'jutro' : d === 2 ? 'pojutrze' : d === -1 ? 'wczoraj' : d < 0 ? `${-d} dni temu` : `za ${d} dni`;
}
function left(ms) {
  const d = ms - Date.now();
  if (d <= 0) return 'odjechał';
  const m = Math.floor(d / MIN);
  if (m < 60) return `za ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `za ${h} h ${m % 60} min`;
  const days = Math.floor(h / 24);
  return `za ${days} ${plural(days, 'dzień', 'dni', 'dni')}${days < 7 && h % 24 ? ` ${h % 24} h` : ''}`;
}
const urgency = t => { const h = (t.deadline - Date.now()) / HOUR; return h < 24 ? 'red' : h < 72 ? 'amber' : ''; };
const isNew = t => Date.now() - t.published < 2 * DAY;
const isOpen = t => t.deadline > Date.now();

// ---------- state ----------
const S = {
  watch: new Set(store.get('watch', [])),
  extra: store.get('extra', []),
  patches: store.get('patches', {}),
  tickets: store.get('tickets', null),
  inbox: store.get('inbox', null),
  f: emptyF(),
  sort: 'deadline',
  limit: 40,
  draft: null,
};
let ALL = [], BY_ID = new Map();
function reindex() {
  ALL = TENDERS.concat(S.extra);
  ALL.forEach(t => {
    const p = S.patches[t.id];
    if (p) Object.assign(t, p);
    t._hay = norm([t.title, t.buyer.name, t.buyer.town, t.buyer.woj, t.cpv[0], t.cpv[1], GROUP[t.group].label, t.no].join(' '));
  });
  BY_ID = new Map(ALL.map(t => [t.id, t]));
}
reindex();
const saveWatch = () => store.set('watch', [...S.watch]);
const saveTickets = () => store.set('tickets', S.tickets);
const saveInbox = () => store.set('inbox', S.inbox);

// ---------- filters ----------
function emptyF() { return { q: '', kind: [], groups: [], woj: [], val: '', within: '', ue: '', wad: '' }; }
const VAL = [['', 'dowolny'], ['lt500', 'do 500 tys. zł'], ['500-2', '500 tys. – 2 mln'], ['2-10', '2 – 10 mln'], ['gt10', 'ponad 10 mln']];
const VAL_TEST = { lt500: v => v < 5e5, '500-2': v => v >= 5e5 && v < 2e6, '2-10': v => v >= 2e6 && v < 1e7, gt10: v => v >= 1e7 };
const WITHIN = [['', 'dowolny'], ['2', '48 godzin'], ['7', '7 dni'], ['14', '14 dni'], ['30', '30 dni']];
const UE = [['', 'wszystkie'], ['kraj', 'krajowe (BZP)'], ['ue', 'unijne (TED)']];
const WAD = [['', 'obojętne'], ['bez', 'bez wadium']];
const FREQ = { instant: 'Od razu po publikacji', daily: 'Codziennie o 7:00', weekly: 'W poniedziałki o 7:00' };
const CHANNEL = { email: ['E-mail', 'ty@firma.example'], sms: ['SMS', '+48 600 000 000'], webhook: ['Webhook', 'https://firma.example/hooks/przetargi'] };

function matches(t, f, skip) {
  if (f.q && skip !== 'q') { const toks = norm(f.q).split(/\s+/).filter(Boolean); if (!toks.every(w => t._hay.includes(w))) return false; }
  if (f.kind.length && skip !== 'kind' && !f.kind.includes(t.kind)) return false;
  if (f.groups.length && skip !== 'groups' && !f.groups.includes(t.group)) return false;
  if (f.woj.length && skip !== 'woj' && !f.woj.includes(t.buyer.woj)) return false;
  if (f.val && skip !== 'val' && !VAL_TEST[f.val](t.value)) return false;
  if (f.within && skip !== 'within' && t.deadline - Date.now() > +f.within * DAY) return false;
  if (f.ue && skip !== 'ue' && (f.ue === 'ue') !== t.ue) return false;
  if (f.wad && skip !== 'wad' && t.wadium) return false;
  return true;
}
const fActive = f => !!(f.q || f.kind.length || f.groups.length || f.woj.length || f.val || f.within || f.ue || f.wad);
function fToQS(f) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  [['kind', 'kind'], ['groups', 'g'], ['woj', 'woj']].forEach(([k, n]) => f[k].length && p.set(n, f[k].join(',')));
  [['val', 'val'], ['within', 'in'], ['ue', 'ue'], ['wad', 'wad']].forEach(([k, n]) => f[k] && p.set(n, f[k]));
  return p.toString().replace(/%2C/g, ',');
}
function fFromParams(p) {
  const f = emptyF(), list = s => (s || '').split(',').filter(Boolean);
  f.q = p.q || ''; f.kind = list(p.kind); f.groups = list(p.g); f.woj = list(p.woj);
  f.val = p.val || ''; f.within = p.in || ''; f.ue = p.ue || ''; f.wad = p.wad || '';
  return f;
}
function describe(f) {
  const parts = [];
  if (f.groups.length) parts.push(f.groups.map(g => GROUP[g].label).join(', '));
  else if (f.kind.length) parts.push(f.kind.map(k => KIND[k]).join(', '));
  else parts.push('wszystkie branże');
  if (f.groups.length && f.kind.length) parts.push(f.kind.map(k => KIND[k].toLowerCase()).join(', '));
  parts.push(f.woj.length ? (f.woj.length <= 3 ? f.woj.join(', ') : `${f.woj.length} województw`) : 'cała Polska');
  if (f.val) parts.push('budżet ' + VAL.find(v => v[0] === f.val)[1]);
  if (f.ue) parts.push(UE.find(v => v[0] === f.ue)[1]);
  if (f.wad) parts.push('bez wadium');
  return parts.join(' · ');
}
function shortName(f) {
  const a = [];
  if (f.q) a.push(`„${f.q}”`);
  if (f.groups.length) a.push(f.groups.map(g => GROUP[g].label.split(/[ ,:]/)[0]).join(' + '));
  else if (f.kind.length) a.push(f.kind.map(k => KIND[k]).join(' + '));
  a.push(f.woj.length === 1 ? f.woj[0] : f.woj.length ? `${f.woj.length} woj.` : 'cała Polska');
  return a.join(' · ');
}

// ---------- tickets & inbox seed ----------
if (!S.tickets) {
  S.tickets = [
    { id: 'k1', no: '0031', name: 'Drogi na południu', f: Object.assign(emptyF(), { groups: ['drogi'], woj: ['małopolskie', 'podkarpackie', 'śląskie'], val: '' }), freq: 'daily', channel: 'email', dest: 'oferty@drogbud.example', created: atDay(TODAY0, -12, 9 * 60), paused: false },
    { id: 'k2', no: '0047', name: 'IT dla samorządów', f: Object.assign(emptyF(), { groups: ['it'], wad: '' }), freq: 'instant', channel: 'email', dest: 'handel@bajtsoft.example', created: atDay(TODAY0, -3, 14 * 60), paused: false },
  ];
  saveTickets();
}
if (!S.inbox) {
  const at = TODAY0 + 7 * HOUR <= Date.now() ? TODAY0 + 7 * HOUR : TODAY0 - DAY + 7 * HOUR;
  S.inbox = S.tickets.map(tk => {
    const ids = ALL.filter(t => t.published <= at && t.published > at - DAY && isOpen(t) && matches(t, tk.f)).map(t => t.id);
    return ids.length ? { id: 'm' + tk.id, at, kind: 'digest', ticket: tk.id, ids, read: false } : null;
  }).filter(Boolean);
  saveInbox();
}

// ---------- icons ----------
const ICON = {
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="1"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  ticket: '<path d="M3.5 7.5h17v3a2 2 0 0 0 0 3v3h-17v-3a2 2 0 0 0 0-3z"/><path d="M14.5 7.5v9" stroke-dasharray="1.6 1.8"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const peronBox = g => `<span class="pbox" title="Peron ${GROUP[g].peron}: ${esc(GROUP[g].label)}">${GROUP[g].peron}</span>`;

// ---------- toasts & modal ----------
function toast(html, tone) {
  const el = document.createElement('div');
  el.className = 'toast' + (tone ? ' toast--' + tone : '');
  el.innerHTML = html;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('is-out'), 4200);
  setTimeout(() => el.remove(), 4700);
}
let lastFocus = null;
function openModal(html, wide) {
  lastFocus = document.activeElement;
  $('#modalRoot').innerHTML = `<div class="modal" data-act="backdrop"><div class="modal__box${wide ? ' modal__box--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mTitle">${html}</div></div>`;
  document.body.classList.add('has-modal');
  const f = $('#modalRoot [autofocus]') || $('#modalRoot button, #modalRoot input');
  f && f.focus();
}
function closeModal() {
  $('#modalRoot').innerHTML = '';
  document.body.classList.remove('has-modal');
  S.draft = null;
  lastFocus && lastFocus.focus && lastFocus.focus();
}

// ---------- departures board (home) ----------
function boardCols() {
  const w = innerWidth;
  if (w >= 1100) return [{ key: 'time', label: 'Godz.', w: 5 }, { key: 'date', label: 'Data', w: 5 }, { key: 'town', label: 'Kierunek', w: 14 }, { key: 'title', label: 'Przetarg', w: 25 }, { key: 'peron', label: 'Per.', w: 2 }, { key: 'note', label: 'Uwagi', w: 13 }];
  if (w >= 700) return [{ key: 'time', label: 'Godz.', w: 5 }, { key: 'date', label: 'Data', w: 5 }, { key: 'title', label: 'Przetarg', w: 18 }, { key: 'peron', label: 'Per.', w: 2 }, { key: 'note', label: 'Uwagi', w: 12 }];
  return [{ key: 'time', label: 'Godz.', w: 5 }, { key: 'title', label: 'Przetarg', w: 13 }, { key: 'peron', label: 'P.', w: 2 }];
}
function boardRows() {
  return ALL.filter(isOpen).sort((a, b) => a.deadline - b.deadline).slice(0, 8).map(t => {
    const h = (t.deadline - Date.now()) / HOUR;
    const note = h < 24 ? left(t.deadline).replace('za ', '') : t.moved ? 'PRZESUNIĘTY' : dayLabel(t.deadline);
    return {
      id: t.id, href: '#/p/' + t.id, time: fmtTime(t.deadline), date: fmtDM(t.deadline), town: t.buyer.town,
      title: t.title,
      peron: String(GROUP[t.group].peron).padStart(2, ' '), note,
      tone: h < 24 ? 'red' : t.moved ? 'amber' : '',
      label: `${fmtTime(t.deadline)} ${fmtDM(t.deadline)}, ${t.title}, ${t.buyer.name}, ${note}`,
    };
  });
}
let boardTier = '';
function sizeBoard(el, cols) {
  // cell width so the tier fills the board: a cell plus its gap is 1.1 cells, a column gap 0.9 of one
  const cells = cols.reduce((a, c) => a + c.w * 1.1 - 0.1, 0) + (cols.length - 1) * 0.9;
  el.style.setProperty('--cw', Math.min(25, Math.floor((el.clientWidth - 24) / cells * 10) / 10) + 'px');
}
function mountBoard() {
  const el = $('#board');
  if (!el) return;
  const cols = boardCols();
  boardTier = cols.map(c => c.key).join();
  sizeBoard(el, cols);
  Board.mount(el, cols, boardRows());
}

// ---------- facets ----------
function facets(f, scope) {
  const pool = ALL.filter(isOpen);
  const cnt = (key, test) => pool.filter(t => matches(t, f, key) && test(t)).length;
  const box = (key, val, label, n, extra = '') => `<label class="opt"><input type="checkbox" data-f="${key}" data-scope="${scope}" value="${esc(val)}"${f[key].includes(val) ? ' checked' : ''}><span class="opt__box" aria-hidden="true"></span>${extra}<span class="opt__l">${label}</span><span class="opt__n" data-cnt="${key}:${esc(val)}">${n}</span></label>`;
  const radio = (key, opts) => opts.map(([v, l]) => `<label class="opt opt--r"><input type="radio" name="${scope}-${key}" data-f="${key}" data-scope="${scope}" value="${v}"${f[key] === v ? ' checked' : ''}><span class="opt__box" aria-hidden="true"></span><span class="opt__l">${l}</span></label>`).join('');
  const wojs = WOJ.map(w => [w, cnt('woj', t => t.buyer.woj === w)]);
  return `
    <fieldset class="fs"><legend>Rodzaj zamówienia</legend>${KINDS.map(([k, l]) => box('kind', k, l, cnt('kind', t => t.kind === k))).join('')}</fieldset>
    <fieldset class="fs"><legend>Peron · branża</legend>${GROUPS.map(g => box('groups', g.key, esc(g.label), cnt('groups', t => t.group === g.key), peronBox(g.key))).join('')}</fieldset>
    <fieldset class="fs fs--woj"><legend>Województwo${f.woj.length ? ` <em>· ${f.woj.length}</em>` : ''}</legend><div class="fs__cols">${wojs.map(([w, n]) => box('woj', w, w, n)).join('')}</div></fieldset>
    <fieldset class="fs"><legend>Budżet zamawiającego</legend>${radio('val', VAL)}</fieldset>
    ${scope === 's' ? `<fieldset class="fs"><legend>Termin składania ofert</legend>${radio('within', WITHIN)}</fieldset>` : ''}
    <fieldset class="fs"><legend>Ogłoszenie</legend>${radio('ue', UE)}</fieldset>
    <fieldset class="fs"><legend>Wadium</legend>${radio('wad', WAD)}</fieldset>`;
}
function updateCounts(f, scope) {
  const pool = ALL.filter(isOpen);
  $$(`[data-scope="${scope}"][type=checkbox]`).forEach(inp => {
    const key = inp.dataset.f, v = inp.value;
    const n = pool.filter(t => matches(t, f, key) && (key === 'woj' ? t.buyer.woj : key === 'kind' ? t.kind : t.group) === v).length;
    const el = inp.parentElement.querySelector('.opt__n');
    if (el) el.textContent = n;
    inp.parentElement.classList.toggle('is-zero', !n && !inp.checked);
  });
}

// ---------- timetable rows ----------
function marks(t) {
  const m = [];
  if (isNew(t)) m.push('<abbr class="mk mk--new" title="Nowy: opublikowany w ciągu 48 godzin">N</abbr>');
  if (t.moved) m.push('<abbr class="mk mk--moved" title="Termin składania ofert przesunięty">P</abbr>');
  if (t.wadium) m.push(`<abbr class="mk" title="Wadium ${fmtMoney(t.wadium)}">W</abbr>`);
  if (t.ue) m.push('<abbr class="mk mk--ue" title="Ogłoszenie w Dzienniku Urzędowym UE">UE</abbr>');
  if (t.lots.length) m.push(`<abbr class="mk" title="${t.lots.length} ${plural(t.lots.length, 'część', 'części', 'części')}: można złożyć ofertę na wybrane">${t.lots.length}cz</abbr>`);
  return m.join('');
}
function depRow(t) {
  const on = S.watch.has(t.id);
  return `<article class="dep ${isOpen(t) ? 'is-' + urgency(t) : 'is-gone'}">
    <div class="dep__time"><b>${fmtTime(t.deadline)}</b>${t.moved ? `<s title="Pierwotny termin">${fmtTime(t.moved.from)} ${fmtDM(t.moved.from)}</s>` : ''}</div>
    <div class="dep__peron">${peronBox(t.group)}</div>
    <div class="dep__main">
      <h3 class="dep__title"><a href="#/p/${t.id}">${esc(t.title)}</a></h3>
      <p class="dep__buyer">${esc(t.buyer.name)} <span>· ${esc(t.buyer.woj)}</span></p>
      <p class="dep__via"><span class="mono">${t.cpv[0]}</span> ${esc(t.cpv[1])} — ${esc(t.tryb)}</p>
    </div>
    <div class="dep__side">
      <p class="dep__val">${fmtMoneyShort(t.value)}</p>
      <p class="dep__marks">${marks(t)}</p>
      <p class="dep__left" data-left="${t.deadline}">${left(t.deadline)}</p>
    </div>
    <button type="button" class="star${on ? ' is-on' : ''}" data-act="watch" data-id="${t.id}" aria-pressed="${on}" aria-label="${on ? 'Usuń z obserwowanych' : 'Obserwuj'}: ${esc(t.title)}">${icon('star')}</button>
  </article>`;
}
function poster(list, opts = {}) {
  const grouped = opts.group !== false;
  let html = '', lastDay = null;
  list.forEach(t => {
    const d = startOfDay(t.deadline);
    if (grouped && d !== lastDay) {
      lastDay = d;
      const n = list.filter(x => startOfDay(x.deadline) === d).length;
      html += `<h3 class="poster__day"><span>${fmtDayLong(t.deadline)}</span><span>${dayLabel(t.deadline)} · ${n} ${plural(n, 'odjazd', 'odjazdy', 'odjazdów')}</span></h3>`;
    }
    html += depRow(t);
  });
  return `<div class="poster${opts.cls ? ' ' + opts.cls : ''}">
    <header class="poster__head">
      <div><h2 class="poster__h">${opts.title || 'Odjazdy'}</h2><p class="poster__en">${opts.sub || 'Departures · terminy składania ofert'}</p></div>
      <p class="poster__valid">Ważny od ${fmtDate(Date.now())}<br>do odwołania</p>
    </header>
    <div class="poster__cols" aria-hidden="true"><span>godz.</span><span>peron</span><span>przetarg · zamawiający · CPV</span><span>budżet · uwagi</span></div>
    ${html || `<p class="poster__empty">${opts.empty || 'Brak odjazdów na tej trasie.'}</p>`}
    ${opts.more || ''}
    <footer class="poster__legend"><b>Objaśnienia znaków:</b> <span><i class="mk mk--new">N</i> nowy, do 48 h od publikacji</span> <span><i class="mk mk--moved">P</i> termin przesunięty</span> <span><i class="mk">W</i> wymagane wadium</span> <span><i class="mk mk--ue">UE</i> powyżej progów unijnych</span> <span><i class="mk">3cz</i> zamówienie w częściach</span> <span>${peronBox('drogi')} peron, czyli branża</span></footer>
  </div>`;
}

// ---------- home: board + search ----------
function searchList() {
  const list = ALL.filter(t => isOpen(t) && matches(t, S.f));
  const by = { deadline: (a, b) => a.deadline - b.deadline, new: (a, b) => b.published - a.published, value: (a, b) => b.value - a.value };
  return list.sort(by[S.sort]);
}
function renderHome() {
  const open = ALL.filter(isOpen);
  const latestMove = ALL.filter(t => t.moved && isOpen(t)).sort((a, b) => b.moved.at - a.moved.at)[0];
  return `
  <section class="hero">
    <div class="wrap">
      <div class="hero__top">
        <h1 class="hero__h">Każdy przetarg ma swoją godzinę odjazdu.</h1>
        <div class="hero__side">
          <p class="hero__lead">${open.length} otwartych postępowań z BZP i TED, ułożonych według terminu składania ofert. Wyznacz trasę, kup bilet okresowy, a nowe przetargi same przyjadą do Twojej skrzynki.</p>
          <form class="q" data-form="q" role="search">
            <label for="q" class="q__l">Dokąd?</label>
            <input id="q" type="search" autocomplete="off" placeholder="np. kanalizacja, laptopy, 45233140, Lipowiec" value="${esc(S.f.q)}">
            <button class="q__btn" type="submit">Szukaj</button>
          </form>
        </div>
      </div>
      <div class="station">
        <div class="station__top"><span class="station__t">Odjazdy</span><span class="station__s">najbliższe terminy składania ofert · wszystkie perony</span><span class="station__clock" id="boardClock">${new Date().toLocaleTimeString(PL)}</span></div>
        <div class="board" id="board" aria-label="Tablica: najbliższe terminy składania ofert"></div>
        ${latestMove ? `<div class="station__ticker"><span class="station__tag">Komunikat</span><div class="station__run"><span>Zmiana terminu: postępowanie „${esc(latestMove.title)}” (${esc(latestMove.buyer.name)}). Oferty przyjmowane do ${fmtDayLong(latestMove.deadline)}, godz. ${fmtTime(latestMove.deadline)}, zamiast ${fmtDM(latestMove.moved.from)}. Przepraszamy za utrudnienia.</span></div></div>` : ''}
      </div>
    </div>
  </section>
  <section class="wrap search" id="szukaj">
    <div class="search__grid">
      <aside class="rail" id="rail" aria-label="Filtry">
        <div class="rail__head"><h2 class="rail__h">Trasa</h2><button type="button" class="link" data-act="clear">Wyczyść</button><button type="button" class="rail__close" data-act="filters" aria-label="Zamknij filtry">${icon('x')}</button></div>
        <div id="facets">${facets(S.f, 's')}</div>
        <div class="rail__foot"><button type="button" class="btn btn--y btn--block" data-act="filters">Pokaż wyniki</button></div>
      </aside>
      <div id="results">${renderResults()}</div>
    </div>
  </section>`;
}
function renderResults() {
  const list = searchList();
  const sum = list.reduce((a, t) => a + t.value, 0);
  const week = ALL.filter(t => t.published > Date.now() - 28 * DAY && matches(t, Object.assign({}, S.f, { within: '' }))).length / 4;
  const nF = S.f.kind.length + S.f.groups.length + S.f.woj.length + ['val', 'within', 'ue', 'wad'].filter(k => S.f[k]).length;
  const tags = [];
  if (S.f.q) tags.push(['q', '', `„${S.f.q}”`]);
  S.f.kind.forEach(k => tags.push(['kind', k, KIND[k]]));
  S.f.groups.forEach(g => tags.push(['groups', g, `Peron ${GROUP[g].peron} · ${GROUP[g].label}`]));
  S.f.woj.forEach(w => tags.push(['woj', w, w]));
  [['val', VAL], ['within', WITHIN], ['ue', UE], ['wad', WAD]].forEach(([k, o]) => S.f[k] && tags.push([k, '', (k === 'within' ? 'termin: ' : k === 'val' ? 'budżet: ' : '') + o.find(x => x[0] === S.f[k])[1]]));
  const more = list.length > S.limit ? `<p class="poster__more"><button type="button" class="btn" data-act="more">Pokaż kolejne ${Math.min(40, list.length - S.limit)} z ${list.length - S.limit}</button></p>` : '';
  return `
    <div class="res-bar">
      <p class="res-bar__n"><b>${list.length}</b> ${plural(list.length, 'odjazd', 'odjazdy', 'odjazdów')} na tej trasie <span>· łączny budżet ${fmtMoneyShort(sum)}</span></p>
      <div class="res-bar__r">
        <button type="button" class="btn btn--filters" data-act="filters">${icon('filter')} Filtry${nF ? ` <b>${nF}</b>` : ''}</button>
        <label class="sel">Sortuj <select data-sort>${[['deadline', 'wg godziny odjazdu'], ['new', 'najnowsze ogłoszenia'], ['value', 'największy budżet']].map(([v, l]) => `<option value="${v}"${S.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
    </div>
    ${tags.length ? `<p class="tags">${tags.map(([k, v, l]) => `<button type="button" class="tag" data-act="untag" data-k="${k}" data-v="${esc(v)}">${esc(l)} ${icon('x')}</button>`).join('')}</p>` : ''}
    <div class="buy">
      <div class="buy__t"><p class="buy__h">${fActive(S.f) ? 'Jeździsz tą trasą częściej?' : 'Wyznacz trasę i kup na nią bilet okresowy'}</p>
      <p>${fActive(S.f) ? `Na trasie <b>${esc(describe(S.f))}</b> pojawia się ok. <b>${Math.max(1, Math.round(week))}</b> ${plural(Math.max(1, Math.round(week)), 'nowy przetarg', 'nowe przetargi', 'nowych przetargów')} tygodniowo. Bilet okresowy powiadomi Cię o każdym.` : 'Zaznacz branżę i województwo w filtrach trasy. Zapisana trasa wyśle Ci komunikat o każdym nowym ogłoszeniu.'}</p></div>
      <button type="button" class="btn btn--ticket" data-act="buy">${icon('ticket')} Kup bilet na tę trasę</button>
    </div>
    ${poster(list.slice(0, S.limit), { group: S.sort === 'deadline', more, sub: S.sort === 'deadline' ? undefined : S.sort === 'new' ? 'Według daty ogłoszenia' : 'Według budżetu zamawiającego', empty: 'Na tej trasie nic dziś nie odjeżdża. Poluzuj filtry albo kup bilet okresowy, a damy znać, gdy coś się pojawi.' })}`;
}
function refreshSearch(keepFacets) {
  history.replaceState(null, '', '#/' + (fActive(S.f) ? '?' + fToQS(S.f) : '') + (S.sort !== 'deadline' ? (fActive(S.f) ? '&' : '?') + 'sort=' + S.sort : ''));
  $('#results').innerHTML = renderResults();
  if (keepFacets) updateCounts(S.f, 's');
  else $('#facets').innerHTML = facets(S.f, 's');
  const lg = $('.fs--woj legend');
  if (lg) lg.innerHTML = 'Województwo' + (S.f.woj.length ? ` <em>· ${S.f.woj.length}</em>` : '');
}

// ---------- tender page ----------
function stations(t) {
  const st = [
    { at: t.published, l: 'Ogłoszenie', d: t.ue ? 'Dz.U. UE i BZP' : 'Biuletyn Zamówień Publicznych' },
    { at: t.questions, l: 'Pytania do SWZ', d: 'wnioski o wyjaśnienia' },
    { at: t.deadline, l: 'Składanie ofert', d: 'przez platformę e-Zamówienia', main: true },
    { at: t.deadline + 30 * MIN, l: 'Otwarcie ofert', d: 'jawne, online' },
    { at: t.deadline + 21 * DAY, l: 'Wybór oferty', d: 'szacunkowo', est: true },
    { at: t.deadline + 35 * DAY, l: 'Umowa', d: 'szacunkowo', est: true },
  ];
  if (t.moved) st.push({ at: t.moved.at, l: 'Zmiana SWZ', d: `termin z ${fmtDM(t.moved.from)} na ${fmtDM(t.deadline)}`, warn: true });
  st.sort((a, b) => a.at - b.at);
  const now = Date.now();
  const nextI = st.findIndex(s => s.at > now);
  return `<ol class="line" aria-label="Trasa postępowania">${st.map((s, i) => `<li class="line__st${s.at <= now ? ' is-past' : ''}${i === nextI ? ' is-next' : ''}${s.main ? ' is-main' : ''}${s.warn ? ' is-warn' : ''}">
      <span class="line__dot" aria-hidden="true"></span>
      <span class="line__when">${s.est ? '~' : ''}${fmtDM(s.at)}${s.est ? '' : `<small>${fmtTime(s.at)}</small>`}</span>
      <span class="line__l">${s.l}</span><span class="line__d">${s.d}</span>
      ${i === nextI ? `<span class="line__here">${s.at - now < 2 * DAY ? 'wkrótce' : 'teraz jedziemy tu'}</span>` : ''}
    </li>`).join('')}</ol>`;
}
function renderTender(id) {
  const t = BY_ID.get(id);
  if (!t) return `<section class="wrap page"><h1 class="h1">Nie ma takiego odjazdu</h1><p><a class="btn" href="#/">${icon('back')} Wróć do odjazdów</a></p></section>`;
  const on = S.watch.has(t.id), open = isOpen(t);
  const sim = ALL.filter(x => x.id !== t.id && isOpen(x) && x.group === t.group).sort((a, b) => (b.buyer.woj === t.buyer.woj) - (a.buyer.woj === t.buyer.woj) || a.deadline - b.deadline).slice(0, 4);
  const crit = t.criteria;
  return `<section class="wrap tp">
    <p class="crumbs"><a href="#/">${icon('back')} Odjazdy</a> <span>/</span> Peron ${GROUP[t.group].peron} · ${esc(GROUP[t.group].label)}</p>
    <header class="tp__head">
      <div class="tp__dep is-${open ? urgency(t) : 'gone'}">
        <p class="tp__dep-l">${open ? 'Odjazd' : 'Odjechał'}</p>
        <p class="tp__dep-t">${fmtTime(t.deadline)}</p>
        <p class="tp__dep-d">${fmtDayLong(t.deadline)}</p>
        ${t.moved ? `<p class="tp__dep-was">było: <s>${fmtDM(t.moved.from)}, ${fmtTime(t.moved.from)}</s></p>` : ''}
        <p class="tp__dep-left" data-left="${t.deadline}">${left(t.deadline)}</p>
        <div class="tp__dep-p"><span>peron</span>${peronBox(t.group)}</div>
      </div>
      <div class="tp__info">
        <p class="tp__no"><span class="mono">${t.no}</span> · ${esc(t.tryb)}</p>
        <h1 class="tp__h">${esc(t.title)}</h1>
        <p class="tp__buyer">${esc(t.buyer.name)} · ${esc(t.buyer.woj)}</p>
        <p class="tp__marks">${marks(t)}</p>
        <div class="tp__act">
          <button type="button" class="btn${on ? ' is-on' : ''}" data-act="watch" data-id="${t.id}" aria-pressed="${on}">${icon('star')} ${on ? 'Obserwujesz' : 'Obserwuj'}</button>
          <button type="button" class="btn" data-act="ics" data-id="${t.id}">${icon('cal')} Do kalendarza</button>
          <button type="button" class="btn" data-act="copy">${icon('link')} Kopiuj link</button>
          <button type="button" class="btn btn--ticket" data-act="buy-like" data-id="${t.id}">${icon('ticket')} Bilet na podobne</button>
        </div>
      </div>
    </header>
    <section class="tp__sec"><h2 class="h2">Trasa postępowania</h2>${stations(t)}</section>
    <div class="tp__grid">
      <div class="tp__body">
        <section class="tp__sec"><h2 class="h2">Przedmiot zamówienia</h2>
          <p>Przedmiotem zamówienia jest zadanie „${esc(t.title)}”. Zakres obejmuje w szczególności:</p>
          <ul class="dash">${t.scope.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
          <p>Termin realizacji: ${esc(t.period)}. Zamawiający ${t.lots.length ? 'dopuszcza składanie ofert częściowych' : 'nie dopuszcza ofert częściowych'} i nie przewiduje aukcji elektronicznej.</p>
        </section>
        ${t.lots.length ? `<section class="tp__sec"><h2 class="h2">Skład: ${t.lots.length} ${plural(t.lots.length, 'część', 'części', 'części')}</h2><p class="muted">Ofertę można złożyć na dowolną liczbę części. Każdy wagon to osobna umowa.</p>
          <div class="train" tabindex="0" aria-label="Części zamówienia"><div class="train__loco" aria-hidden="true"><span>${GROUP[t.group].peron}</span></div>${t.lots.map(l => `<div class="wagon"><span class="wagon__n">${l.n}</span><span class="wagon__name">${esc(l.name)}</span><span class="wagon__v">${fmtMoneyShort(l.value)}</span></div>`).join('')}</div></section>` : ''}
        <section class="tp__sec"><h2 class="h2">Warunki udziału</h2><ul class="dash">${t.reqs.map(s => `<li>${esc(s)}</li>`).join('')}<li>Brak podstaw wykluczenia z art. 108 ust. 1 ustawy Pzp</li></ul></section>
        <section class="tp__sec"><h2 class="h2">Kryteria oceny ofert</h2>
          <div class="crit">${crit.map(([n, w], i) => `<div class="crit__seg crit__seg--${i}" style="flex:${w}"><b>${w}%</b><span>${esc(n)}</span></div>`).join('')}</div></section>
        <section class="tp__sec"><h2 class="h2">Dokumenty</h2>
          <ul class="docs">${t.docs.map(d => `<li><button type="button" data-act="doc">${icon('file')}<span>${esc(d.name)}</span><em>${d.ext} · ${d.kb > 1024 ? (d.kb / 1024).toLocaleString(PL, { maximumFractionDigits: 1 }) + ' MB' : d.kb + ' kB'}</em></button></li>`).join('')}</ul></section>
      </div>
      <aside class="tp__facts">
        <dl class="facts">
          <div><dt>Budżet zamawiającego</dt><dd class="facts__big">${fmtMoney(t.value)}</dd></div>
          <div><dt>Wadium</dt><dd>${t.wadium ? fmtMoney(t.wadium) : 'nie wymagane'}</dd></div>
          <div><dt>Rodzaj</dt><dd>${KIND[t.kind]}</dd></div>
          <div><dt>CPV</dt><dd><span class="mono">${t.cpv[0]}</span><br>${esc(t.cpv[1])}</dd></div>
          <div><dt>Ogłoszenie</dt><dd>${fmtStamp(t.published)}</dd></div>
          <div><dt>Pytania do SWZ do</dt><dd>${fmtStamp(t.questions)}</dd></div>
          <div><dt>Otwarcie ofert</dt><dd>${fmtStamp(t.deadline + 30 * MIN)}</dd></div>
          <div><dt>Związanie ofertą</dt><dd>${t.ue ? 90 : 30} dni</dd></div>
          <div><dt>Kontakt</dt><dd>${esc(t.contact)}</dd></div>
        </dl>
        <button type="button" class="btn btn--y btn--block" data-act="submit-offer"${open ? '' : ' disabled'}>${open ? 'Złóż ofertę na platformie' : 'Termin minął'} ${icon('arrow')}</button>
      </aside>
    </div>
    ${sim.length ? `<section class="tp__sec">${poster(sim, { title: 'Z tego samego peronu', sub: `${GROUP[t.group].label} · najbliższe odjazdy`, cls: 'poster--mini' })}</section>` : ''}
  </section>`;
}

// ---------- season tickets ----------
function aztec(seed) {
  const N = 23, c = 11, r = rng([...seed].reduce((a, ch) => a * 31 + ch.charCodeAt(0) | 0, 7));
  let rects = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.max(Math.abs(x - c), Math.abs(y - c));
    let on;
    if (d <= 5) on = d % 2 === 0 || (d === 5 && ((x === c - 5 && y === c - 5) || (x === c - 5 && y === c - 4) || (x === c - 4 && y === c - 5) || (x === c + 5 && y === c - 5)));
    else if (d === 6) on = (x + y) % 2 === 0 && r() < 0.6;
    else on = r() < 0.5;
    if (on) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  return `<svg class="aztec" viewBox="-1 -1 25 25" aria-hidden="true">${rects}</svg>`;
}
function ticketStats(tk) {
  const open = ALL.filter(t => isOpen(t) && matches(t, tk.f));
  const week = ALL.filter(t => t.published > Date.now() - 7 * DAY && matches(t, tk.f)).length;
  return { open: open.length, week };
}
function renderTicket(tk) {
  const st = ticketStats(tk);
  return `<article class="ticket${tk.paused ? ' is-paused' : ''}" id="tk-${tk.id}">
    <div class="ticket__stub">
      <p class="ticket__type">Bilet<br>okresowy</p>
      ${aztec(tk.id + tk.no)}
      <p class="ticket__no mono">Nr ${tk.no}</p>
    </div>
    <div class="ticket__body">
      <p class="ticket__carrier">Peron · przetargi publiczne · klasa 2</p>
      <h3 class="ticket__name">${esc(tk.name)}</h3>
      <dl class="ticket__grid">
        <div class="wide"><dt>Relacja</dt><dd>${esc(describe(tk.f))}</dd></div>
        <div><dt>Słowa kluczowe</dt><dd>${tk.f.q ? `„${esc(tk.f.q)}”` : 'dowolne'}</dd></div>
        <div><dt>Kurs</dt><dd>${FREQ[tk.freq]}</dd></div>
        <div><dt>Doręczenie</dt><dd>${CHANNEL[tk.channel][0]}: <span class="mono">${esc(tk.dest)}</span></dd></div>
        <div><dt>Na trasie teraz</dt><dd><b>${st.open}</b> ${plural(st.open, 'otwarty przetarg', 'otwarte przetargi', 'otwartych przetargów')}</dd></div>
        <div><dt>Ostatnie 7 dni</dt><dd><b>${st.week}</b> ${plural(st.week, 'nowy', 'nowe', 'nowych')}</dd></div>
      </dl>
      <p class="ticket__punch mono" aria-label="Ważny od ${fmtStamp(tk.created)}">WAŻNY OD ${fmtDM(tk.created)}.${String(new Date(tk.created).getFullYear()).slice(2)} ${fmtTime(tk.created)} · ${tk.no}</p>
      ${tk.paused ? '<p class="ticket__stamp">Wstrzymany</p>' : ''}
    </div>
    <footer class="ticket__act">
      <a class="link" href="#/?${fToQS(tk.f)}">Pokaż trasę ${icon('arrow')}</a>
      <button type="button" class="link" data-act="preview" data-id="${tk.id}">Podgląd komunikatu</button>
      <button type="button" class="link" data-act="edit-ticket" data-id="${tk.id}">Edytuj</button>
      <button type="button" class="link" data-act="pause" data-id="${tk.id}">${tk.paused ? 'Wznów' : 'Wstrzymaj'}</button>
      <button type="button" class="link link--danger" data-act="del-ticket" data-id="${tk.id}">Usuń</button>
    </footer>
  </article>`;
}
function renderTickets() {
  return `<section class="wrap page">
    <header class="page-head">
      <div><h1 class="h1">Bilety okresowe</h1>
      <p class="lead">Bilet to zapisana trasa wyszukiwania. Gdy na Twojej trasie pojawi się nowe ogłoszenie albo ktoś przesunie termin w obserwowanym przetargu, dostaniesz komunikat: od razu, rano albo raz w tygodniu.</p></div>
      <div class="page-head__act">
        <button type="button" class="btn btn--ticket" data-act="new-ticket">${icon('ticket')} Nowy bilet</button>
        <button type="button" class="btn" data-act="simulate">Symuluj poranek: nowe ogłoszenia</button>
      </div>
    </header>
    <div class="tickets">${S.tickets.length ? S.tickets.map(renderTicket).join('') : `<div class="empty"><p class="empty__h">Nie masz jeszcze biletu.</p><p>Ustaw filtry w <a href="#/">odjazdach</a> i kliknij „Kup bilet na tę trasę”, albo zacznij od pustego biletu.</p></div>`}</div>
    <section class="fares" aria-labelledby="faresH">
      <h2 class="h2" id="faresH">Taryfa</h2>
      <div class="fares__scroll"><table class="fares__t">
        <thead><tr><th scope="col"></th><th scope="col">Jednorazowy<span>0 zł</span></th><th scope="col" class="is-hit">Miesięczny<span>49 zł / mies.</span></th><th scope="col">Sieciowy<span>149 zł / mies.</span></th></tr></thead>
        <tbody>
          <tr><th scope="row">Bilety okresowe</th><td>1</td><td class="is-hit">10</td><td>bez limitu</td></tr>
          <tr><th scope="row">Kurs komunikatów</th><td>w poniedziałki</td><td class="is-hit">codziennie lub od razu</td><td>codziennie lub od razu</td></tr>
          <tr><th scope="row">Doręczenie</th><td>e-mail</td><td class="is-hit">e-mail, SMS</td><td>e-mail, SMS, webhook, API</td></tr>
          <tr><th scope="row">Zmiany w obserwowanych</th><td>—</td><td class="is-hit">tak</td><td>tak, z historią SWZ</td></tr>
          <tr><th scope="row">Osoby w zespole</th><td>1</td><td class="is-hit">1</td><td>do 10</td></tr>
        </tbody>
      </table></div>
      <p class="muted">Ceny brutto, makieta. Bilet można wstrzymać w każdej chwili, bez kary umownej.</p>
    </section>
  </section>`;
}
function ticketDraftFrom(f, name) {
  const g = Object.assign(emptyF(), JSON.parse(JSON.stringify(f)), { within: '' });
  return { id: null, name: name || shortName(g), f: g, freq: 'daily', channel: 'email', dest: store.get('dest', CHANNEL.email[1]) };
}
function builderEstimate(d) {
  const open = ALL.filter(t => isOpen(t) && matches(t, d.f)).length;
  const wk = Math.round(ALL.filter(t => t.published > Date.now() - 28 * DAY && matches(t, d.f)).length / 4);
  return `Na tej trasie jest teraz <b>${open}</b> ${plural(open, 'otwarty przetarg', 'otwarte przetargi', 'otwartych przetargów')}, a co tydzień przyjeżdża ok. <b>${wk}</b> ${plural(wk, 'nowy', 'nowe', 'nowych')}.${wk > 25 && d.freq === 'instant' ? ' To sporo jak na komunikaty od razu; rozważ kurs poranny.' : ''}${open === 0 ? ' Trasa jest pusta: sprawdź filtry.' : ''}`;
}
function openBuilder(d) {
  S.draft = d;
  openModal(`
    <header class="modal__head"><h2 id="mTitle" class="h2">${d.id ? 'Edytuj bilet' : 'Nowy bilet okresowy'}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Zamknij">${icon('x')}</button></header>
    <form class="builder" data-form="ticket">
      <div class="builder__row">
        <label class="fld"><span>Nazwa biletu</span><input name="name" value="${esc(d.name)}" required autofocus></label>
        <label class="fld"><span>Słowa kluczowe</span><input name="q" data-scope="b" value="${esc(d.f.q)}" placeholder="np. kanalizacja, fotowoltaika"></label>
      </div>
      <div class="builder__facets">${facets(d.f, 'b')}</div>
      <div class="builder__row">
        <fieldset class="fs"><legend>Kurs komunikatów</legend>${Object.entries(FREQ).map(([k, l]) => `<label class="opt opt--r"><input type="radio" name="freq" value="${k}"${d.freq === k ? ' checked' : ''}><span class="opt__box" aria-hidden="true"></span><span class="opt__l">${l}</span></label>`).join('')}</fieldset>
        <fieldset class="fs"><legend>Doręczenie</legend>${Object.entries(CHANNEL).map(([k, [l]]) => `<label class="opt opt--r"><input type="radio" name="channel" value="${k}"${d.channel === k ? ' checked' : ''}><span class="opt__box" aria-hidden="true"></span><span class="opt__l">${l}</span></label>`).join('')}
          <label class="fld fld--tight"><span class="sr-only">Adres doręczenia</span><input name="dest" value="${esc(d.dest)}" placeholder="${esc(CHANNEL[d.channel][1])}" required></label></fieldset>
      </div>
      <p class="builder__est" id="bEst" aria-live="polite">${builderEstimate(d)}</p>
      <footer class="modal__foot"><button type="button" class="btn" data-act="close">Anuluj</button><button type="submit" class="btn btn--ticket">${icon('ticket')} ${d.id ? 'Zapisz zmiany' : 'Wydaj bilet'}</button></footer>
    </form>`, true);
}
function digestFor(tk, ids) {
  const list = ids.map(id => BY_ID.get(id)).filter(Boolean);
  return `
    <header class="modal__head"><h2 id="mTitle" class="h2">Podgląd komunikatu</h2><button type="button" class="icon-btn" data-act="close" aria-label="Zamknij">${icon('x')}</button></header>
    <div class="mail">
      <dl class="mail__hdr">
        <div><dt>Od</dt><dd>Peron &lt;komunikaty@peron.example&gt;</dd></div>
        <div><dt>Do</dt><dd>${esc(tk.dest)}</dd></div>
        <div><dt>Temat</dt><dd><b>${list.length} ${plural(list.length, 'nowy przetarg', 'nowe przetargi', 'nowych przetargów')} na trasie „${esc(tk.name)}”</b></dd></div>
      </dl>
      <div class="mail__body">
        <p class="mail__brand">Peron <span>komunikat ${tk.freq === 'instant' ? 'natychmiastowy' : tk.freq === 'daily' ? 'poranny' : 'tygodniowy'}</span></p>
        <p>Dzień dobry, na trasie <b>${esc(describe(tk.f))}</b>${tk.f.q ? ` ze słowami „${esc(tk.f.q)}”` : ''} pojawiły się nowe ogłoszenia:</p>
        ${list.length ? `<ol class="mail__list">${list.map(t => `<li>
          <p class="mail__when">odjazd ${fmtDM(t.deadline)}, ${fmtTime(t.deadline)} · ${left(t.deadline)}</p>
          <a href="#/p/${t.id}" data-act="close-go">${esc(t.title)}</a>
          <p>${esc(t.buyer.name)} · ${fmtMoneyShort(t.value)}${t.wadium ? ` · wadium ${fmtMoney(t.wadium)}` : ''}</p></li>`).join('')}</ol>` : '<p class="muted">W ostatnich 7 dniach nic nowego na tej trasie. Komunikat w takim wypadku nie jest wysyłany.</p>'}
        <p class="mail__foot">Dostajesz ten komunikat, bo masz bilet okresowy nr ${tk.no}. Zmień trasę, wstrzymaj albo usuń bilet na peron.example/bilety.</p>
      </div>
    </div>`;
}

// ---------- simulation: a new morning of notices ----------
function simulate() {
  const r = rng(Date.now() % 1e9);
  const made = [];
  const active = S.tickets.filter(t => !t.paused);
  const pubAt = () => Date.now() - Math.floor(r() * 90) * MIN;
  // aim at least one hit per active ticket so the demo shows something, plus a few random ones
  active.forEach(tk => {
    for (let i = 0; i < 80; i++) {
      const t = makeTender(r, 0, BUYERS, { published: pubAt(), id: 's' + Date.now().toString(36) + made.length });
      if (matches(t, Object.assign({}, tk.f, { within: '' })) && r() < 0.85) { made.push(t); break; }
    }
  });
  const extraN = 3 + Math.floor(r() * 4);
  for (let i = 0; i < extraN; i++) made.push(makeTender(r, 0, BUYERS, { published: pubAt(), id: 's' + Date.now().toString(36) + made.length }));
  S.extra = S.extra.concat(made);
  store.set('extra', S.extra);
  reindex();
  const msgs = [];
  active.forEach(tk => {
    const ids = made.filter(t => matches(t, tk.f)).map(t => t.id);
    if (ids.length) msgs.push({ id: 'm' + Date.now().toString(36) + tk.id, at: Date.now(), kind: 'digest', ticket: tk.id, ids, read: false });
  });
  // a watched tender gets its deadline pushed back
  const w = ALL.filter(t => S.watch.has(t.id) && isOpen(t) && t.deadline - Date.now() > DAY);
  if (w.length) {
    const t = w[Math.floor(r() * w.length)];
    const from = t.deadline, by = 3 + Math.floor(r() * 5);
    const p = { moved: { from, at: Date.now() }, deadline: weekday(atDay(from, by)) + (from - startOfDay(from)) };
    S.patches[t.id] = p;
    store.set('patches', S.patches);
    reindex();
    msgs.push({ id: 'mv' + Date.now().toString(36), at: Date.now(), kind: 'move', ids: [t.id], from, read: false });
  }
  S.inbox = msgs.concat(S.inbox).slice(0, 60);
  saveInbox();
  toast(`<b>Opublikowano ${made.length} ${plural(made.length, 'nowe ogłoszenie', 'nowe ogłoszenia', 'nowych ogłoszeń')}.</b> ${msgs.length ? `${msgs.length} ${plural(msgs.length, 'komunikat czeka', 'komunikaty czekają', 'komunikatów czeka')} w <a href="#/komunikaty">skrzynce</a>.` : 'Żaden bilet nie miał trafień.'}`);
  rerender();
}

// ---------- inbox ----------
function renderInbox() {
  const html = S.inbox.map(m => {
    const list = m.ids.map(id => BY_ID.get(id)).filter(Boolean);
    if (m.kind === 'move') {
      const t = list[0];
      if (!t) return '';
      return `<article class="msg msg--move${m.read ? '' : ' is-unread'}">
        <p class="msg__time"><b>${fmtTime(m.at)}</b>${fmtDM(m.at)}</p>
        <div class="msg__body"><p class="msg__tag">Zmiana terminu · obserwowany</p>
        <p class="msg__h">Przesunięto odjazd: <a href="#/p/${t.id}">${esc(t.title)}</a></p>
        <p>Oferty do <b>${fmtDayLong(t.deadline)}, ${fmtTime(t.deadline)}</b> zamiast <s>${fmtDM(m.from)}, ${fmtTime(m.from)}</s>. Zamawiający opublikował zmianę treści SWZ.</p></div>
      </article>`;
    }
    const tk = S.tickets.find(x => x.id === m.ticket);
    return `<article class="msg${m.read ? '' : ' is-unread'}">
      <p class="msg__time"><b>${fmtTime(m.at)}</b>${fmtDM(m.at)}</p>
      <div class="msg__body"><p class="msg__tag">Bilet ${tk ? 'nr ' + tk.no + ' · ' + esc(tk.name) : '(usunięty)'}</p>
      <p class="msg__h">${list.length} ${plural(list.length, 'nowy przetarg', 'nowe przetargi', 'nowych przetargów')} na trasie</p>
      <ul class="msg__list">${list.map(t => `<li><a href="#/p/${t.id}">${esc(t.title)}</a> <span>${esc(t.buyer.town)} · ${fmtMoneyShort(t.value)} · odjazd ${fmtDM(t.deadline)}</span></li>`).join('')}</ul>
      ${tk ? `<button type="button" class="link" data-act="preview-msg" data-id="${m.id}">Zobacz jako e-mail</button>` : ''}</div>
    </article>`;
  }).join('');
  return `<section class="wrap page">
    <header class="page-head">
      <div><h1 class="h1">Komunikaty</h1><p class="lead">Wszystko, co bilety okresowe i obserwowane przetargi wysłały na Twoje kanały. Tu widać to w jednym miejscu, z godziną nadania.</p></div>
      <div class="page-head__act"><button type="button" class="btn" data-act="simulate">Symuluj poranek: nowe ogłoszenia</button></div>
    </header>
    <div class="msgs">${html || `<div class="empty"><p class="empty__h">Cisza na peronie.</p><p>Kliknij „Symuluj poranek”, żeby zobaczyć, co przyszłoby rano na Twoje bilety.</p></div>`}</div>
  </section>`;
}

// ---------- watched ----------
function renderWatch() {
  const list = [...S.watch].map(id => BY_ID.get(id)).filter(Boolean).sort((a, b) => a.deadline - b.deadline);
  const open = list.filter(isOpen), gone = list.filter(t => !isOpen(t));
  return `<section class="wrap page">
    <header class="page-head">
      <div><h1 class="h1">Obserwowane</h1><p class="lead">Przetargi, na które się wybierasz. Gdy zamawiający przesunie termin albo zmieni SWZ, dostaniesz komunikat.</p></div>
      ${open.length ? `<div class="page-head__act"><button type="button" class="btn" data-act="ics-all">${icon('cal')} Wszystkie do kalendarza (.ics)</button></div>` : ''}
    </header>
    ${list.length ? poster(open, { title: 'Twoje odjazdy', sub: `${open.length} ${plural(open.length, 'obserwowany', 'obserwowane', 'obserwowanych')}`, empty: 'Wszystkie obserwowane już odjechały.' }) : `<div class="empty"><p class="empty__h">Nic nie obserwujesz.</p><p>Kliknij gwiazdkę przy przetargu w <a href="#/">odjazdach</a>, a pojawi się tutaj razem z odliczaniem do terminu.</p></div>`}
    ${gone.length ? `<h2 class="h2 gone-h">Odjechały</h2>${gone.map(depRow).join('')}` : ''}
  </section>`;
}

// ---------- calendar export ----------
function ics(list) {
  const d = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const clean = s => s.replace(/[,;\\]/g, m => '\\' + m);
  const ev = list.map(t => ['BEGIN:VEVENT', `UID:${t.id}@peron.example`, `DTSTAMP:${d(Date.now())}`, `DTSTART:${d(t.deadline - HOUR)}`, `DTEND:${d(t.deadline)}`,
    `SUMMARY:${clean('Termin ofert: ' + t.title)}`, `DESCRIPTION:${clean(`${t.buyer.name}. ${t.no}. Budżet ${fmtMoney(t.value)}.`)}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Jutro termin składania ofert', 'END:VALARM', 'END:VEVENT'].join('\r\n'));
  const blob = new Blob([['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Peron//makieta//PL', ...ev, 'END:VCALENDAR'].join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = list.length === 1 ? `przetarg-${list[0].id}.ics` : 'peron-obserwowane.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`Zapisano ${list.length} ${plural(list.length, 'termin', 'terminy', 'terminów')} do pliku .ics, z przypomnieniem dzień wcześniej.`);
}

// ---------- header counters ----------
function updateNav() {
  const set = (id, n) => { const el = $(id); el.hidden = !n; el.textContent = n; };
  set('#navTickets', S.tickets.filter(t => !t.paused).length);
  set('#navWatch', [...S.watch].filter(id => BY_ID.get(id) && isOpen(BY_ID.get(id))).length);
  set('#navInbox', S.inbox.filter(m => !m.read).length);
}

// ---------- router ----------
const $app = $('#app');
function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), params: Object.fromEntries(new URLSearchParams(qs || '')) };
}
let lastKey = '';
function route(keep) {
  const { parts, params } = parseHash();
  const [p0, p1] = parts;
  let html, nav = '', title = 'Peron · przetargi publiczne według godziny odjazdu';
  document.body.classList.remove('has-filters');
  if (!p0) {
    S.f = fFromParams(params);
    S.sort = ['deadline', 'new', 'value'].includes(params.sort) ? params.sort : 'deadline';
    if (!keep) S.limit = 40;
    html = renderHome(); nav = 'home';
  } else if (p0 === 'p') { html = renderTender(p1); const t = BY_ID.get(p1); if (t) title = `${t.title} · Peron`; }
  else if (p0 === 'bilety') { html = renderTickets(); nav = 'bilety'; title = 'Bilety okresowe · Peron'; }
  else if (p0 === 'obserwowane') { html = renderWatch(); nav = 'obserwowane'; title = 'Obserwowane · Peron'; }
  else if (p0 === 'komunikaty') { html = renderInbox(); nav = 'komunikaty'; title = 'Komunikaty · Peron'; S.inbox.forEach(m => m.read = true); saveInbox(); }
  else html = `<section class="wrap page"><h1 class="h1">Nie ma takiego peronu</h1><p><a class="btn" href="#/">${icon('back')} Odjazdy</a></p></section>`;
  const key = parts.join('/');
  const y = scrollY;
  $app.innerHTML = html;
  document.title = title;
  $$('[data-nav]').forEach(a => a.classList.toggle('is-on', a.dataset.nav === nav));
  if (nav === 'home') mountBoard();
  updateNav();
  if (keep && key === lastKey) scrollTo(0, y);
  else { scrollTo(0, 0); $app.focus({ preventScroll: true }); }
  lastKey = key;
}
const rerender = () => route(true);

// ---------- events ----------
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act, id = a.dataset.id;
  if (act === 'backdrop') { if (e.target === a) closeModal(); return; }
  if (act === 'close') return closeModal();
  if (act === 'close-go') { closeModal(); return; }
  if (act === 'theme') {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
    return;
  }
  if (act === 'watch') {
    const on = !S.watch.has(id);
    on ? S.watch.add(id) : S.watch.delete(id);
    saveWatch();
    $$(`[data-act="watch"][data-id="${id}"]`).forEach(b => {
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on);
      if (b.classList.contains('btn')) b.innerHTML = `${icon('star')} ${on ? 'Obserwujesz' : 'Obserwuj'}`;
    });
    updateNav();
    if (on) toast('Dodano do obserwowanych. Damy znać, jeśli termin się zmieni.');
    if (parseHash().parts[0] === 'obserwowane') rerender();
    return;
  }
  if (act === 'filters') { document.body.classList.toggle('has-filters'); return; }
  if (act === 'clear') { S.f = emptyF(); S.limit = 40; refreshSearch(); $('#q').value = ''; return; }
  if (act === 'untag') {
    const k = a.dataset.k, v = a.dataset.v;
    if (Array.isArray(S.f[k])) S.f[k] = S.f[k].filter(x => x !== v); else S.f[k] = '';
    if (k === 'q') $('#q').value = '';
    refreshSearch();
    return;
  }
  if (act === 'more') { S.limit += 40; $('#results').innerHTML = renderResults(); return; }
  if (act === 'buy') return openBuilder(ticketDraftFrom(S.f));
  if (act === 'buy-like') { const t = BY_ID.get(id); return openBuilder(ticketDraftFrom(Object.assign(emptyF(), { groups: [t.group], woj: [t.buyer.woj] }))); }
  if (act === 'new-ticket') return openBuilder(ticketDraftFrom(emptyF(), 'Nowy bilet'));
  if (act === 'edit-ticket') { const tk = S.tickets.find(x => x.id === id); return openBuilder(JSON.parse(JSON.stringify(tk))); }
  if (act === 'pause') { const tk = S.tickets.find(x => x.id === id); tk.paused = !tk.paused; saveTickets(); toast(tk.paused ? `Bilet „${esc(tk.name)}” wstrzymany. Komunikaty nie będą wysyłane.` : `Bilet „${esc(tk.name)}” znów jeździ.`); return rerender(); }
  if (act === 'del-ticket') {
    const tk = S.tickets.find(x => x.id === id);
    if (!confirm(`Usunąć bilet „${tk.name}”?`)) return;
    S.tickets = S.tickets.filter(x => x.id !== id); saveTickets(); toast('Bilet usunięty.'); return rerender();
  }
  if (act === 'preview') {
    const tk = S.tickets.find(x => x.id === id);
    const ids = ALL.filter(t => t.published > Date.now() - 7 * DAY && isOpen(t) && matches(t, tk.f)).sort((a, b) => b.published - a.published).slice(0, 6).map(t => t.id);
    return openModal(digestFor(tk, ids));
  }
  if (act === 'preview-msg') { const m = S.inbox.find(x => x.id === id); const tk = S.tickets.find(x => x.id === m.ticket); return openModal(digestFor(tk, m.ids)); }
  if (act === 'simulate') return simulate();
  if (act === 'ics') return ics([BY_ID.get(id)]);
  if (act === 'ics-all') return ics([...S.watch].map(i => BY_ID.get(i)).filter(t => t && isOpen(t)));
  if (act === 'copy') { navigator.clipboard && navigator.clipboard.writeText(location.href).catch(() => {}); return toast('Link skopiowany.'); }
  if (act === 'doc') return toast('W makiecie dokumenty nie są dołączone. W wersji docelowej plik pobiera się z platformy zamawiającego.');
  if (act === 'submit-offer') return toast('Tu nastąpiłoby przejście na platformę e-Zamówienia, gdzie składa się ofertę z podpisem kwalifikowanym.');
});
let qTimer;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'q') { clearTimeout(qTimer); qTimer = setTimeout(() => { S.f.q = el.value.trim(); S.limit = 40; refreshSearch(true); }, 220); return; }
  if (S.draft && el.closest('[data-form="ticket"]')) {
    if (el.name === 'q') { S.draft.f.q = el.value.trim(); updateCounts(S.draft.f, 'b'); }
    if (el.name === 'name') S.draft.name = el.value;
    if (el.name === 'dest') S.draft.dest = el.value;
    $('#bEst').innerHTML = builderEstimate(S.draft);
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.matches('[data-sort]')) { S.sort = el.value; S.limit = 40; refreshSearch(true); return; }
  if (el.dataset.f) {
    const f = el.dataset.scope === 's' ? S.f : S.draft.f, k = el.dataset.f;
    if (el.type === 'checkbox') f[k] = el.checked ? f[k].concat(el.value) : f[k].filter(x => x !== el.value);
    else f[k] = el.value;
    if (el.dataset.scope === 's') { S.limit = 40; refreshSearch(true); }
    else {
      updateCounts(S.draft.f, 'b');
      $('#bEst').innerHTML = builderEstimate(S.draft);
      $('.builder .fs--woj legend').innerHTML = 'Województwo' + (f.woj.length ? ` <em>· ${f.woj.length}</em>` : '');
    }
    return;
  }
  if (S.draft && el.name === 'freq') { S.draft.freq = el.value; $('#bEst').innerHTML = builderEstimate(S.draft); }
  if (S.draft && el.name === 'channel') {
    S.draft.channel = el.value;
    const inp = $('[name="dest"]');
    inp.placeholder = CHANNEL[el.value][1];
    inp.type = el.value === 'email' ? 'email' : el.value === 'sms' ? 'tel' : 'url';
    if (!inp.value || Object.values(CHANNEL).some(c => c[1] === inp.value)) { inp.value = el.value === 'email' ? store.get('dest', CHANNEL.email[1]) : CHANNEL[el.value][1]; S.draft.dest = inp.value; }
  }
});
document.addEventListener('submit', e => {
  const form = e.target;
  if (form.dataset.form === 'q') {
    e.preventDefault();
    S.f.q = $('#q').value.trim();
    refreshSearch(true);
    $('#results').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    return;
  }
  if (form.dataset.form === 'ticket') {
    e.preventDefault();
    const d = S.draft;
    if (d.channel === 'email') store.set('dest', d.dest);
    if (d.id) {
      const i = S.tickets.findIndex(x => x.id === d.id);
      S.tickets[i] = Object.assign(S.tickets[i], { name: d.name, f: d.f, freq: d.freq, channel: d.channel, dest: d.dest });
      saveTickets(); closeModal(); toast('Bilet zaktualizowany.');
      if (parseHash().parts[0] === 'bilety') rerender();
      return;
    }
    const no = String(Math.max(47, ...S.tickets.map(t => +t.no)) + 1 + Math.floor(Math.random() * 9)).padStart(4, '0');
    const tk = { id: 'k' + Date.now().toString(36), no, name: d.name || shortName(d.f), f: d.f, freq: d.freq, channel: d.channel, dest: d.dest, created: Date.now(), paused: false };
    S.tickets.unshift(tk);
    saveTickets();
    closeModal();
    if (parseHash().parts[0] === 'bilety') rerender(); else location.hash = '#/bilety';
    requestAnimationFrame(() => { const el = $('#tk-' + tk.id); if (el) el.classList.add('is-fresh'); });
    toast(`Bilet nr ${no} wydany. Pierwszy komunikat: ${FREQ[tk.freq].toLowerCase()}.`);
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if ($('#modalRoot .modal')) closeModal();
    else if (document.body.classList.contains('has-filters')) document.body.classList.remove('has-filters');
  }
  if (e.key === 'Tab' && $('#modalRoot .modal')) {
    const f = $$('#modalRoot button, #modalRoot input, #modalRoot a[href]').filter(x => !x.disabled && x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

// live bits: board flips every 15 s, countdowns every 30 s, the board clock every second
setInterval(() => { const c = $('#boardClock'); if (c) c.textContent = new Date().toLocaleTimeString(PL); }, 1000);
setInterval(() => { const b = $('#board'); if (b && b._cols) Board.update(b, boardRows()); }, 15000);
setInterval(() => { $$('[data-left]').forEach(el => el.textContent = left(+el.dataset.left)); }, 30000);
let rT;
addEventListener('resize', () => {
  clearTimeout(rT);
  rT = setTimeout(() => {
    const b = $('#board');
    if (!b) return;
    if (boardCols().map(c => c.key).join() !== boardTier) mountBoard(); else sizeBoard(b, b._cols);
  }, 200);
});

$('#year').textContent = new Date().getFullYear();
addEventListener('hashchange', () => route(false));
route(false);
