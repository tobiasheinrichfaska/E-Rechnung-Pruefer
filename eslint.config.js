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
// localStorage in src/io/accessStore.ts (ACCESS_STORE below) and, for the test version's run,
// src/io/testRunStore.ts (TEST_RUN_STORE). And the test version's „Bericht senden“ (2026-11-15):
// fetch in src/io/testReportSend.ts only (REPORT_SENDER below).
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

/** The files allowed to use localStorage: the remembered access notice and the test run. */
export const ACCESS_STORE = 'src/io/accessStore.ts';
/** The tester's run of the test version (Tobias 2026-11-15: „Ja, wie Fragebogen“). */
export const TEST_RUN_STORE = 'src/io/testRunStore.ts';
/**
 * The only file allowed to use fetch: „Bericht senden“ of the test version (Tobias 2026-11-15). The
 * live build has no test page; its CSP keeps connect-src 'none' (tests/e2e/testbericht.spec.ts).
 */
export const REPORT_SENDER = 'src/io/testReportSend.ts';

export default defineConfig([
  globalIgnores(['dist', 'dist-test', 'coverage', '.tmp', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.strict],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', ...NO_STORAGE_OR_NETWORK],
      'no-restricted-properties': ['error', ...NO_STORAGE_PROPERTIES],
    },
  },
  {
    // The one place that may keep something in the browser: the confirmed access notice
    files: [ACCESS_STORE, TEST_RUN_STORE],
    rules: {
      'no-restricted-globals': [
        'error',
        ...NO_STORAGE_OR_NETWORK.filter((name) => name !== 'localStorage'),
      ],
    },
  },
  {
    // The one place that may use the network: posting the test report of the test version
    files: [REPORT_SENDER],
    rules: {
      'no-restricted-globals': [
        'error',
        ...NO_STORAGE_OR_NETWORK.filter((name) => name !== 'fetch'),
      ],
    },
  },
  {
    files: ['src/ui/**/*.tsx', 'src/main.tsx'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    // Workspace rule: the logic layer runs and is testable without any UI, browser, WASM or IO.
    files: ['src/logic/**/*.ts'],
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
      'src/build/**/*.ts',
      'tests/**/*.ts',
      'src/**/*.test.ts',
    ],
    languageOptions: { globals: globals.node },
  },
  prettier,
]);
