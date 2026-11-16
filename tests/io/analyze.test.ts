import { readdirSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  MAX_FILE_BYTES,
  analyzeFile,
  extendedAmounts,
  fileKindOf,
  tooLargeFile,
} from '../../src/io/analyze';
import { readXml, rootOf } from '../../src/io/xml';
import { checkPflichtangaben } from '../../src/logic/check';
import { syntaxOf } from '../../src/logic/syntax';
import type { PdfJsLike } from '../../src/io/pdf';
import { TEXTS, fill } from '../../src/logic/texts';
import { comparisonRows, differingLine, verdictOf } from '../../src/logic/verdict';
import { encode, official, officialText, withInvoiceNumber, withSpecId } from '../support/fixtures';
import { compressedPdf } from '../../src/build/compressedPdf';
import { miniPdf } from '../../src/build/minipdf';
import type { Attachment } from '../../src/build/minipdf';

const load = () => Promise.resolve(pdfjs as unknown as PdfJsLike);
const check = async (name: string, bytes: Uint8Array) => {
  const analysis = await analyzeFile(name, bytes, load);
  return { analysis, verdict: verdictOf(analysis) };
};
const xml = (name: string, text: string): Attachment => ({
  name,
  bytes: encode(text),
  mime: 'text/xml',
  relationship: 'Alternative',
});

const CII = officialText('cen/CII_example1.xml');
const XR_UBL = 'kosit/01.01a-INVOICE_ubl.xml';
const XR_CII = 'kosit/01.01a-INVOICE_uncefact.xml';

