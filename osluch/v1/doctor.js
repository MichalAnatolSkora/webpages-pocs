// Osłuch v1 — doctor side ("Osłuch Pro"): login with 2FA, today's schedule, the AI brief before a visit, and the
// consultation room: live transcript, AI assistant, note draft, e-prescription with safety checks, e-ZLA, lab referral.

const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const canStart = v => !!scenarioOf(v) && ['booked', 'waiting', 'active'].includes(v.status);
const ptLine = pt => `${pt.female ? 'K' : 'M'}, ${lata(ageOf(pt.born))}`;
const srcChip = (src, lines) => src == null ? ''
  : typeof src === 'number' ? `<button type="button" class="src" data-src="${src}" title="Pokaż w transkrypcji">${fmtClock(lines[src]?.ts || 0)}</button>`
  : `<span class="src src--static">${src}</span>`;

// ---------- login ----------
function viewDoctorLogin() {
  if (currentDoctor()) return go(nextHash || '#/lekarz');
  app.innerHTML = `<div class="auth">
    <aside class="auth__side auth__side--pro"><div><a class="logo" href="#/lekarz" style="color:#fff">${logoMark()}<span class="logo__word">osłuch</span><span class="logo__pro" style="background:#f3b98f;color:#14211e">PRO</span></a></div>
      <div><h2>Gabinet online z asystentem, który słucha</h2><p>Mniej pisania, więcej rozmowy. Wszystkie dokumenty w jednym oknie, podpisane Twoim certyfikatem.</p>
        <ul class="auth__list"><li>${ic('spark')}Brief AI z ankiety przed każdą wizytą</li><li>${ic('ear')}Transkrypcja na żywo i szkic notatki SOAP</li><li>${ic('shield')}Kontrola alergii, interakcji i dawek</li><li>${ic('rx')}e-Recepta, e-ZLA i skierowania bez przełączania systemów</li></ul></div>
      <p style="color:#8aa39b">Dostęp tylko dla lekarzy z umową. Logowanie dwuskładnikowe.</p></aside>
    <div class="auth__main"><div class="auth__box" id="authBox"></div></div></div>`;
  step1();

  function step1(err = '') {
    $('#authBox').innerHTML = `<div><p class="eyebrow">Panel lekarza</p><h1 style="margin-top:8px">Zaloguj się do Osłuch Pro</h1></div>
      <form class="stack" id="loginForm" novalidate>
        <label class="field"><span>E-mail służbowy</span><input class="input" name="email" autocomplete="username"></label>
        <label class="field"><span>Hasło</span><input class="input" name="password" type="password" autocomplete="current-password"></label>
        ${err ? `<p class="field__err">${err}</p>` : ''}
        <button class="btn btn--primary btn--lg btn--block">Dalej</button></form>
      <div class="auth__test"><span>Konto testowe: <b>${DOCTORS[0].email}</b></span><button type="button" class="link-btn" id="fillTest">Wpisz</button></div>
      <p class="muted" style="font-size:13.5px;text-align:center"><a class="link" href="#/logowanie">Jestem pacjentem</a></p>`;
    $('#fillTest').addEventListener('click', () => { $('#loginForm').email.value = DOCTORS[0].email; $('#loginForm').password.value = DOCTOR_PASSWORD; });
    $('#loginForm').addEventListener('submit', e => {
      e.preventDefault();
      const dr = DOCTORS.find(d => d.email === e.target.email.value.trim().toLowerCase());
      if (!dr || e.target.password.value !== DOCTOR_PASSWORD) return step1('Nieprawidłowy e-mail lub hasło.');
      step2(dr);
    });
  }
  function step2(dr) {
    $('#authBox').innerHTML = `<div><p class="eyebrow">Weryfikacja dwuskładnikowa</p><h1 style="margin-top:8px">Kod z aplikacji uwierzytelniającej</h1>
      <p class="muted" style="margin-top:8px">${esc(dr.full)} · w mocku zadziała dowolne 6 cyfr.</p></div><div class="otp" id="otp"></div>
      <button type="button" class="link-btn" id="backBtn">${ic('back')}Wróć</button>`;
    otpField($('#otp'), 6, () => {
      login('doctor', dr.id);
      toast(`Zalogowano: ${dr.full}`, 'check');
      const n = nextHash; nextHash = null;
      go(n || '#/lekarz');
    });
    $('#backBtn').addEventListener('click', () => step1());
  }
}

// ---------- dashboard ----------
function viewDoctorHome() {
  const dr = currentDoctor();
  const today = doctorVisits(dr.id).filter(v => startOfDay(v.at) === startOfDay(Date.now()) || ['waiting', 'active'].includes(v.status));
  const waiting = today.filter(v => v.status === 'waiting' || v.status === 'active');
  const done = today.filter(v => v.status === 'done');
  const myDocs = db.docs.filter(x => x.doctorId === dr.id || x.seed).filter(x => startOfDay(x.signedAt) === startOfDay(Date.now()));
  const elsewhere = db.visits.filter(v => !v.seed && v.doctorId !== dr.id && ['booked', 'waiting', 'active'].includes(v.status));
  const nowIdx = today.findIndex(v => v.at > Date.now());

  const rows = today.map((v, i) => {
    const pt = patientById(v.patientId);
    const line = v.brief ? v.brief.line : scenarioOf(v).brief(v.answers, pt).line;
    const live = v.status === 'waiting' || v.status === 'active';
    const action = canStart(v) ? `<a class="btn ${live ? 'btn--primary' : 'btn--ghost'} btn--sm" href="#/lekarz/konsultacja/${v.id}">${v.status === 'active' ? 'Wróć do wizyty' : 'Rozpocznij'}</a>` : '';
    return `${i === nowIdx ? `<div class="now-line">teraz ${fmtTime(Date.now())}</div>` : ''}
      <div class="srow ${live ? 'is-live' : ''} ${['done', 'noshow'].includes(v.status) ? 'is-past' : ''}">
      <span class="srow__t">${fmtTime(v.at)}<small>${VISIT_TYPES[v.type].label}</small></span>${avatar(pt, 40)}
      <div style="min-width:0"><a class="srow__link" href="#/lekarz/wizyta/${v.id}"><b>${esc(pt.name)}</b></a> <span class="muted">${ptLine(pt)} · ${esc(reasonOf(v))}</span>
        <div class="srow__line">${ic('spark')}${esc(line)}</div></div>
      <span class="srow__side">${pt.allergies.length ? `<span class="chip chip--danger" title="${esc(pt.allergies.map(a => a.name).join(', '))}">${ic('alert')}alergia</span>` : ''}${statusChip(v)}${action}</span></div>`;
  }).join('') + (nowIdx === -1 ? `<div class="now-line">teraz ${fmtTime(Date.now())}</div>` : '');

  const attention = [
    ...waiting.map(v => { const pt = patientById(v.patientId); return { href: `#/lekarz/wizyta/${v.id}`, icon: 'user', tone: 'ok', t: `${pt.name} czeka w poczekalni`, s: `${reasonOf(v)} · ${pt.allergies.length ? 'alergia: ' + pt.allergies[0].name : 'bez alergii'}` }; }),
    ...today.filter(v => v.seed && v.status === 'booked' && v.brief.attention.length).map(v => ({ href: `#/lekarz/wizyta/${v.id}`, icon: 'alert', tone: 'warn', t: `${patientById(v.patientId).name} · ${fmtTime(v.at)}`, s: v.brief.attention[0] })),
  ];

  app.innerHTML = `<div class="pro-page"><div class="wrap">
    <div class="pro-h"><div><h1>Dzień dobry, ${esc(dr.full)}</h1><p>${fmtLong(Date.now())} · dyżur online 8:00–20:00</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn--ghost btn--sm" id="sampleBtn">${ic('plus')}Dodaj przykładową wizytę</button>
        <a class="btn btn--ghost btn--sm" href="#/lekarz/dokumenty">${ic('doc')}Wystawione dokumenty</a></div></div>
    <div class="stats">
      <div class="stat"><b>${today.length}</b><span>wizyt dziś</span></div>
      <div class="stat"><b>${waiting.length}</b><span>w poczekalni teraz</span></div>
      <div class="stat"><b>${done.length}</b><span>zakończonych</span></div>
      <div class="stat stat--ai"><b>1:40</b><span>śr. czas dokumentacji z AI (bez: 6:10)</span></div></div>
    <div class="dash">
      <div class="card sched"><div class="sched__h"><h2 class="card__t">${ic('cal')}Grafik na dziś</h2><span class="muted" style="font-size:13px">kliknij wizytę, żeby zobaczyć brief AI</span></div>
        ${waiting.length ? '' : `<div class="empty-queue">${ic('users')}<p>Nikt nie czeka w poczekalni. Umów wizytę jako pacjentka w drugiej karcie — pojawi się tu na żywo — albo dodaj przykładową.</p>
          <button type="button" class="btn btn--soft btn--sm" id="sampleBtn2">Dodaj przykładową</button><button type="button" class="btn btn--ghost btn--sm" id="patientTab">Strona pacjenta ↗</button></div>`}
        ${rows}</div>
      <div class="stack">
        <div class="aibox"><div class="aibox__h">${ic('spark')}Wymaga uwagi</div><div class="aibox__b">
          ${attention.length ? attention.map(a => `<a class="aiitem" href="${a.href}"><span style="color:var(--${a.tone})">${ic(a.icon)}</span><span><b>${esc(a.t)}</b>${esc(a.s)}</span></a>`).join('') : '<p class="muted" style="font-size:13.5px">Nic pilnego.</p>'}
          <p class="ai__disc">Asystent AI porządkuje informacje z ankiet i wyników. Nie ocenia pilności zamiast Ciebie.</p></div></div>
        ${elsewhere.length ? `<div class="card card--pad" style="font-size:13.5px"><b>Demo:</b> ${elsewhere.length === 1 ? 'jedna wizyta czeka' : elsewhere.length + ' wizyty czekają'} u innego lekarza (${[...new Set(elsewhere.map(v => doctorById(v.doctorId).full))].join(', ')}). Wyloguj się i zaloguj na jego konto — dane w „Dane testowe”.</div>` : ''}
        <div class="card card--pad"><h2 class="card__t" style="margin-bottom:10px">${ic('doc')}Wystawione dziś</h2>
          ${myDocs.length ? myDocs.map(x => { const pt = patientById(x.patientId); return `<div class="fact"><span class="fact__cat">${x.kind === 'rx' ? 'e-Rp' : x.kind === 'zla' ? 'e-ZLA' : 'Skier.'}</span><span>${esc(pt.name)} · ${x.kind === 'rx' ? x.items.map(i => drugById(i.drug).inn).join(', ') : x.kind === 'zla' ? x.number : x.tests.map(labName).join(', ')}</span><span class="src src--static">${fmtTime(x.signedAt)}</span></div>`; }).join('') : '<p class="muted">Jeszcze nic.</p>'}</div>
      </div></div></div></div>`;
  const sample = () => { const id = addSampleVisit(dr.id); toast('Anna Kowalska czeka w poczekalni (ból gardła)', 'user'); go('#/lekarz/wizyta/' + id); };
  $('#sampleBtn').addEventListener('click', sample);
  $('#sampleBtn2')?.addEventListener('click', sample);
  $('#patientTab')?.addEventListener('click', () => window.open(location.pathname + '#/konto', '_blank'));
  return { sync: viewDoctorHome };
}

