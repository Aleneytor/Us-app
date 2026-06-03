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
import { type AppTheme } from '../constants/colors';
import type { SavingPlan } from '../types';
import { savingPlanMonthlyAmount } from '../utils/calculations';
import { fmt, parseAmt, splitAmount, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../contexts/ThemeContext';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';

const SAVINGS_ACCENT = '#7C3AED';

type SaveType = 'free' | 'goal';

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
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [step, setStep] = useState(0);
  const [saveType, setSaveType] = useState<SaveType>('goal');
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
    saveType === 'goal' &&
    Number.isFinite(targetNumber) && targetNumber > 0 &&
    Number.isFinite(monthsNumber) && monthsNumber > 0
      ? savingPlanMonthlyAmount({
          id: plan?.id ?? 0,
          saveType: 'goal',
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

  // Total steps: step 0 = datos, step 1 = personalizar, step 2 = extra (solo para goal)
  const totalSteps = saveType === 'goal' ? 3 : 2;
  const breadcrumbs = saveType === 'goal'
    ? ['Tipo y datos', 'Personalizar', 'Extra']
    : ['Tipo y datos', 'Personalizar'];

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setSaveType((plan?.saveType as SaveType) ?? 'goal');
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
      Alert.alert('Falta el título', 'Ponle un nombre a tu ahorro.');
      return false;
    }
    if (saveType === 'goal' && (!Number.isFinite(targetNumber) || targetNumber <= 0)) {
      Alert.alert('Monto inválido', 'Escribe un monto mayor a cero.');
      return false;
    }
    return true;
  };

  const save = () => {
    if (!validateDataStep()) {
      setStep(0);
      return;
    }

    const next: SavingPlan = {
      id: plan?.id ?? Date.now(),
      saveType,
      type: planType,
      uid: planType === 'personal' ? (plan?.uid ?? currentUser) : undefined,
      icon,
      iconColor,
      title: title.trim(),
      targetAmount: saveType === 'goal' ? targetNumber : 0,
      months: saveType === 'goal' && monthsNumber > 0 ? monthsNumber : undefined,
      link: saveType === 'goal' ? (link.trim() || undefined) : undefined,
      notes: notes.trim() || undefined,
      date: plan?.date ?? todayStr(),
      history: plan?.history ?? [],
    };

    if (editing) updateSavingPlan(next);
    else addSavingPlan(next);
    onClose();
  };

  const handlePrimaryPress = () => {
    if (step < totalSteps - 1) {
      if (step === 0) runAfterKeyboardDismiss(() => { if (validateDataStep()) setStep(1); });
      else runAfterKeyboardDismiss(() => setStep(step + 1));
    } else {
      runAfterKeyboardDismiss(save);
    }
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
        breadcrumbs={breadcrumbs}
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
              <Text style={styles.primaryText}>{step < totalSteps - 1 ? 'Continuar' : 'Guardar'}</Text>
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
          {/* ── Paso 0: Tipo + Datos ── */}
          {step === 0 && (
            <View style={styles.block}>
              {/* Selector de tipo */}
              <View style={styles.field}>
                <Text style={styles.label}>Tipo de ahorro</Text>
                <View style={styles.typeRow}>
                  <TypeCard
                    icon="wallet-outline"
                    title="Ahorro libre"
                    description="Guarda sin meta fija"
                    active={saveType === 'free'}
                    onPress={() => { setSaveType('free'); setTargetAmount(''); setMonths(''); }}
                  />
                  <TypeCard
                    icon="flag-outline"
                    title="Para algo"
                    description="Con monto objetivo"
                    active={saveType === 'goal'}
                    onPress={() => setSaveType('goal')}
                  />
                </View>
              </View>

              {/* Título */}
              <LabeledInput
                label="Título"
                value={title}
                onChangeText={setTitle}
                placeholder={saveType === 'free' ? 'Ej. Mis ahorros' : 'Ej. Viaje a Roma'}
                autoFocus
              />

              {/* Monto objetivo — solo para goal */}
              {saveType === 'goal' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Monto objetivo</Text>
                  <TextInput
                    value={targetAmount}
                    onChangeText={setTargetAmount}
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    style={styles.amountInput}
                  />
                </View>
              )}

              {/* Plazo en meses — solo para goal */}
              {saveType === 'goal' && (
                <LabeledInput
                  label="Plazo en meses (opcional)"
                  value={months}
                  onChangeText={setMonths}
                  placeholder="Ej. 6"
                  keyboardType="number-pad"
                />
              )}

              {/* Preview mensual */}
              {monthlyPreview !== null && (() => {
                const parts = splitAmount(monthlyPreview, currency);
                return (
                  <View style={styles.preview}>
                    <Text style={styles.previewLabel}>Debes ahorrar al mes</Text>
                    <Text style={styles.previewAmount}>
                      {parts.sign}{parts.whole}<Text style={styles.previewDecimals}>,{parts.decimals} {parts.symbol}</Text>
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}

          {/* ── Paso 1: Personalizar ── */}
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
                <Text style={styles.label}>Privacidad</Text>
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

          {/* ── Paso 2: Extra (solo goal) ── */}
          {step === 2 && saveType === 'goal' && (
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

          {/* ── Paso 1 para free: notas ── */}
          {step === 1 && saveType === 'free' && (
            <View style={styles.block}>
              {/* Personalizar ya está en step 1, notas van aquí en el mismo paso */}
            </View>
          )}
        </ScrollView>
      </ModalScreen>
    </Modal>
  );
}

// ── TypeCard ─────────────────────────────────────────────────────────────────

function TypeCard({
  icon,
  title,
  description,
  active,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.typeCard,
        active && styles.typeCardActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.typeCardIcon, active && styles.typeCardIconActive]}>
        <Ionicons name={icon} size={20} color={active ? '#FFFFFF' : theme.textSecondary} />
      </View>
      <Text style={[styles.typeCardTitle, active && styles.typeCardTitleActive]}>{title}</Text>
      <Text style={[styles.typeCardDesc, active && styles.typeCardDescActive]}>{description}</Text>
    </Pressable>
  );
}

// ── LabeledInput ─────────────────────────────────────────────────────────────

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

// ── ChoiceButton ─────────────────────────────────────────────────────────────

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

// ── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (t: AppTheme) => StyleSheet.create({
  scroller: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 28,
  },
  block: {
    gap: 16,
  },
  // -- Type selector --
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeCard: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 14,
    borderWidth: 1.5,
    flex: 1,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  typeCardActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderColor: SAVINGS_ACCENT,
  },
  typeCardIcon: {
    alignItems: 'center',
    backgroundColor: t.background,
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  typeCardIconActive: {
    backgroundColor: SAVINGS_ACCENT,
  },
  typeCardTitle: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  typeCardTitleActive: {
    color: SAVINGS_ACCENT,
  },
  typeCardDesc: {
    color: t.textMuted,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  typeCardDescActive: {
    color: SAVINGS_ACCENT,
    opacity: 0.8,
  },
  // -- Fields --
  field: {
    gap: 7,
  },
  label: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '600',
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
  textarea: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
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
  // -- Monthly preview --
  preview: {
    backgroundColor: t.background,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  previewLabel: {
    color: t.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  previewAmount: {
    color: t.textPrimary,
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    letterSpacing: -0.5,
  },
  previewDecimals: {
    color: t.textMuted,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    letterSpacing: -0.3,
  },
  // -- Choice buttons --
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
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
    backgroundColor: SAVINGS_ACCENT,
    borderColor: SAVINGS_ACCENT,
  },
  choiceBtnText: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '400',
  },
  choiceBtnTextActive: {
    color: '#FFFFFF',
  },
  // -- Footer buttons --
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
  pressed: {
    opacity: 0.72,
  },
});
