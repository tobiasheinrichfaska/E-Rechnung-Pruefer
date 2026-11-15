// The one network call of the tool, and only in the test version: „Bericht senden“ posts the
// tester's report to the login script of the test zone (Kanzlei PC session, Tobias 2026-11-15; spec:
// repo Testumgebung, docs/testbericht.md). The live build has no test page, so this module is not in
// it, and its CSP keeps `connect-src 'none'`; the test version allows `connect-src 'self'`. ESLint
// allows fetch in this file only (eslint.config.js, REPORT_SENDER). The report carries no free text:
// the script refuses any field with own text, and it adds the tester from the login.
import { REPORT_ADDRESS, type Report } from '../logic/testReport';

export type SendResult = { ok: true } | { ok: false; message: string };

/** The script's short message of a refusal, as plain text and at most 300 characters. */
async function messageOf(response: Response): Promise<string> {
  try {
    const text = (await response.text()).replace(/\s+/g, ' ').trim();
    return text.length > 300 ? `${text.slice(0, 300)} …` : text;
  } catch {
    return '';
  }
}

export async function sendReport(report: Report, address = REPORT_ADDRESS): Promise<SendResult> {
  let response: Response;
  try {
    response = await fetch(address, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    return { ok: false, message: 'Der Bericht wurde nicht gesendet: keine Verbindung zum Server.' };
  }
  if (response.ok) return { ok: true };
  if (response.status === 400) {
    const message = await messageOf(response);
    return {
      ok: false,
      message: `Der Server hat den Bericht abgelehnt${message ? `: ${message}` : '.'}`,
    };
  }
  if (response.status === 404) {
    return {
      ok: false,
      message:
        'Die Empfangsstelle für Berichte gibt es noch nicht (404). Ihre Ergebnisse bleiben auf dieser Seite, bis Sie sie neu laden.',
    };
  }
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      message: `Der Bericht wurde nicht angenommen (${response.status}). Bitte laden Sie die Seite neu und melden Sie sich an – Ihre Ergebnisse gehen dabei verloren.`,
    };
  }
  return { ok: false, message: `Der Bericht wurde nicht gesendet (Status ${response.status}).` };
}