function viewDoctorDocs() {
  const dr = currentDoctor();
  const docs = db.docs.filter(x => x.doctorId === dr.id || x.seed).sort((a, b) => b.signedAt - a.signedAt);
  const kind = { rx: 'e-Recepta', zla: 'e-ZLA', ref: 'Skierowanie' };
  app.innerHTML = `<div class="pro-page"><div class="wrap"><a class="back" href="#/lekarz">${ic('back')}Grafik</a>
    <div class="pro-h"><div><h1>Wystawione dokumenty</h1><p>Podpisane Twoim certyfikatem i wysłane do P1 / ZUS (symulacja).</p></div></div>
    <div class="card sched">${docs.length ? docs.map(x => { const pt = patientById(x.patientId); return `<div class="srow" style="grid-template-columns:110px auto minmax(0,1fr) auto">
      <span class="srow__t">${fmtTime(x.signedAt)}<small>${fmtDMY(x.signedAt)}</small></span>${avatar(pt, 36)}
      <div style="min-width:0"><b>${kind[x.kind]}</b> · ${esc(pt.name)} <span class="muted mono" style="font-size:12.5px">${pt.pesel}</span>
        <div class="srow__line">${x.kind === 'rx' ? 'kod ' + x.code + ' · ' + x.items.map(i => esc(drugLabel(drugById(i.drug)))).join(', ') : x.kind === 'zla' ? `${x.number} · ${fmtDMY(fromIso(x.from))}–${fmtDMY(fromIso(x.to))}` : 'kod ' + x.code + ' · ' + x.tests.map(labName).join(', ')}</div></div>
      <span class="srow__side">${x.kind !== 'zla' ? `<button type="button" class="btn btn--ghost btn--sm" data-print="${x.id}">${ic('print')}Podgląd</button>` : '<span class="chip chip--ok">ZUS</span>'}</span></div>`; }).join('') : `<div class="empty">${ic('doc')}<p>Brak dokumentów.</p></div>`}</div></div></div>`;
}

// ---------- patient card (shared by the brief and the room) ----------
function ptCardHtml(pt, v) {
  const sc = scenarioOf(v);
  return `<div class="ptcard">
    <section><p class="side-h">Alergie</p><ul>${pt.allergies.length ? pt.allergies.map(a => `<li class="allergy">${ic('alert')}<span>${esc(a.name)}<br><small style="font-weight:500">${esc(a.reaction)} · ${a.year}</small></span></li>`).join('') : '<li class="muted">Brak znanych alergii</li>'}</ul></section>
    <section><p class="side-h">Choroby przewlekłe</p><ul>${pt.conditions.length ? pt.conditions.map(c => `<li>${ic('heart')}<span>${esc(c.name)} <span class="muted mono" style="font-size:12px">${c.icd}</span></span></li>`).join('') : '<li class="muted">Brak</li>'}</ul></section>
    <section><p class="side-h">Leki na stałe</p><ul>${pt.meds.length ? pt.meds.map(m => `<li>${ic('pill')}<span>${esc(drugLabel(drugById(m.drug)))}<br><small class="muted">${esc(m.sig)}</small></span></li>`).join('') : '<li class="muted">Brak</li>'}</ul></section>
    ${pt.files && pt.files.length ? `<section><p class="side-h">Pliki</p><ul>${pt.files.map(f => `<li>${ic('file')}<button type="button" class="link-btn" data-file="${f.id}">${esc(f.name)}</button></li>`).join('')}</ul></section>` : ''}
    ${pt.history && pt.history.length ? `<section><p class="side-h">Poprzednie wizyty</p><ul class="hist">${pt.history.map(h => `<li><b style="font-size:13.5px">${esc(h.reason)}</b><small>${fmtDMY(fromIso(h.date))} · ${esc(doctorById(h.doctor).full)}</small><small>${esc(h.summary)}</small></li>`).join('')}</ul></section>` : ''}
    ${sc ? `<section><p class="side-h">Ankieta</p><ul>${sc.questions.filter(q => q.type !== 'files').map(q => `<li style="display:block;font-size:13px"><span class="muted">${esc(q.q)}</span><br>${esc([].concat(v.answers[q.id] || '—').join(', '))}</li>`).join('')}
      ${v.free ? `<li style="display:block;font-size:13px"><span class="muted">Własnymi słowami</span><br>„${esc(v.free)}”</li>` : ''}</ul></section>` : ''}
  </div>`;
}

function showFile(pt, id) {
  const f = pt.files.find(x => x.id === id);
  modal({ label: f.name, html: `<button class="modal__x" data-close aria-label="Zamknij">${ic('x')}</button><div class="modal__body">
    <p class="eyebrow">${esc(f.kind)} · ${fmtDMY(fromIso(f.date))}</p><h2 class="modal__title">${esc(f.name)}</h2><p class="muted">${esc(f.lab)} · ${esc(pt.name)}</p>
    <div class="score">${f.rows.map(r => `<div class="score__row"><b>${r[0]}</b><span class="mono">${r[1]} ${r[2]}</span><span class="muted" style="font-size:12.5px">norma ${r[3]}</span></div>`).join('')}</div>
    <div class="ai-note">${ic('spark')}<span>Odczytane z pliku PDF i dodane do briefu. Sprawdź z oryginałem przed decyzją.</span></div></div>` });
}

