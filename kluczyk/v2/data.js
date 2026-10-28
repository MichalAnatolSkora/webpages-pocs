// Kluczyk v2 — mock data: a Tesla-only fleet. Company, addresses, banks and prices are fictional;
// specs are rounded catalogue values. Photos are CC0 from Wikimedia Commons (see `photo` on each car).

const LOCATIONS = [
  { id: 'wro', name: 'Lotnisko Wrocław (WRO)', short: 'Lotnisko WRO', note: 'Hala przylotów, stanowisko 4 · czynne 24/7', fee: 0, h24: true },
  { id: 'pkp', name: 'Wrocław Główny', short: 'Wrocław Główny', note: 'Parking P2, poziom −1 · 7:00–21:00', fee: 0 },
  { id: 'ruska', name: 'Biuro Kluczyk, ul. Ruska 12', short: 'ul. Ruska 12', note: 'Brama obok kawiarni, podwórko · 7:00–21:00', fee: 0 },
  { id: 'door', name: 'Pod Twój adres we Wrocławiu', short: 'Dostawa pod adres', note: 'Przywieziemy auto naładowane do 90%, ±15 min od wybranej godziny', fee: 79 },
];

// Only for returns: one-way rentals end in another city.
const ONE_WAY = [
  { id: 'krk', name: 'Kraków — Dworzec Główny', short: 'Kraków', note: 'Parking Galerii, poziom −2', fee: 249 },
  { id: 'poz', name: 'Poznań — Ławica (POZ)', short: 'Poznań POZ', note: 'Parking P1, stanowiska partnerskie', fee: 199 },
  { id: 'waw', name: 'Warszawa — Chopin (WAW)', short: 'Warszawa WAW', note: 'Parking P4, poziom 0', fee: 299 },
];

const CATEGORIES = {
  all: 'Wszystkie',
  sedan: 'Sedany',
  suv: 'SUV',
  secret: 'Sekretny garaż',
};

const DRIVES = { rwd: 'Napęd na tył', awd: 'Dwa silniki, 4×4' };

// Average price per kWh (mix of fast DC and slower AC chargers), used by the trip calculator.
const KWH_PRICE = 1.95;

const commons = file => 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_'));

const CARS = [
  {
    id: 'm3', name: 'Tesla Model 3', trim: 'RWD', cat: 'sedan', drive: 'rwd',
    seats: 5, trunk: 594, range: 520, accel: 6.1, cons: 13.2, price: 219, deposit: 2000, excess: 4000,
    tag: 'Pierwsza Tesla? Zacznij tu', pos: '55% 50%',
    blurb: 'Zamiast kluczyka masz telefon, zamiast stacji benzynowej — kawę przy ładowarce.',
    photo: { src: 'img/model-3-rwd.jpg', author: 'HJUdall', page: commons('24 Tesla Model 3 Base.jpg') },
  },
  {
    id: 'm3lr', name: 'Tesla Model 3', trim: 'Long Range AWD', cat: 'sedan', drive: 'awd',
    seats: 5, trunk: 594, range: 629, accel: 4.4, cons: 14, price: 259, deposit: 2500, excess: 5000,
    tag: 'Najdłuższy zasięg', pos: '45% 55%',
    blurb: 'Wrocław–Gdańsk na jednym ładowaniu, jeśli nie wieziesz w bagażniku kamieni.',
    photo: { src: 'img/model-3-lr.jpg', author: 'HJUdall', page: commons('24 Tesla Model 3 Long Range.jpg') },
  },
  {
    id: 'my', name: 'Tesla Model Y', trim: 'RWD', cat: 'suv', drive: 'rwd',
    seats: 5, trunk: 971, range: 500, accel: 6.9, cons: 14.5, price: 249, deposit: 2500, excess: 5000,
    pos: '40% 60%',
    blurb: 'Bagażnik z przodu i z tyłu: razem prawie tysiąc litrów. Wózek, walizki i pies bez Tetrisa.',
    photo: { src: 'img/model-y-rwd.jpg', author: 'JustAnotherCarDesigner', page: commons('Tesla Model Y facelift 001.jpg') },
  },
  {
    id: 'mylr', name: 'Tesla Model Y', trim: 'Long Range AWD', cat: 'suv', drive: 'awd',
    seats: 5, trunk: 971, range: 586, accel: 4.8, cons: 15.5, price: 289, deposit: 3000, excess: 6000,
    tag: 'Rodzinny wybór', pos: '50% 55%',
    blurb: 'Dwa silniki na zimowe Karkonosze i zasięg na cały długi weekend.',
    photo: { src: 'img/model-y-lr.jpg', author: 'HJUdall', page: commons('26 Tesla Model Y Long Range.jpg') },
  },
  {
    id: 'ms', name: 'Tesla Model S', trim: 'Plaid', cat: 'sedan', drive: 'awd',
    seats: 5, trunk: 793, range: 600, accel: 2.1, cons: 18, price: 549, deposit: 6000, excess: 10000,
    tag: '0–100 w 2,1 s', pos: '62% 45%',
    blurb: 'Trzy silniki, 1020 KM. Pasażerowie przestają rozmawiać mniej więcej w półtorej sekundy.',
    photo: { src: 'img/model-s-plaid.jpg', author: 'HJUdall', page: commons('22 Tesla Model S Plaid.jpg') },
  },
  {
    id: 'mx', name: 'Tesla Model X', trim: 'Plaid', cat: 'suv', drive: 'awd',
    seats: 7, trunk: 900, range: 543, accel: 2.6, cons: 20, price: 649, deposit: 6000, excess: 12000,
    tag: 'Drzwi do góry', pos: '50% 60%',
    blurb: 'Siedem miejsc i tylne drzwi „falcon”. Wszyscy chcą siedzieć z tyłu, żeby efektownie wysiadać.',
    photo: { src: 'img/model-x-plaid.jpg', author: 'HJUdall', page: commons('23 Tesla Model X Plaid.jpg') },
  },
  {
    id: 'cyber', name: 'Tesla Cybertruck', trim: 'Cyberbeast', cat: 'secret', drive: 'awd', secret: true,
    seats: 5, trunk: 1897, range: 515, accel: 2.7, cons: 26, price: 899, deposit: 8000, excess: 15000,
    tag: 'Tylko na zamknięty plac', pos: '55% 60%',
    blurb: 'Po drogach publicznych w UE jeszcze nie pojedzie, więc dowozimy go lawetą. Szyby lepiej zostaw w spokoju.',
    photo: { src: 'img/cybertruck.jpg', author: 'A1C6', page: commons('2024 Tesla Cybertruck, Moab 02.jpg') },
  },
  {
    id: 'roadster', name: 'Tesla Roadster', trim: '2008 · ze Starmanem', cat: 'secret', drive: 'rwd', secret: true, space: true,
    seats: 2, trunk: 170, range: 393, accel: 3.9, cons: 18, price: 2018, deposit: 0, excess: 0,
    tag: 'Na orbicie od 2018', pos: '50% 78%',
    blurb: 'Od lutego 2018 krąży wokół Słońca z kierowcą w skafandrze. Przejechał więcej niż cała reszta floty razem.',
    photo: { src: 'img/roadster.jpg', author: 'SpaceX', page: commons("Elon Musk's Tesla Roadster (40110304192).jpg") },
  },
];

