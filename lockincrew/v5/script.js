// lockincrew v5 — the ascent, in pixels
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ===== Pixel sprites =====
// '.' = transparent · 'w' = eye white (2×2, pupil tracked by JS) · cls letters get their own <g> for animation
const EYE = '#f5efe4', PUPIL = '#1a1a1a';
const SPRITES = {
  rocket: {
    pal: { o: '#d97757', h: '#e8a47e', s: '#b85a3e', b: '#e8e0d0', e: '#f5efe4', c: '#c9c0ad', k: '#1a1a1a', f: '#d97757', F: '#e0c068' },
    cls: { f: 'flame', F: 'flame' },
    eyeBase: 'b', eyes: [[8, 11]],
    rows: [
      '........os........',
      '.......ooos.......',
      '.......ooos.......',
      '......ohooos......',
      '......ooooos......',
      '.....ohooooos.....',
      '.....ohooooos.....',
      '.....ssssssss.....',
      '.....bebbbbbc.....',
      '.....bebbbbbc.....',
      '.....bebssbbc.....',
      '.....beswwsbc.....',
      '.....beswwsbc.....',
      '.....bebssbbc.....',
      '.....bebbbbbc.....',
      '.....bebbbbbc.....',
      '.....bebbbbbc.....',
      '.....bebbbbbc.....',
      '.....ooooooos.....',
      '....soooooooss....',
      '....sbebbbbbcs....',
      '....sbebkbbbcs....',
      '...sobebkbbbcos...',
      '...sobebkkbbcos...',
      '...sobebbbbbcos...',
      '..soobebbbbbcoos..',
      '..soo.kkkkkk.oos..',
      '..soo..kkkk..oos..',
      '......fFFFFf......',
      '......fFFFFf......',
      '.......fFFf.......',
      '.......fFFf.......',
      '........ff........',
      '........ff........',
    ],
  },
  minirocket: {
    pal: { o: '#d97757', b: '#e8e0d0', c: '#c9c0ad', k: '#1a1a1a', F: '#e0c068' },
    cls: { F: 'flame' },
    rows: [
      '....o....',
      '...ooo...',
      '...ooo...',
      '..ooooo..',
      '..bbbbc..',
      '..bbbbc..',
      '..bbkbc..',
      '..bbkbc..',
      '..bbbbc..',
      '.obbbbco.',
      '.obbbbco.',
      'oobbbbcoo',
      '...kkk...',
      '...FFF...',
      '...FFF...',
      '....F....',
    ],
  },
  octo: {
    pal: { o: '#d97757', h: '#e8a47e', s: '#b85a3e', k: '#1a1a1a', r: '#e0c068', c: '#d96868', A: '#d97757' },
    cls: { A: 'arm' },
    eyeBase: 'o', eyes: [[5, 5], [10, 5]],
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
  ufo: {
    pal: { a: '#8fc7c9', g: '#7fb069', s: '#43464f', h: '#7d8293', o: '#5d6170', L: '#e0c068', B: '#e0c068' },
    cls: { L: 'lights', B: 'beam' },
    eyeBase: 'g', eyes: [[9, 1], [12, 1]],
    rows: [
      '........aaaaaa........',
      '.......agwwgwwa.......',
      '......aggwwgwwga......',
      '......agggggggga......',
      '....ssssssssssssss....',
      '..hhhhhhhhhhhhhhhhhh..',
      '.oooLoooLoooLoooLoooo.',
      '..ssssssssssssssssss..',
      '.....ssssssssssss.....',
      '.......BBBBBBBB.......',
      '......BBBBBBBBBB......',
      '.....BBBBBBBBBBBB.....',
      '....BBBBBBBBBBBBBB....',
      '...BBBBBBBBBBBBBBBB...',
    ],
  },
  robot: {
    pal: { L: '#d96868', s: '#7d7566', o: '#a89f8c', h: '#c9c0ad', k: '#1a1a1a', t: '#a89f8c', u: '#7d7566', d: '#7fb069', A: '#7d7566' },
    cls: { L: 'antenna-light', d: 'screen', A: 'arm' },
    eyeBase: 'h', eyes: [[5, 3], [9, 3]],
    rows: [
      '.......LL.......',
      '.......ss.......',
      '...oooooooooo...',
      '...ohwwhhwwhs...',
      '...ohwwhhwwhs...',
      '...ohhhhhhhhs...',
      '...ohhkkkkhhs...',
      '...ssssssssss...',
      '......ssss......',
      '..A.tttttttu.A..',
      '..A.ttddddtu.A..',
      '..A.ttddddtu.A..',
      '.A..tttttttu..A.',
      '.....u....u.....',
      '.....u....u.....',
      '....uuu..uuu....',
    ],
  },
  tardi: {
    pal: { b: '#c9c0ad', h: '#e8e0d0', s: '#a89f8c', P: '#d97757', k: '#1a1a1a', L: '#a89f8c' },
    cls: { L: 'leg', P: 'pad' },
    eyeBase: 'b', eyes: [[17, 4]],
    rows: [
      '.......PPPP...........',
      '.......PPPP...........',
      '......hPPPPhhhhhhs....',
      '....bbbPkkPsbbbsbbbs..',
      '...bbbbsbbbsbbbsbwwbs.',
      '..bbbbbsbbbsbbbsbwwbbs',
      '..bbbbbsbbbsbbbsbbbbks',
      '..bbbbbsbbbsbbbsbbbbks',
      '...sbbbsbbbsbbbsbbbbs.',
      '....sbbsbbbsbbbsbbbs..',
      '....L...L...L...L..L..',
      '....L...L...L...L..L..',
      '...L.L.L.L.L.L.L.LL.L.',
    ],
  },
  cat: {
    pal: { f: '#d48fb0', h: '#ecbcd2', s: '#a86688', p: '#f0a8c8', n: '#d96868', k: '#1a1a1a', m: '#e8e0d0', T: '#d48fb0' },
    cls: { T: 'tail' },
    eyeBase: 'f', eyes: [[4, 5], [10, 5]],
    rows: [
      '................',
      '...ff......ff...',
      '...fpf....fpf...',
      '...fhhhhhfffs...',
      '..fffffffffffs..',
      '..ffwwffffwwfs..',
      '.mffwwffffwwfsm.',
      'm.fffffnnffffs.m',
      '...fffkffkffs...',
      '....fffffffs...T',
      '....fffffffs..T.',
      '...fffhhhhffs.T.',
      '...fffhhhhffsT..',
      '....fffffffs....',
      '....ff....ff....',
      '................',
    ],
  },
  pod: {
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
  balloon: {
    pal: { r: '#d96868', h: '#f0a0a0', s: '#a84d4d', l: '#a89f8c', k: '#7d7566' },
    rows: [
      '..rrrs..',
      '.rhrrrs.',
      'rhrrrrrs',
      'rhrrrrrs',
      'rrrrrrrs',
      '.rrrrrs.',
      '..rrrs..',
      '...rs...',
      '...l....',
      '....l...',
      '...l....',
      '....l...',
      '..kkkk..',
      '..kkkk..',
    ],
  },
  station: {
    pal: { p: '#4a5568', q: '#2e3442', t: '#a89f8c', m: '#c9c0ad', n: '#e8e0d0', L: '#d96868' },
    cls: { L: 'blink' },
    rows: [
      '................................................',
      '..ppppqppppp........................ppppqppppp..',
      '..ppppqppppp........................ppppqppppp..',
      '..qqqqqqqqqq........................qqqqqqqqqq..',
      '..ppppqppppp.........nnnnnnn........ppppqppppp..',
      '..ppppqppppp..nnnnnn.mmmmmmm.nnnnn..ppppqppppp..',
      '..qqqqqqqqqq..mmmmmm.mmmLLmm.mmmmm..qqqqqqqqqq..',
      '..ppppqppppp..mmmmmm.mmmmmmm.mmmmm..ppppqppppp..',
      '..ppppqpppppttmmmmmmtmmmmmmmtmmmmmttppppqppppp..',
      '..qqqqqqqqqq..mmmmmm.mmmmmmm.mmmmm..qqqqqqqqqq..',
      '..ppppqppppp..mmmmmm.mmmmmmm.mmmmm..ppppqppppp..',
      '..ppppqppppp.........mmmmmmm........ppppqppppp..',
      '..qqqqqqqqqq........................qqqqqqqqqq..',
      '..ppppqppppp........................ppppqppppp..',
      '..ppppqppppp........................ppppqppppp..',
      '................................................',
    ],
  },
  city: {
    pal: { x: '#1c1a18', z: '#24211e', y: '#e0c068', Y: '#e8a47e', Z: '#7fb069', R: '#d96868' },
    cls: { y: 'win', Y: 'win2', Z: 'win3', R: 'beacon' },
    rows: [
      '................................................................................................................................................................',
      '................................................................................................................................................................',
      '..................................................................R.............................................................................................',
      '..................................................................x.............................................................................................',
      '..................................................................x.............................................................................................',
      '.......................zzzzzzzzzzz................................x.....zzzzzzzzzzzz............................................................................',
      '.......................zzzzzzzzzzz................................x.....zzzzzzzzzzzz...........................................................................R',
      '.......................zyzzzyzzzzz......R.....................xxxxxxxxx.zyzyzzzyzzzz...........................................................................x',
      '.......................zzzzzzzzzzz......x.....................xxxxxxxxx.zzzzzzzzzzzz....................R...............................R......................x',
      '.......................zzzzzyzzzzz......x..............zzzzzzzxxxxxxxxx.zzzzzzzzzzzz....................z......zzzzzzzzzzzz.............z......................x',
      '.......................zzzzzzzzzzz......x..............zzzzzzzxxxxxxxxx.zzzzzzzzzzzz....................z......zzzzzzzzzzzz.............z......................x',
      '.......................zzzzzzzzzzz......x..............zzzzzYzxxxYxxxxx.zzzyzzzyzzzz......R.............z......zyzzzzzzzyzz.............z...................xxxx',
      '.......................zzzzzzzzzzzxxxxxxxxxxxx.........zzzzzzzxxxxxxxxx.zzzzzzzzzzzz......x.............z......zzzzzzzzzzzzxxxxxx.......z...................xxxx',
      '.......................zyzyzZzzzyzxxxxxxxxxxxx.........zzzzzzzxxxxxxxxx.zzzyzzzyzzzz......x......zzzzzzzzzzzzzzzZzyzzzZzyzzxxxxxxzzzzzzzzzzzzzz.............xxxx',
      '.......................zzzzzzzzzzzxyxxxyxxxYxx.........zzzzzzzxxxxxxxxx.zzzzzzzzzzzz......x......zzzzzzzzzzzzzzzzzzzzzzzzzzxZxYxxzzzzzzzzzzzzzz.............xxxx',
      'zzzzzzzzzzzxxxxxxxxxxxxzzzzzzzzzzzxxxxxxxxxxxx.........zzzzzZzxyxyxxxxx.zYzzzyzYzzzz......x......zyzzzyzYzyzzzzzzzzzzzYzyzzxxxxxxzzzzzzzzzzzzzz.............xxxx',
      'zzzzzzzzzzzxxxxxxxxxxxxzzzzzzzzzzzxZxyxxxxxxxx.zzzzzzzzzzzzzzzxxxxxxxxx.zzzzzzzzzzzzxxxxxxxxxxxxxzzzzzzzzzzzzzzzzzzzzzzzzzzxxxxxxzzzzzzzzzzzzzz.............xxxx',
      'zyzzzzzyzzzxxxxxyxxxYxxzzzzzzzzzzzxxxxxxxxxxxx.zzzzzzzzzzzyzzzxxxxxxxyx.zzzzzzzzzyzzxxxxxxxxxxxxxzzzzzyzzzzzyzzzzzzzzzyzyzzxxxxxxzzzzzYzYzYzzzz.............xZxx',
      'zzzzzzzzzzzxxxxxxxxxxxxzzzzzzzzzzzxyxxxxxxxxxx.zyzYzzzzzzzzzzzxxxxxxxxx.zzzzzzzzzzzzxxxxxxxyxxxYxzzzzzzzzzzzzzzzzzzzzzzzzzzxxxYxxzzzzzzzzzzzzzz.............xxxx',
      'zyzzzyzyzzzxyxxxxxxxxxxzzzzzYzZzzzxxxxxxxxxxxx.zzzzzzzzzzzzzzzxxxxxxxxx.zzzzzzzzzzzzxxxxxxxxxxxxxzzzzzYzzzzzzzzzzzzzyzzzzzzxxxxxxzzzyzzzzzzzyzzzzzzzzzzzzzzzxxxx',
      'zzzzzzzzzzzxxxxxxxxxxxxzzzzzzzzzzzxxxxxxxxxxxx.zzzzzzzzzzzzzzzxxxxxxxxx.zzzzzzzzzzzzxZxxxxxxxxxxxzzzzzzzzzzzzzzzzzzzzzzzzzzxxxxxxzzzzzzzzzzzzzzzzzzzzzzzzzzzxxxx',
      'zzzyzYzzzzzxxxxxxxxxxxxzzzzzzzyzzzxxxxxxxxxxxx.zzzzzzzzzYzzzzzxyxxxxxYx.zzzzzyzyzzzzxxxxxxxxxxxxxzzzzzyzzzzzzzzzzzyzzzyzzzzxxxxxxzzzzzzzyzzzzzzzzzzzzzyzzzYzxyxx',
      'zzzzzzzzzzzxxxxxxxxxxxxzzzzzzzzzzzxxxxxxxxxYxx.zzzyzzzzzzzzzzzxxxxxxxxx.zzzzzzzzzzzzxxxxxxxxxxxxxzzzzzzzzzzzzzzzzzzzzzzzzzzxZxxxxzzzzzzzzzzzzzzzzzzzzzzzzzzzxxxx',
      'zzzzzzzyzzzxYxyxxxyxxxxzZzyzzzzzzzxxxxxxxxxxxx.zzzzzzzzzzzzzzzxxxxxxxyx.zzzzzzzzzyzzxxxxxxxxxxxxxzYzzzzzyzzzzzzzzzzzzzzzZzzxxxxxxzzzzzzzzzyzYzzzYzzzyzZzzzYzxxxx',
      'zzzzzzzzzzzxxxxxxxxxxxxzzzzzzzzzzzxxxxxyxxxyxx.zzzzzzzzzzzzzzzxxxxxxxxx.zzzzzzzzzzzzxxxxxxxxxxxxxzzzzzzzzzzzzzzzzzzzzzzzzzzxxxyxxzzzzzzzzzzzzzzzzzzzzzzzzzzzxxxx',
      'zzzzzzzzzzzxxxxxxxxxxxxzzzzzzzzzzzxxxxxxxxxxxx.zzzzzzzzzzzzzzzxxxxxxxxx.zzzzzzzzzzzzxxxxxxxxxxxxxzzzzzzzzzzzzzzzzzzzzzzzzzzxxxxxxzzzzzzzzzzzzzzzzzzzzzzzzzzzxxxx',
    ],
  },
  planet: {
    pal: { p: '#3e6a70', h: '#5d8a8f', s: '#2c4a50', b: '#7fb069', r: '#e8a47e' },
    rows: [
      '....................',
      '.........hh.........',
      '......hhhhhhpp......',
      '....hhhhhhhppppp....',
      '...hhhhhhhppppppp...',
      '...hhhhhhpppppppp...',
      '..hhbbbbbbbbbbbppp..',
      '..hhbbbbbbbbbbbppp..',
      'rrhhhhppppppppppps..',
      '.hrhhpppppppppppsss.',
      '.hhhpppppppppppssss.',
      '..hpppppppppppsssr..',
      '..pppppbbbbbbbbbbsrr',
      '..ppppppppppssssss..',
      '...ppppppppssssss...',
      '...pppppppsssssss...',
      '....pppppsssssss....',
      '......ppssssss......',
      '.........ss.........',
      '....................',
    ],
  },
  mirror: {
    pal: { o: '#e0c068', h: '#f3d9a4', s: '#b8963e', k: '#7d7566' },
    rows: [
      '.............k............',
      '.............k............',
      '.......hos..hos..hos......',
      '......hoohshoohshoohs.....',
      '......oohosoohosoohos.....',
      '.......sss..sss..sss......',
      '....hos..hos.khos..hos....',
      '...hoohshoohshoohshoohs...',
      '...oohosoohosoohosoohos...',
      '....sss..sss.ksss..sss....',
      '..hos..hos.......hos..hos.',
      '.hoohshoohs.....hoohshoohs',
      '.oohosoohos.....oohosoohos',
      '..sss..sss.......sss..sss.',
      '....hos..hos..hos..hos....',
      '...hoohshoohshoohshoohs...',
      '...oohosoohosoohosoohos...',
      '....sss..sss..sss..sss....',
      '.......hos..hos..hos......',
      '......hoohshoohshoohs.....',
      '......oohosoohosoohos.....',
      '.......sss..sss..sss......',
      '..........................',
      '..........................',
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

// ===== Altitude model =====
const MAX_ALT = 1500000;
const zones = $$('.zone');
let anchors = [];
let maxScroll = 1;

function measure() {
  const mid = innerHeight * 0.4;
  maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  anchors = zones.map((z, i) => ({ y: i === 0 ? 0 : Math.max(0, z.offsetTop - mid), a: +z.dataset.alt, id: z.id }));
  anchors[anchors.length - 1].y = Math.min(anchors[anchors.length - 1].y, maxScroll - 1);
  anchors.push({ y: maxScroll, a: MAX_ALT });
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i].y <= anchors[i - 1].y) anchors[i].y = anchors[i - 1].y + 1;
  }
  placeTicks();
}
function altAt(scroll) {
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1], b = anchors[i];
    if (scroll <= b.y) return lerp(a.a, b.a, clamp((scroll - a.y) / (b.y - a.y), 0, 1));
  }
  return MAX_ALT;
}
function zoneFor(a) {
  if (a < 100) return ['ground', a < 12 ? 'ground control' : 'the atmosphere'];
  if (a < 400) return ['karman', 'kármán line'];
  if (a < 35786) return ['leo', 'low orbit'];
  if (a < 384400) return ['geo', 'geostationary'];
  if (a < 1500000) return ['lunar', 'lunar distance'];
  return ['l2', 'l2 · the quiet'];
}

