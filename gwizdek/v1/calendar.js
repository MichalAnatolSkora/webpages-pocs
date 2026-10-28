// Gwizdek v1 — calendar (staff week view, parent agenda), the new-event dialog with facility conflict
// checks, the event page (attendance, call-ups, live match, plan, evaluation, RPE) and the facility grid.

function calendarView(q) {
  const now = Date.now(), w = +(q.get('w') || 0);
  const wk = addDays(startOfWeek(now), w * 7);
  const filt = q.get('team') || (role === 'coach' ? 'mine' : 'all');
  const teams = filt === 'mine' ? myTeamIds() : filt === 'all' ? TEAMS.map(t => t.id) : [filt];
  const days = Array.from({ length: 7 }, (_, i) => addDays(wk, i));
  const evs = db.events.filter(e => e.start >= wk && e.start < addDays(wk, 7) && (teams.includes(e.team) || e.team === 'all'));
  const link = (o = {}) => `#/kalendarz?${new URLSearchParams({ w, team: filt, ...o })}`;
  const chip = (id, label, color) => `<a class="fchip ${filt === id ? 'is-on' : ''}" href="${link({ team: id })}" ${color ? `style="--c:${color}"` : ''}>${color ? '<i></i>' : ''}${label}</a>`;

  app.innerHTML = `<div class="page page--wide">
    ${pageHead('Kalendarz', `${days[0].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      `<div class="btn-group"><a class="btn btn--ghost btn--icon" href="${link({ w: w - 1 })}" aria-label="Poprzedni tydzień">${ic('left')}</a><a class="btn btn--ghost" href="${link({ w: 0 })}">Dziś</a><a class="btn btn--ghost btn--icon" href="${link({ w: w + 1 })}" aria-label="Następny tydzień">${ic('right')}</a></div>
       <button type="button" class="btn btn--primary" id="newEv">${ic('plus')} Wydarzenie</button>`)}
    <div class="fchips">${role === 'coach' ? chip('mine', 'Moje drużyny') : ''}${chip('all', 'Wszystkie')}${TEAMS.map(t => chip(t.id, `${t.cat} ${t.name}`, t.color)).join('')}</div>
    <div class="week">${days.map(d => {
      const list = evs.filter(e => sameDay(e.start, d));
      return `<section class="wday ${sameDay(d, now) ? 'is-today' : ''} ${d < startOfDay(now) ? 'is-past' : ''}">
        <header class="wday__h"><span>${WD_SHORT[new Date(d).getDay()]}</span><b>${new Date(d).getDate()}</b></header>
        <div class="wday__l">${list.map(e => weekCard(e)).join('') || '<span class="wday__none">—</span>'}</div></section>`;
    }).join('')}</div>
    <p class="muted small legend">${ic('book', 'i--xs')} konspekt &nbsp; ${ic('check', 'i--xs')} obecność zapisana &nbsp; ${ic('flag', 'i--xs')} powołania &nbsp; ${ic('repeat', 'i--xs')} wydarzenie cykliczne</p>
  </div>`;
  $('#newEv').addEventListener('click', () => newEventModal({ day: w ? wk : startOfDay(now), team: teams.length === 1 ? teams[0] : myTeamIds()[0] }));
  if (q.get('new')) { history.replaceState(null, '', '#/kalendarz'); newEventModal({ day: startOfDay(now) }); }
}

function weekCard(e) {
  const marks = [];
  if (e.plan) marks.push(ic('book', 'i--xs'));
  if (e.type === 'training' && Object.keys(e.att).length) marks.push(ic('check', 'i--xs'));
  if (e.type === 'match' && Object.keys(e.callup).length) {
    const v = Object.values(e.callup);
    marks.push(`${ic('flag', 'i--xs')}${v.filter(x => x === 'yes').length}/${v.length}`);
  }
  if (e.series) marks.push(ic('repeat', 'i--xs'));
  const score = e.type === 'match' && e.live && !e.fest ? `<b class="score">${e.live.us}:${e.live.them}</b>` : '';
  return `<a class="wcard wcard--${e.type} ${isPast(e) ? 'is-past' : ''} ${isLive(e) ? 'is-live' : ''}" href="#/wydarzenie/${e.id}" style="--c:${teamColor(e.team)}">
    <span class="wcard__t">${fmtRange(e.start, e.end)}</span>
    <b>${teamTag(e.team)} ${esc(e.type === 'match' ? (e.fest ? e.title : e.opp) : e.title)}</b>
    <small>${esc(e.type === 'match' ? (e.home ? 'u siebie' : 'wyjazd') : facNames(e.fac))}</small>
    <span class="wcard__m">${marks.join(' ')}${score}</span></a>`;
}

// ---------- new event ----------
function newEventModal({ day = startOfDay(Date.now()), team: tid } = {}) {
  const teams = isCoord() ? TEAMS : myTeams();
  tid = teams.some(t => t.id === tid) ? tid : teams[0].id;
  const m = modal({
    cls: 'modal--md', label: 'Nowe wydarzenie',
    html: `${modalHead('Nowe wydarzenie', 'Rodzice dostaną powiadomienie w aplikacji')}
      <form class="mb form" id="evForm">
        <div class="seg seg--full" role="radiogroup" aria-label="Rodzaj">${[['training', 'Trening'], ['match', 'Mecz'], ['other', 'Inne']].map(([v, l], i) => `<label class="seg__b"><input type="radio" name="type" value="${v}" ${i ? '' : 'checked'}><span>${l}</span></label>`).join('')}</div>
        <div class="row2">
          <label class="field"><span>Drużyna</span><select class="input" name="team">${teams.map(t => `<option value="${t.id}" ${t.id === tid ? 'selected' : ''}>${t.cat} · ${t.name}</option>`).join('')}</select></label>
          <label class="field" data-for="other"><span>Nazwa</span><input class="input" name="title" placeholder="np. Zebranie z rodzicami"></label>
          <label class="field" data-for="match"><span>Rywal</span><input class="input" name="opp" placeholder="np. KS Fala Oława" list="oppList"><datalist id="oppList">${OPPONENTS.map(o => `<option value="${esc(o[0])}">`).join('')}</datalist></label>
        </div>
        <div class="row3">
          <label class="field"><span>Data</span><input class="input" type="date" name="date" value="${isoDay(day)}" required></label>
          <label class="field"><span>Od</span><input class="input" type="time" name="from" value="17:00" step="900" required></label>
          <label class="field"><span>Do</span><input class="input" type="time" name="to" value="18:30" step="900" required></label>
        </div>
        <fieldset class="field" data-for="match"><legend>Miejsce</legend>
          <div class="seg"><label class="seg__b"><input type="radio" name="home" value="1" checked><span>U siebie</span></label><label class="seg__b"><input type="radio" name="home" value="0"><span>Wyjazd</span></label></div>
        </fieldset>
        <label class="field" data-for="away"><span>Adres na wyjeździe</span><input class="input" name="place" placeholder="ulica, miejscowość"></label>
        <fieldset class="field" data-for="fac"><legend>Obiekt</legend><div class="checks">${FACILITIES.map(f => `<label class="check"><input type="checkbox" name="fac" value="${f.id}" ${f.id === 'a1' ? 'checked' : ''}><span>${f.short}</span></label>`).join('')}</div></fieldset>
        <label class="check check--line" data-for="training"><input type="checkbox" name="repeat"><span>Powtarzaj co tydzień przez <input class="input input--xs" type="number" name="weeks" value="8" min="2" max="20"> tygodni</span></label>
        <div class="conflicts" id="conf" aria-live="polite"></div>
      </form>
      <footer class="mf"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button type="submit" form="evForm" class="btn btn--primary" id="evSave">${ic('check')} Zapisz</button></footer>`,
  });
  const f = $('#evForm', m.el);
  const val = () => {
    const fd = new FormData(f), type = fd.get('type'), home = fd.get('home') === '1';
    const dayTs = fromIso(fd.get('date')), start = atTime(dayTs, fd.get('from')), end = atTime(dayTs, fd.get('to'));
    const fac = type === 'match' && !home ? [] : fd.getAll('fac');
    const weeks = type === 'training' && fd.get('repeat') ? clamp(+fd.get('weeks') || 1, 1, 20) : 1;
    return { type, home, team: fd.get('team'), title: fd.get('title').trim(), opp: fd.get('opp').trim(), place: fd.get('place').trim(), start, end, fac, weeks };
  };
  const check = () => {
    const v = val();
    $$('[data-for]', f).forEach(el => {
      const k = el.dataset.for;
      el.hidden = k === 'fac' ? v.type === 'match' && !v.home : k === 'away' ? !(v.type === 'match' && !v.home) : k !== v.type;
    });
    const hits = [];
    if (v.end <= v.start) hits.push('<li>Godzina końca musi być po godzinie początku.</li>');
    if (v.fac.length) for (let k = 0; k < v.weeks; k++) {
      eventConflicts({ fac: v.fac, start: addDays(v.start, k * 7), end: addDays(v.end, k * 7) }).forEach(c =>
        hits.push(`<li><b>${fmtDay(c.start)} ${fmtRange(c.start, c.end)}</b> · ${facNames(c.fac)} — ${esc(c.who)}</li>`));
    }
    $('#conf', m.el).innerHTML = hits.length ? `<div class="callout callout--bad">${ic('alert')}<div><b>Obiekt zajęty — zmień godzinę albo obiekt</b><ul>${hits.slice(0, 6).join('')}</ul>${hits.length > 6 ? `<small>i ${hits.length - 6} więcej</small>` : ''}</div></div>`
      : v.fac.length ? `<p class="callout callout--ok">${ic('check')} ${facNames(v.fac)} ${v.weeks > 1 ? `wolne we wszystkich ${v.weeks} terminach` : 'wolne w tym terminie'}</p>` : '';
    $('#evSave', m.el).disabled = !!hits.length;
  };
  f.addEventListener('input', check);
  f.addEventListener('change', check);
  check();
  f.addEventListener('submit', e => {
    e.preventDefault();
    const v = val();
    if (v.type === 'match' && !v.opp) return toast('Wpisz rywala', 'alert');
    if (v.type === 'other' && !v.title) return toast('Nazwij wydarzenie', 'alert');
    const series = v.weeks > 1 ? uid('s') : null;
    const ids = mutate(d => {
      const out = [];
      for (let k = 0; k < v.weeks; k++) {
        const base = { id: uid('e'), team: v.team, start: addDays(v.start, k * 7), end: addDays(v.end, k * 7), fac: v.fac, att: {}, absences: {}, rpe: {} };
        if (v.type === 'training') d.events.push({ ...base, type: 'training', title: v.fac.includes('gym') ? 'Trening motoryczny' : 'Trening', series, plan: null, eval: null });
        else if (v.type === 'match') d.events.push({ ...base, type: 'match', opp: v.opp, home: v.home, place: v.home ? 'Stadion Iskry, ' + CLUB.addr : v.place || 'do ustalenia', comp: team(v.team).comp, fest: !!team(v.team).fest, meet: fmtTime(v.start - 45 * MIN), title: team(v.team).fest ? `Festiwal: ${v.opp}` : v.home ? `${CLUB.short} – ${v.opp}` : `${v.opp} – ${CLUB.short}`, callup: {}, callupAt: null, live: null, stats: {} });
        else d.events.push({ ...base, type: 'other', title: v.title, desc: '' });
        out.push(d.events[d.events.length - 1].id);
      }
      d.events.sort((a, b) => a.start - b.start);
      const parents = [...new Set(d.players.filter(p => p.team === v.team).map(p => p.parent))];
      parents.forEach(pid => addNote(d, pid, { title: 'Nowe w kalendarzu', body: `${team(v.team).cat}: ${v.type === 'match' ? 'mecz z ' + v.opp : v.type === 'training' ? 'trening' : v.title} — ${fmtDay(v.start)} ${fmtTime(v.start)}${v.weeks > 1 ? ` (co tydzień, ${v.weeks}×)` : ''}`, link: `#/wydarzenie/${out[0]}`, icon: 'cal' }));
      return out;
    });
    m.close();
    toast(v.weeks > 1 ? `Dodano ${v.weeks} treningów cyklicznych` : 'Wydarzenie dodane — rodzice dostali powiadomienie');
    location.hash = `#/wydarzenie/${ids[0]}`;
  });
}

