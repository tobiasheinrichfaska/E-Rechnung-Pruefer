import { useRef, useState } from 'react';
import type { DragEvent } from 'react';

interface Props {
  /** The first file and how many came with it (only the first counts) */
  onFile: (file: File, count: number) => void;
  disabled?: boolean;
  /** A file is dragged somewhere over the page (the whole page takes it, App) */
  pageDrag?: boolean;
}

/** Text or a link dragged from elsewhere carries no file: no invitation to drop (audit A-09) */
const carriesFiles = (event: DragEvent<HTMLDivElement>) =>
  event.dataTransfer.types.includes('Files');

/** Drop a file or pick one; only the first file of a drop counts. */
export function DropZone({ onFile, disabled = false, pageDrag = false }: Props) {
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
      className={`dropzone${over || (pageDrag && !disabled) ? ' over' : ''}`}
      onDragOver={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <p className="dropzone-title">Rechnung hierher ziehen</p>
      <p className="dropzone-sub">PDF oder XML. Die Datei bleibt auf Ihrem Gerät.</p>
      <button
        type="button"
        className="primary"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        Datei auswählen
      </button>
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
