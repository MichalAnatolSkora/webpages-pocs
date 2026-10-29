// Rocznik v1 — the canonical code dictionary, the e-sprawozdanie XML trees per entity type,
// a generator that writes a signed XML from the mock data, and a real parser (DOMParser) that reads it back.
// Element names follow the shape of the MF structures; exact XSD paths per schema version are illustrative.

// ---------- canonical codes ----------
// lvl: indent in statements; tot: bold total row; only: entity types that report it
const CODES = [
  // bilans: aktywa
  ['BS.A', 'Aktywa trwałe', 0], ['BS.A.I', 'Wartości niematerialne i prawne', 1], ['BS.A.II', 'Rzeczowe aktywa trwałe', 1],
  ['BS.A.III', 'Należności długoterminowe', 1], ['BS.A.IV', 'Inwestycje długoterminowe', 1], ['BS.A.V', 'Długoterminowe rozliczenia międzyokresowe', 1],
  ['BS.B', 'Aktywa obrotowe', 0], ['BS.B.I', 'Zapasy', 1], ['BS.B.II', 'Należności krótkoterminowe', 1], ['BS.B.III', 'Inwestycje krótkoterminowe', 1],
  ['BS.B.III.CASH', 'Środki pieniężne i inne aktywa pieniężne', 2], ['BS.B.IV', 'Krótkoterminowe rozliczenia międzyokresowe', 1],
  ['BS.C', 'Należne wpłaty na kapitał podstawowy', 0], ['BS.D', 'Udziały (akcje) własne', 0], ['BS.TOT', 'Aktywa razem', 0, true],
  // bilans: pasywa
  ['BS.P.A', 'Kapitał (fundusz) własny', 0], ['BS.P.A.I', 'Kapitał (fundusz) podstawowy', 1], ['BS.P.A.II', 'Kapitał (fundusz) zapasowy', 1],
  ['BS.P.A.III', 'Kapitał z aktualizacji wyceny', 1], ['BS.P.A.IV', 'Pozostałe kapitały rezerwowe', 1], ['BS.P.A.V', 'Zysk (strata) z lat ubiegłych', 1],
  ['BS.P.A.VI', 'Zysk (strata) netto', 1], ['BS.P.A.VII', 'Odpisy z zysku netto w ciągu roku', 1],
  ['BS.P.B', 'Zobowiązania i rezerwy na zobowiązania', 0], ['BS.P.B.I', 'Rezerwy na zobowiązania', 1], ['BS.P.B.II', 'Zobowiązania długoterminowe', 1],
  ['BS.P.B.III', 'Zobowiązania krótkoterminowe', 1], ['BS.P.B.IV', 'Rozliczenia międzyokresowe', 1], ['BS.P.TOT', 'Pasywa razem', 0, true],
  // rachunek zysków i strat (wspólne kody dla wariantu porównawczego, kalkulacyjnego i mikro)
  ['PL.REV', 'Przychody netto ze sprzedaży', 0, true], ['PL.OPEX', 'Koszty działalności operacyjnej', 0],
  ['PL.OPEX.DA', 'Amortyzacja', 1], ['PL.OPEX.MAT', 'Zużycie materiałów i energii', 1], ['PL.OPEX.SERV', 'Usługi obce', 1], ['PL.OPEX.TAXES', 'Podatki i opłaty', 1],
  ['PL.OPEX.WAGE', 'Wynagrodzenia', 1], ['PL.OPEX.SOC', 'Ubezpieczenia społeczne i inne świadczenia', 1], ['PL.OPEX.OTH', 'Pozostałe koszty rodzajowe', 1],
  ['PL.OPEX.GOODS', 'Wartość sprzedanych towarów i materiałów', 1],
  ['PL.COGS', 'Koszty sprzedanych produktów, towarów i materiałów', 1], ['PL.GROSS', 'Zysk (strata) brutto ze sprzedaży', 1], ['PL.SELL', 'Koszty sprzedaży', 1], ['PL.ADMIN', 'Koszty ogólnego zarządu', 1],
  ['PL.SALES', 'Zysk (strata) ze sprzedaży', 0], ['PL.OOI', 'Pozostałe przychody operacyjne', 0], ['PL.OOE', 'Pozostałe koszty operacyjne', 0],
  ['PL.EBIT', 'Zysk (strata) z działalności operacyjnej (EBIT)', 0, true], ['PL.FININC', 'Przychody finansowe', 0], ['PL.FINEXP', 'Koszty finansowe', 0],
  ['PL.EBT', 'Zysk (strata) brutto', 0, true], ['PL.TAX', 'Podatek dochodowy', 0], ['PL.OTHRED', 'Pozostałe obowiązkowe zmniejszenia zysku', 0], ['PL.NET', 'Zysk (strata) netto', 0, true],
  // przepływy (metoda pośrednia)
  ['CF.OP.NET', 'Zysk (strata) netto', 1], ['CF.OP.ADJ', 'Korekty razem', 1], ['CF.OP.DA', 'w tym amortyzacja', 2], ['CF.OP', 'Przepływy netto z działalności operacyjnej', 0, true],
  ['CF.INV', 'Przepływy netto z działalności inwestycyjnej', 0, true], ['CF.FIN.DIV', 'Dywidendy i inne wypłaty na rzecz właścicieli', 1], ['CF.FIN', 'Przepływy netto z działalności finansowej', 0, true],
  ['CF.NET', 'Przepływy pieniężne netto razem', 0, true], ['CF.CASH.BEG', 'Środki pieniężne na początek okresu', 0], ['CF.CASH.END', 'Środki pieniężne na koniec okresu', 0],
  // zestawienie zmian w kapitale
  ['EQ.OPEN', 'Kapitał własny na początek okresu (BO)', 0], ['EQ.CLOSE', 'Kapitał własny na koniec okresu (BZ)', 0, true],
].map(([code, label, lvl, tot]) => ({ code, label, lvl, tot: !!tot }));
const CODE = Object.fromEntries(CODES.map(c => [c.code, c]));

