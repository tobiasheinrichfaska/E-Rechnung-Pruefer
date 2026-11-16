// The test version (`npm run build:test`, mode `testbereich`): the shared test frame of the repo
// Testumgebung (src/testrahmen/, a copy) beside the tool, two tabs on a narrow screen. It lists the
// manual tests, measures the time, takes results without free text, sends the report to the test
// zone's own address and offers „Tester einladen“ (the tool's footer no longer does). main.tsx
// calls it only in that mode; every other build resolves this module to src/testAreaStub.ts
// (vite.config.ts), so the live file carries neither the frame nor its style nor the manual tests.
// Beside the frame the tool gets two things of its own: its phone layout by its own width
// (testArea.css) and no check of a file dropped beside it (refuseDropsBeside).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { APP_NAME, APP_VERSION } from './appInfo';
import { APP_STAND } from './config';
import { forgetAccess } from './io/accessStore';
import { testBinding } from './logic/testBinding';
import { starteTestrahmen } from './testrahmen/testrahmen.js';
import './testrahmen/testrahmen.css';
// app.css here, ahead of main.tsx's import: the bundle keeps the first place of a style, and the
// copy in testArea.css must come after the rules of app.css it changes, as the original does
import './ui/app.css';
import './testArea.css';
import { App } from './ui/App';

const MANUAL_TESTS = import.meta.glob<string>('../manual_tests/[0-9][0-9]_*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * The tool takes a file dropped anywhere on the window (App, audit U-05). Beside the test frame a
 * file dropped on the test page or the tabs would be checked too, below 900 px in the hidden tool,
 * unseen and unannounced (audit R2-U-05). Outside the tool's container such a drag is refused before
 * the tool hears of it: no invitation, no check, and the browser does not open the file either.
 */
function refuseDropsBeside(tool: HTMLElement): void {
  const refuse = (event: DragEvent) => {
    if (event.target instanceof Node && tool.contains(event.target)) return;
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type !== 'drop') event.dataTransfer.dropEffect = 'none';
  };
  for (const type of ['dragenter', 'dragover', 'drop'] as const) {
    window.addEventListener(type, refuse, { capture: true });
  }
}

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
  refuseDropsBeside(frame.appBehaelter);
  const root = createRoot(frame.appBehaelter);
  show();
}
