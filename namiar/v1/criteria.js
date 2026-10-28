// Namiar v1 — criteria registry and the query engine.
// Every filter in the builder is one entry in CRITERIA. Add an object here and it shows up
// in the builder, the catalog, the funnel, pricing and the "why" column of the export.
// status: 'soon' lists it in the catalog for votes only.
//
// Entry shape:
//   id, group, label, icon, desc, source, refresh, surcharge (zł per record, signals only)
//   params: [{ id, type: 'chips' | 'seg' | 'range' | 'checks' | 'toggle', label, options, def, ... }]
//   test(record, p) → bool          empty(p) → true when the filter lets everything through
//   summary(p) → funnel label        reasons(record, p) → ["why it matched", …]
//   score(record, p) → 0–100 signal strength used to rank records

const GROUPS = {
  base: { label: 'Podstawowe', desc: 'Kim jest firma i gdzie działa' },
  www: { label: 'Strona WWW', desc: 'Co mówi o firmie jej strona' },
  online: { label: 'Widoczność w sieci', desc: 'Opinie, profile i reklamy' },
  events: { label: 'Zdarzenia w firmie', desc: 'Momenty, w których firma kupuje' },
  contact: { label: 'Dane kontaktowe', desc: 'Jakie dane muszą być w rekordzie' },
};

const SITE_CHECKS = {
  nomobile: { label: 'brak wersji mobilnej', ok: 'działa na telefonie', test: s => !s.mobile },
  nohttps: { label: 'brak HTTPS', ok: 'ma HTTPS', test: s => !s.https },
  oldtech: { label: 'stara technologia', ok: 'aktualna technologia', test: s => TECH[s.tech].old },
  oldcopy: { label: '© sprzed 2020', ok: 'aktualna stopka', test: s => s.copy < 2020 },
  stale: { label: 'treść bez zmian 3+ lata', ok: 'treść aktualizowana', test: s => YEAR - s.changed >= 3 },
  slow: { label: 'wolna (< 40/100)', ok: 'szybkość w normie', test: s => s.speed < 40 },
};

const AGE_BUCKETS = [['0', '< 1 rok', 0, 1], ['1', '1–3 lata', 1, 3], ['3', '3–10 lat', 3, 10], ['10', 'ponad 10 lat', 10, 99]];
const DAYS_OPTS = [[30, '30 dni'], [90, '90 dni'], [180, 'pół roku'], [365, 'rok']];

const list = (arr, max = 3) => arr.length <= max ? arr.join(', ') : arr.slice(0, max).join(', ') + ` +${arr.length - max}`;
const fmtD = date => date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
const daysAgoDate = n => new Date(YEAR, TODAY.getMonth(), TODAY.getDate() - n);
function plural(n, one, few, many) {
  const a = Math.abs(n), t = a % 10, h = a % 100;
  if (a === 1) return one;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
}
function ago(days) {
  if (days < 1) return 'dziś';
  if (days < 45) return `${days} ${plural(days, 'dzień', 'dni', 'dni')} temu`;
  if (days < 365) { const m = Math.round(days / 30); return `${m} ${plural(m, 'miesiąc', 'miesiące', 'miesięcy')} temu`; }
  const y = Math.floor(days / 365);
  return `${y} ${plural(y, 'rok', 'lata', 'lat')} temu`;
}
const okSite = r => r.site && r.site.status === 'ok';

