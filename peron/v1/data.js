// Peron v1 — data: a seeded set of fictional public tenders. Deadlines are generated relative to today, so the board never goes stale.

const DAY = 864e5, HOUR = 36e5, MIN = 6e4;
const NOW0 = Date.now();
const TODAY0 = new Date(new Date(NOW0).setHours(0, 0, 0, 0)).getTime();

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const roundTo = (v, step) => Math.round(v / step) * step;

const WOJ = ['dolnośląskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'łódzkie', 'małopolskie', 'mazowieckie', 'opolskie',
  'podkarpackie', 'podlaskie', 'pomorskie', 'śląskie', 'świętokrzyskie', 'warmińsko-mazurskie', 'wielkopolskie', 'zachodniopomorskie'];

// [name, locative, województwo index] — invented towns
const TOWNS = [
  ['Lipowiec', 'Lipowcu', 5], ['Brzezinka Dolna', 'Brzezince Dolnej', 0], ['Zawadów Stary', 'Zawadowie Starym', 2], ['Stary Bór', 'Starym Borze', 9],
  ['Mokrzyca Wielka', 'Mokrzycy Wielkiej', 8], ['Kamionna Wola', 'Kamionnej Woli', 6], ['Osieczno Górne', 'Osiecznie Górnym', 14], ['Grabowiec Leśny', 'Grabowcu Leśnym', 1],
  ['Jodłowa Huta', 'Jodłowej Hucie', 12], ['Wrzosowo', 'Wrzosowie', 15], ['Przyłęk Mały', 'Przyłęku Małym', 11], ['Sosnowa Kępa', 'Sosnowej Kępie', 10],
  ['Bielinek', 'Bielinku', 3], ['Rudnik nad Strugą', 'Rudniku nad Strugą', 4], ['Kozłowice Nowe', 'Kozłowicach Nowych', 7], ['Miłków', 'Miłkowie', 13],
  ['Dąbrówka Szlachecka', 'Dąbrówce Szlacheckiej', 6], ['Olszyny Wielkie', 'Olszynach Wielkich', 5], ['Krzemienica', 'Krzemienicy', 8], ['Złotniki Kujawskie', 'Złotnikach Kujawskich', 1],
  ['Świerkowo', 'Świerkowie', 10], ['Gródek Nadrzeczny', 'Gródku Nadrzecznym', 2], ['Wysoka Strzyżowska', 'Wysokiej Strzyżowskiej', 8], ['Lubień Zamkowy', 'Lubieniu Zamkowym', 11],
  ['Czarny Las', 'Czarnym Lesie', 0], ['Białobrzegi Polne', 'Białobrzegach Polnych', 14], ['Kalinowo', 'Kalinowie', 9], ['Trzciana Dolna', 'Trzcianie Dolnej', 12],
];
const VILLAGES = ['Zalesie', 'Podgórze', 'Wólka', 'Nowa Wieś', 'Kolonia Dębina', 'Rososz', 'Budy', 'Łęg', 'Przymiarki', 'Zagrody', 'Piaski', 'Kąty', 'Olszynka', 'Borki'];
const STREETS = ['Polnej', 'Szkolnej', 'Kościelnej', 'Ogrodowej', 'Słonecznej', 'Leśnej', 'Kolejowej', 'Młyńskiej', 'Łąkowej', 'Spacerowej', 'Strażackiej', 'Zielonej'];
const ROMAN = ['I', 'II', 'III', 'IV'];

