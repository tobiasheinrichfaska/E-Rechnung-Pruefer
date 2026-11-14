import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

// Fixed frame (hand-over 2026-11-13): the file never leaves the computer and nothing is stored —
// other apps share this origin. The browser's CSP blocks the network; these rules keep the code
// from even trying.
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

export default defineConfig([
  globalIgnores(['dist', 'coverage', '.tmp', 'playwright-report', 'test-results']),
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
