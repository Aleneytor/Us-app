import type { AppPayload, UserId, Goal, Wish, Contribution } from '../types';
import { isMonthVisible } from './filters';

export function calcDashboard(
  payload: AppPayload,
  uid: UserId,
  ym: string,
) {
  const visible = payload.expenses.filter(
    (t) => t.uid === uid && !t.del && isMonthVisible(t, ym),
  );
  const gastos   = visible.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amt, 0);
  const ingresos = visible.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amt, 0);
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

export function wishMonthlySaving(wish: Wish): number | null {
  if (!wish.months || wish.months <= 0) return null;
  return wish.price / wish.months;
}
