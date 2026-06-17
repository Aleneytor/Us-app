import { useMemo, useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, Animated } from 'react-native';
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
  const budgetPct = hasBudget ? Math.min(1, spent / category.monthlyBudget) : 0;
  const pct = hasPctOfTotal
    ? Math.min(1, percentOfTotal)
    : budgetPct;
  const available = category.monthlyBudget - spent;
  const isOver = hasBudget && available < 0;
  const tinted = variant === 'tinted';

  const iconInfo = CATEGORIES[category.icon] ?? CATEGORIES.other;

  const [showAmount, setShowAmount] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!hasBudget) return;

    let active = true;
    const runCycle = () => {
      if (!active) return;
      const delay = 5000;
      const timer = setTimeout(() => {
        if (!active) return;
        // Fade out
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          if (!active) return;
          setShowAmount(!showAmount);
          // Fade in
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }).start();
        });
      }, delay);
      return timer;
    };

    const timer = runCycle();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [showAmount, hasBudget]);

  if (tinted) {
    const ringSize = 74;
    const strokeWidth = 5;
    const radius = (ringSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference * (1 - pct);

    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          styles.homeCategoryCard,
          {
            backgroundColor: iconColorSet.color,
            shadowColor: iconColorSet.color,
          },
          pressed && styles.pressed,
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(255, 255, 255, 0.31)',
            'rgba(255, 255, 255, 0.12)',
            'rgba(255, 255, 255, 0)',
          ] as const}
          locations={[0, 0.34, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0.72, y: 0.12 }}
          style={styles.homeCategoryInnerShadow}
        />
        <Text style={styles.homeCategoryName} numberOfLines={1}>
          {category.name}
        </Text>

        <View style={[styles.homeCategoryRing, { height: ringSize, width: ringSize }]}>
          <Svg height={ringSize} width={ringSize} style={StyleSheet.absoluteFill}>
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke="rgba(255, 255, 255, 0.20)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke="#FFFFFF"
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
          <View style={styles.homeCategoryIcon}>
            <Ionicons name={iconInfo.icon} size={32} color="#FFFFFF" />
          </View>
          {isOver && (
            <View style={styles.alertBadge}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
            </View>
          )}
        </View>

        {hasBudget ? (
          <Animated.Text style={[styles.homeCategoryAvailable, { opacity: fadeAnim }]} numberOfLines={1}>
            {showAmount
              ? (isOver
                ? `+${fmt(Math.abs(available), currency)}`
                : fmt(available, currency))
              : (isOver
                ? 'Excedido'
                : 'Disponible')}
          </Animated.Text>
        ) : (
          <Text style={styles.homeCategoryAvailable} numberOfLines={1}>
            {fmt(spent, currency)}
          </Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      {/* Solid category colored rounded square with category icon */}
      <View style={[styles.colorBlock, { backgroundColor: iconColorSet.color }]}>
        <Ionicons name={iconInfo.icon} size={20} color="#FFFFFF" />
      </View>

      {/* Card Content Column */}
      <View style={styles.cardContent}>
        {/* Top Row: Category Name & Optional Monthly Budget Limit */}
        <View style={styles.topRow}>
          <Text style={styles.categoryTitle} numberOfLines={1}>
            {category.name}
          </Text>
          {hasBudget && (
            <Text style={styles.budgetLimit} numberOfLines={1}>
              {fmt(category.monthlyBudget, currency)}
            </Text>
          )}
        </View>

        {/* Middle Row: Progress Bar (Category-themed fill). Filled to 100% if no budget set. */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: spent > 0 ? `${hasBudget ? Math.round(budgetPct * 100) : 100}%` as `${number}%` : '0%',
                backgroundColor: iconColorSet.color,
              },
            ]}
          />
        </View>

        {/* Bottom Row: Spent (neutral gray) & Optional Remaining (category theme color) */}
        <View style={styles.bottomRow}>
          <Text style={styles.spentAmount} numberOfLines={1}>
            {fmt(spent, currency)}
          </Text>
          {hasBudget && (
            <Text style={[styles.remainingAmount, { color: iconColorSet.color }]} numberOfLines={1}>
              {fmt(available, currency)}
            </Text>
          )}
        </View>
      </View>

      {/* Over-budget alert indicator */}
      {isOver && (
        <View style={styles.cardAlertBadge}>
          <Ionicons name="alert-circle" size={18} color="#DC2626" />
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 18,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 11,
    position: 'relative',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.mode === 'light' ? 0.05 : 0.12,
    shadowRadius: 8,
    overflow: 'visible',
  },
  colorBlock: {
    alignItems: 'center',
    borderRadius: 12,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  topRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
    width: '100%',
  },
  categoryTitle: {
    color: theme.textPrimary,
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14.5,
  },
  pctText: {
    color: theme.textMuted,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11.5,
  },
  budgetLimit: {
    color: theme.textPrimary,
    flexShrink: 0,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14.5,
    textAlign: 'right',
  },
  progressBarTrack: {
    backgroundColor: theme.mode === 'light' ? '#EAEAEA' : '#2D3139',
    borderRadius: 99,
    height: 5,
    marginVertical: 4,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    borderRadius: 99,
    height: '100%',
  },
  bottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  spentAmount: {
    color: theme.mode === 'light' ? '#8E8E93' : '#AEAEB2',
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  remainingAmount: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    textAlign: 'right',
  },
  cardAlertBadge: {
    position: 'absolute',
    right: -6,
    top: -6,
    zIndex: 10,
  },
  pressed: {
    opacity: 0.72,
  },

  // Styles below are strictly reserved for variant === 'tinted' (Dashboard slider)
  homeCategoryCard: {
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 18,
    elevation: 8,
    flex: 1,
    maxWidth: 120,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  homeCategoryInnerShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  homeCategoryName: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
    width: '100%',
  },
  homeCategoryRing: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  homeCategoryIcon: {
    alignItems: 'center',
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  alertBadge: {
    position: 'absolute',
    right: -5,
    top: -5,
    zIndex: 10,
  },
  homeCategoryAvailable: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
});
