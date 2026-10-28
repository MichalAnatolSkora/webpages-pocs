// Skrzynka v1 — hash-routed mock of a tool rental: catalogue → cart → locker → details → contract →
// payment → order lifecycle (packing, locker pickup, use, return, inspection) on a simulated clock.

const app = $('#app');
const KEY = 'skrzynka-v1';
const ORDERS = 'skrzynka-v1-orders';
const STEPS = ['Paczkomat', 'Dane', 'Umowa', 'Płatność'];
const FLOW = [
  { id: 'paid', label: 'Opłacone', icon: 'check' },
  { id: 'packing', label: 'Kompletujemy', icon: 'wrench' },
  { id: 'shipped', label: 'W drodze', icon: 'truck' },
  { id: 'ready', label: 'W paczkomacie', icon: 'locker' },
  { id: 'using', label: 'U Ciebie', icon: 'hand' },
  { id: 'returning', label: 'Wraca', icon: 'return' },
  { id: 'done', label: 'Rozliczone', icon: 'shield' },
];

const HOW = [
  { icon: 'toolbox', t: 'Wybierz i zapłać', d: 'Wskaż termin i paczkomat. Płacisz BLIK-iem, kartą albo przelewem — kaucję na karcie tylko blokujemy.' },
  { icon: 'pen', t: 'Podpisz umowę', d: 'Umowa najmu z Twoimi danymi. Podpis palcem na ekranie i kod SMS — pół minuty.' },
  { icon: 'locker', t: 'Odbierz z paczkomatu', d: 'Rano w dniu startu dostaniesz SMS z kodem. Narzędzie sprawdzone, naładowane, w walizce.' },
  { icon: 'hand', t: 'Używaj', d: 'Porady i instrukcja są w zamówieniu. Potrzebujesz dłużej? Przedłużysz jednym kliknięciem.' },
  { icon: 'return', t: 'Odeślij', d: 'Wygeneruj kod zwrotu i wrzuć walizkę do dowolnego paczkomatu. Kaucja wraca w 24 godziny.' },
];

const FAQ = [
  ['Kiedy narzędzie będzie w paczkomacie?', `Zamówienia złożone do ${CUTOFF}:00 mogą być w paczkomacie już następnego dnia od 10:00. W niedziele nie dowozimy. Paczka czeka na Ciebie ${PICKUP_HOURS} godzin.`],
  ['Jak działa kaucja?', 'Przy płatności kartą tylko blokujemy kwotę — nic nie schodzi z konta. Przy BLIK-u i przelewie pobieramy ją i oddajemy w ciągu 24 godzin od sprawdzenia narzędzia.'],
  ['Czy muszę drukować etykietę zwrotną?', 'Nie. W zamówieniu generujesz kod zwrotu i wpisujesz go w dowolnym paczkomacie — skrytka otworzy się sama.'],
  ['Co, jeśli coś zepsuję?', 'To zależy od wybranej ochrony. Bez ochrony odpowiadasz do wartości narzędzia, z „Ochroną 30” najwyżej za 30%, a ze „Spokojną głową” nie dopłacasz nic.'],
  ['Umowa online — jak to działa?', 'Umowę najmu podpisujesz na ekranie i potwierdzasz jednorazowym kodem SMS. Kopia z datą, godziną i odciskiem SHA-256 zostaje w zamówieniu razem z protokołami wydania i zwrotu.'],
  ['Mogę oddać później?', `Tak — przedłuż najem w zamówieniu przed końcem terminu i dopłać według cennika. Spóźnienie bez przedłużenia kosztuje dodatkowo ${zl(LATE_FEE)} za każdą dobę i narzędzie.`],
];

// ---------- lookups and pricing ----------
const toolById = id => TOOLS.find(t => t.id === id);
const lockerById = id => LOCKERS.find(l => l.id === id);
const protById = id => PROTECTION.find(p => p.id === id) || PROTECTION[1];
const rentDays = (from, to) => daysBetween(from, to) + 1;
const addonPrice = (a, days) => (a.kind === 'day' ? a.price * days : a.price);
const startOfMonth = ts => { const d = new Date(ts); return +new Date(d.getFullYear(), d.getMonth(), 1); };

function rent(t, days) {
  const weeks = Math.floor(days / 7), rest = days % 7;
  return weeks * t.week + (rest ? Math.min(t.day + t.next * (rest - 1), t.week) : 0);
}

function earliestStart(ids = []) {
  const now = new Date(), today = startOfDay(+now);
  let d = addDays(today, now.getHours() < CUTOFF ? 1 : 2);
  ids.forEach(id => { const t = toolById(id); if (t && !t.stock) d = Math.max(d, addDays(today, t.backIn)); });
  while (new Date(d).getDay() === 0) d = addDays(d, 1);
  return d;
}

// cart: [{ id, addons: { addonId: true } }]
function totals(cart, from, to, protId) {
  const days = rentDays(from, to), prot = protById(protId), lines = [];
  cart.forEach(it => {
    const t = toolById(it.id);
    lines.push({ label: `${t.short} · ${dni(days)}`, amount: rent(t, days) });
    t.addons.forEach(a => {
      if (it.addons && it.addons[a.id]) lines.push({ label: a.name + (a.kind === 'day' ? ` · ${dni(days)}` : ''), amount: addonPrice(a, days), sub: true });
    });
  });
  if (prot.perDay) lines.push({ label: `Ochrona „${prot.name}” · ${cart.length} × ${dni(days)}`, amount: prot.perDay * days * cart.length });
  const before = sum(lines);
  const ship = before >= FREE_SHIP ? 0 : SHIP;
  lines.push({ label: 'Dostawa do paczkomatu i zwrot', amount: ship, free: !ship });
  const deposit = Math.round(cart.reduce((a, it) => a + toolById(it.id).deposit, 0) * prot.depositFactor);
  return { days, lines, total: before + ship, deposit, ship };
}

// Free compartments pooled upwards: a C compartment can take a B or an A parcel.
function lockerFit(lk, cart = state.cart) {
  const need = { A: 0, B: 0, C: 0 };
  cart.forEach(it => need[toolById(it.id).size]++);
  const c = lk.free.C - need.C;
  if (c < 0) return { ok: false, miss: 'C' };
  const b = lk.free.B + c - need.B;
  if (b < 0) return { ok: false, miss: 'B' };
  if (lk.free.A + b - need.A < 0) return { ok: false, miss: 'A' };
  return { ok: true };
}

function stockInfo(t) {
  if (!t.stock) return { cls: 'out', text: `Wszystkie egzemplarze wypożyczone · wolna od ${fmtDay(addDays(startOfDay(Date.now()), t.backIn))}` };
  if (t.stock === 1) return { cls: 'low', text: 'Ostatnia sztuka na stanie' };
  return { cls: 'ok', text: `Dostępne od ręki: ${t.stock} szt.` };
}

const lateDays = (o, at) => (at > endOfDay(o.to) ? daysBetween(o.to, at) : 0);
const lateRate = o => o.items.reduce((a, it) => a + toolById(it.id).next + LATE_FEE, 0);

// ---------- state ----------
function fixDates(s) {
  const min = earliestStart(s.cart.map(it => it.id));
  if (!s.from || s.from < min) {
    const len = s.from && s.to ? Math.max(0, daysBetween(s.from, s.to)) : 2;
    s.from = min;
    s.to = addDays(min, len);
  }
  if (!s.to || s.to < s.from) s.to = addDays(s.from, 2);
  if (rentDays(s.from, s.to) > MAX_DAYS) s.to = addDays(s.from, MAX_DAYS - 1);
}

function loadState() {
  const s = Object.assign({
    from: null, to: null, cart: [], protection: 'basic', lockerId: null, city: 'Wrocław', customer: {}, step: 1,
    cat: 'all', job: '', q: '', onlyFree: false, sort: 'pop',
  }, store.get(KEY, {}));
  s.cart = s.cart.filter(it => toolById(it.id));
  fixDates(s);
  return s;
}

const state = loadState();
const save = () => store.set(KEY, state);

const orders = {
  all: () => store.get(ORDERS, []),
  get: ref => orders.all().find(o => o.ref === ref),
  save(o) {
    const list = orders.all().filter(x => x.ref !== o.ref);
    list.unshift(o);
    store.set(ORDERS, list);
  },
};

// Checkout extras that live only until the order is paid: the order number, serials and the signature.
let draft = null;
function getDraft() {
  if (!draft) draft = { ref: 'SK-' + Math.floor(10000 + Math.random() * 90000), createdAt: Date.now(), serials: {}, sig: null };
  state.cart.forEach(it => {
    if (!draft.serials[it.id]) draft.serials[it.id] = `${toolById(it.id).code}-${Math.floor(10000 + Math.random() * 90000)}`;
  });
  return draft;
}
// Anything that changes the contract text voids the signature.
const unsign = () => { if (draft) draft.sig = null; };

function draftOrder() {
  const d = getDraft();
  return {
    ref: d.ref, createdAt: d.createdAt, customer: { ...state.customer }, lockerId: state.lockerId, protection: state.protection,
    from: state.from, to: state.to, sig: d.sig,
    items: state.cart.map(it => ({ id: it.id, addons: { ...it.addons }, serial: d.serials[it.id] })),
    totals: totals(state.cart, state.from, state.to, state.protection),
  };
}

function customerProblems(c = state.customer) {
  const p = {};
  if (!/\S+\s+\S+/.test(c.name || '')) p.name = 'Podaj imię i nazwisko.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email || '')) p.email = 'Sprawdź adres e-mail.';
  if (digits(c.phone || '').length !== 9) p.phone = 'Numer telefonu ma 9 cyfr.';
  if ((c.street || '').trim().length < 3) p.street = 'Podaj ulicę i numer.';
  if (!/^\d{2}-\d{3}$/.test(c.zip || '')) p.zip = 'Kod w formacie 00-000.';
  if ((c.city || '').trim().length < 2) p.city = 'Podaj miejscowość.';
  return p;
}

function maxStep() {
  const lk = lockerById(state.lockerId);
  if (!lk || !lockerFit(lk).ok) return 1;
  if (Object.keys(customerProblems()).length) return 2;
  if (!draft || !draft.sig) return 3;
  return 4;
}

// ---------- shared bits ----------
const stars = r => `<span class="stars" style="--r:${(r / 5) * 100}%" role="img" aria-label="Ocena ${String(r).replace('.', ',')} na 5">★★★★★</span>`;

function toolCard(t) {
  const back = t.stock ? '' : `<span class="peg__tag">Wraca ${fmtDay(addDays(startOfDay(Date.now()), t.backIn))}</span>`;
  return `<a class="tcard" href="#/n/${t.id}">
    <div class="tcard__board peg">${toolArt(t.id, { out: !t.stock })}${back}</div>
    <div class="tcard__body">
      <div class="tcard__meta"><span class="tag">${CATS[t.cat]}</span><span class="tag tag--size" title="Gabaryt skrytki w paczkomacie">${t.size}</span></div>
      <h3 class="tcard__name">${t.name}</h3>
      <p class="tcard__spec">${t.power} · ${kg(t.weight)}</p>
      <p class="tcard__price"><b>${zl(t.day)}</b> / dzień <span>· tydzień ${zl(t.week)}</span></p>
    </div>
  </a>`;
}

function addonRow(a, checked) {
  return `<label class="addon">
    <input type="checkbox" data-addon="${a.id}" ${checked ? 'checked' : ''}>
    <span class="addon__box">${ic('check')}</span>
    <span class="addon__name">${a.name}</span>
    <b>${a.kind === 'day' ? `${zl(a.price)} / dzień` : zl(a.price)}</b>
  </label>`;
}

function summaryHTML(tt, from, to) {
  const before = tt.total - tt.ship;
  return `
    <h2 class="h3">Podsumowanie</h2>
    <p class="summary__term">${ic('cal')} ${fmtDay(from)} → ${fmtDay(to)} · ${dni(tt.days)}</p>
    <ul class="lines">${tt.lines.map(l => `<li class="${l.sub ? 'is-sub' : ''}"><span>${esc(l.label)}</span><b>${l.free ? 'gratis' : zl(l.amount)}</b></li>`).join('')}</ul>
    ${tt.ship ? `<p class="summary__ship">${ic('truck')} Dorzuć coś za ${zl(FREE_SHIP - before)}, a dostawa będzie gratis.</p>` : ''}
    <div class="summary__total"><span>Razem</span><b>${zl(tt.total)}</b></div>
    <div class="summary__dep"><span>${ic('lock')} Kaucja zwrotna</span><b>${zl(tt.deposit)}</b></div>`;
}

