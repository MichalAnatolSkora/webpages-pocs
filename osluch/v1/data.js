// Osłuch v1 — everything the mock pretends to know: clinic, doctors, patients, the drug list with its safety rules,
// visit reasons with their pre-visit questions, and the three scripted consultations the AI assistant listens to.
// All people, numbers and prices are made up. Doses follow common adult regimens, but none of this is medical advice.

const CLINIC = {
  name: 'Osłuch',
  legal: 'Osłuch Telemedycyna sp. z o.o.',
  address: 'ul. Szewska 8, 50-139 Wrocław',
  phone: '+48 71 000 00 00',
  email: 'pomoc@osluch.example',
};

const VISIT_TYPES = {
  video: { label: 'Wideo', icon: 'video', price: 99, note: 'Lekarz zobaczy np. gardło albo zmiany na skórze' },
  phone: { label: 'Telefon', icon: 'phone', price: 79, note: 'Rozmowa głosowa, bez kamery' },
  chat: { label: 'Czat', icon: 'chat', price: 69, note: 'Piszesz z lekarzem w aplikacji' },
};

// A fictional PESEL with a correct check digit (birth date + serial + sex digit).
function pesel(born, serial, female) {
  const [y, m, d] = born.split('-').map(Number);
  const head = pad(y % 100) + pad(m + (y >= 2000 ? 20 : 0)) + pad(d) + String(serial).padStart(3, '0') + (female ? 4 : 1);
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  return head + (10 - [...head].reduce((s, ch, i) => s + (ch * w[i]) % 10, 0) % 10) % 10;
}

// ---------- doctors ----------
const DOCTOR_PASSWORD = 'Lekarz123!';
const DOCTORS = [
  {
    id: 'nowak', title: 'lek.', first: 'Ewa', last: 'Nowak', female: true, pwz: '2384716', since: 2011,
    spec: 'Specjalistka chorób wewnętrznych', short: 'internistka', rating: 4.9, reviews: 1284, langs: ['polski', 'angielski'],
    email: 'ewa.nowak@osluch.example',
    bio: 'Dwanaście lat na oddziale chorób wewnętrznych, od 2021 r. konsultuje online. Lubi konkretne pytania i jasne zalecenia.',
    av: { skin: '#f0c9a8', skin2: '#e0ae8a', hair: 'bob', hairColor: '#4a2f22', shirt: '#3f7f86', bg: '#d8ebe6', glasses: true },
  },
  {
    id: 'mazur', title: 'lek.', first: 'Adam', last: 'Mazur', female: false, pwz: '3170582', since: 2016,
    spec: 'Internista, w trakcie specjalizacji z kardiologii', short: 'internista', rating: 4.8, reviews: 642, langs: ['polski', 'angielski', 'niemiecki'],
    email: 'adam.mazur@osluch.example',
    bio: 'Pracuje w poradni kardiologicznej i online. Dobrze tłumaczy wyniki badań i ciśnienie z domowych pomiarów.',
    av: { skin: '#e9b98f', skin2: '#d7a072', hair: 'short', hairColor: '#2b2320', shirt: '#26415f', bg: '#dfe6f1', beard: true },
  },
  {
    id: 'kaczmarek', title: 'dr n. med.', first: 'Joanna', last: 'Kaczmarek', female: true, pwz: '1945203', since: 2004,
    spec: 'Specjalistka chorób wewnętrznych i diabetologii', short: 'internistka', rating: 5.0, reviews: 2031, langs: ['polski'],
    email: 'joanna.kaczmarek@osluch.example',
    bio: 'Cukrzyca, tarczyca, choroby przewlekłe. Prowadzi pacjentów latami — także zdalnie, na podstawie wyników.',
    av: { skin: '#f3d2b8', skin2: '#e2b695', hair: 'bun', hairColor: '#8a5a3b', shirt: '#7a4f6d', bg: '#f1e2ea' },
  },
  {
    id: 'sowa', title: 'lek.', first: 'Krzysztof', last: 'Sowa', female: false, pwz: '2765019', since: 2009,
    spec: 'Specjalista chorób wewnętrznych i medycyny rodzinnej', short: 'internista', rating: 4.7, reviews: 908, langs: ['polski', 'ukraiński'],
    email: 'krzysztof.sowa@osluch.example',
    bio: 'Infekcje, bóle pleców, zwolnienia i sprawy codzienne. Konsultuje także po ukraińsku.',
    av: { skin: '#f1c6a1', skin2: '#dfab82', hair: 'grey', hairColor: '#9aa0a3', shirt: '#4b5d3a', bg: '#e6ecdc', glasses: true },
  },
];
DOCTORS.forEach(d => { d.name = `${d.first} ${d.last}`; d.full = `${d.title} ${d.first} ${d.last}`; });

// ---------- patients ----------
// Anna is the test account. The others only appear in the doctor's schedule.
const PATIENT_PASSWORD = 'Pacjent123!';
const PATIENTS = [
  {
    id: 'anna', first: 'Anna', last: 'Kowalska', female: true, born: '1992-03-14', serial: 481,
    email: 'anna.kowalska@poczta.example', phone: '+48 600 000 123',
    address: 'ul. Jedności Narodowej 41/7, 50-260 Wrocław',
    job: 'księgowa, praca biurowa',
    employer: { name: 'Biuro Rachunkowe Saldo sp. z o.o.', nip: '899-000-00-00' },
    allergies: [{ name: 'Amoksycylina (penicyliny)', reaction: 'swędząca wysypka po ok. 3 dniach leczenia, bez duszności', year: 2015, cls: ['penicillin', 'r1-amino'] }],
    conditions: [{ name: 'Choroba Hashimoto', icd: 'E06.3', since: 2019 }],
    meds: [{ drug: 'levo75', sig: '1 tabl. rano na czczo' }],
    files: [{
      id: 'f-tsh', name: 'TSH_marzec_2026.pdf', kind: 'Wynik badania', date: '2026-03-10', lab: 'Laboratorium Diagnostyka (przykład)',
      rows: [['TSH', '2,1', 'mIU/l', '0,27–4,20'], ['fT4', '15,8', 'pmol/l', '12,0–22,0']],
    }],
    history: [
      { date: '2026-03-12', doctor: 'kaczmarek', type: 'video', reason: 'Kontrola tarczycy', dx: 'E06.3 Autoimmunologiczne zapalenie tarczycy', summary: 'TSH w normie. Kontynuacja lewotyroksyny 75 µg.' },
      { date: '2025-11-04', doctor: 'sowa', type: 'phone', reason: 'Przeziębienie', dx: 'J06.9 Ostre zakażenie górnych dróg oddechowych', summary: 'Leczenie objawowe, bez antybiotyku.' },
    ],
    av: { skin: '#f2cdb0', skin2: '#e1b391', hair: 'long', hairColor: '#7b4a2c', shirt: '#c7674a', bg: '#f6e3d6' },
  },
  {
    id: 'jan', first: 'Jan', last: 'Wiśniewski', female: false, born: '1959-06-02', serial: 107,
    allergies: [], conditions: [{ name: 'Nadciśnienie tętnicze', icd: 'I10', since: 2014 }, { name: 'Hipercholesterolemia', icd: 'E78.0', since: 2018 }],
    meds: [{ drug: 'perin', sig: '1 tabl. rano' }, { drug: 'amlo', sig: '1 tabl. rano' }, { drug: 'atorva', sig: '1 tabl. wieczorem' }],
    av: { skin: '#eebf9b', skin2: '#dba57d', hair: 'grey', hairColor: '#b9bcbd', shirt: '#5a6f8a', bg: '#e3e8ef' },
  },
  {
    id: 'marta', first: 'Marta', last: 'Zielińska', female: true, born: '1998-11-23', serial: 350,
    allergies: [], conditions: [], meds: [],
    av: { skin: '#f4d6bd', skin2: '#e5bb9b', hair: 'bun', hairColor: '#2c211c', shirt: '#4f8a6b', bg: '#e1efe6' },
  },
  {
    id: 'tomasz', first: 'Tomasz', last: 'Lewandowski', female: false, born: '1985-04-09', serial: 226,
    allergies: [], conditions: [], meds: [],
    av: { skin: '#e7b58c', skin2: '#d49d70', hair: 'short', hairColor: '#5b3b24', shirt: '#8a5a44', bg: '#efe3da' },
  },
  {
    id: 'krystyna', first: 'Krystyna', last: 'Wójcik', female: true, born: '1954-01-30', serial: 813,
    allergies: [{ name: 'Sulfametoksazol z trimetoprimem', reaction: 'pokrzywka', year: 2009, cls: ['sulfonamide'] }],
    conditions: [{ name: 'Cukrzyca typu 2', icd: 'E11.9', since: 2016 }, { name: 'Nadciśnienie tętnicze', icd: 'I10', since: 2012 }],
    meds: [{ drug: 'metf', sig: '1 tabl. 2× dziennie' }, { drug: 'perin', sig: '1 tabl. rano' }],
    av: { skin: '#f3d0b6', skin2: '#e2b493', hair: 'curly', hairColor: '#c9c6c2', shirt: '#7b5aa6', bg: '#ece6f4', glasses: true },
  },
  {
    id: 'piotr', first: 'Piotr', last: 'Kamiński', female: false, born: '1981-08-17', serial: 562,
    allergies: [], conditions: [{ name: 'Hipercholesterolemia', icd: 'E78.0', since: 2026 }], meds: [],
    av: { skin: '#d9a57c', skin2: '#c48d63', hair: 'short', hairColor: '#1f1a17', shirt: '#2f5d50', bg: '#dcebe5' },
  },
  {
    id: 'ola', first: 'Aleksandra', last: 'Dąbrowska', female: true, born: '2007-02-11', serial: 94,
    allergies: [], conditions: [], meds: [],
    av: { skin: '#f6dcc6', skin2: '#e8c2a3', hair: 'long', hairColor: '#c58b4c', shirt: '#3d6fb0', bg: '#dfe8f6' },
  },
];
PATIENTS.forEach(p => { p.pesel = pesel(p.born, p.serial, p.female); p.name = `${p.first} ${p.last}`; });

