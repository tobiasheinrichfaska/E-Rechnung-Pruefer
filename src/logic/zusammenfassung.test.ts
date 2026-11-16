import { TEXTS, fill } from './texts';
import type { Verdict } from './verdict';
import { resultText, withoutPointers } from './zusammenfassung';

const VERDICT: Verdict = {
  tone: 'warn',
  headline: 'E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen',
  explanation: [
    'Die Datei enthält die Rechnungsdaten als XML.',
    'Ein Hinweis zu den Pflichtangaben.',
  ],
  invoices: [],
};

describe('the result as text for the Kanzlei (G-4)', () => {
  it('names file, time, result, summaries, notice and version', () => {
    const text = resultText({
      fileName: 'rechnung.xml',
      date: '14.11.2026',
      time: '18:52',
      verdict: VERDICT,
      pflicht: TEXTS.allPresent,
      rules: TEXTS.rulesOk,
      notice: TEXTS.fixedNoticeGeneral,
      version: '0.3.0',
    });
    expect(text.split('\n')).toEqual([
      'E-Rechnung prüfen – Ergebnis',
      'Geprüfte Datei: „rechnung.xml“ – geprüft am 14.11.2026 um 18:52 Uhr',
      '',
      'Ergebnis: E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen',
      'Die Datei enthält die Rechnungsdaten als XML.',
      'Ein Hinweis zu den Pflichtangaben.',
      '',
      `Pflichtangaben – ${TEXTS.allPresent}`,
      `Rechnerische Prüfung – ${TEXTS.rulesOk}`,
      '',
      TEXTS.fixedNoticeGeneral,
      'Version 0.3.0',
    ]);
  });

  // QU-07: what the page shows besides the box lines — what differs between two invoice XML, right
  // after the sentence that says so, and the reduced list of § 33 / § 34a UStDV
  it('keeps the line with what differs right after the first line', () => {
    const text = resultText({
      fileName: 'zwei.pdf',
      date: '15.11.2026',
      time: '10:00',
      verdict: {
        ...VERDICT,
        tone: 'bad',
        headline: TEXTS.contradicting,
        explanation: [
          'Das PDF enthält 2 Rechnungs-XML mit unterschiedlichen Daten.',
          'Zweiter Satz.',
        ],
      },
      differing: 'Unterschiedlich: Rechnungsnummer (A-1 / A-2).',
      notice: TEXTS.fixedNotice,
      version: '0.9.0',
    });
    expect(text.split('\n').slice(3, 7)).toEqual([
      `Ergebnis: ${TEXTS.contradicting}`,
      'Das PDF enthält 2 Rechnungs-XML mit unterschiedlichen Daten.',
      'Unterschiedlich: Rechnungsnummer (A-1 / A-2).',
      'Zweiter Satz.',
    ]);
  });

  it('says that only the reduced list was checked, before the Pflichtangaben', () => {
    const mode =
      'Gesamtbetrag bis 250 Euro: Es gelten die verringerten Angaben einer Kleinbetragsrechnung nach § 33 UStDV.';
    const text = resultText({
      fileName: 'klein.xml',
      date: '15.11.2026',
      time: '10:00',
      verdict: VERDICT,
      mode,
      pflicht: TEXTS.allPresent,
      notice: TEXTS.fixedNoticeGeneral,
      version: '0.9.0',
    });
    expect(text.split('\n').slice(6, 9)).toEqual([
      '',
      mode,
      `Pflichtangaben – ${TEXTS.allPresent}`,
    ]);
  });

  it('leaves out the sections the result does not show', () => {
    const text = resultText({
      fileName: 'scan.pdf',
      date: '14.11.2026',
      time: '09:05',
      verdict: { ...VERDICT, explanation: [] },
      notice: TEXTS.fixedNoticeGeneral,
      version: '0.3.0',
    });
    expect(text).not.toContain('Pflichtangaben –');
    expect(text).not.toContain('Rechnerische Prüfung –');
  });
});

/** Every sentence of TEXTS, also those of the nested tables (the file problems). */
function sentences(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(sentences);
  if (value && typeof value === 'object') return Object.values(value).flatMap(sentences);
  return [];
}

const ALL = { count: 2, list: 'Steuernummer', ids: 'BR-CO-15', name: 'a.xml' };

// A mail has no „unten“ and no section „Pflichtangaben“ to look at: the copy pointed to parts it does
// not hold, e.g. „Bitte beachten Sie den Hinweis unten.“ (audit R3-U-08). Whether the hints and the
// values of the rules come along is a design question (G-4), so only the pointers go.
describe('the copied text without pointers to the page (R3-U-08)', () => {
  it('leaves out every pointer and the sentences that only point', () => {
    const text = resultText({
      fileName: 'rechnung.xml',
      date: '16.11.2026',
      time: '09:00',
      verdict: {
        ...VERDICT,
        explanation: [
          'Die Datei enthält die Rechnungsdaten als XML.',
          TEXTS.pflichtHintLine,
          fill(TEXTS.rulesHint, { ids: 'BR-CO-15' }),
          fill(TEXTS.schemaMore, { count: 3 }),
        ],
      },
      pflicht: `${TEXTS.allPresent} ${fill(TEXTS.hintsBelow, { count: 2 })}`,
      rules: `${fill(TEXTS.rulesAuffaellig, { ids: 'BR-CO-15' })} ${TEXTS.rulesOneNotChecked}`,
      notice: TEXTS.fixedNoticeGeneral,
      version: '0.10.1',
    });
    expect(text.split('\n').slice(4)).toEqual([
      'Die Datei enthält die Rechnungsdaten als XML.',
      'Ein Hinweis zu den Pflichtangaben.',
      'Mögliche Auffälligkeit bei den Beträgen: BR-CO-15.',
      'Weitere technische Meldungen: 3.',
      '',
      `Pflichtangaben – ${TEXTS.allPresent}`,
      'Rechnerische Prüfung – Mögliche Auffälligkeit: BR-CO-15. Eine Regel ließ sich nicht prüfen.',
      '',
      TEXTS.fixedNoticeGeneral,
      'Version 0.10.1',
    ]);
    expect(text).not.toMatch(/siehe|unten/);
    // no line with two colons in a row („Rechnerische Prüfung: Mögliche Auffälligkeit: …“)
    expect(text).not.toMatch(/^[^:\n]*: [^:\n]*: /m);
  });

  it('cleans every sentence of TEXTS that points to the page, and nothing else', () => {
    const pointing = sentences(TEXTS).filter((sentence) => /siehe|unten/.test(sentence));
    expect(pointing.length).toBeGreaterThanOrEqual(10);
    for (const sentence of pointing) {
      const line = `Satz davor. ${fill(sentence, ALL)}`;
      expect(withoutPointers(line), sentence).not.toMatch(/siehe|unten/);
    }
    for (const sentence of sentences(TEXTS).filter((s) => !/siehe|unten/.test(s))) {
      expect(withoutPointers(sentence)).toBe(sentence);
    }
  });
});
