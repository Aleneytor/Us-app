import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { APP_COLORS } from '../constants/colors';
import { GOAL_EMOJIS } from '../constants/emojis';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import type { Goal } from '../types';
import { parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';

interface GoalModalProps {
  visible: boolean;
  goal?: Goal | null;
  onClose: () => void;
}

export function GoalModal({ visible, goal, onClose }: GoalModalProps) {
  const insets = useSafeAreaInsets();
  const currentUser = useAppStore((s) => s.currentUser);
  const addGoal = useAppStore((s) => s.addGoal);
  const updateGoal = useAppStore((s) => s.updateGoal);

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
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.keyboardView}>
      <Pressable style={[styles.backdrop, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]} onPressIn={onClose}>
        <Pressable style={styles.screenShadow} onPressIn={(event) => event.stopPropagation()}>
          <View style={styles.screen}>
          <ModalHeader title={editing ? 'Editar meta' : 'Nueva meta'} onClose={onClose} />
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
            <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Viaje" autoFocus />
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
          <Footer onCancel={onClose} onSave={save} />
          </View>
        </Pressable>
      </Pressable>
      </View>
    </Modal>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Pressable onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={23} color={APP_COLORS.textPrimary} />
      </Pressable>
    </View>
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

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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
  return (
    <View style={styles.footer}>
      <Pressable onPress={() => runAfterKeyboardDismiss(onCancel)} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Cancelar</Text>
      </Pressable>
      <Pressable onPress={() => runAfterKeyboardDismiss(onSave)} style={styles.primaryButton}>
        <Text style={styles.primaryText}>Guardar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  choice: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 42,
    justifyContent: 'center',
  },
  choiceActive: {
    backgroundColor: APP_COLORS.blue,
    borderColor: APP_COLORS.blue,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceText: {
    color: APP_COLORS.textPrimary,
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
  keyboardView: {
    flex: 1,
  },
  label: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.72,
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
  screen: {
    backgroundColor: APP_COLORS.background,
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
  textarea: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  title: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 21,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
});