const CRITERIA = [
  // ---------- base ----------
  {
    id: 'industry', group: 'base', pinned: true, icon: 'briefcase', label: 'Branża',
    desc: 'Kod PKD z rejestru, sprawdzony z opisem działalności na stronie i w wizytówce.',
    source: 'CEIDG, KRS', refresh: 'codziennie',
    params: [{ id: 'v', type: 'chips', search: true, options: () => Object.entries(INDUSTRIES).map(([k, v]) => [k, v.label, v.pkd]), def: [] }],
    empty: p => !p.v.length,
    test: (r, p) => p.v.includes(r.ind),
    summary: p => list(p.v.map(k => INDUSTRIES[k].label)),
  },
  {
    id: 'region', group: 'base', pinned: true, icon: 'pin', label: 'Lokalizacja',
    desc: 'Adres siedziby albo głównego miejsca prowadzenia działalności.',
    source: 'CEIDG, KRS, REGON', refresh: 'codziennie',
    params: [
      { id: 'voiv', type: 'chips', label: 'Województwa', options: () => Object.entries(VOIV).map(([k, v]) => [k, v.label]), def: [] },
      { id: 'city', type: 'chips', label: 'Miasta', hint: 'Wybierz województwo, żeby zawęzić do miast', options: p => p.voiv.flatMap(v => VOIV[v].cities.map(c => [c[0], c[0]])), def: [] },
    ],
    empty: p => !p.voiv.length,
    test(r, p) {
      if (!p.voiv.includes(r.voiv)) return false;
      const sel = p.city.filter(c => CITY_VOIV[c] === r.voiv);
      return !sel.length || sel.includes(r.city);
    },
    summary: p => {
      const parts = p.voiv.map(v => {
        const cs = p.city.filter(c => CITY_VOIV[c] === v);
        return cs.length ? cs.join(', ') : VOIV[v].label;
      });
      return list(parts);
    },
  },
  {
    id: 'size', group: 'base', pinned: true, icon: 'users', label: 'Wielkość firmy',
    desc: 'Liczba pracujących z rejestru REGON i deklaracji ZUS, uzupełniona danymi z ogłoszeń.',
    source: 'REGON (GUS)', refresh: 'co kwartał',
    params: [{ id: 'v', type: 'chips', options: () => Object.entries(BANDS).map(([k, v]) => [k, v]), def: [] }],
    empty: p => !p.v.length,
    test: (r, p) => p.v.includes(r.band),
    summary: p => list(p.v.map(k => BANDS[k])),
  },
  {
    id: 'legal', group: 'base', icon: 'building', label: 'Forma prawna',
    desc: 'Na przykład tylko spółki — mają zarząd w KRS i zwykle większe budżety.',
    source: 'CEIDG, KRS', refresh: 'codziennie',
    params: [{ id: 'v', type: 'chips', options: () => Object.entries(LEGAL).map(([k, v]) => [k, v.label]), def: [] }],
    empty: p => !p.v.length,
    test: (r, p) => p.v.includes(r.legal),
    summary: p => list(p.v.map(k => LEGAL[k].label)),
  },
  {
    id: 'age', group: 'base', icon: 'calendar', label: 'Wiek firmy',
    desc: 'Liczony od daty rozpoczęcia działalności.',
    source: 'CEIDG, KRS', refresh: 'codziennie',
    params: [{ id: 'v', type: 'chips', options: () => AGE_BUCKETS.map(b => [b[0], b[1]]), def: [] }],
    empty: p => !p.v.length,
    test: (r, p) => p.v.some(k => { const b = AGE_BUCKETS.find(x => x[0] === k); const y = r.founded / 365; return y >= b[2] && y < b[3]; }),
    summary: p => 'działa ' + list(p.v.map(k => AGE_BUCKETS.find(x => x[0] === k)[1])),
  },

  // ---------- www ----------
  {
    id: 'old-site', group: 'www', icon: 'clock', label: 'Przestarzała strona',
    desc: 'Wynik 0–100 z sześciu pomiarów: wiek projektu, wersja mobilna, HTTPS, technologia, szybkość i ostatnia zmiana treści.',
    source: 'Własny crawler + archiwum stron', refresh: 'skan co 30 dni', surcharge: 0.10,
    params: [
      { id: 'min', type: 'range', label: 'Wynik co najmniej', min: 25, max: 95, step: 5, def: 50, fmt: v => `${v} pkt · ${zone(v)[2]}` },
      { id: 'must', type: 'checks', label: 'I do tego koniecznie', options: () => Object.entries(SITE_CHECKS).map(([k, v]) => [k, v.label]), def: [] },
    ],
    test: (r, p) => okSite(r) && r.score >= p.min && p.must.every(k => SITE_CHECKS[k].test(r.site)),
    summary: p => `strona ≥ ${p.min} pkt` + (p.must.length ? ` + ${list(p.must.map(k => SITE_CHECKS[k].label), 2)}` : ''),
    reasons: r => okSite(r) ? [`strona ${r.score} pkt`, ...Object.values(SITE_CHECKS).filter(c => c.test(r.site)).map(c => c.label).slice(0, 2), `© ${r.site.copy}`].slice(0, 3) : [],
    score: r => r.score ?? 0,
  },
  {
    id: 'no-site', group: 'www', icon: 'globe-off', label: 'Brak strony WWW',
    desc: 'Firma działa i ma klientów, ale w sieci jest tylko wizytówką w mapach albo profilem na Facebooku.',
    source: 'Crawler + wizytówki w mapach', refresh: 'co 30 dni', surcharge: 0.05,
    params: [{ id: 'minRev', type: 'range', label: '…ale ma w mapach co najmniej', min: 0, max: 100, step: 5, def: 10, fmt: v => v ? `${v} ${plural(v, 'opinię', 'opinie', 'opinii')}` : 'bez warunku' }],
    test: (r, p) => !r.site && (p.minRev === 0 || (!!r.g && r.g.reviews >= p.minRev)),
    summary: p => 'bez strony' + (p.minRev ? `, ≥ ${p.minRev} opinii` : ''),
    reasons: r => ['brak strony', r.g ? `${r.g.reviews} ${plural(r.g.reviews, 'opinia', 'opinie', 'opinii')} w mapach` : 'brak wizytówki'],
    score: r => r.g ? Math.min(100, r.g.reviews) : 5,
  },
  {
    id: 'site-down', group: 'www', icon: 'plug', label: 'Strona nie działa',
    desc: 'Adres z rejestru lub wizytówki nie odpowiada: wygasła domena, błąd serwera albo pusta strona hostingu.',
    source: 'Crawler', refresh: 'co 7 dni', surcharge: 0.10,
    params: [{ id: 'kind', type: 'seg', options: [['any', 'Dowolny błąd'], ['down', 'Domena nie odpowiada'], ['error', 'Błąd serwera']], def: 'any' }],
    test: (r, p) => !!r.site && r.site.status !== 'ok' && (p.kind === 'any' || r.site.status === p.kind),
    summary: p => ({ any: 'strona nie działa', down: 'domena nie odpowiada', error: 'błąd serwera' })[p.kind],
    reasons: r => [r.site.status === 'down' ? 'domena nie odpowiada' : 'błąd serwera 500'],
    score: () => 80,
  },
  {
    id: 'builder', group: 'www', icon: 'layout', label: 'Strona z darmowego kreatora',
    desc: 'Adres w subdomenie kreatora i jego reklama w stopce. Firma płaci już za domenę… tylko nie za swoją.',
    source: 'Crawler', refresh: 'co 30 dni', surcharge: 0.05,
    params: [],
    test: r => okSite(r) && r.site.tech === 'builder',
    summary: () => 'strona w kreatorze',
    reasons: () => ['subdomena kreatora'],
    score: () => 50,
  },
  {
    id: 'no-booking', group: 'www', icon: 'calendar-x', label: 'Brak rezerwacji online',
    desc: 'Gabinety, salony, warsztaty, hotele i restauracje, które przyjmują zapisy tylko przez telefon.',
    source: 'Crawler (formularze, widżety)', refresh: 'co 30 dni', surcharge: 0.05,
    params: [],
    test: r => !!INDUSTRIES[r.ind].svc && okSite(r) && !r.site.booking,
    summary: () => 'bez rezerwacji online',
    reasons: () => ['zapisy tylko telefonicznie'],
    score: r => r.g ? Math.min(100, r.g.reviews / 2) : 10,
  },
  {
    id: 'tech', group: 'www', icon: 'code', label: 'Technologia strony',
    desc: 'Silnik i biblioteki wykryte w kodzie strony. Przydatne, jeśli specjalizujesz się w migracjach.',
    source: 'Crawler (nagłówki, kod)', refresh: 'co 30 dni', surcharge: 0.05,
    params: [{ id: 'v', type: 'chips', options: () => Object.entries(TECH).map(([k, v]) => [k, v.label]), def: [] }],
    empty: p => !p.v.length,
    test: (r, p) => okSite(r) && p.v.includes(r.site.tech),
    summary: p => list(p.v.map(k => TECH[k].label), 2),
    reasons: r => okSite(r) ? [TECH[r.site.tech].label] : [],
  },

  // ---------- online ----------
  {
    id: 'bad-reviews', group: 'online', icon: 'star', label: 'Słabe opinie',
    desc: 'Średnia ocen w mapach poniżej progu, przy minimalnej liczbie opinii, żeby jedna zła nie decydowała.',
    source: 'Publiczne wizytówki w mapach', refresh: 'co 7 dni', surcharge: 0.05,
    params: [
      { id: 'max', type: 'range', label: 'Średnia ocen najwyżej', min: 2.5, max: 4.5, step: 0.1, def: 4.0, fmt: v => `${v.toFixed(1).replace('.', ',')} ★` },
      { id: 'min', type: 'range', label: 'Przy co najmniej', min: 3, max: 50, step: 1, def: 5, fmt: v => `${v} ${plural(v, 'opinii', 'opiniach', 'opiniach')}` },
    ],
    test: (r, p) => !!r.g && r.g.rating != null && r.g.rating <= p.max + 1e-9 && r.g.reviews >= p.min,
    summary: p => `ocena ≤ ${p.max.toFixed(1).replace('.', ',')} ★`,
    reasons: r => r.g && r.g.rating != null ? [`★ ${String(r.g.rating).replace('.', ',')} (${r.g.reviews})`] : [],
    score: r => r.g && r.g.rating ? Math.round((5 - r.g.rating) * 40) : 0,
  },
  {
    id: 'few-reviews', group: 'online', icon: 'message', label: 'Mało opinii',
    desc: 'Firma ma niewiele opinii albo nie ma wizytówki wcale — konkurencja z setką opinii zgarnia klientów.',
    source: 'Publiczne wizytówki w mapach', refresh: 'co 7 dni', surcharge: 0.05,
    params: [{ id: 'max', type: 'range', label: 'Najwyżej', min: 0, max: 30, step: 1, def: 10, fmt: v => `${v} ${plural(v, 'opinia', 'opinie', 'opinii')}` }],
    test: (r, p) => !r.g || r.g.reviews <= p.max,
    summary: p => `≤ ${p.max} opinii`,
    reasons: r => [r.g ? `${r.g.reviews} ${plural(r.g.reviews, 'opinia', 'opinie', 'opinii')}` : 'brak wizytówki'],
    score: r => r.g ? 60 - r.g.reviews : 70,
  },
  {
    id: 'unclaimed', group: 'online', icon: 'flag', label: 'Nieprzejęta wizytówka',
    desc: 'Wizytówka w mapach istnieje, ale nikt z firmy jej nie zweryfikował — nie odpowiada na opinie i nie zmienia godzin.',
    source: 'Publiczne wizytówki w mapach', refresh: 'co 7 dni', surcharge: 0.05,
    params: [],
    test: r => !!r.g && !r.g.claimed,
    summary: () => 'wizytówka nieprzejęta',
    reasons: () => ['wizytówka nieprzejęta'],
    score: r => r.g ? Math.min(100, r.g.reviews) : 0,
  },
  {
    id: 'dead-social', group: 'online', icon: 'moon', label: 'Uśpiony Facebook',
    desc: 'Ostatni post sprzed miesięcy albo brak profilu.',
    source: 'Publiczne profile firm', refresh: 'co 7 dni', surcharge: 0.05,
    params: [
      { id: 'days', type: 'seg', label: 'Bez posta od', options: [[90, '3 mies.'], [180, 'pół roku'], [365, 'roku'], [730, '2 lat']], def: 365 },
      { id: 'none', type: 'toggle', label: 'Liczy się też brak profilu', def: true },
    ],
    test: (r, p) => r.fb == null ? p.none : r.fb >= p.days,
    summary: p => `FB cichy od ${({ 90: '3 mies.', 180: 'pół roku', 365: 'roku', 730: '2 lat' })[p.days]}`,
    reasons: r => [r.fb == null ? 'brak profilu FB' : `ostatni post ${ago(r.fb)}`],
    score: r => r.fb == null ? 40 : Math.min(100, r.fb / 10),
  },
  {
    id: 'ads', group: 'online', icon: 'megaphone', label: 'Płaci za reklamy',
    desc: 'Ma aktywne kampanie w wyszukiwarce lub social mediach. Ma budżet i wydaje go na marketing — najmocniejszy sygnał w bazie.',
    source: 'Publiczne biblioteki reklam', refresh: 'co 7 dni', surcharge: 0.10,
    params: [],
    test: r => r.ads,
    summary: () => 'aktywne reklamy',
    reasons: () => ['aktywne reklamy'],
    score: () => 60,
  },

  // ---------- events ----------
  {
    id: 'new-company', group: 'events', icon: 'sparkle', label: 'Nowa firma',
    desc: 'Świeży wpis w rejestrze. Nowa firma właśnie wybiera księgowość, ubezpieczenie, stronę i dostawców.',
    source: 'CEIDG, KRS', refresh: 'codziennie', surcharge: 0.10,
    params: [{ id: 'days', type: 'seg', label: 'Zarejestrowana w ciągu', options: DAYS_OPTS, def: 90 }],
    test: (r, p) => r.founded <= p.days,
    summary: p => `nowa (${DAYS_OPTS.find(o => o[0] === p.days)[1]})`,
    reasons: r => [`start ${fmtD(r.fDate)}`],
    score: (r, p) => Math.round(100 - r.founded / p.days * 100),
  },
  {
    id: 'hiring', group: 'events', icon: 'briefcase-plus', label: 'Rekrutuje',
    desc: 'Aktywne ogłoszenia o pracę. Firma rośnie, więc ma pieniądze i nowe potrzeby.',
    source: 'Portale z ofertami pracy', refresh: 'codziennie', surcharge: 0.10,
    params: [{ id: 'min', type: 'range', label: 'Otwartych ofert co najmniej', min: 1, max: 5, step: 1, def: 1, fmt: v => `${v}` }],
    test: (r, p) => r.hiring >= p.min,
    summary: p => `rekrutuje (${p.min}+)`,
    reasons: r => [`${r.hiring} ${plural(r.hiring, 'oferta', 'oferty', 'ofert')} pracy`],
    score: r => Math.min(100, r.hiring * 20),
  },
  {
    id: 'growth', group: 'events', icon: 'trend', label: 'Rośnie zatrudnienie',
    desc: 'Liczba pracujących wzrosła rok do roku.',
    source: 'REGON, ogłoszenia', refresh: 'co kwartał', surcharge: 0.10,
    params: [{ id: 'min', type: 'range', label: 'Wzrost co najmniej', min: 10, max: 80, step: 5, def: 20, fmt: v => `+${v}% r/r` }],
    test: (r, p) => r.band !== '1' && r.growth >= p.min,
    summary: p => `zatrudnienie +${p.min}%`,
    reasons: r => [`zatrudnienie +${r.growth}%`],
    score: r => Math.min(100, r.growth),
  },
  {
    id: 'moved', group: 'events', icon: 'truck', label: 'Przeprowadzka',
    desc: 'Zmiana adresu w rejestrze. Nowe biuro to nowe meble, internet, szyldy, ubezpieczenie i aktualizacja wizytówek.',
    source: 'CEIDG, KRS', refresh: 'codziennie', surcharge: 0.10,
    params: [{ id: 'days', type: 'seg', label: 'W ciągu', options: DAYS_OPTS, def: 180 }],
    test: (r, p) => r.moved != null && r.moved <= p.days,
    summary: p => `nowy adres (${DAYS_OPTS.find(o => o[0] === p.days)[1]})`,
    reasons: r => [`nowy adres od ${fmtD(daysAgoDate(r.moved))}`],
    score: (r, p) => Math.round(100 - r.moved / p.days * 100),
  },
  {
    id: 'board', group: 'events', icon: 'user-check', label: 'Zmiana w zarządzie',
    desc: 'Nowy prezes lub członek zarządu w KRS. Nowa osoba zwykle przegląda umowy i dostawców.',
    source: 'KRS (Monitor Sądowy)', refresh: 'codziennie', surcharge: 0.10,
    params: [{ id: 'days', type: 'seg', label: 'W ciągu', options: DAYS_OPTS, def: 180 }],
    test: (r, p) => r.board != null && r.board <= p.days,
    summary: p => `nowy zarząd (${DAYS_OPTS.find(o => o[0] === p.days)[1]})`,
    reasons: r => [`zmiana zarządu ${ago(r.board)}`],
    score: (r, p) => Math.round(100 - r.board / p.days * 100),
  },
  {
    id: 'jubilee', group: 'events', icon: 'cake', label: 'Okrągła rocznica',
    desc: 'Za chwilę 5, 10, 15… lat działalności. Dobry pretekst do odświeżenia logo, strony albo zdjęć.',
    source: 'CEIDG, KRS', refresh: 'codziennie', surcharge: 0.05,
    params: [{ id: 'days', type: 'seg', label: 'W ciągu najbliższych', options: [[30, '30 dni'], [90, '90 dni'], [180, 'pół roku']], def: 90 }],
    test: (r, p) => !!r.jub && r.jub.days <= p.days,
    summary: p => `rocznica w ${p.days} dni`,
    reasons: r => [`${r.jub.years}-lecie za ${r.jub.days} ${plural(r.jub.days, 'dzień', 'dni', 'dni')}`],
    score: r => r.jub ? r.jub.years * 3 : 0,
  },

  // ---------- contact ----------
  {
    id: 'has-email', group: 'contact', icon: 'mail', label: 'Ma e-mail',
    desc: 'Tylko rekordy z adresem sprawdzonym serwerem pocztowym w ciągu ostatnich 30 dni.',
    source: 'Strona firmy, wizytówki, weryfikacja SMTP', refresh: 'co 30 dni',
    params: [{ id: 'kind', type: 'seg', options: [['domain', 'W domenie firmy'], ['any', 'Dowolny']], def: 'domain' }],
    test: (r, p) => !!r.email && (p.kind === 'any' || r.emailType === 'domain'),
    summary: p => p.kind === 'domain' ? 'e-mail w domenie' : 'ma e-mail',
  },
  {
    id: 'has-phone', group: 'contact', icon: 'phone', label: 'Ma telefon',
    desc: 'Numer z rejestru, strony lub wizytówki, sprawdzony w bazie numeracji.',
    source: 'Rejestry, strona, wizytówki', refresh: 'co 30 dni',
    params: [],
    test: r => !!r.phone,
    summary: () => 'ma telefon',
  },

  // ---------- soon: catalog only, open for votes ----------
  { id: 'eu-funds', group: 'events', status: 'soon', votes: 187, icon: 'coins', label: 'Dostała dotację z UE', desc: 'Firma jest na liście beneficjentów funduszy unijnych — ma środki do wydania w określonym czasie.', source: 'Listy beneficjentów' },
  { id: 'tenders', group: 'events', status: 'soon', votes: 156, icon: 'trophy', label: 'Wygrała przetarg', desc: 'Rozstrzygnięty przetarg publiczny w ostatnich tygodniach: będzie zatrudniać i kupować.', source: 'Biuletyn Zamówień Publicznych' },
  { id: 'eaa', group: 'www', status: 'soon', votes: 132, icon: 'accessibility', label: 'Sklep niedostępny (EAA)', desc: 'Sklep internetowy, który nie spełnia wymagań dostępności obowiązujących od czerwca 2025.', source: 'Automatyczny audyt WCAG' },
  { id: 'revenue', group: 'events', status: 'soon', votes: 121, icon: 'trend', label: 'Wzrost przychodów', desc: 'Przychody wyższe rok do roku według sprawozdań złożonych w KRS.', source: 'e-KRS, sprawozdania finansowe' },
  { id: 'shop', group: 'www', status: 'soon', votes: 98, icon: 'cart', label: 'Sklep na starej platformie', desc: 'Sklep internetowy na silniku bez wsparcia, bez szybkich płatności lub z wolnym koszykiem.', source: 'Crawler' },
  { id: 'replies', group: 'online', status: 'soon', votes: 74, icon: 'message', label: 'Nie odpowiada na opinie', desc: 'Ma opinie w mapach, ale nigdy na nie nie odpowiedziała — szczególnie na te negatywne.', source: 'Publiczne wizytówki w mapach' },
];

