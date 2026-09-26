// Przelewy24 paywall (mock) – p24.html?id=<order id>. Whatever the customer picks, P24 sends them back to
// ReturnUrl (the order page); a payment is reported to our backend only by the IPN, simulated here with `ipn`.
const o = orders.get(new URLSearchParams(location.search).get('id'));

if (o?.status !== 'awaiting_payment') location.replace(o ? orderUrl(o) : 'index.html');
else {
  applyI18n();
  $('#payAmount').textContent = zl(o.total);
  $('#payRestaurant').textContent = t('pay.for', { name: R.name, no: o.no });
  $('#paySession').textContent = `sessionId: ${o.sessionId}`;
  $$('[data-pay]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.pay !== 'none') o.ipn = b.dataset.pay;
    if (b.dataset.pay === 'late') o.ipnAt = Date.now() + 8000;
    orders.save(o);
    location.href = orderUrl(o);
  }));
}
