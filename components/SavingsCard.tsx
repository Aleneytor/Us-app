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
import { splitAmount } from '../utils/format';

export type SavingsCardState = 'ahorrado' | 'objetivo';

interface SavingsCardProps {
  saved: number;
  target: number;
  currency: CurrencyCode;
  onStateChange: (state: SavingsCardState) => void;
  onSwipeBegin?: () => void;
  onSwipeEnd?: () => void;
}

const STATES: SavingsCardState[] = ['ahorrado', 'objetivo'];

const STATE_META: Record<SavingsCardState, {
  accent: string;
  pillBg: string;
  pillColor: string;
}> = {
  ahorrado: { accent: '#7C3AED', pillBg: '#EDE9FE', pillColor: '#7C3AED' },
  objetivo: { accent: '#7C3AED', pillBg: '#EDE9FE', pillColor: '#7C3AED' },
};

export function SavingsCard({
  saved,
  target,
  currency,
  onStateChange,
  onSwipeBegin,
  onSwipeEnd,
}: SavingsCardProps) {
  const onSwipeBeginRef = useRef(onSwipeBegin);
  const onSwipeEndRef = useRef(onSwipeEnd);
  useEffect(() => { onSwipeBeginRef.current = onSwipeBegin; }, [onSwipeBegin]);
  useEffect(() => { onSwipeEndRef.current = onSwipeEnd; }, [onSwipeEnd]);

  const [stateIndex, setStateIndex] = useState(0);
  const stateIndexRef = useRef(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const indicatorWidths = useRef(
    STATES.map((_, i) => new Animated.Value(i === 0 ? 28 : 14)),
  ).current;

  const activeState = STATES[stateIndex];
  const meta = STATE_META[activeState];

  const primaryValue = activeState === 'ahorrado' ? saved : target;

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
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 180 }),
        ...STATES.map((_, i) =>
          Animated.spring(indicatorWidths[i], {
            toValue: i === nextIndex ? 28 : 14,
            useNativeDriver: false,
            damping: 14,
            stiffness: 160,
          }),
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
        if (dx < -30 && currentIndex < STATES.length - 1) goToIndex(currentIndex + 1, 'left');
        else if (dx > 30 && currentIndex > 0) goToIndex(currentIndex - 1, 'right');
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
      </Animated.View>

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

function AmountText({ value, currency }: { value: number; currency: CurrencyCode }) {
  const amount = splitAmount(value, currency);
  const decimalSeparator = currency === 'USD' ? '.' : ',';
  const color = '#2F3033';

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
    minHeight: 120,
    overflow: 'visible',
    paddingTop: 14,
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
  indicator: {
    borderRadius: 999,
    height: 4,
  },
  indicators: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingBottom: 16,
    paddingTop: 12,
  },
  inner: {},
  symbol: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
  },
});
