// Gwizdek v1 — the demo club. Static dictionaries first, then seed(), which builds a whole season
// around today's date: players, calendar, attendance, matches, fees, messages. The club, people,
// opponents and phone numbers are fictional.

const CLUB = {
  name: 'UKS Iskra Wrocław',
  short: 'Iskra',
  addr: 'ul. Boiskowa 12, 54-000 Wrocław',
  account: '00 1020 0000 0000 0000 0000 0000',
  mail: 'akademia@iskra.example',
  phone: '+48 71 000 00 00',
};

const STAFF = [
  { id: 'anna', name: 'Anna Wójcik', role: 'Koordynatorka akademii', kind: 'coord', color: '#0f7b53' },
  { id: 'marek', name: 'Marek Zieliński', role: 'Trener U12 i U15 · UEFA B', kind: 'coach', color: '#2f6fe0' },
  { id: 'pawel', name: 'Paweł Kaczmarek', role: 'Trener U9 · Grassroots C', kind: 'coach', color: '#c58b00' },
  { id: 'tomasz', name: 'Tomasz Lis', role: 'Trener U17 · UEFA A', kind: 'coach', color: '#7b4fd6' },
  { id: 'ola', name: 'Aleksandra Michalak', role: 'Fizjoterapeutka', kind: 'physio', color: '#d6453d' },
];

// Who you are in each role of the demo
const ROLES = {
  coord: { user: 'anna', label: 'Koordynator', icon: 'shield' },
  coach: { user: 'marek', label: 'Trener', icon: 'whistle' },
  parent: { user: 'kasia', label: 'Rodzic', icon: 'user' },
};

// plan: [weekday (0 = Sunday), from, to, facilities]
const TEAMS = [
  { id: 'u9', cat: 'U9', n: 9, name: 'Żaki', coach: 'pawel', color: '#d99a00', fee: 160, size: 12,
    plan: [[1, '16:30', '17:30', ['orlik']], [3, '16:30', '17:30', ['orlik']]], match: [6, '10:00', 90], comp: 'Festiwal Żaków DZPN', fest: true },
  { id: 'u12', cat: 'U12', n: 12, name: 'Młodziki', coach: 'marek', color: '#2f6fe0', fee: 200, size: 16,
    plan: [[1, '17:00', '18:30', ['a1']], [3, '17:00', '18:30', ['a1']], [5, '17:00', '18:30', ['a1']]], match: [6, '11:30', 70], comp: 'I liga okręgowa Młodzik D1' },
  { id: 'u15', cat: 'U15', n: 15, name: 'Trampkarze', coach: 'marek', color: '#d6453d', fee: 220, size: 18, load: true,
    plan: [[2, '17:30', '19:00', ['a1', 'a2']], [3, '18:45', '19:45', ['gym']], [4, '17:30', '19:00', ['a1', 'a2']]], match: [0, '11:00', 80], comp: 'Liga wojewódzka Trampkarz C1' },
  { id: 'u17', cat: 'U17', n: 17, name: 'Juniorzy młodsi', coach: 'tomasz', color: '#7b4fd6', fee: 240, size: 18,
    plan: [[1, '18:45', '20:15', ['a1', 'a2']], [3, '18:45', '20:15', ['a1', 'a2']], [5, '18:45', '20:15', ['a1', 'a2']]], match: [6, '15:00', 90], comp: 'Liga wojewódzka Junior B1' },
];

const FACILITIES = [
  { id: 'a1', name: 'Boisko główne · połowa A', short: 'Boisko A1', surface: 'trawa naturalna' },
  { id: 'a2', name: 'Boisko główne · połowa B', short: 'Boisko A2', surface: 'trawa naturalna' },
  { id: 'orlik', name: 'Orlik', short: 'Orlik', surface: 'sztuczna trawa' },
  { id: 'hall', name: 'Hala sportowa', short: 'Hala', surface: 'parkiet' },
  { id: 'gym', name: 'Siłownia', short: 'Siłownia', surface: '' },
];

const OPPONENTS = [
  ['LKS Wichura Zakrzów', 'ul. Polna 3, Zakrzów'], ['AP Błyskawica Krzyki', 'ul. Sportowa 21, Wrocław'],
  ['Sparta Muchobór', 'ul. Klonowa 8, Wrocław'], ['MKS Kometa Brochów', 'ul. Kolejowa 14, Wrocław'],
  ['UKS Promień Leśnica', 'ul. Zielna 2, Wrocław'], ['Orzeł Kuźniki', 'ul. Graniczna 40, Wrocław'],
  ['KS Fala Oława', 'ul. Nadrzeczna 5, Oława'], ['AP Granit Strzegom', 'ul. Kamienna 11, Strzegom'],
];

const POS = { BR: 'Bramkarz', OB: 'Obrońca', PO: 'Pomocnik', NA: 'Napastnik' };

const ATT = {
  present: { label: 'Obecny', short: 'O', cls: 'ok' },
  late: { label: 'Spóźniony', short: 'S', cls: 'warn' },
  excused: { label: 'Usprawiedliwiony', short: 'U', cls: 'info' },
  absent: { label: 'Nieobecny', short: 'N', cls: 'bad' },
};

const SKILLS = ['Technika', 'Podania i przyjęcie', 'Gra 1 na 1', 'Rozumienie gry', 'Motoryka', 'Postawa'];

const TESTS = [
  { id: 'sp20', name: 'Sprint 20 m', unit: 's', lower: true, dec: 2 },
  { id: 'jump', name: 'Skok w dal z miejsca', unit: 'cm', dec: 0 },
  { id: 'slalom', name: 'Slalom z piłką', unit: 's', lower: true, dec: 1 },
  { id: 'jugg', name: 'Żonglerka', unit: 'odb.', dec: 0 },
  { id: 'yoyo', name: 'Yo-Yo IR1', unit: 'm', dec: 0, min: 15 },
];

const WELL = [['sleep', 'Sen'], ['fatigue', 'Zmęczenie'], ['soreness', 'Bolesność'], ['stress', 'Stres'], ['mood', 'Nastrój']];

const PHASES = [['wstep', 'Część wstępna'], ['glowna', 'Część główna'], ['koncowa', 'Część końcowa']];
const GOALS = ['Technika', 'Podania', 'Gra 1 na 1', 'Taktyka', 'Wykończenie', 'Motoryka', 'Koordynacja', 'Gra', 'Regeneracja'];

const INJ = { out: { label: 'Przerwa', cls: 'bad' }, limited: { label: 'Trening ograniczony', cls: 'warn' }, healed: { label: 'Wyleczona', cls: 'ok' } };
const PAY_METHOD = { online: 'Online w aplikacji', przelew: 'Przelew', gotowka: 'Gotówka' };
const SMS_PRICE = 0.09;

// ---------- exercise drawings (pitch is 100 × 64; see board.js) ----------
// d(pitch, objs 'type:x:y[:label]', frames [[moves 'id:x:y'], lines 'type:x1:y1:x2:y2']], zones 'x:y:w:h:c')
function d(pitch, objs, frames = [[[], []]], zones = []) {
  const o = objs.map((s, i) => { const [t, x, y, n] = s.split(':'); return { id: 'o' + i, t, n: n || '', x: +x, y: +y }; });
  const base = Object.fromEntries(o.map(x => [x.id, [x.x, x.y]]));
  let cur = base;
  return {
    pitch,
    objs: o.map(({ id, t, n }) => ({ id, t, n })),
    zones: zones.map(s => { const [x, y, w, h, c] = s.split(':'); return { id: uid('z'), x: +x, y: +y, w: +w, h: +h, c: c || 'n' }; }),
    frames: frames.map(([moves, lines]) => {
      cur = { ...cur };
      moves.forEach(m => { const [i, x, y] = m.split(':'); cur['o' + i] = [+x, +y]; });
      return { p: cur, lines: lines.map(s => { const [t, x1, y1, x2, y2] = s.split(':'); return { id: uid('l'), t, a: [+x1, +y1], b: [+x2, +y2] }; }) };
    }),
  };
}

