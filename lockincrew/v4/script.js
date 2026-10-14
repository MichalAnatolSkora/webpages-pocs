// lockincrew v4 — the descent, in pixels
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ===== Pixel sprites =====
// '.' = transparent · 'w' = eye white (2×2, pupil tracked by JS) · cls letters get their own <g> for animation
const EYE = '#f5efe4', PUPIL = '#1a1a1a';
const SPRITES = {
  octo: {
    pal: { o: '#d97757', h: '#e8a47e', s: '#b85a3e', k: '#1a1a1a', r: '#e0c068', c: '#d96868', A: '#d97757' },
    cls: { A: 'arm' }, eyeBase: 'o', eyes: [[5, 5], [10, 5]],
    rows: [
      '....kkkkkkkkk...',
      '...k.oooooo..k..',
      '..k.ohhoooooo.k.',
      '..rohhooooooosr.',
      '..rohoooooooosr.',
      '..roowwooowwosr.',
      '..roowwooowwosr.',
      '...occookooccs..',
      '....oooooooss...',
      '...AA.AA.AA.AA..',
      '..AA..AA.AA..AA.',
      '.AA...A..A...AA.',
      '.A....AA.AA....A',
    ],
  },
  angler: {
    pal: { o: '#5d6170', h: '#7d8293', s: '#43464f', l: '#43464f', L: '#e0c068', k: '#1a1a1a', t: '#e8e0d0' },
    cls: { L: 'lure', s: 'tail' }, eyeBase: 'o', eyes: [[11, 6]],
    rows: [
      '....................',
      '...........llllLL...',
      '..........l....LL...',
      '.........l..........',
      '......ooooo.........',
      '....ooohoooooo......',
      'ss.oohooooowwooo....',
      'sss.ohooooowwooooo..',
      '.sssooooooooookkkk..',
      '.ssoooooooooooktttk.',
      'sss.ooooooooookkkk..',
      'ss..oossoooookttk...',
      's....sssssssssss....',
    ],
  },
  squid: {
    pal: { g: '#7fb069', h: '#a8cf94', s: '#5c8549', f: '#5c8549', d: '#e0c068', A: '#5c8549' },
    cls: { d: 'photo', A: 'arm' }, eyeBase: 'g', eyes: [[4, 8], [8, 8]],
    rows: [
      '......gg......',
      '.....ghgg.....',
      '..f.ghgggg.f..',
      '.ff.ghgdgg.ff.',
      '.ffghgggdgsff.',
      '...ghggggggs..',
      '...ghgdggggs..',
      '...ghggggdgs..',
      '...gwwggwwgs..',
      '...gwwggwwgs..',
      '....gggggss...',
      '...A.A.A.A.A..',
      '...A.A.A.A.A..',
      '..A..A.A.A..A.',
      '..A...A.A...A.',
    ],
  },
  isopod: {
    pal: { b: '#a89f8c', h: '#c9c0ad', s: '#7d7566', a: '#7d7566', P: '#d97757', k: '#1a1a1a', L: '#7d7566' },
    cls: { L: 'leg', P: 'pad', k: 'pad', a: 'antenna' }, eyeBase: 'b', eyes: [[2, 6]],
    rows: [
      'a.......PPPP........',
      '.a.a....P..P........',
      '..aa...PPkkPP.......',
      '...a..hPPkkPPhh.....',
      '..hhhhbbsbbbsbbbsh..',
      '.hbbbbbbsbbbsbbbsbs.',
      '.bwwbbbbsbbbsbbbsbs.',
      '.bwwbbbbsbbbsbbbsbbs',
      '.sbbbbbbsbbbsbbbsbss',
      '..ssssssssssssssss..',
      '...L.L.L.L.L.L.L....',
      '..L.L.L.L.L.L.L.....',
    ],
  },
  jelly: {
    pal: { j: '#d48fb0', h: '#ecbcd2', s: '#a86688', k: '#1a1a1a', T: '#c47aa0' },
    cls: { T: 'arm' }, eyeBase: 'j', eyes: [[4, 5], [10, 5]],
    rows: [
      '.....jjjjjj.....',
      '...jjhhjjjjjj...',
      '..jhhjjjjjjjjs..',
      '..jhjjjjjjjjjs..',
      '.jjjjjjjjjjjjjs.',
      '.jjjwwjjjjwwjjs.',
      '.jjjwwjjjjwwjjs.',
      '.jjjjjjkkjjjjjs.',
      '.sjsjsjsjsjsjss.',
      '..T..T.TT.T..T..',
      '...T.T..T..T.T..',
      '..T..T.T..T..T..',
      '..T...T.T.T...T.',
      '...T..T..T..T...',
      '....T....T......',
    ],
  },
  egg: {
    pal: { e: '#a89f8c', f: '#2a2622', q: '#d97757' },
    cls: { q: 'qmark' },
    rows: [
      '......eeee......',
      '.....effffe.....',
      '....effffffe....',
      '...effqqqqffe...',
      '...efqqffqqfe...',
      '..efffffffqqfe..',
      '..effffffqqffe..',
      '..efffffqqfffe..',
      '..efffffqqfffe..',
      '..effffffffffe..',
      '..efffffqqfffe..',
      '...effffffffe...',
      '....effffffe....',
      '.....eeeeee.....',
    ],
  },
  sub: {
    pal: { o: '#d97757', h: '#e8a47e', s: '#b85a3e', d: '#e8a47e', p: '#b85a3e', L: '#f3d9a4' },
    cls: { p: 'prop', L: 'lamp' }, eyeBase: 's', eyes: [[11, 8], [17, 8], [23, 8]],
    rows: [
      '...............ssss...............',
      '...............s..s...............',
      '...............s..................',
      '............ooooooooo.............',
      '...........ohhhhhhhhoo............',
      'p.......ooooooooooooooooooos......',
      'pp.s..oohhhhhhhhhhhhhhhhhhhoos....',
      'pp.s.ohhooossoooossoooossooooos...',
      'ppssooooooswwsooswwsooswwsooooosLL',
      'pp.sooooooswwsooswwsooswwsooooosLL',
      'ppssooooooossoooossoooossoooooos..',
      'pp.s.ssdssdssdssdssdssdssdssdss...',
      'pp.s..ssssssssssssssssssssssss....',
      'p.......ssssssssssssssssssss......',
    ],
  },
  minijelly: {
    pal: { j: '#d48fb0', h: '#ecbcd2', s: '#a86688', T: '#c47aa0' },
    cls: { T: 'arm' },
    rows: [
      '..jjjj..',
      '.jhjjjj.',
      'jhjjjjjj',
      'jsjsjsjs',
      '.T.T.T..',
      'T.T.T.T.',
      '.T...T..',
    ],
  },
  whale: {
    pal: { b: '#3c4a52', s: '#2e383e', e: '#a89f8c' },
    rows: [
      '.................................bbbbbbb....',
      '.........bbbbbbbbbbb.............bbbbbb.....',
      '......bbbbbbbbbbbbbbbbb..........bbbbb......',
      '....bbbbbbbbbbbbbbbbbbbbbb.......bbbb.......',
      '...bbbbbbbbbbbbbbbbbbbbbbbbbb....bbb........',
      '..bbbbbebbbbbbbbbbbbbbbbbbbbbbbbbbbbb.......',
      '..sbbbbbbbbbbbbbbbbbbbbbbbbbbbsssbbbb.......',
      '..ssssbbbbbbbbbbbbbbbbbbbbbssssssbbbb.......',
      '...ssssssbbbbbbbbbbbbbbbssssss...bbbb.......',
      '......ssssssssbbbbsssssssss......bbbbb......',
      '.........sssssssssssssss.........bbbbbb.....',
      '..............ssss...............bbbbbbb....',
    ],
  },
  worms: {
    pal: { w: '#e8e0d0', s: '#a89f8c', r: '#d96868' },
    cls: { r: 'plume' },
    rows: [
      '......rr..............',
      '.....rrrr.............',
      '......rr......rr......',
      '..rr..ws.....rrrr.....',
      '.rrrr.ws......rr..rr..',
      '..rr..ws..rr..ws.rrrr.',
      '..ws..ws.rrrr.ws..rr..',
      '..ws..ws..rr..ws..ws..',
      '..ws..ws..ws..ws..ws..',
      '..ws..ws..ws..ws..ws..',
      '..ws..ws..ws..ws..ws..',
      '..ws..ws..ws..ws..ws..',
      '..ws..ws..ws..ws..ws..',
    ],
  },
  vent: {
    pal: { v: '#2c2823', k: '#141312', o: '#d97757' },
    cls: { o: 'ember' },
    rows: [
      '....oooo....',
      '....vkkv....',
      '...vvkkvv...',
      '...vvvvvv...',
      '..vvvvvvvv..',
      '..vvvvvvvv..',
      '.vvvvvvvvvv.',
      '.vvvvvvvvvv.',
      'vvvvvvvvvvvv',
      'vvvvvvvvvvvv',
    ],
  },
};

