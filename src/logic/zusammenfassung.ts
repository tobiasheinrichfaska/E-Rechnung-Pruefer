// G-4: the result as plain text, to paste into a mail to the Kanzlei — file, time of the check,
// the result with its lines, the summaries of the sections, the fixed notice and the version.
import { TEXTS, fill } from './texts';
import type { Verdict } from './verdict';

export interface ResultTextInput {
  fileName: string;
  date: string;
  time: string;
  verdict: Verdict;
  /** Summary sentence of the Pflichtangaben (absent where none are shown) */
  pflicht?: string | undefined;
  /** Summary sentence of the calculation check (absent where it is not shown) */
  rules?: string | undefined;
  notice: string;
  version: string;
}

export function resultText(input: ResultTextInput): string {
  return [
    TEXTS.copyTitle,
    fill(TEXTS.checkedFile, { name: input.fileName, date: input.date, time: input.time }),
    '',
    fill(TEXTS.copyHeadline, { headline: input.verdict.headline }),
    ...input.verdict.explanation,
    ...(input.pflicht ? ['', fill(TEXTS.copyPflicht, { summary: input.pflicht })] : []),
    ...(input.rules ? [fill(TEXTS.copyRules, { summary: input.rules })] : []),
    '',
    input.notice,
    fill(TEXTS.copyVersion, { version: input.version }),
  ].join('\n');
}
