import { useMemo, useRef, useState } from 'react';
import {
  Animated,
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
import { APP_COLORS } from '../constants/colors';
import type { CurrencyCode } from '../types';
import { fmt } from '../utils/format';

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
  onSlicePress?: (slice: DonutSlice) => void;
}

const ARC_START_DEG = 126;
const ARC_END_DEG = 414;
const LEGENDS_PER_PAGE = 6;
const LEGEND_PAGE_GAP = 32;
const TRACK_COLOR = '#E8EDF3';

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

export function DonutChart({ slices, currency, size, onSlicePress }: Props) {
  const { width } = useWindowDimensions();
  const [legendPage, setLegendPage] = useState(0);
  const legendPageRef = useRef(0);
  const chartWidth = Math.min(size ?? 342, Math.max(286, width - 64));
  const legendWidth = Math.max(286, width - 40);
  const legendSnapWidth = legendWidth + LEGEND_PAGE_GAP;
  const legendColumnWidth = (legendWidth - 8) / 2;
  const cx = chartWidth / 2;
  const outerRadius = chartWidth * 0.41;
  const cy = outerRadius + 20;
  const chartHeight = outerRadius * 2 + 44;
  const sortedSlices = useMemo(
    () => [...slices].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
    [slices],
  );
  const strokeWidth = slices.length > 7 ? 8 : 11;
  const strokeGap = slices.length > 7 ? 5 : 8;
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
        radius,
      };
    });
  }, [arcSpanDeg, cx, cy, outerRadius, sortedSlices, strokeGap, strokeWidth]);

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

  const renderLegendRow = (slice: DonutSlice) => {
    const available = slice.budget - slice.value;
    const isOver = slice.value > slice.budget && slice.budget > 0;
    return (
      <Pressable
        key={slice.id}
        onPress={() => onSlicePress?.(slice)}
        style={({ pressed }) => [
          styles.legendRow,
          { width: legendColumnWidth },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.dot, { backgroundColor: slice.color }]} />
        <Text style={styles.legendName} numberOfLines={1}>{slice.label}</Text>
        <Text style={[styles.legendAmt, isOver && styles.legendAmtOver]} numberOfLines={1}>
          {isOver ? `+${fmt(Math.abs(available), currency)}` : fmt(available, currency)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.chartWrap}>
        <Svg width={chartWidth} height={chartHeight}>
          {arcs.map((arc) => (
            <Path
              key={`track-${arc.label}-${arc.radius}`}
              d={arc.path}
              fill="none"
              stroke={TRACK_COLOR}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
            />
          ))}
          {arcs.map((arc) => (
            arc.pct > 0 ? (
              <Path
                key={`fill-${arc.label}-${arc.radius}`}
                d={arc.path}
                fill="none"
                stroke={arc.color}
                strokeDasharray={arc.dash}
                strokeLinecap="round"
                strokeWidth={strokeWidth}
              />
            ) : null
          ))}
        </Svg>
      </View>

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
                {page.map(renderLegendRow)}
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
                    backgroundColor: index === legendPage ? '#1F2937' : '#DADDE2',
                    width: legendIndicatorWidths[index],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.legend, { width: legendWidth }]}>
          {arcs.map(renderLegendRow)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#DADDE2',
    borderRadius: 999,
    height: 4,
    width: 14,
  },
  indicatorActive: {
    backgroundColor: '#1F2937',
    width: 28,
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
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 'auto',
  },
  legendAmtOver: {
    color: '#DC2626',
  },
  legendName: {
    color: APP_COLORS.textPrimary,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
