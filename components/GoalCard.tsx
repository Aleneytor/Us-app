import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { getIconColor, type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
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
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const category = CATEGORIES[goal.cat] ?? CATEGORIES.other;
  const iconColor = getIconColor(goal.iconColor);
  const progress = goalProgress(goal, contribs);
  const pct = Math.min(100, Math.round(progress.pct));

  return (
    <Pressable
      onLongPress={readOnly ? undefined : onEdit}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColor.color }]}>
        {goal.em ? (
          <Text style={styles.emoji}>{goal.em}</Text>
        ) : (
          <Ionicons name={category.icon} size={20} color="#FFFFFF" />
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <View style={styles.nameGroup}>
            <Text numberOfLines={1} style={styles.name}>{goal.name}</Text>
            <Text style={styles.meta}>
              {goal.type === 'joint' ? 'Conjunto' : 'Personal'} · {formatDateShort(goal.date)}
            </Text>
          </View>
          <Text style={styles.targetText} numberOfLines={1}>{fmt(goal.target, currency)}</Text>
        </View>

        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` as `${number}%`, backgroundColor: iconColor.color }]} />
        </View>

        <View style={styles.amountRow}>
          <Text style={[styles.savedText, { color: iconColor.color }]} numberOfLines={1}>
            {fmt(progress.total, currency)}
          </Text>
          {readOnly ? (
            <Text style={styles.readOnly}>Solo lectura</Text>
          ) : (
            <Text style={styles.remaining} numberOfLines={1}>
              {fmt(progress.remaining, currency)} restantes
            </Text>
          )}
        </View>

        {!readOnly && (
          <View style={styles.actions}>
            <Pressable onPress={onDelete} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Ionicons name="trash-outline" size={18} color={theme.red} />
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

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  amountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 5,
  },
  barFill: {
    borderRadius: 3,
    height: '100%',
  },
  barTrack: {
    backgroundColor: theme.mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.16)',
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    overflow: 'hidden',
    width: '100%',
  },
  card: {
    alignItems: 'flex-start',
    backgroundColor: theme.surface,
    borderRadius: 16,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.mode === 'light' ? 0.08 : 0.10,
    shadowRadius: 8,
  },
  contribute: {
    alignItems: 'center',
    backgroundColor: theme.blue,
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
    fontSize: 18,
  },
  iconButton: {
    alignItems: 'center',
    borderColor: theme.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  meta: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  name: {
    color: theme.textPrimary,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  nameGroup: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 6,
  },
  pressed: {
    opacity: 0.72,
  },
  readOnly: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  remaining: {
    color: theme.textMuted,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  savedText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
  },
  targetText: {
    color: theme.textSecondary,
    flexShrink: 0,
    fontSize: 10,
    fontWeight: '500',
  },
});
