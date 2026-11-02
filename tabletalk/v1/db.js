// TableTalk v1 — the venue's state (one copy in localStorage shared by every tab, standing in for the
// server), this tab's phone, lookups, the guest API with the rules a server would enforce (session
// checks, limits, profanity filter, blocks, idempotency keys), staff actions with an audit log,
// the outbox of a phone that lost its signal, and live sync between tabs.

const DB_KEY = 'tabletalk-v1-db';
const DEVICE_KEY = 'tabletalk-v1-device';
const OUTBOX_KEY = 'tabletalk-v1-outbox';
const OFFLINE_KEY = 'tabletalk-v1-offline';

let db = loadDb();

function loadDb() {
  const d = store.get(DB_KEY, null);
  if (d && d.v === DB_V && Date.now() - d.seededAt < 12 * HOUR) return d;
  const fresh = seed(Date.now());
  store.set(DB_KEY, fresh);
  return fresh;
}
function resetDb() {
  store.drop(DB_KEY);
  const prev = db;
  db = loadDb();
  onDbChange(prev, db, true);
}

// Every write starts from the latest stored copy, so two tabs never overwrite each other.
function mutate(fn) {
  const prev = db;
  const latest = store.get(DB_KEY, null);
  if (latest && latest.v === DB_V) db = latest;
  const r = fn(db, Date.now());
  prune(db);
  store.set(DB_KEY, db);
  onDbChange(prev, db, true);
  return r;
}

function prune(d) {
  const now = Date.now(), keep = d.config.retentionH * HOUR;
  d.msgs = d.msgs.filter(m => m.reported || now - m.at < keep).slice(-400);
  const done = Object.entries(d.done);
  if (done.length > 400) d.done = Object.fromEntries(done.sort((a, b) => b[1].at - a[1].at).slice(0, 300));
  d.audit = d.audit.slice(0, 300);
}

// ---------- this tab is one phone (sessionStorage survives a reload, a new tab is a new phone) ----------
if (/[?&]phone=new/.test(location.hash)) {
  [DEVICE_KEY, OUTBOX_KEY, OFFLINE_KEY].forEach(k => sess.drop(k));
  Object.keys(sessionStorage).filter(k => k.startsWith('tabletalk-g-')).forEach(k => sess.drop(k));
  history.replaceState(null, '', location.hash.replace(/[?&]phone=new/, ''));
}
const DEVICE = sess.get(DEVICE_KEY, null) || (() => { const id = uid('dev'); sess.set(DEVICE_KEY, id); return id; })();

// ---------- lookups ----------
const tableById = id => db.tables.find(t => t.id === id);
const tableByToken = tok => db.tables.find(t => t.token === tok);
const sessionById = id => db.sessions.find(s => s.id === id);
const isLive = s => !!s && (s.status === 'open' || s.status === 'verify');
const sessionTables = s => [s.table, ...(s.joined || [])];
const sessionOfTable = tid => db.sessions.find(s => isLive(s) && sessionTables(s).includes(tid));
const liveSessions = () => db.sessions.filter(isLive);
const partsOf = sid => db.participants.filter(p => p.session === sid && !p.left);
const partById = id => db.participants.find(p => p.id === id);
const isBotSession = s => partsOf(s.id).every(p => p.device === 'bot');
const blockedEither = (a, b) => !!(sessionById(a)?.blocks.includes(b) || sessionById(b)?.blocks.includes(a));
const itemById = id => itemIn(db.menu, id);
const money = n => fmtMoney(n, db.config.currency);
const today = () => opDay(Date.now(), db.config.dayReset);
const staffById = id => STAFF.find(s => s.id === id) || (id === 'crew' ? CREW : id === 'owner' ? { id, name: 'Właściciel' } : null);

// "5", or "5+6" for tables staff merged into one session
function tableLabel(s) {
  if (!s) return '?';
  return sessionTables(s).map(id => tableById(id)?.no ?? '?').join('+');
}
const noOf = sid => tableLabel(sessionById(sid));
const zoneOf = s => ZONES.find(z => z.id === tableById(s.table)?.zone);

