// The prolog of an XML file: everything before the root element. E-invoices never carry a
// document type declaration; refusing one before the XML engine sees the file rules out entity
// expansion and external-entity tricks, whatever the engine's defaults are.

export type ByteEncoding = 'utf-8' | 'utf-16le' | 'utf-16be';

/** The encoding a byte-order mark announces; UTF-8 without one (the XML default). */
export function encodingByBom(bytes: Uint8Array): ByteEncoding {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  return 'utf-8';
}

/** Decodes as far as needed to read the prolog; undecodable bytes become U+FFFD. */
export function textOf(bytes: Uint8Array): string {
  return new TextDecoder(encodingByBom(bytes)).decode(bytes);
}

export type PrologScan =
  { kind: 'root'; at: number } | { kind: 'doctype'; at: number } | { kind: 'noRoot' };

/** XML name start: ASCII letter, underscore, colon or any character from U+00C0 on. */
function isNameStart(char: string): boolean {
  return /[A-Za-z_:]/.test(char) || (char.length > 0 && char.charCodeAt(0) >= 0xc0);
}

/**
 * Walks the prolog: XML declaration, processing instructions, comments and whitespace. Stops at
 * the root element, at a document type declaration, or at anything that cannot start XML.
 */
export function scanProlog(text: string): PrologScan {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (;;) {
    while (i < text.length && /\s/.test(text.charAt(i))) i += 1;
    if (i >= text.length) return { kind: 'noRoot' };
    if (text.startsWith('<?', i)) {
      const end = text.indexOf('?>', i + 2);
      if (end < 0) return { kind: 'noRoot' };
      i = end + 2;
    } else if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      if (end < 0) return { kind: 'noRoot' };
      i = end + 3;
    } else if (text.startsWith('<!DOCTYPE', i)) {
      return { kind: 'doctype', at: i };
    } else if (text.charAt(i) === '<' && isNameStart(text.charAt(i + 1))) {
      return { kind: 'root', at: i };
    } else {
      return { kind: 'noRoot' };
    }
  }
}

/** Whether the bytes start like an XML document (used to find XML among PDF attachments). */
export function looksLikeXml(bytes: Uint8Array): boolean {
  return scanProlog(textOf(bytes.subarray(0, 64 * 1024))).kind !== 'noRoot';
}

/** `<!DOCTYPE html>`, also with a public and a system identifier (XHTML), never an internal subset */
const HTML_DOCTYPE =
  /^<!DOCTYPE\s+html(?:\s+(?:PUBLIC\s+(?:"[^"]*"|'[^']*')|SYSTEM)(?:\s+(?:"[^"]*"|'[^']*'))?)?\s*>/i;
const HTML_ROOT = /^<html(?=[\s/>])/i;

/**
 * Whether the bytes are a web page: the root element is `html` (any case, without a prefix), after
 * the prolog and an HTML document type declaration. Such a file is no invoice XML and is not
 * called broken XML (audit R2-L-06) — by its content, never by its name. A declaration with an
 * internal subset, or another root after `<!DOCTYPE html>`, stays an XML with a DOCTYPE.
 */
export function looksLikeHtml(bytes: Uint8Array): boolean {
  const rest = rootAfterProlog(bytes, HTML_DOCTYPE);
  return rest !== undefined && HTML_ROOT.test(rest);
}

/**
 * The text from the root element on: after the prolog and, where there is one, a document type
 * declaration that `doctype` matches (never one with an internal subset); undefined otherwise.
 */
function rootAfterProlog(bytes: Uint8Array, doctype: RegExp): string | undefined {
  const text = textOf(bytes.subarray(0, 64 * 1024));
  const scan = scanProlog(text);
  if (scan.kind === 'noRoot') return undefined;
  const rest = text.slice(scan.at);
  if (scan.kind === 'root') return rest;
  const declaration = doctype.exec(rest);
  if (!declaration) return undefined;
  const after = scanProlog(rest.slice(declaration[0].length));
  return after.kind === 'root' ? rest.slice(declaration[0].length + after.at) : undefined;
}

/**
 * Any document type declaration without an internal subset (no „[“): a name, then a public or a
 * system identifier. The name is not read — the root element decides (audit R3-L-05).
 */
const PLAIN_DOCTYPE =
  /^<!DOCTYPE\s+[^\s[>]+(?:\s+(?:PUBLIC\s+(?:"[^"]*"|'[^']*')|SYSTEM)(?:\s+(?:"[^"]*"|'[^']*'))?)?\s*>/;
/** The complete start tag of a root `svg` without a prefix: quoted attributes, then > or /> */
const SVG_START = /^<svg((?:\s+[^\s=/>"']+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*\/?>/;
const ATTRIBUTE = /([^\s=/>"']+)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/g;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Whether the bytes are an SVG picture: the root element is `svg` in the SVG namespace, after the
 * prolog and a document type declaration without an internal subset (SVG 1.1 exports carry one).
 * Such an attachment is no invoice XML and not „nicht gelesen“, like an image (audit R3-L-05) — by
 * its root, never by the declaration's name or the file name. With an internal subset it stays an
 * XML with a DOCTYPE.
 */
export function looksLikeSvg(bytes: Uint8Array): boolean {
  const rest = rootAfterProlog(bytes, PLAIN_DOCTYPE);
  const tag = rest === undefined ? null : SVG_START.exec(rest);
  if (!tag) return false;
  return [...(tag[1] ?? '').matchAll(ATTRIBUTE)].some(
    ([, name, double, single]) => name === 'xmlns' && (double ?? single) === SVG_NAMESPACE,
  );
}
