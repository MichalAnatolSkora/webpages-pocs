// Namiar v1 — website thumbnails drawn from a record's scan: an era-typical homepage per
// technology, a phone view for the mobile check, error pages and a map card for firms
// without a site. Site colours are the site's own; the browser chrome follows the theme.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const THUMB_PAL = [
  ['#1f4e8c', '#4f86c6', '#e8f0fa'],
  ['#7a1f2b', '#c0392b', '#fbeeee'],
  ['#1d6b4f', '#3aa57a', '#e9f6ef'],
  ['#5b3a8c', '#8e6cc7', '#f2edf9'],
  ['#9a5b13', '#e08e2b', '#fdf3e6'],
  ['#0f5c66', '#1aa3b3', '#e6f6f8'],
  ['#3b3b3b', '#7a7a7a', '#f1f1f1'],
];

let _uid = 0;
const fit = (text, maxW, base, ratio) => +Math.min(base, maxW / Math.max(1, text.length * ratio)).toFixed(2);
const T = (x, y, size, fill, text, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(text)}</text>`;

// grey "text lines"
function lines(d, x, y, w, n, color, gap = 6, h = 2.6, center = false) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const lw = Math.round(w * (i === n - 1 ? 0.45 + d.f() * 0.3 : 0.78 + d.f() * 0.22));
    out += `<rect x="${center ? x + (w - lw) / 2 : x}" y="${y + i * gap}" width="${lw}" height="${h}" rx="${h / 2}" fill="${color}"/>`;
  }
  return out;
}

function ctxFor(r, masked) {
  const d = dice(mulberry32(r.id * 2654435761 >>> 0));
  return {
    r, d, uid: 't' + (++_uid),
    brand: masked ? r.brandM : r.brand,
    pal: THUMB_PAL[r.id % THUMB_PAL.length],
    s: r.site,
    ind: INDUSTRIES[r.ind],
  };
}

function chromeBar(url, secure) {
  const lock = '<path d="M37.6 7.4h4.8v3.8h-4.8z" fill="var(--th-ink)"/><path d="M38.6 7.4V6.3a1.4 1.4 0 0 1 2.8 0v1.1" fill="none" stroke="var(--th-ink)" stroke-width=".8"/>';
  const warn = '<path d="M40 4.6l3.2 5.8h-6.4z" fill="var(--th-hot)"/>' + T(45, 10.4, 5.6, 'var(--th-hot)', 'Niezabezpieczona', 'font-weight="600" font-family="system-ui, sans-serif"') + '<path d="M101.5 5v6" stroke="var(--th-line)" stroke-width=".7"/>';
  return `<rect width="320" height="16" fill="var(--th-bar)"/>
    <circle cx="8" cy="8" r="2.1" fill="var(--th-dot)"/><circle cx="14.5" cy="8" r="2.1" fill="var(--th-dot)"/><circle cx="21" cy="8" r="2.1" fill="var(--th-dot)"/>
    <rect x="31" y="3" width="258" height="10" rx="5" fill="var(--th-url)"/>
    ${secure ? lock : warn}
    ${T(secure ? 46 : 105, 10.4, 5.8, 'var(--th-ink)', url, 'font-family="system-ui, sans-serif"')}`;
}

// ---------- era styles: each draws a 320 × 184 page ----------
const SITE_STYLE = {
  tables(c) {
    const { uid, d } = c;
    const fs = fit(c.brand, 270, 13, 0.5);
    const nav = ['Strona główna', 'O firmie', 'Oferta', 'Galeria', 'Kontakt'];
    const bevel = (x, y, w, h, t) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#d4d0c8"/><path d="M${x} ${y + h}V${y}h${w}" fill="none" stroke="#fff"/><path d="M${x + w} ${y}v${h}H${x}" fill="none" stroke="#808080"/>${T(x + w / 2, y + h / 2 + 2.2, 5.8, '#000', t, 'text-anchor="middle" font-family="Verdana, sans-serif"')}`;
    return `<defs><linearGradient id="${uid}h" x1="0" x2="1"><stop offset="0" stop-color="#001a40"/><stop offset="1" stop-color="${c.pal[1]}"/></linearGradient>
      <pattern id="${uid}s" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="#111"/><rect x="4" width="4" height="8" fill="#ffd400"/></pattern></defs>
      <rect width="320" height="184" fill="#c9c9c9"/>
      <rect x="14" y="5" width="292" height="175" fill="#fff" stroke="#7a7a7a"/>
      <rect x="15" y="6" width="290" height="32" fill="url(#${uid}h)"/>
      ${T(161, 27.5, fs, '#000', c.brand, 'text-anchor="middle" font-family="Times New Roman, serif" font-style="italic" font-weight="700" opacity=".55"')}
      ${T(160, 26.5, fs, '#fff', c.brand, 'text-anchor="middle" font-family="Times New Roman, serif" font-style="italic" font-weight="700"')}
      <rect x="15" y="38" width="290" height="10" fill="#ffffc0"/>
      ${T(160, 45.3, 5.8, '#d00000', `*** Zapraszamy! Nowa oferta ${c.s.built}! ***`, 'text-anchor="middle" font-family="Arial, sans-serif" font-weight="700"')}
      <rect x="15" y="48" width="66" height="116" fill="#e6e6e6"/>
      ${nav.map((t, i) => bevel(19, 53 + i * 19, 58, 15, t)).join('')}
      ${T(90, 62, 10, '#cc0000', 'Witamy na naszej stronie!', 'font-family="Comic Sans MS, Chalkboard SE, cursive"')}
      ${lines(d, 90, 70, 148, 5, '#a3a3a3')}
      <rect x="246" y="54" width="52" height="40" fill="#fff" stroke="#999"/><path d="M250 58l7 7M257 58l-7 7" stroke="#d00" stroke-width="1.2"/>
      ${T(272, 82, 5, '#777', 'zdjecie1.jpg', 'text-anchor="middle" font-family="Arial, sans-serif"')}
      <rect x="90" y="106" width="96" height="16" fill="url(#${uid}s)"/><rect x="95" y="109" width="86" height="10" fill="#ffd400"/>
      ${T(138, 116.4, 6, '#111', 'STRONA W BUDOWIE', 'text-anchor="middle" font-family="Arial, sans-serif" font-weight="900"')}
      ${lines(d, 90, 130, 200, 2, '#a3a3a3')}
      <rect x="226" y="148" width="72" height="11" fill="#000"/>
      ${T(262, 155.6, 6, '#2bff2b', `Odwiedzin: ${String(4000 + c.r.id % 90000).padStart(7, '0')}`, 'text-anchor="middle" font-family="Courier New, monospace"')}
      <rect x="15" y="164" width="290" height="15" fill="#002b5c"/>
      ${T(160, 173.4, 5.4, '#fff', `© ${c.s.copy} · Strona najlepiej wygląda w rozdzielczości 1024×768`, 'text-anchor="middle" font-family="Verdana, sans-serif"')}`;
  },

  flash(c) {
    const pct = 40 + c.r.id % 50;
    return `<rect width="320" height="184" fill="#000"/>
      ${T(160, 30, fit(c.brand, 280, 9, 0.75), '#ff9a1a', c.brand.toUpperCase(), 'text-anchor="middle" font-family="Verdana, sans-serif" letter-spacing="2"')}
      <rect x="104" y="46" width="112" height="70" rx="3" fill="#2d2d2d" stroke="#4a4a4a"/>
      <path d="M151 64h5.5a3.2 3.2 0 1 1 6.4 0H169v5.5a3.2 3.2 0 1 1 0 6.4V82h-18z" fill="#8a8a8a"/>
      ${T(160, 101, 6.2, '#d0d0d0', 'Ta wtyczka nie jest obsługiwana', 'text-anchor="middle" font-family="Arial, sans-serif"')}
      <rect x="110" y="134" width="100" height="5" fill="none" stroke="#ff9a1a" stroke-width=".8"/>
      <rect x="110" y="134" width="${pct}" height="5" fill="#ff9a1a"/>
      ${T(160, 149, 6, '#ff9a1a', `Wczytywanie… ${pct}%`, 'text-anchor="middle" font-family="Verdana, sans-serif"')}
      ${T(160, 170, 6.2, '#8a8a8a', 'POMIŃ INTRO »', 'text-anchor="middle" font-family="Verdana, sans-serif" letter-spacing="1"')}`;
  },

  joomla15(c) {
    const { uid, d, pal } = c;
    const menu = ['Start', 'O nas', 'Oferta', 'Cennik', 'Galeria', 'Kontakt'];
    return `<defs><linearGradient id="${uid}b" x2="0" y2="1"><stop offset="0" stop-color="#5a5a5a"/><stop offset="1" stop-color="#262626"/></linearGradient>
      <linearGradient id="${uid}h" x2="0" y2="1"><stop offset="0" stop-color="${pal[1]}"/><stop offset="1" stop-color="${pal[0]}"/></linearGradient></defs>
      <rect width="320" height="184" fill="url(#${uid}b)"/>
      <rect x="40" width="240" height="184" fill="#fff"/>
      <rect x="40" width="240" height="34" fill="url(#${uid}h)"/><rect x="40" width="240" height="15" fill="#fff" opacity=".18"/>
      ${T(50, 20, fit(c.brand, 220, 10.5, 0.62), '#fff', c.brand, 'font-family="Verdana, sans-serif" font-weight="700"')}
      ${T(50, 29, 5.2, '#fff', `Profesjonalnie od ${c.r.fy} roku`, 'font-family="Verdana, sans-serif" opacity=".8"')}
      <rect x="40" y="34" width="240" height="11" fill="#1b1b1b"/>
      ${menu.map((t, i) => T(48 + i * 38, 41.6, 5.6, '#ddd', t, 'font-family="Verdana, sans-serif"')).join('')}
      <rect x="45" y="50" width="58" height="9" fill="${pal[0]}"/>${T(49, 56.2, 5.2, '#fff', 'Menu główne', 'font-family="Verdana, sans-serif" font-weight="700"')}
      ${[0, 1, 2, 3, 4, 5].map(i => `${T(47, 67 + i * 8, 5, pal[0], '»', 'font-family="Verdana"')}<rect x="52" y="${63.6 + i * 8}" width="${30 + (i * 7) % 18}" height="2.4" fill="#9a9a9a"/>`).join('')}
      ${T(109, 58, 8.2, pal[0], 'Aktualności', 'font-family="Verdana, sans-serif" font-weight="700"')}
      ${T(109, 65, 4.8, '#999', `Opublikowano: 12.03.${c.s.built}`, 'font-family="Verdana, sans-serif"')}
      ${lines(d, 109, 70, 110, 5, '#b5b5b5', 5.6)}
      ${T(109, 104, 5.2, pal[0], 'Czytaj dalej...', 'font-family="Verdana, sans-serif" text-decoration="underline"')}
      ${T(109, 118, 7, '#333', 'Nowa strona internetowa!', 'font-family="Verdana, sans-serif" font-weight="700"')}
      ${lines(d, 109, 124, 110, 4, '#b5b5b5', 5.6)}
      <rect x="226" y="50" width="48" height="9" fill="${pal[0]}"/>${T(229, 56.2, 5, '#fff', 'Logowanie', 'font-family="Verdana, sans-serif" font-weight="700"')}
      ${T(228, 67, 4.4, '#555', 'Użytkownik', 'font-family="Verdana"')}<rect x="228" y="69" width="44" height="7" fill="#fff" stroke="#aaa" stroke-width=".6"/>
      ${T(228, 84, 4.4, '#555', 'Hasło', 'font-family="Verdana"')}<rect x="228" y="86" width="44" height="7" fill="#fff" stroke="#aaa" stroke-width=".6"/>
      <rect x="228" y="97" width="26" height="8" fill="#e4e4e4" stroke="#999" stroke-width=".6"/>${T(241, 102.6, 4.4, '#222', 'Zaloguj', 'text-anchor="middle" font-family="Verdana"')}
      <rect x="40" y="170" width="240" height="14" fill="#eee"/>
      ${T(160, 178.6, 4.8, '#777', `© ${c.s.copy} · Wszelkie prawa zastrzeżone`, 'text-anchor="middle" font-family="Verdana, sans-serif"')}`;
  },

  phpcustom(c) {
    const { uid, d, pal } = c;
    const nav = ['HOME', 'O FIRMIE', 'USŁUGI', 'REFERENCJE', 'KONTAKT'];
    return `<defs><linearGradient id="${uid}g" x2="0" y2="1"><stop offset="0" stop-color="${pal[1]}"/><stop offset="1" stop-color="${pal[0]}"/></linearGradient></defs>
      <rect width="320" height="184" fill="${pal[2]}"/>
      <rect width="320" height="28" fill="#fff"/>
      <circle cx="20" cy="14" r="8" fill="${pal[0]}"/>${T(20, 17.2, 9, '#fff', c.brand[0], 'text-anchor="middle" font-family="Arial" font-weight="700"')}
      ${T(33, 17.4, fit(c.brand, 170, 10, 0.58), pal[0], c.brand, 'font-family="Arial, sans-serif" font-weight="700"')}
      ${T(308, 12.5, 5.4, '#555', 'tel. ' + (c.r.phoneM || '+48 000 000 000'), 'text-anchor="end" font-family="Arial"')}
      ${T(308, 20.5, 4.8, '#888', 'pon.–pt. 8:00–16:00', 'text-anchor="end" font-family="Arial"')}
      <rect y="28" width="320" height="13" fill="${pal[0]}"/>
      ${nav.map((t, i) => T(18 + i * 60, 36.6, 5.8, '#fff', t, 'font-family="Arial, sans-serif" font-weight="700"')).join('')}
      <rect x="10" y="46" width="300" height="72" fill="url(#${uid}g)"/>
      <circle cx="252" cy="66" r="12" fill="#ffd76a" opacity=".9"/>
      <path d="M10 118 L70 88 L120 104 L190 78 L250 100 L310 86 V118Z" fill="#000" opacity=".22"/>
      <rect x="30" y="84" width="140" height="22" fill="#000" opacity=".55"/>
      ${T(36, 98, 7.6, '#fff', 'Najlepsza jakość w regionie!', 'font-family="Arial, sans-serif" font-weight="700"')}
      <circle cx="20" cy="82" r="6.5" fill="#fff" opacity=".75"/>${T(20, 85, 9, '#333', '‹', 'text-anchor="middle" font-family="Arial"')}
      <circle cx="300" cy="82" r="6.5" fill="#fff" opacity=".75"/>${T(300, 85, 9, '#333', '›', 'text-anchor="middle" font-family="Arial"')}
      ${[0, 1, 2, 3].map(i => `<circle cx="${148 + i * 8}" cy="112" r="2" fill="#fff" opacity="${i ? 0.5 : 1}"/>`).join('')}
      ${['Nasza oferta', 'Realizacje', 'Kontakt'].map((t, i) => `<rect x="${10 + i * 101}" y="124" width="96" height="38" fill="#fff" stroke="#cfd6dc"/>${T(16 + i * 101, 134, 6.4, pal[0], t, 'font-family="Arial, sans-serif" font-weight="700"')}${lines(d, 16 + i * 101, 139, 82, 3, '#c3c9cf', 5.5)}`).join('')}
      <rect y="168" width="320" height="16" fill="#2c2c2c"/>
      ${T(160, 178, 5, '#bbb', `© ${c.s.copy} ${c.brand} | Projekt i wykonanie: webmaster`, 'text-anchor="middle" font-family="Arial, sans-serif"')}`;
  },

  wpold(c) {
    const { uid, d, pal } = c;
    const menu = ['Start', 'O nas', 'Oferta', 'Blog', 'Kontakt'];
    return `<defs><pattern id="${uid}p" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#e9e6df"/><path d="M0 6L6 0" stroke="#dcd8ce" stroke-width=".8"/></pattern>
      <linearGradient id="${uid}s" x2="0" y2="1"><stop offset="0" stop-color="${pal[1]}"/><stop offset="1" stop-color="${pal[2]}"/></linearGradient></defs>
      <rect width="320" height="184" fill="url(#${uid}p)"/>
      <rect x="16" width="288" height="184" fill="#000" opacity=".06"/><rect x="18" width="284" height="184" fill="#fff"/>
      <rect x="18" width="284" height="10" fill="${pal[0]}"/>
      ${T(24, 6.9, 4.8, '#fff', 'tel. ' + (c.r.phoneM || '+48 000 000 000'), 'font-family="Arial"')}
      ${[0, 1, 2].map(i => `<rect x="${280 + i * 7}" y="2.5" width="5" height="5" rx="1" fill="#fff" opacity=".85"/>`).join('')}
      ${T(26, 28, fit(c.brand, 140, 10, 0.6), '#333', c.brand, 'font-family="Georgia, serif" font-weight="700"')}
      ${menu.map((t, i) => T(176 + i * 25, 27, 5.6, '#555', t, 'font-family="Arial, sans-serif"')).join('')}
      <rect x="18" y="38" width="284" height="72" fill="url(#${uid}s)"/>
      <path d="M18 110 L70 74 L104 92 L150 62 L206 98 L246 80 L302 104 V110Z" fill="${pal[0]}" opacity=".65"/>
      <path d="M18 110 L88 92 L140 104 L210 88 L302 108 V110Z" fill="${pal[0]}"/>
      ${T(160, 70, 10.5, '#000', c.ind.slogan, 'text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" opacity=".35"')}
      ${T(160, 69, 10.5, '#fff', c.ind.slogan, 'text-anchor="middle" font-family="Arial, sans-serif" font-weight="700"')}
      <rect x="132" y="77" width="56" height="11" rx="2" fill="${pal[0]}"/>${T(160, 84.2, 5, '#fff', 'Dowiedz się więcej', 'text-anchor="middle" font-family="Arial"')}
      ${['Doświadczenie', 'Jakość', 'Terminowość'].map((t, i) => { const x = 66 + i * 94; return `<circle cx="${x}" cy="126" r="9" fill="${pal[0]}"/><path d="M${x - 3.5} ${126}l2.5 2.5 4.5-5" fill="none" stroke="#fff" stroke-width="1.4"/>${T(x, 145, 6.2, '#333', t, 'text-anchor="middle" font-family="Arial, sans-serif" font-weight="700"')}${lines(d, x - 34, 150, 68, 2, '#cfcfcf', 5, 2.4, true)}`; }).join('')}
      <rect x="18" y="168" width="284" height="16" fill="#2d2d2d"/>
      ${T(160, 178, 5, '#aaa', `© ${c.s.copy} ${c.brand} · Wszystkie prawa zastrzeżone`, 'text-anchor="middle" font-family="Arial, sans-serif"')}`;
  },

  builder(c) {
    const { uid, d, pal } = c;
    return `<defs><linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal[1]}"/><stop offset="1" stop-color="#f6c9a8"/></linearGradient></defs>
      <rect width="320" height="184" fill="#fff"/>
      ${T(12, 12, 7.2, '#222', c.brand, 'font-family="Helvetica, Arial, sans-serif" font-weight="700"')}
      <path d="M296 6.5h12M296 9.5h12M296 12.5h12" stroke="#222" stroke-width="1.2"/>
      <rect y="18" width="320" height="92" fill="url(#${uid}g)"/>
      <circle cx="54" cy="96" r="38" fill="#fff" opacity=".16"/><circle cx="276" cy="34" r="30" fill="#fff" opacity=".2"/>
      ${T(160, 66, fit(c.brand, 280, 15, 0.6), '#fff', c.brand, 'text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="800"')}
      ${T(160, 80, 6.4, '#fff', 'Witamy na naszej stronie', 'text-anchor="middle" font-family="Helvetica, Arial, sans-serif"')}
      ${T(160, 128, 9, '#222', 'O nas', 'text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700"')}
      ${lines(d, 70, 136, 180, 3, '#d6d6d6', 6, 2.6, true)}
      <rect y="166" width="320" height="18" fill="#6d3df2"/>
      ${T(12, 177.4, 5.8, '#fff', 'Ta strona powstała w darmowym kreatorze stron.', 'font-family="Helvetica, Arial, sans-serif"')}
      <rect x="248" y="169" width="62" height="12" rx="6" fill="#fff"/>${T(279, 177, 5.4, '#6d3df2', 'Stwórz własną', 'text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700"')}`;
  },

  wp6(c) {
    const { uid, d, pal } = c;
    const words = c.ind.slogan.split(' ');
    const half = Math.ceil(words.length / 2);
    const rating = c.r.g && c.r.g.rating ? String(c.r.g.rating).replace('.', ',') : '4,9';
    return `<defs><linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal[1]}"/><stop offset="1" stop-color="${pal[0]}"/></linearGradient></defs>
      <rect width="320" height="184" fill="#fff"/>
      <rect x="12" y="7" width="9" height="9" rx="2.5" fill="${pal[0]}"/>
      ${T(25, 14.4, 7, '#111', c.brand, 'font-family="Helvetica, Arial, sans-serif" font-weight="700"')}
      ${['Oferta', 'Zespół', 'Cennik'].map((t, i) => T(176 + i * 26, 14, 5.6, '#555', t, 'font-family="Helvetica, Arial, sans-serif"')).join('')}
      <rect x="258" y="6" width="52" height="12" rx="6" fill="${pal[0]}"/>${T(284, 13.8, 5.4, '#fff', c.ind.svc ? 'Umów wizytę' : 'Kontakt', 'text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700"')}
      ${T(16, 44, 5.2, pal[0], c.ind.label.toUpperCase(), 'font-family="Helvetica, Arial, sans-serif" font-weight="700" letter-spacing=".8"')}
      ${T(16, 62, 14, '#111', words.slice(0, half).join(' '), 'font-family="Helvetica, Arial, sans-serif" font-weight="800" letter-spacing="-.3"')}
      ${T(16, 78, 14, '#111', words.slice(half).join(' '), 'font-family="Helvetica, Arial, sans-serif" font-weight="800" letter-spacing="-.3"')}
      ${lines(d, 16, 88, 140, 2, '#cfcfcf', 6)}
      <rect x="16" y="104" width="58" height="14" rx="7" fill="${pal[0]}"/>${T(45, 113, 5.6, '#fff', 'Zobacz ofertę', 'text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700"')}
      <rect x="80" y="104" width="48" height="14" rx="7" fill="none" stroke="#ccc"/>${T(104, 113, 5.6, '#333', 'Kontakt', 'text-anchor="middle" font-family="Helvetica, Arial, sans-serif"')}
      <rect x="176" y="30" width="132" height="96" rx="10" fill="url(#${uid}g)"/>
      <circle cx="270" cy="64" r="22" fill="#fff" opacity=".18"/><rect x="196" y="92" width="60" height="20" rx="10" fill="#fff" opacity=".2"/>
      <rect x="160" y="104" width="74" height="24" rx="6" fill="#fff" stroke="#eee"/>
      ${T(168, 114, 6.4, '#f2a900', '★★★★★', 'font-family="Arial"')}${T(168, 123, 5, '#555', `${rating} · opinie klientów`, 'font-family="Helvetica, Arial, sans-serif"')}
      <path d="M16 140H304" stroke="#eee"/>
      ${[[`${Math.max(1, YEAR - c.r.fy)}+ lat`, 'na rynku'], [rating + ' ★', 'średnia ocen'], [`${200 + c.r.id % 1800}`, 'zadowolonych klientów']].map(([a, b], i) => T(16 + i * 96, 158, 11, '#111', a, 'font-family="Helvetica, Arial, sans-serif" font-weight="800"') + T(16 + i * 96, 167, 5.2, '#777', b, 'font-family="Helvetica, Arial, sans-serif"')).join('')}`;
  },

  modern(c) {
    const { uid, d, pal } = c;
    const words = c.ind.slogan.split(' ');
    const third = Math.ceil(words.length / 3);
    const rows = [words.slice(0, third), words.slice(third, third * 2), words.slice(third * 2)].filter(w => w.length);
    return `<defs><radialGradient id="${uid}r"><stop offset="0" stop-color="${pal[1]}" stop-opacity=".9"/><stop offset="1" stop-color="${pal[1]}" stop-opacity="0"/></radialGradient></defs>
      <rect width="320" height="184" fill="#0e0f12"/>
      <circle cx="252" cy="64" r="80" fill="url(#${uid}r)"/>
      ${T(14, 14, 7, '#fff', c.brand, 'font-family="Helvetica, Arial, sans-serif" font-weight="800"')}
      ${['Usługi', 'Realizacje', 'O nas'].map((t, i) => T(190 + i * 30, 14, 5.4, '#9aa0aa', t, 'font-family="Helvetica, Arial, sans-serif"')).join('')}
      ${rows.map((w, i) => T(14, 54 + i * 20, 17, '#fff', w.join(' '), 'font-family="Helvetica, Arial, sans-serif" font-weight="800" letter-spacing="-.5"')).join('')}
      ${lines(d, 14, 54 + rows.length * 20 - 4, 130, 2, '#3a3d45', 6)}
      <rect x="14" y="134" width="64" height="15" rx="7.5" fill="${pal[1]}"/>${T(46, 143.8, 5.8, '#0e0f12', 'Porozmawiajmy', 'text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="800"')}
      ${['szybko', 'lokalnie', 'od ' + c.r.fy].map((t, i) => `<rect x="${14 + i * 50}" y="160" width="44" height="12" rx="6" fill="none" stroke="#3a3d45"/>${T(36 + i * 50, 168, 5.2, '#c6c9d1', t, 'text-anchor="middle" font-family="Helvetica, Arial, sans-serif"')}`).join('')}`;
  },
};

