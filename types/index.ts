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
  a: { name: 'Alan',       initials: 'A',  color: '#2563EB', bg: '#DBEAFE' },
  b: { name: 'Gabi',       initials: 'G',  color: '#E11D48', bg: '#FFE4E6' },
  c: { name: 'Fabi',       initials: 'F',  color: '#7C3AED', bg: '#EDE9FE' },
  d: { name: 'Julio',      initials: 'J',  color: '#0D9488', bg: '#CCFBF1' },
  e: { name: 'Franchesca', initials: 'Fr', color: '#D97706', bg: '#FEF3C7' },
};

export const ROOM_FOR_USER: Record<string, string> = {
  a: 'nosotros-main',
  b: 'nosotros-main',
  c: 'fabijulio-main',
  d: 'fabijulio-main',
  e: 'franchesca-main',
};

export const PARTNER: Record<string, string> = {
  a: 'b', b: 'a', c: 'd', d: 'c', e: 'e',
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
  type: 'monthly' | 'once';
  kind: 'expense' | 'income';
  tags: string[];                        // e.g. ['#comida', '#mercado']
  notes: string;
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
  monthlyIncomeEstimate?: number;  // optional: estimated monthly income for this category
  uid?: UserId;         // undefined = shared with partner; set = personal
  notes?: string;
}

export interface SavingPlanHistoryEntry {
  id: number;
  uid: UserId;
  amount: number;
  date: string;            // 'YYYY-MM-DD'
  note?: string;
}

export interface SavingPlan {
  id: number;
  type?: 'joint' | 'personal';
  uid?: UserId;            // only when type === 'personal'
  icon?: string;            // CATEGORIES key, e.g. 'savings'
  title: string;
  targetAmount: number;
  months: number;          // integer - how many months to save
  link?: string;
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

export interface PlanExpense {
  id: number;
  categoryId: number;
  memberId: string;     // PlanMember.id
  memberName: string;
  amount: number;
  date: string;         // 'YYYY-MM-DD'
  note?: string;
}

export interface Plan {
  id: number;
  title: string;
  icon: string;
  description?: string;
  date: string;         // 'YYYY-MM-DD'
  members: PlanMember[];
  categories: PlanCategory[];
  expenses: PlanExpense[];
  splitMode: 'equal' | 'custom';
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
