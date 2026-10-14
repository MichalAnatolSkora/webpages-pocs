// lockincrew v3 — the descent
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

const mouse = { x: -9999, y: -9999, active: false };
addEventListener('pointermove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.active = true;
}, { passive: true });
document.addEventListener('pointerleave', () => { mouse.active = false; });

// ===== Depth model =====
const MAX_DEPTH = 10994;
const zones = $$('.zone');
let anchors = [];
let maxScroll = 1;

function measure() {
  const mid = innerHeight * 0.5;
  maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  anchors = zones.map((z, i) => ({
    y: i === 0 ? 0 : Math.max(0, z.offsetTop - mid),
    d: +z.dataset.depth,
    id: z.id,
  }));
  anchors.push({ y: maxScroll, d: MAX_DEPTH });
  // keep monotonic
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

// ===== Gauge =====
const gDepth = $('#gDepth'), gZone = $('#gZone'), gSub = $('#gSub'), gFill = $('#gFill'), gTrack = $('#gTrack');
const gPressure = $('#gPressure'), gLight = $('#gLight'), gTemp = $('#gTemp'), gNoise = $('#gNoise');
const ticks = $$('.g-tick');
const navLinks = $$('.nav a:not(.nav-cta)');

function placeTicks() {
  ticks.forEach((t) => {
    const a = anchors.find((x) => x.id === t.dataset.go);
    if (a) t.style.top = `${(a.y / maxScroll) * 100}%`;
  });
}
ticks.forEach((t) => t.addEventListener('click', () => {
  document.getElementById(t.dataset.go).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}));

let shownDepth = 0;
let popped = 0;
let currentZone = '';

function noiseAt(d) { return Math.max(0, Math.round(47 * (1 - d / 600)) - popped); }

function updateGauge(depth) {
  shownDepth = lerp(shownDepth, depth, 0.12);
  if (Math.abs(shownDepth - depth) < 0.5) shownDepth = depth;
  const d = shownDepth;
  gDepth.textContent = Math.round(d).toLocaleString('en-US');
  const light = 100 * Math.exp(-d / 43);
  gLight.textContent = light >= 1 ? `${light.toFixed(0)}%` : light >= 0.01 ? `${light.toFixed(2)}%` : '0%';
  gPressure.textContent = `${Math.round(1 + d / 10).toLocaleString('en-US')} atm`;
  gTemp.textContent = `${(2 + 16 * Math.exp(-d / 300)).toFixed(1)} °C`;
  const n = noiseAt(d);
  gNoise.textContent = n > 0 ? `${n} ping${n === 1 ? '' : 's'}` : 'silence';
  gNoise.classList.toggle('zero', n === 0);

  const p = clamp(scrollY / maxScroll, 0, 1);
  gSub.style.top = `${p * 100}%`;
  gFill.style.height = `${p * 100}%`;
  ticks.forEach((t) => t.classList.toggle('passed', parseFloat(t.style.top) <= p * 100 + 0.5));

  const [key, label] = zoneFor(depth);
  if (key !== currentZone) {
    currentZone = key;
    document.body.dataset.zone = key;
    gZone.textContent = label;
  }
  const active = [...anchors].reverse().find((a) => scrollY >= a.y - 2 && a.id);
  navLinks.forEach((l) => l.classList.toggle('active', active && l.getAttribute('href') === `#${active.id}`));
}

// ===== Sea canvas =====
const canvas = $('#sea');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  measure();
}

const colorStops = [
  [0, [28, 112, 142]],
  [150, [16, 78, 112]],
  [600, [9, 42, 78]],
  [2000, [6, 20, 44]],
  [5000, [4, 9, 24]],
  [11000, [2, 4, 10]],
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

// marine snow & plankton
const SNOW = reduced ? 50 : 150;
const snow = Array.from({ length: SNOW }, () => ({
  x: Math.random() * innerWidth,
  y: Math.random() * innerHeight,
  z: 0.25 + Math.random() * 0.75,
  r: 0.6 + Math.random() * 1.6,
  ph: Math.random() * Math.PI * 2,
}));
// surface bubbles
const bubbles = [];
// sonar pings
const rings = [];

addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button, input, textarea, label, .ping, .op-stage, .blip')) return;
  rings.push({ x: e.clientX, y: e.clientY, t: 0 });
});

