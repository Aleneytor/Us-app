import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetCategoryCard } from '../../components/BudgetCategoryCard';
import { CategoryRingChart } from '../../components/CategoryRingChart';
import type { RingSlice } from '../../components/CategoryRingChart';
import { type AppTheme, getIconColor } from '../../constants/colors';
import { SECTION_TITLE_FONT_FAMILY } from '../../constants/typography';
import { BudgetCategoryDetailModal } from '../../modals/BudgetCategoryDetailModal';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import type { AppPayload, BudgetCategory, UserData } from '../../types';
import { calcBudgetCategoryIncome, calcBudgetCategorySpending } from '../../utils/calculations';
import { isMonthVisible } from '../../utils/filters';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useTabPadding } from '../../hooks/useTabPadding';
import { reportFabScroll } from '../../utils/fabScroll';
import { useTheme } from '../../contexts/ThemeContext';
import { nextYM, prevYM } from '../../utils/format';
import { getUserData } from '../../utils/users';

// Same gradient as home and movimientos hero
const HOME_TOP_GRADIENT = ['#9933FF', '#A44BFF', '#B86EFF', '#D5ADFF', '#F2F2F7'] as const;
type ChartMode = 'expense' | 'income';
const CREATE_CATEGORY_ACCENT = '#7C3AED';
const SWEEP_STROKE_WIDTH = 2;
const SWEEP_CYCLE_MS = 4000;
const SWEEP_TRAVEL_MS = 1500;

// ── Avatar ───────────────────────────────────────────────────────────────────

function HeaderAvatar({ user }: { user: UserData }) {
  return (
    <View style={[avatarStyles.avatar, { backgroundColor: user.bg }]}>
      {user.photo ? (
        <Image source={user.photo} style={avatarStyles.avatarImage} />
      ) : (
        <Text style={[avatarStyles.avatarInitials, { color: user.color }]}>
          {user.initials}
        </Text>
      )}
    </View>
  );
}