// ===== Gauge + title bar =====
const gAlt = $('#gAlt'), gZone = $('#gZone'), gRocket = $('#gRocket'), gFill = $('#gFill'), tAlt = $('#tAlt');
const gGrav = $('#gGrav'), gDelay = $('#gDelay'), gAir = $('#gAir'), gNoise = $('#gNoise');
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

let shownAlt = 0, popped = 0, currentZone = '';
const noiseAt = (a) => Math.max(0, Math.round(47 * (1 - a / 60)) - popped);
const RE = 6371;

function updateGauge(alt) {
  shownAlt = lerp(shownAlt, alt, 0.14);
  if (Math.abs(shownAlt - alt) < 0.5) shownAlt = alt;
  const txt = Math.round(shownAlt).toLocaleString('en-US');
  gAlt.textContent = txt;
  tAlt.textContent = txt;
  const g = Math.pow(RE / (RE + shownAlt), 2);
  gGrav.textContent = g >= 0.01 ? `${g.toFixed(2)} g` : `${(g * 1000).toFixed(2)} mg`;
  const ms = (shownAlt / 299792.458) * 1000;
  gDelay.textContent = ms < 1000 ? `${ms.toFixed(ms < 10 ? 2 : 0)} ms` : `${(ms / 1000).toFixed(2)} s`;
  const air = 100 * Math.exp(-shownAlt / 8.5);
  gAir.textContent = air >= 1 ? `${air.toFixed(0)}%` : air >= 0.001 ? `${air.toFixed(3)}%` : 'vacuum';
  const n = noiseAt(shownAlt);
  gNoise.textContent = n > 0 ? `${n} ping${n === 1 ? '' : 's'}` : 'silence ✓';
  gNoise.classList.toggle('ok', n === 0);

  const p = clamp(scrollY / maxScroll, 0, 1);
  gRocket.style.top = `${(1 - p) * 100}%`;
  gFill.style.height = `${p * 100}%`;
  ticks.forEach((t) => t.classList.toggle('passed', parseFloat(t.style.top) <= p * 100 + 0.5));

  const [key, label] = zoneFor(alt);
  if (key !== currentZone) {
    currentZone = key;
    document.body.dataset.zone = key;
  }
  gZone.textContent = label;
  const active = [...anchors].reverse().find((a) => a.id && scrollY >= a.y - 2);
  tabs.forEach((t) => t.classList.toggle('active', !!active && t.getAttribute('href') === `#${active.id}`));
}

