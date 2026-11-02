// TableTalk v1 — the rest of the bar, simulated for the demo: bot tables that chat, order, ask for
// songs, vote, play the cap game, send gifts to real phones and answer their DMs, plus an automatic
// crew that runs orders, calls, gifts and the song queue whenever nobody is logged in to the staff
// panel. One tab at a time drives it (a lease in localStorage, taken over when the holder goes quiet).

const LEASE_KEY = 'tabletalk-v1-lease';
const STAFF_HB_KEY = 'tabletalk-v1-staff-hb';
const DEMO_KEY = 'tabletalk-v1-demo';
const TAB = uid('tab');
const demo = { sim: true, crew: true, ...store.get(DEMO_KEY, {}) };

function setDemo(patch) {
  Object.assign(demo, patch);
  store.set(DEMO_KEY, demo);
  renderDemoBar();
}
window.addEventListener('storage', e => {
  if (e.key === DEMO_KEY) { Object.assign(demo, store.get(DEMO_KEY, {})); renderDemoBar(); }
  if (e.key === STAFF_HB_KEY) renderDemoBar();
});

function holdLease() {
  const l = store.get(LEASE_KEY, null), now = Date.now();
  if (!l || l.tab === TAB || now - l.at > 4500) { store.set(LEASE_KEY, { tab: TAB, at: now }); return true; }
  return false;
}
window.addEventListener('pagehide', () => { if (store.get(LEASE_KEY, null)?.tab === TAB) store.drop(LEASE_KEY); });
const staffOnline = () => Date.now() - store.get(STAFF_HB_KEY, 0) < 6000;

const botSessions = () => liveSessions().filter(s => isBotSession(s) && BOTS[tableById(s.table)?.no]);
const realSessions = () => liveSessions().filter(s => partsOf(s.id).some(p => p.device !== 'bot'));
const botOf = s => BOTS[tableById(s.table)?.no] || { lang: 'pl', lines: [] };
const botPart = s => partsOf(s.id)[0];
const realJoinedAt = s => Math.min(...partsOf(s.id).filter(p => p.device !== 'bot').map(p => p.joinedAt));

// ---------- the automatic crew ----------
let simBoot = 0;
function crewIntents(now) {
  const out = [];
  const age = t => (now - Math.max(t || now, simBoot)) / SEC;
  db.orders.forEach(o => {
    const t = o.times[o.status] || o.at;
    if (o.status === 'hold' && age(t) > 8) out.push({ staff: 'approveOrder', args: { id: o.id } });
    else if (o.status === 'sent' && age(t) > 6) out.push({ staff: 'orderStatus', args: { id: o.id, status: 'accepted' } });
    else if (o.status === 'accepted' && age(t) > 9) out.push({ staff: 'orderStatus', args: { id: o.id, status: 'prep' } });
    else if (o.status === 'prep' && age(t) > 28) out.push({ staff: 'orderStatus', args: { id: o.id, status: 'served' } });
  });
  db.calls.forEach(c => {
    if (c.status === 'done') return;
    if (c.reason === 'open') { if (age(c.at) > 7) out.push({ staff: 'open', args: { table: c.table } }); return; }
    if (c.status === 'new' && age(c.at) > 5) out.push({ staff: 'callStatus', args: { id: c.id, status: 'onway' } });
    else if (c.status === 'onway' && age(c.times?.onway || c.at) > 18) out.push({ staff: 'callStatus', args: { id: c.id, status: 'done' } });
  });
  db.gifts.forEach(g => {
    if (g.status === 'accepted' && age(g.times.accepted || g.at) > 22) out.push({ staff: 'delivered', args: { id: g.id } });
  });
  db.songs.forEach(r => {
    if (r.status === 'pending' && age(r.at) > 10) out.push({ staff: 'songStatus', args: { id: r.id, status: 'accepted' } });
  });
  const lastPlayed = Math.max(0, ...db.songs.map(r => r.times.played || 0));
  const next = db.songs.filter(r => r.status === 'accepted').sort((a, b) => a.at - b.at)[0];
  if (next && age(Math.max(lastPlayed, next.times.accepted || next.at)) > 90) out.push({ staff: 'songStatus', args: { id: next.id, status: 'played' } });
  return out;
}

