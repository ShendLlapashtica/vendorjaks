// Vendorja chat — the "WHY" half. Pure, no network.
//
// Owner, 2026-09-24: "ensure good guardrails when someone asks something why
// to finance kosovo this ai must answer well".
//
// A "why buy local / why support Kosovo" question is answered ONLY from the
// verified trade and tax figures the "pse" page already cites
// (src/content/serbiaEconomy.js — every figure fetched, dated, sourced;
// `verified: false` figures are left out here entirely). The model may
// argue in plain words, but every NUMBER in its reply must be one of these
// figures (see numbersOk), or the reply is thrown away for the
// deterministic one below.

import { TRADE_STATS, TAX_STATS, TAX_IMPACT_DERIVED } from '../src/content/serbiaEconomy.js';
import { SOURCES } from '../src/content/sources.js';
import { norm } from './_chat-retrieve.js';

const WHY_WORD = /\b(pse|perse|përse|why|arsye|arsyet|vlen|rendesi|financ\w*|mbeshtet\w*|mbështet\w*|support\w*|ndihmo\w*|ekonomi\w*|zasto|zašto)\b/;
const TOPIC_WORD = /\b(kosov\w*|vendor\w*|local\w*|lokal\w*|serbi\w*|serb\w*|blej\w*|blerj\w*|buy\w*|produkt\w*|mall\w*|tregti\w*|shqip\w*|import\w*|pare|parate|money)\b/;

export function isWhyQuestion(text) {
  const t = norm(text);
  return WHY_WORD.test(t) && TOPIC_WORD.test(t);
}

function sourceUrlFor(e) {
  if (e.sourceUrl) return e.sourceUrl;
  const id = (e.sourceIds || [])[0];
  return (id && SOURCES[id]?.url) || null;
}

// The only facts the model may use. Albanian labels (the app's language),
// value, year, one source link; derived figures carry their assumption so
// the model can state them as conditional.
export const WHY_FACTS = [...TRADE_STATS, ...TAX_STATS, ...TAX_IMPACT_DERIVED]
  .filter((e) => e.verified !== false && e.value && !/not calculated/i.test(e.value))
  .map((e) => ({
    id: e.id,
    fact: e.labelSq || e.label,
    value: [e.valueSq || e.value, e.unitSq || e.unit].filter(Boolean).join(' ').trim(),
    year: e.year || null,
    assumption: e.assumptionSq || undefined,
    sourceUrl: sourceUrlFor(e),
  }))
  .filter((f) => f.sourceUrl);

// Which facts to show as the cited list under the reply: the headline trade
// picture plus the VAT mechanism, in reading order.
const HEADLINE_IDS = ['trade-imports-2025', 'trade-exports-2025', 'trade-balance-2025', 'tax-vat-standard', 'vat-on-one-purchase'];
export const HEADLINE_FACTS = (() => {
  const picked = HEADLINE_IDS.map((id) => WHY_FACTS.find((f) => f.id === id)).filter(Boolean);
  return picked.length >= 3 ? picked : WHY_FACTS.slice(0, 5);
})();

// Every number a reply may contain: the digits of every fact (value, year,
// label, assumption), normalised so "234.8", "234,8" and "€234.8 m" agree.
function numbersIn(s) {
  return (String(s).match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, '.').replace(/\.0+$/, ''));
}
const ALLOWED_NUMBERS = new Set(WHY_FACTS.flatMap((f) => numbersIn([f.fact, f.value, f.year, f.assumption].join(' '))));

/** Any number in the reply that is not a dossier figure (or the user's own). */
export function strayNumbers(reply, userText) {
  const user = new Set(numbersIn(userText));
  // Single digits are list markers and "1 vend", not statistics.
  return numbersIn(reply).filter((n) => n.replace('.', '').length > 1 && !ALLOWED_NUMBERS.has(n) && !user.has(n));
}

export function deterministicWhy() {
  const lines = HEADLINE_FACTS.map((f) => `• ${f.fact}${f.year ? ` (${f.year})` : ''}: ${f.value}`);
  return [
    'Kur blini produkt vendor, paratë mbeten te prodhuesit, punëtorët dhe furnitorët në Kosovë. Kur blini produkt të regjistruar në Serbi, një pjesë shkon te kompania dhe shteti atje. Shifrat e verifikuara:',
    lines.join('\n'),
    'Burimet janë poshtë, dhe më shumë te faqja "pse".',
  ].join('\n\n');
}

export function whyPromptBlock() {
  return [
    'This question asks WHY to buy local / support Kosovo. Answer it well and persuasively, in the user\'s language (default Albanian), at most 6 short lines:',
    '- The reasoning: money spent on a local product stays with local producers, workers and suppliers; money spent on a Serbian-registered product partly goes to that company and, through taxes such as VAT, to the Serbian state.',
    '- Every NUMBER you write must be copied exactly from WHY_FACTS, with its year. If a figure is not in WHY_FACTS, do not give a number at all.',
    '- Derived figures (with an assumption) must be stated as conditional ("deri në", "nëse").',
    '- Talk about economies, companies and states — never about Serbian people. No insults, no slurs, no hostility, no calls to harm anyone. Calm and factual, not angry.',
    '- Do not make claims about war, military or politics beyond WHY_FACTS; for more, point to the app\'s "pse" page.',
    'WHY_FACTS:',
    JSON.stringify(WHY_FACTS),
  ].join('\n');
}

// Words that must never appear in a reply, whatever the model argues:
// slurs for Serbs/Albanians and incitement.
const HOSTILE = /\b(shkij\w*|shkja\w*|shka\b|siptar\w*|šiptar\w*|četnik\w*|cetnik\w*|vrasni|vritni|zhdukni|kill|exterminate)\b/;

export function hostile(reply) {
  return HOSTILE.test(norm(reply));
}