// ---------- date range picker ----------
const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

function rangePicker(root, { from, to, min, onChange }) {
  let a = from, b = to, picking = false, hover = null;
  let view = startOfMonth(a);

  const isSunday = ts => new Date(ts).getDay() === 0;
  const disabled = ts => ts < min || ((!picking || ts < a) && isSunday(ts)) || (picking && ts >= a && daysBetween(a, ts) >= MAX_DAYS);

  function render() {
    const v = new Date(view), y = v.getFullYear(), mo = v.getMonth();
    const lead = (v.getDay() + 6) % 7, count = new Date(y, mo + 1, 0).getDate();
    let cells = '<span></span>'.repeat(lead);
    for (let d = 1; d <= count; d++) {
      const ts = +new Date(y, mo, d);
      cells += `<button type="button" class="cal__d" data-ts="${ts}" aria-label="${fmtLong(ts)}" ${isSunday(ts) ? 'title="W niedziele nie dowozimy — odbiór możliwy od poniedziałku"' : ''}>${d}</button>`;
    }
    root.innerHTML = `
      <div class="cal">
        <div class="cal__head">
          <button type="button" class="cal__nav" data-nav="-1" aria-label="Poprzedni miesiąc" ${view <= startOfMonth(min) ? 'disabled' : ''}>${ic('back')}</button>
          <b>${v.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</b>
          <button type="button" class="cal__nav" data-nav="1" aria-label="Następny miesiąc" ${view >= startOfMonth(addDays(min, 150)) ? 'disabled' : ''}>${ic('arrow')}</button>
        </div>
        <div class="cal__wd">${WEEKDAYS.map(w => `<span>${w}</span>`).join('')}</div>
        <div class="cal__grid">${cells}</div>
        <p class="cal__hint" aria-live="polite"></p>
      </div>`;
    paint();
  }

  function paint() {
    const end = picking ? (hover && hover >= a ? hover : a) : b;
    $$('.cal__d', root).forEach(btn => {
      const ts = +btn.dataset.ts;
      btn.disabled = disabled(ts);
      btn.classList.toggle('is-start', ts === a);
      btn.classList.toggle('is-end', ts === end);
      btn.classList.toggle('in-range', ts > a && ts < end);
      btn.classList.toggle('is-today', ts === startOfDay(Date.now()));
      btn.setAttribute('aria-pressed', ts === a || ts === end);
    });
    $('.cal__hint', root).innerHTML = picking
      ? `Odbiór <b>${fmtDay(a)}</b> — teraz wybierz dzień zwrotu.`
      : `<b>${fmtDay(a)}</b> od 10:00 → <b>${fmtDay(b)}</b> do 23:59 · ${dni(rentDays(a, b))}`;
  }

  root.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const d = new Date(view);
      d.setMonth(d.getMonth() + +nav.dataset.nav);
      view = +d;
      return render();
    }
    const day = e.target.closest('.cal__d');
    if (!day || day.disabled) return;
    const ts = +day.dataset.ts;
    if (!picking || ts < a) {
      a = b = ts;
      picking = true;
      hover = null;
      onChange(a, b);
    } else {
      b = ts;
      picking = false;
      onChange(a, b);
    }
    paint();
  });
  root.addEventListener('mouseover', e => {
    const day = e.target.closest('.cal__d');
    if (!picking || !day) return;
    hover = +day.dataset.ts;
    paint();
  });
  render();
}

