// TableTalk v1 — the staff panel behind the counter: PIN login on a shared tablet, the floor with
// table states and a drawer per table (open, verify, move, merge, mute, bill, close), order slips on
// a steel rail, the kitchen screen, the call-bell receiver with red LED digits, the song queue, gifts
// to carry over, chat moderation, sold-out switches and the audit log. Sound, wake lock, heartbeat.

const STAFF_KEY = 'tabletalk-staff';
const ST = { who: sess.get(STAFF_KEY, null), view: 'sala', zone: 'sala', table: null, pick: 'ola', pin: '' };
const VIEWS = {
  sala: ['Sala', 'table'], zamowienia: ['Zamówienia', 'receipt'], kuchnia: ['Kuchnia', 'pot'], wezwania: ['Wezwania', 'bell'],
  piosenki: ['Piosenki', 'mic'], prezenty: ['Prezenty', 'gift'], czat: ['Czat', 'chat'], menu: ['Wyprzedane', 'block'], dziennik: ['Dziennik', 'list'],
};
const REJECT_REASONS = ['Brak produktu', 'Kuchnia już nie wydaje', 'Podejrzane zamówienie, goście zapytani przy stoliku', 'Pomyłka gości, zamówią jeszcze raz'];
const me = () => STAFF.find(s => s.id === ST.who);
const sdo = (action, args) => staffDo(action, args, ST.who);
const nameOf = it => it?.name?.pl || '';
const modsPl = l => { const it = itemById(l.item); return (it?.mods || []).flatMap(g => (l.sel?.[g] || []).map(o => MODS[g].opts.find(x => x.id === o)?.name.pl)).filter(Boolean).join(', '); };
const callName = r => (r === 'open' ? OPEN_REASON : db.config.reasons.find(x => x.id === r) || OPEN_REASON).name.pl;
const callIcon = r => (r === 'open' ? OPEN_REASON : db.config.reasons.find(x => x.id === r) || OPEN_REASON).icon;
const activeCalls = () => db.calls.filter(c => c.status !== 'done').sort((a, b) => a.at - b.at);

// ---------- heartbeat (the auto crew stands down while someone is logged in) and wake lock ----------
let wakeLock = null;
setInterval(() => { if (mode === 'staff' && ST.who) store.set(STAFF_HB_KEY, Date.now()); }, 2000);
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (mode === 'staff' && ST.who) keepAwake(); });

function staffView(parts) {
  LANG = 'pl';
  document.documentElement.lang = 'pl';
  const root = $('#app');
  if (!ST.who) { paint(root, pinPad()); return; }
  const allowed = STAFF_ROLES[me().role].views;
  ST.view = allowed.includes(parts[1]) ? parts[1] : allowed[0];
  const body = { sala: salaView, zamowienia: railView, kuchnia: kdsView, wezwania: callsView, piosenki: songsQueue, prezenty: giftsDesk, czat: modView, menu: soldView, dziennik: auditView }[ST.view]();
  paint(root, `<div class="staff">
      ${counterBar()}
      <nav class="snav" aria-label="Panel obsługi">${allowed.map(v => {
        const n = navCount(v);
        return `<a href="#/obsluga/${v}" class="${ST.view === v ? 'is-on' : ''}" ${ST.view === v ? 'aria-current="page"' : ''}>${ic(VIEWS[v][1])}<span>${VIEWS[v][0]}</span>${n ? `<em>${n}</em>` : ''}</a>`;
      }).join('')}</nav>
      <main class="sview sview--${ST.view}" data-scroll="s-${ST.view}">${body}</main>
    </div>`);
}

function navCount(v) {
  if (v === 'sala') return liveSessions().filter(s => s.status === 'verify').length + db.calls.filter(c => c.reason === 'open' && c.status !== 'done').length;
  if (v === 'zamowienia') return db.orders.filter(o => o.status === 'sent' || o.status === 'hold').length;
  if (v === 'kuchnia') return db.orders.filter(o => ['sent', 'accepted', 'prep'].includes(o.status) && o.items.some(l => l.kitchen)).length;
  if (v === 'wezwania') return activeCalls().length;
  if (v === 'piosenki') return db.songs.filter(r => r.status === 'pending').length;
  if (v === 'prezenty') return db.gifts.filter(g => g.status === 'accepted').length;
  if (v === 'czat') return db.reports.filter(r => r.status === 'open').length;
  return 0;
}

