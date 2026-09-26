/* QR code with an image in the middle (mock-only tool page).
   qrcode-generator builds the matrix; the drawing is ours: one set of SVG paths in module units
   feeds both the SVG download and, through Path2D, the canvas preview / PNG. jsQR reads the result back. */
'use strict';

const MENU_URL = 'https://michalanatolskora.github.io/webpages-pocs/uncle-tans/v2/index.html';
const DEFAULT_LOGO = { src: 'img/social/logo.jpg', name: "Logo Uncle Tan's" };
const PRESETS = {
  logo: { fg: '#2b5712', eyeOuter: '#c4150c', eyeInner: '#2b5712', bg: '#ffffff' }, // green band + red "UNCLE TAN'S"
  site: { fg: '#1f1a17', eyeOuter: '#c4520f', eyeInner: '#1f1a17', bg: '#ffffff' }, // --ink + --accent-d (--accent is too light for scanners)
  mono: { fg: '#000000', eyeOuter: '#000000', eyeInner: '#000000', bg: '#ffffff' },
};
// corner radii of the finder patterns as a fraction of half their size: [tl, tr, br, bl]
const EYE_SHAPES = { square: [0, 0, 0, 0], rounded: [.55, .55, .55, .55], leaf: [.95, .15, .95, .15], circle: [1, 1, 1, 1] };
const ECL_PCT = { L: 7, M: 15, Q: 25, H: 30 };
const LOGO_MAX_PX = 1200; // the logo is kept at up to this size, so a 4096 px PNG still looks sharp
const PREVIEW_PX = 1000, SCAN_PX = 600;

qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; // default is Latin-1 – "ł" would break

const state = {
  text: MENU_URL, ecl: 'H', margin: 4,
  modules: 'liquid', eyes: 'leaf', ...PRESETS.logo, transparent: false,
  logoImg: null, logoName: '', logo: null, // logo = { canvas, url, w, h } after trimming
  logoSize: .34, logoPad: 1, excavate: true, trim: true,
};

const $ = id => document.getElementById(id);
const f = v => +v.toFixed(3);

/* ===================== geometry ===================== */

// rounded rectangle as SVG path data; r = radius or [tl, tr, br, bl]
function roundRect(x, y, w, h, r) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r.map(f) : [r, r, r, r].map(f);
  return `M${f(x + tl)} ${f(y)}h${f(w - tl - tr)}` + (tr ? `a${tr} ${tr} 0 0 1 ${tr} ${tr}` : '') +
    `v${f(h - tr - br)}` + (br ? `a${br} ${br} 0 0 1 ${-br} ${br}` : '') +
    `h${f(bl + br - w)}` + (bl ? `a${bl} ${bl} 0 0 1 ${-bl} ${-bl}` : '') +
    `v${f(tl + bl - h)}` + (tl ? `a${tl} ${tl} 0 0 1 ${tl} ${-tl}` : '') + 'z';
}

function buildScene() {
  const qr = qrcode(0, state.ecl);
  qr.addData(state.text, 'Byte');
  qr.make(); // throws when the text doesn't fit
  const n = qr.getModuleCount();
  const eyes = [[0, 0], [n - 7, 0], [0, n - 7]]; // [x, y] of the finder patterns
  const inEye = (x, y) => eyes.some(([ex, ey]) => x >= ex && x < ex + 7 && y >= ey && y < ey + 7);

  // logo box (module units, centred); with excavate the modules whose centre is under box + padding are dropped
  let box = null, inHole = () => false, covered = 0;
  if (state.logo) {
    const a = state.logo.w / state.logo.h, side = state.logoSize * n;
    const w = a >= 1 ? side : side * a, h = a >= 1 ? side / a : side;
    box = { x: (n - w) / 2, y: (n - h) / 2, w, h };
    if (state.excavate) {
      const hw = w / 2 + state.logoPad, hh = h / 2 + state.logoPad;
      inHole = (x, y) => Math.abs(x + .5 - n / 2) < hw && Math.abs(y + .5 - n / 2) < hh;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (inHole(x, y)) covered++;
    } else covered = w * h;
  }
  const on = (x, y) => x >= 0 && y >= 0 && x < n && y < n && qr.isDark(y, x) && !inEye(x, y) && !inHole(x, y);

  let modules = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!on(x, y)) continue;
    if (state.modules === 'square') { // one rectangle per horizontal run – smaller file, no seams
      let run = 1; while (on(x + run, y)) run++;
      modules += `M${x} ${y}h${run}v1h${-run}z`;
      x += run - 1;
    } else if (state.modules === 'dots') {
      modules += roundRect(x + .06, y + .06, .88, .88, .44);
    } else { // liquid: round a corner only when neither side of it has a neighbour
      const t = !on(x, y - 1), b = !on(x, y + 1), l = !on(x - 1, y), r = !on(x + 1, y);
      modules += roundRect(x, y, 1, 1, [t && l, t && r, b && r, b && l].map(c => c ? .5 : 0));
    }
  }

  let eyeOuter = '', eyeInner = '';
  eyes.forEach(([x, y], i) => {
    let k = EYE_SHAPES[state.eyes];
    if (i) k = [k[1], k[0], k[3], k[2]]; // mirror the top-right / bottom-left ones (matters for the leaf)
    const rr = size => k.map(v => v * size / 2);
    eyeOuter += roundRect(x, y, 7, 7, rr(7)) + roundRect(x + 1, y + 1, 5, 5, rr(5)); // ring (even-odd)
    eyeInner += roundRect(x + 2, y + 2, 3, 3, rr(3));
  });

  return { n, version: (n - 17) / 4, modules, eyeOuter, eyeInner, box, coveredPct: covered / (n * n) * 100 };
}

