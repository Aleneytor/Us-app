import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { TagChip } from '../../components/TagChip';
import { TransactionTile } from '../../components/TransactionTile';
import { TransactionModal } from '../../modals/TransactionModal';
import { useAppStore } from '../../store/useAppStore';
import { USERS } from '../../types';
import { calcDashboard } from '../../utils/calculations';
import { isMonthVisible } from '../../utils/filters';
import { formatYM } from '../../utils/format';

const HERO_SLIDES = [
  { key: 'available', label: 'saldo actual', amountKey: 'disponible', accent: '#22C55E' },
  { key: 'spent', label: 'gasto del mes', amountKey: 'gastos', accent: '#E11D48' },
  { key: 'saved', label: 'ahorrado', amountKey: 'ahorrado', accent: '#7C3AED' },
] as const;

export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [activeHero, setActiveHero] = useState(0);
  const [createKind, setCreateKind] = useState<'income' | 'expense' | null>(null);
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const selectedYM = useAppStore((s) => s.selectedYM);

  const dash = calcDashboard(payload, currentUser, selectedYM);
  const user = USERS[currentUser];
  const activeSlide = HERO_SLIDES[activeHero] ?? HERO_SLIDES[0];

  const recent = payload.expenses
    .filter((t) => t.uid === currentUser && !t.del && isMonthVisible(t, selectedYM))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, 5);

  const tagCounts = new Map<string, number>();
  for (const t of payload.expenses) {
    if (!t.del && isMonthVisible(t, selectedYM)) {
      for (const tag of t.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag]) => tag);

  const handleHeroScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveHero(Math.max(0, Math.min(HERO_SLIDES.length - 1, nextIndex)));
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.heroHeader}>
        <View>
          <TouchableOpacity activeOpacity={0.7} style={styles.helloButton}>
            <Text style={styles.hello}>¡Hola, {user.name}!</Text>
            <Ionicons name="swap-vertical" size={14} color="#94A3B8" />
          </TouchableOpacity>
          <Text style={styles.subtitle}>
            Este es tu <Text style={[styles.subtitleAccent, { color: activeSlide.accent }]}>{activeSlide.label}</Text>
          </Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} style={styles.menuButton}>
          <Ionicons name="menu" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleHeroScroll}
        scrollEventThrottle={16}
        style={styles.heroCarousel}
      >
        {HERO_SLIDES.map((slide) => (
          <View key={slide.key} style={[styles.heroSlide, { width }]}>
            <View style={[styles.monthBadge, { backgroundColor: slide.accent }]}>
              <Text style={styles.monthText}>{formatYM(selectedYM)}</Text>
            </View>
            <HeroAmount
              amount={dash[slide.amountKey]}
              color={slide.amountKey === 'disponible' && dash.disponible < 0 ? '#E11D48' : slide.accent}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {HERO_SLIDES.map((slide, index) => (
          <View
            key={slide.key}
            style={[
              styles.dot,
              activeHero === index && { backgroundColor: slide.accent },
            ]}
          />
        ))}
      </View>

      <View style={styles.heroActions}>
        <TouchableOpacity
          activeOpacity={0.78}
          style={styles.heroButton}
          onPress={() => setCreateKind('income')}
        >
          <Ionicons name="arrow-up" size={17} color="#0F172A" />
          <Text style={styles.heroButtonText}>Ingreso</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.78}
          style={styles.heroButton}
          onPress={() => setCreateKind('expense')}
        >
          <Ionicons name="arrow-down" size={17} color="#0F172A" />
          <Text style={styles.heroButtonText}>Gasto</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recientes</Text>
          <TouchableOpacity onPress={() => router.push('/movimientos')}>
            <Text style={styles.link}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {recent.length === 0 ? (
          <Text style={styles.empty}>Sin movimientos este mes</Text>
        ) : (
          <View style={styles.tileList}>
            {recent.map((t) => (
              <TransactionTile
                key={t.id}
                transaction={t}
                ym={selectedYM}
                onPress={() => router.push('/movimientos')}
              />
            ))}
          </View>
        )}
      </View>

      {topTags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags del mes</Text>
          <View style={styles.tagCloud}>
            {topTags.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                onPress={() => router.push('/movimientos')}
              />
            ))}
          </View>
        </View>
      )}

      <TransactionModal
        visible={createKind !== null}
        initialKind={createKind ?? 'expense'}
        onClose={() => setCreateKind(null)}
      />
    </ScrollView>
  );
}

function HeroAmount({ amount, color }: { amount: number; color: string }) {
  const sign = amount < 0 ? '-' : '';
  const [whole, decimals = '00'] = Math.abs(amount).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).split(',');

  return (
    <Text style={[styles.heroAmount, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
      <Text style={styles.currency}>€</Text>
      {sign}{whole}
      <Text style={styles.decimals}>,{decimals}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  scroll:       { flex: 1, backgroundColor: '#EDF2F7' },
  content:      { paddingBottom: 40 },
  heroHeader:   { paddingHorizontal: 32, paddingTop: 34, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  helloButton:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hello:        { color: '#0F172A', fontSize: 22, fontWeight: '800', lineHeight: 27 },
  subtitle:     { marginTop: 4, color: '#475569', fontSize: 13.5, fontWeight: '500' },
  subtitleAccent: { fontWeight: '800' },
  menuButton:   { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  heroCarousel: { marginTop: 28 },
  heroSlide:    { alignItems: 'center', gap: 13, paddingBottom: 8 },
  monthBadge:   { minHeight: 32, minWidth: 82, borderRadius: 999, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  monthText:    { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  heroAmount:   { fontSize: 58, fontWeight: '700', lineHeight: 66, color: '#0F172A' },
  currency:     { fontSize: 25, fontWeight: '500' },
  decimals:     { color: '#94A3B8', fontSize: 26, fontWeight: '700' },
  dots:         { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingTop: 8, paddingBottom: 18 },
  dot:          { width: 27, height: 3, borderRadius: 3, backgroundColor: '#CBD5E1' },
  heroActions:  { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 22 },
  heroButton:   { flex: 1, height: 44, borderRadius: 13, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroButtonText: { color: '#0F172A', fontSize: 15, fontWeight: '700' },
  section:      { marginTop: 20, paddingHorizontal: 16 },
  sectionHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  link:         { fontSize: 13, color: '#2563EB', fontWeight: '600' },
  tileList:     { gap: 8 },
  empty:        { color: '#94A3B8', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  tagCloud:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
