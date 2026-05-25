import React, { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Defs, FeGaussianBlur, Filter, Path } from 'react-native-svg';
import type { CurrencyCode } from '../types';

export interface GaugeSlice {
  id: number;
  label: string;
  color: string;
  value: number;
}

interface Props {
  slices: GaugeSlice[];
  currency: CurrencyCode;
}

const STROKE_W = 16;
const GLOW_W = Math.round(STROKE_W * 1.2); // 19 — minimal expansion
const BLUR_SD = 5; // stronger blur for softer diffusion
const BLUR_PAD = Math.ceil(BLUR_SD * 3); // ~15px visual extent of blur
const GAP_DEG = 5;
const EDGE_PAD_DEG = 5;
// TOP_PAD accounts for glow stroke half-width + blur spread above the arc top.
const TOP_PAD = Math.ceil(GLOW_W / 2) + BLUR_PAD + 2;

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

export function SpendingGaugeCard({ slices }: Props) {
  const { width: screenWidth } = useWindowDimensions();

  // Arc dimensions based on normal card inset, but SVG canvas is full screen width
  // so glow at the arc endpoints has room to breathe on both sides.
  const arcWidth = screenWidth - 32;
  const R = Math.floor((arcWidth - STROKE_W) / 2);
  const cx = Math.round(screenWidth / 2);
  const cy = R + TOP_PAD;
  const svgH = cy + STROKE_W / 2 + 6;

  // Degrees each round cap visually extends past its mathematical endpoint.
  // Shrinking each segment by this on both sides gives exactly GAP_DEG visual gap.
  const capAngleDeg = (STROKE_W / (2 * R)) * (180 / Math.PI);

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
    const totalGapDeg = EDGE_PAD_DEG * 2 + (n > 1 ? (n - 1) * GAP_DEG : 0);
    const availableDeg = 180 - totalGapDeg;

    const result: Array<{ slice: GaugeSlice; d1: number; d2: number }> = [];
    // cur = visual start of the segment (where its rounded cap begins)
    let cur = 180 + EDGE_PAD_DEG;

    for (const slice of activeSlices) {
      const span = (slice.value / totalValue) * availableDeg;
      // Shrink mathematical arc so round caps fill exactly to visual boundaries
      const innerSpan = span - 2 * capAngleDeg;
      if (innerSpan > 0.5) {
        result.push({ slice, d1: cur + capAngleDeg, d2: cur + span - capAngleDeg });
      }
      cur += span + GAP_DEG;
    }
    return result;
  }, [activeSlices, totalValue, capAngleDeg]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={screenWidth} height={svgH}>
        <Defs>
          <Filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur in="SourceGraphic" stdDeviation={BLUR_SD} />
          </Filter>
        </Defs>
        {segments.map(({ slice, d1, d2 }) => (
          <React.Fragment key={slice.id}>
            <Path
              d={arcPath(cx, cy, R, d1, d2)}
              fill="none"
              stroke={slice.color}
              strokeWidth={GLOW_W}
              strokeLinecap="round"
              opacity={0.16}
              filter="url(#arc-glow)"
            />
            <Path
              d={arcPath(cx, cy, R, d1, d2)}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE_W}
              strokeLinecap="round"
            />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}
