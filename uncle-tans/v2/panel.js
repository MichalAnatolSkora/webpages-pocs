// Restaurant panel – panel.html. The tablet on the counter during service (ADMIN.md): an order shows up here once the
// restaurant has it – paid online, or pay on delivery / pickup – with a chime that repeats until someone accepts it.
// Accept with a time (the customer's order page shows it; SMS in production) or reject with a reason, then
// ready (pickup) / handed to the driver (delivery) → done. Orders live in localStorage (common.js); what other tabs
// do – a customer ordering, Przelewy24 confirming a payment – arrives through the storage event.

const ETAS = { delivery: [30, 45, 60, 75, 90], pickup: [10, 15, 20, 30, 45] };     // minutes, "accept" picker
const REASONS = ['unavailable', 'busy', 'closing', 'zone', 'contact'];               // `zone` only for delivery
const LANES = [['placed', ['placed']], ['accepted', ['accepted']], ['ready', ['ready', 'out']]];
const CLOSED = ['done', 'rejected'];
const NEXT = { accepted: o => (o.fulfilment === 'delivery' ? 'out' : 'ready'), ready: () => 'done', out: () => 'done' };
const NOTIFY = ['accepted', 'ready', 'out', 'rejected'];                             // steps the customer gets an SMS for
const LATE_NEW = 5;                              // minutes before an unaccepted order turns red

const ui = { tab: 'active', sel: null, eta: null, sound: store.get('v2_panel_sound', true) };
let list = [];                                   // today's orders the restaurant has
let known = null;                                // new orders already announced

// the panel's own language – in production it runs on another device than the customer's browser
const panelLang = store.get('v2_panel_lang', null);
if (I18N[panelLang]) LANG = panelLang;

/* ---------- orders ---------- */
const isToday = ms => new Date(ms).toDateString() === new Date().toDateString();
const lastAt = o => o.history?.at(-1)?.at ?? placedAt(o);
const stLabel = (o, status = o.status) => t(status === 'done' ? `p.st.done_${o.fulfilment}` : `p.st.${status}`);
const selected = () => list.find(o => o.id === ui.sel);
function defaultEta(o) {
  const m = parseInt((o.fulfilment === 'delivery' ? R.delivery : R.pickup).eta, 10);
  return ETAS[o.fulfilment].includes(m) ? m : ETAS[o.fulfilment][1];
}
function dueFor(o) {                             // what the customer is promised: now + picked minutes, or their time slot
  if (o.time === 'asap') return Date.now() + ui.eta * 60000;
  const [h, m] = o.time.split(':').map(Number), d = new Date();
  return d.setHours(h, m, 0, 0);
}
function countdown(o) {                          // [label, late?]
  const left = Math.round((o.dueAt - Date.now()) / 60000);
  return [left < 0 ? t('p.late', { n: -left }) : t('p.due_in', { n: left }), left < 0];
}

// The mock has no server, so the panel stands in for it: a payment whose IPN has arrived places the order even
// when the customer has closed the order page (P24 notifies the backend, not the customer's browser).
function receivePayments() {
  orders.all().filter(o => o.status === 'awaiting_payment' && ipnArrived(o)).forEach(o => setStatus(o, 'placed'));
}
function sync() {
  receivePayments();
  list = orders.all().filter(o => isPlaced(o) && isToday(placedAt(o)));
  const fresh = known ? list.filter(o => o.status === 'placed' && !known.has(o.id)) : [];
  known = new Set(list.filter(o => o.status === 'placed').map(o => o.id));
  if (fresh.length) {
    chime();
    toast(t('p.toast.new', { no: fresh.map(o => o.no).join(', ') }));
    if (!selected()) { ui.tab = 'active'; select(fresh[0].id); }
  }
  render();
}
function select(id) {
  if (id !== ui.sel) {
    ui.sel = id;
    ui.eta = selected() ? defaultEta(selected()) : null;
    $('#pBody').scrollTop = 0;
  }
  render();
}
function advance(o, status, extra = {}) {
  if (status === 'accepted') extra.dueAt = dueFor(o);
  setStatus(o, status, extra);                   // production: RefundAsync when a paid order is rejected
  toast(t(NOTIFY.includes(status) ? 'p.toast.sms' : 'p.toast.status', { no: o.no, status: stLabel(o) }));
  if (CLOSED.includes(status)) ui.sel = null;
  sync();
}

