// Osłuch v1 — the mock's "backend": one localStorage document shared by every open tab, so a patient tab and
// a doctor tab see each other's changes (booking, joining the waiting room, the call, issued documents).

const DB_KEY = 'osluch-v1';
const TAB = Math.random().toString(36).slice(2, 8);
const SLOT = 20 * MIN;
const BOOKABLE_DAYS = 5;

function freshDb() {
  return { visits: [], docs: [], session: {}, seedDay: null };
}

function loadDb() {
  const d = Object.assign(freshDb(), store.get(DB_KEY, {}));
  if (d.seedDay !== isoDay(Date.now())) reseed(d);
  return d;
}

let db = loadDb();
const saveDb = () => store.set(DB_KEY, db);

// Every write re-reads first, so two tabs don't overwrite each other's changes.
function mutate(fn) {
  db = loadDb();
  const r = fn(db);
  saveDb();
  return r;
}

// ---------- seed: today's schedule of other patients ----------
function reseed(d) {
  const base = Math.floor(Date.now() / (10 * MIN)) * 10 * MIN;
  d.visits = d.visits.filter(v => !v.seed);
  d.docs = d.docs.filter(x => !x.seed);
  SEED_VISITS.forEach((s, i) => {
    const v = {
      id: 'S' + (i + 1), seed: true, patientId: s.patient, doctorId: null, reason: null, reasonLabel: s.reasonLabel,
      type: s.type, at: base + s.at * MIN, status: s.status, brief: s.brief, consentAI: true, docs: [], aiLog: [],
    };
    if (s.status === 'done') {
      v.startedAt = v.at + 2 * MIN;
      v.endedAt = v.startedAt + s.dur * MIN;
      v.note = Object.fromEntries(NOTE_SECTIONS.map(([k]) => [k, { text: s.note[k], state: 'approved' }]));
      v.aiLog = s.aiLog.map((text, j) => ({ t: v.startedAt + (j + 2) * MIN, text }));
      const doc = makeRx({ visit: v, items: s.rx, signedAt: v.endedAt - MIN, seed: true });
      d.docs.push(doc);
      v.docs.push(doc.id);
    }
    d.visits.push(v);
  });
  d.seedDay = isoDay(Date.now());
  store.set(DB_KEY, d);
}

// ---------- lookups ----------
const visitById = id => db.visits.find(v => v.id === id);
const docById = id => db.docs.find(x => x.id === id);
const patientById = id => PATIENTS.find(p => p.id === id);
const doctorById = id => DOCTORS.find(d => d.id === id);
const docsOf = v => (v.docs || []).map(docById).filter(Boolean);
const scenarioOf = v => (v.reason ? SCENARIOS[v.reason] : null);
const reasonOf = v => v.reasonLabel || scenarioOf(v)?.label || 'Konsultacja';
const currentPatient = () => (db.session.patient ? patientById(db.session.patient) : null);
const currentDoctor = () => (db.session.doctor ? doctorById(db.session.doctor) : null);

function patientVisits(pid) {
  return db.visits.filter(v => v.patientId === pid && !v.seed).sort((a, b) => b.at - a.at);
}
function doctorVisits(did) {
  return db.visits.filter(v => v.doctorId === did || (v.seed && !v.doctorId)).sort((a, b) => a.at - b.at);
}
function patientDocs(pid, kind) {
  return db.docs.filter(x => x.patientId === pid && (!kind || x.kind === kind)).sort((a, b) => b.signedAt - a.signedAt);
}

