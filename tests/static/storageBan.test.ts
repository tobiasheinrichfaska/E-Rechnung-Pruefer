import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';

// Tobias 2026-11-15 („ja, Beschränkung fällt“): the tool may remember the confirmed access notice —
// localStorage in src/io/accessStore.ts and nowhere else. The tool itself never uses the network:
// the test version's run and „Bericht senden“ belong to the shared test frame (src/testrahmen/, a
// copy from Testumgebung, left out of ESLint and checked by hash in tests/static/testrahmen.test.ts).
// This regression test shows that every other storage and network access in src/ is still refused,
// in the access store as everywhere else.
const cwd = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd });

async function refusals(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-globals' || m.ruleId === 'no-restricted-properties')
    .map((m) => m.message);
}

const STORE = 'src/io/accessStore.ts';
const FORBIDDEN = [
  'sessionStorage.setItem("a", "b");',
  'indexedDB.open("a");',
  'void caches.keys();',
  'document.cookie = "a=b";',
  'window.localStorage.setItem("a", "b");',
  'globalThis.localStorage.clear();',
  'void navigator.storage.persist();',
  'void fetch("https://example.org/");',
];
// Where the old test page kept its run and sent its report, the test version's start and the entry
const ELSEWHERE = [
  'src/io/analyze.ts',
  'src/ui/App.tsx',
  'src/logic/accessGate.ts',
  'src/logic/testBinding.ts',
  'src/config.ts',
  'src/main.tsx',
  'src/testArea.tsx',
  'src/io/testRunStore.ts',
  'src/io/testReportSend.ts',
];

describe('browser storage (ESLint)', () => {
  it('allows localStorage in the access store', async () => {
    expect(await refusals('localStorage.setItem("a", "b");\n', STORE)).toEqual([]);
    expect(await refusals('localStorage.removeItem("a");\n', STORE)).toEqual([]);
  });

  it.each(ELSEWHERE)('refuses localStorage in %s', async (file) => {
    expect(await refusals('localStorage.setItem("a", "b");\n', file)).not.toEqual([]);
  });

  it.each(FORBIDDEN)('still refuses %s, also in the access store', async (code) => {
    expect(await refusals(`${code}\n`, STORE)).not.toEqual([]);
    expect(await refusals(`${code}\n`, 'src/io/analyze.ts')).not.toEqual([]);
  });
});

describe('network (ESLint)', () => {
  const POST = 'void fetch("/_zugang/bericht", { method: "POST" });\n';

  it.each([STORE, ...ELSEWHERE])('refuses fetch in %s', async (file) => {
    expect(await refusals(POST, file)).not.toEqual([]);
  });

  it.each(['new XMLHttpRequest();', 'new WebSocket("wss://example.org/");'])(
    'refuses %s in the start of the test version',
    async (code) => {
      expect(await refusals(`${code}\n`, 'src/testArea.tsx')).not.toEqual([]);
    },
  );
});

describe('the copy of the shared test frame', () => {
  it('is left out of ESLint, the only part of src/ that may store the run and send the report', async () => {
    expect(await eslint.isPathIgnored('src/testrahmen/testrahmen.js')).toBe(true);
    // a file of the tool next to it is not
    expect(await eslint.isPathIgnored('src/testArea.tsx')).toBe(false);
    expect(await eslint.isPathIgnored('src/io/accessStore.ts')).toBe(false);
  });
});
