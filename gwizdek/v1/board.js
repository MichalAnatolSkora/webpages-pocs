// Gwizdek v1 — tactic board. Drawings are 100 × 64 units: pieces with positions per frame, arrows per
// frame, zones shared by all frames. boardSvg() draws one frame (thumbnails, print), animateBoard()
// tweens pieces between frames, boardEditor() is the drawing tool.

const PIECES = {
  a: { label: 'Nasz zawodnik', fill: '#e8483b', ink: '#fff' },
  b: { label: 'Rywal', fill: '#2563eb', ink: '#fff' },
  n: { label: 'Joker', fill: '#f5c400', ink: '#1a1a1a' },
  gk: { label: 'Bramkarz', fill: '#1f2937', ink: '#d4f53c' },
  cone: { label: 'Pachołek' },
  ball: { label: 'Piłka' },
  mini: { label: 'Mała bramka' },
  goal: { label: 'Bramka' },
  pole: { label: 'Tyczka' },
  ladder: { label: 'Drabinka' },
};
const ARROWS = {
  pass: { label: 'Podanie', color: '#ffffff', dash: '1.6 1.1', w: 0.5 },
  run: { label: 'Bieg bez piłki', color: '#ffe14d', w: 0.5 },
  drib: { label: 'Prowadzenie piłki', color: '#ffffff', w: 0.45, wavy: true },
  shot: { label: 'Strzał', color: '#ff5a4a', w: 0.85 },
};
const PITCH_KINDS = { grid: 'Pole treningowe', half: 'Połowa boiska', full: 'Całe boisko' };

function bdPitch(kind) {
  let s = '<rect x="-4" y="-4" width="108" height="72" fill="var(--grass)"/>';
  for (let i = 0; i < 10; i++) if (i % 2) s += `<rect x="${i * 10}" y="-4" width="10" height="72" fill="#fff" opacity=".04"/>`;
  s += '<g fill="none" stroke="#fff" stroke-opacity=".78" stroke-width=".35">';
  if (kind === 'grid') {
    s += '<g stroke-opacity=".14">';
    for (let x = 10; x < 100; x += 10) s += `<line x1="${x}" y1="0" x2="${x}" y2="64"/>`;
    for (let y = 8; y < 64; y += 8) s += `<line x1="0" y1="${y}" x2="100" y2="${y}"/>`;
    s += '</g><rect x="0" y="0" width="100" height="64" stroke-dasharray="1.5 1.5" stroke-opacity=".4"/>';
  } else {
    s += '<rect x="0" y="0" width="100" height="64"/>';
    const box = (x0, dir, depth, gd, spot, r) => {
      const x1 = x0 + dir * depth, g = x0 + dir * gd, sp = x0 + dir * spot, dx = Math.abs(x1 - sp), dy = Math.sqrt(r * r - dx * dx);
      return `<path d="M${x0} 13H${x1}V51H${x0}"/><path d="M${x0} 23.5H${g}V40.5H${x0}"/><circle cx="${sp}" cy="32" r=".45" fill="#fff" stroke="none"/>
        <path d="M${x1} ${32 - dy}A${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${x1} ${32 + dy}"/>
        <rect x="${dir > 0 ? x0 - 2.2 : x0}" y="28.3" width="2.2" height="7.4" fill="#fff" fill-opacity=".18"/>`;
    };
    if (kind === 'half') {
      s += box(100, -1, 22, 8, 15, 9.5);
      s += '<path d="M0 22A10 10 0 0 1 0 42"/><circle cx="0" cy="32" r=".5" fill="#fff" stroke="none"/>';
    } else {
      s += '<line x1="50" y1="0" x2="50" y2="64"/><circle cx="50" cy="32" r="8.5"/><circle cx="50" cy="32" r=".45" fill="#fff" stroke="none"/>';
      s += box(0, 1, 15, 5.5, 10.5, 8.5) + box(100, -1, 15, 5.5, 10.5, 8.5);
    }
  }
  return s + '</g>';
}

