import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetCategoryCard } from '../../components/BudgetCategoryCard';
import { CategoryRingChart } from '../../components/CategoryRingChart';
import type { RingSlice } from '../../components/CategoryRingChart';
import { UserHeaderButton } from '../../components/UserHeaderButton';
import { type AppTheme, getIconColor } from '../../constants/colors';
import { BudgetCategoryDetailModal } from '../../modals/BudgetCategoryDetailModal';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import type { BudgetCategory } from '../../types';
import { calcBudgetCategorySpending } from '../../utils/calculations';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useTabPadding } from '../../hooks/useTabPadding';
import { reportFabScroll } from '../../utils/fabScroll';
import { useTheme } from '../../contexts/ThemeContext';

// Purple palette — same as movimientos hero
type Palette = { base: string; soft: string; bright: string; glow: string; deep: string; shade: string; veil: string };
const PURPLE_BASE: Palette = {
  base: '#5B21B6', soft: '#8B5CF6', bright: '#A78BFA', glow: '#C4B5FD', deep: '#3B0764', shade: '#4C1D95', veil: '#7C3AED',
};
const PURPLE_SHIFT: Palette = {
  base: '#4C1D95', soft: '#7C3AED', bright: '#9061F9', glow: '#B89AF8', deep: '#2E0070', shade: '#3D1882', veil: '#6D28D9',
};

export default function CategoriasScreen() {
  const tabPadding = useTabPadding();
  const insets = useSafeAreaInsets();
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const currency = useAppStore((s) => s.currency);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);

  const { heroAnim, contentAnim, headerAnim, itemAnims } = useEntranceAnimation();

  const user = users[currentUser] ?? { name: currentUser };

  const budgetCategories = useMemo(() => {
    const all = payload.budgetCategories ?? [];
    return all.filter((bc) => bc.uid === undefined || bc.uid === currentUser);
  }, [payload.budgetCategories, currentUser]);

  const sortedBudgetCategories = useMemo(() => {
    return [...budgetCategories].sort((a, b) => {
      const spentA = calcBudgetCategorySpending(payload, a.id, currentUser, selectedYM);
      const spentB = calcBudgetCategorySpending(payload, b.id, currentUser, selectedYM);
      return spentB - spentA || a.name.localeCompare(b.name);
    });
  }, [budgetCategories, currentUser, payload, selectedYM]);

  const ringSlices = useMemo((): RingSlice[] => {
    return sortedBudgetCategories.map((cat) => ({
      id: cat.id,
      label: cat.name,
      color: getIconColor(cat.iconColor).color,
      value: calcBudgetCategorySpending(payload, cat.id, currentUser, selectedYM),
    }));
  }, [sortedBudgetCategories, currentUser, payload, selectedYM]);

  const totalSpent = useMemo(
    () => ringSlices.reduce((sum, s) => sum + s.value, 0),
    [ringSlices],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        onScroll={(event) => reportFabScroll(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        {/* ── Hero card ─────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.heroCard,
            {
              opacity: heroAnim,
              transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <CatHeroGradient />
          <View style={[styles.heroTop, { paddingTop: insets.top + 14 }]}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroGreeting}>¡Hola {user.name}!</Text>
              <Text style={styles.heroSubtitle}>
                Consulta tus gastos y el presupuesto restante por categoría
              </Text>
            </View>
            <UserHeaderButton variant="light" tintColor="#C4B5FD" />
          </View>
        </Animated.View>

        {/* ── Action button ─────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.actionRow,
            {
              opacity: contentAnim,
              transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
            },
          ]}
        >
          <Pressable
            onPress={() => setCreateOpen(true)}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          >
            <Ionicons name="pie-chart-outline" size={18} color="#7C3AED" />
            <Text style={styles.actionBtnText}>Crear categoría</Text>
          </Pressable>
        </Animated.View>

        {/* ── Donut ring chart ──────────────────────────────────── */}
        {budgetCategories.length > 0 && (
          <Animated.View
            style={{
              marginTop: 28,
              opacity: contentAnim,
              transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
            }}
          >
            <CategoryRingChart
              slices={ringSlices}
              currency={currency}
              selectedYM={selectedYM}
            />

            {/* ── Legend pills ─────────────────────────────────── */}
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

        {/* ── Section header ────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.sectionHeader,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Todas las categorías</Text>
        </Animated.View>

        {/* ── Category list ─────────────────────────────────────── */}
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
              const spent = calcBudgetCategorySpending(payload, category.id, currentUser, selectedYM);
              const percentOfTotal = totalSpent > 0 ? spent / totalSpent : 0;
              return (
                <Animated.View
                  key={category.id}
                  style={{
                    opacity: itemAnims[index],
                    transform: [{ translateY: itemAnims[index].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                  }}
                >
                  <BudgetCategoryCard
                    category={category}
                    spent={spent}
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

// ── Hero gradient ──────────────────────────────────────────────────────────

function CatHeroGradient() {
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
    <View pointerEvents="none" style={styles_hero.gradientCanvas}>
      <HeroBlobSvg palette={PURPLE_BASE} idPrefix="cat-base" />
      <Animated.View style={[StyleSheet.absoluteFill, shiftStyle]}>
        <HeroBlobSvg palette={PURPLE_SHIFT} idPrefix="cat-shift" />
      </Animated.View>
    </View>
  );
}

function HeroBlobSvg({ palette, idPrefix }: { palette: Palette; idPrefix: string }) {
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

// Static styles used only by CatHeroGradient (no theme tokens needed)
const styles_hero = StyleSheet.create({
  gradientCanvas: {
    bottom: -36,
    left: -28,
    position: 'absolute',
    right: -28,
    top: -18,
  },
});

// ── Styles ────────────────────────────────────────────────────────────────

const makeStyles = (t: AppTheme) => StyleSheet.create({
  screen: {
    backgroundColor: t.background,
    flex: 1,
  },
  content: {},

  // Hero card
  heroCard: {
    backgroundColor: '#5B21B6',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 5,
    overflow: 'hidden',
    paddingBottom: 28,
    paddingHorizontal: 30,
    shadowColor: '#3B0764',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
  },
  heroTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroGreeting: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    lineHeight: 32,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: 2,
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
    fontSize: 13,
    fontWeight: '600',
  },

  // Action button
  actionRow: {
    marginTop: 20,
    marginBottom: 4,
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  actionBtnText: {
    color: t.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: '600',
  },

  // Category list
  list: {
    gap: 8,
    paddingHorizontal: 20,
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
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: t.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.72,
  },
});
