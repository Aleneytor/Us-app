import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { APP_COLORS } from '../../constants/colors';
import { BalanceCard } from '../../components/BalanceCard';
import type { CardState } from '../../components/BalanceCard';
import { BudgetCategoryCard } from '../../components/BudgetCategoryCard';
import { FinanceDetailModal } from '../../components/FinanceDetailModal';
import { FinanceTrendCard } from '../../components/FinanceTrendCard';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import { TransactionTile } from '../../components/TransactionTile';
import { UserHeaderButton } from '../../components/UserHeaderButton';
import { BudgetCategoryDetailModal } from '../../modals/BudgetCategoryDetailModal';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { TransactionModal } from '../../modals/TransactionModal';
import { useAppStore } from '../../store/useAppStore';
import type { BudgetCategory, Transaction } from '../../types';
import {
  calcBudgetCategorySpending,
  calcBudgetCategoryIncome,
  calcGastosActual,
  calcGastosProyectados,
  calcSaldoActual,
  calcSaldoProyectado,
} from '../../utils/calculations';
import { isMonthVisible } from '../../utils/filters';
import { getUserData } from '../../utils/users';

const CARD_SUBTITLES: Record<CardState, { prefix: string; accent: string; color: string }> = {
  saldo: { prefix: 'Este es tu ', accent: 'saldo actual', color: '#23C55E' },
  gastos: { prefix: 'Este es tu ', accent: 'gasto actual', color: '#EC1147' },
};



