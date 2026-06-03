import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { getIconColor, type AppTheme } from '../constants/colors';
import type { ActivityItem } from '../utils/activityFeed';
import { formatDateShort, fmt } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../contexts/ThemeContext';
import { TransactionTile } from './TransactionTile';

interface ActivityTileProps {
  activity: ActivityItem;
  ym: string;
  onPress?: () => void;
  onLongPress?: () => void;
  flat?: boolean;
}

export function ActivityTile({
  activity,
  ym,
  onPress,
  onLongPress,
  flat = false,
}: ActivityTileProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressPressRef = useRef(false);
  const currency = useAppStore((s) => s.currency);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (activity.source === 'transaction') {
    return (
      <TransactionTile
        transaction={activity.transaction}
        ym={ym}
        onPress={onPress ?? (() => {})}
        onLongPress={onLongPress}
        flat={flat}
      />
    );
  }

  const category = CATEGORIES[activity.iconKey] ?? CATEGORIES.other;
  const iconColor = getIconColor(activity.iconColor);
  const isPlanExpense = activity.source === 'plan_expense';
  const isPlanSettlement = activity.source === 'plan_settlement';
  const isPlanActivity = activity.source === 'plan_created' || activity.source === 'plan_expense' || activity.source === 'plan_settlement';
  const typeIndicator = isPlanExpense || isPlanSettlement
    ? {
        icon: activity.kind === 'income' ? 'arrow-top-right' as const : 'arrow-bottom-left' as const,
        color: activity.kind === 'income' ? '#00D158' : '#FF0B4F',
        library: 'material' as const,
      }
    : isPlanActivity
      ? { icon: 'map-outline' as const, color: '#2563EB', library: 'ion' as const }
      : { icon: 'wallet-outline' as const, color: '#7C3AED', library: 'ion' as const };
  const dateText = activity.source === 'plan_expense' || activity.source === 'plan_settlement'
    ? activity.subtitle
    : activity.source === 'saving_created' ||
    activity.source === 'goal_created' ||
    activity.source === 'plan_created'
    ? formatDateShort(activity.date)
    : `${activity.subtitle} - ${formatDateShort(activity.date)}`;
  const amountText = activity.source === 'plan_created' ||
    activity.source === 'saving_created' ||
    activity.source === 'goal_created'
    ? 'Creado'
    : fmt(activity.amount, currency);

  const handlePress = () => {
    if (suppressPressRef.current) {
      suppressPressRef.current = false;
      return;
    }
    onPress?.();
  };

  return (
    <Pressable
      onLongPress={onLongPress}
      onPress={handlePress}
      onTouchStart={(event) => {
        const { pageX, pageY } = event.nativeEvent;
        touchStartRef.current = { x: pageX, y: pageY };
        suppressPressRef.current = false;
      }}
      onTouchMove={(event) => {
        const start = touchStartRef.current;
        if (!start) return;
        const { pageX, pageY } = event.nativeEvent;
        const dx = Math.abs(pageX - start.x);
        const dy = Math.abs(pageY - start.y);
        if (dx > 14 && dx > dy * 1.35) {
          suppressPressRef.current = true;
        }
      }}
      onTouchCancel={() => {
        touchStartRef.current = null;
        suppressPressRef.current = false;
      }}
      onTouchEnd={() => {
        touchStartRef.current = null;
      }}
      style={({ pressed }) => [
        styles.card,
        flat && styles.cardFlat,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColor.color }]}>
        <Ionicons name={category.icon} size={20} color="#FFFFFF" />
      </View>

      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.title}>
          {activity.title}
        </Text>
        <Text numberOfLines={1} style={styles.date}>
          {dateText}
        </Text>
      </View>

      <View style={styles.amountBlock}>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
          {amountText}
        </Text>
        <View style={[styles.kindIndicator, { backgroundColor: typeIndicator.color }]}>
          {typeIndicator.library === 'material' ? (
            <MaterialCommunityIcons name={typeIndicator.icon} size={15} color="#FFFFFF" />
          ) : (
            <Ionicons name={typeIndicator.icon} size={15} color="#FFFFFF" />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  amount: {
    color: t.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  amountBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginLeft: 12,
    minWidth: 96,
  },
  body: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  card: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderRadius: 20,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  cardFlat: {
    elevation: 0,
    shadowOpacity: 0,
  },
  date: {
    color: t.textMuted,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  kindIndicator: {
    alignItems: 'center',
    borderRadius: 9,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  pressed: {
    opacity: 0.72,
  },
  title: {
    color: t.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
  },
});
