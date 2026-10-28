// Rental agreement (mock): the contract text built from an order, its annexes (handover and return
// reports), a signature pad (draw or type), SMS-code signing and a SHA-256 fingerprint of the text.
// None of this is a real, binding contract.

const contractNo = o => `UN/${new Date(o.createdAt).getFullYear()}/${String(new Date(o.createdAt).getMonth() + 1).padStart(2, '0')}/${digits(o.ref)}`;
const maskPhone = p => { const d = digits(p); return `+48 ${d.slice(0, 3)} *** ${d.slice(-3)}`; };
const protShare = p => (p.share === 1 ? 'do pełnej wartości narzędzia' : p.share === 0 ? 'nie ponosi kosztów naprawy ani utraty (0% wartości)' : `najwyżej ${Math.round(p.share * 100)}% wartości narzędzia`);

// o: an order, or the checkout draft shaped like one (no sig yet)
function contractHTML(o) {
  const c = o.customer, lk = lockerById(o.lockerId), prot = protById(o.protection);
  const days = rentDays(o.from, o.to);
  const rows = o.items.map((it, i) => {
    const t = toolById(it.id);
    return `<tr><td>${i + 1}</td><td>${t.name}</td><td class="mono">${it.serial}</td><td class="num">${zl(t.value)}</td><td class="num">${zl(Math.round(t.deposit * prot.depositFactor))}</td></tr>`;
  }).join('');

  return `
  <article class="contract" aria-label="Umowa najmu">
    <p class="contract__mock">Wzór na potrzeby makiety — to nie jest prawdziwa umowa.</p>
    <header class="contract__head">
      <p class="contract__kicker">${COMPANY.name}</p>
      <h2>Umowa najmu narzędzi nr ${contractNo(o)}</h2>
      <p>zawarta ${fmtFull(o.createdAt)} r. w formie elektronicznej, za pośrednictwem serwisu ${COMPANY.site}, pomiędzy:</p>
    </header>
    <div class="contract__parties">
      <p><b>Wynajmującym:</b> ${COMPANY.name}, ${COMPANY.addr}, ${COMPANY.ids} — dalej „Wynajmujący”,</p>
      <p><b>Najemcą:</b> ${esc(c.name)}, ${esc(c.street)}, ${esc(c.zip)} ${esc(c.city)}, e-mail ${esc(c.email)}, tel. +48 ${esc(c.phone)} — dalej „Najemca”.</p>
    </div>

    <h3>§ 1. Przedmiot umowy</h3>
    <ol>
      <li>Wynajmujący oddaje Najemcy do używania narzędzia wymienione poniżej, a Najemca zobowiązuje się płacić czynsz i zwrócić je w stanie niepogorszonym, z uwzględnieniem normalnego zużycia.</li>
    </ol>
    <div class="contract__table"><table>
      <thead><tr><th>Lp.</th><th>Narzędzie</th><th>Nr ewidencyjny</th><th class="num">Wartość</th><th class="num">Kaucja</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <ol start="2">
      <li>Wraz z narzędziami Najemca otrzymuje wyposażenie wymienione w protokole wydania (Załącznik nr 1).</li>
    </ol>

    <h3>§ 2. Okres najmu</h3>
    <ol>
      <li>Najem trwa od ${fmtFull(o.from)} r., od chwili udostępnienia narzędzi w paczkomacie ${lk.id} (${lk.street}, ${lk.city}), do ${fmtFull(o.to)} r., godz. 23:59 — łącznie ${dni(days)}.</li>
      <li>Najem kończy się z chwilą nadania zwrotu w dowolnym paczkomacie sieci przy użyciu kodu zwrotu. Wcześniejszy zwrot nie obniża czynszu.</li>
      <li>Przedłużenie najmu wymaga dopłaty w serwisie przed końcem okresu z ust. 1 i stanowi aneks do umowy.</li>
    </ol>

    <h3>§ 3. Czynsz i kaucja</h3>
    <ol>
      <li>Czynsz za cały okres najmu wraz z dodatkami i dostawą wynosi ${zl(o.totals.total)} brutto i jest płatny z góry.</li>
      <li>Najemca wnosi kaucję w wysokości ${zl(o.totals.deposit)}. Kaucja jest blokowana na karcie albo pobierana i zwracana w ciągu 24 godzin od pozytywnego sprawdzenia narzędzi.</li>
      <li>Z kaucji Wynajmujący może potrącić należności, o których mowa w § 6 i § 7.</li>
    </ol>

    <h3>§ 4. Wydanie i zwrot</h3>
    <ol>
      <li>Narzędzia są wydawane w paczkomacie po wprowadzeniu kodu odbioru przesłanego SMS-em. Chwila otwarcia skrytki jest chwilą wydania.</li>
      <li>Najemca sprawdza kompletność zestawu i zgłasza braki w serwisie w ciągu 2 godzin od odbioru. Po tym czasie przyjmuje się, że zestaw wydano kompletny i sprawny.</li>
      <li>Najemca zwraca narzędzia oczyszczone z grubsza, w oryginalnej walizce lub torbie, z kompletem wyposażenia.</li>
    </ol>

    <h3>§ 5. Obowiązki Najemcy</h3>
    <ol>
      <li>Najemca używa narzędzi zgodnie z instrukcją, przeznaczeniem i zasadami BHP.</li>
      <li>Najemca nie oddaje narzędzi osobom trzecim, nie podnajmuje ich i nie naprawia samodzielnie.</li>
      <li>Najemca chroni narzędzia przed kradzieżą i zniszczeniem, a awarie zgłasza niezwłocznie w serwisie.</li>
    </ol>

    <h3>§ 6. Odpowiedzialność i ochrona</h3>
    <ol>
      <li>Najemca wybrał wariant ochrony „${prot.name}”.</li>
      <li>W razie uszkodzenia lub utraty narzędzia z winy Najemcy Najemca odpowiada ${protShare(prot)}, według wartości podanej w § 1.</li>
      <li>Ochrona nie obejmuje szkód wyrządzonych umyślnie ani używania narzędzi niezgodnie z przeznaczeniem.</li>
    </ol>

    <h3>§ 7. Opóźnienie w zwrocie</h3>
    <ol>
      <li>Za każdą rozpoczętą dobę opóźnienia Najemca płaci czynsz według stawki za kolejny dzień oraz opłatę ${zl(LATE_FEE)} za każde narzędzie.</li>
      <li>Brak zwrotu w ciągu 7 dni od końca najmu uznaje się za utratę narzędzi.</li>
    </ol>

    <h3>§ 8. Odstąpienie od umowy</h3>
    <ol>
      <li>Najemca będący konsumentem może odstąpić od umowy w ciągu 14 dni od jej zawarcia.</li>
      <li>Na wyraźne żądanie Najemcy najem zaczyna się przed upływem tego terminu; w razie odstąpienia Najemca płaci za okres faktycznego najmu.</li>
    </ol>

    <h3>§ 9. Postanowienia końcowe</h3>
    <ol>
      <li>Umowę zawarto w formie elektronicznej. Najemca złożył podpis na ekranie urządzenia i potwierdził go jednorazowym kodem SMS.</li>
      <li>W sprawach nieuregulowanych stosuje się przepisy Kodeksu cywilnego oraz Regulamin wypożyczalni.</li>
      <li>Umowa wchodzi w życie z chwilą zaksięgowania płatności.</li>
    </ol>

    <div class="contract__sign">
      <div class="contract__party">
        <div class="contract__seal">${ic('shield')}<span>Pieczęć elektroniczna<br>${COMPANY.name}</span></div>
        <p class="contract__who">Wynajmujący</p>
      </div>
      <div class="contract__party">
        ${o.sig ? `<img class="contract__sig" src="${o.sig.img}" alt="Podpis: ${esc(c.name)}">` : '<div class="contract__nosig">miejsce na podpis</div>'}
        <p class="contract__who">Najemca · ${esc(c.name)}</p>
        ${o.sig ? `<p class="contract__meta">Podpisano ${fmtDate(o.sig.at)}, ${new Date(o.sig.at).toTimeString().slice(0, 8)} · kod SMS na ${maskPhone(c.phone)}<br>Odcisk SHA-256: <span class="mono">${o.sig.hash.slice(0, 32)}…</span></p>` : ''}
      </div>
    </div>
  </article>`;
}

