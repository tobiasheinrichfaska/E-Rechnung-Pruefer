import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  type Stats,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configFile, loadAppConfig } from '../../src/build/kanzleiConfig';
import type { AppConfig } from '../../src/logic/appConfig';

// The access notice names the Kanzlei, so it lives only in the local configuration (Tobias
// 2026-11-15). Nothing of it may appear in this public repo: neither the notice, nor a sentence of
// it that names the Kanzlei (the first one, and any with a word of the private name list), nor a
// name form of that list, nor the domain of the Impressum or privacy address. A copy wrapped by an
// editor or quoted in Markdown counts as well (audit 2026-11-15, QT-04/QS-03): whitespace and `>`
// quote markers are ignored, case too; every file a commit could take — tracked or new and not
// ignored (audit 2026-11-16, R3-T-02) — is also searched as bytes (PDF, ZIP …), and so are the
// commit messages, authors and committers of the history of HEAD and every local branch. So is
// every file of every commit that no remote has yet (audit 2026-11-15, R2-S-05): a find committed
// and removed again by a later commit is still published by the push, and only a force-push takes
// it out. The paths count too (R3-S-04): a file named after the Kanzlei or its domain, in the
// working copy or in an unpublished commit, compared as letters and digits only.
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
  return [
    ...new Set([
      ...(notice === '' ? [] : [notice]),
      ...named,
      ...names.map(normalized),
      ...domainsOf(settings),
    ]),
  ].filter((secret) => secret !== '');
}

/** The registrable domain of each link (e.g. "kanzlei-beispiel.de"), whatever subdomain it uses. */
function domainsOf(settings: AppConfig): string[] {
  return [settings.imprintUrl, settings.privacyUrl]
    .filter((url): url is string => url !== undefined)
    .map((url) => new URL(url).hostname.split('.').slice(-2).join('.'));
}

/**
 * Letters and digits only, lower case, accents dropped: "Erika_Probe.PDF", "erika-probe" and
 * "ErikaProbe" all give "erikaprobe" (audit 2026-11-16, R3-S-04). The same form on both sides.
 */
