// Osłuch v1 — patient side: landing, login with an SMS code, booking (reason → questionnaire with triage → time →
// consent and BLIK), the visit itself (confirmation, waiting room, call, summary) and the patient's account.

const app = $('#app');
const DRAFT = 'osluch-v1-draft';

const STATUS = {
  booked: ['Zaplanowana', 'pine'], waiting: ['W poczekalni', 'ok'], active: ['Trwa', 'ok chip--live'],
  done: ['Zakończona', ''], cancelled: ['Odwołana', 'danger'], noshow: ['Nieobecność', 'warn'],
};
const statusChip = v => `<span class="chip chip--${STATUS[v.status][1]}">${STATUS[v.status][0]}</span>`;
const typeChip = t => `<span class="chip">${ic(VISIT_TYPES[t].icon)}${VISIT_TYPES[t].label}</span>`;
const docDoctor = doc => (doc.seed ? currentDoctor() || DOCTORS[0] : doctorById(doc.doctorId));

// ---------- shared bits ----------
function otpField(el, len, onDone) {
  el.innerHTML = Array.from({ length: len }, (_, i) => `<input inputmode="numeric" aria-label="Cyfra ${i + 1}" autocomplete="${i ? 'off' : 'one-time-code'}">`).join('');
  const ins = $$('input', el);
  const check = () => { const v = ins.map(x => x.value).join(''); if (v.length === len) onDone(v); };
  ins.forEach((inp, i) => {
    inp.addEventListener('focus', () => inp.select());
    // one digit per box; a whole code arriving at once (SMS autofill) is spread over the boxes
    inp.addEventListener('input', () => {
      const d = inp.value.replace(/\D/g, '');
      if (d.length > 1) {
        d.split('').slice(0, len - i).forEach((c, j) => { ins[i + j].value = c; });
        ins[Math.min(i + d.length, len) - 1].focus();
      } else {
        inp.value = d;
        if (d && ins[i + 1]) ins[i + 1].focus();
      }
      check();
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && ins[i - 1]) ins[i - 1].focus(); });
    inp.addEventListener('paste', e => {
      const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
      if (!t) return;
      e.preventDefault();
      t.split('').slice(0, len).forEach((c, j) => { ins[j].value = c; });
      ins[Math.min(t.length, len) - 1].focus();
      check();
    });
  });
  setTimeout(() => ins[0].focus(), 50);
  return {
    clear() { ins.forEach(x => { x.value = ''; }); ins[0].focus(); },
    error() { el.classList.remove('otp--err'); void el.offsetWidth; el.classList.add('otp--err'); },
  };
}

function rxCardHtml(doc, { actions = true } = {}) {
  const dr = docDoctor(doc), pt = patientById(doc.patientId);
  const anyAntibiotic = doc.items.some(it => drugById(it.drug).cls.includes('antibiotic'));
  const validTo = Math.min(...doc.items.map(it => it.validTo));
  const total = doc.items.reduce((s, it) => s + patientPrice(drugById(it.drug), it.pack, it.qty, it.refund), 0);
  return `<article class="rxcard">
    <div class="rxcard__top">
      <div><span class="eyebrow" style="color:#bfe0d4">e-Recepta · kod dostępowy</span>
        <div class="rxcard__code">${doc.code}</div>
        <small>W aptece podaj kod i PESEL ${pt.pesel.slice(0, 2)}•••••••${pt.pesel.slice(-2)} · ${opak(doc.items.reduce((s, i) => s + i.qty, 0))}</small></div>
      <span class="chip rxcard__badge ${doc.filled ? '' : 'chip--ok'}">${doc.filled ? 'Zrealizowana' : 'Do realizacji'}</span>
    </div>
    <div class="rxcard__items">${doc.items.map(it => {
      const d = drugById(it.drug);
      return `<div class="rxitem"><span class="rxitem__ic">${ic('pill')}</span>
        <div><b>${esc(drugLabel(d))}</b><small>${esc(d.form)} · ${it.qty} × ${it.pack} ${d.unit}${it.nz ? ' · nie zamieniać' : ''}</small><small>${esc(sigLabel(it))}</small>
          <small class="muted">Ważna do ${fmtDMY(it.validTo)}${d.cls.includes('antibiotic') ? ' (antybiotyk — 7 dni)' : it.validDays > 30 ? ' (realizacja w częściach)' : ''}</small></div>
        <div class="rxitem__price">${REFUNDS[it.refund]}<br><b>~${zl(patientPrice(d, it.pack, it.qty, it.refund))}</b></div></div>`;
    }).join('')}</div>
    <div class="rxcard__foot"><span class="muted">${esc(dr.full)} · ${fmtWhen(doc.signedAt)} · razem ok. ${zl(total)}${anyAntibiotic ? ` · zrealizuj do ${fmtDMY(validTo)}` : ''}</span>
      ${actions ? `<button type="button" class="btn btn--ghost btn--sm" data-barcode="${doc.id}">${ic('barcode')}Pokaż w aptece</button>
      <button type="button" class="btn btn--ghost btn--sm" data-print="${doc.id}">${ic('print')}Wydruk</button>` : ''}</div>
  </article>`;
}

function miniDocHtml(doc) {
  if (doc.kind === 'rx') {
    return `<div class="card mini-doc"><span class="mini-doc__ic">${ic('rx')}</span><div><b>e-Recepta · kod ${doc.code}</b>
      <small>${doc.items.map(i => esc(drugLabel(drugById(i.drug)))).join(', ')}</small></div><button type="button" class="btn btn--ghost btn--sm" data-print="${doc.id}">${ic('print')}</button></div>`;
  }
  if (doc.kind === 'zla') {
    const days = Math.round((fromIso(doc.to) - fromIso(doc.from)) / DAY) + 1;
    return `<div class="card mini-doc"><span class="mini-doc__ic">${ic('bed')}</span><div><b>Zwolnienie lekarskie e-ZLA · ${doc.number}</b>
      <small>${fmtDMY(fromIso(doc.from))} – ${fmtDMY(fromIso(doc.to))} (${dni(days)}) · ${doc.mode === '1' ? 'chory powinien leżeć' : 'chory może chodzić'}</small>
      <small class="muted">Wysłane do ZUS i do pracodawcy: ${esc(doc.payer.name)}</small></div><span class="chip chip--ok">${ic('check')}ZUS</span></div>`;
  }
  return `<div class="card mini-doc"><span class="mini-doc__ic">${ic('flask')}</span><div><b>Skierowanie na badania · kod ${doc.code}</b>
    <small>${doc.tests.map(labName).join(', ')}</small>${doc.note ? `<small class="muted">${esc(doc.note)}</small>` : ''}</div><button type="button" class="btn btn--ghost btn--sm" data-print="${doc.id}">${ic('print')}</button></div>`;
}

