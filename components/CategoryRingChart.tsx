import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import type { CurrencyCode } from '../types';
import { fmt, MONTHS_ES } from '../utils/format';

export interface RingSlice {
  id: number;
  label: string;
  color: string;
  value: number;
}

interface Props {
  slices: RingSlice[];
  currency: CurrencyCode;
  selectedYM: string;
  size?: number;
  mode?: 'expense' | 'income';
  onToggleMode?: () => void;
}

const STROKE_W = 20;
const GAP_DEG = 5;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, deg1: number, deg2: number): string {
  const s = polar(cx, cy, r, deg1);
  const e = polar(cx, cy, r, deg2);
  const large = Math.abs(deg2 - deg1) > 180 ? 1 : 0;
  return `M${s.x.toFixed(3)},${s.y.toFixed(3)} A${r},${r},0,${large},1,${e.x.toFixed(3)},${e.y.toFixed(3)}`;
}

export function CategoryRingChart({
  slices,
  currency,
  selectedYM,
  size = 230,
  mode = 'expense',
  onToggleMode,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const drawAnim = useRef(new Animated.Value(0)).current;
  const toggleRotateAnim = useRef(new Animated.Value(mode === 'income' ? 1 : 0)).current;
  const [drawPct, setDrawPct] = useState(0);
  const slicesRef = useRef(slices);
  slicesRef.current = slices;

  const R = (size - STROKE_W) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const capAngleDeg = (STROKE_W / (2 * R)) * (180 / Math.PI);

  useEffect(() => {
    const id = drawAnim.addListener(({ value }) => setDrawPct(value));
    return () => drawAnim.removeListener(id);
  }, [drawAnim]);

  const runDrawAnimation = useCallback((delay = 0) => {
    const shouldAnimate = slicesRef.current.some((slice) => slice.value > 0);

    drawAnim.stopAnimation();
    drawAnim.setValue(shouldAnimate ? 0 : 1);

    if (!shouldAnimate) return undefined;

    const anim = Animated.timing(drawAnim, {
      toValue: 1,
      duration: 650,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    anim.start();
    return anim;
  }, [drawAnim]);

  useFocusEffect(
    useCallback(() => {
      const anim = runDrawAnimation(120);
      return () => anim?.stop();
    }, [runDrawAnimation]),
  );

  const activeSlices = useMemo(
    () => [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value),
    [slices],
  );

  const totalValue = useMemo(
    () => activeSlices.reduce((sum, s) => sum + s.value, 0),
    [activeSlices],
  );

  const segments = useMemo(() => {
    if (totalValue === 0 || activeSlices.length === 0) return [];
    const n = activeSlices.length;
    const availableDeg = 360 - n * GAP_DEG;

    // Enforce a minimum span for each slice so that even tiny representations are visible.
    // The visual minimum needs to cover the rounding caps (2 * capAngleDeg) plus some visible arc (e.g. 1.5 degrees).
    let minSpan = 2 * capAngleDeg + 1.5;
    if (n * minSpan > availableDeg) {
      // If there are many active slices, scale down the minSpan to fit within the available degrees,
      // but keep it large enough to be drawn.
      minSpan = Math.max(2 * capAngleDeg + 0.6, availableDeg / n);
    }

    // Allocate spans proportionally, ensuring every slice gets at least minSpan
    let remainingDeg = availableDeg;
    let remainingValue = totalValue;
    const allocatedSpans = new Map<number, number>();

    // Process from smallest value to largest so we can easily allocate the minimum span to smaller slices first
    const sortedByValueAsc = [...activeSlices].sort((a, b) => a.value - b.value);
    for (const slice of sortedByValueAsc) {
      const proportionalShare = remainingValue > 0 ? (slice.value / remainingValue) * remainingDeg : 0;
      if (proportionalShare < minSpan) {
        const actualSpan = Math.min(minSpan, remainingDeg);
        allocatedSpans.set(slice.id, actualSpan);
        remainingDeg -= actualSpan;
      } else {
        allocatedSpans.set(slice.id, proportionalShare);
        remainingDeg -= proportionalShare;
      }
      remainingValue -= slice.value;
    }

    const result: Array<{ slice: RingSlice; d1: number; d2: number; arcLen: number }> = [];
    let cur = -90; // 12 o'clock

    // Render slices in their original order (descending by value) so the chart segments match the legend order
    for (const slice of activeSlices) {
      const span = allocatedSpans.get(slice.id) || 0;
      const innerSpan = span - 2 * capAngleDeg;
      if (innerSpan > 0.5) {
        const arcLen = (R * innerSpan * Math.PI) / 180;
        result.push({ slice, d1: cur + capAngleDeg, d2: cur + span - capAngleDeg, arcLen });
      }
      cur += span + GAP_DEG;
    }
    return result;
  }, [activeSlices, totalValue, capAngleDeg, R]);

  const monthName = MONTHS_ES[Number(selectedYM.slice(5, 7)) - 1]?.toLowerCase() ?? '';
  const isIncomeMode = mode === 'income';
  const slicesSignature = useMemo(
    () => slices.map((slice) => `${slice.id}:${slice.value}`).join('|'),
    [slices],
  );
  const toggleRotateDeg = toggleRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const toggleColor = theme.mode === 'light' ? theme.textPrimary : '#FFFFFF';

  useEffect(() => {
    Animated.spring(toggleRotateAnim, {
      toValue: isIncomeMode ? 1 : 0,
      useNativeDriver: true,
      damping: 14,
      stiffness: 180,
    }).start();
  }, [isIncomeMode, toggleRotateAnim]);

  useEffect(() => {
    const anim = runDrawAnimation();
    return () => anim?.stop();
  }, [mode, runDrawAnimation, selectedYM, slicesSignature]);

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {totalValue === 0 && (
            <Path
              d={arcPath(cx, cy, R, -90, 269.99)}
              fill="none"
              stroke={theme.border}
              strokeWidth={STROKE_W}
              strokeLinecap="round"
            />
          )}
          {segments.map(({ slice, d1, d2, arcLen }) => (
            <Path
              key={slice.id}
              d={arcPath(cx, cy, R, d1, d2)}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE_W}
              strokeLinecap="round"
              strokeDasharray={`${arcLen} ${arcLen}`}
              strokeDashoffset={arcLen * (1 - drawPct)}
            />
          ))}
        </Svg>

        <View style={[StyleSheet.absoluteFill, styles.centerWrap]}>
          {onToggleMode ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isIncomeMode ? 'Ver gastos por categoría' : 'Ver ingresos por categoría'}
              onPress={onToggleMode}
              hitSlop={10}
              style={({ pressed }) => [
                styles.toggleButton,
                { borderColor: toggleColor },
                pressed && styles.toggleButtonPressed,
              ]}
            >
              <Animated.View style={{ transform: [{ rotate: toggleRotateDeg }] }}>
                <Ionicons name="swap-vertical" size={14} color={toggleColor} />
              </Animated.View>
            </Pressable>
          ) : null}
          <Text style={styles.centerLabel}>{isIncomeMode ? 'Total generado' : 'Total gastado'}</Text>
          <Text style={styles.centerAmount} numberOfLines={1} adjustsFontSizeToFit>
            {fmt(totalValue, currency)}
          </Text>
          <Text style={styles.centerMonth}>en {monthName}</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  toggleButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    marginBottom: 6,
    width: 24,
  },
  toggleButtonPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.96 }],
  },
  centerLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  centerAmount: {
    color: theme.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 34,
    letterSpacing: -1.5,
    lineHeight: 42,
  },
  centerMonth: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
