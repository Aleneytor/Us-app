import type { Transaction } from '../types';

export function isMonthVisible(t: Transaction, targetYM: string): boolean {
  if (!t.date) return false;
  const eYM = t.date.slice(0, 7);
  return t.type === 'monthly' ? eYM <= targetYM : eYM === targetYM;
}

export function getPaid(t: Transaction, ym: string): boolean {
  if (!t.paid) return false;
  if (typeof t.paid === 'boolean') return t.paid as boolean;
  return !!(t.paid as Record<string, boolean>)[ym];
}

export function getPaidDate(t: Transaction, ym: string): string {
  if (!t.paidAt) return '';
  return t.paidAt[ym] ?? '';
}

export function setPaid(
  t: Transaction,
  ym: string,
  value: boolean,
  date: string,
): void {
  if (!t.paid || typeof t.paid !== 'object') t.paid = {};
  if (value) {
    t.paid[ym] = true;
    if (!t.paidAt) t.paidAt = {};
    if (!t.paidAt[ym]) t.paidAt[ym] = date;
  } else {
    delete t.paid[ym];
    if (t.paidAt) delete t.paidAt[ym];
  }
}
