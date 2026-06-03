import type { Plan, PlanExpenseSplit, PlanMember, PlanSettlement } from '../types';

// ─── Split computation ────────────────────────────────────────────────────────

/**
 * Given a total amount and member list, compute per-member split amounts.
 *
 * params shape depends on mode:
 *   equal      — params unused; amount divided equally among included members
 *   parts      — params: { [memberId]: number of parts }  (default 1 per member)
 *   percentage — params: { [memberId]: percentage 0-100 } (must sum to 100)
 */
export function computeSplits(
  amount: number,
  members: PlanMember[],
  mode: 'equal' | 'parts' | 'percentage',
  params: Record<string, number> = {},
): PlanExpenseSplit[] {
  if (members.length === 0 || amount <= 0) return [];

  if (mode === 'equal') {
    const share = round2(amount / members.length);
    const splits: PlanExpenseSplit[] = members.map((m) => ({
      memberId: m.id,
      amount: share,
    }));
    return adjustRemainder(splits, amount);
  }

  if (mode === 'parts') {
    const partsMap: Record<string, number> = {};
    for (const m of members) partsMap[m.id] = params[m.id] ?? 1;
    const totalParts = Object.values(partsMap).reduce((a, b) => a + b, 0);
    if (totalParts === 0) return computeSplits(amount, members, 'equal', {});
    const splits: PlanExpenseSplit[] = members.map((m) => ({
      memberId: m.id,
      parts: partsMap[m.id],
      amount: round2((partsMap[m.id] / totalParts) * amount),
    }));
    return adjustRemainder(splits, amount);
  }

  // percentage
  const pctMap: Record<string, number> = {};
  for (const m of members) pctMap[m.id] = params[m.id] ?? (100 / members.length);
  const splits: PlanExpenseSplit[] = members.map((m) => ({
    memberId: m.id,
    pct: pctMap[m.id],
    amount: round2((pctMap[m.id] / 100) * amount),
  }));
  return adjustRemainder(splits, amount);
}

// Adjusts the last split so the total is exact (avoids floating-point drift)
function adjustRemainder(splits: PlanExpenseSplit[], total: number): PlanExpenseSplit[] {
  if (splits.length === 0) return splits;
  const sum = splits.reduce((s, sp) => s + sp.amount, 0);
  const diff = round2(total - sum);
  if (diff === 0) return splits;
  const last = splits[splits.length - 1];
  splits[splits.length - 1] = { ...last, amount: round2(last.amount + diff) };
  return splits;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Member balance computation ───────────────────────────────────────────────

export interface MemberBalance {
  member: PlanMember;
  totalPaid: number;    // sum of expenses where memberId === member.id
  totalOwed: number;    // sum of splits assigned to this member
  settledIn: number;    // settlements received (toMemberId === member.id)
  settledOut: number;   // settlements sent (fromMemberId === member.id)
  netBalance: number;   // (totalPaid + settledOut) - (totalOwed + settledIn)
                        // positive = others owe this member
                        // negative = this member owes others
}

export function computeMemberBalances(plan: Plan): MemberBalance[] {
  const settlements: PlanSettlement[] = plan.settlements ?? [];

  return plan.members.map((member) => {
    const totalPaid = plan.expenses
      .filter((e) => e.memberId === member.id)
      .reduce((s, e) => s + e.amount, 0);

    const totalOwed = plan.expenses.reduce((s, e) => {
      const split = (e.splits ?? []).find((sp) => sp.memberId === member.id);
      if (split) return s + split.amount;
      // Fallback for legacy expenses with no splits: equal division
      return s + round2(e.amount / plan.members.length);
    }, 0);

    const settledIn = settlements
      .filter((st) => st.toMemberId === member.id)
      .reduce((s, st) => s + st.amount, 0);

    const settledOut = settlements
      .filter((st) => st.fromMemberId === member.id)
      .reduce((s, st) => s + st.amount, 0);

    const netBalance = round2((totalPaid + settledOut) - (totalOwed + settledIn));

    return { member, totalPaid, totalOwed, settledIn, settledOut, netBalance };
  });
}

// ─── Debt resolution ──────────────────────────────────────────────────────────

export interface DebtEdge {
  from: PlanMember;   // owes money
  to: PlanMember;     // is owed money
  amount: number;
}

/**
 * Given member balances, returns the minimum set of transfers to settle all debts.
 * Uses the greedy two-pointer algorithm.
 */
export function resolveDebts(balances: MemberBalance[]): DebtEdge[] {
  // creditors: netBalance > 0 (owed money)
  // debtors:   netBalance < 0 (owe money)
  const creditors = balances
    .filter((b) => b.netBalance > 0.005)
    .map((b) => ({ member: b.member, amount: b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((b) => b.netBalance < -0.005)
    .map((b) => ({ member: b.member, amount: -b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const edges: DebtEdge[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const transfer = round2(Math.min(credit.amount, debt.amount));

    edges.push({ from: debt.member, to: credit.member, amount: transfer });

    credit.amount = round2(credit.amount - transfer);
    debt.amount = round2(debt.amount - transfer);

    if (credit.amount < 0.005) ci++;
    if (debt.amount < 0.005) di++;
  }

  return edges;
}

// ─── Plan-level summary helpers ───────────────────────────────────────────────

/** Total amount spent in a plan (sum of all expenses). */
export function planTotalSpent(plan: Plan): number {
  return round2(plan.expenses.reduce((s, e) => s + e.amount, 0));
}

/** Total budget of a plan (plan budget or sum of category budgets). */
export function planTotalBudget(plan: Plan): number {
  if (plan.budget != null) return plan.budget;
  return round2(plan.categories.reduce((s, c) => s + c.totalAmount, 0));
}

/**
 * What the current user has paid + their share of what they owe.
 * Returns { paid, owed } for a given memberId.
 */
export function planMemberSummary(
  plan: Plan,
  memberId: string,
): { paid: number; owed: number } {
  const paid = round2(
    plan.expenses
      .filter((e) => e.memberId === memberId)
      .reduce((s, e) => s + e.amount, 0),
  );

  const owed = round2(
    plan.expenses.reduce((s, e) => {
      const split = (e.splits ?? []).find((sp) => sp.memberId === memberId);
      if (split) return s + split.amount;
      return plan.members.length > 0 ? s + round2(e.amount / plan.members.length) : s;
    }, 0),
  );

  return { paid, owed };
}