// Preferred colour — saved as a wish, the photo stays as it is.
const COLORS = [
  { id: 'white', name: 'Perłowa biel', hex: '#eef0f2' },
  { id: 'graphite', name: 'Grafit', hex: '#55595f' },
  { id: 'silver', name: 'Srebro', hex: '#b9bdc2' },
  { id: 'navy', name: 'Głęboki granat', hex: '#1f3a6b' },
  { id: 'red', name: 'Czerwień', hex: '#a51c24' },
  { id: 'black', name: 'Czerń', hex: '#16171a' },
];

const INSURANCE = [
  {
    id: 'basic', name: 'Podstawowa', perDay: 0, excessFactor: 1, depositFactor: 1,
    covers: ['OC i AC', 'Assistance 24/7 w całej UE'],
  },
  {
    id: 'calm', name: 'Spokojna', perDay: 39, excessFactor: 0.4, depositFactor: 0.5, recommended: true,
    covers: ['OC i AC', 'Assistance 24/7 w całej UE', 'Szyby, szklany dach, lusterka'],
  },
  {
    id: 'zen', name: 'Bez nerwów', perDay: 79, excessFactor: 0, depositFixed: 500,
    covers: ['OC i AC', 'Assistance 24/7 w całej UE', 'Szyby, szklany dach, lusterka', 'Opony, felgi, podwozie', 'Zgubiona karta-klucz'],
  },
];

