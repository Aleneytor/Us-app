import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
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
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { type AppTheme } from '../../constants/colors';
import { BalanceCard } from '../../components/BalanceCard';
import type { CardState } from '../../components/BalanceCard';
import { BudgetCategoryCard } from '../../components/BudgetCategoryCard';
import { FinanceDetailModal } from '../../components/FinanceDetailModal';
import { FinanceTrendCard } from '../../components/FinanceTrendCard';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import { ActivityTile } from '../../components/ActivityTile';
import { UserHeaderButton } from '../../components/UserHeaderButton';
import { BudgetCategoryDetailModal } from '../../modals/BudgetCategoryDetailModal';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { TransactionModal } from '../../modals/TransactionModal';
import { useAppStore } from '../../store/useAppStore';
import type { BudgetCategory, Transaction } from '../../types';
import {
  calcBudgetCategorySpending,
  calcGastosActual,
  calcGastosProyectados,
  calcSaldoActual,
  calcSaldoProyectado,
} from '../../utils/calculations';
import { getUserData } from '../../utils/users';
import { formatYM, MONTHS_ES } from '../../utils/format';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useTabPadding } from '../../hooks/useTabPadding';
import { buildActivityFeed } from '../../utils/activityFeed';
import { reportFabScroll } from '../../utils/fabScroll';
import { useTheme } from '../../contexts/ThemeContext';

const CARD_SUBTITLES: Record<CardState, { prefix: string; accent: string; color: string }> = {
  saldo: { prefix: 'Este es tu ', accent: 'saldo actual', color: '#23C55E' },
  gastos: { prefix: 'Este es tu ', accent: 'gasto actual', color: '#EC1147' },
};

const CARD_SUBTITLES_EXPANDED: Record<CardState, (monthName: string) => { prefix: string; accent: string; color: string }> = {
  saldo: (_m) => ({ prefix: 'Mira tu ', accent: 'saldo a final de mes', color: '#23C55E' }),
  gastos: (_m) => ({ prefix: 'Mira tus ', accent: 'gastos a final de mes', color: '#EC1147' }),
};

type HeroPalette = {
  base: string;
  soft: string;
  bright: string;
  glow: string;
  deep: string;
  shade: string;
  veil: string;
};

const BALANCE_PALETTES = {
  base: { base: '#19B85A', soft: '#47E484', bright: '#76F05A', glow: '#C8F92F', deep: '#087A42', shade: '#075F35', veil: '#149B50' },
  shift: { base: '#16A85A', soft: '#50EE95', bright: '#8AF265', glow: '#BFF529', deep: '#066D3B', shade: '#064F2F', veil: '#108D4A' },
};

const EXPENSE_PALETTES = {
  base: { base: '#EC1147', soft: '#FF5A3D', bright: '#FF7D32', glow: '#FFB33F', deep: '#C9002F', shade: '#A8002A', veil: '#FF2B4F' },
  shift: { base: '#E6003A', soft: '#FF7040', bright: '#FF9838', glow: '#FFD24A', deep: '#B90035', shade: '#95002B', veil: '#FF365C' },
};

