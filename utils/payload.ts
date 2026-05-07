import type { AppPayload, SavingPlan, SavingPlanHistoryEntry, UserId } from '../types';

const fallbackDate = () => new Date().toISOString().slice(0, 10);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asUserId(value: unknown): UserId {
  return value === 'a' || value === 'b' || value === 'c' || value === 'd' ? value : 'a';
}

function normalizeSavingPlanHistoryEntry(value: unknown): SavingPlanHistoryEntry | null {
  const record = asRecord(value);
  if (!record) return null;

  const amount = asNumber(record.amount ?? record.amt);
  if (amount <= 0) return null;

  return {
    id: asNumber(record.id) || Date.now(),
    uid: asUserId(record.uid),
    amount,
    date: typeof record.date === 'string' && record.date.trim() ? record.date.trim() : fallbackDate(),
    note: typeof record.note === 'string' && record.note.trim() ? record.note.trim() : undefined,
  };
}

function normalizeSavingPlan(value: unknown): SavingPlan | null {
  const record = asRecord(value);
  if (!record) return null;

  const targetAmount = asNumber(record.targetAmount ?? record.price);
  const months = Math.max(1, Math.trunc(asNumber(record.months)));
  const titleValue = record.title ?? record.name;
  const title = typeof titleValue === 'string' ? titleValue.trim() : '';
  const rawType = record.type === 'joint' || record.scope === 'joint' ? 'joint' : 'personal';
  const historySource = Array.isArray(record.history) ? record.history : [];

  if (!title || targetAmount <= 0) return null;

  return {
    id: asNumber(record.id) || Date.now(),
    type: rawType,
    uid: rawType === 'personal' ? asUserId(record.uid) : undefined,
    icon: typeof (record.icon ?? record.cat) === 'string' && String(record.icon ?? record.cat).trim()
      ? String(record.icon ?? record.cat).trim()
      : 'savings',
    title,
    targetAmount,
    months,
    link: typeof record.link === 'string' && record.link.trim() ? record.link.trim() : undefined,
    date: typeof record.date === 'string' && record.date.trim() ? record.date.trim() : fallbackDate(),
    history: historySource
      .map(normalizeSavingPlanHistoryEntry)
      .filter((x): x is SavingPlanHistoryEntry => !!x),
  };
}

export function normalizeAppPayload(payload: unknown): AppPayload {
  const record = asRecord(payload);
  const savingsSource = record
    ? (Array.isArray(record.savings) ? record.savings : Array.isArray(record.wishlist) ? record.wishlist : [])
    : [];

  return {
    expenses: record && Array.isArray(record.expenses) ? record.expenses as AppPayload['expenses'] : [],
    savings: savingsSource.map(normalizeSavingPlan).filter((x): x is SavingPlan => !!x),
    goals: record && Array.isArray(record.goals) ? record.goals as AppPayload['goals'] : [],
    contribs: record && Array.isArray(record.contribs) ? record.contribs as AppPayload['contribs'] : [],
    budgetCategories: record && Array.isArray(record.budgetCategories)
      ? record.budgetCategories as AppPayload['budgetCategories']
      : [],
  };
}

export function isPayloadLike(payload: unknown): boolean {
  const record = asRecord(payload);
  return !!record
    && Array.isArray(record.expenses)
    && (Array.isArray(record.savings) || Array.isArray(record.wishlist))
    && Array.isArray(record.goals)
    && Array.isArray(record.contribs);
}
