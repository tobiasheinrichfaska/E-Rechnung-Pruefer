// G-4: the result as plain text, to paste into a mail to the Kanzlei — file, time of the check,
// the result with its lines (and, as on the page, what differs between two invoice XML), the
// summaries of the sections (with the reduced list of § 33 / § 34a UStDV), the fixed notice and the
// version (audit QU-07). A mail has no „unten“: pointers to parts of the page are left out (R3-U-08).
import { PAGE_POINTERS, TEXTS, fill } from './texts';
import type { Verdict } from './verdict';

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** „Bitte beachten Sie den Hinweis unten.“ and its plural, with the space in front of them */
const HINTS_BELOW = new RegExp(
  ` (?:${[TEXTS.hintBelow, TEXTS.hintsBelow]
    .map((text) => escaped(text).replace(escaped('{count}'), '\\d+'))
    .join('|')})`,
  'g',
);

/** A line of the page without its pointers to other parts of the page (PAGE_POINTERS). */
export function withoutPointers(line: string): string {
  return PAGE_POINTERS.reduce(
    (text, pointer) => text.split(pointer).join(''),
    line.replace(HINTS_BELOW, ''),
  );
}

export interface ResultTextInput {
  fileName: string;
  date: string;
  time: string;
  verdict: Verdict;
  /** F27: what differs between two invoice XML ("Unterschiedlich: …"), after the first line */
  differing?: string | undefined;
  /** The reduced list that applies (Kleinbetrag, Kleinunternehmer), before the Pflichtangaben */
  mode?: string | undefined;
  /** Summary sentence of the Pflichtangaben (absent where none are shown) */
  pflicht?: string | undefined;
  /** Summary sentence of the calculation check (absent where it is not shown) */
  rules?: string | undefined;
  notice: string;
  version: string;
}

export function resultText(input: ResultTextInput): string {
  const [first, ...rest] = input.verdict.explanation.map(withoutPointers);
  return [
    TEXTS.copyTitle,
    fill(TEXTS.checkedFile, { name: input.fileName, date: input.date, time: input.time }),
    '',
    fill(TEXTS.copyHeadline, { headline: input.verdict.headline }),
    ...(first !== undefined ? [first] : []),
    ...(input.differing ? [input.differing] : []),
    ...rest,
    ...(input.pflicht
      ? [
          '',
          ...(input.mode ? [input.mode] : []),
          fill(TEXTS.copyPflicht, { summary: withoutPointers(input.pflicht) }),
        ]
      : []),
    ...(input.rules ? [fill(TEXTS.copyRules, { summary: withoutPointers(input.rules) })] : []),
    '',
    input.notice,
    fill(TEXTS.copyVersion, { version: input.version }),
  ].join('\n');
}
