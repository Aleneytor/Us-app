import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { GoalCard } from '../../components/GoalCard';
import { SavingPlanPreviewCard } from '../../components/SavingPlanPreviewCard';
import { AppModal as Modal } from '../../components/AppModal';
import { ModalScreen } from '../../components/ModalScreen';
import { SearchBar } from '../../components/SearchBar';
import { SavingsCard, type SavingsCardState } from '../../components/SavingsCard';
import { type AppTheme } from '../../constants/colors';
import { SURFACE_SHADOW } from '../../constants/shadows';
import { MODAL_TITLE_FONT_WEIGHT } from '../../constants/typography';
import { ContributionModal } from '../../modals/ContributionModal';
import { GoalModal } from '../../modals/GoalModal';
import { SavingPlanModal } from '../../modals/SavingPlanModal';
import { SavingPlanDetailModal } from '../../modals/SavingPlanDetailModal';
import type { Contribution, Goal, SavingPlan } from '../../types';
import { goalProgress } from '../../utils/calculations';
import { formatDateShort, fmt } from '../../utils/format';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import { dismissKeyboardAndBlur } from '../../utils/keyboard';
import { getPartnerId, getUserData } from '../../utils/users';
import { UserHeaderButton } from '../../components/UserHeaderButton';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useTabPadding } from '../../hooks/useTabPadding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reportFabScroll } from '../../utils/fabScroll';
import { useTheme } from '../../contexts/ThemeContext';

type SavPalette = { base: string; soft: string; bright: string; glow: string; deep: string; shade: string; veil: string };

const SAV_PURPLE_BASE: SavPalette = { base: '#5B21B6', soft: '#8B5CF6', bright: '#A78BFA', glow: '#C4B5FD', deep: '#3B0764', shade: '#4C1D95', veil: '#7C3AED' };
const SAV_PURPLE_SHIFT: SavPalette = { base: '#4C1D95', soft: '#7C3AED', bright: '#9061F9', glow: '#B89AF8', deep: '#2E0070', shade: '#3D1882', veil: '#6D28D9' };
const SAV_BLUE_BASE: SavPalette = { base: '#1D4ED8', soft: '#3B82F6', bright: '#60A5FA', glow: '#BAE6FD', deep: '#1E3A8A', shade: '#1E40AF', veil: '#2563EB' };
const SAV_BLUE_SHIFT: SavPalette = { base: '#1E40AF', soft: '#2563EB', bright: '#4F86F8', glow: '#93C5FD', deep: '#172554', shade: '#1E3A8A', veil: '#1D4ED8' };

type OwnerFilter = 'mine' | 'partner' | 'both';

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownInfo {
  x: number;
  y: number;
  width: number;
  options: DropdownOption[];
  value: string;
  onChange: (v: string) => void;
}

interface GoalSection {
  title: string;
  subtitle: string;
  data: Goal[];
  readOnly: boolean;
}

