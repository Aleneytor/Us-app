import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Image } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { fetchSnapshot, pushSnapshot, subscribeToRoom, unsubscribeFromRoom, deleteRoom, fetchRawPayload, pushRawPayload } from '../services/supabase';
import { currentYM, todayStr } from '../utils/format';
import { normalizeAppPayload } from '../utils/payload';
import { cancelTransactionReminders, scheduleTransactionReminder } from '../services/notifications';
import { USERS, ROOM_FOR_USER, PARTNER } from '../types';
import type { AppPayload, Transaction, SavingPlan, Goal, Contribution, UserId, CurrencyCode, BudgetCategory, UserData, Plan, PlanCategory, PlanExpense, PlanSettlement } from '../types';
import { buildSeedPayload } from '../utils/seedData';
import type { ThemeMode } from '../constants/colors';

const STORAGE_USER_KEY     = 'nosotros_user';
const STORAGE_PAYLOAD_KEY  = 'nosotros_payload';
const STORAGE_CURRENCY_KEY = 'nosotros_currency';
const STORAGE_USERS_KEY    = 'nosotros_users';
const STORAGE_ROOMS_KEY    = 'nosotros_rooms';
const STORAGE_PARTNERS_KEY = 'nosotros_partners';
const STORAGE_DELETED_KEY  = 'nosotros_deleted_users';
const STORAGE_THEME_KEY    = 'nosotros_theme';

const payloadStorageKey = (roomId: string) => `${STORAGE_PAYLOAD_KEY}:${roomId}`;
const emptyPayload = (): AppPayload => ({ expenses: [], savings: [], goals: [], contribs: [], budgetCategories: [], plans: [] });

// ─── Store types ─────────────────────────────────────────────────────────────

interface AppState {
  payload: AppPayload;
  currentUser: UserId;
  selectedYM: string;
  currency: CurrencyCode;
  themeMode: ThemeMode;
  isConnected: boolean;
  syncStatus: 'live' | 'connecting' | 'error';
  clientId: string;
  users: Record<string, UserData>;
  roomForUser: Record<string, string>;
  partnerForUser: Record<string, string>;
  deletedUserIds: string[];
}

interface AppActions {
  setCurrentUser: (uid: UserId) => Promise<void>;
  setSelectedYM: (ym: string) => void;
  setCurrency: (c: CurrencyCode) => Promise<void>;
  setThemeMode: (m: ThemeMode) => Promise<void>;
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
  updatePlanExpense: (planId: number, expense: PlanExpense) => void;
  deletePlanExpense: (planId: number, expenseId: number) => void;
  addPlanSettlement: (planId: number, settlement: PlanSettlement) => void;
  deletePlanSettlement: (planId: number, settlementId: number) => void;
  updateUserPhoto: (uid: string, photo: ImageSourcePropType) => Promise<void>;
}

// ─── Module-level (not in store — not serializable) ──────────────────────────

