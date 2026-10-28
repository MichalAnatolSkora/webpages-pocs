// Gwizdek v1 — recruitment: the public sign-up form, the coordinator's list of applications, trial
// invitations and "accept", which creates the player and the parent's account from the form data.

const APP_ST = {
  new: { label: 'Nowe', cls: 'info' },
  trial: { label: 'Trening próbny', cls: 'warn' },
  accepted: { label: 'Przyjęty', cls: 'ok' },
  rejected: { label: 'Odrzucony', cls: 'bad' },
};

function recruitView(q) {
  const f = db.form, apps = [...db.apps].sort((a, b) => b.at - a.at);
  const st = APP_ST[q.get('s')] ? q.get('s') : '';
  const count = k => db.apps.filter(a => a.status === k).length;
  const formUrl = `${location.origin}${location.pathname}#/nabor`;
  app.innerHTML = `<div class="page page--wide">
    ${pageHead('Nabory i formularze', esc(f.title), `<button class="btn btn--ghost" id="copyLink">${ic('link')} Kopiuj link</button><a class="btn btn--primary" href="#/nabor" target="_blank" rel="noopener">${ic('eye')} Formularz publiczny</a>`, `${f.open ? badge('przyjmuje zgłoszenia', 'ok') : badge('zamknięty')} &nbsp;Link do wklejenia na stronę klubu i Facebooka. Zgłoszenia trafiają tu na żywo.`)}
    <div class="kpis">${kpi('Zgłoszenia', db.apps.length, 'w tym naborze')}${kpi('Nowe', count('new'), 'czekają na kontakt', count('new') ? 'kpi--info' : '', '#/nabory?s=new')}${kpi('Trening próbny', count('trial'), 'zaproszeni', '', '#/nabory?s=trial')}${kpi('Przyjęci', count('accepted'), 'profil i konto rodzica gotowe', '', '#/nabory?s=accepted')}</div>
    <div class="fchips"><a class="fchip ${!st ? 'is-on' : ''}" href="#/nabory">Wszystkie</a>${Object.entries(APP_ST).map(([k, s]) => `<a class="fchip ${st === k ? 'is-on' : ''}" href="#/nabory?s=${k}">${s.label} (${count(k)})</a>`).join('')}</div>
    <div class="apps">${apps.filter(a => !st || a.status === st).map(appCard).join('') || '<p class="empty-s">Brak zgłoszeń.</p>'}</div></div>`;
  $('#copyLink').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(formUrl); toast('Link skopiowany', 'link'); } catch (e) { toast(formUrl, 'link'); }
  });
  $$('[data-act]', app).forEach(b => b.addEventListener('click', () => appAction(b.dataset.act, b.dataset.id)));
}

function appCard(a) {
  const s = APP_ST[a.status], tr = a.trial ? eventById(a.trial) : null, p = a.playerId ? player(a.playerId) : null;
  const yrs = age(fromIso(a.birth));
  return `<article class="appc appc--${a.status}"><header><b>${esc(a.child)}</b>${badge(s.label, s.cls)}</header>
    <p class="muted small">ur. ${fmtDate(fromIso(a.birth))} (${nOf(yrs, 'rok', 'lata', 'lat')}) · zgłoszenie ${ago(a.at)}</p>
    <dl class="dl dl--sm"><dt>Rodzic</dt><dd>${esc(a.parent)}</dd><dt>Kontakt</dt><dd>${esc(a.phone)}<br>${esc(a.email)}</dd><dt>Doświadczenie</dt><dd>${esc(a.exp)}</dd><dt>Źródło</dt><dd>${esc(a.src)}</dd>${a.note ? `<dt>Uwagi</dt><dd>${esc(a.note)}</dd>` : ''}</dl>
    ${tr ? `<p class="small">${ic('cal', 'i--xs')} Trening próbny: <a href="#/wydarzenie/${tr.id}">${fmtDay(tr.start)} ${fmtTime(tr.start)}, ${teamLabel(tr.team)}</a></p>` : ''}
    <footer class="appc__a">
      ${a.status === 'new' ? `<button class="btn btn--primary btn--sm" data-act="trial" data-id="${a.id}">${ic('cal')} Zaproś na trening próbny</button><button class="btn btn--ghost btn--sm" data-act="reject" data-id="${a.id}">Odrzuć</button>` : ''}
      ${a.status === 'trial' ? `<button class="btn btn--primary btn--sm" data-act="accept" data-id="${a.id}">${ic('check')} Przyjmij do drużyny</button><button class="btn btn--ghost btn--sm" data-act="reject" data-id="${a.id}">Odrzuć</button>` : ''}
      ${a.status === 'accepted' ? `${p ? `<a class="btn btn--ghost btn--sm" href="#/zawodnik/${p.id}">${ic('user')} Profil zawodnika</a>` : ''}<button class="btn btn--ghost btn--sm" data-act="decl" data-id="${a.id}">${ic('print')} Deklaracja członkowska</button>` : ''}
      ${a.status === 'rejected' ? `<button class="btn btn--ghost btn--sm" data-act="restore" data-id="${a.id}">${ic('undo')} Przywróć</button>` : ''}
    </footer></article>`;
}