const dmCh = (a, b) => 'dm:' + [a, b].sort().join('|');
const dmPeer = (ch, me) => ch.slice(3).split('|').find(x => x !== me);
const isDm = ch => ch.startsWith('dm:');

const ORDER_STEPS = ['sent', 'accepted', 'prep', 'served'];

function billOf(sid) {
  const orders = db.orders.filter(o => o.session === sid && o.status !== 'rejected' && o.status !== 'hold');
  const lines = [];
  orders.forEach(o => o.items.forEach(l => {
    const k = l.item + JSON.stringify(l.sel);
    const ex = lines.find(x => x.k === k);
    if (ex) ex.qty += l.qty;
    else lines.push({ k, item: l.item, sel: l.sel, unit: l.unit, qty: l.qty });
  }));
  const billed = g => g.status === 'accepted' || g.status === 'delivered';
  const sent = db.gifts.filter(g => g.from === sid && billed(g));
  const got = db.gifts.filter(g => g.to === sid && billed(g));
  const total = sum(lines, l => l.unit * l.qty) + sum(sent, g => g.price);
  return { lines, sent, got, total, held: db.orders.filter(o => o.session === sid && o.status === 'hold') };
}

// The evening's ranking from the bottle-cap game: 3 points a win, 1 a draw
function gameResult(g) {
  const tot = g.players.map(p => sum(p.flicks));
  const best = Math.max(...tot);
  const top = g.players.filter((p, i) => tot[i] === best);
  return { tot, winners: top.map(p => p.s), draw: top.length > 1 };
}
function ranking() {
  const pts = {};
  db.games.filter(g => g.status === 'done' && opDay(g.at, db.config.dayReset) === today()).forEach(g => {
    const r = gameResult(g);
    g.players.forEach(p => { pts[p.s] = pts[p.s] || { s: p.s, pts: 0, wins: 0, played: 0 }; pts[p.s].played++; });
    r.winners.forEach(s => { pts[s].pts += r.draw ? 1 : 3; if (!r.draw) pts[s].wins++; });
  });
  return Object.values(pts).sort((a, b) => b.pts - a.pts || b.wins - a.wins);
}

// ---------- text rules ----------
function filterText(text, banned) {
  let out = text, hit = false;
  Object.values(banned).flat().filter(Boolean).forEach(w => {
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, m => { hit = true; return m[0] + '*'.repeat(Math.max(2, m.length - 1)); });
  });
  return { text: out, hit };
}

// ---------- guest API ----------
const err = (code, extra = {}) => ({ ok: false, code, ...extra });

