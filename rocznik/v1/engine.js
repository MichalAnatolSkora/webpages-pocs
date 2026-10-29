// Rocznik v1 — the engine console: bootstrap crawl, daily delta, seasonal sweep, RDF queue, XML parser lab and the data model.
// Everything here is a simulation over the mock data; real KRS numbers in the crawl log carry no names.

const ENG_DEFAULT = () => ({
  cursor: 612044, checkpoint: 612000, p: 434551, s: 104047, miss: 73446, wykr: 121674,
  rdfLists: 198400, files: 806220, parsed: 803960, ocr: 51300, failed: 2260, pend: 0,
  krsRate: 2, rdfGap: 1.5, speed: 60, running: false, crashed: false,
  rdfPause: 0, rdfState: 'ok', backoff: 0,
});
let ENG = Object.assign(ENG_DEFAULT(), store.get('eng', {}), { running: false });
ENG.clock = Date.now();
let ENG_LOG = [];
let ENG_TIMER = null, RQ_TIMER = null;
const engRng = dice(mulberry32(SEED ^ 0x3c6ef372));
const saveEng = () => { const { clock, ...rest } = ENG; store.set('eng', rest); };
const krs10 = n => String(n).padStart(10, '0');
const NUMS_PER_REQ = 1.71;   // a P hit costs two requests (aktualny + pełny), a miss or an S hit one
const FILES_PER_CO = 5.2;    // XML statements per active company, first pass

function fmtDur(sec) {
  if (sec < 90) return `${Math.round(sec)} s`;
  if (sec < 5400) return `${Math.round(sec / 60)} min`;
  const h = sec / 3600;
  if (h < 48) return `${Math.round(h)} h`;
  const d = h / 24;
  if (d < 21) return `${Math.floor(d)} d ${Math.round(h % 24)} h`;
  return `${(d / 7).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} tyg.`;
}
const etaKrs = () => Math.max(0, UNIVERSE.krsMax - ENG.cursor) * NUMS_PER_REQ / ENG.krsRate;
const etaRdf = () => (Math.max(0, UNIVERSE.aktywneP - ENG.rdfLists) + Math.max(0, UNIVERSE.aktywneP * FILES_PER_CO - ENG.files)) * ENG.rdfGap * 1.08;
const activeP = () => ENG.p - ENG.wykr;
const rdfBacklog = () => Math.max(0, activeP() - ENG.rdfLists);

// ---------- layout ----------
const ENG_PAGES = [
  ['', 'Przegląd', 'layers'], ['bootstrap', 'Bootstrap', 'play'], ['delta', 'Delta dzienna', 'refresh'], ['sweep', 'Sweep sezonowy', 'calendar'],
  ['rdf', 'Kolejka RDF', 'hourglass'], ['parser', 'Parser XML', 'file-code'], ['model', 'Model danych', 'database'],
];
function renderEngine(sub, params) {
  engineLeave();
  const page = ENG_PAGES.find(p => p[0] === sub) ? sub : '';
  const body = { '': engOverview, bootstrap: engBootstrap, delta: engDelta, sweep: engSweep, rdf: engRdf, parser: engParser, model: engModel }[page](params || {});
  const title = ENG_PAGES.find(p => p[0] === page)[1];
  return `<div class="eng">
    <div class="eng-top"><div class="wrap eng-top__in">
      <div><p class="eyebrow eyebrow--eng">Maszynownia · panel operatora</p><h1 class="h1">${title}</h1></div>
      <div class="eng-status" id="engStatus">${engStatusChips()}</div>
    </div></div>
    <div class="wrap eng-body">
      <nav class="eng-nav" aria-label="Silnik">${ENG_PAGES.map(([k, l, ic]) => `<a href="#/silnik${k ? '/' + k : ''}"${k === page ? ' aria-current="page"' : ''}>${icon(ic)}${l}</a>`).join('')}<a class="eng-nav__back" href="#/">${icon('back')}Wróć do serwisu</a></nav>
      <div class="eng-main">${body}</div>
    </div>
  </div>`;
}
function engStatusChips() {
  const rdf = ENG.rdfState === 'captcha' ? ['crit', 'RDF: captcha, kolejka stoi'] : ENG.rdfState === 'backoff' ? ['warn', `RDF: 429, przerwa ${fmtDur(ENG.rdfPause)}`] : ['ok', `RDF: 1 połączenie, co ${String(ENG.rdfGap).replace('.', ',')} s`];
  return [['ok', `API KRS: ${ENG.krsRate} req/s`], ['ok', `Biuletyn: ${fmtDateShort(YESTERDAY)} OK`], rdf, ['ok', 'Biała lista: OK']]
    .map(([t, l]) => `<span class="st st--${t}"><span class="st__dot"></span>${l}</span>`).join('');
}
function engineLeave() {
  clearInterval(ENG_TIMER); ENG_TIMER = null;
  clearInterval(RQ_TIMER); RQ_TIMER = null;
  if (ENG.running) { ENG.running = false; saveEng(); }
}

// ---------- overview ----------
function engOverview() {
  const pct = ENG.cursor / UNIVERSE.krsMax;
  const box = (t, s, cls = '') => `<div class="pbox ${cls}"><p class="pbox__t">${t}</p>${s ? `<p class="pbox__s">${s}</p>` : ''}</div>`;
  return `
    <div class="pipe card">
      <div class="pipe__col"><p class="pipe__h">Źródła</p>${box('API KRS', 'OdpisAktualny · OdpisPelny')}${box('Biuletyn KRS', 'zmiany z wczoraj')}${box('RDF', 'REST nowej przeglądarki')}${box('Biała lista VAT', 'NIP → KRS')}</div>
      <div class="pipe__arrow">${icon('arrow')}</div>
      <div class="pipe__col"><p class="pipe__h">Pobieranie</p>${box('Kolejka KRS', `${ENG.krsRate} req/s, wznawianie od kursora`)}${box('Kolejka RDF', '1 połączenie, odstępy z jitterem', 'pbox--slow')}</div>
      <div class="pipe__arrow">${icon('arrow')}</div>
      <div class="pipe__col"><p class="pipe__h">Surowe</p>${box('Blob storage', `klucz = sha256, niemutowalne · ${String(UNIVERSE.blobsTB).replace('.', ',')} TB`)}</div>
      <div class="pipe__arrow">${icon('arrow')}</div>
      <div class="pipe__col"><p class="pipe__h">Parsery</p>${box('Odpis JSON', '→ podmiot')}${box('XML + XAdES', '→ sprawozdanie, pozycja')}${box('PDF z tekstem', '→ LLM: dywidendy, opinia')}${box('Skany', '→ kolejka OCR (po MVP)', 'pbox--later')}</div>
      <div class="pipe__arrow">${icon('arrow')}</div>
      <div class="pipe__col"><p class="pipe__h">Postgres</p>${box('podmiot · dokument', '')}${box('sprawozdanie · pozycja', 'format long')}${box('metryki_roczne', '~15 wskaźników, widok zmaterializowany', 'pbox--hot')}</div>
      <div class="pipe__arrow">${icon('arrow')}</div>
      <div class="pipe__col"><p class="pipe__h">Produkt</p>${box('Strony SEO', '')}${box('Raporty PDF', '')}${box('API i alerty', '')}</div>
    </div>
    <div class="stat-row stat-row--6">
      ${[['Podmioty (rejestr P)', num(UNIVERSE.rejestrP)], ['Aktywne', num(UNIVERSE.aktywneP)], ['Dokumenty RDF', num(UNIVERSE.dokumenty)], ['Sprawozdania XML', num(UNIVERSE.sprawozdania)], ['Wiersze w pozycja', (UNIVERSE.pozycje / 1e6).toLocaleString('pl-PL', { maximumFractionDigits: 0 }) + ' mln'], ['Kolejka OCR', num(UNIVERSE.ocr)]]
        .map(([l, v]) => `<div class="card stat-tile"><p class="mini-label">${l}</p><p class="kpi-val kpi-val--sm">${v}</p></div>`).join('')}
    </div>
    <div class="card table-card">
      <h2 class="h4">Zadania</h2>
      <div class="table-scroll"><table class="plain">
        <thead><tr><th scope="col">Zadanie</th><th scope="col">Harmonogram</th><th scope="col">Stan</th><th scope="col">Szczegóły</th></tr></thead>
        <tbody>
          <tr><th scope="row"><a href="#/silnik/bootstrap">Bootstrap</a></th><td>jednorazowo, tygodnie</td><td><span class="pill pill--info pill--xs">w toku ${fmtPct(pct, 0)}</span></td><td>kursor KRS ${krs10(ENG.cursor)} · KRS skończy za ${fmtDur(etaKrs())}, RDF za ${fmtDur(etaRdf())}</td></tr>
          <tr><th scope="row"><a href="#/silnik/delta">Delta dzienna</a></th><td>codziennie 6:00</td><td><span class="pill pill--ok pill--xs">OK</span></td><td>biuletyn z ${fmtDateShort(YESTERDAY)}: 1 873 numery KRS, 214 nowych wzmianek w dziale 3</td></tr>
          <tr><th scope="row"><a href="#/silnik/sweep">Sweep sezonowy</a></th><td>czerwiec–lipiec, w poniedziałki</td><td><span class="pill pill--muted pill--xs">poza sezonem</span></td><td>następny przebieg: 1.06.${LAST_FY + 2} (spółki bez sprawozdania za ${LAST_FY + 1})</td></tr>
          <tr><th scope="row"><a href="#/silnik/parser">Reparsowanie</a></th><td>ręcznie, po zmianie parsera</td><td><span class="pill pill--muted pill--xs">bezczynne</span></td><td>czyta bloby z dysku, bez ruchu do RDF; ostatnio parser 1.4.2</td></tr>
        </tbody>
      </table></div>
    </div>
    <div class="grid2">
      <div class="card"><h2 class="h4">Wąskie gardło: RDF</h2><p>API KRS odpowiada szybko i bez limitów, więc kursor KRS wyprzedza kolejkę RDF. Stary system RDF był zabezpieczony przed robotami; nowy (od lutego 2026) zakładamy z limitami i możliwą captchą. Ruch rozkładamy w czasie, jedno połączenie naraz, a captchy nie obchodzimy: kolejka czeka.</p><p><a class="link" href="#/silnik/rdf">Polityka kolejki ${icon('arrow')}</a></p></div>
      <div class="card"><h2 class="h4">Zasada: surowe zawsze zostają</h2><p>Każdy odpis JSON i każdy plik z RDF trafia do blob storage pod kluczem sha256 i już się nie zmienia. Po poprawce parsera przeliczamy wszystko z dysku, bez ponownego pobierania.</p><p><a class="link" href="#/silnik/model">Model danych ${icon('arrow')}</a></p></div>
    </div>`;
}

