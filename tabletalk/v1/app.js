// TableTalk v1 — shell and router: the demo bar (not part of the product), the start page "outside the
// pocha" with real QR codes for every table, the guest phone frame, staff panel, office and TV,
// event dispatch for every view, and redraws when the shared state changes in any tab.

let mode = '';

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '').split('?')[0];
  return { parts: raw.split('/').filter(Boolean) };
}

function renderShell() {
  document.body.className = `mode-${mode}`;
  const shell = $('#shell');
  if (mode === 'guest') {
    shell.innerHTML = `<div class="stage">
      <div class="phone" aria-label="Telefon gościa">
        <div class="phone__screen">
          <div id="screen"></div>
          <div class="overlays"></div>
          <div class="layers"></div>
          <div class="toasts" aria-live="polite"></div>
        </div>
      </div>
      <aside class="stage__note" id="stageNote"></aside>
    </div>`;
  } else {
    shell.innerHTML = `<div id="app"></div><div class="layers"></div><div class="toasts" aria-live="polite"></div>`;
  }
}

function render() {
  const { parts } = parseHash();
  const m = { t: 'guest', obsluga: 'staff', admin: 'admin', tv: 'tv' }[parts[0]] || 'start';
  if (m !== mode) { mode = m; closeLayer(true); renderShell(); }
  renderDemoBar();
  try {
    ({ guest: guestView, staff: staffView, admin: adminView, tv: tvView, start: startView })[m](parts);
  } catch (e) {
    console.error(e);
    ($('#screen') || $('#app')).innerHTML = `<div class="empty empty--tall">${ic('alert')}<p>Coś poszło nie tak przy rysowaniu tego ekranu.</p><a class="btn btn--line" href="#/">Wróć na start</a></div>`;
  }
  if (mode === 'guest') stageNote();
}

// Several changes can land in one task (an offline replay, a simulation batch): draw once after it,
// and never in the middle of a Korean IME composition. A microtask, not a frame, so a background
// tab (where frames are throttled) still shows a fresh state the moment it is looked at.
let pending = false, composing = false;
function scheduleRender() {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    if (composing) { setTimeout(scheduleRender, 120); return; }
    render();
    if (mode === 'guest' && layer && G.sheet) G.sheet();
  });
}
document.addEventListener('compositionstart', () => { composing = true; });
document.addEventListener('compositionend', () => { composing = false; });

function onDbChange(prev, next) {
  try {
    if (mode === 'guest' && prev !== next) guestNotify(prev, next);
    if (mode === 'staff' && prev !== next) staffNotify(prev, next);
  } catch (e) { console.warn(e); }
  scheduleRender();
}

window.addEventListener('hashchange', () => { closeLayer(true); render(); const v = $('.gview, .sview, .office__body'); if (v) v.scrollTop = 0; });

// ---------- event dispatch ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' && el.dataset.act !== 'g-item') return;
  ACTS[el.dataset.act]?.(el, e);
});
document.addEventListener('input', e => { INPUTS[e.target.dataset?.in]?.(e.target, e); });
document.addEventListener('change', e => { CHANGES[e.target.dataset?.ch]?.(e.target, e); });
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-submit]');
  if (!f) return;
  e.preventDefault();
  SUBMITS[f.dataset.submit]?.(f, e);
});

// ---------- demo bar ----------
const demoTable = () => tableById('t5');
function renderDemoBar() {
  const bar = $('#demobar');
  if (!bar) return;
  const g = mode === 'guest' && G.token;
  const crew = staffOnline() ? 'w panelu, ręcznie' : demo.crew ? 'automat' : 'nikt';
  bar.innerHTML = `<a class="demobar__brand" href="#/">TableTalk <small>makieta</small></a>
    <nav class="demobar__nav">
      <a href="#/" class="${mode === 'start' ? 'is-on' : ''}">${ic('qr')}<span>Start</span></a>
      <a href="#/t/${g ? G.token : demoTable()?.token}" class="${mode === 'guest' ? 'is-on' : ''}">${ic('phone')}<span>Gość</span></a>
      <a href="#/obsluga" class="${mode === 'staff' ? 'is-on' : ''}">${ic('bell')}<span>Obsługa</span></a>
      <a href="#/admin" class="${mode === 'admin' ? 'is-on' : ''}">${ic('gear')}<span>Biuro</span></a>
      <a href="#/tv" class="${mode === 'tv' ? 'is-on' : ''}">${ic('tv')}<span>TV</span></a>
    </nav>
    <div class="demobar__tools">
      ${g ? `<a class="dbtn" href="#/t/${G.token}?phone=new" target="_blank" rel="noopener" title="Ta sama naklejka, inny telefon">${ic('plus')}<span>drugi telefon</span></a>
        <button class="dbtn${offline ? ' is-on' : ''}" data-act="d-offline" aria-pressed="${offline}" title="Piwnica bez zasięgu: akcje czekają w kolejce">${ic('cloudOff')}<span>offline${outbox.length ? ' · ' + outbox.length : ''}</span></button>` : ''}
      <button class="dbtn${demo.sim ? ' is-on' : ''}" data-act="d-sim" aria-pressed="${demo.sim}" title="Inne stoliki piszą, zamawiają, grają">${ic('users')}<span>symulacja sali</span></button>
      <button class="dbtn${demo.crew ? ' is-on' : ''}" data-act="d-crew" aria-pressed="${demo.crew}" title="Gdy nikt nie jest zalogowany w panelu, zamówienia i wezwania obsługuje automat">${ic('bell')}<span>obsługa: ${crew}</span></button>
      <button class="dbtn" data-act="d-reset" title="Wieczór od nowa">${ic('refresh')}<span>reset</span></button>
    </div>`;
}

