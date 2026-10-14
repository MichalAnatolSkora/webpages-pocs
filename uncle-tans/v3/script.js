(() => {
  'use strict';

  const root = document.documentElement;
  const isStatic = root.classList.contains('is-static');
  const reduced = isStatic || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const pad = n => String(n).padStart(2, '0');

  /* ---------- nav ---------- */

  const nav = $('#nav');
  const toggle = $('.nav__toggle');
  const overlay = $('#menu');

  const updateNav = () => nav.classList.toggle('is-scrolled', scrollY > 40);
  updateNav();
  addEventListener('scroll', updateNav, { passive: true });

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    overlay.classList.toggle('is-open', open);
    overlay.inert = !open;
    root.classList.toggle('menu-open', open);
    if (open) $('a', overlay).focus({ preventScroll: true });
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  overlay.addEventListener('click', e => { if (e.target.closest('a[href^="#"]')) setMenu(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
      setMenu(false);
      toggle.focus();
    }
  });
  matchMedia('(min-width: 1200px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  // highlight the section currently in view
  const navLinks = $$('.nav__links a');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(a => {
          if (a.hash === '#' + entry.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(a => { const s = $(a.hash); if (s) spy.observe(s); });
  }

  $$('[data-placeholder]').forEach(a => a.addEventListener('click', e => e.preventDefault()));

  // full-page screenshots (?static) need every photo, not just the ones near the viewport
  if (isStatic) $$('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });

  /* ---------- reveal on scroll + count-up ---------- */

  function countUp(el) {
    const end = +el.dataset.count;
    if (reduced) { el.textContent = end; return; }
    const start = performance.now();
    const tick = now => {
      const k = clamp((now - start) / 1800, 0, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const reveals = $$('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        $$('[data-count]', entry.target).forEach(countUp);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .1 });
    $$('[data-count]').forEach(el => { el.textContent = '0'; });
    // the hero fades in on load (two frames so the transition actually runs)
    const inHero = el => el.closest('.hero');
    requestAnimationFrame(() => requestAnimationFrame(() => reveals.filter(inHero).forEach(el => el.classList.add('is-in'))));
    reveals.filter(el => !inHero(el)).forEach(el => io.observe(el));
  }

  /* ---------- steam: wandering strands that rise and curl ---------- */

  function smoothPath(pts) {
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)}`
         + ` ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)}`
         + ` ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function makeSteam(group, { x0, x1, y, height, count, amp }) {
    const strands = [];
    for (let i = 0; i < count; i++) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('stroke-width', (.6 + Math.random() * .7).toFixed(2));
      path.setAttribute('stroke-linecap', 'round');
      group.appendChild(path);
      const u = count === 1 ? .5 : i / (count - 1);
      strands.push({
        path,
        x: x0 + (x1 - x0) * u + (Math.random() - .5) * 10,
        h: height * (.62 + Math.random() * .38),
        f1: .008 + Math.random() * .006,
        f2: .02 + Math.random() * .01,
        f3: .045 + Math.random() * .02,
        p1: Math.random() * 6.28,
        p2: Math.random() * 6.28,
        v: 12 + Math.random() * 10,
        b: .18 + Math.random() * .22,
        bp: Math.random() * 6.28,
        order: Math.abs(u - .5) * 2 // centre strands appear first
      });
    }

    return function update(t, intensity = 1) {
      for (const s of strands) {
        const visible = clamp((intensity - s.order * .8) / .2, 0, 1);
        const opacity = visible * (.5 + .5 * Math.sin(t * s.b + s.bp));
        if (opacity < .02) { s.path.setAttribute('d', ''); continue; }
        const H = s.h * (.45 + .55 * intensity);
        const A = amp * (.45 + .55 * intensity);
        const pts = [];
        for (let k = 0; k <= 18; k++) {
          const r = k / 18;
          const dist = r * H - t * s.v; // phase moves upward over time
          const wobble = Math.sin(dist * s.f1 + s.p1) * .6 + Math.sin(dist * s.f2 + s.p2) * .3
            + Math.sin(dist * s.f3 - s.p1) * .14 * r; // small curls near the top
          const drift = r * r * A * .5 * Math.sin(t * .07 + s.p1);
          pts.push([s.x + wobble * A * Math.pow(r, 1.15) + drift, y - r * H]);
        }
        s.path.setAttribute('d', smoothPath(pts));
        s.path.style.opacity = opacity.toFixed(3);
      }
    };
  }

  /* ---------- hero: the exploded bánh mì breathes ---------- */

  const hero = $('.hero');
  const anat = $('#anat');
  const heroAnise = $('#hero-anise');
  const layers = $$('.layer', anat);
  const heroSteam = makeSteam($('#hero-steam'), { x0: 210, x1: 370, y: 200, height: 160, count: 5, amp: 20 });
  let heroOn = true;

  // phones keep only the numbers in the drawing, so crop away the label column
  const narrow = matchMedia('(max-width: 860px)');
  const fitAnat = () => anat.setAttribute('viewBox', narrow.matches ? '60 110 560 680' : '0 0 800 820');
  narrow.addEventListener('change', fitAnat);
  fitAnat();

  function renderHero(t) {
    heroSteam(t, .9);
    heroAnise.setAttribute('transform', `rotate(${(t * 1.6) % 360} 660 118)`);
    const spread = .5 + .5 * Math.sin(t * .45);
    layers.forEach((g, i) => {
      const dy = (i - 4) * 2.4 * spread + Math.sin(t * .8 + i * .7) * 1.4;
      g.setAttribute('transform', `translate(0 ${dy.toFixed(2)})`);
    });
  }

  /* ---------- Dzień bánh mì: the dial ---------- */

  const clock = $('#dzien');
  const R = 200;
  const C = 260;
  const START = 6;
  const HOURS = 16;
  const BATCHES = [10, 12, 14, 16, 18, 20];
  const point = (frac, r) => {
    const a = frac * Math.PI * 2 - Math.PI / 2;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const svgEl = (name, attrs) => {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  const tickEls = [];
  for (let i = 0; i < HOURS * 4; i++) {
    const frac = i / (HOURS * 4);
    const major = i % 4 === 0;
    const [x1, y1] = point(frac, R + 9);
    const [x2, y2] = point(frac, R + (major ? 22 : 14));
    const line = svgEl('line', { x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2) });
    if (major) line.classList.add('is-major');
    $('#dial-ticks').appendChild(line);
    tickEls.push({ el: line, frac });
  }

  const labelEls = [];
  for (let h = 0; h < HOURS; h++) {
    const [x, y] = point(h / HOURS, R + 38);
    const text = svgEl('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    text.textContent = h === 0 ? `${pad(START)} · ${pad(START + HOURS)}` : pad(START + h);
    $('#dial-labels').appendChild(text);
    labelEls.push({ el: text, frac: h / HOURS });
  }

  // a small loaf on the inside of the ring for every batch from the oven
  const batchEls = BATCHES.map(b => {
    const frac = (b - START) / HOURS;
    const [x, y] = point(frac, R - 20);
    const loaf = svgEl('path', {
      d: 'M-8 0 C-6 -4 6 -4 8 0 C6 2.4 -6 2.4 -8 0 Z M-3 -1.8 L0 -2.8 M1.5 -1.4 L4.5 -2.4',
      transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(frac * 360).toFixed(1)})`,
    });
    $('#dial-batches').appendChild(loaf);
    return { el: loaf, hour: b };
  });

  const steps = $$('.step', clock).map(el => ({ el, hour: +el.dataset.hour }));
  const marks = steps.filter(s => s.hour < START + HOURS).map(s => {
    const [x, y] = point((s.hour - START) / HOURS, R);
    const c = svgEl('circle', { cx: x.toFixed(2), cy: y.toFixed(2), r: 4 });
    $('#dial-marks').appendChild(c);
    return { el: c, hour: s.hour };
  });

  const arc = $('#dial-arc');
  const head = $('#dial-head');
  const glow = $('#dial-glow');
  const dialPhoto = $('.dial__photo');
  const timeEl = $('#dial-time');
  const capEl = $('#dial-cap');
  const dialSteam = makeSteam($('#dial-steam'), { x0: 226, x1: 294, y: 356, height: 178, count: 8, amp: 22 });

  function caption(h) {
    if (h >= START + HOURS) return 'ostatnia bagietka';
    if (h < START + .05) return 'przed świtem';
    if (BATCHES.some(b => h >= b && h < b + .34)) return 'partia prosto z pieca';
    const next = BATCHES.find(b => b > h);
    return next ? `następna partia o ${pad(next)}:00` : 'piec stygnie';
  }
  // warmth from the oven: strongest right after a batch, fading over two hours
  function freshness(h) {
    const last = [...BATCHES].reverse().find(b => b <= h);
    return last === undefined ? 0 : clamp(1 - (h - last) / 2, 0, 1);
  }

  let clockOn = false;
  let progress = 0;
  let shown = '';

  function readProgress() {
    const rect = clock.getBoundingClientRect();
    const total = clock.offsetHeight - innerHeight;
    if (total <= 0) return 1;
    const raw = clamp(-rect.top / total, 0, 1);
    return clamp((raw - .03) / .85, 0, 1); // short hold at both ends
  }

  function renderClock(p, t) {
    arc.style.strokeDashoffset = (1 - p).toFixed(4);
    const [hx, hy] = point(p, R);
    head.setAttribute('transform', `translate(${hx.toFixed(2)} ${hy.toFixed(2)})`);

    const mins = Math.round(p * HOURS * 60 / 5) * 5;
    const h = START + mins / 60;
    const warm = freshness(h);
    glow.style.opacity = (.06 + warm * .3).toFixed(3);
    dialPhoto.style.opacity = (.1 + warm * .4).toFixed(3);   // the bread in the dial glows after each batch

    const label = `${pad(START + Math.floor(mins / 60))}:${pad(mins % 60)}`;
    if (label !== shown) {
      shown = label;
      timeEl.textContent = label;
      capEl.textContent = caption(h);
      let current = 0;
      steps.forEach((s, i) => { if (s.hour <= h) current = i; });
      steps.forEach((s, i) => {
        s.el.classList.toggle('is-current', i === current);
        s.el.classList.toggle('is-past', i < current);
      });
      marks.forEach(m => m.el.classList.toggle('is-lit', m.hour <= h));
      batchEls.forEach(b => b.el.classList.toggle('is-lit', b.hour <= h));
      tickEls.forEach(tk => tk.el.classList.toggle('is-lit', tk.frac <= p + 1e-6));
      labelEls.forEach(lb => lb.el.classList.toggle('is-lit', lb.frac <= p + 1e-6));
    }
    dialSteam(t, h >= START + HOURS ? .08 : .1 + .9 * warm);
  }

  /* ---------- one animation loop for hero + dial ---------- */

  let raf = 0;
  function frame(now) {
    const t = now / 1000;
    if (heroOn) renderHero(t);
    if (clockOn) {
      const target = readProgress();
      progress += (target - progress) * .1;
      if (Math.abs(target - progress) < .0005) progress = target;
      renderClock(progress, t);
    }
    raf = heroOn || clockOn ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  if (reduced) {
    heroSteam(12, .9);
    renderClock(1, 12);
  } else {
    clock.classList.add('is-live');
    renderClock(0, 0);
    const vis = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target === hero) heroOn = entry.isIntersecting;
        if (entry.target === clock) {
          clockOn = entry.isIntersecting;
          if (clockOn) progress = readProgress();
        }
      });
      kick();
    });
    vis.observe(hero);
    vis.observe(clock);
    kick();
  }

  /* ---------- Mapa bánh mì: light the track as stops scroll past ---------- */

  const stops = $$('.stop');
  if (reduced || !('IntersectionObserver' in window)) {
    stops.forEach(s => s.classList.add('is-reached'));
  } else {
    const stopIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('is-reached');
        else if (entry.boundingClientRect.top > 0) entry.target.classList.remove('is-reached');
      });
    }, { rootMargin: '0px 0px -40% 0px' });
    stops.forEach(s => stopIO.observe(s));
  }

  /* ---------- karta tabs ---------- */

  const tabs = $$('[role="tab"]');
  function selectTab(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) {
      tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', e => {
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in to)) return;
      e.preventDefault();
      selectTab(tabs[(to[e.key] + tabs.length) % tabs.length], true);
    });
  });

  /* ---------- otwarte teraz (Warsaw time) ---------- */

  const status = $('#status');
  function warsawMinutes() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      const get = type => +parts.find(p => p.type === type).value;
      return get('hour') * 60 + get('minute');
    } catch {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    }
  }
  function updateStatus() {
    const mins = warsawMinutes();
    const open = mins >= 12 * 60 && mins < 22 * 60;
    status.classList.toggle('is-open', open);
    $('.status__text', status).textContent = open ? 'Otwarte teraz · do 22:00'
      : mins < 12 * 60 ? 'Zamknięte · otwieramy o 12:00' : 'Zamknięte · otwieramy jutro o 12:00';
    $('.status__detail', status).textContent = open ? 'Zamówienia online do 22:00 · odbiór osobisty ok. 15 min' : 'Zamówienia online od 12:00.';
  }
  updateStatus();
  setInterval(updateStatus, 30000);

  /* ---------- map ---------- */

  const mapWrap = $('#map-wrap');
  let mapReady = false;
  function initMap() {
    if (mapReady || !window.L) return;
    mapReady = true;
    const here = [51.111978, 17.032505];
    const rynek = [51.1100, 17.0320];
    const map = L.map('map', { center: here, zoom: 16, scrollWheelZoom: false, attributionControl: true });
    map.attributionControl.setPrefix(false);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      referrerPolicy: 'strict-origin-when-cross-origin'
    }).addTo(map);
    tiles.once('tileload', () => mapWrap.classList.add('has-tiles'));
    mapWrap.classList.add('has-leaflet');

    L.polyline([rynek, here], { color: '#D6A468', weight: 1.4, opacity: 1, dashArray: '2 6', interactive: false }).addTo(map);
    L.marker(rynek, {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: 'map-label', html: 'Rynek', iconSize: [90, 20], iconAnchor: [45, 10] })
    }).addTo(map);
    L.marker(here, {
      title: 'Uncle Tan — Kotlarska 25A',
      icon: L.divIcon({
        className: 'pin',
        html: '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#anise"/></svg><span>Uncle Tan</span>',
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      })
    }).addTo(map);
  }

  if ('IntersectionObserver' in window) {
    const mapIO = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { initMap(); mapIO.disconnect(); }
    }, { rootMargin: '600px 0px' });
    mapIO.observe(mapWrap);
  } else {
    initMap();
  }
})();