// ---------- bootstrap ----------
function engBootstrap() {
  const SPEEDS = [[1, '1×'], [60, '1 min/s'], [3600, '1 h/s']];
  return `
    <div class="card eng-controls">
      <div class="eng-controls__row">
        <button type="button" class="btn ${ENG.running ? 'btn--ghost' : 'btn--accent'}" data-act="eng-run" id="engRun">${ENG.running ? icon('pause') + 'Pauza' : icon('play') + (ENG.crashed ? 'Wznów od kursora' : 'Start')}</button>
        <button type="button" class="btn btn--ghost" data-act="eng-crash"${ENG.running ? '' : ' disabled'} id="engCrash">${icon('skull')}Symuluj awarię</button>
        <div class="seg" role="group" aria-label="Tempo symulacji">${SPEEDS.map(([v, l]) => `<button type="button" class="seg__b${ENG.speed === v ? ' is-on' : ''}" data-act="eng-speed" data-v="${v}" aria-pressed="${ENG.speed === v}">${l}</button>`).join('')}</div>
        <button type="button" class="btn btn--ghost btn--sm" data-act="eng-reset">${icon('refresh')}Reset</button>
      </div>
      <div class="eng-controls__row">
        <label class="range"><span>API KRS</span><input type="range" min="1" max="5" step="1" value="${ENG.krsRate}" data-input="eng-krs"><b id="krsRateV">${ENG.krsRate} req/s</b></label>
        <label class="range"><span>RDF, odstęp</span><input type="range" min="0.5" max="6" step="0.5" value="${ENG.rdfGap}" data-input="eng-rdf"><b id="rdfGapV">${String(ENG.rdfGap).replace('.', ',')} s</b></label>
      </div>
    </div>
    <div class="lanes">
      <div class="card lane">
        <div class="lane__head"><h2 class="h4">${icon('database')}Pas KRS</h2><span class="small muted">iteracja numerów 1 → ~${num(UNIVERSE.krsMax)}</span></div>
        <p class="cursor mono" id="engCursor">${krs10(ENG.cursor)}</p>
        <div class="bar" aria-hidden="true"><span id="engKrsBar" style="width:${ENG.cursor / UNIVERSE.krsMax * 100}%"></span></div>
        <p class="small muted"><span id="engKrsPct">${fmtPct(ENG.cursor / UNIVERSE.krsMax)}</span> · zapisany kursor <span class="mono" id="engCkpt">${krs10(ENG.checkpoint)}</span> · do końca <b id="engKrsEta">${fmtDur(etaKrs())}</b></p>
        <div class="stack" aria-hidden="true" id="engStack">${stackBar()}</div>
        <dl class="lane__kv" id="engKrsKv">${krsKv()}</dl>
      </div>
      <div class="card lane">
        <div class="lane__head"><h2 class="h4">${icon('hourglass')}Pas RDF</h2><span class="st st--${ENG.rdfState === 'ok' ? 'ok' : ENG.rdfState === 'captcha' ? 'crit' : 'warn'}" id="engRdfSt"><span class="st__dot"></span>${rdfStateLabel()}</span></div>
        <p class="cursor mono" id="engBacklog">${num(rdfBacklog())}</p>
        <p class="small muted">spółek czeka na listę dokumentów · do końca <b id="engRdfEta">${fmtDur(etaRdf())}</b></p>
        <dl class="lane__kv" id="engRdfKv">${rdfKv()}</dl>
      </div>
    </div>
    <div class="card terminal">
      <div class="terminal__head"><span>crawler.log</span><span class="small" id="engClock">${new Date(ENG.clock).toLocaleTimeString('pl-PL')}</span></div>
      <pre class="terminal__body" id="engLog" aria-live="off">${ENG_LOG.length ? ENG_LOG.join('\n') : 'Naciśnij Start. Crawler wznowi od zapisanego kursora.'}</pre>
    </div>
    <div class="card events"><h2 class="h4">Zdarzenia</h2><ul id="engEvents">${ENG_EVENTS.join('') || '<li class="muted small">Start, pauza, awarie, 429 i captcha zostają tutaj, nawet gdy log ucieknie.</li>'}</ul></div>
    <div class="grid2">
      <div class="card"><h2 class="h4">Lejek</h2><div id="engFunnel">${funnel()}</div></div>
      <div class="card"><h2 class="h4">Dlaczego tak</h2><ul class="bul">
        <li>API KRS nie ma endpointu listującego, ale numery są sekwencyjne: iterujemy od 1 do bieżącego maksimum, brak rekordu pomijamy.</li>
        <li>W fazie 1 bierzemy tylko rejestr P. Trafienie w rejestr S zapisujemy w <span class="mono">crawl_log</span> i idziemy dalej.</li>
        <li>Kursor zapisujemy co 100 numerów. Po awarii powtarzamy co najwyżej 99 numerów; bloby o znanym sha256 nie są zapisywane drugi raz.</li>
        <li>Pas RDF ma własną kolejkę i własne tempo. Wykreślone spółki dostają odpis, ale nie listę dokumentów.</li>
      </ul></div>
    </div>`;
}
const rdfStateLabel = () => ENG.rdfState === 'captcha' ? `captcha: stoi ${fmtDur(ENG.rdfPause)}` : ENG.rdfState === 'backoff' ? `429: przerwa ${fmtDur(ENG.rdfPause)}` : 'pobiera';
function stackBar() {
  const t = ENG.p + ENG.s + ENG.miss || 1;
  return [['P', ENG.p - ENG.wykr, 'p'], ['P wykreślone', ENG.wykr, 'pw'], ['S', ENG.s, 's'], ['brak', ENG.miss, 'm']]
    .map(([l, v, k]) => `<span class="stack__s stack__s--${k}" style="width:${v / t * 100}%" data-tip="${esc(`${l}: ${num(v)} (${fmtPct(v / t, 0)})`)}"></span>`).join('');
}
const kvRow = (k, v, key) => `<div><dt>${key ? `<span class="key key--${key}"></span>` : ''}${k}</dt><dd>${v}</dd></div>`;
const krsKv = () => kvRow('Rejestr P, aktywne', num(activeP()), 'p') + kvRow('Rejestr P, wykreślone', num(ENG.wykr), 'pw') + kvRow('Rejestr S (pominięte)', num(ENG.s), 's') + kvRow('Brak rekordu (404)', num(ENG.miss), 'm');
const rdfKv = () => kvRow('Listy dokumentów', num(ENG.rdfLists)) + kvRow('Pliki XML pobrane', num(ENG.files)) + kvRow('Sparsowane', num(ENG.parsed)) + kvRow('PDF i skany → kolejka', num(ENG.ocr)) + kvRow('Błąd parsera → ręcznie', num(ENG.failed));
function funnel() {
  const steps = [['Numery sprawdzone', ENG.cursor], ['Odpisy rejestru P', ENG.p], ['Aktywne spółki', activeP()], ['Listy RDF pobrane', ENG.rdfLists], ['Pliki XML', ENG.files], ['Sparsowane', ENG.parsed]];
  const max = steps[0][1];
  return `<ol class="funnel">${steps.map(([l, v]) => `<li><span class="funnel__l">${l}</span><span class="funnel__bar"><span style="width:${Math.max(1, v / max * 100)}%"></span></span><span class="funnel__v">${num(v)}</span></li>`).join('')}</ol>`;
}