// ===== Sky canvas (1/PX resolution, upscaled pixelated) =====
const PX = 4;
const canvas = $('#sky');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, cw = 0, ch = 0;
function resize() {
  W = innerWidth; H = innerHeight;
  cw = Math.ceil(W / PX); ch = Math.ceil(H / PX);
  canvas.width = cw; canvas.height = ch;
  ctx.imageSmoothingEnabled = false;
  measure();
}

// sky colour: [altitude, top colour, horizon colour]
const skyStops = [
  [0, [52, 38, 54], [217, 119, 87]],
  [12, [40, 30, 46], [150, 82, 66]],
  [50, [24, 20, 30], [62, 40, 44]],
  [100, [16, 15, 20], [28, 22, 28]],
  [400, [13, 13, 16], [16, 15, 18]],
  [MAX_ALT, [12, 12, 14], [14, 13, 15]],
];
function skyAt(a) {
  for (let i = 1; i < skyStops.length; i++) {
    const [a0, t0, b0] = skyStops[i - 1], [a1, t1, b1] = skyStops[i];
    if (a <= a1) {
      const t = clamp((a - a0) / (a1 - a0), 0, 1);
      return [t0.map((v, k) => lerp(v, t1[k], t)), b0.map((v, k) => lerp(v, b1[k], t))];
    }
  }
  return [skyStops[skyStops.length - 1][1], skyStops[skyStops.length - 1][2]];
}
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

