import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { encode, official, officialText, withInvoiceNumber } from '../support/fixtures';
import { miniPdf } from '../../src/build/minipdf';
import { openApp, sideEffects, upload } from './helpers';

// Handling found in the audit "Bedienung" of 2026-11-14 (docs/audit-bedienung-2026-11-14.md).

const XRECHNUNG = 'kosit/01.01a-INVOICE_ubl.xml';

/** A drop of the given files on the drop zone, as the browser delivers it. */
async function drop(page: Page, files: { name: string; text: string; type: string }[]) {
  const transfer = await page.evaluateHandle((list) => {
    const dt = new DataTransfer();
    for (const f of list) dt.items.add(new File([f.text], f.name, { type: f.type }));
    return dt;
  }, files);
  await page.locator('.dropzone').dispatchEvent('drop', { dataTransfer: transfer });
}

test('says when and which file was checked, and that only the first of several counts', async ({
  page,
}) => {
  const problems = await openApp(page);
  await drop(page, [
    { name: 'erste.xml', text: officialText(XRECHNUNG), type: 'application/xml' },
    { name: 'zweite.xml', text: officialText('cen/CII_example1.xml'), type: 'application/xml' },
  ]);
  await expect(page.getByText(/^Geprüfte Datei: „erste\.xml“ – geprüft am/)).toHaveText(
    /^Geprüfte Datei: „erste\.xml“ – geprüft am \d{2}\.\d{2}\.\d{4} um \d{2}:\d{2} Uhr$/,
  );
  await expect(page.getByTestId('only-first')).toHaveText(
    'Sie haben 2 Dateien abgelegt. Geprüft wurde nur die erste.',
  );

  // one file: no such line
  await upload(page, 'allein.xml', official(XRECHNUNG), 'application/xml');
  await expect(page.getByTestId('only-first')).toHaveCount(0);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// A dropped folder arrives as a File the browser cannot read (Chromium: NotFoundError); the
// browser's English message is not shown
test('names a file the browser cannot read in German', async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function (this: File) {
      if (this.name === 'ordner') {
        return Promise.reject(
          new DOMException('A requested file or directory could not be found', 'NotFoundError'),
        );
      }
      return original.call(this);
    };
  });
  const problems = await openApp(page);
  await upload(page, 'ordner', encode('x'), '');
  await expect(page.getByTestId('headline')).toHaveText('Die Datei lässt sich nicht öffnen');
  await expect(page.getByTestId('verdict')).toContainText('Vielleicht ist es ein Ordner');
  await expect(page.getByTestId('verdict')).not.toContainText('could not be found');
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('invites a drop only for files, also over the rest of the page', async ({ page }) => {
  const problems = await openApp(page);
  const zone = page.locator('.dropzone');
  const dragOver = (target: string, kind: 'file' | 'text') =>
    page.evaluate(
      ([selector, what]) => {
        const dt = new DataTransfer();
        if (what === 'file') dt.items.add(new File(['x'], 'a.xml', { type: 'application/xml' }));
        else dt.setData('text/plain', 'ein Text');
        const event = new DragEvent('dragover', {
          dataTransfer: dt,
          bubbles: true,
          cancelable: true,
        });
        document.querySelector(selector)?.dispatchEvent(event);
        return event.defaultPrevented;
      },
      [target, kind] as const,
    );

  // dragged text is no file: not taken, no invitation (A-09)
  expect(await dragOver('.dropzone', 'text')).toBe(false);
  await expect(zone).not.toHaveClass(/over/);
  // a file over the headline: the zone shows that a drop works, and stops when the drag is over
  await expect.poll(() => dragOver('h1', 'file')).toBe(true);
  await expect(zone).toHaveClass(/over/);
  await expect(zone).not.toHaveClass(/over/, { timeout: 2000 });
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('prints without the drop zone and with every section open', async ({ page }) => {
  const problems = await openApp(page);
  const twoParts = miniPdf({
    attachments: [
      { name: 'factur-x.xml', bytes: official('cen/CII_example1.xml'), mime: 'text/xml' },
    ],
  });
  await upload(page, 'hybrid.pdf', twoParts, 'application/pdf');
  const closed = () => page.locator('details:not([open])').count();
  const before = await closed();
  expect(before).toBeGreaterThan(0);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.dropzone')).toBeHidden();
  await expect(page.locator('.lead')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  expect(await closed()).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  expect(await closed()).toBe(before);
  await page.emulateMedia({ media: 'screen' });
  await expect(page.locator('.dropzone')).toBeVisible();
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('shows a clear focus ring on the file button', async ({ page }) => {
  const problems = await openApp(page);
  const button = page.getByRole('button', { name: 'Datei auswählen' });
  // keyboard focus (a fresh page may first focus the document itself)
  await expect
    .poll(async () => {
      await page.keyboard.press('Tab');
      return button.evaluate((b) => b === document.activeElement);
    })
    .toBe(true);
  expect(await button.evaluate((b) => getComputedStyle(b).outlineWidth)).toBe('3px');
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

// Decisions of 2026-11-14 on the handling (G-1, G-4, G-5, G-6)
test('folds the rows without a value, links to the sections and keeps the notice under the box', async ({
  page,
}) => {
  const problems = await openApp(page);
  // G-6: the start view says what the tool shows
  await expect(page.locator('.lead li')).toHaveCount(3);
  await upload(page, 'cen.xml', official('cen/CII_example2.xml'), 'application/xml');

  // G-1: rows "nur im Einzelfall nötig" without a value are closed, one click away
  const folded = page.getByTestId('folded-rows').first();
  await expect(folded.locator('summary')).toHaveText(
    /^(\d+ Angaben, die nur in besonderen Fällen nötig sind|Eine Angabe, die nur in besonderen Fällen nötig ist) – anzeigen$/,
  );
  await expect(folded.locator('tbody tr').first()).toBeHidden();
  await folded.locator('summary').click();
  await expect(folded.locator('tbody tr').first()).toBeVisible();
  // G-1: jump links from the box
  await page.getByTestId('jump-links').getByRole('link', { name: 'Rechnerische Prüfung' }).click();
  await expect(page).toHaveURL(/#rechnerische-pruefung$/);

  // G-6: the notice right under the box, the lead gone
  const boxBottom = await page
    .getByTestId('verdict')
    .evaluate((e) => e.getBoundingClientRect().bottom);
  const noticeTop = await page
    .getByTestId('fixed-notice')
    .evaluate((e) => e.getBoundingClientRect().top);
  expect(noticeTop - boxBottom).toBeLessThan(120);
  await expect(page.locator('.lead')).toHaveCount(0);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('prints and copies the result for the Kanzlei (G-4)', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __printed: number; __copied: string[] };
    w.__printed = 0;
    w.__copied = [];
    window.print = () => {
      w.__printed += 1;
    };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          w.__copied.push(text);
          return Promise.resolve();
        },
      },
    });
  });
  const problems = await openApp(page);
  await upload(page, 'summe.xml', official('kosit/01.01a-INVOICE_ubl.xml'), 'application/xml');

  await page.getByRole('button', { name: 'Ergebnis drucken' }).click();
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);

  await page.getByRole('button', { name: 'Ergebnis als Text kopieren' }).click();
  await expect(page.getByTestId('copy-result')).toHaveText(
    'Das Ergebnis ist in die Zwischenablage kopiert.',
  );
  await expect(page.getByRole('status')).toHaveText(
    'Das Ergebnis ist in die Zwischenablage kopiert.',
  );
  const [text] = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
  expect(text?.split('\n').slice(0, 2)).toEqual([
    'E-Rechnung prüfen – Ergebnis',
    expect.stringMatching(/^Geprüfte Datei: „summe\.xml“ – geprüft am \d{2}\.\d{2}\.\d{4} um/),
  ]);
  expect(text).toContain('Ergebnis: E-Rechnung erkannt (XRechnung 3.0)');
  expect(text).toContain('Pflichtangaben: ');

  // QU-07: the copy carries what the page shows besides the box lines
  const copy = async () => {
    await page.getByRole('button', { name: 'Ergebnis als Text kopieren' }).click();
    await expect(page.getByTestId('copy-result')).toBeVisible();
    const all = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
    return all.at(-1) ?? '';
  };
  // the reduced list of a Kleinbetragsrechnung (§ 33 UStDV)
  await upload(
    page,
    'klein.xml',
    official('kosit/paare/01.02a-INVOICE_ubl.xml'),
    'application/xml',
  );
  expect(await copy()).toMatch(/\n[^\n]*§ 33 UStDV\.\nPflichtangaben: /);
  // two different invoice XML: what differs, as in the box
  const cii = officialText('cen/CII_example1.xml');
  const xml = (name: string, data: string) => ({ name, bytes: encode(data), mime: 'text/xml' });
  await upload(
    page,
    'zwei.pdf',
    miniPdf({ attachments: [xml('a.xml', cii), xml('b.xml', withInvoiceNumber(cii, 'X-2'))] }),
    'application/pdf',
  );
  const differing = await page.getByTestId('differing').innerText();
  expect(differing).toMatch(/^Unterschiedlich: Rechnungsnummer/);
  expect(await copy()).toContain(`\n${differing}\n`);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('shrinks the drop zone after a result and says "auswählen" on a phone (G-5)', async ({
  page,
}) => {
  const problems = await openApp(page);
  await expect(page.getByRole('button', { name: 'Datei auswählen' })).toBeVisible();
  await upload(page, 'x.xml', official('cen/CII_example2.xml'), 'application/xml');
  await expect(page.getByRole('button', { name: 'Andere Datei prüfen' })).toBeVisible();
  const height = await page.locator('.dropzone').evaluate((e) => e.getBoundingClientRect().height);
  expect(height).toBeLessThan(90);

  // a phone, before a result (the spy of openApp stays in place over a reload)
  await page.setViewportSize({ width: 375, height: 740 });
  await page.reload();
  await expect(page.locator('.dropzone .title-narrow')).toHaveText('Rechnung auswählen');
  await expect(page.locator('.dropzone .title-narrow')).toBeVisible();
  await expect(page.locator('.dropzone .title-wide')).toBeHidden();
  // QU-10: the sentence above the drop zone does not say "ziehen" either
  await expect(page.locator('.lead p').first()).toHaveText('Wählen Sie eine Rechnung aus.', {
    useInnerText: true,
  });
  await page.setViewportSize({ width: 1280, height: 740 });
  await expect(page.locator('.lead p').first()).toHaveText(
    'Wählen Sie eine Rechnung aus oder ziehen Sie sie hierher.',
    { useInnerText: true },
  );
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});
