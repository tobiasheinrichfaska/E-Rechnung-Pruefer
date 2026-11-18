import { Fragment, useId } from 'react';
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
import { Codes } from './Codes';
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
  unreadable: 'nicht lesbar',
};

/**
 * Targets of the jump links from the result box (G-1); one invoice card at most has them. The
 * schema messages of a second part take a suffix (`technische-meldungen-2`), so no id is doubled.
 */
const ANCHOR = {
  pflicht: 'pflichtangaben',
  rules: 'rechnerische-pruefung',
  schema: 'technische-meldungen',
} as const;

/**
 * A result line; the engine's English message inside it is marked as English (audit Z-04), codes
 * such as „BR-CO-15“ stay on one line (R3-U-10).
 */
export function Line({ text }: { text: string }) {
  const parts = technicalParts(text);
  if (!parts) return <Codes text={text} />;
  return (
    <>
      <Codes text={parts.prefix} />
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

/**
 * The technical messages of the schema check, on demand (step 2b); `name`: the attachment, where the
 * PDF holds several invoice XML (audit R4-U-02).
 */
function SchemaProblems({
  invoice,
  id,
  name,
}: {
  invoice: InvoiceVerdict;
  id: string;
  name?: string | undefined;
}) {
  const schema = invoice.part.schema;
  if (!schema || !hasSchemaProblems(invoice)) return null;
  return (
    <details className="schema-problems" data-testid="schema-problems" id={id}>
      <summary>
        {name === undefined
          ? fill(TEXTS.schemaProblemsTitle, { count: schema.count })
          : fill(TEXTS.schemaProblemsTitleIn, { name, count: schema.count })}
      </summary>
      <ol>
        {schema.problems.map((problem, index) => (
          <li key={index}>
            <Line text={technicalLine(problem)} />
          </li>
        ))}
      </ol>
      {schema.count > schema.problems.length && (
        <p className="muted">
          {fill(TEXTS.schemaMoreNotShown, { count: schema.count - schema.problems.length })}
        </p>
      )}
    </details>
  );
}

/**
 * One list for every part with schema messages, each named by its attachment where there are several
 * parts: the box counts the messages of every part beyond the third „below“, so each of them stands
 * here, whichever part has them and whether the data agree or not (audit R4-U-02). The first list
 * is the target of the jump link.
 */
function SchemaLists({ invoices }: { invoices: readonly InvoiceVerdict[] }) {
  const named = invoices.length > 1;
  return invoices
    .filter(hasSchemaProblems)
    .map((invoice, index) => (
      <SchemaProblems
        key={`${invoice.part.origin}-${index}`}
        invoice={invoice}
        id={index === 0 ? ANCHOR.schema : `${ANCHOR.schema}-${index + 1}`}
        name={named ? invoice.part.origin : undefined}
      />
    ));
}

function DetailTable({ rows, labelledBy }: { rows: DetailRow[]; labelledBy?: string }) {
  return (
    <table className="details" aria-labelledby={labelledBy}>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">
              <Codes text={row.label} />
            </th>
            <td>
              <Codes text={row.value} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * A browser opens a closed `<details>` for a link to something inside it, not for a link to the
 * element itself: the jump link „Technische Meldungen“ opens it before the page jumps (QU-11).
 * The schema link opens the list of every part (`technische-meldungen`, `-2`, …), since the box
 * points „below“ for the messages of any of them; the page jumps to the first (audit R5-U-01).
 */
function openTarget(id: string) {
  const same = new RegExp(`^${id}(-\\d+)?$`);
  const targets =
    id === ANCHOR.schema
      ? Array.from(document.querySelectorAll(`details[id^="${id}"]`)).filter((each) =>
          same.test(each.id),
        )
      : [document.getElementById(id)];
  for (const target of targets) {
    if (target instanceof HTMLDetailsElement) target.open = true;
  }
}

/**
 * G-1: links from the result box to the sections of the (one) invoice shown below, and to the
 * schema messages whenever any part has them (audit R4-U-02)
 */
function JumpLinks({
  invoice,
  invoices,
}: {
  invoice: InvoiceVerdict | undefined;
  invoices: readonly InvoiceVerdict[];
}) {
  const links = [
    ...(invoice && pflichtModel(invoice)
      ? [{ href: ANCHOR.pflicht, text: TEXTS.jumpPflicht }]
      : []),
    ...(invoice && rulesOf(invoice) ? [{ href: ANCHOR.rules, text: TEXTS.jumpRules }] : []),
    ...(invoices.some(hasSchemaProblems) ? [{ href: ANCHOR.schema, text: TEXTS.jumpSchema }] : []),
  ];
  if (links.length === 0) return null;
  return (
    <nav className="jump" aria-label={TEXTS.jumpTo} data-testid="jump-links">
      <span className="muted">{TEXTS.jumpTo}</span>{' '}
      {links.map((link, index) => (
        <span key={link.href}>
          {index > 0 && ' · '}
          <a href={`#${link.href}`} onClick={() => openTarget(link.href)}>
            {link.text}
          </a>
        </span>
      ))}
    </nav>
  );
}

/**
 * F27/G-8: two invoice XML with different data — the compared values side by side. Each Angabe
 * stands above its values as the header of its row group, so the values share the whole width of
 * the card: in a column of its own beside them the label took a third, and with a wider font (CI)
 * „Umsatzsteuerkategorie“ broke inside in the values at 641 px and on paper (audit R4-U-03). On a
 * phone the table becomes blocks and its column headers go out of sight, so each value names its
 * attachment there; screen readers keep the column headers and skip the name (aria-hidden, audit
 * R3-U-06), and `headers` names both headers of each value. Below it the schema messages of each
 * part (audit R4-U-02).
 */
function Comparison({
  analysis,
  invoices,
}: {
  analysis: Analysis;
  invoices: readonly InvoiceVerdict[];
}) {
  const rows = comparisonRows(analysis.invoices);
  const names = analysis.invoices.map((part) => part.origin);
  return (
    <div className="card">
      <h3 id="vergleich">{TEXTS.comparisonHeading}</h3>
      <table className="details comparison" aria-labelledby="vergleich" data-testid="comparison">
        <thead>
          <tr>
            {analysis.invoices.map((part, index) => (
              <th scope="col" id={`vergleich-teil-${index}`} key={`${part.origin}-${index}`}>
                {part.origin}
              </th>
            ))}
          </tr>
        </thead>
        {rows.slice(1).map((row, rowIndex) => (
          <tbody key={row.label} className={row.differs ? 'differs' : undefined}>
            <tr>
              <th scope="rowgroup" colSpan={names.length} id={`vergleich-angabe-${rowIndex}`}>
                <Codes text={row.label} />
              </th>
            </tr>
            <tr>
              {row.values.map((value, index) => (
                <td key={index} headers={`vergleich-angabe-${rowIndex} vergleich-teil-${index}`}>
                  <span className="part-name" aria-hidden="true">
                    {names[index]}:{' '}
                  </span>
                  <Codes text={value} />
                </td>
              ))}
            </tr>
          </tbody>
        ))}
      </table>
      <SchemaLists invoices={invoices} />
    </div>
  );
}

/**
 * One invoice XML: its data under a heading that also names their table, so a screen reader can
 * jump there from the result box (audit QU-13); the same data twice keep their one heading (G-8).
 */
function InvoiceCard({
  invoice,
  inPdf,
  heading,
  same,
}: {
  invoice: InvoiceVerdict;
  inPdf: boolean;
  heading: string;
  /** G-8: every part with these data, named in its rows (audit R3-U-09) */
  same?: readonly InvoiceVerdict[] | undefined;
}) {
  const headingId = useId();
  const rows = invoiceDetails(invoice, inPdf, same);
  const technical = rows.filter((r) => r.technical);
  return (
    <div className="card">
      <h3 id={headingId}>{heading}</h3>
      <DetailTable rows={rows.filter((r) => !r.technical)} labelledBy={headingId} />
      {technical.length > 0 && (
        <details className="technical" data-testid="technical-details">
          <summary>{TEXTS.technicalDetails}</summary>
          <DetailTable rows={technical} />
        </details>
      )}
      <SchemaLists invoices={same ?? [invoice]} />
      <Pflichtangaben invoice={invoice} />
    </div>
  );
}

/** Every attachment that is no invoice XML, also those pdf.js could not read (audit QL-06) */
function attachmentsOf(analysis: Analysis): { origin: string; kind: string }[] {
  return [
    ...analysis.others,
    ...(analysis.pdf?.unreadable ?? []).map((origin) => ({ origin, kind: 'unreadable' })),
  ];
}

/** The PDF's only attachment is the one the result already names (e.g. a broken XML, audit E-08) */
function onlyNamedAbove(analysis: Analysis, verdict: Verdict): boolean {
  const [only, ...more] = attachmentsOf(analysis);
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
                <Codes text={differingLine(analysis.invoices, comparison.differing)} />
              </p>
            )}
          </Fragment>
        ))}
      </div>
      <JumpLinks invoice={shown[0]} invoices={verdict.invoices} />
      {notice}
      {actions}

      {comparison && !comparison.same && (
        <Comparison analysis={analysis} invoices={verdict.invoices} />
      )}

      {shown.map((invoice, index) => (
        <InvoiceCard
          key={`${invoice.part.origin}-${index}`}
          invoice={invoice}
          inPdf={inPdf}
          heading={comparison?.same ? fill(TEXTS.sameHeading, { names }) : TEXTS.invoiceDataHeading}
          same={comparison?.same ? verdict.invoices : undefined}
        />
      ))}

      {inPdf && attachmentsOf(analysis).length > 0 && !onlyNamedAbove(analysis, verdict) && (
        <div className="card">
          <h3>{analysis.invoices.length > 0 ? 'Weitere Anhänge im PDF' : 'Anhänge im PDF'}</h3>
          <ul>
            {attachmentsOf(analysis).map((other) => (
              <li key={other.origin}>
                {other.origin} – {OTHER_KIND[other.kind] ?? other.kind}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
