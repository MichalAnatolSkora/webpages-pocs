// lockincrew v7 — level 1-1: a playable platformer in the v2 pixel style
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// crew sprites shared with v4–v6
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

// ===== Sprite rasteriser (pixel rows → offscreen canvas, optional mirror) =====
const EYE = '#f5efe4', PUPIL = '#1a1a1a';
function raster(rows, pal, { eyes = [], eyeBase, flip = false, look = 1 } = {}) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    g.fillStyle = ch === 'w' ? (eyeBase ? pal[eyeBase] : EYE) : pal[ch];
    g.fillRect(flip ? w - 1 - x : x, y, 1, 1);
  }));
  for (const [ex, ey] of eyes) {
    g.fillStyle = EYE;
    const x0 = flip ? w - 2 - ex : ex;
    g.fillRect(x0, ey, 2, 2);
    g.fillStyle = PUPIL;
    const lookRight = flip ? look < 0 : look > 0;
    g.fillRect(x0 + (lookRight ? 1 : 0), ey + 1, 1, 1);
  }
  return c;
}
const creatureCache = {};
const creature = (name, flip = false) => {
  const key = `${name}:${flip}`;
  if (!creatureCache[key]) {
    const s = CREATURES[name];
    creatureCache[key] = raster(s.rows, s.pal, { eyes: s.eyes || [], eyeBase: s.eyeBase, flip });
  }
  return creatureCache[key];
};

// Lockie: the v2 padlock, now with eyes and legs
const LOCK_BODY = [
  '.....oooooo.....', '.....o....o.....', '.....o....o.....', '.....o....o.....', '.....o....o.....',
  '...oooooooooo...', '..ohhhhhhhhhoo..', '..hoooooooooos..', '..hoooooooooos..', '..howwoooowwos..',
  '..howwoooowwos..', '..hoooookoooos..', '..hooookkkooos..', '..ooooooooooos..', '..osssssssssso..', '...oooooooooo...',
];
const LEGS = {
  idle: ['....kk....kk....', '...kkk....kkk...'],
  run1: ['.....kk..kk.....', '....kkk..kkk....'],
  run2: ['...kk......kk...', '..kkk......kkk..'],
  jump: ['....kk....kk....', '................'],
};
const LOCK_PAL = { o: '#d97757', h: '#e8a47e', s: '#b85a3e', k: '#1a1a1a' };
const lockie = {};
for (const [k, legs] of Object.entries(LEGS)) {
  lockie[k] = [1, -1].map((dir) => raster([...LOCK_BODY, ...legs], LOCK_PAL, { eyes: [[4, 9], [10, 9]], flip: dir < 0, look: dir }));
}
// meetings: angry calendar pages on legs
const MEET = ['..k.......k...', '.kkkkkkkkkkkk.', '.krrrrrrrrrrk.', '.krrrrrrrrrrk.', '.kppppppppppk.', '.kpkkppppkkpk.', '.kppwkppwkppk.', '.kppwkppwkppk.', '.kppppppppppk.', '.kpppkkkkpppk.', '.kppkppppkppk.', '.kkkkkkkkkkkk.'];
const MEET_PAL = { k: '#1a1a1a', r: '#d96868', p: '#e8e0d0', w: '#f5efe4' };
const meetFrames = [
  raster([...MEET, '..kk......kk..', '.kk........kk.'], MEET_PAL),
  raster([...MEET, '...kk....kk...', '...kk....kk...'], MEET_PAL),
];

// ===== Canvas & viewport =====
const TILE = 16, ROWS = 15;
const stage = $('#stage');
const canvas = $('#game');
const ctx = canvas.getContext('2d');
let scale = 3, viewW = 320, viewH = 240, offY = 0;
const touchUI = () => getComputedStyle($('#touch')).display !== 'none';
function resize() {
  const aw = stage.clientWidth, ah = stage.clientHeight;
  const pad = touchUI() ? 104 : 0;
  scale = clamp(Math.floor((ah - pad) / (ROWS * TILE)), 2, 4);
  if (aw / scale < 220) scale = 2;
  viewW = Math.ceil(aw / scale);
  viewH = Math.ceil(ah / scale);
  canvas.width = viewW;
  canvas.height = viewH;
  canvas.style.width = `${viewW * scale}px`;
  canvas.style.height = `${viewH * scale}px`;
  offY = Math.max(0, viewH - ROWS * TILE - Math.ceil(pad / scale));
  ctx.imageSmoothingEnabled = false;
}

