// The local Kanzlei configuration, parsed and injected at build time (vite.config.ts).
import type { AppConfig } from './logic/appConfig';

export const APP_CONFIG: AppConfig = __APP_CONFIG__;

/**
 * Only in the test version (`npm run build:test`): the link to the page of the login script that
 * makes an invitation link for a new tester. Null in every other build, the live one included. The
 * label stays here rather than in TEXTS: the build folds `null === null` away, so the live file
 * carries neither the address nor the word (tests/e2e/testfassung.spec.ts).
 */
export const TESTER_INVITE: { href: string; text: string } | null =
  __TESTER_INVITE__ === null ? null : { href: __TESTER_INVITE__, text: 'Tester einladen' };

/**
 * The commit the test version was built from (`git rev-parse --short HEAD`), else null: the `stand`
 * of its reports (src/testArea.tsx).
 */
export const APP_STAND: string | null = __APP_STAND__;