// ---------- stylised city map ----------
function cityMap(city) {
  const c = CITIES[city] || {}, rnd = seeded(city), f = n => n.toFixed(1);
  let minor = '';
  for (let i = 0; i < 7; i++) {
    const y = 6 + i * 14 + rnd() * 6;
    minor += `M0 ${f(y)}C35 ${f(y + rnd() * 8 - 4)} 65 ${f(y + rnd() * 8 - 4)} 100 ${f(y + rnd() * 6 - 3)}`;
    const x = 6 + i * 14 + rnd() * 6;
    minor += `M${f(x)} 0C${f(x + rnd() * 8 - 4)} 35 ${f(x + rnd() * 8 - 4)} 65 ${f(x + rnd() * 6 - 3)} 100`;
  }
  const roads = `M0 ${f(48 + rnd() * 8)}C30 ${f(44 + rnd() * 12)} 70 ${f(44 + rnd() * 12)} 100 ${f(48 + rnd() * 8)}M${f(44 + rnd() * 10)} 0C${f(40 + rnd() * 16)} 40 ${f(40 + rnd() * 16)} 60 ${f(44 + rnd() * 10)} 100M6 10L94 92`;
  return `<svg class="map__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    ${(c.parks || []).map(([x, y, r]) => `<ellipse class="map__park" cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}"/>`).join('')}
    <path class="map__minor" d="${minor}"/>
    ${c.sea ? '<path class="map__sea" d="M0 0H100V14C76 20 52 8 30 16S8 14 0 18Z"/>' : ''}
    ${c.river ? `<path class="map__river" d="${c.river}"/>` : ''}
    <circle class="map__ring" cx="50" cy="50" r="27"/>
    <path class="map__road" d="${roads}"/>
  </svg>`;
}

// ---------- pages ----------
function pageHome() {
  const popular = ['mlotowiertarka', 'myjka', 'odkurzacz-pioracy', 'wkretarka', 'laser', 'wyrzynarka'].map(toolById);
  const board = [['mlotowiertarka', 'a'], ['szlifierka-katowa', 'b'], ['pilarka-tarczowa', 'c'], ['wyrzynarka', 'd'], ['nozyce', 'e'], ['laser', 'f']];
  app.innerHTML = `
  <section class="hero">
    <div class="wrap hero__in">
      <div class="hero__copy">
        <p class="eyebrow">${ic('toolbox')} Wypożyczalnia narzędzi z paczkomatu</p>
        <h1 class="hero__h">Wiertarka na weekend, <span>nie na zawsze.</span></h1>
        <p class="hero__lead">Zamawiasz online, podpisujesz umowę w telefonie i odbierasz sprzęt z paczkomatu obok domu. Skończysz — odsyłasz z dowolnego paczkomatu. Bez lady, bez kolejki, bez drukowania etykiet.</p>
        <div class="hero__cta">
          <a class="btn btn--accent btn--lg" href="#/narzedzia">Wybierz narzędzie ${ic('arrow')}</a>
          <a class="btn btn--ghost btn--lg" href="#/" data-scroll="jak">Jak to działa</a>
        </div>
        <ul class="hero__facts">
          <li><b>od ${zl(Math.min(...TOOLS.map(t => t.day)))}</b><span>za dzień</span></li>
          <li><b>24/7</b><span>odbiór i zwrot</span></li>
          <li><b>0 zł</b><span>dostawy od ${zl(FREE_SHIP)}</span></li>
        </ul>
      </div>
      <div class="hero__board peg">
        ${board.map(([id, area]) => {
          const t = toolById(id);
          return `<a class="hang hang--${area}" href="#/n/${id}" aria-label="${t.name}">${toolArt(id, { out: !t.stock })}${t.stock ? '' : `<span class="peg__tag">Wraca<br>${fmtDay(addDays(startOfDay(Date.now()), t.backIn))}</span>`}</a>`;
        }).join('')}
        <span class="hero__plate">weź · użyj · oddaj</span>
      </div>
    </div>
  </section>

  <section class="wrap jobs">
    <h2 class="h2">Co dziś robisz?</h2>
    <div class="chips">${JOBS.map(j => `<a class="chip" href="#/narzedzia?job=${j.id}">${j.label}<span>${TOOLS.filter(t => t.jobs.includes(j.id)).length}</span></a>`).join('')}</div>
  </section>

  <section class="how" id="jak">
    <div class="wrap">
      <p class="eyebrow">Jak to działa</p>
      <h2 class="h2">Od kliknięcia do zwrotu kaucji</h2>
      <ol class="how__steps">
        ${HOW.map((s, i) => `<li class="how__step"><span class="how__icon">${ic(s.icon)}<i>${i + 1}</i></span><h3>${s.t}</h3><p>${s.d}</p></li>`).join('')}
      </ol>
    </div>
  </section>

  <section class="wrap section">
    <div class="section__head"><h2 class="h2">Najczęściej wypożyczane</h2><a class="link" href="#/narzedzia">Wszystkie narzędzia (${TOOLS.length}) ${ic('arrow')}</a></div>
    <div class="grid">${popular.map(toolCard).join('')}</div>
  </section>

  <section class="wrap section promise">
    <div>${ic('wrench')}<h3>Przegląd po każdym wynajmie</h3><p>Każde narzędzie wraca do warsztatu: czyszczenie, test, ostrzenie, pełne akumulatory.</p></div>
    <div>${ic('shield')}<h3>Ochrona od 3 zł dziennie</h3><p>Pękła tarcza, spadła wiertarka? Z ochroną dopłacasz najwyżej 30% — albo nic.</p></div>
    <div>${ic('doc')}<h3>Wszystko na papierze, bez papieru</h3><p>Umowa, protokół wydania i zwrotu czekają w zamówieniu. Wydrukujesz, jeśli lubisz.</p></div>
  </section>

  <section class="wrap section faq" id="faq">
    <h2 class="h2">Pytania</h2>
    ${FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
  </section>`;
}

function pageCatalog(q) {
  if (q.has('job')) Object.assign(state, { job: JOBS.some(j => j.id === q.get('job')) ? q.get('job') : '', cat: 'all', q: '' });
  if (q.has('cat')) Object.assign(state, { cat: CATS[q.get('cat')] ? q.get('cat') : 'all', job: '' });
  save();
  app.innerHTML = `
  <section class="wrap page">
    <header class="page__head">
      <p class="eyebrow">Katalog</p>
      <h1 class="h1">Narzędzia</h1>
      <p class="lead">Każde po przeglądzie, czyste i z naładowanymi akumulatorami. Im dłużej, tym taniej za dzień.</p>
    </header>
    <div class="filters">
      <div class="seg" role="tablist" aria-label="Kategoria">${Object.entries(CATS).map(([id, name]) => `<button type="button" role="tab" class="seg__b" data-cat="${id}" aria-selected="${state.cat === id}">${name}</button>`).join('')}</div>
      <div class="filters__row">
        <label class="search">${ic('search')}<input type="search" id="q" placeholder="Szukaj: wiertarka, myjka, płytki…" value="${esc(state.q)}" aria-label="Szukaj narzędzia"></label>
        <select class="input select" id="job" aria-label="Zadanie"><option value="">Każde zadanie</option>${JOBS.map(j => `<option value="${j.id}">${j.label}</option>`).join('')}</select>
        <select class="input select" id="sort" aria-label="Sortowanie">
          <option value="pop">Najpopularniejsze</option><option value="cheap">Najtańsze</option><option value="exp">Najdroższe</option>
        </select>
        <label class="switch"><input type="checkbox" id="onlyFree" ${state.onlyFree ? 'checked' : ''}><span class="switch__t" aria-hidden="true"></span>Tylko dostępne od ręki</label>
      </div>
    </div>
    <p class="count" id="count" aria-live="polite"></p>
    <div class="grid" id="grid"></div>
  </section>`;
  $('#job').value = state.job;
  $('#sort').value = state.sort;

  const paint = () => {
    const words = norm(state.q).split(/\s+/).filter(Boolean);
    let list = TOOLS.filter(t =>
      (state.cat === 'all' || t.cat === state.cat) &&
      (!state.job || t.jobs.includes(state.job)) &&
      (!state.onlyFree || t.stock) &&
      words.every(w => norm(`${t.name} ${t.short} ${t.blurb} ${CATS[t.cat]} ${t.jobs.map(j => JOBS.find(x => x.id === j).label).join(' ')}`).includes(w)));
    const by = { pop: (x, y) => y.reviews - x.reviews, cheap: (x, y) => x.day - y.day, exp: (x, y) => y.day - x.day }[state.sort];
    list = list.sort(by);
    $('#count').textContent = `${list.length} ${plural(list.length, 'narzędzie', 'narzędzia', 'narzędzi')}`;
    $('#grid').innerHTML = list.length ? list.map(toolCard).join('') : `
      <div class="none">${toolArt('wkretarka', { out: true })}<p><b>Nic takiego nie mamy.</b> Spróbuj innego słowa albo wyczyść filtry.</p>
      <button type="button" class="btn btn--ghost" id="clearF">Wyczyść filtry</button></div>`;
    const clear = $('#clearF');
    if (clear) clear.addEventListener('click', () => { Object.assign(state, { cat: 'all', job: '', q: '', onlyFree: false }); save(); pageCatalog(new URLSearchParams()); });
  };
  $$('[data-cat]').forEach(b => b.addEventListener('click', () => {
    state.cat = b.dataset.cat;
    $$('[data-cat]').forEach(x => x.setAttribute('aria-selected', x === b));
    save();
    paint();
  }));
  $('#q').addEventListener('input', e => { state.q = e.target.value; save(); paint(); });
  $('#job').addEventListener('change', e => { state.job = e.target.value; save(); paint(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; save(); paint(); });
  $('#onlyFree').addEventListener('change', e => { state.onlyFree = e.target.checked; save(); paint(); });
  paint();
}

function pageTool(id) {
  const t = toolById(id);
  if (!t) return pageNotFound();
  const inCart = () => state.cart.find(it => it.id === id);
  const picked = { ...(inCart() ? inCart().addons : {}) };
  const s = stockInfo(t);
  const min = earliestStart([...state.cart.map(it => it.id), id]);
  const range = { from: state.from, to: state.to };
  if (range.from < min) { range.to = addDays(min, Math.max(0, daysBetween(range.from, range.to))); range.from = min; }
  const weekend = rent(t, 3);
  const related = TOOLS.filter(x => x.id !== t.id && x.jobs.some(j => t.jobs.includes(j))).slice(0, 3);

  app.innerHTML = `
  <section class="wrap page tool">
    <nav class="crumbs" aria-label="Okruszki"><a href="#/narzedzia">Narzędzia</a><span>/</span><a href="#/narzedzia?cat=${t.cat}">${CATS[t.cat]}</a></nav>
    <div class="tool__grid">
      <div class="tool__main">
        <div class="tool__board peg">${toolArt(t.id, { out: !t.stock })}${t.stock ? '' : `<span class="peg__tag">Wraca ${fmtDay(addDays(startOfDay(Date.now()), t.backIn))}</span>`}</div>
        <header class="tool__head">
          <div class="tool__tags"><span class="tag">${CATS[t.cat]}</span><span class="tag tag--size">Gabaryt ${t.size}</span></div>
          <h1 class="h1">${t.name}</h1>
          <p class="rating">${stars(t.rating)} <b>${String(t.rating).replace('.', ',')}</b> <span>· ${t.reviews} ${plural(t.reviews, 'opinia', 'opinie', 'opinii')}</span></p>
          <p class="lead">${t.blurb}</p>
        </header>
        <div class="tool__cols">
          <div class="panel"><h2 class="h3">W zestawie</h2><ul class="kit">${t.kit.map(k => `<li>${ic('check')}${k}</li>`).join('')}</ul></div>
          <div class="panel"><h2 class="h3">Parametry</h2><dl class="specs">${t.specs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>
        </div>
        <aside class="tip"><span class="tip__icon">${ic('wrench')}</span><div><b>Majster radzi</b><p>${t.tip}</p></div></aside>
        <div class="buyrent">
          <div><span>Nowa w sklepie</span><b>ok. ${zl(t.value)}</b></div>
          <div><span>U nas na 3 dni</span><b>${zl(weekend)}</b></div>
          <p>Kupno zwróciłoby się dopiero po <b>${Math.ceil(t.value / weekend)} takich wynajmach</b> — i nie musisz jej potem trzymać w piwnicy.</p>
        </div>
        ${related.length ? `<h2 class="h3 related__t">Przyda się też</h2><div class="grid grid--3">${related.map(toolCard).join('')}</div>` : ''}
      </div>
      <aside class="tool__side">
        <div class="panel side">
          <div class="prices">
            <div><span>Pierwszy dzień</span><b>${zl(t.day)}</b></div>
            <div><span>Każdy kolejny</span><b>${zl(t.next)}</b></div>
            <div><span>Tydzień</span><b>${zl(t.week)}</b></div>
          </div>
          <p class="stock stock--${s.cls}">${s.text}</p>
          <h2 class="side__t">Termin <small>wspólny dla całej skrzynki</small></h2>
          <div id="cal"></div>
          ${t.addons.length ? `<h2 class="side__t">Dodatki</h2><div class="addons">${t.addons.map(a => addonRow(a, picked[a.id])).join('')}</div>` : ''}
          <div class="side__sum"><span id="sumLabel"></span><b id="sum"></b></div>
          <p class="side__dep">+ kaucja ${zl(t.deposit)} · wraca po zwrocie</p>
          <div id="cta"></div>
          <p class="side__size">${ic('box')} Paczka gabarytu ${t.size} (${SIZES[t.size]}) — zmieści się w każdym paczkomacie.</p>
        </div>
      </aside>
    </div>
  </section>`;

  const paint = () => {
    const days = rentDays(range.from, range.to);
    const extra = t.addons.filter(a => picked[a.id]).reduce((a, x) => a + addonPrice(x, days), 0);
    $('#sumLabel').textContent = `Razem za ${dni(days)}`;
    $('#sum').textContent = zl(rent(t, days) + extra);
    $('#cta').innerHTML = inCart()
      ? `<a class="btn btn--dark btn--lg btn--block" href="#/skrzynka">${ic('check')} W skrzynce — przejdź dalej</a>
         <button type="button" class="link side__remove" id="remove">Usuń ze skrzynki</button>`
      : `<button type="button" class="btn btn--accent btn--lg btn--block" id="add">${ic('toolbox')} Dodaj do skrzynki</button>`;
    const add = $('#add'), remove = $('#remove');
    if (add) add.addEventListener('click', () => {
      state.cart.push({ id, addons: { ...picked } });
      state.from = range.from;
      state.to = range.to;
      fixDates(state);
      unsign();
      save();
      updateHeader();
      paint();
      toast(`${t.short} w skrzynce. <a href="#/skrzynka">Zobacz skrzynkę</a>`, 'toolbox');
    });
    if (remove) remove.addEventListener('click', () => {
      state.cart = state.cart.filter(it => it.id !== id);
      unsign();
      save();
      updateHeader();
      paint();
    });
  };

  rangePicker($('#cal'), {
    from: range.from, to: range.to, min,
    onChange(a, b) {
      range.from = a;
      range.to = b;
      if (inCart() || !state.cart.length) { state.from = a; state.to = b; unsign(); save(); }
      paint();
    },
  });
  $$('[data-addon]').forEach(i => i.addEventListener('change', () => {
    picked[i.dataset.addon] = i.checked;
    const it = inCart();
    if (it) { it.addons = { ...picked }; unsign(); save(); }
    paint();
  }));
  paint();
}

function emptyBoard(title, text, cta = `<a class="btn btn--accent btn--lg" href="#/narzedzia">Przeglądaj narzędzia</a>`) {
  app.innerHTML = `
  <section class="wrap page empty">
    <div class="empty__board peg">${['wkretarka', 'myjka', 'laser'].map(id => toolArt(id, { out: true })).join('')}</div>
    <h1 class="h2">${title}</h1>
    <p class="lead">${text}</p>
    ${cta}
  </section>`;
}

function pageCart() {
  if (!state.cart.length) return emptyBoard('Skrzynka jest pusta', 'Pusto jak na tablicy w garażu po przeprowadzce. Wybierz coś do roboty.');
  const min = earliestStart(state.cart.map(it => it.id));
  const waiting = state.cart.map(it => toolById(it.id)).filter(t => !t.stock);

  const item = it => {
    const t = toolById(it.id);
    return `<li class="citem" data-id="${t.id}">
      <a class="citem__art peg peg--sm" href="#/n/${t.id}" tabindex="-1">${toolArt(t.id, { shadow: false })}</a>
      <div class="citem__body">
        <a class="citem__name" href="#/n/${t.id}">${t.name}</a>
        <p class="citem__meta">${zl(t.day)} pierwszy dzień · ${zl(t.next)} kolejny · gabaryt ${t.size} · kaucja ${zl(t.deposit)}</p>
        ${t.addons.length ? `<div class="addons addons--sm">${t.addons.map(a => addonRow(a, it.addons[a.id])).join('')}</div>` : ''}
      </div>
      <div class="citem__end"><b class="citem__price"></b><button type="button" class="icon-btn" data-remove aria-label="Usuń: ${t.short}">${ic('trash')}</button></div>
    </li>`;
  };

  app.innerHTML = `
  <section class="wrap page">
    <header class="page__head">
      <h1 class="h1">Twoja skrzynka</h1>
      <p class="lead">Wszystko przyjedzie w jednej przesyłce, do jednego paczkomatu, z jednym kodem odbioru.</p>
    </header>
    <div class="cart">
      <div class="cart__main">
        <div class="panel">
          <ul class="citems">${state.cart.map(item).join('')}</ul>
          <a href="#/narzedzia" class="link cart__more">${ic('plus')} Dorzuć coś jeszcze</a>
        </div>
        <div class="panel">
          <h2 class="h3">Termin</h2>
          <div class="cart__term">
            <div id="cal"></div>
            <div class="cart__note">
              <p>${ic('truck')} Zamówisz do ${CUTOFF}:00 — narzędzia mogą być w paczkomacie <b>jutro od 10:00</b>. W niedziele nie dowozimy.</p>
              <p>${ic('return')} Zwracasz do 23:59 ostatniego dnia, w dowolnym paczkomacie.</p>
              ${waiting.length ? `<p class="warn">${ic('clock')} ${waiting.map(t => t.short).join(', ')} wraca do nas dopiero ${fmtDay(min)} — wcześniej nie wyślemy całej skrzynki.</p>` : ''}
            </div>
          </div>
        </div>
        <div class="panel">
          <h2 class="h3">Ochrona</h2>
          <div class="prots" role="radiogroup" aria-label="Wariant ochrony">${PROTECTION.map(p => `
            <label class="prot">
              <input type="radio" name="prot" value="${p.id}" ${state.protection === p.id ? 'checked' : ''}>
              <span class="prot__name">${p.name}${p.id === 'basic' ? ' <i>najczęściej</i>' : ''}</span>
              <span class="prot__price">${p.perDay ? `+${zl(p.perDay)} / dzień za narzędzie` : 'w cenie'}</span>
              <span class="prot__desc">${p.desc}</span>
            </label>`).join('')}</div>
        </div>
      </div>
      <aside class="cart__side"><div class="panel summary" id="summary"></div></aside>
    </div>
  </section>`;

  const refresh = () => {
    const tt = totals(state.cart, state.from, state.to, state.protection);
    $$('.citem').forEach(li => { $('.citem__price', li).textContent = zl(rent(toolById(li.dataset.id), tt.days)); });
    $('#summary').innerHTML = summaryHTML(tt, state.from, state.to) + `
      <a class="btn btn--accent btn--lg btn--block" href="#/zamow">Zamawiam ${ic('arrow')}</a>
      <p class="summary__fine">Dalej: paczkomat, dane, umowa i płatność.</p>`;
  };
  rangePicker($('#cal'), {
    from: state.from, to: state.to, min,
    onChange(a, b) { state.from = a; state.to = b; unsign(); save(); refresh(); },
  });
  $$('.citem').forEach(li => {
    const it = state.cart.find(x => x.id === li.dataset.id);
    $$('[data-addon]', li).forEach(i => i.addEventListener('change', () => { it.addons[i.dataset.addon] = i.checked; unsign(); save(); refresh(); }));
    $('[data-remove]', li).addEventListener('click', () => {
      state.cart = state.cart.filter(x => x !== it);
      fixDates(state);
      unsign();
      save();
      updateHeader();
      pageCart();
    });
  });
  $$('[name="prot"]').forEach(r => r.addEventListener('change', () => { state.protection = r.value; unsign(); save(); refresh(); }));
  refresh();
}

// ---------- checkout ----------
function pageCheckout() {
  if (!state.cart.length) { location.replace('#/skrzynka'); return; }
  getDraft();
  const top = maxStep();
  state.step = Math.max(1, Math.min(state.step || 1, top));
  app.innerHTML = `
  <section class="wrap page checkout">
    <ol class="stepper" aria-label="Kroki zamówienia">${STEPS.map((s, i) => {
      const n = i + 1, cls = n === state.step ? 'is-now' : n < state.step ? 'is-done' : '';
      return `<li><button type="button" class="${cls}" data-step="${n}" ${n > top ? 'disabled' : ''} ${n === state.step ? 'aria-current="step"' : ''}><i>${n < state.step ? ic('check') : n}</i><span>${s}</span></button></li>`;
    }).join('')}</ol>
    <div class="checkout__grid">
      <div class="checkout__main" id="step"></div>
      <aside class="checkout__side"><div class="panel summary" id="summary"></div></aside>
    </div>
  </section>`;
  $$('[data-step]').forEach(b => b.addEventListener('click', () => goStep(+b.dataset.step)));
  paintSide();
  [stepLocker, stepDetails, stepContract, stepPay][state.step - 1]($('#step'));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => goStep(+b.dataset.go)));
}

function goStep(n) {
  state.step = n;
  save();
  pageCheckout();
  window.scrollTo({ top: 0 });
}

function paintSide() {
  const tt = totals(state.cart, state.from, state.to, state.protection), lk = lockerById(state.lockerId);
  $('#summary').innerHTML = `
    <ul class="mini">${state.cart.map(it => `<li><span class="mini__art">${toolArt(it.id, { shadow: false })}</span><span>${toolById(it.id).short}</span></li>`).join('')}</ul>
    ${summaryHTML(tt, state.from, state.to)}
    <p class="summary__lk">${ic('locker')} ${lk ? `<span><b>${lk.id}</b> · ${lk.street}, ${lk.city}</span>` : '<span>Paczkomat jeszcze nie wybrany</span>'}</p>`;
}

function stepLocker(root) {
  let query = '';
  root.innerHTML = `
    <h1 class="h2">Gdzie odbierzesz narzędzia?</h1>
    <p class="step__lead">Zwrócić możesz w dowolnym paczkomacie — wybierzesz go dopiero przy zwrocie.</p>
    <div class="term">${ic('cal')}<div><b>${fmtLong(state.from)} od 10:00 → ${fmtLong(state.to)} do 23:59</b><span>${dni(rentDays(state.from, state.to))} · kod odbioru przyjdzie SMS-em rano w dniu startu</span></div><a class="link" href="#/skrzynka">Zmień</a></div>
    <div class="cities" role="group" aria-label="Miasto">${Object.keys(CITIES).map(c => `<button type="button" class="chip chip--sm" data-city="${c}" aria-pressed="${c === state.city}">${c}</button>`).join('')}</div>
    <label class="search">${ic('search')}<input type="search" id="lq" placeholder="Ulica albo kod, np. Legnicka, KRK-014" aria-label="Szukaj paczkomatu"></label>
    <div class="picker">
      <div class="picker__map" id="map"></div>
      <ul class="picker__list" id="lockers"></ul>
    </div>
    <p class="err" id="lockerErr" role="alert" hidden></p>
    <div class="step__actions">
      <a class="btn btn--ghost" href="#/skrzynka">${ic('back')} Skrzynka</a>
      <button type="button" class="btn btn--accent btn--lg" id="next">Dalej: dane do umowy ${ic('arrow')}</button>
    </div>`;

  const err = $('#lockerErr', root);
  const paint = () => {
    const ql = norm(query);
    const list = LOCKERS.filter(l => (ql ? norm(`${l.id} ${l.street} ${l.city} ${l.place}`).includes(ql) : l.city === state.city));
    const city = ql && list[0] ? list[0].city : state.city;
    $$('[data-city]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.city === city));
    $('#map', root).innerHTML = `<div class="map">${cityMap(city)}
      ${LOCKERS.filter(l => l.city === city).map(l => `<button type="button" class="pin ${l.id === state.lockerId ? 'is-on' : ''} ${lockerFit(l).ok ? '' : 'is-full'}" style="left:${l.x}%;top:${l.y}%" data-lk="${l.id}" aria-label="Paczkomat ${l.id}, ${l.street}">${ic('locker')}<span>${l.id}</span></button>`).join('')}
      <span class="map__city">${city}</span></div>`;
    $('#lockers', root).innerHTML = list.length ? list.map(l => {
      const fit = lockerFit(l);
      return `<li><button type="button" class="lk ${l.id === state.lockerId ? 'is-on' : ''} ${fit.ok ? '' : 'is-full'}" data-lk="${l.id}" aria-pressed="${l.id === state.lockerId}">
        <span class="lk__code">${l.id}</span>
        <span class="lk__addr"><b>${l.street}</b><span>${l.place}</span></span>
        <span class="lk__km">${l.km.toLocaleString('pl-PL')} km</span>
        <span class="lk__sizes" aria-label="Wolne skrytki">${['A', 'B', 'C'].map(s => `<i class="${l.free[s] ? '' : 'is-off'}" title="Wolne skrytki ${s}: ${l.free[s]}">${s}</i>`).join('')}</span>
        ${fit.ok ? '' : `<span class="lk__warn">Brak wolnej skrytki ${fit.miss} na Twoje narzędzia</span>`}
      </button></li>`;
    }).join('') : '<li class="picker__empty">Nie znaleźliśmy takiego paczkomatu. Spróbuj nazwy ulicy albo miasta.</li>';
  };

  root.addEventListener('click', e => {
    const c = e.target.closest('[data-city]');
    if (c) { state.city = c.dataset.city; query = ''; $('#lq', root).value = ''; save(); return paint(); }
    const b = e.target.closest('[data-lk]');
    if (!b) return;
    const l = lockerById(b.dataset.lk);
    const fit = lockerFit(l);
    if (!fit.ok) {
      err.textContent = `W paczkomacie ${l.id} nie ma teraz wolnej skrytki ${fit.miss}. Wybierz inny — zwykle wystarczy ten obok.`;
      err.hidden = false;
      return;
    }
    err.hidden = true;
    if (state.lockerId !== l.id) unsign();
    state.lockerId = l.id;
    state.city = l.city;
    save();
    paint();
    paintSide();
  });
  $('#lq', root).addEventListener('input', e => { query = e.target.value; paint(); });
  $('#next', root).addEventListener('click', () => {
    const l = lockerById(state.lockerId);
    if (!l || !lockerFit(l).ok) {
      err.textContent = 'Wybierz paczkomat z listy albo na mapie.';
      err.hidden = false;
      return;
    }
    goStep(2);
  });
  paint();
}

function stepDetails(root) {
  const c = state.customer;
  const field = (k, label, attrs = '', wide = false) => `
    <label class="field ${wide ? 'field--wide' : ''}"><span>${label}</span>
      <input class="input" data-k="${k}" value="${esc(c[k] || '')}" ${attrs}>
      <small class="field__err" data-err="${k}"></small></label>`;
  root.innerHTML = `
    <div class="step__head">
      <h1 class="h2">Dane do umowy</h1>
      <button type="button" class="btn btn--sm btn--ghost" id="fill">${ic('bolt')} Wypełnij danymi testowymi</button>
    </div>
    <p class="step__lead">Te dane trafią do umowy najmu. Na numer telefonu wyślemy kod do podpisu i kod odbioru z paczkomatu.</p>
    <form class="form" id="form" novalidate>
      ${field('name', 'Imię i nazwisko', 'autocomplete="name"', true)}
      ${field('email', 'E-mail', 'type="email" autocomplete="email" placeholder="jan@example.com"')}
      <label class="field"><span>Telefon</span>
        <span class="input-pre"><i>+48</i><input class="input" data-k="phone" value="${esc(c.phone || '')}" inputmode="tel" autocomplete="tel-national" placeholder="600 100 200"></span>
        <small class="field__err" data-err="phone"></small></label>
      ${field('street', 'Ulica i numer', 'autocomplete="street-address"', true)}
      ${field('zip', 'Kod pocztowy', 'inputmode="numeric" autocomplete="postal-code" placeholder="00-000" maxlength="6"')}
      ${field('city', 'Miejscowość', 'autocomplete="address-level2"')}
    </form>
    <p class="note">${ic('shield')} Nie prosimy o PESEL ani skan dowodu. Tożsamość potwierdza podpis kodem SMS i płatność z Twojego konta.</p>
    <div class="step__actions">
      <button type="button" class="btn btn--ghost" data-go="1">${ic('back')} Paczkomat</button>
      <button type="button" class="btn btn--accent btn--lg" id="next">Dalej: umowa ${ic('arrow')}</button>
    </div>`;

  $$('[data-k]', root).forEach(i => i.addEventListener('input', () => {
    const k = i.dataset.k;
    if (k === 'phone') { const d = digits(i.value).slice(0, 9); i.value = d.replace(/(\d{3})(?=\d)/g, '$1 '); }
    if (k === 'zip') { const d = digits(i.value).slice(0, 5); i.value = d.length > 2 ? d.slice(0, 2) + '-' + d.slice(2) : d; }
    state.customer[k] = i.value.trim();
    i.classList.remove('is-bad');
    $(`[data-err="${k}"]`, root).textContent = '';
    unsign();
    save();
  }));
  $('#fill', root).addEventListener('click', () => {
    state.customer = { ...TEST_CUSTOMER };
    unsign();
    save();
    stepDetails(root);
    $$('[data-go]', root).forEach(b => b.addEventListener('click', () => goStep(+b.dataset.go)));
  });
  $('#next', root).addEventListener('click', () => {
    const p = customerProblems();
    Object.entries(p).forEach(([k, msg]) => {
      $(`[data-k="${k}"]`, root).classList.add('is-bad');
      $(`[data-err="${k}"]`, root).textContent = msg;
    });
    const first = Object.keys(p)[0];
    if (first) return $(`[data-k="${first}"]`, root).focus();
    goStep(3);
  });
}

function stepContract(root) {
  const d = getDraft(), o = draftOrder();
  if (d.sig) {
    root.innerHTML = `
      <h1 class="h2">Umowa podpisana</h1>
      <div class="signed">${ic('check')}<div><b>Podpisano ${fmtStamp(d.sig.at)}</b><span>Kod SMS potwierdzony · odcisk SHA-256 <span class="mono">${d.sig.hash.slice(0, 16)}…</span></span></div></div>
      <div class="doc"><div class="doc__scroll" tabindex="0" aria-label="Treść umowy">${contractHTML(o)}</div></div>
      <p class="step__fine">Umowa wejdzie w życie po opłaceniu. Jeśli zmienisz dane, paczkomat, termin albo zawartość skrzynki, poprosimy o ponowny podpis.</p>
      <div class="step__actions">
        <button type="button" class="btn btn--ghost" id="resign">${ic('pen')} Podpisz ponownie</button>
        <button type="button" class="btn btn--accent btn--lg" data-go="4">Dalej: płatność ${ic('arrow')}</button>
      </div>`;
    $('#resign', root).addEventListener('click', () => { unsign(); goStep(3); });
    return;
  }

  const consent = (k, html, req) => `<label class="check"><input type="checkbox" data-c="${k}" ${req ? 'data-req' : ''}><span class="check__box">${ic('check')}</span><span>${html}${req ? ' <i class="req" aria-label="wymagane">*</i>' : ''}</span></label>`;
  root.innerHTML = `
    <h1 class="h2">Umowa najmu</h1>
    <p class="step__lead">Przeczytaj, zaznacz zgody i podpisz palcem albo myszką. Podpis potwierdzisz kodem SMS.</p>
    <div class="doc">
      <div class="doc__scroll" id="doc" tabindex="0" aria-label="Treść umowy">${contractHTML(o)}</div>
      <div class="doc__foot"><span class="doc__bar"><span id="readBar"></span></span><span id="readTxt">Przeczytano 0%</span></div>
    </div>
    <div class="consents">
      ${consent('terms', 'Akceptuję treść umowy i <button type="button" class="link" id="rules">Regulamin wypożyczalni</button>.', true)}
      ${consent('safety', 'Przed pierwszym użyciem zapoznam się z instrukcją obsługi i zasadami BHP.', true)}
      ${consent('start', 'Żądam rozpoczęcia najmu przed upływem 14 dni na odstąpienie od umowy.', true)}
      ${consent('news', 'Chcę dostawać e-mailem porady i rabaty (opcjonalnie).', false)}
    </div>
    <div class="sign">
      <div class="sign__head">
        <h2 class="h3">Podpis Najemcy</h2>
        <div class="seg seg--sm" role="tablist" aria-label="Sposób podpisu">
          <button type="button" role="tab" class="seg__b" data-mode="draw" aria-selected="true">${ic('pen')} Narysuj</button>
          <button type="button" role="tab" class="seg__b" data-mode="type" aria-selected="false">Aa Wpisz</button>
        </div>
      </div>
      <div class="sign__pad" data-panel="draw">
        <canvas id="pad" aria-label="Pole podpisu — narysuj podpis"></canvas>
        <span class="sign__x" aria-hidden="true">✕</span><span class="sign__line" aria-hidden="true"></span>
        <span class="sign__hint" aria-hidden="true">Podpisz się tutaj</span>
        <button type="button" class="link sign__clear" id="clear">Wyczyść</button>
      </div>
      <div class="sign__type" data-panel="type" hidden>
        <input class="input" id="typed" value="${esc(state.customer.name)}" aria-label="Imię i nazwisko do podpisu">
        <div class="sign__preview" id="preview">${esc(state.customer.name)}</div>
      </div>
    </div>
    <p class="err" id="signErr" role="alert" hidden></p>
    <div class="step__actions">
      <button type="button" class="btn btn--ghost" data-go="2">${ic('back')} Dane</button>
      <button type="button" class="btn btn--accent btn--lg" id="sign">${ic('pen')} Podpisz kodem SMS</button>
    </div>`;

  const doc = $('#doc', root), bar = $('#readBar', root), txt = $('#readTxt', root);
  const onScroll = () => {
    const p = Math.min(100, Math.round((doc.scrollTop / Math.max(1, doc.scrollHeight - doc.clientHeight)) * 100));
    bar.style.width = p + '%';
    txt.textContent = p >= 99 ? 'Przeczytano całość' : `Przeczytano ${p}%`;
  };
  doc.addEventListener('scroll', onScroll, { passive: true });

  let mode = 'draw';
  const padWrap = $('.sign__pad', root);
  const pad = signaturePad($('#pad', root), () => padWrap.classList.toggle('has-ink', !pad.isEmpty()));
  $('#clear', root).addEventListener('click', () => pad.clear());
  $$('[data-mode]', root).forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    $$('[data-mode]', root).forEach(x => x.setAttribute('aria-selected', x === b));
    $$('[data-panel]', root).forEach(p => { p.hidden = p.dataset.panel !== mode; });
    if (mode === 'draw') pad.resize();
  }));
  $('#typed', root).addEventListener('input', e => { $('#preview', root).textContent = e.target.value; });
  $('#rules', root).addEventListener('click', e => { e.preventDefault(); rulesModal(); });

  const err = $('#signErr', root);
  $('#sign', root).addEventListener('click', async () => {
    const missing = $$('[data-req]', root).filter(i => !i.checked);
    if (missing.length) {
      err.textContent = 'Zaznacz wymagane zgody (oznaczone gwiazdką).';
      err.hidden = false;
      return missing[0].focus();
    }
    const typed = $('#typed', root).value.trim();
    if (mode === 'draw' ? pad.isEmpty() : typed.length < 3) {
      err.textContent = mode === 'draw' ? 'Narysuj podpis w ramce — wystarczy jeden zamaszysty ruch.' : 'Wpisz imię i nazwisko.';
      err.hidden = false;
      return;
    }
    err.hidden = true;
    const img = mode === 'draw' ? pad.toDataURL() : await typedSignature(typed);
    const res = await smsSign(o);
    if (!res) {
      err.textContent = 'Podpis anulowany. Możesz spróbować jeszcze raz.';
      err.hidden = false;
      return;
    }
    d.sig = { img, at: res.at, hash: res.hash, mode, consents: Object.fromEntries($$('[data-c]', root).map(i => [i.dataset.c, i.checked])) };
    toast('Umowa podpisana', 'pen');
    goStep(3);
  });
}

function stepPay(root) {
  const o = draftOrder(), tt = o.totals;
  const depNote = {
    card: 'zablokujemy na karcie — nic nie zejdzie z konta',
    blik: 'pobierzemy razem z czynszem i oddamy w 24 h po zwrocie',
    transfer: 'doliczymy do przelewu i oddamy w 24 h po zwrocie',
  };
  root.innerHTML = `
    <h1 class="h2">Płatność</h1>
    <div class="paysum">
      <div><span>Czynsz i dostawa</span><b>${zl(tt.total)}</b><small>płatne teraz</small></div>
      <div><span>Kaucja zwrotna</span><b>${zl(tt.deposit)}</b><small id="depNote"></small></div>
    </div>
    <div id="pay"></div>
    <button type="button" class="btn btn--accent btn--lg btn--block" id="payBtn"></button>
    <p class="step__fine center">Płacąc, zawierasz umowę ${contractNo(o)} podpisaną w poprzednim kroku.</p>
    <div class="step__actions"><button type="button" class="btn btn--ghost" data-go="3">${ic('back')} Umowa</button></div>`;

  const btn = $('#payBtn', root);
  const pay = createPayment($('#pay', root), {
    amount: tt.total, deposit: tt.deposit, title: `Zamówienie ${o.ref}`, payer: state.customer.name,
    onMethod: m => {
      $('#depNote', root).textContent = depNote[m];
      btn.innerHTML = m === 'card' ? `${ic('lock')} Zapłać ${zl(tt.total)}` : `${ic('lock')} Zapłać ${zl(tt.total + tt.deposit)} <small>z kaucją</small>`;
    },
  });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const res = await pay.pay();
    btn.disabled = false;
    if (res) createOrder(res);
  });
}

function createOrder(payment) {
  const o = draftOrder(), now = Date.now();
  const order = {
    ...o, payment, status: 'paid', clock: now, extensions: [],
    pickupCode: rand6(),
    cells: assignCells(o.lockerId, o.items.map(it => toolById(it.id).size), o.ref),
    events: [
      { at: o.sig.at, text: `Umowa ${contractNo(o)} podpisana kodem SMS wysłanym na ${maskPhone(o.customer.phone)}.` },
      { at: now, text: `Zapłacono ${zl(o.totals.total)} (${payment.label}). Kaucja ${zl(o.totals.deposit)} ${payment.method === 'card' ? 'zablokowana na karcie' : 'pobrana'}. Umowa weszła w życie.` },
    ],
  };
  orders.save(order);
  state.cart = [];
  state.step = 1;
  draft = null;
  fixDates(state);
  save();
  location.hash = `#/z/${order.ref}`;
  setTimeout(() => notify({
    app: 'Poczta', icon: 'doc', title: `Zamówienie ${order.ref} przyjęte`,
    body: `Umowa ${contractNo(order)} w załączniku. Narzędzia będą w paczkomacie ${order.lockerId} ${fmtDay(order.from)} od 10:00.`,
  }), 900);
}

// ---------- order lifecycle ----------
const log = (o, text) => o.events.push({ at: o.clock, text });

function headline(o) {
  const lk = lockerById(o.lockerId);
  switch (o.status) {
    case 'paid': return ['Zamówienie opłacone', `Umowa podpisana. Narzędzia będą w paczkomacie ${lk.id} ${fmtLong(o.from)} od 10:00.`];
    case 'packing': return ['Kompletujemy narzędzia', 'Przegląd, czyszczenie, ładowanie akumulatorów — i do walizki.'];
    case 'shipped': return ['Narzędzia jadą do paczkomatu', `Będą w ${lk.id} ${fmtLong(o.from)} od 10:00.`];
    case 'ready': return ['Czekają na Ciebie w paczkomacie', `${lk.id} · ${lk.street}, ${lk.city}`];
    case 'using':
      if (o.returnCode) return ['Zwrot przygotowany', `Wpisz kod w paczkomacie ${o.returnLockerId} albo przyłóż QR do czytnika.`];
      return lateDays(o, o.clock)
        ? ['Spóźniasz się ze zwrotem', `Termin minął ${fmtLong(o.to)} o 23:59.`]
        : ['Narzędzia są u Ciebie', `Zwrot: ${fmtLong(o.to)}, do 23:59 — w dowolnym paczkomacie.`];
    case 'returning': return ['Narzędzia wracają do nas', 'Sprawdzimy je w ciągu 24 godzin od dostarczenia i zwolnimy kaucję.'];
    default: return ['Wynajem rozliczony', 'Dzięki! Narzędzia wróciły na tablicę i czekają na kolejną osobę.'];
  }
}

function leftText(o) {
  const ms = endOfDay(o.to) - o.clock;
  if (ms <= 0) { const d = lateDays(o, o.clock); return `spóźnienie: ${dni(d)} · ${zl(d * lateRate(o))}`; }
  const h = Math.floor(ms / HOUR);
  if (h >= 48) { const d = Math.floor(h / 24); return `${plural(d, 'został', 'zostały', 'zostało')} ${dni(d)}`; }
  if (h >= 1) return `${plural(h, 'została', 'zostały', 'zostało')} ${h} ${plural(h, 'godzina', 'godziny', 'godzin')}`;
  return 'została niecała godzina';
}

function stageHTML(o) {
  const lk = lockerById(o.lockerId);
  const late = lateDays(o, o.clock);
  const extendBtn = !o.returnCode && !late ? `<button type="button" class="btn btn--ghost" data-act="extend">${ic('cal')} Przedłuż</button>` : '';
  const problemBtn = `<button type="button" class="btn btn--ghost" data-act="problem">${ic('alert')} Zgłoś problem</button>`;

  if (['paid', 'packing', 'shipped'].includes(o.status)) {
    const step = { paid: 'Zamówienie trafiło do warsztatu.', packing: 'Sprawdzamy każde narzędzie, ładujemy akumulatory i pakujemy walizkę.', shipped: `Kurier wiezie przesyłkę nr <span class="mono">${o.tracking}</span>.` }[o.status];
    return `
      <div class="stage__row">
        <div class="stage__art peg peg--sm">${toolArt(o.items[0].id, { shadow: false })}</div>
        <div>
          <h2 class="h3">${step}</h2>
          <p>Narzędzia będą w paczkomacie <b>${lk.id}</b> (${lk.street}, ${lk.city}) <b>${fmtLong(o.from)} od 10:00</b>. Kod odbioru wyślemy SMS-em na ${maskPhone(o.customer.phone)}.</p>
        </div>
      </div>
      <div class="stage__actions">${extendBtn}${problemBtn}</div>`;
  }

  if (o.status === 'ready') {
    return `
      <div class="ticket">
        <div class="ticket__code"><span class="eyebrow">Kod odbioru</span><b>${spaced(o.pickupCode)}</b><span>Odbierz do ${fmtStamp(o.readyAt + PICKUP_HOURS * HOUR)}</span></div>
        <div class="ticket__qr">${qrSvg(o.pickupCode)}</div>
      </div>
      <p class="stage__where">${ic('pin')} <span>Paczkomat <b>${lk.id}</b> · ${lk.street}, ${lk.city} · ${lk.place} · ${o.cells.length > 1 ? 'skrytki' : 'skrytka'} nr ${o.cells.join(', ')}</span></p>
      <div class="stage__actions">
        <button type="button" class="btn btn--accent btn--lg" data-act="pickup">${ic('locker')} Idę do paczkomatu</button>
        ${extendBtn}${problemBtn}
      </div>`;
  }

  if (o.status === 'using' && o.returnCode) {
    const rlk = lockerById(o.returnLockerId);
    return `
      <div class="ticket ticket--return">
        <div class="ticket__code"><span class="eyebrow">Kod zwrotu</span><b>${spaced(o.returnCode)}</b><span>${late ? `Wpisz go w paczkomacie ${rlk.id} jak najszybciej — termin minął` : `Wpisz go w paczkomacie ${rlk.id} do ${fmtDay(o.to)}, 23:59`}</span></div>
        <div class="ticket__qr">${qrSvg(o.returnCode)}</div>
      </div>
      <p class="stage__where">${ic('pin')} <span>Zwrot w paczkomacie <b>${rlk.id}</b> · ${rlk.street}, ${rlk.city} · ${o.returnCells.length > 1 ? 'skrytki' : 'skrytka'} nr ${o.returnCells.join(', ')} otworzą się po wpisaniu kodu</span></p>
      ${late ? lateBanner(o, late) : ''}
      <div class="stage__actions">
        <button type="button" class="btn btn--accent btn--lg" data-act="drop">${ic('locker')} Idę do paczkomatu</button>
        <button type="button" class="btn btn--ghost" data-act="relocker">${ic('pin')} Zmień paczkomat</button>
      </div>`;
  }

  if (o.status === 'using') {
    const kitOpen = !o.kitOk && !o.kitIssue && o.clock < o.pickup.at + 2 * HOUR;
    const span = endOfDay(o.to) - o.pickup.at;
    const pct = Math.max(2, Math.min(100, ((o.clock - o.pickup.at) / span) * 100));
    return `
      ${late ? lateBanner(o, late) : ''}
      ${kitOpen ? `
      <div class="kitcheck">
        <h3 class="h3">${ic('box')} Sprawdź zestaw</h3>
        <p>Masz czas do <b>${fmtTime(o.pickup.at + 2 * HOUR)}</b> na zgłoszenie braków. Potem przyjmujemy, że wszystko było.</p>
        <div class="kitcheck__grid">${o.items.map(it => {
          const t = toolById(it.id);
          return `<div class="kitcheck__tool"><b>${t.short}</b>${t.kit.map(k => `<label class="check check--sm"><input type="checkbox" data-kit><span class="check__box">${ic('check')}</span><span>${k}</span></label>`).join('')}</div>`;
        }).join('')}</div>
        <div class="stage__actions">
          <button type="button" class="btn btn--dark" data-act="kitok">${ic('check')} Wszystko jest</button>
          <button type="button" class="btn btn--ghost" data-act="kitmissing">Czegoś brakuje</button>
        </div>
      </div>` : ''}
      <div class="due ${late ? 'is-late' : ''}">
        <div class="due__row"><div><span class="eyebrow">Zwrot do</span><b>${fmtLong(o.to)}, 23:59</b></div><span class="due__left">${leftText(o)}</span></div>
        <div class="due__bar"><span style="width:${pct}%"></span></div>
      </div>
      <div class="stage__actions">
        <button type="button" class="btn btn--accent btn--lg" data-act="return">${ic('return')} Zwracam narzędzia</button>
        ${extendBtn}
        <button type="button" class="btn btn--ghost" data-act="manual">${ic('doc')} Instrukcja</button>
        ${problemBtn}
      </div>
      <div class="tips">${o.items.map(it => { const t = toolById(it.id); return `<aside class="tip tip--sm"><span class="tip__icon">${ic('wrench')}</span><div><b>${t.short}</b><p>${t.tip}</p></div></aside>`; }).join('')}</div>`;
  }

  if (o.status === 'returning') {
    const rlk = lockerById(o.returnLockerId);
    return `
      <div class="stage__row">
        <div class="stage__icon">${ic('truck')}</div>
        <div>
          <h2 class="h3">Zwrot nadany ${fmtStamp(o.returnedAt)}</h2>
          <p>Paczkomat ${rlk.id}, ${rlk.street}, ${rlk.city}. Kurier zawiezie narzędzia do warsztatu — sprawdzimy je w ciągu 24 godzin od dostarczenia i zwolnimy kaucję ${zl(o.totals.deposit)}.</p>
          ${o.lateDays ? `<p class="warn">${ic('alert')} Zwrot ${dni(o.lateDays)} po terminie — naliczymy ${zl(o.lateFee)} i potrącimy z kaucji.</p>` : ''}
        </div>
      </div>`;
  }

  const s = o.done.settlement;
  return `
    <div class="settle">
      <span class="settle__icon">${ic('shield')}</span>
      <div>
        <h2 class="h3">${s.kept ? 'Kaucja rozliczona' : 'Kaucja zwolniona w całości'}</h2>
        <p>${s.kept ? `Potrąciliśmy ${zl(s.kept)} za ${dni(s.lateDays)} spóźnienia, a ${zl(s.released)} wraca do Ciebie.` : `${zl(s.released)} ${o.payment.method === 'card' ? 'odblokowaliśmy na karcie' : 'wróciło na Twoje konto'}. Narzędzia przeszły przegląd bez uwag.`}</p>
      </div>
    </div>
    <div class="rate">
      <p>Jak poszło?</p>
      <div class="rate__stars" role="group" aria-label="Oceń wynajem">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-rate="${n}" class="${(o.rating || 0) >= n ? 'is-on' : ''}" aria-label="${n} na 5">${ic('star')}</button>`).join('')}</div>
    </div>
    <div class="stage__actions">
      <button type="button" class="btn btn--accent" data-act="again">${ic('undo')} Wypożycz ponownie</button>
      <a class="btn btn--ghost" href="#/umowa/${o.ref}">${ic('doc')} Umowa i protokoły</a>
    </div>`;
}

function lateBanner(o, late) {
  return `<div class="banner">${ic('alert')}<div><b>Termin minął ${fmtDay(o.to)} o 23:59 — spóźnienie: ${dni(late)}</b>
    <p>Za każdą rozpoczętą dobę naliczamy ${zl(lateRate(o))} (czynsz za kolejny dzień + ${zl(LATE_FEE)} opłaty za narzędzie). Kwotę potrącimy z kaucji.</p></div></div>`;
}

function simInfo(o) {
  switch (o.status) {
    case 'paid': return { hint: 'Po naszej stronie: warsztat bierze zamówienie.', label: 'Skompletuj', kind: 'next' };
    case 'packing': return { hint: 'Kurier odbiera paczkę z warsztatu.', label: 'Nadaj przesyłkę', kind: 'next' };
    case 'shipped': return { hint: `Przesyłka dociera do ${o.lockerId} rano w dniu startu.`, label: 'Dostarcz do paczkomatu', kind: 'next' };
    case 'ready': return { hint: 'Twój ruch: odbierz narzędzia z paczkomatu.', label: 'Idę do paczkomatu', kind: 'pickup' };
    case 'using':
      if (o.returnCode) return { hint: 'Twój ruch: wrzuć narzędzia do paczkomatu.', label: 'Idę do paczkomatu', kind: 'drop' };
      if (o.clock < atHour(o.to, 17)) return { hint: 'Narzędzia pracują. Przewiń czas do dnia zwrotu albo oddaj wcześniej.', label: 'Przewiń do dnia zwrotu', kind: 'skip' };
      if (lateDays(o, o.clock)) return { hint: `Spóźnienie rośnie o ${zl(lateRate(o))} na dobę. Zwróć narzędzia — albo przewiń dalej.`, label: 'Przewiń o dobę', kind: 'day' };
      return { hint: 'Termin mija o 23:59. Przewiń, żeby zobaczyć spóźnienie — albo zwróć.', label: 'Przewiń o dobę', kind: 'day' };
    case 'returning': return { hint: 'Po naszej stronie: kurier wiezie zwrot do warsztatu.', label: 'Sprawdź w warsztacie', kind: 'next' };
    default: return { hint: 'Koniec scenariusza — wynajem rozliczony.', label: '', kind: '' };
  }
}

function simNext(o) {
  const lk = lockerById(o.lockerId);
  if (o.status === 'paid') {
    o.clock += 70 * 60e3;
    o.packedAt = o.clock;
    o.status = 'packing';
    log(o, `Warsztat kompletuje zamówienie: przegląd, czyszczenie, ładowanie akumulatorów, pakowanie. Numery ewidencyjne: ${o.items.map(it => it.serial).join(', ')}.`);
  } else if (o.status === 'packing') {
    o.clock = Math.max(o.clock + 2 * HOUR, atHour(addDays(o.from, -1), 17.5));
    o.tracking = '6' + Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
    o.status = 'shipped';
    log(o, `Nadaliśmy przesyłkę nr ${o.tracking} do paczkomatu ${o.lockerId}.`);
    notify({ app: 'Skrzynka', icon: 'truck', title: 'Narzędzia w drodze', body: `${fmtDay(o.from)} od 10:00 będą w paczkomacie ${o.lockerId}. Kod odbioru przyjdzie SMS-em.` });
  } else if (o.status === 'shipped') {
    o.clock = Math.max(o.clock + 3 * HOUR, atHour(o.from, 9 + 40 / 60));
    o.readyAt = o.clock;
    o.status = 'ready';
    log(o, `Przesyłka czeka w paczkomacie ${o.lockerId} (${o.cells.length > 1 ? 'skrytki' : 'skrytka'} ${o.cells.join(', ')}). Kod odbioru wysłany SMS-em.`);
    notify({
      title: 'SKRZYNKA', body: `Twoje narzędzia czekają w paczkomacie ${o.lockerId}, ${lk.street}. Kod odbioru: ${spaced(o.pickupCode)}. Odbierz do ${fmtStamp(o.readyAt + PICKUP_HOURS * HOUR)}.`,
      onTap: () => { location.hash = `#/z/${o.ref}`; },
    });
  } else if (o.status === 'returning') {
    o.clock += 20 * HOUR;
    const lateFee = o.lateFee || 0, kept = Math.min(lateFee, o.totals.deposit);
    o.done = { at: o.clock, settlement: { lateDays: o.lateDays || 0, lateFee, kept, released: o.totals.deposit - kept } };
    o.status = 'done';
    log(o, `Zwrot dotarł do warsztatu. Przegląd bez uwag: narzędzia kompletne i sprawne. ${kept ? `Potrącono ${zl(kept)} za spóźnienie, zwolniono ${zl(o.totals.deposit - kept)}.` : `Kaucja ${zl(o.totals.deposit)} zwolniona.`}`);
    notify({ app: 'Skrzynka', icon: 'shield', title: kept ? 'Kaucja rozliczona' : 'Kaucja zwolniona', body: `${zl(o.totals.deposit - kept)} ${o.payment.method === 'card' ? 'odblokowane na karcie' : 'wraca na Twoje konto'}. Protokół zwrotu jest w zamówieniu.` });
  }
  orders.save(o);
}

