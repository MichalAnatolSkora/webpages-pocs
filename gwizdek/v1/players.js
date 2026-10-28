// Gwizdek v1 — players: the list, monthly attendance table and comparison; the player card (skills
// radar, tests, health, fees) shared by staff and parents; the parent's kids page; the health module.

const lastOf = a => a[a.length - 1];
const ageLabel = p => nOf(age(p.birth), 'rok', 'lata', 'lat');
const testFmt = (t, v) => `${num(v, t.dec)} ${t.unit}`;

function playersView(q) {
  const tab = ['att', 'cmp'].includes(q.get('t')) ? q.get('t') : 'list';
  const filt = q.get('team') || (role === 'coach' ? 'mine' : 'all');
  const teams = filt === 'mine' ? myTeamIds() : filt === 'all' ? TEAMS.map(t => t.id) : [filt];
  const link = o => `#/zawodnicy?${new URLSearchParams({ t: tab, team: filt, ...o })}`;
  const chip = (id, label, color) => `<a class="fchip ${filt === id ? 'is-on' : ''}" href="${link({ team: id })}" ${color ? `style="--c:${color}"` : ''}>${color ? '<i></i>' : ''}${label}</a>`;
  app.innerHTML = `<div class="page page--wide">
    ${pageHead('Zawodnicy', tab === 'att' ? 'Frekwencja miesięczna' : tab === 'cmp' ? 'Porównanie zawodników' : 'Lista zawodników', isCoord() ? `<button class="btn btn--primary" id="addP">${ic('plus')} Zawodnik</button>` : '')}
    ${tabsBar([['list', 'Lista'], ['att', 'Frekwencja'], ['cmp', 'Porównanie']], tab, '#/zawodnicy')}
    <div class="fchips">${role === 'coach' ? chip('mine', 'Moje drużyny') : ''}${tab === 'list' ? chip('all', 'Wszystkie') : ''}${TEAMS.map(t => chip(t.id, `${t.cat} ${t.name}`, t.color)).join('')}</div>
    <div id="plBody"></div></div>`;
  const body = $('#plBody');
  if (tab === 'list') playerList(body, teams);
  if (tab === 'att') attendanceTable(body, filt === 'all' || filt === 'mine' ? teams[0] : filt, q);
  if (tab === 'cmp') compareView(body, filt === 'all' || filt === 'mine' ? teams[0] : filt, q);
  $('#addP')?.addEventListener('click', addPlayerModal);
}

function playerList(host, teams) {
  const M = ym(Date.now());
  host.innerHTML = `<div class="fbar"><label class="search">${ic('search')}<input class="input" id="plQ" placeholder="Szukaj zawodnika lub rodzica"></label><span class="muted small" id="plN"></span></div>
    <div class="tbl-wrap"><table class="tbl tbl--players"><thead><tr><th>#</th><th>Zawodnik</th><th>Drużyna</th><th>Wiek</th><th>Frekwencja 30 dni</th><th>Badania</th><th>Zdrowie</th><th>Składka ${ymShort(M)}</th><th>Rodzic</th></tr></thead><tbody id="plRows"></tbody></table></div>`;
  const draw = () => {
    const qv = norm($('#plQ').value);
    const list = db.players.filter(p => teams.includes(p.team) && (!qv || norm(`${pname(p)} ${parentRec(p.parent)?.name}`).includes(qv)))
      .sort((a, b) => TEAMS.findIndex(t => t.id === a.team) - TEAMS.findIndex(t => t.id === b.team) || a.num - b.num);
    $('#plN').textContent = nOf(list.length, 'zawodnik', 'zawodników', 'zawodników');
    $('#plRows').innerHTML = list.map(p => {
      const a = attendanceOf(p.id), med = medStatus(p), inj = activeInjury(p), ch = db.charges.find(c => c.player === p.id && c.period === M), cs = ch ? chargeStatus(ch) : null, par = parentRec(p.parent);
      return `<tr><td class="num">${p.num}</td><td><a href="#/zawodnik/${p.id}" class="strong">${esc(pname(p))}</a><small>${POS[p.pos]}</small></td><td>${teamTag(p.team)}</td><td>${age(p.birth)}</td>
        <td><span class="mcell">${meter(a.pct, 100, a.pct < 70 ? 'meter--bad' : '')}<b>${a.pct}%</b></span></td>
        <td>${badge(med.short, med.cls)}</td><td>${inj ? badge(INJ[inj.status].label, INJ[inj.status].cls) : '<span class="muted">—</span>'}</td>
        <td>${cs ? badge(CHARGE[cs].label, CHARGE[cs].cls) : ''}</td><td><small>${esc(par?.name)}<br>${esc(par?.phone)}</small></td></tr>`;
    }).join('');
  };
  $('#plQ').addEventListener('input', draw);
  draw();
}