const API = {
  join(d, { table, device, lang, nick, pin }, now) {
    const T = tableById(table);
    if (!T) return err('unknownTable');
    let S = sessionOfTable(T.id);
    if (!S) {
      if (d.config.sessionMode !== 'auto') return err('closedTable');
      S = { id: uid('s'), table: T.id, status: 'verify', openedAt: now, openedBy: null, pin: '', approved: false, muted: false, private: false, blocks: [] };
      d.sessions.push(S);
    }
    const ps = partsOf(S.id);
    const mine = ps.find(p => p.device === device);
    if (mine) return { ok: true, id: mine.id };
    if (d.config.pinRequired && S.pin && String(pin || '') !== S.pin) return err('pin');
    if (ps.length >= d.config.maxParticipants) return err('full');
    d.participants.forEach(p => { if (p.device === device && !p.left) p.left = now; }); // a phone sits at one table
    const p = { id: uid('p'), session: S.id, device, lang, nick: String(nick || '').trim().slice(0, 24), joinedAt: now };
    d.participants.push(p);
    return { ok: true, id: p.id };
  },

  me(d, { p, lang, nick }) {
    const P = partById(p);
    if (!P) return err('gone');
    if (lang) P.lang = lang;
    if (nick !== undefined) P.nick = String(nick).trim().slice(0, 24);
  },

  order(d, { s, p, items, key }, now) {
    const S = sessionById(s);
    if (!isLive(S)) return err('closed');
    const out = items.filter(l => !itemById(l.item) || itemById(l.item).soldOut);
    if (out.length) return err('soldout', { items: out.map(l => l.item) });
    // prices are recomputed here, never taken from the phone
    const lines = items.map(l => lineFor(d.menu, l.item, clamp(l.qty | 0, 1, 20), l.sel, String(l.note || '').slice(0, 120)));
    const total = sum(lines, l => l.unit * l.qty);
    const hold = !S.approved ? 'verify' : total > d.config.orderLimit ? 'limit' : null;
    const o = { id: uid('o'), no: ++d.seq.order, key, session: s, by: p, at: now, items: lines, total, status: hold ? 'hold' : 'sent', hold, times: { sent: now } };
    d.orders.push(o);
    return { ok: true, id: o.id, hold };
  },

  call(d, { s, table, reason, text }, now) {
    if (reason === 'open') {
      if (sessionOfTable(table)) return err('alreadyOpen');
      const ex = d.calls.find(c => c.table === table && c.reason === 'open' && c.status !== 'done');
      if (ex) return { ok: true, id: ex.id };
      const c = { id: uid('c'), session: null, table, reason, text: '', at: now, status: 'new', times: {} };
      d.calls.push(c);
      return { ok: true, id: c.id };
    }
    const S = sessionById(s);
    if (!isLive(S)) return err('closed');
    const ex = d.calls.find(c => c.session === s && c.reason === reason && c.status !== 'done');
    if (ex) return err('dupCall', { id: ex.id });
    const c = { id: uid('c'), session: s, table: S.table, reason, text: String(text || '').trim().slice(0, 120), at: now, status: 'new', times: {} };
    d.calls.push(c);
    return { ok: true, id: c.id };
  },

  msg(d, { s, p, ch, text, at }, now) {
    const C = d.config, S = sessionById(s), P = partById(p);
    const t = at || now;
    if (!isLive(S)) return err('closed');
    if (!C.modules.chat || !C.chatOn) return err('chatOff');
    if (S.muted) return err('muted');
    if (S.private) return err('private');
    const body = String(text || '').trim();
    if (!body) return err('empty');
    if (body.length > C.chatMax) return err('tooLong');
    if (P?.lastMsg && t - P.lastMsg < C.chatRate * SEC) return err('rate', { wait: Math.ceil((C.chatRate * SEC - (t - P.lastMsg)) / SEC) });
    if (isDm(ch)) {
      if (!C.modules.dm) return err('dmOff');
      const T = sessionById(dmPeer(ch, s));
      if (!isLive(T)) return err('peerGone');
      if (T.blocks.includes(s)) return err('blockedBy');
      if (S.blocks.includes(T.id)) return err('youBlocked');
      if (T.private) return err('peerPrivate');
    }
    const f = filterText(body, C.banned);
    if (P) P.lastMsg = t;
    const m = { id: uid('m'), ch, from: s, by: p, nick: P?.nick || '', text: f.text, filtered: f.hit, at: t };
    d.msgs.push(m);
    return { ok: true, id: m.id };
  },

  report(d, { s, msg, reason }, now) {
    const m = d.msgs.find(x => x.id === msg);
    if (!m) return err('gone');
    m.reported = true;
    d.reports.push({ id: uid('rp'), msg: msg, by: s, reason, at: now, status: 'open' });
  },

  block(d, { s, target, on }) {
    const S = sessionById(s);
    if (!S || target === s) return err('gone');
    S.blocks = S.blocks.filter(x => x !== target);
    if (on) {
      S.blocks.push(target);
      d.gifts.forEach(g => { if (g.from === target && g.to === s && g.status === 'pending') g.status = 'declined'; });
    }
  },

  privacy(d, { s, on }) {
    const S = sessionById(s);
    if (!S) return err('gone');
    S.private = !!on;
    if (on) d.gifts.forEach(g => { if (g.to === s && g.status === 'pending') g.status = 'declined'; });
  },

  gift(d, { s, p, to, item, sel, msg }, now) {
    const C = d.config, S = sessionById(s), T = sessionById(to);
    if (!C.modules.gifts) return err('giftsOff');
    if (!isLive(S)) return err('closed');
    if (!isLive(T)) return err('peerGone');
    if (s === to) return err('self');
    if (!S.approved) return err('notApproved');
    if (T.blocks.includes(s)) return err('blockedBy');
    if (S.blocks.includes(to)) return err('youBlocked');
    if (T.private) return err('peerPrivate');
    const it = itemById(item);
    if (!it || !it.gift || it.soldOut) return err('giftItem');
    const mine = d.gifts.filter(g => g.from === s && g.status !== 'declined');
    if (mine.length >= C.giftMax) return err('giftLimit');
    const choice = sel || defaultSel(it), price = unitPrice(it, choice);
    if (sum(mine, g => g.price) + price > C.giftMaxValue) return err('giftValue');
    const g = { id: uid('g'), from: s, to, by: p, item, sel: choice, price, msg: filterText(String(msg || '').trim().slice(0, 100), C.banned).text, at: now,
      status: C.giftAccept ? 'pending' : 'accepted', times: C.giftAccept ? {} : { accepted: now } };
    d.gifts.push(g);
    return { ok: true, id: g.id };
  },

  giftAnswer(d, { s, id, accept }, now) {
    const g = d.gifts.find(x => x.id === id);
    if (!g || g.to !== s) return err('gone');
    if (g.status !== 'pending') return { ok: true, id };
    g.status = accept ? 'accepted' : 'declined';
    g.times[g.status] = now;
  },

  song(d, { s, title, artist, msg }, now) {
    const C = d.config;
    if (!C.modules.songs) return err('songsOff');
    if (!isLive(sessionById(s))) return err('closed');
    const t = String(title || '').trim().slice(0, 80);
    if (!t) return err('songTitle');
    const day = opDay(now, C.dayReset), todays = d.songs.filter(x => opDay(x.at, C.dayReset) === day);
    if (todays.length >= C.songDaily) return err('songDaily');
    if (todays.filter(x => x.session === s && x.status === 'pending').length >= C.songPending) return err('songPending');
    const book = SONGS.find(x => norm(x.title) === norm(t));
    const r = { id: uid('r'), session: s, title: book?.title || t, artist: String(artist || '').trim().slice(0, 60) || book?.artist || '', no: book?.no || 10000 + (hash(t) % 89999),
      msg: filterText(String(msg || '').trim().slice(0, 140), C.banned).text, at: now, status: 'pending', hearts: [], times: {} };
    d.songs.push(r);
    return { ok: true, id: r.id };
  },

  heart(d, { s, id }) {
    const r = d.songs.find(x => x.id === id);
    if (!r) return err('gone');
    r.hearts = r.hearts.includes(s) ? r.hearts.filter(x => x !== s) : [...r.hearts, s];
  },

  vote(d, { s, option }, now) {
    if (!d.config.modules.votes) return err('votesOff');
    const day = opDay(now, d.config.dayReset);
    if (d.votes.some(v => v.session === s && v.day === day)) return err('voted');
    d.votes.push({ session: s, day, option, at: now });
  },
};

