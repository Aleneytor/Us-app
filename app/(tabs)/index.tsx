import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Rect, SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { type AppTheme } from '../../constants/colors';
import { SECTION_TITLE_FONT_FAMILY } from '../../constants/typography';
import { BudgetCategoryCard } from '../../components/BudgetCategoryCard';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import { ActivityTile } from '../../components/ActivityTile';
import { GoalDetailModal } from '../../components/GoalDetailModal';
import { BudgetCategoryDetailModal } from '../../modals/BudgetCategoryDetailModal';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { PlanDetailModal } from '../../modals/PlanDetailModal';
import { PlanModal } from '../../modals/PlanModal';
import { SavingPlanDetailModal } from '../../modals/SavingPlanDetailModal';
import { TransactionModal } from '../../modals/TransactionModal';
import { useAppStore } from '../../store/useAppStore';
import type { BudgetCategory, CurrencyCode, Goal, Plan, SavingPlan, Transaction, UserData } from '../../types';
import {
  calcBudgetCategorySpending,
  calcGastosActual,
  calcGastosProyectados,
  calcIngresosActual,
  calcIngresosProyectados,
} from '../../utils/calculations';
import { getUserData } from '../../utils/users';
import { splitAmount } from '../../utils/format';
import { GettingStartedCard } from '../../components/GettingStartedCard';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useTabPadding } from '../../hooks/useTabPadding';
import { buildActivityFeed } from '../../utils/activityFeed';
import type { ActivityItem } from '../../utils/activityFeed';
import { reportFabScroll, subscribeFabScroll } from '../../utils/fabScroll';
import { useTheme } from '../../contexts/ThemeContext';

const HOME_TOP_GRADIENT = ['#9933FF', '#A44BFF', '#B86EFF', '#D5ADFF', '#F2F2F7'] as const;
const HERO_CARD_GAP = 18;
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