// ---------- bot tables ----------
let nextAmbient = 0;
function botIntents(now) {
  const out = [], bots = botSessions(), real = realSessions();
  if (!bots.length) return out;
  const say = (s, ch, text) => out.push({ api: 'msg', args: { s: s.id, p: botPart(s)?.id, ch, text } });

  // answer DMs a few seconds later, in the bot's own language
  db.msgs.filter(m => isDm(m.ch) && !m.botSeen && now - m.at > 5000).forEach(m => {
    const peer = sessionById(dmPeer(m.ch, m.from)), from = sessionById(m.from);
    if (!peer || !from || !bots.includes(peer) || isBotSession(from)) return;
    out.push({ fn: d => { const x = d.msgs.find(y => y.id === m.id); if (x) x.botSeen = true; } });
    const thread = db.msgs.filter(x => x.ch === m.ch && x.from === peer.id).length;
    if (thread < 6) say(peer, m.ch, pick(BOT_REPLY[botOf(peer).lang]));
  });

  // gifts that bots received: mostly a happy yes, with thanks
  db.gifts.filter(g => g.status === 'pending' && now - g.at > 6000).forEach(g => {
    const to = sessionById(g.to);
    if (!bots.includes(to)) return;
    const yes = Math.random() < 0.85;
    out.push({ api: 'giftAnswer', args: { s: to.id, id: g.id, accept: yes } });
    if (yes && g.from) say(to, dmCh(to.id, g.from), pick(BOT_REPLY[botOf(to).lang]));
  });

  // a welcome DM and, a bit later, one gift for every real table
  real.forEach(S => {
    const joined = realJoinedAt(S), from = pick(bots);
    if (!S.simDm && now - joined > 30000) {
      out.push({ fn: d => { sessionById(S.id).simDm = true; } });
      say(from, dmCh(from.id, S.id), pick(BOT_DM[botOf(from).lang]));
    } else if (S.simDm && !S.simGift && now - joined > 80000 && db.config.modules.gifts) {
      const it = pick(db.menu.filter(i => i.gift && !i.soldOut));
      out.push({ fn: d => { sessionById(S.id).simGift = true; } });
      if (it) out.push({ api: 'gift', args: { s: from.id, p: botPart(from)?.id, to: S.id, item: it.id, sel: defaultSel(it), msg: pick(BOT_GIFT_MSG[botOf(from).lang]) } });
    }
  });

  out.push(...botGameIntents(now, bots));

  if (now < nextAmbient) return out;
  nextAmbient = now + rnd(8000, 16000);
  const s = pick(bots), P = botOf(s), roll = Math.random();
  if (roll < 0.4) {
    const last = db.msgs.filter(m => m.from === s.id).slice(-3).map(m => m.text);
    const line = pick(P.lines.filter(l => !last.includes(l)).length ? P.lines.filter(l => !last.includes(l)) : P.lines);
    if (line) say(s, 'all', line);
  } else if (roll < 0.6) {
    const items = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => pick(db.menu.filter(i => !i.soldOut)));
    out.push({ api: 'order', args: { s: s.id, p: botPart(s)?.id, key: uid('k'), items: [...new Set(items)].map(it => ({ item: it.id, qty: it.kitchen ? 1 : 1 + Math.floor(Math.random() * 3), sel: defaultSel(it), note: '' })) } });
  } else if (roll < 0.72) {
    const free = SONGS.filter(x => !db.songs.some(r => r.title === x.title && r.status !== 'played'));
    const song = pick(free.length ? free : SONGS);
    out.push({ api: 'song', args: { s: s.id, title: song.title, artist: song.artist, msg: '' } });
  } else if (roll < 0.8) {
    const r = pick(db.songs.filter(x => x.status !== 'rejected' && !x.hearts.includes(s.id)));
    if (r) out.push({ api: 'heart', args: { s: s.id, id: r.id } });
  } else if (roll < 0.88) {
    const v = bots.find(b => !db.votes.some(x => x.session === b.id && x.day === today()));
    if (v) out.push({ api: 'vote', args: { s: v.id, option: pick(VOTE.options).id } });
  } else if (roll < 0.94) {
    if (db.games.filter(g => g.status === 'waiting' && g.mode === 'room').length < 2) out.push({ api: 'gameRoom', args: { s: s.id, name: `${P.nick || 'Stolik ' + tableLabel(s)} zaprasza`, max: 3 } });
  } else if (real.length) {
    const S = pick(real);
    if (now - realJoinedAt(S) > 120000) say(s, dmCh(s.id, S.id), pick(BOT_DM[P.lang]));
  }
  return out;
}

// bots join quick matches nobody took, fill rooms and take their flicks
function botGameIntents(now, bots) {
  const out = [];
  if (!db.config.modules.games) return out;
  db.games.forEach(g => {
    if (g.status === 'waiting') {
      const wait = g.mode === 'quick' ? 4000 : 9000;
      const last = Math.max(g.at, ...g.players.map(p => p.joinedAt || 0));
      if (now - last < wait) return;
      const taken = g.players.map(p => p.s);
      const cand = bots.filter(b => !taken.includes(b.id) && !taken.some(t => blockedEither(t, b.id)));
      if (cand.length) out.push({ api: 'gameJoin', args: { s: pick(cand).id, id: g.id, bot: true } });
    }
    if (g.status === 'play') {
      g.players.forEach((p, i) => {
        if (!p.bot || p.flicks.length >= 3 || now < (p.next || 0)) return;
        out.push({ fn: d => kapselBotFlick(d, g.id, i, now) });
      });
    }
  });
  return out;
}

function applyAll(list) {
  if (!list.length) return;
  mutate((d, now) => list.forEach(x => {
    try {
      if (x.staff) {
        const r = STAFF_API[x.staff](d, { ...x.args, by: 'crew' }, now);
        if (r?.ok && r.log) d.audit.unshift({ at: now, by: 'crew', what: r.log[0], detail: r.log[1] || '' });
      } else if (x.api) API[x.api](d, x.args, now);
      else x.fn(d, now);
    } catch (e) { console.warn('sim', e); }
  }));
}

setInterval(() => {
  if (offline || (!demo.sim && !demo.crew) || !holdLease()) return;
  const now = Date.now();
  if (!simBoot) { simBoot = now; nextAmbient = now + 7000; }
  const list = [];
  if (demo.crew && !staffOnline()) list.push(...crewIntents(now));
  if (demo.sim) list.push(...botIntents(now));
  applyAll(list);
}, 1000);
