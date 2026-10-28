// Side-view cars drawn in SVG (facing right, viewBox 0 0 320 130), the car sounds and the licence plate.

const BODIES = {
  hatch: {
    d: 'M36 100 L34 72 Q34 60 40 50 L52 36 Q56 31 64 31 L168 30 Q178 30 186 36 L222 58 L278 65 Q291 67 293 80 L294 100 Z',
    glass: 'M58 40 Q61 36 68 36 L166 36 Q174 36 180 41 L206 58 L52 58 Z',
    pillars: [118], doors: 'M122 58 L122 98 M202 60 Q199 80 203 98', handles: [104, 182],
    wheels: [82, 246], r: 18, wy: 100, head: [284, 71], tail: [36, 62], shoulder: 'M40 63 L222 62 L280 69',
  },
  mini: {
    d: 'M56 100 L54 74 Q54 60 62 52 L74 38 Q80 31 90 31 L170 31 Q182 31 190 38 L218 60 L254 66 Q266 69 268 82 L268 100 Z',
    glass: 'M80 42 Q84 37 92 37 L168 37 Q177 37 183 42 L204 59 L72 59 Z',
    pillars: [132], doors: 'M196 61 Q193 80 197 98', handles: [170],
    wheels: [98, 232], r: 17, wy: 100, head: [259, 72], round: true, tail: [56, 64], shoulder: 'M60 64 L218 63 L256 70',
  },
  wagon: {
    d: 'M22 100 L21 70 Q21 58 28 51 L38 36 Q42 30 52 30 L182 29 Q192 29 200 35 L238 58 L286 64 Q299 67 301 80 L301 100 Z',
    glass: 'M44 37 L180 36 Q188 36 194 41 L222 58 L34 58 Z',
    pillars: [98, 158], doors: 'M102 58 L102 98 M162 58 L162 98 M216 60 Q213 80 217 98', handles: [142, 198],
    wheels: [74, 254], r: 18, wy: 100, head: [291, 71], tail: [23, 60], shoulder: 'M26 62 L238 61 L288 68',
  },
  suv: {
    d: 'M24 104 L23 64 Q23 52 31 46 L42 26 Q46 20 56 20 L186 20 Q196 20 204 27 L238 52 L286 58 Q300 61 302 76 L302 104 Z',
    glass: 'M46 28 L184 27 Q192 27 198 33 L226 52 L36 52 Z',
    pillars: [104, 166], doors: 'M108 52 L108 96 M170 52 L170 96 M220 54 Q216 76 221 96', handles: [148, 202],
    wheels: [76, 254], r: 20, wy: 104, head: [293, 65], tail: [25, 56], shoulder: 'M27 57 L238 56 L290 62',
    extra: '<path d="M54 15 L184 15" stroke="#22252b" stroke-width="3.5" stroke-linecap="round"/><path d="M24 92 L302 92 L302 104 L24 104 Z" fill="#1d2025" opacity=".55"/>',
  },
  ev: {
    d: 'M26 100 L26 74 Q26 60 36 54 L62 44 Q92 26 132 24 L182 24 Q198 24 212 34 L242 56 L286 63 Q299 66 300 80 L300 100 Z',
    glass: 'M68 48 Q96 32 132 31 L180 31 Q192 31 202 38 L224 55 L60 55 Z',
    pillars: [140], doors: 'M144 55 L144 97 M218 57 Q214 78 219 97', handles: [124, 200],
    wheels: [78, 252], r: 20, wy: 100, head: [288, 68], bar: true, tail: [28, 58], shoulder: 'M30 60 L242 59 L290 66',
  },
  van: {
    d: 'M16 104 L16 28 Q16 14 30 14 L214 14 Q226 14 234 22 L264 52 L292 60 Q306 64 306 80 L306 104 Z',
    glass: 'M28 24 h52 v28 h-52z M88 24 h52 v28 h-52z M148 24 h48 v28 h-48z M206 24 Q216 24 222 30 L246 52 L206 52 Z',
    pillars: [], doors: 'M144 56 L144 98 M201 56 L201 98 M252 58 Q248 80 253 98', handles: [130, 234],
    wheels: [64, 262], r: 19, wy: 104, head: [297, 69], tail: [17, 34], tall: true, shoulder: 'M20 58 L264 57 L296 66',
  },
  cabrio: {
    d: 'M30 100 L30 80 Q30 68 42 66 L130 63 Q160 60 190 62 L280 68 Q294 70 296 84 L296 100 Z',
    glass: 'M184 62 L199 41 L206 42 L196 62 Z',
    pillars: [], doors: 'M140 64 L140 98 M206 64 Q203 82 207 98', handles: [184],
    wheels: [78, 246], r: 18, wy: 100, head: [286, 75], tail: [33, 71], shoulder: 'M36 70 L190 66 L282 72',
    extra: '<path d="M184 62 L199 41 L206 42" stroke="#22252b" stroke-width="2.5" fill="none" stroke-linejoin="round"/><rect x="146" y="46" width="13" height="18" rx="5" fill="#25282e"/><path d="M150 64 L160 64 L166 58" stroke="#25282e" stroke-width="3" fill="none" stroke-linecap="round"/>',
  },
  maluch: {
    d: 'M66 100 L64 80 Q64 66 76 60 Q88 36 114 32 L170 32 Q194 32 210 52 L220 62 Q242 66 248 80 L250 100 Z',
    glass: 'M88 58 Q98 40 116 38 L168 38 Q184 38 198 56 L200 58 Z',
    pillars: [142], doors: 'M196 60 Q193 80 197 97', handles: [178],
    wheels: [98, 220], r: 15, wy: 100, head: [243, 76], round: true, tail: [66, 72], shoulder: 'M68 66 L220 64 L246 72',
    extra: '<path d="M74 66 v8 M78 66 v8 M82 66 v8" stroke="#000" stroke-opacity=".3" stroke-width="1.5"/><path d="M60 94 h14 M240 94 h12" stroke="#d9dde2" stroke-width="3" stroke-linecap="round"/>',
  },
};

