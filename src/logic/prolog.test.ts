import {
  encodingByBom,
  looksLikeHtml,
  looksLikeSvg,
  looksLikeXml,
  scanProlog,
  textOf,
} from './prolog';

const bytes = (text: string) => new TextEncoder().encode(text);
const BOM = String.fromCharCode(0xfeff);

describe('scanProlog', () => {
  it('finds the root after declaration, comments and processing instructions', () => {
    const text = `${BOM}<?xml version="1.0"?>\n<!-- c -->\n<?pi x?>\n  <rsm:Invoice/>`;
    expect(scanProlog(text)).toEqual({ kind: 'root', at: text.indexOf('<rsm:') });
  });

  it('stops at a document type declaration', () => {
    expect(scanProlog('<?xml version="1.0"?><!DOCTYPE a []><a/>').kind).toBe('doctype');
    expect(scanProlog('<!-- x --><!DOCTYPE a><a/>').kind).toBe('doctype');
  });

  it('ignores the word DOCTYPE inside a comment', () => {
    expect(scanProlog('<!-- <!DOCTYPE a> --><a/>').kind).toBe('root');
  });

  it('finds no root in text, binary data, unclosed comments or an empty file', () => {
    expect(scanProlog('%PDF-1.7').kind).toBe('noRoot');
    expect(scanProlog('').kind).toBe('noRoot');
    expect(scanProlog('<!-- never closed').kind).toBe('noRoot');
    expect(scanProlog('<?xml version="1.0"').kind).toBe('noRoot');
    expect(scanProlog('< a/>').kind).toBe('noRoot');
  });
});

describe('encodings', () => {
  it('reads byte-order marks', () => {
    expect(encodingByBom(new Uint8Array([0xff, 0xfe, 0x3c, 0x00]))).toBe('utf-16le');
    expect(encodingByBom(new Uint8Array([0xfe, 0xff, 0x00, 0x3c]))).toBe('utf-16be');
    expect(encodingByBom(bytes('<a/>'))).toBe('utf-8');
  });

  it('finds the root of a UTF-16 document', () => {
    const utf16 = new Uint8Array([0xff, 0xfe, ...[...'<a/>'].flatMap((c) => [c.charCodeAt(0), 0])]);
    expect(scanProlog(textOf(utf16)).kind).toBe('root');
  });
});

describe('looksLikeXml', () => {
  it('tells XML from other attachments by content, not by name', () => {
    expect(looksLikeXml(bytes('<?xml version="1.0" encoding="UTF-8"?><x/>'))).toBe(true);
    expect(looksLikeXml(bytes('%PDF-1.4'))).toBe(false);
    expect(looksLikeXml(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
});

// Audit R2-L-06: a web page is no XML the tool reads — by its root element, never by its name
describe('looksLikeHtml', () => {
  it('knows a web page by its root element html, after the prolog and an HTML DOCTYPE', () => {
    for (const page of [
      '<html><body><p>Unsere AGB<br></p></body></html>',
      '<HTML lang="de"><body>AGB</body></HTML>',
      '<!DOCTYPE html>\n<html lang="de"><head><title>AGB</title></head></html>',
      '<?xml version="1.0"?>\n<!-- AGB -->\n<html xmlns="http://www.w3.org/1999/xhtml"/>',
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" ' +
        '"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n<html xmlns="http://www.w3.org/1999/xhtml"></html>',
      '<!DOCTYPE html SYSTEM "about:legacy-compat"><html></html>',
    ]) {
      expect(looksLikeHtml(bytes(page)), page).toBe(true);
    }
  });

  it('keeps every other root, a prefix, an internal subset or another root after the DOCTYPE', () => {
    for (const other of [
      '<rsm:CrossIndustryInvoice xmlns:rsm="urn:x"/>',
      '<htmlx/>',
      '<h:html xmlns:h="http://www.w3.org/1999/xhtml"/>',
      '<!DOCTYPE html [<!ENTITY x "y">]><html>&x;</html>',
      '<!DOCTYPE html><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"/>',
      '<!DOCTYPE invoice><invoice/>',
      'Lieferschein',
    ]) {
      expect(looksLikeHtml(bytes(other)), other).toBe(false);
    }
  });
});

// Audit R3-L-05: an SVG picture is no XML the tool reads — by its root element and namespace, after a
// document type declaration without an internal subset; never by the declaration's name
describe('looksLikeSvg', () => {
  const NS = 'xmlns="http://www.w3.org/2000/svg"';
  const SVG11 =
    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';

  it('knows an SVG by its root svg in the SVG namespace, also after a plain DOCTYPE', () => {
    for (const picture of [
      `<svg ${NS}/>`,
      `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Logo -->\n<svg ${NS} width="10"><g/></svg>`,
      `<?xml version="1.0"?>${SVG11}<svg ${NS}/>`,
      `${SVG11}\n<!-- Logo -->\n<svg version="1.1" ${NS}\n  viewBox='0 0 10 10'><rect/></svg>`,
      `<!DOCTYPE svg SYSTEM "svg11.dtd"><svg xmlns='http://www.w3.org/2000/svg'></svg>`,
      // the declaration's name is not read: the root decides
      `<!DOCTYPE logo SYSTEM "x.dtd"><svg ${NS}/>`,
    ]) {
      expect(looksLikeSvg(bytes(picture)), picture).toBe(true);
    }
  });

  it('keeps an internal subset, another root, another namespace or a prefix', () => {
    for (const other of [
      `<!DOCTYPE svg [<!ENTITY ns "http://www.w3.org/2000/svg">]><svg ${NS}/>`,
      `${SVG11.replace('>', ' [<!ENTITY x "y">]>')}<svg ${NS}/>`,
      `${SVG11}<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"/>`,
      '<svg/>',
      '<svg xmlns="urn:example"/>',
      '<s:svg xmlns:s="http://www.w3.org/2000/svg"/>',
      `<svgx ${NS}/>`,
      `<svg ${NS}`,
      '<html><body/></html>',
      'Logo',
    ]) {
      expect(looksLikeSvg(bytes(other)), other).toBe(false);
    }
  });
});
