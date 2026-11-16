import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

// Invisible characters in source code are bugs waiting to happen (an editing tool once turned
// byte-order-mark escapes into the real character). Code must spell them as char codes. Bidi
// controls ("Trojan Source") and line/paragraph separators as well (audit 2026-11-14, T-13).
const INVISIBLE = [
  0x00ad, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x202a, 0x202b, 0x202c, 0x202d,
  0x202e, 0x2060, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,
];
const pattern = new RegExp(`[${INVISIBLE.map((c) => String.fromCharCode(c)).join('')}]`);

const ROOT = new URL('../../', import.meta.url);
const root = new URL('.', ROOT).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// Third-party files, byte-identical to their source (and the link to the private repo): left as
// they are. Everything else under tests/fixtures/ is ours and scanned — the invented
// Beispielkanzlei's notice is the label of the tick box in the GitHub check (audit 2026-11-15,
// R2-T-07).
const THIRD_PARTY = [
  'tests/fixtures/offiziell/cen',
  'tests/fixtures/offiziell/kosit',
  'tests/fixtures/lokal',
].map((dir) => join(root, dir));

// .mjs/.mts/.cjs as well: the checker of the test frame's copy is pruefen.mjs (R2-S-03)
const SCANNED = /\.(ts|tsx|mts|cts|js|mjs|cjs|css|html|md|json|xml|txt|ya?ml)$/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return THIRD_PARTY.includes(path) ? [] : files(path);
    return SCANNED.test(name) ? [path] : [];
  });
}

describe('source files', () => {
  it('contain no invisible characters', () => {
    // the root files and the dotfiles (.gitattributes, .gitignore …; not .git, not a local .env)
    const top = readdirSync(root)
      .filter(
        (name) =>
          (/\.(ts|js|html|md|json)$/.test(name) && name !== 'package-lock.json') ||
          (name.startsWith('.') && name !== '.git' && !name.startsWith('.env')),
      )
      .map((name) => join(root, name))
      .filter((path) => statSync(path).isFile());
    // config/, .github/ (the check „Tests“ itself) and schemas/ — its XSD by their extension not
    // (official files, unchanged), its README and licence texts yes (audit 2026-11-15, QT-14)
    const dirs = ['src', 'tests', 'docs', 'manual_tests', 'beispiele', 'deploy'];
    const scanned = [...dirs, 'config', 'schemas', '.github']
      .flatMap((dir) => files(join(root, dir)))
      .concat(top);
    const found = scanned.filter((path) => pattern.test(readFileSync(path, 'utf8')));
    expect(top).toEqual(
      expect.arrayContaining(['CLAUDE.md', '.gitattributes'].map((n) => join(root, n))),
    );
    expect(scanned).toEqual(
      expect.arrayContaining(
        [
          'config/README.md',
          'schemas/README.md',
          '.github/workflows/tests.yml',
          'src/testrahmen/pruefen.mjs',
          'src/testrahmen/pruefen.d.mts',
          'tests/fixtures/config/README.md',
          'tests/fixtures/config/beispiel-kanzlei.json',
          'tests/fixtures/offiziell/README.md',
        ].map((n) => join(root, n)),
      ),
    );
    expect(found).toEqual([]);
    // the official files and the private link stay out
    expect(
      scanned.filter((path) => THIRD_PARTY.some((dir) => path.startsWith(`${dir}${sep}`))),
    ).toEqual([]);
  });
});