const CRIT = Object.fromEntries(CRITERIA.map(c => [c.id, c]));
const ACTIVE = CRITERIA.filter(c => c.status !== 'soon');
const PINNED = ACTIVE.filter(c => c.pinned).map(c => c.id);

// ---------- query ----------
const clone = v => JSON.parse(JSON.stringify(v));

function defaults(c) {
  const p = {};
  for (const x of c.params || []) p[x.id] = clone(x.def);
  return p;
}
const newItem = (id, p) => ({ id, mode: 'in', p: Object.assign(defaults(CRIT[id]), p || {}) });

function blankQuery() {
  return { name: '', items: PINNED.map(id => newItem(id)), fields: { email: true, phone: true, person: false }, sort: 'signal', limit: 0, skipBought: true, exclude: '' };
}

// Build a query from a compact spec: { industry: { v: ['dent'] }, 'old-site': { min: 60 } }
function queryFrom(spec, extra) {
  const q = blankQuery();
  for (const [id, p] of Object.entries(spec)) {
    const i = q.items.findIndex(it => it.id === id);
    if (i >= 0) Object.assign(q.items[i].p, p);
    else q.items.push(newItem(id, p));
  }
  return Object.assign(q, extra || {});
}

const isEmpty = it => { const c = CRIT[it.id]; return !!(c.empty && c.empty(it.p)); };
const isSignal = it => CRIT[it.id].group !== 'base' && !isEmpty(it);

