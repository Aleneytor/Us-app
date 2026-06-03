import type { AppPayload, Plan, PlanCategory, PlanExpense, PlanExpenseSplit, PlanMember, PlanSettlement, SavingPlan, SavingPlanHistoryEntry, UserId } from '../types';

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
  return typeof value === 'string' && value.trim() ? value.trim() : 'demo_a';
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
  const monthsRaw = Math.trunc(asNumber(record.months));
  const months = monthsRaw > 0 ? monthsRaw : undefined;
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
    iconColor: typeof record.iconColor === 'string' && record.iconColor.trim() ? record.iconColor.trim() : undefined,
    link: typeof record.link === 'string' && record.link.trim() ? record.link.trim() : undefined,
    notes: typeof record.notes === 'string' && record.notes.trim() ? record.notes.trim() : undefined,
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

function normalizePlanExpenseSplit(value: unknown): PlanExpenseSplit | null {
  const r = asRecord(value);
  if (!r || typeof r.memberId !== 'string' || !r.memberId) return null;
  const amount = asNumber(r.amount);
  if (amount < 0) return null;
  return {
    memberId: r.memberId,
    parts: typeof r.parts === 'number' && r.parts > 0 ? r.parts : undefined,
    pct: typeof r.pct === 'number' && r.pct >= 0 ? r.pct : undefined,
    amount,
  };
}

function normalizePlanSettlement(value: unknown): PlanSettlement | null {
  const r = asRecord(value);
  if (!r || typeof r.fromMemberId !== 'string' || typeof r.toMemberId !== 'string') return null;
  const amount = asNumber(r.amount);
  if (amount <= 0) return null;
  return {
    id: asNumber(r.id) || Date.now(),
    fromMemberId: r.fromMemberId,
    toMemberId: r.toMemberId,
    amount,
    date: typeof r.date === 'string' && r.date ? r.date : fallbackDate(),
    note: typeof r.note === 'string' && r.note ? r.note : undefined,
  };
}

// memberCount is used to generate fallback equal splits for legacy expenses
function normalizePlanExpense(value: unknown, memberCount: number): PlanExpense | null {
  const r = asRecord(value);
  if (!r || typeof r.memberId !== 'string' || !r.memberId) return null;
  const amount = asNumber(r.amount);
  if (amount <= 0) return null;

  const rawSplitMode = r.splitMode;
  const splitMode: PlanExpense['splitMode'] =
    rawSplitMode === 'parts' || rawSplitMode === 'percentage' ? rawSplitMode : 'equal';

  const rawSplits = Array.isArray(r.splits)
    ? r.splits.map(normalizePlanExpenseSplit).filter((x): x is PlanExpenseSplit => !!x)
    : [];

  // Legacy migration: if no splits stored, leave empty — computeMemberBalances handles it
  const splits = rawSplits.length > 0 ? rawSplits : [];

  // title: prefer explicit title, fall back to legacy note or memberName
  const rawTitle = r.title ?? r.note;
  const title = typeof rawTitle === 'string' && rawTitle.trim()
    ? rawTitle.trim()
    : typeof r.memberName === 'string' && r.memberName
      ? r.memberName
      : 'Gasto';

  return {
    id: asNumber(r.id) || Date.now(),
    categoryId: r.categoryId !== undefined ? asNumber(r.categoryId) : undefined,
    memberId: r.memberId,
    memberName: typeof r.memberName === 'string' ? r.memberName : '',
    title,
    amount,
    date: typeof r.date === 'string' && r.date ? r.date : fallbackDate(),
    splitMode,
    splits,
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
    ? r.expenses.map((e) => normalizePlanExpense(e, members.length)).filter((x): x is PlanExpense => !!x)
    : [];
  const settlements = Array.isArray(r.settlements)
    ? r.settlements.map(normalizePlanSettlement).filter((x): x is PlanSettlement => !!x)
    : [];

  // Migrate old splitMode: 'custom' → 'percentage' (closest semantic match)
  const rawSplitMode = r.splitMode;
  const splitMode: Plan['splitMode'] =
    rawSplitMode === 'parts' || rawSplitMode === 'percentage'
      ? rawSplitMode
      : 'equal';
  const budget = asNumber(r.budget);

  return {
    id: asNumber(r.id) || Date.now(),
    title: r.title.trim(),
    icon: typeof r.icon === 'string' ? r.icon : 'map',
    iconColor: typeof r.iconColor === 'string' ? r.iconColor : undefined,
    description: typeof r.description === 'string' && r.description ? r.description : undefined,
    date: typeof r.date === 'string' && r.date ? r.date : fallbackDate(),
    members,
    categories,
    expenses,
    settlements,
    splitMode,
    budget: budget > 0 ? budget : undefined,
    finalizedAt: typeof r.finalizedAt === 'string' && r.finalizedAt ? r.finalizedAt : undefined,
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