function errorPage(c, url) {
  const down = c.s.status === 'down';
  return `<rect width="320" height="184" fill="#f4f4f5"/>
    <path d="M150 40h14l7 7v24h-21z" fill="#fff" stroke="#9a9aa0" stroke-width="1.4"/><path d="M164 40v7h7" fill="none" stroke="#9a9aa0" stroke-width="1.4"/>
    <circle cx="156" cy="55" r="1.3" fill="#9a9aa0"/><circle cx="164" cy="55" r="1.3" fill="#9a9aa0"/><path d="M155.5 64a5 5 0 0 1 9 0" fill="none" stroke="#9a9aa0" stroke-width="1.2"/>
    ${T(160, 98, 9.5, '#333', 'Nie można otworzyć tej strony', 'text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700"')}
    ${T(160, 112, 6, '#666', down ? `Nie znaleziono adresu serwera ${url}.` : `${url} nie może teraz obsłużyć żądania.`, 'text-anchor="middle" font-family="system-ui, sans-serif"')}
    ${T(160, 126, 5.4, '#999', down ? 'DNS_PROBE_FINISHED_NXDOMAIN' : 'HTTP ERROR 500', 'text-anchor="middle" font-family="ui-monospace, Menlo, monospace"')}
    <rect x="136" y="140" width="48" height="14" rx="4" fill="#3b6fd8"/>${T(160, 149.2, 6, '#fff', 'Odśwież', 'text-anchor="middle" font-family="system-ui, sans-serif" font-weight="600"')}`;
}