// ===== Level =====
const LW = 262;
const T = { AIR: 0, GROUND: 1, BRICK: 2, Q: 3, USED: 4, STONE: 5 };
let tiles, signs, qblocks, coins, enemies, crew, followers, bumps, particles;
const tileAt = (x, y) => (x < 0 || x >= LW ? T.STONE : y < 0 || y >= ROWS ? T.AIR : tiles[y * LW + x]);
const solid = (t) => t !== T.AIR;
const setT = (x, y, t) => { if (x >= 0 && x < LW && y >= 0 && y < ROWS) tiles[y * LW + x] = t; };
const ground = (x0, x1, top = 12) => { for (let x = x0; x <= x1; x++) for (let y = top; y < ROWS; y++) setT(x, y, T.GROUND); };
const plat = (x0, x1, y, t = T.BRICK) => { for (let x = x0; x <= x1; x++) setT(x, y, t); };
const stairs = (x0, n, dir = 1) => { for (let i = 0; i < n; i++) { const x = dir > 0 ? x0 + i : x0 + n - 1 - i; for (let y = 11 - i; y <= 11; y++) setT(x, y, T.STONE); } };
const coinRow = (x0, x1, y) => { for (let x = x0; x <= x1; x++) coins.push({ x: x * TILE + 4, y: y * TILE + 4, taken: false }); };
const enemy = (x, name, y = 11) => enemies.push({ x: x * TILE + 1, y: y * TILE + 2, w: 13, h: 14, vx: -0.45, vy: 0, name, alive: true, dead: 0, x0: x * TILE + 1, y0: y * TILE + 2 });

const ZONES = [
  [0, 'noise city', 3], [26, 'manifesto', 27], [78, 'services', 79], [116, 'crew', 117], [176, 'receipts', 177], [216, 'hq', 217],
];
const FLAG_X = 238;

function buildLevel() {
  tiles = new Uint8Array(LW * ROWS);
  signs = []; qblocks = {}; coins = []; enemies = []; crew = []; followers = []; bumps = []; particles = [];
  // noise city + manifesto
  ground(0, 44);
  signs.push({ x: 6, y: 11, id: 'welcome' });
  enemy(19, 'quick call?');
  signs.push({ x: 28, y: 11, id: 'rule1' });
  plat(33, 37, 9); signs.push({ x: 35, y: 8, id: 'rule2' });
  coinRow(33, 37, 7);
  signs.push({ x: 41, y: 11, id: 'rule3' });
  // pit 45-47
  for (let i = 0; i < 5; i++) coins.push({ x: (44 + i) * TILE + 4, y: (8 - [0, 1, 1.5, 1, 0][i]) * TILE, taken: false });
  ground(48, 108);
  signs.push({ x: 53, y: 11, id: 'rule4' });
  plat(58, 63, 8); signs.push({ x: 60, y: 7, id: 'rule5' });
  coinRow(58, 63, 6);
  enemy(66, 'weekly sync');
  signs.push({ x: 72, y: 11, id: 'rule6' });
  // services: question blocks
  [[82, 'svc1'], [88, 'svc2'], [94, 'svc3'], [100, 'svc4']].forEach(([x, id]) => { setT(x, 8, T.Q); qblocks[`${x},8`] = id; });
  plat(85, 85, 8); plat(91, 91, 8); plat(97, 97, 8);
  enemy(91, 'retro²');
  enemy(104, 'alignment');
  // pit 109-111
  coinRow(109, 111, 8);
  ground(112, 174);
  // crew
  crew.push({ id: 'kira', sprite: 'octo', x: 120 * TILE, y: 12 * TILE });
  plat(125, 130, 9); crew.push({ id: 'mateo', sprite: 'angler', x: 127 * TILE, y: 9 * TILE });
  crew.push({ id: 'ada', sprite: 'robot', x: 135 * TILE, y: 12 * TILE });
  enemy(140, 'all-hands');
  plat(144, 149, 8); crew.push({ id: 'juno', sprite: 'tardi', x: 145 * TILE, y: 8 * TILE });
  crew.push({ id: 'rin', sprite: 'cat', x: 156 * TILE, y: 12 * TILE });
  plat(162, 167, 9); signs.push({ x: 165, y: 8, id: 'slot', egg: true });
  enemy(170, '1:1 (30m)');
  // receipts: a field of ships
  ground(175, LW - 1);
  signs.push({ x: 179, y: 11, id: 'receipts' });
  for (let r = 0; r < 3; r++) coinRow(184 + r, 199 - r, 6 + r);
  plat(184, 199, 9);
  coinRow(202, 208, 10);
  enemy(194, 'sync about sync');
  enemy(206, 'quick call?');
  // hq
  signs.push({ x: 218, y: 11, id: 'hire' });
  stairs(224, 8);
  for (let x = 232; x <= 235; x++) for (let y = 4; y <= 11; y++) setT(x, y, T.STONE);
  // castle
  for (let x = 244; x <= 252; x++) for (let y = 6; y <= 11; y++) setT(x, y, T.STONE);
  for (let x = 244; x <= 252; x += 2) setT(x, 5, T.STONE);
}

