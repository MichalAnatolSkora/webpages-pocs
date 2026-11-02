// TableTalk v1 — the guest's phone: the QR entry and the table-session gate, onboarding (language,
// 18+, nickname, PIN), the menu as paper sheets on the wall, options and a personal cart, the table's
// orders and bill, calling staff, chat for the whole room and table-to-table DMs, gifts picked on the
// floor map with the recipient's yes, song requests, the daily vote and in-app notifications.

const GK = 'tabletalk-g-'; // this phone's keys in sessionStorage
const G = {
  token: '', tab: 'menu', sub: '', cat: 'all',
  lang: sess.get(GK + 'lang', null),
  adult: sess.get(GK + 'adult', false),
  nick: sess.get(GK + 'nick', ''),
  cart: sess.get(GK + 'cart', []),
  cartKey: sess.get(GK + 'cartkey', null),
  read: sess.get(GK + 'read', {}),
  ackClosed: sess.get(GK + 'ackclosed', []),
  seenGifts: sess.get(GK + 'seengifts', []),
  a2hs: sess.get(GK + 'a2hs', false),
  draft: '', emoji: false, coolUntil: 0,
  song: { title: '', artist: '', msg: '' },
  sheet: null, // redraws the open sheet when the room changes
};
const gsave = (k, v) => sess.set(GK + k, v);
const phoneLayers = () => $('.phone .layers');
const gopen = (html, opts = {}) => openLayer(html, { cls: 'sheet', root: phoneLayers(), onClose: () => { G.sheet = null; opts.onClose?.(); } });
const gHref = (tab = G.tab, sub = '') => `#/t/${G.token}/${tab}${sub ? '/' + sub : ''}`;
const gGo = (tab, sub = '') => { location.hash = gHref(tab, sub); };

function gLang(me) {
  const ok = db.config.langs;
  const want = me?.lang || G.lang || (navigator.language || '').slice(0, 2);
  return ok.includes(want) ? want : db.config.defaultLang;
}

// This phone's place: its participant in a live session, found by device first, so a table that staff
// moved or merged takes its phones along; otherwise whatever sits behind the scanned code.
function gctx() {
  const scanned = tableByToken(G.token);
  const revoked = !scanned && db.tables.some(t => t.old.includes(G.token));
  const mine = db.participants.filter(p => p.device === DEVICE && !p.left).sort((a, b) => b.joinedAt - a.joinedAt);
  const live = mine.find(p => isLive(sessionById(p.session)));
  if (live) {
    const S = sessionById(live.session);
    if (!scanned || sessionTables(S).includes(scanned.id) || (S.from || []).includes(scanned.id)) return { table: tableById(S.table), session: S, me: live };
  }
  const lastS = mine[0] && sessionById(mine[0].session);
  const closed = lastS && lastS.status === 'closed' && !G.ackClosed.includes(lastS.id) ? lastS : null;
  return { table: scanned || null, revoked, session: scanned ? sessionOfTable(scanned.id) : null, me: null, closed };
}

const nickOf = sid => partsOf(sid).map(p => p.nick).find(Boolean) || '';
const myCall = (c, reason) => db.calls.find(x => x.reason === reason && x.status !== 'done' && (reason === 'open' ? x.table === c.table.id : x.session === c.session.id));
const errText = r => t('e.' + r.code, { s: r.wait || '' });
const modsText = l => {
  const it = itemById(l.item);
  return (it?.mods || []).flatMap(g => (l.sel?.[g] || []).map(o => L(MODS[g].opts.find(x => x.id === o)?.name))).filter(Boolean).join(', ');
};
const itemName = id => L(itemById(id)?.name);

// ---------- root ----------
function guestView(parts) {
  G.token = parts[1] || '';
  G.tab = parts[2] || 'menu';
  G.sub = parts[3] || '';
  const c = gctx();
  LANG = gLang(c.me);
  document.documentElement.lang = LANG;
  let html;
  if (!c.table) html = gateUnknown(c);
  else if (c.closed) html = gateClosed(c);
  else if (!c.me) html = !c.session && db.config.sessionMode !== 'auto' ? gateWaiting(c) : gateJoin(c);
  else html = guestApp(c);
  paint($('#screen'), html);
  $('#screen').classList.toggle('is-app', !!c.me);
  // a channel opens at its newest message; after that the list sticks to the bottom only if you were there
  const list = $('.chat__list');
  if (list && list.dataset.scroll !== G.openChat) { list.scrollTop = list.scrollHeight; G.openChat = list.dataset.scroll; }
  if (!list) G.openChat = null;
  if (c.me) giftOverlayCheck(c);
  else $('.gift-ov')?.remove();
}

// ---------- gates ----------
function langSwitch(act = 'g-plang') {
  return `<div class="seg seg--lang" role="group" aria-label="${esc(t('set.lang'))}">${db.config.langs.map(l => `<button type="button" data-act="${act}" data-l="${l}" aria-pressed="${l === LANG}" lang="${l}">${LANGS[l]}</button>`).join('')}</div>`;
}
function neonSign(cls = '') {
  return `<div class="sign ${cls}"><span class="neon" lang="ko">${VENUE.ko}</span><small>${esc(VENUE.name.toUpperCase())}</small></div>`;
}

function gateUnknown(c) {
  return `<div class="gate gate--plain">${neonSign()}
    <div class="gate__icon">${ic('qr')}</div>
    <h1>${esc(t(c.revoked ? 'gate.revokedT' : 'gate.unknownT'))}</h1>
    <p>${esc(t(c.revoked ? 'gate.revokedP' : 'gate.unknownP'))}</p>
    ${langSwitch()}</div>`;
}

function gateWaiting(c) {
  const call = myCall(c, 'open');
  return `<div class="gate gate--wait">${neonSign('sign--sm')}
    <div class="gate__art">${closedTableArt()}</div>
    <h1>${esc(t('gate.closedT', { n: c.table.no }))}</h1>
    <p>${esc(t('gate.closedP'))}</p>
    ${call
      ? `<div class="waitcard" role="status">${ic('bell')}<div><b>${esc(t('gate.called'))}</b><small>${esc(t('gate.calledHint'))}</small></div>${since(call.at, { fmt: 'clock' })}</div>`
      : `<button class="bigbell" data-act="g-askopen"><span class="bigbell__btn" aria-hidden="true"></span><span>${esc(t('gate.ask'))}</span></button>`}
    <p class="fine">${ic('lock')} ${esc(t('gate.why'))}</p>
    ${langSwitch()}</div>`;
}

function gateJoin(c) {
  const pin = db.config.pinRequired && c.session?.pin;
  const auto = !c.session;
  return `<div class="gate gate--join">
    <div class="gate__tent">${tentArt()}</div>
    ${neonSign('sign--lg')}
    <p class="gate__tag">${esc(L(VENUE.tagline))}</p>
    <div class="gate__table">${cap(c.table.no, 'cap--me cap--lg')}<b>${esc(t('on.hi', { n: c.table.no }))}</b></div>
    ${langSwitch()}
    <form class="gate__form" data-submit="g-join" novalidate>
      ${G.adult ? '' : `
      <label class="tick"><input type="checkbox" name="adult"><span class="tick__box"></span><span>${esc(t('on.adult'))}</span></label>
      <label class="tick"><input type="checkbox" name="terms"><span class="tick__box"></span><span>${esc(t('on.terms'))} <button type="button" class="link" data-act="g-terms">${esc(t('on.termsLink'))}</button></span></label>`}
      <label class="field"><span>${esc(t('on.nick'))}</span><input name="nick" id="onNick" maxlength="24" autocomplete="off" placeholder="${esc(t('g.table', { n: c.table.no }))}" value="${esc(G.nick)}"></label>
      ${pin ? `<label class="field"><span>${esc(t('on.pin'))}</span><input name="pin" id="onPin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"></label>` : ''}
      <p class="form-err" id="onErr" role="alert"></p>
      <button class="btn btn--tarp btn--block" type="submit">${esc(t('on.go'))}</button>
    </form>
    ${auto ? `<p class="fine">${ic('info')} ${esc(t('on.autoNote'))}</p>` : ''}
    <p class="fine">${ic('lock')} ${esc(t('on.anon'))}</p>
  </div>`;
}

function gateClosed(c) {
  const S = c.closed, total = S.total ?? billOf(S.id).total;
  return `<div class="gate gate--bye">${neonSign('sign--sm')}
    <div class="receipt receipt--bye">
      <div class="receipt__head">${esc(VENUE.name.toUpperCase())}<br>${esc(t('g.table', { n: tableLabel(S) }))} · ${fmtTime(S.closedAt || Date.now())}</div>
      <div class="r-total"><span>${esc(t('bill.total'))}</span><b>${money(total)}</b></div>
      <div class="receipt__foot">감사합니다 · ${esc(t('bye.thanks'))}</div>
    </div>
    <h1>${esc(t('bye.t'))}</h1>
    <p>${esc(t('bye.p', { n: tableLabel(S) }))}</p>
    <button class="btn btn--line" data-act="g-rescan">${ic('qr')} ${esc(t('bye.rescan'))}</button>
  </div>`;
}

