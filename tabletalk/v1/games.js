// TableTalk v1 — the game centre on the guest's phone: "Kapsel", the Korean soju bottle-cap flick.
// The cap's twisted tail gets three flicks; a needle sweeps the gauge and the closer to the green
// zone, the more points. Quick 1-on-1 matches against another table, rooms for up to four tables,
// 3 points a win towards the evening's table ranking (staff can send the winners a round).

Object.assign(API, {
  gameQuick(d, { s }, now) {
    if (!d.config.modules.games) return err('gamesOff');
    if (!isLive(sessionById(s))) return err('closed');
    const mine = activeGame(s);
    if (mine) return { ok: true, id: mine.id };
    const open = d.games.find(g => g.status === 'waiting' && g.mode === 'quick' && !g.players.some(p => blockedEither(p.s, s)));
    if (open) { kapselJoin(open, s, now); return { ok: true, id: open.id }; }
    const g = { id: uid('k'), kind: 'kapsel', mode: 'quick', name: '', max: 2, by: s, at: now, status: 'waiting', players: [{ s, flicks: [], joinedAt: now }] };
    d.games.push(g);
    return { ok: true, id: g.id };
  },
  gameRoom(d, { s, name, max }, now) {
    if (!d.config.modules.games) return err('gamesOff');
    if (activeGame(s)) return err('inGame');
    const g = { id: uid('k'), kind: 'kapsel', mode: 'room', name: String(name || '').trim().slice(0, 40), max: clamp(max | 0, 2, 4), by: s, at: now, status: 'waiting', players: [{ s, flicks: [], joinedAt: now }] };
    d.games.push(g);
    return { ok: true, id: g.id };
  },
  gameJoin(d, { s, id, bot }, now) {
    const g = d.games.find(x => x.id === id);
    if (!g || g.status !== 'waiting') return err('gameGone');
    if (g.players.some(p => p.s === s)) return { ok: true, id };
    if (activeGame(s)) return err('inGame');
    if (g.players.length >= g.max) return err('gameFull');
    kapselJoin(g, s, now, bot);
    return { ok: true, id };
  },
  gameStart(d, { s, id }, now) {
    const g = d.games.find(x => x.id === id);
    if (!g || g.by !== s || g.status !== 'waiting' || g.players.length < 2) return err('gameGone');
    kapselStart(g, now);
  },
  gameFlick(d, { s, id, score }, now) {
    const g = d.games.find(x => x.id === id);
    const p = g?.players.find(x => x.s === s);
    if (!p || g.status !== 'play' || p.flicks.length >= 3) return err('gameGone');
    p.flicks.push(clamp(Math.round(score), 0, 100));
    kapselEnd(g, now);
  },
  gameLeave(d, { s, id }, now) {
    const g = d.games.find(x => x.id === id);
    if (!g) return;
    if (g.status === 'waiting') {
      g.players = g.players.filter(p => p.s !== s);
      if (!g.players.length || g.by === s) g.status = 'cancelled';
    } else if (g.status === 'play') {
      const p = g.players.find(x => x.s === s);
      while (p && p.flicks.length < 3) p.flicks.push(0);
      kapselEnd(g, now);
    }
  },
});

const activeGame = s => db.games.find(g => (g.status === 'waiting' || g.status === 'play') && g.players.some(p => p.s === s));

function kapselJoin(g, s, now, bot = false) {
  g.players.push({ s, flicks: [], joinedAt: now, bot });
  if (g.players.length >= g.max) kapselStart(g, now);
}
function kapselStart(g, now) {
  g.status = 'play';
  g.startedAt = now;
  g.players.forEach(p => { if (p.bot) p.next = now + rnd(2500, 4200); });
}
function kapselEnd(g, now) {
  if (g.players.every(p => p.flicks.length >= 3)) { g.status = 'done'; g.endedAt = now; }
}
function kapselBotFlick(d, id, i, now) {
  const g = d.games.find(x => x.id === id), p = g?.players[i];
  if (!p || g.status !== 'play' || p.flicks.length >= 3) return;
  p.flicks.push(Math.round(clamp(rnd(30, 99) - p.flicks.length * rnd(0, 9), 4, 100)));
  p.next = now + rnd(1800, 3800);
  kapselEnd(g, now);
}

// ---------- the gauge (local to this phone; only the scores travel) ----------
const ROUNDS = [{ period: 1500, width: 24 }, { period: 1180, width: 17 }, { period: 920, width: 11 }];
const K = { game: null, round: -1, zone: 50, t0: 0, raf: 0, pos: 50, seen: null, last: null };

