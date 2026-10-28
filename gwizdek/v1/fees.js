// Gwizdek v1 — fees: the coordinator's grid (manual booking, reminders, CSV export), bank statement
// import with automatic matching, the finance report, the coach's read-only view and the parent's
// payment flow (BLIK / card, simulated).

function feesView(q) {
  if (isParent()) return parentFees(q);
  const tabs = isCoord() ? [['grid', 'Należności'], ['import', 'Wyciąg bankowy'], ['report', 'Raport']] : [['grid', 'Należności']];
  const tab = tabs.some(x => x[0] === q.get('t')) ? q.get('t') : 'grid';
  app.innerHTML = `<div class="page page--wide">
    ${pageHead('Składki', { grid: 'Należności i wpłaty', import: 'Import wyciągu bankowego', report: 'Raport finansowy' }[tab],
      isCoord() && tab === 'grid' ? `<button class="btn btn--ghost" id="csv">${ic('download')} CSV</button><button class="btn btn--primary" id="remind">${ic('bell')} Przypomnij o zaległych</button>` : '',
      isCoord() ? `Konto klubu ${CLUB.account} · tytuł przelewu: imię i nazwisko dziecka + miesiąc` : 'Podgląd dla trenera — rozliczenia prowadzi koordynatorka.')}
    ${tabs.length > 1 ? tabsBar(tabs, tab, '#/skladki') : ''}
    <div id="fBody"></div></div>`;
  const body = $('#fBody');
  ({ grid: feesGrid, import: bankImport, report: feesReport })[tab](body, q);
  $('#remind')?.addEventListener('click', () => reminderModal());
  $('#csv')?.addEventListener('click', () => {
    const rows = [['Zawodnik', 'Drużyna', 'Rodzic', 'Okres', 'Kwota', 'Termin', 'Status', 'Data wpłaty', 'Metoda']];
    db.charges.forEach(c => { const p = player(c.player); rows.push([pname(p), team(p.team).cat, parentRec(p.parent)?.name, c.period, c.amount, fmtDate(c.due), CHARGE[chargeStatus(c)].label, c.paid ? fmtDate(c.paid) : '', c.method ? PAY_METHOD[c.method] : '']); });
    downloadFile(`skladki-${isoDay(Date.now())}.csv`, rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'));
    toast('Plik CSV pobrany', 'download');
  });
}

function feesGrid(host, q) {
  const now = Date.now(), M = ym(now), periods = db.periods;
  const teams = isCoord() ? TEAMS.map(t => t.id) : myTeamIds();
  const tf = q.get('team') && teams.includes(q.get('team')) ? q.get('team') : '';
  const sf = q.get('f') || '';
  const month = db.charges.filter(c => c.period === M && teams.includes(player(c.player).team));
  const paidM = month.filter(c => c.paid).reduce((a, c) => a + c.amount, 0), allM = month.reduce((a, c) => a + c.amount, 0);
  const od = db.charges.filter(c => chargeStatus(c) === 'overdue' && teams.includes(player(c.player).team));
  const link = o => `#/skladki?${new URLSearchParams({ team: tf, f: sf, ...o })}`;
  host.innerHTML = `<div class="kpis">
      ${kpi(`Należne · ${ymLabel(M)}`, zl(allM), `${month.length} składek`)}
      ${kpi('Wpłynęło', zl(paidM), `${pct(paidM, allM)}% · ${month.filter(c => c.paid).length} wpłat`)}
      ${kpi('Zaległości', zl(od.reduce((a, c) => a + c.amount, 0)), nOf(new Set(od.map(c => c.player)).size, 'zawodnik', 'zawodników', 'zawodników'), od.length ? 'kpi--bad' : '')}
      ${kpi('Online w aplikacji', `${pct(db.charges.filter(c => c.method === 'online').length, db.charges.filter(c => c.paid).length)}%`, 'wpłat bez księgowania ręcznego')}
    </div>
    <div class="fbar">
      <div class="fchips"><a class="fchip ${!tf ? 'is-on' : ''}" href="${link({ team: '' })}">Wszystkie</a>${teams.map(t => `<a class="fchip ${tf === t ? 'is-on' : ''}" style="--c:${team(t).color}" href="${link({ team: t })}"><i></i>${team(t).cat}</a>`).join('')}</div>
      <div class="fchips"><a class="fchip ${!sf ? 'is-on' : ''}" href="${link({ f: '' })}">Każdy status</a><a class="fchip ${sf === 'overdue' ? 'is-on' : ''}" href="${link({ f: 'overdue' })}">Zaległe</a><a class="fchip ${sf === 'due' ? 'is-on' : ''}" href="${link({ f: 'due' })}">Do zapłaty</a></div>
      <label class="search">${ic('search')}<input class="input" id="fQ" placeholder="Zawodnik lub rodzic"></label></div>
    <div class="tbl-wrap"><table class="tbl tbl--fees"><thead><tr><th>Zawodnik</th><th>Rodzic</th>${periods.map(p => `<th>${ymLabel(p)}<small>termin ${fmtDate(ymDate(p, 10)).slice(0, 5)}</small></th>`).join('')}<th>Saldo</th></tr></thead><tbody id="fRows"></tbody></table></div>
    <p class="muted small legend">${Object.values(CHARGE).map(c => `${badge(c.label, c.cls)}`).join(' ')} ${isCoord() ? '· kliknij składkę, żeby zaksięgować wpłatę gotówką lub przelewem' : ''}</p>`;
  const draw = () => {
    const qv = norm($('#fQ').value);
    const players = db.players.filter(p => (tf ? p.team === tf : teams.includes(p.team)) && (!qv || norm(`${pname(p)} ${parentRec(p.parent)?.name}`).includes(qv)))
      .filter(p => !sf || chargesOf(p.id).some(c => chargeStatus(c) === sf));
    $('#fRows').innerHTML = players.map(p => {
      const ch = chargesOf(p.id), owed = ch.filter(c => chargeStatus(c) === 'overdue').reduce((a, c) => a + c.amount, 0);
      return `<tr><td><a href="#/zawodnik/${p.id}?t=fees">${esc(pname(p))}</a><small>${teamTag(p.team)}${p.discount ? ' ' + esc(p.discount.label) : ''}</small></td><td><small>${esc(parentRec(p.parent)?.name)}</small></td>
        ${periods.map(per => { const c = ch.find(x => x.period === per); if (!c) return '<td>—</td>'; const s = chargeStatus(c); return `<td><button class="fcell fcell--${CHARGE[s].cls}" data-c="${c.id}" ${isCoord() ? '' : 'disabled'}><b>${zl(c.amount)}</b><small>${s === 'paid' ? `${fmtDate(c.paid).slice(0, 5)} · ${c.method === 'online' ? 'online' : c.method === 'przelew' ? 'przelew' : 'gotówka'}` : s === 'overdue' ? `${daysBetween(c.due, now)} dni po terminie${c.reminded.length ? ` · ${ic('bell', 'i--xs')}${c.reminded.length}` : ''}` : 'czeka'}</small></button></td>`; }).join('')}
        <td class="${owed ? 'bad-t strong' : 'muted'}">${owed ? '−' + zl(owed) : '0 zł'}</td></tr>`;
    }).join('') || `<tr><td colspan="6" class="empty-s">Brak pozycji.</td></tr>`;
  };
  $('#fQ').addEventListener('input', draw);
  draw();
  $('#fRows').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b && isCoord()) chargeModal(b.dataset.c); });
}

