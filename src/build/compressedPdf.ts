// A PDF built the way real Factur-X/ZUGFeRD producers write them, unlike miniPdf: the embedded XML
// FlateDecode-compressed, the dictionaries in a compressed object stream, a cross-reference stream
// with PNG predictor 12, a name tree with Kids/Limits, optionally an incremental update that adds
// the attachment in a second revision (/Prev chain). The real FeRD samples may not be
// redistributed (tests/fixtures/lokal/), so the tests in the repo use this instead (audit
// 2026-11-14, T-02). Node only (node:zlib) — tests and build, never the app.
import { deflateSync } from 'node:zlib';

const latin1 = (text: string) => Buffer.from(text, 'latin1');

function xrefStream(
  entries: { id: number; type: 0 | 1 | 2; a: number; b: number }[],
  size: number,
  extra: string,
): { dict: string; data: Buffer } {
  // /W [1 4 2], rows sorted by id, one subsection per contiguous run
  const sorted = [...entries].sort((x, y) => x.id - y.id);
  const runs: { first: number; count: number }[] = [];
  for (const e of sorted) {
    const run = runs[runs.length - 1];
    if (run && run.first + run.count === e.id) run.count += 1;
    else runs.push({ first: e.id, count: 1 });
  }
  const index = runs.flatMap((run) => [run.first, run.count]);
  const width = 7;
  const rows = sorted.map((e) => {
    const r = Buffer.alloc(width);
    r.writeUInt8(e.type, 0);
    r.writeUInt32BE(e.a, 1);
    r.writeUInt16BE(e.b, 5);
    return r;
  });
  // PNG predictor 12 (Up): each row prefixed with filter byte 2, bytes minus the row above
  const out: Buffer[] = [];
  let prev = Buffer.alloc(width);
  for (const row of rows) {
    const enc = Buffer.alloc(width + 1);
    enc[0] = 2;
    for (let i = 0; i < width; i++) enc[i + 1] = ((row[i] ?? 0) - (prev[i] ?? 0)) & 0xff;
    out.push(enc);
    prev = row;
  }
  const data = deflateSync(Buffer.concat(out));
  const dict = `<< /Type /XRef /Size ${size} /W [1 4 2] /Index [${index.join(' ')}] /Filter /FlateDecode /DecodeParms << /Columns ${width} /Predictor 12 >> /Length ${data.byteLength}${extra} >>`;
  return { dict, data };
}

export function compressedPdf(
  xml: Uint8Array,
  name: string,
  options: { incremental?: boolean } = {},
): Uint8Array {
  const chunks: Buffer[] = [];
  let offset = 0;
  const push = (b: Buffer) => {
    chunks.push(b);
    offset += b.byteLength;
  };
  push(latin1('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n'));

  const content = deflateSync(latin1('BT /F1 12 Tf 72 770 Td (Rechnung) Tj ET'));
  const file = deflateSync(Buffer.from(xml));
  const withAttachment = !options.incremental;

  // objects in the object stream (no streams allowed there)
  const inStream: Record<number, string> = {
    1: withAttachment
      ? '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 6 0 R >> /AF [5 0 R] >>'
      : '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    3: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 9 0 R /Resources << /Font << /F1 10 0 R >> >> >>',
    10: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  };
  if (withAttachment) {
    inStream[5] = `<< /Type /Filespec /F (${name}) /UF (${name}) /Desc (Factur-X) /AFRelationship /Alternative /EF << /F 4 0 R /UF 4 0 R >> >>`;
    // name tree with Kids/Limits like many producers
    inStream[6] = '<< /Kids [11 0 R] >>';
    inStream[11] = `<< /Limits [(${name}) (${name})] /Names [(${name}) 5 0 R] >>`;
  }
  const ids = Object.keys(inStream).map(Number);
  let header = '';
  let body = '';
  for (const id of ids) {
    header += `${id} ${body.length} `;
    body += `${inStream[id]}\n`;
  }
  const objStm = deflateSync(latin1(header + body));
  const entries: { id: number; type: 0 | 1 | 2; a: number; b: number }[] = [
    { id: 0, type: 0, a: 0, b: 65535 },
  ];
  ids.forEach((id, i) => entries.push({ id, type: 2, a: 7, b: i }));

  const obj = (id: number, dict: string, data: Buffer) => {
    entries.push({ id, type: 1, a: offset, b: 0 });
    push(latin1(`${id} 0 obj\n${dict}\nstream\n`));
    push(data);
    push(latin1('\nendstream\nendobj\n'));
  };
  obj(9, `<< /Length ${content.byteLength} /Filter /FlateDecode >>`, content);
  if (withAttachment) {
    obj(
      4,
      `<< /Type /EmbeddedFile /Subtype /text#2Fxml /Filter /FlateDecode /Params << /Size ${xml.byteLength} /ModDate (D:20261114120000+01'00') >> /Length ${file.byteLength} >>`,
      file,
    );
  }
  obj(
    7,
    `<< /Type /ObjStm /N ${ids.length} /First ${header.length} /Filter /FlateDecode /Length ${objStm.byteLength} >>`,
    objStm,
  );
  const size = 13;
  const xrefAt = offset;
  entries.push({ id: 8, type: 1, a: xrefAt, b: 0 });
  const id0 = '<00112233445566778899AABBCCDDEEFF>';
  const x = xrefStream(entries, size, ` /Root 1 0 R /ID [${id0} ${id0}]`);
  push(latin1(`8 0 obj\n${x.dict}\nstream\n`));
  push(x.data);
  push(latin1(`\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`));

  if (options.incremental) {
    // second revision: new catalog (obj 1 gen 0 replaced), filespec, name tree, embedded file
    const upd: { id: number; type: 0 | 1 | 2; a: number; b: number }[] = [];
    const plain = (id: number, text: string) => {
      upd.push({ id, type: 1, a: offset, b: 0 });
      push(latin1(`${id} 0 obj\n${text}\nendobj\n`));
    };
    plain(1, '<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles 6 0 R >> /AF [5 0 R] >>');
    upd.push({ id: 4, type: 1, a: offset, b: 0 });
    push(
      latin1(
        `4 0 obj\n<< /Type /EmbeddedFile /Subtype /text#2Fxml /Filter /FlateDecode /Params << /Size ${xml.byteLength} >> /Length ${file.byteLength} >>\nstream\n`,
      ),
    );
    push(file);
    push(latin1('\nendstream\nendobj\n'));
    plain(
      5,
      `<< /Type /Filespec /F (${name}) /UF (${name}) /AFRelationship /Alternative /EF << /F 4 0 R >> >>`,
    );
    plain(6, `<< /Names [(${name}) 5 0 R] >>`);
    const at = offset;
    upd.push({ id: 12, type: 1, a: at, b: 0 });
    const x2 = xrefStream(upd, size, ` /Root 1 0 R /Prev ${xrefAt} /ID [${id0} ${id0}]`);
    push(latin1(`12 0 obj\n${x2.dict}\nstream\n`));
    push(x2.data);
    push(latin1(`\nendstream\nendobj\nstartxref\n${at}\n%%EOF\n`));
  }
  return new Uint8Array(Buffer.concat(chunks));
}
