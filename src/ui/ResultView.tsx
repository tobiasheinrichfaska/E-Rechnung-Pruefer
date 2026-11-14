import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { Analysis } from '../logic/analysis';
import { checkPflichtangaben } from '../logic/check';
import { invoiceDetails } from '../logic/details';
import type { DetailRow } from '../logic/details';
import { TEXTS, fill } from '../logic/texts';
import {
  comparisonRows,
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
  /** The fixed notice, shown right under the result box (G-6) */
  notice: ReactNode;
  /** Print and copy (G-4) */
  actions?: ReactNode;
}

const OTHER_KIND: Readonly<Record<string, string>> = {
  notXml: 'keine XML',
  otherXml: 'XML, aber keine Rechnung',
  brokenXml: 'XML, fehlerhaft',
  doctypeXml: 'XML mit DOCTYPE, nicht gelesen',
  tooLargeXml: 'XML über 20 MB, nicht gelesen',
};

/** Targets of the jump links from the result box (G-1); one invoice card at most has them. */
const ANCHOR = {
  pflicht: 'pflichtangaben',
  rules: 'rechnerische-pruefung',
  schema: 'technische-meldungen',
} as const;

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

function Pflichtangaben({ invoice }: { invoice: InvoiceVerdict }) {
  const model = pflichtModel(invoice);
  const rules = rulesOf(invoice);
  if (model) {
    return (
      <>
        <PflichtangabenView result={checkPflichtangaben(model)} id={ANCHOR.pflicht} />
        {rules && <RulesView result={rules} id={ANCHOR.rules} />}
      </>
    );
  }
  return (
    <p className="muted" data-testid="no-pflicht">
      {invoice.einordnung === 'keineERechnung' ? TEXTS.noPflichtNoEInvoice : TEXTS.noModel}
    </p>
  );
}

function hasSchemaProblems(invoice: InvoiceVerdict): boolean {
  const schema = invoice.part.schema;
  return Boolean(schema && schema.count > 0 && invoice.einordnung !== 'keineERechnung');
}

/** The technical messages of the schema check, on demand (step 2b). */
function SchemaProblems({ invoice }: { invoice: InvoiceVerdict }) {
  const schema = invoice.part.schema;
  if (!schema || !hasSchemaProblems(invoice)) return null;
  return (
    <details className="schema-problems" data-testid="schema-problems" id={ANCHOR.schema}>
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

function DetailTable({ rows }: { rows: DetailRow[] }) {
  return (
    <table className="details">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** G-1: links from the result box to the sections of the (one) invoice shown below */
function JumpLinks({ invoice }: { invoice: InvoiceVerdict | undefined }) {
  if (!invoice) return null;
  const links = [
    ...(pflichtModel(invoice) ? [{ href: ANCHOR.pflicht, text: TEXTS.jumpPflicht }] : []),
    ...(rulesOf(invoice) ? [{ href: ANCHOR.rules, text: TEXTS.jumpRules }] : []),
    ...(hasSchemaProblems(invoice) ? [{ href: ANCHOR.schema, text: TEXTS.jumpSchema }] : []),
  ];
  if (links.length === 0) return null;
  return (
    <nav className="jump" aria-label={TEXTS.jumpTo} data-testid="jump-links">
      <span className="muted">{TEXTS.jumpTo}</span>{' '}
      {links.map((link, index) => (
        <span key={link.href}>
          {index > 0 && ' · '}
          <a href={`#${link.href}`}>{link.text}</a>
        </span>
      ))}
    </nav>
  );
}

/** F27/G-8: two invoice XML with different data — the compared values side by side */
function Comparison({ analysis }: { analysis: Analysis }) {
  const rows = comparisonRows(analysis.invoices);
  return (
    <div className="card">
      <h3 id="vergleich">{TEXTS.comparisonHeading}</h3>
      <table className="details comparison" aria-labelledby="vergleich" data-testid="comparison">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Angabe</span>
            </th>
            {analysis.invoices.map((part, index) => (
              <th scope="col" key={`${part.origin}-${index}`}>
                {part.origin}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row) => (
            <tr key={row.label} className={row.differs ? 'differs' : undefined}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, index) => (
                <td key={index}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

export function ResultView({ analysis, verdict, notice, actions }: Props) {
  const inPdf = analysis.kind === 'pdf';
  const comparison = verdict.comparison;
  // G-8: the same data twice is shown once; different data only as a comparison (F27)
  const shown = comparison
    ? comparison.same
      ? verdict.invoices.slice(0, 1)
      : []
    : verdict.invoices;
  const names = verdict.invoices.map((i) => `„${i.part.origin}“`).join(' und ');

  return (
    <section className="result">
      <div className={`verdict tone-${verdict.tone}`} data-testid="verdict">
        {/* focused when the result appears (App); the short announcement is App's status line */}
        <h2 data-testid="headline" tabIndex={-1}>
          {verdict.headline}
        </h2>
        {verdict.explanation.map((line, index) => (
          <Fragment key={line}>
            <p>
              <Line text={line} />
            </p>
            {/* what differs, right after the sentence that says the XML differ (F27) */}
            {index === 0 && comparison && !comparison.same && (
              <p data-testid="differing">
                {differingLine(analysis.invoices, comparison.differing)}
              </p>
            )}
          </Fragment>
        ))}
      </div>
      <JumpLinks invoice={shown[0]} />
      {notice}
      {actions}

      {comparison && !comparison.same && <Comparison analysis={analysis} />}

      {shown.map((invoice, index) => {
        const rows = invoiceDetails(invoice, inPdf);
        const technical = rows.filter((r) => r.technical);
        return (
          <div className="card" key={`${invoice.part.origin}-${index}`}>
            {comparison?.same && <h3>{fill(TEXTS.sameHeading, { names })}</h3>}
            <DetailTable rows={rows.filter((r) => !r.technical)} />
            {technical.length > 0 && (
              <details className="technical" data-testid="technical-details">
                <summary>{TEXTS.technicalDetails}</summary>
                <DetailTable rows={technical} />
              </details>
            )}
            <SchemaProblems invoice={invoice} />
            <Pflichtangaben invoice={invoice} />
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
