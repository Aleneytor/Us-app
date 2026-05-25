import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CATEGORIES } from '../constants/categories';
import { getIconColor, type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import type { BudgetCategory, CurrencyCode } from '../types';
import { fmt } from '../utils/format';

interface BudgetCategoryCardProps {
  category: BudgetCategory;
  spent: number;
  currency: CurrencyCode;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: 'default' | 'tinted';
  percentOfTotal?: number;
}

export function BudgetCategoryCard({
  category,
  spent,
  currency,
  onPress,
  onLongPress,
  variant = 'default',
  percentOfTotal,
}: BudgetCategoryCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const iconColorSet = getIconColor(category.iconColor);
  const hasBudget = category.monthlyBudget > 0;
  const hasPctOfTotal = percentOfTotal !== undefined;
  const pct = hasPctOfTotal
    ? Math.min(1, percentOfTotal)
    : hasBudget ? Math.min(1, spent / category.monthlyBudget) : 0;
  const available = category.monthlyBudget - spent;
  const isOver = hasBudget && available < 0;
  const tinted = variant === 'tinted';

  const iconInfo = CATEGORIES[category.icon] ?? CATEGORIES.other;
  const primaryTextColor = tinted ? '#FFFFFF' : theme.textPrimary;
  const secondaryTextColor = tinted ? 'rgba(255, 255, 255, 0.86)' : theme.textSecondary;
  const barColor = tinted ? 'rgba(255, 255, 255, 0.9)' : isOver ? '#DC2626' : pct >= 0.75 ? '#EA580C' : iconColorSet.color;

  if (tinted) {
    const ringSize = 72;
    const strokeWidth = 4;
    const radius = (ringSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference * (1 - pct);

    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [styles.homeCategoryCard, pressed && styles.pressed]}
      >
        <View style={[styles.homeCategoryRing, { height: ringSize, width: ringSize }]}>
          <Svg height={ringSize} width={ringSize} style={StyleSheet.absoluteFill}>
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={iconColorSet.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={progressOffset}
              rotation="-90"
              originX={ringSize / 2}
              originY={ringSize / 2}
            />
          </Svg>
          <View style={[styles.homeCategoryIcon, { backgroundColor: iconColorSet.color }]}>
            <Ionicons name={iconInfo.icon} size={24} color="#FFFFFF" />
          </View>
        </View>

        <Text style={styles.homeCategoryName} numberOfLines={1}>
          {category.name}
        </Text>
        <Text style={styles.homeCategoryAvailable} numberOfLines={1}>
          {hasBudget
            ? isOver
              ? `${fmt(Math.abs(available), currency)} Exc.`
              : `${fmt(available, currency)} Disp.`
            : 'Sin pres.'}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        tinted && styles.cardTinted,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconColorSet.color }]}>
        <Ionicons name={iconInfo.icon} size={20} color="#FFFFFF" />
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: primaryTextColor }]} numberOfLines={1}>{category.name}</Text>
          {hasPctOfTotal && (
            <Text style={styles.spentAmountRight} numberOfLines={1}>
              {fmt(spent, currency)}
            </Text>
          )}
          {hasPctOfTotal && (
            <Text style={styles.pctBadge}>
              {Math.round((percentOfTotal ?? 0) * 100)}%
            </Text>
          )}
          {!hasPctOfTotal && isOver && (
            <View style={[styles.overBadge, tinted && styles.overBadgeTinted]}>
              <Text style={[styles.overBadgeText, tinted && styles.overBadgeTextTinted]}>Excedido</Text>
            </View>
          )}
        </View>

        {(hasPctOfTotal || hasBudget) ? (
          <View style={[styles.barTrack, tinted && styles.barTrackTinted]}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: barColor },
              ]}
            />
          </View>
        ) : (
          <Text style={[styles.budgetPrompt, { color: secondaryTextColor }]} numberOfLines={1}>
            Agrega un presupuesto a esta categoría.
          </Text>
        )}

        {!hasPctOfTotal && hasBudget && (
          <View style={styles.amountRow}>
            <Text style={[styles.available, { color: secondaryTextColor }]} numberOfLines={1}>
              {isOver ? `Excedido +${fmt(Math.abs(available), currency)}` : `${fmt(available, currency)} Disp.`}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  available: {
    color: theme.textSecondary,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  amountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 5,
  },
  barTrack: {
    backgroundColor: theme.mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.16)',
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    overflow: 'hidden',
    width: '100%',
  },
  barTrackTinted: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  barFill: {
    borderRadius: 3,
    height: '100%',
  },
  budgetText: {
    color: theme.textSecondary,
    flexShrink: 0,
    fontSize: 10,
    fontWeight: '500',
  },
  budgetPrompt: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 7,
  },
  card: {
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 16,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'relative',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.mode === 'light' ? 0.08 : 0.10,
    shadowRadius: 8,
  },
  cardTinted: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
  },
  homeCategoryAvailable: {
    color: theme.mode === 'light' ? theme.textSecondary : 'rgba(255, 255, 255, 0.72)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  homeCategoryCard: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 108,
    minWidth: 0,
  },
  homeCategoryIcon: {
    alignItems: 'center',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  homeCategoryName: {
    color: theme.mode === 'light' ? theme.textPrimary : '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
    width: '100%',
  },
  homeCategoryRing: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
    color: theme.textPrimary,
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
    backgroundColor: 'rgba(220, 38, 38, 0.18)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  overBadgeTinted: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  overBadgeText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '700',
  },
  overBadgeTextTinted: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.72,
  },
  spentText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
  },
  spentAmountRight: {
    color: theme.textPrimary,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  pctBadge: {
    color: theme.textMuted,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '600',
  },
});