function chargeModal(cid) {
  const c = db.charges.find(x => x.id === cid), p = player(c.player), s = chargeStatus(c), par = parentRec(p.parent);
  const m = modal({
    cls: 'modal--sm', label: 'Składka',
    html: `${modalHead(`${esc(pname(p))} · ${ymLabel(c.period)}`, `${teamLabel(p.team)} · rodzic: ${esc(par.name)}`)}
      <div class="mb"><dl class="dl"><dt>Kwota</dt><dd>${zl(c.amount)}${c.disc ? ` <small>(${zl(c.base)} · ${esc(c.disc)})</small>` : ''}</dd><dt>Termin</dt><dd>${fmtDate(c.due)}</dd><dt>Status</dt><dd>${badge(CHARGE[s].label, CHARGE[s].cls)}</dd>
        ${c.paid ? `<dt>Wpłata</dt><dd>${fmtDate(c.paid)} · ${PAY_METHOD[c.method]}${c.ref ? ` · ${esc(c.ref)}` : ''}</dd>` : ''}
        ${c.reminded.length ? `<dt>Przypomnienia</dt><dd>${c.reminded.map(fmtDate).join(', ')}</dd>` : ''}</dl>
        ${!c.paid ? `<form class="form form--row mt" id="bookF"><select class="input" name="m"><option value="gotowka">Gotówka</option><option value="przelew">Przelew</option></select><input class="input" type="date" name="d" value="${isoDay(Date.now())}"><button class="btn btn--primary">${ic('check')} Zaksięguj wpłatę</button></form>` : ''}</div>
      <footer class="mf">${c.paid ? `<button class="btn btn--ghost" data-undo>${ic('undo')} Cofnij wpłatę</button>` : `<button class="btn btn--ghost" data-rem>${ic('bell')} Przypomnij rodzicowi</button>`}<button class="btn btn--ghost" data-close>Zamknij</button></footer>`,
  });
  $('#bookF', m.el)?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mutate(d => { const x = d.charges.find(y => y.id === cid); x.paid = Math.min(Date.now(), atTime(fromIso(fd.get('d')), '12:00')); x.method = fd.get('m'); });
    m.close(); toast(`Zaksięgowano ${zl(c.amount)} — ${pname(p)}`); render();
  });
  $('[data-undo]', m.el)?.addEventListener('click', () => { mutate(d => { const x = d.charges.find(y => y.id === cid); x.paid = null; x.method = null; x.ref = null; }); m.close(); render(); });
  $('[data-rem]', m.el)?.addEventListener('click', () => { sendFeeReminders([cid], 'push'); m.close(); render(); });
}

