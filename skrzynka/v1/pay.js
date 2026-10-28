// Payment module (mock): BLIK with an in-app approval, card with live preview and 3-D Secure,
// and a pay-by-link transfer. Nothing leaves the browser; outcomes follow TEST_CARDS in data.js.

const MERCHANT = COMPANY.name;
const BRAND_NAME = { visa: 'VISA', mastercard: 'Mastercard', amex: 'AMEX' };

function cardBrand(num) {
  if (/^4/.test(num)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(num)) return 'mastercard';
  if (/^3[47]/.test(num)) return 'amex';
  return '';
}

function luhn(num) {
  let total = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = +num[i];
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    total += d;
    alt = !alt;
  }
  return num.length >= 13 && total % 10 === 0;
}

function groupCard(num, brand) {
  if (brand === 'amex') return [num.slice(0, 4), num.slice(4, 10), num.slice(10, 15)].filter(Boolean).join(' ');
  return num.replace(/(.{4})/g, '$1 ').trim();
}

// opts: { amount, deposit, title, payer, onMethod(method) }
function createPayment(root, opts) {
  let method = store.get('skrzynka-pay-method', 'blik');
  let bank = null;

  const tab = (id, label, icon) =>
    `<button type="button" class="pay__tab" role="tab" data-m="${id}" aria-selected="${method === id}">${icon}<span>${label}</span></button>`;

  root.innerHTML = `
  <div class="pay">
    <div class="pay__tabs" role="tablist" aria-label="Metoda płatności">
      ${tab('blik', 'BLIK', '<span class="blik-mark">blik</span>')}
      ${tab('card', 'Karta', ic('card'))}
      ${tab('transfer', 'Przelew online', ic('bank'))}
    </div>

    <div class="pay__panel" data-panel="blik">
      <label class="field blik">
        <span>Kod BLIK</span>
        <input class="input blik__input" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000 000" aria-describedby="blikHint">
      </label>
      <p class="hint" id="blikHint">Otwórz aplikację banku i przepisz 6-cyfrowy kod. Potem zatwierdzisz płatność w telefonie.</p>
    </div>

    <div class="pay__panel" data-panel="card" hidden>
      <div class="cc">
        <div class="cc__card" aria-hidden="true">
          <div class="cc__face cc__front">
            <div class="cc__top"><span class="cc__chip"></span><span class="cc__brand"></span></div>
            <div class="cc__num">•••• •••• •••• ••••</div>
            <div class="cc__row">
              <div><small>Posiadacz</small><span class="cc__name">IMIĘ NAZWISKO</span></div>
              <div><small>Ważna do</small><span class="cc__exp">MM/RR</span></div>
            </div>
          </div>
          <div class="cc__face cc__back">
            <div class="cc__stripe"></div>
            <div class="cc__sig"><span class="cc__cvc">•••</span></div>
            <small>Kod CVC — 3 cyfry na odwrocie</small>
          </div>
        </div>
        <div class="cc__fields">
          <label class="field field--wide"><span>Numer karty</span>
            <input class="input" data-cc="num" inputmode="numeric" autocomplete="cc-number" placeholder="1234 5678 9012 3456" maxlength="19"></label>
          <label class="field field--wide"><span>Imię i nazwisko na karcie</span>
            <input class="input" data-cc="name" autocomplete="cc-name" placeholder="Jan Kowalski"></label>
          <label class="field"><span>Ważna do</span>
            <input class="input" data-cc="exp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/RR" maxlength="5"></label>
          <label class="field"><span>CVC</span>
            <input class="input" data-cc="cvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4"></label>
        </div>
      </div>
    </div>

    <div class="pay__panel" data-panel="transfer" hidden>
      <div class="banks" role="radiogroup" aria-label="Twój bank">
        ${BANKS.map(b => `<button type="button" class="bank" role="radio" aria-checked="false" data-bank="${b.id}" style="--bank:${b.color}">
          <span class="bank__mono">${b.mono}</span><span>${b.name}</span></button>`).join('')}
      </div>
      <p class="hint">Banki są fikcyjne. Po wybraniu przeniesiemy Cię na stronę banku z gotowymi danymi przelewu.</p>
    </div>

    <p class="pay__error" role="alert" hidden></p>
    <p class="pay__secure">${ic('lock')} Połączenie szyfrowane · Skrzynka Pay (symulacja)</p>
  </div>`;

  const err = $('.pay__error', root);
  const showError = msg => { err.textContent = msg; err.hidden = false; err.classList.remove('shake'); void err.offsetWidth; err.classList.add('shake'); };
  const hideError = () => { err.hidden = true; };

  function setMethod(m) {
    method = m;
    store.set('skrzynka-pay-method', m);
    $$('.pay__tab', root).forEach(t => t.setAttribute('aria-selected', t.dataset.m === m));
    $$('.pay__panel', root).forEach(p => { p.hidden = p.dataset.panel !== m; });
    hideError();
    if (opts.onMethod) opts.onMethod(m);
  }
  $$('.pay__tab', root).forEach(t => t.addEventListener('click', () => setMethod(t.dataset.m)));
  setMethod(method);

  // BLIK: "123 456"
  const blik = $('.blik__input', root);
  blik.addEventListener('input', () => {
    const d = digits(blik.value).slice(0, 6);
    blik.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d;
    blik.classList.remove('is-bad');
  });

  // Card: live preview
  const cc = Object.fromEntries($$('[data-cc]', root).map(i => [i.dataset.cc, i]));
  const card = $('.cc__card', root);
  const paint = () => {
    const num = digits(cc.num.value), brand = cardBrand(num);
    card.dataset.brand = brand;
    $('.cc__brand', card).textContent = BRAND_NAME[brand] || '';
    const masked = num + '•'.repeat(Math.max(0, (brand === 'amex' ? 15 : 16) - num.length));
    $('.cc__num', card).textContent = groupCard(masked, brand);
    $('.cc__name', card).textContent = cc.name.value.trim().toUpperCase() || 'IMIĘ NAZWISKO';
    $('.cc__exp', card).textContent = cc.exp.value || 'MM/RR';
    $('.cc__cvc', card).textContent = cc.cvc.value.replace(/./g, '•') || '•••';
  };
  cc.num.addEventListener('input', () => {
    const num = digits(cc.num.value).slice(0, 16);
    cc.num.value = groupCard(num, cardBrand(num));
    cc.num.classList.remove('is-bad');
    paint();
  });
  cc.exp.addEventListener('input', e => {
    let d = digits(cc.exp.value).slice(0, 4);
    if (d.length === 1 && +d > 1) d = '0' + d;
    cc.exp.value = d.length > 2 || (d.length === 2 && e.inputType !== 'deleteContentBackward') ? d.slice(0, 2) + '/' + d.slice(2) : d;
    cc.exp.classList.remove('is-bad');
    paint();
  });
  cc.cvc.addEventListener('input', () => { cc.cvc.value = digits(cc.cvc.value).slice(0, 4); cc.cvc.classList.remove('is-bad'); paint(); });
  cc.name.addEventListener('input', () => { cc.name.classList.remove('is-bad'); paint(); });
  cc.cvc.addEventListener('focus', () => card.classList.add('is-flipped'));
  cc.cvc.addEventListener('blur', () => card.classList.remove('is-flipped'));
  if (opts.payer) { cc.name.value = opts.payer; paint(); }

  // Transfer: bank tiles
  $$('.bank', root).forEach(b => b.addEventListener('click', () => {
    bank = BANKS.find(x => x.id === b.dataset.bank);
    $$('.bank', root).forEach(x => x.setAttribute('aria-checked', x === b));
    hideError();
  }));

  const fail = (msg, field) => {
    if (field) { field.classList.add('is-bad'); field.focus(); }
    throw new Error(msg);
  };

  async function payBlik(status) {
    const code = digits(blik.value);
    if (code.length !== 6) fail('Kod BLIK ma 6 cyfr.', blik);
    status('Łączymy z bankiem…');
    await wait(1000);
    if (code === '000000') fail('Kod BLIK wygasł albo został już użyty. Wygeneruj nowy w aplikacji banku.', blik);
    status('Czekamy na potwierdzenie w aplikacji…');
    const ok = await blikPhone(opts.amount + opts.deposit, opts.deposit);
    if (!ok) throw new Error('Płatność odrzucona w aplikacji banku. Nic nie pobraliśmy.');
    status('Bank potwierdza…');
    await wait(700);
    blik.value = '';
    return { method: 'blik', label: 'BLIK' };
  }

  async function payCard(status) {
    const num = digits(cc.num.value), brand = cardBrand(num);
    if (!luhn(num)) fail('Sprawdź numer karty — nie zgadza się suma kontrolna.', cc.num);
    if (cc.name.value.trim().length < 3) fail('Wpisz imię i nazwisko tak, jak na karcie.', cc.name);
    const [, mm, yy] = cc.exp.value.match(/^(\d{2})\/(\d{2})$/) || [];
    const end = mm && new Date(2000 + +yy, +mm, 1);
    if (!mm || +mm < 1 || +mm > 12) fail('Data ważności ma format MM/RR.', cc.exp);
    if (end <= new Date()) fail('Ta karta straciła ważność.', cc.exp);
    if (digits(cc.cvc.value).length !== (brand === 'amex' ? 4 : 3)) fail(`CVC ma ${brand === 'amex' ? 4 : 3} cyfry.`, cc.cvc);

    const label = `${BRAND_NAME[brand] || 'Karta'} •••• ${num.slice(-4)}`;
    status('Autoryzacja w banku…');
    await wait(1200);
    if (num === '4000000000000002') throw new Error('Bank odrzucił transakcję: niewystarczające środki. Spróbuj innej karty albo BLIK-a.');
    if (num === '4000000000003220') {
      status('Weryfikacja 3-D Secure…');
      const ok = await threeDS(opts.amount, label);
      if (!ok) throw new Error('Weryfikacja 3-D Secure nie powiodła się. Nic nie pobraliśmy.');
    }
    status('Blokujemy kaucję na karcie…');
    await wait(800);
    return { method: 'card', label };
  }

  async function payTransfer(status) {
    if (!bank) {
      $('.bank', root).focus();
      throw new Error('Wybierz swój bank.');
    }
    status(`Przekierowujemy do: ${bank.name}…`);
    await wait(900);
    const ok = await bankSite(bank, { ...opts, amount: opts.amount + opts.deposit });
    if (!ok) throw new Error('Przelew anulowany w banku. Możesz spróbować jeszcze raz albo wybrać inną metodę.');
    status('Bank potwierdza przelew…');
    await wait(900);
    return { method: 'transfer', label: `Przelew · ${bank.name}`, bank: bank.id };
  }

  return {
    get method() { return method; },
    async pay() {
      hideError();
      const b = busy('Przygotowujemy płatność…');
      try {
        return await ({ blik: payBlik, card: payCard, transfer: payTransfer })[method](b.set);
      } catch (e) {
        showError(e.message);
        return null;
      } finally {
        b.close();
      }
    },
  };
}

