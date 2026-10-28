// Namiar v1 — app: router, landing, builder, criteria catalog, checkout, orders and file export.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const $app = $('#app');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('namiar-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('namiar-' + k, JSON.stringify(v)); } catch (e) {} },
};

let Q = normalizeQuery(store.get('draft', null));
let ORDERS = store.get('orders', []);
let VOTES = store.get('votes', {});
let IDEAS = store.get('ideas', []);
let CO = store.get('checkout', null);
let HERO = Object.assign({ ind: '', voiv: '', sig: 'old' }, store.get('hero', {}));
let RES = null;
let PV_SHOW = 10;
let PENDING_SCROLL = null;
let TIMER = null;
let SAMPLE_WEEK = null;

const saveDraft = () => store.set('draft', Q);
const saveOrders = () => { store.set('orders', ORDERS); updateNavCount(); _bought = null; };
let _bought = null;
const bought = () => _bought || (_bought = new Set(ORDERS.flatMap(o => o.ids)));

// ---------- format ----------
const NF = new Intl.NumberFormat('pl-PL');
const num = n => NF.format(n);
const zl = v => v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
const firms = n => `${num(n)} ${plural(n, 'firma', 'firmy', 'firm')}`;
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const share = v => (v * 100).toLocaleString('pl-PL', { maximumFractionDigits: v < 0.1 ? 1 : 0 }) + '%';
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const when = ts => new Date(ts).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const surchargeLabel = c => c.surcharge ? `+${zl(c.surcharge)} / rekord` : 'w cenie';

