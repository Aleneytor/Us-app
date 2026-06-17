import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Animated,
  Alert,
  Easing,
  FlatList,
  Image,
  Modal as NativeModal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { AppModal as Modal } from '../../components/AppModal';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import { ActivityTile } from '../../components/ActivityTile';
import { GoalDetailModal } from '../../components/GoalDetailModal';
import { TransactionModal } from '../../modals/TransactionModal';
import { PlanDetailModal } from '../../modals/PlanDetailModal';
import { PlanModal } from '../../modals/PlanModal';
import { SavingPlanDetailModal } from '../../modals/SavingPlanDetailModal';
import { CATEGORIES } from '../../constants/categories';
import { getIconColor, type AppTheme } from '../../constants/colors';
import { SURFACE_SHADOW } from '../../constants/shadows';
import { SECTION_TITLE_FONT_FAMILY } from '../../constants/typography';
import type { CurrencyCode, Goal, Plan, SavingPlan, Transaction, UserData } from '../../types';
import { getTransactionAmountForMonth } from '../../utils/filters';
import { MONTHS_ES, fmt, splitAmount } from '../../utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useTabPadding } from '../../hooks/useTabPadding';
import { dismissKeyboardAndBlur } from '../../utils/keyboard';
import { getPartnerId, getUserData } from '../../utils/users';
import { buildActivityFeed } from '../../utils/activityFeed';
import type { ActivityItem } from '../../utils/activityFeed';
import { reportFabScroll } from '../../utils/fabScroll';
import { useTheme } from '../../contexts/ThemeContext';
import { SvgXml } from 'react-native-svg';

const HERO_THRESHOLD = 170;

const HOME_TOP_GRADIENT = ['#9933FF', '#A44BFF', '#B86EFF', '#D5ADFF', '#F2F2F7'] as const;
const INCOME_ACCENT = '#00D158';
const EXPENSE_ACCENT = '#FF0B4F';
const BALANCE_ACCENT = '#7C3AED';
const OJITO_ABIERTO_XML = `<svg width="38" height="24" viewBox="0 0 38 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.54492 14.0665C8.34492 -2.62765 28.7449 -2.62765 35.5449 14.0665" stroke="black" stroke-width="3.09091" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.3751 21.9367C17.0626 22.2513 17.7995 22.4132 18.5436 22.4132C20.0465 22.4132 21.4879 21.7536 22.5506 20.5796C23.6133 19.4056 24.2103 17.8132 24.2103 16.1529C24.2103 14.4926 23.6133 12.9002 22.5506 11.7262C21.4879 10.5521 20.0465 9.89258 18.5436 9.89258C17.7995 9.89258 17.0626 10.0545 16.3751 10.3691C15.6876 10.6837 15.0629 11.1449 14.5367 11.7262C14.0105 12.3075 13.5931 12.9976 13.3083 13.7572C13.0235 14.5167 12.877 15.3308 12.877 16.1529C12.877 16.975 13.0235 17.7891 13.3083 18.5486C13.5931 19.3082 14.0105 19.9983 14.5367 20.5796C15.0629 21.1609 15.6876 21.6221 16.3751 21.9367Z" stroke="black" stroke-width="3.09091" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const OJITO_CERRADO_XML = `<svg width="38" height="16" viewBox="0 0 38 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.54492 14.0665C8.34492 -2.62765 28.7449 -2.62765 35.5449 14.0665" stroke="black" stroke-width="3.09091" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Buenos dias';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function getDateLabel(date: Date): string {
  const formatted = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function shiftYM(ym: string, delta: number): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function sumActivityTotals(items: ActivityItem[], ym: string) {
  const expenses = items
    .filter((item) => item.kind === 'expense')
    .reduce((sum, item) => {
      if (item.source === 'transaction') {
        return sum + getTransactionAmountForMonth(item.transaction, ym);
      }
      if (item.source === 'plan_expense') {
        return sum + item.amount;
      }
      if (item.source === 'plan_settlement' && item.kind === 'expense') {
        return sum + item.amount;
      }
      return sum;
    }, 0);
  const income = items
    .filter((item) => item.kind === 'income')
    .reduce((sum, item) => (
      sum + (item.source === 'transaction'
        ? getTransactionAmountForMonth(item.transaction, ym)
        : item.source === 'plan_settlement' && item.kind === 'income'
          ? item.amount
          : 0)
    ), 0);
  return { expenses, income, balance: income - expenses };
}

type KindFilter = 'all' | 'expense' | 'income';
type OwnerFilter = 'mine' | 'partner' | 'both';
type FrequencyFilter = 'all' | 'monthly' | 'biweekly' | 'weekly' | 'once';

interface Option<T extends string> {
  label: string;
  value: T;
  icon?: ComponentProps<typeof Ionicons>['name'];
  color?: string;
}