let carUid = 0;

function carSVG(body, color, cls = '') {
  const b = BODIES[body] || BODIES.hatch;
  const id = 'c' + (++carUid);
  const [hx, hy] = b.head, [tx, ty] = b.tail;
  const shadowX = (b.wheels[0] + b.wheels[1]) / 2, shadowW = (b.wheels[1] - b.wheels[0]) / 2 + 58;

  const arch = x => `<path d="M${x - b.r - 4} ${b.wy} A${b.r + 4} ${b.r + 4} 0 0 1 ${x + b.r + 4} ${b.wy} Z" fill="#111317"/>`;
  const wheel = x => {
    const spokes = [0, 72, 144, 216, 288].map(a => {
      const rad = a * Math.PI / 180, rr = b.r * 0.55;
      return `<line x1="${x}" y1="${b.wy}" x2="${(x + Math.cos(rad) * rr).toFixed(1)}" y2="${(b.wy + Math.sin(rad) * rr).toFixed(1)}"/>`;
    }).join('');
    return `<g class="wheel" style="transform-origin:${x}px ${b.wy}px">` +
      `<circle cx="${x}" cy="${b.wy}" r="${b.r}" fill="#17191d"/>` +
      `<circle cx="${x}" cy="${b.wy}" r="${b.r * 0.62}" fill="#b9bec6"/>` +
      `<g stroke="#7b818b" stroke-width="2.2" stroke-linecap="round">${spokes}</g>` +
      `<circle cx="${x}" cy="${b.wy}" r="${b.r * 0.18}" fill="#4d525b"/></g>`;
  };
  const head = b.round
    ? `<circle class="lamp-head" cx="${hx}" cy="${hy}" r="5"/>`
    : b.bar
      ? `<rect class="lamp-head" x="${hx - 12}" y="${hy - 1.5}" width="16" height="3" rx="1.5"/>`
      : `<ellipse class="lamp-head" cx="${hx}" cy="${hy}" rx="7" ry="3.5"/>`;
  const tail = b.tall
    ? `<rect class="lamp-tail" x="${tx}" y="${ty}" width="4" height="22" rx="1.5"/>`
    : `<rect class="lamp-tail" x="${tx}" y="${ty - 2}" width="${b.bar ? 14 : 6}" height="${b.bar ? 3 : 6}" rx="1.5"/>`;
  const pillars = b.pillars.length
    ? `<g clip-path="url(#${id}c)">${b.pillars.map(x => `<rect class="paint" x="${x}" y="0" width="6" height="100" fill="${color}"/>`).join('')}</g>`
    : '';
  const handles = b.handles.map(x => `<rect x="${x}" y="${b.wy - 34}" width="12" height="3" rx="1.5" fill="#000" fill-opacity=".28"/>`).join('');

  return `<svg class="car ${cls}" viewBox="0 0 320 130" aria-hidden="true" style="--paint:${color}">
  <defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".24"/>
    </linearGradient>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5b6f86"/><stop offset=".5" stop-color="#26303c"/><stop offset="1" stop-color="#151a21"/>
    </linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff3c4" stop-opacity=".85"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="${id}c"><path d="${b.glass}"/></clipPath>
  </defs>
  <ellipse class="car-shadow" cx="${shadowX}" cy="${b.wy + b.r - 1}" rx="${shadowW}" ry="6"/>
  <path class="beam" d="M${hx} ${hy} L${hx + 120} ${hy - 22} L${hx + 120} ${hy + 30} Z" fill="url(#${id}b)"/>
  <g class="car-body">
    <path d="${b.d}" fill="${color}" class="paint"/>
    <path d="${b.glass}" fill="url(#${id}g)"/>
    ${pillars}
    <path d="${b.d}" fill="url(#${id}s)"/>
    <path d="${b.shoulder}" stroke="#fff" stroke-opacity=".28" stroke-width="1.5" fill="none"/>
    <path d="${b.doors}" stroke="#000" stroke-opacity=".22" stroke-width="1.2" fill="none"/>
    ${handles}
    ${b.extra || ''}
    ${head}${tail}
    <circle class="blinker" cx="${hx - 10}" cy="${hy + 5}" r="2.6"/>
    <circle class="blinker" cx="${tx + 4}" cy="${ty + 7}" r="2.6"/>
  </g>
  ${arch(b.wheels[0])}${arch(b.wheels[1])}
  ${wheel(b.wheels[0])}${wheel(b.wheels[1])}
</svg>`;
}

