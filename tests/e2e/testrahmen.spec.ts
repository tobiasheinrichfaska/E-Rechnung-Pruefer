// The test version (`npm run build:test`) shows the shared test frame of the repo Testumgebung
// (src/testrahmen/, a copy; its docs/testrahmen.md) beside the tool: the manual tests, the time
// measured by the page, results without free text, „Bericht senden“ to /_zugang/bericht, „App neu
// starten“ and „App vollständig zurücksetzen“. The frame itself is tested in Testumgebung; here what
// this tool gives it (src/logic/testBinding.ts, src/testArea.tsx) and that the live build has none
// of it and keeps connect-src 'none'.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAppConfig } from '../../src/build/kanzleiConfig';
import { ACCESS_STORAGE } from '../../src/logic/storageKeys';
import { TEXTS } from '../../src/logic/texts';
import { official } from '../support/fixtures';
import {
  BUILT,
  BUILT_TEST,
  FRAME_STORAGE,
  HOSTED,
  openApp,
  openHosted,
  sideEffects,
  TEST_VERSION_KEYS,
  upload,
} from './helpers';

const ROOT = join(import.meta.dirname, '..', '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
const REPORT = `${HOSTED}/_zugang/bericht`;

// The manual tests as the test version bundles them (manual_tests/0X_*.md)
const MANUAL = join(ROOT, 'manual_tests');
const manualTexts = readdirSync(MANUAL)
  .filter((name) => /^[0-9]{2}_.*\.md$/.test(name))
  .sort()
  .map((name) => readFileSync(join(MANUAL, name), 'utf8'));
const CASES = manualTexts.flatMap((text) =>
  [...text.matchAll(/^## (MT-\d{2,3}): (.+)$/gm)].map(([, id = '', title = '']) => ({ id, title })),
);
const IDS = CASES.map((c) => c.id);
// The first line of every numbered step, as written in the files
const STEP_LINES = manualTexts.flatMap((text) =>
  [...text.matchAll(/^\d+\. (.+)$/gm)].map(([, line = '']) => line),
);

const panel = (page: Page) => page.getByRole('complementary', { name: 'Testbereich' });
const tool = (page: Page) => page.locator('.tr-app');
const caseButton = (page: Page, id: string) =>
  panel(page).locator(`[data-aktion="oeffnen"][data-id="${id}"]`);

/** One of the frame's questions: „App neu starten“, „… zurücksetzen“ or „Bericht senden“. */
const asking = (page: Page, question: 'neustart' | 'zuruecksetzen' | 'senden') =>
  panel(page).locator(`[data-aktion="frage"][data-frage="${question}"]`);

async function answerYes(page: Page, question: 'neustart' | 'zuruecksetzen' | 'senden') {
  await asking(page, question).click();
  await expect(panel(page).getByRole('alertdialog')).toBeVisible();
  await panel(page).locator('[data-aktion="ja"]').click();
  await expect(panel(page).getByRole('alertdialog')).toHaveCount(0);
}

/** Answers the report address like the login script would; returns the bodies it received. */
async function receiver(page: Page, status: number, body: string): Promise<unknown[]> {
  const received: unknown[] = [];
  await page.route(REPORT, async (route) => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    expect(request.headers()['content-type']).toBe('application/json');
    received.push(request.postDataJSON());
    await route.fulfill({ status, contentType: 'text/plain; charset=utf-8', body });
  });
  return received;
}

/**
 * With a configured access notice (the private configuration) the hosted test version asks it
 * first; true when it did. `remember` ticks „Antwort für die Zukunft merken“.
 */
async function passNotice(page: Page, remember = false): Promise<boolean> {
  const notice = loadAppConfig().config.accessNotice;
  if (notice === undefined) return false;
  await page.getByRole('checkbox', { name: notice }).check();
  if (remember) await page.getByRole('checkbox', { name: TEXTS.accessRemember }).check();
  await page.getByRole('button', { name: TEXTS.accessContinue, exact: true }).click();
  return true;
}

/**
 * The tool remembers its access notice: confirmed and remembered where a notice is configured,
 * else written as the tool would (without a notice it never asks, so nothing would be kept).
 */
async function rememberAccess(page: Page) {
  if (!(await passNotice(page, true))) {
    await page.evaluate((key) => localStorage.setItem(key, 'gemerkt'), ACCESS_STORAGE);
  }
  expect(await stored(page, ACCESS_STORAGE)).not.toBeNull();
}

const stored = (page: Page, key: string) =>
  page.evaluate((name) => localStorage.getItem(name), key);

/** Marks the page, so a reload (which the frame does when the app gives no restart) shows. */
const markPage = (page: Page) =>
  page.evaluate(() => ((window as unknown as { __same: boolean }).__same = true));
const samePage = (page: Page) =>
  page.evaluate(() => (window as unknown as { __same?: boolean }).__same === true);

const invoice = () => official('kosit/01.01a-INVOICE_ubl.xml');

test('the live build carries nothing of the test frame and keeps connect-src none', async ({
  page,
}) => {
  const live = readFileSync(BUILT, 'utf8');
  const testVersion = readFileSync(BUILT_TEST, 'utf8');
  const frame = ['starteTestrahmen', 'tr-huelle', 'testrahmen:', 'Bericht senden', 'testbericht/1'];
  const texts = [...IDS, ...CASES.map((c) => c.title), ...STEP_LINES];
  expect(CASES.length).toBeGreaterThanOrEqual(5);
  for (const word of [...frame, ...texts]) expect(live, word).not.toContain(word);
  // the check means something: the test version carries the manual tests word for word
  for (const word of texts) expect(testVersion, word).toContain(word);
  expect(testVersion).toContain('tr-huelle');

  const problems = await openApp(page);
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("connect-src 'none'");
  expect(csp).not.toContain("connect-src 'self'");
  await expect(page.locator('#root')).toHaveCount(1);
  await expect(page.locator('[class^="tr-"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Datei auswählen' })).toBeVisible();
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('the test version lists the manual tests beside the working tool', async ({ page }) => {
  const problems = await openHosted(page, '/', BUILT_TEST);
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("connect-src 'self'");
  expect(csp).not.toContain("connect-src 'none'");
  // the tool lives in the frame's container, the live #root is gone
  await expect(page.locator('#root')).toHaveCount(0);
  await expect(panel(page)).toContainText(`E-Rechnung prüfen ${pkg.version}`);
  for (const { id, title } of CASES) {
    await expect(caseButton(page, id)).toBeVisible();
    await expect(caseButton(page, id)).toContainText(title);
  }
  await expect(panel(page)).toContainText(`0 von ${IDS.length} getestet`);
  // no problem with the binding (a wrong version or stand would be shown on top)
  await expect(panel(page).getByRole('alert')).toHaveCount(0);

  // the tool beside it works as in the live build
  await passNotice(page);
  await upload(page, 'x.xml', invoice(), 'application/xml');
  await expect(tool(page).getByTestId('headline')).toBeVisible();
  const [left, right] = [await tool(page).boundingBox(), await panel(page).boundingBox()];
  expect(left && right && left.x + left.width <= right.x + 1).toBe(true);

  // a test opened shows its numbered steps; nowhere a text field
  await caseButton(page, 'MT-02').click();
  await expect(panel(page).getByRole('heading', { name: /^MT-02 / })).toBeVisible();
  await panel(page).locator('[data-aktion="ergebnis"][data-wert="nicht bestanden"]').click();
  await expect(panel(page).locator('select[data-aktion="schritt"]')).toHaveCount(4);
  await expect(
    page.locator('textarea, input[type="text"], input:not([type]), [contenteditable]'),
  ).toHaveCount(0);
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
});

test('a sent report names the tool, its version and stand and every manual test', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-16T09:00:00') });
  const problems = await openHosted(page, '/', BUILT_TEST);
  const received = await receiver(page, 201, 'Bericht gespeichert.');

  // MT-03: open, 3 min 4 s, passed
  await caseButton(page, 'MT-03').click();
  await page.clock.runFor(184_000);
  await panel(page).locator('[data-aktion="ergebnis"][data-wert="bestanden"]').click();
  await expect(panel(page).locator('.tr-uhr')).toContainText('Gemessene Zeit');

  // MT-02: 95 s, failed in steps 4 and 2
  await panel(page).locator('[data-aktion="uebersicht"]').click();
  await caseButton(page, 'MT-02').click();
  await page.clock.runFor(95_000);
  await panel(page).locator('[data-aktion="ergebnis"][data-wert="nicht bestanden"]').click();
  await panel(page).locator('select[data-nr="4"]').selectOption('fehlermeldung');
  await panel(page).locator('select[data-nr="2"]').selectOption('darstellung');

  await answerYes(page, 'senden');
  await expect(panel(page).locator('.tr-kopf [role="status"]')).toHaveText('Bericht gespeichert.');
  expect(received).toHaveLength(1);
  const stand = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const report = received[0] as { tests: { id: string }[] };
  expect(report).toEqual({
    format: 'testbericht/1',
    app: 'erechnung',
    version: pkg.version,
    stand,
    tests: expect.any(Array) as unknown,
  });
  // every manual test once, in the order of the files; the untouched ones „nicht getestet“
  expect(report.tests.map((t) => t.id)).toEqual(IDS);
  expect([...IDS].sort()).toEqual(['MT-01', 'MT-02', 'MT-03', 'MT-04', 'MT-05']);
  for (const id of IDS.filter((id) => id !== 'MT-02' && id !== 'MT-03')) {
    expect(report.tests).toContainEqual({ id, ergebnis: 'nicht getestet' });
  }
  expect(report.tests).toContainEqual({ id: 'MT-03', ergebnis: 'bestanden', sekunden: 184 });
  expect(report.tests).toContainEqual({
    id: 'MT-02',
    ergebnis: 'nicht bestanden',
    sekunden: 95,
    schritte: [
      { nr: 2, grund: 'darstellung' },
      { nr: 4, grund: 'fehlermeldung' },
    ],
  });

  // what was sent does not go twice
  await answerYes(page, 'senden');
  await expect(panel(page).locator('.tr-kopf [role="status"]')).toContainText(
    'kein neues Ergebnis',
  );
  expect(received).toHaveLength(1);
  // the only request left the page for its own address
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
});

test('„App neu starten“ asks once and starts the tool afresh, keeping what it remembers', async ({
  page,
}) => {
  const problems = await openHosted(page, '/', BUILT_TEST);
  await rememberAccess(page);
  await upload(page, 'x.xml', invoice(), 'application/xml');
  await markPage(page);

  // „Abbrechen“ changes nothing
  await asking(page, 'neustart').click();
  await expect(panel(page).getByRole('alertdialog')).toContainText('App neu starten?');
  await panel(page).locator('[data-aktion="nein"]').click();
  await expect(tool(page).getByTestId('headline')).toBeVisible();

  await answerYes(page, 'neustart');
  // the start view again: no result, no notice (it is remembered), and no reload of the page
  await expect(tool(page).getByRole('button', { name: 'Datei auswählen' })).toBeVisible();
  await expect(tool(page).getByTestId('headline')).toHaveCount(0);
  await expect(tool(page).getByText('Geprüfte Datei: „x.xml“')).toHaveCount(0);
  expect(await samePage(page)).toBe(true);
  expect(await stored(page, ACCESS_STORAGE)).not.toBeNull();
  // the tool works after the restart
  await upload(page, 'y.xml', invoice(), 'application/xml');
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
});

test('„App vollständig zurücksetzen“ asks once, forgets the access notice and keeps the results', async ({
  page,
}) => {
  const problems = await openHosted(page, '/', BUILT_TEST);
  const notice = loadAppConfig().config.accessNotice !== undefined;
  await rememberAccess(page);
  await upload(page, 'x.xml', invoice(), 'application/xml');
  await caseButton(page, 'MT-01').click();
  await panel(page).locator('[data-aktion="ergebnis"][data-wert="bestanden"]').click();
  await markPage(page);

  // „Abbrechen“ changes nothing
  await asking(page, 'zuruecksetzen').click();
  await expect(panel(page).getByRole('alertdialog')).toContainText('App vollständig zurücksetzen?');
  await panel(page).locator('[data-aktion="nein"]').click();
  await expect(tool(page).getByTestId('headline')).toBeVisible();
  expect(await stored(page, ACCESS_STORAGE)).not.toBeNull();

  await answerYes(page, 'zuruecksetzen');
  // the tool's own key is gone, the frame's results stay
  await expect.poll(() => stored(page, ACCESS_STORAGE)).toBeNull();
  const kept = JSON.parse((await stored(page, FRAME_STORAGE)) ?? 'null') as {
    run: { entries: Record<string, { result?: string }> };
  };
  expect(kept.run.entries['MT-01']?.result).toBe('bestanden');
  await expect(panel(page)).toContainText(`1 von ${IDS.length} getestet · 1 bestanden`);
  // the tool starts afresh, without a reload: with a configured notice it asks again
  expect(await samePage(page)).toBe(true);
  await expect(tool(page).getByTestId('headline')).toHaveCount(0);
  if (notice) {
    await expect(tool(page).getByRole('heading', { name: TEXTS.accessTitle })).toBeVisible();
    await passNotice(page);
  }
  await expect(tool(page).getByRole('button', { name: 'Datei auswählen' })).toBeVisible();
  expect(problems).toEqual([]);
  // removing the access notice is allowed here, and only here
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toContain(
    `storage.removeItem:${ACCESS_STORAGE}`,
  );
  expect(await sideEffects(page, TEST_VERSION_KEYS, [ACCESS_STORAGE])).toEqual([]);
});

test('on a phone the tool and the test page are two tabs', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const problems = await openHosted(page, '/', BUILT_TEST);
  const tabs = page.locator('.tr-reiter');
  await expect(tabs).toBeVisible();
  // the tests first, the tool hidden
  await expect(tabs.locator('[data-wert="tests"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page)).toBeVisible();
  await expect(tool(page)).toBeHidden();

  await tabs.locator('[data-wert="app"]').click();
  await expect(tabs.locator('[data-wert="app"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page)).toBeHidden();
  await passNotice(page);
  await upload(page, 'eine-rechnung-mit-langem-namen-2026-11.xml', invoice(), 'application/xml');
  // the window no longer scrolls, the tool's container does: never sideways
  const sideways = (selector: string) =>
    page.locator(selector).evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(await sideways('.tr-app')).toBeLessThanOrEqual(0);
  expect(await sideways('html')).toBeLessThanOrEqual(0);

  await tabs.locator('[data-wert="tests"]').click();
  await expect(panel(page)).toBeVisible();
  await expect(tool(page)).toBeHidden();
  expect(await sideways('.tr-feld')).toBeLessThanOrEqual(0);
  // the result is still there behind the tab
  await tabs.locator('[data-wert="app"]').click();
  await expect(tool(page).getByTestId('headline')).toBeVisible();
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
});