// ---------- event page ----------
function eventView(id, q) {
  const e = eventById(id);
  if (!e) { app.innerHTML = `<div class="page"><div class="empty"><p>Nie ma takiego wydarzenia.</p><a class="btn btn--primary" href="#/kalendarz">Kalendarz</a></div></div>`; return; }
  if (isParent()) return parentEvent(e);
  const t = e.team === 'all' ? null : team(e.team);
  const tabs = e.type === 'training'
    ? [['att', 'Obecność'], ['plan', 'Konspekt'], ['eval', 'Ewaluacja'], ...(t?.load ? [['rpe', 'Obciążenie (RPE)']] : [])]
    : e.type === 'match' ? [['call', 'Powołania', Object.values(e.callup).filter(v => v === 'pending').length || ''], ['live', e.fest ? 'Festiwal' : 'Relacja i wynik'], ...(t?.load ? [['rpe', 'Obciążenie (RPE)']] : [])]
      : [['info', 'Szczegóły']];
  const tab = tabs.some(x => x[0] === q.get('t')) ? q.get('t') : tabs[0][0];
  const edit = e.team !== 'all' && canEditTeam(e.team);
  const where = e.type === 'match' ? (e.home ? `${facNames(e.fac)} · Stadion Iskry` : e.place) : facNames(e.fac);

  app.innerHTML = `<div class="page">
    <a class="back" href="#/kalendarz">${ic('back')} Kalendarz</a>
    ${pageHead(`${teamTag(e.team)} ${e.team === 'all' ? 'Cały klub' : esc(t.name)} · ${evTypeLabel(e)}${e.comp ? ' · ' + esc(e.comp) : ''}`, esc(e.title),
      e.type === 'training' && e.plan ? `<a class="btn btn--ghost" href="#/konspekt/${e.plan}">${ic('book')} Konspekt</a>` : '',
      `${ic('cal', 'i--sm')} ${fmtLong(e.start)} · ${fmtRange(e.start, e.end)} &nbsp; ${ic('pin', 'i--sm')} ${esc(where || '—')}${e.meet ? ` &nbsp; ${ic('clock', 'i--sm')} zbiórka ${e.meet}` : ''}${!edit ? ' &nbsp; ' + badge('podgląd', 'info') : ''}`)}
    ${tabs.length > 1 ? tabsBar(tabs, tab, `#/wydarzenie/${e.id}`) : ''}
    <div id="evBody"></div></div>`;
  const body = $('#evBody');
  ({ att: tabAttendance, plan: tabPlan, eval: tabEval, rpe: tabRpe, call: tabCallup, live: tabLive, info: tabInfo })[tab](body, e, edit);
}

function tabInfo(body, e) {
  body.innerHTML = card('Opis', `<p>${esc(e.desc || 'Brak opisu.')}</p>`);
}

function playerLine(p, extra = '') {
  const inj = activeInjury(p), med = medStatus(p);
  return `<span class="pl"><span class="pl__n">${p.num}</span><span class="pl__t"><a href="#/zawodnik/${p.id}">${esc(pname(p))}</a>
    <small>${POS[p.pos]}${inj ? ` · <span class="${INJ[inj.status].cls}-t">${ic('bandage', 'i--xs')} ${INJ[inj.status].label.toLowerCase()}</span>` : ''}${med.cls === 'bad' ? ` · <span class="bad-t">${ic('steth', 'i--xs')} badanie nieważne</span>` : ''}${extra}</small></span></span>`;
}

function tabAttendance(body, e, edit) {
  const players = teamPlayers(e.team), now = Date.now();
  const canTake = sameDay(e.start, now) || e.start < now;
  const state = { ...e.att };
  if (!Object.keys(e.att).length) players.forEach(p => {
    if (e.absences[p.id]) state[p.id] = 'excused';
    else if (activeInjury(p)?.status === 'out') state[p.id] = 'excused';
  });
  const saved = Object.keys(e.att).length;
  const draw = () => {
    const counts = Object.fromEntries(Object.keys(ATT).map(k => [k, players.filter(p => state[p.id] === k).length]));
    const unset = players.filter(p => !state[p.id]).length;
    body.innerHTML = `<section class="card">
      <header class="card__h"><h2>Lista obecności <small>${players.length} zawodników</small></h2>
        ${edit && canTake ? `<button type="button" class="btn btn--ghost btn--sm" id="allIn">${ic('check')} Pozostali obecni</button>` : ''}</header>
      ${!canTake ? `<p class="callout callout--info">${ic('info')} Obecność sprawdzisz w dniu zajęć. Poniżej nieobecności zgłoszone przez rodziców.</p>` : ''}
      <div class="att-sum">${Object.entries(ATT).map(([k, a]) => `<span class="badge badge--${a.cls}">${a.label}: ${counts[k]}</span>`).join('')}${unset && canTake ? `<span class="badge">bez statusu: ${unset}</span>` : ''}</div>
      <ul class="att">${players.map(p => {
        const ab = e.absences[p.id];
        return `<li class="att__r ${state[p.id] ? 'is-' + state[p.id] : ''}">${playerLine(p, ab ? ` · <span class="info-t">${ic('user', 'i--xs')} ${esc(ab.reason)} — zgłosił(a) ${esc(personName(ab.by))}</span>` : '')}
          ${canTake ? `<span class="attbtns" role="radiogroup" aria-label="Obecność: ${esc(pname(p))}">${Object.entries(ATT).map(([k, a]) => `<button type="button" role="radio" aria-checked="${state[p.id] === k}" class="attb attb--${a.cls} ${state[p.id] === k ? 'is-on' : ''}" data-p="${p.id}" data-v="${k}" title="${a.label}" ${edit ? '' : 'disabled'}>${a.short}</button>`).join('')}</span>` : ''}
        </li>`;
      }).join('')}</ul>
      ${edit && canTake ? `<footer class="savebar"><span class="savebar__s" id="attStatus">${saved ? `${ic('check')} Zapisano · ${Object.values(e.att).filter(v => v === 'present' || v === 'late').length}/${saved} obecnych` : 'Niezapisane'}</span><button type="button" class="btn btn--primary btn--lg" id="attSave">${ic('check')} Zapisz obecność</button></footer>` : ''}
    </section>`;
    $$('.attb', body).forEach(b => b.addEventListener('click', () => { state[b.dataset.p] = b.dataset.v; draw(); $('#attStatus') && ($('#attStatus').textContent = 'Zmiany niezapisane'); }));
    $('#allIn', body)?.addEventListener('click', () => { players.forEach(p => { if (!state[p.id]) state[p.id] = 'present'; }); draw(); });
    $('#attSave', body)?.addEventListener('click', async () => {
      const unsetP = players.filter(p => !state[p.id]);
      if (unsetP.length) {
        if (!(await confirmBox({ title: `${nOf(unsetP.length, 'zawodnik', 'zawodników', 'zawodników')} bez statusu`, body: `${unsetP.map(pname).join(', ')} — oznaczyć jako nieobecnych?`, ok: 'Oznacz jako nieobecnych' }))) return;
        unsetP.forEach(p => { state[p.id] = 'absent'; });
      }
      mutate(d => { d.events.find(x => x.id === e.id).att = { ...state }; });
      e.att = { ...state };
      draw();
      const ok = Object.values(state).filter(v => v === 'present' || v === 'late').length;
      $('#attStatus', body).innerHTML = `${ic('check')} Zapisano ${fmtTime(Date.now())} · ${ok}/${players.length} obecnych`;
      $('#attStatus', body).classList.add('is-flash');
      toast(`Obecność zapisana: ${ok}/${players.length}`);
    });
  };
  draw();
}

function tabPlan(body, e, edit) {
  const pl = e.plan ? planById(e.plan) : null;
  if (pl) {
    body.innerHTML = `<section class="card"><header class="card__h"><h2>${esc(pl.title)} <small>${esc(pl.goal)}</small></h2>
      <div class="btn-row"><a class="btn btn--ghost btn--sm" href="#/konspekt/${pl.id}">${ic('pen')} Otwórz</a>${edit ? `<button type="button" class="btn btn--ghost btn--sm" id="unlink">${ic('x')} Odepnij</button>` : ''}</div></header>
      ${planSummary(pl)}</section>`;
    $('#unlink', body)?.addEventListener('click', () => { mutate(d => { d.events.find(x => x.id === e.id).plan = null; const k = d.plans.find(x => x.id === pl.id); k.event = null; }); render(); });
    return;
  }
  const opts = db.plans.filter(k => k.team === e.team || k.shared);
  body.innerHTML = `<section class="card"><header class="card__h"><h2>Konspekt</h2></header>
    <p class="empty-s">${ic('book')} Do tego treningu nie przypięto konspektu.</p>
    ${edit ? `<div class="pick">${opts.map(k => `<button type="button" class="pick__i" data-plan="${k.id}">${teamTag(k.team)} <b>${esc(k.title)}</b><small>${esc(personName(k.author))} · ${k.blocks.length} ćwiczeń</small></button>`).join('')}</div>
      <a class="btn btn--primary" href="#/konspekt/new?event=${e.id}">${ic('plus')} Nowy konspekt do tego treningu</a>` : ''}</section>`;
  $$('[data-plan]', body).forEach(b => b.addEventListener('click', () => {
    mutate(d => { d.events.find(x => x.id === e.id).plan = b.dataset.plan; });
    toast('Konspekt przypięty do treningu');
    render();
  }));
}

function stars(name, value, label) {
  return `<fieldset class="stars"><legend>${label}</legend>${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="${name}" value="${n}" ${value === n ? 'checked' : ''}><span aria-label="${n}">${ic('star')}</span></label>`).join('')}</fieldset>`;
}

function tabEval(body, e, edit) {
  const ev = e.eval, pl = e.plan ? planById(e.plan) : null;
  const hist = db.events.filter(x => x.team === e.team && x.type === 'training' && x.eval && x.end < Date.now()).slice(-8);
  if (!isPast(e) && !sameDay(e.start, Date.now())) { body.innerHTML = card('Ewaluacja', `<p class="empty-s">${ic('clock')} Ocenisz trening po jego zakończeniu.</p>`); return; }
  body.innerHTML = `<div class="grid2"><section class="card"><header class="card__h"><h2>Jak poszło?</h2>${ev ? badge('oceniony', 'ok') : ''}</header>
    <form id="evalF" class="form">
      ${stars('real', ev?.real, 'Realizacja konspektu')}
      ${stars('eng', ev?.eng, 'Zaangażowanie zawodników')}
      ${pl ? `<fieldset class="field"><legend>Które ćwiczenia zadziałały?</legend><div class="checks checks--col">${pl.blocks.map(b => `<label class="check"><input type="checkbox" name="good" value="${b.id}" ${ev?.good?.includes(b.id) ? 'checked' : ''}><span>${esc(exById(b.ex)?.name || 'Ćwiczenie')}</span></label>`).join('')}</div></fieldset>` : ''}
      <label class="field"><span>Notatka dla siebie i sztabu</span><textarea class="input" name="note" rows="3" placeholder="np. rondo za łatwe — następnym razem 2 kontakty">${esc(ev?.note || '')}</textarea></label>
      ${edit ? `<button class="btn btn--primary" type="submit">${ic('check')} Zapisz ocenę</button>` : ''}
    </form></section>
    ${card('Ostatnie treningi drużyny', hist.length ? `<ul class="bars">${hist.map(x => `<li><a href="#/wydarzenie/${x.id}?t=eval">${fmtDay(x.start)}</a>${meter(x.eval.real, 5)}<b>${x.eval.real}/5</b></li>`).join('')}</ul>
      <p class="muted small">Średnia realizacja ${num(avg(hist.map(x => x.eval.real)), 1)} · zaangażowanie ${num(avg(hist.map(x => x.eval.eng)), 1)}</p>` : '<p class="empty-s">Brak ocen.</p>')}</div>`;
  $('#evalF', body).addEventListener('submit', ev2 => {
    ev2.preventDefault();
    const fd = new FormData(ev2.target);
    if (!fd.get('real') || !fd.get('eng')) return toast('Zaznacz obie oceny gwiazdkami', 'alert');
    mutate(d => { d.events.find(x => x.id === e.id).eval = { real: +fd.get('real'), eng: +fd.get('eng'), good: fd.getAll('good'), note: fd.get('note').trim(), by: me() }; });
    toast('Ocena treningu zapisana');
    render();
  });
}

function tabRpe(body, e, edit) {
  const present = teamPlayers(e.team).filter(p => (e.type === 'match' ? e.callup[p.id] === 'yes' : ['present', 'late'].includes(e.att[p.id])));
  const mins = p => (e.type === 'match' ? e.stats?.[p.id]?.min || 60 : Math.round((e.end - e.start) / MIN));
  const state = { ...e.rpe };
  if (!present.length) { body.innerHTML = card('Obciążenie', `<p class="empty-s">${ic('info')} Najpierw zapisz obecność — RPE wpisujesz tylko obecnym.</p>`); return; }
  const draw = () => {
    body.innerHTML = `<section class="card"><header class="card__h"><h2>RPE po zajęciach <small>skala Borga 1–10 × minuty = obciążenie</small></h2></header>
      <p class="muted small">Zawodnicy wpisują RPE w aplikacji 30 minut po treningu. Tu trener uzupełnia brakujące odpowiedzi.</p>
      <ul class="att">${present.map(p => `<li class="att__r">${playerLine(p, ` · ${mins(p)} min${state[p.id] ? ` · obciążenie <b>${state[p.id] * mins(p)}</b>` : ''}`)}
        <span class="rpe" role="radiogroup" aria-label="RPE: ${esc(pname(p))}">${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `<button type="button" class="rpe__b ${state[p.id] === n ? 'is-on' : ''}" style="--h:${120 - n * 12}" data-p="${p.id}" data-v="${n}" ${edit ? '' : 'disabled'}>${n}</button>`).join('')}</span></li>`).join('')}</ul>
      ${edit ? `<footer class="savebar"><span class="savebar__s">${Object.keys(state).length}/${present.length} wpisanych</span><button class="btn btn--primary btn--lg" id="rpeSave">${ic('check')} Zapisz RPE</button></footer>` : ''}</section>`;
    $$('.rpe__b', body).forEach(b => b.addEventListener('click', () => { state[b.dataset.p] = +b.dataset.v; draw(); }));
    $('#rpeSave', body)?.addEventListener('click', () => { mutate(d => { d.events.find(x => x.id === e.id).rpe = { ...state }; }); toast('RPE zapisane — obciążenia przeliczone w module Zdrowie'); render(); });
  };
  draw();
}

