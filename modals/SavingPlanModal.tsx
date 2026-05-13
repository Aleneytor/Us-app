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
import { IconPicker } from '../components/IconPicker';
import { AppModal as Modal } from '../components/AppModal';
import { ModalScreen } from '../components/ModalScreen';
import { SAVING_ICON_KEYS } from '../constants/categories';
import { APP_COLORS } from '../constants/colors';
import type { SavingPlan } from '../types';
import { savingPlanMonthlyAmount } from '../utils/calculations';
import { fmt, parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';

const SAVINGS_ACCENT = '#7C3AED';

interface SavingPlanModalProps {
  visible: boolean;
  plan?: SavingPlan | null;
  onClose: () => void;
}

export function SavingPlanModal({ visible, plan, onClose }: SavingPlanModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const currency = useAppStore((s) => s.currency);
  const addSavingPlan = useAppStore((s) => s.addSavingPlan);
  const updateSavingPlan = useAppStore((s) => s.updateSavingPlan);

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [months, setMonths] = useState('');
  const [icon, setIcon] = useState('savings');
  const [iconColor, setIconColor] = useState('purple');
  const [planType, setPlanType] = useState<'joint' | 'personal'>('personal');
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');

  const notesScroll = useKeyboardAwareScroll();

  const targetNumber = useMemo(() => parseAmt(targetAmount), [targetAmount]);
  const monthsNumber = Number.parseInt(months, 10);
  const monthlyPreview =
    Number.isFinite(targetNumber) && targetNumber > 0 && Number.isFinite(monthsNumber) && monthsNumber > 0
      ? savingPlanMonthlyAmount({
          id: plan?.id ?? 0,
          type: planType,
          uid: planType === 'personal' ? (plan?.uid ?? currentUser) : undefined,
          icon,
          iconColor,
          title: title.trim() || 'Ahorro',
          targetAmount: targetNumber,
          months: monthsNumber,
          date: plan?.date ?? todayStr(),
          history: plan?.history ?? [],
        })
      : null;

  const editing = !!plan;

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setTitle(plan?.title ?? '');
    setTargetAmount(plan ? String(plan.targetAmount) : '');
    setMonths(plan?.months ? String(plan.months) : '');
    setIcon(plan?.icon ?? 'savings');
    setIconColor(plan?.iconColor ?? 'purple');
    setPlanType(plan?.type ?? 'personal');
    setLink(plan?.link ?? '');
    setNotes(plan?.notes ?? '');
  }, [visible, plan]);

  const validateDataStep = () => {
    if (!title.trim()) {
      Alert.alert('Falta el titulo', 'Ponle un nombre a tu ahorro.');
      return false;
    }
    if (!Number.isFinite(targetNumber) || targetNumber <= 0) {
      Alert.alert('Monto invalido', 'Escribe un monto mayor a cero.');
      return false;
    }
    return true;
  };

  const continueFromData = () => {
    if (!validateDataStep()) return;
    setStep(1);
  };

  const save = () => {
    if (!validateDataStep()) {
      setStep(0);
      return;
    }

    const next: SavingPlan = {
      id: plan?.id ?? Date.now(),
      type: planType,
      uid: planType === 'personal' ? (plan?.uid ?? currentUser) : undefined,
      icon,
      iconColor,
      title: title.trim(),
      targetAmount: targetNumber,
      months: monthsNumber > 0 ? monthsNumber : undefined,
      link: link.trim() || undefined,
      notes: notes.trim() || undefined,
      date: plan?.date ?? todayStr(),
      history: plan?.history ?? [],
    };

    if (editing) updateSavingPlan(next);
    else addSavingPlan(next);
    onClose();
  };

  const handlePrimaryPress = () => {
    if (step === 0) runAfterKeyboardDismiss(continueFromData);
    else if (step === 1) runAfterKeyboardDismiss(() => setStep(2));
    else runAfterKeyboardDismiss(save);
  };

  const handleSecondaryPress = () => {
    dismissKeyboardAndBlur();
    if (step > 0) { setStep(step - 1); return; }
    onClose();
  };

  const handleBack = () => {
    dismissKeyboardAndBlur();
    if (step > 0) { setStep(step - 1); return; }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleBack}>
      <ModalScreen
        title={editing ? 'Editar ahorro' : 'Nuevo ahorro'}
        breadcrumbs={['Datos', 'Personalizar', 'Extra']}
        activeBreadcrumb={step}
        canPressBreadcrumb={(index) => index < step}
        onBreadcrumbPress={setStep}
        onBack={handleBack}
        contentContainerStyle={{ padding: 0 }}
        footer={(
          <>
            <Pressable onPress={handleSecondaryPress} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{step === 0 ? 'Cancelar' : 'Atrás'}</Text>
            </Pressable>
            <Pressable onPress={handlePrimaryPress} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{step < 2 ? 'Continuar' : 'Guardar'}</Text>
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
          {step === 0 && (
            <View style={styles.block}>
              <LabeledInput
                label="Titulo"
                value={title}
                onChangeText={setTitle}
                placeholder="Ej. Auriculares"
                autoFocus
              />
              <View style={styles.field}>
                <Text style={styles.label}>Monto a ahorrar</Text>
                <TextInput
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                  placeholder="0"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  style={styles.amountInput}
                />
              </View>
              <LabeledInput
                label="Plazo en meses (opcional)"
                value={months}
                onChangeText={setMonths}
                placeholder="Ej. 6"
                keyboardType="number-pad"
              />
              {monthlyPreview !== null && (
                <View style={styles.preview}>
                  <Text style={styles.previewLabel}>Debes ahorrar al mes</Text>
                  <Text style={styles.previewAmount}>{fmt(monthlyPreview, currency)}</Text>
                </View>
              )}
            </View>
          )}

          {step === 1 && (
            <View style={styles.block}>
              <View style={styles.field}>
                <Text style={styles.label}>Icono</Text>
                <IconPicker
                  value={icon}
                  colorId={iconColor}
                  keys={SAVING_ICON_KEYS}
                  horizontalInset={18}
                  onChange={setIcon}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Color</Text>
                <ColorPicker value={iconColor} onChange={setIconColor} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Tipo de ahorro</Text>
                <View style={styles.choiceRow}>
                  <ChoiceButton
                    label="En conjunto"
                    icon="people-outline"
                    active={planType === 'joint'}
                    onPress={() => setPlanType('joint')}
                  />
                  <ChoiceButton
                    label="Solo yo"
                    icon="person-outline"
                    active={planType === 'personal'}
                    onPress={() => setPlanType('personal')}
                  />
                </View>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.block}>
              <LabeledInput
                label="Link del producto (opcional)"
                value={link}
                onChangeText={setLink}
                placeholder="https://..."
                keyboardType="url"
                autoCapitalize="none"
              />
              <LabeledInput
                label="Notas (opcional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Agrega una nota..."
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

function LabeledInput({
  label,
  multiline,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
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
  icon: ComponentProps<typeof Ionicons>['name'];
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
  amountInput: {
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
  block: {
    gap: 16,
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
    backgroundColor: SAVINGS_ACCENT,
    borderColor: SAVINGS_ACCENT,
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
  content: {
    padding: 18,
    paddingBottom: 28,
  },
  field: {
    gap: 7,
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
    padding: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
  preview: {
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  previewAmount: {
    color: APP_COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  previewLabel: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: SAVINGS_ACCENT,
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
    minHeight: 86,
    textAlignVertical: 'top',
  },
});
