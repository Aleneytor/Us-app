import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppModal as Modal } from '../components/AppModal';
import { ModalScreen } from '../components/ModalScreen';
import { getIconColor, type AppTheme } from '../constants/colors';
import { CATEGORIES } from '../constants/categories';
import { SURFACE_SHADOW } from '../constants/shadows';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import { CURRENCIES } from '../types';
import type { BudgetCategory, CurrencyCode, Transaction } from '../types';
import { fmt, parseAmt, todayStr } from '../utils/format';
import { calcBudgetCategorySpending } from '../utils/calculations';
import { getTransactionAmountForMonth } from '../utils/filters';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../contexts/ThemeContext';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { BudgetCategoryModal } from './BudgetCategoryModal';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';

interface TransactionModalProps {
  visible: boolean;
  transaction?: Transaction | null;
  initialKind?: 'expense' | 'income';
  kindPreset?: boolean;
  initialBudgetCatId?: number;
  budgetCategoryLocked?: boolean;
  onClose: () => void;
}

const CURRENCY_NAMES: Record<string, string> = {
  EUR: 'euros',
  USD: 'dólares',
  BS: 'bolívares',
  COP: 'pesos',
};

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
const TRANSACTION_ACCENT = '#7C3AED';

export function TransactionModal({
  visible,
  transaction,
  initialKind = 'expense',
  kindPreset = false,
  initialBudgetCatId,
  budgetCategoryLocked = false,
  onClose,
}: TransactionModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const currency = useAppStore((s) => s.currency);
  const payload = useAppStore((s) => s.payload);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const budgetCategories = useMemo(() => {
    const all = payload.budgetCategories ?? [];
    return all.filter((bc) => bc.uid === undefined || bc.uid === currentUser);
  }, [payload.budgetCategories, currentUser]);

  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [date, setDate] = useState(todayStr());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarYM, setCalendarYM] = useState(todayStr().slice(0, 7));
  const [type, setType] = useState<Transaction['type'] | null>(null);
  const [budgetCatId, setBudgetCatId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [createBudgetCategoryOpen, setCreateBudgetCategoryOpen] = useState(false);
  const notesScroll = useKeyboardAwareScroll();
  const editing = !!transaction;

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setKind(transaction?.kind ?? initialKind);
    setDesc(transaction?.desc ?? '');
    setAmt(transaction ? String(transaction.amt) : '');
    setDate(transaction?.date ?? todayStr());
    setType(transaction?.type ?? null);
    setCalendarOpen(false);
    setCalendarYM((transaction?.date ?? todayStr()).slice(0, 7));
    setBudgetCatId(transaction?.budgetCatId ?? initialBudgetCatId ?? null);
    setNotes(transaction?.notes ?? '');
    setCreateBudgetCategoryOpen(false);
  }, [initialBudgetCatId, initialKind, transaction, visible]);

  const amountNumber = useMemo(() => parseAmt(amt), [amt]);
  const calendarDays = useMemo(() => getCalendarDays(calendarYM), [calendarYM]);
  const selectedBudgetCategory = useMemo(() => {
    const all = payload.budgetCategories ?? [];
    return all.find((bc) => bc.id === budgetCatId) ?? null;
  }, [budgetCatId, payload.budgetCategories]);
  const finalStepLabel = budgetCategoryLocked ? 'Confirmar' : 'Categoría';
  const breadcrumbs = kindPreset
    ? ['Título', 'Fecha', finalStepLabel]
    : ['Tipo', 'Fecha', finalStepLabel];

  const goNext = () => {
    if (step === 0 && !desc.trim()) {
      Alert.alert('Falta título', 'Ponle un título al movimiento.');
      return;
    }
    if (step === 0 && (!Number.isFinite(amountNumber) || amountNumber <= 0)) {
      Alert.alert('Monto invalido', 'Escribe un monto mayor a cero.');
      return;
    }
    if (step === 1 && !date.trim()) {
      Alert.alert('Fecha requerida', 'Elige la fecha del movimiento.');
      return;
    }
    if (step === 1 && !type) {
      Alert.alert('Frecuencia requerida', 'Elige cada cuanto ocurre este movimiento.');
      return;
    }
    setStep((value) => Math.min(2, value + 1));
  };

  const goBack = () => {
    dismissKeyboardAndBlur();
    setCalendarOpen(false);
    setStep((value) => Math.max(0, value - 1));
  };

  const goToPreviousStep = (nextStep: number) => {
    if (nextStep >= step) return;
    dismissKeyboardAndBlur();
    setCalendarOpen(false);
    setStep(nextStep);
  };

  const changeCalendarMonth = (direction: -1 | 1) => {
    const [year, month] = calendarYM.split('-').map(Number);
    const next = new Date(year, month - 1 + direction, 1);
    setCalendarYM(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const selectDate = (nextDate: string) => {
    setDate(nextDate);
    setCalendarOpen(false);
  };

  const save = () => {
    if (!desc.trim() || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      Alert.alert('Datos incompletos', 'Revisa el título y el monto.');
      return;
    }
    if (!date.trim()) {
      Alert.alert('Fecha requerida', 'Elige la fecha del movimiento.');
      return;
    }
    if (!type) {
      Alert.alert('Frecuencia requerida', 'Elige cada cuanto ocurre este movimiento.');
      return;
    }

    const selectedBudgetCat = budgetCategories.find((bc) => bc.id === budgetCatId) ?? null;
    const cat = selectedBudgetCat?.icon ?? transaction?.cat ?? 'food';
    const iconColor = selectedBudgetCat?.iconColor ?? transaction?.iconColor ?? 'blue';

    const next: Transaction = {
      id: transaction?.id ?? Date.now(),
      uid: transaction?.uid ?? currentUser,
      cat,
      iconColor,
      desc: desc.trim(),
      account: transaction?.account ?? '',
      amt: amountNumber,
      date: date.trim(),
      type,
      kind,
      notes: notes.trim(),
      del: transaction?.del,
      paid: transaction?.paid,
      paidAt: transaction?.paidAt,
      budgetCatId: budgetCatId ?? undefined,
    };

    let willExceedBudget = false;
    if (selectedBudgetCat && selectedBudgetCat.monthlyBudget > 0 && kind === 'expense') {
      const currentSpending = calcBudgetCategorySpending(payload, selectedBudgetCat.id, currentUser, selectedYM);
      const oldAmt = editing && transaction ? getTransactionAmountForMonth(transaction, selectedYM) : 0;
      const previewTransaction = { ...transaction, amt: amountNumber, date: date.trim(), type, kind } as Transaction;
      const newTotal = currentSpending - oldAmt + getTransactionAmountForMonth(previewTransaction, selectedYM);
      willExceedBudget = newTotal > selectedBudgetCat.monthlyBudget;
    }

    if (editing) updateTransaction(next);
    else addTransaction(next);

    onClose();

    if (willExceedBudget && selectedBudgetCat) {
      setTimeout(() => {
        Alert.alert(
          'Límite excedido',
          `Has excedido el límite de "${selectedBudgetCat.name}" para este mes.`,
        );
      }, 350);
    }
  };

  const handleBudgetCategoryCreated = (category: BudgetCategory) => {
    setBudgetCatId(category.id);
    setStep(2);
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <ModalScreen
        title={editing ? 'Editar movimiento' : kindPreset ? (kind === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto') : 'Nuevo movimiento'}
        breadcrumbs={breadcrumbs}
        activeBreadcrumb={step}
        canPressBreadcrumb={(index) => index < step}
        onBreadcrumbPress={goToPreviousStep}
        onBack={onClose}
        accentColor={kind === 'income' ? '#16A34A' : '#EC1147'}
        contentContainerStyle={{ padding: 0 }}
        footer={(
          <>
            <Pressable
              disabled={step === 0}
              onPress={goBack}
              style={[styles.secondaryButton, step === 0 && styles.secondaryButtonDisabled]}
            >
              <Text style={[styles.secondaryText, step === 0 && styles.secondaryTextDisabled]}>
                Atrás
              </Text>
            </Pressable>
            <Pressable onPress={() => runAfterKeyboardDismiss(step === 2 ? save : goNext)} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{step === 2 ? 'Guardar' : 'Siguiente'}</Text>
            </Pressable>
          </>
        )}
      >
          <ScrollView
            ref={notesScroll.scrollRef}
            style={styles.scroller}
            contentContainerStyle={[
              styles.content,
              notesScroll.bottomPadding !== undefined && { paddingBottom: notesScroll.bottomPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={dismissKeyboardAndBlur}
          >
            {step === 0 && !kindPreset ? (
              <View style={styles.block}>
                <Text style={styles.label}>Tipo</Text>
                <View style={styles.choiceRow}>
                  <Choice label="Gasto" active={kind === 'expense'} tone="expense" onPress={() => setKind('expense')} />
                  <Choice label="Ingreso" active={kind === 'income'} tone="income" onPress={() => setKind('income')} />
                </View>
                <Field label="Título del movimiento" value={desc} onChangeText={setDesc} placeholder="Ej. Supermercado" />
                <AmountField
                  value={amt}
                  onChangeText={setAmt}
                  currencyLabel={CURRENCY_NAMES[currency] ?? CURRENCIES[currency].code}
                />
              </View>
            ) : null}

            {step === 0 && kindPreset ? (
              <View style={styles.block}>
                <Field label="Título del movimiento" value={desc} onChangeText={setDesc} placeholder={kind === 'income' ? 'Ej. Salario' : 'Ej. Supermercado'} />
                <AmountField
                  value={amt}
                  onChangeText={setAmt}
                  currencyLabel={CURRENCY_NAMES[currency] ?? CURRENCIES[currency].code}
                />
              </View>
            ) : null}

            {step === 1 ? (
              <View style={styles.block}>
                <DatePickerField
                  value={date}
                  calendarYM={calendarYM}
                  calendarOpen={calendarOpen}
                  days={calendarDays}
                  description={kind === 'income' ? 'Selecciona la fecha en la que recibes este ingreso.' : 'Selecciona la fecha en la que hiciste este gasto.'}
                  onToggle={() => {
                    dismissKeyboardAndBlur();
                    setCalendarOpen((value) => !value);
                  }}
                  onPrevMonth={() => changeCalendarMonth(-1)}
                  onNextMonth={() => changeCalendarMonth(1)}
                  onSelectDate={selectDate}
                />
                <Text style={styles.label}>Frecuencia</Text>
                <View style={styles.frequencyGrid}>
                  <View style={styles.frequencyRow}>
                  <Choice
                    label="Único"
                    activeColor="#F97316"
                    customIcon={<MaterialCommunityIcons name="star-four-points" size={15} color={type === 'once' ? '#FFFFFF' : '#F97316'} />}
                    active={type === 'once'}
                    onPress={() => setType('once')}
                  />
                  <Choice
                    label="Semanal"
                    icon="calendar-outline"
                    activeColor="#7C3AED"
                    active={type === 'weekly'}
                    onPress={() => setType('weekly')}
                  />
                  </View>
                  <View style={styles.frequencyRow}>
                  <Choice
                    label="Bi semanal"
                    icon="git-compare-outline"
                    activeColor="#7C3AED"
                    active={type === 'biweekly'}
                    onPress={() => setType('biweekly')}
                  />
                  <Choice
                    label="Mensual"
                    icon="refresh-outline"
                    activeColor="#7C3AED"
                    active={type === 'monthly'}
                    onPress={() => setType('monthly')}
                  />
                  </View>
                </View>
              </View>
            ) : null}

            {step === 2 ? (
              <View style={styles.block}>
                {budgetCategoryLocked ? (
                  <>
                    <Text style={styles.label}>Categoría confirmada</Text>
                    {selectedBudgetCategory ? (
                      <ConfirmedBudgetCategory
                        category={selectedBudgetCategory}
                        spent={calcBudgetCategorySpending(payload, selectedBudgetCategory.id, currentUser, selectedYM)}
                        currency={currency}
                      />
                    ) : (
                      <View style={styles.noCategoriesBox}>
                        <Ionicons name="pie-chart-outline" size={22} color={theme.textMuted} />
                        <Text style={styles.noCategoriesText}>
                          Esta categoría ya no está disponible.
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Categoría de presupuesto</Text>
                    {budgetCategories.length === 0 ? (
                      <View style={styles.noCategoriesBox}>
                        <Ionicons name="pie-chart-outline" size={22} color={theme.textMuted} />
                        <Text style={styles.noCategoriesText}>
                          Aún no tienes categorías de presupuesto.{'\n'}Créalas desde el inicio.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.budgetCatList}>
                        {budgetCategories.map((bc) => (
                          <BudgetCatOption
                            key={bc.id}
                            label={bc.name}
                            icon={bc.icon}
                            colorId={bc.iconColor}
                            active={budgetCatId === bc.id}
                            spent={calcBudgetCategorySpending(payload, bc.id, currentUser, selectedYM)}
                            budget={bc.monthlyBudget}
                            currency={currency}
                            onPress={() => setBudgetCatId(bc.id)}
                           />
                        ))}
                        <BudgetCatOption
                          label="Sin categoría"
                          icon="close-circle-outline"
                          colorId="slate"
                          active={budgetCatId === null}
                          onPress={() => setBudgetCatId(null)}
                        />
                      </View>
                    )}
                    <Pressable
                      onPress={() => {
                        dismissKeyboardAndBlur();
                        setCreateBudgetCategoryOpen(true);
                      }}
                      style={({ pressed }) => [styles.createCategoryButton, pressed && styles.pressed]}
                    >
                      <Ionicons name="add" size={17} color={theme.textSecondary} />
                      <Text style={styles.createCategoryText}>Crear categoría</Text>
                    </Pressable>
                  </>
                )}
                <Field
                  label="Notas"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={budgetCategoryLocked ? 'Agrega una nota si quieres' : 'Opcional'}
                  multiline
                  onFocus={notesScroll.onFocus}
                  onBlur={notesScroll.onBlur}
                />
              </View>
            ) : null}
          </ScrollView>
      </ModalScreen>
      <BudgetCategoryModal
        visible={createBudgetCategoryOpen}
        onClose={() => setCreateBudgetCategoryOpen(false)}
        onSaved={handleBudgetCategoryCreated}
      />
    </Modal>
  );
}

function Field({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isMultiline = !!props.multiline;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        multiline={isMultiline}
        numberOfLines={isMultiline ? undefined : 1}
        placeholderTextColor={theme.textMuted}
        style={[styles.input, isMultiline && styles.textarea]}
        {...props}
      />
    </View>
  );
}

function AmountField({
  value,
  onChangeText,
  currencyLabel,
}: {
  value: string;
  onChangeText: (value: string) => void;
  currencyLabel: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.amountField}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        returnKeyType="done"
        onSubmitEditing={dismissKeyboardAndBlur}
        placeholder="0"
        placeholderTextColor={theme.textMuted}
        selectTextOnFocus
        style={styles.amountInput}
      />
      <Text style={styles.amountCurrency}>{currencyLabel}</Text>
    </View>
  );
}

function DatePickerField({
  value,
  calendarYM,
  calendarOpen,
  days,
  description,
  onToggle,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: {
  value: string;
  calendarYM: string;
  calendarOpen: boolean;
  days: Array<{ date: string; day: number; inMonth: boolean }>;
  description: string;
  onToggle: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [year, month] = calendarYM.split('-').map(Number);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Fecha</Text>
      <Text style={styles.fieldDescription}>{description}</Text>
      <Pressable onPress={onToggle} style={({ pressed }) => [styles.dateInput, pressed && styles.pressed]}>
        <Text style={styles.dateText}>{formatDateForDisplay(value)}</Text>
        <Ionicons name="calendar-outline" size={20} color={theme.textPrimary} />
      </Pressable>

      {calendarOpen ? (
        <View style={styles.calendar}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={onPrevMonth} style={styles.calendarNavButton}>
              <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
            </Pressable>
            <Text style={styles.calendarTitle}>{MONTH_NAMES[month - 1]} {year}</Text>
            <Pressable onPress={onNextMonth} style={styles.calendarNavButton}>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
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

function ConfirmedBudgetCategory({
  category,
  spent,
  currency,
}: {
  category: BudgetCategory;
  spent: number;
  currency: CurrencyCode;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const colorSet = getIconColor(category.iconColor);
  const iconInfo = CATEGORIES[category.icon];
  const hasBudget = category.monthlyBudget > 0;

  return (
    <View style={[styles.confirmedCategoryBox, { borderColor: colorSet.color }]}>
      <View style={[styles.confirmedCategoryIcon, { backgroundColor: colorSet.bg }]}>
        <Ionicons
          name={iconInfo?.icon ?? 'ellipsis-horizontal-outline'}
          size={18}
          color={colorSet.color}
        />
      </View>
      <View style={styles.confirmedCategoryContent}>
        <Text style={styles.confirmedCategoryName}>{category.name}</Text>
        <Text style={styles.confirmedCategoryMeta}>
          {hasBudget
            ? `${fmt(spent, currency)} / ${fmt(category.monthlyBudget, currency)} este mes`
            : 'Sin presupuesto mensual'}
        </Text>
      </View>
      <Ionicons name="checkmark-circle" size={19} color={colorSet.color} />
    </View>
  );
}

function BudgetCatOption({
  label,
  icon,
  colorId,
  active,
  spent,
  budget,
  currency,
  onPress,
}: {
  label: string;
  icon: string;
  colorId: string;
  active: boolean;
  spent?: number;
  budget?: number;
  currency?: CurrencyCode;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const colorSet = getIconColor(colorId);
  const iconInfo = CATEGORIES[icon];
  const hasSpending = spent !== undefined && budget !== undefined && currency !== undefined;
  const isOver = hasSpending && spent > budget!;
  const pct = hasSpending && budget! > 0 ? Math.min(1, spent / budget!) : 0;
  const barColor = pct >= 1 ? '#DC2626' : pct >= 0.75 ? '#EA580C' : '#16A34A';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.budgetCatOption,
        active && { borderColor: colorSet.color },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.budgetCatIcon, { backgroundColor: active ? colorSet.bg : theme.softSurface }]}>
        <Ionicons
          name={iconInfo?.icon ?? 'ellipsis-horizontal-outline'}
          size={16}
          color={active ? colorSet.color : theme.textMuted}
        />
      </View>
      <View style={styles.budgetCatContent}>
        <Text style={[styles.budgetCatLabel, active && { color: colorSet.color, fontWeight: '700' }]}>
          {label}
        </Text>
        {hasSpending && (
          <View style={styles.budgetCatMeta}>
            <View style={styles.budgetCatBarTrack}>
              <View style={[styles.budgetCatBarFill, { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={[styles.budgetCatSpent, isOver && styles.budgetCatOver]}>
              {fmt(spent!, currency!)} <Text style={styles.budgetCatOf}>/ {fmt(budget!, currency!)}</Text>
            </Text>
          </View>
        )}
      </View>
      {active && (
        <Ionicons name="checkmark-circle" size={16} color={colorSet.color} />
      )}
    </Pressable>
  );
}

function Choice({
  label,
  icon,
  customIcon,
  active,
  tone,
  activeColor,
  onPress,
}: {
  label: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  customIcon?: React.ReactNode;
  active: boolean;
  tone?: 'income' | 'expense';
  activeColor?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const color = activeColor ?? (tone === 'income' ? theme.income : tone === 'expense' ? theme.expense : theme.blue);

  const handlePress = () => {
    void Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.choice,
        active && { backgroundColor: color, borderColor: color },
        pressed && styles.pressed,
      ]}
    >
      {customIcon ?? (icon ? <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : color} /> : null)}
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
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
  amountCurrency: {
    color: t.textSecondary,
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  amountField: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 132,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  amountInput: {
    color: t.textPrimary,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 48,
    lineHeight: 56,
    minHeight: 64,
    padding: 0,
    textAlign: 'center',
    width: '100%',
  },
  block: {
    gap: 20,
  },
  budgetCatBarFill: {
    borderRadius: 3,
    height: '100%',
  },
  budgetCatBarTrack: {
    backgroundColor: t.border,
    borderRadius: 3,
    height: 4,
    overflow: 'hidden',
    width: '100%',
  },
  budgetCatContent: {
    flex: 1,
    gap: 4,
  },
  budgetCatIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  budgetCatLabel: {
    color: t.textSecondary,
    fontSize: 13,
    fontWeight: '400',
  },
  budgetCatList: {
    gap: 6,
  },
  budgetCatMeta: {
    gap: 3,
  },
  budgetCatOf: {
    color: t.textMuted,
    fontWeight: '400',
  },
  budgetCatOption: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  budgetCatOver: {
    color: '#DC2626',
  },
  budgetCatSpent: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  noCategoriesBox: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  noCategoriesText: {
    color: t.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  calendar: {
    backgroundColor: t.surface,
    borderRadius: 14,
    padding: 12,
    ...SURFACE_SHADOW,
  },
  calendarDay: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: '14.28%',
  },
  calendarDayActive: {
    backgroundColor: t.blue,
  },
  calendarDayMuted: {
    color: t.textMuted,
  },
  calendarDayText: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '400',
  },
  calendarDayTextActive: {
    color: '#FFFFFF',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarNavButton: {
    alignItems: 'center',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  calendarTitle: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
  choice: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceText: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '400',
  },
  choiceTextActive: {
    color: '#FFFFFF',
  },
  createCategoryButton: {
    alignItems: 'center',
    backgroundColor: t.softSurface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  createCategoryText: {
    color: t.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmedCategoryBox: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  confirmedCategoryContent: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  confirmedCategoryIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  confirmedCategoryMeta: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  confirmedCategoryName: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  card: {
    backgroundColor: t.background,
    borderRadius: 22,
    maxHeight: '96%',
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
  closeButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },
  dateInput: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderRadius: 12,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    ...SURFACE_SHADOW,
  },
  dateText: {
    color: t.textPrimary,
    fontSize: 16,
    fontWeight: '400',
  },
  field: {
    gap: 8,
  },
  fieldDescription: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '400',
    marginTop: -4,
  },
  frequencyGrid: {
    gap: 8,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  footer: {
    backgroundColor: t.surface,
    borderTopColor: t.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderBottomColor: t.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  input: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'center',
  },
  label: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  pressed: {
    opacity: 0.72,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: TRANSACTION_ACCENT,
    borderRadius: 13,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
  },
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  scroller: {
    flexShrink: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: t.border,
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.38,
  },
  secondaryText: {
    color: t.textSecondary,
    fontSize: 15,
    fontWeight: '400',
  },
  secondaryTextDisabled: {
    color: t.textMuted,
  },
  textarea: {
    lineHeight: 20,
    minHeight: 80,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  weekDay: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: '14.28%',
  },
  weekRow: {
    flexDirection: 'row',
    marginVertical: 8,
  },
});