function appAction(act, id) {
  const a = db.apps.find(x => x.id === id);
  if (act === 'reject') { mutate(d => { d.apps.find(x => x.id === id).status = 'rejected'; }); toast('Zgłoszenie odrzucone — rodzic dostanie uprzejmy e-mail', 'mail'); return render(); }
  if (act === 'restore') { mutate(d => { d.apps.find(x => x.id === id).status = 'new'; }); return render(); }
  if (act === 'decl') return printDeclaration(a);
  if (act === 'trial') {
    const yrs = age(fromIso(a.birth)), tid = yrs <= 9 ? 'u9' : yrs <= 12 ? 'u12' : 'u15';
    const evs = db.events.filter(e => e.type === 'training' && e.team === tid && e.start > Date.now()).slice(0, 6);
    const m = modal({
      cls: 'modal--sm', label: 'Trening próbny',
      html: `${modalHead('Trening próbny', `${esc(a.child)} · proponujemy ${teamLabel(tid)}`)}<div class="mb"><div class="pick">${evs.map(e => `<button class="pick__i" data-ev="${e.id}"><b>${fmtLong(e.start)}</b><small>${fmtRange(e.start, e.end)} · ${facNames(e.fac)}</small></button>`).join('')}</div>
        <p class="muted small">Rodzic dostanie SMS i e-mail z terminem, adresem i listą rzeczy do zabrania.</p></div>`,
    });
    $$('[data-ev]', m.el).forEach(b => b.addEventListener('click', () => {
      mutate(d => { const x = d.apps.find(y => y.id === id); x.status = 'trial'; x.trial = b.dataset.ev; addNote(d, team(tid).coach, { title: 'Trening próbny', body: `${a.child} przyjdzie ${fmtDay(eventById(b.dataset.ev).start)} na ${teamLabel(tid)}.`, link: `#/wydarzenie/${b.dataset.ev}`, icon: 'form' }); });
      m.close();
      toast(`Zaproszenie wysłane do: ${a.parent}`, 'sms');
      render();
    }));
    return;
  }
  if (act === 'accept') {
    const yrs = age(fromIso(a.birth)), def = yrs <= 9 ? 'u9' : yrs <= 12 ? 'u12' : 'u15';
    const m = modal({
      cls: 'modal--sm', label: 'Przyjęcie',
      html: `${modalHead(`Przyjmij: ${esc(a.child)}`, 'Profil i konto rodzica powstaną z danych z formularza')}<form class="mb form" id="accF">
        <label class="field"><span>Drużyna</span><select class="input" name="t">${TEAMS.map(t => `<option value="${t.id}" ${t.id === def ? 'selected' : ''}>${t.cat} · ${t.name} (${zl(t.fee)}/mies.)</option>`).join('')}</select></label>
        <ul class="ticks small"><li>${ic('check', 'i--xs')} profil zawodnika: ${esc(a.child)}, ur. ${fmtDate(fromIso(a.birth))}</li><li>${ic('check', 'i--xs')} konto rodzica: ${esc(a.parent)}, ${esc(a.phone)} — dostęp SMS-em</li><li>${ic('check', 'i--xs')} składki naliczone od bieżącego miesiąca</li><li>${ic('alert', 'i--xs')} badanie lekarskie do uzupełnienia</li></ul></form>
        <footer class="mf"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button class="btn btn--primary" form="accF">${ic('check')} Przyjmij</button></footer>`,
    });
    $('#accF', m.el).addEventListener('submit', e => {
      e.preventDefault();
      const tid = new FormData(e.target).get('t'), [first, ...rest] = a.child.split(' ');
      const pid = mutate(d => {
        const id2 = createPlayer(d, { first, last: rest.join(' '), birth: fromIso(a.birth), team: tid, parent: { name: a.parent, phone: a.phone, email: a.email } });
        const x = d.apps.find(y => y.id === id); x.status = 'accepted'; x.playerId = id2;
        addNote(d, team(tid).coach, { title: 'Nowy zawodnik', body: `${a.child} dołącza do ${teamLabel(tid)}.`, link: `#/zawodnik/${id2}`, icon: 'user' });
        return id2;
      });
      m.close();
      toast(`${a.child} w drużynie ${team(tid).cat}. Rodzic dostał SMS z dostępem.`, 'check');
      render();
      setTimeout(() => printDeclaration(db.apps.find(x => x.id === id)), 300);
    });
  }
}