const STARS = reduced ? 70 : 200;
const stars = Array.from({ length: STARS }, () => ({
  x: Math.random() * innerWidth / PX, y: Math.random() * innerHeight / PX,
  z: 0.2 + Math.random() * 0.8, ph: Math.random() * Math.PI * 2,
  warm: Math.random() < 0.18,
}));
const rings = [];
const meteors = [];

addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button, input, textarea, select, label, .ping, .op-stage, .sat, .prompt-area')) return;
  rings.push({ x: e.clientX / PX, y: e.clientY / PX, t: 0 });
});

// space junk (boids) in document space inside #manifesto
const junk = [];
const junkZone = $('#manifesto');
function junkBox() {
  const top = junkZone.offsetTop;
  return { x0: 0, x1: W, y0: top + 40, y1: top + junkZone.offsetHeight - 40 };
}
function initJunk() {
  const b = junkBox();
  const n = reduced ? 0 : W < 700 ? 14 : 26;
  for (let i = 0; i < n; i++) {
    junk.push({ x: W * 0.5 + Math.random() * 160, y: b.y0 + 420 + Math.random() * 140, vx: 1.6 + Math.random(), vy: Math.random() - 0.5, c: Math.random() < 0.3 ? '#d97757' : '#a89f8c' });
  }
}
function stepJunk(scroll) {
  const b = junkBox();
  const mx = mouse.x, my = mouse.y + scroll;
  for (const f of junk) {
    let ax = 0, ay = 0, cx = 0, cy = 0, vx = 0, vy = 0, n = 0;
    for (const o of junk) {
      if (o === f) continue;
      const dx = o.x - f.x, dy = o.y - f.y, d2 = dx * dx + dy * dy;
      if (d2 < 3600) {
        n++; cx += o.x; cy += o.y; vx += o.vx; vy += o.vy;
        if (d2 < 500) { ax -= dx / (d2 + 1) * 6; ay -= dy / (d2 + 1) * 6; }
      }
    }
    if (n) {
      ax += (cx / n - f.x) * 0.0015 + (vx / n - f.vx) * 0.03;
      ay += (cy / n - f.y) * 0.0015 + (vy / n - f.vy) * 0.03;
    }
    const m = 80;
    if (f.x < b.x0 + m) ax += 0.1;
    if (f.x > b.x1 - m) ax -= 0.1;
    if (f.y < b.y0 + m) ay += 0.1;
    if (f.y > b.y1 - m) ay -= 0.1;
    if (mouse.active) {
      const dx = f.x - mx, dy = f.y - my, d2 = dx * dx + dy * dy;
      if (d2 < 140 * 140) {
        const d = Math.sqrt(d2) || 1, k = (1 - d / 140) * 1.4;
        ax += (dx / d) * k; ay += (dy / d) * k;
      }
    }
    f.vx += ax; f.vy += ay;
    const sp = Math.hypot(f.vx, f.vy) || 1;
    if (sp > 2.6) { f.vx *= 2.6 / sp; f.vy *= 2.6 / sp; }
    if (sp < 0.7) { f.vx *= 0.7 / sp; f.vy *= 0.7 / sp; }
    f.x += f.vx; f.y += f.vy;
  }
}
function drawJunk(scroll) {
  for (const f of junk) {
    const x = Math.round(f.x / PX), y = Math.round((f.y - scroll) / PX);
    if (y < -2 || y > ch + 2) continue;
    ctx.fillStyle = f.c;
    ctx.fillRect(x, y, 2, 1);
    ctx.fillRect(x, y + 1, 1, 1);
  }
}