function sendFeeReminders(ids, channel) {
  mutate(d => {
    const byParent = {};
    ids.forEach(id => { const c = d.charges.find(x => x.id === id); c.reminded.push(Date.now()); const p = d.players.find(x => x.id === c.player); (byParent[p.parent] = byParent[p.parent] || []).push({ c, p }); });
    Object.entries(byParent).forEach(([par, list]) => addNote(d, par, { title: 'Przypomnienie o składce', body: `${list.map(({ c, p }) => `${p.first} — ${ymLabel(c.period)}, ${zl(c.amount)}`).join('; ')}. Zapłać w aplikacji.`, link: '#/skladki', icon: 'coins' }));
    const n = Object.keys(byParent).length;
    d.campaigns.push({ id: uid('m'), at: Date.now(), by: me(), channel, audience: 'Zaległe składki', text: 'Przypomnienie o zaległej składce', count: n, cost: channel === 'sms' ? n * SMS_PRICE : 0 });
  });
  const n = new Set(ids.map(id => player(db.charges.find(c => c.id === id).player).parent)).size;
  toast(`Przypomnienie wysłane do ${nOf(n, 'rodzica', 'rodziców', 'rodziców')}${channel === 'sms' ? ` · SMS ${zl(+(n * SMS_PRICE).toFixed(2))}` : ''}`, 'bell');
}