// the pocha tent at night, for the welcome screen
function tentArt() {
  const bulbs = Array.from({ length: 9 }, (_, i) => `<circle cx="${20 + i * 20}" cy="${58 + Math.sin(i / 8 * Math.PI) * 9}" r="3.4" class="bulb" style="animation-delay:${(i % 3) * 0.4}s"/>`).join('');
  return `<svg viewBox="0 0 200 120" aria-hidden="true">
    <path d="M10 46 L100 8 L190 46 Z" class="tarp-top"/>
    <path d="M10 46h180v8c-10 0-10 8-20 8s-10-8-20-8-10 8-20 8-10-8-20-8-10 8-20 8-10-8-20-8-10 8-20 8-10-8-20-8-10 8-20 8-10-8-20-8z" class="tarp-edge"/>
    <path d="M14 62v52M186 62v52" class="pole"/>
    <path d="M20 58 Q100 76 180 58" class="wire"/>${bulbs}
    <rect x="40" y="96" width="120" height="6" rx="3" class="counter"/>
  </svg>`;
}
function closedTableArt() {
  return `<svg viewBox="0 0 200 130" aria-hidden="true">
    <ellipse cx="100" cy="122" rx="70" ry="6" class="shadow"/>
    <path d="M96 76h8v44h-8z" class="leg"/><ellipse cx="100" cy="120" rx="26" ry="5" class="leg"/>
    <ellipse cx="100" cy="74" rx="66" ry="12" class="steel"/><ellipse cx="100" cy="71" rx="66" ry="12" class="steel-top"/>
    <g class="stool"><path d="M50 66h38l-6-40H56z"/><ellipse cx="69" cy="26" rx="13" ry="3.4" class="stool-rim"/></g>
    <g class="stool stool--b"><path d="M112 66h38l-6-40h-26z"/><ellipse cx="131" cy="26" rx="13" ry="3.4" class="stool-rim"/></g>
  </svg>`;
}

// ---------- the app ----------
function funModules() { const m = db.config.modules; return [['piosenki', 'fun.songs', m.songs], ['glosowanie', 'fun.vote', m.votes], ['gry', 'fun.games', m.games]].filter(x => x[2]); }

function guestApp(c) {
  const views = { menu: menuView, czat: chatView, rozrywka: funView, stolik: tableView };
  if (!views[G.tab] || (G.tab === 'rozrywka' && !funModules().length)) G.tab = 'menu';
  const tabs = [['menu', 'tab.menu', 'menu'], ['czat', 'tab.chat', 'chat'], ['rozrywka', 'tab.fun', 'mic'], ['stolik', 'tab.table', 'table']]
    .filter(([id]) => (id !== 'rozrywka' || funModules().length) && (id !== 'czat' || db.config.modules.chat));
  const badges = { czat: chatUnread(c), stolik: db.gifts.filter(g => g.to === c.session.id && g.status === 'pending').length };
  return `${tentHeader(c)}${banners(c)}
    <main class="gview gview--${G.tab}" data-scroll="g-${G.tab}-${G.sub}">${views[G.tab](c)}</main>
    ${G.tab === 'menu' ? cartBar() : ''}
    <nav class="gtabs" aria-label="${esc(t('tab.nav'))}">${tabs.map(([id, k, i]) => {
      const b = badges[id];
      const dot = id === 'czat' && !b && chatUnread(c, true) ? '<i class="dot"></i>' : '';
      return `<a href="${gHref(id)}" class="gtab${G.tab === id ? ' is-on' : ''}" ${G.tab === id ? 'aria-current="page"' : ''}>${ic(i)}<span>${esc(t(k))}</span>${b ? `<em>${b > 9 ? '9+' : b}</em>` : dot}</a>`;
    }).join('')}</nav>`;
}

function tentHeader(c) {
  const live = db.calls.some(x => x.session === c.session.id && x.status !== 'done');
  const zone = zoneOf(c.session);
  return `<header class="tent">
    <div class="tent__bar">
      <a class="tent__table" href="${gHref('stolik')}">${cap(tableLabel(c.session), 'cap--me')}<span><b>${esc(t('g.table', { n: tableLabel(c.session) }))}</b><small>${esc(L(zone?.name))}</small></span></a>
      ${neonSign('sign--bar')}
      <button class="bell${live ? ' is-lit' : ''}" data-act="g-bell" aria-label="${esc(t('call.title'))}"><span class="bell__btn" aria-hidden="true"></span><small lang="ko">호출</small></button>
    </div>
    <div class="tent__edge" aria-hidden="true"></div>
  </header>`;
}

function banners(c) {
  const S = c.session, out = [];
  if (offline) out.push(`<div class="banner banner--off" role="status">${ic('cloudOff')}<span>${esc(t('b.offline'))}${outbox.length ? ` · <b>${esc(t('b.queued', { n: outbox.length }))}</b>` : ''}</span></div>`);
  if (S.status === 'verify') out.push(`<div class="banner banner--verify">${ic('info')}<span>${esc(t('b.verify'))}</span></div>`);
  return out.length ? `<div class="banners">${out.join('')}</div>` : '';
}

// ---------- menu ----------
function menuView(c) {
  const cats = CATS.filter(k => db.menu.some(i => i.cat === k.id));
  const shown = G.cat === 'all' ? cats : cats.filter(k => k.id === G.cat);
  return `
    <div class="cats" role="tablist">${[['all', t('menu.all')], ...cats.map(k => [k.id, L(k.name)])].map(([id, name]) => `<button role="tab" data-act="g-cat" data-c="${id}" aria-selected="${G.cat === id}">${esc(name)}</button>`).join('')}</div>
    ${G.cat === 'all' && !G.a2hs ? `<div class="hint-card">${ic('homeAdd')}<div><b>${esc(t('set.a2hs'))}</b><small>${esc(t('set.a2hsHint'))}</small></div><button class="ibtn" data-act="g-a2hs-x" aria-label="${esc(t('ui.close'))}">${ic('x')}</button></div>` : ''}
    ${G.cat === 'all' ? featured() : ''}
    ${shown.map(k => `<section class="wall"><h2 class="wall__h"><span>${esc(L(k.name))}</span><i lang="ko">${esc(k.name.ko)}</i></h2>
      <div class="wall__sheets">${db.menu.filter(i => i.cat === k.id).map(paperItem).join('')}</div></section>`).join('')}
    <p class="fineprint">${esc(t('menu.legend'))} ${Object.values(ALLERGENS).map(a => `<b>${a.n}</b> ${esc(a[LANG] || a.pl)}`).join(' · ')}</p>`;
}

function featured() {
  const sign = k => {
    const it = db.menu.find(i => i.featured === k);
    if (!it) return '';
    return `<button class="neonbox neonbox--${k}" data-act="g-item" data-i="${it.id}" ${it.soldOut ? 'disabled' : ''}>
      <span class="neonbox__label">${esc(t('menu.' + k))}</span>${art(it.art)}
      <b>${esc(L(it.name))}</b><span class="neonbox__price">${money(it.price)}</span></button>`;
  };
  return `<div class="neons">${sign('hit')}${sign('chef')}</div>`;
}

function itemTags(it, full = false) {
  const out = [];
  if (it.spicy) out.push(`<span class="tag tag--hot" title="${esc(t('menu.spicy'))}">${'🌶'.repeat(it.spicy)}${full ? ' ' + esc(t('menu.spicy')) : ''}</span>`);
  if (it.vege) out.push(`<span class="tag tag--veg">${ic('leaf')}${esc(t('menu.vege'))}</span>`);
  if (it.gift && db.config.modules.gifts) out.push(`<span class="tag tag--gift">${ic('gift')}${full ? esc(t('menu.giftable')) : ''}</span>`);
  if (!full && it.allergens?.length) out.push(`<span class="tag tag--al">${it.allergens.map(a => ALLERGENS[a].n).sort((a, b) => a - b).join(' ')}</span>`);
  return out.join('');
}

function paperItem(it) {
  const inCart = sum(G.cart.filter(l => l.item === it.id), l => l.qty);
  const tilt = ((hash(it.id) % 13) - 6) / 10;
  return `<button class="paper${it.soldOut ? ' is-out' : ''}" style="--tilt:${tilt}deg" data-act="g-item" data-i="${it.id}" ${it.soldOut ? 'aria-disabled="true"' : ''}>
    <span class="paper__tape" aria-hidden="true"></span>
    <span class="paper__art">${art(it.art)}</span>
    <span class="paper__body">
      <span class="paper__ko" lang="ko">${esc(it.ko)}</span>
      <b class="paper__name">${esc(L(it.name))}</b>
      <span class="paper__desc">${esc(L(it.desc))}</span>
      <span class="paper__tags">${itemTags(it)}</span>
    </span>
    <span class="paper__price">${money(it.price)}</span>
    ${it.soldOut ? `<span class="stamp">${esc(t('menu.soldout'))}<i lang="ko">품절</i></span>` : ''}
    ${inCart ? `<span class="paper__n">${inCart}</span>` : ''}
  </button>`;
}

function cartBar() {
  if (!G.cart.length) return '';
  const n = sum(G.cart, l => l.qty), total = sum(G.cart, l => unitPrice(itemById(l.item), l.sel) * l.qty);
  return `<button class="cartbar" data-act="g-cart"><span class="cartbar__n">${n}</span><span>${esc(t('cart.mine'))}</span><b>${money(total)}</b>${ic('right')}</button>`;
}

