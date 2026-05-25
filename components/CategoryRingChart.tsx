import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
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

export function CategoryRingChart({ slices, currency, selectedYM, size = 230 }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const drawAnim = useRef(new Animated.Value(0)).current;
  const [drawPct, setDrawPct] = useState(0);

  const R = (size - STROKE_W) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const capAngleDeg = (STROKE_W / (2 * R)) * (180 / Math.PI);

  useEffect(() => {
    const id = drawAnim.addListener(({ value }) => setDrawPct(value));
    return () => drawAnim.removeListener(id);
  }, [drawAnim]);

  useFocusEffect(
    useCallback(() => {
      const shouldAnimate = slices.some((slice) => slice.value > 0);

      drawAnim.stopAnimation();
      drawAnim.setValue(shouldAnimate ? 0 : 1);

      if (!shouldAnimate) return;

      const anim = Animated.timing(drawAnim, {
        toValue: 1,
        duration: 650,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });

      anim.start();
      return () => anim.stop();
    }, [drawAnim, slices]),
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
    const result: Array<{ slice: RingSlice; d1: number; d2: number; arcLen: number }> = [];
    let cur = -90; // 12 o'clock

    for (const slice of activeSlices) {
      const span = (slice.value / totalValue) * availableDeg;
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
          <Text style={styles.centerLabel}>Total gastado</Text>
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