// ---------- drugs ----------
// cls drives the allergy and interaction rules. maxUnits = most units per day. unitPrice is a made-up full price.
const DRUGS = [
  { id: 'penv', inn: 'Fenoksymetylopenicylina', aka: ['penicylina', 'ospen'], form: 'tabl. powl.', strength: '1 000 000 j.m.', packs: [12, 30], unit: 'tabl.', cls: ['penicillin', 'antibiotic'], refund: ['100%', '30%'], unitPrice: 2.1, maxUnits: 4 },
  { id: 'amox', inn: 'Amoksycylina', aka: ['duomox', 'ospamox'], form: 'tabl. powl.', strength: '1000 mg', packs: [16], unit: 'tabl.', cls: ['penicillin', 'antibiotic', 'r1-amino'], refund: ['100%', '30%'], unitPrice: 1.35, maxUnits: 3 },
  { id: 'amoxclav', inn: 'Amoksycylina + kwas klawulanowy', aka: ['augmentin', 'amoksiklav'], form: 'tabl. powl.', strength: '875 mg + 125 mg', packs: [14], unit: 'tabl.', cls: ['penicillin', 'antibiotic', 'r1-amino'], refund: ['100%', '30%'], unitPrice: 2.35, maxUnits: 2 },
  { id: 'cefadroxil', inn: 'Cefadroksyl', aka: ['duracef'], form: 'tabl.', strength: '1000 mg', packs: [10], unit: 'tabl.', cls: ['cephalosporin', 'antibiotic', 'r1-amino'], refund: ['100%', '30%'], unitPrice: 3.85, maxUnits: 2 },
  { id: 'cefurox', inn: 'Cefuroksym (aksetyl)', aka: ['zinnat', 'cefuroksym', 'xorimax'], form: 'tabl. powl.', strength: '250 mg', packs: [10], unit: 'tabl.', cls: ['cephalosporin', 'antibiotic'], refund: ['100%', '30%'], unitPrice: 2.95, maxUnits: 4 },
  { id: 'clari', inn: 'Klarytromycyna', aka: ['klacid', 'fromilid'], form: 'tabl. powl.', strength: '250 mg', packs: [14], unit: 'tabl.', cls: ['macrolide', 'antibiotic'], refund: ['100%', '30%'], unitPrice: 1.95, maxUnits: 4 },
  { id: 'azithro', inn: 'Azytromycyna', aka: ['sumamed', 'azitrox'], form: 'tabl. powl.', strength: '500 mg', packs: [3], unit: 'tabl.', cls: ['macrolide', 'antibiotic'], refund: ['100%', '30%'], unitPrice: 7.4, maxUnits: 1 },
  { id: 'fosfo', inn: 'Fosfomycyna (trometamol)', aka: ['monural', 'urofoss'], form: 'granulat do sporz. roztworu', strength: '3 g', packs: [1], unit: 'sasz.', cls: ['antibiotic'], refund: ['100%'], unitPrice: 39.9, maxUnits: 1 },
  { id: 'nitro', inn: 'Nitrofurantoina', aka: ['siraliden'], form: 'tabl.', strength: '100 mg', packs: [30], unit: 'tabl.', cls: ['antibiotic'], refund: ['100%', '30%'], unitPrice: 0.48, maxUnits: 4 },
  { id: 'levo75', inn: 'Lewotyroksyna sodowa', aka: ['euthyrox', 'letrox'], form: 'tabl.', strength: '75 µg', packs: [50, 100], unit: 'tabl.', cls: ['levothyroxine'], refund: ['100%', 'R'], unitPrice: 0.19, maxUnits: 2 },
  { id: 'levo100', inn: 'Lewotyroksyna sodowa', aka: ['euthyrox', 'letrox'], form: 'tabl.', strength: '100 µg', packs: [50, 100], unit: 'tabl.', cls: ['levothyroxine'], refund: ['100%', 'R'], unitPrice: 0.2, maxUnits: 2 },
  { id: 'ibu', inn: 'Ibuprofen', aka: ['ibuprom', 'nurofen'], form: 'tabl. powl.', strength: '400 mg', packs: [20, 30], unit: 'tabl.', cls: ['nsaid'], refund: ['100%'], unitPrice: 0.55, maxUnits: 6 },
  { id: 'para', inn: 'Paracetamol', aka: ['apap', 'panadol'], form: 'tabl.', strength: '500 mg', packs: [20, 50], unit: 'tabl.', cls: ['analgesic'], refund: ['100%'], unitPrice: 0.3, maxUnits: 8 },
  { id: 'perin', inn: 'Peryndopryl (argininian)', aka: ['prestarium', 'peryndopryl'], form: 'tabl. powl.', strength: '5 mg', packs: [30, 90], unit: 'tabl.', cls: ['acei'], refund: ['100%', '30%', 'S'], unitPrice: 0.42, maxUnits: 2 },
  { id: 'amlo', inn: 'Amlodypina', aka: ['amlozek', 'tenox'], form: 'tabl.', strength: '5 mg', packs: [30, 90], unit: 'tabl.', cls: ['ccb'], refund: ['100%', '30%', 'S'], unitPrice: 0.22, maxUnits: 2 },
  { id: 'atorva', inn: 'Atorwastatyna', aka: ['atoris', 'sortis'], form: 'tabl. powl.', strength: '20 mg', packs: [30, 90], unit: 'tabl.', cls: ['statin'], refund: ['100%', '30%', 'S'], unitPrice: 0.36, maxUnits: 4 },
  { id: 'metf', inn: 'Metformina', aka: ['glucophage', 'siofor'], form: 'tabl. powl.', strength: '850 mg', packs: [60], unit: 'tabl.', cls: ['biguanide'], refund: ['100%', 'R', 'S'], unitPrice: 0.16, maxUnits: 3 },
  { id: 'omep', inn: 'Omeprazol', aka: ['polprazol', 'helicid'], form: 'kaps. dojel.', strength: '20 mg', packs: [28], unit: 'kaps.', cls: ['ppi'], refund: ['100%', '30%'], unitPrice: 0.4, maxUnits: 2 },
  { id: 'feso4', inn: 'Siarczan żelaza(II)', aka: ['tardyferon', 'żelazo'], form: 'tabl. o przedł. uwalnianiu', strength: '80 mg Fe²⁺', packs: [30], unit: 'tabl.', cls: ['iron'], refund: ['100%'], unitPrice: 0.62, maxUnits: 2 },
  { id: 'momet', inn: 'Mometazonu furoinian', aka: ['elocom', 'mometazon'], form: 'krem', strength: '1 mg/g', packs: [15], unit: 'g', topical: true, cls: ['steroid-topical'], refund: ['100%'], unitPrice: 1.6 },
  { id: 'cetir', inn: 'Cetyryzyna', aka: ['zyrtec', 'allertec'], form: 'tabl. powl.', strength: '10 mg', packs: [30], unit: 'tabl.', cls: ['antihistamine'], refund: ['100%'], unitPrice: 0.3, maxUnits: 1 },
];
const drugById = id => DRUGS.find(d => d.id === id);
const drugLabel = d => `${d.inn} ${d.strength}`;

const REFUNDS = {
  '100%': 'pełnopłatny', '50%': 'odpłatność 50%', '30%': 'odpłatność 30%', R: 'ryczałt',
  B: 'bezpłatny', S: 'bezpłatny 65+ (S)', DZ: 'bezpłatny do 18 lat (DZ)', C: 'bezpłatny w ciąży (C)',
};
function patientPrice(drug, pack, qty, refund) {
  const full = drug.unitPrice * pack * qty;
  if (refund === '30%') return Math.max(full * 0.3, 3.2 * qty);
  if (refund === '50%') return full * 0.5;
  if (refund === 'R') return 3.2 * qty;
  if (['B', 'S', 'DZ', 'C'].includes(refund)) return 0;
  return full;
}