export default function MovimientosScreen() {
  const tabPadding = useTabPadding();
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const setSelectedYM = useAppStore((s) => s.setSelectedYM);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const currency = useAppStore((s) => s.currency);
  const users = useAppStore((s) => s.users);
  const partnerForUser = useAppStore((s) => s.partnerForUser);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const gradientColors = useMemo(() => {
    return ['#9933FF', '#A44BFF', '#B86EFF', '#D5ADFF', theme.background] as const;
  }, [theme.background]);
  const router = useRouter();
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('mine');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('all');
  const [reportHidden, setReportHidden] = useState({ income: false, expense: false, balance: false });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedPlanInitialTab, setSelectedPlanInitialTab] = useState<'detalles' | 'gastos' | 'saldos'>('detalles');
  const [selectedSaving, setSelectedSaving] = useState<SavingPlan | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [activeModal, setActiveModal] = useState<'autor_cat' | 'tipo_frec' | null>(null);
  const [monthPickerY, setMonthPickerY] = useState<number | null>(null);
  const [showFloating, setShowFloating] = useState(false);
  const listRef = useRef<FlatList<ActivityItem>>(null);
  const scrolledPastHeroRef = useRef(false);
  const user = getUserData(users, currentUser);
  const partner = getPartnerId(partnerForUser, currentUser);
  const partnerUser = getUserData(users, partner);
  const insets = useSafeAreaInsets();
  const now = new Date();
  const headerTopPadding = Math.max(insets.top + 18, 52);

  const { heroAnim, contentAnim } = useEntranceAnimation({
    animateOnFocus: false,
    scrollRef: listRef,
    onResetScroll: () => {
      reportFabScroll(0);
      scrolledPastHeroRef.current = false;
      setShowFloating(false);
    },
  });

  const categoryOptions = useMemo<Array<Option<string>>>(() => {
    const list = (payload.budgetCategories ?? [])
      .filter((category) => category.uid === undefined || category.uid === currentUser)
      .map((category) => ({
        value: String(category.id),
        label: category.name,
        icon: CATEGORIES[category.icon ?? 'other']?.icon ?? CATEGORIES.other.icon,
        color: getIconColor(category.iconColor).color,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Append "Sin categoría" option
    list.push({
      value: 'null',
      label: 'Sin categoría',
      icon: 'help-circle-outline',
      color: theme.textMuted,
    });

    return list;
  }, [currentUser, payload.budgetCategories, theme.textMuted]);

  useEffect(() => {
    const validCategoryValues = new Set(categoryOptions.map((option) => option.value));
    setCategoryFilter((current) => {
      const next = current.filter((value) => validCategoryValues.has(value));
      return next.length === current.length ? current : next;
    });
  }, [categoryOptions]);

  const toggleCategoryFilter = (value: string) => {
    setCategoryFilter((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    ));
  };

  const activeFilterCount = [
    kindFilter !== 'all',
    ownerFilter !== 'mine',
    categoryFilter.length > 0,
    frequencyFilter !== 'all',
  ].filter(Boolean).length;

  const filtered = useMemo<ActivityItem[]>(() => {
    const activities = buildActivityFeed(payload, {
      currentUser,
      selectedYM,
    });

    return activities
      .filter((item) => {
        const targetOwner = ownerFilter === 'mine' ? currentUser : partner;
        const ownerMatches =
          ownerFilter === 'both' ||
          item.ownerId === targetOwner;
        const categoryMatches = categoryFilter.length === 0 ||
          (
            item.source === 'transaction' &&
            (
              (item.transaction.budgetCatId !== undefined && item.transaction.budgetCatId !== null && categoryFilter.includes(String(item.transaction.budgetCatId))) ||
              ((item.transaction.budgetCatId === undefined || item.transaction.budgetCatId === null) && categoryFilter.includes('null'))
            )
          );
        const kindMatches = kindFilter === 'all' || item.kind === kindFilter;
        const frequencyMatches = frequencyFilter === 'all' ||
          (item.source === 'transaction' && item.transaction.type === frequencyFilter);

        return ownerMatches && categoryMatches && kindMatches && frequencyMatches;
      })
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        return byDate !== 0 ? byDate : b.sortId - a.sortId;
      });
  }, [categoryFilter, currentUser, frequencyFilter, kindFilter, ownerFilter, partner, payload, selectedYM]);

  const totals = useMemo(() => sumActivityTotals(filtered, selectedYM), [filtered, selectedYM]);

  // Totales del mes sin filtrar: alimentan la tarjeta "Reporte del mes" y
  // nunca cambian al aplicar filtros sobre la lista de movimientos.
  const monthTotals = useMemo(() => {
    const activities = buildActivityFeed(payload, { currentUser, selectedYM })
      .filter((item) => item.ownerId === currentUser);
    return sumActivityTotals(activities, selectedYM);
  }, [currentUser, payload, selectedYM]);

  const listAnimationKey = useMemo(
    () => [
      selectedYM,
      kindFilter,
      ownerFilter,
      frequencyFilter,
      categoryFilter.join(','),
      filtered.map((t) => t.id).join(','),
    ].join('|'),
    [categoryFilter, filtered, frequencyFilter, kindFilter, ownerFilter, selectedYM],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  const handleScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y;
    reportFabScroll(y);
    const past = y > HERO_THRESHOLD;
    if (past !== scrolledPastHeroRef.current) {
      scrolledPastHeroRef.current = past;
      setShowFloating(past);
    }
  };

  const openEdit = (transaction: Transaction) => {
    setEditTransaction(transaction);
    setSelectedTransaction(null);
  };

  const confirmDelete = (transaction: Transaction) => {
    Alert.alert(
      'Eliminar movimiento',
      transaction.desc || 'Este movimiento se ocultara para todos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteTransaction(transaction.id);
            setSelectedTransaction(null);
          },
        },
      ],
    );
  };

  const showActions = (transaction: Transaction) => {
    Alert.alert(
      transaction.desc || 'Movimiento',
      'Elige una acción',
      [
        { text: 'Editar', onPress: () => openEdit(transaction) },
        { text: 'Eliminar', style: 'destructive', onPress: () => confirmDelete(transaction) },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  const openActivityDetails = (item: ActivityItem) => {
    if (item.source === 'transaction') {
      setSelectedTransaction(item.transaction);
      return;
    }
    if (item.source === 'saving_created' || item.source === 'saving_contribution') {
      setSelectedSaving(payload.savings.find((saving) => saving.id === item.savingId) ?? null);
      return;
    }
    if (item.source === 'goal_created' || item.source === 'goal_contribution') {
      setSelectedGoal(payload.goals.find((goal) => goal.id === item.goalId) ?? null);
      return;
    }
    if (item.source === 'plan_expense') {
      setSelectedPlanInitialTab('gastos');
      setSelectedPlanId(item.planId);
      return;
    }
    if (item.source === 'plan_settlement') {
      setSelectedPlanInitialTab('saldos');
      setSelectedPlanId(item.planId);
      return;
    }
    if (item.source === 'plan_created') {
      setSelectedPlanInitialTab('detalles');
      setSelectedPlanId(item.planId);
    }
  };


  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        extraData={listAnimationKey}
        overScrollMode="auto"
        onScroll={handleScroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={dismissKeyboardAndBlur}
        scrollEventThrottle={60}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          <LinearGradient
            colors={gradientColors}
            locations={[0, 0.45, 0.72, 0.92, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          >
            <Animated.View style={{ opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
              <View style={styles.heroHeader}>
                <View style={[styles.headerRow, { paddingTop: headerTopPadding }]}>
                  <Pressable
                    accessibilityLabel="Abrir perfil"
                    onPress={() => router.push('/perfil')}
                    style={({ pressed }) => [styles.headerAvatarButton, pressed && styles.pressed]}
                    hitSlop={8}
                  >
                    <View style={[styles.headerAvatar, { backgroundColor: user.bg }]}>
                      {user.photo ? (
                        <Image source={user.photo} style={styles.headerAvatarImage} />
                      ) : (
                        <Text style={[styles.headerAvatarInitials, { color: user.color }]}>
                          {user.initials}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                  <View style={styles.headerTextWrap}>
                    <Text style={styles.headerGreeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                      {getGreeting(now)}, {user.name}
                    </Text>
                    <Text style={styles.headerDate} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.88}>
                      {getDateLabel(now)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Abrir ajustes"
                    onPress={() => router.push('/perfil')}
                    style={({ pressed }) => [styles.headerSettingsButton, pressed && styles.pressed]}
                    hitSlop={8}
                  >
                    <Ionicons name="settings-outline" size={25} color="#FFFFFF" />
                  </Pressable>
                </View>

                <Text style={styles.reportTitle}>Reporte del mes</Text>

                <MonthPillsNavigator
                  ym={selectedYM}
                  onChange={setSelectedYM}
                  onOpenPicker={setMonthPickerY}
                />

                <ReportCard
                  income={monthTotals.income}
                  expenses={monthTotals.expenses}
                  balance={monthTotals.balance}
                  currency={currency}
                  hidden={reportHidden}
                  onToggle={(key) => setReportHidden((h) => ({ ...h, [key]: !h[key] }))}
                />
              </View>
            </Animated.View>

            <Animated.View style={[styles.controls, { opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
              <View style={styles.filterSectionHead}>
                <Text style={styles.filterSectionTitle}>Movimientos</Text>
              </View>

              <FilterPillBar
                user={user}
                partnerUser={partnerUser}
                ownerFilter={ownerFilter}
                categoryFilter={categoryFilter}
                categoryOptions={categoryOptions}
                kindFilter={kindFilter}
                frequencyFilter={frequencyFilter}
                onPressAutorCat={() => setActiveModal('autor_cat')}
                onPressTipoFrec={() => setActiveModal('tipo_frec')}
              />
              {activeFilterCount > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Limpiar filtros"
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setOwnerFilter('mine');
                    setKindFilter('all');
                    setFrequencyFilter('all');
                    setCategoryFilter([]);
                  }}
                  style={({ pressed }) => [styles.clearFiltersInlineButton, pressed && styles.pressed]}
                >
                  <Ionicons name="refresh-outline" size={15} color={theme.textSecondary} />
                  <Text style={styles.clearFiltersInlineText}>Limpiar filtros</Text>
                </Pressable>
              )}

            </Animated.View>

            <View style={styles.filterSection} />
          </LinearGradient>
        }
        ListEmptyComponent={
          <AnimatedEmptyState animationKey={listAnimationKey} />
        }
        ListFooterComponent={
          <View style={[styles.movementsSectionFooter, { height: tabPadding + 16 }]} />
        }
        renderItem={({ item, index }) => (
          <HistoryActivityItem
            activity={item}
            ym={selectedYM}
            index={index}
            animationKey={listAnimationKey}
            onPress={() => openActivityDetails(item)}
            onLongPress={() => {
              if (item.source === 'transaction') showActions(item.transaction);
            }}
          />
        )}
      />

      <TransactionDetailModal
        transaction={selectedTransaction}
        ym={selectedYM}
        onClose={() => setSelectedTransaction(null)}
        onEdit={openEdit}
        onDelete={confirmDelete}
      />

      <TransactionModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <TransactionModal
        visible={!!editTransaction}
        transaction={editTransaction}
        onClose={() => setEditTransaction(null)}
      />
      <SavingPlanDetailModal
        plan={selectedSaving}
        onClose={() => setSelectedSaving(null)}
        onEdit={() => setSelectedSaving(null)}
      />
      <GoalDetailModal
        goal={selectedGoal}
        contribs={payload.contribs}
        currency={currency}
        users={users}
        onClose={() => setSelectedGoal(null)}
      />
      <PlanDetailModal
        plan={(payload.plans ?? []).find((plan) => plan.id === selectedPlanId) ?? null}
        initialTab={selectedPlanInitialTab}
        onClose={() => setSelectedPlanId(null)}
        onEdit={() => {
          const plan = (payload.plans ?? []).find((item) => item.id === selectedPlanId) ?? null;
          setSelectedPlanId(null);
          setTimeout(() => setEditPlan(plan), 120);
        }}
      />
      <PlanModal
        visible={!!editPlan}
        plan={editPlan}
        onClose={() => setEditPlan(null)}
      />

      <AutorCatFilterModal
        visible={activeModal === 'autor_cat'}
        onClose={() => setActiveModal(null)}
        ownerFilter={ownerFilter}
        onOwnerChange={setOwnerFilter}
        categoryFilter={categoryFilter}
        onToggleCategory={toggleCategoryFilter}
        onClearCategory={() => setCategoryFilter([])}
        categoryOptions={categoryOptions}
        user={user}
        partnerUser={partnerUser}
      />

      <TipoFrecFilterModal
        visible={activeModal === 'tipo_frec'}
        onClose={() => setActiveModal(null)}
        kindFilter={kindFilter}
        onKindChange={setKindFilter}
        frequencyFilter={frequencyFilter}
        onFrequencyChange={setFrequencyFilter}
      />

      {monthPickerY !== null && (
        <MonthPickerDropdown
          anchorY={monthPickerY}
          ym={selectedYM}
          onChange={(ym) => { setSelectedYM(ym); setMonthPickerY(null); }}
          onClose={() => setMonthPickerY(null)}
        />
      )}
      <FloatingSummaryBar
        visible={showFloating}
        income={totals.income}
        expenses={totals.expenses}
        currency={currency}
      />
    </View>
  );
}


function AutorFilterIcon({
  value,
  user,
  partnerUser,
  isFiltered,
}: {
  value: OwnerFilter;
  user: UserData;
  partnerUser?: UserData;
  isFiltered: boolean;
}) {
  const borderColor = isFiltered ? '#7C3AED' : '#FFFFFF';

  if (value === 'mine') {
    return (
      <View style={[AVATAR_STYLES.avatarCircle, { backgroundColor: user.bg, borderColor }]}>
        {user.photo ? (
          <Image source={user.photo} style={AVATAR_STYLES.avatarImage} />
        ) : (
          <Text style={[AVATAR_STYLES.avatarInitials, { color: user.color }]}>
            {user.initials}
          </Text>
        )}
      </View>
    );
  }

  if (value === 'partner') {
    const pUser = partnerUser || { bg: '#EDE9FE', color: '#7C3AED', initials: 'P' } as UserData;
    return (
      <View style={[AVATAR_STYLES.avatarCircle, { backgroundColor: pUser.bg, borderColor }]}>
        {pUser.photo ? (
          <Image source={pUser.photo} style={AVATAR_STYLES.avatarImage} />
        ) : (
          <Text style={[AVATAR_STYLES.avatarInitials, { color: pUser.color }]}>
            {pUser.initials}
          </Text>
        )}
      </View>
    );
  }

  // 'both'
  const pUser = partnerUser || { bg: '#EDE9FE', color: '#7C3AED', initials: 'P' } as UserData;
  return (
    <View style={AVATAR_STYLES.bothAvatarsContainer}>
      <View style={[AVATAR_STYLES.bothAvatarLeft, { backgroundColor: user.bg, borderColor }]}>
        {user.photo ? (
          <Image source={user.photo} style={AVATAR_STYLES.bothAvatarImage} />
        ) : (
          <Text style={[AVATAR_STYLES.bothAvatarInitials, { color: user.color }]}>
            {user.initials}
          </Text>
        )}
      </View>
      <View style={[AVATAR_STYLES.bothAvatarRight, { backgroundColor: pUser.bg, borderColor }]}>
        {pUser.photo ? (
          <Image source={pUser.photo} style={AVATAR_STYLES.bothAvatarImage} />
        ) : (
          <Text style={[AVATAR_STYLES.bothAvatarInitials, { color: pUser.color }]}>
            {pUser.initials}
          </Text>
        )}
      </View>
    </View>
  );
}

function AnimatedEmptyState({ animationKey }: { animationKey: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 440,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, animationKey]);

  return (
    <Animated.View
      style={[
        styles.empty,
        styles.movementsSectionEmpty,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Ionicons name="receipt-outline" size={34} color={theme.textMuted} />
      <Text style={styles.emptyTitle}>Sin movimientos</Text>
      <Text style={styles.emptyText}>Ajusta los filtros o cambia de mes.</Text>
    </Animated.View>
  );
}

function HistoryActivityItem({
  activity,
  ym,
  index,
  animationKey,
  onPress,
  onLongPress,
}: {
  activity: ActivityItem;
  ym: string;
  index: number;
  animationKey: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    anim.setValue(0);
    const delay = Math.min(index, 8) * 12;
    const timer = setTimeout(() => {
      animation = Animated.timing(anim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start();
    }, delay);

    return () => {
      clearTimeout(timer);
      animation?.stop();
    };
  }, [anim, animationKey, index]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [index % 2 === 0 ? 4 : -4, 0],
  });

  return (
    <Animated.View style={[TRANSACTION_CARD_STYLE.transactionCard, { opacity: anim, transform: [{ translateY }] }]}>
      <ActivityTile
        activity={activity}
        ym={ym}
        onPress={onPress}
        onLongPress={onLongPress}
      />
    </Animated.View>
  );
}

// ─── MonthPillsNavigator ────────────────────────────────────────────────────

function MonthPillsNavigator({
  ym,
  onChange,
  onOpenPicker,
}: {
  ym: string;
  onChange: (ym: string) => void;
  onOpenPicker: (anchorY: number) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const pillRef = useRef<View>(null);
  const monthLabel = `${MONTHS_ES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

  const openPicker = () => {
    void Haptics.selectionAsync();
    pillRef.current?.measure((_, __, ___, height, ____, pageY) => {
      onOpenPicker(pageY + height);
    });
  };

  const shift = (delta: number) => {
    void Haptics.selectionAsync();
    onChange(shiftYM(ym, delta));
  };

  return (
    <View style={styles.monthPillsRow}>
      <Pressable
        accessibilityLabel="Mes anterior"
        onPress={() => shift(-1)}
        style={({ pressed }) => [styles.monthArrowPill, pressed && styles.pressed]}
      >
        <Ionicons name="caret-back" size={16} color="#FFFFFF" />
      </Pressable>
      <View ref={pillRef} collapsable={false} style={styles.monthCenterWrap}>
        <Pressable
          accessibilityLabel="Elegir mes"
          onPress={openPicker}
          style={({ pressed }) => [styles.monthCenterPill, pressed && styles.pressed]}
        >
          <Text style={styles.monthCenterText}>{monthLabel}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel="Mes siguiente"
        onPress={() => shift(1)}
        style={({ pressed }) => [styles.monthArrowPill, pressed && styles.pressed]}
      >
        <Ionicons name="caret-forward" size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

// ─── ReportCard ─────────────────────────────────────────────────────────────

type ReportRowKey = 'income' | 'expense' | 'balance';

function ReportCard({
  income,
  expenses,
  balance,
  currency,
  hidden,
  onToggle,
}: {
  income: number;
  expenses: number;
  balance: number;
  currency: CurrencyCode;
  hidden: Record<ReportRowKey, boolean>;
  onToggle: (key: ReportRowKey) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.reportCard}>
      <ReportRow
        label="Ingresos"
        value={income}
        accent={INCOME_ACCENT}
        currency={currency}
        hidden={hidden.income}
        onToggle={() => onToggle('income')}
      />
      <View style={styles.reportDivider} />
      <ReportRow
        label="Gastos"
        value={expenses}
        accent={EXPENSE_ACCENT}
        currency={currency}
        hidden={hidden.expense}
        onToggle={() => onToggle('expense')}
      />
      <View style={styles.reportDivider} />
      <ReportRow
        label="Balance"
        value={balance}
        accent={BALANCE_ACCENT}
        currency={currency}
        hidden={hidden.balance}
        onToggle={() => onToggle('balance')}
      />
    </View>
  );
}

function ReportRow({
  label,
  value,
  accent,
  currency,
  hidden,
  onToggle,
}: {
  label: string;
  value: number;
  accent: string;
  currency: CurrencyCode;
  hidden: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const amount = splitAmount(value, currency);
  const decimalSeparator = currency === 'USD' ? '.' : ',';

  return (
    <View style={styles.reportRow}>
      <Text style={styles.reportLabel} numberOfLines={1}>{label}</Text>
      <View style={[styles.reportBar, { backgroundColor: accent }]} />
      <View style={styles.reportAmountWrap}>
        {hidden ? (
          <Text style={styles.reportAmount}>••••••</Text>
        ) : (
          <Text style={styles.reportAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.56}>
            {amount.sign}{amount.whole}
            <Text style={[styles.reportDecimals, { color: accent }]}>
              {decimalSeparator}{amount.decimals}{amount.symbol}
            </Text>
          </Text>
        )}
      </View>
      <Pressable
        accessibilityLabel={hidden ? `Mostrar ${label}` : `Ocultar ${label}`}
        onPress={onToggle}
        hitSlop={8}
        style={({ pressed }) => [styles.reportEyeButton, pressed && styles.pressed]}
      >
        <PrivacyEyeIcon hidden={hidden} size={22} color="#000000" />
      </Pressable>
    </View>
  );
}

// ─── FilterPillBar ──────────────────────────────────────────────────────────

function PrivacyEyeIcon({ hidden, size = 22, color = '#000000' }: { hidden: boolean; size?: number; color?: string }) {
  const xml = (hidden ? OJITO_CERRADO_XML : OJITO_ABIERTO_XML).replace(/black/g, color);
  return (
    <SvgXml xml={xml} width={size} height={hidden ? size * 0.42 : size * 0.64} />
  );
}

function FilterPillBar({
  user,
  partnerUser,
  ownerFilter,
  categoryFilter,
  categoryOptions,
  kindFilter,
  frequencyFilter,
  onPressAutorCat,
  onPressTipoFrec,
}: {
  user: UserData;
  partnerUser?: UserData;
  ownerFilter: OwnerFilter;
  categoryFilter: string[];
  categoryOptions: Array<Option<string>>;
  kindFilter: KindFilter;
  frequencyFilter: FrequencyFilter;
  onPressAutorCat: () => void;
  onPressTipoFrec: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Autor y Categorías active & label
  const isAutorCatActive = ownerFilter !== 'mine' || categoryFilter.length > 0;
  const ownerLabel = ownerFilter === 'mine' ? 'Yo' : (ownerFilter === 'partner' ? (partnerUser?.name || 'Pareja') : 'Ambos');
  let catLabel = 'Todas';
  if (categoryFilter.length === 1) {
    catLabel = categoryOptions.find(c => c.value === categoryFilter[0])?.label || 'Cat';
  } else if (categoryFilter.length > 1) {
    catLabel = `${categoryFilter.length} cats`;
  }
  const autorCatLabel = (ownerFilter === 'mine' && categoryFilter.length === 0)
    ? 'Autor y Categorías'
    : `${ownerLabel} • ${catLabel}`;

  // Tipo y Frecuencia active & label
  const isTipoFrecActive = kindFilter !== 'all' || frequencyFilter !== 'all';
  const kindLabel = kindFilter === 'all' ? 'Todos' : (kindFilter === 'expense' ? 'Gastos' : 'Ingresos');
  const freqLabel = FREQUENCY_OPTIONS.find(f => f.value === frequencyFilter)?.label || 'Todas';
  const tipoFrecLabel = (kindFilter === 'all' && frequencyFilter === 'all')
    ? 'Tipo y Frecuencia'
    : `${kindLabel} • ${freqLabel}`;

  return (
    <View style={styles.filterPillBar}>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          onPressAutorCat();
        }}
        style={({ pressed }) => [
          styles.filterSummaryItem,
          isAutorCatActive && styles.filterSummaryItemActive,
          pressed && styles.pressed,
        ]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={[styles.filterSummaryText, isAutorCatActive && styles.filterSummaryTextActive]}
        >
          {autorCatLabel}
        </Text>
        <Ionicons name="caret-down" size={11} color={isAutorCatActive ? '#7C3AED' : theme.textPrimary} />
      </Pressable>

      <View style={styles.filterSeparator} />

      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          onPressTipoFrec();
        }}
        style={({ pressed }) => [
          styles.filterSummaryItem,
          isTipoFrecActive && styles.filterSummaryItemActive,
          pressed && styles.pressed,
        ]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={[styles.filterSummaryText, isTipoFrecActive && styles.filterSummaryTextActive]}
        >
          {tipoFrecLabel}
        </Text>
        <Ionicons name="caret-down" size={11} color={isTipoFrecActive ? '#7C3AED' : theme.textPrimary} />
      </Pressable>
    </View>
  );
}

function AutorCatFilterModal({
  visible,
  onClose,
  ownerFilter,
  onOwnerChange,
  categoryFilter,
  onToggleCategory,
  onClearCategory,
  categoryOptions,
  user,
  partnerUser,
}: {
  visible: boolean;
  onClose: () => void;
  ownerFilter: OwnerFilter;
  onOwnerChange: (val: OwnerFilter) => void;
  categoryFilter: string[];
  onToggleCategory: (v: string) => void;
  onClearCategory: () => void;
  categoryOptions: Array<Option<string>>;
  user: UserData;
  partnerUser?: UserData;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const [mounted, setMounted] = useState(false);
  const sheetY = useRef(new Animated.Value(SHEET_HIDE_Y)).current;
  const overlayOpacity = useRef(
    sheetY.interpolate({ inputRange: [0, SHEET_HIDE_Y], outputRange: [0.5, 0], extrapolate: 'clamp' })
  ).current;
  const dismissingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const dismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    Animated.timing(sheetY, {
      toValue: SHEET_HIDE_Y,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      dismissingRef.current = false;
      setMounted(false);
      onCloseRef.current();
    });
  }, [sheetY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && !dismissingRef.current,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) sheetY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          if (dismissingRef.current) return;
          dismissingRef.current = true;
          Animated.timing(sheetY, {
            toValue: SHEET_HIDE_Y,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            dismissingRef.current = false;
            setMounted(false);
            onCloseRef.current();
          });
        } else {
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 300, mass: 0.8 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      sheetY.setValue(SHEET_HIDE_Y);
      setMounted(true);
    }
  }, [visible, sheetY]);

  useEffect(() => {
    if (!mounted) return;
    Animated.spring(sheetY, {
      toValue: 0,
      damping: 28,
      stiffness: 280,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [mounted, sheetY]);

  const ownerOptions = [
    { label: 'Yo', value: 'mine' },
    { label: partnerUser ? partnerUser.name : 'Pareja', value: 'partner' },
    { label: 'Ambos', value: 'both' },
  ];

  if (!mounted) return null;

  return (
    <NativeModal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: overlayOpacity }]}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      <View style={styles.filterModalContainer} pointerEvents="box-none">
        <Animated.View style={[styles.filterSheet, { transform: [{ translateY: sheetY }] }]}>
          <View {...panResponder.panHandlers}>
            <View style={styles.filterSheetGrabber} />

            <View style={styles.filterSheetHeader}>
              <View style={styles.filterSheetTitleWrap}>
                <Text style={styles.filterSheetTitle}>Filtra tus movimientos</Text>
              </View>
              <Pressable
                disabled={ownerFilter === 'mine' && categoryFilter.length === 0}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onOwnerChange('mine');
                  onClearCategory();
                }}
                style={({ pressed }) => [
                  styles.filterSheetClearButton,
                  (ownerFilter === 'mine' && categoryFilter.length === 0) && styles.filterSheetClearButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="refresh-outline" size={14} color={theme.textSecondary} />
                <Text
                  style={[
                    styles.filterSheetClearText,
                    (ownerFilter === 'mine' && categoryFilter.length === 0) && styles.filterSheetClearTextDisabled,
                  ]}
                >
                  Limpiar
                </Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.filterSheetScroll}
            contentContainerStyle={styles.filterSheetContent}
            showsVerticalScrollIndicator={false}
          >
            <FilterSection title="Autor">
              <View style={styles.filterChoiceGridThree}>
                {ownerOptions.map((opt) => {
                  const active = ownerFilter === opt.value;
                  return (
                    <FilterChoiceChip
                      key={opt.value}
                      label={opt.label}
                      active={active}
                      onPress={() => onOwnerChange(opt.value as OwnerFilter)}
                      compact
                      leading={
                        opt.value === 'mine' ? (
                          <View style={[AVATAR_STYLES.filterPreviewAvatar, { backgroundColor: user.bg, marginRight: 2 }]}>
                            {user.photo ? (
                              <Image source={user.photo} style={AVATAR_STYLES.filterPreviewAvatarImage} />
                            ) : (
                              <Text style={[AVATAR_STYLES.filterPreviewAvatarInitials, { color: user.color }]}>
                                {user.initials}
                              </Text>
                            )}
                          </View>
                        ) : opt.value === 'partner' ? (
                          <View style={[AVATAR_STYLES.filterPreviewAvatar, { backgroundColor: partnerUser?.bg || '#EDE9FE', marginRight: 2 }]}>
                            {partnerUser?.photo ? (
                              <Image source={partnerUser.photo} style={AVATAR_STYLES.filterPreviewAvatarImage} />
                            ) : (
                              <Text style={[AVATAR_STYLES.filterPreviewAvatarInitials, { color: partnerUser?.color || '#7C3AED' }]}>
                                {partnerUser?.initials || 'P'}
                              </Text>
                            )}
                          </View>
                        ) : undefined
                      }
                    />
                  );
                })}
              </View>
            </FilterSection>

            <FilterSection title="Categorías">
              <View style={styles.filterChoiceGrid}>
                {categoryOptions.map((opt) => {
                  const active = categoryFilter.includes(opt.value);
                  return (
                    <FilterChoiceChip
                      key={opt.value}
                      label={opt.label}
                      active={active}
                      onPress={() => onToggleCategory(opt.value)}
                      icon={opt.icon}
                      color={opt.color}
                    />
                  );
                })}
              </View>
            </FilterSection>
          </ScrollView>

          <View style={[styles.filterSheetFooter, { paddingBottom: Math.max(34, insets.bottom + 12) }]}>
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [styles.filterSheetApplyButton, pressed && styles.pressed]}
            >
              <Text style={styles.filterSheetApplyText}>Aplicar Filtros</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </NativeModal>
  );
}

function TipoFrecFilterModal({
  visible,
  onClose,
  kindFilter,
  onKindChange,
  frequencyFilter,
  onFrequencyChange,
}: {
  visible: boolean;
  onClose: () => void;
  kindFilter: KindFilter;
  onKindChange: (val: KindFilter) => void;
  frequencyFilter: FrequencyFilter;
  onFrequencyChange: (val: FrequencyFilter) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const [mounted, setMounted] = useState(false);
  const sheetY = useRef(new Animated.Value(SHEET_HIDE_Y)).current;
  const overlayOpacity = useRef(
    sheetY.interpolate({ inputRange: [0, SHEET_HIDE_Y], outputRange: [0.5, 0], extrapolate: 'clamp' })
  ).current;
  const dismissingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const dismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    Animated.timing(sheetY, {
      toValue: SHEET_HIDE_Y,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      dismissingRef.current = false;
      setMounted(false);
      onCloseRef.current();
    });
  }, [sheetY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && !dismissingRef.current,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) sheetY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          if (dismissingRef.current) return;
          dismissingRef.current = true;
          Animated.timing(sheetY, {
            toValue: SHEET_HIDE_Y,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            dismissingRef.current = false;
            setMounted(false);
            onCloseRef.current();
          });
        } else {
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 300, mass: 0.8 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      sheetY.setValue(SHEET_HIDE_Y);
      setMounted(true);
    }
  }, [visible, sheetY]);

  useEffect(() => {
    if (!mounted) return;
    Animated.spring(sheetY, {
      toValue: 0,
      damping: 28,
      stiffness: 280,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [mounted, sheetY]);

  const kindOptions = [
    { label: 'Todos', value: 'all' },
    { label: 'Gastos', value: 'expense', icon: 'trending-down-outline' },
    { label: 'Ingresos', value: 'income', icon: 'trending-up-outline' },
  ];

  const frequencyOptions = FREQUENCY_OPTIONS;

  if (!mounted) return null;

  return (
    <NativeModal
      visible={mounted}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: overlayOpacity }]}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      <View style={styles.filterModalContainer} pointerEvents="box-none">
        <Animated.View style={[styles.filterSheet, { transform: [{ translateY: sheetY }] }]}>
          <View {...panResponder.panHandlers}>
            <View style={styles.filterSheetGrabber} />

            <View style={styles.filterSheetHeader}>
              <View style={styles.filterSheetTitleWrap}>
                <Text style={styles.filterSheetTitle}>Filtra tus movimientos</Text>
              </View>
              <Pressable
                disabled={kindFilter === 'all' && frequencyFilter === 'all'}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onKindChange('all');
                  onFrequencyChange('all');
                }}
                style={({ pressed }) => [
                  styles.filterSheetClearButton,
                  (kindFilter === 'all' && frequencyFilter === 'all') && styles.filterSheetClearButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="refresh-outline" size={14} color={theme.textSecondary} />
                <Text
                  style={[
                    styles.filterSheetClearText,
                    (kindFilter === 'all' && frequencyFilter === 'all') && styles.filterSheetClearTextDisabled,
                  ]}
                >
                  Limpiar
                </Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.filterSheetScroll}
            contentContainerStyle={styles.filterSheetContent}
            showsVerticalScrollIndicator={false}
          >
            <FilterSection title="Tipo de movimiento">
              <View style={styles.filterChoiceGridThree}>
                {kindOptions.map((opt) => {
                  const active = kindFilter === opt.value;
                  const activeColor = opt.value === 'expense' ? theme.expense : (opt.value === 'income' ? theme.income : undefined);
                  return (
                    <FilterChoiceChip
                      key={opt.value}
                      label={opt.label}
                      active={active}
                      onPress={() => onKindChange(opt.value as KindFilter)}
                      compact
                      icon={opt.icon as any}
                      color={activeColor}
                    />
                  );
                })}
              </View>
            </FilterSection>

            <FilterSection title="Frecuencia">
              <View style={styles.filterChoiceGrid}>
                {frequencyOptions.map((opt) => {
                  const active = frequencyFilter === opt.value;
                  return (
                    <FilterChoiceChip
                      key={opt.value}
                      label={opt.label}
                      active={active}
                      onPress={() => onFrequencyChange(opt.value as FrequencyFilter)}
                    />
                  );
                })}
              </View>
            </FilterSection>
          </ScrollView>

          <View style={[styles.filterSheetFooter, { paddingBottom: Math.max(34, insets.bottom + 12) }]}>
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [styles.filterSheetApplyButton, pressed && styles.pressed]}
            >
              <Text style={styles.filterSheetApplyText}>Aplicar Filtros</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </NativeModal>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.filterSheetSection}>
      <Text style={styles.filterSheetSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FilterChoiceChip({
  label,
  active,
  onPress,
  icon,
  leading,
  compact,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  leading?: ReactNode;
  compact?: boolean;
  color?: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const activeIconColor = color ?? '#24282D';

  const handlePress = () => {
    void Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.filterChoiceChip,
        compact && styles.filterChoiceChipCompact,
        active && styles.filterChoiceChipActive,
        pressed && styles.filterChoiceChipPressed,
        pressed && styles.pressed,
      ]}
    >
      {leading ?? (icon ? (
        <Ionicons name={icon} size={16} color={active ? activeIconColor : theme.textSecondary} />
      ) : null)}
      <Text
        numberOfLines={1}
        style={[styles.filterChoiceText, active && styles.filterChoiceTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FloatingSummaryBar({
  visible,
  income,
  expenses,
  currency,
}: {
  visible: boolean;
  income: number;
  expenses: number;
  currency: CurrencyCode;
}) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.floatingSummary,
        {
          paddingTop: insets.top + 8,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-72, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.floatingSummaryRow}>
        <View style={styles.floatingSummaryCell}>
          <Text style={styles.floatingSummaryLabel}>Ingresos</Text>
          <Text style={[styles.floatingSummaryValue, styles.income]}>{fmt(income, currency)}</Text>
        </View>
        <View style={styles.floatingSummaryDivider} />
        <View style={styles.floatingSummaryCell}>
          <Text style={styles.floatingSummaryLabel}>Gastos</Text>
          <Text style={[styles.floatingSummaryValue, styles.expense]}>{fmt(expenses, currency)}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function MonthPickerDropdown({
  anchorY,
  ym,
  onChange,
  onClose,
}: {
  anchorY: number;
  ym: string;
  onChange: (ym: string) => void;
  onClose: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  const [pickerYear, setPickerYear] = useState(year);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 300,
      mass: 0.8,
    }).start();
  }, [anim]);

  const close = (then?: () => void) => {
    Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      then?.();
      onClose();
    });
  };

  return (
    <Pressable style={[StyleSheet.absoluteFill, { zIndex: 100 }]} onPress={() => close()}>
      <Animated.View
        style={[
          styles.monthDropdownCard,
          {
            top: anchorY + 8,
            opacity: anim,
            transform: [
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
            ],
          },
        ]}
      >
        <Pressable onPress={() => { }} style={styles.monthDropdownInner}>
          <View style={styles.monthDropdownYearRow}>
            <Pressable
              onPress={() => setPickerYear((y) => y - 1)}
              style={({ pressed }) => [styles.monthButton, styles.monthPickerArrowButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.pickerYearText}>{pickerYear}</Text>
            <Pressable
              onPress={() => setPickerYear((y) => y + 1)}
              style={({ pressed }) => [styles.monthButton, styles.monthPickerArrowButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={styles.pickerGrid}>
            {MONTHS_ES.map((name, idx) => {
              const m = idx + 1;
              const isActive = pickerYear === year && m === month;
              return (
                <Pressable
                  key={m}
                  onPress={() => close(() => onChange(`${pickerYear}-${String(m).padStart(2, '0')}`))}
                  style={({ pressed }) => [
                    styles.pickerCell,
                    isActive && styles.pickerCellActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.pickerCellText, isActive && styles.pickerCellTextActive]}>
                    {name.slice(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// Static stylesheets for components with no theme-sensitive colors

const AVATAR_STYLES = StyleSheet.create({
  avatarCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 9,
  },
  avatarInitials: {
    fontSize: 8,
    fontWeight: '800',
  },
  bothAvatarsContainer: {
    width: 26,
    height: 18,
    position: 'relative',
  },
  bothAvatarLeft: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    overflow: 'hidden',
    position: 'absolute',
    left: 0,
    top: 1,
    zIndex: 1,
  },
  bothAvatarRight: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    overflow: 'hidden',
    position: 'absolute',
    left: 10,
    top: 1,
    zIndex: 2,
  },
  bothAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  bothAvatarInitials: {
    fontSize: 7,
    fontWeight: '800',
  },
  filterPreviewAvatar: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 18,
  },
  filterPreviewAvatarImage: {
    borderRadius: 9,
    height: 18,
    width: 18,
  },
  filterPreviewAvatarInitials: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 8,
  },
});

const TRANSACTION_CARD_STYLE = StyleSheet.create({
  transactionCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
});


const SHEET_HIDE_Y = 800;

const FREQUENCY_OPTIONS: Array<Option<FrequencyFilter>> = [
  { label: 'Todas', value: 'all' },
  { label: 'Mensual', value: 'monthly' },
  { label: 'Bisemanal', value: 'biweekly' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Único', value: 'once' },
];

const makeStyles = (t: AppTheme) => StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyText: {
    color: t.textSecondary,
    fontSize: 13,
  },
  emptyTitle: {
    color: t.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  expense: {
    color: t.expense,
  },
  dropdownCard: {
    borderRadius: 14,
    elevation: 5,
    position: 'absolute',
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    zIndex: 200,
  },
  dropdownInner: {
    backgroundColor: t.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 320,
  },
  dropdownOption: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dropdownOptionBorder: {
    borderTopColor: t.border,
    borderTopWidth: 1,
  },
  dropdownOptionActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
  },
  dropdownOptionText: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownOptionTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  controls: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    zIndex: 1,
  },
  balanceColor: {
    color: '#7C3AED',
  },
  income: {
    color: t.income,
  },
  listContent: {
    backgroundColor: t.background,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  movementsSectionEmpty: {
    minHeight: 220,
    paddingTop: 32,
  },
  movementsSectionFooter: {
    height: 0,
  },
  filterSection: {
    height: 6,
  },
  filterSectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  filterSectionTitle: {
    color: '#FFFFFF',
    fontFamily: SECTION_TITLE_FONT_FAMILY,
    fontSize: 20,
  },
  pressed: {
    opacity: 0.72,
  },
  screen: {
    backgroundColor: t.background,
    flex: 1,
  },
  heroHeader: {
    overflow: 'visible',
    paddingBottom: 12,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  headerAvatarButton: {
    borderRadius: 23,
    flexShrink: 0,
  },
  headerAvatar: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.36)',
    borderRadius: 23,
    borderWidth: 1.5,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 46,
  },
  headerAvatarImage: {
    borderRadius: 23,
    height: 46,
    width: 46,
  },
  headerAvatarInitials: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerGreeting: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 22,
  },
  headerDate: {
    color: 'rgba(255, 255, 255, 0.60)',
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  headerSettingsButton: {
    alignItems: 'center',
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  reportTitle: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  monthPillsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
    paddingHorizontal: 24,
  },
  monthArrowPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(43, 47, 50, 0.15)',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 64,
  },
  monthCenterWrap: {
    flex: 1,
    minWidth: 0,
  },
  monthCenterPill: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
  },
  monthCenterText: {
    color: '#24282D',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    textTransform: 'capitalize',
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    elevation: 4,
    marginHorizontal: 24,
    paddingHorizontal: 18,
    paddingVertical: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
  },
  reportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 7,
  },
  reportLabel: {
    color: '#24282D',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    width: 86,
  },
  reportBar: {
    height: 24,
    width: 2,
  },
  reportAmountWrap: {
    alignItems: 'flex-end',
    flex: 1,
    minWidth: 0,
  },
  reportAmount: {
    color: '#24282D',
    fontFamily: 'Poppins_500Medium',
    fontSize: 21,
    lineHeight: 26,
  },
  reportDecimals: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
  reportEyeButton: {
    alignItems: 'center',
    flexShrink: 0,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  reportDivider: {
    backgroundColor: 'rgba(17, 24, 39, 0.08)',
    height: 1,
  },
  filterPillBar: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderRadius: 999,
    elevation: 2,
    flexDirection: 'row',
    gap: 2,
    minHeight: 44,
    paddingHorizontal: 8,
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  filterSummaryItem: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 999,
  },
  filterSummaryItemActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  filterSummaryText: {
    color: t.textPrimary,
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 18,
  },
  filterSummaryTextActive: {
    color: '#7C3AED',
    fontFamily: 'Poppins_600SemiBold',
  },
  filterSeparator: {
    backgroundColor: t.border,
    height: 16,
    width: 1,
  },
  clearFiltersInlineButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 154,
    paddingHorizontal: 16,
  },
  clearFiltersInlineText: {
    color: t.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
  inlineFilterWrap: {
    flex: 1,
    minWidth: 0,
  },
  inlineFilter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 13,
  },
  inlineFilterText: {
    color: t.textPrimary,
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
  inlineFilterTextActive: {
    color: '#7C3AED',
    fontFamily: 'Poppins_600SemiBold',
  },
  filterModalOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterSheet: {
    alignSelf: 'center',
    backgroundColor: t.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingTop: 10,
    width: '100%',
  },
  filterSheetGrabber: {
    alignSelf: 'center',
    backgroundColor: t.border,
    borderRadius: 999,
    height: 4,
    marginBottom: 14,
    width: 44,
  },
  filterSheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  filterSheetTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  filterSheetTitle: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 22,
    lineHeight: 28,
  },
  filterSheetSubtitle: {
    color: t.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  filterSheetClearButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  filterSheetClearButtonDisabled: {
    opacity: 0.56,
  },
  filterSheetClearText: {
    color: t.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
  filterSheetClearTextDisabled: {
    color: t.textMuted,
  },
  filterSheetScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  filterSheetContent: {
    gap: 18,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  filterSheetSection: {
    gap: 10,
  },
  filterSheetSectionTitle: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    lineHeight: 20,
  },
  filterChoiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChoiceGridThree: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChoiceChip: {
    alignItems: 'center',
    backgroundColor: t.mode === 'light' ? 'rgba(43, 47, 50, 0.055)' : 'rgba(255, 255, 255, 0.08)',
    borderColor: 'transparent',
    borderWidth: 1.5,
    borderRadius: 14,
    elevation: 4,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 7,
    minHeight: 42,
    minWidth: 0,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
  },
  filterChoiceChipPressed: {
    elevation: 0,
    shadowOpacity: 0,
  },
  filterChoiceChipCompact: {
    flex: 1,
    flexBasis: 0,
    flexGrow: 1,
    paddingHorizontal: 10,
  },
  filterChoiceChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  filterChoiceText: {
    color: t.textSecondary,
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    minWidth: 0,
  },
  filterChoiceTextActive: {
    color: '#24282D',
    fontFamily: 'Poppins_500Medium',
  },
  filterSheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  filterSheetApplyButton: {
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
  },
  filterSheetApplyText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
  pickerYearText: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerCell: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    paddingVertical: 12,
    width: '30%',
  },
  pickerCellActive: {
    backgroundColor: '#7C3AED',
  },
  pickerCellText: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  pickerCellTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_500Medium',
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
    ...SURFACE_SHADOW,
  },
  monthPickerArrowButton: {
    backgroundColor: 'rgba(43, 47, 50, 0.15)',
  },
  floatingSummary: {
    backgroundColor: t.surface,
    borderBottomColor: t.border,
    borderBottomWidth: 1,
    elevation: 10,
    left: 0,
    paddingBottom: 12,
    paddingHorizontal: 32,
    position: 'absolute',
    right: 0,
    shadowColor: t.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    top: 0,
    zIndex: 10,
  },
  floatingSummaryCell: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  floatingSummaryDivider: {
    backgroundColor: t.border,
    height: 32,
    width: 1,
  },
  floatingSummaryLabel: {
    color: t.textSecondary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
  },
  floatingSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  floatingSummaryValue: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
  },
  monthDropdownCard: {
    backgroundColor: t.surface,
    borderRadius: 20,
    left: 16,
    position: 'absolute',
    right: 16,
    ...SURFACE_SHADOW,
  },
  monthDropdownInner: {
    padding: 20,
  },
  monthDropdownYearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
});