// peron = platform number of an industry group
const GROUPS = [
  { key: 'drogi', peron: 1, label: 'Drogi i mosty', short: 'DROGI' },
  { key: 'budynki', peron: 2, label: 'Budynki i termomodernizacja', short: 'BUDYNKI' },
  { key: 'wodkan', peron: 3, label: 'Wodociągi i kanalizacja', short: 'WOD-KAN' },
  { key: 'energia', peron: 4, label: 'Energia, paliwa, OZE', short: 'ENERGIA' },
  { key: 'it', peron: 5, label: 'IT: sprzęt i systemy', short: 'IT' },
  { key: 'medyczne', peron: 6, label: 'Leki i sprzęt medyczny', short: 'MEDYCZNE' },
  { key: 'odpady', peron: 7, label: 'Odpady, zieleń, sprzątanie', short: 'KOMUNALNE' },
  { key: 'transport', peron: 8, label: 'Transport i pojazdy', short: 'TRANSPORT' },
  { key: 'zywnosc', peron: 9, label: 'Żywność i posiłki', short: 'ŻYWNOŚĆ' },
  { key: 'projekty', peron: 10, label: 'Projekty i nadzór', short: 'PROJEKTY' },
  { key: 'ochrona', peron: 11, label: 'Ochrona i ubezpieczenia', short: 'OCHRONA' },
];
const GROUP = Object.fromEntries(GROUPS.map(g => [g.key, g]));
const KINDS = [['roboty', 'Roboty budowlane'], ['dostawy', 'Dostawy'], ['uslugi', 'Usługi']];
const KIND = Object.fromEntries(KINDS);

