// Checks that this copy of the shared test page is unchanged (Testumgebung, testrahmen/). Plain
// Node, no dependency: `node pruefen.mjs`, or in a test of the app:
//   import { pruefeKopie } from '<folder>/pruefen.mjs'; expect(pruefeKopie()).toEqual([]);
// Change the test page in Testumgebung and copy it again (`npm run rahmen -- <folder of the app>`).
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));

/** The files every copy has; a stamp without one of them is no complete copy. */
const PFLICHT = ['testrahmen.js', 'testrahmen.d.ts', 'testrahmen.css', 'pruefen.mjs', 'pruefen.d.mts'];

/** The deviations from testrahmen.json, in German; empty when the copy is unchanged. */
export function pruefeKopie(ordner = hier) {
  let stempel;
  try {
    stempel = JSON.parse(readFileSync(join(ordner, 'testrahmen.json'), 'utf8'));
  } catch {
    return ['testrahmen.json fehlt oder ist kein JSON.'];
  }
  const dateien = stempel && typeof stempel.dateien === 'object' && stempel.dateien !== null ? stempel.dateien : {};
  const fehler = [];
  // A trial copy (`--entwurf`) holds code that is in no commit of Testumgebung: never in an app.
  if (typeof stempel?.stand !== 'string' || stempel.stand.includes('+entwurf')) {
    fehler.push(`Die Kopie ist ein Entwurf (Stand ${String(stempel?.stand)}), nicht aus einem Commit von Testumgebung. Bitte aus einem committeten Stand neu kopieren.`);
  }
  for (const name of PFLICHT) if (!Object.prototype.hasOwnProperty.call(dateien, name)) fehler.push(`testrahmen.json nennt ${name} nicht.`);
  for (const [name, soll] of Object.entries(dateien)) {
    let text;
    try {
      text = readFileSync(join(ordner, name), 'utf8');
    } catch {
      fehler.push(`${name} fehlt.`);
      continue;
    }
    const ist = createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
    if (ist !== soll) fehler.push(`${name} wurde hier geändert. Bitte in Testumgebung ändern und neu kopieren.`);
  }
  return fehler;
}

/** Run directly (`node pruefen.mjs`), also through a symlink or a junction: compare real paths. */
function direktAufgerufen() {
  try {
    return Boolean(process.argv[1]) && pathToFileURL(realpathSync(process.argv[1])).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch {
    return false;
  }
}

if (direktAufgerufen()) {
  const fehler = pruefeKopie();
  if (fehler.length > 0) {
    for (const zeile of fehler) console.error(zeile);
    process.exit(1);
  }
  console.log('Testrahmen: Kopie unverändert.');
}