function mapCard(c) {
  const r = c.r;
  const stars = r.g && r.g.rating ? '★★★★★'.slice(0, Math.round(r.g.rating)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(r.g.rating)) : '☆☆☆☆☆';
  const rev = r.g ? `${r.g.rating ? String(r.g.rating).replace('.', ',') : '–'} (${r.g.reviews})` : 'brak opinii';
  return `<rect width="320" height="184" fill="#e4eae2"/>
    <path d="M0 52 C80 48 140 70 320 40" stroke="#fff" stroke-width="9" fill="none"/>
    <path d="M196 0 L176 184" stroke="#fff" stroke-width="7"/><path d="M0 130 L320 150" stroke="#fff" stroke-width="5"/>
    <rect x="20" y="66" width="70" height="44" rx="8" fill="#cfe3c4"/><path d="M230 0 C250 30 300 40 320 30 V0Z" fill="#b9d6e8"/>
    <path d="M160 70c-7 0-12 5-12 11.5C148 90 160 100 160 100s12-10 12-18.5C172 75 167 70 160 70z" fill="#e5484d"/><circle cx="160" cy="81.5" r="4.2" fill="#fff"/>
    <rect x="52" y="104" width="216" height="74" rx="8" fill="#000" opacity=".08"/><rect x="50" y="102" width="216" height="74" rx="8" fill="#fff"/>
    ${T(60, 117, fit(c.brand, 196, 8, 0.56), '#111', c.brand, 'font-family="system-ui, sans-serif" font-weight="700"')}
    ${T(60, 127, 6, '#f2a900', stars, 'font-family="Arial"')}${T(94, 127, 5.4, '#555', rev, 'font-family="system-ui, sans-serif"')}
    ${T(60, 136, 5.2, '#777', `${c.ind.label} · ${r.city}`, 'font-family="system-ui, sans-serif"')}
    ${['Trasa', 'Zadzwoń', 'Zapisz'].map((t, i) => `<rect x="${60 + i * 40}" y="142" width="36" height="11" rx="5.5" fill="none" stroke="#c9d2d9"/>${T(78 + i * 40, 149.4, 5, '#3b6fd8', t, 'text-anchor="middle" font-family="system-ui, sans-serif"')}`).join('')}
    ${T(60, 167, 5.6, '#c0392b', 'Brak strony internetowej', 'font-family="system-ui, sans-serif" font-weight="700"')}
    ${T(140, 167, 5.2, '#999', '+ Dodaj witrynę', 'font-family="system-ui, sans-serif"')}`;
}

