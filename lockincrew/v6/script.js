// lockincrew v6 — lockinOS, a retro desktop with zero meetings installed
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ===== Pixel sprites =====
// '.' = transparent · 'w' = eye white (2×2, pupil tracked by JS) · cls letters get their own <g> for animation
const EYE = '#f5efe4', PUPIL = '#1a1a1a';
const SPRITES = {
  i_txt: {
    pal: { k: '#1a1a1a', o: '#d97757', p: '#e8e0d0' },
    rows: [
      '..kkkkkkkkk.....',
      '..kppppppppk....',
      '..kppppppppkk...',
      '..kpppppppppkk..',
      '..kpoooooooppk..',
      '..kppppppppppk..',
      '..kpoooooooook..',
      '..kppppppppppk..',
      '..kpoooooooopk..',
      '..kppppppppppk..',
      '..kpoooooooook..',
      '..kppppppppppk..',
      '..kpoooooopppk..',
      '..kppppppppppk..',
      '..kppppppppppk..',
      '..kkkkkkkkkkkk..',
    ],
  },
  i_app: {
    pal: { k: '#1a1a1a', m: '#a89f8c', o: '#d97757', p: '#e8e0d0', s: '#b85a3e', y: '#e0c068' },
    rows: [
      '................',
      '................',
      '.kkkkkkkkkkkkkk.',
      '.koooooooooyyok.',
      '.kooooooooooook.',
      '.kkkkkkkkkkkkkk.',
      '.kppppppppppppk.',
      '.kpssppssppsspk.',
      '.kpssppssppsspk.',
      '.kppppppppppppk.',
      '.kpmmppmmppmmpk.',
      '.kpmmppmmppmmpk.',
      '.kppppppppppppk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
    ],
  },
  i_folder: {
    pal: { h: '#e8a47e', k: '#1a1a1a', o: '#d97757', s: '#b85a3e' },
    rows: [
      '................',
      '................',
      '................',
      '.kkkkkk.........',
      '.khhhhk.........',
      '.kkkkkkkkkkkkkk.',
      '.khhhhhhhhhhhhk.',
      '.kooooooooooook.',
      '.kooookookooook.',
      '.kooooooooooook.',
      '.koooossssooook.',
      '.kooooooooooook.',
      '.kssssssssssssk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
    ],
  },
  i_chart: {
    pal: { d: '#3a342c', g: '#7fb069', h: '#e8a47e', k: '#1a1a1a', o: '#d97757' },
    rows: [
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kdddddddddggdk.',
      '.kdddddddddggdk.',
      '.kdddddddooggdk.',
      '.kdddddddooggdk.',
      '.kdddooddooggdk.',
      '.kdddooddooggdk.',
      '.kdddoohhooggdk.',
      '.kdoooohhooggdk.',
      '.kdoooohhooggdk.',
      '.kdoooohhooggdk.',
      '.kdoooohhooggdk.',
      '.kddddddddddddk.',
      '.kkkkkkkkkkkkkk.',
      '................',
    ],
  },
  i_mail: {
    pal: { k: '#1a1a1a', o: '#d97757', p: '#e8e0d0', s: '#b85a3e' },
    rows: [
      '................',
      '................',
      '................',
      '.kkkkkkkkkkkkkk.',
      '.ksppppppppppsk.',
      '.kpsppppppppspk.',
      '.kppsppppppsppk.',
      '.kpppsppppspppk.',
      '.kppppsppsssssk.',
      '.kpppppsspsoosk.',
      '.kppppppppsoosk.',
      '.kppppppppssssk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
      '................',
    ],
  },
  i_term: {
    pal: { d: '#3a342c', g: '#7fb069', k: '#1a1a1a', m: '#a89f8c', o: '#d97757' },
    rows: [
      '................',
      '................',
      '.dddddddddddddd.',
      '.dmmmmmmmmmmmmd.',
      '.dkkkkkkkkkkkkd.',
      '.dkkkkkkkkkkkkd.',
      '.dkokkkkkkkkkkd.',
      '.dkkokkkkkkkkkd.',
      '.dkokkggggkkkkd.',
      '.dkkkkkkkkkkkkd.',
      '.dkkkkkkkkkkkkd.',
      '.dkkkkkkkkkkkkd.',
      '.dkkkkkkkkkkkkd.',
      '.dddddddddddddd.',
      '................',
      '................',
    ],
  },
  i_trash: {
    pal: { d: '#3a342c', k: '#1a1a1a', m: '#a89f8c' },
    rows: [
      '................',
      '....mmmmmmmm....',
      '..kkkkkkkkkkkk..',
      '..kkkkkkkkkkkk..',
      '...kkkkkkkkkk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kkkkkkkkkk...',
      '................',
    ],
  },
  i_trashfull: {
    pal: { d: '#3a342c', k: '#1a1a1a', m: '#a89f8c', o: '#d97757', p: '#e8e0d0' },
    rows: [
      '.....pp..pp.....',
      '....mmooommm....',
      '..kkkkkkkkkkkk..',
      '..kkkkkkkkkkkk..',
      '...kkkkkkkkkk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kdmdmddddk...',
      '...kkkkkkkkkk...',
      '................',
    ],
  },
  i_lock: {
    pal: { h: '#e8a47e', k: '#1a1a1a', o: '#d97757', s: '#b85a3e' },
    rows: [
      '.....oooooo.....',
      '.....o....o.....',
      '.....o....o.....',
      '.....o....o.....',
      '.....o....o.....',
      '...oooooooooo...',
      '..ohhhhhhhhhoo..',
      '..hoooooooooos..',
      '..hoooooooooos..',
      '..hooookkoooos..',
      '..hoookkkkooos..',
      '..hooookkoooos..',
      '..hooookkoooos..',
      '..ooooooooooos..',
      '..osssssssssso..',
      '...oooooooooo...',
    ],
  },
  i_cal: {
    pal: { k: '#1a1a1a', m: '#a89f8c', o: '#d97757', p: '#e8e0d0' },
    rows: [
      '................',
      '................',
      '....k......k....',
      '.kkkkkkkkkkkkkk.',
      '.kooooooooooook.',
      '.kooooooooooook.',
      '.kooooooooooook.',
      '.kppppppppppppk.',
      '.kpmppmppmppmpk.',
      '.kppppppppppppk.',
      '.kpmppmppoppmpk.',
      '.kppppppppppppk.',
      '.kpmppmppmppmpk.',
      '.kppppppppppppk.',
      '.kkkkkkkkkkkkkk.',
      '................',
    ],
  },
  i_info: {
    pal: { h: '#e8a47e', k: '#1a1a1a', s: '#b85a3e' },
    rows: [
      '................',
      '....hhhhhhhh....',
      '...hhhhhhhhhh...',
      '..ssssssssssss..',
      '..shhhhkkhhhhs..',
      '..shhhhkkhhhhs..',
      '..shhhhhhhhhhs..',
      '..shhhhkkhhhhs..',
      '..shhhhkkhhhhs..',
      '..shhhhkkhhhhs..',
      '..shhhhkkhhhhs..',
      '..shhhkkkkhhhs..',
      '..ssssssssssss..',
      '...hhhhhhhhhh...',
      '....hhhhhhhh....',
      '................',
    ],
  },
  i_bell: {
    pal: { s: '#b85a3e', y: '#e0c068' },
    rows: [
      '.....yy.....',
      '...yyyyyy...',
      '...yyyyyy...',
      '..yyyyyyyy..',
      '..yyyyyyyy..',
      '..yyyyyyyy..',
      '..yyyyyyyy..',
      '..yyyyyyyy..',
      '.yyyyyyyyyy.',
      '.ssssssssss.',
      '.....yy.....',
      '............',
    ],
  },
  i_star: {
    pal: { h: '#e8a47e', o: '#d97757' },
    rows: [
      '.....oo.....',
      '.....oo.....',
      '..h..oo..h..',
      '...h.oo.h...',
      '....hooh....',
      'ooooohhooooo',
      'ooooohhooooo',
      '....hooh....',
      '...h.oo.h...',
      '..h..oo..h..',
      '.....oo.....',
      '.....oo.....',
    ],
  },
  wing_lock: {
    pal: { h: '#e8a47e', k: '#1a1a1a', m: '#a89f8c', o: '#d97757', s: '#b85a3e' },
    rows: [
      '.......oooooo.......',
      '.......o....o.......',
      '.......o....o.......',
      '.......o....o.......',
      '.......o....o.......',
      '.....oooooooooo.....',
      '.m..ohhhhhhhhhoo..m.',
      'mm..hoooooooooos..mm',
      'mm..hoooooooooos..mm',
      '....hooookkoooos....',
      '....hoookkkkooos....',
      '....hooookkoooos....',
      '....hooookkoooos....',
      '....ooooooooooos....',
      '....osssssssssso....',
      '.....oooooooooo.....',
    ],
  },
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
const spriteHTML = (name, cls = '') => `<span class="sprite ${cls}">${renderSprite(name)}</span>`;
$$('[data-sprite]').forEach((el) => { el.innerHTML = renderSprite(el.dataset.sprite); });

const desktop = $('#desktop');
const isMobile = () => innerWidth <= 720;
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
};

