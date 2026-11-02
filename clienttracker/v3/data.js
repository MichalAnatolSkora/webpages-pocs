// ClientTracker v3 — demo data (Q-3). Every client, address and ticket here is fictional.
// Deadlines are not written down: seedDemo() computes them with the same code the app uses, the comments hold the values to check against.

const DEFAULT_SETTINGS = { biz: { from: 540, to: 1020 }, day: { from: 600, to: 1320 }, rate: 250 };
const PACKAGE_DEFAULTS = { Basic: { price: 400, pool: 0 }, Standard: { price: 900, pool: 3 }, Premium: { price: 1800, pool: 8 } };
const SOURCES = ['Mail', 'Formularz', 'Telefon', 'Monitoring', 'Własne'];
const STATUSES = ['Nowe', 'W toku', 'Czeka na klienta', 'Zrobione', 'Odrzucone'];
const KINDS = ['Pula', 'Utrzymanie', 'Dodatkowe'];

const DEMO_CLIENTS = [
  { id: 'c1', name: 'Kawiarnia Demo', email: 'kontakt@kawiarnia-demo.test', pkg: 'Basic', price: 400, pool: 0, active: true, portal: true },
  { id: 'c2', name: 'Bistro Testowe', email: 'biuro@bistro-testowe.test', pkg: 'Standard', price: 900, pool: 3, active: true, portal: true },
  { id: 'c3', name: 'Pizzeria Przykładowa', email: 'zamowienia@pizzeria-przykladowa.test', pkg: 'Premium', price: 1800, pool: 8, active: true, portal: true },
];

// [no, client, title, description, priority, source, received, reaction, status changes [at, to], time entries [kind, hours, date, note]]
const DEMO_TICKETS = [
  [1, 'c1', 'Zmiana godzin otwarcia', 'Od listopada otwieramy o 8:00, w weekendy do 18:00. Prosimy o zmianę na stronie i w stopce.', 'Normalny', 'Mail',
    '2026-10-05T11:00', '2026-10-06T10:00', [['2026-10-06T10:00', 'W toku'], ['2026-10-06T10:30', 'Zrobione']],
    [['Utrzymanie', 0.25, '2026-10-06', 'Godziny w stopce i na stronie kontaktu']]], // termin 12.10.2026 17:00
  [2, 'c2', 'Nie działa płatność online', 'Klienci zgłaszają błąd przy płatności kartą w zamówieniach na wynos. Od rana żadnej udanej transakcji.', 'Krytyczny', 'Mail',
    '2026-10-09T16:00', '2026-10-09T18:30', [['2026-10-09T18:30', 'W toku'], ['2026-10-10T12:00', 'Zrobione']],
    [['Utrzymanie', 1, '2026-10-09', 'Diagnoza: wygasły klucz bramki płatności, nowy klucz, płatność testowa']]], // termin 12.10.2026 12:00
  [3, 'c2', 'Promocja na Halloween na stronie głównej', 'Baner z dynią i kod rabatowy -15% na zestawy, od 24 do 31 października.', 'Normalny', 'Mail',
    '2026-10-14T10:00', '2026-10-20T09:00', [['2026-10-20T09:00', 'W toku'], ['2026-10-21T20:00', 'Zrobione']],
    [['Pula', 1.5, '2026-10-20', 'Baner, kod rabatowy w koszyku'], ['Pula', 1, '2026-10-21', 'Poprawki po uwagach, publikacja']]], // termin 19.10.2026 17:00
  [4, 'c2', 'Moduł rezerwacji stolików: wycena', 'Rezerwacje online z wyborem sali i godziny, potwierdzenie SMS-em. Prośba o wycenę i termin.', 'Normalny', 'Telefon',
    '2026-10-22T12:00', '2026-10-22T19:00', [['2026-10-22T19:00', 'W toku']],
    [['Dodatkowe', 2, '2026-10-24', 'Zakres, makieta ekranów, kosztorys']]], // termin 27.10.2026 17:00
  [5, 'c2', 'Kończy się certyfikat SSL', 'Monitoring: certyfikat bistro-testowe.test wygasa za 3 dni, automatyczne odnowienie się nie udało.', 'Wysoki', 'Monitoring',
    '2026-10-27T08:00', '2026-10-27T20:00', [['2026-10-27T20:00', 'W toku'], ['2026-10-27T20:30', 'Zrobione']],
    [['Utrzymanie', 0.5, '2026-10-27', 'Odnowienie certyfikatu, naprawa zadania odnawiania']]], // termin 28.10.2026 17:00
  [6, 'c3', 'Zdjęcia w menu się nie ładują', 'Formularz kontaktowy: w menu na telefonie zamiast zdjęć pizz są puste ramki.', 'Wysoki', 'Formularz',
    '2026-10-30T15:00', null, [], []], // termin 02.11.2026 11:00
];

