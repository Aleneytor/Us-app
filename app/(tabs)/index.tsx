import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
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
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { type AppTheme } from '../../constants/colors';
import { BalanceCard } from '../../components/BalanceCard';
import { BalanceCardGradient } from '../../components/BalanceCardGradient';
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
import { GettingStartedCard } from '../../components/GettingStartedCard';
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


export default function DashboardScreen() {
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('nosotros_onboarding_done').then((v) => {
      if (v !== '1') {
        router.replace('/onboarding');
      } else {
        setOnboardingChecked(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const screenScrollRef = useRef<ScrollView>(null);
  const catScrollRef = useRef<ScrollView>(null);
  const { heroAnim, contentAnim, headerAnim, itemAnims } = useEntranceAnimation({
    scrollRef: screenScrollRef,
    onResetScroll: () => reportFabScroll(0),
  });

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

  const monthName = MONTHS_ES[Number(selectedYM.split('-')[1]) - 1] ?? '';
  const subtitle = pillExpanded
    ? CARD_SUBTITLES_EXPANDED[cardState](monthName)
    : CARD_SUBTITLES[cardState];
  const gradientAccent = cardState === 'gastos' ? '#EC1147' : '#70F356';

  if (!onboardingChecked) return null;

  return (
    <ScrollView
      ref={screenScrollRef}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabPadding }]}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      scrollEnabled={scrollEnabled}
      onScroll={(event) => reportFabScroll(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
    >
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

      <GettingStartedCard />

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
    backgroundColor: t.textPrimary,
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