function pageBody(c, url) {
  if (!c.s) return mapCard(c);
  if (c.s.status !== 'ok') return errorPage(c, url);
  return (SITE_STYLE[c.s.tech] || SITE_STYLE.wp6)(c);
}

function siteThumb(r, opt = {}) {
  const masked = opt.masked !== false;
  const c = ctxFor(r, masked);
  const url = c.s ? (masked ? c.s.domainM : c.s.domain) : `mapy.example/${masked ? maskSlug(slug(r.brand)) : slug(r.brand)}`;
  const label = c.s ? `Strona ${url}` : 'Firma bez strony — tylko wizytówka w mapach';
  return `<svg class="thumb${opt.cls ? ' ' + opt.cls : ''}" viewBox="0 0 320 200" role="img" aria-label="${esc(label)}">
    ${chromeBar(url, c.s ? c.s.https && c.s.status === 'ok' : true)}
    <g transform="translate(0 16)">${pageBody(c, url)}</g></svg>`;
}

// Phone view for the mobile check: a site without a mobile version is the desktop page shrunk to fit.
function phoneThumb(r, opt = {}) {
  const c = ctxFor(r, opt.masked !== false);
  const url = c.s ? c.s.domainM : '';
  const s = c.s;
  let screen;
  if (s && s.status === 'ok' && s.mobile) {
    const { uid, d, pal } = c;
    const dark = s.tech === 'modern';
    const bg = dark ? '#0e0f12' : '#fff';
    screen = `<defs><linearGradient id="${uid}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal[1]}"/><stop offset="1" stop-color="${pal[0]}"/></linearGradient></defs>
      <rect width="80" height="156" fill="${bg}"/>
      <rect width="80" height="14" fill="${dark ? '#0e0f12' : pal[0]}"/>
      ${T(5, 9.4, 4.6, '#fff', c.brand.length > 22 ? c.brand.slice(0, 21) + '…' : c.brand, 'font-family="Helvetica, Arial, sans-serif" font-weight="700"')}
      <path d="M69 5.5h7M69 7.5h7M69 9.5h7" stroke="#fff" stroke-width=".8"/>
      <rect x="5" y="19" width="70" height="40" rx="5" fill="url(#${uid}m)"/>
      <rect x="5" y="65" width="56" height="5" rx="2" fill="${dark ? '#fff' : '#111'}"/><rect x="5" y="73" width="40" height="5" rx="2" fill="${dark ? '#fff' : '#111'}"/>
      ${lines(d, 5, 84, 68, 3, dark ? '#3a3d45' : '#d4d4d4', 5, 2.2)}
      <rect x="5" y="102" width="70" height="12" rx="6" fill="${pal[0]}"/>${T(40, 110, 4.8, '#fff', s.booking ? 'Zarezerwuj online' : 'Zadzwoń', 'text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700"')}
      <rect x="5" y="120" width="33" height="30" rx="4" fill="${dark ? '#1b1d22' : '#f1f1f1'}"/><rect x="42" y="120" width="33" height="30" rx="4" fill="${dark ? '#1b1d22' : '#f1f1f1'}"/>`;
  } else {
    // the full desktop page, scaled to the phone's width
    const k = 80 / 320;
    screen = `<rect width="80" height="156" fill="#fff"/>
      <g transform="scale(${k})">${pageBody(c, url)}</g>
      ${s && s.status === 'ok' ? `<g font-family="system-ui, sans-serif"><rect x="8" y="78" width="64" height="44" rx="6" fill="var(--th-hot)" opacity=".1"/>
        <path d="M33 92l-4-4M33 92l-3.5.5M33 92l.5-3.5M47 92l4-4M47 92l3.5.5M47 92l-.5-3.5M33 104l-4 4M33 104l-3.5-.5M33 104l.5 3.5M47 104l4 4M47 104l3.5-.5M47 104l-.5 3.5" stroke="var(--th-hot)" stroke-width="1" fill="none" stroke-linecap="round"/>
        ${T(40, 117, 5, 'var(--th-hot)', 'trzeba powiększać', 'text-anchor="middle" font-weight="600"')}</g>` : ''}`;
  }
  return `<svg class="phone${opt.cls ? ' ' + opt.cls : ''}" viewBox="0 0 92 184" role="img" aria-label="${s && s.status === 'ok' ? (s.mobile ? 'Strona działa na telefonie' : 'Strona bez wersji mobilnej — na telefonie jest pomniejszona') : 'Widok na telefonie'}">
    <rect x="1" y="1" width="90" height="182" rx="14" fill="var(--th-phone)"/>
    <rect x="34" y="5" width="24" height="4" rx="2" fill="var(--th-dot)"/>
    <svg x="6" y="14" width="80" height="156" viewBox="0 0 80 156">${screen}</svg>
    <rect x="36" y="174" width="20" height="3" rx="1.5" fill="var(--th-dot)"/></svg>`;
}