/* ---------- render ---------- */
let drawn = '';
function render() {                              // skipped when nothing changed, so a tap isn't lost to a re-render
  const key = JSON.stringify([list, ui, LANG, Math.floor(Date.now() / 30000)]);
  if (key === drawn) return;
  drawn = key;
  renderTop(); renderList(); renderDetail();
}
function renderTop() {
  const counted = list.filter(o => o.status !== 'rejected'), fresh = list.filter(o => o.status === 'placed').length;
  $('#pStats').textContent = t('p.today', { n: counted.length, sum: zl(counted.reduce((s, o) => s + o.total, 0)) });
  $('#pActiveN').textContent = list.filter(o => !CLOSED.includes(o.status)).length || '';
  $('#pSound').innerHTML = `${ui.sound ? '🔔' : '🔕'}<span>${t(ui.sound ? 'p.sound_on' : 'p.sound_off')}</span>`;
  $('#pSound').setAttribute('aria-pressed', ui.sound);
  $$('#pTabs button').forEach(b => b.classList.toggle('is-active', b.dataset.tab === ui.tab));
  document.title = `${fresh ? `(${fresh}) ` : ''}${t('p.title')} – ${R.name}`;
  renderUnlock();
}

function timing(o) {                             // list row: [label, late?]
  if (o.status === 'placed') {
    const m = Math.floor((Date.now() - placedAt(o)) / 60000);
    return [m < 1 ? t('p.just_now') : t('p.ago', { n: m }), m >= LATE_NEW];
  }
  if (CLOSED.includes(o.status)) return [clock(lastAt(o)), false];
  const due = t('p.due', { time: clock(o.dueAt) });
  if (o.status === 'ready') return [due, false];
  const [left, late] = countdown(o);
  return [`${due} · ${left}`, late];
}
const payTag = o => (o.pay === 'online'
  ? `<span class="ptag ptag--paid">✓ ${t('p.badge.paid')}</span>`
  : `<span class="ptag ptag--collect">💵 ${t('p.badge.collect')}</span>`);
function row(o) {
  const [time, late] = timing(o), n = o.lines.reduce((s, l) => s + l.qty, 0);
  const tags = [
    CLOSED.includes(o.status) ? `<span class="pchip pchip--${o.status}">${stLabel(o)}</span>` : payTag(o),
    o.status === 'placed' && o.time !== 'asap' ? `<span class="ptag">📅 ${t('p.due', { time: o.time })}</span>` : '',
    o.notes ? '<span class="ptag">💬</span>' : '',
  ].join('');
  return `<button class="porder porder--${o.status}${o.id === ui.sel ? ' is-sel' : ''}" data-id="${o.id}">
    <span class="porder__top"><strong>${o.no}</strong><span aria-hidden="true">${o.fulfilment === 'delivery' ? '🚚' : '🥡'}</span>
      <span class="porder__time${late ? ' is-late' : ''}">${time}</span></span>
    <span class="porder__mid"><span>${esc(o.name)} · ${t('p.qty', { n })}</span><strong>${zl(o.total)}</strong></span>
    <span class="porder__tags">${tags}</span>
  </button>`;
}
function renderList() {
  let html;
  if (ui.tab === 'active') {
    html = LANES.map(([lane, statuses]) => {
      const os = list.filter(o => statuses.includes(o.status))
        .sort((a, b) => (lane === 'placed' ? placedAt(a) - placedAt(b) : a.dueAt - b.dueAt));   // longest waiting first
      return os.length ? `<h3 class="plane plane--${lane}">${t(`p.lane.${lane}`)}<span>${os.length}</span></h3>${os.map(row).join('')}` : '';
    }).join('') || `<div class="pempty">${t('p.empty.active')}<small>${t('p.demo.hint')}</small></div>`;
  } else {
    html = list.filter(o => CLOSED.includes(o.status)).sort((a, b) => lastAt(b) - lastAt(a)).map(row).join('')
      || `<div class="pempty">${t('p.empty.closed')}</div>`;
  }
  $('#pList').innerHTML = html;
}

