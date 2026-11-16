// The test version (`npm run build:test`, mode `testbereich`): the shared test frame of the repo
// Testumgebung (src/testrahmen/, a copy) beside the tool, two tabs on a narrow screen. It lists the
// manual tests, measures the time, takes results without free text, sends the report to the test
// zone's own address and offers „Tester einladen“. main.tsx loads this module only in that mode;
// every other build resolves it to src/testAreaStub.ts (vite.config.ts), so the live file carries
// neither the frame nor its style nor the manual tests.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { APP_NAME, APP_VERSION } from './appInfo';
import { APP_STAND } from './config';
import { forgetAccess } from './io/accessStore';
import { testBinding } from './logic/testBinding';
import { starteTestrahmen } from './testrahmen/testrahmen.js';
import './testrahmen/testrahmen.css';
import { App } from './ui/App';

const MANUAL_TESTS = import.meta.glob<string>('../manual_tests/[0-9][0-9]_*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Puts the frame on the page and mounts the tool inside it instead of into #root. */
export function startTestArea(): void {
  // A new key starts the tool afresh: nothing checked before is left, the notice is read again
  let run = 0;
  const show = () =>
    root.render(
      <StrictMode>
        <App key={run} />
      </StrictMode>,
    );
  const restart = () => {
    run += 1;
    show();
  };
  const frame = starteTestrahmen(
    document.body,
    testBinding({
      name: APP_NAME,
      version: APP_VERSION,
      // Without a commit the frame says so on top and sends no report
      stand: APP_STAND ?? '',
      manualTests: MANUAL_TESTS,
      restart,
      // Only the tool's own key: the frame's results and every other app's data stay
      reset: () => {
        forgetAccess();
        restart();
      },
    }),
  );
  document.getElementById('root')?.remove();
  const root = createRoot(frame.appBehaelter);
  show();
}
