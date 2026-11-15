// The local Kanzlei configuration (Tobias 2026-11-15, like the Fragebogen's): what names the Kanzlei
// stays out of this public repo. The build reads config/kanzlei.local.json (gitignored, the original
// in the private companion repo); without it the neutral config/kanzlei.example.json, which holds
// nothing. An invalid file stops the build instead of shipping a broken notice or link.

export interface AppConfig {
  /**
   * The access notice the hosted copy asks to confirm before it opens (accessGate.ts). Without it
   * the tool opens at once.
   */
  accessNotice?: string;
  /** The Kanzlei's Impressum, linked at the foot of the page (Tobias 2026-11-15). */
  imprintUrl?: string;
  /** The Kanzlei's privacy policy (with the sentence on bunny.net), linked next to it. */
  privacyUrl?: string;
}

export type ConfigResult = { ok: true; config: AppConfig } | { ok: false; issues: string[] };

const KEYS: readonly (keyof AppConfig)[] = ['accessNotice', 'imprintUrl', 'privacyUrl'];
const LINKS = ['imprintUrl', 'privacyUrl'] as const;

/** A notice longer than this is a mistake, not a notice. */
const MAX_NOTICE = 2000;

/** No unpaired surrogate: its UTF-8 form, and so its fingerprint, would be ambiguous. */
function wellFormed(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xdc00 && unit <= 0xdfff) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i++;
    }
  }
  return true;
}

/** An https address without login data — the only kind of link the page may carry. */
function linkProblem(value: unknown): string | undefined {
  if (typeof value !== 'string') return 'keine Adresse';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'keine Adresse';
  }
  if (url.protocol !== 'https:') return 'nicht https://';
  if (url.username !== '' || url.password !== '') return 'mit Zugangsdaten';
  if (value !== value.trim() || /\s/.test(value)) return 'mit Leerzeichen';
  return undefined;
}

export function parseAppConfig(value: unknown): ConfigResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, issues: ['$: kein Objekt'] };
  }
  const record = value as Record<string, unknown>;
  const issues = Object.keys(record)
    .filter((key) => !(KEYS as readonly string[]).includes(key))
    .map((key) => `$.${key}: unbekannter Eintrag`);
  const notice = record['accessNotice'];
  if (notice !== undefined) {
    if (typeof notice !== 'string' || notice.trim() === '') {
      issues.push('$.accessNotice: kein Text');
    } else if (notice.length > MAX_NOTICE) {
      issues.push(`$.accessNotice: länger als ${MAX_NOTICE} Zeichen`);
    } else if (!wellFormed(notice)) {
      issues.push('$.accessNotice: ungültiges Zeichen');
    }
  }
  const config: AppConfig = typeof notice === 'string' ? { accessNotice: notice.trim() } : {};
  for (const key of LINKS) {
    const link = record[key];
    if (link === undefined) continue;
    const problem = linkProblem(link);
    if (problem) issues.push(`$.${key}: ${problem}`);
    else config[key] = link as string;
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, config };
}
