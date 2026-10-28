// Kluczyk v4 — Marta's garage wall: the fleet hangs on a key board, a car page reads like its papers,
// and the booking is a receipt. Same flow as v3: pick dates, take a key, pay, done.

const app = $('#app');
const KEY = 'kluczyk-v4';
const BOOKINGS = 'kluczyk-v4-bookings';

// ---------- dates ----------
const dayStart = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return +d; };
const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return +d; };
const daysBetween = (a, b) => Math.round((dayStart(b) - dayStart(a)) / DAY);
const fmtShort = ts => new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
const fmtStamp = ts => new Date(ts).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

function withTime(dayTs, hhmm) {
  const d = new Date(dayTs), [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return +d;
}

// seeded busy days are counted from the next Friday, so the demo weekend always has a key or two missing
const ANCHOR = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return +d; })();

// first slot Marta can hand a car over: two hours from now, inside 8:00–20:00, on a full or half hour
function earliest() {
  const d = new Date(Date.now() + 2 * 3600e3), m = d.getMinutes();
  d.setMinutes(m === 0 ? 0 : m <= 30 ? 30 : 60, 0, 0);
  if (d.getHours() < HOURS.open) d.setHours(HOURS.open, 0);
  if (d.getHours() * 60 + d.getMinutes() > HOURS.close * 60) { d.setDate(d.getDate() + 1); d.setHours(HOURS.open, 0); }
  return +d;
}

// ---------- state ----------
function loadState() {
  const s = Object.assign({
    from: withTime(ANCHOR, '10:00'), to: withTime(addDays(ANCHOR, 3), '10:00'),
    place: 'garage', protection: 'std', extras: {}, driver: {}, carId: null,
  }, store.get(KEY, {}));
  if (s.from < earliest()) Object.assign(s, { from: withTime(ANCHOR, '10:00'), to: withTime(addDays(ANCHOR, 3), '10:00') });
  return s;
}

const state = loadState();
const save = () => store.set(KEY, state);

function fixDates() {
  const e = earliest();
  if (state.from < e) state.from = e;
  if (state.to - state.from < 3600e3) state.to = withTime(addDays(state.from, 1), fmtTime(state.from));
}

const bookings = {
  all: () => store.get(BOOKINGS, []),
  get: no => bookings.all().find(b => String(b.no) === String(no)),
  save(b) {
    const list = bookings.all().filter(x => x.no !== b.no);
    list.unshift(b);
    store.set(BOOKINGS, list);
  },
};

// ---------- availability ----------
const carById = id => CARS.find(c => c.id === id);
const placeById = id => PLACES.find(p => p.id === id) || PLACES[0];
const protById = id => PROTECTION.find(p => p.id === id) || PROTECTION[0];

// [first day, last day] the car is out, as day-start timestamps; the pick-up and return days both count
function busyRanges(car) {
  const seeded = car.busy.map(([a, b]) => [addDays(ANCHOR, a), addDays(ANCHOR, b)]);
  const booked = bookings.all().filter(b => b.carId === car.id && b.status !== 'cancelled').map(b => [dayStart(b.from), dayStart(b.to)]);
  return seeded.concat(booked).sort((x, y) => x[0] - y[0]);
}

const isBusyDay = (car, day) => busyRanges(car).some(([a, b]) => day >= a && day <= b);

function conflict(car, from = state.from, to = state.to) {
  const a = dayStart(from), b = dayStart(to);
  return busyRanges(car).find(([x, y]) => x <= b && y >= a);
}

// first day from which a rental of the same length fits
function nextFree(car) {
  const len = daysBetween(state.from, state.to);
  let start = dayStart(state.from);
  for (let i = 0; i < 30; i++) {
    const c = busyRanges(car).find(([x, y]) => x <= addDays(start, len) && y >= start);
    if (!c) return start;
    start = addDays(c[1], 1);
  }
  return null;
}

// ---------- pricing ----------
const rentalDays = (from = state.from, to = state.to) => Math.max(1, Math.ceil((to - from - 59 * 60e3) / DAY));
const longDiscount = days => (days >= 7 ? 0.2 : days >= 3 ? 0.1 : 0);

function quote(car, full = true) {
  const days = rentalDays(), lines = [];
  const base = car.price * days;
  lines.push({ label: `${doby(days)} × ${car.price} zł`, amount: base });
  const ld = longDiscount(days);
  if (ld) lines.push({ label: `Od ${ld === 0.2 ? 7 : 3} dób −${ld * 100}%`, amount: -Math.round(base * ld), good: true });
  let deposit = car.deposit;
  if (full) {
    const place = placeById(state.place), prot = protById(state.protection);
    if (place.fee) lines.push({ label: place.name, amount: place.fee });
    if (prot.perDay) lines.push({ label: `Ochrona „${prot.name}”`, amount: prot.perDay * days });
    if (prot.deposit) deposit = prot.deposit;
    EXTRAS.forEach(x => {
      if (state.extras[x.id]) lines.push({ label: x.name, amount: x.per === 'day' ? Math.min(x.price * days, x.cap) : x.price });
    });
  }
  return { days, lines, total: sum(lines), deposit };
}

// ---------- shared bits ----------
const lineList = lines => `<ul class="lines">${lines.map(l =>
  `<li class="${l.good ? 'is-good' : ''}"><span>${esc(l.label)}</span><i></i><span>${l.amount < 0 ? '−' : ''}${zl(Math.abs(l.amount))}</span></li>`).join('')}</ul>`;

const telHref = 'tel:' + OWNER.phone.replace(/\s/g, '');
const shortModel = car => `${car.model.replace('Tesla ', '')} ${car.trim}`;
const polaroid = (car, cls = '') => `<figure class="pol ${cls}" style="--tilt:${car.tilt}deg">${carFor(car)}<figcaption>${car.nick}</figcaption></figure>`;
const receiptHead = () => `<p class="receipt__head"><b>KLUCZYK · ${OWNER.name.toUpperCase()}</b>ul. Kluczykowa 3, Wrocław-Krzyki<br>tel. ${OWNER.phone}</p>`;

