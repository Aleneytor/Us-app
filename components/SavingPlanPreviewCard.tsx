import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { getIconColor, type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import type { SavingPlan } from '../types';
import { savingPlanProgress } from '../utils/calculations';
import { fmt } from '../utils/format';
import { useAppStore } from '../store/useAppStore';

const SAVINGS_ACCENT = '#7C3AED';
const SAVINGS_COLOR_ID = 'purple';
const COMPLETE_COLOR = '#16A34A';

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
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const progress = savingPlanProgress(plan);
  const progressPct = Math.min(100, Math.round(progress.pct));
  const colorId = plan.iconColor ?? SAVINGS_COLOR_ID;
  const iconColor = getIconColor(colorId);
  const iconInfo = CATEGORIES[plan.icon ?? 'savings'] ?? CATEGORIES.savings;
  const isComplete = progressPct >= 100;
  const isJoint = plan.type === 'joint';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={readOnly ? undefined : onEdit}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor.color }]}>
          <Ionicons name={iconInfo.icon} size={20} color="#FFFFFF" />
        </View>

        <View style={styles.titleGroup}>
          <Text numberOfLines={1} style={styles.title}>{plan.title}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, isJoint ? styles.badgeJoint : styles.badgePersonal]}>
              <Ionicons
                name={isJoint ? 'people-outline' : 'person-outline'}
                size={10}
                color={isJoint ? SAVINGS_ACCENT : theme.textMuted}
              />
              <Text style={[styles.badgeText, isJoint ? styles.badgeTextJoint : styles.badgeTextPersonal]}>
                {isJoint ? 'Conjunto' : 'Personal'}
              </Text>
            </View>
            {plan.months ? (
              <View style={styles.monthsBadge}>
                <Ionicons name="time-outline" size={10} color={theme.textMuted} />
                <Text style={styles.monthsBadgeText}>{plan.months}m</Text>
              </View>
            ) : null}
          </View>
        </View>

        {plan.link ? (
          <Pressable
            accessibilityLabel="Abrir link del ahorro"
            onPress={(e) => { e.stopPropagation(); onOpenLink?.(); }}
            style={({ pressed }) => [styles.linkButton, pressed && { opacity: 0.55 }]}
          >
            <Ionicons name="link-outline" size={15} color={SAVINGS_ACCENT} />
          </Pressable>
        ) : null}
      </View>

      {/* Saved amount — prominent */}
      <View style={styles.amountSection}>
        <Text style={styles.savedAmount} numberOfLines={1}>
          {fmt(progress.total, currency)}
        </Text>
        <Text style={styles.savedSubtitle} numberOfLines={1}>
          de {fmt(plan.targetAmount, currency)} · meta
        </Text>
      </View>

      {/* Progress bar + percentage */}
      <View style={styles.progressRow}>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${progressPct}%` as `${number}%` },
              isComplete && styles.barFillComplete,
            ]}
          />
        </View>
        <Text style={[styles.pctText, isComplete && styles.pctTextComplete]}>
          {progressPct}%
        </Text>
      </View>

      {/* Footer line */}
      <View style={styles.footer}>
        {isComplete ? (
          <View style={styles.completeRow}>
            <Ionicons name="checkmark-circle" size={13} color={COMPLETE_COLOR} />
            <Text style={styles.completeText}>¡Meta alcanzada!</Text>
          </View>
        ) : (
          <Text style={styles.remainingText} numberOfLines={1}>
            Falta{' '}
            <Text style={styles.remainingAmount}>{fmt(progress.remaining, currency)}</Text>
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderColor: 'rgba(124, 58, 237, 0.22)',
    borderRadius: 16,
    borderWidth: 1,
    elevation: 3,
    paddingHorizontal: 15,
    paddingVertical: 14,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.mode === 'light' ? 0.05 : 0.10,
    shadowRadius: 10,
  },
  pressed: {
    opacity: 0.72,
  },
  // — Header —
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 14,
    flexShrink: 0,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  titleGroup: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  title: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  badge: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeJoint: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderColor: 'rgba(124, 58, 237, 0.35)',
  },
  badgePersonal: {
    backgroundColor: theme.mode === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
    borderColor: theme.mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextJoint: {
    color: SAVINGS_ACCENT,
  },
  badgeTextPersonal: {
    color: theme.textMuted,
  },
  monthsBadge: {
    alignItems: 'center',
    backgroundColor: theme.mode === 'light' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.06)',
    borderColor: theme.mode === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.10)',
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  monthsBadgeText: {
    color: theme.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  // — Amount —
  amountSection: {
    gap: 1,
    marginTop: 13,
  },
  savedAmount: {
    color: theme.textPrimary,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 26,
    lineHeight: 30,
  },
  savedSubtitle: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  // — Progress —
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  barTrack: {
    backgroundColor: theme.mode === 'light' ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.10)',
    borderRadius: 5,
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: SAVINGS_ACCENT,
    borderRadius: 5,
    height: '100%',
  },
  barFillComplete: {
    backgroundColor: COMPLETE_COLOR,
  },
  pctText: {
    color: SAVINGS_ACCENT,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '900',
    minWidth: 30,
    textAlign: 'right',
  },
  pctTextComplete: {
    color: COMPLETE_COLOR,
  },
  // — Footer —
  footer: {
    marginTop: 8,
  },
  remainingText: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  remainingAmount: {
    color: SAVINGS_ACCENT,
    fontWeight: '800',
  },
  completeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  completeText: {
    color: COMPLETE_COLOR,
    fontSize: 11,
    fontWeight: '700',
  },
});