function openItem(id) {
  const it = itemById(id);
  if (!it) return;
  if (it.soldOut) { toast(esc(t('menu.soldoutToast', { x: L(it.name) })), { icon: 'block' }); return; }
  const groups = (it.mods || []).map(g => {
    const M = MODS[g];
    return `<fieldset class="mods" data-g="${g}" data-type="${M.type}" data-max="${M.max || 1}">
      <legend>${esc(L(M.name))} <small>${esc(M.type === 'one' ? t('item.pickOne') : t('item.pickMany', { n: M.max }))}</small></legend>
      ${M.opts.map((o, i) => `<label class="opt"><input type="${M.type === 'one' ? 'radio' : 'checkbox'}" name="g-${g}" value="${o.id}" ${M.type === 'one' && i === 0 ? 'checked' : ''}><span class="opt__box" aria-hidden="true"></span><span>${esc(L(o.name))}</span>${o.price ? `<em>+${money(o.price)}</em>` : ''}</label>`).join('')}
    </fieldset>`;
  }).join('');
  const al = (it.allergens || []).map(a => `${ALLERGENS[a].n} ${ALLERGENS[a][LANG] || ALLERGENS[a].pl}`);
  const box = gopen(`<div class="sheet__grab" aria-hidden="true"></div>
    <div class="isheet">
      <div class="isheet__art">${art(it.art)}</div>
      <p class="isheet__ko" lang="ko">${esc(it.ko)}</p>
      <h3 class="isheet__name">${esc(L(it.name))}</h3>
      <p class="isheet__desc">${esc(L(it.desc))}</p>
      <p class="isheet__tags">${itemTags(it, true)}</p>
      <p class="isheet__al">${ic('info')} ${esc(t('item.allergens'))}: ${esc(al.join(', ') || t('item.noAllergens'))}</p>
      <form id="itemForm">
        ${groups}
        <label class="field"><span>${esc(t('item.note'))}</span><textarea name="note" maxlength="120" rows="2" placeholder="${esc(t('item.notePh'))}"></textarea></label>
        <div class="isheet__foot">
          <div class="stepper"><button type="button" data-q="-1" aria-label="${esc(t('ui.less'))}">${ic('minus')}</button><output id="iqty">1</output><button type="button" data-q="1" aria-label="${esc(t('ui.more'))}">${ic('plus')}</button></div>
          <button class="btn btn--tarp" type="submit">${esc(t('item.add'))} · <span id="iprice"></span></button>
        </div>
      </form>
    </div>`);
  const form = $('#itemForm', box);
  let qty = 1;
  const read = () => {
    const sel = {};
    $$('fieldset.mods', form).forEach(f => { sel[f.dataset.g] = $$('input:checked', f).map(x => x.value); });
    return sel;
  };
  const upd = () => {
    $$('fieldset.mods[data-type="many"]', form).forEach(f => {
      const full = $$('input:checked', f).length >= +f.dataset.max;
      $$('input', f).forEach(x => { x.disabled = full && !x.checked; });
    });
    $('#iqty', box).textContent = qty;
    $('#iprice', box).textContent = money(unitPrice(it, read()) * qty);
  };
  form.addEventListener('change', upd);
  form.addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) { qty = clamp(qty + +b.dataset.q, 1, 20); upd(); } });
  form.addEventListener('submit', e => {
    e.preventDefault();
    addToCart(it, read(), qty, form.note.value.trim());
    closeLayer();
  });
  upd();
}

function saveCart() { gsave('cart', G.cart); G.cartKey = null; sess.drop(GK + 'cartkey'); }
function addToCart(it, sel, qty, note) {
  const same = G.cart.find(l => l.item === it.id && JSON.stringify(l.sel) === JSON.stringify(sel) && l.note === note);
  if (same) same.qty = clamp(same.qty + qty, 1, 20);
  else G.cart.push({ id: uid('l'), item: it.id, sel, qty, note });
  saveCart();
  toast(esc(t('cart.added', { x: L(it.name) })), { icon: 'check', action: { label: t('cart.show'), run: openCart } });
  render();
}

function cartSheet() {
  const c = gctx();
  if (!G.cart.length) return `<div class="sheet__head"><h3>${esc(t('cart.title'))}</h3><button class="ibtn" data-close aria-label="${esc(t('ui.close'))}">${ic('x')}</button></div>
    <div class="empty">${ic('receipt')}<p>${esc(t('cart.empty'))}</p></div>`;
  const total = sum(G.cart, l => unitPrice(itemById(l.item), l.sel) * l.qty);
  const hold = !c.session.approved ? t('cart.holdVerify') : total > db.config.orderLimit ? t('cart.holdLimit', { x: money(db.config.orderLimit) }) : '';
  return `<div class="sheet__head"><h3>${esc(t('cart.title'))}</h3><button class="ibtn" data-close aria-label="${esc(t('ui.close'))}">${ic('x')}</button></div>
    <div class="check">
      <div class="check__top"><b>${esc(VENUE.name.toUpperCase())}</b><span>${esc(t('g.table', { n: tableLabel(c.session) }))} · ${esc(t('cart.personal'))}</span></div>
      ${G.cart.map(l => {
        const it = itemById(l.item), out = it.soldOut;
        return `<div class="check__line${out ? ' is-out' : ''}">
          <div class="stepper stepper--sm"><button data-act="g-cq" data-l="${l.id}" data-d="-1" aria-label="${esc(t('ui.less'))}">${ic('minus')}</button><b>${l.qty}</b><button data-act="g-cq" data-l="${l.id}" data-d="1" aria-label="${esc(t('ui.more'))}">${ic('plus')}</button></div>
          <div class="check__what"><b>${esc(L(it.name))}</b>${modsText(l) ? `<small>${esc(modsText(l))}</small>` : ''}${out ? `<small class="bad">${esc(t('menu.soldout'))}</small>` : ''}
            <input class="check__note" id="note-${l.id}" data-in="g-cnote" data-l="${l.id}" value="${esc(l.note)}" placeholder="${esc(t('cart.notePh'))}" maxlength="120"></div>
          <span class="check__price">${money(unitPrice(it, l.sel) * l.qty)}</span>
        </div>`;
      }).join('')}
      <div class="check__sum"><span>${esc(t('cart.total'))}</span><b>${money(total)}</b></div>
    </div>
    <p class="sheet__hint">${ic('users')} ${esc(t('cart.shared', { n: tableLabel(c.session) }))}</p>
    ${hold ? `<p class="sheet__hint sheet__hint--warn">${ic('info')} ${esc(hold)}</p>` : ''}
    <button class="btn btn--tarp btn--block" data-act="g-send">${ic('send')} ${esc(t('cart.send'))} · ${money(total)}</button>`;
}
function openCart() { gopen(cartSheet()); G.sheet = () => paint(layerBox(), cartSheet()); }

function sendCart() {
  const c = gctx();
  if (!G.cart.length || !c.me) return;
  if (!G.cartKey) { G.cartKey = uid('k'); gsave('cartkey', G.cartKey); } // a second tap or a replay sends the same key
  const r = send('order', { key: G.cartKey, s: c.session.id, p: c.me.id, items: G.cart.map(l => ({ item: l.item, qty: l.qty, sel: l.sel, note: l.note })) });
  if (!r.ok) {
    toast(esc(r.code === 'soldout' ? t('e.soldout', { x: r.items.map(itemName).join(', ') }) : errText(r)), { icon: 'alert', kind: 'bad' });
    G.sheet?.();
    return;
  }
  G.cart = [];
  saveCart();
  closeLayer();
  toast(esc(t(r.queued ? 'ord.toastQueued' : r.hold ? 'ord.toastHold' : 'ord.toastSent')), { icon: r.queued ? 'cloudOff' : 'check', kind: r.queued ? '' : 'ok' });
  gGo('stolik');
}

// ---------- the table: calls, orders, bill, settings ----------
function callGrid(c) {
  return `<div class="calls">${db.config.reasons.filter(r => r.on).map(r => {
    const a = myCall(c, r.id);
    return `<button class="callbtn${a ? ' is-on is-' + a.status : ''}" data-act="g-call" data-r="${r.id}">${ic(r.icon)}<span>${esc(L(r.name))}</span>${a ? `<small>${esc(t(a.status === 'onway' ? 'call.onway' : 'call.sent'))} · ${since(a.at, { fmt: 'clock' })}</small>` : ''}</button>`;
  }).join('')}</div>`;
}

function orderTicket(o, c, queued = false) {
  const idx = ORDER_STEPS.indexOf(o.status);
  const who = queued || o.by === c.me.id ? t('ord.you') : partById(o.by)?.nick || t('ord.phone');
  return `<article class="gticket gticket--${queued ? 'queued' : o.status}">
    <header><b>${queued ? '—' : '#' + o.no}</b><span>${fmtTime(o.at)}</span><span>${esc(who)}</span></header>
    <ul>${o.items.map(l => `<li><b>${l.qty}×</b><span>${esc(itemName(l.item))}${modsText(l) ? `<small>${esc(modsText(l))}</small>` : ''}${l.note ? `<small class="note">„${esc(l.note)}”</small>` : ''}</span></li>`).join('')}</ul>
    ${queued ? `<p class="gticket__flag">${ic('cloudOff')} ${esc(t('ord.waitSignal'))}</p>`
      : o.status === 'rejected' ? `<p class="gticket__flag gticket__flag--bad">${ic('x')} ${esc(t('ord.rejected'))}: ${esc(o.reason)}</p>`
      : o.status === 'hold' ? `<p class="gticket__flag">${ic('clock')} ${esc(t(o.hold === 'verify' ? 'ord.holdVerify' : 'ord.holdLimit'))}</p>`
      : `<ol class="track">${ORDER_STEPS.map((st, i) => `<li class="${i <= idx ? 'done' : ''}${i === idx ? ' now' : ''}"><i></i><span>${esc(t('ord.' + st))}</span>${o.times[st] ? `<time>${fmtTime(o.times[st])}</time>` : ''}</li>`).join('')}</ol>`}
  </article>`;
}

function giftLine(g, dir) {
  const it = itemById(g.item);
  const other = dir === 'in' ? (g.house ? t('gift.house') : t('g.tableShort', { n: noOf(g.from) })) : t('g.tableShort', { n: noOf(g.to) });
  return `${esc(L(it?.name))}${modsText(g) ? ` (${esc(modsText(g))})` : ''} ${dir === 'in' ? '←' : '→'} ${esc(other)}`;
}

