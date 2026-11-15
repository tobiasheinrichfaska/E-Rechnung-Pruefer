// G-4: the result as plain text, to paste into a mail to the Kanzlei — file, time of the check,
// the result with its lines (and, as on the page, what differs between two invoice XML), the
// summaries of the sections (with the reduced list of § 33 / § 34a UStDV), the fixed notice and the
// version (audit QU-07).
import { TEXTS, fill } from './texts';
import type { Verdict } from './verdict';

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
  const [first, ...rest] = input.verdict.explanation;
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
          fill(TEXTS.copyPflicht, { summary: input.pflicht }),
        ]
      : []),
    ...(input.rules ? [fill(TEXTS.copyRules, { summary: input.rules })] : []),
    '',
    input.notice,
    fill(TEXTS.copyVersion, { version: input.version }),
  ].join('\n');
}
