// Shared by the menu (app.js), the order page (order.js) and the Przelewy24 mock (p24.js).
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
  save(o) { const all = store.get('v2_orders', {}); all[o.id] = o; store.set('v2_orders', all); },
};
const newOrderId = () => [...crypto.getRandomValues(new Uint32Array(3))].map(n => n.toString(36)).join('');
const orderUrl = o => `order.html?id=${o.id}`;

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
  o.status = 'placed';
  orders.save(o);
  store.set('v2_cart', []);
}

// back / forward can restore a page from the bfcache with stale state (open checkout, emptied cart) – reload it
addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