function seedDemo() {
  const win = { biz: { ...DEFAULT_SETTINGS.biz }, day: { ...DEFAULT_SETTINGS.day } };
  const clients = DEMO_CLIENTS.map(c => ({ ...c }));
  const tickets = [], entries = [];
  let eid = 1;
  for (const [no, clientId, title, desc, priority, source, rec, react, changes, times] of DEMO_TICKETS) {
    const client = clients.find(c => c.id === clientId);
    const receivedAt = fromLocalInput(rec);
    const t = {
      no, clientId, title, desc, priority, source, receivedAt,
      pkg: client.pkg, win: JSON.parse(JSON.stringify(win)),
      deadline: reactionDeadline(receivedAt, client.pkg, priority, win),
      status: 'Nowe', reactedAt: react ? fromLocalInput(react) : null, closedAt: null,
      createdAt: receivedAt, history: [],
    };
    for (const [at, to] of changes) {
      const ms = fromLocalInput(at);
      t.history.push({ at: ms, field: 'status', from: t.status, to });
      t.status = to;
      t.closedAt = to === 'Zrobione' || to === 'Odrzucone' ? ms : null;
    }
    tickets.push(t);
    for (const [kind, hours, date, note] of times) entries.push({ id: 'e' + eid++, clientId, ticketNo: no, date, hours, kind, desc: note });
  }
  return { dataset: 'small', clients, tickets, entries, settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), seq: { ticket: 6, entry: eid, client: 4 } };
}

// ---------- 100 clients: the Q-3 set plus 97 generated ones, same seed every time ----------
const GEN_BIZ = [
  ['Piekarnia', 1], ['Kwiaciarnia', 1], ['Salon fryzjerski', 0], ['Warsztat samochodowy', 0], ['Kancelaria', 1], ['Gabinet fizjoterapii', 0],
  ['Pracownia krawiecka', 1], ['Studio jogi', 2], ['Księgarnia', 1], ['Pensjonat', 0], ['Szkoła językowa', 1], ['Biuro rachunkowe', 2],
  ['Sklep rowerowy', 0], ['Cukiernia', 1], ['Pizzeria', 1], ['Kawiarnia', 1], ['Bistro', 2], ['Galeria', 1], ['Hotel', 0], ['Przedszkole', 2],
  ['Szkoła tańca', 1], ['Gabinet weterynaryjny', 0], ['Optyk', 0], ['Restauracja', 1], ['Studio tatuażu', 2],
];
const GEN_ADJ = [
  ['Testowy', 'Testowa', 'Testowe'], ['Przykładowy', 'Przykładowa', 'Przykładowe'], ['Próbny', 'Próbna', 'Próbne'], ['Wzorcowy', 'Wzorcowa', 'Wzorcowe'],
  ['Modelowy', 'Modelowa', 'Modelowe'], ['Pokazowy', 'Pokazowa', 'Pokazowe'], ['Fikcyjny', 'Fikcyjna', 'Fikcyjne'], ['Umowny', 'Umowna', 'Umowne'],
  ['Zmyślony', 'Zmyślona', 'Zmyślone'], ['Demo', 'Demo', 'Demo'],
];
const GEN_TITLES = {
  user: ['Nie działa formularz kontaktowy', 'Aktualizacja cennika', 'Nowe zdjęcia w galerii', 'Zmiana numeru telefonu w stopce', 'Dodanie podstrony z ofertą',
    'Promocja świąteczna na stronie głównej', 'Nie przychodzą maile z formularza', 'Mapa dojazdu się nie wyświetla', 'Zmiana godzin otwarcia', 'Nowy wpis na blogu',
    'Integracja z systemem rezerwacji: wycena', 'Strona źle wygląda na telefonie', 'Literówka w menu', 'Dodanie regulaminu', 'Zmiana logo', 'Baner z informacją o urlopie',
    'Formularz zapisu na newsletter', 'Błąd 500 na stronie głównej', 'Wolne ładowanie strony'],
  machine: ['Wygasa certyfikat SSL', 'Kończy się domena', 'Kopia zapasowa się nie wykonała', 'Dużo nieudanych prób logowania', 'Strona nie odpowiada', 'Aktualizacje bezpieczeństwa wtyczek'],
};
const GEN_NOTES = ['Diagnoza i poprawka', 'Wdrożenie zmian', 'Poprawki po uwagach klienta', 'Konsultacja telefoniczna', 'Testy i publikacja', 'Aktualizacja i sprawdzenie'];

