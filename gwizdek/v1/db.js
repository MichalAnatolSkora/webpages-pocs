// Gwizdek v1 — the shared database (one copy in localStorage for every tab), the role of this tab,
// lookups, derived statuses (medical, attendance, fees, training load) and live sync between tabs.

const DB_KEY = 'gwizdek-v1-db';
const ROLE_KEY = 'gwizdek-v1-role';

let db = loadDb();

function loadDb() {
  const d = store.get(DB_KEY, null);
  if (d && d.v === 1 && d.seededFor === isoDay(Date.now())) return d;
  const fresh = seed();
  store.set(DB_KEY, fresh);
  if (d) setTimeout(() => toast('Kalendarz demo ustawiony na dziś — dane wygenerowane od nowa', 'refresh'), 800);
  return fresh;
}

function resetDb() {
  store.drop(DB_KEY);
  db = loadDb();
}

// Every write starts from the latest stored copy, so two tabs never overwrite each other.
// Inside fn, look things up again by id: objects fetched before the call belong to the old copy.
function mutate(fn) {
  const latest = store.get(DB_KEY, null);
  if (latest && latest.v === 1) db = latest;
  const r = fn(db);
  store.set(DB_KEY, db);
  return r;
}

// ---------- role (per tab, so a coach and a parent can sit side by side) ----------
function readRole() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '').get('as');
  if (q && ROLES[q]) { saveRole(q); return q; }
  try { return sessionStorage.getItem(ROLE_KEY) || store.get(ROLE_KEY, 'coach'); } catch (e) { return 'coach'; }
}
function saveRole(r) {
  try { sessionStorage.setItem(ROLE_KEY, r); } catch (e) {}
  store.set(ROLE_KEY, r);
}
let role = readRole();
const me = () => ROLES[role].user;
const isParent = () => role === 'parent';
const isCoord = () => role === 'coord';

// ---------- lookups ----------
const team = id => TEAMS.find(t => t.id === id);
const player = id => db.players.find(p => p.id === id);
const parentRec = id => db.parents.find(p => p.id === id);
const staff = id => STAFF.find(s => s.id === id);
const person = id => staff(id) || parentRec(id) || null;
const personName = id => person(id)?.name || 'Ktoś';
const personColor = id => staff(id)?.color || '#6b7a72';
const pname = p => `${p.first} ${p.last}`;
const eventById = id => db.events.find(e => e.id === id);
const exById = id => db.exercises.find(x => x.id === id);
const planById = id => db.plans.find(x => x.id === id);
const facility = id => FACILITIES.find(f => f.id === id);
const facNames = ids => (ids || []).map(id => facility(id)?.short).join(' + ');
const teamPlayers = t => db.players.filter(p => p.team === t).sort((a, b) => a.num - b.num);
const teamLabel = t => (t === 'all' ? 'Cały klub' : `${team(t).cat} · ${team(t).name}`);
const teamColor = t => (t === 'all' ? 'var(--pitch)' : team(t).color);

const myKids = () => (isParent() ? parentRec(me()).kids.map(player).filter(Boolean) : []);
const kidColor = (p, i) => ['#2f6fe0', '#d99a00', '#d6453d'][i % 3];
function myTeams() {
  if (role === 'coach') return TEAMS.filter(t => t.coach === me());
  if (isParent()) return [...new Set(myKids().map(k => k.team))].map(team);
  return TEAMS;
}
const myTeamIds = () => myTeams().map(t => t.id);
const canEditTeam = t => isCoord() || (role === 'coach' && team(t)?.coach === me());

// ---------- statuses ----------
function medStatus(p, now = Date.now()) {
  const d = daysBetween(now, p.medUntil);
  if (d < 0) return { cls: 'bad', short: 'nieważne', label: `Badanie nieważne od ${fmtDate(p.medUntil)}`, d };
  if (d <= 30) return { cls: 'warn', short: `${d} dni`, label: `Badanie wygasa za ${nOf(d, 'dzień', 'dni', 'dni')}`, d };
  return { cls: 'ok', short: 'ważne', label: `Badanie ważne do ${fmtDate(p.medUntil)}`, d };
}
const activeInjury = p => p.injuries.find(i => i.status !== 'healed');

function attendanceOf(pid, days = 30, now = Date.now()) {
  const p = player(pid);
  const evs = db.events.filter(e => e.team === p.team && e.type === 'training' && e.end < now && e.start > now - days * DAY && e.att[pid]);
  const ok = evs.filter(e => e.att[pid] === 'present' || e.att[pid] === 'late').length;
  return { ok, total: evs.length, pct: pct(ok, evs.length) };
}
function teamAttendance(tid, days = 30, now = Date.now()) {
  const evs = db.events.filter(e => e.team === tid && e.type === 'training' && e.end < now && e.start > now - days * DAY && Object.keys(e.att).length);
  let ok = 0, all = 0;
  evs.forEach(e => Object.values(e.att).forEach(v => { all++; if (v === 'present' || v === 'late') ok++; }));
  return { pct: pct(ok, all), sessions: evs.length };
}

