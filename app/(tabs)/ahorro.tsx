import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SavingsCard } from '../../components/SavingsCard';
import { UserHeaderButton } from '../../components/UserHeaderButton';
import { CATEGORIES } from '../../constants/categories';
import { APP_COLORS, getIconColor } from '../../constants/colors';
import { PlanDetailModal } from '../../modals/PlanDetailModal';
import { PlanModal } from '../../modals/PlanModal';
import { SavingPlanDetailModal } from '../../modals/SavingPlanDetailModal';
import { SavingPlanModal } from '../../modals/SavingPlanModal';
import type { CurrencyCode, Plan, SavingPlan } from '../../types';
import { savingPlanProgress, savingPlanSavedAmount } from '../../utils/calculations';
import { fmt } from '../../utils/format';
import { computeMemberBalances, planTotalBudget, planTotalSpent, resolveDebts } from '../../utils/planCalculations';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import { dismissKeyboardAndBlur } from '../../utils/keyboard';
import { getPartnerId, getUserData } from '../../utils/users';
import { useTabPadding } from '../../hooks/useTabPadding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OwnerFilter = 'mine' | 'partner' | 'both';
type ScreenMode = 'ahorros' | 'planes';
type PlanFilter = 'todos' | 'activos' | 'saldados';

const FILTER_OPTIONS: { label: string; value: OwnerFilter }[] = [
  { label: 'Ambos', value: 'both' },
  { label: 'Yo', value: 'mine' },
  { label: 'Pareja', value: 'partner' },
];

const SAVINGS_ACCENT = '#7C3AED';