describe('file kind by content', () => {
  it('tells PDF, XML and other files apart regardless of the name', () => {
    expect(fileKindOf(miniPdf())).toBe('pdf');
    expect(fileKindOf(encode(CII))).toBe('xml');
    expect(fileKindOf(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe('unknown');
    // a web page is no XML the tool reads, also when it is well-formed XHTML (audit R2-L-06)
    expect(fileKindOf(encode('<html><body><p>AGB<br></p></body></html>'))).toBe('unknown');
    expect(fileKindOf(encode('<html xmlns="http://www.w3.org/1999/xhtml"/>'))).toBe('unknown');
  });
});

describe('XML files', () => {
  it.each([
    ['cen/CII_example1.xml', 'cii', 'E-Rechnung erkannt (EN 16931'],
    ['cen/UBL_ubl-tc434-example1.xml', 'ubl-invoice', 'E-Rechnung erkannt (EN 16931'],
    ['cen/UBL_ubl-tc434-creditnote1.xml', 'ubl-creditnote', 'E-Rechnung erkannt (EN 16931'],
    [XR_UBL, 'ubl-invoice', 'E-Rechnung erkannt (XRechnung 3.0)'],
    [XR_CII, 'cii', 'E-Rechnung erkannt (XRechnung 3.0)'],
    [
      'kosit/04.01a-INVOICE_ubl.xml',
      'ubl-invoice',
      'E-Rechnung erkannt (XRechnung 3.0 mit Extension)',
    ],
    ['kosit/02.01a-cvd_INVOICE_ubl.xml', 'ubl-invoice', 'E-Rechnung erkannt (XRechnung 3.0, CVD)'],
    // the CEN example behind the profile entry Peppol BIS Billing 3.0 (audit 2026-11-15, QT-13)
    [
      'cen/UBL_BIS3_Invoice_positive.xml',
      'ubl-invoice',
      'E-Rechnung erkannt (Peppol BIS Billing 3.0)',
    ],
  ])('%s is recognised as %s', async (path, syntax, headline) => {
    const { analysis, verdict } = await check(path, official(path));
    expect(analysis.invoices.map((i) => i.syntax)).toEqual([syntax]);
    // recognised as an e-invoice; a hint on the Pflichtangaben may make it yellow (F22)
    expect(verdict.tone).not.toBe('bad');
    expect(verdict.headline.startsWith(headline)).toBe(true);
  });

  it('reads the header values of the official XRechnung example', async () => {
    const { analysis } = await check('x.xml', official(XR_UBL));
    expect(analysis.invoices[0]?.header['BT-1']).toEqual(['123456XX']);
    expect(analysis.invoices[0]?.header['BT-2']).toEqual(['2016-04-04']);
  });

  it('names the profiles MINIMUM and BASIC WL as no e-invoice', async () => {
    const minimum = await check('m.xml', encode(withSpecId(CII, 'urn:factur-x.eu:1p0:minimum')));
    expect(minimum.verdict.tone).toBe('bad');
    expect(minimum.verdict.headline).toBe(
      'Rechnungsdaten im Profil MINIMUM: keine E-Rechnung im Sinne des UStG',
    );
    const basicWl = await check('b.xml', encode(withSpecId(CII, 'urn:factur-x.eu:1p0:basicwl')));
    expect(basicWl.verdict.headline).toContain('Profil BASIC WL: keine E-Rechnung');
  });

  it('does not judge an unknown or missing specification identifier', async () => {
    const unknown = await check('u.xml', encode(withSpecId(CII, 'urn:example:unbekannt')));
    expect(unknown.verdict.tone).toBe('warn');
    expect(unknown.verdict.headline).toBe(
      'Rechnungsdaten erkannt, Spezifikation unbekannt: nicht beurteilt',
    );
    expect(unknown.verdict.explanation.join(' ')).toContain('urn:example:unbekannt');
    const missing = await check('m.xml', encode(withSpecId(CII, '')));
    expect(missing.verdict.explanation.join(' ')).toContain('fehlt');
  });

  it('treats the ZUGFeRD 1.0 identifier in an official CEN example as ZUGFeRD 1.0', async () => {
    const { verdict } = await check('z.xml', official('cen/CII_business_example_02.xml'));
    expect(verdict.tone).toBe('bad');
    expect(verdict.explanation.join(' ')).toContain('erst ab Version 2.0.1');
  });

  it('recognises a ZUGFeRD 1.0 document by its namespace', async () => {
    const zugferd1 = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryDocument xmlns:rsm="urn:ferd:CrossIndustryDocument:invoice:1p0"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:12">
  <rsm:SpecifiedExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter>
    <ram:ID>urn:ferd:CrossIndustryDocument:invoice:1p0:comfort</ram:ID>
  </ram:GuidelineSpecifiedDocumentContextParameter></rsm:SpecifiedExchangedDocumentContext>
</rsm:CrossIndustryDocument>`;
    const { analysis, verdict } = await check('zugferd-invoice.xml', encode(zugferd1));
    expect(analysis.invoices[0]?.syntax).toBe('zugferd1');
    expect(verdict.headline).toBe(
      'Rechnungsdaten nach ZUGFeRD 1.0: keine E-Rechnung im Sinne des UStG',
    );
  });

  it('names an XML without a known invoice syntax and does not call it no e-invoice', async () => {
    const { verdict } = await check('order.xml', encode('<Order xmlns="urn:example:order"/>'));
    expect(verdict.headline).toBe('XML-Datei ohne bekanntes Rechnungsformat');
    expect(verdict.explanation.join(' ')).toContain('urn:example:order');
    expect(verdict.explanation.join(' ')).toContain('vereinbart');
  });

  it('refuses a DOCTYPE and reports broken XML with its line', async () => {
    const doctype = await check('d.xml', encode('<!DOCTYPE x [<!ENTITY a "b">]><x>&a;</x>'));
    expect(doctype.analysis.problem?.kind).toBe('xmlDoctype');
    const broken = await check('b.xml', encode('<?xml version="1.0"?>\n<a>\n<b></a>'));
    expect(broken.verdict.headline).toBe('Die XML-Datei ist fehlerhaft');
    expect(broken.verdict.explanation.join(' ')).toMatch(/Rn\. 6a/);
    expect(broken.verdict.explanation.join(' ')).toMatch(/Technische Meldung \(Zeile \d+\):/);
    // G-10: the German sentence first (F24), the engine's message last
    expect(broken.verdict.explanation[0]).toBe(TEXTS.formatError);
    expect(broken.verdict.explanation.at(-1)).toMatch(/^Technische Meldung \(Zeile \d+\):/);
    expect(broken.verdict.explanation).toContain(TEXTS.supplierMendFile);
  });
});

describe('PDF files', () => {
  it('calls a PDF without attachments a plain PDF', async () => {
    const { verdict } = await check('r.pdf', miniPdf({ text: 'Rechnung 4711' }));
    expect(verdict.headline).toBe('Keine E-Rechnung: einfaches PDF');
  });

  it('recognises a hybrid PDF by the content of its attachment, not by the name', async () => {
    const { analysis, verdict } = await check(
      'r.pdf',
      miniPdf({ attachments: [xml('irgendwas.dat', CII)] }),
    );
    expect(analysis.invoices[0]?.origin).toBe('irgendwas.dat');
    expect(verdict.headline).toMatch(/^E-Rechnung erkannt/);
    expect(verdict.explanation[0]).toContain('irgendwas.dat');
  });

  // Built like real Factur-X files (compressed object and xref streams, FlateDecode attachment,
  // name tree with Kids), also with the attachment added in an incremental update (T-02)
  it.each([
    ['compressed', {}],
    ['compressed with an incremental update', { incremental: true }],
  ] as const)('reads a hybrid PDF %s', async (_, options) => {
    const pdf = compressedPdf(encode(officialText(XR_CII)), 'factur-x.xml', options);
    expect(new TextDecoder('latin1').decode(pdf)).toContain('/ObjStm');
    const { analysis, verdict } = await check('r.pdf', pdf);
    expect(verdict.headline).toBe('E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen');
    expect(analysis.invoices[0]?.origin).toBe('factur-x.xml');
  });

  it('names MINIMUM inside a PDF as in the hand-over', async () => {
    const pdf = miniPdf({
      attachments: [xml('factur-x.xml', withSpecId(CII, 'urn:factur-x.eu:1p0:minimum'))],
    });
    const { verdict } = await check('r.pdf', pdf);
    expect(verdict.headline).toBe(
      'PDF mit Rechnungsdaten, Profil MINIMUM: keine E-Rechnung im Sinne des UStG',
    );
  });

  it('lists foreign attachments and finds no invoice data', async () => {
    const pdf = miniPdf({
      attachments: [
        { name: 'Lieferschein.txt', bytes: encode('Lieferschein') },
        xml('bestellung.xml', '<Order xmlns="urn:example:order"/>'),
      ],
    });
    const { analysis, verdict } = await check('r.pdf', pdf);
    expect(verdict.headline).toBe('Keine E-Rechnung: PDF ohne Rechnungsdaten');
    expect(analysis.others.map((o) => o.kind).sort()).toEqual(['notXml', 'otherXml']);
  });

  it('names in the result box only the missing parts of a partly present row (QU-03)', async () => {
    const { verdict } = await check('r.xml', official('kosit/paare/01.14a-INVOICE_ubl.xml'));
    expect(verdict.explanation).toContain(
      'Es fehlen Pflichtangaben: Fiskalvertreter: Name, Anschrift und USt-IdNr. ' +
        '(davon fehlen: Ort; Postleitzahl oder Straße/Postfach) (siehe „Pflichtangaben“).',
    );
  });

  // Audit R2-L-04: a row checked per position has what is there in its positions, not in its
  // values — the box and the summary name the gap, not the whole row
  it('names only the position without a quantity, in the box and in the summary', async () => {
    const text = officialText(XR_CII).replace(
      '<ram:BilledQuantity unitCode="XPP">1</ram:BilledQuantity>',
      '',
    );
    expect(text).toContain('<ram:BilledQuantity');
    const { analysis, verdict } = await check('r.xml', encode(text));
    expect(analysis.invoices[0]?.schema?.count).toBe(0);
    const row =
      'Menge und Art der Lieferung oder Umfang und Art der Leistung ' +
      '(davon fehlt: Position Zeitschrift [...]: Menge)';
    expect(verdict.explanation).toContain(
      `Es fehlen Pflichtangaben: ${row} (siehe „Pflichtangaben“).`,
    );
    const model = analysis.invoices[0]?.model;
    if (!model) throw new Error('no model');
    expect(checkPflichtangaben(model).summary).toBe(`Es fehlt: ${row}.`);
  });

  it('keeps the invoice when other attachments are present', async () => {
    const pdf = miniPdf({
      attachments: [
        xml('xrechnung.xml', officialText(XR_UBL)),
        { name: 'a.txt', bytes: encode('x') },
      ],
    });
    const { verdict } = await check('r.pdf', pdf);
    expect(verdict.headline).toBe('E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen');
  });

  // Audit R2-L-06: terms as HTML beside the invoice are „kein XML“, never „ist XML, lässt sich
  // aber nicht lesen“ with a format error — with or without a DOCTYPE, by content
  it('lists an HTML attachment as no XML, never as broken XML', async () => {
    const pages = [
      '<html><body><p>Unsere AGB<br></p></body></html>',
      '<!DOCTYPE html>\n<html lang="de"><body><p>AGB<br></p></body></html>',
      '<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>',
    ];
    for (const page of pages) {
      const agb = { name: 'agb.xml', bytes: encode(page), mime: 'text/html' };
      const beside = await check(
        'r.pdf',
        miniPdf({ attachments: [xml('factur-x.xml', officialText(XR_CII)), agb] }),
      );
      expect(beside.analysis.others).toEqual([{ origin: 'agb.xml', kind: 'notXml' }]);
      expect(beside.verdict.explanation.join(' ')).not.toContain('agb.xml');
      const alone = await check('r.pdf', miniPdf({ attachments: [agb] }));
      expect(alone.verdict.headline).toBe('Keine E-Rechnung: PDF ohne Rechnungsdaten');
      expect(alone.verdict.explanation.join(' ')).not.toContain('Rn. 6a');
    }
    // an XML with a DOCTYPE html but an invoice root is still not read, and named
    const hidden = `<!DOCTYPE html>${officialText(XR_UBL).replace(/^<\?xml[^>]*\?>/, '')}`;
    const { analysis } = await check('r.pdf', miniPdf({ attachments: [xml('x.xml', hidden)] }));
    expect(analysis.others).toEqual([{ origin: 'x.xml', kind: 'doctypeXml' }]);
  });

  it('reports a broken XML attachment as a format error', async () => {
    const pdf = miniPdf({ attachments: [xml('factur-x.xml', '<?xml version="1.0"?><a><b></a>')] });
    const { verdict } = await check('r.pdf', pdf);
    expect(verdict.headline).toBe('PDF mit fehlerhafter XML');
    expect(verdict.explanation.join(' ')).toContain('Rn. 6a');
  });

  it('sees the same invoice in UBL and CII as one invoice embedded twice', async () => {
    const pdf = miniPdf({
      attachments: [
        xml('xrechnung.xml', officialText(XR_UBL)),
        xml('factur-x.xml', officialText(XR_CII)),
      ],
    });
    const { verdict } = await check('r.pdf', pdf);
    expect(verdict.comparison).toEqual({ same: true, differing: [] });
    expect(verdict.tone).toBe('warn');
    expect(verdict.headline).toBe('E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen');
    expect(verdict.explanation.join(' ')).toContain('2-mal eingebettet');
  });

  // Audit QL-01: the same header is not enough — what the result shows of each part must agree
  it('calls two invoice XML with the same header but other data different, in any order', async () => {
    const cii = officialText(XR_CII);
    const noTaxId = cii.replace(
      /<ram:SpecifiedTaxRegistration>[\s\S]*?<\/ram:SpecifiedTaxRegistration>/g,
      '',
    );
    expect(noTaxId).not.toContain('SpecifiedTaxRegistration');
    for (const attachments of [
      [xml('a.xml', cii), xml('b.xml', noTaxId)],
      [xml('b.xml', noTaxId), xml('a.xml', cii)],
    ]) {
      const { analysis, verdict } = await check('r.pdf', miniPdf({ attachments }));
      expect(verdict.comparison).toEqual({ same: false, differing: [] });
      expect(verdict.headline).toBe(TEXTS.contradicting);
      expect(differingLine(analysis.invoices, [])).toContain(
        'Steuernummer oder USt-IdNr. des leistenden Unternehmers',
      );
    }
  });

  // Audit R2-T-03: a difference only in the rule results — the copy says BT-106 = 1.00, so only
  // BR-CO-10 and BR-CO-13 differ (no Pflichtangabe shows BT-106)
  it('calls two invoice XML different that differ only in BT-106, in any order', async () => {
    const cii = officialText(XR_CII);
    const header = '<ram:LineTotalAmount>314.86</ram:LineTotalAmount>';
    expect(cii.split(header)).toHaveLength(2);
    const other = cii.replace(header, '<ram:LineTotalAmount>1.00</ram:LineTotalAmount>');
    for (const attachments of [
      [xml('a.xml', cii), xml('b.xml', other)],
      [xml('b.xml', other), xml('a.xml', cii)],
    ]) {
      const { analysis, verdict } = await check('r.pdf', miniPdf({ attachments }));
      expect(analysis.invoices.map((p) => p.schema?.count)).toEqual([0, 0]);
      expect(verdict.comparison).toEqual({ same: false, differing: [] });
      expect(verdict.headline).toBe(TEXTS.contradicting);
      expect(verdict.tone).toBe('bad');
      expect(differingLine(analysis.invoices, [])).toContain('Rechnerische Prüfung');
    }
  });

  it('never picks one of two different invoices', async () => {
    const pdf = miniPdf({
      attachments: [xml('a.xml', CII), xml('b.xml', withInvoiceNumber(CII, 'ANDERE-NR'))],
    });
    const { verdict } = await check('r.pdf', pdf);
    // F27: different data in two invoice XML is a format error (standard: one XML per PDF)
    expect(verdict.headline).toBe('Rechnungsdaten mit Formatfehler: mehrere Rechnungs-XML im PDF');
    expect(verdict.tone).toBe('bad');
    expect(verdict.explanation).toEqual(
      expect.arrayContaining([TEXTS.oneXmlOnly, TEXTS.formatError, TEXTS.askSupplier]),
    );
    expect(verdict.comparison).toEqual({ same: false, differing: ['BT-1'] });
    expect(verdict.invoices).toHaveLength(2);
  });

  // Audit 2026-11-14, U-06/S-05/T-05: what the tool does not read is "not judged", never a
  // "Formatfehler" — as with a single XML file with a DOCTYPE.
  it('does not call an attachment with a DOCTYPE a format error', async () => {
    const doctype = '<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>';
    const { analysis, verdict } = await check(
      'r.pdf',
      miniPdf({ attachments: [xml('a.xml', doctype)] }),
    );
    expect(analysis.others).toEqual([{ origin: 'a.xml', kind: 'doctypeXml' }]);
    expect(verdict.tone).toBe('warn');
    expect(verdict.headline).toBe('PDF nicht vollständig geprüft');
    expect(verdict.explanation.join(' ')).toContain('Dokumenttyp-Angabe');
    expect(verdict.explanation.join(' ')).not.toContain('Rn. 6a');
  });

  // Audit QL-06: what the tool did not read could be a second invoice XML (F27)
  it('names attachments not read beside an invoice XML and makes the result yellow', async () => {
    const doctype = '<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>';
    const broken = '<rsm:CrossIndustryInvoice xmlns:rsm="urn:x"><a></rsm:CrossIndustryInvoice>';
    for (const [other, line] of [
      [xml('zweite.xml', doctype), fill(TEXTS.attachmentDoctype, { name: 'zweite.xml' })],
      [xml('zweite.xml', broken), fill(TEXTS.attachmentBroken, { name: 'zweite.xml' })],
    ] as const) {
      const pdf = miniPdf({ attachments: [xml('factur-x.xml', officialText(XR_CII)), other] });
      const { verdict } = await check('r.pdf', pdf);
      expect(verdict.tone).toBe('warn');
      expect(verdict.headline).toBe('E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen');
      // and what that means for the result (audit R2-U-08)
      expect(verdict.explanation.slice(-2)).toEqual([line, TEXTS.unreadOne]);
    }
  });

  it('names an attachment pdf.js cannot take out of the PDF, and judges nothing without', async () => {
    const withMissingStream = (attachments: Attachment[]) => {
      const text = new TextDecoder('latin1').decode(miniPdf({ attachments }));
      const last = [...text.matchAll(/\/EF << \/F (\d+) 0 R >>/g)].at(-1)?.[1] ?? '';
      // object 0 is free: the attachment's stream is missing, every offset stays right
      const broken = text.replace(
        `/EF << /F ${last} 0 R >>`,
        `/EF << /F ${'0'.repeat(last.length)} 0 R >>`,
      );
      return new Uint8Array(Buffer.from(broken, 'latin1'));
    };
    const next = await check(
      'r.pdf',
      withMissingStream([xml('factur-x.xml', officialText(XR_CII)), xml('zweite.xml', '<a/>')]),
    );
    expect(next.analysis.pdf?.unreadable).toEqual(['zweite.xml']);
    expect(next.verdict.explanation).toContain(
      fill(TEXTS.attachmentUnreadable, { name: 'zweite.xml' }),
    );
    const alone = await check(
      'r.pdf',
      withMissingStream([xml('factur-x.xml', officialText(XR_CII))]),
    );
    expect(alone.analysis.invoices).toEqual([]);
    expect(alone.verdict.tone).toBe('warn');
    expect(alone.verdict.headline).toBe(TEXTS.pdfNotChecked);
    expect(alone.verdict.explanation).toEqual([
      fill(TEXTS.attachmentUnreadable, { name: 'factur-x.xml' }),
      TEXTS.notJudged,
    ]);
  });

  it('does not call a well-formed XML attachment over 20 MB a format error', async () => {
    const big = `<?xml version="1.0"?><a>${'x'.repeat(21 * 1024 * 1024)}</a>`;
    const { analysis, verdict } = await check(
      'r.pdf',
      miniPdf({ attachments: [xml('a.xml', big)] }),
    );
    expect(analysis.others).toEqual([{ origin: 'a.xml', kind: 'tooLargeXml' }]);
    expect(verdict.headline).toBe('PDF nicht vollständig geprüft');
    expect(verdict.explanation.join(' ')).toContain('größer als 20 MB');
    expect(verdict.explanation.join(' ')).not.toContain('Rn. 6a');
  });

  it('does not say "no e-invoice" when attachments beyond the first 50 were not read', async () => {
    const attachments = Array.from({ length: 51 }, (_, i) => ({
      name: `anlage-${String(i).padStart(2, '0')}.txt`,
      bytes: encode('x'),
    }));
    const pdf = miniPdf({ attachments: [...attachments, xml('zz-factur-x.xml', CII)] });
    const { analysis, verdict } = await check('r.pdf', pdf);
    expect(analysis.pdf?.truncated).toBe(true);
    expect(analysis.invoices).toEqual([]);
    expect(verdict.tone).toBe('warn');
    expect(verdict.headline).toBe('PDF nicht vollständig geprüft');
    expect(verdict.explanation.join(' ')).toContain('nur die ersten 50');
  });

  it('reports a PDF whose list of attachments is broken as damaged, not as a crash', async () => {
    // The same kid twice in the EmbeddedFiles name tree: pdf.js throws in getAttachments (U-03)
    const x = '<?xml version="1.0"?><r/>';
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 4 0 R >> >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>',
      '<< /Kids [5 0 R 5 0 R] >>',
      '<< /Names [(b.xml) 6 0 R] >>',
      '<< /Type /Filespec /F (b.xml) /EF << /F 7 0 R >> >>',
      `<< /Type /EmbeddedFile /Length ${x.length} >>\nstream\n${x}\nendstream`,
    ];
    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const { verdict } = await check('r.pdf', encode(out));
    expect(verdict.headline).toBe('Das PDF lässt sich nicht lesen');
  });

  it('reports a password-protected PDF', async () => {
    const { verdict } = await check('r.pdf', miniPdf({ passwordProtected: true }));
    expect(verdict.headline).toBe('Das PDF ist mit einem Kennwort geschützt');
  });

  it('reports a damaged PDF', async () => {
    const { verdict } = await check('r.pdf', encode('%PDF-1.7\nnichts'));
    expect(verdict.headline).toBe('Das PDF lässt sich nicht lesen');
  });

  it('refuses a too large PDF before reading it', async () => {
    const big = new Uint8Array(31 * 1024 * 1024);
    big.set(encode('%PDF-1.7'));
    const { verdict } = await check('r.pdf', big);
    expect(verdict.headline).toBe('Die Datei ist zu groß');
  });
});

// Audit R2-L-01/R2-L-02: two invoice XML are compared by what they say, not by how they write it
describe('two invoice XML of the same invoice, written another way', () => {
  const cii = officialText(XR_CII);
  /** Both orders of the two attachments, each with its verdict and its line "Unterschiedlich" */
  const both = async (a: string, b: string) =>
    Promise.all(
      [
        [xml('a.xml', a), xml('b.xml', b)],
        [xml('b.xml', b), xml('a.xml', a)],
      ].map(async (attachments) => {
        const { analysis, verdict } = await check('r.pdf', miniPdf({ attachments }));
        expect(analysis.invoices.map((p) => p.schema?.count)).toEqual([0, 0]);
        return { analysis, verdict, line: differingLine(analysis.invoices, []) };
      }),
    );
  const replaced = (text: string, from: string | RegExp, to: string) => {
    const result = text.replace(from, to);
    expect(result).not.toBe(text);
    return result;
  };

  it.each([
    // a rate and a quantity with more decimals (the amounts kept as they are)
    [
      'the rate 7 as 7.00',
      (t: string) => t.replaceAll('7</ram:RateApplicable', '7.00</ram:RateApplicable'),
    ],
    [
      'the quantity 1 as 1.0000',
      (t: string) => t.replaceAll('">1</ram:BilledQuantity>', '">1.0000</ram:BilledQuantity>'),
    ],
    [
      'an amount with a third decimal 0',
      (t: string) =>
        t.replace('<ram:TaxBasisTotalAmount>314.86<', '<ram:TaxBasisTotalAmount>314.860<'),
    ],
    // a document total of 0.00 that the other copy leaves out (BR-CO-11/-12 run only there)
    [
      'zero document allowances and charges in one copy only',
      (t: string) =>
        t.replace(
          '<ram:LineTotalAmount>314.86</ram:LineTotalAmount>',
          '<ram:LineTotalAmount>314.86</ram:LineTotalAmount><ram:ChargeTotalAmount>0.00</ram:ChargeTotalAmount><ram:AllowanceTotalAmount>0.00</ram:AllowanceTotalAmount>',
        ),
    ],
  ])('sees %s as the same invoice', async (_, change) => {
    const other = change(cii);
    expect(other).not.toBe(cii);
    for (const { verdict } of await both(cii, other)) {
      expect(verdict.comparison).toEqual({ same: true, differing: [] });
      expect(verdict.tone).toBe('warn');
      expect(verdict.headline).toBe('E-Rechnung erkannt (XRechnung 3.0) – mit Hinweisen');
    }
  });

  it('sees the VAT breakdowns in another order as the same invoice', async () => {
    const text = officialText('kosit/paare/03.01a-INVOICE_uncefact.xml');
    const header =
      /(<ram:ApplicableTradeTax>\s*<ram:CalculatedAmount>[\s\S]*?<\/ram:ApplicableTradeTax>)(\s*)(<ram:ApplicableTradeTax>\s*<ram:CalculatedAmount>[\s\S]*?<\/ram:ApplicableTradeTax>)/;
    const [first = '', space = '', second = ''] = header.exec(text)?.slice(1) ?? [];
    expect(first).toContain('<ram:RateApplicablePercent>19<');
    expect(second).toContain('<ram:RateApplicablePercent>7<');
    const swapped = text.replace(header, `${second}${space}${first}`);
    expect(swapped).not.toBe(text);
    for (const { verdict } of await both(text, swapped)) {
      expect(verdict.comparison).toEqual({ same: true, differing: [] });
    }
  });

  it.each([
    [
      'a quantity 1 → 5',
      (t: string) => t.replace('">1</ram:BilledQuantity>', '">5</ram:BilledQuantity>'),
    ],
    // BT-107 without any document allowance (BG-20): BR-CO-11 in this copy only
    [
      'a BT-107 without a document allowance',
      (t: string) =>
        replaced(
          t,
          '<ram:TaxBasisTotalAmount>',
          '<ram:AllowanceTotalAmount>10.00</ram:AllowanceTotalAmount><ram:TaxBasisTotalAmount>',
        ),
    ],
  ])('keeps %s apart', async (_, change) => {
    const other = change(cii);
    expect(other).not.toBe(cii);
    for (const { verdict } of await both(cii, other)) {
      expect(verdict.comparison).toEqual({ same: false, differing: [] });
      expect(verdict.headline).toBe(TEXTS.contradicting);
    }
  });

  // R2-L-02: what differs is shown, not "vorhanden / vorhanden"
  it('names the two quantities of the position that differs, in the line and the table', async () => {
    const other = replaced(cii, '">1</ram:BilledQuantity>', '">5</ram:BilledQuantity>');
    for (const { analysis, line } of await both(cii, other)) {
      const [a, b] = analysis.invoices[0]?.origin === 'a.xml' ? ['1', '5'] : ['5', '1'];
      const label = 'Menge und Art der Lieferung oder Umfang und Art der Leistung';
      expect(line).toBe(
        `Unterschiedlich: ${label} (Positionsnummer: Zeitschrift [...] · Menge: ${a} / ` +
          `Positionsnummer: Zeitschrift [...] · Menge: ${b}).`,
      );
      const row = comparisonRows(analysis.invoices).find((r) => r.label === label);
      expect(row).toEqual({
        label,
        values: [
          `Positionsnummer: Zeitschrift [...] · Menge: ${a}`,
          `Positionsnummer: Zeitschrift [...] · Menge: ${b}`,
        ],
        differs: true,
      });
    }
  });

  it('keeps the short texts of the rule results where they differ', async () => {
    const other = replaced(
      cii,
      '<ram:TaxBasisTotalAmount>',
      '<ram:AllowanceTotalAmount>10.00</ram:AllowanceTotalAmount><ram:TaxBasisTotalAmount>',
    );
    const [first] = await both(cii, other);
    expect(first?.line).toContain(
      'Rechnerische Prüfung (passt / mögliche Auffälligkeit: BR-CO-11, BR-CO-13)',
    );
  });

  // Every KoSIT pair is one invoice in UBL and in CII. Apart stay only those whose files differ in
  // what the result shows (tests/io/extract.test.ts, KNOWN): 01.20a also in BT-113 = 0.00 (a
  // question for Tobias), 03.07a only in BT-29, which no Pflichtangabe shows
  it('sees every KoSIT pair as the same invoice, but the four whose data differ', async () => {
    const pairs = readdirSync(new URL('../fixtures/offiziell/kosit/paare/', import.meta.url))
      .filter((name) => name.endsWith('_ubl.xml'))
      .map((name) => name.replace('-INVOICE_ubl.xml', ''));
    expect(pairs).toHaveLength(33);
    const apart: string[] = [];
    for (const pair of pairs) {
      const ubl = officialText(`kosit/paare/${pair}-INVOICE_ubl.xml`);
      const uncefact = officialText(`kosit/paare/${pair}-INVOICE_uncefact.xml`);
      const pdf = miniPdf({ attachments: [xml('a.xml', ubl), xml('b.xml', uncefact)] });
      const { verdict } = await check('r.pdf', pdf);
      if (!verdict.comparison?.same) apart.push(pair);
    }
    expect(apart).toEqual(['01.20a', '01.21a', '03.01a', '03.06a']);
  });
});

describe('other files', () => {
  it('judges a file above every limit by its size alone', () => {
    expect(MAX_FILE_BYTES).toBe(30 * 1024 * 1024);
    expect(verdictOf(tooLargeFile('riesig.pdf')).headline).toBe('Die Datei ist zu groß');
  });

  it('names empty and unsupported files', async () => {
    expect((await check('leer.pdf', new Uint8Array())).verdict.headline).toBe('Die Datei ist leer');
    const png = await check('bild.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    expect(png.verdict.headline).toBe('Diese Dateiart prüft das Tool nicht');
  });
});

describe('schema check (step 2b)', () => {
  const COMMA = (text: string) =>
    text.replace(
      '<cbc:PayableAmount currencyID="EUR">336.9</cbc:PayableAmount>',
      '<cbc:PayableAmount currencyID="EUR">336,90</cbc:PayableAmount>',
    );

  it('finds no schema problem in any official invoice file', async () => {
    const dirs = ['cen', 'kosit', 'kosit/paare'];
    const failed: string[] = [];
    let checked = 0;
    for (const dir of dirs) {
      for (const name of readdirSync(new URL(`../fixtures/offiziell/${dir}/`, import.meta.url))) {
        if (!name.endsWith('.xml')) continue;
        const { analysis } = await check(name, official(`${dir}/${name}`));
        for (const part of analysis.invoices) {
          if (part.schema?.checked) checked += 1;
          if ((part.schema?.count ?? 0) > 0) failed.push(`${dir}/${name}`);
        }
      }
    }
    expect(failed).toEqual([]);
    expect(checked).toBeGreaterThan(100);
  });

  it('reports a schema problem with its line and the statement of F4', async () => {
    const { analysis, verdict } = await check('r.xml', encode(COMMA(officialText(XR_UBL))));
    expect(analysis.invoices[0]?.schema).toMatchObject({
      schema: 'UBL 2.1 (Invoice)',
      checked: true,
    });
    expect(verdict.tone).toBe('bad');
    expect(verdict.headline).toBe('Rechnungsdaten mit Formatfehler (XRechnung 3.0)');
    expect(verdict.explanation.join(' ')).toMatch(/Technische Meldung \(Zeile \d+\):.*336,90/);
    // F24 and G-10: the German statement before the engine's message
    const statement = verdict.explanation.indexOf(TEXTS.formatError);
    const technical = verdict.explanation.findIndex((l) => l.startsWith('Technische Meldung'));
    expect(statement).toBeGreaterThan(-1);
    expect(statement).toBeLessThan(technical);
  });

  // an element the schema does not know: the data stay the same (a comma amount would not, QL-01)
  const UNKNOWN = (text: string) =>
    text.replace(
      '</cbc:CustomizationID>',
      '</cbc:CustomizationID>\n<cbc:Unbekannt>x</cbc:Unbekannt>',
    );

  it('names the attachment and judges several XML whatever their order', async () => {
    const bad = xml('b-xrechnung.xml', UNKNOWN(officialText(XR_UBL)));
    const good = xml('a-xrechnung.xml', officialText(XR_UBL));
    for (const attachments of [
      [good, bad],
      [bad, good],
    ]) {
      const { verdict } = await check('r.pdf', miniPdf({ attachments }));
      expect(verdict.tone).toBe('bad');
      expect(verdict.headline).toBe('Rechnungsdaten mit Formatfehler (XRechnung 3.0)');
      expect(verdict.explanation.join(' ')).toContain('Der Anhang „b-xrechnung.xml“ weicht');
    }
  });

  // F28: the other Factur-X profiles against their own FeRD schema; a UBL invoice keeps UBL 2.1.
  // Not only the label: the official EN 16931 invoice carries what the smaller profiles forbid (the
  // first message names it), and a document name (`ram:Name`, allowed by CII D16B and EXTENDED, not
  // by EN16931) tells EN16931 from EXTENDED — so a profile pointed at another XSD fails here, without
  // the private FeRD samples (audit 2026-11-15, QT-02/QT-03).
  const NAMED = (text: string) =>
    text.replace(
      /(<rsm:ExchangedDocument>\s*<ram:ID>[^<]*<\/ram:ID>)/,
      '$1<ram:Name>Rechnung</ram:Name>',
    );
  // [identifier, profile, first element refused in the official file, … with a document name]
  it.each([
    ['urn:factur-x.eu:1p0:minimum', 'MINIMUM', 'IncludedNote', 'Name'],
    ['urn:factur-x.eu:1p0:basicwl', 'BASIC WL', 'IncludedSupplyChainTradeLineItem', 'Name'],
    [
      'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic',
      'BASIC',
      'SellerAssignedID',
      'Name',
    ],
    ['urn:cen.eu:en16931:2017', 'EN16931', null, 'Name'],
    ['urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended', 'EXTENDED', null, null],
  ])('checks CII with %s against its profile schema', async (id, profile, plain, named) => {
    const refused = async (text: string) => {
      const { analysis } = await check('r.xml', encode(withSpecId(text, id)));
      const schema = analysis.invoices[0]?.schema;
      expect(schema).toMatchObject({ schema: `Factur-X 1.09.2 ${profile} (FeRD)`, checked: true });
      const first = schema?.problems[0]?.message ?? '';
      return schema?.count === 0 ? null : (/^Element '\{[^}]*\}(\w+)'/.exec(first)?.[1] ?? first);
    };
    expect(await refused(CII)).toBe(plain);
    expect(await refused(NAMED(CII))).toBe(named);
  });

  it('keeps UBL 2.1 for a UBL invoice with the EN 16931 identifier', async () => {
    const { analysis } = await check('u.xml', official('cen/UBL_ubl-tc434-example1.xml'));
    expect(analysis.invoices[0]?.schema).toMatchObject({ schema: 'UBL 2.1 (Invoice)', count: 0 });
  });

  // Step 2a: Factur-X EXTENDED against its own FeRD schema; ZUGFeRD 2.0 EXTENDED has none here
  it('checks Factur-X EXTENDED against the FeRD EXTENDED schema', async () => {
    const id = 'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended';
    const { analysis, verdict } = await check('r.xml', encode(withSpecId(CII, id)));
    expect(analysis.invoices[0]?.schema).toMatchObject({
      schema: 'Factur-X 1.09.2 EXTENDED (FeRD)',
      checked: true,
      count: 0,
    });
    expect(verdict.headline).toMatch(/^E-Rechnung erkannt \(ZUGFeRD\/Factur-X, Profil EXTENDED\)/);

    const broken = withSpecId(CII, id).replace(
      '<rsm:ExchangedDocument>',
      '<rsm:ExchangedDocument>\n<ram:Unbekannt>x</ram:Unbekannt>',
    );
    const bad = await check('r.xml', encode(broken));
    expect(bad.analysis.invoices[0]?.schema?.count).toBeGreaterThan(0);
    expect(bad.verdict.headline).toBe(
      'Rechnungsdaten mit Formatfehler (ZUGFeRD/Factur-X, Profil EXTENDED)',
    );
  });

  it('leaves out ZUGFeRD 2.0 EXTENDED, whose schema the tool does not have', async () => {
    const id = 'urn:cen.eu:en16931:2017#conformant#urn:zugferd.de:2p0:extended';
    const { analysis } = await check('r.xml', encode(withSpecId(CII, id)));
    expect(analysis.invoices[0]?.schema).toMatchObject({ checked: false, count: 0 });
  });

  it('does not judge the schema of "keine E-Rechnung" (F19)', async () => {
    const minimum = COMMA(withSpecId(officialText(XR_UBL), 'urn:factur-x.eu:1p0:minimum'));
    const { verdict } = await check('r.xml', encode(minimum));
    expect(verdict.headline).toMatch(/Profil MINIMUM: keine E-Rechnung/);
    expect(verdict.explanation.join(' ')).not.toContain('Schema');
  });
});

describe('the amounts of Factur-X EXTENDED (F29)', () => {
  const EXTENDED = 'urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended';
  const LINES =
    /<ram:IncludedSupplyChainTradeLineItem>[\s\S]*?<\/ram:IncludedSupplyChainTradeLineItem>/g;
  const base = withSpecId(CII, EXTENDED);
  const line = base.match(LINES)?.[0] ?? '';
  /** The official invoice with these lines instead of its 20 */
  const withLines = (lines: string) => {
    let first = true;
    return base.replace(LINES, () => (first ? ((first = false), lines) : ''));
  };
  const amountsOf = (text: string) => {
    const read = readXml(encode(text));
    if (!read.ok) throw new Error('not read');
    try {
      const syntax = syntaxOf(rootOf(read.doc));
      if (!syntax) throw new Error('no syntax');
      const started = performance.now();
      const amounts = extendedAmounts(read.doc, syntax.namespaces);
      return { amounts, seconds: (performance.now() - started) / 1000 };
    } finally {
      read.doc.dispose();
    }
  };

  it('reads the status of each line in document order', () => {
    const status = (code: string) =>
      line.replace(
        '<ram:AssociatedDocumentLineDocument>',
        `<ram:AssociatedDocumentLineDocument><ram:LineStatusReasonCode>${code}</ram:LineStatusReasonCode>`,
      );
    const { amounts } = amountsOf(withLines(status('GROUP') + line + status('DETAIL')));
    expect(amounts.lineStatus).toEqual(['GROUP', '', 'DETAIL']);
  });

  // A positional XPath per line walked the siblings up to it every time: 20 000 lines took 15 s
  // here and froze the tab (audit 2026-11-15, QS-01); read node by node they take about 0.15 s
  it('reads 20 000 lines in linear time', () => {
    const { amounts, seconds } = amountsOf(
      withLines('<ram:IncludedSupplyChainTradeLineItem/>'.repeat(20_000)),
    );
    expect(amounts.lineStatus).toHaveLength(20_000);
    expect(seconds).toBeLessThan(3);
  });
});
