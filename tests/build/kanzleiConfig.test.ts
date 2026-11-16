import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_VARIABLE, configFile, loadAppConfig } from '../../src/build/kanzleiConfig';

// The GitHub check „Tests“ builds a second copy with the invented Beispielkanzlei, so the e2e
// branches that need a Kanzlei configuration run without the private files (audit 2026-11-15,
// QT-01). They skip as soon as one part is missing — so the invented file must carry all of them.
const BEISPIEL = 'tests/fixtures/config/beispiel-kanzlei.json';

describe('the Kanzlei configuration a build reads', () => {
  it(`takes the file ${CONFIG_VARIABLE} names before every other`, () => {
    expect(configFile({ [CONFIG_VARIABLE]: BEISPIEL })).toBe(BEISPIEL);
    expect(loadAppConfig({ [CONFIG_VARIABLE]: BEISPIEL }).file).toBe(BEISPIEL);
    // without the variable (or empty) the usual order: local file, private repo, neutral example
    expect(configFile({})).not.toBe(BEISPIEL);
    expect(configFile({ [CONFIG_VARIABLE]: '' })).toBe(configFile({}));
  });

  it('takes an absolute path as well (audit 2026-11-15, R2-T-08)', () => {
    const absolute = resolve(fileURLToPath(new URL('../../', import.meta.url)), BEISPIEL);
    expect(configFile({ [CONFIG_VARIABLE]: absolute })).toBe(absolute);
    expect(loadAppConfig({ [CONFIG_VARIABLE]: absolute })).toEqual({
      file: absolute,
      config: loadAppConfig({ [CONFIG_VARIABLE]: BEISPIEL }).config,
    });
  });

  it('stops when the named file is missing instead of falling back to another', () => {
    expect(() => configFile({ [CONFIG_VARIABLE]: 'tests/fixtures/config/fehlt.json' })).toThrow(
      /KANZLEI_CONFIG names tests\/fixtures\/config\/fehlt\.json/,
    );
  });

  it('has an invented Beispielkanzlei with every part the e2e branches need', () => {
    const { config } = loadAppConfig({ [CONFIG_VARIABLE]: BEISPIEL });
    expect(config.accessNotice).toMatch(/erfundenen Beispielkanzlei .*keine echte Kanzlei/);
    expect(new URL(config.imprintUrl ?? '').hostname).toBe('example.org');
    expect(new URL(config.privacyUrl ?? '').hostname).toBe('example.org');
    expect(Object.keys(config.colors ?? {}).sort()).toEqual([
      'accent',
      'accentDark',
      'chosenBg',
      'infoBg',
    ]);
    // the defaults of app.css differ, so the colour test shows that the configuration took effect
    const css = readFileSync(new URL('../../src/ui/app.css', import.meta.url), 'utf8');
    expect(css).toContain('#0b5cad');
    expect(config.colors?.accent).not.toBe('#0b5cad');
  });
});