function renderDetail() {
  const o = selected();
  $('#pMain').classList.toggle('has-detail', !!o);
  if (!o) {
    $('#pBody').innerHTML = `<div class="pempty pempty--detail">${t('p.pick')}</div>`;
    $('#pActions').hidden = true;
    return;
  }
  const delivery = o.fulfilment === 'delivery', lang = LANGS.find(l => l.code === o.lang) ?? LANGS[0];
  const when = o.dueAt ? t('p.due', { time: clock(o.dueAt) }) : o.time === 'asap' ? t('p.asap') : t('p.due', { time: o.time });
  const [left, late] = ['accepted', 'out'].includes(o.status) ? countdown(o) : [];
  $('#pBody').innerHTML = `
    <div class="pdetail__head">
      <button class="icon-btn pdetail__back" data-back aria-label="${t('p.list')}">←</button>
      <h2>${o.no}</h2><span class="pchip pchip--${o.status}">${stLabel(o)}</span>
      <span class="pdetail__placed">${t('p.placed_at', { time: clock(placedAt(o)) })}</span>
    </div>
    <div class="pfacts">
      <div class="pfact"><small>${delivery ? '🚚' : '🥡'} ${t(delivery ? 'f.delivery' : 'f.pickup_long')}</small>
        <strong>${when}</strong>${left ? `<span class="${late ? 'is-late' : ''}">${left}</span>` : ''}</div>
      <div class="pfact pfact--${o.pay === 'online' ? 'paid' : 'collect'}">
        <small>${o.pay === 'online' ? `✓ ${t('p.paid')}` : `💵 ${t(delivery ? 'p.collect_delivery' : 'p.collect_pickup')}`}</small>
        <strong>${zl(o.total)}</strong></div>
    </div>
    ${delivery ? `<p class="paddress">📍 ${esc(o.address)}</p>` : ''}
    ${o.notes ? `<p class="pnotes">💬 ${esc(o.notes)}</p>` : ''}
    <div class="pticket">
      ${o.lines.map(l => { const p = byId(l.pid); return `<div class="pline"><span class="pline__qty">${l.qty}×</span>
        <span>${nameOf(p)}${l.variant ? `<small>${variantName(l)}</small>` : ''}</span><span class="pline__price">${zl(p.price * l.qty)}</span></div>`; }).join('')}
      ${o.fee ? `<div class="row"><span>${t('cart.delivery')}</span><span>${zl(o.fee)}</span></div>` : ''}
      <div class="row row--total"><span>${t('cart.total')}</span><span>${zl(o.total)}</span></div>
    </div>
    ${o.status === 'rejected' ? `<p class="note">${t('done.reason', { reason: t(`reason.${o.reason}`) })}</p>` : ''}
    ${o.abandonedOnline ? `<p class="note">${t('p.abandoned')}</p>` : ''}
    <div class="psection">
      <h3>${t('p.customer')}</h3>
      <p><strong>${esc(o.name)}</strong> · <a href="tel:${esc(o.phone.replace(/\s/g, ''))}">${esc(o.phone)}</a></p>
      <p class="muted">${esc(o.email)} · ${t('p.lang', { lang: `${lang.flag} ${lang.name}` })}</p>
    </div>
    <div class="psection">
      <h3>${t('p.history')}</h3>
      <p class="phistory">${(o.history ?? []).map(h => `<span><b>${clock(h.at)}</b> ${stLabel(o, h.status)}</span>`).join('')}</p>
    </div>
    <p class="plinks"><a href="${orderUrl(o)}" target="_blank">${t('p.customer_page')}</a><button data-print>🖨 ${t('p.print')}</button></p>`;
  renderActions(o);
}
function renderActions(o) {
  let html = '';
  if (o.status === 'placed') {
    html = (o.time === 'asap'
      ? `<p class="pactions__label">${t(`p.eta.${o.fulfilment}`)}</p>
        <div class="peta">${ETAS[o.fulfilment].map(m => `<button data-eta="${m}" class="${m === ui.eta ? 'is-active' : ''}">${t('eta', { n: m })}</button>`).join('')}</div>`
      : `<p class="pactions__label">📅 ${t('p.scheduled', { time: o.time })}</p>`)
      + `<div class="pactions__row"><button class="btn btn--no" data-act="rejected">${t('p.reject')}</button>
        <button class="btn btn--go" data-act="accepted">✓ ${t('p.accept', { time: clock(dueFor(o)) })}</button></div>`;
  } else if (NEXT[o.status]) {
    const next = NEXT[o.status](o);
    html = `<div class="pactions__row">${o.status === 'accepted' ? `<button class="btn btn--no" data-act="rejected">${t('p.cancel')}</button>` : ''}
      <button class="btn btn--go" data-act="${next}">✓ ${t(next === 'done' ? `p.to.done_${o.fulfilment}` : `p.to.${next}`)}</button></div>`;
  }
  $('#pActions').innerHTML = html;
  $('#pActions').hidden = !html;
}

