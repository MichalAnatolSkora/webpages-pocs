// Parcel locker simulator: a cabinet of compartments around a touch screen. Pickup opens the order's
// compartments after the code (or a fake QR scan); a return opens empty ones sized for each tool.

// Four columns of compartments; each stacks to 12 units (A = 1, B = 2, C = 4). The screen sits in the middle.
const LOCKER_LAYOUT = [
  ['A', 'A', 'B', 'C', 'B', 'A', 'A'],
  ['B', 'C', 'A', 'A', 'B', 'B'],
  ['A', 'B', 'A', 'C', 'A', 'B', 'A'],
  ['C', 'B', 'A', 'A', 'C'],
];
const UNITS = { A: 1, B: 2, C: 4 };

function lockerCells() {
  let n = 0;
  return LOCKER_LAYOUT.map(col => col.map(size => ({ no: ++n, size })));
}

// Smallest free compartment that fits each tool. Some compartments are "taken" by other people's parcels.
function assignCells(lockerId, sizes, salt = '') {
  const all = lockerCells().flat(), rnd = seeded(lockerId + salt);
  const busy = new Set(all.filter(() => rnd() < 0.3).map(c => c.no));
  const used = new Set();
  const order = sizes.map((s, i) => ({ s, i })).sort((a, b) => SIZE_RANK[b.s] - SIZE_RANK[a.s]);
  const out = [];
  order.forEach(({ s, i }) => {
    const fits = c => !used.has(c.no) && SIZE_RANK[c.size] >= SIZE_RANK[s];
    const byFit = (a, b) => SIZE_RANK[a.size] - SIZE_RANK[b.size];
    const pick = all.filter(c => fits(c) && !busy.has(c.no)).sort(byFit)[0] || all.filter(fits).sort(byFit)[0] || all.find(c => !used.has(c.no));
    used.add(pick.no);
    out[i] = pick.no;
  });
  return out;
}

