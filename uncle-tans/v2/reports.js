// Reports – reports.html. The owner's look back at online orders: sales, what to reconcile (paid online vs collected
// in person) and what Przelewy24 pays out, best sellers, busy hours, delivery areas, service times, customers and every
// single order – for a period, compared with the one before or with a year earlier. A short summary of each day goes
// to the owner by e-mail / SMS after closing.
// Production: behind the owner's login (the counter tablet only gets the orders panel), numbers from the backend.
// Mock: a PIN stands in for the login; the days before today are generated, seeded per date so a day looks the same
// on every reload; today is the panel's real orders (localStorage, common.js) and updates live.

const LOCALES = { pl: 'pl-PL', en: 'en-GB', de: 'de-DE', vi: 'vi-VN' };
const HISTORY_DAYS = 740;                        // a custom range up to a year back, compared with the year before it
const CUSTOM_DAYS = 366;                         // how far back a custom range can start
const OPEN_HOURS = [12, 21];                     // first and last hour that takes orders (R.hours 12:00–22:00)
const CLOSED = ['done', 'rejected'];
const TOP_DISHES = 8, TOP_CATS = 8, LIST_PAGE = 30, PAYOUTS_SHOWN = 5;
const PIN = '1234', PIN_TRIES = 5, PIN_WAIT = 30, IDLE_LOCK = 10 * 60e3;   // mock only – production: a server-side login
const P24_RATE = .0129;                          // placeholder commission; payout on the next business day – both per the P24 contract

// Delivery areas around Kotlarska 25A. Production would geocode the address; the mock goes by the street name.
const AREAS = [
  { id: 'stare', name: 'Stare Miasto', km: .6, w: 30, streets: ['Ruska', 'Kuźnicza', 'Szewska', 'Oławska', 'Wita Stwosza', 'Świdnicka', 'Nożownicza', 'Wierzbowa', 'Kotlarska'] },
  { id: 'swidnickie', name: 'Przedmieście Świdnickie', km: 1.5, w: 12, streets: ['Piłsudskiego', 'Kościuszki', 'Kołłątaja', 'Zielińskiego'] },
  { id: 'nadodrze', name: 'Nadodrze', km: 1.6, w: 12, streets: ['Jedności Narodowej', 'Pomorska', 'Łokietka', 'Dubois', 'Ładna'] },
  { id: 'olawskie', name: 'Przedmieście Oławskie', km: 1.7, w: 10, streets: ['Traugutta', 'Komuny Paryskiej', 'Pułaskiego', 'Krakowska'] },
  { id: 'grunwald', name: 'Plac Grunwaldzki', km: 1.9, w: 14, streets: ['Grunwaldzka', 'Piastowska', 'Norwida', 'Curie-Skłodowskiej'] },
  { id: 'olbin', name: 'Ołbin', km: 2.2, w: 8, streets: ['Wyszyńskiego', 'Prusa', 'Nowowiejska', 'Daszyńskiego'] },
  { id: 'szczepin', name: 'Szczepin', km: 2.3, w: 8, streets: ['Legnicka', 'Długa', 'Zachodnia', 'Inowrocławska'] },
  { id: 'huby', name: 'Huby', km: 3.2, w: 4, streets: ['Hubska', 'Gliniana', 'Borowska'] },
  { id: 'biskupin', name: 'Biskupin', km: 4.8, w: 2, streets: ['Olszewskiego', 'Wróblewskiego'] },
];
const AREA = Object.fromEntries(AREAS.map(a => [a.id, a]));
const areaOf = address => AREAS.find(a => a.streets.some(s => address.includes(s)))?.id ?? 'other';
const areaName = id => AREA[id]?.name ?? (id ? t('r.z.other') : '');

const ui = {
  period: '7d', compare: 'prev', custom: null, metric: 'sales', dish: 'qty', allDishes: false, allPayouts: false,
  q: '', status: 'all', slice: null, listMax: LIST_PAGE, digest: 'email',
};
let ALL = [], BY_ID = new Map();                 // every placed order: generated history + the panel's real ones
let SEEDED = null;
let locked = true;

// the same language as the panel – in production both run on the restaurant's devices, not the customer's browser
const panelLang = store.get('v2_panel_lang', null);
if (I18N[panelLang]) LANG = panelLang;

