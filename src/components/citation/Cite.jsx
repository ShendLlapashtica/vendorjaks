// IEEE in-text citation — "[1]", "[1], [4]", "[1]–[3]".
//
// New directory (`src/components/citation/`) rather than a loose file in
// src/components/, so the citation code stays in one clearly-owned
// subfolder.
//
// THE POINT OF THIS COMPONENT: a claim can never render a dangling numeral.
// The registry is the single authority on what number a source has; if it
// does not know a source, `numberOf` returns null, this renders nothing
// visible and shouts in the console in dev — and, more importantly,
// scripts/verify-citations.mjs has already failed the build before anybody
// gets here. The numbers themselves are derived from document order in
// src/content/pseCitations.js; nothing in the view layer invents one.
//
// Each numeral is an anchor into the reference-list entry it belongs to, so
// the numeral is not decoration: it is a link, which is what the owner asked
// for ("all must have links and IEEE referencing", 2026-09-16).

/**
 * @param {string[]} ids    source ids from the content layer
 * @param {object}   registry  a registry from createRegistry()
 * @param {function} t        translator, for the aria label
 */
export default function Cite({ ids, registry, t }) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
  if (list.length === 0 || !registry) return null;

  const numbers = list.map((id) => registry.numberOf(id)).filter((n) => Number.isInteger(n));
  if (numbers.length === 0) return null;

  const label = typeof t === 'function' ? t('citationRefLabel') : 'reference';

  return (
    <span className="vj-cite">
      {[...new Set(numbers)]
        .sort((a, b) => a - b)
        .map((n, i) => (
          <a
            className="vj-cite-num"
            href={`#ref-${n}`}
            key={n}
            aria-label={`${label} ${n}`}
            title={registry.entries[n - 1]?.text}
          >
            {i > 0 ? ', ' : ''}[{n}]
          </a>
        ))}
    </span>
  );
}
