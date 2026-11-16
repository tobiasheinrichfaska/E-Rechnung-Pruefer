// The binding of the shared test frame (repo Testumgebung, testrahmen/, copied into src/testrahmen/;
// its docs/testrahmen.md): what the test version tells the frame about the tool. Pure, so
// tests/static/testrahmen.test.ts checks it with the frame's own bindingProblems; src/testArea.tsx
// starts the frame with it. No start points: the tool has no prepared states, every manual test
// begins with an empty page.
import type { Anbindung } from '../testrahmen/testrahmen.js';

/** The tool as its reports name it: `app` of the area erechnung-test (Testumgebung, zugang/bereiche.json). */
export const TEST_APP = 'erechnung';

/** The manual tests (manual_tests/0X_*.md, path → text) as the frame takes them, in name order. */
export function manualTestFiles(
  raw: Readonly<Record<string, string>>,
): { datei: string; text: string }[] {
  return Object.entries(raw)
    .map(([path, text]) => ({ datei: path.split('/').pop() ?? path, text }))
    .sort((a, b) => a.datei.localeCompare(b.datei));
}

export interface TestBuild {
  /** Shown on top of the test page. */
  name: string;
  /** From package.json. */
  version: string;
  /** The commit of the test version (`git rev-parse --short HEAD` at build time). */
  stand: string;
  /** manual_tests/0X_*.md, bundled into the test version only. */
  manualTests: Readonly<Record<string, string>>;
  /** „App neu starten“: the tool starts afresh, the remembered access notice stays. */
  restart: () => void;
  /** „App vollständig zurücksetzen“: forgets what the tool keeps, then starts it afresh. */
  reset: () => void;
}

export function testBinding(build: TestBuild): Anbindung {
  return {
    app: TEST_APP,
    name: build.name,
    version: build.version,
    stand: build.stand,
    handtests: manualTestFiles(build.manualTests),
    neuStarten: build.restart,
    zuruecksetzen: build.reset,
  };
}
