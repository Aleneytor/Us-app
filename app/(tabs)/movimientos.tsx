import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  Animated,
  Alert,
  Easing,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  type TextStyle,
  View,
} from 'react-native';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import { ActivityTile } from '../../components/ActivityTile';
import { SearchBar } from '../../components/SearchBar';
import { TransactionModal } from '../../modals/TransactionModal';
import { UserHeaderButton } from '../../components/UserHeaderButton';
import { CATEGORIES } from '../../constants/categories';
import { type AppTheme } from '../../constants/colors';
import { SURFACE_SHADOW } from '../../constants/shadows';
import type { CurrencyCode, Transaction, UserData } from '../../types';
import { getTransactionAmountForMonth } from '../../utils/filters';
import { MONTHS_ES, fmt, splitAmount } from '../../utils/format';
import { MonthNavigator } from '../../components/MonthNavigator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useTabPadding } from '../../hooks/useTabPadding';
import { dismissKeyboardAndBlur } from '../../utils/keyboard';
import { getPartnerId, getUserData } from '../../utils/users';
import { buildActivityFeed } from '../../utils/activityFeed';
import type { ActivityItem } from '../../utils/activityFeed';
import { reportFabScroll } from '../../utils/fabScroll';
import { useTheme } from '../../contexts/ThemeContext';

const HERO_THRESHOLD = 170;

type HeroPalette = { base: string; soft: string; bright: string; glow: string; deep: string; shade: string; veil: string };

const PURPLE_BASE_PALETTE: HeroPalette = {
  base: '#5B21B6', soft: '#8B5CF6', bright: '#A78BFA', glow: '#C4B5FD', deep: '#3B0764', shade: '#4C1D95', veil: '#7C3AED',
};
const PURPLE_SHIFT_PALETTE: HeroPalette = {
  base: '#4C1D95', soft: '#7C3AED', bright: '#9061F9', glow: '#B89AF8', deep: '#2E0070', shade: '#3D1882', veil: '#6D28D9',
};

type KindFilter = 'all' | 'expense' | 'income';
type OwnerFilter = 'mine' | 'partner' | 'both';

interface Option<T extends string> {
  label: string;
  value: T;
}

type SingleDropdownInfo = {
  type: 'single';
  x: number;
  y: number;
  width: number;
  options: Array<Option<string>>;
  value: string;
  onChange: (v: string) => void;
};

type CategoryDropdownInfo = {
  type: 'category';
  x: number;
  y: number;
  width: number;
  options: Array<Option<string>>;
  selectedValues: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
};

type DropdownInfo = SingleDropdownInfo | CategoryDropdownInfo;