let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _syncRetryTimer: ReturnType<typeof setTimeout> | null = null;
let _channel: RealtimeChannel | null = null;
let _payloadReady = false; // true only after first successful load — prevents pushing stale/empty state
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _reconnectAttempts = 0;
let _activeUid: string | null = null;
let _connectionGeneration = 0;

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  payload: emptyPayload(),
  currentUser: 'alan',
  selectedYM: currentYM(),
  currency: 'EUR',
  themeMode: 'dark',
  isConnected: false,
  syncStatus: 'connecting',
  clientId: Math.random().toString(36).slice(2) + Date.now().toString(36),
  users: { ...USERS },
  roomForUser: { ...ROOM_FOR_USER },
  partnerForUser: { ...PARTNER },
  deletedUserIds: [],

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
  setThemeMode: async (m) => {
    await AsyncStorage.setItem(STORAGE_THEME_KEY, m);
    set({ themeMode: m });
  },
  _setPayload: (payload) => set({ payload: normalizeAppPayload(payload) }),
  _setSyncStatus: (syncStatus) => set({ syncStatus }),

  addUser: async ({ uid, data, roomId, partnerId }) => {
    const { users, roomForUser, partnerForUser } = get();
    const newUsers = { ...users, [uid]: data };
    const newRooms = { ...roomForUser, [uid]: roomId };
    const newPartners = { ...partnerForUser, [uid]: partnerId };
    set({ users: newUsers, roomForUser: newRooms, partnerForUser: newPartners });

    const customUsers = getCustomUsers(newUsers);
    const customRooms = { ...newRooms };
    const customPartners = { ...newPartners };
    for (const staticKey of Object.keys(USERS)) {
      delete customRooms[staticKey];
      delete customPartners[staticKey];
    }

    await AsyncStorage.multiSet([
      [STORAGE_USERS_KEY, JSON.stringify(customUsers)],
      [STORAGE_ROOMS_KEY, JSON.stringify(customRooms)],
      [STORAGE_PARTNERS_KEY, JSON.stringify(customPartners)],
    ]);

    _syncCustomUsersToCloud();
  },

  updateUserPhoto: async (uid, photo) => {
    const { users } = get();
    if (!users[uid]) return;

    const newUsers = {
      ...users,
      [uid]: {
        ...users[uid]!,
        photo,
      },
    };
    set({ users: newUsers });

    // Warm up cache so the photo is instantly available in filter buttons
    _prefetchUserPhotos(newUsers);

    const customUsers = getCustomUsers(newUsers);
    await AsyncStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(customUsers));

    _syncCustomUsersToCloud();
  },

  deleteUser: async (uid) => {
    const { users, roomForUser, partnerForUser, currentUser, deletedUserIds } = get();

    // Persist tombstone so the user never comes back from USERS constant or cloud merge
    const newDeleted = deletedUserIds.includes(uid) ? deletedUserIds : [...deletedUserIds, uid];
    set({ deletedUserIds: newDeleted });
    await AsyncStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(newDeleted));

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

    const customUsers = getCustomUsers(newUsers);
    const customRooms = { ...newRooms };
    const customPartners = { ...newPartners };
    for (const staticKey of Object.keys(USERS)) {
      delete customRooms[staticKey];
      delete customPartners[staticKey];
    }

    await AsyncStorage.multiSet([
      [STORAGE_USERS_KEY, JSON.stringify(customUsers)],
      [STORAGE_ROOMS_KEY, JSON.stringify(customRooms)],
      [STORAGE_PARTNERS_KEY, JSON.stringify(customPartners)],
    ]);

    _syncCustomUsersToCloud();

    // Switch away from the deleted user
    if (currentUser === uid) {
      const fallback = Object.keys(newUsers)[0] ?? 'demo_a';
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
        expenses: s.payload.expenses.map((exp) =>
          String(exp.budgetCatId) === String(bc.id)
            ? {
                ...exp,
                cat: bc.icon,
                iconColor: bc.iconColor,
              }
            : exp,
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
        expenses: s.payload.expenses.map((exp) =>
          String(exp.budgetCatId) === String(id)
            ? {
                ...exp,
                budgetCatId: undefined,
                cat: 'close-circle-outline',
                iconColor: 'slate',
              }
            : exp
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
            ? { ...p, expenses: [...(p.expenses ?? []), expense] }
            : p,
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  updatePlanExpense: (planId, expense) => {
    set((s) => ({
      payload: {
        ...s.payload,
        plans: (s.payload.plans ?? []).map((p) =>
          String(p.id) === String(planId)
            ? { ...p, expenses: (p.expenses ?? []).map((e) => String(e.id) === String(expense.id) ? expense : e) }
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
            ? { ...p, expenses: (p.expenses ?? []).filter((e) => String(e.id) !== String(expenseId)) }
            : p,
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  addPlanSettlement: (planId, settlement) => {
    set((s) => ({
      payload: {
        ...s.payload,
        plans: (s.payload.plans ?? []).map((p) =>
          String(p.id) === String(planId)
            ? { ...p, settlements: [...(p.settlements ?? []), settlement] }
            : p,
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },

  deletePlanSettlement: (planId, settlementId) => {
    set((s) => ({
      payload: {
        ...s.payload,
        plans: (s.payload.plans ?? []).map((p) =>
          String(p.id) === String(planId)
            ? { ...p, settlements: (p.settlements ?? []).filter((st) => String(st.id) !== String(settlementId)) }
            : p,
        ),
      },
    }));
    _persistCurrentPayload();
    _syncToCloud();
  },
}));

// ─── Internal helpers ────────────────────────────────────────────────────────

// Prefetch all user photos that have a URI so they are in the RN image cache
// before the filter buttons try to render them, eliminating the flash/delay.
function _prefetchUserPhotos(users: Record<string, UserData>): void {
  for (const user of Object.values(users)) {
    if (
      user.photo &&
      typeof user.photo === 'object' &&
      'uri' in user.photo &&
      typeof (user.photo as { uri: string }).uri === 'string'
    ) {
      const uri = (user.photo as { uri: string }).uri;
      if (uri) {
        Image.prefetch(uri).catch(() => {
          // Silently ignore prefetch errors (offline, revoked URI, etc.)
        });
      }
    }
  }
}

function _clearReconnectTimer(): void {
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
}

function _isCurrentConnection(generation: number, uid: UserId): boolean {
  return _connectionGeneration === generation && _activeUid === uid;
}

function _scheduleReconnect(): void {
  if (_reconnectTimer || !_activeUid) return;
  const delay = Math.min(1000 * Math.pow(2, _reconnectAttempts), 30_000);
  _reconnectAttempts = Math.min(_reconnectAttempts + 1, 6);
  console.log(`[store] reconnecting in ${delay}ms (attempt ${_reconnectAttempts})`);
  _reconnectTimer = setTimeout(async () => {
    _reconnectTimer = null;
    if (_activeUid) await _connectToRoom(_activeUid as UserId);
  }, delay);
}

function _syncCustomUsersToCloud(): void {
  const { users, roomForUser, partnerForUser, clientId } = useAppStore.getState();

  const customUsers = getCustomUsers(users);
  const customRooms: Record<string, string> = { ...roomForUser };
  const customPartners: Record<string, string> = { ...partnerForUser };

  for (const staticKey of Object.keys(USERS)) {
    delete customRooms[staticKey];
    delete customPartners[staticKey];
  }

  const payload = {
    expenses: [],
    wishlist: [],
    goals: [],
    contribs: [],
    customUsers,
    customRooms,
    customPartners,
  };

  void pushRawPayload('global-users', payload, clientId).catch((err) => {
    console.warn('[store] push custom users failed:', err);
  });
}

function _syncToCloud(): void {
  if (!_payloadReady) return;
  if (_syncTimer) clearTimeout(_syncTimer);
  if (_syncRetryTimer) {
    clearTimeout(_syncRetryTimer);
    _syncRetryTimer = null;
  }
  _syncTimer = setTimeout(async () => {
    _syncTimer = null;
    const { payload, currentUser, clientId, roomForUser } = useAppStore.getState();
    const roomId = roomForUser[currentUser] ?? `${currentUser}-main`;
    const ok = await pushSnapshot(roomId, payload, clientId);
    if (ok) {
      await AsyncStorage.setItem(payloadStorageKey(roomId), JSON.stringify(payload));
      useAppStore.setState({ syncStatus: 'live', isConnected: true });
    } else {
      // Local state is the source of truth — don't revert. Schedule a retry.
      useAppStore.getState()._setSyncStatus('error');
      _syncRetryTimer = setTimeout(() => {
        _syncRetryTimer = null;
        _syncToCloud();
      }, 5000);
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
  _clearReconnectTimer();
  const connectionGeneration = ++_connectionGeneration;
  _activeUid = uid;

  if (_channel) {
    const oldChannel = _channel;
    _channel = null;
    await unsubscribeFromRoom(oldChannel).catch((err) => {
      console.warn('[store] unsubscribe old channel failed:', err);
    });
  }

  if (!_isCurrentConnection(connectionGeneration, uid)) return;

  _payloadReady = false;

  const { roomForUser } = useAppStore.getState();
  const roomId = roomForUser[uid] ?? `${uid}-main`;
  const { clientId } = useAppStore.getState();
  useAppStore.getState()._setSyncStatus('connecting');

  // Immediately load initial cached payload from disk to make the UI instant and responsive offline-first
  try {
    const cached = await AsyncStorage.getItem(payloadStorageKey(roomId));
    if (!_isCurrentConnection(connectionGeneration, uid)) return;
    if (cached) {
      useAppStore.getState()._setPayload(normalizeAppPayload(JSON.parse(cached)));
    } else {
      useAppStore.getState()._setPayload(emptyPayload());
    }
  } catch (err) {
    console.warn('[store] failed to load initial cached payload:', err);
  }

  try {
    const snapshot = await fetchSnapshot(roomId);
    if (!_isCurrentConnection(connectionGeneration, uid)) return;
    // Only apply the remote snapshot if there are no pending local changes waiting to push.
    // If _syncRetryTimer is set, our local state is ahead of what Supabase has — don't revert it.
    if (snapshot && !_syncRetryTimer) {
      useAppStore.getState()._setPayload(snapshot);
      await AsyncStorage.setItem(payloadStorageKey(roomId), JSON.stringify(snapshot));
    } else if (snapshot && _syncRetryTimer) {
      // We have pending local changes — push them now that we're reconnected.
      _syncToCloud();
    }

    _channel = subscribeToRoom(
      roomId,
      clientId,
      async (incoming) => {
        if (!_isCurrentConnection(connectionGeneration, uid)) return;
        _reconnectAttempts = 0;
        useAppStore.getState()._setPayload(incoming);
        await AsyncStorage.setItem(payloadStorageKey(roomId), JSON.stringify(incoming));
      },
      (status) => {
        if (!_isCurrentConnection(connectionGeneration, uid)) return;
        if (status === 'SUBSCRIBED') {
          _reconnectAttempts = 0;
          useAppStore.setState({ isConnected: true, syncStatus: 'live' });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[store] channel ${status} — scheduling reconnect`);
          useAppStore.getState()._setSyncStatus('error');
          _scheduleReconnect();
        }
      },
    );

    useAppStore.setState({ isConnected: true, syncStatus: 'live' });
  } catch (err) {
    if (!_isCurrentConnection(connectionGeneration, uid)) return;
    console.error('[store] connection error:', err);
    useAppStore.getState()._setSyncStatus('error');
    _scheduleReconnect();
  } finally {
    if (_isCurrentConnection(connectionGeneration, uid)) {
      _payloadReady = true;
    }
  }
}

// ─── Public init — call once from app/_layout.tsx ────────────────────────────

export async function initialize(): Promise<void> {
  const [savedUser, savedCurrency, savedTheme, savedUsersStr, savedRoomsStr, savedPartnersStr, savedDeletedStr] = await Promise.all([
    AsyncStorage.getItem(STORAGE_USER_KEY),
    AsyncStorage.getItem(STORAGE_CURRENCY_KEY),
    AsyncStorage.getItem(STORAGE_THEME_KEY),
    AsyncStorage.getItem(STORAGE_USERS_KEY),
    AsyncStorage.getItem(STORAGE_ROOMS_KEY),
    AsyncStorage.getItem(STORAGE_PARTNERS_KEY),
    AsyncStorage.getItem(STORAGE_DELETED_KEY),
  ]);

  const deletedUserIds: string[] = savedDeletedStr ? JSON.parse(savedDeletedStr) as string[] : [];
  const currency = (savedCurrency as CurrencyCode | null) ?? 'EUR';
  const themeMode: ThemeMode = (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';

  // Merge static defaults with any dynamically added users, then strip deleted ones
  const users: Record<string, UserData> = savedUsersStr
    ? { ...USERS, ...JSON.parse(savedUsersStr) as Record<string, UserData> }
    : { ...USERS };
  const roomForUser: Record<string, string> = savedRoomsStr
    ? { ...ROOM_FOR_USER, ...JSON.parse(savedRoomsStr) as Record<string, string> }
    : { ...ROOM_FOR_USER };
  const partnerForUser: Record<string, string> = savedPartnersStr
    ? { ...PARTNER, ...JSON.parse(savedPartnersStr) as Record<string, string> }
    : { ...PARTNER };

  for (const id of deletedUserIds) {
    delete users[id];
    delete roomForUser[id];
    delete partnerForUser[id];
  }

  // If the saved uid was deleted, fall back to the first remaining user
  const savedUid = savedUser as string | null;
  const uid = (savedUid && !deletedUserIds.includes(savedUid) && users[savedUid])
    ? savedUid
    : (Object.keys(users)[0] ?? 'demo_a');

  await AsyncStorage.removeItem(STORAGE_PAYLOAD_KEY);
  useAppStore.setState({ currentUser: uid, selectedYM: currentYM(), currency, themeMode, users, roomForUser, partnerForUser, deletedUserIds });

  // Warm up the image cache for all user photos at startup so filter button
  // avatars are immediately ready when the user opens the movements screen.
  _prefetchUserPhotos(users);

  await _connectToRoom(uid);

  // Background cloud fetch and merge of custom users
  void fetchRawPayload('global-users')
    .then(async (cloudPayload) => {
      if (cloudPayload && cloudPayload.customUsers) {
        const cloudUsers = cloudPayload.customUsers as Record<string, UserData>;
        const cloudRooms = cloudPayload.customRooms as Record<string, string>;
        const cloudPartners = cloudPayload.customPartners as Record<string, string>;

        const currentStore = useAppStore.getState();
        const mergedUsers = { ...USERS, ...cloudUsers, ...currentStore.users };
        const mergedRooms = { ...ROOM_FOR_USER, ...cloudRooms, ...currentStore.roomForUser };
        const mergedPartners = { ...PARTNER, ...cloudPartners, ...currentStore.partnerForUser };

        // Strip any tombstoned users that may have been re-introduced by cloud
        for (const id of currentStore.deletedUserIds) {
          delete mergedUsers[id];
          delete mergedRooms[id];
          delete mergedPartners[id];
        }

        const customUsersOnly = { ...mergedUsers };
        const customRoomsOnly = { ...mergedRooms };
        const customPartnersOnly = { ...mergedPartners };
        for (const staticKey of Object.keys(USERS)) {
          delete customUsersOnly[staticKey];
          delete customRoomsOnly[staticKey];
          delete customPartnersOnly[staticKey];
        }

        useAppStore.setState({
          users: mergedUsers,
          roomForUser: mergedRooms,
          partnerForUser: mergedPartners,
        });

        // Prefetch any photos that came from the cloud merge
        _prefetchUserPhotos(mergedUsers);

        await AsyncStorage.multiSet([
          [STORAGE_USERS_KEY, JSON.stringify(customUsersOnly)],
          [STORAGE_ROOMS_KEY, JSON.stringify(customRoomsOnly)],
          [STORAGE_PARTNERS_KEY, JSON.stringify(customPartnersOnly)],
        ]);
      }
    })
    .catch((err) => {
      console.warn('[store] fetch global-users failed:', err);
    });
}

export async function seedDemoData(): Promise<void> {
  const ts     = Date.now();
  const uidA   = `demo_a_${ts}`;
  const uidB   = `demo_b_${ts}`;
  const roomId = `demo-${ts}-main`;
  const { addUser, setCurrentUser, clientId } = useAppStore.getState();

  // Register both demo users sharing the same room
  await addUser({
    uid: uidA,
    data: { name: 'Demo', initials: 'DM', color: '#7C3AED', bg: '#EDE9FE' },
    roomId,
    partnerId: uidB,
  });
  await addUser({
    uid: uidB,
    data: { name: 'Pareja Demo', initials: 'PD', color: '#E11D48', bg: '#FFE4E6' },
    roomId,
    partnerId: uidA,
  });

  const seed = buildSeedPayload(uidA, uidB, 'Demo', 'Pareja Demo');

  // Cache locally so it works offline; also push to cloud
  await AsyncStorage.setItem(payloadStorageKey(roomId), JSON.stringify(seed));
  pushSnapshot(roomId, seed, clientId).catch(() => {});

  // Switch to the demo user — _connectToRoom will load from cache/cloud
  await setCurrentUser(uidA);
}

export async function foregroundRefresh(): Promise<void> {
  if (!_activeUid) return;
  _clearReconnectTimer();
  await _connectToRoom(_activeUid as UserId);
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

function getCustomUsers(users: Record<string, UserData>): Record<string, UserData> {
  const customUsers: Record<string, UserData> = {};
  for (const [uid, user] of Object.entries(users)) {
    const isStatic = uid in USERS;
    const hasCustomPhoto = user.photo && typeof user.photo === 'object' && 'uri' in user.photo;
    if (!isStatic || hasCustomPhoto) {
      customUsers[uid] = user;
    }
  }
  return customUsers;
}
