// Payment module (mock): BLIK with an in-app confirmation, and a card with live preview and 3-D Secure.
// Nothing leaves the browser — outcomes follow TEST_CARDS in data.js.

const MERCHANT = 'Kluczyk · ' + OWNER.name;
const BRAND_NAME = { visa: 'VISA', mastercard: 'Mastercard', amex: 'AMEX' };

const digits = s => String(s).replace(/\D/g, '');

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

// opts: { amount, payer, status(text) }
function createPayment(root, opts) {
  let method = store.get('kluczyk-v3-pay-method', 'blik');

  const tab = (id, label, icon) =>
    `<button type="button" class="pay__tab" role="tab" data-m="${id}" aria-selected="${method === id}">${icon}<span>${label}</span></button>`;

  root.innerHTML = `
  <div class="pay">
    <div class="pay__tabs" role="tablist" aria-label="Metoda płatności">
      ${tab('blik', 'BLIK', '<span class="blik-mark">blik</span>')}
      ${tab('card', 'Karta', ic('card'))}
    </div>

    <div class="pay__panel" data-panel="blik">
      <div class="blik">
        <label class="field">
          <span>Kod BLIK</span>
          <input class="input blik__input" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000 000" aria-describedby="blikHint">
        </label>
        <p class="hint" id="blikHint">Otwórz aplikację banku i przepisz 6-cyfrowy kod. Potem zatwierdzisz płatność w telefonie.</p>
      </div>
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

    <p class="pay__error" role="alert" hidden></p>
    <p class="pay__secure">${ic('lock')} Połączenie szyfrowane (symulacja) · kaucję zablokuję na karcie dopiero przy odbiorze</p>
  </div>`;

  const err = $('.pay__error', root);
  const showError = msg => { err.textContent = msg; err.hidden = false; err.classList.remove('shake'); void err.offsetWidth; err.classList.add('shake'); };
  const hideError = () => { err.hidden = true; };

  function setMethod(m) {
    method = m;
    store.set('kluczyk-v3-pay-method', m);
    $$('.pay__tab', root).forEach(t => t.setAttribute('aria-selected', t.dataset.m === m));
    $$('.pay__panel', root).forEach(p => { p.hidden = p.dataset.panel !== m; });
    hideError();
  }
  $$('.pay__tab', root).forEach(t => t.addEventListener('click', () => setMethod(t.dataset.m)));
  setMethod(method);

  // BLIK: "123 456"
  const blik = $('.blik__input', root);
  blik.addEventListener('input', () => {
    const d = digits(blik.value).slice(0, 6);
    blik.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d;
  });

  // Card: live preview
  const cc = Object.fromEntries($$('[data-cc]', root).map(i => [i.dataset.cc, i]));
  const card = $('.cc__card', root);
  const paint = () => {
    const num = digits(cc.num.value), brand = cardBrand(num);
    card.dataset.brand = brand;
    $('.cc__brand', card).textContent = BRAND_NAME[brand] || '';
    const masked = (num + '•'.repeat(Math.max(0, (brand === 'amex' ? 15 : 16) - num.length)));
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
  cc.name.addEventListener('input', () => { cc.name.dataset.typed = '1'; cc.name.classList.remove('is-bad'); paint(); });
  cc.cvc.addEventListener('focus', () => card.classList.add('is-flipped'));
  cc.cvc.addEventListener('blur', () => card.classList.remove('is-flipped'));
  if (opts.payer && !cc.name.value) { cc.name.value = opts.payer; paint(); }

  const fail = (msg, field) => {
    if (field) { field.classList.add('is-bad'); field.focus(); }
    throw new Error(msg);
  };

  async function payBlik() {
    const code = digits(blik.value);
    if (code.length !== 6) fail('Kod BLIK ma 6 cyfr.', blik);
    opts.status('Łączymy z bankiem…');
    await wait(1100);
    if (code === '000000') fail('Kod BLIK wygasł albo został już użyty. Wygeneruj nowy w aplikacji banku.', blik);
    opts.status('Czekamy na potwierdzenie w aplikacji…');
    const ok = await blikPhone(opts.amount);
    if (!ok) throw new Error('Płatność odrzucona w aplikacji banku. Nic nie zostało pobrane.');
    opts.status('Bank potwierdza…');
    await wait(700);
    blik.value = '';
    return { method: 'blik', label: 'BLIK' };
  }

  async function payCard() {
    const num = digits(cc.num.value), brand = cardBrand(num);
    if (!luhn(num)) fail('Sprawdź numer karty — nie zgadza się suma kontrolna.', cc.num);
    if (cc.name.value.trim().length < 3) fail('Wpisz imię i nazwisko tak, jak na karcie.', cc.name);
    const [, mm, yy] = cc.exp.value.match(/^(\d{2})\/(\d{2})$/) || [];
    const end = mm && new Date(2000 + +yy, +mm, 1);
    if (!mm || +mm < 1 || +mm > 12) fail('Data ważności ma format MM/RR.', cc.exp);
    if (end <= new Date()) fail('Ta karta straciła ważność.', cc.exp);
    if (digits(cc.cvc.value).length !== (brand === 'amex' ? 4 : 3)) fail(`CVC ma ${brand === 'amex' ? 4 : 3} cyfry.`, cc.cvc);

    const label = `${BRAND_NAME[brand] || 'Karta'} •••• ${num.slice(-4)}`;
    opts.status('Autoryzacja w banku…');
    await wait(1300);
    if (num === '4000000000000002') throw new Error('Bank odrzucił transakcję: niewystarczające środki. Spróbuj innej karty albo BLIK-a.');
    if (num === '4000000000003220') {
      opts.status('Weryfikacja 3-D Secure…');
      const ok = await threeDS(opts.amount, label);
      if (!ok) throw new Error('Weryfikacja 3-D Secure nie powiodła się. Nic nie zostało pobrane.');
      opts.status('Bank potwierdza…');
      await wait(800);
    }
    return { method: 'card', label };
  }

  return {
    async pay() {
      hideError();
      try {
        return await (method === 'card' ? payCard : payBlik)();
      } catch (e) {
        showError(e.message);
        return null;
      }
    },
    setAmount(n) { opts.amount = n; },
    // the name on the card follows the driver's name until someone types it in by hand
    setPayer(name) { opts.payer = name; if (!cc.name.dataset.typed) { cc.name.value = name; paint(); } },
  };
}

// ---------- BLIK: the bank app on a phone ----------
function blikPhone(amount) {
  return new Promise(resolve => {
    const m = modal({
      cls: 'modal--phone', label: 'Potwierdzenie BLIK', dismissable: false,
      html: `
      <div class="phone">
        <div class="phone__bar"><span>${fmtTime(Date.now())}</span><span class="phone__island"></span><span>5G ▮▮▮</span></div>
        <div class="phone__app">
          <p class="phone__bank"><span class="bank__mono" style="--bank:#c2410c">BK</span> Bank Krasnala</p>
          <p class="phone__title">Potwierdź płatność BLIK</p>
          <p class="phone__amount">${zl(amount)}</p>
          <p class="phone__merchant">${MERCHANT}<br><small>kluczyk.example · Wrocław</small></p>
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
  return new Promise(resolve => {
    let code = '', tries = 3, hidePush = null;
    const m = modal({
      cls: 'modal--tds', label: 'Weryfikacja 3-D Secure',
      onClose: ok => { if (hidePush) hidePush(); resolve(ok === true); },
      html: `
      <form class="tds" novalidate>
        <div class="tds__head"><span class="bank__mono" style="--bank:#c2410c">BK</span><div><b>Bank Krasnala</b><small>Bezpieczne zakupy w internecie</small></div></div>
        <p>Wysłaliśmy SMS z kodem na numer <b>+48 ••• ••• 821</b>. Wpisz go, żeby potwierdzić płatność.</p>
        <dl class="tds__dl"><dt>Sklep</dt><dd>${MERCHANT}</dd><dt>Kwota</dt><dd>${zl(amount)}</dd><dt>Karta</dt><dd>${label}</dd></dl>
        <label class="field"><span>Kod z SMS</span><input class="input tds__code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"></label>
        <p class="tds__err" role="alert" hidden></p>
        <div class="tds__row">
          <button type="button" class="btn btn--ghost" data-close>Anuluj</button>
          <button type="submit" class="btn btn--dark">Potwierdź</button>
        </div>
        <button type="button" class="link tds__resend">Nie dostałem SMS-a — wyślij ponownie</button>
      </form>`,
    });
    const input = $('.tds__code', m.el), errEl = $('.tds__err', m.el);
    const send = () => {
      code = String(Math.floor(100000 + Math.random() * 900000));
      if (hidePush) hidePush();
      setTimeout(() => {
        hidePush = notify({
          title: 'BANK KRASNALA',
          body: `Kod 3-D Secure: ${code}. Płatność ${zl(amount)} w ${MERCHANT}. Nie podawaj go nikomu. (dotknij, by wkleić)`,
          onTap: () => { input.value = code; input.focus(); },
        });
      }, 1100);
    };
    send();
    $('.tds__resend', m.el).addEventListener('click', send);
    input.addEventListener('input', () => { input.value = digits(input.value).slice(0, 6); });
    $('.tds', m.el).addEventListener('submit', e => {
      e.preventDefault();
      if (input.value === code) return m.close(true);
      tries--;
      if (!tries) return m.close(false);
      errEl.textContent = `Nieprawidłowy kod. ${tries === 1 ? 'Została 1 próba' : `Zostały ${tries} próby`}.`;
      errEl.hidden = false;
      input.select();
    });
  });
}
