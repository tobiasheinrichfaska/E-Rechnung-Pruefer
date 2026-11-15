// The tester's run on the test page and the report it sends (Kanzlei PC session, Tobias 2026-11-15;
// spec: repo Testumgebung, docs/testbericht.md, format „testbericht/1“). No free text anywhere: per
// test the result, the measured seconds and, for a failed test, the failed steps each with one
// reason from a fixed list. The time is measured here, never typed: it runs while a test is open,
// pauses when the tester leaves it and stops when a result is chosen. The run lives in memory only
// (storing it needs Tobias' OK, CLAUDE.md „Storage“).

export const REPORT_FORMAT = 'testbericht/1';
/** The app of the test area (`app` in Testumgebung's zugang/bereiche.json). */
export const REPORT_APP = 'erechnung';
/** Where the login script of the test zone takes the report (relative to the zone). */
export const REPORT_ADDRESS = '/_zugang/bericht';
export const REPORT_MAX_BYTES = 64 * 1024;
export const MAX_SECONDS = 86_400;

export const REASONS = [
  { key: 'anderes-ergebnis', label: 'Anderes Ergebnis als erwartet' },
  { key: 'fehlermeldung', label: 'Fehlermeldung' },
  { key: 'fehlt', label: 'Knopf oder Text fehlt' },
  { key: 'haengt', label: 'Lädt nicht oder hängt' },
  { key: 'darstellung', label: 'Darstellung falsch' },
] as const;

export type ReasonKey = (typeof REASONS)[number]['key'];
export type Outcome = 'bestanden' | 'nicht bestanden' | 'nicht getestet';

export interface TestState {
  /** Milliseconds counted so far (closed periods). */
  ms: number;
  /** Since when the open test is counting (absent while left or stopped). */
  since?: number;
  outcome: Outcome;
  /** A chosen result stops the time for good. */
  stopped: boolean;
  /** Failed steps (only for „nicht bestanden“): step number → reason. */
  failed: Readonly<Record<number, ReasonKey>>;
}

export type Run = Readonly<Record<string, TestState>>;

export const freshState = (): TestState => ({
  ms: 0,
  outcome: 'nicht getestet',
  stopped: false,
  failed: {},
});

const stateOf = (run: Run, id: string): TestState => run[id] ?? freshState();

/** The state with its running period closed at `now`. */
function paused(state: TestState, now: number): TestState {
  if (state.since === undefined) return state;
  const { since, ...rest } = state;
  return { ...rest, ms: rest.ms + Math.max(0, now - since) };
}

/** Opening a test starts (or continues) its time, unless a result has stopped it. */
export function openTest(run: Run, id: string, now: number): Run {
  const state = stateOf(run, id);
  if (state.stopped || state.since !== undefined) return run;
  return { ...run, [id]: { ...state, since: now } };
}

/** Leaving a test pauses its time. */
export function leaveTest(run: Run, id: string, now: number): Run {
  const state = run[id];
  return state ? { ...run, [id]: paused(state, now) } : run;
}

/** Choosing „bestanden“ or „nicht bestanden“ stops the time. */
export function chooseOutcome(
  run: Run,
  id: string,
  outcome: 'bestanden' | 'nicht bestanden',
  now: number,
): Run {
  const state = paused(stateOf(run, id), now);
  return {
    ...run,
    [id]: { ...state, outcome, stopped: true, failed: outcome === 'bestanden' ? {} : state.failed },
  };
}

/** Takes the result back: the test counts as „nicht getestet“ again and, if open, counts on. */
export function resetOutcome(run: Run, id: string, now: number, open: boolean): Run {
  const state = paused(stateOf(run, id), now);
  const next: TestState = { ...state, outcome: 'nicht getestet', stopped: false, failed: {} };
  return { ...run, [id]: open ? { ...next, since: now } : next };
}

/** Marks a step of a failed test with a reason, or clears it (`undefined`). */
export function setStepReason(
  run: Run,
  id: string,
  nr: number,
  reason: ReasonKey | undefined,
): Run {
  const state = stateOf(run, id);
  const failed = Object.fromEntries(
    Object.entries(state.failed).filter(([step]) => Number(step) !== nr),
  ) as Record<number, ReasonKey>;
  if (reason !== undefined) failed[nr] = reason;
  return { ...run, [id]: { ...state, failed } };
}