const avatarStyles = StyleSheet.create({
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

const AnimatedSweepRect = Animated.createAnimatedComponent(Rect);

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/** Returns the ISO date of the most recent transaction for a category in ym */
function getLastTransactionDate(
  payload: AppPayload,
  catId: number,
  uid: string,
  ym: string,
): string | undefined {
  const matching = payload.expenses
    .filter(
      (t) =>
        t.uid === uid &&
        !t.del &&
        String(t.budgetCatId) === String(catId) &&
        isMonthVisible(t, ym),
    )
    .map((t) => t.date)
    .sort()
    .reverse();
  return matching[0];
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CategoriasScreen() {
  const tabPadding = useTabPadding();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const setSelectedYM = useAppStore((s) => s.setSelectedYM);
  const currency = useAppStore((s) => s.currency);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { width: screenWidth } = useWindowDimensions();
  const chartSize = Math.min(230, Math.max(198, screenWidth - 124));

  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('expense');
  const scrollRef = useRef<ScrollView>(null);

  const { heroAnim, contentAnim, headerAnim, itemAnims } = useEntranceAnimation({
    animateOnFocus: false,
    scrollRef,
    onResetScroll: () => reportFabScroll(0),
  });

  const user = getUserData(users, currentUser);
  const now = new Date();
  const greeting = getGreeting(now);
  const dateLabel = getDateLabel(now);

  // Animated indicator for the Ingresos/Gastos toggle
  const toggleMotion = useRef(new Animated.Value(chartMode === 'expense' ? 1 : 0)).current;
  const [toggleWidth, setToggleWidth] = useState(0);
  const [createBtnSize, setCreateBtnSize] = useState({ width: 0, height: 0 });
  const indicatorX = toggleMotion.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, (toggleWidth - 4) / 2)],
  });

  useEffect(() => {
    Animated.spring(toggleMotion, {
      toValue: chartMode === 'expense' ? 1 : 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 220,
      mass: 0.7,
    }).start();
  }, [chartMode, toggleMotion]);

  const budgetCategories = useMemo(() => {
    const all = payload.budgetCategories ?? [];
    return all.filter((bc) => bc.uid === undefined || bc.uid === currentUser);
  }, [payload.budgetCategories, currentUser]);

  const sortedBudgetCategories = useMemo(() => {
    return [...budgetCategories].sort((a, b) => {
      const valueA = chartMode === 'income'
        ? calcBudgetCategoryIncome(payload, a.id, selectedYM)
        : calcBudgetCategorySpending(payload, a.id, currentUser, selectedYM);
      const valueB = chartMode === 'income'
        ? calcBudgetCategoryIncome(payload, b.id, selectedYM)
        : calcBudgetCategorySpending(payload, b.id, currentUser, selectedYM);
      return valueB - valueA || a.name.localeCompare(b.name);
    });
  }, [budgetCategories, chartMode, currentUser, payload, selectedYM]);

  const ringSlices = useMemo((): RingSlice[] => {
    return sortedBudgetCategories.map((cat) => ({
      id: cat.id,
      label: cat.name,
      color: getIconColor(cat.iconColor).color,
      value: chartMode === 'income'
        ? calcBudgetCategoryIncome(payload, cat.id, selectedYM)
        : calcBudgetCategorySpending(payload, cat.id, currentUser, selectedYM),
    }));
  }, [chartMode, sortedBudgetCategories, currentUser, payload, selectedYM]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  const headerTopPadding = insets.top + 18;

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: tabPadding + 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        overScrollMode="auto"
        onScroll={(event) => reportFabScroll(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        {/* ── HERO ──────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: heroAnim,
              transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <LinearGradient
            colors={HOME_TOP_GRADIENT}
            locations={[0, 0.28, 0.54, 0.78, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroGradient}
          >
            {/* Header row: avatar + text + settings */}
            <View style={[styles.heroHeader, { paddingTop: headerTopPadding }]}>
              <Pressable
                accessibilityLabel="Abrir perfil"
                onPress={() => router.push('/perfil')}
                style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
                hitSlop={8}
              >
                <HeaderAvatar user={user} />
              </Pressable>

              <View style={styles.heroTextWrap}>
                <Text style={styles.heroGreeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                  {greeting}, {user.name}
                </Text>
                <Text style={styles.heroDate} numberOfLines={1}>
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

            {/* Ingresos / Gastos toggle pill */}
            {budgetCategories.length > 0 && (
              <Animated.View
                style={[
                  styles.toggleWrap,
                  {
                    opacity: contentAnim,
                    transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
                  },
                ]}
              >
                <View
                  style={styles.toggleTrack}
                  onLayout={(e) => setToggleWidth(e.nativeEvent.layout.width)}
                >
                  {toggleWidth > 0 && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.toggleIndicator,
                        {
                          width: Math.max(0, (toggleWidth - 4) / 2),
                          transform: [{ translateX: indicatorX }],
                        },
                      ]}
                    />
                  )}
                  <Pressable
                    onPress={() => setChartMode('income')}
                    style={styles.togglePill}
                  >
                    <Text style={[styles.toggleText, chartMode === 'income' && styles.toggleTextActive]}>
                      Ingresos
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setChartMode('expense')}
                    style={styles.togglePill}
                  >
                    <Text style={[styles.toggleText, chartMode === 'expense' && styles.toggleTextActive]}>
                      Gastos
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ── RING CHART + ARROW NAV ──────────────────── */}
        {budgetCategories.length > 0 && (
          <Animated.View
            style={{
              opacity: contentAnim,
              transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
            }}
          >
            {/* Ring chart flanked by solid arrow buttons */}
            <View style={styles.chartNavigator}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mes anterior"
                onPress={() => setSelectedYM(prevYM(selectedYM))}
                style={({ pressed }) => [
                  styles.chartNavBtn,
                  pressed && styles.chartNavBtnPressed,
                ]}
              >
                <Ionicons name="caret-back" size={18} color="#171717" />
              </Pressable>

              <CategoryRingChart
                slices={ringSlices}
                currency={currency}
                selectedYM={selectedYM}
                size={chartSize}
                mode={chartMode}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mes siguiente"
                onPress={() => setSelectedYM(nextYM(selectedYM))}
                style={({ pressed }) => [
                  styles.chartNavBtn,
                  pressed && styles.chartNavBtnPressed,
                ]}
              >
                <Ionicons name="caret-forward" size={18} color="#171717" />
              </Pressable>
            </View>

            {/* Legend pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.legendRow}
              style={styles.legendScroll}
            >
              {ringSlices.filter((s) => s.value > 0).map((slice) => (
                <View key={slice.id} style={styles.legendPill}>
                  <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>{slice.label}</Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── SECTION HEADER ───────────────────────────────── */}
        <Animated.View
          style={[
            styles.sectionHeader,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Categorías</Text>
        </Animated.View>

        {/* Botón para crear categoría */}
        <Animated.View
          style={[
            styles.createBtnContainer,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          <View style={styles.fabWrapper}>
            <Pressable
              onPress={() => setCreateOpen(true)}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setCreateBtnSize({ width, height });
              }}
              style={({ pressed }) => [styles.fabButton, pressed && styles.pressed]}
            >
              <BlurView
                intensity={42}
                tint={theme.mode === 'light' ? 'light' : 'dark'}
                style={StyleSheet.absoluteFill}
              />
              {createBtnSize.width > 0 && (
                <BorderSweep
                  accent={CREATE_CATEGORY_ACCENT}
                  direction="cw"
                  width={createBtnSize.width}
                  height={createBtnSize.height}
                />
              )}
              <Ionicons name="add" size={19} color={CREATE_CATEGORY_ACCENT} />
              <Text style={styles.fabButtonText}>Crear Categoría</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── CATEGORY LIST ─────────────────────────────────── */}
        {budgetCategories.length === 0 ? (
          <Animated.View style={[styles.emptyState, { opacity: headerAnim }]}>
            <Ionicons name="pie-chart-outline" size={34} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>Sin categorías</Text>
            <Text style={styles.emptyText}>
              Crea una categoría para rastrear tu presupuesto mensual por tipo de gasto.
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.list}>
            {sortedBudgetCategories.map((category, index) => {
              const itemAnim = itemAnims[index] ?? headerAnim;
              const value = chartMode === 'income'
                ? calcBudgetCategoryIncome(payload, category.id, selectedYM)
                : calcBudgetCategorySpending(payload, category.id, currentUser, selectedYM);
              const totalByMode = ringSlices.reduce((sum, s) => sum + s.value, 0);
              const percentOfTotal = totalByMode > 0 ? value / totalByMode : 0;
              return (
                <Animated.View
                  key={category.id}
                  style={{
                    opacity: itemAnim,
                    transform: [{ translateY: itemAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                  }}
                >
                  <BudgetCategoryCard
                    category={category}
                    spent={value}
                    currency={currency}
                    percentOfTotal={percentOfTotal}
                    onPress={() => setSelectedCategory(category)}
                  />
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BudgetCategoryModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <BudgetCategoryDetailModal
        category={selectedCategory}
        currency={currency}
        selectedYM={selectedYM}
        onClose={() => setSelectedCategory(null)}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const makeStyles = (t: AppTheme) => StyleSheet.create({
  screen: {
    backgroundColor: t.background,
    flex: 1,
  },
  content: {},

  // Hero
  heroSection: {
    zIndex: 1,
  },
  heroGradient: {
    overflow: 'hidden',
    paddingBottom: 24,
  },
  heroHeader: {
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
  settingsButton: {
    alignItems: 'center',
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroGreeting: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 22,
  },
  heroDate: {
    color: 'rgba(255, 255, 255, 0.60)',
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },

  // Ingresos / Gastos toggle pill
  toggleWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  toggleTrack: {
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 999,
    flexDirection: 'row',
    height: 36,
    overflow: 'hidden',
    padding: 2,
    position: 'relative',
    width: 240,
  },
  toggleIndicator: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    bottom: 2,
    left: 2,
    position: 'absolute',
    top: 2,
  },
  togglePill: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    height: 32,
    justifyContent: 'center',
    zIndex: 1,
  },
  toggleText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  toggleTextActive: {
    color: '#1A1A2E',
  },

  // Month nav
  monthNavWrap: {
    marginTop: 16,
    paddingHorizontal: 20,
  },

  // Chart
  chartRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartNavigator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    marginTop: -2,
    paddingHorizontal: 20,
  },
  chartNavBtn: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    height: 44,
    justifyContent: 'center',
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: t.mode === 'light' ? 0.18 : 0.3,
    shadowRadius: 18,
    width: 44,
    elevation: 9,
  },
  chartNavBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },

  // Legend pills
  legendScroll: {
    marginTop: 4,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  legendPill: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderRadius: 99,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  legendDot: {
    borderRadius: 99,
    height: 8,
    width: 8,
  },
  legendLabel: {
    color: t.textPrimary,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },

  // Section header
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionTitle: {
    color: t.textPrimary,
    fontFamily: SECTION_TITLE_FONT_FAMILY,
    fontSize: 18,
  },

  // Category list
  list: {
    gap: 8,
    paddingHorizontal: 20,
  },

  createBtnContainer: {
    alignItems: 'stretch',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  fabWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    borderRadius: 999,
    elevation: 3,
    shadowColor: '#3C0B6F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    height: 46,
    width: '100%',
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

  // Empty state
  emptyState: {
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyTitle: {
    color: t.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
  },
  emptyText: {
    color: t.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.72,
  },
});