function printDeclaration(a) {
  const p = a.playerId ? player(a.playerId) : null, t = p ? team(p.team) : null;
  const m = modal({
    cls: 'modal--md', label: 'Deklaracja członkowska',
    html: `${modalHead('Deklaracja członkowska', 'Wygenerowana z formularza — gotowa do podpisu')}<div class="mb"><div class="decl" id="decl">
      <header class="sheet__h"><span class="sheet__crest">${crest()}</span><div><p>${CLUB.name} · ${CLUB.addr}</p><h1>Deklaracja członkowska</h1></div></header>
      <p>Wnoszę o przyjęcie mojego dziecka do sekcji piłki nożnej ${CLUB.name}${t ? `, drużyna <b>${t.cat} · ${t.name}</b>` : ''}.</p>
      <table class="sheet__meta"><tr><th>Dziecko</th><td>${esc(a.child)}</td><th>Data urodzenia</th><td>${fmtDate(fromIso(a.birth))}</td></tr>
        <tr><th>Rodzic / opiekun</th><td>${esc(a.parent)}</td><th>Telefon</th><td>${esc(a.phone)}</td></tr><tr><th>E-mail</th><td colspan="3">${esc(a.email)}</td></tr>
        ${t ? `<tr><th>Składka</th><td>${zl(t.fee)} miesięcznie, do 10. dnia miesiąca</td><th>Konto</th><td>${CLUB.account}</td></tr>` : ''}</table>
      <ul class="decl__c"><li>☑ Zapoznałem(-am) się ze statutem i regulaminem akademii.</li><li>☑ Wyrażam zgodę na udział dziecka w treningach, meczach i wyjazdach.</li><li>☑ Zobowiązuję się dostarczyć aktualne zaświadczenie lekarskie.</li><li>☐ Zgoda na publikację wizerunku dziecka na stronie i w mediach klubu (opcjonalna).</li></ul>
      <div class="decl__sig"><span>Wrocław, ${fmtDate(Date.now())}</span><span>podpis rodzica / opiekuna</span></div></div></div>
      <footer class="mf"><button class="btn btn--ghost" data-close>Zamknij</button><button class="btn btn--primary" id="declPrint">${ic('print')} Drukuj / PDF</button></footer>`,
  });
  $('#declPrint', m.el).addEventListener('click', () => {
    const sheet = document.createElement('div');
    sheet.id = 'print';
    sheet.innerHTML = `<div class="sheet">${$('#decl', m.el).innerHTML}</div>`;
    document.body.append(sheet);
    document.body.classList.add('is-printing');
    const done = () => { document.body.classList.remove('is-printing'); sheet.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.print(); setTimeout(done, 500); }, 60);
  });
}

