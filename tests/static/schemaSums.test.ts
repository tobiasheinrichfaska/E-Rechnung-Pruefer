import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The bundled XSD are the official files, unchanged (schemas/README.md): the SHA-256 of each one is
// recorded in docs/quellen.md, so an edited schema fails here instead of checking invoices against
// rules nobody published (audit 2026-11-15, QT-03).
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function xsdFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return xsdFiles(path);
    return name.endsWith('.xsd') ? [path] : [];
  });
}

describe('the bundled schemas', () => {
  it('are the official files: the SHA-256 of every schemas/**/*.xsd is in docs/quellen.md', () => {
    const sources = readFileSync(join(ROOT, 'docs', 'quellen.md'), 'utf8');
    const files = xsdFiles(join(ROOT, 'schemas'));
    // UBL 2.1 (16), CII D16B (4), Factur-X 1.09.2 MINIMUM … EXTENDED (5 × 4)
    expect(files).toHaveLength(40);
    const unrecorded = files
      .filter((path) => {
        const sum = createHash('sha256').update(readFileSync(path)).digest('hex');
        return !sources.includes(sum);
      })
      .map((path) => path.slice(ROOT.length));
    expect(unrecorded).toEqual([]);
  });
});
