import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MonthNavigator } from '../../components/MonthNavigator';
import { TransactionTile } from '../../components/TransactionTile';
import { TransactionModal } from '../../modals/TransactionModal';
import { CATEGORIES } from '../../constants/categories';
import { APP_COLORS } from '../../constants/colors';
import { PARTNER } from '../../types';
import type { Transaction } from '../../types';
import { getPaid, isMonthVisible, setPaid } from '../../utils/filters';
import { formatDateShort, fmt, todayStr } from '../../utils/format';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';

type KindFilter = 'all' | 'expense' | 'income';
type OwnerFilter = 'mine' | 'partner' | 'both';
type PaidFilter = 'all' | 'pending' | 'paid';

export default function MovimientosScreen() {
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const setSelectedYM = useAppStore((s) => s.setSelectedYM);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);

  const [showFilters, setShowFilters] = useState(true);
  const [showSummary, setShowSummary] = useState(true);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('both');
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const partner = PARTNER[currentUser];

    return payload.expenses
      .filter((t) => {
        const ownerMatches =
          ownerFilter === 'both' ||
          t.uid === (ownerFilter === 'mine' ? currentUser : partner);
        const paidMatches =
          paidFilter === 'all' ||
          (paidFilter === 'paid' ? getPaid(t, selectedYM) : !getPaid(t, selectedYM));
        const searchable = `${t.desc} ${t.account} ${t.notes} ${t.tags.join(' ')}`.toLowerCase();

        return (
          !t.del &&
          isMonthVisible(t, selectedYM) &&
          ownerMatches &&
          (kindFilter === 'all' || t.kind === kindFilter) &&
          paidMatches &&
          (query === '' || searchable.includes(query))
        );
      })
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        return byDate !== 0 ? byDate : Number(b.id) - Number(a.id);
      });
  }, [currentUser, kindFilter, ownerFilter, paidFilter, payload.expenses, searchText, selectedYM]);

  const totals = useMemo(() => {
    const expenses = filtered
      .filter((t) => t.kind === 'expense')
      .reduce((sum, t) => sum + t.amt, 0);
    const income = filtered
      .filter((t) => t.kind === 'income')
      .reduce((sum, t) => sum + t.amt, 0);
    return { expenses, income, balance: income - expenses };
  }, [filtered]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  const openEdit = (transaction: Transaction) => {
    setEditTransaction(transaction);
    setSelectedTransaction(null);
  };

  const confirmDelete = (transaction: Transaction) => {
    Alert.alert(
      'Eliminar movimiento',
      transaction.desc || 'Este movimiento se ocultara para todos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteTransaction(transaction.id);
            setSelectedTransaction(null);
          },
        },
      ],
    );
  };

  const showActions = (transaction: Transaction) => {
    Alert.alert(
      transaction.desc || 'Movimiento',
      'Elige una accion',
      [
        { text: 'Editar', onPress: () => openEdit(transaction) },
        { text: 'Eliminar', style: 'destructive', onPress: () => confirmDelete(transaction) },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  const togglePaid = (transaction: Transaction) => {
    const next = {
      ...transaction,
      paid: transaction.paid ? { ...transaction.paid } : {},
      paidAt: transaction.paidAt ? { ...transaction.paidAt } : {},
    };
    setPaid(next, selectedYM, !getPaid(transaction, selectedYM), todayStr());
    updateTransaction(next);
    setSelectedTransaction(next);
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <MonthNavigator ym={selectedYM} onChange={setSelectedYM} />

            <View style={styles.toolbar}>
              <Pressable
                onPress={() => setShowFilters((value) => !value)}
                style={({ pressed }) => [styles.toolbarButton, pressed && styles.pressed]}
              >
                <Ionicons name="filter-outline" size={18} color={APP_COLORS.textPrimary} />
                <Text style={styles.toolbarText}>Filtros</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowSummary((value) => !value)}
                style={({ pressed }) => [styles.toolbarButton, pressed && styles.pressed]}
              >
                <Ionicons name="calculator-outline" size={18} color={APP_COLORS.textPrimary} />
                <Text style={styles.toolbarText}>Suma</Text>
              </Pressable>
            </View>

            {showFilters ? (
              <View style={styles.panel}>
                <FilterRow
                  label="Tipo"
                  options={[
                    { label: 'Todos', value: 'all' },
                    { label: 'Gastos', value: 'expense' },
                    { label: 'Ingresos', value: 'income' },
                  ]}
                  value={kindFilter}
                  onChange={setKindFilter}
                />
                <FilterRow
                  label="Quien"
                  options={[
                    { label: 'Ambos', value: 'both' },
                    { label: 'Yo', value: 'mine' },
                    { label: 'Pareja', value: 'partner' },
                  ]}
                  value={ownerFilter}
                  onChange={setOwnerFilter}
                />
                <FilterRow
                  label="Estado"
                  options={[
                    { label: 'Todos', value: 'all' },
                    { label: 'Pendiente', value: 'pending' },
                    { label: 'Confirmado', value: 'paid' },
                  ]}
                  value={paidFilter}
                  onChange={setPaidFilter}
                />
                <View style={styles.searchWrap}>
                  <Ionicons name="search-outline" size={18} color={APP_COLORS.textMuted} />
                  <TextInput
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Buscar descripcion, cuenta o tag"
                    placeholderTextColor={APP_COLORS.textMuted}
                    style={styles.searchInput}
                  />
                </View>
              </View>
            ) : null}

            {showSummary ? (
              <View style={styles.summary}>
                <SummaryCell label="Gastos" value={fmt(totals.expenses)} tone="expense" />
                <SummaryCell label="Ingresos" value={fmt(totals.income)} tone="income" />
                <SummaryCell label="Balance" value={fmt(totals.balance)} tone={totals.balance >= 0 ? 'income' : 'expense'} />
              </View>
            ) : null}

            <View style={styles.resultLine}>
              <Text style={styles.resultTitle}>Movimientos</Text>
              <Text style={styles.resultCount}>{filtered.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={34} color={APP_COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Sin movimientos</Text>
            <Text style={styles.emptyText}>Ajusta los filtros o cambia de mes.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TransactionTile
            transaction={item}
            ym={selectedYM}
            onPress={() => setSelectedTransaction(item)}
            onLongPress={() => showActions(item)}
          />
        )}
      />

      <Pressable
        accessibilityLabel="Nuevo movimiento"
        onPress={() => setCreateOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <TransactionDetailModal
        transaction={selectedTransaction}
        ym={selectedYM}
        onClose={() => setSelectedTransaction(null)}
        onEdit={openEdit}
        onDelete={confirmDelete}
        onTogglePaid={togglePaid}
      />

      <TransactionModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <TransactionModal
        visible={!!editTransaction}
        transaction={editTransaction}
        onClose={() => setEditTransaction(null)}
      />
    </View>
  );
}

interface Option<T extends string> {
  label: string;
  value: T;
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<Option<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.segment}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.segmentButton,
                active && styles.segmentButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'income' | 'expense';
}) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === 'income' ? styles.income : styles.expense]}>
        {value}
      </Text>
    </View>
  );
}

