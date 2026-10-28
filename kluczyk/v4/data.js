// Kluczyk v4 — mock data for a one-person rental: six Teslas, each a specific car with a name.
// The owner, address, plates and prices are fictional. Photos are CC0 from Wikimedia Commons.

const OWNER = {
  name: 'Marta Lis',
  first: 'Marta',
  phone: '+48 500 000 000',
  email: 'marta@kluczyk.example',
  since: 2019,
  rentals: 427, // rentals so far; a new booking gets the next number
};

const commons = file => 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_'));

// Cars are handed over in person, 8:00–20:00. Delivery and pick-up cost the fee once.
const PLACES = [
  { id: 'garage', name: 'U mnie na Krzykach', short: 'Krzyki', where: 'ul. Kluczykowa 3, garaż podziemny, miejsce 12', fee: 0 },
  { id: 'door', name: 'Pod Twój adres we Wrocławiu', short: 'Pod adres', where: 'Podstawię auto i potem je od Ciebie odbiorę', fee: 50 },
  { id: 'airport', name: 'Lotnisko WRO', short: 'Lotnisko', where: 'Czekam w hali przylotów z kartką z Twoim imieniem', fee: 80 },
];

const HOURS = { open: 8, close: 20 };

// busy: [first day, last day] counted from the next Friday, so the demo always has a car taken on the weekend.
// tag: colour of the plastic key tag on the board; tilt / swing: how crooked the photo and the key hang.
const CARS = [
  {
    id: 'sniezka', nick: 'Śnieżka', model: 'Tesla Model 3', trim: 'RWD', year: 2024, km: 18400, color: 'biała', plate: 'DW 3SN24',
    seats: 5, trunk: 594, range: 520, towbar: false, price: 219, deposit: 2000, excess: 4000, pos: '55% 50%', tag: '#2f6bd8', tilt: -2.2, swing: -4,
    note: 'Najprostsza z moich Tesli. Jeśli jedziesz elektrykiem pierwszy raz, zacznij od niej — w pięć minut pokażę Ci wszystko.',
    busy: [[7, 10], [16, 18]],
    photo: { src: 'img/model-3-rwd.jpg', author: 'HJUdall', page: commons('24 Tesla Model 3 Base.jpg') },
  },
  {
    id: 'jagoda', nick: 'Jagoda', model: 'Tesla Model 3', trim: 'Long Range AWD', year: 2024, km: 31200, color: 'granatowa', plate: 'DW 3JG24',
    seats: 5, trunk: 594, range: 629, towbar: false, price: 249, deposit: 2500, excess: 5000, pos: '45% 55%', tag: '#7b4fd0', tilt: 1.6, swing: 3,
    note: 'Granatowa, a w słońcu prawie fioletowa — stąd imię. Zasięgu ma najwięcej: Wrocław–Gdańsk bez postoju, jeśli nie szalejesz.',
    busy: [[4, 8], [20, 24]],
    photo: { src: 'img/model-3-lr.jpg', author: 'HJUdall', page: commons('24 Tesla Model 3 Long Range.jpg') },
  },
  {
    id: 'kluska', nick: 'Kluska', model: 'Tesla Model Y', trim: 'RWD', year: 2025, km: 9800, color: 'biała', plate: 'DW 7KL25',
    seats: 5, trunk: 971, range: 500, towbar: false, price: 239, deposit: 2500, excess: 5000, pos: '40% 60%', tag: '#efb321', tilt: -1, swing: -2,
    note: 'Biała, pulchna i bardzo pojemna. Prawie tysiąc litrów bagażnika: wózek, walizki i pies mieszczą się bez układania.',
    busy: [[10, 14]],
    photo: { src: 'img/model-y-rwd.jpg', author: 'JustAnotherCarDesigner', page: commons('Tesla Model Y facelift 001.jpg') },
  },
  {
    id: 'szprotka', nick: 'Szprotka', model: 'Tesla Model Y', trim: 'Long Range AWD', year: 2026, km: 4100, color: 'srebrna', plate: 'DW 7SZ26',
    seats: 5, trunk: 971, range: 586, towbar: true, price: 279, deposit: 3000, excess: 6000, pos: '50% 55%', tag: '#14998a', tilt: 2.2, swing: 5,
    note: 'Najmłodsza w stadzie. Ma hak, więc rowery jadą z Tobą, a dwa silniki zimą wjadą w Karkonosze bez nerwów.',
    busy: [[-3, -1], [12, 15]],
    photo: { src: 'img/model-y-lr.jpg', author: 'HJUdall', page: commons('26 Tesla Model Y Long Range.jpg') },
  },
  {
    id: 'rakieta', nick: 'Rakieta', model: 'Tesla Model S', trim: 'Plaid', year: 2022, km: 61500, color: 'grafitowa', plate: 'DW 5RK22',
    seats: 5, trunk: 793, range: 600, towbar: false, price: 499, deposit: 6000, excess: 10000, pos: '62% 45%', tag: '#e0452c', tilt: -1.6, swing: -3,
    note: 'Ponad tysiąc koni i setka w nieco ponad dwie sekundy. Pasażerowie milkną od razu. Przyspieszaj, proszę, tylko tam, gdzie wolno.',
    busy: [[-1, 3]],
    photo: { src: 'img/model-s-plaid.jpg', author: 'HJUdall', page: commons('22 Tesla Model S Plaid.jpg') },
  },
  {
    id: 'wrona', nick: 'Wrona', model: 'Tesla Model X', trim: 'Plaid', year: 2023, km: 42300, color: 'czarna', plate: 'DW 9WR23',
    seats: 7, trunk: 900, range: 543, towbar: true, price: 599, deposit: 6000, excess: 12000, pos: '50% 60%', tag: '#26272b', tilt: 1.2, swing: 2,
    note: 'Siedem miejsc i tylne drzwi, które otwierają się do góry jak skrzydła. Na każdym parkingu ktoś robi mu zdjęcie.',
    busy: [[2, 5], [9, 11]],
    photo: { src: 'img/model-x-plaid.jpg', author: 'HJUdall', page: commons('23 Tesla Model X Plaid.jpg') },
  },
];

const PROTECTION = [
  { id: 'std', name: 'Standard', perDay: 0, text: car => `OC, AC i assistance 24/7. Przy szkodzie z Twojej winy płacisz do ${zl0(car.excess)}.` },
  { id: 'full', name: 'Spokojna głowa', perDay: 49, deposit: 500, text: () => 'Bez udziału własnego, kaucja tylko 500 zł. Szyby i opony też są objęte.' },
];

// per: 'day' (capped at `cap`) or 'once'
const EXTRAS = [
  { id: 'seat', name: 'Fotelik dla dziecka', note: 'ISOFIX, 9–36 kg. Wiek dziecka napisz w wiadomości.', per: 'day', price: 20, cap: 100 },
  { id: 'charge', name: 'Prąd w cenie', note: 'Ładujesz na Superchargerach na mój koszt, do 300 kWh.', per: 'once', price: 129 },
  { id: 'dog', name: 'Jadę z psem', note: 'Mata na tylną kanapę i sprzątanie po powrocie.', per: 'once', price: 49 },
];

const TEST_CARDS = [
  { number: '4242 4242 4242 4242', result: 'płatność przechodzi' },
  { number: '4000 0000 0000 3220', result: 'wymaga 3-D Secure (kod przyjdzie SMS-em)' },
  { number: '4000 0000 0000 0002', result: 'bank odrzuca transakcję' },
];