// title templates: [group, kind, title, cpv code, cpv label, min value, max value, lots [min,max] or 0, buyers allowed (regex on name)]
const MUNI = /^(Gmina|Miasto)/;
const TEMPLATES = [
  ['drogi', 'roboty', 'Przebudowa drogi gminnej nr {nr}{L} w miejscowości {v}', '45233140-2', 'Roboty drogowe', 4e5, 6e6, 0],
  ['drogi', 'roboty', 'Remont nawierzchni ul. {s} w {loc}', '45233142-6', 'Roboty w zakresie naprawy dróg', 2e5, 2.5e6, 0],
  ['drogi', 'roboty', 'Budowa chodnika wzdłuż drogi powiatowej nr {nr2}{L} na odcinku {v} – {v2}', '45233161-5', 'Roboty budowlane w zakresie chodników', 3e5, 3e6, 0],
  ['drogi', 'roboty', 'Rozbiórka i budowa mostu na rzece {r} w ciągu drogi powiatowej nr {nr2}{L}', '45221111-3', 'Roboty budowlane w zakresie mostów drogowych', 3e6, 3.2e7, 0],
  ['drogi', 'roboty', 'Remonty cząstkowe dróg gminnych w {Y} r. w podziale na części', '45233142-6', 'Roboty w zakresie naprawy dróg', 2e5, 1.2e6, [2, 4]],
  ['budynki', 'roboty', 'Termomodernizacja budynku Szkoły Podstawowej nr {n} w {loc}', '45321000-3', 'Izolacja cieplna', 8e5, 7e6, 0, /^(Gmina|Miasto|Zespół Szkół)/],
  ['budynki', 'roboty', 'Wymiana pokrycia dachowego budynku urzędu w {loc}', '45261210-9', 'Wykonywanie pokryć dachowych', 2e5, 1.5e6, 0, /^(Gmina|Miasto|Starostwo)/],
  ['budynki', 'roboty', 'Budowa sali gimnastycznej z zapleczem przy szkole w {v}', '45212222-8', 'Roboty budowlane w zakresie sal gimnastycznych', 3e6, 1.4e7, 0, /^(Gmina|Miasto|Starostwo|Zespół Szkół)/],
  ['budynki', 'roboty', 'Modernizacja kotłowni i wymiana instalacji c.o. w budynkach komunalnych', '45331000-6', 'Instalowanie urządzeń grzewczych, wentylacyjnych i klimatyzacyjnych', 3e5, 4e6, [2, 3], MUNI],
  ['budynki', 'roboty', 'Przebudowa budynku na potrzeby Centrum Opiekuńczo-Mieszkalnego w {loc}', '45000000-7', 'Roboty budowlane', 2e6, 2.6e7, 0, /^(Gmina|Miasto|Starostwo)/],
  ['budynki', 'roboty', 'Przebudowa oddziału {ward} wraz z instalacjami medycznymi', '45215140-0', 'Roboty budowlane w zakresie obiektów szpitalnych', 2e6, 3e7, 0, /Szpital/],
  ['wodkan', 'roboty', 'Budowa kanalizacji sanitarnej w miejscowości {v} – etap {rom}', '45232400-6', 'Roboty budowlane w zakresie kanałów ściekowych', 1.5e6, 2.8e7, 0],
  ['wodkan', 'roboty', 'Przebudowa stacji uzdatniania wody w {v}', '45252126-7', 'Konstruowanie stacji uzdatniania wody pitnej', 1e6, 9e6, 0],
  ['wodkan', 'roboty', 'Modernizacja oczyszczalni ścieków w {loc}', '45252100-9', 'Roboty budowlane w zakresie oczyszczalni ścieków', 4e6, 4.5e7, 0],
  ['wodkan', 'dostawy', 'Dostawa wodomierzy z nakładkami radiowymi', '38421100-3', 'Wodomierze', 1.5e5, 1.6e6, 0],
  ['energia', 'dostawy', 'Dostawa energii elektrycznej na rok {Y1} dla obiektów {buyerGen}', '09310000-5', 'Elektryczność', 4e5, 1.2e7, 0],
  ['energia', 'dostawy', 'Sukcesywna dostawa oleju napędowego i benzyny do pojazdów {buyerGen}', '09134200-9', 'Paliwo do silników diesla', 2e5, 3e6, [2, 2]],
  ['energia', 'roboty', 'Montaż instalacji fotowoltaicznych na budynkach użyteczności publicznej', '09332000-5', 'Instalacje słoneczne', 4e5, 6e6, [2, 5]],
  ['energia', 'dostawy', 'Dostawa paliwa gazowego w okresie {Y1}–{Y2}', '09123000-7', 'Gaz ziemny', 3e5, 8e6, 0],
  ['it', 'dostawy', 'Dostawa {n2} laptopów wraz z oprogramowaniem biurowym', '30213100-6', 'Komputery przenośne', 8e4, 1.2e6, 0],
  ['it', 'uslugi', 'Wdrożenie systemu elektronicznego zarządzania dokumentacją (EZD)', '72212000-4', 'Usługi programowania oprogramowania aplikacyjnego', 3e5, 3.5e6, 0],
  ['it', 'uslugi', 'Świadczenie usług wsparcia i rozwoju systemu dziedzinowego', '72267000-4', 'Usługi w zakresie konserwacji i napraw oprogramowania', 1.2e5, 1.8e6, 0],
  ['it', 'dostawy', 'Dostawa serwerów, macierzy i licencji wirtualizacji', '48820000-2', 'Serwery', 2e5, 4e6, [2, 3]],
  ['it', 'dostawy', 'Dostawa pomocy dydaktycznych i sprzętu do pracowni „{lab}”', '39162100-6', 'Pomoce dydaktyczne', 6e4, 9e5, [2, 6], /^(Gmina|Miasto|Zespół Szkół)/],
  ['medyczne', 'dostawy', 'Dostawa produktów leczniczych w podziale na {lots} części', '33600000-6', 'Produkty farmaceutyczne', 3e5, 1.4e7, [6, 14]],
  ['medyczne', 'dostawy', 'Dostawa aparatu USG z wyposażeniem', '33112200-0', 'Ultrasonografy', 2e5, 1.2e6, 0],
  ['medyczne', 'dostawy', 'Dostawa materiałów opatrunkowych i jednorazowego użytku', '33141000-0', 'Jednorazowe, niechemiczne artykuły medyczne', 1.5e5, 2.5e6, [4, 9]],
  ['medyczne', 'dostawy', 'Dostawa tomografu komputerowego wraz z adaptacją pomieszczenia', '33115000-9', 'Urządzenia do tomografii', 3e6, 1.1e7, 0],
  ['odpady', 'uslugi', 'Odbiór i zagospodarowanie odpadów komunalnych z nieruchomości zamieszkałych w gminie {town}', '90511000-2', 'Usługi wywozu odpadów', 1.2e6, 1.8e7, 0, MUNI],
  ['odpady', 'uslugi', 'Zimowe utrzymanie dróg w sezonie {Y0}/{Y1}', '90620000-9', 'Usługi odśnieżania', 1.5e5, 2.2e6, [2, 5], /^(Gmina|Miasto|Zarząd Dróg)/],
  ['odpady', 'uslugi', 'Sprzątanie pomieszczeń {buyerGen}', '90910000-9', 'Usługi sprzątania', 1e5, 1.6e6, 0],
  ['odpady', 'uslugi', 'Utrzymanie terenów zieleni w {loc}', '77310000-6', 'Usługi sadzenia roślin oraz utrzymania terenów zielonych', 1.2e5, 1.5e6, [2, 3], /^(Gmina|Miasto|Zakład Gospodarki)/],
  ['transport', 'uslugi', 'Dowóz uczniów do szkół w roku szkolnym {Y0}/{Y1}', '60130000-8', 'Usługi specjalnego transportu drogowego osób', 2e5, 2.4e6, [2, 4], MUNI],
  ['transport', 'dostawy', 'Dostawa {n3} autobusów elektrycznych wraz z ładowarkami', '34144910-0', 'Autobusy elektryczne', 6e6, 3.6e7, 0, /^(Miasto|Zarząd Transportu)/],
  ['transport', 'dostawy', 'Dostawa średniego samochodu ratowniczo-gaśniczego dla OSP w {v}', '34144210-3', 'Wozy strażackie', 7e5, 1.4e6, 0, MUNI],
  ['transport', 'uslugi', 'Serwis i naprawy pojazdów {buyerGen}', '50110000-9', 'Usługi w zakresie napraw i konserwacji pojazdów silnikowych', 1e5, 9e5, 0],
  ['zywnosc', 'dostawy', 'Dostawa artykułów żywnościowych dla {buyerGen} w podziale na {lots} części', '15000000-8', 'Żywność, napoje, tytoń i podobne produkty', 1e5, 2.5e6, [5, 12]],
  ['zywnosc', 'uslugi', 'Przygotowanie i dostawa posiłków dla uczniów szkół w {loc}', '55523100-3', 'Usługi w zakresie posiłków szkolnych', 2e5, 2.8e6, 0, /^(Gmina|Miasto|Zespół Szkół)/],
  ['projekty', 'uslugi', 'Opracowanie dokumentacji projektowej przebudowy ul. {s} w {loc}', '71320000-7', 'Usługi inżynieryjne w zakresie projektowania', 4e4, 6e5, 0],
  ['projekty', 'uslugi', 'Pełnienie funkcji inspektora nadzoru inwestorskiego nad zadaniem „{inv}”', '71247000-1', 'Nadzór nad robotami budowlanymi', 6e4, 9e5, 0],
  ['projekty', 'uslugi', 'Aktualizacja miejscowego planu zagospodarowania przestrzennego', '71410000-5', 'Usługi planowania urbanistycznego', 4e4, 4e5, 0, MUNI],
  ['ochrona', 'uslugi', 'Ochrona fizyczna osób i mienia w obiektach {buyerGen}', '79713000-5', 'Usługi strażnicze', 1.2e5, 2.2e6, 0],
  ['ochrona', 'uslugi', 'Ubezpieczenie mienia i odpowiedzialności cywilnej {buyerGen}', '66510000-8', 'Usługi ubezpieczeniowe', 8e4, 1.5e6, [2, 3]],
];