let ENG_EVENTS = [];
function engLog(line, cls = '') {
  const t = new Date(ENG.clock).toLocaleTimeString('pl-PL');
  if (cls === 'ok' || cls === 'warn' || cls === 'crit') { ENG_EVENTS.unshift(`<li class="ev ev--${cls}"><span class="mono">${t}</span> ${line}</li>`); ENG_EVENTS = ENG_EVENTS.slice(0, 6); }
  ENG_LOG.push(`<span class="lg-t">${t}</span> ${cls ? `<span class="lg-${cls}">` : ''}${line}${cls ? '</span>' : ''}`);
  if (ENG_LOG.length > 90) ENG_LOG.splice(0, ENG_LOG.length - 90);
}
function krsOne(verbose) {
  const n = ++ENG.cursor, r = engRng.f(), k = krs10(n);
  if (n % 100 === 0) ENG.checkpoint = n;
  if (r < 0.12) { ENG.miss++; if (verbose) engLog(`GET /api/krs/OdpisAktualny/${k}?rejestr=P&format=json <b>404</b> brak podmiotu`, 'dim'); return 1; }
  if (r < 0.29) { ENG.s++; if (verbose) engLog(`GET /api/krs/OdpisAktualny/${k}?rejestr=S&format=json <b>200</b> rejestr S → pomijam (faza 2)`, 'dim'); return 1; }
  ENG.p++;
  const wy = engRng.chance(0.28);
  if (wy) ENG.wykr++;
  if (verbose) engLog(`GET /api/krs/OdpisPelny/${k}?rejestr=P&format=json <b>200</b> ${engRng.int(18, 96)} kB · sha256:${fakeSha(k).slice(0, 8)}…${wy ? ' · wykreślony, bez RDF' : ''}`);
  return 2;
}
function engTick() {
  const dt = 0.2 * ENG.speed;
  ENG.clock += dt * 1000;
  const verbose = ENG.speed === 1;
  // KRS lane
  ENG._kc = (ENG._kc || 0) + dt * ENG.krsRate;
  let reqs = Math.floor(ENG._kc);
  ENG._kc -= reqs;
  if (reqs > 30) {
    const nums = Math.round(reqs / NUMS_PER_REQ), before = { p: ENG.p, s: ENG.s, m: ENG.miss };
    for (let i = 0; i < 3; i++) krsOne(true);
    const rest = Math.min(nums - 3, UNIVERSE.krsMax - ENG.cursor);
    const pp = Math.round(rest * 0.71 * (0.97 + engRng.f() * 0.06)), ss = Math.round(rest * 0.17), mm = Math.max(0, rest - pp - ss);
    ENG.p += pp; ENG.s += ss; ENG.miss += mm; ENG.wykr += Math.round(pp * 0.28); ENG.cursor += rest;
    ENG.checkpoint = Math.floor(ENG.cursor / 100) * 100;
    engLog(`… +${num(nums)} numerów: P ${num(ENG.p - before.p)}, S ${num(ENG.s - before.s)}, 404 ${num(ENG.miss - before.m)} · kursor zapisany ${krs10(ENG.checkpoint)}`, 'sum');
  } else while (reqs > 0 && ENG.cursor < UNIVERSE.krsMax) reqs -= krsOne(verbose || engRng.chance(0.25));
  // RDF lane: one connection, its own pace, pauses on 429 and captcha
  if (ENG.rdfPause > 0) {
    ENG.rdfPause -= dt;
    if (ENG.rdfPause <= 0) { ENG.rdfPause = 0; ENG.rdfState = 'ok'; engLog('RDF: koniec przerwy, wznawiam kolejkę (1 połączenie)', 'ok'); }
  } else {
    ENG._rc = (ENG._rc || 0) + dt / ENG.rdfGap;
    let n = Math.floor(ENG._rc);
    ENG._rc -= n;
    const bulk = n > 12;
    let shown = 0;
    while (n-- > 0) {
      if (engRng.chance(0.0015)) {
        ENG.backoff = ENG.backoff ? Math.min(3600, ENG.backoff * 2) : 120;
        ENG.rdfPause = ENG.backoff; ENG.rdfState = 'backoff';
        engLog(`GET {rdf}/dokumenty?krs=… <b>429</b> Too Many Requests → przerwa ${fmtDur(ENG.backoff)} (backoff wykładniczy)`, 'warn');
        break;
      }
      if (engRng.chance(0.00025)) {
        ENG.rdfPause = 2700; ENG.rdfState = 'captcha';
        engLog('GET {rdf}/dokumenty?krs=… <b>200 text/html</b> zamiast JSON: captcha → kolejka stoi 45 min, powiadomiono operatora, bez obchodzenia', 'crit');
        break;
      }
      if (ENG.backoff && engRng.chance(0.02)) ENG.backoff = 0;
      const say = !bulk ? (verbose || engRng.chance(0.3)) : shown < 2;
      if (ENG.pend > 0) {
        ENG.pend--; ENG.files++;
        const r = engRng.f();
        const fy = LAST_FY - engRng.int(0, 7);
        if (r < 0.965) { ENG.parsed++; if (say) { shown++; engLog(`GET {rdf}/dokument/…/plik <b>200</b> SprFin_${fy}.xml${engRng.chance(0.4) ? '.xades' : ''} ${engRng.int(38, 170)} kB → parser OK, ${engRng.int(48, 96)} pozycji`); } }
        else if (r < 0.993) { ENG.ocr++; if (say) { shown++; engLog(`GET {rdf}/dokument/…/plik <b>200</b> sprawozdanie_${fy}.pdf → skan, kolejka OCR`, 'dim'); } }
        else { ENG.failed++; if (say) { shown++; engLog(`parser: SprFin_${fy}.xml aktywa ≠ pasywa o ${engRng.int(2, 40)} zł → kolejka ręczna`, 'warn'); } }
      } else if (rdfBacklog() > 0) {
        ENG.rdfLists++;
        ENG.pend = Math.max(0, Math.round(engRng.norm(FILES_PER_CO, 1.6)));
        if (say) { shown++; engLog(`GET {rdf}/dokumenty?krs=${krs10(ENG.cursor - engRng.int(9000, 400000))} <b>200</b> ${ENG.pend + engRng.int(3, 14)} dokumentów, ${ENG.pend} XML do pobrania`); }
      }
    }
    if (bulk) engLog(`… RDF: listy ${num(ENG.rdfLists)}, pliki ${num(ENG.files)}`, 'sum');
  }
  engPaint();
}
function engPaint() {
  const set = (id, v, prop = 'textContent') => { const el = document.getElementById(id); if (el) el[prop] = v; };
  set('engCursor', krs10(ENG.cursor));
  const bar = $('#engKrsBar'); if (bar) bar.style.width = ENG.cursor / UNIVERSE.krsMax * 100 + '%';
  set('engKrsPct', fmtPct(ENG.cursor / UNIVERSE.krsMax));
  set('engCkpt', krs10(ENG.checkpoint));
  set('engKrsEta', fmtDur(etaKrs()));
  set('engStack', stackBar(), 'innerHTML');
  set('engKrsKv', krsKv(), 'innerHTML');
  set('engBacklog', num(rdfBacklog()));
  set('engRdfEta', fmtDur(etaRdf()));
  set('engRdfKv', rdfKv(), 'innerHTML');
  set('engFunnel', funnel(), 'innerHTML');
  set('engClock', new Date(ENG.clock).toLocaleTimeString('pl-PL'));
  set('engStatus', engStatusChips(), 'innerHTML');
  if (ENG_EVENTS.length) set('engEvents', ENG_EVENTS.join(''), 'innerHTML');
  const st = $('#engRdfSt');
  if (st) { st.className = `st st--${ENG.rdfState === 'ok' ? 'ok' : ENG.rdfState === 'captcha' ? 'crit' : 'warn'}`; st.innerHTML = `<span class="st__dot"></span>${rdfStateLabel()}`; }
  const log = $('#engLog');
  if (log) { log.innerHTML = ENG_LOG.join('\n'); log.scrollTop = log.scrollHeight; }
}
function engSetRunning(on) {
  ENG.running = on;
  clearInterval(ENG_TIMER);
  if (on) ENG_TIMER = setInterval(engTick, 200);
  const b = $('#engRun');
  if (b) { b.className = `btn ${on ? 'btn--ghost' : 'btn--accent'}`; b.innerHTML = on ? icon('pause') + 'Pauza' : icon('play') + (ENG.crashed ? 'Wznów od kursora' : 'Start'); }
  const cr = $('#engCrash'); if (cr) cr.disabled = !on;
  saveEng();
}
ACTIONS['eng-run'] = () => {
  if (!ENG.running && ENG.crashed) {
    const lost = ENG.cursor - ENG.checkpoint;
    ENG.cursor = ENG.checkpoint;
    ENG.crashed = false;
    engLog(`start: odczyt crawl_cursor = ${krs10(ENG.checkpoint)}; powtarzam ${lost} ${plural(lost, 'numer', 'numery', 'numerów')}, bloby o znanym sha256 pomijam`, 'ok');
  } else if (!ENG.running) engLog(`start: wznawiam od kursora ${krs10(ENG.cursor)} · KRS ${ENG.krsRate} req/s · RDF co ${String(ENG.rdfGap).replace('.', ',')} s`, 'ok');
  else engLog('pauza: kursor zapisany', 'ok');
  engSetRunning(!ENG.running);
  engPaint();
};
ACTIONS['eng-crash'] = () => {
  engLog(`<b>proces zabity</b> (OOM na węźle crawl-2) przy numerze ${krs10(ENG.cursor)}; ostatni zapisany kursor ${krs10(ENG.checkpoint)}`, 'crit');
  ENG.crashed = true;
  engSetRunning(false);
  engPaint();
};
ACTIONS['eng-speed'] = el => { ENG.speed = +el.dataset.v; saveEng(); $$('[data-act="eng-speed"]').forEach(b => { const on = b === el; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); }); };
ACTIONS['eng-reset'] = () => { const sp = ENG.speed; ENG = Object.assign(ENG_DEFAULT(), { speed: sp }); ENG.clock = Date.now(); ENG_LOG = []; ENG_EVENTS = []; saveEng(); rerender(); };
INPUTS['eng-krs'] = el => { ENG.krsRate = +el.value; $('#krsRateV').textContent = ENG.krsRate + ' req/s'; saveEng(); engPaint(); };
INPUTS['eng-rdf'] = el => { ENG.rdfGap = +el.value; $('#rdfGapV').textContent = String(ENG.rdfGap).replace('.', ',') + ' s'; saveEng(); engPaint(); };

