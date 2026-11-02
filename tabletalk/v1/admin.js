// TableTalk v1 — the owner's office: configuration that phones pick up at once (modules, how tables
// open, PIN, limits, languages, currency, quick replies, call reasons, banned words, Wi-Fi), the floor
// editor with drag and drop and QR codes (revoke, print as table tents), the menu with translations,
// and the daily report printed like a fiscal Z-report, with CSV export.

const AD = { view: 'konfiguracja', zone: 'sala', table: null, cat: 'all', open: null };
const ADMIN_VIEWS = { konfiguracja: ['Konfiguracja', 'gear'], sala: ['Sala i kody QR', 'qr'], menu: ['Menu', 'menu'], raport: ['Raport dobowy', 'chart'] };
const qrUrl = token => `${location.origin}${location.pathname}#/t/${token}`;
const setCfg = fn => { mutate(d => fn(d.config)); toast('Zapisano. Telefony gości mają to od razu.', { icon: 'check', kind: 'ok', ms: 2200 }); };

function adminView(parts) {
  LANG = 'pl';
  document.documentElement.lang = 'pl';
  AD.view = ADMIN_VIEWS[parts[1]] ? parts[1] : 'konfiguracja';
  const body = { konfiguracja: cfgView, sala: floorEditor, menu: menuAdmin, raport: zReport }[AD.view]();
  paint($('#app'), `<div class="office">
      <header class="office__head">${neonSign('sign--bar')}<div><h1>Biuro właściciela</h1><p>${esc(VENUE.name)} · ${esc(VENUE.address)} · ${esc(VENUE.domain)}</p></div></header>
      <nav class="office__tabs">${Object.entries(ADMIN_VIEWS).map(([k, [n, i]]) => `<a href="#/admin/${k}" class="${AD.view === k ? 'is-on' : ''}" ${AD.view === k ? 'aria-current="page"' : ''}>${ic(i)}${n}</a>`).join('')}</nav>
      <main class="office__body" data-scroll="a-${AD.view}">${body}</main>
    </div>`);
}

// ---------- configuration ----------
const sw = (label, path, on, hint = '') => `<label class="cfg-sw"><input type="checkbox" class="switch" data-ch="a-sw" data-p="${path}" ${on ? 'checked' : ''}><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span></label>`;
const num = (label, path, v, unit = '', min = 0, max = 9999) => `<label class="cfg-num"><span>${label}</span><input type="number" class="input" data-ch="a-num" data-p="${path}" value="${v}" min="${min}" max="${max}"><em>${unit}</em></label>`;