export default function SavingsPreviewScreen() {
  const tabPadding = useTabPadding();
  const insets = useSafeAreaInsets();
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const currency = useAppStore((s) => s.currency);
  const users = useAppStore((s) => s.users);
  const partnerForUser = useAppStore((s) => s.partnerForUser);
  const user = getUserData(users, currentUser);
  const { width } = useWindowDimensions();
  const plans = useAppStore((s) => s.payload.plans ?? []);

  const heroScrollRef = useRef<ScrollView>(null);
  const heroPageRef = useRef(0);
  const modeRef = useRef<ScreenMode>('ahorros');
  const contentAnim = useRef(new Animated.Value(1)).current;

  const [mode, setMode] = useState<ScreenMode>('ahorros');
  const [transitionDirection, setTransitionDirection] = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [editPlanId, setEditPlanId] = useState<number | null>(null);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [detailPlanId, setDetailPlanId] = useState<number | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('both');
  const [searchText, setSearchText] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('todos');

  const [filterDropdown, setFilterDropdown] = useState<{ rightEdge: number; y: number; width: number } | null>(null);
  const filterBtnRef = useRef<View>(null);
  const [planSearchText, setPlanSearchText] = useState('');
  const [planFilterDropdown, setPlanFilterDropdown] = useState<{ rightEdge: number; y: number; width: number } | null>(null);
  const planFilterBtnRef = useRef<View>(null);

  const partner = getPartnerId(partnerForUser, currentUser);
  const isSearching = searchText.trim().length > 0;

  const openFilterDropdown = () => {
    filterBtnRef.current?.measure((_, __, w, h, pageX, pageY) => {
      setFilterDropdown({ rightEdge: pageX + w, y: pageY + h + 6, width: 140 });
    });
  };

  const openPlanFilterDropdown = () => {
    planFilterBtnRef.current?.measure((_, __, w, h, pageX, pageY) => {
      setPlanFilterDropdown({ rightEdge: pageX + w, y: pageY + h + 6, width: 140 });
    });
  };

  const isPlanSearching = planSearchText.trim().length > 0;

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const filteredSavings = useMemo<SavingPlan[]>(() => {
    const query = searchText.trim().toLowerCase();
    const matchesSearch = (plan: SavingPlan) =>
      query === '' ||
      plan.title.toLowerCase().includes(query) ||
      (plan.link ?? '').toLowerCase().includes(query);

    return payload.savings
      .filter((plan) => {
        if (!matchesSearch(plan)) return false;
        if (plan.type === 'joint') return true;
        if (ownerFilter === 'mine') return plan.uid === currentUser;
        if (ownerFilter === 'partner') return plan.uid === partner;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [currentUser, ownerFilter, partner, payload.savings, searchText]);

  const savings = useMemo(() => {
    const target = payload.savings.reduce((sum, plan) => sum + plan.targetAmount, 0);
    const saved = payload.savings.reduce((sum, plan) => sum + savingPlanSavedAmount(plan), 0);
    return { target, saved };
  }, [payload.savings]);

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

  const selectedPlan = useMemo(
    () => payload.savings.find((plan) => String(plan.id) === String(selectedPlanId)) ?? null,
    [payload.savings, selectedPlanId],
  );
  const selectedPlanReadOnly =
    !!selectedPlan &&
    (selectedPlan.type ?? 'personal') === 'personal' &&
    selectedPlan.uid !== currentUser;

  const switchMode = (newMode: ScreenMode) => {
    if (newMode === modeRef.current) return;
    setTransitionDirection(newMode === 'planes' ? 1 : -1);
    modeRef.current = newMode;
    Animated.timing(contentAnim, {
      toValue: 0,
      duration: 110,
      useNativeDriver: true,
    }).start(() => {
      setMode(newMode);
      Animated.spring(contentAnim, {
        toValue: 1,
        damping: 22,
        stiffness: 300,
        mass: 0.7,
        useNativeDriver: true,
      }).start();
    });
  };

  const syncModeFromHeroOffset = (offsetX: number) => {
    const pageWidth = Math.max(width, 1);
    const page = Math.max(0, Math.min(1, Math.round(offsetX / pageWidth)));
    if (page === heroPageRef.current) return;
    heroPageRef.current = page;
    switchMode(page === 0 ? 'ahorros' : 'planes');
  };

  const handleHeroScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncModeFromHeroOffset(event.nativeEvent.contentOffset.x);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  const openLink = async (plan: SavingPlan) => {
    if (!plan.link) return;
    const ok = await Linking.canOpenURL(plan.link);
    if (ok) await Linking.openURL(plan.link);
    else Alert.alert('No se pudo abrir', plan.link);
  };

  const AhorrosHeader = (
    <View style={styles.searchRow}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={APP_COLORS.textMuted} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Buscar ahorro"
          placeholderTextColor={APP_COLORS.textMuted}
          style={styles.searchInput}
        />
        {isSearching && (
          <Pressable onPress={() => setSearchText('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={APP_COLORS.textMuted} />
          </Pressable>
        )}
      </View>
      <View ref={filterBtnRef}>
        <Pressable
          onPress={openFilterDropdown}
          style={({ pressed }) => [
            styles.filterIconBtn,
            ownerFilter !== 'both' && styles.filterIconBtnActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={ownerFilter !== 'both' ? '#7C3AED' : APP_COLORS.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  );

  const PLAN_FILTER_LABELS: Record<PlanFilter, string> = {
    todos: 'Todos',
    activos: 'Activos',
    saldados: 'Saldados',
  };

  const PlanesHeader = (
    <View style={styles.searchRow}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={APP_COLORS.textMuted} />
        <TextInput
          value={planSearchText}
          onChangeText={setPlanSearchText}
          placeholder="Buscar plan"
          placeholderTextColor={APP_COLORS.textMuted}
          style={styles.searchInput}
        />
        {isPlanSearching && (
          <Pressable onPress={() => setPlanSearchText('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={APP_COLORS.textMuted} />
          </Pressable>
        )}
      </View>
      <View ref={planFilterBtnRef}>
        <Pressable
          onPress={openPlanFilterDropdown}
          style={({ pressed }) => [
            styles.filterIconBtn,
            planFilter !== 'todos' && styles.filterIconBtnActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={planFilter !== 'todos' ? '#7C3AED' : APP_COLORS.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  );

  const PlanesFooter = (
    <Pressable
      onPress={() => setNewPlanOpen(true)}
      style={({ pressed }) => [styles.newPlanBtn, pressed && styles.pressed]}
    >
      <Ionicons name="add-circle-outline" size={18} color={SAVINGS_ACCENT} />
      <Text style={styles.newPlanBtnText}>Nuevo plan</Text>
    </Pressable>
  );

  const contentAnimStyle = {
    opacity: contentAnim,
    transform: [{
      translateX: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [18 * transitionDirection, 0] }),
    }],
  };

  const listData = useMemo<Array<SavingPlan | Plan>>(
    () => (mode === 'ahorros' ? filteredSavings : filteredPlans),
    [filteredSavings, filteredPlans, mode],
  );

  return (
    <View style={styles.screen}>

      {/* ── Hero fijo ── */}
      <View style={styles.heroShadowWrap}>
        <View style={styles.heroInner}>
          <ScrollView
            ref={heroScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            decelerationRate="fast"
            onScroll={handleHeroScroll}
            onScrollEndDrag={handleHeroScroll}
            onMomentumScrollEnd={handleHeroScroll}
            style={{ width }}
          >
            {/* Page 0: Ahorros */}
            <View style={[styles.heroPage, { width, paddingTop: insets.top + 14 }]}>
              <View style={styles.heroTop}>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroGreeting}>¡Hola {user.name}!</Text>
                  <Text style={styles.heroSubtitle}>
                    {'Estos son tus '}
                    <Text style={styles.heroHighlight}>planes de ahorro</Text>
                    {' y tus '}
                    <Text style={styles.heroHighlight}>ahorros hasta hoy</Text>
                  </Text>
                </View>
                <UserHeaderButton />
              </View>
              <SavingsCard
                saved={savings.saved}
                target={savings.target}
                currency={currency}
                showObjectiveSlide={false}
                showPillToggle={false}
              />
            </View>

            {/* Page 1: Planes */}
            <View style={[styles.heroPage, { width, paddingTop: insets.top + 14 }]}>
              <View style={styles.heroTop}>
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
                <UserHeaderButton />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* ── Área de contenido animada ── */}
      <Animated.View style={[styles.contentWrap, contentAnimStyle]}>
        <FlatList<SavingPlan | Plan>
          key={mode}
          data={listData}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={dismissKeyboardAndBlur}
          keyExtractor={(item) => `${mode}-${item.id}`}
          contentContainerStyle={[styles.content, { paddingBottom: tabPadding }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          bounces={false}
          overScrollMode="never"
          ListHeaderComponent={mode === 'ahorros' ? AhorrosHeader : PlanesHeader}
          ListFooterComponent={mode === 'planes' ? PlanesFooter : null}
          ListEmptyComponent={
            mode === 'ahorros' ? (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={36} color={APP_COLORS.textMuted} />
                <Text style={styles.emptyTitle}>Sin ahorros</Text>
                <Text style={styles.emptySubtitle}>
                  {isSearching
                    ? 'No se encontraron ahorros con esa búsqueda.'
                    : 'Aún no hay planes de ahorro para este filtro.'}
                </Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="map-outline" size={36} color={APP_COLORS.textMuted} />
                <Text style={styles.emptyTitle}>Sin planes aún</Text>
                <Text style={styles.emptySubtitle}>
                  Crea tu primer plan para organizar un viaje o evento con amigos.
                </Text>
              </View>
            )
          }
          renderItem={({ item, index }) => {
            if (mode === 'planes') {
              const plan = item as Plan;
              return (
                <PlanTileRow
                  plan={plan}
                  currency={currency}
                  onPress={() => setDetailPlanId(plan.id)}
                />
              );
            }
            const savingPlan = item as SavingPlan;
            return (
              <SavingTileRow
                plan={savingPlan}
                currency={currency}
                isFirst={index === 0}
                isLast={index === filteredSavings.length - 1}
                readOnly={(savingPlan.type ?? 'personal') === 'personal' && savingPlan.uid !== currentUser}
                onPress={() => setSelectedPlanId(savingPlan.id)}
                onOpenLink={() => void openLink(savingPlan)}
              />
            );
          }}
        />
      </Animated.View>

      {filterDropdown && (
        <OwnerFilterDropdown
          pos={filterDropdown}
          value={ownerFilter}
          options={FILTER_OPTIONS}
          onChange={(v) => setOwnerFilter(v as OwnerFilter)}
          onClose={() => setFilterDropdown(null)}
        />
      )}

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

      {/* ── Modals ahorros ── */}
      <SavingPlanDetailModal
        plan={selectedPlan}
        readOnly={selectedPlanReadOnly}
        onClose={() => setSelectedPlanId(null)}
        onEdit={() => {
          setEditPlanId(selectedPlanId);
          setSelectedPlanId(null);
        }}
        onDelete={() => setSelectedPlanId(null)}
      />
      <SavingPlanModal
        visible={editPlanId !== null}
        plan={payload.savings.find((p) => String(p.id) === String(editPlanId)) ?? null}
        onClose={() => setEditPlanId(null)}
      />

      {/* ── Modals planes ── */}
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

// ─── OwnerFilterDropdown ──────────────────────────────────────────────────────

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

// ─── PlanTileRow ──────────────────────────────────────────────────────────────

function PlanTileRow({
  plan,
  currency,
  onPress,
}: {
  plan: Plan;
  currency: CurrencyCode;
  onPress: () => void;
}) {
  const iconInfo = CATEGORIES[plan.icon] ?? CATEGORIES.map;
  const iconColor = getIconColor('purple');
  const totalSpent = planTotalSpent(plan);
  const totalBudget = planTotalBudget(plan);
  const pct = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;
  const settled = plan.expenses.length > 0 && resolveDebts(computeMemberBalances(plan)).length === 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}
    >
      <View style={[styles.tileIcon, { backgroundColor: iconColor.bg }]}>
        <Ionicons name={iconInfo.icon} size={22} color={iconColor.color} />
      </View>
      <View style={styles.tileBody}>
        <View style={styles.planCardTitleRow}>
          <Text numberOfLines={1} style={styles.planCardTitle}>{plan.title}</Text>
          <View style={[styles.planStatusBadge, settled ? styles.planStatusSettled : styles.planStatusActive]}>
            <Text style={[styles.planStatusText, settled ? styles.planStatusSettledText : styles.planStatusActiveText]}>
              {settled ? 'Saldado' : 'Activo'}
            </Text>
          </View>
        </View>
        <View style={styles.planCardMetaRow}>
          <Text style={styles.planCardSpent}>{fmt(totalSpent, currency)}</Text>
          <Text style={styles.planCardSep}>·</Text>
          <Text style={styles.planCardExpenseCount}>
            {plan.expenses.length} {plan.expenses.length === 1 ? 'gasto' : 'gastos'}
          </Text>
          <View style={{ flex: 1 }} />
          <View style={styles.planMemberAvatars}>
            {plan.members.slice(0, 4).map((m) => (
              <View key={m.id} style={[styles.planMiniAvatar, { backgroundColor: m.bg }]}>
                <Text style={[styles.planMiniInitials, { color: m.color }]}>{m.initials}</Text>
              </View>
            ))}
          </View>
        </View>
        {totalBudget > 0 && (
          <View style={styles.tileProgressRow}>
            <View style={styles.tileBarTrack}>
              <View style={[styles.tileBarFill, { width: `${pct}%` as `${number}%` }]} />
            </View>
            <Text style={styles.tileRemainingSmall}>{pct}%</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── SavingTileRow ─────────────────────────────────────────────────────────────

function SavingTileRow({
  plan,
  currency,
  isFirst,
  isLast,
  readOnly,
  onPress,
  onOpenLink,
}: {
  plan: SavingPlan;
  currency: CurrencyCode;
  isFirst: boolean;
  isLast: boolean;
  readOnly: boolean;
  onPress: () => void;
  onOpenLink: () => void;
}) {
  const iconColor = getIconColor('purple');
  const iconInfo = CATEGORIES[plan.icon ?? 'savings'] ?? CATEGORIES.savings;
  const progress = savingPlanProgress(plan);
  const progressPct = Math.min(100, Math.round(progress.pct));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tileRow,
        isFirst && styles.tileFirst,
        isLast && styles.tileLast,
        !isLast && styles.tileBorder,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: iconColor.bg }]}>
        <Ionicons name={iconInfo.icon} size={22} color={iconColor.color} />
      </View>
      <View style={styles.tileBody}>
        <View style={styles.tileTitleRow}>
          {plan.type === 'joint' && (
            <View style={styles.jointBadge}>
              <Ionicons name="people" size={10} color={SAVINGS_ACCENT} />
            </View>
          )}
          <Text numberOfLines={2} style={styles.tileTitle}>{plan.title}</Text>
          {plan.link && (
            <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation(); onOpenLink(); }}>
              <Ionicons name="link-outline" size={15} color={SAVINGS_ACCENT} />
            </Pressable>
          )}
        </View>
        <View style={styles.tileProgressRow}>
          <Text style={styles.tileSavedSmall}>{fmt(progress.total, currency)}</Text>
          <View style={styles.tileBarTrack}>
            <View style={[styles.tileBarFill, { width: `${progressPct}%` as `${number}%` }]} />
          </View>
          <Text style={styles.tileRemainingSmall}>{fmt(progress.remaining, currency)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#EDF2F6',
    flex: 1,
  },
  contentWrap: {
    flex: 1,
  },
  content: {},

  // ── Hero ──
  heroShadowWrap: {
    elevation: 5,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  heroInner: {
    backgroundColor: APP_COLORS.surface,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroPage: {
    paddingBottom: 6,
    paddingTop: 18,
  },
  heroGreeting: {
    color: '#303236',
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    lineHeight: 28,
  },
  heroHighlight: {
    color: '#7C3AED',
    fontWeight: '400',
  },
  heroSubtitle: {
    color: '#303236',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
  },
  heroTextWrap: {
    flex: 1,
    gap: 0,
    minWidth: 0,
  },
  heroTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingBottom: 12,
  },

  // ── Planes hero card ──
  planesHeroCard: {
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    gap: 4,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  planesInvestedLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  planesInvestedAmount: {
    color: SAVINGS_ACCENT,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 40,
  },
  planesInvestedSub: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  // ── Search ──
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    marginTop: 22,
    paddingHorizontal: 24,
  },
  searchWrap: {
    alignItems: 'center',
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
  },
  searchInput: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  filterIconBtn: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 22,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  filterIconBtnActive: {
    borderColor: '#7C3AED',
  },

  // ── Filter dropdown ──
  filterDropCard: {
    borderRadius: 14,
    elevation: 5,
    position: 'absolute',
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  filterDropInner: {
    backgroundColor: APP_COLORS.surface,
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
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  filterDropOptionActive: {
    backgroundColor: '#F5F3FF',
  },
  filterDropOptionText: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  filterDropOptionTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  // ── "Nuevo plan" footer button ──
  newPlanBtn: {
    alignItems: 'center',
    borderColor: SAVINGS_ACCENT,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
    marginTop: 10,
    marginHorizontal: 0,
  },
  newPlanBtnText: {
    color: SAVINGS_ACCENT,
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Tile rows ──
  tileRow: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tileFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tileLast: {},
  tileBorder: {
    borderBottomColor: '#EEF2F7',
    borderBottomWidth: 1,
  },
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
  tileTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  jointBadge: {
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 6,
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  tileTitle: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  tileProgressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  tileBarTrack: {
    backgroundColor: '#EEF0F3',
    borderRadius: 3,
    flex: 1,
    height: 5,
    overflow: 'hidden',
  },
  tileBarFill: {
    backgroundColor: SAVINGS_ACCENT,
    borderRadius: 3,
    height: '100%',
  },
  tileSavedSmall: {
    color: APP_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    minWidth: 42,
  },
  tileRemainingSmall: {
    color: SAVINGS_ACCENT,
    fontSize: 10,
    fontWeight: '700',
    minWidth: 42,
    textAlign: 'right',
  },

  // ── Plan tile extras ──
  planMemberAvatars: {
    flexDirection: 'row',
  },
  planMiniAvatar: {
    alignItems: 'center',
    borderColor: APP_COLORS.surface,
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    marginLeft: -5,
    width: 20,
  },
  planMiniInitials: {
    fontSize: 8,
    fontWeight: '800',
  },

  // ── Plan filter pills ──
  planesFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  planFilterPill: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  planFilterPillActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  planFilterPillText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  planFilterPillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  // ── Plan card ──
  planCard: {
    alignItems: 'flex-start',
    backgroundColor: APP_COLORS.surface,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    marginHorizontal: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  planCardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  planCardTitle: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  planStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  planStatusActive: {
    backgroundColor: '#EDE9FE',
  },
  planStatusSettled: {
    backgroundColor: '#DCFCE7',
  },
  planStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  planStatusActiveText: {
    color: '#7C3AED',
  },
  planStatusSettledText: {
    color: '#16A34A',
  },
  planCardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginBottom: 8,
  },
  planCardSpent: {
    color: APP_COLORS.textPrimary,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 16,
  },
  planCardSep: {
    color: APP_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '400',
  },
  planCardExpenseCount: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Empty ──
  emptyState: {
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