// Rolling odometer digits for the total.
function odometer(el, amount) {
  const text = zl(amount);
  if (el.dataset.len !== String(text.length)) {
    el.dataset.len = text.length;
    el.innerHTML = [...text].map(ch => /\d/.test(ch)
      ? `<span class="odo__d"><span class="odo__s">${'0123456789'.split('').map(n => `<span>${n}</span>`).join('')}</span></span>`
      : `<span class="odo__c">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
    void el.offsetWidth;
  }
  const strips = $$('.odo__s', el);
  [...text].filter(ch => /\d/.test(ch)).forEach((n, i) => { strips[i].style.transform = `translateY(${-n}em)`; });
  el.setAttribute('aria-label', text);
}

// What Marta is up to right now — a one-person business has a person behind it.
function ownerNow(d = new Date()) {
  const h = d.getHours();
  if (h < 7) return { on: false, text: 'śpi, ale przy awarii i tak odbierze' };
  if (h < HOURS.open) return { on: false, text: 'ładuje auta na cały dzień' };
  if (h >= 22) return { on: false, text: 'po pracy, odpisze rano' };
  if (h >= HOURS.close) return { on: true, text: 'po pracy, ale na SMS-y odpisuje do 22:00' };
  const day = [
    'wydaje Śnieżkę na Krzykach', 'jedzie Kluską na lotnisko', 'myje Szprotkę po weekendzie',
    'odbiera Jagodę spod Hali Stulecia', 'siedzi przy telefonie', 'tłumaczy komuś jazdę jednym pedałem',
  ];
  return { on: true, text: day[(h + d.getDay()) % day.length] };
}

// Karta auta: the facts laid out like the fields of a Polish registration certificate.
function docHTML(car) {
  const rows = [
    ['A', 'Numer rejestracyjny', car.plate], ['B', 'Rocznik', car.year],
    ['D.1', 'Marka', 'TESLA'], ['D.3', 'Model', shortModel(car).toUpperCase()],
    ['R', 'Kolor', car.color], ['S.1', 'Miejsca', car.seats], ['P.3', 'Paliwo', 'EE — prąd'],
    ['M.1', 'Zasięg', `${car.range} km`], ['M.2', 'Bagażniki', `${car.trunk} l`],
    ['M.3', 'Przebieg', `${car.km.toLocaleString('pl-PL')} km`], ['M.4', 'Hak', car.towbar ? 'jest' : 'brak'],
  ];
  return `<div class="doc">
    <p class="doc__head"><b>Karta auta</b><span>pola A–S jak w dowodzie rejestracyjnym, pola M dopisała Marta</span></p>
    <dl class="doc__grid">${rows.map(([code, label, val]) => `<div><dt><i>${code}</i>${label}</dt><dd>${val}</dd></div>`).join('')}</dl>
  </div>`;
}

// ---------- dates as a sentence + calendar ----------
function timeOptions(selected) {
  let out = '';
  for (let m = HOURS.open * 60; m <= HOURS.close * 60; m += 30) {
    const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    out += `<option${t === selected ? ' selected' : ''}>${t}</option>`;
  }
  return out;
}

function whenLine({ car, onChange, lead }) {
  const el = document.createElement('p');
  el.className = 'when';
  const blank = (which, label) => `<span class="blank"><button type="button" class="blank__day" data-cal data-day="${which}" aria-label="Dzień ${label}"></button><select class="blank__time" name="${which}Time" aria-label="Godzina ${label}"></select></span>`;
  el.innerHTML = `${lead} od ${blank('from', 'odbioru')} do ${blank('to', 'zwrotu')}.`;
  const fromT = $('[name="fromTime"]', el), toT = $('[name="toTime"]', el);
  const paint = () => {
    $('[data-day="from"]', el).textContent = fmtDay(state.from);
    $('[data-day="to"]', el).textContent = fmtDay(state.to);
    fromT.innerHTML = timeOptions(fmtTime(state.from));
    toT.innerHTML = timeOptions(fmtTime(state.to));
  };
  const changed = () => { fixDates(); save(); paint(); onChange(); };
  fromT.addEventListener('change', () => { state.from = withTime(state.from, fromT.value); changed(); });
  toT.addEventListener('change', () => { state.to = withTime(state.to, toT.value); changed(); });
  $$('[data-cal]', el).forEach(b => b.addEventListener('click', () => openCalendar(car, changed)));
  paint();
  el.repaint = paint;
  return el;
}

function openCalendar(car, onDone) {
  const first = dayStart(earliest());
  let a = dayStart(state.from), b = dayStart(state.to), picking = 'start', msg = '';
  let view = new Date(a);
  view.setDate(1);

  const m = modal({
    cls: 'modal--cal', label: 'Wybierz termin',
    html: `
    <div class="cal">
      <div class="cal__head">
        <div><p class="cal__t">${car ? `Kalendarz: ${esc(car.nick)}` : 'Kiedy?'}</p><p class="cal__sum" aria-live="polite"></p></div>
        <button type="button" class="icon-btn" data-close aria-label="Zamknij">${ic('x')}</button>
      </div>
      <div class="cal__nav">
        <button type="button" class="icon-btn" data-step="-1" aria-label="Poprzedni miesiąc">${ic('back')}</button>
        <button type="button" class="icon-btn" data-step="1" aria-label="Następny miesiąc">${ic('arrow')}</button>
      </div>
      <div class="cal__months"></div>
      <div class="cal__foot">
        <p class="cal__legend">${car ? `<span class="lg"></span>skreślone: ${esc(car.nick)} jest wtedy u kogoś` : 'Wolne klucze zobaczysz na tablicy.'}</p>
        <button type="button" class="btn btn--ink" data-ok>Zatwierdź</button>
      </div>
    </div>`,
  });

  const monthHTML = start => {
    const y = start.getFullYear(), mo = start.getMonth();
    const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    const count = new Date(y, mo + 1, 0).getDate();
    let cells = '<span></span>'.repeat(lead);
    for (let d = 1; d <= count; d++) {
      const ts = +new Date(y, mo, d), busy = car && isBusyDay(car, ts), past = ts < first;
      const cls = [
        past && 'is-past', busy && 'is-busy', ts === dayStart(Date.now()) && 'is-today',
        ts === a && 'is-start', b && ts === b && 'is-end', b && ts > a && ts < b && 'is-in',
      ].filter(Boolean).join(' ');
      const label = `${d} ${start.toLocaleDateString('pl-PL', { month: 'long' })}${busy ? ', zajęte' : ''}`;
      cells += `<button type="button" class="cal__d ${cls}" data-ts="${ts}" ${past || busy ? 'disabled' : ''} aria-label="${esc(label)}"><b>${d}</b></button>`;
    }
    const name = start.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
    return `<div class="cal__m"><p class="cal__title">${name}</p>
      <div class="cal__grid"><i>pn</i><i>wt</i><i>śr</i><i>cz</i><i>pt</i><i>sb</i><i>nd</i>${cells}</div></div>`;
  };

  const render = () => {
    const second = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    $('.cal__months', m.el).innerHTML = monthHTML(view) + monthHTML(second);
    const now = new Date(first);
    $('[data-step="-1"]', m.el).disabled = view <= new Date(now.getFullYear(), now.getMonth(), 1);
    $('.cal__sum', m.el).innerHTML = msg
      ? `<span class="cal__msg">${msg}</span>`
      : b ? `<b>${fmtDay(a)}</b> → <b>${fmtDay(b)}</b> · ${doby(rentalDays(withTime(a, fmtTime(state.from)), withTime(b, fmtTime(state.to))))}`
        : `<b>${fmtDay(a)}</b> → wybierz dzień zwrotu`;
    $('[data-ok]', m.el).disabled = !b;
    $$('.cal__d:not(:disabled)', m.el).forEach(btn => btn.addEventListener('click', () => {
      const ts = +btn.dataset.ts;
      msg = '';
      if (picking === 'start' || ts < a) { a = ts; b = null; picking = 'end'; } else if (car && conflict(car, a, ts)) {
        msg = `W tych dniach ${esc(car.nick)} jest zajęta. Zacznij od innego dnia.`;
        a = ts; b = null;
      } else { b = ts; picking = 'start'; }
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
    m.close();
    onDone();
  });
  render();
}

// ---------- home: the key board ----------
function viewHome() {
  const now = ownerNow();
  app.innerHTML = `
  <section class="wrap intro">
    <div class="intro__copy">
      <h1 class="intro__title">Tesle <em>od Marty</em>.</h1>
      <p class="intro__lead">Sześć aut, jeden garaż na Krzykach i jedna osoba, która odbiera telefon. Wynajmuję od ${OWNER.since} roku i każde auto wydaję sama.</p>
      <form class="ask" id="ask"><div id="whenSlot"></div>
        <button class="btn btn--ink" type="submit">Pokaż wolne klucze ${ic('arrow')}</button></form>
    </div>
    <aside class="note note--hello" style="--tilt:2.5deg">
      <p class="note__hand">Cześć! Masz pytanie? Dzwoń, odbieram sama.</p>
      <a class="note__phone" href="${telHref}">${OWNER.phone.replace('+48 ', '')}</a>
      <p class="note__now"><i class="dot ${now.on ? 'is-on' : ''}"></i>teraz: ${now.text}</p>
      <p class="note__sig">— ${OWNER.first}</p>
    </aside>
  </section>

  <section class="wrap" id="tablica">
    <div class="board__head"><h2>Tablica z kluczami</h2><p id="boardSum" aria-live="polite"></p></div>
    <div class="board" id="board"></div>
    <p class="board__legend"><span>${ic('check')} klucz na haczyku: auto wolne w Twoim terminie</span><span><i class="lg-note"></i> karteczka: auto jest u kogoś</span></p>
  </section>

  <section class="wrap how" id="jak">
    <h2>Jak to wygląda</h2>
    <ol>
      <li><b>Zdejmujesz klucz z tablicy.</b> Wybierasz termin i auto, płacisz BLIK-iem albo kartą. Minuta roboty.</li>
      <li><b>Spotykamy się przy aucie.</b> U mnie na Krzykach, pod Twoim domem albo na lotnisku. Pięć minut pokazywania i jedziesz.</li>
      <li><b>Oddajesz klucz.</b> Z co najmniej 20% baterii, bez szukania stacji. Kaucję odblokowuję od razu.</li>
    </ol>
  </section>

  <section class="wrap prices" id="cennik">
    <div class="sheet">
      <p class="sheet__title">Cennik</p>
      <p class="sheet__sub">za dobę · ubezpieczenie i kilometry bez limitu w cenie</p>
      <div class="sheet__row sheet__row--head"><span></span><i></i><span>1–2 doby</span><span>od 3</span><span>od 7</span></div>
      ${CARS.map(c => `<a class="sheet__row" href="#/auto/${c.id}" style="--tag:${c.tag}"><span><b>${c.nick}</b> <small>${shortModel(c)}</small></span><i></i>
        <span>${c.price}</span><span>${Math.round(c.price * 0.9)}</span><span>${Math.round(c.price * 0.8)}</span></a>`).join('')}
      <p class="sheet__k">Dopłaty</p>
      ${PLACES.filter(p => p.fee).map(p => `<div class="sheet__row sheet__row--x"><span>${p.name}</span><i></i><span>${p.fee} zł</span></div>`).join('')}
      <div class="sheet__row sheet__row--x"><span>Ochrona „${PROTECTION[1].name}”</span><i></i><span>${PROTECTION[1].perDay} zł / doba</span></div>
      ${EXTRAS.map(x => `<div class="sheet__row sheet__row--x"><span>${x.name}</span><i></i><span>${x.price} zł${x.per === 'day' ? ' / doba' : ''}</span></div>`).join('')}
      <p class="sheet__hand">Kaucja 2000–6000 zł, tylko blokada na karcie. — M.</p>
    </div>
    <div class="incl">
      <h2>W cenie, zawsze</h2>
      <ul>
        <li>OC, AC i assistance 24/7 w całej UE</li>
        <li>Bez limitu kilometrów</li>
        <li>Auto umyte i naładowane do 90%</li>
        <li>Godzina spóźnienia przy zwrocie</li>
        <li>Mój numer telefonu, o każdej porze, gdy coś się dzieje</li>
      </ul>
    </div>
  </section>

  <section class="wrap faq" id="faq">
    <h2>Pytania, które słyszę najczęściej</h2>
    <div class="faq__list">
      <details><summary>Pierwszy raz w Tesli. Dam radę?</summary><p>Tak. Przy odbiorze pokażę Ci jazdę jednym pedałem, lusterka na ekranie i podłączanie ładowarki. Zwykle wystarcza pięć minut, a potem i tak możesz do mnie zadzwonić.</p></details>
      <details><summary>Muszę oddać auto naładowane?</summary><p>Nie. Dostajesz je z 90% baterii, oddajesz z co najmniej 20%. Jeśli zostanie mniej, doładuję po kosztach prądu, bez prowizji.</p></details>
      <details><summary>Jak działa kaucja?</summary><p>Przy odbiorze blokuję ją na Twojej karcie — nie pobieram. Zdejmuję blokadę od razu po zwrocie, a bank zwalnia środki zwykle w 1–3 dni.</p></details>
      <details><summary>Mogę wyjechać za granicę?</summary><p>Tak, w całej UE, bez dopłat. Napisz mi tylko w wiadomości do rezerwacji, dokąd jedziesz — przygotuję upoważnienie.</p></details>
      <details><summary>Co, jeśli coś się zepsuje w trasie?</summary><p>Dzwonisz do mnie, o każdej porze. Assistance jest w cenie, a jeśli auto nie nadaje się do jazdy, przywiozę Ci inne.</p></details>
      <details><summary>Skąd są zdjęcia aut?</summary><p>Z Wikimedia Commons, wszystkie w domenie publicznej (CC0). Autorów znajdziesz pod zdjęciem na stronie auta i w stopce.</p></details>
    </div>
  </section>

  <section class="wrap contact" id="kontakt">
    <div class="contact__txt">
      <h2>Najszybciej: telefon albo SMS</h2>
      <p class="muted">Odbieram sama, codziennie ${HOURS.open}:00–${HOURS.close}:00. Przy awarii w trasie dzwoń o każdej porze.</p>
      <div class="contact__btns">
        <a class="btn btn--ink" href="${telHref}">${ic('call')} Zadzwoń</a>
        <a class="btn btn--line" href="sms:${OWNER.phone.replace(/\s/g, '')}">${ic('msg')} Napisz SMS</a>
      </div>
    </div>
    <div class="bizcard" aria-label="Wizytówka">
      <p class="bizcard__logo">kluczyk</p>
      <p class="bizcard__name">${OWNER.name}<small>wynajem Tesli, właścicielka i kierowca dostawczy</small></p>
      <p class="bizcard__lines">${OWNER.phone}<br>${OWNER.email}<br>${PLACES[0].where.split(',')[0]}, Wrocław</p>
    </div>
  </section>`;

  $('#whenSlot').append(whenLine({ lead: 'Potrzebuję auta', onChange: renderBoard }));
  $('#ask').addEventListener('submit', e => {
    e.preventDefault();
    $('#tablica').scrollIntoView({ behavior: 'smooth' });
  });
  renderBoard();
}

function renderBoard() {
  const free = CARS.filter(c => !conflict(c)).length;
  $('#boardSum').innerHTML = `${fmtDay(state.from)} → ${fmtDay(state.to)}: na haczykach wisi <b>${free} z ${CARS.length}</b> kluczy.`;
  $('#board').innerHTML = CARS.map(c => {
    const taken = conflict(c), q = quote(c, false), back = taken && nextFree(c);
    return `<a class="slot ${taken ? 'is-taken' : ''}" href="#/auto/${c.id}" aria-label="${esc(c.nick)}, ${shortModel(c)}: ${taken ? 'zajęta' : 'wolna, ' + zl0(q.total) + ' za ' + doby(q.days)}">
      ${polaroid(c)}
      ${taken
        ? `<span class="gone" aria-hidden="true"><i class="key__hook"></i><span class="gone__note">u klienta${back ? `<br>wolna od ${fmtShort(back).replace(' ', '&nbsp;')}` : ''}</span></span>`
        : keyHTML(c, zl0(q.total), 'za ' + doby(q.days))}
      <span class="dymo">${shortModel(c)} · ${c.price} zł/doba</span>
    </a>`;
  }).join('');
}

// ---------- car ----------
function viewCar(id) {
  const car = carById(id);
  if (!car) { go('#/'); return; }
  state.carId = car.id;
  save();

  const option = (type, name, value, checked, title, sub, price) =>
    `<label class="opt"><input type="${type}" name="${name}" value="${value}"${checked ? ' checked' : ''}>
      <span class="opt__txt"><b>${title}</b><small>${sub}</small></span><span class="opt__price">${price}</span></label>`;

  app.innerHTML = `
  <section class="wrap page">
    <a class="back" href="#/">${ic('back')} Tablica z kluczami</a>
    <div class="detail">
      <div class="detail__main">
        <button type="button" class="print" id="stage" aria-label="Zatrąb i mrugnij światłami">${carFor(car)}<span class="print__hint">kliknij, żeby zatrąbić</span></button>
        <p class="credit">${photoCredit(car)}</p>
        <div class="detail__head">
          <div><h1 class="detail__title">${car.nick}</h1><span class="dymo">${car.model} ${car.trim}</span></div>
          ${keyHTML(car, `${car.price} zł`, 'za dobę', 'key--side')}
        </div>
        <div class="note note--car" style="--tilt:-1deg"><p class="note__hand">${car.note}</p><p class="note__sig">— ${OWNER.first}</p></div>
        ${docHTML(car)}
      </div>

      <aside class="book">
        <form class="receipt" id="bookForm">
          ${receiptHead()}
          <div id="whenSlot"></div>
          <p class="avail" id="avail" aria-live="polite"></p>
          <fieldset class="opts"><legend>Odbiór</legend>
            ${PLACES.map(p => option('radio', 'place', p.id, state.place === p.id, p.name, p.where, p.fee ? `+${p.fee} zł` : 'gratis')).join('')}
          </fieldset>
          <fieldset class="opts"><legend>Ochrona</legend>
            ${PROTECTION.map(p => option('radio', 'protection', p.id, state.protection === p.id, p.name, p.text(car), p.perDay ? `+${p.perDay} zł/doba` : 'w cenie')).join('')}
          </fieldset>
          <fieldset class="opts"><legend>Dodatki</legend>
            ${EXTRAS.map(x => option('checkbox', 'extra', x.id, state.extras[x.id], x.name, x.note, `+${x.price} zł${x.per === 'day' ? '/doba' : ''}`)).join('')}
          </fieldset>
          <div id="totals"></div>
          <button type="submit" class="btn btn--ink btn--block btn--lg" id="toCheckout">Biorę ten klucz ${ic('arrow')}</button>
        </form>
      </aside>
    </div>
  </section>
  <div class="mobile-cta" id="mobileCta"><span><small>Razem</small><b></b></span><button type="button" class="btn btn--ink">Biorę ten klucz</button></div>`;

  const stage = $('#stage');
  stage.addEventListener('click', () => { sound.horn(); flash($('.photo', stage), 'lights', 2); });

  const when = whenLine({ car, lead: `Biorę ${car.nick}`.replace(/a$/, 'ę'), onChange: () => renderBook(car) });
  $('#whenSlot').append(when);
  const form = $('#bookForm');
  form.addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'place') state.place = t.value;
    if (t.name === 'protection') state.protection = t.value;
    if (t.name === 'extra') state.extras[t.value] = t.checked;
    save();
    renderBook(car);
  });
  form.addEventListener('submit', e => { e.preventDefault(); if (!conflict(car)) go('#/kasa'); });
  $('#mobileCta button').addEventListener('click', () => {
    if (conflict(car)) { $('#avail').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    go('#/kasa');
  });
  // the "move my dates" button lives inside #avail, which gets re-rendered
  $('#avail').addEventListener('click', e => {
    if (!e.target.closest('[data-shift]')) return;
    const start = nextFree(car), len = daysBetween(state.from, state.to);
    state.from = withTime(start, fmtTime(state.from));
    state.to = withTime(addDays(start, len), fmtTime(state.to));
    save();
    when.repaint();
    renderBook(car);
    toast(`Termin przesunięty: ${fmtDay(state.from)} → ${fmtDay(state.to)}`, 'cal');
  });
  renderBook(car);
}

function renderBook(car) {
  const taken = conflict(car), q = quote(car);
  const back = taken && nextFree(car);
  const avail = $('#avail');
  avail.className = 'avail ' + (taken ? 'is-taken' : 'is-free');
  avail.innerHTML = taken
    ? `<span>${car.nick} jest u kogoś od ${fmtShort(taken[0])} do ${fmtShort(taken[1])}.</span>${back ? `<button type="button" class="link" data-shift>Przesuń na ${fmtShort(back)} → ${fmtShort(addDays(back, daysBetween(state.from, state.to)))}</button>` : ''}`
    : `<span>${ic('check')}Klucz wisi — wolna w tym terminie.</span>`;
  $('#totals').innerHTML = `
    ${lineList(q.lines)}
    <div class="total"><span>Suma PLN</span><b class="odo" id="odo"></b></div>
    <p class="dep">Kaucja ${zl0(q.deposit)} — blokada na karcie przy odbiorze, nie pobieram.</p>`;
  odometer($('#odo'), q.total);
  $('#toCheckout').disabled = !!taken;
  $('#mobileCta b').textContent = taken ? 'zajęta' : zl(q.total);
}

// ---------- checkout ----------
function viewCheckout() {
  const car = carById(state.carId);
  if (!car) { go('#/'); return; }
  if (conflict(car)) { go('#/auto/' + car.id); return; }
  const q = quote(car), d = state.driver, place = placeById(state.place);
  const field = (name, label, attrs = '', wide = false) =>
    `<label class="field ${wide ? 'field--wide' : ''}"><span>${label}</span><input class="input" name="${name}" value="${esc(d[name] || '')}" ${attrs}><small class="field__err" data-err="${name}"></small></label>`;

  app.innerHTML = `
  <section class="wrap page">
    <a class="back" href="#/auto/${car.id}">${ic('back')} ${car.nick}</a>
    <div class="detail">
      <div class="detail__main">
        <h1 class="page__title">Kto odbiera klucz?</h1>
        <form class="form" id="driver" novalidate>
          <div class="form-grid">
            ${field('name', 'Imię i nazwisko', 'autocomplete="name" required', true)}
            ${field('phone', 'Telefon — na niego napiszę', 'type="tel" autocomplete="tel" required inputmode="tel" placeholder="600 000 000"')}
            ${field('email', 'E-mail', 'type="email" autocomplete="email" required inputmode="email"')}
            <label class="field field--wide"><span>Wiadomość do mnie <em>(opcjonalnie)</em></span>
              <textarea class="input" name="note" rows="2" placeholder="Np. numer lotu, wiek dziecka do fotelika albo dokąd jedziesz">${esc(d.note || '')}</textarea></label>
          </div>
          <p class="hint">${ic('card')} Prawo jazdy i dowód pokażesz mi przy aucie — tutaj ich nie wpisujesz.</p>
        </form>

        <section class="paybox" id="payBlock">
          <h2>Płatność</h2>
          <div id="payModule"></div>
        </section>

        <label class="check terms"><input type="checkbox" id="terms"><span>Akceptuję <a href="#/" onclick="return false">warunki najmu</a> — jedna strona, bez drobnego druku. Do 48 h przed odbiorem odwołasz za darmo.</span></label>
        <p class="field__err" id="termsErr"></p>
        <button type="button" class="btn btn--ink btn--xl pay-btn" id="payBtn">${ic('lock')}<span>Zapłać ${zl(q.total)}</span></button>
      </div>

      <aside class="book">
        <div class="receipt">
          ${receiptHead()}
          <div class="sum__car">${carFor(car)}<div><b>${car.nick}</b><small>${shortModel(car)} · ${car.plate}</small></div></div>
          <dl class="sum__when">
            <div><dt>Odbiór</dt><dd>${fmtDay(state.from)}, ${fmtTime(state.from)}</dd></div>
            <div><dt>Zwrot</dt><dd>${fmtDay(state.to)}, ${fmtTime(state.to)}</dd></div>
            <div><dt>Gdzie</dt><dd>${place.name}</dd></div>
          </dl>
          ${lineList(q.lines)}
          <div class="total"><span>Suma PLN</span><b class="odo" id="odo"></b></div>
          <p class="dep">Kaucja ${zl0(q.deposit)} — blokada na karcie przy odbiorze.</p>
        </div>
      </aside>
    </div>
  </section>`;
  odometer($('#odo'), q.total);

  const form = $('#driver'), payBtn = $('#payBtn');
  const pm = createPayment($('#payModule'), {
    amount: q.total,
    payer: d.name || '',
    status: txt => { const t = $('.pay-btn__txt', payBtn); if (t) t.textContent = txt; },
  });

  // keep the driver's details between visits (mock convenience)
  form.addEventListener('input', e => {
    const t = e.target;
    if (!t.name) return;
    state.driver[t.name] = t.value;
    if (t.name === 'name') pm.setPayer(t.value.trim());
    const err = $(`[data-err="${t.name}"]`);
    if (err) { err.textContent = ''; t.classList.remove('is-bad'); }
    save();
  });
  $('#terms').addEventListener('change', () => { $('#termsErr').textContent = ''; });

  payBtn.addEventListener('click', async () => {
    if (!validateDriver(form)) return;
    if (!$('#terms').checked) {
      $('#termsErr').textContent = 'Zaznacz akceptację warunków, żeby zarezerwować.';
      $('#terms').focus();
      return;
    }
    payBtn.disabled = true;
    payBtn.classList.add('is-paying');
    payBtn.innerHTML = `<span class="road"><span class="road__car">${carSVG('#eef0f2', 'driving')}</span></span><span class="pay-btn__txt">Przygotowuję płatność…</span>`;
    const payment = await pm.pay();
    if (!payment) {
      payBtn.disabled = false;
      payBtn.classList.remove('is-paying');
      payBtn.innerHTML = `${ic('lock')}<span>Zapłać ${zl(q.total)}</span>`;
      $('#payBlock').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    payBtn.classList.add('is-paid');
    payBtn.innerHTML = `${ic('check')}<span>Opłacone</span>`;
    const b = createBooking(car, payment);
    await wait(700);
    go('#/rezerwacja/' + b.no);
  });
}

function validateDriver(form) {
  const rules = {
    name: v => v.trim().split(/\s+/).length >= 2 || 'Wpisz imię i nazwisko.',
    phone: v => digits(v).replace(/^48/, '').length === 9 || 'Podaj 9-cyfrowy numer — to na niego napiszę.',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Ten e-mail wygląda na niepełny.',
  };
  let first = null;
  Object.entries(rules).forEach(([name, rule]) => {
    const res = rule(form[name].value), err = $(`[data-err="${name}"]`), bad = res !== true;
    form[name].classList.toggle('is-bad', bad);
    if (err) err.textContent = bad ? res : '';
    if (bad && !first) first = form[name];
  });
  if (first) first.focus();
  return !first;
}

function createBooking(car, payment) {
  const q = quote(car);
  const no = Math.max(OWNER.rentals, ...bookings.all().map(b => b.no)) + 1;
  const b = {
    no, carId: car.id, from: state.from, to: state.to, place: state.place, protection: state.protection,
    lines: q.lines, total: q.total, deposit: q.deposit, days: q.days,
    driver: { name: state.driver.name.trim(), phone: state.driver.phone, email: state.driver.email, note: (state.driver.note || '').trim() },
    payment, status: 'confirmed', createdAt: Date.now(), checklist: {}, fresh: true,
  };
  bookings.save(b);
  state.driver.note = '';
  save();
  return b;
}

// ---------- booking ----------
const CHECKLIST = [
  ['license', 'Prawo jazdy'],
  ['id', 'Dowód osobisty lub paszport'],
  ['card', 'Karta na kaucję, na Twoje nazwisko'],
];

const ON_DAY = { poniedziałek: 'w poniedziałek', wtorek: 'we wtorek', środa: 'w środę', czwartek: 'w czwartek', piątek: 'w piątek', sobota: 'w sobotę', niedziela: 'w niedzielę' };

function viewBooking(no) {
  const b = bookings.get(no);
  if (!b) { app.innerHTML = `<section class="wrap page empty"><p>Nie znalazłam rezerwacji nr ${esc(no || '')}.</p><a class="btn btn--ink" href="#/rezerwacje">Moje rezerwacje</a></section>`; return; }
  const car = carById(b.carId), place = placeById(b.place);
  const cancelled = b.status === 'cancelled', fresh = b.fresh;
  if (fresh) { b.fresh = false; bookings.save(b); }
  const first = b.driver.name.split(' ')[0];
  const onDay = ON_DAY[new Date(b.from).toLocaleDateString('pl-PL', { weekday: 'long' })] || '';
  const date = fmtLong(b.from).replace(/^\S+ /, '');

  app.innerHTML = `
  <section class="wrap page done ${cancelled ? 'is-cancelled' : ''} ${fresh ? 'is-fresh' : ''}">
    <div class="done__top">
      <div class="done__copy">
        <p class="kicker">Rezerwacja nr ${b.no}${cancelled ? ' · odwołana' : ''}</p>
        <h1>${cancelled ? 'Klucz wrócił na tablicę.' : `Klucz jest Twój, ${esc(first)}.`}</h1>
        <p class="done__lead">${cancelled
          ? `Zwrot ${zl(b.refund || 0)} wróci tą samą metodą płatności w 3–5 dni roboczych.`
          : `${car.nick} czeka ${onDay}, ${date} o ${fmtTime(b.from)}. ${place.name}.`}</p>
        ${cancelled ? '<a class="btn btn--ink" href="#/">Wybierz inny termin</a>' : `
        <div class="done__actions">
          <button type="button" class="btn btn--ink" id="ics">${ic('cal')} Dodaj do kalendarza</button>
          <a class="btn btn--line" href="${telHref}">${ic('call')} Zadzwoń do mnie</a>
          <button type="button" class="link link--danger" id="cancel">Odwołaj rezerwację</button>
        </div>`}
      </div>
      <button type="button" class="done__key" id="doneKey" aria-label="Wypróbuj kluczyk: klakson i światła" ${cancelled ? 'disabled' : ''}>${keyHTML(car, car.nick, car.plate, 'key--big')}</button>
    </div>

    <div class="done__grid">
      <div class="done__left">
        ${polaroid(car, 'pol--big')}
        ${cancelled ? '' : `
        <div class="fob">
          <div class="fob__btns">
            <button type="button" data-fob="unlock" aria-label="Otwórz">${ic('unlock')}</button>
            <button type="button" data-fob="lock" aria-label="Zamknij">${ic('lock')}</button>
            <button type="button" data-fob="horn" aria-label="Klakson i światła">${ic('horn')}</button>
          </div>
          <p class="fob__note" aria-live="polite">Kluczyk w telefonie dostaniesz przy aucie. Tu możesz go wypróbować na sucho.</p>
        </div>`}
      </div>

      <div class="done__right">
        ${cancelled ? '' : `<div class="note note--car" style="--tilt:1.5deg"><p class="note__hand">Dzięki! Dzień przed odbiorem napiszę SMS-a na ${esc(b.driver.phone)}. Gdyby coś się zmieniło, po prostu zadzwoń.${b.driver.note ? ' Twoją wiadomość mam, odpiszę dziś.' : ''}</p><p class="note__sig">— ${OWNER.first}, ${OWNER.phone}</p></div>`}
        <div class="receipt receipt--done">
          ${receiptHead()}
          <span class="stamp">${cancelled ? 'Odwołano' : 'Opłacono'}<small>${fmtStamp(cancelled ? Date.now() : b.createdAt)}</small></span>
          <dl class="sum__when">
            <div><dt>Odbiór</dt><dd>${fmtDay(b.from)}, ${fmtTime(b.from)}</dd></div>
            <div><dt>Zwrot</dt><dd>${fmtDay(b.to)}, ${fmtTime(b.to)}</dd></div>
            <div><dt>Gdzie</dt><dd>${place.name}<small>${place.where}</small></dd></div>
          </dl>
          ${lineList(b.lines)}
          <div class="total"><span>Suma PLN</span><b>${zl(b.total)}</b></div>
          <p class="dep">${esc(b.payment.label)} · kaucja ${zl0(b.deposit)} — blokada przy odbiorze.</p>
        </div>
        ${cancelled ? '' : `
        <div class="todo"><p class="todo__t">Zabierz ze sobą</p>
          <ul>${CHECKLIST.map(([id, t]) => `<li><label class="check"><input type="checkbox" data-todo="${id}"${b.checklist[id] ? ' checked' : ''}><span>${t}</span></label></li>`).join('')}</ul></div>`}
      </div>
    </div>
  </section>`;

  const pic = $('.pol--big .photo');
  if (fresh && pic) setTimeout(() => { flash(pic, 'blink', 2); sound.unlock(); }, 900);

  const note = $('.fob__note');
  const honk = () => { sound.horn(); flash(pic, 'lights', 2); if (note) note.textContent = 'Bip bip. Tak ją znajdziesz na parkingu.'; };
  $('#doneKey').addEventListener('click', () => {
    honk();
    const k = $('#doneKey .key');
    k.classList.remove('is-swing'); void k.offsetWidth; k.classList.add('is-swing');
  });
  $$('[data-fob]').forEach(btn => btn.addEventListener('click', () => {
    const a = btn.dataset.fob;
    if (a === 'unlock') { sound.unlock(); flash(pic, 'blink', 1); note.textContent = `${car.nick} otwarta (na niby).`; }
    if (a === 'lock') { sound.lock(); flash(pic, 'blink', 2); note.textContent = `${car.nick} zamknięta.`; }
    if (a === 'horn') honk();
    btn.classList.remove('is-hit'); void btn.offsetWidth; btn.classList.add('is-hit');
  }));

  $$('[data-todo]').forEach(i => i.addEventListener('change', () => {
    b.checklist[i.dataset.todo] = i.checked;
    bookings.save(b);
    if (CHECKLIST.every(([id]) => b.checklist[id])) toast('Wszystko spakowane. Do zobaczenia!');
  }));

  const ics = $('#ics');
  if (ics) ics.addEventListener('click', () => downloadICS(b, car, place));
  const cancel = $('#cancel');
  if (cancel) cancel.addEventListener('click', () => {
    const late = b.from - Date.now() < 2 * DAY;
    const refund = Math.round(b.total * (late ? 0.5 : 1));
    const m = modal({
      label: 'Odwołanie rezerwacji',
      html: `<div class="confirm">
        <h2>Odwołać rezerwację nr ${b.no}?</h2>
        <p>${late ? `Do odbioru zostało mniej niż 48 h, więc oddam połowę: <b>${zl(refund)}</b>.` : `Oddam całość: <b>${zl(refund)}</b>, tą samą metodą płatności.`}</p>
        <div class="confirm__row"><button type="button" class="btn btn--line" data-close>Zostawiam</button><button type="button" class="btn btn--danger" id="doCancel">Tak, odwołaj</button></div>
      </div>`,
    });
    $('#doCancel', m.el).addEventListener('click', () => {
      b.status = 'cancelled';
      b.refund = refund;
      bookings.save(b);
      m.close();
      toast('Rezerwacja odwołana', 'undo');
      route();
    });
  });
}

function downloadICS(b, car, place) {
  const stamp = ts => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ev = (uid, start, title, desc) => [
    'BEGIN:VEVENT', `UID:${uid}@kluczyk.example`, `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(start + 30 * 60e3)}`,
    `SUMMARY:${title}`, `LOCATION:${place.name}\\, ${place.where.replace(/,/g, '\\,')}`, `DESCRIPTION:${desc}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM', 'END:VEVENT',
  ];
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kluczyk//Mock v4//PL', 'CALSCALE:GREGORIAN',
    ...ev(`${b.no}-in`, b.from, `Odbiór Tesli: ${car.nick} (rezerwacja nr ${b.no})`, `Zabierz prawo jazdy\\, dowód i kartę na kaucję. Telefon do Marty: ${OWNER.phone}`),
    ...ev(`${b.no}-out`, b.to, `Zwrot Tesli: ${car.nick}`, 'Bateria co najmniej 20%. Godzina spóźnienia gratis.'),
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kluczyk-${b.no}.ics`;
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
    <h1 class="page__title">Moje rezerwacje</h1>
    ${list.length ? `<div class="mine">${list.map(b => {
      const car = carById(b.carId), past = b.to < Date.now();
      const status = b.status === 'cancelled' ? ['odwołana', 'is-x'] : past ? ['zakończona', 'is-past'] : ['opłacona', 'is-ok'];
      return `<a class="mine__row" href="#/rezerwacja/${b.no}">
        <span class="mine__tag" style="--tag:${car.tag}">${car.nick}</span>
        <span class="mine__txt"><b>nr ${b.no}</b> ${fmtDay(b.from)}, ${fmtTime(b.from)} → ${fmtDay(b.to)}, ${fmtTime(b.to)} · ${placeById(b.place).short}</span>
        <span class="mine__status ${status[1]}">${status[0]}</span><b class="mine__sum">${zl(b.total)}</b></a>`;
    }).join('')}</div>`
    : `<div class="empty"><p>Na razie nie ma tu żadnego klucza.</p><a class="btn btn--ink" href="#/">Do tablicy z kluczami</a></div>`}
  </section>`;
}

