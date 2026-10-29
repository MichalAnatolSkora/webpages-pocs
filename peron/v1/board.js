// Peron v1 — the split-flap departures board and the station clock in the sign.

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const Board = (() => {
  const CHARSET = 'ABCDEFGHIJKLMNOPRSTUWZĄĆĘŁŃÓŚŹŻ0123456789:.-+';
  const pad = (s, n) => { s = String(s || '').toUpperCase(); return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n, ' '); };

  // cols: [{ key, label, w, hide }] — hide is a breakpoint class so narrow screens drop columns instead of shrinking glyphs
  function mount(el, cols, rows) {
    el.innerHTML = `<div class="board__head" aria-hidden="true">${cols.map(c => `<span class="bc bc--${c.key} ${c.hide || ''}" style="--n:${c.w}">${c.label}</span>`).join('')}</div>`
      + rows.map(r => `<a class="board__row" href="${r.href}" data-id="${r.id}" aria-label="${r.label}">${cols.map(c =>
        `<span class="bc bc--${c.key} ${c.hide || ''}" style="--n:${c.w}" aria-hidden="true">${Array.from({ length: c.w }, () => '<span class="fl"><i> </i></span>').join('')}</span>`).join('')}</a>`).join('');
    el._cols = cols;
    update(el, rows, true);
  }

  function update(el, rows, first) {
    const rowEls = el.querySelectorAll('.board__row');
    rows.forEach((r, ri) => {
      const row = rowEls[ri];
      if (!row) return;
      row.className = 'board__row' + (r.tone ? ' is-' + r.tone : '');
      row.setAttribute('aria-label', r.label);
      row.href = r.href;
      el._cols.forEach((c, ci) => {
        const text = pad(r[c.key], c.w);
        const cells = row.children[ci].children;
        for (let i = 0; i < c.w; i++) setCell(cells[i], text[i], first ? ri * 90 + ci * 40 + i * 14 : i * 20);
      });
    });
  }

  function setCell(cell, ch, delay) {
    const glyph = cell.firstChild;
    if (cell._target === ch) return;
    cell._target = ch;
    clearTimeout(cell._t);
    if (REDUCED) { glyph.textContent = ch; return; }
    let steps = 2 + Math.floor(Math.random() * 4);
    const tick = () => {
      const last = steps-- <= 0;
      glyph.textContent = last ? ch : CHARSET[Math.floor(Math.random() * CHARSET.length)];
      cell.classList.remove('is-f'); void cell.offsetWidth; cell.classList.add('is-f');
      if (!last) cell._t = setTimeout(tick, 62);
    };
    cell._t = setTimeout(tick, delay);
  }

  return { mount, update };
})();

// station clock: ticks once, hands every second; the red second hand is the only colour in the sign
(function clock() {
  const svg = document.querySelector('.clock');
  if (!svg) return;
  svg.querySelector('.clock__ticks').innerHTML = Array.from({ length: 60 }, (_, i) => {
    const big = i % 5 === 0;
    return `<line x1="50" y1="${big ? 7 : 7}" x2="50" y2="${big ? 17 : 11}" class="${big ? 'tk tk--b' : 'tk'}" transform="rotate(${i * 6} 50 50)"/>`;
  }).join('');
  const h = svg.querySelector('.clock__h'), m = svg.querySelector('.clock__m'), s = svg.querySelector('.clock__s');
  function set() {
    const d = new Date();
    h.setAttribute('transform', `rotate(${(d.getHours() % 12) * 30 + d.getMinutes() * 0.5} 50 50)`);
    m.setAttribute('transform', `rotate(${d.getMinutes() * 6} 50 50)`);
    s.setAttribute('transform', `rotate(${d.getSeconds() * 6} 50 50)`);
  }
  set();
  setInterval(set, 1000);
})();
