import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppModal as Modal } from './AppModal';
import { ModalScreen } from './ModalScreen';
import { type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';
import type { Contribution, CurrencyCode, Goal, UserData } from '../types';
import { goalProgress } from '../utils/calculations';
import { fmt, formatDateShort } from '../utils/format';

interface GoalDetailModalProps {
  goal: Goal | null;
  contribs: Contribution[];
  currency: CurrencyCode;
  users: Record<string, UserData>;
  onClose: () => void;
  onContribute?: (goal: Goal) => void;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goal: Goal) => void;
}

export function GoalDetailModal({
  goal,
  contribs,
  currency,
  users,
  onClose,
  onContribute,
  onEdit,
  onDelete,
}: GoalDetailModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (!goal) return null;

  const goalContribs = contribs
    .filter((contribution) => String(contribution.gid) === String(goal.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const progress = goalProgress(goal, contribs);
  const hasActions = !!onContribute || !!onEdit || !!onDelete;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalScreen
        title={goal.name}
        breadcrumbs={['Ahorros', 'Meta']}
        activeBreadcrumb={1}
        onBack={onClose}
        scroll
      >
        <View style={styles.detailPills}>
          <View style={styles.detailPill}>
            <Text style={styles.detailPillLabel}>Ahorrado</Text>
            <Text style={styles.detailPillValue}>{fmt(progress.total, currency)}</Text>
          </View>
          <View style={styles.detailPill}>
            <Text style={styles.detailPillLabel}>Objetivo</Text>
            <Text style={styles.detailPillValue}>{fmt(goal.target, currency)}</Text>
          </View>
          <View style={styles.detailPill}>
            <Text style={styles.detailPillLabel}>Falta</Text>
            <Text style={styles.detailPillValue}>{fmt(progress.remaining, currency)}</Text>
          </View>
        </View>

        {hasActions && (
          <View style={styles.detailActions}>
            {onContribute && (
              <Pressable onPress={() => onContribute(goal)} style={({ pressed }) => [styles.detailAction, pressed && styles.pressed]}>
                <Ionicons name="add" size={16} color="#7C3AED" />
                <Text style={styles.detailActionText}>Aportar</Text>
              </Pressable>
            )}
            {onEdit && (
              <Pressable onPress={() => onEdit(goal)} style={({ pressed }) => [styles.detailAction, pressed && styles.pressed]}>
                <Ionicons name="pencil-outline" size={15} color="#7C3AED" />
                <Text style={styles.detailActionText}>Editar</Text>
              </Pressable>
            )}
            {onDelete && (
              <Pressable onPress={() => onDelete(goal)} style={({ pressed }) => [styles.detailActionDanger, pressed && styles.pressed]}>
                <Ionicons name="trash-outline" size={15} color="#DC2626" />
                <Text style={styles.detailActionDangerText}>Eliminar</Text>
              </Pressable>
            )}
          </View>
        )}

        <Text style={styles.historyTitle}>Historial de aportes</Text>
        {goalContribs.length === 0 ? (
          <Text style={[styles.emptySectionText, { marginTop: 4 }]}>Todavia no hay aportes.</Text>
        ) : (
          <View style={styles.historyList}>
            {goalContribs.map((contribution) => (
              <View key={String(contribution.id)} style={styles.historyRow}>
                <Text style={styles.historyAmt}>{fmt(contribution.amt, currency)}</Text>
                <Text style={styles.historyMeta}>
                  {users[contribution.uid]?.name ?? 'Usuario'} - {formatDateShort(contribution.date)}
                </Text>
                {contribution.note ? <Text style={styles.historyNote}>{contribution.note}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ModalScreen>
    </Modal>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  detailAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.10)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailActionDanger: {
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.10)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailActionDangerText: {
    color: '#DC2626',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  detailActionText: {
    color: '#7C3AED',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  detailPill: {
    backgroundColor: theme.background,
    borderColor: theme.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 10,
  },
  detailPillLabel: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  detailPillValue: {
    color: theme.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  detailPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  emptySectionText: {
    color: theme.textSecondary,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  historyAmt: {
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  historyList: {
    borderTopColor: theme.border,
    borderTopWidth: 1,
  },
  historyMeta: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  historyNote: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  historyRow: {
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    gap: 3,
    paddingVertical: 12,
  },
  historyTitle: {
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.72,
  },
});
