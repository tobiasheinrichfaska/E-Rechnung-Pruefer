// The tester's run of the test version, kept in this browser (Tobias 2026-11-15: „Ja, wie
// Fragebogen“), so a reload — MT-05 leaves the page and comes back — loses nothing. Test version
// only: the live build has no test page, so this module is not in it. eslint.config.js allows
// localStorage here and in the access store only. Every access is guarded: a private window or
// blocked storage just keeps the run in memory, and the page says so.
import { storageKey, TEST_RUN_STORAGE } from '../logic/storageKeys';
import type { SavedRun } from '../logic/testReport';

const key = () => storageKey(TEST_RUN_STORAGE, location.pathname);

/** The saved run as stored (checked by decodeRun), or undefined. */
export function loadRun(): unknown {
  try {
    const text = localStorage.getItem(key());
    return text === null ? undefined : (JSON.parse(text) as unknown);
  } catch {
    return undefined;
  }
}

/** false when the browser refuses (private window, blocked storage). */
export function saveRun(saved: SavedRun): boolean {
  try {
    localStorage.setItem(key(), JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(key());
  } catch {
    // nothing kept
  }
}
