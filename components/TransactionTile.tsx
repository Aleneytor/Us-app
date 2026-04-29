import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import type { Transaction } from '../types';
import { formatDateShort, fmt } from '../utils/format';
import { getPaid } from '../utils/filters';
import { TagChip } from './TagChip';

interface TransactionTileProps {
  transaction: Transaction;
  ym: string;
  onPress: () => void;
  onLongPress?: () => void;
}

export function TransactionTile({ transaction, ym, onPress, onLongPress }: TransactionTileProps) {
  const category = CATEGORIES[transaction.cat] ?? CATEGORIES.other;
  const iconColor = getIconColor(transaction.iconColor);
  const amountColor = transaction.kind === 'income' ? APP_COLORS.income : APP_COLORS.expense;
  const sign = transaction.kind === 'income' ? '+' : '-';
  const paid = getPaid(transaction, ym);

  return (
    <Pressable
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColor.bg }]}>
        <Ionicons name={category.icon} size={23} color={iconColor.color} />
      </View>

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text numberOfLines={1} style={styles.title}>
            {transaction.desc || category.label}
          </Text>
          <Text style={[styles.amount, { color: amountColor }]}>
            {sign}{fmt(transaction.amt)}
          </Text>
        </View>

        <View style={styles.metaLine}>
          <Text style={styles.meta}>{formatDateShort(transaction.date)}</Text>
          <View style={styles.dot} />
          <Text style={styles.meta}>{transaction.type === 'monthly' ? 'Mensual' : 'Unico'}</Text>
          <View style={styles.dot} />
          <Text style={[styles.meta, paid ? styles.paid : styles.pending]}>
            {paid ? 'Confirmado' : 'Pendiente'}
          </Text>
        </View>

        {transaction.tags.length > 0 ? (
          <View style={styles.tags}>
            {transaction.tags.slice(0, 4).map((tag) => (
              <TagChip key={tag} tag={tag} small />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  amount: {
    flexShrink: 0,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 10,
  },
  body: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  card: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  dot: {
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 12,
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
    flexWrap: 'wrap',
    gap: 6,
  },
  paid: {
    color: APP_COLORS.green,
  },
  pending: {
    color: APP_COLORS.textMuted,
  },
  pressed: {
    opacity: 0.74,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  title: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  topLine: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