function attendanceTable(host, tid, q) {
  const now = Date.now(), M = q.get('m') || ym(now);
  const evs = db.events.filter(e => e.team === tid && e.type === 'training' && ym(e.start) === M);
  const players = teamPlayers(tid);
  const link = m => `#/zawodnicy?t=att&team=${tid}&m=${m}`;
  host.innerHTML = `<section class="card"><header class="card__h"><h2>${teamLabel(tid)} · ${ymLabel(M)} <small>${nOf(evs.length, 'trening', 'treningi', 'treningów')}</small></h2>
      <div class="btn-group"><a class="btn btn--ghost btn--icon btn--sm" href="${link(ymAdd(M, -1))}" aria-label="Poprzedni miesiąc">${ic('left')}</a><a class="btn btn--ghost btn--icon btn--sm" href="${link(ymAdd(M, 1))}" aria-label="Następny miesiąc">${ic('right')}</a></div></header>
    <div class="tbl-wrap"><table class="tbl tbl--att"><thead><tr><th>Zawodnik</th>${evs.map(e => `<th><a href="#/wydarzenie/${e.id}">${new Date(e.start).getDate()}<small>${WD_SHORT[new Date(e.start).getDay()]}</small></a></th>`).join('')}<th>%</th></tr></thead>
    <tbody>${players.map(p => {
      const done = evs.filter(e => e.att[p.id]), ok = done.filter(e => ['present', 'late'].includes(e.att[p.id])).length;
      return `<tr><td><a href="#/zawodnik/${p.id}">${p.num} · ${esc(pname(p))}</a></td>${evs.map(e => { const v = e.att[p.id]; return `<td>${v ? `<span class="ac ac--${ATT[v].cls}" title="${ATT[v].label}">${ATT[v].short}</span>` : e.start > now ? '<span class="ac ac--fut">·</span>' : '<span class="ac">–</span>'}</td>`; }).join('')}<td class="strong">${done.length ? pct(ok, done.length) + '%' : '—'}</td></tr>`;
    }).join('')}</tbody></table></div>
    <p class="muted small legend">${Object.values(ATT).map(a => `<span class="ac ac--${a.cls}">${a.short}</span> ${a.label.toLowerCase()}`).join(' &nbsp; ')}</p></section>`;
}

function compareView(host, tid, q) {
  const players = teamPlayers(tid);
  const sel = (q.get('p') || players.slice(2, 4).map(p => p.id).join(',')).split(',').filter(id => players.some(p => p.id === id)).slice(0, 3);
  const colors = ['#2f6fe0', '#e8483b', '#0f7b53'];
  const chosen = sel.map(player);
  const tests = TESTS.filter(t => chosen.some(p => p.tests[t.id]));
  host.innerHTML = `<p class="muted small">Wybierz do trzech zawodników z ${teamLabel(tid)}.</p>
    <div class="fchips">${players.map(p => { const i = sel.indexOf(p.id); return `<a class="fchip ${i >= 0 ? 'is-on' : ''}" ${i >= 0 ? `style="--c:${colors[i]}"` : ''} href="#/zawodnicy?t=cmp&team=${tid}&p=${(i >= 0 ? sel.filter(x => x !== p.id) : [...sel, p.id].slice(-3)).join(',')}">${i >= 0 ? '<i></i>' : ''}${p.num} ${esc(p.last)}</a>`; }).join('')}</div>
    ${chosen.length ? `<div class="grid2">${card('Umiejętności (ostatnia ocena)', `${radarSvg(SKILLS, chosen.map((p, i) => ({ values: lastOf(p.skills).v, color: colors[i] })), { size: 320 })}<p class="legend-c">${chosen.map((p, i) => `<span><i style="background:${colors[i]}"></i>${esc(pname(p))}</span>`).join('')}</p>`)}
      ${card('Testy sprawnościowe (ostatni wynik)', `<table class="tbl"><thead><tr><th>Test</th>${chosen.map((p, i) => `<th style="color:${colors[i]}">${esc(p.last)}</th>`).join('')}</tr></thead><tbody>${tests.map(t => {
        const vals = chosen.map(p => p.tests[t.id] ? lastOf(p.tests[t.id])[1] : null), ok = vals.filter(v => v != null), best = t.lower ? Math.min(...ok) : Math.max(...ok);
        return `<tr><td>${t.name}</td>${vals.map(v => `<td class="${v === best ? 'best' : ''}">${v == null ? '—' : testFmt(t, v)}</td>`).join('')}</tr>`;
      }).join('')}</tbody></table><p class="muted small">Pogrubione: najlepszy wynik w zestawieniu.</p>`)}</div>` : '<p class="empty-s">Wybierz zawodników.</p>'}`;
}