// ---------- call-ups ----------
function tabCallup(body, e, edit) {
  const players = teamPlayers(e.team), sent = Object.keys(e.callup).length > 0;
  if (!sent) {
    const sel = new Set(players.filter(p => activeInjury(p)?.status !== 'out' && medStatus(p).cls !== 'bad').slice(0, 18).map(p => p.id));
    const draw = () => {
      body.innerHTML = `<section class="card"><header class="card__h"><h2>Wybierz kadrę meczową <small>${sel.size} zaznaczonych</small></h2></header>
        <ul class="att">${players.map(p => {
          const bad = medStatus(p).cls === 'bad', out = activeInjury(p)?.status === 'out';
          return `<li class="att__r"><label class="check check--row"><input type="checkbox" data-p="${p.id}" ${sel.has(p.id) ? 'checked' : ''} ${edit ? '' : 'disabled'}>${playerLine(p)}</label>${bad ? badge('nie może grać — badania', 'bad') : out ? badge('kontuzja', 'warn') : ''}</li>`;
        }).join('')}</ul>
        ${edit ? `<footer class="savebar"><span class="savebar__s">Rodzice dostaną push z prośbą o potwierdzenie</span><button class="btn btn--primary btn--lg" id="sendCall" ${sel.size ? '' : 'disabled'}>${ic('send')} Wyślij powołania (${sel.size})</button></footer>` : ''}</section>`;
      $$('[data-p]', body).forEach(c => c.addEventListener('change', () => { c.checked ? sel.add(c.dataset.p) : sel.delete(c.dataset.p); draw(); }));
      $('#sendCall', body)?.addEventListener('click', () => {
        mutate(d => {
          const ev = d.events.find(x => x.id === e.id);
          sel.forEach(pid => { ev.callup[pid] = 'pending'; });
          ev.callupAt = Date.now();
          sel.forEach(pid => { const p = d.players.find(x => x.id === pid); addNote(d, p.parent, { title: 'Powołanie na mecz', body: `${p.first} — ${ev.title}, ${fmtDay(ev.start)} ${fmtTime(ev.start)}. Potwierdź obecność.`, link: `#/wydarzenie/${ev.id}`, icon: 'flag' }); });
        });
        toast(`Powołania wysłane do ${nOf(sel.size, 'rodzica', 'rodziców', 'rodziców')}`, 'send');
        render();
      });
    };
    return draw();
  }
  const groups = { yes: [], no: [], pending: [] };
  Object.entries(e.callup).forEach(([pid, v]) => groups[v].push(player(pid)));
  const notCalled = players.filter(p => !(p.id in e.callup));
  const col = (k, title, cls) => `<section class="ccol ccol--${cls}"><h3>${title} <span>${groups[k].length}</span></h3><ul>${groups[k].map(p => `<li>${playerLine(p)}${edit ? `<span class="ccol__a">${k !== 'yes' ? `<button type="button" class="icon-btn icon-btn--sm" data-set="${p.id}:yes" title="Oznacz: będzie" aria-label="Oznacz: będzie">${ic('check')}</button>` : ''}${k !== 'no' ? `<button type="button" class="icon-btn icon-btn--sm" data-set="${p.id}:no" title="Oznacz: nie może" aria-label="Oznacz: nie może">${ic('x')}</button>` : ''}</span>` : ''}</li>`).join('') || '<li class="muted">—</li>'}</ul></section>`;
  body.innerHTML = `<section class="card"><header class="card__h"><h2>Powołania <small>wysłane ${ago(e.callupAt)}</small></h2>
      ${edit && groups.pending.length ? `<button class="btn btn--ghost btn--sm" id="remind">${ic('bell')} Przypomnij (${groups.pending.length})</button>` : ''}</header>
    <span class="callbar callbar--lg"><i class="ok" style="flex:${groups.yes.length}"></i><i class="bad" style="flex:${groups.no.length}"></i><i class="pend" style="flex:${groups.pending.length}"></i></span>
    <div class="ccols">${col('yes', 'Potwierdzeni', 'ok')}${col('pending', 'Bez odpowiedzi', 'pend')}${col('no', 'Nie mogą', 'bad')}</div>
    ${edit && notCalled.length ? `<details class="more"><summary>Dopisz do kadry (${notCalled.length})</summary><div class="pick">${notCalled.map(p => `<button type="button" class="pick__i" data-add="${p.id}">${p.num} · <b>${esc(pname(p))}</b></button>`).join('')}</div></details>` : ''}
  </section>`;
  $$('[data-set]', body).forEach(b => b.addEventListener('click', () => {
    const [pid, v] = b.dataset.set.split(':');
    mutate(d => { d.events.find(x => x.id === e.id).callup[pid] = v; });
    render();
  }));
  $$('[data-add]', body).forEach(b => b.addEventListener('click', () => {
    mutate(d => { const ev = d.events.find(x => x.id === e.id), p = d.players.find(x => x.id === b.dataset.add); ev.callup[p.id] = 'pending'; addNote(d, p.parent, { title: 'Powołanie na mecz', body: `${p.first} — ${ev.title}, ${fmtDay(ev.start)}. Potwierdź obecność.`, link: `#/wydarzenie/${ev.id}`, icon: 'flag' }); });
    render();
  }));
  $('#remind', body)?.addEventListener('click', () => {
    mutate(d => { const ev = d.events.find(x => x.id === e.id); Object.entries(ev.callup).filter(([, v]) => v === 'pending').forEach(([pid]) => { const p = d.players.find(x => x.id === pid); addNote(d, p.parent, { title: 'Przypomnienie: powołanie', body: `Prosimy o potwierdzenie — ${p.first}, ${ev.title} (${fmtDay(ev.start)}).`, link: `#/wydarzenie/${ev.id}`, icon: 'flag' }); }); });
    toast(`Przypomnienie wysłane do ${nOf(groups.pending.length, 'rodzica', 'rodziców', 'rodziców')}`, 'bell');
  });
}

