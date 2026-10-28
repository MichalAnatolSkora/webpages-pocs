// Osłuch v1 — the "AI": replays the scenario's scripted events up to the current line to get what the assistant
// knows right now (facts, red flags, score, differential, open questions, plan). Prescription checks below are
// plain rules over the drug list — deliberately not generative, so they are the same every time.

const LVL = ['wykluczone', 'niskie', 'średnie', 'wysokie'];
const TYPE_WORD = { video: 'wideo', phone: 'telefon', chat: 'czat' };

function tokensFor(v) {
  const dr = doctorById(v.doctorId) || DOCTORS[0];
  const seen = v.type === 'video';
  return {
    dr: dr.name, spec: dr.short, type: TYPE_WORD[v.type],
    exam: seen ? 'ocena w obrazie wideo' : 'na zdjęciu przesłanym przez pacjentkę',
    look: seen ? 'Poproś o pokazanie gardła do kamery — naloty, obrzęk migdałków' : 'Poproś o zdjęcie gardła z latarką — naloty, obrzęk migdałków',
    lookLine: seen
      ? 'Proszę zbliżyć telefon, szeroko otworzyć usta i powiedzieć „aaa”. Dobrze… migdałki są powiększone, zaczerwienione, z białym nalotem.'
      : 'Proszę zrobić latarką zdjęcie gardła i wysłać je w aplikacji. Mam… migdałki są powiększone, zaczerwienione, z białym nalotem.',
  };
}
const fill = (s, tok) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in tok ? tok[k] : m));

// Script lines with tokens filled in and a stable "conversation clock" (natural speech time, not playback time).
const naturalMs = t => 1200 + t.length * 55;
function scriptFor(v) {
  const sc = scenarioOf(v);
  if (!sc) return [];
  const tok = tokensFor(v);
  let ts = 0;
  return sc.script.map((l, i) => {
    const t = fill(l.t, tok);
    const line = Object.assign({}, l, { i, t, ts });
    ts += naturalMs(t);
    return line;
  });
}
const scriptLength = lines => (lines.length ? lines[lines.length - 1].ts + naturalMs(lines[lines.length - 1].t) : 0);

function aiState(v, upTo) {
  const sc = scenarioOf(v), pt = patientById(v.patientId), tok = tokensFor(v), a = v.answers || {};
  const s = sc.ai(a, pt);
  s.facts = s.facts.map(([cat, text, src]) => ({ cat, text: fill(text, tok), src }));
  s.qs.forEach(q => { q.text = fill(q.text, tok); q.done = null; });
  s.flags.forEach(f => { f.st = 'self'; f.src = 'ankieta'; });
  s.alerts = [];
  s.plan = false;
  s.docs = {};
  pt.allergies.forEach(al => s.facts.push({ cat: 'Alergie', text: `${al.name}: ${al.reaction} (${al.year})`, src: 'karta' }));
  pt.conditions.forEach(c => s.facts.push({ cat: 'Wywiad', text: `${c.name} (${c.icd}) od ${c.since} r.`, src: 'karta' }));

  const lines = v.consentAI ? scriptFor(v) : [];
  for (let i = 0; i < Math.min(upTo, lines.length); i++) {
    const e = lines[i].ai;
    if (!e) continue;
    (e.facts || []).forEach(([cat, text]) => s.facts.push({ cat, text: fill(text, tok), src: i }));
    Object.entries(e.score || {}).forEach(([id, val]) => { const it = s.score.items.find(x => x.id === id); if (it) Object.assign(it, { val, src: i }); });
    Object.entries(e.ddx || {}).forEach(([id, lvl]) => { const d = s.ddx.find(x => x.id === id); if (d) Object.assign(d, { lvl, src: i }); });
    Object.entries(e.flags || {}).forEach(([id, st]) => { const f = s.flags.find(x => x.id === id); if (f) Object.assign(f, { st, src: i }); });
    (e.ask || []).forEach(id => { const q = s.qs.find(x => x.id === id); if (q) q.done = i; });
    (e.alerts || []).forEach(fn => { const msg = fn(a); if (msg) s.alerts.push({ text: msg, src: i }); });
    if (e.plan) s.plan = true;
    (e.docs || []).forEach(k => { s.docs[k] = i; });
  }
  // the doctor can tick questions off by hand
  Object.keys(v.asked || {}).forEach(id => { const q = s.qs.find(x => x.id === id); if (q && q.done == null) q.done = 'lekarz'; });

  const known = s.score.items.filter(x => x.val != null);
  s.score.total = known.reduce((t, x) => t + x.val, 0);
  s.score.missing = s.score.items.filter(x => x.val == null).map(x => x.label.replace(/ \(.*\)$/, ''));
  s.score.failed = s.score.kind === 'all' ? s.score.items.filter(x => x.val === 0).map(x => x.label) : [];
  s.score.verdict = s.score.interpret(s.score.total, s.score.missing, s.score.failed);
  s.ddx.sort((x, y) => y.lvl - x.lvl);
  return s;
}

// Which note sections the AI can already draft at this point of the conversation.
function noteDraft(v, upTo) {
  const sc = scenarioOf(v), tok = tokensFor(v), total = scriptFor(v).length;
  const out = {};
  NOTE_SECTIONS.forEach(([k]) => {
    const n = sc.note[k];
    out[k] = v.consentAI && (upTo > n.after || upTo >= total) ? fill(n.text, tok) : null;
  });
  return out;
}

