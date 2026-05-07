import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CurrencyCode } from '../types';
import { MONTHS_ES, splitAmount } from '../utils/format';

export type CardState = 'gastos' | 'ingresos';

interface BalanceCardProps {
  gastosActual: number;
  gastosProyectados: number;
  ingresosActual: number;
  ingresosProyectados: number;
  currency: CurrencyCode;
  selectedYM: string;
  onStateChange: (state: CardState) => void;
  onSwipeBegin?: () => void;
  onSwipeEnd?: () => void;
}

const STATES: CardState[] = ['ingresos', 'gastos'];

const STATE_META: Record<CardState, {
  accent: string;
  pillBg: string;
  pillColor: string;
  detailKind: 'income' | 'expense';
}> = {
  ingresos: {
    accent: '#25C55B',
    pillBg: '#DCFCE7',
    pillColor: '#25C55B',
    detailKind: 'income',
  },
  gastos: {
    accent: '#EC1147',
    pillBg: '#FFE4E6',
    pillColor: '#EC1147',
    detailKind: 'expense',
  },
};

export function BalanceCard({
  gastosActual,
  gastosProyectados,
  ingresosActual,
  ingresosProyectados,
  currency,
  selectedYM,
  onStateChange,
  onSwipeBegin,
  onSwipeEnd,
}: BalanceCardProps) {
  const onSwipeBeginRef = useRef(onSwipeBegin);
  const onSwipeEndRef = useRef(onSwipeEnd);
  useEffect(() => { onSwipeBeginRef.current = onSwipeBegin; }, [onSwipeBegin]);
  useEffect(() => { onSwipeEndRef.current = onSwipeEnd; }, [onSwipeEnd]);

  const [stateIndex, setStateIndex] = useState(0);
  const stateIndexRef = useRef(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const indicatorWidths = useRef(
    STATES.map((_, i) => new Animated.Value(i === 0 ? 28 : 14))
  ).current;

  const activeState = STATES[stateIndex];
  const meta = STATE_META[activeState];
  const monthName = MONTHS_ES[(Number(selectedYM.split('-')[1]) - 1)];
  const primaryValue = activeState === 'gastos' ? gastosActual : ingresosActual;
  const secondaryValue = activeState === 'gastos' ? gastosProyectados : ingresosProyectados;
  const pillAmount = splitAmount(secondaryValue, currency);
  const pillDecSep = currency === 'USD' ? '.' : ',';

  const goToIndex = (nextIndex: number, direction: 'left' | 'right') => {
    const exitOffset = direction === 'left' ? -24 : 24;
    const enterOffset = direction === 'left' ? 24 : -24;

    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 90, useNativeDriver: true }),
      Animated.timing(slide, { toValue: exitOffset, duration: 90, useNativeDriver: true }),
    ]).start(() => {
      stateIndexRef.current = nextIndex;
      slide.setValue(enterOffset);
      setStateIndex(nextIndex);
      onStateChange(STATES[nextIndex]);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slide, {
          toValue: 0,
          useNativeDriver: true,
          damping: 16,
          stiffness: 180,
        }),
        ...STATES.map((_, i) =>
          Animated.spring(indicatorWidths[i], {
            toValue: i === nextIndex ? 28 : 14,
            useNativeDriver: false,
            damping: 14,
            stiffness: 160,
          })
        ),
      ]).start();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => {
        const isHorizontal = Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5;
        if (!isHorizontal) return false;
        const idx = stateIndexRef.current;
        return (dx < 0 && idx < STATES.length - 1) || (dx > 0 && idx > 0);
      },
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) => {
        const isHorizontal = Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5;
        if (!isHorizontal) return false;
        const idx = stateIndexRef.current;
        return (dx < 0 && idx < STATES.length - 1) || (dx > 0 && idx > 0);
      },
      onPanResponderGrant: () => { onSwipeBeginRef.current?.(); },
      onPanResponderRelease: (_, { dx }) => {
        const currentIndex = stateIndexRef.current;
        if (dx < -30 && currentIndex < STATES.length - 1) {
          goToIndex(currentIndex + 1, 'left');
        } else if (dx > 30 && currentIndex > 0) {
          goToIndex(currentIndex - 1, 'right');
        }
        onSwipeEndRef.current?.();
      },
      onPanResponderTerminate: () => { onSwipeEndRef.current?.(); },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    }),
  ).current;

  return (
    <View style={styles.card} {...panResponder.panHandlers}>
      <Animated.View style={[styles.inner, { opacity: fade, transform: [{ translateX: slide }] }]}>
        <View style={styles.amountLine}>
          <AmountText value={primaryValue} currency={currency} />
        </View>

        <LinearGradient
          colors={['#FFFFFF', '#EEF0F3', '#EEF0F3', '#FFFFFF']}
          locations={[0, 0.3, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.divider}
        />

        <View style={styles.pill}>
          <View style={[styles.pillNumBox, { backgroundColor: meta.pillBg }]}>
            <Text style={[styles.pillWhole, { color: meta.pillColor }]}>
              {pillAmount.sign}{pillAmount.whole}
            </Text>
            <Text style={[styles.pillSubtext, { color: meta.pillColor, opacity: 0.5 }]}>
              {pillDecSep}{pillAmount.decimals} {pillAmount.symbol}
            </Text>
          </View>
          <Text numberOfLines={3} style={styles.pillLabel}>
            {'Saldo depués de\ngastos de '}{monthName}
          </Text>
        </View>
      </Animated.View>

      {/* Indicadores de página horizontales */}
      <View style={styles.indicators}>
        {STATES.map((state, i) => (
          <Animated.View
            key={state}
            style={[
              styles.indicator,
              {
                backgroundColor: state === activeState ? meta.accent : '#DADDE2',
                width: indicatorWidths[i],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function AmountText({
  value,
  currency,
  accent,
}: {
  value: number;
  currency: CurrencyCode;
  accent?: string;
}) {
  const amount = splitAmount(value, currency);
  const decimalSeparator = currency === 'USD' ? '.' : ',';
  const color = accent ?? '#2F3033';

  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.58}
      style={[styles.amount, { color }]}
    >
      {amount.sign}{amount.whole}
      <Text style={[styles.decimals, { color, opacity: 0.5 }]}>
        {decimalSeparator}{amount.decimals}
      </Text>
      <Text style={[styles.symbol, { color, opacity: 0.5 }]}>
        {' '}{amount.symbol}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  amount: {
    color: '#2F3033',
    flexShrink: 1,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 52,
    lineHeight: 60,
    minWidth: 0,
    textAlign: 'center',
  },
  amountLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 6,
    minHeight: 60,
    paddingHorizontal: 16,
  },
  card: {
    marginHorizontal: 24,
    minHeight: 180,
    overflow: 'visible',
    paddingTop: 28,
  },
  decimals: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 28,
  },
  divider: {
    alignSelf: 'center',
    height: 2,
    marginBottom: 12,
    width: '52%',
  },
  indicators: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingBottom: 16,
    paddingTop: 12,
  },
  indicator: {
    borderRadius: 999,
    height: 4,
  },
  inner: {},
  pill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingBottom: 8,
  },
  pillNumBox: {
    alignItems: 'baseline',
    borderRadius: 5,
    flexDirection: 'row',
    gap: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  pillWhole: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 28,
  },
  pillSubtext: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 13,
  },
  pillLabel: {
    color: '#888A92',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  symbol: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
  },
});
