import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
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
import { APP_COLORS, getIconColor } from '../constants/colors';
import type { Plan, PlanCategory, PlanExpense } from '../types';
import { fmt, parseAmt, todayStr, MONTHS_ES } from '../utils/format';
import { computeMemberBalances, planMemberSummary, planTotalBudget, planTotalSpent, resolveDebts } from '../utils/planCalculations';
import { useAppStore } from '../store/useAppStore';
import { runAfterKeyboardDismiss } from '../utils/keyboard';
import { PlanExpenseModal } from './PlanExpenseModal';
import { PlanSettlementModal } from './PlanSettlementModal';

const ACCENT = '#7C3AED';
const ACCENT_BG = '#EDE9FE';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'gastos' | 'saldos';

interface PlanDetailModalProps {
  plan: Plan | null;
  onClose: () => void;
  onEdit: () => void;
}

// ─── Date grouping helpers ────────────────────────────────────────────────────

function groupExpensesByDate(expenses: PlanExpense[]): Array<{ label: string; data: PlanExpense[] }> {
  const today = todayStr();
  const yesterday = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const map = new Map<string, PlanExpense[]>();
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  for (const exp of sorted) {
    const existing = map.get(exp.date) ?? [];
    existing.push(exp);
    map.set(exp.date, existing);
  }

  return Array.from(map.entries()).map(([date, data]) => {
    let label: string;
    if (date === today) {
      label = 'Hoy';
    } else if (date === yesterday) {
      label = 'Ayer';
    } else {
      const [, m, d] = date.split('-');
      const monthName = MONTHS_ES[Number(m) - 1] ?? '';
      label = `${Number(d)} de ${monthName.toLowerCase()}`;
    }
    return { label, data };
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PlanDetailModal({ plan, onClose, onEdit }: PlanDetailModalProps) {
  const currency = useAppStore((s) => s.currency);
  const currentUser = useAppStore((s) => s.currentUser);
  const addPlanCategory = useAppStore((s) => s.addPlanCategory);
  const deletePlanCategory = useAppStore((s) => s.deletePlanCategory);
  const deletePlanExpense = useAppStore((s) => s.deletePlanExpense);
  const deletePlan = useAppStore((s) => s.deletePlan);

  const [activeTab, setActiveTab] = useState<Tab>('gastos');
  const tabAnim = useRef(new Animated.Value(0)).current;

  // Expense modal
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<PlanExpense | null>(null);

  // Expense detail sheet
  const [detailExpense, setDetailExpense] = useState<PlanExpense | null>(null);

  // Settlement modal
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementEdge, setSettlementEdge] = useState<{ from: Plan['members'][0]; to: Plan['members'][0]; amount: number } | null>(null);

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState('');
  const [catAmount, setCatAmount] = useState('');
  const [catIcon, setCatIcon] = useState('map');

  // Reset internal modal state when the plan opens or changes
  const prevPlanIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!plan) {
      prevPlanIdRef.current = null;
      return;
    }
    if (plan.id === prevPlanIdRef.current) return;
    prevPlanIdRef.current = plan.id;
    setActiveTab('gastos');
    tabAnim.setValue(0);
    setExpenseModalOpen(false);
    setEditingExpense(null);
    setDetailExpense(null);
    setSettlementOpen(false);
    setSettlementEdge(null);
    setShowCatForm(false);
    setCatName('');
    setCatAmount('');
    setCatIcon('map');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]); // tabAnim is a stable Animated.Value ref — safe to omit

  if (!plan) return null;

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    Animated.spring(tabAnim, {
      toValue: tab === 'gastos' ? 0 : 1,
      useNativeDriver: true,
      damping: 20,
      stiffness: 280,
      mass: 0.8,
    }).start();
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const totalSpent = planTotalSpent(plan);
  const totalBudget = planTotalBudget(plan);
  const totalPct = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  const memberBalances = computeMemberBalances(plan);
  const debtEdges = resolveDebts(memberBalances);
  const myBalance = memberBalances.find((b) => b.member.id === currentUser);
  const { paid: myPaid } = planMemberSummary(plan, currentUser);

  const grouped = groupExpensesByDate(plan.expenses);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDeletePlan = () => {
    Alert.alert('Eliminar plan', `¿Eliminar "${plan.title}"? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { deletePlan(plan.id); onClose(); } },
    ]);
  };

  const handleDeleteCategory = (cat: PlanCategory) => {
    Alert.alert('Eliminar categoría', `¿Eliminar "${cat.name}" y todos sus pagos?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deletePlanCategory(plan.id, cat.id) },
    ]);
  };

  const handleExpenseTap = (exp: PlanExpense) => setDetailExpense(exp);

  const handleExpenseLongPress = (exp: PlanExpense) => {
    Alert.alert(exp.title, `${fmt(exp.amount, currency)} · Pagado por ${exp.memberName}`, [
      { text: 'Editar', onPress: () => { setEditingExpense(exp); setExpenseModalOpen(true); } },
      {
        text: 'Eliminar', style: 'destructive', onPress: () =>
          Alert.alert('Eliminar gasto', `¿Eliminar "${exp.title}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => deletePlanExpense(plan.id, exp.id) },
          ]),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const openAddExpense = () => {
    setEditingExpense(null);
    setExpenseModalOpen(true);
  };

  const saveCategory = () => {
    const name = catName.trim();
    const amount = parseAmt(catAmount);
    if (!name) { Alert.alert('Falta el nombre', 'Dale un nombre a la categoría.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { Alert.alert('Monto inválido', 'Escribe un monto mayor a cero.'); return; }
    addPlanCategory(plan.id, { id: Date.now(), name, icon: catIcon, totalAmount: amount });
    setCatName('');
    setCatAmount('');
    setCatIcon('map');
    setShowCatForm(false);
  };

  // ── Plan hero ─────────────────────────────────────────────────────────────

  const iconInfo = CATEGORIES[plan.icon] ?? CATEGORIES.map;
  const iconColor = getIconColor('purple');

  // ── Balance banner text ───────────────────────────────────────────────────

  const netBalance = myBalance?.netBalance ?? 0;
  let bannerIcon: 'happy-outline' | 'arrow-down-circle-outline' | 'arrow-up-circle-outline' = 'happy-outline';
  let bannerText = 'Todo saldado';
  let bannerColor = '#059669';
  if (netBalance > 0.01) {
    bannerIcon = 'arrow-down-circle-outline';
    bannerText = `Te deben ${fmt(netBalance, currency)}`;
    bannerColor = '#059669';
  } else if (netBalance < -0.01) {
    bannerIcon = 'arrow-up-circle-outline';
    bannerText = `Debes ${fmt(Math.abs(netBalance), currency)}`;
    bannerColor = APP_COLORS.expense;
  }

  // ── Tab underline position ────────────────────────────────────────────────

  const underlineX = tabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });

  return (
    <>
      <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
        <ModalScreen
          title={plan.title}
          onBack={onClose}
          contentContainerStyle={{ padding: 0 }}
          headerRight={(
            <View style={styles.headerActions}>
              <Pressable onPress={() => { onClose(); setTimeout(onEdit, 120); }} style={styles.iconBtn}>
                <Ionicons name="pencil-outline" size={18} color={APP_COLORS.textSecondary} />
              </Pressable>
              <Pressable onPress={handleDeletePlan} style={[styles.iconBtn, styles.iconBtnDelete]}>
                <Ionicons name="trash-outline" size={18} color={APP_COLORS.expense} />
              </Pressable>
            </View>
          )}
        >
          {/* ── Sticky hero + tab bar ── */}
          <View style={styles.stickyTop}>
            {/* Hero */}
            <View style={styles.hero}>
              <View style={[styles.heroIcon, { backgroundColor: iconColor.bg }]}>
                <Ionicons name={iconInfo.icon} size={26} color={iconColor.color} />
              </View>
              <View style={styles.heroText}>
                {plan.description ? <Text style={styles.heroDesc}>{plan.description}</Text> : null}
                <View style={styles.memberAvatarRow}>
                  {plan.members.slice(0, 5).map((m, i) => (
                    <View key={m.id} style={[styles.miniAvatar, { backgroundColor: m.bg, marginLeft: i === 0 ? 0 : -8, zIndex: 5 - i }]}>
                      <Text style={[styles.miniAvatarText, { color: m.color }]}>{m.initials}</Text>
                    </View>
                  ))}
                  {plan.members.length > 5 && (
                    <View style={[styles.miniAvatar, { backgroundColor: '#E2E8F0', marginLeft: -8 }]}>
                      <Text style={[styles.miniAvatarText, { color: APP_COLORS.textSecondary }]}>+{plan.members.length - 5}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.heroRight}>
                <Text style={styles.heroSpent}>{fmt(totalSpent, currency)}</Text>
                <Text style={styles.heroSpentLabel}>gastado</Text>
              </View>
            </View>

            {/* Progress bar (solo si hay presupuesto) */}
            {totalBudget > 0 && (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[
                    styles.progressFill,
                    { width: `${totalPct}%` as `${number}%` },
                    totalPct >= 100 && styles.progressOverBudget,
                  ]} />
                </View>
                <Text style={styles.progressLabel}>
                  {fmt(totalSpent, currency)} de {fmt(totalBudget, currency)} · {totalPct}%
                </Text>
              </View>
            )}

            {/* Tab bar */}
            <View style={styles.tabBar}>
              <Pressable style={styles.tabBtn} onPress={() => switchTab('gastos')}>
                <Text style={[styles.tabText, activeTab === 'gastos' && styles.tabTextActive]}>Gastos</Text>
              </Pressable>
              <Pressable style={styles.tabBtn} onPress={() => switchTab('saldos')}>
                <Text style={[styles.tabText, activeTab === 'saldos' && styles.tabTextActive]}>Saldos</Text>
              </Pressable>
              <Animated.View style={[styles.tabUnderline, { left: underlineX }]} />
            </View>
          </View>

          {/* ── Tab content ── */}
          {activeTab === 'gastos' ? (
            <ScrollView
              style={styles.tabScroll}
              contentContainerStyle={styles.tabContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Stats bar */}
              <View style={styles.statsBar}>
                <View style={styles.statsCell}>
                  <Text style={styles.statsLabel}>Mis gastos</Text>
                  <Text style={styles.statsValue}>{fmt(myPaid, currency)}</Text>
                </View>
                <View style={styles.statsDivider} />
                <View style={styles.statsCell}>
                  <Text style={styles.statsLabel}>Total del plan</Text>
                  <Text style={styles.statsValue}>{fmt(totalSpent, currency)}</Text>
                </View>
              </View>

              {/* Add expense button */}
              <Pressable
                onPress={openAddExpense}
                style={({ pressed }) => [styles.addExpenseBtn, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={16} color={ACCENT} />
                <Text style={styles.addExpenseBtnText}>Añadir gasto</Text>
              </Pressable>

              {/* Expense list grouped by date */}
              {plan.expenses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={36} color={APP_COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>Sin gastos aún</Text>
                  <Text style={styles.emptyText}>Añade el primer gasto del plan.</Text>
                </View>
              ) : (
                grouped.map(({ label, data }) => (
                  <View key={label} style={styles.dateGroup}>
                    <Text style={styles.dateLabel}>{label}</Text>
                    <View style={styles.expenseCard}>
                      {data.map((exp, i) => {
                        const cat = plan.categories.find((c) => c.id === exp.categoryId);
                        const catInfo = cat ? (CATEGORIES[cat.icon] ?? CATEGORIES.map) : null;
                        return (
                          <Pressable
                            key={exp.id}
                            onPress={() => handleExpenseTap(exp)}
                            onLongPress={() => handleExpenseLongPress(exp)}
                            style={({ pressed }) => [
                              styles.expenseRow,
                              i > 0 && styles.expenseRowBorder,
                              pressed && styles.pressed,
                            ]}
                          >
                            <View style={[styles.expenseCatIcon, { backgroundColor: catInfo ? ACCENT_BG : '#F1F5F9' }]}>
                              <Ionicons
                                name={catInfo ? catInfo.icon : 'receipt-outline'}
                                size={15}
                                color={catInfo ? ACCENT : APP_COLORS.textMuted}
                              />
                            </View>
                            <View style={styles.expenseInfo}>
                              <Text style={styles.expenseTitle}>{exp.title}</Text>
                              <Text style={styles.expensePaidBy}>
                                Pagado por <Text style={styles.expensePaidByName}>{exp.memberName}</Text>
                                {cat ? ` · ${cat.name}` : ''}
                              </Text>
                            </View>
                            <Text style={styles.expenseAmt}>{fmt(exp.amount, currency)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}

              {/* Category budgets section */}
              {plan.categories.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Presupuesto por categoría</Text>
                  {plan.categories.map((cat) => {
                    const catSpent = plan.expenses
                      .filter((e) => e.categoryId === cat.id)
                      .reduce((s, e) => s + e.amount, 0);
                    const catPct = cat.totalAmount > 0 ? Math.min(100, Math.round((catSpent / cat.totalAmount) * 100)) : 0;
                    const catIconInfo = CATEGORIES[cat.icon] ?? CATEGORIES.map;
                    const over = catSpent > cat.totalAmount;
                    return (
                      <View key={cat.id} style={styles.catCard}>
                        <View style={styles.catRow}>
                          <View style={[styles.catIconWrap, { backgroundColor: ACCENT_BG }]}>
                            <Ionicons name={catIconInfo.icon} size={16} color={ACCENT} />
                          </View>
                          <Text style={styles.catName}>{cat.name}</Text>
                          <Text style={[styles.catPct, over && styles.catPctOver]}>{catPct}%</Text>
                          <Pressable onPress={() => handleDeleteCategory(cat)} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
                            <Ionicons name="trash-outline" size={14} color={APP_COLORS.textMuted} />
                          </Pressable>
                        </View>
                        <View style={styles.catTrack}>
                          <View style={[
                            styles.catFill,
                            { width: `${catPct}%` as `${number}%` },
                            over && styles.catFillOver,
                          ]} />
                        </View>
                        <Text style={styles.catAmounts}>
                          {fmt(catSpent, currency)} de {fmt(cat.totalAmount, currency)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Add category */}
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionTitle}>Categorías</Text>
                  <Pressable onPress={() => setShowCatForm((v) => !v)} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
                    <Ionicons name={showCatForm ? 'chevron-up' : 'add'} size={15} color={ACCENT} />
                    <Text style={styles.addBtnText}>{showCatForm ? 'Cancelar' : 'Nueva categoría'}</Text>
                  </Pressable>
                </View>
                {showCatForm && (
                  <View style={styles.catForm}>
                    <InlineField label="Nombre" value={catName} onChangeText={setCatName} placeholder="Ej. Vuelos" autoFocus />
                    <InlineField label="Presupuesto" value={catAmount} onChangeText={setCatAmount} placeholder="0" keyboardType="decimal-pad" />
                    <View style={styles.inlineField}>
                      <Text style={styles.inlineLabel}>Ícono</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconRow}>
                        {QUICK_ICONS.map((key) => {
                          const info = CATEGORIES[key];
                          const active = catIcon === key;
                          return (
                            <Pressable key={key} onPress={() => setCatIcon(key)} style={[styles.quickIcon, active && styles.quickIconActive]}>
                              <Ionicons name={info.icon} size={17} color={active ? ACCENT : APP_COLORS.textSecondary} />
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                    <Pressable onPress={() => runAfterKeyboardDismiss(saveCategory)} style={({ pressed }) => [styles.saveCatBtn, pressed && styles.pressed]}>
                      <Text style={styles.saveCatBtnText}>Guardar categoría</Text>
                    </Pressable>
                  </View>
                )}
                {plan.categories.length === 0 && !showCatForm && (
                  <Text style={styles.emptyHint}>Crea categorías para presupuestar el plan.</Text>
                )}
              </View>
            </ScrollView>
          ) : (
            /* ── Tab Saldos ── */
            <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>

              {/* Banner situación */}
              <View style={[styles.banner, { borderColor: bannerColor + '33', backgroundColor: bannerColor + '12' }]}>
                <Ionicons name={bannerIcon} size={24} color={bannerColor} />
                <Text style={[styles.bannerText, { color: bannerColor }]}>{bannerText}</Text>
              </View>

              {/* Balances por miembro */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Saldos</Text>
                <View style={styles.balanceList}>
                  {memberBalances.map(({ member, totalPaid, netBalance: net }, i) => (
                    <View key={member.id} style={[styles.balanceRow, i > 0 && styles.balanceRowBorder]}>
                      <View style={[styles.balanceAvatar, { backgroundColor: member.bg }]}>
                        <Text style={[styles.balanceInitials, { color: member.color }]}>{member.initials}</Text>
                      </View>
                      <View style={styles.balanceName}>
                        <Text style={styles.balanceNameText}>
                          {member.id === currentUser ? `${member.name} (Yo)` : member.name}
                        </Text>
                        <Text style={styles.balancePaid}>Pagó {fmt(totalPaid, currency)}</Text>
                      </View>
                      <Text style={[styles.balanceNet, net >= 0 ? styles.balancePos : styles.balanceNeg]}>
                        {net >= 0 ? '+' : ''}{fmt(net, currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Cómo saldar */}
              {debtEdges.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Cómo saldar</Text>
                  <View style={styles.debtsCard}>
                    {debtEdges.map((edge, i) => (
                      <View key={i} style={[styles.debtRow, i > 0 && styles.debtRowBorder]}>
                        <View style={[styles.debtAvatar, { backgroundColor: edge.from.bg }]}>
                          <Text style={[styles.debtInitials, { color: edge.from.color }]}>{edge.from.initials}</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={14} color={APP_COLORS.textMuted} />
                        <View style={[styles.debtAvatar, { backgroundColor: edge.to.bg }]}>
                          <Text style={[styles.debtInitials, { color: edge.to.color }]}>{edge.to.initials}</Text>
                        </View>
                        <Text style={styles.debtNames}>
                          {edge.from.name} → {edge.to.name}
                        </Text>
                        <Text style={styles.debtAmt}>{fmt(edge.amount, currency)}</Text>
                        <Pressable
                          onPress={() => { setSettlementEdge(edge); setSettlementOpen(true); }}
                          style={({ pressed }) => [styles.saldarBtn, pressed && styles.pressed]}
                        >
                          <Text style={styles.saldarBtnText}>Saldar</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {debtEdges.length === 0 && plan.expenses.length > 0 && (
                <View style={styles.settledCard}>
                  <Ionicons name="checkmark-circle" size={28} color="#059669" />
                  <Text style={styles.settledText}>¡Todo saldado!</Text>
                </View>
              )}

              {/* Participantes */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Participantes</Text>
                <View style={styles.memberGrid}>
                  {plan.members.map((m) => (
                    <View key={m.id} style={styles.memberChip}>
                      <View style={[styles.memberChipAvatar, { backgroundColor: m.bg }]}>
                        <Text style={[styles.memberChipInitials, { color: m.color }]}>{m.initials}</Text>
                      </View>
                      <Text style={styles.memberChipName} numberOfLines={1}>
                        {m.id === currentUser ? `${m.name} (Yo)` : m.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          )}
        </ModalScreen>
      </Modal>

      {/* Settlement modal */}
      <PlanSettlementModal
        visible={settlementOpen}
        plan={plan}
        fromMember={settlementEdge?.from}
        toMember={settlementEdge?.to}
        suggestedAmount={settlementEdge?.amount}
        onClose={() => { setSettlementOpen(false); setSettlementEdge(null); }}
      />

      {/* Expense add/edit modal */}
      <PlanExpenseModal
        visible={expenseModalOpen}
        plan={plan}
        expense={editingExpense}
        onClose={() => { setExpenseModalOpen(false); setEditingExpense(null); }}
      />

      {/* Expense detail sheet */}
      <ExpenseDetailSheet
        expense={detailExpense}
        plan={plan}
        currency={currency}
        currentUser={currentUser}
        onClose={() => setDetailExpense(null)}
        onEdit={(exp) => { setDetailExpense(null); setEditingExpense(exp); setExpenseModalOpen(true); }}
        onDelete={(exp) => {
          setDetailExpense(null);
          Alert.alert('Eliminar gasto', `¿Eliminar "${exp.title}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => deletePlanExpense(plan.id, exp.id) },
          ]);
        }}
      />
    </>
  );
}