/* ---------- dates & numbers ---------- */
const DAY = 864e5, MIN = 6e4;
const dayStart = ms => new Date(ms).setHours(0, 0, 0, 0);
const addDays = (ms, n) => { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); };   // DST-safe
function addMonths(ms, n) {                      // same day and time n months away, clamped to that month's length
  const d = new Date(ms), day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d.getTime();
}
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const loc = () => LOCALES[LANG];
const fmtDate = (ms, opts) => new Intl.DateTimeFormat(loc(), opts).format(ms);
const cap = s => s.charAt(0).toLocaleUpperCase(loc()) + s.slice(1);
const ymd = ms => new Date(ms).toLocaleDateString('sv-SE');          // 2026-10-07
const thisYear = ms => new Date(ms).getFullYear() === new Date().getFullYear();
const dayLabel = ms => cap(fmtDate(ms, { weekday: 'short', day: 'numeric', month: 'short', ...(!thisYear(ms) && { year: 'numeric' }) }));
const num = (n, digits = 0) => n.toLocaleString(loc(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
const money = n => `${num(Math.round(n))} zł`;
const money2 = n => `${num(n, 2)} zł`;
const pct = (part, whole) => (whole ? Math.round(part / whole * 100) : 0);
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const hours = h => `${h}:00–${h + 1}:00`;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
function fmtRange(from, to) {                    // `to` is exclusive
  const last = to - 1, single = dayStart(from) === dayStart(last);
  const f = new Intl.DateTimeFormat(loc(), { ...(single && { weekday: 'short' }), day: 'numeric', month: 'short',
    ...(!(thisYear(from) && thisYear(last)) && { year: 'numeric' }) });
  return single ? f.format(from) : f.formatRange(from, last);
}
const weekdayName = dow => fmtDate(new Date(2026, 0, 4 + dow), { weekday: 'short' });   // 4 Jan 2026 was a Sunday
function nextBusinessDay(day) {                  // Przelewy24 pays out on working days
  let d = addDays(day, 1);
  while ([0, 6].includes(new Date(d).getDay())) d = addDays(d, 1);
  return d;
}

/* ---------- mock history: seeded per date, so a day looks the same on every reload ---------- */
function rng(seed) {                             // mulberry32
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const pickW = (r, pairs) => {                    // [[value, weight], …] → value
  let x = r() * sum(pairs, ([, w]) => w);
  return (pairs.find(([, w]) => (x -= w) < 0) ?? pairs.at(-1))[0];
};
const hashOf = s => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const WEEKDAY_ORDERS = [22, 13, 14, 15, 17, 26, 28];                 // Sun … Sat, before the random spread
const GROWTH = { from: new Date(2026, 0, 1).getTime(), yearly: .15 };  // the business grows ~15% a year
const HOUR_WEIGHTS = {                                                // 12:00 … 21:00
  week: [9, 12, 7, 4, 4, 6, 9, 10, 7, 3],                             // office lunch in the old town
  weekend: [4, 6, 6, 5, 5, 7, 11, 13, 10, 5],
};
const POPULAR = { p1: 9, t1: 7, k1: 7, s1: 6, bc1: 6, p2: 5, c3: 5, k2: 4, k4: 4, n1: 4, x1: 4, w1: 3, d1: 3, r2: 3, u3: 3, x2: 3, x7: 3, e1: 2 };
const MAIN_CATS = ['pho', 'wonton', 'curry', 'chicken', 'beef', 'duck', 'rice', 'noodles', 'udon', 'padthai', 'buncha', 'veg'];
const pool = cats => PRODUCTS.filter(p => cats.includes(p.cat) && !p.alcohol).map(p => [p, POPULAR[p.id] ?? 1.5]);
const MAINS = pool(MAIN_CATS), STARTERS = pool(['starters']), DRINKS = pool(['drinks']), DESSERTS = pool(['desserts']), ADDONS = pool(['addons']);
const LANG_MIX = [['pl', 80], ['en', 9], ['vi', 6], ['de', 5]];
const FIRST_NAMES = {
  pl: ['Anna', 'Tomasz', 'Katarzyna', 'Piotr', 'Magdalena', 'Michał', 'Aleksandra', 'Paweł', 'Zofia', 'Jakub',
    'Marta', 'Bartosz', 'Ewa', 'Krzysztof', 'Natalia', 'Wojciech', 'Agnieszka', 'Kamil', 'Joanna', 'Marcin'],
  en: ['Emma', 'James', 'Olivia', 'Liam', 'Sophie', 'Jack'],
  de: ['Jonas', 'Lena', 'Felix', 'Mia', 'Lukas', 'Hannah'],
  vi: ['Linh', 'Minh', 'Hương', 'Tuấn', 'Lan', 'Đức'],
};
const NOTES = ['Bez kolendry, proszę', 'Domofon nie działa – proszę zadzwonić', 'Extra ostre!', 'Pałeczki ×2', 'Proszę zostawić pod drzwiami'];
const dateSeed = day => { const d = new Date(day); return d.getFullYear() * 1e4 + (d.getMonth() + 1) * 100 + d.getDate(); };

const PEOPLE = new Map();
function person(cid) {                           // a customer always has the same name, phone, language and home address
  if (PEOPLE.has(cid)) return PEOPLE.get(cid);
  const r = rng(hashOf(cid)), lang = pickW(r, LANG_MIX), names = FIRST_NAMES[lang];
  const first = names[Math.floor(r() * names.length)], initial = 'ABCDGHKLMNPRSTWZ'[Math.floor(r() * 16)];
  const area = pickW(r, AREAS.map(a => [a, a.w]));
  const street = `${area.streets[Math.floor(r() * area.streets.length)]} ${1 + Math.floor(r() * 60)}${r() < .6 ? `/${1 + Math.floor(r() * 30)}` : ''}`;
  const digits = String(Math.floor(r() * 1e8)).padStart(8, '0');
  const ascii = first.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/đ/gi, 'd').toLowerCase();
  const p = {
    lang, name: `${first} ${initial}.`, phone: `${'5678'[Math.floor(r() * 4)]}${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`,
    email: `${ascii}.${initial.toLowerCase()}${digits.slice(0, 2)}@example.com`, address: `${street}, Wrocław`, area: area.id,
  };
  PEOPLE.set(cid, p);
  return p;
}

function dayPlan(day) {                          // how many orders a day gets, and how many of them from new customers
  const d = new Date(day), r = rng(dateSeed(day));
  const doy = (day - new Date(d.getFullYear(), 0, 1)) / DAY;
  const season = 1 + .15 * Math.cos(2 * Math.PI * (doy - 15) / 365);   // busier in the cold months
  const growth = (1 + GROWTH.yearly) ** ((day - GROWTH.from) / (365 * DAY));
  const n = Math.round(WEEKDAY_ORDERS[d.getDay()] * season * growth * (.8 + .4 * r()));
  return { r, n, fresh: Math.round(n * (.22 + .16 * r())) };
}
// a customer id is "<date of their first order>-<n>", so a returning one can be drawn from any earlier day
function returning(r, day) {
  const first = addDays(day, -Math.ceil(90 * r() ** 2));
  return [`${dateSeed(first)}-${Math.floor(r() * Math.max(1, dayPlan(first).fresh))}`, first];
}

function seedDay(day) {
  const { r, n, fresh } = dayPlan(day), dow = new Date(day).getDay();
  const hourW = HOUR_WEIGHTS[dow === 0 || dow === 6 ? 'weekend' : 'week'].map((w, i) => [OPEN_HOURS[0] + i, w]);
  return Array.from({ length: n }, (_, i) => {
    const h = pickW(r, hourW), placed = new Date(day).setHours(h, Math.floor(r() * 60), Math.floor(r() * 60));
    const [cid, cfirst] = i < fresh ? [`${dateSeed(day)}-${i}`, day] : returning(r, day);
    const who = person(cid), area = AREA[who.area];
    const lines = [];
    const add = (p, qty = 1) => {
      const variant = p.variants ? pickW(r, VARIANT_GROUPS[p.variants].options.map(v => [v.id, 1])) : null;
      const same = lines.find(l => l.pid === p.id && l.variant === variant);
      if (same) same.qty += qty; else lines.push({ pid: p.id, variant, qty });
    };
    const people = pickW(r, [[1, 55], [2, 33], [3, 12]]);
    for (let k = 0; k < people; k++) add(pickW(r, MAINS));
    if (r() < .45) add(pickW(r, STARTERS), r() < .3 ? 2 : 1);
    if (r() < .35) for (let k = Math.ceil(r() * people); k > 0; k--) add(pickW(r, DRINKS));
    if (r() < .1) add(pickW(r, DESSERTS));
    if (r() < .08) add(pickW(r, ADDONS));
    const items = sum(lines, l => byId(l.pid).price * l.qty);
    const delivery = items >= R.delivery.minOrder && r() < .6, fee = delivery ? R.delivery.fee : 0;
    const pay = r() < (delivery ? .64 : .5) ? 'online' : 'on_delivery';
    const o = {
      id: `seed-${dateSeed(day)}-${i}`, no: `${R.orderPrefix}-${1000 + Math.floor(r() * 9000)}`, createdAt: placed,
      fulfilment: delivery ? 'delivery' : 'pickup', time: 'asap', pay, lines, fee, total: items + fee,
      lang: who.lang, cid, cfirst, name: who.name, phone: who.phone, email: who.email,
      address: delivery ? who.address : null, area: delivery ? who.area : null,
      notes: r() < .08 ? NOTES[Math.floor(r() * NOTES.length)] : '',
      abandonedOnline: pay === 'on_delivery' && r() < .04, history: [{ status: 'placed', at: placed }],
    };
    const step = (status, at) => o.history.push({ status, at: Math.round(at) });
    const accepted = placed + (.5 + 7 * r() ** 2.5) * MIN;
    const far = delivery && area.km > 4;          // the edge of the delivery area gets turned down more often
    if (r() < (far ? .14 : .035)) {
      o.status = 'rejected';
      o.reason = pickW(r, [['unavailable', 35], ['busy', 30], ['closing', 10], ['contact', 10], ['zone', far ? 120 : delivery ? 10 : 0]]);
      step('rejected', accepted);
      return o;
    }
    step('accepted', accepted);
    if (h <= 19 && r() < .12) {                  // ordered for later today
      const slot = new Date(placed + (60 + 60 * r()) * MIN);
      slot.setMinutes(Math.ceil(slot.getMinutes() / 15) * 15, 0, 0);
      o.time = clock(slot);
      o.dueAt = slot.getTime();
    } else {
      o.dueAt = accepted + pickW(r, !delivery ? [[10, 1], [15, 4], [20, 3], [30, 1]]
        : area.km < 1 ? [[30, 4], [45, 4], [60, 1]] : area.km < 3 ? [[30, 1], [45, 5], [60, 2]] : [[45, 2], [60, 5]]) * MIN;
    }
    const off = (r() < .86 ? -10 * r() : 1 + 19 * r()) * MIN;          // against the promised time
    if (delivery) {
      step('out', Math.max(accepted + 8 * MIN, o.dueAt + off - (12 + 10 * r()) * MIN));
      step('done', o.dueAt + off);
    } else {
      step('ready', o.dueAt + off);
      step('done', o.dueAt + off + 10 * r() * MIN);
    }
    o.status = 'done';
    return o;
  });
}

function load() {
  const today = dayStart(Date.now());
  SEEDED ??= range(1, HISTORY_DAYS).flatMap(n => seedDay(addDays(today, -n)));
  const real = orders.all().filter(isPlaced).map(o => ({
    ...o, real: true, cid: o.phone.replace(/\s/g, ''), area: o.fulfilment === 'delivery' ? areaOf(o.address ?? '') : null,
  }));
  real.forEach(o => { o.cfirst = Math.min(...real.filter(x => x.cid === o.cid).map(placedAt)); });
  ALL = [...SEEDED, ...real];
  BY_ID = new Map(ALL.map(o => [o.id, o]));
}

/* ---------- periods & numbers ---------- */
function periods() {
  const now = Date.now(), today = dayStart(now), weekBefore = ms => addDays(ms, -7);
  const month = k => { const d = new Date(today); return new Date(d.getFullYear(), d.getMonth() - k, 1).getTime(); };
  const c = ui.custom ?? { from: addDays(today, -13), to: today }, days = Math.round((c.to - c.from) / DAY) + 1;
  return [
    { id: 'today', label: t('r.p.today'), from: today, to: now, back: weekBefore, by: 'hour' },   // vs the same weekday
    { id: 'yesterday', label: t('r.p.yesterday'), from: addDays(today, -1), to: today, back: weekBefore, by: 'hour' },
    { id: '7d', label: t('r.p.7d'), from: addDays(today, -6), to: now, back: weekBefore, by: 'day' },
    { id: '30d', label: t('r.p.30d'), from: addDays(today, -29), to: now, back: ms => addDays(ms, -30), by: 'day' },
    ...[0, 1, 2].map(k => ({ id: `m${k}`, label: cap(fmtDate(month(k), { month: 'long' })), short: cap(fmtDate(month(k), { month: 'short' })),
      from: month(k), to: k ? month(k - 1) : now, back: ms => addMonths(ms, -1), by: 'day' })),
    { id: 'custom', label: `📅 ${t('r.p.custom')}`, short: t('r.p.custom_short'), from: c.from, to: Math.min(now, addDays(c.to, 1)),
      back: ms => addDays(ms, -days), by: days === 1 ? 'hour' : days <= 62 ? 'day' : days <= 200 ? 'week' : 'month' },
  ];
}
const period = () => periods().find(x => x.id === ui.period);
const yearBefore = p => (p.id.startsWith('m') ? ms => addMonths(ms, -12) : ms => addDays(ms, -364));   // 52 weeks keeps the weekdays
const backOf = p => (ui.compare === 'year' ? yearBefore(p) : p.back);
function stats(from, to) {
  const os = ALL.filter(o => { const a = placedAt(o); return a >= from && a < to; });
  const done = os.filter(o => o.status === 'done');
  const sales = sum(done, o => o.total);
  return {
    os, done, sales, n: done.length, avg: done.length ? sales / done.length : 0,
    rejected: os.filter(o => o.status === 'rejected'), open: os.filter(o => !CLOSED.includes(o.status)),
  };
}
const at = (o, status) => o.history?.find(h => h.status === status)?.at;
const fulfilledAt = o => at(o, o.fulfilment === 'delivery' ? 'done' : 'ready') ?? at(o, 'done');   // what the promised time is about
const stOf = (o, status = o.status) => t(status === 'done' ? `p.st.done_${o.fulfilment}` : `p.st.${status}`);

/* ---------- render ---------- */
function render() {
  if (locked) return;                            // nothing to read behind the PIN screen
  const p = period(), back = backOf(p), cur = stats(p.from, p.to), prev = stats(back(p.from), back(p.to));
  const live = p.to > dayStart(Date.now()), single = p.by === 'hour';
  const caret = document.activeElement?.id === 'rSearch' ? $('#rSearch').selectionStart : null;   // a live update keeps the search box
  document.title = `${t('r.title')} – ${R.name}`;
  $('#rPeriods').innerHTML = periods().map(x =>
    `<button data-period="${x.id}" class="${x.id === ui.period ? 'is-active' : ''}">${x.short             // short labels on phones
      ? `<span class="rchip__long">${x.label}</span><span class="rchip__short">${x.short}</span>` : x.label}</button>`).join('');
  renderRange(p, live);
  $('#rPrintHead').textContent = `${R.name} · ${t('r.title')} · ${fmtRange(p.from, p.to)}`;
  renderKpis(cur, prev);
  $('#rBody').innerHTML = [
    ...(cur.done.length
      ? [salesCard(p, cur), paymentsCard(cur), p24Card(cur), dishesCard(cur), categoriesCard(cur),
        ...(single                                // a single day has no weekday × hour pattern to show
          ? [zonesCard(cur), fulfilmentCard(cur), serviceCard(cur, 'rcard--wide'), customersCard(p, cur)]
          : [heatmapCard(cur), customersCard(p, cur), zonesCard(cur), fulfilmentCard(cur), serviceCard(cur, 'rcard--full')])]
      : [`<div class="rcard rcard--full rempty">${t(live ? 'r.empty.today' : 'r.empty')}</div>`]),
    ordersCard(),
  ].join('');
  renderOrders();
  if (caret !== null) { const s = $('#rSearch'); s.focus(); s.setSelectionRange(caret, caret); }
}

function renderRange(p, live) {
  const today = dayStart(Date.now()), min = ymd(addDays(today, -CUSTOM_DAYS)), max = ymd(today);
  const opt = (v, label, b) => `<option value="${v}"${v === ui.compare ? ' selected' : ''}>${label} · ${fmtRange(b(p.from), b(p.to))}</option>`;
  $('#rRange').innerHTML = `${p.id === 'custom'
    ? `<span class="rdates"><input type="date" id="rFrom" value="${ymd(p.from)}" min="${min}" max="${max}" aria-label="${t('r.from')}">
        <span>–</span><input type="date" id="rTo" value="${ymd(p.to - 1)}" min="${min}" max="${max}" aria-label="${t('r.to')}"></span>`
    : `<strong>${fmtRange(p.from, p.to)}</strong>`}${live ? `<span class="rlive">${t('r.live')}</span>` : ''}
    <label class="rcompare"><span>${t('r.vs_label')}</span><select id="rCompare">${opt('prev', t('r.cmp.prev'), p.back)}${opt('year', t('r.cmp.year'), yearBefore(p))}</select></label>`;
}

function delta(cur, prev, fmt, goodUp = true) {
  if (!prev) return '';
  const d = Math.round((cur - prev) / prev * 100), cls = d === 0 ? '' : (d > 0) === goodUp ? 'is-good' : 'is-bad';
  return `<p class="rdelta"><b class="${cls}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${num(Math.abs(d))}%</b> ${t('r.before', { v: fmt(prev) })}</p>`;
}
function renderKpis(cur, prev) {
  const lost = sum(cur.rejected, o => o.total);
  const tile = (label, value, sub, d, cls = '') =>
    `<div class="rkpi ${cls}"><small>${label}</small><strong>${value}</strong>${d}<p class="rkpi__sub">${sub}</p></div>`;
  $('#rKpis').innerHTML = [
    tile(t('r.k.sales'), money(cur.sales), cur.open.length
      ? `${t('r.k.sales_sub')}<br><span class="rkpi__open">${t('r.k.open', { n: cur.open.length, sum: money(sum(cur.open, o => o.total)) })}</span>`
      : t('r.k.sales_sub'), delta(cur.sales, prev.sales, money), 'rkpi--hero'),
    tile(t('r.k.orders'), num(cur.n), t('r.k.orders_sub'), delta(cur.n, prev.n, num)),
    tile(t('r.k.avg'), money(cur.avg), t('r.k.avg_sub'), delta(cur.avg, prev.avg, money)),
    tile(t('r.k.rejected'), `${cur.rejected.length ? '✕ ' : ''}${num(cur.rejected.length)}`,
      lost ? t('r.k.rejected_sub', { sum: money(lost) }) : '', delta(cur.rejected.length, prev.rejected.length, num, false),
      cur.rejected.length ? 'rkpi--bad' : ''),
  ].join('');
}

const card = (cls, title, sub, body, tools = '', id = '') => `<section class="rcard ${cls}"${id ? ` id="${id}"` : ''}>
  <div class="rcard__head"><div><h2>${title}</h2>${sub ? `<p class="rcard__sub">${sub}</p>` : ''}</div>${tools}</div>${body}</section>`;
const seg = (attr, value, options) => `<div class="seg rseg">${options.map(([v, label]) =>
  `<button ${attr}="${v}" class="${v === value ? 'is-active' : ''}">${label}</button>`).join('')}</div>`;

/* sales over time – one series, so no legend; values on hover / focus and in the table; a click lists the orders */
function niceStep(v) {
  const e = 10 ** Math.floor(Math.log10(v)), f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
}
function buckets(p, s) {
  const now = Date.now();
  let out = [];
  if (p.by === 'hour') {
    const hs = s.os.map(o => new Date(placedAt(o)).getHours());
    out = range(Math.min(OPEN_HOURS[0], ...hs), Math.max(OPEN_HOURS[1], ...hs)).map(h => {
      const from = new Date(p.from).setHours(h);
      return { from, to: from + 36e5, axis: `${h}`, label: hours(h) };
    });
  } else if (p.by === 'day') {
    const n = Math.round((dayStart(p.to - 1) - p.from) / DAY) + 1, every = n <= 7 ? 1 : Math.ceil(n / 6);
    out = range(0, n - 1).map(i => {
      const from = addDays(p.from, i);
      return { from, to: addDays(from, 1), label: dayLabel(from),
        axis: n <= 7 ? fmtDate(from, { weekday: 'short' }) : i % every ? '' : fmtDate(from, { day: 'numeric', month: 'short' }) };
    });
  } else {                                        // long custom ranges: a bar per week or per month
    const week = p.by === 'week', d0 = new Date(p.from);
    let from = week ? addDays(p.from, -((d0.getDay() + 6) % 7)) : new Date(d0.getFullYear(), d0.getMonth(), 1).getTime();
    while (from < p.to) {
      const d = new Date(from), to = week ? addDays(from, 7) : new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      out.push({ from: Math.max(from, p.from), to: Math.min(to, p.to),
        label: week ? t('r.c.week', { date: fmtDate(from, { day: 'numeric', month: 'short' }) }) : cap(fmtDate(from, { month: 'long', year: 'numeric' })),
        axis: week ? fmtDate(from, { day: 'numeric', month: 'short' }) : fmtDate(from, { month: 'short' }) });
      from = to;
    }
    const every = Math.ceil(out.length / 8);
    out.forEach((b, i) => { if (i % every) b.axis = ''; });
  }
  return out.map(b => {
    const done = s.done.filter(o => { const a = placedAt(o); return a >= b.from && a < b.to; });
    return { ...b, n: done.length, sales: sum(done, o => o.total), now: now >= b.from && now < b.to };
  });
}
function salesCard(p, s) {
  const bs = buckets(p, s), key = ui.metric === 'sales' ? 'sales' : 'n', fmt = key === 'sales' ? money : num;
  const step = Math.max(1, niceStep(Math.max(...bs.map(b => b[key]), 1) / 4));
  const top = Math.max(step, Math.ceil(Math.max(...bs.map(b => b[key])) / step) * step);
  const ticks = range(0, Math.round(top / step)).map(i => i * step);
  const chart = `<div class="rchart">
    <div class="rchart__y">${ticks.map(v => `<span style="bottom:${v / top * 100}%">${num(v)}</span>`).join('')}</div>
    <div class="rchart__plot">${ticks.map(v => `<i class="rchart__grid" style="bottom:${v / top * 100}%"></i>`).join('')}
      <div class="rchart__bars">${bs.map(b => `<button class="rcol${b.now ? ' is-now' : ''}" data-from="${b.from}" data-to="${b.to}"
        data-name="${b.label}" data-v="${fmt(b[key])}"
        data-l="${b.label} · ${key === 'sales' ? t('r.n_orders', { n: b.n }) : money(b.sales)}${b.now ? ` · ${t('r.c.now')}` : ''}"
        aria-label="${b.label}: ${fmt(b[key])}"><i style="height:${b[key] / top * 100}%"></i></button>`).join('')}</div>
    </div>
    <span></span><div class="rchart__x">${bs.map(b => `<span>${b.axis}</span>`).join('')}</div>
  </div>`;
  const unit = { hour: 'r.t.hour', day: 'r.t.day', week: 'r.t.week', month: 'r.t.month' }[p.by];
  const table = `<details class="rtable"><summary>${t('r.c.table')}</summary><div class="rtable__scroll"><table>
    <thead><tr><th>${t(unit)}</th><th>${t('r.t.orders')}</th><th>${t('r.t.sales')}</th><th>${t('r.t.avg')}</th></tr></thead>
    <tbody>${bs.map(b => `<tr><td>${b.label}</td><td>${num(b.n)}</td><td>${money(b.sales)}</td><td>${b.n ? money(b.sales / b.n) : '–'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>${t('cart.total')}</td><td>${num(s.n)}</td><td>${money(s.sales)}</td><td>${money(s.avg)}</td></tr></tfoot>
  </table></div></details>`;
  return card('rcard--full', t('r.c.title'), t(`r.c.by_${p.by}`), chart + table,
    seg('data-metric', ui.metric, [['sales', t('r.m.sales')], ['orders', t('r.m.orders')]]));
}

/* part-to-whole: one bar split in two (2px surface gap), legend with label · share · amount */
function stack(parts) {
  const total = sum(parts, x => x.value);
  return `<div class="rstack">${parts.filter(x => x.value).map(x => `<i class="rstack--${x.c}" style="flex:${x.value}"></i>`).join('')}</div>
    <ul class="rlegend">${parts.map(x => `<li><i class="rstack--${x.c}"></i><span>${x.label}</span><b>${pct(x.value, total)}%</b><span class="muted">${x.sub}</span></li>`).join('')}</ul>`;
}
const ledgerRow = (label, count, amount, cls = '') =>
  `<div class="rrow ${cls}"><span>${label}</span><span class="muted">${count}</span><b>${amount}</b></div>`;
function paymentsCard(s) {
  const online = s.done.filter(o => o.pay === 'online'), onsite = s.done.filter(o => o.pay !== 'online');
  const atDoor = onsite.filter(o => o.fulfilment === 'delivery'), atCounter = onsite.filter(o => o.fulfilment === 'pickup');
  const refunds = s.rejected.filter(o => o.pay === 'online');
  const row = (label, os, cls = '', amount = money(sum(os, o => o.total))) => ledgerRow(label, t('r.n_orders', { n: num(os.length) }), amount, cls);
  return card('', t('r.pay.title'), '', stack([
    { label: t('r.pay.l_online'), value: sum(online, o => o.total), c: 'a', sub: money(sum(online, o => o.total)) },
    { label: t('r.pay.l_onsite'), value: sum(onsite, o => o.total), c: 'b', sub: money(sum(onsite, o => o.total)) },
  ]) + `<div class="rrows">
    ${row(`💳 ${t('r.pay.online')}`, online)}
    ${row(`🚚 ${t('r.pay.delivery')}`, atDoor)}
    ${row(`🥡 ${t('r.pay.pickup')}`, atCounter)}
    ${row(t('cart.total'), s.done, 'rrow--total')}
    ${ledgerRow(t('r.pay.fees'), '', money(sum(s.done, o => o.fee)), 'rrow--sub')}
    ${refunds.length ? row(`↩ ${t('r.pay.refunds')}`, refunds, 'rrow--refund', `−${money(sum(refunds, o => o.total))}`) : ''}
  </div><p class="rnote">${t('r.pay.hint')}</p>`);
}

/* Przelewy24: online payments in, commission and refunds out, paid out to the bank the next business day */
const p24Fee = o => Math.round(o.total * P24_RATE * 100) / 100;
function p24(s) {
  const days = new Map();
  const dayOf = o => {
    const k = dayStart(placedAt(o));
    if (!days.has(k)) days.set(k, { day: k, gross: 0, fee: 0, refunds: 0, n: 0 });
    return days.get(k);
  };
  s.done.filter(o => o.pay === 'online').forEach(o => { const d = dayOf(o); d.gross += o.total; d.fee += p24Fee(o); d.n += 1; });
  s.rejected.filter(o => o.pay === 'online').forEach(o => { dayOf(o).refunds += o.total; });
  const list = [...days.values()], payouts = new Map();
  list.forEach(d => {
    const when = nextBusinessDay(d.day), p = payouts.get(when) ?? { at: when, days: [], amount: 0 };
    p.days.push(d.day);
    p.amount += d.gross - d.fee - d.refunds;
    payouts.set(when, p);
  });
  const gross = sum(list, d => d.gross), fee = sum(list, d => d.fee), refunds = sum(list, d => d.refunds);
  return { gross, fee, refunds, net: gross - fee - refunds, n: sum(list, d => d.n), payouts: [...payouts.values()].sort((a, b) => b.at - a.at) };
}
function p24Card(s) {
  const x = p24(s), today = dayStart(Date.now());
  if (!x.gross && !x.refunds) return card('', t('r.p24.title'), '', `<p class="muted">${t('r.p24.none')}</p>`);
  const shown = ui.allPayouts ? x.payouts : x.payouts.slice(0, PAYOUTS_SHOWN);
  const covers = p => fmtRange(Math.min(...p.days), addDays(Math.max(...p.days), 1));
  return card('', t('r.p24.title'), '', `<div class="rrows rrows--top">
      ${ledgerRow(`💳 ${t('r.p24.gross')}`, t('r.n_orders', { n: num(x.n) }), money2(x.gross))}
      ${ledgerRow(t('r.p24.fee', { rate: `${num(P24_RATE * 100, 2)}%` }), '', `−${money2(x.fee)}`)}
      ${x.refunds ? ledgerRow(`↩ ${t('r.p24.refunds')}`, '', `−${money2(x.refunds)}`) : ''}
      ${ledgerRow(t('r.p24.total'), '', money2(x.net), 'rrow--total')}
    </div>
    <h3 class="rh3">${t('r.p24.payouts')}</h3>
    <ul class="rpayouts">${shown.map(p => `<li class="${p.at > today ? 'is-planned' : ''}">
      <span class="rpayouts__icon">${p.at > today ? '⏳' : '✓'}</span>
      <div><b>${dayLabel(p.at)}</b><small>${t('r.p24.for', { days: covers(p) })} · ${t(p.at > today ? 'r.p24.planned' : 'r.p24.paid')}</small></div>
      <b class="rpayouts__sum">${money2(p.amount)}</b></li>`).join('')}</ul>
    ${x.payouts.length > PAYOUTS_SHOWN ? `<button class="rlink" data-all-payouts>${ui.allPayouts ? t('r.p24.less') : t('r.p24.all', { n: x.payouts.length })}</button>` : ''}
    <p class="rnote">${t('r.p24.note')}</p>`);
}

function fulfilmentCard(s) {
  const part = (f, c) => {
    const os = s.done.filter(o => o.fulfilment === f), mins = os.map(o => (fulfilledAt(o) - placedAt(o)) / MIN);
    return { f, c, os, value: os.length, label: t(f === 'delivery' ? 'f.delivery' : 'f.pickup_long'), sub: t('r.n_orders', { n: num(os.length) }),
      avg: os.length ? sum(os, o => o.total) / os.length : 0, mins: mins.length ? sum(mins, m => m) / mins.length : 0 };
  };
  const parts = [part('delivery', 'a'), part('pickup', 'b')];
  return card('rcard--narrow', t('r.ful.title'), '', stack(parts) + `<div class="rsplit">${parts.map(x => `<div class="rmini">
    <small>${x.f === 'delivery' ? '🚚' : '🥡'} ${x.label}</small><strong>${t('r.ful.avg', { sum: money(x.avg) })}</strong>
    <p>${x.os.length ? t('r.ful.time', { n: num(Math.round(x.mins)) }) : '–'}</p></div>`).join('')}</div>`);
}

/* delivery areas – how many orders each part of town sends, how much and how long the drive takes */
function zonesCard(s) {
  const delivered = s.done.filter(o => o.fulfilment === 'delivery');
  const rows = [...AREAS, { id: 'other', name: t('r.z.other') }].map(a => {
    const os = delivered.filter(o => o.area === a.id), mins = os.map(o => (at(o, 'done') - placedAt(o)) / MIN);
    return { a, n: os.length, avg: os.length ? sum(os, o => o.total) / os.length : 0, mins: mins.length ? sum(mins, m => m) / mins.length : 0 };
  }).filter(x => x.n).sort((x, y) => y.n - x.n);
  const max = rows[0]?.n || 1, slowest = rows.filter(x => x.n >= 3).sort((x, y) => y.mins - x.mins)[0];
  const outside = s.rejected.filter(o => o.reason === 'zone').length;
  const foot = [slowest && `⏱ ${t('r.z.slowest', { area: slowest.a.name, n: num(Math.round(slowest.mins)) })}`,
    outside && `✕ ${t('r.z.rejected', { n: num(outside) })}`].filter(Boolean).join(' · ');
  return card('rcard--wide', t('r.z.title'), t('r.z.sub', { fee: zl(R.delivery.fee), min: zl(R.delivery.minOrder) }), rows.length
    ? `<ul class="rzones">${rows.map(x => `<li><div class="rrank__top"><span>${x.a.name}${x.a.km ? ` <small class="muted">${num(x.a.km, 1)} km</small>` : ''}</span>
        <b>${t('r.n_orders', { n: num(x.n) })}</b></div><div class="rbarh"><i style="width:${x.n / max * 100}%"></i></div>
        <small class="muted">${t('r.z.row', { sum: money(x.avg), n: num(Math.round(x.mins)) })}</small></li>`).join('')}</ul>
      ${foot ? `<p class="rzones__foot">${foot}</p>` : ''}`
    : `<p class="muted">${t('r.z.none')}</p>`);
}

/* best sellers – one series per list, sorted, value at the bar's tip */
function lineTotals(s, key) {
  const agg = {};
  s.done.forEach(o => o.lines.forEach(l => {
    const p = byId(l.pid), a = agg[key(p)] ??= { p, qty: 0, value: 0 };
    a.qty += l.qty;
    a.value += p.price * l.qty;
  }));
  return Object.values(agg);
}
function dishesCard(s) {
  const by = ui.dish === 'qty' ? 'qty' : 'value', all = lineTotals(s, p => p.id).sort((a, b) => b[by] - a[by] || b.value - a.value);
  const shown = ui.allDishes ? all : all.slice(0, TOP_DISHES), max = all[0]?.[by] || 1;
  const list = `<ol class="rrank">${shown.map((a, i) => `<li>
    <span class="rrank__n">${i + 1}</span><img src="${a.p.img ?? `img/dishes/${a.p.id}.svg`}" alt="" loading="lazy">
    <div class="rrank__main"><div class="rrank__top"><span>${nameOf(a.p)}</span>
      <b>${by === 'qty' ? t('p.qty', { n: num(a.qty) }) : money(a.value)}</b></div>
      <div class="rbarh"><i style="width:${a[by] / max * 100}%"></i></div></div>
    <span class="rrank__alt muted">${by === 'qty' ? money(a.value) : t('p.qty', { n: num(a.qty) })}</span></li>`).join('')}</ol>
    ${all.length > TOP_DISHES ? `<button class="rlink" data-all-dishes>${ui.allDishes ? t('r.d.less') : t('r.d.all', { n: all.length })}</button>` : ''}`;
  return card('rcard--wide', t('r.d.title'), '', list, seg('data-dish', ui.dish, [['qty', t('r.d.qty')], ['value', t('r.d.value')]]));
}
function categoriesCard(s) {
  const cats = lineTotals(s, p => p.cat).map(a => ({ c: CATEGORIES.find(c => c.id === a.p.cat), value: a.value }))
    .sort((a, b) => b.value - a.value);
  const rest = cats.slice(TOP_CATS), total = sum(cats, c => c.value);
  const shown = [...cats.slice(0, TOP_CATS).map(c => ({ name: `${c.c.icon} ${nameOf(c.c)}`, value: c.value })),
    ...(rest.length ? [{ name: t('r.cat.other', { n: rest.length }), value: sum(rest, c => c.value), other: true }] : [])];
  const max = Math.max(1, ...shown.map(c => c.value));
  return card('rcard--narrow', t('r.cat.title'), t('r.cat.sub'), `<ul class="rcats">${shown.map(c => `<li class="${c.other ? 'is-other' : ''}">
    <div class="rrank__top"><span>${c.name}</span><small class="muted">${money(c.value)}</small><b>${pct(c.value, total)}%</b></div>
    <div class="rbarh"><i style="width:${c.value / max * 100}%"></i></div></li>`).join('')}</ul>`);
}

/* when people order – weekday × hour, one hue light → dark; a click lists that slot's orders */
function heatmapCard(s) {
  const hs = s.os.map(o => new Date(placedAt(o)).getHours());
  const cols = range(Math.min(OPEN_HOURS[0], ...hs), Math.max(OPEN_HOURS[1], ...hs)), rows = [1, 2, 3, 4, 5, 6, 0];
  const count = {};
  s.os.forEach(o => { const d = new Date(placedAt(o)), k = `${d.getDay()}-${d.getHours()}`; count[k] = (count[k] ?? 0) + 1; });
  const max = Math.max(1, ...Object.values(count));
  const peak = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0].split('-').map(Number);
  const grid = `<div class="rheat" style="--cols:${cols.length}">
    <span></span>${cols.map(h => `<span class="rheat__h">${h}</span>`).join('')}
    ${rows.map(d => `<span class="rheat__d">${weekdayName(d)}</span>${cols.map(h => {
      const v = count[`${d}-${h}`] ?? 0;
      return `<i class="rheat__c" style="--v:${v ? Math.round(12 + 88 * v / max) : 0}%" data-slot="${d}-${h}"
        data-v="${t('r.n_orders', { n: v })}" data-l="${cap(weekdayName(d))}, ${hours(h)}"></i>`;
    }).join('')}`).join('')}
  </div>
  <div class="rheat__legend"><span>${t('r.h.less')}</span><i></i><span>${t('r.h.more')}</span></div>`;
  return card('rcard--wide', t('r.h.title'), peak ? t('r.h.peak', { day: cap(weekdayName(peak[0])), hours: hours(peak[1]) }) : '', grid);
}

function customersCard(p, s) {
  const placed = s.os.filter(o => o.status !== 'rejected'), first = {};
  placed.forEach(o => { first[o.cid] = o.cfirst; });
  const ids = Object.keys(first), fresh = ids.filter(id => first[id] >= p.from).length;
  const langs = LANGS.map(l => ({ l, n: placed.filter(o => o.lang === l.code).length })).sort((a, b) => b.n - a.n);
  const max = langs[0]?.n || 1;
  return card('rcard--narrow', t('r.cu.title'), t('r.cu.sub'), `<p class="rbig"><strong>${num(ids.length)}</strong> ${t('r.cu.unique')}</p>
    ${stack([
      { label: t('r.cu.returning'), value: ids.length - fresh, c: 'a', sub: num(ids.length - fresh) },
      { label: t('r.cu.new'), value: fresh, c: 'b', sub: num(fresh) },
    ])}
    <h3 class="rh3">${t('r.cu.lang')}</h3>
    <ul class="rlangs">${langs.map(x => `<li><span class="lang__flag">${FLAG_SVG[x.l.code]}</span><span>${x.l.name}</span>
      <div class="rbarh"><i style="width:${x.n / max * 100}%"></i></div><b>${pct(x.n, placed.length)}%</b></li>`).join('')}</ul>`);
}

function service(s) {
  const timed = s.done.filter(o => o.dueAt && fulfilledAt(o)), late = timed.filter(o => fulfilledAt(o) > o.dueAt);
  return { timed, late, lateMin: late.length ? sum(late, o => (fulfilledAt(o) - o.dueAt) / MIN) / late.length : 0 };
}
const reasonsOf = s => Object.entries(s.rejected.reduce((m, o) => ({ ...m, [o.reason]: (m[o.reason] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
function serviceCard(s, cls) {
  const acc = s.os.filter(o => at(o, 'accepted')).map(o => (at(o, 'accepted') - placedAt(o)) / MIN);
  const { timed, late, lateMin } = service(s), abandoned = s.os.filter(o => o.abandonedOnline).length;
  const reasons = reasonsOf(s), max = reasons[0]?.[1] || 1;
  const mini = (label, value, sub, c = '') => `<div class="rmini ${c}"><small>${label}</small><strong>${value}</strong><p>${sub}</p></div>`;
  return card(cls, t('r.s.title'), '', `<div class="rservice"><div class="rminis">
    ${mini(t('r.s.accept'), acc.length ? t('eta', { n: num(sum(acc, m => m) / acc.length, 1) }) : '–', t('r.s.accept_sub'))}
    ${mini(t('r.s.ontime'), timed.length ? `${pct(timed.length - late.length, timed.length)}%` : '–', t('r.s.ontime_sub'))}
    ${mini(t('r.s.late'), `${late.length ? '⏱ ' : ''}${num(late.length)}`, late.length ? t('r.s.late_sub', { n: num(Math.round(lateMin)) }) : '', late.length ? 'rmini--bad' : '')}
    ${mini(t('r.s.abandoned'), num(abandoned), t('r.s.abandoned_sub'))}
  </div><div class="rreasons"><h3 class="rh3">${t('r.s.reasons')}</h3>${reasons.length
    ? `<ul>${reasons.map(([r, n]) => `<li><div class="rrank__top"><span>${t(`reason.${r}`)}</span><b>${num(n)}</b></div>
      <div class="rbarh rbarh--bad"><i style="width:${n / max * 100}%"></i></div></li>`).join('')}</ul>`
    : `<p class="muted">${t('r.s.no_rejects')}</p>`}</div></div>`);
}

/* ---------- every order: search (number, phone, name, address) through all of them, or the period / a picked bar ---------- */
const fold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const searchKey = o => (o.searchKey ??= fold([o.no, o.name, o.address, AREA[o.area]?.name, o.email].join(' ')));
function matches(o, q) {
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 3 && digits.length === q.replace(/[\s+-]/g, '').length) {   // only digits: an order number or a phone
    return o.no.includes(digits) || o.phone.replace(/\D/g, '').includes(digits);
  }
  return searchKey(o).includes(fold(q.trim()));
}
const inSlice = (o, sl) => {
  const a = placedAt(o), d = new Date(a);
  return sl.slot ? `${d.getDay()}-${d.getHours()}` === sl.slot : a >= sl.from && a < sl.to;
};
function listOrders() {
  const p = period();
  const os = ui.q.trim() ? ALL.filter(o => matches(o, ui.q)) : stats(p.from, p.to).os.filter(o => !ui.slice || inSlice(o, ui.slice));
  return os.sort((a, b) => placedAt(b) - placedAt(a));
}
const STATUS_TABS = { all: () => true, done: o => o.status === 'done', rejected: o => o.status === 'rejected', open: o => !CLOSED.includes(o.status) };
function ordersCard() {
  return card('rcard--full rorders', t('r.o.title'), '<span id="rOrdSub"></span>', '<div id="rOrdBody"></div>',
    `<input class="rsearch" id="rSearch" type="search" value="${esc(ui.q)}" placeholder="${t('r.o.search')}" aria-label="${t('r.o.search')}" autocomplete="off">`, 'rOrders');
}
function renderOrders() {
  if (!$('#rOrdBody')) return;
  const all = listOrders(), searching = !!ui.q.trim();
  const shown = all.filter(STATUS_TABS[ui.status]);
  $('#rOrdSub').textContent = searching ? t('r.o.found', { n: num(all.length) })
    : ui.slice ? t('r.o.slice', { n: num(all.length), label: ui.slice.label }) : t('r.o.period', { n: num(all.length) });
  $('#rOrdBody').innerHTML = `<div class="rofilters">
      ${Object.keys(STATUS_TABS).map(k => `<button class="rpill${k === ui.status ? ' is-active' : ''}" data-ostatus="${k}">${t(`r.o.${k}`)} <b>${num(all.filter(STATUS_TABS[k]).length)}</b></button>`).join('')}
      ${ui.slice && !searching ? `<button class="rpill rpill--slice" data-unslice title="${t('r.o.unslice')}">📊 ${esc(ui.slice.label)} <span aria-hidden="true">✕</span></button>` : ''}
    </div>
    ${shown.length ? `<div class="rolist">${shown.slice(0, ui.listMax).map(orderRow).join('')}</div>` : `<p class="rempty rempty--small">${t('r.o.none')}</p>`}
    ${shown.length > ui.listMax ? `<button class="rlink" data-more>${t('r.o.more', { n: num(shown.length - ui.listMax) })}</button>` : ''}`;
}
function orderRow(o) {
  const delivery = o.fulfilment === 'delivery';
  return `<button class="rord" data-order="${o.id}">
    <span class="rord__no">${o.no}</span>
    <span class="rord__when">${dayLabel(placedAt(o))} · ${clock(placedAt(o))}</span>
    <span class="rord__who">${esc(o.name)}</span>
    <span class="rord__how">${delivery ? `🚚 ${areaName(o.area)}` : `🥡 ${t('f.pickup')}`} · ${o.pay === 'online' ? '💳' : '💵'}</span>
    <b class="rord__total">${money(o.total)}</b>
    <span class="rord__st"><span class="pchip pchip--${o.status}">${stOf(o)}</span></span>
  </button>`;
}
function openOrder(o) {
  const delivery = o.fulfilment === 'delivery', lang = LANGS.find(l => l.code === o.lang) ?? LANGS[0];
  openModal(`<div class="rmo__head"><h3>${o.no}</h3><span class="pchip pchip--${o.status}">${stOf(o)}</span></div>
    <p class="muted rmo__when">${cap(fmtDate(placedAt(o), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}, ${clock(placedAt(o))}</p>
    <div class="rmo__facts">
      <span>${delivery ? '🚚' : '🥡'} ${t(delivery ? 'f.delivery' : 'f.pickup_long')}${o.time !== 'asap' ? ` · 📅 ${t('p.due', { time: o.time })}` : ''}</span>
      <span>${o.pay === 'online' ? `💳 ${t('p.paid')}` : `💵 ${t(delivery ? 'p.collect_delivery' : 'p.collect_pickup')}`}</span>
    </div>
    <div class="summary">
      ${o.lines.map(l => { const p = byId(l.pid); return `<div class="row"><span>${l.qty}× ${nameOf(p)}${l.variant ? ` <span class="muted">(${variantName(l)})</span>` : ''}</span><span>${zl(p.price * l.qty)}</span></div>`; }).join('')}
      ${o.fee ? `<div class="row"><span>${t('cart.delivery')}</span><span>${zl(o.fee)}</span></div>` : ''}
      <div class="row row--total"><span>${t('cart.total')}</span><span>${zl(o.total)}</span></div>
    </div>
    ${o.status === 'rejected' ? `<p class="note">${t('done.reason', { reason: t(`reason.${o.reason}`) })}${o.pay === 'online' ? `<br>${t('r.o.refunded', { total: zl(o.total) })}` : ''}</p>` : ''}
    ${o.abandonedOnline ? `<p class="note">${t('p.abandoned')}</p>` : ''}
    ${o.notes ? `<p class="pnotes">💬 ${esc(o.notes)}</p>` : ''}
    <div class="psection"><h3>${t('p.customer')}</h3>
      <p><strong>${esc(o.name)}</strong> · <a href="tel:${esc(o.phone.replace(/\s/g, ''))}">${esc(o.phone)}</a></p>
      <p class="muted">${esc(o.email)} · ${t('p.lang', { lang: `${lang.flag} ${lang.name}` })}</p>
      ${delivery ? `<p>📍 ${esc(o.address)} · ${areaName(o.area)}</p>` : ''}
    </div>
    <div class="psection"><h3>${t('p.history')}</h3>
      <p class="phistory">${(o.history ?? []).map(h => `<span><b>${clock(h.at)}</b> ${stOf(o, h.status)}</span>`).join('')}</p></div>
    ${o.real ? `<p class="plinks"><a href="${orderUrl(o)}" target="_blank">${t('p.customer_page')}</a></p>` : ''}`, 'rmodal--order');
}
// a bar or a heatmap cell → the orders behind it, in the list at the bottom
function drill(el) {
  ui.slice = el.dataset.slot ? { slot: el.dataset.slot, label: el.dataset.l } : { from: +el.dataset.from, to: +el.dataset.to, label: el.dataset.name };
  ui.q = '';
  ui.status = 'all';
  ui.listMax = LIST_PAGE;
  hideTip();
  render();
  $('#rOrders').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- daily summary: what the owner gets by e-mail / SMS after closing ---------- */
const DIGEST_DEFAULTS = { email: '', phone: '', time: '22:30', emailOn: true, smsOn: false };
function digestData() {
  // the last day that has closed: today after 22:00 (in the mock only if the panel completed something), else yesterday
  const now = new Date(), today = dayStart(now), closed = now.getHours() >= 22 && stats(today, addDays(today, 1)).done.length;
  const day = closed ? today : addDays(today, -1);
  const s = stats(day, addDays(day, 1)), w = stats(addDays(day, -7), addDays(day, -6));
  const onsite = s.done.filter(o => o.pay !== 'online'), { timed, late } = service(s);
  const byHour = {};
  s.os.forEach(o => { const h = new Date(placedAt(o)).getHours(); byHour[h] = (byHour[h] ?? 0) + 1; });
  const peak = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
  const d = w.sales ? Math.round((s.sales - w.sales) / w.sales * 100) : null;
  return {
    day, s, weekAgo: addDays(day, -7), delta: d === null ? '' : `${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${num(Math.abs(d))}%`,
    door: sum(onsite.filter(o => o.fulfilment === 'delivery'), o => o.total), counter: sum(onsite.filter(o => o.fulfilment === 'pickup'), o => o.total),
    p24: p24(s), payout: nextBusinessDay(day), top: lineTotals(s, p => p.id).sort((a, b) => b.qty - a.qty).slice(0, 3),
    ontime: timed.length ? `${pct(timed.length - late.length, timed.length)}%` : '–', late: late.length, peak, reasons: reasonsOf(s),
  };
}
function openDigest() {
  const cfg = { ...DIGEST_DEFAULTS, ...store.get('v2_reports_digest', {}) };
  const times = [['22:30', '22:30'], ['23:00', '23:00'], ['08:00', t('r.dg.next_morning')]];
  openModal(`<h3>✉️ ${t('r.dg.title')}</h3>
    <p class="muted rdg__lead">${t('r.dg.lead')}</p>
    ${seg('data-digest-view', ui.digest, [['email', t('r.dg.email')], ['sms', t('r.dg.sms')]])}
    <div id="rDgPreview"></div>
    <form class="rdg__form" id="rDgForm">
      <h4 class="rh3">${t('r.dg.settings')}</h4>
      <label class="check"><input type="checkbox" name="emailOn"${cfg.emailOn ? ' checked' : ''}><span>${t('r.dg.send_email')}</span></label>
      <label>${t('r.dg.f_email')}<input type="email" name="email" value="${esc(cfg.email)}" placeholder="wlasciciel@example.com" autocomplete="off"></label>
      <label class="check"><input type="checkbox" name="smsOn"${cfg.smsOn ? ' checked' : ''}><span>${t('r.dg.send_sms')}</span></label>
      <label>${t('r.dg.f_phone')}<input type="tel" name="phone" value="${esc(cfg.phone)}" placeholder="500 100 200" autocomplete="off"></label>
      <label>${t('r.dg.f_time')}<select name="time">${times.map(([v, l]) => `<option value="${v}"${v === cfg.time ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="btn btn--primary btn--block">${t('r.dg.save')}</button>
      <p class="hint">${t('r.dg.mock')}</p>
    </form>`, 'rmodal--digest');
  renderDigest();
}
function renderDigest() {
  const cfg = { ...DIGEST_DEFAULTS, ...store.get('v2_reports_digest', {}) }, x = digestData(), s = x.s;
  const day = dayLabel(x.day), top = x.top.map(a => `${nameOf(a.p)} ×${a.qty}`).join(', ');
  $$('#rModalBody [data-digest-view]').forEach(b => b.classList.toggle('is-active', b.dataset.digestView === ui.digest));
  if (ui.digest === 'sms') {
    const text = t('r.dg.sms_text', { name: R.name, day: fmtDate(x.day, { weekday: 'short', day: 'numeric', month: 'numeric' }), sum: money(s.sales),
      n: num(s.n), delta: x.delta || '–', cash: money(x.door + x.counter), rej: num(s.rejected.length) });
    $('#rDgPreview').innerHTML = `<div class="rsms"><p class="rsms__to">${esc(cfg.phone || t('r.dg.no_phone'))}</p>
      <p class="rsms__bubble">${esc(text)}</p><small class="muted">${t('r.dg.chars', { n: text.length })}</small></div>`;
    return;
  }
  $('#rDgPreview').innerHTML = `<div class="rmail">
    <div class="rmail__meta"><span><b>${t('r.dg.to')}:</b> ${esc(cfg.email || t('r.dg.no_email'))}</span>
      <span><b>${t('r.dg.subject')}:</b> ${t('r.dg.subj', { name: R.name, day, sum: money(s.sales) })}${x.delta ? ` (${x.delta})` : ''}</span></div>
    <div class="rmail__body">
      <p class="rmail__brand"><img src="${R.logo}" alt=""><b>${R.name}</b></p>
      <h4>${t('r.dg.head', { day })}</h4>
      <p class="muted">${t('r.dg.vs', { day: dayLabel(x.weekAgo) })}</p>
      <div class="rmail__kpis">
        <div><small>${t('r.k.sales')}</small><strong>${money(s.sales)}</strong>${x.delta ? `<span>${x.delta}</span>` : ''}</div>
        <div><small>${t('r.k.orders')}</small><strong>${num(s.n)}</strong></div>
        <div><small>${t('r.k.avg')}</small><strong>${money(s.avg)}</strong></div>
        <div><small>${t('r.k.rejected')}</small><strong>${num(s.rejected.length)}</strong></div>
      </div>
      <ul class="rmail__list">
        <li>💵 ${t('r.dg.cash', { sum: money(x.door + x.counter), door: money(x.door), counter: money(x.counter) })}</li>
        <li>💳 ${t('r.dg.p24', { sum: money2(x.p24.net), day: dayLabel(x.payout) })}</li>
        ${top ? `<li>🏆 ${t('r.dg.top', { list: top })}</li>` : ''}
        <li>⏱ ${t('r.dg.service', { p: x.ontime, n: num(x.late) })}</li>
        ${x.peak ? `<li>🔥 ${t('r.dg.peak', { hours: hours(+x.peak[0]), n: x.peak[1] })}</li>` : ''}
        ${x.reasons.length ? `<li>✕ ${t('r.dg.rejected', { n: num(s.rejected.length) })}: ${x.reasons.map(([r, n]) => `${t(`reason.${r}`)} (${n})`).join(', ')}</li>` : ''}
      </ul>
      <span class="btn btn--primary rmail__btn">${t('r.dg.open')}</span>
    </div></div>`;
}

/* ---------- modal & toast ---------- */
function openModal(html, cls) {
  $('#rModalBody').innerHTML = html;
  $('#rModalBox').className = `modal__box rmodal ${cls}`;
  $('#rModal').hidden = false;
  hideTip();
}
const closeModal = () => { $('#rModal').hidden = true; };
let toastTimer = null;
function toast(msg) {
  const el = $('#rToast');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}

/* ---------- tooltip: hover, tap or keyboard focus; every value is also in a label, the table or the legend ---------- */
const tip = $('#rTip');
let tipFor = null, tipSince = 0, lastPointer = 'mouse';
function showTip(el) {
  if (tipFor === el) return;
  hideTip();
  tipFor = el;
  tipSince = Date.now();
  el.classList.add('is-hover');
  $('strong', tip).textContent = el.dataset.v;
  $('span', tip).textContent = el.dataset.l;
  $('small', tip).textContent = el.matches('[data-from], [data-slot]') ? t(matchMedia('(hover: none)').matches ? 'r.c.drill_touch' : 'r.c.drill') : '';
  tip.hidden = false;
  placeTip();
}
function placeTip() {                            // also on scroll – a tap on a phone can nudge the page, so it follows the mark
  if (!tipFor) return;
  const r = ($('i', tipFor) ?? tipFor).getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.left = `${Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))}px`;
  tip.style.top = `${Math.max(8, r.top - tip.offsetHeight - 8)}px`;
}
function hideTip() {
  tipFor?.classList.remove('is-hover');
  tipFor = null;
  tip.hidden = true;
}

/* ---------- PIN – a stand-in for the owner's login ---------- */
const session = {
  get: k => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
  del: k => { try { sessionStorage.removeItem(k); } catch {} },
};
let pin = '', tries = 0, waitUntil = 0, lastActive = Date.now();
function lock() {
  locked = true;
  session.del('v2_reports_unlocked');
  document.body.classList.add('is-locked');
  $('#rKpis').innerHTML = '';
  $('#rBody').innerHTML = '';
  closeModal();
  hideTip();
  pin = '';
  renderLock();
}
function unlock() {
  locked = false;
  tries = 0;
  pin = '';
  lastActive = Date.now();
  session.set('v2_reports_unlocked', '1');
  document.body.classList.remove('is-locked');
  render();
}
function renderLock(err = '') {
  document.title = `${t('r.title')} – ${R.name}`;
  $$('#rDots i').forEach((d, i) => d.classList.toggle('is-on', i < pin.length));
  const wait = Math.ceil((waitUntil - Date.now()) / 1000);
  $('#rPinErr').textContent = wait > 0 ? t('r.lock.wait', { n: wait }) : err;
  $$('#rKeys button').forEach(b => { b.disabled = wait > 0; });
}
function pinKey(k) {
  if (Date.now() < waitUntil) return;
  pin = k === 'del' ? pin.slice(0, -1) : (pin + k).slice(0, 4);
  renderLock();
  if (pin.length < 4) return;
  if (pin === PIN) { unlock(); return; }
  pin = '';
  tries += 1;
  const box = $('#rLockBox');
  box.classList.remove('is-wrong');
  void box.offsetWidth;                          // restart the shake
  box.classList.add('is-wrong');
  if (tries >= PIN_TRIES) {
    tries = 0;
    waitUntil = Date.now() + PIN_WAIT * 1000;
    const timer = setInterval(() => { renderLock(); if (Date.now() >= waitUntil) clearInterval(timer); }, 1000);
  }
  renderLock(t('r.lock.wrong'));
}

/* ---------- CSV: the period's orders, no personal data ---------- */
function exportCsv() {
  const p = period(), s = stats(p.from, p.to);
  const cell = v => (/[;"\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const rows = [t('r.csv.cols').split(';'), ...s.os.sort((a, b) => placedAt(a) - placedAt(b)).map(o => [
    o.no, ymd(placedAt(o)), clock(placedAt(o)), stOf(o), t(o.fulfilment === 'delivery' ? 'f.delivery' : 'f.pickup'),
    t(o.pay === 'online' ? 'r.pay.l_online' : 'r.pay.l_onsite'), sum(o.lines, l => l.qty), o.fee, o.total, o.lang, areaName(o.area),
  ])];
  const blob = new Blob([`﻿${rows.map(r => r.map(cell).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `raport-${ymd(p.from)}_${ymd(p.to - 1)}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- events ---------- */
function setPeriod(id) {
  if (id === 'custom' && ui.period !== 'custom') {   // a custom range starts from what is on screen
    const p = period();
    ui.custom = { from: dayStart(p.from), to: dayStart(p.to - 1) };
  }
  ui.period = id;
  ui.slice = null;
  ui.listMax = LIST_PAGE;
  ui.allPayouts = false;
}
document.addEventListener('click', e => {
  const target = e.target;
  const key = target.closest('[data-key]');
  if (key) { pinKey(key.dataset.key); return; }
  if (target.closest('[data-close]') || target.id === 'rModal') { closeModal(); return; }
  // a chart mark: hover (or the first tap) shows its value, a click (or a second tap) lists the orders behind it
  const mark = target.closest('[data-from], [data-slot]');
  if (mark) {
    if (lastPointer !== 'mouse' && (tipFor !== mark || Date.now() - tipSince < 600)) showTip(mark);
    else drill(mark);
    return;
  }
  const ord = target.closest('[data-order]');
  if (ord) { openOrder(BY_ID.get(ord.dataset.order)); return; }
  const el = target.closest(`[data-period], [data-metric], [data-dish], [data-all-dishes], [data-all-payouts], [data-ostatus],
    [data-unslice], [data-more], [data-digest-view], #rCsv, #rPrint, #rDigest, #rLockBtn`);
  if (!el) return;
  if (el.dataset.ostatus) { ui.status = el.dataset.ostatus; ui.listMax = LIST_PAGE; renderOrders(); return; }
  if (el.matches('[data-unslice]')) { ui.slice = null; ui.listMax = LIST_PAGE; renderOrders(); return; }
  if (el.matches('[data-more]')) { ui.listMax += LIST_PAGE; renderOrders(); return; }
  if (el.dataset.digestView) { ui.digest = el.dataset.digestView; renderDigest(); return; }
  if (el.id === 'rCsv') { exportCsv(); return; }
  if (el.id === 'rPrint') { print(); return; }
  if (el.id === 'rDigest') { openDigest(); return; }
  if (el.id === 'rLockBtn') { lock(); return; }
  if (el.dataset.period) setPeriod(el.dataset.period);
  else if (el.dataset.metric) ui.metric = el.dataset.metric;
  else if (el.dataset.dish) ui.dish = el.dataset.dish;
  else if (el.matches('[data-all-dishes]')) ui.allDishes = !ui.allDishes;
  else if (el.matches('[data-all-payouts]')) ui.allPayouts = !ui.allPayouts;
  hideTip();
  render();
});
document.addEventListener('change', e => {
  if (e.target.id === 'rCompare') { ui.compare = e.target.value; render(); }
  if (e.target.id === 'rFrom' || e.target.id === 'rTo') {
    const today = dayStart(Date.now()), min = addDays(today, -CUSTOM_DAYS);
    const day = v => Math.min(today, Math.max(min, v ? parseYmd(v) : today));
    let from = day($('#rFrom').value), to = day($('#rTo').value);
    if (from > to) [from, to] = [to, from];
    ui.custom = { from, to };
    ui.slice = null;
    render();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'rSearch') { ui.q = e.target.value; ui.listMax = LIST_PAGE; renderOrders(); }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'rDgForm') return;
  e.preventDefault();
  const f = e.target.elements;
  store.set('v2_reports_digest', { email: f.email.value.trim(), phone: f.phone.value.trim(), time: f.time.value,
    emailOn: f.emailOn.checked, smsOn: f.smsOn.checked });
  renderDigest();
  toast(t('r.dg.saved'));
});
document.addEventListener('keydown', e => {
  lastPointer = 'mouse';                         // Enter / Space on a focused bar lists its orders right away
  if (e.key === 'Escape') closeModal();
  if (locked && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (/^\d$/.test(e.key)) pinKey(e.key);
    else if (e.key === 'Backspace') pinKey('del');
  }
});
document.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; }, true);
document.addEventListener('pointerover', e => { const el = e.target.closest('[data-v]'); if (el) showTip(el); else hideTip(); });
document.addEventListener('focusin', e => { const el = e.target.closest('[data-v]'); if (el) showTip(el); else hideTip(); });
addEventListener('scroll', placeTip, { passive: true });
addEventListener('resize', placeTip);
// locks itself after a while without anyone touching it
['pointerdown', 'keydown', 'scroll'].forEach(ev => addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true, capture: true }));
setInterval(() => { if (!locked && Date.now() - lastActive > IDLE_LOCK) lock(); }, 30e3);
$$('.lang select').forEach(s => s.addEventListener('change', e => {
  LANG = e.target.value;
  store.set('v2_panel_lang', LANG);
  applyI18n(); renderLang(); renderLock(); render();
  if (!$('#rModal').hidden) closeModal();
}));
// the panel accepting / completing an order in another tab
addEventListener('storage', e => { if (e.key === 'v2_orders') { load(); render(); } });

$('#rLogo').innerHTML = $('#rLockLogo').innerHTML = `<img src="${R.logo}" alt="">`;
$('#rName').textContent = R.name;
load();
applyI18n();
renderLang();
if (session.get('v2_reports_unlocked')) unlock(); else lock();