function reminderModal() {
  const od = db.charges.filter(c => chargeStatus(c) === 'overdue');
  const parents = new Set(od.map(c => player(c.player).parent));
  if (!od.length) return toast('Brak zaległych składek', 'check');
  const tpl = `${CLUB.short}: przypominamy o składce za {miesiąc} dla {dziecko} ({kwota}). Zapłacisz w aplikacji Gwizdek w minutę. Dziękujemy!`;
  const ex = od[0], exP = player(ex.player);
  const m = modal({
    cls: 'modal--md', label: 'Przypomnienie o składkach',
    html: `${modalHead('Przypomnij o zaległych', `${nOf(od.length, 'składka', 'składki', 'składek')} · ${nOf(parents.size, 'rodzic', 'rodziców', 'rodziców')}`)}
      <form class="mb form" id="remF"><fieldset class="field"><legend>Kanał</legend><div class="seg seg--full">
        <label class="seg__b"><input type="radio" name="ch" value="push" checked><span>Push + e-mail · 0 zł</span></label>
        <label class="seg__b"><input type="radio" name="ch" value="sms"><span>SMS · ${zl(+(parents.size * SMS_PRICE).toFixed(2))}</span></label></div></fieldset>
        <label class="field"><span>Treść (zmienne podstawiamy automatycznie)</span><textarea class="input" rows="3" name="t">${tpl}</textarea></label>
        <div class="phone-prev"><p class="eyebrow">Podgląd dla: ${esc(parentRec(exP.parent).name)}</p><div class="bubble" id="remPrev"></div><small class="muted" id="remLen"></small></div></form>
      <footer class="mf"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button class="btn btn--primary" form="remF">${ic('send')} Wyślij (${parents.size})</button></footer>`,
  });
  const f = $('#remF', m.el);
  const prev = () => {
    const txt = f.t.value.replace('{miesiąc}', ymLabel(ex.period)).replace('{dziecko}', exP.first).replace('{kwota}', zl(ex.amount));
    $('#remPrev', m.el).textContent = txt;
    const seg = smsSegments(txt);
    $('#remLen', m.el).textContent = f.ch.value === 'sms' ? `${txt.length} znaków · ${nOf(seg, 'SMS', 'SMS-y', 'SMS-ów')} na odbiorcę${/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(txt) ? ' (polskie znaki: 70 znaków na SMS)' : ''}` : 'Push w aplikacji + e-mail';
  };
  f.addEventListener('input', prev);
  prev();
  f.addEventListener('submit', e => { e.preventDefault(); sendFeeReminders(od.map(c => c.id), f.ch.value); m.close(); render(); });
}

function smsSegments(txt) {
  const uni = /[^\x00-\x7F]/.test(txt), single = uni ? 70 : 160, multi = uni ? 67 : 153;
  return txt.length <= single ? 1 : Math.ceil(txt.length / multi);
}

// ---------- bank statement ----------
function bankImport(host) {
  const sample = ['data;nadawca;tytuł;kwota', ...db.bankSample.map(l => `${l.date};${l.from};${l.title};${String(l.amount).replace('.', ',')}`)].join('\n');
  host.innerHTML = `<div class="grid2 grid2--wide"><section class="card"><header class="card__h"><h2>1. Wklej wyciąg <small>CSV z bankowości: data;nadawca;tytuł;kwota</small></h2></header>
      <p class="muted small">W demo wkleiliśmy przykładowy wyciąg z ostatnich dni. Plik z banku można też przeciągnąć (symulacja).</p>
      <textarea class="input mono" id="bankTxt" rows="10" spellcheck="false">${esc(sample)}</textarea>
      <div class="btn-row"><button class="btn btn--primary" id="bankGo">${ic('refresh')} Dopasuj wpłaty</button></div></section>
    <section class="card"><header class="card__h"><h2>Jak dopasowujemy</h2></header><ul class="ticks">
      <li>${ic('check', 'i--xs')} nazwisko i imię dziecka w tytule lub nadawcy — także odmienione („Wiśniewskiego”) i bez polskich znaków</li>
      <li>${ic('check', 'i--xs')} kwota równa składce (z rabatem)</li><li>${ic('check', 'i--xs')} miesiąc w tytule wybiera właściwą składkę; bez niego — najstarszą zaległą</li>
      <li>${ic('alert', 'i--xs')} inna kwota = do sprawdzenia, brak dopasowania = przypisujesz ręcznie albo pomijasz</li></ul>
      ${db.bankImports.length ? `<h3 class="h3">Poprzednie importy</h3><ul class="feed">${db.bankImports.map(b => `<li><span class="feed__i">${ic('bank')}</span><span>${nOf(b.count, 'wpłata', 'wpłaty', 'wpłat')} · ${zl(b.sum)}<small>${ago(b.at)} · ${esc(personName(b.by))}</small></span></li>`).join('')}</ul>` : ''}</section></div>
    <div id="bankRes"></div>`;
  $('#bankGo').addEventListener('click', () => {
    const lines = $('#bankTxt').value.trim().split('\n').slice(1).map(s => s.split(';')).filter(r => r.length >= 4)
      .map(([date, from, title, amount], i) => ({ i, date, from, title, amount: parseFloat(amount.replace(/\s/g, '').replace(',', '.')) }));
    bankResults($('#bankRes'), lines);
  });
}

