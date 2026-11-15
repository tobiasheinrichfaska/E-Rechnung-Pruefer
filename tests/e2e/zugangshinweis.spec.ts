// The access notice before the hosted copy opens (Tobias 2026-11-15, as in the Fragebogen). Its text
// lives in the local Kanzlei configuration (src/build/kanzleiConfig.ts): with it the notice is
// tested, without it (the public repo alone) the tool must open at once — one of the two branches
// runs, the other is skipped with its reason. The spy allows exactly the access key and reports
// every other storage access (sideEffects).
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppConfig } from '../../src/build/kanzleiConfig';
import { accessToken } from '../../src/logic/accessGate';
import { ACCESS_STORAGE } from '../../src/logic/storageKeys';
import { miniPdf } from '../../src/build/minipdf';
import { openApp, openHosted, sideEffects } from './helpers';

const NOTICE = loadAppConfig().config.accessNotice;

const gate = (page: Page) => page.getByRole('heading', { name: 'Bitte bestätigen' });
const tool = (page: Page) => page.getByRole('button', { name: 'Datei auswählen' });
const next = (page: Page) => page.getByRole('button', { name: 'Weiter', exact: true });

test('the spy allows exactly the access key and still reports every other storage access', async ({
  page,
}) => {
  await openHosted(page);
  await page.evaluate((access) => {
    localStorage.setItem(access, 'x');
    localStorage.getItem(access);
    localStorage.setItem(`${access}@/test/`, 'x');
    localStorage.setItem('fremd', '1');
    localStorage.removeItem(access);
    localStorage.setItem(`${access}-anders`, '1');
  }, ACCESS_STORAGE);
  const seen = await sideEffects(page);
  expect(seen).toEqual([
    'storage.setItem:fremd',
    `storage.removeItem:${ACCESS_STORAGE}`,
    `storage.setItem:${ACCESS_STORAGE}-anders`,
    'left:localStorage',
  ]);
});

test.describe('with the notice of the local configuration', () => {
  test.skip(NOTICE === undefined, 'no access notice configured (public repo alone)');
  const notice = NOTICE ?? '';

  test('nothing of the tool before the notice is confirmed; „Weiter“ only with the tick', async ({
    page,
  }) => {
    const problems = await openHosted(page);
    await expect(gate(page)).toBeVisible();
    await expect(gate(page)).toBeFocused();
    await expect(page.locator('main')).toContainText(notice);
    await expect(tool(page)).toHaveCount(0);
    await expect(next(page)).toBeDisabled();
    await page.getByRole('checkbox', { name: notice }).check();
    await next(page).click();
    await expect(tool(page)).toBeVisible();
    expect(problems).toEqual([]);
    expect(await sideEffects(page)).toEqual([]);
  });

  test('asked again on the next visit unless „Antwort für die Zukunft merken“ was ticked', async ({
    page,
  }) => {
    await openHosted(page);
    await page.getByRole('checkbox', { name: notice }).check();
    await next(page).click();
    await page.reload();
    await expect(gate(page)).toBeVisible();

    await page.getByRole('checkbox', { name: notice }).check();
    await page.getByRole('checkbox', { name: 'Antwort für die Zukunft merken' }).check();
    await next(page).click();
    await page.reload();
    await expect(tool(page)).toBeVisible();
    await expect(gate(page)).toHaveCount(0);
    // kept in the browser as the fingerprint of the notice, never as a cookie (sideEffects reports
    // any cookie left, and any other key)
    expect(await page.evaluate((key) => localStorage.getItem(key), ACCESS_STORAGE)).toBe(
      accessToken(notice),
    );
    expect(await sideEffects(page)).toEqual([]);
  });

  test('a changed notice is asked again', async ({ page }) => {
    await openHosted(page);
    await page.evaluate(
      (key) => localStorage.setItem(key, 'fingerprint of an older text'),
      ACCESS_STORAGE,
    );
    await page.reload();
    await expect(gate(page)).toBeVisible();
  });

  test('the test copy in a folder keeps its own key', async ({ page }) => {
    await openHosted(page, '/NebenprojektERechnung/');
    await page.getByRole('checkbox', { name: notice }).check();
    await page.getByRole('checkbox', { name: 'Antwort für die Zukunft merken' }).check();
    await next(page).click();
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toEqual([`${ACCESS_STORAGE}@/NebenprojektERechnung/`]);
  });

  test('a file dropped while the notice is open is not checked and the page stays', async ({
    page,
  }) => {
    await openHosted(page);
    const bytes = [...miniPdf({ text: 'Rechnung' })];
    await page.evaluate((data) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(data)], 'r.pdf', { type: 'application/pdf' }));
      for (const type of ['dragover', 'drop']) {
        document.body.dispatchEvent(
          new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }),
        );
      }
    }, bytes);
    await expect(gate(page)).toBeVisible();
    await expect(page.getByText('Geprüfte Datei')).toHaveCount(0);
    expect(page.url()).toBe('https://e-rechnung.test/');
  });

  test('a downloaded copy (file://) does not ask and keeps nothing', async ({ page }) => {
    await openApp(page);
    await expect(tool(page)).toBeVisible();
    await expect(gate(page)).toHaveCount(0);
    expect(await sideEffects(page)).toEqual([]);
  });
});

test('without a configured notice the hosted copy opens at once and keeps nothing', async ({
  page,
}) => {
  test.skip(NOTICE !== undefined, 'an access notice is configured (local Kanzlei build)');
  await openHosted(page);
  await expect(tool(page)).toBeVisible();
  await expect(gate(page)).toHaveCount(0);
  expect(await sideEffects(page)).toEqual([]);
});
