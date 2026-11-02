// ClientTracker v1 — calendar and SLA: Polish holidays from rules, service windows, the reaction deadline and the SLA state.
// Every calculation runs in Europe/Warsaw named here, never in the browser's zone (O-5). Times are stored as UTC ms.

const TZ = 'Europe/Warsaw';
const MIN = 60000, HOUR = 3600000, DAY = 86400000;

// ---------- Warsaw wall clock ----------
const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function wParts(ms) {
  const o = {};
  for (const p of partsFmt.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = +p.value;
  const dn = Date.UTC(o.year, o.month - 1, o.day) / DAY;
  return { y: o.year, m: o.month, d: o.day, hh: o.hour, mi: o.minute, s: o.second, dn, dow: dowOf(dn) };
}
function offsetAt(ms) {
  const p = wParts(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mi, p.s) - (ms - (((ms % 1000) + 1000) % 1000));
}
// Warsaw wall time → UTC ms; minutes since midnight, so window hours can be passed straight in
function fromW(dn, minutes = 0) {
  const guess = dn * DAY + minutes * MIN;
  const t1 = guess - offsetAt(guess);
  return guess - offsetAt(t1);
}

// ---------- civil days: dn = days since 1970-01-01 ----------
const dowOf = dn => new Date(dn * DAY).getUTCDay();
const civ = dn => { const d = new Date(dn * DAY); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay() }; };
const dnOf = (y, m, d) => Date.UTC(y, m - 1, d) / DAY;
const dnFromISO = s => { const [y, m, d] = s.split('-').map(Number); return dnOf(y, m, d); };
const isoOf = dn => { const c = civ(dn); return `${c.y}-${pad(c.m)}-${pad(c.d)}`; };
const pad = n => String(n).padStart(2, '0');

// ---------- holidays (S-6) ----------
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return dnOf(y, month, day);
}
const holidayCache = new Map();
function holidays(y) {
  if (holidayCache.has(y)) return holidayCache.get(y);
  const e = easter(y);
  const list = [
    [dnOf(y, 1, 1), 'Nowy Rok'],
    [dnOf(y, 1, 6), 'Trzech Króli'],
    [e, 'Wielkanoc'],
    [e + 1, 'Poniedziałek Wielkanocny'],
    [dnOf(y, 5, 1), 'Święto Pracy'],
    [dnOf(y, 5, 3), 'Święto Konstytucji 3 Maja'],
    [e + 49, 'Zielone Świątki'],
    [e + 60, 'Boże Ciało'],
    [dnOf(y, 8, 15), 'Wniebowzięcie NMP'],
    [dnOf(y, 11, 1), 'Wszystkich Świętych'],
    [dnOf(y, 11, 11), 'Narodowe Święto Niepodległości'],
    ...(y >= 2025 ? [[dnOf(y, 12, 24), 'Wigilia']] : []),
    [dnOf(y, 12, 25), 'Boże Narodzenie'],
    [dnOf(y, 12, 26), 'Drugi dzień Bożego Narodzenia'],
  ].sort((a, b) => a[0] - b[0]);
  const map = new Map(list);
  holidayCache.set(y, map);
  return map;
}
const holidayName = dn => holidays(civ(dn).y).get(dn) || null;

// ---------- service windows (S-3) ----------
// win: { biz: { from, to }, day: { from, to } } in minutes since midnight; open at `from`, closed at `to`
const DEFAULT_WINDOWS = { biz: { from: 9 * 60, to: 17 * 60 }, day: { from: 10 * 60, to: 22 * 60 } };
const isBizDay = dn => { const w = dowOf(dn); return w >= 1 && w <= 5 && !holidayName(dn); };
const isOpenDay = (dn, kind) => kind === 'day' || isBizDay(dn);
function windowOn(dn, kind, win) {
  if (!isOpenDay(dn, kind)) return null;
  return [fromW(dn, win[kind].from), fromW(dn, win[kind].to)];
}

// ---------- rules (S-2) ----------
const PRIORITIES = ['Krytyczny', 'Wysoki', 'Normalny'];
const PACKAGES = ['Basic', 'Standard', 'Premium'];
const RULES = {
  Basic:    { Krytyczny: { bd: 1 }, Wysoki: { bd: 2 }, Normalny: { bd: 5 } },
  Standard: { Krytyczny: { h: 4, win: 'biz' }, Wysoki: { bd: 1 }, Normalny: { bd: 3 } },
  Premium:  { Krytyczny: { h: 2, win: 'day' }, Wysoki: { h: 4, win: 'biz' }, Normalny: { bd: 2 } },
};
const WIN_NAME = { biz: 'dni roboczych', day: 'codziennym' };
function ruleLabel(r) {
  if (r.h) return `${r.h} h w oknie ${WIN_NAME[r.win]}`;
  return `${r.bd} ${plural(r.bd, 'dzień roboczy', 'dni robocze', 'dni roboczych')}`;
}

