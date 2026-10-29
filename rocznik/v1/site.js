// Rocznik v1 — the public site: home, search, company page, rankings, watchlist and the printable report.

let WATCH = store.get('watch', []);
let ALERTS = Object.assign({ sf: true, zarzad: true, ryzyko: true, spadek: true, brak: true }, store.get('alerts', {}));
let CO = Object.assign({ metric: 'rev', tab: 'bilans', unit: 'auto', codes: false }, store.get('co', {}));
let CUR = null;
const saveWatch = () => { store.set('watch', WATCH); updateWatchCount(); };
const saveCo = () => store.set('co', CO);
function updateWatchCount() { const el = $('#watchCount'); if (el) { el.textContent = WATCH.length; el.hidden = !WATCH.length; } }

const coUrl = c => `#/firma/${c.krs}-${c.slug}`;
const seoUrl = c => `rocznik.example/firma/${c.krs}-${c.slug}`;
const lastFyOf = c => { const l = fin(c).list; return l[l.length - 1]; };
const revOf = (c, fy = LAST_FY) => { const y = fin(c).y[fy]; return y ? y.v['PL.REV'] : null; };
const HERO_PICKS = ['0009412708', '0009305114', '0009518630', '0009233871', '0009771205'];

const STATUS = {
  aktywna: ['ok', 'Aktywna'], likwidacja: ['warn', 'W likwidacji'], 'upadłość': ['crit', 'Upadłość'], restrukturyzacja: ['warn', 'Restrukturyzacja'],
};
const LEVEL = { niskie: ['ok', 'check'], umiarkowane: ['info', 'info'], 'podwyższone': ['warn', 'alert'], wysokie: ['crit', 'octagon'] };
const statusPill = c => `<span class="pill pill--${STATUS[c.status][0]}">${STATUS[c.status][1]}</span>`;
const riskBadge = (c, short) => { const r = risk(c), l = LEVEL[r.level]; return `<span class="pill pill--${l[0]}">${icon(l[1])}${short ? '' : 'Ryzyko '}${r.level}</span>`; };

// ---------- search ----------
function searchCompanies(q, limit = 8) {
  const raw = q.trim();
  if (!raw) return [];
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 3 && /^[\d\s-]+$/.test(raw)) {
    return COMPANIES.filter(c => c.krs.includes(digits) || c.nip.includes(digits) || c.regon.includes(digits))
      .slice(0, limit).map(c => ({ c, via: c.krs.includes(digits) ? 'KRS' : c.nip.includes(digits) ? 'NIP' : 'REGON' }));
  }
  const words = slug(raw).split('-').filter(Boolean);
  const res = [];
  for (const c of COMPANIES) {
    if (words.every(w => c.searchKey.includes(w))) res.push({ c, via: 'nazwa', score: (c.searchKey.startsWith(words[0]) ? 0 : 1) - (c.hero ? 0.5 : 0) });
  }
  res.sort((a, b) => a.score - b.score || (revOf(b.c) || 0) - (revOf(a.c) || 0));
  return res.slice(0, limit);
}

function searchBox(id, { big = false, value = '' } = {}) {
  return `<form class="search${big ? ' search--big' : ''}" role="search" data-act-submit="search" autocomplete="off">
    <label class="sr-only" for="q-${id}">Szukaj spółki</label>
    ${icon('search', 'i search__i')}
    <input id="q-${id}" class="search__input" type="search" name="q" value="${esc(value)}" placeholder="Nazwa, KRS albo NIP" data-input="ac" aria-autocomplete="list" aria-controls="ac-${id}" aria-expanded="false">
    <button class="btn btn--accent search__btn" type="submit">Szukaj</button>
    <ul class="ac" id="ac-${id}" role="listbox" hidden></ul>
  </form>`;
}

INPUTS.ac = el => {
  const list = el.parentElement.querySelector('.ac');
  const res = searchCompanies(el.value, 7);
  el.setAttribute('aria-expanded', res.length ? 'true' : 'false');
  list.hidden = !res.length;
  list.innerHTML = res.map(({ c, via }, i) => `<li role="option" id="${list.id}-${i}"><a href="${coUrl(c)}">
    <span class="ac__name">${esc(c.fullName)}</span>
    <span class="ac__meta mono">KRS ${c.krs}${via === 'NIP' ? ` · NIP ${c.nipF} <em>biała lista VAT → KRS</em>` : ''} · ${esc(c.city)}</span></a></li>`).join('');
};
document.addEventListener('keydown', e => {
  const inp = e.target.closest && e.target.closest('.search__input');
  if (!inp) return;
  const list = inp.parentElement.querySelector('.ac');
  const items = $$('li', list);
  if (!items.length || list.hidden) return;
  let i = items.findIndex(li => li.classList.contains('is-on'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    items.forEach(li => li.classList.remove('is-on'));
    i = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[i].classList.add('is-on');
    inp.setAttribute('aria-activedescendant', items[i].id);
  } else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); location.hash = $('a', items[i]).getAttribute('href'); }
  else if (e.key === 'Escape') { list.hidden = true; }
});
document.addEventListener('click', e => { if (!e.target.closest('.search')) $$('.ac').forEach(l => { l.hidden = true; }); });
document.addEventListener('submit', e => {
  const form = e.target.closest('[data-act-submit="search"]');
  if (!form) return;
  e.preventDefault();
  const q = form.q.value.trim();
  const res = searchCompanies(q, 2);
  if (res.length === 1 || (res.length && res[0].via !== 'nazwa')) location.hash = coUrl(res[0].c);
  else location.hash = '#/szukaj?q=' + encodeURIComponent(q);
});

function renderSearch(q) {
  const res = searchCompanies(q, 60);
  return `<section class="wrap page">
    <p class="crumbs"><a href="#/">Rocznik</a> / Wyniki wyszukiwania</p>
    <h1 class="h1">Wyniki dla „${esc(q)}”</h1>
    <div class="page-search">${searchBox('page', { value: q })}</div>
    ${res.length ? `<ul class="results">${res.map(({ c, via }) => {
      const fy = lastFyOf(c), mm = fy && metrics(c)[fy];
      return `<li class="result"><a href="${coUrl(c)}">
        <span class="result__name">${esc(c.fullName)}</span>
        <span class="result__meta mono">KRS ${c.krs} · NIP ${c.nipF} · ${esc(c.city)} · PKD ${c.sector.pkd}${via !== 'nazwa' ? ` · trafienie po ${via}` : ''}</span>
        <span class="result__fig">${mm ? `${fmtMoney(mm.rev)} przychodów w ${fy}` : 'brak sprawozdań'}</span>
        ${statusPill(c)}</a></li>`;
    }).join('')}</ul>` : `<div class="empty">${icon('search')}<p>Nic nie znaleźliśmy. Spróbuj numeru KRS (10 cyfr) albo NIP.</p></div>`}
  </section>`;
}

