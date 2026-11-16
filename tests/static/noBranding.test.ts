import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { configFile, loadAppConfig } from '../../src/build/kanzleiConfig';
import type { AppConfig } from '../../src/logic/appConfig';

// The access notice names the Kanzlei, so it lives only in the local configuration (Tobias
// 2026-11-15). Nothing of it may appear in this public repo: neither the notice, nor a sentence of
// it that names the Kanzlei (the first one, and any with a word of the private name list), nor a
// name form of that list, nor the domain of the Impressum or privacy address. A copy wrapped by an
// editor or quoted in Markdown counts as well (audit 2026-11-15, QT-04/QS-03): whitespace and `>`
// quote markers are ignored, case too; every tracked file is also searched as bytes (PDF, ZIP …),
// and so are the commit messages of HEAD.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// Only the real configuration counts, never the invented one KANZLEI_CONFIG may name (QT-01).
const { config } = loadAppConfig({});

/**
 * Name forms of the Kanzlei (full names only, one per line, `#` starts a comment), in the private
 * repo next to its configuration. Read only here: parseAppConfig takes no unknown key, and a known
 * one would reach the page.
 */
const BRANDS_FILE = `${ROOT}tests/fixtures/lokal/config/marken.txt`;
const brands = existsSync(BRANDS_FILE)
  ? readFileSync(BRANDS_FILE, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
  : [];

/** Whitespace collapsed, Markdown quote markers dropped, lower case: a wrapped copy still matches. */
export function normalized(text: string): string {
  return text
    .replace(/^[ \t]*(?:>[ \t]?)+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** What must not leak, normalized: see the header of this file. */
export function secretsOf(settings: AppConfig, names: readonly string[]): string[] {
  const notice = settings.accessNotice === undefined ? '' : normalized(settings.accessNotice);
  const sentences = notice === '' ? [] : notice.split(/(?<=[.!?])\s+/);
  const named = sentences.filter(
    (sentence, i) => i === 0 || names.some((name) => sentence.includes(normalized(name))),
  );
  const domains = [settings.imprintUrl, settings.privacyUrl]
    .filter((url): url is string => url !== undefined)
    // the registrable domain (e.g. "kanzlei-beispiel.de"), whatever subdomain a page uses
    .map((url) => new URL(url).hostname.split('.').slice(-2).join('.'));
  return [
    ...new Set([
      ...(notice === '' ? [] : [notice]),
      ...named,
      ...names.map(normalized),
      ...domains,
    ]),
  ].filter((secret) => secret !== '');
}

/**
 * The bytes a secret may take in a file — UTF-8, Latin-1 (e.g. PDF text) or UTF-16 BE — as Latin-1
 * text in lower case, the same form `leaks` gives the file's bytes.
 */
function encodings(secret: string): string[] {
  const utf16 = Buffer.from(secret, 'utf16le').swap16();
  return [Buffer.from(secret, 'utf8'), Buffer.from(secret, 'latin1'), utf16].map((bytes) =>
    bytes.toString('latin1').toLowerCase(),
  );
}

/** Whether the content holds a secret, as (normalized) text or as bytes. */
export function leaks(content: Buffer, secrets: readonly string[]): boolean {
  const text = normalized(content.toString('utf8'));
  const bytes = content.toString('latin1').toLowerCase();
  return secrets.some(
    (secret) =>
      text.includes(secret) || encodings(secret).some((encoded) => bytes.includes(encoded)),
  );
}

const secrets = secretsOf(config, brands);

describe('the Kanzlei configuration stays out of the public repo', () => {
  it('reads the neutral example only when no local configuration is there', () => {
    if (config.accessNotice === undefined)
      expect(configFile({})).toBe('config/kanzlei.example.json');
    expect(JSON.parse(readFileSync(`${ROOT}config/kanzlei.example.json`, 'utf8'))).toEqual({});
  });

  it('finds an invented notice wrapped, quoted, in other case, by its name alone or as PDF bytes', () => {
    const invented: AppConfig = {
      accessNotice: 'Ein Hilfsmittel der Kanzlei Erika Probe. Er ist kostenlos. Ihre Erika Probe.',
      imprintUrl: 'https://www.kanzlei-probe.example/impressum',
    };
    const found = secretsOf(invented, ['Kanzlei Erika Probe', 'Erika Probe']);
    // the sentences naming the Kanzlei, never the plain one (it may stand in the public draft)
    expect(found).not.toContain('er ist kostenlos.');
    const leak = (text: string) => leaks(Buffer.from(text, 'utf8'), found);
    expect(leak('> Ein Hilfsmittel der Kanzlei\n> Erika Probe. Er ist kostenlos.')).toBe(true);
    expect(leak('- EIN HILFSMITTEL DER\n  KANZLEI ERIKA PROBE.')).toBe(true);
    expect(leak('Die Kanzlei Erika Probe bietet das Tool an.')).toBe(true);
    expect(leak('Impressum: https://kanzlei-probe.example/')).toBe(true);
    expect(
      leaks(Buffer.from('BT (Ein Hilfsmittel der Kanzlei Erika Probe.) Tj', 'latin1'), found),
    ).toBe(true);
    expect(leaks(Buffer.from('Erika Probe', 'utf16le').swap16(), found)).toBe(true);
    // what the public repo may say: the draft with a placeholder and the plain sentences
    expect(leak('> Ein Hilfsmittel der [Kanzlei]. Er ist kostenlos.')).toBe(false);
  });

  it.skipIf(secrets.length === 0)(
    'keeps the notice, its sentences naming the Kanzlei, the private name list and the link domains out of every tracked file and commit message',
    () => {
      const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
        .split('\0')
        .filter((name) => name !== '');
      expect(files.length).toBeGreaterThan(100);
      const leaking = files.filter((name) => leaks(readFileSync(`${ROOT}${name}`), secrets));
      expect(leaking).toEqual([]);
      // the history as far as this clone has it (GitHub's checkout fetches one commit)
      const messages = execFileSync('git', ['log', '--format=%B%n%an%n%ae', 'HEAD'], {
        cwd: ROOT,
        maxBuffer: 64 * 1024 * 1024,
      });
      expect(leaks(messages, secrets)).toBe(false);
    },
  );
});