// Deterministic safety rules — these are a drug database lookup, not a language model guess.
const ALLERGY_RULES = [
  { allergy: 'penicillin', drug: 'penicillin', lvl: 'block', text: 'Alergia na penicyliny w karcie ({reaction}). Lek przeciwwskazany.' },
  { allergy: 'r1-amino', drug: 'r1-amino', lvl: 'major', text: 'Ten sam łańcuch boczny R1 co amoksycylina — wyższe ryzyko reakcji krzyżowej. Wybierz cefalosporynę o innym łańcuchu (np. cefuroksym) albo makrolid.' },
  { allergy: 'penicillin', drug: 'cephalosporin', lvl: 'info', text: 'Alergia nienatychmiastowa na penicylinę: przy odmiennym łańcuchu bocznym ryzyko reakcji krzyżowej jest niskie (<1%). Poinformuj pacjenta o objawach alergii.' },
  { allergy: 'sulfonamide', drug: 'sulfonamide', lvl: 'block', text: 'Alergia na sulfonamidy w karcie ({reaction}).' },
];
const INTERACTIONS = [
  { a: 'macrolide', b: 'statin', lvl: 'major', text: 'Klarytromycyna silnie hamuje CYP3A4 — ryzyko miopatii przy statynie. Wybierz azytromycynę albo wstrzymaj statynę na czas leczenia.' },
  { a: 'nsaid', b: 'acei', lvl: 'moderate', text: 'NLPZ osłabiają działanie leku na nadciśnienie i obciążają nerki, zwłaszcza u starszych. Rozważ paracetamol.' },
  { a: 'iron', b: 'levothyroxine', lvl: 'moderate', text: 'Żelazo zmniejsza wchłanianie lewotyroksyny — zachowaj odstęp co najmniej 4 godzin.' },
  { a: 'ppi', b: 'levothyroxine', lvl: 'minor', text: 'Inhibitory pompy protonowej mogą zmniejszać wchłanianie lewotyroksyny — kontrola TSH po 6–8 tygodniach.' },
  { a: 'ppi', b: 'iron', lvl: 'minor', text: 'Inhibitory pompy protonowej zmniejszają wchłanianie żelaza.' },
];

const LAB_TESTS = [
  ['Hematologia', [['cbc', 'Morfologia krwi z rozmazem'], ['esr', 'OB']]],
  ['Biochemia', [['crp', 'CRP'], ['glu', 'Glukoza na czczo'], ['hba1c', 'HbA1c'], ['crea', 'Kreatynina z eGFR'], ['alt', 'ALT'], ['lipid', 'Lipidogram'], ['ferr', 'Ferrytyna'], ['fe', 'Żelazo'], ['b12', 'Witamina B12'], ['vitd', 'Witamina D — 25(OH)D']]],
  ['Hormony', [['tsh', 'TSH'], ['ft4', 'fT4']]],
  ['Mocz', [['ua', 'Badanie ogólne moczu'], ['ucult', 'Posiew moczu z antybiogramem']]],
];
const labName = id => LAB_TESTS.flatMap(g => g[1]).find(t => t[0] === id)?.[1] || id;

const ICD = [
  ['J02.9', 'Ostre zapalenie gardła, nieokreślone'], ['J03.0', 'Paciorkowcowe zapalenie migdałków'], ['J03.9', 'Ostre zapalenie migdałków, nieokreślone'],
  ['J06.9', 'Ostre zakażenie górnych dróg oddechowych, nieokreślone'], ['B27.9', 'Mononukleoza zakaźna, nieokreślona'], ['J36', 'Ropień okołomigdałkowy'],
  ['N30.0', 'Ostre zapalenie pęcherza moczowego'], ['N39.0', 'Zakażenie układu moczowego o nieokreślonym umiejscowieniu'], ['N10', 'Ostre odmiedniczkowe zapalenie nerek'],
  ['N76.0', 'Ostre zapalenie pochwy'], ['E06.3', 'Autoimmunologiczne zapalenie tarczycy'], ['E03.9', 'Niedoczynność tarczycy, nieokreślona'],
  ['D50.0', 'Niedokrwistość z niedoboru żelaza wtórna do utraty krwi (przewlekła)'], ['D50.9', 'Niedokrwistość z niedoboru żelaza, nieokreślona'], ['R53', 'Złe samopoczucie i zmęczenie'],
  ['I10', 'Samoistne (pierwotne) nadciśnienie'], ['E78.0', 'Czysta hipercholesterolemia'], ['E11.9', 'Cukrzyca typu 2 bez powikłań'],
  ['L25.9', 'Kontaktowe zapalenie skóry, nieokreślone'], ['M54.5', 'Ból krzyża'], ['R05', 'Kaszel'],
];
const icdName = code => ICD.find(c => c[0] === code)?.[1] || '';

const ZLA_CODES = [
  ['', 'bez kodu'], ['A', 'A — ponowna niezdolność po przerwie do 60 dni (ta sama choroba)'], ['B', 'B — niezdolność w okresie ciąży'],
  ['C', 'C — spowodowana nadużyciem alkoholu'], ['D', 'D — gruźlica'], ['E', 'E — choroba zakaźna o okresie wylęgania powyżej 14 dni'],
];

