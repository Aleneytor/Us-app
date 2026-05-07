import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TransactionTile } from '../components/TransactionTile';
import { APP_COLORS, getIconColor } from '../constants/colors';
import { CATEGORIES } from '../constants/categories';
import { useAppStore } from '../store/useAppStore';
import type { BudgetCategory, CurrencyCode, Transaction } from '../types';
import { calcBudgetCategorySpending } from '../utils/calculations';
import { getPaid, setPaid } from '../utils/filters';
import { fmt, todayStr } from '../utils/format';
import { TransactionModal } from './TransactionModal';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { BudgetCategoryModal } from './BudgetCategoryModal';

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
  const available = category ? category.monthlyBudget - spent : 0;
  const isOver = available < 0;
  const pct = category && category.monthlyBudget > 0 ? Math.min(1, spent / category.monthlyBudget) : 0;

  const transactions = useMemo(() => {
    if (!category) return [];
    return payload.expenses
      .filter((t) => !t.del && String(t.budgetCatId) === String(category.id))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }, [category, payload.expenses]);

  const toggleTx = (t: Transaction) => {
    const next = {
      ...t,
      paid: t.paid ? { ...t.paid } : {},
      paidAt: t.paidAt ? { ...t.paidAt } : {},
    };
    setPaid(next, selectedYM, !getPaid(t, selectedYM), todayStr());
    updateTx(next);
    setSelectedTx((prev) => (prev?.id === next.id ? next : prev));
  };

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
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <Pressable style={styles.screen} onPressIn={onClose}>
        <Pressable style={styles.card} onPressIn={(event) => event.stopPropagation()}>

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
                <Pressable onPress={cancelNote} style={({ pressed }) => [styles.noteBtn, pressed && styles.pressed]}>
                  <Text style={styles.noteBtnCancel}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={saveNote} style={({ pressed }) => [styles.noteBtn, styles.noteBtnSave, pressed && styles.pressed]}>
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
                  onConfirm={() => toggleTx(t)}
                  onEdit={() => { setSelectedTx(null); setEditTx(t); }}
                  contentHorizontalPadding={16}
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
        onTogglePaid={toggleTx}
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
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  actionBtnDelete: {
    backgroundColor: '#FFF1F2',
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
    elevation: 8,
    maxHeight: '88%',
    maxWidth: 520,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    width: '100%',
  },
  categoryName: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
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
    padding: 18,
  },
  spentAmount: {
    fontWeight: '800',
  },
  spentLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '400',
  },
});
