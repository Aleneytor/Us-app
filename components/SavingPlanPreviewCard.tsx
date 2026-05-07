import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';
import type { SavingPlan } from '../types';
import { savingPlanProgress } from '../utils/calculations';
import { fmt } from '../utils/format';
import { useAppStore } from '../store/useAppStore';

const SAVINGS_ACCENT = '#7C3AED';
const SAVINGS_COLOR_ID = 'purple';

interface SavingPlanPreviewCardProps {
  plan: SavingPlan;
  onPress: () => void;
  onOpenLink?: () => void;
  onEdit?: () => void;
  readOnly?: boolean;
}

export function SavingPlanPreviewCard({
  plan,
  onPress,
  onOpenLink,
  onEdit,
  readOnly = false,
}: SavingPlanPreviewCardProps) {
  const currency = useAppStore((s) => s.currency);
  const progress = savingPlanProgress(plan);
  const progressPct = Math.round(progress.pct);
  const iconColor = getIconColor(SAVINGS_COLOR_ID);
  const iconInfo = CATEGORIES[plan.icon ?? 'savings'] ?? CATEGORIES.savings;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={readOnly ? undefined : onEdit}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor.bg }]}>
          <Ionicons name={iconInfo.icon} size={20} color={iconColor.color} />
        </View>
        <Text numberOfLines={1} style={styles.title}>{plan.title}</Text>
        {plan.link ? (
          <Pressable
            accessibilityLabel="Abrir link del ahorro"
            onPress={(event) => {
              event.stopPropagation();
              onOpenLink?.();
            }}
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
          >
            <Ionicons name="link-outline" size={17} color={SAVINGS_ACCENT} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.barRow}>
        <Text style={styles.totalText} numberOfLines={1}>
          {fmt(plan.targetAmount, currency)}
        </Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${progressPct}%` as `${number}%` },
            ]}
          />
        </View>
        <Text style={styles.remainingText} numberOfLines={1}>
          {fmt(progress.remaining, currency)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barFill: {
    backgroundColor: SAVINGS_ACCENT,
    borderRadius: 3,
    height: '100%',
  },
  barRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  barTrack: {
    backgroundColor: '#EEF0F3',
    borderRadius: 3,
    flex: 1,
    height: 6,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 16,
    elevation: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#7E7E7E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  linkButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 16,
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  pressed: {
    opacity: 0.72,
  },
  remainingText: {
    color: SAVINGS_ACCENT,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 58,
    textAlign: 'right',
  },
  title: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  totalText: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 58,
  },
});