/* ---------- reject ---------- */
function openReject(o) {
  $('#rejectTitle').textContent = t('p.reject.title', { no: o.no });
  $('#rejectReasons').innerHTML = REASONS.filter(r => r !== 'zone' || o.fulfilment === 'delivery')
    .map((r, i) => `<label class="radio"><input type="radio" name="reason" value="${r}"${i ? '' : ' checked'}><span>${t(`reason.${r}`)}</span></label>`).join('');
  $('#rejectRefund').textContent = t('p.reject.refund', { total: zl(o.total) });
  $('#rejectRefund').hidden = o.pay !== 'online';
  $('#rejectModal').hidden = false;
}

/* ---------- sound: repeats while an order waits, like the bell on a real ordering tablet ---------- */
let audio = null;
const renderUnlock = () => { $('#pUnlock').hidden = !ui.sound || audio?.state === 'running'; };
function unlockAudio() {                         // browsers allow sound only after the first touch / click
  if (!ui.sound || audio?.state === 'running') return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.onstatechange = renderUnlock;
    audio.resume();
  } catch {}
}
function chime() {
  if (!ui.sound || audio?.state !== 'running') return;
  const t0 = audio.currentTime;
  [0, .16, .32, .7, .86, 1.02].forEach((at, i) => {
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.value = i < 3 ? 880 : 1320;
    gain.gain.setValueAtTime(.2, t0 + at);
    gain.gain.exponentialRampToValueAtTime(.001, t0 + at + .14);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + .15);
  });
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg) {
  const el = $('#pToast');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}

