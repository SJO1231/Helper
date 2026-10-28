import type { KeyType } from '../shared/types';

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

function groupDigits(value: string): string | null {
  const bare = value.replace(/,/g, '');
  if (!PLAIN_NUMBER.test(bare)) return null;
  const [whole, fraction] = bare.split('.');
  const digits = whole.replace('-', '');
  // 앞이 0으로 시작하는 긴 숫자는 번호·코드일 수 있어 원문 그대로 둔다.
  if (digits.length > 1 && digits.startsWith('0')) return null;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

function formatDate(digits: string): string {
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function formatDateTime(value: string): string {
  if (!/^\d+$/.test(value)) return value;
  if (value.length === 8) return formatDate(value);
  const minutes = `${formatDate(value)} ${value.slice(8, 10)}:${value.slice(10, 12)}`;
  if (value.length === 12) return minutes;
  if (value.length === 14) return `${minutes}:${value.slice(12)}`;
  return value;
}

export function formatCell(value: string, type: KeyType, codeMeanings?: Record<string, string>): string {
  if (value === null || value === undefined) return '';
  switch (type) {
    case 'money':
    case 'number':
      return groupDigits(value) ?? value;
    case 'percent':
      if (value.endsWith('%')) return value;
      return PLAIN_NUMBER.test(value) ? `${value}%` : value;
    case 'date':
      return /^\d{8}$/.test(value) ? formatDate(value) : value;
    case 'datetime':
      return formatDateTime(value);
    case 'code':
      return codeMeanings?.[value] ?? value;
    default:
      return value;
  }
}