function openLocker({ mode, order: o, onDone }) {
  const pickup = mode === 'pickup';
  const lk = lockerById(pickup ? o.lockerId : o.returnLockerId);
  const code = pickup ? o.pickupCode : o.returnCode;
  const targets = pickup ? o.cells : o.returnCells;
  const list = targets.slice().sort((a, b) => a - b).join(', ');
  let entered = '', moved = 0, finished = false, phase = 'home';

  const item = i => {
    const t = toolById(o.items[i].id);
    return `<button type="button" class="lk-item" data-i="${i}" aria-label="${pickup ? 'Wyjmij' : 'Włóż'}: ${t.short}">${toolArt(t.id, { shadow: false })}<span>${t.short}</span></button>`;
  };
  const cell = c => {
    const i = targets.indexOf(c.no);
    return `<div class="cell" data-no="${c.no}" style="--h:${UNITS[c.size]}">
      <div class="cell__in">${pickup && i >= 0 ? item(i) : ''}</div>
      <button type="button" class="cell__door" tabindex="-1" aria-label="Drzwiczki skrytki ${c.no}"><span>${c.no}</span></button>
    </div>`;
  };
  const col = (c, i) => `<div class="machine__col" style="grid-area:c${i}">${c.map(cell).join('')}</div>`;
  const cols = lockerCells();

  const m = modal({
    cls: 'modal--locker', label: `Paczkomat ${lk.id}`,
    html: `
    <div class="lsim">
      <div class="lsim__head">
        <span class="lsim__icon">${ic('locker')}</span>
        <div><b>Paczkomat ${lk.id}</b><span>${lk.street}, ${lk.city} · ${lk.place}</span></div>
        <button type="button" class="lsim__x" data-close aria-label="Odejdź od paczkomatu">${ic('x')}</button>
      </div>
      <div class="lsim__body">
        <div class="machine">
          <div class="machine__plate"><span>skrzynka</span> paczkomat 24/7 · ${lk.id}</div>
          <div class="machine__grid">
            ${col(cols[0], 0)}${col(cols[1], 1)}
            <div class="machine__panel" style="grid-area:panel">
              <div class="screen" aria-live="polite"></div>
              <div class="scanner"><span class="scanner__eye"></span><span>czytnik QR</span></div>
            </div>
            ${col(cols[2], 2)}${col(cols[3], 3)}
          </div>
        </div>
        <aside class="lsim__side">
          <div class="lsim__sms">
            <p class="lsim__from">${ic('phone')} SMS · SKRZYNKA</p>
            <p>${pickup ? `Twoje narzędzia czekają w paczkomacie ${lk.id}. Kod odbioru: <b class="mono">${spaced(code)}</b>.` : `Kod zwrotu zamówienia ${o.ref}: <b class="mono">${spaced(code)}</b>. Wpisz go w dowolnym paczkomacie.`}</p>
            <div class="lsim__qr">${qrSvg(code)}</div>
            <button type="button" class="btn btn--sm btn--ghost lsim__scan">${ic('qr')} Przyłóż kod QR do czytnika</button>
          </div>
          <div class="tray">
            <p class="tray__t">${pickup ? 'W Twoich rękach' : 'Do włożenia do skrytek'}</p>
            <div class="tray__items">${pickup ? '<p class="tray__empty">Na razie nic.</p>' : o.items.map((_, i) => item(i)).join('')}</div>
          </div>
        </aside>
      </div>
    </div>`,
  });

  const el = m.el, screen = $('.screen', el), tray = $('.tray__items', el);
  const cellEl = no => $(`.cell[data-no="${no}"]`, el);

  function show(next, extra = {}) {
    phase = next;
    const screens = {
      home: `
        <p class="screen__t">Dzień dobry!</p>
        <p class="screen__s">Co chcesz zrobić?</p>
        <button type="button" class="sbtn" data-a="pickup">${ic('box')} Odbierz paczkę</button>
        <button type="button" class="sbtn" data-a="send">${ic('return')} Nadaj zwrot</button>
        <p class="screen__msg" role="alert">${extra.msg || ''}</p>`,
      code: `
        <p class="screen__t">${pickup ? 'Wpisz kod odbioru' : 'Wpisz kod zwrotu'}</p>
        <div class="screen__code">${[0, 1, 2, 3, 4, 5].map(i => `<span>${entered[i] || ''}</span>`).join('')}</div>
        <div class="keypad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}">${n}</button>`).join('')}
          <button type="button" data-k="del" aria-label="Usuń cyfrę">⌫</button><button type="button" data-k="0">0</button><button type="button" data-k="ok" class="keypad__ok">OK</button>
        </div>
        <p class="screen__msg" role="alert">${extra.msg || 'albo przyłóż kod QR do czytnika'}</p>`,
      scan: `<span class="spinner spinner--light"></span><p class="screen__t">Czytam kod QR…</p>`,
      opening: `<span class="spinner spinner--light"></span><p class="screen__t">Otwieram ${targets.length > 1 ? 'skrytki' : 'skrytkę'}…</p>`,
      move: `
        <p class="screen__big">${list}</p>
        <p class="screen__t">${pickup ? `Wyjmij narzędzia ze ${targets.length > 1 ? 'skrytek' : 'skrytki'}` : `Włóż narzędzia do ${targets.length > 1 ? 'skrytek' : 'skrytki'}`}</p>
        <p class="screen__s">${pickup ? 'Dotknij narzędzia w otwartej skrytce.' : 'Dotknij narzędzia po prawej, żeby je włożyć.'}</p>
        <p class="screen__progress">${moved} z ${targets.length}</p>`,
      close: `
        <p class="screen__t">Zamknij drzwiczki</p>
        <p class="screen__s">Dociśnij do kliknięcia — albo dotknij otwartych drzwiczek.</p>
        <button type="button" class="sbtn sbtn--go" data-a="close">Zamknięte</button>`,
      bye: `
        <span class="screen__ok">${ic('check')}</span>
        <p class="screen__t">${pickup ? 'Dziękujemy! Udanej pracy.' : 'Zwrot nadany. Dziękujemy!'}</p>
        <p class="screen__s">${pickup ? 'Protokół wydania jest już w zamówieniu.' : 'Potwierdzenie wysłaliśmy SMS-em.'}</p>
        <button type="button" class="sbtn sbtn--go" data-a="end">Zakończ</button>`,
    };
    screen.innerHTML = screens[next];
    screen.dataset.phase = next;
  }

  function wrong(msg) {
    entered = '';
    show('code', { msg });
    $('.screen__code', screen).classList.add('shake');
  }

  async function open() {
    show('opening');
    await wait(900);
    for (const no of targets) {
      const c = cellEl(no);
      c.classList.add('is-open');
      $('.cell__door', c).tabIndex = 0;
      await wait(260);
    }
    show('move');
    const first = pickup ? $('.cell.is-open .lk-item', el) : $('.lk-item', tray);
    if (first) first.focus({ preventScroll: true });
  }

  async function accept() {
    if (entered.length < 6) return wrong('Kod ma 6 cyfr.');
    if (entered !== code) return wrong('Nieprawidłowy kod. Sprawdź SMS.');
    open();
  }

  screen.addEventListener('click', e => {
    const k = e.target.closest('[data-k]'), a = e.target.closest('[data-a]');
    if (k) {
      if (k.dataset.k === 'del') entered = entered.slice(0, -1);
      else if (k.dataset.k === 'ok') return accept();
      else if (entered.length < 6) entered += k.dataset.k;
      $$('.screen__code span', screen).forEach((s, i) => { s.textContent = entered[i] || ''; });
      if (entered.length === 6) setTimeout(accept, 250);
      return;
    }
    if (!a) return;
    if (a.dataset.a === 'pickup') {
      if (pickup) show('code');
      else show('home', { msg: 'Nie masz tu paczek do odbioru.' });
    } else if (a.dataset.a === 'send') {
      if (!pickup) show('code');
      else show('home', { msg: 'Najpierw odbierz zamówienie — kod zwrotu dostaniesz później.' });
    } else if (a.dataset.a === 'close') {
      targets.forEach(closeDoor);
    } else if (a.dataset.a === 'end') {
      m.close();
    }
  });

  const onKey = e => {
    if (phase !== 'code' || !document.contains(el)) return;
    if (/^\d$/.test(e.key) && entered.length < 6) {
      entered += e.key;
      $$('.screen__code span', screen).forEach((s, i) => { s.textContent = entered[i] || ''; });
      if (entered.length === 6) setTimeout(accept, 250);
    } else if (e.key === 'Backspace') {
      entered = entered.slice(0, -1);
      $$('.screen__code span', screen).forEach((s, i) => { s.textContent = entered[i] || ''; });
    } else if (e.key === 'Enter') accept();
  };
  document.addEventListener('keydown', onKey);
  const stop = new MutationObserver(() => { if (!document.contains(el)) { document.removeEventListener('keydown', onKey); stop.disconnect(); } });
  stop.observe($('#modalRoot'), { childList: true });

  $('.lsim__scan', el).addEventListener('click', async () => {
    if (!['home', 'code'].includes(phase)) return;
    $('.lsim__qr', el).classList.add('is-scanning');
    $('.scanner', el).classList.add('is-on');
    show('scan');
    await wait(1300);
    $('.lsim__qr', el).classList.remove('is-scanning');
    $('.scanner', el).classList.remove('is-on');
    open();
  });

  function moveItem(btn) {
    const i = +btn.dataset.i;
    if (pickup) {
      if (!btn.closest('.cell.is-open')) return;
      const empty = $('.tray__empty', tray);
      if (empty) empty.remove();
      btn.setAttribute('aria-label', toolById(o.items[i].id).short);
      tray.append(btn);
    } else {
      const c = cellEl(targets[i]);
      if (!c.classList.contains('is-open') || phase !== 'move') return;
      $('.cell__in', c).append(btn);
    }
    btn.classList.add('is-moved');
    btn.disabled = true;
    moved++;
    if (!pickup && moved === targets.length) tray.innerHTML = '<p class="tray__empty">Wszystko w skrytkach.</p>';
    if (moved === targets.length) setTimeout(() => show('close'), 350);
    else show('move');
  }
  el.addEventListener('click', e => {
    const btn = e.target.closest('.lk-item');
    if (btn && !btn.disabled) return moveItem(btn);
    const door = e.target.closest('.cell.is-open .cell__door');
    if (door && phase === 'close') closeDoor(+door.closest('.cell').dataset.no);
  });

  function closeDoor(no) {
    const c = cellEl(no);
    if (!c.classList.contains('is-open')) return;
    c.classList.remove('is-open');
    $('.cell__door', c).tabIndex = -1;
    if (targets.every(n => !cellEl(n).classList.contains('is-open')) && !finished) {
      finished = true;
      setTimeout(() => {
        show('bye');
        onDone();
      }, 450);
    }
  }

  show('home');
}
