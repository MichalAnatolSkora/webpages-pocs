// Rocznik v1 — mock data: fictional Polish companies with KRS extracts, RDF documents and nine years of statements.
// KRS numbers start at 0009… (past anything the register has issued), NIPs and REGONs at 000…,
// so no record points at a real company. People are masked the way the open KRS API masks them.

const DAY = 86400000;
const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const YESTERDAY = new Date(TODAY - DAY);
const FIRST_FY = 2017;
// a fiscal year counts as closed once its filing deadline (15 July of the next year) has passed
const LAST_FY = TODAY >= new Date(TODAY.getFullYear(), 6, 15) ? TODAY.getFullYear() - 1 : TODAY.getFullYear() - 2;
const FYS = Array.from({ length: LAST_FY - FIRST_FY + 1 }, (_, i) => FIRST_FY + i);
const DEADLINE = fy => new Date(fy + 1, 6, 15);
const DB_SIZE = 1400;
const SEED = 20261029;

// what the whole register looks like in production (mock estimates for counters and dashboards)
const UNIVERSE = {
  krsMax: 1196400,
  rejestrP: 846120,
  aktywneP: 612480,
  sprawozdania: 2914008,
  dokumenty: 11380412,
  pozycje: 233140000,
  blobsTB: 3.8,
  ocr: 184220,
};

