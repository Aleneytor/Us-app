import { Ionicons } from '@expo/vector-icons';
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
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS } from '../constants/colors';
import type { Plan, PlanExpense, PlanMember, PlanSplitMode } from '../types';
import { fmt, parseAmt, todayStr } from '../utils/format';
import { computeSplits } from '../utils/planCalculations';
import { useAppStore } from '../store/useAppStore';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';

const ACCENT = '#7C3AED';
const ACCENT_BG = '#EDE9FE';

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

  const editing = !!expense;

  // ── Form state ────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [amtText, setAmtText] = useState('');
  const [payerId, setPayerId] = useState(currentUser);
  const [date, setDate] = useState(todayStr());
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [splitMode, setSplitMode] = useState<PlanSplitMode>('equal');
  // memberId → parts count (mode 'parts')
  const [partsMap, setPartsMap] = useState<Record<string, number>>({});
  // memberId → pct string (mode 'percentage')
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
      setCategoryId(expense.categoryId ?? null);
      setSplitMode(expense.splitMode);
      setNote(expense.note ?? '');

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
      setCategoryId(null);
      setSplitMode(plan.splitMode === 'parts' ? 'parts' : 'equal');
      setNote('');
      setExcluded(new Set());

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

  // ── Derived values ────────────────────────────────────────────────────────
  const amount = parseAmt(amtText);

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

  // ── Validation & save ─────────────────────────────────────────────────────
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

  const handleSave = () => runAfterKeyboardDismiss(save);

  // ── Parts helpers ─────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
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
          {/* ── Título ── */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Título</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Cena en el centro"
              placeholderTextColor={APP_COLORS.textMuted}
              style={styles.input}
              autoFocus={!editing}
              returnKeyType="next"
            />
          </View>

          {/* ── Cantidad ── */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Cantidad</Text>
            <View style={styles.amountRow}>
              <TextInput
                value={amtText}
                onChangeText={setAmtText}
                placeholder="0,00"
                placeholderTextColor={APP_COLORS.textMuted}
                keyboardType="decimal-pad"
                style={[styles.input, styles.amountInput]}
              />
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyText}>{currency}</Text>
              </View>
            </View>
          </View>

          {/* ── Pagado por + Cuándo ── */}
          <View style={styles.rowFields}>
            <View style={[styles.field, styles.fieldFlex]}>
              <Text style={styles.fieldLabel}>Pagado por</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                {plan.members.map((m) => {
                  const active = m.id === payerId;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setPayerId(m.id)}
                      style={[styles.memberPill, active && styles.memberPillActive]}
                    >
                      <View style={[styles.memberPillAvatar, { backgroundColor: m.bg }]}>
                        <Text style={[styles.memberPillInitials, { color: m.color }]}>{m.initials}</Text>
                      </View>
                      <Text style={[styles.memberPillName, active && styles.memberPillNameActive]}>
                        {m.id === currentUser ? `${m.name} (Yo)` : m.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={[styles.field, styles.dateField]}>
              <Text style={styles.fieldLabel}>Cuando</Text>
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={APP_COLORS.textMuted}
                style={[styles.input, styles.dateInput]}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* ── Categoría (solo si el plan tiene categorías) ── */}
          {plan.categories.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Categoría (opcional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                <Pressable
                  onPress={() => setCategoryId(null)}
                  style={[styles.catPill, categoryId === null && styles.catPillActive]}
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
                      style={[styles.catPill, active && styles.catPillActive]}
                    >
                      <Ionicons
                        name={catInfo.icon}
                        size={14}
                        color={active ? ACCENT : APP_COLORS.textSecondary}
                      />
                      <Text style={[styles.catPillText, active && styles.catPillTextActive]}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── División ── */}
          <View style={styles.field}>
            <View style={styles.splitHeader}>
              <Text style={styles.fieldLabel}>Dividir</Text>
              <View style={styles.splitModeRow}>
                {([
                  { mode: 'equal' as const, label: 'Igual' },
                  { mode: 'parts' as const, label: 'Partes' },
                  { mode: 'percentage' as const, label: '%' },
                ] as const).map(({ mode, label }) => (
                  <Pressable
                    key={mode}
                    onPress={() => setSplitMode(mode)}
                    style={[styles.modeBtn, splitMode === mode && styles.modeBtnActive]}
                  >
                    <Text style={[styles.modeBtnText, splitMode === mode && styles.modeBtnTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.splitList}>
              {plan.members.map((m) => {
                const split = previewSplits.find((s) => s.memberId === m.id);
                const splitAmt = split?.amount ?? 0;

                if (splitMode === 'equal') {
                  const isExcluded = excluded.has(m.id);
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => toggleExcluded(m.id)}
                      style={[styles.splitRow, isExcluded && styles.splitRowMuted]}
                    >
                      <View style={[styles.splitCheck, !isExcluded && styles.splitCheckActive]}>
                        {!isExcluded && <Ionicons name="checkmark" size={13} color="#FFF" />}
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
                  );
                }

                if (splitMode === 'parts') {
                  const parts = partsMap[m.id] ?? 1;
                  return (
                    <View key={m.id} style={styles.splitRow}>
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
                          <Ionicons name="remove" size={16} color={ACCENT} />
                        </Pressable>
                        <Text style={styles.stepperValue}>{parts}x</Text>
                        <Pressable
                          onPress={() => setParts(m.id, 1)}
                          style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
                          hitSlop={6}
                        >
                          <Ionicons name="add" size={16} color={ACCENT} />
                        </Pressable>
                      </View>
                      <Text style={styles.splitAmount}>{fmt(splitAmt, currency)}</Text>
                    </View>
                  );
                }

                // percentage mode
                return (
                  <View key={m.id} style={styles.splitRow}>
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

          {/* ── Nota ── */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nota (opcional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Añade un detalle..."
              placeholderTextColor={APP_COLORS.textMuted}
              style={[styles.input, styles.noteInput]}
              multiline
              onFocus={noteScroll.onFocus}
              onBlur={noteScroll.onBlur}
            />
          </View>
        </ScrollView>
      </ModalScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroller: {
    flex: 1,
  },
  scroll: {
    gap: 4,
    padding: 16,
    paddingBottom: 32,
  },

  // ── Fields ──
  field: {
    gap: 8,
    paddingVertical: 10,
  },
  fieldFlex: {
    flex: 1,
  },
  fieldLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  dateField: {
    width: 140,
  },
  dateInput: {
    fontSize: 14,
  },

  // ── Amount ──
  amountRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'DMSerifDisplay_400Regular',
    textAlign: 'center',
  },
  currencyBadge: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  currencyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Member pills (payer) ──
  pillScroll: {
    flexGrow: 0,
  },
  memberPill: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  memberPillActive: {
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT,
  },
  memberPillAvatar: {
    alignItems: 'center',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  memberPillInitials: {
    fontSize: 9,
    fontWeight: '800',
  },
  memberPillName: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  memberPillNameActive: {
    color: ACCENT,
  },

  // ── Category pills ──
  catPill: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  catPillActive: {
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT,
  },
  catPillText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  catPillTextActive: {
    color: ACCENT,
  },

  // ── Split section ──
  splitHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  splitModeRow: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
  },
  modeBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  modeBtnActive: {
    backgroundColor: APP_COLORS.surface,
    elevation: 2,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 3,
  },
  modeBtnText: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  modeBtnTextActive: {
    color: ACCENT,
  },
  splitList: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  splitRow: {
    alignItems: 'center',
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  splitRowMuted: {
    opacity: 0.45,
  },

  // equal mode
  splitCheck: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  splitCheckActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },

  // shared
  splitAvatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  splitAvatarInitials: {
    fontSize: 10,
    fontWeight: '800',
  },
  splitName: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  splitNameMuted: {
    color: APP_COLORS.textMuted,
  },
  splitAmount: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 64,
    textAlign: 'right',
  },

  // parts mode
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  stepperBtn: {
    alignItems: 'center',
    backgroundColor: ACCENT_BG,
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  stepperValue: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
  },

  // percentage mode
  pctInputWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  pctInput: {
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 8,
    borderWidth: 1,
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 46,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textAlign: 'center',
  },
  pctSymbol: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  pctTotal: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    paddingTop: 4,
  },
  pctTotalOk: {
    color: '#059669',
  },
  pctTotalError: {
    color: APP_COLORS.expense,
  },

  // ── Note ──
  noteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },

  // ── Footer ──
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
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
