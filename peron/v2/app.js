// Peron v2 — app: state, filters, the schedule of dimension lines, tender sheets, kalki (saved searches), transmittal letters and the router.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const store = {
  get(k, d) { try { const v = localStorage.getItem('peron2-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('peron2-' + k, JSON.stringify(v)); } catch (e) {} },
};
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- formatting ----------
const PL = 'pl-PL';
const fmtMoney = v => Math.round(v).toLocaleString(PL) + ' zł';
const fmtTime = ms => new Date(ms).toLocaleTimeString(PL, { hour: '2-digit', minute: '2-digit' });
const fmtDate = ms => new Date(ms).toLocaleDateString(PL, { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDM = ms => new Date(ms).toLocaleDateString(PL, { day: '2-digit', month: '2-digit' });
const fmtDayShort = ms => new Date(ms).toLocaleDateString(PL, { weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtDayLong = ms => new Date(ms).toLocaleDateString(PL, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtStamp = ms => `${fmtDate(ms)}, ${fmtTime(ms)}`;
function plural(n, a, b, c) { const d = n % 10, h = n % 100; return n === 1 ? a : d >= 2 && d <= 4 && (h < 12 || h > 14) ? b : c; }
const startOfDay = ms => new Date(ms).setHours(0, 0, 0, 0);
// the length written on a dimension line: "4 d 3 h", "5 h 20 min"
function dimLabel(ms) {
  const d = ms - Date.now();
  if (d <= 0) return 'po terminie';
  const m = Math.floor(d / MIN);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  const days = Math.floor(h / 24);
  return days < 7 && h % 24 ? `${days} d ${h % 24} h` : `${days} d`;
}
function spanLabel(ms) {
  if (ms >= DAY) { const d = Math.round(ms / DAY); return `${d} d`; }
  if (ms >= HOUR) return `${Math.round(ms / HOUR)} h`;
  return `${Math.round(ms / MIN)} min`;
}
const isNew = t => Date.now() - t.published < 2 * DAY;
const isOpen = t => t.deadline > Date.now();

// ---------- state ----------
const S = {
  watch: new Set(store.get('watch', [])),
  extra: store.get('extra', []),
  patches: store.get('patches', {}),
  kalki: store.get('kalki', null),
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
const saveKalki = () => store.set('kalki', S.kalki);
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

// ---------- kalki & letters seed ----------
if (!S.kalki) {
  S.kalki = [
    { id: 'k1', no: '0031', name: 'Drogi na południu', f: Object.assign(emptyF(), { groups: ['drogi'], woj: ['małopolskie', 'podkarpackie', 'śląskie'] }), freq: 'daily', channel: 'email', dest: 'oferty@drogbud.example', created: atDay(TODAY0, -12, 9 * 60), paused: false },
    { id: 'k2', no: '0047', name: 'IT dla samorządów', f: Object.assign(emptyF(), { groups: ['it'] }), freq: 'instant', channel: 'email', dest: 'handel@bajtsoft.example', created: atDay(TODAY0, -3, 14 * 60), paused: false },
  ];
  saveKalki();
}
if (!S.inbox) {
  const at = TODAY0 + 7 * HOUR <= Date.now() ? TODAY0 + 7 * HOUR : TODAY0 - DAY + 7 * HOUR;
  S.inbox = S.kalki.map(k => {
    const ids = ALL.filter(t => t.published <= at && t.published > at - DAY && isOpen(t) && matches(t, k.f)).map(t => t.id);
    return ids.length ? { id: 'm' + k.id, at, kind: 'digest', kalka: k.id, ids, read: false } : null;
  }).filter(Boolean);
  saveInbox();
}

// ---------- icons ----------
const ICON = {
  pin: '<path d="M9 3.5h6l-1 6 3.5 3.5h-11L10 9.5z"/><path d="M12 13v7.5"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  kalka: '<path d="M4 7.5h11.5V20H4z"/><path d="M8.5 4h11.5v12.5" stroke-dasharray="2 1.6"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

// ---------- layers: each industry is a layer of the drawing with its own line type ----------
const DASH = ['', '7 3', '1.5 2.5', '9 2.5 1.5 2.5', '9 2.5 1.5 2.5 1.5 2.5', '14 4', '4 2', 'thick', 'double', '2 2 8 2', '0.8 2.4'];
const layerNo = g => 'L' + String(GROUP[g].peron).padStart(2, '0');
function layerLine(g, w = 36) {
  const d = DASH[GROUP[g].peron - 1];
  const line = (y, sw, da) => `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke-width="${sw}"${da ? ` stroke-dasharray="${da}"` : ''}/>`;
  const body = d === 'thick' ? line(5, 3) : d === 'double' ? line(3, 1.1) + line(7, 1.1) : line(5, 1.3, d);
  return `<svg class="ln" viewBox="0 0 ${w} 10" width="${w}" height="10" aria-hidden="true">${body}</svg>`;
}
const layerTag = g => `<span class="layer" title="Warstwa ${layerNo(g)}: ${esc(GROUP[g].label)}">${layerLine(g, 24)}<b>${layerNo(g)}</b> ${esc(GROUP[g].label)}</span>`;
const revMark = n => `<span class="rev" title="Rewizja ${n}: termin składania ofert przesunięty" aria-label="rewizja ${n}, termin przesunięty"><svg viewBox="0 0 20 18" aria-hidden="true"><path d="M10 1.6L18.6 16.6H1.4z"/><text x="10" y="14.6">${n}</text></svg></span>`;

// ---------- the site plan: voivodeships as parcels on a 5×4 grid, roughly where they lie ----------
const PLAN = [
  ['zachodniopomorskie', 'ZP', 1, 0], ['pomorskie', 'PM', 2, 0], ['warmińsko-mazurskie', 'WN', 3, 0], ['podlaskie', 'PD', 4, 0],
  ['lubuskie', 'LB', 0, 1], ['wielkopolskie', 'WP', 1, 1], ['kujawsko-pomorskie', 'KP', 2, 1], ['mazowieckie', 'MZ', 3, 1],
  ['dolnośląskie', 'DS', 0, 2], ['opolskie', 'OP', 1, 2], ['łódzkie', 'LD', 2, 2], ['świętokrzyskie', 'SK', 3, 2], ['lubelskie', 'LU', 4, 2],
  ['śląskie', 'SL', 1, 3], ['małopolskie', 'MA', 2, 3], ['podkarpackie', 'PK', 3, 3],
];
// denser hatching = more open tenders in the parcel
const hatch = n => n === 0 ? '0px' : n < 3 ? '10px' : n < 6 ? '7px' : n < 10 ? '5px' : '3.5px';
const parcelLabel = (w, n) => `${w}: ${n} ${plural(n, 'otwarty przetarg', 'otwarte przetargi', 'otwartych przetargów')}`;
function plan(f, scope, mini) {
  const pool = mini ? [] : ALL.filter(isOpen);
  return `<div class="plan${mini ? ' plan--mini' : ''}"${mini ? ' aria-hidden="true"' : ' role="group" aria-label="Plan sytuacyjny: województwa"'}>${PLAN.map(([w, code, x, y]) => {
    const on = f.woj.includes(w), pos = `grid-area:${y + 1}/${x + 1}`;
    if (mini) return `<span class="parcel${on || !f.woj.length ? ' is-on' : ''}" style="${pos}">${code}</span>`;
    const n = pool.filter(t => matches(t, f, 'woj') && t.buyer.woj === w).length;
    return `<button type="button" class="parcel${on ? ' is-on' : ''}${n ? '' : ' is-zero'}" data-act="parcel" data-scope="${scope}" data-woj="${w}" aria-pressed="${on}" aria-label="${parcelLabel(w, n)}" style="${pos};--h:${hatch(n)}"><b>${code}</b><span>${n}</span></button>`;
  }).join('')}</div>`;
}
const planSel = f => f.woj.length ? f.woj.join(', ') : 'cała Polska, nic nie zaznaczono';

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

// ---------- facets ----------
function facets(f, scope) {
  const pool = ALL.filter(isOpen);
  const cnt = (key, test) => pool.filter(t => matches(t, f, key) && test(t)).length;
  const box = (key, val, label, n, pre = '') => `<label class="opt"><input type="checkbox" data-f="${key}" data-scope="${scope}" value="${esc(val)}"${f[key].includes(val) ? ' checked' : ''}><span class="opt__box" aria-hidden="true"></span>${pre}<span class="opt__l">${label}</span><span class="opt__n">${n}</span></label>`;
  const radio = (key, opts) => opts.map(([v, l]) => `<label class="opt opt--r"><input type="radio" name="${scope}-${key}" data-f="${key}" data-scope="${scope}" value="${v}"${f[key] === v ? ' checked' : ''}><span class="opt__box" aria-hidden="true"></span><span class="opt__l">${l}</span></label>`).join('');
  return `
    <fieldset class="fs fs--plan"><legend>Plan sytuacyjny · województwa</legend>
      ${plan(f, scope)}
      <p class="fs__sel" data-plan-sel="${scope}">${esc(planSel(f))}</p>
      <p class="fs__note">Gęstość kreskowania to liczba otwartych przetargów. Kliknij działkę, by ją zaznaczyć.</p></fieldset>
    <fieldset class="fs"><legend>Warstwy · branże</legend>${GROUPS.map(g => box('groups', g.key, esc(g.label), cnt('groups', t => t.group === g.key), `<span class="opt__ln">${layerLine(g.key)}</span><span class="opt__code">${layerNo(g.key)}</span>`)).join('')}</fieldset>
    <fieldset class="fs"><legend>Rodzaj zamówienia</legend>${KINDS.map(([k, l]) => box('kind', k, l, cnt('kind', t => t.kind === k))).join('')}</fieldset>
    <fieldset class="fs"><legend>Budżet zamawiającego</legend>${radio('val', VAL)}</fieldset>
    ${scope === 's' ? `<fieldset class="fs"><legend>Termin składania ofert</legend>${radio('within', WITHIN)}</fieldset>` : ''}
    <fieldset class="fs"><legend>Ogłoszenie</legend>${radio('ue', UE)}</fieldset>
    <fieldset class="fs"><legend>Wadium</legend>${radio('wad', WAD)}</fieldset>`;
}
function updateCounts(f, scope) {
  const pool = ALL.filter(isOpen);
  $$(`[data-scope="${scope}"][type=checkbox]`).forEach(inp => {
    const key = inp.dataset.f, v = inp.value;
    const n = pool.filter(t => matches(t, f, key) && (key === 'kind' ? t.kind : t.group) === v).length;
    const el = inp.parentElement.querySelector('.opt__n');
    if (el) el.textContent = n;
    inp.parentElement.classList.toggle('is-zero', !n && !inp.checked);
  });
  $$(`[data-act="parcel"][data-scope="${scope}"]`).forEach(b => {
    const w = b.dataset.woj, on = f.woj.includes(w);
    const n = pool.filter(t => matches(t, f, 'woj') && t.buyer.woj === w).length;
    b.querySelector('span').textContent = n;
    b.style.setProperty('--h', hatch(n));
    b.setAttribute('aria-label', parcelLabel(w, n));
    b.setAttribute('aria-pressed', on);
    b.classList.toggle('is-on', on);
    b.classList.toggle('is-zero', !n);
  });
  const sel = $(`[data-plan-sel="${scope}"]`);
  if (sel) sel.textContent = planSel(f);
}

// ---------- the schedule: one row per tender, each with a dimension line to its deadline ----------
// days across the dimension column, on a square-root scale so the next few days don't collapse into a tick
const SCALE = 30;
const scaleX = days => Math.min(100, Math.sqrt(Math.max(0, days) / SCALE) * 100);
function dim(t) {
  const ms = t.deadline - Date.now();
  if (ms <= 0) return `<div class="dim is-gone"><span class="dim__t">po terminie</span></div>`;
  const pct = scaleX(ms / DAY);
  const tone = ms < DAY ? ' is-red' : ms < 3 * DAY ? ' is-soon' : '';
  return `<div class="dim${tone}${ms > SCALE * DAY ? ' is-over' : ''}${pct < 24 ? ' is-short' : ''}" style="--x:${pct.toFixed(2)}%"><span class="dim__line" aria-hidden="true"></span><span class="dim__t" data-dim="${t.deadline}">${dimLabel(t.deadline)}</span></div>`;
}
function marks(t) {
  const m = [];
  if (isNew(t)) m.push('<abbr class="mk mk--new" title="Nowe ogłoszenie, do 48 godzin od publikacji">N</abbr>');
  if (t.wadium) m.push(`<abbr class="mk" title="Wadium ${fmtMoney(t.wadium)}">W</abbr>`);
  if (t.ue) m.push('<abbr class="mk" title="Ogłoszenie w Dzienniku Urzędowym UE">UE</abbr>');
  if (t.lots.length) m.push(`<abbr class="mk" title="${t.lots.length} ${plural(t.lots.length, 'część', 'części', 'części')}: można złożyć ofertę na wybrane">${t.lots.length} cz.</abbr>`);
  return m.join('');
}
function row(t, i) {
  const on = S.watch.has(t.id);
  return `<article class="row${isOpen(t) ? '' : ' is-gone'}">
    <p class="row__pos">${String(i + 1).padStart(3, '0')}</p>
    <div class="row__main">
      <h3 class="row__title"><a href="#/p/${t.id}">${esc(t.title)}</a>${t.moved ? ' ' + revMark(1) : ''}</h3>
      <p class="row__buyer">${esc(t.buyer.name)} <span>· ${esc(t.buyer.woj)}</span></p>
      <p class="row__meta">${layerTag(t.group)} <span class="row__cpv"><span class="mono">${t.cpv[0]}</span> ${esc(t.cpv[1])}</span></p>
    </div>
    <div class="row__val"><b class="mono">${fmtMoneyShort(t.value)}</b><span class="row__marks">${marks(t)}</span></div>
    <div class="row__dim">${dim(t)}<p class="row__when mono">${fmtDayShort(t.deadline)} · ${fmtTime(t.deadline)}${t.moved ? ` <s title="Pierwotny termin">${fmtDM(t.moved.from)}</s>` : ''}</p></div>
    <button type="button" class="pin${on ? ' is-on' : ''}" data-act="watch" data-id="${t.id}" aria-pressed="${on}" aria-label="${on ? 'Wyjmij z teczki' : 'Przypnij do teczki'}: ${esc(t.title)}">${icon('pin')}</button>
  </article>`;
}
const ruler = () => [0, 1, 3, 7, 14, SCALE].map(d => `<i style="--x:${scaleX(d)}%">${d === SCALE ? d + ' d' : d}</i>`).join('');
function sched(list, opts = {}) {
  return `<div class="sched${opts.cls ? ' ' + opts.cls : ''}">
    <div class="sched__head" aria-hidden="true"><span>Poz.</span><span>Przedmiot · zamawiający · warstwa</span><span>Budżet</span><span class="sched__ruler">${ruler()}</span><span></span></div>
    ${list.length ? list.map((t, i) => row(t, i)).join('') : `<p class="sched__empty">${opts.empty || 'Pusto.'}</p>`}
    ${opts.more || ''}
  </div>`;
}
const legend = () => `<p class="legend"><b>Oznaczenia</b>
  <span><i class="mk mk--new">N</i> nowe, do 48 h</span>
  <span>${revMark(1)} rewizja: termin przesunięty</span>
  <span><i class="mk">W</i> wadium</span>
  <span><i class="mk">UE</i> ponad progi UE</span>
  <span><i class="mk">3 cz.</i> części</span>
  <span><i class="legend__dim"></i> wymiar do terminu, skala pierwiastkowa 0–${SCALE} dni</span></p>`;

// ---------- home ----------
function searchList() {
  const list = ALL.filter(t => isOpen(t) && matches(t, S.f));
  const by = { deadline: (a, b) => a.deadline - b.deadline, new: (a, b) => b.published - a.published, value: (a, b) => b.value - a.value };
  return list.sort(by[S.sort]);
}
function timeChart() {
  const N = 21, base = startOfDay(Date.now()), open = ALL.filter(isOpen);
  const days = Array.from({ length: N }, (_, i) => {
    const s = atDay(base, i), e = atDay(base, i + 1);
    return { s, n: open.filter(t => t.deadline >= s && t.deadline < e).length, we: [0, 6].includes(new Date(s).getDay()) };
  });
  const max = Math.max(...days.map(d => d.n), 1);
  const peak = days.reduce((a, d) => d.n > a.n ? d : a, days[0]);
  const next = open.slice().sort((a, b) => a.deadline - b.deadline)[0];
  return `<figure class="chart">
    <figcaption class="chart__cap"><b>Wymiar czasu</b><span>terminy składania ofert w najbliższych ${N} dniach</span></figcaption>
    <div class="chart__bars" role="list">${days.map((d, i) => `<div class="bar${d.we ? ' is-we' : ''}${i === 0 ? ' is-today' : ''}${d === peak ? ' is-peak' : ''}" role="listitem" style="--h:${d.n / max * 100}%" aria-label="${fmtDayLong(d.s)}: ${d.n} ${plural(d.n, 'termin', 'terminy', 'terminów')}">
      <span class="bar__a"><span class="bar__b"></span><span class="bar__n mono">${d.n || ''}</span></span><span class="bar__d mono">${new Date(d.s).getDate()}</span><span class="bar__w">${i === 0 ? 'dziś' : new Date(d.s).toLocaleDateString(PL, { weekday: 'narrow' })}</span></div>`).join('')}</div>
    <div class="chart__dimx" aria-hidden="true"><span>${N} dni</span></div>
    <p class="chart__note pencil">najwięcej: ${fmtDayLong(peak.s)} — ${peak.n} ${plural(peak.n, 'termin', 'terminy', 'terminów')}</p>
    ${next ? `<p class="chart__next"><span class="kicker">Najbliższy termin</span> <a href="#/p/${next.id}">${esc(next.title)}</a> <span class="chart__left mono" data-left="${next.deadline}">${dimLabel(next.deadline)}</span></p>` : ''}
  </figure>`;
}
function renderHome() {
  const open = ALL.filter(isOpen);
  return `
  <section class="hero">
    <div class="hero__l">
      <p class="kicker">Arkusz 01 · zestawienie ogłoszeń · BZP i TED</p>
      <h1 class="hero__h">Przetargi publiczne, zwymiarowane do terminu.</h1>
      <p class="lead">${open.length} otwartych postępowań. Przy każdym stoi wymiar: ile zostało do złożenia oferty. Odrysuj swoje kryteria na kalkę, a nowe ogłoszenia, które się pod nią zmieszczą, przyjdą do Ciebie same.</p>
      <form class="q" data-form="q" role="search">
        <label for="q" class="q__l">Szukaj w opisach</label>
        <div class="q__row"><input id="q" type="search" autocomplete="off" placeholder="np. kanalizacja, laptopy, 45233140, Lipowiec" value="${esc(S.f.q)}"><button class="btn btn--ink" type="submit">Szukaj</button></div>
      </form>
    </div>
    ${timeChart()}
  </section>
  <section class="search" id="szukaj">
    <aside class="rail" id="rail" aria-label="Filtry">
      <div class="rail__head"><h2 class="rail__h">Kryteria</h2><button type="button" class="link" data-act="clear">Wyczyść</button><button type="button" class="rail__close" data-act="filters" aria-label="Zamknij filtry">${icon('x')}</button></div>
      <div id="facets">${facets(S.f, 's')}</div>
      <div class="rail__foot"><button type="button" class="btn btn--ink btn--block" data-act="filters">Pokaż wyniki</button></div>
    </aside>
    <div id="results">${renderResults()}</div>
  </section>`;
}
function renderResults() {
  const list = searchList();
  const sum = list.reduce((a, t) => a + t.value, 0);
  const week = Math.max(1, Math.round(ALL.filter(t => t.published > Date.now() - 28 * DAY && matches(t, Object.assign({}, S.f, { within: '' }))).length / 4));
  const nF = S.f.kind.length + S.f.groups.length + S.f.woj.length + ['val', 'within', 'ue', 'wad'].filter(k => S.f[k]).length;
  const tags = [];
  if (S.f.q) tags.push(['q', '', `„${S.f.q}”`]);
  S.f.kind.forEach(k => tags.push(['kind', k, KIND[k]]));
  S.f.groups.forEach(g => tags.push(['groups', g, `${layerNo(g)} · ${GROUP[g].label}`]));
  S.f.woj.forEach(w => tags.push(['woj', w, w]));
  [['val', VAL], ['within', WITHIN], ['ue', UE], ['wad', WAD]].forEach(([k, o]) => S.f[k] && tags.push([k, '', (k === 'within' ? 'termin: ' : k === 'val' ? 'budżet: ' : '') + o.find(x => x[0] === S.f[k])[1]]));
  const more = list.length > S.limit ? `<p class="sched__more"><button type="button" class="btn" data-act="more">Pokaż kolejne ${Math.min(40, list.length - S.limit)} z ${list.length - S.limit}</button></p>` : '';
  return `
    <div class="res-bar">
      <p class="res-bar__n"><b class="mono">${list.length}</b> ${plural(list.length, 'przetarg', 'przetargi', 'przetargów')} w zestawieniu <span>· łączny budżet ${fmtMoneyShort(sum)}</span></p>
      <div class="res-bar__r">
        <button type="button" class="btn btn--filters" data-act="filters">${icon('filter')} Kryteria${nF ? ` <b>${nF}</b>` : ''}</button>
        <label class="sel"><span>Kolejność</span> <select data-sort>${[['deadline', 'od najkrótszego wymiaru'], ['new', 'najnowsze ogłoszenia'], ['value', 'największy budżet']].map(([v, l]) => `<option value="${v}"${S.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
    </div>
    ${tags.length ? `<p class="tags">${tags.map(([k, v, l]) => `<button type="button" class="tag" data-act="untag" data-k="${k}" data-v="${esc(v)}">${esc(l)} ${icon('x')}</button>`).join('')}</p>` : ''}
    <div class="trace">
      <div class="trace__t">
        <p class="trace__h pencil">${fActive(S.f) ? 'Odrysuj to na kalkę' : 'Zaznacz kryteria i odrysuj je na kalkę'}</p>
        <p>${fActive(S.f) ? `Pod kryteriami <b>${esc(describe(S.f))}</b> pojawia się ok. <b>${week}</b> ${plural(week, 'nowy przetarg', 'nowe przetargi', 'nowych przetargów')} tygodniowo. Kalka położy się na każde nowe ogłoszenie i wyśle Ci to, co się pod nią zmieści.` : 'Zaznacz działki na planie i warstwy z branżami. Zapisane kryteria to kalka: dostaniesz pismo o każdym nowym ogłoszeniu, które się pod nią zmieści.'}</p>
      </div>
      <button type="button" class="btn btn--pencil" data-act="trace">${icon('kalka')} Zapisz jako kalkę</button>
    </div>
    ${sched(list.slice(0, S.limit), { more, empty: 'Pod tymi kryteriami nie ma otwartych przetargów. Poluzuj kryteria albo zapisz je jako kalkę, a damy znać, gdy coś się pojawi.' })}
    ${legend()}`;
}
function refreshSearch(keepFacets) {
  history.replaceState(null, '', '#/' + (fActive(S.f) ? '?' + fToQS(S.f) : '') + (S.sort !== 'deadline' ? (fActive(S.f) ? '&' : '?') + 'sort=' + S.sort : ''));
  $('#results').innerHTML = renderResults();
  if (keepFacets) updateCounts(S.f, 's');
  else $('#facets').innerHTML = facets(S.f, 's');
}

// ---------- tender sheet ----------
// the procedure as a dimension chain: equal spacing, real lengths written on the lines (drawn not to scale)
function chain(t) {
  const st = [
    { at: t.published, l: 'Ogłoszenie', d: t.ue ? 'Dz.U. UE i BZP' : 'BZP' },
    { at: t.questions, l: 'Pytania do SWZ', d: 'wnioski o wyjaśnienia' },
    { at: t.deadline, l: 'Składanie ofert', d: 'e-Zamówienia', main: true },
    { at: t.deadline + 30 * MIN, l: 'Otwarcie ofert', d: 'jawne, online' },
    { at: t.deadline + 21 * DAY, l: 'Wybór oferty', d: 'szacunkowo', est: true },
    { at: t.deadline + 35 * DAY, l: 'Umowa', d: 'szacunkowo', est: true },
  ];
  const now = Date.now();
  const seg = st.findIndex((s, i) => i < st.length - 1 && s.at <= now && now < st[i + 1].at);
  return `<ol class="chain" aria-label="Harmonogram postępowania">${st.map((s, i) => {
    const nx = st[i + 1];
    const f = i === seg ? (now - s.at) / (nx.at - s.at) * 100 : -1;
    const today = f >= 0 ? `<span class="chain__now" style="--f:${f.toFixed(1)}%"><span>dziś</span></span>` : '';
    // the written length moves aside when today's mark would cross it
    const lx = f >= 0 && Math.abs(f - 50) < 24 ? ` style="--lx:${f < 50 ? 78 : 22}%"` : '';
    return `<li class="chain__st${s.at <= now ? ' is-past' : ''}${s.main ? ' is-main' : ''}${s.est ? ' is-est' : ''}">
      ${nx ? `<span class="chain__seg${nx.est ? ' is-est' : ''}" aria-hidden="true"><span class="chain__len mono"${lx}>${s.est || nx.est ? '~' : ''}${spanLabel(nx.at - s.at)}</span>${today}</span>` : ''}
      <span class="chain__node" aria-hidden="true"></span>
      <span class="chain__lbl${s.main && t.moved ? ' cloud' : ''}">
        <b>${s.l}${s.main && t.moved ? ' ' + revMark(1) : ''}</b>
        <span class="mono">${s.est ? '~' : ''}${fmtDM(s.at)}${s.est ? '' : ' · ' + fmtTime(s.at)}</span>
        <small>${s.d}</small>
        ${s.main && t.moved ? `<small class="chain__was">było: <s>${fmtDM(t.moved.from)} · ${fmtTime(t.moved.from)}</s></small>` : ''}
      </span>
    </li>`;
  }).join('')}</ol><p class="note pencil">rys. nie w skali: odstępy równe, długości opisane</p>`;
}
function renderTender(id) {
  const t = BY_ID.get(id);
  if (!t) return `<section class="page"><h1 class="h1">Nie ma takiego arkusza</h1><p><a class="btn" href="#/">${icon('back')} Wróć do zestawienia</a></p></section>`;
  const on = S.watch.has(t.id), open = isOpen(t);
  const ms = t.deadline - Date.now();
  const sim = ALL.filter(x => x.id !== t.id && isOpen(x) && x.group === t.group).sort((a, b) => (b.buyer.woj === t.buyer.woj) - (a.buyer.woj === t.buyer.woj) || a.deadline - b.deadline).slice(0, 4);
  const lotSum = t.lots.reduce((a, l) => a + l.value, 0);
  const kb = d => d.kb > 1024 ? (d.kb / 1024).toLocaleString(PL, { maximumFractionDigits: 1 }) + ' MB' : d.kb + ' kB';
  return `<article class="tp">
    <p class="crumbs"><a href="#/">${icon('back')} Zestawienie</a> <span>/</span> ${layerTag(t.group)}</p>
    <header class="tp__head">
      <p class="kicker"><span class="mono">${t.no}</span> · ${esc(t.tryb)}</p>
      <h1 class="tp__h">${esc(t.title)}</h1>
      <p class="tp__buyer">${esc(t.buyer.name)} · ${esc(t.buyer.woj)}</p>
      <p class="tp__marks">${marks(t)}</p>
      <div class="tp__act">
        <button type="button" class="btn${on ? ' is-on' : ''}" data-act="watch" data-id="${t.id}" aria-pressed="${on}">${icon('pin')} ${on ? 'W teczce' : 'Przypnij do teczki'}</button>
        <button type="button" class="btn" data-act="ics" data-id="${t.id}">${icon('cal')} Do kalendarza</button>
        <button type="button" class="btn" data-act="copy">${icon('link')} Kopiuj link</button>
        <button type="button" class="btn btn--pencil" data-act="trace-like" data-id="${t.id}">${icon('kalka')} Kalka na podobne</button>
      </div>
    </header>
    <section class="tp__sec"><h2 class="h2"><span class="h2__no">1</span>Harmonogram · łańcuch wymiarowy</h2>${chain(t)}</section>
    <div class="tp__grid">
      <div class="tp__body">
        <section class="tp__sec"><h2 class="h2"><span class="h2__no">2</span>Przedmiot zamówienia</h2>
          <p>Przedmiotem zamówienia jest zadanie „${esc(t.title)}”. Zakres obejmuje w szczególności:</p>
          <ol class="notes">${t.scope.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          <p>Termin realizacji: ${esc(t.period)}. Zamawiający ${t.lots.length ? 'dopuszcza składanie ofert częściowych' : 'nie dopuszcza ofert częściowych'} i nie przewiduje aukcji elektronicznej.</p>
        </section>
        ${t.lots.length ? `<section class="tp__sec"><h2 class="h2"><span class="h2__no">2a</span>Wykaz części</h2><p class="muted">Ofertę można złożyć na dowolną liczbę części. Każda część to osobna umowa.</p>
          <div class="scroll"><table class="bom"><thead><tr><th scope="col">Poz.</th><th scope="col">Część</th><th scope="col" class="num">Wartość szac.</th><th scope="col">Udział</th></tr></thead>
          <tbody>${t.lots.map(l => `<tr><td class="mono">${String(l.n).padStart(2, '0')}</td><td>${esc(l.name)}</td><td class="num mono">${fmtMoneyShort(l.value)}</td><td><span class="bom__bar" style="--w:${(l.value / lotSum * 100).toFixed(1)}%"></span><span class="mono">${Math.round(l.value / lotSum * 100)}%</span></td></tr>`).join('')}</tbody>
          <tfoot><tr><td></td><th scope="row">Razem</th><td class="num mono">${fmtMoneyShort(lotSum)}</td><td class="mono">100%</td></tr></tfoot></table></div></section>` : ''}
        <section class="tp__sec"><h2 class="h2"><span class="h2__no">3</span>Warunki udziału</h2><ol class="notes">${t.reqs.map(s => `<li>${esc(s)}</li>`).join('')}<li>Brak podstaw wykluczenia z art. 108 ust. 1 ustawy Pzp</li></ol></section>
        <section class="tp__sec"><h2 class="h2"><span class="h2__no">4</span>Kryteria oceny ofert</h2>
          <div class="crit">${t.criteria.map(([n, w]) => `<div class="crit__seg" style="flex:${w}"><span class="crit__w mono">${w}%</span><span class="crit__line" aria-hidden="true"></span><span class="crit__n">${esc(n)}</span></div>`).join('')}</div></section>
        <section class="tp__sec"><h2 class="h2"><span class="h2__no">5</span>Spis dokumentów</h2>
          <div class="scroll"><table class="docs"><thead><tr><th scope="col">Nr</th><th scope="col">Dokument</th><th scope="col">Format</th><th scope="col" class="num">Rozmiar</th></tr></thead>
          <tbody>${t.docs.map((d, i) => `<tr><td class="mono">D-${String(i + 1).padStart(2, '0')}</td><td><button type="button" class="link" data-act="doc">${icon('file')} ${esc(d.name)}</button></td><td class="mono">.${d.ext}</td><td class="num mono">${kb(d)}</td></tr>`).join('')}</tbody></table></div></section>
      </div>
      <aside class="tp__side">
        <div class="due${open ? (ms < DAY ? ' is-red' : '') : ' is-gone'}">
          <p class="due__l">${open ? 'Do terminu składania ofert' : 'Termin składania ofert minął'}</p>
          <p class="due__big mono" data-left="${t.deadline}">${dimLabel(t.deadline)}</p>
          <p class="due__d">${fmtDayLong(t.deadline)}, godz. ${fmtTime(t.deadline)}</p>
          ${dim(t)}
          <button type="button" class="btn btn--ink btn--block" data-act="submit-offer"${open ? '' : ' disabled'}>${open ? 'Złóż ofertę na platformie' : 'Termin minął'} ${icon('arrow')}</button>
        </div>
        ${t.moved ? `<table class="revs"><caption>Tabela zmian</caption><thead><tr><th scope="col">Rew.</th><th scope="col">Opis</th><th scope="col">Data</th></tr></thead><tbody>
          <tr class="is-rev"><td>${revMark(1)}</td><td>Zmiana treści SWZ: termin składania ofert z ${fmtDM(t.moved.from)}, ${fmtTime(t.moved.from)} na ${fmtDM(t.deadline)}, ${fmtTime(t.deadline)}</td><td class="mono">${fmtDM(t.moved.at)}</td></tr>
          <tr><td class="mono">0</td><td>Wydanie pierwotne: ogłoszenie</td><td class="mono">${fmtDM(t.published)}</td></tr></tbody></table>` : ''}
        <dl class="tblock" aria-label="Metryczka postępowania">
          <div class="w2"><dt>Zamawiający</dt><dd>${esc(t.buyer.name)}</dd></div>
          <div class="w2"><dt>Obiekt</dt><dd>${esc(t.title)}</dd></div>
          <div><dt>Budżet</dt><dd class="tblock__big mono">${fmtMoney(t.value)}</dd></div>
          <div><dt>Wadium</dt><dd class="mono">${t.wadium ? fmtMoney(t.wadium) : 'nie wymagane'}</dd></div>
          <div><dt>Rodzaj</dt><dd>${KIND[t.kind]}</dd></div>
          <div><dt>Warstwa</dt><dd>${layerNo(t.group)} · ${esc(GROUP[t.group].label)}</dd></div>
          <div class="w2"><dt>CPV</dt><dd><span class="mono">${t.cpv[0]}</span> ${esc(t.cpv[1])}</dd></div>
          <div><dt>Ogłoszenie</dt><dd class="mono">${fmtStamp(t.published)}</dd></div>
          <div><dt>Pytania do SWZ do</dt><dd class="mono">${fmtStamp(t.questions)}</dd></div>
          <div><dt>Otwarcie ofert</dt><dd class="mono">${fmtStamp(t.deadline + 30 * MIN)}</dd></div>
          <div><dt>Związanie ofertą</dt><dd>${t.ue ? 90 : 30} dni</dd></div>
          <div class="w2"><dt>Kontakt</dt><dd class="mono">${esc(t.contact)}</dd></div>
          <div><dt>Arkusz</dt><dd class="mono">1 / 1</dd></div>
          <div><dt>Rew.</dt><dd class="mono">${t.moved ? '1' : '0'}</dd></div>
        </dl>
      </aside>
    </div>
    ${sim.length ? `<section class="tp__sec"><h2 class="h2"><span class="h2__no">6</span>Ta sama warstwa · ${esc(GROUP[t.group].label)}</h2>${sched(sim, { cls: 'sched--mini' })}</section>` : ''}
  </article>`;
}

// ---------- kalki: saved searches drawn on tracing paper ----------
function kalkaStats(k) {
  return {
    open: ALL.filter(t => isOpen(t) && matches(t, k.f)).length,
    week: ALL.filter(t => t.published > Date.now() - 7 * DAY && matches(t, k.f)).length,
  };
}
function kalkaCard(k, i) {
  const st = kalkaStats(k);
  return `<article class="kalka${k.paused ? ' is-paused' : ''}" id="kk-${k.id}" style="--tilt:${i % 2 ? 0.4 : -0.5}deg">
    <div class="kalka__top"><p class="mono">Kalka nr ${k.no}</p><p class="kalka__st">${k.paused ? 'wstrzymana' : 'w obiegu'}</p></div>
    <h3 class="kalka__name pencil">${esc(k.name)}</h3>
    <div class="kalka__grid">
      <div class="kalka__trace">${plan(k.f, '', true)}
        <p class="kalka__layers">${k.f.groups.length ? k.f.groups.map(g => `<span>${layerLine(g, 22)} ${layerNo(g)}</span>`).join('') : '<span>wszystkie warstwy</span>'}</p></div>
      <dl class="kalka__dl">
        <div class="wide"><dt>Obrys</dt><dd>${esc(describe(k.f))}</dd></div>
        <div><dt>Słowa kluczowe</dt><dd>${k.f.q ? `„${esc(k.f.q)}”` : 'dowolne'}</dd></div>
        <div><dt>Wysyłka</dt><dd>${FREQ[k.freq]}</dd></div>
        <div class="wide"><dt>Doręczenie</dt><dd>${CHANNEL[k.channel][0]}: <span class="mono">${esc(k.dest)}</span></dd></div>
        <div><dt>Pod kalką teraz</dt><dd><b class="mono">${st.open}</b> ${plural(st.open, 'otwarty', 'otwarte', 'otwartych')}</dd></div>
        <div><dt>Ostatnie 7 dni</dt><dd><b class="mono">${st.week}</b> ${plural(st.week, 'nowy', 'nowe', 'nowych')}</dd></div>
      </dl>
    </div>
    <p class="kalka__sign pencil">odrysowano ${fmtDM(k.created)}.${String(new Date(k.created).getFullYear()).slice(2)} o ${fmtTime(k.created)}</p>
    ${k.paused ? '<p class="stamp">Wstrzymana</p>' : ''}
    <footer class="kalka__act">
      <a class="link" href="#/?${fToQS(k.f)}">Pokaż w zestawieniu ${icon('arrow')}</a>
      <button type="button" class="link" data-act="preview" data-id="${k.id}">Podgląd pisma</button>
      <button type="button" class="link" data-act="edit-kalka" data-id="${k.id}">Popraw</button>
      <button type="button" class="link" data-act="pause" data-id="${k.id}">${k.paused ? 'Wznów' : 'Wstrzymaj'}</button>
      <button type="button" class="link link--danger" data-act="del-kalka" data-id="${k.id}">Usuń</button>
    </footer>
  </article>`;
}
function renderKalki() {
  const fmt = (a, w) => `<span class="fmt" style="--w:${w}px" aria-hidden="true"><i>${a}</i></span>`;
  return `<section class="page">
    <header class="page-head">
      <div><p class="kicker">Arkusz 02 · subskrypcje</p><h1 class="h1">Kalki</h1>
      <p class="lead">Kalka to Twoje kryteria wyszukiwania odrysowane na przezroczystym arkuszu. Kładziemy ją na każde nowe ogłoszenie z BZP i TED. Co się pod nią zmieści, wysyłamy Ci w piśmie: od razu, rano albo raz w tygodniu.</p></div>
      <div class="page-head__act">
        <button type="button" class="btn btn--pencil" data-act="new-kalka">${icon('kalka')} Nowa kalka</button>
        <button type="button" class="btn" data-act="simulate">Symuluj poranek: nowe ogłoszenia</button>
      </div>
    </header>
    <div class="kalki">${S.kalki.length ? S.kalki.map(kalkaCard).join('') : `<div class="empty"><p class="empty__h pencil">Nie masz jeszcze kalki.</p><p>Ustaw kryteria w <a href="#/">zestawieniu</a> i kliknij „Zapisz jako kalkę”, albo zacznij od czystego arkusza.</p></div>`}</div>
    <section class="fares" aria-labelledby="faresH">
      <h2 class="h2" id="faresH"><span class="h2__no">§</span>Formaty arkuszy · cennik</h2>
      <div class="scroll"><table class="fares__t">
        <thead><tr><th scope="col"></th><th scope="col">${fmt('A4', 22)}Szkic<span>0 zł</span></th><th scope="col" class="is-hit">${fmt('A3', 31)}Projekt<span>49 zł / mies.</span></th><th scope="col">${fmt('A0', 62)}Biuro<span>149 zł / mies.</span></th></tr></thead>
        <tbody>
          <tr><th scope="row">Kalki</th><td>1</td><td class="is-hit">10</td><td>bez limitu</td></tr>
          <tr><th scope="row">Wysyłka pism</th><td>w poniedziałki</td><td class="is-hit">codziennie lub od razu</td><td>codziennie lub od razu</td></tr>
          <tr><th scope="row">Doręczenie</th><td>e-mail</td><td class="is-hit">e-mail, SMS</td><td>e-mail, SMS, webhook, API</td></tr>
          <tr><th scope="row">Rewizje w teczce</th><td>—</td><td class="is-hit">tak</td><td>tak, z historią zmian SWZ</td></tr>
          <tr><th scope="row">Osoby w biurze</th><td>1</td><td class="is-hit">1</td><td>do 10</td></tr>
        </tbody>
      </table></div>
      <p class="muted">Ceny brutto, makieta. Kalkę można wstrzymać w każdej chwili.</p>
    </section>
  </section>`;
}
function kalkaDraftFrom(f, name) {
  const g = Object.assign(emptyF(), JSON.parse(JSON.stringify(f)), { within: '' });
  return { id: null, name: name || shortName(g), f: g, freq: 'daily', channel: 'email', dest: store.get('dest', CHANNEL.email[1]) };
}
function builderEstimate(d) {
  const open = ALL.filter(t => isOpen(t) && matches(t, d.f)).length;
  const wk = Math.round(ALL.filter(t => t.published > Date.now() - 28 * DAY && matches(t, d.f)).length / 4);
  return `Pod tą kalką jest teraz <b>${open}</b> ${plural(open, 'otwarty przetarg', 'otwarte przetargi', 'otwartych przetargów')}, a co tydzień pojawia się ok. <b>${wk}</b> ${plural(wk, 'nowy', 'nowe', 'nowych')}.${wk > 25 && d.freq === 'instant' ? ' To sporo jak na pisma od razu; rozważ wysyłkę poranną.' : ''}${open === 0 ? ' Kalka jest pusta: sprawdź kryteria.' : ''}`;
}
function openBuilder(d) {
  S.draft = d;
  openModal(`
    <header class="modal__head"><h2 id="mTitle" class="h2">${d.id ? 'Popraw kalkę' : 'Nowa kalka'}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Zamknij">${icon('x')}</button></header>
    <form class="builder" data-form="kalka">
      <div class="builder__row">
        <label class="fld"><span>Nazwa kalki</span><input name="name" value="${esc(d.name)}" required autofocus></label>
        <label class="fld"><span>Słowa kluczowe</span><input name="q" data-scope="b" value="${esc(d.f.q)}" placeholder="np. kanalizacja, fotowoltaika"></label>
      </div>
      <div class="builder__facets">${facets(d.f, 'b')}</div>
      <div class="builder__row">
        <fieldset class="fs"><legend>Wysyłka pism</legend>${Object.entries(FREQ).map(([k, l]) => `<label class="opt opt--r"><input type="radio" name="freq" value="${k}"${d.freq === k ? ' checked' : ''}><span class="opt__box" aria-hidden="true"></span><span class="opt__l">${l}</span></label>`).join('')}</fieldset>
        <fieldset class="fs"><legend>Doręczenie</legend>${Object.entries(CHANNEL).map(([k, [l]]) => `<label class="opt opt--r"><input type="radio" name="channel" value="${k}"${d.channel === k ? ' checked' : ''}><span class="opt__box" aria-hidden="true"></span><span class="opt__l">${l}</span></label>`).join('')}
          <label class="fld fld--tight"><span class="sr-only">Adres doręczenia</span><input name="dest" value="${esc(d.dest)}" placeholder="${esc(CHANNEL[d.channel][1])}" required></label></fieldset>
      </div>
      <p class="builder__est" id="bEst" aria-live="polite">${builderEstimate(d)}</p>
      <footer class="modal__foot"><button type="button" class="btn" data-act="close">Anuluj</button><button type="submit" class="btn btn--pencil">${icon('kalka')} ${d.id ? 'Zapisz zmiany' : 'Odrysuj kalkę'}</button></footer>
    </form>`, true);
}
function digestFor(k, ids) {
  const list = ids.map(id => BY_ID.get(id)).filter(Boolean);
  return `
    <header class="modal__head"><h2 id="mTitle" class="h2">Podgląd pisma</h2><button type="button" class="icon-btn" data-act="close" aria-label="Zamknij">${icon('x')}</button></header>
    <div class="mail">
      <dl class="mail__hdr">
        <div><dt>Od</dt><dd>Peron &lt;pisma@peron.example&gt;</dd></div>
        <div><dt>Do</dt><dd>${esc(k.dest)}</dd></div>
        <div><dt>Temat</dt><dd><b>${list.length} ${plural(list.length, 'nowy przetarg', 'nowe przetargi', 'nowych przetargów')} pod kalką „${esc(k.name)}”</b></dd></div>
      </dl>
      <div class="mail__body">
        <p class="mail__brand">Peron <span>pismo ${k.freq === 'instant' ? 'natychmiastowe' : k.freq === 'daily' ? 'poranne' : 'tygodniowe'}</span></p>
        <p>Dzień dobry, pod kalką <b>${esc(describe(k.f))}</b>${k.f.q ? ` ze słowami „${esc(k.f.q)}”` : ''} zmieściły się nowe ogłoszenia:</p>
        ${list.length ? `<ol class="mail__list">${list.map(t => `<li>
          <a href="#/p/${t.id}" data-act="close-go">${esc(t.title)}</a>
          <p>${esc(t.buyer.name)} · ${fmtMoneyShort(t.value)}${t.wadium ? ` · wadium ${fmtMoney(t.wadium)}` : ''}</p>
          <p class="mail__when mono">termin ${fmtDM(t.deadline)}, ${fmtTime(t.deadline)} · zostało ${dimLabel(t.deadline)}</p></li>`).join('')}</ol>` : '<p class="muted">W ostatnich 7 dniach nic nowego pod tą kalką. W takim wypadku pismo nie jest wysyłane.</p>'}
        <p class="mail__foot">Dostajesz to pismo, bo masz kalkę nr ${k.no}. Popraw, wstrzymaj albo usuń kalkę na peron.example/kalki.</p>
      </div>
    </div>`;
}

// ---------- simulation: a new morning of notices ----------
function simulate() {
  const r = rng(Date.now() % 1e9);
  const made = [];
  const active = S.kalki.filter(k => !k.paused);
  const pubAt = () => Date.now() - Math.floor(r() * 90) * MIN;
  // aim at least one hit per active kalka so the demo shows something, plus a few random ones
  active.forEach(k => {
    for (let i = 0; i < 80; i++) {
      const t = makeTender(r, 0, BUYERS, { published: pubAt(), id: 's' + Date.now().toString(36) + made.length });
      if (matches(t, Object.assign({}, k.f, { within: '' })) && r() < 0.85) { made.push(t); break; }
    }
  });
  const extraN = 3 + Math.floor(r() * 4);
  for (let i = 0; i < extraN; i++) made.push(makeTender(r, 0, BUYERS, { published: pubAt(), id: 's' + Date.now().toString(36) + made.length }));
  S.extra = S.extra.concat(made);
  store.set('extra', S.extra);
  reindex();
  const msgs = [];
  active.forEach(k => {
    const ids = made.filter(t => matches(t, k.f)).map(t => t.id);
    if (ids.length) msgs.push({ id: 'm' + Date.now().toString(36) + k.id, at: Date.now(), kind: 'digest', kalka: k.id, ids, read: false });
  });
  // a tender in the folder gets its deadline pushed back: a revision
  const w = ALL.filter(t => S.watch.has(t.id) && isOpen(t) && t.deadline - Date.now() > DAY);
  if (w.length) {
    const t = w[Math.floor(r() * w.length)];
    const from = t.deadline, by = 3 + Math.floor(r() * 5);
    S.patches[t.id] = { moved: { from, at: Date.now() }, deadline: weekday(atDay(from, by)) + (from - startOfDay(from)) };
    store.set('patches', S.patches);
    reindex();
    msgs.push({ id: 'mv' + Date.now().toString(36), at: Date.now(), kind: 'move', ids: [t.id], from, read: false });
  }
  S.inbox = msgs.concat(S.inbox).slice(0, 60);
  saveInbox();
  toast(`<b>Opublikowano ${made.length} ${plural(made.length, 'nowe ogłoszenie', 'nowe ogłoszenia', 'nowych ogłoszeń')}.</b> ${msgs.length ? `${msgs.length} ${plural(msgs.length, 'pismo czeka', 'pisma czekają', 'pism czeka')} w <a href="#/pisma">pismach</a>.` : 'Nic nie zmieściło się pod Twoimi kalkami.'}`);
  rerender();
}

// ---------- letters (inbox) ----------
function renderPisma() {
  const total = S.inbox.length, Y = new Date().getFullYear();
  const html = S.inbox.map((m, i) => {
    const list = m.ids.map(id => BY_ID.get(id)).filter(Boolean);
    const no = `${Y}/${String(total - i).padStart(3, '0')}`;
    const head = kind => `<header class="letter__head"><p class="letter__kind">${kind}</p><p class="mono">Nr ${no}</p><p class="mono">${fmtStamp(m.at)}</p></header>`;
    if (m.kind === 'move') {
      const t = list[0];
      if (!t) return '';
      return `<article class="letter letter--rev${m.read ? '' : ' is-unread'}">
        ${head('Zawiadomienie o rewizji')}
        <p class="letter__re">Dotyczy: przetarg z teczki</p>
        <p class="letter__h"><a href="#/p/${t.id}">${esc(t.title)}</a> ${revMark(1)}</p>
        <p>Zamawiający opublikował zmianę treści SWZ. Nowy termin składania ofert: <span class="cloud"><b>${fmtDayLong(t.deadline)}, ${fmtTime(t.deadline)}</b></span> zamiast <s>${fmtDM(m.from)}, ${fmtTime(m.from)}</s>.</p>
      </article>`;
    }
    const k = S.kalki.find(x => x.id === m.kalka);
    return `<article class="letter${m.read ? '' : ' is-unread'}">
      ${head('Pismo przewodnie')}
      <p class="letter__re">Dotyczy: ${k ? `kalka nr ${k.no} „${esc(k.name)}”` : 'kalka usunięta'}</p>
      <p>Przekazujemy ${list.length} ${plural(list.length, 'nowy przetarg, który zmieścił', 'nowe przetargi, które zmieściły', 'nowych przetargów, które zmieściły')} się pod kalką:</p>
      <table class="letter__t"><thead><tr><th scope="col">Lp.</th><th scope="col">Przedmiot</th><th scope="col">Zamawiający</th><th scope="col" class="num">Budżet</th><th scope="col">Termin</th></tr></thead>
      <tbody>${list.map((t, j) => `<tr><td class="mono">${j + 1}.</td><td><a href="#/p/${t.id}">${esc(t.title)}</a></td><td>${esc(t.buyer.town)}</td><td class="num mono">${fmtMoneyShort(t.value)}</td><td class="mono">${fmtDM(t.deadline)}</td></tr>`).join('')}</tbody></table>
      ${k ? `<p class="letter__foot"><button type="button" class="link" data-act="preview-msg" data-id="${m.id}">Zobacz jako e-mail</button></p>` : ''}
    </article>`;
  }).join('');
  return `<section class="page">
    <header class="page-head">
      <div><p class="kicker">Arkusz 04 · powiadomienia</p><h1 class="h1">Pisma</h1><p class="lead">Wszystko, co kalki i teczka wysłały na Twoje kanały, z numerem i godziną nadania. Pismo przewodnie przekazuje nowe przetargi spod kalki, zawiadomienie o rewizji mówi, że w przetargu z teczki zmienił się termin.</p></div>
      <div class="page-head__act"><button type="button" class="btn" data-act="simulate">Symuluj poranek: nowe ogłoszenia</button></div>
    </header>
    <div class="letters">${html || `<div class="empty"><p class="empty__h pencil">Żadnych pism.</p><p>Kliknij „Symuluj poranek”, żeby zobaczyć, co przyszłoby rano spod Twoich kalek.</p></div>`}</div>
  </section>`;
}

// ---------- folder (watched) ----------
function renderTeczka() {
  const list = [...S.watch].map(id => BY_ID.get(id)).filter(Boolean).sort((a, b) => a.deadline - b.deadline);
  const open = list.filter(isOpen), gone = list.filter(t => !isOpen(t));
  return `<section class="page">
    <header class="page-head">
      <div><p class="kicker">Arkusz 03 · obserwowane</p><h1 class="h1">Teczka</h1><p class="lead">Przetargi, na które się szykujesz. Gdy zamawiający przesunie termin albo zmieni SWZ, dostaniesz zawiadomienie o rewizji.</p></div>
      ${open.length ? `<div class="page-head__act"><button type="button" class="btn" data-act="ics-all">${icon('cal')} Wszystkie do kalendarza (.ics)</button></div>` : ''}
    </header>
    ${list.length ? sched(open, { empty: 'Wszystkim przetargom z teczki minął termin.' }) : `<div class="empty"><p class="empty__h pencil">Teczka jest pusta.</p><p>Kliknij pinezkę przy przetargu w <a href="#/">zestawieniu</a>, a trafi tutaj razem z wymiarem do terminu.</p></div>`}
    ${gone.length ? `<h2 class="h2 gone-h">Po terminie</h2>${sched(gone, { cls: 'sched--gone' })}` : ''}
  </section>`;
}

// ---------- calendar export ----------
function ics(list) {
  const d = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const clean = s => s.replace(/[,;\\]/g, m => '\\' + m);
  const ev = list.map(t => ['BEGIN:VEVENT', `UID:${t.id}@peron.example`, `DTSTAMP:${d(Date.now())}`, `DTSTART:${d(t.deadline - HOUR)}`, `DTEND:${d(t.deadline)}`,
    `SUMMARY:${clean('Termin ofert: ' + t.title)}`, `DESCRIPTION:${clean(`${t.buyer.name}. ${t.no}. Budżet ${fmtMoney(t.value)}.`)}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Jutro termin składania ofert', 'END:VALARM', 'END:VEVENT'].join('\r\n'));
  const blob = new Blob([['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Peron//makieta v2//PL', ...ev, 'END:VCALENDAR'].join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = list.length === 1 ? `przetarg-${list[0].id}.ics` : 'peron-teczka.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`Zapisano ${list.length} ${plural(list.length, 'termin', 'terminy', 'terminów')} do pliku .ics, z przypomnieniem dzień wcześniej.`);
}

// ---------- header ----------
function updateNav() {
  const set = (id, n) => { const el = $(id); el.hidden = !n; el.textContent = n; };
  set('#navKalki', S.kalki.filter(k => !k.paused).length);
  set('#navWatch', [...S.watch].filter(id => BY_ID.get(id) && isOpen(BY_ID.get(id))).length);
  set('#navInbox', S.inbox.filter(m => !m.read).length);
}
const curTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function syncTheme() {
  const dark = curTheme() === 'dark', b = $('.theme-btn');
  b.querySelector('.theme-btn__l').textContent = dark ? 'Błękit' : 'Ozalid';
  b.setAttribute('aria-label', `Arkusz: ${dark ? 'błękitna kopia' : 'odbitka ozalidowa'}. Przełącz na ${dark ? 'ozalid' : 'błękit'}`);
}
function tickHeader() {
  $('#hdrDate').textContent = fmtDate(Date.now());
  $('#hdrTime').textContent = fmtTime(Date.now());
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
  let html, nav = '', title = 'Peron · kreślarnia przetargów publicznych';
  document.body.classList.remove('has-filters');
  if (!p0) {
    S.f = fFromParams(params);
    S.sort = ['deadline', 'new', 'value'].includes(params.sort) ? params.sort : 'deadline';
    if (!keep) S.limit = 40;
    html = renderHome(); nav = 'home';
  } else if (p0 === 'p') { html = renderTender(p1); const t = BY_ID.get(p1); if (t) title = `${t.title} · Peron`; }
  else if (p0 === 'kalki') { html = renderKalki(); nav = 'kalki'; title = 'Kalki · Peron'; }
  else if (p0 === 'teczka') { html = renderTeczka(); nav = 'teczka'; title = 'Teczka · Peron'; }
  else if (p0 === 'pisma') { html = renderPisma(); nav = 'pisma'; title = 'Pisma · Peron'; S.inbox.forEach(m => m.read = true); saveInbox(); }
  else html = `<section class="page"><h1 class="h1">Nie ma takiego arkusza</h1><p><a class="btn" href="#/">${icon('back')} Zestawienie</a></p></section>`;
  const key = parts.join('/');
  const y = scrollY;
  $app.innerHTML = html;
  document.title = title;
  $$('[data-nav]').forEach(a => a.classList.toggle('is-on', a.dataset.nav === nav));
  updateNav();
  if (keep && key === lastKey) scrollTo(0, y);
  else { scrollTo(0, 0); $app.focus({ preventScroll: true }); }
  lastKey = key;
}
const rerender = () => route(true);

// ---------- events ----------
function draftF(scope) { return scope === 's' ? S.f : S.draft.f; }
function afterFilter(scope) {
  if (scope === 's') { S.limit = 40; refreshSearch(true); return; }
  updateCounts(S.draft.f, 'b');
  $('#bEst').innerHTML = builderEstimate(S.draft);
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act, id = a.dataset.id;
  if (act === 'backdrop') { if (e.target === a) closeModal(); return; }
  if (act === 'close') return closeModal();
  if (act === 'close-go') { closeModal(); return; }
  if (act === 'theme') {
    const next = curTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
    return syncTheme();
  }
  if (act === 'parcel') {
    const f = draftF(a.dataset.scope), w = a.dataset.woj;
    f.woj = f.woj.includes(w) ? f.woj.filter(x => x !== w) : f.woj.concat(w);
    return afterFilter(a.dataset.scope);
  }
  if (act === 'watch') {
    const on = !S.watch.has(id);
    on ? S.watch.add(id) : S.watch.delete(id);
    saveWatch();
    $$(`[data-act="watch"][data-id="${id}"]`).forEach(b => {
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on);
      if (b.classList.contains('btn')) b.innerHTML = `${icon('pin')} ${on ? 'W teczce' : 'Przypnij do teczki'}`;
      else b.setAttribute('aria-label', b.getAttribute('aria-label').replace(/^[^:]+/, on ? 'Wyjmij z teczki' : 'Przypnij do teczki'));
    });
    updateNav();
    if (on) toast('Przypięto do teczki. Jeśli termin się zmieni, dostaniesz zawiadomienie o rewizji.');
    if (parseHash().parts[0] === 'teczka') rerender();
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
  if (act === 'trace') return openBuilder(kalkaDraftFrom(S.f));
  if (act === 'trace-like') { const t = BY_ID.get(id); return openBuilder(kalkaDraftFrom(Object.assign(emptyF(), { groups: [t.group], woj: [t.buyer.woj] }))); }
  if (act === 'new-kalka') return openBuilder(kalkaDraftFrom(emptyF(), 'Nowa kalka'));
  if (act === 'edit-kalka') { const k = S.kalki.find(x => x.id === id); return openBuilder(JSON.parse(JSON.stringify(k))); }
  if (act === 'pause') { const k = S.kalki.find(x => x.id === id); k.paused = !k.paused; saveKalki(); toast(k.paused ? `Kalka „${esc(k.name)}” wstrzymana. Pisma nie będą wysyłane.` : `Kalka „${esc(k.name)}” znów w obiegu.`); return rerender(); }
  if (act === 'del-kalka') {
    const k = S.kalki.find(x => x.id === id);
    if (!confirm(`Usunąć kalkę „${k.name}”?`)) return;
    S.kalki = S.kalki.filter(x => x.id !== id); saveKalki(); toast('Kalka usunięta.'); return rerender();
  }
  if (act === 'preview') {
    const k = S.kalki.find(x => x.id === id);
    const ids = ALL.filter(t => t.published > Date.now() - 7 * DAY && isOpen(t) && matches(t, k.f)).sort((a, b) => b.published - a.published).slice(0, 6).map(t => t.id);
    return openModal(digestFor(k, ids));
  }
  if (act === 'preview-msg') { const m = S.inbox.find(x => x.id === id); const k = S.kalki.find(x => x.id === m.kalka); return openModal(digestFor(k, m.ids)); }
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
  if (S.draft && el.closest('[data-form="kalka"]')) {
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
    const f = draftF(el.dataset.scope), k = el.dataset.f;
    if (el.type === 'checkbox') f[k] = el.checked ? f[k].concat(el.value) : f[k].filter(x => x !== el.value);
    else f[k] = el.value;
    return afterFilter(el.dataset.scope);
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
  if (form.dataset.form === 'kalka') {
    e.preventDefault();
    const d = S.draft;
    if (d.channel === 'email') store.set('dest', d.dest);
    if (d.id) {
      const i = S.kalki.findIndex(x => x.id === d.id);
      S.kalki[i] = Object.assign(S.kalki[i], { name: d.name, f: d.f, freq: d.freq, channel: d.channel, dest: d.dest });
      saveKalki(); closeModal(); toast('Kalka poprawiona.');
      if (parseHash().parts[0] === 'kalki') rerender();
      return;
    }
    const no = String(Math.max(47, ...S.kalki.map(k => +k.no)) + 1 + Math.floor(Math.random() * 9)).padStart(4, '0');
    const k = { id: 'k' + Date.now().toString(36), no, name: d.name || shortName(d.f), f: d.f, freq: d.freq, channel: d.channel, dest: d.dest, created: Date.now(), paused: false };
    S.kalki.unshift(k);
    saveKalki();
    closeModal();
    if (parseHash().parts[0] === 'kalki') rerender(); else location.hash = '#/kalki';
    requestAnimationFrame(() => { const el = $('#kk-' + k.id); if (el) el.classList.add('is-fresh'); });
    toast(`Kalka nr ${no} odrysowana. Pierwsze pismo: ${FREQ[k.freq].toLowerCase()}.`);
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

// live bits: the header clock and every written length tick every 30 s
setInterval(() => {
  tickHeader();
  $$('[data-left]').forEach(el => el.textContent = dimLabel(+el.dataset.left));
  $$('[data-dim]').forEach(el => el.textContent = dimLabel(+el.dataset.dim));
}, 30000);

$('#year').textContent = new Date().getFullYear();
tickHeader();
syncTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
addEventListener('hashchange', () => route(false));
route(false);
