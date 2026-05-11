import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import type { Transaction } from '../types';
import { formatDateShort, fmt } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { getUserData } from '../utils/users';

interface TransactionTileProps {
  transaction: Transaction;
  ym: string;
  onPress: () => void;
  onLongPress?: () => void;
  contentHorizontalPadding?: number;
  amountCategoryFontSize?: number;
  amountCategoryColor?: string;
}

export function TransactionTile({
  transaction,
  ym: _ym,
  onPress,
  onLongPress,
  contentHorizontalPadding = 0,
  amountCategoryFontSize,
  amountCategoryColor,
}: TransactionTileProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressPressRef = useRef(false);
  const currency = useAppStore((s) => s.currency);
  const users = useAppStore((s) => s.users);
  const category = CATEGORIES[transaction.cat] ?? CATEGORIES.other;
  const iconColor = getIconColor(transaction.iconColor);
  const user = getUserData(users, transaction.uid);
  const amountColor = transaction.kind === 'income' ? APP_COLORS.income : APP_COLORS.expense;
  const sign = transaction.kind === 'income' ? '+' : '-';

  const handlePress = () => {
    if (suppressPressRef.current) {
      suppressPressRef.current = false;
      return;
    }
    onPress();
  };

  return (
    <View style={styles.tileWrap}>
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
          styles.row,
          contentHorizontalPadding > 0 && { paddingHorizontal: contentHorizontalPadding },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: iconColor.bg }]}>
          <Ionicons name={category.icon} size={23} color={iconColor.color} />
        </View>

        <View style={styles.body}>
          <View style={styles.topLine}>
            <View style={[styles.userAvatar, { backgroundColor: user.bg }]}>
              {user.photo ? (
                <Image source={user.photo} style={styles.userPhoto} />
              ) : (
                <Text style={[styles.userInitial, { color: user.color }]}>{user.initials}</Text>
              )}
            </View>
            <Text numberOfLines={1} style={styles.title}>
              {transaction.desc || category.label}
            </Text>
          </View>

          <View style={styles.metaLine}>
            <Text style={styles.meta}>{formatDateShort(transaction.date)}</Text>
            {transaction.account ? (
              <>
                <View style={styles.dot} />
                <Text style={styles.meta} numberOfLines={1}>{transaction.account}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.amountBlock}>
          <Text style={[styles.amount, { color: amountColor }]}>
            <Text style={styles.amountSign}>{sign}</Text>
            {fmt(transaction.amt, currency)}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.amountCategory,
              amountCategoryFontSize !== undefined && { fontSize: amountCategoryFontSize },
              amountCategoryColor !== undefined && { color: amountCategoryColor },
            ]}
          >
            {category.label}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  amount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  amountBlock: {
    alignItems: 'flex-end',
    gap: 5,
    justifyContent: 'center',
    marginLeft: 12,
    minWidth: 92,
  },
  amountSign: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
  },
  amountCategory: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  dot: {
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  meta: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  metaLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  pressed: {
    opacity: 0.74,
  },
  tileWrap: {
    borderBottomColor: '#EEF2F7',
    borderBottomWidth: 1,
    width: '100%',
  },
  row: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingVertical: 10,
    width: '100%',
  },
  title: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  topLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  userAvatar: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 18,
  },
  userInitial: {
    fontSize: 9,
    fontWeight: '800',
  },
  userPhoto: {
    height: '100%',
    width: '100%',
  },
});
