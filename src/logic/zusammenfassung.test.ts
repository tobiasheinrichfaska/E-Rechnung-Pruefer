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