// ---------- visit reasons and their scripted consultations ----------
// Tokens in script text: {dr} doctor's name, {spec} internista/internistka, {exam} how the throat was seen, {type} visit type.
// Line `ai` events: facts, score (item values), ddx (likelihood 0–3), ask (suggested questions now asked),
// flags (red flags checked), alerts (questionnaire vs. conversation mismatches), plan, docs.
const SCENARIOS = {
  gardlo: {
    id: 'gardlo', label: 'Ból gardła i gorączka', hint: 'Angina, przeziębienie, infekcja', icon: 'thermo',
    prefer: 'video', preferWhy: 'lekarz obejrzy gardło przez kamerę',
    questions: [
      { id: 'since', q: 'Od kiedy masz objawy?', type: 'one', opts: ['Od dziś', '1–2 dni', '3–5 dni', 'Ponad tydzień'], def: '3–5 dni' },
      { id: 'temp', q: 'Najwyższa zmierzona temperatura', type: 'one', opts: ['Nie mierzono', 'Poniżej 38°C', '38–39°C', 'Powyżej 39°C'], def: '38–39°C' },
      { id: 'sym', q: 'Co jeszcze Ci dolega?', type: 'many', opts: ['Ból przy przełykaniu', 'Kaszel', 'Katar', 'Chrypka', 'Ból głowy', 'Bóle mięśni', 'Wysypka'], def: ['Ból przy przełykaniu', 'Ból głowy'] },
      { id: 'spots', q: 'Czy widzisz białe naloty na migdałkach?', type: 'one', opts: ['Tak', 'Nie', 'Nie wiem'], def: 'Nie wiem', help: 'Spójrz w lustro, świecąc latarką z telefonu.' },
      { id: 'meds', q: 'Co już przyjmujesz na te objawy?', type: 'text', def: 'Ibuprofen 400 mg, 2 razy dziennie' },
    ],
    alarms: ['Duszność albo świszczący oddech', 'Nie mogę przełknąć śliny, ślinię się', 'Nie mogę szeroko otworzyć ust', 'Sztywny kark albo wysypka, która nie blednie pod naciskiem szklanki'],

    ai(a, pt) {
      const fever = /38–39|Powyżej/.test(a.temp), low = /Poniżej/.test(a.temp);
      const sym = a.sym || [], cough = sym.includes('Kaszel') || sym.includes('Katar');
      const age = ageOf(pt.born);
      return {
        facts: [
          ['Objawy', `Ból gardła: ${a.since.toLowerCase()}`, 'ankieta'],
          fever || low ? ['Objawy', `Temperatura (ankieta): ${a.temp}`, 'ankieta'] : null,
          sym.length ? ['Objawy', `Zgłoszone: ${sym.join(', ').toLowerCase()}`, 'ankieta'] : null,
          a.spots === 'Tak' ? ['Objawy', 'Pacjentka widzi naloty na migdałkach', 'ankieta'] : null,
          a.meds ? ['Leki', `Doraźnie: ${a.meds}`, 'ankieta'] : null,
        ].filter(Boolean),
        score: {
          title: 'Skala Centora/McIsaaca', kind: 'sum',
          items: [
            { id: 'fever', label: 'Gorączka > 38°C', val: fever ? 1 : low ? 0 : null, src: fever || low ? 'ankieta' : null },
            { id: 'cough', label: 'Brak kaszlu', val: cough ? 0 : 1, src: 'ankieta' },
            { id: 'nodes', label: 'Bolesne węzły szyjne przednie', val: null },
            { id: 'exudate', label: 'Obrzęk lub naloty na migdałkach', val: a.spots === 'Tak' ? 1 : null, src: a.spots === 'Tak' ? 'ankieta' : null },
            { id: 'age', label: `Wiek ${age} l. (3–14: +1, 15–44: 0, ≥45: −1)`, val: age < 15 ? 1 : age < 45 ? 0 : -1, src: 'karta' },
          ],
          interpret(total, missing) {
            const tail = missing.length ? ` Brakuje: ${missing.join(', ').toLowerCase()}.` : '';
            if (total >= 4) return { tone: 'warn', text: 'Wysokie ryzyko zakażenia paciorkowcowego (ok. 50%). Szybki test antygenowy lub leczenie empiryczne.' + tail };
            if (total >= 2) return { tone: 'mid', text: 'Ryzyko pośrednie — wskazany szybki test antygenowy (RADT).' + tail };
            return { tone: 'ok', text: 'Niskie ryzyko — leczenie objawowe, bez antybiotyku.' + tail };
          },
        },
        ddx: [
          { id: 'strep', name: 'Paciorkowcowe zapalenie migdałków', icd: 'J03.0', lvl: fever && !cough ? 2 : 1, why: 'Gorączka, brak kaszlu, bolesne węzły i naloty — wysoki wynik w skali McIsaaca.' },
          { id: 'viral', name: 'Wirusowe zapalenie gardła', icd: 'J02.9', lvl: cough ? 3 : 2, why: 'Najczęstsza przyczyna bólu gardła u dorosłych; przemawiają za nią kaszel, katar i chrypka.' },
          { id: 'mono', name: 'Mononukleoza zakaźna', icd: 'B27.9', lvl: 1, why: 'Rozważ przy braku poprawy po 48–72 h. Wysypka po amoksycylinie bywa z nią związana.' },
          { id: 'abscess', name: 'Ropień okołomigdałkowy', icd: 'J36', lvl: 1, why: 'Wyklucza go brak szczękościsku, ślinotoku i jednostronnego obrzęku.' },
        ],
        qs: [
          { id: 'cough', text: 'Kaszel lub katar? Ich brak to +1 w skali McIsaaca' },
          { id: 'nodes', text: 'Bolesne, powiększone węzły chłonne szyjne przednie?' },
          { id: 'look', text: '{look}' },
          { id: 'red', text: 'Wyklucz objawy alarmowe: duszność, ślinotok, szczękościsk' },
          { id: 'allergy', text: 'Doprecyzuj reakcję na penicylinę: natychmiastowa czy opóźniona?' },
          { id: 'contact', text: 'Kontakt z osobami chorymi?' },
          { id: 'meds', text: 'Leki przyjmowane na stałe' },
          { id: 'preg', text: 'Czy możliwa jest ciąża? Ma znaczenie dla leku i kodu zwolnienia' },
        ],
        flags: [
          { id: 'airway', label: 'Duszność, świst krtaniowy' },
          { id: 'saliva', label: 'Ślinotok, nie przełyka śliny' },
          { id: 'trismus', label: 'Szczękościsk (ropień okołomigdałkowy)' },
          { id: 'sepsis', label: 'Sztywność karku, wysypka krwotoczna' },
        ],
      };
    },
    brief(a, pt) {
      const fever = /38–39|Powyżej/.test(a.temp), cough = (a.sym || []).includes('Kaszel');
      return {
        line: `${a.since}, ${fever ? 'gorączka ' + a.temp : 'bez gorączki'}, ${cough ? 'kaszel' : 'bez kaszlu'}`,
        summary: `Pacjentka ${ageOf(pt.born)} l. zgłasza ból gardła (${a.since.toLowerCase()})${fever ? ` z gorączką ${a.temp}` : a.temp === 'Nie mierzono' ? ', temperatury nie mierzyła' : ', bez gorączki'}${cough ? ' i kaszel' : ', bez kaszlu'}. ${a.spots === 'Tak' ? 'Widzi naloty na migdałkach.' : a.spots === 'Nie' ? 'Nalotów nie widzi.' : 'Nie wie, czy ma naloty.'} W ankiecie zaprzeczyła objawom alarmowym.`,
        attention: ['Alergia na amoksycylinę (opóźniona wysypka, 2015) — zawęża wybór antybiotyku', 'Na stałe: lewotyroksyna 75 µg'],
        todo: ['Obejrzeć migdałki (naloty, obrzęk, symetria)', 'Węzły chłonne szyjne', 'Typ reakcji alergicznej'],
      };
    },
    script: [
      { who: 'd', t: 'Dzień dobry, {dr}, {spec}. Słyszy mnie Pani dobrze?' },
      { who: 'p', t: 'Dzień dobry, tak, wszystko słyszę.' },
      { who: 'd', t: 'Widzę w ankiecie, że boli Panią gardło. Proszę opowiedzieć, jak to się zaczęło.' },
      { who: 'p', t: 'W sobotę wieczorem zaczęło drapać, a w niedzielę miałam już 38,7. Najgorzej boli przy przełykaniu.', hl: ['38,7', 'boli przy przełykaniu'],
        ai: { facts: [['Objawy', 'Ból gardła od 3 dni, nasilony przy przełykaniu'], ['Objawy', 'Gorączka do 38,7°C']], score: { fever: 1 }, ddx: { strep: 2 },
          alerts: [a => /Poniżej|Nie mierzono/.test(a.temp) && `Ankieta: „${a.temp}”, w rozmowie 38,7°C. Przyjęto wartość z rozmowy.`] } },
      { who: 'd', t: 'Czy jest kaszel albo katar?', ai: { ask: ['cough'] } },
      { who: 'p', t: 'Nie, kaszlu w ogóle nie mam. Kataru też nie.', hl: ['kaszlu w ogóle nie mam'],
        ai: { facts: [['Objawy', 'Bez kaszlu i kataru']], score: { cough: 1 }, ddx: { viral: 1, strep: 2 },
          alerts: [a => (a.sym || []).includes('Kaszel') && 'Ankieta: zaznaczony kaszel. W rozmowie pacjentka mu zaprzecza — wyjaśnij przed oceną skali.'] } },
      { who: 'd', t: 'A czy wyczuwa Pani bolesne guzki z przodu szyi, pod żuchwą?', ai: { ask: ['nodes'] } },
      { who: 'p', t: 'Tak, po obu stronach. Bolą, jak dotykam.', hl: ['po obu stronach'],
        ai: { facts: [['Badanie', 'Bolesne węzły chłonne szyjne przednie, obustronnie (samobadanie)']], score: { nodes: 1 }, ddx: { strep: 3 } } },
      { who: 'd', t: '{lookLine}', hl: ['z białym nalotem'],
        ai: { ask: ['look'], facts: [['Badanie', 'Migdałki powiększone, przekrwione, z białym nalotem ({exam})']], score: { exudate: 1 }, ddx: { strep: 3, viral: 1 },
          alerts: [a => a.spots === 'Nie' && 'Ankieta: pacjentka nie widziała nalotów — w badaniu naloty obecne.'] } },
      { who: 'p', t: 'To coś poważnego?' },
      { who: 'd', t: 'Wygląda na anginę bakteryjną, czyli paciorkowcowe zapalenie migdałków. Czy ktoś w domu albo w pracy ostatnio chorował?', ai: { ask: ['contact'] } },
      { who: 'p', t: 'Synek tydzień temu przyniósł coś podobnego z przedszkola.', hl: ['z przedszkola'], ai: { facts: [['Wywiad', 'Kontakt z chorym dzieckiem (przedszkole) ok. tydzień temu']] } },
      { who: 'd', t: 'Czy ma Pani kłopot z oddychaniem, z przełknięciem śliny albo z otwarciem ust?', ai: { ask: ['red'] } },
      { who: 'p', t: 'Nie. Przełykam z bólem, ale oddycham normalnie i usta otwieram bez problemu.', hl: ['oddycham normalnie'],
        ai: { flags: { airway: 'ok', saliva: 'ok', trismus: 'ok' }, ddx: { abscess: 0 }, facts: [['Badanie', 'Bez duszności, ślinotoku i szczękościsku']] } },
      { who: 'd', t: 'W karcie mam uczulenie na penicylinę. Jak wyglądała ta reakcja?', ai: { ask: ['allergy'] } },
      { who: 'p', t: 'Kilka lat temu, po paru dniach brania amoksycyliny, wyszła mi swędząca wysypka. Bez duszności, bez obrzęku.', hl: ['po paru dniach', 'Bez duszności, bez obrzęku'],
        ai: { facts: [['Alergie', 'Amoksycylina: opóźniona wysypka (ok. 3. doba), bez cech anafilaksji']], plan: true } },
      { who: 'd', t: 'A jakie leki bierze Pani na stałe?', ai: { ask: ['meds'] } },
      { who: 'p', t: 'Euthyrox 75 rano, a teraz na gorączkę ibuprofen.', hl: ['Euthyrox 75'], ai: { facts: [['Leki', 'Lewotyroksyna 75 µg rano; ibuprofen 400 mg doraźnie']] } },
      { who: 'd', t: 'Dobrze. Wystawię antybiotyk bezpieczny przy Pani uczuleniu, na 10 dni. Proszę wziąć całe opakowanie, nawet jeśli po dwóch dniach będzie lepiej. Na ból i gorączkę dalej ibuprofen albo paracetamol.' },
      { who: 'd', t: 'Gdyby pojawiła się duszność, ślinotok albo nie da się otworzyć ust — proszę od razu jechać na SOR.' },
      { who: 'p', t: 'Rozumiem. A zwolnienie? Pracuję w biurze.', ai: { docs: ['zla'] } },
      { who: 'd', t: 'Wystawię zwolnienie na pięć dni. Receptę i zwolnienie zobaczy Pani w aplikacji, kod recepty przyjdzie też SMS-em.' },
      { who: 'p', t: 'Dziękuję bardzo. Do widzenia!' },
      { who: 'd', t: 'Do widzenia, zdrowia życzę.' },
    ],
    plan: {
      title: 'Paciorkowcowe zapalenie migdałków u pacjentki z opóźnioną alergią na amoksycylinę',
      rx: [
        { drug: 'cefurox', dose: 1, freq: 2, days: 10, extra: 'co 12 godzin, po posiłku', main: true,
          why: 'Cefalosporyna o innym łańcuchu bocznym R1 niż amoksycylina — niskie ryzyko reakcji krzyżowej przy alergii opóźnionej. Kurs 10 dni.' },
        { drug: 'clari', dose: 1, freq: 2, days: 10, extra: 'co 12 godzin',
          why: 'Alternatywa, gdy typ reakcji na penicylinę jest niepewny. W Polsce częsta oporność paciorkowców na makrolidy.' },
      ],
      avoid: ['Penicyliny (fenoksymetylopenicylina, amoksycylina) — alergia w wywiadzie', 'Cefadroksyl i cefaleksyna — ten sam łańcuch boczny R1 co amoksycylina'],
      zla: { days: 5, mode: '2', why: 'Gorączka i ból przy przełykaniu, praca biurowa' },
      ref: null,
      expect: { antibiotic: 10 },
    },
    note: {
      wywiad: { after: 17, text: 'Od 3 dni ból gardła nasilający się przy przełykaniu, gorączka do 38,7°C. Bez kaszlu i kataru. Bolesne węzły chłonne szyjne obustronnie. Kontakt z chorym dzieckiem (przedszkole) ok. tydzień temu. Zaprzecza duszności, ślinotokowi i szczękościskowi.\nAlergia: amoksycylina — opóźniona wysypka skórna (2015), bez cech anafilaksji.\nChoroby przewlekłe: choroba Hashimoto. Leki: lewotyroksyna 75 µg 1×1 rano, ibuprofen 400 mg doraźnie.' },
      badanie: { after: 13, text: 'Teleporada ({type}). Stan ogólny dobry, mowa wyraźna, oddech spokojny, bez duszności. Migdałki podniebienne powiększone, przekrwione, z białym nalotem ({exam}). Węzły chłonne szyjne przednie bolesne (samobadanie pacjentki).' },
      rozpoznanie: { after: 10, text: 'J03.0 Paciorkowcowe zapalenie migdałków (skala McIsaaca: 4 pkt).' },
      zalecenia: { after: 21, text: 'Antybiotyk przez 10 dni zgodnie z e-receptą — przyjąć cały kurs. Leczenie objawowe: ibuprofen 400 mg do 3× dziennie lub paracetamol do 4 g na dobę. Nawadnianie, odpoczynek. Zwolnienie lekarskie 5 dni.\nPilnie SOR w razie duszności, ślinotoku lub szczękościsku. Ponowna konsultacja, jeśli brak poprawy po 48–72 h.' },
    },
  },

  pecherz: {
    id: 'pecherz', label: 'Pieczenie przy oddawaniu moczu', hint: 'Objawy zapalenia pęcherza', icon: 'drop',
    prefer: 'phone', preferWhy: 'wystarczy rozmowa',
    questions: [
      { id: 'since', q: 'Od kiedy masz objawy?', type: 'one', opts: ['Od dziś', '1–2 dni', '3–5 dni', 'Ponad tydzień'], def: '1–2 dni' },
      { id: 'sym', q: 'Zaznacz objawy', type: 'many', opts: ['Pieczenie przy oddawaniu moczu', 'Częste oddawanie moczu', 'Parcie na pęcherz', 'Ból podbrzusza', 'Krew w moczu', 'Upławy lub świąd'], def: ['Pieczenie przy oddawaniu moczu', 'Częste oddawanie moczu', 'Parcie na pęcherz'] },
      { id: 'fever', q: 'Czy masz gorączkę?', type: 'one', opts: ['Nie', 'Stan podgorączkowy', 'Powyżej 38°C'], def: 'Nie' },
      { id: 'flank', q: 'Czy boli Cię w okolicy lędźwiowej, z boku pleców?', type: 'one', opts: ['Nie', 'Tak'], def: 'Nie' },
      { id: 'preg', q: 'Czy możesz być w ciąży?', type: 'one', opts: ['Nie', 'Tak', 'Nie wiem'], def: 'Nie' },
      { id: 'recur', q: 'Ile razy w ostatnim roku miałaś takie objawy?', type: 'one', opts: ['Pierwszy raz', '1–2 razy', '3 i więcej'], def: 'Pierwszy raz' },
    ],
    alarms: ['Wysoka gorączka z dreszczami i wymiotami', 'Silny ból w boku promieniujący do pachwiny', 'Jestem w ciąży i mam ból brzucha lub krwawienie'],

    ai(a, pt) {
      const sym = a.sym || [], age = ageOf(pt.born);
      const v = (cond, bad) => (cond ? 1 : bad ? 0 : null);
      return {
        facts: [
          ['Objawy', `${sym.join(', ')} — ${a.since.toLowerCase()}`, 'ankieta'],
          a.fever !== 'Nie' ? ['Objawy', `Temperatura: ${a.fever.toLowerCase()}`, 'ankieta'] : null,
          a.flank === 'Tak' ? ['Objawy', 'Ból w okolicy lędźwiowej', 'ankieta'] : null,
        ].filter(Boolean),
        score: {
          title: 'Kryteria niepowikłanego zapalenia pęcherza', kind: 'all',
          items: [
            { id: 'sex', label: 'Kobieta przed menopauzą', val: pt.female && age >= 16 && age <= 50 ? 1 : 0, src: 'karta' },
            { id: 'preg', label: 'Ciąża wykluczona', val: v(a.preg === 'Nie', a.preg === 'Tak'), src: a.preg === 'Nie wiem' ? null : 'ankieta' },
            { id: 'fever', label: 'Bez gorączki > 38°C', val: v(a.fever !== 'Powyżej 38°C', true), src: 'ankieta' },
            { id: 'flank', label: 'Bez bólu w okolicy lędźwiowej', val: v(a.flank === 'Nie', true), src: 'ankieta' },
            { id: 'recur', label: 'Bez nawrotów (mniej niż 3 w roku)', val: v(a.recur !== '3 i więcej', true), src: 'ankieta' },
          ],
          interpret(total, missing, failed) {
            if (failed.length) return { tone: 'warn', text: `Nie spełnia kryteriów (${failed.join(', ').toLowerCase()}). Zleć badanie ogólne i posiew moczu przed leczeniem.` };
            if (missing.length) return { tone: 'mid', text: `Brakuje: ${missing.join(', ').toLowerCase()}.` };
            return { tone: 'ok', text: 'Niepowikłane zapalenie pęcherza — leczenie empiryczne bez badania moczu jest dopuszczalne.' };
          },
        },
        ddx: [
          { id: 'cyst', name: 'Ostre zapalenie pęcherza moczowego', icd: 'N30.0', lvl: 2, why: 'Dyzuria, częstomocz i parcie bez upławów — prawdopodobieństwo powyżej 90%.' },
          { id: 'pyelo', name: 'Odmiedniczkowe zapalenie nerek', icd: 'N10', lvl: a.fever === 'Powyżej 38°C' || a.flank === 'Tak' ? 2 : 1, why: 'Przemawiają za nim gorączka, dreszcze i ból w okolicy lędźwiowej.' },
          { id: 'vag', name: 'Zapalenie pochwy', icd: 'N76.0', lvl: sym.includes('Upławy lub świąd') ? 2 : 1, why: 'Upławy i świąd zamiast częstomoczu wskazują raczej na pochwę.' },
          { id: 'sti', name: 'Zapalenie cewki moczowej (choroba przenoszona drogą płciową)', icd: 'N34.1', lvl: 1, why: 'Rozważ przy nowym partnerze lub braku poprawy po leczeniu.' },
        ],
        qs: [
          { id: 'pyelo', text: 'Gorączka, dreszcze, ból w okolicy lędźwiowej?' },
          { id: 'blood', text: 'Krwiomocz, zmiana wyglądu moczu?' },
          { id: 'preg', text: 'Czy możliwa jest ciąża? Zmienia wybór leku' },
          { id: 'vag', text: 'Upławy, świąd, nowe podrażnienie?' },
          { id: 'recur', text: 'Ile epizodów w ostatnim roku?' },
          { id: 'meds', text: 'Leki przyjmowane na stałe' },
          { id: 'dm', text: 'Cukrzyca, kamica, choroby nerek? (postać powikłana)' },
        ],
        flags: [
          { id: 'pyelo', label: 'Gorączka, ból w okolicy lędźwiowej' },
          { id: 'preg', label: 'Ciąża' },
          { id: 'sepsis', label: 'Dreszcze, wymioty, osłabienie (urosepsa)' },
        ],
      };
    },
    brief(a, pt) {
      return {
        line: `${a.since}, ${a.fever === 'Nie' ? 'bez gorączki' : a.fever.toLowerCase()}, ${a.flank === 'Nie' ? 'bez bólu lędźwiowego' : 'ból lędźwiowy'}`,
        summary: `Pacjentka ${ageOf(pt.born)} l. od ${a.since === 'Od dziś' ? 'dziś' : a.since.toLowerCase()} zgłasza: ${(a.sym || []).join(', ').toLowerCase()}. ${a.fever === 'Nie' ? 'Bez gorączki' : 'Temperatura: ' + a.fever.toLowerCase()}, ${a.flank === 'Nie' ? 'bez bólu w okolicy lędźwiowej' : 'z bólem w okolicy lędźwiowej'}. Ciąża: ${a.preg.toLowerCase()}. Epizody w ostatnim roku: ${a.recur.toLowerCase()}.`,
        attention: ['Alergia na amoksycylinę (opóźniona wysypka, 2015)', 'Na stałe: lewotyroksyna 75 µg'],
        todo: ['Potwierdzić brak cech odmiedniczkowego zapalenia nerek', 'Upławy / świąd', 'Choroby współistniejące (cukrzyca, kamica)'],
      };
    },
    script: [
      { who: 'd', t: 'Dzień dobry, {dr}, {spec}. Słyszymy się dobrze?' },
      { who: 'p', t: 'Tak, dzień dobry. Od wczoraj strasznie piecze mnie przy oddawaniu moczu i co chwilę biegam do toalety.', hl: ['piecze mnie przy oddawaniu moczu', 'co chwilę'],
        ai: { facts: [['Objawy', 'Dyzuria i częstomocz od 1 doby']], ddx: { cyst: 3 } } },
      { who: 'd', t: 'Czy ma Pani gorączkę, dreszcze albo ból w okolicy lędźwi, z boku pleców?', ai: { ask: ['pyelo'] } },
      { who: 'p', t: 'Nie, temperatura w normie, plecy nie bolą. Tylko podbrzusze trochę ciągnie.', hl: ['plecy nie bolą', 'podbrzusze'],
        ai: { facts: [['Objawy', 'Bez gorączki i bólu w okolicy lędźwiowej'], ['Objawy', 'Ból podbrzusza']], score: { fever: 1, flank: 1 }, flags: { pyelo: 'ok' }, ddx: { pyelo: 0 },
          alerts: [a => a.fever === 'Powyżej 38°C' && 'Ankieta: gorączka powyżej 38°C. W rozmowie pacjentka zaprzecza — zmierz temperaturę przed wyborem leczenia.'] } },
      { who: 'd', t: 'Czy w moczu była krew albo zmienił się jego zapach?', ai: { ask: ['blood'] } },
      { who: 'p', t: 'Mocz jest trochę mętny, ale krwi nie widziałam.', hl: ['mętny'],
        ai: { facts: [['Objawy', 'Mocz mętny, bez widocznego krwiomoczu']], alerts: [a => (a.sym || []).includes('Krew w moczu') && 'Ankieta: zaznaczona krew w moczu. W rozmowie pacjentka zaprzecza — rozważ badanie ogólne moczu.'] } },
      { who: 'd', t: 'Czy jest możliwość, że jest Pani w ciąży?', ai: { ask: ['preg'] } },
      { who: 'p', t: 'Nie, na pewno nie.', ai: { score: { preg: 1 }, flags: { preg: 'ok' }, facts: [['Wywiad', 'Ciąża wykluczona w wywiadzie']] } },
      { who: 'd', t: 'A czy pojawiły się upławy, świąd albo podrażnienie?', ai: { ask: ['vag'] } },
      { who: 'p', t: 'Nie, nic takiego.', ai: { facts: [['Objawy', 'Bez upławów i świądu']], ddx: { vag: 0 } } },
      { who: 'd', t: 'Ile razy w ostatnim roku miała Pani podobne objawy?', ai: { ask: ['recur'] } },
      { who: 'p', t: 'To pierwszy raz od jakichś dwóch lat.', hl: ['pierwszy raz'], ai: { score: { recur: 1 }, facts: [['Wywiad', 'Pierwszy epizod od ok. 2 lat — bez nawrotów']] } },
      { who: 'd', t: 'Czy bierze Pani jakieś leki na stałe?', ai: { ask: ['meds'] } },
      { who: 'p', t: 'Tylko Euthyrox 75.', ai: { facts: [['Leki', 'Lewotyroksyna 75 µg']], plan: true } },
      { who: 'd', t: 'To wygląda na niepowikłane zapalenie pęcherza. Wystawię fosfomycynę — jedną saszetkę rozpuszcza się w wodzie i wypija wieczorem, po opróżnieniu pęcherza. Proszę dużo pić.' },
      { who: 'd', t: 'Dam też skierowanie na badanie moczu z posiewem. Jeśli za 2–3 dni nie będzie lepiej albo pojawi się gorączka lub ból pleców — proszę je zrobić i od razu się odezwać.', ai: { docs: ['ref'] } },
      { who: 'p', t: 'Dobrze, dziękuję bardzo. Do widzenia!' },
      { who: 'd', t: 'Do widzenia, zdrowia życzę.' },
    ],
    plan: {
      title: 'Ostre, niepowikłane zapalenie pęcherza moczowego',
      rx: [
        { drug: 'fosfo', dose: 1, freq: 1, days: 1, extra: 'wieczorem po opróżnieniu pęcherza', main: true, why: 'Lek pierwszego wyboru w niepowikłanym zapaleniu pęcherza — jedna dawka.' },
        { drug: 'nitro', dose: 1, freq: 2, days: 5, extra: 'co 12 godzin, z posiłkiem', why: 'Alternatywa: 5 dni leczenia.' },
      ],
      avoid: ['Fluorochinolony — nie stosuj w niepowikłanym zapaleniu pęcherza (ryzyko poważnych działań niepożądanych)'],
      zla: null,
      ref: { tests: ['ua', 'ucult'], note: 'Wykonać, jeśli brak poprawy po 48–72 h lub pojawi się gorączka albo ból w okolicy lędźwiowej.', why: 'Zabezpieczenie na wypadek braku poprawy' },
      expect: { fosfo: 1 },
    },
    note: {
      wywiad: { after: 13, text: 'Od 1 doby pieczenie przy oddawaniu moczu, częstomocz, parcie; ból podbrzusza. Mocz mętny, bez krwiomoczu. Bez gorączki, dreszczy i bólu w okolicy lędźwiowej. Bez upławów i świądu. Ciąża wykluczona w wywiadzie. Pierwszy epizod od ok. 2 lat.\nChoroby przewlekłe: choroba Hashimoto (lewotyroksyna 75 µg). Alergia: amoksycylina (wysypka).' },
      badanie: { after: 3, text: 'Teleporada ({type}) — bez badania przedmiotowego. Kontakt logiczny, stan ogólny dobry, bez cech odwodnienia w wywiadzie.' },
      rozpoznanie: { after: 11, text: 'N30.0 Ostre zapalenie pęcherza moczowego, postać niepowikłana.' },
      zalecenia: { after: 15, text: 'Leczenie zgodnie z e-receptą. Zwiększona podaż płynów. Skierowanie: badanie ogólne moczu z posiewem — wykonać, jeśli brak poprawy po 48–72 h lub pojawi się gorączka albo ból w okolicy lędźwiowej; wtedy ponowna konsultacja.' },
    },
  },

  leki: {
    id: 'leki', label: 'Recepta na stałe leki', hint: 'Kontynuacja leczenia, wyniki badań', icon: 'rx',
    prefer: 'phone', preferWhy: 'wystarczy rozmowa',
    questions: [
      { id: 'which', q: 'Których leków dotyczy recepta?', type: 'many', opts: ['Lewotyroksyna 75 µg', 'Inny lek'], def: ['Lewotyroksyna 75 µg'] },
      { id: 'left', q: 'Na ile dni zostało Ci leku?', type: 'one', opts: ['Mniej niż tydzień', '1–2 tygodnie', 'Ponad 2 tygodnie'], def: 'Mniej niż tydzień' },
      { id: 'test', q: 'Kiedy było ostatnie badanie TSH?', type: 'one', opts: ['W ciągu 6 miesięcy', '6–12 miesięcy temu', 'Ponad rok temu / nie pamiętam'], def: '6–12 miesięcy temu' },
      { id: 'new', q: 'Czy pojawiły się nowe objawy?', type: 'many', opts: ['Zmęczenie', 'Kołatanie serca', 'Przyrost masy ciała', 'Wypadanie włosów', 'Obfite miesiączki', 'Brak nowych objawów'], def: ['Zmęczenie', 'Wypadanie włosów'] },
      { id: 'files', q: 'Dołącz wyniki badań', type: 'files', def: ['f-tsh'] },
    ],
    alarms: ['Ból w klatce piersiowej', 'Kołatanie serca z omdleniem lub dusznością', 'Bardzo obfite krwawienie, zasłabnięcia'],

    ai(a, pt) {
      const file = (pt.files || []).find(f => f.id === 'f-tsh');
      const attached = (a.files || []).includes('f-tsh');
      const fresh = file ? monthsSince(file.date) < 6 : false;
      const sym = (a.new || []).filter(s => s !== 'Brak nowych objawów');
      return {
        facts: [
          ['Leki', `Recepta: ${(a.which || []).join(', ')} · zapas: ${a.left.toLowerCase()}`, 'ankieta'],
          sym.length ? ['Objawy', `Nowe objawy: ${sym.join(', ').toLowerCase()}`, 'ankieta'] : null,
          attached ? ['Badania', `TSH 2,1 mIU/l, fT4 15,8 pmol/l (${fmtDMY(fromIso(file.date))}) — w normie`, 'plik'] : null,
        ].filter(Boolean),
        score: {
          title: 'Kontrola leczenia lewotyroksyną', kind: 'all',
          items: [
            { id: 'dosing', label: 'Prawidłowe przyjmowanie (na czczo, 30–60 min przed posiłkiem)', val: null },
            { id: 'tsh', label: 'TSH w zakresie referencyjnym', val: attached ? 1 : null, src: attached ? 'plik' : null },
            { id: 'fresh', label: 'Wynik TSH aktualny (do 6 miesięcy)', val: attached ? (fresh ? 1 : 0) : null, src: attached ? 'plik' : null },
            { id: 'inter', label: 'Bez suplementów i leków osłabiających wchłanianie', val: null },
          ],
          interpret(total, missing, failed) {
            if (failed.length && missing.length === 0) return { tone: 'mid', text: 'Leczenie wyrównane, ale ostatnie TSH ma ponad 6 miesięcy — zleć kontrolne TSH i kontynuuj dawkę.' };
            if (missing.length) return { tone: 'mid', text: `Brakuje: ${missing.join(', ').toLowerCase()}.` };
            return { tone: 'ok', text: 'Leczenie wyrównane — kontynuuj dotychczasową dawkę.' };
          },
        },
        ddx: [
          { id: 'anemia', name: 'Niedokrwistość z niedoboru żelaza', icd: 'D50.0', lvl: (a.new || []).includes('Obfite miesiączki') ? 2 : 1, why: 'Zmęczenie, obfite miesiączki, wypadanie włosów, duszność wysiłkowa.' },
          { id: 'hypo', name: 'Niewyrównana niedoczynność tarczycy', icd: 'E03.9', lvl: 1, why: 'TSH w normie w marcu; zmęczenie jest niespecyficzne — zleć kontrolne TSH.' },
          { id: 'sleep', name: 'Zaburzenia snu lub obniżony nastrój', icd: 'R53', lvl: 1, why: 'Częsta przyczyna przewlekłego zmęczenia — zapytaj o sen i nastrój.' },
        ],
        qs: [
          { id: 'dose', text: 'Sposób przyjmowania lewotyroksyny (na czczo?)' },
          { id: 'tsh', text: 'Data i wynik ostatniego TSH' },
          { id: 'sym', text: 'Masa ciała, włosy, miesiączki' },
          { id: 'supp', text: 'Suplementy: żelazo, wapń, magnez (odstęp od leku)' },
          { id: 'heart', text: 'Kołatania serca, duszność, zawroty głowy' },
          { id: 'sleep', text: 'Sen i nastrój (różnicowanie zmęczenia)' },
        ],
        flags: [
          { id: 'chest', label: 'Ból w klatce piersiowej' },
          { id: 'palp', label: 'Kołatania z omdleniem lub dusznością' },
          { id: 'bleed', label: 'Bardzo obfite krwawienie, omdlenia' },
        ],
      };
    },
    brief(a, pt) {
      const sym = (a.new || []).filter(s => s !== 'Brak nowych objawów');
      return {
        line: `lewotyroksyna 75 µg, zapas: ${a.left.toLowerCase()}${sym.length ? ' · ' + sym.join(', ').toLowerCase() : ''}`,
        summary: `Pacjentka ${ageOf(pt.born)} l. z chorobą Hashimoto prosi o receptę na ${(a.which || []).join(', ').toLowerCase()} (zapas: ${a.left.toLowerCase()}). Ostatnie TSH: ${a.test.toLowerCase()}${(a.files || []).includes('f-tsh') ? ' — wynik dołączony (2,1 mIU/l)' : ''}. ${sym.length ? 'Nowe objawy: ' + sym.join(', ').toLowerCase() + '.' : 'Bez nowych objawów.'}`,
        attention: ['Ostatnie TSH ma ponad 6 miesięcy', sym.length ? 'Nowe objawy wymagają różnicowania' : null, 'Alergia na amoksycylinę'].filter(Boolean),
        todo: ['Sposób przyjmowania leku', 'Suplementy (żelazo, wapń)', 'Miesiączki i inne objawy niedoboru żelaza'],
      };
    },
    script: [
      { who: 'd', t: 'Dzień dobry, {dr}. Widzę, że chodzi o receptę na Euthyrox?' },
      { who: 'p', t: 'Dzień dobry. Tak, kończy mi się, zostało może na pięć dni. I od jakiegoś czasu jestem ciągle zmęczona.', hl: ['na pięć dni', 'ciągle zmęczona'],
        ai: { facts: [['Leki', 'Zapas lewotyroksyny na ok. 5 dni'], ['Objawy', 'Przewlekłe zmęczenie']] } },
      { who: 'd', t: 'Jaką dawkę Pani przyjmuje i w jaki sposób?', ai: { ask: ['dose'] } },
      { who: 'p', t: '75 mikrogramów, rano, pół godziny przed śniadaniem, popijam wodą.', hl: ['pół godziny przed śniadaniem'],
        ai: { facts: [['Leki', 'Lewotyroksyna 75 µg rano na czczo, 30 min przed posiłkiem — prawidłowo']], score: { dosing: 1 } } },
      { who: 'd', t: 'Kiedy było ostatnie badanie TSH?', ai: { ask: ['tsh'] } },
      { who: 'p', t: 'W marcu. Wgrałam wynik, wyszło 2,1.', hl: ['2,1'],
        ai: { facts: [['Badania', 'Pacjentka potwierdza: TSH 2,1 mIU/l w marcu']], score: { tsh: 1 },
          alerts: [a => a.test === 'W ciągu 6 miesięcy' && 'Ankieta: TSH w ciągu 6 miesięcy — dołączony wynik ma ponad 6 miesięcy.'] } },
      { who: 'd', t: 'Od kiedy jest to zmęczenie? Czy zauważyła Pani coś jeszcze — przybieranie na wadze, wypadanie włosów, obfitsze miesiączki?', ai: { ask: ['sym'] } },
      { who: 'p', t: 'Mniej więcej od dwóch miesięcy. Miesiączki rzeczywiście mam ostatnio obfitsze, a włosy bardziej lecą.', hl: ['obfitsze', 'włosy bardziej lecą'],
        ai: { facts: [['Objawy', 'Zmęczenie od ok. 2 miesięcy'], ['Objawy', 'Obfitsze miesiączki, nasilone wypadanie włosów']], ddx: { anemia: 2 },
          alerts: [a => !(a.new || []).includes('Obfite miesiączki') && 'Ankieta: nie zaznaczono obfitych miesiączek — w rozmowie pacjentka je zgłasza.'] } },
      { who: 'd', t: 'Czy bierze Pani jakieś suplementy, na przykład żelazo albo wapń?', ai: { ask: ['supp'] } },
      { who: 'p', t: 'Nie, nic poza Euthyroxem.', ai: { facts: [['Leki', 'Bez suplementów']], score: { inter: 1 } } },
      { who: 'd', t: 'Czy zdarzają się kołatania serca, duszność przy wysiłku, zawroty głowy?', ai: { ask: ['heart'] } },
      { who: 'p', t: 'Czasem zadyszę się na schodach, ale kołatań nie mam.', hl: ['zadyszę się na schodach'],
        ai: { facts: [['Objawy', 'Niewielka duszność wysiłkowa, bez kołatań serca']], flags: { palp: 'ok', chest: 'ok' }, ddx: { anemia: 3 }, plan: true } },
      { who: 'd', t: 'Dobrze. Przedłużę Euthyrox na pół roku i dam skierowanie na morfologię, ferrytynę i TSH. Jak będą wyniki, proszę je wgrać do aplikacji — omówimy je na krótkiej wizycie kontrolnej.', ai: { docs: ['ref'] } },
      { who: 'd', t: 'Do tego czasu proszę nie zaczynać żelaza na własną rękę — najpierw zobaczymy wyniki.' },
      { who: 'p', t: 'Jasne, tak zrobię. Dziękuję!' },
      { who: 'd', t: 'Do usłyszenia.' },
    ],
    plan: {
      title: 'Kontynuacja leczenia choroby Hashimoto, diagnostyka zmęczenia',
      rx: [{ drug: 'levo75', pack: 100, dose: 1, freq: 1, days: 180, extra: 'rano na czczo, 30 min przed śniadaniem', main: true, why: 'Kontynuacja dotychczasowej dawki — ostatnie TSH w normie, pacjentka przyjmuje lek prawidłowo.' }],
      avoid: ['Nie włączaj żelaza przed wynikiem ferrytyny. Po włączeniu — odstęp co najmniej 4 h od lewotyroksyny.'],
      zla: null,
      ref: { tests: ['cbc', 'ferr', 'tsh'], note: 'Wyniki wgrać do aplikacji — wizyta kontrolna po ich otrzymaniu.', why: 'Zmęczenie, obfite miesiączki i duszność wysiłkowa: podejrzenie niedoboru żelaza; TSH sprzed ponad 6 miesięcy' },
      expect: {},
    },
    note: {
      wywiad: { after: 11, text: 'Pacjentka z chorobą Hashimoto, na lewotyroksynie 75 µg 1×1 rano na czczo (przyjmuje prawidłowo), zapas leku na ok. 5 dni. Od ok. 2 miesięcy zmęczenie, nasilone wypadanie włosów, obfitsze miesiączki; niewielka duszność wysiłkowa, bez kołatań serca. Bez suplementów. Ostatnie TSH 2,1 mIU/l (03.2026).\nAlergia: amoksycylina (wysypka).' },
      badanie: { after: 3, text: 'Teleporada ({type}) — bez badania przedmiotowego. Kontakt logiczny, stan ogólny dobry.' },
      rozpoznanie: { after: 11, text: 'E06.3 Autoimmunologiczne zapalenie tarczycy (choroba Hashimoto) — w trakcie leczenia.\nR53 Złe samopoczucie i zmęczenie — do diagnostyki, podejrzenie niedoboru żelaza.' },
      zalecenia: { after: 13, text: 'Kontynuacja lewotyroksyny 75 µg 1×1 rano na czczo — e-recepta na 180 dni. Skierowanie: morfologia, ferrytyna, TSH. Nie rozpoczynać suplementacji żelaza przed wynikami. Wizyta kontrolna po otrzymaniu wyników.' },
    },
  },
};