// statement layouts on the company page: [title, codes]
const STATEMENTS = {
  bilans: [
    ['Aktywa', ['BS.A', 'BS.A.I', 'BS.A.II', 'BS.A.III', 'BS.A.IV', 'BS.A.V', 'BS.B', 'BS.B.I', 'BS.B.II', 'BS.B.III', 'BS.B.III.CASH', 'BS.B.IV', 'BS.C', 'BS.D', 'BS.TOT']],
    ['Pasywa', ['BS.P.A', 'BS.P.A.I', 'BS.P.A.II', 'BS.P.A.III', 'BS.P.A.IV', 'BS.P.A.V', 'BS.P.A.VI', 'BS.P.A.VII', 'BS.P.B', 'BS.P.B.I', 'BS.P.B.II', 'BS.P.B.III', 'BS.P.B.IV', 'BS.P.TOT']],
  ],
  rzis: [
    ['Rachunek zysków i strat', ['PL.REV', 'PL.OPEX', 'PL.OPEX.DA', 'PL.OPEX.MAT', 'PL.OPEX.SERV', 'PL.OPEX.TAXES', 'PL.OPEX.WAGE', 'PL.OPEX.SOC', 'PL.OPEX.OTH', 'PL.OPEX.GOODS', 'PL.COGS', 'PL.GROSS', 'PL.SELL', 'PL.ADMIN', 'PL.SALES', 'PL.OOI', 'PL.OOE', 'PL.EBIT', 'PL.FININC', 'PL.FINEXP', 'PL.EBT', 'PL.TAX', 'PL.NET']],
  ],
  cf: [
    ['Rachunek przepływów pieniężnych', ['CF.OP.NET', 'CF.OP.ADJ', 'CF.OP.DA', 'CF.OP', 'CF.INV', 'CF.FIN.DIV', 'CF.FIN', 'CF.NET', 'CF.CASH.BEG', 'CF.CASH.END']],
    ['Zestawienie zmian w kapitale własnym', ['EQ.OPEN', 'EQ.CLOSE']],
  ],
};