// ===== Boot =====
const boot = $('#boot'), bootLog = $('#bootLog'), splash = $('#splash'), bootBar = $('#bootBar');
const bootLines = [
  'LOCKIN BIOS v6.0   (c) 2026 lockincrew sp. z o.o.',
  '',
  'cpu: 6 operators @ deep focus ............ <span class="ok">ok</span>',
  'memory: 640k context ought to be enough ... <span class="ok">ok</span>',
  'detecting notifications ................... 47 found → <span class="hl">quarantined</span>',
  'loading meetings.sys ...................... <span class="hl">skipped</span>',
  'loading standup.drv ....................... <span class="hl">not found (on purpose)</span>',
  'mounting /crew ............................ <span class="ok">5 online, 1 slot open</span>',
  '',
  'starting lockinOS…',
];
let booted = false;
function finishBoot() {
  if (booted) return;
  booted = true;
  store.set('lockinos-booted', '1');
  boot.classList.add('done');
  setTimeout(() => { boot.hidden = true; }, 450);
  startDesktop();
}
function runBoot() {
  if (store.get('lockinos-booted') || reduced) { boot.hidden = true; booted = true; startDesktop(); return; }
  let i = 0;
  const step = () => {
    if (booted) return;
    if (i < bootLines.length) {
      bootLog.innerHTML += bootLines[i++] + '\n';
      setTimeout(step, i < 3 ? 140 : 190);
    } else {
      splash.hidden = false;
      let p = 0;
      const fill = setInterval(() => {
        p += 12 + Math.random() * 16;
        bootBar.style.width = `${Math.min(100, p)}%`;
        if (p >= 100) { clearInterval(fill); setTimeout(finishBoot, 350); }
      }, 140);
    }
  };
  step();
  const skip = () => finishBoot();
  addEventListener('keydown', skip, { once: true });
  boot.addEventListener('pointerdown', skip, { once: true });
}

