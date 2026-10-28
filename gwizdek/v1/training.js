// Gwizdek v1 — training: plan list and plan editor (three phases, time budget, print / PDF), the
// exercise library with filters, the exercise page with its animated drawing, and free tactic boards.

const phaseLabel = id => PHASES.find(p => p[0] === id)[1];
const planMinutes = pl => pl.blocks.reduce((a, b) => a + (+b.min || 0), 0);
const PHASE_COLOR = { wstep: 'var(--ph1)', glowna: 'var(--ph2)', koncowa: 'var(--ph3)' };

function trainingView(q) {
  const tab = q.get('t') === 'ex' ? 'ex' : 'plans';
  app.innerHTML = `<div class="page page--wide">
    ${pageHead('Treningi', tab === 'ex' ? 'Baza ćwiczeń' : 'Konspekty', tab === 'ex'
      ? `<button class="btn btn--primary" id="newEx">${ic('plus')} Nowe ćwiczenie</button>`
      : `<a class="btn btn--ghost" href="#/tablica">${ic('board')} Tablice</a><a class="btn btn--primary" href="#/konspekt/new">${ic('plus')} Nowy konspekt</a>`)}
    ${tabsBar([['plans', 'Konspekty', db.plans.length], ['ex', 'Baza ćwiczeń', db.exercises.length]], tab, '#/treningi')}
    <div id="trBody"></div></div>`;
  if (tab === 'ex') exerciseLibrary($('#trBody'), q);
  else planList($('#trBody'), q);
  $('#newEx')?.addEventListener('click', () => exerciseModal());
}

function phaseBar(pl) {
  const tot = Math.max(planMinutes(pl), pl.dur || 0) || 1;
  return `<span class="phbar">${PHASES.map(([id, l]) => { const m = pl.blocks.filter(b => b.phase === id).reduce((a, b) => a + (+b.min || 0), 0); return m ? `<i style="width:${(m / tot) * 100}%;background:${PHASE_COLOR[id]}" title="${l}: ${m} min"></i>` : ''; }).join('')}</span>`;
}

function planList(host, q) {
  const filt = q.get('team') || (role === 'coach' ? 'mine' : 'all');
  const teams = filt === 'mine' ? myTeamIds() : filt === 'all' ? TEAMS.map(t => t.id) : [filt];
  const list = db.plans.filter(k => teams.includes(k.team)).sort((a, b) => (b.date || b.createdAt) - (a.date || a.createdAt));
  const chip = (id, label, color) => `<a class="fchip ${filt === id ? 'is-on' : ''}" href="#/treningi?team=${id}" ${color ? `style="--c:${color}"` : ''}>${color ? '<i></i>' : ''}${label}</a>`;
  host.innerHTML = `<div class="fchips">${role === 'coach' ? chip('mine', 'Moje drużyny') : ''}${chip('all', 'Wszystkie')}${TEAMS.map(t => chip(t.id, t.cat, t.color)).join('')}</div>
    <div class="plans">${list.map(k => {
      const ev = k.event ? eventById(k.event) : null, thumbs = k.blocks.slice(0, 3).map(b => exById(b.ex)).filter(Boolean);
      return `<a class="plan" href="#/konspekt/${k.id}">
        <span class="plan__thumbs">${thumbs.map(x => boardSvg(x.draw, { label: x.name })).join('')}</span>
        <span class="plan__b"><span class="plan__meta">${teamTag(k.team)} ${ev ? `${ic('cal', 'i--xs')} ${fmtDay(ev.start)}` : badge('bez terminu')} ${k.shared ? badge('w bazie klubu', 'ok') : ''}</span>
          <b>${esc(k.title)}</b><small>${esc(k.goal)}</small>
          ${phaseBar(k)}
          <small class="muted">${esc(personName(k.author))} · ${nOf(k.blocks.length, 'ćwiczenie', 'ćwiczenia', 'ćwiczeń')} · ${planMinutes(k)}/${k.dur} min</small></span></a>`;
    }).join('') || '<p class="empty-s">Brak konspektów.</p>'}</div>`;
}

function planSummary(pl) {
  return PHASES.map(([id, label]) => {
    const bl = pl.blocks.filter(b => b.phase === id);
    if (!bl.length) return '';
    return `<div class="psum"><h3 style="--c:${PHASE_COLOR[id]}">${label} <small>${bl.reduce((a, b) => a + (+b.min || 0), 0)} min</small></h3>
      ${bl.map(b => { const x = exById(b.ex); return x ? `<a class="psum__i" href="#/cwiczenie/${x.id}">${boardSvg(x.draw, { label: x.name })}<span><b>${esc(x.name)}</b><small>${b.min} min · ${esc(x.area)}${b.note ? ` · ${esc(b.note)}` : ''}</small></span></a>` : ''; }).join('')}</div>`;
  }).join('');
}

