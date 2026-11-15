import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';

// Tobias 2026-11-15 („ja, Beschränkung fällt“): the tool may remember the confirmed access notice —
// localStorage in src/io/accessStore.ts and nowhere else. The same day the test version got
// „Bericht senden“ — fetch in src/io/testReportSend.ts and nowhere else. This regression test shows
// that every other storage and network access is still refused, in those files as everywhere else.
const cwd = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd });

async function refusals(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-globals' || m.ruleId === 'no-restricted-properties')
    .map((m) => m.message);
}

const STORE = 'src/io/accessStore.ts';
const SENDER = 'src/io/testReportSend.ts';
const RUN_STORE = 'src/io/testRunStore.ts';
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

describe('browser storage (ESLint)', () => {
  it('allows localStorage in the access store and in the test run store', async () => {
    expect(await refusals('localStorage.setItem("a", "b");\n', STORE)).toEqual([]);
    expect(await refusals('localStorage.setItem("a", "b");\n', RUN_STORE)).toEqual([]);
  });

  it.each([
    'src/io/analyze.ts',
    'src/ui/App.tsx',
    'src/logic/accessGate.ts',
    'src/config.ts',
    'src/ui/testbereich/TestShell.tsx',
    SENDER,
  ])('refuses localStorage in %s', async (file) => {
    expect(await refusals('localStorage.setItem("a", "b");\n', file)).not.toEqual([]);
  });

  it.each(FORBIDDEN)('still refuses %s, also in the two stores', async (code) => {
    expect(await refusals(`${code}\n`, STORE)).not.toEqual([]);
    expect(await refusals(`${code}\n`, RUN_STORE)).not.toEqual([]);
    expect(await refusals(`${code}\n`, 'src/io/analyze.ts')).not.toEqual([]);
  });
});

describe('network (ESLint)', () => {
  const POST = 'void fetch("/_zugang/bericht", { method: "POST" });\n';

  it('allows fetch in the report sender of the test version', async () => {
    expect(await refusals(POST, SENDER)).toEqual([]);
  });

  it.each([STORE, 'src/io/analyze.ts', 'src/ui/testbereich/TestShell.tsx', 'src/main.tsx'])(
    'refuses fetch in %s',
    async (file) => {
      expect(await refusals(POST, file)).not.toEqual([]);
    },
  );

  it.each(FORBIDDEN.filter((code) => !code.includes('fetch')).concat(['new XMLHttpRequest();']))(
    'still refuses %s in the report sender',
    async (code) => {
      expect(await refusals(`${code}\n`, SENDER)).not.toEqual([]);
    },
  );

  it('refuses localStorage in the report sender', async () => {
    expect(await refusals('localStorage.setItem("a", "b");\n', SENDER)).not.toEqual([]);
  });
});
