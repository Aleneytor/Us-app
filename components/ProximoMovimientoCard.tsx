import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import type { CurrencyCode, Transaction } from '../types';
import { fmt } from '../utils/format';

interface ProximoMovimientoCardProps {
  transaction: Transaction;
  daysLeft: number;
  currency: CurrencyCode;
  onPress?: () => void;
  onMenuPress?: () => void;
}

export function ProximoMovimientoCard({
  transaction,
  daysLeft,
  currency,
  onPress,
  onMenuPress,
}: ProximoMovimientoCardProps) {
  const category = CATEGORIES[transaction.cat] ?? CATEGORIES.other;
  const isMonthly = transaction.type === 'monthly';
  const bgColor = isMonthly ? '#EC1147' : '#94A3B8';
  const freq = isMonthly ? '/mes' : '/unico';
  const verb = transaction.kind === 'income' ? 'recibir' : 'pagar';
  const daysLabel =
    daysLeft === 0 ? 'Hoy' :
    daysLeft === 1 ? `Debes ${verb} en 1 Dia` :
    `Debes ${verb} en ${daysLeft} Dias`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: bgColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.topLine}>
        <View style={styles.iconCircle}>
          <Ionicons name={category.icon} size={20} color={bgColor} />
        </View>
        <Pressable
          accessibilityLabel="Opciones de movimiento"
          onPress={onMenuPress}
          style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.title}>
          {transaction.desc || category.label}
        </Text>
        <Text numberOfLines={1} style={styles.amount}>
          {fmt(transaction.amt, currency)}{freq}
        </Text>
      </View>

      <Text numberOfLines={2} style={styles.days}>
        {daysLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  amount: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  body: {
    gap: 4,
  },
  card: {
    borderRadius: 16,
    height: 130,
    justifyContent: 'space-between',
    marginRight: 12,
    padding: 14,
    width: 160,
  },
  days: {
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  menuButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 28,
  },
  pressed: {
    opacity: 0.76,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  topLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
