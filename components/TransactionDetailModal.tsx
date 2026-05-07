import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import { useAppStore } from '../store/useAppStore';
import { USERS } from '../types';
import type { Transaction } from '../types';
import { getPaid } from '../utils/filters';
import { formatDateShort, fmt } from '../utils/format';

export function TransactionDetailModal({
  transaction,
  ym,
  onClose,
  onEdit,
  onDelete,
  onTogglePaid,
}: {
  transaction: Transaction | null;
  ym: string;
  onClose: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onTogglePaid: (t: Transaction) => void;
}) {
  if (!transaction) return null;
  const currency = useAppStore((s) => s.currency);
  const category = CATEGORIES[transaction.cat] ?? CATEGORIES.other;
  const iconColor = getIconColor(transaction.iconColor);
  const paid = getPaid(transaction, ym);
  const user = USERS[transaction.uid];
  const isIncome = transaction.kind === 'income';
  const amountColor = isIncome ? APP_COLORS.income : APP_COLORS.expense;
  const paidDate = (transaction.paidAt as Record<string, string> | undefined)?.[ym];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <Pressable style={styles.backdrop} onPressIn={onClose}>
        <Pressable style={styles.card} onPressIn={(event) => event.stopPropagation()}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Detalles</Text>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
              <Ionicons name="close" size={20} color={APP_COLORS.textSecondary} />
            </Pressable>
          </View>

          {/* User + type labels */}
          <View style={styles.metaRow}>
            <View style={[styles.avatar, { backgroundColor: user.bg }]}>
              <Text style={[styles.avatarInitials, { color: user.color }]}>{user.initials}</Text>
            </View>
            <Text style={styles.userName}>{user.name}</Text>
            <View style={styles.typeLabel}>
              <Ionicons
                name={isIncome ? 'arrow-up' : 'arrow-down'}
                size={11}
                color={isIncome ? APP_COLORS.income : APP_COLORS.expense}
              />
              <Text style={[styles.typeLabelText, { color: isIncome ? APP_COLORS.income : APP_COLORS.expense }]}>
                {isIncome ? 'INGRESO' : 'GASTO'}
              </Text>
            </View>
            <View style={styles.labelDivider} />
            <View style={styles.typeLabel}>
              {transaction.type === 'monthly' ? (
                <Ionicons name="refresh-outline" size={11} color="#F97316" />
              ) : (
                <MaterialCommunityIcons name="star-four-points" size={11} color="#F97316" />
              )}
              <Text style={[styles.typeLabelText, { color: '#F97316' }]}>
                {transaction.type === 'monthly' ? 'MENSUAL' : 'ÚNICO'}
              </Text>
            </View>
          </View>

          {/* Main content row */}
          <View style={styles.mainRow}>
            <View style={styles.mainLeft}>
              <View style={[styles.iconWrap, { backgroundColor: iconColor.bg }]}>
                <Ionicons name={category.icon} size={24} color={iconColor.color} />
              </View>
              <View style={styles.mainInfo}>
                <Text style={styles.txTitle} numberOfLines={1}>
                  {transaction.desc || category.label}
                </Text>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={12} color={APP_COLORS.textMuted} />
                  <Text style={styles.dateText}>{formatDateShort(transaction.date)}</Text>
                </View>
              </View>
            </View>
            <View style={styles.mainRight}>
              <Text style={[styles.amount, { color: amountColor }]}>
                {isIncome ? '+' : '-'}{fmt(transaction.amt, currency)}
              </Text>
              {transaction.account ? (
                <View style={styles.accountBadge}>
                  <Text style={styles.accountText}>{transaction.account}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Toggle paid */}
          <View style={styles.toggleRow}>
            <Switch
              value={paid}
              onValueChange={() => onTogglePaid(transaction)}
              trackColor={{ false: '#E2E8F0', true: '#86EFAC' }}
              thumbColor={paid ? APP_COLORS.income : '#F8FAFC'}
              ios_backgroundColor="#E2E8F0"
            />
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>{paid ? 'Ingresado' : 'Pendiente'}</Text>
              {paid && paidDate ? (
                <Text style={styles.toggleSub}>Recibido el {formatDateShort(paidDate)}</Text>
              ) : null}
            </View>
          </View>

          {/* Notes */}
          {transaction.notes ? (
            <View style={styles.notesRow}>
              <Ionicons name="chatbubble-outline" size={14} color={APP_COLORS.textMuted} />
              <Text style={styles.notesText}>{transaction.notes}</Text>
            </View>
          ) : null}

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => {}}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Ionicons name="chatbubble-outline" size={20} color={APP_COLORS.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => onEdit(transaction)}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Ionicons name="pencil-outline" size={20} color={APP_COLORS.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => onDelete(transaction)}
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnDelete, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={20} color={APP_COLORS.expense} />
            </Pressable>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 22,
    maxWidth: 520,
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  headerTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    alignItems: 'center',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  metaRow: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  avatarInitials: {
    fontSize: 12,
    fontWeight: '800',
  },
  userName: {
    color: APP_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  typeLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  typeLabelText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  mainRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  mainLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  mainInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  txTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  dateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  dateText: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  mainRight: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 8,
  },
  amount: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 28,
  },
  labelDivider: {
    backgroundColor: APP_COLORS.border,
    borderRadius: 1,
    height: 12,
    width: 1,
  },
  accountBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  accountText: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  toggleInfo: {
    gap: 2,
  },
  toggleLabel: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleSub: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  notesRow: {
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 12,
  },
  notesText: {
    color: APP_COLORS.textSecondary,
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  actionBtnDelete: {
    backgroundColor: '#FFF1F2',
  },
  pressed: {
    opacity: 0.65,
  },
});