// ---------- visit record: brief before, documentation after ----------
function viewDoctorVisit(id) {
  const v = visitById(id);
  if (!v) { app.innerHTML = `<div class="pro-page"><div class="wrap"><div class="card empty">${ic('alert')}<p>Nie ma takiej wizyty.</p><a class="btn btn--ghost" href="#/lekarz">Grafik</a></div></div></div>`; return; }
  const pt = patientById(v.patientId), sc = scenarioOf(v);
  const b = v.brief || sc.brief(v.answers, pt);
  const ai = sc ? aiState(v, 0) : null;
  const docs = docsOf(v);
  const startBtn = canStart(v)
    ? `<a class="btn btn--primary btn--lg" href="#/lekarz/konsultacja/${v.id}">${ic(v.type === 'video' ? 'video' : v.type === 'phone' ? 'phone' : 'chat')}${v.status === 'active' ? 'Wróć do wizyty' : 'Rozpocznij wizytę'}</a>`
    : v.status === 'booked' ? `<button class="btn btn--ghost btn--lg" disabled title="W mocku nagrane są tylko rozmowy z pacjentką testową">Rozpoczęcie o ${fmtTime(v.at)}</button>` : '';

  const scoreHtml = ai ? `<div><h4 class="side-h">${esc(ai.score.title)} — z ankiety</h4><div class="score">${ai.score.items.map(it => `<div class="score__row"><span>${esc(it.label)}</span>${srcChip(it.src, [])}<span class="score__v score__v--${it.val == null ? 'n' : it.val ? '1' : '0'}">${it.val == null ? '?' : (it.val > 0 ? '+' : '') + it.val}</span></div>`).join('')}
    <div class="score__sum score__sum--${ai.score.verdict.tone}"><b>${ai.score.kind === 'sum' ? ai.score.total : ai.score.items.filter(x => x.val === 1).length + '/' + ai.score.items.length}</b><span>${esc(ai.score.verdict.text)}</span></div></div></div>` : '';

  const record = v.status === 'done' ? `<div class="card card--pad stack"><div class="card__h" style="margin:0"><h2 class="card__t">${ic('doc')}Dokumentacja wizyty</h2><span class="chip chip--ok">${ic('check')}zatwierdzona ${v.endedAt ? fmtTime(v.endedAt) : ''}</span></div>
      <div class="note-read">${NOTE_SECTIONS.map(([k, l]) => v.note && v.note[k] && v.note[k].text ? `<div><h4>${l}</h4><p>${esc(v.note[k].text)}</p></div>` : '').join('')}</div>
      ${docs.map(miniDocHtml).join('')}
      ${(v.aiLog || []).length ? `<div><h4 class="side-h">Dziennik decyzji AI</h4><ul class="log">${v.aiLog.map(l => `<li><time>${fmtTime(l.t)}</time><span>${esc(l.text)}</span></li>`).join('')}</ul></div>` : ''}</div>` : '';

  app.innerHTML = `<div class="pro-page"><div class="wrap"><a class="back" href="#/lekarz">${ic('back')}Grafik</a>
    <div class="card ptbar">${avatar(pt, 56)}<div><h1>${esc(pt.name)}</h1><div class="ptbar__meta"><span>${ptLine(pt)}</span><span class="mono">PESEL ${pt.pesel}</span><span>${fmtWhen(v.at)}</span><span>${VISIT_TYPES[v.type].label}</span>${statusChip(v)}</div></div>
      <div class="ptbar__go">${v.status === 'done' ? `<a class="btn btn--ghost" href="#/lekarz">Wróć do grafiku</a>` : startBtn}</div></div>
    <div class="prep-grid" style="margin-top:18px"><div class="stack">
      ${record}
      <div class="brief"><div class="brief__h"><b>${ic('spark')}Brief AI · ${esc(reasonOf(v))}</b><span class="tag-ai">${ic('spark')}szkic</span></div>
        <p class="brief__sum">${esc(b.summary)}</p>
        <div class="brief__cols"><div><h4>Zwróć uwagę</h4><ul class="warnlist">${(b.attention.length ? b.attention : ['Brak szczególnych uwag']).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
          <div><h4>Do ustalenia w rozmowie</h4><ul>${(b.todo.length ? b.todo : ['—']).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
        ${scoreHtml}
        <p class="ai__disc">Wygenerowano z ankiety pacjenta i karty. Źródła: ankieta${v.answers?.files?.length ? ', plik z wynikiem' : ''}, historia wizyt. Zgoda na transkrypcję: <b>${v.consentAI ? 'tak' : 'nie'}</b>.</p></div>
      ${sc && v.status !== 'done' ? `<div class="card card--pad"><h2 class="card__t" style="margin-bottom:10px">Ankieta pacjenta</h2><dl class="answers">${sc.questions.map(q => `<div><dt>${esc(q.q)}</dt><dd>${q.type === 'files' ? (v.answers[q.id] || []).map(fid => `<button type="button" class="link-btn" data-file="${fid}">${esc(pt.files.find(f => f.id === fid)?.name)}</button>`).join(', ') || '—' : esc([].concat(v.answers[q.id] || '—').join(', '))}</dd></div>`).join('')}
        <div><dt>Objawy alarmowe</dt><dd>zaprzeczył/a wszystkim (${sc.alarms.length})</dd></div>${v.free ? `<div><dt>Własnymi słowami</dt><dd>„${esc(v.free)}”</dd></div>` : ''}</dl></div>` : ''}
    </div>
    <aside class="card card--pad">${ptCardHtml(pt, sc ? v : { answers: {} })}</aside></div></div></div>`;
  $$('[data-file]').forEach(x => x.addEventListener('click', () => showFile(pt, x.dataset.file)));
  return { sync: () => viewDoctorVisit(id) };
}

// ---------- signing ----------
// Simulated signature + submission. Real flow: HL7 CDA document, XAdES signature, P1 (e-prescription, referral) or PUE ZUS (e-ZLA).
function signFlow({ title, summary, target }) {
  return new Promise(resolve => {
    const m = modal({ label: title, html: `<button class="modal__x" data-close aria-label="Zamknij">${ic('x')}</button><div class="modal__body" id="signBody">
      <h2 class="modal__title">${esc(title)}</h2><div class="modal__text">${summary}</div>
      <div class="radios">${[['zus', 'Certyfikat z ZUS', 'zainstalowany na tym komputerze'], ['qes', 'Podpis kwalifikowany', 'karta kryptograficzna'], ['pz', 'Profil zaufany', 'potwierdzenie w przeglądarce']].map(([k, l, s], i) =>
        `<label class="pay__opt"><input type="radio" name="sig" value="${k}" ${i ? '' : 'checked'}><div><b>${l}</b><small>${s}</small></div></label>`).join('')}</div>
      <label class="field" id="pinField"><span>Hasło do certyfikatu</span><input class="input" type="password" id="pin" autocomplete="off" placeholder="w mocku dowolne"></label>
      <div class="modal__actions"><button type="button" class="btn btn--ghost" data-close>Anuluj</button><button type="button" class="btn btn--primary" id="doSign">${ic('key')}Podpisz i wyślij</button></div></div>`,
    onClose: r => resolve(r || null) });
    $$('[name=sig]', m.el).forEach(r => r.addEventListener('change', () => { $('#pinField', m.el).hidden = r.value === 'pz' && r.checked; }));
    $('#doSign', m.el).addEventListener('click', async () => {
      const method = $('[name=sig]:checked', m.el).value;
      if (method !== 'pz' && !$('#pin', m.el).value) { $('#pin', m.el).focus(); return; }
      const steps = ['Tworzę dokument (HL7 CDA)', `Podpisuję (XAdES) — ${method === 'zus' ? 'certyfikat ZUS' : method === 'qes' ? 'podpis kwalifikowany' : 'profil zaufany'}`, target === 'ZUS' ? 'Wysyłam do PUE ZUS' : 'Wysyłam do systemu P1 (Centrum e-Zdrowia)', 'Odebrano potwierdzenie'];
      $('#signBody', m.el).innerHTML = `<h2 class="modal__title">${esc(title)}</h2><ul class="signsteps">${steps.map(s => `<li><span class="spin"></span>${s}</li>`).join('')}</ul><p class="muted" style="font-size:13px">Symulacja — nic nie jest wysyłane.</p>`;
      const li = $$('.signsteps li', m.el);
      for (let i = 0; i < li.length; i++) { li[i].classList.add('is-on'); await wait(i === 2 ? 900 : 550); li[i].classList.replace('is-on', 'is-done'); }
      await wait(250);
      m.close({ method });
    });
  });
}

