// lockincrew v8 — the room: simulated presence around a real focus timer
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// crew sprites shared with v4–v7
const CREATURES = {
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
};

// ===== Pixel avatars (rendered once to data URLs) =====
const EYE = '#f5efe4', PUPIL = '#1a1a1a';
const avaCache = {};
function avatar(name) {
  if (avaCache[name]) return avaCache[name];
  const s = CREATURES[name];
  const h = s.rows.length, w = Math.max(...s.rows.map((r) => r.length));
  const size = Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const ox = Math.floor((size - w) / 2), oy = Math.floor((size - h) / 2);
  s.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    g.fillStyle = ch === 'w' ? s.pal[s.eyeBase] : s.pal[ch];
    g.fillRect(ox + x, oy + y, 1, 1);
  }));
  for (const [ex, ey] of s.eyes || []) {
    g.fillStyle = EYE; g.fillRect(ox + ex, oy + ey, 2, 2);
    g.fillStyle = PUPIL; g.fillRect(ox + ex + 1, oy + ey + 1, 1, 1);
  }
  return (avaCache[name] = c.toDataURL());
}
$$('img[data-ava]').forEach((img) => { img.src = avatar(img.dataset.ava); });

// ===== Helpers =====
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const now = () => performance.now();
const hhmm = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const docRect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };

// ===== Cast (simulated visitors) =====
const POOL = [
  ['mila', 'berlin'], ['tom', 'lisbon'], ['kasia', 'kraków'], ['jules', 'paris'], ['ravi', 'london'],
  ['aiko', 'tokyo'], ['sam', 'new york'], ['lena', 'vienna'], ['omar', 'dubai'], ['nina', 'oslo'],
  ['diego', 'madrid'], ['yuki', 'osaka'], ['ben', 'toronto'], ['ola', 'warsaw'], ['marco', 'milan'],
];
const COLORS = ['#d97757', '#7fb069', '#e0c068', '#d48fb0', '#8fc7c9', '#e8a47e', '#a98bff', '#c9c0ad'];
const AVAS = ['octo', 'angler', 'robot', 'tardi', 'cat', 'egg'];
const SAY = {
  welcome: ['o/', 'nice logo', 'a room?', 'hi all'],
  '/manifesto': ['+1', 'so true', 'printing this', 'the retro one lol', 'sending to my team'],
  '/services': ['need this', 'bookmarked', 'rescue op 👀', 'forwarding to my cto', '6 weeks?!'],
  '/crew': ['the tardigrade lol', 'hi kira', 'o/', 'cute crew', 'love the cat'],
  '/receipts': ['184?!', 'nice', '0 meetings 🙏', 'impressive'],
  '/hire': ['ok writing a brief', 'deadline is friday…', 'brb'],
};

const layer = $('#cursors');
const bots = [];
let usedNames = new Set();
let colorIdx = 0;

function cursorEl(bot) {
  const el = document.createElement('div');
  el.className = 'cur';
  el.style.setProperty('--who', bot.color);
  el.innerHTML = `<svg viewBox="0 0 8 11" shape-rendering="crispEdges"><path fill="#1a1a1a" d="M0 0h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1H5v1h1v1h1v1H5v-1H4V9H3v1H2v1H0z"/><path fill="${bot.color}" d="M1 2h1v1h1v1h1v1h1v1h1v1H4v1h1v1h1v1H5V9H4V8H3v1H2v1H1z"/></svg>
    <span class="cur-tag"><img src="${avatar(bot.ava)}" alt="">${bot.name}</span>`;
  layer.appendChild(el);
  return el;
}

