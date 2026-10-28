// Skrzynka v1 — mock data: tools, parcel lockers, protection plans and payment test data.
// The company, lockers, banks and prices are fictional. Tool drawings live in art.js.

const COMPANY = {
  name: 'Skrzynka sp. z o.o.',
  addr: 'ul. Śrubowa 8, 50-000 Wrocław',
  ids: 'KRS 0000000000 · NIP 000-000-00-00',
  phone: '+48 71 000 00 00',
  mail: 'pomoc@skrzynka.example',
  site: 'skrzynka.example',
};

const SHIP = 9;           // delivery to a locker plus the return, waived from FREE_SHIP
const FREE_SHIP = 60;
const LATE_FEE = 20;      // per started day late, on top of the next-day price
const CUTOFF = 14;        // orders placed before 14:00 can start tomorrow
const PICKUP_HOURS = 48;  // how long a parcel waits in the locker
const MAX_DAYS = 30;

const CATS = {
  all: 'Wszystko',
  wiercenie: 'Wiercenie',
  ciecie: 'Cięcie',
  wykonczenie: 'Wykończenie',
  sprzatanie: 'Sprzątanie',
  ogrod: 'Ogród',
};

const JOBS = [
  { id: 'polki', label: 'Wieszam półki i telewizor' },
  { id: 'meble', label: 'Składam i odnawiam meble' },
  { id: 'plytki', label: 'Kładę płytki' },
  { id: 'drewno', label: 'Tnę drewno' },
  { id: 'kostka', label: 'Myję kostkę i taras' },
  { id: 'kanapa', label: 'Piorę kanapę' },
  { id: 'ogrod', label: 'Porządki w ogrodzie' },
];

// Locker compartment sizes. A bigger compartment can take a smaller parcel.
const SIZES = { A: '8 × 38 × 64 cm', B: '19 × 38 × 64 cm', C: '41 × 38 × 64 cm' };
const SIZE_RANK = { A: 1, B: 2, C: 3 };