// ---------- the consultation room ----------
function viewConsult(id) {
  let v = visitById(id);
  if (!v || !scenarioOf(v)) return go('#/lekarz');
  if (v.status === 'done') return go('#/lekarz/wizyta/' + id);
  if (v.status !== 'active') startCall(id);
  v = visitById(id);
  const pt = patientById(v.patientId), dr = doctorById(v.doctorId) || currentDoctor(), sc = scenarioOf(v);
  const lines = scriptFor(v);
  let ai = aiState(v, v.call.done);
  const st = { tab: 'rozmowa', rx: [], overrides: {}, zla: null, ref: null, plan: ai.plan, factCount: 0 };
  const endedAtMount = v.call.ended;

  const mediaHtml = v.type === 'video'
    ? `<div class="vid" id="vid">${feedSvg(pt, 'patient')}<div class="stage__self" id="selfFeed">${feedSvg(dr, 'doctor')}</div>
        <span class="stage__tag">${esc(pt.first)} · wideo</span>
        <div class="vid__ctl"><button type="button" class="ctl" data-toggle="mic" aria-label="Mikrofon">${ic('mic')}</button><button type="button" class="ctl" data-toggle="cam" aria-label="Kamera">${ic('video')}</button></div></div>`
    : v.type === 'phone' ? `<div class="vid stage--audio" id="vid">${avatar(pt, 96)}<span class="stage__tag">${ic('phone')}Połączenie głosowe</span></div>` : '';

  document.body.classList.add('is-room');
  app.innerHTML = `
    <div class="roombar">
      <div class="roombar__who">${avatar(pt, 38)}<div><b>${esc(pt.name)}</b><small>${ptLine(pt)} · PESEL ${pt.pesel}</small></div></div>
      ${pt.allergies.map(a => `<span class="chip chip--danger roombar__allergy">${ic('alert')}${esc(a.name)}</span>`).join('')}
      <span class="chip">${ic(VISIT_TYPES[v.type].icon)}${VISIT_TYPES[v.type].label}</span>
      <span class="roombar__clock" id="clock">00:00</span><span class="chip chip--ok chip--live" id="callState">rozmowa trwa</span>
      <div class="roombar__end"><a class="btn btn--ghost btn--sm" href="#/lekarz/wizyta/${id}">Brief</a><button type="button" class="btn btn--danger btn--sm" id="finishBtn">${ic('check')}Zakończ wizytę</button></div>
    </div>
    <div class="ws">
      <aside class="ws__col ws__left">${ptCardHtml(pt, v)}</aside>
      <section class="ws__mid">
        <div class="tabs" role="tablist">
          <button type="button" data-tab="rozmowa" class="is-on">${ic('ear')}Rozmowa</button>
          <button type="button" data-tab="notatka">${ic('edit')}Notatka <span class="badge badge--ai" id="bNote" hidden></span></button>
          <button type="button" data-tab="recepta">${ic('rx')}e-Recepta <span class="badge" id="bRx" hidden></span></button>
          <button type="button" data-tab="zla">${ic('bed')}e-ZLA <span class="badge" id="bZla" hidden></span></button>
          <button type="button" data-tab="ref">${ic('flask')}Skierowanie <span class="badge" id="bRef" hidden></span></button>
        </div>
        <div class="pane" data-pane="rozmowa">${mediaHtml}
          <div class="player"><span class="player__label">${ic('wave')}Symulacja rozmowy (nagrany scenariusz)</span>
            <button type="button" class="btn btn--ghost btn--sm" id="pp">${ic('pause')}Pauza</button>
            <div class="seg" id="speed">${SPEEDS.map(s => `<button type="button" data-speed="${s}" class="${s === playSpeed ? 'is-on' : ''}">${s}×</button>`).join('')}</div>
            <button type="button" class="btn btn--ghost btn--sm" id="skip" title="Przewiń do końca rozmowy">${ic('skip')}Do końca</button>
            <button type="button" class="btn btn--ghost btn--sm" id="restart" title="Od początku">${ic('restart')}</button></div>
          ${v.consentAI ? '<div class="tx" id="tx"></div>' : `<div class="tx__off">${ic('lock')}<div><b>Transkrypcja wyłączona</b><br>Pacjentka nie zgodziła się na asystenta AI w rozmowie. Notatkę uzupełnij ręcznie — kontrole leków i alergii działają, bo to reguły, nie transkrypcja.</div></div>`}
        </div>
        <div class="pane" data-pane="notatka" hidden id="paneNote"></div>
        <div class="pane" data-pane="recepta" hidden id="paneRx"></div>
        <div class="pane" data-pane="zla" hidden id="paneZla"></div>
        <div class="pane" data-pane="ref" hidden id="paneRef"></div>
      </section>
      <aside class="ws__col ws__right"><div class="ai" id="ai"></div></aside>
    </div>`;

  // ---------- tabs ----------
  const setTab = t => {
    st.tab = t;
    $$('[data-tab]').forEach(b => b.classList.toggle('is-on', b.dataset.tab === t));
    $$('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t; });
    ({ notatka: renderNote, recepta: renderRx, zla: renderZla, ref: renderRef })[t]?.();
  };
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $$('[data-file]').forEach(x => x.addEventListener('click', () => showFile(pt, x.dataset.file)));
  $$('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    b.classList.toggle('is-off');
    const off = b.classList.contains('is-off');
    b.innerHTML = ic(b.dataset.toggle === 'mic' ? (off ? 'micOff' : 'mic') : (off ? 'camOff' : 'video'));
    if (b.dataset.toggle === 'cam') $('#selfFeed').innerHTML = off ? `<div style="height:100%;display:grid;place-items:center;background:#222;color:#aaa">${ic('camOff')}</div>` : feedSvg(dr, 'doctor');
  }));

  // ---------- transcript ----------
  const hlText = l => {
    let s = esc(l.t);
    (l.hl || []).forEach(h => { s = s.split(esc(h)).join(`<mark>${esc(h)}</mark>`); });
    return s;
  };
  const who = l => (l.who === 'd' ? 'Lekarz' : pt.female ? 'Pacjentka' : 'Pacjent');
  function renderTx(p) {
    if (!v.consentAI) return;
    $('#tx').innerHTML = p.lines.slice(0, p.done).map(l => `<div class="tx__line tx__line--${l.who}" data-line="${l.i}"><time>${fmtClock(l.ts)}</time><div><span class="tx__who">${who(l)}</span><span class="tx__text">${hlText(l)}</span></div></div>`).join('')
      + (p.cur ? `<div class="tx__line tx__line--${p.cur.who} is-cur" data-line="${p.cur.i}"><time>${fmtClock(p.cur.ts)}</time><div><span class="tx__who">${who(p.cur)}</span><span class="tx__text" id="curText"></span></div></div>` : '')
      + (p.ended ? `<p class="muted" style="font-size:13px;padding:8px">${ic('check')} Rozmowa zakończona. Szkic notatki jest w zakładce „Notatka”.</p>` : '');
    if (st.tab === 'rozmowa' && !st.flashing) { const pane = $('[data-pane=rozmowa]'); pane.scrollTop = pane.scrollHeight; }
  }
  function flashLine(i) {
    setTab('rozmowa');
    const el = $(`[data-line="${i}"]`);
    if (!el) return;
    st.flashing = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('is-flash');
    setTimeout(() => { el.classList.remove('is-flash'); st.flashing = false; }, 2200);
  }

  // ---------- AI panel ----------
  function renderAI(p) {
    const s = ai;
    const live = !p.ended && v.consentAI;
    const factsByCat = {};
    s.facts.forEach((f, i) => { (factsByCat[f.cat] = factsByCat[f.cat] || []).push(Object.assign({ i }, f)); });
    const plan = sc.plan;
    $('#ai').innerHTML = `
      <div class="ai__h"><div class="ai__t">${ic('spark')}Asystent AI<span class="chip ${live ? 'chip--ai chip--live' : ''}">${!v.consentAI ? 'bez transkrypcji' : live ? 'słucha' : 'rozmowa zakończona'}</span></div>
        <p class="ai__disc">Podpowiedzi do Twojej decyzji. Każda ma źródło — kliknij czas, żeby zobaczyć wypowiedź.</p></div>
      ${s.alerts.length ? `<div class="ai__sec"><h3>Rozbieżności</h3>${s.alerts.map(a => `<div class="alertbox">${ic('alert')}<span>${esc(a.text)} ${srcChip(a.src, lines)}</span></div>`).join('')}</div>` : ''}
      <div class="ai__sec"><h3>Objawy alarmowe</h3>${s.flags.map(f => `<div class="flag flag--${f.st}"><span class="flag__dot">${f.st === 'warn' ? ic('alert') : f.st === 'pending' ? '' : ic('check')}</span><span>${esc(f.label)}</span>${f.st === 'ok' ? srcChip(f.src, lines) : '<span class="src src--static">ankieta</span>'}</div>`).join('')}
        <p class="ai__disc">✓ pełne — wykluczone w rozmowie · ✓ obrys — zaprzeczono tylko w ankiecie</p></div>
      <div class="ai__sec"><h3>${esc(s.score.title)}</h3><div class="score">${s.score.items.map(it => `<div class="score__row"><span>${esc(it.label)}</span>${srcChip(it.src, lines)}<span class="score__v score__v--${it.val == null ? 'n' : it.val ? '1' : '0'}">${it.val == null ? '?' : (it.val > 0 ? '+' : '') + it.val}</span></div>`).join('')}
        <div class="score__sum score__sum--${s.score.verdict.tone}"><b>${s.score.kind === 'sum' ? s.score.total : s.score.items.filter(x => x.val === 1).length + '/' + s.score.items.length}</b><span>${esc(s.score.verdict.text)}</span></div></div></div>
      <div class="ai__sec"><h3>Różnicowanie <span class="tag-ai">prawdopodobieństwo</span></h3><div class="ddx">${s.ddx.map(d => `<div class="ddx__row ddx__row--${d.lvl}">
        <div class="ddx__top"><b>${esc(d.name)}</b><span class="ddx__icd">${d.icd}</span>${srcChip(d.src, lines)}</div>
        <div class="ddx__bar"><i style="width:${[6, 30, 62, 92][d.lvl]}%"></i></div><div class="ddx__why">${LVL[d.lvl]} · ${esc(d.why)}</div>
        ${d.lvl >= 2 ? `<div class="ddx__act"><button type="button" class="btn btn--ai-soft btn--sm" data-dx="${d.icd}">Wstaw do rozpoznania</button></div>` : ''}</div>`).join('')}</div></div>
      <div class="ai__sec"><h3>Dopytaj <span>${s.qs.filter(q => q.done != null).length}/${s.qs.length}</span></h3><div class="qlist">${s.qs.map(q => `<div class="qitem ${q.done != null ? 'is-done' : ''}" data-q="${q.id}" role="checkbox" aria-checked="${q.done != null}" tabindex="0">
        <span class="qitem__box">${q.done != null ? ic('check') : ''}</span><span>${esc(q.text)}</span>${typeof q.done === 'number' ? srcChip(q.done, lines) : ''}</div>`).join('')}</div></div>
      ${s.plan ? `<div class="ai__sec"><h3>Proponowane leczenie</h3><p style="font-size:13.5px">${esc(plan.title)}</p><div class="plan">
        ${plan.rx.map((r, i) => { const d = drugById(r.drug); return `<div class="plan__drug"><b>${esc(drugLabel(d))}${r.main ? ' <span class="tag-ai">1. wybór</span>' : ''}</b><small>${esc(sigLabel(Object.assign({}, r)))}</small><small>${esc(r.why)}</small>
          <button type="button" class="btn btn--ai btn--sm" data-addplan="${i}">${ic('plus')}Do e-recepty</button></div>`; }).join('')}
        ${plan.avoid.length ? `<ul class="plan__avoid">${plan.avoid.map(a => `<li>${ic('x')}${esc(a)}</li>`).join('')}</ul>` : ''}
        ${plan.zla ? `<button type="button" class="btn btn--ai-soft btn--sm" data-goto="zla">${ic('bed')}e-ZLA: ${dni(plan.zla.days)}${s.docs.zla != null ? ' · pacjentka prosi' : ''}</button>` : ''}
        ${plan.ref ? `<button type="button" class="btn btn--ai-soft btn--sm" data-goto="ref">${ic('flask')}Skierowanie: ${plan.ref.tests.map(labName).join(', ')}</button>` : ''}</div></div>` : ''}
      <div class="ai__sec"><h3>Fakty do notatki <span>${s.facts.length}</span></h3>${Object.entries(factsByCat).map(([cat, fs]) => fs.map(f => `<div class="fact ${f.i >= st.factCount ? 'is-new' : ''}"><span class="fact__cat">${esc(cat)}</span><span>${esc(f.text)}</span>${srcChip(f.src, lines)}</div>`).join('')).join('')}</div>
      <div class="ai__sec"><h3>Dziennik decyzji</h3>${(visitById(id).aiLog || []).length ? `<ul class="log">${visitById(id).aiLog.map(l => `<li><time>${fmtTime(l.t)}</time><span>${esc(l.text)}</span></li>`).join('')}</ul>` : '<p class="ai__disc">Tu zapisują się przyjęte i odrzucone sugestie.</p>'}</div>`;
    st.factCount = s.facts.length;
    $$('#ai [data-src]').forEach(b => b.addEventListener('click', () => flashLine(+b.dataset.src)));
    const toggleQ = qid => {
      updateVisit(id, x => { x.asked = x.asked || {}; if (x.asked[qid]) delete x.asked[qid]; else x.asked[qid] = true; });
      refreshAI();
    };
    $$('#ai [data-q]').forEach(b => {
      b.addEventListener('click', e => { if (!e.target.closest('.src')) toggleQ(b.dataset.q); });
      b.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleQ(b.dataset.q); } });
    });
    $$('#ai [data-dx]').forEach(b => b.addEventListener('click', () => {
      const code = b.dataset.dx;
      setNote('rozpoznanie', `${code} ${icdName(code)}`, 'edited');
      logAI(id, `Przyjęto rozpoznanie z różnicowania: ${code}`);
      toast(`Wstawiono ${code} do rozpoznania`, 'spark', 'ai');
      refreshAI();
      if (st.tab === 'notatka') renderNote();
    }));
    $$('#ai [data-addplan]').forEach(b => b.addEventListener('click', () => { addFromPlan(+b.dataset.addplan); setTab('recepta'); }));
    $$('#ai [data-goto]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.goto)));
  }
  function refreshAI() { const x = visitById(id); v = x; ai = aiState(x, x.call.done); renderAI(callPos(x)); }

  // ---------- note ----------
  function setNote(k, text, state) {
    updateVisit(id, x => { x.note = x.note || {}; x.note[k] = { text, state }; });
    v = visitById(id);
  }
  function noteBadge() {
    const draft = noteDraft(v, v.call.done);
    const n = NOTE_SECTIONS.filter(([k]) => draft[k] && !(v.note && v.note[k])).length;
    $('#bNote').hidden = !n; $('#bNote').textContent = n;
  }
  function renderNote() {
    v = visitById(id);
    const draft = noteDraft(v, v.call.done);
    const pane = $('#paneNote');
    const dxs = ai.ddx.filter(d => d.lvl >= 2);
    pane.innerHTML = `<div class="card__h" style="margin:0"><h2 class="card__t">Notatka z wizyty</h2>
        <button type="button" class="btn btn--ai-soft btn--sm" id="approveAll" ${NOTE_SECTIONS.some(([k]) => draft[k] && !(v.note && v.note[k])) ? '' : 'disabled'}>${ic('check')}Zatwierdź wszystkie szkice</button></div>
      <p class="ai__disc">Szkice AI powstają z transkrypcji i ankiety. Edytuj albo zatwierdź każdą sekcję — do dokumentacji trafia tylko to, co zatwierdzisz.</p>
      ${NOTE_SECTIONS.map(([k, l]) => {
        const own = v.note && v.note[k];
        const text = own ? own.text : draft[k];
        const state = own ? own.state : draft[k] ? 'ai' : 'wait';
        return `<div class="notesec ${state === 'ai' ? 'notesec--ai' : state === 'approved' ? 'notesec--approved' : ''}" data-sec="${k}">
          <div class="notesec__h"><b>${l}</b>${state === 'ai' ? `<span class="tag-ai">${ic('spark')}szkic AI</span>` : state === 'approved' ? '<span class="chip chip--ok">zatwierdzone</span>' : state === 'edited' ? '<span class="chip">edytowane</span>' : ''}<span class="grow"></span>
            ${state === 'ai' || state === 'edited' ? `<button type="button" class="btn btn--primary btn--sm" data-approve="${k}">${ic('check')}Zatwierdź</button>` : ''}
            ${state === 'approved' ? `<button type="button" class="btn btn--ghost btn--sm" data-unlock="${k}">${ic('edit')}Edytuj</button>` : ''}
            ${own && draft[k] && own.text !== draft[k] ? `<button type="button" class="btn btn--ghost btn--sm" data-restore="${k}" title="Przywróć szkic AI">${ic('restart')}</button>` : ''}</div>
          ${state === 'wait' ? `<div class="notesec__wait">${ic('clock')}${v.consentAI ? 'AI uzupełni tę sekcję, gdy w rozmowie padną potrzebne informacje.' : 'Bez transkrypcji — wpisz ręcznie.'}</div>
            <textarea class="textarea" data-edit="${k}" placeholder="Wpisz ręcznie…" ${v.consentAI ? 'hidden' : ''}></textarea>`
            : `<textarea class="textarea" data-edit="${k}" ${state === 'approved' ? 'readonly' : ''}>${esc(text)}</textarea>`}
          ${k === 'rozpoznanie' && dxs.length && state !== 'approved' ? `<div class="icd-pick">${dxs.map(d => `<button type="button" class="btn btn--ai-soft btn--sm" data-dx2="${d.icd}">${ic('spark')}${d.icd} ${esc(d.name)}</button>`).join('')}</div>` : ''}
        </div>`;
      }).join('')}
      ${docsOf(v).length ? `<div class="notesec"><div class="notesec__h"><b>Wystawione dokumenty</b><span class="grow"></span><span class="chip chip--ok">dołączane automatycznie</span></div><div style="padding:12px 14px;display:grid;gap:4px;font-size:14px">${docsOf(v).map(d => `<span>${d.kind === 'rx' ? `e-Recepta (kod ${d.code}): ${d.items.map(i => esc(drugLabel(drugById(i.drug))) + ' — ' + esc(sigLabel(i))).join('; ')}` : d.kind === 'zla' ? `e-ZLA ${d.number}: ${fmtDMY(fromIso(d.from))}–${fmtDMY(fromIso(d.to))}` : `Skierowanie (kod ${d.code}): ${d.tests.map(labName).join(', ')}`}</span>`).join('')}</div></div>` : ''}`;
    let t;
    const grow = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
    $$('[data-edit]', pane).forEach(grow);
    $$('[data-edit]', pane).forEach(ta => ta.addEventListener('input', () => {
      grow(ta);
      clearTimeout(t);
      t = setTimeout(() => { setNote(ta.dataset.edit, ta.value, 'edited'); noteBadge(); }, 300);
    }));
    $$('[data-approve]', pane).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.approve, ta = $(`[data-edit="${k}"]`, pane);
      const wasAi = !(v.note && v.note[k]);
      setNote(k, ta.value, 'approved');
      logAI(id, `Zatwierdzono sekcję „${NOTE_SECTIONS.find(s => s[0] === k)[1]}”${wasAi ? ' (szkic AI bez zmian)' : ' (po edycji)'}`);
      renderNote(); noteBadge(); refreshAI();
    }));
    $$('[data-unlock]', pane).forEach(b => b.addEventListener('click', () => { setNote(b.dataset.unlock, v.note[b.dataset.unlock].text, 'edited'); renderNote(); }));
    $$('[data-restore]', pane).forEach(b => b.addEventListener('click', () => { updateVisit(id, x => { delete x.note[b.dataset.restore]; }); v = visitById(id); renderNote(); noteBadge(); }));
    $$('[data-dx2]', pane).forEach(b => b.addEventListener('click', () => { setNote('rozpoznanie', `${b.dataset.dx2} ${icdName(b.dataset.dx2)}`, 'edited'); logAI(id, `Przyjęto rozpoznanie z różnicowania: ${b.dataset.dx2}`); renderNote(); }));
    $('#approveAll', pane).addEventListener('click', () => {
      const d = noteDraft(v, v.call.done);
      let n = 0;
      updateVisit(id, x => { x.note = x.note || {}; NOTE_SECTIONS.forEach(([k]) => { if (d[k] && !x.note[k]) { x.note[k] = { text: d[k], state: 'approved' }; n++; } }); });
      v = visitById(id);
      logAI(id, `Zatwierdzono ${n} ${plural(n, 'szkic', 'szkice', 'szkiców')} notatki bez zmian`);
      renderNote(); noteBadge(); refreshAI();
    });
  }

  // ---------- e-prescription ----------
  function newPos(drugId, o = {}) {
    const drug = drugById(drugId), anti = drug.cls.includes('antibiotic');
    const pos = Object.assign({ uid: uid(), drug: drugId, pack: drug.packs[0], dose: 1, freq: anti ? 2 : 1, days: anti ? 7 : 30, extra: '', refund: drug.refund[0], nz: false, from: isoDay(Date.now()), qtyAuto: true, sig: drug.topical ? '' : undefined }, o);
    pos.qty = drug.topical ? 1 : Math.max(1, Math.ceil(neededUnits(pos) / pos.pack));
    return pos;
  }
  function addFromPlan(i) {
    const r = sc.plan.rx[i];
    if (st.rx.some(p => p.drug === r.drug)) { toast('Ten lek jest już na recepcie', 'info'); return; }
    st.rx.push(newPos(r.drug, { dose: r.dose, freq: r.freq, days: r.days, extra: r.extra, pack: r.pack || drugById(r.drug).packs[0] }));
    logAI(id, `Przyjęto sugestię AI: ${drugLabel(drugById(r.drug))} → e-recepta`);
    toast(`${drugById(r.drug).inn} dodany — sprawdź dawkowanie i podpisz`, 'spark', 'ai');
  }
  function renderRx() {
    v = visitById(id);
    const pane = $('#paneRx');
    const issued = docsOf(v).filter(d => d.kind === 'rx');
    const checks = rxChecks(st.rx, pt, v);
    const blocked = st.rx.some((p, i) => checks[i].some(c => c.lvl === 'block') && !st.overrides[p.uid]?.done);
    pane.innerHTML = `
      ${issued.map(d => `<div class="issued"><span class="mini-doc__ic">${ic('check')}</span><div><b>Wystawiono pakiet e-recept</b><small>${d.items.map(i => esc(drugLabel(drugById(i.drug)))).join(', ')} · ${fmtTime(d.signedAt)}</small></div>
        <div style="text-align:right"><span class="issued__code">${d.code}</span><br><button type="button" class="link-btn" data-print="${d.id}">Wydruk</button></div></div>`).join('')}
      ${ai.plan ? `<div class="aibox"><div class="aibox__h">${ic('spark')}Sugestie z rozmowy <span class="tag-ai" style="margin-left:auto">do Twojej decyzji</span></div><div class="aibox__b rx-sugg">
        ${sc.plan.rx.map((r, i) => { const d = drugById(r.drug); const added = st.rx.some(p => p.drug === r.drug); return `<div class="rx-sugg__row"><div><b>${esc(drugLabel(d))} · ${esc(d.form)}</b><small>${esc(sigLabel(r))}</small><small>${esc(r.why)}</small></div>
          <button type="button" class="btn ${added ? 'btn--ghost' : 'btn--ai'} btn--sm" data-addplan="${i}" ${added ? 'disabled' : ''}>${added ? 'Dodano' : ic('plus') + 'Dodaj'}</button></div>`; }).join('')}
        ${sc.plan.avoid.length ? `<ul class="plan__avoid">${sc.plan.avoid.map(a => `<li>${ic('x')}${esc(a)}</li>`).join('')}</ul>` : ''}
        <p class="ai__disc">AI nie wystawia recept. Lek trafia na receptę dopiero po Twoim podpisie.</p></div></div>`
      : `<div class="ai-note">${ic('spark')}<span>${v.consentAI ? 'Propozycje leczenia pojawią się, gdy w rozmowie padną kluczowe informacje (np. alergie). Możesz też wyszukać lek sam.' : 'Bez transkrypcji AI nie proponuje leczenia. Kontrole alergii i interakcji nadal działają.'}</span></div>`}
      <div class="search">${ic('search')}<input class="input" id="drugQ" placeholder="Szukaj leku: nazwa, substancja, np. „zinnat”, „euthyrox”" autocomplete="off" aria-label="Szukaj leku"><div class="search__list" id="drugList" hidden></div></div>
      ${st.rx.map((p, i) => posHtml(p, i, checks[i])).join('')}
      ${st.rx.length ? `<div class="rx-foot"><span class="rx-foot__info">Pakiet: ${st.rx.length} ${plural(st.rx.length, 'e-recepta', 'e-recepty', 'e-recept')} · jeden kod dla pacjenta${st.rx.some(p => drugById(p.drug).cls.includes('antibiotic')) ? ' · antybiotyk ważny 7 dni' : ''}</span>
        ${blocked ? `<span class="chip chip--danger">${ic('alert')}przeciwwskazanie bez uzasadnienia</span>` : ''}
        <button type="button" class="btn btn--primary" id="signRx" ${blocked ? 'disabled' : ''}>${ic('key')}Podpisz i wyślij do P1</button></div>`
        : issued.length ? '' : '<div class="empty" style="padding:20px">' + ic('rx') + '<p>Dodaj lek z sugestii AI albo z wyszukiwarki.</p></div>'}`;

    $$('[data-addplan]', pane).forEach(b => b.addEventListener('click', () => { addFromPlan(+b.dataset.addplan); renderRx(); }));
    bindSearch();
    $$('[data-pos]', pane).forEach(card => {
      const p = st.rx.find(x => x.uid === card.dataset.pos), drug = drugById(p.drug);
      $$('[data-f]', card).forEach(inp => inp.addEventListener(inp.dataset.live ? 'input' : 'change', () => {
        const f = inp.dataset.f;
        if (inp.type === 'checkbox') p[f] = inp.checked;
        else if (['dose', 'freq', 'days', 'qty', 'pack'].includes(f)) p[f] = Math.max(f === 'dose' ? 0.5 : 1, parseFloat(String(inp.value).replace(',', '.')) || 1);
        else p[f] = inp.value;
        if (f === 'qty') p.qtyAuto = false;
        if (['dose', 'freq', 'days', 'pack'].includes(f) && p.qtyAuto && !drug.topical) p.qty = Math.max(1, Math.ceil(neededUnits(p) / p.pack));
        if (!inp.dataset.live) renderRx();
      }));
      $('[data-del]', card).addEventListener('click', () => { st.rx = st.rx.filter(x => x !== p); renderRx(); });
      $('[data-override]', card)?.addEventListener('click', () => {
        const why = $('[data-why]', card).value.trim();
        if (why.length < 8) { $('[data-why]', card).focus(); toast('Wpisz uzasadnienie (min. kilka słów)', 'alert', 'warn'); return; }
        st.overrides[p.uid] = { done: true, why };
        logAI(id, `Nadpisano przeciwwskazanie (${drug.inn}). Uzasadnienie: ${why}`);
        renderRx();
      });
    });
    $('#signRx', pane)?.addEventListener('click', signRx);
    badge();
  }

  function posHtml(p, i, checks) {
    const d = drugById(p.drug), need = neededUnits(p);
    const anti = d.cls.includes('antibiotic');
    const price = patientPrice(d, p.pack, p.qty, p.refund);
    const blocked = checks.some(c => c.lvl === 'block');
    return `<div class="pos" data-pos="${p.uid}">
      <div class="pos__h"><span class="pos__n">${i + 1}</span><div><b>${esc(drugLabel(d))}</b><small>${esc(d.form)} · ${esc(d.cls.includes('antibiotic') ? 'antybiotyk' : '')}</small></div>
        <span class="chip chip--${{ block: 'danger', major: 'danger', moderate: 'warn', minor: '', info: '', ok: 'ok' }[worst(checks)]}">${ic(worst(checks) === 'ok' ? 'check' : 'alert')}${SEV_LABEL[worst(checks)]}</span>
        <button type="button" class="icon-btn pos__x" data-del aria-label="Usuń lek">${ic('trash')}</button></div>
      <div class="pos__b">
        ${d.topical ? `<label class="field"><span>Dawkowanie</span><input class="input input--sm" data-f="sig" data-live="1" value="${esc(p.sig || '')}" placeholder="np. cienką warstwę na zmiany 1× dziennie przez 7 dni"></label>`
          : `<div class="dosage"><input class="input input--sm" data-f="dose" value="${String(p.dose).replace('.', ',')}" inputmode="decimal" aria-label="Jednorazowo"> ${d.unit} ×
            <input class="input input--sm" data-f="freq" value="${p.freq}" inputmode="numeric" aria-label="Ile razy dziennie"> dziennie przez
            <input class="input input--sm" data-f="days" value="${p.days}" inputmode="numeric" aria-label="Ile dni"> dni
            <input class="input input--sm input--wide" data-f="extra" data-live="1" value="${esc(p.extra)}" placeholder="uwagi, np. po posiłku"></div>`}
        <div class="pos__grid">
          <label class="field"><span>Opakowanie</span><select class="select select--sm" data-f="pack">${d.packs.map(n => `<option value="${n}" ${n === p.pack ? 'selected' : ''}>${n} ${d.unit}</option>`).join('')}</select></label>
          <label class="field"><span>Liczba opakowań</span><input class="input input--sm" data-f="qty" value="${p.qty}" inputmode="numeric" style="width:100%"></label>
          <label class="field"><span>Odpłatność</span><select class="select select--sm" data-f="refund">${d.refund.map(r => `<option value="${r}" ${r === p.refund ? 'selected' : ''}>${r} — ${REFUNDS[r]}</option>`).join('')}</select></label>
          <label class="field"><span>Realizacja od</span><input class="input input--sm" type="date" data-f="from" value="${p.from}" style="width:100%"></label></div>
        <div class="pos__calc">${need ? `Potrzeba <b>${need} ${d.unit}</b> → ${p.qty} × ${p.pack} ${d.unit} · wystarczy na ${dni(Math.floor(p.qty * p.pack / (p.dose * p.freq)))} ·` : ''}
          pacjent zapłaci ok. <b>${zl(price)}</b> · ważna ${anti ? '7 dni (antybiotyk)' : p.days > 120 ? '365 dni, realizacja w częściach' : '30 dni'}
          <label class="check" style="margin-left:auto;font-size:13px"><input type="checkbox" data-f="nz" ${p.nz ? 'checked' : ''}>Nie zamieniać (NZ)</label></div>
        <div class="checks-ai"><span class="tag-ai" style="justify-self:start">${ic('shield')}kontrola: alergie, interakcje, dawka, ilość</span>${checks.map(c => `<div class="cai cai--${c.lvl}">${ic(c.lvl === 'ok' ? 'check' : c.lvl === 'info' || c.lvl === 'minor' ? 'info' : 'alert')}<span><b>${c.kind}:</b>${esc(c.text)}</span></div>`).join('')}</div>
        ${blocked ? (st.overrides[p.uid]?.done ? `<div class="cai cai--info">${ic('edit')}<span><b>Nadpisano:</b>${esc(st.overrides[p.uid].why)}</span></div>`
          : `<div class="override"><b style="font-size:13.5px;color:var(--danger)">Aby wystawić mimo przeciwwskazania, wpisz uzasadnienie — trafi do dokumentacji.</b><textarea class="textarea" data-why style="min-height:60px" placeholder="np. alergia wykluczona testem skórnym w 2024 r."></textarea>
            <button type="button" class="btn btn--danger btn--sm" data-override style="justify-self:start">Wystawiam mimo przeciwwskazania</button></div>`) : ''}
      </div></div>`;
  }

  function bindSearch() {
    const q = $('#drugQ'), list = $('#drugList');
    let hi = 0, res = [];
    const draw = () => {
      const t = norm(q.value.trim());
      if (t.length < 2) { list.hidden = true; return; }
      res = DRUGS.filter(d => norm(d.inn + ' ' + d.strength + ' ' + d.aka.join(' ')).includes(t)).slice(0, 8);
      if (!res.length) { list.innerHTML = '<p class="muted" style="padding:10px">Brak leku w bazie mocka.</p>'; list.hidden = false; return; }
      hi = Math.min(hi, res.length - 1);
      list.innerHTML = res.map((d, i) => {
        const c = rxChecks([newPos(d.id)], pt, v)[0].filter(x => x.kind === 'Alergia');
        const aka = d.aka.find(a => norm(a).includes(t));
        return `<button type="button" class="search__opt ${i === hi ? 'is-hi' : ''} ${c.length && c[0].lvl === 'block' ? 'search__opt--block' : ''}" data-pick="${d.id}">
          <span><b>${esc(drugLabel(d))}</b>${aka ? ` <span class="muted">(np. ${aka[0].toUpperCase() + aka.slice(1)})</span>` : ''}<small>${esc(d.form)} · op. ${d.packs.join(' / ')} ${d.unit} · ${d.refund.join(', ')}</small>
          ${c.length ? `<small>${c[0].lvl === 'block' ? '⚠ alergia pacjentki — przeciwwskazany' : '⚠ możliwa reakcja krzyżowa'}</small>` : ''}</span>${ic('plus')}</button>`;
      }).join('');
      list.hidden = false;
      $$('[data-pick]', list).forEach(b => b.addEventListener('mousedown', e => { e.preventDefault(); pick(b.dataset.pick); }));
    };
    const pick = drugId => {
      st.rx.push(newPos(drugId));
      const c = rxChecks(st.rx, pt, v)[st.rx.length - 1];
      if (c.some(x => x.lvl === 'block')) toast(`Alergia pacjentki: ${drugById(drugId).inn} jest przeciwwskazany`, 'alert', 'warn');
      renderRx();
    };
    q.addEventListener('input', () => { hi = 0; draw(); });
    q.addEventListener('keydown', e => {
      if (list.hidden || !res.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); hi = (hi + 1) % res.length; draw(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); hi = (hi - 1 + res.length) % res.length; draw(); }
      if (e.key === 'Enter') { e.preventDefault(); pick(res[hi].id); }
      if (e.key === 'Escape') list.hidden = true;
    });
    q.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
  }

  async function signRx() {
    const items = st.rx.map(p => ({ drug: p.drug, pack: p.pack, qty: p.qty, dose: p.dose, freq: p.freq, days: p.days, extra: p.extra, sig: drugById(p.drug).topical ? p.sig : undefined, refund: p.refund, nz: p.nz, from: p.from, override: st.overrides[p.uid]?.why }));
    const res = await signFlow({ title: `Podpisz ${items.length === 1 ? 'e-receptę' : 'pakiet e-recept'}`, target: 'P1',
      summary: `<p>${esc(pt.name)}, PESEL ${pt.pesel}</p><ul style="margin:8px 0 0 18px;list-style:disc">${items.map(i => `<li>${esc(drugLabel(drugById(i.drug)))} — ${i.qty} op. — ${esc(sigLabel(i))} — ${i.refund}</li>`).join('')}</ul>` });
    if (!res) return;
    const doc = issueDoc(id, makeRx({ visit: visitById(id), items, method: res.method }));
    st.rx = []; st.overrides = {};
    logAI(id, `Podpisano e-receptę (kod ${doc.code}): ${doc.items.map(i => drugById(i.drug).inn).join(', ')}`);
    renderRx(); refreshAI();
    modal({ label: 'Wystawiono e-receptę', html: `<div class="modal__body"><span class="okmark">${ic('check')}</span><h2 class="modal__title">Wystawiono ${doc.items.length === 1 ? 'e-receptę' : 'pakiet e-recept'}</h2>
      <div class="big-code"><span class="eyebrow">Kod dostępowy</span><b>${doc.code}</b><span class="muted">pacjentka dostanie go SMS-em i w aplikacji</span></div>
      ${doc.items.map(i => `<p class="key"><b>${esc(drugLabel(drugById(i.drug)))}</b><br>${groupDigits(i.key)}</p>`).join('')}
      <div class="modal__actions"><button type="button" class="btn btn--ghost" data-print="${doc.id}">${ic('print')}Wydruk</button><button type="button" class="btn btn--primary" data-close>Gotowe</button></div></div>` });
  }

  // ---------- e-ZLA ----------
  function renderZla() {
    v = visitById(id);
    const pane = $('#paneZla');
    const issued = docsOf(v).filter(d => d.kind === 'zla');
    const sug = sc.plan.zla;
    const icd = (v.note?.rozpoznanie?.text || noteDraft(v, v.call.done).rozpoznanie || '').match(/^[A-Z]\d{2}(\.\d)?/)?.[0] || '';
    st.zla = st.zla || { from: isoDay(Date.now()), to: isoDay(Date.now() + 4 * DAY), mode: '2', letter: '', icd };
    if (!st.zla.icd && icd) st.zla.icd = icd;
    const z = st.zla, days = Math.round((fromIso(z.to) - fromIso(z.from)) / DAY) + 1;
    pane.innerHTML = `${issued.map(d => `<div class="issued"><span class="mini-doc__ic">${ic('check')}</span><div><b>Wysłano e-ZLA ${d.number}</b><small>${fmtDMY(fromIso(d.from))} – ${fmtDMY(fromIso(d.to))} · ZUS i ${esc(d.payer.name)}</small></div><span class="chip chip--ok">ZUS</span></div>`).join('')}
      ${sug && ai.plan ? `<div class="rx-sugg__row"><div><b>${ic('spark')} Sugestia AI: ${dni(sug.days)}, wskazanie ${sug.mode} — ${sug.mode === '2' ? 'chory może chodzić' : 'chory powinien leżeć'}</b><small>${esc(sug.why)}${ai.docs.zla != null ? ' · pacjentka pyta o zwolnienie' : ''}</small></div>
        <button type="button" class="btn btn--ai btn--sm" id="zlaApply">Zastosuj</button></div>` : ''}
      <div class="card card--pad stack" style="box-shadow:none">
        <h2 class="card__t">${ic('bed')}Zaświadczenie lekarskie e-ZLA</h2>
        <div class="row2"><label class="field"><span>Niezdolność od</span><input class="input" type="date" id="zFrom" value="${z.from}"></label><label class="field"><span>do</span><input class="input" type="date" id="zTo" value="${z.to}"></label></div>
        <p class="muted" style="font-size:13.5px">${days > 0 ? dni(days) : 'nieprawidłowy zakres'} · data wsteczna maks. 3 dni</p>
        <div><p class="label" style="margin-bottom:8px">Wskazania lekarskie</p><div class="radios">
          <label class="check"><input type="radio" name="zMode" value="2" ${z.mode === '2' ? 'checked' : ''}>2 — chory może chodzić</label>
          <label class="check"><input type="radio" name="zMode" value="1" ${z.mode === '1' ? 'checked' : ''}>1 — chory powinien leżeć</label></div></div>
        <div class="row2"><label class="field"><span>Kod literowy</span><select class="select" id="zLetter">${ZLA_CODES.map(([c, l]) => `<option value="${c}" ${c === z.letter ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <label class="field"><span>Kod choroby (ICD-10)</span><input class="input" id="zIcd" value="${esc(z.icd)}" placeholder="np. J03.0"><small class="field__hint">${esc(icdName(z.icd))}</small></label></div>
        <dl class="kv"><dt>Ubezpieczony</dt><dd>${esc(pt.name)}, PESEL ${pt.pesel}</dd><dt>Płatnik</dt><dd>${esc(pt.employer.name)}, NIP ${pt.employer.nip}</dd></dl>
        ${pt.female && ageOf(pt.born) < 50 && ai.qs.find(q => q.id === 'preg')?.done == null && sc.id === 'gardlo' ? `<div class="alertbox">${ic('info')}<span>Nie ustalono, czy pacjentka jest w ciąży — od tego zależy kod B.</span></div>` : ''}
        <button type="button" class="btn btn--primary" id="signZla" style="justify-self:start" ${days > 0 && z.icd ? '' : 'disabled'}>${ic('key')}Podpisz i wyślij do ZUS</button></div>`;
    const upd = () => { z.from = $('#zFrom').value; z.to = $('#zTo').value; z.letter = $('#zLetter').value; z.icd = $('#zIcd').value.trim().toUpperCase(); z.mode = $('[name=zMode]:checked').value; renderZla(); };
    ['#zFrom', '#zTo', '#zLetter', '#zIcd'].forEach(s => $(s).addEventListener('change', upd));
    $$('[name=zMode]').forEach(r => r.addEventListener('change', upd));
    $('#zlaApply')?.addEventListener('click', () => {
      z.to = isoDay(fromIso(z.from) + (sug.days - 1) * DAY); z.mode = sug.mode;
      logAI(id, `Przyjęto sugestię AI: e-ZLA ${dni(sug.days)}, wskazanie ${sug.mode}`);
      renderZla();
    });
    $('#signZla').addEventListener('click', async () => {
      const res = await signFlow({ title: 'Podpisz e-ZLA', target: 'ZUS', summary: `<p>${esc(pt.name)} · ${fmtDMY(fromIso(z.from))} – ${fmtDMY(fromIso(z.to))} (${dni(days)}) · wskazanie ${z.mode} · ${esc(z.icd)}</p>` });
      if (!res) return;
      const doc = issueDoc(id, makeZla(visitById(id), z));
      logAI(id, `Podpisano e-ZLA ${doc.number}`);
      st.zla = null;
      toast(`e-ZLA ${doc.number} wysłane do ZUS (symulacja)`, 'check');
      renderZla(); badge(); refreshAI();
    });
    badge();
  }

  // ---------- lab referral ----------
  function renderRef() {
    v = visitById(id);
    const pane = $('#paneRef');
    const issued = docsOf(v).filter(d => d.kind === 'ref');
    const sug = ai.plan && sc.plan.ref ? sc.plan.ref : null;
    const icd = (v.note?.rozpoznanie?.text || noteDraft(v, v.call.done).rozpoznanie || '').match(/^[A-Z]\d{2}(\.\d)?/)?.[0] || '';
    st.ref = st.ref || { tests: [], icd, note: '' };
    if (!st.ref.icd && icd) st.ref.icd = icd;
    const r = st.ref;
    pane.innerHTML = `${issued.map(d => `<div class="issued"><span class="mini-doc__ic">${ic('check')}</span><div><b>Wystawiono skierowanie</b><small>${d.tests.map(labName).join(', ')}</small></div><div style="text-align:right"><span class="issued__code">${d.code}</span><br><button type="button" class="link-btn" data-print="${d.id}">Wydruk</button></div></div>`).join('')}
      ${sug ? `<div class="rx-sugg__row"><div><b>${ic('spark')} Sugestia AI: ${sug.tests.map(labName).join(', ')}</b><small>${esc(sug.why)}</small></div><button type="button" class="btn btn--ai btn--sm" id="refApply">Zaznacz</button></div>` : ''}
      <div class="card card--pad stack" style="box-shadow:none"><h2 class="card__t">${ic('flask')}Skierowanie na badania laboratoryjne</h2>
        <div class="testgrid">${LAB_TESTS.map(([g, ts]) => `<div><h4>${g}</h4>${ts.map(([tid, l]) => `<label class="check"><input type="checkbox" data-test="${tid}" ${r.tests.includes(tid) ? 'checked' : ''}><span>${esc(l)}${sug && sug.tests.includes(tid) ? '<span class="tag-ai">AI</span>' : ''}</span></label>`).join('')}</div>`).join('')}</div>
        <div class="row2"><label class="field"><span>Rozpoznanie (ICD-10)</span><input class="input" id="rIcd" value="${esc(r.icd)}"><small class="field__hint">${esc(icdName(r.icd))}</small></label>
          <label class="field"><span>Uwagi dla pacjenta</span><input class="input" id="rNote" value="${esc(r.note)}" placeholder="np. na czczo, rano"></label></div>
        <button type="button" class="btn btn--primary" id="signRef" style="justify-self:start" ${r.tests.length && r.icd ? '' : 'disabled'}>${ic('key')}Podpisz i wyślij</button></div>`;
    $$('[data-test]', pane).forEach(c => c.addEventListener('change', () => { r.tests = c.checked ? r.tests.concat(c.dataset.test) : r.tests.filter(x => x !== c.dataset.test); renderRef(); }));
    $('#rIcd').addEventListener('change', e => { r.icd = e.target.value.trim().toUpperCase(); renderRef(); });
    $('#rNote').addEventListener('input', e => { r.note = e.target.value; });
    $('#refApply')?.addEventListener('click', () => { r.tests = [...new Set(r.tests.concat(sug.tests))]; if (!r.note) r.note = sug.note; logAI(id, `Przyjęto sugestię AI: skierowanie (${sug.tests.map(labName).join(', ')})`); renderRef(); });
    $('#signRef').addEventListener('click', async () => {
      const res = await signFlow({ title: 'Podpisz skierowanie', target: 'P1', summary: `<p>${esc(pt.name)} · ${r.tests.map(labName).join(', ')} · ${esc(r.icd)}</p>` });
      if (!res) return;
      const doc = issueDoc(id, makeRef(visitById(id), r));
      logAI(id, `Podpisano skierowanie (kod ${doc.code})`);
      st.ref = null;
      toast(`Skierowanie wystawione · kod ${doc.code}`, 'check');
      renderRef(); badge(); refreshAI();
    });
    badge();
  }

  function badge() {
    v = visitById(id);
    const docs = docsOf(v);
    const set = (sel, n, draft) => { const b = $(sel); b.hidden = !n && !draft; b.textContent = draft ? draft : n; };
    set('#bRx', docs.filter(d => d.kind === 'rx').length ? '✓' : 0, st.rx.length || '');
    set('#bZla', docs.filter(d => d.kind === 'zla').length ? '✓' : 0, '');
    set('#bRef', docs.filter(d => d.kind === 'ref').length ? '✓' : 0, '');
    noteBadge();
  }

  // ---------- finish ----------
  $('#finishBtn').addEventListener('click', async () => {
    v = visitById(id);
    const draft = noteDraft(v, v.call.done), p = callPos(v), docs = docsOf(v);
    const approved = NOTE_SECTIONS.filter(([k]) => v.note?.[k]?.state === 'approved').length;
    const pending = NOTE_SECTIONS.filter(([k]) => draft[k] && !(v.note && v.note[k])).length;
    const warn = [];
    if (!p.ended) warn.push('Rozmowa jeszcze trwa.');
    if (sc.plan.zla && ai.docs.zla != null && !docs.some(d => d.kind === 'zla')) warn.push('Pacjentka prosiła o zwolnienie — e-ZLA nie zostało wystawione.');
    if (ai.plan && !docs.some(d => d.kind === 'rx')) warn.push('Nie wystawiono e-recepty.');
    if (st.rx.length) warn.push(`Na recepcie są niepodpisane leki (${st.rx.length}).`);
    const m = modal({ label: 'Zakończ wizytę', html: `<div class="modal__body"><h2 class="modal__title">Zakończyć wizytę?</h2>
      <ul class="checks"><li>${ic(approved === 4 ? 'check' : 'edit')}<span style="flex:1">Notatka: ${approved}/4 sekcji zatwierdzonych${pending ? `, ${pending} ${plural(pending, 'szkic czeka', 'szkice czekają', 'szkiców czeka')}` : ''}</span></li>
        <li>${ic('doc')}<span style="flex:1">Dokumenty: ${docs.length ? docs.map(d => d.kind === 'rx' ? 'e-recepta ' + d.code : d.kind === 'zla' ? 'e-ZLA' : 'skierowanie').join(', ') : 'brak'}</span></li></ul>
      ${warn.map(w => `<div class="alertbox">${ic('alert')}<span>${esc(w)}</span></div>`).join('')}
      ${pending ? `<label class="check"><input type="checkbox" id="fApprove" checked><span>Zatwierdź pozostałe szkice AI bez zmian</span></label>` : ''}
      <label class="check"><input type="checkbox" id="fSend" checked><span>Wyślij pacjentce podsumowanie i zalecenia</span></label>
      <div class="modal__actions"><button type="button" class="btn btn--ghost" data-close>Wróć</button><button type="button" class="btn btn--primary" id="fGo">${ic('check')}Zakończ i podpisz dokumentację</button></div></div>` });
    $('#fGo', m.el).addEventListener('click', () => {
      const approve = $('#fApprove', m.el)?.checked, send = $('#fSend', m.el).checked;
      updateVisit(id, x => {
        x.note = x.note || {};
        NOTE_SECTIONS.forEach(([k]) => {
          if (!x.note[k] && draft[k] && approve) x.note[k] = { text: draft[k], state: 'approved' };
          if (x.note[k]) x.note[k].state = 'approved';
        });
        x.status = 'done'; x.endedAt = Date.now(); x.summarySent = send;
        x.call.ended = true; x.call.curStart = null;
        (x.aiLog = x.aiLog || []).push({ t: Date.now(), text: `Zakończono wizytę${approve && pending ? `; zatwierdzono ${pending} ${plural(pending, 'szkic', 'szkice', 'szkiców')} AI` : ''}. Transkrypcja usunięta.` });
      });
      m.close();
      toast('Wizyta zakończona. Dokumentacja podpisana.', 'check');
      go('#/lekarz/wizyta/' + id);
    });
  });

  // ---------- player ----------
  const player = createPlayer(id, {
    claim: true,
    onLine: x => {
      v = x;
      ai = aiState(x, x.call.done);
      const p = callPos(x);
      renderTx(p);
      renderAI(p);
      if (ai.plan !== st.plan) {
        st.plan = ai.plan;
        if (ai.plan) toast('AI: propozycja leczenia gotowa — zobacz panel po prawej', 'spark', 'ai');
        if (['recepta', 'zla', 'ref'].includes(st.tab) && !document.activeElement.closest('.pane')) setTab(st.tab);
      }
      if (st.tab === 'notatka' && !document.activeElement.closest('#paneNote')) renderNote();
      badge();
    },
    onFrame: x => {
      if (x.status !== 'active') return;
      const p = callPos(x);
      $('#clock').textContent = fmtClock(p.clock);
      $('#callState').textContent = p.ended ? 'rozmowa zakończona' : p.paused ? 'pauza' : 'rozmowa trwa';
      $('#callState').className = `chip ${p.ended ? '' : p.paused ? 'chip--warn' : 'chip--ok chip--live'}`;
      const cur = $('#curText');
      if (cur && p.cur) cur.textContent = partialText(p.cur.t, p.prog);
      $('#vid')?.classList.toggle('is-talking', !!p.cur && p.cur.who === 'p' && !p.paused);
      $('#selfFeed')?.classList.toggle('is-talking', !!p.cur && p.cur.who === 'd' && !p.paused);
      $('#pp').innerHTML = p.paused ? `${ic('play')}Wznów` : `${ic('pause')}Pauza`;
      $('#pp').disabled = p.ended;
    },
    onEnd: () => { if (!endedAtMount) toast('Rozmowa zakończona — szkic notatki czeka na zatwierdzenie', 'spark', 'ai'); },
  });
  $('#pp').addEventListener('click', () => player.toggle());
  $$('[data-speed]').forEach(b => b.addEventListener('click', () => {
    player.setSpeed(+b.dataset.speed);
    $$('[data-speed]').forEach(x => x.classList.toggle('is-on', x === b));
  }));
  $('#skip').addEventListener('click', () => player.skip());
  $('#restart').addEventListener('click', () => { st.factCount = 0; player.restart(); });

  return {
    leave() { player.stop(); document.body.classList.remove('is-room'); },
    sync() {},
  };
}