function spawn(initial = false) {
  const free = POOL.filter(([n]) => !usedNames.has(n));
  if (!free.length) return;
  const [name, city] = pick(free);
  usedNames.add(name);
  const bot = {
    name, city,
    color: COLORS[colorIdx++ % COLORS.length],
    ava: pick(AVAS),
    x: rand(0, innerWidth), y: scrollY + (initial ? rand(0, innerHeight) : (Math.random() < 0.5 ? -30 : innerHeight + 30)),
    state: 'idle', until: 0, zone: 'welcome', lockMins: 0, path: null, lastWave: 0, target: null,
  };
  bot.el = cursorEl(bot);
  bots.push(bot);
  if (!initial) feed(`<b>${name}</b> joined from ${city}`, bot.color);
  renderPeople();
  return bot;
}
function leave(bot) {
  bot.el.classList.add('leaving');
  if (bot.target) bot.target.classList.remove('watched', 'typing');
  feed(`<b>${bot.name}</b> left the room`, bot.color);
  setTimeout(() => bot.el.remove(), 450);
  bots.splice(bots.indexOf(bot), 1);
  usedNames.delete(bot.name);
  renderPeople();
}

// ===== Behaviour =====
const zonesEls = $$('[data-zone]');
const zoneOf = (el) => el.closest('[data-zone]')?.dataset.zone || 'welcome';
function chooseTarget(bot) {
  // mostly stay in the current section, sometimes move on (rarely back)
  const zi = zonesEls.findIndex((z) => z.dataset.zone === bot.zone);
  let zone = zonesEls[Math.max(0, zi)];
  const r = Math.random();
  if (r < 0.28 && zi < zonesEls.length - 1) zone = zonesEls[zi + 1];
  else if (r < 0.36 && zi > 0) zone = zonesEls[zi - 1];
  const spots = $$('.spot, .btn, h1, .tag-line', zone);
  return pick(spots.length ? spots : $$('.spot'));
}

function travel(bot, el, then) {
  const r = docRect(el);
  const tx = r.x + rand(r.w * 0.15, r.w * 0.85), ty = r.y + rand(Math.min(18, r.h * 0.3), Math.max(20, r.h * 0.75));
  const dist = Math.hypot(tx - bot.x, ty - bot.y);
  const dur = Math.max(450, Math.min(2200, dist * 1.3)) * rand(0.85, 1.2);
  const mx = (bot.x + tx) / 2 + rand(-120, 120), my = (bot.y + ty) / 2 + rand(-80, 80);
  bot.path = { sx: bot.x, sy: bot.y, mx, my, tx, ty, t0: now(), dur };
  bot.state = 'moving';
  bot.then = then;
  bot.zone = zoneOf(el);
}

function act(bot) {
  if (bot.target) bot.target.classList.remove('watched', 'typing');
  const el = chooseTarget(bot);
  bot.target = el;
  travel(bot, el, () => {
    const roll = Math.random();
    const dwell = rand(1800, 5200);
    bot.state = 'dwell';
    bot.until = now() + dwell;
    if (el.classList.contains('btn')) {
      ring(bot);
      el.classList.add('pressed');
      setTimeout(() => el.classList.remove('pressed'), 160);
      if (el.dataset.lock && Math.random() < 0.3 && canLock()) { startBotLock(bot); return; }
    } else if (el.classList.contains('spot')) {
      el.style.setProperty('--who', bot.color);
      el.classList.add('watched');
    }
    if (bot.zone === '/hire' && el.matches('.hire-form') && roll < 0.55) { botTypes(bot, el); return; }
    if (roll < 0.3) select(bot, el);
    else if (roll < 0.5) say(bot, pick(SAY[bot.zone] || SAY.welcome));
    else if (roll < 0.54 && canLock()) startBotLock(bot);
  });
}

