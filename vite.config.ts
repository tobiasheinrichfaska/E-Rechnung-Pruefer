import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import type { Plugin } from 'vite';
import { withCsp } from './src/build/csp.ts';
import { loadAppConfig } from './src/build/kanzleiConfig.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// The Kanzlei configuration (access notice) stays out of the public repo: the gitignored local
// file or the private companion's, else the neutral example (src/build/kanzleiConfig.ts).
const kanzlei = loadAppConfig();

/**
 * The CSP with the hashes of what the single-file step inlined — applied to the written file. Only
 * the test version may connect to its own address (`connect-src 'self'`, „Bericht senden“, Tobias
 * 2026-11-15); every other build keeps `connect-src 'none'`.
 */
function contentSecurityPolicy(testArea: boolean): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    writeBundle: (options, bundle) => {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html') || !options.dir) continue;
        const path = join(options.dir, file.fileName);
        writeFileSync(path, withCsp(readFileSync(path, 'utf8'), { connectSelf: testArea }));
      }
    },
  };
}

/** The commit a test report names (`stand`): the test version needs git, the live build does not. */
function standOf(testArea: boolean): string | null {
  if (!testArea) return null;
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (error) {
    throw new Error('npm run build:test braucht git für den Stand des Berichts', { cause: error });
  }
}

// The test version (`npm run build:test`, mode `testbereich`, folder dist-test/) for the protected
// test zone links „Tester einladen“ to the page of the login script (repo Testumgebung, Tobias
// 2026-11-15). Every other build gets null, so the address never reaches dist/index.html.
const TESTER_INVITE = '/_zugang/einladen';

export default defineConfig(({ mode }) => ({
  // Relative paths so the single file also runs from file://
  base: './',
  plugins: [react(), viteSingleFile(), contentSecurityPolicy(mode === 'testbereich')],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_CONFIG__: JSON.stringify(kanzlei.config),
    __TESTER_INVITE__: JSON.stringify(mode === 'testbereich' ? TESTER_INVITE : null),
    __APP_STAND__: JSON.stringify(standOf(mode === 'testbereich')),
  },
  build: {
    target: 'es2022',
    // The preload polyfill uses fetch(), which the CSP forbids — everything is inlined anyway
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 10000,
  },
  server: { port: 5178, strictPort: true },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    // pdf.js fails under vmThreads ("Linked modules must use the same context"), as in Fragebogen
    pool: 'forks',
    globals: true,
  },
}));