function matchLine(line, unpaid, taken) {
  const t = ' ' + norm(`${line.title} ${line.from}`).replace(/[^a-z0-9./ ]/g, ' ') + ' ';
  // a month named in the title, but only one we bill for ("maj" also hides in "Majewski")
  const named = db.periods.find(p => t.includes(norm(MONTHS[+p.split('-')[1] - 1]).slice(0, 5)));
  const mm = t.match(/\b(\d{1,2})[./](20\d\d)\b/);
  const per = mm ? `${mm[2]}-${mm[1].padStart(2, '0')}` : named || null;
  const scored = [];
  unpaid.forEach(c => {
    if (taken.has(c.id)) return;
    const p = player(c.player), ln = norm(p.last), fn = norm(p.first);
    const lnStem = ln.slice(0, Math.max(4, ln.length - 2)), fnStem = fn.slice(0, Math.min(4, fn.length));
    let s = 0, name = false;
    if (t.includes(lnStem)) { s += 2; name = true; }
    if (t.includes(fnStem) || t.includes(` ${fn[0]}. `)) s += 1;
    if (Math.abs(line.amount - c.amount) < 0.01) s += 1.5;
    if (per && c.period === per) s += 0.6;
    if (name && s >= 3) scored.push({ c, s, amountOk: Math.abs(line.amount - c.amount) < 0.01 });
  });
  scored.sort((a, b) => b.s - a.s || a.c.period.localeCompare(b.c.period));
  const best = scored[0];
  if (!best) return { kind: 'none', c: null };
  return { kind: best.amountOk ? 'auto' : 'check', c: best.c };
}

function bankResults(host, lines) {
  const unpaid = db.charges.filter(c => !c.paid);
  const taken = new Set();
  const res = lines.map(l => { const r = matchLine(l, unpaid, taken); if (r.c) taken.add(r.c.id); return { ...l, ...r, use: r.kind === 'auto' }; });
  const opt = c => { const p = player(c.player); return `<option value="${c.id}">${esc(pname(p))} · ${team(p.team).cat} · ${ymShort(c.period)} · ${zl(c.amount)}</option>`; };
  const draw = () => {
    const sel = res.filter(r => r.use && r.c);
    host.innerHTML = `<section class="card"><header class="card__h"><h2>2. Sprawdź dopasowania <small>${res.filter(r => r.kind === 'auto').length} automatycznie · ${res.filter(r => r.kind === 'check').length} do sprawdzenia · ${res.filter(r => r.kind === 'none').length} bez dopasowania</small></h2></header>
      <div class="tbl-wrap"><table class="tbl tbl--bank"><thead><tr><th></th><th>Data</th><th>Nadawca i tytuł</th><th>Kwota</th><th>Dopasowanie</th></tr></thead><tbody>${res.map(r => `<tr class="is-${r.kind}">
        <td><input type="checkbox" data-use="${r.i}" ${r.use && r.c ? 'checked' : ''} ${r.c ? '' : 'disabled'} aria-label="Zaksięguj"></td><td>${esc(r.date)}</td><td><b>${esc(r.from)}</b><small>${esc(r.title)}</small></td><td class="num">${zl(r.amount)}</td>
        <td>${r.kind === 'auto' ? badge(`${ic('check', 'i--xs')} pewne`, 'ok') : r.kind === 'check' ? badge('inna kwota — sprawdź', 'warn') : badge('nie rozpoznano', 'bad')}
          <select class="input input--sm" data-pick="${r.i}"><option value="">— pomiń (nie składka) —</option>${unpaid.map(opt).join('')}</select></td></tr>`).join('')}</tbody></table></div>
      <footer class="savebar"><span class="savebar__s">${nOf(sel.length, 'wpłata', 'wpłaty', 'wpłat')} · ${zl(sel.reduce((a, r) => a + r.amount, 0))}</span><button class="btn btn--primary btn--lg" id="bankBook" ${sel.length ? '' : 'disabled'}>${ic('check')} Zaksięguj</button></footer></section>`;
    res.forEach(r => { const s = $(`[data-pick="${r.i}"]`, host); s.value = r.c?.id || ''; });
    $$('[data-use]', host).forEach(cb => cb.addEventListener('change', () => { res[cb.dataset.use].use = cb.checked; draw(); }));
    $$('[data-pick]', host).forEach(s => s.addEventListener('change', () => { const r = res[s.dataset.pick]; r.c = s.value ? db.charges.find(c => c.id === s.value) : null; r.use = !!r.c; if (r.c && r.kind === 'none') r.kind = 'check'; draw(); }));
    $('#bankBook', host)?.addEventListener('click', () => {
      const book = res.filter(r => r.use && r.c);
      mutate(d => {
        book.forEach(r => { const c = d.charges.find(x => x.id === r.c.id); c.paid = atTime(fromIso(r.date), '12:00'); c.method = 'przelew'; c.ref = `wyciąg: ${r.title}`; if (r.amount < c.amount) c.note = `wpłata częściowa ${zl(r.amount)}`; });
        d.bankImports.unshift({ at: Date.now(), by: me(), count: book.length, sum: book.reduce((a, r) => a + r.amount, 0) });
      });
      toast(`Zaksięgowano ${nOf(book.length, 'wpłatę', 'wpłaty', 'wpłat')} z wyciągu`, 'bank');
      location.hash = '#/skladki';
    });
  };
  draw();
}

