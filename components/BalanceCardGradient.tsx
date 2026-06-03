import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { CardState } from './BalanceCard';

type HeroPalette = {
  base: string;
  soft: string;
  bright: string;
  glow: string;
  deep: string;
  shade: string;
  veil: string;
};

const BALANCE_PALETTES = {
  base:  { base: '#19B85A', soft: '#47E484', bright: '#76F05A', glow: '#C8F92F', deep: '#087A42', shade: '#075F35', veil: '#149B50' },
  shift: { base: '#16A85A', soft: '#50EE95', bright: '#8AF265', glow: '#BFF529', deep: '#066D3B', shade: '#064F2F', veil: '#108D4A' },
};

const EXPENSE_PALETTES = {
  base:  { base: '#EC1147', soft: '#FF5A3D', bright: '#FF7D32', glow: '#FFB33F', deep: '#C9002F', shade: '#A8002A', veil: '#FF2B4F' },
  shift: { base: '#E6003A', soft: '#FF7040', bright: '#FF9838', glow: '#FFD24A', deep: '#B90035', shade: '#95002B', veil: '#FF365C' },
};

function GradientSvg({ palette, idPrefix }: { palette: HeroPalette; idPrefix: string }) {
  const brightId = `${idPrefix}-bright`;
  const deepId   = `${idPrefix}-deep`;
  const glowId   = `${idPrefix}-glow`;
  const softId   = `${idPrefix}-soft`;
  const shadeId  = `${idPrefix}-shade`;
  const veilId   = `${idPrefix}-veil`;

  return (
    <Svg width="100%" height="100%" viewBox="0 0 430 360" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={brightId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={palette.bright} stopOpacity="1" />
          <Stop offset="70%"  stopColor={palette.bright} stopOpacity="0.72" />
          <Stop offset="100%" stopColor={palette.bright} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={deepId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={palette.deep} stopOpacity="1" />
          <Stop offset="74%"  stopColor={palette.deep} stopOpacity="0.84" />
          <Stop offset="100%" stopColor={palette.deep} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={palette.glow} stopOpacity="1" />
          <Stop offset="66%"  stopColor={palette.glow} stopOpacity="0.66" />
          <Stop offset="100%" stopColor={palette.glow} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={softId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={palette.soft} stopOpacity="1" />
          <Stop offset="72%"  stopColor={palette.soft} stopOpacity="0.76" />
          <Stop offset="100%" stopColor={palette.soft} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={shadeId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={palette.shade} stopOpacity="0.86" />
          <Stop offset="72%"  stopColor={palette.shade} stopOpacity="0.44" />
          <Stop offset="100%" stopColor={palette.shade} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={veilId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={palette.veil} stopOpacity="0.7" />
          <Stop offset="100%" stopColor={palette.veil} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="430" height="360" fill={palette.base} />
      <Ellipse cx="28"  cy="42"  rx="214" ry="176" fill={`url(#${deepId})`}  opacity="0.74" />
      <Ellipse cx="132" cy="104" rx="218" ry="150" fill={`url(#${shadeId})`} opacity="0.38" />
      <Ellipse cx="188" cy="86"  rx="202" ry="162" fill={`url(#${softId})`}  opacity="0.44" />
      <Ellipse cx="365" cy="52"  rx="190" ry="150" fill={`url(#${brightId})`} opacity="0.6" />
      <Ellipse cx="50"  cy="286" rx="230" ry="148" fill={`url(#${glowId})`}  opacity="0.88" />
      <Ellipse cx="248" cy="220" rx="240" ry="132" fill={`url(#${shadeId})`} opacity="0.3" />
      <Ellipse cx="238" cy="258" rx="248" ry="150" fill={`url(#${softId})`}  opacity="0.52" />
      <Ellipse cx="426" cy="292" rx="226" ry="160" fill={`url(#${brightId})`} opacity="0.72" />
      <Ellipse cx="214" cy="178" rx="246" ry="150" fill={`url(#${veilId})`}  opacity="0.52" />
      <Ellipse cx="232" cy="360" rx="310" ry="126" fill={`url(#${softId})`}  opacity="0.36" />
    </Svg>
  );
}

function GradientLayers({
  palettes,
  idPrefix,
  animatedLayerStyle,
}: {
  palettes: { base: HeroPalette; shift: HeroPalette };
  idPrefix: string;
  animatedLayerStyle: any;
}) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <GradientSvg palette={palettes.base} idPrefix={`${idPrefix}-base`} />
      <Animated.View style={[StyleSheet.absoluteFill, animatedLayerStyle]}>
        <GradientSvg palette={palettes.shift} idPrefix={`${idPrefix}-shift`} />
      </Animated.View>
    </View>
  );
}

export function BalanceCardGradient({ state }: { state: CardState }) {
  const pulse    = useRef(new Animated.Value(0)).current;
  const drift    = useRef(new Animated.Value(0)).current;
  const themeMix = useRef(new Animated.Value(state === 'gastos' ? 1 : 0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 6200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 6200, useNativeDriver: true }),
      ]),
    );
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 9800, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 9800, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    driftLoop.start();
    return () => { pulseLoop.stop(); driftLoop.stop(); };
  }, [drift, pulse]);

  useEffect(() => {
    Animated.timing(themeMix, {
      toValue: state === 'gastos' ? 1 : 0,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [state, themeMix]);

  const shiftStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.36] }),
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-8, 10] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [8, -6] }) },
      { scale:      drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
    ],
  };

  const balanceOpacity = themeMix.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const expenseOpacity = themeMix;

  return (
    <View pointerEvents="none" style={canvas.gradientCanvas}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: balanceOpacity }]}>
        <GradientLayers palettes={BALANCE_PALETTES} idPrefix="balance" animatedLayerStyle={shiftStyle} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: expenseOpacity }]}>
        <GradientLayers palettes={EXPENSE_PALETTES} idPrefix="expense" animatedLayerStyle={shiftStyle} />
      </Animated.View>
    </View>
  );
}

const canvas = StyleSheet.create({
  gradientCanvas: {
    bottom: -36,
    left: -28,
    position: 'absolute',
    right: -28,
    top: -18,
  },
});