/* ===================== rendering ===================== */

function drawTo(canvas, px, scene, { opaque = false } = {}) {
  const T = scene.n + 2 * state.margin, k = px / T;
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!state.transparent || opaque) { ctx.fillStyle = state.transparent ? '#ffffff' : state.bg; ctx.fillRect(0, 0, px, px); }
  ctx.setTransform(k, 0, 0, k, state.margin * k, state.margin * k);
  ctx.fillStyle = state.fg; ctx.fill(new Path2D(scene.modules));
  ctx.fillStyle = state.eyeOuter; ctx.fill(new Path2D(scene.eyeOuter), 'evenodd');
  ctx.fillStyle = state.eyeInner; ctx.fill(new Path2D(scene.eyeInner));
  if (scene.box) {
    const { x, y, w, h } = scene.box;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.logo.canvas, x, y, w, h);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

function toSVG(scene, px) {
  const T = scene.n + 2 * state.margin, m = state.margin, b = scene.box;
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${T} ${T}" width="${px}" height="${px}">\n` +
    (state.transparent ? '' : `<rect width="${T}" height="${T}" fill="${state.bg}"/>\n`) +
    `<g transform="translate(${m} ${m})">\n` +
    `<path fill="${state.fg}" d="${scene.modules}"/>\n` +
    `<path fill="${state.eyeOuter}" fill-rule="evenodd" d="${scene.eyeOuter}"/>\n` +
    `<path fill="${state.eyeInner}" d="${scene.eyeInner}"/>\n` +
    (b ? `<image x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" preserveAspectRatio="none" xlink:href="${state.logo.url}"/>\n` : '') +
    `</g>\n</svg>\n`;
}

/* ===================== logo ===================== */

function prepareLogo() {
  const img = state.logoImg;
  if (!img) { state.logo = null; return; }
  const s = Math.min(1, LOGO_MAX_PX / Math.max(img.naturalWidth || 512, img.naturalHeight || 512));
  let c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((img.naturalWidth || 512) * s));
  c.height = Math.max(1, Math.round((img.naturalHeight || 512) * s));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let hasAlpha = false;
  try {
    if (state.trim) c = trim(c);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { hasAlpha = true; break; }
  } catch { /* tainted canvas (page opened from file://) – no trimming */ }
  let url = '';
  try { url = hasAlpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', .92); } catch { /* no SVG export then */ }
  state.logo = { canvas: c, url, w: c.width, h: c.height };
}

// crop to the bounding box of pixels that are neither near-white nor near-transparent, + 2% margin
function trim(c) {
  const { width: w, height: h } = c, d = c.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 16 || (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240)) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return c;
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * .02);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function loadLogo(src, name) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { state.logoImg = img; state.logoName = name; prepareLogo(); syncLogoUI(); render(); resolve(true); };
    img.onerror = () => { $('logoName').textContent = `Nie udało się wczytać: ${name}`; resolve(false); };
    img.src = src;
  });
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const r = new FileReader();
  r.onload = () => loadLogo(r.result, file.name);
  r.readAsDataURL(file);
}

/* ===================== UI ===================== */

let scene = null, scanTimer = 0, frame = 0;

