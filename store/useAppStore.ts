import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { fetchSnapshot, pushSnapshot, subscribeToRoom } from '../services/supabase';
import { currentYM, todayStr } from '../utils/format';
import { normalizeAppPayload } from '../utils/payload';
import { cancelTransactionReminders, scheduleTransactionReminder } from '../services/notifications';
import { ROOM_FOR_USER } from '../types';
import type { AppPayload, Transaction, SavingPlan, Goal, Contribution, UserId, CurrencyCode, BudgetCategory } from '../types';

const STORAGE_USER_KEY    = 'nosotros_user';
const STORAGE_PAYLOAD_KEY = 'nosotros_payload';
const STORAGE_CURRENCY_KEY = 'nosotros_currency';

const payloadStorageKey = (roomId: string) => `${STORAGE_PAYLOAD_KEY}:${roomId}`;
const emptyPayload = (): AppPayload => ({ expenses: [], savings: [], goals: [], contribs: [], budgetCategories: [] });

// ─── Store types ─────────────────────────────────────────────────────────────

interface AppState {
  payload: AppPayload;
  currentUser: UserId;
  selectedYM: string;
  currency: CurrencyCode;
  isConnected: boolean;
  syncStatus: 'live' | 'connecting' | 'error';
  clientId: string;
}

interface AppActions {
  setCurrentUser: (uid: UserId) => Promise<void>;
  setSelectedYM: (ym: string) => void;
  setCurrency: (c: CurrencyCode) => Promise<void>;
  _setPayload: (payload: AppPayload) => void;
  _setSyncStatus: (status: AppState['syncStatus']) => void;
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
}));

// ─── Internal helpers ────────────────────────────────────────────────────────

function _syncToCloud(): void {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    const { payload, currentUser, clientId } = useAppStore.getState();
    const roomId = ROOM_FOR_USER[currentUser];
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
  const { payload, currentUser } = useAppStore.getState();
  const roomId = ROOM_FOR_USER[currentUser];
  void AsyncStorage.setItem(payloadStorageKey(roomId), JSON.stringify(payload)).catch((err) => {
    console.warn('[store] local payload save failed:', err);
  });
}

async function _connectToRoom(uid: UserId): Promise<void> {
  if (_channel) {
    _channel.unsubscribe();
    _channel = null;
  }

  const roomId = ROOM_FOR_USER[uid];
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
  const savedUser = ((await AsyncStorage.getItem(STORAGE_USER_KEY)) as UserId | null) ?? 'a';
  const savedCurrency = ((await AsyncStorage.getItem(STORAGE_CURRENCY_KEY)) as CurrencyCode | null) ?? 'EUR';
  await AsyncStorage.removeItem(STORAGE_PAYLOAD_KEY);
  useAppStore.setState({ currentUser: savedUser, selectedYM: currentYM(), currency: savedCurrency });
  await _connectToRoom(savedUser);
}

export async function refreshCurrentRoom(): Promise<void> {
  const { currentUser } = useAppStore.getState();
  const roomId = ROOM_FOR_USER[currentUser];
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