function kapselPos(now) {
  const r = ROUNDS[clamp(K.round, 0, 2)], ph = ((now - K.t0) % (r.period * 2)) / r.period;
  return (ph < 1 ? ph : 2 - ph) * 100;
}
function kapselScore(pos) {
  const half = ROUNDS[clamp(K.round, 0, 2)].width / 2, dist = Math.abs(pos - K.zone);
  return dist <= half ? Math.round(100 - (dist / half) * 20) : Math.max(0, Math.round(80 - (dist - half) * 2.4));
}
function kapselLoop() {
  cancelAnimationFrame(K.raf);
  const step = () => {
    const needle = $('#kNeedle');
    if (!needle) { K.raf = 0; return; }
    K.pos = kapselPos(performance.now());
    needle.setAttribute('transform', `rotate(${(-70 + K.pos * 1.4).toFixed(2)} 100 100)`);
    K.raf = requestAnimationFrame(step);
  };
  K.raf = requestAnimationFrame(step);
}
function kapselRound(n) {
  K.round = n;
  K.zone = 18 + Math.random() * 64;
  K.t0 = performance.now();
}

const arcPt = (p, r = 78) => { const a = ((-70 + p * 1.4) - 90) * Math.PI / 180; return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]; };
function arcPath(a, b, r = 78) {
  const [x1, y1] = arcPt(a, r), [x2, y2] = arcPt(b, r);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; // the gauge spans 140°, never the long way round
}

// the big green cap with its twisted metal tail
function capWithTail(state = '') {
  return `<svg class="kcap ${state}" viewBox="0 0 200 150" aria-hidden="true">
    <g class="kcap__tail"><path d="M128 74 C150 70 162 58 178 44" class="tail-band"/><path d="M134 72l6 -6M142 68l6 -7M150 63l6 -7M158 57l5 -7M166 51l5 -7" class="tail-twist"/></g>
    <g class="kcap__cap"><path d="${CAP_PATH}" transform="translate(52 28) scale(.94)"/><circle cx="99" cy="75" r="34" class="kcap__face"/><text x="99" y="82" text-anchor="middle">소주</text></g>
  </svg>`;
}

// ---------- views ----------
function gamesView(c) {
  const S = c.session.id;
  const g = db.games.find(x => x.id === K.game) || activeGame(S);
  if (g && (g.status === 'waiting' || g.status === 'play' || (g.status === 'done' && K.game === g.id))) return gameScreen(g, c);
  K.game = null;
  const rooms = db.games.filter(x => x.status === 'waiting' && !x.players.some(p => p.s === S));
  const rank = ranking().slice(0, 6);
  const hit = db.menu.find(i => i.featured === 'hit');
  return `<section class="arcade">
    ${hit && !hit.soldOut ? `<button class="promo" data-act="g-item" data-i="${hit.id}">${art(hit.art)}<span><b>${esc(t('g.hungry'))}</b><small>${esc(t('g.hungryP', { x: L(hit.name) }))}</small></span>${ic('right')}</button>` : ''}
    <article class="gcard">
      <div class="gcard__art">${capWithTail('is-idle')}</div>
      <h2>${esc(t('g.title'))} <span lang="ko">병뚜껑 날리기</span></h2>
      <p>${esc(t('g.desc'))}</p>
      <div class="gcard__acts">
        <button class="btn btn--soju" data-act="k-quick">${ic('users')} ${esc(t('g.quick'))}</button>
        <button class="btn btn--line" data-act="k-room">${ic('plus')} ${esc(t('g.room'))}</button>
      </div>
    </article>
    <h3 class="block__h">${esc(t('g.rooms'))}</h3>
    ${rooms.length ? `<ul class="rooms">${rooms.map(r => `<li>${cap(noOf(r.by), 'cap--sm')}<div><b>${esc(r.name || t(r.mode === 'quick' ? 'g.quickWaits' : 'g.roomOf', { n: noOf(r.by) }))}</b><small>${esc(t('g.players', { n: r.players.length, max: r.max }))} · ${since(r.at)}</small></div><button class="btn btn--sm btn--soju" data-act="k-join" data-id="${r.id}">${esc(t('g.join'))}</button></li>`).join('')}</ul>`
      : `<p class="empty-line">${esc(t('g.noRooms'))}</p>`}
    <h3 class="block__h">${esc(t('g.rank'))}</h3>
    ${rank.length ? `<ol class="rank">${rank.map((r, i) => `<li class="${r.s === S ? 'is-me' : ''}"><span class="rank__i">${i + 1}</span>${cap(noOf(r.s), 'cap--sm')}<span class="rank__n">${esc(t('g.tableShort', { n: noOf(r.s) }))}${nickOf(r.s) ? `<small>${esc(nickOf(r.s))}</small>` : ''}</span><b>${r.pts} ${esc(t('g.pts'))}</b></li>`).join('')}</ol>` : `<p class="empty-line">${esc(t('g.noRank'))}</p>`}
    <p class="fine">${ic('trophy')} ${esc(t('g.prize'))}</p>
    <p class="fine">${esc(t('g.soon'))}</p>
  </section>`;
}