// The printout a patient can take to the pharmacy or the lab ("informacja o wystawionej e-recepcie").
function sheetHtml(doc) {
  const dr = docDoctor(doc), pt = patientById(doc.patientId);
  const head = `<div class="sheet__grid">
    <div class="sheet__box"><h3>Pacjent</h3><b>${esc(pt.name)}</b><br>PESEL ${pt.pesel}<br>${esc(pt.address || '')}</div>
    <div class="sheet__box"><h3>Wystawca</h3><b>${esc(dr.full)}</b><br>Nr prawa wykonywania zawodu: ${dr.pwz}<br>${CLINIC.legal}, ${CLINIC.address}<br>tel. ${CLINIC.phone}</div></div>`;
  const foot = `<p class="sheet__foot">Wydruk informacyjny z systemu mock „Osłuch”. Dokument fikcyjny — nie jest receptą ani skierowaniem i nie został wysłany do systemu P1. Data wydruku: ${fmtDMY(Date.now())}.</p>`;
  if (doc.kind === 'rx') {
    return `<div class="sheet"><div class="sheet__top"><div><h1>Informacja o wystawionych receptach</h1><p>Data wystawienia: ${fmtDMY(doc.signedAt)}</p></div>
      <div class="sheet__code">Kod dostępu<b>${doc.code}</b></div></div>${head}
      <table><thead><tr><th>#</th><th>Lek</th><th>Ilość</th><th>Dawkowanie</th><th>Odpł.</th><th>Realizacja</th></tr></thead><tbody>
      ${doc.items.map((it, i) => { const d = drugById(it.drug); return `<tr><td>${i + 1}</td><td><b>${esc(d.inn)}</b><br>${esc(d.strength)}, ${esc(d.form)}${it.nz ? '<br>NZ — nie zamieniać' : ''}</td><td>${it.qty} op. × ${it.pack} ${d.unit}</td><td>${esc(sigLabel(it))}</td><td>${it.refund}</td><td>od ${fmtDMY(it.fromTs)}<br>do ${fmtDMY(it.validTo)}</td></tr>
        <tr><td></td><td colspan="5">Klucz dostępu: <span class="mono">${groupDigits(it.key)}</span>${barcodeSvg(it.key)}</td></tr>`; }).join('')}
      </tbody></table>${foot}</div>`;
  }
  return `<div class="sheet"><div class="sheet__top"><div><h1>Skierowanie na badania laboratoryjne</h1><p>Data wystawienia: ${fmtDMY(doc.signedAt)}</p></div>
    <div class="sheet__code">Kod<b>${doc.code}</b></div></div>${head}
    <table><thead><tr><th>#</th><th>Badanie</th></tr></thead><tbody>${doc.tests.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(labName(t))}</td></tr>`).join('')}</tbody></table>
    <p><b>Rozpoznanie:</b> ${esc(doc.icd)} ${esc(icdName(doc.icd))}</p>${doc.note ? `<p><b>Uwagi:</b> ${esc(doc.note)}</p>` : ''}
    <p>Klucz: <span class="mono">${groupDigits(doc.key)}</span></p>${barcodeSvg(doc.key)}${foot}</div>`;
}

function printDoc(id) {
  const doc = docById(id);
  if (!doc) return;
  $('#printRoot').innerHTML = sheetHtml(doc);
  const m = modal({ cls: 'modal--wide', label: 'Wydruk informacyjny', html: `<button class="modal__x" data-close aria-label="Zamknij">${ic('x')}</button>
    <div class="modal__body"><h2 class="modal__title">Wydruk informacyjny</h2><div class="sheet--screen">${sheetHtml(doc)}</div>
    <div class="modal__actions"><button type="button" class="btn btn--ghost" data-close>Zamknij</button><button type="button" class="btn btn--primary" data-go>${ic('print')}Drukuj</button></div></div>` });
  $('[data-go]', m.el).addEventListener('click', () => window.print());
}

function showBarcode(id) {
  const doc = docById(id), pt = patientById(doc.patientId);
  modal({ label: 'Kod e-recepty', html: `<button class="modal__x" data-close aria-label="Zamknij">${ic('x')}</button>
    <div class="modal__body"><h2 class="modal__title">Pokaż farmaceucie</h2>
    <div class="big-code"><span class="eyebrow">Kod dostępowy</span><b>${doc.code}</b><span class="muted">PESEL ${pt.pesel}</span></div>
    ${doc.items.map(it => `<div><small class="muted">${esc(drugLabel(drugById(it.drug)))}</small>${barcodeSvg(it.key)}</div>`).join('')}
    <p class="muted" style="font-size:13.5px">Farmaceuta może też zeskanować klucz z wydruku albo odczytać receptę z Twojego numeru PESEL i kodu.</p></div>` });
}

document.addEventListener('click', e => {
  const p = e.target.closest('[data-print]');
  if (p) printDoc(p.dataset.print);
  const b = e.target.closest('[data-barcode]');
  if (b) showBarcode(b.dataset.barcode);
});

// ---------- landing ----------
function viewHome() {
  const s = soonest(), dr = DOCTORS[0], an = PATIENTS[0];
  app.innerHTML = `
  <section class="hero"><div class="wrap hero__in">
    <div>
      <p class="eyebrow">Internista online · wideo, telefon, czat</p>
      <h1 style="margin-top:14px">Lekarz, który <em>słucha.</em><br>Dziś, nie za trzy tygodnie.</h1>
      <p class="hero__lead">Porozmawiaj z internistą bez wychodzenia z domu. e-Recepta, zwolnienie i skierowanie na badania od ręki — a notatki za lekarza robi asystent AI, więc lekarz patrzy na Ciebie, nie w klawiaturę.</p>
      <div class="hero__cta"><a class="btn btn--primary btn--lg" href="#/umow">Umów wizytę ${ic('arrow')}</a>
        <a class="btn btn--ghost btn--lg" href="#/" data-scroll="jak">Jak to działa</a></div>
      ${s ? `<p class="hero__next"><span class="dot"></span>Najbliższy wolny termin: <b>${fmtWhen(s.at)}</b> · ${esc(s.doctor.full)}</p>` : ''}
      <div class="trust"><span>${ic('shield')}Lekarze z prawem wykonywania zawodu</span><span>${ic('rx')}e-Recepta i e-ZLA w systemach państwowych</span><span>${ic('lock')}Dane szyfrowane, serwery w UE</span></div>
    </div>
    <div class="hero__art"><div class="phone">
      <div class="phone__screen is-talking">${feedSvg(dr, 'doctor')}
        <div class="phone__self">${feedSvg(an, 'patient')}</div>
        <div class="phone__bar"><div class="phone__cap">„Czy wyczuwa Pani bolesne guzki z przodu szyi, pod żuchwą?”</div>
          <div class="phone__ctl"><span>${ic('mic')}</span><span>${ic('video')}</span><span>${ic('hang')}</span></div></div>
      </div>
      <div class="float-card float-card--rx"><span class="float-icon">${ic('rx')}</span><div><small class="muted">e-Recepta · kod</small><span class="code">4821</span></div></div>
      <div class="float-card float-card--ai">${ic('spark')}<div><b>Notatka z wizyty gotowa</b><small class="muted">lekarz ją sprawdza i podpisuje</small></div></div>
    </div></div>
  </div></section>

  <section class="section" id="jak"><div class="wrap">
    <div class="section__h"><p class="eyebrow">Jak to działa</p><h2>Cztery kroki, zwykle kwadrans</h2></div>
    <ol class="steps4">
      <li><b>Opisz, co się dzieje</b><p>Krótka ankieta, ok. 2 minuty. Jeśli objawy wymagają pomocy na miejscu, powiemy Ci to od razu.</p></li>
      <li><b>Wybierz lekarza i godzinę</b><p>Internista dziś, często w ciągu kwadransa. Wideo, telefon albo czat.</p></li>
      <li><b>Porozmawiaj</b><p>Lekarz zna już Twoją ankietę i historię, więc od razu przechodzi do rzeczy.</p></li>
      <li><b>Odbierz dokumenty</b><p>Kod e-recepty przychodzi SMS-em, zwolnienie trafia do ZUS, a zalecenia masz w aplikacji.</p></li>
    </ol>
    <div class="ai-band">
      <div><span class="chip chip--ai">${ic('spark')}Asystent AI</span><h2 style="margin-top:14px">Lekarz patrzy na Ciebie, nie w klawiaturę</h2>
        <p>Za Twoją zgodą asystent AI zamienia rozmowę na notatkę i podpowiada lekarzowi, o co jeszcze dopytać. Sprawdza też, czy przepisany lek nie gryzie się z Twoimi alergiami i lekami.</p></div>
      <ul>
        <li>${ic('user')}<div><b>Decyzje podejmuje lekarz</b>AI niczego nie wystawia ani nie podpisuje — każdą podpowiedź lekarz akceptuje albo odrzuca.</div></li>
        <li>${ic('ear')}<div><b>Nie nagrywamy rozmów</b>Nie zapisujemy nagrań. Tekst rozmowy jest usuwany po zatwierdzeniu notatki.</div></li>
        <li>${ic('shield')}<div><b>Możesz się nie zgodzić</b>Bez zgody wizyta wygląda tak samo — lekarz po prostu pisze notatkę sam.</div></li>
      </ul>
    </div>
  </div></section>

  <section class="section" id="lekarze"><div class="wrap">
    <div class="section__h"><p class="eyebrow">Lekarze</p><h2>Interniści, którzy konsultują online na co dzień</h2></div>
    <div class="docs-grid">${DOCTORS.map(d => { const n = nextSlot(d.id); return `<article class="doc-card">${avatar(d, 64)}
      <div><div class="doc-card__name">${esc(d.full)}</div><div class="doc-card__spec">${esc(d.spec)}</div></div>
      <div class="doc-card__meta"><span class="stars">${ic('star')}${String(d.rating).replace('.', ',')}</span><span class="chip">${d.reviews} opinii</span><span class="chip">${d.langs.join(', ')}</span></div>
      <p style="font-size:14px;color:var(--ink-2)">${esc(d.bio)}</p>
      <div class="doc-card__next"><span>${n ? 'Wolny: <b>' + fmtWhen(n) + '</b>' : 'Brak terminów'}</span><a class="link-btn" href="#/umow/${d.id}">Umów ${ic('chev')}</a></div></article>`; }).join('')}</div>
  </div></section>

  <section class="section" id="cennik"><div class="wrap">
    <div class="section__h"><p class="eyebrow">Cennik</p><h2>Płacisz za wizytę, nie za abonament</h2></div>
    <div class="prices">${Object.entries(VISIT_TYPES).map(([k, t]) => `<div class="price ${k === 'video' ? 'price--hi' : ''}"><div class="price__t">${ic(t.icon)}${t.label}${k === 'video' ? ' <span class="chip chip--pine">najczęściej wybierana</span>' : ''}</div>
      <div class="price__v">${t.price} zł <small>/ wizyta</small></div><p>${t.note}. e-Recepta, zwolnienie i skierowanie bez dopłat.</p></div>`).join('')}</div>
    <div class="sos">${ic('alert')}<span>Ból w klatce piersiowej, duszność, objawy udaru, utrata przytomności? Nie czekaj na wizytę online — dzwoń</span><b>112</b></div>
  </div></section>

  <section class="section" id="faq"><div class="wrap">
    <div class="section__h"><p class="eyebrow">Pytania</p><h2>Zanim umówisz wizytę</h2></div>
    <div class="faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
  </div></section>`;
}

// ---------- login ----------
let nextHash = null;

function viewLogin() {
  if (currentPatient()) return go(nextHash || '#/konto');
  app.innerHTML = `<div class="auth">
    <aside class="auth__side"><div><a class="logo" href="#/" style="color:#fff">${logoMark('#fff')}<span class="logo__word">osłuch</span></a></div>
      <div><h2>Twoje wizyty, recepty i wyniki w jednym miejscu</h2><p>Zaloguj się, żeby umówić wizytę u internisty i odebrać dokumenty.</p>
        <ul class="auth__list"><li>${ic('rx')}Kody e-recept z ostatnich 12 miesięcy</li><li>${ic('bed')}Zwolnienia lekarskie i skierowania</li><li>${ic('file')}Wyniki badań dla lekarza</li></ul></div>
      <p class="muted" style="color:#9cc4b6">Logowanie dwuetapowe: hasło + kod SMS</p>
      <svg class="auth__deco" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.2">${I.stetho}</svg></aside>
    <div class="auth__main"><div class="auth__box" id="authBox"></div></div></div>`;
  stepPassword();

  function stepPassword(err = '') {
    $('#authBox').innerHTML = `<div><p class="eyebrow">Pacjent</p><h1 style="margin-top:8px">Zaloguj się</h1></div>
      <form class="stack" id="loginForm" novalidate>
        <label class="field"><span>E-mail lub telefon</span><input class="input" name="email" autocomplete="username" required></label>
        <label class="field"><span>Hasło</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
        ${err ? `<p class="field__err">${err}</p>` : ''}
        <button class="btn btn--primary btn--lg btn--block">Dalej</button>
      </form>
      <div class="auth__test"><span>Konto testowe: <b>${PATIENTS[0].email}</b></span><button type="button" class="link-btn" id="fillTest">Wpisz</button></div>
      <div class="auth__sep">albo</div>
      <button type="button" class="btn btn--ghost btn--block" id="wkBtn">${ic('shield')}Węzeł Krajowy: profil zaufany, mObywatel, bank</button>
      <p class="muted" style="font-size:13.5px;text-align:center">Nie masz konta? <button type="button" class="link" id="regBtn">Załóż konto</button> · <a class="link" href="#/lekarz/logowanie">Jestem lekarzem</a></p>`;
    $('#fillTest').addEventListener('click', () => {
      $('#loginForm').email.value = PATIENTS[0].email;
      $('#loginForm').password.value = PATIENT_PASSWORD;
    });
    $('#regBtn').addEventListener('click', () => toast('Rejestracja jest poza zakresem mocka — użyj konta testowego', 'info'));
    $('#wkBtn').addEventListener('click', nationalNode);
    $('#loginForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target, who = f.email.value.trim().toLowerCase();
      const pt = PATIENTS.find(p => p.email && (p.email === who || p.phone.replace(/\s/g, '') === who.replace(/\s/g, '')));
      if (!pt || f.password.value !== PATIENT_PASSWORD) return stepPassword('Nieprawidłowy e-mail lub hasło.');
      stepCode(pt);
    });
  }

  function stepCode(pt) {
    let code = digits(6);
    const send = () => notify({ app: 'Wiadomości', title: 'Osłuch', body: `Twój kod logowania: ${code.slice(0, 3)} ${code.slice(3)}. Nie podawaj go nikomu.` });
    $('#authBox').innerHTML = `<div><p class="eyebrow">Krok 2 z 2</p><h1 style="margin-top:8px">Wpisz kod z SMS-a</h1>
        <p class="muted" style="margin-top:8px">Wysłaliśmy go na numer ${pt.phone.slice(0, 7)} ••• ${pt.phone.slice(-3)}.</p></div>
      <div class="otp" id="otp"></div><p class="field__err" id="otpErr" hidden>Kod się nie zgadza. Spróbuj jeszcze raz.</p>
      <div style="display:flex;justify-content:space-between"><button type="button" class="link-btn" id="backBtn">${ic('back')}Wróć</button><button type="button" class="link-btn" id="resend">Wyślij ponownie</button></div>`;
    const otp = otpField($('#otp'), 6, v => {
      if (v !== code) { otp.error(); $('#otpErr').hidden = false; setTimeout(() => otp.clear(), 350); return; }
      login('patient', pt.id);
      toast(`Dzień dobry, ${pt.first}!`, 'check');
      const n = nextHash; nextHash = null;
      go(n || '#/konto');
    });
    setTimeout(send, 600);
    $('#resend').addEventListener('click', () => { code = digits(6); send(); });
    $('#backBtn').addEventListener('click', () => stepPassword());
  }

  function nationalNode() {
    const m = modal({ label: 'Węzeł Krajowy', html: `<button class="modal__x" data-close aria-label="Zamknij">${ic('x')}</button>
      <div class="modal__body"><span class="chip">Symulacja przekierowania</span><h2 class="modal__title">Zaloguj się przez Węzeł Krajowy</h2>
      <p class="modal__text">W prawdziwej usłudze trafiłbyś na stronę logowania do usług publicznych. Tutaj wybierz metodę, a mock zaloguje konto testowe.</p>
      <div class="pay">${[['shield', 'Profil zaufany'], ['sms', 'Aplikacja mObywatel'], ['bank', 'Bankowość elektroniczna']].map(([i, l]) => `<button type="button" class="pay__opt" data-m="${l}">${ic(i)}<b>${l}</b></button>`).join('')}</div></div>` });
    $$('[data-m]', m.el).forEach(b => b.addEventListener('click', async () => {
      $('.modal__body', m.el).innerHTML = `<div class="queue"><div class="queue__ring" style="--p:70%"><span>${ic('lock')}</span></div><b>Weryfikacja tożsamości…</b><p class="muted">${esc(b.dataset.m)}</p></div>`;
      await wait(1400);
      m.close();
      login('patient', 'anna');
      toast('Zalogowano przez Węzeł Krajowy (symulacja)', 'shield');
      const n = nextHash; nextHash = null;
      go(n || '#/konto');
    }));
  }
}

// ---------- account ----------
function viewAccount(tab = 'wizyty') {
  const pt = currentPatient();
  const visits = patientVisits(pt.id);
  const rx = patientDocs(pt.id, 'rx');
  const others = patientDocs(pt.id).filter(d => d.kind !== 'rx');
  const up = visits.filter(v => ['booked', 'waiting', 'active'].includes(v.status)).sort((a, b) => a.at - b.at)[0];
  const tabs = [['wizyty', 'cal', 'Wizyty'], ['recepty', 'rx', 'Recepty', rx.filter(d => !d.filled).length], ['dokumenty', 'doc', 'Dokumenty'], ['profil', 'heart', 'Profil zdrowia']];

  let body = '';
  if (tab === 'wizyty') {
    const past = visits.filter(v => v !== up);
    body = `${up ? upNextHtml(up) : `<div class="card card--pad" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="flex:1"><b style="font-size:17px">Nie masz zaplanowanych wizyt</b><p class="muted">Internista jest dostępny dziś — zwykle w ciągu kwadransa.</p></div><a class="btn btn--primary" href="#/umow">Umów wizytę</a></div>`}
      <div class="card"><div class="card__h" style="padding:16px 18px 0"><h2 class="card__t">Historia wizyt</h2></div>
      ${past.map(v => visitRowHtml(v)).join('')}
      ${pt.history.map(h => { const d = doctorById(h.doctor); return `<div class="vrow">${avatar(d, 40)}<div><b>${esc(h.reason)}</b><small>${fmtDMY(fromIso(h.date))} · ${esc(d.full)} · ${esc(h.dx)}</small></div><span class="chip">Zakończona</span></div>`; }).join('')}</div>`;
  } else if (tab === 'recepty') {
    body = rx.length ? rx.map(d => rxCardHtml(d)).join('') : `<div class="card empty">${ic('rx')}<p>Tu pojawią się kody e-recept wystawionych przez naszych lekarzy.</p></div>`;
  } else if (tab === 'dokumenty') {
    body = `${others.length ? others.map(miniDocHtml).join('') : `<div class="card empty">${ic('doc')}<p>Brak zwolnień i skierowań.</p></div>`}
      <div class="card card--pad"><h2 class="card__t" style="margin-bottom:12px">Wyniki badań</h2><div class="files">${pt.files.map(f => `<div class="file-row">${ic('file')}<div><b>${esc(f.name)}</b><small>${f.kind} · ${fmtDMY(fromIso(f.date))}</small></div></div>`).join('')}
      <button type="button" class="btn btn--ghost btn--sm" id="upBtn" style="justify-self:start">${ic('upload')}Dodaj plik</button></div></div>`;
  } else {
    body = `<div class="card card--pad"><h2 class="card__t" style="margin-bottom:14px">Dane</h2><dl class="kv">
        <dt>Imię i nazwisko</dt><dd>${esc(pt.name)}</dd><dt>PESEL</dt><dd class="mono">${pt.pesel}</dd><dt>Data urodzenia</dt><dd>${fmtDMY(fromIso(pt.born))} (${lata(ageOf(pt.born))})</dd>
        <dt>Telefon</dt><dd>${pt.phone}</dd><dt>E-mail</dt><dd>${pt.email}</dd><dt>Adres</dt><dd>${esc(pt.address)}</dd><dt>Pracodawca (e-ZLA)</dt><dd>${esc(pt.employer.name)}, NIP ${pt.employer.nip}</dd></dl></div>
      <div class="health"><div class="card card--pad"><h2 class="card__t" style="margin-bottom:6px">Alergie</h2><ul>${pt.allergies.map(a => `<li><span class="allergy">${ic('alert')}${esc(a.name)}</span><small>${esc(a.reaction)} · ${a.year}</small></li>`).join('')}</ul></div>
        <div class="card card--pad"><h2 class="card__t" style="margin-bottom:6px">Choroby przewlekłe</h2><ul>${pt.conditions.map(c => `<li>${esc(c.name)}<small>${c.icd} · od ${c.since} r.</small></li>`).join('')}</ul></div>
        <div class="card card--pad"><h2 class="card__t" style="margin-bottom:6px">Leki na stałe</h2><ul>${pt.meds.map(m => `<li>${esc(drugLabel(drugById(m.drug)))}<small>${esc(m.sig)}</small></li>`).join('')}</ul></div>
        <div class="card card--pad"><h2 class="card__t" style="margin-bottom:6px">Zgody</h2><ul><li>Asystent AI na wizytach<small>pytamy przy każdej rezerwacji</small></li><li>Kontakt SMS i e-mail<small>powiadomienia o wizytach i receptach</small></li></ul></div></div>`;
  }

  app.innerHTML = `<div class="page"><div class="wrap acct">
    <nav class="acct__nav" aria-label="Konto"><div class="acct__who">${avatar(pt, 44)}<div><b>${esc(pt.name)}</b><small>PESEL ${pt.pesel}</small></div></div>
      ${tabs.map(([k, i, l, n]) => `<a href="#/konto/${k}" class="${tab === k ? 'is-on' : ''}">${ic(i)}${l}${n ? `<span class="count">${n}</span>` : ''}</a>`).join('')}
      <a href="#/" id="logoutBtn">${ic('logout')}Wyloguj</a></nav>
    <div class="stack"><div class="page__h" style="margin:0"><div><h1>${tabs.find(t => t[0] === tab)[2]}</h1></div>${tab === 'wizyty' ? '<a class="btn btn--primary" href="#/umow">Umów wizytę</a>' : ''}</div>${body}</div>
  </div></div>`;
  $('#logoutBtn').addEventListener('click', e => { e.preventDefault(); logout('patient'); toast('Wylogowano', 'logout'); go('#/'); });
  $('#upBtn')?.addEventListener('click', () => toast('W mocku nie wysyłamy plików — wynik TSH jest już w Twoich dokumentach', 'info'));
  return { sync: () => viewAccount(tab) };
}

function upNextHtml(v) {
  const d = doctorById(v.doctorId);
  return `<div class="upnext"><div class="upnext__when"><b>${fmtTime(v.at)}</b><small>${fmtDay(v.at)}</small></div>
    <div><p>${statusChip(v)} ${VISIT_TYPES[v.type].label} · ${fromNow(v.at)}</p><h3>${esc(reasonOf(v))}</h3><p>${esc(d.full)} · ${esc(d.spec)}</p></div>
    <a class="btn btn--primary" href="#/wizyta/${v.id}">${v.status === 'active' ? 'Wróć do rozmowy' : 'Wejdź do poczekalni'}</a></div>`;
}
function visitRowHtml(v) {
  const d = doctorById(v.doctorId);
  return `<a class="vrow" href="#/wizyta/${v.id}">${avatar(d, 40)}<div><b>${esc(reasonOf(v))}</b><small>${fmtWhen(v.at)} · ${esc(d.full)} · ${VISIT_TYPES[v.type].label}</small></div>${statusChip(v)}</a>`;
}

// ---------- booking ----------
const BOOK_STEPS = ['Powód', 'Ankieta', 'Termin', 'Zgody i płatność'];

function viewBook(doctorId) {
  const pt = currentPatient();
  const d = store.get(DRAFT, null) || { step: 0, reason: null, answers: {}, alarms: [], free: '', type: null, doctorId: null, at: null, day: 0, consentAI: null, terms: false, pay: 'blik', files: [] };
  if (doctorId && doctorById(doctorId)) { d.doctorId = doctorId; if (d.step > 2) d.step = 2; }
  const save = () => store.set(DRAFT, d);
  const sc = () => SCENARIOS[d.reason];
  render();

  function render() {
    save();
    app.innerHTML = `<div class="page"><div class="wrap">
      <a class="back" href="#/konto">${ic('back')}Moje konto</a>
      <div class="page__h"><div><h1>Umów wizytę u internisty</h1><p>Zajmie to ok. 3 minut. Ankietę przeczyta lekarz przed rozmową.</p></div></div>
      <ol class="stepper">${BOOK_STEPS.map((s, i) => `<li class="${i < d.step ? 'is-done' : i === d.step ? 'is-on' : ''}"><span>${s}</span></li>`).join('')}</ol>
      <div class="book"><div class="book__main" id="bookMain"></div><aside class="book__aside" id="bookAside"></aside></div></div></div>`;
    [stepReason, stepQuestions, stepTime, stepPay][d.step]();
    renderAside();
  }

  function renderAside() {
    const dr = d.doctorId && doctorById(d.doctorId), t = d.type && VISIT_TYPES[d.type];
    $('#bookAside').innerHTML = `<div class="card sum">
      ${dr ? `<div class="sum__doc">${avatar(dr, 46)}<div><b>${esc(dr.full)}</b><br><small class="muted">${esc(dr.spec)}</small></div></div>` : ''}
      <div class="sum__row"><span>Powód</span><span>${d.reason ? esc(sc().label) : '—'}</span></div>
      <div class="sum__row"><span>Forma</span><span>${t ? t.label : '—'}</span></div>
      <div class="sum__row"><span>Termin</span><span>${d.at ? fmtWhen(d.at) : '—'}</span></div>
      <div class="sum__row"><span>Pacjent</span><span>${esc(pt.name)}</span></div>
      <div class="sum__total"><span>Do zapłaty</span><span>${t ? (d.pay === 'pakiet' ? '0,00 zł' : zl(t.price)) : '—'}</span></div></div>
      <div class="ai-note">${ic('spark')}<span>Lekarz dostanie streszczenie Twojej ankiety przygotowane przez asystenta AI — rozmowa zaczyna się od konkretów.</span></div>
      <p class="muted" style="font-size:13px;display:flex;gap:8px">${ic('alert')}W nagłych przypadkach dzwoń pod 112.</p>`;
  }

  function nav(canNext, label = 'Dalej') {
    return `<div class="book__nav">${d.step ? `<button type="button" class="btn btn--ghost" data-prev>${ic('back')}Wstecz</button>` : '<span></span>'}
      <button type="button" class="btn btn--primary btn--lg" data-next ${canNext ? '' : 'disabled'}>${label} ${ic('arrow')}</button></div>`;
  }
  function bindNav(onNext) {
    $('[data-prev]')?.addEventListener('click', () => { d.step--; render(); });
    $('[data-next]')?.addEventListener('click', () => (onNext ? onNext() : (d.step++, render())));
  }

  function stepReason() {
    $('#bookMain').innerHTML = `<h2>Z czym się zgłaszasz?</h2>
      <div class="reasons">${Object.values(SCENARIOS).map(s => `<button type="button" class="reason ${d.reason === s.id ? 'is-on' : ''}" data-r="${s.id}">
        <span class="reason__ic">${ic(s.icon)}</span><b>${s.label}</b><span>${s.hint}</span></button>`).join('')}</div>
      <p class="muted" style="font-size:13.5px">Inny problem? W tym mocku przygotowaliśmy trzy scenariusze rozmowy z lekarzem i asystentem AI.</p>
      ${nav(!!d.reason)}`;
    $$('[data-r]').forEach(b => b.addEventListener('click', () => {
      if (d.reason !== b.dataset.r) {
        d.reason = b.dataset.r;
        d.answers = Object.fromEntries(sc().questions.map(q => [q.id, Array.isArray(q.def) ? [...q.def] : q.def]));
        d.alarms = [];
        if (!d.type) d.type = sc().prefer;
      }
      render();
    }));
    bindNav();
  }

  function stepQuestions() {
    const s = sc(), hit = d.alarms.length > 0;
    $('#bookMain').innerHTML = `<h2>${esc(s.label)}: kilka pytań</h2>
      <p class="muted" style="margin-top:-8px">Uzupełniliśmy przykładowe odpowiedzi — możesz je zmienić.</p>
      <div class="alarm ${hit ? 'alarm--hit' : ''}"><p class="alarm__t">${ic('alert')}Czy masz któryś z tych objawów?</p>
        ${s.alarms.map((a, i) => `<label class="check"><input type="checkbox" data-alarm="${i}" ${d.alarms.includes(i) ? 'checked' : ''}><span>${esc(a)}</span></label>`).join('')}
        ${hit ? `<div class="alarm__stop"><b>To może wymagać pilnej pomocy na miejscu.</b><span>Zadzwoń pod 112 albo jedź na najbliższy SOR. Wizyta online nie wystarczy, żeby bezpiecznie Ci pomóc.</span>
          <span style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn--danger" href="tel:112">${ic('phone')}Zadzwoń 112</a><button type="button" class="btn btn--ghost" id="unAlarm">Zaznaczono przez pomyłkę</button></span></div>` : ''}
      </div>
      <div class="card card--pad qs">${s.questions.map(q => questionHtml(q)).join('')}
        <div><p class="q__t">Chcesz coś dodać własnymi słowami? <span class="muted">(opcjonalnie)</span></p><textarea class="textarea" id="free" placeholder="Np. co pomaga, co nasila objawy">${esc(d.free)}</textarea></div></div>
      ${nav(!hit)}`;
    $$('[data-alarm]').forEach(c => c.addEventListener('change', () => {
      const i = +c.dataset.alarm;
      d.alarms = c.checked ? d.alarms.concat(i) : d.alarms.filter(x => x !== i);
      render();
    }));
    $('#unAlarm')?.addEventListener('click', () => { d.alarms = []; render(); });
    $$('[data-q]').forEach(inp => inp.addEventListener('change', () => {
      const q = s.questions.find(x => x.id === inp.dataset.q);
      if (q.type === 'one') d.answers[q.id] = inp.value;
      else if (q.type === 'text') d.answers[q.id] = inp.value;
      else d.answers[q.id] = $$(`[data-q="${q.id}"]:checked`).map(x => x.value);
      if (q.id === 'new' && inp.value === 'Brak nowych objawów' && inp.checked) { d.answers.new = ['Brak nowych objawów']; render(); }
      save();
    }));
    $('#free').addEventListener('input', e => { d.free = e.target.value; save(); });
    bindNav();
  }

  function questionHtml(q) {
    const a = d.answers[q.id];
    if (q.type === 'text') return `<div><p class="q__t">${esc(q.q)}</p><input class="input" data-q="${q.id}" value="${esc(a)}"></div>`;
    if (q.type === 'files') {
      return `<div><p class="q__t">${esc(q.q)}</p><div class="files">${pt.files.map(f => `<label class="file-row">${ic('file')}<div><b>${esc(f.name)}</b><small>${f.kind} · ${fmtDMY(fromIso(f.date))}</small></div>
        <input type="checkbox" data-q="${q.id}" value="${f.id}" ${(a || []).includes(f.id) ? 'checked' : ''}></label>`).join('')}</div></div>`;
    }
    const type = q.type === 'one' ? 'radio' : 'checkbox';
    return `<div><p class="q__t">${esc(q.q)}</p>${q.help ? `<p class="q__help">${esc(q.help)}</p>` : ''}<div class="pick">${q.opts.map(o => `<label><input type="${type}" name="q-${q.id}" data-q="${q.id}" value="${esc(o)}" ${(type === 'radio' ? a === o : (a || []).includes(o)) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div></div>`;
  }

  function stepTime() {
    const s = sc(), fast = soonest();
    $('#bookMain').innerHTML = `<h2>Forma i termin</h2>
      <div class="types">${Object.entries(VISIT_TYPES).map(([k, t]) => `<button type="button" class="type ${d.type === k ? 'is-on' : ''}" data-type="${k}">
        ${s.prefer === k ? `<span class="chip chip--pine">zalecane</span>` : ''}<b>${ic(t.icon)}${t.label}</b><span>${s.prefer === k ? esc(s.preferWhy[0].toUpperCase() + s.preferWhy.slice(1)) : t.note}</span><em>${t.price} zł</em></button>`).join('')}</div>
      ${fast ? `<div class="fastest">${avatar(fast.doctor, 44)}<div><b>Najszybciej: ${fmtWhen(fast.at)}</b><small class="muted">${esc(fast.doctor.full)} · ${fromNow(fast.at)}</small></div>
        <button type="button" class="btn btn--soft btn--sm" id="fastBtn">Wybierz</button></div>` : ''}
      <div class="days">${Array.from({ length: BOOKABLE_DAYS }, (_, i) => { const t = Date.now() + i * DAY; return `<button type="button" class="${d.day === i ? 'is-on' : ''}" data-day="${i}"><b>${fmtDay(t)}</b>${new Date(t).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</button>`; }).join('')}</div>
      <div class="docpick">${DOCTORS.map(dr => { const slots = slotsFor(dr.id, d.day); return `<div class="docrow ${d.doctorId === dr.id ? 'is-on' : ''}">${avatar(dr, 52)}
        <div><div class="docrow__name">${esc(dr.full)}</div><div class="docrow__spec">${esc(dr.spec)}</div>
          <div class="docrow__meta"><span class="stars">${ic('star')}${String(dr.rating).replace('.', ',')}</span><span class="chip">${dr.langs.join(', ')}</span></div>
          <div class="slots">${slots.length ? slots.map(x => `<button type="button" data-slot="${dr.id}:${x.at}" ${x.free ? '' : 'disabled'} class="${d.doctorId === dr.id && d.at === x.at ? 'is-on' : ''}">${fmtTime(x.at)}</button>`).join('') : '<span class="slots__empty">Brak godzin tego dnia</span>'}</div></div></div>`; }).join('')}</div>
      ${nav(d.type && d.doctorId && d.at)}`;
    $$('[data-type]').forEach(b => b.addEventListener('click', () => { d.type = b.dataset.type; render(); }));
    $$('[data-day]').forEach(b => b.addEventListener('click', () => { d.day = +b.dataset.day; render(); }));
    $$('[data-slot]').forEach(b => b.addEventListener('click', () => { const [id, at] = b.dataset.slot.split(':'); d.doctorId = id; d.at = +at; render(); }));
    $('#fastBtn')?.addEventListener('click', () => { d.doctorId = fast.doctor.id; d.at = fast.at; d.day = Math.round((startOfDay(fast.at) - startOfDay(Date.now())) / DAY); render(); });
    bindNav();
  }

  function stepPay() {
    const t = VISIT_TYPES[d.type];
    const ready = d.terms && d.consentAI !== null && (d.pay === 'pakiet' || /^\d{6}$/.test(d.blik || ''));
    $('#bookMain').innerHTML = `<h2>Zgody i płatność</h2>
      <div class="card card--pad stack">
        <div><p class="q__t" style="display:flex;gap:8px;align-items:center">${ic('spark')}Czy lekarz może korzystać z asystenta AI podczas Twojej wizyty?</p>
          <p class="muted" style="font-size:14px;margin:-4px 0 12px">Asystent zamienia rozmowę na tekst, przygotowuje szkic notatki i podpowiada lekarzowi pytania. Nie nagrywamy rozmowy; tekst usuwamy po zatwierdzeniu dokumentacji. Wybór nie wpływa na wizytę ani cenę.</p>
          <div class="consent"><button type="button" class="${d.consentAI === true ? 'is-on' : ''}" data-ai="1"><b>${ic('check')}Tak, zgadzam się</b>Lekarz pisze mniej, rozmawia więcej</button>
            <button type="button" class="is-no ${d.consentAI === false ? 'is-on' : ''}" data-ai="0"><b>${ic('x')}Nie, bez transkrypcji</b>Lekarz zrobi notatki sam</button></div></div>
        <label class="check"><input type="checkbox" id="terms" ${d.terms ? 'checked' : ''}><span>Akceptuję <a class="link" href="#/umow" onclick="return false">regulamin teleporad</a> i zapoznałam/em się z informacją o przetwarzaniu danych medycznych.</span></label>
      </div>
      <div class="card card--pad stack"><p class="q__t" style="margin:0">Płatność</p>
        <div class="pay">
          <label class="pay__opt"><input type="radio" name="pay" value="blik" ${d.pay === 'blik' ? 'checked' : ''}><div><b>BLIK</b><small>Kod z aplikacji banku</small></div><span class="pay__logo">blik</span></label>
          ${d.pay === 'blik' ? `<div class="blik"><input class="input" id="blik" inputmode="numeric" maxlength="7" placeholder="000 000" value="${esc(d.blik || '')}" aria-label="Kod BLIK"><small class="muted">Kod jest ważny 2 minuty</small></div>` : ''}
          <label class="pay__opt"><input type="radio" name="pay" value="pakiet" ${d.pay === 'pakiet' ? 'checked' : ''}><div><b>Pakiet firmowy</b><small>Wizyta opłacona przez pracodawcę</small></div>${ic('gift')}</label>
          ${d.pay === 'pakiet' ? `<p class="chip chip--ok" style="justify-self:start">${ic('check')}Pakiet aktywny: ${esc(pt.employer.name)}</p>` : ''}
        </div></div>
      ${nav(ready, d.pay === 'pakiet' ? 'Umów wizytę' : `Zapłać ${zl(t.price)}`)}`;
    $$('[data-ai]').forEach(b => b.addEventListener('click', () => { d.consentAI = b.dataset.ai === '1'; render(); }));
    $('#terms').addEventListener('change', e => { d.terms = e.target.checked; render(); });
    $$('[name=pay]').forEach(r => r.addEventListener('change', () => { d.pay = r.value; render(); }));
    $('#blik')?.addEventListener('input', e => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 6);
      e.target.value = v.length > 3 ? v.slice(0, 3) + ' ' + v.slice(3) : v;
      d.blik = v; save();
      $('[data-next]').disabled = !(d.terms && d.consentAI !== null && v.length === 6);
    });
    bindNav(finish);
  }

  async function finish() {
    const t = VISIT_TYPES[d.type];
    if (d.pay === 'blik' && !(await payBlik(d.blik, t.price))) return;
    const v = bookVisit({
      doctorId: d.doctorId, reason: d.reason, type: d.type, at: d.at, answers: d.answers, free: d.free, consentAI: d.consentAI,
      pay: { method: d.pay, amount: d.pay === 'pakiet' ? 0 : t.price, at: Date.now() },
    }, pt.id);
    store.drop(DRAFT);
    const dr = doctorById(v.doctorId);
    setTimeout(() => notify({ app: 'Wiadomości', title: 'Osłuch', body: `Wizyta potwierdzona: ${fmtWhen(v.at)}, ${dr.full}. Link do poczekalni jest w aplikacji.` }), 700);
    go('#/wizyta/' + v.id);
  }
}

