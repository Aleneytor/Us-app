import * as Linking from 'expo-linking';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  LayoutAnimation,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal as Modal } from '../components/AppModal';
import { CATEGORIES } from '../constants/categories';
import { type AppTheme, getIconColor } from '../constants/colors';
import { SURFACE_SHADOW } from '../constants/shadows';
import type { SavingPlan, SavingPlanHistoryEntry } from '../types';
import { savingPlanProgress, savingPlanSavedAmount } from '../utils/calculations';
import { fmt, formatDateShort, parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { getUserData } from '../utils/users';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import { useTheme } from '../contexts/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SAVINGS_ACCENT = '#7C3AED';
const SAVINGS_ACCENT_BG = 'rgba(124, 58, 237, 0.10)';
const COMPLETE_COLOR = '#16A34A';
const MAX_CONTENT_WIDTH = 430;
const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

type EntrySource = 'balance' | 'existing';

interface SavingPlanDetailModalProps {
  plan: SavingPlan | null;
  readOnly?: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function SavingPlanDetailModal({
  plan,
  readOnly = false,
  onClose,
  onEdit,
  onDelete,
}: SavingPlanDetailModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const currency = useAppStore((s) => s.currency);
  const updateSavingPlan = useAppStore((s) => s.updateSavingPlan);
  const deleteSavingPlan = useAppStore((s) => s.deleteSavingPlan);
  const users = useAppStore((s) => s.users);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const dragY = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);

  const livePlan = useAppStore((s) =>
    plan
      ? (s.payload.savings ?? []).find((saving) => String(saving.id) === String(plan.id)) ?? plan
      : null,
  );

  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayStr());
  const [entrySource, setEntrySource] = useState<EntrySource>('balance');
  const [entryOpen, setEntryOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarYM, setCalendarYM] = useState(todayStr().slice(0, 7));
  const noteScroll = useKeyboardAwareScroll();

  const entryNumber = useMemo(() => parseAmt(entryAmount), [entryAmount]);
  const calendarDays = useMemo(() => getCalendarDays(calendarYM), [calendarYM]);

  useEffect(() => {
    if (!plan) return;
    setEntryAmount('');
    setEntryDate(todayStr());
    setEntrySource('balance');
    setEntryOpen(false);
    setCalendarOpen(false);
    setCalendarYM(todayStr().slice(0, 7));
    setExpanded(false);
    dragY.setValue(0);
  }, [dragY, plan?.id]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      scrollOffsetY.current <= 0 && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      scrollOffsetY.current <= 0 && gesture.dy > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => {
      dragY.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 90 || gesture.vy > 0.9) {
        onClose();
        return;
      }
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 220,
      }).start();
    },
  }), [dragY, onClose]);

  if (!plan || !livePlan) return null;

  const saveType = livePlan.saveType ?? 'goal';
  const history = [...(livePlan.history ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const iconColor = getIconColor(livePlan.iconColor ?? 'purple');
  const iconInfo = CATEGORIES[livePlan.icon ?? 'savings'] ?? CATEGORIES.savings;
  const progress = savingPlanProgress(livePlan);
  const progressPct = Math.min(100, Math.round(progress.pct));
  const isComplete = progressPct >= 100;
  const totalSaved = savingPlanSavedAmount(livePlan);
  const scopeLabel = livePlan.type === 'personal'
    ? `Personal - ${getUserData(users, livePlan.uid ?? currentUser).name}`
    : 'Compartido';
  const availableSheetHeight = Math.max(360, height - Math.max(insets.top, 12) - 8);
  const sheetMaxHeight = expanded
    ? availableSheetHeight
    : Math.max(360, Math.min(availableSheetHeight, height * 0.84));

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollOffsetY.current = Math.max(0, offsetY);
    if (!expanded && offsetY > 12) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(true);
    }
  };

  const scrollToContributionForm = () => {
    setTimeout(() => noteScroll.scrollRef.current?.scrollToEnd({ animated: true }), 80);
    setTimeout(() => noteScroll.scrollRef.current?.scrollToEnd({ animated: true }), 260);
  };

  const toggleEntryOpen = () => {
    const nextOpen = !entryOpen;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEntryOpen(nextOpen);
    if (nextOpen) {
      setExpanded(true);
      scrollToContributionForm();
    }
  };

  const addHistoryEntry = () => {
    if (!Number.isFinite(entryNumber) || entryNumber <= 0) {
      Alert.alert('Monto invalido', 'Escribe un monto mayor a cero.');
      return;
    }

    const entry: SavingPlanHistoryEntry = {
      id: Date.now(),
      uid: currentUser,
      amount: entryNumber,
      date: entryDate.trim() || todayStr(),
      source: entrySource,
    };

    updateSavingPlan({ ...livePlan, history: [...(livePlan.history ?? []), entry] });
    setEntryAmount('');
    setEntryDate(todayStr());
    setEntrySource('balance');
    setCalendarOpen(false);
    setCalendarYM(todayStr().slice(0, 7));
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEntryOpen(false);
  };

  const changeCalendarMonth = (direction: -1 | 1) => {
    const [year, month] = calendarYM.split('-').map(Number);
    const next = new Date(year, month - 1 + direction, 1);
    setCalendarYM(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const selectEntryDate = (nextDate: string) => {
    setEntryDate(nextDate);
    setCalendarYM(nextDate.slice(0, 7));
    setCalendarOpen(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar ahorro',
      `Eliminar "${livePlan.title}" no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteSavingPlan?.(livePlan.id);
            onDelete?.();
            onClose();
          },
        },
      ],
    );
  };

  const handleShareLink = async () => {
    if (!livePlan.link) return;
    try {
      await Share.share({ message: livePlan.link, title: livePlan.title });
    } catch {
      const ok = await Linking.canOpenURL(livePlan.link);
      if (ok) await Linking.openURL(livePlan.link);
    }
  };

  const shortLink = (() => {
    try {
      return new URL(livePlan.link ?? '').hostname.replace(/^www\./, '');
    } catch {
      return livePlan.link ?? '';
    }
  })();

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <StatusBar style={theme.mode === 'light' ? 'dark' : 'light'} translucent backgroundColor="transparent" />
        <Pressable accessibilityLabel="Cerrar detalles" onPress={onClose} style={StyleSheet.absoluteFill} />

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.sheet,
            {
              maxHeight: sheetMaxHeight,
              maxWidth: MAX_CONTENT_WIDTH,
              paddingBottom: Math.max(insets.bottom, 12),
              transform: [{ translateY: dragY }],
            },
          ]}
        >
          <View style={styles.dragZone}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
            </Pressable>
            <View style={[styles.headerIcon, { backgroundColor: iconColor.color }]}>
              <Ionicons name={iconInfo.icon} size={19} color="#FFFFFF" />
            </View>
            <Text
              style={styles.title}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {livePlan.title}
            </Text>
          </View>

        <ScrollView
          ref={noteScroll.scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            noteScroll.bottomPadding !== undefined && { paddingBottom: noteScroll.bottomPadding },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={dismissKeyboardAndBlur}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.amountCard}>
            <Text style={styles.amountCardLabel}>
              {saveType === 'goal' ? 'Objetivo' : 'Total guardado'}
            </Text>
            <Text style={styles.targetAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
              {fmt(saveType === 'goal' ? livePlan.targetAmount : totalSaved, currency)}
            </Text>
            {saveType === 'goal' && (
              <View style={styles.amountProgressWrap}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressPct}%` as `${number}%` },
                      isComplete && styles.progressFillComplete,
                    ]}
                  />
                </View>
              </View>
            )}
            <View style={styles.savingSummaryRow}>
              <View style={styles.savingSummaryItem}>
                <Text style={styles.savingSummaryLabel}>Abonado</Text>
                <Text style={styles.savingSummaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
                  {fmt(totalSaved, currency)}
                </Text>
              </View>
              {saveType === 'goal' ? (
                <>
                  <View style={styles.savingSummaryDivider} />
                  <View style={[styles.savingSummaryItem, styles.savingSummaryItemRight]}>
                    <Text style={styles.savingSummaryLabel}>Falta</Text>
                    <Text
                      style={[styles.savingSummaryValue, isComplete && styles.savingSummaryComplete]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
                    >
                      {fmt(progress.remaining, currency)}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.detailList}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconCircle}>
                <Ionicons name="people-outline" size={16} color={theme.textPrimary} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Visibilidad</Text>
                <Text style={styles.detailValue}>{scopeLabel}</Text>
              </View>
            </View>

            <View style={styles.separator} />
            <View style={styles.detailRow}>
              <View style={styles.detailIconCircle}>
                <Ionicons name="calendar-outline" size={16} color={theme.textPrimary} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Creado</Text>
                <Text style={styles.detailValue}>{formatDateShort(livePlan.date)}</Text>
              </View>
            </View>

            {saveType === 'goal' && livePlan.link ? (
              <>
                <View style={styles.separator} />
                <Pressable
                  onPress={handleShareLink}
                  style={({ pressed }) => [styles.detailRow, pressed && styles.pressed]}
                >
                  <View style={styles.detailIconCircle}>
                    <Ionicons name="link-outline" size={16} color={SAVINGS_ACCENT} />
                  </View>
                  <View style={styles.detailCopy}>
                    <Text style={styles.detailLabel}>Enlace</Text>
                    <Text style={[styles.detailValue, styles.linkText]} numberOfLines={1}>{shortLink}</Text>
                  </View>
                  <Ionicons name="open-outline" size={17} color={theme.textMuted} />
                </Pressable>
              </>
            ) : null}

            <View style={styles.separator} />
            <View style={styles.detailRow}>
              <View style={styles.detailIconCircle}>
                <Ionicons name="document-text-outline" size={16} color={theme.textPrimary} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Nota</Text>
                {livePlan.notes ? (
                  <Text style={styles.detailValue}>{livePlan.notes}</Text>
                ) : (
                  <Text style={styles.detailValueMuted}>Sin nota</Text>
                )}
              </View>
            </View>
          </View>

          {!readOnly && (
            <>
              <Pressable
                onPress={toggleEntryOpen}
                style={({ pressed }) => [styles.quickAddButton, pressed && styles.pressed]}
              >
                <View style={styles.quickAddIcon}>
                  <Ionicons name={entryOpen ? 'remove' : 'add'} size={18} color="#FFFFFF" />
                </View>
                <View style={styles.quickAddTextWrap}>
                  <Text style={styles.quickAddTitle}>Agregar dinero</Text>
                </View>
                <Ionicons
                  name={entryOpen ? 'chevron-up' : 'chevron-forward'}
                  size={18}
                  color="rgba(255,255,255,0.78)"
                />
              </Pressable>

              {entryOpen && (
                <View style={styles.entryBox}>
                  <Field
                    label="Monto"
                    value={entryAmount}
                    onChangeText={setEntryAmount}
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={() => runAfterKeyboardDismiss(addHistoryEntry)}
                  />

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Fuente</Text>
                    <View style={styles.sourceRow}>
                      <SourceButton
                        label="Del balance"
                        active={entrySource === 'balance'}
                        onPress={() => setEntrySource('balance')}
                        styles={styles}
                      />
                      <SourceButton
                        label="Ahorros previos"
                        active={entrySource === 'existing'}
                        onPress={() => setEntrySource('existing')}
                        styles={styles}
                      />
                    </View>
                  </View>

                  <EntryDatePicker
                    value={entryDate}
                    calendarYM={calendarYM}
                    calendarOpen={calendarOpen}
                    days={calendarDays}
                    onToggle={() => {
                      dismissKeyboardAndBlur();
                      setCalendarOpen((open) => !open);
                    }}
                    onPrevMonth={() => changeCalendarMonth(-1)}
                    onNextMonth={() => changeCalendarMonth(1)}
                    onSelectDate={selectEntryDate}
                    styles={styles}
                    theme={theme}
                  />

                  <Pressable
                    onPress={() => runAfterKeyboardDismiss(addHistoryEntry)}
                    style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Guardar aporte</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          <Text style={styles.sectionTitle}>Aportes registrados</Text>
          {history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="cash-outline" size={18} color={theme.textMuted} />
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>Sin aportes</Text>
                <Text style={styles.emptyText}>Agrega dinero para ver el historial de este ahorro.</Text>
              </View>
            </View>
          ) : (
            <View style={styles.historyList}>
              {history.map((entry) => (
                <HistoryRow
                  key={String(entry.id)}
                  entry={entry}
                  users={users}
                  currency={currency}
                  savingIcon={iconInfo.icon}
                  savingColor={iconColor.color}
                  styles={styles}
                />
              ))}
            </View>
          )}
        </ScrollView>

          {!readOnly ? (
            <View style={styles.footer}>
              <Pressable
                onPress={handleDelete}
                style={({ pressed }) => [styles.footerActionBtn, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={22} color={theme.expense} />
                <Text style={[styles.footerActionText, { color: theme.expense }]}>Eliminar</Text>
              </Pressable>
              <Pressable
                onPress={() => { onClose(); setTimeout(() => onEdit?.(), 120); }}
                style={({ pressed }) => [styles.footerActionBtn, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="square-edit-outline" size={22} color={theme.textSecondary} />
                <Text style={styles.footerActionText}>Editar</Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

function HistoryRow({
  entry,
  users,
  currency,
  savingIcon,
  savingColor,
  styles,
}: {
  entry: SavingPlanHistoryEntry;
  users: ReturnType<typeof useAppStore.getState>['users'];
  currency: ReturnType<typeof useAppStore.getState>['currency'];
  savingIcon: ComponentProps<typeof Ionicons>['name'];
  savingColor: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const isPrevious = entry.source === 'existing';
  const user = getUserData(users, entry.uid);
  const title = isPrevious ? 'Ahorros previos' : 'Del balance';

  return (
    <View style={styles.historyCard}>
      <View style={[styles.historyIconWrap, { backgroundColor: savingColor }]}>
        <Ionicons name={savingIcon} size={22} color="#FFFFFF" />
      </View>
      <View style={styles.historyContent}>
        <Text numberOfLines={1} style={styles.historyTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.historyMetaText}>
          {user.name} - {formatDateShort(entry.date)}
        </Text>
      </View>
      <View style={styles.historyAmountBlock}>
        <Text style={styles.historyAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
          {fmt(entry.amount, currency)}
        </Text>
        <View style={[styles.historyKindIndicator, { backgroundColor: SAVINGS_ACCENT }]}>
          <Ionicons name="wallet-outline" size={15} color="#FFFFFF" />
        </View>
      </View>
    </View>
  );
}

function SourceButton({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sourceBtn, active && styles.sourceBtnActive, pressed && styles.pressed]}
    >
      <Text style={[styles.sourceBtnLabel, active && styles.sourceBtnLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function EntryDatePicker({
  value,
  calendarYM,
  calendarOpen,
  days,
  onToggle,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  styles,
  theme,
}: {
  value: string;
  calendarYM: string;
  calendarOpen: boolean;
  days: Array<{ date: string; day: number; inMonth: boolean }>;
  onToggle: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string) => void;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
}) {
  const [year, month] = calendarYM.split('-').map(Number);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Fecha</Text>
      <Pressable onPress={onToggle} style={({ pressed }) => [styles.dateInput, pressed && styles.pressed]}>
        <Text style={styles.dateText}>{formatDateForDisplay(value)}</Text>
        <Ionicons name="calendar-outline" size={18} color={theme.textPrimary} />
      </Pressable>

      {calendarOpen ? (
        <View style={styles.calendar}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={onPrevMonth} style={({ pressed }) => [styles.calendarNavButton, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={17} color={theme.textSecondary} />
            </Pressable>
            <Text style={styles.calendarTitle}>{MONTH_NAMES[month - 1]} {year}</Text>
            <Pressable onPress={onNextMonth} style={({ pressed }) => [styles.calendarNavButton, pressed && styles.pressed]}>
              <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEK_DAYS.map((day) => (
              <Text key={day} style={styles.weekDay}>{day}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {days.map((item) => {
              const active = item.date === value;
              return (
                <Pressable
                  key={item.date}
                  onPress={() => onSelectDate(item.date)}
                  style={({ pressed }) => [
                    styles.calendarDay,
                    active && styles.calendarDayActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      !item.inMonth && styles.calendarDayMuted,
                      active && styles.calendarDayTextActive,
                    ]}
                  >
                    {item.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Field({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={[styles.input, props.multiline && styles.inputMulti]}
        {...props}
      />
    </View>
  );
}

function getCalendarDays(ym: string): Array<{ date: string; day: number; inMonth: boolean }> {
  const [year, month] = ym.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    const nextYear = next.getFullYear();
    const nextMonth = next.getMonth() + 1;
    const day = next.getDate();
    return {
      date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
      inMonth: nextMonth === month,
    };
  });
}

function formatDateForDisplay(dateValue: string): string {
  if (!dateValue.includes('-')) return dateValue;
  const [year, month, day] = dateValue.split('-');
  return `${day}/${month}/${year}`;
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    alignSelf: 'center',
    backgroundColor: t.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    width: '100%',
  },
  dragZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    paddingTop: 10,
  },
  dragHandle: {
    backgroundColor: t.mode === 'light' ? 'rgba(15, 23, 42, 0.24)' : 'rgba(255,255,255,0.28)',
    borderRadius: 99,
    height: 5,
    width: 44,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  title: {
    color: t.textPrimary,
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 21,
    lineHeight: 27,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  amountCard: {
    backgroundColor: t.surface,
    borderRadius: 16,
    gap: 12,
    marginHorizontal: 16,
    minHeight: 188,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  amountCardLabel: {
    color: t.textMuted,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    textAlign: 'center',
  },
  targetAmount: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 56,
    letterSpacing: 0,
    lineHeight: 66,
    textAlign: 'center',
  },
  amountProgressWrap: {
    gap: 8,
    width: '100%',
  },
  progressTrack: {
    backgroundColor: t.border,
    borderRadius: 8,
    height: 10,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    backgroundColor: SAVINGS_ACCENT,
    borderRadius: 8,
    height: '100%',
  },
  progressFillComplete: {
    backgroundColor: COMPLETE_COLOR,
  },
  savingSummaryRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  savingSummaryItem: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  savingSummaryItemRight: {
    alignItems: 'flex-end',
  },
  savingSummaryDivider: {
    backgroundColor: t.border,
    marginHorizontal: 14,
    width: 1,
  },
  savingSummaryLabel: {
    color: t.textMuted,
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
  },
  savingSummaryValue: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 17,
    lineHeight: 22,
  },
  savingSummaryComplete: {
    color: COMPLETE_COLOR,
  },
  detailList: {
    backgroundColor: t.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailIconCircle: {
    alignItems: 'center',
    backgroundColor: t.softSurface,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  detailCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  detailLabel: {
    color: t.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 16,
  },
  detailValue: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    lineHeight: 20,
  },
  detailValueMuted: {
    color: t.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  linkText: {
    color: SAVINGS_ACCENT,
  },
  separator: {
    backgroundColor: t.border,
    height: 1,
  },
  quickAddButton: {
    alignItems: 'center',
    backgroundColor: SAVINGS_ACCENT,
    borderColor: SAVINGS_ACCENT,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickAddIcon: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  quickAddTextWrap: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  quickAddTitle: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  sectionTitle: {
    color: t.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    marginBottom: 4,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  emptyHistory: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
  },
  emptyCopy: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  emptyText: {
    color: t.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 18,
  },
  historyList: {
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  historyCard: {
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
  historyIconWrap: {
    alignItems: 'center',
    backgroundColor: SAVINGS_ACCENT,
    borderRadius: 14,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    marginRight: 2,
    width: 44,
  },
  historyContent: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  historyTitle: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  historyAmountBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginLeft: 12,
    minWidth: 96,
  },
  historyAmount: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    textAlign: 'right',
  },
  historyKindIndicator: {
    alignItems: 'center',
    backgroundColor: t.income,
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  historyMetaText: {
    color: t.textMuted,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  entryBox: {
    backgroundColor: t.surface,
    borderRadius: 16,
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: t.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: t.inputBg,
    borderColor: t.border,
    borderRadius: 10,
    borderWidth: 1,
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'center',
  },
  inputMulti: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sourceBtn: {
    alignItems: 'center',
    backgroundColor: t.inputBg,
    borderColor: t.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  sourceBtnActive: {
    backgroundColor: SAVINGS_ACCENT_BG,
    borderColor: SAVINGS_ACCENT,
  },
  sourceBtnLabel: {
    color: t.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    textAlign: 'center',
  },
  sourceBtnLabelActive: {
    color: SAVINGS_ACCENT,
  },
  dateInput: {
    alignItems: 'center',
    backgroundColor: t.inputBg,
    borderColor: t.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  dateText: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  calendar: {
    backgroundColor: t.surface,
    borderRadius: 14,
    padding: 10,
    ...SURFACE_SHADOW,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarNavButton: {
    alignItems: 'center',
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  calendarTitle: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekDay: {
    color: t.textMuted,
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    alignItems: 'center',
    borderRadius: 9,
    height: 32,
    justifyContent: 'center',
    width: '14.28%',
  },
  calendarDayActive: {
    backgroundColor: SAVINGS_ACCENT,
  },
  calendarDayText: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  calendarDayMuted: {
    color: t.textMuted,
  },
  calendarDayTextActive: {
    color: '#FFFFFF',
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: SAVINGS_ACCENT,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    height: 46,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  footerActionBtn: {
    alignItems: 'center',
    backgroundColor: t.softSurface,
    borderRadius: 14,
    flex: 1,
    flexDirection: 'row',
    gap: 11,
    height: 54,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 10,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerActionText: {
    color: t.textSecondary,
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.65,
  },
});