export default function DashboardScreen() {
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const currency = useAppStore((s) => s.currency);
  const deleteTx = useAppStore((s) => s.deleteTransaction);
  const users = useAppStore((s) => s.users);

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [cardState, setCardState] = useState<CardState>('saldo');
  const [createKind, setCreateKind] = useState<'income' | 'expense' | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [detailModal, setDetailModal] = useState<{ visible: boolean; kind: 'income' | 'expense' }>({
    visible: false,
    kind: 'income',
  });
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);
  const [catPage, setCatPage] = useState(0);
  const catScrollRef = useRef<ScrollView>(null);

  const user = getUserData(users, currentUser);

  const saldoActual = calcSaldoActual(payload, currentUser);
  const saldoProyectado = calcSaldoProyectado(payload, currentUser, selectedYM);
  const gastosActual = calcGastosActual(payload, currentUser, selectedYM);
  const gastosProyectados = calcGastosProyectados(payload, currentUser, selectedYM);

  const budgetCategories = useMemo(() => {
    const all = payload.budgetCategories ?? [];
    return all.filter((bc) => bc.uid === undefined || bc.uid === currentUser);
  }, [payload.budgetCategories, currentUser]);

  const CATS_PER_PAGE = 2;
  const catPageCount = Math.ceil(budgetCategories.length / CATS_PER_PAGE);
  const CAT_PAGER_WIDTH = Dimensions.get('window').width;
  // Pre-initialize all dot animated values (supports up to 10 pages) — same as BalanceCard
  const catDotWidths = useRef(
    Array.from({ length: 10 }, (_, i) => new Animated.Value(i === 0 ? 28 : 14)),
  ).current;
  const catPageRef = useRef(0);

  const recent = payload.expenses
    .filter((t) => t.uid === currentUser && !t.del && isMonthVisible(t, selectedYM))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, 8);


  const confirmDelete = (t: Transaction) => {
    Alert.alert(
      'Eliminar movimiento',
      t.desc || 'Este movimiento se ocultará para todos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => { deleteTx(t.id); setSelectedTransaction(null); } },
      ],
    );
  };

  const subtitle = CARD_SUBTITLES[cardState];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      scrollEnabled={scrollEnabled}
    >
      {/* ── Header + Balance Card ── */}
      <View style={styles.headerSection}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>¡Hola {user.name}!</Text>
            <Text style={styles.subtitle}>
              {subtitle.prefix}
              <Text style={[styles.subtitleAccent, { color: subtitle.color }]}>
                {subtitle.accent}
              </Text>
            </Text>
          </View>
          <UserHeaderButton />
        </View>

        <BalanceCard
          saldoActual={saldoActual}
          saldoProyectado={saldoProyectado}
          gastosActual={gastosActual}
          gastosProyectados={gastosProyectados}
          currency={currency}
          selectedYM={selectedYM}
          onStateChange={setCardState}
          onSwipeBegin={() => {
            setScrollEnabled(false);
          }}
          onSwipeEnd={() => setScrollEnabled(true)}
        />
      </View>

      {/* ── Botones Ingresos / Gastos ── */}
      <View style={styles.quickActions}>
        <FinanceToggleButton
          label="Ingresos"
          icon="arrow-up"
          active={detailModal.visible && detailModal.kind === 'income'}
          accent="#16A34A"
          onPress={() => setDetailModal({ visible: true, kind: 'income' })}
        />
        <FinanceToggleButton
          label="Gastos"
          icon="arrow-down"
          active={detailModal.visible && detailModal.kind === 'expense'}
          accent="#EC1147"
          onPress={() => setDetailModal({ visible: true, kind: 'expense' })}
        />
      </View>

      <FinanceTrendCard
        payload={payload}
        uid={currentUser}
        selectedYM={selectedYM}
        currency={currency}
        categories={budgetCategories}
        onOpenDetail={(kind) => setDetailModal({ visible: true, kind })}
      />

      {/* Categorias de presupuesto */}
      <View style={[styles.section, styles.catSection]}>
        <View style={[styles.sectionHead, styles.catSectionHead]}>
          <Text style={styles.sectionTitle}>Categorías</Text>
        </View>

        {budgetCategories.length === 0 ? (
          <View style={styles.categoriesEmpty}>
            <Ionicons name="pie-chart-outline" size={28} color={APP_COLORS.textMuted} />
            <Text style={styles.categoriesEmptyTitle}>Sin categorías</Text>
            <Text style={styles.categoriesEmptyText}>
              Crea una categoría para rastrear tu presupuesto mensual por tipo de gasto.
            </Text>
            <Pressable
              onPress={() => setNewCategoryOpen(true)}
              style={({ pressed }) => [styles.categoriesEmptyBtn, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.categoriesEmptyBtnText}>Crear categoría</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.categoriesPager}>
            <ScrollView
              ref={catScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={CAT_PAGER_WIDTH}
              snapToAlignment="start"
              style={{ width: CAT_PAGER_WIDTH }}
              onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const x = e.nativeEvent.contentOffset.x;
                const vx = (e.nativeEvent as any).velocity?.x ?? 0;
                // Use velocity to predict snap target, same way pagingEnabled will
                let nextPage: number;
                if (vx < -0.3) nextPage = Math.min(catPageCount - 1, catPageRef.current + 1);
                else if (vx > 0.3) nextPage = Math.max(0, catPageRef.current - 1);
                else nextPage = Math.round(x / CAT_PAGER_WIDTH);
                if (nextPage !== catPageRef.current) {
                  catPageRef.current = nextPage;
                  setCatPage(nextPage);
                  for (let i = 0; i < catPageCount; i++) {
                    Animated.spring(catDotWidths[i], {
                      toValue: i === nextPage ? 28 : 14,
                      useNativeDriver: false,
                      damping: 14,
                      stiffness: 160,
                    }).start();
                  }
                }
              }}
            >
              {Array.from({ length: catPageCount }).map((_, pageIdx) => (
                <View key={pageIdx} style={[styles.catPage, { width: CAT_PAGER_WIDTH }]}>
                  {budgetCategories
                    .slice(pageIdx * CATS_PER_PAGE, pageIdx * CATS_PER_PAGE + CATS_PER_PAGE)
                    .map((bc) => (
                      <BudgetCategoryCard
                        key={bc.id}
                        category={bc}
                        spent={calcBudgetCategorySpending(payload, bc.id, selectedYM)}
                        incomeReal={calcBudgetCategoryIncome(payload, bc.id, selectedYM)}
                        currency={currency}
                        onPress={() => setSelectedCategory(bc)}
                      />
                    ))}
                </View>
              ))}
            </ScrollView>

            {/* Animated dots */}
            {catPageCount > 1 && (
              <View style={styles.catDots}>
                {Array.from({ length: catPageCount }).map((_, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.catDot,
                      i === catPage && styles.catDotActive,
                      { width: catDotWidths[i] },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Movimientos Recientes ── */}
      <View style={[styles.section, styles.recentSection]}>
        <View style={styles.recentSectionHeader}>
          <Text style={styles.sectionTitle}>Movimientos Recientes</Text>
        </View>

        {recent.length === 0 ? (
          <Text style={styles.emptyText}>Sin movimientos este mes</Text>
        ) : (
          <View style={styles.tileList}>
            {recent.map((t) => (
              <TransactionTile
                key={t.id}
                transaction={t}
                ym={selectedYM}
                onPress={() => setSelectedTransaction(t)}
                contentHorizontalPadding={24}
                amountCategoryFontSize={12}
                amountCategoryColor={APP_COLORS.textMuted}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── Modals ── */}
      <FinanceDetailModal
        visible={detailModal.visible}
        kind={detailModal.kind}
        currency={currency}
        uid={currentUser}
        selectedYM={selectedYM}
        payload={payload}
        onClose={() => setDetailModal((s) => ({ ...s, visible: false }))}
        onAdd={() => {
          const nextKind = detailModal.kind;
          setDetailModal((s) => ({ ...s, visible: false }));
          setCreateKind(nextKind);
        }}
      />

      <TransactionModal
        visible={createKind !== null}
        initialKind={createKind ?? 'expense'}
        onClose={() => setCreateKind(null)}
      />

      <TransactionModal
        visible={!!editTransaction}
        transaction={editTransaction}
        onClose={() => setEditTransaction(null)}
      />

      <TransactionDetailModal
        transaction={selectedTransaction}
        ym={selectedYM}
        onClose={() => setSelectedTransaction(null)}
        onEdit={(t) => { setSelectedTransaction(null); setEditTransaction(t); }}
        onDelete={confirmDelete}
      />

      <BudgetCategoryModal
        visible={newCategoryOpen}
        onClose={() => setNewCategoryOpen(false)}
      />

      <BudgetCategoryDetailModal
        category={selectedCategory}
        currency={currency}
        selectedYM={selectedYM}
        onClose={() => setSelectedCategory(null)}
      />

    </ScrollView>
  );
}

function FinanceToggleButton({
  label,
  icon,
  active,
  accent,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.financeToggle,
        active && { backgroundColor: accent },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={active ? '#FFFFFF' : accent} />
      <Text style={[styles.financeToggleText, active && styles.financeToggleTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#EDF2F6',
  },
  content: {
    paddingBottom: 48,
  },
  headerSection: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 4,
    paddingBottom: 20,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    zIndex: 1,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: '#303236',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#303236',
    lineHeight: 24,
  },
  subtitleAccent: {
    fontWeight: '400',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  catSection: {
    paddingHorizontal: 0,
  },
  catSectionHead: {
    paddingHorizontal: 24,
  },
  recentSection: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 16,
    paddingHorizontal: 0,
    paddingTop: 20,
  },
  recentSectionHeader: {
    paddingHorizontal: 24,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  categoriesEmpty: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  categoriesEmptyBtn: {
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  categoriesEmptyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  categoriesEmptyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  categoriesEmptyTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  categoriesList: {
    gap: 8,
  },
  categoriesPager: {
    alignItems: 'center',
    gap: 10,
  },
  catPage: {
    gap: 8,
    paddingHorizontal: 20,
  },
  catDots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  catDot: {
    backgroundColor: '#DADDE2',
    borderRadius: 999,
    height: 4,
    width: 14,
  },
  catDotActive: {
    backgroundColor: '#1F2937',
    width: 28,
  },
  swipeHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 5,
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    elevation: 5,
    marginHorizontal: 24,
    marginTop: 12,
    position: 'relative',
    zIndex: 2,
  },
  financeToggle: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    elevation: 5,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  financeToggleText: {
    color: '#0F172A',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  financeToggleTextActive: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.72,
  },
  tileList: {
    alignSelf: 'stretch',
    gap: 0,
    width: '100%',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