// buyer types: [name pattern, genitive pattern, groups they buy for]
const BUYER_TYPES = [
  ['Gmina {town}', 'Gminy {town}', ['drogi', 'budynki', 'wodkan', 'odpady', 'transport', 'energia', 'projekty', 'it', 'ochrona'], 6],
  ['Miasto {town}', 'Urzędu Miasta {town}', ['drogi', 'budynki', 'odpady', 'it', 'energia', 'projekty', 'ochrona', 'transport'], 3],
  ['Zarząd Dróg Powiatowych w {loc}', 'Zarządu Dróg Powiatowych', ['drogi', 'projekty', 'odpady'], 3],
  ['Szpital Powiatowy w {loc}', 'Szpitala Powiatowego', ['medyczne', 'zywnosc', 'it', 'energia', 'ochrona', 'odpady'], 3],
  ['Wojewódzki Szpital Specjalistyczny w {loc}', 'Wojewódzkiego Szpitala Specjalistycznego', ['medyczne', 'medyczne', 'it', 'zywnosc', 'budynki'], 2],
  ['Przedsiębiorstwo Wodociągów i Kanalizacji w {loc} sp. z o.o.', 'PWiK', ['wodkan', 'wodkan', 'energia', 'transport', 'projekty'], 2],
  ['Zakład Gospodarki Komunalnej w {loc}', 'Zakładu Gospodarki Komunalnej', ['odpady', 'transport', 'energia'], 2],
  ['Zespół Szkół nr {n} w {loc}', 'Zespołu Szkół', ['zywnosc', 'it', 'budynki'], 2],
  ['Starostwo Powiatowe w {loc}', 'Starostwa Powiatowego', ['budynki', 'it', 'ochrona', 'projekty', 'energia'], 2],
  ['Zarząd Transportu Miejskiego w {loc}', 'Zarządu Transportu Miejskiego', ['transport', 'transport', 'it', 'ochrona'], 1],
];
const RIVERS = ['Strudze', 'Mlecznej', 'Bystrzycy Małej', 'Wierzbiance', 'Czarnej Wodzie'];
const LABS = ['Laboratoria przyszłości', 'Aktywna tablica', 'Cyfrowa szkoła'];
const WARDS = ['chorób wewnętrznych', 'pediatrycznego', 'ratunkowego (SOR)', 'chirurgii ogólnej', 'rehabilitacji'];
const INVEST = ['Rozbudowa szkoły w Zalesiu', 'Budowa kanalizacji – etap II', 'Przebudowa rynku', 'Budowa żłobka'];