function payBlik(code, amount) {
  return new Promise(resolve => {
    const m = modal({ dismissable: false, label: 'Płatność BLIK', html: `<div class="modal__body" style="text-align:center">
      <span class="pay__logo" style="justify-self:center;margin:0 auto">blik</span>
      <h2 class="modal__title">Potwierdź płatność w aplikacji banku</h2>
      <p class="modal__text">${CLINIC.legal} · <b>${zl(amount)}</b></p>
      <ul class="signsteps" id="blikSteps" style="text-align:left;max-width:320px;margin:6px auto">
        <li><span class="spin"></span>Wysyłamy kod do banku</li><li><span class="spin"></span>Czekamy na potwierdzenie w telefonie</li><li><span class="spin"></span>Płatność przyjęta</li></ul>
      <div id="blikOut"></div></div>` });
    const li = $$('#blikSteps li', m.el);
    (async () => {
      for (let i = 0; i < li.length; i++) {
        li[i].classList.add('is-on');
        await wait(i === 1 ? 1500 : 700);
        if (i === 0 && code === '000000') {
          li[0].classList.remove('is-on');
          $('#blikOut', m.el).innerHTML = `<p class="field__err" style="margin-bottom:12px">Kod BLIK wygasł. Wygeneruj nowy w aplikacji banku.</p><button type="button" class="btn btn--ghost" id="blikBack">Wróć</button>`;
          $('#blikBack', m.el).addEventListener('click', () => { m.close(); resolve(false); });
          return;
        }
        li[i].classList.replace('is-on', 'is-done');
      }
      await wait(400);
      m.close();
      toast('Płatność BLIK przyjęta (symulacja)', 'check');
      resolve(true);
    })();
  });
}