// ===== Window manager =====
const taskList = $('#taskList');
const wins = {};
let zTop = 20, cascade = 0;

function chrome(win) {
  const bar = document.createElement('div');
  bar.className = 'win-bar';
  bar.innerHTML = `${spriteHTML(win.dataset.icon, 'win-ico')}<span class="win-title">${win.dataset.title}</span>
    <div class="win-btns"><button data-act="min" aria-label="minimise">_</button><button data-act="max" aria-label="maximise">□</button><button data-act="close" aria-label="close">×</button></div>`;
  win.prepend(bar);
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', win.dataset.title);
  bar.querySelector('[data-act="min"]').addEventListener('click', () => minimise(win.id));
  bar.querySelector('[data-act="max"]').addEventListener('click', () => win.classList.toggle('max'));
  bar.querySelector('[data-act="close"]').addEventListener('click', () => closeWin(win.id));
  bar.addEventListener('dblclick', (e) => { if (!e.target.closest('button') && !isMobile()) win.classList.toggle('max'); });
  win.addEventListener('pointerdown', () => focusWin(win.id));
  $$('[data-close]', win).forEach((b) => b.addEventListener('click', () => closeWin(win.id)));
  dragify(win, bar);
}

function dragify(win, handle) {
  let sx, sy, ox, oy, dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || isMobile() || win.classList.contains('max')) return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    ox = win.offsetLeft; oy = win.offsetTop;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dw = desktop.clientWidth, dh = desktop.clientHeight;
    const x = clamp(ox + e.clientX - sx, -win.offsetWidth + 80, dw - 80);
    const y = clamp(oy + e.clientY - sy, 0, dh - 30);
    win.style.left = `${Math.round(x / 2) * 2}px`;
    win.style.top = `${Math.round(y / 2) * 2}px`;
  });
  const end = () => { dragging = false; };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

function place(win) {
  const dw = desktop.clientWidth, dh = desktop.clientHeight;
  const w = Math.min(+win.dataset.w || 520, dw - 24);
  win.style.width = `${w}px`;
  if (win.dataset.placed) return;
  win.dataset.placed = '1';
  if (win.dataset.center) {
    win.style.left = `${Math.max(12, (dw - w) / 2)}px`;
    win.style.top = `${Math.max(12, Math.min(60, dh * 0.08))}px`;
    return;
  }
  const x = 130 + (cascade % 6) * 34, y = 24 + (cascade % 6) * 30;
  cascade++;
  win.style.left = `${clamp(x, 8, Math.max(8, dw - w - 8))}px`;
  win.style.top = `${clamp(y, 8, Math.max(8, dh - 200))}px`;
}