// ---------- XML trees per entity type ----------
// node: [element, code | null (kept raw, no canonical code), children?, sign?]  sign −1: the XML holds an outflow as a positive number
const N = (el, code, kids, sign, rawKey) => ({ el, code, kids: kids || null, sign: sign || 1, rawKey });
const ASSETS = (withCash) => N('Aktywa', 'BS.TOT', [
  N('Aktywa_A', 'BS.A', [N('Aktywa_A_I', 'BS.A.I'), N('Aktywa_A_II', 'BS.A.II'), N('Aktywa_A_III', 'BS.A.III'), N('Aktywa_A_IV', 'BS.A.IV'), N('Aktywa_A_V', 'BS.A.V')]),
  N('Aktywa_B', 'BS.B', [N('Aktywa_B_I', 'BS.B.I'), N('Aktywa_B_II', 'BS.B.II'),
    N('Aktywa_B_III', 'BS.B.III', withCash ? [N('Aktywa_B_III_1', null, [N('Aktywa_B_III_1_C', 'BS.B.III.CASH')])] : null), N('Aktywa_B_IV', 'BS.B.IV')]),
  N('Aktywa_C', 'BS.C'), N('Aktywa_D', 'BS.D'),
]);
const LIABS = N('Pasywa', 'BS.P.TOT', [
  N('Pasywa_A', 'BS.P.A', ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'].map(r => N('Pasywa_A_' + r, 'BS.P.A.' + r))),
  N('Pasywa_B', 'BS.P.B', ['I', 'II', 'III', 'IV'].map(r => N('Pasywa_B_' + r, 'BS.P.B.' + r))),
]);
const RZIS_POR = N('RZiSPor', undefined, [
  N('A', 'PL.REV'), N('B', 'PL.OPEX', ['DA', 'MAT', 'SERV', 'TAXES', 'WAGE', 'SOC', 'OTH', 'GOODS'].map((k, i) => N('B_' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][i], 'PL.OPEX.' + k))),
  N('C', 'PL.SALES'), N('D', 'PL.OOI'), N('E', 'PL.OOE'), N('F', 'PL.EBIT'), N('G', 'PL.FININC'), N('H', 'PL.FINEXP'),
  N('I', 'PL.EBT'), N('J', 'PL.TAX'), N('K', 'PL.OTHRED'), N('L', 'PL.NET'),
]);
const RZIS_KALK = N('RZiSKalk', undefined, [
  N('A', 'PL.REV'), N('B', 'PL.COGS'), N('C', 'PL.GROSS'), N('D', 'PL.SELL'), N('E', 'PL.ADMIN'), N('F', 'PL.SALES'), N('G', 'PL.OOI'), N('H', 'PL.OOE'),
  N('I', 'PL.EBIT'), N('J', 'PL.FININC'), N('K', 'PL.FINEXP'), N('L', 'PL.EBT'), N('M', 'PL.TAX'), N('N', 'PL.OTHRED'), N('O', 'PL.NET'),
]);
const RZIS_MIKRO = N('RZiSMikro', undefined, [N('A', 'PL.REV'), N('B', 'PL.OPEX'), N('C', 'PL.OOI'), N('D', 'PL.OOE'), N('E', 'PL.TAX'), N('F', 'PL.NET')]);
const CF_POSR = N('PrzeplywyPosr', undefined, [
  N('A_I', 'CF.OP.NET'), N('A_II', 'CF.OP.ADJ', [N('A_II_1', 'CF.OP.DA')]), N('A_III', 'CF.OP'), N('B_III', 'CF.INV'),
  N('C_II', null, [N('C_II_2', 'CF.FIN.DIV', null, -1)]), N('C_III', 'CF.FIN'), N('D', 'CF.NET'), N('F', 'CF.CASH.BEG'), N('G', 'CF.CASH.END'),
]);
const EQ_TREE = N('ZestZmianWKapitale', undefined, [N('I', 'EQ.OPEN'), N('II', 'EQ.CLOSE'), N('III', null, null, 1, 'EQ.AFTERDIV')]);
const MIKRO_BS = [
  N('Aktywa', 'BS.TOT', [N('Aktywa_A', 'BS.A'), N('Aktywa_B', 'BS.B', [N('Aktywa_B_I', 'BS.B.I'), N('Aktywa_B_II', 'BS.B.II'), N('Aktywa_B_III', 'BS.B.III')])]),
  N('Pasywa', 'BS.P.TOT', [N('Pasywa_A', 'BS.P.A', [N('Pasywa_A_I', 'BS.P.A.I')]), N('Pasywa_B', 'BS.P.B')]),
];

