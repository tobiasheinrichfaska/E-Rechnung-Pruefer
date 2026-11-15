// Which Kanzlei configuration a build uses (Node only; vite.config.ts and the tests read it the same
// way). Nothing that names the Kanzlei is in this public repo (Tobias 2026-11-15):
//   1. config/kanzlei.local.json — gitignored; placed there by hand or by the release run,
//   2. tests/fixtures/lokal/config/kanzlei.local.json — the original in the private companion repo
//      E-Rechnung-Pruefer-privat, linked as tests/fixtures/lokal (cloud and Kanzlei PC),
//   3. config/kanzlei.example.json — neutral, holds nothing: the tool asks no notice.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseAppConfig } from '../logic/appConfig.ts';
import type { AppConfig } from '../logic/appConfig.ts';

const ROOT = new URL('../../', import.meta.url);

const CANDIDATES = [
  'config/kanzlei.local.json',
  'tests/fixtures/lokal/config/kanzlei.local.json',
  'config/kanzlei.example.json',
];

/** The configuration file this checkout's build reads, as a path relative to the repo root. */
export function configFile(): string {
  const found = CANDIDATES.find((path) => existsSync(fileURLToPath(new URL(path, ROOT))));
  if (!found) throw new Error('config/kanzlei.example.json is missing');
  return found;
}

/** The parsed configuration; an invalid file stops the build. */
export function loadAppConfig(): { file: string; config: AppConfig } {
  const file = configFile();
  const parsed = parseAppConfig(
    JSON.parse(readFileSync(fileURLToPath(new URL(file, ROOT)), 'utf8')) as unknown,
  );
  if (!parsed.ok) {
    throw new Error(`Invalid Kanzlei configuration ${file}: ${parsed.issues.join('; ')}`);
  }
  return { file, config: parsed.config };
}
