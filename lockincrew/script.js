// MATRIX RAIN — claude-tinted
(() => {
  const canvas = document.getElementById('matrix');
  const ctx = canvas.getContext('2d');

  let w, h, cols, drops, active;
  const charset = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ01ABCDEFLOCKINCREW{}<>/=*+-_$#@&';
  const fontSize = 18;
  const columnDensity = 0.45;
  let speedBoost = 1;

  function resize() {
    w = canvas.width = window.innerWidth * window.devicePixelRatio;
    h = canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    const total = Math.floor(w / (fontSize * window.devicePixelRatio));
    cols = total;
    drops = new Array(cols).fill(0).map(() => Math.random() * -80);
    active = new Array(cols).fill(0).map(() => Math.random() < columnDensity);
  }
  resize();
  window.addEventListener('resize', resize);

  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  let frame = 0;
  function draw() {
    frame++;
    ctx.fillStyle = 'rgba(33, 30, 26, 0.12)';
    ctx.fillRect(0, 0, w, h);

    if (frame % 2 !== 0) { requestAnimationFrame(draw); return; }

    ctx.font = `${fontSize * window.devicePixelRatio}px JetBrains Mono, monospace`;
    ctx.textBaseline = 'top';

    for (let i = 0; i < cols; i++) {
      if (!active[i]) continue;
      const ch = rand(charset);
      const x = i * fontSize * window.devicePixelRatio;
      const y = drops[i] * fontSize * window.devicePixelRatio;

      // soft head
      ctx.fillStyle = 'rgba(247, 236, 217, 0.5)';
      ctx.fillText(ch, x, y);

      // short trail, pastel
      ctx.fillStyle = 'rgba(232, 183, 154, 0.28)';
      if (drops[i] > 1) ctx.fillText(rand(charset), x, y - fontSize * window.devicePixelRatio);

      if (y > h && Math.random() > 0.97) {
        drops[i] = 0;
        active[i] = Math.random() < columnDensity;
      }
      drops[i] += 0.35 * speedBoost;
    }
    requestAnimationFrame(draw);
  }
  draw();

  window._matrixBoost = (m) => { speedBoost = m; };
})();

// SESSION TIMER
(() => {
  const el = document.getElementById('session-time');
  if (!el) return;
  const start = Date.now();
  function tick() {
    const s = Math.floor((Date.now() - start) / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    el.textContent = `${hh}:${mm}:${ss}`;
  }
  tick();
  setInterval(tick, 1000);
})();

// STAT COUNTERS
(() => {
  const stats = document.querySelectorAll('.stat-num');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseInt(el.dataset.target, 10);
      if (target === 0) { el.textContent = '0'; obs.unobserve(el); return; }
      let cur = 0;
      const dur = 1400;
      const t0 = performance.now();
      function step(t) {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(eased * target).toString();
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.4 });
  stats.forEach(s => obs.observe(s));
})();

// FOOTER YEAR + BUILD + UPTIME
(() => {
  document.getElementById('year').textContent = new Date().getFullYear();
  const build = Math.floor(1000 + Math.random() * 9000);
  document.getElementById('build').textContent = build;
  const upEl = document.getElementById('uptime');
  const t0 = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    upEl.textContent = `${s}s`;
  }, 1000);
})();

// LOCK-IN MODE — press L
(() => {
  const overlay = document.getElementById('lockin-overlay');
  const closeBtn = document.getElementById('lockin-close');
  const label = document.getElementById('status-label');

  function open() {
    overlay.classList.add('on');
    if (window._matrixBoost) window._matrixBoost(2.4);
    label.textContent = 'DEEP_FOCUS';
  }
  function close() {
    overlay.classList.remove('on');
    if (window._matrixBoost) window._matrixBoost(1);
    label.textContent = 'LOCKED_IN';
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'l' || e.key === 'L') open();
    if (e.key === 'Escape') close();
  });
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
})();

// FAKE STATUS FLICKER
(() => {
  const states = ['LOCKED_IN', 'SHIPPING', 'COMPILING', 'LOCKED_IN', 'LOCKED_IN', 'IN_THE_ZONE'];
  const label = document.getElementById('status-label');
  setInterval(() => {
    if (document.getElementById('lockin-overlay').classList.contains('on')) return;
    const next = states[Math.floor(Math.random() * states.length)];
    label.style.opacity = '0.3';
    setTimeout(() => {
      label.textContent = next;
      label.style.opacity = '1';
    }, 120);
  }, 5200);
})();

// FORM — fake "send"
(() => {
  const form = document.querySelector('.term-form');
  if (!form) return;
  form.addEventListener('submit', () => {
    const body = document.querySelector('.term-body');
    const ok = document.createElement('p');
    ok.className = 'term-out';
    ok.style.color = '#7fa86b';
    ok.textContent = '> brief queued. expect a reply from a human within 48h.';
    body.insertBefore(ok, body.lastElementChild);
    form.reset();
  });
})();