// ---------- live match ----------
const HALF = e => Math.round(team(e.team).match[2] / 2);
function matchMinute(e, now = Date.now()) {
  const L = e.live;
  if (!L || !L.periodStart) return 0;
  if (L.status === 'ht') return HALF(e);
  if (L.status === 'ft') return HALF(e) * 2;
  const m = Math.floor((now - L.periodStart) / MIN) + 1 + (L.half === 2 ? HALF(e) : 0);
  return Math.min(m, L.half === 2 ? HALF(e) * 2 + 5 : HALF(e) + 3);
}
function possession(L, now = Date.now()) {
  const ms = [...(L.possMs || [0, 0])];
  if (L.possSide != null && L.status === 'live') ms[L.possSide] += now - L.possSince;
  const tot = ms[0] + ms[1];
  return tot ? Math.round((ms[0] / tot) * 100) : L.poss || 50;
}
const LIVE_LABEL = { pre: 'Przed meczem', live: 'Na żywo', ht: 'Przerwa', ft: 'Koniec' };
const LOG_ICON = { goal: 'ball', yellow: 'ycard', red: 'ycard', shot: 'bolt', corner: 'flag' };

function scoreboard(e) {
  const L = e.live || { status: 'pre', us: 0, them: 0 };
  const home = e.home, us = `<span class="sb__team"><span class="sb__crest">${crest()}</span>${CLUB.short} ${team(e.team).cat}</span>`, them = `<span class="sb__team"><span class="sb__crest sb__crest--opp">${esc(initials(e.opp))}</span>${esc(e.opp)}</span>`;
  return `<div class="sb ${L.status === 'live' ? 'is-live' : ''}">
    ${home ? us : them}
    <span class="sb__mid"><b class="sb__score">${home ? L.us : L.them}<i>:</i>${home ? L.them : L.us}</b>
      <span class="sb__st">${L.status === 'live' ? `<i class="dot"></i> <span data-minute>${matchMinute(e)}'</span> · ${L.half === 2 ? '2. połowa' : '1. połowa'}` : LIVE_LABEL[L.status]}</span></span>
    ${home ? them : us}</div>`;
}

function matchLog(e, edit) {
  const L = e.live;
  if (!L || !L.log.length) return '<p class="empty-s">Jeszcze nic się nie wydarzyło.</p>';
  return `<ol class="mlog">${[...L.log].sort((a, b) => b.min - a.min).map(x => {
    const p = x.pid ? player(x.pid) : null, a = x.assist ? player(x.assist) : null;
    const what = x.t === 'goal' ? (x.side === 'us' ? `Gol! ${p ? esc(pname(p)) : CLUB.short}${a ? ` <small>asysta: ${esc(pname(a))}</small>` : ''}` : `Gol — ${esc(e.opp)}`)
      : x.t === 'yellow' ? `Żółta kartka${p ? ' — ' + esc(pname(p)) : x.side === 'them' ? ' — rywal' : ''}` : x.t === 'red' ? `Czerwona kartka${p ? ' — ' + esc(pname(p)) : ''}`
        : x.t === 'shot' ? `Strzał — ${x.side === 'us' ? CLUB.short : esc(e.opp)}` : `Rzut rożny — ${x.side === 'us' ? CLUB.short : esc(e.opp)}`;
    return `<li class="mlog__i mlog__i--${x.t} mlog__i--${x.side}"><span class="mlog__m">${x.min}'</span>${ic(LOG_ICON[x.t])}<span>${what}</span>${edit ? `<button type="button" class="icon-btn icon-btn--sm" data-del="${x.id}" aria-label="Usuń wpis">${ic('trash')}</button>` : ''}</li>`;
  }).join('')}</ol>`;
}

let liveTimer = null;
function tabLive(body, e, edit) {
  clearInterval(liveTimer);
  if (e.fest) {
    const yes = Object.entries(e.callup).filter(([, v]) => v === 'yes').map(([pid]) => player(pid));
    body.innerHTML = card('Festiwal piłkarski', `<p class="callout callout--info">${ic('info')} W kategorii ${team(e.team).cat} nie prowadzimy wyników ani tabel — liczy się gra i radość. Zapisujemy tylko udział.</p>
      <p><b>Grają (${yes.length}):</b> ${yes.map(p => esc(pname(p))).join(', ') || '—'}</p>`);
    return;
  }
  const L = e.live || { status: 'pre', us: 0, them: 0, log: [], shots: [0, 0], corners: [0, 0], possMs: [0, 0] };
  const squad = Object.entries(e.callup).filter(([, v]) => v === 'yes').map(([pid]) => player(pid));
  const poss = possession(L);
  const stats = squad.map(p => ({ p, g: L.log.filter(x => x.t === 'goal' && x.pid === p.id).length, a: L.log.filter(x => x.t === 'goal' && x.assist === p.id).length, y: L.log.filter(x => x.t === 'yellow' && x.pid === p.id).length, min: e.stats?.[p.id]?.min ?? (L.status === 'ft' ? HALF(e) * 2 : null) }));

  body.innerHTML = `<section class="card card--live">
    ${scoreboard(e)}
    ${edit && L.status !== 'ft' ? `<div class="mctl">
      ${L.status === 'pre' ? `<button class="btn btn--lime btn--lg" data-st="start">${ic('play')} Rozpocznij mecz</button><small class="muted">W demo relację można zacząć przed terminem.</small>` : ''}
      ${L.status === 'live' && L.half !== 2 ? `<button class="btn btn--ghost" data-st="ht">${ic('pause')} Przerwa</button>` : ''}
      ${L.status === 'ht' ? `<button class="btn btn--lime" data-st="h2">${ic('play')} 2. połowa</button>` : ''}
      ${L.status === 'live' && L.half === 2 ? `<button class="btn btn--ghost" data-st="ft">${ic('stop')} Koniec meczu</button>` : ''}
    </div>
    ${L.status === 'live' ? `<div class="mbtns">
      <button class="mbtn mbtn--us" data-ev="goal:us">${ic('ball')}<b>Gol</b><small>${CLUB.short}</small></button>
      <button class="mbtn" data-ev="shot:us">${ic('bolt')}<b>Strzał</b><small>${CLUB.short} · ${L.shots[0]}</small></button>
      <button class="mbtn" data-ev="corner:us">${ic('flag')}<b>Rożny</b><small>${CLUB.short} · ${L.corners[0]}</small></button>
      <button class="mbtn" data-ev="yellow:us">${ic('ycard')}<b>Kartka</b><small>${CLUB.short}</small></button>
      <button class="mbtn mbtn--them" data-ev="goal:them">${ic('ball')}<b>Gol</b><small>rywal</small></button>
      <button class="mbtn" data-ev="shot:them">${ic('bolt')}<b>Strzał</b><small>rywal · ${L.shots[1]}</small></button>
      <button class="mbtn" data-ev="corner:them">${ic('flag')}<b>Rożny</b><small>rywal · ${L.corners[1]}</small></button>
      <div class="poss"><span class="poss__l">Przy piłce</span><div class="seg"><button class="seg__b ${L.possSide === 0 ? 'is-on' : ''}" data-poss="0">${CLUB.short}</button><button class="seg__b ${L.possSide === 1 ? 'is-on' : ''}" data-poss="1">Rywal</button></div></div>
    </div>` : ''}` : ''}
    <div class="mstats">
      <div><span>Posiadanie</span><span class="split"><i style="width:${poss}%"></i></span><b data-poss-v>${poss}% : ${100 - poss}%</b></div>
      <div><span>Strzały</span><b>${L.shots?.[0] ?? 0} : ${L.shots?.[1] ?? 0}</b></div>
      <div><span>Rożne</span><b>${L.corners?.[0] ?? 0} : ${L.corners?.[1] ?? 0}</b></div>
    </div>
  </section>
  <div class="grid2">
    ${card('Przebieg meczu', matchLog(e, edit && L.status !== 'pre'))}
    ${card('Zawodnicy', squad.length ? `<table class="tbl"><thead><tr><th>Zawodnik</th><th>Min</th><th>${ic('ball', 'i--xs')}</th><th>A</th><th>${ic('ycard', 'i--xs')}</th></tr></thead><tbody>${stats.map(s => `<tr><td>${s.p.num} · ${esc(pname(s.p))}</td><td>${s.min ?? '—'}</td><td>${s.g || ''}</td><td>${s.a || ''}</td><td>${s.y ? '🟨' : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-s">Najpierw potwierdzone powołania.</p>')}
  </div>`;

  const save = fn => { mutate(d => { const ev = d.events.find(x => x.id === e.id); ev.live = ev.live || JSON.parse(JSON.stringify(L)); fn(ev.live, ev, d); }); render(); };
  $$('[data-st]', body).forEach(b => b.addEventListener('click', () => save((l, ev, d) => {
    const now = Date.now(), st = b.dataset.st;
    const stopPoss = () => { if (l.possSide != null) { l.possMs[l.possSide] += now - l.possSince; l.possSince = now; } };
    if (st === 'start') Object.assign(l, { status: 'live', half: 1, periodStart: now, startedAt: now, possSide: null, possMs: [0, 0] });
    if (st === 'ht') { stopPoss(); l.status = 'ht'; }
    if (st === 'h2') { Object.assign(l, { status: 'live', half: 2, periodStart: now, possSince: now }); }
    if (st === 'ft') {
      stopPoss(); l.status = 'ft'; l.possSide = null;
      Object.entries(ev.callup).filter(([, v]) => v === 'yes').forEach(([pid]) => { ev.stats[pid] = ev.stats[pid] || { min: HALF(ev) * 2 }; });
    }
    if (st !== 'ht') {
      const parents = [...new Set(Object.keys(ev.callup).map(pid => d.players.find(p => p.id === pid)?.parent).filter(Boolean))];
      const msg = st === 'start' ? 'Mecz się zaczął — śledź wynik na żywo' : st === 'ft' ? `Koniec meczu: ${ev.home ? `${l.us}:${l.them}` : `${l.them}:${l.us}`}` : '2. połowa';
      if (st !== 'h2') parents.forEach(pid => addNote(d, pid, { title: ev.title, body: msg, link: `#/wydarzenie/${ev.id}?t=live`, icon: 'bolt' }));
    }
  })));
  $$('[data-poss]', body).forEach(b => b.addEventListener('click', () => save(l => {
    const now = Date.now(), side = +b.dataset.poss;
    if (l.possSide != null) l.possMs[l.possSide] += now - l.possSince;
    l.possSide = side; l.possSince = now;
  })));
  $$('[data-ev]', body).forEach(b => b.addEventListener('click', async () => {
    const [t, side] = b.dataset.ev.split(':'), min = matchMinute(e);
    if (t === 'shot' || t === 'corner') return save(l => { (t === 'shot' ? l.shots : l.corners)[side === 'us' ? 0 : 1]++; l.log.push({ id: uid('g'), min, t, side }); });
    if (side === 'them') return save((l, ev) => { if (t === 'goal') { l.them++; l.shots[1]++; } l.log.push({ id: uid('g'), min, t, side }); });
    const pick = await pickScorer(squad, t);
    if (!pick) return;
    save((l, ev, d) => {
      if (t === 'goal') { l.us++; l.shots[0]++; }
      l.log.push({ id: uid('g'), min, t, side, pid: pick.pid, assist: pick.assist || null });
      if (t === 'goal') {
        const sc = d.players.find(p => p.id === pick.pid);
        const parents = [...new Set(Object.keys(ev.callup).map(pid => d.players.find(p => p.id === pid)?.parent).filter(Boolean))];
        parents.forEach(pid => addNote(d, pid, { title: `Gol! ${ev.home ? `${l.us}:${l.them}` : `${l.them}:${l.us}`}`, body: `${min}' ${sc.first} ${sc.last} — ${ev.title}`, link: `#/wydarzenie/${ev.id}?t=live`, icon: 'ball' }));
      }
    });
  }));
  $$('[data-del]', body).forEach(b => b.addEventListener('click', () => save(l => {
    const x = l.log.find(y => y.id === b.dataset.del);
    if (x.t === 'goal') { x.side === 'us' ? l.us-- : l.them--; }
    if (x.t === 'shot') l.shots[x.side === 'us' ? 0 : 1]--;
    if (x.t === 'corner') l.corners[x.side === 'us' ? 0 : 1]--;
    l.log = l.log.filter(y => y.id !== x.id);
  })));
  if (L.status === 'live') liveTimer = setInterval(() => {
    if (!document.contains(body)) return clearInterval(liveTimer);
    const ev = eventById(e.id);
    $$('[data-minute]').forEach(x => { x.textContent = matchMinute(ev) + "'"; });
    const pv = possession(ev.live);
    $('[data-poss-v]', body) && ($('[data-poss-v]', body).textContent = `${pv}% : ${100 - pv}%`);
    $('.split i', body) && ($('.split i', body).style.width = pv + '%');
  }, 1000);
}

