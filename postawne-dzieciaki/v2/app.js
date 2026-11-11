/* Postawne Dzieciaki v2 — ludzik przy pionie, sprawdzacz objawów, test skłonu, wady z podpowiedzią dla dziecka, przed/po, sale, zapisy */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const C = {
    ink: '#1f2747', tomato: '#ff6a4d', sun: '#ffc23a', mint: '#2fc39a', sky: '#4b9dff', lilac: '#9b7bff', pink: '#ff8fb8',
    skin: '#f2c6a0', skin2: '#e3ad84',
  };
  const BEADS = [C.tomato, C.sun, C.mint, C.sky, C.lilac, C.pink];

  /* ---------- ludzik widziany od tyłu ----------
     s: skrzywienie boczne kręgosłupa, t: asymetria barków i miednicy, k: koślawe kolana,
     h: głowa poza osią, w: odstające łopatki, a: kąt rąk od pionu, L: uniesiona noga (bocian) */
  const rad = d => d * Math.PI / 180;
  const lerp = (a, b, u) => a + (b - a) * u;
  const pt = p => p.map(n => n.toFixed(1)).join(' ');

  function kid(p = {}) {
    const o = Object.assign({ s: 0, t: 0, k: 0, h: 0, w: 0, a: 12, L: 0, shirt: C.sky, shorts: C.ink, hair: '#6b4330', bun: true, plumb: true, beads: true }, p);
    const spineX = u => 100 + o.s * 15 * Math.sin(2 * Math.PI * u) + o.h * 9 * (1 - u);
    const topY = 104, pelY = 200;
    const ts = rad(o.t * 9), th = rad(-o.t * 6);
    const sc = [spineX(0.04), topY];
    const shoulder = d => [sc[0] + d * 29 * Math.cos(ts), sc[1] + d * 29 * Math.sin(ts)];
    const hip = (d, r) => [100 + d * r * Math.cos(th), pelY + d * r * Math.sin(th)];
    const LS = shoulder(-1), RS = shoulder(1), LH = hip(-1, 25), RH = hip(1, 25);

    let g = '';
    if (o.plumb) {
      g += `<line x1="100" y1="4" x2="100" y2="318" stroke="${C.tomato}" stroke-width="1.6" stroke-dasharray="5 5" opacity=".9"/>`;
      g += `<circle cx="100" cy="4" r="3" fill="${C.ink}"/>`;
      g += `<path d="M100 318 l-6 8 q6 9 12 0z" fill="${C.ink}"/>`;
    }

    // nogi
    const legRoot = d => { const q = hip(d, 13); return [q[0], q[1] + 22]; };
    const leg = d => {
      const r = legRoot(d);
      let knee = [r[0] - d * o.k * 13, 268];
      let foot = [r[0] + d * (3 + o.k * 9), 318];
      if (d === 1 && o.L) {
        knee = [lerp(knee[0], r[0] + 24, o.L), lerp(knee[1], r[1] + 34, o.L)];
        foot = [lerp(foot[0], 103, o.L), lerp(foot[1], 266, o.L)];
      }
      return [r, knee, foot];
    };
    for (const d of [-1, 1]) {
      const [r, kn, f] = leg(d);
      g += `<polyline points="${pt(r)} ${pt(kn)} ${pt(f)}" fill="none" stroke="${C.skin}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>`;
      g += `<ellipse cx="${(f[0] + d * 3).toFixed(1)}" cy="${(f[1] + 4).toFixed(1)}" rx="12" ry="7" fill="${C.ink}"/>`;
    }

    // spodenki
    const crotch = [100 + (LH[0] + RH[0] - 200) / 2, (LH[1] + RH[1]) / 2 + 24];
    const lsh = hip(-1, 27), rsh = hip(1, 27);
    g += `<polygon points="${pt(lsh)} ${pt(rsh)} ${pt([rsh[0] + 3, rsh[1] + 34])} ${pt(crotch)} ${pt([lsh[0] - 3, lsh[1] + 34])}" fill="${o.shorts}" stroke="${o.shorts}" stroke-width="8" stroke-linejoin="round"/>`;

    // szyja
    const hc = [100 + o.h * 15, 62];
    g += `<line x1="${hc[0].toFixed(1)}" y1="72" x2="${sc[0].toFixed(1)}" y2="${topY}" stroke="${C.skin2}" stroke-width="15" stroke-linecap="round"/>`;

    // tułów (koszulka)
    const hipW = d => hip(d, 23);
    g += `<path d="M${pt(LS)} L${pt(RS)} Q${pt([RS[0] + 4, (RS[1] + RH[1]) / 2])} ${pt(hipW(1))} L${pt(hipW(-1))} Q${pt([LS[0] - 4, (LS[1] + LH[1]) / 2])} ${pt(LS)}Z" fill="${o.shirt}" stroke="${o.shirt}" stroke-width="18" stroke-linejoin="round"/>`;
    // ręce
    const arm = d => {
      const S = shoulder(d * 1.1);
      const a1 = rad(o.a), a2 = rad(o.a + (o.a < 100 ? 10 : -12));
      const E = [S[0] + d * 40 * Math.sin(a1), S[1] + 40 * Math.cos(a1)];
      const H = [E[0] + d * 38 * Math.sin(a2), E[1] + 38 * Math.cos(a2)];
      return [S, E, H];
    };
    for (const d of [-1, 1]) {
      const [S, E, H] = arm(d);
      g += `<polyline points="${pt(S)} ${pt(E)} ${pt(H)}" fill="none" stroke="${C.skin}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`;
      g += `<circle cx="${H[0].toFixed(1)}" cy="${H[1].toFixed(1)}" r="7.5" fill="${C.skin}"/>`;
    }

    // rękawki
    for (const d of [-1, 1]) {
      const S = shoulder(d * 1.02);
      g += `<circle cx="${S[0].toFixed(1)}" cy="${(S[1] + 6).toFixed(1)}" r="11" fill="${o.shirt}"/>`;
    }

    // łopatki
    if (o.w > 0) {
      for (const d of [-1, 1]) {
        const x = sc[0] + d * 17, y = topY + 26 + d * o.t * 3;
        const tip = [x + d * (3 + o.w * 9), y + 22 + o.w * 4];
        g += `<path d="M${pt([x - d * 9, y - 12])} L${pt([x + d * 9, y - 13])} L${pt(tip)} Z" fill="rgba(255,255,255,${0.15 + o.w * 0.3})" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" opacity="${0.35 + o.w * 0.65}"/>`;
      }
    }

    // głowa
    for (const d of [-1, 1]) g += `<circle cx="${(hc[0] + d * 24).toFixed(1)}" cy="64" r="6.5" fill="${C.skin}"/>`;
    g += `<circle cx="${hc[0].toFixed(1)}" cy="${hc[1]}" r="25" fill="${o.hair}"/>`;
    g += `<path d="M${(hc[0] - 18).toFixed(1)} 76 q18 10 36 0" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="3" stroke-linecap="round"/>`;
    if (o.bun) {
      g += `<circle cx="${hc[0].toFixed(1)}" cy="34" r="12" fill="${o.hair}"/>`;
      g += `<rect x="${(hc[0] - 9).toFixed(1)}" y="40" width="18" height="6" rx="3" fill="${C.pink}"/>`;
    } else {
      g += `<path d="M${(hc[0] - 6).toFixed(1)} 40 q4 -10 10 -4 q2 -8 8 -2" fill="none" stroke="${o.hair}" stroke-width="5" stroke-linecap="round"/>`;
    }

    // kręgosłup z koralików
    if (o.beads) {
      const n = 11;
      for (let i = 0; i < n; i++) {
        const u = 0.03 + (i / (n - 1)) * 0.94;
        const x = spineX(u), y = topY + 2 + u * (pelY - topY - 6);
        g += `<circle class="bead" style="--i:${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === n - 1 ? 4 : 4.8}" fill="${BEADS[i % BEADS.length]}" stroke="${C.ink}" stroke-width="1.6"/>`;
      }
    }
    return g;
  }

  /* ---------- HERO: przed i po, obok siebie ---------- */
  $('#heroBefore').innerHTML = kid({ s: .9, t: .9, k: .7, h: .6, w: .7, a: 15, plumb: true });
  $('#heroAfter').innerHTML = kid({ s: .05, t: .03, k: 0, h: 0, w: 0, a: 12 });

  /* ---------- miarka wzrostu i pasek postępu ---------- */
  const scale = $('#rulerScale'), rKid = $('#rulerKid'), rCm = $('#rulerCm'), topFill = $('#topbarFill');
  for (let cm = 180; cm >= 80; cm -= 10) {
    const s = document.createElement('span');
    s.textContent = cm;
    s.style.top = ((180 - cm) / 100 * 100) + '%';
    scale.appendChild(s);
  }
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    topFill.style.width = (p * 100) + '%';
    const r = scale.getBoundingClientRect();
    const y = r.top + r.height * (1 - p) - 15;
    rKid.style.transform = `translateY(${y.toFixed(1)}px)`;
    rCm.textContent = Math.round(80 + p * 100) + ' cm';
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------- menu ---------- */
  const burger = $('#burger'), nav = $('#nav');
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', open);
    nav.classList.toggle('is-open', open);
  });
  nav.addEventListener('click', e => {
    if (e.target.closest('a')) { burger.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); }
  });

  /* ---------- czy to dla nas ---------- */
  const tiles = $$('#checkTiles button'), cnt = $('#checkCount'), msg = $('#checkMsg'), cta = $('#checkCta');
  const MSG = [
    'Kliknij to, co zauważasz. Nie ma złych odpowiedzi.',
    'Jedna rzecz to jeszcze nie wada, ale warto ją sprawdzić. Diagnostyka trwa kilkanaście minut.',
    'Kilka sygnałów naraz. Badanie postawy powie, czy to wada i jakie ćwiczenia pomogą.',
    'To dużo jak na jedno dziecko. Umów diagnostykę, a dobierzemy plan i grupę.',
  ];
  tiles.forEach(b => b.addEventListener('click', () => {
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
    const n = tiles.filter(x => x.getAttribute('aria-pressed') === 'true').length;
    cnt.textContent = n;
    msg.textContent = MSG[n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3];
    cta.hidden = n === 0;
  }));

  /* ---------- test skłonu (Adamsa) ----------
     dziecko w skłonie widziane od tyłu: plecy jak kopułka, na nich poziomica.
     hump: 0 równo, 1 jedna strona wyżej (garb żebrowy) */
  function bend(hump) {
    const shirt = C.tomato, shorts = C.ink, hair = '#2b2b3a';
    const Ly = 128 + hump * 9, Ry = 128 - hump * 13;   // wysokość lewej i prawej strony pleców
    const top = (Ly + Ry) / 2 - 26;
    let g = `<line x1="100" y1="30" x2="100" y2="318" stroke="${C.tomato}" stroke-width="1.6" stroke-dasharray="5 5" opacity=".7"/>`;
    // ręce zwisają po bokach aż do podłogi
    g += `<polyline points="52 ${Ly + 6} 58 226 64 288" fill="none" stroke="${C.skin}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`;
    g += `<polyline points="148 ${Ry + 6} 142 226 136 288" fill="none" stroke="${C.skin}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`;
    g += `<circle cx="64" cy="291" r="8" fill="${C.skin}"/><circle cx="136" cy="291" r="8" fill="${C.skin}"/>`;
    // głowa zwisa między nogami
    g += `<circle cx="100" cy="284" r="19" fill="${hair}"/><circle cx="100" cy="304" r="8" fill="${hair}"/>`;
    // nogi
    for (const d of [-1, 1]) {
      g += `<line x1="${100 + d * 22}" y1="208" x2="${100 + d * 24}" y2="314" stroke="${C.skin}" stroke-width="16" stroke-linecap="round"/>`;
      g += `<ellipse cx="${100 + d * 26}" cy="320" rx="13" ry="7" fill="${C.ink}"/>`;
    }
    // plecy w skłonie (bez koszulki) z kopułką żeber
    g += `<path d="M46 184 C36 ${Ly + 22} 38 ${Ly - 2} 60 ${Ly - 10} Q80 ${Ly - 22} 100 ${top} Q120 ${Ry - 22} 140 ${Ry - 10} C162 ${Ry - 2} 164 ${Ry + 22} 154 184 Z" fill="${C.skin}" stroke="${C.skin2}" stroke-width="3" stroke-linejoin="round"/>`;
    // łopatki
    g += `<path d="M64 ${Ly + 6} q12 -10 24 -3" fill="none" stroke="${C.skin2}" stroke-width="3" stroke-linecap="round"/>`;
    g += `<path d="M136 ${Ry + 6} q-12 -10 -24 -3" fill="none" stroke="${C.skin2}" stroke-width="3" stroke-linecap="round"/>`;
    // spodenki: biodra są najbliżej, zasłaniają dół pleców
    g += `<path d="M58 168 L142 168 L148 216 L108 216 L100 204 L92 216 L52 216 Z" fill="${shorts}" stroke="${shorts}" stroke-width="6" stroke-linejoin="round"/>`;
    // koraliki kręgosłupa
    for (let i = 0; i < 8; i++) {
      const u = i / 7, y = 166 - u * (166 - (top + 8));
      const x = 100 + hump * 7 * Math.sin(Math.PI * u);
      g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" fill="${BEADS[i % 6]}" stroke="${C.ink}" stroke-width="1.5"/>`;
    }
    // poziomica na plecach
    const lx = 60, rx = 140, ly = Ly - 10, ry = Ry - 10;
    const ang = Math.atan2(ry - ly, rx - lx) * 180 / Math.PI;
    const cx = 100, cy = (ly + ry) / 2 - 24;
    const bub = Math.max(-10, Math.min(10, -ang * 0.9));
    g += `<g transform="translate(${cx} ${cy.toFixed(1)}) rotate(${ang.toFixed(1)})">
      <rect x="-66" y="-9" width="132" height="18" rx="5" fill="${C.sun}" stroke="${C.ink}" stroke-width="2.5"/>
      <rect x="-16" y="-5" width="32" height="10" rx="5" fill="#bff0dc" stroke="${C.ink}" stroke-width="1.8"/>
      <line x1="-5" y1="-5" x2="-5" y2="5" stroke="${C.ink}" stroke-width="1.2"/><line x1="5" y1="-5" x2="5" y2="5" stroke="${C.ink}" stroke-width="1.2"/>
      <circle cx="${bub.toFixed(1)}" cy="0" r="3.4" fill="#fff" stroke="${C.ink}" stroke-width="1.2"/>
    </g>`;
    if (hump > .5) {
      g += `<path d="M168 ${Ry + 14} q12 -10 10 -30" fill="none" stroke="${C.tomato}" stroke-width="3" stroke-linecap="round"/>`;
      g += `<path d="M172 ${Ry - 12} l6 -6 l6 7" fill="none" stroke="${C.tomato}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return g;
  }
  const testKid = $('#testKid'), testSay = $('#testSay');
  const TEST = {
    stand: { draw: () => kid({ shirt: C.tomato, hair: '#2b2b3a', bun: false, beads: true }), say: 'Najpierw stoi swobodnie, plecami do Ciebie.' },
    ok: { draw: () => bend(0), say: 'Równo! Obie strony pleców na tej samej wysokości.' },
    bad: { draw: () => bend(1), say: 'Jedna strona wyżej? Warto umówić diagnostykę.' },
  };
  const showTest = k => {
    $$('#testSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === k));
    testKid.innerHTML = TEST[k].draw();
    testSay.textContent = TEST[k].say;
  };
  $$('#testSeg button').forEach(b => b.addEventListener('click', () => showTest(b.dataset.t)));
  showTest('ok');

  /* ---------- wady postawy ---------- */
  const side = round => {
    // widok z boku: koraliki po łuku
    let g = `<line x1="100" y1="10" x2="100" y2="270" stroke="${C.tomato}" stroke-width="1.6" stroke-dasharray="5 5"/>`;
    const n = 11;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = 100 + (round ? 34 * Math.sin(Math.PI * Math.min(1, u * 1.25)) - 12 * u : 4 * Math.sin(Math.PI * u * 2)) ;
      const y = 70 + u * 170;
      g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${BEADS[i % 6]}" stroke="${C.ink}" stroke-width="2"/>`;
    }
    const hx = round ? 76 : 98;
    g += `<circle cx="${hx}" cy="38" r="24" fill="#6b4330"/><circle cx="${hx - 22}" cy="42" r="6" fill="${C.skin}"/>`;
    if (round) g += `<path d="M40 40 q-10 4 -16 14" stroke="${C.ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/><text x="10" y="74" font-size="22" font-weight="800" fill="${C.ink}" font-family="Bricolage Grotesque, sans-serif">?</text>`;
    return `<svg viewBox="0 0 200 280">${g}</svg>`;
  };
  // ślad stopy: płaski pełny, zdrowy z wcięciem łuku po wewnętrznej stronie
  const print = (flat, fill) => `
    <path d="M${flat ? 52 : 60} 40c26 0 40 26 38 60-2 30-${flat ? 4 : 18} 44-${flat ? 4 : 18} 76 0 34-8 56-28 56s-32-20-30-52c2-30 6-44 0-74-4-38 ${flat ? 0 : 8}-66 ${flat ? 22 : 30}-66z"
      transform="translate(-30 0)" fill="${fill}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>
    <g fill="${fill}" stroke="${C.ink}" stroke-width="2.5">
      <circle cx="22" cy="24" r="8"/><circle cx="40" cy="18" r="6.5"/><circle cx="54" cy="20" r="5.5"/><circle cx="66" cy="26" r="5"/><circle cx="75" cy="35" r="4.5"/>
    </g>`;
  const foot = () => `<svg viewBox="0 0 200 280">
      <g transform="translate(8 20)">${print(true, C.pink)}</g>
      <g transform="translate(108 20)">${print(false, C.mint)}</g>
      <g font-family="Figtree, sans-serif" font-size="14" font-weight="700" fill="${C.ink}" text-anchor="middle">
        <text x="50" y="262">płaska</text><text x="150" y="262">z łukiem</text>
      </g>
    </svg>`;
  const kidSvg = p => `<svg class="kid" viewBox="0 0 200 340">${kid(p)}</svg>`;

  const WADY = [
    {
      name: 'Skolioza', c: C.tomato, pic: () => kidSvg({ s: 1, t: .5 }),
      parent: 'Boczne skrzywienie kręgosłupa. Skolioza funkcjonalna wynika zwykle ze słabych mięśni posturalnych albo nierównej długości nóg i dobrze reaguje na ćwiczenia. Idiopatyczna to deformacja strukturalna, częstsza u dziewczynek w okresie szybkiego wzrostu: wymaga terapii specjalistycznej (np. Schroth, FITS) i regularnych kontroli.',
      kid: 'Twój kręgosłup to sznurek koralików. Przy skoliozie zamiast iść prosto do góry wije się jak wąż. Ćwiczenia uczą go wracać do pionu.',
    },
    {
      name: 'Asymetria barków i miednicy', c: C.sun, pic: () => kidSvg({ t: 1 }),
      parent: 'Jeden bark, łopatka albo talerz biodrowy ustawiony wyżej niż drugi. Nie każda asymetria oznacza skoliozę, ale każdą warto sprawdzić. Rodzice często zauważają ją latem, gdy dziecko jest w stroju kąpielowym.',
      kid: 'Jedno ramię jest wyżej niż drugie, jak huśtawka, na której z jednej strony siedzi więcej dzieci. Wyrównamy ją razem!',
    },
    {
      name: 'Odstające łopatki', c: C.mint, pic: () => kidSvg({ w: 1 }),
      parent: 'Łopatki odsuwają się od klatki piersiowej, najczęściej przy słabych mięśniach stabilizujących i barkach wysuniętych do przodu. Typowe u dzieci, które dużo siedzą nad książką, tabletem lub telefonem.',
      kid: 'Twoje łopatki próbują wyrosnąć na skrzydełka. Silne plecy przytrzymają je na swoim miejscu.',
    },
    {
      name: 'Plecy okrągłe', c: C.sky, pic: () => side(true),
      parent: 'Pogłębione wygięcie kręgosłupa w odcinku piersiowym, często razem z głową i barkami wysuniętymi do przodu. Wzmacniamy mięśnie grzbietu i rozciągamy klatkę piersiową, żeby dziecko mogło swobodnie się wyprostować.',
      kid: 'Plecy wyginają się jak znak zapytania, a głowa ucieka do przodu jak u żółwia, który zagląda w ekran.',
    },
    {
      name: 'Koślawe kolana', c: C.lilac, pic: () => kidSvg({ k: 1.1 }),
      parent: 'Kolana schodzą się do środka, a przy złączonych kolanach między stopami zostaje przerwa. Często idzie w parze z płaskostopiem i ustawieniem miednicy, dlatego ćwiczymy całą oś ciała, nie tylko nogi.',
      kid: 'Kolana chcą się przytulić, a stopy uciekają od siebie. Nogi wyglądają wtedy jak litera X.',
    },
    {
      name: 'Płaskostopie', c: C.pink, pic: () => foot(),
      parent: 'Obniżony łuk podłużny stopy. U maluchów do około 4–5 roku życia bywa naturalne, później warto je ćwiczyć, bo ustawienie stóp wpływa na kolana, biodra i kręgosłup.',
      kid: 'Pod stopą jest mostek. Kiedy się zapada, stopa klapie o podłogę jak płetwa. Ćwiczenia stawiają mostek z powrotem.',
    },
  ];
  const list = $('#wadyList'), card = $('#wadyCard'), wPic = $('#wadyPic'), wName = $('#wadyName'), wText = $('#wadyText'), wKid = $('#wadyKid');
  let wi = 0;
  WADY.forEach((w, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'wada-' + i;
    b.innerHTML = `<i style="--c:${w.c}"></i>${w.name}`;
    b.addEventListener('click', () => { wi = i; showWada(); b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
    list.appendChild(b);
  });
  function showWada() {
    const w = WADY[wi];
    $$('button', list).forEach((b, j) => b.setAttribute('aria-selected', j === wi));
    card.setAttribute('aria-labelledby', 'wada-' + wi);
    wPic.innerHTML = w.pic();
    wName.textContent = w.name;
    wText.textContent = w.parent;
    wKid.textContent = '„' + w.kid + '”';
    card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
  }
  list.addEventListener('keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    wi = (wi + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + WADY.length) % WADY.length;
    showWada(); $('#wada-' + wi).focus();
  });
  showWada();

  /* ---------- przed / po ---------- */
  const CASES = [
    { label: 'Skrzywienie boczne', after: 'po 3 mies.', before: { s: .9, t: .6, h: .3 }, aft: { s: .15, t: .1 },
      text: 'Chłopiec, 10 lat, zajęcia grupowe dwa razy w tygodniu. Barki i łopatki wyrównały się, kręgosłup wyraźnie bliżej pionu, a przykurczone mięśnie z tyłu ud pozwalają już swobodnie wyprostować kolana.' },
    { label: 'Koślawe kolana', after: 'po 4 mies.', before: { k: 1.1, t: .4 }, aft: { k: .15, t: .05 },
      text: 'Dziewczynka, 7 lat, zajęcia grupowe raz w tygodniu. Kolana i stopy ustawiają się w osi, przy złączonych kolanach zniknęła duża przerwa między stopami.' },
    { label: 'Łopatki i barki', after: 'po 8 wizytach', before: { w: 1, t: .7, h: .5 }, aft: { w: .1, t: .05, h: 0 },
      text: 'Chłopiec, 12 lat, terapia indywidualna i ćwiczenia w domu. Łopatki przylegają, barki wróciły na swoje miejsce, głowa nie ucieka już w bok.' },
  ];
  const casesEl = $('#cases'), caseText = $('#caseText'), cB = $('#cmpBefore'), cA = $('#cmpAfter'), cLbl = $('#cmpAfterLbl');
  let ci = 0;
  CASES.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = c.label;
    b.addEventListener('click', () => { ci = i; showCase(); });
    casesEl.appendChild(b);
  });
  const lookCmp = { shirt: C.lilac, hair: '#3a2a22', bun: true };
  function showCase() {
    const c = CASES[ci];
    $$('button', casesEl).forEach((b, j) => b.setAttribute('aria-selected', j === ci));
    const look = { ...lookCmp, bun: !c.text.startsWith('Chłopiec'), hair: c.text.startsWith('Chłopiec') ? '#2b2b3a' : lookCmp.hair };
    cB.innerHTML = kid({ ...look, ...c.before });
    cA.innerHTML = kid({ ...look, ...c.aft });
    cLbl.textContent = c.after;
    caseText.textContent = c.text;
  }
  showCase();

  /* ---------- sale ---------- */
  const PLACES = [
    { name: 'Sala Północ', note: 'zajęcia grupowe', x: 52, y: 22, c: C.tomato },
    { name: 'Sala Wschód', note: 'zajęcia grupowe', x: 78, y: 40, c: C.sun },
    { name: 'Sala Zachód', note: 'zajęcia grupowe', x: 24, y: 46, c: C.mint },
    { name: 'Sala Południe', note: 'zajęcia grupowe', x: 56, y: 80, c: C.sky },
    { name: 'Sala Podmiejska', note: 'zajęcia grupowe', x: 84, y: 70, c: C.pink },
    { name: 'Centrum diagnostyki', note: 'diagnostyka i terapia', x: 40, y: 60, c: C.lilac },
  ];
  const places = $('#places'), pins = $('#pins');
  PLACES.forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" data-i="${i}"><i style="--c:${p.c}"></i><b>${p.name}</b><span>${p.note}</span></button>`;
    places.appendChild(li);
    const pin = document.createElement('button');
    pin.type = 'button'; pin.className = 'pin'; pin.dataset.i = i; pin.setAttribute('aria-label', p.name);
    pin.style.left = p.x + '%'; pin.style.top = p.y + '%';
    pin.innerHTML = `<em>${p.name}</em><svg viewBox="0 0 34 34"><path d="M17 33C8 22 4 17 4 12a13 13 0 0 1 26 0c0 5-4 10-13 21z" fill="${p.c}" stroke="${C.ink}" stroke-width="2.5"/><circle cx="17" cy="12" r="4.5" fill="${C.ink}"/></svg>`;
    pins.appendChild(pin);
  });
  const pick = i => {
    $$('button', places).forEach(b => b.classList.toggle('is-on', +b.dataset.i === i));
    $$('.pin', pins).forEach(b => b.classList.toggle('is-on', +b.dataset.i === i));
  };
  places.addEventListener('click', e => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); });
  pins.addEventListener('click', e => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); });
  places.addEventListener('mouseover', e => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); });
  pick(5);

  /* ---------- zespół: buźki zamiast zdjęć ---------- */
  const HAIR = ['#6b4330', '#2b2b3a', '#c9773a', '#3a2a22'];
  $$('.mate__face').forEach((el, i) => {
    const hair = HAIR[i % HAIR.length], long = i % 2 === 0;
    el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">
      ${long ? `<path d="M18 52c0-30 14-42 32-42s32 12 32 42v30H18z" fill="${hair}"/>` : ''}
      <circle cx="50" cy="56" r="28" fill="${C.skin}"/>
      <path d="M21 52c2-22 15-32 29-32s27 10 29 32c-10-3-21-10-29-18-8 8-19 15-29 18z" fill="${hair}"/>
      <circle cx="40" cy="58" r="3.6" fill="${C.ink}"/><circle cx="60" cy="58" r="3.6" fill="${C.ink}"/>
      <circle cx="33" cy="67" r="5" fill="${C.pink}" opacity=".6"/><circle cx="67" cy="67" r="5" fill="${C.pink}" opacity=".6"/>
      <path d="M42 69q8 7 16 0" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  });

  /* ---------- zapisy ---------- */
  const fPlace = $('#fPlace'), fDays = $('#fDays');
  PLACES.filter(p => !p.name.startsWith('Centrum')).forEach((p, i) => {
    fPlace.insertAdjacentHTML('beforeend', `<label><input type="radio" name="place" value="${p.name}"${i === 0 ? ' checked' : ''}><span>${p.name.replace('Sala ', '')}</span></label>`);
  });
  ['pon', 'wt', 'śr', 'czw', 'pt', 'sob'].forEach(d => {
    fDays.insertAdjacentHTML('beforeend', `<label><input type="checkbox" name="days" value="${d}"><span>${d}</span></label>`);
  });
  const fAge = $('#fAge');
  for (let n = 5; n <= 14; n++) {
    fAge.insertAdjacentHTML('beforeend', `<label><input type="radio" name="age" value="${n}"${n === 8 ? ' checked' : ''}><span>${n}</span></label>`);
  }
  const ageVal = () => $('input[name="age"]:checked', fAge).value + ' lat';

  const form = $('#form'), err = $('#formErr'), ticket = $('#ticket');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#fName'), phone = $('#fPhone'), ok = $('#fOk');
    const digits = phone.value.replace(/\D/g, '');
    name.classList.toggle('is-bad', !name.value.trim());
    phone.classList.toggle('is-bad', digits.length < 9);
    if (!name.value.trim()) { err.textContent = 'Wpisz imię dziecka.'; name.focus(); return; }
    if (digits.length < 9) { err.textContent = 'Podaj numer telefonu (9 cyfr).'; phone.focus(); return; }
    if (!ok.checked) { err.textContent = 'Zaznacz zgodę na kontakt.'; ok.focus(); return; }
    err.textContent = '';
    const days = $$('input[name="days"]:checked', form).map(x => x.value);
    $('#tName').textContent = name.value.trim();
    $('#tAge').textContent = ageVal();
    $('#tPlace').textContent = $('input[name="place"]:checked', form).value;
    $('#tDays').textContent = days.length ? days.join(', ') : 'dowolne';
    form.hidden = true; ticket.hidden = false; ticket.focus();
  });
  $('#tAgain').addEventListener('click', () => {
    form.reset(); $$('.is-bad', form).forEach(x => x.classList.remove('is-bad'));
    ticket.hidden = true; form.hidden = false; $('#fName').focus();
  });
})();