// ---------- login ----------
function pinPad() {
  const who = STAFF.find(s => s.id === ST.pick);
  return `<div class="pinpad">
    ${neonSign('sign--lg')}
    <h1>Panel obsługi</h1>
    <p>Wspólny tablet zmiany. Wybierz siebie i wpisz PIN.</p>
    <div class="who" role="radiogroup" aria-label="Pracownik">${STAFF.map(s => `<button class="who__b${ST.pick === s.id ? ' is-on' : ''}" role="radio" aria-checked="${ST.pick === s.id}" data-act="s-pick" data-id="${s.id}"><span class="who__av">${esc(s.name[0])}</span><b>${esc(s.name)}</b><small>${esc(STAFF_ROLES[s.role].label)}</small></button>`).join('')}</div>
    <div class="pin__dots" aria-label="Wpisano ${ST.pin.length} z 4 cyfr">${[0, 1, 2, 3].map(i => `<i class="${i < ST.pin.length ? 'on' : ''}"></i>`).join('')}</div>
    <p class="form-err" id="pinErr" role="alert"></p>
    <div class="keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'].map(k => `<button data-act="s-key" data-k="${k}" aria-label="${k === '←' ? 'Usuń' : k === 'C' ? 'Wyczyść' : k}">${k}</button>`).join('')}</div>
    <p class="fine">Makieta, PIN-y testowe: ${STAFF.map(s => `${esc(s.name)} ${s.pin}`).join(' · ')}. ${esc(who.name)}: ${esc(STAFF_ROLES[who.role].label.toLowerCase())}.</p>
  </div>`;
}
function pinKey(k) {
  if (k === 'C') ST.pin = '';
  else if (k === '←') ST.pin = ST.pin.slice(0, -1);
  else if (ST.pin.length < 4) ST.pin += k;
  if (ST.pin.length === 4) {
    const s = STAFF.find(x => x.id === ST.pick);
    if (s.pin === ST.pin) {
      ST.who = s.id;
      ST.pin = '';
      sess.set(STAFF_KEY, s.id);
      store.set(STAFF_HB_KEY, Date.now());
      keepAwake();
      sound('ok');
      location.hash = `#/obsluga/${STAFF_ROLES[s.role].views[0]}`;
      render();
      return;
    }
    ST.pin = '';
    render();
    $('#pinErr').textContent = 'Zły PIN. Spróbuj jeszcze raz.';
    return;
  }
  render();
}
document.addEventListener('keydown', e => {
  if (mode !== 'staff' || ST.who || layer) return;
  if (/^[0-9]$/.test(e.key)) pinKey(e.key);
  else if (e.key === 'Backspace') pinKey('←');
});

// ---------- the counter bar: brand, LED receiver, tools ----------
function counterBar() {
  const calls = activeCalls();
  const digits = calls.slice(0, 5).map(c => String(tableById(c.table)?.no ?? '').padStart(2, ' '));
  return `<header class="counter">
    <a class="counter__brand" href="#/obsluga">${neonSign('sign--bar')}<span>Panel obsługi</span></a>
    <a class="ledrx" href="#/obsluga/wezwania" aria-label="Wezwania: ${calls.length}">
      <span class="ledrx__label" lang="ko">호출</span>
      ${digits.length ? digits.map((d, i) => `<span class="ledrx__cell${calls[i].status === 'new' ? ' is-new' : ''}">${seg7(d)}</span>`).join('') : `<span class="ledrx__cell">${seg7('--')}</span>`}
      ${calls.length > 5 ? `<b>+${calls.length - 5}</b>` : ''}
    </a>
    <div class="counter__tools">
      <label class="tgl" title="Czat dla wszystkich stolików"><input type="checkbox" data-ch="s-chat" ${db.config.chatOn ? 'checked' : ''}><span>${ic(db.config.chatOn ? 'chat' : 'chatOff')} Czat</span></label>
      <button class="ibtn" data-act="s-sound" aria-pressed="${soundOn}" aria-label="Dźwięk">${ic(soundOn ? 'volume' : 'volumeOff')}</button>
      <span class="counter__wake" title="${wakeLock ? 'Ekran nie zgaśnie (Wake Lock)' : 'Wake Lock niedostępny w tej przeglądarce'}">${ic(wakeLock ? 'sparkle' : 'moon')}</span>
      <time class="counter__clock" id="sClock">${fmtTime(Date.now())}</time>
      <button class="who-chip" data-act="s-logout" title="Wyloguj">${esc(me().name)} · ${esc(STAFF_ROLES[me().role].label)} ${ic('logout')}</button>
    </div>
  </header>`;
}
setInterval(() => { const c = $('#sClock'); if (c) c.textContent = fmtTime(Date.now()); }, 5000);

// ---------- floor ----------
function tableState(T) {
  const S = sessionOfTable(T.id);
  if (!S) return { S, st: db.calls.some(c => c.table === T.id && c.reason === 'open' && c.status !== 'done') ? 'ask' : 'free' };
  const calls = db.calls.filter(c => c.session === S.id && c.status !== 'done');
  const orders = db.orders.filter(o => o.session === S.id && (o.status === 'sent' || o.status === 'hold'));
  const gifts = db.gifts.filter(g => g.to === S.id && g.status === 'accepted');
  const st = calls.length ? 'call' : S.status === 'verify' ? 'verify' : orders.length ? 'order' : 'open';
  return { S, st, calls, orders, gifts };
}

function salaView() {
  const counts = Object.fromEntries(ZONES.map(z => [z.id, db.tables.filter(T => T.zone === z.id && sessionOfTable(T.id)).length]));
  const live = liveSessions();
  return `<div class="sala">
    <div class="sala__top">
      <div class="seg">${ZONES.map(z => `<button data-act="s-zone" data-z="${z.id}" aria-pressed="${ST.zone === z.id}">${esc(z.name.pl)} <small>${counts[z.id]}/${db.tables.filter(T => T.zone === z.id).length}</small></button>`).join('')}</div>
      <p class="legend legend--staff"><span><i class="lg lg--free"></i>wolny</span><span><i class="lg lg--ask"></i>prośba o otwarcie</span><span><i class="lg lg--open"></i>otwarty</span><span><i class="lg lg--order"></i>nowe zamówienie</span><span><i class="lg lg--call"></i>wezwanie</span><span><i class="lg lg--verify"></i>do weryfikacji</span></p>
    </div>
    <div class="sala__grid">
      ${floorHtml(ST.zone, T => {
        const x = tableState(T), sel = ST.table === T.id;
        const join = x.S && x.S.table !== T.id ? ` <small>z ${tableById(x.S.table).no}</small>` : '';
        return `<button class="tbl tbl--staff tbl--s${T.seats} is-${x.st}${sel ? ' is-sel' : ''}" style="left:${T.x}%;top:${T.y}%" data-act="s-table" data-t="${T.id}" aria-label="Stolik ${T.no}: ${x.st}">
          ${tableArt(T.seats)}<b>${T.no}${join}</b>
          <span class="tbl__flags">${x.orders?.length ? `<i class="f f--order">${x.orders.length}</i>` : ''}${x.calls?.length ? `<i class="f f--call">${ic('bell')}</i>` : ''}${x.st === 'ask' ? `<i class="f f--ask">${ic('door')}</i>` : ''}${x.S?.status === 'verify' ? '<i class="f f--verify">?</i>' : ''}${x.gifts?.length ? `<i class="f f--gift">${ic('gift')}</i>` : ''}${x.S?.muted ? `<i class="f f--mute">${ic('chatOff')}</i>` : ''}</span>
          ${x.S ? `<span class="tbl__since">${since(x.S.openedAt)}</span>` : ''}
        </button>`;
      })}
      <aside class="drawer" aria-live="polite">${ST.table ? tableDrawer(ST.table) : `<div class="drawer__empty">${ic('table')}<p>Dotknij stolika, żeby go otworzyć, zobaczyć rachunek, przenieść albo zamknąć.</p>
        <ul class="drawer__stats"><li><b>${live.length}</b> otwarte stoliki</li><li><b>${sum(live, s => partsOf(s.id).length)}</b> telefony gości</li><li><b>${money(sum(live, s => billOf(s.id).total))}</b> na otwartych rachunkach</li></ul></div>`}</aside>
    </div>
  </div>`;
}

