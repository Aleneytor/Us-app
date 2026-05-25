import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SearchBar } from '../../components/SearchBar';
import { UserHeaderButton } from '../../components/UserHeaderButton';
import { CATEGORIES } from '../../constants/categories';
import { type AppTheme, getIconColor } from '../../constants/colors';
import { SURFACE_SHADOW } from '../../constants/shadows';
import { PlanDetailModal } from '../../modals/PlanDetailModal';
import { PlanModal } from '../../modals/PlanModal';
import type { CurrencyCode, Plan } from '../../types';
import { fmt, splitAmount } from '../../utils/format';
import { computeMemberBalances, planTotalBudget, planTotalSpent, resolveDebts } from '../../utils/planCalculations';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import { dismissKeyboardAndBlur } from '../../utils/keyboard';
import { getUserData } from '../../utils/users';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useTabPadding } from '../../hooks/useTabPadding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reportFabScroll } from '../../utils/fabScroll';
import { useTheme } from '../../contexts/ThemeContext';

type AhorroPalette = { base: string; soft: string; bright: string; glow: string; deep: string; shade: string; veil: string };

const AH_BLUE_BASE: AhorroPalette = { base: '#1D4ED8', soft: '#3B82F6', bright: '#60A5FA', glow: '#BAE6FD', deep: '#1E3A8A', shade: '#1E40AF', veil: '#2563EB' };
const AH_BLUE_SHIFT: AhorroPalette = { base: '#1E40AF', soft: '#2563EB', bright: '#4F86F8', glow: '#93C5FD', deep: '#172554', shade: '#1E3A8A', veil: '#1D4ED8' };

type PlanFilter = 'todos' | 'activos' | 'saldados';