// ---------- report ----------
function feesReport(host) {
  const periods = db.periods, cols = { due: 'var(--line-2)', paid: 'var(--pitch)' };
  const groups = periods.map(per => { const ch = db.charges.filter(c => c.period === per); return { label: ymShort(per), bars: [{ v: ch.reduce((a, c) => a + c.amount, 0), color: cols.due, title: `Należne ${zl(ch.reduce((a, c) => a + c.amount, 0))}` }, { v: ch.filter(c => c.paid).reduce((a, c) => a + c.amount, 0), color: cols.paid, title: `Wpłacone ${zl(ch.filter(c => c.paid).reduce((a, c) => a + c.amount, 0))}` }] }; });
  const M = ym(Date.now()), paid = db.charges.filter(c => c.paid);
  const methods = Object.keys(PAY_METHOD).map(k => ({ k, n: paid.filter(c => c.method === k).length }));
  host.innerHTML = `<div class="grid2">
    ${card('Należne i wpłacone', `${barsSvg(groups, { fmt: v => (v >= 1000 ? num(v / 1000, 1) + ' tys.' : num(v)) })}<p class="legend-c"><span><i style="background:${cols.due}"></i>należne</span><span><i style="background:${cols.paid}"></i>wpłacone</span></p>`)}
    ${card('Jak płacą rodzice', `<ul class="bars">${methods.map(x => `<li><span>${PAY_METHOD[x.k]}</span>${meter(x.n, paid.length)}<b>${pct(x.n, paid.length)}%</b></li>`).join('')}</ul><p class="muted small">Wpłaty online księgują się same; przelewy — przez import wyciągu.</p>`)}</div>
    ${card(`Drużyny · ${ymLabel(M)}`, `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Drużyna</th><th>Zawodnicy</th><th>Składka</th><th>Należne</th><th>Wpłacone</th><th>%</th><th>Zaległości (wszystkie miesiące)</th></tr></thead><tbody>${TEAMS.map(t => {
      const ch = db.charges.filter(c => c.period === M && player(c.player).team === t.id), due = ch.reduce((a, c) => a + c.amount, 0), pd = ch.filter(c => c.paid).reduce((a, c) => a + c.amount, 0);
      const od = db.charges.filter(c => chargeStatus(c) === 'overdue' && player(c.player).team === t.id).reduce((a, c) => a + c.amount, 0);
      return `<tr><td>${teamTag(t.id)} ${t.name}</td><td>${teamPlayers(t.id).length}</td><td>${zl(t.fee)}</td><td>${zl(due)}</td><td>${zl(pd)}</td><td><span class="mcell">${meter(pd, due)}<b>${pct(pd, due)}%</b></span></td><td class="${od ? 'bad-t' : ''}">${zl(od)}</td></tr>`;
    }).join('')}</tbody></table></div>`)}
    ${card('Wysłane przypomnienia i kampanie', `<ul class="feed">${[...db.campaigns].sort((a, b) => b.at - a.at).map(c => `<li><span class="feed__i">${ic(c.channel === 'sms' ? 'sms' : c.channel === 'email' ? 'mail' : 'bell')}</span><span><b>${esc(c.audience)}</b> · ${nOf(c.count, 'odbiorca', 'odbiorców', 'odbiorców')}${c.cost ? ` · ${zl(+c.cost.toFixed(2))}` : ''}<small>${ago(c.at)} · ${esc(c.text).slice(0, 90)}</small></span></li>`).join('')}</ul>`)}`;
}

