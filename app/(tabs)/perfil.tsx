import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { APP_COLORS, ICON_COLORS } from '../../constants/colors';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import { CURRENCIES } from '../../types';
import type { CurrencyCode } from '../../types';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../../utils/keyboard';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const SYNC_COPY = {
  live:       { label: 'En vivo',    color: '#16A34A', icon: 'checkmark-circle' as IoniconName },
  connecting: { label: 'Conectando', color: '#94A3B8', icon: 'sync-circle'      as IoniconName },
  error:      { label: 'Error',      color: '#EC1147', icon: 'alert-circle'     as IoniconName },
};

function generateInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function PerfilScreen() {
  const currentUser    = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const currency       = useAppStore((s) => s.currency);
  const setCurrency    = useAppStore((s) => s.setCurrency);
  const syncStatus     = useAppStore((s) => s.syncStatus);
  const users          = useAppStore((s) => s.users);
  const addUser        = useAppStore((s) => s.addUser);
  const deleteUser     = useAppStore((s) => s.deleteUser);

  const [refreshing, setRefreshing]   = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName]         = useState('');
  const [colorKey, setColorKey]       = useState('purple');

  const user    = users[currentUser] ?? { name: currentUser, initials: '?', color: '#6B7280', bg: '#F3F4F6' };
  const sync    = SYNC_COPY[syncStatus];
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const userIds = Object.keys(users);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  const handleAddUser = async () => {
    const name = newName.trim();
    if (!name) return;
    const palette = ICON_COLORS.find((c) => c.id === colorKey) ?? ICON_COLORS[0]!;
    const uid     = `u_${Date.now()}`;
    const roomId  = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-main`;
    await addUser({
      uid,
      data: { name, initials: generateInitials(name), color: palette.color, bg: palette.bg },
      roomId,
      partnerId: uid,
    });
    setNewName('');
    setColorKey('purple');
    setShowAddForm(false);
  };

  const handleDeleteUser = (uid: string) => {
    const target = users[uid];
    Alert.alert(
      'Eliminar usuario',
      `¿Eliminar a ${target?.name ?? uid}?\nSus movimientos quedarán guardados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void deleteUser(uid) },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScrollBeginDrag={dismissKeyboardAndBlur}
    >
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={[styles.heroAvatar, { backgroundColor: user.bg }]}>
          <Text style={[styles.heroInitials, { color: user.color, fontSize: user.initials.length > 1 ? 22 : 28 }]}>
            {user.initials}
          </Text>
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroName}>{user.name}</Text>
          <Text style={styles.heroSub}>Usuario activo</Text>
        </View>
      </View>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <View style={styles.content}>

        {/* Usuarios */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Usuarios</Text>
          <View style={styles.card}>
            {userIds.map((uid, idx) => {
              const item   = users[uid]!;
              const active = uid === currentUser;
              return (
                <View key={uid}>
                  {idx > 0 && <View style={styles.divider} />}
                  <Pressable
                    onPress={() => void setCurrentUser(uid)}
                    style={({ pressed }) => [styles.userTile, pressed && styles.pressed]}
                  >
                    <View style={[styles.userAvatar, { backgroundColor: item.bg }]}>
                      <Text style={[styles.userInitials, { color: item.color, fontSize: item.initials.length > 1 ? 13 : 16 }]}>
                        {item.initials}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, active && { color: '#16A34A' }]}>
                        {item.name}
                      </Text>
                      {active && (
                        <Text style={styles.userActive}>Activo ahora</Text>
                      )}
                    </View>
                    {active
                      ? <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                      : (
                        <Pressable
                          onPress={() => handleDeleteUser(uid)}
                          hitSlop={{ top: 10, bottom: 10, left: 12, right: 8 }}
                          style={({ pressed }) => [pressed && styles.pressed]}
                        >
                          <Ionicons name="trash-outline" size={19} color={APP_COLORS.textMuted} />
                        </Pressable>
                      )
                    }
                  </Pressable>
                </View>
              );
            })}
          </View>

          {/* Add user */}
          {!showAddForm ? (
            <Pressable
              onPress={() => setShowAddForm(true)}
              style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            >
              <Ionicons name="person-add-outline" size={17} color="#6366F1" />
              <Text style={styles.addBtnText}>Agregar usuario</Text>
            </Pressable>
          ) : (
            <View style={styles.addForm}>
              <Text style={styles.addFormTitle}>Nuevo usuario</Text>

              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej. María"
                placeholderTextColor={APP_COLORS.textMuted}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => runAfterKeyboardDismiss(() => void handleAddUser())}
              />

              <Text style={styles.fieldLabel}>Color</Text>
              <View style={styles.palette}>
                {ICON_COLORS.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setColorKey(c.id)}
                    style={[
                      styles.paletteCircle,
                      { backgroundColor: c.color },
                      colorKey === c.id && styles.paletteCircleSelected,
                    ]}
                  >
                    {colorKey === c.id
                      ? <Ionicons name="checkmark" size={13} color="#fff" />
                      : null}
                  </Pressable>
                ))}
              </View>

              {/* Preview */}
              {newName.trim().length > 0 && (() => {
                const p = ICON_COLORS.find((c) => c.id === colorKey) ?? ICON_COLORS[0]!;
                return (
                  <View style={styles.previewRow}>
                    <View style={[styles.previewAvatar, { backgroundColor: p.bg }]}>
                      <Text style={[styles.previewInitials, { color: p.color }]}>
                        {generateInitials(newName.trim())}
                      </Text>
                    </View>
                    <Text style={styles.previewName}>{newName.trim()}</Text>
                  </View>
                );
              })()}

              <View style={styles.formButtons}>
                <Pressable
                  onPress={() => runAfterKeyboardDismiss(() => { setShowAddForm(false); setNewName(''); setColorKey('purple'); })}
                  style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => runAfterKeyboardDismiss(() => void handleAddUser())}
                  disabled={!newName.trim()}
                  style={({ pressed }) => [
                    styles.confirmBtn,
                    !newName.trim() && styles.confirmBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.confirmBtnText}>Agregar</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Preferencias */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Preferencias</Text>
          <View style={styles.card}>
            {Object.values(CURRENCIES).map((item, idx) => (
              <View key={item.code}>
                {idx > 0 && <View style={styles.divider} />}
                <Pressable
                  onPress={() => void setCurrency(item.code as CurrencyCode)}
                  style={({ pressed }) => [styles.currencyTile, pressed && styles.pressed]}
                >
                  <View style={styles.currencySymbolBox}>
                    <Text style={styles.currencySymbol}>{item.symbol}</Text>
                  </View>
                  <View style={styles.currencyInfo}>
                    <Text style={styles.currencyLabel}>{item.label}</Text>
                    <Text style={styles.currencyCode}>{item.code}</Text>
                  </View>
                  {currency === item.code
                    ? <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                    : <View style={styles.currencyCircleEmpty} />
                  }
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        {/* Sincronización */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sincronización</Text>
          <View style={[styles.card, styles.syncCard]}>
            <View style={styles.syncLeft}>
              <View style={[styles.syncIconWrap, { backgroundColor: sync.color + '18' }]}>
                <Ionicons name={sync.icon} size={22} color={sync.color} />
              </View>
              <View>
                <Text style={styles.syncStatusLabel}>Estado</Text>
                <Text style={[styles.syncStatusValue, { color: sync.color }]}>{sync.label}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => void handleRefresh()}
              style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}
            >
              <Ionicons name="refresh" size={18} color={APP_COLORS.textPrimary} />
            </Pressable>
          </View>
        </View>

        {/* Acerca de */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Acerca de</Text>
          <View style={[styles.card, styles.aboutCard]}>
            <Text style={styles.aboutKey}>Versión</Text>
            <Text style={styles.aboutValue}>{version}</Text>
          </View>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ── Screen ────────────────────────────────────────────────────────────────
  screen: {
    backgroundColor: '#EDF2F6',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 56,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 4,
    flexDirection: 'row',
    gap: 16,
    paddingBottom: 28,
    paddingHorizontal: 28,
    paddingTop: 56,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
  },
  heroAvatar: {
    alignItems: 'center',
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  heroInitials: {
    fontWeight: '900',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    color: '#303236',
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    lineHeight: 32,
  },
  heroSub: {
    color: APP_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    gap: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  // ── Section ───────────────────────────────────────────────────────────────
  section: {
    gap: 10,
  },
  sectionLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginLeft: 4,
    textTransform: 'uppercase',
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
  },
  divider: {
    backgroundColor: APP_COLORS.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },

  // ── User tiles ────────────────────────────────────────────────────────────
  userTile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  userAvatar: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  userInitials: {
    fontWeight: '900',
  },
  userInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  userName: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  userActive: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Add user button ───────────────────────────────────────────────────────
  addBtn: {
    alignItems: 'center',
    borderColor: '#C7D2FE',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  addBtnText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Add form ──────────────────────────────────────────────────────────────
  addForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    gap: 14,
    padding: 18,
  },
  addFormTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  fieldLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: -6,
    textTransform: 'uppercase',
  },
  textInput: {
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paletteCircle: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  paletteCircleSelected: {
    borderColor: '#0F172A',
    borderWidth: 2.5,
  },
  previewRow: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewAvatar: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  previewInitials: {
    fontSize: 12,
    fontWeight: '900',
  },
  previewName: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  cancelBtn: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13,
  },
  cancelBtnText: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 13,
  },
  confirmBtnDisabled: {
    opacity: 0.35,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Currency tiles ────────────────────────────────────────────────────────
  currencyTile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  currencySymbolBox: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  currencySymbol: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  currencyInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  currencyLabel: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  currencyCode: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  currencyCircleEmpty: {
    borderColor: APP_COLORS.border,
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    width: 22,
  },

  // ── Sync ──────────────────────────────────────────────────────────────────
  syncCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  syncLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  syncIconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  syncStatusLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  syncStatusValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  refreshBtn: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  // ── About ─────────────────────────────────────────────────────────────────
  aboutCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  aboutKey: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  aboutValue: {
    color: APP_COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Shared ────────────────────────────────────────────────────────────────
  pressed: {
    opacity: 0.68,
  },
});
