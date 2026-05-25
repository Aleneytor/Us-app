import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
import { AppModal as Modal } from '../components/AppModal';
import { ColorPicker } from '../components/ColorPicker';
import { IconPicker } from '../components/IconPicker';
import { ModalScreen } from '../components/ModalScreen';
import { BUDGET_CATEGORY_ICON_KEYS, BUDGET_CATEGORY_PRESETS, CATEGORIES } from '../constants/categories';
import { getIconColor, type AppTheme } from '../constants/colors';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../contexts/ThemeContext';
import type { BudgetCategory } from '../types';
import { parseAmt } from '../utils/format';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';

interface BudgetCategoryModalProps {
  visible: boolean;
  category?: BudgetCategory | null;
  onClose: () => void;
  onSaved?: (category: BudgetCategory) => void;
}

export function BudgetCategoryModal({ visible, category, onClose, onSaved }: BudgetCategoryModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const addBudgetCategory = useAppStore((s) => s.addBudgetCategory);
  const updateBudgetCategory = useAppStore((s) => s.updateBudgetCategory);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [icon, setIcon] = useState('food');
  const [iconColor, setIconColor] = useState('purple');
  const [personal, setPersonal] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const notesScroll = useKeyboardAwareScroll();

  const editing = !!category;
  const budgetNum = parseAmt(budget);
  const normalizedBudget = Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : 0;
  const hasSelectedPresets = selectedPresets.length > 0;

  useEffect(() => {
    if (!visible) return;

    setStep(category ? 1 : 0);
    setName(category?.name ?? '');
    setBudget(category ? String(category.monthlyBudget) : '');
    setIcon(category?.icon ?? 'food');
    setIconColor(category?.iconColor ?? 'purple');
    setPersonal(category?.uid !== undefined);
    setNotes(category?.notes ?? '');
    setSelectedPresets([]);
  }, [visible, category]);

  const validateDetails = () => {
    if (!name.trim()) {
      Alert.alert('Falta nombre', 'Ponle un nombre a la categoría.');
      return false;
    }
    if (budget.trim() && (!Number.isFinite(budgetNum) || budgetNum < 0)) {
      Alert.alert('Presupuesto invalido', 'Escribe un presupuesto valido o dejalo vacio.');
      return false;
    }
    return true;
  };

  const togglePreset = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPresets((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  };

  const startCustomCategory = () => {
    setName('');
    setBudget('');
    setIcon('other');
    setIconColor('purple');
    setNotes('');
    setStep(1);
  };

  const save = () => {
    if (!validateDetails()) return;

    const next: BudgetCategory = {
      id: category?.id ?? Date.now(),
      name: name.trim(),
      icon,
      iconColor,
      monthlyBudget: normalizedBudget,
      uid: personal ? currentUser : undefined,
      notes: notes.trim() || undefined,
    };

    if (editing) updateBudgetCategory(next);
    else addBudgetCategory(next);
    onSaved?.(next);
    onClose();
  };

  const saveSelectedPresets = () => {
    const selected = BUDGET_CATEGORY_PRESETS.filter((preset) => selectedPresets.includes(preset.name));
    if (selected.length === 0) return;

    const created = selected.map((preset, index): BudgetCategory => ({
      id: Date.now() + index,
      name: preset.name,
      icon: preset.icon,
      iconColor: preset.iconColor,
      monthlyBudget: 0,
      uid: currentUser,
    }));

    created.forEach(addBudgetCategory);
    onSaved?.(created[created.length - 1]);
    onClose();
  };

  const handlePrimaryPress = () => {
    if (!editing && step === 0) {
      dismissKeyboardAndBlur();
      if (hasSelectedPresets) {
        saveSelectedPresets();
        return;
      }
      startCustomCategory();
      return;
    }
    runAfterKeyboardDismiss(save);
  };

  const handleBack = () => {
    dismissKeyboardAndBlur();
    if (!editing && step > 0) {
      setStep(0);
      return;
    }
    onClose();
  };

  const handleSecondaryPress = () => {
    dismissKeyboardAndBlur();
    if (!editing && step > 0) {
      setStep(0);
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleBack}>
      <ModalScreen
          title={editing ? 'Editar categoría' : 'Nueva categoría'}
          breadcrumbs={editing ? ['Detalles'] : ['Elegir', 'Detalles']}
          activeBreadcrumb={editing ? 0 : step}
          canPressBreadcrumb={(index) => !editing && index < step}
          onBreadcrumbPress={(index) => {
            if (!editing && index < step) setStep(index as 0 | 1);
          }}
          onBack={handleBack}
          contentContainerStyle={{ padding: 0 }}
          footer={(
            <>
              <Pressable onPress={handleSecondaryPress} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>{!editing && step === 1 ? 'Atrás' : 'Cancelar'}</Text>
              </Pressable>
              <Pressable onPress={handlePrimaryPress} style={styles.primaryButton}>
                <Text style={styles.primaryText}>
                  {!editing && step === 0
                    ? hasSelectedPresets ? `Guardar ${selectedPresets.length}` : 'Crear propia'
                    : 'Guardar'}
                </Text>
              </Pressable>
            </>
          )}
      >
        <ScrollView
          ref={notesScroll.scrollRef}
          style={styles.scroller}
          contentContainerStyle={[
            styles.content,
            notesScroll.bottomPadding !== undefined && { paddingBottom: notesScroll.bottomPadding },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={dismissKeyboardAndBlur}
          showsVerticalScrollIndicator={false}
        >
          {!editing && step === 0 ? (
            <View style={styles.block}>
              <View style={styles.field}>
                <Text style={styles.label}>Categorías prediseñadas</Text>
                <Text style={styles.helperText}>
                  Selecciona todas las que quieras agregar ahora. Podrás ponerles presupuesto después.
                </Text>
                <View style={styles.presetGrid}>
                  {BUDGET_CATEGORY_PRESETS.map((preset) => (
                    <PresetButton
                      key={preset.name}
                      name={preset.name}
                      icon={preset.icon}
                      iconColor={preset.iconColor}
                      active={selectedPresets.includes(preset.name)}
                      onPress={() => togglePreset(preset.name)}
                    />
                  ))}
                </View>
                <Pressable
                  onPress={() => {
                    dismissKeyboardAndBlur();
                    startCustomCategory();
                  }}
                  style={({ pressed }) => [styles.customCategoryButton, pressed && styles.pressed]}
                >
                  <Ionicons name="add" size={17} color={theme.textSecondary} />
                  <Text style={styles.customCategoryText}>Crear Categoria</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.block}>
              <LabeledInput
                label="Título de la categoría"
                value={name}
                onChangeText={setName}
                placeholder="Ej. Comida"
              />

              <View style={styles.field}>
                <Text style={styles.label}>Presupuesto mensual</Text>
                <TextInput
                  value={budget}
                  onChangeText={setBudget}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                  selectTextOnFocus
                  style={styles.amountInput}
                />
              </View>

              <Text style={styles.label}>Icono</Text>
              <IconPicker
                value={icon}
                colorId={iconColor}
                keys={BUDGET_CATEGORY_ICON_KEYS}
                horizontalInset={18}
                onChange={setIcon}
              />

              <Text style={styles.label}>Color</Text>
              <ColorPicker value={iconColor} onChange={setIconColor} />

              <View style={styles.field}>
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
              </View>

              <LabeledInput
                label="Notas"
                value={notes}
                onChangeText={setNotes}
                placeholder="Opcional"
                multiline
                onFocus={notesScroll.onFocus}
                onBlur={notesScroll.onBlur}
              />
            </View>
          )}
        </ScrollView>
      </ModalScreen>
    </Modal>
  );
}

function PresetButton({
  name,
  icon,
  iconColor,
  active,
  onPress,
}: {
  name: string;
  icon: string;
  iconColor: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const category = CATEGORIES[icon] ?? CATEGORIES.other;
  const color = getIconColor(iconColor);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.presetButton,
        active && { borderColor: color.color },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.presetIcon, { backgroundColor: color.color }]}>
        <Ionicons name={category.icon} size={20} color="#FFFFFF" />
      </View>
      <Text style={styles.presetText} numberOfLines={1}>{name}</Text>
      {active ? (
        <View style={[styles.presetCheck, { backgroundColor: color.color }]}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

function LabeledInput({
  label,
  multiline,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textMuted}
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
  icon: ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceBtn,
        active && styles.choiceBtnActive,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : theme.textSecondary} />
      <Text style={[styles.choiceBtnText, active && styles.choiceBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  amountInput: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    color: t.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 36,
    letterSpacing: -1.8,
    minHeight: 72,
    padding: 12,
    textAlign: 'center',
  },
  block: {
    gap: 16,
  },
  choiceBtn: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
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
    color: t.textPrimary,
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
  content: {
    padding: 18,
    paddingBottom: 28,
  },
  customCategoryButton: {
    alignItems: 'center',
    backgroundColor: t.border,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  customCategoryText: {
    color: t.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  field: {
    gap: 7,
  },
  helperText: {
    color: t.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '400',
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'center',
  },
  label: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
  presetButton: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    gap: 8,
    minHeight: 92,
    minWidth: 92,
    paddingHorizontal: 8,
    paddingVertical: 12,
    position: 'relative',
  },
  presetCheck: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 18,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  presetText: {
    color: t.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '100%',
    textAlign: 'center',
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
  scroller: {
    flex: 1,
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
    fontWeight: '400',
  },
  textarea: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
});
