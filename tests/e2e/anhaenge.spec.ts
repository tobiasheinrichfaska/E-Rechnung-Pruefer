import { expect, test } from '@playwright/test';
import { encode, officialText } from '../support/fixtures';
import { miniPdf } from '../../src/build/minipdf';
import type { Attachment } from '../../src/build/minipdf';
import { openApp, sideEffects, upload } from './helpers';

// The attachments of a PDF that hold no invoice data (audit 2026-11-15, QL-06 and QU-09).

const xml = (name: string, text: string): Attachment => ({
  name,
  bytes: encode(text),
  mime: 'text/xml',
  relationship: 'Alternative',
});

/** The PDF with the stream of its last attachment missing (object 0 is free; offsets stay). */
function withMissingStream(attachments: Attachment[]): Uint8Array {
  const text = new TextDecoder('latin1').decode(miniPdf({ attachments }));
  const last = [...text.matchAll(/\/EF << \/F (\d+) 0 R >>/g)].at(-1)?.[1] ?? '';
  const broken = text.replace(
    `/EF << /F ${last} 0 R >>`,
    `/EF << /F ${'0'.repeat(last.length)} 0 R >>`,
  );
  return new Uint8Array(Buffer.from(broken, 'latin1'));
}

test('names an attachment the PDF does not give out and a broken XML, in the result and in the list', async ({
  page,
}) => {
  const problems = await openApp(page);
  // the stream of zweite.xml is missing (the last one, miniPdf sorts by name); kaputt.xml is XML
  // that is not well-formed (audit 2026-11-15, R2-T-08)
  const pdf = withMissingStream([
    xml('factur-x.xml', officialText('kosit/01.01a-INVOICE_uncefact.xml')),
    xml('kaputt.xml', '<a>'),
    xml('zweite.xml', '<a/>'),
  ]);
  await upload(page, 'drei.pdf', pdf, 'application/pdf');
  await expect(page.getByTestId('verdict')).toHaveClass(/tone-warn/);
  await expect(page.getByTestId('verdict')).toContainText(
    'Der Anhang „zweite.xml“ lässt sich nicht aus dem PDF lesen.',
  );
  await expect(page.getByTestId('verdict')).toContainText(
    'Der Anhang „kaputt.xml“ ist XML, lässt sich aber nicht lesen.',
  );
  const list = page.locator('.card', { hasText: 'Weitere Anhänge im PDF' });
  await expect(list.getByRole('listitem')).toHaveText([
    'kaputt.xml – XML, fehlerhaft',
    'zweite.xml – nicht lesbar',
  ]);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});

test('names a single attachment without invoice data once (QU-09)', async ({ page }) => {
  const problems = await openApp(page);
  const pdf = miniPdf({
    attachments: [{ name: 'lieferschein.txt', bytes: encode('Lieferschein') }],
  });
  await upload(page, 'r.pdf', pdf, 'application/pdf');
  await expect(page.getByTestId('verdict')).toContainText(
    'Der Anhang „lieferschein.txt“ enthält keine Rechnungsdaten.',
  );
  // E-08a: the result names the only attachment, so there is no list of it below
  await expect(page.getByRole('heading', { name: 'Anhänge im PDF' })).toHaveCount(0);

  const two = miniPdf({
    attachments: [
      { name: 'lieferschein.txt', bytes: encode('Lieferschein') },
      xml('bestellung.xml', '<Order xmlns="urn:example:order"/>'),
    ],
  });
  await upload(page, 'zwei.pdf', two, 'application/pdf');
  await expect(page.getByTestId('verdict')).toContainText(
    // in the order of the PDF's name tree, which sorts them
    'Anhänge im PDF: „bestellung.xml“, „lieferschein.txt“. Keiner davon enthält Rechnungsdaten.',
  );
  await expect(page.getByRole('heading', { name: 'Anhänge im PDF' })).toBeVisible();
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});
