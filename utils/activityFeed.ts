import { CATEGORIES } from '../constants/categories';
import type {
  AppPayload,
  Contribution,
  Goal,
  Plan,
  PlanExpense,
  PlanSettlement,
  SavingPlan,
  SavingPlanHistoryEntry,
  Transaction,
  UserId,
} from '../types';
import { isMonthVisible } from './filters';

export type ActivityItem =
  | {
      source: 'transaction';
      id: string;
      date: string;
      ownerId?: UserId;
      kind: 'expense' | 'income';
      categoryKey?: string;
      amount: number;
      searchText: string;
      sortId: number;
      transaction: Transaction;
    }
  | {
      source: 'plan_expense';
      id: string;
      date: string;
      ownerId?: UserId;
      kind: 'expense';
      title: string;
      subtitle: string;
      iconKey: string;
      iconColor: string;
      amount: number;
      searchText: string;
      sortId: number;
      planId: number;
      expenseId: number;
    }
  | {
      source: 'plan_settlement';
      id: string;
      date: string;
      ownerId?: UserId;
      kind: 'expense' | 'income';
      title: string;
      subtitle: string;
      iconKey: string;
      iconColor: string;
      amount: number;
      searchText: string;
      sortId: number;
      planId: number;
      settlementId: number;
    }
  | {
      source: 'plan_created';
      id: string;
      date: string;
      ownerId?: UserId;
      kind: 'plan';
      title: string;
      subtitle: string;
      iconKey: string;
      iconColor: string;
      searchText: string;
      sortId: number;
      planId: number;
    }
  | {
      source: 'saving_created';
      id: string;
      date: string;
      ownerId?: UserId;
      kind: 'saving';
      title: string;
      subtitle: string;
      iconKey: string;
      iconColor: string;
      searchText: string;
      sortId: number;
      savingId: number;
    }
  | {
      source: 'goal_created';
      id: string;
      date: string;
      ownerId?: UserId;
      kind: 'saving';
      title: string;
      subtitle: string;
      iconKey: string;
      iconColor: string;
      searchText: string;
      sortId: number;
      goalId: number;
    }
  | {
      source: 'saving_contribution';
      id: string;
      date: string;
      ownerId?: UserId;
      kind: 'saving';
      title: string;
      subtitle: string;
      iconKey: string;
      iconColor: string;
      amount: number;
      searchText: string;
      sortId: number;
      savingId: number;
      entryId: number;
    }
  | {
      source: 'goal_contribution';
      id: string;
      date: string;
      ownerId?: UserId;
      kind: 'saving';
      title: string;
      subtitle: string;
      iconKey: string;
      iconColor: string;
      amount: number;
      searchText: string;
      sortId: number;
      goalId: number;
      contributionId: number;
    };

interface ActivityFeedOptions {
  currentUser: UserId;
  selectedYM: string;
  includeAllMonths?: boolean;
}

function matchesMonth(date: string, ym: string, includeAllMonths?: boolean): boolean {
  return includeAllMonths || date.startsWith(ym);
}

function planOwnerId(plan: Plan): UserId | undefined {
  const creator = plan.members[0];
  return creator?.uid ?? creator?.id;
}

function planExpenseOwnerId(plan: Plan, expense: PlanExpense): UserId | undefined {
  const member = plan.members.find((m) => m.id === expense.memberId);
  return member?.uid ?? member?.id;
}

function memberOwnerId(member?: Plan['members'][0]): UserId | undefined {
  return member?.uid ?? member?.id;
}

function isCurrentMember(member: Plan['members'][0] | undefined, currentUser: UserId): boolean {
  return member?.uid === currentUser || member?.id === currentUser;
}

function canSeeSaving(plan: SavingPlan, currentUser: UserId): boolean {
  return (plan.type ?? 'personal') === 'joint' || !plan.uid || plan.uid === currentUser;
}

function canSeeGoal(goal: Goal, currentUser: UserId): boolean {
  return goal.type === 'joint' || !goal.uid || goal.uid === currentUser;
}

