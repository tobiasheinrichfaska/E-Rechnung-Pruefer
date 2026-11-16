import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
 * the test version may connect to its own address (`connect-src 'self'`, „Bericht senden“ of the
 * shared test frame, Tobias 2026-11-15); every other build keeps `connect-src 'none'`.
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

/**
 * The folder of each build follows from its mode: the test version (test frame, `connect-src
 * 'self'`) goes to dist-test/ for the protected test zone, every other build to dist/, the file of
 * the public zone. A test version named into dist/ (`--outDir dist`) stops the build, so it can
 * never take the live file's place (audit 2026-11-15, R2-S-04; tests/build/viteConfig.test.ts).
 */
const outDirOf = (testArea: boolean) => (testArea ? 'dist-test' : 'dist');

function testVersionFolder(testArea: boolean): Plugin {
  return {
    name: 'test-version-folder',
    apply: 'build',
    configResolved: (config) => {
      const live = resolve(config.root, outDirOf(false));
      if (testArea && resolve(config.root, config.build.outDir) === live) {
        throw new Error(
          `Die Testfassung gehört nach ${outDirOf(true)}/, nie nach ${outDirOf(false)}/ (npm run build:test)`,
        );
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

/**
 * The test version's start (src/testArea.tsx) and the copy of the shared test frame
 * (src/testrahmen/, repo Testumgebung). Every mode except the test version's resolves them to a stub
 * that only throws: main.tsx imports the start statically, and a module's style stays in the bundle
 * even where the build folds its use away (found by the Fragebogen, 2026-11-15), so the condition in
 * main.tsx alone would not keep the frame out of the live file (tests/e2e/testrahmen.spec.ts).
 * Vitest resolves them as they are: tests/static/testrahmen.test.ts asks the frame about the binding.
 */
const TEST_AREA_ONLY = [
  /^\.{1,2}\/(?:.*\/)?testArea(?:\.tsx)?$/,
  /^\.{1,2}\/(?:.*\/)?testrahmen\/testrahmen\.(?:js|css)$/,
];
const TEST_AREA_STUB = fileURLToPath(new URL('./src/testAreaStub.ts', import.meta.url));

export default defineConfig(({ mode }) => ({
  // Relative paths so the single file also runs from file://
  base: './',
  plugins: [
    react(),
    viteSingleFile(),
    contentSecurityPolicy(mode === 'testbereich'),
    testVersionFolder(mode === 'testbereich'),
  ],
  resolve: {
    alias:
      mode !== 'testbereich' && process.env.VITEST === undefined
        ? TEST_AREA_ONLY.map((find) => ({ find, replacement: TEST_AREA_STUB }))
        : [],
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_CONFIG__: JSON.stringify(kanzlei.config),
    __APP_STAND__: JSON.stringify(standOf(mode === 'testbereich')),
  },
  build: {
    outDir: outDirOf(mode === 'testbereich'),
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