function carFor(car, color, cls) {
  return carSVG(car.body, color || car.color, cls);
}

// ---------- sound (WebAudio, only ever started by a click) ----------
let audioCtx;
function ctx() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch (e) { return null; }
}

function tone(freqs, start, dur, type = 'square', vol = 0.06) {
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
  gain.gain.setValueAtTime(vol, t0 + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0, t0 + dur);
  filter.connect(gain).connect(ac.destination);
  freqs.forEach(f => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(filter);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  });
}

const sound = {
  horn: () => { tone([392, 494], 0, 0.22); tone([392, 494], 0.3, 0.42); },
  lock: () => { tone([1568], 0, 0.07, 'sine', 0.08); tone([1568], 0.12, 0.07, 'sine', 0.08); },
  unlock: () => tone([1175], 0, 0.1, 'sine', 0.08),
  trunk: () => { tone([880], 0, 0.06, 'sine', 0.07); tone([660], 0.09, 0.12, 'sine', 0.07); },
};

// Flash the blinkers / headlights of a rendered car.
function flash(svg, what = 'blink', times = 2) {
  if (!svg) return;
  svg.classList.remove('blink', 'lights');
  void svg.getBoundingClientRect();
  svg.style.setProperty('--times', times);
  svg.classList.add(what);
  clearTimeout(svg._flashT);
  svg._flashT = setTimeout(() => svg.classList.remove(what), times * 520 + 60);
}

// ---------- licence plate ----------
const PLATE_CHARS = '0123456789ACEFGHJKLMNPRSTUVWXY';

function newPlate() {
  let s = '';
  for (let i = 0; i < 5; i++) s += PLATE_CHARS[Math.floor(Math.random() * PLATE_CHARS.length)];
  return 'DW ' + s;
}

function plateHTML(text, cls = '') {
  const stars = Array.from({ length: 12 }, (_, i) => {
    const a = i * Math.PI / 6;
    return `<circle cx="${(10 + Math.cos(a) * 6).toFixed(2)}" cy="${(9 + Math.sin(a) * 6).toFixed(2)}" r="0.9"/>`;
  }).join('');
  return `<span class="plate ${cls}"><span class="plate-eu"><svg viewBox="0 0 20 18" aria-hidden="true"><g fill="#ffd84a">${stars}</g></svg><b>PL</b></span><span class="plate-txt">${text}</span></span>`;
}