// ---------- icons ----------
const ICONS = {
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12.5h18"/>',
  'briefcase-plus': '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M12 10.5v6M9 13.5h6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  'calendar-x': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M10 13.5l4 4M14 13.5l-4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  'globe-off': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M4.5 4.5l15 15"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  plug: '<path d="M9 3v4M15 3v4M7 7h10v3a5 5 0 0 1-10 0zM12 15v6M4 4l16 16"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  message: '<path d="M4 5h16v11H9l-5 4z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  megaphone: '<path d="M3 10v4h3l7 4V6l-7 4zM16.5 9a3.5 3.5 0 0 1 0 6M6 14l1.5 5h2.5l-1.2-4.3"/>',
  sparkle: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8zM18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  trend: '<path d="M3 17l6-6 4 4 7-7M15 8h5v5"/>',
  truck: '<path d="M2 6h11v10H2zM13 10h4l4 3v3h-8z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  'user-check': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 11l2 2 4-4"/>',
  cake: '<path d="M4 21v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M4 16.5c2 1.4 4 1.4 5.3 0 1.4 1.4 4 1.4 5.4 0 1.3 1.4 3.3 1.4 5.3 0M12 12V8.5M12 6c-.9-.9-.9-1.9 0-2.7.9.8.9 1.8 0 2.7zM2.5 21h19"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  phone: '<path d="M5 3.5h3.5l1.6 4.4-2.3 1.5a11 11 0 0 0 6.8 6.8l1.5-2.3 4.4 1.6V19a1.5 1.5 0 0 1-1.6 1.5A17 17 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.7-2.7-3-6-3"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8 21h8M9 17h6v4H9z"/>',
  accessibility: '<circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5l7 1.5 7-1.5M12 10v5l-3.5 6M12 15l3.5 6"/>',
  cart: '<path d="M3 4h2.5l2.2 11h10.6l2-8H6.3"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M4 19.5h16"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/>',
  thumb: '<path d="M7 11v9H4v-9zM7 11l4-7a2 2 0 0 1 2.5 2.4L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  bank: '<path d="M3 9l9-5 9 5M5 9v8M9.5 9v8M14.5 9v8M19 9v8M3 20h18"/>',
  smartphone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
};
const icon = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.info}</svg>`;

// ---------- shared bits ----------
function tween(el, to) {
  if (!el) return;
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  cancelAnimationFrame(el._raf);
  if (REDUCED || from === to) { el.textContent = num(to); return; }
  const t0 = performance.now(), D = 360;
  const step = t => {
    const k = Math.min(1, (t - t0) / D);
    el.textContent = num(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon('check')}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('is-out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

let lastFocus = null;
function openModal(html, cls = '') {
  lastFocus = document.activeElement;
  $('#modalRoot').innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-labelledby="mTitle"><div class="modal__bg" data-act="close"></div><div class="modal__box">${html}</div></div>`;
  document.body.classList.add('has-modal');
  const f = $('#modalRoot [autofocus]') || $('#modalRoot .modal__box button, #modalRoot .modal__box input');
  if (f) f.focus();
}
function closeModal() {
  if (!$('#modalRoot').innerHTML) return;
  $('#modalRoot').innerHTML = '';
  document.body.classList.remove('has-modal');
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

const tag = t => `<span class="tag">${esc(t)}</span>`;
function sitePill(r) {
  if (!r.site) return '<span class="pill pill--none">brak strony</span>';
  if (r.site.status !== 'ok') return '<span class="pill pill--down">nie działa</span>';
  const z = zone(r.score);
  return `<span class="pill pill--${z[1]}"><b>${r.score}</b> ${z[2]}</span>`;
}
function ctIcons(r) {
  const it = (on, n, t) => `<span class="ct${on ? ' is-on' : ''}" title="${t}${on ? '' : ' — brak'}">${icon(n)}<span class="sr">${t}${on ? '' : ' — brak'}</span></span>`;
  return it(!!r.email, 'mail', 'E-mail') + it(!!r.phone, 'phone', 'Telefon') + it(true, 'user', 'Osoba decyzyjna');
}

function resolve(q) {
  const res = runQuery(q, { bought: bought() });
  res.sorted = sortRows(res.rows, q);
  res.take = q.limit && q.limit < res.sorted.length ? res.sorted.slice(0, q.limit) : res.sorted;
  res.quote = quote(res.take, q);
  return res;
}
const qLink = q => '#/kreator?q=' + encodeQuery(q);
const autoName = q => runQuery(q).steps.slice(1).map(s => s.label).slice(0, 3).join(' · ') || 'Cała baza';

// ---------- landing ----------
const HERO_SIGNALS = [
  ['old', 'mają przestarzałą stronę', { 'old-site': { min: 50 } }],
  ['ads', 'płacą za reklamy, a strona straszy', { ads: {}, 'old-site': { min: 50 } }],
  ['nosite', 'nie mają strony, choć mają klientów', { 'no-site': { minRev: 20 } }],
  ['mobile', 'mają stronę nieczytelną na telefonie', { 'old-site': { min: 25, must: ['nomobile'] } }],
  ['down', 'mają stronę, która nie działa', { 'site-down': {} }],
  ['reviews', 'mają słabe opinie w mapach', { 'bad-reviews': {} }],
  ['booking', 'zapisują klientów tylko przez telefon', { 'no-booking': {} }],
  ['new', 'otworzyły się w ostatnich 90 dniach', { 'new-company': { days: 90 } }],
  ['hiring', 'właśnie szukają pracowników', { hiring: { min: 1 } }],
  ['fb', 'porzuciły swój Facebook', { 'dead-social': { days: 365, none: false } }],
];

const RECIPES = [
  { who: 'Dla agencji WWW', title: 'Płacą za reklamy, a strona straszy', note: 'Firma już wydaje na marketing, tylko ruch ląduje na stronie sprzed lat.', spec: { ads: {}, 'old-site': { min: 50 } } },
  { who: 'Dla agencji WWW', title: 'Klienci są, strony nie ma', note: 'Co najmniej 20 opinii w mapach i zero własnej strony.', spec: { 'no-site': { minRev: 20 }, 'has-phone': {} } },
  { who: 'Dla biur rachunkowych', title: 'Nowe firmy z ostatnich 30 dni', note: 'Świeży wpis w rejestrze — właśnie szukają księgowości.', spec: { 'new-company': { days: 30 } } },
  { who: 'Dla agencji social media', title: 'Restauracje z uśpionym Facebookiem', note: 'Gastronomia i noclegi bez posta od pół roku.', spec: { industry: { v: ['gastro', 'hotel'] }, 'dead-social': { days: 180, none: false } } },
  { who: 'Dla specjalistów od opinii', title: 'Dobre gabinety ze złą średnią', note: 'Medycyna i uroda ze średnią ≤ 4,0 przy min. 10 opiniach.', spec: { industry: { v: ['dent', 'med', 'physio', 'beauty'] }, 'bad-reviews': { max: 4.0, min: 10 } } },
  { who: 'Dla agencji rekrutacyjnych', title: 'Rosną i szukają ludzi', note: 'Firmy 10–249 osób z co najmniej dwiema otwartymi ofertami.', spec: { size: { v: ['10-49', '50-249'] }, hiring: { min: 2 } } },
  { who: 'Dla systemów rezerwacji', title: 'Zapisy tylko przez telefon', note: 'Gabinety i salony z działającą stroną, ale bez kalendarza online.', spec: { industry: { v: ['dent', 'physio', 'beauty', 'vet', 'med'] }, 'no-booking': {} } },
  { who: 'Dla wyposażenia biur', title: 'Właśnie się przeprowadziły', note: 'Spółki z nowym adresem w rejestrze w ostatnich 90 dniach.', spec: { legal: { v: ['spzoo', 'sa', 'spj'] }, moved: { days: 90 } } },
];

const SOURCES = [
  ['CEIDG, KRS, REGON', 'Nazwa, NIP, adres, PKD, forma prawna, zarząd, przeprowadzki', 'codziennie'],
  ['Crawler stron firmowych', 'Technologia, HTTPS, wersja mobilna, szybkość, rezerwacje, e-maile', 'co 30 dni'],
  ['Archiwum kopii stron', 'Kiedy strona była ostatnio przeprojektowana i zmieniana', 'co 30 dni'],
  ['Publiczne wizytówki w mapach', 'Oceny, liczba opinii, czy wizytówka jest przejęta', 'co 7 dni'],
  ['Publiczne biblioteki reklam', 'Czy firma prowadzi płatne kampanie', 'co 7 dni'],
  ['Portale z ofertami pracy', 'Otwarte rekrutacje i ich liczba', 'codziennie'],
];

const FAQ = [
  ['Skąd macie te dane?', 'Z publicznych rejestrów (CEIDG, KRS, REGON), z własnego crawlera, który co 30 dni odwiedza strony firmowe, oraz z publicznych wizytówek, bibliotek reklam i ogłoszeń o pracę. Przy każdym kryterium widzisz jego źródło i częstotliwość odświeżania.'],
  ['Czy to zgodne z RODO?', 'Sprzedajemy dane firm, nie osób prywatnych. Dane właścicieli jednoosobowych firm pochodzą z jawnego rejestru, a każda taka osoba dostała od nas informację z art. 14 RODO z linkiem do sprzeciwu. Kto się wypisze, znika z bazy, z przyszłych plików i z Twojego monitoringu.'],
  ['Czy mogę wysłać do tych firm mailing z ofertą?', 'Nie bez zgody. Ofertę handlową e-mailem lub przez telefon możesz przedstawić tylko temu, kto wcześniej się na to zgodził (art. 398 Prawa komunikacji elektronicznej) — dotyczy to także firm. Pierwszy kontakt zrób listem, wizytą albo przez LinkedIn, a sygnały z bazy dadzą Ci konkretny powód do rozmowy. W razie wątpliwości zapytaj prawnika.'],
  ['Co, jeśli e-mail jest nieaktualny?', 'Każdy adres sprawdzamy na serwerze pocztowym przed wydaniem pliku. Jeśli więcej niż 3% adresów z zamówienia się odbije, oddajemy pieniądze za wszystkie odbite.'],
  ['Czy to abonament?', 'Nie. Płacisz raz za plik. Jeśli chcesz, włączasz monitoring: co poniedziałek dosyłamy firmy, które właśnie zaczęły spełniać Twoje kryteria, w tej samej stawce i z limitem tygodniowym.'],
  ['Mogę zaproponować nowe kryterium?', 'Tak — w katalogu kryteriów jest formularz i lista tych w przygotowaniu. Dodajemy nowe co miesiąc, a kolejność ustalają głosy klientów.'],
];

function heroQuery() {
  const sig = HERO_SIGNALS.find(s => s[0] === HERO.sig) || HERO_SIGNALS[0];
  return queryFrom(Object.assign({ industry: { v: HERO.ind ? [HERO.ind] : [] }, region: { voiv: HERO.voiv ? [HERO.voiv] : [] } }, clone(sig[2])), { skipBought: false });
}

function viewHome() {
  const indOpts = [['', 'firmy z każdej branży'], ...Object.entries(INDUSTRIES).map(([k, v]) => [k, v.hero])];
  const voivOpts = [['', 'w całej Polsce'], ...Object.entries(VOIV).map(([k, v]) => [k, 'w województwie ' + v.label.replace(/ie$/, 'im')])];
  const sel = (key, opts) => `<select data-hero="${key}">${opts.map(o => `<option value="${o[0]}"${HERO[key] === o[0] ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  const sh = shares();
  const sigGroups = ['www', 'online', 'events'];
  const soon = CRITERIA.filter(c => c.status === 'soon').sort((a, b) => votesOf(b) - votesOf(a));
  const exQ = queryFrom({ industry: { v: ['dent'] }, 'old-site': { min: 50 } }, { skipBought: false });
  const ex = resolve(exQ).quote;

  $app.innerHTML = `
  <section class="hero">
    <div class="wrap hero__in">
      <div class="hero__text">
        <p class="eyebrow">Bazy firm na zamówienie</p>
        <h1 class="hero__h">Kup listę firm, które <span class="hl">właśnie potrzebują</span> Twojej usługi.</h1>
        <p class="hero__lead">Branża i region to dopiero początek. Dokładasz sygnały — stara strona, brak strony, słabe opinie, nowa firma — i od razu widzisz, ile firm pasuje. Płacisz za rekord, nie za abonament.</p>
        <div class="sentence" role="group" aria-label="Szybkie zapytanie">
          Pokaż mi <label class="pick"><span class="sr">Branża</span>${sel('ind', indOpts)}</label>
          <label class="pick"><span class="sr">Region</span>${sel('voiv', voivOpts)}</label>, które
          <label class="pick pick--sig"><span class="sr">Sygnał</span>${sel('sig', HERO_SIGNALS.map(s => [s[0], s[1]]))}</label>.
        </div>
        <div class="hero__res">
          <p class="hero__count" aria-live="polite"><span class="hero__eq">=</span> <b id="heroN" data-v="0">0</b> <span id="heroUnit">firm</span></p>
          <p class="hero__price" id="heroPrice"></p>
          <a class="btn btn--mark btn--lg" id="heroGo" href="#/kreator">Zbuduj tę bazę ${icon('arrow')}</a>
        </div>
      </div>
      <div class="hero__cards" id="heroCards"></div>
    </div>
  </section>

  <section class="sec sec--steps">
    <div class="wrap steps">
      ${[['layers', 'Składasz kryteria', 'Branża, region, wielkość i dowolne sygnały. Każde kryterium możesz wymagać albo wykluczyć.'],
        ['eye', 'Widzisz wynik na żywo', 'Liczba firm, lejek kryteriów i podgląd rekordów — zanim cokolwiek zapłacisz.'],
        ['download', 'Płacisz za rekord', 'Od 0,25 zł za firmę. Plik CSV lub JSON zaraz po płatności, a monitoring dosyła nowe firmy co tydzień.']]
        .map(([ic, t, d], i) => `<div class="step"><span class="step__n">${i + 1}</span><span class="step__ic">${icon(ic)}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
  </section>

  <section class="sec" id="sygnaly">
    <div class="wrap">
      <header class="sec__head">
        <p class="eyebrow">${ACTIVE.length} kryteriów i rośnie</p>
        <h2>Sygnały, których nie ma w zwykłej bazie firm</h2>
        <p>Każdy sygnał to osobny pomiar ze źródłem i datą. Liczba przy kryterium to odsetek całej bazy, który dziś je spełnia.</p>
      </header>
      <div class="sig-cols">
        ${sigGroups.map(g => `<div class="sig-col"><h3 class="sig-col__h">${GROUPS[g].label}<small>${GROUPS[g].desc}</small></h3>
          ${ACTIVE.filter(c => c.group === g).map(c => `<a class="sig" href="#/kreator?add=${c.id}">
            <span class="sig__ic">${icon(c.icon)}</span>
            <span class="sig__t"><b>${c.label}</b><small>${c.desc}</small></span>
            <span class="sig__share" title="Odsetek bazy">${share(sh[c.id] || 0)}</span></a>`).join('')}
        </div>`).join('')}
      </div>
      <div class="soon">
        <div class="soon__head"><h3>W przygotowaniu</h3><p>Głosuj, co dodać najpierw. Albo <a href="#/kryteria?s=idea">zaproponuj własne kryterium</a>.</p></div>
        <div class="soon__row">${soon.map(soonCard).join('')}</div>
      </div>
    </div>
  </section>

  <section class="sec sec--alt" id="przepisy">
    <div class="wrap">
      <header class="sec__head">
        <p class="eyebrow">Gotowe przepisy</p>
        <h2>Zacznij od zapytania, które już działa</h2>
        <p>Każdy przepis otwiera kreator z ustawionymi kryteriami. Możesz go dalej zawężać.</p>
      </header>
      <div class="recipes">${RECIPES.map(recipeCard).join('')}</div>
    </div>
  </section>

  <section class="sec" id="skansen">
    <div class="wrap">
      <header class="sec__head">
        <p class="eyebrow">Jak oceniamy stronę</p>
        <h2>Od świeżynki do skansenu</h2>
        <p>Crawler co 30 dni otwiera każdą stronę firmową na komputerze i na telefonie, a potem liczy wynik przestarzałości od 0 do 100. Ty decydujesz, od ilu punktów strona jest „stara”.</p>
      </header>
      <div class="scale" aria-hidden="true">${SCORE_ZONES.slice().reverse().map((z, i, a) => `<span class="scale__z scale__z--${z[1]}"><b>${z[2]}</b><small>${z[0]}–${i < a.length - 1 ? a[i + 1][0] - 1 : 100}</small></span>`).join('')}</div>
      <div class="specimens">${SPECIMENS.map(specimen).join('')}</div>
      <div class="rules">
        <h3>Skąd się biorą punkty</h3>
        <dl>${SCORE_RULES.map(([a, b, c]) => `<div><dt>${a}<small>${c}</small></dt><dd>${b}</dd></div>`).join('')}</dl>
      </div>
    </div>
  </section>

  <section class="sec sec--alt" id="dane">
    <div class="wrap data-grid">
      <div>
        <header class="sec__head sec__head--left">
          <p class="eyebrow">Skąd dane</p>
          <h2>Każde pole ma źródło i datę</h2>
        </header>
        <table class="src">
          <thead><tr><th>Źródło</th><th>Co z niego bierzemy</th><th>Odświeżanie</th></tr></thead>
          <tbody>${SOURCES.map(s => `<tr><td><b>${s[0]}</b></td><td>${s[1]}</td><td class="nowrap">${s[2]}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="legal">
        <h3>${icon('shield')} Jak korzystać z takiej bazy legalnie</h3>
        <div class="legal__item"><b>Tylko firmy</b><p>Nie sprzedajemy danych osób prywatnych. Właściciele jednoosobowych firm są w bazie, bo ich dane są jawne w CEIDG.</p></div>
        <div class="legal__item"><b>Informacja z art. 14 RODO</b><p>Każda osoba z bazy dostaje od nas informację i link do sprzeciwu. Wypisani znikają z bazy i z Twoich przyszłych dostaw.</p></div>
        <div class="legal__item"><b>E-mail i telefon za zgodą</b><p>Ofertę handlową e-mailem lub telefonicznie wolno wysłać tylko za wcześniejszą zgodą odbiorcy, także firmy. Pierwszy kontakt: list, wizyta, LinkedIn.</p></div>
        <p class="fine">Makieta — to nie jest porada prawna.</p>
      </div>
    </div>
  </section>

  <section class="sec" id="cennik">
    <div class="wrap">
      <header class="sec__head">
        <p class="eyebrow">Cennik</p>
        <h2>Płacisz za rekord, nie za dostęp</h2>
        <p>Bez abonamentu i bez pakietów. Za e-mail i telefon płacisz tylko w rekordach, które je mają.</p>
      </header>
      <div class="pricing">
        <div class="card price-list">
          <h3>Za jedną firmę</h3>
          <dl>
            <div><dt>Dane firmy<small>nazwa, NIP, adres, PKD, WWW, wynik strony, sygnały</small></dt><dd>${zl(PRICE.base)}</dd></div>
            ${Object.values(FIELDS).map(f => `<div><dt>+ ${f.label}<small>${f.note}</small></dt><dd>${zl(f.price)}</dd></div>`).join('')}
            <div><dt>+ Sygnały<small>zależnie od kryterium, np. wynik strony, reklamy, rekrutacje</small></dt><dd>0,05–0,10 zł</dd></div>
          </dl>
        </div>
        <div class="tiers">
          ${[[0, 'do 499 firm', 'cena podstawowa'], [500, 'od 500 firm', '−10%'], [2000, 'od 2000 firm', '−20%'], [5000, 'od 5000 firm', '−30%']].map(([n, a, b]) => `<div class="tier${n ? '' : ' tier--base'}"><small>${a}</small><b>${b}</b></div>`).join('')}
          <p class="fine">Minimalne zamówienie ${zl(PRICE.min)} netto. Ceny netto, doliczamy 23% VAT. Monitoring: ta sama stawka, maks. ${zl(PRICE.monitorCap)} netto tygodniowo.</p>
        </div>
        <div class="card example">
          <h3>Przykład z bazy na dziś</h3>
          <p>Gabinety stomatologiczne w całej Polsce ze stroną od 50 pkt, z e-mailem i telefonem:</p>
          <dl>${ex.lines.map(l => `<div><dt>${l.label}<small>${num(l.qty)} × ${zl(l.unit)}</small></dt><dd>${zl(l.total)}</dd></div>`).join('')}
            ${ex.rate ? `<div><dt>Rabat −${ex.rate * 100}%</dt><dd>−${zl(ex.disc)}</dd></div>` : ''}</dl>
          <p class="example__total"><span>${firms(ex.n)}</span><b>${zl(ex.net)}</b></p>
          <a class="btn btn--ghost" href="${qLink(exQ)}">Otwórz w kreatorze ${icon('arrow')}</a>
        </div>
      </div>
    </div>
  </section>

  <section class="sec sec--alt" id="faq">
    <div class="wrap faq">
      <header class="sec__head sec__head--left"><p class="eyebrow">Pytania</p><h2>Zanim kupisz</h2></header>
      <div class="faq__list">${FAQ.map(([q, a], i) => `<details${i === 2 ? ' open' : ''}><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap cta__in">
      <h2>Liczenie jest za darmo. <span class="hl">Sprawdź, ile firm czeka</span> na Twoją ofertę.</h2>
      <a class="btn btn--mark btn--lg" href="#/kreator">Otwórz kreator ${icon('arrow')}</a>
    </div>
  </section>`;

  $$('[data-hero]').forEach(autosize);
  if (document.fonts) document.fonts.ready.then(() => $$('[data-hero]').forEach(autosize));
  renderHero();
}

function soonCard(c) {
  const on = !!VOTES[c.id];
  return `<div class="soon-card"><span class="sig__ic">${icon(c.icon)}</span><div><b>${c.label}</b><small>${c.desc}</small></div>
    <button type="button" class="vote${on ? ' is-on' : ''}" data-act="vote" data-id="${c.id}" aria-pressed="${on}">${icon('thumb')}<span>${num(votesOf(c))}</span><span class="sr">${voteLabel(c.id)}</span></button></div>`;
}
const votesOf = c => (c.votes || 0) + (VOTES[c.id] ? 1 : 0);
const voteLabel = id => ` głosów, ${VOTES[id] ? 'cofnij głos' : 'zagłosuj'}`;

function recipeCard(rc) {
  const q = queryFrom(rc.spec, { skipBought: false });
  const res = resolve(q);
  const chips = q.items.filter(it => !isEmpty(it)).map(it => `<span class="mini">${icon(CRIT[it.id].icon)}${esc(CRIT[it.id].summary(it.p))}</span>`).join('');
  return `<a class="recipe card" href="${qLink(q)}">
    <p class="recipe__who">${rc.who}</p>
    <h3>${rc.title}</h3>
    <p class="recipe__note">${rc.note}</p>
    <div class="recipe__chips">${chips}</div>
    <p class="recipe__foot"><span><b>${num(res.take.length)}</b> ${plural(res.take.length, 'firma', 'firmy', 'firm')}</span><span>${res.take.length ? zl(res.quote.net) : '—'}</span></p>
  </a>`;
}

function specimen(s) {
  const z = zone(s.score);
  const checks = Object.values(SITE_CHECKS).map(c => { const bad = c.test(s.site); return `<li class="${bad ? 'is-bad' : 'is-ok'}">${icon(bad ? 'x' : 'check')}${bad ? c.label : c.ok}</li>`; }).join('');
  return `<figure class="spec">
    <div class="spec__shot"><div class="thumb-frame">${siteThumb(s, { masked: false })}</div>${phoneThumb(s, { masked: false })}</div>
    <figcaption>
      <p class="spec__top"><span class="pill pill--${z[1]}"><b>${s.score}</b> ${z[2]}</span><span class="spec__yr">projekt z ${s.site.built}</span></p>
      <b class="spec__name">${esc(s.brand)}</b><small>${TECH[s.site.tech].label}</small>
      <ul class="checks">${checks}</ul>
    </figcaption>
  </figure>`;
}

function renderHero() {
  const q = heroQuery();
  const res = resolve(q);
  const n = res.take.length;
  tween($('#heroN'), n);
  $('#heroUnit').textContent = plural(n, 'firma', 'firmy', 'firm');
  $('#heroPrice').innerHTML = n
    ? `za ${zl(res.quote.net)} netto całość${res.quote.minApplied ? ' (minimalne zamówienie)' : ` · ${zl(res.quote.per)} za firmę`}, z e-mailem i telefonem`
    : 'Za wąsko — zmień region albo branżę.';
  $('#heroGo').href = qLink(q);
  const top = res.sorted.slice(0, 3);
  $('#heroCards').innerHTML = top.length ? top.map((r, i) => `
    <button type="button" class="hcard" style="--i:${i}" data-act="rec" data-id="${r.id}" data-q="hero">
      <span class="hcard__thumb">${siteThumb(r)}</span>
      <span class="hcard__body"><b>${esc(r.nameM)}</b><small>${INDUSTRIES[r.ind].label} · ${esc(r.city)}</small><span class="tags">${reasonsFor(r, q).slice(0, 3).map(tag).join('')}</span></span>
    </button>`).join('') + `<p class="hcard__note">${icon('eye')} Prawdziwe trafienia z makiety. Dane kontaktowe odsłaniamy po zakupie.</p>`
    : `<div class="hcard hcard--empty"><b>Nic nie pasuje</b><small>Spróbuj „w całej Polsce” albo innej branży.</small></div>`;
}

// native selects size to the widest option; size each one to its chosen label instead
function autosize(sel) {
  const m = autosize.m || (autosize.m = Object.assign(document.createElement('span'), { className: 'pick__measure' }));
  if (!m.isConnected) document.body.appendChild(m);
  m.textContent = sel.options[sel.selectedIndex].text;
  const cs = getComputedStyle(sel);
  m.style.font = cs.font;
  m.style.letterSpacing = cs.letterSpacing;
  sel.style.width = Math.ceil(m.getBoundingClientRect().width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)) + 4 + 'px';
}

// ---------- builder ----------
function viewBuilder(params) {
  if (params.get('q')) {
    const q = decodeQuery(params.get('q'));
    if (q) { Q = q; saveDraft(); PV_SHOW = 10; }
    history.replaceState(null, '', '#/kreator');
  }
  let added = null;
  if (params.get('add') && CRIT[params.get('add')] && CRIT[params.get('add')].status !== 'soon') {
    added = params.get('add');
    if (!Q.items.some(it => it.id === added)) Q.items.push(newItem(added));
    saveDraft();
    history.replaceState(null, '', '#/kreator');
  }

  $app.innerHTML = `
  <section class="builder wrap">
    <header class="builder__head">
      <div>
        <p class="eyebrow">Kreator bazy</p>
        <h1>Zbuduj bazę firm</h1>
      </div>
      <div class="builder__tools">
        <label class="name-in"><span class="sr">Nazwa bazy</span><input id="qName" type="text" maxlength="80" placeholder="Nazwa bazy, np. Dentyści — stare strony" value="${esc(Q.name)}"></label>
        <button type="button" class="btn btn--ghost btn--sm" data-act="share">${icon('link')}<span>Kopiuj link</span></button>
        <button type="button" class="btn btn--ghost btn--sm" data-act="reset">${icon('refresh')}<span>Wyczyść</span></button>
      </div>
    </header>
    <div class="builder__grid">
      <div class="b-list" id="critList"></div>
      <aside class="builder__side">
        <div class="card result" id="result">
          <div class="result__top">
            <p class="result__label">Pasuje do kryteriów</p>
            <p class="result__count" aria-live="polite"><b id="rCount" data-v="0">0</b> <span id="rUnit">firm</span></p>
            <p class="result__of" id="rOf"></p>
          </div>
          <ol class="funnel" id="rFunnel" aria-label="Lejek kryteriów"></ol>
          <div class="result__empty" id="rEmpty" hidden></div>
          <div class="cover" id="rCover"></div>
          <div class="buy">
            <h3 class="buy__h">Co jest w pliku</h3>
            <ul class="fields">
              <li class="field field--fixed"><span class="field__box">${icon('check')}</span><span class="field__t">Dane firmy<small>nazwa, NIP, adres, PKD, WWW, sygnały</small></span><span class="field__p">${zl(PRICE.base)}</span></li>
              ${Object.entries(FIELDS).map(([k, f]) => `<li><label class="field"><input type="checkbox" data-field="${k}"${Q.fields[k] ? ' checked' : ''}><span class="field__box">${icon('check')}</span><span class="field__t">${f.label}<small data-fcount="${k}"></small></span><span class="field__p">${zl(f.price)}</span></label></li>`).join('')}
            </ul>
            <div class="limit">
              <h3 class="buy__h">Ile firm</h3>
              <div class="seg seg--sm" role="radiogroup" aria-label="Ile firm kupić">
                <button type="button" role="radio" data-act="limit" data-v="all">Wszystkie</button>
                <button type="button" role="radio" data-act="limit" data-v="top">Tylko najlepsze</button>
              </div>
              <label class="limit__n" id="limitWrap" hidden><span>Pierwsze</span><input type="number" id="limitN" min="1" step="1" inputmode="numeric"><span>z <b id="limitMax"></b>, w kolejności z podglądu</span></label>
            </div>
            <div class="price" id="rPrice"></div>
            <button type="button" class="btn btn--mark btn--block btn--lg" data-act="order" id="rBuy">Zamów bazę</button>
            <p class="buy__fine">Liczenie i podgląd są bezpłatne. Ceny netto, + 23% VAT.</p>
          </div>
        </div>
      </aside>
      <section class="card pv" id="pv">
        <header class="pv__head">
          <div><h2>Podgląd wyników</h2><p>Kontakty są zasłonięte do zakupu. Kliknij firmę, żeby zobaczyć, co o niej wiemy.</p></div>
          <label class="sort"><span>Kolejność</span><select id="sortSel">
            ${[['signal', 'Najmocniejszy sygnał'], ['newest', 'Najnowsze firmy'], ['biggest', 'Największe firmy'], ['random', 'Losowo']].map(o => `<option value="${o[0]}"${Q.sort === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}
          </select></label>
        </header>
        <div class="pv__rows" id="pvRows"></div>
        <div class="pv__foot" id="pvFoot"></div>
      </section>
    </div>
  </section>
  <div class="sumbar" id="sumbar"><div class="sumbar__t"><b id="sbN">0 firm</b><small id="sbP"></small></div><button type="button" class="btn btn--mark" data-act="order">Zamów</button></div>`;

  renderCritList();
  recompute();
  if (added) {
    const card = $(`.crit[data-id="${added}"]`);
    if (card) { card.classList.add('is-new'); card.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' }); }
  }
}

function critCard(it, idx) {
  const c = CRIT[it.id];
  const body = (c.params || []).map(pr => paramUI(it, pr, idx)).join('');
  return `<article class="crit${it.mode === 'out' ? ' is-out' : ''}" data-idx="${idx}" data-id="${it.id}">
    <header class="crit__head">
      <span class="crit__ic">${icon(c.icon)}</span>
      <div class="crit__t"><h3>${c.label}</h3><p class="crit__src">${c.source} · ${c.refresh}${c.surcharge ? ` · ${surchargeLabel(c)}` : ''}</p></div>
      <span class="crit__delta" data-delta="${it.id}"></span>
      ${c.pinned ? '' : `<div class="seg seg--xs crit__mode" role="radiogroup" aria-label="Tryb kryterium">
        <button type="button" role="radio" aria-checked="${it.mode === 'in'}" class="${it.mode === 'in' ? 'is-on' : ''}" data-act="mode" data-idx="${idx}" data-v="in">Wymagaj</button>
        <button type="button" role="radio" aria-checked="${it.mode === 'out'}" class="${it.mode === 'out' ? 'is-on' : ''}" data-act="mode" data-idx="${idx}" data-v="out">Wyklucz</button></div>
        <button type="button" class="icon-btn" data-act="remove" data-idx="${idx}" aria-label="Usuń kryterium ${esc(c.label)}">${icon('x')}</button>`}
    </header>
    ${c.pinned ? '' : `<p class="crit__desc">${c.desc}</p>`}
    ${body ? `<div class="crit__body">${body}</div>` : ''}
  </article>`;
}

function paramUI(it, pr, idx) {
  const v = it.p[pr.id];
  const name = esc(pr.label || CRIT[it.id].label);
  const lab = pr.label ? `<p class="param__l">${pr.label}</p>` : '';
  if (pr.type === 'chips' || pr.type === 'checks') {
    const opts = pr.options(it.p);
    if (!opts.length) return `<div class="param">${lab}<p class="param__hint">${pr.hint || ''}</p></div>`;
    const search = pr.search ? `<label class="chip-search">${icon('search')}<input type="search" placeholder="Szukaj branży lub kodu PKD" aria-label="Szukaj: ${name}"></label>` : '';
    const empty = CRIT[it.id].pinned && !v.length ? '<span class="param__any">nic nie zaznaczone = wszystkie</span>' : '';
    return `<div class="param">${lab}${search}<div class="chips${pr.type === 'checks' ? ' chips--checks' : ''}" role="group" aria-label="${name}">${opts.map(o => {
      const on = v.includes(o[0]);
      return `<button type="button" class="chip${on ? ' is-on' : ''}" aria-pressed="${on}" data-act="chip" data-idx="${idx}" data-param="${pr.id}" data-val="${esc(o[0])}">${pr.type === 'checks' ? icon(on ? 'check' : 'plus', 'i chip__i') : ''}${esc(o[1])}${o[2] ? `<small>${o[2]}</small>` : ''}</button>`;
    }).join('')}${empty}</div></div>`;
  }
  if (pr.type === 'seg') {
    return `<div class="param">${lab}<div class="seg" role="radiogroup" aria-label="${name}">${pr.options.map(o => `<button type="button" role="radio" aria-checked="${o[0] === v}" class="${o[0] === v ? 'is-on' : ''}" data-act="seg" data-idx="${idx}" data-param="${pr.id}" data-val="${o[0]}">${o[1]}</button>`).join('')}</div></div>`;
  }
  if (pr.type === 'range') {
    return `<label class="param param--range"><span class="param__l">${pr.label} <b data-out="${pr.id}">${esc(pr.fmt(v))}</b></span><input type="range" min="${pr.min}" max="${pr.max}" step="${pr.step}" value="${v}" data-idx="${idx}" data-param="${pr.id}"></label>`;
  }
  if (pr.type === 'toggle') {
    return `<label class="switch"><input type="checkbox"${v ? ' checked' : ''} data-idx="${idx}" data-param="${pr.id}"><span class="switch__ui" aria-hidden="true"></span><span>${pr.label}</span></label>`;
  }
  return '';
}

const QUICK = ['old-site', 'no-site', 'ads', 'new-company', 'bad-reviews', 'hiring', 'no-booking'];
function renderCritList() {
  const pinned = [], extra = [];
  Q.items.forEach((it, i) => (CRIT[it.id].pinned ? pinned : extra).push(critCard(it, i)));
  const quick = QUICK.filter(id => !Q.items.some(it => it.id === id)).slice(0, 5);
  const nBought = bought().size;
  $('#critList').innerHTML = `
    <h2 class="list-h"><span>1</span> Kogo szukasz</h2>
    ${pinned.join('')}
    <h2 class="list-h"><span>2</span> Sygnały i dodatkowe filtry</h2>
    ${extra.join('') || `<div class="crit crit--empty"><p><b>Bez sygnałów to zwykła lista firm.</b> Dodaj kryterium, które mówi, że firma potrzebuje Twojej usługi teraz.</p></div>`}
    <div class="add-row">
      <button type="button" class="btn btn--ink" data-act="picker">${icon('plus')}<span>Dodaj kryterium</span></button>
      ${quick.map(id => `<button type="button" class="chip chip--quick" data-act="quick" data-id="${id}">${icon(CRIT[id].icon, 'i chip__i')}${CRIT[id].label}</button>`).join('')}
    </div>
    <details class="card excl"${Q.exclude ? ' open' : ''}>
      <summary><span>${icon('filter')} Wykluczenia</span><small>kupione wcześniej, Twoi obecni klienci</small></summary>
      <label class="switch"><input type="checkbox" id="skipBought"${Q.skipBought ? ' checked' : ''}><span class="switch__ui" aria-hidden="true"></span><span>Pomiń firmy z moich poprzednich zamówień <small>(${num(nBought)})</small></span></label>
      <label class="param"><span class="param__l">Wklej NIP-y lub domeny firm, których nie chcesz w pliku</span>
        <textarea id="excludeTxt" rows="3" placeholder="000-123-45-67, perla-dent.example …">${esc(Q.exclude)}</textarea><small class="param__hint" id="exInfo"></small></label>
    </details>`;
  const ex = parseExclude(Q.exclude);
  $('#exInfo').textContent = ex.size ? `Rozpoznano ${ex.nips.size} NIP-ów i ${ex.domains.size} domen.` : 'Separator: spacja, przecinek albo nowa linia.';
}

function renderCard(idx, from) {
  const old = $(`.crit[data-idx="${idx}"]`);
  if (!old) return;
  const sel = from && from.dataset.act ? `[data-act="${from.dataset.act}"][data-param="${from.dataset.param}"][data-val="${CSS.escape(from.dataset.val || '')}"]` : null;
  const search = old.querySelector('.chip-search input');
  const sv = search ? search.value : '';
  old.outerHTML = critCard(Q.items[idx], idx);
  const card = $(`.crit[data-idx="${idx}"]`);
  if (sv) { const s = card.querySelector('.chip-search input'); s.value = sv; filterChips(s); }
  if (sel) { const f = card.querySelector(sel); if (f) f.focus(); }
}

function filterChips(input) {
  const q = norm(input.value.trim());
  input.closest('.param').querySelectorAll('.chip').forEach(ch => { ch.hidden = q && !norm(ch.textContent).includes(q); });
}

let rafPending = false;
function schedule() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; recompute(); });
}

function recompute() {
  if (!$('#result')) return;
  RES = resolve(Q);
  saveDraft();
  renderResult();
  renderDeltas();
  renderPreview();
}

function renderDeltas() {
  const byId = Object.fromEntries(RES.steps.map(s => [s.id, s]));
  $$('[data-delta]').forEach(el => {
    const it = Q.items.find(x => x.id === el.dataset.delta);
    const s = byId[el.dataset.delta];
    if (!it || isEmpty(it)) { el.textContent = 'dowolne'; el.className = 'crit__delta is-any'; return; }
    if (!s) { el.textContent = ''; return; }
    const cut = s.before - s.n;
    el.textContent = cut ? `−${num(cut)}` : 'bez zmian';
    el.className = 'crit__delta' + (s.n === 0 ? ' is-zero' : '');
    el.title = `Po tym kryterium zostaje ${firms(s.n)}`;
  });
}

function renderResult() {
  const { take, rows, steps, quote: qt } = RES;
  const n = rows.length;
  tween($('#rCount'), n);
  $('#rUnit').textContent = plural(n, 'firma', 'firmy', 'firm');
  $('#rOf').innerHTML = `z ${num(DB_SIZE)} firm w bazie makiety · <b>${share(n / DB_SIZE)}</b>`;

  $('#rFunnel').innerHTML = steps.map((s, i) => {
    const kept = i ? (s.before ? s.n / s.before : 0) : 1;
    return `<li class="fstep${s.n === 0 ? ' is-zero' : ''}"><span class="fstep__l">${esc(s.label)}</span><span class="fstep__n">${num(s.n)}</span>
      <span class="fstep__bar" aria-hidden="true"><i style="width:${Math.max(kept ? 1.5 : 0, kept * 100)}%"></i></span>
      ${i ? `<span class="fstep__k">zostaje ${share(kept)}</span>` : ''}</li>`;
  }).join('');

  const emptyEl = $('#rEmpty');
  if (!n) {
    const best = dropSuggestion();
    emptyEl.hidden = false;
    emptyEl.innerHTML = `<p><b>Żadna firma nie spełnia wszystkich kryteriów naraz.</b></p>${best ? `<button type="button" class="btn btn--ghost btn--sm" data-act="drop" data-idx="${best.idx}">Usuń „${esc(CRIT[Q.items[best.idx].id].label)}” → ${firms(best.n)}</button>` : ''}`;
  } else emptyEl.hidden = true;

  const cov = [['E-mail', rows.filter(r => r.email).length], ['Telefon', rows.filter(r => r.phone).length], ['Działająca strona', rows.filter(r => r.site && r.site.status === 'ok').length]];
  $('#rCover').innerHTML = n ? `<p class="cover__h">W wynikach ma</p>${cov.map(([l, k]) => `<div class="meter"><span>${l}</span><span class="meter__bar"><i style="width:${pct(k, n)}%"></i></span><b>${pct(k, n)}%</b></div>`).join('')}` : '';

  for (const [k, f] of Object.entries(FIELDS)) {
    const el = $(`[data-fcount="${k}"]`);
    if (el) el.textContent = `${num(take.filter(f.has).length)} z ${num(take.length)} · ${f.note}`;
  }

  const lim = Q.limit && Q.limit < n;
  $$('[data-act="limit"]').forEach(b => { const on = (b.dataset.v === 'top') === !!Q.limit; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
  $('#limitWrap').hidden = !Q.limit;
  const ln = $('#limitN');
  ln.max = Math.max(1, n);
  if (document.activeElement !== ln) ln.value = Q.limit ? Math.min(Q.limit, Math.max(1, n)) : '';
  $('#limitMax').textContent = num(n);

  const next = TIERS.slice().reverse().find(t => t[0] > take.length);
  $('#rPrice').innerHTML = take.length ? `
    <dl class="lines">${qt.lines.map(l => `<div><dt>${l.label}<small>${num(l.qty)} × ${zl(l.unit)}${l.key === 'sig' ? ' · ' + esc(l.note) : ''}</small></dt><dd>${zl(l.total)}</dd></div>`).join('')}
      ${qt.rate ? `<div class="lines__disc"><dt>Rabat ilościowy −${qt.rate * 100}%</dt><dd>−${zl(qt.disc)}</dd></div>` : ''}
      ${qt.minApplied ? `<div class="lines__min"><dt>Minimalne zamówienie<small>wyliczone ${zl(round2(qt.sub - qt.disc))}</small></dt><dd>${zl(PRICE.min)}</dd></div>` : ''}</dl>
    <p class="total"><span>Razem netto</span><b>${zl(qt.net)}</b></p>
    <p class="per">${zl(qt.per)} za firmę${lim ? ` · ${firms(take.length)} z ${num(n)}` : ''}${next && next[1] && !lim ? ` · jeszcze ${num(next[0] - take.length)} do rabatu ${next[1] * 100}%` : ''}</p>` : '';

  const buy = $('#rBuy');
  buy.disabled = !take.length;
  buy.innerHTML = take.length ? `Zamów ${firms(take.length)} · ${zl(qt.net)}` : 'Brak firm do zamówienia';
  $('#sbN').textContent = firms(take.length);
  $('#sbP').textContent = take.length ? `${zl(qt.net)} netto` : 'zmień kryteria';
  $('#sumbar [data-act="order"]').disabled = !take.length;
}

function dropSuggestion() {
  let best = null;
  Q.items.forEach((it, idx) => {
    if (isEmpty(it)) return;
    const q = clone(Q);
    if (CRIT[it.id].pinned) q.items[idx] = newItem(it.id); else q.items.splice(idx, 1);
    const n = runQuery(q, { bought: bought() }).rows.length;
    if (n && (!best || n > best.n)) best = { idx, n };
  });
  return best;
}

function renderPreview() {
  const rows = RES.take.slice(0, PV_SHOW);
  $('#pvRows').innerHTML = rows.length ? rows.map(r => `
    <button type="button" class="pvr" data-act="rec" data-id="${r.id}">
      <span class="pvr__th">${siteThumb(r)}</span>
      <span class="pvr__main"><b class="pvr__name">${esc(r.nameM)}</b><span class="pvr__meta">${INDUSTRIES[r.ind].label} · ${esc(r.city)} · ${BANDS[r.band]}</span><span class="tags">${reasonsFor(r, Q).slice(0, 3).map(tag).join('')}</span></span>
      <span class="pvr__site">${sitePill(r)}</span>
      <span class="pvr__ct">${ctIcons(r)}</span>
    </button>`).join('') : '<p class="pv__empty">Tu pojawią się firmy, które spełniają kryteria.</p>';
  const total = RES.take.length;
  $('#pvFoot').innerHTML = total ? `<span>Pokazano ${num(rows.length)} z ${num(total)}</span>${rows.length < Math.min(total, 50) ? `<button type="button" class="btn btn--ghost btn--sm" data-act="more">Pokaż kolejne 10</button>` : total > 50 ? '<span class="muted">Podgląd kończy się na 50 — całość jest w pliku.</span>' : ''}` : '';
}

function openPicker() {
  const sh = shares();
  const has = id => Q.items.some(it => it.id === id);
  const groups = Object.keys(GROUPS).map(g => {
    const items = CRITERIA.filter(c => c.group === g && !c.pinned);
    if (!items.length) return '';
    return `<section class="picker__g"><h3>${GROUPS[g].label}<small>${GROUPS[g].desc}</small></h3>${items.map(c => c.status === 'soon'
      ? `<div class="pick-row is-soon" data-text="${esc(norm(c.label + ' ' + c.desc))}"><span class="crit__ic">${icon(c.icon)}</span><span class="pick-row__t"><b>${c.label} <em>wkrótce</em></b><small>${c.desc}</small></span><button type="button" class="vote${VOTES[c.id] ? ' is-on' : ''}" data-act="vote" data-id="${c.id}" aria-pressed="${!!VOTES[c.id]}">${icon('thumb')}<span>${num(votesOf(c))}</span><span class="sr">${voteLabel(c.id)}</span></button></div>`
      : `<button type="button" class="pick-row" data-act="pick" data-id="${c.id}"${has(c.id) ? ' disabled' : ''} data-text="${esc(norm(c.label + ' ' + c.desc))}"><span class="crit__ic">${icon(c.icon)}</span><span class="pick-row__t"><b>${c.label}${has(c.id) ? ' <em>dodane</em>' : ''}</b><small>${c.desc}</small></span><span class="pick-row__m">${sh[c.id] != null ? `<b>${share(sh[c.id])}</b> bazy<br>` : ''}${surchargeLabel(c)}</span></button>`).join('')}</section>`;
  }).join('');
  openModal(`<header class="modal__head"><h2 id="mTitle">Dodaj kryterium</h2><button type="button" class="icon-btn" data-act="close" aria-label="Zamknij">${icon('x')}</button></header>
    <label class="picker__search">${icon('search')}<input id="pickQ" type="search" placeholder="Szukaj: opinie, rekrutacja, technologia…" autofocus aria-label="Szukaj kryterium"></label>
    <div class="picker__list">${groups}</div>
    <footer class="modal__foot">Brakuje kryterium? <a href="#/kryteria?s=idea">Zaproponuj własne</a> — dodajemy nowe co miesiąc.</footer>`, 'modal--picker');
}

function addCriterion(id) {
  if (!CRIT[id] || Q.items.some(it => it.id === id)) return;
  Q.items.push(newItem(id));
  closeModal();
  renderCritList();
  recompute();
  const card = $(`.crit[data-id="${id}"]`);
  if (card) {
    card.classList.add('is-new');
    card.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
    const f = card.querySelector('button, input');
    if (f) f.focus({ preventScroll: true });
  }
}

// ---------- record preview ----------
function pitch(r) {
  const out = [], s = r.site;
  if (!s) out.push(r.g && r.g.reviews >= 10 ? `Ma ${r.g.reviews} opinii w mapach, ale klienci nie mają gdzie kliknąć dalej. Zacznij od tego, ilu zapytań nie dostaje bez strony.` : 'Firma nie ma strony — pokaż, jak mogłaby wyglądać jej wizytówka w sieci.');
  else if (s.status !== 'ok') out.push('Strona nie działa — możliwe, że właściciel jeszcze o tym nie wie. Uprzejma informacja to dobry początek rozmowy.');
  else {
    if (!s.mobile) out.push('Strona nie działa na telefonie, a większość lokalnych wyszukiwań jest z komórki.');
    if (!s.https) out.push('Przeglądarka oznacza stronę jako „Niezabezpieczoną” — to odstrasza przy formularzu kontaktowym.');
    if (INDUSTRIES[r.ind].svc && !s.booking) out.push('Zapisy tylko przez telefon — rezerwacja online odciąża recepcję i łapie klientów po godzinach.');
  }
  if (r.ads && r.score >= 50) out.push('Płaci za reklamy, które prowadzą na przestarzałą stronę — każda poprawa konwersji od razu się zwraca.');
  if (r.g && r.g.rating && r.g.rating <= 3.9 && r.g.reviews >= 5) out.push(`Średnia ${String(r.g.rating).replace('.', ',')} w mapach — odpowiadanie na opinie to szybka wygrana.`);
  if (r.founded <= 120) out.push('Firma jest nowa, więc właśnie wybiera dostawców.');
  if (r.hiring) out.push(`Rekrutuje (${r.hiring} ${plural(r.hiring, 'oferta', 'oferty', 'ofert')}) — rośnie, więc ma budżet.`);
  if (r.jub && r.jub.days <= 120) out.push(`Za ${r.jub.days} dni ${r.jub.years}-lecie — dobry pretekst do odświeżenia wizerunku.`);
  return out.slice(0, 3);
}

function openRecord(id, qSource) {
  const r = BY_ID.get(id);
  if (!r) return;
  const q = qSource === 'hero' ? heroQuery() : Q;
  const s = r.site;
  const ok = s && s.status === 'ok';
  const z = ok ? zone(r.score) : null;
  const ev = [
    r.founded <= 365 && ['sparkle', `Nowa firma — start ${fmtD(r.fDate)}`],
    r.hiring && ['briefcase-plus', `Rekrutuje: ${r.hiring} ${plural(r.hiring, 'oferta', 'oferty', 'ofert')} pracy`],
    r.band !== '1' && r.growth >= 15 && ['trend', `Zatrudnienie +${r.growth}% rok do roku`],
    r.moved != null && r.moved <= 365 && ['truck', `Nowy adres od ${fmtD(daysAgoDate(r.moved))}`],
    r.board != null && ['user-check', `Zmiana w zarządzie ${ago(r.board)}`],
    r.jub && r.jub.days <= 180 && ['cake', `${r.jub.years}-lecie za ${r.jub.days} ${plural(r.jub.days, 'dzień', 'dni', 'dni')}`],
  ].filter(Boolean);
  const ideas = pitch(r);
  openModal(`
    <header class="modal__head rec__head">
      <div><p class="eyebrow">${INDUSTRIES[r.ind].label} · PKD ${INDUSTRIES[r.ind].pkd}</p><h2 id="mTitle">${esc(r.nameM)}</h2>
      <p class="rec__meta">${esc(r.city)}, ${VOIV[r.voiv].label} · ${LEGAL[r.legal].long} · od ${r.fy} r. · ${BANDS[r.band]}</p></div>
      <button type="button" class="icon-btn" data-act="close" aria-label="Zamknij">${icon('x')}</button>
    </header>
    <div class="rec">
      <div class="rec__shots"><div class="thumb-frame">${siteThumb(r)}</div>${phoneThumb(r)}</div>
      <div class="rec__audit">
        <h3>${ok ? 'Audyt strony' : s ? 'Strona nie działa' : 'Brak strony WWW'}</h3>
        ${ok ? `<div class="gauge" style="--v:${r.score}"><span class="gauge__bar"><i></i></span><span class="pill pill--${z[1]}"><b>${r.score}</b> ${z[2]}</span></div>
          <ul class="checks">${Object.values(SITE_CHECKS).map(c => { const bad = c.test(s); return `<li class="${bad ? 'is-bad' : 'is-ok'}">${icon(bad ? 'x' : 'check')}${bad ? c.label : c.ok}</li>`; }).join('')}</ul>
          <p class="rec__tech">${TECH[s.tech].label} · projekt z ${s.built} · © ${s.copy} · szybkość ${s.speed}/100${s.booking ? ' · rezerwacje online' : ''}</p>`
        : s ? `<p>${s.status === 'down' ? 'Domena nie odpowiada od ostatniego skanu.' : 'Serwer zwraca błąd 500.'} Adres: <span class="mono">${esc(s.domainM)}</span></p>`
        : `<p>Firma ma tylko ${r.g ? 'wizytówkę w mapach' : 'wpis w rejestrze'}${r.fb != null ? ' i profil na Facebooku' : ''}.</p>`}
      </div>
    </div>
    <div class="rec__grid">
      <section><h3>Widoczność</h3><ul class="facts">
        <li>${icon('star')}${r.g ? (r.g.rating ? `Średnia ${String(r.g.rating).replace('.', ',')} ★ z ${r.g.reviews} opinii` : 'Wizytówka bez opinii') + (r.g.claimed ? '' : ' · nieprzejęta') : 'Brak wizytówki w mapach'}</li>
        <li>${icon('message')}${r.fb == null ? 'Brak profilu na Facebooku' : `Facebook: ostatni post ${ago(r.fb)}`}${r.ig ? ' · ma Instagram' : ''}</li>
        <li>${icon('megaphone')}${r.ads ? 'Prowadzi płatne reklamy' : 'Nie widać płatnych reklam'}</li>
      </ul></section>
      <section><h3>Zdarzenia</h3><ul class="facts">${ev.length ? ev.map(([ic, t]) => `<li>${icon(ic)}${t}</li>`).join('') : `<li class="muted">${icon('calendar')}Nic nowego w ostatnim roku</li>`}</ul></section>
      <section><h3>Kontakt <small>po zakupie</small></h3><ul class="facts facts--masked">
        <li>${icon('mail')}${r.email ? `<span class="mono">${esc(r.emailM)}</span>${r.emailType === 'domain' ? '' : ' <small>skrzynka darmowa</small>'}` : '<span class="muted">brak e-maila</span>'}</li>
        <li>${icon('phone')}${r.phone ? `<span class="mono">${esc(r.phoneM)}</span>` : '<span class="muted">brak telefonu</span>'}</li>
        <li>${icon('user')}<span class="mono">${esc(r.person.nameM)}</span> · ${r.person.role}</li>
      </ul></section>
    </div>
    ${ideas.length ? `<div class="rec__pitch"><h3>${icon('sparkle')} Pomysł na pierwszą rozmowę</h3><ul>${ideas.map(t => `<li>${t}</li>`).join('')}</ul></div>` : ''}
    <footer class="modal__foot rec__foot"><span>Dlaczego jest na liście: ${reasonsFor(r, q).map(tag).join('') || '—'}</span></footer>`, 'modal--rec');
}

// ---------- catalog ----------
function viewCatalog(params) {
  const sh = shares();
  const soon = CRITERIA.filter(c => c.status === 'soon').sort((a, b) => votesOf(b) - votesOf(a));
  $app.innerHTML = `
  <section class="wrap page">
    <header class="page__head">
      <p class="eyebrow">Katalog kryteriów</p>
      <h1>Z czego zbudujesz bazę</h1>
      <p class="lead">${ACTIVE.length} kryteriów w ${Object.keys(GROUPS).length} grupach. Każde ma źródło, częstotliwość odświeżania i cenę. Dokładamy nowe co miesiąc — kolejność ustalają głosy.</p>
    </header>
    ${Object.entries(GROUPS).map(([g, G]) => `
      <section class="cat-g">
        <h2>${G.label}<small>${G.desc}</small></h2>
        <div class="cat-grid">${ACTIVE.filter(c => c.group === g).map(c => `
          <article class="card cat">
            <header><span class="crit__ic">${icon(c.icon)}</span><h3>${c.label}</h3></header>
            <p>${c.desc}</p>
            <dl>
              <div><dt>Źródło</dt><dd>${c.source}</dd></div>
              <div><dt>Odświeżanie</dt><dd>${c.refresh}</dd></div>
              ${sh[c.id] != null ? `<div><dt>Spełnia dziś</dt><dd>${share(sh[c.id])} bazy</dd></div>` : ''}
              <div><dt>Cena</dt><dd>${surchargeLabel(c)}</dd></div>
            </dl>
            <a class="btn btn--ghost btn--sm" href="#/kreator?add=${c.id}">${icon('plus')}<span>${c.pinned ? 'Otwórz w kreatorze' : 'Dodaj do kreatora'}</span></a>
          </article>`).join('')}</div>
      </section>`).join('')}
    <section class="cat-g">
      <h2>W przygotowaniu<small>Zagłosuj na to, czego potrzebujesz</small></h2>
      <div class="soon__row soon__row--wide">${soon.map(soonCard).join('')}</div>
    </section>
    <section class="cat-g idea" id="idea">
      <div class="idea__text">
        <h2>Zaproponuj kryterium</h2>
        <p>Masz pomysł na sygnał, który mówi „ta firma potrzebuje mojej usługi teraz”? Opisz go. Jeśli da się go wiarygodnie mierzyć, trafi na listę do głosowania.</p>
        <div id="ideas">${ideasList()}</div>
      </div>
      <form class="card idea__form" id="ideaForm" novalidate>
        <label class="fld"><span>Nazwa kryterium</span><input name="title" required maxlength="80" placeholder="np. Sklep bez płatności BLIK"></label>
        <label class="fld"><span>Co ma wykrywać?</span><textarea name="what" rows="3" required maxlength="400" placeholder="Jakie firmy powinny trafić na listę?"></textarea></label>
        <label class="fld"><span>Skąd można to wiedzieć? <small>opcjonalnie</small></span><input name="source" maxlength="160" placeholder="np. kod strony, rejestr, ogłoszenia"></label>
        <label class="fld"><span>Komu to sprzedajesz? <small>opcjonalnie</small></span><input name="who" maxlength="160" placeholder="np. agencjom e-commerce"></label>
        <button class="btn btn--mark" type="submit">Wyślij propozycję</button>
        <p class="fine">Propozycja zostaje w tej przeglądarce — to makieta.</p>
      </form>
    </section>
  </section>`;
  if (params.get('s') === 'idea') PENDING_SCROLL = 'idea';
}

function ideasList() {
  if (!IDEAS.length) return '';
  return `<h3 class="ideas__h">Twoje propozycje</h3><ul class="ideas">${IDEAS.map(i => `<li><b>${esc(i.title)}</b><span>${esc(i.what)}</span><small>${when(i.at)} · czeka na ocenę</small></li>`).join('')}</ul>`;
}

// ---------- checkout ----------
const FORMATS = [
  ['csv-excel', 'CSV dla Excela', 'średnik, UTF-8 z BOM — otwiera się od razu z polskimi znakami'],
  ['csv', 'CSV standardowy', 'przecinek — arkusze online, import do CRM'],
  ['json', 'JSON', 'dla programistów i automatyzacji'],
];
const FIRST = [
  ['letter', 'List lub wizyta osobista'],
  ['social', 'LinkedIn albo wiadomość w social media'],
  ['phone', 'Telefon'],
  ['email', 'E-mail'],
  ['research', 'Tylko analiza rynku, bez kontaktu'],
];

function goCheckout() {
  if (!RES || !RES.take.length) return;
  const prev = CO || {};
  CO = { q: clone(Q), format: prev.format || 'csv-excel', monitor: false, inv: prev.inv || store.get('inv', { nip: '', name: '', addr: '', email: '' }), first: prev.first || '', ok1: false, ok2: false, pay: 'blik', blik: '' };
  store.set('checkout', CO);
  location.hash = '#/zamowienie';
}

function weeklyEstimate(q) {
  if (!SAMPLE_WEEK) SAMPLE_WEEK = genBatch(4242, 2000000);
  const rows = runQuery(q, { pool: SAMPLE_WEEK }).rows;
  const qt = quote(rows, q);
  return { n: rows.length, cost: Math.min(PRICE.monitorCap, round2(qt.sub - qt.disc)) };
}

function viewCheckout() {
  if (!CO) {
    $app.innerHTML = `<section class="wrap page empty"><h1>Nic tu jeszcze nie ma</h1><p>Najpierw zbuduj bazę w kreatorze — potem wrócisz tu z gotowym wynikiem.</p><a class="btn btn--mark" href="#/kreator">Otwórz kreator ${icon('arrow')}</a></section>`;
    return;
  }
  const res = resolve(CO.q);
  const qt = res.quote;
  const name = CO.q.name || autoName(CO.q);
  const wk = weeklyEstimate(CO.q);
  const radio = (grp, val, cur, title, sub, ic) => `<label class="opt${val === cur ? ' is-on' : ''}"><input type="radio" name="${grp}" value="${val}" data-co="${grp}"${val === cur ? ' checked' : ''}>${ic ? icon(ic) : ''}<span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
  const warn = CO.first === 'phone' || CO.first === 'email';

  $app.innerHTML = `
  <section class="wrap page co">
    <a class="back" href="#/kreator">${icon('back')}<span>Wróć do kreatora</span></a>
    <header class="page__head page__head--tight"><p class="eyebrow">Zamówienie</p><h1>${esc(name)}</h1></header>
    <div class="co__grid">
      <form class="co__main" id="coForm" novalidate>
        <section class="card co__sec"><h2><span class="n">1</span>Format pliku</h2>
          <div class="opts">${FORMATS.map(f => radio('format', f[0], CO.format, f[1], f[2], 'file')).join('')}</div>
        </section>

        <section class="card co__sec"><h2><span class="n">2</span>Monitoring <small>opcjonalnie</small></h2>
          <label class="mon${CO.monitor ? ' is-on' : ''}"><input type="checkbox" data-co="monitor"${CO.monitor ? ' checked' : ''}>
            <span class="switch__ui" aria-hidden="true"></span>
            <span><b>Dosyłaj nowe firmy co poniedziałek</b>
            <small>Firmy, które w ostatnim tygodniu zaczęły spełniać te kryteria: nowe rejestracje, przeprowadzki, świeży skan strony. Z tymi kryteriami to zwykle <b>${firms(wk.n)}</b> tygodniowo, ok. ${zl(wk.cost)} netto. Ta sama stawka za rekord, maks. ${zl(PRICE.monitorCap)} tygodniowo, wyłączasz jednym kliknięciem.</small></span>
          </label>
        </section>

        <section class="card co__sec"><h2><span class="n">3</span>Dane do faktury</h2>
          <div class="row">
            <label class="fld fld--nip" data-f="nip"><span>NIP</span><input inputmode="numeric" autocomplete="off" data-co="inv.nip" value="${esc(CO.inv.nip)}" placeholder="10 cyfr"><em class="err"></em></label>
            <button type="button" class="btn btn--ghost" data-act="gus">${icon('search')}<span>Pobierz z rejestru</span></button>
          </div>
          <label class="fld" data-f="name"><span>Nazwa firmy</span><input autocomplete="organization" data-co="inv.name" value="${esc(CO.inv.name)}"><em class="err"></em></label>
          <label class="fld" data-f="addr"><span>Adres <small>opcjonalnie</small></span><input autocomplete="street-address" data-co="inv.addr" value="${esc(CO.inv.addr)}"></label>
          <label class="fld" data-f="email"><span>E-mail na fakturę i link do pliku</span><input type="email" autocomplete="email" data-co="inv.email" value="${esc(CO.inv.email)}"><em class="err"></em></label>
        </section>

        <section class="card co__sec"><h2><span class="n">4</span>Jak użyjesz danych</h2>
          <fieldset class="fld" data-f="first"><legend>Jak planujesz pierwszy kontakt?</legend>
            <div class="opts opts--list">${FIRST.map(f => radio('first', f[0], CO.first, f[1])).join('')}</div><em class="err"></em>
          </fieldset>
          <div class="note${warn ? '' : ' is-hidden'}" id="firstWarn">${icon('info')}<p><b>Ofertę e-mailem lub telefonicznie możesz przedstawić tylko za wcześniejszą zgodą odbiorcy</b> (art. 398 Prawa komunikacji elektronicznej), także gdy odbiorcą jest firma. Pierwszy kontakt zrób listem, wizytą albo przez LinkedIn, a o sposób pozyskania zgody zapytaj prawnika.</p></div>
          <label class="check" data-f="ok1"><input type="checkbox" data-co="ok1"${CO.ok1 ? ' checked' : ''}><span class="field__box">${icon('check')}</span><span>Użyję danych tylko do kontaktu B2B związanego z moją działalnością i nie odsprzedam ich dalej.</span></label>
          <label class="check" data-f="ok2"><input type="checkbox" data-co="ok2"${CO.ok2 ? ' checked' : ''}><span class="field__box">${icon('check')}</span><span>Wiem, że każda osoba z bazy może się wypisać, i od tej chwili przestanę się z nią kontaktować.</span></label>
          <em class="err" data-err="oks"></em>
        </section>

        <section class="card co__sec"><h2><span class="n">5</span>Płatność</h2>
          <div class="opts">
            ${radio('pay', 'blik', CO.pay, 'BLIK', 'kod z aplikacji banku, plik od razu', 'smartphone')}
            ${radio('pay', 'transfer', CO.pay, 'Przelew', 'faktura proforma, plik po zaksięgowaniu', 'bank')}
          </div>
          <label class="fld fld--blik${CO.pay === 'blik' ? '' : ' is-hidden'}" data-f="blik"><span>Kod BLIK</span><input inputmode="numeric" autocomplete="one-time-code" maxlength="7" data-co="blik" value="${esc(CO.blik)}" placeholder="000 000" class="mono"><em class="err"></em></label>
        </section>
      </form>

      <aside class="co__side">
        <div class="card summary">
          <h2>Podsumowanie</h2>
          <p class="summary__n"><b>${num(res.take.length)}</b> ${plural(res.take.length, 'firma', 'firmy', 'firm')}</p>
          <ul class="summary__steps">${res.steps.slice(1).map(s => `<li>${esc(s.label)}</li>`).join('') || '<li>cała baza</li>'}</ul>
          <dl class="lines">${qt.lines.map(l => `<div><dt>${l.label}<small>${num(l.qty)} × ${zl(l.unit)}</small></dt><dd>${zl(l.total)}</dd></div>`).join('')}
            ${qt.rate ? `<div class="lines__disc"><dt>Rabat −${qt.rate * 100}%</dt><dd>−${zl(qt.disc)}</dd></div>` : ''}
            ${qt.minApplied ? `<div><dt>Minimalne zamówienie</dt><dd>${zl(PRICE.min)}</dd></div>` : ''}
            <div class="lines__sum"><dt>Netto</dt><dd>${zl(qt.net)}</dd></div>
            <div><dt>VAT 23%</dt><dd>${zl(qt.vat)}</dd></div></dl>
          <p class="total"><span>Do zapłaty</span><b>${zl(qt.gross)}</b></p>
          ${CO.monitor ? `<p class="summary__mon">${icon('bell')} + monitoring, ok. ${zl(wk.cost)} netto tygodniowo</p>` : ''}
          <button type="button" class="btn btn--mark btn--block btn--lg" data-act="pay">${CO.pay === 'blik' ? `Zapłać ${zl(qt.gross)}` : 'Zamów i pobierz proformę'}</button>
          <p class="fine">Makieta: płatność jest symulowana, nic nie zostanie obciążone.</p>
        </div>
      </aside>
    </div>
  </section>`;
}

function setCO(path, value) {
  const keys = path.split('.');
  let o = CO;
  while (keys.length > 1) o = o[keys.shift()];
  o[keys[0]] = value;
  store.set('checkout', CO);
  if (path.startsWith('inv.')) store.set('inv', CO.inv);
}

function validateCO() {
  const errs = {};
  if (CO.inv.nip.replace(/\D/g, '').length !== 10) errs.nip = 'NIP ma 10 cyfr.';
  if (!CO.inv.name.trim()) errs.name = 'Podaj nazwę firmy.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CO.inv.email.trim())) errs.email = 'Podaj poprawny e-mail.';
  if (!CO.first) errs.first = 'Wybierz jedną odpowiedź.';
  if (!CO.ok1 || !CO.ok2) errs.oks = 'Zaznacz oba oświadczenia.';
  if (CO.pay === 'blik' && !/^\d{6}$/.test(CO.blik.replace(/\s/g, ''))) errs.blik = 'Kod BLIK ma 6 cyfr.';
  $$('#coForm [data-f]').forEach(f => { const e = errs[f.dataset.f]; f.classList.toggle('has-err', !!e); const m = f.querySelector('.err'); if (m) m.textContent = e || ''; });
  const oks = $('[data-err="oks"]');
  oks.textContent = errs.oks || '';
  $$('[data-f="ok1"], [data-f="ok2"]').forEach(f => f.classList.toggle('has-err', !!errs.oks && !CO[f.dataset.f]));
  const first = $('#coForm .has-err, [data-err="oks"]:not(:empty)');
  if (first) { first.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' }); const i = first.querySelector('input'); if (i) i.focus({ preventScroll: true }); }
  return !Object.keys(errs).length;
}

function pay() {
  if (!validateCO()) return;
  const res = resolve(CO.q);
  if (CO.pay === 'transfer') { finishOrder(res, 'transfer'); return; }
  openModal(`<div class="blik-pay" id="blikPay">
      <span class="blik-pay__ic">${icon('smartphone')}</span>
      <h2 id="mTitle">Potwierdź w aplikacji banku</h2>
      <p>Kwota <b>${zl(res.quote.gross)}</b> · odbiorca ${COMPANY.name}</p>
      <span class="bar"><i></i></span>
      <p class="fine">Symulacja — czekamy kilka sekund na „potwierdzenie”.</p>
    </div>`, 'modal--small');
  const code = CO.blik.replace(/\s/g, '');
  setTimeout(() => {
    const box = $('#blikPay');
    if (!box) return;
    if (code === '000000') {
      box.innerHTML = `<span class="blik-pay__ic is-bad">${icon('x')}</span><h2 id="mTitle">Płatność odrzucona</h2><p>Kod BLIK wygasł albo jest nieprawidłowy. Wygeneruj nowy w aplikacji banku.</p><button type="button" class="btn btn--ink" data-act="close" autofocus>Wpisz nowy kod</button>`;
      box.querySelector('button').focus();
      return;
    }
    box.innerHTML = `<span class="blik-pay__ic is-ok">${icon('check')}</span><h2 id="mTitle">Płatność przyjęta</h2><p>Przygotowujemy plik…</p>`;
    setTimeout(() => finishOrder(res, 'blik'), 900);
  }, 2400);
}

function finishOrder(res, method) {
  const seq = store.get('seq', 0) + 1;
  store.set('seq', seq);
  const o = {
    no: `NM-${YEAR}-${String(seq).padStart(4, '0')}`, seq, at: Date.now(),
    name: CO.q.name || autoName(CO.q), q: encodeQuery(CO.q),
    steps: res.steps.slice(1).map(s => s.label),
    ids: res.take.map(r => r.id), n: res.take.length,
    fields: clone(CO.q.fields), format: CO.format, monitor: CO.monitor,
    total: { net: res.quote.net, vat: res.quote.vat, gross: res.quote.gross },
    pay: method, inv: clone(CO.inv),
    status: method === 'blik' ? 'paid' : 'awaiting', paidAt: method === 'blik' ? Date.now() : null,
    deliveries: [],
  };
  ORDERS.unshift(o);
  saveOrders();
  CO = null;
  store.set('checkout', null);
  closeModal();
  location.hash = '#/zamowienia?o=' + o.no;
}

// ---------- orders ----------
const PREP = ['Wybieramy rekordy', 'Sprawdzamy e-maile na serwerach pocztowych', 'Usuwamy osoby, które się wypisały', 'Składamy plik'];
const PREP_MS = 6500;
const orderState = o => o.status === 'awaiting' ? 'awaiting' : Date.now() < o.paidAt + PREP_MS ? 'preparing' : 'ready';

function nextMonday(ts, plusWeeks = 0) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7) + plusWeeks * 7);
  return d;
}

function viewOrders(params) {
  const hl = params.get('o');
  if (!ORDERS.length) {
    $app.innerHTML = `<section class="wrap page empty"><p class="eyebrow">Zamówienia</p><h1>Jeszcze nic nie kupiłeś</h1><p>Zbuduj bazę, zobacz podgląd i zamów plik. Wszystkie zamówienia i pliki do pobrania będą tutaj.</p><a class="btn btn--mark" href="#/kreator">Otwórz kreator ${icon('arrow')}</a></section>`;
    return;
  }
  $app.innerHTML = `<section class="wrap page">
    <header class="page__head"><p class="eyebrow">Zamówienia</p><h1>Twoje bazy</h1><p class="lead">Pliki są do pobrania bez limitu przez 12 miesięcy. Firmy z tych zamówień kreator domyślnie pomija.</p></header>
    <div class="orders">${ORDERS.map(o => orderCard(o, o.no === hl)).join('')}</div>
  </section>`;
  TIMER = setInterval(tickOrders, 300);
}

function orderCard(o, hl) {
  const st = orderState(o);
  const pill = { awaiting: ['warn', 'Czeka na wpłatę'], preparing: ['info', 'Przygotowujemy'], ready: ['ok', 'Gotowe'] }[st];
  const fields = ['dane firmy', ...Object.keys(FIELDS).filter(k => o.fields[k]).map(k => FIELDS[k].label.toLowerCase())].join(', ');
  const fmt = FORMATS.find(f => f[0] === o.format);
  let body = '';
  if (st === 'awaiting') {
    body = `<div class="transfer"><h3>${icon('bank')} Dane do przelewu</h3><dl>
      <div><dt>Odbiorca</dt><dd>${COMPANY.name}</dd></div>
      <div><dt>Konto</dt><dd class="mono">00 0000 0000 0000 0000 0000 0000</dd></div>
      <div><dt>Tytuł</dt><dd class="mono">${o.no}</dd></div>
      <div><dt>Kwota</dt><dd><b>${zl(o.total.gross)}</b></dd></div></dl>
      <button type="button" class="btn btn--ink btn--sm" data-act="paid" data-no="${o.no}">${icon('check')}<span>Symuluj zaksięgowanie wpłaty</span></button></div>`;
  } else if (st === 'preparing') {
    body = `<div class="prep" data-prep="${o.no}">${prepHTML(o)}</div>`;
  } else {
    const kb = Math.max(1, Math.round(o.n * (o.format === 'json' ? 0.62 : 0.34)));
    body = `<div class="ready">
      <button type="button" class="btn btn--mark" data-act="dl" data-no="${o.no}">${icon('download')}<span>Pobierz ${fmt[1]} · ${firms(o.n)} · ok. ${num(kb)} KB</span></button>
      <a class="btn btn--ghost btn--sm" href="#/kreator?q=${o.q}">${icon('layers')}<span>Otwórz zapytanie w kreatorze</span></a>
      <span class="muted">${icon('file')} Faktura wysłana na ${esc(o.inv.email)} (symulacja)</span></div>
      ${o.monitor ? monitorHTML(o) : ''}`;
  }
  return `<article class="card order${hl ? ' is-hl' : ''}" data-order="${o.no}">
    <header class="order__head">
      <div><h2>${esc(o.name)}</h2><p class="order__meta"><span class="mono">${o.no}</span> · ${when(o.at)} · ${o.pay === 'blik' ? 'BLIK' : 'przelew'} · ${zl(o.total.gross)}</p></div>
      <span class="status status--${pill[0]}">${pill[1]}</span>
    </header>
    <p class="order__facts"><b>${firms(o.n)}</b> · ${fields} · ${fmt[1]}</p>
    <div class="order__chips">${o.steps.map(s => `<span class="mini">${esc(s)}</span>`).join('')}</div>
    ${body}
  </article>`;
}

function prepHTML(o) {
  const k = Math.min(1, (Date.now() - o.paidAt) / PREP_MS);
  const at = Math.floor(k * PREP.length);
  return `<span class="bar bar--static"><i style="width:${Math.round(k * 100)}%"></i></span>
    <ol>${PREP.map((p, i) => `<li class="${i < at ? 'is-done' : i === at ? 'is-now' : ''}">${icon(i < at ? 'check' : 'clock')}${p}${i === 1 && o.fields.email ? ` <small>(${num(o.ids.filter(id => BY_ID.get(id) && BY_ID.get(id).email).length)})</small>` : ''}</li>`).join('')}</ol>`;
}

function monitorHTML(o) {
  const next = nextMonday(o.at, o.deliveries.length);
  return `<div class="mon-box">
    <header><h3>${icon('bell')} Monitoring aktywny</h3><span class="muted">kolejna dostawa ${next.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}</span></header>
    ${o.deliveries.length ? `<ul class="deliv">${o.deliveries.slice().reverse().map(d => `<li><span><b>Tydzień ${d.week}</b> · ${nextMonday(o.at, d.week - 1).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span><span>${d.n ? `+${firms(d.n)} · ${zl(d.cost)}` : 'brak nowych firm · 0 zł'}</span>${d.n ? `<button type="button" class="btn btn--ghost btn--sm" data-act="dl" data-no="${o.no}" data-week="${d.week}">${icon('download')}<span>Pobierz</span></button>` : '<span></span>'}</li>`).join('')}</ul>` : '<p class="muted">Pierwsza dostawa w najbliższy poniedziałek.</p>'}
    <div class="mon-box__act">
      <button type="button" class="btn btn--ink btn--sm" data-act="week" data-no="${o.no}">${icon('refresh')}<span>Symuluj kolejny tydzień</span></button>
      <button type="button" class="btn btn--ghost btn--sm" data-act="monitor-off" data-no="${o.no}">Wyłącz monitoring</button>
    </div></div>`;
}

function tickOrders() {
  if (!$('.orders')) { clearInterval(TIMER); return; }
  for (const o of ORDERS) {
    const el = $(`[data-prep="${o.no}"]`);
    if (!el) continue;
    if (orderState(o) === 'ready') {
      $(`[data-order="${o.no}"]`).outerHTML = orderCard(o, true);
      toast(`Plik ${o.no} jest gotowy`);
    } else el.innerHTML = prepHTML(o);
  }
}

const findOrder = no => ORDERS.find(o => o.no === no);
function rerenderOrder(o) { const el = $(`[data-order="${o.no}"]`); if (el) el.outerHTML = orderCard(o, true); }

function simulateWeek(o) {
  const week = o.deliveries.length + 1;
  const q = decodeQuery(o.q) || blankQuery();
  const seed = hashStr(o.no + ':' + week), start = 1000000 + o.seq * 10000 + week * 600;
  const res = runQuery(q, { pool: genBatch(seed, start) });
  const qt = quote(res.rows, q);
  o.deliveries.push({ week, n: res.rows.length, cost: res.rows.length ? Math.min(PRICE.monitorCap, round2(qt.sub - qt.disc)) : 0, seed, start, ids: res.rows.map(r => r.id) });
  saveOrders();
  rerenderOrder(o);
  toast(res.rows.length ? `Tydzień ${week}: ${firms(res.rows.length)} nowych w bazie` : `Tydzień ${week}: brak nowych firm`);
}

// ---------- export ----------
function exportRows(rows, q, fields, format) {
  return rows.map(r => {
    const s = r.site, ok = s && s.status === 'ok';
    const o = {
      nip: r.nip, nazwa: r.name, forma_prawna: LEGAL[r.legal].label, pkd: INDUSTRIES[r.ind].pkd, branza: INDUSTRIES[r.ind].label,
      ulica: r.street, kod_pocztowy: r.postal, miejscowosc: r.city, wojewodztwo: VOIV[r.voiv].label,
      data_rozpoczecia: isoDate(r.fDate), zatrudnienie: BANDS[r.band],
      www: s ? `http${s.https ? 's' : ''}://${s.domain}` : '',
      status_strony: !s ? 'brak' : ok ? 'działa' : s.status === 'down' ? 'nie odpowiada' : 'błąd serwera',
      wynik_strony: r.score ?? '', problemy_strony: ok ? Object.values(SITE_CHECKS).filter(c => c.test(s)).map(c => c.label).join(', ') : '',
      technologia: ok ? TECH[s.tech].label : '', rezerwacje_online: ok ? (s.booking ? 'tak' : 'nie') : '',
      mapy_ocena: r.g && r.g.rating != null ? r.g.rating : '', mapy_opinie: r.g ? r.g.reviews : '',
      facebook_ostatni_post: r.fb != null ? isoDate(daysAgoDate(r.fb)) : '', reklamy: r.ads ? 'tak' : 'nie', oferty_pracy: r.hiring,
    };
    if (fields.email) o.email = r.email || '';
    if (fields.phone) o[format === 'json' ? 'telefon' : 'telefon_48'] = r.phone ? (format === 'json' ? r.phone : r.phone.replace(/^\+48 /, '')) : '';
    if (fields.person) { o.osoba = r.person.name; o.rola = r.person.role; }
    o.dlaczego = reasonsFor(r, q).join(' | ');
    return o;
  });
}

function toFile(rows, format) {
  if (format === 'json') return { blob: new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), ext: 'json' };
  const sep = format === 'csv-excel' ? ';' : ',';
  const cols = rows.length ? Object.keys(rows[0]) : ['nip'];
  const cell = v => {
    let s = typeof v === 'number' && format === 'csv-excel' ? String(v).replace('.', ',') : String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // no formulas from data
    return /["\r\n;,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [cols.join(sep), ...rows.map(r => cols.map(c => cell(r[c])).join(sep))].join('\r\n');
  return { blob: new Blob([(format === 'csv-excel' ? '﻿' : '') + text], { type: 'text/csv;charset=utf-8' }), ext: 'csv' };
}

function downloadOrder(o, week) {
  const q = decodeQuery(o.q) || blankQuery();
  let rows;
  if (week) {
    const d = o.deliveries.find(x => x.week === week);
    const ids = new Set(d.ids);
    rows = genBatch(d.seed, d.start).filter(r => ids.has(r.id));
  } else rows = o.ids.map(id => BY_ID.get(id)).filter(Boolean);
  const { blob, ext } = toFile(exportRows(rows, q, o.fields, o.format), o.format);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `namiar-${o.no}${week ? '-tydzien-' + week : ''}-${slug(o.name).slice(0, 40)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- actions ----------
const ACTIONS = {
  close: () => closeModal(),
  theme: () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
    syncThemeBtn();
  },
  testdata: el => {
    const box = $('#testData');
    box.hidden = !box.hidden;
    el.setAttribute('aria-expanded', String(!box.hidden));
  },
  rec: el => openRecord(+el.dataset.id, el.dataset.q),
  vote: el => {
    const id = el.dataset.id;
    VOTES[id] = !VOTES[id];
    if (!VOTES[id]) delete VOTES[id];
    store.set('votes', VOTES);
    $$(`[data-act="vote"][data-id="${id}"]`).forEach(b => {
      b.classList.toggle('is-on', !!VOTES[id]);
      b.setAttribute('aria-pressed', String(!!VOTES[id]));
      b.querySelector('span').textContent = num(votesOf(CRIT[id]));
      b.querySelector('.sr').textContent = voteLabel(id);
    });
    if (VOTES[id]) toast('Dzięki, głos zapisany');
  },

  // builder
  chip: el => {
    const idx = +el.dataset.idx, it = Q.items[idx];
    const pr = CRIT[it.id].params.find(p => p.id === el.dataset.param);
    const opt = pr.options(it.p).find(o => String(o[0]) === el.dataset.val);
    if (!opt) return;
    const arr = it.p[pr.id], i = arr.indexOf(opt[0]);
    if (i >= 0) arr.splice(i, 1); else arr.push(opt[0]);
    if (it.id === 'region' && pr.id === 'voiv') it.p.city = it.p.city.filter(c => it.p.voiv.includes(CITY_VOIV[c]));
    renderCard(idx, el);
    schedule();
  },
  seg: el => {
    const idx = +el.dataset.idx, it = Q.items[idx];
    const pr = CRIT[it.id].params.find(p => p.id === el.dataset.param);
    const opt = pr.options.find(o => String(o[0]) === el.dataset.val);
    it.p[pr.id] = opt[0];
    renderCard(idx, el);
    schedule();
  },
  mode: el => {
    const idx = +el.dataset.idx;
    Q.items[idx].mode = el.dataset.v;
    renderCard(idx);
    $(`.crit[data-idx="${idx}"] [data-act="mode"][data-v="${el.dataset.v}"]`).focus();
    schedule();
  },
  remove: el => {
    Q.items.splice(+el.dataset.idx, 1);
    renderCritList();
    recompute();
  },
  drop: el => {
    const idx = +el.dataset.idx, it = Q.items[idx];
    if (CRIT[it.id].pinned) Q.items[idx] = newItem(it.id); else Q.items.splice(idx, 1);
    renderCritList();
    recompute();
  },
  picker: () => openPicker(),
  pick: el => addCriterion(el.dataset.id),
  quick: el => addCriterion(el.dataset.id),
  more: () => { PV_SHOW += 10; renderPreview(); },
  limit: el => {
    if (el.dataset.v === 'all') Q.limit = 0;
    else Q.limit = Q.limit || Math.max(1, Math.min(100, RES.rows.length));
    recompute();
    if (Q.limit) $('#limitN').focus();
  },
  share: () => {
    const url = location.href.split('#')[0] + qLink(Q);
    const done = () => toast('Link do zapytania skopiowany');
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Skopiuj link:', url));
    else prompt('Skopiuj link:', url);
  },
  reset: () => {
    Q = blankQuery();
    PV_SHOW = 10;
    viewBuilder(new URLSearchParams());
    toast('Kreator wyczyszczony');
  },
  order: () => goCheckout(),

  // checkout
  gus: el => {
    const nip = CO.inv.nip.replace(/\D/g, '');
    const f = $('[data-f="nip"]');
    if (nip.length !== 10) { f.classList.add('has-err'); f.querySelector('.err').textContent = 'Wpisz 10 cyfr NIP-u.'; return; }
    el.disabled = true;
    el.querySelector('span').textContent = 'Szukam…';
    setTimeout(() => {
      const names = ['Pikselownia sp. z o.o.', 'Agencja Zasięg sp. z o.o.', 'Studio Kreska s.c.', 'Lejek Marketing sp. z o.o.', 'Nowa Witryna sp. z o.o.'];
      const h = hashStr(nip);
      CO.inv.name = names[h % names.length];
      CO.inv.addr = `ul. Przykładowa ${1 + h % 90}, 00-${String(h % 1000).padStart(3, '0')} Warszawa`;
      store.set('checkout', CO);
      store.set('inv', CO.inv);
      $('[data-co="inv.name"]').value = CO.inv.name;
      $('[data-co="inv.addr"]').value = CO.inv.addr;
      f.classList.remove('has-err');
      $('[data-f="name"]').classList.remove('has-err');
      el.disabled = false;
      el.querySelector('span').textContent = 'Pobierz z rejestru';
      toast('Dane pobrane z rejestru (symulacja)');
    }, 700);
  },
  pay: () => pay(),

  // orders
  paid: el => {
    const o = findOrder(el.dataset.no);
    o.status = 'paid';
    o.paidAt = Date.now();
    saveOrders();
    rerenderOrder(o);
  },
  dl: el => downloadOrder(findOrder(el.dataset.no), el.dataset.week ? +el.dataset.week : 0),
  week: el => simulateWeek(findOrder(el.dataset.no)),
  'monitor-off': el => {
    const o = findOrder(el.dataset.no);
    o.monitor = false;
    saveOrders();
    rerenderOrder(o);
    toast('Monitoring wyłączony');
  },
};

document.addEventListener('click', e => {
  const scroll = e.target.closest('[data-scroll]');
  if (scroll) {
    const id = scroll.dataset.scroll;
    if (!location.hash.replace(/^#\/?/, '') && $('#' + id)) { e.preventDefault(); $('#' + id).scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); }
    else PENDING_SCROLL = id;
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('#critList input[type="range"]')) {
    const it = Q.items[+t.dataset.idx];
    const pr = CRIT[it.id].params.find(p => p.id === t.dataset.param);
    it.p[pr.id] = Number(t.value);
    t.closest('.param').querySelector('[data-out]').textContent = pr.fmt(it.p[pr.id]);
    schedule();
  } else if (t.matches('.chip-search input')) filterChips(t);
  else if (t.id === 'qName') { Q.name = t.value; saveDraft(); }
  else if (t.id === 'limitN') {
    const v = parseInt(t.value, 10);
    if (v > 0) { Q.limit = v; schedule(); }
  } else if (t.id === 'excludeTxt') {
    Q.exclude = t.value;
    const ex = parseExclude(Q.exclude);
    $('#exInfo').textContent = ex.size ? `Rozpoznano ${ex.nips.size} NIP-ów i ${ex.domains.size} domen.` : 'Separator: spacja, przecinek albo nowa linia.';
    schedule();
  } else if (t.id === 'pickQ') {
    const q = norm(t.value.trim());
    $$('.picker__list .pick-row').forEach(r => { r.hidden = q && !r.dataset.text.includes(q); });
    $$('.picker__g').forEach(g => { g.hidden = !g.querySelector('.pick-row:not([hidden])'); });
  } else if (t.matches('[data-co]') && t.type !== 'radio' && t.type !== 'checkbox') {
    if (t.dataset.co === 'blik') t.value = t.value.replace(/[^\d ]/g, '');
    setCO(t.dataset.co, t.value);
    const f = t.closest('[data-f]');
    if (f && f.classList.contains('has-err')) { f.classList.remove('has-err'); f.querySelector('.err').textContent = ''; }
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-hero]')) {
    HERO[t.dataset.hero] = t.value;
    store.set('hero', HERO);
    autosize(t);
    renderHero();
  } else if (t.matches('#critList input[type="checkbox"][data-param]')) {
    Q.items[+t.dataset.idx].p[t.dataset.param] = t.checked;
    schedule();
  } else if (t.id === 'skipBought') { Q.skipBought = t.checked; schedule(); }
  else if (t.matches('[data-field]')) { Q.fields[t.dataset.field] = t.checked; schedule(); }
  else if (t.id === 'sortSel') { Q.sort = t.value; PV_SHOW = 10; schedule(); }
  else if (t.id === 'limitN') { if (!(parseInt(t.value, 10) > 0)) { Q.limit = 0; schedule(); } }
  else if (t.matches('[data-co]')) {
    const k = t.dataset.co;
    if (t.type === 'checkbox') setCO(k, t.checked);
    else if (t.type === 'radio') setCO(k, t.value);
    if (t.type === 'radio' || k === 'monitor') {
      const y = scrollY;
      viewCheckout();
      scrollTo(0, y);
      const back = $(`[data-co="${k}"]${t.type === 'radio' ? `[value="${t.value}"]` : ''}`);
      if (back) back.focus({ preventScroll: true });
    } else {
      const f = t.closest('[data-f]');
      if (f) f.classList.remove('has-err');
      if (CO.ok1 && CO.ok2) $('[data-err="oks"]').textContent = '';
    }
  }
});

document.addEventListener('submit', e => {
  if (e.target.id !== 'ideaForm') return;
  e.preventDefault();
  const fd = new FormData(e.target);
  const title = String(fd.get('title') || '').trim(), what = String(fd.get('what') || '').trim();
  $$('#ideaForm .fld').forEach(f => f.classList.remove('has-err'));
  if (!title || !what) {
    if (!title) e.target.title.closest('.fld').classList.add('has-err');
    if (!what) e.target.what.closest('.fld').classList.add('has-err');
    (title ? e.target.what : e.target.title).focus();
    return;
  }
  IDEAS.unshift({ title, what, source: String(fd.get('source') || '').trim(), who: String(fd.get('who') || '').trim(), at: Date.now() });
  store.set('ideas', IDEAS);
  e.target.reset();
  $('#ideas').innerHTML = ideasList();
  toast('Dzięki! Propozycja trafiła na listę');
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ---------- router ----------
const VIEWS = {
  '': [viewHome, 'Namiar — bazy firm na zamówienie'],
  kreator: [viewBuilder, 'Kreator bazy — Namiar'],
  kryteria: [viewCatalog, 'Kryteria — Namiar'],
  zamowienie: [viewCheckout, 'Zamówienie — Namiar'],
  zamowienia: [viewOrders, 'Zamówienia — Namiar'],
};

function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const view = path.split('/')[0];
  const [fn, title] = VIEWS[view] || VIEWS[''];
  clearInterval(TIMER);
  closeModal();
  $$('[data-nav]').forEach(a => a.classList.toggle('is-active', a.dataset.nav === (VIEWS[view] ? view : '')));
  document.body.dataset.view = VIEWS[view] ? view || 'home' : 'home';
  document.title = title;
  fn(new URLSearchParams(qs || ''));
  if (PENDING_SCROLL && $('#' + PENDING_SCROLL)) { $('#' + PENDING_SCROLL).scrollIntoView(); PENDING_SCROLL = null; }
  else if (!$('.crit.is-new')) scrollTo(0, 0);
  PENDING_SCROLL = null;
}

function updateNavCount() {
  const el = $('#orderCount');
  el.hidden = !ORDERS.length;
  el.textContent = ORDERS.length;
}
function syncThemeBtn() {
  const dark = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  const b = $('#themeBtn');
  b.innerHTML = icon(dark ? 'sun' : 'moon');
  b.setAttribute('aria-label', dark ? 'Jasny motyw' : 'Ciemny motyw');
}

$('#testData').innerHTML = `<div class="wrap test-data__in">
  <p><b>BLIK:</b> dowolne 6 cyfr. <span class="mono">000000</span> = płatność odrzucona.</p>
  <p><b>NIP do faktury:</b> dowolne 10 cyfr, np. <span class="mono">0000000000</span> — „Pobierz z rejestru” wpisze fikcyjną firmę.</p>
  <p><b>Przelew:</b> zamówienie czeka na wpłatę, zaksięgujesz ją przyciskiem.</p>
  <p><b>Monitoring:</b> włącz go przy zamówieniu, a potem „Symuluj kolejny tydzień”.</p></div>`;
$('#dbSize').textContent = num(DB_SIZE);
$('#year').textContent = YEAR;
updateNavCount();
syncThemeBtn();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeBtn);
window.addEventListener('hashchange', route);
window.addEventListener('resize', () => $$('[data-hero]').forEach(autosize));
route();
