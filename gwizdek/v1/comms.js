// Gwizdek v1 — communication: messenger (1:1 and groups), the team locker room, club news, the staff
// board and mass SMS / e-mail with segment counting and cost.

function commsView(q) {
  const tabs = isParent()
    ? [['msg', 'Wiadomości', unreadThreads().length || ''], ['room', 'Szatnia'], ['news', 'Ogłoszenia']]
    : [['msg', 'Wiadomości', unreadThreads().length || ''], ['room', 'Szatnia'], ['news', 'Ogłoszenia'], ['staff', 'Tablica sztabu'], ...(isCoord() ? [['mass', 'Wysyłka masowa']] : [])];
  const tab = tabs.some(x => x[0] === q.get('t')) ? q.get('t') : 'msg';
  app.innerHTML = `<div class="${isParent() ? 'pp' : 'page page--wide'}">
    ${isParent() ? '<h1 class="pp__title">Czat i szatnia</h1>' : pageHead('Komunikacja', { msg: 'Wiadomości', room: 'Szatnia drużyny', news: 'Ogłoszenia klubu', staff: 'Tablica sztabu', mass: 'Wysyłka masowa' }[tab])}
    ${tabsBar(tabs, tab, '#/komunikacja')}
    <div id="cBody"></div></div>`;
  const body = $('#cBody');
  if (tab === 'msg') messenger(body, q);
  if (tab === 'room') roomView(body, q);
  if (tab === 'news') feedView(body, 'club', isCoord());
  if (tab === 'staff') feedView(body, 'staff', true);
  if (tab === 'mass') massSend(body);
}

// ---------- messenger ----------
const threadName = t => (t.kind === 'group' ? t.name : personName(t.members.find(m => m !== me()) || me()));
const threadColor = t => (t.kind === 'group' ? (t.team ? team(t.team).color : 'var(--pitch)') : personColor(t.members.find(m => m !== me())));

function messenger(host, q) {
  // ?to=<person> opens (or starts) a direct thread
  if (q.get('to')) {
    const to = q.get('to');
    let t = db.threads.find(x => x.kind === 'dm' && x.members.includes(me()) && x.members.includes(to));
    if (!t) t = mutate(d => { const nt = { id: uid('t'), kind: 'dm', members: [me(), to], read: {}, msgs: [] }; d.threads.push(nt); return nt; });
    history.replaceState(null, '', `#/komunikacja?t=msg&c=${t.id}`);
    q = new URLSearchParams(`t=msg&c=${t.id}`);
  }
  const mine = db.threads.filter(t => t.members.includes(me())).sort((a, b) => (b.msgs.at(-1)?.at || 0) - (a.msgs.at(-1)?.at || 0));
  const narrow = isParent() || matchMedia('(max-width: 860px)').matches;
  const cid = q.get('c') || (narrow ? '' : mine[0]?.id);
  const cur = mine.find(t => t.id === cid);
  const unread = new Set(unreadThreads().map(t => t.id));
  const list = `<div class="threads">
    <button class="btn btn--ghost btn--block" id="newMsg">${ic('plus')} Nowa wiadomość</button>
    ${mine.map(t => { const last = t.msgs.at(-1); return `<a class="thread ${t.id === cid ? 'is-on' : ''} ${unread.has(t.id) ? 'is-unread' : ''}" href="#/komunikacja?t=msg&c=${t.id}">
      ${avatar(t.kind === 'group' ? t.name.replace('Rodzice ', '') : threadName(t), threadColor(t))}
      <span class="thread__b"><b>${esc(threadName(t))}</b><small>${last ? `${last.from === me() ? 'Ty: ' : t.kind === 'group' ? esc(personName(last.from).split(' ')[0]) + ': ' : ''}${esc(last.text)}` : 'Brak wiadomości'}</small></span>
      <span class="thread__t">${last ? ago(last.at).replace(' temu', '') : ''}</span></a>`; }).join('')}</div>`;
  const conv = cur ? `<div class="conv">
    <header class="conv__h">${narrow ? `<a class="icon-btn" href="#/komunikacja?t=msg" aria-label="Wróć">${ic('back')}</a>` : ''}<b>${esc(threadName(cur))}</b><small>${cur.kind === 'group' ? nOf(cur.members.length, 'osoba', 'osoby', 'osób') : esc(person(cur.members.find(m => m !== me()))?.role || 'rodzic')}</small></header>
    <div class="conv__l" id="convL">${cur.msgs.map((m, i) => { const prev = cur.msgs[i - 1], day = !prev || !sameDay(prev.at, m.at); return `${day ? `<p class="conv__day">${relDay(m.at)}</p>` : ''}<div class="msg ${m.from === me() ? 'is-me' : ''}">${cur.kind === 'group' && m.from !== me() && (!prev || prev.from !== m.from || day) ? `<small class="msg__who">${esc(personName(m.from))}</small>` : ''}<p>${esc(m.text)}</p><time>${fmtTime(m.at)}</time></div>`; }).join('') || '<p class="empty-s">Napisz pierwszą wiadomość.</p>'}</div>
    <form class="conv__f" id="convF"><textarea class="input" name="t" rows="1" placeholder="Napisz wiadomość…" aria-label="Wiadomość"></textarea><button class="btn btn--primary btn--icon" aria-label="Wyślij">${ic('send')}</button></form></div>`
    : `<div class="conv conv--empty"><p class="empty-s">${ic('chat')} Wybierz rozmowę</p></div>`;
  host.innerHTML = `<div class="msgr ${narrow ? 'is-narrow' : ''} ${cur ? 'has-conv' : ''}">${narrow && cur ? '' : list}${narrow && !cur ? '' : conv}</div>`;
  const l = $('#convL');
  if (l) l.scrollTop = l.scrollHeight;
  if (cur && unread.has(cur.id)) {
    mutate(d => { const t = d.threads.find(x => x.id === cur.id); t.read = { ...(t.read || {}), [me()]: Date.now() }; d.notes.forEach(n => { if (n.to === me() && n.link.includes(cur.id)) n.read = true; }); });
    renderChrome();
  }
  $('#newMsg')?.addEventListener('click', newMessageModal);
  const f = $('#convF');
  if (!f) return;
  const ta = f.t;
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!text) return;
    mutate(d => {
      const t = d.threads.find(x => x.id === cur.id);
      t.msgs.push({ id: uid('m'), from: me(), at: Date.now(), text });
      t.read = { ...(t.read || {}), [me()]: Date.now() };
      t.members.filter(m => m !== me()).forEach(m => addNote(d, m, { title: t.kind === 'group' ? `${personName(me())} w „${t.name}”` : personName(me()), body: text.length > 90 ? text.slice(0, 88) + '…' : text, link: `#/komunikacja?t=msg&c=${t.id}`, icon: 'chat' }));
    });
    ta.value = '';
    render();
    setTimeout(() => $('#convF textarea')?.focus(), 0);
  });
  if (!narrow || cur) setTimeout(() => ta.focus({ preventScroll: true }), 0);
}

