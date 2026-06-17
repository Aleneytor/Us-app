import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '../constants/categories';
import { getIconColor, type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import type { CurrencyCode, SavingPlan } from '../types';
import { savingPlanProgress, savingPlanSavedAmount } from '../utils/calculations';
import { fmt } from '../utils/format';
import { useAppStore } from '../store/useAppStore';

const SAVINGS_ACCENT = '#7C3AED';
const COMPLETE_COLOR = '#16A34A';

interface SavingPlanPreviewCardProps {
  plan: SavingPlan;
  onPress: () => void;
  onEdit?: () => void;
  readOnly?: boolean;
}

export function SavingPlanPreviewCard({
  plan,
  onPress,
  onEdit,
  readOnly = false,
}: SavingPlanPreviewCardProps) {
  const currency: CurrencyCode = useAppStore((s) => s.currency);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const colorId = plan.iconColor ?? 'purple';
  const iconColor = getIconColor(colorId);
  const iconInfo = CATEGORIES[plan.icon ?? 'savings'] ?? CATEGORIES.savings;
  const saveType = plan.saveType ?? 'goal';

  if (saveType === 'free') {
    return <FreeCard plan={plan} onPress={onPress} onEdit={onEdit} readOnly={readOnly} iconColor={iconColor.color} iconInfo={iconInfo} currency={currency} theme={theme} styles={styles} />;
  }

  return <GoalCard plan={plan} onPress={onPress} onEdit={onEdit} readOnly={readOnly} iconColor={iconColor.color} iconInfo={iconInfo} currency={currency} theme={theme} styles={styles} />;
}

// ── Ahorro libre ─────────────────────────────────────────────────────────────

function FreeCard({ plan, onPress, onEdit, readOnly, iconColor, iconInfo, currency, styles }: CardInternalProps) {
  const saved = savingPlanSavedAmount(plan);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={readOnly ? undefined : onEdit}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Solid category colored rounded square with category icon */}
      <View style={[styles.colorBlock, { backgroundColor: iconColor }]}>
        <Ionicons name={iconInfo.icon} size={20} color="#FFFFFF" />
      </View>

      {/* Card Content Column */}
      <View style={styles.cardContent}>
        {/* Top Row: Title */}
        <View style={styles.topRow}>
          <Text style={styles.categoryTitle} numberOfLines={1}>
            {plan.title}
          </Text>
        </View>

        {/* Middle Row: Progress Bar (Filled to 100% since no budget target) */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: saved > 0 ? '100%' : '0%',
                backgroundColor: iconColor,
              },
            ]}
          />
        </View>

        {/* Bottom Row: Saved (neutral gray) & Mode label */}
        <View style={styles.bottomRow}>
          <Text style={styles.spentAmount} numberOfLines={1}>
            {fmt(saved, currency)}
          </Text>
          <Text style={[styles.remainingAmount, { color: iconColor }]} numberOfLines={1}>
            Ahorro libre
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Ahorro con meta ───────────────────────────────────────────────────────────

function GoalCard({ plan, onPress, onEdit, readOnly, iconColor, iconInfo, currency, styles }: CardInternalProps) {
  const progress = savingPlanProgress(plan);
  const progressPct = Math.min(100, Math.round(progress.pct));
  const isComplete = progressPct >= 100;
  const barColor = isComplete ? COMPLETE_COLOR : iconColor;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={readOnly ? undefined : onEdit}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Solid category colored rounded square with category icon */}
      <View style={[styles.colorBlock, { backgroundColor: iconColor }]}>
        <Ionicons name={iconInfo.icon} size={20} color="#FFFFFF" />
      </View>

      {/* Card Content Column */}
      <View style={styles.cardContent}>
        {/* Top Row: Title & Target Amount */}
        <View style={styles.topRow}>
          <Text style={styles.categoryTitle} numberOfLines={1}>
            {plan.title}
          </Text>
          <Text style={styles.budgetLimit} numberOfLines={1}>
            {fmt(plan.targetAmount, currency)}
          </Text>
        </View>

        {/* Middle Row: Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPct}%` as `${number}%`,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>

        {/* Bottom Row: Saved Amount & Remaining / Success Message */}
        <View style={styles.bottomRow}>
          <Text style={styles.spentAmount} numberOfLines={1}>
            {fmt(progress.total, currency)}
          </Text>
          {isComplete ? (
            <View style={styles.completeRow}>
              <Ionicons name="checkmark-circle" size={13} color={COMPLETE_COLOR} />
              <Text style={styles.completeText}>¡Meta alcanzada!</Text>
            </View>
          ) : (
            <Text style={[styles.remainingAmount, { color: iconColor }]} numberOfLines={1}>
              {fmt(progress.remaining, currency)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── Internal types ────────────────────────────────────────────────────────────

interface CardInternalProps {
  plan: SavingPlan;
  onPress: () => void;
  onEdit?: () => void;
  readOnly: boolean;
  iconColor: string;
  iconInfo: { icon: React.ComponentProps<typeof Ionicons>['name'] };
  currency: CurrencyCode;
  theme: AppTheme;
  styles: ReturnType<typeof makeStyles>;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    alignItems: 'center',
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
  pressed: {
    opacity: 0.72,
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
  completeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  completeText: {
    color: COMPLETE_COLOR,
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
  },
});