// ─── ExpenseDetailSheet ───────────────────────────────────────────────────────

function ExpenseDetailSheet({
  expense,
  plan,
  currency,
  currentUser,
  onClose,
  onEdit,
  onDelete,
}: {
  expense: PlanExpense | null;
  plan: Plan;
  currency: Parameters<typeof fmt>[1];
  currentUser: string;
  onClose: () => void;
  onEdit: (exp: PlanExpense) => void;
  onDelete: (exp: PlanExpense) => void;
}) {
  if (!expense) return null;

  const cat = plan.categories.find((c) => c.id === expense.categoryId);
  const catInfo = cat ? (CATEGORIES[cat.icon] ?? CATEGORIES.map) : null;
  const splitModeLabel = expense.splitMode === 'equal' ? 'Partes iguales' : expense.splitMode === 'parts' ? 'Por partes' : 'Por porcentaje';

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <ModalScreen
        title={expense.title}
        onBack={onClose}
        contentContainerStyle={{ padding: 0 }}
        footer={(
          <>
            <Pressable onPress={() => onDelete(expense)} style={[styles.sheetBtn, styles.sheetBtnDelete]}>
              <Text style={styles.sheetBtnDeleteText}>Eliminar</Text>
            </Pressable>
            <Pressable onPress={() => onEdit(expense)} style={[styles.sheetBtn, styles.sheetBtnEdit]}>
              <Text style={styles.sheetBtnEditText}>Editar</Text>
            </Pressable>
          </>
        )}
      >
        <ScrollView contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {/* Amount hero */}
          <View style={styles.sheetAmountWrap}>
            <Text style={styles.sheetAmount}>{fmt(expense.amount, currency)}</Text>
            <Text style={styles.sheetAmountSub}>
              Pagado por <Text style={{ fontWeight: '800' }}>{expense.memberName}</Text> · {expense.date}
            </Text>
            {cat && (
              <View style={styles.sheetCatBadge}>
                {catInfo && <Ionicons name={catInfo.icon} size={13} color={ACCENT} />}
                <Text style={styles.sheetCatBadgeText}>{cat.name}</Text>
              </View>
            )}
          </View>

          {/* Splits */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>División</Text>
              <Text style={styles.splitModeChip}>{splitModeLabel}</Text>
            </View>
            <View style={styles.splitsList}>
              {expense.splits.length > 0 ? expense.splits.map((sp, i) => {
                const member = plan.members.find((m) => m.id === sp.memberId);
                if (!member) return null;
                const label = sp.parts != null ? `${sp.parts}x` : sp.pct != null ? `${sp.pct}%` : '';
                return (
                  <View key={sp.memberId} style={[styles.splitDetailRow, i > 0 && styles.splitDetailRowBorder]}>
                    <View style={[styles.splitDetailAvatar, { backgroundColor: member.bg }]}>
                      <Text style={[styles.splitDetailInitials, { color: member.color }]}>{member.initials}</Text>
                    </View>
                    <Text style={styles.splitDetailName}>
                      {member.id === currentUser ? `${member.name} (Yo)` : member.name}
                    </Text>
                    {label ? <Text style={styles.splitDetailLabel}>{label}</Text> : null}
                    <Text style={styles.splitDetailAmt}>{fmt(sp.amount, currency)}</Text>
                  </View>
                );
              }) : (
                // Fallback for legacy expenses without splits
                plan.members.map((m, i) => (
                  <View key={m.id} style={[styles.splitDetailRow, i > 0 && styles.splitDetailRowBorder]}>
                    <View style={[styles.splitDetailAvatar, { backgroundColor: m.bg }]}>
                      <Text style={[styles.splitDetailInitials, { color: m.color }]}>{m.initials}</Text>
                    </View>
                    <Text style={styles.splitDetailName}>
                      {m.id === currentUser ? `${m.name} (Yo)` : m.name}
                    </Text>
                    <Text style={styles.splitDetailAmt}>
                      {fmt(Math.round(expense.amount / plan.members.length * 100) / 100, currency)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {expense.note ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nota</Text>
              <Text style={styles.noteText}>{expense.note}</Text>
            </View>
          ) : null}
        </ScrollView>
      </ModalScreen>
    </Modal>
  );
}

// ─── InlineField ──────────────────────────────────────────────────────────────

function InlineField({ label, style, ...props }: ComponentProps<typeof TextInput> & { label: string; style?: any }) {
  return (
    <View style={[styles.inlineField, style]}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <TextInput placeholderTextColor={APP_COLORS.textMuted} style={styles.inlineInput} {...props} />
    </View>
  );
}

const QUICK_ICONS = ['travel', 'restaurant', 'hotel', 'transport', 'map', 'drinks', 'coffee', 'shopping', 'wellness', 'home', 'car', 'train'];

const styles = StyleSheet.create({
  // ── Header ──
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
  iconBtnDelete: { backgroundColor: '#FFF1F2' },

  // ── Sticky top ──
  stickyTop: {
    backgroundColor: APP_COLORS.surface,
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  heroIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  heroText: {
    flex: 1,
    gap: 8,
  },
  heroDesc: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  memberAvatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  miniAvatar: {
    alignItems: 'center',
    borderColor: APP_COLORS.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  miniAvatarText: {
    fontSize: 8,
    fontWeight: '800',
  },
  heroRight: {
    alignItems: 'flex-end',
  },
  heroSpent: {
    color: ACCENT,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
  },
  heroSpentLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Progress ──
  progressWrap: {
    gap: 4,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  progressTrack: {
    backgroundColor: '#EEF0F3',
    borderRadius: 4,
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: ACCENT,
    borderRadius: 4,
    height: '100%',
  },
  progressOverBudget: {
    backgroundColor: APP_COLORS.expense,
  },
  progressLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Tab bar ──
  tabBar: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  tabBtn: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 12,
  },
  tabText: {
    color: APP_COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: ACCENT,
  },
  tabUnderline: {
    backgroundColor: ACCENT,
    bottom: 0,
    height: 2,
    position: 'absolute',
    width: '50%',
  },

  // ── Tab content ──
  tabScroll: {
    flex: 1,
  },
  tabContent: {
    gap: 20,
    padding: 16,
    paddingBottom: 40,
  },

  // ── Stats bar ──
  statsBar: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  statsCell: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 14,
    gap: 4,
  },
  statsDivider: {
    backgroundColor: APP_COLORS.border,
    width: 1,
  },
  statsLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statsValue: {
    color: APP_COLORS.textPrimary,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 20,
  },

  // ── Add expense button ──
  addExpenseBtn: {
    alignItems: 'center',
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 11,
  },
  addExpenseBtnText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  emptyTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
  },
  emptyHint: {
    color: APP_COLORS.textMuted,
    fontSize: 13,
  },

  // ── Date groups ──
  dateGroup: {
    gap: 8,
  },
  dateLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  expenseCard: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  expenseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  expenseRowBorder: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  expenseCatIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  expenseInfo: {
    flex: 1,
    gap: 2,
  },
  expenseTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  expensePaidBy: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  expensePaidByName: {
    color: APP_COLORS.textSecondary,
    fontWeight: '700',
  },
  expenseAmt: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Category budget cards ──
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
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
  catCard: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  catRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  catIconWrap: {
    alignItems: 'center',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  catName: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  catPct: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '800',
  },
  catPctOver: {
    color: APP_COLORS.expense,
  },
  catTrack: {
    backgroundColor: '#EEF0F3',
    borderRadius: 3,
    height: 5,
    overflow: 'hidden',
  },
  catFill: {
    backgroundColor: ACCENT,
    borderRadius: 3,
    height: '100%',
  },
  catFillOver: {
    backgroundColor: APP_COLORS.expense,
  },
  catAmounts: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
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
  iconRow: { flexGrow: 0 },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    marginRight: 6,
    width: 34,
  },
  quickIconActive: { backgroundColor: ACCENT_BG },
  saveCatBtn: {
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 10,
    height: 42,
    justifyContent: 'center',
  },
  saveCatBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Tab Saldos ──
  banner: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  bannerText: {
    fontSize: 15,
    fontWeight: '800',
  },
  balanceList: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  balanceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  balanceRowBorder: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  balanceAvatar: {
    alignItems: 'center',
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  balanceInitials: {
    fontSize: 12,
    fontWeight: '800',
  },
  balanceName: {
    flex: 1,
    gap: 2,
  },
  balanceNameText: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  balancePaid: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  balanceNet: {
    fontSize: 15,
    fontWeight: '800',
  },
  balancePos: { color: '#059669' },
  balanceNeg: { color: APP_COLORS.expense },

  debtsCard: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  debtRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  debtRowBorder: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  debtAvatar: {
    alignItems: 'center',
    borderRadius: 12,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  debtInitials: {
    fontSize: 9,
    fontWeight: '800',
  },
  debtNames: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  debtAmt: {
    color: APP_COLORS.expense,
    fontSize: 14,
    fontWeight: '800',
  },
  settledCard: {
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#059669',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    padding: 16,
  },
  settledText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '800',
  },
  memberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChip: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  memberChipAvatar: {
    alignItems: 'center',
    borderRadius: 10,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  memberChipInitials: {
    fontSize: 9,
    fontWeight: '800',
  },
  memberChipName: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 100,
  },

  // ── ExpenseDetailSheet ──
  sheetScroll: {
    gap: 20,
    padding: 16,
    paddingBottom: 32,
  },
  sheetAmountWrap: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  sheetAmount: {
    color: APP_COLORS.textPrimary,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 40,
  },
  sheetAmountSub: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  sheetCatBadge: {
    alignItems: 'center',
    backgroundColor: ACCENT_BG,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  sheetCatBadgeText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
  splitModeChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  splitsList: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  splitDetailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  splitDetailRowBorder: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  splitDetailAvatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  splitDetailInitials: {
    fontSize: 10,
    fontWeight: '800',
  },
  splitDetailName: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  splitDetailLabel: {
    backgroundColor: ACCENT_BG,
    borderRadius: 6,
    color: ACCENT,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  splitDetailAmt: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '700',
  },
  noteText: {
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
  },

  // ── Sheet footer buttons ──
  sheetBtn: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  sheetBtnDelete: {
    backgroundColor: '#FFF1F2',
    borderColor: APP_COLORS.expense,
    borderWidth: 1,
  },
  sheetBtnDeleteText: {
    color: APP_COLORS.expense,
    fontSize: 14,
    fontWeight: '700',
  },
  sheetBtnEdit: {
    backgroundColor: ACCENT,
  },
  sheetBtnEditText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Saldar button ──
  saldarBtn: {
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  saldarBtnText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '800',
  },

  pressed: { opacity: 0.72 },
});
