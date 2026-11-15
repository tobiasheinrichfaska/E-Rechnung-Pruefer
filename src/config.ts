// The local Kanzlei configuration, parsed and injected at build time (vite.config.ts).
import type { AppConfig } from './logic/appConfig';

export const APP_CONFIG: AppConfig = __APP_CONFIG__;
