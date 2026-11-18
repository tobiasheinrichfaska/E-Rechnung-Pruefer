import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAppConfig } from '../../src/build/kanzleiConfig';
import { miniPdf } from '../../src/build/minipdf';
import { TEXTS } from '../../src/logic/texts';
import { encode, official, officialText, withInvoiceNumber } from '../support/fixtures';
import {
  brokenCodes,
  BUILT_TEST,
  openApp,
  openHosted,
  sideEffects,
  TEST_VERSION_KEYS,
  upload,
} from './helpers';

// Phone width (small iPhone). app.css stacks each Pflichtangabe below 640px: label and status on
// the first line, the values below across the full width – and nothing may scroll sideways.
test.use({ viewport: { width: 375, height: 800 } });

test('fits a phone screen: no sideways scrolling, values below label and status', async ({
  page,
}) => {
  const problems = await openApp(page);
  await upload(
    page,
    'luecken.xml',
    official('kosit/paare/01.14a-INVOICE_ubl.xml'),
    'application/xml',
  );
  await expect(page.getByTestId('pflicht-summary')).toBeVisible();

  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBeLessThanOrEqual(0);

  const cells = page.getByTestId('pflicht-name-leistender').locator('th, td');
  const box = async (i: number) => {
    const found = await cells.nth(i).boundingBox();
    if (!found) throw new Error(`cell ${i} has no box`);
    return found;
  };
  const label = await box(0);
  const values = await box(1);
  const status = await box(2);
  expect(Math.abs(status.y - label.y)).toBeLessThan(2);
  expect(status.x).toBeGreaterThan(label.x + label.width - 1);
  expect(values.y).toBeGreaterThanOrEqual(label.y + label.height - 1);
  expect(values.width).toBeGreaterThan(label.width);

  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// A small Android phone (320 px) and a supplier file name with underscores only: before the audit
// 2026-11-14 the rows "nur im Einzelfall nötig" overflowed by up to 57 px and such a name by 185 px.
test('fits a small phone with a long file name', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const problems = await openApp(page);
  const name = 'Rechnung_2026-11-14_Mustermann_Lieferant_GmbH_Nummer_1234567890123456789.xml';
  await upload(page, name, official('kosit/paare/01.14a-INVOICE_ubl.xml'), 'application/xml');
  await expect(page.getByTestId('pflicht-summary')).toBeVisible();
  await page
    .getByText(/^Positionen \(\d+\)$/)
    .first()
    .click();

  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBeLessThanOrEqual(0);

  // The badge "nur im Einzelfall nötig" wraps instead of taking ~150 px: the label kept only 98 px
  // and broke inside words ("Vereinnahm/ung", audit Bedienung Z-01/A-05)
  // the folded rows "nur im Einzelfall nötig" (G-1) are the ones that broke inside words: open them
  await page.evaluate(() => {
    for (const details of document.querySelectorAll('details')) details.open = true;
  });
  expect(await page.locator('.pflicht-table tbody th').count()).toBeGreaterThan(20);
  const narrowest = await page
    .locator('.pflicht-table tbody th')
    .evaluateAll((cells) => Math.min(...cells.map((cell) => cell.getBoundingClientRect().width)));
  expect(narrowest).toBeGreaterThan(150);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// Two invoice XML with different data (F27): on a phone the comparison table becomes blocks, and its
// column headers with the attachment names stood once on top. Below each Angabe the values followed
// one another without a name, so which value came from which attachment was left to their order
// (audit R3-U-06). Now each value names its attachment there, for the eye only.
test('names the attachment of each compared value on a phone', async ({ page }) => {
  const problems = await openApp(page);
  const cii = officialText('cen/CII_example1.xml');
  const xml = (name: string, data: string) => ({ name, bytes: encode(data), mime: 'text/xml' });
  await upload(
    page,
    'zwei.pdf',
    miniPdf({
      attachments: [xml('erste.xml', cii), xml('zweite.xml', withInvoiceNumber(cii, 'X-2'))],
    }),
    'application/pdf',
  );
  const comparison = page.getByRole('table', { name: 'Vergleich der Rechnungsdaten' });
  const cells = comparison.locator('.differs td');
  await expect(cells).toHaveCount(2);
  await expect(cells.nth(0)).toHaveText(/^erste\.xml: \S/, { useInnerText: true });
  await expect(cells.nth(1)).toHaveText('zweite.xml: X-2', { useInnerText: true });
  // every value of the table, not only the differing one
  const items = await comparison.locator('tbody').count();
  await expect(comparison.locator('tbody .part-name:visible')).toHaveCount(items * 2);
  // the names on top are out of sight, but screen readers keep the column headers and skip the
  // names in the cells
  expect((await comparison.locator('thead').boundingBox())?.height ?? 0).toBeLessThanOrEqual(1);
  await expect(comparison.getByRole('columnheader', { name: 'zweite.xml' })).toHaveCount(1);
  await expect(comparison.locator('.part-name').first()).toHaveAttribute('aria-hidden', 'true');
  // there the pairing hangs on `headers` alone: the Angabe of its own row group, then the column
  // header that names its attachment, each id once in the page (audit R5-T-04)
  const pairing = await comparison.locator('td').evaluateAll((all) =>
    all.flatMap((cell) => {
      const ids = (cell.getAttribute('headers') ?? '').split(' ');
      const [angabe, teil] = ids.map((id) => document.querySelectorAll(`[id="${id}"]`));
      const column = (cell as HTMLTableCellElement).cellIndex;
      const fault = [
        ids.length !== 2 && 'not two ids',
        angabe?.length !== 1 && 'Angabe not once',
        teil?.length !== 1 && 'attachment not once',
        !(
          angabe?.[0]?.matches('th[scope="rowgroup"]') &&
          angabe[0].closest('tbody') === cell.closest('tbody')
        ) && 'not the header of its row group',
        !(
          teil?.[0]?.matches('thead th[scope="col"]') &&
          (teil[0] as HTMLTableCellElement).cellIndex === column &&
          (cell.querySelector('.part-name')?.textContent ?? '').startsWith(
            teil[0].textContent ?? '?',
          )
        ) && 'not the header of its attachment',
      ].filter(Boolean);
      return fault.length > 0 ? [`${cell.getAttribute('headers')}: ${fault.join(', ')}`] : [];
    }),
  );
  expect(pairing).toEqual([]);
  expect(await comparison.locator('td').count()).toBe(items * 2);
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBeLessThanOrEqual(0);

  // a wide window keeps the table with its column headers and no name in the cells
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(comparison.locator('.part-name:visible')).toHaveCount(0);
  await expect(cells.nth(1)).toHaveText('X-2', { useInnerText: true });
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// A code broke after its hyphen („BT-“ / „112“, „BR-S-“ / „08“) and a rate or a margin number at its
// space („19“ / „%“, „Rn.“ / „6a“): measured over the lines of every match on wide and narrow
// screens (audit R3-U-10). Now the codes stand in spans that do not wrap, and „%“ and „Rn.“ have a
// no-break space before their number.
test('keeps codes, rates and margin numbers on one line, also on a phone', async ({ page }) => {
  const problems = await openApp(page);
  const sample = (name: string) =>
    new Uint8Array(readFileSync(join(import.meta.dirname, '../../beispiele', name)));
  const cii = officialText('cen/CII_example1.xml');
  const xml = (name: string, data: string) => ({ name, bytes: encode(data), mime: 'text/xml' });
  const files = [
    {
      name: '07.xml',
      bytes: sample('07_Anschriften_ohne_Strasse_Fiskalvertreter_unvollstaendig.xml'),
      mime: 'application/xml',
    },
    { name: '29.xml', bytes: sample('29_XRechnung_mit_Formatfehler.xml'), mime: 'application/xml' },
    { name: '30.xml', bytes: sample('30_XRechnung_mit_Rechenfehler.xml'), mime: 'application/xml' },
    {
      name: 'zwei.pdf',
      bytes: miniPdf({
        attachments: [xml('a.xml', cii), xml('b.xml', withInvoiceNumber(cii, 'X-2'))],
      }),
      mime: 'application/pdf',
    },
  ];
  const broken: string[] = [];
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const file of files) {
      await upload(page, file.name, file.bytes, file.mime);
      broken.push(...(await brokenCodes(page)).map((code) => `${width} px, ${file.name}: ${code}`));
    }
  }
  expect(broken).toEqual([]);
  // the codes stay what they are: the browser's search for „BT-112“ finds them
  await expect(page.getByText('BT-112').first()).toBeVisible();
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

/**
 * The words of the comparison table broken inside a word, apart from the attachment names and the
 * identifier of the specification (BT-24), which have no break opportunity and must break.
 */
function brokenWords(page: Page, root = 'main'): Promise<string[]> {
  return page.evaluate((selector) => {
    const found = new Set<string>();
    for (const row of document.querySelectorAll(`${selector} .comparison tbody`)) {
      if (row.querySelector('th')?.textContent?.includes('(BT-24)')) continue;
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text;
        if (text.parentElement?.closest('.part-name')) continue;
        for (const match of text.data.matchAll(/\p{L}{4,}/gu)) {
          const tops: number[] = [];
          for (let i = 0; i < match[0].length; i += 1) {
            const range = document.createRange();
            range.setStart(text, match.index + i);
            range.setEnd(text, match.index + i + 1);
            const rect = [...range.getClientRects()].find((r) => r.width > 0);
            if (rect) tops.push(Math.round(rect.top));
          }
          if (tops.length > 0 && Math.max(...tops) > Math.min(...tops) + 2) found.add(match[0]);
        }
      }
    }
    return [...found];
  }, root);
}

/** Two invoice XML that differ only in one VAT rate (7 → 19), under the given attachment names. */
function ratePair(names: readonly [string, string]): Uint8Array {
  const cii = officialText('kosit/paare/01.01a-INVOICE_uncefact.xml');
  const rate19 = cii.replace(
    /(<ram:BasisAmount>314\.86<\/ram:BasisAmount>\s*<ram:CategoryCode>S<\/ram:CategoryCode>\s*<ram:RateApplicablePercent>)7(<\/ram:RateApplicablePercent>)/,
    '$119$2',
  );
  if (rate19 === cii) throw new Error('no rate to change');
  const xml = (name: string, data: string) => ({ name, bytes: encode(data), mime: 'text/xml' });
  return miniPdf({
    attachments: [xml(names[0], cii), xml(names[1], rate19)],
  });
}

/** Attachment names without a break opportunity, longer than their column */
const LONG_NAMES = [
  'Rechnung_2026_000123_Lieferant_Mustermann_factur-x.xml',
  'Rechnungsdaten_zweite_Fassung_derselben_Rechnung.xml',
] as const;

// Two XML with another VAT rate (audit R4-L-02, R4-U-03): „7“ / „%“ broke in the line
// „Unterschiedlich“ and the table, collapsing the whitespace had taken the no-break space; the
// automatic table layout squeezed the columns until „Umsatzsteuerkategorie“ broke inside on a tablet
// and on paper, and long attachment names without a break opportunity pushed the page sideways.
test('keeps rates, words and the page width in the comparison of another rate', async ({
  page,
}) => {
  const problems = await openApp(page);
  const broken: string[] = [];
  const sideways: string[] = [];
  const measure = async (at: string) => {
    broken.push(...(await brokenCodes(page)).map((code) => `${at}: ${code}`));
    broken.push(...(await brokenWords(page)).map((word) => `${at}: ${word}`));
    const wider = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (wider > 0) sideways.push(`${at}: ${wider} px`);
  };
  for (const [kind, names] of [
    ['short', ['a.xml', 'b.xml']],
    ['long', LONG_NAMES],
  ] as const) {
    for (const width of [320, 375, 641, 700, 768, 820, 900, 1024, 1100, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await upload(page, `${kind}-${width}.pdf`, ratePair(names), 'application/pdf');
      await expect(page.getByTestId('differing')).toContainText('Umsatzsteuersatz: 19\u00a0%');
      await measure(`${kind} names, ${width} px`);
    }
    // on paper (A4 is about 700 px wide)
    await page.setViewportSize({ width: 700, height: 900 });
    await page.emulateMedia({ media: 'print' });
    await measure(`${kind} names, print`);
    await page.emulateMedia({ media: 'screen' });
  }
  expect(broken).toEqual([]);
  expect(sideways).toEqual([]);
  // the names that must break still stand whole in the text
  await expect(page.getByRole('columnheader', { name: LONG_NAMES[1] })).toHaveCount(1);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// The test version at 1280 px: beside the test page the tool's container moved sideways by 261 px
// under long attachment names (audit R4-U-03); at 960 px the tool takes its phone layout there
test('keeps the comparison inside the tool beside the test page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const problems = await openHosted(page, '/', BUILT_TEST);
  const notice = loadAppConfig().config.accessNotice;
  if (notice !== undefined) {
    await page.getByRole('checkbox', { name: notice }).check();
    await page.getByRole('button', { name: TEXTS.accessContinue, exact: true }).click();
  }
  const tool = page.locator('.tr-app');
  const sideways = (selector: string) =>
    page.locator(selector).evaluate((element) => element.scrollWidth - element.clientWidth);
  for (const width of [1280, 960]) {
    await page.setViewportSize({ width, height: 900 });
    await upload(page, `lang-${width}.pdf`, ratePair(LONG_NAMES), 'application/pdf');
    await expect(tool.getByTestId('comparison')).toBeVisible();
    expect(await sideways('.tr-app'), `${width} px`).toBeLessThanOrEqual(0);
    expect(await sideways('html'), `${width} px`).toBeLessThanOrEqual(0);
    expect(await brokenWords(page, '.tr-app'), `${width} px`).toEqual([]);
    expect(await brokenCodes(page, '.tr-app'), `${width} px`).toEqual([]);
  }
  expect(problems).toEqual([]);
  expect(await sideEffects(page, TEST_VERSION_KEYS)).toEqual([]);
});