const REQS = {
  roboty: v => [
    `Doświadczenie: co najmniej ${v > 5e6 ? 2 : 1} robota o podobnym charakterze o wartości min. ${fmtMoneyShort(roundTo(v * 0.5, 1e5))} w ciągu ostatnich 5 lat`,
    'Kierownik budowy z uprawnieniami bez ograniczeń w odpowiedniej specjalności',
    `Ubezpieczenie OC na kwotę min. ${fmtMoneyShort(roundTo(v * 0.4, 1e5))}`,
  ],
  dostawy: v => [
    `Co najmniej 2 dostawy o podobnym charakterze o wartości min. ${fmtMoneyShort(roundTo(v * 0.3, 1e4))} w ciągu ostatnich 3 lat`,
    'Przedmiotowe środki dowodowe: karty katalogowe, deklaracje zgodności',
  ],
  uslugi: v => [
    `Co najmniej 1 usługa o podobnym charakterze o wartości min. ${fmtMoneyShort(roundTo(v * 0.3, 1e4))} wykonywana przez min. 6 miesięcy`,
    'Dysponowanie osobami o kwalifikacjach wskazanych w SWZ',
  ],
};
const CRIT2 = {
  roboty: [['Okres gwarancji', 40], ['Okres gwarancji', 30, 'Doświadczenie kierownika budowy', 10], ['Termin realizacji', 20, 'Okres gwarancji', 20]],
  dostawy: [['Termin dostawy', 40], ['Okres gwarancji', 40], ['Parametry techniczne', 30, 'Termin dostawy', 10]],
  uslugi: [['Czas reakcji', 40], ['Aspekty społeczne: zatrudnienie na umowę o pracę', 40], ['Doświadczenie personelu', 30, 'Czas reakcji', 10]],
};
const DOCS = {
  roboty: [['Przedmiar robót', 'pdf'], ['Dokumentacja projektowa', 'zip'], ['STWiOR', 'pdf']],
  dostawy: [['Opis przedmiotu zamówienia', 'pdf'], ['Formularz cenowy', 'xlsx']],
  uslugi: [['Opis przedmiotu zamówienia', 'pdf'], ['Wykaz obiektów', 'xlsx']],
};
const SCOPE = {
  drogi: ['roboty przygotowawcze i rozbiórkowe', 'wykonanie podbudowy i nawierzchni bitumicznej', 'odwodnienie i pobocza', 'oznakowanie pionowe i poziome'],
  budynki: ['roboty rozbiórkowe i ociepleniowe', 'wymianę stolarki okiennej i drzwiowej', 'instalacje wewnętrzne', 'zagospodarowanie terenu'],
  wodkan: ['sieć grawitacyjną i tłoczną', 'przepompownie ścieków', 'przyłącza do granicy działek', 'odtworzenie nawierzchni'],
  energia: ['dostawy w okresie obowiązywania umowy', 'bilansowanie handlowe', 'obsługę punktów poboru'],
  'energia:roboty': ['dostawę i montaż modułów, konstrukcji i falowników', 'zgłoszenie mikroinstalacji do OSD', 'rozruch, monitoring i szkolenie'],
  'wodkan:dostawy': ['dostawę wodomierzy i nakładek radiowych', 'integrację z systemem odczytów', 'gwarancję i wsparcie serwisowe'],
  'transport:uslugi': ['realizację usług według harmonogramu zamawiającego', 'pojazd lub serwis zastępczy w razie awarii', 'sprawozdawczość miesięczną'],
  it: ['dostawę i konfigurację', 'szkolenia dla użytkowników', 'gwarancję i wsparcie serwisowe'],
  medyczne: ['dostawy sukcesywne na podstawie zamówień częściowych', 'szkolenie personelu', 'serwis gwarancyjny'],
  odpady: ['odbiór odpadów według harmonogramu', 'transport do instalacji', 'raportowanie w BDO'],
  transport: ['dostawę i odbiór techniczny', 'szkolenie kierowców', 'serwis gwarancyjny'],
  zywnosc: ['dostawy sukcesywne do kuchni', 'zgodność z wymaganiami HACCP', 'transport w warunkach chłodniczych'],
  projekty: ['koncepcję i projekt budowlany', 'projekty wykonawcze i kosztorysy', 'uzyskanie decyzji administracyjnych'],
  ochrona: ['całodobową ochronę obiektów', 'monitoring i grupę interwencyjną', 'raporty miesięczne'],
};