function newMessageModal() {
  let people;
  if (isParent()) {
    const coaches = [...new Set(myKids().map(k => team(k.team).coach))];
    people = [...coaches, 'anna', 'ola'].map(id => ({ id, name: personName(id), sub: staff(id).role }));
  } else {
    const teams = isCoord() ? TEAMS.map(t => t.id) : myTeamIds();
    people = [...STAFF.filter(s => s.id !== me()).map(s => ({ id: s.id, name: s.name, sub: s.role })),
      ...db.parents.filter(p => p.kids.some(k => teams.includes(player(k)?.team))).map(p => ({ id: p.id, name: p.name, sub: 'rodzic: ' + p.kids.map(k => `${player(k).first} (${team(player(k).team).cat})`).join(', ') }))];
  }
  const m = modal({
    cls: 'modal--md', label: 'Nowa wiadomość',
    html: `${modalHead('Nowa wiadomość')}<div class="mb"><label class="search">${ic('search')}<input class="input" id="nmQ" placeholder="Szukaj osoby"></label><div class="plist" id="nmL"></div></div>`,
  });
  const draw = () => {
    const qv = norm($('#nmQ', m.el).value);
    $('#nmL', m.el).innerHTML = people.filter(p => !qv || norm(p.name + ' ' + p.sub).includes(qv)).slice(0, 40).map(p => `<a class="plist__i" href="#/komunikacja?t=msg&to=${p.id}">${avatar(p.name, personColor(p.id))}<span><b>${esc(p.name)}</b><small>${esc(p.sub)}</small></span></a>`).join('');
  };
  $('#nmQ', m.el).addEventListener('input', draw);
  $('#nmL', m.el).addEventListener('click', e => { if (e.target.closest('a')) m.close(); });
  draw();
  setTimeout(() => $('#nmQ', m.el).focus(), 150);
}

// ---------- posts ----------
const FILE_ICON = { video: 'film', pdf: 'file', img: 'eye' };

