import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { IconPicker } from '../components/IconPicker';
import { APP_COLORS } from '../constants/colors';
import { ALL_CATEGORY_KEYS } from '../constants/categories';
import { useAppStore } from '../store/useAppStore';
import type { BudgetCategory, UserId } from '../types';
import { parseAmt } from '../utils/format';

interface BudgetCategoryModalProps {
  visible: boolean;
  category?: BudgetCategory | null;
  onClose: () => void;
}

export function BudgetCategoryModal({ visible, category, onClose }: BudgetCategoryModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const addBudgetCategory = useAppStore((s) => s.addBudgetCategory);
  const updateBudgetCategory = useAppStore((s) => s.updateBudgetCategory);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('food');
  const [iconColor, setIconColor] = useState('purple');
  const [budget, setBudget] = useState('');
  const [personal, setPersonal] = useState(false);
  const [notes, setNotes] = useState('');

  const editing = !!category;

  useEffect(() => {
    if (!visible) return;
    setName(category?.name ?? '');
    setIcon(category?.icon ?? 'food');
    setIconColor(category?.iconColor ?? 'purple');
    setBudget(category ? String(category.monthlyBudget) : '');
    setPersonal(category?.uid !== undefined);
    setNotes(category?.notes ?? '');
  }, [visible, category]);

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Falta nombre', 'Ponle un nombre a la categoría.');
      return;
    }
    const budgetNum = parseAmt(budget);
    if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
      Alert.alert('Presupuesto inválido', 'Escribe un presupuesto mayor a cero.');
      return;
    }

    const next: BudgetCategory = {
      id: category?.id ?? Date.now(),
      name: name.trim(),
      icon,
      iconColor,
      monthlyBudget: budgetNum,
      uid: personal ? currentUser : undefined,
      notes: notes.trim() || undefined,
    };

    if (editing) updateBudgetCategory(next);
    else addBudgetCategory(next);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
        style={styles.keyboardView}
      >
        <Pressable style={styles.screen} onPressIn={onClose}>
          <Pressable style={styles.card} onPressIn={(event) => event.stopPropagation()}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>{editing ? 'Editar categoría' : 'Nueva categoría'}</Text>
                <Text style={styles.headerSub}>Presupuesto mensual</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={23} color={APP_COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroller}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.block}>
                <LabeledInput
                  label="Nombre"
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej. Uñas, Comida, Renta"
                />

                <View style={styles.field}>
                  <Text style={styles.label}>Presupuesto mensual</Text>
                  <TextInput
                    value={budget}
                    onChangeText={setBudget}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                    selectTextOnFocus
                    style={styles.budgetInput}
                  />
                </View>

                <Text style={styles.label}>Ícono</Text>
                <IconPicker
                  value={icon}
                  colorId={iconColor}
                  keys={ALL_CATEGORY_KEYS}
                  onChange={setIcon}
                />

                <Text style={styles.label}>Color</Text>
                <ColorPicker value={iconColor} onChange={setIconColor} />

                <Text style={styles.label}>Visible para</Text>
                <View style={styles.choiceRow}>
                  <ChoiceButton
                    label="Ambos"
                    icon="people-outline"
                    active={!personal}
                    onPress={() => setPersonal(false)}
                  />
                  <ChoiceButton
                    label="Solo yo"
                    icon="person-outline"
                    active={personal}
                    onPress={() => setPersonal(true)}
                  />
                </View>

                <LabeledInput
                  label="Notas (opcional)"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Opcional"
                  multiline
                />
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={() => { Keyboard.dismiss(); onClose(); }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={save} style={styles.primaryButton}>
                <Text style={styles.primaryText}>Guardar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function LabeledInput({
  label,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={APP_COLORS.textMuted}
        style={[styles.input, multiline && styles.textarea]}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

function ChoiceButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceBtn,
        active && styles.choiceBtnActive,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : APP_COLORS.textSecondary} />
      <Text style={[styles.choiceBtnText, active && styles.choiceBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 14,
  },
  budgetInput: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: APP_COLORS.textPrimary,
    fontFamily: 'DMSerifDisplay_400Regular',
    fontSize: 36,
    minHeight: 72,
    padding: 12,
    textAlign: 'center',
  },
  card: {
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
  choiceBtn: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  choiceBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  choiceBtnText: {
    color: APP_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '400',
  },
  choiceBtnTextActive: {
    color: '#FFFFFF',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  content: {
    padding: 18,
    paddingBottom: 22,
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
  headerSub: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  input: {
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: APP_COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '400',
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
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.72,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 13,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
  },
  screen: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  scroller: {
    maxHeight: 500,
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
    fontWeight: '400',
  },
  textarea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  title: {
    color: APP_COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '400',
  },
});