// ===== Player & state =====
let P, stats, checkpoint, paused, cleared, started, gameTime, camX, frame, history, near;
function resetGame() {
  buildLevel();
  P = { x: 3 * TILE, y: 11 * TILE - 2, w: 10, h: 17, vx: 0, vy: 0, onGround: false, face: 1, coyote: 0, buffer: 0, anim: 0, inv: 0 };
  stats = { ships: 0, stomps: 0, crew: 0, lost: 0 };
  checkpoint = 3; paused = false; cleared = false; gameTime = 0; camX = 0; frame = 0; history = []; near = null;
  updateHud();
}

// ===== Input =====
const keys = { left: false, right: false, jump: false };
let jumpHeld = false;
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump' };
const typing = (e) => e.target.closest('input, textarea, select');
addEventListener('keydown', (e) => {
  if (typing(e)) return;
  if (document.body.classList.contains('text-on')) { if (e.code === 'KeyT' || e.code === 'Escape') toggleText(false); return; }
  if (e.code === 'KeyL') { togglePause(); return; }
  if (e.code === 'KeyT') { toggleText(true); return; }
  if (e.code === 'Escape' && paused) { togglePause(false); return; }
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  if (k === 'jump' && !keys.jump) P.buffer = 7;
  keys[k] = true;
  begin();
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
$$('#touch [data-key]').forEach((b) => {
  const k = b.dataset.key;
  const on = (e) => { e.preventDefault(); if (k === 'jump' && !keys.jump) P.buffer = 7; keys[k] = true; b.classList.add('on'); begin(); };
  const off = (e) => { e.preventDefault(); keys[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('pointerleave', off);
});
addEventListener('blur', () => { keys.left = keys.right = keys.jump = false; });

const startHint = $('#startHint');
function begin() {
  if (started) return;
  started = true;
  startHint.classList.add('gone');
}

// ===== Physics =====
const GRAV = 0.38, JUMP = -7.2, RUN = 2.4, ACC = 0.32;
function overlapsSolid(x, y, w, h) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 1) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tileAt(tx, ty))) return { tx, ty };
  return null;
}
function moveBody(b, onHead) {
  b.x += b.vx;
  let hit = overlapsSolid(b.x, b.y, b.w, b.h);
  if (hit) {
    b.x = b.vx > 0 ? hit.tx * TILE - b.w : (hit.tx + 1) * TILE;
    b.hitWall = true;
    b.vx = b.isPlayer ? 0 : b.vx;
  } else b.hitWall = false;
  b.y += b.vy;
  b.onGround = false;
  hit = overlapsSolid(b.x, b.y, b.w, b.h);
  if (hit) {
    if (b.vy > 0) { b.y = hit.ty * TILE - b.h; b.onGround = true; }
    else if (b.vy < 0) {
      b.y = (hit.ty + 1) * TILE;
      if (onHead) {
        // head-butt every tile under the head
        const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 1) / TILE);
        for (let tx = x0; tx <= x1; tx++) if (solid(tileAt(tx, hit.ty))) onHead(tx, hit.ty);
      }
    }
    b.vy = 0;
  }
}
function stepPlayer() {
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir) { P.vx = clamp(P.vx + dir * ACC, -RUN, RUN); P.face = dir; }
  else { P.vx *= P.onGround ? 0.72 : 0.92; if (Math.abs(P.vx) < 0.05) P.vx = 0; }
  P.coyote = P.onGround ? 6 : Math.max(0, P.coyote - 1);
  P.buffer = Math.max(0, P.buffer - 1);
  if (P.buffer > 0 && P.coyote > 0) { P.vy = JUMP; P.coyote = 0; P.buffer = 0; jumpHeld = true; }
  if (!keys.jump && jumpHeld && P.vy < -2.6) { P.vy = -2.6; jumpHeld = false; }
  if (!keys.jump) jumpHeld = false;
  P.vy = Math.min(P.vy + GRAV, 8);
  P.isPlayer = true;
  moveBody(P, hitBlock);
  if (P.inv > 0) P.inv--;
  P.anim += Math.abs(P.vx) * 0.12;
  if (P.y > ROWS * TILE + 40) hurt('fell into a slack thread');
  history.push([P.x, P.y, P.face]);
  if (history.length > 400) history.shift();
}