const EXERCISES = [
  { id: 'ex1', name: 'Rondo 4 na 1', goal: 'Podania', phase: 'wstep', ages: ['U9', 'U12', 'U15', 'U17'], players: '5', min: 10, area: '10 × 10 m', author: 'marek',
    desc: 'Czterech zawodników na bokach kwadratu utrzymuje piłkę, jeden w środku próbuje ją odebrać. Po odbiorze zmiana z zawodnikiem, który stracił piłkę.',
    points: ['Przyjęcie na „dalszą nogę”', 'Otwarte ustawienie ciała', 'Maks. 2 kontakty'], kit: 'piłki, 4 pachołki, znaczniki',
    draw: d('grid', ['a:50:16:1', 'a:66:32:2', 'a:50:48:3', 'a:34:32:4', 'b:50:32', 'ball:50:19', 'cone:34:16', 'cone:66:16', 'cone:66:48', 'cone:34:48'],
      [[[], ['pass:50:18:64:31']], [['5:63:32', '4:56:28'], ['pass:65:34:51:46']], [['5:50:45', '4:52:39'], ['pass:48:47:35:34']], [['5:37:32', '4:44:34'], []]], ['34:16:32:32:n']) },
  { id: 'ex2', name: 'Prowadzenie slalomem — sztafeta', goal: 'Technika', phase: 'wstep', ages: ['U9', 'U12'], players: '8–12', min: 10, area: '20 × 15 m', author: 'pawel',
    desc: 'Dwie drużyny w rzędach. Prowadzenie piłki slalomem między pachołkami, powrót prostą linią i przekazanie piłki następnemu.',
    points: ['Piłka blisko nogi', 'Prowadzenie wewnętrzną i zewnętrzną częścią stopy', 'Głowa w górze przy powrocie'], kit: 'piłki, 12 pachołków',
    draw: d('grid', ['a:14:20:1', 'a:9:20:2', 'b:14:44:1', 'b:9:44:2', 'ball:17:20', 'ball:17:44', 'cone:28:20', 'cone:40:20', 'cone:52:20', 'cone:64:20', 'cone:76:20', 'cone:28:44', 'cone:40:44', 'cone:52:44', 'cone:64:44', 'cone:76:44'],
      [[[], ['drib:18:20:82:20', 'drib:18:44:82:44']], [['0:80:22', '4:82:20', '2:80:46', '5:82:44'], ['run:80:24:16:26', 'run:80:48:16:50']]]) },
  { id: 'ex3', name: 'Gra 1 na 1 do linii', goal: 'Gra 1 na 1', phase: 'glowna', ages: ['U9', 'U12', 'U15'], players: '8–14', min: 12, area: '15 × 10 m', author: 'pawel',
    desc: 'Atakujący z piłką próbuje przeprowadzić ją za linię obrońcy. Obrońca po odbiorze kontratakuje na linię przeciwną. Zmiana ról co powtórzenie.',
    points: ['Atak przestrzeni przed obrońcą', 'Zwód i zmiana tempa', 'Obrońca: ustawienie bokiem, nie dać się minąć do środka'], kit: 'piłki, pachołki, znaczniki',
    draw: d('grid', ['a:24:32:1', 'b:62:32:1', 'ball:27:32', 'cone:20:14', 'cone:20:50', 'cone:80:14', 'cone:80:50'],
      [[[], ['drib:28:32:52:26', 'run:62:32:56:30']], [['0:52:26', '2:55:26', '1:56:30'], ['drib:56:24:80:20']], [['0:78:21', '2:80:20', '1:68:24'], []]], ['20:14:60:36:n']) },
  { id: 'ex4', name: 'Utrzymanie piłki 4 na 4 + 2 jokerów', goal: 'Taktyka', phase: 'glowna', ages: ['U12', 'U15', 'U17'], players: '10', min: 15, area: '30 × 25 m', author: 'marek',
    desc: 'Drużyna w posiadaniu gra z dwoma jokerami na bokach (przewaga 6 na 4). Punkt za 6 podań z rzędu. Po stracie natychmiastowy pressing.',
    points: ['Szerokość i głębokość w posiadaniu', 'Gra do jokera i wejście w wolną strefę', 'Reakcja po stracie w 3 sekundy'], kit: 'piłki, znaczniki 3 kolory, pachołki',
    draw: d('grid', ['a:34:20:1', 'a:58:16:2', 'a:66:42:3', 'a:40:46:4', 'b:44:28', 'b:56:28', 'b:52:40', 'b:38:36', 'n:20:32:J', 'n:80:32:J', 'ball:36:22'],
      [[[], ['pass:36:21:56:17', 'run:66:42:70:30']], [['10:57:18', '6:52:22', '2:70:30'], ['pass:58:18:78:31']], [['10:78:32', '5:66:28'], []]], ['20:10:60:44:n']) },
  { id: 'ex5', name: 'Podania w trójkątach z przyjęciem kierunkowym', goal: 'Podania', phase: 'wstep', ages: ['U12', 'U15', 'U17'], players: '9–12', min: 12, area: '15 × 15 m', author: 'marek',
    desc: 'Trzy stacje w trójkącie. Podanie, przyjęcie kierunkowe w stronę kolejnej stacji, podanie dalej i bieg za piłką.',
    points: ['Przyjęcie w ruchu, pierwszym kontaktem od pachołka', 'Komunikacja: „hop”, „sam”', 'Siła podania po ziemi'], kit: 'piłki, 3 pachołki',
    draw: d('grid', ['cone:30:50', 'cone:50:14', 'cone:70:50', 'a:28:53:1', 'a:50:11:2', 'a:72:53:3', 'ball:32:49'],
      [[[], ['pass:32:48:49:17', 'run:28:50:47:15']], [['6:51:17', '4:52:16'], ['pass:53:16:68:48', 'run:50:13:68:51']], [['6:68:48', '5:66:46'], []]]) },
  { id: 'ex6', name: 'Wyjście spod pressingu 3 na 2 + bramkarz', goal: 'Taktyka', phase: 'glowna', ages: ['U15', 'U17'], players: '6–8', min: 15, area: '1/3 boiska', author: 'tomasz',
    desc: 'Bramkarz i trzech obrońców wyprowadzają piłkę przez linię środkową pod pressingiem dwóch napastników. Punkt za przeprowadzenie piłki przez jedną z dwóch bramek środkowych.',
    points: ['Bramkarz jako dodatkowy zawodnik', 'Szerokie ustawienie stoperów', 'Podanie do wolnego — nie „na siłę” w środek'], kit: 'piłki, 2 małe bramki, znaczniki',
    draw: d('half', ['gk:96:32:1', 'a:84:16:4', 'a:84:48:5', 'a:76:32:6', 'b:80:26:9', 'b:80:40:10', 'mini:50:16', 'mini:50:48', 'ball:93:32'],
      [[[], ['pass:93:31:85:18', 'run:76:32:70:24']], [['8:85:18', '4:83:20'], ['pass:84:17:71:24']], [['8:70:24', '4:76:22', '5:76:36'], ['drib:70:24:52:17']]]) },
  { id: 'ex7', name: 'Atak szybki 3 na 2 z wykończeniem', goal: 'Wykończenie', phase: 'glowna', ages: ['U12', 'U15', 'U17'], players: '10–15', min: 15, area: 'połowa boiska', author: 'marek',
    desc: 'Trzech atakujących startuje od linii środkowej przeciwko dwóm obrońcom. Akcja ma się skończyć strzałem w 10 sekund.',
    points: ['Atak szerokością', 'Prowadzący przyciąga obrońcę i podaje w tempo', 'Wbiegnięcie na dalszy słupek'], kit: 'piłki, bramka, znaczniki',
    draw: d('half', ['a:44:32:10', 'a:40:12:7', 'a:40:52:11', 'b:70:26:4', 'b:70:40:5', 'gk:96:32:1', 'ball:47:32'],
      [[[], ['drib:47:32:66:32', 'run:40:12:76:16', 'run:40:52:76:48']], [['0:64:32', '6:66:32', '1:76:16', '2:76:48', '3:70:30', '4:72:38'], ['pass:66:33:76:46']], [['6:76:46', '4:76:42', '5:93:36'], ['shot:77:46:99:34']], [['6:99:34'], []]]) },
  { id: 'ex8', name: 'Gra 7 na 7 na cztery małe bramki', goal: 'Gra', phase: 'glowna', ages: ['U9', 'U12'], players: '14', min: 20, area: '40 × 30 m', author: 'pawel',
    desc: 'Każda drużyna broni dwóch małych bramek i atakuje dwie. Zachęca do zmiany strony gry.',
    points: ['Patrz, gdzie jest wolna bramka', 'Zmiana kierunku ataku', 'Asekuracja po stracie'], kit: 'piłki, 4 małe bramki, znaczniki',
    draw: d('grid', ['mini:6:18', 'mini:6:46', 'mini:94:18', 'mini:94:46', 'a:30:20:1', 'a:30:44:2', 'a:44:32:3', 'a:52:16:4', 'b:58:28:1', 'b:66:44:2', 'b:72:20:3', 'b:48:46:4', 'ball:46:30'],
      [[[], ['pass:46:31:52:18', 'run:30:44:60:50']]], ['4:6:92:52:n']) },
  { id: 'ex9', name: 'Berek z piłką', goal: 'Koordynacja', phase: 'wstep', ages: ['U9'], players: '10–16', min: 8, area: '20 × 20 m', author: 'pawel',
    desc: 'Każdy prowadzi piłkę w polu. Berek (bez piłki, w znaczniku) próbuje dotknąć zawodnika. Złapany zostaje berkiem.',
    points: ['Piłka zawsze przy nodze', 'Rozglądanie się', 'Zmiana kierunku po „zatrzymaniu” piłki podeszwą'], kit: 'piłki, znaczniki, pachołki',
    draw: d('grid', ['b:50:32:B', 'a:30:20', 'a:68:18', 'a:72:44', 'a:34:46', 'a:50:14', 'cone:22:10', 'cone:78:10', 'cone:78:54', 'cone:22:54'],
      [[[], ['run:50:32:62:22', 'drib:30:20:40:30', 'drib:68:18:76:28', 'drib:34:46:44:50']]], ['22:10:56:44:n']) },
  { id: 'ex10', name: 'Drabinka koordynacyjna i sprint 10 m', goal: 'Motoryka', phase: 'wstep', ages: ['U12', 'U15', 'U17'], players: 'cała grupa', min: 10, area: '25 × 10 m', author: 'tomasz',
    desc: 'Praca stóp na drabince (skipy, przeplatanki, wejścia boczne), na sygnał sprint do pachołka i powrót truchtem.',
    points: ['Praca na śródstopiu', 'Ramiona pracują równo z nogami', 'Start reaktywny na sygnał'], kit: 'drabinka, 4 pachołki',
    draw: d('grid', ['ladder:28:32', 'a:12:32:1', 'a:7:32:2', 'cone:62:30', 'cone:62:34', 'cone:88:30', 'cone:88:34'],
      [[[], ['run:14:32:22:32']], [['0:40:32'], ['run:42:32:86:32']], [['0:86:32'], []]]) },
  { id: 'ex11', name: 'Strzały po dośrodkowaniu z boku', goal: 'Wykończenie', phase: 'glowna', ages: ['U12', 'U15', 'U17'], players: '8–12', min: 15, area: 'pole karne', author: 'tomasz',
    desc: 'Skrzydłowy prowadzi piłkę wzdłuż linii i dośrodkowuje, dwóch napastników atakuje bliższy i dalszy słupek.',
    points: ['Wbiegnięcie po krzyżu', 'Uderzenie z pierwszej piłki', 'Dośrodkowanie po ziemi na 11. metr'], kit: 'piłki, bramka, pachołki',
    draw: d('half', ['a:66:8:7', 'a:70:28:9', 'a:66:40:10', 'gk:97:32:1', 'ball:69:8', 'cone:84:8'],
      [[[], ['drib:69:8:86:10', 'run:70:28:92:30', 'run:66:40:88:38']], [['0:86:10', '4:88:11', '1:92:30', '2:88:38'], ['pass:88:12:90:30']], [['4:90:30'], ['shot:91:30:100:34']], [['4:100:34'], []]]) },
  { id: 'ex12', name: 'Gra 8 na 8: trzy podania przed strzałem', goal: 'Gra', phase: 'koncowa', ages: ['U12', 'U15', 'U17'], players: '16', min: 20, area: '60 × 40 m', author: 'marek',
    desc: 'Gra z bramkarzami. Gol liczy się, jeśli przed strzałem drużyna wymieniła co najmniej trzy podania.',
    points: ['Cierpliwość w budowaniu akcji', 'Gra bez piłki — pokazywanie się', 'Przejście do obrony po stracie'], kit: 'piłki, 2 bramki, znaczniki',
    draw: d('full', ['gk:3:32:1', 'gk:97:32:1', 'a:20:18', 'a:22:46', 'a:36:32', 'a:46:14', 'a:54:42', 'a:62:24', 'b:30:24', 'b:40:44', 'b:58:12', 'b:68:36', 'b:76:20', 'b:80:46', 'ball:37:32'],
      [[[], ['pass:38:31:46:16', 'pass:47:15:62:23', 'run:54:42:72:46']]]) },
  { id: 'ex13', name: 'Schłodzenie i rozciąganie w kole', goal: 'Regeneracja', phase: 'koncowa', ages: ['U9', 'U12', 'U15', 'U17'], players: 'cała grupa', min: 8, area: 'dowolne', author: 'ola',
    desc: 'Trucht, marsz, potem rozciąganie dynamiczne i statyczne w kole. Trener podsumowuje trening i pyta o samopoczucie.',
    points: ['Oddech spokojny, przez nos', 'Bez sprężynowania przy rozciąganiu', 'Krótkie podsumowanie: co wyszło, co poprawiamy'], kit: '—',
    draw: d('grid', ['a:50:14', 'a:63:19', 'a:68:32', 'a:63:45', 'a:50:50', 'a:37:45', 'a:32:32', 'a:37:19', 'n:50:32:T']) },
  { id: 'ex14', name: 'Pressing po stracie — 5 sekund', goal: 'Taktyka', phase: 'glowna', ages: ['U15', 'U17'], players: '12–16', min: 15, area: '40 × 30 m', author: 'tomasz',
    desc: 'Gra 6 na 6. Po stracie piłki drużyna ma 5 sekund na odbiór w strefie straty; udany odbiór to 2 punkty.',
    points: ['Najbliższy zawodnik atakuje piłkę', 'Pozostali zamykają linie podań', 'Po 5 s — powrót do ustawienia'], kit: 'piłki, znaczniki, pachołki',
    draw: d('grid', ['b:52:30:6', 'a:48:24:8', 'a:58:22:10', 'a:44:38:6', 'b:64:36', 'b:40:16', 'b:70:20', 'ball:54:31'],
      [[[], ['run:48:24:52:28', 'run:58:22:62:32', 'run:44:38:44:22']]], ['36:14:32:28:a']) },
  { id: 'ex15', name: 'Rzut rożny — wariant krótki', goal: 'Taktyka', phase: 'glowna', ages: ['U15', 'U17'], players: '10', min: 12, area: 'pole karne', author: 'tomasz',
    desc: 'Krótkie rozegranie rożnego: podanie do zawodnika przy narożniku pola karnego, odegranie i dośrodkowanie z innego kąta.',
    points: ['Sygnał ręką = wariant krótki', 'Zbiegnięcie na bliższy słupek ściąga obrońcę', 'Dośrodkowanie na 7. metr'], kit: 'piłki, bramka',
    draw: d('half', ['a:99:1:7', 'a:86:10:8', 'a:84:28:9', 'a:80:36:4', 'b:92:24', 'b:90:34', 'b:86:14', 'gk:98:32:1', 'ball:98:2'],
      [[[], ['pass:98:3:87:9']], [['8:87:10', '0:94:4'], ['pass:86:11:94:5', 'run:84:28:94:28']], [['8:94:5', '2:94:28'], ['pass:95:6:93:36', 'run:80:36:92:38']], [['8:93:37'], ['shot:93:37:100:33']]]) },
];