// day = first day, next = every following day, week = flat 7 days (also the cap for a shorter rest)
const TOOLS = [
  {
    id: 'wkretarka', code: 'WK', name: 'Wiertarko-wkrętarka 18 V', short: 'Wkrętarka 18 V', cat: 'wiercenie', size: 'A',
    weight: 1.6, power: '18 V, 2 × 4 Ah', day: 19, next: 12, week: 69, deposit: 200, value: 649, stock: 6, rating: 4.8, reviews: 214,
    blurb: 'Skręcisz szafę z paczki, powiesisz karnisz i przewiercisz się przez drewno. Dwa akumulatory, więc nie czekasz na ładowanie.',
    specs: [['Napięcie', '18 V'], ['Akumulatory', '2 × 4,0 Ah + ładowarka'], ['Moment obrotowy', '60 Nm'], ['Uchwyt', '13 mm, samozaciskowy'], ['Waga', '1,6 kg']],
    kit: ['Walizka', 'Wkrętarka', '2 akumulatory 4 Ah', 'Ładowarka', 'Zestaw 32 bitów'],
    addons: [
      { id: 'wd', name: 'Wiertła do drewna 3–10 mm, 7 szt.', price: 25, kind: 'buy' },
      { id: 'wm', name: 'Wiertła do metalu HSS, 10 szt.', price: 29, kind: 'buy' },
    ],
    jobs: ['meble', 'polki'],
    tip: 'Do betonu się nie nadaje — tu weź młotowiertarkę. Przy wkręcaniu w płytę meblową ustaw sprzęgło na 8–10, żeby nie przekręcić łba.',
  },
  {
    id: 'mlotowiertarka', code: 'MW', name: 'Młotowiertarka SDS-plus 800 W', short: 'Młotowiertarka SDS', cat: 'wiercenie', size: 'B',
    weight: 3.1, power: '800 W, 2,7 J', day: 29, next: 18, week: 109, deposit: 300, value: 899, stock: 4, rating: 4.9, reviews: 388,
    blurb: 'Beton, cegła, pustak — wiercisz bez spinania się. Z dłutem skujesz też starą glazurę.',
    specs: [['Moc', '800 W'], ['Energia udaru', '2,7 J'], ['Uchwyt', 'SDS-plus'], ['Tryby', 'wiercenie, udar, kucie'], ['Waga', '3,1 kg']],
    kit: ['Walizka', 'Młotowiertarka', 'Rękojeść boczna', 'Ogranicznik głębokości', 'Wiertła SDS 6, 8 i 10 mm', 'Dłuto płaskie'],
    addons: [
      { id: 'sds', name: 'Wiertła SDS 5–12 mm, 5 szt.', price: 39, kind: 'buy' },
      { id: 'kolki', name: 'Kołki rozporowe 8 mm z wkrętami, 50 szt.', price: 15, kind: 'buy' },
    ],
    jobs: ['polki', 'plytki'],
    tip: 'Przed wierceniem w ścianie sprawdź, gdzie biegną przewody. Przy skuwaniu płytek wyłącz obroty i zostaw samo kucie.',
  },
  {
    id: 'szlifierka-katowa', code: 'SK', name: 'Szlifierka kątowa 125 mm', short: 'Szlifierka kątowa', cat: 'ciecie', size: 'A',
    weight: 2.2, power: '1100 W', day: 19, next: 12, week: 69, deposit: 200, value: 429, stock: 5, rating: 4.7, reviews: 156,
    blurb: 'Przetnie pręt, kątownik i płytkę, zetnie rdzę i wyrówna spaw. Łagodny rozruch, więc nie wyrywa się z ręki.',
    specs: [['Moc', '1100 W'], ['Tarcza', '125 mm'], ['Obroty', '11 000 obr./min'], ['Łagodny rozruch', 'tak'], ['Waga', '2,2 kg']],
    kit: ['Szlifierka', 'Osłona tarczy', 'Rękojeść boczna', 'Klucz do tarcz', 'Tarcza do metalu'],
    addons: [
      { id: 'tm', name: 'Tarcze do metalu 125 mm, 5 szt.', price: 19, kind: 'buy' },
      { id: 'td', name: 'Tarcza diamentowa do betonu i płytek', price: 39, kind: 'buy' },
    ],
    jobs: ['plytki'],
    tip: 'Zawsze z osłoną i w okularach. Tarczą do metalu nie tnij kamienia ani płytek — potrafi pęknąć.',
  },
  {
    id: 'wyrzynarka', code: 'WY', name: 'Wyrzynarka 650 W', short: 'Wyrzynarka', cat: 'ciecie', size: 'A',
    weight: 2.4, power: '650 W, skok 26 mm', day: 19, next: 12, week: 69, deposit: 200, value: 499, stock: 3, rating: 4.6, reviews: 97,
    blurb: 'Wytniesz otwór na zlew w blacie, skrócisz panel i wyprowadzisz łuk w sklejce. Ruch wahadłowy przyspiesza cięcie grubego drewna.',
    specs: [['Moc', '650 W'], ['Głębokość cięcia', 'drewno 85 mm, stal 8 mm'], ['Ruch wahadłowy', '4 stopnie'], ['Mocowanie brzeszczotu', 'bez narzędzi'], ['Waga', '2,4 kg']],
    kit: ['Walizka', 'Wyrzynarka', '5 brzeszczotów do drewna', 'Prowadnica równoległa'],
    addons: [
      { id: 'bm', name: 'Brzeszczoty do metalu, 5 szt.', price: 19, kind: 'buy' },
      { id: 'bl', name: 'Brzeszczoty do laminatu (czyste cięcie), 5 szt.', price: 25, kind: 'buy' },
    ],
    jobs: ['drewno', 'meble'],
    tip: 'Do blatów i paneli bierz brzeszczot do laminatu z zębami skierowanymi w dół — krawędź zostanie czysta od góry.',
  },
  {
    id: 'pilarka-tarczowa', code: 'PT', name: 'Pilarka tarczowa 190 mm', short: 'Pilarka tarczowa', cat: 'ciecie', size: 'B',
    weight: 4.1, power: '1400 W, cięcie do 66 mm', day: 35, next: 22, week: 129, deposit: 400, value: 899, stock: 0, backIn: 3, rating: 4.8, reviews: 131,
    blurb: 'Deski tarasowe, płyty OSB, krokwie — tniesz prosto i szybko. Z prowadnicą wyjdzie równiej niż w markecie.',
    specs: [['Moc', '1400 W'], ['Tarcza', '190 mm'], ['Głębokość cięcia', '66 mm (90°), 48 mm (45°)'], ['Pochylenie', '0–56°'], ['Waga', '4,1 kg']],
    kit: ['Pilarka', 'Tarcza 24 zęby', 'Prowadnica równoległa', 'Klucz imbusowy', 'Worek na pył'],
    addons: [{ id: 't48', name: 'Tarcza 48 zębów do czystego cięcia', price: 49, kind: 'buy' }],
    jobs: ['drewno'],
    tip: 'Tnij zawsze z obiema rękami na pilarce i podpieraj materiał po obu stronach cięcia, żeby tarcza się nie zakleszczyła.',
  },
  {
    id: 'przecinarka', code: 'PP', name: 'Przecinarka do płytek 63 cm', short: 'Przecinarka do płytek', cat: 'wykonczenie', size: 'C',
    weight: 7.5, power: 'ręczna, cięcie do 63 cm', day: 29, next: 15, week: 99, deposit: 300, value: 649, stock: 2, rating: 4.7, reviews: 74,
    blurb: 'Gres, glazura i terakota bez pyłu i hałasu. Zarysowujesz, dociskasz dźwignię — i masz prostą krawędź.',
    specs: [['Długość cięcia', '63 cm'], ['Grubość płytki', 'do 12 mm'], ['Cięcie po skosie', 'do 45°'], ['Kółko tnące', '22 mm, węglik'], ['Waga', '7,5 kg']],
    kit: ['Przecinarka', 'Kółko tnące (zamontowane)', 'Kątownik', 'Torba transportowa'],
    addons: [{ id: 'kolko', name: 'Zapasowe kółko tnące 22 mm', price: 29, kind: 'buy' }],
    jobs: ['plytki'],
    tip: 'Zarysuj płytkę jednym ruchem, bez cofania. Drugie przejście kółkiem po tej samej linii zwykle kończy się krzywym pęknięciem.',
  },
  {
    id: 'szlifierka-osc', code: 'SO', name: 'Szlifierka oscylacyjna z odpylaniem', short: 'Szlifierka oscylacyjna', cat: 'wykonczenie', size: 'A',
    weight: 1.9, power: '300 W', day: 15, next: 9, week: 55, deposit: 150, value: 349, stock: 5, rating: 4.6, reviews: 88,
    blurb: 'Stara komoda, drzwi do malowania, parapet po zimie. Pył leci do pojemnika, a nie na podłogę.',
    specs: [['Moc', '300 W'], ['Stopa', '115 × 230 mm'], ['Odpylanie', 'pojemnik lub odkurzacz'], ['Regulacja obrotów', 'tak'], ['Waga', '1,9 kg']],
    kit: ['Szlifierka', 'Pojemnik na pył', 'Adapter do odkurzacza', '3 arkusze papieru'],
    addons: [{ id: 'papier', name: 'Papier ścierny P80, P120 i P180, 15 arkuszy', price: 19, kind: 'buy' }],
    jobs: ['meble', 'drewno'],
    tip: 'Zaczynaj od grubego papieru (P80), kończ drobnym (P180). Nie dociskaj — szlifierka pracuje własnym ciężarem.',
  },
  {
    id: 'myjka', code: 'MC', name: 'Myjka ciśnieniowa 150 bar', short: 'Myjka ciśnieniowa', cat: 'sprzatanie', size: 'C',
    weight: 9.4, power: '2100 W, 150 bar', day: 39, next: 25, week: 149, deposit: 400, value: 1099, stock: 3, rating: 4.8, reviews: 302,
    blurb: 'Kostka brukowa, taras, elewacja, rowery i auto. Po godzinie podjazd wygląda jak po wymianie.',
    specs: [['Moc', '2100 W'], ['Ciśnienie', '150 bar'], ['Wydajność', '500 l/h'], ['Wąż', '8 m'], ['Waga', '9,4 kg']],
    kit: ['Myjka', 'Pistolet', 'Lanca z dyszą rotacyjną', 'Wąż 8 m', 'Przystawka do tarasu'],
    addons: [
      { id: 'srodek', name: 'Środek do kostki i tarasu, 1 l', price: 29, kind: 'buy' },
      { id: 'szczotka', name: 'Szczotka obrotowa do aut i rowerów', price: 6, kind: 'day' },
    ],
    jobs: ['kostka', 'ogrod'],
    tip: 'Nie kieruj dyszy rotacyjnej na fugi z bliska — wypłuczesz piasek. Drewno myj płaską dyszą, z odległości co najmniej 30 cm.',
  },
  {
    id: 'odkurzacz-pioracy', code: 'OP', name: 'Odkurzacz piorący do tapicerki', short: 'Odkurzacz piorący', cat: 'sprzatanie', size: 'C',
    weight: 7.2, power: '1200 W', day: 45, next: 30, week: 159, deposit: 300, value: 1199, stock: 4, rating: 4.7, reviews: 241,
    blurb: 'Kanapa po imprezie, fotele w aucie, dywan po psie. Woda wchodzi głęboko, a brud ląduje w zbiorniku.',
    specs: [['Moc', '1200 W'], ['Zbiornik czystej wody', '4 l'], ['Zbiornik brudnej wody', '4 l'], ['Wąż', '2 m'], ['Waga', '7,2 kg']],
    kit: ['Odkurzacz', 'Zbiornik czystej wody', 'Zbiornik brudnej wody', 'Ssawka do tapicerki', 'Wąż 2 m'],
    addons: [
      { id: 'plyn', name: 'Płyn do prania tapicerki, 1 l', price: 29, kind: 'buy' },
      { id: 'ssawka', name: 'Szeroka ssawka do dywanów', price: 6, kind: 'day' },
    ],
    jobs: ['kanapa'],
    tip: 'Przed praniem sprawdź płyn na niewidocznym kawałku obicia. Ostatnie przejście zrób samą czystą wodą — tkanina nie będzie sztywna.',
  },
  {
    id: 'laser', code: 'LK', name: 'Laser krzyżowy zielony ze statywem', short: 'Laser krzyżowy', cat: 'wykonczenie', size: 'B',
    weight: 1.8, power: 'zasięg 30 m, ±0,3 mm/m', day: 25, next: 15, week: 89, deposit: 300, value: 799, stock: 3, rating: 4.9, reviews: 119,
    blurb: 'Rząd półek, galeria ramek, pierwsza linia płytek — wszystko w poziomie za pierwszym razem. Zieloną wiązkę widać nawet w dzień.',
    specs: [['Wiązka', 'zielona, krzyż'], ['Zasięg', '30 m'], ['Dokładność', '±0,3 mm/m'], ['Samopoziomowanie', '±4°'], ['Statyw', '1,2 m']],
    kit: ['Laser', 'Statyw 1,2 m', 'Uchwyt magnetyczny', '4 baterie AA', 'Torba'],
    addons: [],
    jobs: ['polki', 'plytki'],
    tip: 'Odczekaj 3 sekundy po postawieniu — laser sam się wypoziomuje. Miganie wiązki znaczy, że stoi zbyt krzywo.',
  },
  {
    id: 'nozyce', code: 'NZ', name: 'Nożyce do żywopłotu 18 V', short: 'Nożyce do żywopłotu', cat: 'ogrod', size: 'B',
    weight: 2.6, power: '18 V, listwa 55 cm', day: 25, next: 15, week: 89, deposit: 250, value: 699, stock: 4, rating: 4.6, reviews: 63,
    blurb: 'Tuje, ligustr, bukszpan. Bez kabla i bez spalin — jeden akumulator to około 50 metrów żywopłotu.',
    specs: [['Listwa', '55 cm'], ['Rozstaw zębów', '20 mm'], ['Akumulator', '18 V, 4 Ah'], ['Czas pracy', 'ok. 60 min'], ['Waga', '2,6 kg']],
    kit: ['Nożyce', 'Akumulator 4 Ah', 'Ładowarka', 'Osłona listwy'],
    addons: [{ id: 'aku', name: 'Drugi akumulator 4 Ah', price: 6, kind: 'day' }],
    jobs: ['ogrod'],
    tip: 'Boki tnij od dołu do góry, łukiem. Żywopłot powinien być u góry nieco węższy niż u dołu — dolne gałęzie dostaną światło.',
  },
  {
    id: 'pilarka-lancuchowa', code: 'PL', name: 'Pilarka łańcuchowa 18 V, 30 cm', short: 'Pilarka łańcuchowa', cat: 'ogrod', size: 'C',
    weight: 3.6, power: '18 V, prowadnica 30 cm', day: 35, next: 22, week: 129, deposit: 400, value: 999, stock: 2, rating: 4.7, reviews: 85,
    blurb: 'Gałęzie po wichurze, drewno do kominka, stara śliwa. Startuje od przycisku, bez szarpania za linkę.',
    specs: [['Prowadnica', '30 cm'], ['Akumulator', '18 V, 5 Ah'], ['Prędkość łańcucha', '5 m/s'], ['Hamulec łańcucha', 'tak'], ['Waga', '3,6 kg']],
    kit: ['Pilarka', 'Prowadnica 30 cm z łańcuchem', 'Akumulator 5 Ah', 'Ładowarka', 'Osłona prowadnicy', 'Olej do łańcucha 100 ml'],
    addons: [
      { id: 'rekawice', name: 'Rękawice antyprzecięciowe (zostają u Ciebie)', price: 49, kind: 'buy' },
      { id: 'aku5', name: 'Drugi akumulator 5 Ah', price: 6, kind: 'day' },
    ],
    jobs: ['drewno', 'ogrod'],
    tip: 'Tylko w okularach, rękawicach i solidnych butach. Nie tnij końcówką prowadnicy — to tam rodzi się odbicie.',
  },
];