function hitBlock(tx, ty) {
  bumps.push({ tx, ty, t: 8 });
  const key = `${tx},${ty}`;
  if (tileAt(tx, ty) === T.Q) {
    setT(tx, ty, T.USED);
    addShip(tx * TILE + 8, ty * TILE - 6);
    pop(tx * TILE + 8, ty * TILE, '#e0c068', 8);
    showPanel(qblocks[key]);
  }
}

function hurt(why) {
  stats.lost += 30;
  toast(`${why} · −30 min`, 'bad');
  const cp = ZONES.filter((z) => z[2] <= checkpoint).pop();
  P.x = cp[2] * TILE; P.y = 6 * TILE; P.vx = 0; P.vy = 0; P.inv = 90;
  history = [];
  camX = clamp(P.x - viewW * 0.4, 0, LW * TILE - viewW);
  updateHud();
}

// ===== Objects =====
function addShip(x, y) {
  stats.ships++;
  particles.push({ x: x - 4, y, vx: 0, vy: -2.4, life: 26, coin: true });
  updateHud('hudShips');
}
function pop(x, y, color, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    particles.push({ x, y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6 - 1, life: 18, color });
  }
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function stepObjects() {
  // enemies
  for (const e of enemies) {
    if (!e.alive) { e.dead++; continue; }
    if (Math.abs(e.x - P.x) > viewW * 1.2) continue;
    e.vy = Math.min(e.vy + GRAV, 8);
    // turn before walking off a ledge
    const ahead = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
    if (e.onGround && !solid(tileAt(Math.floor(ahead / TILE), Math.floor((e.y + e.h + 2) / TILE)))) e.vx *= -1;
    e.isPlayer = false;
    moveBody(e);
    if (e.hitWall) e.vx *= -1;
    if (e.y > ROWS * TILE + 40) e.alive = false;
    if (P.inv === 0 && overlap(P, e)) {
      if (P.vy > 0.5 && P.y + P.h - e.y < 10) {
        e.alive = false; e.dead = 0;
        P.vy = keys.jump ? -7.6 : -5;
        stats.stomps++;
        pop(e.x + 7, e.y + 6, '#d96868', 8);
        toast(`declined: ${e.name}`, 'good');
        updateHud('hudStomps');
      } else hurt(`pulled into "${e.name}"`);
    }
  }
  // coins
  for (const c of coins) {
    if (c.taken) continue;
    if (overlap(P, { x: c.x, y: c.y, w: 8, h: 8 })) { c.taken = true; stats.ships++; pop(c.x + 4, c.y + 4, '#e0c068', 4); updateHud('hudShips'); }
  }
  // crew pickups
  for (const m of crew) {
    if (m.joined) continue;
    const img = creature(m.sprite);
    if (overlap(P, { x: m.x, y: m.y - img.height, w: img.width, h: img.height })) {
      m.joined = true;
      followers.push(m);
      stats.crew++;
      pop(m.x + 8, m.y - 8, '#7fb069', 10);
      showPanel(m.id);
      toast(`${m.id} joined the party`, 'good');
      updateHud('hudCrew');
    }
  }
  // signs
  let best = null;
  for (const s of signs) {
    const d = Math.abs(P.x + P.w / 2 - (s.x * TILE + 8));
    if (d < 30 && Math.abs(P.y - s.y * TILE) < 64 && (!best || d < best.d)) best = { s, d };
  }
  if (best && near !== best.s) { near = best.s; showPanel(best.s.id); }
  if (!best && near) { near = null; }
  if (panelId && !best && Math.abs(P.x - panelX) > 90) hidePanel();
  // checkpoints & zone
  const tx = Math.floor(P.x / TILE);
  for (const z of ZONES) if (tx >= z[0] && z[2] > checkpoint) checkpoint = z[2];
  const zone = [...ZONES].reverse().find((z) => tx >= z[0])[1];
  if (hudZone.textContent !== zone) hudZone.textContent = zone;
  // flag
  if (!cleared && P.x + P.w >= FLAG_X * TILE + 6) levelClear();
  // particles & bumps
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = bumps.length - 1; i >= 0; i--) if (--bumps[i].t <= 0) bumps.splice(i, 1);
}

