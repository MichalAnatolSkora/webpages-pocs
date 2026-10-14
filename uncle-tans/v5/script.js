(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ---------- misregistered headlines: a second, pink "drum" ---------- */

  const OFFSETS = [[3, -2], [-2, 3], [4, 1], [-3, -2], [2, 3], [-4, 1], [3, 2], [-2, -3]];
  let inked = 0;

  function printTwice(scope = document) {
    $$('.ink', scope).forEach((el) => {
      if (el.querySelector(':scope > .plate')) return;
      const plate = document.createElement('span');
      plate.className = 'plate';
      plate.setAttribute('aria-hidden', 'true');
      plate.innerHTML = el.innerHTML;
      el.append(plate);

      // bigger type gets a slightly bigger slip, like a real drum
      const size = parseFloat(getComputedStyle(el).fontSize);
      const k = Math.min(1.8, Math.max(0.7, size / 90));
      const [x, y] = OFFSETS[inked++ % OFFSETS.length];
      el.style.setProperty('--mx', (x * k).toFixed(1) + 'px');
      el.style.setProperty('--my', (y * k).toFixed(1) + 'px');
    });
  }

  /* ---------- print on scroll ---------- */

  // prints as soon as any part enters the screen; whatever a fast scroll or an anchor jump skipped is printed too
  const io = root.classList.contains('reveal') && new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting && entry.boundingClientRect.top > 0) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });

  function watchPrints(scope = document) {
    $$('.print:not(.is-in)', scope).forEach((el) => (io ? io.observe(el) : el.classList.add('is-in')));
  }

  /* ---------- halftone: two inks on a rotated AM grid ---------- */

  const INKS = [
    { name: 'teal', color: '#00838a', angle: 15, lo: 0.1, hi: 0.95, gamma: 1.8 },
    { name: 'pink', color: '#ff48b0', angle: 75, lo: 0.06, hi: 0.9, gamma: 1.5 },
  ];

  // [teal dx, dy, pink dx, dy] per figure, so every photo is off in its own way
  const SLIPS = [[-2, 1, 3, -2], [2, 2, -3, 1], [-1, -2, 3, 2], [2, -1, -2, 3]];

  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  const hash = (i, j, s) => {
    const h = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453;
    return h - Math.floor(h);
  };

  // the screen is never finer than ~4 px, so a ~560 px copy of a 1400 px photo carries all the detail we can print
  const MAX_SOURCE = 560;

  // Reads the photo once and splits it into two ink densities (0 = paper, 1 = full ink).
  // Teal behaves like cyan (absorbs red), pink like magenta (absorbs green);
  // both share some of the darkness so shadows overprint into deep blue.
  function readInks(img, plantWall, lift) {
    const k = Math.min(1, MAX_SOURCE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k);
    const h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data; // throws on a tainted canvas (file://)

    const teal = new Float32Array(w * h);
    const pink = new Float32Array(w * h);
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      const r = px[p] / 255;
      const g = px[p + 1] / 255;
      const b = px[p + 2] / 255;
      const dark = 1 - (0.299 * r + 0.587 * g + 0.114 * b);
      // the old photos were shot against a green plant wall: print it as a light teal texture only
      const wall = plantWall ? smooth(0, 0.12, g - Math.max(r, b)) : 0;
      // data-lift: grey walls, plates and tables get less ink than the colourful food in front of them
      const keep = lift < 1 ? lift + (1 - lift) * smooth(0.04, 0.3, Math.max(r, g, b) - Math.min(r, g, b)) : 1;
      teal[i] = (0.5 * (1 - r) + 0.5 * dark) * (1 - 0.45 * wall) * keep;
      pink[i] = (0.55 * (1 - g) + 0.45 * dark) * (1 - 0.85 * wall) * keep;
    }
    stretch(teal);
    stretch(pink);
    return { w, h, teal, pink, cache: {} };
  }

  // auto levels: 1st..99th percentile becomes 0..1, so every photo uses the full range of dots
  function stretch(map) {
    const BINS = 1024;
    const hist = new Uint32Array(BINS);
    for (let i = 0; i < map.length; i++) hist[Math.min(BINS - 1, Math.max(0, map[i] * BINS | 0))]++;
    const level = (q) => {
      let sum = 0;
      for (let b = 0; b < BINS; b++) if ((sum += hist[b]) >= map.length * q) return b / BINS;
      return 1;
    };
    const lo = level(0.01);
    const hi = level(0.99);
    const range = Math.max(0.05, hi - lo);
    for (let i = 0; i < map.length; i++) map[i] = Math.min(1, Math.max(0, (map[i] - lo) / range));
  }

  // separable box blur, so each dot "sees" the whole cell it stands for
  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    const size = r * 2 + 1;
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum / size;
        sum += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / size;
        sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return out;
  }

  // density map for a given cell size: averaged over the cell, plus a little unsharp mask
  // so pieces of food keep their edges once they turn into dots
  function channel(src, name, r) {
    const key = name + r;
    if (!src.cache[key]) {
      const base = boxBlur(src[name], src.w, src.h, r);
      const wide = boxBlur(src[name], src.w, src.h, r * 4 + 3);
      for (let i = 0; i < base.length; i++) base[i] += 0.6 * (base[i] - wide[i]);
      src.cache[key] = base;
    }
    return src.cache[key];
  }

  function bilinear(map, w, h, x, y) {
    x = Math.min(w - 1.001, Math.max(0, x));
    y = Math.min(h - 1.001, Math.max(0, y));
    const x0 = x | 0;
    const y0 = y | 0;
    const fx = x - x0;
    const fy = y - y0;
    const i = y0 * w + x0;
    const top = map[i] + (map[i + 1] - map[i]) * fx;
    const bottom = map[i + w] + (map[i + w + 1] - map[i + w]) * fx;
    return top + (bottom - top) * fy;
  }

  function drawPlate(canvas, src, ink, o) {
    const { w, h, dpr, cell, seed, fade, fx, fy } = o;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = ink.color;

    // cover-fit the photo into the box with the focus point as close to the middle as the crop allows;
    // scale = CSS px per source px
    const scale = Math.max(w / src.w, h / src.h) * o.zoom;
    const sw = src.w * scale;
    const sh = src.h * scale;
    const ox = Math.min(0, Math.max(w - sw, w / 2 - fx * sw));
    const oy = Math.min(0, Math.max(h - sh, h / 2 - fy * sh));
    const map = channel(src, ink.name, Math.max(1, Math.round(cell / scale / 2)));

    const a = ink.angle * Math.PI / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2;
    const n = Math.ceil(Math.hypot(w, h) / 2 / cell) + 1;

    ctx.beginPath();
    for (let j = -n; j <= n; j++) {
      for (let i = -n; i <= n; i++) {
        const u = i * cell;
        const v = j * cell;
        const x = cx + u * cos - v * sin;
        const y = cy + u * sin + v * cos;
        if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;

        let d = bilinear(map, src.w, src.h, (x - ox) / scale, (y - oy) / scale);
        if (fade === 'circle') {
          // a wobbly circular vignette: dots shrink to nothing towards the edge
          const dx = (x - cx) / R;
          const dy = (y - cy) / R;
          const ang = Math.atan2(dy, dx);
          const edge = 0.94 + 0.03 * Math.sin(ang * 5 + seed) + 0.02 * Math.sin(ang * 11 + seed * 3);
          d *= 1 - smooth(edge - 0.2, edge, Math.hypot(dx, dy));
        } else if (fade === 'edge') {
          // a rectangle with a slightly ragged, ink-starved border
          const e = Math.min(x, w - x, y, h - y) + (hash(j, i, seed + 7) - 0.5) * cell;
          d *= smooth(-0.3 * cell, 1.8 * cell, e);
        }
        d = Math.min(1, Math.max(0, (d - ink.lo) / (ink.hi - ink.lo)));
        d = Math.pow(d, ink.gamma * o.tone);
        if (d < 0.02) continue;

        // full ink stops just short of solid, so even the darkest corner stays a field of dots
        const r = cell * 0.56 * Math.sqrt(d) * (0.93 + 0.14 * hash(i, j, seed));
        if (r * dpr < 0.4) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }

  const halftones = [];

  function renderHalftone(ht) {
    const w = Math.round(ht.fig.clientWidth);
    const h = Math.round(ht.fig.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (!w || !h || (w === ht.w && h === ht.h && dpr === ht.dpr)) return;
    ht.w = w;
    ht.h = h;
    ht.dpr = dpr;
    // finer screen on small pictures, coarser on big ones; always visibly a raster
    const cell = ht.cell || Math.min(7, Math.max(3.4, Math.max(w, h) / 105));
    const opts = { w, h, dpr, cell, seed: ht.seed, fade: ht.fade, zoom: ht.zoom, fx: ht.fx, fy: ht.fy, tone: ht.tone };
    INKS.forEach((ink, k) => drawPlate(ht.plates[k], ht.src, ink, opts));
  }

  function setupHalftone(fig, index) {
    const img = $('img', fig);
    const [fx = 0.5, fy = 0.5] = (fig.dataset.focus || '').split(' ').filter(Boolean).map(Number);
    let src;
    try {
      src = readInks(img, 'wall' in fig.dataset, Number(fig.dataset.lift) || 1);
    } catch (err) {
      img.style.objectPosition = `${fx * 100}% ${fy * 100}%`;
      fig.classList.add('is-fallback');
      return;
    }

    const slip = SLIPS[index % SLIPS.length];
    fig.style.setProperty('--tx', slip[0] + 'px');
    fig.style.setProperty('--ty', slip[1] + 'px');
    fig.style.setProperty('--px', slip[2] + 'px');
    fig.style.setProperty('--py', slip[3] + 'px');

    const plates = INKS.map((ink) => {
      const c = document.createElement('canvas');
      c.className = 'ht-plate ht-' + ink.name;
      c.setAttribute('aria-hidden', 'true');
      fig.append(c);
      return c;
    });

    const ht = {
      fig,
      src,
      plates,
      seed: Number(fig.dataset.seed) || index + 1,
      fade: fig.dataset.fade || 'none',
      zoom: Number(fig.dataset.zoom) || 1,
      cell: Number(fig.dataset.cell) || 0,
      tone: Number(fig.dataset.tone) || 1,
      fx,
      fy,
    };
    halftones.push(ht);
    renderHalftone(ht);
    fig.classList.add('is-halftone');
    resizeObserver.observe(fig);
  }

  let pending = false;
  const renderAll = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      halftones.forEach(renderHalftone);
    });
  };
  const resizeObserver = new ResizeObserver(renderAll);

  // devicePixelRatio changes (zoom, moving to another screen) don't resize anything
  (function watchDpr() {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      .addEventListener('change', () => { renderAll(); watchDpr(); }, { once: true });
  })();

  // photos are read and drawn only when they come near the viewport (?debug draws everything at once)
  function prepare(fig) {
    const img = $('img', fig);
    const go = () => setupHalftone(fig, Number(fig.dataset.index));
    if (img.complete && img.naturalWidth) go();
    else img.addEventListener('load', go, { once: true });
  }

  const nearby = !root.classList.contains('debug') && 'IntersectionObserver' in window && new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      nearby.unobserve(entry.target);
      prepare(entry.target);
    });
  }, { rootMargin: '500px 0px' });

  function initHalftones() {
    $$('.ht').forEach((fig, i) => {
      fig.dataset.index = i;
      if (!nearby) {
        $('img', fig).loading = 'eager';
        prepare(fig);
      } else {
        nearby.observe(fig);
      }
    });
  }

  /* ---------- herb cards ---------- */

  $$('.herb').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('aria-pressed') !== 'true'));
    });
  });

  /* ---------- open / closed stamp (Wrocław time) ---------- */

  const openStamp = $('#open-stamp');

  function minutesInWroclaw() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date());
      const get = (type) => Number(parts.find((p) => p.type === type).value);
      return get('hour') * 60 + get('minute');
    } catch (err) {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    }
  }

  function updateOpen() {
    const m = minutesInWroclaw();
    const open = m >= 12 * 60 && m < 22 * 60;
    openStamp.dataset.state = open ? 'open' : 'closed';
    $('.open-word', openStamp).textContent = open ? 'Otwarte teraz' : 'Zamknięte';
    $('#open-sub').textContent = open ? 'zamówienia do 22:00' : (m < 12 * 60 ? 'otwieramy dziś o 12:00' : 'otwieramy jutro o 12:00');
  }

  printTwice();
  watchPrints();
  initHalftones();
  updateOpen();
  setInterval(updateOpen, 60 * 1000);
  window.zineReady = true;
})();
