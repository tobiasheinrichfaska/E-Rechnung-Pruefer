// The test page of the test version (Kanzlei PC session, Tobias 2026-11-15; spec: repo
// Testumgebung, docs/testbericht.md): the manual tests beside the tool, the time measured by the
// page, results without free text, „Bericht senden“ to /_zugang/bericht. The live build has none of
// it and keeps connect-src 'none'.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loadAppConfig } from '../../src/build/kanzleiConfig';
import { BUILT, BUILT_TEST, HOSTED, openApp, openHosted, sideEffects } from './helpers';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const REPORT = `${HOSTED}/_zugang/bericht`;

/** Answers the report address like the login script would; returns the bodies it received. */
async function receiver(page: Page, status: number, body = ''): Promise<unknown[]> {
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

const panel = (page: Page) => page.getByRole('complementary', { name: 'Testbereich' });

/** With the private configuration the hosted test version asks the access notice first. */
async function passNotice(page: Page) {
  const notice = loadAppConfig().config.accessNotice;
  if (notice === undefined) return;
  await page.getByRole('checkbox', { name: notice }).check();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
}

test('the live build has no test page and no connection', async ({ page }) => {
  const live = readFileSync(BUILT, 'utf8');
  for (const word of ['Bericht senden', 'testbericht/1', 'Testanleitung', 'MT-01']) {
    expect(live, word).not.toContain(word);
  }
  const problems = await openApp(page);
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("connect-src 'none'");
  await expect(page.getByRole('button', { name: 'Bericht senden' })).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('the test version lists the manual tests beside the tool and may connect to itself', async ({
  page,
}) => {
  const problems = await openHosted(page, '/', BUILT_TEST);
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("connect-src 'self'");
  for (const id of ['MT-01', 'MT-02', 'MT-03', 'MT-04', 'MT-05']) {
    await expect(panel(page).getByRole('button', { name: new RegExp(`^${id}: `) })).toBeVisible();
  }
  // the tool beside it works as in the live build
  await passNotice(page);
  await expect(page.getByRole('button', { name: 'Datei auswählen' })).toBeVisible();
  await expect(panel(page)).toContainText('5 nicht getestet');
  // no text field anywhere on the page
  await expect(page.locator('textarea, input[type="text"], input:not([type])')).toHaveCount(0);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('measures the time, takes results without free text and sends the report', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-16T09:00:00') });
  const problems = await openHosted(page, '/', BUILT_TEST);
  const received = await receiver(page, 200, 'ok');

  // MT-03: open, 3 min 4 s, passed
  await panel(page)
    .getByRole('button', { name: /^MT-03: / })
    .click();
  await expect(panel(page).getByRole('heading', { name: /^MT-03: / })).toBeVisible();
  await page.clock.runFor(184_000);
  await expect(panel(page)).toContainText('Zeit: 3:04 (läuft)');
  await panel(page).getByRole('radio', { name: 'Bestanden', exact: true }).check();
  await expect(panel(page)).toContainText('Zeit: 3:04 (beendet)');
  await page.clock.runFor(60_000);
  await expect(panel(page)).toContainText('Zeit: 3:04 (beendet)');

  // MT-02: open, leave after 40 s, come back after a pause, fail with two steps
  await panel(page).getByRole('button', { name: '← Zurück zur Liste' }).click();
  await panel(page)
    .getByRole('button', { name: /^MT-02: / })
    .click();
  await page.clock.runFor(40_000);
  await panel(page).getByRole('button', { name: '← Zurück zur Liste' }).click();
  await page.clock.runFor(600_000);
  await panel(page)
    .getByRole('button', { name: /^MT-02: / })
    .click();
  await page.clock.runFor(55_000);
  await panel(page).getByRole('radio', { name: 'Nicht bestanden', exact: true }).check();
  await expect(panel(page)).toContainText('Zeit: 1:35 (beendet)');
  // a failed test needs a step: sending waits until one is chosen
  const send = panel(page).getByRole('button', { name: 'Bericht senden' });
  await expect(send).toBeDisabled();
  await expect(panel(page)).toContainText('MT-02: Bitte wählen Sie mindestens einen Schritt');
  await panel(page).getByRole('combobox', { name: 'Schritt 4' }).selectOption('fehlermeldung');
  await panel(page).getByRole('combobox', { name: 'Schritt 2' }).selectOption('Darstellung falsch');
  await expect(send).toBeEnabled();
  await panel(page).getByRole('button', { name: '← Zurück zur Liste' }).click();
  await expect(panel(page)).toContainText('1 bestanden · 1 nicht bestanden · 3 nicht getestet');

  await send.click();
  await expect(panel(page).getByRole('status')).toHaveText('Bericht gesendet.');
  expect(received).toHaveLength(1);
  const report = received[0] as { stand: string };
  expect(report.stand).toMatch(/^[0-9a-f]{7,40}$/);
  expect(report).toEqual({
    format: 'testbericht/1',
    app: 'erechnung',
    version: pkg.version,
    stand: report.stand,
    tests: [
      { id: 'MT-01', ergebnis: 'nicht getestet' },
      {
        id: 'MT-02',
        ergebnis: 'nicht bestanden',
        sekunden: 95,
        schritte: [
          { nr: 2, grund: 'darstellung' },
          { nr: 4, grund: 'fehlermeldung' },
        ],
      },
      { id: 'MT-03', ergebnis: 'bestanden', sekunden: 184 },
      { id: 'MT-04', ergebnis: 'nicht getestet' },
      { id: 'MT-05', ergebnis: 'nicht getestet' },
    ],
  });
  // the only request left the page for its own address
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('shows the refusal of the login script and the missing receiver', async ({ page }) => {
  await openHosted(page, '/', BUILT_TEST);
  await receiver(page, 400, 'Unbekanntes Feld: notiz');
  await panel(page)
    .getByRole('button', { name: /^MT-01: / })
    .click();
  await panel(page).getByRole('radio', { name: 'Bestanden', exact: true }).check();
  const send = panel(page).getByRole('button', { name: 'Bericht senden' });
  await send.click();
  await expect(panel(page).getByRole('status')).toHaveText(
    'Der Server hat den Bericht abgelehnt: Unbekanntes Feld: notiz',
  );
  // until Testumgebung has the receiving side, the address answers 404
  await page.unroute(REPORT);
  await receiver(page, 404, 'Not Found');
  await send.click();
  await expect(panel(page).getByRole('status')).toContainText(
    'Die Empfangsstelle für Berichte gibt es noch nicht (404).',
  );
});

test('on a phone the test page and the tool are two tabs', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await openHosted(page, '/', BUILT_TEST);
  await expect(panel(page)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeHidden();
  await page.getByRole('button', { name: 'Tool', exact: true }).click();
  await passNotice(page);
  await expect(page.getByRole('button', { name: 'Datei auswählen' })).toBeVisible();
  await expect(panel(page)).toBeHidden();
  await page.getByRole('button', { name: 'Testanleitung' }).click();
  await expect(panel(page)).toBeVisible();
  // no sideways scrolling
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
