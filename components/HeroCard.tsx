import { View, Text, StyleSheet } from 'react-native';
import { fmt } from '../utils/format';

interface HeroCardProps {
  label: string;
  amount: number;
  color: string;
  bg: string;
}

export function HeroCard({ label, amount, color, bg }: HeroCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.amount, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {fmt(Math.abs(amount))}
      </Text>
      {amount < 0 && (
        <Text style={[styles.negative, { color }]}>negativo</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 150,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  amount: {
    fontSize: 20,
    fontWeight: '700',
  },
  negative: {
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.7,
  },
});