// Extra payment for an extension, with the method used at checkout. Resolves true when paid.
async function quickPay(amount, payment, title) {
  if (payment.method === 'transfer') {
    const bank = BANKS.find(b => b.id === payment.bank) || BANKS[0];
    return bankSite(bank, { amount, title });
  }
  if (payment.method === 'blik') return blikPhone(amount, 0, 'Płatność BLIK bez kodu');
  const b = busy(`Obciążamy kartę ${payment.label}…`);
  await wait(1300);
  b.close();
  return true;
}

// ---------- BLIK: the bank app on a phone ----------
function blikPhone(amount, deposit = 0, title = 'Potwierdź płatność BLIK') {
  return new Promise(resolve => {
    const m = modal({
      cls: 'modal--phone', label: 'Potwierdzenie BLIK', dismissable: false,
      html: `
      <div class="phone">
        <div class="phone__bar"><span>${fmtTime(Date.now())}</span><span class="phone__island"></span><span>5G ▮▮▮</span></div>
        <div class="phone__app">
          <p class="phone__bank"><span class="bank__mono" style="--bank:#b45309">BK</span> Bank Kowadło</p>
          <p class="phone__title">${title}</p>
          <p class="phone__amount">${zl(amount)}</p>
          ${deposit ? `<p class="phone__split">w tym kaucja ${zl(deposit)} — wróci na konto po zwrocie narzędzi</p>` : ''}
          <p class="phone__merchant">${MERCHANT}<br><small>${COMPANY.site} · Wrocław</small></p>
          <div class="phone__timer"><span></span></div>
          <p class="phone__left">Zostało <b>2:00</b></p>
          <div class="phone__btns">
            <button type="button" class="phone__no" data-r="0">Odrzuć</button>
            <button type="button" class="phone__yes" data-r="1">Zatwierdź</button>
          </div>
        </div>
      </div>
      <p class="modal__caption">Symulacja aplikacji bankowej — zdecyduj za klienta.</p>`,
    });
    let left = 120;
    const leftEl = $('.phone__left b', m.el);
    const timer = setInterval(() => {
      left--;
      leftEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (left <= 0) done(false);
    }, 1000);
    function done(ok) {
      clearInterval(timer);
      m.close();
      resolve(ok);
    }
    $$('[data-r]', m.el).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.r === '1') {
        $('.phone__app', m.el).innerHTML = `<div class="phone__ok">${ic('check')}<p>Zatwierdzono</p></div>`;
        clearInterval(timer);
        setTimeout(() => done(true), 700);
      } else done(false);
    }));
  });
}

