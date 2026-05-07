import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { APP_COLORS } from '../constants/colors';
import { TransactionTile } from './TransactionTile';
import type { AppPayload, CurrencyCode, UserId } from '../types';
import { isMonthVisible } from '../utils/filters';
import { fmt, formatYM, nextYM, prevYM } from '../utils/format';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FinanceDetailModalProps {
  visible: boolean;
  kind: 'income' | 'expense';
  currency: CurrencyCode;
  uid: UserId;
  selectedYM: string;
  payload: AppPayload;
  onClose: () => void;
  onAdd: () => void;
}

export function FinanceDetailModal({
  visible,
  kind,
  currency,
  uid,
  selectedYM,
  payload,
  onClose,
  onAdd,
}: FinanceDetailModalProps) {
  const [search, setSearch] = useState('');
  const [modalYM, setModalYM] = useState(selectedYM);
  const monthSlide = useRef(new Animated.Value(0)).current;
  const accent = kind === 'income' ? '#16A34A' : '#EC1147';
  const noun = kind === 'income' ? 'ingresos' : 'gastos';

  useEffect(() => {
    if (!visible) return;
    setModalYM(selectedYM);
    setSearch('');
    monthSlide.setValue(0);
  }, [visible, kind, selectedYM]);

  const changeMonth = (getNextYM: (ym: string) => string, direction: 'next' | 'prev') => {
    const enterOffset = direction === 'next' ? 14 : -14;

    monthSlide.stopAnimation();

    LayoutAnimation.configureNext({
      duration: 170,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    setModalYM((ym) => getNextYM(ym));
    setSearch('');

    monthSlide.setValue(enterOffset);
    Animated.timing(monthSlide, {
      toValue: 0,
      duration: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const monthlyTransactions = useMemo(() => {
    return payload.expenses
      .filter((t) => (
        t.uid === uid &&
        !t.del &&
        t.kind === kind &&
        isMonthVisible(t, modalYM)
      ))
      .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
  }, [kind, modalYM, payload.expenses, uid]);

  const total = useMemo(() => {
    return monthlyTransactions.reduce((sum, transaction) => sum + transaction.amt, 0);
  }, [monthlyTransactions]);

  const transactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthlyTransactions
      .filter((t) => {
        const text = `${t.desc} ${t.account} ${t.notes} ${(t.tags ?? []).join(' ')}`.toLowerCase();
        return q === '' || text.includes(q);
      })
  }, [monthlyTransactions, search]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPressIn={onClose}>
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.backdropOverlay} />
        <Pressable style={styles.card} onPressIn={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>
              Estos son los{'\n'}detalles de tus <Text style={{ color: accent }}>{noun}</Text>
            </Text>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Ionicons name="close" size={20} color={APP_COLORS.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.monthSelector}>
            <Pressable
              accessibilityLabel="Mes anterior"
              onPress={() => changeMonth(prevYM, 'prev')}
              style={({ pressed }) => [styles.monthButton, pressed && styles.monthButtonPressed]}
            >
              <Ionicons name="chevron-back" size={20} color={APP_COLORS.textSecondary} />
            </Pressable>
            <Text style={styles.monthLabel}>{formatYM(modalYM)}</Text>
            <Pressable
              accessibilityLabel="Mes siguiente"
              onPress={() => changeMonth(nextYM, 'next')}
              style={({ pressed }) => [styles.monthButton, pressed && styles.monthButtonPressed]}
            >
              <Ionicons name="chevron-forward" size={20} color={APP_COLORS.textSecondary} />
            </Pressable>
          </View>

          <Animated.View
            style={[
              styles.monthContent,
              { transform: [{ translateX: monthSlide }] },
            ]}
          >
            <View style={styles.totalWrap}>
              <Text style={[styles.totalAmount, { color: accent }]}>{fmt(total, currency)}</Text>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={APP_COLORS.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar..."
                placeholderTextColor={APP_COLORS.textMuted}
                style={styles.searchInput}
              />
              <Ionicons name="chevron-down" size={18} color={APP_COLORS.textMuted} />
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {transactions.length === 0 ? (
                <Text style={styles.empty}>Sin {noun} para este mes.</Text>
              ) : (
                transactions.map((transaction) => (
                  <TransactionTile
                    key={String(transaction.id)}
                    transaction={transaction}
                    ym={modalYM}
                    onPress={() => {}}
                  />
                ))
              )}
            </ScrollView>
          </Animated.View>

          <Pressable
            onPress={onAdd}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: accent },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addButtonText}>
              {kind === 'income' ? 'Añadir Ingreso' : 'Añadir Gasto'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 7,
    height: 50,
    justifyContent: 'center',
    marginTop: 18,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.30)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    maxHeight: '92%',
    maxWidth: 560,
    padding: 24,
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  empty: {
    color: APP_COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 28,
    textAlign: 'center',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  list: {
    maxHeight: 300,
  },
  listContent: {
    paddingTop: 8,
  },
  monthContent: {},
  monthButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  monthButtonPressed: {
    backgroundColor: '#F1F5F9',
  },
  monthLabel: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    textAlign: 'center',
  },
  monthSelector: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    elevation: 4,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    padding: 6,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  pressed: {
    opacity: 0.74,
  },
  searchInput: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },
  searchWrap: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  title: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 26,
  },
  totalAmount: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 48,
    lineHeight: 56,
    textAlign: 'center',
  },
  totalWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
});
