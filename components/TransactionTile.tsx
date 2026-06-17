import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { getIconColor, type AppTheme } from '../constants/colors';
import type { Transaction } from '../types';
import { formatDateShort, fmt } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../contexts/ThemeContext';

interface TransactionTileProps {
  transaction: Transaction;
  ym: string;
  onPress: () => void;
  onLongPress?: () => void;
  flat?: boolean;
}

export function TransactionTile({
  transaction,
  onPress,
  onLongPress,
  flat = false,
}: TransactionTileProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressPressRef = useRef(false);
  const currency = useAppStore((s) => s.currency);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const category = CATEGORIES[transaction.cat] ?? CATEGORIES.other;
  const iconColor = getIconColor(transaction.iconColor);
  const isIncome = transaction.kind === 'income';

  const handlePress = () => {
    if (suppressPressRef.current) {
      suppressPressRef.current = false;
      return;
    }
    onPress();
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
        <Ionicons name={category.icon} size={22} color="#FFFFFF" />
      </View>

      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.title}>
          {transaction.desc || category.label}
        </Text>
        <Text style={styles.date}>{formatDateShort(transaction.date)}</Text>
      </View>

      <View style={styles.amountBlock}>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
          {fmt(transaction.amt, currency)}
        </Text>
        <View style={[styles.kindIndicator, { backgroundColor: isIncome ? '#00D158' : '#FF0B4F' }]}>
          <MaterialCommunityIcons
            name={isIncome ? 'arrow-top-right' : 'arrow-bottom-left'}
            size={15}
            color="#FFFFFF"
          />
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  amount: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
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
    borderRadius: 18,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
    minHeight: 60,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 8,
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
  },
  cardFlat: {
    elevation: 0,
    shadowOpacity: 0,
  },
  date: {
    color: t.textMuted,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    marginRight: 2,
    width: 44,
  },
  kindIndicator: {
    alignItems: 'center',
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  pressed: {
    opacity: 0.72,
  },
  title: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
});
