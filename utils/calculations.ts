import type { AppPayload, UserId, Goal, SavingPlan, Contribution, Transaction, BudgetCategory } from '../types';
import { getOccurrenceDatesInMonth, getPaid, getTransactionAmountForMonth, isMonthVisible } from './filters';
import { todayStr } from './format';

export function calcDashboard(
  payload: AppPayload,
  uid: UserId,
  ym: string,
) {
  const visible = payload.expenses.filter(
    (t) => t.uid === uid && !t.del && isMonthVisible(t, ym),
  );
  const gastos   = visible.filter((t) => t.kind === 'expense').reduce((s, t) => s + getTransactionAmountForMonth(t, ym), 0);
  const ingresos = visible.filter((t) => t.kind === 'income').reduce((s, t) => s + getTransactionAmountForMonth(t, ym), 0);
  const ahorrado = payload.contribs
    .filter((c) => c.uid === uid && c.date.slice(0, 7) === ym)
    .reduce((s, c) => s + c.amt, 0);

  return { gastos, ingresos, disponible: ingresos - gastos, ahorrado };
}

export function goalProgress(goal: Goal, contribs: Contribution[]) {
  const total = contribs
    .filter((c) => String(c.gid) === String(goal.id))
    .reduce((s, c) => s + c.amt, 0);
  const pct = goal.target > 0 ? Math.min(100, (total / goal.target) * 100) : 0;
  return { total, pct, remaining: Math.max(0, goal.target - total) };
}

export function savingPlanMonthlyAmount(plan: SavingPlan): number {
  return plan.months ? plan.targetAmount / plan.months : 0;
}

export function savingPlanSavedAmount(plan: SavingPlan): number {
  return (plan.history ?? []).reduce((sum, entry) => sum + entry.amount, 0);
}

export function savingPlanProgress(plan: SavingPlan) {
  const total = savingPlanSavedAmount(plan);
  const pct = plan.targetAmount > 0 ? Math.min(100, (total / plan.targetAmount) * 100) : 0;
  return { total, pct, remaining: Math.max(0, plan.targetAmount - total) };
}

export function calcSaldoActual(payload: AppPayload, uid: UserId): number {
  let total = 0;

  for (const t of payload.expenses) {
    if (t.del || t.uid !== uid) continue;

    if (t.type === 'once') {
      const ym = t.date.slice(0, 7);
      if (getPaid(t, ym)) total += t.kind === 'income' ? t.amt : -t.amt;
      continue;
    }

    if (!t.paid || typeof t.paid !== 'object') continue;
    for (const [ym, isPaid] of Object.entries(t.paid)) {
      if (isPaid) {
        const monthAmount = getTransactionAmountForMonth(t, ym);
        total += t.kind === 'income' ? monthAmount : -monthAmount;
      }
    }
  }

  return total;
}

export function calcSaldoProyectado(
  payload: AppPayload,
  uid: UserId,
  ym: string,
): number {
  const actual = calcSaldoActual(payload, uid);
  const ingresoActualMes = calcIngresosActual(payload, uid, ym);
  const gastoActualMes = calcGastosActual(payload, uid, ym);
  const ingresoProyectadoMes = calcIngresosProyectados(payload, uid, ym);
  const gastoProyectadoMes = calcGastosProyectados(payload, uid, ym);

  return actual
    + Math.max(0, ingresoProyectadoMes - ingresoActualMes)
    - Math.max(0, gastoProyectadoMes - gastoActualMes);
}

export function calcGastosActual(payload: AppPayload, uid: UserId, ym: string): number {
  return payload.expenses
    .filter((t) => t.uid === uid && !t.del && t.kind === 'expense' && isMonthVisible(t, ym) && getPaid(t, ym))
    .reduce((sum, t) => sum + getTransactionAmountForMonth(t, ym), 0);
}

export function calcGastosProyectados(payload: AppPayload, uid: UserId, ym: string): number {
  const categories = getBudgetCategoriesForUser(payload, uid);
  const categoryIds = new Set(categories.map((bc) => String(bc.id)));
  const categoryBudgets = categories.reduce((sum, category) => {
    const spent = sumTransactionsForBudgetCategory(payload, category.id, uid, ym, 'expense');
    return sum + Math.max(category.monthlyBudget, spent);
  }, 0);
  const unbudgetedTransactions = payload.expenses
    .filter(
      (t) =>
        t.uid === uid &&
        !t.del &&
        t.kind === 'expense' &&
        isMonthVisible(t, ym) &&
        !categoryIds.has(String(t.budgetCatId)),
    )
    .reduce((sum, t) => sum + getTransactionAmountForMonth(t, ym), 0);

  return categoryBudgets + unbudgetedTransactions;
}

