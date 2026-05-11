import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  type TextStyle,
  TextInput,
  View,
} from 'react-native';
import { TransactionDetailModal } from '../../components/TransactionDetailModal';
import { TransactionTile } from '../../components/TransactionTile';
import { TransactionModal } from '../../modals/TransactionModal';
import { UserHeaderButton } from '../../components/UserHeaderButton';
import { CATEGORIES } from '../../constants/categories';
import { APP_COLORS } from '../../constants/colors';
import type { CurrencyCode, Transaction } from '../../types';
import { isMonthVisible } from '../../utils/filters';
import { MONTHS_ES, fmt, splitAmount } from '../../utils/format';
import { MonthNavigator } from '../../components/MonthNavigator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';
import { dismissKeyboardAndBlur } from '../../utils/keyboard';
import { getPartnerId, getUserData } from '../../utils/users';

const HERO_THRESHOLD = 170;

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
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const selectedYM = useAppStore((s) => s.selectedYM);
  const setSelectedYM = useAppStore((s) => s.setSelectedYM);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);
  const currency = useAppStore((s) => s.currency);
  const users = useAppStore((s) => s.users);
  const partnerForUser = useAppStore((s) => s.partnerForUser);

  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('both');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [dropdown, setDropdown] = useState<DropdownInfo | null>(null);
  const [showFloating, setShowFloating] = useState(false);
  const scrolledPastHeroRef = useRef(false);
  const isSearchingRef = useRef(false);
  const user = getUserData(users, currentUser);
  const partner = getPartnerId(partnerForUser, currentUser);
  const monthName = MONTHS_ES[Number(selectedYM.slice(5, 7)) - 1].toLowerCase();

  const isSearching = searchText.trim().length > 0;

  const headerAnim = useRef(new Animated.Value(1)).current;

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

  const filtered = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return payload.expenses
      .filter((t) => {
        const ownerMatches =
          ownerFilter === 'both' ||
          t.uid === (ownerFilter === 'mine' ? currentUser : partner);
        const categoryMatches = categoryFilter.length === 0 || categoryFilter.includes(t.cat);
        const searchable = `${t.desc ?? ''} ${t.account ?? ''} ${t.notes ?? ''} ${(t.tags ?? []).join(' ')}`.toLowerCase();

        if (query !== '') {
          return (
            !t.del &&
            ownerMatches &&
            (kindFilter === 'all' || t.kind === kindFilter) &&
            categoryMatches &&
            searchable.includes(query)
          );
        }

        return (
          !t.del &&
          isMonthVisible(t, selectedYM) &&
          ownerMatches &&
          (kindFilter === 'all' || t.kind === kindFilter) &&
          categoryMatches
        );
      })
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        return byDate !== 0 ? byDate : Number(b.id) - Number(a.id);
      });
  }, [categoryFilter, currentUser, kindFilter, ownerFilter, partner, payload.expenses, searchText, selectedYM]);

  const totals = useMemo(() => {
    const expenses = filtered
      .filter((t) => t.kind === 'expense')
      .reduce((sum, t) => sum + t.amt, 0);
    const income = filtered
      .filter((t) => t.kind === 'income')
      .reduce((sum, t) => sum + t.amt, 0);
    return { expenses, income, balance: income - expenses };
  }, [filtered]);

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
      'Elige una accion',
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
                <View style={styles.heroTop}>
                  <View style={styles.heroTextWrap}>
                    <Text style={styles.heroGreeting}>¡Hola {user.name}!</Text>
                    <Text style={styles.heroSubtitle}>
                      Este son todos tus movimientos{'\n'}
                      y saldos del <Text style={styles.heroMonth}>Mes de {monthName}</Text>
                    </Text>
                  </View>
                  <UserHeaderButton />
                </View>

                <View style={styles.heroSummary}>
                  <HeroSummaryCell label="Ingresos" value={totals.income} currency={currency} tone="income" />
                  <View style={styles.heroDivider} />
                  <HeroSummaryCell label="Gastos" value={totals.expenses} currency={currency} tone="expense" />
                  <View style={styles.heroDivider} />
                  <HeroSummaryCell label="Balance" value={totals.balance} currency={currency} tone="balance" />
                </View>
              </View>
            </Animated.View>

            <View style={styles.controls}>
              <MonthNavigator ym={selectedYM} onChange={setSelectedYM} />

              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={APP_COLORS.textMuted} />
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Buscar movimiento"
                  placeholderTextColor={APP_COLORS.textMuted}
                  style={styles.searchInput}
                />
                {isSearching && (
                  <Pressable onPress={() => setSearchText('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={APP_COLORS.textMuted} />
                  </Pressable>
                )}
              </View>
              {isSearching && (
                <Text style={styles.searchAllMonthsHint}>
                  Buscando en todos los meses
                </Text>
              )}

              <View style={styles.filtersBar}>
                <CategoryFilterChip
                  selectedValues={categoryFilter}
                  options={categoryOptions}
                  onToggle={toggleCategoryFilter}
                  onClear={() => setCategoryFilter([])}
                  onOpen={setDropdown}
                />
                <FilterChip
                  icon="people-outline"
                  label="Autor"
                  options={[
                    { label: 'Ambos', value: 'both' },
                    { label: 'Yo', value: 'mine' },
                    { label: 'Pareja', value: 'partner' },
                  ]}
                  value={ownerFilter}
                  onChange={setOwnerFilter}
                  onOpen={setDropdown}
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
                  onOpen={setDropdown}
                />
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <AnimatedEmptyState animationKey={listAnimationKey} />
        }
        renderItem={({ item, index }) => (
          <HistoryTransactionItem
            transaction={item}
            ym={selectedYM}
            index={index}
            isFirst={index === 0}
            isLast={index === filtered.length - 1}
            animationKey={listAnimationKey}
            onPress={() => setSelectedTransaction(item)}
            onLongPress={() => showActions(item)}
            contentHorizontalPadding={24}
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
  onOpen,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  options: Array<Option<T>>;
  value: T;
  onChange: (value: T) => void;
  onOpen: (info: DropdownInfo) => void;
}) {
  const chipRef = useRef<View>(null);
  const activeLabel = options.find((o) => o.value === value)?.label ?? label;
  const isFiltered = value !== options[0].value;

  const handlePress = () => {
    chipRef.current?.measure((_, __, width, height, pageX, pageY) => {
      onOpen({
        type: 'single',
        x: pageX,
        y: pageY + height + 6,
        width,
        options: options as Array<Option<string>>,
        value: value as string,
        onChange: onChange as (v: string) => void,
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
  const isFiltered = selectedValues.length > 0;
  const label = selectedValues.length === 0
    ? 'Todas'
    : selectedValues.length === 1
      ? (options.find((o) => o.value === selectedValues[0])?.label ?? 'Categoría')
      : `${selectedValues.length} categorías`;

  const handlePress = () => {
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
    <View ref={chipRef} style={styles.filterChipWrapper}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.filterChip, isFiltered && styles.filterChipActive, pressed && styles.pressed]}
      >
        <Ionicons name="pricetag-outline" size={14} color={isFiltered ? '#7C3AED' : APP_COLORS.textSecondary} />
        <Text style={[styles.filterChipText, isFiltered && styles.filterChipTextActive]} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={12} color={isFiltered ? '#7C3AED' : APP_COLORS.textMuted} />
      </Pressable>
    </View>
  );
}

function DropdownOverlay({ info, onClose }: { info: DropdownInfo; onClose: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
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
            })
          ) : (
            <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
              <Pressable
                onPress={() => {
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
      <Ionicons name="receipt-outline" size={34} color={APP_COLORS.textMuted} />
      <Text style={styles.emptyTitle}>Sin movimientos</Text>
      <Text style={styles.emptyText}>Ajusta los filtros o cambia de mes.</Text>
    </Animated.View>
  );
}

function HistoryTransactionItem({
  transaction,
  ym,
  index,
  isFirst,
  isLast,
  animationKey,
  onPress,
  onLongPress,
  contentHorizontalPadding,
}: {
  transaction: Transaction;
  ym: string;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  animationKey: string;
  onPress: () => void;
  onLongPress: () => void;
  contentHorizontalPadding: number;
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
    <Animated.View
      style={[
        styles.movementsSectionItem,
        isFirst && styles.movementsSectionFirstItem,
        isLast && styles.movementsSectionLastItem,
        { opacity: anim, transform: [{ translateY }] },
      ]}
    >
      <TransactionTile
        transaction={transaction}
        ym={ym}
        onPress={onPress}
        onLongPress={onLongPress}
        contentHorizontalPadding={contentHorizontalPadding}
      />
    </Animated.View>
  );
}

function HeroSummaryCell({
  label,
  value,
  currency,
  tone,
}: {
  label: string;
  value: number;
  currency: Parameters<typeof splitAmount>[1];
  tone: 'income' | 'expense' | 'balance';
}) {
  const toneStyle = tone === 'income' ? styles.income : tone === 'expense' ? styles.expense : styles.balanceColor;

  return (
    <View style={styles.heroSummaryCell}>
      <Text style={styles.heroSummaryLabel}>{label}</Text>
      <SlotAmount value={value} currency={currency} toneStyle={toneStyle} />
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
    <View style={styles.heroSummaryValueClip}>
      {isChanging && (
        <Animated.Text
          style={[
            styles.heroSummaryValue,
            toneStyle,
            styles.heroSummaryValueLayer,
            { opacity: exitingOpacity, transform: [{ translateY: exitingTranslateY }] },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {fromAmount.whole}
          <Text style={styles.heroSummaryDecimals}>,{fromAmount.decimals} {fromAmount.symbol}</Text>
        </Animated.Text>
      )}
      <Animated.Text
        style={[
          styles.heroSummaryValue,
          toneStyle,
          styles.heroSummaryValueLayer,
          { opacity: isChanging ? enteringOpacity : 1, transform: [{ translateY: isChanging ? enteringTranslateY : 0 }] },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {toAmount.whole}
        <Text style={styles.heroSummaryDecimals}>,{toAmount.decimals} {toAmount.symbol}</Text>
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

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
  },
  emptyTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  expense: {
    color: APP_COLORS.expense,
  },
  searchAllMonthsHint: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  filtersBar: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChipWrapper: {
    flex: 1,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 20,
    elevation: 3,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  filterChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#7C3AED',
    elevation: 4,
    shadowOpacity: 0.16,
  },
  filterChipText: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#7C3AED',
  },
  dropdownCard: {
    borderRadius: 14,
    elevation: 5,
    position: 'absolute',
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  dropdownInner: {
    backgroundColor: APP_COLORS.surface,
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
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  dropdownOptionActive: {
    backgroundColor: '#F5F3FF',
  },
  dropdownOptionText: {
    color: APP_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownOptionTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  controls: {
    gap: 18,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 10,
  },
  balanceColor: {
    color: '#7C3AED',
  },
  income: {
    color: APP_COLORS.income,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 96,
  },
  movementsSectionEmpty: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderWidth: 1,
    marginTop: 12,
  },
  movementsSectionFirstItem: {
    borderTopWidth: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: 12,
    overflow: 'hidden',
  },
  movementsSectionItem: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  movementsSectionLastItem: {
    borderBottomWidth: 1,
  },
  pressed: {
    opacity: 0.72,
  },
  screen: {
    backgroundColor: '#EDF2F6',
    flex: 1,
  },
  heroDivider: {
    backgroundColor: '#EEF0F3',
    height: 36,
    width: 1,
  },
  heroGreeting: {
    color: '#303236',
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    lineHeight: 32,
  },
  heroHeader: {
    backgroundColor: APP_COLORS.surface,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 5,
    paddingBottom: 28,
    paddingHorizontal: 32,
    paddingTop: 56,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  heroMonth: {
    color: '#7C3AED',
    fontWeight: '400',
  },
  heroSubtitle: {
    color: '#303236',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
  },
  heroSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 36,
    gap: 8,
  },
  heroSummaryCell: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  heroSummaryDecimals: {
    color: '#8E929B',
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 15,
  },
  heroSummaryLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  heroSummaryValue: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 28,
    lineHeight: 32,
  },
  heroSummaryValueClip: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  heroSummaryValueLayer: {
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
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
  searchInput: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  secondaryAction: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
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
    color: APP_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  searchWrap: {
    alignItems: 'center',
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    paddingHorizontal: 0,
  },
  pickerBackdrop: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    width: '100%',
  },
  pickerCardShadow: {
    borderRadius: 20,
    elevation: 14,
    maxWidth: 340,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    width: '100%',
  },
  pickerYearRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pickerYearText: {
    color: APP_COLORS.textPrimary,
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
    color: APP_COLORS.textPrimary,
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
    backgroundColor: APP_COLORS.surface,
    borderRadius: 12,
    elevation: 4,
    height: 42,
    justifyContent: 'center',
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    width: 42,
  },
  monthButtonPressed: {
    backgroundColor: '#F1F5F9',
    opacity: 0.8,
  },
  monthCenterButton: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderRadius: 12,
    elevation: 4,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 11,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  monthText: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  floatingSummary: {
    backgroundColor: APP_COLORS.surface,
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    elevation: 10,
    left: 0,
    paddingBottom: 12,
    paddingHorizontal: 32,
    position: 'absolute',
    right: 0,
    shadowColor: '#0F172A',
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
    backgroundColor: APP_COLORS.border,
    height: 32,
    width: 1,
  },
  floatingSummaryLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  floatingSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  floatingSummaryValue: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 16,
  },
});
