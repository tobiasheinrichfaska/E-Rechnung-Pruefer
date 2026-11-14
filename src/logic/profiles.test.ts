import { PROFILES, profileOf } from './profiles';
import { TEXTS, fill } from './texts';

describe('profileOf', () => {
  it.each([
    ['urn:cen.eu:en16931:2017', 'eRechnung', 'EN 16931'],
    ['urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic', 'eRechnung', 'BASIC'],
    ['urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended', 'eRechnung', 'EXTENDED'],
    ['urn:factur-x.eu:1p0:minimum', 'keineERechnung', 'MINIMUM'],
    ['urn:factur-x.eu:1p0:basicwl', 'keineERechnung', 'BASIC WL'],
    ['urn:ferd:CrossIndustryDocument:invoice:1p0:comfort', 'keineERechnung', 'ZUGFeRD 1.0'],
  ])('%s → %s (%s)', (id, einordnung, profile) => {
    const match = profileOf(id);
    expect(match.einordnung).toBe(einordnung);
    expect(match.entry?.profile).toBe(profile);
  });

  it('prefers the exact XRechnung 3.0 entry and the most specific prefix', () => {
    const base = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
    expect(profileOf(base).entry?.label).toBe('XRechnung 3.0');
    expect(
      profileOf(`${base}#compliant#urn:xeinkauf.de:kosit:xrechnung:cvd_1.0`).entry?.label,
    ).toBe('XRechnung 3.0, CVD');
    expect(
      profileOf('urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.1').entry
        ?.label,
    ).toBe('XRechnung');
  });

  it('trims surrounding white space but judges nothing unknown', () => {
    expect(profileOf('  urn:cen.eu:en16931:2017 \n').einordnung).toBe('eRechnung');
    expect(profileOf('urn:cen.eu:en16931:2017#compliant#urn:example:neu')).toEqual({
      id: 'urn:cen.eu:en16931:2017#compliant#urn:example:neu',
      einordnung: 'nichtBeurteilt',
    });
    expect(profileOf(undefined)).toEqual({ einordnung: 'nichtBeurteilt' });
    expect(profileOf('   ')).toEqual({ einordnung: 'nichtBeurteilt' });
  });

  it('never matches a longer identifier against an exact entry', () => {
    expect(profileOf('urn:factur-x.eu:1p0:minimumX').einordnung).toBe('nichtBeurteilt');
  });

  it('keeps one entry per identifier and a source for each', () => {
    const ids = PROFILES.map((p) => `${p.match}:${p.id}`);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PROFILES.every((p) => p.source.length > 0)).toBe(true);
  });
});

describe('audit 2026-11-14', () => {
  const XR = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_';
  it('takes only a version number after an XRechnung prefix (L-08)', () => {
    expect(profileOf(`${XR}3.1`).einordnung).toBe('eRechnung');
    expect(profileOf(`${XR}3.0.2`).einordnung).toBe('eRechnung');
    expect(profileOf(`${XR}3.0#conformant#urn:example.com:my-extension`).einordnung).toBe(
      'nichtBeurteilt',
    );
    expect(profileOf(`${XR}irgendwas`).einordnung).toBe('nichtBeurteilt');
    expect(
      profileOf('urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_2.3')
        .einordnung,
    ).toBe('eRechnung');
  });

  it('knows MINIMUM and BASIC WL of ZUGFeRD 2.0 and leaves BASIC/EXTENDED 2.0 to Tobias (B-01)', () => {
    expect(profileOf('urn:zugferd.de:2p0:minimum').einordnung).toBe('keineERechnung');
    expect(profileOf('urn:zugferd.de:2p0:basicwl').einordnung).toBe('keineERechnung');
    expect(profileOf('urn:cen.eu:en16931:2017#compliant#urn:zugferd.de:2p0:basic').einordnung).toBe(
      'nichtBeurteilt',
    );
  });

  it('keeps the headline label free of brackets (U-08)', () => {
    const nested = PROFILES.map((p) => fill(TEXTS.eRechnung, { spec: p.label })).filter((h) =>
      h.includes('))'),
    );
    expect(nested).toEqual([]);
    expect(profileOf('urn:cen.eu:en16931:2017').entry?.label).toBe('EN 16931');
  });
});
