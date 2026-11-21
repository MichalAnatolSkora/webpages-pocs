(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const INK = '#231a2b';
  const RAINBOW = ['#61bb46', '#fdb827', '#f5821f', '#e03a3e', '#963d97', '#009ddc'];

  /* ============================================================
     Pixel renderer
     Every section has a canvas behind its content. The scene is
     drawn in CSS pixels around the real page elements (their
     positions are measured), into a buffer that is 2-3x smaller,
     snapped to the palette with 4x4 ordered dithering and scaled
     back up with nearest-neighbour. So the text stays HTML and the
     room stays pixel art.
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
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.47) * 28);
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

  class Band {
    constructor(section, scene) {
      this.sec = section;
      this.scene = scene;
      this.c = $('canvas.bg', section);
      this.ctx = this.c.getContext('2d', { willReadFrequently: true });
    }
    layout() {
      const W = this.sec.clientWidth, H = this.sec.clientHeight;
      if (!W || !H) return false;
      const px = W >= 720 ? 3 : 2;
      const bw = Math.ceil(W / px), bh = Math.ceil(H / px);
      this.c.width = bw;
      this.c.height = bh;
      this.c.style.width = bw * px + 'px';
      this.c.style.height = bh * px + 'px';
      const sr = this.sec.getBoundingClientRect();
      const rel = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
      };
      const one = (sel) => { const el = $(sel, this.sec); return el ? rel(el) : null; };
      const all = (sel) => $$(sel, this.sec).map(rel);
      Object.assign(this, { W, H, px, bw, bh, data: this.scene.prep({ one, all, W, H }) });
      return true;
    }
    render(t) {
      if (!this.data) return;
      const { ctx: g, bw, bh, px, W, H } = this;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#fffdf6';
      g.fillRect(0, 0, bw, bh);
      g.setTransform(1 / px, 0, 0, 1 / px, 0, 0);
      this.scene.draw(g, t, W, H, this.data, px);
      g.setTransform(1, 0, 0, 1, 0, 0);
      const img = g.getImageData(0, 0, bw, bh);
      quantize(img, bw, bh);
      g.putImageData(img, 0, 0);
    }
  }

  /* ============================================================
     Drawing helpers (all in CSS pixels)
     ============================================================ */
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
  const ink = (g, w) => { g.strokeStyle = INK; g.lineWidth = w || 4; g.stroke(); };
  const box = (g, x, y, w, h, fill, lw) => {
    g.fillStyle = fill; g.fillRect(x, y, w, h);
    g.strokeStyle = INK; g.lineWidth = lw || 4; g.strokeRect(x, y, w, h);
  };
  const hash = (x, y) => {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  };
  const glow = (g, x, y, r, c) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, c);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  };

  function wallpaper(g, W, H, a, b) {
    g.fillStyle = lin(g, 0, 0, W, 0, [[0, a], [1, b]]);
    g.fillRect(0, 0, W, H);
  }
  function stripes(g, x0, x1, y0, y1, c, step) {
    g.fillStyle = c;
    for (let x = x0; x < x1; x += step) g.fillRect(x, y0, step / 2, y1 - y0);
  }
  function woodTop(g, y0, W, H) {
    g.fillStyle = lin(g, 0, y0, 0, H, [[0, '#f2b877'], [0.5, '#d18a4b'], [1, '#a5622d']]);
    g.fillRect(0, y0, W, H - y0);
    g.fillStyle = '#6f3d18';
    g.fillRect(0, y0 - 4, W, 8);
    g.strokeStyle = '#a5622d';
    g.lineWidth = 4;
    for (let i = 0; y0 + 30 + i * 34 < H; i++) {
      const yy = y0 + 30 + i * 34;
      g.beginPath();
      for (let x = -20; x <= W + 40; x += 30) {
        const y = yy + Math.sin(x * 0.008 + i * 1.7) * 5 + Math.sin(x * 0.03 + i) * 2;
        if (x === -20) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  function floppy(g, x, y, s, col, rot, label) {
    g.save();
    g.translate(x + s / 2, y + s / 2);
    g.rotate(rot || 0);
    g.translate(-s / 2, -s / 2);
    poly(g, [[0, 0], [s * 0.88, 0], [s, s * 0.12], [s, s], [0, s]]);
    g.fillStyle = col;
    g.fill();
    ink(g, 4);
    g.fillStyle = '#e2e2ea';
    g.fillRect(s * 0.26, 2, s * 0.46, s * 0.36);
    g.fillStyle = '#6a687e';
    g.fillRect(s * 0.52, s * 0.06, s * 0.1, s * 0.24);
    g.fillStyle = '#fffdf6';
    g.fillRect(s * 0.12, s * 0.5, s * 0.76, s * 0.44);
    g.fillStyle = label || '#e03a3e';
    g.fillRect(s * 0.18, s * 0.6, s * 0.52, s * 0.08);
    g.fillStyle = '#c9bc9b';
    g.fillRect(s * 0.18, s * 0.76, s * 0.6, s * 0.06);
    g.restore();
  }
  function tape(g, x, y) {
    g.fillStyle = 'rgba(255, 253, 246, .85)';
    g.fillRect(x - 10, y - 8, 24, 16);
  }

  /* ============================================================
     Scene: the desk with the monitor (hero)
     ============================================================ */
  const BLOBS = [
    { r: 0.11, s: 0.32, p: 0.0, w: 0.05 },
    { r: 0.085, s: 0.23, p: 2.1, w: 0.07 },
    { r: 0.07, s: 0.41, p: 4.0, w: 0.04 },
    { r: 0.095, s: 0.19, p: 5.2, w: 0.06 },
  ];
  function lavaLamp(g, cx, base, h, t) {
    const u = h / 380;
    const top = base - h;
    const gy0 = top + 34 * u, gy1 = base - 120 * u;
    const glass = () => {
      g.beginPath();
      g.moveTo(cx - 26 * u, gy0);
      g.lineTo(cx + 26 * u, gy0);
      g.quadraticCurveTo(cx + 70 * u, gy0 + (gy1 - gy0) * 0.55, cx + 60 * u, gy1 - 46 * u);
      g.lineTo(cx + 42 * u, gy1);
      g.lineTo(cx - 42 * u, gy1);
      g.lineTo(cx - 60 * u, gy1 - 46 * u);
      g.quadraticCurveTo(cx - 70 * u, gy0 + (gy1 - gy0) * 0.55, cx - 26 * u, gy0);
      g.closePath();
    };
    const flick = 1 + 0.06 * Math.sin(t * 6.3) + 0.03 * Math.sin(t * 13.7);
    glow(g, cx, (gy0 + gy1) / 2, 220 * u + 60, `rgba(255, 200, 215, ${0.5 * flick})`);
    // base
    poly(g, [[cx - 42 * u, gy1], [cx + 42 * u, gy1], [cx + 84 * u, base], [cx - 84 * u, base]]);
    g.fillStyle = lin(g, cx - 84 * u, 0, cx + 84 * u, 0, [[0, '#6a687e'], [0.3, '#e2e2ea'], [0.6, '#a9a8bb'], [1, '#6a687e']]);
    g.fill();
    ink(g);
    // glass
    glass();
    g.fillStyle = lin(g, 0, gy0, 0, gy1, [[0, '#f58e90'], [0.6, '#f58e90'], [1, '#ffe08a']]);
    g.fill();
    g.save();
    glass();
    g.clip();
    const span = gy1 - gy0;
    BLOBS.forEach((b) => {
      const y = gy0 + span * (0.5 + 0.38 * Math.sin(t * b.s + b.p));
      const x = cx + Math.sin(t * b.s * 1.7 + b.p) * b.w * h;
      const r = b.r * h, ry = r * (1 + 0.25 * Math.cos(t * b.s + b.p));
      g.fillStyle = '#e03a3e';
      g.beginPath(); g.ellipse(x, y, r, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f5821f';
      g.beginPath(); g.ellipse(x - r * 0.25, y - ry * 0.3, r * 0.4, ry * 0.35, 0, 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = '#e03a3e';
    g.beginPath(); g.ellipse(cx, gy1, 50 * u, 20 * u, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255, 255, 255, .6)';
    g.fillRect(cx - 44 * u, gy0 + span * 0.2, 7 * u + 2, span * 0.45);
    g.restore();
    glass();
    ink(g);
    // cap
    poly(g, [[cx - 18 * u, top], [cx + 18 * u, top], [cx + 28 * u, gy0], [cx - 28 * u, gy0]]);
    g.fillStyle = lin(g, cx - 28 * u, 0, cx + 28 * u, 0, [[0, '#6a687e'], [0.4, '#e2e2ea'], [1, '#6a687e']]);
    g.fill();
    ink(g);
  }

  function keyboard(g, cx, y, w, h) {
    const x0 = cx - w / 2, x1 = cx + w / 2, inset = w * 0.035;
    poly(g, [[x0 + inset, y], [x1 - inset, y], [x1, y + h + 12], [x0, y + h + 12]]);
    g.fillStyle = '#9e9070';
    g.fill();
    poly(g, [[x0 + inset, y], [x1 - inset, y], [x1, y + h], [x0, y + h]]);
    g.fillStyle = lin(g, 0, y, 0, y + h, [[0, '#e3d9c0'], [1, '#c9bc9b']]);
    g.fill();
    poly(g, [[x0 + inset, y], [x1 - inset, y], [x1, y + h + 12], [x0, y + h + 12]]);
    ink(g);
    const rows = 5, rh = (h - 16) / rows;
    for (let r = 0; r < rows; r++) {
      const ky = y + 8 + r * rh;
      const f = (ky - y) / h;
      const lx = x0 + inset * (1 - f) + 12, rx = x1 - inset * (1 - f) - 12;
      const keys = r === 4 ? [1, 1, 1.4, 6, 1.4, 1, 1] : Array(14).fill(1);
      const total = keys.reduce((a, b) => a + b, 0);
      const u = (rx - lx) / total;
      let x = lx + (r === 1 ? u * 0.3 : r === 2 ? u * 0.6 : 0);
      keys.forEach((kw) => {
        const kwpx = kw * u - 5;
        if (x + kwpx > rx + 1) return;
        g.fillStyle = '#fffdf6';
        g.fillRect(x, ky, kwpx, rh - 6);
        g.fillStyle = '#9e9070';
        g.fillRect(x, ky + rh - 6, kwpx, 4);
        x += kw * u;
      });
    }
  }

  function mouse(g, x, y, s) {
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x, y - s * 0.9);
    g.bezierCurveTo(x + 10, y - s * 2, x - s * 1.6, y - s * 1.4, x - s * 2.6, y - s * 1.6);
    g.stroke();
    g.beginPath();
    g.ellipse(x, y, s * 0.7, s, 0, 0, Math.PI * 2);
    g.fillStyle = lin(g, x - s, y - s, x + s, y + s, [[0, '#f4eedd'], [1, '#c9bc9b']]);
    g.fill();
    ink(g);
    g.fillStyle = '#6e6450';
    g.fillRect(x - s * 0.66, y - s * 0.3, s * 1.32, 4);
    g.fillRect(x - 2, y - s * 0.95, 4, s * 0.65);
  }

  const roomScene = {
    prep: ({ one }) => ({ S: one('.screen') }),
    draw(g, t, W, H, { S }) {
      const mobile = W < 720;
      const m = mobile ? 20 : 34;
      const C = { x: S.x - m, y: S.y - m, w: S.w + 2 * m, h: S.h + m + (mobile ? 60 : 80) };
      const D = C.y + C.h + (mobile ? 26 : 34);
      wallpaper(g, W, H, '#b07ab8', '#efdcf3');
      stripes(g, 0, W, 0, D, 'rgba(255, 255, 255, .08)', 64);

      // posters and lamp in the free wall space
      const left = C.x, right = W - (C.x + C.w);
      if (left > 230) {
        const pw = Math.min(220, left - 80), px0 = left / 2 - pw / 2 + 10;
        box(g, px0, C.y + 10, pw, pw * 1.25, '#61bb46');
        g.fillStyle = '#ffe08a';
        g.beginPath(); g.arc(px0 + pw * 0.72, C.y + 10 + pw * 0.3, pw * 0.13, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1f5a1a';
        poly(g, [[px0 + 2, C.y + 10 + pw * 1.05], [px0 + pw * 0.32, C.y + 10 + pw * 0.5], [px0 + pw * 0.52, C.y + 10 + pw * 0.8], [px0 + pw * 0.68, C.y + 10 + pw * 0.6], [px0 + pw - 2, C.y + 10 + pw * 1.05]]);
        g.fill();
        g.fillStyle = '#3a8a2e';
        g.fillRect(px0 + 2, C.y + 10 + pw * 1.05, pw - 4, pw * 0.2 - 2);
        tape(g, px0, C.y + 10); tape(g, px0 + pw, C.y + 10);
        const qw = pw * 0.7, qx = px0 + pw * 0.3, qy = C.y + 10 + pw * 1.25 + 40;
        if (qy + qw < D - 20) {
          box(g, qx, qy, qw, qw, '#e03a3e');
          g.fillStyle = '#ffe08a';
          g.font = `700 ${Math.round(qw * 0.5)}px ${MONO}`;
          g.textBaseline = 'middle';
          g.textAlign = 'center';
          g.fillText('92', qx + qw / 2, qy + qw / 2 + 2);
          g.textAlign = 'left';
          tape(g, qx + qw / 2, qy);
        }
      }
      if (right > 200) {
        const lx = C.x + C.w + right * 0.45;
        lavaLamp(g, lx, D + 10, Math.min(380, D - C.y - 10), t);
        if (right > 300) {
          const yw = Math.min(200, right - 120), yx = C.x + C.w + right * 0.5 - yw / 2 + 30;
          if (C.y - 20 > 0 || true) {
            box(g, yx, Math.max(20, C.y - 70), yw, yw * 0.6, '#fdb827');
            g.fillStyle = INK;
            g.font = `700 ${Math.round(yw * 0.24)}px ${MONO}`;
            g.textBaseline = 'middle';
            g.fillText('C:\\>', yx + yw * 0.12, Math.max(20, C.y - 70) + yw * 0.3);
            tape(g, yx + yw / 2, Math.max(20, C.y - 70));
          }
        }
      }

      // desk
      woodTop(g, D, W, H);

      // monitor casing
      rr(g, C.x, C.y, C.w, C.h, 22);
      g.fillStyle = lin(g, C.x, C.y, C.x + C.w, C.y + C.h, [[0, '#f4eedd'], [0.55, '#e3d9c0'], [1, '#c9bc9b']]);
      g.fill();
      ink(g, 5);
      if (!mobile) {
        g.fillStyle = '#6e6450';
        for (let y = C.y + 30; y < C.y + C.h - 60; y += 22) g.fillRect(C.x + C.w - 24, y, 14, 6);
      }
      rr(g, S.x - 12, S.y - 12, S.w + 24, S.h + 24, 26);
      g.fillStyle = '#c9bc9b';
      g.fill();
      ink(g, 4);
      rr(g, S.x, S.y, S.w, S.h, 18);
      g.fillStyle = '#0b3566';
      g.fill();
      // chin: label, six-colour badge, buttons, power light
      const cy = S.y + S.h + (mobile ? 30 : 40);
      g.fillStyle = '#9e9070';
      g.fillRect(S.x, cy - 3, Math.min(120, S.w * 0.3), 8);
      RAINBOW.forEach((c, i) => { g.fillStyle = c; g.fillRect(S.x + Math.min(132, S.w * 0.33), cy - 8 + i * 3, 22, 3); });
      g.fillStyle = '#9e9070';
      g.fillRect(S.x + S.w - 92, cy - 6, 26, 14);
      g.fillRect(S.x + S.w - 58, cy - 6, 26, 14);
      g.fillStyle = '#61bb46';
      g.beginPath(); g.arc(S.x + S.w - 14, cy + 1, 7, 0, Math.PI * 2); g.fill();
      // stand
      const cx = C.x + C.w / 2, sw = Math.min(150, C.w * 0.3);
      g.fillStyle = '#c9bc9b';
      g.fillRect(cx - sw / 2, C.y + C.h, sw, D - C.y - C.h);
      g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(cx - sw / 2, C.y + C.h, sw, D - C.y - C.h);
      poly(g, [[cx - sw * 0.85, D - 6], [cx + sw * 0.85, D - 6], [cx + sw * 1.1, D + 16], [cx - sw * 1.1, D + 16]]);
      g.fillStyle = '#e3d9c0';
      g.fill();
      ink(g);
      // floppy standing on top
      const fs = mobile ? 56 : 80;
      floppy(g, C.x + C.w * 0.12, C.y - fs + 6, fs, '#fdb827', 0, '#963d97');

      // keyboard, mouse, floppies on the desk
      const kw = Math.min(C.w * 0.92, W - 24), ky = D + 40, kh = Math.min(118, H - ky - 26);
      if (kh > 50) keyboard(g, cx, ky, kw, kh);
      if (W - (cx + kw / 2) > 110) mouse(g, cx + kw / 2 + 64, ky + kh * 0.55, 34);
      if (cx - kw / 2 > 170) {
        floppy(g, cx - kw / 2 - 150, ky + 6, 86, '#009ddc', -0.18, '#e03a3e');
        if (H - ky > 170) floppy(g, cx - kw / 2 - 120, ky + 62, 86, '#e03a3e', 0.14, '#009ddc');
      }
    },
  };

  /* ============================================================
     Scene: cork board with pinned cards
     ============================================================ */
  const corkScene = {
    prep: ({ one, all }) => ({ B: one('.board'), cards: all('.card') }),
    draw(g, t, W, H, { B, cards }, px) {
      wallpaper(g, W, H, '#963d97', '#d6b0de');
      stripes(g, 0, W, 0, H, 'rgba(255, 255, 255, .07)', 64);
      const f = 22;
      box(g, B.x - f, B.y - f, B.w + 2 * f, B.h + 2 * f, '#a5622d', 5);
      g.fillStyle = '#d18a4b';
      g.fillRect(B.x - f + 6, B.y - f + 6, B.w + 2 * f - 12, 5);
      g.fillStyle = '#d18a4b';
      g.fillRect(B.x, B.y, B.w, B.h);
      for (let y = B.y; y < B.y + B.h; y += px) {
        for (let x = B.x; x < B.x + B.w; x += px) {
          const h = hash(x / px, y / px) % 100;
          if (h < 16) { g.fillStyle = '#a5622d'; g.fillRect(x, y, px, px); }
          else if (h < 24) { g.fillStyle = '#f2b877'; g.fillRect(x, y, px, px); }
        }
      }
      g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(B.x, B.y, B.w, B.h);
      cards.forEach((c, i) => {
        const x = c.x + c.w / 2, y = c.y + 12;
        g.fillStyle = 'rgba(35, 26, 43, .35)';
        g.beginPath(); g.ellipse(x + 5, y + 6, 9, 6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = RAINBOW[i % RAINBOW.length];
        g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
        ink(g, 3);
        g.fillStyle = '#fffdf6';
        g.fillRect(x - 5, y - 5, 4, 4);
      });
    },
  };

  /* ============================================================
     Scene: shop counter with the cash register printing a receipt
     ============================================================ */
  const counterScene = {
    prep: ({ one }) => ({ P: one('.receipt'), R: one('.till__machine') }),
    draw(g, t, W, H, { P, R }) {
      g.fillStyle = '#f4eedd';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#e3d9c0';
      for (let x = 0; x < W; x += 48) g.fillRect(x, 0, 3, H);
      for (let y = 0; y < H; y += 48) g.fillRect(0, y, W, 3);
      // counter
      const CT = R.y + R.h - 30;
      box(g, -10, CT, W + 20, 20, '#d18a4b', 4);
      g.fillStyle = '#a5622d';
      g.fillRect(0, CT + 22, W, H - CT);
      g.fillStyle = '#6f3d18';
      for (let x = 30; x < W; x += 80) g.fillRect(x, CT + 22, 5, H - CT);
      // printer housing right under the receipt
      const sx = P.x - 16, sy = P.y + P.h - 8, sw = P.w + 32;
      // display on a post
      const dw = Math.min(110, R.w * 0.3), dx = R.x + R.w - dw - 6, dy = R.y - 40;
      g.fillStyle = '#c9bc9b';
      g.fillRect(dx + dw / 2 - 10, dy + 60, 20, R.y + 50 - dy - 60);
      g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(dx + dw / 2 - 10, dy + 60, 20, R.y + 50 - dy - 60);
      rr(g, dx, dy, dw, 64, 8);
      g.fillStyle = '#e3d9c0'; g.fill(); ink(g);
      rr(g, dx + 8, dy + 8, dw - 16, 46, 4);
      g.fillStyle = '#1f5a1a'; g.fill();
      g.fillStyle = '#a8dc8f';
      g.font = `700 ${Math.round(dw * 0.26)}px ${MONO}`;
      g.textBaseline = 'middle';
      g.fillText('0,00', dx + 16, dy + 32);
      // body
      const bx0 = R.x + 4, bx1 = R.x + R.w - 4, top = sy + 30, bot = R.y + R.h - 34;
      poly(g, [[bx0 + 24, top], [bx1 - 24, top], [bx1, bot], [bx0, bot]]);
      g.fillStyle = lin(g, bx0, top, bx1, bot, [[0, '#f4eedd'], [1, '#c9bc9b']]);
      g.fill();
      ink(g);
      box(g, bx0, bot, bx1 - bx0, 24, '#9e9070', 4);
      g.fillStyle = '#6e6450';
      g.fillRect((bx0 + bx1) / 2 - 30, bot + 8, 60, 7);
      rr(g, sx, sy, sw, 44, 8);
      g.fillStyle = '#e3d9c0'; g.fill(); ink(g);
      g.fillStyle = INK;
      g.fillRect(P.x - 4, sy + 6, P.w + 8, 6);
      // keypad
      const kx = Math.max(sx + sw + 20, R.x + R.w * 0.52), kcols = 4, krows = 3;
      const kw = Math.min(30, (bx1 - 30 - kx) / kcols - 8);
      if (kw > 12) {
        for (let r = 0; r < krows; r++) {
          for (let c = 0; c < kcols; c++) {
            const x = kx + c * (kw + 8) + r * 4, y = top + 14 + r * 22;
            g.fillStyle = c === kcols - 1 ? (r === 0 ? '#61bb46' : '#e03a3e') : '#fffdf6';
            g.fillRect(x, y, kw, 14);
            g.fillStyle = '#9e9070';
            g.fillRect(x, y + 14, kw, 4);
          }
        }
      }
    },
  };

  /* ============================================================
     Scene: wall shelf under the software boxes
     ============================================================ */
  const shelfScene = {
    prep: ({ all }) => {
      const boxes = all('.box').sort((a, b) => a.y - b.y);
      const rows = [];
      boxes.forEach((b) => {
        const row = rows.find((r) => Math.abs(r.y - b.y) < 24);
        if (row) { row.items.push(b); } else rows.push({ y: b.y, items: [b] });
      });
      return {
        rows: rows.map((r) => ({
          bottom: Math.max(...r.items.map((b) => b.y + b.h)),
          x0: Math.min(...r.items.map((b) => b.x)),
          x1: Math.max(...r.items.map((b) => b.x + b.w)),
        })),
      };
    },
    draw(g, t, W, H, { rows }) {
      wallpaper(g, W, H, '#efdcf3', '#d6b0de');
      stripes(g, 0, W, 0, H, 'rgba(150, 61, 151, .12)', 48);
      rows.forEach(({ bottom, x0, x1 }) => {
        const a = x0 - 30, b = x1 + 30;
        [a + 40, b - 40].forEach((bx) => {
          poly(g, [[bx - 6, bottom + 18], [bx + 6, bottom + 18], [bx + 6, bottom + 70], [bx - 6, bottom + 30]]);
          g.fillStyle = '#a9a8bb'; g.fill(); ink(g, 3);
        });
        box(g, a, bottom, b - a, 18, '#d18a4b', 4);
        g.fillStyle = '#f2b877';
        g.fillRect(a + 4, bottom + 3, b - a - 8, 4);
        g.fillStyle = 'rgba(35, 26, 43, .25)';
        g.fillRect(a, bottom + 20, b - a, 10);
      });
    },
  };

  /* ============================================================
     Scene: the desk seen from above, with the notebook
     ============================================================ */
  const deskScene = {
    prep: ({ one }) => ({ N: one('.notebook') }),
    draw(g, t, W, H, { N }) {
      g.fillStyle = lin(g, 0, 0, 0, H, [[0, '#d18a4b'], [1, '#a5622d']]);
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#6f3d18';
      for (let y = 80; y < H; y += 120) g.fillRect(0, y, W, 4);
      g.strokeStyle = '#f2b877';
      g.lineWidth = 3;
      for (let i = 0; i < H / 40; i++) {
        const yy = 20 + i * 40;
        g.beginPath();
        for (let x = -20; x <= W + 40; x += 30) {
          const y = yy + Math.sin(x * 0.01 + i * 2.1) * 4;
          if (x === -20) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(35, 26, 43, .45)';
      g.fillRect(N.x + 12, N.y + 14, N.w, N.h);
      const free = W - (N.x + N.w);
      if (free > 150) {
        // pencil
        g.save();
        g.translate(N.x + N.w + free * 0.4, N.y + 90);
        g.rotate(0.5);
        box(g, -10, 0, 20, 200, '#fdb827', 3);
        box(g, -10, -26, 20, 26, '#f58e90', 3);
        g.fillStyle = '#a9a8bb'; g.fillRect(-10, -4, 20, 8);
        poly(g, [[-10, 200], [10, 200], [0, 230]]);
        g.fillStyle = '#f2b877'; g.fill(); ink(g, 3);
        g.fillStyle = INK; g.fillRect(-3, 222, 6, 8);
        g.restore();
        // mug from above
        const mx = N.x + N.w + free * 0.5, my = N.y + N.h * 0.6 + 60;
        if (my < H - 60) {
          g.beginPath(); g.arc(mx, my, 44, 0, Math.PI * 2);
          g.fillStyle = '#009ddc'; g.fill(); ink(g);
          g.beginPath(); g.arc(mx, my, 32, 0, Math.PI * 2);
          g.fillStyle = '#6f3d18'; g.fill(); ink(g, 3);
          box(g, mx + 40, my - 10, 22, 20, '#009ddc', 3);
        }
      }
      if (N.x > 150) {
        floppy(g, N.x - 130, N.y + 40, 96, '#963d97', -0.2, '#fdb827');
        floppy(g, N.x - 120, N.y + 170, 96, '#61bb46', 0.1, '#e03a3e');
      }
    },
  };

  /* ============================================================
     Scene: brick wall on the square and the shop door
     ============================================================ */
  const streetScene = {
    prep: ({ one }) => ({ Dr: one('.door'), sign: one('.sign') }),
    draw(g, t, W, H, { Dr, sign }) {
      g.fillStyle = '#e3d9c0';
      g.fillRect(0, 0, W, H);
      const bh = 28, bw = 72;
      for (let r = 0; r * bh < H; r++) {
        for (let c = -1; c * bw < W + bw; c++) {
          const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh;
          g.fillStyle = hash(c, r) % 5 === 0 ? '#a5622d' : hash(c, r) % 7 === 0 ? '#f2b877' : '#d18a4b';
          g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
        }
      }
      // pavement
      const floor = Dr.y + Dr.h + 16;
      g.fillStyle = '#c9bc9b';
      g.fillRect(0, floor, W, H - floor);
      g.fillStyle = '#9e9070';
      for (let x = 0; x < W; x += 90) g.fillRect(x, floor, 4, H - floor);
      g.fillRect(0, floor, W, 4);
      // step
      box(g, Dr.x - 40, Dr.y + Dr.h, Dr.w + 80, 16, '#e2e2ea', 4);
      // frame and door
      box(g, Dr.x - 22, Dr.y - 22, Dr.w + 44, Dr.h + 22, '#6f3d18', 5);
      box(g, Dr.x, Dr.y, Dr.w, Dr.h, '#3a8a2e', 4);
      const gx = Dr.x + 22, gy = Dr.y + 22, gw = Dr.w - 44, gh = Dr.h * 0.44;
      box(g, gx, gy, gw, gh, '#a9e3f7', 4);
      g.fillStyle = 'rgba(255, 255, 255, .6)';
      poly(g, [[gx + gw * 0.55, gy + 4], [gx + gw * 0.75, gy + 4], [gx + gw * 0.3, gy + gh - 4], [gx + gw * 0.1, gy + gh - 4]]);
      g.fill();
      const py = gy + gh + 24;
      box(g, gx, py, gw, Dr.y + Dr.h - py - 24, '#61bb46', 4);
      g.fillStyle = '#e2e2ea';
      g.beginPath(); g.arc(Dr.x + Dr.w - 18, gy + gh + 12, 8, 0, Math.PI * 2); g.fill(); ink(g, 3);
      // the sign hangs from a nail on two strings
      if (sign) {
        const nx = sign.x + sign.w / 2, ny = gy + 14;
        g.strokeStyle = INK; g.lineWidth = 3;
        g.beginPath();
        g.moveTo(sign.x + 12, sign.y + 4); g.lineTo(nx, ny); g.lineTo(sign.x + sign.w - 12, sign.y + 4);
        g.stroke();
        g.fillStyle = '#6a687e'; g.fillRect(nx - 4, ny - 4, 8, 8);
      }
      // a lamp bracket above the door
      g.fillStyle = INK;
      g.fillRect(Dr.x + Dr.w / 2 - 3, Dr.y - 60, 6, 38);
      rr(g, Dr.x + Dr.w / 2 - 22, Dr.y - 86, 44, 30, 6);
      g.fillStyle = '#ffe08a'; g.fill(); ink(g, 3);
    },
  };

  /* ============================================================
     Bands
     ============================================================ */
  const bands = [
    ['#start', roomScene], ['#uslugi', corkScene], ['#kasy', counterScene],
    ['#programy', shelfScene], ['#pytania', deskScene], ['#kontakt', streetScene],
  ].map(([sel, scene]) => new Band($(sel), scene));
  const hero = bands[0];

  let t = 0, heroVisible = true, ready = false;
  const pending = new Set();
  let flushT = null;
  function schedule(band) {
    pending.add(band);
    clearTimeout(flushT);
    flushT = setTimeout(() => {
      pending.forEach((b) => { if (b.layout()) b.render(b === hero ? t : 0); });
      pending.clear();
    }, 80);
  }
  const ro = new ResizeObserver((entries) => {
    if (!ready) return;
    entries.forEach((en) => {
      const band = bands.find((b) => b.sec === en.target);
      if (band) schedule(band);
    });
  });

  const fontsReady = document.fonts
    ? Promise.all([document.fonts.load(`700 12px ${MONO}`), document.fonts.ready]).catch(() => {})
    : Promise.resolve();
  fontsReady.then(() => {
    ready = true;
    bands.forEach((b) => { if (b.layout()) b.render(0); });
    bands.forEach((b) => ro.observe(b.sec));
    if (!reduceMotion) {
      setInterval(() => {
        if (!heroVisible || document.hidden) return;
        t += 0.12;
        hero.render(t);
      }, 120);
    }
  });
  new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe(hero.sec);

  /* ============================================================
     Opening hours (Warsaw time): header, sticky note, door sign
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
    const cls = open ? 'is-open' : 'is-closed';
    $('#status').textContent = open ? 'Otwarte' : 'Zamknięte';
    $('#status').className = 'top__status ' + cls;
    $('#noteNow').textContent = open ? `Teraz otwarte, do ${today[1]}:00` : `Teraz zamknięte, otwieramy ${when} o ${at}:00`;
    $('#sign').textContent = open ? 'Otwarte' : 'Zamknięte';
    $('#sign').className = 'sign ' + cls;
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
