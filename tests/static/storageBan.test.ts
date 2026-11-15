import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';

// Tobias 2026-11-15 („ja, Beschränkung fällt“): the tool may remember the confirmed access notice —
// localStorage in src/io/accessStore.ts and nowhere else. This regression test shows that every
// other storage and network access is still refused, in that file as everywhere else.
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

describe('browser storage (ESLint)', () => {
  it('allows localStorage in the access store', async () => {
    expect(await refusals('localStorage.setItem("a", "b");\n', STORE)).toEqual([]);
  });

  it.each(['src/io/analyze.ts', 'src/ui/App.tsx', 'src/logic/accessGate.ts', 'src/config.ts'])(
    'refuses localStorage in %s',
    async (file) => {
      expect(await refusals('localStorage.setItem("a", "b");\n', file)).not.toEqual([]);
    },
  );

  it.each(FORBIDDEN)('still refuses %s, also in the access store', async (code) => {
    expect(await refusals(`${code}\n`, STORE)).not.toEqual([]);
    expect(await refusals(`${code}\n`, 'src/io/analyze.ts')).not.toEqual([]);
  });
});