function TransactionDetailModal({
  transaction,
  ym,
  onClose,
  onEdit,
  onDelete,
  onTogglePaid,
}: {
  transaction: Transaction | null;
  ym: string;
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onTogglePaid: (transaction: Transaction) => void;
}) {
  if (!transaction) return null;
  const category = CATEGORIES[transaction.cat] ?? CATEGORIES.other;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{transaction.desc || category.label}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={APP_COLORS.textPrimary} />
            </Pressable>
          </View>
          <DetailRow label="Monto" value={`${transaction.kind === 'income' ? '+' : '-'}${fmt(transaction.amt)}`} />
          <DetailRow label="Categoria" value={category.label} />
          <DetailRow label="Cuenta" value={transaction.account || 'Sin cuenta'} />
          <DetailRow label="Fecha" value={formatDateShort(transaction.date)} />
          <DetailRow label="Tipo" value={transaction.type === 'monthly' ? 'Mensual' : 'Unico'} />
          <DetailRow label="Estado" value={getPaid(transaction, ym) ? 'Confirmado' : 'Pendiente'} />
          {transaction.notes ? <DetailRow label="Notas" value={transaction.notes} /> : null}
          <View style={styles.modalActions}>
            <Pressable
              onPress={() => onTogglePaid(transaction)}
              style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
            >
              <Ionicons name={getPaid(transaction, ym) ? 'ellipse-outline' : 'checkmark-circle-outline'} size={17} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>
                {getPaid(transaction, ym) ? 'Pendiente' : 'Confirmar'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onEdit(transaction)}
              style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
            >
              <Ionicons name="pencil-outline" size={17} color={APP_COLORS.textPrimary} />
              <Text style={styles.secondaryActionText}>Editar</Text>
            </Pressable>
            <Pressable
              onPress={() => onDelete(transaction)}
              style={({ pressed }) => [styles.dangerAction, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={18} color={APP_COLORS.expense} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  detailLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  detailRow: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    gap: 4,
    paddingVertical: 12,
  },
  detailValue: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
  },
  emptyTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  dangerAction: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  expense: {
    color: APP_COLORS.expense,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.blue,
    borderRadius: 28,
    bottom: 24,
    elevation: 4,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    width: 56,
  },
  fabPressed: {
    transform: [{ scale: 0.97 }],
  },
  filterLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    width: 62,
  },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  header: {
    gap: 12,
  },
  income: {
    color: APP_COLORS.income,
  },
  listContent: {
    padding: 16,
    paddingBottom: 96,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 18,
    gap: 2,
    maxWidth: 520,
    padding: 18,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 19,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  panel: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  pressed: {
    opacity: 0.72,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.blue,
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  resultCount: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  resultLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  resultTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  screen: {
    backgroundColor: APP_COLORS.background,
    flex: 1,
  },
  searchInput: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  secondaryAction: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  secondaryActionText: {
    color: APP_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  searchWrap: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
  },
  segment: {
    backgroundColor: '#F1F5F9',
    borderRadius: 11,
    flex: 1,
    flexDirection: 'row',
    padding: 3,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: APP_COLORS.surface,
  },
  segmentText: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: APP_COLORS.textPrimary,
  },
  separator: {
    height: 10,
  },
  summary: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCell: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  summaryLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarButton: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 42,
    paddingHorizontal: 12,
  },
  toolbarText: {
    color: APP_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
});
