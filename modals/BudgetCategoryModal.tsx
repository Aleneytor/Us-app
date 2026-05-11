import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
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
import { ColorPicker } from '../components/ColorPicker';
import { IconPicker } from '../components/IconPicker';
import { AppModal as Modal } from '../components/AppModal';
import { APP_COLORS } from '../constants/colors';
import { ALL_CATEGORY_KEYS } from '../constants/categories';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import { useAppStore } from '../store/useAppStore';
import type { BudgetCategory, UserId } from '../types';
import { parseAmt } from '../utils/format';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';

interface BudgetCategoryModalProps {
  visible: boolean;
  category?: BudgetCategory | null;
  onClose: () => void;
}

export function BudgetCategoryModal({ visible, category, onClose }: BudgetCategoryModalProps) {
  const insets = useSafeAreaInsets();
  const currentUser = useAppStore((s) => s.currentUser);
  const addBudgetCategory = useAppStore((s) => s.addBudgetCategory);
  const updateBudgetCategory = useAppStore((s) => s.updateBudgetCategory);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('food');
  const [iconColor, setIconColor] = useState('purple');
  const [budget, setBudget] = useState('');
  const [hasIncome, setHasIncome] = useState(false);
  const [incomeEstimate, setIncomeEstimate] = useState('');
  const [showBudgetField, setShowBudgetField] = useState(true);
  const [showCustomizeFields, setShowCustomizeFields] = useState(false);
  const [personal, setPersonal] = useState(false);
  const [notes, setNotes] = useState('');
  const scrollerRef = useRef<ScrollView>(null);
  const budgetInputRef = useRef<TextInput>(null);
  const customizeYRef = useRef(0);

  // Animation for income field reveal
  const incomeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(incomeAnim, {
      toValue: hasIncome ? 1 : 0,
      duration: hasIncome ? 300 : 220,
      easing: hasIncome ? Easing.out(Easing.quad) : Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [hasIncome, incomeAnim]);

  const editing = !!category;
  const incomeEstimateNum = parseAmt(incomeEstimate);
  const budgetNum = parseAmt(budget);
  const hasValidIncomeEstimate = Number.isFinite(incomeEstimateNum) && incomeEstimateNum > 0;
  const hasValidBudget = Number.isFinite(budgetNum) && budgetNum > 0;
  const shouldShowBudgetField = editing || showBudgetField || !hasIncome;
  const shouldShowCustomizeFields = editing || showCustomizeFields;
  const primaryLabel = hasIncome && !shouldShowBudgetField && hasValidIncomeEstimate
    ? 'Continuar'
    : hasValidBudget && !shouldShowCustomizeFields
      ? 'Continuar'
      : 'Guardar';

  useEffect(() => {
    if (!visible) return;
    setName(category?.name ?? '');
    setIcon(category?.icon ?? 'food');
    setIconColor(category?.iconColor ?? 'purple');
    setBudget(category ? String(category.monthlyBudget) : '');
    const existingIncome = category?.monthlyIncomeEstimate;
    setHasIncome(existingIncome !== undefined && existingIncome > 0);
    setIncomeEstimate(existingIncome ? String(existingIncome) : '');
    setShowBudgetField(!existingIncome || existingIncome <= 0 || !!category);
    setShowCustomizeFields(!!category);
    setPersonal(category?.uid !== undefined);
    setNotes(category?.notes ?? '');
  }, [visible, category]);

  const continueToBudget = () => {
    if (!name.trim()) {
      Alert.alert('Falta nombre', 'Ponle un nombre a la categoria.');
      return;
    }
    if (!hasValidIncomeEstimate) {
      Alert.alert('Ingreso invalido', 'Escribe un ingreso estimado mayor a cero.');
      return;
    }
    setShowBudgetField(true);
    requestAnimationFrame(() => budgetInputRef.current?.focus());
  };

  const continueToCustomize = () => {
    if (!name.trim()) {
      Alert.alert('Falta nombre', 'Ponle un nombre a la categoria.');
      return;
    }
    if (!hasValidBudget) {
      Alert.alert('Presupuesto invalido', 'Escribe un presupuesto mayor a cero.');
      return;
    }
    const randomIcon = ALL_CATEGORY_KEYS[Math.floor(Math.random() * ALL_CATEGORY_KEYS.length)] ?? 'food';
    setIcon(randomIcon);
    setShowCustomizeFields(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollerRef.current?.scrollTo({
          y: Math.max(0, customizeYRef.current - 12),
          animated: true,
        });
      }, 80);
    });
  };

  const handlePrimaryAction = () => {
    if (hasIncome && !shouldShowBudgetField) {
      continueToBudget();
      return;
    }
    if (!shouldShowCustomizeFields) {
      continueToCustomize();
      return;
    }
    save();
  };

  const handlePrimaryPress = () => {
    if (hasIncome && !shouldShowBudgetField) {
      handlePrimaryAction();
      return;
    }
    if (!shouldShowCustomizeFields) {
      runAfterKeyboardDismiss(handlePrimaryAction);
      return;
    }
    runAfterKeyboardDismiss(handlePrimaryAction);
  };

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Falta nombre', 'Ponle un nombre a la categoría.');
      return;
    }
    if (hasIncome && !hasValidIncomeEstimate) {
      Alert.alert('Ingreso invalido', 'Escribe un ingreso estimado mayor a cero.');
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
      monthlyIncomeEstimate: hasIncome ? incomeEstimateNum : undefined,
      uid: personal ? currentUser : undefined,
      notes: notes.trim() || undefined,
    };

    if (editing) updateBudgetCategory(next);
    else addBudgetCategory(next);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.keyboardView}>
        <Pressable style={[styles.screen, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]} onPressIn={onClose}>
          <View style={styles.cardMotion}>
          <Pressable
            style={styles.card}
            onPressIn={(event) => event.stopPropagation()}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>{editing ? 'Editar categoría' : 'Nueva categoría'}</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={23} color={APP_COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              ref={scrollerRef}
              style={styles.scroller}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={dismissKeyboardAndBlur}
            >
              <View style={styles.block}>
                <LabeledInput
                  label="Nombre"
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej. Unas, Comida, Renta"
                />

                {/* ── Income estimate toggle (top) ── */}
                <View style={styles.incomeToggleRow}>
                  <Text style={[styles.label, styles.incomeQuestionLabel]}>
                    ¿Esta categoría genera ingresos?
                  </Text>
                  <ChoiceButton
                    label={hasIncome ? 'Sí' : 'No'}
                    icon={hasIncome ? 'checkmark-circle-outline' : 'close-circle-outline'}
                    active={hasIncome}
                    onPress={() => {
                      setHasIncome((value) => {
                        const next = !value;
                        setShowBudgetField(!next);
                        setShowCustomizeFields(false);
                        return next;
                      });
                    }}
                  />
                </View>

                <Animated.View
                  style={[
                    styles.incomeFieldWrap,
                    {
                      opacity: incomeAnim,
                      maxHeight: incomeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 112],
                      }),
                      marginTop: incomeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-8, 0],
                      }),
                      transform: [{
                        translateY: incomeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-10, 0],
                        }),
                      }, {
                        scale: incomeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.98, 1],
                        }),
                      }],
                    },
                  ]}
                  pointerEvents={hasIncome ? 'auto' : 'none'}
                >
                  <View style={styles.field}>
                    <Text style={styles.label}>Ingreso mensual estimado</Text>
                    <TextInput
                      value={incomeEstimate}
                      onChangeText={setIncomeEstimate}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#CBD5E1"
                      selectTextOnFocus
                      style={styles.incomeInput}
                    />
                  </View>
                </Animated.View>


                {shouldShowBudgetField ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Presupuesto mensual</Text>
                  <TextInput
                    ref={budgetInputRef}
                    value={budget}
                    onChangeText={setBudget}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                    selectTextOnFocus
                    style={styles.budgetInput}
                  />
                </View>
                ) : null}

                {shouldShowCustomizeFields ? (
                <View
                  style={styles.customizeSection}
                  onLayout={(event) => {
                    customizeYRef.current = event.nativeEvent.layout.y;
                  }}
                >
                <Text style={styles.label}>Ícono</Text>
                <IconPicker
                  value={icon}
                  colorId={iconColor}
                  keys={ALL_CATEGORY_KEYS}
                  horizontalInset={18}
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
                ) : null}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={() => runAfterKeyboardDismiss(onClose)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handlePrimaryPress} style={styles.primaryButton}>
                <Text style={styles.primaryText}>{primaryLabel}</Text>
              </Pressable>
            </View>
          </Pressable>
          </View>
        </Pressable>
      </View>
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
    maxHeight: '96%',
    overflow: 'hidden',
    width: '100%',
  },
  cardMotion: {
    borderRadius: 22,
    elevation: 14,
    maxWidth: 520,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
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
  customizeSection: {
    gap: 14,
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
    justifyContent: 'center',
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
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  scroller: {
    flexShrink: 1,
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
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
  incomeInput: {
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
  incomeQuestionLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '400',
  },
  incomeToggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  incomeFieldWrap: {
    overflow: 'hidden',
  },
});