function ring(bot) {
  const r = document.createElement('i');
  r.className = 'click-ring';
  r.style.cssText = `--who:${bot.color};left:${bot.x}px;top:${bot.y}px`;
  layer.appendChild(r);
  setTimeout(() => r.remove(), 520);
}
function say(bot, text) {
  if (document.body.classList.contains('focus')) return;
  const b = document.createElement('span');
  b.className = 'bubble';
  b.textContent = text;
  bot.el.appendChild(b);
  setTimeout(() => b.remove(), 2300);
}
function select(bot, el) {
  const lines = $$('p, h3, .stat-num, .log-line', el);
  const t = pick(lines.length ? lines : [el]);
  const r = docRect(t);
  const s = document.createElement('i');
  s.className = 'sel';
  const w = Math.min(r.w, rand(80, 280));
  s.style.cssText = `--who:${bot.color};left:${r.x}px;top:${r.y}px;width:${w}px;height:${Math.min(r.h, 22)}px`;
  layer.appendChild(s);
  setTimeout(() => s.remove(), 1900);
}
function botTypes(bot, form) {
  form.style.setProperty('--who', bot.color);
  form.dataset.typing = `${bot.name} is typing a brief…`;
  form.classList.add('typing');
  bot.typing = true;
  bot.until = now() + rand(5000, 9000);
  renderPeople();
  bot.afterDwell = () => {
    form.classList.remove('typing');
    bot.typing = false;
    feed(`<b>${bot.name}</b> sent a brief ✓`, bot.color);
    say(bot, 'sent!');
  };
}
const canLock = () => bots.filter((b) => b.state === 'locked').length < Math.floor(bots.length * 0.45);
function startBotLock(bot) {
  const mins = pick([25, 25, 50, 90]);
  bot.state = 'locked';
  bot.lockMins = mins;
  bot.until = now() + rand(15000, 32000);
  bot.el.classList.add('locked');
  if (bot.target) bot.target.classList.remove('watched');
  feed(`<b>${bot.name}</b> locked in for ${mins} min`, bot.color);
  renderPeople();
}

// ===== Presence UI =====
const peopleEl = $('#people'), feedEl = $('#feed');
const counters = { bar: $('#barCount'), hero: $('#heroCount'), heroLocked: $('#heroLocked'), room: $('#roomCount'), roomLocked: $('#roomLocked') };
let youZone = 'welcome', youLocked = false;
function renderPeople() {
  const locked = bots.filter((b) => b.state === 'locked').length + (youLocked ? 1 : 0);
  const total = bots.length + 1;
  counters.bar.textContent = total;
  counters.hero.textContent = total;
  counters.room.textContent = total;
  counters.heroLocked.textContent = locked;
  counters.roomLocked.textContent = locked;
  const row = (ava, color, name, sub, st, cls = '', you = false) =>
    `<li class="person ${you ? 'you' : ''}" style="--who:${color}"><img src="${ava}" alt=""><span class="who"><b><span class="swatch"></span>${name}</b><span>${sub}</span></span><span class="st ${cls}">${st}</span></li>`;
  const you = row(lockSvg, '#7fb069', 'you', 'here now', youLocked ? `🔒 ${fmt(remaining())}` : youZone, youLocked ? 'locked' : '', true);
  peopleEl.innerHTML = you + bots.map((b) => row(avatar(b.ava), b.color, b.name, b.city,
    b.state === 'locked' ? `🔒 ${b.lockMins}m` : b.typing ? 'typing…' : b.zone, b.state === 'locked' ? 'locked' : '')).join('');
}
function feed(html, color = '#3a342c') {
  if (document.body.classList.contains('focus')) return;
  const li = document.createElement('li');
  li.style.setProperty('--who', color);
  li.innerHTML = `<time>${hhmm()}</time>${html}`;
  feedEl.prepend(li);
  while (feedEl.children.length > 8) feedEl.lastElementChild.remove();
}
const lockSvg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#d97757" d="M5 0h6v1H5zM5 1h1v4H5zM10 1h1v4h-1zM3 5h10v1H3zM2 6h12v9H2zM3 15h10v1H3z"/><path fill="#1a1a1a" d="M7 9h2v1H7zM6 10h4v1H6zM7 11h2v2H7z"/></svg>');

