import { useEffect, useRef, useState } from 'react';
import { APP_NAME, APP_VERSION } from '../appInfo';
import { APP_CONFIG } from '../config';
import { loadAccess, saveAccess } from '../io/accessStore';
import { MAX_FILE_BYTES, analyzeFile, tooLargeFile, unreadableFile } from '../io/analyze';
import { loadPdfJs } from '../io/pdfjs';
import { accessGateNeeded, accessToken } from '../logic/accessGate';
import type { Analysis } from '../logic/analysis';
import { checkPflichtangaben } from '../logic/check';
import { germanMoment } from '../logic/dates';
import { TEXTS, fill } from '../logic/texts';
import { pflichtModel, rulesOf, verdictOf, xmlCounts } from '../logic/verdict';
import { resultText } from '../logic/zusammenfassung';
import type { Verdict } from '../logic/verdict';
import { AccessGate } from './AccessGate';
import { DropZone } from './DropZone';
import { Footer } from './Footer';
import { ResultView } from './ResultView';

/** The one short sentence a screen reader announces (never the whole result). */
function announcement(state: State): string {
  switch (state.step) {
    case 'idle':
      return '';
    case 'checking':
      return fill(TEXTS.announceChecking, { name: state.fileName });
    case 'done':
      return fill(TEXTS.announceResult, { headline: state.verdict.headline });
    case 'failed':
      return TEXTS.announceFailed;
  }
}

/** G-6: "Maßgeblich … XML" only where there is a picture to compare with: a PDF */
function noticeText(state: State): string {
  return state.step === 'done' && state.analysis.kind === 'pdf' && xmlCounts(state.verdict)
    ? TEXTS.fixedNotice
    : TEXTS.fixedNoticeGeneral;
}

type Done = Extract<State, { step: 'done' }>;

/** G-4: the result as text for a mail to the Kanzlei */
function textOf(state: Done): string {
  const [first] = state.verdict.comparison?.same === false ? [] : state.verdict.invoices;
  const model = first ? pflichtModel(first) : undefined;
  return resultText({
    fileName: state.analysis.fileName,
    ...germanMoment(state.checkedAt),
    verdict: state.verdict,
    pflicht: model ? checkPflichtangaben(model).summary : undefined,
    rules: first ? rulesOf(first)?.summary : undefined,
    notice: noticeText(state),
    version: APP_VERSION,
  });
}

/** Into the clipboard; where the Clipboard API is missing or refused, the classic way. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'visually-hidden';
    document.body.append(area);
    area.select();
    const done = document.execCommand('copy');
    area.remove();
    return done;
  }
}

type State =
  | { step: 'idle' }
  | { step: 'checking'; fileName: string }
  | { step: 'done'; analysis: Analysis; verdict: Verdict; checkedAt: Date; count: number }
  | { step: 'failed'; fileName: string; message: string };

/**
 * The hosted copy first asks the access notice of the local configuration (Tobias 2026-11-15);
 * without a notice, on file:// or once it is remembered, the tool opens at once.
 */
export function App() {
  const notice = APP_CONFIG.accessNotice;
  const [gateOpen, setGateOpen] = useState(() =>
    accessGateNeeded({ notice, protocol: location.protocol, remembered: loadAccess }),
  );

  // While the notice is open nothing of the tool runs; a file dropped on the page must not make
  // the browser leave it and open the file either
  useEffect(() => {
    if (!gateOpen) return;
    const refuse = (event: DragEvent) => event.preventDefault();
    window.addEventListener('dragover', refuse);
    window.addEventListener('drop', refuse);
    return () => {
      window.removeEventListener('dragover', refuse);
      window.removeEventListener('drop', refuse);
    };
  }, [gateOpen]);

  if (gateOpen && notice !== undefined) {
    return (
      <main className="page">
        <h1>{APP_NAME}</h1>
        <AccessGate
          notice={notice}
          onConfirm={(remember) => {
            if (remember) saveAccess(accessToken(notice));
            setGateOpen(false);
          }}
        />
        <Footer />
      </main>
    );
  }
  return <Checker />;
}

