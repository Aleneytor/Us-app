// ─── User types ─────────────────────────────────────────────────────────────

export type UserId = 'a' | 'b' | 'c' | 'd';

export interface UserData {
  name: string;
  initials: string;
  color: string;
  bg: string;
}

export const USERS: Record<UserId, UserData> = {
  a: { name: 'Alan',  initials: 'A', color: '#2563EB', bg: '#DBEAFE' },
  b: { name: 'Gabi',  initials: 'G', color: '#E11D48', bg: '#FFE4E6' },
  c: { name: 'Fabi',  initials: 'F', color: '#7C3AED', bg: '#EDE9FE' },
  d: { name: 'Julio', initials: 'J', color: '#0D9488', bg: '#CCFBF1' },
};

export const ROOM_FOR_USER: Record<UserId, string> = {
  a: 'nosotros-main',
  b: 'nosotros-main',
  c: 'fabijulio-main',
  d: 'fabijulio-main',
};

export const PARTNER: Record<UserId, UserId> = {
  a: 'b', b: 'a', c: 'd', d: 'c',
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
}

export interface Wish {
  id: number;
  uid: UserId;
  cat: string;
  iconColor: string;
  name: string;
  price: number;
  months: number | null;   // integer — how many months to save
  link: string;
  tags: string[];
  date: string;            // 'YYYY-MM-DD' — date added
  em?: string;             // legacy emoji
  notes?: string;
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

export interface AppPayload {
  expenses: Transaction[];
  wishlist: Wish[];
  goals: Goal[];
  contribs: Contribution[];
}