export default function MovimientosScreen() {
  const tabPadding = useTabPadding();
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const setSelectedYM = useAppStore((s) => s.setSelectedYM);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const currency = useAppStore((s) => s.currency);
  const users = useAppStore((s) => s.users);
  const partnerForUser = useAppStore((s) => s.partnerForUser);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('both');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [dropdown, setDropdown] = useState<DropdownInfo | null>(null);
  const [monthPickerY, setMonthPickerY] = useState<number | null>(null);
  const [showFloating, setShowFloating] = useState(false);
  const scrolledPastHeroRef = useRef(false);
  const isSearchingRef = useRef(false);
  const user = getUserData(users, currentUser);
  const partner = getPartnerId(partnerForUser, currentUser);
  const partnerUser = users[partner];
  const monthName = MONTHS_ES[Number(selectedYM.slice(5, 7)) - 1].toLowerCase();

  const isSearching = searchText.trim().length > 0;

  const headerAnim = useRef(new Animated.Value(1)).current;
  const { heroAnim, contentAnim } = useEntranceAnimation();

  const categoryOptions = useMemo<Array<Option<string>>>(() => {
    const keys = Array.from(
      new Set(payload.expenses.filter((t) => !t.del).map((t) => t.cat).filter(Boolean)),
    );

    return keys
      .map((key) => ({
        value: key,
        label: CATEGORIES[key]?.label ?? key,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [payload.expenses]);

  const toggleCategoryFilter = (value: string) => {
    setCategoryFilter((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    ));
  };

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: isSearching ? 0 : 1,
      duration: isSearching ? 210 : 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [headerAnim, isSearching]);

  useEffect(() => {
    isSearchingRef.current = isSearching;
    setShowFloating(isSearching || scrolledPastHeroRef.current);
  }, [isSearching]);

  const filtered = useMemo<ActivityItem[]>(() => {
    const query = searchText.trim().toLowerCase();
    const activities = buildActivityFeed(payload, {
      currentUser,
      selectedYM,
      includeAllMonths: query !== '',
    });

    return activities
      .filter((item) => {
        const targetOwner = ownerFilter === 'mine' ? currentUser : partner;
        const ownerMatches =
          ownerFilter === 'both' ||
          item.ownerId === targetOwner;
        const categoryMatches = categoryFilter.length === 0 ||
          (item.source === 'transaction' && categoryFilter.includes(item.categoryKey ?? ''));
        const kindMatches = kindFilter === 'all' || item.kind === kindFilter;
        const searchMatches = query === '' || item.searchText.includes(query);

        return ownerMatches && categoryMatches && kindMatches && searchMatches;
      })
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        return byDate !== 0 ? byDate : b.sortId - a.sortId;
      });
  }, [categoryFilter, currentUser, kindFilter, ownerFilter, partner, payload, searchText, selectedYM]);

  const totals = useMemo(() => {
    const expenses = filtered
      .filter((item) => item.kind === 'expense')
      .reduce((sum, item) => {
        if (item.source === 'transaction') {
          return sum + getTransactionAmountForMonth(item.transaction, selectedYM);
        }
        if (item.source === 'plan_expense') {
          return sum + item.amount;
        }
        return sum;
      }, 0);
    const income = filtered
      .filter((item) => item.kind === 'income')
      .reduce((sum, item) => (
        sum + (item.source === 'transaction'
          ? getTransactionAmountForMonth(item.transaction, selectedYM)
          : 0)
      ), 0);
    return { expenses, income, balance: income - expenses };
  }, [filtered, selectedYM]);

  const listAnimationKey = useMemo(
    () => [
      selectedYM,
      kindFilter,
      ownerFilter,
      categoryFilter.join(','),
      searchText.trim().toLowerCase(),
      filtered.map((t) => t.id).join(','),
    ].join('|'),
    [categoryFilter, filtered, kindFilter, ownerFilter, searchText, selectedYM],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  const handleScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = event.nativeEvent.contentOffset.y;
    reportFabScroll(y);
    const past = y > HERO_THRESHOLD;
    if (past !== scrolledPastHeroRef.current) {
      scrolledPastHeroRef.current = past;
      setShowFloating(past || isSearchingRef.current);
    }
  };

  const openEdit = (transaction: Transaction) => {
    setEditTransaction(transaction);
    setSelectedTransaction(null);
  };

  const confirmDelete = (transaction: Transaction) => {
    Alert.alert(
      'Eliminar movimiento',
      transaction.desc || 'Este movimiento se ocultara para todos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteTransaction(transaction.id);
            setSelectedTransaction(null);
          },
        },
      ],
    );
  };

  const showActions = (transaction: Transaction) => {
    Alert.alert(
      transaction.desc || 'Movimiento',
      'Elige una acción',
      [
        { text: 'Editar', onPress: () => openEdit(transaction) },
        { text: 'Eliminar', style: 'destructive', onPress: () => confirmDelete(transaction) },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };


  return (
    <View style={styles.screen}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        extraData={listAnimationKey}
        bounces={false}
        overScrollMode="never"
        onScroll={handleScroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={dismissKeyboardAndBlur}
        scrollEventThrottle={60}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          <>
            <Animated.View style={{ opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
              <Animated.View
                style={{
                  maxHeight: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 300],
                  }),
                  opacity: headerAnim.interpolate({
                    inputRange: [0, 0.45, 1],
                    outputRange: [0, 0, 1],
                  }),
                  overflow: 'hidden',
                }}
              >
                <View style={styles.heroHeader}>
                <HeroGradient />
                <View style={styles.heroTop}>
                  <View style={styles.heroTextWrap}>
                    <Text style={styles.heroGreeting}>¡Hola {user.name}!</Text>
                    <Text style={styles.heroSubtitle}>
                      Este son todos tus movimientos{'\n'}
                      y saldos del <Text style={styles.heroMonth}>Mes de {monthName}</Text>
                    </Text>
                  </View>
                  <UserHeaderButton variant="light" tintColor="#A78BFA" />
                </View>

                <HeroSummary
                  kindFilter={kindFilter}
                  income={totals.income}
                  expenses={totals.expenses}
                  balance={totals.balance}
                  currency={currency}
                />
              </View>
              </Animated.View>
            </Animated.View>

            <Animated.View style={[styles.controls, { opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
              <MonthNavigator ym={selectedYM} onChange={setSelectedYM} onOpen={setMonthPickerY} />

              <SearchBar
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Buscar movimiento"
              />
              {isSearching && (
                <Text style={styles.searchAllMonthsHint}>
                  Buscando en todos los meses
                </Text>
              )}

              <View style={styles.filterSectionHead}>
                <Text style={styles.filterSectionTitle}>Movimientos</Text>
                <Text style={styles.filterSectionSubtitle}>Toca los filtros para explorar</Text>
              </View>

              <View style={styles.filtersBar}>
                <CategoryFilterChip
                  selectedValues={categoryFilter}
                  options={categoryOptions}
                  onToggle={toggleCategoryFilter}
                  onClear={() => setCategoryFilter([])}
                  onOpen={setDropdown}
                />
                <FilterChip
                  label="Autor"
                  options={[
                    { label: 'Ambos', value: 'both' },
                    { label: 'Yo', value: 'mine' },
                    { label: partnerUser ? partnerUser.name : 'Pareja', value: 'partner' },
                  ]}
                  value={ownerFilter}
                  onChange={setOwnerFilter}
                  customIcon={(isFiltered) => (
                    <AutorFilterIcon
                      value={ownerFilter}
                      user={user}
                      partnerUser={partnerUser}
                      isFiltered={isFiltered}
                    />
                  )}
                />
                <FilterChip
                  icon="swap-vertical-outline"
                  label="Tipo"
                  options={[
                    { label: 'Todos', value: 'all' },
                    { label: 'Gastos', value: 'expense' },
                    { label: 'Ingresos', value: 'income' },
                  ]}
                  value={kindFilter}
                  onChange={setKindFilter}
                  activeColor={kindFilter === 'income' ? theme.income : kindFilter === 'expense' ? theme.expense : undefined}
                />
              </View>
            </Animated.View>

            <View style={styles.filterSection} />
          </>
        }
        ListEmptyComponent={
          <AnimatedEmptyState animationKey={listAnimationKey} />
        }
        ListFooterComponent={
          <View style={[styles.movementsSectionFooter, { height: tabPadding + 16 }]} />
        }
        renderItem={({ item, index }) => (
          <HistoryActivityItem
            activity={item}
            ym={selectedYM}
            index={index}
            animationKey={listAnimationKey}
            onPress={() => {
              if (item.source === 'transaction') setSelectedTransaction(item.transaction);
            }}
            onLongPress={() => {
              if (item.source === 'transaction') showActions(item.transaction);
            }}
          />
        )}
      />

      <TransactionDetailModal
        transaction={selectedTransaction}
        ym={selectedYM}
        onClose={() => setSelectedTransaction(null)}
        onEdit={openEdit}
        onDelete={confirmDelete}
      />

      <TransactionModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <TransactionModal
        visible={!!editTransaction}
        transaction={editTransaction}
        onClose={() => setEditTransaction(null)}
      />

      {dropdown && (
        <DropdownOverlay info={dropdown} onClose={() => setDropdown(null)} />
      )}
      {monthPickerY !== null && (
        <MonthPickerDropdown
          anchorY={monthPickerY}
          ym={selectedYM}
          onChange={(ym) => { setSelectedYM(ym); setMonthPickerY(null); }}
          onClose={() => setMonthPickerY(null)}
        />
      )}
      <FloatingSummaryBar
        visible={showFloating}
        income={totals.income}
        expenses={totals.expenses}
        currency={currency}
      />
    </View>
  );
}


function FilterChip<T extends string>({
  icon,
  label,
  options,
  value,
  onChange,
  customIcon,
  activeColor,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  options: Array<Option<T>>;
  value: T;
  onChange: (value: T) => void;
  customIcon?: (isFiltered: boolean) => React.ReactNode;
  activeColor?: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const activeLabel = options.find((o) => o.value === value)?.label ?? label;
  const isFiltered = value !== options[0].value;
  const chipActiveColor = activeColor ?? '#7C3AED';

  const handlePress = () => {
    void Haptics.selectionAsync();
    const currentIndex = options.findIndex((o) => o.value === value);
    onChange(options[(currentIndex + 1) % options.length].value);
  };

  return (
    <View style={[
      styles.filterChipWrapper,
      isFiltered && { backgroundColor: chipActiveColor, borderColor: chipActiveColor }
    ]}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.filterChip,
          pressed && styles.pressed
        ]}
      >
        {customIcon ? (
          customIcon(isFiltered)
        ) : (
          icon && <Ionicons name={icon} size={14} color={isFiltered ? '#FFFFFF' : theme.textSecondary} />
        )}
        <Text style={[styles.filterChipText, isFiltered && styles.filterChipTextActive]}>
          {activeLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function CategoryFilterChip({
  selectedValues,
  options,
  onToggle,
  onClear,
  onOpen,
}: {
  selectedValues: string[];
  options: Array<Option<string>>;
  onToggle: (value: string) => void;
  onClear: () => void;
  onOpen: (info: DropdownInfo) => void;
}) {
  const chipRef = useRef<View>(null);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isFiltered = selectedValues.length > 0;
  const label = selectedValues.length === 0
    ? 'Todas'
    : selectedValues.length === 1
      ? (options.find((o) => o.value === selectedValues[0])?.label ?? 'Categoría')
      : `${selectedValues.length} categorías`;

  const handlePress = () => {
    void Haptics.selectionAsync();
    chipRef.current?.measure((_, __, width, height, pageX, pageY) => {
      onOpen({
        type: 'category',
        x: pageX,
        y: pageY + height + 6,
        width,
        options,
        selectedValues,
        onToggle,
        onClear,
      });
    });
  };

  return (
    <View
      ref={chipRef}
      style={[
        styles.filterChipWrapper,
        styles.filterChipWrapperCategory,
        isFiltered && { backgroundColor: '#7C3AED', borderColor: '#7C3AED' }
      ]}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.filterChip,
          pressed && styles.pressed
        ]}
      >
        <Ionicons name="pie-chart-outline" size={14} color={isFiltered ? '#FFFFFF' : theme.textSecondary} />
        <Text style={[styles.filterChipText, isFiltered && styles.filterChipTextActive]} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={12} color={isFiltered ? '#FFFFFF' : theme.textMuted} />
      </Pressable>
    </View>
  );
}

function AutorFilterIcon({
  value,
  user,
  partnerUser,
  isFiltered,
}: {
  value: OwnerFilter;
  user: UserData;
  partnerUser?: UserData;
  isFiltered: boolean;
}) {
  const borderColor = isFiltered ? '#7C3AED' : '#FFFFFF';

  if (value === 'mine') {
    return (
      <View style={[AVATAR_STYLES.avatarCircle, { backgroundColor: user.bg, borderColor }]}>
        {user.photo ? (
          <Image source={user.photo} style={AVATAR_STYLES.avatarImage} />
        ) : (
          <Text style={[AVATAR_STYLES.avatarInitials, { color: user.color }]}>
            {user.initials}
          </Text>
        )}
      </View>
    );
  }

  if (value === 'partner') {
    const pUser = partnerUser || { bg: '#EDE9FE', color: '#7C3AED', initials: 'P' } as UserData;
    return (
      <View style={[AVATAR_STYLES.avatarCircle, { backgroundColor: pUser.bg, borderColor }]}>
        {pUser.photo ? (
          <Image source={pUser.photo} style={AVATAR_STYLES.avatarImage} />
        ) : (
          <Text style={[AVATAR_STYLES.avatarInitials, { color: pUser.color }]}>
            {pUser.initials}
          </Text>
        )}
      </View>
    );
  }

  // 'both'
  const pUser = partnerUser || { bg: '#EDE9FE', color: '#7C3AED', initials: 'P' } as UserData;
  return (
    <View style={AVATAR_STYLES.bothAvatarsContainer}>
      <View style={[AVATAR_STYLES.bothAvatarLeft, { backgroundColor: user.bg, borderColor }]}>
        {user.photo ? (
          <Image source={user.photo} style={AVATAR_STYLES.bothAvatarImage} />
        ) : (
          <Text style={[AVATAR_STYLES.bothAvatarInitials, { color: user.color }]}>
            {user.initials}
          </Text>
        )}
      </View>
      <View style={[AVATAR_STYLES.bothAvatarRight, { backgroundColor: pUser.bg, borderColor }]}>
        {pUser.photo ? (
          <Image source={pUser.photo} style={AVATAR_STYLES.bothAvatarImage} />
        ) : (
          <Text style={[AVATAR_STYLES.bothAvatarInitials, { color: pUser.color }]}>
            {pUser.initials}
          </Text>
        )}
      </View>
    </View>
  );
}

function DropdownOverlay({ info, onClose }: { info: DropdownInfo; onClose: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [localSelected, setLocalSelected] = useState(
    info.type === 'category' ? info.selectedValues : [],
  );

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

  const dropdownWidth = info.type === 'category' ? Math.max(info.width, 128) : Math.max(info.width, 120);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => animateClose()}>
      <Animated.View
        style={[
          styles.dropdownCard,
          {
            left: info.x,
            top: info.y,
            width: dropdownWidth,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
          },
        ]}
      >
        <View style={styles.dropdownInner}>
          {info.type === 'single' ? (
            info.options.map((opt, i) => {
              const active = opt.value === info.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    animateClose(() => info.onChange(opt.value));
                  }}
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
            })
          ) : (
            <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setLocalSelected([]);
                  info.onClear();
                }}
                style={({ pressed }) => [
                  styles.dropdownOption,
                  localSelected.length === 0 && styles.dropdownOptionActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    localSelected.length === 0 && styles.dropdownOptionTextActive,
                  ]}
                >
                  Todas
                </Text>
                {localSelected.length === 0 && <Ionicons name="checkmark" size={15} color="#7C3AED" />}
              </Pressable>
              {info.options.map((opt) => {
                const active = localSelected.includes(opt.value);
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setLocalSelected((current) => (
                        current.includes(opt.value)
                          ? current.filter((item) => item !== opt.value)
                          : [...current, opt.value]
                      ));
                      info.onToggle(opt.value);
                    }}
                    style={({ pressed }) => [
                      styles.dropdownOption,
                      styles.dropdownOptionBorder,
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
            </ScrollView>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

function AnimatedEmptyState({ animationKey }: { animationKey: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 440,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, animationKey]);

  return (
    <Animated.View
      style={[
        styles.empty,
        styles.movementsSectionEmpty,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Ionicons name="receipt-outline" size={34} color={theme.textMuted} />
      <Text style={styles.emptyTitle}>Sin movimientos</Text>
      <Text style={styles.emptyText}>Ajusta los filtros o cambia de mes.</Text>
    </Animated.View>
  );
}

function HistoryActivityItem({
  activity,
  ym,
  index,
  animationKey,
  onPress,
  onLongPress,
}: {
  activity: ActivityItem;
  ym: string;
  index: number;
  animationKey: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    anim.setValue(0);
    const delay = Math.min(index, 8) * 12;
    const timer = setTimeout(() => {
      animation = Animated.timing(anim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start();
    }, delay);

    return () => {
      clearTimeout(timer);
      animation?.stop();
    };
  }, [anim, animationKey, index]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [index % 2 === 0 ? 4 : -4, 0],
  });

  return (
    <Animated.View style={[TRANSACTION_CARD_STYLE.transactionCard, { opacity: anim, transform: [{ translateY }] }]}>
      <ActivityTile
        activity={activity}
        ym={ym}
        onPress={onPress}
        onLongPress={onLongPress}
      />
    </Animated.View>
  );
}

function HeroSummary({
  kindFilter,
  income,
  expenses,
  balance,
  currency,
}: {
  kindFilter: KindFilter;
  income: number;
  expenses: number;
  balance: number;
  currency: CurrencyCode;
}) {
  const filterAnim = useRef(new Animated.Value(kindFilter === 'all' ? 0 : 1)).current;
  const selectedSummary = kindFilter === 'income'
    ? { label: 'Ingresos', value: income }
    : { label: 'Gastos', value: expenses };

  useEffect(() => {
    Animated.timing(filterAnim, {
      toValue: kindFilter === 'all' ? 0 : 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [filterAnim, kindFilter]);

  const allOpacity = filterAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const allTranslateY = filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });
  const singleOpacity = filterAnim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0, 1] });
  const singleTranslateY = filterAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <View style={HERO_STYLES.heroSummaryFrame}>
      <Animated.View
        pointerEvents={kindFilter === 'all' ? 'auto' : 'none'}
        style={[
          HERO_STYLES.heroSummaryLayer,
          HERO_STYLES.heroSummary,
          {
            opacity: allOpacity,
            transform: [{ translateY: allTranslateY }],
          },
        ]}
      >
        <HeroSummaryCell label="Ingresos" value={income} currency={currency} />
        <View style={HERO_STYLES.heroDivider} />
        <HeroSummaryCell label="Gastos" value={expenses} currency={currency} />
        <View style={HERO_STYLES.heroDivider} />
        <HeroSummaryCell label="Balance" value={balance} currency={currency} />
      </Animated.View>
      <Animated.View
        pointerEvents={kindFilter === 'all' ? 'none' : 'auto'}
        style={[
          HERO_STYLES.heroSummaryLayer,
          HERO_STYLES.heroSummarySingle,
          {
            opacity: singleOpacity,
            transform: [{ translateY: singleTranslateY }],
          },
        ]}
      >
        <HeroSummaryCell label={selectedSummary.label} value={selectedSummary.value} currency={currency} single />
      </Animated.View>
    </View>
  );
}

function HeroSummaryCell({
  label,
  value,
  currency,
  single = false,
}: {
  label: string;
  value: number;
  currency: Parameters<typeof splitAmount>[1];
  single?: boolean;
}) {
  return (
    <View style={[HERO_STYLES.heroSummaryCell, single && HERO_STYLES.heroSummaryCellSingle]}>
      <Text style={HERO_STYLES.heroSummaryLabel}>{label}</Text>
      <SlotAmount value={value} currency={currency} toneStyle={HERO_STYLES.heroSummaryValueWhite} />
    </View>
  );
}

function SlotAmount({
  value,
  currency,
  toneStyle,
}: {
  value: number;
  currency: Parameters<typeof splitAmount>[1];
  toneStyle: StyleProp<TextStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const previousValue = useRef(0);
  const direction = useRef(1);
  const hasMounted = useRef(false);
  const [displayValues, setDisplayValues] = useState({ from: 0, to: value });

  useEffect(() => {
    const from = hasMounted.current ? previousValue.current : 0;
    if (hasMounted.current && Object.is(from, value)) return;

    let cancelled = false;
    progress.stopAnimation();
    direction.current = value >= from ? 1 : -1;
    setDisplayValues({ from, to: value });
    progress.setValue(0);

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished && !cancelled) {
        previousValue.current = value;
        hasMounted.current = true;
        setDisplayValues({ from: value, to: value });
        progress.setValue(1);
      }
    });

    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [progress, value]);

  const fromAmount = splitAmount(displayValues.from, currency);
  const toAmount = splitAmount(displayValues.to, currency);
  const distance = 34;
  const enteringTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [direction.current * distance, 0],
  });
  const exitingTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -direction.current * distance],
  });
  const enteringOpacity = progress.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0, 1, 1],
  });
  const exitingOpacity = progress.interpolate({
    inputRange: [0, 0.82, 1],
    outputRange: [1, 0.16, 0],
  });
  const isChanging = !Object.is(displayValues.from, displayValues.to);

  return (
    <View style={HERO_STYLES.heroSummaryValueClip}>
      {isChanging && (
        <Animated.Text
          style={[
            HERO_STYLES.heroSummaryValue,
            toneStyle,
            HERO_STYLES.heroSummaryValueLayer,
            { opacity: exitingOpacity, transform: [{ translateY: exitingTranslateY }] },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {fromAmount.whole}
          <Text style={HERO_STYLES.heroSummaryDecimals}>,{fromAmount.decimals} {fromAmount.symbol}</Text>
        </Animated.Text>
      )}
      <Animated.Text
        style={[
          HERO_STYLES.heroSummaryValue,
          toneStyle,
          HERO_STYLES.heroSummaryValueLayer,
          { opacity: isChanging ? enteringOpacity : 1, transform: [{ translateY: isChanging ? enteringTranslateY : 0 }] },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {toAmount.whole}
        <Text style={HERO_STYLES.heroSummaryDecimals}>,{toAmount.decimals} {toAmount.symbol}</Text>
      </Animated.Text>
    </View>
  );
}

function FloatingSummaryBar({
  visible,
  income,
  expenses,
  currency,
}: {
  visible: boolean;
  income: number;
  expenses: number;
  currency: CurrencyCode;
}) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.floatingSummary,
        {
          paddingTop: insets.top + 8,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-72, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.floatingSummaryRow}>
        <View style={styles.floatingSummaryCell}>
          <Text style={styles.floatingSummaryLabel}>Ingresos</Text>
          <Text style={[styles.floatingSummaryValue, styles.income]}>{fmt(income, currency)}</Text>
        </View>
        <View style={styles.floatingSummaryDivider} />
        <View style={styles.floatingSummaryCell}>
          <Text style={styles.floatingSummaryLabel}>Gastos</Text>
          <Text style={[styles.floatingSummaryValue, styles.expense]}>{fmt(expenses, currency)}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function MonthPickerDropdown({
  anchorY,
  ym,
  onChange,
  onClose,
}: {
  anchorY: number;
  ym: string;
  onChange: (ym: string) => void;
  onClose: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  const [pickerYear, setPickerYear] = useState(year);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 300,
      mass: 0.8,
    }).start();
  }, [anim]);

  const close = (then?: () => void) => {
    Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      then?.();
      onClose();
    });
  };

  return (
    <Pressable style={[StyleSheet.absoluteFill, { zIndex: 100 }]} onPress={() => close()}>
      <Animated.View
        style={[
          styles.monthDropdownCard,
          {
            top: anchorY + 8,
            opacity: anim,
            transform: [
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
            ],
          },
        ]}
      >
        <Pressable onPress={() => {}} style={styles.monthDropdownInner}>
          <View style={styles.monthDropdownYearRow}>
            <Pressable
              onPress={() => setPickerYear((y) => y - 1)}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
            </Pressable>
            <Text style={styles.pickerYearText}>{pickerYear}</Text>
            <Pressable
              onPress={() => setPickerYear((y) => y + 1)}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.pickerGrid}>
            {MONTHS_ES.map((name, idx) => {
              const m = idx + 1;
              const isActive = pickerYear === year && m === month;
              return (
                <Pressable
                  key={m}
                  onPress={() => close(() => onChange(`${pickerYear}-${String(m).padStart(2, '0')}`))}
                  style={({ pressed }) => [
                    styles.pickerCell,
                    isActive && styles.pickerCellActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.pickerCellText, isActive && styles.pickerCellTextActive]}>
                    {name.slice(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

function HeroGradient() {
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

  const shiftLayerStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.38] }),
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-8, 10] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [8, -6] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
    ],
  };

  return (
    <View pointerEvents="none" style={HERO_CANVAS.heroGradientCanvas}>
      <HeroPurpleSvg palette={PURPLE_BASE_PALETTE} idPrefix="mov-base" />
      <Animated.View style={[StyleSheet.absoluteFill, shiftLayerStyle]}>
        <HeroPurpleSvg palette={PURPLE_SHIFT_PALETTE} idPrefix="mov-shift" />
      </Animated.View>
    </View>
  );
}