// room panel toggle (narrow screens)
const room = $('#room');
$('#roomToggle').addEventListener('click', () => {
  room.classList.toggle('open');
  $('#roomToggle').setAttribute('aria-expanded', String(room.classList.contains('open')));
});

// where are *you*? (scroll position → section)
const tabs = $$('.tabs .tab:not(.tab-cta)');
function trackYou() {
  const mid = scrollY + innerHeight * 0.35;
  let z = 'welcome';
  for (const el of zonesEls) if (docRect(el).y <= mid) z = el.dataset.zone;
  if (z !== youZone) { youZone = z; renderPeople(); }
  tabs.forEach((t) => t.classList.toggle('active', t.getAttribute('href') === `#${z.slice(1)}`));
}
addEventListener('scroll', trackYou, { passive: true });

// people notice you
const mouse = { x: -999, y: -999 };
addEventListener('pointermove', (e) => { mouse.x = e.clientX + scrollX; mouse.y = e.clientY + scrollY; }, { passive: true });

// ===== Simulation loop =====
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function tick() {
  const t = now();
  for (const bot of bots) {
    if (bot.state === 'moving' && bot.path) {
      const p = bot.path;
      const k = Math.min(1, (t - p.t0) / p.dur), e = ease(k);
      // quadratic bezier through a wobbly control point
      bot.x = (1 - e) * (1 - e) * p.sx + 2 * (1 - e) * e * p.mx + e * e * p.tx;
      bot.y = (1 - e) * (1 - e) * p.sy + 2 * (1 - e) * e * p.my + e * e * p.ty;
      if (k >= 1) { bot.path = null; const fn = bot.then; bot.then = null; fn && fn(); }
    } else if (bot.state === 'dwell') {
      if (Math.random() < 0.06) { bot.x += rand(-3, 3); bot.y += rand(-2, 2); }
      if (t > bot.until) {
        if (bot.afterDwell) { const fn = bot.afterDwell; bot.afterDwell = null; fn(); }
        bot.state = 'idle';
      }
    } else if (bot.state === 'locked') {
      if (t > bot.until) {
        bot.el.classList.remove('locked');
        feed(`<b>${bot.name}</b> finished a ${bot.lockMins} min session ✓`, bot.color);
        bot.state = 'idle';
        renderPeople();
      }
    } else if (bot.state === 'idle' && t > bot.until) {
      bot.until = t + rand(200, 1400);
      act(bot);
    }
    // wave at the visitor when cursors get close
    if (bot.state !== 'locked' && Math.hypot(mouse.x - bot.x, mouse.y - bot.y) < 70 && t - bot.lastWave > 25000) {
      bot.lastWave = t;
      say(bot, pick(['o/ hi', 'hey 👋', 'hi there', 'oh hello']));
      feed(`<b>${bot.name}</b> waved at you`, bot.color);
    }
    bot.el.style.transform = `translate(${Math.round(bot.x)}px, ${Math.round(bot.y)}px)`;
  }
  requestAnimationFrame(tick);
}

// joins, leaves & people-list refresh
function churn() {
  const n = bots.length;
  if (n > 5 && Math.random() < 0.45) leave(pick(bots.filter((b) => b.state !== 'locked')) || bots[0]);
  else if (n < 11) spawn();
  setTimeout(churn, rand(14000, 26000));
}
setInterval(() => {
  for (const b of bots) if (b.state === 'locked' && b.lockMins > 1 && Math.random() < 0.5) b.lockMins--;
  renderPeople();
}, 3000);
// focus hours counter drifts up with every locked-in person
const focusHours = $('#focusHours');
let hours = 1204;
setInterval(() => {
  hours += bots.filter((b) => b.state === 'locked').length + (youLocked ? 1 : 0);
  focusHours.textContent = hours.toLocaleString('en-US');
}, 4000);