// Earth below, shrinking as we climb
function drawEarth(alt) {
  if (alt < 60) return;
  const fade = clamp((alt - 60) / 60, 0, 1);
  const r = Math.max(5, (1700 / PX) * (RE / (RE + alt)) ** 1.15);
  const top = ch - Math.min(42, 2 * r + 4);
  const cx = cw * 0.5, cy = top + r;
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#e8a47e';
  ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c4a50';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3e6a70';
  ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.2, r * 0.75, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(127, 176, 105, .55)';
  ctx.fillRect(Math.round(cx - r * 0.5), Math.round(cy - r * 0.55), Math.max(1, Math.round(r * 0.35)), Math.max(1, Math.round(r * 0.18)));
  ctx.fillRect(Math.round(cx + r * 0.1), Math.round(cy - r * 0.3), Math.max(1, Math.round(r * 0.3)), Math.max(1, Math.round(r * 0.25)));
  ctx.fillStyle = 'rgba(10, 10, 14, .55)';
  ctx.beginPath(); ctx.arc(cx + r * 0.35, cy + r * 0.1, r * 0.95, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

let lastScroll = scrollY, time = 0;
function frame() {
  time++;
  const scroll = scrollY;
  const dScroll = (scroll - lastScroll) / PX;
  lastScroll = scroll;
  const alt = altAt(scroll);
  updateGauge(alt);

  // banded sky
  const [topC, horC] = skyAt(alt);
  const BANDS = 16;
  for (let i = 0; i < BANDS; i++) {
    const t = Math.pow(i / (BANDS - 1), 1.6);
    ctx.fillStyle = rgb(topC.map((v, k) => lerp(v, horC[k], t)));
    ctx.fillRect(0, Math.floor((i * ch) / BANDS), cw, Math.ceil(ch / BANDS) + 1);
  }

  // stars: fade in with altitude, stream downward as we climb (warp streaks when fast)
  const starA = clamp(0.15 + alt / 120, 0, 1);
  const warp = clamp(Math.abs(dScroll) * 0.6, 0, 14);
  const mx = mouse.x / PX, my = mouse.y / PX;
  const near = [];
  for (const s of stars) {
    if (!reduced) {
      s.y += dScroll * s.z * 0.6 + 0.01 * s.z;
      s.x += 0.004 * s.z;
    }
    if (s.y > ch + 2) { s.y = -2 - warp; s.x = Math.random() * cw; }
    if (s.y < -2 - warp) { s.y = ch + 2; s.x = Math.random() * cw; }
    if (s.x > cw) s.x = 0;
    const horizonFade = alt < 100 ? clamp(1 - s.y / (ch * (0.35 + alt / 160)), 0, 1) : 1;
    const tw = 0.55 + 0.45 * Math.sin(time * 0.04 * s.z + s.ph);
    let a = starA * horizonFade * (0.3 + 0.7 * s.z) * tw;
    if (a < 0.03) continue;
    let glow = 0;
    for (const r of rings) {
      if (Math.abs(Math.hypot(s.x - r.x, s.y - r.y) - r.t * 2.2) < 5) glow = Math.max(glow, 1 - r.t / 90);
    }
    const x = Math.round(s.x), y = Math.round(s.y);
    ctx.fillStyle = glow > 0.05 ? `rgba(232, 164, 126, ${0.5 + glow * 0.5})` : s.warm ? `rgba(232, 164, 126, ${a})` : `rgba(232, 224, 208, ${a})`;
    if (warp > 1.2 && alt > 60) ctx.fillRect(x, y - Math.round(warp * s.z), 1, Math.max(1, Math.round(warp * s.z)));
    else ctx.fillRect(x, y, 1, 1);
    if (s.z > 0.85 && tw > 0.95) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    if (mouse.active && alt > 100) {
      const d = Math.hypot(s.x - mx, s.y - my);
      if (d < 34) near.push([d, x, y]);
    }
  }

  // constellation lines from the cursor to the nearest stars
  if (near.length) {
    near.sort((a, b) => a[0] - b[0]);
    ctx.fillStyle = 'rgba(217, 119, 87, .55)';
    for (const [d, x, y] of near.slice(0, 4)) {
      const steps = Math.max(2, Math.round(d / 2));
      for (let i = 1; i < steps; i += 2) {
        const t = i / steps;
        ctx.fillRect(Math.round(lerp(mx, x, t)), Math.round(lerp(my, y, t)), 1, 1);
      }
      ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    }
  }

  // shooting stars
  if (!reduced && alt > 80 && Math.random() < 0.006) meteors.push({ x: Math.random() * cw, y: Math.random() * ch * 0.5, t: 0 });
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.t++;
    if (m.t > 26) { meteors.splice(i, 1); continue; }
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = `rgba(232, 224, 208, ${(1 - k / 8) * (1 - m.t / 26)})`;
      ctx.fillRect(Math.round(m.x + m.t * 3 - k * 2), Math.round(m.y + m.t * 1.5 - k), 1, 1);
    }
  }

  drawEarth(alt);

  // radio pings
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

  if (junk.length) {
    const zr = junkZone.getBoundingClientRect();
    if (zr.bottom > -100 && zr.top < H + 100) { stepJunk(scroll); drawJunk(scroll); }
  }

  launchRocket(scroll);
  updateEyes();
  requestAnimationFrame(frame);
}