export function squashed(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** What a path must not hold, squashed: each name of the list and each link domain. */
export function pathSecretsOf(settings: AppConfig, names: readonly string[]): string[] {
  return [...new Set([...names, ...domainsOf(settings)].map(squashed))].filter(
    (secret) => secret !== '',
  );
}

/** Whether a path (folders included) names the Kanzlei or its domain. */
export function pathLeaks(path: string, secrets: readonly string[]): boolean {
  const form = squashed(path);
  return secrets.some((secret) => form.includes(secret));
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
 * The commits that no remote has yet, on HEAD and on every local branch: HEAD for a detached
 * checkout, the branches for a push of another one (audit 2026-11-16, R3-S-04).
 */
const UNPUBLISHED = ['HEAD', '--branches', '--not', '--remotes'];

/**
 * The files a commit could take now: every tracked file and every new one that is not ignored
 * (audit 2026-11-16, R3-T-02), with the content of a regular file and the target of a link — what
 * git would store — but never a linked folder followed (a linked node_modules or
 * tests/fixtures/lokal) and nothing for a file deleted since.
 */
export function workingFiles(git: Git, root: string): { path: string; content?: Buffer }[] {
  const paths = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .toString('utf8')
    .split('\0')
    .filter((name) => name !== '');
  return [...new Set(paths)].map((path) => {
    const full = join(root, path);
    let stat: Stats;
    try {
      stat = lstatSync(full);
    } catch {
      return { path };
    }
    if (stat.isFile()) return { path, content: readFileSync(full) };
    if (stat.isSymbolicLink()) return { path, content: readlinkSync(full, 'buffer') };
    return { path };
  });
}

/**
 * Every path that a commit no remote has yet adds, changes or removes, i.e. what the next push
 * would publish by name; folders are part of each path. One git process, whatever the count.
 */
export function unpublishedPaths(git: Git): string[] {
  const names = git([
    ...['log', '-z', '--root', '--no-color', '--format=', '--name-only', '--no-renames'],
    ...['--diff-merges=first-parent', ...UNPUBLISHED],
  ])
    .toString('utf8')
    .split('\0')
    .filter((name) => name !== '');
  return [...new Set(names)];
}

/**
 * Every file content (blob) of the commits that no remote has yet, i.e. what the next push would
 * publish — without a remote every commit. Three git processes, whatever the count.
 */
export function unpublishedBlobs(git: Git): { path: string; content: Buffer }[] {
  // "<sha>" for a commit, "<sha> <path>" for a tree or a blob
  const pathOf = new Map(
    git(['rev-list', '--objects', ...UNPUBLISHED])
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
const pathSecrets = pathSecretsOf(config, brands);
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

  /** A repository of its own in a temporary folder, with a commit helper; removed afterwards. */
  function inProbeRepo(
    run: (folder: string, git: Git, commit: (file: string, text: string) => void) => void,
  ) {
    const folder = mkdtempSync(join(tmpdir(), 'nobranding-'));
    try {
      const git = gitIn(folder);
      const commit = (file: string, text: string) => {
        mkdirSync(dirname(join(folder, file)), { recursive: true });
        writeFileSync(join(folder, file), text);
        git(['add', file]);
        git([
          ...['-c', 'user.name=Probe', '-c', 'user.email=probe@example.org'],
          ...['-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-m', `${file}`],
        ]);
      };
      git(['init', '-q']);
      run(folder, git, commit);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }

  it('finds an invented name that a later unpublished commit removed again, until a remote has it', (ctx) => {
    ctx.skip(!repoReadable, 'git cannot read this checkout (no git, or no .git)');
    inProbeRepo((folder, git, commit) => {
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
    });
  });

  it('finds an invented name in a new file, in a file name and on another branch or a detached HEAD, never following a link', (ctx) => {
    ctx.skip(!repoReadable, 'git cannot read this checkout (no git, or no .git)');
    const settings: AppConfig = { imprintUrl: 'https://www.kanzlei-probe.example/impressum' };
    const found = secretsOf(settings, ['Erika Probe']);
    const named = pathSecretsOf(settings, ['Erika Probe']);
    expect(named).toEqual(['erikaprobe', 'kanzleiprobeexample']);
    // hyphens, dots, underscores, case, folders and accents do not hide a name; other names pass
    for (const path of ['docs/erika-probe.pdf', 'Erika_Probe.PNG', 'x/ERIKA/probe.md'])
      expect(pathLeaks(path, named), path).toBe(true);
    expect(pathLeaks('bilder/kanzlei-probe.example.png', named)).toBe(true);
    expect(pathLeaks(`${'Erika Pro'}${String.fromCodePoint(0x0301)}be.md`, named)).toBe(true);
    expect(pathLeaks('docs/erika-muster.pdf', named)).toBe(false);
    inProbeRepo((folder, git, commit) => {
      commit('.gitignore', 'geheim/\n');
      commit('neutral.md', 'Nichts.\n');
      // new and not yet added: a file naming the Kanzlei, a file named after it, an ignored one
      writeFileSync(join(folder, 'neu.md'), 'Die Kanzlei Erika Probe.\n');
      writeFileSync(join(folder, 'erika-probe.txt'), 'Nichts.\n');
      mkdirSync(join(folder, 'geheim'));
      writeFileSync(join(folder, 'geheim', 'x.md'), 'Die Kanzlei Erika Probe.\n');
      // a linked folder (like node_modules or tests/fixtures/lokal) is listed but never read
      const outside = mkdtempSync(join(tmpdir(), 'nobranding-ziel-'));
      try {
        writeFileSync(join(outside, 'y.md'), 'Die Kanzlei Erika Probe.\n');
        symlinkSync(outside, join(folder, 'verweis'), 'junction');
        const files = workingFiles(git, folder);
        expect(files.map((file) => file.path).sort()).toEqual(
          ['.gitignore', 'erika-probe.txt', 'neu.md', 'neutral.md', 'verweis'].sort(),
        );
        const leaking = files.filter((file) => file.content && leaks(file.content, found));
        expect(leaking.map((file) => file.path)).toEqual(['neu.md']);
        expect(files.filter((file) => pathLeaks(file.path, named))).toHaveLength(1);
        // what git would store for the link: its target, not the folder's files
        expect(files.find((file) => file.path === 'verweis')?.content?.toString()).toContain(
          basename(outside),
        );
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
      rmSync(join(folder, 'neu.md'));
      rmSync(join(folder, 'erika-probe.txt'));
      rmSync(join(folder, 'verweis'));
      // a name committed and renamed away again is still in the unpublished commits
      commit('docs/Erika_Probe.png', 'Bild\n');
      git(['mv', 'docs/Erika_Probe.png', 'docs/bild.png']);
      commit('docs/bild.png', 'Bild\n');
      expect(workingFiles(git, folder).filter((file) => pathLeaks(file.path, named))).toEqual([]);
      expect(unpublishedPaths(git).filter((path) => pathLeaks(path, named))).toHaveLength(1);
      git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
      expect(unpublishedPaths(git)).toEqual([]);
      // a commit on another local branch, then one on a detached HEAD
      git(['checkout', '-q', '-b', 'andere']);
      commit('erika.probe.md', 'Nichts.\n');
      commit('andere.md', 'Die Kanzlei Erika Probe.\n');
      git(['checkout', '-q', 'HEAD~2']);
      expect(unpublishedPaths(git).sort()).toEqual(['andere.md', 'erika.probe.md']);
      expect(unpublishedBlobs(git).filter((blob) => leaks(blob.content, found))).toHaveLength(1);
      git(['branch', '-q', '-D', 'andere']);
      commit('abgeloest.md', 'Die Kanzlei Erika Probe.\n');
      expect(unpublishedPaths(git)).toEqual(['abgeloest.md']);
      expect(unpublishedBlobs(git).filter((blob) => leaks(blob.content, found))).toHaveLength(1);
    });
  });

  it('keeps the notice, its sentences naming the Kanzlei, the private name list and the link domains out of every file a commit could take, every unpublished commit and every commit message, and the names and domains out of every path', (ctx) => {
    ctx.skip(scanSkipped !== undefined, scanSkipped);
    const git = gitIn(ROOT);
    // a path that names the Kanzlei is never printed: it would carry the name into the output
    const shown = (path: string) =>
      pathLeaks(path, pathSecrets) ? '(a path that names the Kanzlei)' : path;
    const files = workingFiles(git, ROOT);
    expect(files.length).toBeGreaterThan(100);
    const leaking = files.filter((file) => file.content && leaks(file.content, secrets));
    expect(leaking.map((file) => shown(file.path))).toEqual([]);
    // the files of the commits a push would publish, also those removed again since
    const unpublished = unpublishedBlobs(git).filter((blob) => leaks(blob.content, secrets));
    expect(unpublished.map((blob) => shown(blob.path))).toEqual([]);
    // the paths of the working copy and of those commits, as a count only
    const paths = [...files.map((file) => file.path), ...unpublishedPaths(git)];
    expect(
      paths.filter((path) => pathLeaks(path, pathSecrets)).length,
      'paths that name the Kanzlei (not shown)',
    ).toBe(0);
    // the history as far as this clone has it (GitHub's checkout fetches one commit)
    const messages = git([
      'log',
      '--no-color',
      '--format=%B%n%an%n%ae%n%cn%n%ce',
      'HEAD',
      '--branches',
    ]);
    expect(leaks(messages, secrets)).toBe(false);
  });
});
