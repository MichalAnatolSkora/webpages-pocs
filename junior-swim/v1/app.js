/* Junior Swim v1 — group finder, levels lane, schedule filter, prices, bag checklist, demo signup. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const ARROW = '<svg><use href="#i-arrow"/></svg>';
  const CHECK = '<svg><use href="#i-check"/></svg>';

  /* ---------- data (sample content) ---------- */
  const LEVELS = [
    {
      id: 'kijanka', name: 'Kijanka', age: '3–5 lat', min: 3, max: 6, group: 'do 4 dzieci', color: '#a78bfa', ring: '#6d4fd8',
      desc: 'Pierwsze spotkanie z dużą wodą. Płytka niecka, zabawki i dużo śmiechu — dziecko uczy się, że woda jest przyjacielem.',
      skills: ['Wchodzi do wody samo, po schodkach', 'Robi bąbelki ustami i nosem', 'Moczy twarz bez płaczu', 'Leży na plecach z makaronem', 'Skacze z brzegu do instruktora'],
    },
    {
      id: 'zabka', name: 'Żabka', age: '5–7 lat', min: 5, max: 8, group: 'do 5 dzieci', color: '#6fd14f', ring: '#3a9a1f',
      desc: 'Oswojone dziecko zaczyna się unosić i ślizgać. Pierwsze kopnięcia nogami i odwaga pod wodą.',
      skills: ['Zanurza całą głowę i otwiera oczy', 'Unosi się na brzuchu i na plecach', 'Poślizg ze startu od ściany', 'Praca nóg z deską przez 10 m', 'Wyławia krążek z płytkiej wody'],
    },
    {
      id: 'rybka', name: 'Rybka', age: '6–9 lat', min: 6, max: 10, group: 'do 6 dzieci', color: '#ff9f43', ring: '#d9721a',
      desc: 'Nauka pierwszych stylów: kraul na piersiach i na grzbiecie. Oddech z boku zamiast „głowa nad wodą”.',
      skills: ['Kraul na grzbiecie 15 m', 'Kraul na piersiach z wydechem do wody', 'Oddech na bok co 3 ruchy', 'Skok do głębokiej wody i wypłynięcie', 'Przepływa 25 m bez przyborów'],
    },
    {
      id: 'delfin', name: 'Delfin', age: '8–12 lat', min: 7, max: 13, group: 'do 6 dzieci', color: '#3aa0ff', ring: '#1667c9',
      desc: 'Dziecko pływa swobodnie. Doskonalimy technikę, dodajemy żabkę i delfina, budujemy wytrzymałość.',
      skills: ['Kraul i grzbiet po 50 m', 'Żabka z poprawnym ruchem nóg', 'Delfin — fala i praca nóg', 'Nawrót koziołkowy', 'Start ze słupka'],
    },
    {
      id: 'rekin', name: 'Rekin', age: '10–14 lat', min: 10, max: 15, group: 'do 8 osób', color: '#0d3b5c', ring: '#ff6b5b',
      desc: 'Dla tych, którzy chcą więcej: trening z zegarem, wszystkie style, przygotowanie do pierwszych zawodów.',
      skills: ['Wszystkie 4 style po 100 m', 'Nawroty i starty pod zawody', 'Trening interwałowy z zegarem', 'Ratowanie: holowanie kolegi 10 m', 'Szkolne zawody w drużynie'],
    },
  ];
  const POOLS = [
    { id: 'p', name: 'Pływalnia Północ' },
    { id: 'c', name: 'Pływalnia Centrum' },
  ];
  const DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const DAY_NAMES = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  // [day, time, level, pool, free places]
  const SLOTS = [
    [0, '16:00', 'kijanka', 'p', 2], [0, '16:45', 'zabka', 'p', 3], [0, '17:30', 'rybka', 'p', 1], [0, '18:15', 'delfin', 'c', 4],
    [1, '15:30', 'zabka', 'c', 1], [1, '16:15', 'rybka', 'c', 4], [1, '17:00', 'delfin', 'c', 2], [1, '18:00', 'rekin', 'c', 3],
    [2, '16:00', 'kijanka', 'c', 3], [2, '16:45', 'zabka', 'p', 2], [2, '17:30', 'rybka', 'p', 5],
    [3, '15:30', 'kijanka', 'p', 1], [3, '16:15', 'rybka', 'c', 2], [3, '17:00', 'delfin', 'p', 3], [3, '18:00', 'rekin', 'c', 1],
    [4, '16:00', 'zabka', 'c', 4], [4, '16:45', 'rybka', 'p', 3], [4, '17:30', 'delfin', 'p', 1],
    [5, '9:00', 'kijanka', 'p', 2], [5, '9:45', 'kijanka', 'c', 4], [5, '10:30', 'zabka', 'p', 1], [5, '11:15', 'rybka', 'c', 2], [5, '12:00', 'delfin', 'c', 3], [5, '13:00', 'rekin', 'p', 5],
  ].map(([d, t, l, p, free], i) => ({ id: 's' + i, d, t, l, p, free }));

  const TICKETS = [
    { id: 'try', name: 'Lekcja próbna', sub: 'Jedne zajęcia, żeby sprawdzić, czy to „to”.', once: 49, perks: ['45 minut w wodzie', 'rozmowa z instruktorem po zajęciach', 'czepek w kolorze poziomu'], cta: 'Zapisz na próbną' },
    { id: 'one', name: '1× w tygodniu', sub: 'Stała godzina, 4 zajęcia w miesiącu.', month: 200, lessons: 4, perks: ['dzienniczek z pieczątkami', 'odrabianie w innej grupie', 'sprawdzian na naszywkę'], cta: 'Wybierz termin' },
    { id: 'two', name: '2× w tygodniu', sub: 'Najszybsze postępy, 8 zajęć w miesiącu.', month: 360, lessons: 8, hot: 'najczęściej wybierany', perks: ['wszystko z 1× w tygodniu', 'dwa dni do wyboru', 'notatka o postępach co 2 tygodnie'], cta: 'Wybierz terminy' },
  ];
  const TERM_MONTHS = 5;

  const BAG = ['Strój kąpielowy', 'Czepek', 'Klapki', 'Ręcznik', 'Okularki', 'Szampon i żel', 'Butelka wody', 'Przekąska na po'];

  const level = id => LEVELS.find(l => l.id === id);
  const pool = id => POOLS.find(p => p.id === id);

  /* ---------- badge (sew-on patch) ---------- */
  function patch(l, cls = 'patch') {
    const n = 18, cx = 50, cy = 50, r = 47, rr = 4.6;
    let d = '';
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * (r - rr), y = cy + Math.sin(a) * (r - rr);
      d += i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : ` A${rr} ${rr} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    const icons = {
      kijanka: '<circle cx="42" cy="46" r="13" fill="#fff"/><path d="M53 50c8 2 10 10 18 9 6 0 8-6 12-4" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="38" cy="43" r="3.4" fill="#0d3b5c"/><circle cx="46" cy="42" r="3.4" fill="#0d3b5c"/>',
      zabka: '<ellipse cx="50" cy="54" rx="22" ry="15" fill="#fff"/><circle cx="38" cy="40" r="8" fill="#fff"/><circle cx="62" cy="40" r="8" fill="#fff"/><circle cx="38" cy="40" r="3.6" fill="#0d3b5c"/><circle cx="62" cy="40" r="3.6" fill="#0d3b5c"/><path d="M40 58c6 5 14 5 20 0" stroke="#0d3b5c" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
      rybka: '<path d="M26 50c10-16 34-16 44 0-10 16-34 16-44 0z" fill="#fff"/><path d="M68 50l14-11v22z" fill="#fff"/><circle cx="38" cy="47" r="3.6" fill="#0d3b5c"/><path d="M48 42c3 4 3 12 0 16" stroke="' + l.color + '" stroke-width="3" fill="none" stroke-linecap="round"/>',
      delfin: '<path d="M22 60c6-18 26-28 46-22l4-10 6 14c6 4 4 10-2 10-14-2-24 2-34 12-4-6-12-6-20-4z" fill="#fff"/><circle cx="64" cy="46" r="2.8" fill="#0d3b5c"/><path d="M22 72c8-5 14 5 22 0s14 5 22 0 12 4 14 2" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>',
      rekin: '<path d="M30 62c8-14 14-30 26-38-2 14 4 28 14 38z" fill="#fff"/><path d="M18 66c8-6 14 6 22 0s14 6 22 0 14 6 22 0" stroke="#7fe3ff" stroke-width="5" fill="none" stroke-linecap="round"/>',
    };
    return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">
      <path d="${d}Z" fill="${l.ring}"/>
      <circle cx="50" cy="50" r="38" fill="${l.color}"/>
      <circle cx="50" cy="50" r="40.5" fill="none" stroke="#fff" stroke-width="1.8" stroke-dasharray="3.2 3"/>
      ${icons[l.id]}
    </svg>`;
  }

  /* ---------- nav ---------- */
  const burger = $('.burger'), nav = $('#nav');
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', open);
    nav.classList.toggle('open', open);
  });
  nav.addEventListener('click', e => {
    if (e.target.closest('a')) { burger.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); }
  });

  /* ---------- bubbles ---------- */
  $$('.bubbles').forEach(box => {
    const count = box.classList.contains('bubbles--deep') ? 18 : 14;
    for (let i = 0; i < count; i++) {
      const b = document.createElement('span');
      const s = 6 + Math.random() * 20;
      b.className = 'bubble';
      b.style.cssText = `width:${s}px;height:${s}px;left:${Math.random() * 100}%;animation-duration:${6 + Math.random() * 8}s;animation-delay:${-Math.random() * 12}s`;
      box.appendChild(b);
    }
  });

  /* ---------- levels lane ---------- */
  const lane = $('#lane'), card = $('#level-card');
  lane.innerHTML = LEVELS.map((l, i) => `
    <button class="lane__btn" role="tab" id="tab-${l.id}" data-level="${l.id}" aria-controls="level-card" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
      ${patch(l)}
      <span class="lane__name">${l.name}</span>
      <span class="lane__age">${l.age}</span>
    </button>`).join('');

  function showLevel(id, focus) {
    const l = level(id);
    $$('.lane__btn', lane).forEach(b => {
      const on = b.dataset.level === id;
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    const btn = $(`[data-level="${id}"]`, lane);
    const arrow = btn.offsetLeft + btn.offsetWidth / 2;
    card.style.setProperty('--arrow', arrow + 'px');
    card.setAttribute('aria-labelledby', 'tab-' + id);
    card.innerHTML = `
      ${patch(l)}
      <div>
        <h3>${l.name}</h3>
        <div class="level-card__meta"><span>${l.age}</span><span>${l.group}</span><span>45 min</span></div>
        <p class="level-card__desc">${l.desc}</p>
        <button class="btn btn--sun level-card__go" type="button" data-show="${l.id}">Pokaż godziny ${ARROW}</button>
      </div>
      <div>
        <h4>Na naszywkę trzeba umieć:</h4>
        <ul class="skills">${l.skills.map(s => `<li>${CHECK}<span>${s}</span></li>`).join('')}</ul>
      </div>`;
    card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
  }
  lane.addEventListener('click', e => {
    const b = e.target.closest('.lane__btn');
    if (b) showLevel(b.dataset.level);
  });
  lane.addEventListener('keydown', e => {
    const i = LEVELS.findIndex(l => l.id === $('[aria-selected="true"]', lane).dataset.level);
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % LEVELS.length;
    if (e.key === 'ArrowLeft') n = (i - 1 + LEVELS.length) % LEVELS.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = LEVELS.length - 1;
    if (n !== null) { e.preventDefault(); showLevel(LEVELS[n].id, true); }
  });
  card.addEventListener('click', e => {
    const b = e.target.closest('[data-show]');
    if (b) goSchedule(b.dataset.show);
  });
  window.addEventListener('resize', () => showLevelArrow());
  function showLevelArrow() {
    const btn = $('[aria-selected="true"]', lane);
    if (btn) card.style.setProperty('--arrow', btn.offsetLeft + btn.offsetWidth / 2 + 'px');
  }

  /* ---------- group finder ---------- */
  const AGES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  $('#age-pills').innerHTML = AGES.map(a => `<label><input type="radio" name="age" value="${a}"><span>${a === 14 ? '14+' : a}</span></label>`).join('');
  const finder = $('#finder'), out = $('#finder-out');

  function recommend(age, skill) {
    if (skill === 0) return age <= 6 ? 'kijanka' : 'zabka';
    if (skill === 1) return age <= 4 ? 'kijanka' : age <= 9 ? 'zabka' : 'rybka';
    if (skill === 2) return age <= 6 ? 'zabka' : age <= 10 ? 'rybka' : 'delfin';
    return age <= 7 ? 'rybka' : age <= 10 ? 'delfin' : 'rekin';
  }
  finder.addEventListener('change', () => {
    const age = +(finder.age.value || 0), skill = finder.skill.value;
    if (!age || skill === '') {
      out.innerHTML = `<span class="board__placeholder">${!age ? 'Teraz wybierz wiek' : 'Teraz wybierz umiejętności'}</span>`;
      return;
    }
    const l = level(recommend(age, +skill));
    const count = SLOTS.filter(s => s.l === l.id).length;
    out.innerHTML = `${patch(l)}
      <div class="board__res">
        <b>Grupa ${l.name}</b>
        <span>${l.age}, ${l.group}. ${count} ${count === 1 ? 'termin' : count < 5 ? 'terminy' : 'terminów'} w tygodniu.</span><br>
        <a href="#grafik" data-show="${l.id}">Pokaż godziny ${ARROW}</a>
      </div>`;
    out.classList.remove('pop'); void out.offsetWidth; out.classList.add('pop');
    signup.age.value = age;
    signup.level.value = l.id;
    fillSlots();
  });
  finder.addEventListener('submit', e => e.preventDefault());
  out.addEventListener('click', e => {
    const a = e.target.closest('[data-show]');
    if (a) { e.preventDefault(); showLevel(a.dataset.show); goSchedule(a.dataset.show); }
  });

  /* ---------- schedule ---------- */
  const filt = { level: 'all', pool: 'all' };
  let picked = null;
  const fLevel = $('#f-level'), fPool = $('#f-pool'), week = $('#week');
  fLevel.innerHTML = `<button type="button" data-v="all" aria-pressed="true">Wszystkie</button>` +
    LEVELS.map(l => `<button type="button" data-v="${l.id}" aria-pressed="false"><i style="background:${l.color}"></i>${l.name}</button>`).join('');
  fPool.innerHTML = `<button type="button" data-v="all" aria-pressed="true">Oba baseny</button>` +
    POOLS.map(p => `<button type="button" data-v="${p.id}" aria-pressed="false">${p.name}</button>`).join('');

  function renderWeek(animate) {
    $$('button', fLevel).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === filt.level));
    $$('button', fPool).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === filt.pool));
    week.innerHTML = DAYS.map((d, di) => {
      const list = SLOTS.filter(s => s.d === di && (filt.level === 'all' || s.l === filt.level) && (filt.pool === 'all' || s.p === filt.pool));
      return `<div class="day"><h3>${d}</h3>${list.length ? list.map(s => {
        const l = level(s.l);
        return `<button type="button" class="slot${animate ? ' enter' : ''}${picked === s.id ? ' is-picked' : ''}" data-slot="${s.id}" style="--c:${l.color}" aria-label="${DAY_NAMES[s.d]} ${s.t}, ${l.name}, ${pool(s.p).name}, wolne miejsca: ${s.free}">
          <b>${s.t}</b><span>${l.name}</span><span>${pool(s.p).name.replace('Pływalnia ', '')}</span>
          <em class="${s.free <= 1 ? 'low' : ''}">${s.free <= 1 ? 'ostatnie miejsce' : 'wolne: ' + s.free}</em>
        </button>`;
      }).join('') : '<p class="day__empty">brak zajęć</p>'}</div>`;
    }).join('');
  }
  fLevel.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { filt.level = b.dataset.v; renderWeek(true); } });
  fPool.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { filt.pool = b.dataset.v; renderWeek(true); } });
  week.addEventListener('click', e => {
    const b = e.target.closest('.slot');
    if (!b) return;
    const s = SLOTS.find(x => x.id === b.dataset.slot);
    picked = s.id;
    signup.level.value = s.l;
    fillSlots();
    signup.slot.value = s.id;
    renderWeek(false);
    $('#zapisy').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setTimeout(() => signup.child.focus({ preventScroll: true }), 600);
  });
  function goSchedule(id) {
    filt.level = id;
    renderWeek(true);
    $('#grafik').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  /* ---------- pricing ---------- */
  const tickets = $('#tickets');
  const zl = n => n.toLocaleString('pl-PL') + ' zł';
  function renderTickets() {
    const term = document.querySelector('input[name="period"]:checked').value === 'term';
    tickets.innerHTML = TICKETS.map(t => {
      let price, per;
      if (t.once) { price = zl(t.once); per = 'jednorazowo'; }
      else if (term) {
        const total = Math.round(t.month * TERM_MONTHS * 0.9);
        price = zl(total);
        per = `za semestr (${TERM_MONTHS} mies.) · ${zl(Math.round(total / (t.lessons * TERM_MONTHS)))} za lekcję`;
      } else { price = zl(t.month) + '<small> / mies.</small>'; per = `${zl(Math.round(t.month / t.lessons))} za lekcję`; }
      return `<article class="ticket${t.hot ? ' ticket--hot' : ''}">
        ${t.hot ? `<span class="ticket__tag">${t.hot}</span>` : ''}
        <h3>${t.name}</h3>
        <p class="ticket__sub">${t.sub}</p>
        <div class="ticket__price">${price}</div>
        <div class="ticket__per">${per}</div>
        <div class="ticket__cut"></div>
        <ul>${t.perks.map(p => `<li>${CHECK}<span>${p}</span></li>`).join('')}</ul>
        <a class="btn ${t.hot ? 'btn--line' : 'btn--sun'}" href="${t.once ? '#zapisy' : '#grafik'}">${t.cta} ${ARROW}</a>
      </article>`;
    }).join('');
  }
  $$('input[name="period"]').forEach(r => r.addEventListener('change', renderTickets));

  /* ---------- bag checklist ---------- */
  const KEY = 'junior-swim-bag';
  let packed = [];
  try { packed = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { packed = []; }
  const bag = $('#bag');
  bag.innerHTML = BAG.map((b, i) => `<li><label><input type="checkbox" value="${i}" ${packed.includes(i) ? 'checked' : ''}><span>${b}</span></label></li>`).join('');
  function bagState() {
    packed = $$('input:checked', bag).map(c => +c.value);
    $('#bag-count').textContent = `${packed.length} / ${BAG.length}`;
    $('#bag-done').hidden = packed.length !== BAG.length;
    try { localStorage.setItem(KEY, JSON.stringify(packed)); } catch (e) { /* storage unavailable */ }
  }
  bag.addEventListener('change', bagState);

  /* ---------- signup ---------- */
  const signup = $('#signup');
  signup.age.innerHTML = '<option value="">—</option>' + AGES.map(a => `<option value="${a}">${a === 14 ? '14+' : a} lat</option>`).join('');
  signup.level.innerHTML = '<option value="">—</option>' + LEVELS.map(l => `<option value="${l.id}">${l.name}</option>`).join('') + '<option value="?">Nie wiem — doradźcie</option>';
  function fillSlots() {
    const lv = signup.level.value, cur = signup.slot.value;
    const list = SLOTS.filter(s => !lv || lv === '?' || s.l === lv);
    signup.slot.innerHTML = '<option value="">' + (list.length ? 'wybierz termin' : '—') + '</option>' +
      list.map(s => `<option value="${s.id}">${DAY_NAMES[s.d]} ${s.t} · ${level(s.l).name} · ${pool(s.p).name}</option>`).join('');
    if (list.some(s => s.id === cur)) signup.slot.value = cur;
  }
  signup.level.addEventListener('change', fillSlots);
  signup.addEventListener('input', e => e.target.closest('.field, .consent')?.classList.remove('bad'));
  signup.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    ['child', 'age', 'level', 'slot', 'parent'].forEach(n => {
      const bad = !signup[n].value.trim();
      signup[n].closest('.field').classList.toggle('bad', bad);
      if (bad && ok) { signup[n].focus(); ok = false; }
    });
    const consentBad = !signup.ok.checked;
    signup.ok.closest('.consent').classList.toggle('bad', consentBad);
    if (!ok || consentBad) return;
    const s = SLOTS.find(x => x.id === signup.slot.value);
    const child = signup.child.value.trim().replace(/[<>&]/g, '');
    signup.innerHTML = `<div class="signup__ok" role="status">
      <svg aria-hidden="true"><use href="#duck"/></svg>
      <h3>Do zobaczenia w wodzie, ${child}!</h3>
      <p>Tak wyglądałoby potwierdzenie. To wersja demonstracyjna — nic nie zostało wysłane.</p>
      <div class="ticket-mini">${DAY_NAMES[s.d]}, ${s.t}<br>${level(s.l).name} · ${pool(s.p).name}<br>lekcja próbna, 45 min</div>
    </div>`;
  });

  /* ---------- proposal drawer ---------- */
  const dlg = $('#changes');
  const openChanges = () => dlg.showModal();
  $('#fab').addEventListener('click', openChanges);
  $('#open-changes').addEventListener('click', openChanges);
  $('#close-changes').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  /* ---------- init ---------- */
  showLevel('kijanka');
  renderWeek(false);
  renderTickets();
  bagState();
  fillSlots();
})();
