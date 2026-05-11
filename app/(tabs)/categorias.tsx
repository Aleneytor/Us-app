import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { BudgetCategoryCard } from '../../components/BudgetCategoryCard';
import { DonutChart } from '../../components/DonutChart';
import { UserHeaderButton } from '../../components/UserHeaderButton';
import { APP_COLORS, getIconColor } from '../../constants/colors';
import { BudgetCategoryDetailModal } from '../../modals/BudgetCategoryDetailModal';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import type { BudgetCategory } from '../../types';
import {
  calcBudgetCategoryIncome,
  calcBudgetCategorySpending,
} from '../../utils/calculations';
import { fmt } from '../../utils/format';

export default function CategoriasScreen() {
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const currency = useAppStore((s) => s.currency);

  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);

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

  const chartSlices = useMemo(() => {
    return sortedChartCategories.map((cat) => ({
      id: cat.id,
      label: cat.name,
      value: calcBudgetCategorySpending(payload, cat.id, selectedYM),
      budget: cat.monthlyBudget,
      color: getIconColor(cat.iconColor).color,
    }));
  }, [payload, selectedYM, sortedChartCategories]);
  const totalCategorySpent = useMemo(
    () => chartSlices.reduce((sum, slice) => sum + slice.value, 0),
    [chartSlices],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.heroHeader}>
          <View style={styles.heroTop}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroGreeting}>¡Hola {user.name}!</Text>
              <Text style={styles.heroSubtitle}>
                Estas son tus categorias y presupuesto general.
              </Text>
            </View>
            <UserHeaderButton />
          </View>

          {allBudgetCategories.length > 0 && (
            <View style={styles.balanceSummary}>
              <Text style={styles.balanceSummaryTitle}>
                Gastos en <Text style={styles.balanceSummaryAccent}>categorias</Text>
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.58}
                style={styles.balanceSummaryAmount}
              >
                {fmt(totalCategorySpent, currency)}
              </Text>
            </View>
          )}
        </View>

        {allBudgetCategories.length > 0 && (
          <View style={styles.chartSection}>
            <DonutChart
              slices={chartSlices}
              currency={currency}
              onSlicePress={(slice) => {
                const category = allBudgetCategories.find((cat) => cat.id === slice.id);
                if (category) setSelectedCategory(category);
              }}
            />
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Todas las categorias</Text>
          <Pressable
            accessibilityLabel="Crear categoria"
            onPress={() => setCreateOpen(true)}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {budgetCategories.length === 0 ? (
          <View style={styles.emptyState}>
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
          </View>
        ) : (
          <View style={styles.list}>
            {sortedBudgetCategories.map((category) => (
              <BudgetCategoryCard
                key={category.id}
                category={category}
                spent={calcBudgetCategorySpending(payload, category.id, selectedYM)}
                incomeReal={calcBudgetCategoryIncome(payload, category.id, selectedYM)}
                currency={currency}
                onPress={() => setSelectedCategory(category)}
              />
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
  content: {
    paddingBottom: 96,
  },
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
    paddingBottom: 28,
    paddingTop: 56,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  chartSection: {
    paddingTop: 14,
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  balanceSummaryAccent: {
    color: '#7C3AED',
  },
  balanceSummaryAmount: {
    color: '#2F3033',
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 46,
    lineHeight: 52,
    minWidth: 0,
    textAlign: 'center',
  },
  balanceSummaryTitle: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
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