function pickScorer(squad, t) {
  return new Promise(resolve => {
    let out = null;
    const m = modal({
      cls: 'modal--md', label: t === 'goal' ? 'Kto strzelił?' : 'Kto dostał kartkę?', onClose: () => resolve(out),
      html: `${modalHead(t === 'goal' ? 'Kto strzelił?' : 'Kto dostał kartkę?')}<div class="mb">
        <div class="pickgrid" data-role="s">${squad.map(p => `<button type="button" class="pk" data-pid="${p.id}"><b>${p.num}</b>${esc(p.last)} ${esc(p.first[0])}.</button>`).join('')}</div>
        ${t === 'goal' ? `<p class="eyebrow mt">Asysta (opcjonalnie)</p><div class="pickgrid" data-role="a"><button type="button" class="pk is-on" data-pid="">bez asysty</button>${squad.map(p => `<button type="button" class="pk" data-pid="${p.id}"><b>${p.num}</b>${esc(p.last)} ${esc(p.first[0])}.</button>`).join('')}</div>` : ''}
      </div><footer class="mf"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button type="button" class="btn btn--primary" data-ok disabled>${ic('check')} Zapisz</button></footer>`,
    });
    let s = null, a = '';
    m.el.addEventListener('click', ev => {
      const b = ev.target.closest('.pk');
      if (b) {
        const grp = b.parentElement.dataset.role;
        $$('.pk', b.parentElement).forEach(x => x.classList.toggle('is-on', x === b));
        if (grp === 's') s = b.dataset.pid; else a = b.dataset.pid;
        $('[data-ok]', m.el).disabled = !s;
      }
      if (ev.target.closest('[data-ok]') && s) { out = { pid: s, assist: a && a !== s ? a : null }; m.close(); }
    });
  });
}

