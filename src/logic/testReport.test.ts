import {
  freshState,
  buildReport,
  chooseOutcome,
  clock,
  leaveTest,
  openTest,
  REASONS,
  REPORT_APP,
  reportProblems,
  resetOutcome,
  secondsOf,
  setStepReason,
  type Report,
  type Run,
} from './testReport';

const IDS = ['MT-01', 'MT-02', 'MT-03'];
const at = (run: Run, id: string) => run[id] ?? freshState();
const S = 1000;

describe('the time of a test (measured, never typed)', () => {
  it('runs while the test is open, pauses when it is left, goes on when it is opened again', () => {
    let run: Run = openTest({}, 'MT-01', 0);
    run = leaveTest(run, 'MT-01', 30 * S);
    expect(secondsOf(at(run, 'MT-01'), 500 * S)).toBe(30);
    run = openTest(run, 'MT-01', 600 * S);
    expect(secondsOf(at(run, 'MT-01'), 610 * S)).toBe(40);
  });

  it('stops when a result is chosen; opening the test again does not start it', () => {
    let run: Run = openTest({}, 'MT-01', 0);
    run = chooseOutcome(run, 'MT-01', 'bestanden', 184 * S);
    run = openTest(leaveTest(run, 'MT-01', 200 * S), 'MT-01', 300 * S);
    expect(secondsOf(at(run, 'MT-01'), 900 * S)).toBe(184);
    // changing the result keeps the stopped time
    run = chooseOutcome(run, 'MT-01', 'nicht bestanden', 950 * S);
    expect(secondsOf(at(run, 'MT-01'), 990 * S)).toBe(184);
  });

  it('counts on from the stopped time when the result is taken back', () => {
    let run: Run = chooseOutcome(openTest({}, 'MT-02', 0), 'MT-02', 'bestanden', 10 * S);
    run = resetOutcome(run, 'MT-02', 100 * S, true);
    expect(run['MT-02']?.outcome).toBe('nicht getestet');
    expect(secondsOf(at(run, 'MT-02'), 105 * S)).toBe(15);
  });

  it('rounds to whole seconds and caps at one day', () => {
    const run = openTest({}, 'MT-01', 0);
    expect(secondsOf(at(run, 'MT-01'), 1499)).toBe(1);
    expect(secondsOf(at(run, 'MT-01'), 3 * 86_400 * S)).toBe(86_400);
  });

  it('shows minutes and hours', () => {
    expect([clock(5), clock(184), clock(3723)]).toEqual(['0:05', '3:04', '1:02:03']);
  });
});

describe('the report (format testbericht/1, no free text)', () => {
  const failedRun = () => {
    let run: Run = chooseOutcome(openTest({}, 'MT-01', 0), 'MT-01', 'bestanden', 184 * S);
    run = chooseOutcome(openTest(run, 'MT-02', 200 * S), 'MT-02', 'nicht bestanden', 295 * S);
    run = setStepReason(run, 'MT-02', 6, 'anderes-ergebnis');
    run = setStepReason(run, 'MT-02', 4, 'fehlermeldung');
    return run;
  };

  it('lists every test in catalogue order, untouched ones as „nicht getestet“ without seconds', () => {
    const report = buildReport(failedRun(), IDS, '0.8.0', 'd4ce28b', 400 * S);
    expect(report).toEqual({
      format: 'testbericht/1',
      app: REPORT_APP,
      version: '0.8.0',
      stand: 'd4ce28b',
      tests: [
        { id: 'MT-01', ergebnis: 'bestanden', sekunden: 184 },
        {
          id: 'MT-02',
          ergebnis: 'nicht bestanden',
          sekunden: 95,
          schritte: [
            { nr: 4, grund: 'fehlermeldung' },
            { nr: 6, grund: 'anderes-ergebnis' },
          ],
        },
        { id: 'MT-03', ergebnis: 'nicht getestet' },
      ],
    } satisfies Report);
    expect(reportProblems(report)).toEqual([]);
  });

  it('carries only the fields of the format, never a text of the tester', () => {
    const report = buildReport(failedRun(), IDS, '0.8.0', 'd4ce28b', 400 * S);
    expect(Object.keys(report).sort()).toEqual(['app', 'format', 'stand', 'tests', 'version']);
    const keys = new Set(report.tests.flatMap((test) => Object.keys(test)));
    expect([...keys].sort()).toEqual(['ergebnis', 'id', 'schritte', 'sekunden']);
    const reasons: readonly string[] = REASONS.map((reason) => reason.key);
    for (const test of report.tests) {
      if (test.ergebnis === 'nicht bestanden') {
        for (const step of test.schritte) expect(reasons).toContain(step.grund);
      }
    }
  });

  it('clearing a step takes it out; choosing „bestanden“ drops the steps', () => {
    let run = setStepReason(failedRun(), 'MT-02', 4, undefined);
    expect(Object.keys(at(run, 'MT-02').failed)).toEqual(['6']);
    run = chooseOutcome(run, 'MT-02', 'bestanden', 500 * S);
    expect(at(run, 'MT-02').failed).toEqual({});
  });

  it('names what the login script would refuse', () => {
    const run = chooseOutcome(openTest({}, 'MT-02', 0), 'MT-02', 'nicht bestanden', 5 * S);
    expect(reportProblems(buildReport(run, IDS, '0.8.0', 'd4ce28b', 9 * S))).toEqual([
      'MT-02: Bitte wählen Sie mindestens einen Schritt mit Problem und seinen Grund.',
    ]);
    expect(reportProblems(buildReport({}, IDS, '0.8', 'xyz', 0))).toEqual([
      'Die Version „0.8“ passt nicht.',
      'Der Stand „xyz“ passt nicht.',
    ]);
    expect(
      reportProblems(buildReport({}, ['MT-1', 'MT-01', 'MT-01'], '1.0.0', 'abcdef0', 0)),
    ).toEqual(['Die Nummer „MT-1“ passt nicht.', 'MT-01 steht doppelt im Bericht.']);
    expect(reportProblems(buildReport({}, [], '1.0.0', 'abcdef0', 0))).toEqual([
      'Der Bericht braucht 1 bis 300 Tests.',
    ]);
  });

  it('keeps the five reasons of the spec', () => {
    expect(REASONS.map((reason) => reason.key)).toEqual([
      'anderes-ergebnis',
      'fehlermeldung',
      'fehlt',
      'haengt',
      'darstellung',
    ]);
  });
});
