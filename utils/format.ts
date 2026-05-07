import type { CurrencyCode } from '../types';
import { CURRENCIES } from '../types';

export const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function prevYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function nextYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatYM(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_ES[m - 1]} ${y}`;
}

export function todayStr(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function _formatNumber(n: number, currency: CurrencyCode): { whole: string; dec: string; isUS: boolean } {
  const cfg = CURRENCIES[currency];
  const safe = Number.isFinite(n) ? Math.abs(n) : 0;
  const rounded = Math.round(safe * 100) / 100;
  const intPart = Math.floor(rounded);
  const decPart = Math.round((rounded - intPart) * 100);
  const isUS = cfg.locale === 'en-US';
  const thousandSep = isUS ? ',' : '.';
  const whole = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  return { whole, dec: decPart.toString().padStart(2, '0'), isUS };
}

export function fmt(n: number, currency: CurrencyCode = 'EUR'): string {
  const cfg = CURRENCIES[currency];
  const { whole, dec, isUS } = _formatNumber(n, currency);
  return `${whole}${isUS ? '.' : ','}${dec} ${cfg.symbol}`;
}

export function splitAmount(n: number, currency: CurrencyCode = 'EUR'): {
  sign: string;
  whole: string;
  decimals: string;
  symbol: string;
} {
  const cfg = CURRENCIES[currency];
  const sign = Number.isFinite(n) && n < 0 ? '-' : '';
  const { whole, dec } = _formatNumber(n, currency);
  return { sign, whole, decimals: dec, symbol: cfg.symbol };
}

export function fmtInput(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function parseAmt(value: string): number {
  const str = value.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!str) return NaN;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    return str.lastIndexOf(',') > str.lastIndexOf('.')
      ? parseFloat(str.replace(/\./g, '').replace(',', '.'))
      : parseFloat(str.replace(/,/g, ''));
  }
  if (hasComma) {
    const afterComma = str.length - str.indexOf(',') - 1;
    return afterComma === 3
      ? parseFloat(str.replace(',', ''))
      : parseFloat(str.replace(',', '.'));
  }
  if (hasDot) {
    const afterDot = str.length - str.indexOf('.') - 1;
    return afterDot === 3
      ? parseFloat(str.replace('.', ''))
      : parseFloat(str);
  }
  return parseFloat(str);
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
