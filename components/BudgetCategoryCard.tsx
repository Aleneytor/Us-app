import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import type { BudgetCategory, CurrencyCode } from '../types';
import { fmt } from '../utils/format';

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
  const pct = category.monthlyBudget > 0 ? Math.min(1, spent / category.monthlyBudget) : 0;
  const available = category.monthlyBudget - spent;
  const isOver = available < 0;

  const barColor = iconColorSet.color;
  const iconInfo = CATEGORIES[category.icon] ?? CATEGORIES.other;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Row 1: icon + name */}
      <View style={styles.nameRow}>
        <View style={[styles.iconCircle, { backgroundColor: iconColorSet.bg }]}>
          <Ionicons name={iconInfo.icon} size={20} color={iconColorSet.color} />
        </View>
        <Text style={styles.name} numberOfLines={1}>{category.name}</Text>
      </View>

      {/* Row 2: spent · bar · available */}
      <View style={styles.barRow}>
        <Text style={styles.spentText} numberOfLines={1}>{fmt(spent, currency)}</Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: barColor },
            ]}
          />
        </View>
        <Text style={[styles.available, { color: isOver ? '#DC2626' : iconColorSet.color }]} numberOfLines={1}>
          {isOver ? `+${fmt(Math.abs(available), currency)}` : `${fmt(available, currency)}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  available: {
    fontSize: 11,
    fontWeight: '700',
    minWidth: 52,
    textAlign: 'right',
  },
  barFill: {
    borderRadius: 3,
    height: '100%',
  },
  barRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  barTrack: {
    backgroundColor: '#EEF0F3',
    borderRadius: 3,
    flex: 1,
    height: 6,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 16,
    elevation: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  name: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  over: {
    color: '#DC2626',
  },
  pressed: {
    opacity: 0.72,
  },
  spentText: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 52,
  },
});
