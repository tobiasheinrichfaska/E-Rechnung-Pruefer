import { useEffect, useRef, useState } from 'react';
import { APP_NAME, APP_VERSION } from '../appInfo';
import { MAX_FILE_BYTES, analyzeFile, tooLargeFile } from '../io/analyze';
import { loadPdfJs } from '../io/pdfjs';
import type { Analysis } from '../logic/analysis';
import { TEXTS, fill } from '../logic/texts';
import { verdictOf, xmlCounts } from '../logic/verdict';
import type { Verdict } from '../logic/verdict';
import { DropZone } from './DropZone';
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

type State =
  | { step: 'idle' }
  | { step: 'checking'; fileName: string }
  | { step: 'done'; analysis: Analysis; verdict: Verdict }
  | { step: 'failed'; fileName: string; message: string };

export function App() {
  const [state, setState] = useState<State>({ step: 'idle' });

  const check = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      // Decided by the size alone, without reading the file into memory (audit 2026-11-14, S-04)
      const analysis = tooLargeFile(file.name);
      setState({ step: 'done', analysis, verdict: verdictOf(analysis) });
      return;
    }
    setState({ step: 'checking', fileName: file.name });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const analysis = await analyzeFile(file.name, bytes, loadPdfJs);
      setState({ step: 'done', analysis, verdict: verdictOf(analysis) });
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

  // A file dropped next to the drop zone would make the browser leave the app and open the file:
  // the whole page takes it (audit 2026-11-14, U-05). The drop zone handles its own drops.
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      if (event.defaultPrevented || !event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file && !busy) void check(file);
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
      <p className="lead">
        Ziehen Sie eine Rechnung hierher. Das Tool zeigt, ob es eine E-Rechnung ist und welche
        Angaben sie enthält.
      </p>

      <DropZone onFile={(file) => void check(file)} disabled={busy} />

      {/* Always present, so screen readers announce changes; only a short sentence goes in
          (audit 2026-11-14, U-04) */}
      <p className="visually-hidden" role="status" data-testid="announce">
        {announcement(state)}
      </p>
      {state.step === 'checking' && <p className="status">„{state.fileName}“ wird geprüft …</p>}
      <div ref={result}>
        {state.step === 'done' && (
          <>
            <p className="status">Geprüfte Datei: „{state.analysis.fileName}“</p>
            <ResultView analysis={state.analysis} verdict={state.verdict} />
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

      <p className="notice" data-testid="fixed-notice">
        {state.step === 'done' && xmlCounts(state.verdict)
          ? TEXTS.fixedNotice
          : TEXTS.fixedNoticeGeneral}
      </p>
      <p className="version">Version {APP_VERSION} · in Entwicklung</p>
    </main>
  );
}
