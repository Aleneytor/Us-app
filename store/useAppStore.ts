import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { fetchSnapshot, pushSnapshot, subscribeToRoom, deleteRoom } from '../services/supabase';
import { currentYM, todayStr } from '../utils/format';
import { normalizeAppPayload } from '../utils/payload';
import { cancelTransactionReminders, scheduleTransactionReminder } from '../services/notifications';
import { USERS, ROOM_FOR_USER, PARTNER } from '../types';
import type { AppPayload, Transaction, SavingPlan, Goal, Contribution, UserId, CurrencyCode, BudgetCategory, UserData, Plan, PlanCategory, PlanExpense } from '../types';

const STORAGE_USER_KEY     = 'nosotros_user';
const STORAGE_PAYLOAD_KEY  = 'nosotros_payload';
const STORAGE_CURRENCY_KEY = 'nosotros_currency';
const STORAGE_USERS_KEY    = 'nosotros_users';
const STORAGE_ROOMS_KEY    = 'nosotros_rooms';
const STORAGE_PARTNERS_KEY = 'nosotros_partners';

const payloadStorageKey = (roomId: string) => `${STORAGE_PAYLOAD_KEY}:${roomId}`;
const emptyPayload = (): AppPayload => ({ expenses: [], savings: [], goals: [], contribs: [], budgetCategories: [], plans: [] });

// ─── Store types ─────────────────────────────────────────────────────────────

interface AppState {
  payload: AppPayload;
  currentUser: UserId;
  selectedYM: string;
  currency: CurrencyCode;
  isConnected: boolean;
  syncStatus: 'live' | 'connecting' | 'error';
  clientId: string;
  users: Record<string, UserData>;
  roomForUser: Record<string, string>;
  partnerForUser: Record<string, string>;
}

interface AppActions {
  setCurrentUser: (uid: UserId) => Promise<void>;
  setSelectedYM: (ym: string) => void;
  setCurrency: (c: CurrencyCode) => Promise<void>;
  _setPayload: (payload: AppPayload) => void;
  _setSyncStatus: (status: AppState['syncStatus']) => void;
  addUser: (params: { uid: string; data: UserData; roomId: string; partnerId: string }) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
  addTransaction: (t: Transaction) => void;
  updateTransaction: (t: Transaction) => void;
  confirmTransaction: (id: number, ym: string, date: string) => void;
  deleteTransaction: (id: number) => void;
  addSavingPlan: (plan: SavingPlan) => void;
  updateSavingPlan: (plan: SavingPlan) => void;
  deleteSavingPlan: (id: number) => void;
  addGoal: (g: Goal) => void;
  updateGoal: (g: Goal) => void;
  deleteGoal: (id: number) => void;
  addContribution: (c: Contribution) => void;
  deleteContribution: (id: number) => void;
  addBudgetCategory: (bc: BudgetCategory) => void;
  updateBudgetCategory: (bc: BudgetCategory) => void;
  deleteBudgetCategory: (id: number) => void;
  addPlan: (plan: Plan) => void;
  updatePlan: (plan: Plan) => void;
  deletePlan: (id: number) => void;
  addPlanCategory: (planId: number, cat: PlanCategory) => void;
  updatePlanCategory: (planId: number, cat: PlanCategory) => void;
  deletePlanCategory: (planId: number, catId: number) => void;
  addPlanExpense: (planId: number, expense: PlanExpense) => void;
  deletePlanExpense: (planId: number, expenseId: number) => void;
}

// ─── Module-level (not in store — not serializable) ──────────────────────────