function canSeePlan(plan: Plan, currentUser: UserId): boolean {
  return plan.members.some((member) => member.uid === currentUser || member.id === currentUser);
}

function transactionSearchText(transaction: Transaction): string {
  const category = CATEGORIES[transaction.cat]?.label ?? transaction.cat;
  return [
    transaction.desc,
    category,
    transaction.account,
    transaction.notes,
  ].join(' ').toLowerCase();
}

function savingContributionItem(plan: SavingPlan, entry: SavingPlanHistoryEntry): ActivityItem {
  const title = `Aporte a ${plan.title}`;
  const subtitle = `Ahorro: ${plan.title}`;
  return {
    source: 'saving_contribution',
    id: `saving-${plan.id}-${entry.id}`,
    date: entry.date,
    ownerId: entry.uid,
    kind: 'saving',
    title,
    subtitle,
    iconKey: plan.icon ?? 'savings',
    iconColor: plan.iconColor ?? 'purple',
    amount: entry.amount,
    searchText: [title, subtitle, entry.note ?? ''].join(' ').toLowerCase(),
    sortId: Number(entry.id) || 0,
    savingId: plan.id,
    entryId: entry.id,
  };
}

function goalContributionItem(goal: Goal, contribution: Contribution): ActivityItem {
  const title = contribution.note ? contribution.note : `Aporte a ${goal.name}`;
  const subtitle = `Ahorro: ${goal.name}`;
  return {
    source: 'goal_contribution',
    id: `goal-${goal.id}-contribution-${contribution.id}`,
    date: contribution.date,
    ownerId: contribution.uid,
    kind: 'saving',
    title,
    subtitle,
    iconKey: goal.cat ?? 'savings',
    iconColor: goal.iconColor ?? 'purple',
    amount: contribution.amt,
    searchText: [title, subtitle, contribution.note ?? ''].join(' ').toLowerCase(),
    sortId: Number(contribution.id) || 0,
    goalId: goal.id,
    contributionId: contribution.id,
  };
}

