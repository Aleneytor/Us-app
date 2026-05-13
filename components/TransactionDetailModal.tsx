import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppModal as Modal } from './AppModal';
import { ModalScreen } from './ModalScreen';
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import { useAppStore } from '../store/useAppStore';
import type { Transaction } from '../types';
import { formatDateShort, fmt } from '../utils/format';
import { getUserData } from '../utils/users';

export function TransactionDetailModal({
  transaction,
  ym: _ym,
  onClose,
  onEdit,
  onDelete,
}: {
  transaction: Transaction | null;
  ym: string;
  onClose: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  const currency = useAppStore((s) => s.currency);
  const users = useAppStore((s) => s.users);

  if (!transaction) return null;

  const category = CATEGORIES[transaction.cat] ?? CATEGORIES.other;
  const iconColor = getIconColor(transaction.iconColor);
  const user = getUserData(users, transaction.uid);
  const isIncome = transaction.kind === 'income';
  const amountColor = isIncome ? APP_COLORS.income : APP_COLORS.expense;
  const titleText = transaction.desc || category.label;
  const showCategorySubtitle = !!transaction.desc && transaction.desc !== category.label;

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <ModalScreen
        title={titleText}
        subtitle={showCategorySubtitle ? category.label : formatDateShort(transaction.date)}
        breadcrumbs={['Movimientos', 'Detalle']}
        activeBreadcrumb={1}
        onBack={onClose}
        contentContainerStyle={{ padding: 0 }}
        footer={(
          <>
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
          </>
        )}
      >

            {/* Header: icon + title + date + close */}
            <View style={[styles.header, { display: 'none' }]}>
              <View style={[styles.iconCircle, { backgroundColor: iconColor.bg }]}>
                <Ionicons name={category.icon} size={22} color={iconColor.color} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.txTitle} numberOfLines={1}>{titleText}</Text>
                <Text style={styles.txSubtitle}>
                  {showCategorySubtitle ? category.label : formatDateShort(transaction.date)}
                </Text>
              </View>
              <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                <Ionicons name="close" size={22} color={APP_COLORS.textPrimary} />
              </Pressable>
            </View>

            {/* Amount section */}
            <View style={styles.amountSection}>
              <Text style={[styles.amount, { color: amountColor }]}>
                {isIncome ? '+' : '-'}{fmt(transaction.amt, currency)}
              </Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: isIncome ? '#DCFCE7' : '#FFE4E6' }]}>
                  <Ionicons
                    name={isIncome ? 'arrow-up' : 'arrow-down'}
                    size={11}
                    color={isIncome ? APP_COLORS.income : APP_COLORS.expense}
                  />
                  <Text style={[styles.badgeText, { color: isIncome ? APP_COLORS.income : APP_COLORS.expense }]}>
                    {isIncome ? 'INGRESO' : 'GASTO'}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: '#FFF7ED' }]}>
                  {transaction.type === 'once' ? (
                    <MaterialCommunityIcons name="star-four-points" size={11} color="#F97316" />
                  ) : (
                    <Ionicons name={getTransactionTypeIcon(transaction.type)} size={11} color="#F97316" />
                  )}
                  <Text style={[styles.badgeText, { color: '#F97316' }]}>
                    {getTransactionTypeLabel(transaction.type).toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Meta: user + date (if subtitle was category) + account */}
            <View style={styles.metaSection}>
              <View style={[styles.avatar, { backgroundColor: user.bg }]}>
                <Text style={[styles.avatarInitials, { color: user.color }]}>{user.initials}</Text>
              </View>
              <Text style={styles.userName}>{user.name}</Text>
              <View style={styles.metaSpacer} />
              {showCategorySubtitle && (
                <View style={styles.dateChip}>
                  <Ionicons name="calendar-outline" size={12} color={APP_COLORS.textMuted} />
                  <Text style={styles.dateText}>{formatDateShort(transaction.date)}</Text>
                </View>
              )}
              {transaction.account ? (
                <View style={styles.accountBadge}>
                  <Text style={styles.accountText}>{transaction.account}</Text>
                </View>
              ) : null}
            </View>

            {/* Notes */}
            {transaction.notes ? (
              <View style={styles.notesRow}>
                <Ionicons name="chatbubble-outline" size={14} color={APP_COLORS.textMuted} />
                <Text style={styles.notesText}>{transaction.notes}</Text>
              </View>
            ) : null}

            {/* Action buttons */}
            <View style={[styles.actions, { display: 'none' }]}>
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

      </ModalScreen>
    </Modal>
  );
}

function getTransactionTypeLabel(type: Transaction['type']): string {
  if (type === 'monthly') return 'Mensual';
  if (type === 'weekly') return 'Semanal';
  if (type === 'biweekly') return 'Bi semanal';
  return 'Unico';
}

function getTransactionTypeIcon(type: Transaction['type']) {
  if (type === 'monthly') return 'refresh-outline';
  if (type === 'weekly') return 'calendar-outline';
  if (type === 'biweekly') return 'git-compare-outline';
  return 'radio-button-on-outline';
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: APP_COLORS.background,
    borderRadius: 22,
    overflow: 'hidden',
    width: '100%',
  },
  cardShadow: {
    borderRadius: 22,
    elevation: 14,
    maxWidth: 520,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    width: '100%',
  },
  // Header
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  headerText: {
    flex: 1,
  },
  txTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
  txSubtitle: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  // Amount section
  amountSection: {
    alignItems: 'center',
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    gap: 10,
    paddingVertical: 20,
  },
  amount: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 40,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Meta section
  metaSection: {
    alignItems: 'center',
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  metaSpacer: {
    flex: 1,
  },
  dateChip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  dateText: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
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
  // Notes
  notesRow: {
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notesText: {
    color: APP_COLORS.textSecondary,
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  // Actions footer
  actions: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  actionBtnDelete: {
    backgroundColor: '#FFE4E6',
  },
  pressed: {
    opacity: 0.65,
  },
});