function chargeStatus(c, now = Date.now()) {
  if (c.paid) return 'paid';
  return c.due < startOfDay(now) ? 'overdue' : 'due';
}
const CHARGE = {
  paid: { label: 'Opłacona', cls: 'ok' },
  due: { label: 'Do zapłaty', cls: 'info' },
  overdue: { label: 'Zaległa', cls: 'bad' },
};
const chargesOf = pid => db.charges.filter(c => c.player === pid).sort((a, b) => a.period.localeCompare(b.period));
const overdueOf = pid => chargesOf(pid).filter(c => chargeStatus(c) === 'overdue');

// Training load = session RPE × minutes. ACWR = acute (7-day) average / chronic (28-day) average.
function loadsOf(pid, now = Date.now()) {
  const out = {};
  db.events.forEach(e => {
    if (!e.rpe || e.rpe[pid] == null || e.start > now) return;
    const min = e.type === 'match' ? e.stats?.[pid]?.min || 60 : Math.round((e.end - e.start) / MIN);
    const k = isoDay(e.start);
    out[k] = (out[k] || 0) + e.rpe[pid] * min;
  });
  return out;
}
function acwr(pid, now = Date.now()) {
  const L = loadsOf(pid, now), today = startOfDay(now);
  let a = 0, c = 0;
  for (let i = 0; i < 28; i++) {
    const v = L[isoDay(addDays(today, -i))] || 0;
    if (i < 7) a += v;
    c += v;
  }
  const acute = a / 7, chronic = c / 28;
  const ratio = chronic ? acute / chronic : 0;
  const cls = !chronic ? 'none' : ratio > 1.5 ? 'bad' : ratio > 1.3 ? 'warn' : ratio < 0.8 ? 'info' : 'ok';
  return { acute, chronic, ratio, cls, week: a };
}
const ACWR_LABEL = { bad: 'Ryzyko przeciążenia', warn: 'Podwyższone', ok: 'Optymalne', info: 'Za niskie', none: 'Brak danych' };

function wellnessScore(w) {
  if (!w) return null;
  // sleep and mood are "higher is better", the rest "lower is better"; 0–100
  const s = (w.sleep - 1) + (5 - w.fatigue) + (5 - w.soreness) + (5 - w.stress) + (w.mood - 1);
  return Math.round((s / 20) * 100);
}

// ---------- events ----------
const isPast = e => e.end < Date.now();
const isLive = e => e.start <= Date.now() && e.end >= Date.now();
const evTypeLabel = e => (e.type === 'training' ? e.title : e.type === 'match' ? (e.fest ? 'Festiwal' : 'Mecz') : 'Wydarzenie');
function eventConflicts({ fac, start, end, ignore }) {
  const hits = [];
  db.events.forEach(e => {
    if (e.id === ignore || !e.fac?.length) return;
    if (e.start < end && start < e.end && e.fac.some(f => fac.includes(f))) hits.push({ kind: 'event', who: `${teamLabel(e.team)} — ${e.title}`, start: e.start, end: e.end, fac: e.fac });
  });
  db.reservations.forEach(r => {
    if (r.id === ignore) return;
    if (r.start < end && start < r.end && r.fac.some(f => fac.includes(f))) hits.push({ kind: 'res', who: r.who, start: r.start, end: r.end, fac: r.fac });
  });
  return hits;
}

// ---------- notifications ----------
function addNote(d, to, { title, body, link = '#/', icon = 'bell' }) {
  d.notes.push({ id: uid('n'), to, at: Date.now(), title, body, link, icon, read: false });
}
const myNotes = () => db.notes.filter(n => n.to === me()).sort((a, b) => b.at - a.at);
const unreadNotes = () => myNotes().filter(n => !n.read);
function markRead(ids) {
  mutate(d => d.notes.forEach(n => { if (ids.includes(n.id)) n.read = true; }));
}
function unreadThreads() {
  return db.threads.filter(t => t.members.includes(me())).filter(t => {
    const last = t.msgs[t.msgs.length - 1];
    return last && last.from !== me() && last.at > (t.read?.[me()] || 0);
  });
}

// ---------- live sync ----------
// Another tab wrote to the database: pick it up, show pushes meant for this role, redraw.
window.addEventListener('storage', e => {
  if (e.key !== DB_KEY || !e.newValue) return;
  let next;
  try { next = JSON.parse(e.newValue); } catch (err) { return; }
  const seen = new Set(db.notes.map(n => n.id));
  const reseeded = next.seededFor !== db.seededFor || next.notes.length < db.notes.length - 5;
  db = next;
  if (!reseeded) {
    db.notes.filter(n => n.to === me() && !seen.has(n.id) && !n.read).forEach(n => push({
      title: n.title, body: n.body, icon: n.icon,
      onTap: () => { markRead([n.id]); location.hash = n.link; },
    }));
  }
  if (typeof liveRefresh === 'function') liveRefresh();
});
