import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BalanceCard } from '../../components/BalanceCard';
import { BalanceCardGradient } from '../../components/BalanceCardGradient';
import { BudgetCategoryCard } from '../../components/BudgetCategoryCard';
import { SavingPlanPreviewCard } from '../../components/SavingPlanPreviewCard';
import { ActivityTile } from '../../components/ActivityTile';
import { BudgetCategoryModal } from '../../modals/BudgetCategoryModal';
import { type AppTheme } from '../../constants/colors';
import { SECTION_TITLE_FONT_FAMILY } from '../../constants/typography';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppStore } from '../../store/useAppStore';
import type { ActivityItem } from '../../utils/activityFeed';
import type { BudgetCategory, SavingPlan, Transaction } from '../../types';

const ONBOARDING_DONE_KEY = 'nosotros_onboarding_done';
const TOTAL_STEPS = 7;
const COUNTDOWN_MS = 3000;
const DEMO_YM = '2026-05';

// ─── Dummy data for mockup slides ─────────────────────────────────────────────

const DEMO_TRANSACTION_1: Transaction = {
  id: 90001, uid: 'demo_a', cat: 'groceries', iconColor: 'green',
  desc: 'Mercado semanal', account: '', amt: 45.00,
  date: '2026-05-27', type: 'once', kind: 'expense', notes: '',
};
const DEMO_TRANSACTION_2: Transaction = {
  id: 90002, uid: 'demo_a', cat: 'coffee', iconColor: 'amber',
  desc: 'Café', account: '', amt: 8.50,
  date: '2026-05-26', type: 'once', kind: 'expense', notes: '',
};
const DEMO_TRANSACTION_3: Transaction = {
  id: 90003, uid: 'demo_a', cat: '', iconColor: 'green',
  desc: 'Nómina', account: '', amt: 1200,
  date: '2026-05-25', type: 'once', kind: 'income', notes: '',
};

const DEMO_ACTIVITIES: ActivityItem[] = [
  { source: 'transaction', id: 'demo-1', date: '2026-05-27', ownerId: 'demo_a', kind: 'expense', categoryKey: 'groceries', amount: 45.00, searchText: 'Mercado semanal', sortId: 3, transaction: DEMO_TRANSACTION_1 },
  { source: 'transaction', id: 'demo-2', date: '2026-05-26', ownerId: 'demo_a', kind: 'expense', categoryKey: 'coffee', amount: 8.50, searchText: 'Café', sortId: 2, transaction: DEMO_TRANSACTION_2 },
  { source: 'transaction', id: 'demo-3', date: '2026-05-25', ownerId: 'demo_a', kind: 'income', categoryKey: undefined, amount: 1200, searchText: 'Nómina', sortId: 1, transaction: DEMO_TRANSACTION_3 },
];

const DEMO_BUDGET_CATEGORIES: BudgetCategory[] = [
  { id: 90001, name: 'Alimentación', icon: 'restaurant', iconColor: 'green', monthlyBudget: 400 },
  { id: 90002, name: 'Transporte', icon: 'transport', iconColor: 'blue', monthlyBudget: 200 },
  { id: 90003, name: 'Ocio', icon: 'entertainment', iconColor: 'rose', monthlyBudget: 150 },
];
const DEMO_SPENT = [280, 85, 145];

const DEMO_SAVING_PLAN: SavingPlan = {
  id: 99999,
  title: 'Viaje a Europa',
  targetAmount: 3000,
  saveType: 'goal',
  icon: 'travel',
  iconColor: 'purple',
  type: 'joint',
  date: '2026-01-01',
  history: [{ id: 1, uid: 'demo_a', amount: 2190, date: '2026-05-01' }],
};

// ─── Slide content components ──────────────────────────────────────────────────

function SlideWelcome() {
  const theme = useTheme();
  return (
    <View style={slide.welcomeHero}>
      <View style={slide.welcomeIconWrap}>
        <Ionicons name="heart" size={44} color="#EC1147" />
      </View>
      <Text style={[slide.welcomeAppName, { color: theme.textPrimary }]}>Juntos</Text>
      <Text style={[slide.welcomeTag, { color: theme.textSecondary }]}>
        Finanzas en pareja,{'\n'}sin complicaciones.
      </Text>
    </View>
  );
}

