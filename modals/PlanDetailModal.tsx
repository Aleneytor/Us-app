import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal as Modal } from '../components/AppModal';
import { CATEGORIES } from '../constants/categories';
import { type AppTheme } from '../constants/colors';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import type { Plan, PlanCategory, PlanExpense } from '../types';
import { fmt, formatDateShort, parseAmt, todayStr, MONTHS_ES } from '../utils/format';
import {
  computeMemberBalances,
  planMemberSummary,
  planTotalBudget,
  planTotalSpent,
  resolveDebts,
} from '../utils/planCalculations';
import { useAppStore } from '../store/useAppStore';
import { runAfterKeyboardDismiss } from '../utils/keyboard';
import { useTheme } from '../contexts/ThemeContext';
import { PlanExpenseModal } from './PlanExpenseModal';
import { PlanSettlementModal } from './PlanSettlementModal';

const ACCENT = '#7C3AED';
const ACCENT_BG = 'rgba(124, 58, 237, 0.18)';

function makeColors(t: AppTheme) {
  return {
    background: t.background,
    card: t.surface,
    cardBorder: t.border,
    text: t.textPrimary,
    secondary: t.textSecondary,
    muted: t.textMuted,
    iconBg: t.softSurface,
    actionBg: t.softSurface,
    actionText: t.textSecondary,
    expense: t.expense,
  };
}

// --- Types -------------------------------------------------------------------

type Tab = 'gastos' | 'saldos';

interface PlanDetailModalProps {
  plan: Plan | null;
  onClose: () => void;
  onEdit: () => void;
}

// --- Date grouping helpers ---------------------------------------------------

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

function getSplitModeLabel(mode: Plan['splitMode']): string {
  if (mode === 'equal') return 'Partes iguales';
  if (mode === 'parts') return 'Por partes';
  return 'Por porcentaje';
}

// --- Main component ----------------------------------------------------------

