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

export interface GuidelineCardItem<State extends string> {
  key: State;
  value: number;
  accent: string;
  pill?: {
    value: number;
    backgroundColor: string;
    color: string;
    label: string;
  };
}

interface GuidelineCardProps<State extends string> {
  items: readonly GuidelineCardItem<State>[];
  currency: CurrencyCode;
  onStateChange?: (state: State) => void;
  onSwipeBegin?: () => void;
  onSwipeEnd?: () => void;
}

export function GuidelineCard<State extends string>({
  items,
  currency,
  onStateChange,
  onSwipeBegin,
  onSwipeEnd,
}: GuidelineCardProps<State>) {
  const onSwipeBeginRef = useRef(onSwipeBegin);
  const onSwipeEndRef = useRef(onSwipeEnd);
  useEffect(() => { onSwipeBeginRef.current = onSwipeBegin; }, [onSwipeBegin]);
  useEffect(() => { onSwipeEndRef.current = onSwipeEnd; }, [onSwipeEnd]);

  const [stateIndex, setStateIndex] = useState(0);
  const stateIndexRef = useRef(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const indicatorWidths = useRef(
    items.map((_, i) => new Animated.Value(i === 0 ? 28 : 14)),
  ).current;

  const activeItem = items[stateIndex] ?? items[0];
  const pillAmount = activeItem.pill ? splitAmount(activeItem.pill.value, currency) : null;
  const pillDecSep = currency === 'USD' ? '.' : ',';

  const goToIndex = (nextIndex: number, direction: 'left' | 'right') => {
    const nextItem = items[nextIndex];
    if (!nextItem) return;

    const exitOffset = direction === 'left' ? -24 : 24;
    const enterOffset = direction === 'left' ? 24 : -24;

    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 90, useNativeDriver: true }),
      Animated.timing(slide, { toValue: exitOffset, duration: 90, useNativeDriver: true }),
    ]).start(() => {
      stateIndexRef.current = nextIndex;
      slide.setValue(enterOffset);
      setStateIndex(nextIndex);
      onStateChange?.(nextItem.key);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slide, {
          toValue: 0,
          useNativeDriver: true,
          damping: 16,
          stiffness: 180,
        }),
        ...items.map((_, i) =>
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
        return (dx < 0 && idx < items.length - 1) || (dx > 0 && idx > 0);
      },
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) => {
        const isHorizontal = Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5;
        if (!isHorizontal) return false;
        const idx = stateIndexRef.current;
        return (dx < 0 && idx < items.length - 1) || (dx > 0 && idx > 0);
      },
      onPanResponderGrant: () => { onSwipeBeginRef.current?.(); },
      onPanResponderRelease: (_, { dx }) => {
        const currentIndex = stateIndexRef.current;
        if (dx < -30 && currentIndex < items.length - 1) {
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

  if (!activeItem) return null;

  return (
    <View style={styles.card} {...panResponder.panHandlers}>
      <Animated.View style={[styles.inner, { opacity: fade, transform: [{ translateX: slide }] }]}>
        <View style={styles.amountLine}>
          <AmountText value={activeItem.value} currency={currency} />
        </View>

        <LinearGradient
          colors={['#FFFFFF', '#EEF0F3', '#EEF0F3', '#FFFFFF']}
          locations={[0, 0.3, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.divider}
        />

        {activeItem.pill && pillAmount ? (
          <View style={styles.pill}>
            <View style={[styles.pillNumBox, { backgroundColor: activeItem.pill.backgroundColor }]}>
              <Text style={[styles.pillWhole, { color: activeItem.pill.color }]}>
                {pillAmount.sign}{pillAmount.whole}
              </Text>
              <Text style={[styles.pillSubtext, { color: activeItem.pill.color, opacity: 0.5 }]}>
                {pillDecSep}{pillAmount.decimals} {pillAmount.symbol}
              </Text>
            </View>
            <Text numberOfLines={3} style={styles.pillLabel}>
              {activeItem.pill.label}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <View style={styles.indicators}>
        {items.map((item, i) => (
          <Animated.View
            key={item.key}
            style={[
              styles.indicator,
              {
                backgroundColor: item.key === activeItem.key ? activeItem.accent : '#DADDE2',
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
    fontSize: 46,
    lineHeight: 52,
    minWidth: 0,
    textAlign: 'center',
  },
  amountLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 4,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  card: {
    marginHorizontal: 24,
    minHeight: 150,
    overflow: 'visible',
    paddingTop: 16,
  },
  decimals: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 28,
  },
  divider: {
    alignSelf: 'center',
    height: 2,
    marginBottom: 8,
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
    paddingBottom: 10,
    paddingTop: 8,
  },
  inner: {},
  pill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingBottom: 4,
  },
  pillLabel: {
    color: '#888A92',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  pillNumBox: {
    alignItems: 'baseline',
    borderRadius: 5,
    flexDirection: 'row',
    gap: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  pillSubtext: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 13,
  },
  pillWhole: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 28,
  },
  symbol: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
  },
});
