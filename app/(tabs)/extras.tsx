import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserHeaderButton } from '../../components/UserHeaderButton';
import { type AppTheme } from '../../constants/colors';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useTabPadding } from '../../hooks/useTabPadding';
import { reportFabScroll } from '../../utils/fabScroll';
import { useTheme } from '../../contexts/ThemeContext';

const EXTRAS_OPTIONS = [
  {
    key: 'ahorros',
    route: '/(tabs)/ahorros',
    label: 'Ahorros',
    subtitle: 'Metas & planes de ahorro',
    description: 'Registra aportes, visualiza tu progreso y alcanza tus metas financieras juntos.',
    icon: 'wallet-outline' as const,
    accent: '#8B5CF6',
    accentDeep: '#4C1D95',
    accentBorder: 'rgba(139, 92, 246, 0.30)',
    gradientId: 'g_ahorros',
  },
  {
    key: 'planes',
    route: '/(tabs)/ahorro',
    label: 'Planes',
    subtitle: 'Gastos compartidos',
    description: 'Organiza viajes, eventos y proyectos. Divide y controla cada gasto fácilmente.',
    icon: 'map-outline' as const,
    accent: '#60A5FA',
    accentDeep: '#1E3A8A',
    accentBorder: 'rgba(96, 165, 250, 0.30)',
    gradientId: 'g_planes',
  },
] as const;

export default function ExtrasScreen() {
  const tabPadding = useTabPadding();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { contentAnim } = useEntranceAnimation();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.screen}>
      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.screenTitle}>Extras</Text>
        <UserHeaderButton />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabPadding }]}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        onScroll={(event) => reportFabScroll(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        <Animated.View
          style={[
            styles.cards,
            {
              opacity: contentAnim,
              transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
            },
          ]}
        >
          {EXTRAS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => router.navigate(opt.route as never)}
              style={({ pressed }) => [
                styles.card,
                { borderColor: theme.border, shadowColor: opt.accent },
                pressed && styles.pressed,
              ]}
            >
              <CardGradient accent={opt.accent} accentDeep={opt.accentDeep} id={opt.gradientId} />

              {/* Icon + title row */}
              <View style={styles.cardTop}>
                <View style={[styles.cardIconWrap, { backgroundColor: opt.accent, borderColor: opt.accent }]}>
                  <Ionicons name={opt.icon} size={26} color="#FFFFFF" />
                </View>
                <View style={styles.cardTopText}>
                  <Text style={styles.cardLabel}>{opt.label}</Text>
                  <Text style={[styles.cardSubtitle, { color: opt.accent }]}>{opt.subtitle}</Text>
                </View>
              </View>

              {/* Description */}
              <Text style={styles.cardDesc}>{opt.description}</Text>

              {/* Footer CTA */}
              <View style={styles.cardFooter}>
                <View style={[styles.cardCta, { borderColor: opt.accentBorder }]}>
                  <Text style={[styles.cardCtaText, { color: opt.accent }]}>Abrir</Text>
                  <Ionicons name="arrow-forward" size={13} color={opt.accent} />
                </View>
              </View>
            </Pressable>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function CardGradient({ accent, accentDeep, id }: { accent: string; accentDeep: string; id: string }) {
  return (
    <Svg
      style={StyleSheet.absoluteFillObject}
      viewBox="0 0 380 190"
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <RadialGradient id={`${id}_1`} cx="12%" cy="45%" r="55%">
          <Stop offset="0%" stopColor={accentDeep} stopOpacity="0.58" />
          <Stop offset="100%" stopColor={accentDeep} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`${id}_2`} cx="88%" cy="80%" r="48%">
          <Stop offset="0%" stopColor={accent} stopOpacity="0.20" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="380" height="190" fill="transparent" />
      <Ellipse cx="46" cy="86" rx="190" ry="150" fill={`url(#${id}_1)`} />
      <Ellipse cx="334" cy="152" rx="155" ry="115" fill={`url(#${id}_2)`} />
    </Svg>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  screen: {
    backgroundColor: t.background,
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 24,
  },
  screenTitle: {
    color: t.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    lineHeight: 32,
  },
  content: {
    paddingTop: 18,
  },
  cards: {
    gap: 16,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: t.surface,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 5,
    overflow: 'hidden',
    padding: 20,
    paddingBottom: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 13,
  },
  cardIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  cardTopText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  cardLabel: {
    color: t.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    lineHeight: 26,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    opacity: 0.88,
  },
  cardDesc: {
    color: t.textSecondary,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    marginBottom: 16,
  },
  cardFooter: {
    alignItems: 'flex-end',
    borderTopColor: t.border,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  cardCta: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  cardCtaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
