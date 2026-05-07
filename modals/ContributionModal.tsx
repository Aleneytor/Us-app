import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { APP_COLORS } from '../constants/colors';
import type { Goal } from '../types';
import { goalProgress } from '../utils/calculations';
import { fmt, parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';

interface ContributionModalProps {
  visible: boolean;
  goal: Goal | null;
  onClose: () => void;
}

export function ContributionModal({ visible, goal, onClose }: ContributionModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const contribs = useAppStore((s) => s.payload.contribs);
  const addContribution = useAppStore((s) => s.addContribution);
  const currency = useAppStore((s) => s.currency);

  const [amt, setAmt] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const amountNumber = useMemo(() => parseAmt(amt), [amt]);
  const progress = goal ? goalProgress(goal, contribs) : null;

  useEffect(() => {
    if (!visible) return;
    setAmt('');
    setDate(todayStr());
    setNote('');
  }, [visible]);

  const save = () => {
    if (!goal) return;
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      Alert.alert('Monto invalido', 'Escribe un aporte mayor a cero.');
      return;
    }
    addContribution({
      id: Date.now(),
      gid: goal.id,
      uid: currentUser,
      amt: amountNumber,
      date: date.trim() || todayStr(),
      note: note.trim(),
    });
    onClose();
  };

  if (!goal) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPressIn={onClose}>
        <Pressable style={styles.screen} onPressIn={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Aportar</Text>
              <Text style={styles.subtitle}>{goal.name}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={23} color={APP_COLORS.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.content}>
            {progress ? (
              <View style={styles.progressBox}>
                <Text style={styles.progressTitle}>{fmt(progress.total, currency)} de {fmt(goal.target, currency)}</Text>
                <Text style={styles.progressText}>Faltan {fmt(progress.remaining, currency)}</Text>
              </View>
            ) : null}
            <Field label="Monto" value={amt} onChangeText={setAmt} placeholder="0,00" keyboardType="decimal-pad" autoFocus />
            <Field label="Fecha" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            <Field label="Nota" value={note} onChangeText={setNote} placeholder="Opcional" multiline />
          </View>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={save} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Guardar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={APP_COLORS.textMuted}
        style={[styles.input, props.multiline && styles.textarea]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  content: {
    gap: 14,
    padding: 16,
  },
  field: {
    gap: 7,
  },
  footer: {
    backgroundColor: APP_COLORS.surface,
    borderTopColor: APP_COLORS.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderBottomColor: APP_COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerText: {
    flex: 1,
  },
  input: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.blue,
    borderRadius: 13,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  progressBox: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  progressText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTitle: {
    color: APP_COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  screen: {
    backgroundColor: APP_COLORS.background,
    borderRadius: 22,
    elevation: 8,
    maxHeight: '88%',
    maxWidth: 520,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    width: '100%',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  secondaryText: {
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  textarea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  title: {
    color: APP_COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '900',
  },
});
