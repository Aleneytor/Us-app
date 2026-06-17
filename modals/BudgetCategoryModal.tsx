import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
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

const SWEEP_ACCENT = '#7C3AED';
const SWEEP_STROKE_WIDTH = 2;
const SWEEP_CYCLE_MS = 4000;
const SWEEP_TRAVEL_MS = 1500;

const AnimatedSweepRect = Animated.createAnimatedComponent(Rect);

function BorderSweep({ width, height }: { width: number; height: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: SWEEP_TRAVEL_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.delay(SWEEP_CYCLE_MS - SWEEP_TRAVEL_MS),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const rectWidth = width - SWEEP_STROKE_WIDTH;
  const rectHeight = height - SWEEP_STROKE_WIDTH;
  if (rectWidth <= 0 || rectHeight <= 0) return null;

  const perimeter = 2 * (rectWidth - rectHeight) + Math.PI * rectHeight;
  const dashLength = Math.max(30, perimeter * 0.22);
  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -perimeter],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <AnimatedSweepRect
          x={SWEEP_STROKE_WIDTH / 2}
          y={SWEEP_STROKE_WIDTH / 2}
          width={rectWidth}
          height={rectHeight}
          rx={rectHeight / 2}
          fill="none"
          stroke={SWEEP_ACCENT}
          strokeWidth={SWEEP_STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={[dashLength, perimeter - dashLength]}
          strokeDashoffset={dashOffset}
          opacity={opacity}
        />
      </Svg>
    </View>
  );
}

interface BudgetCategoryModalProps {
  visible: boolean;
  category?: BudgetCategory | null;
  onClose: () => void;
  onSaved?: (category: BudgetCategory) => void;
  hideBreadcrumbs?: boolean;
}

export function BudgetCategoryModal({ visible, category, onClose, onSaved, hideBreadcrumbs = false }: BudgetCategoryModalProps) {
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
  const [customBtnSize, setCustomBtnSize] = useState({ width: 0, height: 0 });
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
          breadcrumbs={hideBreadcrumbs ? [] : editing ? ['Detalles'] : ['Elegir', 'Detalles']}
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
                  onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    setCustomBtnSize({ width, height });
                  }}
                  style={({ pressed }) => [styles.customCategoryButton, pressed && styles.pressed]}
                >
                  {customBtnSize.width > 0 && (
                    <BorderSweep width={customBtnSize.width} height={customBtnSize.height} />
                  )}
                  <Ionicons name="add" size={19} color={SWEEP_ACCENT} />
                  <Text style={styles.customCategoryText}>Crear Categoría</Text>
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
        active && {
          backgroundColor: color.color,
          borderColor: color.color,
          shadowColor: color.color,
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 8,
          elevation: 6,
        },
        pressed && styles.pressed,
      ]}
    >
      {active && (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
          locations={[0, 0.34, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0.72, y: 0.12 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 12 }]}
        />
      )}
      <View style={[styles.presetIcon, { backgroundColor: active ? 'rgba(255,255,255,0.22)' : color.color }]}>
        <Ionicons name={category.icon} size={20} color="#FFFFFF" />
      </View>
      <Text style={[styles.presetText, active && { color: '#FFFFFF' }]} numberOfLines={1}>{name}</Text>
      {active && (
        <View style={styles.presetCheck}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
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
        multiline={!!multiline}
        numberOfLines={multiline ? undefined : 1}
        placeholderTextColor={theme.textMuted}
        style={[styles.input, multiline && styles.textarea]}
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
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  customCategoryText: {
    color: t.textSecondary,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
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
    lineHeight: 20,
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
    backgroundColor: 'rgba(255,255,255,0.30)',
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
    lineHeight: 20,
    minHeight: 86,
    textAlignVertical: 'top',
  },
});