// ===== Fish school (boids, in document space inside #manifesto) =====
const school = [];
const schoolZone = $('#manifesto');
function schoolBox() {
  const top = schoolZone.offsetTop;
  return { x0: 0, x1: W, y0: top + 40, y1: top + schoolZone.offsetHeight - 40 };
}
function initSchool() {
  const b = schoolBox();
  const n = reduced ? 0 : W < 700 ? 18 : 34;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    school.push({
      x: W * 0.5 + Math.random() * 160,
      y: b.y0 + 420 + Math.random() * 140,
      vx: Math.cos(a) * 1.5 + 1.5,
      vy: Math.sin(a) * 0.6,
      s: 0.8 + Math.random() * 0.5,
      t: Math.random() * 10,
    });
  }
}
function stepSchool(scroll) {
  const b = schoolBox();
  const mx = mouse.x, my = mouse.y + scroll;
  for (const f of school) {
    let ax = 0, ay = 0, cx = 0, cy = 0, vx = 0, vy = 0, n = 0;
    for (const o of school) {
      if (o === f) continue;
      const dx = o.x - f.x, dy = o.y - f.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 3600) {
        n++;
        cx += o.x; cy += o.y; vx += o.vx; vy += o.vy;
        if (d2 < 400) { ax -= dx / (d2 + 1) * 6; ay -= dy / (d2 + 1) * 6; }
      }
    }
    if (n) {
      ax += (cx / n - f.x) * 0.002 + (vx / n - f.vx) * 0.05;
      ay += (cy / n - f.y) * 0.002 + (vy / n - f.vy) * 0.05;
    }
    // soft walls
    const m = 80;
    if (f.x < b.x0 + m) ax += 0.12;
    if (f.x > b.x1 - m) ax -= 0.12;
    if (f.y < b.y0 + m) ay += 0.12;
    if (f.y > b.y1 - m) ay -= 0.12;
    // flee the cursor
    if (mouse.active) {
      const dx = f.x - mx, dy = f.y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < 140 * 140) {
        const d = Math.sqrt(d2) || 1;
        const k = (1 - d / 140) * 1.4;
        ax += (dx / d) * k;
        ay += (dy / d) * k;
      }
    }
    f.vx += ax; f.vy += ay;
    const sp = Math.hypot(f.vx, f.vy);
    const max = 3.4, min = 1.1;
    if (sp > max) { f.vx *= max / sp; f.vy *= max / sp; }
    if (sp < min) { f.vx *= min / sp; f.vy *= min / sp; }
    f.x += f.vx; f.y += f.vy;
    f.t += 0.25 + sp * 0.05;
  }
}
function drawSchool(scroll) {
  for (const f of school) {
    const y = f.y - scroll;
    if (y < -20 || y > H + 20) continue;
    ctx.save();
    ctx.translate(f.x, y);
    ctx.rotate(Math.atan2(f.vy, f.vx));
    ctx.scale(f.s, f.s);
    const wag = Math.sin(f.t) * 3;
    ctx.fillStyle = 'rgba(190, 232, 244, 0.75)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(-14, -4 + wag);
    ctx.lineTo(-14, 4 + wag);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(10, 30, 50, .9)';
    ctx.beginPath();
    ctx.arc(5, -0.8, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ===== Render loop =====
let lastScroll = scrollY;
let time = 0;
function frame() {
  time += 1;
  const scroll = scrollY;
  const dScroll = scroll - lastScroll;
  lastScroll = scroll;
  const depth = depthAt(scroll);
  updateGauge(depth);

  const top = waterAt(Math.max(0, depth - 120));
  const bot = waterAt(depth + 160);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgb(top));
  g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const light = Math.exp(-depth / 120);
  const deep = clamp((depth - 600) / 2400, 0, 1);

  // god rays
  if (light > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const x = W * (0.1 + i * 0.17) + Math.sin(time * 0.006 + i * 1.7) * 40;
      const w = 50 + (i % 3) * 30;
      const rg = ctx.createLinearGradient(0, 0, 0, H);
      rg.addColorStop(0, `rgba(210, 245, 255, ${0.09 * light})`);
      rg.addColorStop(1, 'rgba(210, 245, 255, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, 0);
      ctx.lineTo(x + w / 2, 0);
      ctx.lineTo(x + w * 2.2 - 160, H);
      ctx.lineTo(x - w * 0.2 - 160, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // surface bubbles
  const bubbleRate = clamp(1 - depth / 450, 0, 1);
  if (!reduced && Math.random() < 0.25 * bubbleRate) {
    bubbles.push({ x: Math.random() * W, y: H + 10, r: 1.5 + Math.random() * 4, vy: 0.6 + Math.random() * 1.2, ph: Math.random() * 6 });
  }
  ctx.lineWidth = 1;
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y -= b.vy + dScroll * 0.4;
    b.x += Math.sin(time * 0.05 + b.ph) * 0.4;
    if (b.y < -20 || b.y > H + 40) { bubbles.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(230, 250, 255, ${0.5 * bubbleRate + 0.1})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // marine snow + bioluminescent plankton
  for (const p of snow) {
    if (!reduced) {
      p.y += 0.12 * p.z - dScroll * p.z * 0.5;
      p.x += Math.sin(time * 0.01 + p.ph) * 0.12;
    }
    if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
    if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
    let glow = 0;
    if (deep > 0 && mouse.active) {
      const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
      glow = deep * clamp(1 - d / 170, 0, 1);
    }
    for (const r of rings) {
      const d = Math.hypot(p.x - r.x, p.y - r.y);
      const rad = r.t * 9;
      if (Math.abs(d - rad) < 26) glow = Math.max(glow, (1 - r.t / 90) * 0.9);
    }
    const tw = 0.6 + 0.4 * Math.sin(time * 0.03 + p.ph);
    const a = (0.12 + 0.35 * deep) * p.z * tw;
    ctx.fillStyle = `rgba(220, 238, 245, ${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.z, 0, Math.PI * 2);
    ctx.fill();
    if (glow > 0.02) {
      ctx.fillStyle = `rgba(126, 249, 224, ${glow * 0.8})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 1.4 + glow * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(126, 249, 224, ${glow * 0.12})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8 + glow * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // lantern around the cursor in the deep
  if (deep > 0 && mouse.active) {
    const lg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 240);
    lg.addColorStop(0, `rgba(120, 220, 230, ${0.07 * deep})`);
    lg.addColorStop(1, 'rgba(120, 220, 230, 0)');
    ctx.fillStyle = lg;
    ctx.fillRect(mouse.x - 240, mouse.y - 240, 480, 480);
  }

  // sonar rings
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += 1;
    if (r.t > 90) { rings.splice(i, 1); continue; }
    const k = 1 - r.t / 90;
    ctx.strokeStyle = `rgba(126, 249, 224, ${0.6 * k})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.t * 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(126, 249, 224, ${0.25 * k})`;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.t * 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // fish school
  if (school.length) {
    const zr = schoolZone.getBoundingClientRect();
    if (zr.bottom > -100 && zr.top < H + 100) {
      stepSchool(scroll);
      drawSchool(scroll);
    }
  }

  updateEyes();
  requestAnimationFrame(frame);
}

// ===== Eyes follow the cursor =====
const eyes = $$('.eye').map((el) => ({ el, white: el.querySelector('circle'), pupil: el.querySelector('.pupil') }));
function updateEyes() {
  if (!mouse.active) return;
  for (const e of eyes) {
    const r = e.white.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = mouse.x - cx, dy = mouse.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const rad = +e.white.getAttribute('r');
    const m = rad * 0.42 * Math.min(1, d / 120);
    e.pupil.setAttribute('transform', `translate(${(dx / d) * m} ${(dy / d) * m})`);
  }
}

// ===== Bobbing letters =====
const bobWord = $('#bobWord');
bobWord.innerHTML = [...bobWord.textContent].map((c, i) => `<span class="ch" style="--i:${i}">${c}</span>`).join('');

// ===== Notification bubbles at the surface =====
const noise = $('#noise');
const pings = [
  ['@', 'quick sync?'], ['@', '@channel'], ['47', 'unread'], ['!', 'can you hop on a call'],
  ['@', 'per my last email'], ['12', 'jira updates'], ['5', 'standup in 5 min'], ['?', 'thoughts?'],
  ['@', 'circling back'], ['!', 'who owns this?'], ['3', 'comments on Q3 OKRs'], ['@', 'is this blocked?'],
  ['!', 'urgent (not urgent)'], ['@', 'let\'s take this offline'], ['9', 'calendar invites'], ['?', 'got a sec?'],
];
let pingIdx = Math.floor(Math.random() * pings.length);
let livePings = 0;

function spawnPing() {
  if (document.hidden || livePings >= (W < 700 ? 5 : 9)) return;
  const surf = $('#surface').getBoundingClientRect();
  if (surf.bottom < 100) return;
  const [ic, text] = pings[pingIdx++ % pings.length];
  const el = document.createElement('div');
  el.className = 'ping';
  const h = noise.offsetHeight + 60;
  el.style.left = `${4 + Math.random() * 84}%`;
  el.style.setProperty('--h', `${h}px`);
  el.style.setProperty('--dur', `${9 + Math.random() * 7}s`);
  el.style.setProperty('--wob', `${1.6 + Math.random() * 1.4}s`);
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
  const nr = noise.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2 - nr.left, cy = r.top + r.height / 2 - nr.top;
  for (let i = 0; i < 8; i++) {
    const d = document.createElement('i');
    d.className = 'droplet';
    const a = (i / 8) * Math.PI * 2;
    d.style.left = `${cx}px`;
    d.style.top = `${cy}px`;
    d.style.setProperty('--dx', `${Math.cos(a) * (30 + Math.random() * 30)}px`);
    d.style.setProperty('--dy', `${Math.sin(a) * (20 + Math.random() * 20)}px`);
    noise.appendChild(d);
    setTimeout(() => d.remove(), 600);
  }
  if (byUser) {
    popped++;
    const s = document.createElement('span');
    s.className = 'pop-score';
    s.textContent = popped === 1 ? '−1 ping. feels good?' : `−${popped} pings`;
    s.style.left = `${cx}px`;
    s.style.top = `${cy - 20}px`;
    noise.appendChild(s);
    setTimeout(() => s.remove(), 950);
  }
  setTimeout(() => el.remove(), 340);
}
if (!reduced) {
  for (let i = 0; i < 3; i++) setTimeout(spawnPing, 300 + i * 700);
  setInterval(spawnPing, 1500);
}

// ===== Reveal on scroll =====
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('in');
    io.unobserve(e.target);
    if (e.target.classList.contains('stats')) countUp(e.target);
    if (e.target.id === 'sonarLog') typeLog(e.target);
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
      const v = Math.round(target * (1 - Math.pow(1 - t, 3)));
      el.textContent = v + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
function typeLog(list) {
  $$('li', list).forEach((li, i) => setTimeout(() => li.classList.add('on'), 250 + i * 380));
}

// ===== Crew: click to hop & talk =====
$$('.op').forEach((op) => {
  const say = $('.say', op);
  say.textContent = op.dataset.say;
  const critter = $('.critter', op);
  $('.op-stage', op).addEventListener('click', (e) => {
    critter.classList.remove('hop');
    void critter.getBoundingClientRect();
    critter.classList.add('hop');
    op.classList.add('talk');
    clearTimeout(op._t);
    op._t = setTimeout(() => op.classList.remove('talk'), 2200);
    rings.push({ x: e.clientX, y: e.clientY, t: 0 });
  });
});

// ===== Hire: transmit =====
const hireForm = $('#hireForm');
const txStatus = $('#txStatus');
hireForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(hireForm);
  const name = (fd.get('name') || '').toString().trim() || 'anon';
  const btn = $('button[type="submit"]', hireForm);
  const r = btn.getBoundingClientRect();
  const cap = document.createElement('div');
  cap.className = 'capsule';
  cap.textContent = `brief from ${name} ↑`;
  cap.style.left = `${r.left + r.width / 2}px`;
  cap.style.top = `${r.top}px`;
  document.body.appendChild(cap);
  setTimeout(() => cap.remove(), 2900);
  rings.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, t: 0 });
  txStatus.textContent = `transmission away · thanks, ${name} — reply within 5 days`;
  txStatus.classList.add('sent');
  hireForm.reset();
});

// ===== Lock-in mode =====
const lock = $('#lock');
const lockTimer = $('#lockTimer');
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
function closeLock() {
  lock.hidden = true;
  clearInterval(lockInt);
}
$('#lockBtn').addEventListener('click', openLock);
$('#unlock').addEventListener('click', closeLock);
lock.addEventListener('click', (e) => { if (e.target === lock) closeLock(); });
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  if (e.key === 'Escape' && !lock.hidden) closeLock();
  else if (e.key.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey) openLock();
});

// ===== Boot =====
$('#year').textContent = new Date().getFullYear();
addEventListener('resize', resize);
addEventListener('load', measure);
resize();
initSchool();
requestAnimationFrame(frame);
