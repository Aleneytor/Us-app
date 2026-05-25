import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import type { CurrencyCode } from '../types';
import { fmt } from '../utils/format';

const AnimatedPath = Animated.createAnimatedComponent(Path as React.ComponentType<any>) as React.ComponentType<any>;

export interface DonutSlice {
  id: number;
  label: string;
  value: number;
  budget: number;
  color: string;
}

interface Props {
  slices: DonutSlice[];
  currency: CurrencyCode;
  size?: number;
  disabledIds?: Set<number>;
  onLegendToggle?: (id: number) => void;
}

const ARC_START_DEG = 180;
const ARC_END_DEG = 360;
const LEGENDS_PER_PAGE = 6;
const LEGEND_PAGE_GAP = 32;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcLinePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M${start.x},${start.y} A${r},${r},0,${largeArc},1,${end.x},${end.y}`;
}

interface LegendRowProps {
  slice: DonutSlice;
  isDisabled: boolean;
  onPress: () => void;
  width: number;
  currency: CurrencyCode;
}

function LegendRow({ slice, isDisabled, onPress, width, currency }: LegendRowProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const available = slice.budget - slice.value;
  const isOver = slice.value > slice.budget && slice.budget > 0;

  return (
    <View style={{ width }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.legendRow,
          isDisabled && styles.legendRowDisabled,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.dot, { backgroundColor: isDisabled ? (theme.mode === 'light' ? '#9CA3AF' : '#4B5563') : slice.color }]} />
        <Text style={[styles.legendName, isDisabled && styles.legendNameDisabled]} numberOfLines={1}>{slice.label}</Text>
        <Text style={[styles.legendAmt, !isDisabled && isOver && styles.legendAmtOver]} numberOfLines={1}>
          {isOver && !isDisabled ? `+${fmt(Math.abs(available), currency)}` : fmt(available, currency)}
        </Text>
      </Pressable>
    </View>
  );
}

export function DonutChart({ slices, currency, size, disabledIds, onLegendToggle }: Props) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [legendPage, setLegendPage] = useState(0);
  const legendPageRef = useRef(0);

  const drawAnim = useRef(new Animated.Value(0)).current;
  const [drawPct, setDrawPct] = useState(0);

  // Full-width arch that bleeds beyond screen edges → endpoints never visible
  //
  // Geometry:
  //   cy = outerRadius  → center sits at y=outerRadius (below visible area)
  //   arc top (270°)    → y = cy − r = 0  (flush with SVG top)
  //   arc endpoints     → y = cy = outerRadius  (hidden: below chartHeight)
  //   arc ∩ left edge   → y ≈ outerRadius × 0.36  (well inside chart)
  //
  // SIDE_CLIP: how many px each endpoint extends past the screen edge
  const SIDE_CLIP = 64;
  const legendWidth = Math.max(286, width - 40);
  const legendSnapWidth = legendWidth + LEGEND_PAGE_GAP;
  const legendColumnWidth = (legendWidth - 8) / 2;
  const chartWidth = width;
  const cx = chartWidth / 2;
  const outerRadius = Math.max(150, cx + SIDE_CLIP);
  const cy = outerRadius;                  // center below visible area
  const chartHeight = outerRadius - 28;    // clip 28px from bottom → hides endpoints

  // Adaptive step: spread arcs evenly across outerRadius
  const n = slices.length;
  const maxStep = n > 1 ? Math.floor((outerRadius - 20) / (n - 1)) : 40;
  const step      = Math.max(8, Math.min(22, maxStep));
  const strokeWidth = Math.min(13, Math.max(6, Math.round(step * 0.72)));
  const strokeGap   = Math.max(2, step - strokeWidth);

  // Animation refs for arc toggles
  const arcOpacities = useRef(new Map<number, Animated.Value>()).current;
  const isFirstEffect = useRef(true);
  const chartContainerHeightAnim = useRef(new Animated.Value(chartHeight)).current;

  const getArcOpacity = (id: number): Animated.Value => {
    if (!arcOpacities.has(id)) {
      arcOpacities.set(id, new Animated.Value(disabledIds?.has(id) ? 0 : 1));
    }
    return arcOpacities.get(id)!;
  };

  useEffect(() => {
    const id = drawAnim.addListener(({ value }) => setDrawPct(value));
    Animated.timing(drawAnim, {
      toValue: 1,
      duration: 520,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => drawAnim.removeListener(id);
  }, []);

  const sortedSlices = useMemo(
    () => [...slices].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
    [slices],
  );
  const arcSpanDeg = ARC_END_DEG - ARC_START_DEG;

  const arcs = useMemo(() => {
    return sortedSlices.map((slice, index) => {
      const radius = Math.max(26, outerRadius - index * (strokeWidth + strokeGap));
      const pct = slice.budget > 0 ? Math.min(1, Math.max(0, slice.value / slice.budget)) : 0;
      const arcLength = radius * (arcSpanDeg * Math.PI / 180);
      return {
        ...slice,
        pct,
        path: arcLinePath(cx, cy, radius, ARC_START_DEG, ARC_END_DEG),
        dash: `${arcLength * pct} ${arcLength}`,
        arcLength,
        radius,
      };
    });
  }, [arcSpanDeg, cx, cy, outerRadius, sortedSlices, strokeGap, strokeWidth]);

  useEffect(() => {
    const effectiveRadius = () => {
      const visible = arcs.filter(a => !disabledIds?.has(a.id));
      return visible.length > 0 ? Math.max(...visible.map(a => a.radius)) : outerRadius * 0.5;
    };

    // Height = effectiveRadius - 28 (mirrors chartHeight = outerRadius - 28)
    const containerHeight = () => Math.max(60, effectiveRadius() - 28);

    if (isFirstEffect.current) {
      isFirstEffect.current = false;
      chartContainerHeightAnim.setValue(containerHeight());
      return;
    }

    const opacityAnims = arcs.map(arc =>
      Animated.timing(getArcOpacity(arc.id), {
        toValue: disabledIds?.has(arc.id) ? 0 : 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    );

    Animated.parallel([
      ...opacityAnims,
      Animated.spring(chartContainerHeightAnim, {
        toValue: containerHeight(),
        useNativeDriver: false,
        damping: 20,
        stiffness: 180,
      }),
    ]).start();
  }, [disabledIds, arcs]);

  const legendPages = useMemo(() => {
    return Array.from({ length: Math.ceil(arcs.length / LEGENDS_PER_PAGE) }, (_, index) => (
      arcs.slice(index * LEGENDS_PER_PAGE, index * LEGENDS_PER_PAGE + LEGENDS_PER_PAGE)
    ));
  }, [arcs]);

  const legendIndicatorWidths = useMemo(
    () => legendPages.map((_, index) => new Animated.Value(index === legendPage ? 28 : 14)),
    [legendPages.length],
  );

  const goToLegendPage = (nextPage: number) => {
    const clampedPage = Math.max(0, Math.min(legendPages.length - 1, nextPage));
    if (clampedPage === legendPageRef.current) return;
    legendPageRef.current = clampedPage;
    setLegendPage(clampedPage);
    Animated.parallel(
      legendIndicatorWidths.map((indicatorWidth, index) =>
        Animated.spring(indicatorWidth, {
          toValue: index === clampedPage ? 28 : 14,
          useNativeDriver: false,
          damping: 14,
          stiffness: 160,
        }),
      ),
    ).start();
  };

  const handleLegendScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextPage = Math.round(event.nativeEvent.contentOffset.x / legendSnapWidth);
    goToLegendPage(nextPage);
  };

  const handleLegendScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextPage = Math.round(event.nativeEvent.contentOffset.x / legendSnapWidth);
    goToLegendPage(nextPage);
  };

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.chartWrap, { height: chartContainerHeightAnim, overflow: 'hidden' }]}>
        <Svg width={chartWidth} height={chartHeight}>
          {arcs.map((arc) => (
            <AnimatedPath
              key={`track-${arc.id}`}
              d={arc.path}
              fill="none"
              stroke={theme.mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)'}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              opacity={getArcOpacity(arc.id)}
            />
          ))}
          {arcs.map((arc, index) => {
            if (arc.pct <= 0) return null;
            const stagger = arcs.length > 1 ? (index / (arcs.length - 1)) * 0.12 : 0;
            const arcPct = Math.max(0, Math.min(1, (drawPct - stagger) / Math.max(0.01, 1 - stagger)));
            return (
              <AnimatedPath
                key={`fill-${arc.id}`}
                d={arc.path}
                fill="none"
                stroke={arc.color}
                strokeDasharray={`${arc.arcLength * arc.pct * arcPct} ${arc.arcLength}`}
                strokeLinecap="round"
                strokeWidth={strokeWidth}
                opacity={getArcOpacity(arc.id)}
              />
            );
          })}
        </Svg>
      </Animated.View>

      <Text style={styles.legendHint}>Presiona una categoría para filtrarla</Text>

      {arcs.length > LEGENDS_PER_PAGE ? (
        <View>
          <ScrollView
            horizontal
            directionalLockEnabled
            decelerationRate="fast"
            nestedScrollEnabled
            snapToAlignment="start"
            snapToInterval={legendSnapWidth}
            showsHorizontalScrollIndicator={false}
            style={[styles.legendScroller, { width: legendWidth }]}
            contentContainerStyle={styles.legendScrollerContent}
            onScroll={handleLegendScroll}
            onMomentumScrollEnd={handleLegendScrollEnd}
            scrollEventThrottle={16}
          >
            {legendPages.map((page, index) => (
              <View
                key={index}
                style={[
                  styles.legendPage,
                  { width: legendWidth, marginRight: index === legendPages.length - 1 ? 0 : LEGEND_PAGE_GAP },
                ]}
              >
                {page.map((slice) => (
                  <LegendRow
                    key={slice.id}
                    slice={slice}
                    isDisabled={disabledIds?.has(slice.id) ?? false}
                    onPress={() => onLegendToggle?.(slice.id)}
                    width={legendColumnWidth}
                    currency={currency}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
          <View style={styles.indicators}>
            {legendPages.map((_, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.indicator,
                  {
                    backgroundColor: index === legendPage ? (theme.mode === 'light' ? '#0F172A' : '#FFFFFF') : (theme.mode === 'light' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.34)'),
                    width: legendIndicatorWidths[index],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.legend, { width: legendWidth }]}>
          {arcs.map((slice) => (
            <LegendRow
              key={slice.id}
              slice={slice}
              isDisabled={disabledIds?.has(slice.id) ?? false}
              onPress={() => onLegendToggle?.(slice.id)}
              width={legendColumnWidth}
              currency={currency}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    marginHorizontal: 0,
    marginTop: 16,
    paddingBottom: 2,
  },
  chartWrap: {
    alignItems: 'center',
    marginTop: 4,
    position: 'relative',
  },
  dot: {
    borderRadius: 5,
    flexShrink: 0,
    height: 10,
    width: 10,
  },
  indicators: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingTop: 8,
  },
  indicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 999,
    height: 4,
    width: 14,
  },
  indicatorActive: {
    backgroundColor: '#1F2937',
    width: 28,
  },
  legendHint: {
    alignSelf: 'flex-start',
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: 20,
    paddingBottom: 6,
    paddingTop: 2,
  },
  legend: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 10,
  },
  legendAmt: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 'auto',
  },
  legendAmtOver: {
    color: '#DC2626',
  },
  legendName: {
    color: theme.textPrimary,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    minWidth: 0,
  },
  legendPage: {
    alignContent: 'center',
    flexShrink: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  legendRow: {
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  legendRowDisabled: {
    backgroundColor: theme.mode === 'light' ? '#E5E7EB' : 'rgba(255,255,255,0.04)',
  },
  legendNameDisabled: {
    color: theme.textMuted,
  },
  legendScroller: {
    alignSelf: 'center',
    marginTop: 10,
  },
  legendScrollerContent: {
    alignItems: 'flex-start',
  },
  pressed: {
    opacity: 0.72,
  },
});