function render() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    try { scene = buildScene(); } catch (e) {
      scene = null;
      showError(/overflow/i.test(e) ? 'Za dużo tekstu na kod QR – skróć go albo obniż korekcję błędów.' : `Błąd: ${e.message || e}`);
      $('qrMeta').textContent = ''; $('qrWarn').replaceChildren(); setScan('fail', 'Brak kodu');
      return;
    }
    $('qrError').hidden = true;
    $('dlPng').disabled = $('dlSvg').disabled = false;
    drawTo($('qrCanvas'), PREVIEW_PX, scene);
    $('qrMeta').textContent = `Wersja ${scene.version} · ${scene.n}×${scene.n} modułów · korekcja ${state.ecl}`;
    showWarnings();
    setScan('wait', 'Sprawdzam…');
    clearTimeout(scanTimer); scanTimer = setTimeout(scan, 250);
  });
}

function showError(msg) {
  $('qrError').textContent = msg; $('qrError').hidden = false;
  $('dlPng').disabled = $('dlSvg').disabled = true;
}

function showWarnings() {
  const out = [];
  if (scene.box) {
    const pct = scene.coveredPct, ec = ECL_PCT[state.ecl], p = Math.round(pct);
    if (pct > ec) out.push(['bad', `Obrazek zasłania ${p}% kodu, a korekcja ${state.ecl} odtworzy najwyżej ~${ec}% – zmniejsz obrazek albo podnieś korekcję.`]);
    else if (pct > ec * .6) out.push(['', `Obrazek zasłania ${p}% kodu (korekcja ${state.ecl}: ~${ec}%) – mały zapas na zabrudzenia i słabe aparaty.`]);
    if (state.ecl !== 'H') out.push(['', 'Z obrazkiem ustaw korekcję H – daje największy zapas.']);
  }
  const bg = state.transparent ? '#ffffff' : state.bg;
  const low = [['moduły', state.fg], ['ramka oczek', state.eyeOuter], ['środek oczek', state.eyeInner]]
    .filter(([, c]) => contrast(c, bg) < 3).map(([n]) => n);
  if (low.length) out.push(['bad', `Za mały kontrast z tłem: ${low.join(', ')} – skanery mogą nie złapać kodu.`]);
  if (luminance(state.fg) > luminance(bg)) out.push(['bad', 'Jasne moduły na ciemnym tle – wiele aparatów nie odczyta odwróconego kodu.']);
  if (state.transparent) out.push(['', 'Przezroczyste tło: kod musi leżeć na jasnym, jednolitym podkładzie.']);
  if (state.margin < 2) out.push(['', 'Wąski margines – zostaw wokół kodu wolne miejsce w projekcie.']);
  $('qrWarn').replaceChildren(...out.map(([cls, text]) => {
    const li = document.createElement('li'); li.textContent = text; if (cls) li.className = 'is-' + cls; return li;
  }));
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); }

// read the code back like a phone would (no inverted codes)
function scan() {
  if (!scene) return;
  if (typeof jsQR !== 'function') { setScan('warn', 'Nie sprawdzono', 'Nie wczytała się biblioteka jsQR – zeskanuj kod telefonem.'); return; }
  const c = drawTo(document.createElement('canvas'), SCAN_PX, scene, { opaque: true });
  let res = null;
  try { res = jsQR(c.getContext('2d').getImageData(0, 0, SCAN_PX, SCAN_PX).data, SCAN_PX, SCAN_PX, { inversionAttempts: 'dontInvert' }); }
  catch { setScan('warn', 'Nie sprawdzono', 'Otwórz stronę przez serwer (launch config mock-v2), nie z pliku.'); return; }
  if (!res) setScan('fail', '✗ Nie udało się odczytać', 'Zmniejsz obrazek, podnieś korekcję albo kontrast.');
  else if (res.data !== state.text) setScan('warn', '⚠ Odczytano inny tekst', res.data);
  else setScan('ok', '✓ Kod się skanuje', 'Sprawdzone programowo (jsQR) – przed drukiem zeskanuj go jeszcze telefonem.');
}

function setScan(s, title, detail = '') {
  const el = $('scanStatus');
  el.dataset.s = s;
  el.replaceChildren(document.createElement('span'));
  el.firstChild.textContent = title;
  if (detail) { const sm = document.createElement('small'); sm.textContent = detail; el.firstChild.append(sm); }
}

function syncLogoUI() {
  const thumb = $('logoThumb');
  if (state.logo) {
    const img = document.createElement('img');
    img.src = state.logo.url || state.logoImg.src; img.alt = '';
    thumb.replaceChildren(img);
  } else thumb.textContent = '∅';
  $('logoName').textContent = state.logo ? `${state.logoName} · ${state.logo.w}×${state.logo.h}` : 'Bez obrazka';
  for (const id of ['logoSize', 'logoPad', 'excavate', 'trim']) $(id).disabled = !state.logo;
}

