// Kluczyk v1 — hash-routed mock of a car rental: search → fleet → extras → payment → booking.

const app = $('#app');
const KEY = 'kluczyk-v1';
const BOOKINGS = 'kluczyk-bookings';
const KM_PER_DAY = 300;
const STEPS = ['Termin', 'Auto', 'Dodatki', 'Płatność', 'Gotowe'];

// ---------- state ----------
function defaultDates() {
  const from = new Date();
  from.setHours(10, 0, 0, 0);
  from.setDate(from.getDate() + ((5 - from.getDay() + 7) % 7 || 7));
  return { from: +from, to: +from + 3 * DAY };
}

function loadState() {
  const d = defaultDates();
  const s = Object.assign({
    pickup: 'wro', ret: 'wro', oneWay: false, from: d.from, to: d.to, age25: true,
    cat: 'all', gearbox: 'any', sort: 'price', trip: null,
    carId: null, color: null, insurance: 'calm', unlimited: false, extras: {}, promo: null, payNow: true,
    secret: false, rally: false, driver: {},
  }, store.get(KEY, {}));
  if (s.from < Date.now() + 3600e3) Object.assign(s, d);
  if (s.to <= s.from) s.to = s.from + 3 * DAY;
  return s;
}

const state = loadState();
const save = () => store.set(KEY, state);

const bookings = {
  all: () => store.get(BOOKINGS, []),
  get: ref => bookings.all().find(b => b.ref === ref),
  save(b) {
    const list = bookings.all().filter(x => x.ref !== b.ref);
    list.unshift(b);
    store.set(BOOKINGS, list);
  },
};

// ---------- pricing ----------
const holidayCache = {};
function holidayName(ts) {
  const d = new Date(ts), y = d.getFullYear();
  holidayCache[y] = holidayCache[y] || holidaysFor(y);
  return holidayCache[y][`${d.getMonth() + 1}-${d.getDate()}`];
}
function dayFactor(ts) {
  if (holidayName(ts)) return 1.25;
  const w = new Date(ts).getDay();
  return w === 0 || w === 6 ? 1.15 : 1;
}
const rentalDays = (from = state.from, to = state.to) => Math.max(1, Math.ceil((to - from - 59 * 60e3) / DAY));
const longDiscount = days => (days >= 14 ? 0.3 : days >= 7 ? 0.2 : days >= 3 ? 0.1 : 0);
const locById = id => LOCATIONS.find(l => l.id === id) || ONE_WAY.find(l => l.id === id) || LOCATIONS[0];
const retLoc = () => locById(state.oneWay ? state.ret : state.pickup);
const carById = id => CARS.find(c => c.id === id && (!c.secret || state.secret));
const isWinter = ts => { const m = new Date(ts).getMonth(); return m >= 10 || m <= 2; };
const tripDest = () => DESTINATIONS.find(d => d.id === state.trip);
const cheapest = () => Math.min(...CARS.filter(c => !c.secret).map(c => c.price));

function offHours(ts, loc) {
  if (loc.h24) return false;
  const d = new Date(ts), h = d.getHours() + d.getMinutes() / 60;
  return h < 7 || h > 21;
}

function hasSaturday(from = state.from, to = state.to) {
  for (let t = from; t < to; t += DAY) if (new Date(t).getDay() === 6) return true;
  return new Date(to).getDay() === 6;
}

function unavailable(car) {
  if (car.seasonal && (isWinter(state.from) || isWinter(state.to))) {
    return 'Kabriolet zimuje w garażu od listopada do marca. Wróci, jak tylko zrobi się ciepło — zarezerwuj go na kwiecień.';
  }
  return '';
}

function extraCount(x, car) {
  if (x.notFor && x.notFor.includes(car.body)) return 0;
  const v = state.extras[x.id];
  return x.kind === 'count' ? (v || 0) : (v ? 1 : 0);
}

function promoProblem(code) {
  const p = PROMOS[code];
  if (!p) return 'Nie znamy takiego kodu.';
  if (p.weekend && !hasSaturday()) return 'Ten kod działa tylko wtedy, gdy w terminie jest sobota.';
  return '';
}

// full = with the choices made on the extras page (insurance, km, extras, promo, pay now)
function quote(car, full = true) {
  const days = rentalDays(), lines = [];
  let base = 0;
  for (let i = 0; i < days; i++) base += car.price * dayFactor(state.from + i * DAY);
  base = Math.round(base);
  lines.push({ label: `Wynajem · ${doby(days)}`, amount: base });
  const ld = longDiscount(days);
  if (ld) lines.push({ label: `Dłuższy wynajem −${ld * 100}%`, amount: -Math.round(base * ld), good: true });

  const pick = locById(state.pickup), ret = retLoc();
  if (pick.fee) lines.push({ label: 'Dostawa auta pod adres', amount: pick.fee });
  if (state.oneWay && ret.id === 'door') lines.push({ label: 'Odbiór auta spod adresu', amount: ret.fee });
  else if (state.oneWay && ret.fee) lines.push({ label: `Zwrot w innym mieście (${ret.short})`, amount: ret.fee });
  if (offHours(state.from, pick)) lines.push({ label: 'Wydanie poza godzinami 7–21', amount: 60 });
  if (offHours(state.to, ret)) lines.push({ label: 'Zwrot poza godzinami 7–21', amount: 60 });
  if (!state.age25) lines.push({ label: 'Kierowca poniżej 25 lat', amount: 29 * days });

  let deposit = car.deposit, excess = car.excess;
  if (full) {
    const ins = INSURANCE.find(i => i.id === state.insurance) || INSURANCE[0];
    if (ins.perDay) lines.push({ label: `Ochrona „${ins.name}”`, amount: ins.perDay * days });
    excess = Math.round(car.excess * ins.excessFactor);
    deposit = ins.depositFixed ?? Math.round(car.deposit * ins.depositFactor);
    if (state.unlimited) lines.push({ label: 'Bez limitu kilometrów', amount: 19 * days });
    EXTRAS.forEach(x => {
      const n = extraCount(x, car);
      if (!n) return;
      const each = x.per === 'day' ? Math.min(x.price * days, x.cap) : x.price;
      lines.push({ label: x.name + (n > 1 ? ` × ${n}` : ''), amount: each * n });
    });
    if (state.promo && !promoProblem(state.promo)) {
      const p = PROMOS[state.promo], subtotal = sum(lines);
      const off = p.pct ? Math.round(subtotal * p.pct / 100) : Math.min(p.amount, subtotal);
      lines.push({ label: `Kod ${state.promo}`, amount: -off, good: true });
    }
    if (state.payNow) lines.push({ label: 'Płatność online teraz −5%', amount: -Math.round(sum(lines) * 0.05), good: true });
  }
  const total = sum(lines);
  const list = lines.filter(l => l.amount > 0).reduce((a, l) => a + l.amount, 0);
  return { days, lines, total, list, perDay: total / days, deposit, excess };
}

function tripCost(car, dest) {
  const km = dest.km * 2;
  return { km, cost: km * car.cons / 100 * ENERGY[car.fuel], word: car.fuel === 'ev' ? 'za prąd' : car.fuel === 'diesel' ? 'za diesla' : 'za benzynę' };
}

// ---------- shared bits ----------
const specs = car => `
  <ul class="specs">
    <li title="Miejsca">${ic('seat')}${car.seats}</li>
    <li title="Duże walizki">${ic('bag')}${car.bags}</li>
    <li>${ic('gear')}${car.gearbox === 'auto' ? 'Automat' : 'Manual'}</li>
    <li>${ic(car.fuel === 'ev' ? 'bolt' : 'fuel')}${car.fuel === 'ev' ? `${car.range} km` : `${String(car.cons).replace('.', ',')} l`}</li>
  </ul>`;

function steps(current) {
  return `<ol class="steps" aria-label="Kroki rezerwacji">${STEPS.map((s, i) =>
    `<li class="${i < current ? 'is-done' : i === current ? 'is-now' : ''}"${i === current ? ' aria-current="step"' : ''}>
      <span class="steps__n">${i < current ? ic('check') : i + 1}</span><span class="steps__l">${s}</span></li>`).join('')}</ol>`;
}

const lineList = lines => `<ul class="lines">${lines.map(l =>
  `<li class="${l.good ? 'is-good' : ''}"><span>${esc(l.label)}</span><span>${l.amount < 0 ? '−' : ''}${zl(Math.abs(l.amount))}</span></li>`).join('')}</ul>`;