// ---------- parent ----------
function parentFees(q) {
  const kids = myKids(), all = kids.flatMap(k => chargesOf(k.id));
  const open = all.filter(c => !c.paid), owedNow = open.filter(c => chargeStatus(c) === 'overdue' || c.period === ym(Date.now()));
  const paid = all.filter(c => c.paid).sort((a, b) => b.paid - a.paid);
  const sel = new Set((q.get('pay') === 'overdue' ? open.filter(c => chargeStatus(c) === 'overdue') : owedNow).map(c => c.id));
  const draw = () => {
    const sum = open.filter(c => sel.has(c.id)).reduce((a, c) => a + c.amount, 0);
    app.innerHTML = `<div class="pp"><h1 class="pp__title">Składki</h1>
      <section class="balance ${owedNow.some(c => chargeStatus(c) === 'overdue') ? 'is-bad' : ''}"><small>Do zapłaty teraz</small><b>${zl(owedNow.reduce((a, c) => a + c.amount, 0))}</b><span>${owedNow.length ? nOf(owedNow.length, 'składka', 'składki', 'składek') : 'Wszystko opłacone 🎉'}</span></section>
      ${open.length ? `<section class="pp__sec"><h2 class="pp__h">Wybierz, za co płacisz</h2>
        ${open.map(c => { const k = player(c.player), s = chargeStatus(c); return `<label class="payrow ${sel.has(c.id) ? 'is-on' : ''}" style="--c:${kidColor(k, kids.indexOf(k))}"><input type="checkbox" data-c="${c.id}" ${sel.has(c.id) ? 'checked' : ''}>
          <span class="payrow__b"><b>${esc(k.first)} · ${ymLabel(c.period)}</b><small>${s === 'overdue' ? `<span class="bad-t">zaległa od ${fmtDate(c.due)}</span>` : `termin ${fmtDate(c.due)}`}${c.disc ? ` · ${esc(c.disc)}` : ''}</small></span><b class="payrow__a">${zl(c.amount)}</b></label>`; }).join('')}
        <button class="btn btn--primary btn--xl btn--block" id="payBtn" ${sum ? '' : 'disabled'}>${ic('phone')} Zapłać ${zl(sum)}</button>
        <p class="muted small center">BLIK, karta lub szybki przelew · wpłata od razu widoczna w klubie</p></section>` : ''}
      <section class="pp__sec"><h2 class="pp__h">Historia wpłat</h2><ul class="hist">${paid.map(c => { const k = player(c.player); return `<li><span><b>${esc(k.first)} · ${ymLabel(c.period)}</b><small>${fmtDate(c.paid)} · ${PAY_METHOD[c.method]}</small></span><b>${zl(c.amount)}</b></li>`; }).join('')}</ul></section></div>`;
    $$('[data-c]', app).forEach(cb => cb.addEventListener('change', () => { cb.checked ? sel.add(cb.dataset.c) : sel.delete(cb.dataset.c); draw(); }));
    $('#payBtn', app)?.addEventListener('click', () => payModal(open.filter(c => sel.has(c.id))));
  };
  draw();
  if (q.get('pay')) { history.replaceState(null, '', '#/skladki'); if (sel.size) payModal(open.filter(c => sel.has(c.id))); }
}

