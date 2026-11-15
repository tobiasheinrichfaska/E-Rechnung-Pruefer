import { accessGateNeeded, accessToken } from './accessGate';
import { parseAppConfig } from './appConfig';
import { ACCESS_STORAGE, folderOf, storageKey } from './storageKeys';

// An invented notice: the real one names the Kanzlei and never enters this repo.
const NOTICE = 'Dieses Werkzeug ist ein Hilfsmittel der Musterkanzlei.';

describe('access notice (Tobias 2026-11-15)', () => {
  it('fingerprints the notice with SHA-256 over its UTF-8 bytes', () => {
    // NIST test vector "abc"
    expect(accessToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(accessToken('Prüfer')).not.toBe(accessToken('Prufer'));
  });

  it('asks only when a notice is configured and the copy runs over https', () => {
    const remembered = vi.fn(() => null);
    expect(accessGateNeeded({ notice: undefined, protocol: 'https:', remembered })).toBe(false);
    expect(accessGateNeeded({ notice: NOTICE, protocol: 'file:', remembered })).toBe(false);
    expect(accessGateNeeded({ notice: NOTICE, protocol: 'http:', remembered })).toBe(false);
    // no notice or no https: the browser's storage is not even read
    expect(remembered).not.toHaveBeenCalled();
    expect(accessGateNeeded({ notice: NOTICE, protocol: 'https:', remembered })).toBe(true);
    expect(remembered).toHaveBeenCalledTimes(1);
  });

  it('does not ask again once the same notice was remembered; a changed text is asked again', () => {
    const kept = accessToken(NOTICE);
    expect(accessGateNeeded({ notice: NOTICE, protocol: 'https:', remembered: () => kept })).toBe(
      false,
    );
    expect(
      accessGateNeeded({ notice: `${NOTICE} Neu.`, protocol: 'https:', remembered: () => kept }),
    ).toBe(true);
  });

  it('keeps one key per folder, with its own prefix', () => {
    expect(folderOf('/')).toBe('/');
    expect(folderOf('/index.html')).toBe('/');
    expect(folderOf('/NebenprojektERechnung/index.html')).toBe('/NebenprojektERechnung/');
    expect(storageKey(ACCESS_STORAGE, '/')).toBe('e-rechnung-pruefer-zugang');
    expect(storageKey(ACCESS_STORAGE, '/NebenprojektERechnung/')).toBe(
      'e-rechnung-pruefer-zugang@/NebenprojektERechnung/',
    );
  });
});

describe('the Kanzlei configuration', () => {
  it('takes the neutral example (nothing) and a notice', () => {
    expect(parseAppConfig({})).toEqual({ ok: true, config: {} });
    expect(parseAppConfig({ accessNotice: ` ${NOTICE} ` })).toEqual({
      ok: true,
      config: { accessNotice: NOTICE },
    });
  });

  it('refuses what would ship a broken notice', () => {
    expect(parseAppConfig([]).ok).toBe(false);
    expect(parseAppConfig(null).ok).toBe(false);
    expect(parseAppConfig({ accessNotice: '   ' })).toEqual({
      ok: false,
      issues: ['$.accessNotice: kein Text'],
    });
    expect(parseAppConfig({ accessNotice: 42 }).ok).toBe(false);
    expect(parseAppConfig({ accessNotice: 'x'.repeat(2001) }).ok).toBe(false);
    expect(parseAppConfig({ accessNotice: `a${String.fromCharCode(0xd800)}b` }).ok).toBe(false);
    // a mistyped key would silently drop the notice
    expect(parseAppConfig({ accesNotice: NOTICE })).toEqual({
      ok: false,
      issues: ['$.accesNotice: unbekannter Eintrag'],
    });
  });

  it('takes the Impressum and privacy addresses only as https without login data', () => {
    const imprintUrl = 'https://www.musterkanzlei.example/impressum';
    const privacyUrl = 'https://www.musterkanzlei.example/datenschutz#cdn';
    expect(parseAppConfig({ imprintUrl, privacyUrl })).toEqual({
      ok: true,
      config: { imprintUrl, privacyUrl },
    });
    expect(parseAppConfig({ imprintUrl: 'http://www.musterkanzlei.example/impressum' })).toEqual({
      ok: false,
      issues: ['$.imprintUrl: nicht https://'],
    });
    expect(parseAppConfig({ privacyUrl: 'javascript:alert(1)' }).ok).toBe(false);
    expect(parseAppConfig({ privacyUrl: 'https://nutzer:kennwort@example.org/' }).ok).toBe(false);
    expect(parseAppConfig({ privacyUrl: '/datenschutz' }).ok).toBe(false);
    expect(parseAppConfig({ imprintUrl: ' https://example.org/impressum' }).ok).toBe(false);
    expect(parseAppConfig({ imprintUrl: 42 }).ok).toBe(false);
  });
});
