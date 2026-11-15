import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { configFile, loadAppConfig } from '../../src/build/kanzleiConfig';

// The access notice names the Kanzlei, so it lives only in the local configuration (Tobias
// 2026-11-15): neither the notice nor its first sentence (the one with the name) may appear in any
// file of this public repo, nor the host of the Impressum or privacy address. Without a local configuration there is nothing that could leak — the
// check then only confirms that the build reads the neutral example.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// Only the real configuration counts, never the invented one KANZLEI_CONFIG may name (QT-01).
const { config } = loadAppConfig({});
const notice = config.accessNotice;

describe('no Kanzlei name in the public repo', () => {
  it('reads the neutral example only when no local configuration is there', () => {
    if (notice === undefined) expect(configFile({})).toBe('config/kanzlei.example.json');
    expect(JSON.parse(readFileSync(`${ROOT}config/kanzlei.example.json`, 'utf8'))).toEqual({});
  });

  it('keeps the notice and the Kanzlei addresses of the local configuration out of every tracked file', () => {
    const hosts = [config.imprintUrl, config.privacyUrl]
      .filter((url): url is string => url !== undefined)
      // the registrable domain (e.g. "kanzlei-beispiel.de"), whatever subdomain a page uses
      .map((url) => new URL(url).hostname.split('.').slice(-2).join('.'));
    const secrets = [
      ...(notice === undefined ? [] : [notice, notice.split(/(?<=\.)\s/)[0] ?? notice]),
      ...hosts,
    ];
    if (secrets.length === 0) return;
    const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter((name) => name !== '' && !/\.(pdf|png|wasm|zip)$/i.test(name));
    expect(files.length).toBeGreaterThan(100);
    const leaking = files.filter((name) => {
      const text = readFileSync(`${ROOT}${name}`, 'utf8');
      return secrets.some((secret) => text.includes(secret));
    });
    expect(leaking).toEqual([]);
  });
});