const NOTE_SECTIONS = [['wywiad', 'Wywiad'], ['badanie', 'Badanie'], ['rozpoznanie', 'Rozpoznanie'], ['zalecenia', 'Zalecenia']];

// ---------- today's schedule for the doctor (relative to now, re-seeded daily) ----------
const SEED_VISITS = [
  {
    patient: 'jan', at: -110, dur: 9, type: 'phone', status: 'done', reasonLabel: 'Kontynuacja leczenia nadciśnienia',
    brief: { line: 'domowe RR śr. 138/84 mmHg, okresowo ibuprofen', summary: 'Pacjent 67 l. z nadciśnieniem i hipercholesterolemią prosi o kontynuację leków. Wgrane domowe pomiary RR z 14 dni: średnio 138/84 mmHg. Okresowo bierze ibuprofen na ból kolana.', attention: ['NLPZ + inhibitor ACE (ibuprofen z peryndoprylem)', 'Wiek 65+ — przysługuje odpłatność S'], todo: [] },
    note: {
      wywiad: 'Nadciśnienie tętnicze od 2014 r., hipercholesterolemia od 2018 r. Domowe pomiary RR (14 dni): średnio 138/84 mmHg. Bez bólów w klatce piersiowej, bez obrzęków. Okresowo ibuprofen na ból kolana.',
      badanie: 'Teleporada (telefon) — bez badania przedmiotowego. Pomiary domowe jw.',
      rozpoznanie: 'I10 Samoistne (pierwotne) nadciśnienie\nE78.0 Czysta hipercholesterolemia',
      zalecenia: 'Kontynuacja: peryndopryl 5 mg rano, amlodypina 5 mg rano, atorwastatyna 20 mg wieczorem. Zamiast ibuprofenu paracetamol do 3 g na dobę. Kontrola lipidogramu i kreatyniny za 3 miesiące.',
    },
    rx: [
      { drug: 'perin', pack: 90, qty: 1, dose: 1, freq: 1, days: 90, extra: 'rano', refund: 'S' },
      { drug: 'amlo', pack: 90, qty: 1, dose: 1, freq: 1, days: 90, extra: 'rano', refund: 'S' },
      { drug: 'atorva', pack: 90, qty: 1, dose: 1, freq: 1, days: 90, extra: 'wieczorem', refund: 'S' },
    ],
    aiLog: ['Przyjęto sugestię: interakcja NLPZ + inhibitor ACE — zalecono paracetamol', 'Przyjęto sugestię: odpłatność S (pacjent 65+)', 'Zatwierdzono notatkę (3 sekcje bez zmian, 1 edytowana)'],
  },
  {
    patient: 'marta', at: -85, dur: 7, type: 'video', status: 'done', reasonLabel: 'Swędząca wysypka na przedramionach',
    brief: { line: 'od 4 dni, po zmianie płynu do prania', summary: 'Pacjentka 27 l. od 4 dni ma swędzącą, rumieniową wysypkę na przedramionach; tydzień temu zmieniła płyn do prania. Bez gorączki, bez obrzęku twarzy.', attention: [], todo: [] },
    note: {
      wywiad: 'Od 4 dni swędząca wysypka na obu przedramionach. Tydzień temu zmiana płynu do prania. Bez gorączki, duszności i obrzęku twarzy. Bez leków na stałe.',
      badanie: 'Teleporada (wideo): na przedramionach rumieniowe, lekko złuszczające się ogniska, bez pęcherzy. Twarz i błony śluzowe bez zmian.',
      rozpoznanie: 'L25.9 Kontaktowe zapalenie skóry, nieokreślone',
      zalecenia: 'Odstawić nowy płyn do prania. Mometazon krem cienką warstwą raz dziennie przez 7 dni, emolienty. Kontrola, jeśli brak poprawy po tygodniu.',
    },
    rx: [{ drug: 'momet', pack: 15, qty: 1, sig: 'cienką warstwę na zmiany raz dziennie wieczorem przez 7 dni', refund: '100%' }],
    aiLog: ['Przyjęto szkic rozpoznania L25.9', 'Zatwierdzono notatkę bez zmian'],
  },
  {
    patient: 'tomasz', at: -60, dur: 0, type: 'video', status: 'noshow', reasonLabel: 'Ból pleców w odcinku lędźwiowym',
    brief: { line: 'od 5 dni, bez promieniowania do nóg', summary: 'Pacjent 41 l. od 5 dni ma ból w odcinku lędźwiowym po dźwignięciu szafki. Bez drętwienia nóg, bez zaburzeń oddawania moczu.', attention: [], todo: [] },
  },
  {
    patient: 'krystyna', at: 50, dur: 15, type: 'video', status: 'booked', reasonLabel: 'Kontrola cukrzycy — nowy wynik HbA1c',
    brief: { line: 'HbA1c 8,1% (cel < 7%), eGFR 64', summary: 'Pacjentka 72 l. z cukrzycą typu 2 i nadciśnieniem, na metforminie 850 mg 2× dziennie i peryndoprylu. Wgrała wyniki: HbA1c 8,1% (rok temu 7,2%), eGFR 64 ml/min/1,73 m². Masa ciała +3 kg w pół roku.', attention: ['HbA1c powyżej celu — rozważ intensyfikację leczenia', 'Alergia: sulfametoksazol z trimetoprimem (pokrzywka)', 'Wiek 65+ — odpłatność S'], todo: ['Hipoglikemie?', 'Dieta, aktywność', 'Kontrola stóp i dna oka'] },
  },
  {
    patient: 'piotr', at: 90, dur: 10, type: 'phone', status: 'booked', reasonLabel: 'Omówienie wyników lipidogramu',
    brief: { line: 'LDL 4,6 mmol/l, ojciec — zawał w wieku 58 lat', summary: 'Pacjent 45 l. po badaniach z medycyny pracy: LDL 4,6 mmol/l, cholesterol całkowity 6,8 mmol/l, TG 1,9 mmol/l. Ciśnienie 132/86 mmHg. Ojciec — zawał w wieku 58 lat.', attention: ['Wywiad rodzinny: przedwczesna choroba wieńcowa', 'Oszacuj ryzyko SCORE2'], todo: ['Styl życia', 'Decyzja o statynie'] },
  },
  {
    patient: 'ola', at: 130, dur: 10, type: 'video', status: 'booked', reasonLabel: 'Kaszel od dwóch tygodni',
    brief: { line: 'suchy, 14 dni po infekcji, bez gorączki', summary: 'Pacjentka 19 l. od 14 dni ma suchy kaszel po przeziębieniu, gorszy w nocy. Bez gorączki i duszności, niepaląca.', attention: ['Kaszel napadowy z „pianiem” — wyklucz krztusiec'], todo: ['Napady kaszlu, wymioty po kaszlu', 'Świsty, astma w rodzinie'] },
  },
];