function renderSprite(name) {
  const s = SPRITES[name];
  const H = s.rows.length, W = Math.max(...s.rows.map((r) => r.length));
  let base = '';
  const groups = {};
  s.rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const c = row[x];
      let x2 = x;
      while (x2 < row.length && row[x2] === c) x2++;
      if (c !== '.') {
        const fill = c === 'w' ? s.pal[s.eyeBase] : s.pal[c];
        const rect = `<rect x="${x}" y="${y}" width="${x2 - x}" height="1" fill="${fill}"/>`;
        let k = c === 'w' ? '' : (s.cls && s.cls[c]) || '';
        if (k === 'arm' || k === 'leg') k += y % 2 ? ` ${k}-b` : ` ${k}-a`;
        if (k) (groups[k] = groups[k] || []).push(rect);
        else base += rect;
      }
      x = x2;
    }
  });
  const g = Object.entries(groups).map(([k, v]) => `<g class="${k}">${v.join('')}</g>`).join('');
  const eyes = (s.eyes || []).map(([x, y]) =>
    `<g class="px-eye"><rect x="${x}" y="${y}" width="2" height="2" fill="${EYE}"/><rect class="px-pupil" data-x="${x}" data-y="${y}" x="${x + 1}" y="${y + 1}" width="1" height="1" fill="${PUPIL}"/></g>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges" class="px px-${name}">${base}${g}${eyes}</svg>`;
}
$$('[data-sprite]').forEach((el) => { el.innerHTML = renderSprite(el.dataset.sprite); });

