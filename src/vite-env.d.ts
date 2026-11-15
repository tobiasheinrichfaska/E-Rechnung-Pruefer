/// <reference types="vite/client" />

/** App version from package.json, injected at build time. */
declare const __APP_VERSION__: string;

/** The local Kanzlei configuration (config/kanzlei.local.json or the neutral example). */
declare const __APP_CONFIG__: import('./logic/appConfig').AppConfig;

/** The test version's „Tester einladen“ address (mode `testbereich`), else null (vite.config.ts). */
declare const __TESTER_INVITE__: string | null;

/** pdf.js worker code, run in the main thread ("fake worker") — file:// forbids blob: workers. */
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs';