// ---------- delta ----------
const DELTA_TOTAL = { all: 1873, p: 1612, s: 261, dz1: 402, dz2: 517, dz3: 296, wzm: 214, dz4: 23, dz6: 31, nodiff: 488, found: 198, alerts: 61 };
let DELTA_DONE = false, DELTA_SEL = 0;
function deltaRows() {
  const rows = EVENTS.filter(e => +e.date === +YESTERDAY).map(e => ({ c: BY_KRS.get(e.krs), e }));
  const d = dice(mulberry32(hashStr(isoDate(YESTERDAY))));
  for (let i = 0; i < 3; i++) {
    const c = COMPANIES[HEROES.length + d.int(0, COMPANIES.length - HEROES.length - 1)];
    if (!rows.some(r => r.c === c)) rows.push({ c, e: { type: 'none', dzial: null, title: 'Sprostowanie oczywistej omyłki, działy 1–6 bez zmian' } });
  }
  rows.sort((a, b) => (a.e.type === 'wzmianka' ? -1 : 0) - (b.e.type === 'wzmianka' ? -1 : 0) || (b.e.dzial === 4 || b.e.dzial === 6) - (a.e.dzial === 4 || a.e.dzial === 6));
  return rows;
}
function deltaSteps(r) {
  const s = [['odpis', 'GET OdpisPelny'], ['diff', 'diff działów']];
  if (r.e.type === 'wzmianka') s.push(['rdf', 'RDF: lista'], ['xml', 'pobranie XML'], ['parse', 'parser'], ['mv', 'REFRESH metryki']);
  if (r.e.type !== 'none' && (WATCH.includes(r.c.krs) || r.c.hero)) s.push(['alert', 'alert']);
  return s;
}
function deltaDiff(r) {
  const o = odpis(r.c), d = dice(mulberry32(hashStr(r.c.krs + 'diff')));
  const p = maskedPerson(d);
  switch (r.e.type) {
    case 'zarzad': return [['dzial2.reprezentacja.sklad[' + o.board.length + ']', null, { nazwisko: { nazwiskoICzlon: p.nazwisko }, imiona: { imie: p.imie }, funkcjaWOrganie: 'CZŁONEK ZARZĄDU' }], ['naglowekP.numerOstatniegoWpisu', o.wpisy.length - 1, o.wpisy.length]];
    case 'prokura': return [['dzial2.prokurenci[0]', null, { nazwisko: { nazwiskoICzlon: p.nazwisko }, imiona: { imie: p.imie }, rodzajProkury: 'PROKURA ŁĄCZNA' }]];
    case 'adres': return [['dzial1.siedzibaIAdres.adres.ulica', 'UL. ' + upperPl(STREETS[d.int(0, STREETS.length - 1)]), 'UL. ' + upperPl(r.c.street.replace(/ \S+$/, ''))], ['dzial1.siedzibaIAdres.adres.nrDomu', String(d.int(1, 90)), r.c.street.split(' ').pop()]];
    case 'kapital': return [['dzial1.kapital.wysokoscKapitaluZakladowego.wartosc', (r.c.capital / 2).toFixed(2).replace('.', ','), r.c.capital.toFixed(2).replace('.', ',')]];
    case 'pkd': return [['dzial3.przedmiotDzialalnosci.przedmiotPozostalejDzialalnosci[' + o.pkdOther.length + ']', null, { opis: 'POZOSTAŁA DZIAŁALNOŚĆ PROFESJONALNA, NAUKOWA I TECHNICZNA', kodDzial: '74', kodKlasa: '90', kodPodklasa: 'Z' }]];
    case 'umowa': return [['dzial1.umowaStatut.informacjaOZawarciuZmianieUmowyStatutu[+]', null, { zmianaUmowy: `${fmtDateShort(addDays(YESTERDAY, -9))} AKT NOTARIALNY REP. A NR ${d.int(1000, 9999)}/${YESTERDAY.getFullYear()}` }]];
    case 'wzmianka': return [['dzial3.wzmiankiOZlozonychDokumentach.wzmiankaOZlozeniuRocznegoSprawozdaniaFinansowego[+]', null, { dataZlozenia: fmtDateShort(fin(r.c).y[LAST_FY].filed), zaOkresOdDo: `01.01.${LAST_FY} - 31.12.${LAST_FY}` }]];
    case 'zaleglosc': return [['dzial4.zaleglosci[0].dataWpisu', fmtDateShort(o.dz4[0] ? o.dz4[0].date : addDays(YESTERDAY, -120)), fmtDateShort(YESTERDAY)]];
    default: return [];
  }
}
function engDelta() {
  const rows = deltaRows();
  const T = DELTA_TOTAL;
  const sel = rows[DELTA_SEL] || rows[0];
  return `
    <div class="card">
      <div class="delta-head">
        <div><p class="mono small">GET /api/Krs/Biuletyn/${isoDate(YESTERDAY)}?godzinaOd=00&godzinaDo=24</p>
        <h2 class="h3">Biuletyn z ${fmtDate(YESTERDAY)}: ${num(T.all)} numerów KRS</h2>
        <p class="small muted">Rejestr P: ${num(T.p)} · rejestr S: ${num(T.s)} (pomijamy w fazie 1). W makiecie pokazujemy ${rows.length} spółek z bazy demonstracyjnej.</p></div>
        <button type="button" class="btn btn--accent" data-act="delta-run" id="deltaRun">${icon('play')}${DELTA_DONE ? 'Przetwórz jeszcze raz' : 'Przetwórz biuletyn'}</button>
      </div>
      <div class="stat-row stat-row--6">
        ${[['Odświeżone odpisy', T.p], ['Zmiany w dziale 1', T.dz1], ['Zmiany w dziale 2', T.dz2], ['Nowe wzmianki (dział 3)', T.wzm], ['Wpisy w działach 4 i 6', T.dz4 + T.dz6], ['Nowe dokumenty z RDF', T.found]]
          .map(([l, v]) => `<div class="stat-tile stat-tile--flat"><p class="mini-label">${l}</p><p class="kpi-val kpi-val--sm">${num(v)}</p></div>`).join('')}
      </div>
    </div>
    <div class="delta-grid">
      <div class="card table-card">
        <div class="table-scroll"><table class="plain delta-t" id="deltaTable">
          <thead><tr><th scope="col">Spółka</th><th scope="col">Co się zmieniło</th><th scope="col">Kroki</th></tr></thead>
          <tbody>${rows.map((r, i) => `<tr class="${i === DELTA_SEL ? 'is-sel' : ''}" data-act="delta-sel" data-i="${i}" tabindex="0">
            <td><a href="${coUrl(r.c)}">${esc(r.c.fullName)}</a><span class="mono small muted"> ${r.c.krs}</span></td>
            <td>${r.e.dzial ? `<span class="pill pill--xs pill--${r.e.dzial === 4 || r.e.dzial === 6 ? 'crit' : r.e.dzial === 3 ? 'info' : 'muted'}">dział ${r.e.dzial}</span> ` : '<span class="pill pill--xs pill--muted">bez zmian</span> '}${esc(r.e.title)}</td>
            <td><span class="steps" data-row="${i}">${deltaSteps(r).map(([k, l]) => `<span class="stp${DELTA_DONE ? ' is-done' : ''}" data-tip="${esc(l)}">${l}</span>`).join('')}</span></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>
      <aside class="card diff" id="deltaDiff">${deltaDiffPanel(sel)}</aside>
    </div>
    <div class="card"><h2 class="h4">Reguły delty</h2><ul class="bul">
      <li>Każdy numer z biuletynu dostaje świeży odpis pełny. Nowa wersja ląduje w blob storage obok starej; porównujemy działy 1–6 pole po polu.</li>
      <li>Nowa wzmianka w dziale 3 o sprawozdaniu = zlecenie do kolejki RDF z priorytetem wyższym niż bootstrap.</li>
      <li>Wpisy w działach 4 i 6 od razu zmieniają sygnały ryzyka i budzą alerty u obserwujących.</li>
      <li>Po przetworzeniu: <span class="mono">REFRESH MATERIALIZED VIEW CONCURRENTLY metryki_roczne</span> (ok. 40 s), potem przebudowa zmienionych stron.</li>
    </ul></div>`;
}
function deltaDiffPanel(r) {
  if (!r) return '';
  const diff = deltaDiff(r);
  const show = v => esc(typeof v === 'object' ? JSON.stringify(v, null, 2) : JSON.stringify(v));
  return `<p class="mini-label">diff odpisu · ${esc(r.c.krs)}</p><h3 class="h4">${esc(r.c.fullName)}</h3>
    ${diff.length ? `<pre class="code code--diff">${diff.map(([path, a, b]) => `<span class="df-p">${esc(path)}</span>\n${a != null ? `<span class="df-m">− ${show(a)}</span>\n` : ''}<span class="df-a">+ ${show(b)}</span>`).join('\n\n')}</pre>` : '<p class="muted">Nowa wersja odpisu jest identyczna w działach 1–6. Zapisujemy blob, nic nie przeliczamy.</p>'}
    ${r.e.type === 'wzmianka' ? `<p class="small">${icon('arrow')}Nowa wzmianka za ${LAST_FY} → RDF: <span class="mono">${sfDoc(r.c, LAST_FY) ? sfDoc(r.c, LAST_FY).file : '—'}</span> → <a class="link" href="#/silnik/parser?krs=${r.c.krs}&fy=${LAST_FY}">zobacz w parserze</a></p>` : ''}`;
}
ACTIONS['delta-sel'] = el => {
  DELTA_SEL = +el.dataset.i;
  $$('#deltaTable tbody tr').forEach((tr, i) => tr.classList.toggle('is-sel', i === DELTA_SEL));
  $('#deltaDiff').innerHTML = deltaDiffPanel(deltaRows()[DELTA_SEL]);
};
ACTIONS['delta-run'] = () => {
  const btn = $('#deltaRun');
  btn.disabled = true;
  $$('.stp').forEach(s => s.classList.remove('is-done', 'is-run'));
  const all = $$('.steps');
  let row = 0, k = 0;
  const step = () => {
    const spans = all[row] ? $$('.stp', all[row]) : null;
    if (!spans) { DELTA_DONE = true; btn.disabled = false; btn.innerHTML = icon('play') + 'Przetwórz jeszcze raz'; toast(`Biuletyn przetworzony: ${DELTA_TOTAL.found} nowych dokumentów, ${DELTA_TOTAL.alerts} alertów`); return; }
    if (k > 0) { spans[k - 1].classList.remove('is-run'); spans[k - 1].classList.add('is-done'); }
    if (k < spans.length) { spans[k].classList.add('is-run'); k++; setTimeout(step, REDUCED ? 0 : 110); }
    else { row++; k = 0; step(); }
  };
  step();
};

// ---------- seasonal sweep ----------
function sweepData() {
  const fy = LAST_FY;
  const base = COMPANIES.filter(c => fin(c).y[fy - 1] && c.status === 'aktywna');
  const start = new Date(fy + 1, 3, 1), end = new Date(fy + 1, 9, 31);
  const weeks = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 7)) weeks.push(d);
  const rdf = weeks.map(d => base.filter(c => { const y = fin(c).y[fy]; return y && y.filed <= d; }).length / base.length * 100);
  const krs = weeks.map(d => base.filter(c => { const y = fin(c).y[fy]; return y && y.wzmianka && y.wzmianka <= d; }).length / base.length * 100);
  const runs = weeks.filter(d => d.getDay() === 1 && (d.getMonth() === 5 || d.getMonth() === 6));
  const mondays = [];
  for (let d = new Date(fy + 1, 5, 1); d <= new Date(fy + 1, 6, 31); d = addDays(d, 1)) if (d.getDay() === 1) mondays.push(new Date(d));
  const runRows = mondays.map(d => {
    const todo = base.filter(c => { const y = fin(c).y[fy]; return !y || !y.wzmianka || y.wzmianka > d; });
    const found = todo.filter(c => { const y = fin(c).y[fy]; return y && y.filed <= d; });
    const lead = found.length ? found.reduce((t, c) => { const y = fin(c).y[fy]; return t + ((y.wzmianka || TODAY) - d) / DAY; }, 0) / found.length : 0;
    return { d, todo: todo.length, found: found.length, lead };
  });
  return { base, weeks, rdf, krs, runRows, runs };
}
let SWEEP_NOW = null;
function engSweep() {
  const S = sweepData();
  const fy = LAST_FY;
  const lab = S.weeks.map(d => `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`);
  const iFrom = S.weeks.findIndex(d => d.getMonth() === 5), iTo = S.weeks.findIndex(d => d.getMonth() === 7);
  const gap = S.weeks.map((d, i) => S.rdf[i] - S.krs[i]);
  const gi = gap.indexOf(Math.max(...gap));
  return `
    <div class="card chart-card">
      <div class="chart-card__head"><h2 class="h4">Sprawozdania za ${fy}: w RDF i w KRS, ${fy + 1}</h2>
        <div class="legend"><span><span class="key key--rdf"></span>dokument w RDF</span><span><span class="key key--krs"></span>wzmianka w KRS (dział 3)</span></div></div>
      ${lineChart(lab, [{ name: 'w RDF', cls: 's-rdf', vals: S.rdf }, { name: 'wzmianka w KRS', cls: 's-krs', vals: S.krs }], { marks: [{ from: iFrom, to: iTo, label: 'sweep co tydzień' }], label: 'Odsetek spółek ze sprawozdaniem' })}
      <p class="small muted chart-card__note">Odsetek ${num(S.base.length)} aktywnych spółek z bazy makiety, które złożyły sprawozdanie za ${fy - 1}. Największa luka: ${lab[gi]}, ${Math.round(gap[gi])} pkt proc. spółek ma dokument w RDF, a jeszcze nie ma wzmianki.</p>
    </div>
    <div class="grid2">
      <div class="card table-card"><h2 class="h4">Przebiegi w sezonie ${fy + 1}</h2>
        <div class="table-scroll"><table class="plain"><thead><tr><th scope="col">Poniedziałek</th><th scope="col" class="t-num">Bez wzmianki</th><th scope="col" class="t-num">Znalezione w RDF</th><th scope="col" class="t-num">Przed KRS średnio</th></tr></thead>
        <tbody>${S.runRows.map(r => `<tr><th scope="row">${fmtDateShort(r.d)}</th><td class="t-num">${num(r.todo)}</td><td class="t-num">${num(r.found)}</td><td class="t-num">${r.found ? Math.round(r.lead) + ' dni' : '—'}</td></tr>`).join('')}</tbody></table></div>
      </div>
      <div class="card"><h2 class="h4">Reguła</h2><ul class="bul">
        <li>Kogo: spółki ze sprawozdaniem za rok N−1 i bez wzmianki za rok N.</li>
        <li>Kiedy: w czerwcu i lipcu co poniedziałek. Termin złożenia mija 15 lipca, a wzmianka w KRS potrafi przyjść kilka tygodni później.</li>
        <li>Kolejność: najpierw największe przychody i spółki obserwowane, bo ich strony i alerty są najcenniejsze.</li>
        <li>Koszt: jedna lista dokumentów na spółkę, w tej samej kolejce RDF co bootstrap, z wyższym priorytetem.</li>
      </ul>
      <button type="button" class="btn btn--ghost" data-act="sweep-now">${icon('play')}Uruchom sweep teraz (poza sezonem)</button>
      <div id="sweepNow">${SWEEP_NOW || ''}</div></div>
    </div>`;
}
ACTIONS['sweep-now'] = () => {
  const fy = LAST_FY;
  const base = COMPANIES.filter(c => fin(c).y[fy - 1]);
  const todo = base.filter(c => { const y = fin(c).y[fy]; return !y || !y.wzmianka; });
  const found = todo.filter(c => fin(c).y[fy]);
  SWEEP_NOW = `<div class="sweep-res"><p><b>${num(todo.length)}</b> spółek bez wzmianki za ${fy} → <b>${num(found.length)}</b> ma już dokument w RDF, ${num(todo.length - found.length)} nadal nic nie złożyło (sygnał „brak sprawozdania”).</p>
    <ul class="small">${found.slice(0, 6).map(c => `<li><a href="${coUrl(c)}">${esc(c.fullName)}</a> · złożone ${fmtDateShort(fin(c).y[fy].filed)}</li>`).join('')}</ul></div>`;
  $('#sweepNow').innerHTML = SWEEP_NOW;
};

// ---------- RDF queue ----------
let RQ = null;
function rqInit() {
  const items = [];
  const PRI = { sf: 1, dz: 2, bad: 2, up: 3, uz: 3 };
  for (const c of COMPANIES.slice(20, 80)) for (const d of documents(c).filter(x => x.fy >= LAST_FY - 1 && x.pipe !== 'ocr')) items.push({ c, d, pri: PRI[d.kind], st: 'czeka' });
  items.sort((a, b) => a.pri - b.pri || hashStr(a.d.id) - hashStr(b.d.id));
  RQ = { items, done: 0, bytes: 0 };
}
function engRdf() {
  if (!RQ) rqInit();
  const sample = BY_KRS.get('0009412708');
  const meta = documents(sample).filter(d => d.fy === LAST_FY).map(d => ({ id: d.id, rodzaj: d.name, okresOd: d.from, okresDo: d.to, dataZlozenia: isoDate(d.filed), status: d.pipe === 'replaced' ? 'ZASTĄPIONY' : 'ZŁOŻONY', nazwaPliku: d.file, format: d.format, rozmiar: d.size }));
  setTimeout(() => { if (location.hash.startsWith('#/silnik/rdf')) { clearInterval(RQ_TIMER); RQ_TIMER = setInterval(rqTick, Math.max(600, ENG.rdfGap * 1000)); } }, 0);
  return `
    <div class="grid2">
      <div class="card"><h2 class="h4">Polityka kolejki</h2>
        <dl class="kv">
          <dt>Połączenia</dt><dd>1, żadnych równoległych żądań</dd>
          <dt>Odstęp</dt><dd>${String(ENG.rdfGap).replace('.', ',')} s ± 30% (jitter); w nocy bez zmian, żeby nie wyglądać na skok ruchu</dd>
          <dt>429</dt><dd>przerwa 2 min, potem 4, 8… maks. 1 h; po 20 udanych żądaniach licznik wraca do zera</dd>
          <dt>Captcha</dt><dd>odpowiedź HTML zamiast JSON → kolejka stoi 45 min, alert do operatora. Nie obchodzimy.</dd>
          <dt>Cache</dt><dd>pliku o znanym id i rozmiarze nie pobieramy drugi raz; sha256 sprawdzamy po pobraniu</dd>
          <dt>Nagłówki</dt><dd><span class="mono small">User-Agent: rocznik-crawler/1.4 (+kontakt@rocznik.example)</span></dd>
        </dl>
      </div>
      <div class="card"><h2 class="h4">Priorytety pobierania</h2>
        <ol class="pri">
          <li><span class="pill pill--ok pill--xs">1</span><b>Roczne sprawozdanie finansowe (XML)</b>, rdzeń: bilans, RZiS, przepływy, wraz z korektami</li>
          <li><span class="pill pill--info pill--xs">2</span><b>Sprawozdanie z działalności i opinia biegłego</b>: tekst pod LLM</li>
          <li><span class="pill pill--info pill--xs">3</span><b>Uchwały o zatwierdzeniu i podziale zysku</b>: z nich dywidendy</li>
          <li><span class="pill pill--muted pill--xs">—</span><b>Skany PDF</b>: osobna kolejka, OCR albo LLM po MVP</li>
        </ol>
        <p class="small muted">Sweep sezonowy i delta wskakują przed bootstrap: aktualność stron jest ważniejsza niż historia.</p>
      </div>
    </div>
    <div class="card table-card">
      <div class="lane__head"><h2 class="h4">Kolejka teraz</h2><span class="small muted" id="rqStat">${rqStat()}</span></div>
      <div class="table-scroll"><table class="plain"><thead><tr><th scope="col">Prio</th><th scope="col">Spółka</th><th scope="col">Plik</th><th scope="col" class="t-num">Rozmiar</th><th scope="col">Stan</th></tr></thead><tbody id="rqBody">${rqRows()}</tbody></table></div>
    </div>
    <div class="card"><h2 class="h4">Jak wygląda odpowiedź listy dokumentów</h2>
      <p class="small muted">Nowa przeglądarka RDF (od lutego 2026) to SPA nad wewnętrznym REST. Ścieżki podglądamy w DevTools; w makiecie zapisane jako <span class="mono">{rdf}</span>. Stare opisy scraperów z ekrs.ms.gov.pl są nieaktualne.</p>
      <pre class="code code--json">GET {rdf}/podmioty/${sample.krs}/dokumenty?okres=${LAST_FY}\n\n${esc(JSON.stringify({ krs: sample.krs, liczba: meta.length, dokumenty: meta }, null, 2))}</pre>
    </div>`;
}
const rqStat = () => `pobrano ${num(RQ.done)} · ${kbytes(RQ.bytes)} · w kolejce ${num(RQ.items.length)}`;
function rqRows() {
  return RQ.items.slice(0, 12).map((it, i) => `<tr class="${i === 0 ? 'is-run' : ''}"><td><span class="pill pill--xs pill--${it.pri === 1 ? 'ok' : 'info'}">${it.pri}</span></td><td><a href="${coUrl(it.c)}">${esc(it.c.fullName)}</a></td><td class="mono small">${esc(it.d.file)}</td><td class="t-num">${kbytes(it.d.size)}</td><td>${i === 0 ? `<span class="st st--ok"><span class="st__dot"></span>pobieram</span>` : '<span class="muted small">czeka</span>'}</td></tr>`).join('');
}
function rqTick() {
  if (!$('#rqBody')) { clearInterval(RQ_TIMER); return; }
  const it = RQ.items.shift();
  RQ.done++; RQ.bytes += it.d.size;
  RQ.items.push(it);
  $('#rqBody').innerHTML = rqRows();
  $('#rqStat').textContent = rqStat();
}

// ---------- parser lab ----------
let PZ = { krs: '0009305114', fy: 2024, sig: 'auto', orig: false, broken: false, special: null };
const PZ_PRESETS = [
  ['Inna · kalkulacyjny · tys. zł · enveloping', { krs: '0009305114', fy: 2024 }],
  ['Inna · porównawczy · przepływy', { krs: '0009518630', fy: LAST_FY }],
  ['Mała · porównawczy · enveloped', { krs: '0009412708', fy: LAST_FY }],
  ['Mikro', { krs: '0009771205', fy: LAST_FY }],
  ['Korekta: wersja przed korektą', { krs: '0009305114', fy: 2023, orig: true }],
  ['Treść w base64', { krs: '0009412708', fy: 2022, sig: 'base64' }],
  ['Suma się nie zgadza', { krs: '0009412708', fy: 2021, broken: true }],
  ['JednostkaOp (rejestr S)', { special: 'op' }],
  ['Skan PDF', { special: 'pdf' }],
];
function pzXml() {
  if (PZ.special === 'op') return `<?xml version="1.0" encoding="UTF-8"?>\n<JednostkaOp xmlns="${NS_BASE}JednostkaOpWZlotych">\n  <Naglowek>\n    <KodSprawozdania kodSystemowy="SprFinJednostkaOpWZlotych (1)" wersjaSchemy="1-2">SprFinJednostkaOpWZlotych</KodSprawozdania>\n    <OkresOd>${LAST_FY}-01-01</OkresOd>\n    <OkresDo>${LAST_FY}-12-31</OkresDo>\n  </Naglowek>\n  <Bilans>…</Bilans>\n  <RZiS>\n    <RZiSOp>…przychody z działalności statutowej…</RZiSOp>\n  </RZiS>\n</JednostkaOp>`;
  if (PZ.special === 'pdf') return '%PDF-1.4\n%âãÏÓ\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n…\n/Subtype /Image /Width 2480 /Height 3508 /Filter /DCTDecode\n…';
  const c = BY_KRS.get(PZ.krs);
  return buildXml(c, PZ.fy, { orig: PZ.orig, sig: PZ.sig === 'auto' ? undefined : PZ.sig, broken: PZ.broken });
}
function pzParse(xml) {
  if (PZ.special === 'pdf') return { steps: [
    { key: 'read', title: 'Odczyt bloba', detail: `application/pdf · 2,4 MB · klucz ${fakeSha('pdf').slice(0, 12)}…`, ok: true },
    { key: 'type', title: 'Rozpoznanie', detail: 'PDF bez warstwy tekstowej (same obrazy DCT): skan.', ok: 'warn' },
    { key: 'save', title: 'Kolejka', detail: 'Odkładam do kolejki OCR. W MVP pomijamy; później OCR albo LLM z obrazu.', ok: 'warn' },
  ] };
  return parseSprawozdanie(xml);
}
function engParser(params) {
  if (params.krs && BY_KRS.has(params.krs)) PZ = { krs: params.krs, fy: +params.fy || lastFyOf(BY_KRS.get(params.krs)), sig: 'auto', orig: params.orig === '1', broken: false, special: null };
  const c = BY_KRS.get(PZ.krs);
  if (!PZ.special && !fin(c).y[PZ.fy]) PZ.fy = lastFyOf(c);
  if (!PZ.special && PZ.fy === 2017) PZ.fy = 2018;
  return `
    <div class="card pz-pick">
      <div class="pz-presets">${PZ_PRESETS.map(([l, p], i) => `<button type="button" class="chip${pzPresetOn(p) ? ' is-on' : ''}" data-act="pz-preset" data-i="${i}">${l}</button>`).join('')}</div>
      <div class="filters">
        <label class="sel"><span>Spółka</span><select data-change="pz" name="krs">${COMPANIES.slice(0, 60).map(x => `<option value="${x.krs}"${x.krs === PZ.krs ? ' selected' : ''}>${esc(x.fullName)}</option>`).join('')}</select></label>
        <label class="sel"><span>Rok</span><select data-change="pz" name="fy">${fin(c).list.filter(y => y >= 2018).reverse().map(y => `<option${y === PZ.fy ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
        <label class="sel"><span>Podpis</span><select data-change="pz" name="sig">${[['auto', 'jak w RDF'], ['enveloped', 'XAdES enveloped'], ['enveloping', 'XAdES enveloping'], ['base64', 'enveloping, base64'], ['none', 'bez podpisu']].map(([k, l]) => `<option value="${k}"${PZ.sig === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        ${fin(c).y[PZ.fy] && fin(c).y[PZ.fy].korekta ? `<label class="check"><input type="checkbox" data-change="pz" name="orig"${PZ.orig ? ' checked' : ''}> wersja przed korektą</label>` : ''}
        <label class="check"><input type="checkbox" data-change="pz" name="broken"${PZ.broken ? ' checked' : ''}> zepsuj sumę pasywów</label>
      </div>
    </div>
    <div id="pzOut">${pzOut()}</div>`;
}
const pzPresetOn = p => p.special ? PZ.special === p.special : !PZ.special && p.krs === PZ.krs && p.fy === PZ.fy && !!p.orig === PZ.orig && !!p.broken === PZ.broken && (p.sig || 'auto') === PZ.sig;
function pzOut() {
  const xml = pzXml();
  let res;
  try { res = pzParse(xml); } catch (e) { res = { steps: [{ key: 'err', title: 'Błąd parsera', detail: e.message, ok: false }] }; }
  const lines = PZ.special === 'pdf' ? xml.split('\n').map(esc) : highlightXml(xml);
  const c = BY_KRS.get(PZ.krs), y = !PZ.special && fin(c).y[PZ.fy];
  const ref = y ? y.v : null;
  const prevV = y && fin(c).y[PZ.fy - 1] ? fin(c).y[PZ.fy - 1].v : null;
  const m = res.meta;
  const docId = !PZ.special ? (documents(c).find(d => d.fy === PZ.fy && d.kind === 'sf' && (PZ.orig ? d.pipe === 'replaced' : d.pipe !== 'replaced')) || {}).id : null;
  const sid = 48000000 + (hashStr(PZ.krs + PZ.fy + PZ.orig) % 900000);
  const okCls = ok => ok === true ? 'ok' : ok === 'warn' ? 'warn' : 'crit';
  return `
    <div class="pz-grid">
      <div class="card xml">
        <div class="terminal__head"><span class="mono">${PZ.special === 'pdf' ? 'sprawozdanie_2017.pdf' : PZ.special === 'op' ? 'SprFin_OPP.xml' : esc(((PZ.orig ? documents(c).find(d => d.fy === PZ.fy && d.pipe === 'replaced') : sfDoc(c, PZ.fy)) || {}).file || 'plik.xml')}</span><span class="small">${num(xml.length)} znaków · ${lines.length} linii</span></div>
        <pre class="xml__body"><code>${lines.map((l, i) => `<span class="ln">${i + 1}</span>${l}`).join('\n')}</code></pre>
      </div>
      <div class="card pz-steps">
        <h2 class="h4">Przebieg</h2>
        <ol class="psteps">${res.steps.map((s, i) => `<li class="pstep pstep--${okCls(s.ok)}" style="animation-delay:${REDUCED ? 0 : i * 140}ms"><span class="pstep__i">${icon(s.ok === true ? 'check' : s.ok === 'warn' ? 'alert' : 'x')}</span><div><p class="pstep__t">${s.title}</p><p class="pstep__d">${esc(s.detail)}</p></div></li>`).join('')}</ol>
        ${m ? `<dl class="kv kv--sm"><dt>Element główny</dt><dd class="mono">${m.root}</dd><dt>Typ jednostki</dt><dd>${ENTITY[m.type].label}</dd><dt>RZiS</dt><dd>${VARIANT[m.variant]}</dd><dt>Jednostka</dt><dd>${m.unit === 'tys' ? 'tys. zł (×1000)' : 'zł'}</dd><dt>Schemat</dt><dd>${m.version}</dd><dt>Podpis</dt><dd>${m.sigMode}</dd><dt>Okres</dt><dd>${m.from} – ${m.to}</dd></dl>` : ''}
      </div>
    </div>
    ${res.rows ? `
    <div class="card table-card">
      <div class="lane__head"><h2 class="h4">Pozycje po mapowaniu (${res.rows.length})</h2><span class="small muted">porównanie z bazą: KwotaA z wartością za ${PZ.fy}, KwotaB z wartością za ${PZ.fy - 1}</span></div>
      <div class="table-scroll"><table class="plain plain--sm pz-rows"><thead><tr><th scope="col">Ścieżka w XML</th><th scope="col">Kod</th><th scope="col">Pozycja</th><th scope="col" class="t-num">KwotaA (zł)</th><th scope="col" class="t-num">KwotaB (zł)</th><th scope="col">W bazie</th></tr></thead>
      <tbody>${res.rows.map(r => {
        const want = ref ? ref[r.code] || 0 : null;
        const okA = want == null || Math.abs(r.a - want) <= (m.unit === 'tys' ? 600 : 1);
        const wantB = prevV ? prevV[r.code] || 0 : 0;
        const okB = r.b == null || Math.abs(r.b - wantB) <= (m.unit === 'tys' ? 600 : 1);
        return `<tr class="lvl${CODE[r.code] ? CODE[r.code].lvl : 0}"><td class="mono small">${esc(r.path)}</td><td class="mono small">${r.code}</td><td>${esc(CODE[r.code] ? CODE[r.code].label : r.code)}${r.derived ? ' <span class="pill pill--muted pill--xs">wyliczone</span>' : ''}</td><td class="t-num${r.a < 0 ? ' is-neg' : ''}">${fmtCell(r.a, 'zl')}</td><td class="t-num${r.b < 0 ? ' is-neg' : ''}">${r.b == null ? '—' : fmtCell(r.b, 'zl')}</td><td>${okA && okB ? `<span class="t-ok">${icon('check')}</span>` : `<span class="t-warn" data-tip="${esc(!okA ? `w bazie ${fmtCell(want, 'zl')} (wersja po korekcie)` : `KwotaB ≠ KwotaA z pliku za ${PZ.fy - 1}: dane porównawcze przekształcone`)}">${icon('alert')}</span>`}</td></tr>`;
      }).join('')}</tbody></table></div>
      ${res.unmapped && res.unmapped.length ? `<p class="small muted">Bez kodu kanonicznego, zostają w surowym JSON: ${res.unmapped.map(u => `<span class="mono">${esc(u.path)}</span>`).join(', ')}</p>` : ''}
    </div>
    <div class="grid2">
      <div class="card"><h2 class="h4">Kontrola sum</h2><ul class="checks">${res.checks.map(x => `<li class="${x.ok ? 't-ok' : 't-crit'}">${icon(x.ok ? 'check' : 'x')}${esc(x.label)}${x.ok ? '' : ` · różnica ${fmtCell(x.diff, 'zl')} zł`}</li>`).join('')}</ul></div>
      <div class="card"><h2 class="h4">Zapis do Postgresa</h2>
        <pre class="code code--sql">${esc(`INSERT INTO sprawozdanie (id, dokument_id, krs, okres_od, okres_do, typ_jednostki, wariant_rzis, jednostka, wersja_schematu, podpis)
VALUES (${sid}, '${docId}', '${m.krs || PZ.krs}', '${m.from}', '${m.to}', '${m.root}', '${m.variant}', '${m.unit}', '${m.version}', '${m.sigMode}');

INSERT INTO pozycja (sprawozdanie_id, kod, kwota_biezaca, kwota_poprzednia) VALUES
${res.rows.slice(0, 6).map(r => `  (${sid}, '${r.code}', ${r.a.toFixed(2)}, ${r.b == null ? 'NULL' : r.b.toFixed(2)})`).join(',\n')},
  … ${res.rows.length - 6} kolejnych wierszy;`)}</pre></div>
    </div>
    <details class="card"><summary><h2 class="h4">Słownik mapowań dla ${m.root}${m.type !== 'Mikro' ? ' · ' + VARIANT[m.variant] : ''} (${mappingFor(m.type, m.variant).filter(x => x.code).length} ścieżek)</h2></summary>
      <div class="table-scroll"><table class="plain plain--sm"><thead><tr><th scope="col">Ścieżka</th><th scope="col">Kod</th><th scope="col">Znak</th></tr></thead><tbody>${mappingFor(m.type, m.variant).map(x => `<tr><td class="mono small">${x.path}</td><td class="mono small">${x.code || '— (surowe)'}</td><td>${x.sign < 0 ? '−1 (wydatek)' : ''}</td></tr>`).join('')}</tbody></table></div>
    </details>` : ''}`;
}
ACTIONS['pz-preset'] = el => {
  const p = PZ_PRESETS[+el.dataset.i][1];
  PZ = { krs: p.krs || PZ.krs, fy: p.fy || PZ.fy, sig: p.sig || 'auto', orig: !!p.orig, broken: !!p.broken, special: p.special || null };
  history.replaceState(null, '', '#/silnik/parser');
  rerender();
};
CHANGES.pz = el => {
  const k = el.name;
  PZ.special = null;
  if (k === 'krs') { PZ.krs = el.value; PZ.fy = lastFyOf(BY_KRS.get(el.value)); PZ.orig = false; }
  else if (k === 'fy') { PZ.fy = +el.value; PZ.orig = false; }
  else if (k === 'sig') PZ.sig = el.value;
  else PZ[k] = el.checked;
  history.replaceState(null, '', '#/silnik/parser');
  rerender();
};

// ---------- data model ----------
const TABLES = [
  ['blob', 'surowe pliki, niemutowalne', UNIVERSE.dokumenty + UNIVERSE.rejestrP * 3, [['sha256', 'char(64) PK'], ['zrodlo', 'text: krs | rdf | wl'], ['url', 'text'], ['content_type', 'text'], ['rozmiar', 'bigint'], ['pobrano', 'timestamptz']]],
  ['podmiot', 'z odpisu pełnego', UNIVERSE.rejestrP, [['krs', 'char(10) PK'], ['rejestr', 'char(1)'], ['nazwa', 'text'], ['forma_prawna', 'text'], ['nip', 'char(10)'], ['regon', 'varchar(14)'], ['pkd', 'varchar(7)'], ['woj', 'text'], ['status', 'text'], ['odpis_sha256', '→ blob'], ['odswiezono', 'timestamptz']]],
  ['dokument', 'lista z RDF, każda wersja', UNIVERSE.dokumenty, [['id', 'text PK'], ['krs', '→ podmiot'], ['rodzaj', 'text'], ['okres_od', 'date'], ['okres_do', 'date'], ['data_zlozenia', 'date'], ['status', 'text'], ['nazwa_pliku', 'text'], ['format', 'text'], ['zastepuje', '→ dokument'], ['sha256', '→ blob']]],
  ['sprawozdanie', 'jeden XML po parsowaniu', UNIVERSE.sprawozdania, [['id', 'bigint PK'], ['dokument_id', '→ dokument'], ['krs', '→ podmiot'], ['okres_od', 'date'], ['okres_do', 'date'], ['typ_jednostki', 'text'], ['wariant_rzis', 'text'], ['jednostka', 'zl | tys'], ['wersja_schematu', 'text'], ['parser', 'text']]],
  ['pozycja', 'format long', UNIVERSE.pozycje, [['sprawozdanie_id', '→ sprawozdanie'], ['kod', 'text, np. BS.A, PL.REV'], ['kwota_biezaca', 'numeric(18,2)'], ['kwota_poprzednia', 'numeric(18,2)']]],
  ['metryki_roczne', 'widok zmaterializowany', Math.round(UNIVERSE.sprawozdania * 1.18), [['krs', 'char(10)'], ['rok', 'int'], ['przychody … plynnosc', '16 kolumn'], ['zrodlo', 'KwotaA | KwotaB'], ['sprawozdanie_id', '→ sprawozdanie']]],
];
const MV_SQL = `CREATE MATERIALIZED VIEW metryki_roczne AS
WITH ostatnie AS (           -- najnowsza wersja (korekta) za każdy okres
  SELECT DISTINCT ON (s.krs, s.okres_do) s.*
  FROM sprawozdanie s JOIN dokument d ON d.id = s.dokument_id
  ORDER BY s.krs, s.okres_do, d.data_zlozenia DESC
), wartosci AS (             -- KwotaA z własnego pliku, KwotaB z pliku za rok następny jako zapas
  SELECT o.krs, extract(year FROM o.okres_do)::int AS rok, p.kod, p.kwota_biezaca AS kwota, 1 AS prio, o.id AS sprawozdanie_id
  FROM ostatnie o JOIN pozycja p ON p.sprawozdanie_id = o.id
  UNION ALL
  SELECT o.krs, extract(year FROM o.okres_do)::int - 1, p.kod, p.kwota_poprzednia, 2, o.id
  FROM ostatnie o JOIN pozycja p ON p.sprawozdanie_id = o.id
), wybrane AS (
  SELECT DISTINCT ON (krs, rok, kod) * FROM wartosci ORDER BY krs, rok, kod, prio
)
SELECT krs, rok,
  max(kwota) FILTER (WHERE kod = 'PL.REV')  AS przychody,
  max(kwota) FILTER (WHERE kod = 'PL.EBIT') AS ebit,
  max(kwota) FILTER (WHERE kod = 'PL.EBIT') + coalesce(max(kwota) FILTER (WHERE kod = 'PL.OPEX.DA'), max(kwota) FILTER (WHERE kod = 'CF.OP.DA')) AS ebitda,
  max(kwota) FILTER (WHERE kod = 'PL.EBT')  AS zysk_brutto,
  max(kwota) FILTER (WHERE kod = 'PL.NET')  AS zysk_netto,
  max(kwota) FILTER (WHERE kod = 'BS.TOT')  AS aktywa,
  max(kwota) FILTER (WHERE kod = 'BS.P.A')  AS kapital_wlasny,
  max(kwota) FILTER (WHERE kod = 'BS.P.B')  AS zobowiazania,
  max(kwota) FILTER (WHERE kod = 'BS.P.B.III') AS zobowiazania_kr,
  coalesce(max(kwota) FILTER (WHERE kod = 'BS.B.III.CASH'), max(kwota) FILTER (WHERE kod = 'BS.B.III')) AS gotowka,
  max(kwota) FILTER (WHERE kod = 'CF.OP')   AS cfo,
  -- marza_ebit, marza_netto, roe, zadluzenie, plynnosc_biezaca: ilorazy powyższych
  min(prio) AS zrodlo
FROM wybrane GROUP BY krs, rok;

CREATE UNIQUE INDEX ON metryki_roczne (krs, rok);   -- wymagane przez REFRESH … CONCURRENTLY`;
let MODEL_Q = 0;
function modelQueries() {
  return [
    [`Top 10 przychodów, PKD 62.01.Z, ${LAST_FY}`, `SELECT p.nazwa, m.przychody\nFROM metryki_roczne m JOIN podmiot p USING (krs)\nWHERE m.rok = ${LAST_FY} AND p.pkd = '62.01.Z'\nORDER BY m.przychody DESC LIMIT 10;`,
      () => rankRows('rev', LAST_FY, { pkd: '62.01.Z' }).slice(0, 10).map(r => [r.c.fullName, fmtMoney(r.v)])],
    [`Ujemny kapitał własny w ${LAST_FY}`, `SELECT p.nazwa, m.kapital_wlasny\nFROM metryki_roczne m JOIN podmiot p USING (krs)\nWHERE m.rok = ${LAST_FY} AND m.kapital_wlasny < 0\nORDER BY m.kapital_wlasny LIMIT 10;`,
      () => COMPANIES.filter(c => metrics(c)[LAST_FY] && metrics(c)[LAST_FY].equity < 0).sort((a, b) => metrics(a)[LAST_FY].equity - metrics(b)[LAST_FY].equity).slice(0, 10).map(c => [c.fullName, fmtMoney(metrics(c)[LAST_FY].equity)])],
    [`Lista do sweepa: jest ${LAST_FY - 1}, brak ${LAST_FY}`, `SELECT p.krs, p.nazwa\nFROM podmiot p\nWHERE EXISTS (SELECT 1 FROM metryki_roczne m WHERE m.krs = p.krs AND m.rok = ${LAST_FY - 1} AND m.zrodlo = 1)\n  AND NOT EXISTS (SELECT 1 FROM metryki_roczne m WHERE m.krs = p.krs AND m.rok = ${LAST_FY} AND m.zrodlo = 1)\nLIMIT 10;`,
      () => COMPANIES.filter(c => fin(c).y[LAST_FY - 1] && !fin(c).y[LAST_FY]).slice(0, 10).map(c => [c.krs, c.fullName])],
    ['Ile lat mamy tylko z KwotaB', `SELECT rok, count(*) FILTER (WHERE zrodlo = 2) AS tylko_kwota_b, count(*) AS razem\nFROM metryki_roczne GROUP BY rok ORDER BY rok;`,
      () => FYS.map(fy => { const n = COMPANIES.filter(c => fin(c).y[fy]).length; return [fy, `${fy === 2017 ? num(n) : 0} z ${num(n)}`]; })],
  ];
}
function engModel(params) {
  const c = BY_KRS.get(params.krs) || BY_KRS.get('0009412708');
  const f = fin(c), docs = documents(c), m = metrics(c);
  const lf = f.list[f.list.length - 1];
  const Q = modelQueries()[MODEL_Q];
  const sids = Object.fromEntries(f.list.filter(fy => fy >= 2018).map(fy => [fy, 48000000 + (hashStr(c.krs + fy + false) % 900000)]));
  return `
    <div class="tables">${TABLES.map(([n, d, rows, cols]) => `<div class="card dbt${n === 'metryki_roczne' ? ' dbt--mv' : ''}"><p class="dbt__n mono">${n}</p><p class="small muted">${d} · ~${rows >= 1e6 ? (rows / 1e6).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + ' mln' : num(rows)} wierszy</p><ul>${cols.map(([k, t]) => `<li><span class="mono">${k}</span><span class="small muted">${t}</span></li>`).join('')}</ul></div>`).join('')}</div>
    <details class="card"><summary><h2 class="h4">metryki_roczne: definicja widoku</h2></summary><pre class="code code--sql">${esc(MV_SQL)}</pre></details>
    <div class="card table-card">
      <div class="lane__head"><h2 class="h4">Wiersze jednej spółki</h2><label class="sel sel--inline"><span>Spółka</span><select data-change="model-co">${COMPANIES.slice(0, 60).map(x => `<option value="${x.krs}"${x === c ? ' selected' : ''}>${esc(x.fullName)}</option>`).join('')}</select></label></div>
      <p class="mono small">podmiot · 1 wiersz</p>
      <div class="table-scroll"><table class="plain plain--sm"><thead><tr><th>krs</th><th>nazwa</th><th>forma_prawna</th><th>nip</th><th>pkd</th><th>status</th><th>odpis_sha256</th></tr></thead><tbody><tr><td class="mono">${c.krs}</td><td>${esc(c.krsName)}</td><td>${FORMS[c.form]}</td><td class="mono">${c.nip}</td><td class="mono">${c.sector.pkd}</td><td>${c.status}</td><td class="mono small">${fakeSha(c.krs + 'odpis').slice(0, 12)}…</td></tr></tbody></table></div>
      <p class="mono small">dokument · ${docs.length} wierszy (pierwsze 8)</p>
      <div class="table-scroll"><table class="plain plain--sm"><thead><tr><th>id</th><th>rodzaj</th><th>okres_do</th><th>data_zlozenia</th><th>format</th><th>zastepuje</th><th>sha256</th></tr></thead><tbody>${docs.slice(0, 8).map(d => `<tr><td class="mono">${d.id}</td><td>${esc(d.name)}</td><td>${d.to}</td><td>${isoDate(d.filed)}</td><td>${d.format}</td><td class="mono">${d.korekta ? d.id.replace(/-7$/, '-1') : ''}</td><td class="mono small">${d.sha.slice(0, 12)}…</td></tr>`).join('')}</tbody></table></div>
      <p class="mono small">sprawozdanie · ${Object.keys(sids).length} wierszy</p>
      <div class="table-scroll"><table class="plain plain--sm"><thead><tr><th>id</th><th>okres_do</th><th>typ_jednostki</th><th>wariant_rzis</th><th>jednostka</th><th>wersja_schematu</th></tr></thead><tbody>${Object.entries(sids).reverse().map(([fy, id]) => { const y = f.y[fy]; return `<tr><td class="mono">${id}</td><td>${fy}-12-31</td><td class="mono">${ENTITY[y.type].root}</td><td>${y.variant}</td><td>${y.unit}</td><td>${schemaVersion(+fy)}</td></tr>`; }).join('')}</tbody></table></div>
      ${lf >= 2018 ? `<p class="mono small">pozycja · ${Object.keys(f.y[lf].v).length} wierszy dla ${lf} (pierwsze 10)</p>
      <div class="table-scroll"><table class="plain plain--sm"><thead><tr><th>sprawozdanie_id</th><th>kod</th><th class="t-num">kwota_biezaca</th><th class="t-num">kwota_poprzednia</th></tr></thead><tbody>${Object.keys(f.y[lf].v).slice(0, 10).map(k => `<tr><td class="mono">${sids[lf]}</td><td class="mono">${k}</td><td class="t-num">${f.y[lf].v[k].toFixed(2)}</td><td class="t-num">${f.y[lf - 1] && f.y[lf - 1].v[k] != null ? f.y[lf - 1].v[k].toFixed(2) : 'NULL'}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <p class="mono small">metryki_roczne · ${f.list.length} wierszy</p>
      <div class="table-scroll"><table class="plain plain--sm"><thead><tr><th>rok</th><th class="t-num">przychody</th><th class="t-num">ebit</th><th class="t-num">zysk_netto</th><th class="t-num">aktywa</th><th class="t-num">kapital_wlasny</th><th class="t-num">zadluzenie</th><th>zrodlo</th></tr></thead><tbody>${f.list.slice().reverse().map(fy => `<tr><td>${fy}</td><td class="t-num">${fmtCell(m[fy].rev, 'zl')}</td><td class="t-num">${m[fy].ebitEst ? '<span class="muted">NULL</span>' : fmtCell(m[fy].ebit, 'zl')}</td><td class="t-num">${fmtCell(m[fy].net, 'zl')}</td><td class="t-num">${fmtCell(m[fy].assets, 'zl')}</td><td class="t-num">${fmtCell(m[fy].equity, 'zl')}</td><td class="t-num">${fmtRatio(m[fy].debt)}</td><td>${fy === 2017 ? 'KwotaB' : 'KwotaA'}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="card">
      <div class="lane__head"><h2 class="h4">Zapytania</h2></div>
      <div class="pz-presets">${modelQueries().map(([l], i) => `<button type="button" class="chip${i === MODEL_Q ? ' is-on' : ''}" data-act="model-q" data-i="${i}">${esc(l)}</button>`).join('')}</div>
      <div class="grid2 grid2--tight"><pre class="code code--sql">${esc(Q[1])}</pre><div class="table-scroll"><table class="plain plain--sm"><tbody>${Q[2]().map(r => `<tr>${r.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('') || '<tr><td class="muted">0 wierszy</td></tr>'}</tbody></table></div></div>
    </div>`;
}
CHANGES['model-co'] = el => { location.hash = '#/silnik/model?krs=' + el.value; };
ACTIONS['model-q'] = el => { MODEL_Q = +el.dataset.i; rerender(); };