// ===== Rendering =====
const SKY = ['#1c1a20', '#241d24', '#2a2028', '#3d2a2a', '#5e352b', '#874633', '#b85a3e', '#d97757'];
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function drawSky() {
  const bandH = Math.ceil(viewH / SKY.length);
  SKY.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bandH, viewW, bandH + 1); });
  // pixel sun, barely moving
  const sx = Math.round(viewW * 0.72 - camX * 0.02), sy = offY + 150;
  ctx.fillStyle = '#f3d9a4';
  for (let r = 0; r < 28; r++) {
    const half = Math.round(Math.sqrt(28 * 28 - (r - 14) * (r - 14) * 4) / 2);
    ctx.fillRect(sx - half, sy - 14 + r, half * 2, 1);
  }
  // far hills
  ctx.fillStyle = '#3d2a2a';
  for (let x = 0; x < viewW; x += 2) {
    const wx = (x + camX * 0.2) * 0.02;
    const h = 30 + Math.sin(wx) * 14 + Math.sin(wx * 2.7) * 6;
    ctx.fillRect(x, offY + 192 - h, 2, h + 60);
  }
  // mid layer: noisy city at the start, quieter hills later
  const par = camX * 0.45;
  for (let i = 0; i < 70; i++) {
    const bx = i * 26 - par;
    if (bx < -30 || bx > viewW + 30) continue;
    const city = i < 26;
    if (city) {
      const bh = 40 + Math.floor(hash(i, 1) * 60), bw = 18 + Math.floor(hash(i, 2) * 10);
      ctx.fillStyle = i % 2 ? '#1c1a18' : '#24211e';
      ctx.fillRect(Math.round(bx), offY + 192 - bh, bw, bh);
      for (let wy = 6; wy < bh - 4; wy += 6) for (let wx = 3; wx < bw - 3; wx += 5) {
        const on = hash(i * 31 + wx, wy) > 0.6 && Math.sin(frame * 0.02 + hash(wx, i * 7 + wy) * 40) > -0.6;
        if (on) { ctx.fillStyle = hash(wx, wy + i) > 0.85 ? '#7fb069' : '#e0c068'; ctx.fillRect(Math.round(bx) + wx, offY + 192 - bh + wy, 2, 2); }
      }
    } else {
      const th = 24 + Math.floor(hash(i, 3) * 20);
      ctx.fillStyle = '#2c2823';
      ctx.fillRect(Math.round(bx), offY + 192 - th, 26, th);
      ctx.fillRect(Math.round(bx) + 6, offY + 192 - th - 6, 14, 6);
    }
  }
}