// Rolling odometer digits for the total.
function odometer(el, amount) {
  const text = zl(amount);
  if (el.dataset.len !== String(text.length)) {
    el.dataset.len = text.length;
    el.innerHTML = [...text].map(ch => /\d/.test(ch)
      ? `<span class="odo__d"><span class="odo__s">${'0123456789'.split('').map(n => `<span>${n}</span>`).join('')}</span></span>`
      : `<span class="odo__c">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
    el.setAttribute('aria-label', text);
    void el.offsetWidth;
  }
  const strips = $$('.odo__s', el);
  [...text].filter(ch => /\d/.test(ch)).forEach((n, i) => { strips[i].style.transform = `translateY(${-n}em)`; });
  el.setAttribute('aria-label', text);
}

// ---------- search form + price calendar ----------
function timeOptions(selected) {
  let out = '';
  for (let m = 6 * 60; m <= 23 * 60 + 30; m += 30) {
    const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    out += `<option${t === selected ? ' selected' : ''}>${t}</option>`;
  }
  return out;
}

function withTime(dayTs, hhmm) {
  const d = new Date(dayTs), [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return +d;
}

function searchForm({ compact = false, onChange } = {}) {
  const f = document.createElement('form');
  f.className = 'search' + (compact ? ' search--compact' : '');
  const locOpts = sel => LOCATIONS.map(l => `<option value="${l.id}"${l.id === sel ? ' selected' : ''}>${l.name}${l.fee ? ` (+${l.fee} zł)` : ''}</option>`).join('');
  f.innerHTML = `
    <label class="field field--loc"><span>Odbiór</span>
      <select class="input" name="pickup">${locOpts(state.pickup)}</select>
      <small class="field__note" data-note="pickup"></small>
    </label>
    <label class="field field--loc field--ret" ${state.oneWay ? '' : 'hidden'}><span>Zwrot</span>
      <select class="input" name="ret">
        <optgroup label="Wrocław">${locOpts(state.ret)}</optgroup>
        <optgroup label="Inne miasto">${ONE_WAY.map(l => `<option value="${l.id}"${l.id === state.ret ? ' selected' : ''}>${l.name} (+${l.fee} zł)</option>`).join('')}</optgroup>
      </select>
    </label>
    <div class="field field--date"><span>Odbiór</span>
      <div class="datebox"><button type="button" class="datebox__day" data-cal>${ic('cal')}<b data-day="from"></b></button>
      <select class="datebox__time" name="fromTime" aria-label="Godzina odbioru">${timeOptions(fmtTime(state.from))}</select></div>
    </div>
    <div class="field field--date"><span>Zwrot</span>
      <div class="datebox"><button type="button" class="datebox__day" data-cal>${ic('cal')}<b data-day="to"></b></button>
      <select class="datebox__time" name="toTime" aria-label="Godzina zwrotu">${timeOptions(fmtTime(state.to))}</select></div>
    </div>
    <div class="search__checks">
      <label class="check"><input type="checkbox" name="oneWay"${state.oneWay ? ' checked' : ''}><span>Zwrot w innym miejscu</span></label>
      <label class="check"><input type="checkbox" name="age25"${state.age25 ? ' checked' : ''}><span>Kierowca ma 25+ lat</span></label>
    </div>
    <button class="btn btn--primary btn--lg search__go" type="submit">${compact ? 'Odśwież' : 'Pokaż auta'} <span class="btn__meta" data-days></span></button>
    <p class="search__warn" hidden></p>`;

  const paint = () => {
    $('[data-day="from"]', f).textContent = fmtDay(state.from);
    $('[data-day="to"]', f).textContent = fmtDay(state.to);
    $('[data-days]', f).textContent = doby(rentalDays());
    $('[data-note="pickup"]', f).textContent = locById(state.pickup).note;
    $('.field--ret', f).hidden = !state.oneWay;
    const warn = [];
    if (!state.age25) warn.push('Dla kierowców poniżej 25 lat doliczamy 29 zł za dobę.');
    if (offHours(state.from, locById(state.pickup)) || offHours(state.to, retLoc())) warn.push('Wydanie lub zwrot poza 7–21: +60 zł (lotnisko działa całą dobę).');
    $('.search__warn', f).hidden = !warn.length;
    $('.search__warn', f).textContent = warn.join(' ');
  };
  const changed = () => { save(); paint(); if (onChange) onChange(); };

  f.pickup.addEventListener('change', () => { state.pickup = f.pickup.value; if (!state.oneWay) state.ret = state.pickup; changed(); });
  f.ret.addEventListener('change', () => { state.ret = f.ret.value; changed(); });
  f.oneWay.addEventListener('change', () => { state.oneWay = f.oneWay.checked; if (!state.oneWay) state.ret = state.pickup; changed(); });
  f.age25.addEventListener('change', () => { state.age25 = f.age25.checked; changed(); });
  f.fromTime.addEventListener('change', () => { state.from = withTime(state.from, f.fromTime.value); fixRange(); changed(); });
  f.toTime.addEventListener('change', () => { state.to = withTime(state.to, f.toTime.value); fixRange(); changed(); });
  $$('[data-cal]', f).forEach(b => b.addEventListener('click', () => openCalendar(() => {
    f.fromTime.value = fmtTime(state.from);
    f.toTime.value = fmtTime(state.to);
    changed();
  })));
  f.addEventListener('submit', e => {
    e.preventDefault();
    if (compact) { changed(); toast('Ceny przeliczone dla nowego terminu'); } else go('#/auta');
  });
  paint();
  return f;
}

function fixRange() {
  if (state.to - state.from < 3600e3) state.to = state.from + DAY;
}

function openCalendar(onDone) {
  const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return +d; };
  const today = startOfDay(Date.now());
  let a = startOfDay(state.from), b = startOfDay(state.to);
  let view = new Date(a);
  view.setDate(1);
  const base = cheapest();

  const m = modal({
    cls: 'modal--cal', label: 'Wybierz termin',
    html: `
    <div class="cal">
      <div class="cal__head">
        <div><p class="eyebrow">Termin wynajmu</p><p class="cal__sum" aria-live="polite"></p></div>
        <button type="button" class="icon-btn" data-close aria-label="Zamknij">${ic('x')}</button>
      </div>
      <div class="cal__nav">
        <button type="button" class="icon-btn" data-step="-1" aria-label="Poprzedni miesiąc">${ic('back')}</button>
        <button type="button" class="icon-btn" data-step="1" aria-label="Następny miesiąc">${ic('arrow')}</button>
      </div>
      <div class="cal__months"></div>
      <div class="cal__foot">
        <p class="cal__legend"><span class="lg lg--wk"></span>weekend +15% <span class="lg lg--hol"></span>święto +25% <span class="cal__tip">ceny „od” za dobę, najtańsze auto</span></p>
        <button type="button" class="btn btn--primary" data-ok>Zatwierdź</button>
      </div>
    </div>`,
  });

  const monthHTML = first => {
    const y = first.getFullYear(), mo = first.getMonth();
    const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    const count = new Date(y, mo + 1, 0).getDate();
    let cells = '<span></span>'.repeat(lead);
    for (let d = 1; d <= count; d++) {
      const ts = +new Date(y, mo, d), w = new Date(ts).getDay(), hol = holidayName(ts);
      const cls = [
        ts < today && 'is-past', ts === today && 'is-today', (w === 0 || w === 6) && 'is-wk', hol && 'is-hol',
        ts === a && 'is-start', b && ts === b && 'is-end', b && ts > a && ts < b && 'is-in',
      ].filter(Boolean).join(' ');
      const label = `${d} ${first.toLocaleDateString('pl-PL', { month: 'long' })}${hol ? ', ' + hol : ''}`;
      cells += `<button type="button" class="cal__d ${cls}" data-ts="${ts}" ${ts < today ? 'disabled' : ''} title="${esc(hol || '')}" aria-label="${esc(label)}">
        <b>${d}</b><small>${Math.round(base * dayFactor(ts))}</small></button>`;
    }
    const name = first.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
    return `<div class="cal__m"><p class="cal__title">${name}</p>
      <div class="cal__grid"><i>pn</i><i>wt</i><i>śr</i><i>cz</i><i>pt</i><i>sb</i><i>nd</i>${cells}</div></div>`;
  };

  const render = () => {
    const second = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    $('.cal__months', m.el).innerHTML = monthHTML(view) + monthHTML(second);
    $('[data-step="-1"]', m.el).disabled = view <= new Date(new Date(today).getFullYear(), new Date(today).getMonth(), 1);
    const fromTs = withTime(a, fmtTime(state.from)), toTs = b ? withTime(b, fmtTime(state.to)) : null;
    $('.cal__sum', m.el).innerHTML = b
      ? `<b>${fmtDay(fromTs)}</b> ${fmtTime(fromTs)} → <b>${fmtDay(toTs)}</b> ${fmtTime(toTs)} · ${doby(rentalDays(fromTs, toTs))}`
      : `<b>${fmtDay(fromTs)}</b> → wybierz dzień zwrotu`;
    $('[data-ok]', m.el).disabled = !b;
    $$('.cal__d', m.el).forEach(btn => btn.addEventListener('click', () => {
      const ts = +btn.dataset.ts;
      if (!b || ts < a) { a = ts; b = null; } else b = ts;
      render();
    }));
  };

  $$('[data-step]', m.el).forEach(btn => btn.addEventListener('click', () => {
    view = new Date(view.getFullYear(), view.getMonth() + +btn.dataset.step, 1);
    render();
  }));
  $('[data-ok]', m.el).addEventListener('click', () => {
    state.from = withTime(a, fmtTime(state.from));
    state.to = withTime(b, fmtTime(state.to));
    if (state.from < Date.now() + 3600e3) {
      const next = new Date(Date.now() + 2 * 3600e3);
      next.setMinutes(next.getMinutes() < 30 ? 30 : 60, 0, 0);
      state.from = +next;
    }
    fixRange();
    m.close();
    onDone();
  });
  render();
}

// ---------- home ----------
function skyline() {
  let s = '', x = 150, i = 0;
  // Cathedral-ish towers and a tall tower in the back, tenements in front.
  const back = '<rect x="462" y="8" width="26" height="152" rx="2"/><rect x="472" y="0" width="6" height="10"/><rect x="398" y="70" width="52" height="90"/><rect x="520" y="56" width="40" height="104"/><rect x="566" y="80" width="40" height="80"/><rect x="0" y="86" width="60" height="74"/>';
  const church = '<rect x="70" y="62" width="18" height="98"/><polygon points="70,62 79,8 88,62"/><rect x="104" y="62" width="18" height="98"/><polygon points="104,62 113,8 122,62"/><rect x="84" y="92" width="64" height="68"/><polygon points="84,92 116,74 148,92"/>';
  const heights = [74, 62, 86, 70, 80, 58, 76, 66];
  while (x < 420) {
    const w = 34 + (i % 3) * 6, h = heights[i % heights.length], top = 160 - h;
    s += `<rect x="${x}" y="${top}" width="${w}" height="${h}"/>`;
    s += i % 2
      ? `<polygon points="${x},${top} ${x + w / 2},${top - 16} ${x + w},${top}"/>`
      : `<polygon points="${x + 4},${top} ${x + 4},${top - 8} ${x + 10},${top - 8} ${x + 10},${top - 14} ${x + w - 10},${top - 14} ${x + w - 10},${top - 8} ${x + w - 4},${top - 8} ${x + w - 4},${top}"/>`;
    for (let r = top + 10; r < 148; r += 16) {
      for (let c = x + 6; c < x + w - 8; c += 10) {
        s += `<rect class="win" x="${c}" y="${r}" width="5" height="8" style="--on:${((c * 7 + r * 3) % 5) / 5}"/>`;
      }
    }
    x += w + 2;
    i++;
  }
  return `<svg class="scene__city" viewBox="0 0 600 160" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <g class="city-back">${back}</g><g class="city-front">${church}${s}</g></svg>`;
}

function viewHome() {
  const hero = CARS.find(c => c.id === 'yaris');
  const cats = ['city', 'wagon', 'suv', 'ev', 'van', 'cabrio'];
  app.innerHTML = `
  <section class="hero">
    <div class="wrap hero__grid">
      <div class="hero__copy">
        <p class="eyebrow">Wynajem aut · Wrocław i lotnisko WRO</p>
        <h1 class="hero__title">Kluczyk do auta w&nbsp;<mark>3&nbsp;minuty</mark>.</h1>
        <p class="hero__lead">Cena, którą widzisz, to cena, którą płacisz. OC, AC, assistance i ${KM_PER_DAY} km na dobę są w środku — bez gwiazdek i drobnego druku.</p>
        <div id="searchSlot"></div>
      </div>
      <div class="scene" id="scene">
        <div class="scene__sky"><span class="scene__sun"></span><span class="scene__stars"></span></div>
        ${skyline()}
        <div class="scene__road"><span class="scene__lines"></span></div>
        <button type="button" class="scene__car" id="heroCar" aria-label="Zatrąb i zmień kolor auta">${carFor(hero, COLORS[5].hex, 'driving')}</button>
        <span class="scene__hint">psst — kliknij auto</span>
      </div>
    </div>
  </section>

  <section class="wrap usps">
    <div class="usp">${ic('plane')}<p><b>0 zł za lotnisko</b>Odbiór na WRO o każdej porze, bez opłaty lotniskowej.</p></div>
    <div class="usp">${ic('undo')}<p><b>Anulujesz za darmo</b>Do 24 godzin przed odbiorem, jednym kliknięciem.</p></div>
    <div class="usp">${ic('clock')}<p><b>59 minut luzu</b>Spóźniony zwrot? Pierwsza godzina jest na nas.</p></div>
    <div class="usp">${ic('shield')}<p><b>Kaucja od 300 zł</b>Z ochroną „Bez nerwów” — zamiast typowych 3000 zł.</p></div>
  </section>

  <section class="wrap section" id="flota">
    <div class="section__head"><div><p class="eyebrow">Flota</p><h2>Auto na każdą okazję</h2></div>
      <a class="btn btn--ghost" href="#/auta">Cała flota ${ic('arrow')}</a></div>
    <div class="cats">
      ${cats.map(c => {
        const cars = CARS.filter(x => x.cat === c), pick = cars[0];
        const from = Math.min(...cars.map(x => x.price));
        return `<button type="button" class="cat" data-cat="${c}">
          <span class="cat__stage">${carFor(pick)}</span>
          <span class="cat__name">${CATEGORIES[c]}</span><span class="cat__from">od ${from} zł/doba</span></button>`;
      }).join('')}
    </div>
  </section>

  <section class="trip" id="trasy">
    <div class="wrap trip__grid">
      <div class="trip__intro">
        <p class="eyebrow">Kalkulator trasy</p>
        <h2>Dokąd jedziesz?</h2>
        <p>Wybierz cel, a policzymy paliwo albo prąd dla każdego auta i sprawdzimy, czy zmieścisz się w limicie kilometrów.</p>
        <div class="dests">${DESTINATIONS.map(d => `<button type="button" class="chip" data-dest="${d.id}" aria-pressed="${state.trip === d.id}">${d.name}<small>${d.km} km</small></button>`).join('')}</div>
      </div>
      <div class="trip__map" id="tripMap"></div>
      <div class="trip__out" id="tripOut"></div>
    </div>
  </section>

  <section class="wrap section how">
    <div class="section__head"><div><p class="eyebrow">Jak to działa</p><h2>Trzy kroki do kierownicy</h2></div></div>
    <ol class="how__list">
      <li><span class="how__n">1</span><b>Wybierz termin i auto</b><p>Kalendarz pokazuje ceny na każdy dzień — weekendy i święta są droższe, długi wynajem tańszy.</p></li>
      <li><span class="how__n">2</span><b>Zapłać online i oszczędź 5%</b><p>BLIK, karta, przelew albo portfel w telefonie. Albo zapłać przy odbiorze — też można.</p></li>
      <li><span class="how__n">3</span><b>Odbierz kluczyk</b><p>Pokazujesz prawo jazdy, podpisujesz protokół na tablecie i jedziesz. Średnio 3 minuty przy stanowisku.</p></li>
    </ol>
  </section>

  <section class="wrap section faq" id="faq">
    <div class="section__head"><div><p class="eyebrow">FAQ</p><h2>Pytania, które zadaje każdy</h2></div></div>
    <div class="faq__list">
      <details><summary>Ile wynosi kaucja i kiedy ją odzyskam?</summary><p>Zależy od auta i ochrony: od 300 zł („Bez nerwów”) do 3000 zł („Podstawowa”). Blokujemy ją na karcie przy odbiorze, nie pobieramy. Bank zdejmuje blokadę zwykle w 1–3 dni robocze po zwrocie auta.</p></details>
      <details><summary>Czy mogę wyjechać za granicę?</summary><p>Tak, do krajów UE oraz Szwajcarii i Norwegii. Zaznacz dodatek „Wyjazd za granicę” — przygotujemy zieloną kartę i upoważnienie.</p></details>
      <details><summary>Co jeśli spóźnię się ze zwrotem?</summary><p>Pierwsze 59 minut jest gratis. Potem liczymy kolejną dobę według cennika z rezerwacji. Napisz do nas — zawsze da się coś ustalić.</p></details>
      <details><summary>Muszę zatankować do pełna?</summary><p>Oddaj auto z takim poziomem paliwa lub baterii, z jakim je dostałeś. Jeśli brakuje, dolejemy po cenie ze stacji obok — bez prowizji.</p></details>
      <details><summary>Jak anulować rezerwację?</summary><p>W „Moich rezerwacjach”. Do 24 h przed odbiorem zwracamy całość, później 50%. Pieniądze wracają tą samą metodą płatności.</p></details>
    </div>
  </section>`;

  $('#searchSlot').append(searchForm());

  const heroCar = $('#heroCar');
  let ci = 5;
  heroCar.addEventListener('click', () => {
    sound.horn();
    ci = (ci + 1) % COLORS.length;
    const svg = $('svg', heroCar);
    svg.style.setProperty('--paint', COLORS[ci].hex);
    $$('.paint', svg).forEach(p => p.setAttribute('fill', COLORS[ci].hex));
    flash(svg, 'lights', 2);
    $('.scene__hint').textContent = COLORS[ci].name;
  });

  $$('.cat').forEach(b => b.addEventListener('click', () => { state.cat = b.dataset.cat; save(); go('#/auta'); }));
  $$('[data-dest]').forEach(b => b.addEventListener('click', () => {
    state.trip = state.trip === b.dataset.dest ? null : b.dataset.dest;
    save();
    $$('[data-dest]').forEach(x => x.setAttribute('aria-pressed', x.dataset.dest === state.trip));
    renderTrip();
  }));
  renderTrip();
}

function project([lon, lat]) {
  return [(lon - 12.6) * 0.63 * 52, (55 - lat) * 52];
}

function renderTrip() {
  const dest = tripDest();
  const [hx, hy] = project(HOME_AT);
  let route = '';
  if (dest) {
    const [dx, dy] = project(dest.at);
    const mx = (hx + dx) / 2 - (dy - hy) * 0.22, my = (hy + dy) / 2 + (dx - hx) * 0.22;
    route = `<path id="tripPath" class="map__route" d="M${hx} ${hy} Q${mx.toFixed(1)} ${my.toFixed(1)} ${dx} ${dy}"/>
      <circle class="map__car" r="5"><animateMotion dur="2.6s" repeatCount="indefinite" rotate="auto"><mpath href="#tripPath"/></animateMotion></circle>`;
  }
  $('#tripMap').innerHTML = `<svg class="map" viewBox="-36 0 306 380" role="img" aria-label="Mapa celów podróży z Wrocławia">
    <defs><pattern id="mapDots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1"/></pattern></defs>
    <rect class="map__bg" x="-36" width="306" height="380" rx="18" fill="url(#mapDots)"/>
    ${route}
    ${DESTINATIONS.map(d => {
      const [x, y] = project(d.at), right = x < 190 && !d.dy;
      return `<g class="map__pt ${d.id === state.trip ? 'is-on' : ''}"><circle cx="${x}" cy="${y}" r="4"/>
        <text x="${right ? x + 8 : x - 8}" y="${y + 4 + (d.dy || 0)}" text-anchor="${right ? 'start' : 'end'}">${d.name}</text></g>`;
    }).join('')}
    <g class="map__home"><circle cx="${hx}" cy="${hy}" r="7"/><text x="${hx + 11}" y="${hy + 4}">Wrocław</text></g>
  </svg>`;

  const out = $('#tripOut');
  if (!dest) {
    out.innerHTML = `<div class="trip__empty">${ic('route')}<p>Kliknij cel po lewej — policzymy koszt drogi dla całej floty.</p></div>`;
    return;
  }
  const days = rentalDays(), limit = KM_PER_DAY * days;
  const cars = CARS.filter(c => !c.secret && !unavailable(c)).map(c => ({ c, ...tripCost(c, dest) })).sort((a, b) => a.cost - b.cost);
  const km = dest.km * 2, h = dest.km / 82;
  const over = km - limit;
  const tips = [];
  if (dest.mountain && isWinter(state.from)) tips.push(`${ic('snow')} Góry zimą — w dodatkach są łańcuchy i box na narty.`);
  if (dest.abroad) tips.push(`${ic('plane')} Za granicę? Dodaj „Wyjazd za granicę” (99 zł) — dostaniesz zieloną kartę.`);
  out.innerHTML = `
    <p class="trip__head"><b>Wrocław ⇄ ${dest.name}</b><span>${km} km tam i z powrotem · ≈ ${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')} min w jedną stronę</span></p>
    <p class="trip__limit ${over > 0 ? 'is-over' : ''}">${over > 0
      ? `Limit ${limit} km na ${doby(days)} — zabraknie ${over} km. Weź „Bez limitu” za ${19 * days} zł albo dopłać 0,50 zł/km.`
      : `${ic('check')} Limit ${limit} km na ${doby(days)} — zmieścisz się z zapasem ${-over} km.`}</p>
    <ul class="trip__cars">${cars.slice(0, 5).map(({ c, cost, word }) => `
      <li><span class="trip__mini">${carFor(c)}</span><span>${c.name}<small>${c.fuel === 'ev' && c.range < dest.km ? '1 ładowanie po drodze' : FUELS[c.fuel]}</small></span><b>≈ ${zl0(cost)}<small>${word}</small></b></li>`).join('')}</ul>
    ${tips.map(t => `<p class="trip__tip">${t}</p>`).join('')}
    <button type="button" class="btn btn--primary" id="tripGo">Pokaż auta na tę trasę ${ic('arrow')}</button>`;
  $('#tripGo').addEventListener('click', () => { state.sort = 'trip'; save(); go('#/auta'); });
}

// ---------- fleet ----------
function viewFleet() {
  app.innerHTML = `
  <section class="wrap page">
    ${steps(1)}
    <div id="searchSlot"></div>
    <div class="fleet">
      <aside class="filters" id="filters" aria-label="Filtry"></aside>
      <div class="fleet__main">
        <div class="fleet__bar"><p id="fleetCount" aria-live="polite"></p>
          <label class="sort"><span>Sortuj</span><select class="input" id="sort">
            <option value="price">Cena: od najniższej</option><option value="-price">Cena: od najwyższej</option>
            <option value="seats">Najwięcej miejsc</option><option value="trip">Najtańsza trasa</option>
          </select></label></div>
        <div class="cars" id="cars"></div>
      </div>
    </div>
  </section>`;
  $('#searchSlot').append(searchForm({ compact: true, onChange: renderCars }));
  $('#sort').value = state.sort;
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; save(); renderCars(); });
  renderFilters();
  renderCars();
}

function renderFilters() {
  const cats = Object.keys(CATEGORIES).filter(c => c !== 'secret' || state.secret);
  $('#filters').innerHTML = `
    <div class="filter"><p class="filter__t">Kategoria</p>
      <div class="chips">${cats.map(c => `<button type="button" class="chip ${c === 'secret' ? 'chip--secret' : ''}" data-f-cat="${c}" aria-pressed="${state.cat === c}">${CATEGORIES[c]}</button>`).join('')}</div></div>
    <div class="filter"><p class="filter__t">Skrzynia</p>
      <div class="seg">${[['any', 'Dowolna'], ['auto', 'Automat'], ['manual', 'Manual']].map(([v, l]) =>
        `<button type="button" data-f-gear="${v}" aria-pressed="${state.gearbox === v}">${l}</button>`).join('')}</div></div>
    <div class="filter"><p class="filter__t">Trasa</p>
      <select class="input" id="fTrip"><option value="">Bez trasy</option>${DESTINATIONS.map(d =>
        `<option value="${d.id}"${d.id === state.trip ? ' selected' : ''}>Wrocław ⇄ ${d.name} (${d.km * 2} km)</option>`).join('')}</select>
      <small class="filter__note">Policzymy paliwo dla każdego auta.</small></div>
    <div class="filter filter--incl"><p class="filter__t">Zawsze w cenie</p>
      <ul><li>${ic('check')}OC, AC i assistance 24/7</li><li>${ic('check')}${KM_PER_DAY} km na dobę</li><li>${ic('check')}Uchwyt na telefon i ładowarka</li><li>${ic('check')}59 minut spóźnienia</li></ul></div>`;
  $$('[data-f-cat]').forEach(b => b.addEventListener('click', () => { state.cat = b.dataset.fCat; save(); renderFilters(); renderCars(); }));
  $$('[data-f-gear]').forEach(b => b.addEventListener('click', () => { state.gearbox = b.dataset.fGear; save(); renderFilters(); renderCars(); }));
  $('#fTrip').addEventListener('change', e => { state.trip = e.target.value || null; save(); renderCars(); });
}

function renderCars() {
  const dest = tripDest();
  let list = CARS.filter(c => (!c.secret || state.secret)
    && (state.cat === 'all' || c.cat === state.cat)
    && (state.gearbox === 'any' || c.gearbox === state.gearbox));
  const q = new Map(list.map(c => [c.id, quote(c, false)]));
  const key = {
    price: c => q.get(c.id).total, '-price': c => -q.get(c.id).total, seats: c => -c.seats * 1000 + c.price,
    trip: c => (dest ? tripCost(c, dest).cost + q.get(c.id).total : q.get(c.id).total),
  }[state.sort] || (c => q.get(c.id).total);
  list.sort((a, b) => (!!unavailable(a) - !!unavailable(b)) || key(a) - key(b));

  $('#fleetCount').innerHTML = `<b>${list.length}</b> ${plural(list.length, 'auto', 'auta', 'aut')} · ${fmtDay(state.from)} → ${fmtDay(state.to)} · ${doby(rentalDays())}`;
  if (!list.length) {
    $('#cars').innerHTML = `<div class="empty">${carSVG('hatch', '#c9ccd2')}<p>Nic tu nie ma. Spróbuj innej skrzyni albo kategorii.</p></div>`;
    return;
  }
  $('#cars').innerHTML = list.map(c => {
    const qq = q.get(c.id), off = unavailable(c), t = dest && tripCost(c, dest);
    return `<article class="car-card ${off ? 'is-off' : ''} ${c.secret ? 'car-card--secret' : ''}">
      <div class="car-card__stage">${c.tag ? `<span class="tag">${c.tag}</span>` : ''}${carFor(c)}</div>
      <div class="car-card__body">
        <p class="kicker">${CATEGORIES[c.cat]} · ${FUELS[c.fuel]}</p>
        <h3>${c.name} <small>lub podobny</small></h3>
        ${specs(c)}
        <p class="car-card__blurb">${c.blurb}</p>
        ${t ? `<p class="car-card__trip">${ic('route')}Wrocław ⇄ ${dest.name}: <b>≈ ${zl0(t.cost)}</b> ${t.word}</p>` : ''}
        ${off ? `<p class="car-card__off">${off}</p>` : ''}
      </div>
      <div class="car-card__price">
        <p class="car-card__per"><b>${zl0(qq.perDay)}</b> / doba</p>
        <p class="car-card__tot">${qq.list !== qq.total ? `<s>${zl0(qq.list)}</s> ` : ''}${zl0(qq.total)} razem</p>
        <button type="button" class="btn ${off ? 'btn--ghost' : 'btn--primary'}" data-pick="${c.id}" ${off ? 'disabled' : ''}>${off ? 'Niedostępny' : 'Wybieram'}</button>
      </div>
    </article>`;
  }).join('');
  $$('[data-pick]').forEach(b => b.addEventListener('click', () => {
    if (state.carId !== b.dataset.pick) state.color = null;
    state.carId = b.dataset.pick;
    save();
    go('#/auto/' + b.dataset.pick);
  }));
}

// ---------- extras / car page ----------
function viewCar(id) {
  const car = carById(id);
  if (!car || unavailable(car)) { go('#/auta'); return; }
  state.carId = car.id;
  save();
  const color = state.color || car.color;
  const dest = tripDest(), winter = isWinter(state.from);
  const recommend = {
    chains: winter && (!dest || dest.mountain),
    box: winter && dest && dest.mountain,
    abroad: dest && dest.abroad,
    seat: false,
  };
  if (recommend.abroad && state.extras.abroad === undefined) state.extras.abroad = true;

  app.innerHTML = `
  <section class="wrap page">
    ${steps(2)}
    <a class="back" href="#/auta">${ic('back')} Wróć do floty</a>
    <div class="config">
      <div class="config__main">
        <div class="showroom">
          <div class="showroom__stage">
            <button type="button" class="showroom__car" id="showCar" aria-label="Zatrąb i mrugnij światłami">${carFor(car, color)}</button>
            <span class="showroom__hint">kliknij auto, żeby zatrąbić</span>
          </div>
          <div class="showroom__info">
            <p class="kicker">${CATEGORIES[car.cat]} · ${FUELS[car.fuel]}</p>
            <h1>${car.name} <small>lub podobny</small></h1>
            <p class="muted">${car.blurb}</p>
            ${specs(car)}
            <div class="swatches" role="radiogroup" aria-label="Kolor">
              ${[{ id: 'default', name: 'Jak na zdjęciu', hex: car.color }, ...COLORS].map(c =>
                `<button type="button" class="swatch" role="radio" style="--sw:${c.hex}" data-color="${c.hex}" aria-checked="${c.hex === color}" title="${c.name}"><span class="sr-only">${c.name}</span></button>`).join('')}
              <small class="swatches__note">Kolor nie jest gwarantowany — zapiszemy życzenie i postaramy się.</small>
            </div>
          </div>
        </div>

        <section class="block">
          <div class="block__head"><h2>Ochrona</h2><p class="muted">Udział własny to kwota, którą płacisz przy szkodzie z Twojej winy.</p></div>
          <div class="ins">${INSURANCE.map(ins => {
            const exc = Math.round(car.excess * ins.excessFactor);
            const dep = ins.depositFixed ?? Math.round(car.deposit * ins.depositFactor);
            return `<button type="button" class="ins__card" role="radio" data-ins="${ins.id}" aria-checked="${state.insurance === ins.id}">
              ${ins.recommended ? '<span class="tag">Wybiera 7 na 10</span>' : ''}
              <span class="ins__name">${ins.name}</span>
              <span class="ins__price">${ins.perDay ? `+${ins.perDay} zł <small>/ doba</small>` : 'w cenie'}</span>
              <span class="ins__bar"><span style="width:${Math.max(3, exc / car.excess * 100)}%"></span></span>
              <span class="ins__meta">Udział własny <b>${zl0(exc)}</b></span>
              <span class="ins__meta">Kaucja <b>${zl0(dep)}</b></span>
              <ul>${ins.covers.map(c => `<li>${ic('check')}${c}</li>`).join('')}</ul>
            </button>`;
          }).join('')}</div>
        </section>

        <section class="block">
          <div class="block__head"><h2>Kilometry</h2>${dest ? `<p class="muted">Twoja trasa: ${dest.km * 2} km, limit w cenie: ${KM_PER_DAY * rentalDays()} km.</p>` : ''}</div>
          <div class="km">
            <button type="button" class="km__opt" data-km="0" aria-checked="${!state.unlimited}" role="radio"><b>${KM_PER_DAY} km / doba</b><span>w cenie · potem 0,50 zł/km</span></button>
            <button type="button" class="km__opt" data-km="1" aria-checked="${state.unlimited}" role="radio"><b>Bez limitu</b><span>+19 zł / doba · jedź, ile chcesz</span></button>
          </div>
        </section>

        <section class="block">
          <div class="block__head"><h2>Dodatki</h2></div>
          <ul class="extras">${EXTRAS.filter(x => !(x.notFor && x.notFor.includes(car.body))).map(x => {
            const n = state.extras[x.id] || 0;
            const price = x.per === 'day' ? `${x.price} zł / doba <small>max ${x.cap} zł</small>` : `${x.price} zł <small>jednorazowo</small>`;
            const ctl = x.kind === 'count'
              ? `<div class="stepper" aria-label="${x.name}"><button type="button" data-dec="${x.id}" aria-label="Mniej">−</button><output>${n}</output><button type="button" data-inc="${x.id}" aria-label="Więcej">+</button></div>`
              : `<label class="switch"><input type="checkbox" data-tog="${x.id}"${n ? ' checked' : ''}><span></span><span class="sr-only">${x.name}</span></label>`;
            return `<li class="extra">
              <div><b>${x.name}</b>${recommend[x.id] ? `<span class="tag tag--soft">${ic(x.id === 'abroad' ? 'plane' : 'snow')}${x.id === 'abroad' ? 'do Twojej trasy' : 'polecane zimą'}</span>` : ''}<small>${x.note}</small></div>
              <span class="extra__price">${price}</span>${ctl}</li>`;
          }).join('')}
            <li class="extra extra--joke"><div><b>Nawigacja GPS</b><small>Masz telefon. Uchwyt i ładowarka USB-C są w każdym aucie — gratis.</small></div><span class="extra__price">0 zł</span><span class="tag tag--soft">w cenie</span></li>
          </ul>
        </section>
      </div>
      <aside class="summary" id="summary"></aside>
    </div>
  </section>
  <div class="mobile-cta" id="mobileCta"><span><small>Razem</small><b></b></span><button type="button" class="btn btn--primary">Dalej: płatność</button></div>`;

  const showCar = $('#showCar');
  showCar.addEventListener('click', () => { sound.horn(); flash($('svg', showCar), 'lights', 2); });
  $$('.swatch').forEach(s => s.addEventListener('click', () => {
    state.color = s.dataset.color === car.color ? null : s.dataset.color;
    save();
    $$('.swatch').forEach(x => x.setAttribute('aria-checked', x === s));
    const svg = $('svg', showCar);
    $$('.paint', svg).forEach(p => p.setAttribute('fill', s.dataset.color));
    flash(svg, 'blink', 1);
    renderSummary(car);
  }));
  $$('[data-ins]').forEach(b => b.addEventListener('click', () => {
    state.insurance = b.dataset.ins;
    $$('[data-ins]').forEach(x => x.setAttribute('aria-checked', x === b));
    save();
    renderSummary(car);
  }));
  $$('[data-km]').forEach(b => b.addEventListener('click', () => {
    state.unlimited = b.dataset.km === '1';
    $$('[data-km]').forEach(x => x.setAttribute('aria-checked', x === b));
    save();
    renderSummary(car);
  }));
  $$('[data-inc],[data-dec]').forEach(b => b.addEventListener('click', () => {
    const xid = b.dataset.inc || b.dataset.dec, x = EXTRAS.find(e => e.id === xid);
    const n = Math.max(0, Math.min(x.max, (state.extras[xid] || 0) + (b.dataset.inc ? 1 : -1)));
    state.extras[xid] = n;
    b.parentElement.querySelector('output').textContent = n;
    save();
    renderSummary(car);
  }));
  $$('[data-tog]').forEach(i => i.addEventListener('change', () => { state.extras[i.dataset.tog] = i.checked; save(); renderSummary(car); }));
  $('#mobileCta button').addEventListener('click', () => go('#/kasa'));
  renderSummary(car);
}

function renderSummary(car, { checkout = false } = {}) {
  const q = quote(car);
  const pick = locById(state.pickup), ret = retLoc();
  const saving = -(q.lines.find(l => l.label.startsWith('Płatność online')) || { amount: 0 }).amount;
  const el = $('#summary');
  el.innerHTML = `
    <div class="summary__card">
      <div class="summary__car">${carFor(car, state.color || car.color)}<div><b>${car.name}</b><small>${CATEGORIES[car.cat]} · ${doby(q.days)}</small></div></div>
      <dl class="summary__when">
        <div><dt>Odbiór</dt><dd>${pick.short}<small>${fmtDay(state.from)}, ${fmtTime(state.from)}</small></dd></div>
        <div><dt>Zwrot</dt><dd>${ret.short}<small>${fmtDay(state.to)}, ${fmtTime(state.to)}</small></dd></div>
      </dl>
      ${lineList(q.lines)}
      ${checkout ? '' : `
      <div class="promo">${state.promo
        ? `<p class="promo__on">${ic('tag')}<span>${PROMOS[state.promo].label}</span>${promoProblem(state.promo) ? `<small>${promoProblem(state.promo)}</small>` : ''}<button type="button" class="link" data-promo-x>usuń</button></p>`
        : `<form class="promo__form"><input class="input" name="code" placeholder="Kod rabatowy" autocomplete="off" aria-label="Kod rabatowy"><button class="btn btn--ghost" type="submit">Użyj</button></form><p class="promo__msg" role="status"></p>`}</div>
      <div class="seg seg--block" role="radiogroup" aria-label="Kiedy płacisz">
        <button type="button" data-paynow="1" aria-pressed="${state.payNow}">Płacę teraz <small>−5%</small></button>
        <button type="button" data-paynow="0" aria-pressed="${!state.payNow}">Przy odbiorze</button>
      </div>`}
      <div class="summary__total"><span>Razem<small>${state.payNow ? `oszczędzasz ${zl0(saving)}` : 'płatne przy odbiorze'}</small></span><b class="odo" id="odo"></b></div>
      <p class="summary__dep">${ic('shield')}<span>Kaucja <b>${zl0(q.deposit)}</b> — blokada na karcie przy odbiorze, nie obciążenie. Udział własny: ${zl0(q.excess)}.</span></p>
      ${checkout ? '' : `<button type="button" class="btn btn--primary btn--lg btn--block" id="toPay">Dalej: płatność ${ic('arrow')}</button>`}
    </div>`;
  odometer($('#odo'), q.total);
  const cta = $('#mobileCta b');
  if (cta) cta.textContent = zl(q.total);
  if (checkout) return q;

  $('#toPay').addEventListener('click', () => go('#/kasa'));
  $$('[data-paynow]', el).forEach(b => b.addEventListener('click', () => { state.payNow = b.dataset.paynow === '1'; save(); renderSummary(car); }));
  const x = $('[data-promo-x]', el);
  if (x) x.addEventListener('click', () => { state.promo = null; save(); renderSummary(car); });
  const form = $('.promo__form', el);
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    const code = form.code.value.trim().toUpperCase().replace(/\s/g, '');
    const msg = $('.promo__msg', el);
    if (code === 'MALUCH') { form.code.value = ''; unlockSecret(true); return; }
    const problem = promoProblem(code);
    if (problem) {
      msg.textContent = problem;
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      return;
    }
    state.promo = code;
    save();
    renderSummary(car);
    toast(`Kod ${code} działa`, 'tag');
  });
  return q;
}

// ---------- checkout ----------
function viewCheckout() {
  const car = carById(state.carId);
  if (!car || unavailable(car)) { go('#/auta'); return; }
  const d = state.driver;
  const field = (name, label, attrs = '', wide = false) =>
    `<label class="field ${wide ? 'field--wide' : ''}"><span>${label}</span><input class="input" name="${name}" value="${esc(d[name] || '')}" ${attrs}><small class="field__err" data-err="${name}"></small></label>`;

  app.innerHTML = `
  <section class="wrap page">
    ${steps(3)}
    <a class="back" href="#/auto/${car.id}">${ic('back')} Wróć do dodatków</a>
    <div class="config">
      <div class="config__main">
        <form class="block" id="driver" novalidate>
          <div class="block__head"><h2>Kierowca</h2><p class="muted">Prawo jazdy i dowód pokażesz przy odbiorze — nie wpisujesz ich tutaj.</p></div>
          <div class="form-grid">
            ${field('first', 'Imię', 'autocomplete="given-name" required')}
            ${field('last', 'Nazwisko', 'autocomplete="family-name" required')}
            ${field('email', 'E-mail', 'type="email" autocomplete="email" required inputmode="email"')}
            ${field('phone', 'Telefon', 'type="tel" autocomplete="tel" required inputmode="tel" placeholder="+48 600 000 000"')}
          </div>
          <label class="check"><input type="checkbox" name="invoice"${d.invoice ? ' checked' : ''}><span>Potrzebuję faktury na firmę</span></label>
          <div class="invoice" ${d.invoice ? '' : 'hidden'}>
            <div class="form-grid">
              <label class="field"><span>NIP</span><div class="nip"><input class="input" name="nip" value="${esc(d.nip || '')}" inputmode="numeric" maxlength="13" placeholder="10 cyfr"><button type="button" class="btn btn--ghost" id="gus">Pobierz z GUS</button></div><small class="field__err" data-err="nip"></small></label>
              ${field('company', 'Nazwa firmy', 'autocomplete="organization"')}
              ${field('address', 'Adres firmy', 'autocomplete="street-address"', true)}
            </div>
          </div>
        </form>

        <section class="block" id="payBlock">
          <div class="block__head"><h2>Płatność</h2>
            <div class="seg" role="radiogroup" aria-label="Kiedy płacisz">
              <button type="button" data-paynow="1" aria-pressed="${state.payNow}">Teraz <small>−5%</small></button>
              <button type="button" data-paynow="0" aria-pressed="${!state.payNow}">Przy odbiorze</button>
            </div></div>
          <div id="payModule" ${state.payNow ? '' : 'hidden'}></div>
          <div class="later" ${state.payNow ? 'hidden' : ''}>${ic('card')}<p>Zapłacisz kartą przy stanowisku, a kaucję zablokujemy na tej samej karcie. Płacąc teraz, zaoszczędziłbyś <b id="laterSave"></b>.</p></div>
        </section>

        <section class="block consents">
          <label class="check"><input type="checkbox" id="terms"><span>Akceptuję <a href="#/" onclick="return false">regulamin wynajmu</a> i <a href="#/" onclick="return false">politykę prywatności</a>. <em>wymagane</em></span></label>
          <label class="check"><input type="checkbox" id="news"><span>Chcę dostawać kody rabatowe — najwyżej jeden mail w miesiącu.</span></label>
          <p class="field__err" id="termsErr"></p>
        </section>

        <button type="button" class="btn btn--primary btn--xl pay-btn" id="payBtn"></button>
      </div>
      <aside class="summary" id="summary"></aside>
    </div>
  </section>`;

  const form = $('#driver');
  let q = renderSummary(car, { checkout: true });
  const payBtn = $('#payBtn');
  const label = () => {
    payBtn.innerHTML = state.payNow
      ? `${ic('lock')}<span>Zapłać ${zl(q.total)}</span>`
      : `<span>Rezerwuję — płacę ${zl(q.total)} przy odbiorze</span>`;
    const now = quote(car), later = (state.payNow ? now.total / 0.95 : now.total) * 0.05;
    $('#laterSave').textContent = zl0(later);
  };

  const pm = createPayment($('#payModule'), {
    amount: q.total,
    title: 'Rezerwacja auta · ' + car.name,
    payer: [d.first, d.last].filter(Boolean).join(' '),
    status: txt => { $('.pay-btn__txt', payBtn) && ($('.pay-btn__txt', payBtn).textContent = txt); },
  });

  $$('[data-paynow]').forEach(b => b.addEventListener('click', () => {
    state.payNow = b.dataset.paynow === '1';
    save();
    $$('[data-paynow]').forEach(x => x.setAttribute('aria-pressed', x.dataset.paynow === b.dataset.paynow));
    $('#payModule').hidden = !state.payNow;
    $('.later').hidden = state.payNow;
    q = renderSummary(car, { checkout: true });
    pm.setAmount(q.total);
    label();
  }));
  label();

  // keep driver details between visits (mock convenience)
  form.addEventListener('input', e => {
    const t = e.target;
    if (!t.name) return;
    state.driver[t.name] = t.type === 'checkbox' ? t.checked : t.value;
    if (t.name === 'invoice') $('.invoice').hidden = !t.checked;
    if (t.name === 'first' || t.name === 'last') pm.setPayer([form.first.value, form.last.value].filter(Boolean).join(' ').trim());
    const err = $(`[data-err="${t.name}"]`);
    if (err) { err.textContent = ''; t.classList.remove('is-bad'); }
    save();
  });
  form.invoice.addEventListener('change', () => { $('.invoice').hidden = !form.invoice.checked; });

  $('#gus').addEventListener('click', async () => {
    const nip = digits(form.nip.value);
    const err = $('[data-err="nip"]');
    if (nip.length !== 10) { err.textContent = 'NIP ma 10 cyfr.'; form.nip.classList.add('is-bad'); return; }
    const btn = $('#gus');
    btn.disabled = true;
    btn.textContent = 'Szukam…';
    await wait(900);
    form.company.value = 'Przykładowa Firma sp. z o.o.';
    form.address.value = 'ul. Testowa 1/2, 50-001 Wrocław';
    ['company', 'address', 'nip'].forEach(n => { state.driver[n] = form[n].value; });
    save();
    btn.disabled = false;
    btn.textContent = 'Pobrano ✓';
    toast('Dane firmy pobrane (symulacja GUS)', 'bank');
  });

  $('#terms').addEventListener('change', () => { $('#termsErr').textContent = ''; });

  payBtn.addEventListener('click', async () => {
    if (!validateDriver(form)) return;
    if (!$('#terms').checked) {
      $('#termsErr').textContent = 'Zaznacz akceptację regulaminu, żeby zarezerwować.';
      $('#terms').focus();
      return;
    }
    let payment = { method: 'later', label: 'Przy odbiorze' };
    payBtn.disabled = true;
    payBtn.classList.add('is-paying');
    payBtn.innerHTML = `<span class="road"><span class="road__car">${carFor(car, state.color || car.color, 'driving')}</span></span><span class="pay-btn__txt">${state.payNow ? 'Przygotowujemy płatność…' : 'Rezerwujemy auto…'}</span>`;
    if (state.payNow) {
      payment = await pm.pay();
    } else {
      await wait(1400);
    }
    if (!payment) {
      payBtn.disabled = false;
      payBtn.classList.remove('is-paying');
      label();
      $('#payBlock').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    payBtn.classList.add('is-paid');
    payBtn.innerHTML = `${ic('check')}<span>${state.payNow ? 'Opłacone' : 'Zarezerwowane'}</span>`;
    const b = createBooking(car, payment);
    await wait(700);
    go('#/rezerwacja/' + encodeURIComponent(b.ref));
  });
}

function validateDriver(form) {
  const rules = {
    first: v => v.trim().length >= 2 || 'Wpisz imię.',
    last: v => v.trim().length >= 2 || 'Wpisz nazwisko.',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Ten e-mail wygląda na niepełny.',
    phone: v => digits(v).replace(/^48/, '').length === 9 || 'Podaj 9-cyfrowy numer telefonu.',
  };
  if (form.invoice.checked) {
    rules.nip = v => digits(v).length === 10 || 'NIP ma 10 cyfr.';
    rules.company = v => v.trim().length >= 2 || 'Wpisz nazwę firmy.';
  }
  let first = null;
  Object.entries(rules).forEach(([name, rule]) => {
    const res = rule(form[name].value), err = $(`[data-err="${name}"]`);
    const bad = res !== true;
    form[name].classList.toggle('is-bad', bad);
    if (err) err.textContent = bad ? res : '';
    if (bad && !first) first = form[name];
  });
  if (first) first.focus();
  return !first;
}

function createBooking(car, payment) {
  const q = quote(car);
  const used = new Set(bookings.all().map(b => b.ref));
  let ref = newPlate();
  while (used.has(ref)) ref = newPlate();
  const color = state.color || car.color;
  const b = {
    ref, carId: car.id, color, colorName: (COLORS.find(c => c.hex === color) || { name: 'jak na zdjęciu' }).name,
    pickup: state.pickup, ret: state.oneWay ? state.ret : state.pickup, from: state.from, to: state.to,
    lines: q.lines, total: q.total, deposit: q.deposit, excess: q.excess, days: q.days, insurance: state.insurance,
    driver: { first: state.driver.first, last: state.driver.last, email: state.driver.email, phone: state.driver.phone, company: state.driver.invoice ? state.driver.company : '' },
    payNow: state.payNow, payment, status: 'confirmed', createdAt: Date.now(), checklist: {}, fresh: true,
  };
  bookings.save(b);
  state.promo = null;
  save();
  return b;
}

// ---------- booking ----------
const CHECKLIST = [
  ['license', 'Prawo jazdy', 'ważne co najmniej rok'],
  ['id', 'Dowód osobisty lub paszport', ''],
  ['card', 'Karta płatnicza na kaucję', 'kredytowa lub debetowa, na nazwisko kierowcy'],
  ['mood', 'Dobry humor', 'opcjonalnie, ale bardzo polecamy'],
];

function viewBooking(ref) {
  const b = bookings.get(ref);
  if (!b) { app.innerHTML = `<section class="wrap page empty"><p>Nie znaleźliśmy rezerwacji ${esc(ref || '')}.</p><a class="btn btn--primary" href="#/rezerwacje">Moje rezerwacje</a></section>`; return; }
  const car = CARS.find(c => c.id === b.carId);
  const pick = locById(b.pickup), ret = locById(b.ret);
  const cancelled = b.status === 'cancelled';
  const fresh = b.fresh;
  if (fresh) { b.fresh = false; bookings.save(b); }

  app.innerHTML = `
  <section class="wrap page done ${cancelled ? 'is-cancelled' : ''}">
    ${cancelled ? '' : steps(5)}
    <div class="done__hero">
      <div class="done__copy">
        <p class="eyebrow">${cancelled ? 'Rezerwacja anulowana' : b.payNow ? 'Opłacone · rezerwacja potwierdzona' : 'Rezerwacja potwierdzona'}</p>
        <h1>${cancelled ? 'Szkoda. Może innym razem.' : `Kluczyk czeka${b.driver.first ? ', ' + esc(b.driver.first) : ''}.`}</h1>
        <p class="muted">${cancelled
          ? `Zwrot ${zl(b.refund || 0)} wróci tą samą metodą płatności w 3–5 dni roboczych.`
          : `W prawdziwej wersji potwierdzenie przyszłoby na <b>${esc(b.driver.email || 'Twój e-mail')}</b> i SMS-em. Tu trzymamy je w przeglądarce.`}</p>
        <div class="done__ref"><span>Numer rezerwacji</span>${plateHTML(b.ref, fresh ? 'is-stamp' : '')}</div>
        ${cancelled ? '' : '<p class="countdown" id="countdown" aria-live="off"></p>'}
      </div>
      <div class="done__car">
        <div class="done__stage" id="doneCar">${carFor(car, b.color)}</div>
        ${cancelled ? '' : `
        <div class="fob">
          <div class="fob__btns">
            <button type="button" data-fob="unlock" aria-label="Otwórz">${ic('unlock')}</button>
            <button type="button" data-fob="lock" aria-label="Zamknij">${ic('lock')}</button>
            <button type="button" data-fob="trunk" aria-label="Bagażnik">${ic('trunk')}</button>
            <button type="button" data-fob="horn" aria-label="Klakson">${ic('horn')}</button>
          </div>
          <p class="fob__note">Cyfrowy kluczyk włączy się 15 min przed odbiorem. Na razie możesz go przetestować na sucho.</p>
        </div>`}
      </div>
    </div>

    <div class="done__grid">
      <article class="info">${ic('pin')}<div><p class="kicker">Odbiór</p><b>${pick.name}</b><p>${fmtLong(b.from)}, ${fmtTime(b.from)}</p><small>${pick.note}</small></div></article>
      <article class="info">${ic('undo')}<div><p class="kicker">Zwrot</p><b>${ret.name}</b><p>${fmtLong(b.to)}, ${fmtTime(b.to)}</p><small>Pierwsze 59 minut spóźnienia gratis.</small></div></article>
      <article class="info">${ic('card')}<div><p class="kicker">Płatność</p><b>${b.payNow ? `Opłacono ${zl(b.total)}` : `Do zapłaty ${zl(b.total)}`}</b><p>${esc(b.payment.label)}</p><small>Kaucja ${zl0(b.deposit)} — blokada przy odbiorze.</small></div></article>
      <article class="info info--list"><div><p class="kicker">Co zabrać</p>
        <ul class="todo">${CHECKLIST.map(([id, t, n]) => `<li><label class="check"><input type="checkbox" data-todo="${id}"${b.checklist[id] ? ' checked' : ''}${cancelled ? ' disabled' : ''}><span>${t}${n ? `<small>${n}</small>` : ''}</span></label></li>`).join('')}</ul></div></article>
    </div>

    <div class="done__actions">
      ${cancelled ? '<a class="btn btn--primary" href="#/auta">Zarezerwuj inne auto</a>' : `
      <button type="button" class="btn btn--dark" id="ics">${ic('cal')} Dodaj do kalendarza</button>
      <button type="button" class="btn btn--ghost" id="print">${ic('print')} Drukuj potwierdzenie</button>
      <button type="button" class="btn btn--ghost btn--danger" id="cancel">${ic('x')} Anuluj rezerwację</button>`}
    </div>

    <section class="receipt block">
      <div class="block__head"><h2>Rozliczenie</h2><p class="muted">${car.name} · kolor: ${esc(b.colorName)} · ${doby(b.days)} · ochrona „${(INSURANCE.find(i => i.id === b.insurance) || INSURANCE[0]).name}”</p></div>
      ${lineList(b.lines)}
      <p class="receipt__total"><span>Razem</span><b>${zl(b.total)}</b></p>
    </section>
  </section>`;

  const svg = $('#doneCar svg');
  if (fresh && svg) setTimeout(() => { flash(svg, 'blink', 2); sound.unlock(); }, 600);

  $$('[data-fob]').forEach(btn => btn.addEventListener('click', () => {
    const a = btn.dataset.fob;
    if (a === 'unlock') { sound.unlock(); flash(svg, 'blink', 1); svg.classList.remove('bounce'); void svg.offsetWidth; svg.classList.add('bounce'); }
    if (a === 'lock') { sound.lock(); flash(svg, 'blink', 2); }
    if (a === 'trunk') { sound.trunk(); flash(svg, 'blink', 3); }
    if (a === 'horn') { sound.horn(); flash(svg, 'lights', 2); }
    btn.classList.remove('is-hit'); void btn.offsetWidth; btn.classList.add('is-hit');
  }));

  $$('[data-todo]').forEach(i => i.addEventListener('change', () => {
    b.checklist[i.dataset.todo] = i.checked;
    bookings.save(b);
    if (CHECKLIST.every(([id]) => b.checklist[id])) toast('Wszystko spakowane. Szerokości!');
  }));

  const cd = $('#countdown');
  if (cd) {
    const tick = () => {
      const ms = b.from - Date.now();
      if (ms <= 0) { cd.innerHTML = `${ic('clock')} Odbiór trwa — kluczyk jest aktywny.`; return; }
      const dd = Math.floor(ms / DAY), hh = Math.floor(ms / 3600e3) % 24, mm = Math.floor(ms / 60e3) % 60, ss = Math.floor(ms / 1e3) % 60;
      cd.innerHTML = `${ic('clock')} Do odbioru: <b>${dd}</b> d <b>${String(hh).padStart(2, '0')}</b> h <b>${String(mm).padStart(2, '0')}</b> min <b>${String(ss).padStart(2, '0')}</b> s`;
    };
    tick();
    const t = setInterval(tick, 1000);
    onLeave(() => clearInterval(t));
  }

  const ics = $('#ics');
  if (ics) ics.addEventListener('click', () => downloadICS(b, car, pick, ret));
  const pr = $('#print');
  if (pr) pr.addEventListener('click', () => window.print());
  const cancel = $('#cancel');
  if (cancel) cancel.addEventListener('click', () => {
    const late = b.from - Date.now() < DAY;
    const refund = b.payNow ? Math.round(b.total * (late ? 0.5 : 1)) : 0;
    const m = modal({
      label: 'Anulowanie rezerwacji',
      html: `<div class="confirm">
        <h2>Anulować ${esc(b.ref)}?</h2>
        <p>${b.payNow
          ? late ? `Do odbioru zostało mniej niż 24 h, więc zwrócimy 50%: <b>${zl(refund)}</b>.` : `Zwrócimy całość: <b>${zl(refund)}</b>, tą samą metodą płatności.`
          : 'Nic nie zapłaciłeś, więc nic nie tracisz.'}</p>
        <div class="tds__row"><button type="button" class="btn btn--ghost" data-close>Zostawiam</button><button type="button" class="btn btn--danger-solid" id="doCancel">Tak, anuluj</button></div>
      </div>`,
    });
    $('#doCancel', m.el).addEventListener('click', () => {
      b.status = 'cancelled';
      b.refund = refund;
      bookings.save(b);
      m.close();
      toast('Rezerwacja anulowana', 'undo');
      route();
    });
  });
}

function downloadICS(b, car, pick, ret) {
  const stamp = ts => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ev = (uid, start, title, loc, desc) => [
    'BEGIN:VEVENT', `UID:${uid}@kluczyk.example`, `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(start + 30 * 60e3)}`,
    `SUMMARY:${title}`, `LOCATION:${loc}`, `DESCRIPTION:${desc}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM', 'END:VEVENT',
  ];
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kluczyk//Mock v1//PL', 'CALSCALE:GREGORIAN',
    ...ev(b.ref.replace(' ', '') + '-in', b.from, `Odbiór auta: ${car.name} (${b.ref})`, pick.name, `${pick.note}. Zabierz prawo jazdy\\, dowód i kartę na kaucję.`),
    ...ev(b.ref.replace(' ', '') + '-out', b.to, `Zwrot auta: ${car.name} (${b.ref})`, ret.name, 'Pierwsze 59 minut spóźnienia gratis.'),
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kluczyk-${b.ref.replace(' ', '')}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Plik kalendarza pobrany', 'cal');
}

// ---------- my bookings ----------
function viewBookings() {
  const list = bookings.all();
  app.innerHTML = `
  <section class="wrap page">
    <div class="section__head"><div><p class="eyebrow">Moje rezerwacje</p><h1 class="page__title">Twój garaż</h1></div>
      <a class="btn btn--primary" href="#/auta">Nowa rezerwacja ${ic('arrow')}</a></div>
    ${list.length ? `<div class="garage">${list.map(b => {
      const car = CARS.find(c => c.id === b.carId), past = b.to < Date.now();
      const status = b.status === 'cancelled' ? ['Anulowana', 'is-x'] : past ? ['Zakończona', 'is-past'] : [b.payNow ? 'Opłacona' : 'Płatna przy odbiorze', 'is-ok'];
      return `<a class="garage__item" href="#/rezerwacja/${encodeURIComponent(b.ref)}">
        <span class="garage__car">${carFor(car, b.color)}</span>
        <span class="garage__txt">${plateHTML(b.ref, 'plate--sm')}<b>${car.name}</b><small>${fmtDay(b.from)}, ${fmtTime(b.from)} → ${fmtDay(b.to)}, ${fmtTime(b.to)} · ${locById(b.pickup).short}</small></span>
        <span class="garage__right"><span class="status ${status[1]}">${status[0]}</span><b>${zl(b.total)}</b></span></a>`;
    }).join('')}</div>`
    : `<div class="empty">${carSVG('hatch', '#c9ccd2')}<p>Garaż pusty. Pierwsza rezerwacja z kodem <b>PIERWSZY</b> jest tańsza o 50 zł.</p><a class="btn btn--primary" href="#/auta">Wybierz auto</a></div>`}
  </section>`;
}

// ---------- router ----------
const VIEWS = { '': viewHome, auta: viewFleet, auto: viewCar, kasa: viewCheckout, rezerwacja: viewBooking, rezerwacje: viewBookings };
let leaving = [];
let pendingScroll = null;
const onLeave = fn => leaving.push(fn);

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  leaving.forEach(f => f());
  leaving = [];
  const [name = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
  const view = VIEWS[name] || viewHome;
  app.innerHTML = '';
  view(arg ? decodeURIComponent(arg) : undefined);
  $$('.nav a[data-nav]').forEach(a => a.classList.toggle('is-active', a.dataset.nav === name || (name === 'auto' && a.dataset.nav === 'auta')));
  const count = bookings.all().filter(b => b.status !== 'cancelled' && b.to > Date.now()).length;
  $('#bookingCount').hidden = !count;
  $('#bookingCount').textContent = count;
  if (pendingScroll && document.getElementById(pendingScroll)) {
    const el = document.getElementById(pendingScroll);
    pendingScroll = null;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth' }));
  } else {
    window.scrollTo(0, 0);
  }
}

$$('.nav a[data-scroll]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  const id = a.dataset.scroll, el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
  else { pendingScroll = id; go('#/'); }
}));