function tableView(c) {
  const S = c.session, b = billOf(S.id);
  const orders = db.orders.filter(o => o.session === S.id).sort((x, y) => y.at - x.at);
  const queued = outbox.filter(q => q.action === 'order' && q.args.s === S.id).map(q => ({ at: q.args.at, items: q.args.items.map(l => ({ ...l, unit: unitPrice(itemById(l.item), l.sel) })) }));
  const waiting = db.gifts.filter(g => g.to === S.id && g.status === 'pending');
  const mineOut = db.gifts.filter(g => g.from === S.id && g.status === 'pending');
  const opener = staffById(S.openedBy);
  return `<div class="tview">
    <section class="tview__head">${cap(tableLabel(S), 'cap--me cap--lg')}<div>
      <h2>${esc(t('g.table', { n: tableLabel(S) }))} · ${esc(L(zoneOf(S)?.name))}</h2>
      <p>${esc(opener ? t('st.openedBy', { time: fmtTime(S.openedAt), who: opener.name }) : t('st.openedScan', { time: fmtTime(S.openedAt) }))}</p>
      <p>${ic('phone')} ${esc(t('st.phones', { n: partsOf(S.id).length }))}${c.me.nick ? ` · ${esc(t('st.you', { x: c.me.nick }))}` : ''}</p>
    </div></section>

    <section class="block"><h3 class="block__h">${esc(t('call.title'))}</h3>${callGrid(c)}</section>

    ${waiting.length || mineOut.length ? `<section class="block"><h3 class="block__h">${esc(t('gift.pendingH'))}</h3>
      ${waiting.map(g => `<div class="giftrow">${ic('gift')}<span>${esc(t('gift.waitsYou', { n: g.house ? t('gift.house') : noOf(g.from), x: itemName(g.item) }))}</span><button class="btn btn--soju btn--sm" data-act="g-gshow" data-g="${g.id}">${esc(t('gift.see'))}</button></div>`).join('')}
      ${mineOut.map(g => `<div class="giftrow giftrow--out">${ic('clock')}<span>${esc(t('gift.waitsThem', { n: noOf(g.to), x: itemName(g.item) }))}</span></div>`).join('')}
    </section>` : ''}

    <section class="block"><h3 class="block__h">${esc(t('st.orders'))} <small>${esc(t('st.ordersHint'))}</small></h3>
      ${orders.length || queued.length ? [...queued.map(o => orderTicket(o, c, true)), ...orders.map(o => orderTicket(o, c))].join('') : `<p class="empty-line">${esc(t('st.noOrders'))}</p>`}
    </section>

    <section class="block"><h3 class="block__h">${esc(t('st.bill'))}</h3>
      <div class="receipt">
        <div class="receipt__head">${esc(VENUE.name.toUpperCase())} · ${VENUE.ko}<br>${esc(t('g.table', { n: tableLabel(S) }))} · ${fmtTime(Date.now())}</div>
        ${b.lines.map(l => `<div class="r-line"><span>${l.qty} × ${esc(itemName(l.item))}${modsText(l) ? `<small>${esc(modsText(l))}</small>` : ''}</span><b>${money(l.unit * l.qty)}</b></div>`).join('') || `<div class="r-line r-line--muted"><span>${esc(t('bill.empty'))}</span></div>`}
        ${b.sent.map(g => `<div class="r-line r-gift"><span>🎁 ${giftLine(g, 'out')}</span><b>${money(g.price)}</b></div>`).join('')}
        ${b.got.map(g => `<div class="r-line r-got"><span>🎁 ${giftLine(g, 'in')}</span><b>${esc(t('bill.free'))}</b></div>`).join('')}
        <div class="r-total"><span>${esc(t('bill.total'))}</span><b>${money(b.total)}</b></div>
        ${b.held.length ? `<p class="r-note">${esc(t('bill.held', { n: b.held.length }))}</p>` : ''}
      </div>
      <button class="btn btn--line btn--block" data-act="g-call" data-r="bill">${ic('receipt')} ${esc(t('bill.ask'))}</button>
      <p class="fine">${esc(t('bill.split'))}</p>
    </section>

    <section class="block"><h3 class="block__h">${esc(t('st.settings'))}</h3>${settingsBlock(c)}</section>
  </div>`;
}

function settingsBlock(c) {
  const S = c.session, W = db.config.wifi;
  return `<div class="settings">
    <div class="set-row"><span class="set-row__l">${ic('globe')} ${esc(t('set.lang'))}</span>${langSwitch('g-lang')}</div>
    <label class="set-row"><span class="set-row__l">${ic('user')} ${esc(t('set.nick'))}</span><input id="gNick" class="input" data-ch="g-nick" value="${esc(c.me.nick)}" placeholder="${esc(t('g.table', { n: tableLabel(S) }))}" maxlength="24"></label>
    <label class="set-row set-row--sw"><span class="set-row__l">${ic('eyeOff')} <span>${esc(t('set.private'))}<small>${esc(t('set.privateHint'))}</small></span></span><input type="checkbox" class="switch" data-ch="g-private" ${S.private ? 'checked' : ''}></label>
    ${S.blocks.length ? `<div class="set-row set-row--col"><span class="set-row__l">${ic('block')} ${esc(t('set.blocked'))}</span><div class="chips">${S.blocks.map(b => `<button class="chip" data-act="g-unblock" data-s="${b}">${cap(noOf(b), 'cap--sm')} ${esc(t('set.unblock'))}</button>`).join('')}</div></div>` : ''}
    <div class="set-row set-row--info">${ic('homeAdd')}<div><b>${esc(t('set.a2hs'))}</b><small>${esc(t('set.a2hsHint'))}</small></div></div>
    ${W.ssid ? `<div class="set-row set-row--info">${ic('wifi')}<div><b>Wi-Fi: ${esc(W.ssid)}</b><small>${esc(t('set.wifiPass'))}: <code>${esc(W.pass)}</code></small></div></div>` : ''}
    <button class="link" data-act="g-terms">${esc(t('on.termsLink'))}</button>
  </div>`;
}

function openCallSheet() {
  const draw = () => `<div class="sheet__head"><h3>${esc(t('call.title'))}</h3><button class="ibtn" data-close aria-label="${esc(t('ui.close'))}">${ic('x')}</button></div>
    <p class="sheet__lead">${esc(t('call.lead'))}</p>${callGrid(gctx())}`;
  gopen(draw());
  G.sheet = () => paint(layerBox(), draw());
}

function callStaff(reason, text = '') {
  const c = gctx();
  if (myCall(c, reason)) { toast(esc(t('e.dupCall')), { icon: 'bell' }); return; }
  if (reason === 'other' && !text) {
    gopen(`<div class="sheet__head"><h3>${esc(L(db.config.reasons.find(r => r.id === 'other').name))}</h3><button class="ibtn" data-close aria-label="${esc(t('ui.close'))}">${ic('x')}</button></div>
      <form data-submit="g-call-other"><label class="field"><span>${esc(t('call.otherQ'))}</span><input name="t" maxlength="120" required autofocus></label>
      <button class="btn btn--tarp btn--block" type="submit">${ic('bell')} ${esc(t('call.send'))}</button></form>`);
    return;
  }
  const r = send('call', { s: c.session.id, reason, text });
  if (!r.ok) { toast(esc(errText(r)), { icon: 'alert', kind: 'bad' }); return; }
  sound('dingdong');
  toast(esc(t(r.queued ? 'call.queued' : 'call.done')), { icon: 'bell', kind: 'ok' });
}

// ---------- chat ----------
function readKey(ch) { return G.read[ch] || 0; }
function markRead(ch) { G.read[ch] = Date.now(); gsave('read', G.read); }
function threadsOf(sid) {
  const ids = new Set();
  db.msgs.forEach(m => { if (isDm(m.ch) && m.ch.includes(sid)) ids.add(dmPeer(m.ch, sid)); });
  return [...ids].map(sessionById).filter(Boolean);
}
// DMs count as a number on the tab; the public channel only lights a dot
function chatUnread(c, publicOnly = false) {
  const S = c.session.id, since0 = c.me.joinedAt;
  if (publicOnly) return db.msgs.some(m => m.ch === 'all' && m.from !== S && !m.deleted && m.at > Math.max(readKey('all'), since0) && !blockedEither(m.from, S));
  return db.msgs.filter(m => isDm(m.ch) && m.ch.includes(S) && m.from !== S && m.at > Math.max(readKey(m.ch), since0)).length;
}

function chatView(c) {
  const S = c.session, C = db.config;
  if (S.private) return `<div class="empty empty--tall">${ic('eyeOff')}<h3>${esc(t('chat.privateT'))}</h3><p>${esc(t('chat.privateP'))}</p><button class="btn btn--line" data-act="g-private-off">${esc(t('chat.privateOff'))}</button></div>`;
  const peer = G.sub ? sessionById(G.sub) : null;
  const ch = peer ? dmCh(S.id, peer.id) : 'all';
  markRead(ch);
  const threads = threadsOf(S.id);
  if (peer && !threads.includes(peer)) threads.unshift(peer);
  const online = liveSessions().filter(x => x.id !== S.id);
  const unreadOf = x => db.msgs.filter(m => m.ch === dmCh(S.id, x.id) && m.from !== S.id && m.at > Math.max(readKey(m.ch), c.me.joinedAt)).length;
  const offReason = !C.chatOn ? t('chat.offGlobal') : S.muted ? t('chat.muted') : peer && !isLive(peer) ? t('chat.peerGone') : peer && !C.modules.dm ? t('e.dmOff') : '';
  return `<div class="chat">
    <div class="chans" role="tablist">
      <a class="chan${!peer ? ' is-on' : ''}" href="${gHref('czat')}" role="tab" aria-selected="${!peer}"><b>#</b>${esc(t('chat.all'))}${chatUnread(c, true) && peer ? '<i class="dot"></i>' : ''}</a>
      ${C.modules.dm ? threads.map(x => { const n = unreadOf(x); return `<a class="chan chan--dm${peer === x ? ' is-on' : ''}" href="${gHref('czat', x.id)}" role="tab" aria-selected="${peer === x}" aria-label="${esc(t('chat.dmWith', { n: tableLabel(x) }))}">${cap(tableLabel(x), 'cap--sm')}${n ? `<em>${n}</em>` : ''}</a>`; }).join('') : ''}
      <button class="chan chan--online" data-act="g-online">${ic('users')}<span>${esc(t('chat.online', { n: online.length + 1 }))}</span></button>
    </div>
    ${peer ? dmHead(peer, c) : `<p class="chat__lead">${esc(t('chat.allLead'))}</p>`}
    <div class="chat__list" data-scroll="chat-${ch}" data-stick>${messages(ch, c)}</div>
    ${composer(ch, peer, offReason)}
  </div>`;
}

