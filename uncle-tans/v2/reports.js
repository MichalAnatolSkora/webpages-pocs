// Reports – reports.html. The owner's look back at online orders: sales, what to reconcile (paid online vs collected
// in person), best sellers, busy hours, service times and customers – for a period, compared with the one before.
// Production: behind the owner's login (the counter tablet only gets the orders panel), numbers from the backend.
// Mock: the days before today are generated, seeded per date so a day looks the same on every reload; today is the
// panel's real orders (localStorage, common.js) and updates live when the panel moves an order on.

const LOCALES = { pl: 'pl-PL', en: 'en-GB', de: 'de-DE', vi: 'vi-VN' };
const HISTORY_DAYS = 130;                        // covers the oldest month on offer plus the month before it
const OPEN_HOURS = [12, 21];                     // first and last hour that takes orders (R.hours 12:00–22:00)
const CLOSED = ['done', 'rejected'];
const TOP_DISHES = 8, TOP_CATS = 8;

const ui = { period: '7d', metric: 'sales', dish: 'qty', allDishes: false };
let ALL = [];                                    // every placed order: generated history + the panel's real ones
let SEEDED = null;

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
const loc = () => LOCALES[LANG];
const fmtDate = (ms, opts) => new Intl.DateTimeFormat(loc(), opts).format(ms);
const cap = s => s.charAt(0).toLocaleUpperCase(loc()) + s.slice(1);
const ymd = ms => new Date(ms).toLocaleDateString('sv-SE');          // 2026-10-07
const num = (n, digits = 0) => n.toLocaleString(loc(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
const money = n => `${num(Math.round(n))} zł`;
const pct = (part, whole) => (whole ? Math.round(part / whole * 100) : 0);
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const hours = h => `${h}:00–${h + 1}:00`;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
function fmtRange(from, to) {                    // `to` is exclusive
  const last = to - 1, single = dayStart(from) === dayStart(last);
  const f = new Intl.DateTimeFormat(loc(), { ...(single && { weekday: 'short' }), day: 'numeric', month: 'short',
    ...(new Date(from).getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) });
  return single ? f.format(from) : f.formatRange(from, last);
}
const weekdayName = dow => fmtDate(new Date(2026, 0, 4 + dow), { weekday: 'short' });   // 4 Jan 2026 was a Sunday

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
const WEEKDAY_ORDERS = [22, 13, 14, 15, 17, 26, 28];                 // Sun … Sat, before the random spread
const HOUR_WEIGHTS = {                                                // 12:00 … 21:00
  week: [9, 12, 7, 4, 4, 6, 9, 10, 7, 3],                             // office lunch in the old town
  weekend: [4, 6, 6, 5, 5, 7, 11, 13, 10, 5],
};
const POPULAR = { p1: 9, t1: 7, k1: 7, s1: 6, bc1: 6, p2: 5, c3: 5, k2: 4, k4: 4, n1: 4, x1: 4, w1: 3, d1: 3, r2: 3, u3: 3, x2: 3, x7: 3, e1: 2 };
const MAIN_CATS = ['pho', 'wonton', 'curry', 'chicken', 'beef', 'duck', 'rice', 'noodles', 'udon', 'padthai', 'buncha', 'veg'];
const pool = cats => PRODUCTS.filter(p => cats.includes(p.cat) && !p.alcohol).map(p => [p, POPULAR[p.id] ?? 1.5]);
const MAINS = pool(MAIN_CATS), STARTERS = pool(['starters']), DRINKS = pool(['drinks']), DESSERTS = pool(['desserts']), ADDONS = pool(['addons']);
const LANG_MIX = [['pl', 80], ['en', 9], ['vi', 6], ['de', 5]];
const dateSeed = day => { const d = new Date(day); return d.getFullYear() * 1e4 + (d.getMonth() + 1) * 100 + d.getDate(); };

function dayPlan(day) {                          // how many orders a day gets, and how many of them from new customers
  const d = new Date(day), r = rng(dateSeed(day));
  const doy = (day - new Date(d.getFullYear(), 0, 1)) / DAY;
  const season = 1 + .15 * Math.cos(2 * Math.PI * (doy - 15) / 365);   // busier in the cold months
  const n = Math.round(WEEKDAY_ORDERS[d.getDay()] * season * (.8 + .4 * r()));
  return { r, n, fresh: Math.round(n * (.22 + .16 * r())) };
}
// a customer id is "<date of their first order>-<n>", so a returning one can be drawn from any earlier day
function returning(r, day) {
  const first = addDays(day, -Math.ceil(90 * r() ** 2));
  return [`${dateSeed(first)}-${Math.floor(r() * Math.max(1, dayPlan(first).fresh))}`, first];
}
const langOf = id => pickW(rng([...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)), LANG_MIX);

function seedDay(day) {
  const { r, n, fresh } = dayPlan(day), dow = new Date(day).getDay();
  const hourW = HOUR_WEIGHTS[dow === 0 || dow === 6 ? 'weekend' : 'week'].map((w, i) => [OPEN_HOURS[0] + i, w]);
  return Array.from({ length: n }, (_, i) => {
    const h = pickW(r, hourW), placed = new Date(day).setHours(h, Math.floor(r() * 60), Math.floor(r() * 60));
    const [cid, cfirst] = i < fresh ? [`${dateSeed(day)}-${i}`, day] : returning(r, day);
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
      lang: langOf(cid), cid, cfirst, abandonedOnline: pay === 'on_delivery' && r() < .04,
      history: [{ status: 'placed', at: placed }],
    };
    const step = (status, at) => o.history.push({ status, at: Math.round(at) });
    const accepted = placed + (.5 + 7 * r() ** 2.5) * MIN;
    if (r() < .035) {
      o.status = 'rejected';
      o.reason = pickW(r, [['unavailable', 35], ['busy', 30], ['closing', 10], ['contact', 10], ['zone', delivery ? 15 : 0]]);
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
      o.dueAt = accepted + pickW(r, delivery ? [[30, 2], [45, 5], [60, 2]] : [[10, 1], [15, 4], [20, 3], [30, 1]]) * MIN;
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
  const real = orders.all().filter(isPlaced).map(o => ({ ...o, cid: o.phone.replace(/\s/g, '') }));
  real.forEach(o => { o.cfirst = Math.min(...real.filter(x => x.cid === o.cid).map(placedAt)); });
  ALL = [...SEEDED, ...real];
}

/* ---------- periods & numbers ---------- */
function periods() {
  const now = Date.now(), today = dayStart(now), weekBefore = ms => addDays(ms, -7);
  const month = k => { const d = new Date(today); return new Date(d.getFullYear(), d.getMonth() - k, 1).getTime(); };
  return [
    { id: 'today', label: t('r.p.today'), from: today, to: now, back: weekBefore, by: 'hour' },   // vs the same weekday
    { id: 'yesterday', label: t('r.p.yesterday'), from: addDays(today, -1), to: today, back: weekBefore, by: 'hour' },
    { id: '7d', label: t('r.p.7d'), from: addDays(today, -6), to: now, back: weekBefore, by: 'day' },
    { id: '30d', label: t('r.p.30d'), from: addDays(today, -29), to: now, back: ms => addDays(ms, -30), by: 'day' },
    ...[0, 1, 2].map(k => ({ id: `m${k}`, label: cap(fmtDate(month(k), { month: 'long' })), short: cap(fmtDate(month(k), { month: 'short' })),
      from: month(k), to: k ? month(k - 1) : now, back: ms => addMonths(ms, -1), by: 'day' })),
  ];
}
function stats(from, to) {
  const os = ALL.filter(o => { const at = placedAt(o); return at >= from && at < to; });
  const done = os.filter(o => o.status === 'done');
  const sales = sum(done, o => o.total);
  return {
    os, done, sales, n: done.length, avg: done.length ? sales / done.length : 0,
    rejected: os.filter(o => o.status === 'rejected'), open: os.filter(o => !CLOSED.includes(o.status)),
  };
}
const at = (o, status) => o.history?.find(h => h.status === status)?.at;
const fulfilledAt = o => at(o, o.fulfilment === 'delivery' ? 'done' : 'ready') ?? at(o, 'done');   // what the promised time is about
const stLabel = o => t(o.status === 'done' ? `p.st.done_${o.fulfilment}` : `p.st.${o.status}`);

/* ---------- render ---------- */
function render() {
  const p = periods().find(x => x.id === ui.period), cur = stats(p.from, p.to), prev = stats(p.back(p.from), p.back(p.to));
  const live = p.to > dayStart(Date.now());
  document.title = `${t('r.title')} – ${R.name}`;
  $('#rPeriods').innerHTML = periods().map(x =>
    `<button data-period="${x.id}" class="${x.id === ui.period ? 'is-active' : ''}">${x.short             // short month names on phones
      ? `<span class="rchip__long">${x.label}</span><span class="rchip__short">${x.short}</span>` : x.label}</button>`).join('');
  $('#rRange').innerHTML = `<strong>${fmtRange(p.from, p.to)}</strong>${live ? `<span class="rlive">${t('r.live')}</span>` : ''}
    <span class="muted">${t('r.vs', { range: fmtRange(p.back(p.from), p.back(p.to)) })}</span>`;
  $('#rPrintHead').textContent = `${R.name} · ${t('r.title')} · ${fmtRange(p.from, p.to)}`;
  renderKpis(cur, prev);
  $('#rBody').innerHTML = cur.done.length
    ? [salesCard(p, cur), paymentsCard(cur), customersCard(p, cur), dishesCard(cur), categoriesCard(cur),
      ...(p.by === 'day'                         // a single day has no weekday × hour pattern to show
        ? [heatmapCard(cur), fulfilmentCard(cur), serviceCard(cur, 'rcard--full')]
        : [serviceCard(cur, 'rcard--wide'), fulfilmentCard(cur)])].join('')
    : `<div class="rcard rcard--full rempty">${t(live ? 'r.empty.today' : 'r.empty')}</div>`;
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

const card = (cls, title, sub, body, tools = '') => `<section class="rcard ${cls}">
  <div class="rcard__head"><div><h2>${title}</h2>${sub ? `<p class="rcard__sub">${sub}</p>` : ''}</div>${tools}</div>${body}</section>`;
const seg = (attr, value, options) => `<div class="seg rseg">${options.map(([v, label]) =>
  `<button ${attr}="${v}" class="${v === value ? 'is-active' : ''}">${label}</button>`).join('')}</div>`;

/* sales over time – one series, so no legend; values on hover / focus and in the table */
function niceStep(v) {
  const e = 10 ** Math.floor(Math.log10(v)), f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
}
function buckets(p, s) {
  const now = Date.now();
  let out;
  if (p.by === 'hour') {
    const hs = s.os.map(o => new Date(placedAt(o)).getHours());
    out = range(Math.min(OPEN_HOURS[0], ...hs), Math.max(OPEN_HOURS[1], ...hs)).map(h => {
      const from = new Date(p.from).setHours(h);
      return { from, to: from + 36e5, axis: `${h}`, label: hours(h) };
    });
  } else {
    const n = Math.round((dayStart(p.to - 1) - p.from) / DAY) + 1, every = n <= 7 ? 1 : Math.ceil(n / 6);
    out = range(0, n - 1).map(i => {
      const from = addDays(p.from, i);
      return { from, to: addDays(from, 1), label: cap(fmtDate(from, { weekday: 'short', day: 'numeric', month: 'short' })),
        axis: n <= 7 ? fmtDate(from, { weekday: 'short' }) : i % every ? '' : fmtDate(from, { day: 'numeric', month: 'short' }) };
    });
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
      <div class="rchart__bars">${bs.map(b => `<button class="rcol${b.now ? ' is-now' : ''}" data-v="${fmt(b[key])}"
        data-l="${b.label} · ${key === 'sales' ? t('r.n_orders', { n: b.n }) : money(b.sales)}${b.now ? ` · ${t('r.c.now')}` : ''}"
        aria-label="${b.label}: ${fmt(b[key])}"><i style="height:${b[key] / top * 100}%"></i></button>`).join('')}</div>
    </div>
    <span></span><div class="rchart__x">${bs.map(b => `<span>${b.axis}</span>`).join('')}</div>
  </div>`;
  const table = `<details class="rtable"><summary>${t('r.c.table')}</summary><div class="rtable__scroll"><table>
    <thead><tr><th>${t(p.by === 'hour' ? 'r.t.hour' : 'r.t.day')}</th><th>${t('r.t.orders')}</th><th>${t('r.t.sales')}</th><th>${t('r.t.avg')}</th></tr></thead>
    <tbody>${bs.map(b => `<tr><td>${b.label}</td><td>${num(b.n)}</td><td>${money(b.sales)}</td><td>${b.n ? money(b.sales / b.n) : '–'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>${t('cart.total')}</td><td>${num(s.n)}</td><td>${money(s.sales)}</td><td>${money(s.avg)}</td></tr></tfoot>
  </table></div></details>`;
  return card('rcard--full', t('r.c.title'), t(p.by === 'hour' ? 'r.c.by_hour' : 'r.c.by_day'), chart + table,
    seg('data-metric', ui.metric, [['sales', t('r.m.sales')], ['orders', t('r.m.orders')]]));
}

/* part-to-whole: one bar split in two (2px surface gap), legend with label · share · amount */
function stack(parts) {
  const total = sum(parts, x => x.value);
  return `<div class="rstack">${parts.filter(x => x.value).map(x => `<i class="rstack--${x.c}" style="flex:${x.value}"></i>`).join('')}</div>
    <ul class="rlegend">${parts.map(x => `<li><i class="rstack--${x.c}"></i><span>${x.label}</span><b>${pct(x.value, total)}%</b><span class="muted">${x.sub}</span></li>`).join('')}</ul>`;
}
function paymentsCard(s) {
  const online = s.done.filter(o => o.pay === 'online'), onsite = s.done.filter(o => o.pay !== 'online');
  const atDoor = onsite.filter(o => o.fulfilment === 'delivery'), atCounter = onsite.filter(o => o.fulfilment === 'pickup');
  const refunds = s.rejected.filter(o => o.pay === 'online');
  const row = (icon, label, os, cls = '', amount = money(sum(os, o => o.total))) =>
    `<div class="rrow ${cls}"><span>${icon} ${label}</span><span class="muted">${t('r.n_orders', { n: num(os.length) })}</span><b>${amount}</b></div>`;
  return card('', t('r.pay.title'), '', stack([
    { label: t('r.pay.l_online'), value: sum(online, o => o.total), c: 'a', sub: money(sum(online, o => o.total)) },
    { label: t('r.pay.l_onsite'), value: sum(onsite, o => o.total), c: 'b', sub: money(sum(onsite, o => o.total)) },
  ]) + `<div class="rrows">
    ${row('💳', t('r.pay.online'), online)}
    ${row('🚚', t('r.pay.delivery'), atDoor)}
    ${row('🥡', t('r.pay.pickup'), atCounter)}
    ${row('', t('cart.total'), s.done, 'rrow--total')}
    <div class="rrow rrow--sub"><span>${t('r.pay.fees')}</span><span class="muted"></span><span>${money(sum(s.done, o => o.fee))}</span></div>
    ${refunds.length ? row('↩', t('r.pay.refunds'), refunds, 'rrow--refund', `−${money(sum(refunds, o => o.total))}`) : ''}
  </div><p class="rnote">${t('r.pay.hint')}</p>`);
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

/* when people order – weekday × hour, one hue light → dark */
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
      return `<i class="rheat__c" style="--v:${v ? Math.round(12 + 88 * v / max) : 0}%" data-v="${t('r.n_orders', { n: v })}"
        data-l="${cap(weekdayName(d))}, ${hours(h)}"></i>`;
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
  return card('', t('r.cu.title'), t('r.cu.sub'), `<p class="rbig"><strong>${num(ids.length)}</strong> ${t('r.cu.unique')}</p>
    ${stack([
      { label: t('r.cu.returning'), value: ids.length - fresh, c: 'a', sub: num(ids.length - fresh) },
      { label: t('r.cu.new'), value: fresh, c: 'b', sub: num(fresh) },
    ])}
    <h3 class="rh3">${t('r.cu.lang')}</h3>
    <ul class="rlangs">${langs.map(x => `<li><span class="lang__flag">${FLAG_SVG[x.l.code]}</span><span>${x.l.name}</span>
      <div class="rbarh"><i style="width:${x.n / max * 100}%"></i></div><b>${pct(x.n, placed.length)}%</b></li>`).join('')}</ul>`);
}

function serviceCard(s, cls) {
  const acc = s.os.filter(o => at(o, 'accepted')).map(o => (at(o, 'accepted') - placedAt(o)) / MIN);
  const timed = s.done.filter(o => o.dueAt && fulfilledAt(o)), late = timed.filter(o => fulfilledAt(o) > o.dueAt);
  const lateMin = late.length ? sum(late, o => (fulfilledAt(o) - o.dueAt) / MIN) / late.length : 0;
  const abandoned = s.os.filter(o => o.abandonedOnline).length;
  const reasons = Object.entries(s.rejected.reduce((m, o) => ({ ...m, [o.reason]: (m[o.reason] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const max = reasons[0]?.[1] || 1;
  const mini = (label, value, sub, cls = '') => `<div class="rmini ${cls}"><small>${label}</small><strong>${value}</strong><p>${sub}</p></div>`;
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

/* ---------- tooltip: hover, tap or keyboard focus; every value is also in a label, the table or the legend ---------- */
const tip = $('#rTip');
let tipFor = null;
function showTip(el) {
  if (tipFor === el) return;
  hideTip();
  tipFor = el;
  el.classList.add('is-hover');
  $('strong', tip).textContent = el.dataset.v;
  $('span', tip).textContent = el.dataset.l;
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

/* ---------- CSV: the period's orders, no personal data ---------- */
function exportCsv() {
  const p = periods().find(x => x.id === ui.period), s = stats(p.from, p.to);
  const cell = v => (/[;"\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const rows = [t('r.csv.cols').split(';'), ...s.os.sort((a, b) => placedAt(a) - placedAt(b)).map(o => [
    o.no, ymd(placedAt(o)), clock(placedAt(o)), stLabel(o), t(o.fulfilment === 'delivery' ? 'f.delivery' : 'f.pickup'),
    t(o.pay === 'online' ? 'r.pay.l_online' : 'r.pay.l_onsite'), sum(o.lines, l => l.qty), o.fee, o.total, o.lang,
  ])];
  const blob = new Blob([`﻿${rows.map(r => r.map(cell).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `raport-${ymd(p.from)}_${ymd(p.to - 1)}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-period], [data-metric], [data-dish], [data-all-dishes], #rCsv, #rPrint');
  if (!el) return;
  if (el.dataset.period) ui.period = el.dataset.period;
  else if (el.dataset.metric) ui.metric = el.dataset.metric;
  else if (el.dataset.dish) ui.dish = el.dataset.dish;
  else if (el.matches('[data-all-dishes]')) ui.allDishes = !ui.allDishes;
  else if (el.id === 'rCsv') return exportCsv();
  else if (el.id === 'rPrint') return print();
  hideTip();
  render();
});
document.addEventListener('pointerover', e => { const el = e.target.closest('[data-v]'); if (el) showTip(el); else hideTip(); });
document.addEventListener('focusin', e => { const el = e.target.closest('[data-v]'); if (el) showTip(el); else hideTip(); });
addEventListener('scroll', placeTip, { passive: true });
addEventListener('resize', placeTip);
$$('.lang select').forEach(s => s.addEventListener('change', e => {
  LANG = e.target.value;
  store.set('v2_panel_lang', LANG);
  applyI18n(); renderLang(); render();
}));
// the panel accepting / completing an order in another tab
addEventListener('storage', e => { if (e.key === 'v2_orders') { load(); render(); } });

$('#rLogo').innerHTML = `<img src="${R.logo}" alt="">`;
$('#rName').textContent = R.name;
load();
applyI18n();
renderLang();
render();