const ENTITY = {
  Inna: { label: 'jednostka inna (pełna)', root: 'JednostkaInna', short: 'Inna' },
  Mala: { label: 'jednostka mała', root: 'JednostkaMala', short: 'Mała' },
  Mikro: { label: 'jednostka mikro', root: 'JednostkaMikro', short: 'Mikro' },
  Op: { label: 'organizacja pożytku publicznego', root: 'JednostkaOp', short: 'OPP' },
};
const VARIANT = { por: 'porównawczy', kalk: 'kalkulacyjny', mikro: 'uproszczony (mikro)' };
const NS_BASE = 'http://www.mf.gov.pl/schematy/SF/DefinicjeTypySprawozdaniaFinansowe/2018/07/09/';
const DS_NS = 'http://www.w3.org/2000/09/xmldsig#';
const XADES_NS = 'http://uri.etsi.org/01903/v1.3.2#';
const schemaVersion = fy => fy <= 2018 ? '1-0' : fy <= 2021 ? '1-1' : '1-2';

function treesFor(type, variant, cf) {
  const sec = [];
  if (type === 'Mikro') sec.push(['Bilans', MIKRO_BS], ['RZiS', [RZIS_MIKRO]]);
  else {
    sec.push(['Bilans', [ASSETS(type === 'Inna'), LIABS]], ['RZiS', [variant === 'kalk' ? RZIS_KALK : RZIS_POR]]);
    if (cf) sec.push(['RachPrzeplywow', [CF_POSR]]);
    if (type === 'Inna') sec.push(['ZestZmianWKapitale', EQ_TREE.kids, true]);
  }
  return sec;
}

// every path → code pair a parser knows for a schema (used by the parser and the mapping table)
function mappingFor(type, variant) {
  const out = [];
  for (const [section, nodes, flat] of treesFor(type, variant, true)) {
    const walk = (n, path) => {
      const p = path ? `${path}/${n.el}` : n.el;
      if (n.code !== undefined) out.push({ path: p, code: n.code, sign: n.sign });
      (n.kids || []).forEach(k => walk(k, p));
    };
    nodes.forEach(n => walk(n, flat ? section : section));
  }
  return out;
}

// ---------- XML generator ----------
const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function amount(v, unit) {
  const x = unit === 'tys' ? v / 1000 : v;
  return x.toFixed(2);
}

// values for one node: a code's value, or for raw nodes the sum of their children
function nodeVal(n, v) {
  if (n.code) return (v[n.code] || 0) * n.sign;
  if (n.rawKey) return v[n.rawKey] || 0;
  if (n.kids) return n.kids.reduce((t, k) => t + Math.abs(nodeVal(k, v)), 0);
  return 0;
}

