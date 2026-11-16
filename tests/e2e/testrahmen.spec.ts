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
import { ACCESS_STORAGE } from '../../src/logic/storageKeys';
import { TEXTS } from '../../src/logic/texts';
import { official } from '../support/fixtures';
import {
  brokenCodes,
  BUILT,
  BUILT_TEST,
  configuredNotice,
  FRAME_STORAGE,
  HOSTED,
  openApp,
  openHosted,
  passNotice,
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
/**
 * The frame's one live region (Testumgebung 0a99ee8): it stays on the page while the panel is drawn
 * anew, so a screen reader hears each message once (audit R3-U-13).
 */
const announcer = (page: Page) => page.locator('.tr-huelle > .tr-ansage[role="status"]');
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

// The tester sample with the tallest rows of the Pflichtangaben (audit R2-U-01)
const SAMPLE_07 = '07_Anschriften_ohne_Strasse_Fiskalvertreter_unvollstaendig.xml';
const sample07 = () => new Uint8Array(readFileSync(join(ROOT, 'beispiele', SAMPLE_07)));

/** Where the manual tests send the testers for the samples (the public folder, audit R2-U-03). */
const SAMPLES_PAGE =
  'https://github.com/tobiasheinrichfaska/E-Rechnung-Pruefer/tree/main/beispiele';

/**
 * Drags a file over the element and drops it there, as the browser delivers it. `opened`: the
 * browser would open the file itself; `taken`: the tool started to check it.
 */
const dropOn = (page: Page, selector: string, name: string) =>
  page.evaluate(
    async ([target, fileName, text]) => {
      const element = document.querySelector(target);
      if (!element) throw new Error(`nothing at ${target}`);
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], fileName, { type: 'application/xml' }));
      let drop: DragEvent | undefined;
      for (const type of ['dragenter', 'dragover', 'drop']) {
        const event = new DragEvent(type, {
          dataTransfer: transfer,
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(event);
        drop = event;
      }
      // a check starts at once: „„…“ wird geprüft …“, then the result
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        opened: drop?.defaultPrevented !== true,
        taken: document.querySelector('.tr-app')?.textContent?.includes(fileName) ?? false,
      };
    },
    [selector, name, new TextDecoder().decode(invoice())] as const,
  );