function stageNote() {
  const el = $('#stageNote');
  if (!el) return;
  const c = gctx();
  el.innerHTML = `<h2>Telefon gościa</h2>
    <p>Ta karta przeglądarki to jeden telefon (<code>${DEVICE}</code>). Każda nowa karta z „drugi telefon” to kolejny gość, przy tym albo innym stoliku. Stan sali jest wspólny dla wszystkich kart.</p>
    ${c.me ? `<p>Siedzisz przy stoliku <b>${tableLabel(c.session)}</b> jako ${c.me.nick ? `<b>${esc(c.me.nick)}</b>` : 'gość bez pseudonimu'}, telefonów przy stoliku: ${partsOf(c.session.id).length}.</p>` : ''}
    <ul>
      <li>Po ~30 s inny stolik napisze do Ciebie prywatnie, po ~80 s wyśle prezent.</li>
      <li>Włącz <b>offline</b> na pasku: zamówienie, wiadomość i wezwanie czekają w kolejce i idą po powrocie zasięgu, bez dubli.</li>
      <li>Panel <a href="#/obsluga">Obsługi</a> (PIN 1111) przejmuje zamówienia i wezwania od automatu.</li>
      <li>W <a href="#/admin">Biurze</a> zmień tryb otwierania stolików, wyłącz moduł albo język: telefon zmieni się od razu.</li>
    </ul>`;
}

Object.assign(ACTS, {
  'd-offline': () => {
    if (!offline) { setOffline(true); toast('Telefon stracił zasięg. Akcje poczekają w kolejce.', { icon: 'cloudOff' }); return; }
    const r = setOffline(false);
    toast(`Zasięg wrócił. Stan pobrany od nowa${r.sent ? `, wysłano zaległe: ${r.sent}` : ''}${r.failed.length ? `, odrzucone: ${r.failed.length}` : ''}.`, { icon: 'refresh', kind: 'ok', ms: 5000 });
  },
  'd-sim': () => setDemo({ sim: !demo.sim }),
  'd-crew': () => setDemo({ crew: !demo.crew }),
  'd-reset': () => {
    if (!confirm('Zacząć wieczór od nowa? Wszystkie karty dostaną świeże dane makiety.')) return;
    Object.keys(sessionStorage).filter(k => k.startsWith('tabletalk-g-')).forEach(k => sess.drop(k));
    Object.assign(G, { cart: [], cartKey: null, read: {}, ackClosed: [], seenGifts: [], draft: '' });
    resetDb();
    toast('Nowy wieczór w Nolja Pocha', { icon: 'refresh', kind: 'ok' });
  },
});

