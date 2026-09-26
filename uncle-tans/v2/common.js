// Shared by the menu (app.js), the order page (order.js), the Przelewy24 mock (p24.js) and the restaurant panel (panel.js).
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const R = RESTAURANT;
const zl = n => `${n} zł`;
const eta = e => t('eta', { n: e });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = id => PRODUCTS.find(p => p.id === id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const variantName = l => (l.variant ? nameOf(VARIANT_GROUPS[byId(l.pid).variants].options.find(o => o.id === l.variant)) : '');

/* ---------- language ---------- */
function renderLang() {
  const cur = LANGS.find(l => l.code === LANG);
  const opts = LANGS.map(l => `<option value="${l.code}"${l.code === LANG ? ' selected' : ''}>${l.flag} ${l.name}</option>`).join('');
  $$('.lang').forEach(el => {                     // header pill + compact copy in the sticky bar
    $('select', el).innerHTML = opts;
    $('.lang__flag', el).innerHTML = FLAG_SVG[LANG];
    $('.lang__code', el).textContent = cur.label;
    const name = $('.lang__name', el);
    if (name) name.textContent = cur.name;
  });
}
function switchLang(code) { LANG = code; store.set('v2_lang', code); applyI18n(); renderLang(); }

/* ---------- orders (mock backend: localStorage) ----------
   Every order has its own page, order.html?id=<id> – the Przelewy24 ReturnUrl and the link in the confirmation
   SMS / e-mail. The id is random: the page shows the customer's name, phone and address, and order numbers
   (UT-1234) are easy to guess, so the number is only for people. */
const orders = {
  get: id => (id && store.get('v2_orders', {})[id]) || null,
  all: () => Object.values(store.get('v2_orders', {})),
  save(o) { const all = store.get('v2_orders', {}); all[o.id] = o; store.set('v2_orders', all); },
};
const newOrderId = () => [...crypto.getRandomValues(new Uint32Array(3))].map(n => n.toString(36)).join('');
const newOrderNo = () => `${R.orderPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
const orderUrl = o => `order.html?id=${o.id}`;
const clock = ms => new Date(ms).toTimeString().slice(0, 5);

/* Status: awaiting_payment → placed (the restaurant has it) → accepted (with dueAt) → ready (pickup) / out (delivery)
   → done, or rejected (with reason). From `placed` on it is the restaurant's panel (panel.js) that moves it;
   every step goes into `history`, so the panel and the order page can show when it happened. */
function setStatus(o, status, extra = {}) {
  Object.assign(o, extra, { status });
  o.history = [...(o.history ?? []), { status, at: Date.now() }];
  orders.save(o);
}
const isPlaced = o => !!o.status && o.status !== 'awaiting_payment';   // an order fresh from the form has no status yet
const placedAt = o => o.history?.find(h => h.status === 'placed')?.at ?? o.createdAt;
// the (simulated) Przelewy24 IPN has reached the backend: validated (ValidateNotification) and verified (ConfirmPaymentAsync)
const ipnArrived = o => o.ipn === 'now' || (o.ipn === 'late' && Date.now() >= o.ipnAt);

/* The order number is created once; each online payment attempt gets its own P24 sessionId
   (`${no}-${attempt}`), because P24 rejects a sessionId that was already registered. */
function goToPayment(o) {                        // backend: CreatePaymentAsync → redirect to RedirectUrl (p24.html)
  o.status = 'awaiting_payment';
  o.attempt += 1;
  o.sessionId = `${o.no}-${o.attempt}`;
  o.ipn = null;                                  // 'now' | 'late' – when the (simulated) IPN arrives
  orders.save(o);
  location.href = `p24.html?id=${o.id}`;
}
function placeOrder(o) {                         // the restaurant gets the order; the cart is done
  if (!isPlaced(o)) setStatus(o, 'placed');      // a late IPN may have placed it already (panel.js)
  store.set('v2_cart', []);
}

// back / forward can restore a page from the bfcache with stale state (open checkout, emptied cart) – reload it
addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