// ---------- parent: event page ----------
function parentEvent(e) {
  const kids = myKids().filter(k => k.team === e.team || e.team === 'all'), all = myKids(), now = Date.now();
  const pl = e.plan ? planById(e.plan) : null;
  app.innerHTML = `<div class="pp">
    <a class="back" href="#/kalendarz">${ic('back')} Kalendarz</a>
    <p class="eyebrow">${teamTag(e.team)} ${evTypeLabel(e)}</p>
    <h1 class="pp__title">${esc(e.title)}</h1>
    <ul class="facts"><li>${ic('cal')} ${fmtLong(e.start)}</li><li>${ic('clock')} ${fmtRange(e.start, e.end)}${e.meet ? ` · zbiórka ${e.meet}` : ''}</li><li>${ic('pin')} ${esc(e.type === 'match' && !e.home ? e.place : (facNames(e.fac) || '') + ' · ' + CLUB.addr)}</li>
      ${e.type === 'match' ? `<li>${ic('shield')} Strój: komplet meczowy, ochraniacze, bidon</li>` : ''}${pl ? `<li>${ic('book')} Temat: ${esc(pl.goal)}</li>` : ''}</ul>
    ${e.type === 'match' && (e.live || e.fest) ? `<div class="pp__sec" id="pLive"></div>` : ''}
    ${kids.map(k => {
      const i = all.indexOf(k), ab = e.absences[k.id], call = e.callup?.[k.id], att = e.att[k.id];
      let inner = '';
      if (e.type === 'match' && call) {
        inner = call === 'pending' ? `<p>Powołanie czeka na odpowiedź.</p><div class="todo__a"><button class="btn btn--primary btn--xl" data-callup="${e.id}:${k.id}:yes">${ic('check')} Będzie</button><button class="btn btn--ghost btn--xl" data-callup="${e.id}:${k.id}:no">${ic('x')} Nie może</button></div>`
          : `<p>${call === 'yes' ? `${ic('check')} Potwierdzone — ${esc(k.first)} jest w kadrze.` : `${ic('x')} Zgłoszone, że ${esc(k.first)} nie może.`}</p>${e.start > now ? `<button class="link" data-callup="${e.id}:${k.id}:${call === 'yes' ? 'no' : 'yes'}">Zmień odpowiedź</button>` : ''}`;
      } else if (e.type === 'match') inner = '<p class="muted">Bez powołania na ten mecz.</p>';
      else if (att) inner = `<p>${badge(ATT[att].label, ATT[att].cls)}</p>`;
      else if (ab) inner = `<p>${ic('check')} Nieobecność zgłoszona: <b>${esc(ab.reason)}</b> · ${ago(ab.at)}</p>${e.start > now ? `<button class="link" data-unabs="${k.id}">Cofnij zgłoszenie</button>` : ''}`;
      else if (e.start > now) inner = `<button class="btn btn--ghost btn--xl" data-abs="${k.id}">${ic('user')} Zgłoś nieobecność</button>`;
      return `<article class="kidcard" style="--c:${kidColor(k, i)}"><h2>${esc(k.first)} <small>${team(k.team).cat} · nr ${k.num}</small></h2>${inner}</article>`;
    }).join('')}
  </div>`;
  if ($('#pLive')) {
    $('#pLive').innerHTML = e.fest ? `<p class="callout callout--info">${ic('info')} Festiwal U9 — bez wyników, liczy się gra.</p>` : `${scoreboard(e)}<div class="mt">${matchLog(e, false)}</div>`;
    clearInterval(liveTimer);
    if (e.live?.status === 'live') liveTimer = setInterval(() => { if (!document.contains($('#pLive'))) return clearInterval(liveTimer); $$('[data-minute]').forEach(x => { x.textContent = matchMinute(eventById(e.id)) + "'"; }); }, 1000);
  }
  bindCallupButtons();
  $$('[data-abs]', app).forEach(b => b.addEventListener('click', () => reportAbsence(e, player(b.dataset.abs))));
  $$('[data-unabs]', app).forEach(b => b.addEventListener('click', () => {
    mutate(d => { delete d.events.find(x => x.id === e.id).absences[b.dataset.unabs]; });
    toast('Zgłoszenie cofnięte');
    render();
  }));
}