// ---------- the visit ----------
function viewVisit(id) {
  const v0 = visitById(id);
  const pt = currentPatient();
  if (!v0 || v0.patientId !== pt.id) {
    app.innerHTML = `<div class="page"><div class="wrap"><div class="card empty">${ic('alert')}<p>Nie znaleźliśmy tej wizyty.</p><a class="btn btn--ghost" href="#/konto">Moje konto</a></div></div></div>`;
    return;
  }
  let inRoom = v0.status === 'waiting';
  let ctrl = null, shownStatus = null;

  function draw() {
    const v = visitById(id);
    if (ctrl && ctrl.stop) ctrl.stop();
    ctrl = null;
    shownStatus = v.status + (inRoom ? '+room' : '');
    if (v.status === 'done') ctrl = drawSummary(v);
    else if (v.status === 'active') ctrl = drawCall(v);
    else if (v.status === 'cancelled' || v.status === 'noshow') drawGone(v);
    else if (inRoom || v.status === 'waiting') ctrl = drawRoom(v);
    else drawConfirm(v);
  }

  function drawConfirm(v) {
    const dr = doctorById(v.doctorId), sc = scenarioOf(v);
    const fresh = Date.now() - v.createdAt < 60e3;
    app.innerHTML = `<div class="page"><div class="wrap"><a class="back" href="#/konto">${ic('back')}Moje konto</a><div class="confirm">
      <div class="card card--pad stack">${fresh ? `<span class="okmark">${ic('check')}</span>` : ''}
        <div><h1 class="serif" style="font-size:34px;line-height:1.1;letter-spacing:-.02em">${fresh ? 'Wizyta umówiona' : esc(sc.label)}</h1>
        <p class="muted" style="margin-top:6px">${fmtLong(v.at)}, godz. ${fmtTime(v.at)} · ${fromNow(v.at)}</p></div>
        <div style="display:flex;gap:14px;align-items:center">${avatar(dr, 56)}<div><b>${esc(dr.full)}</b><br><span class="muted">${esc(dr.spec)}</span></div></div>
        <dl class="kv"><dt>Forma</dt><dd>${VISIT_TYPES[v.type].label}</dd><dt>Powód</dt><dd>${esc(sc.label)}</dd>
          <dt>Asystent AI</dt><dd>${v.consentAI ? 'zgoda — transkrypcja i szkic notatki' : 'bez transkrypcji'}</dd>
          <dt>Płatność</dt><dd>${v.pay.method === 'pakiet' ? 'pakiet firmowy' : 'BLIK · ' + zl(v.pay.amount)}</dd><dt>Nr wizyty</dt><dd class="mono">${v.id}</dd></dl>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn--primary btn--lg" id="enter">Wejdź do poczekalni ${ic('arrow')}</button>
          <button type="button" class="btn btn--ghost btn--lg" id="cancel">Odwołaj</button></div>
        <p class="muted" style="font-size:13px">Poczekalnię otwieramy 10 minut przed wizytą. W mocku możesz wejść od razu.</p></div>
      <div class="stack"><div class="card card--pad"><h2 class="card__t" style="margin-bottom:12px">${ic('check')}Przygotuj się</h2><ul class="prep">
        <li>${ic('check')}Ciche miejsce i naładowany telefon</li>${v.type === 'video' ? `<li>${ic('check')}Dobre światło — lekarz może poprosić o pokazanie gardła</li>` : ''}
        <li>${ic('check')}Lista leków, które bierzesz</li><li>${ic('check')}Termometr, jeśli masz gorączkę</li><li>${ic('check')}Dowód osobisty — lekarz może potwierdzić tożsamość</li></ul></div>
        <div class="ai-note">${ic('spark')}<span>Twoja ankieta jest już u lekarza — razem ze streszczeniem przygotowanym przez asystenta AI.</span></div></div>
    </div></div></div>`;
    $('#enter').addEventListener('click', () => { inRoom = true; draw(); });
    $('#cancel').addEventListener('click', async () => {
      if (!(await confirmBox({ title: 'Odwołać wizytę?', body: `<p>${fmtWhen(v.at)} · ${esc(dr.full)}. ${v.pay.amount ? 'Zwrot ' + zl(v.pay.amount) + ' wróci na konto w ciągu 3 dni roboczych.' : ''}</p>`, ok: 'Odwołaj wizytę', danger: true }))) return;
      updateVisit(id, x => { x.status = 'cancelled'; });
      toast('Wizyta odwołana', 'x');
      draw();
    });
  }

  function drawRoom(v) {
    const dr = doctorById(v.doctorId);
    if (v.status === 'booked') updateVisit(id, x => { x.status = 'waiting'; x.joinedAt = Date.now(); });
    app.innerHTML = `<div class="page"><div class="wrap"><a class="back" href="#/konto">${ic('back')}Moje konto</a>
      <div class="page__h"><div><h1>Poczekalnia</h1><p>${esc(dr.full)} dołączy ${v.at > Date.now() ? 'o ' + fmtTime(v.at) : 'za chwilę'}. Nie zamykaj tej strony.</p></div><span class="chip chip--ok chip--live">Jesteś w poczekalni</span></div>
      <div class="room"><div class="stack">
        <div class="mirror">${v.type === 'video' ? feedSvg(pt, 'patient') : `<div class="stage stage--audio" style="height:100%;border-radius:0">${avatar(pt, 120)}</div>`}<span class="mirror__tag">Twój podgląd${v.type === 'video' ? '' : ' · bez kamery'}</span></div>
        <div class="card card--pad"><h2 class="card__t" style="margin-bottom:14px">Sprawdzenie sprzętu</h2><ul class="checks">
          ${v.type === 'video' ? `<li>${ic('check')}<span style="flex:1">Kamera działa</span><span class="muted">FaceTime HD (symulacja)</span></li>` : ''}
          <li>${ic('check')}<span style="flex:1">Mikrofon</span><span class="meter" id="meter">${'<i></i>'.repeat(8)}</span></li>
          <li>${ic('check')}<span style="flex:1">Połączenie</span><span class="muted">dobre · 38 ms</span></li></ul></div></div>
      <div class="stack">
        <div class="card queue"><div class="queue__ring" style="--p:78%"><span id="qClock">${v.at > Date.now() ? fmtTime(v.at) : '…'}</span></div>
          <b>${v.at > Date.now() ? 'Wizyta ' + fromNow(v.at) : 'Lekarz kończy poprzednią wizytę'}</b><p class="muted">Jesteś pierwsza w kolejce</p></div>
        <div class="card card--pad stack"><p class="eyebrow">Demo</p><p style="font-size:14px">Otwórz panel lekarza w drugiej karcie i rozpocznij wizytę — ta strona połączy się sama. Albo pozwól mockowi zagrać lekarza.</p>
          <button type="button" class="btn btn--primary" id="openDoc">${ic('stetho')}Otwórz panel lekarza ↗</button>
          <button type="button" class="btn btn--ghost" id="simDoc">${ic('play')}Symuluj lekarza w tej karcie</button></div>
        <button type="button" class="btn btn--ghost" id="leave">Wyjdź z poczekalni</button></div></div></div></div>`;
    const bars = $$('#meter i');
    const t = setInterval(() => bars.forEach((b, i) => { b.style.height = 15 + Math.random() * (i < 5 ? 85 : 40) + '%'; }), 140);
    $('#openDoc').addEventListener('click', () => window.open(location.pathname + '#/lekarz/wizyta/' + id, '_blank'));
    $('#simDoc').addEventListener('click', () => { startCall(id, { auto: true }); draw(); });
    $('#leave').addEventListener('click', () => { updateVisit(id, x => { if (x.status === 'waiting') x.status = 'booked'; }); inRoom = false; go('#/konto'); });
    return { stop: () => clearInterval(t) };
  }

  function drawCall(v) {
    const dr = doctorById(v.doctorId), seenIds = new Set(v.docs || []);
    const video = v.type === 'video', chat = v.type === 'chat';
    let cam = true, mic = true;
    app.innerHTML = `<div class="page"><div class="wrap"><div class="call">
      <div class="stack">
        <div class="stage ${video ? '' : 'stage--audio'}" id="stage">
          ${video ? feedSvg(dr, 'doctor') : avatar(dr, 150)}
          ${video ? `<div class="stage__self" id="self">${feedSvg(pt, 'patient')}</div>` : ''}
          <span class="stage__tag"><span class="chip chip--ok chip--live" style="padding:0 6px;background:none;color:#7fe0ac"></span>${esc(dr.full)} · <span class="stage__clock" id="clock">00:00</span></span>
          <div class="stage__cap" id="cap"></div>
          <div class="stage__ctl"><button type="button" class="ctl" id="micBtn" aria-label="Mikrofon">${ic('mic')}</button>
            ${video ? `<button type="button" class="ctl" id="camBtn" aria-label="Kamera">${ic('video')}</button>` : ''}
            <button type="button" class="ctl ctl--end" id="endBtn" aria-label="Opuść wizytę">${ic('hang')}</button></div>
        </div>
        ${v.call.auto ? `<p class="muted" style="font-size:13px;display:flex;gap:8px">${ic('info')}Demo: lekarza gra mock. Otwórz panel lekarza w drugiej karcie, żeby przejąć rozmowę.</p>` : ''}
      </div>
      <div class="stack">
        <div class="card card--pad"><h2 class="card__t" style="margin-bottom:12px">${ic('doc')}Dokumenty z wizyty</h2><div class="live-docs" id="liveDocs"></div></div>
        <div class="card card--pad"><h2 class="card__t" style="margin-bottom:12px">${ic(chat ? 'chat' : 'list')}${chat ? 'Czat' : 'Napisy na żywo'}</h2><div class="chatlog" id="chatlog"></div></div>
      </div></div></div></div>`;
    $('#micBtn').addEventListener('click', e => { mic = !mic; e.currentTarget.classList.toggle('is-off', !mic); e.currentTarget.innerHTML = ic(mic ? 'mic' : 'micOff'); });
    $('#camBtn')?.addEventListener('click', e => {
      cam = !cam; e.currentTarget.classList.toggle('is-off', !cam); e.currentTarget.innerHTML = ic(cam ? 'video' : 'camOff');
      $('#self').innerHTML = cam ? feedSvg(pt, 'patient') : `<div style="height:100%;display:grid;place-items:center;background:#222;color:#aaa">${ic('camOff')}</div>`;
    });
    $('#endBtn').addEventListener('click', async () => {
      if (await confirmBox({ title: 'Opuścić wizytę?', body: '<p>Lekarz może jeszcze kończyć dokumenty. Możesz wrócić do rozmowy z poziomu konta.</p>', ok: 'Opuść', danger: true })) go('#/konto');
    });

    const renderDocs = x => {
      const docs = docsOf(x);
      $('#liveDocs').innerHTML = docs.length ? docs.map(doc => `<div class="live-doc"><span class="mini-doc__ic">${ic(doc.kind === 'rx' ? 'rx' : doc.kind === 'zla' ? 'bed' : 'flask')}</span><div>
        <b>${doc.kind === 'rx' ? 'e-Recepta · kod ' + doc.code : doc.kind === 'zla' ? 'Zwolnienie e-ZLA' : 'Skierowanie na badania'}</b>
        <small>${doc.kind === 'rx' ? doc.items.map(i => esc(drugById(i.drug).inn)).join(', ') : doc.kind === 'zla' ? `${fmtDMY(fromIso(doc.from))} – ${fmtDMY(fromIso(doc.to))}` : doc.tests.map(labName).join(', ')}</small></div></div>`).join('')
        : '<p class="muted" style="font-size:14px">Tu pojawią się e-recepta, zwolnienie lub skierowanie, gdy lekarz je wystawi.</p>';
      docs.filter(doc => !seenIds.has(doc.id)).forEach(doc => {
        seenIds.add(doc.id);
        if (doc.kind === 'rx') notify({ app: 'Wiadomości', title: 'Osłuch: e-Recepta', body: `Kod: ${doc.code}. Zrealizujesz go w każdej aptece z numerem PESEL. ${dr.full}` });
        else toast(doc.kind === 'zla' ? 'Lekarz wystawił zwolnienie — trafi do ZUS i pracodawcy' : 'Lekarz wystawił skierowanie na badania', 'doc');
      });
    };
    const renderLog = x => {
      const p = callPos(x);
      $('#chatlog').innerHTML = p.lines.slice(0, p.done).map(l => `<div class="bubble bubble--${l.who}">${esc(l.t)}</div>`).join('')
        + (p.cur && chat ? `<div class="bubble bubble--${p.cur.who} bubble--typing">${p.cur.who === 'd' ? 'Lekarz pisze…' : 'Piszesz…'}</div>` : '');
      $('#chatlog').scrollTop = 1e6;
    };
    renderDocs(v); renderLog(v);
    let docCount = (v.docs || []).length;

    const player = createPlayer(id, {
      onLine: renderLog,
      onFrame: x => {
        if (x.status !== 'active') return draw();
        const p = callPos(x);
        $('#clock').textContent = fmtClock(p.clock);
        $('#stage').classList.toggle('is-talking', !!p.cur && p.cur.who === 'd' && !p.paused);
        $('#self')?.classList.toggle('is-talking', !!p.cur && p.cur.who === 'p' && !p.paused);
        $('#cap').innerHTML = p.cur && !chat ? `<small>${p.cur.who === 'd' ? esc(dr.full) : 'Ty'}</small><span>${esc(partialText(p.cur.t, p.prog))}</span>`
          : p.ended ? `<span>${x.call.auto ? 'Lekarz kończy wizytę…' : 'Lekarz uzupełnia dokumentację. Za chwilę zobaczysz podsumowanie.'}</span>` : '';
        if ((x.docs || []).length !== docCount) { docCount = x.docs.length; renderDocs(x); }
      },
      onEnd: (x, drives) => {
        if (!drives || !x.call.auto) return;
        setTimeout(() => {
          autoFinish(id);
          renderDocs(visitById(id));
          setTimeout(draw, 1800);
        }, 1500);
      },
    });
    return player;
  }

  function drawSummary(v) {
    const dr = doctorById(v.doctorId), docs = docsOf(v), n = v.note || {};
    const mins = Math.max(1, Math.round((v.endedAt - v.startedAt) / MIN));
    app.innerHTML = `<div class="page"><div class="wrap"><a class="back" href="#/konto">${ic('back')}Moje konto</a>
      <div class="page__h"><div><p class="eyebrow">Podsumowanie wizyty</p><h1 style="margin-top:8px">${esc(reasonOf(v))}</h1>
        <p>${fmtLong(v.startedAt)}, ${fmtTime(v.startedAt)} · ${mins} min · ${esc(dr.full)}</p></div>
        <button type="button" class="btn btn--ghost" id="printSum">${ic('print')}Zapisz jako PDF</button></div>
      <div class="summary"><div class="stack">
        ${docs.filter(d => d.kind === 'rx').map(d => rxCardHtml(d)).join('')}
        ${docs.filter(d => d.kind !== 'rx').map(miniDocHtml).join('')}
        <div class="card card--pad note-read">
          ${n.rozpoznanie ? `<div><h4>Rozpoznanie</h4><p>${esc(n.rozpoznanie.text)}</p></div>` : ''}
          ${n.zalecenia ? `<div><h4>Zalecenia</h4><p>${esc(n.zalecenia.text)}</p></div>` : '<p class="muted">Lekarz jeszcze uzupełnia zalecenia.</p>'}
          <p class="muted" style="font-size:13px;display:flex;gap:8px">${ic('spark')}${v.consentAI ? 'Notatkę przygotował lekarz z pomocą asystenta AI i ją zatwierdził.' : 'Notatkę przygotował lekarz.'} Transkrypcja rozmowy została usunięta.</p>
        </div></div>
      <div class="stack">
        <div class="card card--pad stack"><div style="display:flex;gap:12px;align-items:center">${avatar(dr, 52)}<div><b>${esc(dr.full)}</b><br><span class="muted">${esc(dr.spec)}</span></div></div>
          <p class="q__t" style="margin:0">Jak oceniasz wizytę?</p><div class="rate" id="rate">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-star="${i}" class="${(v.rating || 0) >= i ? 'is-on' : ''}" aria-label="${i} na 5">${ic('star')}</button>`).join('')}</div>
          ${v.rating ? '<p class="muted" style="font-size:13.5px">Dziękujemy za opinię!</p>' : ''}</div>
        <div class="card card--pad stack"><b>Coś się zmieniło?</b><p class="muted" style="font-size:14px">Jeśli objawy się nasilą albo nie ma poprawy, umów wizytę kontrolną — lekarz zobaczy notatkę z dzisiejszej rozmowy.</p>
          <a class="btn btn--soft" href="#/umow/${dr.id}">Umów kontrolę</a></div>
        <p class="muted" style="font-size:13px;display:flex;gap:8px">${ic('alert')}Duszność, ślinotok, silny ból — dzwoń pod 112.</p></div></div></div></div>`;
    $$('[data-star]').forEach(b => b.addEventListener('click', () => { updateVisit(id, x => { x.rating = +b.dataset.star; }); draw(); }));
    $('#printSum').addEventListener('click', () => {
      $('#printRoot').innerHTML = `<div class="sheet"><div class="sheet__top"><div><h1>Podsumowanie wizyty</h1><p>${fmtDMY(v.startedAt)} · ${esc(dr.full)} · PWZ ${dr.pwz}</p></div><div class="sheet__code">Nr wizyty<b style="font-size:18px">${v.id}</b></div></div>
        <p><b>Pacjent:</b> ${esc(pt.name)}, PESEL ${pt.pesel}</p>${NOTE_SECTIONS.map(([k, l]) => n[k] ? `<h3 style="margin-top:12px">${l}</h3><p style="white-space:pre-line">${esc(n[k].text)}</p>` : '').join('')}
        <p class="sheet__foot">Dokument fikcyjny z mocka „Osłuch”.</p></div>`;
      window.print();
    });
  }

  function drawGone(v) {
    app.innerHTML = `<div class="page"><div class="wrap"><div class="card empty">${ic(v.status === 'cancelled' ? 'x' : 'clock')}
      <p>${v.status === 'cancelled' ? 'Ta wizyta została odwołana.' : 'Nie dołączyłaś do tej wizyty.'}</p><a class="btn btn--primary" href="#/umow">Umów nową wizytę</a></div></div></div>`;
  }

  draw();
  return {
    leave() { if (ctrl && ctrl.stop) ctrl.stop(); },
    sync() {
      const v = visitById(id);
      if (!v) return;
      const key = v.status + (inRoom ? '+room' : '');
      if (key !== shownStatus && !(v.status === 'waiting' && shownStatus === 'booked+room')) draw();
    },
  };
}

function logoMark(fill = 'var(--pine)') {
  return `<svg class="logo__mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="${fill}"/>
    <path d="M10 7v6a6 6 0 0 0 12 0V7" fill="none" stroke="${fill === '#fff' ? '#1c5a4f' : '#fff'}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M16 19v2a4.5 4.5 0 0 0 9 0v-3" fill="none" stroke="${fill === '#fff' ? '#1c5a4f' : '#fff'}" stroke-width="2.6" stroke-linecap="round"/><circle cx="25" cy="16" r="2.6" fill="#f3b98f"/></svg>`;
}