// ---------- offline: a phone in the basement queues its actions and replays them on reconnect ----------
let offline = sess.get(OFFLINE_KEY, false);
let outbox = sess.get(OUTBOX_KEY, []);

function send(action, args = {}) {
  const a = { ...args, key: args.key || uid('k'), at: args.at || Date.now() };
  if (offline) {
    if (!outbox.some(q => q.args.key === a.key)) outbox.push({ action, args: a });
    sess.set(OUTBOX_KEY, outbox);
    onDbChange(db, db, true);
    return { ok: true, queued: true };
  }
  return run(action, a);
}

// The same key twice (a double tap, a replay after reconnecting) gives the first answer back.
function run(action, args) {
  return mutate((d, now) => {
    if (args.key && d.done[args.key]) return { ...d.done[args.key], dup: true };
    const r = API[action](d, args, now) || { ok: true };
    if (args.key && r.ok) d.done[args.key] = { ok: true, id: r.id || null, hold: r.hold || null, at: now };
    return r;
  });
}

function setOffline(on) {
  offline = on;
  sess.set(OFFLINE_KEY, on);
  if (on) { onDbChange(db, db, true); return; }
  // back online: fetch the state again, then replay what waited
  const prev = db;
  db = store.get(DB_KEY, db);
  const queued = outbox.splice(0);
  sess.set(OUTBOX_KEY, outbox);
  const res = queued.map(q => run(q.action, q.args));
  onDbChange(prev, db, false);
  return { sent: res.filter(r => r.ok).length, failed: res.filter(r => !r.ok) };
}