function reportAbsence(e, kid) {
  const m = modal({
    cls: 'modal--sm', label: 'Zgłoś nieobecność',
    html: `${modalHead(`Nieobecność · ${esc(kid.first)}`, `${evTypeLabel(e)} ${fmtDay(e.start)}, ${fmtTime(e.start)}`)}
      <form class="mb form" id="absF"><div class="checks checks--col">${['Choroba', 'Wyjazd rodzinny', 'Sprawdzian / szkoła', 'Wizyta u lekarza', 'Inny powód'].map((r, i) => `<label class="check check--big"><input type="radio" name="r" value="${r}" ${i ? '' : 'checked'}><span>${r}</span></label>`).join('')}</div>
      <label class="field"><span>Dodatkowa informacja dla trenera</span><input class="input" name="note" placeholder="opcjonalnie"></label></form>
      <footer class="mf"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button class="btn btn--primary btn--lg" form="absF">${ic('send')} Zgłoś</button></footer>`,
  });
  $('#absF', m.el).addEventListener('submit', ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target), reason = fd.get('r') + (fd.get('note').trim() ? ` — ${fd.get('note').trim()}` : '');
    mutate(d => {
      d.events.find(x => x.id === e.id).absences[kid.id] = { reason, by: me(), at: Date.now() };
      addNote(d, team(e.team).coach, { title: 'Zgłoszona nieobecność', body: `${pname(kid)} — ${fmtDay(e.start)} ${fmtTime(e.start)}: ${reason}`, link: `#/wydarzenie/${e.id}`, icon: 'user' });
    });
    m.close();
    toast(`Zgłoszone. Trener ${personName(team(e.team).coach).split(' ')[0]} dostał powiadomienie.`);
    render();
  });
}

