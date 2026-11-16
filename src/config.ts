// The local Kanzlei configuration, parsed and injected at build time (vite.config.ts).
import type { AppConfig } from './logic/appConfig';

export const APP_CONFIG: AppConfig = __APP_CONFIG__;

/**
 * The commit the test version was built from (`git rev-parse --short HEAD`), else null: the `stand`
 * of its reports (src/testArea.tsx).
 */
export const APP_STAND: string | null = __APP_STAND__;
