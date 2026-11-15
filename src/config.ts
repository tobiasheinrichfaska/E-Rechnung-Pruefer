// The local Kanzlei configuration, parsed and injected at build time (vite.config.ts).
import type { AppConfig } from './logic/appConfig';

export const APP_CONFIG: AppConfig = __APP_CONFIG__;

/**
 * Only in the test version (`npm run build:test`): the page of the login script that makes an
 * invitation link for a new tester. Null in every other build, the live one included.
 */
export const TESTER_INVITE: string | null = __TESTER_INVITE__;
