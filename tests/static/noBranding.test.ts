import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configFile, loadAppConfig } from '../../src/build/kanzleiConfig';
import type { AppConfig } from '../../src/logic/appConfig';

// The access notice names the Kanzlei, so it lives only in the local configuration (Tobias
// 2026-11-15). Nothing of it may appear in this public repo: neither the notice, nor a sentence of
// it that names the Kanzlei (the first one, and any with a word of the private name list), nor a
// name form of that list, nor the domain of the Impressum or privacy address. A copy wrapped by an
// editor or quoted in Markdown counts as well (audit 2026-11-15, QT-04/QS-03): whitespace and `>`
// quote markers are ignored, case too; every tracked file is also searched as bytes (PDF, ZIP …),
// and so are the commit messages, authors and committers of HEAD's history. So is every file of
// every commit that no remote has yet (audit 2026-11-15, R2-S-05): a find committed and removed
// again by a later commit is still published by the push, and only a force-push takes it out.
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

type Git = (args: readonly string[], input?: string) => Buffer;

/** git in a folder, its output as bytes (stderr kept out of the test output). */
const gitIn =
  (cwd: string): Git =>
  (args, input) =>
    execFileSync('git', args, {
      cwd,
      input,
      maxBuffer: 1024 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

/** Whether git can read the folder as a repository (a downloaded copy has no .git). */
function gitReads(cwd: string): boolean {
  try {
    gitIn(cwd)(['rev-parse', '--verify', '--quiet', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Every file content (blob) of the commits that no remote has yet, i.e. what the next push would
 * publish — without a remote every commit of HEAD. Three git processes, whatever the count.
 */
export function unpublishedBlobs(git: Git): { path: string; content: Buffer }[] {
  // "<sha>" for a commit, "<sha> <path>" for a tree or a blob
  const pathOf = new Map(
    git(['rev-list', '--objects', 'HEAD', '--not', '--remotes'])
      .toString('utf8')
      .split('\n')
      .filter((line) => line !== '')
      .map((line): [string, string] => [line.slice(0, 40), line.slice(41)]),
  );
  if (pathOf.size === 0) return [];
  const blobs = git(
    ['cat-file', '--batch-check=%(objectname) %(objecttype)'],
    [...pathOf.keys(), ''].join('\n'),
  )
    .toString('utf8')
    .split('\n')
    .filter((line) => line.endsWith(' blob'))
    .map((line) => line.slice(0, 40));
  if (blobs.length === 0) return [];
  // "<sha> blob <size>\n<content>\n" per blob
  const out = git(['cat-file', '--batch'], [...blobs, ''].join('\n'));
  const found: { path: string; content: Buffer }[] = [];
  for (let at = 0; at < out.length;) {
    const end = out.indexOf(0x0a, at);
    const [sha = '', , size = ''] = out.subarray(at, end).toString('latin1').split(' ');
    const start = end + 1;
    found.push({
      path: pathOf.get(sha) ?? sha,
      content: out.subarray(start, start + Number(size)),
    });
    at = start + Number(size) + 1;
  }
  expect(found).toHaveLength(blobs.length);
  return found;
}

const secrets = secretsOf(config, brands);
const repoReadable = gitReads(ROOT);

/** Why the scan of this repo cannot run here; undefined when it can. */
const scanSkipped =
  secrets.length === 0
    ? 'nothing to look for: no Kanzlei configuration and no name list (tests/fixtures/lokal is missing)'
    : !repoReadable
      ? 'git cannot read this checkout (no git, or no .git)'
      : undefined;

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

  it('finds an invented name that a later unpublished commit removed again, until a remote has it', (ctx) => {
    ctx.skip(!repoReadable, 'git cannot read this checkout (no git, or no .git)');
    const folder = mkdtempSync(join(tmpdir(), 'nobranding-'));
    try {
      const git = gitIn(folder);
      const commit = (file: string, text: string) => {
        writeFileSync(join(folder, file), text);
        git(['add', file]);
        git([
          ...['-c', 'user.name=Probe', '-c', 'user.email=probe@example.org'],
          ...['-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-m', `${file}`],
        ]);
      };
      git(['init', '-q']);
      commit('a.md', 'Die Kanzlei Erika Probe bietet das Tool an.\n');
      commit('a.md', 'Die [Kanzlei] bietet das Tool an.\n');
      commit('b.pdf', 'BT (Erika Probe) Tj\n');
      const found = secretsOf({ accessNotice: 'Ein Hilfsmittel der Erika Probe.' }, [
        'Erika Probe',
      ]);
      // the working copy no longer has it in a.md, the history does
      expect(leaks(readFileSync(join(folder, 'a.md')), found)).toBe(false);
      const blobs = unpublishedBlobs(git);
      expect(blobs.map((blob) => blob.path).sort()).toEqual(['a.md', 'a.md', 'b.pdf']);
      expect(blobs.filter((blob) => leaks(blob.content, found))).toHaveLength(2);
      // what a remote has is published already: the weekly check looks there (S1)
      git(['update-ref', 'refs/remotes/origin/main', 'HEAD~1']);
      expect(unpublishedBlobs(git).map((blob) => blob.path)).toEqual(['b.pdf']);
      git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
      expect(unpublishedBlobs(git)).toEqual([]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it('keeps the notice, its sentences naming the Kanzlei, the private name list and the link domains out of every tracked file, every unpublished commit and every commit message', (ctx) => {
    ctx.skip(scanSkipped !== undefined, scanSkipped);
    const git = gitIn(ROOT);
    const files = git(['ls-files', '-z'])
      .toString('utf8')
      .split('\0')
      .filter((name) => name !== '');
    expect(files.length).toBeGreaterThan(100);
    const leaking = files.filter((name) => leaks(readFileSync(`${ROOT}${name}`), secrets));
    expect(leaking).toEqual([]);
    // the files of the commits a push would publish, also those removed again since
    const unpublished = unpublishedBlobs(git).filter((blob) => leaks(blob.content, secrets));
    expect(unpublished.map((blob) => blob.path)).toEqual([]);
    // the history as far as this clone has it (GitHub's checkout fetches one commit)
    const messages = git(['log', '--format=%B%n%an%n%ae%n%cn%n%ce', 'HEAD']);
    expect(leaks(messages, secrets)).toBe(false);
  });
});