// ---------- plan editor ----------
function planEditor(id, q) {
  if (id === 'new') {
    const ev = q.get('event') ? eventById(q.get('event')) : null;
    const tid = ev?.team || myTeamIds()[0] || 'u12';
    const nid = mutate(d => {
      const k = { id: uid('k'), title: 'Nowy konspekt', team: tid, author: me(), goal: '', dur: ev ? Math.round((ev.end - ev.start) / MIN) : 90, kit: 'piłki, pachołki, znaczniki', shared: false, createdAt: Date.now(), blocks: [], event: ev?.id || null, date: ev?.start || null };
      d.plans.push(k);
      if (ev) d.events.find(x => x.id === ev.id).plan = k.id;
      return k.id;
    });
    location.replace(`#/konspekt/${nid}`);
    return;
  }
  const pl = planById(id);
  if (!pl) { app.innerHTML = `<div class="page"><div class="empty"><p>Nie ma takiego konspektu.</p><a class="btn btn--primary" href="#/treningi">Konspekty</a></div></div>`; return; }
  const edit = pl.author === me() || isCoord();
  const tr = db.events.filter(e => e.team === pl.team && e.type === 'training' && (e.start > Date.now() - 2 * DAY || e.id === pl.event)).slice(0, 14);
  const dis = edit ? '' : 'disabled';

  app.innerHTML = `<div class="page">
    <a class="back" href="#/treningi">${ic('back')} Konspekty</a>
    <header class="ph"><div class="ph__t grow"><p class="eyebrow">${teamTag(pl.team)} Konspekt · ${esc(personName(pl.author))}${edit ? '' : ' · ' + badge('podgląd', 'info')}</p>
      <input class="title-in" data-k="pl-title" value="${esc(pl.title)}" aria-label="Tytuł konspektu" ${dis}></div>
      <div class="ph__a"><span class="saved" id="saved" aria-live="polite"></span><button class="btn btn--ghost" id="printPl">${ic('print')} Drukuj / PDF</button>${edit ? `<button class="btn btn--ghost btn--icon" id="delPl" aria-label="Usuń konspekt">${ic('trash')}</button>` : ''}</div></header>
    <section class="card"><div class="form form--grid">
      <label class="field"><span>Drużyna</span><select class="input" data-k="pl-team" ${dis}>${TEAMS.map(t => `<option value="${t.id}" ${t.id === pl.team ? 'selected' : ''}>${t.cat} · ${t.name}</option>`).join('')}</select></label>
      <label class="field"><span>Trening</span><select class="input" data-k="pl-event" ${dis}><option value="">— bez terminu —</option>${tr.map(e => `<option value="${e.id}" ${e.id === pl.event ? 'selected' : ''}>${fmtDay(e.start)} ${fmtRange(e.start, e.end)}${e.plan && e.plan !== pl.id ? ' (ma konspekt)' : ''}</option>`).join('')}</select></label>
      <label class="field"><span>Czas zajęć</span><select class="input" data-k="pl-dur" ${dis}>${[45, 60, 75, 90, 105, 120].map(n => `<option ${n === pl.dur ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field field--wide"><span>Cel główny</span><input class="input" data-k="pl-goal" value="${esc(pl.goal)}" placeholder="np. utrzymanie piłki pod presją" ${dis}></label>
      <label class="field field--wide"><span>Środki treningowe</span><input class="input" data-k="pl-kit" value="${esc(pl.kit)}" ${dis}></label>
      <label class="check field--wide"><input type="checkbox" data-k="pl-shared" ${pl.shared ? 'checked' : ''} ${dis}><span>Udostępnij w bazie klubu — inni trenerzy mogą go użyć, koordynator widzi go przy certyfikacji PZPN</span></label>
    </div></section>
    <div class="timebar" id="timebar"></div>
    ${PHASES.map(([ph, label]) => `<section class="card phase" style="--c:${PHASE_COLOR[ph]}"><header class="card__h"><h2><i class="phase__dot"></i>${label} <small data-phmin="${ph}"></small></h2>
      ${edit ? `<button class="btn btn--ghost btn--sm" data-add="${ph}">${ic('plus')} Ćwiczenie</button>` : ''}</header>
      <ol class="blocks">${pl.blocks.filter(b => b.phase === ph).map(b => blockRow(pl, b, edit)).join('') || `<li class="blocks__none">${edit ? 'Dodaj ćwiczenie z bazy' : 'Brak ćwiczeń'}</li>`}</ol></section>`).join('')}
  </div>`;

  const upd = fn => { mutate(d => fn(d.plans.find(x => x.id === pl.id), d)); Object.assign(pl, planById(pl.id)); timebar(); flashSaved(); };
  const tmrs = {};
  const debounced = (key, fn) => { clearTimeout(tmrs[key]); tmrs[key] = setTimeout(() => upd(fn), 300); };
  const timebar = () => {
    const k = planById(pl.id), tot = planMinutes(k), diff = tot - k.dur;
    $('#timebar').innerHTML = `<span class="timebar__l"><b>${tot}</b> / ${k.dur} min</span>${phaseBar({ ...k, dur: Math.max(k.dur, tot) })}
      <span class="timebar__s ${diff > 0 ? 'bad-t' : diff < -5 ? 'warn-t' : 'ok-t'}">${diff > 0 ? `${diff} min za dużo` : diff < -5 ? `zostało ${-diff} min` : `${ic('check', 'i--xs')} mieści się`}</span>`;
    PHASES.forEach(([ph]) => { const el = $(`[data-phmin="${ph}"]`); if (el) el.textContent = `${k.blocks.filter(b => b.phase === ph).reduce((a, b) => a + (+b.min || 0), 0)} min`; });
  };
  timebar();

  $('[data-k="pl-title"]').addEventListener('input', ev => debounced('title', k => { k.title = ev.target.value.trim() || 'Bez tytułu'; }));
  $('[data-k="pl-goal"]').addEventListener('input', ev => debounced('goal', k => { k.goal = ev.target.value; }));
  $('[data-k="pl-kit"]').addEventListener('input', ev => debounced('kit', k => { k.kit = ev.target.value; }));
  $('[data-k="pl-dur"]').addEventListener('change', ev => upd(k => { k.dur = +ev.target.value; }));
  $('[data-k="pl-shared"]').addEventListener('change', ev => upd(k => { k.shared = ev.target.checked; }));
  $('[data-k="pl-team"]').addEventListener('change', ev => { upd((k, d) => { if (k.event) { d.events.find(x => x.id === k.event).plan = null; k.event = null; k.date = null; } k.team = ev.target.value; }); render(); });
  $('[data-k="pl-event"]').addEventListener('change', ev => {
    upd((k, d) => {
      if (k.event) { const old = d.events.find(x => x.id === k.event); if (old) old.plan = null; }
      k.event = ev.target.value || null;
      const ne = k.event && d.events.find(x => x.id === k.event);
      if (ne) { if (ne.plan && ne.plan !== k.id) { const other = d.plans.find(x => x.id === ne.plan); if (other) other.event = null; } ne.plan = k.id; k.date = ne.start; } else k.date = null;
    });
    toast(ev.target.value ? 'Konspekt przypięty do treningu' : 'Konspekt odpięty od treningu');
  });
  $$('[data-min]').forEach(inp => inp.addEventListener('input', () => debounced(inp.dataset.k, k => { k.blocks.find(b => b.id === inp.dataset.min).min = clamp(+inp.value || 0, 0, 120); })));
  $$('[data-note]').forEach(inp => inp.addEventListener('input', () => debounced(inp.dataset.k, k => { k.blocks.find(b => b.id === inp.dataset.note).note = inp.value; })));
  $$('[data-mv]').forEach(b => b.addEventListener('click', () => {
    const [bid, dir] = b.dataset.mv.split(':');
    upd(k => {
      const i = k.blocks.findIndex(x => x.id === bid), ph = k.blocks[i].phase;
      const same = k.blocks.map((x, j) => [x, j]).filter(([x]) => x.phase === ph).map(([, j]) => j);
      const pos = same.indexOf(i), to = same[pos + (dir === 'up' ? -1 : 1)];
      if (to == null) return;
      [k.blocks[i], k.blocks[to]] = [k.blocks[to], k.blocks[i]];
    });
    render();
  }));
  $$('[data-rm]').forEach(b => b.addEventListener('click', () => { upd(k => { k.blocks = k.blocks.filter(x => x.id !== b.dataset.rm); }); render(); }));
  $$('[data-add]').forEach(b => b.addEventListener('click', async () => {
    const picked = await pickExercises(pl, b.dataset.add);
    if (!picked.length) return;
    upd(k => picked.forEach(x => k.blocks.push({ id: uid('b'), ex: x.id, phase: b.dataset.add, min: x.min, note: '' })));
    toast(`Dodano: ${picked.map(x => x.name).join(', ')}`);
    render();
  }));
  $('#printPl').addEventListener('click', () => printPlan(planById(pl.id)));
  $('#delPl')?.addEventListener('click', async () => {
    if (!(await confirmBox({ title: 'Usunąć konspekt?', body: `„${esc(pl.title)}” zniknie z bazy${pl.event ? ' i zostanie odpięty od treningu' : ''}.`, ok: 'Usuń', danger: true }))) return;
    mutate(d => { d.plans = d.plans.filter(x => x.id !== pl.id); d.events.forEach(e => { if (e.plan === pl.id) e.plan = null; }); });
    location.hash = '#/treningi';
  });
}

function blockRow(pl, b, edit) {
  const x = exById(b.ex);
  if (!x) return '';
  const dis = edit ? '' : 'disabled';
  return `<li class="block"><a class="block__th" href="#/cwiczenie/${x.id}">${boardSvg(x.draw, { label: x.name })}</a>
    <div class="block__b"><a class="block__n" href="#/cwiczenie/${x.id}">${esc(x.name)}</a>
      <small>${esc(x.goal)} · ${esc(x.area)} · ${esc(x.players)} zaw.</small>
      <input class="input input--sm" data-note="${b.id}" data-k="note-${b.id}" value="${esc(b.note)}" placeholder="Uwagi do realizacji, np. 3 serie po 4 min" ${dis}></div>
    <label class="block__min"><input class="input input--sm" type="number" min="0" max="120" data-min="${b.id}" data-k="min-${b.id}" value="${b.min}" ${dis}><span>min</span></label>
    ${edit ? `<span class="block__a"><button class="icon-btn icon-btn--sm" data-mv="${b.id}:up" aria-label="W górę">${ic('up')}</button><button class="icon-btn icon-btn--sm" data-mv="${b.id}:down" aria-label="W dół">${ic('down')}</button><button class="icon-btn icon-btn--sm" data-rm="${b.id}" aria-label="Usuń z konspektu">${ic('x')}</button></span>` : ''}</li>`;
}

let savedTmr;
function flashSaved() {
  const el = $('#saved');
  if (!el) return;
  el.innerHTML = `${ic('check', 'i--xs')} Zapisano`;
  el.classList.add('is-on');
  clearTimeout(savedTmr);
  savedTmr = setTimeout(() => el.classList.remove('is-on'), 1600);
}

function pickExercises(pl, phase) {
  return new Promise(resolve => {
    const cat = team(pl.team).cat, chosen = new Set();
    let out = [];
    const m = modal({
      cls: 'modal--lg', label: 'Wybierz ćwiczenia', onClose: () => resolve(out),
      html: `${modalHead(`Dodaj do: ${phaseLabel(phase).toLowerCase()}`, `Pokazujemy ćwiczenia dla ${cat}; odznacz filtr, żeby zobaczyć wszystkie`)}
        <div class="mb"><div class="fbar"><label class="search">${ic('search')}<input class="input" placeholder="Szukaj w bazie" id="pkQ"></label>
          <label class="check"><input type="checkbox" id="pkAge" checked><span>Tylko ${cat}</span></label><label class="check"><input type="checkbox" id="pkPh" checked><span>Tylko ${phaseLabel(phase).toLowerCase()}</span></label></div>
          <div class="exgrid exgrid--pick" id="pkList"></div></div>
        <footer class="mf"><span class="muted" id="pkN">Nic nie wybrano</span><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button type="button" class="btn btn--primary" id="pkOk" disabled>${ic('plus')} Dodaj</button></footer>`,
    });
    const draw = () => {
      const qv = norm($('#pkQ', m.el).value), age = $('#pkAge', m.el).checked, ph = $('#pkPh', m.el).checked;
      const list = db.exercises.filter(x => (!age || x.ages.includes(cat)) && (!ph || x.phase === phase) && (!qv || norm(x.name + ' ' + x.goal + ' ' + x.desc).includes(qv)));
      $('#pkList', m.el).innerHTML = list.map(x => `<button type="button" class="ex ${chosen.has(x.id) ? 'is-on' : ''}" data-x="${x.id}" aria-pressed="${chosen.has(x.id)}">${boardSvg(x.draw, { label: x.name })}<span class="ex__b"><b>${esc(x.name)}</b><small>${esc(x.goal)} · ${x.min} min · ${esc(x.players)} zaw.</small></span><i class="ex__ck">${ic('check')}</i></button>`).join('') || '<p class="empty-s">Nic nie pasuje — zmień filtry.</p>';
    };
    draw();
    ['#pkQ', '#pkAge', '#pkPh'].forEach(s => $(s, m.el).addEventListener('input', draw));
    $('#pkList', m.el).addEventListener('click', ev => {
      const b = ev.target.closest('[data-x]');
      if (!b) return;
      chosen.has(b.dataset.x) ? chosen.delete(b.dataset.x) : chosen.add(b.dataset.x);
      b.classList.toggle('is-on');
      b.setAttribute('aria-pressed', String(chosen.has(b.dataset.x)));
      $('#pkN', m.el).textContent = chosen.size ? `Wybrano: ${chosen.size}` : 'Nic nie wybrano';
      $('#pkOk', m.el).disabled = !chosen.size;
    });
    $('#pkOk', m.el).addEventListener('click', () => { out = [...chosen].map(exById); m.close(); });
    setTimeout(() => $('#pkQ', m.el)?.focus(), 200);
  });
}

function printPlan(pl) {
  const ev = pl.event ? eventById(pl.event) : null;
  const sheet = document.createElement('div');
  sheet.id = 'print';
  sheet.innerHTML = `<div class="sheet">
    <header class="sheet__h"><span class="sheet__crest">${crest()}</span><div><p>${CLUB.name} · sezon ${db.season}</p><h1>Konspekt: ${esc(pl.title)}</h1></div></header>
    <table class="sheet__meta"><tr><th>Drużyna</th><td>${teamLabel(pl.team)}</td><th>Trener</th><td>${esc(personName(pl.author))}</td></tr>
      <tr><th>Termin</th><td>${ev ? `${fmtLong(ev.start)}, ${fmtRange(ev.start, ev.end)}` : '—'}</td><th>Obiekt</th><td>${ev ? facNames(ev.fac) : '—'}</td></tr>
      <tr><th>Cel główny</th><td colspan="3">${esc(pl.goal || '—')}</td></tr>
      <tr><th>Czas</th><td>${planMinutes(pl)} / ${pl.dur} min</td><th>Środki</th><td>${esc(pl.kit)}</td></tr></table>
    ${PHASES.map(([ph, label]) => {
      const bl = pl.blocks.filter(b => b.phase === ph);
      if (!bl.length) return '';
      return `<h2>${label} · ${bl.reduce((a, b) => a + (+b.min || 0), 0)} min</h2>${bl.map((b, i) => { const x = exById(b.ex); return `<article class="sheet__ex"><div class="sheet__board">${boardSvg(x.draw, { label: x.name })}</div>
        <div><h3>${i + 1}. ${esc(x.name)} <small>${b.min} min · ${esc(x.area)} · ${esc(x.players)} zaw.</small></h3><p>${esc(x.desc)}</p>
        <p><b>Wskazówki:</b> ${x.points.map(esc).join(' · ')}</p>${b.note ? `<p><b>Uwagi:</b> ${esc(b.note)}</p>` : ''}</div></article>`; }).join('')}`;
    }).join('')}
    <footer class="sheet__f">Gwizdek · wydruk ${fmtDate(Date.now())} · układ konspektu zgodny z programem certyfikacji szkółek (część wstępna, główna, końcowa)</footer></div>`;
  document.body.append(sheet);
  document.body.classList.add('is-printing');
  const done = () => { document.body.classList.remove('is-printing'); sheet.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 500); }, 60);
}

// ---------- exercise library ----------
function exerciseLibrary(host, q) {
  host.innerHTML = `<div class="fbar">
      <label class="search">${ic('search')}<input class="input" id="exQ" placeholder="Szukaj: rondo, pressing, 1 na 1…" value="${esc(q.get('q') || '')}"></label>
      <select class="input" id="exGoal" aria-label="Cel"><option value="">Każdy cel</option>${GOALS.map(g => `<option>${g}</option>`).join('')}</select>
      <select class="input" id="exPh" aria-label="Część treningu"><option value="">Każda część</option>${PHASES.map(([id, l]) => `<option value="${id}">${l}</option>`).join('')}</select>
      <select class="input" id="exAge" aria-label="Kategoria"><option value="">Każdy wiek</option>${TEAMS.map(t => `<option>${t.cat}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="exMine"><span>Tylko moje</span></label></div>
    <p class="muted small" id="exN"></p>
    <div class="exgrid" id="exList"></div>`;
  const draw = () => {
    const qv = norm($('#exQ').value), g = $('#exGoal').value, ph = $('#exPh').value, age = $('#exAge').value, mine = $('#exMine').checked;
    const list = db.exercises.filter(x => (!qv || norm(`${x.name} ${x.goal} ${x.desc}`).includes(qv)) && (!g || x.goal === g) && (!ph || x.phase === ph) && (!age || x.ages.includes(age)) && (!mine || x.author === me()));
    $('#exN').textContent = `${nOf(list.length, 'ćwiczenie', 'ćwiczenia', 'ćwiczeń')} · autorzy: ${[...new Set(list.map(x => personName(x.author).split(' ')[0]))].join(', ') || '—'}`;
    $('#exList').innerHTML = list.map(x => `<a class="ex" href="#/cwiczenie/${x.id}">${boardSvg(x.draw, { label: x.name })}
      <span class="ex__b"><b>${esc(x.name)}</b><span class="ex__tags">${badge(esc(x.goal), 'goal')} ${badge(phaseLabel(x.phase).replace('Część ', ''))} ${x.draw.frames.length > 1 ? badge(`${ic('film', 'i--xs')} ${x.draw.frames.length}`, 'info') : ''}</span>
      <small>${x.min} min · ${esc(x.players)} zaw. · ${x.ages.join(', ')} · ${esc(personName(x.author))}</small></span></a>`).join('') || '<p class="empty-s">Nic nie pasuje do filtrów.</p>';
  };
  ['#exQ', '#exGoal', '#exPh', '#exAge', '#exMine'].forEach(s => $(s).addEventListener('input', draw));
  draw();
}

function exerciseView(id) {
  const x = exById(id);
  if (!x) { app.innerHTML = `<div class="page"><div class="empty"><p>Nie ma takiego ćwiczenia.</p><a class="btn btn--primary" href="#/treningi?t=ex">Baza ćwiczeń</a></div></div>`; return; }
  const edit = x.author === me() || isCoord();
  const usedIn = db.plans.filter(k => k.blocks.some(b => b.ex === x.id));
  app.innerHTML = `<div class="page">
    <a class="back" href="#/treningi?t=ex">${ic('back')} Baza ćwiczeń</a>
    ${pageHead(`${esc(x.goal)} · ${phaseLabel(x.phase)}`, esc(x.name), `${edit ? `<button class="btn btn--ghost" id="exDraw">${ic('pen')} Edytuj rysunek</button>` : `<button class="btn btn--ghost" id="exCopy">${ic('copy')} Kopiuj jako moje</button>`}<button class="btn btn--primary" id="exAdd">${ic('plus')} Do konspektu</button>`)}
    <div class="grid2 grid2--ex">
      <div class="col"><div id="exBoard"></div>
        <ul class="legend-b">${[...new Set(x.draw.objs.map(o => o.t))].map(t => `<li>${PIECES[t].fill ? `<i style="background:${PIECES[t].fill}"></i>` : '<i class="sq"></i>'}${PIECES[t].label}</li>`).join('')}${[...new Set(x.draw.frames.flatMap(f => f.lines.map(l => l.t)))].map(t => `<li><i class="ln ln--${t}"></i>${ARROWS[t].label}</li>`).join('')}</ul></div>
      <div class="col">
        ${card('Opis', `<p>${esc(x.desc)}</p><h3 class="h3">Wskazówki trenerskie</h3><ul class="ticks">${x.points.map(p => `<li>${ic('check', 'i--xs')} ${esc(p)}</li>`).join('')}</ul>`)}
        ${card('Organizacja', `<dl class="dl"><dt>Czas</dt><dd>${x.min} min</dd><dt>Pole</dt><dd>${esc(x.area)}</dd><dt>Zawodnicy</dt><dd>${esc(x.players)}</dd><dt>Kategorie</dt><dd>${x.ages.join(', ')}</dd><dt>Sprzęt</dt><dd>${esc(x.kit)}</dd><dt>Autor</dt><dd>${esc(personName(x.author))}</dd></dl>`)}
        ${usedIn.length ? card('Użyte w konspektach', `<ul class="feed">${usedIn.map(k => `<li><span class="feed__i">${ic('book')}</span><span><a href="#/konspekt/${k.id}">${esc(k.title)}</a> <small>${teamLabel(k.team)} · ${esc(personName(k.author))}</small></span></li>`).join('')}</ul>`) : ''}
      </div></div></div>`;
  boardPlayer($('#exBoard'), x.draw);
  $('#exDraw')?.addEventListener('click', async () => {
    const b = await editBoardModal(x.draw, `Rysunek: ${x.name}`);
    if (!b) return;
    mutate(d => { d.exercises.find(y => y.id === x.id).draw = b; });
    toast('Rysunek zapisany');
    render();
  });
  $('#exCopy')?.addEventListener('click', () => {
    const nid = mutate(d => { const c = { ...JSON.parse(JSON.stringify(x)), id: uid('ex'), name: x.name + ' (moja wersja)', author: me() }; d.exercises.push(c); return c.id; });
    toast('Skopiowano do Twoich ćwiczeń');
    location.hash = `#/cwiczenie/${nid}`;
  });
  $('#exAdd').addEventListener('click', () => addToPlanModal(x));
}

function addToPlanModal(x) {
  const mine = db.plans.filter(k => k.author === me() || isCoord());
  const m = modal({
    cls: 'modal--sm', label: 'Dodaj do konspektu',
    html: `${modalHead('Dodaj do konspektu', esc(x.name))}<form class="mb form" id="atp">
      <label class="field"><span>Konspekt</span><select class="input" name="k">${mine.map(k => `<option value="${k.id}">${team(k.team).cat} · ${esc(k.title)}</option>`).join('')}<option value="new">+ Nowy konspekt</option></select></label>
      <label class="field"><span>Część</span><select class="input" name="ph">${PHASES.map(([id, l]) => `<option value="${id}" ${id === x.phase ? 'selected' : ''}>${l}</option>`).join('')}</select></label></form>
      <footer class="mf"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button class="btn btn--primary" form="atp">${ic('plus')} Dodaj</button></footer>`,
  });
  $('#atp', m.el).addEventListener('submit', ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const kid = mutate(d => {
      let k = d.plans.find(y => y.id === fd.get('k'));
      if (!k) { k = { id: uid('k'), title: x.name, team: myTeamIds()[0] || 'u12', author: me(), goal: x.goal, dur: 90, kit: x.kit, shared: false, createdAt: Date.now(), blocks: [], event: null, date: null }; d.plans.push(k); }
      k.blocks.push({ id: uid('b'), ex: x.id, phase: fd.get('ph'), min: x.min, note: '' });
      return k.id;
    });
    m.close();
    toast('Dodano do konspektu');
    location.hash = `#/konspekt/${kid}`;
  });
}

function exerciseModal() {
  let draw = emptyBoard();
  const m = modal({
    cls: 'modal--md', label: 'Nowe ćwiczenie',
    html: `${modalHead('Nowe ćwiczenie', 'Trafi do bazy klubu z Tobą jako autorem')}<form class="mb form" id="exF">
      <label class="field"><span>Nazwa</span><input class="input" name="name" required placeholder="np. Gra 3 na 3 z bramkarzami"></label>
      <div class="row3"><label class="field"><span>Cel</span><select class="input" name="goal">${GOALS.map(g => `<option>${g}</option>`).join('')}</select></label>
        <label class="field"><span>Część</span><select class="input" name="phase">${PHASES.map(([id, l]) => `<option value="${id}" ${id === 'glowna' ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Czas (min)</span><input class="input" type="number" name="min" value="15" min="3" max="60"></label></div>
      <div class="row3"><label class="field"><span>Zawodnicy</span><input class="input" name="players" value="8–12"></label><label class="field"><span>Pole</span><input class="input" name="area" value="20 × 15 m"></label><label class="field"><span>Sprzęt</span><input class="input" name="kit" value="piłki, pachołki"></label></div>
      <fieldset class="field"><legend>Kategorie</legend><div class="checks">${TEAMS.map(t => `<label class="check"><input type="checkbox" name="ages" value="${t.cat}" ${myTeams().some(x => x.id === t.id) ? 'checked' : ''}><span>${t.cat}</span></label>`).join('')}</div></fieldset>
      <label class="field"><span>Opis</span><textarea class="input" name="desc" rows="3" required></textarea></label>
      <label class="field"><span>Wskazówki (każda w nowej linii)</span><textarea class="input" name="points" rows="3"></textarea></label>
      <div class="exdraw"><div id="exPrev"></div><button type="button" class="btn btn--ghost" id="exEd">${ic('pen')} Narysuj na tablicy</button></div></form>
      <footer class="mf"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button class="btn btn--primary" form="exF">${ic('check')} Zapisz ćwiczenie</button></footer>`,
  });
  const prev = () => { $('#exPrev', m.el).innerHTML = boardSvg(draw); };
  prev();
  $('#exEd', m.el).addEventListener('click', async () => { const b = await editBoardModal(draw, 'Rysunek ćwiczenia'); if (b) { draw = b; prev(); } });
  $('#exF', m.el).addEventListener('submit', ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const nid = mutate(d => {
      const x = { id: uid('ex'), name: fd.get('name').trim(), goal: fd.get('goal'), phase: fd.get('phase'), ages: fd.getAll('ages').length ? fd.getAll('ages') : ['U12'], players: fd.get('players'), min: +fd.get('min') || 10,
        area: fd.get('area'), author: me(), desc: fd.get('desc').trim(), points: fd.get('points').split('\n').map(s => s.trim()).filter(Boolean), kit: fd.get('kit'), draw };
      d.exercises.unshift(x);
      return x.id;
    });
    m.close();
    toast('Ćwiczenie dodane do bazy');
    location.hash = `#/cwiczenie/${nid}`;
  });
}

// ---------- free tactic boards ----------
function boardsList() {
  const list = [...db.boards].sort((a, b) => b.at - a.at);
  app.innerHTML = `<div class="page page--wide">
    ${pageHead('Treningi', 'Tablica taktyczna', `<a class="btn btn--primary" href="#/tablica/new">${ic('plus')} Nowa tablica</a>`, 'Ustawienia, stałe fragmenty i analizy do szatni. Rysunki ćwiczeń edytujesz z poziomu bazy ćwiczeń.')}
    <div class="exgrid">${list.map(b => `<a class="ex" href="#/tablica/${b.id}">${boardSvg(b, { label: b.name })}<span class="ex__b"><b>${esc(b.name)}</b><small>${b.team ? team(b.team).cat + ' · ' : ''}${esc(personName(b.author))} · ${ago(b.at)}${b.frames.length > 1 ? ` · ${nOf(b.frames.length, 'klatka', 'klatki', 'klatek')}` : ''}</small></span></a>`).join('')}
      <a class="ex ex--new" href="#/tablica/new">${ic('plus')}<b>Nowa tablica</b></a></div></div>`;
}

function boardPage(id) {
  if (id === 'new') {
    const nid = mutate(d => { const b = { id: uid('bd'), name: 'Nowa tablica', author: me(), at: Date.now(), team: myTeamIds()[0] || null, ...emptyBoard('half') }; d.boards.push(b); return b.id; });
    location.replace(`#/tablica/${nid}`);
    return;
  }
  const b = db.boards.find(x => x.id === id);
  if (!b) { location.hash = '#/tablica'; return; }
  app.innerHTML = `<div class="page page--wide">
    <a class="back" href="#/tablica">${ic('back')} Tablice</a>
    <header class="ph"><div class="ph__t grow"><p class="eyebrow">Tablica taktyczna · ${esc(personName(b.author))}</p><input class="title-in" id="bName" value="${esc(b.name)}" aria-label="Nazwa tablicy"></div>
      <div class="ph__a"><button class="btn btn--ghost" id="bShare">${ic('share')} Wyślij do szatni</button><button class="btn btn--ghost btn--icon" id="bDel" aria-label="Usuń tablicę">${ic('trash')}</button></div></header>
    <div id="bEd"></div></div>`;
  const ed = boardEditor($('#bEd'), b, {
    onSave: nb => { mutate(d => { const x = d.boards.find(y => y.id === b.id); Object.assign(x, nb, { name: $('#bName').value.trim() || 'Tablica', at: Date.now() }); }); toast('Tablica zapisana'); },
  });
  $('#bShare').addEventListener('click', () => {
    const nb = ed.get(), tid = b.team || myTeamIds()[0];
    mutate(d => {
      const x = d.boards.find(y => y.id === b.id);
      Object.assign(x, nb, { name: $('#bName').value.trim() || 'Tablica', at: Date.now() });
      d.posts.push({ id: uid('s'), scope: tid, author: me(), at: Date.now(), text: `Nowa tablica: ${x.name}. Obejrzyjcie przed treningiem.`, files: [], board: x.id, likes: [], comments: [] });
      d.players.filter(p => p.team === tid).forEach(p => addNote(d, p.parent, { title: `Szatnia ${team(tid).cat}`, body: `${personName(me())}: nowa tablica „${x.name}”`, link: '#/komunikacja?t=room', icon: 'board' }));
    });
    toast(`Tablica w szatni ${team(tid).cat} — rodzice i zawodnicy ją widzą`, 'share');
  });
  $('#bDel').addEventListener('click', async () => {
    if (!(await confirmBox({ title: 'Usunąć tablicę?', body: esc(b.name), ok: 'Usuń', danger: true }))) return;
    mutate(d => { d.boards = d.boards.filter(x => x.id !== b.id); });
    location.hash = '#/tablica';
  });
}
