import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
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
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import { AppModal as Modal } from './AppModal';
import { ModalScreen } from './ModalScreen';
import { TransactionTile } from './TransactionTile';
import type { AppPayload, CurrencyCode, UserId } from '../types';
import { getTransactionAmountForMonth, isMonthVisible } from '../utils/filters';
import { fmt } from '../utils/format';
import { MonthNavigator } from './MonthNavigator';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { calcGastosProyectados, calcIngresosProyectados } from '../utils/calculations';

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

  const changeMonth = (newYM: string) => {
    const enterOffset = newYM > modalYM ? 14 : -14;

    monthSlide.stopAnimation();

    LayoutAnimation.configureNext({
      duration: 170,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    setModalYM(newYM);
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
    return kind === 'income'
      ? calcIngresosProyectados(payload, uid, modalYM)
      : calcGastosProyectados(payload, uid, modalYM);
  }, [kind, modalYM, payload, uid]);

  const registeredTotal = useMemo(() => {
    return monthlyTransactions.reduce((sum, transaction) => sum + getTransactionAmountForMonth(transaction, modalYM), 0);
  }, [modalYM, monthlyTransactions]);

  const transactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthlyTransactions
      .filter((t) => {
        const text = `${t.desc} ${t.account} ${t.notes} ${(t.tags ?? []).join(' ')}`.toLowerCase();
        return q === '' || text.includes(q);
      })
  }, [monthlyTransactions, search]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <ModalScreen
        title={kind === 'income' ? 'Ingresos' : 'Gastos'}
        subtitle={formatDetailSubtitle(noun)}
        onBack={onClose}
        contentContainerStyle={styles.financeScreenContent}
        footer={(
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); runAfterKeyboardDismiss(onAdd); }}
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
        )}
      >
          <View style={[styles.header, { display: 'none' }]}>
            <Text style={styles.title}>
              Estos son los{'\n'}detalles de tus <Text style={{ color: accent }}>{noun}</Text>
            </Text>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Ionicons name="close" size={20} color={APP_COLORS.textPrimary} />
            </Pressable>
          </View>

          <MonthNavigator ym={modalYM} onChange={changeMonth} />

          <Animated.View
            style={[
              styles.monthContent,
              { transform: [{ translateX: monthSlide }] },
            ]}
          >
            <View style={styles.totalWrap}>
              <Text style={[styles.totalAmount, { color: accent }]}>{fmt(total, currency)}</Text>
              {total !== registeredTotal && (
                <Text style={styles.registeredTotal}>
                  Registrado: {fmt(registeredTotal, currency)}
                </Text>
              )}
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

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={dismissKeyboardAndBlur}
            >
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
            onPress={() => runAfterKeyboardDismiss(onAdd)}
            style={({ pressed }) => [
              styles.addButton,
              { display: 'none' },
              { backgroundColor: accent },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addButtonText}>
              {kind === 'income' ? 'Añadir Ingreso' : 'Añadir Gasto'}
            </Text>
          </Pressable>
      </ModalScreen>
    </Modal>
  );
}

function formatDetailSubtitle(noun: string) {
  return `Detalles de tus ${noun}`;
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    height: 50,
    justifyContent: 'center',
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    height: '90%',
    maxHeight: '94%',
    overflow: 'hidden',
    padding: 24,
    width: '100%',
  },
  cardShadow: {
    borderRadius: 22,
    elevation: 14,
    maxWidth: 560,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
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
  financeScreenContent: {
    flex: 1,
    gap: 14,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
  },
  monthContent: {
    flex: 1,
    minHeight: 0,
  },
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
  registeredTotal: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
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
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  title: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 20,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
    lineHeight: 26,
  },
  totalAmount: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 44,
    lineHeight: 50,
    textAlign: 'center',
  },
  totalWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
});
