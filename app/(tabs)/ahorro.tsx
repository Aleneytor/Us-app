import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SavingsCard } from '../../components/SavingsCard';
import type { SavingsCardState } from '../../components/SavingsCard';
import { CATEGORIES } from '../../constants/categories';
import { APP_COLORS, getIconColor } from '../../constants/colors';
import { SavingPlanDetailModal } from '../../modals/SavingPlanDetailModal';
import { SavingPlanModal } from '../../modals/SavingPlanModal';
import { PARTNER, USERS } from '../../types';
import type { SavingPlan } from '../../types';
import { savingPlanProgress, savingPlanSavedAmount } from '../../utils/calculations';
import { fmt } from '../../utils/format';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';

type OwnerFilter = 'mine' | 'partner' | 'both';

const CARD_SUBTITLES: Record<SavingsCardState, { prefix: string; accent: string }> = {
  ahorrado: { prefix: 'Este es tu ', accent: 'ahorro total hoy' },
  objetivo: { prefix: 'Este es tu ', accent: 'objetivo total' },
};

const FILTER_OPTIONS: { label: string; value: OwnerFilter }[] = [
  { label: 'Ambos', value: 'both' },
  { label: 'Yo', value: 'mine' },
  { label: 'Pareja', value: 'partner' },
];

const SAVINGS_ACCENT = '#7C3AED';

export default function SavingsPreviewScreen() {
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const currency = useAppStore((s) => s.currency);
  const user = USERS[currentUser];

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [editPlanId, setEditPlanId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [savingsState, setSavingsState] = useState<SavingsCardState>('ahorrado');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('both');
  const [searchText, setSearchText] = useState('');

  const partner = PARTNER[currentUser];
  const subtitle = CARD_SUBTITLES[savingsState];
  const isSearching = searchText.trim().length > 0;

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

  const selectedPlan = useMemo(
    () => payload.savings.find((plan) => String(plan.id) === String(selectedPlanId)) ?? null,
    [payload.savings, selectedPlanId],
  );
  const selectedPlanReadOnly = !!selectedPlan
    && (selectedPlan.type ?? 'personal') === 'personal'
    && selectedPlan.uid !== currentUser;

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

  const ListHeader = (
    <>
      {/* ── Hero card ── */}
      <View style={styles.heroHeader}>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroGreeting}>¡Hola {user.name}!</Text>
          <Text style={styles.heroSubtitle}>
            {subtitle.prefix}
            <Text style={styles.heroHighlight}>{subtitle.accent}</Text>
          </Text>
        </View>
        <SavingsCard
          saved={savings.saved}
          target={savings.target}
          currency={currency}
          onStateChange={setSavingsState}
          onSwipeBegin={() => setScrollEnabled(false)}
          onSwipeEnd={() => setScrollEnabled(true)}
        />
      </View>

      {/* ── Search bar ── */}
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

      {/* ── Filter pills ── */}
      <View style={styles.filtersRow}>
        {FILTER_OPTIONS.map((opt) => {
          const active = ownerFilter === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setOwnerFilter(opt.value)}
              style={({ pressed }) => [
                styles.filterPill,
                active && styles.filterPillActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

    </>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredSavings}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        bounces={false}
        overScrollMode="never"
        scrollEnabled={scrollEnabled}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={36} color={APP_COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Sin ahorros</Text>
            <Text style={styles.emptySubtitle}>
              {isSearching
                ? 'No se encontraron ahorros con esa búsqueda.'
                : 'Aún no hay planes de ahorro para este filtro.'}
            </Text>
          </View>
        }
        renderItem={({ item: plan, index }) => (
          <SavingTileRow
            plan={plan}
            currency={currency}
            isFirst={index === 0}
            isLast={index === filteredSavings.length - 1}
            readOnly={
              (plan.type ?? 'personal') === 'personal' && plan.uid !== currentUser
            }
            onPress={() => setSelectedPlanId(plan.id)}
            onOpenLink={() => void openLink(plan)}
          />
        )}
      />

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
    </View>
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
  currency: string;
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
      {/* Icon */}
      <View style={[styles.tileIcon, { backgroundColor: iconColor.bg }]}>
        <Ionicons name={iconInfo.icon} size={22} color={iconColor.color} />
      </View>

      {/* Body */}
      <View style={styles.tileBody}>
        <View style={styles.tileTitleRow}>
          {plan.type === 'joint' && (
            <View style={styles.jointBadge}>
              <Ionicons name="people" size={10} color={SAVINGS_ACCENT} />
            </View>
          )}
          <Text numberOfLines={2} style={styles.tileTitle}>{plan.title}</Text>
          {plan.link && (
            <Pressable
              hitSlop={8}
              onPress={(e) => { e.stopPropagation(); onOpenLink(); }}
            >
              <Ionicons name="link-outline" size={15} color={SAVINGS_ACCENT} />
            </Pressable>
          )}
        </View>

        <View style={styles.tileProgressRow}>
          <Text style={styles.tileSavedSmall}>{fmt(progress.saved, currency)}</Text>
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
  content: {
    paddingBottom: 96,
  },
  // ── Hero ──
  heroHeader: {
    backgroundColor: APP_COLORS.surface,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 5,
    paddingBottom: 8,
    paddingTop: 56,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  heroGreeting: {
    color: '#303236',
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    lineHeight: 32,
  },
  heroHighlight: {
    color: '#7C3AED',
    fontWeight: '400',
  },
  heroSubtitle: {
    color: '#303236',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
  },
  heroTextWrap: {
    gap: 0,
    paddingHorizontal: 30,
    paddingBottom: 12,
  },
  // ── Search ──
  searchWrap: {
    alignItems: 'center',
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    marginTop: 22,
    paddingHorizontal: 16,
  },
  searchInput: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  // ── Filter pills ──
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 18,
  },
  filterPill: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    elevation: 2,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  filterPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
    elevation: 4,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.32,
  },
  filterPillText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
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
