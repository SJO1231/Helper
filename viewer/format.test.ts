import { describe, expect, test } from 'vitest';
import { formatCell } from './format';

describe('formatCell', () => {
  test('money formats with grouping and keeps original when not numeric', () => {
    expect(formatCell('1234567', 'money')).toBe('1,234,567');
    expect(formatCell('-', 'money')).toBe('-');
    expect(formatCell('', 'money')).toBe('');
  });

  test('number keeps decimals and sign', () => {
    expect(formatCell('-1234.50', 'number')).toBe('-1,234.50');
  });

  test('a value that already has commas is regrouped, not doubled', () => {
    expect(formatCell('1,234,567', 'money')).toBe('1,234,567');
  });

  test('leading zeros are code-like and stay as written', () => {
    expect(formatCell('0012', 'number')).toBe('0012');
    expect(formatCell('0', 'number')).toBe('0');
    expect(formatCell('0.5', 'number')).toBe('0.5');
  });

  test('percent gets a percent sign once', () => {
    expect(formatCell('12.5', 'percent')).toBe('12.5%');
    expect(formatCell('12.5%', 'percent')).toBe('12.5%');
    expect(formatCell('-', 'percent')).toBe('-');
  });

  test('date becomes YYYY-MM-DD only from eight digits', () => {
    expect(formatCell('20250102', 'date')).toBe('2025-01-02');
    expect(formatCell('2025-01-02', 'date')).toBe('2025-01-02');
    expect(formatCell('2025/1/2', 'date')).toBe('2025/1/2');
  });

  test('datetime keeps date and time parts', () => {
    expect(formatCell('20250102093015', 'datetime')).toBe('2025-01-02 09:30:15');
    expect(formatCell('202501020930', 'datetime')).toBe('2025-01-02 09:30');
    expect(formatCell('20250102', 'datetime')).toBe('2025-01-02');
  });

  test('text keeps 00 and false', () => {
    expect(formatCell('00', 'text')).toBe('00');
    expect(formatCell('false', 'bool')).toBe('false');
    expect(formatCell('0', 'code')).toBe('0');
  });

  test('missing value shows as empty', () => {
    expect(formatCell(undefined as unknown as string, 'text')).toBe('');
    expect(formatCell(null as unknown as string, 'money')).toBe('');
  });
});