function syncOutputs() {
  $('logoSizeOut').textContent = Math.round(state.logoSize * 100) + '%';
  $('logoPadOut').textContent = state.logoPad + ' mod.';
  $('marginOut').textContent = state.margin + ' mod.';
  const bytes = new TextEncoder().encode(state.text).length;
  $('textInfo').textContent = `${state.text.length} znaków · ${bytes} B`;
  $('textMenu').classList.toggle('is-active', state.text === MENU_URL);
  for (const [seg, key] of [['segModules', 'modules'], ['segEyes', 'eyes']])
    for (const b of $(seg).children) { const on = b.dataset.v === state[key]; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on); }
  $('cFg').value = state.fg; $('cEyeOuter').value = state.eyeOuter; $('cEyeInner').value = state.eyeInner; $('cBg').value = state.bg;
  $('cBg').disabled = state.transparent;
  for (const b of $('presets').children) {
    const p = PRESETS[b.dataset.preset];
    b.classList.toggle('is-active', ['fg', 'eyeOuter', 'eyeInner', 'bg'].every(k => p[k] === state[k]));
  }
}

function update(patch, { relogo = false } = {}) {
  Object.assign(state, patch);
  if (relogo) { prepareLogo(); syncLogoUI(); }
  syncOutputs();
  render();
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ===================== wiring ===================== */

$('qrForm').addEventListener('submit', e => e.preventDefault());
$('qrText').value = state.text;
$('qrText').addEventListener('input', e => update({ text: e.target.value }));
$('textMenu').addEventListener('click', () => { $('qrText').value = MENU_URL; update({ text: MENU_URL }); });

$('logoSize').addEventListener('input', e => update({ logoSize: e.target.value / 100 }));
$('logoPad').addEventListener('input', e => update({ logoPad: +e.target.value }));
$('excavate').addEventListener('change', e => update({ excavate: e.target.checked }));
$('trim').addEventListener('change', e => update({ trim: e.target.checked }, { relogo: true }));
$('logoFile').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
$('logoDefault').addEventListener('click', () => loadLogo(DEFAULT_LOGO.src, DEFAULT_LOGO.name));
$('logoNone').addEventListener('click', () => { state.logoImg = null; update({}, { relogo: true }); });

const drop = $('drop');
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('is-over'); loadFile(e.dataTransfer.files[0]); });
document.addEventListener('paste', e => {
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); loadFile(item.getAsFile()); }
});

$('segModules').addEventListener('click', e => { const v = e.target.closest('button')?.dataset.v; if (v) update({ modules: v }); });
$('segEyes').addEventListener('click', e => { const v = e.target.closest('button')?.dataset.v; if (v) update({ eyes: v }); });
$('presets').addEventListener('click', e => { const p = PRESETS[e.target.closest('button')?.dataset.preset]; if (p) update({ ...p }); });
for (const [id, key] of [['cFg', 'fg'], ['cEyeOuter', 'eyeOuter'], ['cEyeInner', 'eyeInner'], ['cBg', 'bg']])
  $(id).addEventListener('input', e => update({ [key]: e.target.value }));
$('transparent').addEventListener('change', e => update({ transparent: e.target.checked }));
$('ecl').addEventListener('change', e => update({ ecl: e.target.value }));
$('margin').addEventListener('input', e => update({ margin: +e.target.value }));

$('dlPng').addEventListener('click', () => {
  if (!scene) return;
  drawTo(document.createElement('canvas'), +$('pngSize').value, scene).toBlob(b => download(b, 'kod-qr.png'), 'image/png');
});
$('dlSvg').addEventListener('click', () => {
  if (!scene) return;
  if (scene.box && !state.logo.url) { showError('Nie da się osadzić obrazka w SVG – otwórz stronę przez serwer.'); return; }
  download(new Blob([toSVG(scene, +$('pngSize').value)], { type: 'image/svg+xml' }), 'kod-qr.svg');
});

if (typeof qrcode !== 'function') showError('Nie wczytała się biblioteka qrcode-generator (unpkg.com).');
else {
  $('logoSize').value = state.logoSize * 100; $('logoPad').value = state.logoPad; $('margin').value = state.margin;
  syncOutputs(); syncLogoUI(); render();
  loadLogo(DEFAULT_LOGO.src, DEFAULT_LOGO.name);
}
