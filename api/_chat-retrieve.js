// Vendorja chat — the RETRIEVAL half. Pure, no network.
//
// The rule this file exists to enforce: the chatbot never names an
// alternative that is not in data/brand-alternatives.json. The model only
// phrases a reply around the entries picked HERE; the widget renders the
// cards from these entries, not from the model's text. Same eligibility
// stance as the rest of the app — a GS1 prefix is where a barcode was
// registered, never where a product was made.
//
// Files starting with "_" under api/ are not deployed as routes by Vercel.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CATALOG = require('../data/brand-alternatives.json');

// Words too generic to count as a match on their own.
const STOP = new Set([
  'nga', 'per', 'dhe', 'the', 'and', 'for', 'from', 'serbia', 'serbian', 'sold',
  'single', 'brand', 'verified', 'dominant', 'no', 'not', 'nje', 'me', 'te', 'se',
  'cfare', 'kam', 'keni', 'kemi', 'alternative', 'alternativa', 'lokale', 'local',
  'produkt', 'produkte', 'product', 'products', 'shitur', 'serbe', 'srpski',
  // Country words: every entry is about Serbia vs Kosovo, so these match
  // "Personal care sold in Kosovo" for any "why support Kosovo" question.
  'kosovo', 'kosova', 'kosoves', 'kosoven', 'kosove', 'serbise', 'serbine', 'srbija', 'albania', 'shqiperi',
  'support', 'buying', 'buy', 'instead', 'why', 'pse', 'perse', 'vendore', 'vendor', 'ble', 'blej', 'blerje',
]);

// Albanian (and a little Serbian) shop words -> the English category the
// catalogue uses. Keys are norm()'d, so no diacritics.
const CATEGORY_WORDS = {
  biskota: 'biscuits', keks: 'biscuits', cokollate: 'chocolate', cokollata: 'chocolate', bonbone: 'candy',
  karamele: 'candy', vafera: 'wafers', napolitanke: 'wafers', cips: 'chips', cipsa: 'chips', leng: 'juices',
  lengje: 'juices', sok: 'juices', uje: 'water', uji: 'water', voda: 'water', birre: 'beer', birra: 'beer',
  pivo: 'beer', qumesht: 'milk', qumeshti: 'milk', mleko: 'milk', jogurt: 'yogurt', kos: 'yogurt', ajke: 'cream',
  djathe: 'cheese', djath: 'cheese', sir: 'cheese', kafe: 'coffee', kafa: 'coffee', kafja: 'coffee', vaj: 'oil',
  miell: 'flour', brasno: 'flour', makarona: 'pasta', ketchup: 'ketchup', kecap: 'ketchup', flips: 'flips',
  kokoshka: 'popcorn', gjalpe: 'butter', puter: 'butter', mish: 'meat', sallam: 'meat', suxhuk: 'meat', caj: 'tea',
  erza: 'spices', piper: 'spices', kripe: 'salt', majoneze: 'mayonnaise', majonez: 'mayonnaise', letra: 'paper',
  detergjent: 'cleaning', shampon: 'personal', recel: 'jam', marmelate: 'jam', mjalte: 'honey', arra: 'nuts',
  kikirik: 'nuts', vere: 'wine', fasule: 'legumes', oriz: 'rice', buke: 'bread', patate: 'fresh', perime: 'fresh',
};

export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9&+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  return norm(s).split(' ').filter((t) => t.length >= 3 && !STOP.has(t));
}

// The user's words, with Albanian category words also added in English.
function queryTokens(s) {
  const out = new Set(tokens(s));
  for (const t of [...out]) if (CATEGORY_WORDS[t]) out.add(CATEGORY_WORDS[t]);
  return out;
}

// Everything an entry can be recognised by, weighted: the Serbian brand name
// counts most, the category/tags least.
function entryKeys(e) {
  const strong = [e.serbianBrand, e.serbianCompany].flatMap(tokens);
  const weak = [e.category, ...(e.offCategoryTags || []).map((t) => t.replace(/^\w+:/, ''))]
    .flatMap((t) => tokens(String(t).replace(/-/g, ' ')));
  return { strong: new Set(strong), weak: new Set(weak) };
}

const INDEX = CATALOG.entries.map((e) => ({ entry: e, keys: entryKeys(e) }));

// Barcode prefixes, kept to the three verdicts the chat talks about. The full
// table lives in data/gs1-prefixes.json; the SPA uses it for real scans.
export function prefixVerdict(code) {
  const p = code.slice(code.length === 14 ? 1 : 0, (code.length === 14 ? 1 : 0) + 3);
  if (p === '860') return { prefix: p, verdict: 'SERBIAN', note: 'Barkodi është regjistruar te GS1 Serbia (prefiksi 860). Kjo tregon ku u regjistrua barkodi, jo domosdoshmërisht ku u prodhua produkti.' };
  if (p === '381' || p === '390' || p === '530') return { prefix: p, verdict: 'LOCAL', note: `Prefiksi ${p} përdoret nga prodhues vendorë (Kosovë/Shqipëri).` };
  return { prefix: p, verdict: 'OTHER', note: `Prefiksi ${p} nuk është as serb as vendor.` };
}

/**
 * @param {string} text - the user's latest message (plus a little context)
 * @returns {{ barcode: null|{code:string,prefix:string,verdict:string,note:string}, matches: Array<object> }}
 */
export function retrieve(text, limit = 3) {
  const t = norm(text);
  const q = queryTokens(text);

  const codeMatch = String(text || '').match(/\b\d{8,14}\b/);
  const barcode = codeMatch ? { code: codeMatch[0], ...prefixVerdict(codeMatch[0]) } : null;

  const scored = [];
  for (const { entry, keys } of INDEX) {
    let score = 0;
    for (const w of q) {
      if (keys.strong.has(w)) score += 3;
      else if (keys.weak.has(w)) score += 1;
    }
    // Multi-word brand written as one phrase ("knjaz milos", "grand kafa").
    const head = norm(entry.serbianBrand.split('(')[0]);
    if (head.length >= 4 && t.includes(head)) score += 4;
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  // Keep only near-top hits: "knjaz milos" is the water brand, not also every
  // other product the same company makes.
  const floor = scored.length ? scored[0].score * 0.7 : 0;

  const matches = scored.filter((s) => s.score >= floor).slice(0, limit).map(({ entry }) => ({
    serbianBrand: entry.serbianBrand,
    serbianCompany: entry.serbianCompany,
    category: entry.category,
    alternatives: entry.alternatives.map((a) => ({
      brand: a.brand,
      company: a.company,
      country: a.country,
      evidence: a.evidence,
      pairingEvidence: a.pairingEvidence,
      sourceUrl: a.pairingUrl || a.sourceUrl,
      image: a.image || null,
    })),
  }));

  return { barcode, matches };
}

export const DISCLAIMER = CATALOG.disclaimer;