export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const currentUser = useAppStore((s) => s.currentUser);
  const { user: clerkUser } = useUser();

  useEffect(() => {
    if (!clerkUser || currentUser !== clerkUser.id) return;

    AsyncStorage.getItem(`nosotros_onboarding_done:${currentUser}`).then((v) => {
      if (v !== '1') {
        router.replace('/onboarding');
      } else {
        setOnboardingChecked(true);
      }
    });
  }, [clerkUser, currentUser]);

  const tabPadding = useTabPadding();
  const payload = useAppStore((s) => s.payload);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const currency = useAppStore((s) => s.currency);
  const deleteTx = useAppStore((s) => s.deleteTransaction);
  const users = useAppStore((s) => s.users);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [financeCardKind, setFinanceCardKind] = useState<'income' | 'expense'>('income');
  const [financePeriod, setFinancePeriod] = useState<'actual' | 'end'>('actual');
  const [financeHidden, setFinanceHidden] = useState(false);
  const [createKind, setCreateKind] = useState<'income' | 'expense' | null>(null);
  const [createKindPreset, setCreateKindPreset] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);
  const [selectedSaving, setSelectedSaving] = useState<SavingPlan | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedPlanInitialTab, setSelectedPlanInitialTab] = useState<'detalles' | 'gastos' | 'saldos'>('detalles');
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [catPage, setCatPage] = useState(0);
  const screenScrollRef = useRef<ScrollView>(null);
  const catScrollRef = useRef<ScrollView>(null);
  const { heroAnim, contentAnim, headerAnim, itemAnims } = useEntranceAnimation({
    animateOnFocus: false,
    scrollRef: screenScrollRef,
    onResetScroll: () => reportFabScroll(0),
  });

  const user = getUserData(users, currentUser);

  const ingresosActual = calcIngresosActual(payload, currentUser, selectedYM);
  const ingresosProyectados = calcIngresosProyectados(payload, currentUser, selectedYM);
  const gastosActual = calcGastosActual(payload, currentUser, selectedYM);
  const gastosProyectados = calcGastosProyectados(payload, currentUser, selectedYM);

  const budgetCategories = useMemo(() => {
    const all = payload.budgetCategories ?? [];
    return all.filter((bc) => bc.uid === undefined || bc.uid === currentUser);
  }, [payload.budgetCategories, currentUser]);

  const { width } = useWindowDimensions();
  const CATS_PER_PAGE = 3;
  const catPageCount = Math.ceil(budgetCategories.length / CATS_PER_PAGE);
  const pagerWidth = Math.min(width, 430);
  const catDotWidths = useRef(
    Array.from({ length: 10 }, (_, i) => new Animated.Value(i === 0 ? 28 : 14)),
  ).current;
  const catPageRef = useRef(0);
  const catDragStartX = useRef(0);

  const updateCatIndicator = (nextPage: number) => {
    const safePage = Math.max(0, Math.min(catPageCount - 1, nextPage));
    if (safePage === catPageRef.current) return;
    catPageRef.current = safePage;
    setCatPage(safePage);
    for (let i = 0; i < catPageCount; i++) {
      Animated.spring(catDotWidths[i], {
        toValue: i === safePage ? 28 : 14,
        useNativeDriver: false,
        damping: 14,
        stiffness: 160,
      }).start();
    }
  };

  useEffect(() => {
    if (catPageCount === 0) return;
    const safePage = Math.min(catPageRef.current, catPageCount - 1);
    if (safePage !== catPageRef.current) {
      catPageRef.current = safePage;
      setCatPage(safePage);
      for (let i = 0; i < catPageCount; i++) {
        catDotWidths[i].setValue(i === safePage ? 28 : 14);
      }
    }
  }, [catDotWidths, catPageCount]);

  const recent = useMemo(
    () => buildActivityFeed(payload, { currentUser, selectedYM, includeAllMonths: true })
      .filter((item) => item.ownerId === currentUser)
      .sort((a, b) => b.sortId - a.sortId)
      .slice(0, 8),
    [currentUser, payload, selectedYM],
  );

  const confirmDelete = (t: Transaction) => {
    Alert.alert(
      'Eliminar movimiento',
      t.desc || 'Este movimiento se ocultará para todos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => { deleteTx(t.id); setSelectedTransaction(null); } },
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

  const now = new Date();
  const greeting = getGreeting(now);
  const dateLabel = getDateLabel(now);
  const headerTopPadding = Math.max(insets.top + 18, 52);

  // Botones flotantes: se esconden hacia los bordes al scrollear hacia abajo
  // siguiendo el mismo estado compacto que el FAB del menú principal.
  const fabCollapse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    return subscribeFabScroll((compact) => {
      Animated.spring(fabCollapse, {
        toValue: compact ? 1 : 0,
        useNativeDriver: true,
        damping: 17,
        stiffness: 150,
        mass: 0.8,
      }).start();
    });
  }, [fabCollapse]);

  const FAB_PEEK = 12;
  const fabButtonWidth = (width - 48 - 12) / 2;
  const fabHideShift = 24 + fabButtonWidth - FAB_PEEK;
  const fabLeftTx = fabCollapse.interpolate({ inputRange: [0, 1], outputRange: [0, -fabHideShift] });
  const fabRightTx = fabCollapse.interpolate({ inputRange: [0, 1], outputRange: [0, fabHideShift] });

  if (!onboardingChecked) return null;

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={screenScrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabPadding + 58 }]}
        showsVerticalScrollIndicator={false}
        overScrollMode="auto"
        onScroll={(event) => reportFabScroll(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        <Animated.View style={[styles.headerSection, { opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
          <LinearGradient
            colors={HOME_TOP_GRADIENT}
            locations={[0, 0.28, 0.54, 0.78, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.headerVisual}
          >

            <View style={[styles.header, { paddingTop: headerTopPadding }]}>
              <Pressable
                accessibilityLabel="Abrir perfil"
                onPress={() => router.push('/perfil')}
                style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
                hitSlop={8}
              >
                <HeaderAvatar user={user} />
              </Pressable>

              <View style={styles.headerText}>
                <Text style={styles.headerGreeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  {greeting}, {user.name}
                </Text>
                <Text style={styles.headerDate} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.88}>
                  {dateLabel}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Abrir ajustes"
                onPress={() => router.push('/perfil')}
                style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
                hitSlop={8}
              >
                <Ionicons name="settings-outline" size={25} color="#FFFFFF" />
              </Pressable>
            </View>

            <FinanceHeroCards
              activeKind={financeCardKind}
              period={financePeriod}
              hidden={financeHidden}
              ingresosActual={ingresosActual}
              ingresosProyectados={ingresosProyectados}
              gastosActual={gastosActual}
              gastosProyectados={gastosProyectados}
              currency={currency}
              viewportWidth={width}
              onToggleKind={() => setFinanceCardKind((kind) => kind === 'income' ? 'expense' : 'income')}
              onSetKind={setFinanceCardKind}
              onSetPeriod={setFinancePeriod}
              onToggleHidden={() => setFinanceHidden((hidden) => !hidden)}
            />

            {/* Categorías de presupuesto */}
            <Animated.View style={[styles.catSection, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
              <View style={[styles.sectionHead, styles.catSectionHead]}>
                <Text style={[styles.sectionTitle, styles.sectionTitleOnGradient]}>Categorías</Text>
              </View>

              {budgetCategories.length === 0 ? (
                <View style={styles.categoriesEmpty}>
                  <Ionicons name="pie-chart-outline" size={28} color="#FFFFFF" />
                  <Text style={styles.categoriesEmptyTitle}>Sin categorías</Text>
                  <Text style={styles.categoriesEmptyText}>
                    Crea una categoría para rastrear tu presupuesto mensual por tipo de gasto.
                  </Text>
                  <Pressable
                    onPress={() => setNewCategoryOpen(true)}
                    style={({ pressed }) => [styles.categoriesEmptyBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.categoriesEmptyBtnText}>Crear categoría</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.categoriesPager}>
                  <ScrollView
                    ref={catScrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    snapToInterval={pagerWidth}
                    snapToAlignment="start"
                    style={{ width: pagerWidth, overflow: 'visible' }}
                    scrollEventThrottle={16}
                    onScrollBeginDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                      catDragStartX.current = e.nativeEvent.contentOffset.x;
                    }}
                    onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                      const x = e.nativeEvent.contentOffset.x;
                      updateCatIndicator(Math.round(x / pagerWidth));
                    }}
                    onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                      const x = e.nativeEvent.contentOffset.x;
                      updateCatIndicator(Math.round(x / pagerWidth));
                    }}
                    onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                      const x = e.nativeEvent.contentOffset.x;
                      const vx = (e.nativeEvent as any).velocity?.x ?? 0;
                      const dx = x - catDragStartX.current;
                      let nextPage = catPageRef.current;
                      if (vx < -0.3) nextPage = Math.min(catPageCount - 1, catPageRef.current + 1);
                      else if (vx > 0.3) nextPage = Math.max(0, catPageRef.current - 1);
                      else if (dx > 24) nextPage = Math.min(catPageCount - 1, catPageRef.current + 1);
                      else if (dx < -24) nextPage = Math.max(0, catPageRef.current - 1);
                      else nextPage = Math.round(x / pagerWidth);
                      updateCatIndicator(nextPage);
                    }}
                  >
                    {Array.from({ length: catPageCount }).map((_, pageIdx) => (
                      <View key={pageIdx} style={[styles.catPage, { width: pagerWidth }]}>
                        {budgetCategories
                          .slice(pageIdx * CATS_PER_PAGE, pageIdx * CATS_PER_PAGE + CATS_PER_PAGE)
                          .map((bc) => (
                            <BudgetCategoryCard
                              key={bc.id}
                              category={bc}
                              spent={calcBudgetCategorySpending(payload, bc.id, currentUser, selectedYM)}
                              currency={currency}
                              variant="tinted"
                              onPress={() => setSelectedCategory(bc)}
                            />
                          ))}
                      </View>
                    ))}
                  </ScrollView>

                  {catPageCount > 1 && (
                    <View style={styles.catDots}>
                      {Array.from({ length: catPageCount }).map((_, i) => (
                        <Animated.View
                          key={i}
                          style={[
                            styles.catDot,
                            i === catPage && styles.catDotActive,
                            { width: catDotWidths[i] },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        <GettingStartedCard />

        {/* -- Movimientos Recientes -- */}
        <Animated.View style={[styles.section, styles.recentSection, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
          <View style={styles.recentSectionHeader}>
            <Text style={styles.sectionTitle}>Movimientos Recientes</Text>
          </View>

          {recent.length === 0 ? (
            <Text style={styles.emptyText}>Sin movimientos recientes</Text>
          ) : (
            <View style={styles.tileList}>
              {recent.map((item, i) => (
                <Animated.View
                  key={item.id}
                  style={{
                    opacity: itemAnims[i],
                    transform: [{ translateY: itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
                  }}
                >
                  <ActivityTile
                    activity={item}
                    ym={selectedYM}
                    onPress={() => openActivityDetails(item)}
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* -- Modals -- */}
        <TransactionModal
          visible={createKind !== null}
          initialKind={createKind ?? 'expense'}
          kindPreset={createKindPreset}
          onClose={() => { setCreateKind(null); setCreateKindPreset(false); }}
        />

        <TransactionModal
          visible={!!editTransaction}
          transaction={editTransaction}
          onClose={() => setEditTransaction(null)}
        />

        <TransactionDetailModal
          transaction={selectedTransaction}
          ym={selectedYM}
          onClose={() => setSelectedTransaction(null)}
          onEdit={(t) => { setSelectedTransaction(null); setEditTransaction(t); }}
          onDelete={confirmDelete}
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

        <BudgetCategoryModal
          visible={newCategoryOpen}
          onClose={() => setNewCategoryOpen(false)}
        />

        <BudgetCategoryDetailModal
          category={selectedCategory}
          currency={currency}
          selectedYM={selectedYM}
          onClose={() => setSelectedCategory(null)}
        />
      </ScrollView>

      {/* -- Botones flotantes Crear ingreso / Crear Gasto -- */}
      <Animated.View pointerEvents="box-none" style={[styles.fabRow, { bottom: tabPadding - 4, opacity: contentAnim }]}>
        <Animated.View style={[styles.fabHalf, { transform: [{ translateX: fabLeftTx }] }]}>
          <FinanceToggleButton
            label="Crear ingreso"
            icon="arrow-top-right"
            accent="#00D158"
            sweepDirection="cw"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCreateKind('income'); setCreateKindPreset(true); }}
          />
        </Animated.View>
        <Animated.View style={[styles.fabHalf, { transform: [{ translateX: fabRightTx }] }]}>
          <FinanceToggleButton
            label="Crear Gasto"
            icon="arrow-bottom-left"
            accent="#FF0B4F"
            sweepDirection="ccw"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCreateKind('expense'); setCreateKindPreset(true); }}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

type FinanceHeroKind = 'income' | 'expense';
type FinanceHeroPeriod = 'actual' | 'end';

function FinanceHeroCards({
  activeKind,
  period,
  hidden,
  ingresosActual,
  ingresosProyectados,
  gastosActual,
  gastosProyectados,
  currency,
  viewportWidth,
  onToggleKind,
  onSetKind,
  onSetPeriod,
  onToggleHidden,
}: {
  activeKind: FinanceHeroKind;
  period: FinanceHeroPeriod;
  hidden: boolean;
  ingresosActual: number;
  ingresosProyectados: number;
  gastosActual: number;
  gastosProyectados: number;
  currency: CurrencyCode;
  viewportWidth: number;
  onToggleKind: () => void;
  onSetKind: (kind: FinanceHeroKind) => void;
  onSetPeriod: (period: FinanceHeroPeriod) => void;
  onToggleHidden: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);
  const privacy = useRef(new Animated.Value(hidden ? 1 : 0)).current;
  const [carouselWidth, setCarouselWidth] = useState(0);
  const activeIndex = activeKind === 'income' ? 0 : 1;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const positionIndexRef = useRef(activeIndex);
  const viewport = carouselWidth || viewportWidth;
  const cardWidth = Math.max(280, Math.min(viewport - 72, 430));
  const snapInterval = cardWidth + HERO_CARD_GAP;

  const syncKindFromOffset = (x: number) => {
    const idx = Math.max(0, Math.min(1, Math.round(x / snapInterval)));
    positionIndexRef.current = idx;
    if (idx !== activeIndexRef.current) {
      onSetKind(idx === 0 ? 'income' : 'expense');
    }
  };

  useEffect(() => {
    // Solo desplaza cuando el cambio de tipo viene de fuera (tap en el título),
    // nunca como reacción al propio gesto de deslizamiento.
    if (positionIndexRef.current !== activeIndex) {
      scrollRef.current?.scrollTo({ x: activeIndex * snapInterval, animated: true });
    }
  }, [activeIndex, snapInterval]);

  useEffect(() => {
    Animated.timing(privacy, {
      toValue: hidden ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hidden, privacy]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      disableIntervalMomentum
      snapToInterval={snapInterval}
      snapToAlignment="start"
      scrollEventThrottle={16}
      style={styles.financeHeroViewport}
      contentContainerStyle={styles.financeHeroRail}
      onLayout={(event) => setCarouselWidth(event.nativeEvent.layout.width)}
      onScroll={(event) => syncKindFromOffset(event.nativeEvent.contentOffset.x)}
      onMomentumScrollEnd={(event) => syncKindFromOffset(event.nativeEvent.contentOffset.x)}
    >
      <FinanceHeroCard
        kind="income"
        period={period}
        hidden={hidden}
        privacyAnim={privacy}
        amount={period === 'actual' ? ingresosActual : ingresosProyectados}
        currency={currency}
        width={cardWidth}
        onToggleKind={onToggleKind}
        onSetPeriod={onSetPeriod}
        onToggleHidden={onToggleHidden}
      />
      <FinanceHeroCard
        kind="expense"
        period={period}
        hidden={hidden}
        privacyAnim={privacy}
        amount={period === 'actual' ? gastosActual : gastosProyectados}
        currency={currency}
        width={cardWidth}
        onToggleKind={onToggleKind}
        onSetPeriod={onSetPeriod}
        onToggleHidden={onToggleHidden}
      />
    </ScrollView>
  );
}

function FinanceHeroCard({
  kind,
  period,
  hidden,
  privacyAnim,
  amount,
  currency,
  width,
  onToggleKind,
  onSetPeriod,
  onToggleHidden,
}: {
  kind: FinanceHeroKind;
  period: FinanceHeroPeriod;
  hidden: boolean;
  privacyAnim: Animated.Value;
  amount: number;
  currency: CurrencyCode;
  width: number;
  onToggleKind: () => void;
  onSetPeriod: (period: FinanceHeroPeriod) => void;
  onToggleHidden: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isIncome = kind === 'income';
  const accent = isIncome ? '#00D158' : '#FF0B4F';
  const title = isIncome ? 'Ingresos' : 'Gastos';
  const arrowIcon = isIncome ? 'arrow-top-right' : 'arrow-bottom-left';

  return (
    <View style={[styles.financeHeroCard, { width }]}>
      {/* Header oscuro */}
      <View style={styles.financeHeroTop}>
        <View style={styles.financeHeroTitleGroup}>
          <Pressable
            onPress={onToggleKind}
            style={({ pressed }) => [styles.financeHeroTitleButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name={arrowIcon} size={20} color="#FFFFFF" />
            <Text style={styles.financeHeroTitle} numberOfLines={1}>
              {title}
            </Text>
          </Pressable>
          <Text style={styles.financeHeroDot}>•</Text>
          <Pressable
            onPress={() => onSetPeriod(period === 'actual' ? 'end' : 'actual')}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Text style={styles.financeHeroPeriodLabel}>
              {period === 'actual' ? 'Actuales' : 'A final de mes'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityLabel={hidden ? 'Mostrar monto' : 'Ocultar monto'}
          onPress={onToggleHidden}
          style={({ pressed }) => [styles.financeEyeButton, pressed && styles.pressed]}
        >
          <PrivacyEyeIcon hidden={hidden} size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Cuerpo blanco con curva superior derecha */}
      <View style={styles.financeHeroBody}>
        <View style={styles.financeAmountWrap}>
          <Animated.View
            style={{
              opacity: privacyAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            }}
          >
            <AmountDisplay value={amount} currency={currency} accent={accent} />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.financePrivacyLayer,
              {
                opacity: privacyAnim,
                transform: [{ translateY: privacyAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
              },
            ]}
          >
            <Text style={styles.financeHiddenAmount}>••••••</Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

function PrivacyEyeIcon({ hidden, size = 24, color = '#000000' }: { hidden: boolean; size?: number; color?: string }) {
  const xml = (hidden ? OJITO_CERRADO_XML : OJITO_ABIERTO_XML).replace(/black/g, color);
  return (
    <SvgXml xml={xml} width={size} height={hidden ? size * 0.42 : size * 0.64} />
  );
}

function AmountDisplay({ value, currency, accent }: { value: number; currency: CurrencyCode; accent: string }) {
  const amount = splitAmount(value, currency);
  const decimalSeparator = currency === 'USD' ? '.' : ',';

  return (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.48} style={amountStyles.amount}>
      {amount.sign}{amount.whole}
      <Text style={[amountStyles.decimals, { color: accent }]}>
        {decimalSeparator}{amount.decimals}{amount.symbol}
      </Text>
    </Text>
  );
}

function HeaderAvatar({ user }: { user: UserData }) {
  return (
    <View style={[headerAvatarStyles.avatar, { backgroundColor: user.bg }]}>
      {user.photo ? (
        <Image source={user.photo} style={headerAvatarStyles.avatarImage} />
      ) : (
        <Text style={[headerAvatarStyles.avatarInitials, { color: user.color }]}>
          {user.initials}
        </Text>
      )}
    </View>
  );
}

const AnimatedSweepRect = Animated.createAnimatedComponent(Rect);

const SWEEP_STROKE_WIDTH = 2;
const SWEEP_CYCLE_MS = 4000;
const SWEEP_TRAVEL_MS = 1500;

// Línea de acento que recorre el borde del botón una vez por ciclo para
// llamar la atención sobre su existencia sin ser invasiva.
function BorderSweep({
  accent,
  direction,
  width,
  height,
}: {
  accent: string;
  direction: 'cw' | 'ccw';
  width: number;
  height: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: SWEEP_TRAVEL_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.delay(SWEEP_CYCLE_MS - SWEEP_TRAVEL_MS),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const rectWidth = width - SWEEP_STROKE_WIDTH;
  const rectHeight = height - SWEEP_STROKE_WIDTH;
  if (rectWidth <= 0 || rectHeight <= 0) return null;

  // Perímetro de la píldora: dos tramos rectos + circunferencia completa.
  const perimeter = 2 * (rectWidth - rectHeight) + Math.PI * rectHeight;
  const dashLength = Math.max(30, perimeter * 0.22);

  // Con offset positivo el trazo viaja contra la dirección del path (el path
  // del rect es horario), así que ccw usa +perimeter y cw usa -perimeter.
  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, direction === 'ccw' ? perimeter : -perimeter],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <AnimatedSweepRect
          x={SWEEP_STROKE_WIDTH / 2}
          y={SWEEP_STROKE_WIDTH / 2}
          width={rectWidth}
          height={rectHeight}
          rx={rectHeight / 2}
          fill="none"
          stroke={accent}
          strokeWidth={SWEEP_STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={[dashLength, perimeter - dashLength]}
          strokeDashoffset={dashOffset}
          opacity={opacity}
        />
      </Svg>
    </View>
  );
}

function FinanceToggleButton({
  label,
  icon,
  accent,
  sweepDirection,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  accent: string;
  sweepDirection: 'cw' | 'ccw';
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <Pressable
      onPress={onPress}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({ width, height });
      }}
      style={({ pressed }) => [styles.financeToggle, pressed && styles.pressed]}
    >
      <BlurView
        intensity={42}
        tint={theme.mode === 'light' ? 'light' : 'dark'}
        style={StyleSheet.absoluteFill}
      />
      {size.width > 0 && (
        <BorderSweep
          accent={accent}
          direction={sweepDirection}
          width={size.width}
          height={size.height}
        />
      )}
      <MaterialCommunityIcons name={icon} size={20} color={accent} />
      <Text style={styles.financeToggleText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const headerAvatarStyles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.36)',
    borderRadius: 23,
    borderWidth: 1.5,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 46,
  },
  avatarImage: {
    borderRadius: 23,
    height: 46,
    width: 46,
  },
  avatarInitials: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 17,
  },
});

const amountStyles = StyleSheet.create({
  amount: {
    color: '#24282D',
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 42,
    letterSpacing: 0,
    lineHeight: 50,
    minWidth: 0,
  },
  decimals: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    letterSpacing: 0,
  },
});


const makeStyles = (t: AppTheme) => StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {},
  headerSection: {
    zIndex: 10,
  },
  headerVisual: {
    overflow: 'visible',
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  avatarButton: {
    borderRadius: 23,
    flexShrink: 0,
  },
  settingsButton: {
    alignItems: 'center',
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
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
  financeHeroViewport: {
    alignSelf: 'center',
    marginTop: 0,
    overflow: 'hidden',
    width: '100%',
  },
  financeHeroRail: {
    flexDirection: 'row',
    gap: HERO_CARD_GAP,
    paddingHorizontal: 24,
  },
  financeHeroCard: {
    backgroundColor: 'rgba(43, 47, 50, 0.15)',
    borderRadius: 22,
    minHeight: 140,
    overflow: 'hidden',
  },
  financeHeroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  financeHeroTitleGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  financeHeroTitleButton: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 7,
    minWidth: 0,
  },
  financeHeroDot: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  financeHeroPeriodLabel: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    lineHeight: 21,
  },
  financeHeroTitle: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    lineHeight: 21,
  },
  financeHeroBody: {
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 28,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  financeAmountWrap: {
    minWidth: 0,
    position: 'relative',
  },
  financePrivacyLayer: {
    alignItems: 'flex-start',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
  },
  financeHiddenAmount: {
    color: '#24282D',
    fontFamily: 'Poppins_500Medium',
    fontSize: 42,
    letterSpacing: 2,
    lineHeight: 50,
  },
  financeEyeButton: {
    alignItems: 'center',
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  financeInactiveVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  catSection: {
    marginTop: 26,
    overflow: 'visible',
    paddingHorizontal: 0,
  },
  catSectionHead: {
    paddingHorizontal: 24,
  },
  recentSection: {
    marginTop: 0,
    paddingBottom: 16,
    paddingHorizontal: 0,
    paddingTop: 4,
  },
  recentSectionHeader: {
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: t.textPrimary,
    fontFamily: SECTION_TITLE_FONT_FAMILY,
    fontSize: 18,
  },
  sectionTitleOnGradient: {
    color: '#FFFFFF',
  },
  sectionMonth: {
    color: t.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  categoriesEmpty: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  categoriesEmptyBtn: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  categoriesEmptyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  categoriesEmptyText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    textAlign: 'center',
  },
  categoriesEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  categoriesList: {
    gap: 8,
  },
  categoriesPager: {
    alignItems: 'center',
    gap: 4,
    overflow: 'visible',
  },
  catPage: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    overflow: 'visible',
    paddingBottom: 20,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  catDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  catDot: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 999,
    height: 4,
    width: 14,
  },
  catDotActive: {
    backgroundColor: '#494749ff',
    width: 28,
  },
  swipeHint: {
    fontSize: 12,
    color: t.textMuted,
    fontWeight: '500',
    marginTop: 5,
    marginBottom: 12,
  },
  screen: {
    backgroundColor: '#a8a8a8ff',
    flex: 1,
  },
  fabRow: {
    flexDirection: 'row',
    gap: 12,
    left: 0,
    paddingHorizontal: 24,
    position: 'absolute',
    right: 0,
  },
  fabHalf: {
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    borderRadius: 999,
    elevation: 12,
    flex: 1,
    shadowColor: '#3C0B6F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
  },
  financeToggle: {
    alignItems: 'center',
    backgroundColor: t.mode === 'light' ? 'rgba(248, 248, 251, 0.90)' : 'rgba(38, 45, 51, 0.82)',
    borderColor: t.mode === 'light' ? 'rgba(0, 0, 0, 0.13)' : 'rgba(255, 255, 255, 0.22)',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 12,
    // @ts-ignore
    mixBlendMode: 'hard-light',
  },
  financeToggleText: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.72,
  },
  tileList: {
    alignSelf: 'stretch',
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    color: t.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
