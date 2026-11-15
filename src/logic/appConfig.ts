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
  /**
   * The Kanzlei's colours (Tobias 2026-11-15: „Stelle die App auf die Kanzleifarben um (bei
   * Fragebogen haben wir das schon getan)“) — the same block as in the Fragebogen's configuration.
   * Each one must keep text readable (contrast at least 4.5:1).
   */
  colors?: KanzleiColors;
}

export interface KanzleiColors {
  /** Buttons, links, the drop zone's border and the notice's edge — white text stays readable. */
  accent: string;
  /** Background of the drop zone while a file is dragged over it (light), dark text on it. */
  chosenBg?: string;
  /** Background of the fixed notice under the result (light), dark text on it. */
  infoBg?: string;
  /** The accent in dark mode (taken as in the Fragebogen; this tool has no dark mode yet). */
  accentDark?: string;
}

/** CSS custom properties the stylesheet reads (`var(--kanzlei-accent, …)`), as in the Fragebogen. */
const COLOR_VARIABLES: Readonly<Record<keyof KanzleiColors, string>> = {
  accent: '--kanzlei-accent',
  chosenBg: '--kanzlei-chosen-bg',
  infoBg: '--kanzlei-info-bg',
  accentDark: '--kanzlei-accent-dark',
};

// What each colour must stay readable against: [other colour, why] (text colour of app.css).
const CONTRAST: Readonly<Record<keyof KanzleiColors, readonly [string, string]>> = {
  accent: ['#ffffff', 'weiße Schrift auf Knöpfen und die weiße Seite'],
  chosenBg: ['#1d1d1f', 'die dunkle Schrift'],
  infoBg: ['#1d1d1f', 'die dunkle Schrift'],
  accentDark: ['#111419', 'den dunklen Hintergrund'],
};

export const MIN_CONTRAST = 4.5;
const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** WCAG 2 contrast ratio of two `#rrggbb` colours (1 … 21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** The CSS custom properties for the configured colours (none without a configuration). */
export function colorVariables(colors: KanzleiColors | undefined): Record<string, string> {
  if (!colors) return {};
  return Object.fromEntries(
    (Object.keys(COLOR_VARIABLES) as (keyof KanzleiColors)[]).flatMap((key) => {
      const value = colors[key];
      return value === undefined ? [] : [[COLOR_VARIABLES[key], value.toLowerCase()]];
    }),
  );
}

function parseColors(raw: unknown, issues: string[]): KanzleiColors | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    issues.push('$.colors: kein Objekt');
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const keys = Object.keys(COLOR_VARIABLES) as (keyof KanzleiColors)[];
  for (const key of Object.keys(record)) {
    if (!(keys as string[]).includes(key)) issues.push(`$.colors.${key}: unbekannter Eintrag`);
  }
  const colors: Partial<KanzleiColors> = {};
  for (const key of keys) {
    const value = record[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !HEX.test(value)) {
      issues.push(`$.colors.${key}: keine Farbe #rrggbb`);
      continue;
    }
    const [other, why] = CONTRAST[key];
    const ratio = contrastRatio(value, other);
    if (ratio < MIN_CONTRAST) {
      issues.push(
        `$.colors.${key}: Kontrast ${ratio.toFixed(1)}:1 gegen ${why}, mindestens ${MIN_CONTRAST}:1`,
      );
      continue;
    }
    colors[key] = value;
  }
  if (record['accent'] === undefined) issues.push('$.colors.accent: fehlt');
  return colors.accent === undefined ? undefined : (colors as KanzleiColors);
}

export type ConfigResult = { ok: true; config: AppConfig } | { ok: false; issues: string[] };

const KEYS: readonly (keyof AppConfig)[] = ['accessNotice', 'imprintUrl', 'privacyUrl', 'colors'];
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
  if (record['colors'] !== undefined) {
    const colors = parseColors(record['colors'], issues);
    if (colors) config.colors = colors;
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, config };
}
