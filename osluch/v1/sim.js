// Osłuch v1 — the simulated call. Plays the scenario's dialogue line by line and writes progress into the shared
// visit, so the doctor tab (transcript + AI) and the patient tab (captions) stay in step. Exactly one tab drives:
// the doctor's consultation room always claims it; a patient tab drives only in "simulate the doctor" mode.

const BEAT_STALE = 2600;
const SPEEDS = [1, 2, 4];
let playSpeed = store.get('osluch-speed', 2);

const playMs = t => naturalMs(t) / playSpeed;

// Where the conversation is right now, as both sides render it.
function callPos(v) {
  const c = v.call || newCall();
  const lines = scriptFor(v);
  const cur = lines[c.done];
  let prog = 0;
  if (cur && c.curStart) prog = Math.min(1, ((c.paused ? c.pausedAt : Date.now()) - c.curStart) / (c.curDur || 1));
  const clock = cur ? cur.ts + prog * naturalMs(cur.t) : scriptLength(lines);
  return { lines, done: c.done, cur: c.ended ? null : cur, prog, clock, ended: c.ended, paused: c.paused };
}

function startCall(id, { auto = false } = {}) {
  updateVisit(id, v => {
    if (v.status === 'active' || v.status === 'done') return;
    v.status = 'active';
    v.startedAt = Date.now();
    v.call = Object.assign(newCall(), { auto, driver: TAB, beat: Date.now() });
  });
}

function createPlayer(id, { claim = false, onFrame, onLine, onEnd } = {}) {
  let lastDone = -1, lastBeat = 0, endedSeen = false, timer = null;

  if (claim) updateVisit(id, v => { if (v.call) Object.assign(v.call, { driver: TAB, beat: Date.now(), auto: false }); });

  const mine = c => c.driver === TAB || !c.beat || Date.now() - c.beat > BEAT_STALE;

  function step() {
    const v = visitById(id);
    if (!v || v.status !== 'active' || !v.call) { onFrame && v && onFrame(v); return; }
    const c = v.call, now = Date.now();
    const drives = (claim || c.auto) && mine(c);
    if (drives && !c.ended && !c.paused) {
      const lines = scriptFor(v);
      if (!c.curStart) {
        updateVisit(id, x => Object.assign(x.call, { curStart: now, curDur: playMs(lines[x.call.done].t), driver: TAB, beat: now }));
      } else if (now - c.curStart >= c.curDur) {
        updateVisit(id, x => {
          const k = x.call;
          k.done++;
          if (k.done >= lines.length) { k.ended = true; k.curStart = null; } else { k.curStart = now; k.curDur = playMs(lines[k.done].t); }
          k.driver = TAB; k.beat = now;
        });
      } else if (now - lastBeat > 900) {
        lastBeat = now;
        updateVisit(id, x => { x.call.beat = now; x.call.driver = TAB; });
      }
    } else if (drives && now - lastBeat > 900) {
      lastBeat = now;
      updateVisit(id, x => { x.call.beat = now; x.call.driver = TAB; });
    }
    const fresh = visitById(id);
    if (fresh.call.done !== lastDone) { lastDone = fresh.call.done; onLine && onLine(fresh); }
    if (fresh.call.ended && !endedSeen) { endedSeen = true; onEnd && onEnd(fresh, drives); }
    onFrame && onFrame(fresh);
  }

  timer = setInterval(step, 120);
  step();

  return {
    stop() { clearInterval(timer); },
    toggle() {
      updateVisit(id, v => {
        const c = v.call, now = Date.now();
        if (c.ended) return;
        if (c.paused) { if (c.curStart) c.curStart += now - c.pausedAt; c.paused = false; }
        else { c.paused = true; c.pausedAt = now; }
      });
      step();
    },
    setSpeed(s) {
      updateVisit(id, v => {
        const c = v.call, now = Date.now();
        if (c.curStart && !c.ended) {
          const p = Math.min(1, ((c.paused ? c.pausedAt : now) - c.curStart) / c.curDur);
          const cur = scriptFor(v)[c.done];
          playSpeed = s;
          c.curDur = playMs(cur.t);
          c.curStart = (c.paused ? c.pausedAt : now) - p * c.curDur;
        }
      });
      playSpeed = s;
      store.set('osluch-speed', s);
      step();
    },
    skip() {
      updateVisit(id, v => { const n = scriptFor(v).length; Object.assign(v.call, { done: n, ended: true, curStart: null, paused: false }); });
      step();
    },
    restart() {
      endedSeen = false;
      updateVisit(id, v => Object.assign(v.call, { done: 0, ended: false, curStart: null, paused: false }));
      step();
    },
  };
}

// The words of the line being spoken, revealed proportionally to its progress.
function partialText(t, prog) {
  const words = t.split(' ');
  return words.slice(0, Math.max(1, Math.ceil(words.length * prog))).join(' ');
}

// A patient-only demo: when nobody runs the doctor's tab, the "doctor" finishes the visit using the AI plan
// as if the doctor had accepted every suggestion.
function autoFinish(id) {
  const v = visitById(id), sc = scenarioOf(v), pt = patientById(v.patientId);
  if (!v || v.status !== 'active') return;
  const main = sc.plan.rx.filter(r => r.main).map(r => {
    const drug = drugById(r.drug), pack = r.pack || drug.packs[0];
    const qty = Math.max(1, Math.ceil(neededUnits({ ...r, pack }) / pack));
    return { drug: r.drug, pack, qty, dose: r.dose, freq: r.freq, days: r.days, extra: r.extra, refund: drug.refund[0], nz: false, from: isoDay(Date.now()) };
  });
  if (main.length) issueDoc(id, makeRx({ visit: v, items: main }));
  if (sc.plan.zla) issueDoc(id, makeZla(v, { from: isoDay(Date.now()), to: isoDay(Date.now() + (sc.plan.zla.days - 1) * DAY), mode: sc.plan.zla.mode, letter: '', icd: noteIcd(sc) }));
  if (sc.plan.ref) issueDoc(id, makeRef(v, { tests: sc.plan.ref.tests, icd: noteIcd(sc), note: sc.plan.ref.note }));
  const draft = noteDraft(v, Infinity);
  updateVisit(id, x => {
    x.note = Object.fromEntries(NOTE_SECTIONS.map(([k]) => [k, { text: draft[k] || '', state: 'approved' }]));
    x.status = 'done';
    x.endedAt = Date.now();
    x.summarySent = true;
    (x.aiLog = x.aiLog || []).push({ t: Date.now(), text: 'Tryb demo: wizytę zakończył symulowany lekarz (przyjęte sugestie AI)' });
  });
  return pt;
}

const noteIcd = sc => sc.note.rozpoznanie.text.match(/^[A-Z]\d{2}(\.\d)?/)?.[0] || '';

function makeZla(v, f) {
  const pt = patientById(v.patientId);
  return { id: 'D-' + uid(), kind: 'zla', visitId: v.id, patientId: v.patientId, doctorId: v.doctorId, signedAt: Date.now(),
    number: 'ZY ' + digits(7), from: f.from, to: f.to, mode: f.mode, letter: f.letter, icd: f.icd, payer: pt.employer };
}
function makeRef(v, f) {
  return { id: 'D-' + uid(), kind: 'ref', visitId: v.id, patientId: v.patientId, doctorId: v.doctorId, signedAt: Date.now(),
    code: digits(4), key: digits(44), tests: f.tests, icd: f.icd, note: f.note || '' };
}
