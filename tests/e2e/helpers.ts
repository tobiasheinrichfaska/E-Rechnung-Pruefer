import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ACCESS_STORAGE } from '../../src/logic/storageKeys';
import { TEST_APP } from '../../src/logic/testBinding';
import { speicherSchluessel } from '../../src/testrahmen/testrahmen.js';

/** The tester's run, kept by the shared test frame of the test version: `testrahmen:erechnung`. */
export const FRAME_STORAGE = speicherSchluessel(TEST_APP);

/** The keys a test of the test version may allow: the access notice and the frame's run. */
export const TEST_VERSION_KEYS = [ACCESS_STORAGE, FRAME_STORAGE];

/** The live build (`npm run build`) and the test version for the test zone (`npm run build:test`). */
export const BUILT = join(import.meta.dirname, '..', '..', 'dist', 'index.html');
export const BUILT_TEST = join(import.meta.dirname, '..', '..', 'dist-test', 'index.html');

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
  // On the prototypes, not the instances: WebKit's page did not see a patched window.indexedDB or
  // cookieStore instance (found by the self-check in erkennen.spec.ts, audit 2026-11-15, QT-15)
  if (typeof IDBFactory !== 'undefined') {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (
      this: IDBFactory,
      ...args: Parameters<IDBFactory['open']>
    ) {
      seen.push('indexedDB.open');
      return open.apply(this, args);
    };
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
  const store = (w['CookieStore'] as { prototype: object } | undefined)?.prototype as
    Record<string, (...args: unknown[]) => unknown> | undefined;
  if (store) {
    for (const method of ['get', 'getAll', 'set', 'delete']) {
      const original = store[method];
      if (original) {
        store[method] = function (this: unknown, ...args: unknown[]) {
          seen.push(`cookieStore.${method}`);
          return original.apply(this, args);
        };
      }
    }
  }
  document.addEventListener('securitypolicyviolation', (event) => {
    seen.push(`csp:${event.violatedDirective}:${event.blockedURI}`);
  });
};

/**
 * Opens the built file (the live build unless `built` names another) with the spy; the returned list
 * collects console errors and requests.
 */
export async function openApp(page: Page, built = BUILT): Promise<string[]> {
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
  await page.goto(pathToFileURL(built).href);
  return problems;
}

/**
 * Opens the built file at an https address (`path` on HOSTED) with the spy; every other address is
 * refused and listed. Returns the problems as openApp does, the refused addresses included.
 */
export async function openHosted(page: Page, path = '/', built = BUILT): Promise<string[]> {
  const problems: string[] = [];
  const html = readFileSync(built);
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
 * Allowed are only the given keys — by default the confirmed access notice, and that only over
 * https: a downloaded copy (file://) neither reads nor keeps it (config/README.md; audit 2026-11-15,
 * QT-06). Tests of the test version also allow the frame's run (TEST_VERSION_KEYS). Removing a key
 * stays reported unless it is named in `removable` — only „App vollständig zurücksetzen“ of the test
 * version forgets the access notice; nothing ever removes the frame's run.
 */
export async function sideEffects(
  page: Page,
  allowed?: string[],
  removable: string[] = [],
): Promise<string[]> {
  return page.evaluate(
    async ({ given, access, gone }) => {
      const names = given ?? (location.protocol === 'https:' ? [access] : []);
      const ownTo = (list: string[]) => (key: string) =>
        list.some((name) => key === name || key.startsWith(`${name}@/`));
      const own = ownTo(names);
      const removable = ownTo(names.filter((name) => gone.includes(name)));
      const seen = (window as unknown as { __sideEffects: string[] }).__sideEffects.filter(
        (entry) => {
          const match = /^storage\.(getItem|setItem|removeItem):(.*)$/.exec(entry);
          if (match?.[2] === undefined) return true;
          return match[1] === 'removeItem' ? !removable(match[2]) : !own(match[2]);
        },
      );
      const left = (name: string, count: () => number) => {
        try {
          if (count() > 0) seen.push(`left:${name}`);
        } catch {
          // a store the browser refuses here (file://) holds nothing
        }
      };
      left(
        'localStorage',
        () => Object.keys(window.localStorage).filter((key) => !own(key)).length,
      );
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
    },
    { given: allowed, access: ACCESS_STORAGE, gone: removable },
  );
}

/**
 * Codes (BT-112, BG-23, BR-S-08, BR-FXEXT-CO-10), rates („19 %“) and „Rn. 6a“ inside `root` that the
 * browser broke across two lines: each match some of whose characters stand below its first
 * (audit R3-U-10; closed <details> are opened for the count and closed again).
 */
export async function brokenCodes(page: Page, root = 'main'): Promise<string[]> {
  return page.evaluate((selector) => {
    const closed = [...document.querySelectorAll('details')].filter((details) => !details.open);
    for (const details of closed) details.open = true;
    const found = new Set<string>();
    const pattern = /\bB[GTR]-[A-Z0-9]+(?:-[A-Z0-9]+)*|\d+(?:,\d+)?\s%|Rn\.\s\d+[a-z]?/g;
    const topOf = (node: Text, at: number) => {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + 1);
      const rect = [...range.getClientRects()].find((r) => r.width > 0);
      return rect ? Math.round(rect.top) : undefined;
    };
    for (const element of document.querySelectorAll(selector)) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text;
        for (const match of text.data.matchAll(pattern)) {
          const first = topOf(text, match.index);
          if (first === undefined) continue;
          for (let i = 1; i < match[0].length; i += 1) {
            const top = topOf(text, match.index + i);
            if (top !== undefined && top > first + 2) {
              found.add(match[0]);
              break;
            }
          }
        }
      }
    }
    for (const details of closed) details.open = false;
    return [...found];
  }, root);
}