function tableDrawer(tid) {
  const T = tableById(tid), x = tableState(T), S = x.S;
  const head = (sub = '') => `<div class="drawer__head">${cap(S ? tableLabel(S) : T.no, S ? 'cap--lg' : 'cap--lg cap--off')}<div><h2>Stolik ${S ? tableLabel(S) : T.no}</h2><p>${esc(ZONES.find(z => z.id === T.zone).name.pl)} · ${T.seats} miejsca${sub}</p></div><button class="ibtn" data-act="s-untable" aria-label="Zamknij panel">${ic('x')}</button></div>`;
  if (!S) {
    const ask = db.calls.find(c => c.table === tid && c.reason === 'open' && c.status !== 'done');
    return `${head(' · wolny')}
      ${ask ? `<div class="drawer__alert">${ic('door')}<span>Goście przy stoliku proszą o otwarcie</span>${since(ask.at, { fmt: 'clock', warn: 2, bad: 5 })}</div>` : ''}
      <p class="drawer__p">Otwarcie stolika odblokowuje telefonom zamawianie. Kod QR sfotografowany w domu nic nie zamówi, dopóki stolik jest zamknięty.</p>
      ${db.config.pinRequired ? '<p class="drawer__p">Lokal wymaga PIN-u stolika: wygenerujemy go przy otwarciu, podaj go gościom.</p>' : ''}
      <button class="btn btn--tarp btn--block" data-act="s-open" data-t="${tid}">${ic('door')} Otwórz stolik ${T.no}</button>`;
  }
  const b = billOf(S.id), ps = partsOf(S.id), opener = staffById(S.openedBy);
  const orders = db.orders.filter(o => o.session === S.id);
  return `${head(` · otwarty ${fmtTime(S.openedAt)}${opener ? ', ' + esc(opener.name) : ', skanem'}`)}
    ${S.status === 'verify' ? `<div class="drawer__alert drawer__alert--verify">${ic('alert')}<span>Otwarty skanem kodu, bez kelnera. Sprawdź, czy goście są na miejscu.</span><button class="btn btn--sm btn--soju" data-act="s-approve" data-s="${S.id}">Zatwierdź</button></div>` : ''}
    ${x.calls.map(c => `<div class="drawer__alert">${ic(callIcon(c.reason))}<span>${esc(callName(c.reason))}${c.text ? `: „${esc(c.text)}”` : ''}</span>${since(c.at, { fmt: 'clock', warn: 2, bad: 5 })}<button class="btn btn--sm" data-act="s-callst" data-id="${c.id}" data-st="${c.status === 'new' ? 'onway' : 'done'}">${c.status === 'new' ? 'Idę' : 'Załatwione'}</button></div>`).join('')}
    ${db.config.pinRequired && S.pin ? `<div class="drawer__pin"><span>PIN stolika dla gości</span><b>${S.pin}</b></div>` : ''}
    <div class="drawer__sec"><h3>${ic('phone')} Telefony przy stoliku <small>${ps.length}/${db.config.maxParticipants}</small></h3>
      <ul class="phones">${ps.map(p => `<li><span>${esc(p.nick || 'bez pseudonimu')}</span><small>${(p.lang || '').toUpperCase()} · od ${fmtTime(p.joinedAt)}${p.device === 'bot' ? ' · symulacja' : ''}</small></li>`).join('') || '<li><small>Nikt jeszcze nie zeskanował kodu</small></li>'}</ul></div>
    <div class="drawer__sec"><h3>${ic('receipt')} Rachunek <small>${orders.length} zamówień</small></h3>
      <div class="mini-bill">${b.lines.map(l => `<div><span>${l.qty}× ${esc(nameOf(itemById(l.item)))}</span><b>${money(l.unit * l.qty)}</b></div>`).join('')}
        ${b.sent.map(g => `<div class="gift"><span>🎁 ${esc(nameOf(itemById(g.item)))} → st. ${noOf(g.to)}</span><b>${money(g.price)}</b></div>`).join('')}
        ${b.got.map(g => `<div class="gift"><span>🎁 ${esc(nameOf(itemById(g.item)))} ← ${g.house ? 'lokal' : 'st. ' + noOf(g.from)}</span><b>0</b></div>`).join('')}
        <div class="mini-bill__sum"><span>Razem</span><b>${money(b.total)}</b></div></div></div>
    <div class="drawer__acts">
      <button class="btn btn--line" data-act="s-bill" data-s="${S.id}">${ic('print')} Rachunek</button>
      <button class="btn btn--line" data-act="s-move" data-s="${S.id}">${ic('swap')} Przenieś</button>
      <button class="btn btn--line" data-act="s-merge" data-s="${S.id}">${ic('merge')} Połącz</button>
      <button class="btn btn--line${S.muted ? ' is-on' : ''}" data-act="s-mute" data-s="${S.id}" data-on="${S.muted ? 0 : 1}">${ic('chatOff')} ${S.muted ? 'Odcisz czat' : 'Wycisz czat'}</button>
    </div>
    <button class="btn btn--bad btn--block" data-act="s-close" data-s="${S.id}">${ic('receipt')} Zamknij i rozlicz · ${money(b.total)}</button>`;
}

