(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

  /* ============================================================
     Pixel-art renderer
     A scene is drawn with ordinary canvas shapes into a small
     buffer (one buffer pixel = several screen pixels), then every
     pixel is snapped to a fixed palette with 4x4 ordered dithering,
     the way 80s machines faked gradients. The canvas is scaled up
     with nearest-neighbour, so the pixels stay square and sharp.
     ============================================================ */
  const PALETTE = [
    '#231a2b', '#4a3f55', '#fffdf6',
    '#f4eedd', '#e3d9c0', '#c9bc9b', '#9e9070', '#6e6450',              // platinum beige
    '#f2b877', '#d18a4b', '#a5622d', '#6f3d18',                         // wood
    '#a8dc8f', '#61bb46', '#3a8a2e', '#1f5a1a',                         // green
    '#ffe08a', '#fdb827', '#c98d10',                                    // yellow
    '#ffb072', '#f5821f', '#b85a10',                                    // orange
    '#f58e90', '#e03a3e', '#a3222a',                                    // red
    '#efdcf3', '#d6b0de', '#b07ab8', '#963d97', '#5f2463',              // purple
    '#a9e3f7', '#4cc0ea', '#009ddc', '#0a62a0', '#0b3566',              // blue
    '#e2e2ea', '#a9a8bb', '#6a687e',                                    // metal
  ].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.47) * 30);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function quantize(img, w, h) {
    const d = img.data;
    const cache = new Map();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        const t = BAYER[(y & 3) * 4 + (x & 3)];
        const r = d[p] + t, g = d[p + 1] + t, b = d[p + 2] + t;
        const key = ((r >> 3) << 12) | ((g >> 3) << 6) | (b >> 3);
        let c = cache.get(key);
        if (!c) {
          let best = 0, bd = Infinity;
          for (let i = 0; i < PALETTE.length; i++) {
            const q = PALETTE[i];
            const dr = r - q[0], dg = g - q[1], db = b - q[2];
            const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
            if (dist < bd) { bd = dist; best = i; }
          }
          c = PALETTE[best];
          cache.set(key, c);
        }
        d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      }
    }
  }

  class PixelView {
    constructor(canvas, opts) {
      this.c = canvas;
      this.o = opts;
      this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
    layout() {
      const o = this.o;
      const W = this.c.parentElement.clientWidth;
      const H = Math.round(o.height(W));
      const px = o.px(W);
      const bw = Math.ceil(W / px), bh = Math.ceil(H / px);
      this.c.width = bw;
      this.c.height = bh;
      this.c.style.width = bw * px + 'px';
      this.c.style.height = bh * px + 'px';
      const [ww, wh] = o.world;
      const k = o.fit === 'cover' ? Math.max(W / ww, H / wh) : Math.min(W / ww, H / wh);
      const vw = W / k, vh = H / k;
      let x0 = o.focus[0] - vw / 2, y0 = o.focus[1] - vh / 2;
      x0 = vw <= ww ? clamp(x0, 0, ww - vw) : (ww - vw) / 2;
      y0 = vh <= wh ? clamp(y0, 0, wh - vh) : (wh - vh) / 2;
      Object.assign(this, { bw, bh, s: k / px, x0, y0 });
    }
    render(t) {
      const { ctx: g, bw, bh, s, x0, y0 } = this;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = this.o.bg || '#fffdf6';
      g.fillRect(0, 0, bw, bh);
      g.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
      this.o.draw(g, t);
      g.setTransform(1, 0, 0, 1, 0, 0);
      const img = g.getImageData(0, 0, bw, bh);
      quantize(img, bw, bh);
      g.putImageData(img, 0, 0);
    }
  }

  /* ============================================================
     Drawing helpers
     ============================================================ */
  const INK = '#231a2b';
  const lin = (g, x0, y0, x1, y1, stops) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  };
  const rr = (g, x, y, w, h, r) => {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  };
  const poly = (g, pts) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  const outline = (g, w) => { g.strokeStyle = INK; g.lineWidth = w || 9; g.stroke(); };
  const glow = (g, x, y, r, c) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, c);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  };

  function floppy(g, x, y, s, col, rot, label) {
    g.save();
    g.translate(x + s / 2, y + s / 2);
    g.rotate(rot || 0);
    g.translate(-s / 2, -s / 2);
    poly(g, [[0, 0], [s * 0.88, 0], [s, s * 0.12], [s, s], [0, s]]);
    g.fillStyle = col;
    g.fill();
    outline(g, 7);
    g.fillStyle = '#e2e2ea';
    g.fillRect(s * 0.26, 0, s * 0.46, s * 0.36);
    g.fillStyle = '#6a687e';
    g.fillRect(s * 0.52, s * 0.05, s * 0.1, s * 0.24);
    g.fillStyle = '#fffdf6';
    g.fillRect(s * 0.12, s * 0.5, s * 0.76, s * 0.44);
    g.fillStyle = label || '#9e9070';
    g.fillRect(s * 0.18, s * 0.62, s * 0.5, s * 0.07);
    g.fillStyle = '#c9bc9b';
    g.fillRect(s * 0.18, s * 0.78, s * 0.6, s * 0.05);
    g.restore();
  }
  function tape(g, x, y) {
    g.fillStyle = 'rgba(255, 253, 246, .85)';
    g.fillRect(x - 12, y - 10, 30, 22);
  }
  function poster(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
    g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(x, y, w, h);
  }
  // the CRT shows a small window, like the ones on this page
  function miniWindow(g, x, y, w, h) {
    g.fillStyle = '#fffdf6';
    g.fillRect(x, y, w, h);
    g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(x, y, w, h);
    g.fillStyle = INK;
    g.fillRect(x, y + 34, w, 5);
    const stripes = ['#61bb46', '#fdb827', '#f5821f', '#e03a3e', '#963d97', '#009ddc'];
    stripes.forEach((c, i) => { g.fillStyle = c; g.fillRect(x + 8, y + 6 + i * 4.4, w - 16, 4.4); });
    g.fillStyle = '#fffdf6';
    g.fillRect(x + w / 2 - 66, y + 5, 132, 28);
  }

  /* ============================================================
     Scene 1: the desk (world 1600 x 900)
     ============================================================ */
  function drawRoom(g, t) {
    // wall, purple like the reference
    g.fillStyle = lin(g, 0, -300, 0, 610, [[0, '#efdcf3'], [1, '#c99bd2']]);
    g.fillRect(-2000, -1000, 5600, 1612);
    g.fillStyle = lin(g, -200, 0, 900, 0, [[0, 'rgba(150, 61, 151, .45)'], [1, 'rgba(150, 61, 151, 0)']]);
    g.fillRect(-2000, -1000, 2900, 1612);

    // posters in the six colours
    poster(g, 140, 70, 240, 300, '#61bb46');
    g.fillStyle = '#ffe08a';
    g.beginPath(); g.arc(300, 140, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1f5a1a';
    poly(g, [[143, 330], [215, 190], [262, 262], [300, 210], [377, 330]]); g.fill();
    g.fillStyle = '#3a8a2e';
    g.fillRect(143, 330, 234, 37);
    tape(g, 140, 70); tape(g, 380, 70); tape(g, 140, 370); tape(g, 380, 370);

    poster(g, 300, 410, 170, 175, '#e03a3e');
    g.fillStyle = '#ffe08a';
    g.font = `700 112px ${MONO}`;
    g.textBaseline = 'alphabetic';
    g.fillText('92', 316, 540);
    tape(g, 300, 410); tape(g, 470, 410);

    poster(g, 1170, 56, 230, 150, '#fdb827');
    g.fillStyle = INK;
    g.font = `700 64px ${MONO}`;
    g.fillText('C:\\>', 1190, 158);
    tape(g, 1170, 56); tape(g, 1400, 56);

    const flick = 1 + 0.06 * Math.sin(t * 6.3) + 0.03 * Math.sin(t * 13.7);
    glow(g, 1362, 420, 300, `rgba(255, 190, 210, ${0.55 * flick})`);

    // desk
    g.fillStyle = lin(g, 0, 610, 0, 900, [[0, '#f2b877'], [0.55, '#d18a4b'], [1, '#a5622d']]);
    g.fillRect(-2000, 610, 5600, 420);
    g.fillStyle = '#6f3d18';
    g.fillRect(-2000, 602, 5600, 10);
    g.strokeStyle = '#a5622d';
    g.lineWidth = 6;
    for (let i = 0; i < 9; i++) {
      const y0 = 650 + i * 28;
      g.beginPath();
      for (let x = -2000; x <= 3600; x += 40) {
        const y = y0 + Math.sin(x * 0.006 + i * 1.7) * 6 + Math.sin(x * 0.021 + i) * 2;
        if (x === -2000) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    glow(g, 1362, 650, 300, `rgba(255, 200, 170, ${0.35 * flick})`);

    floppy(g, 200, 668, 96, '#009ddc', -0.16, '#e03a3e');
    floppy(g, 318, 712, 96, '#e03a3e', 0.12, '#009ddc');

    drawMonitor(g);
    drawKeyboard(g);
    drawMouse(g);
    drawLamp(g, t);
  }

  function drawMonitor(g) {
    rr(g, 500, 120, 632, 456, 24);
    g.fillStyle = lin(g, 500, 120, 1132, 576, [[0, '#f4eedd'], [0.55, '#e3d9c0'], [1, '#c9bc9b']]);
    g.fill();
    outline(g);
    g.fillStyle = '#c9bc9b';
    g.fillRect(1050, 146, 62, 404);
    g.fillStyle = '#6e6450';
    for (let y = 172; y < 520; y += 24) g.fillRect(1060, y, 42, 8);
    rr(g, 538, 150, 496, 368, 18);
    g.fillStyle = '#c9bc9b';
    g.fill();
    outline(g, 5);
    rr(g, 568, 176, 436, 312, 34);
    const gr = g.createRadialGradient(786, 320, 20, 786, 332, 300);
    gr.addColorStop(0, '#4cc0ea');
    gr.addColorStop(0.7, '#009ddc');
    gr.addColorStop(1, '#0a62a0');
    g.fillStyle = gr;
    g.fill();
    outline(g, 6);
    miniWindow(g, 630, 226, 312, 206);
    g.fillStyle = INK;
    g.font = `700 50px ${MONO}`;
    g.fillText('InfoTEK', 676, 322);
    g.font = `400 26px ${MONO}`;
    g.fillText('Nowa Ruda 1992', 678, 376);
    g.fillStyle = 'rgba(255, 255, 255, .25)';
    g.beginPath(); g.ellipse(640, 210, 50, 18, -0.4, 0, Math.PI * 2); g.fill();
    // label, buttons, power light
    g.fillStyle = '#9e9070';
    g.fillRect(560, 536, 120, 14);
    ['#61bb46', '#fdb827', '#f5821f', '#e03a3e', '#963d97', '#009ddc'].forEach((c, i) => { g.fillStyle = c; g.fillRect(694, 534 + i * 3, 22, 3); });
    g.fillStyle = '#9e9070';
    g.fillRect(906, 534, 30, 18);
    g.fillRect(946, 534, 30, 18);
    g.fillStyle = '#61bb46';
    g.beginPath(); g.arc(1006, 543, 9, 0, Math.PI * 2); g.fill();
    // stand
    g.fillStyle = '#c9bc9b';
    g.fillRect(742, 576, 150, 28);
    poly(g, [[700, 604], [934, 604], [978, 634], [656, 634]]);
    g.fillStyle = '#e3d9c0';
    g.fill();
    outline(g, 6);
    floppy(g, 590, 40, 84, '#fdb827', 0, '#963d97');
  }

  function drawKeyboard(g) {
    const top = 664, bot = 792;
    const xl = (y) => 562 + (y - top) / (bot - top) * -42;
    const xr = (y) => 1086 + (y - top) / (bot - top) * 40;
    poly(g, [[xl(top), top], [xr(top), top], [xr(bot + 16), bot + 16], [xl(bot + 16), bot + 16]]);
    g.fillStyle = '#9e9070';
    g.fill();
    poly(g, [[xl(top), top], [xr(top), top], [xr(bot), bot], [xl(bot), bot]]);
    g.fillStyle = lin(g, 0, top, 0, bot, [[0, '#e3d9c0'], [1, '#c9bc9b']]);
    g.fill();
    poly(g, [[xl(top), top], [xr(top), top], [xr(bot + 16), bot + 16], [xl(bot + 16), bot + 16]]);
    outline(g, 6);
    for (let r = 0; r < 5; r++) {
      const y = top + 10 + r * 23, h = 18;
      const x0 = xl(y) + 14, x1 = xr(y) - 14;
      const keys = r === 4 ? [1, 1, 1.4, 6, 1.4, 1, 1] : Array(14).fill(1);
      const total = keys.reduce((a, b) => a + b, 0);
      const u = (x1 - x0) / total;
      let x = x0 + (r === 1 ? u * 0.3 : r === 2 ? u * 0.6 : 0);
      keys.forEach((kw) => {
        const w = kw * u - 6;
        if (x + w > x1 + 1) return;
        g.fillStyle = '#fffdf6';
        g.fillRect(x, y, w, h - 5);
        g.fillStyle = '#9e9070';
        g.fillRect(x, y + h - 5, w, 5);
        x += kw * u;
      });
    }
  }

  function drawMouse(g) {
    g.strokeStyle = INK;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(1222, 690);
    g.bezierCurveTo(1230, 640, 1150, 660, 1096, 650);
    g.stroke();
    g.beginPath();
    g.ellipse(1222, 738, 36, 50, 0, 0, Math.PI * 2);
    g.fillStyle = lin(g, 1186, 690, 1258, 790, [[0, '#f4eedd'], [1, '#c9bc9b']]);
    g.fill();
    outline(g, 6);
    g.fillStyle = '#6e6450';
    g.fillRect(1188, 722, 68, 5);
    g.fillRect(1220, 692, 5, 32);
  }

  const BLOBS = [
    { r: 26, s: 0.32, p: 0.0, w: 14 },
    { r: 20, s: 0.23, p: 2.1, w: 18 },
    { r: 17, s: 0.41, p: 4.0, w: 10 },
    { r: 23, s: 0.19, p: 5.2, w: 16 },
  ];
  function lampGlass(g, cx) {
    g.beginPath();
    g.moveTo(cx - 24, 300);
    g.lineTo(cx + 24, 300);
    g.quadraticCurveTo(cx + 66, 420, cx + 56, 478);
    g.lineTo(cx + 40, 522);
    g.lineTo(cx - 40, 522);
    g.lineTo(cx - 56, 478);
    g.quadraticCurveTo(cx - 66, 420, cx - 24, 300);
    g.closePath();
  }
  function drawLamp(g, t) {
    const cx = 1362;
    poly(g, [[cx - 40, 520], [cx + 40, 520], [cx + 78, 640], [cx - 78, 640]]);
    g.fillStyle = lin(g, cx - 78, 0, cx + 78, 0, [[0, '#6a687e'], [0.3, '#e2e2ea'], [0.6, '#a9a8bb'], [1, '#6a687e']]);
    g.fill();
    outline(g, 6);
    lampGlass(g, cx);
    g.fillStyle = lin(g, 0, 300, 0, 522, [[0, '#f58e90'], [0.55, '#f58e90'], [1, '#ffe08a']]);
    g.fill();
    g.save();
    lampGlass(g, cx);
    g.clip();
    BLOBS.forEach((b) => {
      const y = 412 + Math.sin(t * b.s + b.p) * 92;
      const x = cx + Math.sin(t * b.s * 1.7 + b.p) * b.w;
      const ry = b.r * (1 + 0.25 * Math.cos(t * b.s + b.p));
      g.fillStyle = '#e03a3e';
      g.beginPath(); g.ellipse(x, y, b.r, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f5821f';
      g.beginPath(); g.ellipse(x - b.r * 0.25, y - ry * 0.3, b.r * 0.4, ry * 0.35, 0, 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = '#e03a3e';
    g.beginPath(); g.ellipse(cx, 522, 48, 20, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255, 255, 255, .55)';
    g.fillRect(cx - 40, 345, 7, 110);
    g.restore();
    lampGlass(g, cx);
    outline(g, 6);
    poly(g, [[cx - 18, 268], [cx + 18, 268], [cx + 26, 302], [cx - 26, 302]]);
    g.fillStyle = lin(g, cx - 26, 0, cx + 26, 0, [[0, '#6a687e'], [0.4, '#e2e2ea'], [1, '#6a687e']]);
    g.fill();
    outline(g, 6);
  }

  /* ============================================================
     Scene 2: cash register (world 640 x 420)
     ============================================================ */
  function drawRegister(g) {
    g.fillStyle = lin(g, 0, 0, 0, 300, [[0, '#fffdf6'], [1, '#efdcf3']]);
    g.fillRect(-400, -400, 1440, 700);
    g.fillStyle = lin(g, 0, 300, 0, 420, [[0, '#f2b877'], [1, '#d18a4b']]);
    g.fillRect(-400, 300, 1440, 400);
    g.fillStyle = '#6f3d18';
    g.fillRect(-400, 294, 1440, 8);

    g.save();
    g.translate(220, 210);
    g.rotate(-0.05);
    g.fillStyle = '#fffdf6';
    g.fillRect(-56, -190, 112, 196);
    g.strokeStyle = INK; g.lineWidth = 5; g.strokeRect(-56, -190, 112, 196);
    g.fillStyle = '#6e6450';
    for (let i = 0; i < 7; i++) g.fillRect(-40, -166 + i * 22, i % 3 === 2 ? 50 : 80, 7);
    g.restore();

    poly(g, [[120, 218], [540, 218], [580, 352], [80, 352]]);
    g.fillStyle = lin(g, 80, 218, 580, 352, [[0, '#f4eedd'], [1, '#c9bc9b']]);
    g.fill();
    outline(g, 5);
    g.fillStyle = '#9e9070';
    g.fillRect(80, 352, 500, 30);
    g.strokeStyle = INK; g.lineWidth = 5; g.strokeRect(80, 352, 500, 30);
    g.fillStyle = '#6e6450';
    g.fillRect(300, 362, 70, 8);
    rr(g, 140, 196, 170, 40, 8);
    g.fillStyle = '#e3d9c0';
    g.fill();
    outline(g, 5);
    g.fillStyle = INK;
    g.fillRect(162, 203, 120, 7);
    const keyCols = ['#fffdf6', '#fffdf6', '#fffdf6', '#fffdf6', '#e03a3e'];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        const y = 250 + r * 24;
        const x = 340 + c * 40 + r * 6;
        g.fillStyle = r === 0 && c === 4 ? '#61bb46' : keyCols[c];
        g.fillRect(x, y, 30, 16);
        g.fillStyle = '#9e9070';
        g.fillRect(x, y + 16, 30, 5);
      }
    }
    g.fillStyle = '#c9bc9b';
    g.fillRect(468, 150, 26, 70);
    rr(g, 420, 64, 128, 92, 10);
    g.fillStyle = '#e3d9c0';
    g.fill();
    outline(g, 5);
    rr(g, 432, 76, 104, 62, 6);
    g.fillStyle = '#1f5a1a';
    g.fill();
    g.fillStyle = '#a8dc8f';
    g.font = `700 36px ${MONO}`;
    g.fillText('0,00', 444, 120);
  }

  /* ============================================================
     Scene 3: wordmark in the six colours (world 1100 x 240)
     ============================================================ */
  function drawWordmark(g) {
    g.font = `700 230px ${MONO}`;
    g.textBaseline = 'alphabetic';
    g.fillStyle = INK;
    g.fillText('InfoTEK', 30, 206);
    const bands = ['#61bb46', '#fdb827', '#f5821f', '#e03a3e', '#963d97', '#009ddc'];
    const gr = g.createLinearGradient(0, 46, 0, 196);
    bands.forEach((c, i) => { gr.addColorStop(i / 6, c); gr.addColorStop((i + 1) / 6, c); });
    g.fillStyle = gr;
    g.fillText('InfoTEK', 18, 194);
  }

  /* ============================================================
     Views
     ============================================================ */
  const room = new PixelView($('#room'), {
    world: [1600, 900],
    focus: [860, 450],
    fit: 'cover',
    draw: drawRoom,
    px: (w) => (w >= 560 ? 3 : 2),
    height: (w) => (w >= 560 ? clamp(w * 0.62, 360, 520) : w * 0.8),
  });
  const register = new PixelView($('#register'), {
    world: [640, 420], focus: [330, 210], fit: 'contain', draw: drawRegister,
    px: (w) => (w >= 420 ? 3 : 2),
    height: (w) => w * 420 / 640,
  });
  const wordmark = new PixelView($('#wordmark'), {
    world: [1100, 240], focus: [550, 120], fit: 'contain', draw: drawWordmark,
    px: (w) => (w >= 700 ? 4 : 3),
    height: (w) => w * 240 / 1100,
  });

  let t = 0, timer = null, heroVisible = true;
  function layoutAll() {
    [room, register, wordmark].forEach((v) => v.layout());
    room.render(t);
    register.render(0);
    wordmark.render(0);
  }
  function animate() {
    if (reduceMotion || timer) return;
    timer = setInterval(() => {
      if (!heroVisible || document.hidden) return;
      t += 0.12;
      room.render(t);
    }, 120);
  }
  new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe($('#heroArt'));

  let resizeT, lastW = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const w = document.documentElement.clientWidth;
      if (w === lastW) return; // ignore height-only changes from mobile toolbars
      lastW = w;
      layoutAll();
    }, 150);
  });

  const fontsReady = document.fonts
    ? document.fonts.load(`700 12px ${MONO}`).catch(() => {})
    : Promise.resolve();
  fontsReady.then(() => {
    lastW = document.documentElement.clientWidth;
    layoutAll();
    animate();
  });

  /* ============================================================
     Clock and opening hours (Warsaw time)
     ============================================================ */
  const HOURS = { 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [9, 17], 6: [10, 13] };
  const DAY_NAMES = ['w niedzielę', 'w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę'];
  const pad = (n) => String(n).padStart(2, '0');
  function warsawNow() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (k) => parts.find((p) => p.type === k).value;
    const h = +get('hour'), m = +get('minute');
    return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')), h, m, mins: h * 60 + m };
  }
  function updateHours() {
    const { day, h, m, mins } = warsawNow();
    const today = HOURS[day];
    const open = !!today && mins >= today[0] * 60 && mins < today[1] * 60;
    let text, short;
    if (open) {
      text = `Teraz otwarte, do ${today[1]}:00.`;
      short = `otwarte do ${today[1]}:00`;
    } else {
      for (let k = 0; k < 8; k++) {
        const d = (day + k) % 7, hrs = HOURS[d];
        if (hrs && (k > 0 || mins < hrs[0] * 60)) {
          const when = k === 0 ? 'dziś' : k === 1 ? 'jutro' : DAY_NAMES[d];
          text = `Teraz zamknięte. Otwieramy ${when} o ${hrs[0]}:00.`;
          short = `zamknięte, otwieramy ${when} o ${hrs[0]}:00`;
          break;
        }
      }
    }
    $('#clock').textContent = `${pad(h)}:${pad(m)}`;
    $('#status').textContent = open ? 'Otwarte' : 'Zamknięte';
    $('#status').className = 'status ' + (open ? 'is-open' : 'is-closed');
    $('#nowShort').textContent = short;
    $('#openNow').textContent = text;
    $$('.hours tr').forEach((tr) => tr.classList.toggle('is-today', tr.dataset.days.split(',').includes(String(day))));
  }
  updateHours();
  setInterval(updateHours, 30000);

  /* ============================================================
     Mobile menu
     ============================================================ */
  const menuBtn = $('.menubar__menu');
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
