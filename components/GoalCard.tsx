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
      {/* Solid category colored rounded square with category icon / emoji */}
      <View style={[styles.colorBlock, { backgroundColor: iconColor.color }]}>
        {goal.em ? (
          <Text style={styles.emoji}>{goal.em}</Text>
        ) : (
          <Ionicons name={category.icon} size={20} color="#FFFFFF" />
        )}
      </View>

      {/* Card Content Column */}
      <View style={styles.cardContent}>
        {/* Top Row: Goal Title & Target Limit */}
        <View style={styles.topRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.categoryTitle} numberOfLines={1}>
              {goal.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {goal.type === 'joint' ? 'Conjunto' : 'Personal'} · {formatDateShort(goal.date)}
            </Text>
          </View>
          <Text style={styles.budgetLimit} numberOfLines={1}>{fmt(goal.target, currency)}</Text>
        </View>

        {/* Middle Row: Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${pct}%` as `${number}%`, backgroundColor: iconColor.color }]} />
        </View>

        {/* Bottom Row: Saved Amount & Remaining / Read-only state */}
        <View style={styles.bottomRow}>
          <Text style={styles.spentAmount} numberOfLines={1}>
            {fmt(progress.total, currency)}
          </Text>
          {readOnly ? (
            <Text style={styles.readOnly}>Solo lectura</Text>
          ) : (
            <Text style={[styles.remainingAmount, { color: iconColor.color }]} numberOfLines={1}>
              Falta {fmt(progress.remaining, currency)}
            </Text>
          )}
        </View>

        {/* Actions row */}
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
  card: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 11,
    position: 'relative',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.mode === 'light' ? 0.05 : 0.12,
    shadowRadius: 8,
    overflow: 'visible',
  },
  colorBlock: {
    alignItems: 'center',
    borderRadius: 12,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  topRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
    width: '100%',
  },
  categoryTitle: {
    color: '#24282D',
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14.5,
  },
  meta: {
    color: 'rgba(36, 40, 45, 0.65)',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginTop: 1,
  },
  budgetLimit: {
    color: '#24282D',
    flexShrink: 0,
    fontFamily: 'Poppins_500Medium',
    fontSize: 14.5,
    textAlign: 'right',
  },
  progressBarTrack: {
    backgroundColor: 'rgba(36, 40, 45, 0.08)',
    borderRadius: 99,
    height: 5,
    marginVertical: 4,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    borderRadius: 99,
    height: '100%',
  },
  bottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  spentAmount: {
    color: 'rgba(36, 40, 45, 0.65)',
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
  },
  remainingAmount: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    textAlign: 'right',
  },
  readOnly: {
    color: 'rgba(36, 40, 45, 0.65)',
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    textAlign: 'right',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 8,
    width: '100%',
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
    fontFamily: 'Poppins_700Bold',
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
  pressed: {
    opacity: 0.72,
  },
});