function cfgView() {
  const C = db.config, M = C.modules;
  const modules = [['chat', 'Czat „Wszyscy”'], ['dm', 'Wiadomości prywatne stolik ↔ stolik'], ['gifts', 'Prezenty z mapy sali'], ['songs', 'Prośby o piosenki'], ['votes', 'Głosowanie dnia'], ['games', 'Gry (Kapsel)']];
  return `<div class="cfg">
    <section class="cfg-card"><h2>Moduły</h2><p>Wyłączony moduł znika z telefonów gości.</p>${modules.map(([k, n]) => sw(n, 'modules.' + k, M[k])).join('')}</section>

    <section class="cfg-card"><h2>Wejście do stolika</h2>
      <div class="cfg-radio">
        <label><input type="radio" name="mode" data-ch="a-mode" value="staff" ${C.sessionMode === 'staff' ? 'checked' : ''}><span><b>Obsługa otwiera stolik</b><small>Skan zamkniętego stolika pokazuje „poproś o otwarcie”. Najbezpieczniejsze.</small></span></label>
        <label><input type="radio" name="mode" data-ch="a-mode" value="auto" ${C.sessionMode === 'auto' ? 'checked' : ''}><span><b>Pierwszy skan otwiera stolik</b><small>Stolik startuje „do weryfikacji”: pierwsze zamówienie zatwierdza kelner, prezenty czekają.</small></span></label>
      </div>
      ${sw('PIN stolika (4 cyfry)', 'pinRequired', C.pinRequired, 'Kelner podaje PIN przy otwarciu. Dla lokali z większym ryzykiem nadużyć.')}
      ${num('Limit telefonów na stolik', 'maxParticipants', C.maxParticipants, 'telefonów', 1, 40)}
      ${num('Zamówienie bez akceptacji kelnera do', 'orderLimit', C.orderLimit, C.currency, 0, 5000)}
    </section>

    <section class="cfg-card"><h2>Czat i moderacja</h2>
      ${num('Jedna wiadomość co', 'chatRate', C.chatRate, 's', 0, 60)}
      ${num('Maksymalna długość', 'chatMax', C.chatMax, 'znaków', 20, 500)}
      ${num('Retencja wiadomości', 'retentionH', C.retentionH, 'godzin', 1, 72)}
      <h3>Zakazane słowa</h3><p>Po przecinku. Filtr gwiazdkuje słowo i oznacza wiadomość.</p>
      ${Object.keys(LANGS).map(l => `<label class="cfg-area"><span>${LANGS[l]}</span><textarea class="input" rows="2" data-ch="a-banned" data-l="${l}">${esc((C.banned[l] || []).join(', '))}</textarea></label>`).join('')}
    </section>

    <section class="cfg-card"><h2>Prezenty i piosenki</h2>
      ${sw('Prezent wymaga zgody odbiorcy', 'giftAccept', C.giftAccept, 'Chroni przed niechcianymi zalotami i nabijaniem rachunku.')}
      ${num('Prezentów na stolik na wieczór', 'giftMax', C.giftMax, 'szt.', 0, 50)}
      ${num('Wartość prezentów na wieczór do', 'giftMaxValue', C.giftMaxValue, C.currency, 0, 5000)}
      ${num('Oczekujące prośby o piosenkę na stolik', 'songPending', C.songPending, 'szt.', 1, 20)}
      ${num('Prośby dziennie (cały lokal)', 'songDaily', C.songDaily, 'szt.', 1, 1000)}
      <p class="fine fine--staff">Które pozycje można podarować, ustawiasz w zakładce Menu.</p>
    </section>

    <section class="cfg-card cfg-card--wide"><h2>Szybkie odpowiedzi na czacie</h2><p>Goście wysyłają je jednym dotknięciem, każdy widzi je w swoim języku.</p>
      <table class="tbl-list tbl-list--edit"><thead><tr><th>Polski</th><th>English</th><th>한국어</th><th></th></tr></thead><tbody>
      ${C.quick.map((q, i) => `<tr>${Object.keys(LANGS).map(l => `<td><input class="input" data-ch="a-quick" data-i="${i}" data-l="${l}" value="${esc(q[l] || '')}"></td>`).join('')}<td><button class="ibtn" data-act="a-quick-del" data-i="${i}" aria-label="Usuń">${ic('trash')}</button></td></tr>`).join('')}
      </tbody></table><button class="btn btn--line btn--sm" data-act="a-quick-add">${ic('plus')} Dodaj odpowiedź</button>
    </section>

    <section class="cfg-card"><h2>Powody wezwania obsługi</h2>
      ${C.reasons.map((r, i) => `<label class="cfg-sw"><input type="checkbox" class="switch" data-ch="a-reason" data-i="${i}" ${r.on ? 'checked' : ''}><span>${ic(r.icon)} <b>${esc(r.name.pl)}</b><small>${esc(r.name.en)} · ${esc(r.name.ko)}</small></span></label>`).join('')}
      <p class="fine fine--staff">Jedno aktywne wezwanie danego typu na stolik.</p>
    </section>

    <section class="cfg-card"><h2>Język, waluta, dzień</h2>
      <div class="cfg-row"><span>Języki gości</span>${Object.entries(LANGS).map(([l, n]) => `<label class="opt"><input type="checkbox" data-ch="a-lang" value="${l}" ${C.langs.includes(l) ? 'checked' : ''}><span class="opt__box"></span><span>${n}</span></label>`).join('')}</div>
      <label class="cfg-num"><span>Język domyślny</span><select class="input" data-ch="a-sel" data-p="defaultLang">${C.langs.map(l => `<option value="${l}" ${C.defaultLang === l ? 'selected' : ''}>${LANGS[l]}</option>`).join('')}</select></label>
      <label class="cfg-num"><span>Waluta</span><select class="input" data-ch="a-sel" data-p="currency">${Object.keys(CURRENCIES).map(c => `<option ${C.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="cfg-num"><span>Reset dnia operacyjnego</span><input type="time" class="input" data-ch="a-sel" data-p="dayReset" value="${C.dayReset}"></label>
      <p class="fine fine--staff">O tej godzinie startuje nowe głosowanie, liczniki piosenek i ranking gier.</p>
    </section>

    <section class="cfg-card"><h2>Wi-Fi dla gości</h2><p>Drukowane na naklejce z kodem QR i widoczne w ustawieniach stolika. Przydaje się w piwnicach bez zasięgu.</p>
      <label class="cfg-num"><span>Sieć</span><input class="input" data-ch="a-wifi" data-k="ssid" value="${esc(C.wifi.ssid)}"></label>
      <label class="cfg-num"><span>Hasło</span><input class="input" data-ch="a-wifi" data-k="pass" value="${esc(C.wifi.pass)}"></label>
    </section>
  </div>`;
}

// ---------- floor editor and QR codes ----------
function floorEditor() {
  const T = AD.table && tableById(AD.table);
  return `<div class="fed">
    <div class="fed__top">
      <div class="seg">${ZONES.map(z => `<button data-act="a-zone" data-z="${z.id}" aria-pressed="${AD.zone === z.id}">${esc(z.name.pl)} <small>${db.tables.filter(x => x.zone === z.id).length}</small></button>`).join('')}</div>
      <button class="btn btn--line btn--sm" data-act="a-add">${ic('plus')} Dodaj stolik</button>
      <button class="btn btn--tarp btn--sm" data-act="a-print">${ic('print')} Drukuj kody QR (${db.tables.length})</button>
    </div>
    <p class="fine fine--staff">Przeciągnij stolik, żeby go przestawić. Goście widzą ten układ, wybierając stolik na prezent.</p>
    <div class="fed__grid">
      ${floorHtml(AD.zone, x => `<button class="tbl tbl--edit tbl--s${x.seats}${AD.table === x.id ? ' is-sel' : ''}" style="left:${x.x}%;top:${x.y}%" data-drag="${x.id}" aria-label="Stolik ${x.no}">${tableArt(x.seats)}<b>${x.no}</b></button>`)}
      <aside class="fed__side">${T ? tableEditor(T) : '<div class="drawer__empty">' + ic('qr') + '<p>Wybierz stolik, żeby zmienić numer, liczbę miejsc albo wymienić kod QR.</p></div>'}</aside>
    </div>
  </div>`;
}

function tableEditor(T) {
  const busy = sessionOfTable(T.id);
  return `<div class="ted">
    <h2>${cap(T.no, 'cap--lg')} Stolik ${T.no}</h2>
    <label class="cfg-num"><span>Numer</span><input type="number" class="input" data-ch="a-tno" data-t="${T.id}" value="${T.no}" min="1" max="999"></label>
    <label class="cfg-num"><span>Miejsca</span><select class="input" data-ch="a-tseats" data-t="${T.id}">${[2, 4, 6].map(n => `<option ${T.seats === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="cfg-num"><span>Strefa</span><select class="input" data-ch="a-tzone" data-t="${T.id}">${ZONES.map(z => `<option value="${z.id}" ${T.zone === z.id ? 'selected' : ''}>${esc(z.name.pl)}</option>`).join('')}</select></label>
    <div class="ted__qr"><a href="#/t/${T.token}" title="Otwórz jako gość">${qrSVG(qrUrl(T.token))}</a><div><small>Token stolika (losowy, nie da się zgadnąć innych)</small><code>${T.token}</code>${T.old.length ? `<small>Unieważnione: ${T.old.length}</small>` : ''}</div></div>
    <button class="btn btn--line btn--block" data-act="a-revoke" data-t="${T.id}">${ic('refresh')} Unieważnij i wygeneruj nowy kod</button>
    <button class="btn btn--ghost btn--block" data-act="a-del" data-t="${T.id}" ${busy ? 'disabled title="Stolik jest otwarty"' : ''}>${ic('trash')} Usuń stolik</button>
  </div>`;
}

function qrSheet() {
  const W = db.config.wifi;
  return `<div class="dlg__head"><h3>Kody QR do druku</h3><button class="ibtn" data-close aria-label="Zamknij">${ic('x')}</button></div>
    <p>Stojaki na stoliki, po 6 na A4. Każdy kod prowadzi do ${esc(VENUE.domain)}/t/… z losowym tokenem.</p>
    <button class="btn btn--tarp" data-act="s-print">${ic('print')} Drukuj</button>
    <div class="qrsheet print-area">${[...db.tables].sort((a, b) => a.no - b.no).map(T => `<div class="qtent">
      <div class="qtent__top">${neonSign('sign--print')}</div>
      <div class="qtent__no">${cap(T.no, 'cap--xl')}<span>STOLIK ${T.no}</span></div>
      ${qrSVG(qrUrl(T.token))}
      <p class="qtent__how">Zeskanuj · zamów · pisz do innych stolików<br>Scan · order · chat with other tables<br>스캔 · 주문 · 다른 테이블과 채팅</p>
      ${W.ssid ? `<p class="qtent__wifi">Wi-Fi <b>${esc(W.ssid)}</b> · ${esc(W.pass)}</p>` : ''}
      <p class="qtent__tok">${esc(VENUE.domain)}/t/${T.token}</p>
    </div>`).join('')}</div>`;
}

// drag tables on the floor (pointer events, snapped to 1 %)
let drag = null;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-drag]');
  if (!el || mode !== 'admin') return;
  const floor = el.closest('.floor').getBoundingClientRect();
  drag = { el, id: el.dataset.drag, floor, x0: e.clientX, y0: e.clientY, moved: false };
  el.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 4) drag.moved = true;
  if (!drag.moved) return;
  drag.x = clamp(Math.round(((e.clientX - drag.floor.left) / drag.floor.width) * 100), 4, 96);
  drag.y = clamp(Math.round(((e.clientY - drag.floor.top) / drag.floor.height) * 100), 6, 94);
  drag.el.style.left = drag.x + '%';
  drag.el.style.top = drag.y + '%';
  drag.el.classList.add('is-drag');
});
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const d0 = drag;
  drag = null;
  AD.table = d0.id;
  if (d0.moved) mutate(d => { const T = d.tables.find(x => x.id === d0.id); T.x = d0.x; T.y = d0.y; });
  else render();
});