// ===== Pointer =====
const mouse = { x: -9999, y: -9999, active: false };
addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true });
document.addEventListener('pointerleave', () => { mouse.active = false; });

// ===== Depth model =====
const MAX_DEPTH = 10994;
const zones = $$('.zone');
let anchors = [];
let maxScroll = 1;

function measure() {
  const mid = innerHeight * 0.4;
  maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  anchors = zones.map((z, i) => ({ y: i === 0 ? 0 : Math.max(0, z.offsetTop - mid), d: +z.dataset.depth, id: z.id }));
  anchors.push({ y: maxScroll, d: MAX_DEPTH });
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i].y <= anchors[i - 1].y) anchors[i].y = anchors[i - 1].y + 1;
  }
  placeTicks();
}
function depthAt(scroll) {
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1], b = anchors[i];
    if (scroll <= b.y) return lerp(a.d, b.d, clamp((scroll - a.y) / (b.y - a.y), 0, 1));
  }
  return MAX_DEPTH;
}
function zoneFor(d) {
  if (d < 200) return ['sunlight', 'sunlight zone'];
  if (d < 1000) return ['twilight', 'twilight zone'];
  if (d < 4000) return ['midnight', 'midnight zone'];
  if (d < 6000) return ['abyss', 'the abyss'];
  if (d < 10000) return ['hadal', 'hadal zone'];
  return ['trench', 'challenger deep'];
}