function taskBtn(win) {
  let b = taskList.querySelector(`[data-win="${win.id}"]`);
  if (b) return b;
  b = document.createElement('button');
  b.className = 'task-btn';
  b.dataset.win = win.id;
  b.innerHTML = `${spriteHTML(win.dataset.icon)}<span>${win.dataset.title.split(' — ')[0]}</span>`;
  b.addEventListener('click', () => {
    if (win.hidden) { win.hidden = false; focusWin(win.id); }
    else if (win.classList.contains('active')) minimise(win.id);
    else focusWin(win.id);
  });
  taskList.appendChild(b);
  return b;
}

function openWin(name) {
  const win = document.getElementById(`w-${name}`) || document.getElementById(name);
  if (!win) return;
  closeStart();
  const wasHidden = win.hidden;
  win.hidden = false;
  place(win);
  taskBtn(win);
  focusWin(win.id);
  if (wasHidden) {
    win.classList.remove('opening');
    void win.offsetWidth;
    win.classList.add('opening');
  }
  if (name === 'receipts') startReceipts();
  if (name === 'terminal') setTimeout(() => promptInput.focus(), 50);
}
function focusWin(id) {
  const win = document.getElementById(id);
  $$('.win.active').forEach((w) => w.classList.remove('active'));
  $$('.task-btn.active').forEach((b) => b.classList.remove('active'));
  win.classList.add('active');
  win.style.zIndex = ++zTop;
  const b = taskList.querySelector(`[data-win="${id}"]`);
  if (b) b.classList.add('active');
}
function minimise(id) {
  const win = document.getElementById(id);
  win.hidden = true;
  win.classList.remove('active');
  const b = taskList.querySelector(`[data-win="${id}"]`);
  if (b) b.classList.remove('active');
}
function closeWin(id) {
  const win = document.getElementById(id);
  win.classList.add('closing');
  setTimeout(() => {
    win.classList.remove('closing', 'active', 'max');
    win.hidden = true;
    const b = taskList.querySelector(`[data-win="${id}"]`);
    if (b) b.remove();
    if (win.dataset.temp) win.remove();
  }, 170);
}
$$('.win').forEach(chrome);
$('#w-welcome').dataset.center = '1';

// ===== Desktop icons =====
$$('.icon').forEach((icon) => {
  const activate = () => {
    icon.classList.remove('bump'); void icon.offsetWidth; icon.classList.add('bump');
    if (icon.dataset.open) openWin(icon.dataset.open);
    if (icon.dataset.action) runAction(icon.dataset.action);
  };
  icon.addEventListener('click', (e) => {
    $$('.icon.selected').forEach((i) => i.classList.remove('selected'));
    icon.classList.add('selected');
    if (isMobile() || e.detail === 0) activate();
  });
  icon.addEventListener('dblclick', () => { if (!isMobile()) activate(); });
});
desktop.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.icon')) $$('.icon.selected').forEach((i) => i.classList.remove('selected'));
});
document.addEventListener('click', (e) => {
  const opener = e.target.closest('.win [data-open], .start-menu [data-open]');
  if (opener) openWin(opener.dataset.open);
  const act = e.target.closest('.start-menu [data-action]');
  if (act) runAction(act.dataset.action);
});
function runAction(a) {
  closeStart();
  if (a === 'lockin') openSaver();
  if (a === 'shutdown') shutDown();
}

// ===== Start menu =====
const startBtn = $('#startBtn'), startMenu = $('#startMenu');
function closeStart() { startMenu.hidden = true; startBtn.setAttribute('aria-expanded', 'false'); }
startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = startMenu.hidden;
  startMenu.hidden = !open;
  startBtn.setAttribute('aria-expanded', String(open));
  if (open) $('button', startMenu).focus();
});
document.addEventListener('pointerdown', (e) => {
  if (!startMenu.hidden && !e.target.closest('#startMenu, #startBtn')) closeStart();
});

// ===== Clock & focus timer =====
const clockEl = $('#clock'), focusEl = $('#focusClock');
const sessionStart = Date.now();
const pad2 = (n) => String(n).padStart(2, '0');
function tickClock() {
  const d = new Date();
  clockEl.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const s = Math.floor((Date.now() - sessionStart) / 1000);
  focusEl.textContent = `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`;
}
setInterval(tickClock, 1000);
tickClock();

