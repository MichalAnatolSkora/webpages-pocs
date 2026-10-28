// Namiar v1 — mock data: a deterministic set of fictional Polish companies.
// Names, NIPs (000-…), domains (.example), phones (… 0xx …) and people are made up,
// so nothing in an exported file points at a real business.

const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const YEAR = TODAY.getFullYear();
const DAY = 86400000;
const DB_SIZE = 24000;
const SEED = 20261028;

const COMPANY = {
  name: 'Namiar sp. z o.o.',
  addr: 'ul. Kompasowa 3, 31-000 Kraków',
  ids: 'KRS 0000000000 · NIP 000-000-00-00',
  phone: '+48 12 000 00 00',
  mail: 'kontakt@namiar.example',
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

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = v => Math.round(v * 10) / 10;

// ---------- text helpers ----------
const PL_ASCII = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
const slug = s => s.toLowerCase().replace(/[ąćęłńóśźż]/g, c => PL_ASCII[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const mask = s => s.replace(/[\p{L}\d]+/gu, w => w[0] + '•'.repeat(clamp(w.length - 1, 2, 5)));
const maskSlug = s => s[0] + '•'.repeat(clamp(s.length - 1, 3, 7));
const gendered = (surname, female) => female && /(sk|ck|dzk)i$/.test(surname) ? surname.slice(0, -1) + 'a' : surname;

// ---------- dictionaries ----------
// cities: [name, weight, area code, postal prefix]
const VOIV = {
  mazowieckie: { label: 'mazowieckie', w: 17, cities: [['Warszawa', 60, '22', '02'], ['Radom', 9, '48', '26'], ['Płock', 8, '24', '09'], ['Siedlce', 6, '25', '08'], ['Pruszków', 8, '22', '05'], ['Legionowo', 5, '22', '05'], ['Ostrołęka', 4, '29', '07']] },
  slaskie: { label: 'śląskie', w: 11.5, cities: [['Katowice', 22, '32', '40'], ['Gliwice', 13, '32', '44'], ['Częstochowa', 14, '34', '42'], ['Sosnowiec', 11, '32', '41'], ['Bielsko-Biała', 14, '33', '43'], ['Rybnik', 10, '32', '44'], ['Tychy', 9, '32', '43'], ['Zabrze', 7, '32', '41']] },
  wielkopolskie: { label: 'wielkopolskie', w: 9.5, cities: [['Poznań', 50, '61', '60'], ['Kalisz', 12, '62', '62'], ['Konin', 9, '63', '62'], ['Piła', 8, '67', '64'], ['Leszno', 8, '65', '64'], ['Gniezno', 8, '61', '62'], ['Ostrów Wielkopolski', 7, '62', '63']] },
  malopolskie: { label: 'małopolskie', w: 9.2, cities: [['Kraków', 55, '12', '30'], ['Tarnów', 12, '14', '33'], ['Nowy Sącz', 10, '18', '33'], ['Oświęcim', 6, '33', '32'], ['Zakopane', 7, '18', '34'], ['Wieliczka', 6, '12', '32'], ['Myślenice', 4, '12', '32']] },
  dolnoslaskie: { label: 'dolnośląskie', w: 8.6, cities: [['Wrocław', 58, '71', '50'], ['Wałbrzych', 10, '74', '58'], ['Legnica', 10, '76', '59'], ['Jelenia Góra', 9, '75', '58'], ['Świdnica', 7, '74', '58'], ['Lubin', 6, '76', '59']] },
  lodzkie: { label: 'łódzkie', w: 6.2, cities: [['Łódź', 58, '42', '90'], ['Piotrków Trybunalski', 11, '44', '97'], ['Pabianice', 8, '42', '95'], ['Skierniewice', 7, '46', '96'], ['Bełchatów', 8, '44', '97'], ['Zgierz', 8, '42', '95']] },
  pomorskie: { label: 'pomorskie', w: 6.4, cities: [['Gdańsk', 45, '58', '80'], ['Gdynia', 22, '58', '81'], ['Słupsk', 10, '59', '76'], ['Sopot', 7, '58', '81'], ['Tczew', 7, '58', '83'], ['Wejherowo', 9, '58', '84']] },
  zachodniopomorskie: { label: 'zachodniopomorskie', w: 4.6, cities: [['Szczecin', 55, '91', '70'], ['Koszalin', 18, '94', '75'], ['Świnoujście', 8, '91', '72'], ['Kołobrzeg', 10, '94', '78'], ['Stargard', 9, '91', '73']] },
  lubelskie: { label: 'lubelskie', w: 4.6, cities: [['Lublin', 55, '81', '20'], ['Zamość', 11, '84', '22'], ['Chełm', 10, '82', '22'], ['Biała Podlaska', 10, '83', '21'], ['Puławy', 9, '81', '24']] },
  podkarpackie: { label: 'podkarpackie', w: 4.6, cities: [['Rzeszów', 45, '17', '35'], ['Przemyśl', 12, '16', '37'], ['Krosno', 12, '13', '38'], ['Mielec', 11, '17', '39'], ['Stalowa Wola', 10, '15', '37'], ['Sanok', 10, '13', '38']] },
  kujawskopomorskie: { label: 'kujawsko-pomorskie', w: 4.8, cities: [['Bydgoszcz', 42, '52', '85'], ['Toruń', 30, '56', '87'], ['Włocławek', 11, '54', '87'], ['Grudziądz', 9, '56', '86'], ['Inowrocław', 8, '52', '88']] },
  warminskomazurskie: { label: 'warmińsko-mazurskie', w: 3.2, cities: [['Olsztyn', 50, '89', '10'], ['Elbląg', 20, '55', '82'], ['Ełk', 12, '87', '19'], ['Giżycko', 8, '87', '11'], ['Ostróda', 10, '89', '14']] },
  podlaskie: { label: 'podlaskie', w: 2.6, cities: [['Białystok', 62, '85', '15'], ['Suwałki', 14, '87', '16'], ['Łomża', 13, '86', '18'], ['Augustów', 11, '87', '16']] },
  swietokrzyskie: { label: 'świętokrzyskie', w: 2.5, cities: [['Kielce', 60, '41', '25'], ['Ostrowiec Świętokrzyski', 14, '41', '27'], ['Starachowice', 12, '41', '27'], ['Sandomierz', 14, '15', '27']] },
  lubuskie: { label: 'lubuskie', w: 2.5, cities: [['Zielona Góra', 42, '68', '65'], ['Gorzów Wielkopolski', 38, '95', '66'], ['Nowa Sól', 10, '68', '67'], ['Żary', 10, '68', '68']] },
  opolskie: { label: 'opolskie', w: 2.1, cities: [['Opole', 55, '77', '45'], ['Kędzierzyn-Koźle', 16, '77', '47'], ['Nysa', 16, '77', '48'], ['Brzeg', 13, '77', '49']] },
};
const CITY_VOIV = {};
for (const [k, v] of Object.entries(VOIV)) for (const c of v.cities) CITY_VOIV[c[0]] = k;

// names: [name pattern, domain pattern]; {F} first name, {S} surname, {W} brand word, lower case = slug
// svc: takes appointments, so online booking matters; hero: plural used in the hero sentence
const INDUSTRIES = {
  dent: { label: 'Stomatologia', hero: 'gabinety stomatologiczne', pkd: '86.23.Z', w: 3, site: 0.82, svc: true, rev: 3.1, ads: 0.2, box: ['recepcja', 'rejestracja', 'kontakt'], slogan: 'Zadbamy o Twój uśmiech',
    names: [['Gabinet Stomatologiczny {F} {S}', 'stomatolog-{s}'], ['{W}-Dent', '{w}-dent'], ['Centrum Stomatologii {W}', 'centrum-{w}'], ['Stomatologia Rodzinna {S}', 'stomatologia-{s}']],
    words: ['Perła', 'Biel', 'Nova', 'Prima', 'Diament', 'Lux', 'Medi'] },
  physio: { label: 'Fizjoterapia', hero: 'gabinety fizjoterapii', pkd: '86.90.A', w: 2.5, site: 0.7, svc: true, rev: 2.8, ads: 0.14, box: ['rejestracja', 'kontakt'], slogan: 'Wróć do formy bez bólu',
    names: [['Gabinet Fizjoterapii {F} {S}', 'fizjo-{s}'], ['Fizjo{W}', 'fizjo{w}'], ['Rehabilitacja {W}', 'rehabilitacja-{w}']],
    words: ['Active', 'Ruch', 'Balans', 'Motion', 'Kinetic', 'Sport'] },
  vet: { label: 'Weterynaria', hero: 'lecznice weterynaryjne', pkd: '75.00.Z', w: 1.2, site: 0.7, svc: true, rev: 3.0, box: ['recepcja', 'kontakt'], slogan: 'Twój pupil w dobrych rękach',
    names: [['Przychodnia Weterynaryjna {W}', 'vet-{w}'], ['Gabinet Weterynaryjny {F} {S}', 'weterynarz-{s}'], ['Lecznica dla Zwierząt {W}', 'lecznica-{w}']],
    words: ['Ogonek', 'Azyl', 'Łapa', 'Animal', 'Zwierzyniec', 'Kot i Pies'] },
  med: { label: 'Gabinety lekarskie', hero: 'gabinety lekarskie', pkd: '86.22.Z', w: 2.5, site: 0.7, svc: true, rev: 2.6, ads: 0.16, box: ['rejestracja', 'recepcja'], slogan: 'Zdrowie całej rodziny',
    names: [['Gabinet Lekarski {F} {S}', 'lekarz-{s}'], ['Centrum Medyczne {W}', 'cm-{w}'], ['Przychodnia {W}', 'przychodnia-{w}']],
    words: ['Zdrowie', 'Medica', 'Vita', 'Salus', 'Familia', 'Ars Medica'] },
  beauty: { label: 'Fryzjer i kosmetyka', hero: 'salony fryzjerskie i kosmetyczne', pkd: '96.02.Z', w: 7, site: 0.5, svc: true, rev: 2.9, ads: 0.14, ig: 0.6, slogan: 'Piękno w Twoim stylu',
    names: [['Salon Fryzjerski {F} {S}', 'fryzjer-{s}'], ['Studio Urody {W}', 'studio-{w}'], ['Gabinet Kosmetyczny {W}', 'kosmetyka-{w}'], ['{W} Hair & Beauty', '{w}-hair']],
    words: ['Bella', 'Glamour', 'Aura', 'Venus', 'Diva', 'Lilia', 'Muza'] },
  gastro: { label: 'Restauracje i kawiarnie', hero: 'restauracje i kawiarnie', pkd: '56.10.A', w: 6, site: 0.65, svc: true, rev: 3.6, ads: 0.12, ig: 0.6, box: ['rezerwacje', 'kontakt'], slogan: 'Kuchnia z sercem',
    names: [['Restauracja {W}', 'restauracja-{w}'], ['Bistro {W}', 'bistro-{w}'], ['Pizzeria {W}', 'pizzeria-{w}'], ['Kawiarnia {W}', 'kawiarnia-{w}'], ['Gospoda {W}', 'gospoda-{w}']],
    words: ['Pod Kasztanem', 'Stara Kuźnia', 'Smakosz', 'Bella Napoli', 'Zielony Groszek', 'Pod Arkadami', 'Młyn', 'Kredens'] },
  hotel: { label: 'Noclegi', hero: 'hotele i pensjonaty', pkd: '55.20.Z', w: 3, site: 0.9, svc: true, rev: 3.5, ads: 0.18, ig: 0.45, box: ['recepcja', 'rezerwacje'], slogan: 'Odpocznij u nas',
    names: [['Hotel {W}', 'hotel-{w}'], ['Pensjonat {W}', 'pensjonat-{w}'], ['Agroturystyka {W}', 'agro-{w}'], ['Apartamenty {W}', 'apartamenty-{w}']],
    words: ['Pod Jodłą', 'Panorama', 'Zacisze', 'Leśny Dwór', 'Słoneczny Stok', 'Dworek', 'Nad Stawem', 'Bursztyn'] },
  auto: { label: 'Warsztaty samochodowe', hero: 'warsztaty samochodowe', pkd: '45.20.Z', w: 6, site: 0.5, svc: true, rev: 2.9, ads: 0.1, slogan: 'Naprawimy szybko i uczciwie',
    names: [['Auto-Serwis {S}', 'autoserwis-{s}'], ['Mechanika Pojazdowa {F} {S}', 'mechanika-{s}'], ['{W} Auto Serwis', '{w}-auto'], ['Wulkanizacja i Mechanika {S}', 'wulkanizacja-{s}']],
    words: ['Turbo', 'Moto', 'Profi', 'Car-Fix', 'Tłok', 'Garaż 24'] },
  build: { label: 'Budownictwo i remonty', hero: 'firmy budowlane i remontowe', pkd: '43.39.Z', w: 11, site: 0.45, ads: 0.1, slogan: 'Budujemy solidnie',
    names: [['{S}-Bud', '{s}-bud'], ['Usługi Remontowo-Budowlane {F} {S}', 'remonty-{s}'], ['{W} Budownictwo', '{w}-budownictwo'], ['Przedsiębiorstwo Budowlane {W}', 'pb-{w}']],
    words: ['Fundament', 'Mur-Max', 'Solid', 'Dach-Pol', 'Konstrukt', 'Budmax', 'Tynk-Art'] },
  install: { label: 'Instalacje i elektryka', hero: 'firmy instalacyjne', pkd: '43.22.Z', w: 6, site: 0.45, ads: 0.1, slogan: 'Instalacje bez awarii',
    names: [['Instalacje Sanitarne {F} {S}', 'instalacje-{s}'], ['Elektro-{W}', 'elektro-{w}'], ['Hydraulika {S}', 'hydraulik-{s}'], ['{W} Instalacje', '{w}-instalacje']],
    words: ['Iskra', 'Volt', 'Amper', 'Instal', 'Termo', 'Watt'] },
  legal: { label: 'Kancelarie prawne', hero: 'kancelarie prawne', pkd: '69.10.Z', w: 3, site: 0.88, rev: 2.0, ads: 0.14, fb: 0.4, box: ['kancelaria', 'sekretariat'], slogan: 'Prawo po Twojej stronie',
    names: [['Kancelaria Adwokacka {F} {S}', 'adwokat-{s}'], ['Kancelaria Radcy Prawnego {F} {S}', 'radca-{s}'], ['Kancelaria Prawna {W}', 'kancelaria-{w}']],
    words: ['Lex', 'Iustitia', 'Veritas', 'Ius', 'Temida', 'Lex Nova'] },
  account: { label: 'Biura rachunkowe', hero: 'biura rachunkowe', pkd: '69.20.Z', w: 4, site: 0.78, rev: 2.0, fb: 0.45, slogan: 'Księgowość bez stresu',
    names: [['Biuro Rachunkowe {F} {S}', 'biuro-{s}'], ['Biuro Rachunkowe {W}', 'br-{w}'], ['{W} Księgowość', '{w}-ksiegowosc']],
    words: ['Bilans', 'Saldo', 'Debet', 'Rachmistrz', 'Ekspert', 'Sigma', 'Abakus'] },
  realty: { label: 'Nieruchomości', hero: 'biura nieruchomości', pkd: '68.31.Z', w: 3, site: 0.85, ads: 0.2, slogan: 'Znajdziemy Ci dom',
    names: [['Biuro Nieruchomości {W}', 'nieruchomosci-{w}'], ['{W} Nieruchomości', '{w}-nieruchomosci'], ['Nieruchomości {F} {S}', '{s}-nieruchomosci']],
    words: ['Dom', 'Klucz', 'Atrium', 'Kamienica', 'Adres', 'Metropolia'] },
  furniture: { label: 'Stolarstwo i meble', hero: 'stolarnie i pracownie mebli', pkd: '31.09.Z', w: 3, site: 0.65, ads: 0.12, slogan: 'Meble na wymiar',
    names: [['Stolarnia {S}', 'stolarnia-{s}'], ['Meble {W}', 'meble-{w}'], ['Pracownia Mebli {F} {S}', 'meble-{s}'], ['Zakład Stolarski {W}', 'stolarstwo-{w}']],
    words: ['Dąb', 'Słoje', 'Jesion', 'Wiórek', 'Komoda', 'Buk'] },
  retail: { label: 'Sklepy stacjonarne', hero: 'sklepy stacjonarne', pkd: '47.19.Z', w: 9, site: 0.45, slogan: 'Wszystko pod ręką',
    names: [['Sklep {W}', 'sklep-{w}'], ['Delikatesy {W}', 'delikatesy-{w}'], ['Hurtownia {W}', 'hurtownia-{w}'], ['Sklep Ogólnospożywczy {F} {S}', 'sklep-{s}']],
    words: ['Kłosek', 'Pod Zegarem', 'Pasja', 'Rogalik', 'Promyk', 'Pod Wierzbą'] },
  transport: { label: 'Transport i logistyka', hero: 'firmy transportowe', pkd: '49.41.Z', w: 7, site: 0.55, fb: 0.4, slogan: 'Dowieziemy na czas',
    names: [['Trans-{S}', 'trans-{s}'], ['Usługi Transportowe {F} {S}', 'transport-{s}'], ['{W} Logistics', '{w}-logistics'], ['Przeprowadzki {W}', 'przeprowadzki-{w}']],
    words: ['Speed', 'Cargo', 'Kurier', 'Spedimax', 'Trakt', 'Kolos', 'Szlak'] },
  edu: { label: 'Szkoły językowe i kursy', hero: 'szkoły językowe i ośrodki kursów', pkd: '85.59.B', w: 3, site: 0.8, svc: true, ads: 0.2, box: ['sekretariat', 'kontakt'], slogan: 'Mów pewnie po angielsku',
    names: [['Szkoła Językowa {W}', 'szkola-{w}'], ['Centrum Szkoleń {W}', 'szkolenia-{w}'], ['Korepetycje {F} {S}', 'korepetycje-{s}'], ['Akademia {W}', 'akademia-{w}']],
    words: ['Lingua', 'Babel', 'Smart', 'Polyglot', 'Erudyta', 'Sowa', 'Atlas'] },
  photo: { label: 'Fotografia i wideo', hero: 'studia foto i wideo', pkd: '74.20.Z', w: 2, site: 0.85, ads: 0.12, ig: 0.7, slogan: 'Kadry, które zostają',
    names: [['Fotografia {F} {S}', '{s}-foto'], ['Studio {W}', 'studio-{w}'], ['{W} Film', '{w}-film']],
    words: ['Kadr', 'Migawka', 'Klisza', 'Obiektyw', 'Kontrast', 'Ostrość'] },
  garden: { label: 'Usługi ogrodnicze', hero: 'firmy ogrodnicze', pkd: '81.30.Z', w: 2, site: 0.5, slogan: 'Ogród Twoich marzeń',
    names: [['Usługi Ogrodnicze {F} {S}', 'ogrody-{s}'], ['Ogrody {W}', 'ogrody-{w}'], ['{W} Zieleń', '{w}-zielen']],
    words: ['Bukszpan', 'Zielony Zakątek', 'Hortensja', 'Paproć', 'Eden'] },
  it: { label: 'IT i oprogramowanie', hero: 'firmy IT', pkd: '62.01.Z', w: 4, site: 0.95, ads: 0.14, fb: 0.5, slogan: 'Oprogramowanie na miarę',
    names: [['{W} Software', '{w}-software'], ['{W} IT', '{w}-it'], ['Usługi Informatyczne {F} {S}', 'it-{s}']],
    words: ['Bitlab', 'Kodex', 'Pixel', 'Nexum', 'Datario', 'Cyfrownia', 'Algorytm'] },
  print: { label: 'Poligrafia i reklama', hero: 'drukarnie i agencje reklamowe', pkd: '18.12.Z', w: 2, site: 0.8, slogan: 'Druk od ręki',
    names: [['Drukarnia {W}', 'drukarnia-{w}'], ['Agencja Reklamowa {W}', 'agencja-{w}'], ['Poligrafia {S}', 'poligrafia-{s}']],
    words: ['Offset', 'Pikto', 'Format', 'Arkusz', 'Raster', 'Banner'] },
  clean: { label: 'Sprzątanie', hero: 'firmy sprzątające', pkd: '81.21.Z', w: 2.5, site: 0.5, ads: 0.1, slogan: 'Czysto i bez kłopotu',
    names: [['Firma Sprzątająca {W}', 'sprzatanie-{w}'], ['Czystość {F} {S}', 'czystosc-{s}'], ['{W} Clean', '{w}-clean']],
    words: ['Błysk', 'Perfekt', 'Lśniąca', 'Ekoklin', 'Świeżość'] },
};

const LEGAL = {
  jdg: { label: 'JDG', long: 'Jednoosobowa działalność', suffix: '', bands: [['1', 56], ['2-9', 42], ['10-49', 2]] },
  sc: { label: 's.c.', long: 'Spółka cywilna', suffix: 's.c.', bands: [['2-9', 72], ['10-49', 28]] },
  spj: { label: 'sp.j.', long: 'Spółka jawna', suffix: 'sp.j.', bands: [['2-9', 45], ['10-49', 48], ['50-249', 7]] },
  spzoo: { label: 'sp. z o.o.', long: 'Spółka z o.o.', suffix: 'sp. z o.o.', bands: [['1', 8], ['2-9', 38], ['10-49', 36], ['50-249', 15], ['250+', 3]] },
  sa: { label: 'S.A.', long: 'Spółka akcyjna', suffix: 'S.A.', bands: [['10-49', 10], ['50-249', 50], ['250+', 40]] },
};
const LEGAL_MIX = [['jdg', 58], ['spzoo', 30], ['sc', 6], ['spj', 5], ['sa', 1]];

const BANDS = { '1': '1 osoba', '2-9': '2–9 osób', '10-49': '10–49 osób', '50-249': '50–249 osób', '250+': '250+ osób' };

const MALE = ['Jan', 'Piotr', 'Krzysztof', 'Tomasz', 'Paweł', 'Marcin', 'Michał', 'Grzegorz', 'Andrzej', 'Adam', 'Łukasz', 'Robert', 'Marek', 'Jacek', 'Dariusz', 'Wojciech', 'Kamil', 'Rafał', 'Sebastian', 'Bartosz'];
const FEMALE = ['Anna', 'Katarzyna', 'Agnieszka', 'Magdalena', 'Joanna', 'Monika', 'Ewa', 'Małgorzata', 'Aleksandra', 'Natalia', 'Karolina', 'Beata', 'Iwona', 'Justyna', 'Marta', 'Barbara', 'Paulina', 'Dorota', 'Sylwia', 'Elżbieta'];
const SURNAMES = ['Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kowalczyk', 'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski', 'Kozłowski', 'Jankowski', 'Mazur', 'Kwiatkowski', 'Krawczyk', 'Kaczmarek', 'Piotrowski', 'Grabowski', 'Zając', 'Pawłowski', 'Michalski', 'Król', 'Wieczorek', 'Jabłoński', 'Wróbel', 'Majewski', 'Olszewski', 'Stępień', 'Malinowski', 'Jaworski', 'Adamczyk', 'Dudek', 'Nowicki', 'Pawlak', 'Górski', 'Witkowski', 'Walczak', 'Sikora', 'Baran', 'Rutkowski', 'Michalak', 'Szewczyk', 'Ostrowski', 'Tomaszewski', 'Pietrzak', 'Zalewski', 'Marciniak', 'Jasiński', 'Zawadzki', 'Bąk', 'Jakubowski', 'Sadowski', 'Duda', 'Włodarczyk', 'Wilk', 'Borkowski', 'Sokołowski', 'Sawicki', 'Lis', 'Kubiak', 'Kucharski', 'Kalinowski', 'Wysocki', 'Mazurek', 'Kołodziej', 'Czarnecki', 'Sobczak', 'Urbański', 'Głowacki', 'Krajewski', 'Kaczor', 'Sowa', 'Gajda', 'Leśniak', 'Mróz', 'Kurek', 'Banaś', 'Żak', 'Chmiel', 'Rogala', 'Wawrzyniak'];
const STREETS = ['Lipowa', 'Polna', 'Leśna', 'Słoneczna', 'Krótka', 'Szkolna', 'Ogrodowa', 'Kwiatowa', 'Długa', 'Kościuszki', 'Mickiewicza', 'Sienkiewicza', 'Kolejowa', 'Parkowa', 'Łąkowa', 'Brzozowa', 'Zielona', 'Piłsudskiego', 'Wąska', 'Rynek', '3 Maja', 'Kopernika', 'Dworcowa', 'Prosta', 'Klonowa', 'Akacjowa'];

// ---------- websites ----------
const TECH = {
  tables: { label: 'HTML 4, układ tabelowy', old: true },
  flash: { label: 'Flash', old: true },
  joomla15: { label: 'Joomla 1.5', old: true },
  phpcustom: { label: 'Własny PHP + jQuery 1.x', old: true },
  wpold: { label: 'WordPress 3–4', old: true },
  builder: { label: 'Darmowy kreator (subdomena)', old: false },
  wp6: { label: 'WordPress 6', old: false },
  modern: { label: 'Nowoczesny front-end', old: false },
};

const SCORE_RULES = [
  ['Wiek projektu', 'do 40 pkt', '3,3 pkt za każdy rok od ostatniego przeprojektowania'],
  ['Brak wersji mobilnej', '20 pkt', 'brak meta viewport albo poziomy scroll na 390 px'],
  ['Brak HTTPS', '15 pkt', 'przeglądarka pokazuje „Niezabezpieczona”'],
  ['Przestarzała technologia', '10 pkt', 'Flash, tabele, Joomla 1.x, WordPress sprzed 5.0, jQuery 1.x'],
  ['Wolne ładowanie', 'do 8 pkt', 'wynik szybkości poniżej 60/100'],
  ['Treść bez zmian', '7 pkt', 'żadnej zmiany w kopii strony od 3 lat'],
];
const SCORE_ZONES = [[75, 'museum', 'skansen'], [50, 'old', 'przestarzała'], [25, 'aging', 'do odświeżenia'], [0, 'fresh', 'świeża']];
const zone = score => SCORE_ZONES.find(z => score >= z[0]);

function siteScore(s) {
  if (!s || s.status !== 'ok') return null;
  let x = Math.min(40, (YEAR - s.built) * 3.3);
  if (!s.https) x += 15;
  if (!s.mobile) x += 20;
  if (TECH[s.tech].old) x += 10;
  x += s.speed < 40 ? 8 : s.speed < 60 ? 4 : 0;
  if (YEAR - s.changed >= 3) x += 7;
  return Math.min(100, Math.round(x));
}

function techFor(d, built) {
  if (built <= 2009) return d.weighted([['tables', 45], ['flash', 25], ['joomla15', built >= 2008 ? 20 : 2], ['phpcustom', 10]]);
  if (built <= 2013) return d.weighted([['joomla15', 28], ['phpcustom', 34], ['wpold', 28], ['builder', 10]]);
  if (built <= 2018) return d.weighted([['wpold', 55], ['builder', 22], ['phpcustom', 12], ['wp6', built >= 2018 ? 11 : 0]]);
  if (built <= 2021) return d.weighted([['wp6', 55], ['builder', 25], ['modern', 20]]);
  return d.weighted([['wp6', 45], ['builder', 25], ['modern', 30]]);
}

function genSite(d, ind, fy, host, isNew) {
  if (!d.chance(ind.site * (isNew ? 0.55 : 1))) return null;
  const u = d.f();
  let built = u < 0.17 ? d.int(2004, 2009) : u < 0.42 ? d.int(2010, 2014) : u < 0.7 ? d.int(2015, 2019) : d.int(2020, YEAR);
  built = Math.max(built, Math.min(fy, YEAR));
  const tech = techFor(d, built);
  const https = tech === 'builder' || d.chance(built >= 2019 ? 0.97 : built >= 2015 ? 0.72 : built >= 2010 ? 0.4 : 0.18);
  const pMobile = { tables: 0, flash: 0, joomla15: 0.04, phpcustom: 0.1, wpold: built >= 2015 ? 0.7 : 0.3, builder: 0.85, wp6: 1, modern: 1 }[tech];
  const tld = tech === 'builder' ? '.kreator.example' : '.example';
  return {
    host, domain: host + tld, domainM: maskSlug(host) + tld,
    built, tech, https,
    mobile: d.chance(pMobile),
    copy: built <= YEAR - 4 && d.chance(0.25) ? YEAR : Math.min(YEAR, built + d.int(0, 2)),
    changed: Math.min(YEAR, built + Math.floor((YEAR - built + 1) * d.f() ** 2.2)),
    speed: clamp(Math.round(22 + (built - 2004) * 2.7 + d.norm(0, 13) + (tech === 'builder' ? -12 : tech === 'modern' ? 14 : 0)), 4, 99),
    status: isNew ? 'ok' : d.weighted([['ok', 94], ['down', 4], ['error', 2]]),
    form: d.chance(built >= 2014 ? 0.75 : 0.35),
    booking: !!ind.svc && d.chance(built >= 2019 ? 0.5 : built >= 2014 ? 0.15 : 0.03),
  };
}

function nextJubilee(fDate) {
  let a = new Date(YEAR, fDate.getMonth(), fDate.getDate());
  if (a < TODAY) a = new Date(YEAR + 1, fDate.getMonth(), fDate.getDate());
  const years = a.getFullYear() - fDate.getFullYear();
  return years >= 5 && years % 5 === 0 ? { years, days: Math.round((a - TODAY) / DAY) } : null;
}

// ---------- companies ----------
const IND_PAIRS = Object.keys(INDUSTRIES).map(k => [k, INDUSTRIES[k].w]);
const VOIV_PAIRS = Object.keys(VOIV).map(k => [k, VOIV[k].w]);
const HIRE_P = { '1': 0.01, '2-9': 0.05, '10-49': 0.16, '50-249': 0.38, '250+': 0.65 };
const HIRE_MAX = { '1': 1, '2-9': 2, '10-49': 4, '50-249': 7, '250+': 12 };

// fresh: null for the base set, or 'new' | 'moved' | 'hiring' | 'scan' for a weekly monitoring batch
function genCompany(id, d, used, fresh) {
  const indKey = d.weighted(IND_PAIRS);
  const ind = INDUSTRIES[indKey];
  const voiv = d.weighted(VOIV_PAIRS);
  const [city, , area, post] = d.weighted(VOIV[voiv].cities.map(c => [c, c[1]]));
  const female = d.chance(0.5);
  const first = d.pick(female ? FEMALE : MALE);
  const last = gendered(d.pick(SURNAMES), female);
  const word = d.pick(ind.words);
  const [tpl, dom] = d.pick(ind.names);
  const personal = /\{[FS]\}/.test(tpl);
  const legal = personal ? (d.chance(0.9) ? 'jdg' : 'sc') : d.weighted(LEGAL_MIX);

  const fill = (t, m) => t.replace(/\{F\}/g, m ? mask(first) : first).replace(/\{S\}/g, m ? mask(last) : last).replace(/\{W\}/g, m ? mask(word) : word);
  const brand = fill(tpl), brandM = fill(tpl, true);
  let name = brand, nameM = brandM;
  if (legal === 'jdg' && !personal) { name += ` ${first} ${last}`; nameM += ` ${mask(first)} ${mask(last)}`; }
  else if (legal !== 'jdg') { name += ' ' + LEGAL[legal].suffix; nameM += ' ' + LEGAL[legal].suffix; }

  let host = dom.replace('{f}', slug(first)).replace('{s}', slug(last)).replace('{w}', slug(word));
  if (used.has(host)) host += '-' + slug(city);
  for (let n = 2; used.has(host); n++) host = host.replace(/-\d+$/, '') + '-' + n;
  used.add(host);

  let founded;
  const u = d.f();
  if (fresh === 'new') founded = d.int(0, 6);
  else if (u < 0.035) founded = d.int(0, 90);
  else if (u < 0.085) founded = d.int(91, 365);
  else founded = Math.min(36 * 365, Math.floor((1 - Math.log(1 - d.f() * 0.985) * 10) * 365) + d.int(0, 364));
  const fDate = new Date(YEAR, TODAY.getMonth(), TODAY.getDate() - founded);
  const fy = fDate.getFullYear();
  const isNew = founded < 365;

  let band = d.weighted(LEGAL[legal].bands);
  if (isNew && !['1', '2-9'].includes(band)) band = '2-9';
  const emp = { '1': 1, '2-9': d.int(2, 9), '10-49': d.int(10, 49), '50-249': d.int(50, 249), '250+': d.int(250, 900) }[band];

  const site = genSite(d, ind, fy, host, isNew);

  const pG = { gastro: 0.96, hotel: 0.96, beauty: 0.9, auto: 0.9, dent: 0.92, med: 0.9, physio: 0.88, vet: 0.9 }[indKey] ?? 0.72;
  let g = null;
  if (d.chance(isNew ? pG * 0.7 : pG)) {
    const reviews = Math.max(0, Math.round(Math.exp(d.norm((ind.rev ?? 2.3) - (isNew ? 1.2 : 0), 1.1))) - 1);
    const rating = reviews === 0 ? null : d.chance(0.13) ? round1(2.4 + d.f() * 1.5) : round1(clamp(d.norm(4.55, 0.3), 3.6, 5));
    g = { rating, reviews, claimed: d.chance(isNew ? 0.5 : 0.74) };
  }

  let fb = null;
  if (d.chance(ind.fb ?? 0.62)) {
    const v = d.f();
    fb = v < 0.42 ? d.int(0, 30) : v < 0.7 ? d.int(31, 365) : d.int(366, 2400);
    if (isNew) fb = Math.min(fb, founded);
  }

  const ads = d.chance((ind.ads ?? 0.08) * (site && site.built >= 2019 ? 1.4 : 1) * (site ? 1 : 0.35));
  let hiring = d.chance(HIRE_P[band]) ? d.int(1, HIRE_MAX[band]) : 0;
  const growth = d.chance(band === '1' ? 0.03 : 0.1) ? d.int(15, 90) : d.int(-15, 10);
  let moved = d.chance(0.03) ? d.int(0, 365) : null;
  const board = (legal === 'spzoo' || legal === 'sa') && d.chance(0.08) ? d.int(0, 365) : null;
  if (fresh === 'moved') moved = d.int(0, 6);
  if (fresh === 'hiring') hiring = Math.max(1, hiring);

  let email = null, emailM = null, emailType = null;
  if (site && site.status === 'ok' && site.tech !== 'builder' && d.chance(0.88)) {
    const box = d.pick(ind.box ?? ['biuro', 'kontakt', 'info']);
    email = `${box}@${site.domain}`;
    emailM = `${box}@${site.domainM}`;
    emailType = 'domain';
  } else if (d.chance(0.55)) {
    const local = host.replace(/-/g, '.');
    email = `${local}@poczta.example`;
    emailM = `${maskSlug(local)}@poczta.example`;
    emailType = 'free';
  }

  let phone = null, phoneM = null;
  if (d.chance(0.93)) {
    const a = d.int(10, 99), b = String(d.int(0, 99)).padStart(2, '0'), c = String(d.int(0, 99)).padStart(2, '0');
    phone = `+48 ${area} 0${a} ${b} ${c}`;
    phoneM = `+48 ${area} 0•• •• ${c}`;
  }

  const role = { jdg: female ? 'Właścicielka' : 'Właściciel', sc: female ? 'Wspólniczka' : 'Wspólnik', spj: female ? 'Wspólniczka' : 'Wspólnik', spzoo: 'Prezes zarządu', sa: 'Prezes zarządu' }[legal];
  const n = String((id * 7919 + 1234567) % 10000000).padStart(7, '0');

  return {
    id, nip: `000-${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`,
    name, nameM, brand, brandM, legal, ind: indKey,
    city, voiv, street: `ul. ${d.pick(STREETS)} ${d.int(1, 140)}`, postal: `${post}-${String(d.int(0, 999)).padStart(3, '0')}`,
    founded, fDate, fy, emp, band, growth, hiring, moved, board, jub: nextJubilee(fDate),
    site, score: siteScore(site), g, fb, ig: d.chance(ind.ig ?? 0.25), ads,
    email, emailM, emailType, phone, phoneM,
    person: { name: `${first} ${last}`, nameM: `${mask(first)} ${mask(last)}`, role },
  };
}

const DB = (() => {
  const d = dice(mulberry32(SEED));
  const used = new Set();
  const out = new Array(DB_SIZE);
  for (let i = 0; i < DB_SIZE; i++) out[i] = genCompany(i + 1, d, used, null);
  return out;
})();
const BY_ID = new Map(DB.map(r => [r.id, r]));

// A week of monitoring: companies that registered, moved, started hiring or got scanned for the first time.
const BATCH_USED = new Set(DB.map(r => r.site ? r.site.host : '').filter(Boolean));
function genBatch(seed, startId, n = 520) {
  const d = dice(mulberry32(seed));
  const used = new Set(BATCH_USED);
  const out = [];
  for (let i = 0; i < n; i++) out.push(genCompany(startId + i, d, used, d.weighted([['new', 40], ['scan', 30], ['moved', 15], ['hiring', 15]])));
  return out;
}
