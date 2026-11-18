import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAppConfig } from '../../src/build/kanzleiConfig';

// The GitHub check „Tests“ is the gate of every upload. Its actions are pinned to a commit, as the
// npm packages are pinned to a version (a moved tag cannot change the check), and checkout keeps no
// token in .git/config (audit 2026-11-15, QS-06). Its second e2e run reads the invented Kanzlei
// configuration (QT-01).
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const workflow = readFileSync(`${ROOT}.github/workflows/tests.yml`, 'utf8');

/** The step whose name starts so, up to the next step or comment at its depth; '' if missing. */
function stepNamed(name: string): string {
  const start = workflow.indexOf(`- name: ${name}`);
  if (start < 0) return '';
  const rest = workflow.slice(start);
  const end = rest.search(/\n {6}(?:- |#)/);
  return end < 0 ? rest : rest.slice(0, end);
}

/** The commands of a step's `run: |` block, one per line. */
function runLines(step: string): string[] {
  const lines = step.split('\n');
  const at = lines.findIndex((line) => /^\s*run: \|$/.test(line));
  return at < 0
    ? []
    : lines
        .slice(at + 1)
        .map((line) => line.trim())
        .filter((line) => line !== '');
}

const INVENTED = 'tests/fixtures/config/beispiel-kanzlei.json';

describe('the GitHub check „Tests“', () => {
  it('pins every action to a commit, with its version as a comment', () => {
    const uses = [...workflow.matchAll(/^\s*(?:-\s+)?uses:\s*(.+)$/gm)].map((m) => m[1] ?? '');
    expect(uses.length).toBeGreaterThanOrEqual(5);
    expect(
      uses.filter((use) => !/^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/.test(use)),
    ).toEqual([]);
  });

  it('keeps no token after checkout', () => {
    const checkouts = workflow.split(/^\s*-\s+uses:\s*actions\/checkout@/m).slice(1);
    expect(checkouts.length).toBe(2);
    for (const step of checkouts) {
      expect(step).toMatch(/^[^\n]*\n\s+with:\n\s+persist-credentials: false\n/);
    }
  });

  it('runs the Kanzlei branches against the invented configuration, which exists', () => {
    const named = [...workflow.matchAll(/KANZLEI_CONFIG:\s*(\S+)/g)].map((match) => match[1]);
    // the live build's branches and the test version's (R4-T-01)
    expect(named).toEqual([INVENTED, INVENTED]);
    expect(existsSync(`${ROOT}${INVENTED}`)).toBe(true);
  });
});

// The second e2e run must not lose a branch unnoticed (audit 2026-11-15, R2-T-04): a renamed
// describe or a spec dropped from KANZLEI_SPECS left the sum of the report above zero, and the old
// guard looked only at the sum. Now the guard counts per spec, and this test keeps the list, the
// --grep and the titles of the specs in step, and runs the guard on reports of its own.
describe('the e2e run with the invented Beispielkanzlei', () => {
  const step = stepNamed('E2E mit der erfundenen Beispielkanzlei');
  const specs = (/^\s*KANZLEI_SPECS:\s*(.+)$/m.exec(step)?.[1] ?? '').trim().split(/\s+/);
  const command = /^\s*npx playwright test .*$/m.exec(step)?.[0] ?? '';
  const grep = /--grep "([^"]+)"/.exec(command)?.[1] ?? '';
  const report = /^\s*PLAYWRIGHT_JSON_OUTPUT_FILE:\s*(\S+)$/m.exec(step)?.[1] ?? '';
  const guard = /^\s*node -e "([^"]*)" \$KANZLEI_SPECS\s*$/m.exec(step)?.[1];

  /** The describe titles of a spec (the --grep matches them; no spec puts it in a test title). */
  const describes = (spec: string) =>
    [...readFileSync(`${ROOT}${spec}`, 'utf8').matchAll(/test\.describe\(\s*(['"`])(.+?)\1/g)].map(
      (match) => match[2] ?? '',
    );
  const E2E = 'tests/e2e/';
  const carrying = readdirSync(`${ROOT}${E2E}`)
    .filter((name) => name.endsWith('.spec.ts'))
    .map((name) => `${E2E}${name}`)
    .filter((spec) => grep !== '' && describes(spec).some((title) => title.includes(grep)));

  it('runs exactly the specs whose describe carries the --grep title, the Kanzlei branches among them', () => {
    expect(step).toContain('KANZLEI_CONFIG: tests/fixtures/config/beispiel-kanzlei.json');
    expect(command).toMatch(
      /^\s*npx playwright test \$KANZLEI_SPECS --grep "[^"]+" --reporter=list,json$/,
    );
    expect(grep).toBe('of the local configuration');
    for (const spec of specs)
      expect(
        describes(spec).filter((t) => t.includes(grep)),
        spec,
      ).not.toEqual([]);
    expect([...specs].sort()).toEqual(carrying);
    // the branches of FEATURES_REQUIRED.md that need a configuration: notice, footer links, colours
    expect(specs).toEqual(
      expect.arrayContaining([
        'tests/e2e/zugangshinweis.spec.ts',
        'tests/e2e/fusszeile.spec.ts',
        'tests/e2e/farben.spec.ts',
      ]),
    );
  });

  /** The exit code of the guard on a report with these test states per spec file. */
  function guardOn(results: Readonly<Record<string, readonly string[]>>, args = specs): number {
    const folder = mkdtempSync(join(tmpdir(), 'kanzlei-guard-'));
    try {
      const suites = Object.entries(results).map(([file, states]) => ({
        title: file,
        file,
        specs: [],
        suites: [
          {
            title: 'with … of the local configuration',
            file,
            specs: states.map((status, i) => ({
              title: `case ${i}`,
              file,
              tests: [{ projectName: 'chromium', status }],
            })),
          },
        ],
      }));
      mkdirSync(join(folder, dirname(report)), { recursive: true });
      writeFileSync(join(folder, report), JSON.stringify({ suites, stats: {} }));
      execFileSync('node', ['-e', guard ?? 'process.exit(9)', ...args], {
        cwd: folder,
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: report },
        stdio: 'pipe',
      });
      return 0;
    } catch (error) {
      return (error as { status?: number }).status ?? -1;
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }

  it('fails the step when one spec ran no test or a test did not pass, not only when all are missing', () => {
    expect(guard).toBeDefined();
    expect(report).toMatch(/^test-results\/.+\.json$/);
    const files = specs.map((spec) => spec.slice(E2E.length));
    const each = (states: readonly string[]) =>
      Object.fromEntries(files.map((file) => [file, states]));
    expect(guardOn(each(['expected', 'expected']))).toBe(0);
    // one spec lost its branch (renamed describe, dropped from the run): the others still sum up
    expect(guardOn({ ...each(['expected']), [files[1] ?? '']: [] })).toBe(1);
    const withoutOne = Object.fromEntries(
      files
        .slice(0, 1)
        .concat(files.slice(2))
        .map((f) => [f, ['expected']]),
    );
    expect(guardOn(withoutOne)).toBe(1);
    expect(guardOn({ ...each(['expected']), [files[2] ?? '']: ['expected', 'skipped'] })).toBe(1);
    expect(guardOn({ ...each(['expected']), [files[0] ?? '']: ['unexpected'] })).toBe(1);
    expect(guardOn(each(['expected']), [])).toBe(1);
  });
});

// Beside the test frame the tool asks the notice only where one is configured (audit 2026-11-16,
// R4-T-01): in the run of every spec it never is, and the step above runs no testrahmen.spec.ts. So
// a step of its own builds the test version with the invented notice after that run and runs the
// whole spec, where passNotice throws if KANZLEI_CONFIG names a file without a notice.
describe('the e2e run of the test version with the invented Beispielkanzlei', () => {
  const step = stepNamed('E2E der Testfassung mit der erfundenen Beispielkanzlei');
  const SPEC = 'tests/e2e/testrahmen.spec.ts';

  it('builds the test version with the invented notice after the run of every spec and runs the whole testrahmen spec', () => {
    expect(step).toContain(`KANZLEI_CONFIG: ${INVENTED}`);
    // the whole spec in all three projects: no --grep, no --project, nothing left out
    expect(runLines(step)).toEqual(['npm run build:test', `npx playwright test ${SPEC}`]);
    const at = workflow.indexOf(step);
    expect(at).toBeGreaterThan(workflow.indexOf('- run: npm run test:e2e'));
    expect(at).toBeLessThan(workflow.indexOf('- if: failure()'));
  });

  it('cannot skip the notice: the invented file has one, and the spec reads it only through the helpers that throw', () => {
    expect(loadAppConfig({ KANZLEI_CONFIG: INVENTED }).config.accessNotice).toBeDefined();
    const spec = readFileSync(`${ROOT}${SPEC}`, 'utf8');
    expect(spec).not.toContain('loadAppConfig');
    expect(spec).toContain('passNotice(page');
    expect(spec).toContain('configuredNotice() !== undefined');
    const helpers = readFileSync(`${ROOT}tests/e2e/helpers.ts`, 'utf8');
    expect(helpers).toMatch(
      /function passNotice\([^)]*\)[^{]*\{\n\s*const notice = configuredNotice\(\);/,
    );
  });
});
