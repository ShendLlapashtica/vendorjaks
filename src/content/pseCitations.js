// The /pse page's citation registry — numbers derived from document order.
//
// This is the ONLY place the two evidence bases meet. It walks them in the
// order ManifestoScreen actually renders them (the legal record first, then
// the economic dossier inside SerbiaProfitPanel) and hands back a registry
// that knows every source's number.
//
// Why a separate module and not a constant in sources.js: sources.js must
// not import content, or the content files could not import it back. This
// sits above both.
//
// Add a claim, delete a claim, reorder the page — the numbering follows.
// Nobody edits a number. That is the entire design requirement.

import { createRegistry } from './sources.js';
import { MANIFESTO_SCREENS, argumentSourceIdsInOrder } from './argument.js';
import { economySourceIdsInOrder } from './serbiaEconomy.js';

/** Source ids in first-appearance order down the rendered /pse page. */
export function pseSourceIdsInOrder() {
  const ids = [];
  for (const id of [...argumentSourceIdsInOrder(MANIFESTO_SCREENS), ...economySourceIdsInOrder()]) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * The registry the /pse page renders from.
 *
 * Built once at module load, which means a claim naming a source id that is
 * not in SOURCES throws here — at import, in the test run — rather than
 * printing "[undefined]" next to a sentence about a massacre.
 */
export const PSE_REGISTRY = createRegistry(pseSourceIdsInOrder());