function gameScreen(g, c) {
  const S = c.session.id, me = g.players.find(p => p.s === S);
  K.game = g.id;
  if (g.status === 'waiting') {
    const host = g.by === S;
    return `<section class="kgame kgame--wait">
      <div class="kgame__spin">${capWithTail('is-spin')}</div>
      <h2>${esc(t(g.mode === 'quick' ? 'g.searching' : 'g.waitPlayers'))}</h2>
      <p>${esc(t('g.players', { n: g.players.length, max: g.max }))}</p>
      <ul class="kplayers">${g.players.map(p => `<li>${cap(noOf(p.s), p.s === S ? 'cap--me cap--sm' : 'cap--sm')}<span>${esc(p.s === S ? t('g.you') : t('g.tableShort', { n: noOf(p.s) }))}</span></li>`).join('')}</ul>
      ${host && g.mode === 'room' && g.players.length >= 2 ? `<button class="btn btn--soju" data-act="k-start">${ic('play')} ${esc(t('g.start'))}</button>` : ''}
      <button class="btn btn--line" data-act="k-leave">${esc(t('g.cancel'))}</button>
      ${!demo.sim ? `<p class="fine">${esc(t('g.noBots'))}</p>` : ''}
    </section>`;
  }
  const res = g.status === 'done' ? gameResult(g) : null;
  if (g.status === 'play' && me && me.flicks.length < 3 && K.round !== me.flicks.length) kapselRound(me.flicks.length);
  const board = `<ul class="kboard">${g.players.map(p => {
    const tot = sum(p.flicks), win = res?.winners.includes(p.s);
    return `<li class="${p.s === S ? 'is-me' : ''}${win ? ' is-win' : ''}">${cap(noOf(p.s), p.s === S ? 'cap--me cap--sm' : 'cap--sm')}<span class="kboard__n">${esc(p.s === S ? t('g.you') : t('g.tableShort', { n: noOf(p.s) }))}</span>
      ${[0, 1, 2].map(i => `<i class="kflick${p.flicks[i] != null ? ' is-done' : ''}${p.flicks[i] >= 90 ? ' is-top' : ''}">${p.flicks[i] ?? '·'}</i>`).join('')}<b>${tot}</b></li>`;
  }).join('')}</ul>`;
  if (res) {
    const won = res.winners.includes(S);
    return `<section class="kgame kgame--done">
      <div class="kgame__burst ${won ? 'is-win' : ''}">${capWithTail(won ? 'is-off' : '')}</div>
      <h2>${esc(t(res.draw && won ? 'g.draw' : won ? 'g.win' : 'g.lose'))}</h2>
      <p>${esc(t(won ? (res.draw ? 'g.drawP' : 'g.winP') : 'g.loseP'))}</p>
      ${board}
      <div class="gcard__acts"><button class="btn btn--soju" data-act="k-again">${ic('refresh')} ${esc(t('g.rematch'))}</button><button class="btn btn--line" data-act="k-back">${esc(t('g.back'))}</button></div>
    </section>`;
  }
  const left = me ? 3 - me.flicks.length : 0;
  const r = ROUNDS[clamp(K.round, 0, 2)];
  return `<section class="kgame kgame--play">
    <p class="kgame__round">${left ? esc(t('g.round', { n: 4 - left })) : esc(t('g.waitOthers'))}</p>
    <div class="gauge">
      <svg viewBox="0 0 200 118" aria-hidden="true">
        <path d="${arcPath(0, 100)}" class="gauge__track"/>
        <path d="${arcPath(clamp(K.zone - r.width / 2, 0, 100), clamp(K.zone + r.width / 2, 0, 100))}" class="gauge__zone"/>
        <path d="${arcPath(clamp(K.zone - 1, 0, 100), clamp(K.zone + 1, 0, 100))}" class="gauge__mid"/>
        <g id="kNeedle" transform="rotate(${(-70 + K.pos * 1.4).toFixed(1)} 100 100)"><path d="M100 100L100 30" class="gauge__needle"/><circle cx="100" cy="100" r="7" class="gauge__hub"/></g>
      </svg>
    </div>
    <div class="kgame__cap" id="kCap">${capWithTail(left ? '' : 'is-off')}</div>
    <p class="kgame__last" id="kLast" aria-live="polite">${K.last != null ? esc(t('g.last', { n: K.last })) : '&nbsp;'}</p>
    <button class="btn btn--flick" data-act="k-flick" ${left ? '' : 'disabled'}>${esc(t('g.flick'))}</button>
    ${board}
    <button class="link" data-act="k-leave">${esc(t('g.giveUp'))}</button>
  </section>`;
}

