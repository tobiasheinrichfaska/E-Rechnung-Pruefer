import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The test version puts the tool beside the shared test frame, which from a window of 900 px leaves
// it 460–640 px (audit R2-U-01). The phone layout of the Pflichtangaben (src/ui/app.css,
// `@media (max-width: 640px)`, by the window) is copied into src/testArea.css as a container query
// on the frame's `.tr-app`, so there it follows the tool's own width. The copy must not drift.

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

/** The bodies of the blocks that open with `prelude {`, without comments, spaces folded. */
function blocks(css: string, prelude: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found: string[] = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(`${prelude} {`, from);
    if (start < 0) return found;
    const open = start + prelude.length + 1;
    let depth = 0;
    let end = open;
    for (; end < text.length; end += 1) {
      if (text[end] === '{') depth += 1;
      if (text[end] === '}') depth -= 1;
      if (depth === 0) break;
    }
    found.push(
      text
        .slice(open + 1, end)
        .replace(/\s+/g, ' ')
        .trim(),
    );
    from = end;
  }
}

const APP_CSS = read('src/ui/app.css');
const TEST_CSS = read('src/testArea.css');
const PHONE = blocks(APP_CSS, '@media (max-width: 640px)');
const COPY = blocks(TEST_CSS, '@container werkzeug (max-width: 640px)');

/**
 * The phone blocks of app.css the copy leaves out, each with its reason; every other one must be
 * copied. A new phone block is red here until it is copied or named (audit R3-T-08: only the block
 * with `.pflicht-table` was compared, so a new block for another table would have stayed narrow
 * beside the test page, the fault of R2-U-01).
 */
const LEFT_OUT: readonly { marker: string; reason: string }[] = [
  { marker: '.title-wide', reason: 'beside the test page the tool runs on a computer' },
];
const leftOut = (body: string) => LEFT_OUT.some(({ marker }) => body.includes(marker));

describe('the phone layout in the test version (src/testArea.css)', () => {
  it('is every phone block of app.css but the ones left out, in the same order, rule by rule', () => {
    const copied = PHONE.filter((body) => !leftOut(body));
    expect(copied.length).toBeGreaterThan(0);
    expect(COPY).toEqual(copied);
    // the Pflichtangaben and the comparison of several XML among them (R2-U-01, R3-U-06)
    expect(COPY.some((body) => body.includes('.pflicht-table'))).toBe(true);
    expect(COPY.some((body) => body.includes('.comparison .part-name'))).toBe(true);
  });

  it('names a reason for every block it leaves out, and each is still in app.css', () => {
    for (const { marker, reason } of LEFT_OUT) {
      expect(reason).not.toBe('');
      expect(PHONE.filter((body) => body.includes(marker))).toHaveLength(1);
    }
  });

  it('turns red for a new phone block of app.css that is not copied', () => {
    const grown = blocks(
      `${APP_CSS}\n@media (max-width: 640px) {\n  .neue-tabelle td {\n    display: block;\n  }\n}\n`,
      '@media (max-width: 640px)',
    ).filter((body) => !leftOut(body));
    expect(COPY).not.toEqual(grown);
  });

  it('leaves out the title block: beside the test page the tool runs on a computer', () => {
    expect(PHONE.some((body) => body.includes('.title-wide'))).toBe(true);
    expect(TEST_CSS).not.toContain('.title-wide');
    expect(TEST_CSS).not.toContain('@media (max-width: 640px)');
  });

  it('asks the width of the frame’s tool container, which the live build does not have', () => {
    expect(TEST_CSS).toMatch(/\.tr-app\s*\{\s*container:\s*werkzeug\s*\/\s*inline-size;\s*\}/);
    expect(APP_CSS).not.toContain('@container');
  });

  it('comes after app.css, as the original stands after the rules it changes', () => {
    const start = read('src/testArea.tsx');
    const original = start.indexOf("import './ui/app.css';");
    const copy = start.indexOf("import './testArea.css';");
    expect(original).toBeGreaterThan(start.indexOf("import './testrahmen/testrahmen.css';"));
    expect(copy).toBeGreaterThan(original);
    // only the test version's start imports the copy
    expect(read('src/main.tsx')).not.toContain('testArea.css');
  });
});
