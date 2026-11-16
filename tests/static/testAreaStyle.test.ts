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

describe('the phone layout in the test version (src/testArea.css)', () => {
  it('is the Pflichtangaben block of app.css, rule by rule', () => {
    const original = PHONE.filter((body) => body.includes('.pflicht-table'));
    expect(original).toHaveLength(1);
    expect(COPY).toEqual(original);
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