function onPickup(o) {
  o.clock = Math.max(o.clock, o.readyAt) + 25 * 60e3;
  o.pickup = { at: o.clock, cells: o.cells };
  o.status = 'using';
  log(o, `Odebrano narzędzia z paczkomatu ${o.lockerId} (${o.cells.length > 1 ? 'skrytki' : 'skrytka'} ${o.cells.join(', ')}). Protokół wydania dołączony do umowy.`);
  orders.save(o);
  pageOrder(o.ref);
}

function onDrop(o) {
  o.clock += 15 * 60e3;
  o.returnedAt = o.clock;
  o.lateDays = lateDays(o, o.clock);
  o.lateFee = o.lateDays * lateRate(o);
  o.status = 'returning';
  log(o, `Zwrot nadany w paczkomacie ${o.returnLockerId} (${o.returnCells.length > 1 ? 'skrytki' : 'skrytka'} ${o.returnCells.join(', ')})${o.lateDays ? ` — ${dni(o.lateDays)} po terminie` : ''}.`);
  orders.save(o);
  pageOrder(o.ref);
  setTimeout(() => notify({ title: 'SKRZYNKA', body: `Zwrot zamówienia ${o.ref} nadany w paczkomacie ${o.returnLockerId}. Kaucję zwolnimy po sprawdzeniu narzędzi.` }), 1200);
}