function drawTile(t, x, y, tx, ty) {
  if (t === T.GROUND) {
    const top = !solid(tileAt(tx, ty - 1));
    ctx.fillStyle = '#2c2823'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = '#3a342c';
    if (hash(tx, ty) > 0.5) ctx.fillRect(x + 3, y + 9, 2, 2);
    if (hash(ty, tx) > 0.6) ctx.fillRect(x + 10, y + 4, 2, 2);
    if (top) { ctx.fillStyle = '#d97757'; ctx.fillRect(x, y, 16, 4); ctx.fillStyle = '#e8a47e'; ctx.fillRect(x, y, 16, 1); ctx.fillStyle = '#b85a3e'; ctx.fillRect(x + (tx % 3) * 4, y + 4, 3, 2); }
  } else if (t === T.BRICK) {
    ctx.fillStyle = '#b85a3e'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = '#8f4026';
    ctx.fillRect(x, y + 7, 16, 1); ctx.fillRect(x, y + 15, 16, 1);
    ctx.fillRect(x + 7, y, 1, 7); ctx.fillRect(x + 3, y + 8, 1, 7); ctx.fillRect(x + 11, y + 8, 1, 7);
    ctx.fillStyle = '#d97757'; ctx.fillRect(x, y, 16, 1);
  } else if (t === T.Q || t === T.USED) {
    const used = t === T.USED;
    ctx.fillStyle = used ? '#4a4238' : '#8a6a20'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = used ? '#6b6557' : (frame % 50 < 6 ? '#f3d9a4' : '#e0c068'); ctx.fillRect(x + 1, y + 1, 14, 14);
    ctx.fillStyle = used ? '#4a4238' : '#8a6a20';
    [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([a, b]) => ctx.fillRect(x + a, y + b, 1, 1));
    if (!used) { ctx.fillStyle = '#5c3f10'; [[6, 4, 4, 1], [5, 5, 1, 2], [10, 5, 1, 2], [9, 7, 1, 1], [8, 8, 1, 2], [8, 11, 1, 1]].forEach(([a, b, c, d]) => ctx.fillRect(x + a, y + b, c, d)); }
  } else if (t === T.STONE) {
    ctx.fillStyle = '#7d7566'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = '#a89f8c'; ctx.fillRect(x, y, 15, 15);
    ctx.fillStyle = '#c9c0ad'; ctx.fillRect(x, y, 15, 1); ctx.fillRect(x, y, 1, 15);
  }
}

function drawLevel() {
  const x0 = Math.floor(camX / TILE), x1 = Math.ceil((camX + viewW) / TILE);
  for (let ty = 0; ty < ROWS; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tileAt(tx, ty);
    if (t === T.AIR || tx >= LW) continue;
    const b = bumps.find((q) => q.tx === tx && q.ty === ty);
    drawTile(t, tx * TILE - Math.round(camX), ty * TILE + offY - (b ? Math.round(Math.sin((b.t / 8) * Math.PI) * 5) : 0), tx, ty);
  }
  // ground continues below the level when the screen is taller
  const below = viewH - (offY + ROWS * TILE);
  if (below > 0) { ctx.fillStyle = '#2c2823'; ctx.fillRect(0, offY + ROWS * TILE, viewW, below); }
}

function text8(str, x, y, color = '#e8e0d0') {
  ctx.font = '8px Silkscreen';
  const w = Math.ceil(ctx.measureText(str).width);
  const tx = Math.round(x - w / 2);
  ctx.fillStyle = 'rgba(26, 26, 26, .85)';
  ctx.fillRect(tx - 2, y - 7, w + 4, 9);
  ctx.fillStyle = color;
  ctx.fillText(str, tx, y);
}