const PROTECTION = [
  { id: 'none', name: 'Bez ochrony', perDay: 0, share: 1, depositFactor: 1, desc: 'Za uszkodzenie lub utratę odpowiadasz do pełnej wartości narzędzia.' },
  { id: 'basic', name: 'Ochrona 30', perDay: 3, share: 0.3, depositFactor: 1, desc: 'Przy szkodzie dopłacasz najwyżej 30% wartości narzędzia.' },
  { id: 'full', name: 'Spokojna głowa', perDay: 6, share: 0, depositFactor: 0.5, desc: 'Zero udziału własnego, a kaucja o połowę niższa.' },
];

// Map coordinates (0–100) are for the stylised city maps only.
const CITIES = {
  'Wrocław': { river: 'M0 36C18 30 32 44 50 37S78 24 100 31', parks: [[78, 62, 9], [22, 18, 6]] },
  'Warszawa': { river: 'M64 0C58 22 70 38 62 55S56 82 65 100', parks: [[30, 28, 8], [80, 72, 7]] },
  'Kraków': { river: 'M0 64C22 58 38 72 54 63S80 52 100 59', parks: [[30, 30, 7], [70, 22, 6]] },
  'Poznań': { river: 'M60 0C55 28 64 48 57 68S50 90 55 100', parks: [[26, 72, 8], [80, 30, 6]] },
  'Gdańsk': { sea: true, parks: [[24, 50, 9], [72, 80, 6]] },
  'Łódź': { parks: [[24, 30, 8], [72, 76, 9], [60, 22, 5]] },
};

