// The detail rows shown under the result for one invoice XML: label and display value, already
// formatted for German readers. The raw value stays visible where formatting could hide it.
import { germanDate, isoDate } from './dates';
import { formatAmount, normalize, parseDecimal } from './decimal';
import { first } from './model';
import { TEXTS, TYPE_CODES, fill } from './texts';
import { schemaFailed } from './verdict';
import type { InvoiceVerdict } from './verdict';

export interface DetailRow {
  label: string;
  value: string;
  /** G-2: shown under "Technische Angaben", closed — except a schema row with a problem */
  technical?: boolean;
}

const MISSING = '– (fehlt)';
const MISSING_SCHEMA = '– (kein Schema für dieses Format)';

function schemaDetail(invoice: InvoiceVerdict): string {
  const schema = invoice.part.schema;
  if (!schema) return MISSING_SCHEMA;
  if (!schema.checked) return fill(TEXTS.schemaNotChecked, { reason: schema.reason ?? '' });
  return schema.count === 0
    ? fill(TEXTS.schemaNone, { schema: schema.schema })
    : fill(TEXTS.schemaDetail, { schema: schema.schema, count: schema.count });
}

/**
 * The detail rows of one invoice XML. `same`: every part with these data (F27, G-8) — the row
 * „Anhänge“ names each, and a technical row in which the parts differ (e.g. the syntax of UBL and
 * CII) is shown once per part, with its name (audit R3-U-09).
 */
export function invoiceDetails(
  invoice: InvoiceVerdict,
  inPdf: boolean,
  same: readonly InvoiceVerdict[] = [invoice],
): DetailRow[] {
  const h = invoice.part.header;
  const date = first(h, 'BT-2');
  const iso = isoDate(date);
  const type = first(h, 'BT-3');
  const amount = first(h, 'BT-112');
  const parsed = parseDecimal(amount);
  const currency = first(h, 'BT-5');
  // G-2: what the client knows from the invoice first, the technical rows after it
  return [
    // an XML file's name already stands above the result ("Geprüfte Datei", audit E-08)
    ...(inPdf
      ? [
          same.length > 1
            ? {
                label: TEXTS.attachmentsRow,
                value: same.map((part) => part.part.origin).join(TEXTS.labelsAnd),
              }
            : { label: 'Anhang', value: invoice.part.origin },
        ]
      : []),
    {
      label: 'Art der Rechnung (BT-3)',
      value: type ? `${type}${TYPE_CODES[type] ? ` – ${TYPE_CODES[type]}` : ''}` : MISSING,
    },
    { label: 'Rechnungsnummer (BT-1)', value: first(h, 'BT-1') ?? MISSING },
    {
      label: 'Rechnungsdatum (BT-2)',
      value: iso ? germanDate(iso) : (date ?? MISSING),
    },
    { label: 'Lieferant (BT-27)', value: first(h, 'BT-27') ?? MISSING },
    {
      label: 'Gesamtbetrag mit Umsatzsteuer (BT-112)',
      // by its value, as the Pflichtangaben and rules show it: "336.900" as "336,90" (R3-U-05)
      value: parsed
        ? `${formatAmount(normalize(parsed))}${currency ? ` ${currency}` : ''}`
        : (amount ?? MISSING),
    },
    ...technicalRows(same.includes(invoice) ? same : [invoice, ...same]),
  ];
}

/** The technical rows of one part, or of every part with the same data where they differ */
function technicalRows(parts: readonly InvoiceVerdict[]): DetailRow[] {
  const rows = (part: InvoiceVerdict): DetailRow[] => [
    { label: 'Syntax', value: part.syntaxLabel, technical: true },
    {
      label: 'Spezifikation',
      value: part.profile.entry?.note
        ? `${part.specLabel} (${part.profile.entry.note})`
        : part.specLabel,
      technical: true,
    },
    { label: 'Kennung (BT-24)', value: part.profile.id ?? MISSING, technical: true },
    // a format error stays visible (G-2); "keine E-Rechnung" has none (F19, audit QL-09)
    { label: 'Schema (XSD)', value: schemaDetail(part), technical: !schemaFailed(part) },
  ];
  const each = parts.map(rows);
  const [head = []] = each;
  return head.flatMap((row, index) => {
    const values = each.map((list) => list[index]);
    if (values.every((other) => other?.value === row.value)) {
      return [{ ...row, technical: values.every((other) => other?.technical !== false) }];
    }
    return values.flatMap((other, part) =>
      other
        ? [
            {
              ...other,
              label: fill(TEXTS.ofPart, { label: row.label, name: parts[part]?.part.origin ?? '' }),
            },
          ]
        : [],
    );
  });
}
