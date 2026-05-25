import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TransactionTile } from '../components/TransactionTile';
import { AppModal as Modal } from '../components/AppModal';
import { ModalScreen } from '../components/ModalScreen';
import { type AppTheme, getIconColor } from '../constants/colors';
import { useAppStore } from '../store/useAppStore';
import type { BudgetCategory, CurrencyCode, Transaction } from '../types';
import { calcBudgetCategorySpending, calcBudgetCategoryIncome } from '../utils/calculations';
import { fmt } from '../utils/format';
import { TransactionModal } from './TransactionModal';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { BudgetCategoryModal } from './BudgetCategoryModal';
import { runAfterKeyboardDismiss } from '../utils/keyboard';
import { useTheme } from '../contexts/ThemeContext';

interface BudgetCategoryDetailModalProps {
  category: BudgetCategory | null;
  currency: CurrencyCode;
  selectedYM: string;
  onClose: () => void;
}

export function BudgetCategoryDetailModal({
  category,
  currency,
  selectedYM,
  onClose,
}: BudgetCategoryDetailModalProps) {
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const deleteTx = useAppStore((s) => s.deleteTransaction);
  const deleteBudgetCategory = useAppStore((s) => s.deleteBudgetCategory);
  const updateBudgetCategory = useAppStore((s) => s.updateBudgetCategory);
  const theme = useTheme();
  const colors = useMemo(() => makeColors(theme), [theme]);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Always read the live category from the store so edits (e.g. adding a budget) reflect instantly.
  const liveCategory = useAppStore((s) =>
    category
      ? (s.payload.budgetCategories ?? []).find((c) => String(c.id) === String(category.id)) ?? category
      : null,
  );

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [createTxOpen, setCreateTxOpen] = useState(false);
  const [editCategoryOpen, setEditCategoryOpen] = useState(false);
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteText, setNoteText] = useState('');

  const spent = liveCategory ? calcBudgetCategorySpending(payload, liveCategory.id, currentUser, selectedYM) : 0;
  const incomeReal = liveCategory ? calcBudgetCategoryIncome(payload, liveCategory.id, selectedYM) : 0;
  const available = liveCategory ? liveCategory.monthlyBudget - spent : 0;
  const hasBudget = !!liveCategory && liveCategory.monthlyBudget > 0;
  const isOver = hasBudget && available < 0;
  const pct = hasBudget ? Math.min(1, spent / liveCategory.monthlyBudget) : 0;
  const hasIncome = incomeReal > 0;

  const transactions = useMemo(() => {
    if (!liveCategory) return [];
    return payload.expenses
      .filter((t) => !t.del && String(t.budgetCatId) === String(liveCategory.id))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }, [liveCategory, payload.expenses]);

  const confirmDeleteTx = (t: Transaction) => {
    Alert.alert(
      'Eliminar movimiento',
      t.desc || 'Este movimiento se ocultará para todos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => { deleteTx(t.id); setSelectedTx(null); },
        },
      ],
    );
  };

  const confirmDeleteCategory = () => {
    if (!category || !liveCategory) return;
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar "${liveCategory.name}"? Los movimientos vinculados pasarán a quedar "Sin categoría".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => { deleteBudgetCategory(liveCategory.id); onClose(); },
        },
      ],
    );
  };

  const openNoteEditor = () => {
    if (!liveCategory) return;
    setNoteText(liveCategory.notes ?? '');
    setNoteEditing(true);
  };

  const saveNote = () => {
    if (!liveCategory) return;
    updateBudgetCategory({ ...liveCategory, notes: noteText.trim() || undefined });
    setNoteEditing(false);
  };

  const cancelNote = () => {
    setNoteEditing(false);
    setNoteText('');
  };

  if (!category || !liveCategory) return null;

  const iconColorSet = getIconColor(liveCategory.iconColor);

  return (
    <Modal visible={!!category} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <ModalScreen
        title={liveCategory.name}
        subtitle={hasBudget ? `${fmt(liveCategory.monthlyBudget, currency)} / mes` : 'Sin presupuesto'}
        onBack={onClose}
        contentContainerStyle={{ padding: 0 }}
        footer={(
          <>
            <Pressable
              onPress={() => setEditCategoryOpen(true)}
              style={({ pressed }) => [styles.footerBtn, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="square-edit-outline" size={20} color={colors.actionText} />
              <Text style={styles.footerBtnText}>Editar</Text>
            </Pressable>
            <Pressable
              onPress={confirmDeleteCategory}
              style={({ pressed }) => [styles.footerBtn, styles.footerBtnDelete, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.expense} />
              <Text style={[styles.footerBtnText, styles.footerBtnDeleteText]}>Eliminar</Text>
            </Pressable>
          </>
        )}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ── Amount card ─────────────────────────────────── */}
          <View style={styles.amountCard}>
            <Text style={styles.spentAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
              {fmt(spent, currency)}
            </Text>
            <Text style={styles.spentSublabel}>Abonado a esta categoría</Text>
            {hasBudget && (
              <View style={styles.amountProgressWrap}>
                <View style={styles.amountProgressTrack}>
                  <View
                    style={[
                      styles.amountProgressFill,
                      {
                        width: `${Math.round(pct * 100)}%` as `${number}%`,
                        backgroundColor: isOver ? colors.expense : iconColorSet.color,
                      },
                    ]}
                  />
                </View>
                {isOver && (
                  <View style={[styles.badge, styles.overBadge]}>
                    <Ionicons name="warning-outline" size={13} color={colors.expense} />
                    <Text style={[styles.badgeText, { color: colors.expense }]}>EXCEDIDO</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* ── Detail list ─────────────────────────────────── */}
          <View style={styles.detailList}>

            {/* Row: Presupuesto (full width) */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconCircle}>
                <Ionicons name="wallet-outline" size={16} color={colors.text} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Presupuesto</Text>
                {hasBudget ? (
                  <Text style={styles.detailValue}>{fmt(liveCategory.monthlyBudget, currency)}</Text>
                ) : (
                  <Text style={[styles.detailValue, styles.detailValueMuted]}>Sin límite</Text>
                )}
              </View>
              {!hasBudget && (
                <Pressable
                  onPress={() => setEditCategoryOpen(true)}
                  style={({ pressed }) => [styles.addBudgetBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.addBudgetBtnText}>Agregar</Text>
                </Pressable>
              )}
            </View>

            {/* Row: Disponible */}
            {hasBudget && (
              <>
                <View style={styles.separator} />
                <View style={styles.detailRow}>
                  <View style={[
                    styles.detailIconCircle,
                    { backgroundColor: isOver ? 'rgba(255,89,104,0.15)' : colors.iconBg },
                  ]}>
                    <Ionicons
                      name={isOver ? 'trending-down-outline' : 'trending-up-outline'}
                      size={16}
                      color={isOver ? colors.expense : colors.text}
                    />
                  </View>
                  <View style={styles.detailCopy}>
                    <Text style={styles.detailLabel}>Disponible</Text>
                    <Text style={[styles.detailValue, isOver && styles.valueExpense]}>
                      {fmt(Math.abs(available), currency)}
                    </Text>
                  </View>
                </View>
              </>
            )}


            {/* Row: Ingresos del mes */}
            {hasIncome && (
              <>
                <View style={styles.separator} />
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconCircle, { backgroundColor: 'rgba(57,210,125,0.15)' }]}>
                    <Ionicons name="arrow-up-outline" size={16} color={colors.income} />
                  </View>
                  <View style={styles.detailCopy}>
                    <Text style={styles.detailLabel}>Ingresos del mes</Text>
                    <Text style={[styles.detailValue, { color: colors.income }]}>
                      {fmt(incomeReal, currency)}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* Row: Nota */}
            <View style={styles.separator} />
            {noteEditing ? (
              <View style={styles.noteEditorRow}>
                <TextInput
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="Escribe un comentario…"
                  placeholderTextColor={colors.muted}
                  multiline
                  autoFocus
                  style={styles.noteInput}
                />
                <View style={styles.noteEditorActions}>
                  <Pressable
                    onPress={() => runAfterKeyboardDismiss(cancelNote)}
                    style={({ pressed }) => [styles.noteBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.noteBtnCancel}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => runAfterKeyboardDismiss(saveNote)}
                    style={({ pressed }) => [styles.noteBtn, styles.noteBtnSave, pressed && styles.pressed]}
                  >
                    <Text style={styles.noteBtnSaveText}>Guardar</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={openNoteEditor}
                style={({ pressed }) => [styles.detailRow, pressed && styles.pressed]}
              >
                <View style={styles.detailIconCircle}>
                  <Ionicons name="document-text-outline" size={16} color={colors.text} />
                </View>
                <View style={styles.detailCopy}>
                  <Text style={styles.detailLabel}>Nota</Text>
                  {liveCategory.notes ? (
                    <Text style={styles.detailValue}>{liveCategory.notes}</Text>
                  ) : (
                    <Text style={styles.detailValueMuted}>Sin nota</Text>
                  )}
                </View>
                {!liveCategory.notes && (
                  <Pressable
                    onPress={openNoteEditor}
                    style={({ pressed }) => [styles.addBudgetBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.addBudgetBtnText}>Agregar</Text>
                  </Pressable>
                )}
              </Pressable>
            )}
          </View>

          {/* ── Quick add ───────────────────────────────────── */}
          <Pressable
            onPress={() => setCreateTxOpen(true)}
            style={({ pressed }) => [styles.quickAddButton, pressed && styles.pressed]}
          >
            <View style={styles.quickAddIcon}>
              <Ionicons name="add" size={18} color={colors.text} />
            </View>
            <View style={styles.quickAddTextWrap}>
              <Text style={styles.quickAddTitle}>Agregar movimiento</Text>
              <Text style={styles.quickAddSubtitle}>Ingreso o gasto para {liveCategory.name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          {/* ── Transaction list ─────────────────────────────── */}
          <Text style={styles.txSectionTitle}>Movimientos de esta categoría</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={32} color={colors.muted} />
              <Text style={styles.emptyTitle}>Sin movimientos</Text>
              <Text style={styles.emptyText}>
                Agrega un ingreso o gasto desde esta categoría para comenzar a rastrear tu presupuesto.
              </Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {transactions.map((t) => (
                <TransactionTile
                  key={t.id}
                  transaction={t}
                  ym={selectedYM}
                  onPress={() => setSelectedTx(t)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </ModalScreen>

      <TransactionModal
        visible={createTxOpen || !!editTx}
        transaction={editTx}
        initialBudgetCatId={liveCategory.id}
        budgetCategoryLocked={createTxOpen}
        onClose={() => {
          setCreateTxOpen(false);
          setEditTx(null);
        }}
      />

      <TransactionDetailModal
        transaction={selectedTx}
        ym={selectedYM}
        onClose={() => setSelectedTx(null)}
        onEdit={(t) => { setSelectedTx(null); setEditTx(t); }}
        onDelete={confirmDeleteTx}
      />

      <BudgetCategoryModal
        visible={editCategoryOpen}
        category={liveCategory}
        onClose={() => setEditCategoryOpen(false)}
      />
    </Modal>
  );
}

function makeColors(t: AppTheme) {
  return {
    card: t.surface,
    cardBorder: t.border,
    text: t.textPrimary,
    secondary: t.textSecondary,
    muted: t.textMuted,
    iconBg: t.softSurface,
    actionBg: t.softSurface,
    actionText: t.textSecondary,
    expense: t.expense,
    income: t.income,
    blue: t.blue,
    progressTrack: t.border,
    noBudgetBg: t.softSurface,
  };
}

const makeStyles = (colors: ReturnType<typeof makeColors>) => StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
    paddingTop: 8,
  },

  // ── Amount card ──────────────────────────────────────────
  amountCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    gap: 6,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  spentAmount: {
    color: colors.text,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 40,
    letterSpacing: 0,
    lineHeight: 48,
    textAlign: 'center',
  },
  spentSublabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  amountProgressWrap: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  amountProgressTrack: {
    backgroundColor: colors.progressTrack,
    borderRadius: 8,
    height: 10,
    overflow: 'hidden',
    width: '100%',
  },
  amountProgressFill: {
    borderRadius: 8,
    height: '100%',
  },
  amountPctText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'flex-end',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  badge: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 6,
    height: 30,
    justifyContent: 'center',
    maxWidth: 180,
    paddingHorizontal: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  overBadge: { backgroundColor: 'rgba(255, 89, 104, 0.20)' },
  okBadge: { backgroundColor: 'rgba(57, 210, 125, 0.18)' },
  noBudgetBadge: { backgroundColor: colors.noBudgetBg },

  // ── Detail list ──────────────────────────────────────────
  detailList: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  twoColRow: {
    flexDirection: 'row',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailIconCircle: {
    alignItems: 'center',
    backgroundColor: colors.iconBg,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  detailCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  detailLabel: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  detailValueMuted: {
    color: colors.secondary,
    fontStyle: 'italic',
    fontWeight: '400',
  },
  valueExpense: {
    color: colors.expense,
  },
  colDivider: {
    alignSelf: 'stretch',
    backgroundColor: colors.cardBorder,
    width: 1,
  },
  separator: {
    backgroundColor: colors.cardBorder,
    height: 1,
  },

  // ── Progress row ─────────────────────────────────────────
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  progressTrack: {
    backgroundColor: colors.progressTrack,
    borderRadius: 8,
    flex: 1,
    height: 12,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 6,
    height: '100%',
  },
  pctText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 34,
    textAlign: 'right',
  },

  // ── Note editor ──────────────────────────────────────────
  noteEditorRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noteInput: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  noteEditorActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  noteBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noteBtnCancel: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  noteBtnSave: {
    backgroundColor: colors.blue,
    borderRadius: 10,
  },
  noteBtnSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Quick add ────────────────────────────────────────────
  quickAddButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickAddIcon: {
    alignItems: 'center',
    backgroundColor: colors.iconBg,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  quickAddTextWrap: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  quickAddTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  quickAddSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },

  addBudgetBtn: {
    backgroundColor: colors.actionBg,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBudgetBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Transaction list ─────────────────────────────────────
  txSectionTitle: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  txList: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 32,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.secondary,
    fontSize: 13,
    maxWidth: 260,
    textAlign: 'center',
  },

  // ── Footer buttons ───────────────────────────────────────
  footerBtn: {
    alignItems: 'center',
    backgroundColor: colors.actionBg,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 10,
  },
  footerBtnText: {
    color: colors.actionText,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  footerBtnDelete: {
    backgroundColor: 'rgba(255, 89, 104, 0.12)',
    borderColor: 'rgba(255, 89, 104, 0.24)',
  },
  footerBtnDeleteText: {
    color: colors.expense,
  },
  pressed: {
    opacity: 0.72,
  },
});