function payModal(charges) {
  const sum = charges.reduce((a, c) => a + c.amount, 0);
  const m = modal({
    cls: 'modal--pay', label: 'Płatność',
    html: `${modalHead(`Płatność ${zl(sum)}`, `${CLUB.name} · ${charges.map(c => `${player(c.player).first} ${ymShort(c.period)}`).join(', ')}`)}
      <div class="mb"><div class="seg seg--full" role="tablist">${[['blik', 'BLIK'], ['card', 'Karta'], ['tr', 'Szybki przelew']].map(([k, l], i) => `<button type="button" class="seg__b ${i ? '' : 'is-on'}" data-m="${k}">${l}</button>`).join('')}</div>
        <form class="form mt" id="payF">
          <div data-p="blik"><label class="field"><span>Kod BLIK z aplikacji banku</span><input class="input input--code" name="blik" inputmode="numeric" maxlength="7" placeholder="000 000" autocomplete="off"></label><p class="muted small">Demo: wpisz dowolne 6 cyfr.</p></div>
          <div data-p="card" hidden><label class="field"><span>Numer karty</span><input class="input" name="card" inputmode="numeric" placeholder="0000 0000 0000 0000" autocomplete="off"></label>
            <div class="row2"><label class="field"><span>Ważna do</span><input class="input" name="exp" placeholder="MM/RR"></label><label class="field"><span>CVC</span><input class="input" name="cvc" inputmode="numeric" maxlength="3" placeholder="123"></label></div><p class="muted small">Demo: numer testowy 4111 1111 1111 1111, dowolna data i CVC. Nic nie jest obciążane.</p></div>
          <div data-p="tr" hidden><div class="banks">${['Bank Zielony', 'Bank Wiśniowy', 'Bank Słoneczny', 'Bank Morski'].map((b, i) => `<label class="bank"><input type="radio" name="bank" value="${b}" ${i ? '' : 'checked'}><span>${ic('bank')} ${b}</span></label>`).join('')}</div><p class="muted small">Banki fikcyjne — logowanie symulowane.</p></div>
          <button class="btn btn--primary btn--xl btn--block mt">${ic('shield')} Zapłać ${zl(sum)}</button>
          <p class="err" role="alert" hidden></p></form></div>`,
  });
  let method = 'blik';
  $$('[data-m]', m.el).forEach(b => b.addEventListener('click', () => { method = b.dataset.m; $$('[data-m]', m.el).forEach(x => x.classList.toggle('is-on', x === b)); $$('[data-p]', m.el).forEach(p => { p.hidden = p.dataset.p !== method; }); }));
  const f = $('#payF', m.el), err = $('.err', m.el);
  f.blik.addEventListener('input', () => { const dg = f.blik.value.replace(/\D/g, '').slice(0, 6); f.blik.value = dg.length > 3 ? `${dg.slice(0, 3)} ${dg.slice(3)}` : dg; });
  f.card.addEventListener('input', () => { f.card.value = f.card.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '); });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    err.hidden = true;
    if (method === 'blik' && f.blik.value.replace(/\D/g, '').length !== 6) { err.textContent = 'Kod BLIK ma 6 cyfr.'; err.hidden = false; return; }
    if (method === 'card' && f.card.value.replace(/\D/g, '').length !== 16) { err.textContent = 'Numer karty ma 16 cyfr.'; err.hidden = false; return; }
    m.close();
    const b = busy(method === 'blik' ? 'Potwierdź płatność w aplikacji banku…' : method === 'card' ? 'Autoryzacja karty…' : 'Łączymy z bankiem…');
    await wait(1400);
    b.set('Księgujemy wpłatę w klubie…');
    await wait(800);
    b.close();
    const ref = 'GW-' + Math.floor(100000 + Math.random() * 900000);
    mutate(d => {
      charges.forEach(c => { const x = d.charges.find(y => y.id === c.id); x.paid = Date.now(); x.method = 'online'; x.ref = ref; });
      addNote(d, 'anna', { title: `Wpłata online ${zl(sum)}`, body: `${personName(me())} — ${charges.map(c => `${d.players.find(p => p.id === c.player).first} ${ymShort(c.period)}`).join(', ')}`, link: '#/skladki', icon: 'coins' });
      d.notes.forEach(n => { if (n.to === me() && n.icon === 'coins') n.read = true; });
    });
    render();
    const r = modal({
      cls: 'modal--sm', label: 'Zapłacono',
      html: `<div class="mb paid"><span class="paid__ok">${ic('check')}</span><h2>Zapłacono ${zl(sum)}</h2><p class="muted">${fmtFull(Date.now())}, ${fmtTime(Date.now())} · nr ${ref}</p>
        <ul class="hist">${charges.map(c => `<li><span>${esc(player(c.player).first)} · ${ymLabel(c.period)}</span><b>${zl(c.amount)}</b></li>`).join('')}</ul>
        <p class="small muted">Klub widzi wpłatę od razu — nie trzeba wysyłać potwierdzenia.</p></div>
        <footer class="mf"><button class="btn btn--primary btn--block" data-close>Gotowe</button></footer>`,
    });
  });
}
