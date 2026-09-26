// Order page – order.html?id=<order id>. Przelewy24 sends the customer back here (ReturnUrl) and the
// confirmation SMS / e-mail links here, so it has to work on its own: after a reload, in a new tab, days later.
let o = orders.get(new URLSearchParams(location.search).get('id'));
let view = null, timer = null;

function renderHeader() {
  $('#rLogo').innerHTML = `<img src="${R.logo}" alt="">`;
  $('#rName').textContent = R.name;
  $('#rAddress').textContent = `${R.address.street}, ${R.address.city}`;
  $('#fName').textContent = `${R.name} · ${R.address.street}, ${R.address.city}`;
  document.title = o ? `${t('order.no', { no: o.no })} – ${R.name}` : R.name;
}

const VIEWS = ['oCheck', 'oUnpaid', 'oDone', 'oMissing'];
function show(v) {
  view = v;
  VIEWS.forEach(id => { $('#' + id).hidden = id !== v; });
  render();
  scrollTo(0, 0);
}
function render() {                              // also on language change
  if (view === 'oCheck') $('#checkNo').textContent = t('order.no', { no: o.no });
  if (view === 'oUnpaid') renderUnpaid();
  if (view === 'oDone') renderDone();
}

/* ---------- payment (back from Przelewy24) ----------
   Returning to ReturnUrl says nothing about the result: the order becomes paid only after our backend has
   validated (ValidateNotification) and verified (ConfirmPaymentAsync) the IPN, so the page polls the order. */
function checkPayment() {
  show('oCheck');
  clearTimeout(timer);
  timer = setTimeout(() => {
    o = orders.get(o.id);                        // the payment may have finished in another tab
    if (isPlaced(o) || ipnArrived(o)) { placeOrder(o); show('oDone'); }
    else show('oUnpaid');
  }, ipnArrived(o) ? 1500 : 4000);
}
function renderUnpaid() {
  const delivery = o.fulfilment === 'delivery';
  $('#unpaidNo').textContent = `${t('order.no', { no: o.no })} · ${zl(o.total)}`;
  $('#unpaidRetry').textContent = t('unpaid.retry', { total: zl(o.total) });
  $('#unpaidOffline').textContent = t(delivery ? 'unpaid.offline_delivery' : 'unpaid.offline_pickup');
  $('#unpaidEdit').href = `index.html?edit=${o.id}`;
}
function payOffline() {
  o = orders.get(o.id);
  if (!isPlaced(o)) {                            // otherwise the late IPN came in meanwhile – it is paid
    o.pay = 'on_delivery';
    o.abandonedOnline = true;                    // a late P24 payment for this order must be refunded (RefundAsync)
  }
  placeOrder(o);
  show('oDone');
}

/* ---------- placed ----------
   From here the restaurant's panel (panel.js) moves the order on; the page follows it (storage event below). */
const TRACK = { delivery: ['placed', 'accepted', 'out', 'done'], pickup: ['placed', 'accepted', 'ready', 'done'] };
const trackLabel = s => t(s === 'done' ? `track.done_${o.fulfilment}` : `track.${s}`);
function renderDone() {
  const delivery = o.fulfilment === 'delivery', rejected = o.status === 'rejected';
  const when = o.time !== 'asap' ? t('done.today_at', { time: o.time })
    : t('done.approx', { eta: o.dueAt ? clock(o.dueAt) : eta(delivery ? R.delivery.eta : R.pickup.eta) });
  const steps = TRACK[o.fulfilment], at = steps.indexOf(o.status);
  const total = t(rejected ? 'cart.total' : o.pay === 'online' ? 'done.paid' : delivery ? 'done.due_delivery' : 'done.due_pickup');
  $('#oDone').innerHTML = `
    <div class="done__icon${rejected ? ' done__icon--no' : ''}">${rejected ? '✕' : '✓'}</div>
    <h2>${t(rejected ? 'done.sorry' : 'done.thanks', { name: esc(o.name) })}</h2>
    <p class="muted">${t(`done.${o.status}`)}</p>
    <div class="done__no">${o.no}</div>
    ${rejected ? `<p class="note done__reason">${t('done.reason', { reason: t(`reason.${o.reason}`) })}${o.pay === 'online' ? `<br>${t('done.refunded', { total: zl(o.total) })}` : ''}</p>`
      : `<ol class="track">${steps.map((s, i) => `<li class="${i < at ? 'is-done' : i === at ? 'is-done is-now' : ''}">${trackLabel(s)}</li>`).join('')}</ol>`}
    ${['placed', 'accepted', 'out'].includes(o.status) ? `<p class="done__eta">${delivery ? `🚚 ${t('f.delivery')}` : `🥡 ${t('f.pickup_long')}`}: <strong>${when}</strong></p>` : ''}
    <div class="summary">
      ${o.lines.map(l => { const p = byId(l.pid); return `<div class="row"><span>${l.qty}× ${nameOf(p)}${l.variant ? ` <span class="muted">(${variantName(l)})</span>` : ''}</span><span>${zl(p.price * l.qty)}</span></div>`; }).join('')}
      ${o.fee ? `<div class="row"><span>${t('cart.delivery')}</span><span>${zl(o.fee)}</span></div>` : ''}
      <div class="row row--total"><span>${total}</span><span>${zl(o.total)}</span></div>
    </div>
    ${o.abandonedOnline && !rejected ? `<p class="note" style="text-align:left">${t('done.refund')}</p>` : ''}
    ${o.notes ? `<p class="done__notes"><strong>${t('co.notes')}:</strong> ${esc(o.notes)}</p>` : ''}
    <p class="muted" style="font-size:.9rem">${delivery ? t('done.address', { address: esc(o.address) }) : t('done.pickup_at', { address: `${R.address.street}, ${R.address.city}` })}<br>
      ${t('done.sent', { email: esc(o.email), phone: esc(o.phone) })}</p>
    <a class="btn btn--primary" href="index.html">${t('done.back')}</a>`;
}

/* ---------- events ---------- */
$('#unpaidRetry').addEventListener('click', () => goToPayment(o));
$('#unpaidRecheck').addEventListener('click', checkPayment);
$('#unpaidOffline').addEventListener('click', payOffline);
$$('.lang select').forEach(s => s.addEventListener('change', e => { switchLang(e.target.value); renderHeader(); render(); }));
// the restaurant accepts / rejects / hands over the order in its panel – another tab in the mock (push or polling in production)
addEventListener('storage', e => {
  if (e.key !== 'v2_orders' || !o) return;
  const next = orders.get(o.id);
  if (JSON.stringify(next) === JSON.stringify(o)) return;
  o = next;
  if (view === 'oDone') render();
  else if (view === 'oUnpaid' && isPlaced(o)) { placeOrder(o); show('oDone'); }   // the late IPN came in
});

applyI18n();
renderLang();
renderHeader();
if (!o) show('oMissing');
else if (o.status === 'awaiting_payment') checkPayment();
else show('oDone');
