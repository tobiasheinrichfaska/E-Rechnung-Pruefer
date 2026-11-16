import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_NAME, APP_VERSION } from '../../src/appInfo';
import { manualTestFiles, TEST_APP, testBinding } from '../../src/logic/testBinding';
import { pruefeKopie } from '../../src/testrahmen/pruefen.mjs';
import { bindingProblems, speicherSchluessel } from '../../src/testrahmen/testrahmen.js';

// The shared test frame of the test version (repo Testumgebung, testrahmen/; its docs/testrahmen.md)
// is a copy, changed only there and copied again (`npm run rahmen -- <folder of this app> --ziel
// src/testrahmen`). Its checker compares every file with the SHA-256 in testrahmen.json and refuses
// a trial copy (`--entwurf`).
describe('the copy of the shared test frame', () => {
  it('is unchanged and comes from a commit of Testumgebung', () => {
    expect(pruefeKopie()).toEqual([]);
  });
});

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MANUAL = join(ROOT, 'manual_tests');

/** manual_tests/0X_*.md as the test version bundles them (src/testArea.tsx, the same pattern). */
const manualTests = Object.fromEntries(
  readdirSync(MANUAL)
    .filter((name) => /^[0-9]{2}_.*\.md$/.test(name))
    .map((name) => [`../manual_tests/${name}`, readFileSync(join(MANUAL, name), 'utf8')]),
);

/** The binding as the test version builds it, with the commit `npm run build:test` would write. */
const binding = testBinding({
  name: APP_NAME,
  version: APP_VERSION,
  stand: execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim(),
  manualTests,
  restart: () => undefined,
  reset: () => undefined,
});

describe('the binding of the test version', () => {
  it('has no problem the frame would show on top (and then send no report)', () => {
    expect(bindingProblems(binding)).toEqual([]);
  });

  it('names the tool as the test zone erechnung-test does and keeps its run under its own key', () => {
    expect(binding.app).toBe('erechnung');
    expect(TEST_APP).toBe('erechnung');
    expect(speicherSchluessel(binding.app)).toBe('testrahmen:erechnung');
    expect(binding.name).toBe(APP_NAME);
    expect(binding.version).toBe(APP_VERSION);
    // no prepared states: every manual test starts with an empty page
    expect(binding.startpunkte).toBeUndefined();
    expect(typeof binding.neuStarten).toBe('function');
    expect(typeof binding.zuruecksetzen).toBe('function');
  });

  it('gives the frame every numbered file of manual_tests/, by name, and not its README', () => {
    expect(binding.handtests.map((file) => file.datei)).toEqual([
      '01_echte_rechnungen.md',
      '02_geraete.md',
      '03_verstaendlichkeit.md',
    ]);
    for (const file of binding.handtests) {
      expect(file.text).toBe(readFileSync(join(MANUAL, file.datei), 'utf8'));
    }
    // every case the frame lists is a „## MT-xx: …“ heading of those files
    const ids = binding.handtests.flatMap((file) =>
      [...file.text.matchAll(/^## (MT-\d{2,3}): /gm)].map((match) => match[1]),
    );
    expect(ids.sort()).toEqual(['MT-01', 'MT-02', 'MT-03', 'MT-04', 'MT-05']);
  });

  it('takes the file name from a bundled path', () => {
    expect(
      manualTestFiles({ '../manual_tests/02_b.md': 'b', '../manual_tests/01_a.md': 'a' }),
    ).toEqual([
      { datei: '01_a.md', text: 'a' },
      { datei: '02_b.md', text: 'b' },
    ]);
  });
});