function receiptHtml(S) {
  const b = billOf(S.id);
  return `<div class="receipt receipt--print print-area">
    <div class="receipt__head">${esc(VENUE.name.toUpperCase())} · ${VENUE.ko}<br>${esc(VENUE.address)}<br>STOLIK ${tableLabel(S)} · ${new Date().toLocaleString('pl-PL')}</div>
    ${b.lines.map(l => `<div class="r-line"><span>${l.qty} × ${esc(nameOf(itemById(l.item)))}${modsPl(l) ? `<small>${esc(modsPl(l))}</small>` : ''}</span><b>${money(l.unit * l.qty)}</b></div>`).join('')}
    ${b.sent.map(g => `<div class="r-line r-gift"><span>Prezent: ${esc(nameOf(itemById(g.item)))} → stolik ${noOf(g.to)}</span><b>${money(g.price)}</b></div>`).join('')}
    ${b.got.map(g => `<div class="r-line r-got"><span>Prezent od ${g.house ? 'lokalu' : 'stolika ' + noOf(g.from)}: ${esc(nameOf(itemById(g.item)))}</span><b>0,00</b></div>`).join('')}
    <div class="r-total"><span>SUMA</span><b>${money(b.total)}</b></div>
    <p class="r-note">Wydruk pomocniczy, nie jest paragonem fiskalnym. Integracja z POS i drukarką fiskalną: faza 2.</p>
  </div>`;
}

// ---------- order slips on the rail ----------
function slip(o, kitchenOnly = false) {
  const S = sessionById(o.session), by = partById(o.by);
  const items = kitchenOnly ? o.items.filter(l => l.kitchen) : o.items;
  const t0 = o.times[o.status] || o.at;
  const btn = (st, label, cls = '') => `<button class="btn btn--sm ${cls}" data-act="s-ost" data-id="${o.id}" data-st="${st}">${label}</button>`;
  const acts = {
    hold: `<button class="btn btn--sm btn--soju" data-act="s-oapprove" data-id="${o.id}">Zatwierdź</button><button class="btn btn--sm btn--ghost" data-act="s-oreject" data-id="${o.id}">Odrzuć</button>`,
    sent: `${btn('accepted', 'Przyjmij', 'btn--tarp')}<button class="btn btn--sm btn--ghost" data-act="s-oreject" data-id="${o.id}">Odrzuć</button>`,
    accepted: btn('prep', kitchenOnly ? 'Zaczynam' : 'Do kuchni', 'btn--tarp'),
    prep: btn('served', kitchenOnly ? 'Gotowe, wydane' : 'Wydane', 'btn--soju'),
  }[o.status] || '';
  return `<article class="slip slip--${o.status}${Date.now() - o.at < 4000 ? ' is-fresh' : ''}">
    <span class="slip__clip" aria-hidden="true"></span>
    <header>${cap(tableLabel(S), 'cap--sm')}<b>STOLIK ${tableLabel(S)}</b><span>#${o.no}</span></header>
    <div class="slip__meta">${fmtTime(o.at)} · ${o.status === 'served' ? 'wydane ' + fmtTime(o.times.served) : since(o.at, { warn: 10, bad: 20 })} · ${esc(by?.nick || (by?.device === 'bot' ? 'telefon gościa' : 'telefon'))}</div>
    ${o.status === 'hold' ? `<p class="slip__hold">${ic('alert')} ${o.hold === 'verify' ? 'Pierwsze zamówienie stolika otwartego skanem. Sprawdź gości.' : `Kwota powyżej limitu ${money(db.config.orderLimit)}.`}</p>` : ''}
    <ul>${items.map(l => `<li class="${l.kitchen ? 'is-k' : 'is-b'}"><b>${l.qty}×</b><span>${esc(nameOf(itemById(l.item)))}${modsPl(l) ? `<small>${esc(modsPl(l))}</small>` : ''}${l.note ? `<em>! ${esc(l.note)}</em>` : ''}</span>${ic(l.kitchen ? 'pot' : 'glass')}</li>`).join('')}</ul>
    ${kitchenOnly && o.items.some(l => !l.kitchen) ? `<p class="slip__note">+ napoje z baru: ${sum(o.items.filter(l => !l.kitchen), l => l.qty)}</p>` : ''}
    <footer><span>${kitchenOnly ? '' : money(o.total)}</span><div>${acts}</div></footer>
  </article>`;
}