// Sanitize a query that came from storage or a URL: drop unknown criteria, fill missing params.
function normalizeQuery(q) {
  const base = blankQuery();
  if (!q || !Array.isArray(q.items)) return base;
  const items = [];
  for (const it of q.items) {
    const c = CRIT[it && it.id];
    if (!c || c.status === 'soon' || items.some(x => x.id === it.id)) continue;
    const p = defaults(c);
    for (const k of Object.keys(p)) if (it.p && it.p[k] !== undefined && typeof it.p[k] === typeof p[k]) p[k] = it.p[k];
    items.push({ id: it.id, mode: it.mode === 'out' && !c.pinned ? 'out' : 'in', p });
  }
  for (const id of PINNED) if (!items.some(x => x.id === id)) items.unshift(newItem(id));
  items.sort((a, b) => (CRIT[b.id].pinned ? 1 : 0) - (CRIT[a.id].pinned ? 1 : 0));
  return {
    name: typeof q.name === 'string' ? q.name.slice(0, 80) : '',
    items,
    fields: Object.assign({}, base.fields, q.fields || {}),
    sort: ['signal', 'newest', 'biggest', 'random'].includes(q.sort) ? q.sort : 'signal',
    limit: Number.isFinite(q.limit) ? Math.max(0, q.limit | 0) : 0,
    skipBought: q.skipBought !== false,
    exclude: typeof q.exclude === 'string' ? q.exclude.slice(0, 20000) : '',
  };
}

