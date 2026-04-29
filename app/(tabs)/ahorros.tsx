import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GoalCard } from '../../components/GoalCard';
import { APP_COLORS } from '../../constants/colors';
import { ContributionModal } from '../../modals/ContributionModal';
import { GoalModal } from '../../modals/GoalModal';
import { PARTNER, USERS } from '../../types';
import type { Contribution, Goal } from '../../types';
import { goalProgress } from '../../utils/calculations';
import { formatDateShort, fmt } from '../../utils/format';
import { refreshCurrentRoom, useAppStore } from '../../store/useAppStore';

interface GoalSection {
  title: string;
  subtitle: string;
  data: Goal[];
  readOnly: boolean;
}

export default function AhorrosScreen() {
  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);
  const deleteGoal = useAppStore((s) => s.deleteGoal);

  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo<GoalSection[]>(() => {
    const partner = PARTNER[currentUser];
    return [
      {
        title: 'Metas conjuntas',
        subtitle: 'Objetivos compartidos',
        data: payload.goals.filter((g) => g.type === 'joint'),
        readOnly: false,
      },
      {
        title: 'Mis metas',
        subtitle: USERS[currentUser].name,
        data: payload.goals.filter((g) => g.type === 'personal' && g.uid === currentUser),
        readOnly: false,
      },
      {
        title: 'Metas de pareja',
        subtitle: USERS[partner].name,
        data: payload.goals.filter((g) => g.type === 'personal' && g.uid === partner),
        readOnly: true,
      },
    ];
  }, [currentUser, payload.goals]);

  const totals = useMemo(() => {
    const target = payload.goals.reduce((sum, goal) => sum + goal.target, 0);
    const saved = payload.contribs.reduce((sum, contrib) => sum + contrib.amt, 0);
    return { target, saved, remaining: Math.max(0, target - saved) };
  }, [payload.contribs, payload.goals]);

  const handleDelete = (goal: Goal) => {
    Alert.alert(
      'Eliminar meta',
      'Tambien se eliminaran sus aportes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteGoal(goal.id) },
      ],
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentRoom();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.summary}>
          <SummaryMetric label="Ahorrado" value={fmt(totals.saved)} tone="income" />
          <SummaryMetric label="Objetivo" value={fmt(totals.target)} tone="neutral" />
          <SummaryMetric label="Falta" value={fmt(totals.remaining)} tone="expense" />
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              </View>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>

            {section.data.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>No hay metas en esta seccion.</Text>
              </View>
            ) : (
              <View style={styles.cardStack}>
                {section.data.map((goal) => (
                  <GoalCard
                    key={String(goal.id)}
                    goal={goal}
                    contribs={payload.contribs}
                    readOnly={section.readOnly}
                    onPress={() => setSelectedGoal(goal)}
                    onContribute={() => setContributeGoal(goal)}
                    onEdit={() => setEditGoal(goal)}
                    onDelete={() => handleDelete(goal)}
                  />
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <Pressable
        accessibilityLabel="Nueva meta"
        onPress={() => setCreateOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <GoalDetailModal
        goal={selectedGoal}
        contribs={payload.contribs}
        onClose={() => setSelectedGoal(null)}
      />

      <GoalModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <GoalModal
        visible={!!editGoal}
        goal={editGoal}
        onClose={() => setEditGoal(null)}
      />
      <ContributionModal
        visible={!!contributeGoal}
        goal={contributeGoal}
        onClose={() => setContributeGoal(null)}
      />
    </View>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'income' | 'expense' | 'neutral';
}) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          tone === 'income' && styles.income,
          tone === 'expense' && styles.expense,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function GoalDetailModal({
  goal,
  contribs,
  onClose,
}: {
  goal: Goal | null;
  contribs: Contribution[];
  onClose: () => void;
}) {
  if (!goal) return null;

  const goalContribs = contribs
    .filter((contrib) => String(contrib.gid) === String(goal.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const progress = goalProgress(goal, contribs);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{goal.name}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={APP_COLORS.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.detailSummary}>
            <DetailPill label="Ahorrado" value={fmt(progress.total)} />
            <DetailPill label="Objetivo" value={fmt(goal.target)} />
            <DetailPill label="Falta" value={fmt(progress.remaining)} />
          </View>

          <Text style={styles.historyTitle}>Historial</Text>
          {goalContribs.length === 0 ? (
            <Text style={styles.emptyText}>Todavia no hay aportes.</Text>
          ) : (
            <View style={styles.historyList}>
              {goalContribs.map((contrib) => (
                <View key={String(contrib.id)} style={styles.historyRow}>
                  <View style={styles.historyText}>
                    <Text style={styles.historyAmount}>{fmt(contrib.amt)}</Text>
                    <Text style={styles.historyMeta}>
                      {USERS[contrib.uid].name} · {formatDateShort(contrib.date)}
                    </Text>
                    {contrib.note ? <Text style={styles.historyNote}>{contrib.note}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailPill}>
      <Text style={styles.detailPillLabel}>{label}</Text>
      <Text style={styles.detailPillValue}>{value}</Text>
    </View>
  );
}

function PlaceholderModal({
  title,
  body,
  visible,
  onClose,
}: {
  title: string;
  body: string;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={APP_COLORS.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.placeholderText}>{body}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cardStack: {
    gap: 10,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  content: {
    gap: 18,
    padding: 16,
    paddingBottom: 96,
  },
  detailPill: {
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: 10,
  },
  detailPillLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  detailPillValue: {
    color: APP_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  detailSummary: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  emptySection: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: 16,
  },
  emptyText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  expense: {
    color: APP_COLORS.expense,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.blue,
    borderRadius: 28,
    bottom: 24,
    elevation: 4,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    width: 56,
  },
  fabPressed: {
    transform: [{ scale: 0.97 }],
  },
  historyAmount: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  historyList: {
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
  },
  historyMeta: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  historyNote: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  historyRow: {
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  historyText: {
    gap: 3,
  },
  historyTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  income: {
    color: APP_COLORS.income,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: APP_COLORS.surface,
    borderRadius: 18,
    maxHeight: '82%',
    maxWidth: 560,
    padding: 18,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 19,
    fontWeight: '900',
  },
  placeholderText: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  screen: {
    backgroundColor: APP_COLORS.background,
    flex: 1,
  },
  section: {
    gap: 10,
  },
  sectionCount: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionSubtitle: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  summary: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryMetric: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    padding: 12,
  },
  summaryValue: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
});