function railView() {
  const cols = [
    ['Nowe', o => o.status === 'sent' || o.status === 'hold'],
    ['Przyjęte', o => o.status === 'accepted'],
    ['W przygotowaniu', o => o.status === 'prep'],
    ['Wydane (30 min)', o => o.status === 'served' && Date.now() - (o.times.served || 0) < 30 * MIN],
  ];
  const rejected = db.orders.filter(o => o.status === 'rejected').slice(-3).reverse();
  return `<div class="rail-wrap">${cols.map(([h, f], i) => {
    const list = db.orders.filter(f).sort((a, b) => (i === 3 ? b.times.served - a.times.served : a.at - b.at));
    return `<section class="rail-col"><h2>${h} <b>${list.length}</b></h2><div class="rail" aria-hidden="true"></div><div class="rail-col__slips">${list.map(o => slip(o)).join('') || '<p class="rail-empty">pusto</p>'}</div></section>`;
  }).join('')}</div>
  ${rejected.length ? `<p class="fine fine--staff">Ostatnio odrzucone: ${rejected.map(o => `#${o.no} (stolik ${noOf(o.session)}): ${esc(o.reason)}`).join(' · ')}</p>` : ''}`;
}

function kdsView() {
  const list = db.orders.filter(o => ['sent', 'accepted', 'prep'].includes(o.status) && o.items.some(l => l.kitchen)).sort((a, b) => a.at - b.at);
  const avg = list.length ? Math.round(sum(list, o => Date.now() - o.at) / list.length / MIN) : 0;
  return `<div class="kds">
    <div class="kds__top"><h2>Ekran kuchni</h2><p>${list.length} zamówień w kuchni · średnio czekają ${avg} min · tylko pozycje kuchenne, napoje wydaje bar</p></div>
    <div class="kds__grid">${list.map(o => slip(o, true)).join('') || `<div class="empty">${ic('pot')}<p>Kuchnia czysta. Nowe zamówienia pojawią się tu same, z dźwiękiem.</p></div>`}</div>
  </div>`;
}

// ---------- the call-bell receiver ----------
function callsView() {
  const calls = activeCalls();
  return `<div class="calls-desk">
    <div class="ledwall" role="img" aria-label="Aktywne wezwania: ${calls.map(c => tableById(c.table)?.no).join(', ') || 'brak'}">
      <span class="ledwall__brand" lang="ko">띵동 · 호출벨</span>
      <div class="ledwall__cells">${Array.from({ length: 8 }, (_, i) => { const c = calls[i]; return `<div class="ledwall__cell${c ? (c.status === 'new' ? ' is-new' : ' is-on') : ''}">${seg7(c ? String(tableById(c.table)?.no).padStart(2, ' ') : '  ')}<small>${c ? esc(callName(c.reason)) : ''}</small></div>`; }).join('')}</div>
    </div>
    <ul class="call-list">${calls.map(c => `<li class="is-${c.status}">${cap(tableById(c.table)?.no)}<div><b>${esc(callName(c.reason))}</b>${c.text ? `<small>„${esc(c.text)}”</small>` : ''}<small>${c.status === 'onway' ? 'ktoś już idzie' : 'czeka'} · od ${fmtTime(c.at)}</small></div>${since(c.at, { fmt: 'clock', warn: 2, bad: 5 })}
      <div class="call-list__acts">${c.reason === 'open' ? `<button class="btn btn--sm btn--tarp" data-act="s-open" data-t="${c.table}">Otwórz stolik</button>` : c.status === 'new' ? `<button class="btn btn--sm btn--tarp" data-act="s-callst" data-id="${c.id}" data-st="onway">Idę</button>` : ''}<button class="btn btn--sm btn--soju" data-act="s-callst" data-id="${c.id}" data-st="done">Załatwione</button></div></li>`).join('')
      || `<li class="empty-line">Nikt nie woła. Wezwania z telefonów pojawią się na wyświetlaczu z sygnałem „ding-dong”.</li>`}</ul>
  </div>`;
}

// ---------- songs ----------
function songsQueue() {
  const day = today(), todays = db.songs.filter(r => opDay(r.at, db.config.dayReset) === day);
  const row = (r, acts) => `<li class="song song--${r.status}"><span class="song__no">${r.no}</span><div class="song__t"><b>${esc(r.title)}</b><small>${esc(r.artist || '—')}${r.msg ? ` · „${esc(r.msg)}”` : ''}</small></div>${cap(noOf(r.session), 'cap--sm')}<span class="song__h">${ic('heart')} ${r.hearts.length}</span><div class="song__acts">${acts}</div></li>`;
  const pend = todays.filter(r => r.status === 'pending').sort((a, b) => a.at - b.at);
  const queue = todays.filter(r => r.status === 'accepted').sort((a, b) => a.at - b.at);
  const played = todays.filter(r => r.status === 'played').sort((a, b) => (b.times.played || b.at) - (a.times.played || a.at));
  return `<div class="nrb nrb--desk">
    <div class="nrb__screen nrb__screen--desk"><div class="nrb__top"><span lang="ko">노래방 · 신청곡</span><b>Kolejka DJ-a</b></div>
      <p>Dziś ${todays.length}/${db.config.songDaily} próśb · limit ${db.config.songPending} oczekujące na stolik</p>
      ${queue[0] ? `<div class="nrb__now"><small>NASTĘPNA</small><b>${esc(queue[0].title)}</b><span>${esc(queue[0].artist)} · stolik ${noOf(queue[0].session)}</span></div>` : ''}</div>
    <div class="desk-cols">
      <section><h2>Oczekujące <b>${pend.length}</b></h2><ol class="songbook">${pend.map(r => row(r, `<button class="btn btn--sm btn--soju" data-act="s-song" data-id="${r.id}" data-st="accepted">Do kolejki</button><button class="btn btn--sm btn--ghost" data-act="s-song" data-id="${r.id}" data-st="rejected">Odrzuć</button>`)).join('') || '<li class="empty-line">brak</li>'}</ol></section>
      <section><h2>W kolejce <b>${queue.length}</b></h2><ol class="songbook">${queue.map(r => row(r, `<button class="btn btn--sm btn--tarp" data-act="s-song" data-id="${r.id}" data-st="played">Zagrana</button>`)).join('') || '<li class="empty-line">pusto</li>'}</ol></section>
      <section><h2>Zagrane <b>${played.length}</b></h2><ol class="songbook">${played.slice(0, 12).map(r => row(r, '')).join('') || '<li class="empty-line">nic jeszcze</li>'}</ol></section>
    </div>
  </div>`;
}