export default function DashboardScreen() {
  const tabPadding = useTabPadding();
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const currency = useAppStore((s) => s.currency);
  const deleteTx = useAppStore((s) => s.deleteTransaction);
  const users = useAppStore((s) => s.users);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [cardState, setCardState] = useState<CardState>('saldo');
  const [pillExpanded, setPillExpanded] = useState(false);

  const subtitleFade = useRef(new Animated.Value(1)).current;
  const subtitleSlide = useRef(new Animated.Value(0)).current;

  const animateSubtitle = () => {
    subtitleFade.setValue(0);
    subtitleSlide.setValue(-6);
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(subtitleFade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(subtitleSlide, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }),
      ]).start();
    }, 32);
  };

  const handlePillToggle = (expanded: boolean) => {
    if (expanded === pillExpanded) return;
    animateSubtitle();
    setPillExpanded(expanded);
  };
  const [createKind, setCreateKind] = useState<'income' | 'expense' | null>(null);
  const [createKindPreset, setCreateKindPreset] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [detailModal, setDetailModal] = useState<{ visible: boolean; kind: 'income' | 'expense' }>({
    visible: false,
    kind: 'income',
  });
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);
  const [catPage, setCatPage] = useState(0);
  const catScrollRef = useRef<ScrollView>(null);
  const { heroAnim, contentAnim, headerAnim, itemAnims } = useEntranceAnimation();

  const user = getUserData(users, currentUser);

  const saldoActual = calcSaldoActual(payload, currentUser);
  const saldoProyectado = calcSaldoProyectado(payload, currentUser, selectedYM);
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

  const monthName = MONTHS_ES[Number(selectedYM.split('-')[1]) - 1] ?? '';
  const subtitle = pillExpanded
    ? CARD_SUBTITLES_EXPANDED[cardState](monthName)
    : CARD_SUBTITLES[cardState];
  const gradientAccent = cardState === 'gastos' ? '#EC1147' : '#70F356';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabPadding }]}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      scrollEnabled={scrollEnabled}
      onScroll={(event) => reportFabScroll(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
    >
      {/* -- Header + Balance Card -- */}
      <Animated.View style={[styles.headerSection, { opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <View style={styles.headerVisual}>
          <BalanceCardGradient state={cardState} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>¡Hola {user.name}!</Text>
              <Animated.Text
                style={[styles.subtitle, { opacity: subtitleFade, transform: [{ translateY: subtitleSlide }] }]}
              >
                {subtitle.prefix}
                <Text style={styles.subtitleAccent}>
                  {subtitle.accent}
                </Text>
              </Animated.Text>
            </View>
            <UserHeaderButton variant="light" tintColor={gradientAccent} />
          </View>

          <BalanceCard
            saldoActual={saldoActual}
            saldoProyectado={saldoProyectado}
            gastosActual={gastosActual}
            gastosProyectados={gastosProyectados}
            currency={currency}
            selectedYM={selectedYM}
            variant="gradient"
            onStateChange={(state) => { setCardState(state); setPillExpanded(false); animateSubtitle(); }}
            onSwipeBegin={() => setScrollEnabled(false)}
            onSwipeEnd={() => setScrollEnabled(true)}
            onPillToggle={handlePillToggle}
          />
        </View>
      </Animated.View>

      {/* -- Botones Ingresos / Gastos -- */}
      <Animated.View style={[styles.quickActions, { opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
        <FinanceToggleButton
          label="Añadir Ingreso"
          icon="arrow-top-right"
          accent="#00D158"
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCreateKind('income'); setCreateKindPreset(true); }}
        />
        <FinanceToggleButton
          label="Añadir Gasto"
          icon="arrow-bottom-left"
          accent="#FF0B4F"
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCreateKind('expense'); setCreateKindPreset(true); }}
        />
      </Animated.View>

      <Animated.View style={[styles.section, { opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Tendencia</Text>
          <Text style={styles.sectionMonth}>{formatYM(selectedYM)}</Text>
        </View>
        <FinanceTrendCard
          payload={payload}
          uid={currentUser}
          selectedYM={selectedYM}
          currency={currency}
          categories={budgetCategories}
          onOpenDetail={(kind) => setDetailModal({ visible: true, kind })}
        />
      </Animated.View>

      {/* Categorías de presupuesto */}
      <Animated.View style={[styles.section, styles.catSection, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        <View style={[styles.sectionHead, styles.catSectionHead]}>
          <Text style={styles.sectionTitle}>Categorías</Text>
        </View>

        {budgetCategories.length === 0 ? (
          <View style={styles.categoriesEmpty}>
            <Ionicons name="pie-chart-outline" size={28} color="#7C3AED" />
            <Text style={styles.categoriesEmptyTitle}>Sin categorías</Text>
            <Text style={styles.categoriesEmptyText}>
              Crea una categoría para rastrear tu presupuesto mensual por tipo de gasto.
            </Text>
            <Pressable
              onPress={() => setNewCategoryOpen(true)}
              style={({ pressed }) => [styles.categoriesEmptyBtn, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={16} color={theme.textPrimary} />
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
              style={{ width: pagerWidth }}
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
                  onPress={() => {
                    if (item.source === 'transaction') setSelectedTransaction(item.transaction);
                  }}
                  flat
                />
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.View>

      {/* -- Modals -- */}
      <FinanceDetailModal
        visible={detailModal.visible}
        kind={detailModal.kind}
        currency={currency}
        uid={currentUser}
        selectedYM={selectedYM}
        payload={payload}
        onClose={() => setDetailModal((s) => ({ ...s, visible: false }))}
        onAdd={() => {
          const nextKind = detailModal.kind;
          setDetailModal((s) => ({ ...s, visible: false }));
          setCreateKind(nextKind);
          setCreateKindPreset(false);
        }}
      />

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
  );
}

function FinanceToggleButton({
  label,
  icon,
  accent,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  accent: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.financeToggle, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={accent} />
      <Text style={styles.financeToggleText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function BalanceCardGradient({ state }: { state: CardState }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const themeMix = useRef(new Animated.Value(state === 'gastos' ? 1 : 0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 6200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 6200, useNativeDriver: true }),
      ]),
    );
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 9800, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 9800, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    driftLoop.start();
    return () => { pulseLoop.stop(); driftLoop.stop(); };
  }, [drift, pulse]);

  useEffect(() => {
    Animated.timing(themeMix, {
      toValue: state === 'gastos' ? 1 : 0,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [state, themeMix]);

  const shiftStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.36] }),
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-8, 10] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [8, -6] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
    ],
  };

  const balanceOpacity = themeMix.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const expenseOpacity = themeMix;

  return (
    <View pointerEvents="none" style={HERO_CANVAS.gradientCanvas}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: balanceOpacity }]}>
        <GradientLayers palettes={BALANCE_PALETTES} idPrefix="balance" animatedLayerStyle={shiftStyle} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: expenseOpacity }]}>
        <GradientLayers palettes={EXPENSE_PALETTES} idPrefix="expense" animatedLayerStyle={shiftStyle} />
      </Animated.View>
    </View>
  );
}

