import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inlineParts, parseManualTests } from './manualTests';

const DIR = join(import.meta.dirname, '..', '..', 'manual_tests');
const files = readdirSync(DIR).filter((name) => /^\d\d_.*\.md$/.test(name));
const all = files.flatMap((name) => parseManualTests(readFileSync(join(DIR, name), 'utf8'), name));

describe('the manual tests as the test page reads them', () => {
  it('finds every case of manual_tests/, each once, with an id the report accepts', () => {
    const ids = all.map((test) => test.id);
    expect([...ids].sort()).toEqual(['MT-01', 'MT-02', 'MT-03', 'MT-04', 'MT-05']);
    for (const id of ids) expect(id).toMatch(/^MT-\d{2,3}(-\d{2})?[a-z]?$/);
  });

  it('numbers the steps 1, 2, 3 … as in the file, each with what should happen', () => {
    for (const test of all) {
      expect(test.steps.length, test.id).toBeGreaterThan(0);
      expect(
        test.steps.map((step) => step.nr),
        test.id,
      ).toEqual(test.steps.map((_, index) => index + 1));
      for (const step of test.steps) expect(step.nr).toBeLessThanOrEqual(99);
    }
    // the last step of MT-01 and MT-04 only sends the tester back to step 1
    const expectations = all.flatMap((test) =>
      test.steps
        .filter((step) => step.expected.length === 0)
        .map((step) => `${test.id}/${step.nr}`),
    );
    expect(expectations).toEqual(['MT-01/5', 'MT-04/5']);
  });

  it('reads precondition, area, wrapped lines and the expectation of a step', () => {
    const mt02 = all.find((test) => test.id === 'MT-02');
    expect(mt02?.area).toBe('Echte Programme und Geräte');
    expect(mt02?.title).toBe('Rechnung aus dem Mailprogramm und dem Explorer ziehen');
    expect(mt02?.prerequisite).toMatch(/^Eine E-Mail mit einer PDF- oder XML-Rechnung/);
    expect(mt02?.steps[0]?.text).toBe(
      'Ziehen Sie den Anhang aus der E-Mail über die Fläche „Rechnung hierher ziehen“ und halten Sie ihn dort.',
    );
    expect(mt02?.steps[1]?.expected[0]).toMatch(/^Unter der Fläche steht „Geprüfte Datei: …“/);
    expect(mt02?.steps[1]?.expected[0]).toMatch(/Thunderbird\)\.$/);
  });

  it('keeps a numbered list before the first case out of the cases', () => {
    const parsed = parseManualTests(
      '# 09 – Probe\n\n1. Vorbereitung\n\n## MT-90: Probe\n\n1. Tun Sie etwas.\n   - **Danach:** Es passiert.\n\n# Anhang\n\n1. nicht mehr',
      '09_probe.md',
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.steps).toEqual([
      { nr: 1, text: 'Tun Sie etwas.', expected: ['Es passiert.'] },
    ]);
  });

  it('splits bold, code and links, keeping only the text of a link', () => {
    expect(inlineParts('Klicken Sie **Weiter**, dann `npm` (siehe [README](README.md)).')).toEqual([
      { kind: 'text', text: 'Klicken Sie ' },
      { kind: 'strong', text: 'Weiter' },
      { kind: 'text', text: ', dann ' },
      { kind: 'code', text: 'npm' },
      { kind: 'text', text: ' (siehe ' },
      { kind: 'text', text: 'README' },
      { kind: 'text', text: ').' },
    ]);
  });
});
