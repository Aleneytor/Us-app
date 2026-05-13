import type { Transaction } from '../types';

export function isMonthVisible(t: Transaction, targetYM: string): boolean {
  return getOccurrenceDatesInMonth(t, targetYM).length > 0;
}

export function getOccurrenceDatesInMonth(t: Transaction, targetYM: string): string[] {
  if (!t.date) return [];
  if (t.type === 'once') return t.date.slice(0, 7) === targetYM ? [t.date] : [];

  const start = parseDate(t.date);
  if (!start) return [];
  const [targetYear, targetMonth] = targetYM.split('-').map(Number);
  const monthStart = new Date(targetYear, targetMonth - 1, 1);
  const monthEnd = new Date(targetYear, targetMonth, 0);
  if (start > monthEnd) return [];

  if (t.type === 'monthly') {
    const day = Math.min(start.getDate(), monthEnd.getDate());
    const occurrence = new Date(targetYear, targetMonth - 1, day);
    return occurrence >= start ? [formatDate(occurrence)] : [];
  }

  const intervalDays = t.type === 'biweekly' ? 14 : 7;
  const first = new Date(start);
  if (first < monthStart) {
    const daysSinceStart = Math.floor((monthStart.getTime() - first.getTime()) / 86_400_000);
    const intervalsToMonth = Math.ceil(daysSinceStart / intervalDays);
    first.setDate(first.getDate() + intervalsToMonth * intervalDays);
  }

  const dates: string[] = [];
  for (const cursor = new Date(first); cursor <= monthEnd; cursor.setDate(cursor.getDate() + intervalDays)) {
    if (cursor >= monthStart) dates.push(formatDate(cursor));
  }
  return dates;
}

export function getTransactionAmountForMonth(t: Transaction, targetYM: string): number {
  return t.amt * getOccurrenceDatesInMonth(t, targetYM).length;
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

function parseDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