// Annexes that grow with the order: extensions, the handover report and the return report.
function annexesHTML(o) {
  const lk = lockerById(o.lockerId);
  let html = '';
  (o.extensions || []).forEach((x, i) => {
    html += `
    <article class="contract contract--annex" id="aneks-${i + 1}">
      <h2>Aneks nr ${i + 1} do umowy ${contractNo(o)}</h2>
      <p>Strony zgodnie przedłużają okres najmu o ${dni(x.days)}, do ${fmtFull(x.to)} r., godz. 23:59. Dopłata czynszu: ${zl(x.amount)}, zapłacona ${fmtStamp(x.at)}. Pozostałe postanowienia umowy nie ulegają zmianie.</p>
    </article>`;
  });
  if (o.pickup) {
    const items = o.items.map((it, i) => {
      const t = toolById(it.id);
      return `<li><b>${t.name}</b> <span class="mono">${it.serial}</span> — skrytka nr ${o.pickup.cells[i]}<br><span class="muted">${t.kit.join(' · ')}</span></li>`;
    }).join('');
    html += `
    <article class="contract contract--annex" id="wydanie">
      <h2>Załącznik nr 1 — protokół wydania</h2>
      <dl class="contract__dl">
        <dt>Data i godzina wydania</dt><dd>${fmtDate(o.pickup.at)}, ${fmtTime(o.pickup.at)}</dd>
        <dt>Miejsce</dt><dd>Paczkomat ${lk.id}, ${lk.street}, ${lk.city}</dd>
        <dt>Stan narzędzi</dt><dd>sprawne, po przeglądzie i czyszczeniu w warsztacie Wynajmującego (${fmtDate(o.packedAt || o.createdAt)})</dd>
        <dt>Kompletność</dt><dd>${o.kitOk ? `potwierdzona przez Najemcę ${fmtStamp(o.kitOk)}` : o.kitIssue ? `zgłoszono brak: ${esc(o.kitIssue.text)} (${fmtStamp(o.kitIssue.at)})` : o.clock > o.pickup.at + 2 * HOUR ? 'nie zgłoszono braków w ciągu 2 godzin — zestaw uznany za kompletny' : 'oczekuje — 2 godziny na zgłoszenie braków od chwili wydania'}</dd>
      </dl>
      <ul class="contract__kit">${items}</ul>
    </article>`;
  }
  if (o.done) {
    const rlk = lockerById(o.returnLockerId);
    const s = o.done.settlement;
    html += `
    <article class="contract contract--annex" id="zwrot">
      <h2>Załącznik nr 2 — protokół zwrotu</h2>
      <dl class="contract__dl">
        <dt>Nadanie zwrotu</dt><dd>${fmtDate(o.returnedAt)}, ${fmtTime(o.returnedAt)} · paczkomat ${rlk.id}, ${rlk.street}, ${rlk.city}</dd>
        <dt>Przyjęcie w warsztacie</dt><dd>${fmtDate(o.done.at)}, ${fmtTime(o.done.at)}</dd>
        <dt>Wynik przeglądu</dt><dd>narzędzia kompletne i sprawne, ślady normalnego użytkowania</dd>
        <dt>Opóźnienie</dt><dd>${s.lateDays ? `${dni(s.lateDays)} · ${zl(s.lateFee)}` : 'brak'}</dd>
        <dt>Rozliczenie kaucji</dt><dd>${s.kept ? `potrącono ${zl(s.kept)}, zwolniono ${zl(s.released)}` : `zwolniono w całości: ${zl(s.released)}`}</dd>
      </dl>
    </article>`;
  }
  return html;
}