// ---------- player card ----------
function playerView(id, q) {
  const p = player(id);
  const allowed = p && (!isParent() || parentRec(me()).kids.includes(p.id));
  if (!allowed) { app.innerHTML = `<div class="${isParent() ? 'pp' : 'page'}"><div class="empty"><p>Nie ma takiego zawodnika.</p></div></div>`; return; }
  const t = team(p.team), edit = !isParent() && canEditTeam(p.team);
  const tabs = [['over', 'Przegląd'], ['skills', 'Umiejętności'], ['tests', 'Testy'], ['health', 'Zdrowie'], ['fees', 'Składki']];
  const tab = tabs.some(x => x[0] === q.get('t')) ? q.get('t') : 'over';
  const par = parentRec(p.parent);
  app.innerHTML = `<div class="${isParent() ? 'pp' : 'page'}">
    <a class="back" href="${isParent() ? '#/dzieci' : '#/zawodnicy'}">${ic('back')} ${isParent() ? 'Dzieci' : 'Zawodnicy'}</a>
    <header class="phero" style="--c:${t.color}"><span class="phero__num">${p.num}</span>
      <div><p class="eyebrow">${teamTag(p.team)} ${t.name} · ${POS[p.pos]}</p><h1>${esc(pname(p))}</h1>
      <p class="muted">${ageLabel(p)} · ur. ${fmtDate(p.birth)} · noga ${p.foot} · w klubie od ${new Date(p.joined).getFullYear()}</p></div>
      ${!isParent() ? `<div class="ph__a"><a class="btn btn--ghost" href="#/komunikacja?t=msg&to=${p.parent}">${ic('chat')} Napisz do rodzica</a></div>` : ''}</header>
    ${tabsBar(tabs, tab, `#/zawodnik/${p.id}`)}
    <div id="pBody"></div></div>`;
  ({ over: pOverview, skills: pSkills, tests: pTests, health: pHealth, fees: pFees })[tab]($('#pBody'), p, edit, par);
}

function pOverview(host, p, edit, par) {
  const now = Date.now(), a = attendanceOf(p.id, 30), a90 = attendanceOf(p.id, 90), med = medStatus(p), inj = activeInjury(p);
  const matches = db.events.filter(e => e.type === 'match' && e.team === p.team && e.live?.status === 'ft' && e.stats[p.id]);
  const goals = matches.reduce((s, e) => s + e.live.log.filter(x => x.t === 'goal' && x.pid === p.id).length, 0);
  const assists = matches.reduce((s, e) => s + e.live.log.filter(x => x.t === 'goal' && x.assist === p.id).length, 0);
  const mins = matches.reduce((s, e) => s + (e.stats[p.id]?.min || 0), 0);
  const owed = overdueOf(p.id).reduce((s, c) => s + c.amount, 0);
  const last = db.events.filter(e => e.team === p.team && e.type === 'training' && e.att[p.id]).slice(-12);
  const sk = lastOf(p.skills);
  host.innerHTML = `<div class="kpis">
      ${kpi('Frekwencja · 30 dni', `${a.pct}%`, `${a.ok} z ${a.total} treningów · 90 dni: ${a90.pct}%`)}
      ${kpi('Mecze w rundzie', matches.length, `${mins} min · ${goals} ${plural(goals, 'gol', 'gole', 'goli')} · ${assists} asyst`)}
      ${kpi('Badania lekarskie', med.cls === 'ok' ? 'ważne' : med.cls === 'warn' ? `${med.d} dni` : 'nieważne', med.label, med.cls === 'ok' ? '' : 'kpi--' + med.cls)}
      ${kpi('Składki', owed ? zl(owed) : 'opłacone', owed ? 'zaległość' : 'bez zaległości', owed ? 'kpi--bad' : '')}
    </div>
    <div class="grid2"><div class="col">
      ${card('Ostatnie treningi', `<div class="dots">${last.map(e => `<a class="ac ac--${ATT[e.att[p.id]].cls}" href="${isParent() ? '#/wydarzenie/' + e.id : '#/wydarzenie/' + e.id}" title="${fmtDay(e.start)} · ${ATT[e.att[p.id]].label}">${ATT[e.att[p.id]].short}</a>`).join('')}</div>`)}
      ${inj ? card('Uraz', `<p><b>${esc(inj.type)}</b> · ${badge(INJ[inj.status].label, INJ[inj.status].cls)}</p><p class="muted">od ${fmtDay(inj.from)}${inj.back ? ` · planowany powrót ${fmtDay(inj.back)}` : ''}</p>`) : ''}
      ${sk?.note ? card('Komentarz trenera', `<blockquote class="quote">${esc(sk.note)}<cite>${esc(personName(sk.by))}, ${fmtDate(sk.d)}</cite></blockquote>`) : ''}
    </div><div class="col">
      ${card('Umiejętności', `${radarSvg(SKILLS, [...(p.skills.length > 1 ? [{ values: p.skills[p.skills.length - 2].v, color: 'var(--ink-3)', dashed: true }] : []), { values: sk.v, color: team(p.team).color }])}<p class="legend-c"><span><i style="background:${team(p.team).color}"></i>${fmtDate(sk.d)}</span>${p.skills.length > 1 ? `<span><i class="dash"></i>poprzednia ocena</span>` : ''}</p>`, { action: `<a class="link" href="#/zawodnik/${p.id}?t=skills">Szczegóły</a>` })}
      ${!isParent() ? card('Rodzic', `<p><b>${esc(par.name)}</b></p><p>${ic('phone', 'i--sm')} ${esc(par.phone)}<br>${ic('mail', 'i--sm')} ${esc(par.email)}</p>${par.kids.length > 1 ? `<p class="muted small">Rodzeństwo w klubie: ${par.kids.filter(k => k !== p.id).map(k => `<a href="#/zawodnik/${k}">${esc(pname(player(k)))}</a>`).join(', ')}</p>` : ''}`) : ''}
    </div></div>`;
}

function pSkills(host, p, edit) {
  const sk = lastOf(p.skills), prev = p.skills.length > 1 ? p.skills[p.skills.length - 2] : null, color = team(p.team).color;
  host.innerHTML = `<div class="grid2"><div class="col">${card(`Ocena z ${fmtDate(sk.d)}`, `${radarSvg(SKILLS, [...(prev ? [{ values: prev.v, color: 'var(--ink-3)', dashed: true }] : []), { values: sk.v, color }], { size: 320 })}
      <ul class="skl">${SKILLS.map((s, i) => { const dlt = prev ? sk.v[i] - prev.v[i] : 0; return `<li><span>${s}</span>${meter(sk.v[i], 5)}<b>${num(sk.v[i], 1)}</b><small class="${dlt > 0 ? 'ok-t' : dlt < 0 ? 'bad-t' : 'muted'}">${dlt > 0 ? '▲ +' + num(dlt, 1) : dlt < 0 ? '▼ ' + num(dlt, 1) : '='}</small></li>`; }).join('')}</ul>
      ${sk.note ? `<blockquote class="quote">${esc(sk.note)}<cite>${esc(personName(sk.by))}</cite></blockquote>` : ''}`)}</div>
    <div class="col">${edit ? card('Nowa ocena', `<form id="skF" class="form">${SKILLS.map((s, i) => `<label class="range"><span>${s}</span><input type="range" min="1" max="5" step="0.5" name="s${i}" value="${sk.v[i]}"><output>${num(sk.v[i], 1)}</output></label>`).join('')}
        <label class="field"><span>Komentarz dla zawodnika i rodzica</span><textarea class="input" name="note" rows="3" placeholder="Co idzie dobrze, nad czym pracujemy"></textarea></label>
        <button class="btn btn--primary">${ic('check')} Zapisz i wyślij rodzicowi</button></form>`) : ''}
      ${card('Historia ocen', `<ul class="feed">${[...p.skills].reverse().map(s => `<li><span class="feed__i">${ic('star')}</span><span><b>${num(avg(s.v), 1)}</b> średnio · ${esc(personName(s.by))}<small>${fmtFull(s.d)}</small></span></li>`).join('')}</ul>`)}</div></div>`;
  const f = $('#skF', host);
  if (!f) return;
  f.addEventListener('input', e => { if (e.target.type === 'range') e.target.nextElementSibling.textContent = num(+e.target.value, 1); });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(f);
    mutate(d => {
      const pl = d.players.find(x => x.id === p.id);
      pl.skills.push({ d: Date.now(), by: me(), v: SKILLS.map((_, i) => +fd.get('s' + i)), note: fd.get('note').trim() });
      addNote(d, pl.parent, { title: 'Nowa ocena umiejętności', body: `${pl.first}: trener ${personName(me())} dodał ocenę${fd.get('note').trim() ? ' z komentarzem' : ''}.`, link: `#/zawodnik/${pl.id}?t=skills`, icon: 'star' });
    });
    toast('Ocena zapisana — rodzic dostał powiadomienie');
    render();
  });
}