// Phrases used on the landing page and in the patient flow.
const FAQ = [
  ['Czy lekarz wystawi mi e-receptę?', 'Tak, jeśli uzna to za uzasadnione medycznie. Kod e-recepty dostaniesz SMS-em i w aplikacji — w aptece podajesz go razem z numerem PESEL.'],
  ['Czy dostanę zwolnienie lekarskie (L4)?', 'Lekarz może wystawić e-ZLA, jeśli Twój stan na to wskazuje. Zwolnienie trafia automatycznie do ZUS i pracodawcy.'],
  ['Kto podejmuje decyzje, skoro jest AI?', 'Zawsze lekarz. Asystent AI robi notatki z rozmowy i podpowiada, o co dopytać. Nie wystawia recept i niczego nie podpisuje.'],
  ['Czy rozmowa jest nagrywana?', 'Nie zapisujemy nagrań. Jeśli się zgodzisz, rozmowa jest na bieżąco zamieniana na tekst, z którego lekarz przygotowuje notatkę. Transkrypcja jest usuwana po zatwierdzeniu dokumentacji.'],
  ['Kiedy wizyta online nie wystarczy?', 'Przy bólu w klatce piersiowej, duszności, objawach udaru, utracie przytomności czy silnym krwawieniu dzwoń pod 112. Lekarz może też skierować Cię na wizytę stacjonarną.'],
  ['Ile kosztuje wizyta?', 'Wideo 99 zł, telefon 79 zł, czat 69 zł. W pakiecie firmowym wizyty są bezpłatne.'],
];
