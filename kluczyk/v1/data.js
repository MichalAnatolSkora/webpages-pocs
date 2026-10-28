// Kluczyk — mock data. Company, addresses, banks and prices are fictional; car models are just examples
// ("lub podobny", like every rental company says).

const LOCATIONS = [
  { id: 'wro', name: 'Lotnisko Wrocław (WRO)', short: 'Lotnisko WRO', note: 'Hala przylotów, stanowisko 4 · czynne 24/7', fee: 0, h24: true },
  { id: 'pkp', name: 'Wrocław Główny', short: 'Wrocław Główny', note: 'Parking P2, poziom −1 · 7:00–21:00', fee: 0 },
  { id: 'ruska', name: 'Biuro Kluczyk, ul. Ruska 12', short: 'ul. Ruska 12', note: 'Brama obok kawiarni, podwórko · 7:00–21:00', fee: 0 },
  { id: 'door', name: 'Pod Twój adres we Wrocławiu', short: 'Dostawa pod adres', note: 'Przywieziemy auto ±15 min od wybranej godziny', fee: 79 },
];

// Only for returns: one-way rentals end in another city.
const ONE_WAY = [
  { id: 'krk', name: 'Kraków — Dworzec Główny', short: 'Kraków', note: 'Parking Galerii, poziom −2', fee: 249 },
  { id: 'poz', name: 'Poznań — Ławica (POZ)', short: 'Poznań POZ', note: 'Parking P1, stanowiska partnerskie', fee: 199 },
  { id: 'waw', name: 'Warszawa — Chopin (WAW)', short: 'Warszawa WAW', note: 'Parking P4, poziom 0', fee: 299 },
];

const CATEGORIES = {
  all: 'Wszystkie',
  city: 'Miejskie',
  wagon: 'Kombi',
  suv: 'SUV',
  ev: 'Elektryczne',
  van: 'Busy',
  cabrio: 'Kabriolety',
  secret: 'Sekretny garaż',
};

const FUELS = { petrol: 'Benzyna', diesel: 'Diesel', hybrid: 'Hybryda', ev: 'Elektryk' };

// Rough pump / charger prices, used by the trip calculator.
const ENERGY = { petrol: 6.29, diesel: 6.19, hybrid: 6.29, ev: 1.9 };

const CARS = [
  {
    id: 'yaris', name: 'Toyota Yaris Hybrid', cat: 'city', body: 'hatch', gearbox: 'auto', fuel: 'hybrid',
    seats: 5, bags: 2, price: 89, cons: 4.1, deposit: 1500, excess: 3000, color: '#e7e9ec',
    tag: 'Najczęściej wybierany', blurb: 'Do miasta i na weekend. W korku jedzie na prądzie i nic nie pali.',
  },
  {
    id: 'fabia', name: 'Škoda Fabia', cat: 'city', body: 'hatch', gearbox: 'manual', fuel: 'petrol',
    seats: 5, bags: 2, price: 79, cons: 5.6, deposit: 1500, excess: 3000, color: '#b8322a',
    blurb: 'Najtańszy sposób, żeby zniknąć z miasta na weekend.',
  },
  {
    id: '500e', name: 'Fiat 500e', cat: 'ev', body: 'mini', gearbox: 'auto', fuel: 'ev',
    seats: 4, bags: 1, price: 99, cons: 14, range: 320, deposit: 1500, excess: 3000, color: '#8fc7c1',
    blurb: 'Mieści się w każdą lukę na Nadodrzu. Ładowanie: 30 min przy kawie.',
  },
  {
    id: 'corolla', name: 'Toyota Corolla Touring Hybrid', cat: 'wagon', body: 'wagon', gearbox: 'auto', fuel: 'hybrid',
    seats: 5, bags: 4, price: 139, cons: 4.6, deposit: 2000, excess: 4000, color: '#3a4a63',
    blurb: 'Kombi, które pali jak miejskie. Wakacje dla czworga bez grania w Tetrisa.',
  },
  {
    id: 'octavia', name: 'Škoda Octavia Combi', cat: 'wagon', body: 'wagon', gearbox: 'manual', fuel: 'diesel',
    seats: 5, bags: 5, price: 149, cons: 5.0, deposit: 2000, excess: 4000, color: '#5b6168',
    blurb: 'Bagażnik 640 l. Na długie trasy, kiedy autostrada to plan na cały dzień.',
  },
  {
    id: 'rav4', name: 'Toyota RAV4 Hybrid AWD', cat: 'suv', body: 'suv', gearbox: 'auto', fuel: 'hybrid',
    seats: 5, bags: 4, price: 199, cons: 5.8, deposit: 3000, excess: 5000, color: '#2f5141',
    blurb: 'Napęd na cztery koła — na Karkonosze i parking pod Śnieżką w lutym.',
  },
  {
    id: 'ev6', name: 'Kia EV6', cat: 'ev', body: 'ev', gearbox: 'auto', fuel: 'ev',
    seats: 5, bags: 3, price: 229, cons: 17, range: 500, deposit: 3000, excess: 5000, color: '#9aa3ab',
    tag: 'Zasięg 500 km', blurb: '10→80% w 18 minut. Kawa na stacji wystygnie wolniej niż Ty się naładujesz.',
  },
  {
    id: 'transit', name: 'Ford Transit Custom 9-os.', cat: 'van', body: 'van', gearbox: 'manual', fuel: 'diesel',
    seats: 9, bags: 6, price: 299, cons: 8.5, deposit: 3000, excess: 6000, color: '#f2f2ef',
    blurb: 'Na wesele, turniej albo wyjazd całej ekipy. Prawo jazdy kat. B wystarczy.',
  },
  {
    id: 'mx5', name: 'Mazda MX-5', cat: 'cabrio', body: 'cabrio', gearbox: 'manual', fuel: 'petrol',
    seats: 2, bags: 1, price: 269, cons: 6.8, deposit: 3000, excess: 6000, color: '#c41e2a', seasonal: true,
    blurb: 'Dach w 3 sekundy. Bagaż: jeden plecak i dobry humor.',
  },
  {
    id: 'maluch', name: 'Fiat 126p „Maluch”', cat: 'secret', body: 'maluch', gearbox: 'manual', fuel: 'petrol',
    seats: 4, bags: 0, price: 26, cons: 6.5, deposit: 500, excess: 1000, color: '#e8b931', secret: true,
    tag: 'Kolekcjonerski', blurb: '0–100 km/h: kiedyś. Chłodzenie powietrzem, klimatyzacja: korbka od szyby.',
  },
];