export default function PlanesScreen() {
  const router = useRouter();
  const tabPadding = useTabPadding();
  const insets = useSafeAreaInsets();
  const currency = useAppStore((s) => s.currency);
  const users = useAppStore((s) => s.users);
  const currentUser = useAppStore((s) => s.currentUser);
  const plans = useAppStore((s) => s.payload.plans ?? []);
  const user = getUserData(users, currentUser);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [detailPlanId, setDetailPlanId] = useState<number | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [planFilter, setPlanFilter] = useState<PlanFilter>('todos');
  const [planSearchText, setPlanSearchText] = useState('');
  const [planFilterDropdown, setPlanFilterDropdown] = useState<{ rightEdge: number; y: number; width: number } | null>(null);
  const planFilterBtnRef = useRef<View>(null);

  const { heroAnim, contentAnim: contentEntranceAnim, headerAnim, itemAnims } = useEntranceAnimation();
  const openPlanFilterDropdown = () => {
    planFilterBtnRef.current?.measure((_, __, w, h, pageX, pageY) => {
      setPlanFilterDropdown({ rightEdge: pageX + w, y: pageY + h + 6, width: 140 });
    });
  };

  const totalInvested = useMemo(
    () => plans.reduce((s, p) => s + p.expenses.reduce((ps, e) => ps + e.amount, 0), 0),
    [plans],
  );

  const filteredPlans = useMemo<Plan[]>(() => {
    const query = planSearchText.trim().toLowerCase();
    let result = plans;
    if (query) result = result.filter((p) => p.title.toLowerCase().includes(query));
    if (planFilter === 'todos') return result;
    return result.filter((p) => {
      const settled = p.expenses.length > 0 && resolveDebts(computeMemberBalances(p)).length === 0;
      return planFilter === 'saldados' ? settled : !settled;
    });
  }, [plans, planFilter, planSearchText]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  const contentAnimStyle = {
    opacity: contentEntranceAnim,
    transform: [
      { translateY: contentEntranceAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
    ],
  };

  const FILTER_LABELS: Record<PlanFilter, string> = { todos: 'Todos', activos: 'Activos', saldados: 'Saldados' };
  const isFiltered = planFilter !== 'todos';

  const PlanesHeader = (
    <Animated.View style={{
      opacity: headerAnim,
      transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
    }}>
      <View style={styles.actionRow}>
        <Pressable
          onPress={() => setNewPlanOpen(true)}
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
        >
          <Ionicons name="map-outline" size={18} color="#3B82F6" />
          <Text style={styles.actionBtnText}>Crear plan</Text>
        </Pressable>
      </View>

      <SearchBar
        value={planSearchText}
        onChangeText={setPlanSearchText}
        placeholder="Buscar plan"
        style={styles.searchBar}
      />

      <View style={styles.filterSectionHead}>
        <Text style={styles.filterSectionTitle}>Planes</Text>
        <Text style={styles.filterSectionSubtitle}>Toca los filtros para explorar</Text>
      </View>

      <View style={styles.filtersBar}>
        <View ref={planFilterBtnRef} style={styles.filterChipWrapper}>
          <Pressable
            onPress={openPlanFilterDropdown}
            style={({ pressed }) => [styles.filterChip, isFiltered && styles.filterChipActive, pressed && styles.pressed]}
          >
            <Ionicons name="options-outline" size={14} color={isFiltered ? '#7C3AED' : theme.textSecondary} />
            <Text style={[styles.filterChipText, isFiltered && styles.filterChipTextActive]}>
              {FILTER_LABELS[planFilter]}
            </Text>
            <Ionicons name="chevron-down" size={12} color={isFiltered ? '#7C3AED' : theme.textMuted} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.screen}>
      {/* -- Hero fijo -- */}
      <Animated.View
        style={[
          styles.heroShadowWrap,
          {
            opacity: heroAnim,
            transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          },
        ]}
      >
        <View style={styles.heroInner}>
          <PlanesHeroGradient />
          <View style={[styles.heroPage, { paddingTop: insets.top + 14 }]}>
            <View style={styles.heroTop}>
              <Pressable
                onPress={() => router.navigate('/(tabs)/extras')}
                style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
              >
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </Pressable>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroGreeting}>¡Hola {user.name}!</Text>
                <Text style={styles.heroSubtitle}>
                  {'Estos son tus '}
                  <Text style={styles.heroHighlight}>planes</Text>
                  {' y cuanto has '}
                  <Text style={styles.heroHighlight}>invertido</Text>
                  {' en ellos'}
                </Text>
              </View>
              <UserHeaderButton variant="light" tintColor="#93C5FD" />
            </View>
            <View style={styles.heroAmountWrap}>
              {(() => {
                const parts = splitAmount(totalInvested, currency);
                return (
                  <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>
                    {parts.sign}{parts.whole}<Text style={styles.heroAmountDecimals}>,{parts.decimals} {parts.symbol}</Text>
                  </Text>
                );
              })()}
            </View>
          </View>
        </View>
      </Animated.View>

      {/* -- Lista de planes -- */}
      <Animated.View style={[styles.contentWrap, contentAnimStyle]}>
        <FlatList<Plan>
          data={filteredPlans}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={dismissKeyboardAndBlur}
          onScroll={(event) => reportFabScroll(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          keyExtractor={(item) => `plan-${item.id}`}
          contentContainerStyle={[styles.content, { paddingBottom: tabPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          bounces={false}
          overScrollMode="never"
          ListHeaderComponent={PlanesHeader}
          ListEmptyComponent={
            <Animated.View style={[styles.emptyState, { opacity: headerAnim }]}>
              <Ionicons name="map-outline" size={36} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>Sin planes aún</Text>
              <Text style={styles.emptySubtitle}>
                Crea tu primer plan para organizar un viaje o evento con amigos.
              </Text>
            </Animated.View>
          }
          renderItem={({ item: plan, index }) => {
            const itemAnim = itemAnims[index] ?? headerAnim;
            return (
              <Animated.View
                style={[
                  styles.planListRow,
                  index === filteredPlans.length - 1 && styles.planListRowLast,
                  {
                    opacity: itemAnim,
                    transform: [{ translateY: itemAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                  },
                ]}
              >
                <PlanTileRow
                  plan={plan}
                  currency={currency}
                  onPress={() => setDetailPlanId(plan.id)}
                />
              </Animated.View>
            );
          }}
        />
      </Animated.View>

      {planFilterDropdown && (
        <OwnerFilterDropdown
          pos={planFilterDropdown}
          value={planFilter}
          options={[
            { label: 'Todos', value: 'todos' },
            { label: 'Activos', value: 'activos' },
            { label: 'Saldados', value: 'saldados' },
          ]}
          onChange={(v) => setPlanFilter(v as PlanFilter)}
          onClose={() => setPlanFilterDropdown(null)}
        />
      )}

      <PlanModal
        visible={newPlanOpen}
        onClose={() => setNewPlanOpen(false)}
      />
      <PlanModal
        visible={!!editingPlan}
        plan={editingPlan}
        onClose={() => setEditingPlan(null)}
      />
      <PlanDetailModal
        plan={plans.find((p) => p.id === detailPlanId) ?? null}
        onClose={() => setDetailPlanId(null)}
        onEdit={() => {
          const p = plans.find((x) => x.id === detailPlanId) ?? null;
          setDetailPlanId(null);
          setTimeout(() => setEditingPlan(p), 120);
        }}
      />
    </View>
  );
}

// --- OwnerFilterDropdown ------------------------------------------------------

function OwnerFilterDropdown({
  pos,
  value,
  options,
  onChange,
  onClose,
}: {
  pos: { rightEdge: number; y: number; width: number };
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 320,
      mass: 0.7,
    }).start();
  }, [anim]);

  const animateClose = (then?: () => void) => {
    Animated.timing(anim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      then?.();
      onClose();
    });
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => animateClose()}>
      <Animated.View
        style={[
          styles.filterDropCard,
          {
            right: screenWidth - pos.rightEdge,
            top: pos.y,
            width: pos.width,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          },
        ]}
      >
        <View style={styles.filterDropInner}>
          {options.map((opt, i) => {
            const active = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => animateClose(() => onChange(opt.value))}
                style={({ pressed }) => [
                  styles.filterDropOption,
                  i > 0 && styles.filterDropOptionBorder,
                  active && styles.filterDropOptionActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.filterDropOptionText, active && styles.filterDropOptionTextActive]}>
                  {opt.label}
                </Text>
                {active && <Ionicons name="checkmark" size={15} color="#7C3AED" />}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </Pressable>
  );
}

// --- PlanTileRow --------------------------------------------------------------

function PlanTileRow({
  plan,
  currency,
  onPress,
}: {
  plan: Plan;
  currency: CurrencyCode;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const iconInfo = CATEGORIES[plan.icon] ?? CATEGORIES.map;
  const iconColor = getIconColor(plan.iconColor ?? 'purple');
  const totalSpent = planTotalSpent(plan);
  const totalBudget = planTotalBudget(plan);
  const hasBudget = totalBudget > 0;
  const pct = hasBudget ? Math.min(1, totalSpent / totalBudget) : 0;
  const remaining = totalBudget - totalSpent;
  const isOver = hasBudget && remaining < 0;
  const barColor = isOver ? theme.expense : pct >= 0.75 ? '#EA580C' : iconColor.color;
  const settled = plan.expenses.length > 0 && resolveDebts(computeMemberBalances(plan)).length === 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}
    >
      <View style={[styles.tileIcon, styles.planCardIcon, { backgroundColor: iconColor.color }]}>
        <Ionicons name={iconInfo.icon} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.tileBody}>
        <View style={styles.planCardTitleRow}>
          <Text numberOfLines={1} style={styles.planCardTitle}>{plan.title}</Text>
          <Text style={styles.planCardBudgetText} numberOfLines={1}>
            {hasBudget ? fmt(totalBudget, currency) : 'Sin presupuesto'}
          </Text>
          {settled && (
            <View style={styles.planStatusBadge}>
              <Text style={styles.planStatusText}>Saldado</Text>
            </View>
          )}
        </View>
        {hasBudget ? (
          <>
            <View style={styles.planCardBarTrack}>
              <View
                style={[
                  styles.tileBarFill,
                  { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: barColor },
                ]}
              />
            </View>
            <View style={styles.planCardAmountRow}>
              <Text style={[styles.planCardSpent, { color: iconColor.color }]} numberOfLines={1}>
                {fmt(totalSpent, currency)}
              </Text>
              <Text style={styles.planCardAvailable} numberOfLines={1}>
                {isOver ? `Excedido +${fmt(Math.abs(remaining), currency)}` : fmt(remaining, currency)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.planCardPrompt} numberOfLines={1}>
            {plan.expenses.length} {plan.expenses.length === 1 ? 'gasto' : 'gastos'} sin presupuesto.
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// --- PlanesHeroGradient -------------------------------------------------------

function PlanesHeroGradient() {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 6200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 6200, useNativeDriver: true }),
    ]));
    const driftLoop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 9800, useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 9800, useNativeDriver: true }),
    ]));
    pulseLoop.start();
    driftLoop.start();
    return () => { pulseLoop.stop(); driftLoop.stop(); };
  }, [drift, pulse]);

  const shiftStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.38] }),
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-8, 10] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [8, -6] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
    ],
  };

  return (
    <View pointerEvents="none" style={HERO_CANVAS.heroGradientCanvas}>
      <PlanBlobSvg palette={AH_BLUE_BASE} idPrefix="pl-bb" />
      <Animated.View style={[StyleSheet.absoluteFill, shiftStyle]}>
        <PlanBlobSvg palette={AH_BLUE_SHIFT} idPrefix="pl-bs" />
      </Animated.View>
    </View>
  );
}

