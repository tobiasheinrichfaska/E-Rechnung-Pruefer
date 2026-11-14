import { useId } from 'react';
import { sentence } from '../logic/check';
import type { GroupDisplay, PflichtResult, RowResult, Status } from '../logic/check';
import { TEXTS, fill } from '../logic/texts';

const STATUS_TEXT: Readonly<Record<Status, string>> = {
  vorhanden: TEXTS.statusVorhanden,
  fehlt: TEXTS.statusFehlt,
  einzelfall: TEXTS.statusEinzelfall,
};

function GroupValues({ display }: { display: GroupDisplay }) {
  if (display.items.length === 0) return null;
  if (display.group === 'BG-25') {
    return (
      <details className="positions">
        <summary>{fill(TEXTS.showPositions, { count: display.items.length })}</summary>
        <ol>
          {display.items.map((items, index) => (
            <li key={index}>{items.map((v) => `${v.label}: ${v.value}`).join(' · ')}</li>
          ))}
        </ol>
      </details>
    );
  }
  return (
    <ul className="occurrences">
      {display.items.map((items, index) => (
        <li key={index}>{items.map((v) => `${v.label}: ${v.value}`).join(' · ')}</li>
      ))}
    </ul>
  );
}

function Row({ result }: { result: RowResult }) {
  const hasValues = result.values.length > 0 || result.groups.some((g) => g.items.length > 0);
  return (
    <tr data-testid={`pflicht-${result.row.id}`} className={`status-${result.status}`}>
      {/* A row header: a screen reader names the Angabe with its status (audit 2026-11-14, U-13) */}
      <th scope="row">
        {result.row.label}
        <br />
        <small className="norm">{result.row.norm}</small>
      </th>
      <td>
        {result.values.map((v, i) => (
          <div key={i}>
            <span className="value-label">{v.label}:</span> {v.value}
          </div>
        ))}
        {result.groups.map((g) => (
          <GroupValues key={g.group} display={g} />
        ))}
        {!hasValues && <span className="muted">{TEXTS.notInXml}</span>}
        {result.missing.length > 0 && (
          <div className="missing">
            {sentence(fill(TEXTS.missingList, { list: result.missing.join('; ') }))}
          </div>
        )}
        {result.reason && <div className="muted">{result.reason}</div>}
        {result.hints.map((hint) => (
          <div key={hint} className="row-hint" data-testid="row-hint">
            {hint}
          </div>
        ))}
      </td>
      <td>
        <span className={`badge badge-${result.status}`} data-testid="status">
          {STATUS_TEXT[result.status]}
        </span>
      </td>
    </tr>
  );
}

function RowsTable({ rows, labelledBy }: { rows: RowResult[]; labelledBy: string }) {
  return (
    <table className="pflicht-table" aria-labelledby={labelledBy}>
      <thead>
        <tr>
          <th scope="col">Angabe</th>
          <th scope="col">Werte aus der XML</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Row key={r.row.id} result={r} />
        ))}
      </tbody>
    </table>
  );
}

/** G-1: a row "nur im Einzelfall nötig" without a value and without a hint is folded */
function folded(row: RowResult): boolean {
  const hasValues = row.values.length > 0 || row.groups.some((g) => g.items.length > 0);
  return row.status === 'einzelfall' && !hasValues && row.hints.length === 0;
}

/** The rows of one table; the folded ones in a closed list below them (G-1). */
function Rows({ rows, labelledBy }: { rows: RowResult[]; labelledBy: string }) {
  const open = rows.filter((r) => !folded(r));
  const closed = rows.filter(folded);
  return (
    <>
      {open.length > 0 && <RowsTable rows={open} labelledBy={labelledBy} />}
      {closed.length > 0 && (
        <details className="folded" data-testid="folded-rows">
          <summary>
            {closed.length === 1
              ? TEXTS.foldedRow
              : fill(TEXTS.foldedRows, { count: closed.length })}
          </summary>
          <RowsTable rows={closed} labelledBy={labelledBy} />
        </details>
      )}
    </>
  );
}

/** `id`: the target of the jump link from the result box (G-1). */
export function PflichtangabenView({ result, id }: { result: PflichtResult; id?: string }) {
  const main = result.rows.filter((r) => r.row.section === 'paragraph14');
  const special = result.rows.filter((r) => r.row.section === 'besondere');
  const headingId = useId();
  const specialId = useId();
  return (
    <section className="pflicht" aria-labelledby={headingId} id={id}>
      <h3 id={headingId}>{TEXTS.pflichtHeading}</h3>
      {result.modeText && <p className="mode">{result.modeText}</p>}
      <p
        className={`summary ${
          result.missingLabels.length > 0
            ? 'summary-missing'
            : result.hintCount > 0
              ? 'summary-warn'
              : 'summary-ok'
        }`}
        data-testid="pflicht-summary"
      >
        {result.summary}
      </p>
      <Rows rows={main} labelledBy={headingId} />
      {special.length > 0 && (
        <>
          <h4 id={specialId}>{TEXTS.besondereHeading}</h4>
          <Rows rows={special} labelledBy={specialId} />
        </>
      )}
    </section>
  );
}
