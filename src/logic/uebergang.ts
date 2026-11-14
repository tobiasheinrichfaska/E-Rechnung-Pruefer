// The transition rules of § 27 Abs. 38 UStG as data and a pure function (F26, Tobias 2026-11-14):
// which sentence a format error or a "keine E-Rechnung" with readable data gets, by the date the
// supply was carried out and the invoice date. Hints only — the tool never decides the tax case.
//
//   Nr. 1: invoice by 31.12.2026 for a supply in 2025/2026 → a "sonstige Rechnung" is allowed
//   Nr. 2: invoice by 31.12.2027 for a supply in 2027 → allowed if the supplier's Gesamtumsatz of
//          2026 was at most 800.000 Euro (or EDI, Nr. 3)
//   otherwise (supply 2026 invoiced from 2027, supply 2027 invoiced from 2028, supply from 2028)
//          → an E-Rechnung is needed
//
// Supply date (F26): the actual delivery date (BT-72); else the end of the invoicing period
// (BT-74); else the latest end of the line periods (BT-135). Where several of these lead to
// different sentences, no date is assumed (hint + general sentence). The invoice date never stands
// in for the supply date (F15).
//
// Before 2025 (F30, Tobias 2026-11-14): changes of the UStG apply to supplies carried out from
// their entry into force (§ 27 Abs. 1 Satz 1 UStG), so the E-Rechnung rules of 01.01.2025 do not
// reach older supplies — "Für Umsätze, die vor dem 1. Januar 2025 ausgeführt worden sind, gilt
// keine Verpflichtung zur Verwendung einer E-Rechnung" (BMF 15.10.2024 Rn. 50, unchanged by the
// letters of 15.10.2025 and 15.10.2026), whatever the invoice date.
import { isoDate } from './dates';
import { valuesOf } from './model';
import type { InvoiceModel } from './model';

export type Regime = 'vor2025' | 'zulaessig' | 'nur800k' | 'pflicht' | 'unbekannt';

/** Why no regime could be found although dates exist */
export type Conflict = 'lieferungUndZeitraum' | 'positionen';

export interface Transition {
  regime: Regime;
  conflict?: Conflict;
}

const END_2026 = '2026-12-31';
const END_2027 = '2027-12-31';
const START_2025 = '2025-01-01';

/** The regime for one supply date and the invoice date (both ISO). */
export function regimeOf(supply: string, invoice: string | undefined): Regime {
  if (supply < START_2025) return 'vor2025';
  if (supply <= END_2026) {
    if (invoice === undefined) return 'unbekannt';
    return invoice <= END_2026 ? 'zulaessig' : 'pflicht';
  }
  if (supply <= END_2027) {
    if (invoice === undefined) return 'unbekannt';
    return invoice <= END_2027 ? 'nur800k' : 'pflicht';
  }
  return 'pflicht';
}

const dates = (model: InvoiceModel, path: string): string[] =>
  valuesOf(model, path)
    .map((v) => isoDate(v.value))
    .filter((d): d is string => d !== undefined);

/** All candidates lead to one regime, or none is assumed. */
function agreed(regimes: Regime[], conflict: Conflict): Transition {
  const [first, ...rest] = regimes;
  if (first === undefined) return { regime: 'unbekannt' };
  return rest.every((r) => r === first) ? { regime: first } : { regime: 'unbekannt', conflict };
}

/** Which transition sentence an invoice gets (F26). */
export function transitionOf(model: InvoiceModel): Transition {
  const invoice = dates(model, 'BT-2')[0];
  const delivery = dates(model, 'BG-13/BT-72')[0];
  const periodEnd = dates(model, 'BG-14/BT-74')[0];
  const candidates = [delivery, periodEnd].filter((d): d is string => d !== undefined);
  if (candidates.length > 0) {
    return agreed(
      candidates.map((d) => regimeOf(d, invoice)),
      'lieferungUndZeitraum',
    );
  }
  const lineEnds = dates(model, 'BG-25/BG-26/BT-135');
  return agreed(
    lineEnds.map((d) => regimeOf(d, invoice)),
    'positionen',
  );
}

/** Several invoice XML of one PDF: one regime only where all parts agree. */
export function commonTransition(transitions: readonly Transition[]): Transition {
  const [first, ...rest] = transitions;
  if (!first) return { regime: 'unbekannt' };
  if (first.regime !== 'unbekannt' && rest.every((t) => t.regime === first.regime)) return first;
  const conflict = transitions.find((t) => t.conflict)?.conflict;
  return { regime: 'unbekannt', ...(conflict ? { conflict } : {}) };
}