Object.assign(ACTS, {
  'k-quick': () => {
    const c = gctx(), r = send('gameQuick', { s: c.session.id });
    if (!r.ok) { toast(esc(errText(r)), { icon: 'alert' }); return; }
    K.game = r.id || null;
    K.round = -1;
    K.last = null;
    render();
  },
  'k-room': () => {
    const c = gctx();
    gopen(`<div class="sheet__head"><h3>${esc(t('g.room'))}</h3><button class="ibtn" data-close aria-label="${esc(t('ui.close'))}">${ic('x')}</button></div>
      <form data-submit="k-room">
        <label class="field"><span>${esc(t('g.roomName'))}</span><input name="name" maxlength="40" autofocus placeholder="${esc(t('g.roomOf', { n: tableLabel(c.session) }))}"></label>
        <fieldset class="mods mods--inline"><legend>${esc(t('g.maxPlayers'))}</legend>${[2, 3, 4].map(n => `<label class="opt"><input type="radio" name="max" value="${n}" ${n === 3 ? 'checked' : ''}><span class="opt__box"></span><span>${n}</span></label>`).join('')}</fieldset>
        <p class="fine">${esc(t('g.roomHint'))}</p>
        <button class="btn btn--soju btn--block" type="submit">${esc(t('g.roomGo'))}</button>
      </form>`);
  },
  'k-join': el => {
    const c = gctx(), r = send('gameJoin', { s: c.session.id, id: el.dataset.id });
    if (!r.ok) { toast(esc(errText(r)), { icon: 'alert' }); return; }
    K.game = el.dataset.id;
    K.round = -1;
    K.last = null;
    render();
  },
  'k-start': () => { const c = gctx(); send('gameStart', { s: c.session.id, id: K.game }); },
  'k-leave': () => { const c = gctx(); send('gameLeave', { s: c.session.id, id: K.game }); K.game = null; K.round = -1; render(); },
  'k-back': () => { K.game = null; K.round = -1; K.last = null; render(); },
  'k-again': () => { K.game = null; K.round = -1; K.last = null; ACTS['k-quick'](); },
  'k-flick': () => {
    const c = gctx(), g = db.games.find(x => x.id === K.game), now = performance.now();
    if (!g || g.status !== 'play' || now - (K.flickAt || 0) < 400) return; // one flick per tap, even a frantic one
    K.flickAt = now;
    const score = kapselScore(kapselPos(now));
    K.last = score;
    sound('flick');
    const capEl = $('#kCap .kcap');
    capEl?.classList.remove('is-hit');
    void capEl?.getBoundingClientRect();
    capEl?.classList.add('is-hit', score >= 90 ? 'is-top' : 'is-ok');
    send('gameFlick', { s: c.session.id, id: g.id, score });
  },
});
Object.assign(SUBMITS, {
  'k-room': form => {
    const c = gctx(), f = new FormData(form);
    const r = send('gameRoom', { s: c.session.id, name: f.get('name') || t('g.roomOf', { n: tableLabel(c.session) }), max: +f.get('max') });
    closeLayer();
    if (!r.ok) { toast(esc(errText(r)), { icon: 'alert' }); return; }
    K.game = r.id || null;
    K.round = -1;
    render();
  },
});

// keep the needle moving whenever the game screen is on
const kapselWatch = new MutationObserver(() => { if ($('#kNeedle') && !K.raf) kapselLoop(); });
document.addEventListener('DOMContentLoaded', () => kapselWatch.observe(document.body, { childList: true, subtree: true }));