// ===== Notifications (toasts), bell & do-not-disturb =====
const toasts = $('#toasts'), bellBtn = $('#bellBtn'), bellCount = $('#bellCount'), dndBtn = $('#dndBtn'), dndState = $('#dndState');
const pings = [
  ['@', '@channel', 'quick sync?'], ['#', 'general', 'who owns this?'], ['47', 'inbox', '47 unread'], ['!', 'pm', 'can you hop on a call'],
  ['@', 'sales', 'per my last email'], ['12', 'jira', '12 updates on LOCK-404'], ['5', 'calendar', 'standup in 5 min'], ['?', 'ceo', 'thoughts?'],
  ['@', 'design', 'circling back'], ['3', 'docs', '3 comments on q3 okrs'], ['!', 'ops', 'urgent (not urgent)'], ['?', 'random', 'got a sec?'],
];
let unread = 0, dnd = false, pingIdx = Math.floor(Math.random() * pings.length);
function setUnread(n) {
  unread = n;
  bellCount.textContent = n;
  bellBtn.classList.remove('ringing'); void bellBtn.offsetWidth;
  if (n) bellBtn.classList.add('ringing');
}
function toast() {
  if (dnd || !saver.hidden || document.hidden || toasts.children.length >= 3) return;
  const [ic, from, text] = pings[pingIdx++ % pings.length];
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="ic">${ic}</span><span>${escapeHtml(text)}<small>${from} · just now</small></span><button aria-label="dismiss">×</button>`;
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 220); };
  t.querySelector('button').addEventListener('click', () => { kill(); setUnread(Math.max(0, unread - 1)); });
  toasts.appendChild(t);
  setUnread(unread + 1);
  setTimeout(kill, 6500);
}
bellBtn.addEventListener('click', () => {
  const n = unread;
  setUnread(0);
  $$('.toast', toasts).forEach((t) => t.remove());
  sysToast(n ? `${n} ping${n === 1 ? '' : 's'} archived. nobody noticed.` : 'nothing to archive. nice.');
});
function setDnd(on) {
  dnd = on;
  dndState.textContent = on ? 'on' : 'off';
  dndBtn.classList.toggle('on', on);
}
dndBtn.addEventListener('click', () => { setDnd(!dnd); sysToast(dnd ? 'do not disturb: on. calendar.exe sulks.' : 'do not disturb: off. brace yourself.'); });
function sysToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${spriteHTML('i_star')}<span>${msg}<small>lockinOS</small></span><button aria-label="dismiss">×</button>`;
  t.querySelector('.sprite').style.width = '16px';
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 220); };
  t.querySelector('button').addEventListener('click', kill);
  toasts.appendChild(t);
  setTimeout(kill, 3500);
}

// ===== calendar.exe: meeting invites that try to interrupt =====
const invites = [
  ['weekly sync', 'recurring · every monday · forever'],
  ['quick call?', '"won\'t take more than 45 minutes"'],
  ['retro about the retro', 'recurring · bi-weekly · mandatory'],
  ['alignment session', 'agenda: tbd · 14 attendees'],
  ['all-hands (optional*)', '*not optional'],
];
let inviteIdx = 0, declined = 0;
function inviteDialog() {
  if (dnd || !saver.hidden || document.hidden || $('.win.dialog')) return;
  const [title, sub] = invites[inviteIdx++ % invites.length];
  const win = document.createElement('section');
  win.className = 'win dialog';
  win.id = `w-invite-${Date.now()}`;
  win.dataset.title = 'calendar.exe — invitation';
  win.dataset.icon = 'i_cal';
  win.dataset.w = '420';
  win.dataset.temp = '1';
  win.innerHTML = `<div class="win-body">${spriteHTML('i_cal')}<div class="dialog-text"><b>${title}</b><p>${sub}</p><p>organizer: someone in a different timezone</p></div>
    <div class="dialog-btns"><button class="btn" data-r="tentative">tentative</button><button class="btn" data-r="accept">accept</button><button class="btn primary" data-r="decline">decline</button></div></div>`;
  desktop.appendChild(win);
  chrome(win);
  const dw = desktop.clientWidth, dh = desktop.clientHeight;
  win.style.left = `${Math.round(dw * (0.3 + Math.random() * 0.3))}px`;
  win.style.top = `${Math.round(dh * (0.2 + Math.random() * 0.3))}px`;
  win.dataset.placed = '1';
  openWin(win.id);
  win.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.r === 'accept') { $('.dialog-text p', win).textContent = 'error 403: lockincrew doesn\'t do that. declining for you…'; setTimeout(() => toTrash(win, title), 900); }
    else if (b.dataset.r === 'tentative') { $('.dialog-text p', win).textContent = '"tentative" is a meeting in disguise. declining…'; setTimeout(() => toTrash(win, title), 900); }
    else toTrash(win, title);
  }));
}
function toTrash(win, title) {
  const ti = $('#trashIcon .sprite').getBoundingClientRect();
  const wr = win.getBoundingClientRect();
  win.style.setProperty('--tx', `${ti.left - wr.left - wr.width / 2}px`);
  win.style.setProperty('--ty', `${ti.top - wr.top - wr.height / 2}px`);
  win.style.transformOrigin = '50% 50%';
  win.classList.add('to-trash');
  setTimeout(() => {
    const b = taskList.querySelector(`[data-win="${win.id}"]`);
    if (b) b.remove();
    win.remove();
    addTrash(title, 'meeting', 'just now');
  }, 520);
}
const trashList = $('#trashList'), trashCount = $('#trashCount');
function addTrash(name, type, when) {
  declined++;
  const tr = document.createElement('tr');
  tr.className = 'fresh';
  tr.innerHTML = `<td>${escapeHtml(name)}.ics</td><td>${type}</td><td>${when}</td>`;
  trashList.prepend(tr);
  trashCount.textContent = `${trashList.children.length} items · ${declined} declined today`;
  $('#trashIcon .sprite').innerHTML = renderSprite('i_trashfull');
}
$('#emptyTrash').addEventListener('click', () => {
  sysToast(`can't. ${trashList.children.length} items, and the recurring ones keep coming back.`);
});