// ---------- menu ----------
function menuAdmin() {
  const cats = AD.cat === 'all' ? CATS : CATS.filter(k => k.id === AD.cat);
  return `<div class="madm">
    <div class="seg seg--wrap">${[['all', 'Wszystko'], ...CATS.map(k => [k.id, k.name.pl])].map(([id, n]) => `<button data-act="a-cat" data-c="${id}" aria-pressed="${AD.cat === id}">${esc(n)}</button>`).join('')}</div>
    ${cats.map(k => `<section><h2>${esc(k.name.pl)} <small lang="ko">${esc(k.name.ko)}</small></h2>
      <table class="tbl-list tbl-list--menu"><thead><tr><th></th><th>Nazwa</th><th>Cena</th><th>Wyróżnienie</th><th>Prezent</th><th>Gdzie</th><th>Dostępne</th><th></th></tr></thead><tbody>
      ${db.menu.filter(i => i.cat === k.id).map(i => `<tr class="${i.soldOut ? 'is-out' : ''}">
        <td>${art(i.art)}</td>
        <td><input class="input" data-ch="a-mi" data-i="${i.id}" data-f="name.pl" value="${esc(i.name.pl)}"><small lang="ko">${esc(i.ko)}</small></td>
        <td><input type="number" class="input input--num" data-ch="a-mi" data-i="${i.id}" data-f="price" value="${i.price}" min="0"></td>
        <td><select class="input" data-ch="a-mi" data-i="${i.id}" data-f="featured"><option value="">—</option><option value="hit" ${i.featured === 'hit' ? 'selected' : ''}>Hit dnia</option><option value="chef" ${i.featured === 'chef' ? 'selected' : ''}>Polecenie szefa</option></select></td>
        <td><input type="checkbox" class="switch" data-ch="a-mb" data-i="${i.id}" data-f="gift" ${i.gift ? 'checked' : ''} aria-label="Można podarować"></td>
        <td><select class="input" data-ch="a-mk" data-i="${i.id}"><option value="1" ${i.kitchen ? 'selected' : ''}>kuchnia</option><option value="0" ${i.kitchen ? '' : 'selected'}>bar</option></select></td>
        <td><input type="checkbox" class="switch" data-ch="a-mout" data-i="${i.id}" ${i.soldOut ? '' : 'checked'} aria-label="Dostępne"></td>
        <td><button class="ibtn" data-act="a-mopen" data-i="${i.id}" aria-expanded="${AD.open === i.id}" aria-label="Tłumaczenia">${ic('globe')}</button></td></tr>
        ${AD.open === i.id ? `<tr class="tr-detail"><td></td><td colspan="7"><div class="trans">${Object.keys(LANGS).map(l => `<div><b>${LANGS[l]}</b><input class="input" data-ch="a-mi" data-i="${i.id}" data-f="name.${l}" value="${esc(i.name[l] || '')}" placeholder="nazwa"><textarea class="input" rows="2" data-ch="a-mi" data-i="${i.id}" data-f="desc.${l}" placeholder="opis${l === 'pl' ? '' : ' (pusty = polski)'}">${esc(i.desc?.[l] || '')}</textarea></div>`).join('')}</div>
          <p class="fine fine--staff">Alergeny: ${(i.allergens || []).map(a => ALLERGENS[a].n + ' ' + ALLERGENS[a].pl).join(', ') || 'brak'} · warianty: ${(i.mods || []).map(g => MODS[g].name.pl).join(', ') || 'brak'}</p></td></tr>` : ''}`).join('')}
      </tbody></table></section>`).join('')}
  </div>`;
}