window.addEventListener('hashchange', route);

// ---------- theme: the headlight switch ----------
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && darkMQ.matches);
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  $('#themeBtn').setAttribute('aria-pressed', isDark());
}
applyTheme(store.get('kluczyk-theme', null));
darkMQ.addEventListener('change', () => applyTheme(store.get('kluczyk-theme', null)));
$('#themeBtn').addEventListener('click', () => {
  const t = isDark() ? 'light' : 'dark';
  store.set('kluczyk-theme', t);
  applyTheme(t);
  sound.unlock();
  toast(t === 'dark' ? 'Światła włączone — tryb nocny' : 'Światła wyłączone — dzień dobry', 'spark');
});

// ---------- secrets: rally mode + the Maluch ----------
function unlockSecret(fromCode) {
  const first = !state.secret;
  state.secret = true;
  save();
  sound.horn();
  toast(first ? 'Sekretny garaż otwarty: we flocie stoi Maluch 126p' : 'Maluch już na Ciebie czeka w sekretnym garażu', 'spark');
  if (fromCode && first) setTimeout(() => { state.cat = 'secret'; save(); go('#/auta'); }, 900);
  else if (location.hash.startsWith('#/auta')) { renderFilters(); renderCars(); }
}

function setRally(on) {
  state.rally = on;
  save();
  document.body.classList.toggle('rally', on);
}
setRally(state.rally);