export function calcIngresosActual(payload: AppPayload, uid: UserId, ym: string): number {
  return payload.expenses
    .filter((t) => t.uid === uid && !t.del && t.kind === 'income' && isMonthVisible(t, ym) && getPaid(t, ym))
    .reduce((sum, t) => sum + getTransactionAmountForMonth(t, ym), 0);
}

export function calcIngresosProyectados(payload: AppPayload, uid: UserId, ym: string): number {
  return payload.expenses
    .filter(
      (t) =>
        t.uid === uid &&
        !t.del &&
        t.kind === 'income' &&
        isMonthVisible(t, ym),
    )
    .reduce((sum, t) => sum + getTransactionAmountForMonth(t, ym), 0);
}

export function calcBudgetCategorySpending(
  payload: AppPayload,
  catId: number,
  ym: string,
): number {
  return payload.expenses
    .filter(
      (t) =>
        !t.del &&
        t.kind === 'expense' &&
        String(t.budgetCatId) === String(catId) &&
        isMonthVisible(t, ym),
    )
    .reduce((sum, t) => sum + getTransactionAmountForMonth(t, ym), 0);
}

export function calcBudgetCategoryIncome(
  payload: AppPayload,
  catId: number,
  ym: string,
): number {
  return payload.expenses
    .filter(
      (t) =>
        !t.del &&
        t.kind === 'income' &&
        String(t.budgetCatId) === String(catId) &&
        isMonthVisible(t, ym),
    )
    .reduce((sum, t) => sum + getTransactionAmountForMonth(t, ym), 0);
}

function getBudgetCategoriesForUser(payload: AppPayload, uid: UserId): BudgetCategory[] {
  return (payload.budgetCategories ?? []).filter((bc) => bc.uid === undefined || bc.uid === uid);
}

function sumTransactionsForBudgetCategory(
  payload: AppPayload,
  catId: number,
  uid: UserId,
  ym: string,
  kind: Transaction['kind'],
): number {
  return payload.expenses
    .filter(
      (t) =>
        t.uid === uid &&
        !t.del &&
        t.kind === kind &&
        String(t.budgetCatId) === String(catId) &&
        isMonthVisible(t, ym),
    )
    .reduce((sum, t) => sum + getTransactionAmountForMonth(t, ym), 0);
}

export function getProximosMovimientos(
  payload: AppPayload,
  uid: UserId,
  daysAhead: number = 7,
): Array<{ transaction: Transaction; dueDate: string; daysLeft: number }> {
  const today = todayStr();
  const [ty, tm, td] = today.split('-').map(Number);
  const todayMs = new Date(ty, tm - 1, td).getTime();
  const limitMs = todayMs + daysAhead * 86_400_000;
  const currentYM = today.slice(0, 7);
  const nextYM = addMonths(currentYM, 1);
  const results: Array<{ transaction: Transaction; dueDate: string; daysLeft: number }> = [];

  for (const t of payload.expenses) {
    if (t.del || t.uid !== uid) continue;

    let dueDate = t.date;
    let paidYM = t.date.slice(0, 7);

    if (t.type !== 'once') {
      const candidateDates = [
        ...getOccurrenceDatesInMonth(t, currentYM),
        ...getOccurrenceDatesInMonth(t, nextYM),
      ];
      const nextDueDate = candidateDates.find((candidate) => candidate >= today);
      if (!nextDueDate) continue;
      dueDate = nextDueDate;
      paidYM = dueDate.slice(0, 7);
    }

    if (dueDate < today) continue;
    if (getPaid(t, paidYM)) continue;

    const [dy, dm, dd] = dueDate.split('-').map(Number);
    const dueDateMs = new Date(dy, dm - 1, dd).getTime();
    if (dueDateMs > limitMs) continue;

    const daysLeft = Math.round((dueDateMs - todayMs) / 86_400_000);
    results.push({ transaction: t, dueDate, daysLeft });
  }

  return results.sort((a, b) => a.daysLeft - b.daysLeft);
}

function addMonths(ym: string, amount: number): string {
  const [year, month] = ym.split('-').map(Number);
  const next = new Date(year, month - 1 + amount, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}
