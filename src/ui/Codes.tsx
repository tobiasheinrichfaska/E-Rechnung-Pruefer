// The codes of EN 16931 and of the rules (BT-112, BG-23, BR-CO-15, BR-FXEXT-CO-10, BT-X-272) in a
// text, each in a span that does not wrap: a browser may break after their hyphen, and „BT-“ / „112“
// reads badly (audit R3-U-10). Not U+2011 in the text: the browser's search for „BT-112“ and the copied
// text must still find the plain hyphen. The rates and „Rn.“ carry a no-break space instead (texts.ts,
// check.ts, rules.ts).
import { Fragment } from 'react';

const CODE = /\bB[GTR]-[A-Z0-9]+(?:-[A-Z0-9]+)*/g;

export function Codes({ text }: { text: string }) {
  const parts: (string | { code: string })[] = [];
  let at = 0;
  for (const match of text.matchAll(CODE)) {
    if (match.index > at) parts.push(text.slice(at, match.index));
    parts.push({ code: match[0] });
    at = match.index + match[0].length;
  }
  if (parts.length === 0) return <>{text}</>;
  if (at < text.length) parts.push(text.slice(at));
  return (
    <>
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          <Fragment key={index}>{part}</Fragment>
        ) : (
          <span key={index} className="code">
            {part.code}
          </span>
        ),
      )}
    </>
  );
}