// ---------- router ----------
const VIEWS = { '': viewHome, auto: viewCar, kasa: viewCheckout, rezerwacja: viewBooking, rezerwacje: viewBookings };
let pendingScroll = null;

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function route() {
  const [name = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
  const view = VIEWS[name] || viewHome;
  app.innerHTML = '';
  view(arg ? decodeURIComponent(arg) : undefined);
  $$('.nav a[data-nav]').forEach(a => a.classList.toggle('is-active', a.dataset.nav === name));
  const count = bookings.all().filter(b => b.status !== 'cancelled' && b.to > Date.now()).length;
  $('#bookingCount').hidden = !count;
  $('#bookingCount').textContent = count;
  if (pendingScroll && document.getElementById(pendingScroll)) {
    const el = document.getElementById(pendingScroll);
    pendingScroll = null;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth' }));
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

$$('.nav a[data-scroll]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  const id = a.dataset.scroll, el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
  else { pendingScroll = id; go('#/'); }
}));

window.addEventListener('hashchange', route);

// ---------- theme: the garage light switch ----------
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
  toast(t === 'dark' ? 'Światło w garażu zgaszone' : 'Światło w garażu zapalone', 'spark');
});

// ---------- demo bar, footer ----------
$('#testData').innerHTML = `
  <div class="wrap test-data__in">
    <div><p class="test-data__t">Karty</p><ul>${TEST_CARDS.map(c => `<li><code>${c.number}</code> ${c.result}</li>`).join('')}</ul>
      <p class="test-data__s">Data ważności: dowolna przyszła · CVC: dowolne 3 cyfry</p></div>
    <div><p class="test-data__t">BLIK</p><ul><li><code>dowolne 6 cyfr</code> potwierdzasz w „telefonie”</li><li><code>000 000</code> kod wygasł</li></ul>
      <button type="button" class="btn btn--line btn--sm" id="resetMock">Wyczyść dane mocka</button></div>
  </div>`;
$('#credits').innerHTML = `<b>Zdjęcia</b> · domena publiczna (CC0), Wikimedia Commons<br>${CARS.map(c =>
  `<a href="${c.photo.page}" target="_blank" rel="noopener">${c.nick} (${shortModel(c)})</a> — ${esc(c.photo.author)}`).join(' · ')}`;

$('#testDataBtn').addEventListener('click', () => {
  const box = $('#testData'), open = box.hidden;
  box.hidden = !open;
  $('#testDataBtn').setAttribute('aria-expanded', open);
});
$('#resetMock').addEventListener('click', () => {
  [KEY, BOOKINGS, 'kluczyk-theme', 'kluczyk-v4-pay-method'].forEach(store.drop);
  location.hash = '#/';
  location.reload();
});

route();
