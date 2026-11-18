import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

// Invisible characters in source code are bugs waiting to happen (an editing tool once turned
// byte-order-mark escapes into the real character). Code must spell them as char codes. Bidi
// controls ("Trojan Source") and line/paragraph separators as well (audit 2026-11-14, T-13), and
// since audit 2026-11-16 (R3-T-07) every format character (Unicode category Cf) plus the blanks
// that are letters or marks: tag characters hide text a language model reads ("ASCII smuggling"),
// and Claude sessions read CLAUDE.md, docs/ and manual_tests/ as instructions.
// Spelled one by one: soft hyphen, zero-width space and joiners, marks, line and paragraph
// separator, bidi controls, word joiner, BOM (T-13); the invisible operators and the Mongolian vowel
// separator (these are Cf as well, kept by name); the Hangul fillers (letters), the combining
// grapheme joiner and the Khmer inherent vowels (marks)
const INVISIBLE = [
  0x00ad, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x202a, 0x202b, 0x202c, 0x202d,
  0x202e, 0x2060, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff, 0x2061, 0x2062, 0x2063, 0x2064, 0x180e,
  0x115f, 0x1160, 0x3164, 0xffa0, 0x034f, 0x17b4, 0x17b5,
];
// The tag characters (U+E0000 to U+E007F, the assigned ones Cf as well) and the variation selectors
const INVISIBLE_RANGES = [
  [0xe0000, 0xe007f],
  [0xfe00, 0xfe0f],
  [0xe0100, 0xe01ef],
] as const;
// Built from code points with the u flag, never written as the characters themselves (the Write
// tool decodes escapes into the real character); \p{Cf} takes every other format character
const char = (code: number) => String.fromCodePoint(code);
const pattern = new RegExp(
  `[\\p{Cf}\\p{Zl}\\p{Zp}${INVISIBLE.map(char).join('')}${INVISIBLE_RANGES.map(
    ([from, to]) => `${char(from)}-${char(to)}`,
  ).join('')}]`,
  'u',
);

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

// .mjs/.mts/.cjs as well: the checker of the test frame's copy is pruefen.mjs (R2-S-03); .jsx, which
// ESLint lints in src/ (R3-T-07); .conf, the font configuration of the e2e run (R5-T-01)
const SCANNED = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|css|html|md|json|xml|txt|ya?ml|conf)$/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return THIRD_PARTY.includes(path) ? [] : files(path);
    return SCANNED.test(name) ? [path] : [];
  });
}

describe('the pattern of invisible characters', () => {
  it('finds each kind it is meant for, built from its code point', () => {
    const probes = [
      0xe0001, 0xe0020, 0xe0069, 0xe007f, 0xe0000, 0x2061, 0x2062, 0x2064, 0x180e, 0x115f, 0x1160,
      0x3164, 0xffa0, 0xfe00, 0xfe0f, 0xe0100, 0xe01ef, 0x061c, 0xfff9, 0x00ad, 0x200b, 0x202e,
      0x2028, 0xfeff,
    ];
    const missed = probes.filter((code) => !pattern.test(`Text${char(code)}Text`));
    expect(missed.map((code) => code.toString(16))).toEqual([]);
  });

  it('lets German text, typographic marks and the visible spaces pass', () => {
    const visible = [0x201e, 0x201c, 0x201a, 0x2018, 0x2013, 0x2014, 0x2026, 0x00a7, 0x20ac]
      .concat([0x00e4, 0x00f6, 0x00fc, 0x00df, 0x00c4, 0x00a0, 0x202f, 0x2009, 0x00b7, 0x2192])
      .map(char)
      .join('');
    expect(pattern.test(`Text ${visible} Text\n\tEnde`)).toBe(false);
  });
});

describe('source files', () => {
  it('contain no invisible characters', () => {
    // the root files and the dotfiles (.gitattributes, .gitignore …; not .git, not a local .env)
    const top = readdirSync(root)
      .filter(
        (name) =>
          (SCANNED.test(name) && name !== 'package-lock.json') ||
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
          'tests/e2e/fonts.conf',
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