function toggleRally() {
  setRally(!state.rally);
  if (state.rally) unlockSecret(false);
  else toast('Tryb rajdowy wyłączony. Jedziemy przepisowo.', 'shield');
}

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let kpos = 0;
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  kpos = k === KONAMI[kpos] ? kpos + 1 : k === KONAMI[0] ? 1 : 0;
  if (kpos === KONAMI.length) { kpos = 0; toggleRally(); }
});

// five quick taps on the logo do the same on phones
let taps = [];
$('#logo').addEventListener('click', () => {
  const now = Date.now();
  taps = taps.filter(t => now - t < 2000).concat(now);
  $('#logo').classList.remove('is-turn'); void $('#logo').offsetWidth; $('#logo').classList.add('is-turn');
  if (taps.length >= 5) { taps = []; toggleRally(); }
});

// ---------- demo bar: test data ----------
$('#testData').innerHTML = `
  <div class="wrap test-data__in">
    <div><p class="test-data__t">Karty</p><ul>${TEST_CARDS.map(c => `<li><code>${c.number}</code> ${c.result}</li>`).join('')}</ul>
      <p class="test-data__s">Data ważności: dowolna przyszła · CVC: dowolne 3 cyfry</p></div>
    <div><p class="test-data__t">BLIK</p><ul><li><code>dowolne 6 cyfr</code> potwierdzasz w „telefonie”</li><li><code>000 000</code> kod wygasł</li></ul>
      <p class="test-data__t">Kody rabatowe</p><ul>${Object.values(PROMOS).map(p => `<li><code>${p.label.split(' · ')[0]}</code> ${p.label.split(' · ')[1]}</li>`).join('')}</ul></div>
    <div><p class="test-data__t">Sekrety</p><ul><li><code>MALUCH</code> jako kod rabatowy</li><li><code>↑ ↑ ↓ ↓ ← → ← → B A</code> tryb rajdowy</li><li><code>5× logo</code> to samo na telefonie</li></ul>
      <button type="button" class="btn btn--ghost btn--sm" id="resetMock">Wyczyść dane mocka</button></div>
  </div>`;
$('#testDataBtn').addEventListener('click', () => {
  const box = $('#testData'), open = box.hidden;
  box.hidden = !open;
  $('#testDataBtn').setAttribute('aria-expanded', open);
});
$('#resetMock').addEventListener('click', () => {
  [KEY, BOOKINGS, 'kluczyk-theme', 'kluczyk-pay-method'].forEach(store.drop);
  location.hash = '#/';
  location.reload();
});

route();
