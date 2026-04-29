import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import type { Wish } from '../types';
import { wishMonthlySaving } from '../utils/calculations';
import { fmt } from '../utils/format';
import { TagChip } from './TagChip';

interface WishCardProps {
  wish: Wish;
  onPress: () => void;
  onLongPress?: () => void;
}

export function WishCard({ wish, onPress, onLongPress }: WishCardProps) {
  const category = CATEGORIES[wish.cat] ?? CATEGORIES.other;
  const iconColor = getIconColor(wish.iconColor);
  const monthly = wishMonthlySaving(wish);

  return (
    <Pressable
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColor.bg }]}>
        {wish.em ? (
          <Text style={styles.emoji}>{wish.em}</Text>
        ) : (
          <Ionicons name={category.icon} size={24} color={iconColor.color} />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text numberOfLines={1} style={styles.title}>{wish.name}</Text>
          <Text style={styles.price}>{fmt(wish.price)}</Text>
        </View>

        {wish.tags.length > 0 ? (
          <View style={styles.tags}>
            {wish.tags.slice(0, 4).map((tag) => (
              <TagChip key={tag} tag={tag} small />
            ))}
          </View>
        ) : null}

        <Text style={styles.meta}>
          {wish.months ? `${wish.months} meses` : 'Sin plazo'}
          {monthly ? ` · ${fmt(monthly)}/mes` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  card: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  emoji: {
    fontSize: 22,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  meta: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
  price: {
    color: APP_COLORS.textPrimary,
    flexShrink: 0,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  title: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  topLine: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
