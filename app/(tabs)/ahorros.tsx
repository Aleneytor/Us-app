import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GoalCard } from '../../components/GoalCard';
import { APP_COLORS } from '../../constants/colors';
import { ContributionModal } from '../../modals/ContributionModal';
import { GoalModal } from '../../modals/GoalModal';
import { PARTNER, USERS } from '../../types';
import type { Contribution, CurrencyCode, Goal } from '../../types';
import { goalProgress } from '../../utils/calculations';
import { formatDateShort, fmt } from '../../utils/format';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';

const SAVINGS_ACCENT = '#7C3AED';

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
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const deleteGoal = useAppStore((s) => s.deleteGoal);
  const currency = useAppStore((s) => s.currency);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('both');
  const [searchText, setSearchText] = useState('');
  const [dropdown, setDropdown] = useState<DropdownInfo | null>(null);

  const isSearching = searchText.trim().length > 0;

  const sections = useMemo<GoalSection[]>(() => {
    const partner = PARTNER[currentUser];
    const query = searchText.trim().toLowerCase();

    const matchesSearch = (g: Goal) =>
      query === '' || g.name.toLowerCase().includes(query);

    const matchesOwner = (g: Goal) => {
      if (ownerFilter === 'both') return true;
      if (ownerFilter === 'mine') return g.type === 'joint' || g.uid === currentUser;
      // partner
      return g.type === 'joint' || g.uid === partner;
    };

    return [
      {
        title: 'Metas conjuntas',
        subtitle: 'Objetivos compartidos',
        data: payload.goals.filter(
          (g) => g.type === 'joint' && matchesOwner(g) && matchesSearch(g),
        ),
        readOnly: false,
      },
      {
        title: 'Mis metas',
        subtitle: USERS[currentUser].name,
        data: payload.goals.filter(
          (g) => g.type === 'personal' && g.uid === currentUser && matchesOwner(g) && matchesSearch(g),
        ),
        readOnly: false,
      },
      {
        title: 'Metas de pareja',
        subtitle: USERS[partner].name,
        data: payload.goals.filter(
          (g) => g.type === 'personal' && g.uid === partner && matchesOwner(g) && matchesSearch(g),
        ),
        readOnly: true,
      },
    ];
  }, [currentUser, ownerFilter, payload.goals, searchText]);

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
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        bounces={false}
        overScrollMode="never"
      >
        <SavingsPager saved={totals.saved} target={totals.target} currency={currency} />

        {/* ── Barra de búsqueda ── */}
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

        {/* ── Filtro de autor ── */}
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

        {/* ── Botón rápido ── */}
        <Pressable
          onPress={() => {
            const firstGoal = payload.goals[0];
            if (firstGoal) setContributeGoal(firstGoal);
            else setCreateOpen(true);
          }}
          style={({ pressed }) => [styles.savingsActionBtn, pressed && styles.savingsActionBtnPressed]}
        >
          <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
          <Text style={styles.savingsActionBtnText}>Agregar Ahorro</Text>
        </Pressable>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              </View>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>

            {section.data.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>No hay metas en esta seccion.</Text>
              </View>
            ) : (
              <View style={styles.cardStack}>
                {section.data.map((goal) => (
                  <GoalCard
                    key={String(goal.id)}
                    goal={goal}
                    contribs={payload.contribs}
                    readOnly={section.readOnly}
                    onPress={() => setSelectedGoal(goal)}
                    onContribute={() => setContributeGoal(goal)}
                    onEdit={() => setEditGoal(goal)}
                    onDelete={() => handleDelete(goal)}
                  />
                ))}
              </View>
            )}
          </View>
        ))}
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

      {dropdown && (
        <GoalDropdownOverlay info={dropdown} onClose={() => setDropdown(null)} />
      )}
    </View>
  );
}

const PAGER_WIDTH = Dimensions.get('window').width - 32; // 16px padding each side