function postCard(p, { compact = false } = {}) {
  const liked = p.likes.includes(me()), b = p.board ? db.boards.find(x => x.id === p.board) : null;
  return `<article class="post ${p.pinned ? 'is-pinned' : ''}" data-post="${p.id}">
    <header class="post__h">${avatar(personName(p.author), personColor(p.author))}<span><b>${esc(personName(p.author))}</b><small>${ago(p.at)}${p.scope !== 'club' && p.scope !== 'staff' ? ` · szatnia ${team(p.scope).cat}` : ''}</small></span>${p.pinned ? `<span class="post__pin">${ic('pin', 'i--xs')} przypięte</span>` : ''}</header>
    <p class="post__t">${esc(p.text)}</p>
    ${b ? `<a class="post__board" ${isParent() ? '' : `href="#/tablica/${b.id}"`}>${boardSvg(b, { label: b.name })}<small>${ic('board', 'i--xs')} ${esc(b.name)}</small></a>` : ''}
    ${p.files.length ? `<div class="files">${p.files.map(f => `<button type="button" class="filechip" data-file="${esc(f.name)}">${ic(FILE_ICON[f.kind] || 'file')}<span>${esc(f.name)}<small>${esc(f.size)}</small></span></button>`).join('')}</div>` : ''}
    ${compact ? '' : `<footer class="post__f"><button type="button" class="react ${liked ? 'is-on' : ''}" data-like="${p.id}" aria-pressed="${liked}">${ic('thumb')} ${p.likes.length || ''}</button><span class="muted small">${p.comments.length ? nOf(p.comments.length, 'komentarz', 'komentarze', 'komentarzy') : ''}</span></footer>
    ${p.comments.length ? `<ul class="comments">${p.comments.map(c => `<li><b>${esc(personName(c.from))}</b> ${esc(c.text)} <small>${ago(c.at)}</small></li>`).join('')}</ul>` : ''}
    <form class="cform" data-cf="${p.id}"><input class="input input--sm" name="c" placeholder="Skomentuj…" aria-label="Komentarz"><button class="icon-btn icon-btn--sm" aria-label="Wyślij komentarz">${ic('send')}</button></form>`}
  </article>`;
}

function bindPosts(host) {
  $$('[data-like]', host).forEach(b => b.addEventListener('click', () => {
    mutate(d => { const p = d.posts.find(x => x.id === b.dataset.like); p.likes = p.likes.includes(me()) ? p.likes.filter(x => x !== me()) : [...p.likes, me()]; });
    render();
  }));
  $$('[data-cf]', host).forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    const text = f.c.value.trim();
    if (!text) return;
    mutate(d => {
      const p = d.posts.find(x => x.id === f.dataset.cf);
      p.comments.push({ from: me(), at: Date.now(), text });
      if (p.author !== me()) addNote(d, p.author, { title: `${personName(me())} skomentował(a)`, body: text, link: p.scope === 'club' ? '#/komunikacja?t=news' : p.scope === 'staff' ? '#/komunikacja?t=staff' : `#/komunikacja?t=room&team=${p.scope}`, icon: 'chat' });
    });
    render();
  }));
  $$('[data-file]', host).forEach(b => b.addEventListener('click', () => toast(`Podgląd pliku „${b.dataset.file}” — w makiecie pliki są tylko nazwami`, 'file')));
}

function composer(scope, placeholder) {
  return `<form class="card composer" id="compF"><textarea class="input" name="t" rows="2" placeholder="${placeholder}" aria-label="Treść wpisu"></textarea>
    <div class="composer__f"><span class="files" id="compFiles"></span><button type="button" class="btn btn--ghost btn--sm" id="compAtt">${ic('upload')} Plik</button>${scope === 'club' ? `<label class="check"><input type="checkbox" name="pin"><span>Przypnij</span></label>` : ''}<span class="grow"></span><button class="btn btn--primary btn--sm">${ic('send')} Opublikuj</button></div></form>`;
}