// ---------- card: 3-D Secure with an SMS code ----------
function threeDS(amount, label) {
  return codeDialog({
    cls: 'modal--tds', label: 'Weryfikacja 3-D Secure', from: 'BANK KOWADŁO',
    head: `<div class="tds__head"><span class="bank__mono" style="--bank:#b45309">BK</span><div><b>Bank Kowadło</b><small>Bezpieczne zakupy w internecie</small></div></div>
      <dl class="tds__dl"><dt>Sklep</dt><dd>${MERCHANT}</dd><dt>Kwota</dt><dd>${zl(amount)}</dd><dt>Karta</dt><dd>${label}</dd></dl>`,
    lead: 'Wysłaliśmy SMS z kodem na numer <b>+48 ••• ••• 821</b>. Wpisz go, żeby potwierdzić płatność.',
    sms: code => `Kod 3-D Secure: ${code}. Płatność ${zl(amount)} — ${MERCHANT} Nie podawaj go nikomu.`,
  });
}

// ---------- pay-by-link: the bank's site ----------
function bankSite(bank, opts) {
  return new Promise(resolve => {
    const m = modal({
      cls: 'modal--bank', label: bank.name, dismissable: false,
      html: `
      <div class="banksite" style="--bank:${bank.color}">
        <div class="banksite__top"><span class="bank__mono">${bank.mono}</span><b>${bank.name}</b><span class="banksite__sim">symulacja strony banku</span></div>
        <div class="banksite__body">
          <p class="banksite__hello">Dzień dobry${opts.payer ? ', ' + esc(opts.payer.split(' ')[0]) : ''}. Dane przelewu są już wypełnione.</p>
          <dl class="tds__dl">
            <dt>Odbiorca</dt><dd>${MERCHANT}</dd>
            <dt>Rachunek</dt><dd class="mono">PL61 1090 0000 0000 0000 0000 0000</dd>
            <dt>Tytuł</dt><dd>${esc(opts.title)}</dd>
            <dt>Kwota</dt><dd><b>${zl(opts.amount)}</b>${opts.deposit ? `<br><small>w tym kaucja ${zl(opts.deposit)}, zwrot przelewem po oddaniu narzędzi</small>` : ''}</dd>
            <dt>Z rachunku</dt><dd>Konto osobiste ••• 4821 · saldo 6 214,37 zł</dd>
          </dl>
          <div class="code__row">
            <button type="button" class="btn btn--ghost" data-r="0">Anuluj i wróć</button>
            <button type="button" class="btn banksite__go" data-r="1">Zatwierdź przelew</button>
          </div>
        </div>
      </div>`,
    });
    $$('[data-r]', m.el).forEach(b => b.addEventListener('click', () => { m.close(); resolve(b.dataset.r === '1'); }));
  });
}