// per: 'day' (capped at `cap`) or 'once'. kind: 'count' gets a stepper, everything else a toggle.
// notFor lists car ids or categories, only limits an extra to some categories.
const EXTRAS = [
  { id: 'charge', name: 'Ładowanie bez rachunków', note: 'Prąd na szybkich ładowarkach w cenie, do 300 kWh na wynajem', per: 'once', price: 149 },
  { id: 'seat', name: 'Fotelik dziecięcy', note: '9–36 kg, ISOFIX, umyty i sprawdzony', per: 'day', price: 25, cap: 150, kind: 'count', max: 3, notFor: ['roadster'] },
  { id: 'booster', name: 'Podstawka', note: 'Dla dzieci od 15 kg', per: 'day', price: 10, cap: 60, kind: 'count', max: 3, notFor: ['roadster'] },
  { id: 'driver', name: 'Dodatkowy kierowca', note: 'Drugi telefon jako kluczyk, z osobnym profilem fotela', per: 'day', price: 19, cap: 120 },
  { id: 'abroad', name: 'Wyjazd za granicę (UE)', note: 'Zielona karta, upoważnienie i roaming danych w aucie', per: 'once', price: 99, notFor: ['secret'] },
  { id: 'chains', name: 'Łańcuchy śnieżne', note: 'W Alpach i Tatrach zimą bywają obowiązkowe', per: 'day', price: 15, cap: 90, notFor: ['secret'] },
  { id: 'box', name: 'Box dachowy 420 l', note: 'Narty, wózek, namiot — co się nie zmieściło', per: 'day', price: 35, cap: 210, notFor: ['secret'] },
  { id: 'bikes', name: 'Bagażnik na 2 rowery', note: 'Na hak, z oświetleniem', per: 'day', price: 30, cap: 180, only: ['suv'] },
  { id: 'camp', name: 'Materac do trybu kempingowego', note: 'Auto trzyma 20°C całą noc, a z tyłu śpią dwie osoby', per: 'day', price: 25, cap: 150, only: ['suv'] },
  { id: 'dog', name: 'Pakiet „Pies na pokładzie”', note: 'Mata, miska i sprzątanie. Tryb psa trzyma 21°C, gdy wyskoczysz na kawę', per: 'once', price: 69, notFor: ['roadster'] },
];

// Trips from Wrocław. km = one way, by road; at = [lon, lat] for the little map, dy nudges a crowded label.
const HOME_AT = [17.03, 51.11];
const DESTINATIONS = [
  { id: 'karpacz', name: 'Karpacz', km: 125, mountain: true, at: [15.76, 50.78], dy: 10 },
  { id: 'szklarska', name: 'Szklarska Poręba', km: 135, mountain: true, at: [15.52, 50.83], dy: -8 },
  { id: 'krakow', name: 'Kraków', km: 270, at: [19.94, 50.06] },
  { id: 'praga', name: 'Praga', km: 280, abroad: true, at: [14.42, 50.08] },
  { id: 'berlin', name: 'Berlin', km: 345, abroad: true, at: [13.4, 52.52] },
  { id: 'zakopane', name: 'Zakopane', km: 380, mountain: true, at: [19.95, 49.3] },
  { id: 'wieden', name: 'Wiedeń', km: 410, abroad: true, at: [16.37, 48.21] },
  { id: 'gdansk', name: 'Gdańsk', km: 475, at: [18.65, 54.35] },
];

const PROMOS = {
  KLUCZYK10: { pct: 10, label: 'KLUCZYK10 · −10%' },
  WEEKEND: { pct: 15, weekend: true, label: 'WEEKEND · −15% z sobotą w terminie' },
  PIERWSZA: { amount: 100, label: 'PIERWSZA · −100 zł za pierwszą Teslę' },
};

// Fictional banks for the "przelew online" mock.
const BANKS = [
  { id: 'krasnal', name: 'Bank Krasnala', mono: 'BK', color: '#c2410c' },
  { id: 'odra', name: 'Bank Odrzański', mono: 'BO', color: '#1d4ed8' },
  { id: 'most', name: 'Bank Mostowy', mono: 'BM', color: '#0f766e' },
  { id: 'piast', name: 'Piastowski Bank', mono: 'PB', color: '#7c3aed' },
  { id: 'nadodrze', name: 'Kasa Nadodrze', mono: 'KN', color: '#be123c' },
  { id: 'wyspa', name: 'Bank Wyspa', mono: 'BW', color: '#15803d' },
];

const TEST_CARDS = [
  { number: '4242 4242 4242 4242', result: 'płatność przechodzi' },
  { number: '5555 5555 5555 4444', result: 'płatność przechodzi (Mastercard)' },
  { number: '4000 0000 0000 3220', result: 'wymaga 3-D Secure (kod przyjdzie SMS-em)' },
  { number: '4000 0000 0000 0002', result: 'bank odrzuca transakcję' },
];

// Polish public holidays: fixed dates plus the Easter-based ones.
function holidaysFor(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  const plus = n => new Date(year, month - 1, day + n);
  const key = dt => `${dt.getMonth() + 1}-${dt.getDate()}`;
  return {
    '1-1': 'Nowy Rok', '1-6': 'Trzech Króli', '5-1': 'Święto Pracy', '5-3': 'Święto Konstytucji 3 Maja',
    '8-15': 'Wniebowzięcie NMP', '11-1': 'Wszystkich Świętych', '11-11': 'Święto Niepodległości',
    '12-24': 'Wigilia', '12-25': 'Boże Narodzenie', '12-26': 'Drugi dzień świąt',
    [key(easter)]: 'Wielkanoc', [key(plus(1))]: 'Poniedziałek Wielkanocny',
    [key(plus(49))]: 'Zielone Świątki', [key(plus(60))]: 'Boże Ciało',
  };
}