function pTests(host, p, edit) {
  const mates = teamPlayers(p.team), color = team(p.team).color;
  const tests = TESTS.filter(t => p.tests[t.id]);
  host.innerHTML = `<div class="tests">${tests.map(t => {
    const res = p.tests[t.id], last = lastOf(res), first = res[0];
    const teamAvg = res.map(([d]) => [d, avg(mates.map(m => m.tests[t.id]?.find(r => r[0] === d)?.[1]).filter(v => v != null))]);
    const ranked = mates.map(m => m.tests[t.id] ? lastOf(m.tests[t.id])[1] : null).filter(v => v != null).sort((a, b) => (t.lower ? a - b : b - a));
    const rank = ranked.indexOf(last[1]) + 1, better = t.lower ? last[1] < first[1] : last[1] > first[1];
    return `<section class="card test"><header class="card__h"><h2>${t.name}</h2><span class="test__v"><b>${testFmt(t, last[1])}</b><small class="${res.length > 1 ? (better ? 'ok-t' : 'bad-t') : 'muted'}">${res.length > 1 ? `${better ? '▲' : '▼'} ${num(Math.abs(last[1] - first[1]), t.dec)} ${t.unit} od ${MONTHS_SHORT[new Date(first[0]).getMonth()]}` : ''}</small></span></header>
      ${lineSvg([{ points: teamAvg, color: 'var(--ink-3)', dashed: true }, { points: res, color }], { fmt: v => num(v, t.dec), unit: ' ' + t.unit })}
      <p class="muted small">${rank}. miejsce w drużynie (${ranked.length}) · linia przerywana: średnia ${team(p.team).cat}${t.lower ? ' · im mniej, tym lepiej' : ''}</p></section>`;
  }).join('')}</div>
  ${edit ? card('Dodaj wynik testu', `<form class="form form--row" id="tF"><select class="input" name="t">${TESTS.filter(t => !t.min || team(p.team).n >= t.min).map(t => `<option value="${t.id}">${t.name} (${t.unit})</option>`).join('')}</select>
    <input class="input" type="date" name="d" value="${isoDay(Date.now())}"><input class="input" name="v" inputmode="decimal" placeholder="wynik" required><button class="btn btn--primary">${ic('plus')} Dodaj</button></form>`) : ''}`;
  $('#tF', host)?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target), v = parseFloat(String(fd.get('v')).replace(',', '.'));
    if (Number.isNaN(v)) return toast('Wpisz liczbę', 'alert');
    mutate(d => { const pl = d.players.find(x => x.id === p.id); (pl.tests[fd.get('t')] = pl.tests[fd.get('t')] || []).push([fromIso(fd.get('d')), v]); pl.tests[fd.get('t')].sort((a, b) => a[0] - b[0]); });
    toast('Wynik dodany');
    render();
  });
}

