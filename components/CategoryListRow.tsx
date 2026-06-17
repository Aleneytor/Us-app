import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type AppTheme, getIconColor } from '../constants/colors';
import { CATEGORIES } from '../constants/categories';
import { useTheme } from '../contexts/ThemeContext';
import type { BudgetCategory, CurrencyCode } from '../types';
import { fmt } from '../utils/format';

interface Props {
  category: BudgetCategory;
  /** Amount spent (or earned) in the selected month */
  spent: number;
  currency: CurrencyCode;
  /** ISO date string 'YYYY-MM-DD' of the last transaction for this category in the month */
  lastDate?: string;
  /** Chart / display mode — drives arrow badge direction */
  mode?: 'expense' | 'income';
  onPress?: () => void;
  onLongPress?: () => void;
}

/** Format 'YYYY-MM-DD' → 'DD/MM/YYYY' */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function CategoryListRow({
  category,
  spent,
  currency,
  lastDate,
  mode = 'expense',
  onPress,
  onLongPress,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const iconColorSet = getIconColor(category.iconColor);
  const iconInfo = CATEGORIES[category.icon] ?? CATEGORIES.other;
  const badgeIcon: React.ComponentProps<typeof Ionicons>['name'] =
    mode === 'income' ? 'trending-up' : 'trending-down';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${category.name}: ${fmt(spent, currency)}`}
    >
      {/* Color block with icon */}
      <View style={[styles.colorBlock, { backgroundColor: iconColorSet.color }]}>
        <Ionicons name={iconInfo.icon} size={20} color="#FFFFFF" />
      </View>

      {/* Name + date */}
      <View style={styles.textCol}>
        <Text style={styles.name} numberOfLines={1}>
          {category.name}
        </Text>
        {lastDate ? (
          <Text style={styles.date} numberOfLines={1}>
            {formatDate(lastDate)}
          </Text>
        ) : null}
      </View>

      {/* Amount */}
      <Text style={styles.amount} numberOfLines={1}>
        {fmt(spent, currency)}
      </Text>

      {/* Arrow badge */}
      <View
        style={[
          styles.badge,
          { backgroundColor: iconColorSet.color + '26' }, // 15% opacity
        ]}
      >
        <Ionicons name={badgeIcon} size={16} color={iconColorSet.color} />
      </View>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: 18,
      elevation: 2,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      shadowColor: t.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: t.mode === 'light' ? 0.05 : 0.10,
      shadowRadius: 6,
    },
    pressed: {
      opacity: 0.72,
    },
    colorBlock: {
      alignItems: 'center',
      borderRadius: 14,
      flexShrink: 0,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    textCol: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    name: {
      color: t.textPrimary,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
    },
    date: {
      color: t.textMuted,
      fontFamily: 'Poppins_400Regular',
      fontSize: 12,
      lineHeight: 16,
    },
    amount: {
      color: t.textPrimary,
      flexShrink: 0,
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 15,
    },
    badge: {
      alignItems: 'center',
      borderRadius: 999,
      flexShrink: 0,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
  });