function dmHead(peer, c) {
  const blocked = c.session.blocks.includes(peer.id);
  return `<div class="dmhead">${cap(tableLabel(peer))}<div><b>${esc(t('chat.dmWith', { n: tableLabel(peer) }))}</b><small>${esc([nickOf(peer.id), L(zoneOf(peer)?.name)].filter(Boolean).join(' · '))}</small></div>
    ${db.config.modules.gifts && isLive(peer) ? `<button class="ibtn" data-act="g-gift" data-s="${peer.id}" aria-label="${esc(t('gift.send'))}">${ic('gift')}</button>` : ''}
    <button class="ibtn${blocked ? ' is-on' : ''}" data-act="g-block" data-s="${peer.id}" aria-label="${esc(t(blocked ? 'chat.unblock' : 'chat.block', { n: tableLabel(peer) }))}">${ic('block')}</button></div>`;
}

function messages(ch, c) {
  const S = c.session.id;
  const list = db.msgs.filter(m => m.ch === ch && (m.from === S || !blockedEither(m.from, S))).map(m => ({ ...m, kind: 'msg' }));
  if (ch === 'all') {
    db.gifts.filter(g => g.from && (g.status === 'accepted' || g.status === 'delivered') && g.at > c.me.joinedAt - 30 * MIN)
      .forEach(g => list.push({ kind: 'gift', at: g.times.accepted || g.at, g }));
  }
  outbox.filter(q => q.action === 'msg' && q.args.ch === ch).forEach(q => list.push({ kind: 'msg', queued: true, from: S, text: q.args.text, at: q.args.at, nick: c.me.nick }));
  list.sort((a, b) => a.at - b.at);
  if (!list.length) return `<p class="chat__empty">${esc(t(ch === 'all' ? 'chat.emptyAll' : 'chat.emptyDm'))}</p>`;
  let prev = null;
  return list.slice(-120).map(m => {
    if (m.kind === 'gift') {
      prev = null;
      return `<div class="msg-sys">${ic('gift')}<span>${esc(t('chat.giftEvent', { a: noOf(m.g.from), b: noOf(m.g.to), x: itemName(m.g.item) }))}</span></div>`;
    }
    const mine = m.from === S, grouped = prev && prev.from === m.from && m.at - prev.at < 3 * MIN;
    prev = m;
    const nick = m.nick || (!mine ? nickOf(m.from) : '');
    return `<div class="msg${mine ? ' msg--me' : ''}${grouped ? ' msg--grouped' : ''}${m.queued ? ' msg--queued' : ''}">
      ${!mine && !grouped ? `<button class="msg__who" data-act="g-who" data-s="${m.from}">${cap(noOf(m.from), 'cap--sm')}<b>${esc(t('g.tableShort', { n: noOf(m.from) }))}</b>${nick ? `<span>${esc(nick)}</span>` : ''}</button>` : ''}
      <div class="msg__b"${!mine && !m.deleted ? ` data-act="g-msgmenu" data-m="${m.id}"` : ''}>${m.deleted ? `<i>${esc(t('chat.deleted'))}</i>` : esc(m.text)}</div>
      <div class="msg__meta">${m.queued ? `${ic('cloudOff')} ${esc(t('chat.queued'))}` : `<time>${fmtTime(m.at)}</time>`}${mine && m.nick ? ` · ${esc(m.nick)}` : ''}${m.filtered ? ` · ${esc(t('chat.filtered'))}` : ''}</div>
    </div>`;
  }).join('');
}

function composer(ch, peer, off) {
  const C = db.config;
  if (off) return `<div class="composer composer--off">${ic('chatOff')}<span>${esc(off)}</span></div>`;
  return `<div class="composer">
    <div class="quick" role="list">${C.quick.map(q => `<button type="button" class="qr" data-act="g-quick" data-q="${q.id}">${esc(q[LANG] || q.pl)}</button>`).join('')}</div>
    <form class="composer__row" data-submit="g-msg" autocomplete="off">
      <button type="button" class="ibtn" data-act="g-emoji" aria-pressed="${G.emoji}" aria-label="Emoji">${ic('smile')}</button>
      <input id="chatIn" name="t" class="input" maxlength="${C.chatMax}" placeholder="${esc(peer ? t('chat.phDm', { n: tableLabel(peer) }) : t('chat.phAll'))}" value="${esc(G.draft)}" data-in="g-draft">
      <span class="composer__count" id="chatCount">${G.draft.length}/${C.chatMax}</span>
      <button class="ibtn ibtn--send" type="submit" aria-label="${esc(t('chat.send'))}">${ic('send')}</button>
    </form>
    ${G.emoji ? `<div class="emoji">${EMOJI.map(e => `<button type="button" data-act="g-emo" data-e="${e}">${e}</button>`).join('')}</div>` : ''}
  </div>`;
}

function sendMsg(text) {
  const c = gctx(), body = String(text || '').trim();
  if (!body) return false;
  const now = Date.now();
  if (now < G.coolUntil) { toast(esc(t('e.rate', { s: Math.ceil((G.coolUntil - now) / SEC) })), { icon: 'clock' }); return false; }
  const ch = G.sub && sessionById(G.sub) ? dmCh(c.session.id, G.sub) : 'all';
  const r = send('msg', { s: c.session.id, p: c.me.id, ch, text: body });
  if (!r.ok) { toast(esc(errText(r)), { icon: 'alert', kind: 'bad' }); return false; }
  G.coolUntil = now + db.config.chatRate * SEC;
  sound('blip');
  return true;
}

function openOnline() {
  const c = gctx(), S = c.session.id;
  const list = liveSessions().filter(x => x.id !== S).sort((a, b) => tableById(a.table).no - tableById(b.table).no);
  gopen(`<div class="sheet__head"><h3>${esc(t('chat.onlineT', { n: list.length + 1 }))}</h3><button class="ibtn" data-close aria-label="${esc(t('ui.close'))}">${ic('x')}</button></div>
    <p class="sheet__lead">${esc(t('chat.onlineLead'))}</p>
    <ul class="online">${list.map(x => {
      const no = x.private || blockedEither(x.id, S);
      return `<li${no ? ' class="is-no"' : ''}>${cap(tableLabel(x))}<div><b>${esc(t('g.tableShort', { n: tableLabel(x) }))}</b><small>${esc([nickOf(x.id), L(zoneOf(x)?.name), x.private ? t('chat.isPrivate') : ''].filter(Boolean).join(' · '))}</small></div>
      ${no ? '' : `${db.config.modules.dm ? `<a class="ibtn" href="${gHref('czat', x.id)}" data-close aria-label="${esc(t('chat.writeDm'))}">${ic('chat')}</a>` : ''}${db.config.modules.gifts ? `<button class="ibtn" data-act="g-gift" data-s="${x.id}" aria-label="${esc(t('gift.send'))}">${ic('gift')}</button>` : ''}`}</li>`;
    }).join('')}</ul>`);
}

function openMsgMenu(id) {
  const m = db.msgs.find(x => x.id === id), c = gctx();
  if (!m) return;
  const n = noOf(m.from), blocked = c.session.blocks.includes(m.from);
  gopen(`<div class="sheet__head"><h3>${cap(n, 'cap--sm')} ${esc(t('g.tableShort', { n }))}</h3><button class="ibtn" data-close aria-label="${esc(t('ui.close'))}">${ic('x')}</button></div>
    <blockquote class="quote">${esc(m.text)}</blockquote>
    <div class="menu-list">
      ${db.config.modules.dm && isLive(sessionById(m.from)) ? `<a href="${gHref('czat', m.from)}" data-close>${ic('chat')} ${esc(t('chat.writeDm'))}</a>` : ''}
      ${db.config.modules.gifts && isLive(sessionById(m.from)) ? `<button data-act="g-gift" data-s="${m.from}">${ic('gift')} ${esc(t('gift.send'))}</button>` : ''}
      <button data-act="g-report" data-m="${m.id}">${ic('flag')} ${esc(t('chat.report'))}</button>
      <button data-act="g-block" data-s="${m.from}" class="${blocked ? '' : 'bad'}">${ic('block')} ${esc(t(blocked ? 'chat.unblock' : 'chat.block', { n }))}</button>
    </div>`);
}

function openReport(id) {
  gopen(`<div class="sheet__head"><h3>${esc(t('chat.report'))}</h3><button class="ibtn" data-close aria-label="${esc(t('ui.close'))}">${ic('x')}</button></div>
    <p class="sheet__lead">${esc(t('chat.reportLead'))}</p>
    <div class="menu-list">${['spam', 'offensive', 'harass', 'other'].map(r => `<button data-act="g-report-go" data-m="${id}" data-r="${r}">${ic('flag')} ${esc(t('chat.rep.' + r))}</button>`).join('')}</div>`);
}