function SlideBalance({ currency }: { currency: string }) {
  return (
    <View style={{ width: '100%', borderRadius: 28, overflow: 'hidden' }}>
      <BalanceCardGradient state="saldo" />
      <BalanceCard
        saldoActual={4280}
        saldoProyectado={4520}
        gastosActual={1340}
        gastosProyectados={1580}
        currency={currency as any}
        selectedYM={DEMO_YM}
        variant="gradient"
        onStateChange={() => {}}
        onSwipeBegin={() => {}}
        onSwipeEnd={() => {}}
        onPillToggle={() => {}}
      />
    </View>
  );
}

function SlideMovimientos({ currency }: { currency: string }) {
  const theme = useTheme();
  const fabBg = theme.mode === 'light'
    ? 'rgba(240, 240, 245, 0.88)'
    : 'rgba(38, 45, 51, 0.88)';
  const fabBorder = theme.mode === 'light'
    ? 'rgba(0, 0, 0, 0.12)'
    : 'rgba(255, 255, 255, 0.16)';

  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Exact same layout as DashboardScreen quickActions */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={[slide.financeToggle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <MaterialCommunityIcons name="arrow-top-right" size={20} color="#00D158" />
          <Text style={[slide.financeToggleText, { color: theme.textPrimary }]} numberOfLines={1}>
            Añadir Ingreso
          </Text>
        </View>
        <View style={[slide.financeToggle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <MaterialCommunityIcons name="arrow-bottom-left" size={20} color="#EC1147" />
          <Text style={[slide.financeToggleText, { color: theme.textPrimary }]} numberOfLines={1}>
            Añadir Gasto
          </Text>
        </View>
      </View>

      {/* Recent transactions section */}
      <View style={{ marginTop: 24 }}>
        <Text style={[slide.sectionTitle, { color: theme.textPrimary }]}>Movimientos Recientes</Text>
        <View style={{ gap: 2, marginTop: 10 }}>
          {DEMO_ACTIVITIES.map((item) => (
            <ActivityTile key={item.id} activity={item} ym={DEMO_YM} flat />
          ))}
        </View>
      </View>

      {/* FAB at bottom-right, like in the real app */}
      <View
        style={[
          slide.fabMock,
          {
            position: 'absolute',
            bottom: 16,
            right: 0,
            backgroundColor: fabBg,
            borderColor: fabBorder,
          },
        ]}
      >
        <Ionicons name="add" size={28} color={theme.textPrimary} />
      </View>
    </View>
  );
}

function SlideCategorias({ currency }: { currency: string }) {
  return (
    <View style={{ width: '100%', gap: 8 }}>
      {DEMO_BUDGET_CATEGORIES.map((cat, i) => (
        <BudgetCategoryCard
          key={cat.id}
          category={cat}
          spent={DEMO_SPENT[i]}
          currency={currency as any}
          variant="default"
          onPress={() => {}}
        />
      ))}
    </View>
  );
}

function SlideAhorros() {
  return (
    <View style={{ width: '100%' }}>
      <SavingPlanPreviewCard
        plan={DEMO_SAVING_PLAN}
        onPress={() => {}}
        readOnly
      />
    </View>
  );
}

function SlidePlanes() {
  const theme = useTheme();
  const rows = [
    { icon: 'airplane-outline', label: 'Vuelo ida y vuelta', amt: 320, color: '#2563EB' },
    { icon: 'bed-outline',      label: 'Hotel 3 noches',    amt: 180, color: '#7C3AED' },
    { icon: 'restaurant-outline', label: 'Restaurantes',   amt: 95,  color: '#00D158' },
  ];
  const total = rows.reduce((s, r) => s + r.amt, 0);

  return (
    <View style={{ width: '100%', gap: 14 }}>
      {/* Plan card */}
      <View style={[slide.planCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Header */}
        <View style={slide.planHeader}>
          <View style={slide.planIconWrap}>
            <Ionicons name="map-outline" size={20} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[slide.planTitle, { color: theme.textPrimary }]}>Viaje de fin de año</Text>
            <Text style={[slide.planSub, { color: theme.textMuted }]}>Plan compartido · 2 personas</Text>
          </View>
          <View style={[slide.planBadge, { backgroundColor: '#2563EB15' }]}>
            <Text style={[slide.planBadgeText, { color: '#2563EB' }]}>${total}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={[slide.planDivider, { backgroundColor: theme.border }]} />

        {/* Expense rows */}
        {rows.map((r) => (
          <View key={r.label} style={slide.planExpRow}>
            <View style={[slide.planExpIcon, { backgroundColor: r.color + '18' }]}>
              <Ionicons name={r.icon as any} size={15} color={r.color} />
            </View>
            <Text style={[slide.planExpLabel, { color: theme.textPrimary }]}>{r.label}</Text>
            <Text style={[slide.planExpAmt, { color: theme.textSecondary }]}>${r.amt}</Text>
          </View>
        ))}

        {/* Participants */}
        <View style={slide.planParticipants}>
          {[
            { initials: 'AL', bg: '#E0E7FF', color: '#4F46E5' },
            { initials: 'GA', bg: '#FCE7F3', color: '#DB2777' },
          ].map((p) => (
            <View key={p.initials} style={[slide.planAvatar, { backgroundColor: p.bg }]}>
              <Text style={[slide.planAvatarText, { color: p.color }]}>{p.initials}</Text>
            </View>
          ))}
          <Text style={[slide.planParticipantsText, { color: theme.textMuted }]}>
            Gastos compartidos
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Static styles for slide components ───────────────────────────────────────

const slide = StyleSheet.create({
  welcomeHero: { alignItems: 'center', gap: 16 },
  welcomeIconWrap: {
    width: 96, height: 96, borderRadius: 32,
    backgroundColor: '#FFF0F3',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  welcomeAppName: { fontSize: 40, fontFamily: 'Poppins_700Bold', letterSpacing: -1 },
  welcomeTag: { fontSize: 18, fontWeight: '400', textAlign: 'center', lineHeight: 26 },

  // Exact copy of financeToggle style from app/(tabs)/index.tsx makeStyles
  financeToggle: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  financeToggleText: { fontSize: 13, fontWeight: '700' },

  // Exact copy of floatingFab style from app/(tabs)/_layout.tsx makeStyles
  fabMock: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.46, shadowRadius: 26, elevation: 18,
  },

  sectionTitle: { fontFamily: SECTION_TITLE_FONT_FAMILY, fontSize: 14 },

  // Planes slide
  planCard: {
    borderRadius: 20, borderWidth: 1, padding: 16, gap: 12,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#2563EB18',
    alignItems: 'center', justifyContent: 'center',
  },
  planTitle: { fontSize: 15, fontWeight: '700' },
  planSub: { fontSize: 12, marginTop: 1 },
  planBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  planBadgeText: { fontSize: 14, fontWeight: '700' },
  planDivider: { height: 1 },
  planExpRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planExpIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  planExpLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  planExpAmt: { fontSize: 13, fontWeight: '600' },
  planParticipants: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  planAvatar: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  planAvatarText: { fontSize: 10, fontWeight: '800' },
  planParticipantsText: { fontSize: 12, fontWeight: '500' },
});

// ─── Interactive last step — use real BudgetCategoryModal ─────────────────────

function StepCategorias({
  theme,
  onFinish,
  isActive,
}: {
  theme: AppTheme;
  onFinish: () => void;
  isActive: boolean;
}) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const currency = useAppStore((s) => s.currency);
  const categories = useAppStore((s) => s.payload.budgetCategories ?? []);
  const [modalOpen, setModalOpen] = useState(false);
  const canFinish = categories.length >= 3;
  const remaining = Math.max(0, 3 - categories.length);

  // Auto-open the modal the moment the user reaches this step
  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => setModalOpen(true), 380);
    return () => clearTimeout(timer);
  }, [isActive]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.catStepScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress dots */}
        <View style={styles.catProgressRow}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.catProgressDot, i < categories.length && styles.catProgressDotDone]}
            />
          ))}
        </View>

        {remaining > 0 && (
          <Text style={[styles.catMinHint, { color: theme.textMuted }]}>
            {remaining === 3
              ? 'Añade al menos 3 categorías para continuar'
              : `${remaining} categoría${remaining > 1 ? 's' : ''} más para continuar`}
          </Text>
        )}

        {/* Real BudgetCategoryCard for each created category */}
        <View style={{ gap: 8 }}>
          {categories.map((cat) => (
            <BudgetCategoryCard
              key={cat.id}
              category={cat}
              spent={0}
              currency={currency}
              onPress={() => {}}
            />
          ))}
        </View>

        {/* "Añadir otra" button — only shown once at least one category exists */}
        {categories.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.addAnotherBtn, { borderColor: theme.border }, pressed && { opacity: 0.7 }]}
            onPress={() => setModalOpen(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color={theme.textSecondary} />
            <Text style={[styles.addAnotherText, { color: theme.textSecondary }]}>
              Añadir otra categoría
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Finalizar */}
      <View style={[styles.catFinishWrap, { borderTopColor: theme.border }]}>
        <Pressable
          style={[styles.cta, !canFinish && styles.ctaDisabled]}
          disabled={!canFinish}
          onPress={onFinish}
        >
          <Text style={styles.ctaText}>¡Empezar a usar Juntos!</Text>
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <BudgetCategoryModal
        visible={modalOpen}
        hideBreadcrumbs
        onClose={() => setModalOpen(false)}
      />
    </View>
  );
}