function encodeQuery(q) {
  const json = JSON.stringify({ n: q.name, i: q.items.map(it => [it.id, it.mode === 'out' ? 1 : 0, it.p]), f: q.fields, s: q.sort, l: q.limit });
  return btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeQuery(str) {
  try {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    return normalizeQuery({ name: o.n, items: (o.i || []).map(([id, m, p]) => ({ id, mode: m ? 'out' : 'in', p })), fields: o.f, sort: o.s, limit: o.l });
  } catch (e) { return null; }
}

// Exclusion list pasted by the user: NIPs (10 digits) and domains.
function parseExclude(text) {
  const nips = new Set(), domains = new Set();
  for (const tok of (text || '').split(/[\s,;]+/)) {
    const digits = tok.replace(/\D/g, '');
    if (digits.length === 10 && /^[\d\s-]+$/.test(tok)) nips.add(digits);
    else if (/\./.test(tok)) domains.add(tok.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''));
  }
  return { nips, domains, size: nips.size + domains.size };
}

// Runs the query and returns the matching records plus one funnel step per criterion.
function runQuery(q, opt = {}) {
  let rows = opt.pool || DB;
  const steps = [{ id: '_all', label: opt.pool ? 'Nowe firmy w tym tygodniu' : 'Cała baza', n: rows.length }];
  for (const it of q.items) {
    const c = CRIT[it.id];
    if (!c || c.status === 'soon' || isEmpty(it)) continue;
    const out = it.mode === 'out';
    const before = rows.length;
    rows = rows.filter(r => !!c.test(r, it.p) !== out);
    steps.push({ id: it.id, label: (out ? 'bez: ' : '') + c.summary(it.p), n: rows.length, before });
  }
  const bought = opt.bought;
  if (q.skipBought && bought && bought.size) {
    const before = rows.length;
    rows = rows.filter(r => !bought.has(r.id));
    if (rows.length !== before) steps.push({ id: '_bought', label: 'bez kupionych wcześniej', n: rows.length, before });
  }
  const ex = parseExclude(q.exclude);
  if (ex.size) {
    const before = rows.length;
    rows = rows.filter(r => !ex.nips.has(r.nip.replace(/\D/g, '')) && !(r.site && ex.domains.has(r.site.domain)));
    steps.push({ id: '_ex', label: `bez Twojej listy (${ex.size})`, n: rows.length, before });
  }
  return { rows, steps };
}

