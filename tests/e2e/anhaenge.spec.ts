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

// Audit R4-U-02: the box counts the schema messages beyond the third of each part „below“, but the
// list stood only under the first part (first in the PDF's name tree) of the same data, and with
// different data nowhere; two parts with messages had one unnamed list
test('lists the schema messages of every part that has them, each named', async ({ page }) => {
  const problems = await openApp(page);
  const ubl = officialText('kosit/paare/01.01a-INVOICE_ubl.xml');
  const cii = officialText('kosit/paare/01.01a-INVOICE_uncefact.xml');
  // attributes the schema does not allow: only the schema sees them, the data stay the same
  const ublBad = ubl
    .replace('<cbc:IssueDate>', '<cbc:IssueDate foo="1">')
    .replace('<cbc:BuyerReference>', '<cbc:BuyerReference foo="1">')
    .replaceAll('<cbc:Note>', '<cbc:Note foo="1">');
  const ciiBad = cii.replaceAll('<ram:CityName>', '<ram:CityName foo="1">');
  const lists = page.getByTestId('schema-problems');
  const verdict = page.getByTestId('verdict');
  const jump = page.getByTestId('jump-links').getByRole('link', { name: 'Technische Meldungen' });
  const counted = async (index: number) =>
    Number(/\((\d+)\)$/.exec((await lists.nth(index).locator('summary').textContent()) ?? '')?.[1]);

  // the same data, only the second part with messages: its list with every message
  const second = [xml('factur-x.xml', cii), xml('ubl.xml', ublBad)];
  await upload(page, 'gleich.pdf', miniPdf({ attachments: second }), 'application/pdf');
  await expect(verdict).toContainText('Der Anhang „ubl.xml“ weicht');
  await expect(verdict).toContainText('(siehe unten)');
  await expect(lists).toHaveCount(1);
  await expect(lists.locator('summary')).toHaveText(
    /^Technische Meldungen der Schemaprüfung, Anhang „ubl\.xml“ \(\d+\)$/,
  );
  expect(await counted(0)).toBeGreaterThan(3);
  await expect(lists.locator('li')).toHaveCount(await counted(0));
  await jump.click();
  await expect(page).toHaveURL(/#technische-meldungen$/);
  await expect(lists).toHaveAttribute('open', '');

  // both parts with other messages: two lists with their own ids, each line of the box named
  const both = [xml('factur-x.xml', ciiBad), xml('ubl.xml', ublBad)];
  await upload(page, 'beide.pdf', miniPdf({ attachments: both }), 'application/pdf');
  await expect(lists).toHaveCount(2);
  expect(await lists.evaluateAll((all) => all.map((list) => list.id))).toEqual([
    'technische-meldungen',
    'technische-meldungen-2',
  ]);
  await expect(lists.nth(0).locator('summary')).toContainText('Anhang „factur-x.xml“');
  await expect(lists.nth(1).locator('summary')).toContainText('Anhang „ubl.xml“');
  await expect(lists.nth(1).locator('li')).toHaveCount(await counted(1));
  const lines = verdict.locator('p', { hasText: /^Technische Meldung/ });
  expect(await lines.count()).toBeGreaterThan(3);
  for (const line of await lines.all()) {
    await expect(line).toHaveText(
      /^Technische Meldung, Anhang „(factur-x|ubl)\.xml“ \(Zeile \d+\): /,
    );
    // the engine's message stays marked as English
    await expect(line.locator('[lang="en"]')).toHaveCount(1);
  }
  // the jump link opens every list, not only the first it jumps to (audit R5-U-01)
  expect(await lists.evaluateAll((all) => all.map((list) => list.hasAttribute('open')))).toEqual([
    false,
    false,
  ]);
  await jump.click();
  await expect(page).toHaveURL(/#technische-meldungen$/);
  await expect(lists.nth(0)).toHaveAttribute('open', '');
  await expect(lists.nth(1)).toHaveAttribute('open', '');

  // different data: the list after the comparison, the jump link to it
  const other = ublBad.replace('<cbc:ID>123456XX</cbc:ID>', '<cbc:ID>123456YY</cbc:ID>');
  const apart = [xml('erste.xml', other), xml('factur-x.xml', cii)];
  await upload(page, 'verschieden.pdf', miniPdf({ attachments: apart }), 'application/pdf');
  const comparison = page.locator('.card', { has: page.getByTestId('comparison') });
  await expect(comparison.getByTestId('schema-problems')).toHaveCount(1);
  await expect(lists).toHaveCount(1);
  await expect(lists.locator('summary')).toContainText('Anhang „erste.xml“');
  await expect(jump).toBeVisible();
  expect(problems).toEqual([]);
  expect(await sideEffects(page)).toEqual([]);
});