const LOCKERS = [
  { id: 'WRO-021', city: 'Wrocław', street: 'ul. Legnicka 58', place: 'przy stacji paliw, obok myjni', x: 26, y: 46, km: 1.8, free: { A: 5, B: 3, C: 2 } },
  { id: 'WRO-007', city: 'Wrocław', street: 'pl. Grunwaldzki 22', place: 'przy wejściu do pasażu', x: 66, y: 42, km: 2.4, free: { A: 2, B: 1, C: 0 } },
  { id: 'WRO-114', city: 'Wrocław', street: 'ul. Grabiszyńska 101', place: 'parking osiedlowy, pod wiatą', x: 30, y: 72, km: 3.1, free: { A: 6, B: 4, C: 3 } },
  { id: 'WRO-052', city: 'Wrocław', street: 'ul. Powstańców Śląskich 95', place: 'przy przystanku tramwajowym', x: 48, y: 78, km: 3.6, free: { A: 0, B: 2, C: 1 } },
  { id: 'WRO-088', city: 'Wrocław', street: 'ul. Kromera 40', place: 'obok piekarni, czynne 24/7', x: 76, y: 20, km: 4.2, free: { A: 3, B: 2, C: 2 } },
  { id: 'WAW-033', city: 'Warszawa', street: 'al. Jana Pawła II 52', place: 'przy wejściu do biurowca', x: 40, y: 38, km: 1.2, free: { A: 4, B: 2, C: 1 } },
  { id: 'WAW-118', city: 'Warszawa', street: 'ul. Puławska 145', place: 'przy stacji metra', x: 46, y: 74, km: 4.6, free: { A: 3, B: 3, C: 2 } },
  { id: 'WAW-205', city: 'Warszawa', street: 'ul. Grochowska 207', place: 'parking przy pawilonie', x: 80, y: 52, km: 5.1, free: { A: 5, B: 1, C: 0 } },
  { id: 'WAW-310', city: 'Warszawa', street: 'ul. Wołoska 12', place: 'pod zadaszeniem, obok apteki', x: 32, y: 66, km: 4.9, free: { A: 2, B: 2, C: 3 } },
  { id: 'WAW-071', city: 'Warszawa', street: 'ul. Jagiellońska 28', place: 'przy bramie osiedla', x: 72, y: 26, km: 3.3, free: { A: 6, B: 4, C: 2 } },
  { id: 'KRK-014', city: 'Kraków', street: 'ul. Karmelicka 30', place: 'w bramie kamienicy', x: 40, y: 40, km: 0.9, free: { A: 3, B: 2, C: 1 } },
  { id: 'KRK-063', city: 'Kraków', street: 'ul. Wielicka 60', place: 'parking przy markecie', x: 64, y: 80, km: 3.8, free: { A: 4, B: 3, C: 3 } },
  { id: 'KRK-101', city: 'Kraków', street: 'al. Pokoju 44', place: 'przy przystanku', x: 78, y: 42, km: 3.2, free: { A: 1, B: 0, C: 1 } },
  { id: 'KRK-031', city: 'Kraków', street: 'ul. Kapelanka 12', place: 'obok siłowni', x: 34, y: 74, km: 2.7, free: { A: 5, B: 2, C: 2 } },
  { id: 'POZ-044', city: 'Poznań', street: 'ul. Dąbrowskiego 120', place: 'przy stacji paliw', x: 30, y: 38, km: 2.6, free: { A: 4, B: 2, C: 2 } },
  { id: 'POZ-019', city: 'Poznań', street: 'ul. Głogowska 75', place: 'przy wejściu na targ', x: 36, y: 64, km: 1.9, free: { A: 2, B: 3, C: 1 } },
  { id: 'POZ-090', city: 'Poznań', street: 'ul. Garbary 48', place: 'pod wiaduktem, oświetlony', x: 66, y: 40, km: 1.4, free: { A: 3, B: 1, C: 2 } },
  { id: 'GDA-008', city: 'Gdańsk', street: 'ul. Grunwaldzka 141', place: 'przy galerii, wejście B', x: 40, y: 34, km: 3.4, free: { A: 4, B: 3, C: 2 } },
  { id: 'GDA-027', city: 'Gdańsk', street: 'ul. Chmielna 20', place: 'na Wyspie Spichrzów', x: 64, y: 64, km: 0.8, free: { A: 2, B: 1, C: 1 } },
  { id: 'GDA-055', city: 'Gdańsk', street: 'ul. Łostowicka 20', place: 'parking osiedlowy', x: 30, y: 78, km: 4.4, free: { A: 5, B: 2, C: 3 } },
  { id: 'LOD-012', city: 'Łódź', street: 'ul. Piotrkowska 200', place: 'w podwórku, wejście od ulicy', x: 50, y: 58, km: 0.7, free: { A: 3, B: 2, C: 1 } },
  { id: 'LOD-040', city: 'Łódź', street: 'al. Kościuszki 80', place: 'przy przystanku tramwajowym', x: 40, y: 44, km: 1.1, free: { A: 2, B: 2, C: 2 } },
  { id: 'LOD-077', city: 'Łódź', street: 'ul. Rokicińska 108', place: 'parking przy hali', x: 78, y: 62, km: 4.8, free: { A: 4, B: 3, C: 3 } },
];