function bdPiece(o, [x, y]) {
  const P = PIECES[o.t];
  let body = '';
  if (P.fill) {
    body = `<circle r="2.4" fill="${P.fill}" stroke="#fff" stroke-width=".4"/>` +
      (o.n ? `<text y=".85" text-anchor="middle" font-size="${o.n.length > 1 ? 2 : 2.4}" font-weight="700" fill="${P.ink}" font-family="Barlow, system-ui, sans-serif">${esc(o.n)}</text>` : '');
  } else if (o.t === 'cone') body = '<path d="M-1.5 1.3L0-1.7 1.5 1.3z" fill="#ff7a1a" stroke="#fff" stroke-width=".2"/>';
  else if (o.t === 'ball') body = '<circle r="1.2" fill="#fff" stroke="#111" stroke-width=".3"/><circle r=".45" fill="#111"/>';
  else if (o.t === 'mini') body = '<rect x="-.9" y="-2.8" width="1.8" height="5.6" fill="#fff" fill-opacity=".25" stroke="#fff" stroke-width=".35"/>';
  else if (o.t === 'goal') body = '<rect x="-1.1" y="-4" width="2.2" height="8" fill="#fff" fill-opacity=".25" stroke="#fff" stroke-width=".45"/>';
  else if (o.t === 'pole') body = '<line x1="0" y1="1" x2="0" y2="-3.2" stroke="#f5c400" stroke-width=".55"/><circle cy="1" r=".8" fill="#f5c400"/>';
  else if (o.t === 'ladder') {
    body = '<rect x="-7" y="-1.7" width="14" height="3.4" fill="none" stroke="#f5c400" stroke-width=".35"/>';
    for (let i = 1; i < 8; i++) body += `<line x1="${-7 + i * 1.75}" y1="-1.7" x2="${-7 + i * 1.75}" y2="1.7" stroke="#f5c400" stroke-width=".3"/>`;
  }
  return `<g class="bd-piece" data-id="${o.id}" transform="translate(${x} ${y})">${body}<circle class="bd-hit" r="3.2" fill="transparent"/></g>`;
}