export default function AhorrosScreen() {
  const router = useRouter();
  const tabPadding = useTabPadding();
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const deleteGoal = useAppStore((s) => s.deleteGoal);
  const currency = useAppStore((s) => s.currency);
  const users = useAppStore((s) => s.users);
  const partnerForUser = useAppStore((s) => s.partnerForUser);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [selectedSaving, setSelectedSaving] = useState<SavingPlan | null>(null);
  const [createSavingOpen, setCreateSavingOpen] = useState(false);
  const [editSaving, setEditSaving] = useState<SavingPlan | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('both');
  const [searchText, setSearchText] = useState('');
  const [dropdown, setDropdown] = useState<DropdownInfo | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const insets = useSafeAreaInsets();
  const { heroAnim, contentAnim, headerAnim, itemAnims } = useEntranceAnimation({
    scrollRef,
    onResetScroll: () => reportFabScroll(0),
  });

  const partner = getPartnerId(partnerForUser, currentUser);
  const currentUserData = getUserData(users, currentUser);

  const filteredSavings = useMemo<SavingPlan[]>(() => {
    const query = searchText.trim().toLowerCase();
    return (payload.savings ?? []).filter((p) => {
      if (query && !p.title.toLowerCase().includes(query)) return false;
      if (ownerFilter === 'mine') return p.type === 'joint' || p.uid === currentUser;
      if (ownerFilter === 'partner') return p.type === 'joint' || p.uid === partner;
      return true;
    });
  }, [currentUser, ownerFilter, partner, payload.savings, searchText]);

  const filteredGoals = useMemo<Goal[]>(() => {
    const query = searchText.trim().toLowerCase();
    return payload.goals.filter((g) => {
      if (query && !g.name.toLowerCase().includes(query)) return false;
      if (ownerFilter === 'mine') return g.type === 'joint' || g.uid === currentUser;
      if (ownerFilter === 'partner') return g.type === 'joint' || g.uid === partner;
      return true;
    });
  }, [currentUser, ownerFilter, partner, payload.goals, searchText]);

  const totals = useMemo(() => {
    const target = payload.goals.reduce((sum, goal) => sum + goal.target, 0);
    const saved = payload.contribs.reduce((sum, contrib) => sum + contrib.amt, 0);
    return { target, saved, remaining: Math.max(0, target - saved) };
  }, [payload.contribs, payload.goals]);

  const handleDelete = (goal: Goal) => {
    Alert.alert(
      'Eliminar meta',
      'Tambien se eliminaran sus aportes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteGoal(goal.id) },
      ],
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: tabPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        bounces={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={dismissKeyboardAndBlur}
        onScroll={(event) => reportFabScroll(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        <Animated.View style={{ opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
          <View style={[styles.savingsHeroWrap, { paddingTop: insets.top + 14 }]}>
            <SavingsHeroGradient state="ahorrado" />
            <View style={styles.heroTop}>
              <Pressable
                onPress={() => router.navigate('/(tabs)/extras')}
                style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
              >
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </Pressable>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroGreeting}>¡Hola {currentUserData.name}!</Text>
                <Text style={styles.heroSubtitle}>
                  {'Estos son tus '}
                  <Text style={styles.heroHighlight}>ahorros</Text>
                  {' y tus '}
                  <Text style={styles.heroHighlight}>metas hasta hoy</Text>
                </Text>
              </View>
              <UserHeaderButton variant="light" tintColor="#A78BFA" />
            </View>
            <SavingsCard
              saved={totals.saved}
              target={totals.target}
              currency={currency}
              variant="gradient"
              showObjectiveSlide={false}
              showPillToggle={false}
            />
          </View>
          <Pressable
            onPress={() => setCreateSavingOpen(true)}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
          >
            <Ionicons name="wallet-outline" size={18} color="#7C3AED" />
            <Text style={styles.addBtnText}>Crear Ahorro</Text>
          </Pressable>
        </Animated.View>

        {/* -- Barra de búsqueda -- */}
        <Animated.View style={{ opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>
          <SearchBar
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Buscar ahorro"
            style={styles.searchBar}
          />
        </Animated.View>

        {/* ── Ahorros ──────────────────────────────────────────── */}
        <Animated.View style={{ opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>
          <View style={styles.filterSectionHead}>
            <Text style={styles.filterSectionTitle}>Ahorros</Text>
            <Text style={styles.filterSectionSubtitle}>Filtra por propietario para explorar</Text>
          </View>
          <View style={styles.filtersBar}>
            <GoalFilterChip
              icon="people-outline"
              label="Ver"
              options={[
                { label: 'Todos', value: 'both' },
                { label: 'Mis ahorros', value: 'mine' },
                { label: 'Pareja', value: 'partner' },
              ]}
              value={ownerFilter}
              onChange={(value) => setOwnerFilter(value as OwnerFilter)}
              onOpen={setDropdown}
            />
          </View>
        </Animated.View>

        {filteredSavings.length > 0 && (
          <Animated.View style={{ opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
            <View style={styles.cardStack}>
              {filteredSavings.map((saving, index) => (
                <Animated.View
                  key={String(saving.id)}
                  style={{
                    opacity: itemAnims[index] ?? headerAnim,
                    transform: [{ translateY: (itemAnims[index] ?? headerAnim).interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                  }}
                >
                  <SavingPlanPreviewCard
                    plan={saving}
                    onPress={() => setSelectedSaving(saving)}
                    onEdit={() => setEditSaving(saving)}
                    readOnly={saving.type === 'personal' && saving.uid !== currentUser}
                  />
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Metas ────────────────────────────────────────────── */}
        <Animated.View style={[{ opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Metas</Text>
          </View>
          <View style={styles.cardStack}>
            {filteredGoals.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>
                  {searchText.trim() ? 'No se encontraron ahorros.' : 'Aún no hay ahorros en esta sección.'}
                </Text>
              </View>
            ) : (
              filteredGoals.map((goal, index) => (
                <Animated.View
                  key={String(goal.id)}
                  style={{
                    opacity: itemAnims[index] ?? headerAnim,
                    transform: [{ translateY: (itemAnims[index] ?? headerAnim).interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                  }}
                >
                  <GoalCard
                    goal={goal}
                    contribs={payload.contribs}
                    readOnly={goal.type === 'personal' && goal.uid !== currentUser}
                    onPress={() => setSelectedGoal(goal)}
                    onContribute={() => setContributeGoal(goal)}
                    onEdit={() => setEditGoal(goal)}
                    onDelete={() => handleDelete(goal)}
                  />
                </Animated.View>
              ))
            )}
          </View>
        </Animated.View>
      </ScrollView>

      <GoalDetailModal
        goal={selectedGoal}
        contribs={payload.contribs}
        onClose={() => setSelectedGoal(null)}
      />

      <GoalModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <GoalModal
        visible={!!editGoal}
        goal={editGoal}
        onClose={() => setEditGoal(null)}
      />
      <ContributionModal
        visible={!!contributeGoal}
        goal={contributeGoal}
        onClose={() => setContributeGoal(null)}
      />

      <SavingPlanDetailModal
        plan={selectedSaving}
        onClose={() => setSelectedSaving(null)}
        onEdit={() => { const s = selectedSaving; setSelectedSaving(null); setEditSaving(s); }}
      />
      <SavingPlanModal
        visible={createSavingOpen}
        onClose={() => setCreateSavingOpen(false)}
      />
      <SavingPlanModal
        visible={!!editSaving}
        plan={editSaving}
        onClose={() => setEditSaving(null)}
      />

      {dropdown && (
        <GoalDropdownOverlay info={dropdown} onClose={() => setDropdown(null)} />
      )}
    </View>
  );
}

function GoalDetailModal({
  goal,
  contribs,
  onClose,
}: {
  goal: Goal | null;
  contribs: Contribution[];
  onClose: () => void;
}) {
  const currency = useAppStore((s) => s.currency);
  const users = useAppStore((s) => s.users);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (!goal) return null;

  const goalContribs = contribs
    .filter((contrib) => String(contrib.gid) === String(goal.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const progress = goalProgress(goal, contribs);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalScreen
        title={goal.name}
        breadcrumbs={['Ahorros', 'Meta', 'Historial']}
        activeBreadcrumb={2}
        onBack={onClose}
        scroll
      >

          <View style={styles.detailSummary}>
            <DetailPill label="Ahorrado" value={fmt(progress.total, currency)} />
            <DetailPill label="Objetivo" value={fmt(goal.target, currency)} />
            <DetailPill label="Falta" value={fmt(progress.remaining, currency)} />
          </View>

          <Text style={styles.historyTitle}>Historial</Text>
          {goalContribs.length === 0 ? (
            <Text style={styles.emptyText}>Todavía no hay aportes.</Text>
          ) : (
            <View style={styles.historyList}>
              {goalContribs.map((contrib) => (
                <View key={String(contrib.id)} style={styles.historyRow}>
                  <View style={styles.historyText}>
                    <Text style={styles.historyAmount}>{fmt(contrib.amt, currency)}</Text>
                    <Text style={styles.historyMeta}>
                      {getUserData(users, contrib.uid).name} · {formatDateShort(contrib.date)}
                    </Text>
                    {contrib.note ? <Text style={styles.historyNote}>{contrib.note}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
      </ModalScreen>
    </Modal>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.detailPill}>
      <Text style={styles.detailPillLabel}>{label}</Text>
      <Text style={styles.detailPillValue}>{value}</Text>
    </View>
  );
}

function PlaceholderModal({
  title,
  body,
  visible,
  onClose,
}: {
  title: string;
  body: string;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ModalScreen
        title={title}
        breadcrumbs={['Ahorros', 'Proceso']}
        activeBreadcrumb={1}
        onBack={onClose}
      >
          <Text style={styles.placeholderText}>{body}</Text>
      </ModalScreen>
    </Modal>
  );
}

// --- GoalFilterChip ----------------------------------------------------------

function GoalFilterChip({
  icon,
  label,
  options,
  value,
  onChange,
  onOpen,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  options: DropdownOption[];
  value: string;
  onChange: (v: string) => void;
  onOpen: (info: DropdownInfo) => void;
}) {
  const chipRef = useRef<View>(null);
  const activeLabel = options.find((o) => o.value === value)?.label ?? label;
  const isFiltered = value !== options[0].value;
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handlePress = () => {
    chipRef.current?.measure((_, __, width, height, pageX, pageY) => {
      onOpen({
        x: pageX,
        y: pageY + height + 6,
        width,
        options,
        value,
        onChange,
      });
    });
  };

  return (
    <View ref={chipRef} style={styles.filterChipWrapper}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.filterChip, isFiltered && styles.filterChipActive, pressed && styles.pressed]}
      >
        <Ionicons name={icon} size={14} color={isFiltered ? '#7C3AED' : theme.textSecondary} />
        <Text style={[styles.filterChipText, isFiltered && styles.filterChipTextActive]}>
          {activeLabel}
        </Text>
        <Ionicons name="chevron-down" size={12} color={isFiltered ? '#7C3AED' : theme.textMuted} />
      </Pressable>
    </View>
  );
}

// --- GoalDropdownOverlay ------------------------------------------------------

function GoalDropdownOverlay({ info, onClose }: { info: DropdownInfo; onClose: () => void }) {
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
  }, []);

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
          styles.dropdownCard,
          {
            left: info.x,
            top: info.y,
            width: Math.max(info.width, 140),
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
          },
        ]}
      >
        <View style={styles.dropdownInner}>
          {info.options.map((opt, i) => {
            const active = opt.value === info.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => animateClose(() => info.onChange(opt.value))}
                style={({ pressed }) => [
                  styles.dropdownOption,
                  i > 0 && styles.dropdownOptionBorder,
                  active && styles.dropdownOptionActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>
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

function SavingsHeroGradient({ state }: { state: SavingsCardState }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const themeMix = useRef(new Animated.Value(state === 'objetivo' ? 1 : 0)).current;

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

  useEffect(() => {
    Animated.timing(themeMix, {
      toValue: state === 'objetivo' ? 1 : 0,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [state, themeMix]);

  const shiftStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.38] }),
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-8, 10] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [8, -6] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
    ],
  };
  const purpleOpacity = themeMix.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const blueOpacity = themeMix;

  return (
    <View pointerEvents="none" style={HERO_CANVAS_STYLE.savingsGradientCanvas}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: purpleOpacity }]}>
        <SavingsBlobSvg palette={SAV_PURPLE_BASE} idPrefix="sav-pb" />
        <Animated.View style={[StyleSheet.absoluteFill, shiftStyle]}>
          <SavingsBlobSvg palette={SAV_PURPLE_SHIFT} idPrefix="sav-ps" />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: blueOpacity }]}>
        <SavingsBlobSvg palette={SAV_BLUE_BASE} idPrefix="sav-bb" />
        <Animated.View style={[StyleSheet.absoluteFill, shiftStyle]}>
          <SavingsBlobSvg palette={SAV_BLUE_SHIFT} idPrefix="sav-bs" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function SavingsBlobSvg({ palette, idPrefix }: { palette: SavPalette; idPrefix: string }) {
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

// Static canvas style shared by SavingsHeroGradient (no theme tokens needed)
const HERO_CANVAS_STYLE = StyleSheet.create({
  savingsGradientCanvas: {
    bottom: -36,
    left: -28,
    position: 'absolute',
    right: -28,
    top: -18,
  },
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  cardStack: {
    gap: 8,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 22,
    paddingTop: 20,
  },
  sectionTitle: {
    color: t.textPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
  searchBar: {
    marginHorizontal: 20,
  },
  // -- Plans section header --
  filterSectionHead: {
    gap: 2,
    marginTop: 2,
    paddingHorizontal: 22,
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
  // -- Filters --
  filtersBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 20,
  },
  filterChipWrapper: {
    backgroundColor: t.surface,
    borderRadius: 20,
    ...SURFACE_SHADOW,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    borderColor: '#7C3AED',
  },
  filterChipText: {
    color: t.textSecondary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#7C3AED',
  },
  pressed: {
    opacity: 0.7,
  },
  // -- Dropdown --
  dropdownCard: {
    borderRadius: 14,
    elevation: 8,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    zIndex: 100,
  },
  dropdownInner: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownOption: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
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
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  dropdownOptionTextActive: {
    color: '#7C3AED',
    fontFamily: 'Poppins_600SemiBold',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  content: {
    gap: 18,
    paddingBottom: 16,
    paddingTop: 0,
  },
  savingsHeroWrap: {
    backgroundColor: '#5B21B6',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 5,
    overflow: 'hidden',
    paddingBottom: 16,
    shadowColor: '#3B0764',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
  },
  addBtn: {
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
    marginTop: 14,
  },
  addBtnPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  addBtnText: {
    color: t.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
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
  heroTextWrap: {
    flex: 1,
    gap: 0,
    minWidth: 0,
  },
  heroGreeting: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    lineHeight: 32,
  },
  heroSubtitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
  },
  heroHighlight: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '400',
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
  detailSummary: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  emptySection: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 14,
    borderStyle: 'dashed',
    marginHorizontal: 20,
    borderWidth: 1,
    padding: 16,
  },
  emptyText: {
    color: t.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  expense: {
    color: t.expense,
  },
  historyAmount: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  historyList: {
    borderTopColor: t.border,
    borderTopWidth: 1,
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
  historyRow: {
    borderBottomColor: t.border,
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  historyText: {
    gap: 3,
  },
  historyTitle: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  income: {
    color: t.income,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: t.surface,
    borderRadius: 18,
    maxHeight: '82%',
    overflow: 'hidden',
    padding: 18,
    width: '100%',
  },
  modalShadow: {
    borderRadius: 18,
    elevation: 14,
    maxWidth: 560,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    color: t.textPrimary,
    flex: 1,
    fontSize: 19,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
  placeholderText: {
    color: t.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  screen: {
    backgroundColor: t.background,
    flex: 1,
  },
});