// opts: { orig: bool (the replaced first filing), sig: 'enveloped'|'enveloping'|'base64'|'none', broken: bool }
function buildXml(c, fy, opts = {}) {
  const f = fin(c), y = f.y[fy];
  const prevY = f.y[fy - 1];
  const vA = { ...y.v, ...(opts.orig && y.orig), 'EQ.AFTERDIV': (y.v['EQ.CLOSE'] || 0) - y.divDeclared };
  const vB = prevY ? { ...prevY.v, 'EQ.AFTERDIV': (prevY.v['EQ.CLOSE'] || 0) - prevY.divDeclared } : {};
  const unitName = y.unit === 'tys' ? 'WTysiacach' : 'WZlotych';
  const root = ENTITY[y.type].root;
  const ns = NS_BASE + root + unitName;
  const kod = `SprFin${root}${unitName}`;
  const sigMode = opts.sig || y.sig;
  const lines = [];
  const pad = n => '  '.repeat(n);
  const emit = (n, depth) => {
    const a = nodeVal(n, vA), b = prevY ? nodeVal(n, vB) : 0;
    const bad = opts.broken && n.code === 'BS.P.TOT' ? (y.unit === 'tys' ? 3000 : 3) : 0;
    lines.push(`${pad(depth)}<${n.el}>`);
    if (n.code !== undefined) {
      lines.push(`${pad(depth + 1)}<KwotaA>${amount(a + bad, y.unit)}</KwotaA>`);
      lines.push(`${pad(depth + 1)}<KwotaB>${amount(b, y.unit)}</KwotaB>`);
    }
    (n.kids || []).forEach(k => emit(k, depth + 1));
    lines.push(`${pad(depth)}</${n.el}>`);
  };
  const ind = sigMode === 'enveloping' || sigMode === 'base64' ? 2 : 0;
  const L = (s, d = 0) => lines.push(pad(ind + d) + s);
  L(`<${root} xmlns="${ns}" xmlns:dtsf="${NS_BASE}DefinicjeTypySprawozdaniaFinansowe">`);
  L('<Naglowek>', 1);
  L(`<KodSprawozdania kodSystemowy="${kod} (1)" wersjaSchemy="${schemaVersion(fy)}">${kod}</KodSprawozdania>`, 2);
  L('<WariantSprawozdania>1</WariantSprawozdania>', 2);
  L(`<OkresOd>${fy}-01-01</OkresOd>`, 2);
  L(`<OkresDo>${fy}-12-31</OkresDo>`, 2);
  L(`<DataSporzadzenia>${isoDate(addDays(y.approved, -40))}</DataSporzadzenia>`, 2);
  L('</Naglowek>', 1);
  L('<WprowadzenieDoSprawozdaniaFinansowego>', 1);
  L(`<P_1><P_1A><dtsf:NazwaFirmy>${xmlEsc(c.krsName)}</dtsf:NazwaFirmy><dtsf:Siedziba><dtsf:KodKraju>PL</dtsf:KodKraju><dtsf:Wojewodztwo>${upperPl(c.woj)}</dtsf:Wojewodztwo><dtsf:Miejscowosc>${upperPl(c.city)}</dtsf:Miejscowosc></dtsf:Siedziba></P_1A>`, 2);
  L(`<P_1D><dtsf:NIP>${c.nip}</dtsf:NIP><dtsf:KRS>${c.krs}</dtsf:KRS></P_1D></P_1>`, 2);
  L('<P_3><DataOd>' + fy + '-01-01</DataOd><DataDo>' + fy + '-12-31</DataDo></P_3>', 2);
  L('<P_5>…zasady (polityka) rachunkowości, tekst pod LLM…</P_5>', 2);
  L('</WprowadzenieDoSprawozdaniaFinansowego>', 1);
  for (const [section, nodes, flat] of treesFor(y.type, y.variant, y.cf)) {
    L(`<${section}>`, 1);
    if (flat) nodes.forEach(n => emit(n, ind + 2));
    else nodes.forEach(n => {
      if (n.code === undefined) { L(`<${n.el}>`, 2); n.kids.forEach(k => emit(k, ind + 3)); L(`</${n.el}>`, 2); }
      else emit(n, ind + 2);
    });
    L(`</${section}>`, 1);
  }
  L('<DodatkoweInformacjeIObjasnienia>…informacja dodatkowa, załącznik PDF…</DodatkoweInformacjeIObjasnienia>', 1);
  const sigId = 'sig-' + fakeSha(c.krs + fy).slice(0, 10);
  const signedAt = `${isoDate(y.filed)}T${String(8 + (hashStr(c.krs) % 9)).padStart(2, '0')}:${String(hashStr(c.krs + fy) % 60).padStart(2, '0')}:07Z`;
  const sigBlock = (d, ref) => [
    `<ds:Signature xmlns:ds="${DS_NS}" Id="${sigId}">`,
    '  <ds:SignedInfo>',
    '    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
    '    <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>',
    `    <ds:Reference URI="${ref}">`,
    ref === '' ? '      <ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></ds:Transforms>' : null,
    '      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>',
    `      <ds:DigestValue>${btoa(fakeSha(c.krs + fy + 'd').slice(0, 32))}</ds:DigestValue>`,
    '    </ds:Reference>',
    '  </ds:SignedInfo>',
    `  <ds:SignatureValue>${btoa(fakeSha(c.krs + 'v' + fy) + fakeSha(fy + c.krs)).slice(0, 88)}…</ds:SignatureValue>`,
    `  <ds:KeyInfo><ds:X509Data><ds:X509Certificate>MIIH${btoa(fakeSha(c.nip)).slice(0, 60)}…</ds:X509Certificate></ds:X509Data></ds:KeyInfo>`,
  ].filter(Boolean).map(s => pad(d) + s);
  const xadesObj = d => [
    `  <ds:Object><xades:QualifyingProperties xmlns:xades="${XADES_NS}" Target="#${sigId}">`,
    `    <xades:SignedProperties><xades:SignedSignatureProperties><xades:SigningTime>${signedAt}</xades:SigningTime></xades:SignedSignatureProperties></xades:SignedProperties>`,
    '  </xades:QualifyingProperties></ds:Object>',
  ].map(s => pad(d) + s);

  if (sigMode === 'enveloping' || sigMode === 'base64') {
    const body = lines.slice();
    if (sigMode === 'base64') {
      const inner = body.map(s => s.slice(4)).join('\n') + `\n</${root}>`;
      let bin = '';
      for (const byte of new TextEncoder().encode(inner)) bin += String.fromCharCode(byte);
      const b64 = btoa(bin);
      return ['<?xml version="1.0" encoding="UTF-8"?>', ...sigBlock(0, '#obj-1'),
        `  <ds:Object Id="obj-1" Encoding="${DS_NS}base64">`, ...b64.match(/.{1,76}/g).map(s => '    ' + s), '  </ds:Object>',
        ...xadesObj(0), '</ds:Signature>'].join('\n');
    }
    return ['<?xml version="1.0" encoding="UTF-8"?>', ...sigBlock(0, '#obj-1'), '  <ds:Object Id="obj-1">',
      ...body, `    </${root}>`, '  </ds:Object>', ...xadesObj(0), '</ds:Signature>'].join('\n');
  }
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', ...lines];
  if (sigMode === 'enveloped') out.push(...sigBlock(1, ''), ...xadesObj(1), '  </ds:Signature>');
  out.push(`</${root}>`);
  return out.join('\n');
}

