import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAppStore } from '../store/useAppStore';
import type { AppTheme } from '../constants/colors';

const GETTING_STARTED_KEY = 'nosotros_getting_started_dismissed';

interface Task {
  id: string;
  label: string;
  done: boolean;
  hint: string;
}

export function GettingStartedCard() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [celebrateAnim] = useState(new Animated.Value(0));

  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);

  useEffect(() => {
    AsyncStorage.getItem(GETTING_STARTED_KEY).then((v) => setDismissed(v === '1'));
  }, []);

  const tasks: Task[] = useMemo(() => {
    const expenses = payload.expenses ?? [];
    const categories = payload.budgetCategories ?? [];
    const savings = payload.savings ?? [];

    return [
      {
        id: 'first_expense',
        label: 'Registra tu primer movimiento',
        done: expenses.some((e) => e.uid === currentUser),
        hint: 'Pulsa el botón + para añadir',
      },
      {
        id: 'first_category',
        label: 'Crea una categoría de presupuesto',
        done: categories.length > 0,
        hint: 'En Categorías → Crear categoría',
      },
      {
        id: 'first_saving',
        label: 'Crea tu primera meta de ahorro',
        done: savings.length > 0,
        hint: 'En Extras → Ahorros',
      },
    ];
  }, [payload, currentUser]);

  const allDone = tasks.every((t) => t.done);
  const doneCount = tasks.filter((t) => t.done).length;

  useEffect(() => {
    if (!allDone || dismissed) return;
    Animated.timing(celebrateAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const timer = setTimeout(() => handleDismiss(), 2500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const handleDismiss = () => {
    void AsyncStorage.setItem(GETTING_STARTED_KEY, '1');
    setDismissed(true);
  };

  if (dismissed !== false) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {allDone ? (
            <Text style={styles.title}>🎉 ¡Todo listo!</Text>
          ) : (
            <>
              <Text style={styles.title}>Primeros pasos</Text>
              <Text style={styles.progress}>{doneCount}/{tasks.length}</Text>
            </>
          )}
        </View>
        <Pressable onPress={handleDismiss} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={theme.textMuted} />
        </Pressable>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(doneCount / tasks.length) * 100}%` as any }]} />
      </View>

      {tasks.map((task) => (
        <View key={task.id} style={styles.taskRow}>
          <View style={[styles.taskCheck, task.done && styles.taskCheckDone]}>
            {task.done && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
          </View>
          <View style={styles.taskContent}>
            <Text style={[styles.taskLabel, task.done && styles.taskLabelDone]}>
              {task.label}
            </Text>
            {!task.done && <Text style={styles.taskHint}>{task.hint}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  card: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  title: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  progress: {
    backgroundColor: t.softSurface,
    borderRadius: 99,
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  closeBtn: {
    padding: 4,
  },
  progressBar: {
    backgroundColor: t.softSurface,
    borderRadius: 99,
    height: 4,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: t.green,
    borderRadius: 99,
    height: '100%',
  },
  taskRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  taskCheck: {
    alignItems: 'center',
    borderColor: t.border,
    borderRadius: 99,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    marginTop: 1,
    width: 20,
  },
  taskCheckDone: {
    backgroundColor: t.green,
    borderColor: t.green,
  },
  taskContent: {
    flex: 1,
    gap: 2,
  },
  taskLabel: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  taskLabelDone: {
    color: t.textMuted,
    textDecorationLine: 'line-through',
  },
  taskHint: {
    color: t.textMuted,
    fontSize: 12,
  },
});
