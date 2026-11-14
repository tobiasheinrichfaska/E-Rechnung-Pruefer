import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PFLICHTANGABEN, MODES } from '../../src/logic/pflichtangaben';
import { PROFILES } from '../../src/logic/profiles';
import { RULE_LABELS } from '../../src/logic/rules';
import { CATEGORY_LABELS, TEXTS, TYPE_CODES, UNIT_LABELS } from '../../src/logic/texts';

// Results are hints, never an approval: no text the tool shows may say "ordnungsgemäß" or
// "gültig" — not only TEXTS, but every table with German text and the sentences written in the UI
// components (audit 2026-11-14, L-10/T-07).
const APPROVAL = /ordnungsgem|gültig/i;

describe('texts shown to clients', () => {
  it('never sound like an approval', () => {
    const tables = JSON.stringify({
      TEXTS,
      PFLICHTANGABEN,
      MODES,
      PROFILES,
      TYPE_CODES,
      CATEGORY_LABELS,
      UNIT_LABELS,
      RULE_LABELS,
    });
    expect(tables).not.toMatch(APPROVAL);

    const ui = new URL('../../src/ui/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    const shown = readdirSync(ui)
      .filter((name) => name.endsWith('.tsx'))
      .map((name) =>
        readFileSync(join(ui, name), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, ''),
      );
    expect(shown.length).toBeGreaterThan(3);
    expect(shown.filter((text) => APPROVAL.test(text))).toEqual([]);
  });
});