function drawObjects() {
  const cx = Math.round(camX);
  // signs
  for (const s of signs) {
    const x = s.x * TILE - cx, y = s.y * TILE + offY;
    if (x < -20 || x > viewW + 20) continue;
    if (s.egg) {
      const img = creature('egg');
      ctx.drawImage(img, x, y + 16 - img.height + (frame % 60 < 30 ? 0 : -1));
    } else {
      ctx.fillStyle = '#7d7566'; ctx.fillRect(x + 7, y + 6, 2, 10);
      ctx.fillStyle = '#5c544a'; ctx.fillRect(x, y - 3, 16, 11);
      ctx.fillStyle = '#c9c0ad'; ctx.fillRect(x + 1, y - 2, 14, 9);
      ctx.fillStyle = '#d97757'; ctx.fillRect(x + 3, y, 10, 1); ctx.fillRect(x + 3, y + 2, 7, 1); ctx.fillRect(x + 3, y + 4, 9, 1);
    }
    if (near === s || !s.read) {
      const by = y - 12 + (frame % 40 < 20 ? 0 : -2);
      ctx.fillStyle = near === s ? '#e0c068' : '#d97757';
      ctx.fillRect(x + 7, by, 2, 5); ctx.fillRect(x + 7, by + 6, 2, 2);
    }
  }
  // coins (spinning)
  for (const c of coins) {
    if (c.taken) continue;
    const x = c.x - cx, y = c.y + offY;
    if (x < -10 || x > viewW + 10) continue;
    const f = Math.floor((frame + c.x) / 8) % 4, w = [8, 6, 2, 6][f];
    ctx.fillStyle = '#b8963e'; ctx.fillRect(x + (8 - w) / 2, y, w, 8);
    ctx.fillStyle = '#e0c068'; ctx.fillRect(x + (8 - w) / 2 + (w > 2 ? 1 : 0), y + 1, Math.max(1, w - 2), 6);
    if (w > 4) { ctx.fillStyle = '#fff4dc'; ctx.fillRect(x + (8 - w) / 2 + 2, y + 2, 1, 2); }
  }
  // crew waiting to be recruited
  for (const m of crew) {
    if (m.joined) continue;
    const img = creature(m.sprite, P.x < m.x);
    const x = m.x - cx, y = m.y + offY - img.height + (Math.floor(frame / 24) % 2 ? -1 : 0);
    if (x < -30 || x > viewW + 30) continue;
    ctx.drawImage(img, x, y);
    text8(m.id, x + img.width / 2, y - 4, '#7fb069');
  }
  // flag & castle sign
  const fx = FLAG_X * TILE - cx + 7;
  if (fx > -40 && fx < viewW + 60) {
    ctx.fillStyle = '#a89f8c'; ctx.fillRect(fx, offY + 2 * TILE, 2, 10 * TILE);
    ctx.fillStyle = '#e0c068'; ctx.fillRect(fx - 1, offY + 2 * TILE - 3, 4, 4);
    const fy = offY + 2 * TILE + (cleared ? Math.min(120, clearT * 3) : 0);
    ctx.fillStyle = '#d97757'; ctx.fillRect(fx - 16, fy + 2, 16, 11);
    ctx.fillStyle = '#e8e0d0'; ctx.fillRect(fx - 11, fy + 4, 6, 1); ctx.fillRect(fx - 12, fy + 5, 1, 2); ctx.fillRect(fx - 5, fy + 5, 1, 2); ctx.fillRect(fx - 13, fy + 7, 10, 5);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(fx - 9, fy + 8, 2, 2);
    text8('lockincrew hq', 248 * TILE - cx + 8, offY + 5 * TILE - 6, '#e0c068');
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(247 * TILE - cx + 4, offY + 9 * TILE, 24, 3 * TILE);
  }
  // enemies
  for (const e of enemies) {
    const x = Math.round(e.x - cx), y = Math.round(e.y + offY);
    if (x < -40 || x > viewW + 40) continue;
    if (!e.alive) {
      if (e.dead < 20) { ctx.fillStyle = '#d96868'; ctx.fillRect(x, y + 10, 14, 4); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x + 1, y + 11, 12, 2); }
      continue;
    }
    const img = meetFrames[Math.floor(frame / 10) % 2];
    ctx.drawImage(img, x - 0, y - 0);
    text8(e.name, x + 7, y - 4, '#d96868');
  }
  // followers trail behind the player
  followers.forEach((m, i) => {
    const h = history[history.length - 1 - (i + 1) * 16];
    if (!h) return;
    const img = creature(m.sprite, h[2] < 0);
    const x = Math.round(h[0] - cx + P.w / 2 - img.width / 2), y = Math.round(h[1] + offY + P.h - img.height + (Math.floor((frame + i * 5) / 8) % 2 ? -1 : 0));
    ctx.drawImage(img, x, y);
  });
  // player
  if (!(P.inv > 0 && Math.floor(frame / 4) % 2)) {
    const frames = lockie[!P.onGround ? 'jump' : Math.abs(P.vx) > 0.3 ? (Math.floor(P.anim) % 2 ? 'run1' : 'run2') : 'idle'];
    const img = frames[P.face > 0 ? 0 : 1];
    ctx.drawImage(img, Math.round(P.x - cx - 3), Math.round(P.y + offY - 1));
  }
  // particles
  for (const p of particles) {
    const x = Math.round(p.x - cx), y = Math.round(p.y + offY);
    if (p.coin) { ctx.fillStyle = '#e0c068'; ctx.fillRect(x, y, 8, 8); ctx.fillStyle = '#fff4dc'; ctx.fillRect(x + 2, y + 2, 1, 2); }
    else { ctx.fillStyle = p.color; ctx.fillRect(x, y, 2, 2); }
  }
}