// ===== services.app =====
$$('.cp-item').forEach((b) => b.addEventListener('click', () => {
  $$('.cp-item').forEach((x) => x.classList.toggle('active', x === b));
  $$('.cp-detail .svc').forEach((s, i) => s.classList.toggle('active', i === +b.dataset.svc));
}));

// ===== crew/ pet care =====
const careStatus = $('#careStatus');
const petState = $$('.pet:not(.pet-egg)').map((pet) => ({ pet, focus: 0.5 + Math.random() * 0.4, coffee: 0.4 + Math.random() * 0.4 }));
function renderPet(p) {
  for (const k of ['focus', 'coffee']) {
    const bar = $(`.bar[data-stat="${k}"]`, p.pet);
    bar.querySelector('i').style.setProperty('--v', p[k].toFixed(2));
    bar.classList.toggle('low', p[k] < 0.25);
  }
}
function talk(pet, text) {
  const say = $('.say', pet);
  say.textContent = text;
  pet.classList.add('talk');
  const sp = $('.pet-stage .sprite', pet);
  sp.classList.remove('hop'); void sp.offsetWidth; sp.classList.add('hop');
  clearTimeout(pet._t);
  pet._t = setTimeout(() => pet.classList.remove('talk'), 2200);
}
petState.forEach((p) => {
  renderPet(p);
  const name = $('.pet-name', p.pet).firstChild.textContent.trim();
  p.pet.querySelectorAll('[data-care]').forEach((b) => b.addEventListener('click', () => {
    const c = b.dataset.care;
    if (c === 'coffee') {
      p.coffee = Math.min(1, p.coffee + 0.35);
      talk(p.pet, p.coffee >= 1 ? 'ok that\'s enough coffee. i can hear colours.' : 'mm. coffee. +12% throughput.');
    } else if (c === 'ticket') {
      p.focus = Math.min(1, p.focus + 0.3);
      p.coffee = Math.max(0, p.coffee - 0.15);
      talk(p.pet, 'ticket accepted. shipping by friday.');
      careStatus.textContent = `${name} shipped something ✓`;
    } else {
      talk(p.pet, p.pet.dataset.say);
    }
    renderPet(p);
  }));
  $('.pet-stage', p.pet).addEventListener('click', () => talk(p.pet, p.pet.dataset.say));
});
$('.pet-egg .pet-stage').addEventListener('click', () => talk($('.pet-egg'), $('.pet-egg').dataset.say));
setInterval(() => {
  petState.forEach((p) => {
    p.focus = Math.max(0.05, p.focus - 0.02);
    p.coffee = Math.max(0, p.coffee - 0.03);
    renderPet(p);
  });
  const sleepy = petState.find((p) => p.coffee < 0.15);
  careStatus.textContent = sleepy ? `${$('.pet-name', sleepy.pet).firstChild.textContent.trim()} needs coffee` : 'all operators nominal';
}, 4000);