// ===== Gauge + title bar =====
const gDepth = $('#gDepth'), gZone = $('#gZone'), gPet = $('#gPet'), gFill = $('#gFill'), tDepth = $('#tDepth');
const gPressure = $('#gPressure'), gLight = $('#gLight'), gTemp = $('#gTemp'), gNoise = $('#gNoise');
const ticks = $$('.g-tick');
const tabs = $$('.tabs .tab:not(.tab-cta)');
function placeTicks() {
  ticks.forEach((t) => {
    const a = anchors.find((x) => x.id === t.dataset.go);
    if (a) t.style.top = `${(a.y / maxScroll) * 100}%`;
  });
}
const goTo = (id) => document.getElementById(id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
ticks.forEach((t) => t.addEventListener('click', () => goTo(t.dataset.go)));

let shownDepth = 0, popped = 0, currentZone = '';
const noiseAt = (d) => Math.max(0, Math.round(47 * (1 - d / 600)) - popped);

function updateGauge(depth) {
  shownDepth = lerp(shownDepth, depth, 0.14);
  if (Math.abs(shownDepth - depth) < 0.5) shownDepth = depth;
  const d = Math.round(shownDepth);
  const txt = d.toLocaleString('en-US');
  gDepth.textContent = txt;
  tDepth.textContent = txt;
  const light = 100 * Math.exp(-shownDepth / 43);
  gLight.textContent = light >= 1 ? `${light.toFixed(0)}%` : light >= 0.01 ? `${light.toFixed(2)}%` : '0%';
  gPressure.textContent = `${Math.round(1 + shownDepth / 10).toLocaleString('en-US')} atm`;
  gTemp.textContent = `${(2 + 16 * Math.exp(-shownDepth / 300)).toFixed(1)} °C`;
  const n = noiseAt(shownDepth);
  gNoise.textContent = n > 0 ? `${n} ping${n === 1 ? '' : 's'}` : 'silence ✓';
  gNoise.classList.toggle('ok', n === 0);

  const p = clamp(scrollY / maxScroll, 0, 1);
  gPet.style.top = `${p * 100}%`;
  gFill.style.height = `${p * 100}%`;
  ticks.forEach((t) => t.classList.toggle('passed', parseFloat(t.style.top) <= p * 100 + 0.5));

  const [key, label] = zoneFor(depth);
  if (key !== currentZone) {
    currentZone = key;
    document.body.dataset.zone = key;
    gZone.textContent = label;
  }
  const active = [...anchors].reverse().find((a) => a.id && scrollY >= a.y - 2);
  tabs.forEach((t) => t.classList.toggle('active', !!active && t.getAttribute('href') === `#${active.id}`));
}

// ===== Sea canvas (rendered at 1/PX resolution, upscaled with pixelated) =====
const PX = 4;
const canvas = $('#sea');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, cw = 0, ch = 0;
function resize() {
  W = innerWidth; H = innerHeight;
  cw = Math.ceil(W / PX); ch = Math.ceil(H / PX);
  canvas.width = cw; canvas.height = ch;
  ctx.imageSmoothingEnabled = false;
  measure();
}

const colorStops = [
  [0, [44, 74, 80]],
  [150, [36, 56, 62]],
  [600, [28, 36, 40]],
  [2000, [22, 23, 25]],
  [5000, [18, 17, 16]],
  [11000, [15, 15, 15]],
];
function waterAt(d) {
  for (let i = 1; i < colorStops.length; i++) {
    const [d0, c0] = colorStops[i - 1], [d1, c1] = colorStops[i];
    if (d <= d1) {
      const t = clamp((d - d0) / (d1 - d0), 0, 1);
      return c0.map((v, k) => Math.round(lerp(v, c1[k], t)));
    }
  }
  return colorStops[colorStops.length - 1][1];
}
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const SNOW = reduced ? 40 : 110;
const snow = Array.from({ length: SNOW }, () => ({
  x: Math.random() * innerWidth / PX, y: Math.random() * innerHeight / PX,
  z: 0.3 + Math.random() * 0.7, ph: Math.random() * Math.PI * 2,
}));
const bubbles = [];
const rings = [];

addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button, input, textarea, select, label, .ping, .op-stage, .blip, .prompt-area')) return;
  rings.push({ x: e.clientX / PX, y: e.clientY / PX, t: 0 });
});