function HeroPurpleSvg({ palette, idPrefix }: { palette: HeroPalette; idPrefix: string }) {
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

// Static stylesheets for components with no theme-sensitive colors

const HERO_CANVAS = StyleSheet.create({
  heroGradientCanvas: {
    bottom: -36,
    left: -28,
    position: 'absolute',
    right: -28,
    top: -18,
  },
});

const AVATAR_STYLES = StyleSheet.create({
  avatarCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 9,
  },
  avatarInitials: {
    fontSize: 8,
    fontWeight: '800',
  },
  bothAvatarsContainer: {
    width: 26,
    height: 18,
    position: 'relative',
  },
  bothAvatarLeft: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    overflow: 'hidden',
    position: 'absolute',
    left: 0,
    top: 1,
    zIndex: 1,
  },
  bothAvatarRight: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    overflow: 'hidden',
    position: 'absolute',
    left: 10,
    top: 1,
    zIndex: 2,
  },
  bothAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  bothAvatarInitials: {
    fontSize: 7,
    fontWeight: '800',
  },
});

const TRANSACTION_CARD_STYLE = StyleSheet.create({
  transactionCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
});

// Hero summary styles — all hardcoded to gradient area colors
const HERO_STYLES = StyleSheet.create({
  heroDivider: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    height: 36,
    width: 1,
  },
  heroSummaryFrame: {
    alignSelf: 'stretch',
    height: 66,
    marginTop: 36,
    overflow: 'visible',
    position: 'relative',
    width: '100%',
  },
  heroSummaryLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  heroSummarySingle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  heroSummaryCell: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minWidth: 0,
  },
  heroSummaryCellSingle: {
    maxWidth: 260,
    width: '100%',
  },
  heroSummaryDecimals: {
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    letterSpacing: -0.75,
  },
  heroSummaryLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroSummaryValue: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 28,
    letterSpacing: -1.4,
    lineHeight: 32,
  },
  heroSummaryValueWhite: {
    color: '#FFFFFF',
  },
  heroSummaryValueClip: {
    alignItems: 'center',
    alignSelf: 'stretch',
    height: 38,
    justifyContent: 'center',
    overflow: 'hidden',
    minWidth: 0,
    width: '100%',
  },
  heroSummaryValueLayer: {
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyText: {
    color: t.textSecondary,
    fontSize: 13,
  },
  emptyTitle: {
    color: t.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  expense: {
    color: t.expense,
  },
  searchAllMonthsHint: {
    color: t.textMuted,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  filtersBar: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChipWrapper: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  filterChipWrapperCategory: {
    flex: 1.8,
  },
  filterChip: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  filterChipText: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dropdownCard: {
    borderRadius: 14,
    elevation: 5,
    position: 'absolute',
    shadowColor: t.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  dropdownInner: {
    backgroundColor: t.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 320,
  },
  dropdownOption: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
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
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownOptionTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  controls: {
    gap: 18,
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 22,
    zIndex: 1,
  },
  balanceColor: {
    color: '#7C3AED',
  },
  income: {
    color: t.income,
  },
  listContent: {
    backgroundColor: t.background,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  movementsSectionEmpty: {
    minHeight: 220,
    paddingTop: 32,
  },
  movementsSectionFooter: {
    height: 0,
  },
  filterSection: {
    height: 16,
  },
  filterSectionHead: {
    gap: 2,
    marginTop: 8,
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
  pressed: {
    opacity: 0.72,
  },
  screen: {
    backgroundColor: t.background,
    flex: 1,
  },
  heroHeader: {
    backgroundColor: '#5B21B6',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 5,
    overflow: 'hidden',
    paddingBottom: 28,
    paddingHorizontal: 32,
    paddingTop: 56,
    shadowColor: '#3B0764',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
  },
  heroGreeting: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    lineHeight: 32,
  },
  heroMonth: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  heroSubtitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
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
  },
  secondaryAction: {
    alignItems: 'center',
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  secondaryActionText: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  pickerYearText: {
    color: t.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerCell: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    paddingVertical: 12,
    width: '30%',
  },
  pickerCellActive: {
    backgroundColor: '#7C3AED',
  },
  pickerCellText: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  pickerCellTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
    ...SURFACE_SHADOW,
  },
  floatingSummary: {
    backgroundColor: t.surface,
    borderBottomColor: t.border,
    borderBottomWidth: 1,
    elevation: 10,
    left: 0,
    paddingBottom: 12,
    paddingHorizontal: 32,
    position: 'absolute',
    right: 0,
    shadowColor: t.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    top: 0,
    zIndex: 10,
  },
  floatingSummaryCell: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  floatingSummaryDivider: {
    backgroundColor: t.border,
    height: 32,
    width: 1,
  },
  floatingSummaryLabel: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  floatingSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  floatingSummaryValue: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
  },
  monthDropdownCard: {
    backgroundColor: t.surface,
    borderRadius: 20,
    left: 16,
    position: 'absolute',
    right: 16,
    ...SURFACE_SHADOW,
  },
  monthDropdownInner: {
    padding: 20,
  },
  monthDropdownYearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
});
