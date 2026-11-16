import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

// Fixed frame (hand-over 2026-11-13): the file never leaves the computer and nothing is stored.
// The browser's CSP blocks the network; these rules keep the code from even trying. Changed
// 2026-11-15 (Tobias, „ja, Beschränkung fällt“): one exception, the remembered access notice —
// localStorage in src/io/accessStore.ts (ACCESS_STORE below). The tool itself has no fetch at all:
// the test version's run and „Bericht senden“ belong to the shared test frame, a copy from the repo
// Testumgebung in src/testrahmen/ that is ignored above and checked by hash instead; only the test
// version bundles it, and only its CSP says connect-src 'self'.
// Anything else stays refused (tests/static/storageBan.test.ts).
const NO_STORAGE_OR_NETWORK = [
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'caches',
  'cookieStore',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'BroadcastChannel',
  'RTCPeerConnection',
  'Worker',
  'SharedWorker',
];
// Without `object` the property is banned on every object, so globalThis.localStorage,
// self.fetch or an alias of window are caught too (audit 2026-11-14, S-06).
const NO_STORAGE_PROPERTIES = [
  { property: 'localStorage' },
  { property: 'sessionStorage' },
  { property: 'indexedDB' },
  { property: 'caches' },
  { property: 'cookie' },
  { property: 'cookieStore' },
  { property: 'fetch' },
  { property: 'sendBeacon' },
  { property: 'serviceWorker' },
  { object: 'navigator', property: 'storage' },
  { object: 'window', property: 'open' },
  { object: 'window', property: 'name' },
];

/** The one file allowed to use localStorage: the remembered access notice. */
export const ACCESS_STORE = 'src/io/accessStore.ts';

export default defineConfig([
  // src/testrahmen/: the shared test frame, a copy from Testumgebung checked by hash — never linted
  // or changed here (tests/static/testrahmen.test.ts)
  globalIgnores([
    'dist',
    'dist-test',
    'coverage',
    '.tmp',
    'playwright-report',
    'test-results',
    'src/testrahmen',
  ]),
  {
    // .mts and .cts too: Vite bundles them and tsc checks them, and without this block espree would
    // read them and stop at the first type (audit 2026-11-16, R3-S-01)
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [js.configs.recommended, tseslint.configs.strict],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Every script form in src/ that Vite bundles: TypeScript (.ts, .tsx, .mts, .cts) and plain
    // JavaScript (.js, .jsx, .mjs, .cjs) — audit 2026-11-15, R2-S-03, and 2026-11-16, R3-S-01; a file
    // with another ending is not linted at all. The copy of the test frame is ignored above and checked
    // by hash and folder listing instead.
    files: ['src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    rules: {
      'no-restricted-globals': ['error', ...NO_STORAGE_OR_NETWORK],
      'no-restricted-properties': ['error', ...NO_STORAGE_PROPERTIES],
    },
  },
  {
    // The one place that may keep something in the browser: the confirmed access notice
    files: [ACCESS_STORE],
    rules: {
      'no-restricted-globals': [
        'error',
        ...NO_STORAGE_OR_NETWORK.filter((name) => name !== 'localStorage'),
      ],
    },
  },
  {
    files: ['src/ui/**/*.tsx', 'src/main.tsx'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    // Workspace rule: the logic layer runs and is testable without any UI, browser, WASM or IO —
    // in every script form, not only .ts (R3-S-01).
    files: ['src/logic/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'Logic layer must not import React.',
            },
            {
              group: ['**/ui/**', '**/io/**'],
              message: 'Logic layer must not import from ui/ or io/.',
            },
            {
              group: ['pdfjs-dist', 'pdfjs-dist/*', 'libxml2-wasm', 'libxml2-wasm/*'],
              message: 'PDF and XML engines belong to src/io/.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...NO_STORAGE_OR_NETWORK,
        'window',
        'document',
        'navigator',
        'DOMParser',
      ],
    },
  },
  {
    files: [
      'vite.config.ts',
      'playwright.config.ts',
      'eslint.config.js',
      'src/build/**/*.{ts,mts,cts}',
      'tests/**/*.{ts,mts,cts}',
      'src/**/*.test.{ts,mts,cts}',
    ],
    languageOptions: { globals: globals.node },
  },
  prettier,
]);