function openBlock(sid) {
  const c = gctx(), n = noOf(sid);
  if (c.session.blocks.includes(sid)) { send('block', { s: c.session.id, target: sid, on: false }); closeLayer(); toast(esc(t('chat.unblocked', { n })), { icon: 'check' }); return; }
  gopen(`<div class="sheet__head"><h3>${esc(t('chat.block', { n }))}</h3><button class="ibtn" data-close aria-label="${esc(t('ui.close'))}">${ic('x')}</button></div>
    <p class="sheet__lead">${esc(t('chat.blockLead', { n }))}</p>
    <button class="btn btn--bad btn--block" data-act="g-block-go" data-s="${sid}">${ic('block')} ${esc(t('chat.blockGo'))}</button>`);
}

// ---------- gifts ----------
const GF = { to: null, zone: 'sala', item: null, sel: {}, msg: '' };

function openGift(to) {
  const c = gctx();
  if (!c.session.approved) { toast(esc(t('e.notApproved')), { icon: 'info' }); return; }
  Object.assign(GF, { to: to || null, item: null, sel: {}, msg: '', zone: tableById((to ? sessionById(to) : c.session).table).zone });
  gopen(giftSheet());
  G.sheet = () => paint(layerBox(), giftSheet());
}

function floorHtml(zone, btn) {
  const decor = (DECOR[zone] || []).map(x => `<span class="decor${x.door ? ' decor--door' : ''}${x.tarp ? ' decor--tarp' : ''}" style="left:${x.x}%;top:${x.y}%;width:${x.w}%;height:${x.h}%">${esc(x.label)}</span>`).join('');
  return `<div class="floor floor--${zone}">${decor}${db.tables.filter(T => T.zone === zone).map(btn).join('')}</div>`;
}

function giftSheet() {
  const c = gctx(), S = c.session;
  const close = `<button class="ibtn" data-close aria-label="${esc(t('ui.close'))}">${ic('x')}</button>`;
  const T = GF.to && sessionById(GF.to);
  if (!T || !isLive(T)) {
    GF.to = null;
    const counts = Object.fromEntries(ZONES.map(z => [z.id, liveSessions().filter(s => tableById(s.table).zone === z.id).length]));
    return `<div class="sheet__head"><h3>${esc(t('gift.title'))}</h3>${close}</div>
      <p class="sheet__lead">${esc(t('gift.pickTable'))}</p>
      <div class="seg seg--zones">${ZONES.map(z => `<button data-act="g-gzone" data-z="${z.id}" aria-pressed="${GF.zone === z.id}">${esc(L(z.name))} <small>${counts[z.id]}</small></button>`).join('')}</div>
      ${floorHtml(GF.zone, tb => {
        const s = sessionOfTable(tb.id), me = s && s.id === S.id;
        const st = me ? 'me' : !s ? 'off' : s.private || blockedEither(s.id, S.id) ? 'no' : 'on';
        return `<button class="tbl tbl--${st} tbl--s${tb.seats}" style="left:${tb.x}%;top:${tb.y}%" ${st === 'on' ? `data-act="g-gto" data-s="${s.id}"` : 'disabled'} aria-label="${esc(t('g.tableShort', { n: tb.no }))}">${tableArt(tb.seats)}<b>${tb.no}</b>${me ? `<em>${esc(t('gift.myTable'))}</em>` : ''}</button>`;
      })}
      <p class="legend"><span><i class="lg lg--me"></i>${esc(t('gift.lgMe'))}</span><span><i class="lg lg--on"></i>${esc(t('gift.lgOn'))}</span><span><i class="lg lg--off"></i>${esc(t('gift.lgOff'))}</span><span><i class="lg lg--no"></i>${esc(t('gift.lgNo'))}</span></p>`;
  }
  const items = db.menu.filter(i => i.gift && !i.soldOut);
  const it = GF.item && itemById(GF.item);
  const one = it && (it.mods || []).filter(g => MODS[g].type === 'one');
  const price = it ? unitPrice(it, GF.sel) : 0;
  const used = db.gifts.filter(g => g.from === S.id && g.status !== 'declined');
  return `<div class="sheet__head"><button class="ibtn" data-act="g-gback" aria-label="${esc(t('ui.back'))}">${ic('back')}</button><h3>${esc(t('gift.for', { n: tableLabel(T) }))}</h3>${close}</div>
    <div class="giftto">${cap(tableLabel(T), 'cap--lg')}<div><b>${esc(t('g.tableShort', { n: tableLabel(T) }))}</b><small>${esc([nickOf(T.id), L(zoneOf(T)?.name)].filter(Boolean).join(' · '))}</small></div></div>
    <div class="gitems">${items.map(x => `<button class="gitem${GF.item === x.id ? ' is-on' : ''}" data-act="g-gitem" data-i="${x.id}" aria-pressed="${GF.item === x.id}">${art(x.art)}<span>${esc(L(x.name))}</span><b>${money(x.price)}</b></button>`).join('')}</div>
    ${one?.length ? one.map(g => `<fieldset class="mods mods--inline"><legend>${esc(L(MODS[g].name))}</legend>${MODS[g].opts.map(o => `<label class="opt"><input type="radio" name="gf-${g}" data-ch="g-gopt" data-g="${g}" value="${o.id}" ${GF.sel[g]?.[0] === o.id ? 'checked' : ''}><span class="opt__box"></span><span>${esc(L(o.name))}</span></label>`).join('')}</fieldset>`).join('') : ''}
    <label class="field"><span>${esc(t('gift.msg'))}</span><input id="giftMsg" class="input" maxlength="100" data-in="g-gmsg" value="${esc(GF.msg)}" placeholder="${esc(t('gift.msgPh'))}"></label>
    <div class="quick quick--wrap">${db.config.quick.slice(0, 4).map(q => `<button type="button" class="qr" data-act="g-gquick" data-q="${q.id}">${esc(q[LANG] || q.pl)}</button>`).join('')}</div>
    <div class="giftsum">
      <p>${ic('receipt')} ${esc(t('gift.billNote', { x: it ? money(price) : '—', n: tableLabel(S) }))}</p>
      ${db.config.giftAccept ? `<p>${ic('check')} ${esc(t('gift.acceptNote', { n: tableLabel(T) }))}</p>` : ''}
      <p class="fine">${esc(t('gift.left', { n: Math.max(0, db.config.giftMax - used.length), x: money(Math.max(0, db.config.giftMaxValue - sum(used, g => g.price))) }))}</p>
    </div>
    <button class="btn btn--tarp btn--block" data-act="g-gsend" ${it ? '' : 'disabled'}>${ic('gift')} ${esc(t('gift.sendBtn'))}${it ? ' · ' + money(price) : ''}</button>`;
}

function sendGift() {
  const c = gctx(), it = itemById(GF.item);
  if (!it || !GF.to) return;
  const r = send('gift', { s: c.session.id, p: c.me.id, to: GF.to, item: it.id, sel: { ...defaultSel(it), ...GF.sel }, msg: GF.msg });
  if (!r.ok) { toast(esc(errText(r)), { icon: 'alert', kind: 'bad' }); return; }
  closeLayer();
  sound('gift');
  toast(esc(t(r.queued ? 'gift.queued' : db.config.giftAccept ? 'gift.sentWait' : 'gift.sent', { n: noOf(GF.to) })), { icon: 'gift', kind: 'ok' });
}

// the bottle slides across the steel table to the phone that got it
function giftOverlayCheck(c) {
  const ov = $('.gift-ov');
  if (ov) {
    const g = db.gifts.find(x => x.id === ov.dataset.g);
    if (ov.dataset.state === 'ask' && (!g || g.status !== 'pending')) ov.remove();
    else return;
  }
  const g = db.gifts.find(x => x.to === c.session.id && !G.seenGifts.includes(x.id) && (x.status === 'pending' || (x.status === 'accepted' && (x.house || x.times.accepted === x.at))));
  if (g) showGift(g);
}

function showGift(g, state) {
  const it = itemById(g.item), from = g.house ? null : g.from;
  const ask = (state || (g.status === 'pending' ? 'ask' : 'got')) === 'ask';
  if (!G.seenGifts.includes(g.id)) { G.seenGifts.push(g.id); gsave('seengifts', G.seenGifts); }
  $('.gift-ov')?.remove();
  const el = document.createElement('div');
  el.className = 'gift-ov';
  el.dataset.g = g.id;
  el.dataset.state = ask ? 'ask' : 'got';
  el.innerHTML = `<div class="gift-ov__stage" aria-hidden="true"><div class="gift-ov__table"></div><div class="gift-ov__item">${art(it.art)}<span class="bow"></span></div></div>
    <div class="gift-ov__card" role="dialog" aria-modal="true" aria-label="${esc(t('gift.forYou'))}">
      <p class="gift-ov__from">${from ? cap(noOf(from)) : cap('★', 'cap--house')}<span>${esc(from ? t('gift.fromTable', { n: noOf(from) }) : t('gift.house'))}${from && nickOf(from) ? `<small>${esc(nickOf(from))}</small>` : ''}</span></p>
      <h2>${esc(t('gift.forYou'))}</h2>
      <p class="gift-ov__what">${esc(L(it.name))}${modsText(g) ? ` · ${esc(modsText(g))}` : ''}</p>
      ${g.msg ? `<blockquote>„${esc(g.msg)}”</blockquote>` : ''}
      <div class="gift-ov__acts">${ask
        ? `<button class="btn btn--soju" data-act="g-gyes">${ic('check')} ${esc(t('gift.accept'))}</button><button class="btn btn--line" data-act="g-gno">${esc(t('gift.decline'))}</button>`
        : giftThanks(g)}</div>
      ${ask ? `<p class="fine">${esc(t('gift.freeNote'))}</p><button class="link" data-act="g-gclose">${esc(t('gift.later'))}</button>` : ''}
    </div>`;
  $('.phone .overlays').append(el);
  sound('gift');
}
function giftThanks(g) {
  if (g.house || !g.from) return `<p>${esc(t('gift.houseNote'))}</p><button class="btn btn--soju" data-act="g-gclose">${esc(t('gift.close'))}</button>`;
  return `<p class="gift-ov__lead">${esc(t('gift.thanksP', { n: noOf(g.from) }))}</p>
    <div class="quick quick--wrap">${db.config.quick.filter(q => ['thanks', 'cheers', 'join', 'cute'].includes(q.id)).map(q => `<button class="qr" data-act="g-gthank" data-q="${q.id}">${esc(q[LANG] || q.pl)}</button>`).join('')}</div>
    <a class="btn btn--line" href="${gHref('czat', g.from)}" data-act="g-gclose">${ic('chat')} ${esc(t('gift.openDm', { n: noOf(g.from) }))}</a>
    <button class="link" data-act="g-gclose">${esc(t('gift.close'))}</button>`;
}