let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _channel: RealtimeChannel | null = null;

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  payload: emptyPayload(),
  currentUser: 'a',
  selectedYM: currentYM(),
  currency: 'EUR',
  isConnected: false,
  syncStatus: 'connecting',
  clientId: Math.random().toString(36).slice(2) + Date.now().toString(36),
  users: { ...USERS },
  roomForUser: { ...ROOM_FOR_USER },
  partnerForUser: { ...PARTNER },

  setCurrentUser: async (uid) => {
    await AsyncStorage.setItem(STORAGE_USER_KEY, uid);
    set({ currentUser: uid });
    await _connectToRoom(uid);
  },

  setSelectedYM: (ym) => set({ selectedYM: ym }),
  setCurrency: async (c) => {
    await AsyncStorage.setItem(STORAGE_CURRENCY_KEY, c);
    set({ currency: c });
  },
  _setPayload: (payload) => set({ payload: normalizeAppPayload(payload) }),
  _setSyncStatus: (syncStatus) => set({ syncStatus }),

  addUser: async ({ uid, data, roomId, partnerId }) => {
    const { users, roomForUser, partnerForUser } = get();
    const newUsers = { ...users, [uid]: data };
    const newRooms = { ...roomForUser, [uid]: roomId };
    const newPartners = { ...partnerForUser, [uid]: partnerId };
    set({ users: newUsers, roomForUser: newRooms, partnerForUser: newPartners });
    await AsyncStorage.multiSet([
      [STORAGE_USERS_KEY, JSON.stringify(newUsers)],
      [STORAGE_ROOMS_KEY, JSON.stringify(newRooms)],
      [STORAGE_PARTNERS_KEY, JSON.stringify(newPartners)],
    ]);
  },

  deleteUser: async (uid) => {
    const { users, roomForUser, partnerForUser, currentUser } = get();
    const newUsers = { ...users };
    delete newUsers[uid];
    const newRooms = { ...roomForUser };
    delete newRooms[uid];
    const newPartners = { ...partnerForUser };
    delete newPartners[uid];
    // Repair partner references pointing to the deleted user
    for (const id of Object.keys(newPartners)) {
      if (newPartners[id] === uid) newPartners[id] = id;
    }
    // Delete Supabase room only if no other remaining user shares it
    const roomId = roomForUser[uid];
    if (roomId && !Object.values(newRooms).includes(roomId)) {
      void deleteRoom(roomId).catch((err) => console.warn('[store] deleteRoom failed:', err));
    }
    set({ users: newUsers, roomForUser: newRooms, partnerForUser: newPartners });
    await AsyncStorage.multiSet([
      [STORAGE_USERS_KEY, JSON.stringify(newUsers)],
      [STORAGE_ROOMS_KEY, JSON.stringify(newRooms)],
      [STORAGE_PARTNERS_KEY, JSON.stringify(newPartners)],
    ]);
    // Switch away from the deleted user
    if (currentUser === uid) {
      const fallback = Object.keys(newUsers)[0] ?? 'a';
      await get().setCurrentUser(fallback);
    }
  },

  // ── Transactions ──────────────────────────────────────────────────────────

  addTransaction: (t) => {
    set((s) => ({ payload: { ...s.payload, expenses: [...s.payload.expenses, t] } }));
    _persistCurrentPayload();
    _syncToCloud();
    if (t.date > todayStr()) {
      void scheduleTransactionReminder(t, t.date, [3, 1]).catch((err) =>
        console.warn('[store] schedule reminder failed:', err),
      );
    }
  },

  updateTransaction: (t) => {
    set((s) => ({
      payload: {
        ...s.payload,
        expenses: s.payload.expenses.map((e) => String(e.id) === String(t.id) ? t : e),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
    if (t.date > todayStr()) {
      void scheduleTransactionReminder(t, t.date, [3, 1]).catch((err) =>
        console.warn('[store] reschedule reminder failed:', err),
      );
    } else {
      void cancelTransactionReminders(t.id).catch((err) =>
        console.warn('[store] cancel reminder failed:', err),
      );
    }
  },

  confirmTransaction: (id, ym, date) => {
    set((s) => ({
      payload: {
        ...s.payload,
        expenses: s.payload.expenses.map((e) => {
          if (String(e.id) !== String(id)) return e;
          const paid = { ...(e.paid ?? {}), [ym]: true };
          const paidAt = { ...(e.paidAt ?? {}), [ym]: date };
          return { ...e, paid, paidAt };
        }),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
    void cancelTransactionReminders(id).catch((err) =>
      console.warn('[store] cancel reminder failed:', err),
    );
  },

  // Soft delete — keeps the record with del: true so other clients see the removal
  deleteTransaction: (id) => {
    set((s) => ({
      payload: {
        ...s.payload,
        expenses: s.payload.expenses.map((e) =>
          String(e.id) === String(id) ? { ...e, del: true } : e,
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
    void cancelTransactionReminders(id).catch((err) =>
      console.warn('[store] cancel reminder failed:', err),
    );
  },

  // ── Saving plans ──────────────────────────────────────────────────────────

  addSavingPlan: (plan) => {
    set((s) => ({ payload: { ...s.payload, savings: [...s.payload.savings, plan] } }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  updateSavingPlan: (plan) => {
    set((s) => ({
      payload: {
        ...s.payload,
        savings: s.payload.savings.map((x) => String(x.id) === String(plan.id) ? plan : x),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  deleteSavingPlan: (id) => {
    set((s) => ({
      payload: {
        ...s.payload,
        savings: s.payload.savings.filter((plan) => String(plan.id) !== String(id)),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  // ── Goals ─────────────────────────────────────────────────────────────────

  addGoal: (g) => {
    set((s) => ({ payload: { ...s.payload, goals: [...s.payload.goals, g] } }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  updateGoal: (g) => {
    set((s) => ({
      payload: {
        ...s.payload,
        goals: s.payload.goals.map((x) => String(x.id) === String(g.id) ? g : x),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  // Also removes all contributions belonging to the deleted goal
  deleteGoal: (id) => {
    set((s) => ({
      payload: {
        ...s.payload,
        goals: s.payload.goals.filter((g) => String(g.id) !== String(id)),
        contribs: s.payload.contribs.filter((c) => String(c.gid) !== String(id)),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  // ── Contributions ─────────────────────────────────────────────────────────

  addContribution: (c) => {
    set((s) => ({ payload: { ...s.payload, contribs: [...s.payload.contribs, c] } }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  deleteContribution: (id) => {
    set((s) => ({
      payload: {
        ...s.payload,
        contribs: s.payload.contribs.filter((c) => String(c.id) !== String(id)),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  // ── Budget Categories ─────────────────────────────────────────────────────

  addBudgetCategory: (bc) => {
    set((s) => ({
      payload: {
        ...s.payload,
        budgetCategories: [...(s.payload.budgetCategories ?? []), bc],
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  updateBudgetCategory: (bc) => {
    set((s) => ({
      payload: {
        ...s.payload,
        budgetCategories: (s.payload.budgetCategories ?? []).map((x) =>
          String(x.id) === String(bc.id) ? bc : x,
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  deleteBudgetCategory: (id) => {
    set((s) => ({
      payload: {
        ...s.payload,
        budgetCategories: (s.payload.budgetCategories ?? []).filter(
          (bc) => String(bc.id) !== String(id),
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  // ── Plans ─────────────────────────────────────────────────────────────────

  addPlan: (plan) => {
    set((s) => ({ payload: { ...s.payload, plans: [...(s.payload.plans ?? []), plan] } }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  updatePlan: (plan) => {
    set((s) => ({
      payload: {
        ...s.payload,
        plans: (s.payload.plans ?? []).map((p) => String(p.id) === String(plan.id) ? plan : p),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  deletePlan: (id) => {
    set((s) => ({
      payload: {
        ...s.payload,
        plans: (s.payload.plans ?? []).filter((p) => String(p.id) !== String(id)),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  addPlanCategory: (planId, cat) => {
    set((s) => ({
      payload: {
        ...s.payload,
        plans: (s.payload.plans ?? []).map((p) =>
          String(p.id) === String(planId)
            ? { ...p, categories: [...p.categories, cat] }
            : p,
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  updatePlanCategory: (planId, cat) => {
    set((s) => ({
      payload: {
        ...s.payload,
        plans: (s.payload.plans ?? []).map((p) =>
          String(p.id) === String(planId)
            ? { ...p, categories: p.categories.map((c) => String(c.id) === String(cat.id) ? cat : c) }
            : p,
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  deletePlanCategory: (planId, catId) => {
    set((s) => ({
      payload: {
        ...s.payload,
        plans: (s.payload.plans ?? []).map((p) =>
          String(p.id) === String(planId)
            ? {
                ...p,
                categories: p.categories.filter((c) => String(c.id) !== String(catId)),
                expenses: p.expenses.filter((e) => String(e.categoryId) !== String(catId)),
              }
            : p,
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  addPlanExpense: (planId, expense) => {
    set((s) => ({
      payload: {
        ...s.payload,
        plans: (s.payload.plans ?? []).map((p) =>
          String(p.id) === String(planId)
            ? { ...p, expenses: [...p.expenses, expense] }
            : p,
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  deletePlanExpense: (planId, expenseId) => {
    set((s) => ({
      payload: {
        ...s.payload,
        plans: (s.payload.plans ?? []).map((p) =>
          String(p.id) === String(planId)
            ? { ...p, expenses: p.expenses.filter((e) => String(e.id) !== String(expenseId)) }
            : p,
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },
}));

// ─── Internal helpers ────────────────────────────────────────────────────────

function _syncToCloud(): void {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    const { payload, currentUser, clientId, roomForUser } = useAppStore.getState();
    const roomId = roomForUser[currentUser] ?? `${currentUser}-main`;
    const ok = await pushSnapshot(roomId, payload, clientId);
    if (ok) {
      await AsyncStorage.setItem(payloadStorageKey(roomId), JSON.stringify(payload));
      useAppStore.setState({ syncStatus: 'live', isConnected: true });
    } else {
      // Revert to server-side canonical state on push failure
      useAppStore.getState()._setSyncStatus('error');
      try {
        const canonical = await fetchSnapshot(roomId);
        if (canonical) {
          useAppStore.getState()._setPayload(canonical);
          await AsyncStorage.setItem(payloadStorageKey(roomId), JSON.stringify(canonical));
        }
      } catch {
        // Keep the local payload cached by _persistCurrentPayload for offline recovery.
      }
    }
  }, 300);
}

function _persistCurrentPayload(): void {
  const { payload, currentUser, roomForUser } = useAppStore.getState();
  const roomId = roomForUser[currentUser] ?? `${currentUser}-main`;
  void AsyncStorage.setItem(payloadStorageKey(roomId), JSON.stringify(payload)).catch((err) => {
    console.warn('[store] local payload save failed:', err);
  });
}

async function _connectToRoom(uid: UserId): Promise<void> {
  if (_channel) {
    _channel.unsubscribe();
    _channel = null;
  }

  const { roomForUser } = useAppStore.getState();
  const roomId = roomForUser[uid] ?? `${uid}-main`;
  const { clientId } = useAppStore.getState();
  useAppStore.getState()._setSyncStatus('connecting');

  try {
    const snapshot = await fetchSnapshot(roomId);
    if (snapshot) {
      useAppStore.getState()._setPayload(snapshot);
      await AsyncStorage.setItem(payloadStorageKey(roomId), JSON.stringify(snapshot));
    } else {
      useAppStore.getState()._setPayload(emptyPayload());
      await AsyncStorage.removeItem(payloadStorageKey(roomId));
    }

    _channel = subscribeToRoom(roomId, clientId, async (incoming) => {
      useAppStore.getState()._setPayload(incoming);
      await AsyncStorage.setItem(payloadStorageKey(roomId), JSON.stringify(incoming));
    });

    useAppStore.setState({ isConnected: true, syncStatus: 'live' });
  } catch (err) {
    console.error('[store] connection error:', err);
    useAppStore.getState()._setSyncStatus('error');
    // Fallback: load last known payload from disk
    try {
      const cached = await AsyncStorage.getItem(payloadStorageKey(roomId));
      if (cached) useAppStore.getState()._setPayload(normalizeAppPayload(JSON.parse(cached)));
    } catch {
      // Nothing to fall back to
    }
  }
}

// ─── Public init — call once from app/_layout.tsx ────────────────────────────

export async function initialize(): Promise<void> {
  const [savedUser, savedCurrency, savedUsersStr, savedRoomsStr, savedPartnersStr] = await Promise.all([
    AsyncStorage.getItem(STORAGE_USER_KEY),
    AsyncStorage.getItem(STORAGE_CURRENCY_KEY),
    AsyncStorage.getItem(STORAGE_USERS_KEY),
    AsyncStorage.getItem(STORAGE_ROOMS_KEY),
    AsyncStorage.getItem(STORAGE_PARTNERS_KEY),
  ]);

  const uid = (savedUser as string | null) ?? 'a';
  const currency = (savedCurrency as CurrencyCode | null) ?? 'EUR';
  // Merge static defaults with any dynamically added users
  const users: Record<string, UserData> = savedUsersStr
    ? { ...USERS, ...JSON.parse(savedUsersStr) as Record<string, UserData> }
    : { ...USERS };
  const roomForUser: Record<string, string> = savedRoomsStr
    ? { ...ROOM_FOR_USER, ...JSON.parse(savedRoomsStr) as Record<string, string> }
    : { ...ROOM_FOR_USER };
  const partnerForUser: Record<string, string> = savedPartnersStr
    ? { ...PARTNER, ...JSON.parse(savedPartnersStr) as Record<string, string> }
    : { ...PARTNER };

  await AsyncStorage.removeItem(STORAGE_PAYLOAD_KEY);
  useAppStore.setState({ currentUser: uid, selectedYM: currentYM(), currency, users, roomForUser, partnerForUser });
  await _connectToRoom(uid);
}

export async function refreshCurrentRoom(): Promise<void> {
  const { currentUser, roomForUser } = useAppStore.getState();
  const roomId = roomForUser[currentUser] ?? `${currentUser}-main`;
  useAppStore.getState()._setSyncStatus('connecting');
  try {
    const snapshot = await fetchSnapshot(roomId);
    if (snapshot) {
      useAppStore.getState()._setPayload(snapshot);
      await AsyncStorage.setItem(payloadStorageKey(roomId), JSON.stringify(snapshot));
      useAppStore.setState({ syncStatus: 'live', isConnected: true });
    } else {
      useAppStore.getState()._setPayload(emptyPayload());
      await AsyncStorage.removeItem(payloadStorageKey(roomId));
      useAppStore.setState({ syncStatus: 'live', isConnected: true });
    }
  } catch {
    useAppStore.getState()._setSyncStatus('error');
  }
}
