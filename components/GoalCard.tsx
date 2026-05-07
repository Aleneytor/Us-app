import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import type { Contribution, Goal } from '../types';
import { goalProgress } from '../utils/calculations';
import { formatDateShort, fmt } from '../utils/format';
import { useAppStore } from '../store/useAppStore';

interface GoalCardProps {
  goal: Goal;
  contribs: Contribution[];
  onContribute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPress?: () => void;
  readOnly?: boolean;
}

export function GoalCard({
  goal,
  contribs,
  onContribute,
  onEdit,
  onDelete,
  onPress,
  readOnly = false,
}: GoalCardProps) {
  const currency = useAppStore((s) => s.currency);
  const category = CATEGORIES[goal.cat] ?? CATEGORIES.other;
  const iconColor = getIconColor(goal.iconColor);
  const progress = goalProgress(goal, contribs);
  const pct = Math.round(progress.pct);

  return (
    <Pressable
      onLongPress={readOnly ? undefined : onEdit}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: iconColor.bg }]}>
          {goal.em ? (
            <Text style={styles.emoji}>{goal.em}</Text>
          ) : (
            <Ionicons name={category.icon} size={24} color={iconColor.color} />
          )}
        </View>

        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.title}>{goal.name}</Text>
          <Text style={styles.meta}>
            {goal.type === 'joint' ? 'Conjunto' : 'Personal'} · {formatDateShort(goal.date)}
          </Text>
        </View>

        <Text style={styles.saved}>{fmt(progress.total, currency)}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: iconColor.color, width: `${pct}%` },
          ]}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.progressText}>
          {pct}% · faltan {fmt(progress.remaining, currency)}
        </Text>

        {readOnly ? (
          <Text style={styles.readOnly}>Solo lectura</Text>
        ) : (
          <View style={styles.actions}>
            <Pressable onPress={onDelete} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons name="trash-outline" size={18} color={APP_COLORS.expense} />
            </Pressable>
            <Pressable onPress={onContribute} style={({ pressed }) => [styles.contribute, pressed && styles.pressed]}>
              <Ionicons name="add" size={17} color="#FFFFFF" />
              <Text style={styles.contributeText}>Aportar</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  contribute: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.blue,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 4,
    height: 34,
    paddingHorizontal: 10,
  },
  contributeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emoji: {
    fontSize: 22,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
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
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
    maxWidth: '100%',
  },
  progressText: {
    color: APP_COLORS.textSecondary,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    height: 9,
    overflow: 'hidden',
  },
  readOnly: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  saved: {
    color: APP_COLORS.textPrimary,
    flexShrink: 0,
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  titleBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
});
