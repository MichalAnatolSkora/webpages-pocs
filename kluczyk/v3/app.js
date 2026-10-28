// Kluczyk v3 — a one-person Tesla rental: pick dates, pick one of six cars, pay, done.

const app = $('#app');
const KEY = 'kluczyk-v3';
const BOOKINGS = 'kluczyk-v3-bookings';

// ---------- dates ----------
const dayStart = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return +d; };
const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return +d; };
const daysBetween = (a, b) => Math.round((dayStart(b) - dayStart(a)) / DAY);
const fmtShort = ts => new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

function withTime(dayTs, hhmm) {
  const d = new Date(dayTs), [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return +d;
}

// seeded busy days are counted from the next Friday, so the demo weekend always has a car or two taken
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
  if (ld) lines.push({ label: `Od ${ld === 0.2 ? 7 : 3} dób taniej o ${ld * 100}%`, amount: -Math.round(base * ld), good: true });
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
  `<li class="${l.good ? 'is-good' : ''}"><span>${esc(l.label)}</span><span>${l.amount < 0 ? '−' : ''}${zl(Math.abs(l.amount))}</span></li>`).join('')}</ul>`;

const avatar = (cls = '') => `<span class="avatar ${cls}" aria-hidden="true">${OWNER.first[0]}</span>`;
const telHref = 'tel:' + OWNER.phone.replace(/\s/g, '');

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
  if (h < 7) return { on: false, text: 'Śpi. Przy awarii i tak dzwoń — odbierze.' };
  if (h < HOURS.open) return { on: false, text: 'Ładuje auta na cały dzień' };
  if (h >= 22) return { on: false, text: 'Po pracy. Na wiadomości odpisze rano' };
  if (h >= HOURS.close) return { on: true, text: 'Po pracy, ale na SMS-y odpisuje do 22:00' };
  const day = [
    'Wydaje Śnieżkę na Krzykach', 'Jedzie Kluską na lotnisko', 'Myje Szprotkę po weekendzie',
    'Odbiera Jagodę spod Hali Stulecia', 'Przy telefonie, odpisuje w kilka minut', 'Tłumaczy komuś jazdę jednym pedałem',
  ];
  return { on: true, text: day[(h + d.getDay()) % day.length] };
}

// ---------- dates form + calendar ----------
function timeOptions(selected) {
  let out = '';
  for (let m = HOURS.open * 60; m <= HOURS.close * 60; m += 30) {
    const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    out += `<option${t === selected ? ' selected' : ''}>${t}</option>`;
  }
  return out;
}

function datesField({ car, onChange }) {
  const el = document.createElement('div');
  el.className = 'dates';
  el.innerHTML = `
    <div class="field"><span>Odbiór</span>
      <div class="datebox"><button type="button" class="datebox__day" data-cal>${ic('cal')}<b data-day="from"></b></button>
      <select class="datebox__time" name="fromTime" aria-label="Godzina odbioru"></select></div></div>
    <div class="field"><span>Zwrot</span>
      <div class="datebox"><button type="button" class="datebox__day" data-cal>${ic('cal')}<b data-day="to"></b></button>
      <select class="datebox__time" name="toTime" aria-label="Godzina zwrotu"></select></div></div>`;
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
        <div><p class="eyebrow">${car ? `Kalendarz: ${esc(car.nick)}` : 'Termin wynajmu'}</p><p class="cal__sum" aria-live="polite"></p></div>
        <button type="button" class="icon-btn" data-close aria-label="Zamknij">${ic('x')}</button>
      </div>
      <div class="cal__nav">
        <button type="button" class="icon-btn" data-step="-1" aria-label="Poprzedni miesiąc">${ic('back')}</button>
        <button type="button" class="icon-btn" data-step="1" aria-label="Następny miesiąc">${ic('arrow')}</button>
      </div>
      <div class="cal__months"></div>
      <div class="cal__foot">
        <p class="cal__legend">${car ? `<span class="lg lg--busy"></span>${esc(car.nick)} jest wtedy u kogoś` : 'Wolne auta zobaczysz po zatwierdzeniu.'}</p>
        <button type="button" class="btn btn--primary" data-ok>Zatwierdź</button>
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

// ---------- home ----------
function viewHome() {
  const now = ownerNow();
  app.innerHTML = `
  <section class="wrap hero">
    <div class="hero__copy">
      <p class="eyebrow">Wynajem Tesli · Wrocław</p>
      <h1 class="hero__title">Sześć Tesli i&nbsp;jedna osoba, która <mark>odbiera telefon</mark>.</h1>
      <p class="hero__lead">Cześć, tu ${OWNER.first}. Od ${OWNER.since} roku wynajmuję Tesle we Wrocławiu. Każde auto wydaję sama, a&nbsp;jak w&nbsp;trasie coś się dzieje, dzwonisz prosto do mnie — nie na infolinię.</p>
      <div class="owner">
        ${avatar()}
        <div class="owner__txt"><b>${OWNER.name}</b><span class="owner__now"><i class="dot ${now.on ? 'is-on' : ''}"></i>Teraz: ${now.text}</span></div>
        <a class="btn btn--ghost btn--sm" href="${telHref}">${ic('call')} Zadzwoń</a>
      </div>
    </div>
    <form class="when" id="when">
      <p class="when__t">Kiedy potrzebujesz auta?</p>
      <div id="datesSlot"></div>
      <button class="btn btn--primary btn--lg btn--block" type="submit">Pokaż wolne auta <span class="btn__meta" id="whenDays"></span></button>
      <p class="when__note">${ic('clock')} Wydaję i odbieram auta codziennie ${HOURS.open}:00–${HOURS.close}:00.</p>
    </form>
  </section>

  <section class="wrap section" id="auta">
    <div class="section__head"><h2>Moje auta</h2><p class="muted" id="fleetSum" aria-live="polite"></p></div>
    <div class="fleet" id="fleet"></div>
  </section>

  <section class="wrap section" id="jak">
    <div class="section__head"><h2>Jak to wygląda</h2></div>
    <ol class="how">
      <li><span class="how__n">1</span><b>Wybierasz termin i auto</b><p>Widzisz od razu, które są wolne. Płacisz BLIK-iem albo kartą — trwa to minutę.</p></li>
      <li><span class="how__n">2</span><b>Spotykamy się przy aucie</b><p>U mnie na Krzykach, pod Twoim domem albo na lotnisku. W pięć minut pokażę, jak się nią jeździ.</p></li>
      <li><span class="how__n">3</span><b>Oddajesz i gotowe</b><p>Z co najmniej 20% baterii, bez tankowania i bez szukania stacji. Kaucja wraca od razu.</p></li>
    </ol>
  </section>

  <section class="wrap section" id="cennik">
    <div class="section__head"><h2>Cennik bez gwiazdek</h2><p class="muted">Ceny za dobę, z ubezpieczeniem i bez limitu kilometrów.</p></div>
    <div class="prices">
      <table class="ptable">
        <thead><tr><th>Auto</th><th>1–2 doby</th><th>od 3 dób</th><th>od 7 dób</th><th>Kaucja</th></tr></thead>
        <tbody>${CARS.map(c => `<tr>
          <th scope="row"><a href="#/auto/${c.id}">${c.nick}</a><small>${c.model.replace('Tesla ', '')} ${c.trim}</small></th>
          <td>${c.price} zł</td><td>${Math.round(c.price * 0.9)} zł</td><td>${Math.round(c.price * 0.8)} zł</td><td>${zl0(c.deposit)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="incl">
        <p class="kicker">Zawsze w cenie</p>
        <ul>
          <li>${ic('check')}OC, AC i assistance 24/7 w całej UE</li>
          <li>${ic('check')}Bez limitu kilometrów</li>
          <li>${ic('check')}Auto czyste i naładowane do 90%</li>
          <li>${ic('check')}Godzina spóźnienia przy zwrocie</li>
        </ul>
        <p class="kicker">Dopłaty, jeśli chcesz</p>
        <ul class="incl__extra">
          ${PLACES.filter(p => p.fee).map(p => `<li><span>${p.name}</span><b>${p.fee} zł</b></li>`).join('')}
          <li><span>Ochrona „${PROTECTION[1].name}”</span><b>${PROTECTION[1].perDay} zł / doba</b></li>
          ${EXTRAS.map(x => `<li><span>${x.name}</span><b>${x.price} zł${x.per === 'day' ? ' / doba' : ''}</b></li>`).join('')}
        </ul>
      </div>
    </div>
  </section>

  <section class="wrap section" id="faq">
    <div class="section__head"><h2>Pytania</h2></div>
    <div class="faq">
      <details><summary>Nigdy nie jeździłem Teslą. Dam radę?</summary><p>Tak. Przy odbiorze pokażę Ci jazdę jednym pedałem, lusterka na ekranie i podłączanie ładowarki. Zwykle wystarcza pięć minut, a potem i tak możesz do mnie zadzwonić.</p></details>
      <details><summary>Muszę oddać auto naładowane?</summary><p>Nie. Dostajesz je z 90% baterii, oddajesz z co najmniej 20%. Jeśli zostanie mniej, doładuję po kosztach prądu, bez prowizji.</p></details>
      <details><summary>Jak działa kaucja?</summary><p>Przy odbiorze blokuję ją na Twojej karcie — nie pobieram. Zdejmuję blokadę od razu po zwrocie, a bank zwalnia środki zwykle w 1–3 dni.</p></details>
      <details><summary>Mogę wyjechać za granicę?</summary><p>Tak, w całej UE, bez dopłat. Napisz mi tylko w wiadomości do rezerwacji, dokąd jedziesz — przygotuję upoważnienie.</p></details>
      <details><summary>Co, jeśli coś się zepsuje w trasie?</summary><p>Dzwonisz do mnie, o każdej porze. Assistance jest w cenie, a jeśli auto nie nadaje się do jazdy, przywiozę Ci inne.</p></details>
      <details><summary>Skąd są zdjęcia aut?</summary><p>Z Wikimedia Commons, wszystkie w domenie publicznej (CC0). Autorów znajdziesz pod zdjęciem na stronie auta i w stopce.</p></details>
    </div>
  </section>

  <section class="wrap section" id="kontakt">
    <div class="contact">
      <div class="contact__who">${avatar('avatar--lg')}<div><h2>Napisz albo zadzwoń</h2><p class="muted">Odbieram sama. Najszybciej odpowiadam na SMS-y, zwykle w kilkanaście minut.</p></div></div>
      <div class="contact__btns">
        <a class="btn btn--primary" href="${telHref}">${ic('call')} ${OWNER.phone}</a>
        <a class="btn btn--ghost" href="sms:${OWNER.phone.replace(/\s/g, '')}">${ic('msg')} SMS</a>
        <a class="btn btn--ghost" href="mailto:${OWNER.email}">${OWNER.email}</a>
      </div>
      <dl class="contact__facts">
        <div><dt>Gdzie</dt><dd>${PLACES[0].where.split(',')[0]}, Wrocław-Krzyki</dd></div>
        <div><dt>Kiedy</dt><dd>Codziennie ${HOURS.open}:00–${HOURS.close}:00, przy awarii całą dobę</dd></div>
      </dl>
    </div>
  </section>`;

  const dates = datesField({ onChange: renderFleet });
  $('#datesSlot').append(dates);
  $('#when').addEventListener('submit', e => {
    e.preventDefault();
    $('#auta').scrollIntoView({ behavior: 'smooth' });
  });
  renderFleet();
}

function renderFleet() {
  $('#whenDays').textContent = '· ' + doby(rentalDays());
  const free = CARS.filter(c => !conflict(c)).length;
  $('#fleetSum').textContent = `${free} z ${CARS.length} wolne · ${fmtDay(state.from)} → ${fmtDay(state.to)}`;
  $('#fleet').innerHTML = CARS.map(c => {
    const taken = conflict(c), q = quote(c, false);
    const back = taken && nextFree(c);
    return `<a class="car ${taken ? 'is-taken' : ''}" href="#/auto/${c.id}">
      <span class="car__photo">${carFor(c)}<span class="pill ${taken ? 'pill--taken' : 'pill--free'}">${taken ? `Zajęta${back ? ` · wolna od ${fmtShort(back)}` : ''}` : 'Wolna'}</span></span>
      <span class="car__body">
        <span class="car__name"><b>${c.nick}</b><small>${c.model.replace('Tesla ', '')} ${c.trim} · ${c.color}</small></span>
        <span class="car__specs">${c.seats} miejsc · ${c.range} km zasięgu · ${c.trunk} l</span>
        <span class="car__price"><span><b>${c.price} zł</b> / doba</span><small>${taken ? 'w tym terminie zajęta' : `${zl0(q.total)} za ${doby(q.days)}`}</small></span>
      </span>
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
    <a class="back" href="#/">${ic('back')} Wszystkie auta</a>
    <div class="detail">
      <div class="detail__main">
        <button type="button" class="stage" id="stage" aria-label="Zatrąb i mrugnij światłami">${carFor(car)}<span class="stage__hint">kliknij, żeby zatrąbić</span></button>
        <p class="credit">${photoCredit(car)}</p>
        <h1 class="detail__title">${car.nick} <small>${car.model} ${car.trim}</small></h1>
        <figure class="quote">${avatar('avatar--sm')}<blockquote><p>${car.note}</p><figcaption>— ${OWNER.first}</figcaption></blockquote></figure>
        <dl class="facts">
          <div><dt>Miejsca</dt><dd>${car.seats}</dd></div>
          <div><dt>Zasięg</dt><dd>${car.range} km</dd></div>
          <div><dt>Bagażniki</dt><dd>${car.trunk} l</dd></div>
          <div><dt>Hak</dt><dd>${car.towbar ? 'tak' : 'nie'}</dd></div>
          <div><dt>Rocznik</dt><dd>${car.year}</dd></div>
          <div><dt>Przebieg</dt><dd>${car.km.toLocaleString('pl-PL')} km</dd></div>
          <div><dt>Kolor</dt><dd>${car.color}</dd></div>
          <div><dt>Tablica</dt><dd>${plateHTML(car.plate, 'plate--sm')}</dd></div>
        </dl>
      </div>

      <aside class="book">
        <form class="book__card" id="bookForm">
          <p class="book__price"><b>${car.price} zł</b> / doba</p>
          <div id="datesSlot"></div>
          <p class="avail" id="avail" aria-live="polite"></p>

          <fieldset class="opts"><legend>Gdzie odbierasz?</legend>
            ${PLACES.map(p => option('radio', 'place', p.id, state.place === p.id, p.name, p.where, p.fee ? `+${p.fee} zł` : 'gratis')).join('')}
          </fieldset>
          <fieldset class="opts"><legend>Ochrona</legend>
            ${PROTECTION.map(p => option('radio', 'protection', p.id, state.protection === p.id, p.name, p.text(car), p.perDay ? `+${p.perDay} zł / doba` : 'w cenie')).join('')}
          </fieldset>
          <fieldset class="opts"><legend>Dodatki</legend>
            ${EXTRAS.map(x => option('checkbox', 'extra', x.id, state.extras[x.id], x.name, x.note, `+${x.price} zł${x.per === 'day' ? ' / doba' : ''}`)).join('')}
          </fieldset>

          <div id="totals"></div>
          <button type="submit" class="btn btn--primary btn--lg btn--block" id="toCheckout">Rezerwuję ${ic('arrow')}</button>
        </form>
      </aside>
    </div>
  </section>
  <div class="mobile-cta" id="mobileCta"><span><small>Razem</small><b></b></span><button type="button" class="btn btn--primary">Rezerwuję</button></div>`;

  const stage = $('#stage');
  stage.addEventListener('click', () => { sound.horn(); flash($('.photo', stage), 'lights', 2); });

  const dates = datesField({ car, onChange: () => renderBook(car) });
  $('#datesSlot').append(dates);
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
    dates.repaint();
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
    ? `<span>${ic('x')}${car.nick} jest zajęta od ${fmtShort(taken[0])} do ${fmtShort(taken[1])}.</span>${back ? `<button type="button" class="link" data-shift>Przesuń na ${fmtShort(back)} → ${fmtShort(addDays(back, daysBetween(state.from, state.to)))}</button>` : ''}`
    : `<span>${ic('check')}Wolna w tym terminie · ${doby(q.days)}</span>`;
  $('#totals').innerHTML = `
    ${lineList(q.lines)}
    <div class="total"><span>Razem</span><b class="odo" id="odo"></b></div>
    <p class="dep">${ic('shield')}<span>Kaucja <b>${zl0(q.deposit)}</b> — zablokuję ją na karcie przy odbiorze, nie pobiorę.</span></p>`;
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
    <a class="back" href="#/auto/${car.id}">${ic('back')} Wróć do auta</a>
    <h1 class="page__title">Ostatni krok</h1>
    <div class="detail">
      <div class="detail__main">
        <form class="block" id="driver" novalidate>
          <h2>Twoje dane</h2>
          <div class="form-grid">
            ${field('name', 'Imię i nazwisko', 'autocomplete="name" required', true)}
            ${field('phone', 'Telefon', 'type="tel" autocomplete="tel" required inputmode="tel" placeholder="600 000 000"')}
            ${field('email', 'E-mail', 'type="email" autocomplete="email" required inputmode="email"')}
            <label class="field field--wide"><span>Wiadomość do mnie <em>opcjonalnie</em></span>
              <textarea class="input" name="note" rows="3" placeholder="Np. numer lotu, wiek dziecka do fotelika albo dokąd jedziesz">${esc(d.note || '')}</textarea></label>
          </div>
          <p class="hint">${ic('card')} Prawo jazdy i dowód pokażesz mi przy odbiorze — tutaj ich nie wpisujesz.</p>
        </form>

        <section class="block" id="payBlock">
          <h2>Płatność</h2>
          <div id="payModule"></div>
        </section>

        <label class="check terms"><input type="checkbox" id="terms"><span>Akceptuję <a href="#/" onclick="return false">warunki najmu</a> — jedna strona, bez drobnego druku. Do 48 h przed odbiorem odwołasz za darmo.</span></label>
        <p class="field__err" id="termsErr"></p>
        <button type="button" class="btn btn--primary btn--xl pay-btn" id="payBtn">${ic('lock')}<span>Zapłać ${zl(q.total)}</span></button>
      </div>

      <aside class="book">
        <div class="book__card book__card--sum">
          <div class="sum__car">${carFor(car)}<div><b>${car.nick}</b><small>${car.model} ${car.trim}</small></div></div>
          <dl class="sum__when">
            <div><dt>Odbiór</dt><dd>${fmtDay(state.from)}, ${fmtTime(state.from)}</dd></div>
            <div><dt>Zwrot</dt><dd>${fmtDay(state.to)}, ${fmtTime(state.to)}</dd></div>
            <div class="sum__wide"><dt>Gdzie</dt><dd>${place.name}</dd></div>
          </dl>
          ${lineList(q.lines)}
          <div class="total"><span>Razem</span><b class="odo" id="odo"></b></div>
          <p class="dep">${ic('shield')}<span>Kaucja <b>${zl0(q.deposit)}</b> — blokada na karcie przy odbiorze.</span></p>
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
  ['license', 'Prawo jazdy', 'ważne co najmniej rok'],
  ['id', 'Dowód osobisty lub paszport', ''],
  ['card', 'Karta na kaucję', 'na nazwisko kierowcy'],
];

function viewBooking(no) {
  const b = bookings.get(no);
  if (!b) { app.innerHTML = `<section class="wrap page empty"><p>Nie znalazłam rezerwacji nr ${esc(no || '')}.</p><a class="btn btn--primary" href="#/rezerwacje">Moje rezerwacje</a></section>`; return; }
  const car = carById(b.carId), place = placeById(b.place);
  const cancelled = b.status === 'cancelled', fresh = b.fresh;
  if (fresh) { b.fresh = false; bookings.save(b); }
  const first = b.driver.name.split(' ')[0];
  const weekday = new Date(b.from).toLocaleDateString('pl-PL', { weekday: 'long' });
  const w = { poniedziałek: 'w poniedziałek', wtorek: 'we wtorek', środa: 'w środę', czwartek: 'w czwartek', piątek: 'w piątek', sobota: 'w sobotę', niedziela: 'w niedzielę' }[weekday] || '';

  app.innerHTML = `
  <section class="wrap page done ${cancelled ? 'is-cancelled' : ''}">
    <div class="done__head">
      <p class="eyebrow">${cancelled ? `Rezerwacja nr ${b.no} odwołana` : `Opłacone · rezerwacja nr ${b.no}`}</p>
      <h1>${cancelled ? 'Odwołane. Może innym razem.' : `Do zobaczenia ${w}, ${esc(first)}!`}</h1>
      <p class="muted">${cancelled
        ? `Zwrot ${zl(b.refund || 0)} wróci tą samą metodą płatności w 3–5 dni roboczych.`
        : `${car.nick} czeka ${fmtLong(b.from).replace(/^\S+ /, '')} o ${fmtTime(b.from)} · ${place.name}.`}</p>
    </div>

    <div class="done__grid">
      <div class="done__car">
        <div class="done__stage" id="doneCar">${carFor(car)}</div>
        <div class="done__plate">${plateHTML(car.plate, fresh ? 'is-stamp' : '')}<span>${car.model} ${car.trim}</span></div>
        ${cancelled ? '' : `
        <div class="fob">
          <div class="fob__btns">
            <button type="button" data-fob="unlock" aria-label="Otwórz">${ic('unlock')}</button>
            <button type="button" data-fob="lock" aria-label="Zamknij">${ic('lock')}</button>
            <button type="button" data-fob="horn" aria-label="Klakson i światła">${ic('horn')}</button>
          </div>
          <p class="fob__note" aria-live="polite">Kluczyk w telefonie dostaniesz przy odbiorze. Tu możesz go wypróbować na sucho.</p>
        </div>`}
      </div>

      <div class="done__info">
        ${cancelled ? '' : `<figure class="quote quote--letter">${avatar()}<blockquote><p>Dzięki! Dzień przed odbiorem napiszę SMS-a na ${esc(b.driver.phone)}. Gdyby coś się zmieniło, po prostu zadzwoń.${b.driver.note ? ' Twoją wiadomość mam — odpiszę dziś.' : ''}</p><figcaption>— ${OWNER.first}, ${OWNER.phone}</figcaption></blockquote></figure>`}
        <dl class="facts facts--wide">
          <div><dt>Odbiór</dt><dd>${fmtLong(b.from)}, ${fmtTime(b.from)}<small>${place.name} · ${place.where}</small></dd></div>
          <div><dt>Zwrot</dt><dd>${fmtLong(b.to)}, ${fmtTime(b.to)}<small>W tym samym miejscu, godzina spóźnienia gratis</small></dd></div>
          <div><dt>Płatność</dt><dd>${zl(b.total)} · ${esc(b.payment.label)}<small>Kaucja ${zl0(b.deposit)} — blokada przy odbiorze</small></dd></div>
        </dl>
        ${cancelled ? '' : `
        <p class="kicker">Co zabrać</p>
        <ul class="todo">${CHECKLIST.map(([id, t, n]) => `<li><label class="check"><input type="checkbox" data-todo="${id}"${b.checklist[id] ? ' checked' : ''}><span>${t}${n ? `<small>${n}</small>` : ''}</span></label></li>`).join('')}</ul>
        <div class="done__actions">
          <button type="button" class="btn btn--dark" id="ics">${ic('cal')} Dodaj do kalendarza</button>
          <a class="btn btn--ghost" href="${telHref}">${ic('call')} Zadzwoń do mnie</a>
          <button type="button" class="btn btn--ghost btn--danger" id="cancel">${ic('x')} Odwołaj</button>
        </div>`}
        ${cancelled ? '<a class="btn btn--primary" href="#/">Wybierz inny termin</a>' : ''}
      </div>
    </div>

    <section class="block receipt">
      <h2>Rozliczenie</h2>
      ${lineList(b.lines)}
      <p class="total"><span>Razem</span><b>${zl(b.total)}</b></p>
    </section>
  </section>`;

  const pic = $('#doneCar .photo');
  if (fresh && pic) setTimeout(() => { flash(pic, 'blink', 2); sound.unlock(); }, 600);

  const note = $('.fob__note');
  $$('[data-fob]').forEach(btn => btn.addEventListener('click', () => {
    const a = btn.dataset.fob;
    if (a === 'unlock') { sound.unlock(); flash(pic, 'blink', 1); note.textContent = `${car.nick} otwarta (na niby).`; }
    if (a === 'lock') { sound.lock(); flash(pic, 'blink', 2); note.textContent = `${car.nick} zamknięta.`; }
    if (a === 'horn') { sound.horn(); flash(pic, 'lights', 2); note.textContent = 'Bip bip. Tak ją znajdziesz na parkingu.'; }
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
        <div class="confirm__row"><button type="button" class="btn btn--ghost" data-close>Zostawiam</button><button type="button" class="btn btn--danger-solid" id="doCancel">Tak, odwołaj</button></div>
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
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kluczyk//Mock v3//PL', 'CALSCALE:GREGORIAN',
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
    ${list.length ? `<div class="garage">${list.map(b => {
      const car = carById(b.carId), past = b.to < Date.now();
      const status = b.status === 'cancelled' ? ['Odwołana', 'is-x'] : past ? ['Zakończona', 'is-past'] : ['Opłacona', 'is-ok'];
      return `<a class="garage__item" href="#/rezerwacja/${b.no}">
        <span class="garage__car">${carFor(car)}</span>
        <span class="garage__txt"><b>${car.nick} <small>nr ${b.no}</small></b><small>${fmtDay(b.from)}, ${fmtTime(b.from)} → ${fmtDay(b.to)}, ${fmtTime(b.to)} · ${placeById(b.place).short}</small></span>
        <span class="garage__right"><span class="status ${status[1]}">${status[0]}</span><b>${zl(b.total)}</b></span></a>`;
    }).join('')}</div>`
    : `<div class="empty"><p>Jeszcze nic tu nie ma.</p><a class="btn btn--primary" href="#/">Wybierz auto</a></div>`}
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

// ---------- demo bar, footer ----------
$('#testData').innerHTML = `
  <div class="wrap test-data__in">
    <div><p class="test-data__t">Karty</p><ul>${TEST_CARDS.map(c => `<li><code>${c.number}</code> ${c.result}</li>`).join('')}</ul>
      <p class="test-data__s">Data ważności: dowolna przyszła · CVC: dowolne 3 cyfry</p></div>
    <div><p class="test-data__t">BLIK</p><ul><li><code>dowolne 6 cyfr</code> potwierdzasz w „telefonie”</li><li><code>000 000</code> kod wygasł</li></ul>
      <button type="button" class="btn btn--ghost btn--sm" id="resetMock">Wyczyść dane mocka</button></div>
  </div>`;
$('#credits').innerHTML = `<b>Zdjęcia</b> · domena publiczna (CC0), Wikimedia Commons<br>${CARS.map(c =>
  `<a href="${c.photo.page}" target="_blank" rel="noopener">${c.nick} (${c.model.replace('Tesla ', '')} ${c.trim})</a> — ${esc(c.photo.author)}`).join(' · ')}`;

$('#testDataBtn').addEventListener('click', () => {
  const box = $('#testData'), open = box.hidden;
  box.hidden = !open;
  $('#testDataBtn').setAttribute('aria-expanded', open);
});
$('#resetMock').addEventListener('click', () => {
  [KEY, BOOKINGS, 'kluczyk-theme', 'kluczyk-v3-pay-method'].forEach(store.drop);
  location.hash = '#/';
  location.reload();
});

route();
