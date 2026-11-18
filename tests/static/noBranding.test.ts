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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configFile, loadAppConfig } from '../../src/build/kanzleiConfig';
import type { AppConfig } from '../../src/logic/appConfig';

// The access notice names the Kanzlei, so it lives only in the local configuration (Tobias
// 2026-11-15). Nothing of it may appear in this public repo: neither the notice, nor a sentence of
// it that names the Kanzlei (the first one, and any with a word of the private name list), nor a
// name form of that list, nor the domain of the Impressum or privacy address. A copy wrapped by an
// editor or quoted in Markdown counts as well (audit 2026-11-15, QT-04/QS-03): whitespace and `>`
// quote markers are ignored, case too. Two cases search the repo, also as bytes (PDF, ZIP …):
// - what the next commit and push would publish: every file a commit could take — tracked or new
//   and not ignored (audit 2026-11-16, R3-T-02), and what the index holds where it differs from the
//   working copy (R4-S-02: added, then changed or deleted only in the working copy) — and every
//   file, path and message (author and committer too) of every commit that no remote has yet, on
//   HEAD and every local branch (R2-S-05): a find committed and removed again by a later commit is
//   still published by the push;
// - what is published already (R4-S-01): every file, path and message of every commit a remote
//   has. A later commit does not take a find there out of the history; only a force-push does, and
//   the refs GitHub keeps for its pull requests only GitHub Support removes. So its failure asks
//   Tobias, and a shallow clone fails it, since it would read that history only in part.
// The paths count too (R3-S-04): a file named after the Kanzlei or its domain, compared as letters
// and digits only. A failure shows only paths (hidden where they name the Kanzlei), counts or yes/no.
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
  (cwd: string, env?: NodeJS.ProcessEnv): Git =>
  (args, input) =>
    execFileSync('git', args, {
      cwd,
      env,
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
export const UNPUBLISHED = ['HEAD', '--branches', '--not', '--remotes'];

/**
 * The commits a remote has already: every ref of `--all` but HEAD, the local branches and the
 * stash, whose own commits UNPUBLISHED reads — the remote branches, the tags and any pull request
 * refs the clone fetched (audit 2026-11-16, R4-S-01). `--single-worktree` keeps the HEADs of other
 * working copies (`git worktree add`) out: a commit on a detached HEAD there is not published
 * (audit 2026-11-17, R5-S-02); a run of this test in that working copy reads it as its own HEAD.
 * Both together: every commit but the stash's and those of other working copies' detached HEADs.
 */
export const PUBLISHED = [
  '--single-worktree',
  '--exclude=HEAD',
  '--exclude=refs/heads/*',
  '--exclude=refs/stash',
  '--all',
];

/** Whether the clone holds only part of the history (`git clone --depth`, GitHub's checkout). */
export function isShallow(git: Git): boolean {
  return git(['rev-parse', '--is-shallow-repository']).toString('utf8').trim() === 'true';
}

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
 * The contents of the named objects, in order, from one `git cat-file --batch`: object ids, or
 * `:<path>` for what the index holds (NUL-separated then, since a path may hold a line break).
 */
function contentsOf(git: Git, names: readonly string[], nul = false): Buffer[] {
  if (names.length === 0) return [];
  const out = git(
    ['cat-file', '--batch', ...(nul ? ['-z'] : [])],
    [...names, ''].join(nul ? '\0' : '\n'),
  );
  const found: Buffer[] = [];
  // "<sha> <type> <size>\n<content>\n" per object
  for (let at = 0; at < out.length;) {
    const end = out.indexOf(0x0a, at);
    const header = out.subarray(at, end < 0 ? undefined : end).toString('latin1');
    const size = Number(/^[0-9a-f]{40,64} \S+ (\d+)$/.exec(header)?.[1] ?? Number.NaN);
    // what git cannot read is counted, never named: the name may be a path that names the Kanzlei
    if (Number.isNaN(size)) {
      throw new Error(`git cat-file could not read object ${found.length + 1} of ${names.length}`);
    }
    const start = end + 1;
    found.push(out.subarray(start, start + size));
    at = start + size + 1;
  }
  // the counts only: a failing match would print the contents
  expect(found.length).toBe(names.length);
  return found;
}

/**
 * What the index holds where it differs from the working copy: a file added and then cleaned or
 * deleted only in the working copy still goes into the next `git commit` as it was added (audit
 * 2026-11-16, R4-S-02). Unmerged entries are left out (a commit needs them added again). Two git
 * processes, reading only the entries that differ.
 */
export function stagedFiles(git: Git): { path: string; content: Buffer }[] {
  const paths = git([
    'diff',
    '-z',
    '--name-only',
    '--no-renames',
    '--no-ext-diff',
    '--diff-filter=u',
  ])
    .toString('utf8')
    .split('\0')
    .filter((name) => name !== '');
  const contents = contentsOf(
    git,
    paths.map((path) => `:${path}`),
    true,
  );
  return paths.map((path, i) => ({ path, content: contents[i] ?? Buffer.alloc(0) }));
}

/** Every file a commit could take: the working copy and, where it differs, the index. */
export function committable(
  git: Git,
  root: string,
): { path: string; content?: Buffer; staged?: true }[] {
  return [
    ...workingFiles(git, root),
    ...stagedFiles(git).map((file) => ({ ...file, staged: true as const })),
  ];
}

/**
 * Every path that a commit of `revs` adds, changes or removes; for UNPUBLISHED what the next push
 * would publish by name. Folders are part of each path. One git process, whatever the count.
 */
export function commitPaths(git: Git, revs: readonly string[]): string[] {
  const names = git([
    ...['log', '-z', '--root', '--no-color', '--format=', '--name-only', '--no-renames'],
    ...['--diff-merges=first-parent', ...revs],
  ])
    .toString('utf8')
    .split('\0')
    .filter((name) => name !== '');
  return [...new Set(names)];
}

/**
 * Every file content (blob) of the commits of `revs`; for UNPUBLISHED what the next push would
 * publish — without a remote every commit. Three git processes, whatever the count.
 */
export function commitBlobs(
  git: Git,
  revs: readonly string[],
): { path: string; content: Buffer }[] {
  // "<sha>" for a commit, "<sha> <path>" for a tree or a blob
  const pathOf = new Map(
    git(['rev-list', '--objects', ...revs])
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
  const contents = contentsOf(git, blobs);
  return blobs.map((sha, i) => ({
    path: pathOf.get(sha) ?? sha,
    content: contents[i] ?? Buffer.alloc(0),
  }));
}

/** The messages, authors and committers of the commits of `revs`. */
export function messagesOf(git: Git, revs: readonly string[]): Buffer {
  return git(['log', '--no-color', '--format=%B%n%an%n%ae%n%cn%n%ce', ...revs]);
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

/** A path as a failure shows it: one that names the Kanzlei would carry the name into the output. */
const shown = (path: string) =>
  pathLeaks(path, pathSecrets) ? '(a path that names the Kanzlei)' : path;

/** The failure of a find in the published history: only Tobias can take it out (R4-S-01). */
const ASK_TOBIAS =
  'published already (a remote has it): ask Tobias. A new commit does not take it out of the history, only a force-push does, and the refs GitHub keeps for pull requests only GitHub Support removes';

describe('the Kanzlei configuration stays out of the public repo', () => {
  it('reads the neutral example only when no local configuration is there', () => {
    if (config.accessNotice === undefined)
      expect(configFile({})).toBe('config/kanzlei.example.json');
    // counts only: a failing toEqual({}) would print the file, and a real configuration copied
    // over the example names the Kanzlei (audit 2026-11-17, R5-S-01)
    const example: unknown = JSON.parse(readFileSync(`${ROOT}config/kanzlei.example.json`, 'utf8'));
    const isObject = typeof example === 'object' && example !== null && !Array.isArray(example);
    expect(isObject, 'kanzlei.example.json is no object (content not shown)').toBe(true);
    expect(
      Object.keys(example as object).length,
      'kanzlei.example.json is not empty (content not shown)',
    ).toBe(0);
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

  /**
   * The environment of the probe repositories: without git's own variables, so a run from a git
   * hook (which passes GIT_DIR, GIT_INDEX_FILE …) never writes into the real repository.
   */
  const probeEnv = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );

  /** A repository of its own in a temporary folder, with a commit helper; removed afterwards. */
  function inProbeRepo(
    run: (
      folder: string,
      git: Git,
      commit: (file: string, text: string, message?: string) => void,
    ) => void,
  ) {
    const folder = mkdtempSync(join(tmpdir(), 'nobranding-'));
    try {
      const git = gitIn(folder, probeEnv);
      const commit = (file: string, text: string, message = file) => {
        mkdirSync(dirname(join(folder, file)), { recursive: true });
        writeFileSync(join(folder, file), text);
        git(['add', file]);
        git([
          ...['-c', 'user.name=Probe', '-c', 'user.email=probe@example.org'],
          ...['-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-m', message],
        ]);
      };
      git(['init', '-q']);
      run(folder, git, commit);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }

  it('finds an invented name that a later commit removed again: unpublished until a remote has it, published from then on', (ctx) => {
    ctx.skip(!repoReadable, 'git cannot read this checkout (no git, or no .git)');
    inProbeRepo((folder, git, commit) => {
      commit('a.md', 'Die Kanzlei Erika Probe bietet das Tool an.\n');
      commit('a.md', 'Die [Kanzlei] bietet das Tool an.\n');
      commit('b.pdf', 'BT (Erika Probe) Tj\n');
      const found = secretsOf({ accessNotice: 'Ein Hilfsmittel der Erika Probe.' }, [
        'Erika Probe',
      ]);
      const leaking = (revs: readonly string[]) =>
        commitBlobs(git, revs)
          .filter((blob) => leaks(blob.content, found))
          .map((blob) => blob.path)
          .sort();
      // the working copy no longer has it in a.md, the history does
      expect(leaks(readFileSync(join(folder, 'a.md')), found)).toBe(false);
      const blobs = commitBlobs(git, UNPUBLISHED);
      expect(blobs.map((blob) => blob.path).sort()).toEqual(['a.md', 'a.md', 'b.pdf']);
      expect(leaking(UNPUBLISHED)).toEqual(['a.md', 'b.pdf']);
      expect(commitBlobs(git, PUBLISHED)).toEqual([]);
      // what a remote has is published: the case of its own reads it (R4-S-01)
      git(['update-ref', 'refs/remotes/origin/main', 'HEAD~1']);
      expect(leaking(UNPUBLISHED)).toEqual(['b.pdf']);
      expect(leaking(PUBLISHED)).toEqual(['a.md']);
      git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
      expect(commitBlobs(git, UNPUBLISHED)).toEqual([]);
      expect(leaking(PUBLISHED)).toEqual(['a.md', 'b.pdf']);
      expect(commitPaths(git, PUBLISHED).sort()).toEqual(['a.md', 'b.pdf']);
    });
  });

  it('reads as published every commit a remote, a tag or a pull request ref has, and neither HEAD, a local branch nor the stash; a shallow clone says so', (ctx) => {
    ctx.skip(!repoReadable, 'git cannot read this checkout (no git, or no .git)');
    inProbeRepo((folder, git, commit) => {
      const found = secretsOf({}, ['Erika Probe']);
      const named = pathSecretsOf({}, ['Erika Probe']);
      commit('neutral.md', 'Nichts.\n', 'Ein Gruß von Erika Probe');
      git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
      expect(leaks(messagesOf(git, PUBLISHED), found)).toBe(true);
      expect(leaks(messagesOf(git, UNPUBLISHED), found)).toBe(false);
      // a local branch, a detached HEAD and a stash: not published, UNPUBLISHED reads the commits
      git(['checkout', '-q', '-b', 'lokal']);
      commit('erika-probe.md', 'Nichts.\n');
      git(['checkout', '-q', '--detach']);
      commit('lose.md', 'Die Kanzlei Erika Probe.\n');
      writeFileSync(join(folder, 'neutral.md'), 'Die Kanzlei Erika Probe.\n');
      git(['-c', 'user.name=Probe', '-c', 'user.email=probe@example.org', 'stash', '-q']);
      expect(commitPaths(git, PUBLISHED)).toEqual(['neutral.md']);
      expect(commitBlobs(git, PUBLISHED).filter((blob) => leaks(blob.content, found))).toEqual([]);
      expect(commitPaths(git, UNPUBLISHED).sort()).toEqual(['erika-probe.md', 'lose.md']);
      // a pull request ref GitHub keeps, and a tag: published
      git(['update-ref', 'refs/pull/1/head', 'HEAD']);
      git(['tag', 'v1', 'lokal']);
      expect(commitPaths(git, PUBLISHED).sort()).toEqual([
        'erika-probe.md',
        'lose.md',
        'neutral.md',
      ]);
      expect(commitPaths(git, PUBLISHED).filter((path) => pathLeaks(path, named))).toHaveLength(1);
      expect(commitBlobs(git, PUBLISHED).filter((blob) => leaks(blob.content, found))).toHaveLength(
        1,
      );
      // a clone with part of the history only
      expect(isShallow(git)).toBe(false);
      const shallow = `${folder}-flach`;
      try {
        execFileSync('git', ['clone', '-q', '--depth', '1', pathToFileURL(folder).href, shallow], {
          env: probeEnv,
          stdio: 'pipe',
        });
        expect(isShallow(gitIn(shallow, probeEnv))).toBe(true);
      } finally {
        rmSync(shallow, { recursive: true, force: true });
      }
    });
  });

  it('reads a commit on the detached HEAD of another working copy neither as published nor from this one (R5-S-02)', (ctx) => {
    ctx.skip(!repoReadable, 'git cannot read this checkout (no git, or no .git)');
    inProbeRepo((folder, git, commit) => {
      commit('neutral.md', 'Nichts.\n', 'base');
      git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
      const second = `${folder}-zweite`;
      try {
        git(['worktree', 'add', '-q', '--detach', second]);
        const other = gitIn(second, probeEnv);
        writeFileSync(join(second, 'lose.md'), 'Die Kanzlei Erika Probe.\n');
        other(['add', 'lose.md']);
        other([
          ...['-c', 'user.name=Probe', '-c', 'user.email=probe@example.org'],
          ...['-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-m', 'lose'],
        ]);
        // from the main working copy: only what the remote has is published
        expect(commitPaths(git, PUBLISHED)).toEqual(['neutral.md']);
        expect(messagesOf(git, PUBLISHED).toString('utf8')).not.toContain('lose');
        // from the second one, its own HEAD is unpublished
        expect(commitPaths(other, UNPUBLISHED)).toEqual(['lose.md']);
        expect(commitPaths(other, PUBLISHED)).toEqual(['neutral.md']);
      } finally {
        rmSync(second, { recursive: true, force: true });
      }
    });
  });

  it('finds an invented name that only the index still holds: added, then cleaned or deleted in the working copy', (ctx) => {
    ctx.skip(!repoReadable, 'git cannot read this checkout (no git, or no .git)');
    inProbeRepo((folder, git, commit) => {
      const found = secretsOf({}, ['Erika Probe']);
      commit('neutral.md', 'Nichts.\n');
      // added, then cleaned only in the working copy
      writeFileSync(join(folder, 'a.md'), 'Die Kanzlei Erika Probe.\n');
      git(['add', 'a.md']);
      writeFileSync(join(folder, 'a.md'), 'Die [Kanzlei].\n');
      // added, then deleted
      writeFileSync(join(folder, 'b.md'), 'Ein Gruß von Erika Probe.\n');
      git(['add', 'b.md']);
      rmSync(join(folder, 'b.md'));
      // a tracked file changed in the working copy only: the index holds the commit's clean text
      writeFileSync(join(folder, 'neutral.md'), 'Noch nichts.\n');
      const files = workingFiles(git, folder);
      expect(files.filter((file) => file.content && leaks(file.content, found))).toEqual([]);
      expect(stagedFiles(git).map((file) => file.path)).toEqual(['a.md', 'b.md', 'neutral.md']);
      const leaking = committable(git, folder).filter(
        (file) => file.content && leaks(file.content, found),
      );
      expect(leaking.map((file) => [file.path, file.staged])).toEqual([
        ['a.md', true],
        ['b.md', true],
      ]);
      // what a commit without -a takes
      git([
        ...['-c', 'user.name=Probe', '-c', 'user.email=probe@example.org'],
        ...['-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-m', 'ohne -a'],
      ]);
      expect(leaks(git(['show', 'HEAD:a.md']), found)).toBe(true);
      // once index and working copy agree, the index is not read twice
      git(['add', '-A']);
      expect(stagedFiles(git)).toEqual([]);
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
      expect(commitPaths(git, UNPUBLISHED).filter((path) => pathLeaks(path, named))).toHaveLength(
        1,
      );
      git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
      expect(commitPaths(git, UNPUBLISHED)).toEqual([]);
      // a commit on another local branch, then one on a detached HEAD
      git(['checkout', '-q', '-b', 'andere']);
      commit('erika.probe.md', 'Nichts.\n');
      commit('andere.md', 'Die Kanzlei Erika Probe.\n');
      git(['checkout', '-q', 'HEAD~2']);
      expect(commitPaths(git, UNPUBLISHED).sort()).toEqual(['andere.md', 'erika.probe.md']);
      expect(
        commitBlobs(git, UNPUBLISHED).filter((blob) => leaks(blob.content, found)),
      ).toHaveLength(1);
      git(['branch', '-q', '-D', 'andere']);
      commit('abgeloest.md', 'Die Kanzlei Erika Probe.\n');
      expect(commitPaths(git, UNPUBLISHED)).toEqual(['abgeloest.md']);
      expect(
        commitBlobs(git, UNPUBLISHED).filter((blob) => leaks(blob.content, found)),
      ).toHaveLength(1);
    });
  });

  it('keeps the notice, its sentences naming the Kanzlei, the private name list and the link domains out of every file a commit could take (working copy and index), every unpublished commit and its message, and the names and domains out of every path', (ctx) => {
    ctx.skip(scanSkipped !== undefined, scanSkipped);
    const git = gitIn(ROOT);
    const files = committable(git, ROOT);
    expect(files.length).toBeGreaterThan(100);
    const leaking = files.filter((file) => file.content && leaks(file.content, secrets));
    expect(
      leaking.map((file) => `${shown(file.path)}${file.staged ? ' (in the index)' : ''}`),
    ).toEqual([]);
    // the files of the commits a push would publish, also those removed again since
    const unpublished = commitBlobs(git, UNPUBLISHED).filter((blob) =>
      leaks(blob.content, secrets),
    );
    expect(unpublished.map((blob) => shown(blob.path))).toEqual([]);
    // the paths of the working copy and of those commits, as a count only
    const paths = [...files.map((file) => file.path), ...commitPaths(git, UNPUBLISHED)];
    expect(
      paths.filter((path) => pathLeaks(path, pathSecrets)).length,
      'paths that name the Kanzlei (not shown)',
    ).toBe(0);
    // the messages, authors and committers of those commits
    expect(
      leaks(messagesOf(git, UNPUBLISHED), secrets),
      'a message, author or committer of an unpublished commit',
    ).toBe(false);
  });

  it('keeps them out of the published history too: every file, path and message of every commit a remote has; a find there goes to Tobias', (ctx) => {
    ctx.skip(scanSkipped !== undefined, scanSkipped);
    const git = gitIn(ROOT);
    expect(
      isShallow(git),
      'this clone is shallow and would read the published history only in part: run `git fetch --unshallow` first',
    ).toBe(false);
    const remote = git(['for-each-ref', '--count=1', '--format=%(refname)', 'refs/remotes']);
    ctx.skip(remote.length === 0, 'this clone has no remote branch: it has published nothing');
    const blobs = commitBlobs(git, PUBLISHED);
    expect(blobs.length).toBeGreaterThan(100);
    expect(
      blobs.filter((blob) => leaks(blob.content, secrets)).map((blob) => shown(blob.path)),
      `${ASK_TOBIAS} (files)`,
    ).toEqual([]);
    expect(
      commitPaths(git, PUBLISHED).filter((path) => pathLeaks(path, pathSecrets)).length,
      `${ASK_TOBIAS} (paths that name the Kanzlei, not shown)`,
    ).toBe(0);
    expect(
      leaks(messagesOf(git, PUBLISHED), secrets),
      `${ASK_TOBIAS} (a message, author or committer)`,
    ).toBe(false);
  }, 30_000);
});
