// ClientTracker v1 — demo data (Q-3). Every client, address and ticket here is fictional.
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
  return { clients, tickets, entries, settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), seq: { ticket: 6, entry: eid, client: 4 } };
}
