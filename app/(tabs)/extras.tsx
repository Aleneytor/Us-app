import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Rect } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES } from '../../constants/categories';
import { SavingPlanPreviewCard } from '../../components/SavingPlanPreviewCard';
import { GoalCard } from '../../components/GoalCard';
import { GoalDetailModal } from '../../components/GoalDetailModal';
import { type AppTheme, getIconColor } from '../../constants/colors';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useTabPadding } from '../../hooks/useTabPadding';
import { useTheme } from '../../contexts/ThemeContext';
import { ContributionModal } from '../../modals/ContributionModal';
import { GoalModal } from '../../modals/GoalModal';
import { PlanDetailModal } from '../../modals/PlanDetailModal';
import { PlanModal } from '../../modals/PlanModal';
import { SavingPlanDetailModal } from '../../modals/SavingPlanDetailModal';
import { SavingPlanModal } from '../../modals/SavingPlanModal';
import type { CurrencyCode, Goal, Plan, SavingPlan } from '../../types';
import { savingPlanSavedAmount } from '../../utils/calculations';
import { fmt, splitAmount } from '../../utils/format';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import { reportFabScroll, subscribeFabScroll } from '../../utils/fabScroll';
import { getUserData } from '../../utils/users';
import { computeMemberBalances, planTotalBudget, planTotalSpent, resolveDebts } from '../../utils/planCalculations';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Degradado concentrado arriba — transición rápida a blanco
const EXTRAS_GRADIENT = ['#9933FF', '#A44BFF', '#C474FF', '#EAD8FF', '#F2F2F7'] as const;
const CARD_PURPLE = '#9131E7';
const HERO_CARD_GAP = 18;
const CREATE_SAVING_ACCENT = '#9933FF';   // morado — Ahorro
const CREATE_PLAN_ACCENT = '#2563EB';   // azul   — Plan
const SWEEP_STROKE_WIDTH = 2;
const SWEEP_CYCLE_MS = 4000;
const SWEEP_TRAVEL_MS = 1500;
type MovementFilter = 'both' | 'savings' | 'plans';

const AnimatedSweepRect = Animated.createAnimatedComponent(Rect);

const OJITO_ABIERTO_XML = `<svg width="38" height="24" viewBox="0 0 38 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.54492 14.0665C8.34492 -2.62765 28.7449 -2.62765 35.5449 14.0665" stroke="black" stroke-width="3.09091" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.3751 21.9367C17.0626 22.2513 17.7995 22.4132 18.5436 22.4132C20.0465 22.4132 21.4879 21.7536 22.5506 20.5796C23.6133 19.4056 24.2103 17.8132 24.2103 16.1529C24.2103 14.4926 23.6133 12.9002 22.5506 11.7262C21.4879 10.5521 20.0465 9.89258 18.5436 9.89258C17.7995 9.89258 17.0626 10.0545 16.3751 10.3691C15.6876 10.6837 15.0629 11.1449 14.5367 11.7262C14.0105 12.3075 13.5931 12.9976 13.3083 13.7572C13.0235 14.5167 12.877 15.3308 12.877 16.1529C12.877 16.975 13.0235 17.7891 13.3083 18.5486C13.5931 19.3082 14.0105 19.9983 14.5367 20.5796C15.0629 21.1609 15.6876 21.6221 16.3751 21.9367Z" stroke="black" stroke-width="3.09091" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const OJITO_CERRADO_XML = `<svg width="38" height="16" viewBox="0 0 38 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.54492 14.0665C8.34492 -2.62765 28.7449 -2.62765 35.5449 14.0665" stroke="black" stroke-width="3.09091" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function PrivacyEyeIcon({ hidden, size = 24, color = '#000000' }: { hidden: boolean; size?: number; color?: string }) {
  const xml = (hidden ? OJITO_CERRADO_XML : OJITO_ABIERTO_XML).replace(/black/g, color);
  return (
    <SvgXml xml={xml} width={size} height={hidden ? size * 0.42 : size * 0.64} />
  );
}

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

