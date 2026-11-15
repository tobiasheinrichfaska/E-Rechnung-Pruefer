// The test page beside the tool: the list of manual tests, one test with its steps, the result
// („Bestanden“ / „Nicht bestanden“ with the failed steps and a reason each from the fixed list) and
// „Bericht senden“. No text field anywhere (Tobias 2026-11-15, Testumgebung docs/testbericht.md).
import { Fragment, useState } from 'react';
import { inlineParts, type ManualTest } from '../../logic/manualTests';
import {
  clock,
  freshState,
  REASONS,
  secondsOf,
  type Outcome,
  type ReasonKey,
  type Run,
} from '../../logic/testReport';

export type SendState =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'failed'; message: string };

interface Props {
  tests: readonly ManualTest[];
  run: Run;
  openId: string | undefined;
  now: number;
  problems: readonly string[];
  send: SendState;
  /** false when the browser refuses to keep the run (private window, blocked storage) */
  kept: boolean;
  onStartAnew: () => void;
  onOpen: (id: string) => void;
  onBack: () => void;
  onChoose: (outcome: 'bestanden' | 'nicht bestanden') => void;
  onReset: () => void;
  onStep: (nr: number, reason: ReasonKey | undefined) => void;
  onSend: () => void;
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  bestanden: 'Bestanden',
  'nicht bestanden': 'Nicht bestanden',
  'nicht getestet': 'Nicht getestet',
};
const OUTCOME_CLASS: Record<Outcome, string> = {
  bestanden: 'badge-vorhanden',
  'nicht bestanden': 'badge-fehlt',
  'nicht getestet': 'badge-einzelfall',
};

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((part, index) =>
        part.kind === 'strong' ? (
          <strong key={index}>{part.text}</strong>
        ) : part.kind === 'code' ? (
          <code key={index}>{part.text}</code>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

export function TestPanel(props: Props) {
  const { tests, run, openId, now } = props;
  const test = tests.find((candidate) => candidate.id === openId);
  const counts = { bestanden: 0, 'nicht bestanden': 0, 'nicht getestet': 0 };
  for (const { id } of tests) counts[(run[id] ?? freshState()).outcome] += 1;

  return (
    <div className="test-panel-inner">
      <h2 id="test-panel-title">Testbereich</h2>
      {test ? (
        <OpenTest {...props} test={test} />
      ) : (
        <>
          <p>
            Wählen Sie einen Test. Die Zeit läuft, solange der Test offen ist, und endet, wenn Sie
            ein Ergebnis wählen.
          </p>
          <p className="test-hint">
            {props.kept
              ? 'Ihre Ergebnisse bleiben in diesem Browser gespeichert, bis Sie den Bericht senden oder neu beginnen.'
              : 'Dieser Browser speichert nichts: Die Ergebnisse bleiben nur, bis Sie die Seite neu laden. Senden Sie den Bericht vorher.'}
          </p>
          <ul className="test-list">
            {tests.map(({ id, title }) => {
              const state = run[id] ?? freshState();
              return (
                <li key={id}>
                  <button type="button" onClick={() => props.onOpen(id)}>
                    {id}: {title}
                  </button>
                  <span className={`badge ${OUTCOME_CLASS[state.outcome]}`}>
                    {OUTCOME_LABEL[state.outcome]}
                  </span>
                  {state.outcome !== 'nicht getestet' && (
                    <span className="test-time">{clock(secondsOf(state, now))}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <section className="test-send" aria-labelledby="test-send-title">
        <h3 id="test-send-title">Bericht</h3>
        <p>
          {counts.bestanden} bestanden · {counts['nicht bestanden']} nicht bestanden ·{' '}
          {counts['nicht getestet']} nicht getestet
        </p>
        {props.problems.length > 0 && (
          <ul className="test-problems">
            {props.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="primary"
          disabled={props.problems.length > 0 || props.send.kind === 'sending'}
          onClick={props.onSend}
        >
          Bericht senden
        </button>
        <p className="test-send-status" role="status">
          {props.send.kind === 'sending' && 'Der Bericht wird gesendet …'}
          {props.send.kind === 'sent' &&
            'Bericht gesendet. Die Ergebnisse sind gelöscht, Sie können neu beginnen.'}
          {props.send.kind === 'failed' && props.send.message}
        </p>
        <StartAnew
          touched={counts['nicht getestet'] < tests.length}
          onStartAnew={props.onStartAnew}
        />
      </section>
    </div>
  );
}

/** „Neu beginnen“ deletes every result of this browser — asked once more before it does. */
function StartAnew({ touched, onStartAnew }: { touched: boolean; onStartAnew: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!touched) return null;
  return asking ? (
    <p className="test-anew">
      Alle Ergebnisse in diesem Browser löschen?{' '}
      <button
        type="button"
        className="test-reset"
        onClick={() => {
          setAsking(false);
          onStartAnew();
        }}
      >
        Ja, löschen
      </button>{' '}
      <button type="button" className="test-reset" onClick={() => setAsking(false)}>
        Abbrechen
      </button>
    </p>
  ) : (
    <p className="test-anew">
      <button type="button" className="test-reset" onClick={() => setAsking(true)}>
        Neu beginnen
      </button>
    </p>
  );
}

function OpenTest(props: Props & { test: ManualTest }) {
  const { test, run, now } = props;
  const state = run[test.id] ?? freshState();
  const seconds = secondsOf(state, now);
  const failedNone = state.outcome === 'nicht bestanden' && Object.keys(state.failed).length === 0;
  return (
    <div className="test-open">
      <button type="button" className="test-back" onClick={props.onBack}>
        ← Zurück zur Liste
      </button>
      <h3>
        {test.id}: {test.title}
      </h3>
      <p className="test-area">{test.area}</p>
      <p className="test-time" aria-live="off">
        Zeit: {clock(seconds)}
        {state.stopped ? ' (beendet)' : state.since !== undefined ? ' (läuft)' : ''}
      </p>
      {test.prerequisite && (
        <p>
          <strong>Voraussetzung:</strong> <Inline text={test.prerequisite} />
        </p>
      )}
      {test.notes.map((note) => (
        <p key={note}>
          <Inline text={note} />
        </p>
      ))}
      <ol className="test-steps">
        {test.steps.map((step) => (
          <li key={step.nr} value={step.nr}>
            <Inline text={step.text} />
            {step.expected.map((expected) => (
              <p key={expected} className="test-expected">
                <strong>Danach:</strong> <Inline text={expected} />
              </p>
            ))}
          </li>
        ))}
      </ol>
      <fieldset className="test-outcome">
        <legend>Ergebnis</legend>
        <label>
          <input
            type="radio"
            name={`ergebnis-${test.id}`}
            checked={state.outcome === 'bestanden'}
            onChange={() => props.onChoose('bestanden')}
          />{' '}
          Bestanden
        </label>
        <label>
          <input
            type="radio"
            name={`ergebnis-${test.id}`}
            checked={state.outcome === 'nicht bestanden'}
            onChange={() => props.onChoose('nicht bestanden')}
          />{' '}
          Nicht bestanden
        </label>
      </fieldset>
      {state.outcome === 'nicht bestanden' && (
        <fieldset className="test-failed">
          <legend>Schritte mit Problem</legend>
          {failedNone && (
            <p className="test-hint">Wählen Sie mindestens einen Schritt und seinen Grund.</p>
          )}
          {test.steps.map((step) => (
            <label key={step.nr} className="test-step-reason">
              Schritt {step.nr}{' '}
              <select
                value={state.failed[step.nr] ?? ''}
                onChange={(event) =>
                  props.onStep(
                    step.nr,
                    event.target.value === '' ? undefined : (event.target.value as ReasonKey),
                  )
                }
              >
                <option value="">kein Problem</option>
                {REASONS.map((reason) => (
                  <option key={reason.key} value={reason.key}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      )}
      {state.outcome !== 'nicht getestet' && (
        <button type="button" className="test-reset" onClick={props.onReset}>
          Ergebnis zurücknehmen
        </button>
      )}
    </div>
  );
}