// ─── Slide metadata ────────────────────────────────────────────────────────────

const SLIDE_META = [
  { title: 'Bienvenidos a Juntos', desc: 'En unos pasos te enseñamos todo lo que necesitas para controlar las finanzas en pareja.' },
  { title: 'Tu balance de un vistazo', desc: 'La tarjeta principal muestra tu saldo actual. Deslízala para alternar entre saldo y gastos del mes.' },
  { title: 'Registra en segundos', desc: 'Toca + para registrar cualquier ingreso o gasto. Categorízalo y lleva el control exacto.' },
  { title: 'Presupuesto por categoría', desc: 'Asigna un límite mensual a cada categoría. Juntos te avisa cuando te acercas al tope.' },
  { title: 'Metas de ahorro compartidas', desc: 'Define una meta, establece el objetivo y registra depósitos. Visualiza el progreso juntos.' },
  { title: 'Planes compartidos', desc: 'Crea un plan para organizar los gastos de un evento o viaje. Cada participante ve cuánto lleva aportado.' },
  { title: 'Crea tus primeras categorías', desc: 'Las categorías organizan tus gastos. Necesitas al menos 3 para empezar.' },
];

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const currency = useAppStore((s) => s.currency);
  const currentUser = useAppStore((s) => s.currentUser);

  const [step, setStep] = useState(0);
  const [canContinue, setCanContinue] = useState(false);

  const slideX = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const isLastStep = step === TOTAL_STEPS - 1;

  // 3-second fill animation on the Continuar button
  useEffect(() => {
    if (isLastStep) {
      progressAnim.setValue(1);
      setCanContinue(true);
      return;
    }
    progressAnim.setValue(0);
    setCanContinue(false);
    progressAnimation.current?.stop();
    progressAnimation.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: COUNTDOWN_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressAnimation.current.start(({ finished }) => {
      if (finished) setCanContinue(true);
    });
    return () => progressAnimation.current?.stop();
  }, [step]);

  const goTo = (nextStep: number) => {
    Animated.spring(slideX, {
      toValue: -nextStep * width,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
      mass: 0.8,
    }).start();
    setStep(nextStep);
  };

  const handleNext = () => { if (canContinue && step < TOTAL_STEPS - 1) goTo(step + 1); };
  const handleBack = () => { if (step > 0) goTo(step - 1); };

  const handleFinish = async () => {
    await AsyncStorage.setItem(`nosotros_onboarding_done:${currentUser}`, '1');
    router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(`nosotros_onboarding_done:${currentUser}`, '1');
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Top bar: step dots + skip */}
      <View style={styles.topBar}>
        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i <= step ? '#EC1147' : theme.border },
                i === step && styles.dotActive,
              ]}
            />
          ))}
        </View>
        {!isLastStep && (
          <Pressable onPress={handleSkip} hitSlop={12}>
            <Text style={[styles.skipText, { color: theme.textMuted }]}>Saltar</Text>
          </Pressable>
        )}
      </View>

      {/* Carousel */}
      <View style={[styles.carouselWrap, { width }]}>
        <Animated.View
          style={[styles.carouselTrack, {
            width: width * TOTAL_STEPS,
            transform: [{ translateX: slideX }],
          }]}
        >
          <View style={[styles.slide, { width }]}>
            <View style={styles.slideContent}><SlideWelcome /></View>
          </View>
          <View style={[styles.slide, { width }]}>
            <View style={styles.slideContent}><SlideBalance currency={currency} /></View>
          </View>
          <View style={[styles.slide, { width }]}>
            <View style={[styles.slideContent, { justifyContent: 'flex-start', paddingTop: 20 }]}>
              <SlideMovimientos currency={currency} />
            </View>
          </View>
          <View style={[styles.slide, { width }]}>
            <View style={styles.slideContent}><SlideCategorias currency={currency} /></View>
          </View>
          <View style={[styles.slide, { width }]}>
            <View style={styles.slideContent}><SlideAhorros /></View>
          </View>
          <View style={[styles.slide, { width }]}>
            <View style={styles.slideContent}><SlidePlanes /></View>
          </View>
          <View style={[styles.slide, { width }]}>
            <StepCategorias theme={theme} onFinish={handleFinish} isActive={step === TOTAL_STEPS - 1} />
          </View>
        </Animated.View>
      </View>

      {/* Footer: title + desc + nav buttons */}
      <View style={styles.footer}>
        <View style={styles.footerText}>
          <Text style={[styles.slideTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            {SLIDE_META[step].title}
          </Text>
          <Text style={[styles.slideDesc, { color: theme.textSecondary }]}>
            {SLIDE_META[step].desc}
          </Text>
        </View>

        {!isLastStep && (
          <View style={styles.navRow}>
            {step > 0 ? (
              <Pressable style={[styles.backBtn, { backgroundColor: theme.softSurface }]} onPress={handleBack}>
                <Ionicons name="arrow-back" size={20} color={theme.textSecondary} />
              </Pressable>
            ) : (
              <View style={styles.backBtnPlaceholder} />
            )}

            {/* Continuar button with animated left-to-right fill over 3 seconds */}
            <Pressable
              style={[styles.ctaWrap, !canContinue && { opacity: 0.72 }]}
              onPress={handleNext}
              disabled={!canContinue}
            >
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  styles.ctaFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }) as any,
                  },
                ]}
              />
              <Text style={styles.ctaText}>Continuar</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {isLastStep && (
          <View style={styles.navRow}>
            <Pressable style={[styles.backBtn, { backgroundColor: theme.softSurface }]} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={theme.textSecondary} />
            </Pressable>
            <View style={{ flex: 1 }} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (t: AppTheme) => StyleSheet.create({
  screen: { flex: 1 },

  topBar: {
    alignItems: 'center', flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8,
  },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: { borderRadius: 99, height: 6, width: 6 },
  dotActive: { width: 20, backgroundColor: '#EC1147' },
  skipText: { fontSize: 14, fontWeight: '600' },

  carouselWrap: { flex: 1, overflow: 'hidden' },
  carouselTrack: { flex: 1, flexDirection: 'row' },
  slide: { flex: 1 },
  slideContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20,
  },

  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 8 : 16, gap: 14 },
  footerText: { gap: 4 },
  slideTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', letterSpacing: -0.3 },
  slideDesc: { fontSize: 14, lineHeight: 21, fontWeight: '400' },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnPlaceholder: { width: 48 },

  ctaWrap: {
    flex: 1, height: 52, borderRadius: 16,
    backgroundColor: '#EC114730',
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8, overflow: 'hidden',
  },
  ctaFill: {
    backgroundColor: '#EC1147',
    borderRadius: 16,
    left: 0, top: 0, bottom: 0,
  },
  ctaText: {
    color: '#FFFFFF', fontSize: 16,
    fontFamily: 'Poppins_600SemiBold', zIndex: 1,
  },

  cta: {
    alignItems: 'center', backgroundColor: '#EC1147',
    borderRadius: 16, flexDirection: 'row',
    gap: 8, height: 54, justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.45 },

  // Last step layout
  catStepScroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 },
  catProgressRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  catProgressDot: {
    width: 32, height: 6, borderRadius: 99,
    backgroundColor: t.border,
  },
  catProgressDotDone: { backgroundColor: '#EC1147' },
  catMinHint: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

  addAnotherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, borderWidth: 1,
    paddingVertical: 12,
  },
  addAnotherText: { fontSize: 14, fontWeight: '600' },

  catFinishWrap: { borderTopWidth: 1, padding: 16 },
});