function bindComposer(scope, audience) {
  const f = $('#compF');
  if (!f) return;
  const files = [];
  $('#compAtt').addEventListener('click', () => {
    const samples = [{ name: 'plan-tygodnia.pdf', kind: 'pdf', size: '210 kB' }, { name: 'trening-klipy.mp4', kind: 'video', size: '86 MB' }, { name: 'zdjecie-druzyny.jpg', kind: 'img', size: '2,4 MB' }];
    files.push(samples[files.length % 3]);
    $('#compFiles').innerHTML = files.map(x => `<span class="filechip">${ic(FILE_ICON[x.kind])}<span>${esc(x.name)}<small>${x.size}</small></span></span>`).join('');
  });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const text = f.t.value.trim();
    if (!text) return;
    mutate(d => {
      d.posts.push({ id: uid('s'), scope, author: me(), at: Date.now(), text, files: [...files], likes: [], comments: [], pinned: !!f.pin?.checked });
      audience(d).filter(x => x !== me()).forEach(to => addNote(d, to, { title: scope === 'club' ? 'Ogłoszenie klubu' : scope === 'staff' ? 'Tablica sztabu' : `Szatnia ${team(scope).cat}`, body: `${personName(me())}: ${text.slice(0, 90)}`, link: scope === 'club' ? '#/komunikacja?t=news' : scope === 'staff' ? '#/komunikacja?t=staff' : `#/komunikacja?t=room&team=${scope}`, icon: 'chat' }));
    });
    toast('Opublikowane — odbiorcy dostali powiadomienie');
    render();
  });
}

function roomView(host, q) {
  const teams = isParent() ? [...new Set(myKids().map(k => k.team))] : isCoord() ? TEAMS.map(t => t.id) : myTeamIds();
  const tid = teams.includes(q.get('team')) ? q.get('team') : teams[0];
  const posts = db.posts.filter(p => p.scope === tid).sort((a, b) => b.at - a.at);
  const canPost = !isParent() && canEditTeam(tid);
  host.innerHTML = `<div class="feedwrap">
    ${teams.length > 1 ? `<div class="fchips">${teams.map(t => `<a class="fchip ${t === tid ? 'is-on' : ''}" style="--c:${team(t).color}" href="#/komunikacja?t=room&team=${t}"><i></i>${team(t).cat} ${team(t).name}</a>`).join('')}</div>` : ''}
    <p class="muted small">${isParent() ? 'Materiały od trenera dla zawodników i rodziców.' : `Widzą to zawodnicy i rodzice ${teamLabel(tid)}.`}</p>
    ${canPost ? composer(tid, 'Napisz do drużyny: zadanie domowe, analiza, informacja organizacyjna…') : ''}
    ${posts.map(p => postCard(p)).join('') || '<p class="empty-s">Szatnia jest pusta.</p>'}</div>`;
  bindPosts(host);
  bindComposer(tid, d => [...new Set(d.players.filter(p => p.team === tid).map(p => p.parent))]);
}

function feedView(host, scope, canPost) {
  const posts = db.posts.filter(p => p.scope === scope).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at);
  host.innerHTML = `<div class="feedwrap">
    ${scope === 'staff' ? '<p class="muted small">Materiały i ustalenia dla trenerów i fizjoterapii — rodzice tego nie widzą.</p>' : ''}
    ${canPost ? composer(scope, scope === 'club' ? 'Ogłoszenie dla całego klubu…' : 'Materiał dla sztabu…') : ''}
    ${posts.map(p => postCard(p)).join('') || '<p class="empty-s">Brak wpisów.</p>'}</div>`;
  bindPosts(host);
  bindComposer(scope, d => (scope === 'club' ? [...d.parents.map(p => p.id), ...STAFF.map(s => s.id)] : STAFF.map(s => s.id)));
}

// ---------- mass messaging ----------
function massAudiences() {
  const parentsOf = list => [...new Set(list.map(p => p.parent))];
  const M = ym(Date.now());
  return [
    { id: 'all', label: 'Wszyscy rodzice', to: () => db.parents.map(p => p.id) },
    ...TEAMS.map(t => ({ id: 'team-' + t.id, label: `Rodzice ${t.cat} · ${t.name}`, to: () => parentsOf(teamPlayers(t.id)) })),
    { id: 'overdue', label: 'Zaległe składki', to: () => parentsOf(db.players.filter(p => overdueOf(p.id).length)) },
    { id: 'med', label: 'Badania nieważne lub wygasające', to: () => parentsOf(db.players.filter(p => medStatus(p).cls !== 'ok')) },
    { id: 'unpaid', label: `Nieopłacona składka za ${MONTHS[+M.split('-')[1] - 1]}`, to: () => parentsOf(db.players.filter(p => db.charges.some(c => c.player === p.id && c.period === M && !c.paid))) },
    { id: 'staff', label: 'Sztab szkoleniowy', to: () => STAFF.map(s => s.id) },
  ];
}