function fmtMoneyShort(v) {
  if (v >= 1e6) return (v / 1e6).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + ' mln zł';
  if (v >= 1e3) return Math.round(v / 1e3).toLocaleString('pl-PL') + ' tys. zł';
  return Math.round(v) + ' zł';
}

function makeBuyers(r) {
  const out = [];
  TOWNS.forEach((t, i) => {
    const types = BUYER_TYPES.filter((_, j) => j < 2 || r() < 0.38);
    types.forEach(bt => {
      const n = int(r, 1, 6);
      const fill = s => s.replace('{town}', t[0]).replace('{loc}', t[1]).replace('{n}', n);
      out.push({ id: 'b' + out.length, name: fill(bt[0]), gen: fill(bt[1]), town: t[0], loc: t[1], woj: WOJ[t[2]], groups: bt[2], weight: bt[3] });
    });
  });
  return out;
}

// calendar arithmetic through Date, so adding days across a DST change keeps the wall-clock time
function atDay(ms, addDays, minutes = 0) { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays, 0, minutes).getTime(); }
function weekday(ms) {
  const d = new Date(ms).getDay();
  return d === 6 ? atDay(ms, 2) : d === 0 ? atDay(ms, 1) : atDay(ms, 0);
}

function makeTender(r, idx, buyers, opts = {}) {
  let buyer;
  const pool = [];
  buyers.forEach(b => { for (let i = 0; i < b.weight; i++) pool.push(b); });
  buyer = pick(r, pool);
  let g, fits;
  do { g = pick(r, buyer.groups); fits = TEMPLATES.filter(t => t[0] === g && (!t[8] || t[8].test(buyer.name))); } while (!fits.length);
  const tpl = pick(r, fits);
  const [, kind, titleT, cpvCode, cpvLabel, vmin, vmax, lotsR] = tpl;
  const value = roundTo(Math.exp(Math.log(vmin) + r() * (Math.log(vmax) - Math.log(vmin))), 1000);
  const lotsN = lotsR ? int(r, lotsR[0], lotsR[1]) : (r() < 0.08 ? 2 : 0);
  const Y = new Date(NOW0).getFullYear();
  const title = titleT
    .replace('{nr}', int(r, 100, 699)).replace('{nr2}', int(r, 1000, 3999)).replace('{L}', pick(r, ['K', 'R', 'W', 'K']))
    .replace('{v}', pick(r, VILLAGES)).replace('{v2}', pick(r, VILLAGES)).replace('{s}', pick(r, STREETS)).replace('{loc}', buyer.loc)
    .replace('{rom}', pick(r, ROMAN)).replace('{n}', int(r, 1, 5)).replace('{n2}', int(r, 2, 12) * 10).replace('{n3}', int(r, 2, 9))
    .replace('{town}', buyer.town).replace('{buyerGen}', buyer.gen).replace('{lots}', lotsN).replace('{lab}', pick(r, LABS))
    .replace('{inv}', pick(r, INVEST)).replace('{ward}', pick(r, WARDS)).replace('{r}', pick(r, RIVERS))
    .replace('{Y}', Y + 1).replace('{Y0}', Y).replace('{Y1}', Y + 1).replace('{Y2}', Y + 2);
  // EU thresholds, roughly: works ~24 mln zł, supplies and services of local buyers ~1 mln zł
  const ue = kind === 'roboty' ? value > 2.4e7 : value > 1e6;

  let published;
  if (opts.published) published = opts.published;
  else {
    const ago = Math.floor(Math.pow(r(), 1.6) * 26);
    published = Math.min(atDay(TODAY0, -ago, int(r, 8, 15) * 60 + int(r, 0, 59)), NOW0 - int(r, 5, 300) * MIN);
  }
  const dur = ue ? int(r, 30, 40) : int(r, 8, 30);
  const hour = pick(r, [9, 10, 10, 10, 11, 11, 12, 12, 13]) * 60 + pick(r, [0, 0, 0, 30, 15]);
  let dayMs = atDay(published, dur);
  if (dayMs + hour * MIN < NOW0 + 2 * HOUR) dayMs = atDay(TODAY0, int(r, 1, 30));
  let deadline = weekday(dayMs) + hour * MIN;
  // some deadlines get pushed back after questions about the SWZ — a "delay" on the board
  let moved = null;
  if (!opts.published && r() < 0.11 && NOW0 - published > 2 * DAY) {
    const by = int(r, 3, 10);
    moved = { from: deadline, at: published + HOUR + Math.floor(r() * (NOW0 - published - 2 * HOUR)) };
    deadline = weekday(atDay(deadline, by)) + hour * MIN;
  }
  const wadium = value > 1.3e5 && r() < (ue ? 0.95 : 0.6) ? roundTo(value * (0.01 + r() * 0.02), value > 2e6 ? 5000 : 1000) : 0;
  const c2 = pick(r, CRIT2[kind]);
  const criteria = [['Cena', 100 - c2.filter(x => typeof x === 'number').reduce((a, b) => a + b, 0)]];
  for (let i = 0; i < c2.length; i += 2) criteria.push([c2[i], c2[i + 1]]);
  const lots = [];
  if (lotsN) {
    let rest = value;
    for (let i = 0; i < lotsN; i++) {
      const v = i === lotsN - 1 ? rest : roundTo(rest * (0.15 + r() * 0.5) / Math.max(1, (lotsN - i) / 2), 1000);
      rest -= v;
      lots.push({ n: i + 1, name: lotName(g, i, r), value: Math.max(v, 5000) });
    }
  }
  const months = int(r, 3, 18);
  const no = ue
    ? `${Y}/S ${int(r, 180, 212)}-${String(int(r, 500000, 699999))}`
    : `${Y}/BZP ${String(int(r, 520000, 689999)).padStart(8, '0')}/01`;
  const docs = [['SWZ', 'pdf'], ['Formularz ofertowy', 'docx'], [ue ? 'JEDZ (ESPD)' : 'Oświadczenie z art. 125 ust. 1', ue ? 'xml' : 'docx'], ['Projektowane postanowienia umowy', 'pdf']]
    .concat(DOCS[kind]).map(([name, ext]) => ({ name, ext, kb: ext === 'zip' ? int(r, 18000, 240000) : int(r, 40, 2400) }));
  if (moved) docs.push({ name: 'Zmiana treści SWZ nr 1', ext: 'pdf', kb: int(r, 90, 400) });
  return {
    id: opts.id || 'p' + (1000 + idx), no, ue, title, buyer, group: g, kind, cpv: [cpvCode, cpvLabel], value, wadium,
    published, deadline, moved, criteria, lots, docs,
    questions: weekday(atDay(deadline, -4)) + 15 * HOUR,
    tryb: ue ? 'Przetarg nieograniczony' : pick(r, ['Tryb podstawowy bez negocjacji', 'Tryb podstawowy bez negocjacji', 'Tryb podstawowy z możliwością negocjacji']),
    period: r() < 0.5 ? `${months} mies. od zawarcia umowy` : `do ${new Date(deadline + months * 30 * DAY).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
    reqs: REQS[kind](value),
    scope: SCOPE[g + ':' + kind] || SCOPE[g],
    contact: `zamowienia@${buyer.town.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z]+/g, '-')}.example`,
  };
}

function lotName(g, i, r) {
  const names = {
    medyczne: ['Leki przeciwbakteryjne', 'Heparyny', 'Płyny infuzyjne', 'Leki onkologiczne', 'Szczepionki', 'Leki anestetyczne', 'Środki kontrastowe', 'Insuliny', 'Leki kardiologiczne', 'Antybiotyki iniekcyjne', 'Leki przeciwbólowe', 'Żywienie pozajelitowe', 'Leki psychiatryczne', 'Preparaty krwiopochodne'],
    zywnosc: ['Pieczywo', 'Mięso i wędliny', 'Drób', 'Nabiał', 'Warzywa i owoce', 'Mrożonki', 'Ryby', 'Jaja', 'Artykuły ogólnospożywcze', 'Soki', 'Ziemniaki', 'Przetwory'],
    drogi: ['Rejon północny', 'Rejon południowy', 'Rejon wschodni', 'Rejon zachodni'],
    odpady: ['Rejon I', 'Rejon II', 'Rejon III', 'Rejon IV', 'Rejon V'],
    transport: ['Trasa nr 1', 'Trasa nr 2', 'Trasa nr 3', 'Trasa nr 4'],
  };
  const a = names[g] || ['Część A', 'Część B', 'Część C', 'Część D', 'Część E', 'Część F', 'Część G', 'Część H', 'Część I'];
  return a[i % a.length];
}

const SEED = 20261029;
const BUYERS = makeBuyers(rng(SEED));
const TENDERS = (() => { const r = rng(SEED + 7); return Array.from({ length: 150 }, (_, i) => makeTender(r, i, BUYERS)); })();
