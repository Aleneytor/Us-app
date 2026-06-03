import * as Linking from 'expo-linking';
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
import { ModalScreen } from '../components/ModalScreen';
import { CATEGORIES } from '../constants/categories';
import { type AppTheme, getIconColor } from '../constants/colors';
import type { SavingPlan, SavingPlanHistoryEntry } from '../types';
import { savingPlanProgress, savingPlanSavedAmount } from '../utils/calculations';
import { fmt, formatDateShort, parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { getUserData } from '../utils/users';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import { useTheme } from '../contexts/ThemeContext';

const SAVINGS_ACCENT = '#7C3AED';
const SAVINGS_ACCENT_BG = 'rgba(124, 58, 237, 0.10)';
const COMPLETE_COLOR = '#16A34A';

type EntrySource = 'balance' | 'existing';

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
  const currentUser = useAppStore((s) => s.currentUser);
  const currency = useAppStore((s) => s.currency);
  const updateSavingPlan = useAppStore((s) => s.updateSavingPlan);
  const deleteSavingPlan = useAppStore((s) => s.deleteSavingPlan);
  const users = useAppStore((s) => s.users);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayStr());
  const [entryNote, setEntryNote] = useState('');
  const [entrySource, setEntrySource] = useState<EntrySource>('balance');
  const noteScroll = useKeyboardAwareScroll();

  const entryNumber = useMemo(() => parseAmt(entryAmount), [entryAmount]);

  useEffect(() => {
    if (!plan) return;
    setEntryAmount('');
    setEntryDate(todayStr());
    setEntryNote('');
    setEntrySource('balance');
  }, [plan?.id]);

  if (!plan) return null;

  const saveType = plan.saveType ?? 'goal';
  const history = [...(plan.history ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const iconColor = getIconColor(plan.iconColor ?? 'purple');
  const iconInfo = CATEGORIES[plan.icon ?? 'savings'] ?? CATEGORIES.savings;
  const progress = savingPlanProgress(plan);
  const progressPct = Math.min(100, Math.round(progress.pct));
  const isComplete = progressPct >= 100;
  const totalSaved = savingPlanSavedAmount(plan);

  const addHistoryEntry = () => {
    if (!Number.isFinite(entryNumber) || entryNumber <= 0) {
      Alert.alert('Monto inválido', 'Escribe un monto mayor a cero.');
      return;
    }
    const entry: SavingPlanHistoryEntry = {
      id: Date.now(),
      uid: currentUser,
      amount: entryNumber,
      date: entryDate.trim() || todayStr(),
      note: entryNote.trim() || undefined,
      source: entrySource,
    };
    updateSavingPlan({ ...plan, history: [...(plan.history ?? []), entry] });
    setEntryAmount('');
    setEntryDate(todayStr());
    setEntryNote('');
    setEntrySource('balance');
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar ahorro',
      `¿Eliminar "${plan.title}"? Esta acción no se puede deshacer.`,
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
      return new URL(plan.link ?? '').hostname.replace(/^www\./, '');
    } catch {
      return plan.link ?? '';
    }
  })();

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <ModalScreen
        title={plan.title}
        breadcrumbs={['Ahorro', 'Detalle']}
        activeBreadcrumb={1}
        onBack={onClose}
        contentContainerStyle={{ padding: 0 }}
        footer={!readOnly ? (
          <>
            <Pressable
              onPress={() => { onClose(); setTimeout(() => onEdit?.(), 120); }}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Ionicons name="pencil-outline" size={18} color={theme.textSecondary} />
              <Text style={styles.actionBtnText}>Editar</Text>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnDelete, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={18} color={theme.expense} />
              <Text style={[styles.actionBtnText, { color: theme.expense }]}>Eliminar</Text>
            </Pressable>
          </>
        ) : undefined}
      >
        <ScrollView
          ref={noteScroll.scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            noteScroll.bottomPadding !== undefined && { paddingBottom: noteScroll.bottomPadding },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={dismissKeyboardAndBlur}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: iconColor.color }]}>
              <Ionicons name={iconInfo.icon} size={26} color="#FFFFFF" />
            </View>
            <View style={styles.heroInfo}>
              {saveType === 'free' ? (
                <>
                  <Text style={styles.heroAmount}>{fmt(totalSaved, currency)}</Text>
                  <Text style={styles.heroSub}>guardados · ahorro libre</Text>
                </>
              ) : (
                <>
                  <Text style={styles.heroAmount}>{fmt(progress.total, currency)}</Text>
                  <Text style={styles.heroSub}>de {fmt(plan.targetAmount, currency)}</Text>
                </>
              )}
            </View>
            {saveType === 'goal' && (
              <Text style={[styles.heroPct, isComplete && styles.heroPctComplete]}>
                {progressPct}%
              </Text>
            )}
          </View>

          {/* ── Barra de progreso (solo goal) ── */}
          {saveType === 'goal' && (
            <View style={styles.progressSection}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPct}%` as `${number}%` },
                    isComplete && styles.progressFillComplete,
                  ]}
                />
              </View>
              {isComplete ? (
                <View style={styles.completeRow}>
                  <Ionicons name="checkmark-circle" size={13} color={COMPLETE_COLOR} />
                  <Text style={styles.completeText}>¡Meta alcanzada!</Text>
                </View>
              ) : (
                <Text style={styles.progressRemaining}>
                  Falta{' '}
                  <Text style={styles.progressRemainingAmt}>{fmt(progress.remaining, currency)}</Text>
                </Text>
              )}
            </View>
          )}

          {/* ── Link (solo goal) ── */}
          {saveType === 'goal' && plan.link ? (
            <Pressable
              onPress={handleShareLink}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <Ionicons name="link-outline" size={14} color={SAVINGS_ACCENT} />
              <Text style={styles.linkText} numberOfLines={1}>{shortLink}</Text>
              <Ionicons name="open-outline" size={14} color={SAVINGS_ACCENT} />
            </Pressable>
          ) : null}

          {/* ── Notas ── */}
          {plan.notes ? (
            <View style={styles.notesRow}>
              <Ionicons name="document-text-outline" size={14} color={theme.textMuted} />
              <Text style={styles.notesText}>{plan.notes}</Text>
            </View>
          ) : null}

          {/* ── Historial ── */}
          <Text style={styles.sectionTitle}>Historial</Text>
          {history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="cash-outline" size={16} color={theme.textMuted} />
              <Text style={styles.emptyText}>Todavía no hay aportes.</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {history.map((entry) => (
                <HistoryRow key={String(entry.id)} entry={entry} users={users} currency={currency} styles={styles} theme={theme} />
              ))}
            </View>
          )}

          {/* ── Agregar aporte ── */}
          {!readOnly && (
            <>
              <Text style={styles.sectionTitle}>Agregar al ahorro</Text>
              <View style={styles.entryBox}>
                {/* Monto */}
                <Field
                  label="Monto"
                  value={entryAmount}
                  onChangeText={setEntryAmount}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={() => runAfterKeyboardDismiss(addHistoryEntry)}
                />

                {/* Fuente */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Fuente del dinero</Text>
                  <View style={styles.sourceRow}>
                    <SourceButton
                      label="Del balance"
                      description="Descuenta del saldo del mes"
                      icon="wallet-outline"
                      active={entrySource === 'balance'}
                      onPress={() => setEntrySource('balance')}
                      styles={styles}
                      theme={theme}
                    />
                    <SourceButton
                      label="Ahorros previos"
                      description="Dinero que ya tenías antes"
                      icon="archive-outline"
                      active={entrySource === 'existing'}
                      onPress={() => setEntrySource('existing')}
                      styles={styles}
                      theme={theme}
                    />
                  </View>
                </View>

                {/* Fecha */}
                <Field label="Fecha" value={entryDate} onChangeText={setEntryDate} placeholder="YYYY-MM-DD" />

                {/* Nota */}
                <Field
                  label="Nota (opcional)"
                  value={entryNote}
                  onChangeText={setEntryNote}
                  placeholder="Ej. Ahorro de este mes"
                  multiline
                  onFocus={noteScroll.onFocus}
                  onBlur={noteScroll.onBlur}
                />

                <Pressable
                  onPress={() => runAfterKeyboardDismiss(addHistoryEntry)}
                  style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>Agregar</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </ModalScreen>
    </Modal>
  );
}

// ── HistoryRow ────────────────────────────────────────────────────────────────

function HistoryRow({
  entry,
  users,
  currency,
  styles,
  theme,
}: {
  entry: SavingPlanHistoryEntry;
  users: ReturnType<typeof useAppStore.getState>['users'];
  currency: ReturnType<typeof useAppStore.getState>['currency'];
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
}) {
  const isBalance = entry.source === 'balance';
  const isPrevious = entry.source === 'existing';
  const user = getUserData(users, entry.uid);

  return (
    <View style={styles.historyRow}>
      <View style={styles.historyIconWrap}>
        <Ionicons name="cash-outline" size={16} color={theme.income} />
      </View>
      <View style={styles.historyContent}>
        <Text style={styles.historyAmount}>{fmt(entry.amount, currency)}</Text>
        <View style={styles.historyMeta}>
          <Text style={styles.historyMetaText}>{user.name} · {formatDateShort(entry.date)}</Text>
          {isBalance && (
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText}>balance</Text>
            </View>
          )}
          {isPrevious && (
            <View style={[styles.sourceBadge, styles.sourceBadgePrev]}>
              <Text style={[styles.sourceBadgeText, styles.sourceBadgeTextPrev]}>previo</Text>
            </View>
          )}
        </View>
        {entry.note ? <Text style={styles.historyNote}>{entry.note}</Text> : null}
      </View>
    </View>
  );
}

// ── SourceButton ─────────────────────────────────────────────────────────────

function SourceButton({
  label,
  description,
  icon,
  active,
  onPress,
  styles,
  theme,
}: {
  label: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sourceBtn, active && styles.sourceBtnActive, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={16} color={active ? SAVINGS_ACCENT : theme.textMuted} />
      <Text style={[styles.sourceBtnLabel, active && styles.sourceBtnLabelActive]}>{label}</Text>
      <Text style={[styles.sourceBtnDesc, active && styles.sourceBtnDescActive]}>{description}</Text>
    </Pressable>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={[styles.input, props.multiline && styles.inputMulti]}
        {...props}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (t: AppTheme) => StyleSheet.create({
  scrollContent: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  // -- Hero --
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  heroIcon: {
    alignItems: 'center',
    borderRadius: 16,
    flexShrink: 0,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  heroInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  heroAmount: {
    color: SAVINGS_ACCENT,
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    letterSpacing: -0.5,
  },
  heroSub: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  heroPct: {
    color: SAVINGS_ACCENT,
    flexShrink: 0,
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
  },
  heroPctComplete: {
    color: COMPLETE_COLOR,
  },
  // -- Progress --
  progressSection: {
    gap: 6,
  },
  progressTrack: {
    backgroundColor: t.mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.10)',
    borderRadius: 4,
    height: 7,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: SAVINGS_ACCENT,
    borderRadius: 4,
    height: '100%',
  },
  progressFillComplete: {
    backgroundColor: COMPLETE_COLOR,
  },
  completeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  completeText: {
    color: COMPLETE_COLOR,
    fontSize: 12,
    fontWeight: '700',
  },
  progressRemaining: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  progressRemainingAmt: {
    color: SAVINGS_ACCENT,
    fontWeight: '800',
  },
  // -- Link --
  linkRow: {
    alignItems: 'center',
    backgroundColor: SAVINGS_ACCENT_BG,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  linkText: {
    color: SAVINGS_ACCENT,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  // -- Notes --
  notesRow: {
    alignItems: 'flex-start',
    backgroundColor: t.background,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  notesText: {
    color: t.textSecondary,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  // -- Section title --
  sectionTitle: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  // -- History --
  emptyHistory: {
    alignItems: 'center',
    backgroundColor: t.background,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  emptyText: {
    color: t.textSecondary,
    fontSize: 13,
  },
  historyList: {
    borderTopColor: t.border,
    borderTopWidth: 1,
  },
  historyRow: {
    alignItems: 'flex-start',
    borderBottomColor: t.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 11,
  },
  historyIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(22,163,74,0.12)',
    borderRadius: 10,
    flexShrink: 0,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  historyContent: {
    flex: 1,
    gap: 3,
  },
  historyAmount: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  historyMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  historyMetaText: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  sourceBadge: {
    backgroundColor: SAVINGS_ACCENT_BG,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  sourceBadgeText: {
    color: SAVINGS_ACCENT,
    fontSize: 10,
    fontWeight: '700',
  },
  sourceBadgePrev: {
    backgroundColor: t.mode === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.07)',
  },
  sourceBadgeTextPrev: {
    color: t.textMuted,
  },
  historyNote: {
    color: t.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  // -- Entry form --
  entryBox: {
    backgroundColor: t.background,
    borderRadius: 14,
    gap: 12,
    padding: 14,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 10,
    borderWidth: 1,
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'center',
  },
  inputMulti: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  // -- Source selector --
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sourceBtn: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  sourceBtnActive: {
    backgroundColor: SAVINGS_ACCENT_BG,
    borderColor: SAVINGS_ACCENT,
  },
  sourceBtnLabel: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  sourceBtnLabelActive: {
    color: SAVINGS_ACCENT,
  },
  sourceBtnDesc: {
    color: t.textMuted,
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  sourceBtnDescActive: {
    color: SAVINGS_ACCENT,
    opacity: 0.75,
  },
  // -- Add button --
  addButton: {
    alignItems: 'center',
    backgroundColor: SAVINGS_ACCENT,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    height: 46,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // -- Footer actions --
  actionBtn: {
    alignItems: 'center',
    backgroundColor: t.softSurface,
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  actionBtnDelete: {
    backgroundColor: t.mode === 'light' ? '#FFF1F2' : 'rgba(239,68,68,0.10)',
  },
  actionBtnText: {
    color: t.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.65,
  },
});