function Checker() {
  const [state, setState] = useState<State>({ step: 'idle' });
  // G-4: the outcome of "Ergebnis als Text kopieren", said in the status line
  const [copied, setCopied] = useState<boolean | undefined>(undefined);

  const [pageDrag, setPageDrag] = useState(false);
  const dragEnd = useRef<ReturnType<typeof setTimeout>>(undefined);

  const check = async (file: File, count = 1) => {
    setCopied(undefined);
    const done = (analysis: Analysis) =>
      setState({
        step: 'done',
        analysis,
        verdict: verdictOf(analysis),
        checkedAt: new Date(),
        count,
      });
    if (file.size > MAX_FILE_BYTES) {
      // Decided by the size alone, without reading the file into memory (audit 2026-11-14, S-04)
      done(tooLargeFile(file.name));
      return;
    }
    setState({ step: 'checking', fileName: file.name });
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      // A dropped folder or a file moved meanwhile: the browser cannot read it (audit A-03)
      done(unreadableFile(file.name));
      return;
    }
    try {
      done(await analyzeFile(file.name, bytes, loadPdfJs));
    } catch (error) {
      // Never swallow: an unexpected error is shown with its message.
      setState({
        step: 'failed',
        fileName: file.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const busy = state.step === 'checking';
  const result = useRef<HTMLDivElement>(null);

  // Keyboard and screen-reader users land on the result; the button they used was disabled
  // during the check, so the focus would otherwise fall back to the page (audit 2026-11-14, U-04)
  useEffect(() => {
    if (state.step === 'done' || state.step === 'failed') {
      result.current?.querySelector<HTMLElement>('[data-testid="headline"]')?.focus();
    }
  }, [state]);

  // On paper everything counts: closed sections (positions, further rules, technical messages) are
  // opened for printing and closed again afterwards (audit Bedienung, E-02)
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const beforePrint = () => {
      opened = [...document.querySelectorAll<HTMLDetailsElement>('details:not([open])')];
      for (const details of opened) details.open = true;
    };
    const afterPrint = () => {
      for (const details of opened) details.open = false;
      opened = [];
    };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  // A file dropped next to the drop zone would make the browser leave the app and open the file:
  // the whole page takes it (audit 2026-11-14, U-05). The drop zone handles its own drops.
  useEffect(() => {
    // dragover repeats while a file is over the page; when it stops, the drag has left or ended,
    // and the drop zone stops inviting (audit Bedienung, A-10)
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      setPageDrag(true);
      clearTimeout(dragEnd.current);
      dragEnd.current = setTimeout(() => setPageDrag(false), 200);
    };
    const onDrop = (event: DragEvent) => {
      setPageDrag(false);
      if (event.defaultPrevented || !event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      const files = event.dataTransfer.files;
      const file = files[0];
      if (file && !busy) void check(file, files.length);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  });

  return (
    <main className="page">
      <h1>{APP_NAME}</h1>
      {/* G-6: what the tool shows — only before a result, the result itself says the rest */}
      {state.step !== 'done' && (
        <div className="lead">
          <p>{TEXTS.introLeadText}</p>
          <p>{TEXTS.introLead}</p>
          <ul>
            {TEXTS.introPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      <DropZone
        onFile={(file, count) => void check(file, count)}
        disabled={busy}
        pageDrag={pageDrag}
        compact={state.step === 'done'}
      />

      {/* Always present, so screen readers announce changes; only a short sentence goes in
          (audit 2026-11-14, U-04) */}
      <p className="visually-hidden" role="status" data-testid="announce">
        {copied === undefined ? announcement(state) : copied ? TEXTS.copied : TEXTS.copyFailed}
      </p>
      {state.step === 'checking' && <p className="status">„{state.fileName}“ wird geprüft …</p>}
      <div ref={result}>
        {state.step === 'done' && (
          <>
            <p className="status">
              {fill(TEXTS.checkedFile, {
                name: state.analysis.fileName,
                ...germanMoment(state.checkedAt),
              })}
            </p>
            {state.count > 1 && (
              <p className="hint" data-testid="only-first">
                {fill(TEXTS.onlyFirstFile, { count: state.count })}
              </p>
            )}
            <ResultView
              analysis={state.analysis}
              verdict={state.verdict}
              notice={
                <p className="notice" data-testid="fixed-notice">
                  {noticeText(state)}
                </p>
              }
              actions={
                <div className="result-actions">
                  <button type="button" onClick={() => window.print()}>
                    {TEXTS.printResult}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText(textOf(state)).then(setCopied)}
                  >
                    {TEXTS.copyResult}
                  </button>
                  {copied !== undefined && (
                    <span className="muted" data-testid="copy-result">
                      {copied ? TEXTS.copied : TEXTS.copyFailed}
                    </span>
                  )}
                </div>
              }
            />
          </>
        )}
        {state.step === 'failed' && (
          <div className="verdict tone-bad" data-testid="verdict">
            <h2 data-testid="headline" tabIndex={-1}>
              Die Prüfung ist abgebrochen
            </h2>
            <p>
              Bei „{state.fileName}“ ist ein unerwarteter Fehler aufgetreten: {state.message}
            </p>
            <p>Bitte versuchen Sie es erneut oder wenden Sie sich an Ihre Kanzlei.</p>
          </div>
        )}
      </div>

      {/* After a result the notice stands right under the result box (G-6, ResultView) */}
      {state.step !== 'done' && (
        <p className="notice" data-testid="fixed-notice">
          {noticeText(state)}
        </p>
      )}
      <Footer />
    </main>
  );
}