// ---------- start: outside the pocha ----------
function startView() {
  LANG = 'pl';
  document.documentElement.lang = 'pl';
  const tent = T => {
    const S = sessionOfTable(T.id);
    const st = !S ? (db.config.sessionMode === 'auto' ? 'otworzy się skanem' : 'zamknięty, poprosisz o otwarcie') : S.status === 'verify' ? 'do weryfikacji' : `otwarty · ${partsOf(S.id).filter(p => p.device === 'bot').length ? 'goście z symulacji' : 'telefony: ' + partsOf(S.id).length}`;
    return `<div class="tentcard${S ? ' is-open' : ''}${T.no === 5 ? ' is-demo' : ''}">
      <a class="tentcard__scan" href="#/t/${T.token}" aria-label="Zeskanuj kod stolika ${T.no}">${qrSVG(qrUrl(T.token))}<span class="tentcard__no">${cap(T.no)}</span></a>
      <div class="tentcard__meta"><b>Stolik ${T.no}</b><small>${esc(st)}</small></div>
      <a class="tentcard__new" href="#/t/${T.token}?phone=new" target="_blank" rel="noopener">${ic('plus')} nowy telefon</a>
    </div>`;
  };
  paint($('#app'), `<div class="start">
    <header class="start__hero">
      <div class="start__tent">${tentArt()}</div>
      ${neonSign('sign--xl')}
      <h1>TableTalk</h1>
      <p class="start__lead">Zamawianie, czat między stolikami, prezenty i piosenki z telefonu gościa. Bez tabletów: kod QR na stoliku, przeglądarka, gotowe. Makieta dla fikcyjnej pochy w Krakowie.</p>
    </header>

    <section class="start__sec">
      <h2><span>1</span> Usiądź i zeskanuj kod ze stojaka</h2>
      <p>Każdy kod to prawdziwy QR z losowym tokenem stolika (zeskanowany telefonem otworzy tę makietę). Kliknięcie kodu „skanuje” go w tej karcie, „nowy telefon” otwiera kolejnego gościa w nowej karcie.
        <b>Stolik 5</b> jest otwarty i siedzi przy nim już telefon Kuby. <b>Stolik 8</b> jest zamknięty: telefon poprosi obsługę o otwarcie.</p>
      ${ZONES.map(z => `<h3>${esc(z.name.pl)}</h3><div class="tents">${db.tables.filter(T => T.zone === z.id).sort((a, b) => a.no - b.no).map(tent).join('')}</div>`).join('')}
    </section>

    <section class="start__sec start__sec--doors">
      <h2><span>2</span> Za ladą i na zapleczu</h2>
      <div class="doors">
        <a class="door" href="#/obsluga">${ic('bell')}<b>Panel obsługi</b><small>Tablet zmiany: sala, bony na szynie, kuchnia, wyświetlacz wezwań, piosenki, prezenty, moderacja. PIN: Ola 1111, Kuba 2222, Min-jun 3333, Ania 4444.</small></a>
        <a class="door" href="#/admin">${ic('gear')}<b>Biuro właściciela</b><small>Konfiguracja, edytor sali z kodami QR do druku, menu z tłumaczeniami, raport dobowy i CSV.</small></a>
        <a class="door" href="#/tv">${ic('tv')}<b>Ekran nad barem</b><small>Głosowanie dnia, kolejka DJ-a, ranking kapsla i czat na żywo.</small></a>
      </div>
    </section>

    <section class="start__sec start__sec--fine">
      <h2><span>3</span> Co tu jest symulowane</h2>
      <ul>
        <li>Serwer udaje <code>localStorage</code> wspólny dla kart tej przeglądarki; zmiany idą do innych kart na żywo, jak przez WebSocket.</li>
        <li>Inne stoliki to boty: piszą po polsku, angielsku i koreańsku, zamawiają, proszą o piosenki, grają w kapsla. Wyłącz na pasku „symulacja sali”.</li>
        <li>Gdy nikt nie jest zalogowany w panelu, zamówienia, wezwania i prezenty obsługuje automat. Zaloguj się, żeby robić to ręcznie.</li>
        <li>Brak płatności online, POS, Web Push i service workera. To kolejne kroki (faza 2).</li>
      </ul>
    </section>
  </div>`);
}

// ---------- TV above the bar ----------
function tvView() {
  LANG = 'pl';
  const day = today(), votes = db.votes.filter(v => v.day === day), total = votes.length || 1;
  const songs = db.songs.filter(r => opDay(r.at, db.config.dayReset) === day);
  const played = songs.filter(r => r.status === 'played').sort((a, b) => (b.times.played || 0) - (a.times.played || 0))[0];
  const queue = songs.filter(r => r.status === 'accepted').sort((a, b) => a.at - b.at).slice(0, 4);
  const rank = ranking().slice(0, 5);
  const chat = db.msgs.filter(m => m.ch === 'all' && !m.deleted).slice(-8);
  paint($('#app'), `<div class="tv">
    <header class="tv__head">${neonSign('sign--xl')}<p>Zeskanuj kod na stoliku · Scan the code on your table · 테이블 QR 코드를 스캔하세요</p></header>
    <section class="tv__vote"><h2><span lang="ko">${esc(VOTE.title.ko)}</span>${esc(VOTE.title.pl)}</h2>
      ${VOTE.options.map(o => { const n = votes.filter(v => v.option === o.id).length, p = Math.round((n / total) * 100); return `<div class="tvbar">${art(o.art)}<span>${esc(o.name.pl)}</span><i style="--p:${p}%"></i><b>${p}%</b></div>`; }).join('')}</section>
    <section class="tv__songs"><h2><span lang="ko">노래방</span>Teraz i za chwilę</h2>
      ${played ? `<div class="tv__now"><small>TERAZ</small><b>${esc(played.title)}</b><span>${esc(played.artist)} · stolik ${noOf(played.session)}</span></div>` : ''}
      <ol>${queue.map(r => `<li><span class="song__no">${r.no}</span><b>${esc(r.title)}</b><small>${esc(r.artist)}</small>${cap(noOf(r.session), 'cap--sm')}</li>`).join('') || '<li>Kolejka pusta. Poproś o piosenkę z telefonu!</li>'}</ol></section>
    <section class="tv__rank"><h2><span lang="ko">병뚜껑</span>Ranking kapsla</h2>
      <ol>${rank.map((r, i) => `<li><span>${i + 1}</span>${cap(noOf(r.s))}<b>${r.pts} pkt</b></li>`).join('') || '<li>Jeszcze nikt nie grał</li>'}</ol></section>
    <footer class="tv__ticker"><div class="tv__ticker-in">${[...chat, ...chat].map(m => `<span>${cap(noOf(m.from), 'cap--sm')} ${esc(m.text)}</span>`).join('')}</div></footer>
  </div>`);
}

render();
