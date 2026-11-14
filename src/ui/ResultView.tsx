import { useId } from 'react';
import type { Analysis } from '../logic/analysis';
import { checkPflichtangaben } from '../logic/check';
import { invoiceDetails } from '../logic/details';
import { TEXTS, fill } from '../logic/texts';
import {
  differingLine,
  pflichtModel,
  rulesOf,
  technicalLine,
  technicalParts,
} from '../logic/verdict';
import type { InvoiceVerdict, Verdict } from '../logic/verdict';
import { PflichtangabenView } from './PflichtangabenView';
import { RulesView } from './RulesView';

interface Props {
  analysis: Analysis;
  verdict: Verdict;
}

const OTHER_KIND: Readonly<Record<string, string>> = {
  notXml: 'keine XML',
  otherXml: 'XML, aber keine Rechnung',
  brokenXml: 'XML, fehlerhaft',
  doctypeXml: 'XML mit DOCTYPE, nicht gelesen',
  tooLargeXml: 'XML über 20 MB, nicht gelesen',
};

function Pflichtangaben({
  invoice,
  contextId,
}: {
  invoice: InvoiceVerdict;
  contextId: string | undefined;
}) {
  const model = pflichtModel(invoice);
  const rules = rulesOf(invoice);
  if (model) {
    return (
      <>
        <PflichtangabenView result={checkPflichtangaben(model)} contextId={contextId} />
        {rules && <RulesView result={rules} contextId={contextId} />}
      </>
    );
  }
  return (
    <p className="muted" data-testid="no-pflicht">
      {invoice.einordnung === 'keineERechnung' ? TEXTS.noPflichtNoEInvoice : TEXTS.noModel}
    </p>
  );
}

/** A result line; the engine's English message inside it is marked as English (audit Z-04). */
function Line({ text }: { text: string }) {
  const parts = technicalParts(text);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.prefix}
      <span lang="en">{parts.message}</span>
    </>
  );
}

/** The technical messages of the schema check, on demand (step 2b). */
function SchemaProblems({ invoice }: { invoice: InvoiceVerdict }) {
  const schema = invoice.part.schema;
  if (!schema || schema.count === 0 || invoice.einordnung === 'keineERechnung') return null;
  return (
    <details className="schema-problems" data-testid="schema-problems">
      <summary>{fill(TEXTS.schemaProblemsTitle, { count: schema.count })}</summary>
      <ol>
        {schema.problems.map((problem, index) => (
          <li key={index}>
            <Line text={technicalLine(problem)} />
          </li>
        ))}
      </ol>
      {schema.count > schema.problems.length && (
        <p className="muted">
          {fill(TEXTS.schemaMore, { count: schema.count - schema.problems.length })}
        </p>
      )}
    </details>
  );
}

/** The PDF's only attachment is the one the result already names (e.g. a broken XML, audit E-08) */
function onlyNamedAbove(analysis: Analysis, verdict: Verdict): boolean {
  const [only, ...more] = analysis.others;
  return (
    analysis.invoices.length === 0 &&
    only !== undefined &&
    more.length === 0 &&
    verdict.explanation.some((line) => line.includes(`„${only.origin}“`))
  );
}

export function ResultView({ analysis, verdict }: Props) {
  const inPdf = analysis.kind === 'pdf';
  const baseId = useId();

  return (
    <section className="result">
      <div className={`verdict tone-${verdict.tone}`} data-testid="verdict">
        {/* focused when the result appears (App); the short announcement is App's status line */}
        <h2 data-testid="headline" tabIndex={-1}>
          {verdict.headline}
        </h2>
        {verdict.explanation.map((line) => (
          <p key={line}>
            <Line text={line} />
          </p>
        ))}
        {verdict.comparison && !verdict.comparison.same && (
          <p data-testid="differing">
            {differingLine(analysis.invoices, verdict.comparison.differing)}
          </p>
        )}
      </div>

      {verdict.invoices.map((invoice, index) => {
        const several = verdict.invoices.length > 1;
        const contextId = several ? `${baseId}-rechnungsdaten-${index + 1}` : undefined;
        return (
          <div className="card" key={`${invoice.part.origin}-${index}`}>
            {several && (
              <h3 id={contextId}>
                {fill(TEXTS.partHeading, {
                  index: index + 1,
                  count: verdict.invoices.length,
                  name: invoice.part.origin,
                })}
              </h3>
            )}
            <table className="details">
              <tbody>
                {invoiceDetails(invoice, inPdf).map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <SchemaProblems invoice={invoice} />
            <Pflichtangaben invoice={invoice} contextId={contextId} />
          </div>
        );
      })}

      {inPdf && analysis.others.length > 0 && !onlyNamedAbove(analysis, verdict) && (
        <div className="card">
          <h3>{analysis.invoices.length > 0 ? 'Weitere Anhänge im PDF' : 'Anhänge im PDF'}</h3>
          <ul>
            {analysis.others.map((other) => (
              <li key={other.origin}>
                {other.origin} – {OTHER_KIND[other.kind] ?? other.kind}
              </li>
            ))}
          </ul>
        </div>
      )}
      {analysis.pdf?.truncated && <p className="hint">{TEXTS.attachmentsTruncated}</p>}
    </section>
  );
}
