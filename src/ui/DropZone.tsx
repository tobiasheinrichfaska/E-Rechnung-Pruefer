import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { TEXTS } from '../logic/texts';

interface Props {
  /** The first file and how many came with it (only the first counts) */
  onFile: (file: File, count: number) => void;
  disabled?: boolean;
  /** A file is dragged somewhere over the page (the whole page takes it, App) */
  pageDrag?: boolean;
  /** G-5: after a result, one line "Andere Datei prüfen" — dropping still works on the whole page */
  compact?: boolean;
}

/** Text or a link dragged from elsewhere carries no file: no invitation to drop (audit A-09) */
const carriesFiles = (event: DragEvent<HTMLDivElement>) =>
  event.dataTransfer.types.includes('Files');

/** Drop a file or pick one; only the first file of a drop counts. */
export function DropZone({ onFile, disabled = false, pageDrag = false, compact = false }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file, files.length);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    if (!disabled) take(event.dataTransfer.files);
  };

  return (
    <div
      className={`dropzone${compact ? ' compact' : ''}${over || (pageDrag && !disabled) ? ' over' : ''}`}
      onDragOver={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      {!compact && (
        // G-5: on a phone nothing can be dragged — the narrow title says "auswählen" (app.css)
        <p className="dropzone-title">
          <span className="title-wide">{TEXTS.dropTitle}</span>
          <span className="title-narrow">{TEXTS.dropTitlePhone}</span>
        </p>
      )}
      {!compact && <p className="dropzone-sub">{TEXTS.dropSub}</p>}
      <button
        type="button"
        className="primary"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {compact ? TEXTS.anotherFile : TEXTS.chooseFile}
      </button>
      {compact && <span className="dropzone-sub">{TEXTS.dropSub}</span>}
      <input
        ref={input}
        type="file"
        accept=".pdf,.xml,application/pdf,application/xml,text/xml"
        hidden
        data-testid="file-input"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
