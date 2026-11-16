// The remembered access confirmation (logic/accessGate.ts) — the only place of the tool that touches
// browser storage (eslint.config.js allows localStorage here and nowhere else; the copy of the
// shared test frame in src/testrahmen/ is no code of the tool). Every access is guarded: a private
// window or blocked storage simply asks again next time.
import { ACCESS_STORAGE, storageKey } from '../logic/storageKeys';

const key = () => storageKey(ACCESS_STORAGE, location.pathname);

export function loadAccess(): string | null {
  try {
    return localStorage.getItem(key());
  } catch {
    return null;
  }
}

export function saveAccess(token: string): void {
  try {
    localStorage.setItem(key(), token);
  } catch {
    // not kept: the notice is asked again next time
  }
}

/**
 * „App vollständig zurücksetzen“ of the test version (src/testArea.tsx): forgets the confirmation of
 * this copy, so the tool asks the notice again. Only this key: the frame's own and every other app's
 * data stay.
 */
export function forgetAccess(): void {
  try {
    localStorage.removeItem(key());
  } catch {
    // nothing kept
  }
}
