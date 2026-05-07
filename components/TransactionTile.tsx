import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import { USERS } from '../types';
import type { Transaction } from '../types';
import { formatDateShort, fmt } from '../utils/format';
import { getPaid } from '../utils/filters';
import { useAppStore } from '../store/useAppStore';

interface TransactionTileProps {
  transaction: Transaction;
  ym: string;
  onPress: () => void;
  onLongPress?: () => void;
  onConfirm?: () => void;
  onEdit?: () => void;
  onSwipeBegin?: () => void;
  onSwipeEnd?: () => void;
  contentHorizontalPadding?: number;
  amountCategoryFontSize?: number;
  amountCategoryColor?: string;
}

export function TransactionTile({
  transaction,
  ym,
  onPress,
  onLongPress,
  onConfirm,
  onEdit,
  onSwipeBegin,
  onSwipeEnd,
  contentHorizontalPadding = 0,
  amountCategoryFontSize,
  amountCategoryColor,
}: TransactionTileProps) {
  const currency = useAppStore((s) => s.currency);
  const category = CATEGORIES[transaction.cat] ?? CATEGORIES.other;
  const iconColor = getIconColor(transaction.iconColor);
  const user = USERS[transaction.uid];
  const amountColor = transaction.kind === 'income' ? APP_COLORS.income : APP_COLORS.expense;
  const sign = transaction.kind === 'income' ? '+' : '-';
  const paid = getPaid(transaction, ym);
  const translateX = useRef(new Animated.Value(0)).current;

  const resetSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4,
      onPanResponderGrant: () => onSwipeBegin?.(),
      onPanResponderMove: (_, { dx }) => {
        translateX.setValue(Math.max(-90, Math.min(75, dx)));
      },
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -52 && onConfirm) onConfirm();
        else if (dx > 52 && onEdit) onEdit();
        resetSwipe();
        onSwipeEnd?.();
      },
      onPanResponderTerminate: () => { resetSwipe(); onSwipeEnd?.(); },
    }),
    [onConfirm, onEdit, onSwipeBegin, onSwipeEnd, translateX],
  );

  return (
    <View style={styles.swipeWrap}>
      {onEdit ? (
        <View style={[styles.swipeAction, styles.swipeEdit]}>
          <Ionicons name="pencil" size={20} color="#FFFFFF" />
          <Text style={styles.swipeText}>Editar</Text>
        </View>
      ) : null}
      {onConfirm ? (
        <View style={[styles.swipeAction, paid ? styles.swipeUnconfirm : styles.swipeConfirm]}>
          <Ionicons name={paid ? 'arrow-undo-outline' : 'checkmark'} size={22} color="#FFFFFF" />
          <Text style={styles.swipeText}>
            {paid ? 'Marcar\nPendiente' : `Confirmar\n${transaction.kind === 'income' ? 'Ingreso' : 'Gasto'}`}
          </Text>
        </View>
      ) : null}

      <Animated.View
        style={[styles.foreground, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onLongPress={onLongPress}
          onPress={onPress}
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
              <View style={styles.dot} />
              <Text style={[styles.meta, paid ? { color: iconColor.color } : styles.pending]}>
                {paid ? 'Confirmado' : 'Pendiente'}
              </Text>
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
      </Animated.View>
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
  foreground: {
    backgroundColor: APP_COLORS.surface,
    width: '100%',
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
  pending: {
    color: APP_COLORS.textMuted,
  },
  pressed: {
    opacity: 0.74,
  },
  swipeAction: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
  },
  swipeConfirm: {
    backgroundColor: '#16A34A',
    right: 0,
    width: 90,
  },
  swipeUnconfirm: {
    backgroundColor: '#64748B',
    right: 0,
    width: 90,
  },
  swipeEdit: {
    backgroundColor: '#2563EB',
    left: 0,
    width: 75,
  },
  swipeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  swipeWrap: {
    borderBottomColor: '#EEF2F7',
    borderBottomWidth: 1,
    overflow: 'hidden',
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