function signalScore(r, q) {
  let s = 0;
  for (const it of q.items) {
    const c = CRIT[it.id];
    if (it.mode === 'in' && c.score && !isEmpty(it)) s += c.score(r, it.p);
  }
  return s;
}

function sortRows(rows, q) {
  const a = rows.slice();
  if (q.sort === 'newest') a.sort((x, y) => x.founded - y.founded || x.id - y.id);
  else if (q.sort === 'biggest') a.sort((x, y) => y.emp - x.emp || x.id - y.id);
  else if (q.sort === 'random') a.sort((x, y) => hashStr('r' + x.id) - hashStr('r' + y.id));
  else {
    const sc = new Map(a.map(r => [r.id, signalScore(r, q)]));
    a.sort((x, y) => sc.get(y.id) - sc.get(x.id) || (y.g ? y.g.reviews : 0) - (x.g ? x.g.reviews : 0) || x.id - y.id);
  }
  return a;
}

function reasonsFor(r, q) {
  const out = [];
  for (const it of q.items) {
    const c = CRIT[it.id];
    if (it.mode === 'in' && c.reasons && !isEmpty(it)) out.push(...c.reasons(r, it.p));
  }
  return out;
}

// Share of the whole base each criterion flags with its default settings (catalog cards).
let _shares = null;
function shares() {
  if (_shares) return _shares;
  _shares = {};
  for (const c of ACTIVE) {
    if (c.group === 'base') continue;
    const p = defaults(c);
    if (c.empty && c.empty(p)) {
      const all = c.params[0].options(p).map(o => o[0]);
      p[c.params[0].id] = all;
    }
    _shares[c.id] = DB.filter(r => c.test(r, p)).length / DB.length;
  }
  return _shares;
}

