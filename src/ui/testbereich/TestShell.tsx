// The test version (`npm run build:test`, Tobias 2026-11-15): the tool with the test page beside it;
// on a narrow screen two tabs. The tool stays mounted while the instructions are shown, so nothing
// checked in it is lost. The page measures the time of each test itself and sends a report without
// free text to the login script of the test zone (spec: repo Testumgebung, docs/testbericht.md).
import { useEffect, useState, type ReactNode } from 'react';
import { APP_VERSION } from '../../appInfo';
import { APP_STAND } from '../../config';
import { sendReport } from '../../io/testReportSend';
import {
  buildReport,
  chooseOutcome,
  leaveTest,
  openTest,
  reportProblems,
  resetOutcome,
  setStepReason,
  type ReasonKey,
  type Run,
} from '../../logic/testReport';
import { TESTS } from './catalogue';
import { TestPanel, type SendState } from './TestPanel';

const IDS = TESTS.map((test) => test.id);

export function TestShell({ children }: { children: ReactNode }) {
  const [run, setRun] = useState<Run>({});
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const [view, setView] = useState<'test' | 'app'>('test');
  const [now, setNow] = useState(() => Date.now());
  const [send, setSend] = useState<SendState>({ kind: 'idle' });

  // The shown time of the open test moves on every second
  const running = openId !== undefined && run[openId]?.since !== undefined;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const update = (change: (run: Run, at: number) => Run) => {
    const at = Date.now();
    setNow(at);
    setRun((current) => change(current, at));
    setSend({ kind: 'idle' });
  };

  const open = (id: string) => {
    update((current, at) => openTest(openId ? leaveTest(current, openId, at) : current, id, at));
    setOpenId(id);
  };
  const back = () => {
    if (openId) update((current, at) => leaveTest(current, openId, at));
    setOpenId(undefined);
  };

  const report = buildReport(run, IDS, APP_VERSION, APP_STAND ?? '', now);
  const problems = reportProblems(report);

  const submit = async () => {
    const at = Date.now();
    setNow(at);
    const toSend = buildReport(run, IDS, APP_VERSION, APP_STAND ?? '', at);
    if (reportProblems(toSend).length > 0) return;
    setSend({ kind: 'sending' });
    const result = await sendReport(toSend);
    setSend(result.ok ? { kind: 'sent' } : { kind: 'failed', message: result.message });
  };

  return (
    <div className="test-shell">
      <div className="test-tabs">
        <button type="button" aria-pressed={view === 'test'} onClick={() => setView('test')}>
          Testanleitung
        </button>
        <button type="button" aria-pressed={view === 'app'} onClick={() => setView('app')}>
          Tool
        </button>
      </div>
      <div className={`test-app${view === 'app' ? ' active' : ''}`}>{children}</div>
      <aside
        className={`test-panel${view === 'test' ? ' active' : ''}`}
        aria-labelledby="test-panel-title"
      >
        <TestPanel
          tests={TESTS}
          run={run}
          openId={openId}
          now={now}
          problems={problems}
          send={send}
          onOpen={open}
          onBack={back}
          onChoose={(outcome) =>
            openId && update((current, at) => chooseOutcome(current, openId, outcome, at))
          }
          onReset={() => openId && update((current, at) => resetOutcome(current, openId, at, true))}
          onStep={(nr: number, reason: ReasonKey | undefined) =>
            openId && update((current) => setStepReason(current, openId, nr, reason))
          }
          onSend={() => void submit()}
        />
      </aside>
    </div>
  );
}