/** The whole seconds of a test at `now` (the open period included), at most one day. */
export function secondsOf(state: TestState, now: number): number {
  const ms = paused(state, now).ms;
  return Math.min(MAX_SECONDS, Math.max(0, Math.round(ms / 1000)));
}

/** The shown time: 0:05, 3:04, 1:02:03. */
export function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

export interface ReportStep {
  nr: number;
  grund: ReasonKey;
}

export type ReportTest =
  | { id: string; ergebnis: 'bestanden'; sekunden: number }
  | { id: string; ergebnis: 'nicht bestanden'; sekunden: number; schritte: ReportStep[] }
  | { id: string; ergebnis: 'nicht getestet' };

export interface Report {
  format: typeof REPORT_FORMAT;
  app: string;
  version: string;
  stand: string;
  tests: ReportTest[];
}

/** The report of a run: every test of the catalogue, in its order; untouched ones „nicht getestet“. */
export function buildReport(
  run: Run,
  ids: readonly string[],
  version: string,
  stand: string,
  now: number,
): Report {
  const tests = ids.map((id): ReportTest => {
    const state = stateOf(run, id);
    const sekunden = secondsOf(state, now);
    if (state.outcome === 'bestanden') return { id, ergebnis: 'bestanden', sekunden };
    if (state.outcome === 'nicht bestanden') {
      const schritte = Object.entries(state.failed)
        .map(([nr, grund]) => ({ nr: Number(nr), grund }))
        .sort((a, b) => a.nr - b.nr);
      return { id, ergebnis: 'nicht bestanden', sekunden, schritte };
    }
    return { id, ergebnis: 'nicht getestet' };
  });
  return { format: REPORT_FORMAT, app: REPORT_APP, version, stand, tests };
}

const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const STAND = /^[0-9a-f]{7,40}$/;
const TEST_ID = /^MT-\d{2,3}(-\d{2})?[a-z]?$/;
const REASON_KEYS: ReadonlySet<string> = new Set(REASONS.map((reason) => reason.key));

/**
 * What the login script would refuse, in German — the same rules as Testumgebung's check, so the
 * page says it before sending. Empty when the report is fine.
 */
export function reportProblems(report: Report): string[] {
  const problems: string[] = [];
  if (!VERSION.test(report.version)) problems.push(`Die Version „${report.version}“ passt nicht.`);
  if (!STAND.test(report.stand)) problems.push(`Der Stand „${report.stand}“ passt nicht.`);
  if (report.tests.length < 1 || report.tests.length > 300) {
    problems.push('Der Bericht braucht 1 bis 300 Tests.');
  }
  const seen = new Set<string>();
  for (const test of report.tests) {
    if (!TEST_ID.test(test.id)) problems.push(`Die Nummer „${test.id}“ passt nicht.`);
    if (seen.has(test.id)) problems.push(`${test.id} steht doppelt im Bericht.`);
    seen.add(test.id);
    if (test.ergebnis === 'nicht getestet') continue;
    if (!Number.isInteger(test.sekunden) || test.sekunden < 0 || test.sekunden > MAX_SECONDS) {
      problems.push(`${test.id}: Die Zeit passt nicht.`);
    }
    if (test.ergebnis === 'nicht bestanden') {
      if (test.schritte.length === 0) {
        problems.push(
          `${test.id}: Bitte wählen Sie mindestens einen Schritt mit Problem und seinen Grund.`,
        );
      }
      const steps = new Set<number>();
      for (const step of test.schritte) {
        if (!Number.isInteger(step.nr) || step.nr < 1 || step.nr > 99 || steps.has(step.nr)) {
          problems.push(`${test.id}: Schritt ${step.nr} passt nicht.`);
        }
        if (!REASON_KEYS.has(step.grund)) problems.push(`${test.id}: Unbekannter Grund.`);
        steps.add(step.nr);
      }
    }
  }
  const bytes = new TextEncoder().encode(JSON.stringify(report)).length;
  if (bytes > REPORT_MAX_BYTES) problems.push('Der Bericht ist größer als 64 KB.');
  return problems;
}