// ---------- parent: agenda ----------
function parentCalendar(q) {
  const now = Date.now(), kids = myKids(), filt = sessionKid(), shown = kids.filter(k => !filt || k.id === filt);
  const past = q.get('past') === '1';
  const from = past ? addDays(startOfDay(now), -14) : startOfDay(now), to = addDays(startOfDay(now), 21);
  const evs = db.events.filter(e => e.start >= from && e.start < to && shown.some(k => k.team === e.team || e.team === 'all'));
  const byDay = {};
  evs.forEach(e => { (byDay[isoDay(e.start)] = byDay[isoDay(e.start)] || []).push(e); });
  app.innerHTML = `<div class="pp">
    <h1 class="pp__title">Kalendarz</h1>
    ${kidChips(kids, filt)}
    <div class="pp__row"><a class="link" href="#/kalendarz${past ? '' : '?past=1'}">${past ? 'Ukryj minione' : 'Pokaż 2 minione tygodnie'}</a>
      <button type="button" class="btn btn--ghost btn--sm" id="ics">${ic('download')} Do kalendarza w telefonie</button></div>
    ${Object.entries(byDay).map(([k, list]) => `<section class="pp__day ${k === isoDay(now) ? 'is-today' : ''}"><h2 class="pp__h">${relDay(fromIso(k))}${daysBetween(now, fromIso(k)) > 1 || daysBetween(now, fromIso(k)) < -1 ? '' : ` · ${fmtDay(fromIso(k))}`}</h2><div class="agenda">${list.map(e => agendaItem(e, shown)).join('')}</div></section>`).join('') || '<p class="empty-s">Brak zajęć.</p>'}
  </div>`;
  bindKidChips();
  $('#ics').addEventListener('click', () => {
    const fmt = ts => { const d = new Date(ts); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`; };
    const list = db.events.filter(e => e.start > now && shown.some(k => k.team === e.team || e.team === 'all'));
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gwizdek POC//PL', 'CALSCALE:GREGORIAN',
      ...list.flatMap(e => ['BEGIN:VEVENT', `UID:${e.id}@gwizdek.example`, `DTSTAMP:${fmt(now)}`, `DTSTART:${fmt(e.start)}`, `DTEND:${fmt(e.end)}`,
        `SUMMARY:${shown.filter(k => k.team === e.team || e.team === 'all').map(k => k.first).join(', ')}: ${e.title}`, `LOCATION:${e.type === 'match' && !e.home ? e.place : CLUB.addr}`, 'END:VEVENT']),
      'END:VCALENDAR'].join('\r\n');
    downloadFile('iskra-kalendarz.ics', ics, 'text/calendar');
    toast(`Plik z ${nOf(list.length, 'wydarzeniem', 'wydarzeniami', 'wydarzeniami')} pobrany — otwórz go w telefonie`, 'download');
  });
}

// ---------- facilities ----------
function facilitiesView(q) {
  const day = q.get('d') ? fromIso(q.get('d')) : startOfDay(Date.now());
  const H0 = 8, H1 = 22, span = (H1 - H0) * 60;
  const items = [
    ...db.events.filter(e => sameDay(e.start, day) && e.fac?.length).map(e => ({ kind: 'event', id: e.id, fac: e.fac, start: e.start, end: e.end, label: `${e.team === 'all' ? 'Klub' : team(e.team).cat} · ${e.type === 'match' ? e.opp || e.title : e.title}`, color: teamColor(e.team) })),
    ...db.reservations.filter(r => sameDay(r.start, day)).map(r => ({ kind: 'res', id: r.id, fac: r.fac, start: r.start, end: r.end, label: r.who, color: r.kind === 'int' ? '#0f7b53' : '#6b7a72', ext: r.kind !== 'int' })),
  ];
  const pos = ts => ((new Date(ts).getHours() * 60 + new Date(ts).getMinutes() - H0 * 60) / span) * 100;
  const link = d => `#/obiekty?d=${isoDay(d)}`;
  app.innerHTML = `<div class="page page--wide">
    ${pageHead('Obiekty i rezerwacje', fmtLong(day), `<div class="btn-group"><a class="btn btn--ghost btn--icon" href="${link(addDays(day, -1))}" aria-label="Poprzedni dzień">${ic('left')}</a><a class="btn btn--ghost" href="${link(Date.now())}">Dziś</a><a class="btn btn--ghost btn--icon" href="${link(addDays(day, 1))}" aria-label="Następny dzień">${ic('right')}</a></div>
      <button class="btn btn--primary" id="newRes">${ic('plus')} Rezerwacja</button>`, 'Kliknij wolne miejsce na osi, żeby zarezerwować. Nakładające się rezerwacje są blokowane.')}
    <div class="fgrid-wrap"><div class="fgrid">
      <div class="fgrid__hours"><span></span>${Array.from({ length: H1 - H0 }, (_, i) => `<span>${H0 + i}:00</span>`).join('')}</div>
      ${FACILITIES.map(f => {
        const mine = items.filter(x => x.fac.includes(f.id));
        const used = mine.reduce((a, x) => a + (x.end - x.start) / MIN, 0);
        return `<div class="frow"><div class="frow__n"><b>${f.short}</b><small>${f.surface || '&nbsp;'} · ${pct(used, span)}%</small></div>
          <div class="frow__t" data-fac="${f.id}">${Array.from({ length: H1 - H0 }, () => '<i></i>').join('')}
          ${mine.map(x => `<a class="fblock ${x.ext ? 'is-ext' : ''}" ${x.kind === 'event' ? `href="#/wydarzenie/${x.id}"` : `href="#" data-res="${x.id}"`} style="left:${pos(x.start)}%;width:${pos(x.end) - pos(x.start)}%;--c:${x.color}" title="${esc(x.label)} · ${fmtRange(x.start, x.end)}"><b>${esc(x.label)}</b><small>${fmtRange(x.start, x.end)}</small></a>`).join('')}
          ${sameDay(day, Date.now()) ? `<span class="fnow" style="left:${pos(Date.now())}%"></span>` : ''}</div></div>`;
      }).join('')}
    </div></div>
    <p class="muted small legend"><span class="lg lg--team"></span> zajęcia drużyn &nbsp; <span class="lg lg--int"></span> klubowe &nbsp; <span class="lg lg--ext"></span> wynajem i zewnętrzne</p>
  </div>`;
  $('#newRes').addEventListener('click', () => reservationModal({ day }));
  $$('.frow__t').forEach(row => row.addEventListener('click', ev => {
    if (ev.target.closest('.fblock')) return;
    const r = row.getBoundingClientRect(), m = Math.round((((ev.clientX - r.left) / r.width) * span) / 30) * 30 + H0 * 60;
    reservationModal({ day, fac: row.dataset.fac, from: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` });
  }));
  $$('[data-res]').forEach(a => a.addEventListener('click', async ev => {
    ev.preventDefault();
    const r = db.reservations.find(x => x.id === a.dataset.res);
    if (await confirmBox({ title: r.who, body: `${facNames(r.fac)} · ${fmtDay(r.start)} ${fmtRange(r.start, r.end)}. Usunąć tę rezerwację?`, ok: 'Usuń rezerwację', cancel: 'Zamknij', danger: true })) {
      mutate(d => { d.reservations = d.reservations.filter(x => x.id !== r.id); });
      toast('Rezerwacja usunięta');
      render();
    }
  }));
}

function reservationModal({ day, fac = 'hall', from = '16:00' }) {
  const [h, mm] = from.split(':').map(Number), toT = `${String(Math.min(h + 1, 21)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const m = modal({
    cls: 'modal--md', label: 'Nowa rezerwacja',
    html: `${modalHead('Nowa rezerwacja')}<form class="mb form" id="resF">
      <label class="field"><span>Dla kogo / cel</span><input class="input" name="who" required placeholder="np. Wynajem: drużyna firmowa"></label>
      <fieldset class="field"><legend>Obiekt</legend><div class="checks">${FACILITIES.map(f => `<label class="check"><input type="checkbox" name="fac" value="${f.id}" ${f.id === fac ? 'checked' : ''}><span>${f.short}</span></label>`).join('')}</div></fieldset>
      <div class="row3"><label class="field"><span>Data</span><input class="input" type="date" name="date" value="${isoDay(day)}"></label>
        <label class="field"><span>Od</span><input class="input" type="time" name="from" value="${from}" step="900"></label>
        <label class="field"><span>Do</span><input class="input" type="time" name="to" value="${toT}" step="900"></label></div>
      <div class="seg"><label class="seg__b"><input type="radio" name="kind" value="ext" checked><span>Wynajem / zewnętrzna</span></label><label class="seg__b"><input type="radio" name="kind" value="int"><span>Klubowa</span></label></div>
      <div id="resConf" aria-live="polite"></div></form>
      <footer class="mf"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button class="btn btn--primary" form="resF" id="resSave">${ic('check')} Zarezerwuj</button></footer>`,
  });
  const f = $('#resF', m.el);
  const val = () => { const fd = new FormData(f), d0 = fromIso(fd.get('date')); return { who: fd.get('who').trim(), fac: fd.getAll('fac'), start: atTime(d0, fd.get('from')), end: atTime(d0, fd.get('to')), kind: fd.get('kind') }; };
  const check = () => {
    const v = val(), hits = v.fac.length ? eventConflicts(v) : [];
    $('#resConf', m.el).innerHTML = v.end <= v.start ? `<p class="callout callout--bad">${ic('alert')} Koniec musi być po początku.</p>` : !v.fac.length ? `<p class="callout callout--info">${ic('info')} Wybierz obiekt.</p>` : hits.length ? `<div class="callout callout--bad">${ic('alert')}<div><b>Termin zajęty</b><ul>${hits.map(c => `<li>${fmtRange(c.start, c.end)} · ${facNames(c.fac)} — ${esc(c.who)}</li>`).join('')}</ul></div></div>` : `<p class="callout callout--ok">${ic('check')} Wolne</p>`;
    $('#resSave', m.el).disabled = !v.fac.length || v.end <= v.start || hits.length > 0;
  };
  f.addEventListener('input', check);
  f.addEventListener('change', check);
  check();
  f.addEventListener('submit', ev => {
    ev.preventDefault();
    const v = val();
    if (!v.who) return toast('Wpisz, dla kogo jest rezerwacja', 'alert');
    mutate(d => d.reservations.push({ id: uid('r'), ...v }));
    m.close();
    toast('Zarezerwowane');
    render();
  });
}