/* ---------- demo: another customer orders (mock only) ---------- */
const DEMO_PEOPLE = [['Anna', 'pl'], ['Tomasz', 'pl'], ['Kasia', 'pl'], ['Piotr', 'pl'], ['Linh', 'vi'], ['Jonas', 'de'], ['Emma', 'en']];
const DEMO_STREETS = ['Ruska 12/4', 'Kuźnicza 20/7', 'Oławska 9', 'Szewska 41/2', 'Świdnicka 3/10', 'Wita Stwosza 16'];
const DEMO_NOTES = ['Bez kolendry, proszę', 'Domofon nie działa – proszę zadzwonić', 'Extra ostre!', 'Pałeczki ×2'];
const pick = a => a[Math.floor(Math.random() * a.length)];
function simulateOrder() {
  const [name, lang] = pick(DEMO_PEOPLE), lines = [];
  for (let n = 1 + Math.floor(Math.random() * 3); n > 0; n--) {
    const p = pick(PRODUCTS.filter(x => !x.alcohol));
    const variant = p.variants ? pick(VARIANT_GROUPS[p.variants].options).id : null;
    const same = lines.find(l => l.pid === p.id && l.variant === variant);
    if (same) same.qty += 1; else lines.push({ pid: p.id, variant, qty: Math.random() < .25 ? 2 : 1 });
  }
  const items = lines.reduce((s, l) => s + byId(l.pid).price * l.qty, 0);
  const delivery = items >= R.delivery.minOrder && Math.random() < .6, fee = delivery ? R.delivery.fee : 0;
  const later = new Date(Date.now() + 75 * 60000);
  later.setMinutes(Math.ceil(later.getMinutes() / 15) * 15);
  setStatus({
    id: newOrderId(), no: newOrderNo(), createdAt: Date.now(), attempt: 0,
    fulfilment: delivery ? 'delivery' : 'pickup', time: Math.random() < .2 ? clock(later) : 'asap',
    name, phone: `500 100 ${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`, email: `${name.toLowerCase()}@example.com`,
    address: delivery ? `${pick(DEMO_STREETS)}, ${R.address.city}` : null,
    notes: Math.random() < .3 ? pick(DEMO_NOTES) : '',
    pay: Math.random() < .6 ? 'online' : 'on_delivery',
    lines, fee, total: items + fee, lang, abandonedOnline: false,
  }, 'placed');
  sync();
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const row = e.target.closest('.porder');
  if (row) { select(row.dataset.id); return; }
  const tab = e.target.closest('[data-tab]');
  if (tab) { ui.tab = tab.dataset.tab; render(); return; }
  const eta = e.target.closest('[data-eta]');
  if (eta) { ui.eta = +eta.dataset.eta; render(); return; }
  const act = e.target.closest('[data-act]');
  if (act && selected()) { act.dataset.act === 'rejected' ? openReject(selected()) : advance(selected(), act.dataset.act); return; }
  if (e.target.closest('[data-back]')) { ui.sel = null; render(); return; }
  if (e.target.closest('[data-print]')) { print(); return; }
  if (e.target.closest('[data-close]') || e.target.id === 'rejectModal') { $('#rejectModal').hidden = true; return; }
  if (e.target.closest('#pSound')) {
    ui.sound = !ui.sound;
    store.set('v2_panel_sound', ui.sound);
    unlockAudio();
    audio?.resume().then(chime, () => {});        // let them hear what it sounds like
    render();
    return;
  }
  if (e.target.closest('#demoOrder')) simulateOrder();
});
$('#rejectForm').addEventListener('submit', e => {
  e.preventDefault();
  $('#rejectModal').hidden = true;
  if (selected()) advance(selected(), 'rejected', { reason: e.target.elements.reason.value });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#rejectModal').hidden = true; });
// on click, not pointerdown: the banner disappearing mid-tap would shift the page and swallow the tap
addEventListener('click', unlockAudio);
addEventListener('keydown', unlockAudio);
$$('.lang select').forEach(s => s.addEventListener('change', e => {
  LANG = e.target.value;
  store.set('v2_panel_lang', LANG);
  applyI18n(); renderLang(); render();
}));
addEventListener('storage', e => { if (e.key === 'v2_orders') sync(); });
setInterval(sync, 2000);                         // late IPNs, "3 min ago" labels; render() skips when nothing changed
setInterval(() => { if (list.some(o => o.status === 'placed')) chime(); }, 15000);

$('#rLogo').innerHTML = `<img src="${R.logo}" alt="">`;
$('#rName').textContent = R.name;
applyI18n();
renderLang();
sync();
