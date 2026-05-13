import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
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
  showPillToggle?: boolean;
  onStateChange?: (state: State) => void;
  onSwipeBegin?: () => void;
  onSwipeEnd?: () => void;
  onPillToggle?: (expanded: boolean) => void;
  topSlot?: React.ReactNode;
}

export function GuidelineCard<State extends string>({
  items,
  currency,
  showPillToggle = true,
  onStateChange,
  onSwipeBegin,
  onSwipeEnd,
  onPillToggle,
  topSlot,
}: GuidelineCardProps<State>) {
  const onSwipeBeginRef = useRef(onSwipeBegin);
  const onSwipeEndRef = useRef(onSwipeEnd);
  const onPillToggleRef = useRef(onPillToggle);
  useEffect(() => { onSwipeBeginRef.current = onSwipeBegin; }, [onSwipeBegin]);
  useEffect(() => { onSwipeEndRef.current = onSwipeEnd; }, [onSwipeEnd]);
  useEffect(() => { onPillToggleRef.current = onPillToggle; }, [onPillToggle]);

  const [stateIndex, setStateIndex] = useState(0);
  const [pillExpanded, setPillExpanded] = useState(false);
  const stateIndexRef = useRef(0);

  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const toggleFade = useRef(new Animated.Value(1)).current;
  const toggleSlide = useRef(new Animated.Value(0)).current;

  const indicatorWidths = useRef(
    items.map((_, i) => new Animated.Value(i === 0 ? 28 : 14)),
  ).current;

  const activeItem = items[stateIndex] ?? items[0];
  const displayValue = pillExpanded && activeItem.pill ? activeItem.pill.value : activeItem.value;

  const togglePill = () => {
    const next = !pillExpanded;
    const exitY = next ? -10 : 10;

    Animated.timing(toggleFade, { toValue: 0, duration: 80, useNativeDriver: true }).start(() => {
      setPillExpanded(next);
      onPillToggleRef.current?.(next);
      toggleSlide.setValue(-exitY);
      // Wait 2 frames so React commits the new displayValue before fading in
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(toggleFade, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(toggleSlide, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 180 }),
        ]).start();
      }, 32);
    });
  };

  const goToIndex = (nextIndex: number, direction: 'left' | 'right') => {
    const nextItem = items[nextIndex];
    if (!nextItem) return;

    const exitOffset = direction === 'left' ? -24 : 24;
    const enterOffset = direction === 'left' ? 24 : -24;

    setPillExpanded(false);
    onPillToggleRef.current?.(false);
    toggleFade.setValue(1);
    toggleSlide.setValue(0);

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

  const iconColor = pillExpanded ? activeItem.accent : '#C0C3CB';

  return (
    <View style={[styles.card, topSlot ? styles.cardWithSlot : null]} {...panResponder.panHandlers}>
      {topSlot}
      <Animated.View style={[styles.inner, topSlot ? styles.innerWithSlot : null, { opacity: fade, transform: [{ translateX: slide }] }]}>
        <View style={styles.amountLine}>
          <Animated.View style={[styles.amountWrap, { opacity: toggleFade, transform: [{ translateY: toggleSlide }] }]}>
            <AmountText value={displayValue} currency={currency} />
          </Animated.View>

          {activeItem.pill && showPillToggle && (
            <Pressable onPress={togglePill} hitSlop={12} style={styles.toggleBtn}>
              <View style={[styles.toggleCircle, { borderColor: iconColor }]}>
                <Ionicons name="swap-vertical-outline" size={14} color={iconColor} />
              </View>
            </Pressable>
          )}
        </View>
      </Animated.View>

      {items.length > 1 && (
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
      )}
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
  amountWrap: {
    flexShrink: 1,
    minWidth: 0,
  },
  toggleBtn: {
    marginLeft: 10,
  },
  toggleCircle: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  card: {
    marginHorizontal: 24,
    overflow: 'visible',
    paddingTop: 12,
  },
  cardWithSlot: {
    marginHorizontal: 0,
    paddingTop: 0,
  },
  innerWithSlot: {
    marginTop: -90,
  },
  decimals: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 28,
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
    paddingBottom: 4,
    paddingTop: 6,
  },
  inner: {},
  symbol: {
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 22,
  },
});