// ---------- name pools ----------
const BOYS = ['Jakub', 'Antoni', 'Jan', 'Szymon', 'Franciszek', 'Filip', 'Aleksander', 'Mikołaj', 'Wojciech', 'Kacper', 'Adam', 'Michał', 'Marcel', 'Stanisław', 'Wiktor', 'Piotr', 'Igor', 'Leon', 'Nikodem', 'Mateusz', 'Bartosz', 'Tymon', 'Oliwer', 'Ignacy', 'Maksymilian', 'Kajetan', 'Tymoteusz', 'Julian', 'Hubert', 'Dawid', 'Oskar', 'Krzysztof', 'Borys', 'Alan', 'Natan', 'Iwo', 'Gabriel', 'Fabian'];
const GIRLS = ['Hanna', 'Julia', 'Maja', 'Lena', 'Alicja', 'Oliwia', 'Pola', 'Laura'];
const SURNAMES = ['Kowalski', 'Wiśniewski', 'Kamiński', 'Lewandowski', 'Dąbrowski', 'Szymański', 'Woźniak', 'Kozłowski', 'Jankowski', 'Mazur', 'Kwiatkowski', 'Krawczyk', 'Piotrowski', 'Grabowski', 'Pawłowski', 'Michalski', 'Król', 'Wieczorek', 'Jabłoński', 'Wróbel', 'Majewski', 'Olszewski', 'Stępień', 'Malinowski', 'Jaworski', 'Adamczyk', 'Dudek', 'Nowicki', 'Pawlak', 'Górski', 'Witkowski', 'Walczak', 'Sikora', 'Baran', 'Rutkowski', 'Szewczyk', 'Ostrowski', 'Tomaszewski', 'Pietrzak', 'Zalewski', 'Wróblewski', 'Marciniak', 'Jasiński', 'Zawadzki', 'Bąk', 'Jakubowski', 'Sadowski', 'Duda', 'Włodarczyk', 'Wilk', 'Chmielewski', 'Borkowski', 'Sokołowski', 'Szczepański', 'Sawicki', 'Kucharski', 'Kalinowski', 'Mazurek', 'Wysocki', 'Adamski', 'Kaźmierczak', 'Wasilewski', 'Czarnecki', 'Sobczak', 'Konieczny', 'Urbański', 'Głowacki', 'Makowski', 'Kubiak'];
const MOMS = ['Agnieszka', 'Anna', 'Magdalena', 'Monika', 'Joanna', 'Marta', 'Ewa', 'Karolina', 'Justyna', 'Aleksandra', 'Paulina', 'Natalia', 'Dorota', 'Beata', 'Sylwia', 'Izabela'];
const DADS = ['Tomasz', 'Piotr', 'Krzysztof', 'Paweł', 'Michał', 'Marcin', 'Łukasz', 'Grzegorz', 'Rafał', 'Adam', 'Bartosz', 'Kamil', 'Robert', 'Dariusz', 'Sebastian', 'Jacek'];
const fem = s => s.replace(/ski$/, 'ska').replace(/cki$/, 'cka').replace(/dzki$/, 'dzka');