// ---------- parser ----------
// returns { steps: [{ key, title, detail, ok }], meta, rows: [{ path, code, a, b }], unmapped, checks }
function parseSprawozdanie(text) {
  const steps = [];
  const step = (key, title, detail, ok = true) => steps.push({ key, title, detail, ok });
  let doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) { step('read', 'Odczyt XML', 'Plik nie jest poprawnym XML-em', false); return { steps }; }
  step('read', 'Odczyt bloba', `${num(text.length)} znaków · klucz ${fakeSha(text).slice(0, 12)}…`);

  // 1. signature: enveloping wraps the document in ds:Object, enveloped sits inside it
  let root = doc.documentElement, sigMode = 'brak podpisu';
  if (root.localName === 'Signature' && root.namespaceURI === DS_NS) {
    const objs = [...root.getElementsByTagNameNS(DS_NS, 'Object')].filter(o => !o.getElementsByTagNameNS(XADES_NS, 'QualifyingProperties').length);
    const obj = objs[0];
    if (/base64/.test(obj.getAttribute('Encoding') || '')) {
      const bin = atob(obj.textContent.replace(/\s+/g, ''));
      const inner = new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
      doc = new DOMParser().parseFromString(inner, 'application/xml');
      root = doc.documentElement;
      sigMode = 'XAdES enveloping, treść w base64';
      step('sig', 'Zdjęcie podpisu', `Element główny to ds:Signature. Dokument leży w ds:Object jako base64 (${num(bin.length)} B po zdekodowaniu).`);
    } else {
      root = [...obj.children][0];
      sigMode = 'XAdES enveloping';
      step('sig', 'Zdjęcie podpisu', 'Element główny to ds:Signature. Wyjmuję dokument z ds:Object, podpis odkładam do bloba.');
    }
  } else {
    const sig = [...root.children].find(e => e.localName === 'Signature' && e.namespaceURI === DS_NS);
    if (sig) {
      const when = sig.getElementsByTagNameNS(XADES_NS, 'SigningTime')[0];
      sig.remove();
      sigMode = 'XAdES enveloped';
      step('sig', 'Zdjęcie podpisu', `ds:Signature wewnątrz dokumentu (transformacja enveloped-signature), podpisano ${when ? when.textContent.replace('T', ' ').replace('Z', ' UTC') : '—'}. Usuwam węzeł.`);
    } else step('sig', 'Zdjęcie podpisu', 'Plik bez podpisu: zapisuję z flagą do weryfikacji.', true);
  }

  // 2. entity type, unit and schema version from the root element and namespace
  const ns = root.namespaceURI || '';
  const mNs = ns.match(/\/(\d{4}\/\d{2}\/\d{2})\/(Jednostka\w+?)(WZlotych|WTysiacach)$/);
  const type = Object.keys(ENTITY).find(k => ENTITY[k].root === root.localName);
  if (!type || !mNs) { step('type', 'Rozpoznanie schematu', `Nieznany element główny ${root.localName}`, false); return { steps }; }
  const unit = mNs[3] === 'WTysiacach' ? 'tys' : 'zl';
  const mult = unit === 'tys' ? 1000 : 1;
  const kids = el => [...el.children];
  const child = (el, name) => kids(el).find(e => e.localName === name);
  const nag = child(root, 'Naglowek');
  const kod = nag && child(nag, 'KodSprawozdania');
  const version = kod ? kod.getAttribute('wersjaSchemy') : '?';
  const from = nag && child(nag, 'OkresOd').textContent, to = nag && child(nag, 'OkresDo').textContent;
  const intro = child(root, 'WprowadzenieDoSprawozdaniaFinansowego');
  const krsEl = intro && intro.getElementsByTagNameNS('*', 'KRS')[0];
  if (type === 'Op') {
    step('type', 'Rozpoznanie schematu', `<${root.localName}>: organizacja pożytku publicznego z rejestru S. Poza fazą 1: zapisuję blob i metadane, parser OPP jest w planie.`, 'warn');
    return { steps };
  }
  step('type', 'Rozpoznanie schematu', `<${root.localName}> · namespace z datą ${mNs[1]} · ${unit === 'tys' ? 'kwoty w tysiącach zł (×1000)' : 'kwoty w złotych'} · wersja schematu ${version}`);

  // 3. sections and the profit-and-loss variant
  const rzis = child(root, 'RZiS');
  const rzisKind = rzis && kids(rzis)[0] ? kids(rzis)[0].localName : null;
  const variant = rzisKind === 'RZiSKalk' ? 'kalk' : rzisKind === 'RZiSMikro' ? 'mikro' : 'por';
  const cfEl = child(root, 'RachPrzeplywow');
  const secs = ['Bilans', 'RZiS', 'RachPrzeplywow', 'ZestZmianWKapitale'].map(s => [s, !!child(root, s)]);
  step('sections', 'Sekcje', secs.map(([s, has]) => `${s}${s === 'RZiS' && has ? ` (${VARIANT[variant]})` : ''}${s === 'RachPrzeplywow' && has ? ` (${cfEl && kids(cfEl)[0].localName === 'PrzeplywyPosr' ? 'metoda pośrednia' : 'metoda bezpośrednia'})` : ''}: ${has ? 'jest' : 'brak'}`).join(' · '));

  // 4. walk every element that carries KwotaA and map its path to a canonical code
  const map = new Map(mappingFor(type, variant).map(m => [m.path, m]));
  const rows = [], unmapped = [];
  const toNum = s => Math.round(parseFloat(s) * mult);
  const walk = (el, path) => {
    const p = `${path}/${el.localName}`;
    const a = child(el, 'KwotaA'), b = child(el, 'KwotaB');
    if (a) {
      const m = map.get(p.slice(1));
      const rec = { path: p.slice(1), a: toNum(a.textContent), b: b ? toNum(b.textContent) : null };
      if (m && m.code) { rec.code = m.code; rec.a *= m.sign; if (rec.b != null) rec.b *= m.sign; rows.push(rec); } else unmapped.push(rec);
    }
    kids(el).filter(k => k.localName !== 'KwotaA' && k.localName !== 'KwotaB').forEach(k => walk(k, p));
  };
  for (const s of ['Bilans', 'RZiS', 'RachPrzeplywow', 'ZestZmianWKapitale']) { const el = child(root, s); if (el) walk(el, ''); }
  // kalkulacyjny has no single cost line: the canonical PL.OPEX is B + D + E
  if (variant === 'kalk') {
    const g = code => rows.find(r => r.code === code);
    const parts = ['PL.COGS', 'PL.SELL', 'PL.ADMIN'].map(g);
    if (parts.every(Boolean)) rows.push({ path: 'B + D + E (wyliczone)', code: 'PL.OPEX', a: parts.reduce((t, r) => t + r.a, 0), b: parts.reduce((t, r) => t + (r.b || 0), 0), derived: true });
  }
  step('map', 'Mapowanie na kody kanoniczne', `${rows.length} pozycji z kodem${unmapped.length ? `, ${unmapped.length} bez kodu (zostają w surowym JSON)` : ''}. KwotaA → kwota_bieżąca, KwotaB → kwota_poprzednia.`);

  // 5. arithmetic checks with a tolerance of one unit of the file
  const V = Object.fromEntries(rows.map(r => [r.code, r.a]));
  const tol = mult;
  const checks = [];
  const chk = (label, l, r) => { if (l == null || Number.isNaN(l) || Number.isNaN(r)) return; checks.push({ label, diff: l - r, ok: Math.abs(l - r) <= tol }); };
  const s = (...codes) => codes.reduce((t, k) => t + (V[k] || 0), 0);
  chk('Aktywa razem = Pasywa razem', V['BS.TOT'], V['BS.P.TOT']);
  if (type === 'Mikro') {
    chk('Aktywa = A + B', V['BS.TOT'], s('BS.A', 'BS.B'));
    chk('Netto = A − B + C − D − E', V['PL.NET'], V['PL.REV'] - V['PL.OPEX'] + V['PL.OOI'] - V['PL.OOE'] - V['PL.TAX']);
  } else {
    chk('Aktywa = A + B + C + D', V['BS.TOT'], s('BS.A', 'BS.B', 'BS.C', 'BS.D'));
    chk('Pasywa = A + B', V['BS.P.TOT'], s('BS.P.A', 'BS.P.B'));
    chk('Zysk ze sprzedaży = przychody − koszty', V['PL.SALES'], V['PL.REV'] - V['PL.OPEX']);
    chk('EBIT = sprzedaż + pozostałe przychody − pozostałe koszty', V['PL.EBIT'], V['PL.SALES'] + V['PL.OOI'] - V['PL.OOE']);
    chk('Brutto = EBIT + przychody fin. − koszty fin.', V['PL.EBT'], V['PL.EBIT'] + V['PL.FININC'] - V['PL.FINEXP']);
    chk('Netto = brutto − podatek − pozostałe', V['PL.NET'], V['PL.EBT'] - V['PL.TAX'] - (V['PL.OTHRED'] || 0));
    if (V['CF.NET'] != null) chk('Przepływy netto = A.III + B.III + C.III', V['CF.NET'], s('CF.OP', 'CF.INV', 'CF.FIN'));
  }
  const bad = checks.filter(x => !x.ok);
  step('checks', 'Kontrola sum', bad.length ? `${bad.length} z ${checks.length} reguł nie przechodzi: ${bad.map(x => x.label).join(', ')}. Sprawozdanie trafia do kolejki ręcznej.` : `${checks.length} z ${checks.length} reguł się zgadza (tolerancja ${unit === 'tys' ? '1 tys. zł' : '1 zł'}).`, !bad.length);
  if (bad.length) step('save', 'Zapis wstrzymany', `Zapisuję z flagą do_weryfikacji; metryki_roczne pominą to sprawozdanie, dopóki ktoś go nie zatwierdzi.`, 'warn');
  else step('save', 'Zapis', `sprawozdanie: 1 wiersz · pozycja: ${rows.length} wierszy (format long) · wartości KwotaB uzupełniają rok ${from ? Number(from.slice(0, 4)) - 1 : '?'} tylko tam, gdzie nie ma własnego pliku.`);

  return { steps, rows, unmapped, checks, meta: { type, unit, version, variant, sigMode, from, to, krs: krsEl ? krsEl.textContent : null, root: root.localName, ns } };
}

// ---------- tiny XML highlighter for the viewer ----------
function highlightXml(xml) {
  return xml.split('\n').map(line => {
    let h = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    h = h.replace(/(&lt;\/?)([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)(\s*\/?&gt;)/g, (m, open, tag, attrs, close) => {
      const a = attrs.replace(/([\w:.-]+)="([^"]*)"/g, '<span class="x-at">$1</span>=<span class="x-av">"$2"</span>');
      const cls = /^(ds|xades):/.test(tag) ? 'x-sig' : /^Kwota[AB]$/.test(tag) ? 'x-kw' : 'x-tag';
      return `<span class="x-br">${open}</span><span class="${cls}">${tag}</span>${a}<span class="x-br">${close}</span>`;
    });
    return h;
  });
}
