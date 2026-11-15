// The manual tests (manual_tests/0X_*.md) as data for the test page of the test version (Kanzlei PC
// session, Tobias 2026-11-15; spec: repo Testumgebung, docs/testbericht.md). One case per
// "## MT-xx: Titel"; "**Voraussetzung:** …" as its precondition; the numbered steps with the
// expectation under them ("   - **Danach:** …"). The step numbers are those of the file — a report
// names a failed step by them. Inline Markdown stays in the strings; inlineParts() splits it for a
// renderer that never uses HTML.

export interface TestStep {
  /** The number written in the file ("3." → 3). */
  nr: number;
  text: string;
  /** The "Danach:" lines under the step. */
  expected: string[];
}

export interface ManualTest {
  id: string;
  title: string;
  /** The file's heading without its number, e.g. "Echte Programme und Geräte". */
  area: string;
  source: string;
  prerequisite?: string;
  /** Other paragraphs of the case, in order. */
  notes: string[];
  steps: TestStep[];
}

const CASE = /^## (MT-\d{2,3}(?:-\d{2})?[a-z]?): (.+)$/;
const PREREQUISITE = /^\*\*Voraussetzung:\*\*\s*(.*)$/;
const STEP = /^(\d{1,2})\.\s+(.*)$/;
const EXPECTED = /^\s+[-*]\s+\*\*Danach:\*\*\s*(.*)$/;

/** All cases of one file, in file order. */
export function parseManualTests(markdown: string, source: string): ManualTest[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const heading = lines.find((line) => line.startsWith('# ')) ?? '';
  const area = heading.replace(/^#\s+(\d+\s*[–-]\s*)?/, '').trim();
  const tests: ManualTest[] = [];
  let current: ManualTest | undefined;
  // What the next continuation line belongs to
  let target: { kind: 'para'; index: number } | { kind: 'step' } | { kind: 'expected' } | undefined;
  let paragraph: string[] | undefined;
  let isPrerequisite = false;

  const closeParagraph = () => {
    if (current && paragraph && paragraph.length > 0) {
      const text = paragraph.join(' ');
      if (isPrerequisite) current.prerequisite = text;
      else current.notes.push(text);
    }
    paragraph = undefined;
    isPrerequisite = false;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const start = CASE.exec(line);
    if (start) {
      closeParagraph();
      current = {
        id: start[1] ?? '',
        title: start[2]?.trim() ?? '',
        area,
        source,
        notes: [],
        steps: [],
      };
      tests.push(current);
      target = undefined;
      continue;
    }
    if (!current) continue;
    if (line.startsWith('#')) {
      // a heading after the cases ends the last one
      closeParagraph();
      current = undefined;
      continue;
    }
    if (line.trim() === '') {
      closeParagraph();
      if (target?.kind !== 'step' && target?.kind !== 'expected') target = undefined;
      continue;
    }
    const step = STEP.exec(line);
    if (step) {
      closeParagraph();
      current.steps.push({ nr: Number(step[1]), text: step[2]?.trim() ?? '', expected: [] });
      target = { kind: 'step' };
      continue;
    }
    const expected = EXPECTED.exec(line);
    const last = current.steps[current.steps.length - 1];
    if (expected && last) {
      last.expected.push(expected[1]?.trim() ?? '');
      target = { kind: 'expected' };
      continue;
    }
    if (/^\s+\S/.test(line) && last && (target?.kind === 'step' || target?.kind === 'expected')) {
      if (target.kind === 'expected' && last.expected.length > 0) {
        last.expected[last.expected.length - 1] += ` ${line.trim()}`;
      } else last.text += ` ${line.trim()}`;
      continue;
    }
    // a paragraph (the precondition or a note)
    target = undefined;
    if (!paragraph) {
      const pre = PREREQUISITE.exec(line);
      paragraph = [];
      isPrerequisite = pre !== null;
      paragraph.push((pre ? pre[1] : line)?.trim() ?? '');
    } else paragraph.push(line.trim());
  }
  closeParagraph();
  return tests;
}

export type InlinePart =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'code'; text: string };

/** **bold**, `code` and [text](link) — a link keeps only its text (no address on the page). */
export function inlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\([^)]*\)/g;
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    if (index > at) parts.push({ kind: 'text', text: text.slice(at, index) });
    if (match[1] !== undefined) parts.push({ kind: 'strong', text: match[1] });
    else if (match[2] !== undefined) parts.push({ kind: 'code', text: match[2] });
    else parts.push({ kind: 'text', text: match[3] ?? '' });
    at = index + match[0].length;
  }
  if (at < text.length) parts.push({ kind: 'text', text: text.slice(at) });
  return parts;
}
