import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import type { BudgetCategory, CurrencyCode } from '../types';
import { fmt } from '../utils/format';

const BUDGET_TRACK_COLOR = '#EEF0F3';
const AVAILABLE_TEXT_COLOR = '#94A3B8';

interface BudgetCategoryCardProps {
  category: BudgetCategory;
  spent: number;
  currency: CurrencyCode;
  onPress: () => void;
  onLongPress?: () => void;
}

export function BudgetCategoryCard({
  category,
  spent,
  currency,
  onPress,
  onLongPress,
}: BudgetCategoryCardProps) {
  const iconColorSet = getIconColor(category.iconColor);
  const hasBudget = category.monthlyBudget > 0;
  const pct = hasBudget ? Math.min(1, spent / category.monthlyBudget) : 0;
  const available = category.monthlyBudget - spent;
  const isOver = hasBudget && available < 0;

  const barColor = isOver ? '#DC2626' : pct >= 0.75 ? '#EA580C' : iconColorSet.color;
  const iconInfo = CATEGORIES[category.icon] ?? CATEGORIES.other;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconColorSet.bg }]}>
        <Ionicons name={iconInfo.icon} size={20} color={iconColorSet.color} />
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{category.name}</Text>
          <Text style={styles.budgetText} numberOfLines={1}>
            {hasBudget ? fmt(category.monthlyBudget, currency) : 'Sin presupuesto'}
          </Text>
          {isOver && (
            <View style={styles.overBadge}>
              <Text style={styles.overBadgeText}>Excedido</Text>
            </View>
          )}
        </View>

      {/* Row 2: gasto · bar · disponible */}
        {hasBudget ? (
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: barColor },
            ]}
          />
        </View>
        ) : (
          <Text style={styles.budgetPrompt} numberOfLines={1}>
            Agrega un presupuesto a esta categoria.
          </Text>
        )}

        {hasBudget ? (
        <View style={styles.amountRow}>
          <Text style={[styles.spentText, { color: iconColorSet.color }]} numberOfLines={1}>
            {fmt(spent, currency)}
          </Text>
          <Text style={styles.available} numberOfLines={1}>
            {isOver ? `Excedido +${fmt(Math.abs(available), currency)}` : fmt(available, currency)}
          </Text>
        </View>
        ) : null}

      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  available: {
    color: AVAILABLE_TEXT_COLOR,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  amountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 5,
  },
  barTrack: {
    backgroundColor: BUDGET_TRACK_COLOR,
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    overflow: 'hidden',
    width: '100%',
  },
  barFill: {
    borderRadius: 3,
    height: '100%',
  },
  budgetText: {
    color: APP_COLORS.textSecondary,
    flexShrink: 0,
    fontSize: 10,
    fontWeight: '500',
  },
  budgetPrompt: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 7,
  },
  card: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderRadius: 16,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 16,
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: APP_COLORS.textPrimary,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  overBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  overBadgeText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
  spentText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
  },
});