// ===== Liftoff: the hero rocket climbs as you scroll =====
const rocketWrap = $('#rocketWrap');
const countdown = $('#countdown');
let tminus = 10;
setInterval(() => {
  if (scrollY > 40) return;
  tminus = tminus <= 1 ? 10 : tminus - 1;
  countdown.textContent = `t-${tminus}`;
}, 1000);
function launchRocket(scroll) {
  const lift = Math.max(0, scroll) * 1.25;
  rocketWrap.style.transform = `translateY(${-Math.round(lift / 4) * 4}px)`;
  if (scroll > 40) countdown.textContent = 'liftoff ✓';
}

// ===== Pixel eyes follow the cursor =====
const pupils = $$('.px-pupil').map((el) => ({ el, x: +el.dataset.x, y: +el.dataset.y, eye: el.parentNode.firstElementChild }));
function updateEyes() {
  if (!mouse.active) return;
  for (const p of pupils) {
    const r = p.eye.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    p.el.setAttribute('x', p.x + (mouse.x < cx ? 0 : 1));
    p.el.setAttribute('y', p.y + (mouse.y < cy - r.height ? 0 : 1));
  }
}

// ===== Flickering neon word =====
const hlWord = $('.hl-word');
hlWord.innerHTML = [...hlWord.textContent].map((c, i) => `<span class="ch" style="--i:${i}">${c}</span>`).join('');