function massSend(host) {
  const aud = massAudiences();
  host.innerHTML = `<div class="grid2 grid2--wide"><form class="card form" id="massF">
      <label class="field"><span>Odbiorcy</span><select class="input" name="a">${aud.map(a => `<option value="${a.id}">${a.label} (${a.to().length})</option>`).join('')}</select></label>
      <fieldset class="field"><legend>Kanał</legend><div class="seg seg--full">
        <label class="seg__b"><input type="radio" name="ch" value="push" checked><span>${ic('bell')} Push</span></label>
        <label class="seg__b"><input type="radio" name="ch" value="email"><span>${ic('mail')} E-mail</span></label>
        <label class="seg__b"><input type="radio" name="ch" value="sms"><span>${ic('sms')} SMS</span></label></div></fieldset>
      <label class="field" data-subj><span>Temat e-maila</span><input class="input" name="s" value="Informacja z akademii ${CLUB.short}"></label>
      <label class="field"><span>Treść</span><textarea class="input" name="t" rows="5" placeholder="np. Jutrzejszy trening U12 przeniesiony na orlik — boisko główne nawodnione."></textarea></label>
      <p class="mcount" id="mCount"></p>
      <button class="btn btn--primary btn--lg" id="mSend">${ic('send')} Wyślij</button></form>
    <div class="col"><section class="card"><header class="card__h"><h2>Podgląd</h2></header><div class="phone-prev"><div class="bubble" id="mPrev">…</div></div></section>
      ${card('Historia wysyłek', `<ul class="feed">${[...db.campaigns].sort((a, b) => b.at - a.at).map(c => `<li><span class="feed__i">${ic(c.channel === 'sms' ? 'sms' : c.channel === 'email' ? 'mail' : 'bell')}</span><span><b>${esc(c.audience)}</b> · ${nOf(c.count, 'odbiorca', 'odbiorców', 'odbiorców')}${c.cost ? ` · ${zl(+c.cost.toFixed(2))}` : ''}<small>${ago(c.at)} · ${esc(c.text.slice(0, 80))}</small></span></li>`).join('')}</ul>`)}</div></div>`;
  const f = $('#massF');
  const upd = () => {
    const a = aud.find(x => x.id === f.a.value), n = a.to().length, ch = f.ch.value, txt = f.t.value;
    const seg = smsSegments(`${CLUB.short}: ${txt}`), cost = ch === 'sms' ? n * seg * SMS_PRICE : 0;
    $('[data-subj]').hidden = ch !== 'email';
    $('#mPrev').innerHTML = txt.trim() ? `${ch === 'email' ? `<b>${esc(f.s.value)}</b><br>` : ''}${ch === 'sms' ? CLUB.short + ': ' : ''}${esc(txt)}` : '<span class="muted">Tu zobaczysz wiadomość</span>';
    $('#mCount').innerHTML = `${nOf(n, 'odbiorca', 'odbiorców', 'odbiorców')} · ${ch === 'sms' ? `${txt.length + CLUB.short.length + 2} znaków · ${nOf(seg, 'SMS', 'SMS-y', 'SMS-ów')} na osobę${/[^\x00-\x7F]/.test(txt) ? ' (polskie znaki — 70 na SMS)' : ''} · koszt <b>${zl(+cost.toFixed(2))}</b>` : 'bez kosztów'}`;
    $('#mSend').disabled = !txt.trim() || !n;
  };
  f.addEventListener('input', upd);
  upd();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const a = aud.find(x => x.id === f.a.value), to = a.to(), ch = f.ch.value, txt = f.t.value.trim();
    const seg = smsSegments(`${CLUB.short}: ${txt}`), cost = ch === 'sms' ? to.length * seg * SMS_PRICE : 0;
    if (!(await confirmBox({ title: `Wysłać do ${nOf(to.length, 'osoby', 'osób', 'osób')}?`, body: `${a.label} · ${ch === 'sms' ? `SMS, koszt ${zl(+cost.toFixed(2))}` : ch === 'email' ? 'e-mail' : 'powiadomienie push'}. Tego nie da się cofnąć.`, ok: 'Wyślij' }))) return;
    mutate(d => {
      to.forEach(id => addNote(d, id, { title: ch === 'email' ? f.s.value : `Wiadomość z akademii ${CLUB.short}`, body: txt, link: '#/', icon: ch === 'sms' ? 'sms' : ch === 'email' ? 'mail' : 'bell' }));
      d.campaigns.push({ id: uid('m'), at: Date.now(), by: me(), channel: ch, audience: a.label, text: txt, count: to.length, cost });
    });
    toast(`Wysłano do ${nOf(to.length, 'odbiorcy', 'odbiorców', 'odbiorców')}${cost ? ` · ${zl(+cost.toFixed(2))}` : ''}`, 'send');
    render();
  });
}