// ---------- prescription checks ----------
const SEV = { block: 4, major: 3, moderate: 2, minor: 1, info: 0, ok: -1 };
const SEV_LABEL = { block: 'Przeciwwskazanie', major: 'Poważne', moderate: 'Umiarkowane', minor: 'Drobne', info: 'Informacja', ok: 'Bez uwag' };

function neededUnits(it) {
  const drug = drugById(it.drug);
  if (drug.topical) return null;
  return Math.ceil(it.dose * it.freq * it.days);
}

function rxChecks(items, pt, v) {
  const sc = v ? scenarioOf(v) : null;
  const age = ageOf(pt.born);
  const current = pt.meds.map(m => drugById(m.drug)).filter(Boolean);
  return items.map((it, idx) => {
    const drug = drugById(it.drug), out = [];
    // allergies: strongest matching rule per allergy
    pt.allergies.forEach(al => {
      const hits = ALLERGY_RULES.filter(r => al.cls.includes(r.allergy) && drug.cls.includes(r.drug)).sort((a, b) => SEV[b.lvl] - SEV[a.lvl]);
      if (hits[0]) out.push({ lvl: hits[0].lvl, kind: 'Alergia', text: hits[0].text.replace('{reaction}', al.reaction) });
    });
    // interactions with the patient's regular meds and with the other positions
    const others = current.filter(d => d.id !== drug.id).map(d => ({ d, from: 'leki na stałe' }))
      .concat(items.filter((x, j) => j !== idx).map(x => ({ d: drugById(x.drug), from: 'ta recepta' })));
    others.forEach(({ d, from }) => {
      INTERACTIONS.filter(r => (drug.cls.includes(r.a) && d.cls.includes(r.b)) || (drug.cls.includes(r.b) && d.cls.includes(r.a)))
        .forEach(r => out.push({ lvl: r.lvl, kind: 'Interakcja', text: `${d.inn} (${from}): ${r.text}` }));
    });
    // same class twice in one prescription
    items.forEach((x, j) => {
      if (j >= idx) return;
      const d = drugById(x.drug);
      if (d.cls.includes('antibiotic') && drug.cls.includes('antibiotic')) out.push({ lvl: 'moderate', kind: 'Duplikacja', text: `Drugi antybiotyk w recepcie (${d.inn}). Upewnij się, że to zamierzone.` });
      else if (d.id === drug.id) out.push({ lvl: 'moderate', kind: 'Duplikacja', text: 'Ten sam lek jest już na recepcie.' });
    });
    if (current.some(d => d.id === drug.id)) out.push({ lvl: 'info', kind: 'Kontynuacja', text: 'Pacjent przyjmuje ten lek na stałe — kontynuacja leczenia.' });
    // dose and duration
    if (!drug.topical) {
      const perDay = it.dose * it.freq;
      if (drug.maxUnits && perDay > drug.maxUnits) out.push({ lvl: 'major', kind: 'Dawka', text: `Dawka dobowa ${perDay} ${drug.unit} przekracza maksymalną (${drug.maxUnits} ${drug.unit}).` });
      const exp = sc?.plan.expect || {};
      if (drug.cls.includes('antibiotic') && exp.antibiotic && it.days !== exp.antibiotic) out.push({ lvl: 'moderate', kind: 'Czas leczenia', text: `W paciorkowcowym zapaleniu migdałków zalecane jest ${exp.antibiotic} dni antybiotyku (teraz: ${dni(it.days)}).` });
      if (exp[drug.id] && it.days !== exp[drug.id]) out.push({ lvl: 'moderate', kind: 'Czas leczenia', text: `${drug.inn} w zapaleniu pęcherza: dawka jednorazowa (teraz: ${dni(it.days)}).` });
      const need = neededUnits(it), have = it.qty * it.pack;
      if (need && have < need) out.push({ lvl: 'moderate', kind: 'Ilość', text: `${opak(it.qty)} × ${it.pack} ${drug.unit} nie wystarczy na cały kurs (potrzeba ${need} ${drug.unit}).` });
      else if (need && drug.cls.includes('antibiotic') && have - need >= it.pack) out.push({ lvl: 'info', kind: 'Ilość', text: `Zapas większy niż kurs (${have} ${drug.unit} przy potrzebnych ${need}).` });
      if (it.days > 360) out.push({ lvl: 'major', kind: 'Ilość', text: 'Na jednej recepcie można przepisać lek na maksymalnie 360 dni kuracji.' });
    }
    if (age >= 65 && drug.refund.includes('S') && it.refund !== 'S') out.push({ lvl: 'info', kind: 'Odpłatność', text: 'Pacjent 65+: lek jest na liście S — może go dostać bezpłatnie.' });
    if (age < 18 && it.refund !== 'DZ') out.push({ lvl: 'info', kind: 'Odpłatność', text: 'Pacjent poniżej 18 lat: sprawdź uprawnienie DZ.' });
    out.sort((a, b) => SEV[b.lvl] - SEV[a.lvl]);
    if (!out.length) out.push({ lvl: 'ok', kind: 'Kontrola', text: 'Bez interakcji z lekami i alergiami z karty pacjenta.' });
    return out;
  });
}
const worst = checks => checks.reduce((w, c) => (SEV[c.lvl] > SEV[w] ? c.lvl : w), 'ok');
