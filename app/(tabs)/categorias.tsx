import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BudgetCategoryCard } from '../../components/BudgetCategoryCard';
import { GuidelineCard } from '../../components/GuidelineCard';
import type { GuidelineCardItem } from '../../components/GuidelineCard';
import { SpendingGaugeCard } from '../../components/SpendingGaugeCard';
import type { GaugeSlice } from '../../components/SpendingGaugeCard';
import { UserHeaderButton } from '../../components/UserHeaderButton';
import { APP_COLORS, getIconColor } from '../../constants/colors';
import { BudgetCategoryDetailModal } from '../../modals/BudgetCategoryDetailModal';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import type { BudgetCategory } from '../../types';
import { calcBudgetCategoryIncome, calcBudgetCategorySpending } from '../../utils/calculations';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useTabPadding } from '../../hooks/useTabPadding';

const CHART_MODE_META = {
  gastos:   { prefix: 'Este es el total de ', accent: 'gastos',   suffix: ' de tus categorias', color: '#EC1147' },
  ingresos: { prefix: 'Este es el total de ', accent: 'ingresos', suffix: ' de tus categorias', color: '#25C55B' },
} as const;

export default function CategoriasScreen() {
  const tabPadding = useTabPadding();
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const currency = useAppStore((s) => s.currency);

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);
  const [chartMode, setChartMode] = useState<'gastos' | 'ingresos'>('gastos');

  const { heroAnim, contentAnim, headerAnim, itemAnims } = useEntranceAnimation();

  const user = users[currentUser] ?? { name: currentUser };

  const budgetCategories = useMemo(() => {
    const all = payload.budgetCategories ?? [];
    return all.filter((bc) => bc.uid === undefined || bc.uid === currentUser);
  }, [payload.budgetCategories, currentUser]);

  const allBudgetCategories = useMemo(() => {
    return payload.budgetCategories ?? [];
  }, [payload.budgetCategories]);

  const sortedBudgetCategories = useMemo(() => {
    return [...budgetCategories].sort((a, b) => {
      const spentA = calcBudgetCategorySpending(payload, a.id, selectedYM);
      const spentB = calcBudgetCategorySpending(payload, b.id, selectedYM);
      return spentB - spentA || a.name.localeCompare(b.name);
    });
  }, [budgetCategories, payload, selectedYM]);

  const sortedChartCategories = useMemo(() => {
    return [...allBudgetCategories].sort((a, b) => {
      const spentA = calcBudgetCategorySpending(payload, a.id, selectedYM);
      const spentB = calcBudgetCategorySpending(payload, b.id, selectedYM);
      return spentB - spentA || a.name.localeCompare(b.name);
    });
  }, [allBudgetCategories, payload, selectedYM]);

  const gaugeSlices = useMemo((): GaugeSlice[] => {
    return sortedChartCategories.map((cat) => ({
      id: cat.id,
      label: cat.name,
      color: getIconColor(cat.iconColor).color,
      value: calcBudgetCategorySpending(payload, cat.id, selectedYM),
    }));
  }, [sortedChartCategories, payload, selectedYM]);

  const incomeGaugeSlices = useMemo((): GaugeSlice[] => {
    return [...allBudgetCategories]
      .sort((a, b) => {
        const incomeA = calcBudgetCategoryIncome(payload, a.id, selectedYM);
        const incomeB = calcBudgetCategoryIncome(payload, b.id, selectedYM);
        return incomeB - incomeA || a.name.localeCompare(b.name);
      })
      .map((cat) => ({
        id: cat.id,
        label: cat.name,
        color: getIconColor(cat.iconColor).color,
        value: calcBudgetCategoryIncome(payload, cat.id, selectedYM),
      }));
  }, [allBudgetCategories, payload, selectedYM]);

  const totalSpent = useMemo(
    () => gaugeSlices.reduce((sum, s) => sum + s.value, 0),
    [gaugeSlices],
  );

  const totalIncome = useMemo(
    () => incomeGaugeSlices.reduce((sum, s) => sum + s.value, 0),
    [incomeGaugeSlices],
  );

  const categoryItems = useMemo<GuidelineCardItem<'gastos' | 'ingresos'>[]>(
    () => [
      { key: 'gastos',   value: totalSpent,  accent: '#EC1147' },
      { key: 'ingresos', value: totalIncome, accent: '#25C55B' },
    ],
    [totalSpent, totalIncome],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        scrollEnabled={scrollEnabled}
      >
        <Animated.View
          style={[
            styles.heroHeader,
            {
              opacity: heroAnim,
              transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroGreeting}>¡Hola {user.name}!</Text>
              <Text style={styles.heroSubtitle}>
                {CHART_MODE_META[chartMode].prefix}
                <Text style={{ color: CHART_MODE_META[chartMode].color }}>
                  {CHART_MODE_META[chartMode].accent}
                </Text>
                {CHART_MODE_META[chartMode].suffix}
              </Text>
            </View>
            <UserHeaderButton />
          </View>

          {allBudgetCategories.length > 0 && (
            <View style={styles.balanceSummary}>
              <GuidelineCard
                items={categoryItems}
                currency={currency}
                onStateChange={(state) => setChartMode(state)}
                onSwipeBegin={() => setScrollEnabled(false)}
                onSwipeEnd={() => setScrollEnabled(true)}
                topSlot={
                  <SpendingGaugeCard
                    slices={chartMode === 'gastos' ? gaugeSlices : incomeGaugeSlices}
                    currency={currency}
                  />
                }
              />
            </View>
          )}
        </Animated.View>

        <Animated.View
          style={[
            styles.sectionHeader,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Todas las categorias</Text>
          <Pressable
            accessibilityLabel="Crear categoria"
            onPress={() => setCreateOpen(true)}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </Pressable>
        </Animated.View>

        {budgetCategories.length === 0 ? (
          <Animated.View style={[styles.emptyState, { opacity: headerAnim }]}>
            <Ionicons name="pie-chart-outline" size={34} color={APP_COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Sin categorias</Text>
            <Text style={styles.emptyText}>
              Crea una categoria para rastrear tu presupuesto mensual por tipo de gasto.
            </Text>
            <Pressable
              onPress={() => setCreateOpen(true)}
              style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Crear categoria</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={styles.list}>
            {sortedBudgetCategories.map((category, index) => (
              <Animated.View
                key={category.id}
                style={{
                  opacity: itemAnims[index],
                  transform: [{ translateY: itemAnims[index].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                }}
              >
                <BudgetCategoryCard
                  category={category}
                  spent={calcBudgetCategorySpending(payload, category.id, selectedYM)}
                  currency={currency}
                  onPress={() => setSelectedCategory(category)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <BudgetCategoryModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <BudgetCategoryDetailModal
        category={selectedCategory}
        currency={currency}
        selectedYM={selectedYM}
        onClose={() => setSelectedCategory(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    backgroundColor: '#303236',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  content: {},
  emptyButton: {
    alignItems: 'center',
    backgroundColor: '#303236',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginHorizontal: 24,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  emptyTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  heroGreeting: {
    color: '#303236',
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    lineHeight: 32,
  },
  heroHeader: {
    backgroundColor: APP_COLORS.surface,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 5,
    paddingTop: 56,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  heroInnerHighlight: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroSubtitle: {
    color: '#303236',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    paddingHorizontal: 30,
  },
  balanceSummary: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  list: {
    gap: 8,
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.72,
  },
  screen: {
    backgroundColor: '#EDF2F6',
    flex: 1,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 24,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '600',
  },
});