// ---------- public form ----------
function publicForm() {
  const f = db.form;
  $('#side').innerHTML = ''; $('#top').innerHTML = ''; $('#tabbar').innerHTML = '';
  app.innerHTML = `<div class="pub">
    <header class="pub__h"><span class="pub__crest">${crest()}</span><div><p class="eyebrow">${CLUB.name}</p><h1>${esc(f.title)}</h1><p>${esc(f.desc)}</p></div></header>
    <form class="pub__f form" id="pubF" novalidate>
      <fieldset><legend>Dziecko</legend>
        <label class="field"><span>Imię i nazwisko</span><input class="input" name="child" required autocomplete="off"></label>
        <label class="field"><span>Data urodzenia</span><input class="input" type="date" name="birth" required></label>
        <label class="field"><span>Czy trenowało już piłkę?</span><select class="input" name="exp"><option>Nie trenował(a)</option><option>Zajęcia w przedszkolu / szkole</option><option>Rok w innej szkółce</option><option>Dłużej w innym klubie</option></select></label></fieldset>
      <fieldset><legend>Rodzic lub opiekun</legend>
        <label class="field"><span>Imię i nazwisko</span><input class="input" name="parent" required autocomplete="name"></label>
        <div class="row2"><label class="field"><span>Telefon</span><input class="input" name="phone" required inputmode="tel" autocomplete="tel" placeholder="+48"></label><label class="field"><span>E-mail</span><input class="input" type="email" name="email" required autocomplete="email"></label></div>
        <label class="field"><span>Skąd wiesz o naborze?</span><select class="input" name="src"><option>Polecenie znajomych</option><option>Facebook</option><option>Ulotka w szkole</option><option>Strona klubu</option><option>Inne</option></select></label>
        <label class="field"><span>Uwagi (zdrowie, preferowane dni)</span><textarea class="input" name="note" rows="2"></textarea></label></fieldset>
      <label class="check check--line"><input type="checkbox" name="rodo" required><span>Zgadzam się na przetwarzanie danych w celu przeprowadzenia naboru (administrator: ${CLUB.name}). Dane usuniemy po zakończeniu naboru, jeśli dziecko nie dołączy.</span></label>
      <p class="err" role="alert" hidden></p>
      <button class="btn btn--primary btn--xl btn--block">${ic('send')} Wyślij zgłoszenie</button>
      <p class="muted small center">Makieta — dane trafiają tylko do lokalnej bazy demo w tej przeglądarce.</p>
    </form></div>`;
  $('#pubF').addEventListener('submit', e => {
    e.preventDefault();
    const fm = e.target, v = Object.fromEntries(new FormData(fm)), err = $('.err', fm);
    const miss = ['child', 'birth', 'parent', 'phone', 'email'].filter(k => !String(v[k] || '').trim());
    if (miss.length || !fm.rodo.checked || !/\S+@\S+\.\S+/.test(v.email) || String(v.child).trim().split(/\s+/).length < 2) {
      err.textContent = miss.length ? 'Uzupełnij wszystkie pola.' : !fm.rodo.checked ? 'Potrzebujemy zgody na przetwarzanie danych.' : String(v.child).trim().split(/\s+/).length < 2 ? 'Wpisz imię i nazwisko dziecka.' : 'Sprawdź adres e-mail.';
      err.hidden = false;
      return;
    }
    mutate(d => {
      d.apps.push({ id: uid('a'), at: Date.now(), child: v.child.trim(), birth: v.birth, parent: v.parent.trim(), phone: v.phone.trim(), email: v.email.trim(), exp: v.exp, src: v.src, note: v.note.trim(), status: 'new', trial: null, playerId: null });
      addNote(d, 'anna', { title: 'Nowe zgłoszenie w naborze', body: `${v.child.trim()} (ur. ${fmtDate(fromIso(v.birth))}) — ${v.parent.trim()}`, link: '#/nabory?s=new', icon: 'form' });
    });
    app.innerHTML = `<div class="pub"><div class="pub__ok"><span class="paid__ok">${ic('check')}</span><h1>Dziękujemy!</h1><p>Zgłoszenie ${esc(v.child)} dotarło do akademii. Zadzwonimy lub napiszemy w ciągu 2 dni roboczych z propozycją treningu próbnego.</p>
      <a class="btn btn--ghost" href="#/nabor" id="again">Zgłoś kolejne dziecko</a> <a class="btn btn--ghost" href="#/">Wróć do aplikacji (demo)</a></div></div>`;
    $('#again').addEventListener('click', ev => { ev.preventDefault(); publicForm(); });
  });
}
