/* Uncle Tan · v6 "Thống Nhất" — bánh mì down Vietnam as a train ride: scroll = the journey.
   Visual proposal only: the ordering section is a static preview, nothing is sent anywhere.
   Debug: ?at=0.45 | ?at=st-3 (scroll on load) · ?static (no motion, tall capture) */
(() => {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const pad2 = n => String(n).padStart(2, '0');
  const f1 = n => (Math.round(n * 10) / 10).toString();

  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const kinetic = root.classList.contains('kinetic');
  const desktop = matchMedia('(min-width: 1000px)');

  // small seeded PRNG so drawings and barcodes look the same on every load
  function seeded(str) {
    let h = 2166136261;
    for (const c of String(str)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function barcode(seed) {
    const rnd = seeded(seed + '|bar');
    const stops = [];
    let x = 0;
    while (x < 100) {
      const w = 0.22 + rnd() * 0.85, gap = 0.25 + rnd() * 0.75;
      const e = Math.min(100, x + w);
      stops.push(`#1C1A16 ${x.toFixed(2)}% ${e.toFixed(2)}%`, `transparent ${e.toFixed(2)}% ${Math.min(100, e + gap).toFixed(2)}%`);
      x = e + gap;
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }

  /* ================= Bánh mì illustrations (inline SVG) ================= */
  const ART = (() => {
    const CRUST = '#C9853A', CRUST_HI = '#E8B46C', EDGE = '#5E3712', CRUMB = '#F4E4C1', HOLE = '#E2CB9B';

    // one half of the split baguette in cross-section: crust ring, crumb, air holes; scoring on the top half
    function half(x0, x1, y, d, top, rnd) {
      const w = x1 - x0, m = (x0 + x1) / 2, s = top ? -1 : 1;
      const shape = (a, b, dd) => `M${f1(a)} ${f1(y)} C${f1(a + w * 0.025)} ${f1(y + s * dd * 0.8)} ${f1(a + w * 0.17)} ${f1(y + s * dd)} ${f1(m)} ${f1(y + s * dd)} ` +
        `C${f1(b - w * 0.17)} ${f1(y + s * dd)} ${f1(b - w * 0.025)} ${f1(y + s * dd * 0.8)} ${f1(b)} ${f1(y)} Z`;
      let out = `<path d="${shape(x0, x1, d)}" fill="${CRUST}" stroke="${EDGE}" stroke-width="2" stroke-linejoin="round"/>`;
      out += `<path d="${shape(x0 + 13, x1 - 13, d - 7)}" fill="${CRUMB}"/>`;
      for (let i = 0; i < 10; i++) {
        const x = x0 + 64 + rnd() * (w - 128), yy = y + s * (4 + rnd() * (d * 0.5));
        out += `<ellipse cx="${f1(x)}" cy="${f1(yy)}" rx="${f1(2 + rnd() * 4)}" ry="${f1(1.2 + rnd() * 1.8)}" fill="${HOLE}"/>`;
      }
      if (top) {
        for (let i = 0; i < 4; i++) {
          const x = x0 + w * (0.25 + i * 0.165);
          out += `<path d="M${f1(x - 16)} ${f1(y - d + 6)} q16 -6 30 -2" stroke="${CRUST_HI}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        }
      }
      return out;
    }

    // layer helpers draw with the layer's bottom at y = 0 (growing upwards); the caller translates them
    const span = c => c.xb - c.xa;
    function band(c, h, color, amp = 1.5) {
      const n = Math.round(span(c) / 12);
      let d = `M${c.xa} 0`;
      for (let i = 0; i <= n; i++) d += ` L${f1(c.xa + span(c) * i / n)} ${f1(-h + (c.rnd() - 0.5) * 2 * amp)}`;
      return `<path d="${d} L${c.xb} 0 Z" fill="${color}"/>`;
    }
    function specks(c, h, color, n) {
      let s = '';
      for (let i = 0; i < n; i++) s += `<circle cx="${f1(c.xa + 6 + c.rnd() * (span(c) - 12))}" cy="${f1(-2 - c.rnd() * (h - 4))}" r="${f1(0.8 + c.rnd())}" fill="${color}"/>`;
      return s;
    }
    function row(c, n, fn) {
      let s = '';
      const w = span(c) / n;
      for (let i = 0; i < n; i++) s += fn(c.xa + i * w, w, i);
      return s;
    }
    function sprig(x, y, dx, dy, c, leaf = ['#5C9A3F', '#79B356']) {
      let s = `<path d="M${f1(x)} ${f1(y)} Q${f1(x + dx / 2 + 4)} ${f1(y + dy / 3)} ${f1(x + dx)} ${f1(y + dy)}" stroke="#4E7E33" stroke-width="1.6" fill="none"/>`;
      for (let k = 0; k < 3; k++) {
        s += `<circle cx="${f1(x + dx + (k - 1) * 5.5 + (c.rnd() - 0.5) * 2)}" cy="${f1(y + dy - (k === 1 ? 4 : 0) + (c.rnd() - 0.5) * 2)}" r="${f1(3.1 + c.rnd() * 1.4)}" fill="${leaf[k === 1 ? 1 : 0]}"/>`;
      }
      return s;
    }

    const L = {
      pate: c => ({ h: 9, svg: band(c, 9, '#8B5A3C', 1.4) + specks(c, 9, '#6A4027', 14) }),
      pateShiitake: c => ({ h: 9, svg: band(c, 9, '#5E4430', 1.4) + specks(c, 9, '#3E2B1D', 14) }),
      mayo: c => ({ h: 4, svg: band(c, 4, '#F3DE9A', 1) }),
      mayoKaffir: c => ({ h: 4, svg: band(c, 4, '#E0E0A0', 1) }),
      mayoTurmeric: c => ({ h: 5, svg: band(c, 5, '#F2C230', 1.2) }),
      mayoVegan: c => ({ h: 4, svg: band(c, 4, '#EEE4C4', 1) }),
      hoisin: c => ({ h: 5, svg: band(c, 5, '#4A2620', 1.4) }),
      tomato: c => ({ h: 9, svg: band(c, 9, '#C8402E', 2.4) + specks(c, 9, '#E2614A', 10) }),
      chalua: c => {
        let s = '';
        for (let x = c.xa; x < c.xb - 12; x += 40) {
          const w = Math.min(50, c.xb - x), y = -11 + (c.rnd() - 0.5) * 1.5;
          s += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="10" rx="4" fill="#EEC6B8" stroke="#B57D6C" stroke-width="1.4"/>` +
            `<path d="M${f1(x + 6)} ${f1(y + 3.5)} H${f1(x + w - 6)}" stroke="#D9A595" stroke-width="1.2"/>`;
        }
        return { h: 11, svg: s };
      },
      porkbelly: c => ({ h: 14, svg: row(c, 6, (x, w) => {
        const y = -13, r = f1((c.rnd() - 0.5) * 6);
        return `<g transform="rotate(${r} ${f1(x + w / 2)} -6)"><rect x="${f1(x + 1)}" y="${y + 6}" width="${f1(w + 4)}" height="7" fill="#D8907C"/>` +
          `<rect x="${f1(x + 1)}" y="${y + 3.4}" width="${f1(w + 4)}" height="3" fill="#F7E9DE"/><rect x="${f1(x + 1)}" y="${y}" width="${f1(w + 4)}" height="4" rx="2" fill="#A35F2E"/>` +
          `<rect x="${f1(x + 1)}" y="${y}" width="${f1(w + 4)}" height="13" rx="3" fill="none" stroke="#7A3F22" stroke-width="1.2"/></g>`;
      }) }),
      pickles: c => {
        let s = '';
        const n = Math.round(span(c) / 10);
        for (let i = 0; i < n; i++) {
          const x = c.xa + 8 + (i + c.rnd() * 0.6) * ((span(c) - 16) / n), y = -5 + (c.rnd() - 0.5) * 4;
          const carrot = c.rnd() < 0.55;
          s += `<rect x="${f1(x - 12)}" y="${f1(y - 2.3)}" width="24" height="4.6" rx="2.3" fill="${carrot ? '#EF8A30' : '#F8F3E6'}"` +
            `${carrot ? '' : ' stroke="#D9CBAE" stroke-width=".8"'} transform="rotate(${f1((c.rnd() - 0.5) * 50)} ${f1(x)} ${f1(y)})"/>`;
        }
        return { h: 10, svg: s };
      },
      cucumber: c => ({ h: 6, svg: row(c, 3, (x, w) => {
        const y = -6 + (c.rnd() - 0.5) * 1.5;
        return `<g transform="rotate(${f1((c.rnd() - 0.5) * 4)} ${f1(x + w / 2)} ${f1(y + 3)})"><rect x="${f1(x + 3)}" y="${f1(y)}" width="${f1(w - 6)}" height="6" rx="3" fill="#5E9B3F"/>` +
          `<rect x="${f1(x + 8)}" y="${f1(y + 1.6)}" width="${f1(w - 16)}" height="2.8" rx="1.4" fill="#CFE6A6"/></g>`;
      }) }),
      coriander: c => {
        let s = '';
        const n = 7;
        for (let i = 0; i < n; i++) {
          const x = c.xa + 12 + (i + c.rnd() * 0.8) * ((span(c) - 24) / n);
          s += sprig(x, -2, (c.rnd() - 0.5) * 26, -12 - c.rnd() * 10, c);
        }
        s += sprig(c.xa + 8, -5, -34, -6, c) + sprig(c.xb - 8, -5, 34, -8, c);
        return { h: 8, svg: s };
      },
      mint: c => {
        let s = '';
        for (let i = 0; i < 7; i++) {
          const x = c.xa + 14 + (i + c.rnd() * 0.7) * ((span(c) - 28) / 7), a = f1((c.rnd() - 0.5) * 70);
          s += `<g transform="translate(${f1(x)} ${f1(-6 - c.rnd() * 6)}) rotate(${a})"><ellipse rx="8" ry="4.2" fill="#3E8A52"/><path d="M-7 0 H7" stroke="#2C6B3D" stroke-width="1"/></g>`;
        }
        s += `<g transform="translate(${c.xa - 14} -6) rotate(-20)"><ellipse rx="9" ry="4.4" fill="#3E8A52"/></g>`;
        return { h: 7, svg: s };
      },
      chili: c => {
        let s = '';
        for (let i = 0; i < 6; i++) {
          const x = c.xa + 22 + (i + c.rnd() * 0.7) * ((span(c) - 44) / 6), y = -4 - c.rnd() * 3;
          s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="4.4" fill="#F6CDA2" stroke="#D42B2B" stroke-width="2.6"/><circle cx="${f1(x - 1)}" cy="${f1(y + 0.5)}" r=".9" fill="#FBEFD0"/>`;
        }
        return { h: 5, svg: s };
      },
      scallion: c => {
        let s = '';
        for (let i = 0; i < 11; i++) {
          s += `<circle cx="${f1(c.xa + 10 + c.rnd() * (span(c) - 20))}" cy="${f1(-2 - c.rnd() * 3)}" r="2.4" fill="#D9EDC4" stroke="#6DAE4A" stroke-width="1.6"/>`;
        }
        return { h: 4, svg: s };
      },
      shallots: c => {
        let s = '';
        for (let i = 0; i < 24; i++) {
          s += `<circle cx="${f1(c.xa + 6 + c.rnd() * (span(c) - 12))}" cy="${f1(-1 - c.rnd() * 4)}" r="${f1(1.5 + c.rnd() * 1.2)}" fill="${i % 2 ? '#B9772A' : '#DBA04C'}"/>`;
        }
        return { h: 3, svg: s };
      },
      eggs: c => ({ h: 18, svg: row(c, 2, (x, w) => {
        const cx = x + w / 2, rx = w / 2 - 6;
        return `<path d="M${f1(cx - rx)} -1 C${f1(cx - rx)} -9 ${f1(cx - rx * 0.5)} -12 ${f1(cx)} -10 C${f1(cx + rx * 0.5)} -12 ${f1(cx + rx)} -9 ${f1(cx + rx)} -1 Z" fill="#FCFAF3" stroke="#E2D8BF" stroke-width="1.2"/>` +
          `<circle cx="${f1(cx - rx + 4)}" cy="-3" r="3" fill="#D9A85C"/><circle cx="${f1(cx + rx - 4)}" cy="-3" r="3" fill="#D9A85C"/>` +
          `<path d="M${f1(cx - 19)} -9 A19 11 0 0 1 ${f1(cx + 19)} -9 Z" fill="#F4B02A"/><ellipse cx="${f1(cx - 6)}" cy="-15" rx="5" ry="2.4" fill="#FCD878"/>`;
      }) }),
      tofu: c => ({ h: 15, svg: row(c, 6, (x, w) => {
        const r = f1((c.rnd() - 0.5) * 6);
        return `<g transform="rotate(${r} ${f1(x + w / 2)} -7)"><rect x="${f1(x + 2)}" y="-14" width="${f1(w - 4)}" height="13" rx="3" fill="#E7BE64" stroke="#A96F2A" stroke-width="2"/>` +
          `<path d="M${f1(x + 7)} -10.5 H${f1(x + w - 7)}" stroke="#B97A2E" stroke-width="2" opacity=".6"/></g>`;
      }) }),
      chicken: c => ({ h: 17, svg: row(c, 5, (x, w) => {
        const y = -16 + c.rnd() * 2;
        let s = `<rect x="${f1(x + 2)}" y="${f1(y)}" width="${f1(w - 4)}" height="15" rx="7" fill="#C98745" stroke="#8A5223" stroke-width="1.5"/>` +
          `<path d="M${f1(x + 9)} ${f1(y + 3)} H${f1(x + w - 12)}" stroke="#E3A865" stroke-width="1.6" opacity=".8"/>`;
        for (let k = 0; k < 3; k++) s += `<path d="M${f1(x + 12 + k * 15)} ${f1(y + 4)} l7 9" stroke="#5A2F12" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>`;
        return s;
      }) }),
      porkgrilled: c => ({ h: 15, svg: row(c, 5, (x, w) => {
        const y = -14;
        return `<path d="M${f1(x + 1)} ${y + 13} C${f1(x + w * 0.2)} ${y - 2} ${f1(x + w * 0.4)} ${y + 8} ${f1(x + w * 0.55)} ${y + 2} C${f1(x + w * 0.7)} ${y - 3} ${f1(x + w * 0.9)} ${y + 6} ${f1(x + w + 3)} ${y + 13} Z" fill="#9C4F2A" stroke="#4A2414" stroke-width="2" stroke-linejoin="round"/>` +
          `<path d="M${f1(x + w * 0.2)} ${y + 8} Q${f1(x + w * 0.5)} ${y + 4} ${f1(x + w * 0.8)} ${y + 8}" stroke="#C9784A" stroke-width="1.8" fill="none"/>`;
      }) }),
      fishcake: c => ({ h: 16, svg: row(c, 5, (x, w) => {
        let s = `<rect x="${f1(x + 2)}" y="-15" width="${f1(w - 4)}" height="14" rx="7" fill="#E7B65C" stroke="#B8812F" stroke-width="1.6"/>`;
        for (let k = 0; k < 7; k++) {
          const dx = x + 8 + c.rnd() * (w - 16), dy = -12 + c.rnd() * 8;
          s += `<path d="M${f1(dx)} ${f1(dy)} l${f1(3 * Math.cos(k))} ${f1(3 * Math.sin(k))}" stroke="#4C7A2E" stroke-width="1.3" stroke-linecap="round"/>`;
        }
        return s;
      }) }),
      meatballs: c => {
        let s = '';
        const n = Math.floor(span(c) / 27);
        for (let i = 0; i < n; i++) {
          const cx = c.xa + 14 + i * ((span(c) - 28) / (n - 1)), cy = -11 + (c.rnd() - 0.5) * 2;
          s += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="11" fill="#8E4B2C" stroke="#5C2C16" stroke-width="1.6"/>` +
            `<ellipse cx="${f1(cx - 3.5)}" cy="${f1(cy - 4)}" rx="3.6" ry="2.2" fill="#B9734D"/><ellipse cx="${f1(cx + 3)}" cy="${f1(cy - 8.5)}" rx="5" ry="2" fill="#C8402E"/>`;
        }
        return { h: 20, svg: s };
      },
      duck: c => ({ h: 15, svg: row(c, 5, (x, w) => {
        const r = f1((c.rnd() - 0.5) * 5);
        return `<g transform="rotate(${r} ${f1(x + w / 2)} -7)"><rect x="${f1(x + 1)}" y="-14" width="${f1(w)}" height="13" rx="3" fill="#A44A40"/>` +
          `<rect x="${f1(x + 1)}" y="-11.4" width="${f1(w)}" height="2.2" fill="#EECDAC"/><rect x="${f1(x + 1)}" y="-14" width="${f1(w)}" height="2.8" rx="1.4" fill="#6B2A1C"/></g>`;
      }) }),
    };

    const RECIPES = {
      trung: ['pate', 'eggs', 'scallion', 'chili'],
      chay: ['pateShiitake', 'mayoVegan', 'tofu', 'pickles', 'coriander'],
      ga: ['mayoKaffir', 'chicken', 'pickles', 'coriander'],
      thit: ['cucumber', 'porkgrilled', 'pickles', 'shallots', 'coriander'],
      chaca: ['mayoTurmeric', 'fishcake', 'pickles', 'mint'],
      xiumai: ['tomato', 'meatballs', 'pickles', 'coriander', 'chili'],
      vit: ['hoisin', 'duck', 'cucumber', 'pickles', 'scallion'],
    };

    function sandwich(key, label) {
      const layers = RECIPES[key];
      const rnd = seeded('bm-' + key);
      const c = { xa: 50, xb: 370, rnd };
      const built = layers.map(name => L[name](c));
      const H = built.reduce((s, l) => s + l.h, 0);
      const dome = 44, belly = 32, topCut = 14 + dome + 4, bottomCut = topCut + H, height = bottomCut + belly + 20;
      let s = `<svg viewBox="0 0 420 ${height}" role="img" aria-label="${label}"><g class="bm-tilt">` +
        `<ellipse cx="210" cy="${bottomCut + belly + 9}" rx="176" ry="9" fill="#000" opacity=".2"/>` + half(22, 398, bottomCut, belly, false, rnd);
      let y = bottomCut;
      built.forEach(l => { s += `<g transform="translate(0 ${f1(y)})">${l.svg}</g>`; y -= l.h; });
      s += `<g class="bm-top">${half(26, 394, topCut, dome, true, rnd)}</g></g></svg>`;
      return s;
    }

    // Sài Gòn: the full đặc biệt stack, exploded with labels; --e (0 = assembled, 1 = exploded) is driven by scroll
    function anatomy() {
      const rnd = seeded('bm-anatomy');
      const c = { xa: 52, xb: 368, rnd };
      const stack = [ // top → bottom: layer, exploded bottom y, label, note
        ['chili', 146, 'chili', 'ostrość do wyboru'],
        ['coriander', 196, 'kolendra', 'zioła kupowane co rano'],
        ['cucumber', 236, 'ogórek', 'świeży i chłodny'],
        ['pickles', 278, 'pikle <span lang="vi">đồ chua</span>', 'marchew i daikon, 48 h'],
        ['porkbelly', 322, 'mięso', 'pieczony boczek'],
        ['chalua', 364, '<span lang="vi">chả lụa</span>', 'wietnamska wędlina'],
        ['mayo', 400, 'majonez na maśle', 'ubijany na żółtkach'],
        ['pate', 440, 'pasztet', 'z wątróbek, co rano'],
      ];
      const W = 600, H = 572, bottomCut = 478, topCutExploded = 100, dome = 52, belly = 46;
      const built = stack.map(([name]) => L[name](c));
      // assembled positions: stacked tight on the bottom half
      let ay = bottomCut;
      const assembled = [];
      for (let i = built.length - 1; i >= 0; i--) { assembled[i] = ay; ay -= built[i].h; }
      const topDy = ay - topCutExploded;

      let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Anatomia bánh mì đặc biệt: bagietka, pasztet, majonez na maśle, chả lụa, pieczony boczek, pikle đồ chua, ogórek, kolendra, chili">` +
        `<ellipse cx="210" cy="${bottomCut + belly + 12}" rx="180" ry="10" fill="#000" opacity=".22"/>` +
        half(24, 396, bottomCut, belly, false, rnd);
      built.forEach((l, i) => {
        const ey = stack[i][1];
        s += `<g class="an-layer" style="--dy:${f1(assembled[i] - ey)}"><g transform="translate(0 ${ey})">${l.svg}</g></g>`;
      });
      s += `<g class="an-layer bm-top" style="--dy:${f1(topDy)}">${half(28, 392, topCutExploded, dome, true, rnd)}</g>`;

      const labels = [[topCutExploded - dome / 2, 'bagietka', 'z pieca co ~2 h']]
        .concat(stack.map(([, ey, t, n], i) => [ey - built[i].h / 2 - (stack[i][0] === 'coriander' ? 8 : 0), t, n]))
        .concat([[bottomCut + belly / 2, 'skórka jak papier', 'mąka pszenna z ryżową']]);
      s += '<g class="an-leads">' + labels.map(([y]) => `<path class="an-lead" d="M382 ${f1(y)} H404"/><circle class="an-dot" cx="406" cy="${f1(y)}" r="3"/>`).join('') + '</g></svg>';

      return `<div class="anatomy" style="aspect-ratio:${W} / ${H}">${s}` +
        labels.map(([y, t, n]) => `<span class="an-label" style="top:${f1(y / H * 100)}%"><b>${t}</b><small>${n}</small></span>`).join('') + '</div>';
    }

    // Hải Phòng: three thin bánh mì que sticks
    function que(label) {
      let s = `<svg viewBox="0 0 420 220" role="img" aria-label="${label}"><g class="bm-tilt">`;
      for (let i = 0; i < 3; i++) {
        const y = 58 + i * 52, r = -6 + i * 5;
        s += `<g transform="rotate(${r} 210 ${y})"><ellipse cx="214" cy="${y + 20}" rx="160" ry="5" fill="#000" opacity=".16"/>` +
          `<rect x="44" y="${y - 13}" width="336" height="26" rx="13" fill="${CRUST}" stroke="${EDGE}" stroke-width="2"/>`;
        for (let k = 0; k < 6; k++) s += `<path d="M${76 + k * 48} ${y - 8} q12 -4 22 -1" stroke="${CRUST_HI}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
        s += `<path d="M74 ${y + 3} H350" stroke="#7A4A2E" stroke-width="5" stroke-linecap="round"/>`;
        for (let k = 0; k < 7; k++) s += `<circle cx="${92 + k * 40}" cy="${y + 3}" r="2.4" fill="#D42B2B"/>`;
        s += '</g>';
      }
      return s + '</g></svg>';
    }

    return { sandwich, anatomy, que };
  })();

  /* ================= Drawings, boards, small bits ================= */
  $$('[data-art]').forEach(fig => {
    const name = $('.pr-name', fig.closest('section'))?.textContent ?? 'Bánh mì';
    const key = fig.dataset.art, label = `${name} — rysunek przekroju`;
    const svg = key === 'anatomy' ? ART.anatomy() : key === 'que' ? ART.que(label) : ART.sandwich(key, label);
    fig.insertAdjacentHTML('afterbegin', svg);
  });
  $$('[data-barcode]').forEach(el => { el.style.background = barcode(el.dataset.barcode); });
  // ticket notches sit exactly on the perforation under each header
  const notches = () => $$('.tk').forEach(tk => tk.style.setProperty('--ny', $('.tk-head', tk).offsetHeight + 'px'));
  notches();
  addEventListener('resize', notches);
  if (document.fonts) document.fonts.ready.then(notches);

  /* ================= Split-flap board ================= */
  function makeBoard(grid) {
    const CHARSET = Array.from('ABCDEFGHIJKLMNOPRSTUWYZ0123456789ĐÔƠƯ');
    let cols = 0, cells = [], def = [], timer = 0;
    const pickCols = () => { const w = grid.clientWidth; return w >= 900 ? 26 : w >= 760 ? 22 : w >= 500 ? 19 : 13; };

    function lines(n) {
      const out = [];
      def.forEach(rowDef => {
        let line = [];
        rowDef.forEach(([word, cls]) => {
          const all = Array.from(String(word).toUpperCase().normalize('NFC'));
          for (let k = 0; k < all.length; k += n) {
            const chars = all.slice(k, k + n).map(ch => ({ ch, cls }));
            if (line.length && line.length + 1 + chars.length > n) { out.push(line); line = []; }
            if (line.length) line.push({ ch: ' ' });
            line = line.concat(chars);
          }
        });
        out.push(line);
      });
      return out.map(l => l.concat(Array(Math.max(0, n - l.length)).fill({ ch: ' ' })));
    }

    function run() {
      if (timer) return;
      timer = setInterval(() => {
        let busy = false;
        for (const c of cells) {
          if (c.steps <= 0) continue;
          busy = true;
          c.steps--;
          c.cur = c.steps ? CHARSET[(Math.random() * CHARSET.length) | 0] : c.target;
          c.ch.textContent = c.cur;
          c.flip ^= 1;
          c.ch.className = c.flip ? 'ch fa' : 'ch fb';
        }
        if (!busy) { clearInterval(timer); timer = 0; }
      }, 55);
    }

    function set(rows, animate = kinetic) {
      def = rows;
      const n = pickCols(), ls = lines(n);
      if (n !== cols || ls.length * n !== cells.length) {
        cols = n;
        grid.style.setProperty('--cols', n);
        grid.textContent = '';
        cells = [];
        for (let i = 0; i < ls.length * n; i++) {
          const tile = document.createElement('span');
          const ch = document.createElement('span');
          tile.className = 'tile';
          ch.className = 'ch';
          tile.appendChild(ch);
          grid.appendChild(tile);
          cells.push({ tile, ch, cur: ' ', target: ' ', steps: 0, flip: 0 });
        }
      }
      ls.flat().forEach((t, i) => {
        const c = cells[i];
        c.tile.className = t.cls ? `tile ${t.cls}` : 'tile';
        if (c.cur === t.ch && !c.steps) return;
        c.target = t.ch;
        if (!animate) { c.cur = t.ch; c.ch.textContent = t.ch; c.steps = 0; return; }
        c.steps = (t.ch === ' ' ? 1 : 4) + Math.floor(Math.random() * 5) + Math.floor((i % n) / 2);
      });
      if (animate) run();
    }

    addEventListener('resize', () => { if (def.length && pickCols() !== cols) set(def, false); });
    return { set };
  }

  makeBoard($('[data-board="hero"] .board-grid'))
    .set([[['ODJAZD'], ['CO 2 H', 'hl']], [['HÀ NỘI'], ['→ SÀI GÒN'], ['→ WROCŁAW']], [['PERON'], ['KOTLARSKA'], ['25A', 'hl']]], kinetic);

  // the order-status preview flips in once, when it scrolls into view
  const statusEl = $('[data-board="status"]');
  if (statusEl) {
    const statusBoard = makeBoard($('.board-grid', statusEl));
    const rows = [[['POCIĄG'], ['UT-2063', 'hl']], [['STATUS'], ['PRZYJĘTE', 'hl']], [['PERON'], ['KOTLARSKA'], ['25A', 'hl']], [['GOTOWE'], ['OK. 13:45', 'hl']]];
    if (!kinetic || !('IntersectionObserver' in window)) statusBoard.set(rows, false);
    else {
      statusBoard.set(rows.map(r => r.map(() => [''])), false);
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        statusBoard.set(rows, true);
        io.disconnect();
      }, { threshold: 0.5 });
      io.observe(statusEl);
    }
  }

  /* ================= Open now (Europe/Warsaw, 12:00–22:00) ================= */
  (function openStatus() {
    const els = $$('[data-open-status]');
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    function update() {
      const [h, m] = fmt.format(new Date()).split(':').map(Number);
      const mins = (h % 24) * 60 + m, open = mins >= 720 && mins < 1320;
      els.forEach(el => {
        el.classList.toggle('is-open', open);
        el.classList.toggle('is-closed', !open);
        const extra = open && el.classList.contains('hero-status') ? ' · odbiór ok. 15 min' : '';
        $('.status-text', el).textContent = open ? `Otwarte do 22:00${extra}` : `Zamknięte · otwieramy ${mins < 720 ? '' : 'jutro '}o 12:00`;
      });
    }
    update();
    setInterval(update, 30000);
  })();

  /* ================= Menu tabs ================= */
  $$('[data-tabs]').forEach(box => {
    const tabs = $$('[role="tab"]', box);
    const select = (tab, focus) => {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        select(tabs[(map[e.key] + tabs.length) % tabs.length], true);
      });
    });
  });

  /* ================= Colour ================= */
  const hexToRgb = hex => {
    const h = hex.trim().replace('#', '');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  };
  const channel = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const luminance = c => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  const contrast = (a, b) => {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const mixRgb = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
  const rgb = c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  const best = (cands, bg) => cands.reduce((p, c) => (contrast(c, bg) > contrast(p, bg) ? c : p));
  const INK = [17, 17, 17], WHITE = [250, 250, 248];

  const palEls = $$('[data-pal]');
  const palettes = palEls.map(el => {
    const cs = getComputedStyle(el);
    return { bg: hexToRgb(cs.getPropertyValue('--pbg')), fg: hexToRgb(cs.getPropertyValue('--pfg')), ac: hexToRgb(cs.getPropertyValue('--pac')) };
  });

  /* ================= Journey data ================= */
  const stationEls = $$('.station');
  const terminus = $('#wroclaw');
  // train position u: station index 0–7, 8 = past Sài Gòn and off the map (Wrocław)
  const END = 8;
  const stations = stationEls.map((el, i) => ({
    el, id: el.id, i,
    name: $('.st-name', el).textContent.trim(),
    km: +el.dataset.km,
    approx: el.hasAttribute('data-approx'),
  }));
  const kmLabel = s => (s.approx ? '≈' : '') + s.km;
  const KM_TERMINUS = +terminus.dataset.km;

  // stylised rail (0–1 of the rail box), not a map: main line Hà Nội → Sài Gòn plus three side branches
  const MAIN = [[0.30, 0.02, 0], [0.24, 0.13], [0.19, 0.24], [0.29, 0.34], [0.44, 0.42, 2], [0.52, 0.48, 3],
    [0.53, 0.57], [0.63, 0.65], [0.74, 0.72, 5], [0.66, 0.79, 'junction'], [0.52, 0.88], [0.38, 0.95, 7]];
  const SPURS = [
    { st: 1, from: 0, at: [0.64, 0.10], kind: 'rail' },             // Hải Phòng – branch line
    { st: 4, from: 5, at: [0.67, 0.535], kind: 'road' },            // Hội An – ~30 km off the tracks
    { st: 6, from: 9, at: [0.36, 0.76], kind: 'rail', left: true }, // Đà Lạt – old mountain branch from Tháp Chàm
  ];

  let vh = innerHeight;
  let layout = { palTops: [], stationY: [], terminusY: 0 };

  /* ================= Desktop rail (SVG) ================= */
  const railTrack = $('.rail-track');
  const railSvg = $('.rail-svg');
  const railStops = $('.rail-stops');
  let rail = null, railSize = '';

  function catmullRom(pts) {
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      segs.push(`C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`);
    }
    return segs;
  }

  function buildRail() {
    if (!railTrack || !desktop.matches) { rail = null; return; }
    const w = railTrack.clientWidth, h = railTrack.clientHeight;
    const size = `${w}x${h}`;
    if (size === railSize && rail) return;
    railSize = size;

    const P = ([nx, ny]) => [62 + nx * 112, ny * h];
    const main = MAIN.map(P);
    const sg = main[main.length - 1];
    const pts = main.concat([[sg[0] - 18, sg[1] + 0.05 * h], [-60, sg[1] + 0.09 * h]]);
    const segs = catmullRom(pts);
    const M = p => `M${f1(p[0])} ${f1(p[1])}`;
    const spurCurve = (a, b) => { // gentle bend, the same control point there and back so the return retraces it
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
      return [mx - dy * 0.18, my + dx * 0.18];
    };

    const measure = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    measure.setAttribute('fill', 'none');
    measure.setAttribute('stroke', 'none');
    railSvg.textContent = '';
    railSvg.appendChild(measure);
    const lenOf = d => { measure.setAttribute('d', d); return measure.getTotalLength(); };

    const pos = [], lens = [];
    let d = M(main[0]);
    const spurD = [];
    for (let i = 0; i < main.length; i++) {
      const st = MAIN[i][2];
      if (typeof st === 'number') { pos[st] = main[i]; lens[st] = i === 0 ? 0 : lenOf(d); }
      SPURS.filter(s => s.from === i).forEach(s => {
        const end = P(s.at), c = spurCurve(main[i], end);
        d += ` Q${f1(c[0])} ${f1(c[1])} ${f1(end[0])} ${f1(end[1])}`;
        pos[s.st] = end;
        lens[s.st] = lenOf(d);
        d += ` Q${f1(c[0])} ${f1(c[1])} ${f1(main[i][0])} ${f1(main[i][1])}`;
        spurD.push({ d: `${M(main[i])} Q${f1(c[0])} ${f1(c[1])} ${f1(end[0])} ${f1(end[1])}`, kind: s.kind });
      });
      if (i < main.length - 1) d += ' ' + segs[i];
    }
    const dMain = `${M(main[0])} ${segs.slice(0, main.length - 1).join(' ')}`;
    const dTail = `${M(sg)} ${segs.slice(main.length - 1).join(' ')}`;
    d += ' ' + segs.slice(main.length - 1).join(' ');

    const minor = MAIN.map((m, i) => (m[2] === undefined || m[2] === 'junction' ? main[i] : null)).filter(Boolean)
      .map(p => `<circle class="rail-minor" cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.8"/>`).join('');
    const dots = pos.map(p => `<circle class="rail-ring" cx="${f1(p[0])}" cy="${f1(p[1])}" r="6"/><circle class="rail-dot" cx="${f1(p[0])}" cy="${f1(p[1])}" r="5"/>`).join('');

    railSvg.insertAdjacentHTML('beforeend',
      `<path class="rail-ties" d="${dMain}"/><path class="rail-base" d="${dMain}"/>` +
      spurD.map(s => (s.kind === 'rail' ? `<path class="rail-ties" d="${s.d}"/><path class="rail-base" d="${s.d}"/>` : `<path class="rail-base rail-base--road" d="${s.d}"/>`)).join('') +
      `<path class="rail-base rail-base--dash" d="${dTail}"/>` +
      `<path class="rail-progress" d="${d}"/>` + minor + dots +
      '<g class="train"><circle class="train-glow" r="10"/><rect class="train-body" x="-9" y="-4" width="18" height="8" rx="4"/><rect class="train-light" x="3" y="-1.8" width="4" height="3.6" rx="1.2"/></g>');

    const progress = $('.rail-progress', railSvg);
    const total = progress.getTotalLength();
    railStops.innerHTML = stations.map((s, i) => {
      const p = pos[i], left = SPURS.find(sp => sp.st === i)?.left;
      return `<li${left ? ' class="is-left"' : ''} style="left:${f1(left ? p[0] - 10 : p[0] + 11)}px;top:${f1(p[1])}px">` +
        `<a href="#${s.id}"><span lang="vi">${s.name}</span><small>${kmLabel(s)}</small></a></li>`;
    }).join('');

    rail = {
      progress, total, lens: [...lens, total],
      dots: $$('.rail-dot', railSvg), rings: $$('.rail-ring', railSvg),
      labels: $$('li', railStops), train: $('.train', railSvg), current: -2,
    };
    progress.style.strokeDasharray = `0 ${total + 20}`;
  }

  const unitsToLen = u => {
    const i = Math.min(Math.floor(u), END - 1);
    return lerp(rail.lens[i], rail.lens[i + 1], clamp(u - i));
  };

  /* ================= Mobile rail ================= */
  const mrail = $('.mrail');
  const mDots = [];
  if (mrail) {
    for (let i = 0; i <= END; i++) {
      const dot = document.createElement('span');
      dot.className = 'mrail-dot';
      dot.style.left = (i / END) * 100 + '%';
      mrail.appendChild(dot);
      mDots.push(dot);
    }
  }

  /* ================= HUD ================= */
  const hud = { label: $('.hud-label'), km: $('.hud-km'), station: $('.hud-station'), course: $('.hud-course'), next: $('.hud-next'), last: {} };
  function setText(key, el, value, html) {
    if (!el || hud.last[key] === value) return;
    hud.last[key] = value;
    if (html) el.innerHTML = html; else el.textContent = value;
  }
  function renderKm(km) {
    const s = String(Math.round(km));
    setText('km', hud.km, s, s.split('').map(d => `<span class="d">${d}</span>`).join(''));
  }
  function sectionAt(center) {
    let k = 0;
    for (let i = 0; i < layout.palTops.length; i++) if (layout.palTops[i] <= center) k = i;
    return palEls[k];
  }
  function kmAt(u) {
    if (u >= END - 1) return lerp(stations[END - 1].km, KM_TERMINUS, u - (END - 1));
    const i = Math.floor(u);
    return lerp(stations[i].km, stations[i + 1].km, u - i);
  }

  function renderHud(y, u) {
    const sec = sectionAt(y + vh / 2);
    renderKm(kmAt(u));
    if (sec.classList.contains('station')) {
      const i = Math.min(END - 1, Math.floor(u + 0.01));
      const st = stations[i], atStation = Math.abs(u - i) < 0.02;
      setText('label', hud.label, atStation && st.approx ? 'km ≈' : 'km');
      setText('station', hud.station, st.name);
      setText('course', hud.course, `${pad2(i + 1)} / 09`);
      const nx = stations[i + 1];
      setText('next', hud.next, nx ? `→ ${nx.name} · ${nx.approx ? '≈' : ''}${Math.max(0, Math.round(nx.km - kmAt(u)))} km` : '→ Wrocław, stacja końcowa');
    } else {
      const [full, meta, short] = (sec.dataset.hud || 'Hà Nội|').split('|');
      const name = !desktop.matches && short ? short : full;
      const before = sec.classList.contains('hero') || sec.classList.contains('prologue');
      setText('label', hud.label, before ? 'km' : 'km ≈');
      setText('station', hud.station, name);
      setText('course', hud.course, before ? '— / 09' : sec === terminus ? '09 / 09' : '');
      setText('next', hud.next, meta);
    }
  }

  /* ================= Scroll → state ================= */
  function measure() {
    vh = innerHeight;
    const top = el => el.getBoundingClientRect().top + scrollY;
    layout = {
      palTops: palEls.map(top),
      stationY: stations.map(s => top(s.el) - vh * 0.3),
      terminusY: top(terminus) - vh * 0.3,
    };
    buildRail();
  }

  // the train dwells at each station, then accelerates and brakes into the next one
  const dwell = t => smooth(clamp((t - 0.36) / 0.58));
  function unitsAt(y) {
    const Y = layout.stationY.concat(layout.terminusY);
    if (y <= Y[0]) return 0;
    for (let i = 0; i < Y.length - 1; i++) if (y < Y[i + 1]) return i + dwell((y - Y[i]) / (Y[i + 1] - Y[i]));
    return END;
  }
  // reduced motion: jump from station to station
  function unitsStatic(y) {
    const sec = sectionAt(y + vh / 2);
    const i = stationEls.indexOf(sec);
    if (i >= 0) return i;
    return layout.palTops[palEls.indexOf(sec)] >= layout.terminusY ? END : 0;
  }

  let lastVars = '';
  function paintPalette(y) {
    const tops = layout.palTops, center = y + vh / 2, W = vh * 0.55;
    let a = 0, b = 0, t = 0;
    for (let i = 0; i < tops.length; i++) if (tops[i] <= center) a = b = i;
    for (let j = 1; j < tops.length; j++) {
      if (Math.abs(center - tops[j]) < W / 2) { a = j - 1; b = j; t = smooth(clamp((center - (tops[j] - W / 2)) / W)); break; }
    }
    const pa = palettes[a], pb = palettes[b];
    const bg = mixRgb(pa.bg, pb.bg, t);
    let fg = mixRgb(pa.fg, pb.fg, t);
    if (contrast(fg, bg) < 4.5) fg = best([pa.fg, pb.fg, INK, WHITE], bg);
    let ac = mixRgb(pa.ac, pb.ac, t);
    if (contrast(ac, bg) < 3) ac = best([pa.ac, pb.ac], bg);
    const key = bg.join() + fg.join() + ac.join();
    if (key === lastVars) return;
    lastVars = key;
    root.style.setProperty('--bg', rgb(bg));
    root.style.setProperty('--fg', rgb(fg));
    root.style.setProperty('--accent', rgb(ac));
  }

  const parallax = kinetic ? $$('[data-speed], .st-scape').map(el => ({
    el,
    speed: el.dataset.speed ? +el.dataset.speed : -0.12,
    host: el.closest('section'),
    tilt: el.classList.contains('st-visual'),
    name: el.classList.contains('st-name'),
  })) : [];
  const arts = kinetic ? $$('.art') : [];
  const termLine = $('.term-line');

  function paintParallax() {
    for (const p of parallax) {
      const r = p.host.getBoundingClientRect();
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) continue;
      const off = r.top + r.height / 2 - vh / 2;
      // the huge names may only drift a little, or they would run into the text below on tall mobile sections
      const lim = p.name ? (desktop.matches ? 60 : 14) : 90;
      p.el.style.setProperty('--py', clamp(off * p.speed, -lim, lim).toFixed(1) + 'px');
      if (p.tilt) p.el.style.setProperty('--rot', (off / vh * 2.5).toFixed(2) + 'deg');
    }
    // each drawing closes (the anatomy explodes) as it comes into view
    for (const el of arts) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) continue;
      el.style.setProperty('--e', smooth(clamp((vh * 0.95 - r.top) / (vh * 0.6))).toFixed(3));
      el.style.setProperty('--rot', ((r.top + r.height / 2 - vh / 2) / vh * -2.5).toFixed(2) + 'deg');
    }
    if (termLine) {
      const r = terminus.getBoundingClientRect();
      const p = clamp((vh * 0.95 - r.top) / (vh * 0.75));
      termLine.style.setProperty('--p', p.toFixed(3));
      termLine.style.setProperty('--dot', p > 0.98 ? 1 : 0);
    }
  }

  function renderTrain(u) {
    const passed = Math.min(END - 1, Math.floor(u + 0.01));
    if (rail) {
      const len = unitsToLen(u);
      rail.progress.style.strokeDasharray = `${len.toFixed(1)} ${rail.total + 20}`;
      const p = rail.progress.getPointAtLength(len);
      const a = rail.progress.getPointAtLength(Math.max(0, len - 2));
      const b = rail.progress.getPointAtLength(Math.min(rail.total, len + 2));
      const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      rail.train.setAttribute('transform', `translate(${f1(p.x)} ${f1(p.y)}) rotate(${ang.toFixed(1)})`);
      const current = kinetic ? passed : 99;
      if (current !== rail.current) {
        rail.current = current;
        rail.dots.forEach((dot, i) => dot.classList.toggle('is-passed', i <= current));
        rail.rings.forEach((ring, i) => ring.classList.toggle('is-current', kinetic && i === current && u < END - 0.5));
        rail.labels.forEach((li, i) => {
          li.classList.toggle('is-passed', i <= current);
          li.classList.toggle('is-current', i === current);
          const link = li.firstElementChild;
          if (i === current) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
        });
      }
    }
    if (mrail) {
      const pct = (u / END) * 100;
      mrail.style.setProperty('--mp', (pct / 100).toFixed(4));
      mrail.style.setProperty('--mx', (mrail.clientWidth * pct / 100).toFixed(1) + 'px');
      mDots.forEach((dot, i) => dot.classList.toggle('is-passed', i <= u + 0.01));
    }
  }

  let shownU = 0, raf = 0, snap = true;
  function frame() {
    raf = 0;
    const y = scrollY;
    if (kinetic) { paintPalette(y); paintParallax(); }
    const target = kinetic ? unitsAt(y) : unitsStatic(y);
    if (snap || !kinetic) shownU = target;
    else shownU += (target - shownU) * 0.14;
    if (Math.abs(target - shownU) < 0.002) shownU = target;
    snap = false;
    renderTrain(shownU);
    renderHud(y, shownU);
    if (shownU !== target) raf = requestAnimationFrame(frame);
  }
  const request = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const relayout = () => { measure(); request(); };

  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', relayout);
  addEventListener('load', relayout);
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(document.body);
  if (document.fonts) document.fonts.ready.then(relayout);
  measure();
  frame();

  if (kinetic && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { threshold: 0.35 });
    $$('.station--neon').forEach(el => io.observe(el));
  }

  /* ================= Debug: ?at= ================= */
  const at = params.get('at');
  if (at !== null) {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(() => {
      measure();
      let y = null;
      if (/^[\d.]+$/.test(at)) y = parseFloat(at) * (root.scrollHeight - innerHeight);
      else if (document.getElementById(at)) y = document.getElementById(at).getBoundingClientRect().top + scrollY;
      if (y === null) return;
      root.style.scrollBehavior = 'auto';
      scrollTo(0, y);
      snap = true;
      frame();
    }, 50));
  }
})();
