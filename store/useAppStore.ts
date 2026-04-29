import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { fetchSnapshot, pushSnapshot, subscribeToRoom } from '../services/supabase';
import { currentYM } from '../utils/format';
import { ROOM_FOR_USER } from '../types';
import type { AppPayload, Transaction, Wish, Goal, Contribution, UserId } from '../types';

const STORAGE_USER_KEY    = 'nosotros_user';
const STORAGE_PAYLOAD_KEY = 'nosotros_payload';

// ─── Store types ─────────────────────────────────────────────────────────────

interface AppState {
  payload: AppPayload;
  currentUser: UserId;
  selectedYM: string;
  isConnected: boolean;
  syncStatus: 'live' | 'connecting' | 'error';
  clientId: string;
}

interface AppActions {
  setCurrentUser: (uid: UserId) => Promise<void>;
  setSelectedYM: (ym: string) => void;
  _setPayload: (payload: AppPayload) => void;
  _setSyncStatus: (status: AppState['syncStatus']) => void;
  addTransaction: (t: Transaction) => void;
  updateTransaction: (t: Transaction) => void;
  deleteTransaction: (id: number) => void;
  addWish: (w: Wish) => void;
  updateWish: (w: Wish) => void;
  deleteWish: (id: number) => void;
  addGoal: (g: Goal) => void;
  updateGoal: (g: Goal) => void;
  deleteGoal: (id: number) => void;
  addContribution: (c: Contribution) => void;
  deleteContribution: (id: number) => void;
}

// ─── Module-level (not in store — not serializable) ──────────────────────────

let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _channel: RealtimeChannel | null = null;

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  payload: { expenses: [], wishlist: [], goals: [], contribs: [] },
  currentUser: 'a',
  selectedYM: currentYM(),
  isConnected: false,
  syncStatus: 'connecting',
  clientId: Math.random().toString(36).slice(2) + Date.now().toString(36),

  setCurrentUser: async (uid) => {
    await AsyncStorage.setItem(STORAGE_USER_KEY, uid);
    set({ currentUser: uid });
    await _connectToRoom(uid);
  },

  setSelectedYM: (ym) => set({ selectedYM: ym }),
  _setPayload: (payload) => set({ payload }),
  _setSyncStatus: (syncStatus) => set({ syncStatus }),

  // ── Transactions ──────────────────────────────────────────────────────────

  addTransaction: (t) => {
    set((s) => ({ payload: { ...s.payload, expenses: [...s.payload.expenses, t] } }));
    _syncToCloud();
  },

  updateTransaction: (t) => {
    set((s) => ({
      payload: {
        ...s.payload,
        expenses: s.payload.expenses.map((e) => String(e.id) === String(t.id) ? t : e),
      },
    }));
    _syncToCloud();
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
    _syncToCloud();
  },

  // ── Wishes ────────────────────────────────────────────────────────────────

  addWish: (w) => {
    set((s) => ({ payload: { ...s.payload, wishlist: [...s.payload.wishlist, w] } }));
    _syncToCloud();
  },

  updateWish: (w) => {
    set((s) => ({
      payload: {
        ...s.payload,
        wishlist: s.payload.wishlist.map((x) => String(x.id) === String(w.id) ? w : x),
      },
    }));
    _syncToCloud();
  },

  deleteWish: (id) => {
    set((s) => ({
      payload: {
        ...s.payload,
        wishlist: s.payload.wishlist.filter((w) => String(w.id) !== String(id)),
      },
    }));
    _syncToCloud();
  },

  // ── Goals ─────────────────────────────────────────────────────────────────

  addGoal: (g) => {
    set((s) => ({ payload: { ...s.payload, goals: [...s.payload.goals, g] } }));
    _syncToCloud();
  },

  updateGoal: (g) => {
    set((s) => ({
      payload: {
        ...s.payload,
        goals: s.payload.goals.map((x) => String(x.id) === String(g.id) ? g : x),
      },
    }));
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
    _syncToCloud();
  },

  // ── Contributions ─────────────────────────────────────────────────────────

  addContribution: (c) => {
    set((s) => ({ payload: { ...s.payload, contribs: [...s.payload.contribs, c] } }));
    _syncToCloud();
  },

  deleteContribution: (id) => {
    set((s) => ({
      payload: {
        ...s.payload,
        contribs: s.payload.contribs.filter((c) => String(c.id) !== String(id)),
      },
    }));
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
      await AsyncStorage.setItem(STORAGE_PAYLOAD_KEY, JSON.stringify(payload));
      useAppStore.setState({ syncStatus: 'live', isConnected: true });
    } else {
      // Revert to server-side canonical state on push failure
      useAppStore.getState()._setSyncStatus('error');
      const canonical = await fetchSnapshot(roomId);
      if (canonical) useAppStore.getState()._setPayload(canonical);
    }
  }, 300);
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
      await AsyncStorage.setItem(STORAGE_PAYLOAD_KEY, JSON.stringify(snapshot));
    }

    _channel = subscribeToRoom(roomId, clientId, async (incoming) => {
      useAppStore.getState()._setPayload(incoming);
      await AsyncStorage.setItem(STORAGE_PAYLOAD_KEY, JSON.stringify(incoming));
    });

    useAppStore.setState({ isConnected: true, syncStatus: 'live' });
  } catch (err) {
    console.error('[store] connection error:', err);
    useAppStore.getState()._setSyncStatus('error');
    // Fallback: load last known payload from disk
    try {
      const cached = await AsyncStorage.getItem(STORAGE_PAYLOAD_KEY);
      if (cached) useAppStore.getState()._setPayload(JSON.parse(cached) as AppPayload);
    } catch {
      // Nothing to fall back to
    }
  }
}

// ─── Public init — call once from app/_layout.tsx ────────────────────────────

export async function initialize(): Promise<void> {
  const savedUser = ((await AsyncStorage.getItem(STORAGE_USER_KEY)) as UserId | null) ?? 'a';
  useAppStore.setState({ currentUser: savedUser, selectedYM: currentYM() });
  await _connectToRoom(savedUser);
}

export async function refreshCurrentRoom(): Promise<void> {
  const { currentUser } = useAppStore.getState();
  const roomId = ROOM_FOR_USER[currentUser];
  useAppStore.getState()._setSyncStatus('connecting');
  const snapshot = await fetchSnapshot(roomId);
  if (snapshot) {
    useAppStore.getState()._setPayload(snapshot);
    await AsyncStorage.setItem(STORAGE_PAYLOAD_KEY, JSON.stringify(snapshot));
    useAppStore.setState({ syncStatus: 'live', isConnected: true });
  } else {
    useAppStore.getState()._setSyncStatus('error');
  }
}