// ---------- gifts ----------
function giftsDesk() {
  const g = st => db.gifts.filter(x => x.status === st).sort((a, b) => a.at - b.at);
  const row = (x, acts = '') => `<li>${x.house ? cap('★', 'cap--sm cap--house') : cap(noOf(x.from), 'cap--sm')}${ic('right')}${cap(noOf(x.to), 'cap--sm')}<div><b>${esc(nameOf(itemById(x.item)))}${modsPl(x) ? ` · ${esc(modsPl(x))}` : ''}</b><small>${x.house ? 'od lokalu' : `na rachunek stolika ${noOf(x.from)}`}${x.msg ? ` · „${esc(x.msg)}”` : ''}</small></div>${since(x.times.accepted || x.at)}${acts}</li>`;
  const rank = ranking()[0];
  const prized = rank && db.gifts.some(x => x.house && x.to === rank.s);
  return `<div class="gifts-desk">
    <section class="desk-card desk-card--hot"><h2>${ic('gift')} Do zaniesienia <b>${g('accepted').length}</b></h2><p>Odbiorca przyjął prezent. Zanieś go i odhacz.</p>
      <ul class="giftlist">${g('accepted').map(x => row(x, `<button class="btn btn--sm btn--soju" data-act="s-delivered" data-id="${x.id}">Dostarczone</button>`)).join('') || '<li class="empty-line">nic do zaniesienia</li>'}</ul></section>
    <section class="desk-card"><h2>${ic('clock')} Czekają na zgodę odbiorcy <b>${g('pending').length}</b></h2><p>Nie podawaj, dopóki odbiorca nie przyjmie. Odmowa nic nie kosztuje nadawcy.</p>
      <ul class="giftlist">${g('pending').map(x => row(x)).join('') || '<li class="empty-line">brak</li>'}</ul></section>
    <section class="desk-card"><h2>${ic('trophy')} Prezent od lokalu</h2>
      ${rank ? `<p>Prowadzi w kapslu: <b>stolik ${noOf(rank.s)}</b>, ${rank.pts} pkt (${rank.wins} wygrane).</p>${prized ? '<p class="fine fine--staff">Już dostał kolejkę od lokalu.</p>' : `<button class="btn btn--tarp" data-act="s-house" data-s="${rank.s}">${ic('gift')} Wyślij kolejkę soju od lokalu</button>`}` : '<p>Nikt jeszcze nie grał.</p>'}</section>
    <section class="desk-card"><h2>${ic('check')} Dostarczone dziś <b>${g('delivered').length}</b></h2><ul class="giftlist giftlist--muted">${g('delivered').slice(-8).reverse().map(x => row(x)).join('') || '<li class="empty-line">brak</li>'}</ul>
      <p class="fine fine--staff">Odrzucone przez odbiorców: ${g('declined').length}</p></section>
  </div>`;
}

// ---------- moderation ----------
function modView() {
  const reports = db.reports.filter(r => r.status === 'open');
  const feed = db.msgs.filter(m => m.ch === 'all').slice(-40).reverse();
  const muted = liveSessions().filter(s => s.muted);
  return `<div class="mod">
    <div class="mod__top">
      <label class="tgl tgl--big"><input type="checkbox" data-ch="s-chat" ${db.config.chatOn ? 'checked' : ''}><span>${ic(db.config.chatOn ? 'chat' : 'chatOff')} ${db.config.chatOn ? 'Czat włączony w całym lokalu' : 'Czat wyłączony w całym lokalu'}</span></label>
      <p>Filtr wulgaryzmów: ${Object.values(db.config.banned).flat().length} słów · limit ${db.config.chatRate} s i ${db.config.chatMax} znaków · wiadomości prywatne obsługa widzi tylko po zgłoszeniu.</p>
    </div>
    <div class="desk-cols desk-cols--2">
      <section class="desk-card${reports.length ? ' desk-card--hot' : ''}"><h2>${ic('flag')} Zgłoszenia <b>${reports.length}</b></h2>
        <ul class="reports">${reports.map(r => {
          const m = db.msgs.find(x => x.id === r.msg);
          return `<li><div class="reports__msg">${cap(noOf(m?.from), 'cap--sm')}<span>${m ? esc(m.text) : '(wiadomość wygasła)'}<small>${isDm(m?.ch || '') ? `prywatna do stolika ${noOf(dmPeer(m.ch, m.from))}` : 'kanał Wszyscy'} · zgłosił stolik ${noOf(r.by)} · ${esc(T.pl['chat.rep.' + r.reason] || r.reason)}</small></span></div>
            <div class="reports__acts">${m && !m.deleted ? `<button class="btn btn--sm btn--bad" data-act="s-del" data-id="${m.id}">Usuń</button>` : ''}${m ? `<button class="btn btn--sm" data-act="s-mute" data-s="${m.from}" data-on="1">Wycisz stolik ${noOf(m.from)}</button>` : ''}<button class="btn btn--sm btn--ghost" data-act="s-dismiss" data-id="${r.id}">Bez naruszenia</button></div></li>`;
        }).join('') || '<li class="empty-line">Brak zgłoszeń.</li>'}</ul>
        ${muted.length ? `<h3>Wyciszone stoliki</h3><div class="chips">${muted.map(s => `<button class="chip" data-act="s-mute" data-s="${s.id}" data-on="0">${cap(tableLabel(s), 'cap--sm')} odcisz</button>`).join('')}</div>` : ''}
      </section>
      <section class="desk-card"><h2>${ic('chat')} Kanał Wszyscy, na żywo</h2>
        <ul class="feed">${feed.map(m => `<li class="${m.deleted ? 'is-del' : ''}">${cap(noOf(m.from), 'cap--sm')}<span>${esc(m.text)}<small>${fmtTime(m.at)}${m.nick ? ' · ' + esc(m.nick) : ''}${m.filtered ? ' · filtr zadziałał' : ''}${m.deleted ? ' · usunięta' : ''}</small></span>${m.deleted ? '' : `<button class="ibtn" data-act="s-del" data-id="${m.id}" aria-label="Usuń wiadomość">${ic('trash')}</button>`}</li>`).join('')}</ul>
      </section>
    </div>
  </div>`;
}