// "N h w oknie" (S-4): only time inside the window counts; outside it the clock starts at the next opening
function addWindowHours(start, hours, kind, win) {
  let left = hours * HOUR;
  for (let dn = wParts(start).dn, i = 0; i < 800; dn++, i++) {
    const w = windowOn(dn, kind, win);
    if (!w) continue;
    const s = Math.max(start, w[0]);
    if (s >= w[1]) continue;
    if (w[1] - s >= left) return s + left;
    left -= w[1] - s;
  }
  return NaN;
}
// "N dni roboczych" (S-5): closing of the business window on the N-th business day after the day of receipt
function addBizDays(start, n, win) {
  let count = 0;
  for (let dn = wParts(start).dn + 1, i = 0; i < 800; dn++, i++) {
    if (isBizDay(dn) && ++count === n) return fromW(dn, win.biz.to);
  }
  return NaN;
}
function reactionDeadline(receivedAt, pkg, priority, win) {
  const r = RULES[pkg][priority];
  return r.h ? addWindowHours(receivedAt, r.h, r.win, win) : addBizDays(receivedAt, r.bd, win);
}

// Day-by-day trace for the ticket view: which window time was counted towards the deadline
function deadlineTrace(receivedAt, pkg, priority, win) {
  const r = RULES[pkg][priority];
  const deadline = reactionDeadline(receivedAt, pkg, priority, win);
  const kind = r.h ? r.win : 'biz';
  const first = wParts(receivedAt).dn, last = wParts(deadline).dn;
  const days = [];
  let bd = 0;
  for (let dn = first; dn <= last && days.length < 40; dn++) {
    const w = windowOn(dn, kind, win);
    let counted = null, n = null;
    if (r.h && w) {
      const s = Math.max(receivedAt, w[0]), e = Math.min(deadline, w[1]);
      if (e > s) counted = [s, e];
    } else if (!r.h && dn > first && isBizDay(dn)) {
      n = ++bd;
      if (n === r.bd) counted = [w[0], w[1]];
    }
    days.push({ dn, w, counted, n, holiday: holidayName(dn), dow: dowOf(dn) });
  }
  return { rule: r, kind, deadline, days };
}

// ---------- SLA state (S-9) ----------
function slaState(t, now) {
  if (t.reactedAt == null) {
    return now <= t.deadline
      ? { k: 'left', text: `Zostało ${fmtDur(t.deadline - now, 'ceil')}` }
      : { k: 'overdue', text: 'Po terminie' };
  }
  return t.reactedAt <= t.deadline
    ? { k: 'ok', text: 'W terminie' }
    : { k: 'late', text: `Spóźniona o ${fmtDur(t.reactedAt - t.deadline)}` };
}
const isWindowOpen = (now, kind, win) => { const w = windowOn(wParts(now).dn, kind, win); return !!w && now >= w[0] && now < w[1]; };

// ---------- formats ----------
function plural(n, one, few, many) { const d = n % 10, h = n % 100; return n === 1 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many; }
const DOW_SHORT = ['ndz', 'pn', 'wt', 'śr', 'czw', 'pt', 'sob'];
const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const fmtD = ms => { const p = wParts(ms); return `${pad(p.d)}.${pad(p.m)}.${p.y}`; };
const fmtT = ms => { const p = wParts(ms); return `${pad(p.hh)}:${pad(p.mi)}`; };
const fmtDT = ms => `${fmtD(ms)} ${fmtT(ms)}`;
const fmtDTdow = ms => `${DOW_SHORT[wParts(ms).dow]} ${fmtDT(ms)}`;
const fmtDn = dn => { const c = civ(dn); return `${pad(c.d)}.${pad(c.m)}.${c.y}`; };
const fmtMin = m => `${Math.floor(m / 60)}:${pad(m % 60)}`;
const fmtHours = n => String(+(+n).toFixed(2)).replace('.', ',');
function fmtMoney(n) {
  const [i, f] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + f + ' zł';
}
function fmtDur(ms, mode = 'round') {
  const m = Math[mode](ms / MIN), h = Math.floor(m / 60), r = m % 60;
  return h && r ? `${h} h ${r} min` : h ? `${h} h` : `${r} min`;
}
// <input type="datetime-local"> value, read and written in Warsaw time whatever the browser's zone
const toLocalInput = ms => { const p = wParts(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mi)}`; };
function fromLocalInput(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || '');
  return m ? fromW(dnOf(+m[1], +m[2], +m[3]), +m[4] * 60 + +m[5]) : NaN;
}
const parseHHMM = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : NaN; };

// ---------- contract: the examples table from S, each row a unit test ----------
const SLA_EXAMPLES = [
  ['Standard', 'Krytyczny', '2026-11-06T16:00', '2026-11-09T12:00', 'przejście przez weekend'],
  ['Standard', 'Krytyczny', '2026-11-10T15:00', '2026-11-12T11:00', '11.11 święto'],
  ['Standard', 'Krytyczny', '2026-11-09T17:00', '2026-11-10T13:00', 'przyjęte na zamknięciu okna'],
  ['Premium', 'Krytyczny', '2026-11-07T08:00', '2026-11-07T12:00', 'przed otwarciem okna'],
  ['Premium', 'Krytyczny', '2026-11-07T21:30', '2026-11-08T11:30', 'reszta czasu następnego dnia'],
  ['Premium', 'Krytyczny', '2026-10-24T21:00', '2026-10-25T11:00', 'zmiana czasu na zimowy w nocy'],
  ['Basic', 'Krytyczny', '2026-11-06T10:00', '2026-11-09T17:00', 'następny dzień roboczy'],
  ['Basic', 'Wysoki', '2026-11-10T09:00', '2026-11-13T17:00', 'dni robocze ze świętem'],
  ['Basic', 'Normalny', '2026-12-22T10:00', '2026-12-31T17:00', '24–26.12 wolne'],
];
