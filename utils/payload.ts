import type { AppPayload, Plan, PlanCategory, PlanExpense, PlanMember, SavingPlan, SavingPlanHistoryEntry, UserId } from '../types';

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

function normalizePlanMember(value: unknown): PlanMember | null {
  const r = asRecord(value);
  if (!r || typeof r.id !== 'string' || !r.id || typeof r.name !== 'string' || !r.name) return null;
  return {
    id: r.id,
    uid: typeof r.uid === 'string' ? r.uid as UserId : undefined,
    name: r.name,
    initials: typeof r.initials === 'string' ? r.initials : r.name.slice(0, 2).toUpperCase(),
    color: typeof r.color === 'string' ? r.color : '#7C3AED',
    bg: typeof r.bg === 'string' ? r.bg : '#EDE9FE',
    splitPct: typeof r.splitPct === 'number' ? r.splitPct : undefined,
  };
}

function normalizePlanCategory(value: unknown): PlanCategory | null {
  const r = asRecord(value);
  if (!r || typeof r.name !== 'string' || !r.name) return null;
  return {
    id: asNumber(r.id) || Date.now(),
    name: r.name,
    icon: typeof r.icon === 'string' ? r.icon : 'map',
    totalAmount: asNumber(r.totalAmount),
  };
}

function normalizePlanExpense(value: unknown): PlanExpense | null {
  const r = asRecord(value);
  if (!r || typeof r.memberId !== 'string' || !r.memberId) return null;
  const amount = asNumber(r.amount);
  if (amount <= 0) return null;
  return {
    id: asNumber(r.id) || Date.now(),
    categoryId: asNumber(r.categoryId),
    memberId: r.memberId,
    memberName: typeof r.memberName === 'string' ? r.memberName : '',
    amount,
    date: typeof r.date === 'string' && r.date ? r.date : fallbackDate(),
    note: typeof r.note === 'string' && r.note ? r.note : undefined,
  };
}

function normalizePlan(value: unknown): Plan | null {
  const r = asRecord(value);
  if (!r || typeof r.title !== 'string' || !r.title) return null;
  const members = Array.isArray(r.members)
    ? r.members.map(normalizePlanMember).filter((x): x is PlanMember => !!x)
    : [];
  const categories = Array.isArray(r.categories)
    ? r.categories.map(normalizePlanCategory).filter((x): x is PlanCategory => !!x)
    : [];
  const expenses = Array.isArray(r.expenses)
    ? r.expenses.map(normalizePlanExpense).filter((x): x is PlanExpense => !!x)
    : [];
  return {
    id: asNumber(r.id) || Date.now(),
    title: r.title.trim(),
    icon: typeof r.icon === 'string' ? r.icon : 'map',
    description: typeof r.description === 'string' && r.description ? r.description : undefined,
    date: typeof r.date === 'string' && r.date ? r.date : fallbackDate(),
    members,
    categories,
    expenses,
    splitMode: r.splitMode === 'custom' ? 'custom' : 'equal',
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
    plans: record && Array.isArray(record.plans)
      ? record.plans.map(normalizePlan).filter((x): x is Plan => !!x)
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