// ---------- pricing ----------
const PRICE = { base: 0.25, email: 0.25, phone: 0.20, person: 0.15, min: 49, vat: 0.23, monitorCap: 99 };
const TIERS = [[5000, 0.3], [2000, 0.2], [500, 0.1], [0, 0]];
const FIELDS = {
  email: { label: 'E-mail firmowy', note: 'zweryfikowany SMTP', price: PRICE.email, has: r => !!r.email },
  phone: { label: 'Telefon', note: 'stacjonarny lub komórkowy', price: PRICE.phone, has: r => !!r.phone },
  person: { label: 'Osoba decyzyjna', note: 'imię, nazwisko i rola z rejestru', price: PRICE.person, has: () => true },
};

function surchargeOf(q) {
  const items = q.items.filter(it => it.mode === 'in' && isSignal(it) && CRIT[it.id].surcharge);
  return { sum: items.reduce((s, it) => s + CRIT[it.id].surcharge, 0), items };
}

function quote(rows, q) {
  const n = rows.length;
  const sur = surchargeOf(q);
  const lines = [{ key: 'base', label: 'Dane firmy', note: 'nazwa, NIP, adres, PKD, WWW, sygnały', qty: n, unit: PRICE.base }];
  if (sur.sum > 0) lines.push({ key: 'sig', label: 'Dopłata za sygnały', note: list(sur.items.map(it => CRIT[it.id].label), 2), qty: n, unit: round2(sur.sum) });
  for (const [k, f] of Object.entries(FIELDS)) {
    if (!q.fields[k]) continue;
    lines.push({ key: k, label: f.label, note: 'tylko rekordy, które go mają', qty: rows.filter(f.has).length, unit: f.price });
  }
  for (const l of lines) l.total = round2(l.qty * l.unit);
  const sub = round2(lines.reduce((s, l) => s + l.total, 0));
  const rate = TIERS.find(t => n >= t[0])[1];
  const disc = round2(sub * rate);
  let net = round2(sub - disc);
  const minApplied = n > 0 && net < PRICE.min;
  if (minApplied) net = PRICE.min;
  if (!n) net = 0;
  const vat = round2(net * PRICE.vat);
  return { n, lines, sub, rate, disc, net, vat, gross: round2(net + vat), per: n ? net / n : 0, minApplied };
}
function round2(v) { return Math.round(v * 100) / 100; }