function pHealth(host, p, edit) {
  const med = medStatus(p), an = p.anthro, la = lastOf(an), bmi = la ? la.w / (la.h / 100) ** 2 : 0;
  const grow = an.length > 1 ? la.h - an[an.length - 2].h : 0, months = an.length > 1 ? Math.round((la.d - an[an.length - 2].d) / (30 * DAY)) : 0;
  const t = team(p.team), load = t.load ? acwr(p.id) : null;
  const w = db.wellness[p.id] || {};
  host.innerHTML = `<div class="grid2"><div class="col">
    ${card('Badanie lekarskie', `<p class="medline medline--${med.cls}">${ic('steth')} <b>${med.label}</b></p>
      ${med.cls !== 'ok' ? `<p class="muted small">Bez ważnego badania zawodnik nie może zagrać w meczu.</p>` : ''}
      ${!isParent() ? `<div class="btn-row"><button class="btn btn--ghost btn--sm" id="medNew">${ic('pen')} Wpisz nowe badanie</button>${med.cls !== 'ok' ? `<button class="btn btn--ghost btn--sm" id="medRem">${ic('bell')} Przypomnij rodzicowi</button>` : ''}</div>` : ''}`)}
    ${card('Urazy', p.injuries.length ? p.injuries.map(i => `<article class="inj"><header><b>${esc(i.type)}</b> ${badge(INJ[i.status].label, INJ[i.status].cls)}</header>
      <p class="muted small">od ${fmtDate(i.from)}${i.back ? ` · ${i.status === 'healed' ? 'wrócił(a)' : 'planowany powrót'} ${fmtDate(i.back)}` : ''} · ${esc(personName(i.by))}</p>
      <ol class="ilog">${i.log.map(([d, txt]) => `<li><time>${fmtDay(d)}</time>${esc(txt)}</li>`).join('')}</ol>
      ${edit && i.status !== 'healed' ? `<button class="btn btn--ghost btn--sm" data-heal="${i.id}">${ic('check')} Powrót do pełnego treningu</button>` : ''}</article>`).join('') : '<p class="empty-s">Bez urazów w tym sezonie.</p>', { action: edit ? `<button class="btn btn--ghost btn--sm" id="injNew">${ic('plus')} Uraz</button>` : '' })}
  </div><div class="col">
    ${card('Antropometria', la ? `<div class="kpis kpis--3">${kpi('Wzrost', `${num(la.h, 1)} cm`, grow ? `${grow > 0 ? '+' : ''}${num(grow, 1)} cm w ${months} mies.` : '')}${kpi('Waga', `${num(la.w, 1)} kg`)}${kpi('BMI', num(bmi, 1))}</div>
      ${grow >= 3 ? `<p class="callout callout--warn">${ic('ruler')} Szybki skok wzrostowy (${num(grow, 1)} cm). Uwaga na przeciążenia kolan i pięt — ogranicz skoki i sprinty.</p>` : ''}
      ${lineSvg([{ points: an.map(x => [x.d, x.h]), color: team(p.team).color }], { h: 150, fmt: v => num(v, 0), unit: ' cm' })}` : '<p class="empty-s">Brak pomiarów.</p>')}
    ${load ? card('Obciążenie treningowe', `<div class="kpis kpis--3">${kpi('ACWR', load.chronic ? num(load.ratio, 2) : '—', ACWR_LABEL[load.cls], 'kpi--' + load.cls)}${kpi('7 dni', num(load.week), 'j. obciążenia')}${kpi('Średnio / dzień', num(load.chronic), '28 dni')}</div>
      ${loadSpark(p.id, 28, true)}
      <h3 class="h3">Ankieta poranna · 7 dni</h3><table class="tbl tbl--well"><thead><tr><th></th>${Array.from({ length: 7 }, (_, i) => `<th>${WD_SHORT[new Date(addDays(Date.now(), i - 6)).getDay()]}</th>`).join('')}</tr></thead><tbody>${WELL.map(([k, l]) => `<tr><td>${l}</td>${Array.from({ length: 7 }, (_, i) => { const r = w[isoDay(addDays(Date.now(), i - 6))]; return `<td>${r ? `<span class="wv wv--${(k === 'sleep' || k === 'mood' ? r[k] : 6 - r[k]) >= 4 ? 'ok' : (k === 'sleep' || k === 'mood' ? r[k] : 6 - r[k]) >= 3 ? 'mid' : 'bad'}">${r[k]}</span>` : '<span class="muted">·</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`) : ''}
  </div></div>`;
  $('#medNew', host)?.addEventListener('click', () => medModal(p));
  $('#medRem', host)?.addEventListener('click', () => { remindMedical([p.id]); });
  $('#injNew', host)?.addEventListener('click', () => injuryModal(p.id));
  $$('[data-heal]', host).forEach(b => b.addEventListener('click', () => {
    mutate(d => { const i = d.players.find(x => x.id === p.id).injuries.find(x => x.id === b.dataset.heal); i.status = 'healed'; i.back = Date.now(); i.log.push([Date.now(), `Powrót do pełnego treningu (${personName(me())}).`]); });
    toast(`${p.first} wraca do pełnego treningu`);
    render();
  }));
}

function loadSpark(pid, days = 28, big = false) {
  const L = loadsOf(pid), today = startOfDay(Date.now()), vals = Array.from({ length: days }, (_, i) => L[isoDay(addDays(today, i - days + 1))] || 0);
  const max = Math.max(600, ...vals), w = big ? 420 : 140, h = big ? 90 : 26, bw = w / days;
  return `<svg class="spark ${big ? 'spark--big' : ''}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Obciążenie z ${days} dni">${vals.map((v, i) => `<rect x="${i * bw + 0.5}" y="${h - (v / max) * h}" width="${bw - 1.5}" height="${(v / max) * h}" rx="1" fill="${i >= days - 7 ? 'var(--pitch)' : 'var(--ink-3)'}" opacity="${i >= days - 7 ? 1 : 0.45}"><title>${fmtDay(addDays(today, i - days + 1))}: ${v}</title></rect>`).join('')}</svg>`;
}

function pFees(host, p) {
  const list = chargesOf(p.id);
  host.innerHTML = card('Składki', `<table class="tbl"><thead><tr><th>Okres</th><th>Kwota</th><th>Termin</th><th>Status</th><th>Wpłata</th></tr></thead><tbody>${list.map(c => {
    const s = chargeStatus(c);
    return `<tr><td>${ymLabel(c.period)}</td><td>${zl(c.amount)}${c.disc ? `<small>${esc(c.disc)}</small>` : ''}</td><td>${fmtDate(c.due)}</td><td>${badge(CHARGE[s].label, CHARGE[s].cls)}</td><td>${c.paid ? `${fmtDate(c.paid)} · ${PAY_METHOD[c.method]}` : ''}</td></tr>`;
  }).join('')}</tbody></table>${isParent() && list.some(c => !c.paid) ? `<a class="btn btn--primary btn--xl" href="#/skladki">${ic('phone')} Przejdź do płatności</a>` : ''}`);
}

// ---------- parent: kids ----------
function kidsView() {
  const kids = myKids();
  app.innerHTML = `<div class="pp"><h1 class="pp__title">Dzieci</h1>${kids.map((k, i) => {
    const a = attendanceOf(k.id), med = medStatus(k), sk = lastOf(k.skills), owed = overdueOf(k.id).reduce((s, c) => s + c.amount, 0);
    return `<a class="kidcard kidcard--link" href="#/zawodnik/${k.id}" style="--c:${kidColor(k, i)}"><h2>${esc(pname(k))} <small>${team(k.team).cat} ${team(k.team).name} · nr ${k.num}</small></h2>
      <ul class="kidstats"><li><b>${a.pct}%</b><small>frekwencja</small></li><li><b>${num(avg(sk.v), 1)}</b><small>ocena trenera</small></li><li><b class="${med.cls}-t">${med.cls === 'ok' ? 'ważne' : med.short}</b><small>badania</small></li><li><b class="${owed ? 'bad-t' : ''}">${owed ? zl(owed) : 'OK'}</b><small>składki</small></li></ul>
      <span class="link">Profil, oceny i testy ${ic('right', 'i--sm')}</span></a>`;
  }).join('')}</div>`;
}

// ---------- health module ----------
function healthView(q) {
  const tab = ['inj', 'load', 'grow'].includes(q.get('t')) ? q.get('t') : 'med';
  const mine = isCoord() ? TEAMS.map(t => t.id) : myTeamIds();
  const players = db.players.filter(p => mine.includes(p.team));
  const loadTeams = TEAMS.filter(t => t.load && mine.includes(t.id));
  app.innerHTML = `<div class="page page--wide">
    ${pageHead('Zdrowie', { med: 'Badania lekarskie', inj: 'Urazy i fizjoterapia', load: 'Obciążenie i samopoczucie', grow: 'Antropometria' }[tab], tab === 'inj' ? `<button class="btn btn--primary" id="injNew">${ic('plus')} Zgłoś uraz</button>` : '')}
    ${tabsBar([['med', 'Badania', players.filter(p => medStatus(p).cls !== 'ok').length || ''], ['inj', 'Urazy', players.filter(activeInjury).length || ''], ...(loadTeams.length ? [['load', 'Obciążenie']] : []), ['grow', 'Antropometria']], tab, '#/zdrowie')}
    <div id="hBody"></div></div>`;
  const body = $('#hBody');
  if (tab === 'med') {
    const list = [...players].sort((a, b) => a.medUntil - b.medUntil);
    const due = list.filter(p => medStatus(p).cls !== 'ok');
    body.innerHTML = `${due.length ? `<div class="callout callout--warn">${ic('steth')}<div><b>${nOf(due.length, 'zawodnik wymaga', 'zawodników wymaga', 'zawodników wymaga')} nowego badania</b><p>Automatyczne przypomnienia idą do rodziców 30 i 7 dni przed końcem ważności. Możesz wysłać je teraz.</p></div><button class="btn btn--primary" id="remAll">${ic('bell')} Przypomnij wszystkim (${due.length})</button></div>` : ''}
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Zawodnik</th><th>Drużyna</th><th>Ważne do</th><th>Status</th><th></th></tr></thead><tbody>${list.map(p => { const s = medStatus(p); return `<tr><td><a href="#/zawodnik/${p.id}?t=health">${esc(pname(p))}</a></td><td>${teamTag(p.team)}</td><td>${fmtDate(p.medUntil)}</td><td>${badge(s.cls === 'ok' ? 'ważne' : s.label, s.cls)}</td><td class="right"><button class="btn btn--ghost btn--sm" data-med="${p.id}">${ic('pen')} Nowe</button>${s.cls !== 'ok' ? ` <button class="btn btn--ghost btn--sm" data-rem="${p.id}">${ic('bell')}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
    $('#remAll', body)?.addEventListener('click', () => remindMedical(due.map(p => p.id)));
    $$('[data-med]', body).forEach(b => b.addEventListener('click', () => medModal(player(b.dataset.med))));
    $$('[data-rem]', body).forEach(b => b.addEventListener('click', () => remindMedical([b.dataset.rem])));
  }
  if (tab === 'inj') {
    const act = players.filter(p => p.injuries.some(i => i.status !== 'healed')), healed = players.filter(p => p.injuries.some(i => i.status === 'healed'));
    const row = (p, i) => `<tr><td><a href="#/zawodnik/${p.id}?t=health">${esc(pname(p))}</a></td><td>${teamTag(p.team)}</td><td>${esc(i.type)}</td><td>${fmtDate(i.from)}</td><td>${i.back ? fmtDate(i.back) : '—'}</td><td>${badge(INJ[i.status].label, INJ[i.status].cls)}</td><td>${i.log.length}</td></tr>`;
    body.innerHTML = `${card('Aktywne', act.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Zawodnik</th><th>Drużyna</th><th>Uraz</th><th>Od</th><th>Powrót</th><th>Status</th><th>Wpisy</th></tr></thead><tbody>${act.flatMap(p => p.injuries.filter(i => i.status !== 'healed').map(i => row(p, i))).join('')}</tbody></table></div>` : '<p class="empty-s">Nikt nie pauzuje.</p>')}
      ${card('Wyleczone w sezonie', healed.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${healed.flatMap(p => p.injuries.filter(i => i.status === 'healed').map(i => row(p, i))).join('')}</tbody></table></div>` : '<p class="empty-s">—</p>')}`;
  }
  if (tab === 'load') {
    body.innerHTML = loadTeams.map(t => {
      const rows = teamPlayers(t.id).map(p => ({ p, a: acwr(p.id), w: db.wellness[p.id]?.[isoDay(Date.now())] })).sort((x, y) => y.a.ratio - x.a.ratio);
      const filled = rows.filter(r => r.w).length;
      return card(`${teamLabel(t.id)} <small>ankietę wypełniło dziś ${filled}/${rows.length}</small>`, `<div class="tbl-wrap"><table class="tbl tbl--load"><thead><tr><th>Zawodnik</th><th>Ankieta dziś</th><th>Obciążenie 28 dni</th><th>7 dni</th><th>ACWR</th></tr></thead><tbody>${rows.map(({ p, a, w }) => {
        const sc = wellnessScore(w);
        return `<tr><td><a href="#/zawodnik/${p.id}?t=health">${esc(pname(p))}</a>${activeInjury(p) ? ` ${ic('bandage', 'i--xs')}` : ''}</td>
          <td>${w ? `<span class="wscore wscore--${sc >= 65 ? 'ok' : sc >= 45 ? 'mid' : 'bad'}">${sc}</span> <small class="muted">sen ${w.sleep} · zm. ${w.fatigue} · ból ${w.soreness}</small>` : '<span class="muted">brak</span>'}</td>
          <td>${loadSpark(p.id)}</td><td>${num(a.week)}</td><td>${a.chronic ? `<b>${num(a.ratio, 2)}</b> ${badge(ACWR_LABEL[a.cls], a.cls)}` : badge('brak danych')}</td></tr>`;
      }).join('')}</tbody></table></div>
        <p class="muted small">ACWR = średnie obciążenie z 7 dni / średnie z 28 dni (obciążenie = RPE × minuty). Bezpieczny zakres 0,8–1,3; powyżej 1,5 rośnie ryzyko urazu.</p>`);
    }).join('');
  }
  if (tab === 'grow') {
    const rows = players.filter(p => p.anthro.length).map(p => { const a = p.anthro, l = lastOf(a), pr = a.length > 1 ? a[a.length - 2] : null; return { p, l, g: pr ? l.h - pr.h : 0, bmi: l.w / (l.h / 100) ** 2 }; }).sort((a, b) => b.g - a.g);
    body.innerHTML = `<p class="muted">Sortowane po przyroście wzrostu od poprzedniego pomiaru. Powyżej 3 cm w pół roku — okres skoku wzrostowego.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Zawodnik</th><th>Drużyna</th><th>Wzrost</th><th>Przyrost</th><th>Waga</th><th>BMI</th><th>Pomiar</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.g >= 3 ? 'is-warn' : ''}"><td><a href="#/zawodnik/${r.p.id}?t=health">${esc(pname(r.p))}</a></td><td>${teamTag(r.p.team)}</td><td>${num(r.l.h, 1)} cm</td><td>${r.g >= 3 ? badge(`+${num(r.g, 1)} cm`, 'warn') : `${r.g > 0 ? '+' : ''}${num(r.g, 1)} cm`}</td><td>${num(r.l.w, 1)} kg</td><td>${num(r.bmi, 1)}</td><td>${fmtDate(r.l.d)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  $('#injNew')?.addEventListener('click', () => injuryModal());
}

function remindMedical(ids) {
  mutate(d => ids.forEach(pid => {
    const p = d.players.find(x => x.id === pid), s = medStatus(p);
    addNote(d, p.parent, { title: 'Badanie lekarskie', body: `${p.first}: ${s.label.toLowerCase()}. Prosimy o nowe zaświadczenie od lekarza sportowego.`, link: `#/zawodnik/${p.id}?t=health`, icon: 'steth' });
  }));
  toast(`Przypomnienie wysłane do ${nOf(ids.length, 'rodzica', 'rodziców', 'rodziców')} (push + e-mail)`, 'bell');
}

function medModal(p) {
  const m = modal({
    cls: 'modal--sm', label: 'Nowe badanie',
    html: `${modalHead('Nowe badanie lekarskie', esc(pname(p)))}<form class="mb form" id="medF">
      <label class="field"><span>Data badania</span><input class="input" type="date" name="d" value="${isoDay(Date.now())}"></label>
      <label class="field"><span>Ważne przez</span><select class="input" name="m"><option value="6">6 miesięcy</option><option value="12" selected>12 miesięcy</option></select></label>
      <label class="field"><span>Zaświadczenie</span><span class="file-fake">${ic('upload')} zaswiadczenie.jpg <small>(symulacja)</small></span></label></form>
      <footer class="mf"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button class="btn btn--primary" form="medF">${ic('check')} Zapisz</button></footer>`,
  });
  $('#medF', m.el).addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target), dd = new Date(fromIso(fd.get('d')));
    dd.setMonth(dd.getMonth() + +fd.get('m'));
    mutate(d => { d.players.find(x => x.id === p.id).medUntil = +dd; });
    m.close();
    toast(`Badanie ${p.first} ważne do ${fmtDate(+dd)}`);
    render();
  });
}