// ─── BorderSweep (idéntico al de index.tsx) ──────────────────────────────────
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

  const perimeter = 2 * (rectWidth - rectHeight) + Math.PI * rectHeight;
  const dashLength = Math.max(30, perimeter * 0.22);
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

// ─── FAB Button — idéntico a FinanceToggleButton de index.tsx ────────────────
function FabButton({
  label,
  icon,
  accent,
  sweepDirection,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
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
      style={({ pressed }) => [styles.fabButton, pressed && styles.pressed]}
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
      <Ionicons name={icon} size={20} color={accent} />
      <Text style={styles.fabButtonText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ExtrasScreen() {
  const tabPadding = useTabPadding();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const currentUser = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const currency = useAppStore((s) => s.currency);
  const payload = useAppStore((s) => s.payload);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const deleteGoal = useAppStore((s) => s.deleteGoal);
  const user = getUserData(users, currentUser);

  const { heroAnim, contentAnim } = useEntranceAnimation({
    animateOnFocus: false,
    scrollRef,
    onResetScroll: () => reportFabScroll(0),
  });

  const [refreshing, setRefreshing] = useState(false);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('both');

  const [selectedSaving, setSelectedSaving] = useState<SavingPlan | null>(null);
  const [createSavingOpen, setCreateSavingOpen] = useState(false);
  const [editSaving, setEditSaving] = useState<SavingPlan | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [detailPlanId, setDetailPlanId] = useState<number | null>(null);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const now = new Date();
  const headerTopPadding = Math.max(insets.top + 18, 52);

  // ── FAB collapse on scroll (igual que index.tsx) ──────────────────────────
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

  // ── Data ──────────────────────────────────────────────────────────────────
  const totalAhorrado = useMemo(() => {
    const fromSavings = payload.savings.reduce((sum, plan) => sum + savingPlanSavedAmount(plan), 0);
    const fromGoals = payload.contribs.reduce((sum, contribution) => sum + contribution.amt, 0);
    return fromSavings + fromGoals;
  }, [payload.contribs, payload.savings]);

  const activePlans = useMemo(
    () => (payload.plans ?? []).filter((plan) => !plan.finalizedAt),
    [payload.plans],
  );

  const totalEnPlanes = useMemo(
    () => activePlans.reduce((sum, plan) => sum + planTotalSpent(plan), 0),
    [activePlans],
  );
  const hasSavings = (payload.savings?.length ?? 0) > 0 || (payload.goals?.length ?? 0) > 0;
  const hasPlans = (payload.plans?.length ?? 0) > 0;
  const hasNeither = !hasSavings && !hasPlans;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  const handleDeleteGoal = (goal: Goal) => {
    Alert.alert('Eliminar meta', 'Tambien se eliminaran sus aportes.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteGoal(goal.id) },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabPadding + 72 }]}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        onScroll={(event) => reportFabScroll(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        <LinearGradient
          colors={EXTRAS_GRADIENT}
          locations={[0, 0.34, 0.64, 0.92, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.headerVisual}
        >
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <Animated.View
            style={[
              styles.header,
              {
                paddingTop: headerTopPadding,
                opacity: heroAnim,
                transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
              },
            ]}
          >
            <Pressable
              accessibilityLabel="Abrir perfil"
              onPress={() => router.push('/perfil')}
              style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
              hitSlop={8}
            >
              <HeaderAvatar user={user} styles={styles} />
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
              style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
              hitSlop={8}
            >
              <Ionicons name="settings-outline" size={25} color="#FFFFFF" />
            </Pressable>
          </Animated.View>

          {/* ── Carousel de tarjetas (igual que FinanceHeroCards en index.tsx) ── */}
          <Animated.View
            style={[{
              opacity: contentAnim,
              transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
            }]}
          >
            <ExtrasHeroCarousel
              totalAhorrado={totalAhorrado}
              totalEnPlanes={totalEnPlanes}
              activePlansCount={activePlans.length}
              currency={currency}
              viewportWidth={width}
              onPressSavings={() => { }}
              onPressPlans={() => { }}
            />
          </Animated.View>
        </LinearGradient>

        {/* ── Feed de movimientos ─────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.feedSection,
            {
              opacity: contentAnim,
              transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }],
            },
          ]}
        >

          {/* Lista */}
          {hasNeither ? (
            <View style={styles.onboardingContainer}>
              <OnboardingAhorros styles={styles} />
              <View style={styles.onboardingBtnContainer}>
                <View style={styles.onboardingBtnWrapper}>
                  <FabButton
                    label="Crear Ahorro"
                    icon="wallet-outline"
                    accent={CREATE_SAVING_ACCENT}
                    sweepDirection="cw"
                    onPress={() => setCreateSavingOpen(true)}
                  />
                </View>
              </View>

              <OnboardingPlanes styles={styles} />
              <View style={styles.onboardingBtnContainer}>
                <View style={styles.onboardingBtnWrapper}>
                  <FabButton
                    label="Crear Plan"
                    icon="map-outline"
                    accent={CREATE_PLAN_ACCENT}
                    sweepDirection="ccw"
                    onPress={() => setNewPlanOpen(true)}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.movementsList}>
              {/* ── SECCIÓN AHORROS ── */}
              {/* Ahorros Libres/Con Meta */}
              {payload.savings.length > 0 && (
                <View style={{ gap: 10 }}>
                  <Text style={[styles.sectionSubtitle, styles.sectionSubtitleOnGradient, { marginTop: 4 }]}>Ahorros</Text>
                  {payload.savings.map((saving) => (
                    <SavingPlanPreviewCard
                      key={String(saving.id)}
                      plan={saving}
                      onPress={() => setSelectedSaving(saving)}
                      onEdit={() => setEditSaving(saving)}
                      readOnly={saving.type === 'personal' && saving.uid !== currentUser}
                    />
                  ))}
                </View>
              )}

              {/* Metas */}
              {payload.goals.length > 0 && (
                <View style={{ gap: 10, marginTop: payload.savings.length > 0 ? 12 : 0 }}>
                  <Text style={styles.sectionSubtitle}>Metas de ahorro</Text>
                  {payload.goals.map((goal) => (
                    <GoalCard
                      key={String(goal.id)}
                      goal={goal}
                      contribs={payload.contribs}
                      readOnly={goal.type === 'personal' && goal.uid !== currentUser}
                      onPress={() => setSelectedGoal(goal)}
                      onContribute={() => setContributeGoal(goal)}
                      onEdit={() => setEditGoal(goal)}
                      onDelete={() => handleDeleteGoal(goal)}
                    />
                  ))}
                </View>
              )}

              {/* Vacío Ahorros */}
              {payload.savings.length === 0 && payload.goals.length === 0 && (
                <View style={{ gap: 10 }}>
                  <Text style={[styles.sectionSubtitle, styles.sectionSubtitleOnGradient, { marginTop: 4 }]}>Ahorros</Text>
                  <View style={styles.emptyFeed}>
                    <View style={styles.emptyFeedIcon}>
                      <Ionicons name="wallet-outline" size={26} color="#9933FF" />
                    </View>
                    <Text style={styles.emptyFeedTitle}>Sin ahorros</Text>
                    <Text style={styles.emptyFeedText}>Crea un ahorro o una meta usando el botón flotante.</Text>
                  </View>
                </View>
              )}

              {/* ── SECCIÓN PLANES ── */}
              {activePlans.length > 0 && (
                <View style={{ gap: 10, marginTop: (payload.savings.length > 0 || payload.goals.length > 0) ? 20 : 0 }}>
                  <Text style={styles.sectionSubtitle}>Planes compartidos</Text>
                  {activePlans.map((plan) => (
                    <PlanTileRow
                      key={String(plan.id)}
                      plan={plan}
                      currency={currency}
                      onPress={() => setDetailPlanId(plan.id)}
                    />
                  ))}
                </View>
              )}

              {/* Vacío Planes */}
              {activePlans.length === 0 && (
                <View style={{ gap: 10, marginTop: (payload.savings.length > 0 || payload.goals.length > 0) ? 20 : 0 }}>
                  <Text style={styles.sectionSubtitle}>Planes compartidos</Text>
                  <View style={styles.emptyFeed}>
                    <View style={styles.emptyFeedIcon}>
                      <Ionicons name="map-outline" size={26} color="#2563EB" />
                    </View>
                    <Text style={styles.emptyFeedTitle}>Sin planes</Text>
                    <Text style={styles.emptyFeedText}>Crea un plan compartido usando el botón flotante.</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── FABs flotantes ────────────────────────────────────────────────── */}
      {!hasNeither && (
        <Animated.View pointerEvents="box-none" style={[styles.fabRow, { bottom: tabPadding - 4, opacity: contentAnim }]}>
          <Animated.View style={[styles.fabHalf, { transform: [{ translateX: fabLeftTx }] }]}>
            <FabButton
              label="Crear Ahorro"
              icon="wallet-outline"
              accent={CREATE_SAVING_ACCENT}
              sweepDirection="cw"
              onPress={() => setCreateSavingOpen(true)}
            />
          </Animated.View>
          <Animated.View style={[styles.fabHalf, { transform: [{ translateX: fabRightTx }] }]}>
            <FabButton
              label="Crear Plan"
              icon="map-outline"
              accent={CREATE_PLAN_ACCENT}
              sweepDirection="ccw"
              onPress={() => setNewPlanOpen(true)}
            />
          </Animated.View>
        </Animated.View>
      )}

      {/* ── Modales ───────────────────────────────────────────────────────── */}
      <SavingPlanDetailModal
        plan={selectedSaving}
        onClose={() => setSelectedSaving(null)}
        onEdit={() => {
          const saving = selectedSaving;
          setSelectedSaving(null);
          setEditSaving(saving);
        }}
      />
      <SavingPlanModal
        visible={createSavingOpen}
        onClose={() => {
          setCreateSavingOpen(false);
        }}
      />
      <SavingPlanModal visible={!!editSaving} plan={editSaving} onClose={() => setEditSaving(null)} />
      <GoalModal visible={!!editGoal} goal={editGoal} onClose={() => setEditGoal(null)} />
      <ContributionModal visible={!!contributeGoal} goal={contributeGoal} onClose={() => setContributeGoal(null)} />
      <GoalDetailModal
        goal={selectedGoal}
        contribs={payload.contribs}
        currency={currency}
        users={users}
        onClose={() => setSelectedGoal(null)}
        onContribute={(goal) => setContributeGoal(goal)}
        onEdit={(goal) => setEditGoal(goal)}
        onDelete={handleDeleteGoal}
      />
      <PlanDetailModal
        plan={payload.plans.find((plan) => plan.id === detailPlanId) ?? null}
        onClose={() => setDetailPlanId(null)}
        onEdit={() => {
          const plan = payload.plans.find((entry) => entry.id === detailPlanId) ?? null;
          setDetailPlanId(null);
          setTimeout(() => setEditingPlan(plan), 120);
        }}
      />
      <PlanModal
        visible={newPlanOpen}
        onClose={() => {
          setNewPlanOpen(false);
        }}
      />
      <PlanModal visible={!!editingPlan} plan={editingPlan} onClose={() => setEditingPlan(null)} />
    </View>
  );
}

// ─── Carousel de tarjetas (igual estructura que FinanceHeroCards en index.tsx)
function ExtrasHeroCarousel({
  totalAhorrado,
  totalEnPlanes,
  activePlansCount,
  currency,
  viewportWidth,
  onPressSavings,
  onPressPlans,
}: {
  totalAhorrado: number;
  totalEnPlanes: number;
  activePlansCount: number;
  currency: CurrencyCode;
  viewportWidth: number;
  onPressSavings: () => void;
  onPressPlans: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [hidden, setHidden] = useState(false);
  const privacy = useRef(new Animated.Value(0)).current;

  const viewport = carouselWidth || viewportWidth;
  const cardWidth = Math.max(280, Math.min(viewport - 72, 430));
  const snapInterval = cardWidth + HERO_CARD_GAP;

  useEffect(() => {
    Animated.timing(privacy, {
      toValue: hidden ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hidden, privacy]);

  const toggleHidden = () => setHidden((h) => !h);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      disableIntervalMomentum
      snapToInterval={snapInterval}
      snapToAlignment="start"
      scrollEventThrottle={16}
      style={styles.carouselViewport}
      contentContainerStyle={styles.carouselRail}
      onLayout={(event) => setCarouselWidth(event.nativeEvent.layout.width)}
    >
      {/* Tarjeta Ahorros */}
      <View style={[styles.heroCard, { width: cardWidth }]}>
        <View style={styles.heroCardTop}>
          <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
          <Text style={styles.heroCardLabel}>Ahorros</Text>
          <Pressable
            accessibilityLabel={hidden ? 'Mostrar montos' : 'Ocultar montos'}
            onPress={toggleHidden}
            style={({ pressed }) => [styles.heroCardEyeBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <PrivacyEyeIcon hidden={hidden} size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <Pressable
          onPress={onPressSavings}
          style={({ pressed }) => [styles.heroCardBody, pressed && styles.heroCardBodyPressed]}
        >
          <View style={styles.heroCardAmountWrap}>
            <Animated.View style={{ opacity: privacy.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
              <HeroAmount amount={totalAhorrado} currency={currency} accent={CREATE_SAVING_ACCENT} />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.heroCardPrivacyLayer,
                {
                  opacity: privacy,
                  transform: [{ translateY: privacy.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
                },
              ]}
            >
              <Text style={styles.heroCardHiddenAmt}>••••••</Text>
            </Animated.View>
          </View>
        </Pressable>
      </View>

      {/* Tarjeta Planes */}
      <View style={[styles.heroCard, { width: cardWidth }]}>
        <View style={styles.heroCardTop}>
          <Ionicons name="map-outline" size={20} color="#FFFFFF" />
          <Text style={styles.heroCardLabel}>Planes</Text>
          <Pressable
            accessibilityLabel={hidden ? 'Mostrar montos' : 'Ocultar montos'}
            onPress={toggleHidden}
            style={({ pressed }) => [styles.heroCardEyeBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <PrivacyEyeIcon hidden={hidden} size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <Pressable
          onPress={onPressPlans}
          style={({ pressed }) => [styles.heroCardBody, pressed && styles.heroCardBodyPressed]}
        >
          <View style={styles.heroCardAmountWrap}>
            <Animated.View style={{ opacity: privacy.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
              <HeroAmount amount={totalEnPlanes} currency={currency} accent={CREATE_PLAN_ACCENT} />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.heroCardPrivacyLayer,
                {
                  opacity: privacy,
                  transform: [{ translateY: privacy.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
                },
              ]}
            >
              <Text style={styles.heroCardHiddenAmt}>••••••</Text>
            </Animated.View>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function HeroAmount({ amount, currency, accent }: { amount: number; currency: CurrencyCode; accent: string }) {
  const parts = splitAmount(amount, currency);
  const decimalSeparator = currency === 'USD' ? '.' : ',';
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.48} style={heroAmountStyles.amount}>
      {parts.sign}{parts.whole}
      <Text style={[heroAmountStyles.decimals, { color: accent }]}>
        {decimalSeparator}{parts.decimals}{parts.symbol}
      </Text>
    </Text>
  );
}

const heroAmountStyles = StyleSheet.create({
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

function OnboardingAhorros({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.explainCard}>
      <View style={styles.explainItem}>
        <View style={styles.explainItemHeader}>
          <Text style={styles.explainItemTitle}>Ahorros y Metas</Text>
        </View>
        <Text style={styles.explainItemText}>
          Establece objetivos en pareja y ahorra para viajes, compras o fondos de emergencia.
        </Text>
      </View>
    </View>
  );
}

function OnboardingPlanes({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.explainCard}>
      <View style={styles.explainItem}>
        <View style={styles.explainItemHeader}>
          <Text style={styles.explainItemTitle}>Planes Compartidos</Text>
        </View>
        <Text style={styles.explainItemText}>
          Lleva cuentas claras de tus viajes o compras grupales dividiendo gastos equitativamente.
        </Text>
      </View>
    </View>
  );
}


function HeaderAvatar({
  user,
  styles,
}: {
  user: ReturnType<typeof getUserData>;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={[styles.headerAvatar, { backgroundColor: user.bg }]}>
      {user.photo ? (
        <Image source={user.photo} style={styles.headerAvatarImage} />
      ) : (
        <Text style={[styles.headerAvatarInitials, { color: user.color }]}>
          {user.initials}
        </Text>
      )}
    </View>
  );
}

function PlanTileRow({ plan, currency, onPress }: { plan: Plan; currency: CurrencyCode; onPress: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const category = CATEGORIES[plan.icon] ?? CATEGORIES.map;
  const iconColor = getIconColor(plan.iconColor ?? 'purple');
  const spent = planTotalSpent(plan);
  const budget = planTotalBudget(plan);
  const hasBudget = budget > 0;
  const pct = hasBudget ? Math.min(1, spent / budget) : 0;
  const remaining = budget - spent;
  const exceeded = hasBudget && remaining < 0;
  const barColor = exceeded ? theme.expense : pct >= 0.75 ? '#EA580C' : iconColor.color;
  const settled = plan.expenses.length > 0 && resolveDebts(computeMemberBalances(plan)).length === 0;

  if (!hasBudget) {
    // ESTADO 1: Simple movement-like row layout
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.planCardSimple, pressed && styles.pressed]}
      >
        <View style={[styles.planIconCircle, { backgroundColor: iconColor.color }]}>
          <Ionicons name={category.icon} size={22} color="#FFFFFF" />
        </View>
        <View style={styles.planTextBody}>
          <Text numberOfLines={1} style={styles.planSimpleTitle}>
            {plan.title}
          </Text>
          <Text style={styles.planSimpleSubtitle}>
            {plan.expenses.length} {plan.expenses.length === 1 ? 'gasto' : 'gastos'}
          </Text>
        </View>
        <View style={styles.planAmountCol}>
          <Text style={styles.planSimpleAmount} numberOfLines={1}>
            {fmt(spent, currency)}
          </Text>
          {settled ? (
            <View style={[styles.planStatusBadge, { marginTop: 2 }]}>
              <Text style={styles.planStatusText}>Saldado</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  // ESTADO 2: Detailed category-themed card layout
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.planCardDetailed, pressed && styles.pressed]}
    >
      {/* Solid category colored rounded square with category icon */}
      <View style={[styles.planColorBlock, { backgroundColor: iconColor.color }]}>
        <Ionicons name={category.icon} size={20} color="#FFFFFF" />
      </View>

      {/* Card Content Column */}
      <View style={styles.planCardContent}>
        {/* Top Row: Title & Budget Limit */}
        <View style={styles.planTopRow}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Text style={styles.planDetailedTitle} numberOfLines={1}>
              {plan.title}
            </Text>
            {settled && (
              <View style={styles.planStatusBadge}>
                <Text style={styles.planStatusText}>Saldado</Text>
              </View>
            )}
          </View>
          <Text style={styles.planBudgetLimit} numberOfLines={1}>
            {fmt(budget, currency)}
          </Text>
        </View>

        {/* Middle Row: Progress Bar */}
        <View style={styles.planProgressBarTrack}>
          <View
            style={[
              styles.planProgressBarFill,
              {
                width: `${Math.round(pct * 100)}%`,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>

        {/* Bottom Row: Spent Amount & Remaining / Exceeded amount */}
        <View style={styles.planBottomRow}>
          <Text style={styles.planSpentAmount} numberOfLines={1}>
            {fmt(spent, currency)}
          </Text>
          <Text
            style={[styles.planRemainingAmount, { color: exceeded ? theme.expense : iconColor.color }]}
            numberOfLines={1}
          >
            {exceeded ? `Excedido +${fmt(Math.abs(remaining), currency)}` : fmt(remaining, currency)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (t: AppTheme) => StyleSheet.create({
  screen: {
    backgroundColor: t.background,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  headerVisual: {
    overflow: 'visible',
    paddingBottom: 200,
  },
  scrollContent: {
    // Sin paddingHorizontal — el carousel necesita ancho completo
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  avatarButton: {
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
  settingsButton: {
    alignItems: 'center',
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  // ── Carousel de tarjetas (igual que index.tsx) ───────────────────────────
  carouselViewport: {
    alignSelf: 'center',
    marginBottom: 2,
    // overflow visible = sin corte, igual que financeHeroViewport en index.tsx
    overflow: 'visible',
    width: '100%',
  },
  carouselRail: {
    flexDirection: 'row',
    gap: HERO_CARD_GAP,
    paddingHorizontal: 24,
  },
  heroCard: {
    backgroundColor: 'rgba(43, 47, 50, 0.15)',
    borderRadius: 22,
    minHeight: 140,
    overflow: 'hidden',
  },
  heroCardPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  heroCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroCardLabel: {
    color: '#FFFFFF',
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    letterSpacing: 0,
    lineHeight: 21,
  },
  heroCardEyeBtn: {
    alignItems: 'center',
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  heroCardBody: {
    // Idéntico a financeHeroBody en index.tsx
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 28,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  heroCardBodyPressed: {
    backgroundColor: 'rgba(248, 248, 248, 1)',
  },
  heroCardAmountWrap: {
    minWidth: 0,
    position: 'relative',
  },
  heroCardPrivacyLayer: {
    alignItems: 'flex-start',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
  },
  heroCardHiddenAmt: {
    color: '#24282D',
    fontFamily: 'Poppins_500Medium',
    fontSize: 42,
    letterSpacing: 2,
    lineHeight: 50,
  },

  // ── Feed de movimientos ───────────────────────────────────────────────────
  feedSection: {
    marginTop: -168,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    marginBottom: 12,
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
    marginBottom: 16,
  },
  filterSummaryItem: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 999,
  },
  filterSummaryItemActive: {
    // No background highlight
  },
  filterSummaryText: {
    color: t.textSecondary,
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 18,
  },
  filterSummaryTextActive: {
    color: t.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
  },
  filterSeparator: {
    backgroundColor: t.border,
    height: 16,
    width: 1,
  },

  // ── Onboarding / Explanation Card ─────────────────────────────────────────
  explainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginTop: 6,
    marginBottom: 10,
    borderColor: 'rgba(153, 51, 255, 0.08)',
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
  },
  explainDivider: {
    backgroundColor: 'rgba(36, 40, 45, 0.08)',
    height: 1,
    marginVertical: 18,
  },
  explainItem: {
    gap: 8,
  },
  explainItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  explainIconContainer: {
    alignItems: 'center',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
    flexShrink: 0,
  },
  explainItemTitle: {
    color: '#24282D',
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
  },
  explainItemText: {
    color: 'rgba(36, 40, 45, 0.65)',
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  onboardingContainer: {
    marginBottom: 10,
  },
  onboardingBtnContainer: {
    marginBottom: 22,
    width: '100%',
  },
  onboardingBtnWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    borderRadius: 999,
    elevation: 12,
    shadowColor: '#3C0B6F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    height: 46,
    width: '100%',
  },
  movementsList: {
    gap: 10,
  },
  movementCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  movementIconBlock: {
    alignItems: 'center',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
    flexShrink: 0,
  },
  movementTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  movementTitle: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    letterSpacing: 0,
    lineHeight: 20,
  },
  movementDate: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11.5,
    lineHeight: 16,
  },
  movementAmount: {
    flexShrink: 0,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    letterSpacing: 0,
    maxWidth: 110,
  },
  movementBadge: {
    borderRadius: 999,
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  movementBadgeText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  emptyFeed: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 22,
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 36,
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: t.mode === 'light' ? 0.05 : 0.12,
    shadowRadius: 8,
  },
  emptyFeedIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(153, 51, 255, 0.08)',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  emptyFeedTitle: {
    color: t.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    textAlign: 'center',
  },
  emptyFeedText: {
    color: t.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
  },

  // ── FABs flotantes (igual patrón que index.tsx) ───────────────────────────
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
  fabButton: {
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
  fabButtonText: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },

  // ── Detail modal styles ───────────────────────────────────────────────────
  detailPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  detailPill: {
    backgroundColor: t.background,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 10,
  },
  detailPillLabel: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  detailPillValue: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  detailAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.10)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailActionText: {
    color: '#7C3AED',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  detailActionDanger: {
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.10)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailActionDangerText: {
    color: '#DC2626',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  historyTitle: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  historyList: {
    borderTopColor: t.border,
    borderTopWidth: 1,
  },
  historyRow: {
    borderBottomColor: t.border,
    borderBottomWidth: 1,
    gap: 3,
    paddingVertical: 12,
  },
  historyAmt: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  historyMeta: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  historyNote: {
    color: t.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  emptySectionText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  sectionSubtitle: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 18.5,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionSubtitleOnGradient: {
    color: '#FFFFFF',
  },
  // -- Plan card styles --
  planCardSimple: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    shadowOpacity: t.mode === 'light' ? 0.05 : 0.12,
    shadowRadius: 8,
  },
  planIconCircle: {
    alignItems: 'center',
    borderRadius: 14,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    marginRight: 2,
    width: 44,
  },
  planTextBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  planSimpleTitle: {
    color: '#24282D',
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  planSimpleSubtitle: {
    color: 'rgba(36, 40, 45, 0.65)',
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  planAmountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
    minWidth: 96,
  },
  planSimpleAmount: {
    color: '#24282D',
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    textAlign: 'right',
  },
  planSimpleMutedText: {
    color: 'rgba(36, 40, 45, 0.55)',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginTop: 1,
  },
  planCardDetailed: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 11,
    position: 'relative',
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: t.mode === 'light' ? 0.05 : 0.12,
    shadowRadius: 8,
    overflow: 'visible',
  },
  planColorBlock: {
    alignItems: 'center',
    borderRadius: 12,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  planCardContent: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  planTopRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
    width: '100%',
  },
  planDetailedTitle: {
    color: '#24282D',
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14.5,
  },
  planBudgetLimit: {
    color: '#24282D',
    flexShrink: 0,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14.5,
    textAlign: 'right',
  },
  planProgressBarTrack: {
    backgroundColor: 'rgba(36, 40, 45, 0.08)',
    borderRadius: 99,
    height: 5,
    marginVertical: 4,
    overflow: 'hidden',
    width: '100%',
  },
  planProgressBarFill: {
    borderRadius: 99,
    height: '100%',
  },
  planBottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  planSpentAmount: {
    color: 'rgba(36, 40, 45, 0.65)',
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  planRemainingAmount: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    textAlign: 'right',
  },
  planStatusBadge: {
    backgroundColor: t.income + '2E',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'center',
  },
  planStatusText: {
    color: t.income,
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
  },
});