function GradientLayers({
  palettes,
  idPrefix,
  animatedLayerStyle,
}: {
  palettes: { base: HeroPalette; shift: HeroPalette };
  idPrefix: string;
  animatedLayerStyle: any;
}) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <GradientSvg palette={palettes.base} idPrefix={`${idPrefix}-base`} />
      <Animated.View style={[StyleSheet.absoluteFill, animatedLayerStyle]}>
        <GradientSvg palette={palettes.shift} idPrefix={`${idPrefix}-shift`} />
      </Animated.View>
    </View>
  );
}

function GradientSvg({ palette, idPrefix }: { palette: HeroPalette; idPrefix: string }) {
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

// Static canvas used by BalanceCardGradient (no theme tokens)
const HERO_CANVAS = StyleSheet.create({
  gradientCanvas: {
    bottom: -36,
    left: -28,
    position: 'absolute',
    right: -28,
    top: -18,
  },
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: t.background,
  },
  content: {},
  headerSection: {
    elevation: 4,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    zIndex: 1,
  },
  headerVisual: {
    backgroundColor: '#23C55E',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    paddingBottom: 20,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    color: '#FFFFFF',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 24,
  },
  subtitleAccent: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  catSection: {
    paddingHorizontal: 0,
  },
  catSectionHead: {
    paddingHorizontal: 24,
  },
  recentSection: {
    backgroundColor: 'transparent',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 0,
    paddingTop: 20,
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
    fontSize: 18,
    fontWeight: '600',
    color: t.textPrimary,
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
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  categoriesEmptyBtnText: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  categoriesEmptyText: {
    color: t.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  categoriesEmptyTitle: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  categoriesList: {
    gap: 8,
  },
  categoriesPager: {
    alignItems: 'center',
    gap: 10,
  },
  catPage: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  catDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  catDot: {
    backgroundColor: t.surface,
    borderRadius: 999,
    height: 4,
    width: 14,
  },
  catDotActive: {
    backgroundColor: '#7C3AED',
    width: 28,
  },
  swipeHint: {
    fontSize: 12,
    color: t.textMuted,
    fontWeight: '500',
    marginTop: 5,
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    elevation: 5,
    marginHorizontal: 24,
    marginTop: 12,
    position: 'relative',
    zIndex: 2,
  },
  financeToggle: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  financeToggleText: {
    color: t.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.72,
  },
  tileList: {
    alignSelf: 'stretch',
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    color: t.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