function injuryModal(pid) {
  const mine = isCoord() ? db.players : db.players.filter(p => myTeamIds().includes(p.team));
  const m = modal({
    cls: 'modal--md', label: 'Zgłoś uraz',
    html: `${modalHead('Zgłoś uraz', 'Fizjoterapeutka i trener dostaną kartę urazu')}<form class="mb form" id="injF">
      <label class="field"><span>Zawodnik</span><select class="input" name="p">${mine.map(p => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${team(p.team).cat} · ${esc(pname(p))}</option>`).join('')}</select></label>
      <label class="field"><span>Rodzaj urazu</span><input class="input" name="type" required list="injList" placeholder="np. skręcenie stawu skokowego"><datalist id="injList"><option>Skręcenie stawu skokowego</option><option>Stłuczenie uda</option><option>Naciągnięcie mięśnia przywodziciela</option><option>Przeciążenie kolana</option><option>Uraz palca</option></datalist></label>
      <div class="row3"><label class="field"><span>Od</span><input class="input" type="date" name="from" value="${isoDay(Date.now())}"></label><label class="field"><span>Planowany powrót</span><input class="input" type="date" name="back"></label>
        <label class="field"><span>Status</span><select class="input" name="st"><option value="out">Przerwa</option><option value="limited">Trening ograniczony</option></select></label></div>
      <label class="field"><span>Opis i zalecenia</span><textarea class="input" name="note" rows="3"></textarea></label></form>
      <footer class="mf"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button class="btn btn--primary" form="injF">${ic('check')} Zapisz kartę urazu</button></footer>`,
  });
  $('#injF', m.el).addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    mutate(d => {
      const p = d.players.find(x => x.id === fd.get('p'));
      p.injuries.push({ id: uid('i'), type: fd.get('type').trim(), from: fromIso(fd.get('from')), back: fd.get('back') ? fromIso(fd.get('back')) : null, status: fd.get('st'), by: me(), log: [[Date.now(), fd.get('note').trim() || 'Zgłoszenie urazu.']] });
      ['ola', team(p.team).coach].filter(x => x !== me()).forEach(to => addNote(d, to, { title: 'Nowa karta urazu', body: `${pname(p)} (${team(p.team).cat}): ${fd.get('type').trim()}`, link: `#/zawodnik/${p.id}?t=health`, icon: 'bandage' }));
      addNote(d, p.parent, { title: 'Uraz zgłoszony przez klub', body: `${p.first}: ${fd.get('type').trim()}. Szczegóły w profilu.`, link: `#/zawodnik/${p.id}?t=health`, icon: 'bandage' });
    });
    m.close();
    toast('Karta urazu zapisana');
    render();
  });
}