function SavingsPager({
  saved,
  target,
  currency,
}: {
  saved: number;
  target: number;
  currency: CurrencyCode;
}) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setPage(Math.round(x / PAGER_WIDTH));
  };

  return (
    <View style={styles.pagerContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        decelerationRate="fast"
        snapToInterval={PAGER_WIDTH}
        snapToAlignment="start"
        style={{ width: PAGER_WIDTH }}
      >
        {/* Page 1: Total ahorrado */}
        <View style={[styles.pagerPage, { width: PAGER_WIDTH }]}>
          <Text style={styles.pagerLabel}>Este es el total de tus ahorros</Text>
          <Text style={[styles.pagerValue, styles.income]}>{fmt(saved, currency)}</Text>
          <Text style={styles.pagerHint}>Desliza para ver tu objetivo →</Text>
        </View>

        {/* Page 2: Total objetivo */}
        <View style={[styles.pagerPage, { width: PAGER_WIDTH }]}>
          <Text style={styles.pagerLabel}>Objetivo total</Text>
          <Text style={[styles.pagerValue, styles.expense]}>{fmt(target, currency)}</Text>
          <Text style={styles.pagerHint}>← Suma de todas tus metas</Text>
        </View>
      </ScrollView>

      {/* Pagination dots */}
      <View style={styles.pagerDots}>
        <View style={[styles.pagerDot, page === 0 && styles.pagerDotActive]} />
        <View style={[styles.pagerDot, page === 1 && styles.pagerDotActive]} />
      </View>
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
  if (!goal) return null;

  const currency = useAppStore((s) => s.currency);
  const goalContribs = contribs
    .filter((contrib) => String(contrib.gid) === String(goal.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const progress = goalProgress(goal, contribs);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPressIn={onClose}>
        <Pressable style={styles.modalCard} onPressIn={(event) => event.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{goal.name}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={APP_COLORS.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.detailSummary}>
            <DetailPill label="Ahorrado" value={fmt(progress.total, currency)} />
            <DetailPill label="Objetivo" value={fmt(goal.target, currency)} />
            <DetailPill label="Falta" value={fmt(progress.remaining, currency)} />
          </View>

          <Text style={styles.historyTitle}>Historial</Text>
          {goalContribs.length === 0 ? (
            <Text style={styles.emptyText}>Todavia no hay aportes.</Text>
          ) : (
            <View style={styles.historyList}>
              {goalContribs.map((contrib) => (
                <View key={String(contrib.id)} style={styles.historyRow}>
                  <View style={styles.historyText}>
                    <Text style={styles.historyAmount}>{fmt(contrib.amt, currency)}</Text>
                    <Text style={styles.historyMeta}>
                      {USERS[contrib.uid].name} · {formatDateShort(contrib.date)}
                    </Text>
                    {contrib.note ? <Text style={styles.historyNote}>{contrib.note}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPressIn={onClose}>
        <Pressable style={styles.modalCard} onPressIn={(event) => event.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={APP_COLORS.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.placeholderText}>{body}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── GoalFilterChip ──────────────────────────────────────────────────────────

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
        <Ionicons name={icon} size={14} color={isFiltered ? '#7C3AED' : APP_COLORS.textSecondary} />
        <Text style={[styles.filterChipText, isFiltered && styles.filterChipTextActive]}>
          {activeLabel}
        </Text>
        <Ionicons name="chevron-down" size={12} color={isFiltered ? '#7C3AED' : APP_COLORS.textMuted} />
      </Pressable>
    </View>
  );
}

// ─── GoalDropdownOverlay ──────────────────────────────────────────────────────

function GoalDropdownOverlay({ info, onClose }: { info: DropdownInfo; onClose: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

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

const styles = StyleSheet.create({
  cardStack: {
    gap: 10,
  },
  // ── Search ──
  searchWrap: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    padding: 0,
  },
  // ── Filters ──
  filtersBar: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChipWrapper: {},
  filterChip: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  filterChipText: {
    color: APP_COLORS.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#7C3AED',
  },
  pressed: {
    opacity: 0.7,
  },
  // ── Dropdown ──
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
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
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
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  dropdownOptionActive: {
    backgroundColor: '#F5F3FF',
  },
  dropdownOptionText: {
    color: APP_COLORS.textPrimary,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  dropdownOptionTextActive: {
    color: '#7C3AED',
    fontFamily: 'Inter_600SemiBold',
  },
  savingsActionBtn: {
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    elevation: 4,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  savingsActionBtnPressed: {
    opacity: 0.80,
    transform: [{ scale: 0.98 }],
  },
  savingsActionBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
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
    padding: 16,
    paddingBottom: 96,
  },
  detailPill: {
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 10,
  },
  detailPillLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  detailPillValue: {
    color: APP_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  detailSummary: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  emptySection: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: 16,
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  expense: {
    color: APP_COLORS.expense,
  },
  historyAmount: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  historyList: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  historyMeta: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  historyNote: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  historyRow: {
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  historyText: {
    gap: 3,
  },
  historyTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  income: {
    color: APP_COLORS.income,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 18,
    maxHeight: '82%',
    maxWidth: 560,
    padding: 18,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 19,
    fontWeight: '900',
  },
  placeholderText: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  screen: {
    backgroundColor: '#EDF2F6',
    flex: 1,
  },
  section: {
    gap: 10,
  },
  sectionCount: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionSubtitle: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  pagerContainer: {
    alignItems: 'center',
    gap: 10,
  },
  pagerDot: {
    backgroundColor: APP_COLORS.border,
    borderRadius: 4,
    height: 6,
    width: 6,
  },
  pagerDotActive: {
    backgroundColor: SAVINGS_ACCENT,
    width: 18,
  },
  pagerDots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  pagerHint: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  pagerLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  pagerPage: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  pagerValue: {
    color: APP_COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
});