// ---------- random ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dice(rng) {
  return {
    f: rng,
    int: (a, b) => a + Math.floor(rng() * (b - a + 1)),
    pick: arr => arr[Math.floor(rng() * arr.length)],
    chance: p => rng() < p,
    norm: (m = 0, s = 1) => m + s * Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()),
    weighted(pairs) {
      let t = 0;
      for (const p of pairs) t += p[1];
      let x = rng() * t;
      for (const p of pairs) if ((x -= p[1]) < 0) return p[0];
      return pairs[pairs.length - 1][0];
    },
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// a stable fake sha256 for blob keys
function fakeSha(s) {
  let out = '', h = hashStr(s);
  while (out.length < 64) { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; out += h.toString(16).padStart(8, '0'); }
  return out.slice(0, 64);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const ymd = (y, m, d) => new Date(y, m - 1, d);

// ---------- text helpers ----------
const PL_ASCII = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
const slug = s => s.toLowerCase().replace(/[ąćęłńóśźż]/g, c => PL_ASCII[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cap = s => s[0].toUpperCase() + s.slice(1);
const upperPl = s => s.toLocaleUpperCase('pl-PL');
const plural = (n, one, few, many) => n === 1 ? one : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? few : many;

// ---------- dictionaries ----------
const PLACES = [
  ['mazowieckie', 'Warszawa', '00', 'WA'], ['mazowieckie', 'Radom', '26', 'RA'], ['małopolskie', 'Kraków', '30', 'KR'], ['małopolskie', 'Nowy Sącz', '33', 'NS'],
  ['śląskie', 'Katowice', '40', 'KA'], ['śląskie', 'Gliwice', '44', 'GL'], ['wielkopolskie', 'Poznań', '60', 'PO'], ['wielkopolskie', 'Kalisz', '62', 'KZ'],
  ['dolnośląskie', 'Wrocław', '50', 'WR'], ['łódzkie', 'Łódź', '90', 'LD'], ['pomorskie', 'Gdańsk', '80', 'GD'], ['pomorskie', 'Gdynia', '81', 'GD'],
  ['zachodniopomorskie', 'Szczecin', '70', 'SZ'], ['kujawsko-pomorskie', 'Bydgoszcz', '85', 'BY'], ['kujawsko-pomorskie', 'Toruń', '87', 'TO'],
  ['lubelskie', 'Lublin', '20', 'LU'], ['podkarpackie', 'Rzeszów', '35', 'RZ'], ['podlaskie', 'Białystok', '15', 'BI'], ['warmińsko-mazurskie', 'Olsztyn', '10', 'OL'],
  ['świętokrzyskie', 'Kielce', '25', 'KI'], ['opolskie', 'Opole', '45', 'OP'], ['lubuskie', 'Zielona Góra', '65', 'ZG'],
];
const WOJ = [...new Set(PLACES.map(p => p[0]))].sort((a, b) => a.localeCompare(b, 'pl'));
const STREETS = ['Kasztanowa', 'Przemysłowa', 'Długa', 'Polna', 'Fabryczna', 'Lipowa', 'Składowa', 'Torowa', 'Rzemieślnicza', 'Ogrodowa', 'Handlowa', 'Hutnicza', 'Młyńska', 'Spokojna', 'Graniczna', 'Kolejowa', 'Topolowa', 'Magazynowa', 'Wierzbowa', 'Słoneczna'];

const SECTORS = [
  { pkd: '62.01.Z', name: 'Działalność związana z oprogramowaniem', short: 'Oprogramowanie', w: 10, margin: [0.1, 0.07], turn: 1.6, fixed: 0.18, wnip: 0.35, ltInv: 0.1, inv: 0.02, ltDebt: 0.08, goods: 0.04, g: 0.13, covid: 0.05, kalk: 0.4, suf: ['soft', 'tech', 'net', 'data'], pat: ['{W}', '{S} Software', '{S} Systems', '{W} Labs', '{S} Data'], drivers: ['nowe wdrożenia u klientów z sektora finansowego', 'wzrost przychodów z abonamentów SaaS', 'rozbudowa zespołu developerskiego'], risks: ['presja płacowa w IT', 'koncentracja przychodów u kilku klientów'] },
  { pkd: '41.20.Z', name: 'Roboty budowlane związane ze wznoszeniem budynków mieszkalnych i niemieszkalnych', short: 'Budownictwo', w: 10, margin: [0.04, 0.04], turn: 1.3, fixed: 0.2, wnip: 0.02, ltInv: 0.05, inv: 0.31, ltDebt: 0.15, goods: 0.08, g: 0.07, covid: -0.04, kalk: 0.3, suf: ['bud', 'dom', 'bet'], pat: ['{W}', 'Przedsiębiorstwo Budowlane {W}', '{S} Inwestycje Budowlane', '{W}-Dom'], drivers: ['realizacja kontraktów w generalnym wykonawstwie', 'portfel zamówień publicznych'], risks: ['ceny materiałów budowlanych', 'opóźnienia płatności od inwestorów'] },
  { pkd: '46.90.Z', name: 'Sprzedaż hurtowa niewyspecjalizowana', short: 'Hurt', w: 9, margin: [0.022, 0.025], turn: 2.4, fixed: 0.12, wnip: 0.02, ltInv: 0.03, inv: 0.38, ltDebt: 0.1, goods: 0.78, g: 0.06, covid: -0.02, kalk: 0.35, suf: ['mex', 'pol', 'hurt'], pat: ['{W}', 'Hurtownia {S}', '{S} Dystrybucja', '{W} Handel'], drivers: ['rozszerzenie asortymentu', 'nowi odbiorcy z sieci handlowych'], risks: ['niska marża handlowa', 'poziom zapasów'] },
  { pkd: '49.41.Z', name: 'Transport drogowy towarów', short: 'Transport', w: 9, margin: [0.035, 0.035], turn: 1.5, fixed: 0.55, wnip: 0.01, ltInv: 0.02, inv: 0.03, ltDebt: 0.35, goods: 0.02, g: 0.06, covid: -0.07, kalk: 0.15, suf: ['trans', 'log', 'sped'], pat: ['{W}', 'Trans-{S}', '{S} Logistyka', '{S} Spedycja'], drivers: ['wymiana floty na ciągniki Euro 6', 'stałe kontrakty z operatorami logistycznymi'], risks: ['ceny paliwa', 'dostępność kierowców'] },
  { pkd: '10.71.Z', name: 'Produkcja pieczywa; produkcja świeżych wyrobów ciastkarskich i ciastek', short: 'Piekarnie', w: 5, margin: [0.04, 0.03], turn: 1.9, fixed: 0.45, wnip: 0.01, ltInv: 0.02, inv: 0.1, ltDebt: 0.25, goods: 0.1, g: 0.06, covid: 0, kalk: 0.1, suf: ['pol', 'smak'], pat: ['Piekarnia {S}', 'Zakład Piekarniczy {S}', '{S} Piekarnie Rzemieślnicze'], drivers: ['nowe punkty sprzedaży firmowej', 'dostawy do sieci dyskontów'], risks: ['ceny mąki i energii', 'koszty pracy'] },
  { pkd: '68.20.Z', name: 'Wynajem i zarządzanie nieruchomościami własnymi lub dzierżawionymi', short: 'Nieruchomości', w: 8, margin: [0.2, 0.12], turn: 0.16, fixed: 0.88, wnip: 0, ltInv: 0.6, inv: 0, ltDebt: 0.65, goods: 0, g: 0.05, covid: -0.05, kalk: 0.2, suf: ['dom', 'park', 'invest'], pat: ['{S} Nieruchomości', '{S} Property', '{W} Development', '{S} Park'], drivers: ['indeksacja czynszów', 'pełne obłożenie powierzchni'], risks: ['stopy procentowe kredytu inwestycyjnego', 'pustostany'] },
  { pkd: '86.22.Z', name: 'Praktyka lekarska specjalistyczna', short: 'Medycyna', w: 6, margin: [0.09, 0.05], turn: 1.4, fixed: 0.4, wnip: 0.03, ltInv: 0.02, inv: 0.04, ltDebt: 0.2, goods: 0.02, g: 0.1, covid: -0.03, kalk: 0.15, suf: ['med', 'vit', 'medica'], pat: ['Centrum Medyczne {S}', '{W}', 'Przychodnia {S}', '{S} Klinika'], drivers: ['kontrakt z NFZ', 'nowa poradnia specjalistyczna'], risks: ['dostępność lekarzy', 'wycena świadczeń NFZ'] },
  { pkd: '35.11.Z', name: 'Wytwarzanie energii elektrycznej', short: 'Energetyka', w: 5, margin: [0.22, 0.14], turn: 0.2, fixed: 0.9, wnip: 0.02, ltInv: 0.02, inv: 0, ltDebt: 0.7, goods: 0, g: 0.11, covid: 0, kalk: 0.1, suf: ['energia', 'solar', 'power'], pat: ['{S} Energia', 'PV {S} {n}', '{W}', 'Farma Wiatrowa {S} {n}'], drivers: ['ceny energii na rynku', 'pełny rok pracy instalacji'], risks: ['ceny energii', 'ograniczenia przesyłowe operatora'] },
  { pkd: '25.62.Z', name: 'Obróbka mechaniczna elementów metalowych', short: 'Obróbka metali', w: 7, margin: [0.06, 0.04], turn: 1.3, fixed: 0.48, wnip: 0.01, ltInv: 0.01, inv: 0.25, ltDebt: 0.3, goods: 0.05, g: 0.06, covid: -0.06, kalk: 0.35, suf: ['stal', 'met', 'tech'], pat: ['{W}', 'Zakład Mechaniczny {S}', '{S} CNC', '{W} Obróbka Metali'], drivers: ['zamówienia z branży motoryzacyjnej', 'nowe centrum obróbcze CNC'], risks: ['ceny stali', 'zależność od eksportu do Niemiec'] },
  { pkd: '70.22.Z', name: 'Pozostałe doradztwo w zakresie prowadzenia działalności gospodarczej i zarządzania', short: 'Doradztwo', w: 8, margin: [0.12, 0.09], turn: 1.8, fixed: 0.12, wnip: 0.05, ltInv: 0.1, inv: 0, ltDebt: 0.05, goods: 0.01, g: 0.07, covid: -0.04, kalk: 0.2, suf: ['consult', 'fin', 'pro'], pat: ['{S} Consulting', '{S} Doradztwo', '{S} Advisory', '{W}'], drivers: ['projekty doradcze dla średnich firm', 'stali klienci na abonamencie'], risks: ['zależność od kluczowych osób', 'sezonowość projektów'] },
  { pkd: '47.91.Z', name: 'Sprzedaż detaliczna prowadzona przez domy sprzedaży wysyłkowej lub Internet', short: 'E-commerce', w: 7, margin: [0.03, 0.045], turn: 2.6, fixed: 0.1, wnip: 0.2, ltInv: 0.02, inv: 0.45, ltDebt: 0.08, goods: 0.62, g: 0.15, covid: 0.28, kalk: 0.45, suf: ['shop', 'store', 'box'], pat: ['{S} Store', 'Sklep {S}', '{W}', '{S} E-commerce'], drivers: ['sprzedaż przez marketplace', 'nowy magazyn i szybsza wysyłka'], risks: ['koszty reklamy online', 'zwroty towarów'] },
  { pkd: '56.10.A', name: 'Restauracje i inne stałe placówki gastronomiczne', short: 'Gastronomia', w: 6, margin: [0.03, 0.05], turn: 2.2, fixed: 0.45, wnip: 0.01, ltInv: 0.01, inv: 0.06, ltDebt: 0.25, goods: 0.04, g: 0.07, covid: -0.36, kalk: 0.1, suf: ['smak', 'food'], pat: ['Bistro {S}', '{S} Restauracje', 'Gospoda {S}', '{S} Food'], drivers: ['nowy lokal', 'catering firmowy'], risks: ['czynsze w centrach miast', 'ceny surowców'] },
  { pkd: '73.11.Z', name: 'Działalność agencji reklamowych', short: 'Reklama', w: 6, margin: [0.06, 0.06], turn: 2, fixed: 0.1, wnip: 0.08, ltInv: 0.02, inv: 0.01, ltDebt: 0.05, goods: 0.02, g: 0.06, covid: -0.12, kalk: 0.3, suf: ['media', 'art', 'ad'], pat: ['Agencja {S}', '{S} Media', '{S} Studio', '{W}'], drivers: ['kampanie dla nowych klientów', 'produkcja wideo'], risks: ['cięcia budżetów marketingowych', 'rotacja klientów'] },
  { pkd: '64.20.Z', name: 'Działalność holdingów finansowych', short: 'Holdingi', w: 1, margin: [0.3, 0.2], turn: 0.1, fixed: 0.92, wnip: 0, ltInv: 0.95, inv: 0, ltDebt: 0.2, goods: 0, g: 0.06, covid: 0, kalk: 0.2, suf: ['invest', 'capital'], pat: ['{S} Holding', '{W}', '{S} Capital'], drivers: ['dywidendy od spółek zależnych', 'opłaty za usługi zarządcze'], risks: ['wyniki spółek zależnych'] },
];
const SECTOR = Object.fromEntries(SECTORS.map(s => [s.pkd, s]));

const PKD_EXTRA = {
  '10.72.Z': 'Produkcja sucharów i herbatników', '47.24.Z': 'Sprzedaż detaliczna pieczywa, ciast, wyrobów ciastkarskich i cukierniczych', '56.10.B': 'Ruchome placówki gastronomiczne',
  '46.36.Z': 'Sprzedaż hurtowa cukru, czekolady, wyrobów cukierniczych i piekarskich', '62.02.Z': 'Działalność związana z doradztwem w zakresie informatyki',
  '62.03.Z': 'Działalność związana z zarządzaniem urządzeniami informatycznymi', '63.11.Z': 'Przetwarzanie danych; zarządzanie stronami internetowymi (hosting)',
  '58.29.Z': 'Działalność wydawnicza w zakresie pozostałego oprogramowania', '43.21.Z': 'Wykonywanie instalacji elektrycznych', '43.99.Z': 'Pozostałe specjalistyczne roboty budowlane',
  '71.11.Z': 'Działalność w zakresie architektury', '68.10.Z': 'Kupno i sprzedaż nieruchomości na własny rachunek', '46.19.Z': 'Działalność agentów zajmujących się sprzedażą towarów różnego rodzaju',
  '52.10.B': 'Magazynowanie i przechowywanie pozostałych towarów', '52.29.C': 'Działalność pozostałych agencji transportowych', '77.12.Z': 'Wynajem i dzierżawa pozostałych pojazdów samochodowych',
  '82.99.Z': 'Pozostała działalność wspomagająca prowadzenie działalności gospodarczej', '85.59.B': 'Pozostałe pozaszkolne formy edukacji',
  '86.21.Z': 'Praktyka lekarska ogólna', '86.90.E': 'Pozostała działalność w zakresie opieki zdrowotnej', '35.14.Z': 'Handel energią elektryczną',
  '33.12.Z': 'Naprawa i konserwacja maszyn', '28.41.Z': 'Produkcja maszyn do obróbki metalu', '74.90.Z': 'Pozostała działalność profesjonalna, naukowa i techniczna',
  '47.19.Z': 'Pozostała sprzedaż detaliczna prowadzona w niewyspecjalizowanych sklepach', '56.21.Z': 'Przygotowywanie i dostarczanie żywności dla odbiorców zewnętrznych (catering)',
  '73.12.C': 'Pośrednictwo w sprzedaży miejsca na cele reklamowe w mediach elektronicznych', '59.11.Z': 'Działalność związana z produkcją filmów, nagrań wideo i programów telewizyjnych',
  '64.99.Z': 'Pozostała finansowa działalność usługowa', '70.10.Z': 'Działalność firm centralnych (head offices) i holdingów',
};
const PKD_NAME = code => (SECTOR[code] && SECTOR[code].name) || PKD_EXTRA[code] || code;

const STEMS_W = ['Ark', 'Belt', 'Cedr', 'Dąbr', 'Elv', 'Ferr', 'Gran', 'Hydr', 'Iskr', 'Jant', 'Kalin', 'Lum', 'Mors', 'Narw', 'Orl', 'Prym', 'Ryd', 'Sol', 'Tarn', 'Ulm', 'Wisł', 'Zorz', 'Bor', 'Krest', 'Lin', 'Mar', 'Nid', 'Opal', 'Past', 'Rub', 'Sat', 'Wid', 'Zefir', 'Brzez', 'Grab', 'Jodł', 'Kalm', 'Lesz', 'Olch', 'Tomb'];
const STEMS_S = ['Jantar', 'Zorza', 'Kalina', 'Orlik', 'Narew', 'Iskra', 'Opal', 'Wrzos', 'Modrzew', 'Bursztyn', 'Lumen', 'Mewa', 'Żuraw', 'Brzask', 'Klon', 'Jodła', 'Ruta', 'Wiklina', 'Malwa', 'Sasanka', 'Wilga', 'Kruk', 'Szczygieł', 'Rozstaje', 'Przylądek', 'Kotwica', 'Latarnia', 'Dolina', 'Zbocze', 'Polana', 'Halny', 'Bryza', 'Grot', 'Sekstant'];

const FORMS = {
  'sp. z o.o.': 'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
  'S.A.': 'SPÓŁKA AKCYJNA',
  'P.S.A.': 'PROSTA SPÓŁKA AKCYJNA',
};

const SIZES = [['mikro', 42, 0.25e6, 2.5e6], ['mała', 38, 2.5e6, 40e6], ['średnia', 15, 40e6, 220e6], ['duża', 5, 220e6, 1.6e9]];

// ---------- people, the way the open API returns them ----------
function maskedPerson(d) {
  const imie = d.pick([...'AAABJJKKKMMMMPPTTWWZEŁDR']) + '*'.repeat(d.int(3, 8));
  const nazwisko = d.pick([...'BCDGJKKKLMMNPRSSSWWZŁ']) + '*'.repeat(d.int(4, 10));
  return { imie, nazwisko, full: `${imie} ${nazwisko}` };
}

// ---------- hero companies: the stories the demo leads with ----------
// revM: revenue in mln zł from the first fiscal year in the data; m: net margin; type/variant/unit/cf: from-year maps.
const HEROES = [
  {
    krs: '0009412708', name: 'Piekarnia Złoty Kłos', form: 'sp. z o.o.', pkd: '10.71.Z', city: 'Nowy Sącz', street: 'Kasztanowa 14', founded: [2009, 3, 12], capital: 150000,
    revM: [9.6, 10.27, 10.89, 11.11, 12.11, 14.05, 15.59, 16.68, 17.68], m: [0.045, 0.05, 0.048, 0.041, 0.052, 0.038, 0.046, 0.055, 0.058],
    eq0: 3.1e6, type: 'Mala', variant: 'por', unit: 'zl', cf: false, payout: 0.5, debt: 0.42, sig: 'enveloped',
    board: ['PREZES ZARZĄDU', 'CZŁONEK ZARZĄDU'], repr: 0, owners: [{ share: 0.5 }, { share: 0.3 }, { share: 0.2 }],
    pkdExtra: ['10.72.Z', '47.24.Z', '56.10.B', '46.36.Z'], reportsActivity: true,
  },
  {
    krs: '0009305114', name: 'Wektor Soft', form: 'S.A.', pkd: '62.01.Z', city: 'Wrocław', street: 'Graniczna 7', founded: [2012, 5, 21], capital: 1250000,
    revM: [6.2, 8.12, 10.4, 14.77, 19.94, 25.72, 30.35, 36.72, 42.96], m: [0.08, 0.09, 0.11, 0.14, 0.12, 0.1, 0.09, 0.105, 0.112],
    eq0: 2.9e6, type: { 2017: 'Mala', 2021: 'Inna' }, variant: { 2017: 'por', 2021: 'kalk' }, unit: { 2017: 'zl', 2023: 'tys' }, cf: { 2017: false, 2021: true },
    payout: { 2017: 0, 2021: 0.4 }, debt: 0.38, audited: true, korekta: 2023, sig: { 2017: 'enveloped', 2023: 'enveloping' },
    board: ['PREZES ZARZĄDU', 'WICEPREZES ZARZĄDU', 'CZŁONEK ZARZĄDU'], rn: 3, repr: 1, prokura: 1, owners: [{ krs: '0009100447', share: 1, sole: true }],
    pkdExtra: ['62.02.Z', '62.03.Z', '63.11.Z', '58.29.Z'], reportsActivity: true,
  },
  {
    krs: '0009100447', name: 'Arkon Holding', form: 'sp. z o.o.', pkd: '64.20.Z', city: 'Kraków', street: 'Spokojna 2', founded: [2015, 10, 1], capital: 50000,
    revM: [0.82, 0.9, 1.05, 1.1, 1.3, 1.45, 1.6, 1.85, 2.2], m: [0.06, 0.07, 0.05, 0.06, 0.07, 0.06, 0.05, 0.06, 0.07],
    finInc: { 2022: 0.95e6, 2023: 1.03e6, 2024: 1.09e6, 2025: 1.54e6 }, eq0: 4.2e6, type: 'Mala', variant: 'por', unit: 'zl', cf: false, payout: 0.8, debt: 0.12,
    nc: { 2017: 4.1e6, 2018: 4.15e6, 2019: 4.2e6, 2020: 4.2e6, 2021: 4.25e6, 2022: 4.9e6, 2023: 5.2e6, 2024: 5.45e6, 2025: 5.9e6 },
    board: ['PREZES ZARZĄDU'], repr: 0, owners: [{ share: 0.6 }, { share: 0.4 }], pkdExtra: ['70.10.Z', '64.99.Z', '70.22.Z'],
  },
  {
    krs: '0009518630', name: 'Mostbud Radomka', form: 'sp. z o.o.', pkd: '41.20.Z', city: 'Radom', street: 'Hutnicza 31', founded: [2004, 8, 2], capital: 500000,
    revM: [38, 42.56, 46.39, 44.53, 47.2, 57.12, 58.83, 45.89, 28.45], m: [0.031, 0.034, 0.028, 0.018, 0.022, 0.012, -0.041, -0.118, -0.24],
    eq0: 5.5e6, type: 'Inna', variant: 'por', unit: 'zl', cf: true, audited: true, payout: 0, debt: 0.62, distress: true,
    opinions: { 2024: 'zastrz', 2025: 'kontyn' }, dates: { 2025: { approved: [2026, 6, 29], filed: [2026, 7, 14] } },
    status: 'restrukturyzacja', dz4: [[2026, 5, 19, 'ZAKŁAD UBEZPIECZEŃ SPOŁECZNYCH']], dz6: { restr: [2026, 9, 18] },
    board: ['PREZES ZARZĄDU', 'CZŁONEK ZARZĄDU'], repr: 2, prokura: 1, owners: [{ share: 0.55 }, { share: 0.45 }], pkdExtra: ['43.21.Z', '43.99.Z', '71.11.Z', '68.10.Z'], reportsActivity: true,
  },
  {
    krs: '0009233871', name: 'Hurtownia Kanon', form: 'sp. z o.o.', pkd: '46.90.Z', city: 'Łódź', street: 'Magazynowa 9', founded: [1998, 11, 5], capital: 200000,
    revM: [21, 20.16, 18.75, 16.5, 15.68, 15.99, 13.59, 10.6], m: [0.012, 0.008, 0.004, -0.01, 0.003, 0.002, -0.025, -0.06],
    eq0: 2.4e6, type: 'Mala', variant: 'por', unit: 'zl', cf: false, payout: 0, debt: 0.55, distress: true, late: true,
    status: 'likwidacja', dz6: { likw: [2026, 3, 2] }, board: ['PREZES ZARZĄDU'], repr: 0, owners: [{ share: 1 }], pkdExtra: ['46.19.Z', '52.10.B', '47.19.Z'],
  },
  {
    krs: '0009771205', name: 'Ulmo Consulting', form: 'sp. z o.o.', pkd: '70.22.Z', city: 'Gdynia', street: 'Topolowa 5', founded: [2019, 4, 10], capital: 5000,
    revM: [0.21, 0.48, 0.62, 0.81, 0.74, 0.93, 1.08], m: [0.05, 0.18, 0.22, 0.25, 0.16, 0.21, 0.24],
    type: 'Mikro', unit: 'zl', cf: false, payout: 0.7, debt: 0.2, lateFiled: true, dates: { 2025: { approved: -34, filed: -9, wzmianka: -1 } },
    board: ['PREZES ZARZĄDU'], repr: 0, owners: [{ share: 1 }], pkdExtra: ['82.99.Z', '85.59.B', '74.90.Z'],
  },
  {
    krs: '0009305982', name: 'Wektor Cloud', form: 'sp. z o.o.', pkd: '62.01.Z', city: 'Wrocław', street: 'Graniczna 7', founded: [2020, 2, 14], capital: 100000,
    revM: [1.1, 2.9, 4.6, 6.4, 8.1, 9.8], m: [-0.06, 0.04, 0.09, 0.11, 0.12, 0.13],
    type: 'Mala', variant: 'kalk', unit: 'zl', cf: true, payout: 0, debt: 0.3, board: ['PREZES ZARZĄDU', 'CZŁONEK ZARZĄDU'], repr: 1,
    owners: [{ krs: '0009305114', share: 1, sole: true }], pkdExtra: ['63.11.Z', '62.03.Z'],
  },
  {
    krs: '0009306004', name: 'Wektor Labs', form: 'sp. z o.o.', pkd: '62.01.Z', city: 'Wrocław', street: 'Graniczna 7', founded: [2022, 9, 1], capital: 50000,
    revM: [0.08, 0.9, 1.7, 2.6], m: [-1.2, -0.35, 0.02, 0.07],
    type: { 2022: 'Mikro', 2024: 'Mala' }, variant: 'por', unit: 'zl', cf: false, payout: 0, debt: 0.25, board: ['PREZES ZARZĄDU'], repr: 0,
    owners: [{ krs: '0009305114', share: 0.7 }, { share: 0.3 }], pkdExtra: ['72.19.Z', '62.02.Z'],
  },
  {
    krs: '0009660412', name: 'PV Słoneczne Pole 4', form: 'sp. z o.o.', pkd: '35.11.Z', city: 'Lublin', street: 'Polna 112', founded: [2019, 6, 3], capital: 5000,
    revM: [0, 0, 0.62, 1.54, 1.21, 0.98, 1.02], m: [0, 0, 0.35, 0.52, 0.31, 0.22, 0.24], net: { 2019: -18e3, 2020: -61e3 },
    nc: { 2019: 1.2e6, 2020: 5.4e6, 2021: 5.3e6, 2022: 5.15e6, 2023: 4.95e6, 2024: 4.75e6, 2025: 4.6e6 },
    type: 'Mala', variant: 'por', unit: 'zl', cf: false, payout: 0, debt: 0.78, board: ['PREZES ZARZĄDU'], repr: 0,
    owners: [{ krs: '0009100447', share: 1, sole: true }], pkdExtra: ['35.14.Z', '33.12.Z'],
  },
];
PKD_EXTRA['72.19.Z'] = 'Badania naukowe i prace rozwojowe w dziedzinie pozostałych nauk przyrodniczych i technicznych';
const HERO_KRS = HEROES.map(h => h.krs);

// from-year maps: { 2017: 'Mala', 2021: 'Inna' } → value for fy; plain values pass through
function stepVal(spec, fy, dflt) {
  if (spec == null) return dflt;
  if (typeof spec !== 'object') return spec;
  let v = dflt;
  for (const k of Object.keys(spec).map(Number).sort((a, b) => a - b)) if (fy >= k) v = spec[k];
  return v;
}

const fmtNip = n => `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8)}`;

// ---------- the company list ----------
const COMPANIES = [];
const BY_KRS = new Map();

(function buildDb() {
  const d = dice(mulberry32(SEED));
  const usedNames = new Set(HEROES.map(h => h.name));
  const usedKrs = new Set(HERO_KRS);

  HEROES.forEach((h, i) => {
    const place = PLACES.find(p => p[1] === h.city);
    const founded = ymd(...h.founded);
    add({
      krs: h.krs, name: h.name, form: h.form, sector: SECTOR[h.pkd], place, street: h.street, founded, capital: h.capital,
      nip: '000' + String(4100000 + i * 13).padStart(7, '0'), regon: '000' + String(910000 + i * 7), size: null,
      status: h.status || 'aktywna', late: !!h.late, lateFiled: !!h.lateFiled, distress: !!h.distress,
      seed: hashStr(h.krs), hero: h, rev0: (h.revM[0] || 0.1) * 1e6,
    });
  });

  for (let i = 0; COMPANIES.length < DB_SIZE; i++) {
    const krs = '0009' + String((i * 7919 + 100003) % 900000 + 100000);
    if (usedKrs.has(krs)) continue;
    usedKrs.add(krs);
    const sector = d.weighted(SECTORS.map(s => [s, s.w]));
    const form = d.weighted([['sp. z o.o.', 88], ['S.A.', 8], ['P.S.A.', 4]]);
    const size = d.weighted(SIZES.map(s => [s, s[1] * (form === 'S.A.' && s[0] === 'mikro' ? 0.1 : 1)]));
    const yr = form === 'P.S.A.' ? d.int(2021, LAST_FY) : d.weighted(Array.from({ length: LAST_FY - 1994 + 1 }, (_, k) => [1994 + k, 1 + k * 0.12]));
    const founded = new Date(yr, d.int(0, 11), d.int(1, 28));
    if (form === 'P.S.A.' && founded < ymd(2021, 7, 1)) founded.setFullYear(2021, 7 + d.int(0, 4), 1);
    let name = null;
    for (let t = 0; t < 30 && !name; t++) {
      const n = d.pick(sector.pat)
        .replace('{W}', d.pick(STEMS_W) + 'o' + d.pick(sector.suf))
        .replace('{S}', d.pick(STEMS_S))
        .replace('{n}', d.int(1, 9));
      if (!usedNames.has(n)) name = n;
    }
    if (!name) continue;
    usedNames.add(name);
    const status = d.weighted([['aktywna', 955], ['likwidacja', 25], ['upadłość', 10], ['restrukturyzacja', 10]]);
    const distress = status !== 'aktywna' || d.chance(0.06);
    const late = status === 'likwidacja' || status === 'upadłość' ? d.chance(0.75) : d.chance(0.07);
    const revNow = Math.exp(Math.log(size[2]) + d.f() * (Math.log(size[3]) - Math.log(size[2])));
    const startFY = Math.max(FIRST_FY, yr);
    add({
      krs, name, form, sector, place: d.pick(PLACES), street: `${d.pick(STREETS)} ${d.int(1, 140)}${d.chance(0.15) ? d.pick(['A', 'B', 'C']) : ''}`, founded,
      capital: form === 'S.A.' ? d.pick([100000, 500000, 1000000, 2500000, 5000000, 12000000]) : form === 'P.S.A.' ? d.pick([1, 1000, 10000]) : d.pick([5000, 5000, 5000, 10000, 50000, 100000, 200000, 500000, 1000000]),
      nip: '000' + String((i * 7349 + 1234567) % 9000000 + 1000000), regon: '000' + String((i * 6173 + 271828) % 900000 + 100000),
      size: size[0], status, late, lateFiled: !late && status === 'aktywna' && d.chance(0.06), distress,
      seed: SEED ^ hashStr(krs), hero: null,
      rev0: revNow / Math.pow(1 + sector.g, LAST_FY - startFY),
    });
  }

  function add(c) {
    c.fullName = `${c.name} ${c.form}${c.status === 'likwidacja' ? ' w likwidacji' : ''}`;
    c.krsName = upperPl(`${c.name} ${FORMS[c.form]}${c.status === 'likwidacja' ? ' W LIKWIDACJI' : ''}`);
    c.slug = slug(c.name);
    c.woj = c.place[0];
    c.city = c.place[1];
    c.zip = `${c.place[2]}-${String(100 + (hashStr(c.krs) % 899)).padStart(3, '0')}`;
    c.nipF = fmtNip(c.nip);
    c.searchKey = slug(c.fullName).replace(/-/g, ' ');
    COMPANIES.push(c);
    BY_KRS.set(c.krs, c);
  }
})();

// ---------- financial statements ----------
// Every fiscal year gets a full set of canonical codes in zł, built so that the totals always tie:
// aktywa = pasywa, A − B = C, EBIT − finanse = brutto, brutto − podatek = netto, przepływy = zmiana gotówki.
const FIN_CACHE = new Map();
function fin(c) {
  let f = FIN_CACHE.get(c.krs);
  if (!f) FIN_CACHE.set(c.krs, f = buildFin(c));
  return f;
}

function buildFin(c) {
  const d = dice(mulberry32(c.seed ^ 0x5bd1e995));
  const s = c.sector, h = c.hero || {};
  const foundFY = c.founded.getFullYear();
  const startFY = Math.max(FIRST_FY, foundFY);
  const endFY = c.late ? LAST_FY - 1 : LAST_FY;
  const turn = s.turn * Math.exp(d.norm(0, h.krs ? 0 : 0.22));
  const debtShare = h.debt != null ? h.debt : clamp(d.norm(c.distress ? 0.74 : 0.5, 0.14), 0.15, 0.92);
  const fixedShare = clamp(s.fixed + d.norm(0, h.krs ? 0 : 0.06), 0.03, 0.97);
  const marginBias = d.norm(0, s.margin[1] * 0.6), growthBias = d.norm(0, 0.04);
  const wageShare = 0.22 + d.f() * 0.14, matShare = 0.12 + d.f() * 0.14, servShare = 0.12 + d.f() * 0.12;
  const optMikro = d.chance(0.7), optMala = d.chance(0.75), cfMala = d.chance(0.3), tysPref = d.chance(0.55), kalk = d.chance(s.kalk);
  const payer = d.chance(0.45), payoutR = 0.3 + d.f() * 0.6;
  const K = c.capital;
  const korektaFY = h.korekta || (d.chance(0.06) && endFY > startFY + 1 ? d.int(Math.max(2018, startFY + 1), endFY) : null);
  const sigMode = d.chance(0.6) ? 'enveloped' : 'enveloping';

  let rev = c.rev0, equity = null, prev = null, prevType = null;
  const y = {}, list = [];
  for (let fy = startFY; fy <= endFY; fy++) {
    const k = fy - startFY;
    // revenue
    let R;
    if (h.revM && h.revM[k] != null) R = Math.round(h.revM[k] * 1e6);
    else {
      if (k > 0) {
        let g = s.g + growthBias + d.norm(0, 0.07);
        if (fy === 2020) g += s.covid;
        if (fy === 2021) g -= s.covid * 0.5;
        if (fy === 2022) g += 0.09;
        if (c.distress && fy >= LAST_FY - 2) g -= 0.12 + d.f() * 0.2;
        rev *= 1 + clamp(g, -0.6, 1.2);
      }
      const partial = fy === foundFY ? (12 - c.founded.getMonth()) / 12 : 1;
      R = Math.round(rev * partial);
    }
    // net result
    let m;
    if (h.m && h.m[k] != null) m = h.m[k];
    else {
      m = s.margin[0] + marginBias + d.norm(0, s.margin[1] * 0.45);
      if (fy === 2020) m += s.covid * 0.12;
      if (fy === foundFY) m -= 0.04;
      if (c.distress && fy >= LAST_FY - 2) m = -Math.abs(m) * 0.5 - 0.03 - d.f() * 0.07;
    }
    const finIncX = Math.round((h.finInc && h.finInc[fy]) || 0);
    const net = h.net && h.net[fy] != null ? h.net[fy] : Math.round(R * m + finIncX);

    // balance sheet
    const NC = Math.round(h.nc && h.nc[fy] != null ? h.nc[fy] : Math.max(R / turn * Math.exp(d.norm(0, h.krs ? 0.02 : 0.05)), K * 0.8, 20000));
    if (equity == null) equity = h.eq0 != null ? Math.round(h.eq0) : foundFY >= FIRST_FY ? K : Math.round(NC * clamp(d.norm(0.4, 0.14), 0.06, 0.85));
    const openEq = equity;
    const divPaid = prev ? prev.divDeclared : 0;
    equity = openEq + net - divPaid;
    let L = Math.round(NC * debtShare);
    let cash = equity + L - NC;
    const minCash = Math.round(Math.max(R * 0.015, 3000));
    if (cash < minCash) { L += minCash - cash; cash = minCash; }
    const A = NC + cash;

    const F = Math.round(NC * fixedShare);
    const wnip = Math.round(F * s.wnip), ltInv = Math.round(F * s.ltInv), rmkDl = Math.round(F * 0.015), nalDl = Math.round(F * 0.01);
    const rat = F - wnip - ltInv - rmkDl - nalDl;
    const C = NC - F;
    const zap = Math.round(C * s.inv), rmkKr = Math.round(C * 0.04);
    const nal = C - zap - rmkKr;
    const rez = Math.round(L * 0.04), zobDl = Math.round(L * s.ltDebt), rmkP = Math.round(L * 0.015);
    const zobKr = L - rez - zobDl - rmkP;
    const retained = equity - K - net;
    const zapas = retained >= 0 ? retained : 0, latUb = retained >= 0 ? 0 : retained;

    // profit and loss, worked back from the net result
    const cit = R > 9e6 ? 0.19 : 0.09;
    const tax = net > 0 ? Math.round((net - finIncX) / (1 - cit) * cit) : Math.round(R * 0.0004);
    const EBT = net + tax;
    const finExp = R > 0 ? Math.round(zobDl * 0.065 + zobKr * 0.008) : Math.round(Math.abs(net) * 0.2);
    const finInc = Math.round(cash * 0.018) + finIncX;
    const EBIT = EBT + finExp - finInc;
    let OOI = Math.round(R * 0.012 * d.f() + 500);
    const OOE = Math.round(R * 0.009 * d.f() + 300);
    let SALES = EBIT - OOI + OOE;
    if (R - SALES < R * 0.15) { const fix = Math.round(R * 0.15 - (R - SALES)) + 1000; OOI += fix; SALES -= fix; }
    const OPEX = R - SALES;
    const DA = Math.min(Math.round((rat + wnip) * 0.11), Math.round(OPEX * 0.4));

    // which statement this company filed for the year
    let type = stepVal(h.type, fy, null);
    if (!type) {
      if (c.form === 'S.A.') type = 'Inna';
      else if (prevType !== 'Inna' && prevType !== 'Mala' && optMikro && R <= 3e6 && A <= 1.5e6) type = 'Mikro';
      else if (prevType !== 'Inna' && optMala && R <= 51e6 && A <= 25.5e6) type = 'Mala';
      else type = 'Inna';
    }
    prevType = type;
    const variant = type === 'Mikro' ? 'mikro' : stepVal(h.variant, fy, kalk ? 'kalk' : 'por');
    const unit = stepVal(h.unit, fy, type === 'Inna' && R > 60e6 && tysPref ? 'tys' : 'zl');
    const hasCf = type === 'Inna' ? stepVal(h.cf, fy, true) : type === 'Mala' ? stepVal(h.cf, fy, cfMala) : false;
    const audited = c.form === 'S.A.' || stepVal(h.audited, fy, false) || (A > 10.7e6 && R > 21.4e6);

    const v = {
      'BS.A': F, 'BS.A.I': wnip, 'BS.A.II': rat, 'BS.A.III': nalDl, 'BS.A.IV': ltInv, 'BS.A.V': rmkDl,
      'BS.B': C + cash, 'BS.B.I': zap, 'BS.B.II': nal, 'BS.B.III': cash, 'BS.B.III.CASH': cash, 'BS.B.IV': rmkKr,
      'BS.C': 0, 'BS.D': 0, 'BS.TOT': A,
      'BS.P.A': equity, 'BS.P.A.I': K, 'BS.P.A.II': zapas, 'BS.P.A.V': latUb, 'BS.P.A.VI': net,
      'BS.P.B': L, 'BS.P.B.I': rez, 'BS.P.B.II': zobDl, 'BS.P.B.III': zobKr, 'BS.P.B.IV': rmkP, 'BS.P.TOT': A,
      'PL.REV': R, 'PL.OPEX': OPEX, 'PL.SALES': SALES, 'PL.OOI': OOI, 'PL.OOE': OOE, 'PL.EBIT': EBIT,
      'PL.FININC': finInc, 'PL.FINEXP': finExp, 'PL.EBT': EBT, 'PL.TAX': tax, 'PL.NET': net,
    };
    if (variant === 'por') {
      const goods = Math.round(Math.max(0, OPEX - DA) * s.goods), rest = OPEX - goods - DA;
      const wage = Math.round(rest * wageShare), soc = Math.round(wage * 0.19), mat = Math.round(rest * matShare), serv = Math.round(rest * servShare), taxes = Math.round(rest * 0.02);
      Object.assign(v, { 'PL.OPEX.DA': DA, 'PL.OPEX.MAT': mat, 'PL.OPEX.SERV': serv, 'PL.OPEX.TAXES': taxes, 'PL.OPEX.WAGE': wage, 'PL.OPEX.SOC': soc, 'PL.OPEX.OTH': rest - wage - soc - mat - serv - taxes, 'PL.OPEX.GOODS': goods });
    } else if (variant === 'kalk') {
      const cogs = Math.round(OPEX * 0.8), sell = Math.round(OPEX * 0.08);
      Object.assign(v, { 'PL.COGS': cogs, 'PL.GROSS': R - cogs, 'PL.SELL': sell, 'PL.ADMIN': OPEX - cogs - sell });
    }
    const cashOpen = prev ? prev.cash : Math.round(cash * 0.6);
    if (hasCf) {
      const dWC = prev ? -((zap - prev.raw.zap) + (nal - prev.raw.nal)) + Math.round((zobKr - prev.raw.zobKr) * 0.6) : 0;
      const CFO = Math.round(net + DA + dWC);
      const capex = prev ? Math.max(0, F - prev.raw.F + DA) : Math.round(DA * 1.2);
      const CFI = -Math.round(capex * 0.92);
      const dCash = cash - cashOpen;
      Object.assign(v, { 'CF.OP.NET': net, 'CF.OP.ADJ': CFO - net, 'CF.OP': CFO, 'CF.OP.DA': DA, 'CF.INV': CFI, 'CF.FIN': dCash - CFO - CFI, 'CF.FIN.DIV': -divPaid, 'CF.NET': dCash, 'CF.CASH.BEG': cashOpen, 'CF.CASH.END': cash });
    }
    if (type === 'Inna') Object.assign(v, { 'EQ.OPEN': openEq, 'EQ.CLOSE': equity });
    // the small-entity balance sheet stops at "inwestycje krótkoterminowe", without the cash line
    if (type === 'Mala') delete v['BS.B.III.CASH'];
    if (type === 'Mikro') {
      // the micro schema folds finance into "pozostałe przychody/koszty" and has no EBIT line
      const keep = ['BS.A', 'BS.B', 'BS.B.I', 'BS.B.II', 'BS.B.III', 'BS.TOT', 'BS.P.A', 'BS.P.A.I', 'BS.P.B', 'BS.P.TOT', 'PL.REV', 'PL.OPEX', 'PL.TAX', 'PL.NET'];
      const mv = {};
      for (const code of keep) mv[code] = v[code];
      mv['PL.OOI'] = OOI + finInc;
      mv['PL.OOE'] = OOE + finExp;
      for (const code of Object.keys(v)) delete v[code];
      Object.assign(v, mv);
    }

    // payout decided by the shareholders' resolution the next year
    const payout = stepVal(h.payout, fy, payer ? payoutR : 0);
    let divDeclared = net > 0 ? Math.round(net * payout / 100) * 100 : 0;
    if (equity - divDeclared < K) divDeclared = Math.max(0, Math.floor((equity - K) / 100) * 100);

    // filing timeline
    const dd = h.dates && h.dates[fy];
    const rel = x => x == null ? null : typeof x === 'number' ? addDays(TODAY, x) : ymd(...x);
    let approved, filed, wzmianka;
    if (dd) { approved = rel(dd.approved); filed = rel(dd.filed); wzmianka = dd.wzmianka != null ? rel(dd.wzmianka) : addDays(filed, d.int(8, 30)); }
    else if (fy === LAST_FY && c.lateFiled) {
      approved = addDays(TODAY, -d.int(25, 70)); filed = addDays(approved, d.int(3, 14));
      if (filed >= TODAY) filed = addDays(TODAY, -d.int(1, 5));
      wzmianka = addDays(filed, d.int(2, 24));
    } else {
      approved = new Date(fy + 1, d.weighted([[2, 1], [3, 3], [4, 6], [5, 16]]), d.int(1, 28));
      filed = addDays(approved, d.int(2, 14));
      wzmianka = addDays(filed, d.int(6, 26) + (filed.getMonth() === 6 ? d.int(4, 28) : 0));
    }
    if (wzmianka >= TODAY) wzmianka = null;

    const yr = {
      fy, type, variant, unit, cf: hasCf, audited, v, divDeclared, divPaid,
      approved, filed, wzmianka, late: filed > DEADLINE(fy), cash, raw: { zap, nal, zobKr, F },
      sig: stepVal(h.sig, fy, sigMode),
      opinion: audited ? opinionFor(h, c, fy) : null,
      src: fy === 2017 ? { fy: 2018, field: 'KwotaB' } : { fy, field: 'KwotaA' },
    };
    if (fy === korektaFY) {
      // the first filing had a mistake; the correction replaced it a few months later
      yr.korekta = addDays(filed, d.int(40, 110));
      if (yr.korekta >= TODAY) yr.korekta = addDays(TODAY, -3);
      // revenue booked a year too early: the overstatement runs through profit, equity and receivables
      const dd = Math.round(R * (0.01 + d.f() * 0.02));
      yr.orig = {};
      for (const [code, sg] of [['PL.REV', 1], ['PL.SALES', 1], ['PL.GROSS', 1], ['PL.EBIT', 1], ['PL.EBT', 1], ['PL.NET', 1], ['BS.P.A.VI', 1], ['BS.P.A', 1], ['BS.P.TOT', 1], ['BS.B.II', 1], ['BS.B', 1], ['BS.TOT', 1], ['CF.OP.NET', 1], ['CF.OP.ADJ', -1], ['EQ.CLOSE', 1]])
        if (v[code] != null) yr.orig[code] = v[code] + sg * dd;
    }
    y[fy] = yr;
    list.push(fy);
    prev = yr;
  }
  // FY2017 values come from the 2018 file's KwotaB (the 2017 statement itself is a PDF scan); drop them if there is no 2018 file
  if (y[2017] && !y[2018]) { delete y[2017]; list.shift(); }
  return { y, list, startFY, endFY, korektaFY };
}

function opinionFor(h, c, fy) {
  const o = h.opinions && h.opinions[fy];
  if (o) return o;
  if (c.distress && fy >= LAST_FY - 1) return (hashStr(c.krs + fy) % 3) ? 'zastrz' : 'kontyn';
  return 'czysta';
}
const OPINION = {
  czysta: 'bez zastrzeżeń',
  zastrz: 'z zastrzeżeniem',
  kontyn: 'z objaśnieniem: istotna niepewność co do kontynuacji działalności',
};

// ---------- the ~15 metrics the materialized table keeps per company and year ----------
const MET_CACHE = new Map();
function metrics(c) {
  let m = MET_CACHE.get(c.krs);
  if (m) return m;
  const f = fin(c);
  m = {};
  for (const fy of f.list) {
    const v = f.y[fy].v, p = f.y[fy - 1] && f.y[fy - 1].v;
    const ebit = v['PL.EBIT'] != null ? v['PL.EBIT'] : v['PL.REV'] - v['PL.OPEX'];
    const da = v['PL.OPEX.DA'] != null ? v['PL.OPEX.DA'] : v['CF.OP.DA'];
    const cash = v['BS.B.III.CASH'] != null ? v['BS.B.III.CASH'] : v['BS.B.III'];
    const curLiab = v['BS.P.B.III'];
    m[fy] = {
      rev: v['PL.REV'], net: v['PL.NET'], ebit, ebitEst: v['PL.EBIT'] == null, ebitda: da != null ? ebit + da : null,
      ebt: v['PL.EBT'] != null ? v['PL.EBT'] : v['PL.NET'] + v['PL.TAX'],
      assets: v['BS.TOT'], equity: v['BS.P.A'], liab: v['BS.P.B'], liabKr: curLiab != null ? curLiab : null, cash,
      cfo: v['CF.OP'] != null ? v['CF.OP'] : null,
      mNet: v['PL.REV'] ? v['PL.NET'] / v['PL.REV'] : null,
      mEbit: v['PL.REV'] ? ebit / v['PL.REV'] : null,
      roe: v['BS.P.A'] > 0 ? v['PL.NET'] / v['BS.P.A'] : null,
      debt: v['BS.TOT'] ? v['BS.P.B'] / v['BS.TOT'] : null,
      cur: curLiab ? v['BS.B'] / curLiab : null,
      growth: p && p['PL.REV'] ? v['PL.REV'] / p['PL.REV'] - 1 : null,
    };
  }
  MET_CACHE.set(c.krs, m);
  return m;
}

// ---------- KRS extract (odpis pełny), lazily per company ----------
const ODPIS_CACHE = new Map();
function odpis(c) {
  let o = ODPIS_CACHE.get(c.krs);
  if (o) return o;
  const d = dice(mulberry32(c.seed ^ 0x2545f491));
  const h = c.hero || {};
  const f = fin(c);
  const boardFns = h.board || (c.form === 'S.A.' ? ['PREZES ZARZĄDU', ...Array(d.int(1, 3)).fill(0).map((_, i) => i ? 'CZŁONEK ZARZĄDU' : 'WICEPREZES ZARZĄDU')] : d.chance(0.55) ? ['PREZES ZARZĄDU'] : ['PREZES ZARZĄDU', ...Array(d.int(1, 2)).fill('CZŁONEK ZARZĄDU')]);
  const board = boardFns.map(fn => ({ ...maskedPerson(d), fn }));
  const repr = h.repr != null ? h.repr : board.length === 1 ? 0 : d.pick([0, 1, 2]);
  const REPR = [
    'KAŻDY CZŁONEK ZARZĄDU JEST UPRAWNIONY DO SAMODZIELNEGO REPREZENTOWANIA SPÓŁKI.',
    'DO SKŁADANIA OŚWIADCZEŃ W IMIENIU SPÓŁKI WYMAGANE JEST WSPÓŁDZIAŁANIE DWÓCH CZŁONKÓW ZARZĄDU ALBO CZŁONKA ZARZĄDU ŁĄCZNIE Z PROKURENTEM.',
    'W PRZYPADKU ZARZĄDU JEDNOOSOBOWEGO SPÓŁKĘ REPREZENTUJE PREZES ZARZĄDU SAMODZIELNIE. W PRZYPADKU ZARZĄDU WIELOOSOBOWEGO WYMAGANE JEST WSPÓŁDZIAŁANIE DWÓCH CZŁONKÓW ZARZĄDU.',
  ];
  const nPro = h.prokura != null ? h.prokura : d.chance(0.25) ? 1 : 0;
  const prokura = Array.from({ length: nPro }, () => ({ ...maskedPerson(d), kind: d.pick(['PROKURA SAMOISTNA', 'PROKURA ŁĄCZNA']) }));
  const rn = c.form === 'S.A.' ? Array.from({ length: h.rn || d.int(3, 5) }, (_, i) => ({ ...maskedPerson(d), fn: i ? 'CZŁONEK RADY NADZORCZEJ' : 'PRZEWODNICZĄCY RADY NADZORCZEJ' })) : [];

  // shareholders: sp. z o.o. lists them all; S.A. and P.S.A. only a sole shareholder
  let owners = [];
  if (h.owners) owners = h.owners.map(w => w.krs ? { krs: w.krs, share: w.share, sole: w.sole } : { ...maskedPerson(d), share: w.share });
  else if (c.form === 'sp. z o.o.') {
    const n = d.weighted([[1, 4], [2, 4], [3, 2], [4, 1]]);
    let left = 1;
    for (let i = 0; i < n; i++) { const sh = i === n - 1 ? left : Math.round(left * (0.35 + d.f() * 0.4) * 20) / 20; left = Math.round((left - sh) * 100) / 100; owners.push({ ...maskedPerson(d), share: sh }); }
  }
  const unitVal = c.capital >= 100000 ? 500 : 50;
  owners.forEach(w => { w.udzialy = Math.round(c.capital * w.share / unitVal); w.wartosc = w.udzialy * unitVal; });

  const pkdOther = h.pkdExtra || Object.keys(PKD_EXTRA).filter(() => d.chance(0.12)).slice(0, 6);

  // dział 3: one wzmianka per filed year, with the document dates
  const wzmianki = f.list.filter(fy => f.y[fy].wzmianka || fy === 2017).map(fy => {
    const yr = f.y[fy];
    const wz = yr.wzmianka || addDays(new Date(2018, 6, 1), d.int(0, 40));
    return { fy, wzmianka: wz, filed: yr.filed, docs: ['sprawozdanie', 'uchwała', ...(yr.audited ? ['badanie'] : []), ...(yr.type === 'Inna' || h.reportsActivity ? ['działalność'] : [])] };
  });

  // dział 4 and 6
  const dz4 = (h.dz4 || (c.distress && d.chance(0.5) ? [[TODAY.getFullYear(), d.int(1, Math.max(1, TODAY.getMonth())), d.int(1, 28), d.pick(['ZAKŁAD UBEZPIECZEŃ SPOŁECZNYCH', 'NACZELNIK URZĘDU SKARBOWEGO'])]] : []))
    .map(([yy, mm, dd, organ]) => ({ date: ymd(yy, mm, dd), organ }));
  const dz6 = {};
  const st = h.dz6 || {};
  if (c.status === 'likwidacja') dz6.likw = { date: st.likw ? ymd(...st.likw) : addDays(TODAY, -d.int(40, 400)), likwidator: maskedPerson(d) };
  if (c.status === 'upadłość') dz6.upad = { date: addDays(TODAY, -d.int(30, 300)), syndyk: maskedPerson(d), sygn: `${c.place[3]}1G/GUp/${d.int(10, 480)}/${String(TODAY.getFullYear()).slice(2)}` };
  if (c.status === 'restrukturyzacja') dz6.restr = { date: st.restr ? ymd(...st.restr) : addDays(TODAY, -d.int(20, 200)), kind: 'POSTĘPOWANIE O ZATWIERDZENIE UKŁADU', nadzorca: maskedPerson(d) };

  // entry history: registration, a few changes, plus whatever the recent events say
  const sygnPfx = `${c.place[3]}.${d.pick(['VII', 'VIII', 'XI', 'XII', 'XX', 'XXI'])} NS-REJ.KRS`;
  const wpisy = [{ date: c.founded, opis: 'WPIS DO REJESTRU' }];
  const span = (TODAY - c.founded) / DAY;
  const nChanges = clamp(Math.round(span / 520), 1, 9);
  for (let i = 0; i < nChanges; i++) wpisy.push({ date: addDays(c.founded, Math.round(span * (i + 1) / (nChanges + 1)) + d.int(-30, 30)), opis: d.pick(['ZMIANA SKŁADU ZARZĄDU', 'ZMIANA ADRESU SIEDZIBY', 'ZMIANA UMOWY SPÓŁKI', 'ZMIANA PRZEDMIOTU DZIAŁALNOŚCI', 'ZMIANA WSPÓLNIKÓW', 'PODWYŻSZENIE KAPITAŁU ZAKŁADOWEGO']) });
  for (const e of eventsOf(c)) wpisy.push({ date: e.date, opis: upperPl(e.title) });
  if (dz6.likw) wpisy.push({ date: dz6.likw.date, opis: 'OTWARCIE LIKWIDACJI' });
  if (dz6.restr) wpisy.push({ date: dz6.restr.date, opis: 'WZMIANKA O OTWARCIU POSTĘPOWANIA RESTRUKTURYZACYJNEGO' });
  wpisy.sort((a, b) => a.date - b.date);
  wpisy.forEach((w, i) => { w.nr = i + 1; w.sygn = `${sygnPfx}/${String(10000 + (hashStr(c.krs + i) % 89999)).padStart(6, '0')}/${String(w.date.getFullYear()).slice(2)}/${d.int(100, 999)}`; });

  o = {
    board, repr: REPR[repr], prokura, rn, owners, pkdOther, wzmianki, dz4, dz6, wpisy,
    fetched: addDays(YESTERDAY, 0.25 + (hashStr(c.krs) % 40) / 1440),
    vat: c.status === 'upadłość' ? 'Wykreślony' : c.sector.pkd === '86.22.Z' ? 'Zwolniony' : 'Czynny',
    accounts: d.int(1, 4),
  };
  ODPIS_CACHE.set(c.krs, o);
  return o;
}

// ---------- recent KRS changes (what the daily bulletin reported) ----------
const EVENTS = [];
(function buildEvents() {
  const d = dice(mulberry32(SEED ^ 0x7f4a7c15));
  const TYPES = [
    ['zarzad', 2, 'Zmiana w składzie zarządu', 30], ['prokura', 2, 'Udzielenie prokury', 8], ['adres', 1, 'Zmiana adresu siedziby', 14],
    ['kapital', 1, 'Podwyższenie kapitału zakładowego', 8], ['pkd', 3, 'Zmiana przedmiotu działalności (PKD)', 10], ['umowa', 1, 'Zmiana umowy spółki', 10],
  ];
  const add = (c, date, t) => EVENTS.push({ krs: c.krs, date, type: t[0], dzial: t[1], title: t[2] });
  for (const c of COMPANIES) {
    const f = fin(c);
    // a late statement that just reached the register
    const last = f.y[LAST_FY];
    if (last && last.wzmianka && last.wzmianka >= addDays(TODAY, -45)) EVENTS.push({ krs: c.krs, date: last.wzmianka, type: 'wzmianka', dzial: 3, title: `Wzmianka o złożeniu rocznego sprawozdania finansowego za ${LAST_FY}` });
    if (c.hero) continue;
    if (d.chance(0.1)) add(c, addDays(TODAY, -d.int(1, 45)), d.weighted(TYPES.map(t => [t, t[3]])));
  }
  // make sure yesterday's bulletin has a decent sample
  for (let i = 0; i < 16; i++) {
    const c = COMPANIES[HEROES.length + d.int(0, COMPANIES.length - HEROES.length - 1)];
    if (EVENTS.some(e => e.krs === c.krs && +e.date === +YESTERDAY)) continue;
    add(c, YESTERDAY, d.weighted(TYPES.map(t => [t, t[3]])));
  }
  const mb = BY_KRS.get('0009518630');
  EVENTS.push({ krs: mb.krs, date: YESTERDAY, type: 'zaleglosc', dzial: 4, title: 'Wpis o zaległości wobec ZUS (aktualizacja)' });
  EVENTS.push({ krs: '0009305114', date: addDays(TODAY, -6), type: 'zarzad', dzial: 2, title: 'Zmiana w składzie zarządu' });
  EVENTS.sort((a, b) => b.date - a.date);
})();
function eventsOf(c) { return EVENTS.filter(e => e.krs === c.krs); }

// ---------- RDF documents (metadata the new RDF browser returns), lazily ----------
const DOCS_CACHE = new Map();
function documents(c) {
  let docs = DOCS_CACHE.get(c.krs);
  if (docs) return docs;
  const d = dice(mulberry32(c.seed ^ 0x1b873593));
  const f = fin(c), h = c.hero || {};
  docs = [];
  const id = (fy, n) => `${c.krs.slice(-5)}-${String(fy).slice(2)}-${n}`;
  const kb = (a, b) => d.int(a, b) * 1024;
  const fys = f.y[2017] ? [2017, ...f.list.filter(x => x > 2017)] : f.list;
  for (const fy of fys) {
    const y = f.y[fy];
    const base = { fy, from: `${fy}-01-01`, to: `${fy}-12-31`, filed: y.filed };
    if (fy === 2017) docs.push({ ...base, id: id(fy, 1), kind: 'sf', name: 'Roczne sprawozdanie finansowe', file: 'sprawozdanie_finansowe_2017.pdf', format: 'PDF', size: kb(900, 4200), pipe: 'ocr' });
    else {
      const file = y.sig === 'enveloping' ? `SprFin_${fy}.xml.xades` : `SprFin_${fy}.xml`;
      if (y.korekta) {
        docs.push({ ...base, id: id(fy, 1), kind: 'sf', name: 'Roczne sprawozdanie finansowe', file, format: 'XML', size: kb(40, 160), pipe: 'replaced' });
        docs.push({ ...base, filed: y.korekta, id: id(fy, 7), kind: 'sf', name: 'Roczne sprawozdanie finansowe (korekta)', file: file.replace('SprFin_', 'SprFin_korekta_'), format: 'XML', size: kb(40, 160), pipe: 'xml', korekta: true });
      } else docs.push({ ...base, id: id(fy, 1), kind: 'sf', name: 'Roczne sprawozdanie finansowe', file, format: 'XML', size: kb(40, 160), pipe: 'xml' });
    }
    docs.push({ ...base, id: id(fy, 2), kind: 'uz', name: 'Uchwała o zatwierdzeniu rocznego sprawozdania finansowego', file: `uchwala_zatwierdzenie_${fy}.pdf`, format: 'PDF', size: kb(80, 400), pipe: fy === 2017 ? 'skip' : 'text' });
    docs.push({ ...base, id: id(fy, 3), kind: 'up', name: y.v['PL.NET'] >= 0 ? 'Uchwała o podziale zysku' : 'Uchwała o pokryciu straty', file: `uchwala_${y.v['PL.NET'] >= 0 ? 'podzial_zysku' : 'pokrycie_straty'}_${fy}.pdf`, format: 'PDF', size: kb(70, 360), pipe: fy === 2017 ? 'skip' : 'llm' });
    if (y.audited) docs.push({ ...base, id: id(fy, 4), kind: 'bad', name: 'Sprawozdanie z badania (opinia biegłego rewidenta)', file: `sprawozdanie_z_badania_${fy}.pdf`, format: 'PDF', size: kb(300, 1400), pipe: fy === 2017 ? 'skip' : 'llm' });
    if (y.type === 'Inna' || h.reportsActivity) docs.push({ ...base, id: id(fy, 5), kind: 'dz', name: 'Sprawozdanie z działalności', file: `sprawozdanie_z_dzialalnosci_${fy}.pdf`, format: 'PDF', size: kb(250, 2600), pipe: fy === 2017 ? 'skip' : !c.hero && d.chance(0.12) ? 'ocr' : 'llm' });
  }
  docs.forEach(x => { x.sha = fakeSha(c.krs + x.id + x.file); });
  docs.sort((a, b) => b.fy - a.fy || a.id.localeCompare(b.id));
  DOCS_CACHE.set(c.krs, docs);
  return docs;
}

// ---------- risk signals ----------
const RISK_CACHE = new Map();
function risk(c) {
  let r = RISK_CACHE.get(c.krs);
  if (r) return r;
  const f = fin(c), o = odpis(c), m = metrics(c);
  const sig = [], ok = [];
  const add = (sev, src, title, detail, date) => sig.push({ sev, src, title, detail, date });
  if (o.dz6.upad) add('high', 'KRS · dział 6', 'Ogłoszona upadłość', `Postanowienie sądu, sygn. ${o.dz6.upad.sygn}; syndyk ${o.dz6.upad.syndyk.full}.`, o.dz6.upad.date);
  if (o.dz6.likw) add('high', 'KRS · dział 6', 'Spółka w likwidacji', `Otwarcie likwidacji wpisane do rejestru; likwidator ${o.dz6.likw.likwidator.full}.`, o.dz6.likw.date);
  if (o.dz6.restr) add('high', 'KRS · dział 6', 'Postępowanie restrukturyzacyjne', `${cap(o.dz6.restr.kind.toLowerCase())}; nadzorca układu ${o.dz6.restr.nadzorca.full}.`, o.dz6.restr.date);
  for (const z of o.dz4) add('high', 'KRS · dział 4', 'Zaległości wpisane do rejestru', `Organ: ${z.organ.toLowerCase()}.`, z.date);
  if (o.vat === 'Wykreślony') add('high', 'Biała lista VAT', 'Wykreślona z rejestru VAT', 'Status z wl-api.mf.gov.pl na dzień odświeżenia.', o.fetched);
  if (!f.y[LAST_FY]) add('mid', 'RDF', `Brak sprawozdania za ${LAST_FY}`, `Termin złożenia minął ${fmtDateShort(DEADLINE(LAST_FY))}. Sprawdzamy RDF co tydzień.`, DEADLINE(LAST_FY));
  else if (f.y[LAST_FY].late) add('low', 'RDF', `Sprawozdanie za ${LAST_FY} złożone po terminie`, `Złożone ${fmtDateShort(f.y[LAST_FY].filed)}, termin ${fmtDateShort(DEADLINE(LAST_FY))}.`, f.y[LAST_FY].filed);
  const lastFy = f.list[f.list.length - 1];
  if (lastFy) {
    const y = f.y[lastFy], mm = m[lastFy], v = y.v;
    if (v['BS.P.A'] < 0) add('high', `Sprawozdanie ${lastFy}`, 'Ujemny kapitał własny', `Kapitał własny ${fmtMoney(v['BS.P.A'])}: zobowiązania przewyższają majątek.`, y.filed);
    else if (v['BS.P.A.V'] != null) {
      const loss = -((v['BS.P.A.V'] || 0) + Math.min(0, v['PL.NET']));
      if (loss > (v['BS.P.A.II'] || 0) + c.capital / 2) add('mid', `Sprawozdanie ${lastFy}`, 'Strata przekracza próg z art. 233 KSH', 'Strata przewyższa sumę kapitału zapasowego i połowę kapitału zakładowego, więc wspólnicy muszą zdecydować o dalszym istnieniu spółki.', y.filed);
    }
    if (y.opinion === 'kontyn') add('high', `Badanie ${lastFy}`, 'Biegły wskazał niepewność co do kontynuacji działalności', 'Objaśnienie w sprawozdaniu z badania (streszczenie LLM z PDF).', y.filed);
    if (y.opinion === 'zastrz') add('mid', `Badanie ${lastFy}`, 'Opinia biegłego z zastrzeżeniem', 'Zastrzeżenie dotyczy wyceny należności (streszczenie LLM z PDF).', y.filed);
    if (mm.growth != null && mm.growth < -0.3) add('mid', `Sprawozdanie ${lastFy}`, `Przychody spadły o ${Math.round(-mm.growth * 100)}% r/r`, `${fmtMoney(m[lastFy - 1].rev)} → ${fmtMoney(mm.rev)}.`, y.filed);
    if (mm.net < 0 && m[lastFy - 1] && m[lastFy - 1].net < 0) add('mid', `Sprawozdania ${lastFy - 1}–${lastFy}`, 'Strata dwa lata z rzędu', `${fmtMoney(m[lastFy - 1].net)} i ${fmtMoney(mm.net)}.`, y.filed);
    if (mm.cur != null && mm.cur < 0.8 && v['BS.P.A'] >= 0) add('mid', `Sprawozdanie ${lastFy}`, 'Niska płynność bieżąca', `Aktywa obrotowe pokrywają ${fmtRatio(mm.cur)} zobowiązań krótkoterminowych.`, y.filed);
    if (mm.debt != null && mm.debt > 0.9 && v['BS.P.A'] >= 0) add('mid', `Sprawozdanie ${lastFy}`, 'Wysokie zadłużenie', `Zobowiązania to ${Math.round(mm.debt * 100)}% sumy bilansowej.`, y.filed);
    if (f.list.filter(fy => fy > 2017).every(fy => !f.y[fy].late) && f.y[LAST_FY]) ok.push('Wszystkie sprawozdania XML złożone w terminie');
    if (mm.net > 0 && (!m[lastFy - 1] || m[lastFy - 1].net > 0)) ok.push('Zysk netto w dwóch ostatnich latach');
    const divYears = f.list.filter(fy => f.y[fy].divDeclared > 0).length;
    if (divYears >= 3) ok.push(`Dywidenda wypłacana za ${divYears} ${plural(divYears, 'rok obrotowy', 'lata obrotowe', 'lat obrotowych')}`);
    if (y.opinion === 'czysta') ok.push(`Opinia biegłego za ${lastFy} bez zastrzeżeń`);
  }
  const W = { high: 30, mid: 12, low: 4 };
  const score = Math.min(100, sig.reduce((t, s) => t + W[s.sev], 0));
  const level = score >= 50 ? 'wysokie' : score >= 24 ? 'podwyższone' : score >= 8 ? 'umiarkowane' : 'niskie';
  const order = { high: 0, mid: 1, low: 2 };
  sig.sort((a, b) => order[a.sev] - order[b.sev]);
  r = { sig, ok, score, level };
  RISK_CACHE.set(c.krs, r);
  return r;
}

// ---------- shared number/date format (used by data and UI) ----------
const NF = new Intl.NumberFormat('pl-PL');
const num = n => NF.format(n);
function fmtMoney(v, opt = {}) {
  if (v == null) return '—';
  const a = Math.abs(v), sign = v < 0 ? '−' : '';
  if (opt.full) return sign + num(Math.round(a)) + ' zł';
  if (a >= 1e9) return sign + (a / 1e9).toLocaleString('pl-PL', { maximumFractionDigits: 2 }) + ' mld zł';
  if (a >= 1e6) return sign + (a / 1e6).toLocaleString('pl-PL', { maximumFractionDigits: a >= 1e8 ? 0 : 1 }) + ' mln zł';
  if (a >= 1e4 && !opt.full) return sign + Math.round(a / 1e3).toLocaleString('pl-PL') + ' tys. zł';
  return sign + num(Math.round(a)) + ' zł';
}
const fmtRatio = v => v == null ? '—' : v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v, d = 1) => v == null ? '—' : (v * 100).toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', '−') + '%';
const fmtDate = d => d ? d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
const fmtDateShort = d => d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}` : '—';
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
