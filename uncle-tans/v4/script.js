(() => {
  'use strict';

  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const DEBUG = params.has('debug');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => DEBUG || reduceMotion.matches;
  const EASE = 'cubic-bezier(.2, 0, 0, 1)';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const pad = n => String(n).padStart(2, '0');

  if (DEBUG) root.classList.add('debug');

  /* ---------- grid overlay: button, "g" key, ?siatka ---------- */

  const gridBtns = $$('[data-grid-toggle]');
  const setGrid = on => {
    root.classList.toggle('show-grid', on);
    gridBtns.forEach(b => b.setAttribute('aria-pressed', String(on)));
  };
  gridBtns.forEach(b => b.addEventListener('click', () => setGrid(!root.classList.contains('show-grid'))));
  document.addEventListener('keydown', e => {
    if (e.key !== 'g' && e.key !== 'G') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, select, textarea, [contenteditable]')) return;
    setGrid(!root.classList.contains('show-grid'));
  });
  if (params.has('siatka')) setGrid(true);

  /* ---------- mobile menu ---------- */

  const menuBtn = $('#menu-toggle');
  const setMenu = open => {
    root.classList.toggle('nav-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Zamknij' : 'Menu';
  };
  menuBtn.addEventListener('click', () => setMenu(!root.classList.contains('nav-open')));
  $('#nav').addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  const navLinks = $$('.nav a');
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      navLinks.forEach(a => {
        if (a.hash === '#' + en.target.id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  navLinks.forEach(a => { const s = $(a.hash); if (s) spy.observe(s); });

  /* ---------- giant type: fit the ink box exactly to the grid width ----------
     Canvas gives the real glyph bounds, so the first letter sits flush on column 1 and the last one ends
     on column 12. With a visible .fit__br the text is set on two lines of the same size (phones). */

  const ctx = document.createElement('canvas').getContext('2d');

  function fit(box) {
    if (!box.offsetParent) return;
    const text = $('.fit__text', box);
    const probe = $('.fit__probe', text);
    const br = $('.fit__br', text);
    const raw = text.textContent.replace(/\s+/g, ' ').trim();
    const lines = br && getComputedStyle(br).display !== 'none' ? raw.split(' ') : [raw];

    box.style.fontSize = '100px';
    text.style.marginTop = '0px';
    const cs = getComputedStyle(text);
    const ls = parseFloat(cs.letterSpacing) || 0;
    const lh = (parseFloat(cs.lineHeight) || 100) / 100;
    ctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
    const ms = lines.map(l => ctx.measureText(l));
    const left = Math.min(...ms.map(m => -m.actualBoundingBoxLeft));
    const right = Math.max(...ms.map((m, i) => m.actualBoundingBoxRight + ls * ([...lines[i].normalize('NFC')].length - 1)));
    const size = box.clientWidth / (right - left) * 100;
    const k = size / 100;

    box.style.fontSize = size + 'px';
    text.style.marginLeft = (-left * k) + 'px';
    const lastBaseline = probe.getBoundingClientRect().top - text.getBoundingClientRect().top;
    const firstBaseline = lastBaseline - (lines.length - 1) * lh * size;
    const asc = ms[0].actualBoundingBoxAscent * k;
    const desc = Math.max(0, ms[ms.length - 1].actualBoundingBoxDescent * k);
    text.style.marginTop = (asc - firstBaseline) + 'px';
    const crop = parseFloat(box.dataset.crop);
    box.style.height = (crop ? asc * crop : asc + (lines.length - 1) * lh * size + desc) + 'px';
  }
  const fitAll = () => $$('[data-fit]').forEach(fit);

  /* ---------- reveal & count-up (once) ---------- */

  const counters = $$('[data-count]');
  counters.forEach(el => {
    // in mono every digit is 1ch wide, so the box can be reserved up front (no reflow while counting)
    if (/Mono/.test(getComputedStyle(el).fontFamily)) {
      el.style.display = 'inline-block';
      el.style.minWidth = el.dataset.count.length + 'ch';
      el.style.textAlign = 'right';
    }
    if (!still()) el.textContent = '0';
  });

  function countUp(el) {
    const end = +el.dataset.count;
    if (still()) { el.textContent = end; return; }
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / 1200);
      el.textContent = Math.round(end * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      if (en.target.dataset.count) countUp(en.target);
      io.unobserve(en.target);
    });
  }, { threshold: 0.2 });

  /* ---------- 02 anatomia: layer ↔ legend highlight ---------- */

  const anatomy = $('#anatomia');
  const anat = $('.anat', anatomy);
  const layers = $$('[data-l]', anatomy);
  const hot = l => {
    layers.forEach(el => el.classList.toggle('is-hot', el.dataset.l === l));
    anat.classList.toggle('has-hot', !!l);
  };
  anatomy.addEventListener('pointerover', e => { const t = e.target.closest('[data-l]'); hot(t ? t.dataset.l : null); });
  anatomy.addEventListener('pointerleave', () => hot(null));
  $$('.lt__row[data-l]', anatomy).forEach(r => {
    r.addEventListener('focus', () => hot(r.dataset.l));
    r.addEventListener('blur', () => hot(null));
  });

  /* ---------- photos: tap toggles colour on touch screens ---------- */

  $$('.duo').forEach(d => d.addEventListener('click', () => d.classList.toggle('is-color')));

  /* ---------- 04 karta: filter, sort, FLIP, cursor photo ---------- */

  const tbody = $('#menu-body');
  const dishes = $$('.dish', tbody);
  dishes.forEach((r, i) => { r.dataset.idx = i; });
  const chips = $$('.chip[data-filter]');
  const sortBtn = $('#sort');
  const SORTS = ['Nr', 'cena ↑', 'cena ↓'];
  let filter = 'all';
  let sortMode = 0;

  const matches = r => filter === 'all' || (filter === 'wege' ? r.hasAttribute('data-veg') : r.dataset.cat === filter);

  function applyMenu() {
    const before = new Map();
    dishes.forEach(r => { if (!r.hidden) before.set(r, r.getBoundingClientRect().top); });
    const sorted = dishes.slice().sort((a, b) => {
      if (sortMode === 0) return a.dataset.idx - b.dataset.idx;
      const d = sortMode === 1 ? a.dataset.price - b.dataset.price : b.dataset.price - a.dataset.price;
      return d || a.dataset.idx - b.dataset.idx;
    });
    sorted.forEach(r => { r.hidden = !matches(r); tbody.appendChild(r); });
    const visible = sorted.filter(r => !r.hidden);
    $('#count').textContent = visible.length;
    if (still()) return;
    visible.forEach((r, i) => {
      const top = r.getBoundingClientRect().top;
      if (before.has(r)) {
        const dy = before.get(r) - top;
        if (Math.abs(dy) > 1) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 460, easing: EASE });
      } else {
        r.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
          { duration: 380, delay: 60 + i * 22, easing: EASE, fill: 'backwards' });
      }
    });
  }

  chips.forEach(btn => btn.addEventListener('click', () => {
    filter = btn.dataset.filter;
    chips.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    applyMenu();
  }));
  sortBtn.addEventListener('click', () => {
    sortMode = (sortMode + 1) % SORTS.length;
    $('#sort-label').textContent = SORTS[sortMode];
    sortBtn.setAttribute('aria-pressed', String(sortMode !== 0));
    applyMenu();
  });

  const peek = $('#peek');
  const peekImg = $('img', peek);
  const peekCap = $('.peek__cap', peek);
  const finePointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 860px)');
  function movePeek(e) {
    const w = 260, h = 286, gap = 28;
    let x = e.clientX + gap;
    if (x + w > innerWidth - 12) x = e.clientX - w - gap;
    const y = Math.max(70, Math.min(innerHeight - h - 12, e.clientY - h / 2));
    peek.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
  dishes.filter(r => r.dataset.photo).forEach(r => {
    r.addEventListener('pointerenter', e => {
      if (!finePointer.matches) return;
      peekImg.src = r.dataset.photo;
      peekCap.textContent = `No. ${$('.dish__n', r).textContent} — ${$('.dish__name [lang]', r).textContent}`;
      movePeek(e);
      peek.classList.add('is-on');
    });
    r.addEventListener('pointermove', e => { if (peek.classList.contains('is-on')) movePeek(e); });
    r.addEventListener('pointerleave', () => peek.classList.remove('is-on'));
  });

  /* ---------- 05 trasa: stations ↔ list ---------- */

  const route = $('#route');
  const track = $('.route__track', route);
  const ruler = $('.route__ruler', route);
  const courseList = $('#courses');

  for (let km = 0; km <= 1700; km += 100) {
    const tick = document.createElement('i');
    tick.dataset.p = (km / 1726 * 100) + '%';
    if (km % 500 === 0) tick.className = 'is-major';
    ruler.appendChild(tick);
    if (km % 500 === 0) {
      const label = document.createElement('b');
      label.style.left = tick.dataset.p;
      label.textContent = km === 1500 ? '1500 km' : km;
      ruler.appendChild(label);
    }
  }
  // the vertical (phone) layout reuses the same ticks along the y axis
  const verticalRoute = matchMedia('(max-width: 719px)');
  const placeTicks = () => $$('i', ruler).forEach(t => {
    t.style.left = verticalRoute.matches ? '' : t.dataset.p;
    t.style.top = verticalRoute.matches ? t.dataset.p : '';
  });
  placeTicks();
  verticalRoute.addEventListener('change', placeTicks);

  const stops = $$('.stop', route);
  const courses = $$('.course', courseList);
  let pinned = 0;

  // the card above the list shows the selected station's bánh mì (Sài Gòn until something is picked)
  const pickImg = $('#pick-img');
  const pickPh = $('.pick__ph');
  function showPick(i) {
    const c = courses[(i || 8) - 1];
    const station = $('.course__stop b', c);
    $('#pick-no').textContent = $('.course__no', c).textContent;
    $('#pick-km').textContent = $('.course__stop', c).lastChild.textContent;
    $('#pick-st').textContent = station.textContent;
    $('#pick-st').lang = station.lang || 'pl';
    $('#pick-dish').textContent = $('.course__dish [lang]', c).textContent;
    $('#pick-sub').textContent = $('.course__dish small', c).textContent;
    $('#pick-price').textContent = $('.course__price', c).textContent;
    const photo = c.dataset.photo;
    pickPh.classList.toggle('duo--none', !photo);
    pickImg.hidden = !photo;
    if (photo) { pickImg.src = photo; pickImg.alt = $('#pick-dish').textContent; }
  }

  function setStop(i) {
    stops.forEach(s => s.classList.toggle('is-active', +s.dataset.i === i));
    courses.forEach(c => c.classList.toggle('is-active', +c.dataset.i === i));
    courseList.classList.toggle('has-active', i > 0);
    route.style.setProperty('--prog', i ? stops[i - 1].style.getPropertyValue('--p') : 0);
    showPick(i);
  }
  function pin(i) {
    pinned = i;
    stops.forEach(s => s.setAttribute('aria-pressed', String(+s.dataset.i === i)));
    setStop(i);
  }
  stops.forEach(s => {
    const i = +s.dataset.i;
    s.addEventListener('pointerenter', () => setStop(i));
    s.addEventListener('focus', () => setStop(i));
    s.addEventListener('blur', () => setStop(pinned));
    s.addEventListener('click', () => {
      pin(i);
      if (verticalRoute.matches) courses[i - 1].scrollIntoView({ block: 'nearest', behavior: still() ? 'auto' : 'smooth' });
    });
  });
  track.addEventListener('pointerleave', () => setStop(pinned));
  courses.forEach(c => {
    const i = +c.dataset.i;
    c.addEventListener('pointerenter', () => setStop(i));
    c.addEventListener('focusin', () => setStop(i));
  });
  courseList.addEventListener('pointerleave', () => setStop(pinned));

  /* ---------- 06 godziny: week grid with bread batches, live status ---------- */

  const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
  const SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
  const OPEN = 12 * 60, CLOSE = 22 * 60;
  const BAKES = [10, 12, 14, 16, 18, 20];               // fresh baguettes, roughly every 2 h from 10:00
  const week = $('#week');

  const cellClass = h => (BAKES.includes(h) ? 'c c--bake' : h * 60 >= OPEN && h * 60 < CLOSE ? 'c c--open' : 'c');

  function buildWeek() {
    let html = '<div class="grid wk-axis" aria-hidden="true">';
    for (let c = 0; c < 12; c++) html += `<span>${pad(c * 2)}</span>`;
    html += '</div><div class="wk-brackets" aria-hidden="true">'
      + '<span class="wk-br wk-br--bake" data-from="10" data-to="11"><b>piec</b></span>'
      + '<span class="wk-br" data-from="12" data-to="22"><b>otwarte</b><span class="t"> · zamówienia online 12:00–22:00</span></span>'
      + '</div><div class="wk-rows" aria-hidden="true">';
    DAYS.forEach((name, d) => {
      html += `<div class="grid wk-row" data-day="${d}"><span class="wk-day"><span class="full">${name}</span><span class="short">${SHORT[d]}</span></span>`;
      for (let c = 0; c < 12; c++) {
        html += '<span class="wk-pair">';
        for (let h = c * 2; h < c * 2 + 2; h++) html += `<i class="${cellClass(h)}" data-h="${h}" style="--d:${d + Math.max(0, h - 10) * 0.6}"></i>`;
        html += '</span>';
      }
      html += '</div>';
    });
    html += '</div><div class="wk-now" aria-hidden="true"><span></span></div>';
    week.innerHTML = html;
    week.setAttribute('data-reveal', '');
  }

  // local time; ?zegar=13:30 pretends it is that time (to check the open / closed states)
  function clockNow() {
    const d = new Date();
    const fake = /^(\d{1,2}):(\d{2})$/.exec(params.get('zegar') || '');
    const min = fake ? (+fake[1] * 60 + +fake[2]) % 1440 : d.getHours() * 60 + d.getMinutes();
    return { d: (d.getDay() + 6) % 7, h: Math.floor(min / 60), m: min % 60, min };
  }
  const fmtLeft = min => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h ${pad(m)} min` : `${m} min`; };

  function updateStatus() {
    const t = clockNow();
    const open = t.min >= OPEN && t.min < CLOSE;
    const reopen = `otwieramy ${t.min < OPEN ? '' : 'jutro '}o 12:00`;
    const nextBake = BAKES.find(h => h * 60 > t.min);
    $('#status-word').textContent = open ? 'Otwarte' : 'Zamknięte';
    $('#status-sub').textContent = open ? `do 22:00 — jeszcze ${fmtLeft(CLOSE - t.min)}` : `— ${reopen}`;
    let note = `Zamówienia online: ${open ? 'otwarte' : 'zamknięte'}`;
    if (nextBake !== undefined) note += ` · ${nextBake === BAKES[0] ? 'pierwsza' : 'następna'} bagietka z pieca o ${pad(nextBake)}:00`;
    $('#status-note').textContent = note;
    $('#status-clock').textContent = `${DAYS[t.d].toLowerCase()}, ${pad(t.h)}:${pad(t.m)} · czas Wrocławia`;
    const hs = $('#hero-status');
    hs.textContent = open ? 'Otwarte do 22:00' : `Zamknięte · ${reopen}`;
    hs.classList.toggle('is-open', open);

    const rows = $('.wk-rows', week);
    $$('.wk-row', week).forEach(r => r.classList.toggle('is-today', +r.dataset.day === t.d));
    const wr = week.getBoundingClientRect();
    const rr = rows.getBoundingClientRect();
    const cell = $(`.wk-row[data-day="${t.d}"] [data-h="${t.h}"]`, week).getBoundingClientRect();
    const marker = $('.wk-now', week);
    const x = cell.left - wr.left + (t.m / 60) * cell.width;
    marker.style.left = x + 'px';
    marker.style.top = (rr.top - wr.top - 6) + 'px';
    marker.style.height = (rr.height + 12) + 'px';
    marker.classList.toggle('is-flip', x > wr.width - 150);
    marker.classList.add('is-on');
    $('span', marker).textContent = `teraz · ${SHORT[t.d]} ${pad(t.h)}:${pad(t.m)}`;
  }

  function layoutWeek() {
    const row = $('.wk-row', week);
    const wr = week.getBoundingClientRect();
    $$('.wk-br', week).forEach(b => {
      const a = $(`[data-h="${b.dataset.from}"]`, row).getBoundingClientRect();
      const z = $(`[data-h="${+b.dataset.to - 1}"]`, row).getBoundingClientRect();
      b.style.left = (a.left - wr.left) + 'px';
      b.style.width = (z.right - a.left) + 'px';
    });
    updateStatus();
  }

  buildWeek();
  setInterval(updateStatus, 30000);

  /* ---------- start ---------- */

  $$('[data-reveal], [data-count]').forEach(el => {
    if (DEBUG) { el.classList.add('is-in'); if (el.dataset.count) countUp(el); }
    else io.observe(el);
  });

  layoutWeek();

  const ready = (document.fonts && document.fonts.load)
    ? Promise.all([
        document.fonts.load('900 100px "Inter Tight"', 'Bánh mì Uncle Tan'),
        document.fonts.load('500 13px "IBM Plex Mono"', '0123')
      ]).catch(() => {}).then(() => document.fonts.ready)
    : Promise.resolve();

  fitAll();
  ready.then(() => {
    fitAll();
    layoutWeek();
    requestAnimationFrame(() => root.classList.add('fitted'));
  });

  let raf = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { fitAll(); layoutWeek(); });
  });
})();