function addPlayerModal() {
  const m = modal({
    cls: 'modal--md', label: 'Nowy zawodnik',
    html: `${modalHead('Nowy zawodnik', 'Rodzic dostanie SMS z dostępem do aplikacji')}<form class="mb form" id="apF">
      <div class="row2"><label class="field"><span>Imię</span><input class="input" name="first" required></label><label class="field"><span>Nazwisko</span><input class="input" name="last" required></label></div>
      <div class="row2"><label class="field"><span>Data urodzenia</span><input class="input" type="date" name="birth" required></label><label class="field"><span>Drużyna</span><select class="input" name="team">${TEAMS.map(t => `<option value="${t.id}">${t.cat} · ${t.name}</option>`).join('')}</select></label></div>
      <div class="row2"><label class="field"><span>Rodzic</span><input class="input" name="pname" required placeholder="imię i nazwisko"></label><label class="field"><span>Telefon rodzica</span><input class="input" name="phone" required inputmode="tel" placeholder="+48 600 000 000"></label></div>
      <label class="field"><span>E-mail rodzica</span><input class="input" type="email" name="email"></label></form>
      <footer class="mf"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button class="btn btn--primary" form="apF">${ic('check')} Dodaj i wyślij dostęp</button></footer>`,
  });
  $('#apF', m.el).addEventListener('submit', e => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    const pid = mutate(d => createPlayer(d, { first: v.first.trim(), last: v.last.trim(), birth: fromIso(v.birth), team: v.team, parent: { name: v.pname.trim(), phone: v.phone.trim(), email: v.email.trim() } }));
    m.close();
    toast(`${v.first} dodany do ${team(v.team).cat}. SMS z dostępem wysłany do rodzica.`, 'sms');
    location.hash = `#/zawodnik/${pid}`;
  });
}

