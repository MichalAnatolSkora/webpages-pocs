// ClientTracker v2 — client accounts (panel klienta, simulated). A client with access logs in with the contact e-mail,
// sees only their own tickets, files new ones and reads their hours and monthly report. No amounts, no other clients.

const CLIENT_PASSWORD = 'klient-demo-2026';
// older saved data has no access flags: the Q-3 clients get access, as in a fresh reset
DB.clients.forEach(c => { if (c.portal == null) c.portal = ['c1', 'c2', 'c3'].includes(c.id); });

const portalClients = () => DB.clients.filter(c => c.portal && c.active && c.email).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
const clientByLogin = email => portalClients().find(c => c.email.toLowerCase() === String(email || '').trim().toLowerCase());
function setPortal(id, on) {
  const c = clientById(id);
  if (on && !c.email) throw new Invalid({ portal: 'Dodaj e-mail kontaktowy: to login klienta do panelu.' });
  c.portal = !!on;
  save();
}
// a ticket from the panel: received now, source Formularz, deadline computed the same way as for the owner's tickets
function fileClientTicket(clientId, d) {
  const c = clientById(clientId);
  if (!c || !c.portal || !c.active) throw new Invalid({ title: 'Panel klienta jest wyłączony.' });
  const t = createTicket({ clientId, title: d.title, desc: d.desc, priority: d.priority, source: 'Formularz', receivedAt: clock.now() });
  t.byClient = true;
  save();
  return t;
}
const clientTickets = clientId => DB.tickets.filter(t => t.clientId === clientId)
  .sort((a, b) => (isOpenStatus(b.status) - isOpenStatus(a.status)) || b.receivedAt - a.receivedAt);

// the monthly report as HTML for the client: headings, lists (one nested level), tables, paragraphs
function mdToHtml(md) {
  const e = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => e(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const cells = row => row.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  const lines = md.split('\n');
  let out = '', i = 0, m;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('# ')) { out += `<h2>${inline(l.slice(2))}</h2>`; i++; }
    else if (l.startsWith('## ')) { out += `<h3>${inline(l.slice(3))}</h3>`; i++; }
    else if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const body = rows.slice(2).map(r => `<tr>${cells(r).map((c, k) => `<td${k ? ' class="num"' : ''}>${inline(c)}</td>`).join('')}</tr>`).join('');
      out += `<table><thead><tr>${cells(rows[0]).map((c, k) => `<th${k ? ' class="num"' : ''}>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
    } else if (/^\s*- /.test(l)) {
      let html = '<ul>', open = false, sub = false;
      while (i < lines.length && (m = /^(\s*)- (.*)$/.exec(lines[i]))) {
        if (m[1].length >= 2) { if (!sub) { html += '<ul>'; sub = true; } html += `<li>${inline(m[2])}</li>`; }
        else { if (sub) { html += '</ul>'; sub = false; } if (open) html += '</li>'; html += `<li>${inline(m[2])}`; open = true; }
        i++;
      }
      out += html + (sub ? '</ul>' : '') + (open ? '</li>' : '') + '</ul>';
    } else if (!l.trim()) i++;
    else { out += `<p>${inline(l)}</p>`; i++; }
  }
  return out;
}