function bdLinePath(l) {
  const [x1, y1] = l.a, [x2, y2] = l.b, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, end = L > 4 ? L - 1.1 : L;
  if (!ARROWS[l.t].wavy) return `M${x1} ${y1}L${x1 + ux * end} ${y1 + uy * end}`;
  const waves = Math.max(2, Math.round(end / 3.2)), steps = waves * 10;
  let p = `M${x1} ${y1}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, along = t * end, fade = t > 0.85 ? (1 - t) / 0.15 : 1;
    const off = Math.sin(t * waves * Math.PI * 2) * 0.9 * fade;
    p += `L${(x1 + ux * along - uy * off).toFixed(2)} ${(y1 + uy * along + ux * off).toFixed(2)}`;
  }
  return p;
}
const bdLine = (l, key) => {
  const A = ARROWS[l.t];
  return `<path class="bd-line" data-line="${l.id}" d="${bdLinePath(l)}" fill="none" stroke="${A.color}" stroke-width="${A.w}" stroke-linecap="round" ${A.dash ? `stroke-dasharray="${A.dash}"` : ''} marker-end="url(#${key}-${l.t})"/>`;
};
const ZONE_FILL = { a: '#e8483b', b: '#2563eb', n: '#ffffff' };
const bdZone = z => `<rect class="bd-zone" data-zone="${z.id}" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx=".6" fill="${ZONE_FILL[z.c] || '#fff'}" fill-opacity="${z.c === 'n' ? 0.08 : 0.16}" stroke="${ZONE_FILL[z.c] || '#fff'}" stroke-opacity=".7" stroke-width=".3" stroke-dasharray="1.2 .8"/>`;

function bdDefs(key) {
  return `<defs>${Object.entries(ARROWS).map(([t, A]) => `<marker id="${key}-${t}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="${t === 'shot' ? 3.4 : 4.4}" markerHeight="${t === 'shot' ? 3.4 : 4.4}" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${A.color}"/></marker>`).join('')}</defs>`;
}

function boardSvg(b, { frame = 0, cls = '', label = 'Rysunek ćwiczenia' } = {}) {
  const key = uid('bd'), f = b.frames[frame] || b.frames[0];
  return `<svg class="board ${cls}" viewBox="-4 -4 108 72" role="img" aria-label="${esc(label)}" data-key="${key}">${bdDefs(key)}${bdPitch(b.pitch)}
    <g class="bd-zones">${b.zones.map(bdZone).join('')}</g>
    <g class="bd-lines">${f.lines.map(l => bdLine(l, key)).join('')}</g>
    <g class="bd-objs">${b.objs.map(o => bdPiece(o, f.p[o.id] || [50, 32])).join('')}</g></svg>`;
}

// Tween pieces frame by frame; each frame's arrows show while its moves play out.
function animateBoard(svg, b, { seg = 1100, onFrame, onEnd } = {}) {
  const key = svg.dataset.key, lines = $('.bd-lines', svg);
  const g = Object.fromEntries($$('.bd-piece', svg).map(el => [el.dataset.id, el]));
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const n = b.frames.length;
  let raf, shown = -1, t0 = performance.now(), stopped = false;
  const setLines = k => { if (k !== shown) { shown = k; lines.innerHTML = b.frames[k].lines.map(l => bdLine(l, key)).join(''); if (onFrame) onFrame(k); } };
  const tick = now => {
    if (stopped) return;
    const el = now - t0, k = Math.floor(el / seg);
    if (k >= n - 1) {
      b.objs.forEach(o => { const p = b.frames[n - 1].p[o.id]; if (p && g[o.id]) g[o.id].setAttribute('transform', `translate(${p[0]} ${p[1]})`); });
      setLines(n - 1);
      if (el > seg * (n - 1) + 700) { stopped = true; if (onEnd) onEnd(); return; }
    } else {
      setLines(k);
      const t = ease((el % seg) / seg), A = b.frames[k].p, B = b.frames[k + 1].p;
      b.objs.forEach(o => {
        const a = A[o.id], c = B[o.id] || a;
        if (a && g[o.id]) g[o.id].setAttribute('transform', `translate(${a[0] + (c[0] - a[0]) * t} ${a[1] + (c[1] - a[1]) * t})`);
      });
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}

// A read-only board with a play button (exercise page, plan view)
function boardPlayer(host, b) {
  host.innerHTML = `<div class="bplay">${boardSvg(b)}${b.frames.length > 1 ? `<button type="button" class="bplay__btn">${ic('play')} Animacja · ${nOf(b.frames.length, 'klatka', 'klatki', 'klatek')}</button>` : ''}</div>`;
  const btn = $('.bplay__btn', host);
  if (!btn) return;
  let stop = null;
  btn.addEventListener('click', () => {
    if (stop) { stop(); stop = null; host.innerHTML = ''; return boardPlayer(host, b); }
    btn.innerHTML = `${ic('stop')} Zatrzymaj`;
    stop = animateBoard($('svg', host), b, { onEnd: () => { stop = null; btn.innerHTML = `${ic('play')} Odtwórz ponownie`; } });
  });
}

const emptyBoard = (pitch = 'grid') => ({ pitch, objs: [], zones: [], frames: [{ p: {}, lines: [] }] });

// ---------- editor ----------
function boardEditor(host, data, { onSave, onCancel, saveLabel = 'Zapisz rysunek' } = {}) {
  let b = JSON.parse(JSON.stringify(data || emptyBoard()));
  let frame = 0, tool = 'move', zoneColor = 'n', history = [], stopPlay = null, drag = null;

  const toolBtn = (id, label, glyph) => `<button type="button" class="bed__tool" data-tool="${id}" title="${esc(label)}" aria-label="${esc(label)}">${glyph}</button>`;
  const dot = t => `<svg viewBox="-3 -3 6 6" class="bed__glyph" aria-hidden="true"><circle r="2.4" fill="${PIECES[t].fill}" stroke="#fff" stroke-width=".4"/></svg>`;
  const mini = t => `<svg viewBox="-4 -4 8 8" class="bed__glyph" aria-hidden="true" style="background:var(--grass);border-radius:4px">${bdPiece({ id: 'g', t, n: '' }, [0, 0]).replace('class="bd-piece"', '')}</svg>`;
  const arrowGlyph = t => `<svg viewBox="0 0 24 24" class="bed__glyph" aria-hidden="true" style="background:var(--grass);border-radius:4px"><path d="${t === 'drib' ? 'M3 12q2-4 4 0t4 0 4 0 4 0' : 'M3 18L19 6'}" fill="none" stroke="${ARROWS[t].color}" stroke-width="${t === 'shot' ? 2.6 : 1.8}" ${ARROWS[t].dash ? 'stroke-dasharray="3 2"' : ''}/><path d="${t === 'drib' ? 'M19 9l3 3-3 3' : 'M14 6h5v5'}" fill="none" stroke="${ARROWS[t].color}" stroke-width="1.8"/></svg>`;

  host.innerHTML = `<div class="bed">
    <div class="bed__bar" role="toolbar" aria-label="Narzędzia rysunku">
      <div class="bed__grp">${toolBtn('move', 'Przesuwanie', ic('move'))}${toolBtn('erase', 'Gumka', ic('eraser'))}</div>
      <div class="bed__grp">${['a', 'b', 'n', 'gk'].map(t => toolBtn(t, PIECES[t].label, dot(t))).join('')}</div>
      <div class="bed__grp">${['ball', 'cone', 'mini', 'goal', 'pole', 'ladder'].map(t => toolBtn(t, PIECES[t].label, mini(t))).join('')}</div>
      <div class="bed__grp">${Object.keys(ARROWS).map(t => toolBtn('l-' + t, ARROWS[t].label, arrowGlyph(t))).join('')}</div>
      <div class="bed__grp">${toolBtn('zone', 'Strefa', ic('zone'))}
        <span class="bed__zc" role="radiogroup" aria-label="Kolor strefy">${Object.keys(ZONE_FILL).map(c => `<button type="button" role="radio" data-zc="${c}" style="--zc:${ZONE_FILL[c]}" aria-label="${c === 'a' ? 'Czerwona' : c === 'b' ? 'Niebieska' : 'Biała'}"></button>`).join('')}</span></div>
    </div>
    <p class="bed__hint" aria-live="polite"></p>
    <div class="bed__stage"></div>
    <div class="bed__frames">
      <div class="bed__fl" role="tablist" aria-label="Klatki animacji"></div>
      <button type="button" class="btn btn--sm btn--ghost" data-act="add-frame">${ic('plus')} Klatka</button>
      <button type="button" class="btn btn--sm btn--ghost" data-act="del-frame">${ic('trash')} Usuń klatkę</button>
      <button type="button" class="btn btn--sm btn--lime" data-act="play">${ic('play')} Odtwórz</button>
    </div>
    <div class="bed__foot">
      <label class="field field--inline"><span>Tło</span><select class="input input--sm" data-act="pitch">${Object.entries(PITCH_KINDS).map(([k, v]) => `<option value="${k}" ${b.pitch === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <button type="button" class="btn btn--sm btn--ghost" data-act="undo">${ic('undo')} Cofnij</button>
      <button type="button" class="btn btn--sm btn--ghost" data-act="clear">${ic('trash')} Wyczyść</button>
      <span class="grow"></span>
      ${onCancel ? '<button type="button" class="btn btn--ghost" data-act="cancel">Anuluj</button>' : ''}
      <button type="button" class="btn btn--primary" data-act="save">${ic('check')} ${saveLabel}</button>
    </div></div>`;

  const stage = $('.bed__stage', host), hint = $('.bed__hint', host);
  const HINTS = {
    move: 'Przeciągaj elementy. Zmiana w klatce przenosi się na dalsze klatki, w których element jeszcze stał w tym samym miejscu.',
    erase: 'Kliknij element, strzałkę albo strefę, żeby ją usunąć.',
    zone: 'Przeciągnij, żeby zaznaczyć strefę. Strefy są wspólne dla wszystkich klatek.',
  };
  const snapshot = () => { history.push(JSON.stringify(b)); if (history.length > 60) history.shift(); };
  const svg = () => $('svg', stage);
  const toPt = e => {
    const s = svg(), pt = s.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(s.getScreenCTM().inverse());
    return [clamp(+p.x.toFixed(1), -2, 102), clamp(+p.y.toFixed(1), -2, 66)];
  };
  const snap = pt => {
    const f = b.frames[frame].p;
    let best = null, bd = 3.2;
    b.objs.forEach(o => { const q = f[o.id]; if (!q) return; const dd = Math.hypot(q[0] - pt[0], q[1] - pt[1]); if (dd < bd) { bd = dd; best = q; } });
    return best ? [...best] : pt;
  };

  function draw() {
    stage.innerHTML = boardSvg(b, { frame, cls: 'board--edit', label: 'Tablica taktyczna' });
    $$('.bed__tool', host).forEach(x => x.classList.toggle('is-on', x.dataset.tool === tool));
    $$('[data-zc]', host).forEach(x => x.setAttribute('aria-checked', String(x.dataset.zc === zoneColor)));
    $('.bed__fl', host).innerHTML = b.frames.map((_, i) => `<button type="button" role="tab" class="bed__f ${i === frame ? 'is-on' : ''}" aria-selected="${i === frame}" data-frame="${i}">${i + 1}</button>`).join('');
    $('[data-act="del-frame"]', host).disabled = b.frames.length < 2;
    $('[data-act="undo"]', host).disabled = !history.length;
    hint.textContent = HINTS[tool] || (tool.startsWith('l-') ? `${ARROWS[tool.slice(2)].label}: przeciągnij od zawodnika do celu. Strzałki należą do bieżącej klatki (${frame + 1}).` : `Kliknij na boisku, żeby postawić: ${PIECES[tool].label.toLowerCase()}.`);
  }

  function stopAnim() { if (stopPlay) { stopPlay(); stopPlay = null; } $('[data-act="play"]', host).innerHTML = `${ic('play')} Odtwórz`; }

  host.addEventListener('click', e => {
    const t = e.target.closest('[data-tool]'), f = e.target.closest('[data-frame]'), zc = e.target.closest('[data-zc]'), act = e.target.closest('[data-act]');
    if (t) { stopAnim(); tool = t.dataset.tool; draw(); }
    if (zc) { zoneColor = zc.dataset.zc; tool = 'zone'; draw(); }
    if (f) { stopAnim(); frame = +f.dataset.frame; draw(); }
    if (!act || act.tagName === 'SELECT') return;
    const a = act.dataset.act;
    if (a === 'add-frame') {
      stopAnim(); snapshot();
      b.frames.splice(frame + 1, 0, { p: { ...b.frames[frame].p }, lines: [] });
      frame++; draw();
      hint.textContent = `Klatka ${frame + 1}: przesuń zawodników tam, gdzie mają się znaleźć, i dorysuj kolejne strzałki.`;
    }
    if (a === 'del-frame' && b.frames.length > 1) { stopAnim(); snapshot(); b.frames.splice(frame, 1); frame = Math.max(0, frame - 1); draw(); }
    if (a === 'undo' && history.length) { stopAnim(); b = JSON.parse(history.pop()); frame = Math.min(frame, b.frames.length - 1); draw(); }
    if (a === 'clear') { stopAnim(); snapshot(); b = emptyBoard(b.pitch); frame = 0; draw(); }
    if (a === 'play') {
      if (stopPlay) return stopAnim();
      if (b.frames.length < 2) return toast('Dodaj drugą klatkę i przesuń zawodników — wtedy będzie co animować', 'info');
      stage.innerHTML = boardSvg(b, { frame: 0, cls: 'board--edit' });
      act.innerHTML = `${ic('stop')} Stop`;
      stopPlay = animateBoard(svg(), b, { onFrame: k => $$('.bed__f', host).forEach((x, i) => x.classList.toggle('is-play', i === k)), onEnd: () => { stopPlay = null; stopAnim(); draw(); } });
    }
    if (a === 'cancel' && onCancel) { stopAnim(); onCancel(); }
    if (a === 'save' && onSave) { stopAnim(); onSave(JSON.parse(JSON.stringify(b))); }
  });
  $('[data-act="pitch"]', host).addEventListener('change', e => { snapshot(); b.pitch = e.target.value; draw(); });

  const nextNum = t => {
    if (t === 'gk') return '1';
    if (t === 'n') return 'J';
    const used = new Set(b.objs.filter(o => o.t === t).map(o => o.n));
    for (let i = 2; i < 40; i++) if (!used.has(String(i))) return String(i);
    return '';
  };

  stage.addEventListener('pointerdown', e => {
    if (stopPlay || e.button > 0) return;
    const pt = toPt(e), f = b.frames[frame];
    if (tool === 'move') {
      const g = e.target.closest('[data-id]');
      if (!g) return;
      snapshot();
      const id = g.dataset.id, cur = f.p[id];
      drag = { kind: 'piece', id, g, off: [pt[0] - cur[0], pt[1] - cur[1]], old: [...cur] };
    } else if (tool === 'erase') {
      const g = e.target.closest('[data-id]'), l = e.target.closest('[data-line]'), z = e.target.closest('[data-zone]');
      if (!g && !l && !z) return;
      snapshot();
      if (g) { b.objs = b.objs.filter(o => o.id !== g.dataset.id); b.frames.forEach(fr => delete fr.p[g.dataset.id]); }
      else if (l) f.lines = f.lines.filter(x => x.id !== l.dataset.line);
      else b.zones = b.zones.filter(x => x.id !== z.dataset.zone);
      draw();
      return;
    } else if (tool.startsWith('l-')) {
      const start = snap(pt), t = tool.slice(2);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', ARROWS[t].color); path.setAttribute('stroke-width', ARROWS[t].w);
      if (ARROWS[t].dash) path.setAttribute('stroke-dasharray', ARROWS[t].dash);
      path.setAttribute('marker-end', `url(#${svg().dataset.key}-${t})`);
      $('.bd-lines', svg()).append(path);
      drag = { kind: 'line', t, start, path };
    } else if (tool === 'zone') {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('fill', ZONE_FILL[zoneColor]); r.setAttribute('fill-opacity', '.15'); r.setAttribute('stroke', ZONE_FILL[zoneColor]); r.setAttribute('stroke-width', '.3');
      $('.bd-zones', svg()).append(r);
      drag = { kind: 'zone', start: pt, rect: r };
    } else {
      snapshot();
      const id = uid('o');
      b.objs.push({ id, t: tool, n: PIECES[tool].fill ? nextNum(tool) : '' });
      b.frames.forEach(fr => { fr.p[id] = pt; });
      draw();
      return;
    }
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const pt = toPt(e);
    if (drag.kind === 'piece') {
      const np = [+(pt[0] - drag.off[0]).toFixed(1), +(pt[1] - drag.off[1]).toFixed(1)];
      b.frames[frame].p[drag.id] = np;
      drag.g.setAttribute('transform', `translate(${np[0]} ${np[1]})`);
    } else if (drag.kind === 'line') {
      drag.path.setAttribute('d', bdLinePath({ t: drag.t, a: drag.start, b: pt }));
      drag.end = pt;
    } else if (drag.kind === 'zone') {
      const [x0, y0] = drag.start;
      drag.box = { x: Math.min(x0, pt[0]), y: Math.min(y0, pt[1]), w: Math.abs(pt[0] - x0), h: Math.abs(pt[1] - y0) };
      Object.entries(drag.box).forEach(([k, v]) => drag.rect.setAttribute({ x: 'x', y: 'y', w: 'width', h: 'height' }[k], v));
    }
  });

  const endDrag = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.kind === 'piece') {
      const np = b.frames[frame].p[d.id];
      if (np[0] === d.old[0] && np[1] === d.old[1]) { history.pop(); return; }
      // carry the move into later frames where the piece hadn't been moved yet
      for (let k = frame + 1; k < b.frames.length; k++) {
        const q = b.frames[k].p[d.id];
        if (q && q[0] === d.old[0] && q[1] === d.old[1]) b.frames[k].p[d.id] = [...np];
        else break;
      }
      draw();
    } else if (d.kind === 'line') {
      if (d.end && Math.hypot(d.end[0] - d.start[0], d.end[1] - d.start[1]) > 2.5) {
        snapshot();
        b.frames[frame].lines.push({ id: uid('l'), t: d.t, a: d.start, b: d.end.map(v => +v.toFixed(1)) });
      }
      draw();
    } else if (d.kind === 'zone') {
      if (d.box && d.box.w > 3 && d.box.h > 3) {
        snapshot();
        b.zones.push({ id: uid('z'), c: zoneColor, ...Object.fromEntries(Object.entries(d.box).map(([k, v]) => [k, +v.toFixed(1)])) });
      }
      draw();
    }
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  host.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && history.length) { e.preventDefault(); b = JSON.parse(history.pop()); frame = Math.min(frame, b.frames.length - 1); draw(); }
  });

  draw();
  return { get: () => b, stop: stopAnim };
}

// Opens the editor in a large dialog; resolves with the drawing or null
function editBoardModal(data, title = 'Kreator rysunku') {
  return new Promise(resolve => {
    let out = null;
    const m = modal({ cls: 'modal--board', label: title, onClose: () => resolve(out), html: `${modalHead(title, 'Zawodnicy, sprzęt, strzałki i klatki animacji')}<div class="mb" data-host></div>` });
    boardEditor($('[data-host]', m.el), data, { onSave: b => { out = b; m.close(); }, onCancel: () => m.close() });
  });
}