// ---------- entertainment: songs, vote, games ----------
function funView(c) {
  const subs = funModules();
  const sub = subs.some(x => x[0] === G.sub) ? G.sub : subs[0][0];
  const body = { piosenki: songsView, glosowanie: voteView, gry: gamesView }[sub](c);
  return `<nav class="subtabs">${subs.map(([id, k]) => `<a href="${gHref('rozrywka', id)}" class="${sub === id ? 'is-on' : ''}">${esc(t(k))}</a>`).join('')}</nav>${body}`;
}

function songSuggestions() {
  const q = norm(G.song.title);
  if (q.length < 2) return '';
  const hits = SONGS.filter(s => norm(s.title).includes(q) || norm(s.artist).includes(q)).slice(0, 5);
  return hits.map(s => `<button type="button" class="sugg" data-act="g-sugg" data-t="${esc(s.title)}" data-a="${esc(s.artist)}"><span>${s.no}</span><b>${esc(s.title)}</b><small>${esc(s.artist)}</small></button>`).join('');
}

function songRow(r, c) {
  const mine = r.hearts.includes(c.session.id);
  return `<li class="song song--${r.status}"><span class="song__no">${r.no}</span>
    <div class="song__t"><b>${esc(r.title)}</b><small>${esc(r.artist || '—')}</small></div>
    ${cap(noOf(r.session), 'cap--sm')}
    <span class="song__st">${esc(t('song.st.' + r.status))}</span>
    <button class="heart${mine ? ' is-on' : ''}" data-act="g-heart" data-id="${r.id}" aria-pressed="${mine}" aria-label="${esc(t('song.heart'))}">${ic('heart')}<span>${r.hearts.length}</span></button></li>`;
}

function songsView(c) {
  const S = c.session.id, day = today();
  const todays = db.songs.filter(r => opDay(r.at, db.config.dayReset) === day);
  const mine = todays.filter(r => r.session === S).sort((a, b) => b.at - a.at);
  const pending = mine.filter(r => r.status === 'pending').length;
  const top = [...todays].sort((a, b) => b.hearts.length - a.hearts.length).slice(0, 3).filter(r => r.hearts.length);
  return `<section class="nrb">
    <div class="nrb__screen">
      <div class="nrb__top"><span lang="ko">노래 신청</span><b>${esc(t('song.title'))}</b></div>
      <form data-submit="g-song" autocomplete="off">
        <label class="nrb__field"><span>${esc(t('song.fTitle'))} *</span><input id="songT" name="title" maxlength="80" data-in="g-songt" value="${esc(G.song.title)}" placeholder="${esc(t('song.titlePh'))}"></label>
        <div class="nrb__sugg" id="songSugg">${songSuggestions()}</div>
        <label class="nrb__field"><span>${esc(t('song.fArtist'))}</span><input id="songA" name="artist" maxlength="60" data-in="g-songa" value="${esc(G.song.artist)}"></label>
        <label class="nrb__field"><span>${esc(t('song.fMsg'))}</span><input id="songM" name="msg" maxlength="140" data-in="g-songm" value="${esc(G.song.msg)}" placeholder="${esc(t('song.msgPh'))}"></label>
        <button class="btn btn--nrb btn--block" type="submit" ${pending >= db.config.songPending ? 'disabled' : ''}>${ic('mic')} ${esc(t('song.send'))}</button>
        <p class="nrb__limit">${esc(t('song.limit', { n: pending, max: db.config.songPending }))}</p>
      </form>
    </div>
    ${mine.length ? `<h3 class="block__h">${esc(t('song.mine'))}</h3><ol class="songbook">${mine.map(r => songRow(r, c)).join('')}</ol>` : ''}
    ${top.length ? `<h3 class="block__h">${esc(t('song.top'))}</h3><ol class="songbook songbook--top">${top.map(r => songRow(r, c)).join('')}</ol>` : ''}
    <h3 class="block__h">${esc(t('song.recent'))}</h3>
    <ol class="songbook">${[...todays].sort((a, b) => b.at - a.at).slice(0, 12).map(r => songRow(r, c)).join('')}</ol>
  </section>`;
}

function voteView(c) {
  const day = today(), votes = db.votes.filter(v => v.day === day);
  const mine = votes.find(v => v.session === c.session.id);
  const total = votes.length || 1;
  const lead = [...VOTE.options].sort((a, b) => votes.filter(v => v.option === b.id).length - votes.filter(v => v.option === a.id).length)[0];
  return `<section class="vote">
    <h2 class="vote__t"><span lang="ko">${esc(VOTE.title.ko)}</span>${esc(L(VOTE.title))}<small>${esc(t('vote.daily', { x: db.config.dayReset }))}</small></h2>
    <div class="vopts">${VOTE.options.map(o => {
      const n = votes.filter(v => v.option === o.id).length, p = Math.round((n / total) * 100);
      return `<button class="vopt${mine?.option === o.id ? ' is-mine' : ''}" data-act="g-vote" data-o="${o.id}" ${mine ? 'disabled' : ''}>
        ${art(o.art)}<span class="vopt__name">${esc(L(o.name))}<small>${esc(t('vote.n', { n }))}</small></span><b>${p}%</b><i class="vopt__bar" style="--p:${p}%"></i></button>`;
    }).join('')}</div>
    <p class="fine">${esc(mine ? t('vote.done') : t('vote.one'))}</p>
    ${lead && lead.item ? `<button class="btn btn--line btn--block" data-act="g-item" data-i="${lead.item}">${ic('glass')} ${esc(t('vote.order', { x: L(lead.name) }))}</button>` : ''}
    <p class="fine">${ic('tv')} ${esc(t('vote.tv'))}</p>
  </section>`;
}

// ---------- notifications: what changed for this phone since the last look ----------
function guestNotify(prev, next) {
  const c = gctx();
  if (!c.me) {
    const was = c.table && prev.sessions.find(s => isLive(s) && sessionTables(s).includes(c.table.id));
    if (c.table && !was && c.session) toast(esc(t('n.opened', { n: c.table.no })), { icon: 'check', kind: 'ok' });
    return;
  }
  const S = c.session.id, P = prev.sessions.find(s => s.id === S);
  next.orders.filter(o => o.session === S).forEach(o => {
    const p = prev.orders.find(x => x.id === o.id);
    if (!p || p.status === o.status) return;
    const mine = o.by === c.me.id;
    if (o.status === 'served') { toast(esc(t('n.served', { no: o.no })), { icon: 'check', kind: 'ok' }); sound('ok'); }
    else if (o.status === 'rejected') toast(esc(t('n.rejected', { no: o.no, x: o.reason })), { icon: 'x', kind: 'bad', ms: 6000 });
    else if (mine && o.status === 'accepted') toast(esc(t('n.accepted', { no: o.no })), { icon: 'check' });
    else if (mine && o.status === 'sent' && p.status === 'hold') toast(esc(t('n.approved', { no: o.no })), { icon: 'check' });
  });
  next.calls.filter(x => x.session === S && x.status === 'onway').forEach(x => {
    const p = prev.calls.find(y => y.id === x.id);
    if (p && p.status === 'new') toast(esc(t('n.onway', { x: L(db.config.reasons.find(r => r.id === x.reason)?.name) })), { icon: 'bell' });
  });
  const seen = new Set(prev.msgs.map(m => m.id));
  next.msgs.filter(m => !seen.has(m.id) && isDm(m.ch) && m.ch.includes(S) && m.from !== S).forEach(m => {
    sound('blip');
    if (G.tab === 'czat' && G.sub === m.from) return;
    toast(`<b>${esc(t('n.dm', { n: noOf(m.from) }))}</b> ${esc(m.text.slice(0, 60))}`, { icon: 'chat', action: { label: t('n.open'), run: () => gGo('czat', m.from) } });
  });
  next.gifts.filter(g => g.from === S).forEach(g => {
    const p = prev.gifts.find(x => x.id === g.id);
    if (!p || p.status === g.status) return;
    if (g.status === 'accepted') toast(esc(t('n.giftYes', { n: noOf(g.to) })), { icon: 'gift', kind: 'ok' });
    if (g.status === 'declined') toast(esc(t('n.giftNo', { n: noOf(g.to) })), { icon: 'gift' });
    if (g.status === 'delivered') toast(esc(t('n.giftDelivered', { n: noOf(g.to) })), { icon: 'gift' });
  });
  if (P && P.table !== c.session.table) toast(esc(t('n.moved', { n: tableLabel(c.session) })), { icon: 'swap', ms: 6000 });
  if (P && !P.muted && c.session.muted) toast(esc(t('chat.muted')), { icon: 'chatOff', kind: 'bad' });
  if (P && P.status === 'verify' && c.session.status === 'open') toast(esc(t('n.verified')), { icon: 'check', kind: 'ok' });
  if (prev.config.chatOn !== next.config.chatOn) toast(esc(t(next.config.chatOn ? 'n.chatOn' : 'chat.offGlobal')), { icon: next.config.chatOn ? 'chat' : 'chatOff' });
}