function soldView() {
  return `<div class="sold"><p class="sold__lead">Jedno dotknięcie: pozycja znika z koszyków gości (zostaje na ścianie z pieczątką „wyprzedane”).</p>
    ${CATS.map(k => `<section><h2>${esc(k.name.pl)}</h2><ul>${db.menu.filter(i => i.cat === k.id).map(i => `<li class="${i.soldOut ? 'is-out' : ''}">${art(i.art)}<span>${esc(i.name.pl)}<small>${money(i.price)}</small></span><label class="tgl"><input type="checkbox" data-ch="s-sold" data-i="${i.id}" ${i.soldOut ? '' : 'checked'}><span>${i.soldOut ? 'wyprzedane' : 'dostępne'}</span></label></li>`).join('')}</ul></section>`).join('')}</div>`;
}

function auditView() {
  return `<div class="audit"><h2>Dziennik działań obsługi</h2><p class="fine fine--staff">Otwarcia i zamknięcia stolików, odrzucenia, moderacja, wyprzedane. „Obsługa (auto)” to symulacja makiety.</p>
    <table class="tbl-list"><thead><tr><th>Godzina</th><th>Kto</th><th>Co</th><th>Szczegóły</th></tr></thead><tbody>
    ${db.audit.slice(0, 120).map(a => `<tr><td>${fmtTime(a.at)}</td><td>${esc(staffById(a.by)?.name || a.by)}</td><td>${esc(a.what)}</td><td>${esc(a.detail)}</td></tr>`).join('') || '<tr><td colspan="4">Pusto</td></tr>'}</tbody></table></div>`;
}

// ---------- dialogs ----------
function pickTableDialog(title, lead, list, act) {
  openLayer(`<div class="dlg__head"><h3>${title}</h3><button class="ibtn" data-close aria-label="Zamknij">${ic('x')}</button></div><p>${lead}</p>
    <div class="pick">${list.map(T => `<button class="pick__b" data-act="${act}" data-t="${T.id}">${cap(T.no)}<small>${esc(ZONES.find(z => z.id === T.zone).name.pl)}</small></button>`).join('') || '<p>Brak stolików do wyboru.</p>'}</div>`, { cls: 'dlg' });
}

// ---------- notifications for the floor ----------
function staffNotify(prev, next) {
  if (!ST.who) return;
  const role = me().role;
  const was = new Set(prev.orders.map(o => o.id));
  const fresh = next.orders.filter(o => !was.has(o.id));
  if (fresh.length && role !== 'dj') { sound('dingdong'); fresh.forEach(o => toast(`Nowe zamówienie <b>#${o.no}</b>, stolik ${esc(noOf(o.session))} · ${money(o.total)}${o.status === 'hold' ? ' · do zatwierdzenia' : ''}`, { icon: 'receipt' })); }
  const calls = new Set(prev.calls.map(c => c.id));
  next.calls.filter(c => !calls.has(c.id)).forEach(c => { if (role === 'kitchen') return; sound('dingdong'); toast(`Stolik ${tableById(c.table)?.no}: <b>${esc(callName(c.reason))}</b>`, { icon: 'bell', kind: 'bad' }); });
  const reps = new Set(prev.reports.map(r => r.id));
  next.reports.filter(r => !reps.has(r.id)).forEach(() => toast('Nowe zgłoszenie wiadomości na czacie', { icon: 'flag', kind: 'bad' }));
  next.gifts.filter(g => g.status === 'accepted' && prev.gifts.find(x => x.id === g.id)?.status === 'pending').forEach(g => toast(`Prezent do zaniesienia: ${esc(nameOf(itemById(g.item)))} → stolik ${noOf(g.to)}`, { icon: 'gift' }));
  const songs = new Set(prev.songs.map(r => r.id));
  if ((role === 'dj' || role === 'manager') && next.songs.some(r => !songs.has(r.id))) sound('blip');
}