// Plain text of the contract, for the fingerprint.
function contractText(o) {
  const div = document.createElement('div');
  div.innerHTML = contractHTML({ ...o, sig: null });
  return div.textContent.replace(/\s+/g, ' ').trim();
}

async function sha256(text) {
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // file:// has no crypto.subtle; fall back to something hash-shaped for the demo
  let out = '';
  for (let i = 0; i < 8; i++) {
    const r = seeded(i + text);
    out += Math.floor(r() * 4294967296).toString(16).padStart(8, '0');
  }
  return out;
}

// ---------- signature pad ----------
function signaturePad(canvas, onChange) {
  const ctx = canvas.getContext('2d');
  let drawing = false, last = null, ink = 0, dpr = 1;

  function size() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const keep = ink ? canvas.toDataURL() : null;
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1b2a6b';
    if (keep) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
      img.src = keep;
    }
  }
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    last = pos(e);
    ctx.beginPath();
    ctx.arc(last.x, last.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = pos(e);
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    if (dist < 1) return;
    // faster strokes come out thinner, like a real pen
    const speed = dist / Math.max(1, p.t - last.t);
    ctx.lineWidth = Math.max(1.2, Math.min(3.2, 3.4 - speed * 1.4));
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.quadraticCurveTo(last.x, last.y, (last.x + p.x) / 2, (last.y + p.y) / 2);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ink += dist;
    last = p;
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    if (onChange) onChange();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  window.addEventListener('resize', size);
  size();

  return {
    isEmpty: () => ink < 60,
    clear() {
      ink = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (onChange) onChange();
    },
    toDataURL: () => canvas.toDataURL('image/png'),
    resize: size,
  };
}

// A typed name rendered in a handwriting font, so both ways end up as an image.
async function typedSignature(name) {
  try { await document.fonts.load('600 56px Caveat'); } catch (e) {}
  const c = document.createElement('canvas');
  c.width = 720;
  c.height = 200;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b2a6b';
  ctx.font = '600 76px Caveat, "Segoe Script", cursive';
  ctx.textBaseline = 'middle';
  let size = 76;
  while (ctx.measureText(name).width > 660 && size > 30) { size -= 4; ctx.font = `600 ${size}px Caveat, cursive`; }
  ctx.save();
  ctx.translate(30, 104);
  ctx.rotate(-0.04);
  ctx.fillText(name, 0, 0);
  ctx.restore();
  return c.toDataURL('image/png');
}

// Final step: the SMS code. Resolves to { at, hash } or null when cancelled.
async function smsSign(draft) {
  const no = contractNo(draft);
  const ok = await codeDialog({
    label: 'Podpis kodem SMS', from: 'SKRZYNKA', cta: 'Podpisz umowę',
    head: `<div class="code__head">${ic('pen')}<div><b>Podpis elektroniczny</b><small>Umowa ${no}</small></div></div>`,
    lead: `Wysłaliśmy jednorazowy kod na numer <b>${maskPhone(draft.customer.phone)}</b>. Wpisując go, potwierdzasz podpis i treść umowy.`,
    sms: code => `Kod do podpisania umowy ${no}: ${code}. Nie przekazuj go nikomu.`,
  });
  if (!ok) return null;
  const hash = await sha256(contractText(draft));
  return { at: Date.now(), hash };
}