// ===== Your focus session (a real timer) =====
const lock = $('#lock'), ringEl = $('#ring'), lockTimer = $('#lockTimer'), lockState = $('#lockState'), durations = $('.durations');
let sessionMin = 25, sessionStart = 0, sessionInt = 0, done = false;
const baseTitle = document.title;
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`;
const remaining = () => Math.max(0, sessionMin * 60 - (Date.now() - sessionStart) / 1000);
function renderWith() {
  const others = bots.filter((b) => b.state === 'locked');
  $('#withLine').textContent = others.length
    ? `locked in with ${others.length} other${others.length === 1 ? '' : 's'} in the room`
    : 'locked in with nobody yet — someone will join';
  $('#withAvas').innerHTML = others.map((b) => `<img src="${avatar(b.ava)}" alt="${b.name}" title="${b.name} · ${b.city}">`).join('');
}
function updateSession() {
  const left = remaining();
  lockTimer.textContent = fmt(left);
  ringEl.style.setProperty('--p', (1 - left / (sessionMin * 60)).toFixed(4));
  document.title = `${fmt(left)} · locked in — lockincrew`;
  renderWith();
  if (left <= 0 && !done) {
    done = true;
    lockState.textContent = 'session complete ✓';
    document.title = '✓ session complete — lockincrew';
    clearInterval(sessionInt);
    youLocked = false;
    document.body.classList.remove('focus');
    feed(`<b>you</b> finished a ${sessionMin} min session ✓`, '#7fb069');
    renderPeople();
  }
}
function startSession(min = sessionMin) {
  sessionMin = min;
  $$('button', durations).forEach((b) => b.classList.toggle('on', +b.dataset.min === min));
  durations.classList.add('running');
  sessionStart = Date.now();
  done = false;
  lockState.textContent = 'focus session';
  youLocked = true;
  document.body.classList.add('focus');
  lock.hidden = false;
  clearInterval(sessionInt);
  updateSession();
  sessionInt = setInterval(updateSession, 250);
  renderPeople();
  $('#endLock').focus();
}
function endSession() {
  lock.hidden = true;
  clearInterval(sessionInt);
  durations.classList.remove('running');
  document.title = baseTitle;
  if (youLocked && !done) {
    const mins = Math.round((Date.now() - sessionStart) / 60000);
    document.body.classList.remove('focus');
    feed(`<b>you</b> resurfaced after ${mins} min`, '#7fb069');
  }
  youLocked = false;
  document.body.classList.remove('focus');
  renderPeople();
}
$$('button', durations).forEach((b) => b.addEventListener('click', () => startSession(+b.dataset.min)));
$('#lockBtn').addEventListener('click', () => startSession(25));
$$('[data-lock]').forEach((b) => b.addEventListener('click', () => startSession(+b.dataset.lock)));
$('#endLock').addEventListener('click', endSession);
lock.addEventListener('click', (e) => { if (e.target === lock) endSession(); });
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'Escape' && !lock.hidden) endSession();
  else if (e.key.toLowerCase() === 'l' && lock.hidden && !e.metaKey && !e.ctrlKey && !e.altKey) startSession(25);
});

// ===== Hire form =====
$('#hireForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = (new FormData(e.target).get('name') || '').toString().trim() || 'anon';
  $('#txStatus').innerHTML = `<span class="ok">✓</span> brief sent · thanks, ${name.replace(/[<>&"]/g, '')} — reply within 5 days`;
  feed('<b>you</b> sent a brief ✓', '#7fb069');
  e.target.reset();
});

// ===== Start =====
const START = reduced ? 4 : 7;
for (let i = 0; i < START; i++) setTimeout(() => {
  const b = spawn(true);
  if (b) { b.until = now() + rand(0, 1500); feed(`<b>${b.name}</b> is here from ${b.city}`, b.color); }
}, i * 380);
setTimeout(churn, 15000);
trackYou();
renderPeople();
requestAnimationFrame(tick);
