import type { ComponentProps, ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal as Modal } from './AppModal';
import { CATEGORIES } from '../constants/categories';
import { type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import { useAppStore } from '../store/useAppStore';
import type { Transaction } from '../types';
import { formatDateShort, fmt } from '../utils/format';
import { getUserData } from '../utils/users';
import { runAfterKeyboardDismiss } from '../utils/keyboard';

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
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const currency = useAppStore((s) => s.currency);
  const users = useAppStore((s) => s.users);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const metrics = getResponsiveMetrics(width, height, insets.top, insets.bottom);

  const [noteEditing, setNoteEditing] = useState(false);
  const [noteText, setNoteText] = useState('');

  if (!transaction) return null;

  const DETAIL_COLORS = {
    background: theme.background,
    card: theme.surface,
    cardBorder: theme.border,
    cardShadow: theme.shadowColor,
    text: theme.textPrimary,
    secondary: theme.textSecondary,
    muted: theme.textMuted,
    iconBg: theme.softSurface,
    actionBg: theme.mode === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255, 255, 255, 0.075)',
    actionText: theme.textSecondary,
    expense: theme.expense,
    income: theme.income,
    orange: '#F97316',
  };

  const category = CATEGORIES[transaction.cat] ?? CATEGORIES.other;
  const user = getUserData(users, transaction.uid);
  const isIncome = transaction.kind === 'income';
  const amountColor = DETAIL_COLORS.text;
  const titleText = transaction.desc || category.label;
  const currentNote = transaction.notes?.trim();

  const openNoteEditor = () => {
    setNoteText(transaction.notes ?? '');
    setNoteEditing(true);
  };

  const saveNote = () => {
    updateTransaction({ ...transaction, notes: noteText.trim() });
    setNoteEditing(false);
  };

  const cancelNote = () => {
    setNoteEditing(false);
    setNoteText('');
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <StatusBar style={theme.mode === 'light' ? 'dark' : 'light'} translucent backgroundColor="transparent" />
        <Pressable accessibilityLabel="Cerrar detalles" onPress={onClose} style={StyleSheet.absoluteFill} />

        <View
          style={[
            styles.sheet,
            {
              maxHeight: metrics.sheetMaxHeight,
              maxWidth: MAX_CONTENT_WIDTH,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View
            style={[
              styles.header,
              {
                gap: metrics.headerGap,
                paddingBottom: metrics.headerBottom,
                paddingHorizontal: metrics.pagePad,
                paddingTop: metrics.headerTop,
              },
            ]}
          >
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [
              styles.backButton,
              { height: metrics.backButton, width: metrics.backButton },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-back" size={metrics.backIcon} color={DETAIL_COLORS.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text
              style={[styles.title, { fontSize: metrics.title, lineHeight: metrics.titleLine }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {titleText}
            </Text>
            <Text style={[styles.subtitle, { fontSize: metrics.subtitle, lineHeight: metrics.subtitleLine }]}>
              Detallado
            </Text>
          </View>
        </View>

        <ScrollView
          style={[styles.scroll, { maxHeight: metrics.scrollMaxHeight }]}
          contentContainerStyle={[
            styles.scrollContent,
            {
              gap: metrics.sectionGap,
              paddingBottom: metrics.scrollBottom,
              paddingHorizontal: metrics.pagePad,
            },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View
            style={[
              styles.card,
              styles.amountCard,
              {
                gap: metrics.amountGap,
                minHeight: metrics.amountCardHeight,
                paddingHorizontal: metrics.amountPadX,
                paddingVertical: metrics.amountPadY,
              },
            ]}
          >
            <Text
              style={[
                styles.amount,
                { color: amountColor, fontSize: metrics.amount, lineHeight: metrics.amountLine },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {isIncome ? '+' : '-'}{fmt(transaction.amt, currency)}
            </Text>

            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.badge,
                  isIncome ? styles.incomeBadge : styles.expenseBadge,
                  {
                    gap: metrics.badgeGap,
                    height: metrics.badgeHeight,
                    minWidth: metrics.badgeMinWidth,
                    paddingHorizontal: metrics.badgePadX,
                  },
                ]}
              >
                <Ionicons
                  name={isIncome ? 'arrow-up' : 'arrow-down'}
                  size={metrics.badgeIcon}
                  color={isIncome ? DETAIL_COLORS.income : DETAIL_COLORS.expense}
                />
                <Text style={[styles.badgeText, { color: isIncome ? DETAIL_COLORS.income : DETAIL_COLORS.expense, fontSize: metrics.badgeText }]}>
                  {isIncome ? 'INGRESO' : 'GASTO'}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  styles.typeBadge,
                  {
                    gap: metrics.badgeGap,
                    height: metrics.badgeHeight,
                    minWidth: metrics.badgeMinWidth,
                    paddingHorizontal: metrics.badgePadX,
                  },
                ]}
              >
                {transaction.type === 'once' ? (
                  <MaterialCommunityIcons name="star-four-points" size={metrics.badgeIcon - 1} color={DETAIL_COLORS.orange} />
                ) : (
                  <Ionicons name={getTransactionTypeIcon(transaction.type)} size={metrics.badgeIcon - 1} color={DETAIL_COLORS.orange} />
                )}
                <Text style={[styles.badgeText, { color: DETAIL_COLORS.orange, fontSize: metrics.badgeText }]}>
                  {getTransactionTypeLabel(transaction.type).toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailList}>
            {/* User row */}
            <View style={[styles.detailCard, styles.userRow]}>
              {user.photo ? (
                <Image
                  source={user.photo}
                  style={{
                    borderRadius: (metrics.avatar - 10) / 2,
                    height: metrics.avatar - 10,
                    width: metrics.avatar - 10,
                  }}
                />
              ) : (
                <View
                  style={[
                    styles.contactAvatar,
                    {
                      backgroundColor: user.bg,
                      borderRadius: (metrics.avatar - 10) / 2,
                      height: metrics.avatar - 10,
                      width: metrics.avatar - 10,
                    },
                  ]}
                >
                  <Text style={[styles.contactInitials, { color: user.color, fontSize: metrics.avatarText - 3 }]}>
                    {user.initials}
                  </Text>
                </View>
              )}
              <Text style={[styles.userNameText, { fontSize: metrics.detailValue }]}>{user.name}</Text>
            </View>

            <View style={styles.separator} />

            {/* Fecha + Categoría side by side */}
            <View style={styles.twoColRow}>
              <View style={[styles.detailCard, { flex: 1 }]}>
                <View
                  style={[
                    styles.detailIconCircle,
                    { borderRadius: metrics.detailIconBox / 2, height: metrics.detailIconBox, width: metrics.detailIconBox },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={metrics.detailIcon} color={DETAIL_COLORS.text} />
                </View>
                <View style={styles.detailCopy}>
                  <Text style={[styles.detailLabel, { fontSize: metrics.detailLabel, lineHeight: metrics.detailLabelLine }]}>Fecha</Text>
                  <Text style={[styles.detailValue, { fontSize: metrics.detailValue - 1, lineHeight: metrics.detailValueLine }]}>
                    {formatDateShort(transaction.date)}
                  </Text>
                </View>
              </View>
              <View style={styles.colDivider} />
              <View style={[styles.detailCard, { flex: 1 }]}>
                <View
                  style={[
                    styles.detailIconCircle,
                    { borderRadius: metrics.detailIconBox / 2, height: metrics.detailIconBox, width: metrics.detailIconBox },
                  ]}
                >
                  <Ionicons name={category.icon} size={metrics.detailIcon} color={DETAIL_COLORS.text} />
                </View>
                <View style={styles.detailCopy}>
                  <Text style={[styles.detailLabel, { fontSize: metrics.detailLabel, lineHeight: metrics.detailLabelLine }]}>Categoría</Text>
                  <Text style={[styles.detailValue, { fontSize: metrics.detailValue - 1, lineHeight: metrics.detailValueLine }]}>
                    {formatCategoryDetailLabel(category.label)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.separator} />

            {/* Nota row */}
            {noteEditing ? (
              <View style={[styles.detailCard, { paddingHorizontal: metrics.detailPadX, paddingVertical: metrics.detailPadY, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
                <TextInput
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="Escribe una nota…"
                  placeholderTextColor={DETAIL_COLORS.secondary}
                  multiline
                  autoFocus
                  style={[styles.noteInput, { fontSize: metrics.detailValue }]}
                />
                <View style={styles.noteEditorActions}>
                  <Pressable onPress={() => runAfterKeyboardDismiss(cancelNote)} style={({ pressed }) => [styles.noteBtn, pressed && styles.pressed]}>
                    <Text style={styles.noteBtnCancel}>Cancelar</Text>
                  </Pressable>
                  <Pressable onPress={() => runAfterKeyboardDismiss(saveNote)} style={({ pressed }) => [styles.noteBtn, styles.noteBtnSave, pressed && styles.pressed]}>
                    <Text style={styles.noteBtnSaveText}>Guardar</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={currentNote ? openNoteEditor : undefined}
                style={({ pressed }) => [styles.detailCard, { paddingHorizontal: metrics.detailPadX, paddingVertical: metrics.detailPadY }, currentNote && pressed && styles.pressed]}
              >
                <View style={[styles.detailIconCircle, { borderRadius: metrics.detailIconBox / 2, height: metrics.detailIconBox, width: metrics.detailIconBox }]}>
                  <Ionicons name="document-text-outline" size={metrics.detailIcon} color={DETAIL_COLORS.text} />
                </View>
                <View style={styles.detailCopy}>
                  <Text style={[styles.detailLabel, { fontSize: metrics.detailLabel, lineHeight: metrics.detailLabelLine }]}>Nota</Text>
                  {currentNote ? (
                    <Text style={[styles.detailValue, { fontSize: metrics.detailValue - 1, lineHeight: metrics.detailValueLine }]} numberOfLines={3}>{currentNote}</Text>
                  ) : (
                    <Text style={[styles.detailValue, styles.detailValueMuted, { fontSize: metrics.detailValue - 1 }]}>Sin nota</Text>
                  )}
                </View>
                {!currentNote && (
                  <Pressable onPress={openNoteEditor} style={({ pressed }) => [styles.addNoteBtn, pressed && styles.pressed]}>
                    <Text style={styles.addNoteBtnText}>Agregar</Text>
                  </Pressable>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              gap: metrics.footerGap,
              paddingHorizontal: metrics.pagePad,
              paddingTop: metrics.footerTop,
            },
          ]}
        >
          <Pressable
            onPress={() => onEdit(transaction)}
            style={({ pressed }) => [
              styles.actionButton,
              {
                borderRadius: metrics.actionRadius,
                gap: metrics.actionGap,
                height: metrics.actionHeight,
                paddingHorizontal: metrics.actionPadX,
              },
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="square-edit-outline" size={metrics.actionIcon} color={DETAIL_COLORS.actionText} />
            <Text style={[styles.actionText, { fontSize: metrics.actionText }]} numberOfLines={1} adjustsFontSizeToFit>
              Editar
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onDelete(transaction)}
            style={({ pressed }) => [
              styles.actionButton,
              styles.deleteButton,
              {
                borderRadius: metrics.actionRadius,
                gap: metrics.actionGap,
                height: metrics.actionHeight,
                paddingHorizontal: metrics.actionPadX,
              },
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={metrics.actionIcon} color={DETAIL_COLORS.expense} />
            <Text
              style={[styles.actionText, styles.deleteText, { fontSize: metrics.actionText }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Eliminar
            </Text>
          </Pressable>
        </View>
      </View>
      </View>
    </Modal>
  );
}

function DetailRow({
  icon,
  leading,
  label,
  metrics,
  value = '',
  italic = false,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  leading?: ReactNode;
  label: string;
  metrics: DetailMetrics;
  value?: string;
  italic?: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      style={[
        styles.detailCard,
        {
          gap: metrics.detailGap,
          minHeight: metrics.detailRowHeight,
          paddingHorizontal: metrics.detailPadX,
          paddingVertical: metrics.detailPadY,
        },
      ]}
    >
      <View style={[styles.detailLeading, { width: metrics.leadingWidth }]}>
        {leading ?? (
          <View
            style={[
              styles.detailIconCircle,
              {
                borderRadius: metrics.detailIconBox / 2,
                height: metrics.detailIconBox,
                width: metrics.detailIconBox,
              },
            ]}
          >
            <Ionicons name={icon ?? 'ellipse-outline'} size={metrics.detailIcon} color={theme.textPrimary} />
          </View>
        )}
      </View>
      <View style={styles.detailCopy}>
        <Text
          style={[
            styles.detailLabel,
            !value && styles.detailLabelOnly,
            {
              fontSize: value ? metrics.detailLabel : metrics.detailValue,
              lineHeight: value ? metrics.detailLabelLine : metrics.detailValueLine,
            },
          ]}
        >
          {label}
        </Text>
        {value ? (
          <Text
            style={[
              styles.detailValue,
              { fontSize: metrics.detailValue, lineHeight: metrics.detailValueLine },
              italic && styles.detailValueMuted,
            ]}
            numberOfLines={3}
          >
            {value}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function getTransactionTypeLabel(type: Transaction['type']): string {
  if (type === 'monthly') return 'Mensual';
  if (type === 'weekly') return 'Semanal';
  if (type === 'biweekly') return 'Bi semanal';
  return 'Único';
}

function getTransactionTypeIcon(type: Transaction['type']) {
  if (type === 'monthly') return 'refresh-outline';
  if (type === 'weekly') return 'calendar-outline';
  if (type === 'biweekly') return 'git-compare-outline';
  return 'radio-button-on-outline';
}

function formatCategoryDetailLabel(label: string): string {
  const accents: Record<string, string> = {
    Inversion: 'Inversión',
    Medico: 'Médico',
    Nomina: 'Nómina',
    Reparacion: 'Reparación',
    Suscripcion: 'Suscripción',
    Tecnologia: 'Tecnología',
  };
  return accents[label] ?? label;
}

type DetailMetrics = ReturnType<typeof getResponsiveMetrics>;

const MAX_CONTENT_WIDTH = 430;

function getResponsiveMetrics(width: number, height: number, topInset: number, bottomInset: number) {
  const contentWidth = Math.min(Math.max(width, 320), MAX_CONTENT_WIDTH);
  const compact = contentWidth < 380;
  const tiny = contentWidth < 345;
  const sheetMaxHeight = Math.max(320, height - Math.max(topInset, 14) - 10);
  const footerReserve = tiny ? 74 : compact ? 78 : 82;
  const headerReserve = tiny ? 78 : compact ? 84 : 90;

  return {
    actionGap: tiny ? 5 : compact ? 7 : 8,
    actionHeight: tiny ? 46 : compact ? 48 : 52,
    actionIcon: tiny ? 19 : compact ? 20 : 22,
    actionPadX: tiny ? 6 : compact ? 8 : 10,
    actionRadius: 12,
    actionText: tiny ? 12 : compact ? 13 : 14,
    amount: tiny ? 34 : compact ? 38 : 42,
    amountCardHeight: tiny ? 132 : compact ? 142 : 158,
    amountGap: tiny ? 16 : compact ? 18 : 22,
    amountLine: tiny ? 42 : compact ? 46 : 50,
    amountPadX: tiny ? 16 : 20,
    amountPadY: tiny ? 22 : compact ? 24 : 28,
    avatar: tiny ? 40 : compact ? 42 : 44,
    avatarText: tiny ? 17 : 18,
    backButton: tiny ? 38 : 42,
    backIcon: tiny ? 27 : compact ? 29 : 31,
    badgeGap: tiny ? 6 : 7,
    badgeHeight: tiny ? 30 : 32,
    badgeIcon: tiny ? 15 : 16,
    badgeMinWidth: tiny ? 82 : 90,
    badgePadX: tiny ? 12 : 14,
    badgeText: tiny ? 11 : 12,
    chevron: tiny ? 20 : 22,
    detailGap: tiny ? 8 : 10,
    detailIcon: tiny ? 16 : compact ? 17 : 18,
    detailIconBox: tiny ? 30 : compact ? 32 : 34,
    detailLabel: tiny ? 12 : 13,
    detailLabelLine: tiny ? 17 : 18,
    detailPadX: tiny ? 14 : compact ? 16 : 20,
    detailPadY: tiny ? 12 : compact ? 13 : 14,
    detailRowHeight: tiny ? 64 : compact ? 68 : 72,
    detailValue: tiny ? 15 : compact ? 16 : 17,
    detailValueLine: tiny ? 21 : compact ? 22 : 23,
    footerGap: tiny ? 8 : 10,
    footerTop: tiny ? 10 : 12,
    headerBottom: tiny ? 12 : compact ? 14 : 16,
    headerGap: tiny ? 11 : compact ? 13 : 15,
    headerTop: tiny ? 14 : 16,
    leadingWidth: tiny ? 48 : compact ? 52 : 56,
    pagePad: tiny ? 14 : 16,
    scrollBottom: tiny ? 8 : 10,
    scrollMaxHeight: sheetMaxHeight - headerReserve - footerReserve - Math.max(bottomInset, 12),
    sectionGap: tiny ? 12 : compact ? 13 : 14,
    sheetMaxHeight,
    subtitle: 12,
    subtitleLine: 17,
    title: tiny ? 20 : 21,
    titleLine: tiny ? 25 : 27,
  };
}

const makeStyles = (theme: AppTheme) => {
  const DETAIL_COLORS = {
    background: theme.background,
    card: theme.surface,
    cardBorder: theme.border,
    cardShadow: theme.shadowColor,
    text: theme.textPrimary,
    secondary: theme.textSecondary,
    muted: theme.textMuted,
    iconBg: theme.softSurface,
    actionBg: theme.mode === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255, 255, 255, 0.075)',
    actionText: theme.textSecondary,
    expense: theme.expense,
    income: theme.income,
    orange: '#F97316',
  };

  return StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: DETAIL_COLORS.actionBg,
    borderColor: DETAIL_COLORS.cardBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    flex: 1,
    gap: 11,
    height: 54,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 10,
  },
  actionText: {
    color: DETAIL_COLORS.actionText,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '400',
  },
  amount: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 42,
    letterSpacing: 0,
    lineHeight: 52,
    maxWidth: '92%',
    textAlign: 'center',
  },
  amountCard: {
    alignItems: 'center',
    gap: 24,
    minHeight: 158,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  backButton: {
    alignItems: 'center',
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  badge: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 9,
    height: 36,
    justifyContent: 'center',
    minWidth: 94,
    paddingHorizontal: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  card: {
    alignSelf: 'center',
    backgroundColor: DETAIL_COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    maxWidth: MAX_CONTENT_WIDTH,
    width: '100%',
  },
  contactAvatar: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  contactInitials: {
    fontSize: 20,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 89, 104, 0.12)',
    borderColor: 'rgba(255, 89, 104, 0.24)',
    borderWidth: 1,
  },
  deleteText: {
    color: DETAIL_COLORS.expense,
  },
  detailCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  detailIconCircle: {
    alignItems: 'center',
    backgroundColor: DETAIL_COLORS.iconBg,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  detailLabel: {
    color: DETAIL_COLORS.secondary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  detailLabelOnly: {
    color: DETAIL_COLORS.text,
    fontWeight: '400',
  },
  detailLeading: {
    width: 58,
  },
  detailCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailList: {
    alignSelf: 'center',
    backgroundColor: DETAIL_COLORS.card,
    borderRadius: 16,
    maxWidth: MAX_CONTENT_WIDTH,
    overflow: 'hidden',
    width: '100%',
  },
  separator: {
    backgroundColor: DETAIL_COLORS.cardBorder,
    height: 1,
  },
  twoColRow: {
    flexDirection: 'row',
  },
  colDivider: {
    alignSelf: 'stretch',
    backgroundColor: DETAIL_COLORS.cardBorder,
    width: 1,
  },
  userRow: {
    gap: 12,
  },
  userNameText: {
    color: DETAIL_COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  detailValue: {
    color: DETAIL_COLORS.text,
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 25,
  },
  detailValueMuted: {
    color: DETAIL_COLORS.secondary,
    fontStyle: 'italic',
    fontWeight: '400',
  },
  expenseBadge: {
    backgroundColor: 'rgba(255, 89, 104, 0.20)',
  },
  footer: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    width: '100%',
  },
  header: {
    alignItems: 'flex-start',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 17,
    paddingBottom: 28,
    paddingHorizontal: 16,
    width: '100%',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
    paddingTop: 4,
  },
  incomeBadge: {
    backgroundColor: 'rgba(57, 210, 125, 0.18)',
  },
  pressed: {
    opacity: 0.65,
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    alignItems: 'center',
    gap: 24,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  subtitle: {
    color: DETAIL_COLORS.secondary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 1,
  },
  sheet: {
    alignSelf: 'center',
    backgroundColor: DETAIL_COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingTop: 2,
    width: '100%',
  },
  title: {
    color: DETAIL_COLORS.text,
    fontSize: 28,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
    letterSpacing: 0,
    lineHeight: 34,
  },
  typeBadge: {
    backgroundColor: 'rgba(255, 148, 56, 0.20)',
  },
  addNoteBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
    borderColor: DETAIL_COLORS.cardBorder,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addNoteBtnText: {
    color: DETAIL_COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  noteInput: {
    color: DETAIL_COLORS.text,
    lineHeight: 22,
    minHeight: 56,
    textAlignVertical: 'top',
    width: '100%',
  },
  noteEditorActions: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  noteBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noteBtnCancel: {
    color: DETAIL_COLORS.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  noteBtnSave: {
    backgroundColor: theme.blue,
  },
  noteBtnSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  });
};