// ===== HUD, panel, toast =====
const hudZone = $('#hudZone');
const hudEls = { hudShips: $('#hudShips'), hudStomps: $('#hudStomps'), hudCrew: $('#hudCrew'), hudTime: $('#hudTime') };
function updateHud(bumpId) {
  hudEls.hudShips.textContent = String(stats.ships).padStart(3, '0');
  hudEls.hudStomps.textContent = stats.stomps;
  hudEls.hudCrew.textContent = `${stats.crew}/5`;
  if (bumpId) { const el = hudEls[bumpId]; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`;

const panel = $('#panel'), panelTitle = $('#panelTitle'), panelBody = $('#panelBody');
let panelId = null, panelX = 0;
function showPanel(id) {
  const src = document.querySelector(`[data-sign="${id}"]`);
  if (!src) return;
  panelId = id; panelX = P.x;
  panelTitle.textContent = src.dataset.title;
  panelBody.innerHTML = src.innerHTML;
  panel.hidden = false;
  panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
  const s = signs.find((q) => q.id === id);
  if (s) s.read = true;
}
function hidePanel() { panel.hidden = true; panelId = null; }

const toastEl = $('#toast');
let toastT = 0;
function toast(msg, kind = '') {
  toastEl.textContent = msg;
  toastEl.className = `toast ${kind}`;
  toastEl.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { toastEl.hidden = true; }, 1400);
}

// ===== Pause (lock in), text mode, level clear =====
const lockEl = $('#lock'), lockTimer = $('#lockTimer');
let lockStart = 0, lockInt = 0;
function togglePause(force) {
  const on = force === undefined ? !paused : force;
  if (cleared) return;
  paused = on;
  lockEl.hidden = !on;
  keys.left = keys.right = keys.jump = false;
  clearInterval(lockInt);
  if (on) {
    lockStart = Date.now();
    lockTimer.textContent = '00:00';
    lockInt = setInterval(() => { lockTimer.textContent = fmt((Date.now() - lockStart) / 1000); }, 250);
    $('#unlock').focus();
  }
}
$('#lockBtn').addEventListener('click', () => togglePause(true));
$('#unlock').addEventListener('click', () => togglePause(false));

function toggleText(on) {
  document.body.classList.toggle('text-on', on);
  if (on) { paused = true; $('#textmode').scrollTop = 0; $('#backToGame').focus(); }
  else if (lockEl.hidden && !cleared) paused = false;
  keys.left = keys.right = keys.jump = false;
}
$('#textBtn').addEventListener('click', () => toggleText(true));
$('#hintText').addEventListener('click', () => toggleText(true));
$('#backToGame').addEventListener('click', () => toggleText(false));

let clearT = 0;
function levelClear() {
  cleared = true;
  clearT = 0;
  keys.left = keys.right = keys.jump = false;
  P.vx = 0;
  toast('level clear!', 'good');
  setTimeout(() => {
    $('#cShips').textContent = stats.ships;
    $('#cStomps').textContent = stats.stomps;
    $('#cCrew').textContent = `${stats.crew}/5`;
    $('#cLost').textContent = `${stats.lost} min`;
    $('#clear').hidden = false;
    $('#cName').focus();
  }, 1300);
}
$('#replayBtn').addEventListener('click', () => {
  $('#clear').hidden = true;
  resetGame();
  started = true;
});

$$('[data-hire]').forEach((form) => form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = (new FormData(form).get('name') || '').toString().trim() || 'anon';
  const status = $('[data-status]', form);
  status.innerHTML = `<span class="ok">✓</span> brief sent · thanks, ${name.replace(/[<>&"]/g, '')} — reply within 5 days`;
  form.reset();
}));

// ===== Loop =====
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60;
    if (!paused) {
      frame++;
      if (cleared) { clearT++; P.vy = Math.min(P.vy + GRAV, 8); moveBody(P); }
      else if (started) { stepPlayer(); stepObjects(); gameTime += 1 / 60; }
      else { P.vy = Math.min(P.vy + GRAV, 8); moveBody(P); }
    }
  }
  const target = clamp(P.x + P.w / 2 - viewW * 0.4, 0, LW * TILE - viewW);
  camX += (target - camX) * 0.12;
  hudEls.hudTime.textContent = fmt(gameTime);
  drawSky();
  drawLevel();
  drawObjects();
  requestAnimationFrame(loop);
}

// ===== Boot =====
addEventListener('resize', resize);
resize();
resetGame();
document.fonts?.load('8px Silkscreen').catch(() => {});
requestAnimationFrame(loop);