const COLORS = [
  { id: 'white', name: 'Biel perłowa', hex: '#eef0f2' },
  { id: 'graphite', name: 'Grafit', hex: '#4a4f57' },
  { id: 'red', name: 'Czerwień', hex: '#bf2b2b' },
  { id: 'navy', name: 'Granat', hex: '#27375a' },
  { id: 'green', name: 'Butelkowa zieleń', hex: '#2b5644' },
  { id: 'yellow', name: 'Żółty pasów', hex: '#f4c430' },
];

const INSURANCE = [
  {
    id: 'basic', name: 'Podstawowa', perDay: 0, excessFactor: 1, depositFactor: 1,
    covers: ['OC i AC', 'Assistance 24/7 w całej UE'],
  },
  {
    id: 'calm', name: 'Spokojna', perDay: 29, excessFactor: 0.4, depositFactor: 0.5, recommended: true,
    covers: ['OC i AC', 'Assistance 24/7 w całej UE', 'Szyby, lusterka, reflektory'],
  },
  {
    id: 'zen', name: 'Bez nerwów', perDay: 55, excessFactor: 0, depositFixed: 300,
    covers: ['OC i AC', 'Assistance 24/7 w całej UE', 'Szyby, lusterka, reflektory', 'Opony, felgi, podwozie', 'Zgubione kluczyki'],
  },
];

// per: 'day' (capped at `cap`) or 'once'. kind: 'count' gets a stepper, everything else a toggle.
const EXTRAS = [
  { id: 'seat', name: 'Fotelik dziecięcy', note: '9–36 kg, ISOFIX, umyty i sprawdzony', per: 'day', price: 25, cap: 150, kind: 'count', max: 3 },
  { id: 'booster', name: 'Podstawka', note: 'Dla dzieci od 15 kg', per: 'day', price: 10, cap: 60, kind: 'count', max: 3 },
  { id: 'driver', name: 'Dodatkowy kierowca', note: 'Zmiana za kierownicą bez łamania umowy', per: 'day', price: 19, cap: 120 },
  { id: 'abroad', name: 'Wyjazd za granicę (UE)', note: 'Zielona karta i upoważnienie dla auta', per: 'once', price: 99 },
  { id: 'chains', name: 'Łańcuchy śnieżne', note: 'W Alpach i Tatrach zimą bywają obowiązkowe', per: 'day', price: 15, cap: 90 },
  { id: 'box', name: 'Box dachowy 420 l', note: 'Narty, wózek, namiot — co się nie zmieściło', per: 'day', price: 35, cap: 210, notFor: ['cabrio', 'van', 'maluch'] },
  { id: 'bikes', name: 'Bagażnik na 2 rowery', note: 'Na hak, z oświetleniem', per: 'day', price: 30, cap: 180, notFor: ['cabrio', 'maluch'] },
  { id: 'dog', name: 'Pakiet „Pies na pokładzie”', note: 'Mata do bagażnika, miska i sprzątanie po powrocie', per: 'once', price: 69 },
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
  PIERWSZY: { amount: 50, label: 'PIERWSZY · −50 zł' },
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
