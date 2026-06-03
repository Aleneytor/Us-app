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
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor }]}>
          <Ionicons name={iconInfo.icon} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.info}>
          <Text numberOfLines={1} style={styles.title}>{plan.title}</Text>
          <Text style={styles.subtitle}>Ahorro libre</Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={styles.amount} numberOfLines={1}>{fmt(saved, currency)}</Text>
          <Text style={styles.amountSub}>guardados</Text>
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

  return (
    <Pressable
      onPress={onPress}
      onLongPress={readOnly ? undefined : onEdit}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Header row */}
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor }]}>
          <Ionicons name={iconInfo.icon} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.info}>
          <Text numberOfLines={1} style={styles.title}>{plan.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {fmt(progress.total, currency)} de {fmt(plan.targetAmount, currency)}
          </Text>
        </View>
        <Text style={[styles.pct, isComplete && styles.pctComplete]}>{progressPct}%</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${progressPct}%` as `${number}%` },
            isComplete && styles.barFillComplete,
          ]}
        />
      </View>

      {/* Footer */}
      {isComplete ? (
        <View style={styles.completeRow}>
          <Ionicons name="checkmark-circle" size={13} color={COMPLETE_COLOR} />
          <Text style={styles.completeText}>¡Meta alcanzada!</Text>
        </View>
      ) : (
        <Text style={styles.remaining} numberOfLines={1}>
          Falta{' '}
          <Text style={styles.remainingAmt}>{fmt(progress.remaining, currency)}</Text>
        </Text>
      )}
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
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  pressed: {
    opacity: 0.72,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 12,
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  // -- Free card amount --
  amountCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 1,
  },
  amount: {
    color: SAVINGS_ACCENT,
    fontSize: 15,
    fontWeight: '800',
  },
  amountSub: {
    color: theme.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  // -- Goal card --
  pct: {
    color: SAVINGS_ACCENT,
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '900',
  },
  pctComplete: {
    color: COMPLETE_COLOR,
  },
  barTrack: {
    backgroundColor: theme.mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.10)',
    borderRadius: 4,
    height: 6,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: SAVINGS_ACCENT,
    borderRadius: 4,
    height: '100%',
  },
  barFillComplete: {
    backgroundColor: COMPLETE_COLOR,
  },
  remaining: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  remainingAmt: {
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