// ---------- slots ----------
// Free slots every 20 minutes, 8:00–20:00. Some are "taken" by a stable pseudo-random pattern so the grid looks lived-in.
function hash(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
function slotsFor(doctorId, dayOffset) {
  const day = startOfDay(Date.now() + dayOffset * DAY);
  const taken = new Set(db.visits.filter(v => v.doctorId === doctorId && v.status !== 'cancelled').map(v => v.at));
  const out = [];
  for (let t = day + 8 * 60 * MIN; t < day + 20 * 60 * MIN; t += SLOT) {
    if (t < Date.now() + 5 * MIN) continue;
    const busy = taken.has(t) || hash(doctorId + t) < (dayOffset === 0 ? 0.35 : 0.5);
    out.push({ at: t, free: !busy });
  }
  return out;
}
function nextSlot(doctorId) {
  for (let d = 0; d < BOOKABLE_DAYS; d++) {
    const s = slotsFor(doctorId, d).find(x => x.free);
    if (s) return s.at;
  }
  return null;
}
function soonest() {
  return DOCTORS.map(d => ({ doctor: d, at: nextSlot(d.id) })).filter(x => x.at).sort((a, b) => a.at - b.at)[0];
}

// ---------- sessions ----------
function login(role, id) { mutate(d => { d.session[role] = id; }); }
function logout(role) { mutate(d => { delete d.session[role]; }); }

// ---------- visits ----------
function newCall() {
  return { done: 0, curStart: null, curDur: 0, paused: false, ended: false, driver: null, beat: 0, auto: false };
}

function bookVisit(draft, patientId) {
  const v = {
    id: 'W-' + uid().slice(0, 4), patientId, doctorId: draft.doctorId, reason: draft.reason, type: draft.type,
    at: draft.at, status: 'booked', answers: draft.answers, free: draft.free || '', consentAI: draft.consentAI,
    pay: draft.pay, createdAt: Date.now(), docs: [], aiLog: [], note: null, call: newCall(), asked: {},
  };
  mutate(d => { d.visits.push(v); });
  return v;
}

// Demo shortcut on the doctor side: Anna in the waiting room with the sore-throat questionnaire already filled in.
function addSampleVisit(doctorId, reason = 'gardlo') {
  const sc = SCENARIOS[reason];
  const answers = Object.fromEntries(sc.questions.map(q => [q.id, q.def]));
  const v = bookVisit({
    doctorId, reason, type: sc.prefer === 'video' ? 'video' : 'phone', at: Math.ceil(Date.now() / (5 * MIN)) * 5 * MIN,
    answers, consentAI: true, pay: { method: 'blik', amount: VISIT_TYPES[sc.prefer === 'video' ? 'video' : 'phone'].price },
  }, 'anna');
  mutate(d => { const x = d.visits.find(y => y.id === v.id); x.status = 'waiting'; x.joinedAt = Date.now(); });
  return v.id;
}

function updateVisit(id, fn) {
  return mutate(d => {
    const v = d.visits.find(x => x.id === id);
    if (v) fn(v, d);
    return v;
  });
}

function logAI(id, text) {
  updateVisit(id, v => { (v.aiLog = v.aiLog || []).push({ t: Date.now(), text }); });
}

// ---------- documents ----------
// Codes are random: a 4-digit access code per prescription package, a 44-digit access key per prescription.
function rxValidity(items) {
  return items.map(it => {
    const drug = drugById(it.drug);
    const from = it.from ? fromIso(it.from) : startOfDay(Date.now());
    const days = drug.cls.includes('antibiotic') ? 7 : (it.days || 0) > 120 ? 365 : 30;
    return Object.assign({}, it, { fromTs: from, validTo: from + (days - 1) * DAY, validDays: days });
  });
}

function makeRx({ visit, items, signedAt = Date.now(), seed = false, method = 'zus' }) {
  return {
    id: 'D-' + uid(), kind: 'rx', seed, visitId: visit.id, patientId: visit.patientId, doctorId: visit.doctorId || 'nowak',
    signedAt, method, code: digits(4),
    items: rxValidity(items).map(it => Object.assign(it, { key: digits(44) })),
    filled: false,
  };
}

function issueDoc(visitId, doc) {
  return mutate(d => {
    const v = d.visits.find(x => x.id === visitId);
    d.docs.push(doc);
    v.docs = (v.docs || []).concat(doc.id);
    return doc;
  });
}

function sigLabel(item) {
  const drug = drugById(item.drug);
  if (item.sig) return item.sig;
  if (drug.topical) return item.extra || 'zgodnie z zaleceniem lekarza';
  const each = `${String(item.dose).replace('.', ',')} ${drug.unit}`;
  const how = item.days === 1 && item.freq === 1 ? `${each} jednorazowo` : `${each} ${item.freq}× dziennie przez ${dni(item.days)}`;
  return how + (item.extra ? `, ${item.extra}` : '');
}