test('the live build carries nothing of the test frame and keeps connect-src none', async ({
  page,
}) => {
  const live = readFileSync(BUILT, 'utf8');
  const testVersion = readFileSync(BUILT_TEST, 'utf8');
  // the frame, and the tool's own style beside it (src/testArea.css, a container query). Only words
  // the bundle keeps: the minifier renames the frame's exports, so a name like starteTestrahmen
  // stood in neither build and could never fire (audit R3-S-05)
  const frame = ['tr-huelle', 'testrahmen:', 'Bericht senden', 'testbericht/1', '@container'];
  const texts = [...IDS, ...CASES.map((c) => c.title), ...STEP_LINES];
  expect(CASES.length).toBeGreaterThanOrEqual(5);
  for (const word of [...frame, ...texts]) expect(live, word).not.toContain(word);
  // the check means something: the test version carries every marker and the manual tests word
  // for word
  for (const word of [...frame, ...texts]) expect(testVersion, word).toContain(word);

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

// The branches with a notice run on GitHub only in the step that names the invented Beispielkanzlei
// (tests.yml, audit R4-T-01): a file named there without a notice must stop the run, never skip them.
test('a run with KANZLEI_CONFIG stops at a file without an access notice instead of skipping its branches', () => {
  expect(() => configuredNotice({ KANZLEI_CONFIG: 'config/kanzlei.example.json' })).toThrow(
    'names config/kanzlei.example.json, which has no access notice',
  );
  expect(
    configuredNotice({ KANZLEI_CONFIG: 'tests/fixtures/config/beispiel-kanzlei.json' }),
  ).toBeDefined();
  // without the variable the private configuration or none: no notice is a branch then
  expect(() => configuredNotice({})).not.toThrow();
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
  // no problem with the binding (a wrong version or stand would be shown on top, and said once
  // through the frame's live region)
  await expect(panel(page).locator('.tr-kopf .tr-meldung')).toHaveCount(0);

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
  await expect(panel(page).locator('.tr-kopf [data-meldung]')).toHaveText('Bericht gespeichert.');
  // and said through the one live region of the frame (Testumgebung 0a99ee8, audit R3-U-13)
  await expect(announcer(page)).toHaveText('Bericht gespeichert.');
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
  await expect(panel(page).locator('.tr-kopf [data-meldung]')).toContainText('kein neues Ergebnis');
  await expect(announcer(page)).toContainText('kein neues Ergebnis');
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
  const notice = configuredNotice() !== undefined;
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

// MT-02 has the tool in half of a 1920 screen. From 900 px the frame puts the test page (320–440 px)
// beside the tool, which leaves it 460–640 px: there its phone layout follows its own width, not the
// window's (src/testArea.css; audit R2-U-01). Before, the values column shrank to 105 px, words broke
// inside („Rechnungsem|pfängers“) and a row grew to 584 px.
test('beside the test page the tool stacks each Pflichtangabe by its own width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 800 });
  const problems = await openHosted(page, '/', BUILT_TEST);
  // side by side: the test page shown, no tabs
  await expect(panel(page)).toBeVisible();
  await expect(page.locator('.tr-reiter')).toBeHidden();
  await passNotice(page);
  await upload(page, SAMPLE_07, sample07(), 'application/xml');
  await expect(tool(page).getByTestId('pflicht-summary')).toBeVisible();
  const area = await tool(page).boundingBox();
  expect(area && area.width < 641).toBe(true);

  // as on a phone (handy.spec.ts): label and status on one line, the values below and wider
  const cells = tool(page).getByTestId('pflicht-name-leistender').locator('th, td');
  const box = async (i: number) => {
    const found = await cells.nth(i).boundingBox();
    if (!found) throw new Error(`cell ${i} has no box`);
    return found;
  };
  const [label, values, status] = [await box(0), await box(1), await box(2)];
  expect(Math.abs(status.y - label.y)).toBeLessThan(2);
  expect(status.x).toBeGreaterThan(label.x + label.width - 1);
  expect(values.y).toBeGreaterThanOrEqual(label.y + label.height - 1);
  expect(values.width).toBeGreaterThan(label.width);

  // every shown row: a wide values column and no tall row; nothing sideways
  const rows = await tool(page)
    .locator('.pflicht-table tbody tr')
    .evaluateAll((list) =>
      list
        .map((row) => ({
          height: row.getBoundingClientRect().height,
          values: row.children[1]?.getBoundingClientRect().width ?? 0,
        }))
        .filter((row) => row.height > 0),
    );
  expect(rows.length).toBeGreaterThan(10);
  expect(Math.min(...rows.map((row) => row.values))).toBeGreaterThan(400);
  expect(Math.max(...rows.map((row) => row.height))).toBeLessThan(300);
  const sideways = (selector: string) =>
    page.locator(selector).evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(await sideways('.tr-app')).toBeLessThanOrEqual(0);
  expect(await sideways('html')).toBeLessThanOrEqual(0);
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
});

// Beside the test page the tool is narrow even in a wide window: „Gesamtbetrag mit Umsatzsteuer
// (BT-“ / „112)“ broke in the table „Rechnungsdaten“ at 1280 px (audit R3-U-10).
test('beside the test page the tool keeps codes and rates on one line', async ({ page }) => {
  const problems = await openHosted(page, '/', BUILT_TEST);
  await passNotice(page);
  const sample29 = new Uint8Array(
    readFileSync(join(ROOT, 'beispiele', '29_XRechnung_mit_Formatfehler.xml')),
  );
  const broken: string[] = [];
  for (const width of [1280, 960]) {
    await page.setViewportSize({ width, height: 800 });
    for (const [name, bytes] of [
      [SAMPLE_07, sample07()],
      ['29.xml', sample29],
    ] as const) {
      await upload(page, name, bytes, 'application/xml');
      broken.push(
        ...(await brokenCodes(page, '.tr-app')).map((code) => `${width}, ${name}: ${code}`),
      );
    }
  }
  expect(broken).toEqual([]);
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
});

// Printing the test version prints the tool and its result as the live build does, upright and
// across; the test page and the tabs stay off the paper (audit R2-U-02). Before, the upright page
// (below 900 px) took the frame's tabs with „Tests“ chosen from the start and printed only the test
// page; across, the result ran beside an empty column. The frame's own print rules (Testumgebung
// 2645a15) do this.
test('prints the tool with its result, never the test page', async ({ page }) => {
  const problems = await openHosted(page, '/', BUILT_TEST);
  await passNotice(page);
  await caseButton(page, 'MT-04').click();
  await upload(page, SAMPLE_07, sample07(), 'application/xml');
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  // A4 upright and across with 10 mm margins, in CSS pixels
  for (const width of [718, 1047]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(panel(page)).toBeHidden();
    await expect(page.locator('.tr-reiter')).toBeHidden();
    await expect(tool(page).getByTestId('headline')).toBeVisible();
    await expect(tool(page).getByTestId('pflicht-summary')).toBeVisible();
    await expect(tool(page).getByRole('heading', { name: 'Rechnerische Prüfung' })).toBeVisible();
    // the whole width and the whole length: no empty column beside it, nothing cut off inside
    const area = await tool(page).boundingBox();
    expect(area?.x).toBe(0);
    expect(area && area.width > width - 2).toBe(true);
    expect(area && area.height > 1000).toBe(true);
    expect(await tool(page).evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(
      0,
    );
  }
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: /^MT-04 / })).toBeVisible();
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
});

// The tool takes a file dropped anywhere on its page (U-05). In the test version a file dropped on
// the test page or the tabs is refused instead (src/testArea.tsx; audit R2-U-05): below 900 px the
// tool behind the tab „Tests“ would check it unseen and say nothing, and the tester would note
// „Passiert nichts“.
test('a file dropped on the test page is refused, not checked by the tool behind it', async ({
  page,
}) => {
  const problems = await openHosted(page, '/', BUILT_TEST);
  await passNotice(page);
  // the tool's start view and the test page beside it
  await expect(tool(page).getByRole('button', { name: 'Datei auswählen' })).toBeVisible();
  await expect(panel(page)).toBeVisible();
  // beside the tool: the test page takes no file, and the browser does not open it either
  expect(await dropOn(page, '.tr-feld .tr-kopf', 'auf-testseite.xml')).toEqual({
    opened: false,
    taken: false,
  });
  await expect(tool(page).getByTestId('headline')).toHaveCount(0);
  // anywhere in the tool a file is still taken, also next to the drop zone
  expect(await dropOn(page, '.tr-app h1', 'im-tool.xml')).toEqual({ opened: false, taken: true });
  await expect(tool(page).getByText(/^Geprüfte Datei: „im-tool\.xml“/)).toBeVisible();

  // below 900 px the tool hides behind the tab „Tests“: nothing is checked there unseen
  await page.setViewportSize({ width: 600, height: 800 });
  await expect(tool(page)).toBeHidden();
  for (const target of ['.tr-feld .tr-kopf', '.tr-reiter']) {
    expect(await dropOn(page, target, 'hinter-dem-reiter.xml'), target).toEqual({
      opened: false,
      taken: false,
    });
  }
  await page.locator('.tr-reiter [data-wert="app"]').click();
  await expect(tool(page).getByText(/^Geprüfte Datei: „im-tool\.xml“/)).toBeVisible();
  // the tool shown: a file dropped on it is taken again
  expect(await dropOn(page, '.tr-app h1', 'danach.xml')).toEqual({ opened: false, taken: true });
  await expect(tool(page).getByText(/^Geprüfte Datei: „danach\.xml“/)).toBeVisible();
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
});

// The test page shows only the manual tests, not their README: the samples' address stands in the
// tests themselves, as a link the frame keeps (audit R2-U-03), and the steps name what the tester
// sees in the test version (R2-U-04, R2-U-07).
test('the manual tests link the samples and name what the test version shows', async ({ page }) => {
  const problems = await openHosted(page, '/', BUILT_TEST);
  const opened = async (id: string) => {
    await panel(page).locator('[data-aktion="uebersicht"]').click();
    await caseButton(page, id).click();
    await expect(panel(page).getByRole('heading', { name: new RegExp(`^${id} `) })).toBeVisible();
  };
  // the first time, the list is shown already
  await caseButton(page, 'MT-02').click();
  for (const id of ['MT-02', 'MT-03', 'MT-04']) {
    if (id !== 'MT-02') await opened(id);
    const link = panel(page).locator(`a[href="${SAMPLES_PAGE}"]`);
    await expect(link, id).toHaveCount(1);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(panel(page), id).not.toContainText('README');
  }
  // MT-03, step 1: on a narrow screen the frame opens on its tab „Tests“, the tool is behind „App“
  await opened('MT-03');
  const tabs = page.locator('.tr-reiter button');
  await expect(tabs).toHaveText(['App', 'Tests']);
  await expect(
    panel(page).locator('li').filter({ hasText: 'Öffnen Sie die Adresse' }),
  ).toContainText('Reiter App');
  // MT-04: after the first result the drop zone is „Andere Datei prüfen“; the fold-outs carry the
  // word of their badges
  await opened('MT-04');
  await expect(panel(page)).toContainText(`„${TEXTS.dropTitle}“`);
  await expect(panel(page)).toContainText(`„${TEXTS.anotherFile}“`);
  await expect(panel(page)).toContainText(`„${TEXTS.statusEinzelfall}“`);
  // and the closed parts that hold the descriptions of the rules (audit R3-U-11)
  await expect(panel(page)).toContainText(`„${TEXTS.rulesShowAll}“`);
  await expect(panel(page)).toContainText(`„${TEXTS.rulesShowOthers}“`);
  await expect(panel(page)).toContainText(`„${TEXTS.technicalDetails}“`);
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
});

// The manual tests in the order of their ids: MT-05 stood in 02_geraete.md, so the list ran MT-01,
// MT-02, MT-03, MT-05, MT-04 and „Nächster ›“ went from MT-05 back to MT-04 (audit R3-U-11). And no
// step asks the tester to note something down: the page has no text field and does not show the
// README that said what to do instead (R3-U-01). Each step names a reason of the page's own list.
test('lists the manual tests in order; each step names a reason the page offers', async ({
  page,
}) => {
  const problems = await openHosted(page, '/', BUILT_TEST);
  // the frame draws its list after the start; read it only once every test is there (Firefox read
  // it too early once, an empty list)
  await expect(panel(page).locator('button.tr-test')).toHaveCount(IDS.length);
  const listed = await panel(page)
    .locator('button.tr-test')
    .evaluateAll((list) => list.map((button) => (button as HTMLElement).dataset['id']));
  expect(listed).toEqual(['MT-01', 'MT-02', 'MT-03', 'MT-04', 'MT-05']);

  // the reasons a failed step can get
  await caseButton(page, 'MT-04').click();
  await panel(page).locator('[data-aktion="ergebnis"][data-wert="nicht bestanden"]').click();
  const offered = await panel(page)
    .locator('select[data-aktion="schritt"]')
    .first()
    .locator('option')
    .allTextContents();
  // from MT-04 the next test is MT-05
  await panel(page).locator('[data-fokus="naechster"]').click();
  await expect(panel(page).getByRole('heading', { name: /^MT-05 / })).toBeVisible();

  let named = 0;
  for (const id of IDS) {
    await panel(page).locator('[data-aktion="uebersicht"]').click();
    await caseButton(page, id).click();
    await expect(panel(page).getByRole('heading', { name: new RegExp(`^${id} `) })).toBeVisible();
    const text = (await panel(page).textContent()) ?? '';
    expect(text, id).not.toMatch(/notier/i);
    expect(text, id).toContain('sagen Sie Tobias direkt');
    for (const [, reason = ''] of text.matchAll(/dem Grund „([^“]+)“/g)) {
      expect(offered, `${id}: „${reason}“`).toContain(reason);
      named += 1;
    }
  }
  expect(named).toBeGreaterThanOrEqual(IDS.length);
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
});

// With blocked site data (the getter of localStorage throws) the frame says once that it keeps
// nothing. Before Testumgebung 0a99ee8 that notice stood as role="alert" in the panel, which the
// frame draws anew on every change: a screen reader heard it again on opening a test, going back or
// hiding the done ones (audit R3-U-13). Now the panel carries no live role, and the frame's one
// live region says the notice once.
test('with blocked storage the frame says once that it keeps nothing, not on every change', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Die Website-Daten sind gesperrt.', 'SecurityError');
      },
    });
    // every alert put on the page, also inside an inserted subtree
    const w = window as unknown as { __alerts: number };
    w.__alerts = 0;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          w.__alerts +=
            (node.matches('[role="alert"]') ? 1 : 0) +
            node.querySelectorAll('[role="alert"]').length;
        }
      }
    }).observe(document, { subtree: true, childList: true });
  });
  const problems = await openHosted(page, '/', BUILT_TEST);
  const unsaved = panel(page)
    .locator('.tr-kopf .tr-meldung')
    .filter({ hasText: 'speichert die Ergebnisse nicht' });
  await expect(unsaved).toHaveCount(1);
  await expect(announcer(page)).toHaveAttribute('aria-live', 'polite');
  await expect(announcer(page)).toContainText('speichert die Ergebnisse nicht');

  // a test opened, back to the list, the done ones hidden and shown: the panel is drawn anew
  await caseButton(page, 'MT-02').click();
  await expect(panel(page).getByRole('heading', { name: /^MT-02 / })).toBeVisible();
  await panel(page).locator('[data-aktion="uebersicht"]').click();
  await panel(page).locator('[data-aktion="erledigte"]').check();
  await panel(page).locator('[data-aktion="erledigte"]').uncheck();
  await expect(unsaved).toHaveCount(1);
  // nothing in the panel speaks by itself, and no alert was put on the page at any time
  await expect(panel(page).locator('[role="alert"], [role="status"], [aria-live]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __alerts: number }).__alerts)).toBe(0);
  await expect(announcer(page)).toContainText('speichert die Ergebnisse nicht');
  // beside it the tool's access notice offers no answer to remember either (audit R3-U-12)
  if (configuredNotice() !== undefined) {
    await expect(tool(page).getByTestId('cannot-remember')).toBeVisible();
    await expect(tool(page).getByRole('checkbox', { name: TEXTS.accessRemember })).toHaveCount(0);
  }
  expect(problems).toEqual([]);
});