// ---------- home ----------
function renderHome() {
  const w = BY_KRS.get('0009305114');
  const wm = metrics(w), wf = fin(w);
  const yEvents = EVENTS.filter(e => +e.date === +YESTERDAY);
  const recentFiled = COMPANIES.filter(c => { const y = fin(c).y[LAST_FY]; return y && y.filed >= addDays(TODAY, -21); }).sort((a, b) => fin(b).y[LAST_FY].filed - fin(a).y[LAST_FY].filed).slice(0, 6);
  const riskNew = COMPANIES.map(c => ({ c, s: risk(c).sig.find(s => s.sev === 'high' && s.src.startsWith('KRS') && s.date >= addDays(TODAY, -120)) })).filter(x => x.s).sort((a, b) => b.s.date - a.s.date).slice(0, 6);
  return `
  <section class="hero">
    <div class="wrap hero__in">
      <div class="hero__copy">
        <p class="eyebrow">Sprawozdania finansowe z RDF · dane rejestrowe z API KRS</p>
        <h1 class="display">Wyniki każdej spółki z&nbsp;KRS. <em>Rok po roku.</em></h1>
        <p class="lede">Bilans, rachunek zysków i strat oraz przepływy z oryginalnych plików XML, od ${FIRST_FY} roku. Zarząd, PKD, zaległości i likwidacje z odpisu pełnego. Odświeżane codziennie z biuletynu KRS.</p>
        ${searchBox('hero', { big: true })}
        <p class="hero__try">Spróbuj: ${HERO_PICKS.map(k => { const c = BY_KRS.get(k); return `<a class="chip" href="${coUrl(c)}">${esc(c.name)}</a>`; }).join('')}<button type="button" class="chip chip--mono" data-act="try-nip" data-nip="${w.nipF}">NIP ${w.nipF}</button></p>
      </div>
      <figure class="hero__card card">
        <div class="hero__card-head">
          <div><p class="kicker">Z dzisiejszego wydania</p><a class="hero__card-name" href="${coUrl(w)}">${esc(w.fullName)}</a><p class="mono muted small">KRS ${w.krs} · PKD ${w.sector.pkd} · w mln zł</p></div>
          ${riskBadge(w, true)}
        </div>
        <table class="ledger" aria-label="Najważniejsze pozycje w mln zł">
          <thead><tr><th scope="col" class="sr-only">Pozycja</th>${wf.list.slice(-4).map(fy => `<th scope="col">${fy}</th>`).join('')}</tr></thead>
          <tbody>${[['Przychody', 'rev'], ['Zysk netto', 'net'], ['Kapitał własny', 'equity']].map(([l, k]) => `<tr><th scope="row">${l}</th>${wf.list.slice(-4).map((fy, i, arr) => `<td${i === arr.length - 1 ? ' class="last"' : ''}>${(wm[fy][k] / 1e6).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <p class="mini-label">przychody w mln zł, ${wf.list[0]}–${LAST_FY}</p>
        ${columnChart(wf.list.map(fy => ({ x: fy, v: wm[fy].rev, est: fy === 2017, tip: `<b>${fy}</b><br>Przychody: ${fmtMoney(wm[fy].rev)}${fy === 2017 ? '<br><span class=tip-muted>z KwotaB pliku za 2018</span>' : ''}` })), { h: 170, label: 'Przychody Wektor Soft S.A. w latach' })}
        <figcaption class="small muted"><span class="key key--est"></span>2017 z kolumny „rok poprzedni” (KwotaB) XML-a za 2018; własny plik za 2017 to skan.</figcaption>
      </figure>
    </div>
  </section>

  <section class="statband">
    <div class="wrap statband__in">
      ${[[num(UNIVERSE.aktywneP), 'aktywnych spółek z rejestru P'], [(UNIVERSE.sprawozdania / 1e6).toLocaleString('pl-PL', { maximumFractionDigits: 2 }) + ' mln', 'sprawozdań XML sparsowanych do kodów'], [`${FYS.length} lat`, `historii, ${FIRST_FY}–${LAST_FY}`], [num(1873), `zmian w biuletynie z ${fmtDateShort(YESTERDAY)}`]]
        .map(([v, l]) => `<div class="stat"><p class="stat__v">${v}</p><p class="stat__l">${l}</p></div>`).join('')}
    </div>
    <p class="wrap statband__note small">Liczby dla całego rejestru to szacunki makiety. W bazie demonstracyjnej jest ${num(COMPANIES.length)} fikcyjnych spółek.</p>
  </section>

  <section class="section wrap">
    <div class="section__head"><h2 class="h2">Wczoraj w rejestrze</h2><a class="link" href="#/silnik/delta">Jak działa dzienna aktualizacja ${icon('arrow')}</a></div>
    <div class="grid3">
      <div class="card feed">
        <h3 class="h4">${icon('refresh')}Zmiany w KRS · ${fmtDateShort(YESTERDAY)}</h3>
        <ul>${yEvents.slice(0, 7).map(e => { const c = BY_KRS.get(e.krs); return `<li><a href="${coUrl(c)}">${esc(c.fullName)}</a><span class="feed__meta">Dział ${e.dzial} · ${esc(e.title)}</span></li>`; }).join('')}</ul>
      </div>
      <div class="card feed">
        <h3 class="h4">${icon('file-code')}Nowe sprawozdania za ${LAST_FY}</h3>
        <ul>${recentFiled.map(c => { const y = fin(c).y[LAST_FY]; return `<li><a href="${coUrl(c)}">${esc(c.fullName)}</a><span class="feed__meta">złożone ${fmtDateShort(y.filed)}${y.late ? ' · po terminie' : ''}${!y.wzmianka ? ' · KRS jeszcze bez wzmianki' : ''}</span></li>`; }).join('')}</ul>
      </div>
      <div class="card feed">
        <h3 class="h4">${icon('alert')}Nowe sygnały ryzyka</h3>
        <ul>${riskNew.map(({ c, s }) => `<li><a href="${coUrl(c)}">${esc(c.fullName)}</a><span class="feed__meta">${esc(s.src)} · ${esc(s.title)} · ${fmtDateShort(s.date)}</span></li>`).join('')}</ul>
      </div>
    </div>
  </section>

  <section class="section wrap">
    <div class="section__head"><h2 class="h2">Rankingi za ${LAST_FY}</h2><a class="link" href="#/ranking">Wszystkie rankingi ${icon('arrow')}</a></div>
    <div class="grid3">
      ${miniRanking('Największe przychody', 'rev', null)}
      ${miniRanking('Najszybszy wzrost przychodów', 'growth', 5e6)}
      ${miniRanking('Najwyższa marża netto', 'mNet', 10e6)}
    </div>
  </section>

  <section class="section wrap" id="zrodla">
    <div class="section__head"><h2 class="h2">Skąd są te liczby</h2><a class="link" href="#/silnik">Zajrzyj do silnika ${icon('arrow')}</a></div>
    <div class="sources">
      ${[
        ['database', 'API KRS', 'api-krs.ms.gov.pl', 'Odpis aktualny i pełny w JSON: działy 1–6, czyli dane, zarząd, PKD, wzmianki o sprawozdaniach, zaległości i likwidacje. Dane w domenie publicznej (CC0).'],
        ['refresh', 'Biuletyn zmian KRS', 'ten sam serwis, codziennie', 'Lista numerów KRS zmienionych wczoraj. Odświeżamy tylko te odpisy, a nową wzmiankę w dziale 3 traktujemy jako sygnał, żeby zajrzeć do RDF.'],
        ['file-code', 'Repozytorium Dokumentów Finansowych', 'nowa przeglądarka od lutego 2026', 'Sprawozdania XML z podpisem XAdES, uchwały, opinie biegłych i sprawozdania z działalności. Pobieramy powoli, jedno połączenie naraz.'],
        ['key', 'Biała lista VAT', 'wl-api.mf.gov.pl', 'NIP → KRS (API KRS szuka tylko po numerze KRS), status VAT i liczba rachunków na białej liście.'],
      ].map(([ic, t, s, d]) => `<div class="source">${icon(ic)}<h3 class="h4">${t}</h3><p class="mono small muted">${s}</p><p>${d}</p></div>`).join('')}
    </div>
    <ol class="flow">
      ${['Źródła', 'Surowe pliki (sha256, bez zmian)', 'Parsery: JSON, XML, PDF', 'Postgres: podmiot · dokument · sprawozdanie · pozycja', 'metryki_roczne (~15 wskaźników)', 'Strony spółek, rankingi, raporty, API'].map((s, i) => `<li><span class="flow__n">${i + 1}</span>${s}</li>`).join('')}
    </ol>
  </section>

  <section class="section wrap" id="cennik">
    <div class="section__head"><h2 class="h2">Cennik</h2></div>
    <div class="plans">
      ${[
        ['Darmowy', '0 zł', 'na zawsze', ['Strona każdej spółki', 'Ostatnie 5 lat wyników', 'Sygnały ryzyka z KRS i RDF', 'Rankingi branżowe'], false],
        ['Pro', '49 zł', 'miesięcznie, netto', ['Pełna historia od ' + FIRST_FY, 'Eksport CSV i XLSX', 'Raporty PDF bez limitu', 'Monitoring 100 spółek z alertami e-mail'], true],
        ['API', 'od 490 zł', 'miesięcznie, netto', ['JSON z kodami kanonicznymi', 'Webhook przy nowym sprawozdaniu', 'Zrzut hurtowy co tydzień', 'Surowe XML z RDF na żądanie'], false],
      ].map(([n, p, per, feats, hot]) => `<div class="plan card${hot ? ' plan--hot' : ''}">
        ${hot ? '<span class="plan__tag">Najczęściej wybierany</span>' : ''}
        <h3 class="h3">${n}</h3><p class="plan__price">${p}</p><p class="small muted">${per}</p>
        <ul>${feats.map(f => `<li>${icon('check')}${f}</li>`).join('')}</ul>
        <button type="button" class="btn ${hot ? 'btn--accent' : 'btn--ghost'} btn--block" data-act="plan">Wybierz ${n}</button>
      </div>`).join('')}
    </div>
  </section>

  <section class="section wrap" id="faq">
    <div class="section__head"><h2 class="h2">Pytania</h2></div>
    <div class="faq">
      ${[
        ['Skąd macie dane i czy wolno je publikować?', 'Dane rejestrowe pochodzą z otwartego API KRS, udostępnianego w domenie publicznej (CC0). Dokumenty finansowe są jawne i bezpłatne w Repozytorium Dokumentów Finansowych. Przetwarzamy je do wspólnego formatu i podajemy źródło przy każdej liczbie.'],
        ['Dlaczego nie widać nazwisk członków zarządu?', 'Otwarte API maskuje imiona, nazwiska i PESEL osób fizycznych. Pokazujemy dokładnie to, co zwraca API. Dlatego graf powiązań łączy tylko spółki ze spółkami.'],
        [`Skąd dane za ${FIRST_FY}, skoro XML-e są od 2018?`, 'Każda pozycja w XML ma dwie kwoty: KwotaA (rok bieżący) i KwotaB (rok poprzedni). Sprawozdanie za 2018 daje więc również liczby za 2017. Oznaczamy je kreskowaniem.'],
        ['Spółka złożyła sprawozdanie, a u was go nie ma', 'Wzmianka w dziale 3 KRS pojawia się z opóźnieniem, czasem kilkutygodniowym. W szczycie składania (czerwiec–lipiec) co tydzień sprawdzamy RDF dla spółek bez sprawozdania za ostatni rok. Skany PDF czekają w kolejce do OCR.'],
        ['Co z korektami sprawozdań?', 'Trzymamy każdą wersję dokumentu. Wskaźniki liczymy z najnowszej, a przy zmienionych pozycjach pokazujemy wartość sprzed korekty.'],
        ['Czy są fundacje i stowarzyszenia?', 'Jeszcze nie. Pierwsza faza obejmuje rejestr przedsiębiorców (P). Rejestr S i schemat JednostkaOp są w planie.'],
      ].map(([q, a]) => `<details class="faq__item"><summary>${q}</summary><p>${a}</p></details>`).join('')}
    </div>
  </section>`;
}

function rankRows(metric, fy, { pkd = '', woj = '', minRev = 0 } = {}) {
  const rows = [];
  for (const c of COMPANIES) {
    if (pkd && c.sector.pkd !== pkd) continue;
    if (woj && c.woj !== woj) continue;
    const m = metrics(c)[fy];
    if (!m) continue;
    if (minRev && m.rev < minRev) continue;
    const v = m[metric];
    if (v == null || !Number.isFinite(v)) continue;
    rows.push({ c, v, m });
  }
  rows.sort((a, b) => b.v - a.v);
  return rows;
}
const RANK_METRICS = {
  rev: ['Przychody', 'przychody', v => fmtMoney(v), 'Największe spółki wg przychodów'],
  net: ['Zysk netto', 'zysk-netto', v => fmtMoney(v), 'Najwyższy zysk netto'],
  ebit: ['EBIT', 'ebit', v => fmtMoney(v), 'Najwyższy zysk operacyjny (EBIT)'],
  assets: ['Aktywa', 'aktywa', v => fmtMoney(v), 'Największe spółki wg sumy bilansowej'],
  equity: ['Kapitał własny', 'kapital-wlasny', v => fmtMoney(v), 'Najwyższy kapitał własny'],
  mNet: ['Marża netto', 'marza-netto', v => fmtPct(v), 'Najwyższa marża netto'],
  growth: ['Wzrost przychodów r/r', 'wzrost', v => (v > 0 ? '+' : '') + fmtPct(v, 0), 'Najszybszy wzrost przychodów'],
  roe: ['ROE', 'roe', v => fmtPct(v), 'Najwyższy zwrot z kapitału (ROE)'],
};
function miniRanking(title, metric, minRev) {
  const rows = rankRows(metric, LAST_FY, { minRev }).slice(0, 5);
  return `<div class="card rank-mini">
    <h3 class="h4">${title}</h3>
    ${minRev ? `<p class="small muted">spółki z przychodami powyżej ${fmtMoney(minRev)}</p>` : '<p class="small muted">wszystkie branże</p>'}
    <ol>${rows.map(r => `<li><a href="${coUrl(r.c)}">${esc(r.c.fullName)}</a><span class="rank-mini__v">${RANK_METRICS[metric][2](r.v)}</span></li>`).join('')}</ol>
    <a class="link small" href="#/ranking?m=${metric}${minRev ? '&min=' + minRev : ''}">Pełny ranking ${icon('arrow')}</a>
  </div>`;
}

ACTIONS['try-nip'] = el => { const inp = $('#q-hero'); inp.value = el.dataset.nip; inp.focus(); INPUTS.ac(inp); };
ACTIONS.plan = () => toast('Makieta: płatności nie są podłączone');

// ---------- company page ----------
const CO_METRICS = [['rev', 'Przychody'], ['net', 'Zysk netto'], ['ebit', 'EBIT'], ['assets', 'Aktywa'], ['equity', 'Kapitał własny'], ['cash', 'Gotówka'], ['cfo', 'Przepływy operacyjne']];

function sfDoc(c, fy) { return documents(c).find(d => d.fy === fy && d.kind === 'sf' && d.pipe !== 'replaced'); }
function provenance(c, fy) {
  const y = fin(c).y[fy];
  if (y.src.field === 'KwotaB') return `kolumna „rok poprzedni” (KwotaB) z ${sfDoc(c, 2018).file}; własny plik za 2017 to skan PDF`;
  const d = sfDoc(c, fy);
  return `${d.file} · KwotaA${y.korekta ? ' · po korekcie z ' + fmtDateShort(y.korekta) : ''}`;
}

function renderCompany(krs) {
  const c = BY_KRS.get(krs);
  if (!c) return `<section class="wrap page"><h1 class="h1">Nie ma takiej spółki</h1><p>Numer KRS ${esc(krs)} nie występuje w bazie makiety.</p><p><a class="btn btn--ghost" href="#/">Wróć</a></p></section>`;
  CUR = c;
  const f = fin(c), o = odpis(c);
  const watched = WATCH.includes(c.krs);
  return `
  <div class="co">
    <div class="wrap">
      <p class="crumbs"><a href="#/">Rocznik</a> / <a href="#/ranking?pkd=${c.sector.pkd}">${esc(c.sector.short)} (${c.sector.pkd})</a> / <span>${esc(c.name)}</span></p>
      <header class="co-head">
        <div class="co-head__main">
          <p class="co-reg">KRS № ${c.krs} · rejestr przedsiębiorców</p>
          <h1 class="co-name">${esc(c.name)} <span class="co-form">${c.form}${c.status === 'likwidacja' ? ' w likwidacji' : ''}</span></h1>
          <div class="co-badges">${c.status === 'aktywna' ? statusPill(c) : ''}<span class="pill pill--muted">${esc(FORMS[c.form].toLowerCase())}</span>${riskBadge(c)}</div>
          <p class="co-ids mono">
            <button type="button" class="idbtn" data-act="copy" data-v="${c.krs}" data-tip="Kopiuj">KRS ${c.krs}${icon('copy')}</button>
            <button type="button" class="idbtn" data-act="copy" data-v="${c.nip}" data-tip="Kopiuj">NIP ${c.nipF}${icon('copy')}</button>
            <button type="button" class="idbtn" data-act="copy" data-v="${c.regon}" data-tip="Kopiuj">REGON ${c.regon}${icon('copy')}</button>
          </p>
          <p class="co-meta">${esc(c.street)}, ${c.zip} ${esc(c.city)} · woj. ${esc(c.woj)} · w KRS od ${fmtDate(c.founded)} · kapitał ${c.form === 'sp. z o.o.' ? 'zakładowy' : 'akcyjny'} ${fmtMoney(c.capital, { full: true })}</p>
          <p class="co-meta">PKD ${c.sector.pkd} · ${esc(c.sector.name)} · VAT: <b>${o.vat}</b> (biała lista, ${o.accounts} ${plural(o.accounts, 'rachunek', 'rachunki', 'rachunków')})</p>
        </div>
        ${c.status !== 'aktywna' ? `<span class="stamp co-stamp" aria-label="Status: ${STATUS[c.status][1]}">${STATUS[c.status][1]}</span>` : ''}
        <div class="co-actions">
          <button type="button" class="btn ${watched ? 'btn--accent' : 'btn--ghost'}" data-act="watch" data-krs="${c.krs}" aria-pressed="${watched}">${icon(watched ? 'bell-on' : 'bell')}${watched ? 'Obserwujesz' : 'Obserwuj'}</button>
          <a class="btn btn--ghost" href="#/raport/${c.krs}">${icon('printer')}Raport PDF</a>
          <a class="btn btn--ghost" href="#/silnik/model?krs=${c.krs}">${icon('database')}Dane w bazie</a>
        </div>
      </header>
    </div>
    <nav class="subnav" aria-label="Sekcje">
      <div class="wrap subnav__in">${[['przeglad', 'Przegląd'], ['finanse', 'Finanse'], ['ryzyko', 'Ryzyko'], ['dokumenty', 'Dokumenty'], ['krs', 'KRS'], ['powiazania', 'Powiązania']].map(([id, l]) => `<a href="#/firma/${c.krs}/${id}" data-scrollto="${id}">${l}</a>`).join('')}</div>
    </nav>
    <div class="wrap co-body">
      ${f.list.length ? `
      <section id="przeglad" class="co-sec">${coOverview(c)}</section>
      <section id="finanse" class="co-sec"><div id="finCard">${coFinance(c)}</div></section>` : `<section id="przeglad" class="co-sec"><div class="empty card">${icon('file')}<p>Spółka nie złożyła jeszcze żadnego sprawozdania XML.</p></div></section>`}
      <section id="ryzyko" class="co-sec">${coRisk(c)}</section>
      <section id="dokumenty" class="co-sec">${coDocs(c)}</section>
      <section id="krs" class="co-sec">${coKrs(c)}</section>
      <section id="powiazania" class="co-sec">${coGraph(c)}</section>
      ${coSimilar(c)}
      <p class="co-src small muted">Odpis pełny pobrany ${fmtDateShort(o.fetched)} ${o.fetched.toTimeString().slice(0, 5)} (biuletyn KRS) · lista dokumentów RDF z ${fmtDateShort(o.fetched)} · biała lista VAT z ${fmtDateShort(o.fetched)}. Kanoniczny adres: <span class="mono">${seoUrl(c)}</span></p>
    </div>
  </div>`;
}

function kpiTile(label, v, prev, { good = 'up', spark = [], note = '' } = {}) {
  const d = v != null && prev != null && prev !== 0 ? (v - prev) / Math.abs(prev) : null;
  const dir = d == null ? '' : d >= 0 ? 'up' : 'down';
  const tone = d == null || good === 'none' ? 'flat' : (dir === good ? 'good' : 'bad');
  return `<div class="kpi card">
    <p class="mini-label">${label}</p>
    <p class="kpi-val${v < 0 ? ' is-neg' : ''}">${fmtMoney(v)}</p>
    <div class="kpi__foot">
      ${d != null ? `<span class="delta delta--${tone}">${icon(dir === 'up' ? 'trend' : 'trend-down')}${d >= 0 ? '+' : ''}${fmtPct(d, 0)} r/r</span>` : `<span class="delta delta--flat">${note || '—'}</span>`}
      ${sparkline(spark, { neg: v < 0 })}
    </div>
  </div>`;
}

function coOverview(c) {
  const f = fin(c), m = metrics(c);
  const fy = f.list[f.list.length - 1], cur = m[fy], prev = m[fy - 1] || {};
  const series = k => f.list.map(y => m[y][k]);
  const ai = aiSummary(c);
  return `
    <div class="sec-head"><h2 class="h2">Przegląd · ${fy}</h2><p class="muted small">${f.y[LAST_FY] ? `Ostatnie sprawozdanie: za ${fy}, złożone ${fmtDateShort(f.y[fy].filed)}` : `<b class="t-warn">Brak sprawozdania za ${LAST_FY}</b> · ostatnie za ${fy}`} · ${ENTITY[f.y[fy].type].label}${f.y[fy].type !== 'Mikro' ? `, RZiS ${VARIANT[f.y[fy].variant]}` : ''}</p></div>
    <div class="kpis">
      ${kpiTile('Przychody', cur.rev, prev.rev, { spark: series('rev') })}
      ${kpiTile('Zysk netto', cur.net, prev.net, { spark: series('net') })}
      ${kpiTile(cur.ebitda != null ? 'EBITDA' : cur.ebitEst ? 'EBIT (szacunek)' : 'EBIT', cur.ebitda != null ? cur.ebitda : cur.ebit, cur.ebitda != null ? prev.ebitda : prev.ebit, { spark: series(cur.ebitda != null ? 'ebitda' : 'ebit') })}
      ${kpiTile('Aktywa razem', cur.assets, prev.assets, { good: 'none', spark: series('assets') })}
      ${kpiTile('Kapitał własny', cur.equity, prev.equity, { spark: series('equity') })}
      ${kpiTile('Zobowiązania i rezerwy', cur.liab, prev.liab, { good: 'down', spark: series('liab') })}
    </div>
    <div class="ov-grid">
      <div class="card chart-card" id="coChart">${coChart(c)}</div>
      <aside class="card ai">
        <p class="ai__tag">${icon('sparkle')}Streszczenie LLM</p>
        <h3 class="h4">${esc(ai.title)}</h3>
        <ul>${ai.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
        ${ai.opinion ? `<p class="ai__op"><b>Biegły rewident:</b> ${ai.opinion}</p>` : ''}
        <p class="ai__src small muted">Źródło: ${ai.source}. Tekst wygenerowany automatycznie, sprawdź w oryginale.</p>
      </aside>
    </div>`;
}

function coChart(c) {
  const f = fin(c), m = metrics(c);
  const met = CO_METRICS.find(x => x[0] === CO.metric) || CO_METRICS[0];
  const data = f.list.map(fy => {
    const mm = m[fy], v = mm[met[0]];
    const est = fy === 2017 || (met[0] === 'ebit' && mm.ebitEst) || (met[0] === 'cash' && f.y[fy].v['BS.B.III.CASH'] == null);
    const p = m[fy - 1] && m[fy - 1][met[0]];
    return { x: fy, v, est, tip: `<b>${fy}</b><br>${met[1]}: ${fmtMoney(v)}${p != null && v != null && p !== 0 ? `<br>r/r ${(v - p) / Math.abs(p) >= 0 ? '+' : ''}${fmtPct((v - p) / Math.abs(p), 1)}` : ''}<br><span class="tip-muted">${esc(provenance(c, fy))}${met[0] === 'ebit' && mm.ebitEst ? '<br>mikro nie raportuje EBIT: przychody − koszty' : ''}${met[0] === 'cash' && f.y[fy].v['BS.B.III.CASH'] == null ? '<br>bez osobnej linii gotówki: inwestycje krótkoterminowe' : ''}</span>` };
  });
  const missing = met[0] === 'cfo' && data.every(d => d.v == null);
  return `<div class="chart-card__head">
      <h3 class="h4">${met[1]} ${f.list[0]}–${f.list[f.list.length - 1]}</h3>
      <div class="seg" role="group" aria-label="Metryka">${CO_METRICS.map(([k, l]) => `<button type="button" class="seg__b${k === met[0] ? ' is-on' : ''}" data-act="co-metric" data-k="${k}" aria-pressed="${k === met[0]}">${l}</button>`).join('')}</div>
    </div>
    ${missing ? `<div class="empty">${icon('info')}<p>Spółka nie sporządza rachunku przepływów pieniężnych (${ENTITY[fin(c).y[f.list[f.list.length - 1]].type].label}).</p></div>` : columnChart(data, { label: met[1] })}
    <p class="small muted chart-card__note">${f.list.includes(2017) ? '<span class="key key--est"></span> kreskowane: dane z kolumny „rok poprzedni” albo szacunek · ' : ''}najedź na słupek, żeby zobaczyć plik źródłowy</p>`;
}
ACTIONS['co-metric'] = el => { CO.metric = el.dataset.k; saveCo(); $('#coChart').innerHTML = coChart(CUR); };

function aiSummary(c) {
  const f = fin(c), m = metrics(c), h = hashStr(c.krs);
  const fy = f.list[f.list.length - 1], cur = m[fy], prev = m[fy - 1];
  const y = f.y[fy];
  const dzDoc = documents(c).find(d => d.fy === fy && d.kind === 'dz');
  const hasDz = !!dzDoc && dzDoc.pipe === 'llm';
  const s = c.sector;
  const b = [];
  if (prev) {
    const g = cur.growth;
    const why = c.distress ? ['utratę części kontraktów', 'spadek portfela zamówień', 'opóźnienia w płatnościach od kontrahentów'][h % 3] : s.drivers[h % s.drivers.length];
    b.push(`Przychody ${g >= 0 ? 'wzrosły' : 'spadły'} o ${fmtPct(Math.abs(g), 0)} do ${fmtMoney(cur.rev)}${hasDz ? `; zarząd wskazuje na ${why}` : ''}.`);
  } else b.push(`Pierwszy rok działalności: przychody ${fmtMoney(cur.rev)}.`);
  b.push(`Marża netto ${fmtPct(cur.mNet)}${prev && prev.mNet != null ? ` (rok wcześniej ${fmtPct(prev.mNet)})` : ''}; ${cur.net >= 0 ? 'zysk' : 'strata'} netto ${fmtMoney(Math.abs(cur.net))}.`);
  b.push(cur.equity < 0 ? `Kapitał własny ujemny (${fmtMoney(cur.equity)}); zobowiązania przewyższają majątek.` : `Kapitał własny ${fmtMoney(cur.equity)}, zobowiązania to ${Math.round(cur.debt * 100)}% sumy bilansowej.`);
  const prevY = f.y[fy - 1];
  if (prevY && prevY.divDeclared > 0) b.push(`Z zysku za ${fy - 1} wypłacono ${fmtMoney(prevY.divDeclared)} dywidendy (uchwała z ${fmtDateShort(prevY.approved)}).`);
  if (hasDz) b.push(`Ryzyka wskazane przez zarząd: ${s.risks.join(', ')}.`);
  return {
    title: hasDz ? `Sprawozdanie z działalności za ${fy}` : `Najważniejsze liczby za ${fy}`,
    bullets: b,
    opinion: y.opinion ? OPINION[y.opinion] + '.' : null,
    source: hasDz ? `sprawozdanie_z_dzialalnosci_${fy}.pdf${y.opinion ? ` i sprawozdanie_z_badania_${fy}.pdf` : ''}` : `${sfDoc(c, fy).file} (${dzDoc ? 'sprawozdanie z działalności to skan, czeka na OCR' : 'spółka nie składa sprawozdania z działalności'})`,
  };
}

// ---------- statements table ----------
function unitFor(c) {
  if (CO.unit !== 'auto') return CO.unit;
  const f = fin(c), mx = Math.max(...f.list.map(fy => Math.abs(f.y[fy].v['BS.TOT'] || 0)));
  return mx >= 2e8 ? 'mln' : mx >= 2e6 ? 'tys' : 'zl';
}
const UNIT_LABEL = { zl: 'zł', tys: 'tys. zł', mln: 'mln zł' };
// accounting convention: negatives in parentheses
function fmtCell(v, unit) {
  if (v == null) return '—';
  const x = unit === 'mln' ? v / 1e6 : unit === 'tys' ? v / 1e3 : v;
  const s = Math.abs(x).toLocaleString('pl-PL', { minimumFractionDigits: unit === 'mln' ? 2 : 0, maximumFractionDigits: unit === 'mln' ? 2 : 0 });
  return x < 0 && s !== '0' && s !== '0,00' ? `(${s})` : s;
}
function ratioRows(c) {
  const f = fin(c), m = metrics(c);
  return [
    ['Marża EBIT', fy => fmtPct(m[fy].mEbit), 'EBIT / przychody'],
    ['Marża netto', fy => fmtPct(m[fy].mNet), 'zysk netto / przychody'],
    ['ROE', fy => fmtPct(m[fy].roe), 'zysk netto / kapitał własny'],
    ['ROA', fy => fmtPct(m[fy].net / m[fy].assets), 'zysk netto / aktywa'],
    ['Zadłużenie ogólne', fy => fmtPct(m[fy].debt, 0), 'zobowiązania i rezerwy / aktywa'],
    ['Płynność bieżąca', fy => fmtRatio(m[fy].cur), 'aktywa obrotowe / zobowiązania krótkoterminowe'],
    ['Rotacja należności (dni)', fy => { const v = f.y[fy].v; return v['BS.B.II'] != null && v['PL.REV'] ? num(Math.round(v['BS.B.II'] / v['PL.REV'] * 365)) : '—'; }, 'należności krótkoterminowe / przychody × 365'],
    ['Wzrost przychodów', fy => m[fy].growth == null ? '—' : (m[fy].growth > 0 ? '+' : '') + fmtPct(m[fy].growth, 0), 'r/r'],
  ];
}

function coFinance(c) {
  const f = fin(c), years = f.list, unit = unitFor(c);
  const tab = CO.tab;
  const tabs = [['bilans', 'Bilans'], ['rzis', 'Rachunek zysków i strat'], ['cf', 'Przepływy i kapitał'], ['wsk', 'Wskaźniki']];
  const variants = [...new Set(years.map(fy => f.y[fy].variant))];
  const types = [...new Set(years.map(fy => f.y[fy].type))];
  const head = `<tr><th scope="col" class="t-label">Pozycja</th>${CO.codes && tab !== 'wsk' ? '<th scope="col" class="t-code">Kod</th>' : ''}${years.map(fy => {
    const y = f.y[fy];
    const tip = `<b>${fy}</b><br>${esc(provenance(c, fy))}<br>${ENTITY[y.type].root}${y.type !== 'Mikro' ? ' · RZiS ' + VARIANT[y.variant] : ''} · kwoty w ${y.unit === 'tys' ? 'tys. zł' : 'zł'}<br>złożono ${fmtDateShort(y.filed)}${y.late ? ' (po terminie)' : ''}`;
    return `<th scope="col" class="t-num" data-tip="${esc(tip)}">${fy}<span class="t-sub">${fy === 2017 ? 'KwotaB' : ENTITY[y.type].short}${y.korekta ? ' · kor.' : ''}</span></th>`;
  }).join('')}${tab !== 'wsk' ? '<th scope="col" class="t-num t-yoy">r/r</th>' : ''}</tr>`;
  let body = '';
  if (tab === 'wsk') {
    body = ratioRows(c).map(([l, fn, hint]) => `<tr><th scope="row" class="t-label" data-tip="${esc(hint)}">${l}</th>${years.map(fy => `<td class="t-num">${fn(fy)}</td>`).join('')}</tr>`).join('');
  } else {
    for (const [title, codes] of STATEMENTS[tab]) {
      const rows = codes.filter(code => years.some(fy => f.y[fy].v[code] != null && (f.y[fy].v[code] !== 0 || CODE[code].tot)));
      if (!rows.length) continue;
      body += `<tr class="t-group"><th scope="rowgroup" colspan="${years.length + (CO.codes ? 3 : 2)}">${title}</th></tr>`;
      body += rows.map(code => {
        const def = CODE[code];
        const cells = years.map(fy => {
          const y = f.y[fy], v = y.v[code];
          const orig = y.orig && y.orig[code] != null ? y.orig[code] : null;
          const tipNa = v == null ? `Pozycja nie występuje w ${y.type === 'Mikro' ? 'schemacie JednostkaMikro' : y.type === 'Mala' && code === 'BS.B.III.CASH' ? 'bilansie jednostki małej' : `wariancie ${VARIANT[y.variant]}m`} (${fy})` : '';
          return `<td class="t-num${v < 0 ? ' is-neg' : ''}${orig != null ? ' is-kor' : ''}${fy === 2017 ? ' is-est' : ''}"${tipNa ? ` data-tip="${esc(tipNa)}"` : orig != null ? ` data-tip="${esc(`Przed korektą: ${fmtCell(orig, unit)} ${UNIT_LABEL[unit]}`)}"` : ''}>${fmtCell(v, unit)}</td>`;
        }).join('');
        const a = f.y[years[years.length - 1]].v[code], p = years.length > 1 ? f.y[years[years.length - 2]].v[code] : null;
        const yoy = a != null && p ? (a - p) / Math.abs(p) : null;
        return `<tr class="lvl${def.lvl}${def.tot ? ' t-tot' : ''}"><th scope="row" class="t-label">${esc(def.label)}</th>${CO.codes ? `<td class="t-code mono">${code}</td>` : ''}${cells}<td class="t-num t-yoy${yoy != null ? (yoy >= 0 ? ' up' : ' down') : ''}">${yoy == null ? '' : (yoy >= 0 ? '+' : '') + fmtPct(yoy, 0)}</td></tr>`;
      }).join('');
    }
    if (!body) body = `<tr><td colspan="${years.length + 2}" class="t-empty">${tab === 'cf' ? 'Spółka nie sporządza rachunku przepływów ani zestawienia zmian w kapitale (jednostka mała lub mikro).' : 'Brak danych.'}</td></tr>`;
  }
  const notes = [];
  if (years.includes(2017)) notes.push(`Kolumna 2017 pochodzi z pozycji KwotaB sprawozdania za 2018 (XML-e w RDF są od 2018, plik za 2017 to skan).`);
  if (variants.filter(v => v !== 'mikro').length > 1) { const sw = years.find((fy, i) => i && f.y[fy].variant !== f.y[years[i - 1]].variant); notes.push(`Od ${sw} rachunek zysków i strat jest w wariancie ${VARIANT[f.y[sw].variant]}m (wcześniej ${VARIANT[f.y[years[years.indexOf(sw) - 1]].variant]}). Koszty rodzajowe są tylko w wariancie porównawczym; wspólne kody, np. PL.REV, PL.EBIT i PL.NET, są porównywalne przez cały okres.`); }
  if (types.length > 1) notes.push(`Typ jednostki zmieniał się: ${years.filter((fy, i) => !i || f.y[fy].type !== f.y[years[i - 1]].type).map(fy => `${fy} ${ENTITY[f.y[fy].type].short}`).join(' → ')}. Każdy schemat mapujemy na ten sam słownik kodów.`);
  if (f.korektaFY && f.y[f.korektaFY]) notes.push(`Za ${f.korektaFY} złożono korektę (${fmtDateShort(f.y[f.korektaFY].korekta)}). Pokazujemy wersję po korekcie; komórki z kropką mają podpowiedź z wartością sprzed korekty.`);
  if (types.includes('Mikro')) notes.push('Jednostka mikro nie raportuje EBIT ani wyniku finansowego osobno: przychody i koszty finansowe są w „pozostałych”.');
  return `
    <div class="sec-head"><h2 class="h2">Finanse</h2>
      <div class="fin-tools">
        <label class="sel"><span>Jednostka</span><select data-change="co-unit">${[['auto', 'automatycznie'], ['zl', 'zł'], ['tys', 'tys. zł'], ['mln', 'mln zł']].map(([k, l]) => `<option value="${k}"${CO.unit === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" data-change="co-codes"${CO.codes ? ' checked' : ''}> kody kanoniczne</label>
        <button type="button" class="btn btn--ghost btn--sm" data-act="co-csv">${icon('download')}CSV</button>
      </div>
    </div>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" class="tab${k === tab ? ' is-on' : ''}" aria-selected="${k === tab}" data-act="co-tab" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="card table-card">
      <p class="table-unit small muted">${tab === 'wsk' ? 'Wskaźniki liczone z tabeli metryki_roczne' : `Kwoty w ${UNIT_LABEL[unit]}`}</p>
      <div class="table-scroll" tabindex="0"><table class="fin">${'<thead>' + head + '</thead><tbody>' + body + '</tbody>'}</table></div>
    </div>
    ${notes.length ? `<ul class="notes small">${notes.map(n => `<li>${icon('info')}${n}</li>`).join('')}</ul>` : ''}`;
}
ACTIONS['co-tab'] = el => { CO.tab = el.dataset.k; saveCo(); $('#finCard').innerHTML = coFinance(CUR); };
CHANGES['co-unit'] = el => { CO.unit = el.value; saveCo(); $('#finCard').innerHTML = coFinance(CUR); };
CHANGES['co-codes'] = el => { CO.codes = el.checked; saveCo(); $('#finCard').innerHTML = coFinance(CUR); };
ACTIONS['co-csv'] = () => {
  const c = CUR, f = fin(c);
  const lines = [['kod', 'pozycja', ...f.list].join(';')];
  for (const k of ['bilans', 'rzis', 'cf']) for (const [, codes] of STATEMENTS[k]) for (const code of codes) {
    if (!f.list.some(fy => f.y[fy].v[code] != null)) continue;
    lines.push([code, CODE[code].label, ...f.list.map(fy => f.y[fy].v[code] == null ? '' : f.y[fy].v[code])].join(';'));
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = `rocznik_${c.krs}_${c.slug}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Plik CSV gotowy (kwoty w zł)');
};

// ---------- risk ----------
function coRisk(c) {
  const r = risk(c), f = fin(c), o = odpis(c);
  const l = LEVEL[r.level];
  const SEV = { high: ['crit', 'octagon', 'wysokie'], mid: ['warn', 'alert', 'średnie'], low: ['info', 'info', 'niskie'] };
  const rows = FYS.filter(fy => fy >= Math.max(2018, f.startFY)).map(fy => {
    const y = f.y[fy], wz = o.wzmianki.find(w => w.fy === fy), d = y && sfDoc(c, fy);
    const lag = y && y.wzmianka ? Math.round((y.wzmianka - y.filed) / DAY) : null;
    return `<tr>
      <th scope="row">${fy}</th>
      <td>${wz ? fmtDateShort(wz.wzmianka) : y ? '<span class="t-warn">jeszcze brak</span>' : '—'}</td>
      <td>${y ? fmtDateShort(y.filed) + (y.late ? ' <span class="pill pill--warn pill--xs">po terminie</span>' : '') : fy === LAST_FY && !y ? `<span class="t-crit">brak</span> <span class="small muted">· sweep co tydzień</span>` : '—'}</td>
      <td class="t-num">${lag != null ? lag + ' dni' : y ? 'RDF przed KRS' : ''}</td>
      <td class="mono small">${d ? d.file : '—'}</td>
      <td>${d ? '<span class="pill pill--ok pill--xs">XML sparsowany</span>' : ''}</td>
    </tr>`;
  }).join('');
  return `
    <div class="sec-head"><h2 class="h2">Ryzyko</h2><p class="muted small">Sygnały z działów 4 i 6 KRS, białej listy VAT i liczb ze sprawozdań. To nie jest ocena kredytowa.</p></div>
    <div class="risk-grid">
      <div class="card risk-score">
        <p class="mini-label">Poziom ryzyka</p>
        <p class="risk-score__v"><span class="pill pill--${l[0]} pill--lg">${icon(l[1])}${r.level}</span></p>
        <div class="meter meter--${l[0]}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.score}" aria-label="Wynik ryzyka"><span style="width:${Math.max(3, r.score)}%"></span></div>
        <p class="small muted">${r.score} / 100 pkt · ${r.sig.length} ${plural(r.sig.length, 'sygnał', 'sygnały', 'sygnałów')}</p>
        ${r.ok.length ? `<ul class="oklist">${r.ok.map(t => `<li>${icon('check')}${esc(t)}</li>`).join('')}</ul>` : ''}
      </div>
      <div class="card signals">
        ${r.sig.length ? `<ul>${r.sig.map(s => `<li class="sig sig--${SEV[s.sev][0]}">
          <span class="sig__i">${icon(SEV[s.sev][1])}</span>
          <div><p class="sig__t">${esc(s.title)} <span class="sig__lvl">${SEV[s.sev][2]}</span></p><p class="sig__d">${esc(s.detail)}</p><p class="sig__src small muted">${esc(s.src)} · ${fmtDateShort(s.date)}</p></div>
        </li>`).join('')}</ul>` : `<div class="empty">${icon('shield')}<p>Brak sygnałów ostrzegawczych w rejestrze i w sprawozdaniach.</p></div>`}
      </div>
    </div>
    <div class="card table-card">
      <h3 class="h4">Lista kontrolna sprawozdań: wzmianka w KRS a dokument w RDF</h3>
      <p class="small muted">Wzmianka w dziale 3 mówi, czego szukać w RDF. Pojawia się z opóźnieniem, dlatego w sezonie sprawdzamy RDF także bez niej.</p>
      <div class="table-scroll"><table class="plain"><thead><tr><th scope="col">Rok</th><th scope="col">Wzmianka w KRS</th><th scope="col">Złożone w RDF</th><th scope="col" class="t-num">Opóźnienie wzmianki</th><th scope="col">Plik</th><th scope="col">Parser</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
}

// ---------- documents ----------
const PIPE = {
  xml: ['ok', 'XML → pozycje'], replaced: ['muted', 'zastąpiony korektą'], text: ['info', 'PDF → tekst'], llm: ['info', 'PDF → LLM'], ocr: ['warn', 'skan → kolejka OCR'], skip: ['muted', 'pominięty (przed 2018)'],
};
function coDocs(c) {
  const f = fin(c), docs = documents(c);
  const divRows = f.list.filter(fy => fy >= 2018 && f.y[fy].v['PL.NET'] > 0);
  const byFy = {};
  docs.forEach(d => (byFy[d.fy] = byFy[d.fy] || []).push(d));
  return `
    <div class="sec-head"><h2 class="h2">Dokumenty</h2><p class="muted small">${docs.length} ${plural(docs.length, 'dokument', 'dokumenty', 'dokumentów')} w RDF · ${docs.filter(d => d.pipe === 'xml').length} XML sparsowanych · ${docs.filter(d => d.pipe === 'ocr').length} w kolejce OCR</p></div>
    ${divRows.length ? `<div class="card table-card">
      <h3 class="h4">Podział zysku (z uchwał, ekstrakcja LLM)</h3>
      <div class="table-scroll"><table class="plain"><thead><tr><th scope="col">Za rok</th><th scope="col" class="t-num">Zysk netto</th><th scope="col" class="t-num">Dywidenda</th><th scope="col" class="t-num">Na kapitał zapasowy</th><th scope="col">Uchwała</th></tr></thead>
      <tbody>${divRows.slice().reverse().map(fy => { const y = f.y[fy]; return `<tr><th scope="row">${fy}</th><td class="t-num">${fmtMoney(y.v['PL.NET'])}</td><td class="t-num">${y.divDeclared ? fmtMoney(y.divDeclared) : '—'}</td><td class="t-num">${fmtMoney(y.v['PL.NET'] - y.divDeclared)}</td><td>${fmtDateShort(y.approved)}</td></tr>`; }).join('')}</tbody></table></div>
    </div>` : ''}
    <div class="docs">
      ${Object.keys(byFy).sort((a, b) => b - a).map(fy => `<div class="docs__year">
        <h3 class="docs__fy">${fy}</h3>
        <ul>${byFy[fy].map(d => `<li class="doc${d.pipe === 'replaced' ? ' doc--old' : ''}">
          ${icon(d.format === 'XML' ? 'file-code' : d.pipe === 'ocr' ? 'scan' : 'file-text', 'i doc__i')}
          <div class="doc__main"><p class="doc__name">${esc(d.name)}${d.korekta ? ' <span class="pill pill--warn pill--xs">korekta</span>' : ''}</p>
          <p class="doc__meta small"><span class="mono">${esc(d.file)}</span> · ${d.format} · ${kbytes(d.size)} · złożono ${fmtDateShort(d.filed)}</p></div>
          <span class="pill pill--${PIPE[d.pipe][0]} pill--xs">${PIPE[d.pipe][1]}</span>
          ${d.format === 'XML' ? `<a class="btn btn--ghost btn--sm" href="#/silnik/parser?krs=${c.krs}&fy=${d.fy}${d.pipe === 'replaced' ? '&orig=1' : ''}">Otwórz w parserze</a>` : d.pipe === 'llm' || d.pipe === 'text' ? `<button type="button" class="btn btn--ghost btn--sm" data-act="doc-llm" data-id="${d.id}">Co z niego wyciągnęliśmy</button>` : '<span class="doc__pad"></span>'}
        </li>`).join('')}</ul>
      </div>`).join('')}
    </div>`;
}
ACTIONS['doc-llm'] = el => {
  const c = CUR, d = documents(c).find(x => x.id === el.dataset.id), y = fin(c).y[d.fy];
  let body = '';
  if (d.kind === 'up') body = `<dl class="kv"><dt>Rodzaj</dt><dd>${esc(d.name)}</dd><dt>Data uchwały</dt><dd>${fmtDateShort(y.approved)}</dd><dt>${y.v['PL.NET'] >= 0 ? 'Zysk' : 'Strata'} netto</dt><dd>${fmtMoney(Math.abs(y.v['PL.NET']), { full: true })}</dd>${y.v['PL.NET'] >= 0 ? `<dt>Dywidenda</dt><dd>${y.divDeclared ? fmtMoney(y.divDeclared, { full: true }) : 'nie wypłacono'}</dd><dt>Kapitał zapasowy</dt><dd>${fmtMoney(y.v['PL.NET'] - y.divDeclared, { full: true })}</dd>` : '<dt>Pokrycie</dt><dd>z zysków lat przyszłych</dd>'}</dl><p class="small muted">Pola wyciągnięte przez LLM ze zdania „Zgromadzenie Wspólników postanawia…”; kwoty porównane z PL.NET ze sprawozdania XML.</p>`;
  else if (d.kind === 'bad') body = `<dl class="kv"><dt>Opinia</dt><dd>${OPINION[y.opinion]}</dd><dt>Badany okres</dt><dd>${d.from} – ${d.to}</dd></dl><p class="small muted">Klasyfikacja opinii przez LLM na podstawie sekcji „Opinia” i „Podstawa opinii”.</p>`;
  else if (d.kind === 'uz') body = `<dl class="kv"><dt>Zatwierdzono</dt><dd>${fmtDateShort(y.approved)}</dd><dt>Suma bilansowa w uchwale</dt><dd>${fmtMoney(y.v['BS.TOT'], { full: true })}</dd><dt>Zgodność z XML</dt><dd>${icon('check')} zgodna</dd></dl><p class="small muted">Tekst z warstwy tekstowej PDF, bez LLM: kwota i data z wyrażeń regularnych.</p>`;
  else body = `<ul class="ai-list">${aiSummary(c).bullets.map(b => `<li>${b}</li>`).join('')}</ul><p class="small muted">Streszczenie LLM z PDF (${kbytes(d.size)}), sprawdź w oryginale.</p>`;
  openModal(`<p class="mini-label">${d.fy} · ${esc(d.file)}</p><h2 class="h3">${esc(d.name)}</h2>${body}<p class="mono small muted">blob sha256:${d.sha.slice(0, 16)}…</p>`, { label: d.name });
};

// ---------- KRS extract ----------
function coKrs(c) {
  const o = odpis(c), f = fin(c);
  const ownerRow = w => w.krs ? `<tr><td><a href="${coUrl(BY_KRS.get(w.krs))}">${esc(BY_KRS.get(w.krs).krsName)}</a><span class="small muted mono"> KRS ${w.krs}</span></td><td class="t-num">${w.sole ? 'jedyny' : num(w.udzialy)}</td><td class="t-num">${w.sole ? '—' : fmtMoney(w.wartosc, { full: true })}</td><td class="t-num">${Math.round(w.share * 100)}%</td></tr>`
    : `<tr><td><span class="masked mono">${w.full}</span></td><td class="t-num">${num(w.udzialy)}</td><td class="t-num">${fmtMoney(w.wartosc, { full: true })}</td><td class="t-num">${Math.round(w.share * 100)}%</td></tr>`;
  return `
    <div class="sec-head"><h2 class="h2">Dane z KRS</h2><button type="button" class="btn btn--ghost btn--sm" data-act="krs-json">${icon('file-code')}Odpis jako JSON</button></div>
    <p class="mask-note small">${icon('lock')}Otwarte API KRS maskuje imiona, nazwiska i PESEL osób fizycznych. Pokazujemy dokładnie to, co zwraca.</p>
    <div class="krs-grid">
      <div class="card dz"><h3 class="dz__h"><span>Dział 1</span>Dane podmiotu</h3>
        <dl class="kv kv--krs"><dt>Nazwa</dt><dd>${esc(c.krsName)}</dd><dt>Forma prawna</dt><dd>${FORMS[c.form]}</dd><dt>Siedziba</dt><dd>woj. ${upperPl(c.woj)}, ${upperPl(c.city)}</dd><dt>Adres</dt><dd>UL. ${upperPl(c.street)}, ${c.zip} ${upperPl(c.city)}</dd><dt>Data wpisu</dt><dd>${fmtDateShort(c.founded)}</dd><dt>Kapitał</dt><dd>${fmtMoney(c.capital, { full: true })}</dd><dt>NIP / REGON</dt><dd class="mono">${c.nip} / ${c.regon}</dd></dl>
        ${o.owners.length ? `<h4 class="h5">${c.form === 'sp. z o.o.' ? 'Wspólnicy' : 'Jedyny akcjonariusz'}</h4><div class="table-scroll"><table class="plain plain--sm"><thead><tr><th scope="col">Wspólnik</th><th scope="col" class="t-num">Udziały</th><th scope="col" class="t-num">Wartość</th><th scope="col" class="t-num">%</th></tr></thead><tbody>${o.owners.map(ownerRow).join('')}</tbody></table></div>` : `<p class="small muted">Akcjonariusze spółki akcyjnej nie są ujawniani w KRS.</p>`}
      </div>
      <div class="card dz"><h3 class="dz__h"><span>Dział 2</span>Reprezentacja</h3>
        <dl class="kv kv--krs"><dt>Organ</dt><dd>ZARZĄD</dd><dt>Sposób reprezentacji</dt><dd>${o.repr}</dd></dl>
        <h4 class="h5">Skład zarządu</h4><ul class="people">${o.board.map(p => `<li><span class="masked mono">${p.full}</span><span class="small">${p.fn}</span></li>`).join('')}</ul>
        ${o.prokura.length ? `<h4 class="h5">Prokurenci</h4><ul class="people">${o.prokura.map(p => `<li><span class="masked mono">${p.full}</span><span class="small">${p.kind}</span></li>`).join('')}</ul>` : ''}
        ${o.rn.length ? `<h4 class="h5">Rada nadzorcza</h4><ul class="people">${o.rn.map(p => `<li><span class="masked mono">${p.full}</span><span class="small">${p.fn}</span></li>`).join('')}</ul>` : ''}
      </div>
      <div class="card dz"><h3 class="dz__h"><span>Dział 3</span>Przedmiot działalności i wzmianki</h3>
        <p class="h5">Działalność przeważająca</p><p class="pkd"><span class="mono">${c.sector.pkd}</span> ${upperPl(c.sector.name)}</p>
        ${o.pkdOther.length ? `<p class="h5">Pozostała działalność</p><ul class="pkds">${o.pkdOther.map(k => `<li><span class="mono">${k}</span> ${upperPl(PKD_NAME(k))}</li>`).join('')}</ul>` : ''}
        <p class="h5">Wzmianki o złożonych dokumentach</p>
        <ul class="wz">${o.wzmianki.slice().reverse().map(w => `<li><span class="mono">${w.fy}</span> ${w.docs.map(d => ({ sprawozdanie: 'sprawozdanie', uchwała: 'uchwała', badanie: 'badanie', działalność: 'sprawozdanie z działalności' })[d]).join(' · ')} <span class="small muted">· wzmianka ${fmtDateShort(w.wzmianka)}</span></li>`).join('')}${!f.y[LAST_FY] ? `<li class="t-crit"><span class="mono">${LAST_FY}</span> brak wzmianki</li>` : !fin(c).y[LAST_FY].wzmianka ? `<li class="t-warn"><span class="mono">${LAST_FY}</span> jest w RDF, wzmianki jeszcze brak</li>` : ''}</ul>
      </div>
      <div class="card dz dz--small"><h3 class="dz__h"><span>Dział 4</span>Zaległości i wierzytelności</h3>
        ${o.dz4.length ? `<ul class="dzlist">${o.dz4.map(z => `<li class="t-crit">${icon('octagon')}ZALEGŁOŚCI · organ: ${z.organ} · wpis ${fmtDateShort(z.date)}</li>`).join('')}</ul>` : '<p class="muted small">Brak wpisów</p>'}
        <h3 class="dz__h"><span>Dział 5</span>Kurator</h3><p class="muted small">Brak wpisów</p>
        <h3 class="dz__h"><span>Dział 6</span>Likwidacja, upadłość, restrukturyzacja</h3>
        ${o.dz6.likw ? `<p class="t-crit">${icon('octagon')}OTWARCIE LIKWIDACJI · ${fmtDateShort(o.dz6.likw.date)} · likwidator <span class="masked mono">${o.dz6.likw.likwidator.full}</span></p>` : ''}
        ${o.dz6.upad ? `<p class="t-crit">${icon('octagon')}OGŁOSZENIE UPADŁOŚCI · ${fmtDateShort(o.dz6.upad.date)} · sygn. ${o.dz6.upad.sygn}</p>` : ''}
        ${o.dz6.restr ? `<p class="t-crit">${icon('octagon')}${o.dz6.restr.kind} · ${fmtDateShort(o.dz6.restr.date)} · nadzorca <span class="masked mono">${o.dz6.restr.nadzorca.full}</span></p>` : ''}
        ${!Object.keys(o.dz6).length ? '<p class="muted small">Brak wpisów</p>' : ''}
      </div>
    </div>
    <details class="card wpisy"><summary><h3 class="h4">Historia wpisów (${o.wpisy.length})</h3></summary>
      <div class="table-scroll"><table class="plain plain--sm"><thead><tr><th scope="col">Nr</th><th scope="col">Data</th><th scope="col">Sygnatura</th><th scope="col">Opis</th></tr></thead>
      <tbody>${o.wpisy.slice().reverse().map(w => `<tr><td class="t-num">${w.nr}</td><td>${fmtDateShort(w.date)}</td><td class="mono small">${w.sygn}</td><td>${esc(w.opis)}</td></tr>`).join('')}</tbody></table></div>
    </details>`;
}

function odpisJson(c) {
  const o = odpis(c), f = fin(c), last = o.wpisy[o.wpisy.length - 1];
  const person = p => ({ nazwisko: { nazwiskoICzlon: p.nazwisko }, imiona: { imie: p.imie }, identyfikator: { pesel: `${(hashStr(p.full) % 9) + 1}**********` } });
  return {
    odpis: {
      rodzaj: 'Pełny',
      naglowekP: { rejestr: 'RejP', numerKRS: c.krs, dataCzasOdpisu: `${fmtDateShort(o.fetched)} ${o.fetched.toTimeString().slice(0, 8)}`, stanZDnia: fmtDateShort(YESTERDAY), dataRejestracjiWKRS: fmtDateShort(c.founded), numerOstatniegoWpisu: last.nr, dataOstatniegoWpisu: fmtDateShort(last.date), sygnaturaAktSprawyDotyczacejOstatniegoWpisu: last.sygn },
      dane: {
        dzial1: {
          danePodmiotu: { formaPrawna: FORMS[c.form], identyfikatory: { regon: c.regon, nip: c.nip }, nazwa: c.krsName },
          siedzibaIAdres: { siedziba: { kraj: 'POLSKA', wojewodztwo: upperPl(c.woj), miejscowosc: upperPl(c.city) }, adres: { ulica: 'UL. ' + upperPl(c.street.replace(/ \S+$/, '')), nrDomu: c.street.split(' ').pop(), kodPocztowy: c.zip, miejscowosc: upperPl(c.city), kraj: 'POLSKA' } },
          kapital: { wysokoscKapitaluZakladowego: { wartosc: c.capital.toFixed(2).replace('.', ','), waluta: 'PLN' } },
          wspolnicySpzoo: o.owners.filter(w => !w.sole).map(w => w.krs ? { nazwa: BY_KRS.get(w.krs).krsName, identyfikator: { regon: BY_KRS.get(w.krs).regon }, posiadaneUdzialy: `${w.udzialy} UDZIAŁÓW O ŁĄCZNEJ WARTOŚCI ${w.wartosc} ZŁ` } : { ...person(w), posiadaneUdzialy: `${w.udzialy} UDZIAŁÓW O ŁĄCZNEJ WARTOŚCI ${w.wartosc} ZŁ` }),
        },
        dzial2: { reprezentacja: { nazwaOrganu: 'ZARZĄD', sposobReprezentacji: o.repr, sklad: o.board.map(p => ({ ...person(p), funkcjaWOrganie: p.fn, czyZawieszona: false })) }, prokurenci: o.prokura.map(p => ({ ...person(p), rodzajProkury: p.kind })) },
        dzial3: {
          przedmiotDzialalnosci: { przedmiotPrzewazajacejDzialalnosci: [{ opis: upperPl(c.sector.name), kodDzial: c.sector.pkd.slice(0, 2), kodKlasa: c.sector.pkd.slice(3, 5), kodPodklasa: c.sector.pkd.slice(6) }], przedmiotPozostalejDzialalnosci: o.pkdOther.map(k => ({ opis: upperPl(PKD_NAME(k)), kodDzial: k.slice(0, 2), kodKlasa: k.slice(3, 5), kodPodklasa: k.slice(6) })) },
          wzmiankiOZlozonychDokumentach: { wzmiankaOZlozeniuRocznegoSprawozdaniaFinansowego: o.wzmianki.map(w => ({ dataZlozenia: fmtDateShort(w.wzmianka), zaOkresOdDo: `01.01.${w.fy} - 31.12.${w.fy}` })) },
        },
        dzial4: o.dz4.length ? { zaleglosci: o.dz4.map(z => ({ nazwaOrganu: z.organ, dataWpisu: fmtDateShort(z.date) })) } : {},
        dzial5: {},
        dzial6: o.dz6.likw ? { likwidacja: { otwarcieLikwidacji: fmtDateShort(o.dz6.likw.date), likwidatorzy: [person(o.dz6.likw.likwidator)] } } : o.dz6.restr ? { postepowanieRestrukturyzacyjne: { rodzaj: o.dz6.restr.kind, data: fmtDateShort(o.dz6.restr.date) } } : {},
      },
    },
  };
}
ACTIONS['krs-json'] = () => {
  const c = CUR;
  openModal(`<p class="mini-label">GET /api/krs/OdpisPelny/${c.krs}?rejestr=P&format=json</p><h2 class="h3">Odpis pełny, ${esc(c.name)}</h2><p class="small muted">W kształcie odpowiedzi API KRS, skrócony. Surowy JSON leży w blob storage pod kluczem <span class="mono">sha256:${fakeSha(c.krs + 'odpis').slice(0, 16)}…</span></p><pre class="code code--json">${esc(JSON.stringify(odpisJson(c), null, 2))}</pre>`, { wide: true, label: 'Odpis JSON' });
};

// ---------- relations graph ----------
function relationsOf(c) {
  const o = odpis(c);
  const up = o.owners.map(w => ({ ...w, c: w.krs ? BY_KRS.get(w.krs) : null }));
  const down = COMPANIES.filter(x => x.hero && odpis(x).owners.some(w => w.krs === c.krs)).map(x => ({ c: x, share: odpis(x).owners.find(w => w.krs === c.krs).share }));
  return { up, down };
}
function coGraph(c) {
  const { up, down } = relationsOf(c);
  const W = 640, H = down.length ? 300 : 200;
  const node = (x, y, label, sub, cls, href) => {
    const w = 190, h = 46;
    const inner = `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="10" class="gn ${cls}"/><text x="${x}" y="${y - 3}" text-anchor="middle" class="gn-t">${esc(label.length > 26 ? label.slice(0, 25) + '…' : label)}</text><text x="${x}" y="${y + 13}" text-anchor="middle" class="gn-s">${esc(sub)}</text>`;
    return href ? `<a href="${href}" class="gn-link">${inner}</a>` : `<g>${inner}</g>`;
  };
  const xs = n => Array.from({ length: n }, (_, i) => W / 2 + (i - (n - 1) / 2) * Math.min(210, (W - 200) / Math.max(1, n - 1)));
  const cy = down.length ? 150 : up.length ? 150 : 100;
  const ux = xs(up.length), dx = xs(down.length);
  const edges = [
    ...up.map((w, i) => `<line class="ge" x1="${ux[i]}" y1="${50 + 23}" x2="${W / 2}" y2="${cy - 23}"/><text class="ge-t" x="${(ux[i] + W / 2) / 2 + 6}" y="${(73 + cy - 23) / 2 + 4}">${Math.round(w.share * 100)}%</text>`),
    ...down.map((x, i) => `<line class="ge" x1="${W / 2}" y1="${cy + 23}" x2="${dx[i]}" y2="${250 - 23}"/><text class="ge-t" x="${(dx[i] + W / 2) / 2 + 6}" y="${(cy + 23 + 227) / 2 + 4}">${Math.round(x.share * 100)}%</text>`),
  ];
  const hasCo = up.some(w => w.c) || down.length;
  return `
    <div class="sec-head"><h2 class="h2">Powiązania kapitałowe</h2><p class="muted small">Ze wspólników w dziale 1, w obie strony. Osoby fizyczne są zamaskowane w API, więc nie łączymy ich między spółkami.</p></div>
    <div class="card graph">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Powiązania kapitałowe">
        ${edges.join('')}
        ${up.map((w, i) => w.c ? node(ux[i], 50, w.c.fullName, `KRS ${w.c.krs}`, 'gn--co', coUrl(w.c)) : node(ux[i], 50, w.full, 'osoba fizyczna (maska API)', 'gn--person')).join('')}
        ${node(W / 2, cy, c.fullName, `KRS ${c.krs}`, 'gn--me')}
        ${down.map((x, i) => node(dx[i], 250, x.c.fullName, `KRS ${x.c.krs}`, 'gn--co', coUrl(x.c))).join('')}
      </svg>
      ${!hasCo ? '<p class="small muted graph__note">Brak powiązań ze spółkami w bazie. Graf rośnie, gdy wspólnikiem jest inna osoba prawna.</p>' : ''}
    </div>`;
}

function coSimilar(c) {
  const fy = lastFyOf(c);
  if (!fy) return '';
  const rows = rankRows('rev', fy, { pkd: c.sector.pkd });
  const pos = rows.findIndex(r => r.c === c) + 1;
  const me = revOf(c, fy);
  const near = rows.filter(r => r.c !== c).sort((a, b) => Math.abs(Math.log(a.v / me)) - Math.abs(Math.log(b.v / me))).slice(0, 6);
  return `<section class="co-sec">
    <div class="sec-head"><h2 class="h2">Podobne spółki</h2><p class="muted small">${pos ? `${pos}. miejsce z ${rows.length} w branży ${esc(c.sector.short)} (${c.sector.pkd}) wg przychodów za ${fy}` : ''} · <a class="link" href="#/ranking?pkd=${c.sector.pkd}&fy=${fy}">ranking branży</a></p></div>
    <ul class="similar">${near.map(r => `<li><a class="card" href="${coUrl(r.c)}"><span class="similar__n">${esc(r.c.fullName)}</span><span class="small muted">${esc(r.c.city)} · ${fmtMoney(r.v)}</span>${sparkline(FYS.map(y => metrics(r.c)[y] ? metrics(r.c)[y].rev : null))}</a></li>`).join('')}</ul>
  </section>`;
}

ACTIONS.copy = el => copyText(el.dataset.v);
ACTIONS.watch = el => {
  const k = el.dataset.krs;
  const on = !WATCH.includes(k);
  WATCH = on ? [...WATCH, k] : WATCH.filter(x => x !== k);
  saveWatch();
  el.classList.toggle('btn--accent', on);
  el.classList.toggle('btn--ghost', !on);
  el.setAttribute('aria-pressed', on);
  el.innerHTML = `${icon(on ? 'bell-on' : 'bell')}${on ? 'Obserwujesz' : 'Obserwuj'}`;
  toast(on ? 'Dodano do obserwowanych. Alerty przyjdą po porannym biuletynie.' : 'Usunięto z obserwowanych');
};

// ---------- rankings ----------
let RANK_SHOW = 50;
function renderRanking(p) {
  const metric = RANK_METRICS[p.m] ? p.m : 'rev';
  const fy = FYS.includes(+p.fy) ? +p.fy : LAST_FY;
  const pkd = SECTOR[p.pkd] ? p.pkd : '';
  const woj = WOJ.includes(p.woj) ? p.woj : '';
  const ratio = ['mNet', 'growth', 'roe'].includes(metric);
  const minRev = p.min != null ? +p.min : ratio ? 5e6 : 0;
  const rows = rankRows(metric, fy, { pkd, woj, minRev });
  const M = RANK_METRICS[metric];
  const vals = rows.map(r => r.v).sort((a, b) => a - b);
  const median = vals.length ? vals[Math.floor(vals.length / 2)] : null;
  const sum = ratio ? null : vals.reduce((t, v) => t + v, 0);
  const sec = pkd ? SECTOR[pkd] : null;
  const title = `${M[3]} w ${fy}${sec ? ` · ${sec.short} (${pkd})` : ''}${woj ? ` · woj. ${woj}` : ''}`;
  const url = `rocznik.example/ranking/${pkd ? slug(pkd) : 'wszystkie'}${woj ? '/' + slug(woj) : ''}/${fy}/${M[1]}`;
  const sel = (name, opts, cur) => `<select data-change="rank" name="${name}">${opts.map(([v, l]) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<section class="wrap page">
    <p class="crumbs"><a href="#/">Rocznik</a> / Rankingi</p>
    <h1 class="h1">${esc(title)}</h1>
    <p class="mono small muted seo-url">${url}</p>
    <div class="filters" id="rankFilters">
      <label class="sel"><span>Miara</span>${sel('m', Object.entries(RANK_METRICS).map(([k, v]) => [k, v[0]]), metric)}</label>
      <label class="sel"><span>Rok</span>${sel('fy', FYS.slice().reverse().map(y => [y, y]), fy)}</label>
      <label class="sel"><span>Branża</span>${sel('pkd', [['', 'Wszystkie branże'], ...SECTORS.map(s => [s.pkd, `${s.short} · ${s.pkd}`])], pkd)}</label>
      <label class="sel"><span>Województwo</span>${sel('woj', [['', 'Cała Polska'], ...WOJ.map(w => [w, w])], woj)}</label>
      <label class="sel"><span>Przychody od</span>${sel('min', [[0, 'bez progu'], [1e6, '1 mln zł'], [5e6, '5 mln zł'], [10e6, '10 mln zł'], [50e6, '50 mln zł']], minRev)}</label>
    </div>
    <div class="stat-row">
      <div class="card stat-tile"><p class="mini-label">Spółek w rankingu</p><p class="kpi-val">${num(rows.length)}</p></div>
      <div class="card stat-tile"><p class="mini-label">Mediana</p><p class="kpi-val">${median == null ? '—' : M[2](median)}</p></div>
      <div class="card stat-tile"><p class="mini-label">${ratio ? 'Najwyżej' : 'Razem'}</p><p class="kpi-val">${rows.length ? M[2](ratio ? rows[0].v : sum) : '—'}</p></div>
    </div>
    <div class="card table-card">
      <div class="table-scroll"><table class="plain rank">
        <thead><tr><th scope="col" class="t-num">#</th><th scope="col">Spółka</th><th scope="col" class="t-num">${M[0]}</th><th scope="col" class="t-num">r/r</th><th scope="col">${FYS[Math.max(0, FYS.indexOf(fy) - 5)]}–${fy}</th><th scope="col">Ryzyko</th></tr></thead>
        <tbody>${rows.slice(0, RANK_SHOW).map((r, i) => {
          const m = metrics(r.c), prev = m[fy - 1] && m[fy - 1][metric];
          const d = !ratio && prev ? (r.v - prev) / Math.abs(prev) : null;
          const sp = FYS.filter(y => y <= fy && y > fy - 7).map(y => m[y] ? m[y][metric === 'growth' || metric === 'mNet' || metric === 'roe' ? 'rev' : metric] : null);
          return `<tr><td class="t-num muted">${i + 1}</td><td><a href="${coUrl(r.c)}">${esc(r.c.fullName)}</a><span class="small muted"> · ${esc(r.c.city)}</span></td><td class="t-num${r.v < 0 ? ' is-neg' : ''}">${M[2](r.v)}</td><td class="t-num${d != null ? (d >= 0 ? ' up' : ' down') : ''}">${d == null ? '' : (d >= 0 ? '+' : '') + fmtPct(d, 0)}</td><td>${sparkline(sp)}</td><td>${riskBadge(r.c, true)}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
      ${rows.length > RANK_SHOW ? `<button type="button" class="btn btn--ghost btn--block" data-act="rank-more">Pokaż kolejne 50 (z ${num(rows.length)})</button>` : ''}
      ${!rows.length ? `<div class="empty">${icon('filter')}<p>Żadna spółka nie spełnia tych warunków.</p></div>` : ''}
    </div>
    <p class="small muted">Ranking liczony z tabeli <span class="mono">metryki_roczne</span>. ${ratio ? 'Dla wskaźników pomijamy najmniejsze spółki (próg przychodów), bo małe mianowniki dają skrajne wyniki.' : ''}</p>
  </section>`;
}
CHANGES.rank = () => {
  const q = new URLSearchParams();
  $$('#rankFilters select').forEach(s => { if (s.value !== '' && !(s.name === 'fy' && +s.value === LAST_FY)) q.set(s.name, s.value); });
  RANK_SHOW = 50;
  location.hash = '#/ranking?' + q.toString();
};
ACTIONS['rank-more'] = () => { RANK_SHOW += 50; rerender(); };

// ---------- watchlist ----------
function watchAlerts() {
  const out = [];
  for (const k of WATCH) {
    const c = BY_KRS.get(k);
    if (!c) continue;
    for (const e of eventsOf(c)) {
      const kind = e.type === 'wzmianka' ? 'sf' : e.dzial === 2 ? 'zarzad' : e.dzial === 4 || e.dzial === 6 ? 'ryzyko' : null;
      if (kind && ALERTS[kind]) out.push({ c, date: e.date, title: e.title, src: `KRS · dział ${e.dzial}`, kind });
    }
    for (const s of risk(c).sig) {
      const kind = s.src.startsWith('KRS') ? 'ryzyko' : s.title.startsWith('Brak sprawozdania') ? 'brak' : s.title.startsWith('Przychody spadły') ? 'spadek' : null;
      if (kind && ALERTS[kind] && s.date >= addDays(TODAY, -200)) out.push({ c, date: s.date, title: s.title, src: s.src, kind });
    }
    const y = fin(c).y[LAST_FY];
    if (y && ALERTS.sf && y.filed >= addDays(TODAY, -200)) out.push({ c, date: y.filed, title: `Nowe sprawozdanie za ${LAST_FY} w RDF`, src: 'RDF', kind: 'sf' });
  }
  return out.filter(a => a.date <= TODAY).sort((a, b) => b.date - a.date);
}
function renderWatch() {
  const list = WATCH.map(k => BY_KRS.get(k)).filter(Boolean);
  const alerts = watchAlerts();
  const AL = [['sf', 'Nowe sprawozdanie w RDF'], ['zarzad', 'Zmiana zarządu lub prokury'], ['ryzyko', 'Wpis w dziale 4 lub 6 KRS'], ['spadek', 'Spadek przychodów o ponad 30%'], ['brak', 'Brak sprawozdania po terminie']];
  return `<section class="wrap page">
    <p class="crumbs"><a href="#/">Rocznik</a> / Obserwowane</p>
    <h1 class="h1">Obserwowane spółki</h1>
    <p class="lede-sm">Alerty liczymy codziennie rano, po przetworzeniu biuletynu KRS z poprzedniego dnia.</p>
    ${!list.length ? `<div class="card empty empty--big">${icon('bell')}<p>Nie obserwujesz jeszcze żadnej spółki. Kliknij „Obserwuj” na stronie spółki albo dodaj przykładowe.</p><button type="button" class="btn btn--accent" data-act="watch-demo">Dodaj 4 przykładowe</button></div>` : `
    <div class="watch-grid">
      <div>
        <div class="card table-card"><div class="table-scroll"><table class="plain">
          <thead><tr><th scope="col">Spółka</th><th scope="col" class="t-num">Przychody</th><th scope="col" class="t-num">Zysk netto</th><th scope="col">Ryzyko</th><th scope="col"><span class="sr-only">Usuń</span></th></tr></thead>
          <tbody>${list.map(c => { const fy = lastFyOf(c), m = fy && metrics(c)[fy]; return `<tr><td><a href="${coUrl(c)}">${esc(c.fullName)}</a><span class="small muted mono"> · ${fy || '—'}</span></td><td class="t-num">${m ? fmtMoney(m.rev) : '—'}</td><td class="t-num${m && m.net < 0 ? ' is-neg' : ''}">${m ? fmtMoney(m.net) : '—'}</td><td>${riskBadge(c, true)}</td><td><button type="button" class="icon-btn" data-act="unwatch" data-krs="${c.krs}" aria-label="Przestań obserwować ${esc(c.name)}">${icon('x')}</button></td></tr>`; }).join('')}</tbody>
        </table></div></div>
        <h2 class="h3 mt">Alerty</h2>
        ${alerts.length ? `<ul class="alerts">${alerts.slice(0, 30).map(a => `<li class="card alert alert--${a.kind}"><span class="alert__d mono small">${fmtDateShort(a.date)}</span><div><a href="${coUrl(a.c)}">${esc(a.c.fullName)}</a><p>${esc(a.title)}</p><p class="small muted">${esc(a.src)} · e-mail wysłany ${fmtDateShort(a.date)} 7:00</p></div></li>`).join('')}</ul>` : '<p class="muted">Brak alertów dla wybranych typów.</p>'}
      </div>
      <aside class="card alert-set">
        <h2 class="h4">Wysyłaj alert, gdy</h2>
        ${AL.map(([k, l]) => `<label class="check"><input type="checkbox" data-change="alert" data-k="${k}"${ALERTS[k] ? ' checked' : ''}> ${l}</label>`).join('')}
        <p class="small muted">E-mail o 7:00 · makieta niczego nie wysyła.</p>
      </aside>
    </div>`}
  </section>`;
}
ACTIONS['watch-demo'] = () => { WATCH = ['0009305114', '0009518630', '0009771205', '0009233871']; saveWatch(); rerender(); toast('Dodano 4 spółki'); };
ACTIONS.unwatch = el => { WATCH = WATCH.filter(k => k !== el.dataset.krs); saveWatch(); rerender(); };
CHANGES.alert = el => { ALERTS[el.dataset.k] = el.checked; store.set('alerts', ALERTS); rerender(); };

// ---------- printable report ----------
function renderReport(krs) {
  const c = BY_KRS.get(krs);
  if (!c) return renderCompany(krs);
  const f = fin(c), m = metrics(c), r = risk(c), o = odpis(c);
  const yrs = f.list.slice(-5);
  const row = (l, k, fmt = fmtMoney) => `<tr><th scope="row">${l}</th>${yrs.map(fy => `<td class="t-num${m[fy][k] < 0 ? ' is-neg' : ''}">${fmt(m[fy][k])}</td>`).join('')}</tr>`;
  return `<div class="report-bar wrap no-print"><a class="btn btn--ghost" href="${coUrl(c)}">${icon('back')}Wróć do spółki</a><button type="button" class="btn btn--accent" data-act="print">${icon('printer')}Drukuj albo zapisz jako PDF</button></div>
  <article class="report">
    <header class="report__head"><div><p class="mini-label">Raport finansowy · stan na ${fmtDateShort(TODAY)}</p><h1 class="report__name">${esc(c.fullName)}</h1><p class="mono small">KRS ${c.krs} · NIP ${c.nipF} · REGON ${c.regon}</p><p class="small">${esc(c.street)}, ${c.zip} ${esc(c.city)} · PKD ${c.sector.pkd} ${esc(c.sector.name)}</p></div><div class="report__logo">${LOGO_SVG}<span>rocznik</span></div></header>
    <section><h2 class="h4">Najważniejsze liczby</h2>
      <div class="table-scroll"><table class="plain report__t"><thead><tr><th scope="col"></th>${yrs.map(fy => `<th scope="col" class="t-num">${fy}</th>`).join('')}</tr></thead><tbody>
      ${row('Przychody', 'rev')}${row('EBIT', 'ebit')}${row('Zysk netto', 'net')}${row('Aktywa', 'assets')}${row('Kapitał własny', 'equity')}${row('Zobowiązania', 'liab')}${row('Marża netto', 'mNet', v => fmtPct(v))}${row('Zadłużenie', 'debt', v => fmtPct(v, 0))}
      </tbody></table></div></section>
    <section class="report__charts">${['rev', 'net'].map(k => `<div><h3 class="h5">${k === 'rev' ? 'Przychody' : 'Zysk netto'}</h3>${columnChart(f.list.map(fy => ({ x: fy, v: m[fy][k], est: fy === 2017 })), { h: 160, label: k })}</div>`).join('')}</section>
    <section><h2 class="h4">Ryzyko: ${r.level} (${r.score}/100)</h2>${r.sig.length ? `<ul class="report__list">${r.sig.map(s => `<li><b>${esc(s.title)}</b>: ${esc(s.detail)} <span class="muted">(${esc(s.src)}, ${fmtDateShort(s.date)})</span></li>`).join('')}</ul>` : '<p>Brak sygnałów ostrzegawczych.</p>'}</section>
    <section><h2 class="h4">Reprezentacja</h2><p class="small">${o.repr}</p><p class="small">${o.board.map(p => `${p.full} (${p.fn.toLowerCase()})`).join(' · ')}</p></section>
    <footer class="report__foot small muted">Źródła: API KRS (odpis pełny z ${fmtDateShort(o.fetched)}, CC0), Repozytorium Dokumentów Finansowych (${documents(c).length} dokumentów), biała lista VAT. Dane osobowe zamaskowane przez API KRS. Makieta: spółka i liczby są fikcyjne.</footer>
  </article>`;
}
ACTIONS.print = () => window.print();