function PlanBlobSvg({ palette, idPrefix }: { palette: AhorroPalette; idPrefix: string }) {
  const brightId = `${idPrefix}-bright`;
  const deepId = `${idPrefix}-deep`;
  const glowId = `${idPrefix}-glow`;
  const softId = `${idPrefix}-soft`;
  const shadeId = `${idPrefix}-shade`;
  const veilId = `${idPrefix}-veil`;

  return (
    <Svg width="100%" height="100%" viewBox="0 0 430 360" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={brightId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={palette.bright} stopOpacity="1" />
          <Stop offset="70%" stopColor={palette.bright} stopOpacity="0.72" />
          <Stop offset="100%" stopColor={palette.bright} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={deepId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={palette.deep} stopOpacity="1" />
          <Stop offset="74%" stopColor={palette.deep} stopOpacity="0.84" />
          <Stop offset="100%" stopColor={palette.deep} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={palette.glow} stopOpacity="1" />
          <Stop offset="66%" stopColor={palette.glow} stopOpacity="0.66" />
          <Stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={softId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={palette.soft} stopOpacity="1" />
          <Stop offset="72%" stopColor={palette.soft} stopOpacity="0.76" />
          <Stop offset="100%" stopColor={palette.soft} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={shadeId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={palette.shade} stopOpacity="0.86" />
          <Stop offset="72%" stopColor={palette.shade} stopOpacity="0.44" />
          <Stop offset="100%" stopColor={palette.shade} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={veilId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={palette.veil} stopOpacity="0.7" />
          <Stop offset="100%" stopColor={palette.veil} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="430" height="360" fill={palette.base} />
      <Ellipse cx="28" cy="42" rx="214" ry="176" fill={`url(#${deepId})`} opacity="0.74" />
      <Ellipse cx="132" cy="104" rx="218" ry="150" fill={`url(#${shadeId})`} opacity="0.38" />
      <Ellipse cx="188" cy="86" rx="202" ry="162" fill={`url(#${softId})`} opacity="0.44" />
      <Ellipse cx="365" cy="52" rx="190" ry="150" fill={`url(#${brightId})`} opacity="0.6" />
      <Ellipse cx="50" cy="286" rx="230" ry="148" fill={`url(#${glowId})`} opacity="0.88" />
      <Ellipse cx="248" cy="220" rx="240" ry="132" fill={`url(#${shadeId})`} opacity="0.3" />
      <Ellipse cx="238" cy="258" rx="248" ry="150" fill={`url(#${softId})`} opacity="0.52" />
      <Ellipse cx="426" cy="292" rx="226" ry="160" fill={`url(#${brightId})`} opacity="0.72" />
      <Ellipse cx="214" cy="178" rx="246" ry="150" fill={`url(#${veilId})`} opacity="0.52" />
      <Ellipse cx="232" cy="360" rx="310" ry="126" fill={`url(#${softId})`} opacity="0.36" />
    </Svg>
  );
}

// Static canvas used by PlanesHeroGradient
const HERO_CANVAS = StyleSheet.create({
  heroGradientCanvas: {
    bottom: -36,
    left: -28,
    position: 'absolute',
    right: -28,
    top: -18,
  },
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  screen: {
    backgroundColor: t.background,
    flex: 1,
  },
  contentWrap: {
    flex: 1,
  },
  content: {},
  planListRow: {
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  planListRowLast: {
    paddingBottom: 16,
  },

  // -- Hero --
  heroShadowWrap: {
    elevation: 5,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
  },
  heroInner: {
    backgroundColor: '#1D4ED8',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroPage: {
    paddingBottom: 6,
    paddingTop: 18,
  },
  heroGreeting: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    lineHeight: 32,
  },
  heroHighlight: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '400',
  },
  heroSubtitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
  },
  heroAmountWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  heroAmount: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 46,
    letterSpacing: -2.3,
    lineHeight: 52,
    textAlign: 'center',
  },
  heroAmountDecimals: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Poppins_500Medium',
    fontSize: 24,
    letterSpacing: -0.8,
  },
  heroTextWrap: {
    flex: 1,
    gap: 0,
    minWidth: 0,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 22,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  backBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    opacity: 0.8,
  },

  // -- Action button --
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 4,
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
  },
  actionBtnText: {
    color: t.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
  },

  // -- Search & filters --
  searchBar: {
    marginHorizontal: 16,
    marginTop: 18,
  },
  filterSectionHead: {
    gap: 2,
    marginTop: 18,
    paddingHorizontal: 20,
  },
  filterSectionTitle: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  filterSectionSubtitle: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  filtersBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  filterChipWrapper: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 20,
    borderWidth: 1,
    ...SURFACE_SHADOW,
  },
  filterChip: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  filterChipText: {
    color: t.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#7C3AED',
  },

  // -- Filter dropdown --
  filterDropCard: {
    borderRadius: 14,
    elevation: 5,
    position: 'absolute',
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  filterDropInner: {
    backgroundColor: t.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  filterDropOption: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  filterDropOptionBorder: {
    borderTopColor: t.border,
    borderTopWidth: 1,
  },
  filterDropOptionActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
  },
  filterDropOptionText: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  filterDropOptionTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  // -- Tile icon --
  tileIcon: {
    alignItems: 'center',
    borderRadius: 14,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  tileBody: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  tileBarFill: {
    borderRadius: 3,
    height: '100%',
  },

  // -- Plan card --
  planCard: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderRadius: 16,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  planCardIcon: {
    borderRadius: 16,
    height: 40,
    width: 40,
  },
  planCardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  planCardTitle: {
    color: t.textPrimary,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  planCardBudgetText: {
    color: t.textSecondary,
    flexShrink: 0,
    fontSize: 10,
    fontWeight: '500',
  },
  planCardBarTrack: {
    backgroundColor: t.border,
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    overflow: 'hidden',
    width: '100%',
  },
  planStatusBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.18)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  planStatusText: {
    color: '#16A34A',
    fontSize: 10,
    fontWeight: '700',
  },
  planCardAmountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 5,
  },
  planCardAvailable: {
    color: t.textMuted,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  planCardSpent: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
  },
  planCardPrompt: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 7,
  },

  // -- Empty --
  emptyState: {
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: t.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: t.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