// Four fixed specimens for the "how we score a site" section.
const SPECIMENS = [
  { id: 9001, brand: 'Hotel Pod Jodłą', ind: 'hotel', fy: 1998, city: 'Zakopane', site: { domain: 'hotel-podjodla.example', built: 2007, tech: 'tables', https: false, mobile: false, copy: 2009, changed: 2011, speed: 18, status: 'ok' } },
  { id: 9002, brand: 'Studio Urody Aura', ind: 'beauty', fy: 2012, city: 'Poznań', site: { domain: 'studio-aura.example', built: 2016, tech: 'wpold', https: true, mobile: true, copy: 2018, changed: 2021, speed: 47, status: 'ok' } },
  { id: 9003, brand: 'Kancelaria Prawna Lex', ind: 'legal', fy: 2004, city: 'Lublin', site: { domain: 'kancelaria-lex.example', built: 2019, tech: 'wp6', https: true, mobile: true, copy: YEAR, changed: 2022, speed: 58, status: 'ok' } },
  { id: 9004, brand: 'Perła-Dent', ind: 'dent', fy: 2015, city: 'Gdańsk', site: { domain: 'perla-dent.example', built: 2024, tech: 'modern', https: true, mobile: true, copy: YEAR, changed: YEAR, speed: 91, status: 'ok' }, g: { rating: 4.9, reviews: 312 } },
];
for (const s of SPECIMENS) {
  Object.assign(s.site, { domainM: s.site.domain, host: s.site.domain.replace('.example', '') });
  Object.assign(s, { brandM: s.brand, score: siteScore(s.site), phoneM: '+48 00 000 00 00' });
}
