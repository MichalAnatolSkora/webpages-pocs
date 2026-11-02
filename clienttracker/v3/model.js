// ClientTracker v3 — the "server": state in localStorage, validated writes, server-computed fields (deadline, reaction, closing, history, number),
// the dashboard order, the month summary and the Markdown report. The UI only ever goes through these functions.

const store = {
  get(k, d) { try { const v = localStorage.getItem('ct3-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ct3-' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('ct3-' + k); } catch (e) {} },
};

// TimeProvider: the mock can move its clock; nothing else reads Date.now()
const clock = {
  offset: store.get('clock', 0),
  now() { return Date.now() + this.offset; },
  set(ms) { this.offset = isNaN(ms) ? 0 : ms - Date.now(); store.set('clock', this.offset); },
  live() { this.offset = 0; store.set('clock', 0); },
};

// v3 opens on the 100-client set: an inbox with two tickets says little; the demo bar switches back to Q-3
let DB = store.get('db', null) || seedLarge();
const save = () => store.set('db', DB);
// Q-1: wipes clients, tickets, time entries and settings; accounts and sessions stay.
// The mock adds a second set: the Q-3 data plus 97 generated clients, to see the screens at the size of a small firm.
function resetDemo(size = DB.dataset || 'small') { DB = size === 'large' ? seedLarge() : seedDemo(); save(); }

class Invalid extends Error { constructor(errors) { super('invalid'); this.errors = errors; } }
const check = errors => { if (Object.keys(errors).length) throw new Invalid(errors); };
const isClosed = s => s === 'Zrobione' || s === 'Odrzucone';
const isOpenStatus = s => s === 'Nowe' || s === 'W toku' || s === 'Czeka na klienta';
const winOf = () => ({ biz: { ...DB.settings.biz }, day: { ...DB.settings.day } });

// ---------- clients (K) ----------
const clientById = id => DB.clients.find(c => c.id === id);
function validateClient(d, id) {
  const e = {};
  const name = (d.name || '').trim();
  if (!name) e.name = 'Podaj nazwę klienta.';
  else if (DB.clients.some(c => c.id !== id && c.name.trim().toLowerCase() === name.toLowerCase())) e.name = 'Klient o tej nazwie już jest.';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = 'To nie wygląda na adres e-mail.';
  if (!PACKAGES.includes(d.pkg)) e.pkg = 'Wybierz pakiet.';
  if (!(d.price >= 0)) e.price = 'Cena musi być liczbą nie mniejszą od 0.';
  if (!(d.pool >= 0) || Math.round(d.pool * 4) !== d.pool * 4) e.pool = 'Pula w krokach co 0,25 h, nie mniej niż 0.';
  check(e);
  return { name, email: (d.email || '').trim(), pkg: d.pkg, price: +d.price, pool: +d.pool };
}
function createClient(d) {
  const valid = validateClient(d);
  const c = { id: 'c' + DB.seq.client++, ...valid, active: true };
  DB.clients.push(c); save(); return c;
}
function updateClient(id, d) {
  const c = clientById(id);
  Object.assign(c, validateClient(d, id), { active: !!d.active }); save(); return c;
}

// ---------- tickets (Z) ----------
const ticketByNo = no => DB.tickets.find(t => t.no === +no);
function createTicket(d) {
  const now = clock.now(), e = {};
  const client = clientById(d.clientId);
  if (!client) e.clientId = 'Wybierz klienta.';
  else if (!client.active) e.clientId = 'Klient jest nieaktywny, nie można dodać zgłoszenia.';
  if (!(d.title || '').trim()) e.title = 'Podaj tytuł.';
  if (!PRIORITIES.includes(d.priority)) e.priority = 'Wybierz priorytet.';
  if (!SOURCES.includes(d.source)) e.source = 'Wybierz źródło.';
  if (isNaN(d.receivedAt)) e.receivedAt = 'Podaj datę i godzinę przyjęcia.';
  else if (d.receivedAt > now) e.receivedAt = 'Godzina przyjęcia nie może być w przyszłości.';
  check(e);
  const win = winOf();
  const t = {
    no: ++DB.seq.ticket, clientId: client.id, title: d.title.trim(), desc: (d.desc || '').trim(),
    priority: d.priority, source: d.source, receivedAt: d.receivedAt,
    pkg: client.pkg, win, deadline: reactionDeadline(d.receivedAt, client.pkg, d.priority, win),
    status: 'Nowe', reactedAt: null, closedAt: null, createdAt: now, history: [],
  };
  DB.tickets.push(t); save(); return t;
}
// title and description edit freely; priority and received time recalc the deadline from the remembered rules (S-7, S-8)
function updateTicket(no, d) {
  const t = ticketByNo(no), now = clock.now(), e = {};
  if (!(d.title || '').trim()) e.title = 'Podaj tytuł.';
  if (!PRIORITIES.includes(d.priority)) e.priority = 'Wybierz priorytet.';
  if (!SOURCES.includes(d.source)) e.source = 'Wybierz źródło.';
  if (isNaN(d.receivedAt)) e.receivedAt = 'Podaj datę i godzinę przyjęcia.';
  else if (d.receivedAt > now) e.receivedAt = 'Godzina przyjęcia nie może być w przyszłości.';
  else if (t.reactedAt != null && d.receivedAt > t.reactedAt) e.receivedAt = 'Przyjęcie nie może być później niż reakcja.';
  check(e);
  if (d.priority !== t.priority) t.history.push({ at: now, field: 'priorytet', from: t.priority, to: d.priority });
  if (d.receivedAt !== t.receivedAt) t.history.push({ at: now, field: 'przyjęte', from: fmtDT(t.receivedAt), to: fmtDT(d.receivedAt) });
  Object.assign(t, { title: d.title.trim(), desc: (d.desc || '').trim(), source: d.source, priority: d.priority, receivedAt: d.receivedAt });
  t.deadline = reactionDeadline(t.receivedAt, t.pkg, t.priority, t.win);
  save(); return t;
}
function setStatus(no, to) {
  const t = ticketByNo(no), now = clock.now();
  if (to === 'Nowe' || !STATUSES.includes(to)) throw new Invalid({ status: 'Do statusu Nowe nie da się wrócić.' });
  if (to === t.status) return t;
  if (t.status === 'Nowe' && t.reactedAt == null) t.reactedAt = Math.max(now, t.receivedAt); // Z-4
  t.history.push({ at: now, field: 'status', from: t.status, to });
  t.status = to;
  t.closedAt = isClosed(to) ? now : null; // Z-5
  save(); return t;
}
function setReaction(no, ms) {
  const t = ticketByNo(no);
  if (isNaN(ms)) throw new Invalid({ reactedAt: 'Podaj datę i godzinę reakcji.' });
  if (ms < t.receivedAt) throw new Invalid({ reactedAt: 'Reakcja nie może być wcześniej niż przyjęcie.' });
  if (ms > clock.now()) throw new Invalid({ reactedAt: 'Reakcja nie może być w przyszłości.' });
  t.reactedAt = ms; save(); return t;
}

// P-2: tickets without reaction by deadline, then the rest from the oldest received
function openTickets(clientId) {
  const list = DB.tickets.filter(t => isOpenStatus(t.status) && (!clientId || t.clientId === clientId));
  const waiting = list.filter(t => t.reactedAt == null).sort((a, b) => a.deadline - b.deadline || a.no - b.no);
  const rest = list.filter(t => t.reactedAt != null).sort((a, b) => a.receivedAt - b.receivedAt || a.no - b.no);
  return [...waiting, ...rest];
}

// ---------- time entries (C) ----------
function parseHoursInput(s) {
  const v = String(s == null ? '' : s).trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(v) ? +v : NaN;
}
function validateEntry(d) {
  const e = {};
  const client = clientById(d.clientId);
  if (!client) e.clientId = 'Wybierz klienta.';
  let ticketNo = d.ticketNo ? +d.ticketNo : null;
  if (ticketNo != null) {
    const t = ticketByNo(ticketNo);
    if (!t || (client && t.clientId !== client.id)) e.ticketNo = 'To zgłoszenie należy do innego klienta.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) e.date = 'Podaj datę.';
  const h = parseHoursInput(d.hours);
  if (isNaN(h)) e.hours = 'Podaj liczbę godzin, np. 1,5.';
  else if (h <= 0 || h > 24) e.hours = 'Czas musi być większy od 0 i nie większy niż 24 h.';
  else if (Math.abs(h * 4 - Math.round(h * 4)) > 1e-9) e.hours = 'Czas w krokach co 0,25 h (15 min).';
  if (!KINDS.includes(d.kind)) e.kind = 'Wybierz rodzaj.';
  check(e);
  return { clientId: client.id, ticketNo, date: d.date, hours: h, kind: d.kind, desc: (d.desc || '').trim() };
}
function createEntry(d) { const valid = validateEntry(d); const x = { id: 'e' + DB.seq.entry++, ...valid }; DB.entries.push(x); save(); return x; }
function updateEntry(id, d) { const x = DB.entries.find(e => e.id === id); Object.assign(x, validateEntry(d)); save(); return x; }
function deleteEntry(id) { DB.entries = DB.entries.filter(e => e.id !== id); save(); }
const entriesOfTicket = no => DB.entries.filter(e => e.ticketNo === no).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
const sumHours = list => list.reduce((s, e) => s + e.hours, 0);

// ---------- settings (U) ----------
function saveSettings(d) {
  const e = {};
  for (const k of ['biz', 'day']) {
    if (isNaN(d[k].from) || isNaN(d[k].to) || d[k].from < 0 || d[k].to > 24 * 60) e[k] = 'Podaj godziny w formacie 9:00.';
    else if (d[k].from >= d[k].to) e[k] = 'Godzina „od” musi być wcześniejsza niż „do”.';
  }
  if (!(d.rate >= 0)) e.rate = 'Stawka musi być liczbą nie mniejszą od 0.';
  check(e);
  DB.settings = { biz: { ...d.biz }, day: { ...d.day }, rate: +d.rate }; save();
}

// ---------- month (M) ----------
const ymOf = ms => { const p = wParts(ms); return `${p.y}-${pad(p.m)}`; };
const ymNow = () => ymOf(clock.now());
const ymShift = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };
const ymLabel = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const poolUsed = (clientId, ym) => sumHours(DB.entries.filter(e => e.clientId === clientId && e.kind === 'Pula' && e.date.startsWith(ym)));

function monthSummary(clientId, ym) {
  const c = clientById(clientId);
  const entries = DB.entries.filter(e => e.clientId === clientId && e.date.startsWith(ym));
  const by = k => sumHours(entries.filter(e => e.kind === k));
  const pool = by('Pula'), maint = by('Utrzymanie'), extra = by('Dodatkowe');
  const total = pool + maint + extra;
  const extraAmount = extra * DB.settings.rate; // M-3: today's rate and price, also for past months
  const received = DB.tickets.filter(t => t.clientId === clientId && ymOf(t.receivedAt) === ym);
  return {
    client: c, ym, entries,
    pool, poolMax: c.pool, over: Math.max(0, pool - c.pool), maint, extra, extraAmount, total,
    tickets: received.length,
    inTerm: received.filter(t => t.reactedAt != null && t.reactedAt <= t.deadline).length,
    late: received.filter(t => t.reactedAt != null && t.reactedAt > t.deadline).length,
    noReaction: received.filter(t => t.reactedAt == null).length,
    effective: total ? (c.price + extraAmount) / total : null,
  };
}

// M-5 / M-6: no amounts and no effective rate, the report is for the client
function monthReport(clientId, ym) {
  const s = monthSummary(clientId, ym), c = s.client;
  const md = x => String(x).replace(/\|/g, '\\|');
  const mine = DB.tickets.filter(t => t.clientId === clientId);
  const incidents = mine.filter(t => (t.priority === 'Krytyczny' || t.priority === 'Wysoki') && ymOf(t.receivedAt) === ym)
    .sort((a, b) => a.receivedAt - b.receivedAt || a.no - b.no)
    .map(t => {
      const head = `  - ${fmtD(t.receivedAt)} ${t.title} (${t.priority.toLowerCase()})`;
      if (t.reactedAt == null) return `${head}: bez reakcji`;
      const verdict = t.reactedAt <= t.deadline ? 'w terminie' : `spóźniona o ${fmtDur(t.reactedAt - t.deadline)}`;
      return `${head}: reakcja po ${fmtDur(t.reactedAt - t.receivedAt)}, ${verdict}`;
    });
  const quiet = mine.filter(t => (t.source === 'Monitoring' || t.source === 'Własne') && t.status === 'Zrobione' && t.closedAt != null && ymOf(t.closedAt) === ym)
    .sort((a, b) => a.closedAt - b.closedAt).map(t => `- ${t.title}`);
  const groups = new Map();
  for (const e of s.entries) {
    if (e.ticketNo == null || e.kind === 'Utrzymanie') continue;
    const k = e.ticketNo + '|' + e.kind;
    groups.set(k, (groups.get(k) || 0) + e.hours);
  }
  const rows = [...groups].map(([k, h]) => { const [no, kind] = k.split('|'); return { t: ticketByNo(no), kind, h }; })
    .sort((a, b) => a.t.no - b.t.no || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))
    .map(({ t, kind, h }) => {
      const notes = [t.closedAt == null && 'w toku', kind === 'Dodatkowe' && 'poza pakietem'].filter(Boolean);
      return `| ${md(t.title)}${notes.length ? ` (${notes.join(', ')})` : ''} | ${fmtHours(h)} |`;
    });
  return [
    `# Raport miesięczny: ${c.name}, ${ymLabel(ym)}`,
    '',
    c.pool ? `Pakiet ${c.pkg} · wykorzystane godziny ${fmtHours(s.pool)} z ${fmtHours(c.pool)}` : `Pakiet ${c.pkg}`,
    '',
    '## Dostępność', '', '…', '',
    '## Aktualizacje i backupy', '', '- Aktualizacje: …', '- Backupy: …', '',
    '## Bezpieczeństwo i incydenty', '',
    '- Zablokowane ataki: …',
    ...(incidents.length ? ['- Incydenty i czas reakcji:', ...incidents] : ['- Incydenty i czas reakcji: brak']),
    '',
    '## Naprawione, zanim zauważyliście', '',
    ...(quiet.length ? quiet : ['- …']),
    '',
    '## Zrealizowane zmiany', '',
    ...(rows.length ? ['| Zmiana | Godziny |', '| --- | --- |', ...rows] : ['Brak zmian w tym miesiącu.']),
    '',
    '## Na kolejny miesiąc', '', '- …', '',
  ].join('\n');
}