// fish school (boids) in document space inside #manifesto
const school = [];
const schoolZone = $('#manifesto');
function schoolBox() {
  const top = schoolZone.offsetTop;
  return { x0: 0, x1: W, y0: top + 40, y1: top + schoolZone.offsetHeight - 40 };
}
function initSchool() {
  const b = schoolBox();
  const n = reduced ? 0 : W < 700 ? 16 : 30;
  for (let i = 0; i < n; i++) {
    school.push({ x: W * 0.5 + Math.random() * 160, y: b.y0 + 420 + Math.random() * 140, vx: 2 + Math.random(), vy: Math.random() - 0.5 });
  }
}
function stepSchool(scroll) {
  const b = schoolBox();
  const mx = mouse.x, my = mouse.y + scroll;
  for (const f of school) {
    let ax = 0, ay = 0, cx = 0, cy = 0, vx = 0, vy = 0, n = 0;
    for (const o of school) {
      if (o === f) continue;
      const dx = o.x - f.x, dy = o.y - f.y, d2 = dx * dx + dy * dy;
      if (d2 < 3600) {
        n++; cx += o.x; cy += o.y; vx += o.vx; vy += o.vy;
        if (d2 < 400) { ax -= dx / (d2 + 1) * 6; ay -= dy / (d2 + 1) * 6; }
      }
    }
    if (n) {
      ax += (cx / n - f.x) * 0.002 + (vx / n - f.vx) * 0.05;
      ay += (cy / n - f.y) * 0.002 + (vy / n - f.vy) * 0.05;
    }
    const m = 80;
    if (f.x < b.x0 + m) ax += 0.12;
    if (f.x > b.x1 - m) ax -= 0.12;
    if (f.y < b.y0 + m) ay += 0.12;
    if (f.y > b.y1 - m) ay -= 0.12;
    if (mouse.active) {
      const dx = f.x - mx, dy = f.y - my, d2 = dx * dx + dy * dy;
      if (d2 < 140 * 140) {
        const d = Math.sqrt(d2) || 1, k = (1 - d / 140) * 1.4;
        ax += (dx / d) * k; ay += (dy / d) * k;
      }
    }
    f.vx += ax; f.vy += ay;
    const sp = Math.hypot(f.vx, f.vy) || 1;
    if (sp > 3.4) { f.vx *= 3.4 / sp; f.vy *= 3.4 / sp; }
    if (sp < 1.1) { f.vx *= 1.1 / sp; f.vy *= 1.1 / sp; }
    f.x += f.vx; f.y += f.vy;
  }
}
function drawSchool(scroll) {
  ctx.fillStyle = '#c9c0ad';
  for (const f of school) {
    const x = Math.round(f.x / PX), y = Math.round((f.y - scroll) / PX);
    if (y < -2 || y > ch + 2) continue;
    const dir = f.vx >= 0 ? 1 : -1;
    ctx.fillRect(x - 1, y, 3, 1);          // body
    ctx.fillRect(x - 2 * dir, y - 1, 1, 1); // tail
    ctx.fillRect(x - 2 * dir, y + 1, 1, 1);
  }
}

