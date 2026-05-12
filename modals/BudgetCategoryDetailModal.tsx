import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { APP_COLORS, getIconColor } from '../constants/colors';
import { CATEGORIES } from '../constants/categories';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import { useAppStore } from '../store/useAppStore';
import type { BudgetCategory, CurrencyCode, Transaction } from '../types';
import { calcBudgetCategorySpending, calcBudgetCategoryIncome } from '../utils/calculations';
import { fmt } from '../utils/format';
import { TransactionModal } from './TransactionModal';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { BudgetCategoryModal } from './BudgetCategoryModal';
import { runAfterKeyboardDismiss } from '../utils/keyboard';

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
  const insets = useSafeAreaInsets();
  const payload = useAppStore((s) => s.payload);
  const updateTx = useAppStore((s) => s.updateTransaction);
  const deleteTx = useAppStore((s) => s.deleteTransaction);
  const deleteBudgetCategory = useAppStore((s) => s.deleteBudgetCategory);
  const updateBudgetCategory = useAppStore((s) => s.updateBudgetCategory);

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editCategoryOpen, setEditCategoryOpen] = useState(false);
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteText, setNoteText] = useState('');

  const spent = category ? calcBudgetCategorySpending(payload, category.id, selectedYM) : 0;
  const incomeReal = category ? calcBudgetCategoryIncome(payload, category.id, selectedYM) : 0;
  const available = category ? category.monthlyBudget - spent : 0;
  const isOver = available < 0;
  const pct = category && category.monthlyBudget > 0 ? Math.min(1, spent / category.monthlyBudget) : 0;

  const hasIncomeEstimate = (category?.monthlyIncomeEstimate ?? 0) > 0;
  const incomeEstimate = category?.monthlyIncomeEstimate ?? 0;
  const incomeRemaining = Math.max(0, incomeEstimate - incomeReal);
  const incomeReached = incomeReal >= incomeEstimate;
  const incomePct = incomeEstimate > 0 ? Math.min(1, incomeReal / incomeEstimate) : 0;

  const transactions = useMemo(() => {
    if (!category) return [];
    return payload.expenses
      .filter((t) => !t.del && String(t.budgetCatId) === String(category.id))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }, [category, payload.expenses]);


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
    if (!category) return;
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar "${category.name}"? Los movimientos vinculados no se borrarán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => { deleteBudgetCategory(category.id); onClose(); },
        },
      ],
    );
  };

  const openNoteEditor = () => {
    if (!category) return;
    setNoteText(category.notes ?? '');
    setNoteEditing(true);
  };

  const saveNote = () => {
    if (!category) return;
    updateBudgetCategory({ ...category, notes: noteText.trim() || undefined });
    setNoteEditing(false);
  };

  const cancelNote = () => {
    setNoteEditing(false);
    setNoteText('');
  };

  if (!category) return null;

  const iconColorSet = getIconColor(category.iconColor);
  const iconInfo = CATEGORIES[category.icon] ?? CATEGORIES.other;

  return (
    <Modal visible={!!category} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
      <Pressable style={[styles.screen, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]} onPressIn={onClose}>
        <Pressable style={styles.cardShadow} onPressIn={(event) => event.stopPropagation()}>
          <View style={styles.card}>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: iconColorSet.bg }]}>
              <Ionicons name={iconInfo.icon} size={22} color={iconColorSet.color} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.budgetLabel}>
                {fmt(category.monthlyBudget, currency)} / mes
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={22} color={APP_COLORS.textPrimary} />
            </Pressable>
          </View>

          {/* Progress summary */}
          <View style={styles.progressSection}>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: isOver ? '#DC2626' : iconColorSet.color },
                ]}
              />
            </View>
            <View style={styles.progressNumbers}>
              <Text style={styles.spentLabel}>
                <Text style={styles.spentAmount}>{fmt(spent, currency)}</Text>
                {' '}gastado
              </Text>
              <Text style={[styles.availableLabel, { color: isOver ? '#DC2626' : iconColorSet.color }]}>
                {isOver
                  ? `Excediste por ${fmt(Math.abs(available), currency)}`
                  : `${fmt(available, currency)} disponible`}
              </Text>
            </View>
          </View>

          {/* Income section (optional) */}
          {hasIncomeEstimate && (
            <View style={styles.incomeSection}>
              <View style={styles.incomeSectionHeader}>
                <Ionicons
                  name="arrow-up"
                  size={14}
                  color={APP_COLORS.income}
                />
                <Text style={styles.incomeSectionTitle}>Ingresos del mes</Text>
                <Text style={styles.incomeEstimateText}>Estimado {fmt(incomeEstimate, currency)}</Text>
              </View>
              <View style={styles.incomeBarTrack}>
                <View
                  style={[
                    styles.incomeBarFill,
                    { width: `${Math.round(incomePct * 100)}%` as `${number}%` },
                  ]}
                />
              </View>
              <View style={styles.incomeNumbersRow}>
                <Text style={styles.incomeCurrentText}>
                  <Text style={styles.incomeCurrentAmount}>{fmt(incomeReal, currency)}</Text>
                  {' '}actual
                </Text>
                <Text style={[styles.incomeRemainingText, incomeReached && styles.incomeReachedText]}>
                  {`${fmt(incomeRemaining, currency)} por alcanzar`}
                </Text>
              </View>
            </View>
          )}

          {/* Notes / comment area */}
          {noteEditing ? (
            <View style={styles.noteEditorWrap}>
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Escribe un comentario…"
                placeholderTextColor={APP_COLORS.textMuted}
                multiline
                autoFocus
                style={styles.noteInput}
              />
              <View style={styles.noteEditorActions}>
                <Pressable onPress={() => runAfterKeyboardDismiss(cancelNote)} style={({ pressed }) => [styles.noteBtn, pressed && styles.pressed]}>
                  <Text style={styles.noteBtnCancel}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={() => runAfterKeyboardDismiss(saveNote)} style={({ pressed }) => [styles.noteBtn, styles.noteBtnSave, pressed && styles.pressed]}>
                  <Text style={styles.noteBtnSaveText}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          ) : category.notes ? (
            <Pressable onPress={openNoteEditor} style={({ pressed }) => [styles.notesRow, pressed && styles.pressed]}>
              <Ionicons name="chatbubble-outline" size={14} color={APP_COLORS.textMuted} />
              <Text style={styles.notesText}>{category.notes}</Text>
            </Pressable>
          ) : null}

          {/* Transaction list */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={32} color={APP_COLORS.textMuted} />
                <Text style={styles.emptyTitle}>Sin movimientos</Text>
                <Text style={styles.emptyText}>
                  Asigna un gasto a esta categoría al crear un movimiento para comenzar a rastrear tu presupuesto.
                </Text>
              </View>
            ) : (
              transactions.map((t) => (
                <TransactionTile
                  key={t.id}
                  transaction={t}
                  ym={selectedYM}
                  onPress={() => setSelectedTx(t)}
                />
              ))
            )}
          </ScrollView>

          {/* Actions footer */}
          <View style={styles.actions}>
            <Pressable
              onPress={openNoteEditor}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Ionicons
                name={category.notes ? 'chatbubble' : 'chatbubble-outline'}
                size={20}
                color={category.notes ? APP_COLORS.blue : APP_COLORS.textSecondary}
              />
            </Pressable>
            <Pressable
              onPress={() => setEditCategoryOpen(true)}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Ionicons name="pencil-outline" size={20} color={APP_COLORS.textSecondary} />
            </Pressable>
            <Pressable
              onPress={confirmDeleteCategory}
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnDelete, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={20} color={APP_COLORS.expense} />
            </Pressable>
          </View>
          </View>
        </Pressable>
      </Pressable>

      <TransactionModal
        visible={!!editTx}
        transaction={editTx}
        onClose={() => setEditTx(null)}
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
        category={category}
        onClose={() => setEditCategoryOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  actionBtnDelete: {
    backgroundColor: '#FFE4E6',
  },
  availableLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  budgetLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  card: {
    backgroundColor: APP_COLORS.background,
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
  categoryName: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    maxWidth: 260,
    textAlign: 'center',
  },
  emptyTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: {
    flex: 1,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  list: {
    flexShrink: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  noteBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noteBtnCancel: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  noteBtnSave: {
    backgroundColor: APP_COLORS.blue,
  },
  noteBtnSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  noteEditorActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  noteEditorWrap: {
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noteInput: {
    color: APP_COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 20,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  notesRow: {
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notesText: {
    color: APP_COLORS.textSecondary,
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  over: {
    color: '#DC2626',
  },
  pressed: {
    opacity: 0.72,
  },
  progressBarFill: {
    borderRadius: 6,
    height: '100%',
  },
  progressBarTrack: {
    backgroundColor: '#EEF0F3',
    borderRadius: 6,
    height: 10,
    overflow: 'hidden',
    width: '100%',
  },
  progressNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressSection: {
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  spentAmount: {
    fontWeight: '800',
  },
  spentLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '400',
  },
  incomeSection: {
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  incomeSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 7,
  },
  incomeSectionTitle: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  incomeEstimateText: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  incomeBarTrack: {
    backgroundColor: '#EEF0F3',
    borderRadius: 6,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
  incomeBarFill: {
    backgroundColor: APP_COLORS.income,
    borderRadius: 6,
    height: '100%',
  },
  incomeNumbersRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 6,
  },
  incomeCurrentAmount: {
    color: APP_COLORS.income,
    fontWeight: '800',
  },
  incomeCurrentText: {
    color: APP_COLORS.textMuted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '400',
  },
  incomeReachedText: {
    color: APP_COLORS.income,
  },
  incomeRemainingText: {
    color: '#EA580C',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
});
