// Which Kanzlei configuration a build uses (Node only; vite.config.ts and the tests read it the same
// way). Nothing that names the Kanzlei is in this public repo (Tobias 2026-11-15):
//   0. the file named by the environment variable KANZLEI_CONFIG (relative to the repo root or
//      absolute) — the GitHub check „Tests“ names the invented Beispielkanzlei there
//      (tests/fixtures/config/beispiel-kanzlei.json), so the branches of the e2e tests that need a
//      configuration run without the private files too (audit 2026-11-15, QT-01). A named file that
//      is missing stops the build: a typo must not fall back to another configuration,
//   1. config/kanzlei.local.json — gitignored; placed there by hand or by the release run,
//   2. tests/fixtures/lokal/config/kanzlei.local.json — the original in the private companion repo
//      E-Rechnung-Pruefer-privat, linked as tests/fixtures/lokal (cloud and Kanzlei PC),
//   3. config/kanzlei.example.json — neutral, holds nothing: the tool asks no notice.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAppConfig } from '../logic/appConfig.ts';
import type { AppConfig } from '../logic/appConfig.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** The environment variable that names the configuration to read instead of the usual files. */
export const CONFIG_VARIABLE = 'KANZLEI_CONFIG';

const CANDIDATES = [
  'config/kanzlei.local.json',
  'tests/fixtures/lokal/config/kanzlei.local.json',
  'config/kanzlei.example.json',
];

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The configuration file this checkout's build reads: the one KANZLEI_CONFIG names, else the first
 * candidate present, as a path relative to the repo root. `env` defaults to the process's; a test
 * that must see only the local files (noBranding) passes `{}`.
 */
export function configFile(env: Env = process.env): string {
  const named = env[CONFIG_VARIABLE];
  if (named !== undefined && named !== '') {
    if (!existsSync(resolve(ROOT, named))) {
      throw new Error(`${CONFIG_VARIABLE} names ${named}, which does not exist`);
    }
    return named;
  }
  const found = CANDIDATES.find((path) => existsSync(resolve(ROOT, path)));
  if (!found) throw new Error('config/kanzlei.example.json is missing');
  return found;
}

/** The parsed configuration; an invalid file stops the build. */
export function loadAppConfig(env: Env = process.env): { file: string; config: AppConfig } {
  const file = configFile(env);
  const parsed = parseAppConfig(JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as unknown);
  if (!parsed.ok) {
    throw new Error(`Invalid Kanzlei configuration ${file}: ${parsed.issues.join('; ')}`);
  }
  return { file, config: parsed.config };
}
