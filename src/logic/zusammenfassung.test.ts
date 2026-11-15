import { TEXTS } from './texts';
import type { Verdict } from './verdict';
import { resultText } from './zusammenfassung';

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
      `Pflichtangaben: ${TEXTS.allPresent}`,
      `Rechnerische Prüfung: ${TEXTS.rulesOk}`,
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
    expect(text.split('\n').slice(6, 9)).toEqual(['', mode, `Pflichtangaben: ${TEXTS.allPresent}`]);
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
    expect(text).not.toContain('Pflichtangaben:');
    expect(text).not.toContain('Rechnerische Prüfung:');
  });
});