// ---------- the daily report, printed like a fiscal Z-report ----------
function zReport() {
  const day = today(), C = db.config;
  const orders = db.orders.filter(o => opDay(o.at, C.dayReset) === day);
  const ok = orders.filter(o => o.status !== 'rejected' && o.status !== 'hold');
  const gifts = db.gifts.filter(g => opDay(g.at, C.dayReset) === day && g.from);
  const billedGifts = gifts.filter(g => g.status === 'accepted' || g.status === 'delivered');
  const turnover = sum(ok, o => o.total) + sum(billedGifts, g => g.price);
  const sessions = db.sessions.filter(s => opDay(s.openedAt, C.dayReset) === day);
  const bills = sessions.map(s => (s.status === 'closed' ? s.total : billOf(s.id).total)).filter(Boolean);
  const hours = {};
  ok.forEach(o => { const h = new Date(o.at).getHours(); hours[h] = (hours[h] || 0) + o.total; });
  const hmax = Math.max(1, ...Object.values(hours));
  const items = {};
  ok.forEach(o => o.items.forEach(l => { items[l.item] = (items[l.item] || 0) + l.qty; }));
  const top = Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const served = ok.filter(o => o.times.served);
  const callsDone = db.calls.filter(c => c.times?.onway || c.times?.done);
  const msgs = db.msgs.filter(m => opDay(m.at, C.dayReset) === day);
  const games = db.games.filter(g => g.status === 'done' && opDay(g.at, C.dayReset) === day);
  const songs = db.songs.filter(r => opDay(r.at, C.dayReset) === day);
  const line = (l, v) => `<div class="z-line"><span>${l}</span><b>${v}</b></div>`;
  const avgMin = list => (list.length ? (sum(list) / list.length / MIN).toFixed(1).replace('.', ',') + ' min' : '—');
  return `<div class="zwrap">
    <div class="zpaper print-area">
      <div class="z-head">${esc(VENUE.name.toUpperCase())}<br>${esc(VENUE.address)}<br>NIP 000-000-00-00 (makieta)</div>
      <div class="z-title">RAPORT DOBOWY<br><small>dzień operacyjny ${day} · od ${C.dayReset} · wydruk ${fmtTime(Date.now())}</small></div>
      ${line('OBRÓT', money(turnover))}
      ${line('  w tym prezenty', money(sum(billedGifts, g => g.price)))}
      ${line('Zamówienia', ok.length)}
      ${line('Odrzucone', orders.filter(o => o.status === 'rejected').length)}
      ${line('Stoliki dziś', sessions.length)}
      ${line('Średni rachunek', bills.length ? money(Math.round(sum(bills) / bills.length)) : '—')}
      <div class="z-sep">OBRÓT WG GODZIN</div>
      ${Object.keys(hours).sort((a, b) => a - b).map(h => `<div class="z-bar"><span>${String(h).padStart(2, '0')}:00</span><i style="--w:${Math.round((hours[h] / hmax) * 100)}%"></i><b>${money(hours[h])}</b></div>`).join('')}
      <div class="z-sep">NAJCZĘŚCIEJ ZAMAWIANE</div>
      ${top.map(([id, n]) => line(esc(nameOf(itemById(id))), n + ' szt.')).join('')}
      <div class="z-sep">PREZENTY</div>
      ${line('Wysłane', gifts.length)}${line('Przyjęte', billedGifts.length)}${line('Odmówione', gifts.filter(g => g.status === 'declined').length)}
      <div class="z-sep">OBSŁUGA</div>
      ${line('Czas zamówienia do wydania', avgMin(served.map(o => o.times.served - o.at)))}
      ${line('Reakcja na wezwanie', avgMin(callsDone.map(c => (c.times.onway || c.times.done) - c.at)))}
      <div class="z-sep">ZABAWA</div>
      ${line('Wiadomości na czacie', msgs.length)}${line('Zgłoszenia / usunięte', `${db.reports.length} / ${msgs.filter(m => m.deleted).length}`)}
      ${line('Prośby o piosenki', songs.length)}${line('Mecze w kapsla', games.length)}
      <div class="z-foot">*** KONIEC RAPORTU ***<br>Wydruk niefiskalny, dane z makiety</div>
    </div>
    <aside class="zside">
      <h2>Eksport</h2><p>Dane dnia do arkusza, z separatorem średnika.</p>
      <button class="btn btn--line btn--block" data-act="a-csv" data-k="orders">${ic('download')} Zamówienia (CSV)</button>
      <button class="btn btn--line btn--block" data-act="a-csv" data-k="gifts">${ic('download')} Prezenty (CSV)</button>
      <button class="btn btn--line btn--block" data-act="s-print">${ic('print')} Drukuj raport</button>
      <p class="fine fine--staff">Integracja z POS, fiskalizacja i rozbudowane statystyki: faza 2.</p>
    </aside>
  </div>`;
}

