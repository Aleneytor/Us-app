import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppModal as Modal } from '../components/AppModal';
import { ModalScreen } from '../components/ModalScreen';
import { CATEGORIES } from '../constants/categories';
import { type AppTheme } from '../constants/colors';
import type { Plan, PlanExpense, PlanMember, PlanSplitMode } from '../types';
import { fmt, parseAmt, todayStr } from '../utils/format';
import { computeSplits } from '../utils/planCalculations';
import { useAppStore } from '../store/useAppStore';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import { useTheme } from '../contexts/ThemeContext';

const ACCENT = '#7C3AED';
const ACCENT_BG = 'rgba(124, 58, 237, 0.18)';
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

interface PlanExpenseModalProps {
  visible: boolean;
  plan: Plan;
  expense?: PlanExpense | null;  // null/undefined = create mode
  onClose: () => void;
}

export function PlanExpenseModal({ visible, plan, expense, onClose }: PlanExpenseModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const currency = useAppStore((s) => s.currency);
  const addPlanExpense = useAppStore((s) => s.addPlanExpense);
  const updatePlanExpense = useAppStore((s) => s.updatePlanExpense);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const editing = !!expense;

  // -- Form state ------------------------------------------------------------
  const [title, setTitle] = useState('');
  const [amtText, setAmtText] = useState('');
  const [payerId, setPayerId] = useState(currentUser);
  const [payerDropdownOpen, setPayerDropdownOpen] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarYM, setCalendarYM] = useState(todayStr().slice(0, 7));
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [splitMode, setSplitMode] = useState<PlanSplitMode>('equal');
  // memberId ? parts count (mode 'parts')
  const [partsMap, setPartsMap] = useState<Record<string, number>>({});
  // memberId ? pct string (mode 'percentage')
  const [pctMap, setPctMap] = useState<Record<string, string>>({});
  // memberIds excluded from split (mode 'equal')
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  const noteScroll = useKeyboardAwareScroll();

  // Reset form when modal opens
  useEffect(() => {
    if (!visible) return;

    if (expense) {
      setTitle(expense.title);
      setAmtText(String(expense.amount).replace('.', ','));
      setPayerId(expense.memberId);
      setDate(expense.date);
      setCalendarYM(expense.date.slice(0, 7));
      setCalendarOpen(false);
      setCategoryId(expense.categoryId ?? null);
      setSplitMode(expense.splitMode);
      setNote(expense.note ?? '');
      setPayerDropdownOpen(false);

      // Rebuild partsMap / pctMap / excluded from existing splits
      const pm: Record<string, number> = {};
      const pcm: Record<string, string> = {};
      const excl = new Set<string>();
      for (const m of plan.members) {
        const split = expense.splits.find((s) => s.memberId === m.id);
        pm[m.id] = split?.parts ?? 1;
        pcm[m.id] = split?.pct != null ? String(split.pct) : String(Math.round(100 / plan.members.length));
        if (!split || split.amount === 0) excl.add(m.id);
      }
      if (expense.splitMode === 'equal') {
        // Detect excluded members from zero-amount splits
        setExcluded(excl);
      } else {
        setExcluded(new Set());
      }
      setPartsMap(pm);
      setPctMap(pcm);
    } else {
      setTitle('');
      setAmtText('');
      setPayerId(currentUser);
      setDate(todayStr());
      setCalendarYM(todayStr().slice(0, 7));
      setCalendarOpen(false);
      setCategoryId(null);
      setSplitMode('equal');
      setNote('');
      setExcluded(new Set());
      setPayerDropdownOpen(false);

      // Init parts = 1 per member, pct = even split
      const pm: Record<string, number> = {};
      const pcm: Record<string, string> = {};
      const evenPct = plan.members.length > 0
        ? Math.round(100 / plan.members.length)
        : 0;
      for (const m of plan.members) {
        pm[m.id] = 1;
        pcm[m.id] = String(evenPct);
      }
      setPartsMap(pm);
      setPctMap(pcm);
    }
  // Use primitive IDs as deps to avoid resetting the form whenever the store
  // creates a new plan/expense object reference (e.g. real-time sync). The
  // effect still re-runs when the modal opens, a different expense is loaded,
  // or a different plan is opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, expense?.id, plan.id, currentUser]);

  // -- Derived values --------------------------------------------------------
  const amount = parseAmt(amtText);
  const calendarDays = useMemo(() => getCalendarDays(calendarYM), [calendarYM]);

  const includedMembers = useMemo<PlanMember[]>(() => {
    if (splitMode === 'equal') {
      return plan.members.filter((m) => !excluded.has(m.id));
    }
    return plan.members;
  }, [plan.members, splitMode, excluded]);

  const previewSplits = useMemo(() => {
    if (!Number.isFinite(amount) || amount <= 0 || includedMembers.length === 0) return [];

    if (splitMode === 'equal') {
      return computeSplits(amount, includedMembers, 'equal', {});
    }

    if (splitMode === 'parts') {
      const params: Record<string, number> = {};
      for (const m of plan.members) params[m.id] = partsMap[m.id] ?? 1;
      return computeSplits(amount, plan.members, 'parts', params);
    }

    // percentage
    const params: Record<string, number> = {};
    for (const m of plan.members) params[m.id] = Number.parseFloat(pctMap[m.id] ?? '0') || 0;
    return computeSplits(amount, plan.members, 'percentage', params);
  }, [amount, splitMode, includedMembers, plan.members, partsMap, pctMap]);

  const pctTotal = useMemo(() => {
    return plan.members.reduce((s, m) => s + (Number.parseFloat(pctMap[m.id] ?? '0') || 0), 0);
  }, [pctMap, plan.members]);

  const payer = plan.members.find((m) => m.id === payerId) ?? plan.members[0];

  const changeCalendarMonth = (direction: -1 | 1) => {
    const [year, month] = calendarYM.split('-').map(Number);
    const next = new Date(year, month - 1 + direction, 1);
    setCalendarYM(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const selectDate = (nextDate: string) => {
    setDate(nextDate);
    setCalendarYM(nextDate.slice(0, 7));
    setCalendarOpen(false);
  };

  // -- Validation & save -----------------------------------------------------
  const validate = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Falta el título', 'Dale un nombre al gasto.');
      return false;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Monto inválido', 'Escribe un monto mayor a cero.');
      return false;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD.');
      return false;
    }
    if (splitMode === 'equal' && includedMembers.length === 0) {
      Alert.alert('Sin participantes', 'Incluye al menos un participante en la división.');
      return false;
    }
    if (splitMode === 'percentage' && Math.abs(pctTotal - 100) > 0.5) {
      Alert.alert('Porcentajes incorrectos', `Los porcentajes deben sumar 100%. Actualmente suman ${pctTotal.toFixed(0)}%.`);
      return false;
    }
    return true;
  };

  const save = () => {
    if (!validate()) return;

    const memberName = payer?.name ?? '';
    const next: PlanExpense = {
      id: expense?.id ?? Date.now(),
      categoryId: categoryId ?? undefined,
      memberId: payerId,
      memberName,
      title: title.trim(),
      amount,
      date,
      splitMode,
      splits: previewSplits,
      note: note.trim() || undefined,
    };

    if (editing) {
      updatePlanExpense(plan.id, next);
    } else {
      addPlanExpense(plan.id, next);
    }
    onClose();
  };

  const handleSave = () => {
    runAfterKeyboardDismiss(save);
  };

  // -- Parts helpers ---------------------------------------------------------
  const setParts = (memberId: string, delta: number) => {
    setPartsMap((prev) => ({
      ...prev,
      [memberId]: Math.max(1, (prev[memberId] ?? 1) + delta),
    }));
  };

  const toggleExcluded = (memberId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  // -- Render ----------------------------------------------------------------
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <ModalScreen
        title={editing ? 'Editar gasto' : 'Añadir gasto'}
        onBack={onClose}
        contentContainerStyle={{ padding: 0 }}
        footer={(
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
          >
            <Text style={styles.saveBtnText}>{editing ? 'Guardar cambios' : 'Añadir gasto'}</Text>
          </Pressable>
        )}
      >
        <ScrollView
          ref={noteScroll.scrollRef}
          style={styles.scroller}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={dismissKeyboardAndBlur}
          showsVerticalScrollIndicator={false}
        >
          {/* -- Hero Amount Card -- */}
          <View style={styles.amountCard}>
            <Text style={styles.spentSublabel}>Cantidad del gasto</Text>
            <View style={styles.amountInputRow}>
              <TextInput
                value={amtText}
                onChangeText={setAmtText}
                placeholder="0,00"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                style={styles.spentAmountInput}
              />
              <View style={styles.currencyBadgeInline}>
                <Text style={styles.currencyTextInline}>{currency}</Text>
              </View>
            </View>
          </View>

          {/* -- Detail List Card -- */}
          <View style={styles.detailList}>
            {/* Título */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconCircle}>
                <Ionicons name="document-text-outline" size={15} color={theme.textPrimary} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Título del Gasto</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ej. Cena en el centro"
                  placeholderTextColor={theme.textMuted}
                  numberOfLines={1}
                  style={styles.detailInput}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Pagado por */}
            <View style={styles.separator} />
            <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'stretch', gap: 6 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.detailIconCircle}>
                  <Ionicons name="person-outline" size={15} color={theme.textPrimary} />
                </View>
                <Text style={styles.detailLabel}>Pagado por</Text>
              </View>
              <View style={styles.payerDropdownWrap}>
                <Pressable
                  onPress={() => setPayerDropdownOpen((v) => !v)}
                  style={({ pressed }) => [styles.payerSelect, pressed && styles.pressed]}
                >
                  <View style={[styles.payerSelectAvatar, { backgroundColor: payer.bg }]}>
                    <Text style={[styles.payerSelectInitials, { color: payer.color }]}>{payer.initials}</Text>
                  </View>
                  <Text style={styles.payerSelectName} numberOfLines={1}>
                    {payer.id === currentUser ? `${payer.name} (Yo)` : payer.name}
                  </Text>
                  <Ionicons
                    name={payerDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={17}
                    color={theme.textSecondary}
                  />
                </Pressable>

                {payerDropdownOpen && (
                  <View style={styles.payerMenu}>
                    {plan.members.map((m, index) => {
                      const active = m.id === payerId;
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => {
                            setPayerId(m.id);
                            setPayerDropdownOpen(false);
                          }}
                          style={({ pressed }) => [
                            styles.payerMenuItem,
                            index > 0 && styles.payerMenuItemBorder,
                            active && styles.payerMenuItemActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={[styles.payerMenuAvatar, { backgroundColor: m.bg }]}>
                            <Text style={[styles.payerMenuInitials, { color: m.color }]}>{m.initials}</Text>
                          </View>
                          <Text style={[styles.payerMenuName, active && styles.payerMenuNameActive]} numberOfLines={1}>
                            {m.id === currentUser ? `${m.name} (Yo)` : m.name}
                          </Text>
                          {active && <Ionicons name="checkmark" size={17} color={ACCENT} />}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* Cuándo (Fecha) */}
            <View style={styles.separator} />
            <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.detailIconCircle}>
                  <Ionicons name="calendar-outline" size={15} color={theme.textPrimary} />
                </View>
                <Text style={styles.detailLabel}>Fecha</Text>
              </View>
              <View style={styles.datePickerWrap}>
                <Pressable
                  onPress={() => {
                    dismissKeyboardAndBlur();
                    setCalendarYM(date.slice(0, 7));
                    setCalendarOpen((v) => !v);
                  }}
                  style={({ pressed }) => [styles.dateSelect, pressed && styles.pressed]}
                >
                  <Text style={styles.dateSelectText}>{formatDateForDisplay(date)}</Text>
                  <Ionicons
                    name={calendarOpen ? 'chevron-up' : 'calendar-outline'}
                    size={18}
                    color={theme.textPrimary}
                  />
                </Pressable>

                {calendarOpen && (
                  <View style={styles.calendar}>
                    <View style={styles.calendarHeader}>
                      <Pressable onPress={() => changeCalendarMonth(-1)} style={({ pressed }) => [styles.calendarNavButton, pressed && styles.pressed]}>
                        <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
                      </Pressable>
                      <Text style={styles.calendarTitle}>
                        {MONTH_NAMES[Number(calendarYM.slice(5, 7)) - 1]} {calendarYM.slice(0, 4)}
                      </Text>
                      <Pressable onPress={() => changeCalendarMonth(1)} style={({ pressed }) => [styles.calendarNavButton, pressed && styles.pressed]}>
                        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                      </Pressable>
                    </View>

                    <View style={styles.weekRow}>
                      {WEEK_DAYS.map((day) => (
                        <Text key={day} style={styles.weekDay}>{day}</Text>
                      ))}
                    </View>

                    <View style={styles.calendarGrid}>
                      {calendarDays.map((item) => {
                        const active = item.date === date;
                        return (
                          <Pressable
                            key={item.date}
                            onPress={() => selectDate(item.date)}
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
                )}
              </View>
            </View>

            {/* Categoría */}
            {plan.categories.length > 0 && (
              <>
                <View style={styles.separator} />
                <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'stretch', gap: 6 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.detailIconCircle}>
                      <Ionicons name="pricetag-outline" size={15} color={theme.textPrimary} />
                    </View>
                    <Text style={styles.detailLabel}>Categoría (opcional)</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={{ paddingLeft: 42 }}>
                    <Pressable
                      onPress={() => setCategoryId(null)}
                      style={({ pressed }) => [
                        styles.catPill,
                        categoryId === null && styles.catPillActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.catPillText, categoryId === null && styles.catPillTextActive]}>
                        Sin categoría
                      </Text>
                    </Pressable>
                    {plan.categories.map((cat) => {
                      const active = categoryId === cat.id;
                      const catInfo = CATEGORIES[cat.icon] ?? CATEGORIES.map;
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={() => setCategoryId(cat.id)}
                          style={({ pressed }) => [
                            styles.catPill,
                            active && styles.catPillActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Ionicons
                            name={catInfo.icon}
                            size={13}
                            color={active ? ACCENT : theme.textSecondary}
                          />
                          <Text style={[styles.catPillText, active && styles.catPillTextActive]}>
                            {cat.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </>
            )}

            {/* División de gastos */}
            <View style={styles.separator} />
            <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'stretch', gap: 12 }]}>
              <View style={styles.splitHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.detailIconCircle}>
                    <Ionicons name="people-outline" size={15} color={theme.textPrimary} />
                  </View>
                  <Text style={styles.detailLabel}>División de Gastos</Text>
                </View>
                <View style={styles.splitModeRow}>
                  {([
                    { mode: 'equal' as const, label: 'Igual' },
                    { mode: 'parts' as const, label: 'Partes' },
                    { mode: 'percentage' as const, label: '%' },
                  ] as const).map(({ mode, label }) => (
                    <Pressable
                      key={mode}
                      onPress={() => setSplitMode(mode)}
                      style={({ pressed }) => [
                        styles.modeBtn,
                        splitMode === mode && styles.modeBtnActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.modeBtnText, splitMode === mode && styles.modeBtnTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.splitSubList}>
                {plan.members.map((m, idx) => {
                  const split = previewSplits.find((s) => s.memberId === m.id);
                  const splitAmt = split?.amount ?? 0;
                  const isFirst = idx === 0;

                  if (splitMode === 'equal') {
                    const isExcluded = excluded.has(m.id);
                    return (
                      <View key={m.id}>
                        {!isFirst && <View style={styles.splitSeparator} />}
                        <Pressable
                          onPress={() => toggleExcluded(m.id)}
                          style={({ pressed }) => [
                            styles.splitRow,
                            isExcluded && styles.splitRowMuted,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={[styles.splitCheck, !isExcluded && styles.splitCheckActive]}>
                            {!isExcluded && <Ionicons name="checkmark" size={11} color="#FFF" />}
                          </View>
                          <View style={[styles.splitAvatar, { backgroundColor: m.bg }]}>
                            <Text style={[styles.splitAvatarInitials, { color: m.color }]}>{m.initials}</Text>
                          </View>
                          <Text style={[styles.splitName, isExcluded && styles.splitNameMuted]}>
                            {m.id === currentUser ? `${m.name} (Yo)` : m.name}
                          </Text>
                          <Text style={[styles.splitAmount, isExcluded && styles.splitNameMuted]}>
                            {isExcluded ? '—' : fmt(splitAmt, currency)}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  }

                  if (splitMode === 'parts') {
                    const parts = partsMap[m.id] ?? 1;
                    return (
                      <View key={m.id}>
                        {!isFirst && <View style={styles.splitSeparator} />}
                        <View style={styles.splitRow}>
                          <View style={[styles.splitAvatar, { backgroundColor: m.bg }]}>
                            <Text style={[styles.splitAvatarInitials, { color: m.color }]}>{m.initials}</Text>
                          </View>
                          <Text style={styles.splitName}>
                            {m.id === currentUser ? `${m.name} (Yo)` : m.name}
                          </Text>
                          <View style={styles.stepperRow}>
                            <Pressable
                              onPress={() => setParts(m.id, -1)}
                              style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
                              hitSlop={6}
                            >
                              <Ionicons name="remove" size={14} color={ACCENT} />
                            </Pressable>
                            <Text style={styles.stepperValue}>{parts}x</Text>
                            <Pressable
                              onPress={() => setParts(m.id, 1)}
                              style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
                              hitSlop={6}
                            >
                              <Ionicons name="add" size={14} color={ACCENT} />
                            </Pressable>
                          </View>
                          <Text style={styles.splitAmount}>{fmt(splitAmt, currency)}</Text>
                        </View>
                      </View>
                    );
                  }

                  // percentage mode
                  return (
                    <View key={m.id}>
                      {!isFirst && <View style={styles.splitSeparator} />}
                      <View style={styles.splitRow}>
                        <View style={[styles.splitAvatar, { backgroundColor: m.bg }]}>
                          <Text style={[styles.splitAvatarInitials, { color: m.color }]}>{m.initials}</Text>
                        </View>
                        <Text style={styles.splitName}>
                          {m.id === currentUser ? `${m.name} (Yo)` : m.name}
                        </Text>
                        <View style={styles.pctInputWrap}>
                          <TextInput
                            value={pctMap[m.id] ?? ''}
                            onChangeText={(v) => setPctMap((prev) => ({ ...prev, [m.id]: v }))}
                            keyboardType="decimal-pad"
                            style={styles.pctInput}
                            maxLength={5}
                          />
                          <Text style={styles.pctSymbol}>%</Text>
                        </View>
                        <Text style={styles.splitAmount}>{fmt(splitAmt, currency)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {splitMode === 'percentage' && (
                <Text style={[
                  styles.pctTotal,
                  Math.abs(pctTotal - 100) > 0.5 ? styles.pctTotalError : styles.pctTotalOk,
                ]}>
                  Total: {pctTotal.toFixed(0)}%{Math.abs(pctTotal - 100) <= 0.5 ? ' ✓' : ' (debe ser 100%)'}
                </Text>
              )}
            </View>

            {/* Nota */}
            <View style={styles.separator} />
            <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
              <View style={styles.detailIconCircle}>
                <Ionicons name="document-text-outline" size={15} color={theme.textPrimary} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Nota (opcional)</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Añade algún comentario o detalle..."
                  placeholderTextColor={theme.textMuted}
                  numberOfLines={2}
                  style={[styles.detailInput, styles.detailTextarea]}
                  multiline
                  onFocus={noteScroll.onFocus}
                  onBlur={noteScroll.onBlur}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </ModalScreen>
    </Modal>
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
  scroller: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  // -- Amount Card --
  amountCard: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: '100%',
  },
  spentSublabel: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  spentAmountInput: {
    color: t.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 36,
    letterSpacing: -0.8,
    lineHeight: 44,
    textAlign: 'center',
    minWidth: 120,
    padding: 0,
  },
  currencyBadgeInline: {
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  currencyTextInline: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '600',
  },
  // -- Unified Detail List --
  detailList: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailIconCircle: {
    alignItems: 'center',
    backgroundColor: t.softSurface,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  detailCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  detailLabel: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  detailInput: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    minHeight: 32,
    padding: 0,
  },
  detailTextarea: {
    lineHeight: 20,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  separator: {
    backgroundColor: t.border,
    height: 1,
  },
  pillScroll: {
    flexGrow: 0,
    width: '100%',
  },
  payerDropdownWrap: {
    gap: 8,
    paddingLeft: 42,
    width: '100%',
  },
  payerSelect: {
    alignItems: 'center',
    backgroundColor: t.background,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  payerSelectAvatar: {
    alignItems: 'center',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  payerSelectInitials: {
    fontSize: 9,
    fontWeight: '600',
  },
  payerSelectName: {
    color: t.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  payerMenu: {
    backgroundColor: t.background,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  payerMenuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  payerMenuItemBorder: {
    borderTopColor: t.border,
    borderTopWidth: 1,
  },
  payerMenuItemActive: {
    backgroundColor: ACCENT_BG,
  },
  payerMenuAvatar: {
    alignItems: 'center',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  payerMenuInitials: {
    fontSize: 9,
    fontWeight: '600',
  },
  payerMenuName: {
    color: t.textSecondary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  payerMenuNameActive: {
    color: ACCENT,
  },
  datePickerWrap: {
    gap: 8,
    paddingLeft: 42,
    width: '100%',
  },
  dateSelect: {
    alignItems: 'center',
    backgroundColor: t.background,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateSelectText: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  calendar: {
    backgroundColor: t.background,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
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
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  calendarTitle: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: '14.28%',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: '14.28%',
  },
  calendarDayActive: {
    backgroundColor: ACCENT,
  },
  calendarDayText: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '400',
  },
  calendarDayMuted: {
    color: t.textMuted,
  },
  calendarDayTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  catPill: {
    alignItems: 'center',
    backgroundColor: t.background,
    borderColor: t.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catPillActive: {
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT,
  },
  catPillText: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  catPillTextActive: {
    color: ACCENT,
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  splitModeRow: {
    alignItems: 'center',
    backgroundColor: t.softSurface,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
  },
  modeBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modeBtnActive: {
    backgroundColor: t.surface,
    elevation: 2,
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  modeBtnText: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: ACCENT,
  },
  splitSubList: {
    backgroundColor: t.background,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    overflow: 'hidden',
  },
  splitSeparator: {
    backgroundColor: t.border,
    height: 1,
  },
  splitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  splitRowMuted: {
    opacity: 0.45,
  },
  splitCheck: {
    alignItems: 'center',
    borderColor: t.border,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  splitCheckActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  splitAvatar: {
    alignItems: 'center',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  splitAvatarInitials: {
    fontSize: 9,
    fontWeight: '600',
  },
  splitName: {
    color: t.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  splitNameMuted: {
    color: t.textMuted,
  },
  splitAmount: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 64,
    textAlign: 'right',
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  stepperBtn: {
    alignItems: 'center',
    backgroundColor: ACCENT_BG,
    borderRadius: 6,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  stepperValue: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  pctInputWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  pctInput: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 6,
    borderWidth: 1,
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 42,
    paddingHorizontal: 6,
    paddingVertical: 3,
    textAlign: 'center',
  },
  pctSymbol: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pctTotal: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    width: '100%',
    marginTop: 2,
  },
  pctTotalOk: {
    color: t.income,
  },
  pctTotalError: {
    color: t.expense,
  },
  saveBtn: {
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 14,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.65,
  },
});
