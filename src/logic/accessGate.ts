// The access notice before the hosted copy opens (Tobias 2026-11-15, built like the Fragebogen's
// src/logic/accessGate.ts): only when the local configuration has a notice, only over https — a
// downloaded copy came through the hosted one, and on file:// nothing may be remembered.
// „Antwort für die Zukunft merken“ keeps a fingerprint of the notice in the browser (not a cookie:
// it would travel to the web server with every request); a changed notice is asked again.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** What the browser keeps for a remembered confirmation: the SHA-256 of the notice (UTF-8, hex). */
export function accessToken(notice: string): string {
  return bytesToHex(sha256(utf8ToBytes(notice)));
}

export function accessGateNeeded(input: {
  notice: string | undefined;
  protocol: string;
  /** Reads what the browser keeps under the access key (null when nothing) — only when needed. */
  remembered: () => string | null;
}): boolean {
  if (input.notice === undefined || input.protocol !== 'https:') return false;
  return input.remembered() !== accessToken(input.notice);
}