// The season starts in July: Oct 2026 is season 2026/27.
function seasonOf(ts) {
  const d = new Date(ts), y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return { start: y, label: `${y}/${String(y + 1).slice(2)}` };
}

// ---------- seed ----------
function seed(now = Date.now()) {
  const R = seeded('iskra-' + isoDay(now));
  const pick = a => a[Math.floor(R() * a.length)];
  const between = (a, b) => a + R() * (b - a);
  const today = startOfDay(now);
  const season = seasonOf(now);
  const phone = () => `+48 6${Math.floor(R() * 10)}${Math.floor(R() * 10)} ${String(Math.floor(R() * 1000)).padStart(3, '0')} ${String(Math.floor(R() * 1000)).padStart(3, '0')}`;
  const mail = name => norm(name).replace(/[^a-z ]/g, '').replace(' ', '.') + '@example.com';

  const db = {
    v: 1, seededFor: isoDay(now), season: season.label,
    players: [], parents: [], events: [], reservations: [], plans: [], boards: [], charges: [], campaigns: [],
    threads: [], posts: [], notes: [], apps: [], wellness: {}, exercises: JSON.parse(JSON.stringify(EXERCISES)),
    bankImports: [],
  };

  // test and measurement sessions: spring, end of last season, start of this one
  const testDays = [+new Date(season.start, 2, 14), +new Date(season.start, 5, 10), +new Date(season.start, 8, 16)].filter(t => t <= today);

  const used = new Set(['Nowak']);
  let pn = 0;
  TEAMS.forEach(team => {
    const year = season.start + 1 - team.n;
    const nums = [1, 12, ...Array.from({ length: 30 }, (_, i) => i + 2).filter(x => x !== 12)];
    for (let i = 0; i < team.size; i++) {
      let id = 'p' + ++pn, first, last, sex = 'm', parentId;
      if (team.id === 'u12' && i === 5) { id = 'kuba'; first = 'Jakub'; last = 'Nowak'; parentId = 'kasia'; }
      else if (team.id === 'u9' && i === 3) { id = 'zosia'; first = 'Zofia'; last = 'Nowak'; sex = 'f'; parentId = 'kasia'; }
      else {
        sex = team.id === 'u9' && R() < 0.25 ? 'f' : 'm';
        first = sex === 'f' ? pick(GIRLS) : pick(BOYS);
        do { last = pick(SURNAMES); } while (used.has(last));
        used.add(last);
        if (sex === 'f') last = fem(last);
      }
      const birth = +new Date(year, Math.floor(R() * 12), 1 + Math.floor(R() * 28));
      const pos = i < 2 ? 'BR' : i < 7 ? 'OB' : i < 12 ? 'PO' : 'NA';
      const talent = id === 'kuba' ? 0.55 : between(-0.9, 0.9);
      const p = {
        id, first, last, sex, birth, team: team.id, num: id === 'kuba' ? 10 : team.id === 'u12' && nums[i] === 10 ? nums[5] : nums[i], pos: id === 'kuba' ? 'PO' : pos,
        foot: R() < 0.22 ? 'lewa' : R() < 0.08 ? 'obie' : 'prawa', parent: parentId || 'par' + pn, joined: +new Date(year + 6 + Math.floor(R() * 3), 8, 1),
        medUntil: addDays(today, Math.round(between(40, 330))), reliab: between(0.72, 0.98), talent,
        anthro: [], skills: [], tests: {}, injuries: [], discount: null, notes: '',
      };
      if (p.joined > today) p.joined = +new Date(season.start, 8, 1);
      db.players.push(p);
      if (!parentId) {
        const mom = R() < 0.62, pf = mom ? pick(MOMS) : pick(DADS);
        const pl = mom ? fem(last.replace(/ska$/, 'ski').replace(/cka$/, 'cki').replace(/dzka$/, 'dzki')) : last.replace(/ska$/, 'ski').replace(/cka$/, 'cki').replace(/dzka$/, 'dzki');
        const name = `${pf} ${pl}`;
        db.parents.push({ id: p.parent, name, phone: phone(), email: mail(name), kids: [id] });
      }
    }
  });
  db.parents.push({ id: 'kasia', name: 'Katarzyna Nowak', phone: '+48 600 100 200', email: 'katarzyna.nowak@example.com', kids: ['kuba', 'zosia'] });

  const P = id => db.players.find(p => p.id === id);
  const teamPlayers = t => db.players.filter(p => p.team === t);

  // medical exams: a few expiring soon, a couple expired
  const medSoon = [P('kuba')], medGone = [];
  TEAMS.forEach(t => { const tp = teamPlayers(t.id).filter(p => p.id !== 'kuba' && p.id !== 'zosia'); medSoon.push(tp[3]); if (t.id !== 'u9') medGone.push(tp[8]); });
  medSoon.forEach((p, i) => { p.medUntil = addDays(today, p.id === 'kuba' ? 12 : 5 + i * 6); });
  medGone.forEach((p, i) => { p.medUntil = addDays(today, -4 - i * 9); });
  P('zosia').discount = { pct: 20, label: 'Rodzeństwo −20%' };
  teamPlayers('u17')[4].discount = { pct: 50, label: 'Stypendium sportowe −50%' };

  // body, skills, tests
  db.players.forEach(p => {
    const spurt = p.team === 'u15' && R() < 0.3;
    testDays.forEach((t, k) => {
      const a = (t - p.birth) / (365.25 * DAY);
      const h = 120 + 6.1 * (a - 7) + p.talent * 2 + (spurt ? k * 2.4 : 0) + (R() - 0.5) * 2;
      const w = 23 + 3.5 * (a - 7) + (R() - 0.4) * 3 + (spurt ? k * 1.2 : 0);
      p.anthro.push({ d: t, h: Math.round(h * 2) / 2, w: Math.round(w * 2) / 2 });
      const v = {
        sp20: 4.95 - 0.1 * (a - 8) - p.talent * 0.14 + (R() - 0.5) * 0.12,
        jump: 128 + 9.5 * (a - 8) + p.talent * 12 + (R() - 0.5) * 8,
        slalom: 14.2 - 0.48 * (a - 8) - p.talent * 0.8 + (R() - 0.5) * 0.6,
        jugg: Math.max(2, 6 + 9 * (a - 8) + p.talent * 16 + (R() - 0.5) * 10),
        yoyo: 560 + 130 * (a - 13) + p.talent * 160 + (R() - 0.5) * 80,
      };
      TESTS.forEach(tt => {
        if (tt.min && TEAMS.find(x => x.id === p.team).n < tt.min) return;
        const val = tt.id === 'yoyo' ? Math.round(v.yoyo / 40) * 40 : +v[tt.id].toFixed(tt.dec);
        (p.tests[tt.id] = p.tests[tt.id] || []).push([t, val]);
      });
    });
    const base = SKILLS.map((_, i) => clamp(Math.round((3 + p.talent * 0.9 + (R() - 0.5) * 1.2 + (i === 5 ? 0.3 : 0)) * 2) / 2, 1, 5));
    const prevDay = +new Date(season.start, 5, 18), curDay = addDays(today, -Math.round(between(12, 30)));
    const coach = TEAMS.find(x => x.id === p.team).coach;
    if (prevDay < today) p.skills.push({ d: prevDay, by: coach, v: base, note: '' });
    p.skills.push({
      d: curDay, by: coach, v: base.map(x => clamp(x + (R() < 0.45 ? 0.5 : 0) - (R() < 0.08 ? 0.5 : 0), 1, 5)),
      note: p.id === 'kuba' ? 'Bardzo dobra orientacja w grze, szuka podań do przodu. Pracujemy nad słabszą nogą i grą głową.' : '',
    });
  });

  // injuries
  const u15 = teamPlayers('u15'), u17 = teamPlayers('u17'), u12 = teamPlayers('u12');
  u15[9].injuries.push({ id: uid('i'), type: 'Naderwanie mięśnia dwugłowego uda (prawe)', from: addDays(today, -10), back: addDays(today, 8), status: 'out', by: 'ola',
    log: [[addDays(today, -10), 'Uraz w meczu, zejście w 54. min. Lód, kompresja.'], [addDays(today, -7), 'USG: naderwanie I st. Fizjoterapia 3× w tygodniu.'], [addDays(today, -2), 'Bez bólu w marszu, ćwiczenia izometryczne.']] });
  u15[6].injuries.push({ id: uid('i'), type: 'Przeciążenie przyczepu rzepki (Osgood-Schlatter)', from: addDays(today, -20), back: null, status: 'limited', by: 'ola',
    log: [[addDays(today, -20), 'Ból przy skokach. Ograniczyć skoki i sprinty, bez siłowni na nogi.']] });
  u17[3].injuries.push({ id: uid('i'), type: 'Skręcenie stawu skokowego (lewy)', from: addDays(today, -40), back: addDays(today, -12), status: 'healed', by: 'ola',
    log: [[addDays(today, -40), 'Skręcenie przy lądowaniu. Stabilizator.'], [addDays(today, -12), 'Powrót do pełnego treningu.']] });
  u12[11].injuries.push({ id: uid('i'), type: 'Stłuczenie kolana', from: addDays(today, -3), back: addDays(today, 4), status: 'out', by: 'ola', log: [[addDays(today, -3), 'Stłuczenie po zderzeniu na treningu. Chłodzenie, odpoczynek.']] });
  const injuredOn = (p, t) => p.injuries.find(i => i.status !== 'limited' && t >= i.from && (!i.back || t < i.back));

  // ---------- calendar ----------
  const wk0 = startOfWeek(today), from = addDays(wk0, -28), to = addDays(wk0, 20);
  const nowTs = now;
  let evN = 0, oppN = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const wd = new Date(day).getDay();
    TEAMS.forEach(team => {
      team.plan.forEach(([w, a, b, fac], k) => {
        if (w !== wd) return;
        const start = atTime(day, a), end = atTime(day, b);
        db.events.push({ id: 'e' + ++evN, type: 'training', team: team.id, start, end, fac, title: fac[0] === 'gym' ? 'Trening motoryczny' : 'Trening', series: `${team.id}-${k}`, att: {}, absences: {}, plan: null, eval: null, rpe: {} });
      });
      const [mw, mt, mdur] = team.match;
      const weekIdx = Math.round((startOfWeek(day) - wk0) / (7 * DAY));
      if (mw === wd && !(team.id === 'u9' && Math.abs(weekIdx) % 2 === 1)) {
        const [opp, oppAddr] = OPPONENTS[(oppN++ * 3 + weekIdx + 8) % OPPONENTS.length];
        const home = (weekIdx + team.n) % 2 === 0;
        const start = atTime(day, mt);
        db.events.push({
          id: 'e' + ++evN, type: 'match', team: team.id, start, end: start + (mdur + 30) * MIN, fac: home ? (team.id === 'u9' ? ['orlik'] : ['a1', 'a2']) : [],
          place: home ? 'Stadion Iskry, ' + CLUB.addr : oppAddr, opp, home, comp: team.comp, fest: !!team.fest, meet: fmtTime(start - (home ? 45 : 75) * MIN),
          title: team.fest ? `Festiwal: ${opp}` : `${home ? CLUB.short + ' – ' + opp : opp + ' – ' + CLUB.short}`,
          callup: {}, callupAt: null, att: {}, absences: {}, live: null, stats: {}, rpe: {},
        });
      }
    });
  }
  // other events
  const tue = addDays(wk0, 8);
  db.events.push({ id: 'e' + ++evN, type: 'other', team: 'u12', start: atTime(tue, '18:30'), end: atTime(tue, '19:30'), fac: ['hall'], title: 'Zebranie z rodzicami U12', desc: 'Plan rundy wiosennej, obóz zimowy, sprawy organizacyjne.', att: {}, absences: {} });
  const photo = addDays(wk0, 10);
  db.events.push({ id: 'e' + ++evN, type: 'other', team: 'all', start: atTime(photo, '16:00'), end: atTime(photo, '19:00'), fac: ['hall'], title: 'Zdjęcia drużynowe — wszystkie roczniki', desc: 'Prosimy o komplet strojów meczowych. Godziny wg rocznika w ogłoszeniu.', att: {}, absences: {} });
  db.events.sort((a, b) => a.start - b.start);

  // past attendance, matches and loads
  const extraLoad = [u15[2].id, u15[13].id];
  db.events.forEach(e => {
    const tp = e.team === 'all' ? [] : teamPlayers(e.team);
    if (e.type === 'match') {
      const squad = tp.filter(p => !injuredOn(p, e.start)).slice(0, 18);
      if (e.start < nowTs) {
        squad.forEach(p => { e.callup[p.id] = R() < 0.9 ? 'yes' : 'no'; });
        e.callupAt = e.start - 4 * DAY;
        const played = squad.filter(p => e.callup[p.id] === 'yes');
        played.forEach(p => { e.att[p.id] = 'present'; });
        const t = TEAMS.find(x => x.id === e.team), mins = t.match[2];
        const us = e.fest ? 0 : Math.floor(R() * 5), them = e.fest ? 0 : Math.floor(R() * 4);
        const log = [];
        const scorers = played.filter(p => p.pos !== 'BR');
        for (let g = 0; g < us; g++) {
          const s = pick(scorers), a = R() < 0.7 ? pick(scorers.filter(x => x !== s)) : null;
          log.push({ id: uid('g'), min: 1 + Math.floor(R() * mins), t: 'goal', side: 'us', pid: s.id, assist: a?.id || null });
        }
        for (let g = 0; g < them; g++) log.push({ id: uid('g'), min: 1 + Math.floor(R() * mins), t: 'goal', side: 'them' });
        if (!e.fest && R() < 0.6) log.push({ id: uid('c'), min: 1 + Math.floor(R() * mins), t: 'yellow', side: 'us', pid: pick(scorers).id });
        log.sort((a, b) => a.min - b.min);
        e.live = { status: 'ft', startedAt: e.start, us, them, log, shots: [us + 3 + Math.floor(R() * 6), them + 2 + Math.floor(R() * 5)], corners: [Math.floor(R() * 7), Math.floor(R() * 6)], poss: Math.round(between(42, 62)) };
        played.forEach((p, i) => { e.stats[p.id] = { min: i < 11 ? mins - (R() < 0.35 ? Math.round(between(10, 30)) : 0) : Math.round(between(10, 35)) }; });
        if (e.team === 'u15') played.forEach(p => { e.rpe[p.id] = Math.round(between(6, 9)); });
      }
    } else if (e.type === 'training' && e.end < today) {
      // today's sessions stay open, so the coach can take attendance in the demo
      tp.forEach(p => {
        if (injuredOn(p, e.start)) { e.att[p.id] = 'excused'; e.absences[p.id] = { reason: 'Kontuzja', by: 'ola', at: e.start - DAY }; return; }
        const r = R();
        e.att[p.id] = r < p.reliab ? (R() < 0.05 ? 'late' : 'present') : R() < 0.5 ? 'excused' : 'absent';
        if (e.att[p.id] === 'excused') e.absences[p.id] = { reason: pick(['Choroba', 'Wyjazd rodzinny', 'Sprawdzian w szkole', 'Wizyta u lekarza']), by: P(p.id).parent, at: e.start - Math.round(between(3, 30)) * 3600e3 };
      });
      if (e.team === 'u15') {
        const daysAgo = daysBetween(e.start, today);
        tp.forEach(p => {
          if (e.att[p.id] !== 'present' && e.att[p.id] !== 'late') return;
          let rpe = e.fac[0] === 'gym' ? between(4, 6) : between(5, 7.5);
          if (extraLoad.includes(p.id) && daysAgo <= 7) rpe = between(8, 9.5);
          if (extraLoad.includes(p.id) && daysAgo > 14) { delete e.att[p.id]; e.att[p.id] = 'excused'; e.absences[p.id] = { reason: 'Wyjazd rodzinny', by: P(p.id).parent, at: e.start - DAY }; return; }
          e.rpe[p.id] = Math.round(rpe);
        });
      }
      e.eval = R() < 0.75 ? { real: 3 + Math.floor(R() * 3), eng: 3 + Math.floor(R() * 3), note: '', by: TEAMS.find(t => t.id === e.team).coach } : null;
    }
  });

  // the next U12 match: call-ups sent, Kuba's mum hasn't answered yet
  const nextMatch = t => db.events.find(e => e.type === 'match' && e.team === t && e.start > nowTs);
  const m12 = nextMatch('u12');
  if (m12) {
    m12.callupAt = nowTs - 26 * 3600e3;
    teamPlayers('u12').filter(p => !injuredOn(p, m12.start)).slice(0, 16).forEach((p, i) => { m12.callup[p.id] = p.id === 'kuba' ? 'pending' : i % 5 === 4 ? 'pending' : i === 7 ? 'no' : 'yes'; });
  }
  const m17 = nextMatch('u17');
  if (m17) { m17.callupAt = nowTs - 30 * 3600e3; teamPlayers('u17').filter(p => !injuredOn(p, m17.start)).slice(0, 18).forEach(p => { m17.callup[p.id] = R() < 0.85 ? 'yes' : 'pending'; }); }
  const m9 = nextMatch('u9');
  if (m9) { m9.callupAt = nowTs - 50 * 3600e3; teamPlayers('u9').forEach(p => { m9.callup[p.id] = p.id === 'zosia' ? 'yes' : R() < 0.75 ? 'yes' : 'pending'; }); }

  // a parent already reported an absence for the next U12 training
  const nextTr12 = db.events.find(e => e.type === 'training' && e.team === 'u12' && e.start > nowTs);
  if (nextTr12) {
    const p = u12[3];
    nextTr12.absences[p.id] = { reason: 'Choroba — przeziębienie', by: p.parent, at: nowTs - 5 * 3600e3 };
  }

  // wellness surveys in U15 (players fill them in the morning)
  u15.forEach(p => {
    db.wellness[p.id] = {};
    for (let k = 13; k >= 0; k--) {
      if (R() > 0.78 && k > 0) continue;
      if (k === 0 && R() < 0.35) continue;
      const tired = extraLoad.includes(p.id) && k <= 4;
      db.wellness[p.id][isoDay(addDays(today, -k))] = {
        sleep: tired ? 2 + Math.floor(R() * 2) : 3 + Math.floor(R() * 3), fatigue: tired ? 4 + Math.floor(R() * 2) : 1 + Math.floor(R() * 3),
        soreness: tired ? 4 : 1 + Math.floor(R() * 3), stress: 1 + Math.floor(R() * 3), mood: tired ? 2 + Math.floor(R() * 2) : 3 + Math.floor(R() * 3),
      };
    }
  });

  // facility bookings that aren't team sessions
  for (let day = addDays(wk0, -7); day <= to; day = addDays(day, 1)) {
    const wd = new Date(day).getDay();
    const add = (fac, a, b, who, kind = 'ext') => db.reservations.push({ id: uid('r'), fac, start: atTime(day, a), end: atTime(day, b), who, kind });
    if (wd === 1 || wd === 3) add(['hall'], '16:00', '17:30', 'Futsal dziewcząt (MOS)');
    if (wd === 2) add(['a1', 'a2'], '19:15', '20:45', 'Wynajem: Oldboje Iskra');
    if (wd === 4) add(['a1'], '16:00', '17:15', 'Szkoła bramkarzy Iskry', 'int');
    if (wd === 2 || wd === 4) add(['orlik'], '16:00', '17:30', 'Zajęcia SKS — SP 118');
    if (wd === 5) add(['hall'], '18:00', '20:00', 'Wynajem: liga firmowa futsal');
    if (wd === 6) add(['orlik'], '13:00', '15:00', 'Urodziny piłkarskie (zewn.)');
  }

  // ---------- training plans ----------
  const ev12 = db.events.filter(e => e.type === 'training' && e.team === 'u12');
  const todays12 = ev12.find(e => sameDay(e.start, today)) || ev12.find(e => e.start > nowTs);
  const past12 = ev12.filter(e => e.end < today).slice(-2);
  const mk = (id, title, team, author, goal, blocks, extra = {}) => db.plans.push({
    id, title, team, author, goal, dur: 90, kit: 'piłki × 16, pachołki × 20, znaczniki 2 kolory, 4 małe bramki', shared: true, createdAt: addDays(today, -5),
    blocks: blocks.map(([ex, phase, min, note = '']) => ({ id: uid('b'), ex, phase, min, note })), event: null, ...extra,
  });
  mk('k1', 'Utrzymanie piłki pod presją', 'u12', 'marek', 'Utrzymanie piłki i szybka reakcja po stracie',
    [['ex5', 'wstep', 12, 'Najpierw bez presji, potem z biernym obrońcą'], ['ex10', 'wstep', 8], ['ex4', 'glowna', 20, '3 serie po 5 min, 1 min przerwy'], ['ex7', 'glowna', 18], ['ex12', 'koncowa', 22], ['ex13', 'koncowa', 8]],
    { event: todays12?.id || null, createdAt: addDays(today, -2) });
  mk('k2', 'Gra 1 na 1 i dryblingi', 'u12', 'marek', 'Odwaga w grze 1 na 1', [['ex1', 'wstep', 10], ['ex2', 'wstep', 10], ['ex3', 'glowna', 20], ['ex8', 'glowna', 20], ['ex12', 'koncowa', 20], ['ex13', 'koncowa', 8]], { event: past12[0]?.id || null, createdAt: addDays(today, -12) });
  mk('k3', 'Wykończenie akcji', 'u12', 'marek', 'Skuteczność pod bramką', [['ex5', 'wstep', 12], ['ex11', 'glowna', 20], ['ex7', 'glowna', 20], ['ex12', 'koncowa', 22], ['ex13', 'koncowa', 8]], { event: past12[1]?.id || null, createdAt: addDays(today, -8) });
  mk('k4', 'Wyprowadzenie piłki od bramkarza', 'u15', 'marek', 'Budowanie akcji od tyłu', [['ex10', 'wstep', 10], ['ex5', 'wstep', 12], ['ex6', 'glowna', 25], ['ex14', 'glowna', 18], ['ex12', 'koncowa', 20], ['ex13', 'koncowa', 8]], { createdAt: addDays(today, -4) });
  mk('k5', 'Koordynacja i zabawy z piłką', 'u9', 'pawel', 'Radość z gry, kontakt z piłką', [['ex9', 'wstep', 10], ['ex2', 'wstep', 12], ['ex3', 'glowna', 15], ['ex8', 'glowna', 18], ['ex13', 'koncowa', 5]], { dur: 60, kit: 'piłki × 12, pachołki × 16, znaczniki', createdAt: addDays(today, -9) });
  mk('k6', 'Pressing i stałe fragmenty', 'u17', 'tomasz', 'Odbiór po stracie, rożne', [['ex10', 'wstep', 10], ['ex1', 'wstep', 10], ['ex14', 'glowna', 20], ['ex15', 'glowna', 15], ['ex12', 'koncowa', 25], ['ex13', 'koncowa', 8]], { createdAt: addDays(today, -6) });
  db.plans.forEach(k => { if (k.event) { const e = db.events.find(x => x.id === k.event); if (e) e.plan = k.id; k.date = e?.start || null; } });
  db.boards.push({ id: 'b1', name: 'Ustawienie 1-3-2-3 (U12, mecz 9 na 9)', author: 'marek', at: addDays(today, -3), team: 'u12',
    ...d('full', ['gk:4:32:1', 'a:18:14:2', 'a:16:32:4', 'a:18:50:3', 'a:34:24:6', 'a:34:40:8', 'a:52:12:7', 'a:54:32:10', 'a:52:52:11'], [[[], ['run:52:12:70:10', 'run:52:52:70:54']]]) });

  // ---------- fees ----------
  const M = ym(today), periods = [ymAdd(M, -1), M, ymAdd(M, 1)];
  const overdueForce = new Set(), bankList = [];
  db.players.forEach((p, i) => {
    const t = TEAMS.find(x => x.id === p.team);
    periods.forEach((per, k) => {
      const base = t.fee, amount = p.discount ? Math.round(base * (1 - p.discount.pct / 100)) : base;
      const due = ymDate(per, 10);
      let paid = null, method = null;
      if (p.id === 'kuba') { if (k < 2) { paid = addDays(due, -3 - k); method = 'online'; } }
      else if (p.id === 'zosia') { if (k === 0) { paid = addDays(due, -2); method = 'online'; } }
      else {
        const r = R();
        const chance = k === 0 ? 0.94 : k === 1 ? (today > due ? 0.78 : 0.42) : 0.12;
        if (r < chance) {
          paid = Math.min(nowTs - 3600e3, addDays(due, -Math.round(between(-4, 9))));
          if (paid < ymDate(per, 1) - 6 * DAY) paid = ymDate(per, 1);
          method = R() < 0.62 ? 'online' : R() < 0.75 ? 'przelew' : 'gotowka';
        }
      }
      const c = { id: `c-${p.id}-${per}`, player: p.id, period: per, amount, base, disc: p.discount?.label || null, due, paid, method, reminded: [] };
      if (!paid && due < today && k <= 1) { c.reminded.push(addDays(due, 3)); overdueForce.add(p.id); if (bankList.length < 7 && p.parent !== 'kasia' && k === 1) bankList.push(c); }
      db.charges.push(c);
    });
  });
  db.periods = periods;
  db.bankSample = bankList.map((c, i) => {
    const p = P(c.player), par = db.parents.find(x => x.id === p.parent), [y, m] = c.period.split('-');
    const titles = [
      `Skladka ${m}/${y} ${p.first} ${p.last} ${TEAMS.find(t => t.id === p.team).cat}`,
      `${norm(p.last).toUpperCase()} ${norm(p.first).toUpperCase()} SKLADKA ${MONTHS[+m - 1].toUpperCase()}`,
      `Oplata miesieczna - ${p.first} ${p.last}`,
      `skladka ${p.first.toLowerCase()} ${p.last.toLowerCase()} ${MONTHS[+m - 1]}`,
      `Akademia ${p.last} ${p.first[0]}.`,
      `Składka członkowska ${p.first} ${p.last}`,
      `${p.last} ${p.first} - treningi ${m}.${y}`,
    ];
    return { date: isoDay(addDays(today, -Math.min(i + 1, 6))), from: par.name.toUpperCase(), title: titles[i % titles.length], amount: i === 2 ? c.amount / 2 : c.amount };
  });
  db.bankSample.push({ date: isoDay(addDays(today, -2)), from: 'FUNDACJA RUCH DLA DZIECI', title: 'Darowizna na sprzet sportowy', amount: 1500 });
  db.bankSample.push({ date: isoDay(addDays(today, -1)), from: 'JAN KOWALCZYK', title: 'Oplata za oboz zimowy', amount: 950 });

  db.campaigns.push({ id: uid('m'), at: addDays(today, -18) + 10 * 3600e3, by: 'anna', channel: 'email', audience: 'Wszyscy rodzice', text: 'Startują zapisy na obóz zimowy w Karpaczu (1–7 lutego). Szczegóły w aplikacji, w zakładce Ogłoszenia.', count: db.parents.length, cost: 0 });
  db.campaigns.push({ id: uid('m'), at: ymDate(M, 13) + 9 * 3600e3, by: 'anna', channel: 'sms', audience: 'Zaległe składki', text: `Iskra: przypominamy o składce za ${MONTHS[+M.split('-')[1] - 1]}. Zapłacisz w aplikacji Gwizdek w 1 minutę. Dziękujemy!`, count: 14, cost: 14 * SMS_PRICE });
  db.campaigns = db.campaigns.filter(c => c.at < nowTs);

  // ---------- communication ----------
  const parentOf = pid => P(pid).parent;
  const u12Parents = [...new Set(teamPlayers('u12').map(p => p.parent))];
  const h = (dayOff, hhmm) => atTime(addDays(today, dayOff), hhmm);
  db.threads.push({
    id: 't1', kind: 'dm', members: ['kasia', 'marek'], read: { kasia: h(-1, '21:00'), marek: h(-1, '21:00') },
    msgs: [
      { id: uid('m'), from: 'kasia', at: h(-6, '19:12'), text: 'Dzień dobry, czy Kuba może przyjść w piątek na trening trochę później? Ma do 17:00 angielski.' },
      { id: uid('m'), from: 'marek', at: h(-6, '20:03'), text: 'Dzień dobry, jasne. Niech dołączy przy grze, rozgrzewkę zrobi sam przy bocznej linii.' },
      { id: uid('m'), from: 'kasia', at: h(-1, '20:41'), text: 'Dziękuję! A sobotni mecz jest u nas czy na wyjeździe?' },
      { id: uid('m'), from: 'marek', at: h(-1, '20:58'), text: 'Wszystko jest w powołaniu w kalendarzu — proszę tylko potwierdzić, czy Kuba będzie 🙂' },
    ],
  });
  db.threads.push({
    id: 't2', kind: 'group', name: 'Rodzice U12 · Młodziki', team: 'u12', members: ['marek', 'anna', ...u12Parents], read: { marek: h(-2, '22:00'), kasia: h(-3, '22:00') },
    msgs: [
      { id: uid('m'), from: 'marek', at: h(-4, '18:45'), text: 'Szanowni Państwo, od listopada wtorkowe zajęcia dodatkowe na hali dla chętnych. Zapisy u mnie do piątku.' },
      { id: uid('m'), from: u12Parents[2], at: h(-4, '19:20'), text: 'Zgłaszam Antka 👍' },
      { id: uid('m'), from: u12Parents[7], at: h(-4, '20:02'), text: 'My też chętnie. O której będą zajęcia?' },
      { id: uid('m'), from: 'marek', at: h(-4, '20:30'), text: '17:30–18:30, hala przy szkole. Obuwie halowe obowiązkowe.' },
      { id: uid('m'), from: u12Parents[10], at: h(-2, '08:15'), text: 'Czy w sobotę zbiórka jak zwykle 45 minut przed meczem?' },
    ],
  });
  db.threads.push({
    id: 't3', kind: 'dm', members: ['anna', 'marek'], read: { anna: h(0, '07:00'), marek: h(-1, '18:00') },
    msgs: [
      { id: uid('m'), from: 'anna', at: h(-1, '16:10'), text: 'Marek, do certyfikacji PZPN potrzebuję konspektów z ostatnich 4 tygodni dla U12. Możesz je oznaczyć jako udostępnione?' },
      { id: uid('m'), from: 'anna', at: h(-1, '16:11'), text: 'I przypomnij proszę rodzicom o badaniach — w U12 dwóm osobom kończą się w tym miesiącu.' },
    ],
  });
  db.threads.push({
    id: 't4', kind: 'group', name: 'Sztab szkoleniowy', members: ['anna', 'marek', 'pawel', 'tomasz', 'ola'], read: { anna: h(0, '07:00'), marek: h(-1, '22:00') },
    msgs: [
      { id: uid('m'), from: 'ola', at: h(-2, '21:05'), text: `Aktualizacja zdrowia: ${u15[9].first} ${u15[9].last} (U15) — przerwa jeszcze ok. tydzień. ${u15[6].first} ${u15[6].last} — bez skoków i siłowni na nogi.` },
      { id: uid('m'), from: 'tomasz', at: h(-1, '09:30'), text: 'W sobotę potrzebuję całego boiska od 14:00 na rozgrzewkę U17. Anna, czy orlik jest wtedy wolny dla U9?' },
      { id: uid('m'), from: 'anna', at: h(-1, '10:02'), text: 'U9 kończy festiwal o 12:00, od 13:00 orlik jest wynajęty. Boisko główne masz od 14:00.' },
      { id: uid('m'), from: 'pawel', at: h(0, '07:40'), text: 'Mam nowy konspekt z koordynacji dla Żaków — wrzuciłem do bazy, można korzystać.' },
    ],
  });
  db.threads.push({
    id: 't5', kind: 'dm', members: ['kasia', 'anna'], read: { kasia: h(-9, '12:00'), anna: h(-9, '12:00') },
    msgs: [
      { id: uid('m'), from: 'kasia', at: h(-9, '11:20'), text: 'Dzień dobry, czy przy dwójce dzieci przysługuje zniżka na składkę?' },
      { id: uid('m'), from: 'anna', at: h(-9, '11:48'), text: 'Dzień dobry! Tak, na młodsze dziecko −20%. Ustawiłam już zniżkę dla Zosi, będzie widoczna od tego miesiąca.' },
    ],
  });

  db.posts.push({ id: uid('s'), scope: 'u12', author: 'marek', at: h(-2, '21:30'), text: `Analiza meczu z poprzedniej soboty — trzy klipy: wyjście spod pressingu, stała gra, kontratak. Obejrzyjcie przed piątkowym treningiem, porozmawiamy o tym w szatni.`, files: [{ name: 'analiza-mecz-klipy.mp4', kind: 'video', size: '148 MB' }], likes: ['kasia', u12Parents[1], u12Parents[4]], comments: [{ from: u12Parents[4], at: h(-2, '22:10'), text: 'Super materiał, syn obejrzał dwa razy 😄' }] });
  db.posts.push({ id: uid('s'), scope: 'u12', author: 'marek', at: h(-5, '17:00'), text: 'Zadanie domowe na tydzień: 3 × 10 minut żonglerki, słabsza noga. Wynik wpisujemy w zakładce „Praca indywidualna”.', files: [{ name: 'zonglerka-plan.pdf', kind: 'pdf', size: '320 kB' }], likes: [u12Parents[0]], comments: [] });
  db.posts.push({ id: uid('s'), scope: 'u9', author: 'pawel', at: h(-3, '19:00'), text: 'Żaki! W sobotę festiwal na orliku. Prosimy o picie w podpisanych bidonach i ochraniacze. Rodziców zapraszamy na trybuny 😊', files: [], likes: ['kasia'], comments: [] });
  db.posts.push({ id: uid('s'), scope: 'u15', author: 'marek', at: h(-1, '20:00'), text: 'Przypominam o porannej ankiecie samopoczucia — zajmuje 20 sekund. Na jej podstawie dobieramy obciążenie na treningu.', files: [], likes: [], comments: [] });
  db.posts.push({ id: uid('s'), scope: 'club', author: 'anna', at: h(-1, '12:00'), text: `Zdjęcia drużynowe — ${fmtLong(photo)}, hala sportowa. U9 16:00, U12 16:40, U15 17:20, U17 18:00. Komplet strojów meczowych!`, files: [{ name: 'harmonogram-zdjec.pdf', kind: 'pdf', size: '96 kB' }], likes: ['marek', 'kasia'], comments: [], pinned: true });
  db.posts.push({ id: uid('s'), scope: 'club', author: 'anna', at: h(-18, '10:00'), text: 'Obóz zimowy Karpacz, 1–7 lutego. Koszt 1 850 zł, zaliczka 500 zł do 30 listopada. Zapisy przez formularz w aplikacji.', files: [{ name: 'oboz-zimowy-regulamin.pdf', kind: 'pdf', size: '412 kB' }], likes: ['kasia', 'marek', u12Parents[5]], comments: [] });
  db.posts.push({ id: uid('s'), scope: 'staff', author: 'anna', at: h(-6, '09:00'), text: 'Nowe wytyczne PZPN do konspektów w programie certyfikacji — wrzucam PDF. Prośba o stosowanie od listopada.', files: [{ name: 'wytyczne-konspekty-2026.pdf', kind: 'pdf', size: '1,2 MB' }], likes: ['marek', 'tomasz'], comments: [] });

  // ---------- notifications ----------
  const note = (to, at, title, body, link, icon = 'bell') => db.notes.push({ id: uid('n'), to, at, title, body, link, icon, read: false });
  if (m12) note('kasia', m12.callupAt, 'Powołanie na mecz', `Kuba — ${m12.title}, ${fmtDay(m12.start)} ${fmtTime(m12.start)}. Potwierdź obecność.`, `#/wydarzenie/${m12.id}`, 'flag');
  const zOver = db.charges.find(c => c.player === 'zosia' && c.period === M);
  if (zOver && zOver.due < today) note('kasia', addDays(zOver.due, 3) + 9 * 3600e3, 'Przypomnienie o składce', `Zosia — ${ymLabel(M)}, ${zl(zOver.amount)}.`, '#/skladki', 'coins');
  note('kasia', h(-1, '20:58'), 'Marek Zieliński', 'Wszystko jest w powołaniu w kalendarzu — proszę tylko potwierdzić…', '#/komunikacja?t=msg&c=t1', 'chat');
  if (nextTr12) note('marek', nextTr12.absences[u12[3].id].at, 'Zgłoszona nieobecność', `${u12[3].first} ${u12[3].last} — ${fmtDay(nextTr12.start)}: przeziębienie.`, `#/wydarzenie/${nextTr12.id}`, 'user');
  note('marek', h(-1, '16:10'), 'Anna Wójcik', 'Do certyfikacji PZPN potrzebuję konspektów…', '#/komunikacja?t=msg&c=t3', 'chat');
  note('anna', h(-1, '09:30'), 'Tomasz Lis w „Sztab szkoleniowy”', 'W sobotę potrzebuję całego boiska od 14:00…', '#/komunikacja?t=msg&c=t4', 'chat');

  // ---------- recruitment ----------
  db.form = {
    id: 'f1', title: `Nabór do grup naborowych — roczniki ${season.start - 7} i ${season.start - 6}`, open: true,
    desc: 'Zapraszamy dzieci na bezpłatny trening próbny. Po zgłoszeniu skontaktujemy się i zaproponujemy termin.',
  };
  const kidsNames = [['Leon', 'Kmieć'], ['Helena', 'Rogalska'], ['Tadeusz', 'Fijałkowski'], ['Natan', 'Wrona'], ['Zuzanna', 'Lis-Malec']];
  const parentsNames = ['Marta Kmieć', 'Piotr Rogalski', 'Ewa Fijałkowska', 'Dawid Wrona', 'Joanna Lis-Malec'];
  kidsNames.forEach(([f, l], i) => db.apps.push({
    id: 'a' + (i + 1), at: addDays(today, -(i * 3 + 1)) + 10 * 3600e3, child: `${f} ${l}`, birth: isoDay(+new Date(season.start - 7 + (i % 2), (i * 3) % 12, 5 + i)),
    parent: parentsNames[i], phone: phone(), email: mail(parentsNames[i]), exp: ['Nie trenował(a)', 'Rok w innej szkółce', 'Nie trenował(a)', 'Zajęcia w przedszkolu', 'Nie trenował(a)'][i],
    src: ['Polecenie znajomych', 'Facebook', 'Ulotka w szkole', 'Polecenie znajomych', 'Strona klubu'][i], status: ['new', 'new', 'trial', 'accepted', 'rejected'][i], trial: null, playerId: null,
  }));
  const trialEv = db.events.find(e => e.team === 'u9' && e.type === 'training' && e.start > nowTs);
  if (trialEv) db.apps[2].trial = trialEv.id;

  return db;
}