let lastScroll = scrollY, time = 0;
function frame() {
  time++;
  const scroll = scrollY;
  const dScroll = (scroll - lastScroll) / PX;
  lastScroll = scroll;
  const depth = depthAt(scroll);
  updateGauge(depth);

  // banded water: stepped vertical gradient
  const BANDS = 14;
  for (let i = 0; i < BANDS; i++) {
    const t = i / (BANDS - 1);
    ctx.fillStyle = rgb(waterAt(Math.max(0, depth - 140 + t * 300)));
    ctx.fillRect(0, Math.floor((i * ch) / BANDS), cw, Math.ceil(ch / BANDS) + 1);
  }

  const light = Math.exp(-depth / 120);
  const deep = clamp((depth - 600) / 2400, 0, 1);

  // god rays (chunky)
  if (light > 0.02) {
    ctx.fillStyle = `rgba(232, 164, 126, ${0.07 * light})`;
    for (let i = 0; i < 5; i++) {
      const x0 = cw * (0.12 + i * 0.2) + Math.round(Math.sin(time * 0.006 + i * 1.7) * 6);
      const w = 8 + (i % 3) * 5;
      for (let y = 0; y < ch; y += 2) ctx.fillRect(Math.round(x0 - y * 0.35), y, w, 2);
    }
  }

  // rising bubbles near the surface
  const bubbleRate = clamp(1 - depth / 450, 0, 1);
  if (!reduced && Math.random() < 0.2 * bubbleRate) bubbles.push({ x: Math.random() * cw, y: ch + 2, vy: 0.15 + Math.random() * 0.3, ph: Math.random() * 6, big: Math.random() < 0.3 });
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y -= b.vy + dScroll * 0.4;
    if (b.y < -4 || b.y > ch + 6) { bubbles.splice(i, 1); continue; }
    const x = Math.round(b.x + Math.sin(time * 0.05 + b.ph)), y = Math.round(b.y);
    ctx.fillStyle = `rgba(232, 224, 208, ${0.45 * bubbleRate + 0.1})`;
    if (b.big) { ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y + 1, 1, 1); }
    else ctx.fillRect(x, y, 1, 1);
  }

  // marine snow → bioluminescent plankton near the cursor
  const mx = mouse.x / PX, my = mouse.y / PX;
  for (const p of snow) {
    if (!reduced) {
      p.y += 0.04 * p.z - dScroll * p.z * 0.5;
      p.x += Math.sin(time * 0.01 + p.ph) * 0.03;
    }
    if (p.y > ch + 2) { p.y = -2; p.x = Math.random() * cw; }
    if (p.y < -2) { p.y = ch + 2; p.x = Math.random() * cw; }
    let glow = 0;
    if (deep > 0 && mouse.active) glow = deep * clamp(1 - Math.hypot(p.x - mx, p.y - my) / 42, 0, 1);
    for (const r of rings) {
      if (Math.abs(Math.hypot(p.x - r.x, p.y - r.y) - r.t * 2.2) < 6) glow = Math.max(glow, (1 - r.t / 90) * 0.9);
    }
    const x = Math.round(p.x), y = Math.round(p.y);
    if (glow > 0.05) {
      ctx.fillStyle = `rgba(232, 164, 126, ${0.35 + glow * 0.65})`;
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = `rgba(217, 119, 87, ${glow * 0.35})`;
      ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    } else {
      const tw = 0.6 + 0.4 * Math.sin(time * 0.03 + p.ph);
      ctx.fillStyle = `rgba(232, 224, 208, ${(0.1 + 0.3 * deep) * p.z * tw})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // lantern around the cursor (stepped rings)
  if (deep > 0 && mouse.active) {
    for (let r = 3; r >= 1; r--) {
      ctx.fillStyle = `rgba(217, 119, 87, ${0.022 * deep})`;
      const rad = r * 9;
      ctx.beginPath(); ctx.arc(mx, my, rad, 0, Math.PI * 2); ctx.fill();
    }
  }

  // sonar rings
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += 1;
    if (r.t > 90) { rings.splice(i, 1); continue; }
    const k = 1 - r.t / 90, rad = r.t * 2.2;
    ctx.fillStyle = `rgba(217, 119, 87, ${0.7 * k})`;
    const steps = Math.max(12, Math.round(rad * 6));
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      ctx.fillRect(Math.round(r.x + Math.cos(a) * rad), Math.round(r.y + Math.sin(a) * rad), 1, 1);
    }
  }

  if (school.length) {
    const zr = schoolZone.getBoundingClientRect();
    if (zr.bottom > -100 && zr.top < H + 100) { stepSchool(scroll); drawSchool(scroll); }
  }

  updateEyes();
  requestAnimationFrame(frame);
}

// ===== Pixel eyes follow the cursor =====
const pupils = $$('.px-pupil').map((el) => ({ el, x: +el.dataset.x, y: +el.dataset.y, eye: el.parentNode.firstElementChild }));
function updateEyes() {
  if (!mouse.active) return;
  for (const p of pupils) {
    const r = p.eye.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = mouse.x < cx - r.width ? 0 : mouse.x > cx + r.width ? 1 : (mouse.x < cx ? 0 : 1);
    const dy = mouse.y < cy - r.height ? 0 : 1;
    p.el.setAttribute('x', p.x + dx);
    p.el.setAttribute('y', p.y + dy);
  }
}

// ===== Bobbing letters =====
const bobWord = $('#bobWord');
bobWord.innerHTML = [...bobWord.textContent].map((c, i) => `<span class="ch" style="--i:${i}">${c}</span>`).join('');

// ===== Notification boxes at the surface =====
const noise = $('#noise');
const pings = [
  ['@', 'quick sync?'], ['#', '@channel'], ['47', 'unread'], ['!', 'can you hop on a call'],
  ['@', 'per my last email'], ['12', 'jira updates'], ['5', 'standup in 5 min'], ['?', 'thoughts?'],
  ['@', 'circling back'], ['!', 'who owns this?'], ['3', 'comments on q3 okrs'], ['@', 'is this blocked?'],
  ['!', 'urgent (not urgent)'], ['@', 'let\'s take this offline'], ['9', 'calendar invites'], ['?', 'got a sec?'],
];
let pingIdx = Math.floor(Math.random() * pings.length), livePings = 0;
function spawnPing() {
  if (document.hidden || livePings >= (W < 700 ? 4 : 8)) return;
  if ($('#surface').getBoundingClientRect().bottom < 100) return;
  const [ic, text] = pings[pingIdx++ % pings.length];
  const el = document.createElement('div');
  el.className = 'ping';
  el.style.left = `${3 + Math.random() * 82}%`;
  el.style.setProperty('--h', `${noise.offsetHeight + 60}px`);
  el.style.setProperty('--dur', `${10 + Math.random() * 7}s`);
  el.style.setProperty('--wob', `${1.4 + Math.random() * 1.2}s`);
  el.innerHTML = `<span class="ping-in"><span class="ic">${ic}</span>${text}</span>`;
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); popPing(el, true); });
  el.addEventListener('animationend', (e) => { if (e.animationName === 'rise') popPing(el, false); });
  noise.appendChild(el);
  livePings++;
}
function popPing(el, byUser) {
  if (el.classList.contains('popped')) return;
  el.classList.add('popped');
  livePings--;
  const nr = noise.getBoundingClientRect(), r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2 - nr.left, cy = r.top + r.height / 2 - nr.top;
  for (let i = 0; i < 8; i++) {
    const d = document.createElement('i');
    d.className = 'shard';
    const a = (i / 8) * Math.PI * 2;
    d.style.left = `${cx}px`; d.style.top = `${cy}px`;
    d.style.setProperty('--dx', `${Math.round(Math.cos(a) * (28 + Math.random() * 24) / 4) * 4}px`);
    d.style.setProperty('--dy', `${Math.round(Math.sin(a) * (18 + Math.random() * 18) / 4) * 4}px`);
    noise.appendChild(d);
    setTimeout(() => d.remove(), 600);
  }
  if (byUser) {
    popped++;
    const s = document.createElement('span');
    s.className = 'pop-score';
    s.textContent = popped === 1 ? '✓ −1 ping. feels good?' : `✓ −${popped} pings`;
    s.style.left = `${cx}px`; s.style.top = `${cy - 20}px`;
    noise.appendChild(s);
    setTimeout(() => s.remove(), 950);
  }
  setTimeout(() => el.remove(), 320);
}
if (!reduced) {
  for (let i = 0; i < 3; i++) setTimeout(spawnPing, 300 + i * 700);
  setInterval(spawnPing, 1600);
}

// ===== Prompt (v2 command set + diving) =====
const promptInput = $('#promptInput');
const replyStream = $('#replyStream');
const sectionCmds = { manifesto: 'manifesto', services: 'services', crew: 'crew', receipts: 'receipts', hire: 'hire', surface: 'surface' };
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const replies = [
  { match: /^\/lockin/i, run: () => { openLock(); return 'entering <b>LOCK_IN_MODE</b> · notifications muted · slack not even open'; } },
  { match: /^\/dive(\s+\d+)?/i, run: (cmd) => {
    const want = parseInt(cmd.split(/\s+/)[1], 10);
    const target = isNaN(want) ? 'crew' : [...zones].reverse().find((z) => +z.dataset.depth <= want)?.id || 'surface';
    goTo(target);
    return `diving to <b>${isNaN(want) ? '4,000' : want.toLocaleString('en-US')} m</b> · hold your breath.`;
  } },
  { match: /^\/(surface|resurface|up)/i, run: () => { goTo('surface'); return 'resurfacing. the noise is still up here, sorry.'; } },
  { match: /^\/pricing/i, run: () => '<b>pricing</b> — strike team €60-120k fixed · rescue op €180/h t&m · ai pilot €25-45k · embedded €18-26k/mo. brief is better than spreadsheet.' },
  { match: /^\/timezone/i, run: () => '<b>timezones</b> — warsaw (utc+1), lisbon (utc+0). overlap with eu + us east. async-first, sync when it actually moves something.' },
  { match: /^\/stack/i, run: () => '<b>stack we reach for</b> — typescript, rust, python, go · postgres, redis · react, svelte · terraform, fly.io, aws · claude · linear, github, signal. no jira.' },
  { match: /^\/availability/i, run: () => '<b>next open slot</b> — strike cell: q1 · rescue op: this month (1 slot) · embedded: q1 · ai pilot: waitlist.' },
  { match: /^\/standup/i, run: () => '<b>standup</b> — we don\'t. one written brief on monday, one demo on friday, async in between. presence is not output.' },
  { match: /^\/help|^\?$/i, run: () => '<b>commands</b> — /dive [m] · /surface · /manifesto · /services · /crew · /receipts · /hire · /lockin · /pricing · /timezone · /stack · /availability · /standup · /clear' },
  { match: /^\/clear/i, run: () => { replyStream.innerHTML = ''; return null; } },
  { match: /^\/(manifesto|services|crew|receipts|hire)/i, run: (cmd) => { const k = cmd.slice(1).split(' ')[0].toLowerCase(); goTo(sectionCmds[k]); return `cd <b>/${k}</b> · descending…`; } },
  { match: /meeting|standup|sync|jira/i, run: () => 'we don\'t do that here. one brief, one demo, the rest is the keyboard.' },
  { match: /hire|work|engage|brief/i, run: () => 'say less. type <b>/hire</b> or mail <a href="mailto:lockin@lockincrew.io">lockin@lockincrew.io</a> with deadline + budget shape.' },
  { match: /.*/, run: (cmd) => `unknown command: <b>${escapeHtml(cmd)}</b> · try <b>/help</b>` },
];
function appendReply(html) {
  if (!html) return;
  const div = document.createElement('div');
  div.className = 'reply';
  div.innerHTML = `<span class="resp-mark">✻</span> ${html}`;
  replyStream.appendChild(div);
  while (replyStream.children.length > 3) replyStream.firstElementChild.remove();
}
function runCommand(raw) {
  const cmd = raw.trim();
  if (!cmd) return;
  const r = replies.find((x) => x.match.test(cmd));
  appendReply(r.run(cmd));
}
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); runCommand(promptInput.value); promptInput.value = ''; }
  else if (e.key === 'Escape') { promptInput.value = ''; promptInput.blur(); }
});

// ===== Reveal on scroll =====
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('in');
    io.unobserve(e.target);
    if (e.target.classList.contains('stats')) countUp(e.target);
    if (e.target.id === 'sonarLog') $$('.log-line', e.target).forEach((l, i) => setTimeout(() => l.classList.add('on'), 250 + i * 380));
  }
}, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
$$('.rv').forEach((el) => io.observe(el));
io.observe($('.stats'));
function countUp(root) {
  $$('[data-count]', root).forEach((el, i) => {
    const target = +el.dataset.count, suffix = el.dataset.suffix || '';
    const t0 = performance.now() + i * 120, dur = 1400;
    const tick = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      el.innerHTML = Math.round(target * (1 - Math.pow(1 - t, 3))) + (suffix ? `<span class="stat-suffix">${suffix}</span>` : '');
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// ===== Crew: click to hop & talk =====
$$('.op').forEach((op) => {
  $('.say', op).textContent = op.dataset.say;
  const sprite = $('.sprite', op);
  $('.op-stage', op).addEventListener('click', (e) => {
    sprite.classList.remove('hop');
    void sprite.offsetWidth;
    sprite.classList.add('hop');
    op.classList.add('talk');
    clearTimeout(op._t);
    op._t = setTimeout(() => op.classList.remove('talk'), 2200);
    rings.push({ x: e.clientX / PX, y: e.clientY / PX, t: 0 });
  });
});

// ===== Hire: transmit =====
const hireForm = $('#hireForm'), txStatus = $('#txStatus');
hireForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = (new FormData(hireForm).get('name') || '').toString().trim() || 'anon';
  const r = $('button[type="submit"]', hireForm).getBoundingClientRect();
  const cap = document.createElement('div');
  cap.className = 'capsule';
  cap.textContent = `✻ brief from ${name} ↑`;
  cap.style.left = `${r.left + r.width / 2}px`;
  cap.style.top = `${r.top}px`;
  document.body.appendChild(cap);
  setTimeout(() => cap.remove(), 2900);
  rings.push({ x: (r.left + r.width / 2) / PX, y: (r.top + r.height / 2) / PX, t: 0 });
  txStatus.innerHTML = `<span class="ok">✓</span> transmission away · thanks, <b>${escapeHtml(name)}</b> — reply within 5 days`;
  hireForm.reset();
});

// ===== Lock-in mode =====
const lock = $('#lock'), lockTimer = $('#lockTimer');
let lockStart = 0, lockInt = 0;
function openLock() {
  if (!lock.hidden) return;
  lock.hidden = false;
  lockStart = Date.now();
  lockTimer.textContent = '00:00';
  lockInt = setInterval(() => {
    const s = Math.floor((Date.now() - lockStart) / 1000);
    lockTimer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 250);
  $('#unlock').focus();
}
function closeLock() { lock.hidden = true; clearInterval(lockInt); }
$('#lockBtn').addEventListener('click', openLock);
$('#unlock').addEventListener('click', closeLock);
lock.addEventListener('click', (e) => { if (e.target === lock) closeLock(); });
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  if (e.key === 'Escape' && !lock.hidden) closeLock();
  else if (e.key === '/' ) { e.preventDefault(); promptInput.focus(); }
  else if (e.key === '?') runCommand('/help');
  else if (e.key.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey) openLock();
});

// ===== Boot =====
$('#year').textContent = new Date().getFullYear();
addEventListener('resize', resize);
addEventListener('load', measure);
resize();
initSchool();
requestAnimationFrame(frame);
