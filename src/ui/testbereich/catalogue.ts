// The test page's catalogue: manual_tests/0X_*.md (Tobias 2026-11-15, after the Fragebogen's test
// page). Bundled only into the test version (`npm run build:test`); every other build gets an empty
// catalogue — the condition folds to false there, so the texts are left out of the live file.
import { TEST_AREA } from '../../config';
import { parseManualTests, type ManualTest } from '../../logic/manualTests';

const raw: Record<string, string> = TEST_AREA
  ? import.meta.glob<string>('../../../manual_tests/[0-9][0-9]_*.md', {
      query: '?raw',
      import: 'default',
      eager: true,
    })
  : {};

const fileName = (path: string) => path.split('/').pop() ?? path;

/** Every manual test, by its number (MT-05 stands in 02_geraete.md, after MT-03). */
export const TESTS: readonly ManualTest[] = Object.entries(raw)
  .flatMap(([path, text]) => parseManualTests(text, fileName(path)))
  .sort((a, b) => a.id.localeCompare(b.id));
