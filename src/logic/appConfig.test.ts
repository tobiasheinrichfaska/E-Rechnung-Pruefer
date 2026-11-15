import { colorVariables, contrastRatio, parseAppConfig } from './appConfig';

// Invented colours: the Kanzlei's own come from the local configuration only.
const COLORS = { accent: '#1F5FA8', chosenBg: '#e4eefa', infoBg: '#eef4fb', accentDark: '#7fb0ea' };

describe('Kanzlei colours (Tobias 2026-11-15, as in the Fragebogen)', () => {
  it('computes the WCAG contrast ratio', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
    // the default accent of app.css carries white text
    expect(contrastRatio('#0b5cad', '#ffffff')).toBeGreaterThan(4.5);
  });

  it('takes the Fragebogen colour block and turns it into CSS variables', () => {
    expect(parseAppConfig({ colors: COLORS })).toEqual({ ok: true, config: { colors: COLORS } });
    expect(colorVariables(COLORS)).toEqual({
      '--kanzlei-accent': '#1f5fa8',
      '--kanzlei-chosen-bg': '#e4eefa',
      '--kanzlei-info-bg': '#eef4fb',
      '--kanzlei-accent-dark': '#7fb0ea',
    });
    expect(colorVariables({ accent: '#1f5fa8' })).toEqual({ '--kanzlei-accent': '#1f5fa8' });
    expect(colorVariables(undefined)).toEqual({});
  });

  it('refuses colours that would make text unreadable or are no colour', () => {
    // yellow buttons with white text
    expect(parseAppConfig({ colors: { accent: '#ffd700' } })).toEqual({
      ok: false,
      issues: [
        '$.colors.accent: Kontrast 1.4:1 gegen weiße Schrift auf Knöpfen und die weiße Seite, mindestens 4.5:1',
      ],
    });
    // a dark background under dark text
    expect(parseAppConfig({ colors: { accent: '#1f5fa8', infoBg: '#333333' } }).ok).toBe(false);
    expect(parseAppConfig({ colors: { accent: 'blue' } }).ok).toBe(false);
    expect(parseAppConfig({ colors: { accent: '#1f5fa' } }).ok).toBe(false);
    expect(parseAppConfig({ colors: { chosenBg: '#e4eefa' } })).toEqual({
      ok: false,
      issues: ['$.colors.accent: fehlt'],
    });
    expect(parseAppConfig({ colors: { accent: '#1f5fa8', button: '#000000' } })).toEqual({
      ok: false,
      issues: ['$.colors.button: unbekannter Eintrag'],
    });
    expect(parseAppConfig({ colors: [] }).ok).toBe(false);
  });
});
