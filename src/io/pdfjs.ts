// pdf.js in the browser, loaded on first use. The worker code runs in the main thread ("fake
// worker"): file:// forbids blob: workers and the CSP forbids workers altogether.
// The legacy build, as in the Node tests: the modern build calls Iterator, Promise.try and
// Uint8Array.prototype.toHex without polyfill, so every PDF failed in Chrome/Edge up to 139,
// Firefox up to 133 and Safari up to 18.3 while XML worked (audit 2026-11-14, S-01). The legacy
// build brings its own polyfills except Promise.withResolvers, which is added here.
import type { PdfJsLike } from './pdf';

interface Resolvers {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/** Promise.withResolvers (Chrome 119, Firefox 121, Safari 17.4), used by pdf.js on every file. */
export function ensurePromiseWithResolvers(): void {
  const constructor = Promise as PromiseConstructor & { withResolvers?: unknown };
  if (typeof constructor.withResolvers === 'function') return;
  Object.defineProperty(Promise, 'withResolvers', {
    configurable: true,
    writable: true,
    value: function withResolvers(this: PromiseConstructor): Resolvers {
      let resolve: Resolvers['resolve'] = () => undefined;
      let reject: Resolvers['reject'] = () => undefined;
      const promise = new this((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    },
  });
}

let loading: Promise<PdfJsLike> | undefined;

export function loadPdfJs(): Promise<PdfJsLike> {
  loading ??= (async () => {
    ensurePromiseWithResolvers();
    const [library, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
    ]);
    (globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = worker;
    return library as unknown as PdfJsLike;
  })();
  return loading;
}
