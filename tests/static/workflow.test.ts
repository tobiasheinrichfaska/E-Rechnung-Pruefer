import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The GitHub check „Tests“ is the gate of every upload. Its actions are pinned to a commit, as the
// npm packages are pinned to a version (a moved tag cannot change the check), and checkout keeps no
// token in .git/config (audit 2026-11-15, QS-06). Its second e2e run reads the invented Kanzlei
// configuration (QT-01).
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const workflow = readFileSync(`${ROOT}.github/workflows/tests.yml`, 'utf8');

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
    const named = /KANZLEI_CONFIG:\s*(\S+)/.exec(workflow)?.[1];
    expect(named).toBe('tests/fixtures/config/beispiel-kanzlei.json');
    expect(existsSync(`${ROOT}${named}`)).toBe(true);
  });
});