// ===== receipts.log (task manager) =====
const graph = $('#graph');
const series = Array.from({ length: 24 }, () => 4 + Math.random() * 14);
graph.innerHTML = series.map(() => '<i></i>').join('');
function drawGraph() {
  const max = 20;
  $$('i', graph).forEach((bar, i) => { bar.style.height = `${(series[i] / max) * 100}%`; });
}
drawGraph();
setInterval(() => {
  if ($('#w-receipts').hidden) return;
  series.shift();
  series.push(4 + Math.random() * 15);
  drawGraph();
}, 1400);
let counted = false;
function startReceipts() {
  if (counted) return;
  counted = true;
  $$('[data-count]').forEach((el, i) => {
    const target = +el.dataset.count, suffix = el.dataset.suffix || '';
    const t0 = performance.now() + i * 120, dur = 1200;
    const tick = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      el.innerHTML = Math.round(target * (1 - Math.pow(1 - t, 3))) + (suffix ? `<span class="suffix">${suffix}</span>` : '');
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
$('#endTask').addEventListener('click', (e) => {
  const row = e.target.closest('tr');
  row.classList.add('ended');
  row.children[1].textContent = 'terminated';
  row.children[1].className = 'ok';
  e.target.replaceWith(document.createTextNode('freed 23 h/week'));
});

// ===== hire.exe =====
const hireForm = $('#hireForm'), wizProgress = $('#wizProgress'), wizBar = $('#wizBar'), wizMsg = $('#wizMsg');
hireForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = (new FormData(hireForm).get('name') || '').toString().trim() || 'anon';
  const steps = ['copying brief to operators…', 'scheduling 0 meetings…', 'removing jira…', 'warming up the keyboard…', `done. thanks, ${name} — reply within 5 days ✓`];
  wizProgress.hidden = false;
  $('button[type="submit"]', hireForm).disabled = true;
  steps.forEach((s, i) => setTimeout(() => {
    wizMsg.textContent = s;
    wizBar.style.width = `${((i + 1) / steps.length) * 100}%`;
    if (i === steps.length - 1) {
      hireForm.reset();
      $('button[type="submit"]', hireForm).disabled = false;
      sysToast(`brief from ${escapeHtml(name)} installed on 5 desks.`);
    }
  }, 500 + i * 650));
});

// ===== terminal =====
const promptInput = $('#promptInput'), termOut = $('#termOut');
const apps = ['welcome', 'manifesto', 'services', 'crew', 'receipts', 'hire', 'terminal', 'trash'];
const cmds = [
  [/^(help|\?|\/help)$/i, () => '<b>commands</b> — ls · open &lt;app&gt; · whoami · /pricing · /stack · /timezone · /availability · lockin · dnd · clear · shutdown'],
  [/^ls$/i, () => 'readme.txt  manifesto.txt  services.app  crew/  receipts.log  hire.exe  trash/'],
  [/^(open|cat|run|\.\/)\s*(\S+)/i, (m) => {
    const t = m[2].replace(/\.(txt|app|log|exe)$|\/$/g, '').replace('readme', 'welcome');
    if (apps.includes(t)) { openWin(t); return `opening <b>${escapeHtml(m[2])}</b>…`; }
    return `no such file: ${escapeHtml(m[2])}`;
  }],
  [/^(\/?)(manifesto|services|crew|receipts|hire|trash)$/i, (m) => { openWin(m[2].toLowerCase()); return `opening <b>${m[2].toLowerCase()}</b>…`; }],
  [/^whoami$/i, () => 'a visitor with a deadline, probably. type <b>open hire</b>.'],
  [/^\/?pricing$/i, () => '<b>pricing</b> — strike team €60-120k fixed · rescue op €180/h t&m · ai pilot €25-45k · embedded €18-26k/mo.'],
  [/^\/?stack$/i, () => '<b>stack</b> — typescript, rust, python, go · postgres, redis · react, svelte · terraform, aws · claude · linear, github. no jira.'],
  [/^\/?timezone$/i, () => '<b>timezones</b> — warsaw (utc+1), lisbon (utc+0). async-first.'],
  [/^\/?availability$/i, () => '<b>next slot</b> — strike cell: q1 · rescue op: this month (1 slot) · embedded: q1 · ai pilot: waitlist.'],
  [/^\/?lockin$/i, () => { setTimeout(openSaver, 300); return 'entering <b>LOCK_IN_MODE</b>…'; }],
  [/^dnd$/i, () => { setDnd(!dnd); return `do not disturb: <b>${dnd ? 'on' : 'off'}</b>`; }],
  [/^sudo\s+(standup|meeting|sync)/i, () => 'permission denied. not even root can schedule that.'],
  [/^(shutdown|exit)$/i, () => { setTimeout(shutDown, 400); return 'shutting down…'; }],
  [/meeting|standup|sync|jira/i, () => 'we don\'t do that here. one brief, one demo, the rest is the keyboard.'],
  [/.*/, (m) => `command not found: ${escapeHtml(m[0])} · try <b>help</b>`],
];
function termRun(raw) {
  const cmd = raw.trim();
  if (!cmd) return;
  if (/^clear$/i.test(cmd)) { termOut.innerHTML = ''; return; }
  const line = document.createElement('div');
  line.className = 'cmd';
  line.innerHTML = `<span class="path">$</span> ${escapeHtml(cmd)}`;
  termOut.appendChild(line);
  for (const [re, fn] of cmds) {
    const m = cmd.match(re);
    if (m) {
      const out = document.createElement('div');
      out.className = 'reply';
      out.innerHTML = fn(m);
      termOut.appendChild(out);
      break;
    }
  }
  termOut.scrollTop = termOut.scrollHeight;
}
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { termRun(promptInput.value); promptInput.value = ''; }
});
$('#termBody').addEventListener('click', () => promptInput.focus());

