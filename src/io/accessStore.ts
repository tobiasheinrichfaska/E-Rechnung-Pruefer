// The remembered access confirmation (logic/accessGate.ts) — the only place of the tool that touches
// browser storage (eslint.config.js allows localStorage here and nowhere else). Every access is
// guarded: a private window or blocked storage simply asks again next time.
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