export function buildActivityFeed(
  payload: AppPayload,
  { currentUser, selectedYM, includeAllMonths = false }: ActivityFeedOptions,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const transaction of payload.expenses) {
    if (transaction.del) continue;
    if (!includeAllMonths && !isMonthVisible(transaction, selectedYM)) continue;
    items.push({
      source: 'transaction',
      id: `tx-${transaction.id}`,
      date: transaction.date,
      ownerId: transaction.uid,
      kind: transaction.kind,
      categoryKey: transaction.cat,
      amount: transaction.amt,
      searchText: transactionSearchText(transaction),
      sortId: Number(transaction.id) || 0,
      transaction,
    });
  }

  for (const saving of payload.savings ?? []) {
    if (!canSeeSaving(saving, currentUser)) continue;
    if (matchesMonth(saving.date, selectedYM, includeAllMonths)) {
      const title = saving.title;
      const subtitle = 'Ahorro creado';
      items.push({
        source: 'saving_created',
        id: `saving-${saving.id}-created`,
        date: saving.date,
        ownerId: saving.uid ?? currentUser,
        kind: 'saving',
        title,
        subtitle,
        iconKey: saving.icon ?? 'savings',
        iconColor: saving.iconColor ?? 'purple',
        searchText: [title, subtitle, saving.notes ?? '', saving.link ?? ''].join(' ').toLowerCase(),
        sortId: Number(saving.id) || 0,
        savingId: saving.id,
      });
    }

    for (const entry of saving.history ?? []) {
      if (!matchesMonth(entry.date, selectedYM, includeAllMonths)) continue;
      items.push(savingContributionItem(saving, entry));
    }
  }

  for (const goal of payload.goals ?? []) {
    if (!canSeeGoal(goal, currentUser)) continue;
    if (matchesMonth(goal.date, selectedYM, includeAllMonths)) {
      const title = goal.name;
      const subtitle = 'Ahorro creado';
      items.push({
        source: 'goal_created',
        id: `goal-${goal.id}-created`,
        date: goal.date,
        ownerId: goal.uid ?? currentUser,
        kind: 'saving',
        title,
        subtitle,
        iconKey: goal.cat ?? 'savings',
        iconColor: goal.iconColor ?? 'purple',
        searchText: [title, subtitle, goal.notes ?? ''].join(' ').toLowerCase(),
        sortId: Number(goal.id) || 0,
        goalId: goal.id,
      });
    }

    for (const contribution of payload.contribs ?? []) {
      if (String(contribution.gid) !== String(goal.id)) continue;
      if (!matchesMonth(contribution.date, selectedYM, includeAllMonths)) continue;
      items.push(goalContributionItem(goal, contribution));
    }
  }

  for (const plan of payload.plans ?? []) {
    if (!canSeePlan(plan, currentUser)) continue;
    if (matchesMonth(plan.date, selectedYM, includeAllMonths)) {
      const title = plan.title;
      const subtitle = 'Plan creado';
      items.push({
        source: 'plan_created',
        id: `plan-${plan.id}-created`,
        date: plan.date,
        ownerId: planOwnerId(plan),
        kind: 'plan',
        title,
        subtitle,
        iconKey: plan.icon ?? 'map',
        iconColor: plan.iconColor ?? 'blue',
        searchText: [title, subtitle, plan.description ?? ''].join(' ').toLowerCase(),
        sortId: Number(plan.id) || 0,
        planId: plan.id,
      });
    }

    for (const expense of plan.expenses ?? []) {
      if (!matchesMonth(expense.date, selectedYM, includeAllMonths)) continue;
      const subtitle = plan.title;
      items.push({
        source: 'plan_expense',
        id: `plan-${plan.id}-expense-${expense.id}`,
        date: expense.date,
        ownerId: planExpenseOwnerId(plan, expense),
        kind: 'expense',
        title: expense.title,
        subtitle,
        iconKey: plan.icon ?? 'map',
        iconColor: plan.iconColor ?? 'blue',
        amount: expense.amount,
        searchText: [expense.title, subtitle, expense.memberName, expense.note ?? ''].join(' ').toLowerCase(),
        sortId: Number(expense.id) || 0,
        planId: plan.id,
        expenseId: expense.id,
      });
    }

    for (const settlement of plan.settlements ?? []) {
      if (!matchesMonth(settlement.date, selectedYM, includeAllMonths)) continue;
      const fromMember = plan.members.find((member) => member.id === settlement.fromMemberId);
      const toMember = plan.members.find((member) => member.id === settlement.toMemberId);
      const paidByCurrentUser = isCurrentMember(fromMember, currentUser);
      const paidToCurrentUser = isCurrentMember(toMember, currentUser);
      if (!paidByCurrentUser && !paidToCurrentUser) continue;

      const title = paidToCurrentUser
        ? `${fromMember?.name ?? 'Alguien'} te pagó`
        : `Pagaste a ${toMember?.name ?? 'alguien'}`;
      items.push({
        source: 'plan_settlement',
        id: `plan-${plan.id}-settlement-${settlement.id}-${paidToCurrentUser ? 'in' : 'out'}`,
        date: settlement.date,
        ownerId: paidToCurrentUser ? memberOwnerId(toMember) : memberOwnerId(fromMember),
        kind: paidToCurrentUser ? 'income' : 'expense',
        title,
        subtitle: plan.title,
        iconKey: plan.icon ?? 'map',
        iconColor: plan.iconColor ?? 'blue',
        amount: settlement.amount,
        searchText: [title, plan.title, fromMember?.name ?? '', toMember?.name ?? '', settlement.note ?? ''].join(' ').toLowerCase(),
        sortId: Number(settlement.id) || 0,
        planId: plan.id,
        settlementId: settlement.id,
      });
    }
  }

  return items.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.sortId - a.sortId;
  });
}
