import { germanDate, isoDate } from './dates';

describe('isoDate', () => {
  it('reads UBL and CII format 102', () => {
    expect(isoDate('2026-11-13')).toBe('2026-11-13');
    expect(isoDate('20261113')).toBe('2026-11-13');
    expect(isoDate(' 20240229 ')).toBe('2024-02-29');
  });

  it('refuses impossible or foreign dates', () => {
    expect(isoDate('20230229')).toBeUndefined();
    expect(isoDate('2026-13-01')).toBeUndefined();
    expect(isoDate('2026-04-31')).toBeUndefined();
    expect(isoDate('13.11.2026')).toBeUndefined();
    expect(isoDate('2026-11-13T10:00:00')).toBeUndefined();
    expect(isoDate(undefined)).toBeUndefined();
  });

  it('shows German dates', () => {
    expect(germanDate('2026-01-05')).toBe('05.01.2026');
  });
});

describe('isoDate with a time zone (audit 2026-11-14, L-05)', () => {
  it('keeps the day of an xs:date with a zone', () => {
    expect(isoDate('2026-01-01Z')).toBe('2026-01-01');
    expect(isoDate('2028-01-15+01:00')).toBe('2028-01-15');
    expect(isoDate('2026-02-30Z')).toBeUndefined();
    expect(isoDate('2026-01-01+1:00')).toBeUndefined();
  });
});
