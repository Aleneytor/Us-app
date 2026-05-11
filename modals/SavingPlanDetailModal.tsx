import { BlurView } from 'expo-blur';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppModal as Modal } from '../components/AppModal';
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import type { SavingPlan } from '../types';
import { savingPlanProgress } from '../utils/calculations';
import { fmt, formatDateShort, parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { getUserData } from '../utils/users';

const SAVINGS_ACCENT = '#7C3AED';
const SAVINGS_ACCENT_BG = '#EDE9FE';

interface SavingPlanDetailModalProps {
  plan: SavingPlan | null;
  readOnly?: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function SavingPlanDetailModal({
  plan,
  readOnly = false,
  onClose,
  onEdit,
  onDelete,
}: SavingPlanDetailModalProps) {
  const insets = useSafeAreaInsets();
  const currentUser = useAppStore((s) => s.currentUser);
  const currency = useAppStore((s) => s.currency);
  const updateSavingPlan = useAppStore((s) => s.updateSavingPlan);
  const deleteSavingPlan = useAppStore((s) => s.deleteSavingPlan);
  const users = useAppStore((s) => s.users);

  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayStr());
  const [entryNote, setEntryNote] = useState('');

  const entryNumber = useMemo(() => parseAmt(entryAmount), [entryAmount]);

  useEffect(() => {
    if (!plan) return;
    setEntryAmount('');
    setEntryDate(todayStr());
    setEntryNote('');
  }, [plan?.id]);

  if (!plan) return null;

  const history = [...(plan.history ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const iconColor = getIconColor('purple');
  const iconInfo = CATEGORIES[plan.icon ?? 'savings'] ?? CATEGORIES.savings;
  const progress = savingPlanProgress(plan);
  const progressPct = Math.min(100, Math.round(progress.pct));
  const user = plan.uid ? getUserData(users, plan.uid) : null;

  const addHistoryEntry = () => {
    if (!Number.isFinite(entryNumber) || entryNumber <= 0) {
      Alert.alert('Monto invalido', 'Escribe un monto mayor a cero.');
      return;
    }
    updateSavingPlan({
      ...plan,
      history: [
        ...(plan.history ?? []),
        {
          id: Date.now(),
          uid: currentUser,
          amount: entryNumber,
          date: entryDate.trim() || todayStr(),
          note: entryNote.trim() || undefined,
        },
      ],
    });
    setEntryAmount('');
    setEntryDate(todayStr());
    setEntryNote('');
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar ahorro',
      `¿Eliminar "${plan.title}"? Esta accion no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteSavingPlan?.(plan.id);
            onDelete?.();
            onClose();
          },
        },
      ],
    );
  };

  const handleShareLink = async () => {
    if (!plan.link) return;
    try {
      await Share.share({ message: plan.link, title: plan.title });
    } catch {
      const ok = await Linking.canOpenURL(plan.link);
      if (ok) await Linking.openURL(plan.link);
    }
  };

  const shortLink = (() => {
    try {
      const url = new URL(plan.link ?? '');
      return url.hostname.replace(/^www\./, '');
    } catch {
      return plan.link ?? '';
    }
  })();

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
      <Pressable style={[styles.backdrop, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]} onPressIn={onClose}>
        <Pressable style={styles.cardShadow} onPressIn={(event) => event.stopPropagation()}>
          <View style={styles.card}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Detalles</Text>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
              <Ionicons name="close" size={20} color={APP_COLORS.textSecondary} />
            </Pressable>
          </View>

          {/* ── Meta row: owner + type badge ── */}
          <View style={styles.metaRow}>
            {user && (
              <>
                <View style={[styles.avatar, { backgroundColor: user.bg }]}>
                  <Text style={[styles.avatarInitials, { color: user.color }]}>{user.initials}</Text>
                </View>
                <Text style={styles.userName}>{user.name}</Text>
                <View style={styles.labelDivider} />
              </>
            )}
            <View style={[styles.typeLabel, plan.type === 'joint' ? styles.typeLabelJoint : styles.typeLabelPersonal]}>
              <Ionicons
                name={plan.type === 'joint' ? 'people' : 'person'}
                size={11}
                color={plan.type === 'joint' ? SAVINGS_ACCENT : APP_COLORS.textSecondary}
              />
              <Text style={[styles.typeLabelText, plan.type === 'joint' && styles.typeLabelTextJoint]}>
                {plan.type === 'joint' ? 'EN CONJUNTO' : 'SOLO YO'}
              </Text>
            </View>
          </View>

          {/* ── Main hero row: icon + title + amount ── */}
          <View style={styles.mainRow}>
            <View style={styles.mainLeft}>
              <View style={[styles.iconWrap, { backgroundColor: iconColor.bg }]}>
                <Ionicons name={iconInfo.icon} size={24} color={iconColor.color} />
              </View>
              <View style={styles.mainInfo}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={12} color={APP_COLORS.textMuted} />
                  <Text style={styles.dateText}>{formatDateShort(plan.date)}</Text>
                </View>
              </View>
            </View>
            <View style={styles.mainRight}>
              <Text style={styles.amountSaved}>{fmt(progress.total, currency)}</Text>
              <Text style={styles.amountTarget}>de {fmt(plan.targetAmount, currency)}</Text>
            </View>
          </View>

          {/* ── Progress bar ── */}
          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%` }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabelLeft}>{progressPct}% completado</Text>
              <Text style={styles.progressLabelRight}>{fmt(progress.remaining, currency)} restante</Text>
            </View>
          </View>

          {/* ── Link compressed ── */}
          {plan.link ? (
            <View style={styles.linkRow}>
              <Ionicons name="link-outline" size={15} color={SAVINGS_ACCENT} />
              <Text style={styles.linkText} numberOfLines={1}>{shortLink}</Text>
              <Pressable
                onPress={handleShareLink}
                hitSlop={8}
                style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
              >
                <Ionicons name="share-outline" size={17} color={SAVINGS_ACCENT} />
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={dismissKeyboardAndBlur}
          >
            {/* ── History ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Historial</Text>
            </View>
            {history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Ionicons name="cash-outline" size={17} color={APP_COLORS.textMuted} />
                <Text style={styles.emptyText}>Todavia no hay montos agregados.</Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {history.map((entry) => (
                  <View key={String(entry.id)} style={styles.historyRow}>
                    <View style={styles.historyIcon}>
                      <Ionicons name="cash-outline" size={18} color={APP_COLORS.income} />
                    </View>
                    <View style={styles.historyText}>
                      <Text style={styles.historyAmount}>{fmt(entry.amount, currency)}</Text>
                      <Text style={styles.historyMeta}>
                        {getUserData(users, entry.uid).name} · {formatDateShort(entry.date)}
                      </Text>
                      {entry.note ? <Text style={styles.historyNote}>{entry.note}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Add entry ── */}
            {!readOnly && (
              <>
                <Text style={styles.sectionTitle}>Agregar al ahorro</Text>
                <View style={styles.entryBox}>
                  <Field
                    label="Monto"
                    value={entryAmount}
                    onChangeText={setEntryAmount}
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={() => runAfterKeyboardDismiss(addHistoryEntry)}
                  />
                  <Field label="Fecha" value={entryDate} onChangeText={setEntryDate} placeholder="YYYY-MM-DD" />
                  <Field label="Nota" value={entryNote} onChangeText={setEntryNote} placeholder="Opcional" />
                  <Pressable onPress={() => runAfterKeyboardDismiss(addHistoryEntry)} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Agregar monto</Text>
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>

          {/* ── Action buttons ── */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => {}}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Ionicons name="chatbubble-outline" size={20} color={APP_COLORS.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => { onClose(); setTimeout(() => onEdit?.(), 120); }}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Ionicons name="pencil-outline" size={20} color={APP_COLORS.textSecondary} />
            </Pressable>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnDelete, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={20} color={APP_COLORS.expense} />
            </Pressable>
          </View>

          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={APP_COLORS.textMuted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 22,
    maxHeight: '88%',
    overflow: 'hidden',
    width: '100%',
  },
  cardShadow: {
    borderRadius: 22,
    elevation: 14,
    maxWidth: 520,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    width: '100%',
  },
  // ── Header ──
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  headerTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
  closeBtn: {
    alignItems: 'center',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  // ── Meta row ──
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  avatarInitials: {
    fontSize: 11,
    fontWeight: '800',
  },
  userName: {
    color: APP_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  labelDivider: {
    backgroundColor: APP_COLORS.border,
    borderRadius: 1,
    height: 12,
    width: 1,
  },
  typeLabel: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeLabelJoint: {
    backgroundColor: SAVINGS_ACCENT_BG,
    borderColor: '#C4B5FD',
  },
  typeLabelPersonal: {
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
  },
  typeLabelText: {
    color: APP_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  typeLabelTextJoint: {
    color: SAVINGS_ACCENT,
  },
  // ── Main hero row ──
  mainRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  mainLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  mainInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  planTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  dateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  dateText: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  mainRight: {
    alignItems: 'flex-end',
    gap: 2,
    marginLeft: 8,
  },
  amountSaved: {
    color: SAVINGS_ACCENT,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 28,
  },
  amountTarget: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  // ── Progress ──
  progressSection: {
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  progressTrack: {
    backgroundColor: '#EEF0F3',
    borderRadius: 4,
    height: 7,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: SAVINGS_ACCENT,
    borderRadius: 4,
    height: '100%',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabelLeft: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  progressLabelRight: {
    color: SAVINGS_ACCENT,
    fontSize: 11,
    fontWeight: '700',
  },
  // ── Link ──
  linkRow: {
    alignItems: 'center',
    backgroundColor: SAVINGS_ACCENT_BG,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  linkText: {
    color: SAVINGS_ACCENT,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  shareBtn: {
    alignItems: 'center',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  // ── Scroll content ──
  scrollContent: {
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sectionHeader: {
    marginTop: 4,
  },
  sectionTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyHistory: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  historyList: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  historyRow: {
    alignItems: 'center',
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 11,
  },
  historyIcon: {
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  historyText: {
    flex: 1,
    gap: 2,
  },
  historyAmount: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  historyMeta: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  historyNote: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  // ── Add entry ──
  entryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    gap: 12,
    padding: 12,
  },
  field: {
    gap: 7,
  },
  label: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 10,
    borderWidth: 1,
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: SAVINGS_ACCENT,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    height: 46,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  // ── Actions ──
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  actionBtnDelete: {
    backgroundColor: '#FFF1F2',
  },
  pressed: {
    opacity: 0.65,
  },
});