const BANKS = [
  { id: 'kowadlo', name: 'Bank Kowadło', mono: 'BK', color: '#b45309' },
  { id: 'imadlo', name: 'Imadło Bank', mono: 'IB', color: '#1d4ed8' },
  { id: 'poziomica', name: 'Bank Poziomica', mono: 'BP', color: '#0f766e' },
  { id: 'pilnik', name: 'Bank Pilnik', mono: 'PI', color: '#7c3aed' },
  { id: 'cegi', name: 'Cęgi Bank', mono: 'CB', color: '#be123c' },
  { id: 'sruba', name: 'Śruba Kredyt', mono: 'ŚK', color: '#15803d' },
];

const TEST_CARDS = [
  { number: '4242 4242 4242 4242', result: 'płatność przechodzi' },
  { number: '5555 5555 5555 4444', result: 'płatność przechodzi (Mastercard)' },
  { number: '4000 0000 0000 3220', result: 'wymaga 3-D Secure (kod przyjdzie SMS-em)' },
  { number: '4000 0000 0000 0002', result: 'bank odrzuca transakcję' },
];

const TEST_CUSTOMER = {
  name: 'Jan Testowy',
  email: 'jan.testowy@example.com',
  phone: '600 100 200',
  street: 'ul. Próbna 1/2',
  zip: '50-001',
  city: 'Wrocław',
};
