(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PIXEL = '"Pixelify Sans", system-ui, sans-serif';
  const INK = '#231a2b';
  const RAINBOW = ['#61bb46', '#fdb827', '#f5821f', '#e03a3e', '#963d97', '#009ddc'];

  /* ============================================================
     Palette and ordered dithering
     The shop is drawn with vector shapes into a buffer that is 3x
     smaller than the screen, every pixel is snapped to the old
     Apple palette with a 4x4 Bayer matrix, and the buffer is scaled
     back up with nearest-neighbour. Same pipeline as v2.
     ============================================================ */
  const PALETTE = [
    '#231a2b', '#4a3f55', '#fffdf6',
    '#f4eedd', '#e3d9c0', '#c9bc9b', '#9e9070', '#6e6450',
    '#f2b877', '#d18a4b', '#a5622d', '#6f3d18',
    '#a8dc8f', '#61bb46', '#3a8a2e', '#1f5a1a',
    '#ffe08a', '#fdb827', '#c98d10',
    '#ffb072', '#f5821f', '#b85a10',
    '#f58e90', '#e03a3e', '#a3222a',
    '#efdcf3', '#d6b0de', '#b07ab8', '#963d97', '#5f2463',
    '#a9e3f7', '#4cc0ea', '#009ddc', '#0a62a0', '#0b3566',
    '#e2e2ea', '#a9a8bb', '#6a687e',
  ].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.47) * 12);
  const QCACHE = new Map();
  function quantize(img, w, h) {
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        const t = BAYER[(y & 3) * 4 + (x & 3)];
        const r = d[p] + t, g = d[p + 1] + t, b = d[p + 2] + t;
        const key = ((r + 32 >> 3) << 12) | ((g + 32 >> 3) << 6) | (b + 32 >> 3);
        let c = QCACHE.get(key);
        if (!c) {
          let best = 0, bd = Infinity;
          for (let i = 0; i < PALETTE.length; i++) {
            const q = PALETTE[i];
            const dr = r - q[0], dg = g - q[1], db = b - q[2];
            const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
            if (dist < bd) { bd = dist; best = i; }
          }
          c = PALETTE[best];
          QCACHE.set(key, c);
        }
        d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      }
    }
  }

  /* ============================================================
     Isometric helpers (2:1 projection, one world unit = U px)
     x runs to the right-down, y to the left-down, z up.
     ============================================================ */
  const U = 32;
  const P = (x, y, z) => [(x - y) * U, (x + y) * U / 2 - z * U];
  let LW = 2;
  const C = {
    beige: ['#f4eedd', '#e3d9c0', '#c9bc9b'],
    wood: ['#f2b877', '#d18a4b', '#a5622d'],
    woodD: ['#d18a4b', '#a5622d', '#6f3d18'],
    metal: ['#e2e2ea', '#a9a8bb', '#6a687e'],
    dark: ['#6a687e', '#4a3f55', '#231a2b'],
    paper: ['#fffdf6', '#f4eedd', '#e3d9c0'],
    green: ['#a8dc8f', '#61bb46', '#3a8a2e'],
    yellow: ['#ffe08a', '#fdb827', '#c98d10'],
    orange: ['#ffb072', '#f5821f', '#b85a10'],
    red: ['#f58e90', '#e03a3e', '#a3222a'],
    purple: ['#d6b0de', '#963d97', '#5f2463'],
    blue: ['#a9e3f7', '#009ddc', '#0a62a0'],
  };
  const RCOLS = [C.green, C.yellow, C.orange, C.red, C.purple, C.blue];

  function shape(g, pts, fill, stroke = true) {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = INK; g.lineWidth = LW; g.lineJoin = 'round'; g.stroke(); }
  }
  // a box with its three visible faces: top, the +y face, the +x face
  function cuboid(g, x, y, z, w, d, h, col, stroke = true) {
    shape(g, [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], col[1], stroke);
    shape(g, [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], col[2], stroke);
    shape(g, [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], col[0], stroke);
  }
  const faceY = (g, x, y, z, w, h, fill, stroke) => shape(g, [P(x, y, z), P(x + w, y, z), P(x + w, y, z + h), P(x, y, z + h)], fill, stroke);
  const faceX = (g, x, y, z, d, h, fill, stroke) => shape(g, [P(x, y, z), P(x, y + d, z), P(x, y + d, z + h), P(x, y, z + h)], fill, stroke);
  const faceZ = (g, x, y, z, w, d, fill, stroke) => shape(g, [P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)], fill, stroke);
  // draw flat things on a wall in local px: 'A' is the back wall (y = const), 'B' the left wall (x = const)
  function onWall(g, wall, a, b, ztop, fn) {
    const [ox, oy] = wall === 'A' ? P(a, b, ztop) : P(b, a, ztop);
    g.save();
    g.translate(ox, oy);
    g.transform(1, wall === 'A' ? 0.5 : -0.5, 0, 1, 0, 0);
    fn(g);
    g.restore();
  }

  /* ============================================================
     The shop (14 x 12 floor, walls 6 high)
     ============================================================ */
  const X = 14, Y = 12, H = 6;
  let shopOpen = false;

  function drawShop(g, t) {
    // floor tiles
    for (let i = 0; i < X; i++) {
      for (let j = 0; j < Y; j++) faceZ(g, i, j, 0, 1, 1, (i + j) % 2 ? '#f4eedd' : '#e3d9c0', false);
    }
    shape(g, [P(0, 0, 0), P(X, 0, 0), P(X, Y, 0), P(0, Y, 0)], null);
    // rug in the middle
    faceZ(g, 4.5, 3.6, 0.01, 4, 2.8, '#963d97');
    faceZ(g, 4.8, 3.9, 0.02, 3.4, 2.2, '#d6b0de', false);

    // walls
    shape(g, [P(0, 0, 0), P(0, Y, 0), P(0, Y, H), P(0, 0, H)], '#b07ab8');
    shape(g, [P(0, 0, 0), P(X, 0, 0), P(X, 0, H), P(0, 0, H)], '#d6b0de');
    faceX(g, 0, 0, 0, Y, 0.35, '#6f3d18');
    faceY(g, 0, 0, 0, X, 0.35, '#a5622d');
    // wall tops
    shape(g, [P(0, 0, H), P(X, 0, H), P(X, -0.3, H), P(-0.3, -0.3, H), P(-0.3, Y, H), P(0, Y, H)], '#f4eedd');

    // window on the left wall
    onWall(g, 'B', 5.4, 0, 5, (c) => {
      c.fillStyle = '#fffdf6'; c.fillRect(0, 0, 3.4 * U, 2.4 * U);
      c.fillStyle = '#a9e3f7'; c.fillRect(8, 8, 3.4 * U - 16, 2.4 * U - 16);
      c.fillStyle = '#fffdf6'; c.fillRect(1.7 * U - 3, 0, 6, 2.4 * U); c.fillRect(0, 1.2 * U - 3, 3.4 * U, 6);
      c.fillStyle = 'rgba(255,255,255,.6)';
      c.beginPath(); c.moveTo(20, 2.4 * U - 12); c.lineTo(50, 12); c.lineTo(70, 12); c.lineTo(40, 2.4 * U - 12); c.fill();
      c.strokeStyle = INK; c.lineWidth = LW; c.strokeRect(0, 0, 3.4 * U, 2.4 * U);
    });
    // posters on the left wall
    onWall(g, 'B', 8.6, 0, 4.6, (c) => {
      c.fillStyle = '#61bb46'; c.fillRect(0, 0, 1.5 * U, 2 * U);
      c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(1.05 * U, 0.45 * U, 0.2 * U, 0, 7); c.fill();
      c.fillStyle = '#1f5a1a';
      c.beginPath(); c.moveTo(0, 1.6 * U); c.lineTo(0.5 * U, 0.7 * U); c.lineTo(0.8 * U, 1.1 * U); c.lineTo(1.05 * U, 0.85 * U); c.lineTo(1.5 * U, 1.6 * U); c.fill();
      c.fillStyle = '#3a8a2e'; c.fillRect(0, 1.6 * U, 1.5 * U, 0.4 * U);
      c.strokeStyle = INK; c.lineWidth = LW; c.strokeRect(0, 0, 1.5 * U, 2 * U);
      c.fillStyle = '#e03a3e'; c.fillRect(1.8 * U, 0.5 * U, 1.3 * U, 1.3 * U);
      c.strokeRect(1.8 * U, 0.5 * U, 1.3 * U, 1.3 * U);
      c.fillStyle = '#ffe08a'; c.font = `700 ${0.75 * U}px ${PIXEL}`; c.textBaseline = 'middle'; c.textAlign = 'center';
      c.fillText('92', 2.45 * U, 1.17 * U); c.textAlign = 'left';
    });

    // rainbow sign on the back wall
    onWall(g, 'A', 3.6, 0, 5.7, (c) => {
      c.fillStyle = INK; c.fillRect(0, 0, 6.2 * U, 1.1 * U);
      const sz = 0.82 * U;
      c.font = `700 ${sz}px ${PIXEL}`;
      c.textBaseline = 'middle';
      const gr = c.createLinearGradient(0, 0.55 * U - sz * 0.38, 0, 0.55 * U + sz * 0.38);
      RAINBOW.forEach((col, i) => { gr.addColorStop(i / 6, col); gr.addColorStop((i + 1) / 6, col); });
      c.fillStyle = gr;
      c.fillText('InfoTEK', 0.45 * U, 0.58 * U);
    });

    // door on the back wall with the open / closed sign
    onWall(g, 'A', 10.6, 0, 3.6, (c) => {
      const w = 1.9 * U, h = 3.6 * U;
      c.fillStyle = '#6f3d18'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3a8a2e'; c.fillRect(8, 8, w - 16, h - 8);
      c.fillStyle = '#a9e3f7'; c.fillRect(16, 16, w - 32, 1.3 * U);
      c.fillStyle = '#61bb46'; c.fillRect(16, 1.3 * U + 30, w - 32, h - 1.3 * U - 46);
      c.fillStyle = shopOpen ? '#3a8a2e' : '#a3222a';
      c.fillRect(14, 0.62 * U, w - 28, 0.5 * U);
      c.strokeStyle = INK; c.lineWidth = LW; c.strokeRect(14, 0.62 * U, w - 28, 0.5 * U);
      c.fillStyle = '#fffdf6'; c.font = `700 ${0.27 * U}px ${PIXEL}`; c.textBaseline = 'middle'; c.textAlign = 'center';
      c.fillText(shopOpen ? 'OTWARTE' : 'ZAMKNIĘTE', w / 2, 0.88 * U); c.textAlign = 'left';
      c.fillStyle = '#e2e2ea'; c.beginPath(); c.arc(w - 18, 1.9 * U, 5, 0, 7); c.fill();
      c.strokeRect(0, 0, w, h);
    });
    faceZ(g, 10.6, 0.2, 0.03, 1.9, 1.1, '#a5622d');

    // plant by the door
    cuboid(g, 12.9, 0.6, 0, 0.7, 0.7, 0.8, C.orange);
    [[13.25, 0.95, 1.9, 0.5], [13.0, 0.8, 1.5, 0.45], [13.5, 1.1, 1.6, 0.42]].forEach(([x, y, z, r]) => {
      const [px, py] = P(x, y, z);
      g.beginPath(); g.ellipse(px, py, r * U, r * U * 0.8, 0, 0, 7);
      g.fillStyle = '#61bb46'; g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    });

    drawShelf(g);
    drawWorkbench(g, t);
    drawRack(g, t);
    // a hard disk on a stool
    cuboid(g, 2.9, 9.4, 0, 1.1, 1.1, 1.2, C.woodD);
    cuboid(g, 3.05, 9.55, 1.2, 0.8, 0.8, 0.12, C.metal);
    const [hx, hy] = P(3.45, 9.95, 1.33);
    g.beginPath(); g.ellipse(hx, hy, 0.42 * U, 0.21 * U, 0, 0, 7); g.fillStyle = '#e2e2ea'; g.fill(); g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(hx, hy, 0.08 * U, 0.04 * U, 0, 0, 7); g.fillStyle = INK; g.fill();
    shape(g, [P(3.15, 9.6, 1.33), P(3.3, 9.65, 1.33), P(3.45, 9.95, 1.33), P(3.35, 9.95, 1.33)], '#6a687e');
    drawCounter(g, t);
  }

  function drawShelf(g) {
    const x0 = 4, x1 = 9.2, d = 1.2;
    cuboid(g, x0 - 0.15, 0.05, 0, 0.15, d, 4.5, C.woodD);
    [0.02, 1.5, 3.0].forEach((z, level) => {
      cuboid(g, x0, 0.05, z, x1 - x0, d, 0.12, C.wood);
      let x = x0 + 0.2;
      for (let k = 0; k < 5; k++) {
        const w = 0.62 + ((k + level) % 3) * 0.12, h = 0.9 + ((k * 7 + level) % 4) * 0.12;
        if (x + w > x1 - 0.1) break;
        const col = RCOLS[(k + level * 2) % 6];
        cuboid(g, x, 0.25, z + 0.12, w, 0.85, h, col);
        faceY(g, x + 0.12, 1.1, z + 0.12 + h * 0.3, w - 0.24, h * 0.42, '#fffdf6');
        x += w + 0.22;
      }
    });
    cuboid(g, x0, 0.05, 4.4, x1 - x0, d, 0.12, C.wood);
    cuboid(g, x1, 0.05, 0, 0.15, d, 4.52, C.woodD);
  }

  function drawWorkbench(g, t) {
    // legs, then the top
    cuboid(g, 0.3, 1.2, 0, 0.2, 0.2, 1.5, C.woodD);
    cuboid(g, 2.3, 1.2, 0, 0.2, 0.2, 1.5, C.woodD);
    cuboid(g, 2.3, 6.4, 0, 0.2, 0.2, 1.5, C.woodD);
    cuboid(g, 0.2, 1, 1.5, 2.5, 5.8, 0.2, C.wood);
    // CRT monitor facing the room
    cuboid(g, 0.4, 1.4, 1.7, 1.5, 1.7, 1.5, C.beige);
    faceX(g, 1.9, 1.6, 1.85, 1.3, 1.15, '#c9bc9b');
    faceX(g, 1.9, 1.7, 1.95, 1.1, 0.95, '#0b3566');
    onWall(g, 'B', 2.7, 1.9, 2.8, (c) => {
      c.fillStyle = '#4cc0ea'; c.font = `700 ${0.26 * U}px ${PIXEL}`; c.textBaseline = 'top';
      c.fillText('C:\\>_', 0.12 * U, 0.1 * U);
      c.fillStyle = '#a9e3f7'; c.fillRect(0.12 * U, 0.45 * U, 0.7 * U, 4); c.fillRect(0.12 * U, 0.6 * U, 0.5 * U, 4);
    });
    cuboid(g, 2.0, 1.5, 1.7, 0.45, 1.5, 0.08, C.beige);
    // PC tower with the side panel off
    cuboid(g, 0.5, 3.5, 1.7, 1.3, 0.65, 1.7, C.beige);
    faceY(g, 0.58, 4.15, 1.8, 1.14, 1.5, '#1f5a1a');
    faceY(g, 0.72, 4.15, 2.6, 0.4, 0.4, '#a9a8bb');
    faceY(g, 1.2, 4.15, 2.0, 0.45, 0.18, '#fdb827', false);
    faceY(g, 1.2, 4.15, 2.3, 0.45, 0.12, '#e03a3e', false);
    faceX(g, 1.8, 3.6, 2.9, 0.4, 0.12, '#61bb46', false);
    // open laptop
    cuboid(g, 1.25, 4.9, 1.7, 0.95, 1.2, 0.06, C.dark);
    cuboid(g, 1.18, 4.9, 1.76, 0.07, 1.2, 0.85, C.dark);
    faceX(g, 1.25, 5.0, 1.85, 1.0, 0.68, '#009ddc');
    // screwdriver and a lava lamp at the end of the bench
    cuboid(g, 2.25, 4.4, 1.7, 0.1, 0.55, 0.08, C.red);
    lavaLamp(g, 1.2, 6.5, 1.7, t);
  }

  function lavaLamp(g, x, y, z, t) {
    cuboid(g, x - 0.25, y - 0.25, z, 0.5, 0.5, 0.25, C.metal);
    const [bx, by] = P(x, y, z + 0.25);
    const h = 1.25 * U, w = 0.26 * U;
    g.save();
    g.beginPath();
    g.moveTo(bx - w * 0.8, by);
    g.lineTo(bx + w * 0.8, by);
    g.quadraticCurveTo(bx + w * 1.4, by - h * 0.5, bx + w * 0.45, by - h);
    g.lineTo(bx - w * 0.45, by - h);
    g.quadraticCurveTo(bx - w * 1.4, by - h * 0.5, bx - w * 0.8, by);
    g.closePath();
    const gr = g.createLinearGradient(0, by - h, 0, by);
    gr.addColorStop(0, '#f58e90'); gr.addColorStop(0.7, '#f58e90'); gr.addColorStop(1, '#ffe08a');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = INK; g.lineWidth = LW; g.stroke();
    g.clip();
    [[0.32, 0], [0.23, 2.1], [0.41, 4]].forEach(([s, p], i) => {
      const yy = by - h * (0.5 + 0.38 * Math.sin(t * s + p));
      const r = w * (0.55 - i * 0.08);
      g.fillStyle = '#e03a3e';
      g.beginPath(); g.ellipse(bx + Math.sin(t * s * 1.7 + p) * w * 0.3, yy, r, r * 1.2, 0, 0, 7); g.fill();
    });
    g.restore();
    const [cx, cy] = P(x, y, z + 0.25);
    shape(g, [[cx - w * 0.45, cy - h], [cx + w * 0.45, cy - h], [cx + w * 0.3, cy - h - 10], [cx - w * 0.3, cy - h - 10]], '#a9a8bb');
  }

  function drawRack(g, t) {
    const x0 = 0.2, y0 = 9, w = 1.5, d = 2.6;
    cuboid(g, x0, y0, 0, 0.12, 0.12, 4, C.metal);
    [0.25, 1.3, 2.35, 3.4].forEach((z, level) => {
      cuboid(g, x0, y0, z, w, d, 0.08, C.metal);
      if (level < 3) {
        for (let k = 0; k < 3; k++) {
          const yy = y0 + 0.2 + k * 0.8;
          cuboid(g, x0 + 0.25, yy, z + 0.08, 1.0, 0.6, 0.35, C.dark);
          const blink = (Math.floor(t * 2 + k * 3 + level * 5) % 5) !== 0;
          faceX(g, x0 + 1.25, yy + 0.1, z + 0.18, 0.12, 0.1, blink ? '#61bb46' : '#4a3f55', false);
          faceX(g, x0 + 1.25, yy + 0.3, z + 0.18, 0.12, 0.1, level === 1 && k === 1 ? '#e03a3e' : '#4a3f55', false);
        }
      }
    });
    cuboid(g, x0 + w - 0.12, y0, 0, 0.12, 0.12, 3.48, C.metal);
    cuboid(g, x0 + w - 0.12, y0 + d - 0.12, 0, 0.12, 0.12, 3.48, C.metal);
  }

  function drawCounter(g, t) {
    cuboid(g, 5.6, 8, 0, 4.6, 1.5, 2.2, C.wood);
    RAINBOW.forEach((col, i) => faceY(g, 5.75, 9.5, 0.35 + (5 - i) * 0.22, 4.3, 0.2, col, false));
    cuboid(g, 5.45, 7.85, 2.2, 4.9, 1.8, 0.14, C.woodD);
    // till
    cuboid(g, 8.3, 8.1, 2.34, 1.4, 1.2, 0.45, C.beige);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) faceZ(g, 8.85 + c * 0.2, 8.3 + r * 0.28, 2.8, 0.13, 0.18, c === 3 ? '#e03a3e' : '#fffdf6', false);
    }
    cuboid(g, 8.45, 8.18, 2.79, 0.42, 0.05, 0.95, C.paper);
    faceY(g, 8.52, 8.23, 3.0, 0.28, 0.04, '#9e9070', false);
    faceY(g, 8.52, 8.23, 3.2, 0.28, 0.04, '#9e9070', false);
    faceY(g, 8.52, 8.23, 3.4, 0.2, 0.04, '#9e9070', false);
    cuboid(g, 9.5, 8.2, 2.79, 0.1, 0.1, 0.5, C.beige);
    cuboid(g, 9.35, 8.0, 3.29, 0.12, 0.55, 0.38, C.beige);
    faceX(g, 9.47, 8.07, 3.34, 0.42, 0.28, '#1f5a1a');
    // lava lamp on the counter, and a stack of floppies
    lavaLamp(g, 6.2, 8.6, 2.34, t + 3);
    [C.blue, C.red, C.yellow].forEach((col, i) => cuboid(g, 7.0 + i * 0.05, 8.4 - i * 0.04, 2.34 + i * 0.06, 0.7, 0.7, 0.06, col));
  }

  /* ============================================================
     Camera: one station per section, scroll picks the target
     ============================================================ */
  const STATIONS = [
    null,                       // overview, computed from the room bounds
    { p: [1.4, 3.6, 2.3], k: 2.3 },
    { p: [1.8, 10.2, 1.8], k: 2.3 },
    { p: [6.6, 0.6, 2.6], k: 2.0 },
    { p: [8.0, 8.6, 2.6], k: 2.3 },
    { p: [11.5, 0.2, 1.9], k: 2.3 },
  ];
  const ROOM = { x0: -Y * U, x1: X * U, y0: -H * U - 0.4 * U, y1: (X + Y) * U / 2 };

  const canvas = $('#shop');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const steps = $$('.step');
  const railLinks = $$('#rail a');
  railLinks[0].classList.add('is-active');
  let view = { W: 0, H: 0, px: 3, bw: 0, bh: 0, mobile: false };
  const cam = { x: 0, y: 0, z: 1 };
  let target = { x: 0, y: 0, z: 1 };
  let active = 0, t = 0, dirty = true;

  function stationTarget(i) {
    const { W, H, mobile } = view;
    const availW = mobile ? W * 0.94 : W * 0.5, availH = mobile ? H * 0.44 : H * 0.84;
    const fit = Math.min(availW / (ROOM.x1 - ROOM.x0), availH / (ROOM.y1 - ROOM.y0));
    if (!STATIONS[i]) return { x: (ROOM.x0 + ROOM.x1) / 2, y: (ROOM.y0 + ROOM.y1) / 2, z: fit };
    const [sx, sy] = P(...STATIONS[i].p);
    return { x: sx, y: sy, z: fit * STATIONS[i].k * (mobile ? 0.9 : 1) };
  }
  function anchor() {
    const { W, H, mobile } = view;
    return mobile ? [W / 2, H * 0.25] : [W * 0.7, H * 0.5];
  }

  function layout() {
    const W = canvas.parentElement.clientWidth, H = canvas.parentElement.clientHeight;
    const px = W >= 720 ? 3 : 2;
    const bw = Math.ceil(W / px), bh = Math.ceil(H / px);
    canvas.width = bw; canvas.height = bh;
    canvas.style.width = bw * px + 'px'; canvas.style.height = bh * px + 'px';
    view = { W, H, px, bw, bh, mobile: W < 860 };
    target = stationTarget(active);
    Object.assign(cam, target);
    dirty = true;
  }

  function render() {
    const { bw, bh, px } = view;
    if (!bw || !bh) return;
    const [ax, ay] = anchor();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#efe8d6';
    ctx.fillRect(0, 0, bw, bh);
    const s = cam.z / px;
    ctx.setTransform(s, 0, 0, s, (ax - cam.x * cam.z) / px, (ay - cam.y * cam.z) / px);
    LW = Math.max(1.4, px * 1.05 / cam.z);
    drawShop(ctx, t);
    // a bouncing pointer above the current station
    if (STATIONS[active]) {
      const [mx, my] = P(...STATIONS[active].p);
      const bob = Math.sin(t * 3) * 6 - 70 / Math.max(1, cam.z * 0.6);
      const r = 14 / Math.max(0.8, cam.z * 0.5);
      shape(ctx, [[mx - r, my + bob - r * 1.4], [mx + r, my + bob - r * 1.4], [mx, my + bob]], RAINBOW[(active + 2) % 6]);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, bw, bh);
    quantize(img, bw, bh);
    ctx.putImageData(img, 0, 0);
  }

  function pickActive() {
    const mid = window.innerHeight * 0.5;
    let best = 0;
    steps.forEach((s, i) => { if (s.getBoundingClientRect().top <= mid) best = i; });
    if (best !== active) {
      active = best;
      railLinks.forEach((a, i) => a.classList.toggle('is-active', i === active));
      target = stationTarget(active);
      if (reduceMotion) Object.assign(cam, target);
      dirty = true;
    }
  }

  let lastAnim = 0, running = false, stageVisible = true;
  function frame(now) {
    if (!stageVisible) { running = false; return; }
    pickActive();
    const k = 0.09;
    const dx = target.x - cam.x, dy = target.y - cam.y, dz = Math.log(target.z / cam.z);
    if (Math.abs(dx) + Math.abs(dy) > 0.3 || Math.abs(dz) > 0.002) {
      cam.x += dx * k; cam.y += dy * k; cam.z *= Math.exp(dz * k);
      dirty = true;
    } else if (dx || dy || dz) {
      Object.assign(cam, target);
    }
    if (!reduceMotion && now - lastAnim > 120) { t += 0.12; lastAnim = now; dirty = true; }
    if (dirty) { render(); dirty = false; }
    requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }
  new IntersectionObserver(([en]) => {
    stageVisible = en.isIntersecting;
    $('#rail').classList.toggle('is-hidden', !stageVisible);
    if (stageVisible) start();
  }).observe($('.story'));

  let resizeT, lastW = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const w = document.documentElement.clientWidth;
      if (w === lastW && view.mobile) return; // ignore toolbar height changes on phones
      lastW = w;
      layout();
      render();
    }, 120);
  });
  window.addEventListener('scroll', () => { if (reduceMotion) { pickActive(); if (dirty) render(); } }, { passive: true });

  const fontsReady = document.fonts
    ? Promise.all([document.fonts.load(`700 20px ${PIXEL}`), document.fonts.ready]).catch(() => {})
    : Promise.resolve();
  fontsReady.then(() => {
    lastW = document.documentElement.clientWidth;
    pickActive();
    layout();
    render();
    start();
  });

  /* ============================================================
     Opening hours (Warsaw time)
     ============================================================ */
  const HOURS = { 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [9, 17], 6: [10, 13] };
  const DAY_NAMES = ['w niedzielę', 'w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę'];
  function warsawNow() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (k) => parts.find((p) => p.type === k).value;
    return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')), mins: +get('hour') * 60 + +get('minute') };
  }
  function updateHours() {
    const { day, mins } = warsawNow();
    const today = HOURS[day];
    const open = !!today && mins >= today[0] * 60 && mins < today[1] * 60;
    let when = '', at = 0;
    if (!open) {
      for (let k = 0; k < 8; k++) {
        const d = (day + k) % 7, hrs = HOURS[d];
        if (hrs && (k > 0 || mins < hrs[0] * 60)) { when = k === 0 ? 'dziś' : k === 1 ? 'jutro' : DAY_NAMES[d]; at = hrs[0]; break; }
      }
    }
    if (open !== shopOpen) { shopOpen = open; dirty = true; }
    $('#status').textContent = open ? 'Otwarte' : 'Zamknięte';
    $('#status').className = 'top__status ' + (open ? 'is-open' : 'is-closed');
    $('#openNow').textContent = open ? `Teraz otwarte, do ${today[1]}:00. Można przyjść bez umawiania.` : `Teraz zamknięte. Otwieramy ${when} o ${at}:00.`;
    $$('.hours tr').forEach((tr) => tr.classList.toggle('is-today', tr.dataset.days.split(',').includes(String(day))));
  }
  updateHours();
  setInterval(updateHours, 30000);

  /* ============================================================
     Mobile menu
     ============================================================ */
  const menuBtn = $('.top__menu');
  menuBtn.addEventListener('click', () => {
    const open = menuBtn.getAttribute('aria-expanded') !== 'true';
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  });
  $$('#nav a').forEach((a) => a.addEventListener('click', () => {
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  }));
})();
