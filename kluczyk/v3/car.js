// Car visuals: the fleet photos, a small drawn EV for the pay button, car sounds and the licence plate.

function carFor(car, cls = '') {
  return `<span class="photo ${cls}"><img src="${car.photo.src}" alt="${esc(car.model + ' ' + car.trim + ', ' + car.color)}" style="object-position:${car.pos}" loading="lazy" decoding="async"><i class="photo__lights" aria-hidden="true"></i></span>`;
}

const photoCredit = car =>
  `fot. <a href="${car.photo.page}" target="_blank" rel="noopener">${esc(car.photo.author)}</a> · CC0 · Wikimedia Commons`;

// Side view of an EV (viewBox 0 0 320 130), only used as the little car driving across the pay button.
function carSVG(color = '#eef0f2', cls = '') {
  const wheel = x => `<g class="wheel" style="transform-origin:${x}px 100px">
    <circle cx="${x}" cy="100" r="20" fill="#17191d"/><circle cx="${x}" cy="100" r="12.4" fill="#b9bec6"/>
    <g stroke="#7b818b" stroke-width="2.2" stroke-linecap="round">${[0, 72, 144, 216, 288].map(a => {
      const r = a * Math.PI / 180;
      return `<line x1="${x}" y1="100" x2="${(x + Math.cos(r) * 11).toFixed(1)}" y2="${(100 + Math.sin(r) * 11).toFixed(1)}"/>`;
    }).join('')}</g></g>`;
  return `<svg class="ev ${cls}" viewBox="0 0 320 130" aria-hidden="true">
    <ellipse cx="165" cy="119" rx="145" ry="6" fill="rgba(0,0,0,.18)"/>
    <path d="M26 100 L26 74 Q26 60 36 54 L62 44 Q92 26 132 24 L182 24 Q198 24 212 34 L242 56 L286 63 Q299 66 300 80 L300 100 Z" fill="${color}"/>
    <path d="M68 48 Q96 32 132 31 L180 31 Q192 31 202 38 L224 55 L60 55 Z" fill="#26303c"/>
    <rect x="276" y="66.5" width="16" height="3" rx="1.5" fill="#fff5d1"/>
    <rect x="28" y="56" width="14" height="3" rx="1.5" fill="#c7362b"/>
    <path d="M54 100 A24 24 0 0 1 102 100 Z M228 100 A24 24 0 0 1 276 100 Z" fill="#111317"/>
    ${wheel(78)}${wheel(252)}
  </svg>`;
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
};

// Blink the indicators (amber corners) or flash the headlights over a photo.
function flash(el, what = 'blink', times = 2) {
  if (!el) return;
  el.classList.remove('blink', 'lights');
  void el.getBoundingClientRect();
  el.style.setProperty('--times', times);
  el.classList.add(what);
  clearTimeout(el._flashT);
  el._flashT = setTimeout(() => el.classList.remove(what), times * 520 + 60);
}

// ---------- licence plate ----------
function plateHTML(text, cls = '') {
  const stars = Array.from({ length: 12 }, (_, i) => {
    const a = i * Math.PI / 6;
    return `<circle cx="${(10 + Math.cos(a) * 6).toFixed(2)}" cy="${(9 + Math.sin(a) * 6).toFixed(2)}" r="0.9"/>`;
  }).join('');
  return `<span class="plate ${cls}"><span class="plate-eu"><svg viewBox="0 0 20 18" aria-hidden="true"><g fill="#ffd84a">${stars}</g></svg><b>PL</b></span><span class="plate-txt">${text}</span></span>`;
}