// ---------- staff actions (always online, every one goes to the audit log) ----------
const STAFF_API = {
  open(d, { table, by }, now) {
    if (sessionOfTable(table)) return err('busy');
    const s = { id: uid('s'), table, status: 'open', openedAt: now, openedBy: by, pin: d.config.pinRequired ? String(1000 + Math.floor(Math.random() * 9000)) : '', approved: true, muted: false, private: false, blocks: [] };
    d.sessions.push(s);
    d.calls.forEach(c => { if (c.table === table && c.reason === 'open' && c.status !== 'done') { c.status = 'done'; c.times = { ...c.times, done: now }; } });
    return { ok: true, id: s.id, log: [`Otwarto stolik ${tableById(table).no}`] };
  },
  approve(d, { s }, now) {
    const S = sessionById(s);
    S.status = 'open';
    S.approved = true;
    d.orders.forEach(o => { if (o.session === s && o.hold === 'verify') { o.status = 'sent'; o.hold = null; o.times.sent = now; } });
    return { ok: true, log: [`Zweryfikowano stolik ${tableLabel(S)}`] };
  },
  close(d, { s }, now) {
    const S = sessionById(s), label = tableLabel(S);
    S.total = billOf(s).total;
    S.status = 'closed';
    S.closedAt = now;
    d.calls.forEach(c => { if (c.session === s && c.status !== 'done') { c.status = 'done'; c.times.done = now; } });
    d.gifts.forEach(g => { if ((g.to === s || g.from === s) && g.status === 'pending') g.status = 'declined'; });
    d.games.forEach(g => { if (g.status !== 'done' && g.players.some(p => p.s === s)) g.status = 'cancelled'; });
    return { ok: true, log: [`Zamknięto i rozliczono stolik ${label}`, money(S.total)] };
  },
  move(d, { s, table }) {
    if (sessionOfTable(table)) return err('busy');
    const S = sessionById(s), from = tableLabel(S);
    S.from = [...(S.from || []), S.table];
    S.table = table;
    d.calls.forEach(c => { if (c.session === s) c.table = table; });
    return { ok: true, log: [`Przeniesiono sesję ze stolika ${from} na ${tableById(table).no}`] };
  },
  merge(d, { s, into }) {
    const A = sessionById(into), B = sessionById(s);
    if (!isLive(A) || !isLive(B) || A === B) return err('gone');
    const label = `${tableLabel(B)} → ${tableLabel(A)}`;
    A.joined = [...(A.joined || []), ...sessionTables(B)];
    B.status = 'merged';
    B.mergedInto = A.id;
    d.participants.forEach(p => { if (p.session === B.id) p.session = A.id; });
    d.orders.forEach(o => { if (o.session === B.id) o.session = A.id; });
    d.calls.forEach(c => { if (c.session === B.id) c.session = A.id; });
    d.gifts.forEach(g => { if (g.from === B.id) g.from = A.id; if (g.to === B.id) g.to = A.id; });
    return { ok: true, log: [`Połączono stoliki ${label}`] };
  },
  orderStatus(d, { id, status }, now) {
    const o = d.orders.find(x => x.id === id);
    o.status = status;
    o.times[status] = now;
    return { ok: true, log: status === 'served' ? [] : null };
  },
  approveOrder(d, { id }, now) {
    const o = d.orders.find(x => x.id === id), S = sessionById(o.session);
    if (o.hold === 'verify' && S.status === 'verify') return STAFF_API.approve(d, { s: S.id }, now);
    o.status = 'sent';
    o.hold = null;
    o.times.sent = now;
    return { ok: true, log: [`Zatwierdzono zamówienie #${o.no} (${money(o.total)})`] };
  },
  reject(d, { id, reason }, now) {
    const o = d.orders.find(x => x.id === id);
    o.status = 'rejected';
    o.reason = reason;
    o.times.rejected = now;
    return { ok: true, log: [`Odrzucono zamówienie #${o.no}`, reason] };
  },
  callStatus(d, { id, status }, now) {
    const c = d.calls.find(x => x.id === id);
    c.status = status;
    c.times = { ...c.times, [status]: now };
  },
  songStatus(d, { id, status }, now) {
    const r = d.songs.find(x => x.id === id);
    r.status = status;
    r.times[status] = now;
    return { ok: true, log: status === 'rejected' ? [`Odrzucono prośbę o piosenkę „${r.title}”`] : null };
  },
  delivered(d, { id }, now) {
    const g = d.gifts.find(x => x.id === id);
    g.status = 'delivered';
    g.times.delivered = now;
  },
  houseGift(d, { to, by }, now) {
    d.gifts.push({ id: uid('g'), from: null, house: true, to, by, item: 'house', sel: {}, price: 0, msg: 'Dla zwycięzców wieczoru w kapsla 🏆', at: now, status: 'accepted', times: { accepted: now } });
    return { ok: true, log: [`Prezent od lokalu dla stolika ${noOf(to)}`] };
  },
  deleteMsg(d, { id, by }, now) {
    const m = d.msgs.find(x => x.id === id);
    m.deleted = true;
    m.deletedBy = by;
    m.deletedAt = now;
    d.reports.forEach(r => { if (r.msg === id && r.status === 'open') r.status = 'removed'; });
    return { ok: true, log: [`Usunięto wiadomość stolika ${noOf(m.from)}`, m.text] };
  },
  dismissReport(d, { id }) {
    d.reports.find(r => r.id === id).status = 'dismissed';
  },
  mute(d, { s, on }) {
    sessionById(s).muted = on;
    return { ok: true, log: [`${on ? 'Wyciszono' : 'Odciszono'} czat stolika ${noOf(s)}`] };
  },
  chatSwitch(d, { on }) {
    d.config.chatOn = on;
    return { ok: true, log: [on ? 'Włączono czat w lokalu' : 'Wyłączono czat w całym lokalu'] };
  },
  soldOut(d, { item, on }) {
    const it = d.menu.find(i => i.id === item);
    it.soldOut = on;
    return { ok: true, log: [`${it.name.pl}: ${on ? 'wyprzedane' : 'znów dostępne'}`] };
  },
};

function staffDo(action, args, by) {
  return mutate((d, now) => {
    const r = STAFF_API[action](d, { ...args, by }, now) || { ok: true };
    if (r.ok && r.log) d.audit.unshift({ at: now, by, what: r.log[0], detail: r.log[1] || '' });
    return r;
  });
}

// ---------- live sync: another tab wrote, so this one catches up (unless its phone is offline) ----------
window.addEventListener('storage', e => {
  if (e.key !== DB_KEY || !e.newValue || offline) return;
  let next;
  try { next = JSON.parse(e.newValue); } catch (x) { return; }
  const prev = db;
  db = next;
  onDbChange(prev, db, false);
});