function csv(kind) {
  const day = today(), C = db.config;
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  let rows;
  if (kind === 'orders') {
    rows = [['nr', 'godzina', 'stolik', 'status', 'pozycje', 'kwota'], ...db.orders.filter(o => opDay(o.at, C.dayReset) === day).map(o => [o.no, fmtTime(o.at), noOf(o.session), o.status, o.items.map(l => `${l.qty}x ${nameOf(itemById(l.item))}`).join(', '), String(o.total).replace('.', ',')])];
  } else {
    rows = [['godzina', 'od stolika', 'do stolika', 'prezent', 'cena', 'status'], ...db.gifts.filter(g => opDay(g.at, C.dayReset) === day).map(g => [fmtTime(g.at), g.house ? 'lokal' : noOf(g.from), noOf(g.to), nameOf(itemById(g.item)), String(g.price).replace('.', ','), g.status])];
  }
  download(`tabletalk-${kind}-${day}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\n'));
}

const setPath = (o, path, v) => { const k = path.split('.'); const last = k.pop(); k.reduce((a, x) => (a[x] = a[x] || {}), o)[last] = v; };

Object.assign(ACTS, {
  'a-zone': el => { AD.zone = el.dataset.z; AD.table = null; render(); },
  'a-add': () => {
    const no = Math.max(...db.tables.map(x => x.no)) + 1, id = 't' + no + uid('');
    mutate(d => d.tables.push({ id, no, zone: AD.zone, x: 50, y: 50, seats: 4, token: makeToken(), old: [] }));
    AD.table = id;
    toast(`Dodano stolik ${no}. Przeciągnij go na miejsce.`, { icon: 'plus', kind: 'ok' });
  },
  'a-print': () => openLayer(qrSheet(), { cls: 'dlg dlg--wide' }),
  'a-revoke': el => {
    mutate(d => { const T = d.tables.find(x => x.id === el.dataset.t); T.old.push(T.token); T.token = makeToken(); d.audit.unshift({ at: Date.now(), by: 'owner', what: `Wymieniono kod QR stolika ${T.no}`, detail: 'stary kod pokazuje „nieaktualny”' }); });
    toast('Nowy kod gotowy do druku. Stary prowadzi już tylko do ekranu „kod nieaktualny”.', { icon: 'refresh', kind: 'ok', ms: 5000 });
  },
  'a-del': el => { mutate(d => { d.tables = d.tables.filter(x => x.id !== el.dataset.t); }); AD.table = null; },
  'a-quick-add': () => setCfg(C => C.quick.push({ id: uid('q'), pl: '', en: '', ko: '' })),
  'a-quick-del': el => setCfg(C => C.quick.splice(+el.dataset.i, 1)),
  'a-cat': el => { AD.cat = el.dataset.c; render(); },
  'a-mopen': el => { AD.open = AD.open === el.dataset.i ? null : el.dataset.i; render(); },
  'a-csv': el => csv(el.dataset.k),
});
Object.assign(CHANGES, {
  'a-sw': el => setCfg(C => setPath(C, el.dataset.p, el.checked)),
  'a-num': el => setCfg(C => setPath(C, el.dataset.p, Math.max(+el.min || 0, +el.value || 0))),
  'a-sel': el => setCfg(C => setPath(C, el.dataset.p, el.value)),
  'a-mode': el => setCfg(C => { C.sessionMode = el.value; }),
  'a-banned': el => setCfg(C => { C.banned[el.dataset.l] = el.value.split(/[,\n]/).map(x => x.trim()).filter(Boolean); }),
  'a-quick': el => setCfg(C => { C.quick[+el.dataset.i][el.dataset.l] = el.value; }),
  'a-reason': el => setCfg(C => { C.reasons[+el.dataset.i].on = el.checked; }),
  'a-lang': el => setCfg(C => {
    C.langs = Object.keys(LANGS).filter(l => (l === el.value ? el.checked : C.langs.includes(l)));
    if (!C.langs.length) C.langs = [C.defaultLang];
    if (!C.langs.includes(C.defaultLang)) C.defaultLang = C.langs[0];
  }),
  'a-wifi': el => setCfg(C => { C.wifi[el.dataset.k] = el.value.trim(); }),
  'a-tno': el => mutate(d => { d.tables.find(x => x.id === el.dataset.t).no = Math.max(1, +el.value || 1); }),
  'a-tseats': el => mutate(d => { d.tables.find(x => x.id === el.dataset.t).seats = +el.value; }),
  'a-tzone': el => { mutate(d => { d.tables.find(x => x.id === el.dataset.t).zone = el.value; }); AD.zone = el.value; render(); },
  'a-mi': el => mutate(d => {
    const it = d.menu.find(x => x.id === el.dataset.i), f = el.dataset.f;
    if (f === 'featured') d.menu.forEach(x => { if (el.value && x.featured === el.value) x.featured = ''; });
    setPath(it, f, f === 'price' ? Math.max(0, +el.value || 0) : el.value);
  }),
  'a-mb': el => mutate(d => { d.menu.find(x => x.id === el.dataset.i)[el.dataset.f] = el.checked; }),
  'a-mk': el => mutate(d => { d.menu.find(x => x.id === el.dataset.i).kitchen = el.value === '1'; }),
  'a-mout': el => mutate(d => { d.menu.find(x => x.id === el.dataset.i).soldOut = !el.checked; }),
});
