// Tool drawings for the shadow board: one 240 × 160 drawing per tool, built from a few shapes.
// Classes: b = body (brand orange), d = dark grips and plastics, m = metal, g = glass or water,
// s = stroke-only (hoses, legs, chain), x = extras left out of the painted outline (laser beams).

function hedgeBlade() {
  let d = 'M134 86';
  for (let x = 134; x > 18; x -= 10) d += `L${x - 5} 79L${x - 10} 86`;
  d += 'L6 91L14 96';
  for (let x = 14; x < 134; x += 10) d += `L${x + 5} 103L${x + 10} 96`;
  return d + 'Z';
}

const ART = {
  wkretarka: `
    <path class="d" d="M118 80h36l-9 40h-36z"/>
    <rect class="d" x="92" y="116" width="76" height="30" rx="6"/>
    <rect class="b" x="98" y="122" width="64" height="6" rx="3"/>
    <path class="b" d="M66 30h86a26 26 0 0 1 0 52H66z"/>
    <path class="d" d="M38 40h30v32H38l-8-5V45z"/>
    <path class="m" d="M10 56l4-3h18v6H14z"/>
    <path class="d" d="M106 84h11v17h-8z"/>
    <rect class="d" x="146" y="42" width="22" height="4" rx="2"/>
    <rect class="d" x="146" y="52" width="22" height="4" rx="2"/>
    <rect class="d" x="146" y="62" width="22" height="4" rx="2"/>
    <circle class="m" cx="92" cy="56" r="6"/>`,

  mlotowiertarka: `
    <path class="d" d="M174 30h26a26 26 0 0 1 26 26v60a14 14 0 0 1-14 14h-42v-14h40V58a12 12 0 0 0-12-12h-24z"/>
    <rect class="d" x="201" y="62" width="9" height="20" rx="3"/>
    <path class="b" d="M120 72h56v38a10 10 0 0 1-10 10h-36a10 10 0 0 1-10-10z"/>
    <rect class="b" x="56" y="36" width="124" height="40" rx="10"/>
    <path class="d" d="M60 76h18l-6 52a6 6 0 0 1-6 5h-2a6 6 0 0 1-6-6z"/>
    <path class="d" d="M28 42h30v36H28l-6-6V48z"/>
    <path class="m" d="M4 60l6-3h14v6H10z"/>
    <rect class="d" x="132" y="86" width="32" height="4" rx="2"/>
    <rect class="d" x="132" y="96" width="32" height="4" rx="2"/>
    <rect class="d" x="86" y="48" width="44" height="6" rx="3"/>`,

  'szlifierka-katowa': `
    <circle class="m" cx="58" cy="84" r="46"/>
    <circle class="d" cx="58" cy="84" r="34" opacity=".12"/>
    <path class="d" d="M58 32a52 52 0 0 1 52 52H96a38 38 0 0 0-38-38z"/>
    <rect class="d" x="58" y="100" width="16" height="48" rx="7"/>
    <rect class="d" x="40" y="66" width="56" height="36" rx="9"/>
    <circle class="m" cx="58" cy="84" r="7"/>
    <path class="b" d="M92 64h92c18 0 30 9 30 20s-12 20-30 20H92z"/>
    <rect class="d" x="212" y="80" width="20" height="8" rx="4"/>
    <rect class="d" x="118" y="78" width="44" height="12" rx="6"/>
    <rect class="d" x="176" y="72" width="4" height="24" rx="2"/>
    <rect class="d" x="186" y="72" width="4" height="24" rx="2"/>
    <rect class="d" x="196" y="74" width="4" height="20" rx="2"/>`,

  wyrzynarka: `
    <path class="m" d="M50 124h8v26l-8 4z"/>
    <rect class="m" x="30" y="112" width="168" height="12" rx="3"/>
    <path class="d" d="M74 62V42a18 18 0 0 1 18-18h82a18 18 0 0 1 18 18v20h-16V46a6 6 0 0 0-6-6H96a6 6 0 0 0-6 6v16z"/>
    <rect class="d" x="110" y="46" width="26" height="8" rx="3"/>
    <path class="b" d="M46 62h136a16 16 0 0 1 16 16v34H46z"/>
    <path class="d" d="M40 72a10 10 0 0 1 10-10h24v50H40z"/>
    <rect class="d" x="148" y="84" width="36" height="14" rx="7"/>
    <rect class="d" x="92" y="78" width="4" height="22" rx="2"/>
    <rect class="d" x="102" y="78" width="4" height="22" rx="2"/>
    <rect class="d" x="112" y="78" width="4" height="22" rx="2"/>`,

  'pilarka-tarczowa': `
    <path class="m" d="M86 118a34 34 0 0 0 68 0z"/>
    <rect class="m" x="14" y="108" width="212" height="10" rx="3"/>
    <path class="b" d="M58 108a62 62 0 0 1 124 0z"/>
    <path class="d" d="M152 58c0-20 14-32 34-32h12c14 0 20 12 15 24l-16 40h-17l14-36c2-5 0-8-5-8h-8c-10 0-14 6-14 14v8z"/>
    <circle class="d" cx="124" cy="84" r="24"/>
    <circle class="b" cx="124" cy="84" r="13"/>
    <circle class="d" cx="124" cy="84" r="5"/>
    <rect class="d" x="64" y="54" width="28" height="18" rx="9"/>
    <rect class="d" x="190" y="96" width="24" height="8" rx="4"/>`,

  przecinarka: `
    <rect class="d" x="14" y="126" width="22" height="10" rx="2"/>
    <rect class="d" x="204" y="126" width="22" height="10" rx="2"/>
    <rect class="b" x="8" y="110" width="224" height="20" rx="5"/>
    <rect class="d" x="8" y="118" width="224" height="4"/>
    <rect class="d" x="22" y="72" width="12" height="40"/>
    <rect class="d" x="206" y="72" width="12" height="40"/>
    <rect class="m" x="16" y="76" width="208" height="9" rx="4.5"/>
    <path class="m" d="M128 78l44-54 9 7-44 54z"/>
    <path class="d" d="M168 30l15-19a6 6 0 0 1 9-1l3 3a6 6 0 0 1 1 8l-16 19z"/>
    <rect class="d" x="96" y="68" width="48" height="30" rx="6"/>
    <circle class="m" cx="108" cy="102" r="7"/>`,

  'szlifierka-osc': `
    <path class="g" d="M164 66h40a14 14 0 0 1 14 14v8a14 14 0 0 1-14 14h-40z"/>
    <rect class="d" x="158" y="74" width="10" height="20" rx="2"/>
    <rect class="d" x="34" y="108" width="144" height="16" rx="4"/>
    <rect class="m" x="38" y="100" width="136" height="10" rx="3"/>
    <path class="b" d="M58 100c0-34 20-56 50-56h16c30 0 44 22 44 56z"/>
    <ellipse class="d" cx="114" cy="44" rx="28" ry="12"/>
    <rect class="d" x="76" y="66" width="22" height="10" rx="5"/>
    <rect class="d" x="118" y="70" width="4" height="22" rx="2"/>
    <rect class="d" x="128" y="70" width="4" height="22" rx="2"/>
    <rect class="d" x="138" y="70" width="4" height="22" rx="2"/>`,

  myjka: `
    <path class="s" d="M162 114c14 0 16 8 24 10"/>
    <path class="d" d="M76 52V22a10 10 0 0 1 10-10h44a10 10 0 0 1 10 10v30h-12V24H88v28z"/>
    <path class="b" d="M64 48h90a14 14 0 0 1 14 14v58a12 12 0 0 1-12 12H62a12 12 0 0 1-12-12V62a14 14 0 0 1 14-14z"/>
    <rect class="d" x="132" y="130" width="26" height="12" rx="3"/>
    <circle class="d" cx="74" cy="132" r="18"/>
    <circle class="m" cx="74" cy="132" r="7"/>
    <circle class="d" cx="140" cy="74" r="10"/>
    <rect class="d" x="64" y="68" width="48" height="6" rx="3"/>
    <rect class="d" x="64" y="80" width="48" height="6" rx="3"/>
    <rect class="d" x="64" y="92" width="48" height="6" rx="3"/>
    <path class="m" d="M190 92l38-80 6 3-38 80z"/>
    <path class="d" d="M178 88h22l8 34a5 5 0 0 1-5 6h-8a5 5 0 0 1-5-4l-4-20h-8z"/>`,

  'odkurzacz-pioracy': `
    <path class="s" d="M164 96c36 0 54-20 46-52"/>
    <path class="d" d="M88 24v-8a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v8h-8v-6H96v6z"/>
    <path class="g" d="M60 56V36a12 12 0 0 1 12-12h64a12 12 0 0 1 12 12v20z"/>
    <path class="b" d="M44 70a18 18 0 0 1 18-18h84a18 18 0 0 1 18 18v52a12 12 0 0 1-12 12H56a12 12 0 0 1-12-12z"/>
    <circle class="d" cx="66" cy="138" r="10"/>
    <circle class="d" cx="142" cy="138" r="10"/>
    <rect class="d" x="56" y="88" width="96" height="10" rx="5"/>
    <rect class="d" x="152" y="84" width="16" height="22" rx="4"/>
    <rect class="d" x="204" y="30" width="12" height="16" rx="3"/>
    <path class="d" d="M188 14h40l-6 20h-28z"/>
    <rect class="m" x="192" y="10" width="32" height="5" rx="2"/>`,

  laser: `
    <path class="x beam" d="M0 60H100M140 60H240M120 0V36"/>
    <path class="s" d="M120 102L78 150M120 102v48M120 102l42 48"/>
    <rect class="d" x="106" y="92" width="28" height="12" rx="3"/>
    <rect class="d" x="112" y="28" width="16" height="10" rx="3"/>
    <rect class="b" x="96" y="34" width="48" height="60" rx="12"/>
    <rect class="d" x="104" y="46" width="32" height="26" rx="5"/>
    <circle class="x dot" cx="120" cy="59" r="4"/>
    <rect class="d" x="108" y="78" width="24" height="8" rx="4"/>`,

  nozyce: `
    <path class="m" d="${hedgeBlade()}"/>
    <path class="d" d="M134 72c0-28 10-42 28-42s28 14 28 42h-12c0-18-6-28-16-28s-16 10-16 28z"/>
    <path class="d" d="M198 78h18a14 14 0 0 1 14 14v8a14 14 0 0 1-14 14h-18v-12h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-16z"/>
    <path class="b" d="M126 70h60a22 22 0 0 1 0 44h-60z"/>
    <rect class="d" x="152" y="112" width="44" height="20" rx="5"/>
    <rect class="d" x="120" y="62" width="10" height="60" rx="3"/>
    <rect class="d" x="156" y="86" width="26" height="10" rx="5"/>`,

  'pilarka-lancuchowa': `
    <rect class="s chain" x="5" y="83" width="132" height="32" rx="16"/>
    <rect class="m" x="8" y="86" width="126" height="26" rx="13"/>
    <circle class="d" cx="22" cy="99" r="5"/>
    <path class="d" d="M126 72c2-26 14-40 36-40h28a16 16 0 0 1 16 16v24h-12V50a4 4 0 0 0-4-4h-28c-12 0-20 8-22 26z"/>
    <path class="b" d="M112 70h68a18 18 0 0 1 18 18v24a12 12 0 0 1-12 12h-74z"/>
    <path class="d" d="M116 72l-12-30a4 4 0 0 1 3-5l4-1a4 4 0 0 1 5 3l12 33z"/>
    <rect class="d" x="194" y="84" width="32" height="34" rx="8"/>
    <rect class="d" x="138" y="90" width="40" height="6" rx="3"/>
    <rect class="d" x="138" y="102" width="40" height="6" rx="3"/>`,
};

// out = rented out: only the painted outline stays on the board
function toolArt(id, { shadow = true, out = false, cls = '' } = {}) {
  const art = ART[id] || '';
  return `<svg class="art ${cls}" viewBox="0 0 240 160" aria-hidden="true">
    ${shadow ? `<g class="art__shadow">${art}</g>` : ''}
    ${out ? '' : `<g class="art__tool">${art}</g>`}
  </svg>`;
}
