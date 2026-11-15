import {
  ZERO,
  abs,
  add,
  decimalEquals,
  decimalText,
  formatAmount,
  multiply,
  normalize,
  parseDecimal,
  roundTo,
  subtract,
  sum,
  within,
} from './decimal';

describe('parseDecimal', () => {
  it.each([
    ['100', 100n, 0],
    ['100.00', 10000n, 2],
    ['-0.5', -5n, 1],
    ['.5', 5n, 1],
    ['+3.', 3n, 0],
    [' 12.30 ', 1230n, 2],
  ])('%s', (text, units, scale) => {
    expect(parseDecimal(text)).toEqual({ units, scale });
  });

  it.each(['', '1e3', '1,5', '1.000,00', 'abc', '--1', '1.2.3', undefined])(
    'refuses %s',
    (text) => {
      expect(parseDecimal(text)).toBeUndefined();
    },
  );

  it('holds values exactly far beyond floating point', () => {
    const value = parseDecimal('12345678901234567890.123456789');
    expect(value && decimalText(value)).toBe('12345678901234567890.123456789');
  });
});

describe('equality and display', () => {
  it('compares by value, not by notation', () => {
    const a = parseDecimal('100.00');
    const b = parseDecimal('100');
    expect(a && b && decimalEquals(a, b)).toBe(true);
    const c = parseDecimal('100.01');
    expect(a && c && decimalEquals(a, c)).toBe(false);
    expect(normalize({ units: 0n, scale: 3 })).toEqual({ units: 0n, scale: 0 });
  });

  it.each([
    ['1234.5', '1.234,50'],
    ['0', '0,00'],
    ['-1234567.891', '-1.234.567,891'],
    ['0.05', '0,05'],
  ])('formats %s as %s', (text, shown) => {
    const value = parseDecimal(text);
    expect(value && formatAmount(value)).toBe(shown);
  });
});

describe('arithmetic for the rules (step 3a)', () => {
  const d = (text: string) => {
    const value = parseDecimal(text);
    if (!value) throw new Error(text);
    return decimalText(normalize(value));
  };
  const n = (text: string) => parseDecimal(text) ?? ZERO;
  it('adds, subtracts and multiplies exactly', () => {
    expect(decimalText(normalize(add(n('0.1'), n('0.2'))))).toBe('0.3');
    expect(decimalText(normalize(subtract(n('10'), n('0.01'))))).toBe('9.99');
    expect(decimalText(normalize(multiply(n('314.86'), n('0.07'))))).toBe('22.0402');
    expect(decimalText(normalize(sum([n('1.5'), n('-2.25'), n('3')])))).toBe('2.25');
  });

  it('rounds like XPath round(): halves up, toward +∞', () => {
    const r = (text: string) => decimalText(roundTo(n(text), 2));
    expect(r('22.0402')).toBe('22.04');
    expect(r('0.125')).toBe('0.13');
    expect(r('-0.125')).toBe('-0.12');
    expect(r('-0.126')).toBe('-0.13');
    expect(r('1.5')).toBe('1.5');
    expect(decimalText(roundTo(n('2.5'), 0))).toBe('3');
    expect(decimalText(roundTo(n('-2.5'), 0))).toBe('-2');
    expect(d('1.50')).toBe('1.5');
  });

  it('compares within a tolerance (strictly)', () => {
    expect(within(n('19.00'), n('19.99'), n('1'))).toBe(true);
    expect(within(n('19.00'), n('20.00'), n('1'))).toBe(false);
    expect(within(n('-5'), n('-4.5'), n('1'))).toBe(true);
    expect(abs(n('-3.2')).units).toBe(32n);
  });

  it('compares within a tolerance including its bounds (the CII forms, audit QL-03)', () => {
    expect(within(n('19.00'), n('20.00'), n('1'), true)).toBe(true);
    expect(within(n('19.00'), n('18.00'), n('1'), true)).toBe(true);
    expect(within(n('19.00'), n('20.01'), n('1'), true)).toBe(false);
  });
});
