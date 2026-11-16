// The confirmation asked before the hosted copy opens (logic/accessGate.ts, Tobias 2026-11-15), built
// like the Fragebogen's: the notice of the local configuration is the label of its tick box,
// „Weiter“ only once it is ticked, „Antwort für die Zukunft merken“ on request — offered only where
// the browser can keep it (`canRemember`, audit R3-U-12).
import { useEffect, useRef, useState } from 'react';
import { TEXTS } from '../logic/texts';

export function AccessGate({
  notice,
  canRemember,
  onConfirm,
}: {
  notice: string;
  /** false with blocked site data: no box that would do nothing, a sentence instead */
  canRemember: boolean;
  onConfirm: (remember: boolean) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [remember, setRemember] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Screen readers start at the question, not somewhere on the page
  useEffect(() => heading.current?.focus(), []);

  return (
    <section className="card access-gate" aria-labelledby="zugangshinweis">
      <h2 id="zugangshinweis" ref={heading} tabIndex={-1}>
        {TEXTS.accessTitle}
      </h2>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>{notice}</span>
      </label>
      {canRemember ? (
        <>
          <label>
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>{TEXTS.accessRemember}</span>
          </label>
          <p className="muted">{TEXTS.accessRememberNote}</p>
        </>
      ) : (
        <p className="muted" data-testid="cannot-remember">
          {TEXTS.accessCannotRemember}
        </p>
      )}
      <button
        type="button"
        className="primary"
        disabled={!confirmed}
        onClick={() => onConfirm(canRemember && remember)}
      >
        {TEXTS.accessContinue}
      </button>
    </section>
  );
}