Object.assign(ACTS, {
  's-pick': el => { ST.pick = el.dataset.id; ST.pin = ''; render(); },
  's-key': el => pinKey(el.dataset.k),
  's-logout': () => { ST.who = null; sess.drop(STAFF_KEY); store.drop(STAFF_HB_KEY); wakeLock?.release?.(); wakeLock = null; location.hash = '#/obsluga'; render(); },
  's-sound': () => { setSound(!soundOn); render(); },
  's-zone': el => { ST.zone = el.dataset.z; ST.table = null; render(); },
  's-table': el => { ST.table = el.dataset.t; render(); },
  's-untable': () => { ST.table = null; render(); },
  's-open': el => {
    const r = sdo('open', { table: el.dataset.t });
    if (!r.ok) { toast('Ten stolik jest już otwarty', { icon: 'alert' }); return; }
    const S = sessionById(r.id);
    toast(`Stolik ${tableById(el.dataset.t).no} otwarty${S.pin ? ` · PIN dla gości: <b>${S.pin}</b>` : ''}`, { icon: 'door', kind: 'ok', ms: 6000 });
  },
  's-approve': el => { sdo('approve', { s: el.dataset.s }); toast('Stolik zweryfikowany, zamówienia poszły do kuchni', { icon: 'check', kind: 'ok' }); },
  's-callst': el => sdo('callStatus', { id: el.dataset.id, status: el.dataset.st }),
  's-bill': el => openLayer(`<div class="dlg__head"><h3>Rachunek stolika ${noOf(el.dataset.s)}</h3><button class="ibtn" data-close aria-label="Zamknij">${ic('x')}</button></div>${receiptHtml(sessionById(el.dataset.s))}<button class="btn btn--line" data-act="s-print">${ic('print')} Drukuj</button>`, { cls: 'dlg' }),
  's-print': () => window.print(),
  's-close': el => {
    const S = sessionById(el.dataset.s);
    openLayer(`<div class="dlg__head"><h3>Zamknąć stolik ${tableLabel(S)}?</h3><button class="ibtn" data-close aria-label="Zamknij">${ic('x')}</button></div>
      <p>Wszystkie telefony przy stoliku (${partsOf(S.id).length}) od razu się odłączą. Ponowny skan kodu będzie wymagał nowego otwarcia.</p>${receiptHtml(S)}
      <button class="btn btn--bad btn--block" data-act="s-close-go" data-s="${S.id}">${ic('receipt')} Rozliczone, zamknij stolik</button>`, { cls: 'dlg' });
  },
  's-close-go': el => { const n = noOf(el.dataset.s); sdo('close', { s: el.dataset.s }); closeLayer(); ST.table = null; toast(`Stolik ${n} zamknięty`, { icon: 'check', kind: 'ok' }); },
  's-move': el => { ST.moving = el.dataset.s; pickTableDialog(`Przenieś stolik ${noOf(el.dataset.s)}`, 'Goście przesiadają się. Rachunek, czat i telefony idą za nimi.', db.tables.filter(T => !sessionOfTable(T.id)), 's-move-go'); },
  's-move-go': el => { sdo('move', { s: ST.moving, table: el.dataset.t }); closeLayer(); ST.table = el.dataset.t; toast(`Przeniesiono na stolik ${tableById(el.dataset.t).no}`, { icon: 'swap', kind: 'ok' }); },
  's-merge': el => { ST.moving = el.dataset.s; const S = sessionById(el.dataset.s); pickTableDialog(`Połącz stolik ${tableLabel(S)} z…`, 'Dwie grupy siadają razem: jeden rachunek, wspólne zamówienia i czat. Telefony z obu stolików zostają.', liveSessions().filter(x => x.id !== S.id).map(x => tableById(x.table)), 's-merge-go'); },
  's-merge-go': el => { const into = sessionOfTable(el.dataset.t); sdo('merge', { s: ST.moving, into: into.id }); closeLayer(); ST.table = into.table; toast(`Połączono: stolik ${tableLabel(sessionById(into.id))}`, { icon: 'merge', kind: 'ok' }); },
  's-mute': el => { const on = el.dataset.on === '1'; sdo('mute', { s: el.dataset.s, on }); toast(`${on ? 'Wyciszono' : 'Odciszono'} czat stolika ${noOf(el.dataset.s)}`, { icon: 'chatOff' }); },
  's-ost': el => sdo('orderStatus', { id: el.dataset.id, status: el.dataset.st }),
  's-oapprove': el => sdo('approveOrder', { id: el.dataset.id }),
  's-oreject': el => {
    const o = db.orders.find(x => x.id === el.dataset.id);
    openLayer(`<div class="dlg__head"><h3>Odrzuć zamówienie #${o.no}</h3><button class="ibtn" data-close aria-label="Zamknij">${ic('x')}</button></div><p>Goście zobaczą powód na telefonie.</p>
      <div class="menu-list">${REJECT_REASONS.map(r => `<button data-act="s-oreject-go" data-id="${o.id}" data-r="${esc(r)}">${ic('x')} ${esc(r)}</button>`).join('')}</div>`, { cls: 'dlg' });
  },
  's-oreject-go': el => { sdo('reject', { id: el.dataset.id, reason: el.dataset.r }); closeLayer(); },
  's-song': el => sdo('songStatus', { id: el.dataset.id, status: el.dataset.st }),
  's-delivered': el => sdo('delivered', { id: el.dataset.id }),
  's-house': el => { sdo('houseGift', { to: el.dataset.s }); toast(`Kolejka od lokalu dla stolika ${noOf(el.dataset.s)}`, { icon: 'gift', kind: 'ok' }); },
  's-del': el => sdo('deleteMsg', { id: el.dataset.id }),
  's-dismiss': el => sdo('dismissReport', { id: el.dataset.id }),
});
Object.assign(CHANGES, {
  's-chat': el => { sdo('chatSwitch', { on: el.checked }); toast(el.checked ? 'Czat włączony' : 'Czat wyłączony we wszystkich telefonach', { icon: el.checked ? 'chat' : 'chatOff' }); },
  's-sold': el => sdo('soldOut', { item: el.dataset.i, on: !el.checked }),
});