// ===== Lock-in screensaver =====
const saver = $('#saver'), saverSky = $('#saverSky'), saverTimer = $('#saverTimer');
let saverStart = 0, saverInt = 0;
function openSaver() {
  if (!saver.hidden) return;
  saverSky.innerHTML = Array.from({ length: isMobile() ? 7 : 14 }, (_, i) => {
    const x0 = `${Math.round(20 + Math.random() * 110)}vw`;
    return `<div class="flyer" style="--x0:${x0};--d:${7 + Math.random() * 7}s;--delay:${-Math.random() * 12}s">${spriteHTML('wing_lock')}</div>`;
  }).join('');
  saver.hidden = false;
  saverStart = Date.now();
  saverTimer.textContent = '00:00';
  saverInt = setInterval(() => {
    const s = Math.floor((Date.now() - saverStart) / 1000);
    saverTimer.textContent = `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
  }, 250);
}
function closeSaver() {
  if (saver.hidden) return;
  saver.hidden = true;
  clearInterval(saverInt);
  saverSky.innerHTML = '';
  sysToast(`welcome back. you were locked in for ${saverTimer.textContent}.`);
}
saver.addEventListener('pointerdown', closeSaver);

// idle → screensaver
let idleT = 0;
const resetIdle = () => {
  clearTimeout(idleT);
  idleT = setTimeout(() => { if (booted && $('#shutdown').hidden) openSaver(); }, 120000);
};
['pointermove', 'keydown', 'pointerdown', 'wheel'].forEach((ev) => addEventListener(ev, resetIdle, { passive: true }));

// ===== Shut down =====
function shutDown() {
  $('#shutdown').hidden = false;
}
$('#restartBtn').addEventListener('click', () => {
  $('#shutdown').hidden = true;
  $$('.win').forEach((w) => { if (!w.hidden) closeWin(w.id); });
  try { sessionStorage.removeItem('lockinos-booted'); } catch { /* ignore */ }
  boot.hidden = false;
  boot.classList.remove('done');
  bootLog.innerHTML = '';
  splash.hidden = true;
  bootBar.style.width = '0';
  booted = false;
  runBoot();
});

// ===== Keyboard =====
document.addEventListener('keydown', (e) => {
  if (!booted) return;
  if (!saver.hidden) { if (e.key === 'Escape' || e.key.length === 1) closeSaver(); return; }
  if (e.key === 'Escape') {
    if (!startMenu.hidden) return closeStart();
    const active = $('.win.active');
    if (active && !e.target.closest('input, textarea, select')) closeWin(active.id);
    return;
  }
  if (e.target.closest('input, textarea, select')) return;
  if (e.key === '/') { e.preventDefault(); openWin('terminal'); }
  else if (e.key.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey) openSaver();
});

// ===== Pixel eyes follow the cursor =====
const mouse = { x: -9999, y: -9999 };
addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
function updateEyes() {
  for (const el of $$('.px-pupil')) {
    const eye = el.parentNode.firstElementChild;
    const r = eye.getBoundingClientRect();
    if (!r.width) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    el.setAttribute('x', +el.dataset.x + (mouse.x < cx ? 0 : 1));
    el.setAttribute('y', +el.dataset.y + (mouse.y < cy - r.height ? 0 : 1));
  }
  requestAnimationFrame(updateEyes);
}

// ===== Start =====
let started = false;
function startDesktop() {
  if (started) { openWin('welcome'); return; }
  started = true;
  openWin('welcome');
  resetIdle();
  requestAnimationFrame(updateEyes);
  if (!reduced) {
    setTimeout(toast, 6000);
    setInterval(toast, 11000);
    setTimeout(inviteDialog, 18000);
    setInterval(inviteDialog, 32000);
  }
}
runBoot();
