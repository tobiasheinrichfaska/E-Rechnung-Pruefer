import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ACCESS_STORAGE } from '../../src/logic/storageKeys';

const BUILT = join(import.meta.dirname, '..', '..', 'dist', 'index.html');
export const APP = pathToFileURL(BUILT).href;

/** An https address for the built file (the hosted copy), answered from disk by the test. */
export const HOSTED = 'https://e-rechnung.test';

// Records every attempt to store something or to leave the page: the file never leaves the
// computer, and the only thing kept is the confirmed access notice (Tobias 2026-11-15) — reading
// and writing its key is allowed (sideEffects), anything else is reported.
const SPY = () => {
  const seen: string[] = [];
  (window as unknown as { __sideEffects: string[] }).__sideEffects = seen;
  for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const) {
    const original = Storage.prototype[method] as (...args: unknown[]) => unknown;
    Storage.prototype[method] = function (this: Storage, ...args: unknown[]) {
      const key = typeof args[0] === 'string' ? `:${args[0]}` : '';
      seen.push(`storage.${method}${key}`);
      return original.apply(this, args);
    } as never;
  }
  const idb = window.indexedDB;
  if (idb) {
    const open = idb.open.bind(idb);
    idb.open = ((...args: Parameters<IDBFactory['open']>) => {
      seen.push('indexedDB.open');
      return open(...args);
    }) as IDBFactory['open'];
  }
  const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  Object.defineProperty(document, 'cookie', {
    get() {
      seen.push('cookie.get');
      return cookie?.get?.call(document) as string;
    },
    set(value: string) {
      seen.push('cookie.set');
      cookie?.set?.call(document, value);
    },
  });
  // Ways out that a CSP does not close (audit 2026-11-14, S-07): other apps on the origin
  // (BroadcastChannel), popups, WebRTC, the async cookie API and beacons.
  const w = window as unknown as Record<string, unknown>;
  for (const name of ['BroadcastChannel', 'RTCPeerConnection', 'SharedWorker', 'Worker']) {
    const Original = w[name] as (new (...args: unknown[]) => object) | undefined;
    if (!Original) continue;
    w[name] = new Proxy(Original, {
      construct(target, args) {
        seen.push(name);
        return Reflect.construct(target, args) as object;
      },
    });
  }
  const open = window.open.bind(window);
  window.open = ((...args: Parameters<typeof window.open>) => {
    seen.push('window.open');
    return open(...args);
  }) as typeof window.open;
  const beacon = navigator.sendBeacon?.bind(navigator);
  if (beacon) {
    navigator.sendBeacon = ((...args: Parameters<typeof navigator.sendBeacon>) => {
      seen.push('sendBeacon');
      return beacon(...args);
    }) as typeof navigator.sendBeacon;
  }
  const store = w['cookieStore'] as Record<string, (...args: unknown[]) => unknown> | undefined;
  if (store) {
    for (const method of ['get', 'getAll', 'set', 'delete']) {
      const original = store[method]?.bind(store);
      if (original) {
        store[method] = (...args: unknown[]) => {
          seen.push(`cookieStore.${method}`);
          return original(...args);
        };
      }
    }
  }
  document.addEventListener('securitypolicyviolation', (event) => {
    seen.push(`csp:${event.violatedDirective}:${event.blockedURI}`);
  });
};

/** Opens the built file with the spy; the returned list collects console errors and requests. */
export async function openApp(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.context().on('page', (popup) => problems.push(`popup: ${popup.url()}`));
  page.on('request', (request) => {
    if (!/^(file|data|blob):/.test(request.url())) problems.push(`request: ${request.url()}`);
  });
  await page.addInitScript(SPY);
  await page.goto(APP);
  return problems;
}

/**
 * Opens the built file at an https address (`path` on HOSTED) with the spy; every other address is
 * refused and listed. Returns the problems as openApp does, the refused addresses included.
 */
export async function openHosted(page: Page, path = '/'): Promise<string[]> {
  const problems: string[] = [];
  const html = readFileSync(BUILT);
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  await page.route('**/*', (route) => {
    const url = route.request().url().split('#')[0] ?? '';
    if (url === `${HOSTED}${path}`) {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    }
    if (!/^(data|blob):/.test(url)) problems.push(`request: ${url}`);
    return route.abort();
  });
  await page.addInitScript(SPY);
  await page.goto(`${HOSTED}${path}`);
  return problems;
}

/** Picks a file and waits until the result for exactly this file is shown. */
export async function upload(page: Page, name: string, bytes: Uint8Array, mimeType: string) {
  await page
    .getByTestId('file-input')
    .setInputFiles({ name, mimeType, buffer: Buffer.from(bytes) });
  await expect(
    page
      .getByText(`Geprüfte Datei: „${name}“`)
      .or(page.getByText(`Bei „${name}“ ist ein unerwarteter Fehler`)),
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * What the spy saw, plus what is left in the stores afterwards: named access such as
 * `localStorage.x = 1` passes no Storage method, so the stores themselves are checked as well.
 */
export async function sideEffects(page: Page): Promise<string[]> {
  return page.evaluate(async (access) => {
    // the confirmed access notice: reading and writing exactly its key (any folder) is allowed
    const own = (key: string) => key === access || key.startsWith(`${access}@/`);
    const seen = (window as unknown as { __sideEffects: string[] }).__sideEffects.filter(
      (entry) => {
        const match = /^storage\.(getItem|setItem):(.*)$/.exec(entry);
        return !(match?.[2] !== undefined && own(match[2]));
      },
    );
    const left = (name: string, count: () => number) => {
      try {
        if (count() > 0) seen.push(`left:${name}`);
      } catch {
        // a store the browser refuses here (file://) holds nothing
      }
    };
    left('localStorage', () => Object.keys(window.localStorage).filter((key) => !own(key)).length);
    left('sessionStorage', () => window.sessionStorage.length);
    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    left('cookie', () => String(cookie?.get?.call(document) ?? '').length);
    try {
      if (window.indexedDB?.databases && (await window.indexedDB.databases()).length > 0) {
        seen.push('left:indexedDB');
      }
    } catch {
      // not available here
    }
    try {
      if (window.caches && (await window.caches.keys()).length > 0) seen.push('left:caches');
    } catch {
      // not available here
    }
    return seen;
  }, ACCESS_STORAGE);
}
