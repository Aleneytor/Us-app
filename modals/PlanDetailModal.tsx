import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';
import { useState } from 'react';
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
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import type { Plan, PlanCategory, PlanExpense, PlanMember } from '../types';
import { fmt, parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';

const PLAN_ACCENT = '#7C3AED';
const PLAN_BG = '#EDE9FE';

interface PlanDetailModalProps {
  plan: Plan | null;
  onClose: () => void;
  onEdit: () => void;
}

export function PlanDetailModal({ plan, onClose, onEdit }: PlanDetailModalProps) {
  const insets = useSafeAreaInsets();
  const currency = useAppStore((s) => s.currency);
  const currentUser = useAppStore((s) => s.currentUser);
  const addPlanCategory = useAppStore((s) => s.addPlanCategory);
  const deletePlanCategory = useAppStore((s) => s.deletePlanCategory);
  const addPlanExpense = useAppStore((s) => s.addPlanExpense);
  const deletePlanExpense = useAppStore((s) => s.deletePlanExpense);
  const deletePlan = useAppStore((s) => s.deletePlan);

  // Add category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState('');
  const [catAmount, setCatAmount] = useState('');
  const [catIcon, setCatIcon] = useState('map');

  // Add expense form
  const [expenseCatId, setExpenseCatId] = useState<number | null>(null);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayStr());
  const [expenseMemberId, setExpenseMemberId] = useState('');
  const [expenseNote, setExpenseNote] = useState('');

  if (!plan) return null;

  const totalTarget = plan.categories.reduce((s, c) => s + c.totalAmount, 0);
  const totalPaid = plan.expenses.reduce((s, e) => s + e.amount, 0);
  const totalPct = totalTarget > 0 ? Math.min(100, Math.round((totalPaid / totalTarget) * 100)) : 0;

  // Balance por miembro
  const memberBalance = plan.members.map((m) => {
    const paid = plan.expenses.filter((e) => e.memberId === m.id).reduce((s, e) => s + e.amount, 0);
    let owes: number;
    if (plan.splitMode === 'equal') {
      owes = plan.members.length > 0 ? totalTarget / plan.members.length : 0;
    } else {
      owes = totalTarget * ((m.splitPct ?? 0) / 100);
    }
    return { member: m, paid, owes, balance: paid - owes };
  });

  const saveCategory = () => {
    const name = catName.trim();
    const amount = parseAmt(catAmount);
    if (!name) { Alert.alert('Falta el nombre', 'Dale un nombre a la categoría.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { Alert.alert('Monto inválido', 'Escribe un monto mayor a cero.'); return; }
    addPlanCategory(plan.id, {
      id: Date.now(),
      name,
      icon: catIcon,
      totalAmount: amount,
    });
    setCatName('');
    setCatAmount('');
    setCatIcon('map');
    setShowCatForm(false);
  };

  const saveExpense = () => {
    if (!expenseCatId) return;
    const amount = parseAmt(expenseAmount);
    if (!Number.isFinite(amount) || amount <= 0) { Alert.alert('Monto inválido', 'Escribe un monto mayor a cero.'); return; }
    const memberId = expenseMemberId || currentUser;
    const member = plan.members.find((m) => m.id === memberId);
    addPlanExpense(plan.id, {
      id: Date.now(),
      categoryId: expenseCatId,
      memberId,
      memberName: member?.name ?? '',
      amount,
      date: expenseDate.trim() || todayStr(),
      note: expenseNote.trim() || undefined,
    });
    setExpenseAmount('');
    setExpenseDate(todayStr());
    setExpenseNote('');
    setExpenseCatId(null);
  };

  const handleDeletePlan = () => {
    Alert.alert(
      'Eliminar plan',
      `¿Eliminar "${plan.title}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => { deletePlan(plan.id); onClose(); } },
      ],
    );
  };

  const handleDeleteCategory = (cat: PlanCategory) => {
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar "${cat.name}" y todos sus pagos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deletePlanCategory(plan.id, cat.id) },
      ],
    );
  };

  const handleDeleteExpense = (expense: PlanExpense) => {
    Alert.alert(
      'Eliminar pago',
      `¿Eliminar este pago de ${fmt(expense.amount, currency)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deletePlanExpense(plan.id, expense.id) },
      ],
    );
  };

  const iconInfo = CATEGORIES[plan.icon] ?? CATEGORIES.map;
  const iconColor = getIconColor('purple');

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
      <Pressable style={[styles.backdrop, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]} onPressIn={onClose}>
        <Pressable style={styles.cardShadow} onPressIn={(e) => e.stopPropagation()}>
          <View style={styles.card}>

            {/* ── Header ── */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Plan</Text>
              <View style={styles.headerActions}>
                <Pressable onPress={() => { onClose(); setTimeout(onEdit, 120); }} style={styles.iconBtn}>
                  <Ionicons name="pencil-outline" size={18} color={APP_COLORS.textSecondary} />
                </Pressable>
                <Pressable onPress={handleDeletePlan} style={[styles.iconBtn, styles.iconBtnDelete]}>
                  <Ionicons name="trash-outline" size={18} color={APP_COLORS.expense} />
                </Pressable>
                <Pressable onPress={onClose} style={styles.iconBtn}>
                  <Ionicons name="close" size={20} color={APP_COLORS.textPrimary} />
                </Pressable>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={dismissKeyboardAndBlur}
            >
              {/* ── Plan hero ── */}
              <View style={styles.planHero}>
                <View style={[styles.planIconWrap, { backgroundColor: iconColor.bg }]}>
                  <Ionicons name={iconInfo.icon} size={28} color={iconColor.color} />
                </View>
                <View style={styles.planHeroText}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  {plan.description ? (
                    <Text style={styles.planDescription}>{plan.description}</Text>
                  ) : null}
                </View>
              </View>

              {/* ── Progreso global ── */}
              <View style={styles.progressSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressPaid}>{fmt(totalPaid, currency)}</Text>
                  <Text style={styles.progressTarget}>de {fmt(totalTarget, currency)}</Text>
                  <Text style={styles.progressPct}>{totalPct}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${totalPct}%` as `${number}%` }]} />
                </View>
              </View>

              {/* ── Miembros y balance ── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Participantes</Text>
                <View style={styles.membersGrid}>
                  {memberBalance.map(({ member, paid, owes, balance }) => (
                    <View key={member.id} style={styles.memberCard}>
                      <View style={[styles.memberAvatar, { backgroundColor: member.bg }]}>
                        <Text style={[styles.memberInitials, { color: member.color }]}>{member.initials}</Text>
                      </View>
                      <Text style={styles.memberCardName} numberOfLines={1}>{member.name}</Text>
                      {plan.splitMode === 'custom' && member.splitPct != null && (
                        <Text style={styles.memberSplit}>{member.splitPct}%</Text>
                      )}
                      <Text style={styles.memberPaid}>{fmt(paid, currency)}</Text>
                      <Text style={[styles.memberBalance, balance >= 0 ? styles.balancePos : styles.balanceNeg]}>
                        {balance >= 0 ? '+' : ''}{fmt(balance, currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* ── Categorías ── */}
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionTitle}>Categorías</Text>
                  <Pressable
                    onPress={() => setShowCatForm((v) => !v)}
                    style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name={showCatForm ? 'chevron-up' : 'add'} size={16} color={PLAN_ACCENT} />
                    <Text style={styles.addBtnText}>{showCatForm ? 'Cancelar' : 'Nueva'}</Text>
                  </Pressable>
                </View>

                {/* Formulario nueva categoría */}
                {showCatForm && (
                  <View style={styles.catForm}>
                    <InlineField
                      label="Nombre"
                      value={catName}
                      onChangeText={setCatName}
                      placeholder="Ej. Vuelos"
                      autoFocus
                    />
                    <InlineField
                      label="Monto total"
                      value={catAmount}
                      onChangeText={setCatAmount}
                      placeholder="0"
                      keyboardType="decimal-pad"
                    />
                    <View style={styles.inlineField}>
                      <Text style={styles.inlineLabel}>Ícono</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconRow}>
                        {QUICK_ICONS.map((key) => {
                          const info = CATEGORIES[key];
                          const active = catIcon === key;
                          return (
                            <Pressable
                              key={key}
                              onPress={() => setCatIcon(key)}
                              style={[styles.quickIcon, active && styles.quickIconActive]}
                            >
                              <Ionicons
                                name={info.icon}
                                size={18}
                                color={active ? PLAN_ACCENT : APP_COLORS.textSecondary}
                              />
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                    <Pressable
                      onPress={() => runAfterKeyboardDismiss(saveCategory)}
                      style={({ pressed }) => [styles.saveCatBtn, pressed && styles.pressed]}
                    >
                      <Text style={styles.saveCatBtnText}>Guardar categoría</Text>
                    </Pressable>
                  </View>
                )}

                {plan.categories.length === 0 && !showCatForm ? (
                  <View style={styles.emptyRow}>
                    <Ionicons name="folder-open-outline" size={20} color={APP_COLORS.textMuted} />
                    <Text style={styles.emptyText}>Aún no hay categorías. Agrega la primera.</Text>
                  </View>
                ) : (
                  plan.categories.map((cat) => {
                    const catExpenses = plan.expenses.filter((e) => e.categoryId === cat.id);
                    const catPaid = catExpenses.reduce((s, e) => s + e.amount, 0);
                    const catPct = cat.totalAmount > 0 ? Math.min(100, Math.round((catPaid / cat.totalAmount) * 100)) : 0;
                    const catIconInfo = CATEGORIES[cat.icon] ?? CATEGORIES.map;
                    const showExpForm = expenseCatId === cat.id;

                    return (
                      <View key={cat.id} style={styles.catCard}>
                        {/* Cat header */}
                        <View style={styles.catHeader}>
                          <View style={[styles.catIconWrap, { backgroundColor: PLAN_BG }]}>
                            <Ionicons name={catIconInfo.icon} size={18} color={PLAN_ACCENT} />
                          </View>
                          <View style={styles.catInfo}>
                            <Text style={styles.catName}>{cat.name}</Text>
                            <Text style={styles.catAmounts}>
                              {fmt(catPaid, currency)} / {fmt(cat.totalAmount, currency)}
                            </Text>
                          </View>
                          <Text style={styles.catPct}>{catPct}%</Text>
                          <Pressable
                            onPress={() => handleDeleteCategory(cat)}
                            hitSlop={8}
                            style={({ pressed }) => [pressed && styles.pressed]}
                          >
                            <Ionicons name="trash-outline" size={16} color={APP_COLORS.textMuted} />
                          </Pressable>
                        </View>

                        {/* Barra */}
                        <View style={styles.catTrack}>
                          <View style={[styles.catFill, { width: `${catPct}%` as `${number}%` }]} />
                        </View>

                        {/* Pagos existentes */}
                        {catExpenses.length > 0 && (
                          <View style={styles.expenseList}>
                            {catExpenses.map((exp) => (
                              <View key={exp.id} style={styles.expenseRow}>
                                <Text style={styles.expenseName}>{exp.memberName}</Text>
                                <Text style={styles.expenseAmt}>{fmt(exp.amount, currency)}</Text>
                                <Text style={styles.expenseDate}>{exp.date}</Text>
                                <Pressable onPress={() => handleDeleteExpense(exp)} hitSlop={8}>
                                  <Ionicons name="close-circle-outline" size={15} color={APP_COLORS.textMuted} />
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Formulario agregar pago */}
                        {showExpForm ? (
                          <View style={styles.expenseForm}>
                            {/* Seleccionar miembro */}
                            <Text style={styles.inlineLabel}>¿Quién pagó?</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberRow}>
                              {plan.members.map((m) => {
                                const active = (expenseMemberId || currentUser) === m.id;
                                return (
                                  <Pressable
                                    key={m.id}
                                    onPress={() => setExpenseMemberId(m.id)}
                                    style={[styles.memberPill, active && styles.memberPillActive]}
                                  >
                                    <View style={[styles.memberPillAvatar, { backgroundColor: m.bg }]}>
                                      <Text style={[styles.memberPillInitials, { color: m.color }]}>{m.initials}</Text>
                                    </View>
                                    <Text style={[styles.memberPillName, active && styles.memberPillNameActive]}>
                                      {m.name}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </ScrollView>
                            <View style={styles.expenseFormRow}>
                              <InlineField
                                label="Monto"
                                value={expenseAmount}
                                onChangeText={setExpenseAmount}
                                placeholder="0"
                                keyboardType="decimal-pad"
                                style={styles.expenseFieldFlex}
                                autoFocus
                              />
                              <InlineField
                                label="Fecha"
                                value={expenseDate}
                                onChangeText={setExpenseDate}
                                placeholder="YYYY-MM-DD"
                                style={styles.expenseFieldFlex}
                              />
                            </View>
                            <InlineField
                              label="Nota (opcional)"
                              value={expenseNote}
                              onChangeText={setExpenseNote}
                              placeholder="Opcional"
                            />
                            <View style={styles.expenseFormBtns}>
                              <Pressable
                                onPress={() => setExpenseCatId(null)}
                                style={[styles.expenseCancelBtn, { flex: 1 }]}
                              >
                                <Text style={styles.expenseCancelText}>Cancelar</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => runAfterKeyboardDismiss(saveExpense)}
                                style={[styles.expenseSaveBtn, { flex: 1 }]}
                              >
                                <Text style={styles.expenseSaveText}>Guardar</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => {
                              setExpenseCatId(cat.id);
                              setExpenseAmount('');
                              setExpenseDate(todayStr());
                              setExpenseMemberId(currentUser);
                              setExpenseNote('');
                            }}
                            style={({ pressed }) => [styles.addPaymentBtn, pressed && styles.pressed]}
                          >
                            <Ionicons name="add-circle-outline" size={15} color={PLAN_ACCENT} />
                            <Text style={styles.addPaymentText}>Agregar pago</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── InlineField ──────────────────────────────────────────────────────────────

function InlineField({ label, style, ...props }: ComponentProps<typeof TextInput> & { label: string; style?: any }) {
  return (
    <View style={[styles.inlineField, style]}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={APP_COLORS.textMuted}
        style={styles.inlineInput}
        {...props}
      />
    </View>
  );
}

// Quick icon keys for category picker
const QUICK_ICONS = ['travel', 'restaurant', 'hotel', 'transport', 'map', 'drinks', 'coffee', 'shopping', 'wellness', 'home', 'car', 'train'];

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
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
  card: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 22,
    maxHeight: '90%',
    overflow: 'hidden',
    width: '100%',
  },
  // ── Header ──
  header: {
    alignItems: 'center',
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  iconBtnDelete: {
    backgroundColor: '#FFF1F2',
  },
  scroll: {
    gap: 16,
    padding: 16,
    paddingBottom: 32,
  },
  // ── Plan hero ──
  planHero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  planIconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  planHeroText: {
    flex: 1,
    gap: 4,
  },
  planTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  planDescription: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  // ── Progreso global ──
  progressSection: {
    gap: 8,
  },
  progressRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
  },
  progressPaid: {
    color: PLAN_ACCENT,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 28,
  },
  progressTarget: {
    color: APP_COLORS.textSecondary,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  progressPct: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: '#EEF0F3',
    borderRadius: 4,
    height: 7,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: PLAN_ACCENT,
    borderRadius: 4,
    height: '100%',
  },
  // ── Sections ──
  section: {
    gap: 10,
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  addBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  addBtnText: {
    color: PLAN_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  // ── Members grid ──
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
    minWidth: 80,
    padding: 10,
  },
  memberAvatar: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  memberInitials: {
    fontSize: 12,
    fontWeight: '800',
  },
  memberCardName: {
    color: APP_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 72,
    textAlign: 'center',
  },
  memberSplit: {
    color: PLAN_ACCENT,
    fontSize: 11,
    fontWeight: '700',
  },
  memberPaid: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  memberBalance: {
    fontSize: 11,
    fontWeight: '800',
  },
  balancePos: { color: '#059669' },
  balanceNeg: { color: APP_COLORS.expense },
  // ── Category card ──
  catCard: {
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  catHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  catIconWrap: {
    alignItems: 'center',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  catInfo: {
    flex: 1,
    gap: 2,
  },
  catName: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  catAmounts: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  catPct: {
    color: PLAN_ACCENT,
    fontSize: 13,
    fontWeight: '800',
  },
  catTrack: {
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    height: 5,
    overflow: 'hidden',
  },
  catFill: {
    backgroundColor: PLAN_ACCENT,
    borderRadius: 3,
    height: '100%',
  },
  // ── Expense list ──
  expenseList: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    gap: 6,
    paddingTop: 8,
  },
  expenseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  expenseName: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  expenseAmt: {
    color: PLAN_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  expenseDate: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
  },
  // ── Add payment button ──
  addPaymentBtn: {
    alignItems: 'center',
    borderColor: PLAN_ACCENT,
    borderRadius: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 9,
  },
  addPaymentText: {
    color: PLAN_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  // ── Expense form ──
  expenseForm: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 10,
  },
  expenseFormRow: {
    flexDirection: 'row',
    gap: 10,
  },
  expenseFieldFlex: { flex: 1 },
  expenseFormBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  expenseCancelBtn: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
  },
  expenseCancelText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  expenseSaveBtn: {
    alignItems: 'center',
    backgroundColor: PLAN_ACCENT,
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
  },
  expenseSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // ── Member pill (expense form) ──
  memberRow: {
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
    paddingVertical: 6,
  },
  memberPillActive: {
    backgroundColor: PLAN_BG,
    borderColor: PLAN_ACCENT,
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
    color: PLAN_ACCENT,
  },
  // ── Add category form ──
  catForm: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  inlineField: { gap: 5 },
  inlineLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  inlineInput: {
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 10,
    borderWidth: 1,
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  iconRow: {
    flexGrow: 0,
  },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    marginRight: 6,
    width: 36,
  },
  quickIconActive: {
    backgroundColor: PLAN_BG,
  },
  saveCatBtn: {
    alignItems: 'center',
    backgroundColor: PLAN_ACCENT,
    borderRadius: 10,
    height: 42,
    justifyContent: 'center',
  },
  saveCatBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // ── Empty ──
  emptyRow: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
    flex: 1,
    fontSize: 13,
  },
  pressed: { opacity: 0.72 },
});
