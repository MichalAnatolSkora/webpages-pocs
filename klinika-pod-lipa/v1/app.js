/* Klinika pod Lipą — v1
   Everything is client-side: opening status from the real clock,
   seasons on the linden, the floor plan and a simulated booking. */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- calendar words ----------
  const DAY_IN = ['w niedzielę', 'w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę'];
  const DAY_NAME = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const MONTH_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const MONTH_NOM = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

  const pad = n => String(n).padStart(2, '0');
  const hm = mins => `${Math.floor(mins / 60)}:${pad(mins % 60)}`;
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const sameDay = (a, b) => iso(a) === iso(b);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  function relDay(d, now = new Date()) {
    const diff = Math.round((fromIso(iso(d)) - fromIso(iso(now))) / 864e5);
    if (diff === 0) return 'dziś';
    if (diff === 1) return 'jutro';
    return DAY_IN[d.getDay()];
  }

  // ---------- who works when ----------
  const CLINIC = { 1: [8, 18], 2: [8, 18], 3: [8, 18], 4: [10, 19], 5: [8, 15], 6: [9, 13] };

  const PEOPLE = {
    ewa: {
      name: 'dr Ewa Brzozowska', role: 'lekarka rodzinna', face: '#face-ewa', slot: 30,
      visit: 'Wizyta u lekarza rodzinnego', price: '220 zł',
      hours: { 1: [8, 15], 2: [11, 18], 3: [8, 15], 4: [12, 19], 5: [8, 15] },
    },
    tomasz: {
      name: 'lek. Tomasz Wrona', role: 'pediatra', face: '#face-tomasz', slot: 30,
      visit: 'Wizyta pediatryczna', price: '220 zł',
      hours: { 1: [13, 18], 2: [8, 13], 3: [13, 18], 4: [10, 15], 6: [9, 13] },
    },
    krystyna: {
      name: 'Krystyna Malec', role: 'pielęgniarka', face: '#face-krystyna', slot: 15,
      hours: { 1: [8, 12], 2: [8, 12], 3: [8, 12], 4: [10, 14], 5: [8, 12] },
    },
    basia: { name: 'Basia', role: 'rejestracja', face: '#face-basia' },
  };

  const SERVICES = {
    pobranie: { label: 'Pobranie krwi', price: '20 zł + badania' },
    szczepienie: { label: 'Szczepienie', price: '50 zł + szczepionka' },
    zastrzyk: { label: 'Zastrzyk', price: '30 zł' },
    opatrunek: { label: 'Zmiana opatrunku', price: '40 zł' },
    ekg: { label: 'EKG z opisem', price: '90 zł' },
  };

  // ---------- theme: the lamp ----------
  const root = document.documentElement;
  const lamp = $('#lamp');
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const isEvening = () => (root.dataset.theme ? root.dataset.theme === 'dark' : darkMq.matches);
  const themeMeta = $('meta[name="theme-color"]');

  function syncLamp() {
    const on = isEvening();
    lamp.setAttribute('aria-pressed', String(on));
    lamp.title = on ? 'Zgaś lampę — dzienne kolory' : 'Zapal lampę — wieczorne kolory';
    themeMeta.setAttribute('content', on ? '#1d1814' : '#f6efe3');
  }
  lamp.addEventListener('click', () => {
    const next = isEvening() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('podlipa-theme', next); } catch (e) { /* private mode */ }
    syncLamp();
  });
  darkMq.addEventListener('change', syncLamp);
  syncLamp();

  // ---------- open / closed ----------
  const house = $('#house');

  function clinicStatus(now = new Date()) {
    const d = now.getDay();
    const mins = now.getHours() * 60 + now.getMinutes();
    const t = CLINIC[d];
    if (t && mins >= t[0] * 60 && mins < t[1] * 60) {
      const left = t[1] * 60 - mins;
      return {
        open: true,
        text: left <= 60 ? `Otwarte jeszcze ${left} min — do ${t[1]}:00` : `Otwarte · dziś do ${t[1]}:00 · Basia odbiera telefon`,
        short: `Otwarte do ${t[1]}:00`,
      };
    }
    if (t && mins < t[0] * 60) {
      return { open: false, text: `Jeszcze zamknięte · otwieramy dziś o ${t[0]}:00`, short: `Otwieramy dziś o ${t[0]}:00` };
    }
    for (let i = 1; i <= 7; i++) {
      const nd = (d + i) % 7;
      if (CLINIC[nd]) {
        const when = i === 1 ? 'jutro' : DAY_IN[nd];
        return { open: false, text: `Zamknięte · otwieramy ${when} o ${CLINIC[nd][0]}:00`, short: `Zamknięte, ${when} od ${CLINIC[nd][0]}:00` };
      }
    }
  }

  function renderStatus() {
    const s = clinicStatus();
    $('#status').classList.toggle('is-open', s.open);
    $('#statusText').textContent = s.text;
    $('#footStatus').textContent = s.short;
    $('#signStatus').textContent = s.open ? 'otwarte' : 'zamknięte';
    house.dataset.open = String(s.open);

    const today = new Date().getDay();
    $$('#hours tr').forEach(tr => {
      const isToday = Number(tr.dataset.day) === today;
      tr.classList.toggle('is-today', isToday);
      const th = tr.querySelector('th');
      const tag = th.querySelector('.today-tag');
      if (isToday && !tag) th.insertAdjacentHTML('beforeend', ' <span class="today-tag">dziś</span>');
      if (!isToday && tag) tag.remove();
    });
  }
  renderStatus();
  setInterval(renderStatus, 60 * 1000);

  // ---------- seasons on the linden ----------
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_PL = { spring: 'Wiosna', summer: 'Lato', autumn: 'Jesień', winter: 'Zima' };
  const SEASON_NOTE = {
    spring: 'Lipa wypuszcza pierwsze liście, a na trawie kwitną stokrotki.',
    summer: 'Lipiec to miesiąc lipy. Kwitnie tak, że pachnie cała ulica.',
    autumn: 'Lipa złoci się, a w piecu kaflowym już napalone.',
    winter: 'Lipa śpi pod śniegiem. W poczekalni ciepło od pieca.',
  };
  const m = new Date().getMonth();
  const realSeason = m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';

  function setSeason(s) {
    house.dataset.season = s;
    $('#seasonLabel').textContent = SEASON_PL[s] + (s === realSeason ? ' · teraz' : '');
    $('#seasonNote').textContent = SEASON_NOTE[s];
    $('#seasonBtn').setAttribute('aria-label', `Pora roku na ilustracji: ${SEASON_PL[s].toLowerCase()}. Kliknij, żeby zmienić.`);
  }
  const nextSeason = () => setSeason(SEASONS[(SEASONS.indexOf(house.dataset.season) + 1) % 4]);
  $('#seasonBtn').addEventListener('click', nextSeason);
  $('#tree').addEventListener('click', nextSeason);
  setSeason(realSeason);

  // ---------- floor plan ----------
  const ROOMS = {
    ganek: {
      name: 'Ganek', kicker: 'Tu wszystko się zaczyna',
      text: 'Zadaszony, z ławeczką, wycieraczką i haczykiem na smycz. Obok schodów jest łagodny podjazd — wjedziesz wózkiem dziecięcym i inwalidzkim.',
      who: [], detail: 'Na drzwiach wisi tabliczka „otwarte”. Basia przekręca ją codziennie rano.',
    },
    poczekalnia: {
      name: 'Poczekalnia', kicker: 'Dawny salon dziadków',
      text: 'Piec kaflowy z 1934 roku wciąż grzeje, na stole stoi dzbanek z herbatą, a na półce czekają książki i gazety z tego tygodnia. W rogu kącik dla dzieci: dywan, klocki i stolik do rysowania.',
      who: ['basia'], detail: 'Sześć krzeseł. Umawiamy wizyty z zapasem, więc rzadko wszystkie są zajęte.',
    },
    rejestracja: {
      name: 'Rejestracja', kicker: 'Królestwo Basi',
      text: 'Tu umówisz kolejną wizytę, odbierzesz wyniki i zapytasz o wszystko, na co nie starczyło czasu w gabinecie. Basia zna wszystkich po imieniu — i większość psów też.',
      who: ['basia'], detail: 'Czajnik stoi tuż obok telefonu. To nie przypadek.',
    },
    'gabinet-ewy': {
      name: 'Gabinet dr Ewy', kicker: 'Dawny pokój dziadka',
      text: 'Duże okno na lipę, biurko po dziadku i kozetka za parawanem. Pół godziny wystarcza, żeby porozmawiać o wszystkim, nie tylko o objawach.',
      who: ['ewa'], detail: 'Na parapecie stoi pelargonia, która pamięta pierwszego pacjenta z 2012 roku.',
    },
    'gabinet-dzieci': {
      name: 'Gabinet dziecięcy', kicker: 'Pokój z gwiazdami',
      text: 'Sufit pomalowany w gwiazdozbiory, waga w kształcie żółwia i pudełko naklejek dla dzielnych. Najpierw osłuchujemy misia, potem dziecko.',
      who: ['tomasz'], detail: 'Naklejki dostają też dorośli — wystarczy poprosić.',
    },
    zabiegowy: {
      name: 'Gabinet zabiegowy', kicker: 'Igły, ale bez strachu',
      text: 'Pobrania krwi, szczepienia, zastrzyki, opatrunki i EKG. Fotel stoi przodem do okna, więc zamiast na igłę można patrzeć na lipę.',
      who: ['krystyna'], detail: 'Wyniki z laboratorium przychodzą zwykle następnego dnia — Basia da znać SMS-em.',
    },
    lazienka: {
      name: 'Łazienka', kicker: 'Mała, ale przemyślana',
      text: 'Bez progów, z poręczami i przewijakiem. Ciepła woda, miękkie ręczniki papierowe i mydło, które pachnie… no właśnie, lipą.',
      who: [], detail: 'Na drzwiach wisi rysunek od sześcioletniej Mai. Wisi od 2019 roku.',
    },
    ogrod: {
      name: 'Ogród', kicker: 'Latem druga poczekalnia',
      text: 'Ławka pod lipą, grządka mięty i cień przez całe popołudnie. Od maja do września można tu poczekać na wizytę — Basia zawoła przez okno.',
      who: [], detail: 'Około dziesiątej wpada ruda Kluska, kotka sąsiadów. Nie jest pacjentką, ale ma swoją miseczkę.',
    },
  };

  const panel = $('#roomPanel');
  function selectRoom(id) {
    const r = ROOMS[id];
    if (!r) return;
    $$('#plan .room').forEach(g => g.classList.toggle('is-active', g.dataset.room === id));
    $$('#roomChips .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.room === id)));
    $('#rpKicker').textContent = r.kicker;
    $('#rpName').textContent = r.name;
    $('#rpText').textContent = r.text;
    $('#rpDetail').textContent = r.detail;
    $('#rpWho').innerHTML = r.who.map(p =>
      `<span class="who-chip"><svg viewBox="0 0 120 120" aria-hidden="true"><use href="${PEOPLE[p].face}"/></svg>${PEOPLE[p].name}</span>`
    ).join('');
    panel.classList.remove('is-swap');
    void panel.offsetWidth;
    panel.classList.add('is-swap');
  }
  $('#plan').addEventListener('click', e => {
    const g = e.target.closest('[data-room]');
    if (g) selectRoom(g.dataset.room);
  });
  $('#roomChips').addEventListener('click', e => {
    const c = e.target.closest('[data-room]');
    if (c) selectRoom(c.dataset.room);
  });
  selectRoom('poczekalnia');

  // ---------- booking ----------
  const form = $('#bookForm');
  const ticket = $('#ticket');
  const booked = new Set();
  const state = { who: 'ewa', date: null, time: null };

  // Deterministic "busy-ness" so the calendar looks lived-in but stable between reloads.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }

  function slotsFor(who, date) {
    const p = PEOPLE[who];
    const t = p.hours[date.getDay()];
    if (!t) return null;
    const now = new Date();
    const today = sameDay(date, now);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const day = iso(date);
    const out = [];
    for (let mins = t[0] * 60; mins + p.slot <= t[1] * 60; mins += p.slot) {
      const time = hm(mins);
      const key = `${who}|${day}|${time}`;
      const taken = (today && mins < nowMins + 60) || hash(key) < 0.56 || booked.has(key);
      out.push({ time, mins, taken });
    }
    return out;
  }

  function calendarDays() {
    const now = new Date();
    const monday = addDays(fromIso(iso(now)), -((now.getDay() + 6) % 7));
    return Array.from({ length: 21 }, (_, i) => addDays(monday, i));
  }

  function firstFree(who) {
    const now = new Date();
    for (const d of calendarDays()) {
      if (fromIso(iso(d)) < fromIso(iso(now))) continue;
      const slots = slotsFor(who, d);
      const free = slots && slots.find(s => !s.taken);
      if (free) return { date: d, time: free.time };
    }
    return null;
  }

  function renderCalendar() {
    const now = new Date();
    const days = calendarDays();
    const visible = days.filter(d => fromIso(iso(d)) >= fromIso(iso(now)));
    const a = visible[0], b = visible[visible.length - 1];
    $('#calMonth').textContent = a.getMonth() === b.getMonth()
      ? `${MONTH_NOM[a.getMonth()]} ${a.getFullYear()}`
      : `${MONTH_NOM[a.getMonth()]} – ${MONTH_NOM[b.getMonth()]} ${b.getFullYear()}`;

    $('#calGrid').innerHTML = days.map(d => {
      const past = fromIso(iso(d)) < fromIso(iso(now));
      if (past) return `<button type="button" class="day is-pad" disabled tabindex="-1" aria-hidden="true"><span class="day__n">${d.getDate()}</span></button>`;
      const slots = slotsFor(state.who, d);
      const free = slots ? slots.filter(s => !s.taken).length : 0;
      const dots = free === 0 ? 0 : free >= 5 ? 3 : free >= 2 ? 2 : 1;
      const label = `${DAY_NAME[d.getDay()]} ${d.getDate()} ${MONTH_GEN[d.getMonth()]}: ` +
        (!slots ? 'nie przyjmuje' : free === 0 ? 'brak wolnych terminów' : `${free} ${free === 1 ? 'wolny termin' : free < 5 ? 'wolne terminy' : 'wolnych terminów'}`);
      const selected = state.date === iso(d);
      return `<button type="button" class="day${sameDay(d, now) ? ' is-today' : ''}" data-date="${iso(d)}" aria-pressed="${selected}" aria-label="${label}"${free === 0 ? ' disabled' : ''}>` +
        `<span class="day__n">${d.getDate()}</span><span class="day__dots">${'<i></i>'.repeat(dots)}</span></button>`;
    }).join('');
  }

  function renderSlots() {
    const box = $('#slots');
    if (!state.date) { box.innerHTML = '<p class="slots__empty">Najpierw wybierz dzień.</p>'; return; }
    const slots = slotsFor(state.who, fromIso(state.date)) || [];
    if (!slots.some(s => !s.taken)) {
      box.innerHTML = '<p class="slots__empty">Ten dzień jest już pełny — zadzwoń do Basi, wpisze Cię na listę rezerwową.</p>';
      return;
    }
    box.innerHTML = slots.map(s =>
      `<button type="button" class="slot" data-time="${s.time}" aria-pressed="${state.time === s.time}"${s.taken ? ' disabled aria-label="' + s.time + ', zajęte"' : ''}>${s.time}</button>`
    ).join('');
  }

  function renderNextFree() {
    const nf = firstFree(state.who);
    const el = $('#nextFree');
    if (!nf) { el.textContent = 'W najbliższych tygodniach brak wolnych miejsc — zadzwoń, coś wymyślimy.'; return; }
    const when = `${relDay(nf.date)}, ${nf.date.getDate()} ${MONTH_GEN[nf.date.getMonth()]}, o ${nf.time}`;
    el.innerHTML = `Najbliższy wolny termin: <b>${when}</b> <button type="button" id="takeFirst">Biorę</button>`;
    $('#takeFirst').addEventListener('click', () => {
      state.date = iso(nf.date);
      state.time = nf.time;
      renderBooking();
      const btn = $(`.slot[data-time="${nf.time}"]`);
      if (btn) btn.focus();
    });
  }

  function currentVisit() {
    const p = PEOPLE[state.who];
    if (state.who === 'krystyna') {
      const s = SERVICES[$('#fService').value];
      return { what: s.label, price: s.price, len: '15 minut' };
    }
    return { what: p.visit, price: p.price, len: '30 minut' };
  }

  function renderSummary() {
    const p = PEOPLE[state.who];
    $('#sumFace').setAttribute('href', p.face);
    $('#sumName').textContent = p.name;
    $('#sumRole').textContent = p.role;
    const when = $('#sumWhen');
    if (state.date && state.time) {
      const d = fromIso(state.date);
      when.textContent = `${DAY_NAME[d.getDay()]}, ${d.getDate()} ${MONTH_GEN[d.getMonth()]}, ${state.time}`;
      when.classList.remove('is-empty');
    } else {
      when.textContent = state.date ? 'wybierz godzinę' : 'wybierz dzień i godzinę';
      when.classList.add('is-empty');
    }
    const v = currentVisit();
    $('#sumWhat').textContent = v.what;
    $('#sumLen').textContent = v.len;
    $('#sumPrice').textContent = v.price;
  }

  function renderBooking() {
    $$('[data-for]', form).forEach(el => { el.hidden = el.dataset.for !== state.who; });
    renderNextFree();
    renderCalendar();
    renderSlots();
    renderSummary();
  }

  function setWho(who) {
    state.who = who;
    const nf = firstFree(who);
    state.date = nf ? iso(nf.date) : null;
    state.time = null;
    $(`input[name="who"][value="${who}"]`, form).checked = true;
    renderBooking();
  }

  form.addEventListener('change', e => {
    if (e.target.name === 'who') setWho(e.target.value);
    if (e.target.name === 'service') renderSummary();
  });

  $('#calGrid').addEventListener('click', e => {
    const b = e.target.closest('.day[data-date]');
    if (!b || b.disabled) return;
    state.date = b.dataset.date;
    state.time = null;
    renderCalendar();
    renderSlots();
    renderSummary();
    $(`.day[data-date="${state.date}"]`).focus();
  });

  $('#slots').addEventListener('click', e => {
    const b = e.target.closest('.slot');
    if (!b || b.disabled) return;
    state.time = b.dataset.time;
    $$('#slots .slot').forEach(s => s.setAttribute('aria-pressed', String(s === b)));
    $('#errTime').hidden = true;
    renderSummary();
  });

  // Team cards jump straight into booking with the right person picked.
  $$('[data-book]').forEach(a => a.addEventListener('click', () => {
    if (!ticket.hidden) showForm();
    setWho(a.dataset.book);
  }));

  // ---------- validation & submit ----------
  function setError(input, errEl, bad) {
    errEl.hidden = !bad;
    if (input) input.setAttribute('aria-invalid', String(bad));
    return bad;
  }

  form.addEventListener('input', e => {
    if (e.target.getAttribute('aria-invalid') === 'true') {
      e.target.setAttribute('aria-invalid', 'false');
      const err = document.getElementById(e.target.getAttribute('aria-describedby'));
      if (err) err.hidden = true;
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#fName'), phone = $('#fPhone'), child = $('#fChild');
    const digits = phone.value.replace(/[\s-]/g, '').replace(/^(\+48|0048)/, '');
    const bad = [];
    if (setError(null, $('#errTime'), !(state.date && state.time))) bad.push($('#slots .slot:not(:disabled)') || $('#calGrid .day:not(:disabled)'));
    if (setError(name, $('#errName'), name.value.trim().length < 3)) bad.push(name);
    if (setError(phone, $('#errPhone'), !/^\d{9}$/.test(digits))) bad.push(phone);
    if (state.who === 'tomasz' && setError(child, $('#errChild'), child.value.trim().length < 2)) bad.push(child);
    if (state.who !== 'tomasz') setError(child, $('#errChild'), false);
    if (bad.length) { if (bad[0]) bad[0].focus(); return; }

    booked.add(`${state.who}|${state.date}|${state.time}`);
    const d = fromIso(state.date);
    const p = PEOPLE[state.who];
    const v = currentVisit();
    $('#tWhen').textContent = `${capitalize(DAY_IN[d.getDay()])}, ${d.getDate()} ${MONTH_GEN[d.getMonth()]}`;
    $('#tTime').textContent = `godz. ${state.time}`;
    $('#tWho').textContent = p.name;
    $('#tWhat').textContent = state.who === 'tomasz' ? `${v.what} — ${child.value.trim()}` : v.what;
    $('#tName').textContent = name.value.trim();
    ticket.dataset.ics = JSON.stringify({ date: state.date, time: state.time, slot: p.slot, who: p.name, what: v.what });

    form.hidden = true;
    ticket.hidden = false;
    $('#wizyta').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    $('#tWhen').focus({ preventScroll: true });
  });

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function showForm() {
    ticket.hidden = true;
    form.hidden = false;
  }

  $('#againBtn').addEventListener('click', () => {
    ['#fNote', '#fChild'].forEach(s => { $(s).value = ''; });
    $('#fFirst').checked = false;
    showForm();
    setWho(state.who);
    $('input[name="who"]:checked', form).focus();
  });

  // A real .ics file the visitor can drop into their own calendar.
  $('#icsBtn').addEventListener('click', () => {
    const v = JSON.parse(ticket.dataset.ics);
    const [h, mm] = v.time.split(':').map(Number);
    const start = fromIso(v.date); start.setHours(h, mm);
    const end = new Date(start.getTime() + v.slot * 60000);
    const stamp = dt => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Klinika pod Lipa//mock//PL',
      'BEGIN:VEVENT',
      `UID:${v.date}-${v.time.replace(':', '')}@klinika-pod-lipa.mock`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      `SUMMARY:${v.what} — Klinika pod Lipą`,
      `DESCRIPTION:${v.who}. Wejście przez ganek. (mock)`,
      'LOCATION:ul. Lipowa 7\\, Wrocław',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'wizyta-pod-lipa.ics' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  setWho('ewa');

  $('#year').textContent = new Date().getFullYear();
})();
