// ClientTracker v3 — the team (simulated accounts): the owner and a test employee with fewer rights.
// Rights are checked here, in the "server" functions, so a hidden button is never the only barrier (403, T-1).

const STAFF = [
  { id: 'u1', name: 'Właściciel', initials: 'WŁ', email: 'wlasciciel@clienttracker.test', password: 'makieta-demo-2026', role: 'owner', secret: 'JBSWY3DPEHPK3PXPMKTR' },
  { id: 'u2', name: 'Pracownik testowy', initials: 'PT', email: 'pracownik@clienttracker.test', password: 'pracownik-demo-2026', role: 'employee', secret: 'KRSXG5CTMVRXEZLUMFZW' },
];
const ROLE_LABEL = { owner: 'właściciel', employee: 'pracownik', client: 'klient' };
const staffById = id => STAFF.find(u => u.id === id) || null;
const staffName = id => (id && staffById(id)?.name) || 'nikt';
// accounts survive reset-demo (Q-1), so their state lives outside the demo data
const staffActive = id => !store.get('staffBlocked', []).includes(id);

const PERMS = {
  owner: new Set(['tickets.create', 'tickets.status.any', 'tickets.edit', 'tickets.reaction', 'tickets.assign.any', 'entries.any', 'clients.edit', 'clients.portal', 'money', 'month', 'settings', 'team']),
  employee: new Set(['tickets.create', 'tickets.status.own', 'tickets.assign.self']),
};
// the rights table on the settings page: [what, owner, employee]
const PERM_TABLE = [
  ['Pulpit, zgłoszenia, karty klientów', 'tak', 'tak, bez kwot'],
  ['Przyjęcie nowego zgłoszenia', 'tak', 'tak'],
  ['Zmiana statusu (pierwsza zapisuje reakcję)', 'każde zgłoszenie', 'swoje i nieprzypisane'],
  ['Przypisanie zgłoszenia', 'komukolwiek', 'wziąć dla siebie albo oddać'],
  ['Wpisy czasu', 'wszystkie', 'dodaje i poprawia tylko swoje'],
  ['Edycja zgłoszenia (priorytet, przyjęte), poprawka reakcji', 'tak', 'nie'],
  ['Klienci: dodanie, edycja, nieaktywny, panel klienta', 'tak', 'nie'],
  ['Kwoty: abonament, stawka, prace dodatkowe', 'tak', 'nie'],
  ['Miesiąc i raport dla klienta', 'tak', 'nie'],
  ['Ustawienia i konta zespołu', 'tak', 'nie'],
];

const actor = () => { const s = store.get('session', null); return s && s.role !== 'client' ? staffById(s.userId || 'u1') : null; };
const can = p => { const a = actor(); return !!a && PERMS[a.role].has(p); };
class Forbidden extends Error { constructor(msg) { super(msg); this.forbidden = true; } }
const need = (p, msg = 'Brak uprawnień (403): to może zrobić tylko właściciel.') => { if (!can(p)) throw new Forbidden(msg); };
const mayWork = t => can('tickets.status.any') || (can('tickets.status.own') && (t.assignee == null || t.assignee === actor().id));
const entryBy = e => e.by || 'u1';
const mayEditEntry = e => can('entries.any') || entryBy(e) === actor()?.id;

function setStaffActive(id, on) {
  need('team');
  if (staffById(id).role === 'owner') throw new Forbidden('Konta właściciela nie da się zablokować.');
  const b = new Set(store.get('staffBlocked', []));
  if (on) b.delete(id); else b.add(id);
  store.set('staffBlocked', [...b]);
}
function assignTicket(no, userId) {
  const t = ticketByNo(no), a = actor();
  if ((t.assignee || null) === (userId || null)) return t;
  if (!can('tickets.assign.any')) {
    const take = userId === a.id && t.assignee == null, giveBack = userId == null && t.assignee === a.id;
    if (!(can('tickets.assign.self') && (take || giveBack))) throw new Forbidden('Pracownik może wziąć nieprzypisane zgłoszenie dla siebie albo oddać swoje.');
  }
  if (userId && !staffById(userId)) throw new Forbidden('Nie ma takiego konta.');
  t.history.push({ at: clock.now(), field: 'przypisane', from: staffName(t.assignee), to: staffName(userId) });
  t.assignee = userId || null;
  save();
  return t;
}

// the "server" functions with their rights checks
{
  const wrap = (fn, guard) => (...args) => { guard(...args); return fn(...args); };
  const baseCreateTicket = createTicket, baseSetStatus = setStatus, baseCreateEntry = createEntry, baseUpdateEntry = updateEntry, baseDeleteEntry = deleteEntry;
  createTicket = d => {
    if (store.get('session', null)?.role !== 'client') need('tickets.create');
    const t = baseCreateTicket(d);
    t.assignee = null;
    save();
    return t;
  };
  setStatus = (no, to) => {
    const t = ticketByNo(no), a = actor();
    if (!mayWork(t)) throw new Forbidden(`Zgłoszenie #${no} prowadzi: ${staffName(t.assignee)}. Pracownik zmienia status tylko swoich i nieprzypisanych.`);
    const r = baseSetStatus(no, to);
    if (t.assignee == null) { t.history.push({ at: clock.now(), field: 'przypisane', from: 'nikt', to: a.name }); t.assignee = a.id; save(); }
    return r;
  };
  updateTicket = wrap(updateTicket, () => need('tickets.edit', 'Brak uprawnień (403): priorytet i godzinę przyjęcia zmienia właściciel.'));
  setReaction = wrap(setReaction, () => need('tickets.reaction', 'Brak uprawnień (403): godzinę reakcji poprawia właściciel.'));
  createClient = wrap(createClient, () => need('clients.edit'));
  updateClient = wrap(updateClient, () => need('clients.edit'));
  setPortal = wrap(setPortal, () => need('clients.portal'));
  saveSettings = wrap(saveSettings, () => need('settings'));
  createEntry = d => { if (!actor()) throw new Forbidden('Brak uprawnień (403).'); const x = baseCreateEntry(d); x.by = actor().id; save(); return x; };
  const own = id => { const e = DB.entries.find(x => x.id === id); if (!mayEditEntry(e)) throw new Forbidden(`To wpis: ${staffName(entryBy(e))}. Pracownik poprawia i usuwa tylko swoje wpisy.`); };
  updateEntry = wrap(baseUpdateEntry, own);
  deleteEntry = wrap(baseDeleteEntry, own);
}

// demo data: who handled what. Reset-demo re-seeds it; accounts and sessions stay.
function seedTeam() {
  for (const t of DB.tickets) if (!('assignee' in t)) t.assignee = t.status === 'Nowe' ? null : t.no % 3 === 1 ? 'u2' : 'u1';
  for (const e of DB.entries) if (!e.by) e.by = (e.ticketNo && ticketByNo(e.ticketNo)?.assignee) || 'u1';
}
seedTeam();
{
  const baseReset = resetDemo;
  resetDemo = (...a) => { baseReset(...a); seedTeam(); save(); };
}
