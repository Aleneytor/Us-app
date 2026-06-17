import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { EmojiPicker } from '../components/EmojiPicker';
import { IconPicker } from '../components/IconPicker';
import { AppModal as Modal } from '../components/AppModal';
import { ModalScreen } from '../components/ModalScreen';
import { type AppTheme } from '../constants/colors';
import { GOAL_EMOJIS } from '../constants/emojis';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import type { Goal } from '../types';
import { parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../contexts/ThemeContext';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';

interface GoalModalProps {
  visible: boolean;
  goal?: Goal | null;
  onClose: () => void;
}

export function GoalModal({ visible, goal, onClose }: GoalModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const addGoal = useAppStore((s) => s.addGoal);
  const updateGoal = useAppStore((s) => s.updateGoal);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [type, setType] = useState<'joint' | 'personal'>('joint');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState(todayStr());
  const [cat, setCat] = useState('home');
  const [iconColor, setIconColor] = useState('green');
  const [emoji, setEmoji] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const targetNumber = useMemo(() => parseAmt(target), [target]);
  const editing = !!goal;

  useEffect(() => {
    if (!visible) return;
    setType(goal?.type ?? 'joint');
    setName(goal?.name ?? '');
    setTarget(goal ? String(goal.target) : '');
    setDate(goal?.date ?? todayStr());
    setCat(goal?.cat ?? 'home');
    setIconColor(goal?.iconColor ?? 'green');
    setEmoji(goal?.em);
    setNotes(goal?.notes ?? '');
  }, [goal, visible]);

  const save = () => {
    if (!name.trim() || !Number.isFinite(targetNumber) || targetNumber <= 0) {
      Alert.alert('Datos incompletos', 'Revisa el nombre y el objetivo.');
      return;
    }

    const next: Goal = {
      id: goal?.id ?? Date.now(),
      type,
      cat,
      iconColor,
      name: name.trim(),
      target: targetNumber,
      date: date.trim() || todayStr(),
      em: emoji,
      uid: type === 'personal' ? (goal?.uid ?? currentUser) : undefined,
      notes: notes.trim() || undefined,
    };

    if (editing) updateGoal(next);
    else addGoal(next);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <ModalScreen
        title={editing ? 'Editar meta' : 'Nueva meta'}
        breadcrumbs={['Tipo', 'Objetivo', 'Detalles']}
        activeBreadcrumb={name.trim() ? target.trim() ? 2 : 1 : 0}
        onBack={onClose}
        contentContainerStyle={{ padding: 0 }}
        footer={<Footer onCancel={onClose} onSave={save} />}
      >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={dismissKeyboardAndBlur}
          >
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.choiceRow}>
              <Choice label="Conjunta" active={type === 'joint'} onPress={() => setType('joint')} />
              <Choice label="Personal" active={type === 'personal'} onPress={() => setType('personal')} />
            </View>
            <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Viaje" />
            <Field
              label="Objetivo"
              value={target}
              onChangeText={setTarget}
              placeholder="0,00"
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={dismissKeyboardAndBlur}
            />
            <Field label="Fecha" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            <Text style={styles.label}>Emoji</Text>
            <EmojiPicker options={GOAL_EMOJIS} value={emoji} onChange={setEmoji} />
            <Text style={styles.label}>Categoria</Text>
            <IconPicker value={cat} colorId={iconColor} horizontalInset={16} onChange={setCat} />
            <Text style={styles.label}>Color</Text>
            <ColorPicker value={iconColor} onChange={setIconColor} />
            <Field label="Notas" value={notes} onChangeText={setNotes} placeholder="Opcional" multiline />
          </ScrollView>
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

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        active && styles.choiceActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Footer({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <>
      <Pressable onPress={() => runAfterKeyboardDismiss(onCancel)} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Cancelar</Text>
      </Pressable>
      <Pressable onPress={() => runAfterKeyboardDismiss(onSave)} style={styles.primaryButton}>
        <Text style={styles.primaryText}>Guardar</Text>
      </Pressable>
    </>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  choice: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 42,
    justifyContent: 'center',
  },
  choiceActive: {
    backgroundColor: t.blue,
    borderColor: t.blue,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceText: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  choiceTextActive: {
    color: '#FFFFFF',
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
    paddingBottom: 32,
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
  pressed: {
    opacity: 0.72,
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
    maxWidth: 560,
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
  textarea: {
    lineHeight: 20,
    minHeight: 86,
    textAlignVertical: 'top',
  },
  title: {
    color: t.textPrimary,
    flex: 1,
    fontSize: 21,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
});
