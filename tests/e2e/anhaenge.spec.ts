import { expect, test } from '@playwright/test';
import { encode, officialText } from '../support/fixtures';
import { miniPdf } from '../../src/build/minipdf';
import type { Attachment } from '../../src/build/minipdf';
import { openApp, sideEffects, upload } from './helpers';

// The attachments of a PDF that hold no invoice data (audit 2026-11-15, QL-06).

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

test('names an attachment the PDF does not give out, in the result and in the list', async ({
  page,
}) => {
  const problems = await openApp(page);
  const pdf = withMissingStream([
    xml('factur-x.xml', officialText('kosit/01.01a-INVOICE_uncefact.xml')),
    xml('zweite.xml', '<a/>'),
  ]);
  await upload(page, 'zwei.pdf', pdf, 'application/pdf');
  await expect(page.getByTestId('verdict')).toHaveClass(/tone-warn/);
  await expect(page.getByTestId('verdict')).toContainText(
    'Der Anhang „zweite.xml“ lässt sich nicht aus dem PDF lesen.',
  );
  const list = page.locator('.card', { hasText: 'Weitere Anhänge im PDF' });
  await expect(list.getByRole('listitem')).toHaveText(['zweite.xml – nicht lesbar']);
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});