function pageOrder(ref) {
  const o = orders.get(ref);
  if (!o) return pageNotFound('Nie ma takiego zamówienia', 'Zamówienia w makiecie zapisujemy tylko w tej przeglądarce.');
  const idx = FLOW.findIndex(f => f.id === o.status);
  const lk = lockerById(o.lockerId);
  const [title, sub] = headline(o);
  const paid = o.totals.total + o.extensions.reduce((a, x) => a + x.amount, 0);
  const sim = simInfo(o);
  const depState = o.done
    ? `Kaucja ${o.done.settlement.kept ? 'rozliczona' : 'zwolniona'}: ${zl(o.done.settlement.released)} wróciło`
    : o.payment.method === 'card' ? `Kaucja ${zl(o.totals.deposit)} zablokowana na karcie` : `Kaucja ${zl(o.totals.deposit)} pobrana — wróci po sprawdzeniu`;

  app.innerHTML = `
  <section class="wrap page order">
    <a class="back" href="#/zamowienia">${ic('back')} Zamówienia</a>
    <header class="order__head">
      <p class="eyebrow">Zamówienie ${o.ref} · umowa ${contractNo(o)}</p>
      <h1 class="h1">${title}</h1>
      <p class="lead">${sub}</p>
    </header>
    <ol class="track" aria-label="Postęp zamówienia">${FLOW.map((f, i) => `<li class="${i < idx ? 'is-done' : i === idx ? 'is-now' : ''}" ${i === idx ? 'aria-current="step"' : ''}><span class="track__dot">${ic(i < idx ? 'check' : f.icon)}</span><span class="track__l">${f.label}</span></li>`).join('')}</ol>
    <div class="order__grid">
      <div class="order__main">
        <div class="panel stage" id="stage">${stageHTML(o)}</div>
        <div class="panel">
          <h2 class="h3">Historia</h2>
          <ol class="events">${o.events.slice().reverse().map(e => `<li><time>${fmtStamp(e.at)}</time><p>${e.text}</p></li>`).join('')}</ol>
        </div>
      </div>
      <aside class="order__side">
        <div class="panel">
          <h2 class="h3">Narzędzia</h2>
          <ul class="oitems">${o.items.map(it => { const t = toolById(it.id); return `<li><a class="oitems__art peg peg--sm" href="#/n/${t.id}" tabindex="-1">${toolArt(t.id, { shadow: false })}</a><div><a href="#/n/${t.id}">${t.short}</a><span class="mono">${it.serial}</span></div></li>`; }).join('')}</ul>
        </div>
        <div class="panel">
          <h2 class="h3">Dokumenty</h2>
          <ul class="docs">
            <li><a href="#/umowa/${o.ref}">${ic('doc')} Umowa najmu ${contractNo(o)}</a></li>
            ${o.extensions.map((x, i) => `<li><a href="#/umowa/${o.ref}/aneks-${i + 1}">${ic('doc')} Aneks nr ${i + 1} — przedłużenie</a></li>`).join('')}
            ${o.pickup ? `<li><a href="#/umowa/${o.ref}/wydanie">${ic('doc')} Protokół wydania</a></li>` : `<li class="is-off">${ic('doc')} Protokół wydania — po odbiorze</li>`}
            ${o.done ? `<li><a href="#/umowa/${o.ref}/zwrot">${ic('doc')} Protokół zwrotu</a></li>` : `<li class="is-off">${ic('doc')} Protokół zwrotu — po sprawdzeniu</li>`}
            <li><button type="button" class="link" data-act="receipt">${ic('card')} Potwierdzenie płatności</button></li>
          </ul>
        </div>
        <div class="panel">
          <h2 class="h3">Płatność</h2>
          <ul class="lines">${o.totals.lines.map(l => `<li class="${l.sub ? 'is-sub' : ''}"><span>${esc(l.label)}</span><b>${l.free ? 'gratis' : zl(l.amount)}</b></li>`).join('')}
            ${o.extensions.map((x, i) => `<li><span>Aneks nr ${i + 1}: +${dni(x.days)}</span><b>${zl(x.amount)}</b></li>`).join('')}</ul>
          <div class="summary__total"><span>Zapłacono</span><b>${zl(paid)}</b></div>
          <p class="dep">${ic('lock')} ${depState}</p>
          <p class="muted small">${o.payment.label}</p>
        </div>
        <div class="panel">
          <h2 class="h3">Termin i miejsce</h2>
          <p class="side-p">${ic('cal')} <span>${fmtDay(o.from)} od 10:00 → ${fmtDay(o.to)} do 23:59 · ${dni(rentDays(o.from, o.to))}</span></p>
          <p class="side-p">${ic('locker')} <span><b>${lk.id}</b> · ${lk.street}, ${lk.city}</span></p>
          <p class="side-p">${ic('shield')} <span>${protById(o.protection).name}</span></p>
        </div>
      </aside>
    </div>
  </section>
  <div class="sim" role="region" aria-label="Symulacja czasu">
    <div class="wrap sim__in">
      <span class="sim__badge">Symulacja</span>
      <span class="sim__clock">${ic('clock')} ${fmtStamp(o.clock)}</span>
      <span class="sim__hint">${sim.hint}</span>
      ${sim.label ? `<button type="button" class="btn btn--sm sim__btn" data-sim="${sim.kind}">${sim.label} ${ic('arrow')}</button>` : ''}
    </div>
  </div>`;

  const rerender = () => pageOrder(o.ref);
  const actions = {
    pickup: () => openLocker({ mode: 'pickup', order: o, onDone: () => onPickup(o) }),
    drop: () => openLocker({ mode: 'return', order: o, onDone: () => onDrop(o) }),
    return: () => returnFlow(o, false, rerender),
    relocker: () => returnFlow(o, true, rerender),
    extend: () => extendFlow(o, rerender),
    problem: () => problemFlow(o, '', rerender),
    kitmissing: () => problemFlow(o, 'missing', rerender),
    kitok: () => {
      const boxes = $$('[data-kit]', app);
      if (boxes.some(b => !b.checked)) {
        toast('Odhacz wszystkie elementy — albo zgłoś, czego brakuje.', 'info');
        const first = boxes.find(b => !b.checked);
        if (first) first.focus();
        return;
      }
      o.clock += 10 * 60e3;
      o.kitOk = o.clock;
      log(o, 'Najemca potwierdził kompletność zestawu.');
      orders.save(o);
      toast('Zestaw kompletny — dzięki!');
      rerender();
    },
    manual: () => manualModal(o),
    receipt: () => receiptModal(o),
    again: () => {
      state.cart = o.items.map(it => ({ id: it.id, addons: { ...it.addons } }));
      fixDates(state);
      unsign();
      save();
      location.hash = '#/skrzynka';
    },
  };
  $$('[data-act]', app).forEach(b => b.addEventListener('click', () => actions[b.dataset.act]()));
  $$('[data-rate]', app).forEach(b => b.addEventListener('click', () => {
    o.rating = +b.dataset.rate;
    orders.save(o);
    toast('Dzięki za ocenę!', 'star');
    rerender();
  }));
  const simBtn = $('[data-sim]', app);
  if (simBtn) simBtn.addEventListener('click', () => {
    const kind = simBtn.dataset.sim;
    if (kind === 'pickup' || kind === 'drop') return actions[kind]();
    if (kind === 'skip') { o.clock = Math.max(o.clock, atHour(o.to, 17)); log(o, 'Ostatni dzień najmu.'); orders.save(o); }
    else if (kind === 'day') { o.clock += DAY; orders.save(o); }
    else simNext(o);
    rerender();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Checklist + locker for the return; onlyLocker = just switch the locker of an existing return code.
function returnFlow(o, onlyLocker, done) {
  const current = o.returnLockerId || o.lockerId;
  const cities = Object.keys(CITIES);
  const kitTools = o.items.map(it => toolById(it.id));
  const extra = ['Narzędzie oczyszczone z grubsza', 'Wszystko spakowane w walizce lub torbie'];
  const late = lateDays(o, o.clock);
  const m = modal({
    cls: 'modal--form', label: 'Zwrot narzędzi',
    html: `
    <div class="mform">
      <h2 class="h3">${onlyLocker ? 'Zmień paczkomat zwrotu' : 'Zwrot narzędzi'}</h2>
      ${onlyLocker ? '' : `<p class="muted">Odhacz, co pakujesz — dzięki temu sprawdzimy zwrot szybciej i szybciej oddamy kaucję.</p>
      <div class="kitcheck__grid">${kitTools.map(t => `<div class="kitcheck__tool"><b>${t.short}</b>${t.kit.map(k => `<label class="check check--sm"><input type="checkbox" data-rk><span class="check__box">${ic('check')}</span><span>${k}</span></label>`).join('')}</div>`).join('')}
        <div class="kitcheck__tool"><b>Na koniec</b>${extra.map(k => `<label class="check check--sm"><input type="checkbox" data-rk><span class="check__box">${ic('check')}</span><span>${k}</span></label>`).join('')}</div>
      </div>`}
      <label class="field"><span>Paczkomat zwrotu</span>
        <select class="input select" id="rl">${cities.map(c => `<optgroup label="${c}">${LOCKERS.filter(l => l.city === c).map(l => `<option value="${l.id}" ${l.id === current ? 'selected' : ''}>${l.id} · ${l.street}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <p class="hint">Dowolny paczkomat w Polsce — nie musi być ten, w którym był odbiór.</p>
      ${late && !onlyLocker ? `<p class="warn">${ic('alert')} Spóźnienie: ${dni(late)} · ${zl(late * lateRate(o))} potrącimy z kaucji.</p>` : ''}
      <p class="err" role="alert" hidden></p>
      <div class="code__row">
        <button type="button" class="btn btn--ghost" data-close>Anuluj</button>
        <button type="button" class="btn btn--accent" id="gen">${onlyLocker ? 'Zapisz' : `${ic('qr')} Generuj kod zwrotu`}</button>
      </div>
    </div>`,
  });
  $('#gen', m.el).addEventListener('click', () => {
    const boxes = $$('[data-rk]', m.el);
    if (boxes.some(b => !b.checked)) {
      const e = $('.err', m.el);
      e.textContent = 'Odhacz wszystko z listy. Jeśli czegoś brakuje, zgłoś to w zamówieniu — doliczymy brak zamiast blokować zwrot.';
      e.hidden = false;
      return;
    }
    const id = $('#rl', m.el).value;
    o.returnLockerId = id;
    o.returnCells = assignCells(id, o.items.map(it => toolById(it.id).size), o.ref + 'zwrot');
    if (!onlyLocker) o.returnCode = rand6();
    log(o, onlyLocker ? `Zmieniono paczkomat zwrotu na ${id}.` : `Wygenerowano kod zwrotu dla paczkomatu ${id}.`);
    orders.save(o);
    m.close();
    done();
    if (!onlyLocker) setTimeout(() => notify({ title: 'SKRZYNKA', body: `Kod zwrotu zamówienia ${o.ref}: ${spaced(o.returnCode)}. Wpisz go w paczkomacie ${id} albo przyłóż QR.` }), 600);
  });
}

function extendFlow(o, done) {
  let n = 1;
  const days = rentDays(o.from, o.to), prot = protById(o.protection);
  const price = k => o.items.reduce((a, it) => {
    const t = toolById(it.id);
    const perDayAddons = t.addons.filter(x => it.addons[x.id] && x.kind === 'day').reduce((s, x) => s + x.price * k, 0);
    return a + rent(t, days + k) - rent(t, days) + perDayAddons + prot.perDay * k;
  }, 0);
  const m = modal({
    cls: 'modal--form', label: 'Przedłuż najem',
    html: `
    <div class="mform">
      <h2 class="h3">Przedłuż najem</h2>
      <p class="muted">Teraz: do ${fmtFull(o.to)}, 23:59. Dopłacisz według cennika — bez opłat za spóźnienie.</p>
      <div class="stepper-n">
        <button type="button" class="icon-btn" data-d="-1" aria-label="Mniej dni">${ic('minus')}</button>
        <output id="n"></output>
        <button type="button" class="icon-btn" data-d="1" aria-label="Więcej dni">${ic('plus')}</button>
      </div>
      <p class="extend__to" id="to"></p>
      <div class="paysum paysum--sm"><div><span>Dopłata</span><b id="price"></b><small id="vs"></small></div></div>
      <div class="code__row">
        <button type="button" class="btn btn--ghost" data-close>Anuluj</button>
        <button type="button" class="btn btn--accent" id="go"></button>
      </div>
      <p class="hint">Zapłacisz tą samą metodą co za zamówienie (${o.payment.label}). Przedłużenie to aneks do umowy.</p>
    </div>`,
  });
  const paint = () => {
    $('#n', m.el).textContent = `+${dni(n)}`;
    $('#to', m.el).innerHTML = `Nowy termin: <b>${fmtLong(addDays(o.to, n))}, 23:59</b>`;
    $('#price', m.el).textContent = zl(price(n));
    $('#vs', m.el).textContent = `spóźnienie o tyle samo: ${zl(n * lateRate(o))}`;
    $('#go', m.el).textContent = `Dopłać ${zl(price(n))}`;
    $('[data-d="-1"]', m.el).disabled = n <= 1;
    $('[data-d="1"]', m.el).disabled = n >= 14;
  };
  $$('[data-d]', m.el).forEach(b => b.addEventListener('click', () => { n += +b.dataset.d; paint(); }));
  $('#go', m.el).addEventListener('click', async () => {
    const amount = price(n);
    m.close();
    const ok = await quickPay(amount, o.payment, `Przedłużenie ${o.ref}`);
    if (!ok) return toast('Płatność anulowana — termin bez zmian.', 'info');
    const to = addDays(o.to, n);
    o.extensions.push({ days: n, amount, at: o.clock, to });
    o.to = to;
    log(o, `Przedłużono najem o ${dni(n)}, do ${fmtFull(to)}. Dopłata ${zl(amount)} (${o.payment.label}). Aneks nr ${o.extensions.length} dołączony do umowy.`);
    orders.save(o);
    toast(`Przedłużone do ${fmtDay(to)}`, 'cal');
    done();
  });
  paint();
}

function problemFlow(o, preset, done) {
  const reasons = [
    ['missing', 'Brakuje czegoś w zestawie'],
    ['broken', 'Narzędzie nie działa'],
    ['damaged', 'Narzędzie zostało uszkodzone'],
    ['other', 'Coś innego'],
  ];
  const m = modal({
    cls: 'modal--form', label: 'Zgłoś problem',
    html: `
    <form class="mform" novalidate>
      <h2 class="h3">Zgłoś problem</h2>
      <div class="radios">${reasons.map(([id, label], i) => `<label class="check check--radio"><input type="radio" name="why" value="${id}" ${(preset || 'missing') === id ? 'checked' : ''}><span class="check__box"></span><span>${label}</span></label>`).join('')}</div>
      <label class="field"><span>Opisz krótko</span><textarea class="input" rows="3" id="what" placeholder="np. brak rękojeści bocznej"></textarea></label>
      <div class="code__row">
        <button type="button" class="btn btn--ghost" data-close>Anuluj</button>
        <button type="submit" class="btn btn--dark">Wyślij zgłoszenie</button>
      </div>
    </form>`,
  });
  $('form', m.el).addEventListener('submit', e => {
    e.preventDefault();
    const why = $('[name="why"]:checked', m.el).value;
    const label = reasons.find(r => r[0] === why)[1];
    const text = $('#what', m.el).value.trim();
    const no = Math.floor(1000 + Math.random() * 9000);
    const answer = {
      missing: 'Doślemy brakujący element do tego samego paczkomatu, bez dopłaty.',
      broken: 'Wyślemy sprawny egzemplarz następnego dnia, a za ten dzień oddamy czynsz.',
      damaged: `Rozliczymy szkodę według ochrony „${protById(o.protection).name}”.`,
      other: 'Konsultant oddzwoni w ciągu 15 minut.',
    }[why];
    if (why === 'missing' && o.pickup && !o.kitOk && !o.kitIssue) o.kitIssue = { at: o.clock, text: text || label };
    log(o, `Zgłoszenie nr ${no}: ${label}${text ? ` — „${esc(text)}”` : ''}. ${answer}`);
    orders.save(o);
    m.close();
    toast(`Zgłoszenie nr ${no} przyjęte. Oddzwonimy na ${maskPhone(o.customer.phone)}.`, 'phone');
    done();
  });
}

function manualModal(o) {
  modal({
    cls: 'modal--form', label: 'Instrukcja',
    html: `
    <div class="mform manual">
      <h2 class="h3">Instrukcja i bezpieczeństwo</h2>
      <ol class="manual__rules">
        <li>Przed pracą obejrzyj przewód, osłony i akumulator. Coś pęknięte? Nie włączaj — zgłoś.</li>
        <li>Okulary zawsze. Do cięcia i kucia dodatkowo rękawice i ochronniki słuchu.</li>
        <li>Wymieniasz wiertło, tarczę albo brzeszczot — najpierw wyjmij akumulator lub wtyczkę.</li>
        <li>Materiał trzymaj w imadle albo ściskiem, nie w drugiej ręce.</li>
      </ol>
      ${o.items.map(it => { const t = toolById(it.id); return `<section class="manual__tool"><h3>${t.name}</h3><p>${t.tip}</p><p class="muted small">W zestawie: ${t.kit.join(' · ')}</p></section>`; }).join('')}
      <p class="hint">Pełna instrukcja producenta leży w walizce. Tu, w makiecie, wystarczy ta ściągawka.</p>
      <div class="code__row"><button type="button" class="btn btn--dark" data-close>Rozumiem</button></div>
    </div>`,
  });
}

function receiptModal(o) {
  modal({
    cls: 'modal--form', label: 'Potwierdzenie płatności',
    html: `
    <div class="mform receipt">
      <p class="eyebrow">${COMPANY.name}</p>
      <h2 class="h3">Potwierdzenie płatności</h2>
      <dl class="tds__dl">
        <dt>Zamówienie</dt><dd>${o.ref}</dd>
        <dt>Data</dt><dd>${fmtDate(o.createdAt)}, ${fmtTime(o.createdAt)}</dd>
        <dt>Metoda</dt><dd>${o.payment.label}</dd>
        <dt>Czynsz i dostawa</dt><dd>${zl(o.totals.total)}</dd>
        ${o.extensions.map((x, i) => `<dt>Aneks nr ${i + 1}</dt><dd>${zl(x.amount)}</dd>`).join('')}
        <dt>Kaucja</dt><dd>${zl(o.totals.deposit)} · ${o.payment.method === 'card' ? 'blokada' : 'pobrana, zwrotna'}</dd>
      </dl>
      <p class="hint">Makieta — faktur i paragonów nie wystawiamy.</p>
      <div class="code__row"><button type="button" class="btn btn--dark" data-close>Zamknij</button></div>
    </div>`,
  });
}

function rulesModal() {
  modal({
    cls: 'modal--form', label: 'Regulamin',
    html: `
    <div class="mform">
      <h2 class="h3">Regulamin wypożyczalni (skrót)</h2>
      <ol class="manual__rules">
        <li>Wypożyczać mogą osoby pełnoletnie, z polskim numerem telefonu.</li>
        <li>Doba najmu kończy się o 23:59. Dzień odbioru liczy się jako pierwszy dzień najmu.</li>
        <li>Kaucja zabezpiecza zwrot narzędzi i jest rozliczana po przeglądzie w warsztacie.</li>
        <li>Narzędzia są przekazywane i zwracane wyłącznie przez paczkomaty sieci.</li>
        <li>Reklamacje rozpatrujemy w ciągu 14 dni. Kontakt: ${COMPANY.mail}.</li>
      </ol>
      <p class="hint">Tekst przykładowy — makieta.</p>
      <div class="code__row"><button type="button" class="btn btn--dark" data-close>Zamknij</button></div>
    </div>`,
  });
}

function pageOrders() {
  const list = orders.all().sort((a, b) => b.createdAt - a.createdAt);
  if (!list.length) return emptyBoard('Nie masz jeszcze zamówień', 'Tu zobaczysz status przesyłki, kody do paczkomatu, umowę i rozliczenie kaucji.');
  app.innerHTML = `
  <section class="wrap page">
    <header class="page__head"><h1 class="h1">Zamówienia</h1><p class="lead">Zapisane tylko w tej przeglądarce — to makieta.</p></header>
    <ul class="olist">${list.map(o => `
      <li><a class="ocard" href="#/z/${o.ref}">
        <span class="ocard__arts peg peg--sm">${o.items.slice(0, 3).map(it => toolArt(it.id, { shadow: false })).join('')}</span>
        <span class="ocard__body"><b>${o.items.map(it => toolById(it.id).short).join(', ')}</b><span>${o.ref} · ${fmtDay(o.from)} → ${fmtDay(o.to)} · ${o.lockerId}</span></span>
        <span class="pill pill--${o.status}">${FLOW.find(f => f.id === o.status).label}</span>
      </a></li>`).join('')}</ul>
  </section>`;
}

function pageContract(ref, anchor) {
  const o = orders.get(ref);
  if (!o) return pageNotFound('Nie ma takiej umowy', 'Umowy w makiecie zapisujemy tylko w tej przeglądarce.');
  app.innerHTML = `
  <section class="wrap page docpage">
    <div class="docpage__bar">
      <a class="back" href="#/z/${o.ref}">${ic('back')} Zamówienie ${o.ref}</a>
      <button type="button" class="btn btn--ghost btn--sm" id="print">${ic('print')} Drukuj / zapisz PDF</button>
    </div>
    <div class="paper">${contractHTML(o)}${annexesHTML(o)}</div>
  </section>`;
  $('#print').addEventListener('click', () => window.print());
  if (anchor) setTimeout(() => { const el = document.getElementById(anchor); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
}

function pageNotFound(title = 'Tu nic nie wisi', text = 'Tej strony nie ma na tablicy. Może wypożyczona?') {
  emptyBoard(title, text, `<a class="btn btn--accent btn--lg" href="#/">Strona główna</a>`);
}

// ---------- chrome: header, demo bar, theme ----------
function updateHeader() {
  const n = state.cart.length, cc = $('#cartCount');
  cc.textContent = n;
  cc.hidden = !n;
  const active = orders.all().filter(o => o.status !== 'done').length, oc = $('#orderCount');
  oc.textContent = active;
  oc.hidden = !active;
  const r = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  const section = { n: 'narzedzia', z: 'zamowienia', umowa: 'zamowienia', zamow: 'skrzynka' }[r] || r;
  $$('[data-nav]').forEach(a => a.classList.toggle('is-active', a.dataset.nav === section));
}

function renderTestData() {
  $('#testData').innerHTML = `
    <div class="wrap test-data__in">
      <div>
        <p class="test-data__t">BLIK</p>
        <ul><li><code>777 123</code>dowolne 6 cyfr — potem „Zatwierdź” w aplikacji</li><li><code>000 000</code>kod wygasł</li></ul>
        <p class="test-data__t">Dane klienta</p>
        <p>W kroku „Dane” jest przycisk „Wypełnij danymi testowymi”.</p>
      </div>
      <div>
        <p class="test-data__t">Karty · dowolna przyszła data i CVC</p>
        <ul>${TEST_CARDS.map(c => `<li><code>${c.number}</code>${c.result}</li>`).join('')}</ul>
      </div>
      <div>
        <p class="test-data__t">Kody SMS i paczkomat</p>
        <p>Kody do podpisu umowy, 3-D Secure, odbioru i zwrotu przychodzą jako powiadomienie u góry ekranu — dotknij go, żeby wkleić. W paczkomacie możesz też przyłożyć QR.</p>
        <button type="button" class="btn btn--sm btn--ghost" id="resetDemo">${ic('trash')} Wyczyść dane makiety</button>
      </div>
    </div>`;
  $('#resetDemo').addEventListener('click', () => {
    const m = modal({
      cls: 'modal--form', label: 'Wyczyścić dane?',
      html: `<div class="mform"><h2 class="h3">Wyczyścić dane makiety?</h2><p class="muted">Usuniemy skrzynkę, dane klienta i wszystkie zamówienia zapisane w tej przeglądarce.</p>
        <div class="code__row"><button type="button" class="btn btn--ghost" data-close>Zostaw</button><button type="button" class="btn btn--dark" id="yes">Wyczyść</button></div></div>`,
    });
    $('#yes', m.el).addEventListener('click', () => {
      store.drop(KEY);
      store.drop(ORDERS);
      location.hash = '#/';
      location.reload();
    });
  });
}

function setTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const btn = $('#themeBtn');
  btn.innerHTML = ic(dark ? 'sun' : 'moon');
  btn.setAttribute('aria-label', dark ? 'Jasny motyw' : 'Ciemny motyw');
}

// ---------- router ----------
let pendingScroll = null;

function route() {
  const [path, query] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const q = new URLSearchParams(query || '');
  switch (parts[0]) {
    case undefined: pageHome(); break;
    case 'narzedzia': pageCatalog(q); break;
    case 'n': pageTool(parts[1]); break;
    case 'skrzynka': pageCart(); break;
    case 'zamow': pageCheckout(); break;
    case 'zamowienia': pageOrders(); break;
    case 'z': pageOrder(parts[1]); break;
    case 'umowa': pageContract(parts[1], parts[2]); break;
    default: pageNotFound();
  }
  // dialogs belong to the page that opened them
  if (!$('.modal--busy')) {
    $('#modalRoot').innerHTML = '';
    document.body.classList.remove('has-modal');
  }
  document.body.classList.toggle('has-sim', !!$('.sim', app));
  updateHeader();
  if (pendingScroll) {
    const el = document.getElementById(pendingScroll);
    pendingScroll = null;
    if (el) return setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }
  if (parts[0] !== 'umowa' || !parts[2]) window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-scroll]');
  if (!a) return;
  e.preventDefault();
  const id = a.dataset.scroll;
  if (location.hash.replace(/^#\/?/, '') === '' && document.getElementById(id)) {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    pendingScroll = id;
    location.hash = '#/';
  }
});

$('#testDataBtn').addEventListener('click', e => {
  const panel = $('#testData'), open = panel.hidden;
  if (open && !panel.innerHTML) renderTestData();
  panel.hidden = !open;
  e.currentTarget.setAttribute('aria-expanded', open);
});
$('#themeBtn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  store.set('skrzynka-theme', next);
  setTheme(next);
});
// another tab placing an order or changing the cart
window.addEventListener('storage', e => {
  if (e.key === KEY || e.key === ORDERS) location.reload();
});
window.addEventListener('hashchange', route);

setTheme(store.get('skrzynka-theme', null));
$('#year').textContent = new Date().getFullYear();
route();