export function PlanDetailModal({ plan, onClose, onEdit }: PlanDetailModalProps) {
  const insets = useSafeAreaInsets();
  const currency = useAppStore((s) => s.currency);
  const currentUser = useAppStore((s) => s.currentUser);
  const addPlanCategory = useAppStore((s) => s.addPlanCategory);
  const deletePlanCategory = useAppStore((s) => s.deletePlanCategory);
  const deletePlanExpense = useAppStore((s) => s.deletePlanExpense);
  const deletePlan = useAppStore((s) => s.deletePlan);
  const theme = useTheme();
  const colors = useMemo(() => makeColors(theme), [theme]);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<Tab>('gastos');
  const pillAnim = useRef(new Animated.Value(0)).current;

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<PlanExpense | null>(null);
  const [detailExpense, setDetailExpense] = useState<PlanExpense | null>(null);

  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementEdge, setSettlementEdge] = useState<{
    from: Plan['members'][0];
    to: Plan['members'][0];
    amount: number;
  } | null>(null);

  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState('');
  const [catAmount, setCatAmount] = useState('');
  const [catIcon, setCatIcon] = useState('map');

  // Collapsible detail section — use refs to avoid stale closures in scroll handler
  const detailCollapsedRef = useRef(false);
  const detailHeightAnim = useRef(new Animated.Value(1)).current; // 1=expanded, 0=collapsed
  const [detailHeight, setDetailHeight] = useState(0);
  const lastScrollY = useRef(0);

  // Segmented control width for pill positioning
  const [segWidth, setSegWidth] = useState(0);

  const prevPlanIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!plan) { prevPlanIdRef.current = null; return; }
    if (plan.id === prevPlanIdRef.current) return;
    prevPlanIdRef.current = plan.id;
    setActiveTab('gastos');
    pillAnim.setValue(0);
    setExpenseModalOpen(false);
    setEditingExpense(null);
    setDetailExpense(null);
    setSettlementOpen(false);
    setSettlementEdge(null);
    setShowCatForm(false);
    setCatName('');
    setCatAmount('');
    setCatIcon('map');
    detailCollapsedRef.current = false;
    detailHeightAnim.setValue(1);
    lastScrollY.current = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  if (!plan) return null;

  const collapseDetail = () => {
    if (detailCollapsedRef.current) return;
    detailCollapsedRef.current = true;
    Animated.timing(detailHeightAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  };

  const expandDetail = () => {
    if (!detailCollapsedRef.current) return;
    detailCollapsedRef.current = false;
    Animated.timing(detailHeightAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: false,
    }).start();
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    expandDetail();
    lastScrollY.current = 0;
    Animated.spring(pillAnim, {
      toValue: tab === 'gastos' ? 0 : 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 300,
      mass: 0.7,
    }).start();
  };

  const handleScroll = (y: number) => {
    lastScrollY.current = y;
    if (y > 40) {
      collapseDetail();
    } else if (y < 10) {
      expandDetail();
    }
  };

  // -- Derived data -----------------------------------------------------------

  const totalSpent = planTotalSpent(plan);
  const totalBudget = planTotalBudget(plan);
  const totalPct = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  const memberBalances = computeMemberBalances(plan);
  const debtEdges = resolveDebts(memberBalances);
  const myBalance = memberBalances.find((b) => b.member.id === currentUser);
  const { paid: myPaid } = planMemberSummary(plan, currentUser);

  const grouped = groupExpensesByDate(plan.expenses);

  // -- Handlers ---------------------------------------------------------------

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

  // -- Balance banner ---------------------------------------------------------

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
    bannerColor = colors.expense;
  }

  // Pill position: 0 = Gastos (left), 1 = Saldos (right)
  const pillTranslateX = segWidth > 0
    ? pillAnim.interpolate({ inputRange: [0, 1], outputRange: [4, segWidth / 2], extrapolate: 'clamp' })
    : pillAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 180], extrapolate: 'clamp' });

  return (
    <>
      <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <View style={[styles.container, { paddingTop: insets.top }]}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-back" size={29} color={colors.text} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                {plan.title}
              </Text>
              <Text style={styles.subtitle}>Plan de gastos</Text>
            </View>
            <Pressable
              onPress={() => { onClose(); setTimeout(onEdit, 120); }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
            >
              <Ionicons name="pencil-outline" size={20} color={colors.secondary} />
            </Pressable>
          </View>

          {/* ── Sticky top ── */}
          <View style={styles.stickyTop}>

            {/* ── Hero: Mis gastos + Total del plan ── */}
            <View style={styles.heroCard}>
              <View style={styles.heroCell}>
                <Text style={styles.heroLabel}>Mis gastos</Text>
                <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {fmt(myPaid, currency)}
                </Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroCell}>
                <Text style={styles.heroLabel}>Total del plan</Text>
                <Text style={[styles.heroValue, styles.heroValueAccent]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {fmt(totalSpent, currency)}
                </Text>
              </View>
              {totalBudget > 0 && (
                <View style={styles.heroProgressRow}>
                  <View style={styles.heroProgressTrack}>
                    <View
                      style={[
                        styles.heroProgressFill,
                        { width: `${totalPct}%` as `${number}%` },
                        totalPct >= 100 && styles.heroProgressOver,
                      ]}
                    />
                  </View>
                  <Text style={styles.heroProgressLabel}>
                    {totalPct}% del presupuesto ({fmt(totalBudget, currency)})
                  </Text>
                </View>
              )}
            </View>

            {/* ── Collapsible detail list ── */}
            <Animated.View
              style={[
                styles.detailAnimWrapper,
                detailHeight > 0 && {
                  height: detailHeightAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, detailHeight],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            >
              <View
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h > 0 && detailHeight === 0) setDetailHeight(h);
                }}
              >
                <View style={styles.detailList}>
                  {/* Members row */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeading}>
                      <View style={styles.detailIconCircle}>
                        <Ionicons name="people-outline" size={17} color={colors.text} />
                      </View>
                    </View>
                    <View style={styles.detailCopy}>
                      <Text style={styles.detailLabel}>Participantes</Text>
                      <View style={styles.memberAvatarRow}>
                        {plan.members.slice(0, 5).map((m, i) => (
                          <View
                            key={m.id}
                            style={[styles.miniAvatar, { backgroundColor: m.bg, marginLeft: i === 0 ? 0 : -7, zIndex: 5 - i }]}
                          >
                            <Text style={[styles.miniAvatarText, { color: m.color }]}>{m.initials}</Text>
                          </View>
                        ))}
                        {plan.members.length > 5 && (
                          <View style={[styles.miniAvatar, { backgroundColor: colors.iconBg, marginLeft: -7 }]}>
                            <Text style={[styles.miniAvatarText, { color: colors.secondary }]}>
                              +{plan.members.length - 5}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.memberCountText}>
                          {plan.members.length} {plan.members.length === 1 ? 'persona' : 'personas'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.separator} />

                  {/* Two-col: fecha + presupuesto / división */}
                  <View style={styles.twoColRow}>
                    <View style={[styles.detailRow, { flex: 1 }]}>
                      <View style={styles.detailLeading}>
                        <View style={styles.detailIconCircle}>
                          <Ionicons name="calendar-outline" size={17} color={colors.text} />
                        </View>
                      </View>
                      <View style={styles.detailCopy}>
                        <Text style={styles.detailLabel}>Fecha</Text>
                        <Text style={styles.detailValue}>{formatDateShort(plan.date)}</Text>
                      </View>
                    </View>
                    <View style={styles.colDivider} />
                    <View style={[styles.detailRow, { flex: 1 }]}>
                      <View style={styles.detailLeading}>
                        <View style={styles.detailIconCircle}>
                          <Ionicons
                            name={totalBudget > 0 ? 'wallet-outline' : 'git-branch-outline'}
                            size={17}
                            color={colors.text}
                          />
                        </View>
                      </View>
                      <View style={styles.detailCopy}>
                        <Text style={styles.detailLabel}>
                          {totalBudget > 0 ? 'Presupuesto' : 'División'}
                        </Text>
                        <Text style={styles.detailValue}>
                          {totalBudget > 0 ? fmt(totalBudget, currency) : getSplitModeLabel(plan.splitMode)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {plan.description ? (
                    <>
                      <View style={styles.separator} />
                      <View style={styles.detailRow}>
                        <View style={styles.detailLeading}>
                          <View style={styles.detailIconCircle}>
                            <Ionicons name="document-text-outline" size={17} color={colors.text} />
                          </View>
                        </View>
                        <View style={styles.detailCopy}>
                          <Text style={styles.detailLabel}>Descripción</Text>
                          <Text style={styles.detailValue} numberOfLines={2}>{plan.description}</Text>
                        </View>
                      </View>
                    </>
                  ) : null}
                </View>
                {/* paddingBottom absorbed into measured height so the gap collapses too */}
                <View style={{ height: 14 }} />
              </View>
            </Animated.View>

            {/* ── Segmented pill control ── */}
            <View
              style={styles.segmentContainer}
              onLayout={(e) => setSegWidth(e.nativeEvent.layout.width)}
            >
              <Animated.View
                style={[
                  styles.segmentPill,
                  segWidth > 0 && {
                    width: segWidth / 2 - 8,
                    transform: [{ translateX: pillTranslateX }],
                  },
                ]}
              />
              <Pressable
                style={styles.segmentBtn}
                onPress={() => switchTab('gastos')}
              >
                <Ionicons
                  name="receipt-outline"
                  size={14}
                  color={activeTab === 'gastos' ? ACCENT : colors.muted}
                />
                <Text style={[styles.segmentText, activeTab === 'gastos' && styles.segmentTextActive]}>
                  Gastos
                </Text>
              </Pressable>
              <Pressable
                style={styles.segmentBtn}
                onPress={() => switchTab('saldos')}
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={14}
                  color={activeTab === 'saldos' ? ACCENT : colors.muted}
                />
                <Text style={[styles.segmentText, activeTab === 'saldos' && styles.segmentTextActive]}>
                  Saldos
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ── Tab content ── */}
          {activeTab === 'gastos' ? (
            <ScrollView
              style={styles.tabScroll}
              contentContainerStyle={styles.tabContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(e) => handleScroll(e.nativeEvent.contentOffset.y)}
            >
              {/* Expense list */}
              {plan.expenses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={36} color={colors.muted} />
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
                            <View style={[styles.expenseCatIcon, { backgroundColor: catInfo ? ACCENT_BG : colors.iconBg }]}>
                              <Ionicons
                                name={catInfo ? catInfo.icon : 'receipt-outline'}
                                size={15}
                                color={catInfo ? ACCENT : colors.muted}
                              />
                            </View>
                            <View style={styles.expenseInfo}>
                              <Text style={styles.expenseTitle}>{exp.title}</Text>
                              <Text style={styles.expensePaidBy}>
                                Pagado por{' '}
                                <Text style={styles.expensePaidByName}>{exp.memberName}</Text>
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

              {/* Category budgets */}
              {plan.categories.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Presupuesto por categoría</Text>
                  {plan.categories.map((cat) => {
                    const catSpent = plan.expenses
                      .filter((e) => e.categoryId === cat.id)
                      .reduce((s, e) => s + e.amount, 0);
                    const catPct = cat.totalAmount > 0
                      ? Math.min(100, Math.round((catSpent / cat.totalAmount) * 100))
                      : 0;
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
                          <Pressable
                            onPress={() => handleDeleteCategory(cat)}
                            hitSlop={8}
                            style={({ pressed }) => [pressed && styles.pressed]}
                          >
                            <Ionicons name="trash-outline" size={14} color={colors.muted} />
                          </Pressable>
                        </View>
                        <View style={styles.catTrack}>
                          <View
                            style={[
                              styles.catFill,
                              { width: `${catPct}%` as `${number}%` },
                              over && styles.catFillOver,
                            ]}
                          />
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
                  <Pressable
                    onPress={() => setShowCatForm((v) => !v)}
                    style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name={showCatForm ? 'chevron-up' : 'add'} size={15} color={ACCENT} />
                    <Text style={styles.addBtnText}>{showCatForm ? 'Cancelar' : 'Nueva categoría'}</Text>
                  </Pressable>
                </View>
                {showCatForm && (
                  <View style={styles.catForm}>
                    <InlineField label="Nombre" value={catName} onChangeText={setCatName} placeholder="Ej. Vuelos" autoFocus />
                    <InlineField
                      label="Presupuesto"
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
                              <Ionicons name={info.icon} size={17} color={active ? ACCENT : colors.secondary} />
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
                {plan.categories.length === 0 && !showCatForm && (
                  <Text style={styles.emptyHint}>Crea categorías para presupuestar el plan.</Text>
                )}
              </View>
            </ScrollView>
          ) : (
            /* ── Tab Saldos ── */
            <ScrollView
              style={styles.tabScroll}
              contentContainerStyle={styles.tabContent}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(e) => handleScroll(e.nativeEvent.contentOffset.y)}
            >
              {/* Banner */}
              <View style={[styles.banner, { borderColor: bannerColor + '33', backgroundColor: bannerColor + '12' }]}>
                <Ionicons name={bannerIcon} size={22} color={bannerColor} />
                <Text style={[styles.bannerText, { color: bannerColor }]}>{bannerText}</Text>
              </View>

              {/* Saldos por miembro */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Saldos</Text>
                <View style={styles.detailList}>
                  {memberBalances.map(({ member, totalPaid, netBalance: net }, i) => (
                    <View key={member.id}>
                      {i > 0 && <View style={styles.separator} />}
                      <View style={styles.balanceRow}>
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
                    </View>
                  ))}
                </View>
              </View>

              {/* Cómo saldar */}
              {debtEdges.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Cómo saldar</Text>
                  <View style={styles.detailList}>
                    {debtEdges.map((edge, i) => (
                      <View key={i}>
                        {i > 0 && <View style={styles.separator} />}
                        <View style={styles.debtRow}>
                          <View style={[styles.debtAvatar, { backgroundColor: edge.from.bg }]}>
                            <Text style={[styles.debtInitials, { color: edge.from.color }]}>{edge.from.initials}</Text>
                          </View>
                          <Ionicons name="arrow-forward" size={13} color={colors.muted} />
                          <View style={[styles.debtAvatar, { backgroundColor: edge.to.bg }]}>
                            <Text style={[styles.debtInitials, { color: edge.to.color }]}>{edge.to.initials}</Text>
                          </View>
                          <Text style={styles.debtNames}>{edge.from.name} → {edge.to.name}</Text>
                          <Text style={styles.debtAmt}>{fmt(edge.amount, currency)}</Text>
                          <Pressable
                            onPress={() => { setSettlementEdge(edge); setSettlementOpen(true); }}
                            style={({ pressed }) => [styles.saldarBtn, pressed && styles.pressed]}
                          >
                            <Text style={styles.saldarBtnText}>Saldar</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {debtEdges.length === 0 && plan.expenses.length > 0 && (
                <View style={styles.settledCard}>
                  <Ionicons name="checkmark-circle" size={26} color="#059669" />
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

          {/* ── Footer ── */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable
              onPress={openAddExpense}
              style={({ pressed }) => [styles.actionButton, styles.accentActionButton, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={20} color={ACCENT} />
              <Text style={[styles.actionText, styles.accentActionText]} numberOfLines={1} adjustsFontSizeToFit>
                Añadir
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { onClose(); setTimeout(onEdit, 120); }}
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="square-edit-outline" size={20} color={colors.actionText} />
              <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit>Editar</Text>
            </Pressable>
            <Pressable
              onPress={handleDeletePlan}
              style={({ pressed }) => [styles.actionButton, styles.deleteButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.expense} />
              <Text style={[styles.actionText, styles.deleteText]} numberOfLines={1} adjustsFontSizeToFit>
                Eliminar
              </Text>
            </Pressable>
          </View>
        </View>
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
        onEdit={(exp) => {
          setDetailExpense(null);
          setEditingExpense(exp);
          setExpenseModalOpen(true);
        }}
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

// --- ExpenseDetailSheet (bottom sheet) ----------------------------------------

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
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = useMemo(() => makeColors(theme), [theme]);
  const sheet = useMemo(() => makeSheet(colors), [colors]);

  if (!expense) return null;

  const cat = plan.categories.find((c) => c.id === expense.categoryId);
  const catInfo = cat ? (CATEGORIES[cat.icon] ?? CATEGORIES.map) : null;
  const splitModeLabel =
    expense.splitMode === 'equal'
      ? 'Partes iguales'
      : expense.splitMode === 'parts'
      ? 'Por partes'
      : 'Por porcentaje';

  const payer = plan.members.find((m) => m.id === expense.memberId);

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={sheet.overlay}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <Pressable
          accessibilityLabel="Cerrar detalles"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View style={[sheet.sheetContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>

          {/* Header */}
          <View style={sheet.header}>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => [sheet.backButton, pressed && sheet.pressed]}
            >
              <Ionicons name="arrow-back" size={29} color={colors.text} />
            </Pressable>
            <View style={sheet.headerCopy}>
              <Text
                style={sheet.title}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {expense.title}
              </Text>
              <Text style={sheet.subtitle}>Gasto del plan</Text>
            </View>
          </View>

          <ScrollView
            style={sheet.scroll}
            contentContainerStyle={sheet.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Amount hero card */}
            <View style={sheet.amountCard}>
              <Text
                style={sheet.amount}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {fmt(expense.amount, currency)}
              </Text>
              <View style={sheet.badgeRow}>
                {payer && (
                  <View style={[sheet.badge, sheet.payerBadge]}>
                    <View style={[sheet.payerDot, { backgroundColor: payer.bg }]}>
                      <Text style={[sheet.payerDotText, { color: payer.color }]}>{payer.initials}</Text>
                    </View>
                    <Text style={[sheet.badgeText, { color: colors.secondary }]}>
                      {payer.id === currentUser ? `${payer.name} (Yo)` : payer.name}
                    </Text>
                  </View>
                )}
                {cat && catInfo && (
                  <View style={[sheet.badge, sheet.accentBadge]}>
                    <Ionicons name={catInfo.icon} size={13} color={ACCENT} />
                    <Text style={[sheet.badgeText, { color: ACCENT }]}>{cat.name.toUpperCase()}</Text>
                  </View>
                )}
                <View style={[sheet.badge, sheet.neutralBadge]}>
                  <Ionicons name="git-branch-outline" size={13} color={colors.secondary} />
                  <Text style={[sheet.badgeText, { color: colors.secondary }]}>
                    {splitModeLabel.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Splits detail list */}
            <View style={sheet.detailList}>
              <View style={[sheet.detailRow, { paddingBottom: 8 }]}>
                <View style={sheet.detailLeading}>
                  <View style={sheet.detailIconCircle}>
                    <Ionicons name="people-outline" size={17} color={colors.text} />
                  </View>
                </View>
                <View style={sheet.detailCopy}>
                  <Text style={sheet.detailLabel}>División</Text>
                </View>
              </View>
              {(expense.splits.length > 0 ? expense.splits : plan.members.map((m) => ({
                memberId: m.id,
                amount: Math.round(expense.amount / plan.members.length * 100) / 100,
                parts: undefined,
                pct: undefined,
              }))).map((sp, i) => {
                const member = plan.members.find((m) => m.id === sp.memberId);
                if (!member) return null;
                const partLabel = sp.parts != null ? `${sp.parts}x` : sp.pct != null ? `${sp.pct}%` : null;
                return (
                  <View key={sp.memberId}>
                    {i > 0 && <View style={sheet.separator} />}
                    <View style={sheet.splitRow}>
                      <View style={[sheet.splitAvatar, { backgroundColor: member.bg }]}>
                        <Text style={[sheet.splitInitials, { color: member.color }]}>{member.initials}</Text>
                      </View>
                      <Text style={sheet.splitName}>
                        {member.id === currentUser ? `${member.name} (Yo)` : member.name}
                      </Text>
                      {partLabel ? (
                        <View style={sheet.splitLabelChip}>
                          <Text style={sheet.splitLabelText}>{partLabel}</Text>
                        </View>
                      ) : null}
                      <Text style={sheet.splitAmt}>{fmt(sp.amount, currency)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Metadata detail list */}
            <View style={sheet.detailList}>
              {/* Fecha + Categoría */}
              <View style={sheet.twoColRow}>
                <View style={[sheet.detailRow, { flex: 1 }]}>
                  <View style={sheet.detailLeading}>
                    <View style={sheet.detailIconCircle}>
                      <Ionicons name="calendar-outline" size={17} color={colors.text} />
                    </View>
                  </View>
                  <View style={sheet.detailCopy}>
                    <Text style={sheet.detailLabel}>Fecha</Text>
                    <Text style={sheet.detailValue}>{formatDateShort(expense.date)}</Text>
                  </View>
                </View>
                <View style={sheet.colDivider} />
                <View style={[sheet.detailRow, { flex: 1 }]}>
                  <View style={sheet.detailLeading}>
                    <View style={sheet.detailIconCircle}>
                      <Ionicons
                        name={catInfo ? catInfo.icon : 'grid-outline'}
                        size={17}
                        color={colors.text}
                      />
                    </View>
                  </View>
                  <View style={sheet.detailCopy}>
                    <Text style={sheet.detailLabel}>Categoría</Text>
                    <Text style={sheet.detailValue}>{cat ? cat.name : 'Sin categoría'}</Text>
                  </View>
                </View>
              </View>

              {expense.note ? (
                <>
                  <View style={sheet.separator} />
                  <View style={sheet.detailRow}>
                    <View style={sheet.detailLeading}>
                      <View style={sheet.detailIconCircle}>
                        <Ionicons name="document-text-outline" size={17} color={colors.text} />
                      </View>
                    </View>
                    <View style={sheet.detailCopy}>
                      <Text style={sheet.detailLabel}>Nota</Text>
                      <Text style={sheet.detailValue}>{expense.note}</Text>
                    </View>
                  </View>
                </>
              ) : null}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={sheet.footer}>
            <Pressable
              onPress={() => onEdit(expense)}
              style={({ pressed }) => [sheet.actionButton, pressed && sheet.pressed]}
            >
              <MaterialCommunityIcons name="square-edit-outline" size={20} color={colors.actionText} />
              <Text style={sheet.actionText} numberOfLines={1} adjustsFontSizeToFit>Editar</Text>
            </Pressable>
            <Pressable
              onPress={() => onDelete(expense)}
              style={({ pressed }) => [sheet.actionButton, sheet.deleteButton, pressed && sheet.pressed]}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.expense} />
              <Text style={[sheet.actionText, sheet.deleteText]} numberOfLines={1} adjustsFontSizeToFit>
                Eliminar
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// --- InlineField --------------------------------------------------------------

function InlineField({ label, style, ...props }: ComponentProps<typeof TextInput> & { label: string; style?: any }) {
  const theme = useTheme();
  const colors = useMemo(() => makeColors(theme), [theme]);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.inlineField, style]}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <TextInput placeholderTextColor={theme.textMuted} style={styles.inlineInput} {...props} />
    </View>
  );
}

const QUICK_ICONS = ['travel', 'restaurant', 'hotel', 'transport', 'map', 'drinks', 'coffee', 'shopping', 'wellness', 'home', 'car', 'train'];

// =============================================================================
// Styles — PlanDetailModal (full-screen)
// =============================================================================

const makeStyles = (colors: ReturnType<typeof makeColors>) => StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },

  // -- Header --
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  backButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
    paddingRight: 4,
    paddingTop: 2,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
    letterSpacing: 0,
    lineHeight: 27,
  },
  subtitle: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 1,
  },
  headerIconBtn: {
    alignItems: 'center',
    backgroundColor: colors.iconBg,
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },

  // -- Sticky top --
  stickyTop: {
    backgroundColor: colors.background,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  // -- Collapsible wrapper --
  detailAnimWrapper: {
    overflow: 'hidden',
  },

  // -- Hero card: Mis gastos + Total --
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    flexDirection: 'column',
    marginBottom: 14,
    overflow: 'hidden',
  },
  heroCell: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    paddingVertical: 16,
  },
  heroDivider: {
    alignSelf: 'stretch',
    backgroundColor: colors.cardBorder,
    height: 1,
    marginHorizontal: 16,
  },
  heroLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroValue: {
    color: colors.text,
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    letterSpacing: 0,
    lineHeight: 33,
  },
  heroValueAccent: {
    color: ACCENT,
  },
  heroProgressRow: {
    gap: 6,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  heroProgressTrack: {
    backgroundColor: colors.cardBorder,
    borderRadius: 4,
    height: 5,
    overflow: 'hidden',
  },
  heroProgressFill: {
    backgroundColor: ACCENT,
    borderRadius: 4,
    height: '100%',
  },
  heroProgressOver: {
    backgroundColor: colors.expense,
  },
  heroProgressLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  // -- Detail list --
  detailList: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  detailLeading: {
    width: 42,
  },
  detailIconCircle: {
    alignItems: 'center',
    backgroundColor: colors.iconBg,
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
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  separator: {
    backgroundColor: colors.cardBorder,
    height: 1,
  },
  twoColRow: {
    flexDirection: 'row',
  },
  colDivider: {
    alignSelf: 'stretch',
    backgroundColor: colors.cardBorder,
    width: 1,
  },
  memberAvatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  miniAvatar: {
    alignItems: 'center',
    borderColor: colors.card,
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  miniAvatarText: {
    fontSize: 7,
    fontWeight: '800',
  },
  memberCountText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },

  // -- Segmented pill control --
  segmentContainer: {
    backgroundColor: colors.card,
    borderRadius: 14,
    flexDirection: 'row',
    height: 46,
    padding: 4,
    position: 'relative',
  },
  segmentPill: {
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT,
    borderRadius: 10,
    borderWidth: 1,
    bottom: 4,
    left: 4,
    position: 'absolute',
    top: 4,
  },
  segmentBtn: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  segmentText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: ACCENT,
  },

  // -- Tab content --
  tabScroll: {
    flex: 1,
  },
  tabContent: {
    gap: 16,
    padding: 16,
    paddingBottom: 24,
  },

  // -- Empty state --
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.secondary,
    fontSize: 13,
  },
  emptyHint: {
    color: colors.muted,
    fontSize: 13,
  },

  // -- Date groups --
  dateGroup: {
    gap: 6,
  },
  dateLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  expenseCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
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
    borderTopColor: colors.cardBorder,
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
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  expensePaidBy: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  expensePaidByName: {
    color: colors.secondary,
    fontWeight: '700',
  },
  expenseAmt: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },

  // -- Category budget cards --
  section: {
    gap: 10,
  },
  sectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
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
    backgroundColor: colors.card,
    borderRadius: 12,
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
    color: colors.text,
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
    color: colors.expense,
  },
  catTrack: {
    backgroundColor: colors.cardBorder,
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
    backgroundColor: colors.expense,
  },
  catAmounts: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },

  // -- Add category form --
  catForm: {
    backgroundColor: colors.card,
    borderRadius: 14,
    gap: 12,
    padding: 12,
  },
  inlineField: { gap: 5 },
  inlineLabel: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  inlineInput: {
    backgroundColor: colors.background,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  iconRow: { flexGrow: 0 },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: colors.iconBg,
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

  // -- Tab Saldos --
  banner: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '800',
  },
  balanceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  balancePaid: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  balanceNet: {
    fontSize: 15,
    fontWeight: '800',
  },
  balancePos: { color: '#059669' },
  balanceNeg: { color: colors.expense },

  debtRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  debtAmt: {
    color: colors.expense,
    fontSize: 14,
    fontWeight: '800',
  },
  settledCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderColor: 'rgba(5, 150, 105, 0.3)',
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
    backgroundColor: colors.card,
    borderRadius: 20,
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
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 100,
  },

  // -- Saldar button --
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

  // -- Footer --
  footer: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.actionBg,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 50,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 8,
  },
  actionText: {
    color: colors.actionText,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  accentActionButton: {
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT,
  },
  accentActionText: {
    color: ACCENT,
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 89, 104, 0.12)',
    borderColor: 'rgba(255, 89, 104, 0.24)',
  },
  deleteText: {
    color: colors.expense,
  },

  pressed: { opacity: 0.65 },
});

// =============================================================================
// Styles — ExpenseDetailSheet (bottom sheet)
// =============================================================================

const MAX_SHEET_WIDTH = 430;

const makeSheet = (colors: ReturnType<typeof makeColors>) => StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    maxWidth: MAX_SHEET_WIDTH,
    overflow: 'hidden',
    paddingTop: 2,
    width: '100%',
  },

  // Header
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 13,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
    paddingRight: 10,
    paddingTop: 4,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
    letterSpacing: 0,
    lineHeight: 27,
  },
  subtitle: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 1,
  },

  // Scroll
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },

  // Amount hero card
  amountCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  amount: {
    color: colors.text,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 42,
    letterSpacing: 0,
    lineHeight: 50,
    maxWidth: '92%',
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  badge: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
  },
  payerBadge: {
    backgroundColor: colors.iconBg,
  },
  payerDot: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  payerDotText: {
    fontSize: 7,
    fontWeight: '800',
  },
  accentBadge: {
    backgroundColor: ACCENT_BG,
  },
  neutralBadge: {
    backgroundColor: colors.iconBg,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Detail list
  detailList: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  detailLeading: {
    width: 42,
  },
  detailIconCircle: {
    alignItems: 'center',
    backgroundColor: colors.iconBg,
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
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  separator: {
    backgroundColor: colors.cardBorder,
    height: 1,
  },
  twoColRow: {
    flexDirection: 'row',
  },
  colDivider: {
    alignSelf: 'stretch',
    backgroundColor: colors.cardBorder,
    width: 1,
  },

  // Splits
  splitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  splitAvatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  splitInitials: {
    fontSize: 10,
    fontWeight: '800',
  },
  splitName: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  splitLabelChip: {
    backgroundColor: ACCENT_BG,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  splitLabelText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '800',
  },
  splitAmt: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '700',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.actionBg,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 50,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 8,
  },
  actionText: {
    color: colors.actionText,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 89, 104, 0.12)',
    borderColor: 'rgba(255, 89, 104, 0.24)',
  },
  deleteText: {
    color: colors.expense,
  },

  pressed: { opacity: 0.65 },
});