// ===== Notification boxes rising from the city =====
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
  if ($('#ground').getBoundingClientRect().bottom < 100) return;
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

// ===== Prompt (v2 command set + launching) =====
const promptInput = $('#promptInput');
const replyStream = $('#replyStream');
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const replies = [
  { match: /^\/lockin/i, run: () => { openLock(); return 'entering <b>LOCK_IN_MODE</b> · airlock sealed · slack: no signal'; } },
  { match: /^\/(launch|liftoff)(\s+\d+)?/i, run: (cmd) => {
    const want = parseInt(cmd.split(/\s+/)[1], 10);
    const target = isNaN(want) ? 'crew' : [...zones].reverse().find((z) => +z.dataset.alt <= want)?.id || 'ground';
    goTo(target);
    return `launching to <b>${isNaN(want) ? '35,786' : want.toLocaleString('en-US')} km</b> · 3… 2… 1…`;
  } },
  { match: /^\/(ground|land|home)/i, run: () => { goTo('ground'); return 'returning to ground. the noise is still down here, sorry.'; } },
  { match: /^\/pricing/i, run: () => '<b>pricing</b> — strike team €60-120k fixed · rescue op €180/h t&m · ai pilot €25-45k · embedded €18-26k/mo. brief is better than spreadsheet.' },
  { match: /^\/timezone/i, run: () => '<b>timezones</b> — warsaw (utc+1), lisbon (utc+0). overlap with eu + us east. async-first, sync when it actually moves something.' },
  { match: /^\/stack/i, run: () => '<b>stack we reach for</b> — typescript, rust, python, go · postgres, redis · react, svelte · terraform, fly.io, aws · claude · linear, github, signal. no jira.' },
  { match: /^\/availability/i, run: () => '<b>next launch window</b> — strike cell: q1 · rescue op: this month (1 slot) · embedded: q1 · ai pilot: waitlist.' },
  { match: /^\/standup/i, run: () => '<b>standup</b> — we don\'t. one written brief on monday, one demo on friday, async in between. presence is not output.' },
  { match: /^\/help|^\?$/i, run: () => '<b>commands</b> — /launch [km] · /ground · /manifesto · /services · /crew · /receipts · /hire · /lockin · /pricing · /timezone · /stack · /availability · /standup · /clear' },
  { match: /^\/clear/i, run: () => { replyStream.innerHTML = ''; return null; } },
  { match: /^\/(manifesto|services|crew|receipts|hire)/i, run: (cmd) => { const k = cmd.slice(1).split(' ')[0].toLowerCase(); goTo(k); return `cd <b>/${k}</b> · climbing…`; } },
  { match: /meeting|standup|sync|jira/i, run: () => 'we don\'t do that up here. one brief, one demo, the rest is the keyboard.' },
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
    if (e.target.id === 'missionLog') $$('.log-line', e.target).forEach((l, i) => setTimeout(() => l.classList.add('on'), 250 + i * 380));
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

// ===== Hire: transmit (the capsule falls back to earth) =====
const hireForm = $('#hireForm'), txStatus = $('#txStatus');
hireForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = (new FormData(hireForm).get('name') || '').toString().trim() || 'anon';
  const r = $('button[type="submit"]', hireForm).getBoundingClientRect();
  const cap = document.createElement('div');
  cap.className = 'capsule';
  cap.textContent = `✻ brief from ${name} ↓ earth`;
  cap.style.left = `${r.left + r.width / 2}px`;
  cap.style.top = `${r.top}px`;
  document.body.appendChild(cap);
  setTimeout(() => cap.remove(), 2900);
  rings.push({ x: (r.left + r.width / 2) / PX, y: (r.top + r.height / 2) / PX, t: 0 });
  txStatus.innerHTML = `<span class="ok">✓</span> transmission away · 5.0 s to earth · thanks, <b>${escapeHtml(name)}</b> — reply within 5 days`;
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
  else if (e.key === '/') { e.preventDefault(); promptInput.focus(); }
  else if (e.key === '?') runCommand('/help');
  else if (e.key.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey) openLock();
});

// ===== Boot =====
$('#year').textContent = new Date().getFullYear();
addEventListener('resize', resize);
addEventListener('load', measure);
resize();
initJunk();
requestAnimationFrame(frame);
