// The citation rules, as a test — so `npm test` is what enforces them.
//
// scripts/verify-citations.mjs is the human-facing command (it prints the
// reference list with --list and can fetch every URL with --check-links).
// This runs the same checks inside the suite, because the rule the owner
// gave on 2026-09-16 — "put on a source to all. if no source remove. all
// must have links and IEEE referencing" — has to survive the next person
// who edits src/content/ in a hurry, and a rule nothing runs is a rule
// nobody keeps.
//
// The test spawns the script rather than duplicating its logic. Two copies
// of a rule drift; one copy cannot.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { SOURCES, formatCitationLabel, formatIeee } from '../content/sources.js';
import { PSE_REGISTRY } from '../content/pseCitations.js';
import { MANIFESTO_SCREENS } from '../content/argument.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(here, '../../scripts/verify-citations.mjs');

describe('citations', () => {
  it('scripts/verify-citations.mjs passes', () => {
    // Throws (and prints the script's own output) if the script exits non-zero.
    const out = execFileSync(process.execPath, [script], { encoding: 'utf8' });
    expect(out).toContain('verify-citations: OK');
  });

  it('every source in the registry has an http(s) URL', () => {
    for (const [id, s] of Object.entries(SOURCES)) {
      expect(s.url, `${id} has no url`).toMatch(/^https?:\/\//);
    }
  });

  it('every reference renders a non-empty IEEE entry', () => {
    for (const [id, s] of Object.entries(SOURCES)) {
      expect(formatIeee(s).length, `${id} renders an empty IEEE entry`).toBeGreaterThan(12);
    }
  });

  it('numbers references contiguously from 1, in citation order', () => {
    PSE_REGISTRY.entries.forEach((e, i) => {
      expect(e.n).toBe(i + 1);
    });
    expect(PSE_REGISTRY.size).toBe(PSE_REGISTRY.entries.length);
  });

  it('formats IEEE in-text labels, including ranges', () => {
    expect(formatCitationLabel([1])).toBe('[1]');
    expect(formatCitationLabel([1, 4])).toBe('[1], [4]');
    expect(formatCitationLabel([2, 1])).toBe('[1], [2]');
    expect(formatCitationLabel([1, 2, 3])).toBe('[1]–[3]');
    expect(formatCitationLabel([1, 2, 3, 7, 8, 9])).toBe('[1]–[3], [7]–[9]');
    expect(formatCitationLabel([])).toBe('');
  });

  it('never renders a numeral for a source it does not know', () => {
    expect(PSE_REGISTRY.numberOf('no-such-source')).toBeNull();
  });

  it('gives every claim on /pse a source that resolves to a number', () => {
    for (const item of MANIFESTO_SCREENS) {
      const groups = [
        [item.id, item.sourceIds],
        ...(item.massacres || []).map((s) => [`${item.id}/${s.place}`, s.sourceIds]),
      ];
      for (const [where, ids] of groups) {
        expect(ids, `${where} has no sourceIds`).toBeTruthy();
        expect(ids.length, `${where} has no sourceIds`).toBeGreaterThan(0);
        for (const id of ids) {
          expect(PSE_REGISTRY.numberOf(id), `${where} cites unknown source ${id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps the slogan repetition off /pse', () => {
    // A regression guard for the owner's 2026-09-16 instruction, which
    // reverses his own 2026-09-12 one. The three slogan panels have now been
    // walked back three times across five days (13 repeats -> 3, six
    // overlapping copies -> 1, three panels -> none). If someone restores
    // them from the old comment, this fails and points them at the date.
    const src = execFileSync(
      process.execPath,
      ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(
        path.resolve(here, '../components/ManifestoScreen.jsx')
      )}, 'utf8'))`],
      { encoding: 'utf8' }
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code, 'ManifestoScreen renders Array(3).fill(...) again').not.toMatch(/Array\(\s*3\s*\)/);
    expect(code, 'ManifestoScreen imports the slogan treatments again').not.toMatch(
      /TreatmentA|TreatmentC/
    );
  });
});