// Used by the add form and by recruitment ("accept" turns an application into a player without retyping)
function createPlayer(d, { first, last, birth, team: tid, parent }) {
  const id = uid('p'), parId = uid('par');
  const used = new Set(d.players.filter(p => p.team === tid).map(p => p.num));
  let n = 2;
  while (used.has(n)) n++;
  const today = startOfDay(Date.now());
  d.parents.push({ id: parId, name: parent.name, phone: parent.phone, email: parent.email || '', kids: [id] });
  d.players.push({ id, first, last, sex: 'm', birth, team: tid, num: n, pos: 'PO', foot: 'prawa', parent: parId, joined: today, medUntil: addDays(today, -1), reliab: 0.9, talent: 0,
    anthro: [], skills: [{ d: today, by: team(tid).coach, v: [3, 3, 3, 3, 3, 3], note: 'Ocena startowa — do uzupełnienia po pierwszych treningach.' }], tests: {}, injuries: [], discount: null, notes: '' });
  const t = team(tid), M = ym(Date.now());
  [M, ymAdd(M, 1)].forEach(per => d.charges.push({ id: `c-${id}-${per}`, player: id, period: per, amount: t.fee, base: t.fee, disc: null, due: Math.max(ymDate(per, 10), addDays(today, 7)), paid: null, method: null, reminded: [] }));
  return id;
}