function seedLarge() {
  let s = 20261102;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const weighted = pairs => { let r = rnd(), acc = 0; for (const [v, w] of pairs) { acc += w; if (r < acc) return v; } return pairs[pairs.length - 1][0]; };
  const slug = n => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const base = seedDemo();
  const win = { biz: { ...DEFAULT_SETTINGS.biz }, day: { ...DEFAULT_SETTINGS.day } };
  const anchor = fromLocalInput('2026-11-02T09:00');
  const firstDay = dnOf(2026, 10, 1), lastDay = wParts(anchor).dn;

  // clients: unique "type + adjective" names, no clash with the Q-3 ones
  const taken = new Set(base.clients.map(c => c.name));
  const combos = [];
  for (const [biz, g] of GEN_BIZ) for (const adj of GEN_ADJ) combos.push(`${biz} ${adj[g]}`);
  for (let i = combos.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [combos[i], combos[j]] = [combos[j], combos[i]]; }
  const clients = [...base.clients];
  for (const name of combos) {
    if (clients.length >= 100) break;
    if (taken.has(name)) continue;
    taken.add(name);
    const pkg = weighted([['Basic', 0.4], ['Standard', 0.42], ['Premium', 0.18]]);
    const d = PACKAGE_DEFAULTS[pkg], custom = rnd() < 0.15;
    clients.push({
      id: 'c' + (clients.length + 1), name, email: `kontakt@${slug(name)}.test`, pkg,
      price: custom ? d.price + pick([-100, 100, 200]) : d.price, pool: custom && d.pool ? d.pool + 1 : d.pool, active: rnd() > 0.06, portal: clients.length % 9 < 5,
    });
  }

  // tickets keep a temporary key; numbers are given at the end in order of receipt
  const tickets = base.tickets.map(t => ({ ...t, _k: 'q' + t.no }));
  const entries = base.entries.map(e => ({ ...e, _k: 'q' + e.ticketNo }));
  let k = 0;
  for (const c of clients.slice(3)) {
    const n = weighted([[0, 0.2], [1, 0.35], [2, 0.3], [3, 0.15]]);
    for (let i = 0; i < n; i++) {
      const dn = firstDay + Math.floor(rnd() * (lastDay - firstDay + 1));
      const busy = isBizDay(dn) && rnd() < 0.75;
      const minute = busy ? 8 * 60 + Math.floor(rnd() * 10 * 4) * 15 : 7 * 60 + Math.floor(rnd() * 15 * 4) * 15;
      const receivedAt = Math.min(fromW(dn, minute), anchor - 30 * MIN);
      const source = weighted([['Mail', 0.4], ['Formularz', 0.2], ['Telefon', 0.2], ['Monitoring', 0.12], ['Własne', 0.08]]);
      const machine = source === 'Monitoring' || source === 'Własne';
      const priority = weighted(machine ? [['Krytyczny', 0.2], ['Wysoki', 0.5], ['Normalny', 0.3]] : [['Krytyczny', 0.08], ['Wysoki', 0.25], ['Normalny', 0.67]]);
      const deadline = reactionDeadline(receivedAt, c.pkg, priority, win);
      const age = (anchor - receivedAt) / DAY;
      let status = age < 1.5 ? weighted([['Nowe', 0.45], ['W toku', 0.35], ['Czeka na klienta', 0.2]])
        : age < 6 ? weighted([['Nowe', 0.08], ['W toku', 0.3], ['Czeka na klienta', 0.15], ['Zrobione', 0.42], ['Odrzucone', 0.05]])
        : weighted([['W toku', 0.05], ['Czeka na klienta', 0.05], ['Zrobione', 0.84], ['Odrzucone', 0.06]]);
      if (!c.active && (status === 'Nowe' || status === 'W toku')) status = 'Zrobione';
      const t = {
        _k: 'g' + k++, no: 0, clientId: c.id, title: pick(machine ? GEN_TITLES.machine : GEN_TITLES.user), desc: '', priority, source, receivedAt,
        pkg: c.pkg, win: JSON.parse(JSON.stringify(win)), deadline, status: 'Nowe', reactedAt: null, closedAt: null, createdAt: receivedAt, history: [],
      };
      if (status !== 'Nowe') {
        const late = rnd() < 0.12;
        let rx = late ? deadline + (0.5 + rnd() * 30) * HOUR : receivedAt + (deadline - receivedAt) * (0.05 + rnd() * 0.85);
        rx = Math.round(Math.min(rx, anchor - 10 * MIN) / (5 * MIN)) * 5 * MIN;
        if (rx > receivedAt) {
          const step = (at, to) => { t.history.push({ at, field: 'status', from: t.status, to }); t.status = to; t.closedAt = isClosedStatus(to) ? at : null; };
          t.reactedAt = rx;
          if (status === 'Odrzucone') step(rx, 'Odrzucone');
          else {
            step(rx, 'W toku');
            const later = Math.min(rx + (0.5 + rnd() * 40) * HOUR, anchor - 5 * MIN);
            if (status !== 'W toku' && later > rx) step(Math.round(later / (5 * MIN)) * 5 * MIN, status);
          }
          if (t.status !== 'Odrzucone') {
            for (let j = 0, m = 1 + (rnd() < 0.35); j < m; j++) {
              const kind = machine || priority !== 'Normalny' ? 'Utrzymanie'
                : weighted(c.pool ? [['Pula', 0.6], ['Dodatkowe', 0.2], ['Utrzymanie', 0.2]] : [['Dodatkowe', 0.45], ['Utrzymanie', 0.55]]);
              const edn = Math.min(wParts(rx).dn + j, lastDay);
              entries.push({ _k: t._k, clientId: c.id, date: isoOf(edn), hours: pick([0.25, 0.5, 0.75, 1, 1, 1.5, 2, 2.5, 3]), kind, desc: pick(GEN_NOTES) });
            }
          }
        }
      }
      tickets.push(t);
    }
    if (c.active && rnd() < 0.25) entries.push({ _k: null, clientId: c.id, date: isoOf(firstDay + Math.floor(rnd() * 28)), hours: 0.5, kind: 'Utrzymanie', desc: 'Aktualizacje i kopia zapasowa' });
  }

  tickets.sort((a, b) => a.receivedAt - b.receivedAt);
  const noOf = {};
  tickets.forEach((t, i) => { t.no = i + 1; noOf[t._k] = t.no; delete t._k; });
  entries.sort((a, b) => a.date.localeCompare(b.date));
  entries.forEach((e, i) => { e.id = 'e' + (i + 1); e.ticketNo = e._k ? noOf[e._k] : null; delete e._k; });
  return { ...base, dataset: 'large', clients, tickets, entries, seq: { ticket: tickets.length, entry: entries.length + 1, client: clients.length + 1 } };
}
const isClosedStatus = s => s === 'Zrobione' || s === 'Odrzucone';
