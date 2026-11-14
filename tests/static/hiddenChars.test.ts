import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Invisible characters in source code are bugs waiting to happen (an editing tool once turned
// byte-order-mark escapes into the real character). Code must spell them as char codes. Bidi
// controls ("Trojan Source") and line/paragraph separators as well (audit 2026-11-14, T-13).
const INVISIBLE = [
  0x00ad, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2028, 0x2029, 0x202a, 0x202b, 0x202c, 0x202d,
  0x202e, 0x2060, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,
];
const pattern = new RegExp(`[${INVISIBLE.map((c) => String.fromCharCode(c)).join('')}]`);

const ROOT = new URL('../../', import.meta.url);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'fixtures' ? [] : files(path);
    return /\.(ts|tsx|js|css|html|md|json|xml|txt)$/.test(name) ? [path] : [];
  });
}

describe('source files', () => {
  it('contain no invisible characters', () => {
    const root = new URL('.', ROOT).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    const top = readdirSync(root)
      .filter((name) => /\.(ts|js|html|md|json)$/.test(name) && name !== 'package-lock.json')
      .map((name) => join(root, name));
    const found = ['src', 'tests', 'docs', 'manual_tests', 'beispiele', 'deploy']
      .flatMap((dir) => files(join(root, dir)))
      .concat(top)
      .filter((path) => pattern.test(readFileSync(path, 'utf8')));
    expect(top).toContain(join(root, 'CLAUDE.md'));
    expect(found).toEqual([]);
  });
});