// ---------- actions ----------
Object.assign(ACTS, {
  'g-plang': el => { G.lang = el.dataset.l; gsave('lang', G.lang); render(); },
  'g-lang': el => { const c = gctx(); G.lang = el.dataset.l; gsave('lang', G.lang); send('me', { p: c.me.id, lang: el.dataset.l }); },
  'g-terms': () => gopen(`<div class="sheet__head"><h3>${esc(t('terms.t'))}</h3><button class="ibtn" data-close aria-label="${esc(t('ui.close'))}">${ic('x')}</button></div><div class="terms">${t('terms.body').split('\n').map(p => `<p>${esc(p)}</p>`).join('')}</div>`),
  'g-askopen': () => {
    const c = gctx();
    if (offline) { toast(esc(t('e.offline')), { icon: 'cloudOff' }); return; }
    const r = run('call', { table: c.table.id, reason: 'open' });
    if (r.ok) { sound('dingdong'); toast(esc(t('gate.calledToast')), { icon: 'bell', kind: 'ok' }); }
  },
  'g-rescan': () => { const c = gctx(); G.ackClosed.push(c.closed.id); gsave('ackclosed', G.ackClosed); render(); },
  'g-cat': el => { G.cat = el.dataset.c; render(); $('.gview').scrollTop = 0; },
  'g-item': el => openItem(el.dataset.i),
  'g-a2hs-x': () => { G.a2hs = true; gsave('a2hs', true); render(); },
  'g-cart': () => openCart(),
  'g-cq': el => {
    const l = G.cart.find(x => x.id === el.dataset.l);
    if (!l) return;
    l.qty += +el.dataset.d;
    if (l.qty < 1) G.cart = G.cart.filter(x => x !== l);
    saveCart();
    G.sheet?.();
    render();
  },
  'g-send': () => sendCart(),
  'g-bell': () => openCallSheet(),
  'g-call': el => callStaff(el.dataset.r),
  'g-unblock': el => { const c = gctx(); send('block', { s: c.session.id, target: el.dataset.s, on: false }); },
  'g-private-off': () => { const c = gctx(); send('privacy', { s: c.session.id, on: false }); },
  'g-online': () => openOnline(),
  'g-who': el => openMsgMenuFor(el.dataset.s),
  'g-msgmenu': el => openMsgMenu(el.dataset.m),
  'g-report': el => openReport(el.dataset.m),
  'g-report-go': el => { const c = gctx(); send('report', { s: c.session.id, msg: el.dataset.m, reason: el.dataset.r }); closeLayer(); toast(esc(t('chat.reported')), { icon: 'flag', kind: 'ok' }); },
  'g-block': el => openBlock(el.dataset.s),
  'g-block-go': el => { const c = gctx(); send('block', { s: c.session.id, target: el.dataset.s, on: true }); closeLayer(); toast(esc(t('chat.blocked', { n: noOf(el.dataset.s) })), { icon: 'block' }); if (G.sub === el.dataset.s) gGo('czat'); },
  'g-emoji': () => { G.emoji = !G.emoji; render(); $('#chatIn')?.focus(); },
  'g-emo': el => { G.draft = (G.draft + el.dataset.e).slice(0, db.config.chatMax); render(); $('#chatIn')?.focus(); },
  'g-quick': el => { const q = db.config.quick.find(x => x.id === el.dataset.q); if (q && sendMsg(q[LANG] || q.pl)) render(); },
  'g-gift': el => openGift(el.dataset.s),
  'g-gzone': el => { GF.zone = el.dataset.z; G.sheet(); },
  'g-gto': el => { GF.to = el.dataset.s; G.sheet(); },
  'g-gback': () => { GF.to = null; GF.item = null; G.sheet(); },
  'g-gitem': el => { GF.item = el.dataset.i; GF.sel = defaultSel(itemById(GF.item)); G.sheet(); },
  'g-gquick': el => { const q = db.config.quick.find(x => x.id === el.dataset.q); GF.msg = q[LANG] || q.pl; G.sheet(); },
  'g-gsend': () => sendGift(),
  'g-gshow': el => showGift(db.gifts.find(g => g.id === el.dataset.g), 'ask'),
  'g-gyes': () => {
    const ov = $('.gift-ov'), g = db.gifts.find(x => x.id === ov.dataset.g), c = gctx();
    const r = send('giftAnswer', { s: c.session.id, id: g.id, accept: true });
    if (!r.ok) { ov.remove(); return; }
    ov.dataset.state = 'got';
    $('.gift-ov__acts', ov).innerHTML = giftThanks(g);
    $$('.gift-ov__card > .fine, .gift-ov__card > .link', ov).forEach(x => x.remove());
    sound('ok');
  },
  'g-gno': () => { const ov = $('.gift-ov'), c = gctx(); send('giftAnswer', { s: c.session.id, id: ov.dataset.g, accept: false }); ov.remove(); toast(esc(t('gift.declined')), { icon: 'gift' }); },
  'g-gclose': () => $('.gift-ov')?.remove(),
  'g-gthank': el => {
    const ov = $('.gift-ov'), g = db.gifts.find(x => x.id === ov.dataset.g), c = gctx(), q = db.config.quick.find(x => x.id === el.dataset.q);
    const r = send('msg', { s: c.session.id, p: c.me.id, ch: dmCh(c.session.id, g.from), text: q[LANG] || q.pl });
    toast(esc(r.ok ? t('gift.thanked', { n: noOf(g.from) }) : errText(r)), { icon: r.ok ? 'check' : 'alert' });
    ov.remove();
  },
  'g-sugg': el => { G.song.title = el.dataset.t; G.song.artist = el.dataset.a; render(); },
  'g-heart': el => { const c = gctx(); send('heart', { s: c.session.id, id: el.dataset.id }); },
  'g-vote': el => {
    const c = gctx(), r = send('vote', { s: c.session.id, option: el.dataset.o });
    if (!r.ok) toast(esc(errText(r)), { icon: 'alert' });
    else sound('ok');
  },
});
function openMsgMenuFor(sid) {
  const last = [...db.msgs].reverse().find(m => m.from === sid && !m.deleted);
  if (last) openMsgMenu(last.id);
}

Object.assign(INPUTS, {
  'g-draft': el => { G.draft = el.value; const n = $('#chatCount'); if (n) n.textContent = `${el.value.length}/${db.config.chatMax}`; },
  'g-cnote': el => { const l = G.cart.find(x => x.id === el.dataset.l); if (l) { l.note = el.value.slice(0, 120); gsave('cart', G.cart); G.cartKey = null; sess.drop(GK + 'cartkey'); } },
  'g-gmsg': el => { GF.msg = el.value; },
  'g-songt': el => { G.song.title = el.value; const s = $('#songSugg'); if (s) s.innerHTML = songSuggestions(); },
  'g-songa': el => { G.song.artist = el.value; },
  'g-songm': el => { G.song.msg = el.value; },
});

Object.assign(CHANGES, {
  'g-nick': el => { const c = gctx(); G.nick = el.value.trim(); gsave('nick', G.nick); send('me', { p: c.me.id, nick: G.nick }); toast(esc(t('set.saved')), { icon: 'check' }); },
  'g-private': el => { const c = gctx(); send('privacy', { s: c.session.id, on: el.checked }); toast(esc(t(el.checked ? 'set.privateOn' : 'set.privateOff')), { icon: 'eyeOff' }); },
  'g-gopt': el => { GF.sel[el.dataset.g] = [el.value]; G.sheet(); },
});

Object.assign(SUBMITS, {
  'g-join': form => {
    const c = gctx(), f = new FormData(form), errEl = $('#onErr');
    if (!G.adult && (!f.get('adult') || !f.get('terms'))) { errEl.textContent = t('on.needAdult'); return; }
    if (offline) { errEl.textContent = t('e.offline'); return; }
    const nick = String(f.get('nick') || '').trim();
    const r = run('join', { table: c.table.id, device: DEVICE, lang: LANG, nick, pin: f.get('pin') });
    if (!r.ok) { errEl.textContent = errText(r); return; }
    G.adult = true; gsave('adult', true);
    G.nick = nick; gsave('nick', nick);
    G.read = {}; gsave('read', G.read);
    sound('ok');
  },
  'g-call-other': form => { const v = new FormData(form).get('t'); closeLayer(); callStaff('other', String(v || '').trim() || '—'); },
  'g-msg': () => {
    if (!sendMsg(G.draft)) return;
    G.draft = '';
    G.emoji = false;
    const i = $('#chatIn');
    if (i) i.value = ''; // the redraw keeps a focused field's value, so empty it first
    render();
    $('#chatIn')?.focus();
  },
  'g-song': form => {
    const c = gctx();
    if (!G.song.title.trim()) { toast(esc(t('e.songTitle')), { icon: 'alert' }); $('#songT')?.focus(); return; }
    const r = send('song', { s: c.session.id, ...G.song });
    if (!r.ok) { toast(esc(errText(r)), { icon: 'alert', kind: 'bad' }); return; }
    G.song = { title: '', artist: '', msg: '' };
    $$('input', form).forEach(i => { i.value = ''; });
    sound('ok');
    toast(esc(t(r.queued ? 'song.queued' : 'song.sent')), { icon: 'mic', kind: 'ok' });
    render();
  },
});
