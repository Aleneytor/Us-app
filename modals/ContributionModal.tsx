import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppModal as Modal } from '../components/AppModal';
import { ModalScreen } from '../components/ModalScreen';
import { type AppTheme } from '../constants/colors';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import type { Goal } from '../types';
import { goalProgress } from '../utils/calculations';
import { fmt, parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../contexts/ThemeContext';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';

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
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

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
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <ModalScreen
        title="Aportar"
        subtitle={goal.name}
        breadcrumbs={['Meta', 'Aporte', 'Guardar']}
        activeBreadcrumb={amt.trim() ? 2 : 1}
        onBack={onClose}
        footer={(
          <>
            <Pressable onPress={() => runAfterKeyboardDismiss(onClose)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={() => runAfterKeyboardDismiss(save)} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Guardar</Text>
            </Pressable>
          </>
        )}
      >
          <View style={styles.content}>
            {progress ? (
              <View style={styles.progressBox}>
                <Text style={styles.progressTitle}>{fmt(progress.total, currency)} de {fmt(goal.target, currency)}</Text>
                <Text style={styles.progressText}>Faltan {fmt(progress.remaining, currency)}</Text>
              </View>
            ) : null}
            <Field
              label="Monto"
              value={amt}
              onChangeText={setAmt}
              placeholder="0,00"
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={() => runAfterKeyboardDismiss(save)}
            />
            <Field label="Fecha" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            <Field label="Nota" value={note} onChangeText={setNote} placeholder="Opcional" multiline />
          </View>
      </ModalScreen>
    </Modal>
  );
}

function Field({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isMultiline = !!props.multiline;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        multiline={isMultiline}
        numberOfLines={isMultiline ? undefined : 1}
        placeholderTextColor={theme.textMuted}
        style={[styles.input, isMultiline && styles.textarea]}
        {...props}
      />
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
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
    backgroundColor: t.surface,
    borderTopColor: t.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderBottomColor: t.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerText: {
    flex: 1,
  },
  input: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  label: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: t.blue,
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
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  progressText: {
    color: t.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTitle: {
    color: t.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  screen: {
    backgroundColor: t.background,
    borderRadius: 22,
    maxHeight: '96%',
    overflow: 'hidden',
    width: '100%',
  },
  screenShadow: {
    borderRadius: 22,
    elevation: 14,
    maxWidth: 520,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    width: '100%',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: t.border,
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  secondaryText: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: t.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  textarea: {
    lineHeight: 20,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  title: {
    color: t.textPrimary,
    fontSize: 21,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
});
