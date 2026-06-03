// ─── User types ─────────────────────────────────────────────────────────────

import type { ImageSourcePropType } from 'react-native';

export type UserId = string;

export interface UserData {
  name: string;
  initials: string;
  color: string;
  bg: string;
  photo?: ImageSourcePropType;
}

export const USERS: Record<string, UserData> = {
  demo_a: { name: 'Demo',        initials: 'DM', color: '#7C3AED', bg: '#EDE9FE' },
  demo_b: { name: 'Pareja Demo', initials: 'PD', color: '#E11D48', bg: '#FFE4E6' },
  alan:   { name: 'Alan',        initials: 'AL', color: '#4F46E5', bg: '#E0E7FF', photo: require('../assets/images/alan.png') },
  gabi:   { name: 'Gabi',        initials: 'GA', color: '#DB2777', bg: '#FCE7F3', photo: require('../assets/images/gabi.png') },
};

export const ROOM_FOR_USER: Record<string, string> = {
  demo_a: 'demo-main',
  demo_b: 'demo-main',
  alan:   'alan-gabi-main',
  gabi:   'alan-gabi-main',
};

export const PARTNER: Record<string, string> = {
  demo_a: 'demo_b',
  demo_b: 'demo_a',
  alan:   'gabi',
  gabi:   'alan',
};

// ─── Data models ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: number;
  uid: UserId;
  cat: string;
  iconColor: string;
  desc: string;
  account: string;
  amt: number;
  date: string;                          // 'YYYY-MM-DD'
  type: 'monthly' | 'biweekly' | 'weekly' | 'once';
  kind: 'expense' | 'income';
  notes: string;
  tags?: string[];
  del?: boolean;                         // soft delete
  paid?: Record<string, boolean>;        // { 'YYYY-MM': true }
  paidAt?: Record<string, string>;       // { 'YYYY-MM': 'YYYY-MM-DD' }
  budgetCatId?: number;                  // id of BudgetCategory, if assigned
}

export interface BudgetCategory {
  id: number;
  name: string;
  icon: string;         // CATEGORIES key, e.g. 'restaurant'
  iconColor: string;    // ICON_COLORS id, e.g. 'purple'
  monthlyBudget: number;
  uid?: UserId;         // undefined = shared with partner; set = personal
  notes?: string;
}

export interface SavingPlanHistoryEntry {
  id: number;
  uid: UserId;
  amount: number;
  date: string;            // 'YYYY-MM-DD'
  note?: string;
  source?: 'balance' | 'existing'; // 'balance' = descuenta del saldo; 'existing' = ahorros previos; undefined = no descuenta (compat)
}

export interface SavingPlan {
  id: number;
  saveType?: 'free' | 'goal'; // 'free' = sin meta; 'goal' = monto objetivo; undefined = legacy 'goal'
  type?: 'joint' | 'personal';
  uid?: UserId;            // only when type === 'personal'
  icon?: string;            // CATEGORIES key, e.g. 'savings'
  iconColor?: string;
  title: string;
  targetAmount: number;    // 0 when saveType === 'free'
  months?: number;          // integer - how many months to save (optional, only for 'goal')
  link?: string;
  notes?: string;
  date: string;            // 'YYYY-MM-DD' - date added
  history?: SavingPlanHistoryEntry[];
}

export interface Goal {
  id: number;
  type: 'joint' | 'personal';
  cat: string;
  iconColor: string;
  name: string;
  target: number;
  date: string;            // 'YYYY-MM-DD'
  em?: string;             // legacy emoji
  uid?: UserId;            // only when type === 'personal'
  notes?: string;
}

export interface Contribution {
  id: number;
  gid: number;             // Goal id
  uid: UserId;
  amt: number;
  date: string;            // 'YYYY-MM-DD'
  note: string;
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export interface PlanMember {
  id: string;           // uid for app users, generated string for externals
  uid?: UserId;
  name: string;
  initials: string;
  color: string;
  bg: string;
  splitPct?: number;    // 0–100, used when splitMode === 'custom'
}

export interface PlanCategory {
  id: number;
  name: string;
  icon: string;         // CATEGORIES key
  totalAmount: number;
}

export interface PlanExpenseSplit {
  memberId: string;     // PlanMember.id
  parts?: number;       // weight used when splitMode === 'parts'
  pct?: number;         // 0–100, used when splitMode === 'percentage'
  amount: number;       // calculated share for this member
}

export interface PlanExpense {
  id: number;
  categoryId?: number;  // optional — expense can exist without a category
  memberId: string;     // PlanMember.id — who paid
  memberName: string;
  title: string;        // display name of the expense
  amount: number;
  date: string;         // 'YYYY-MM-DD'
  splitMode: 'equal' | 'parts' | 'percentage';
  splits: PlanExpenseSplit[];
  note?: string;
}

export interface PlanSettlement {
  id: number;
  fromMemberId: string; // who pays
  toMemberId: string;   // who receives
  amount: number;
  date: string;         // 'YYYY-MM-DD'
  note?: string;
}

export interface Plan {
  id: number;
  title: string;
  icon: string;
  iconColor?: string;
  description?: string;
  date: string;         // 'YYYY-MM-DD'
  members: PlanMember[];
  categories: PlanCategory[];
  expenses: PlanExpense[];
  settlements: PlanSettlement[];
  splitMode: 'equal' | 'parts' | 'percentage';
  budget?: number;
  finalizedAt?: string;   // 'YYYY-MM-DD' when the plan is closed
}

// Colors for external plan members (cycles through these)
export const MEMBER_COLORS = [
  { color: '#059669', bg: '#D1FAE5' },
  { color: '#9333EA', bg: '#F3E8FF' },
  { color: '#DC2626', bg: '#FEE2E2' },
  { color: '#F59E0B', bg: '#FEF3C7' },
  { color: '#0891B2', bg: '#CFFAFE' },
  { color: '#65A30D', bg: '#ECFCCB' },
  { color: '#EA580C', bg: '#FFEDD5' },
];

export interface AppPayload {
  expenses: Transaction[];
  savings: SavingPlan[];
  goals: Goal[];
  contribs: Contribution[];
  budgetCategories: BudgetCategory[];
  plans: Plan[];
}

// Re-export for convenience
export type PlanSplitMode = Plan['splitMode'];

// Currency

export type CurrencyCode = 'EUR' | 'USD' | 'BS' | 'COP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  label: string;
  locale: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  EUR: { code: 'EUR', symbol: '€', label: 'Euro (€)', locale: 'es-ES' },
  USD: { code: 'USD', symbol: '$', label: 'Dolar ($)', locale: 'en-US' },
  BS: { code: 'BS', symbol: 'Bs.', label: 'Bolivar (Bs.)', locale: 'es-VE' },
  COP: { code: 'COP', symbol: '$', label: 'Peso Colombiano ($)', locale: 'es-CO' },
};
