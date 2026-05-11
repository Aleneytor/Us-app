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
import { IconPicker } from '../components/IconPicker';
import { AppModal as Modal } from '../components/AppModal';
import { SAVING_ICON_KEYS } from '../constants/categories';
import { APP_COLORS } from '../constants/colors';
import { MODAL_TITLE_FONT_WEIGHT } from '../constants/typography';
import type { SavingPlan } from '../types';
import { savingPlanMonthlyAmount } from '../utils/calculations';
import { fmt, parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { dismissKeyboardAndBlur, runAfterKeyboardDismiss } from '../utils/keyboard';

const SAVINGS_ACCENT = '#7C3AED';

interface SavingPlanModalProps {
  visible: boolean;
  plan?: SavingPlan | null;
  onClose: () => void;
}

export function SavingPlanModal({ visible, plan, onClose }: SavingPlanModalProps) {
  const insets = useSafeAreaInsets();
  const currentUser = useAppStore((s) => s.currentUser);
  const currency = useAppStore((s) => s.currency);
  const addSavingPlan = useAppStore((s) => s.addSavingPlan);
  const updateSavingPlan = useAppStore((s) => s.updateSavingPlan);

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('savings');
  const [targetAmount, setTargetAmount] = useState('');
  const [months, setMonths] = useState('');
  const [link, setLink] = useState('');
  const [planType, setPlanType] = useState<'joint' | 'personal'>('personal');
  const targetNumber = useMemo(() => parseAmt(targetAmount), [targetAmount]);
  const monthsNumber = Number.parseInt(months, 10);
  const monthlyPreview = Number.isFinite(targetNumber) && targetNumber > 0 && Number.isFinite(monthsNumber) && monthsNumber > 0
    ? savingPlanMonthlyAmount({
      id: plan?.id ?? 0,
      type: planType,
      uid: planType === 'personal' ? (plan?.uid ?? currentUser) : undefined,
      icon,
      title: title.trim() || 'Ahorro',
      targetAmount: targetNumber,
      months: monthsNumber,
      link: link.trim() || undefined,
      date: plan?.date ?? todayStr(),
      history: plan?.history ?? [],
    })
    : null;
  const editing = !!plan;

  useEffect(() => {
    if (!visible) return;
    setTitle(plan?.title ?? '');
    setIcon(plan?.icon ?? 'savings');
    setTargetAmount(plan ? String(plan.targetAmount) : '');
    setMonths(plan ? String(plan.months) : '');
    setLink(plan?.link ?? '');
    setPlanType(plan?.type ?? 'personal');
  }, [visible, plan]);

  const save = () => {
    if (!title.trim() || !Number.isFinite(targetNumber) || targetNumber <= 0) {
      Alert.alert('Datos incompletos', 'Revisa el titulo y el monto objetivo.');
      return;
    }
    if (!Number.isFinite(monthsNumber) || monthsNumber <= 0) {
      Alert.alert('Falta el plazo', 'Indica en cuantos meses quieres lograr este ahorro.');
      return;
    }

    const next: SavingPlan = {
      id: plan?.id ?? Date.now(),
      type: planType,
      uid: planType === 'personal' ? (plan?.uid ?? currentUser) : undefined,
      icon,
      title: title.trim(),
      targetAmount: targetNumber,
      months: monthsNumber,
      link: link.trim() || undefined,
      date: plan?.date ?? todayStr(),
      history: plan?.history ?? [],
    };

    if (editing) updateSavingPlan(next);
    else addSavingPlan(next);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.keyboardView}>
      <Pressable style={[styles.backdrop, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]} onPressIn={onClose}>
        <Pressable style={styles.screenShadow} onPressIn={(event) => event.stopPropagation()}>
          <View style={styles.screen}>
          <View style={styles.header}>
            <Text style={styles.title}>{editing ? 'Editar ahorro' : 'Nuevo ahorro'}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={23} color={APP_COLORS.textPrimary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={dismissKeyboardAndBlur}
          >
            <Field label="Titulo" value={title} onChangeText={setTitle} placeholder="Ej. Auriculares" autoFocus />
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
            <Field
              label="Plazo en meses"
              value={months}
              onChangeText={setMonths}
              placeholder="Ej. 6"
              keyboardType="number-pad"
            />
            <View style={styles.field}>
              <Text style={styles.label}>Icono</Text>
              <IconPicker
                value={icon}
                colorId="purple"
                keys={SAVING_ICON_KEYS}
                horizontalInset={16}
                onChange={setIcon}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Tipo de ahorro</Text>
              <View style={styles.segmented}>
                <SegmentOption
                  label="En conjunto"
                  icon="people-outline"
                  active={planType === 'joint'}
                  onPress={() => setPlanType('joint')}
                />
                <SegmentOption
                  label="Solo yo"
                  icon="person-outline"
                  active={planType === 'personal'}
                  onPress={() => setPlanType('personal')}
                />
              </View>
            </View>
            <Field
              label="Link"
              value={link}
              onChangeText={setLink}
              placeholder="https://..."
              keyboardType="url"
              autoCapitalize="none"
            />

            <View style={styles.preview}>
              <Text style={styles.previewLabel}>Debes ahorrar al mes</Text>
              <Text style={styles.previewAmount}>
                {monthlyPreview === null ? '--' : fmt(monthlyPreview, currency)}
              </Text>
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Pressable onPress={() => runAfterKeyboardDismiss(onClose)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={() => runAfterKeyboardDismiss(save)} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Guardar</Text>
            </Pressable>
          </View>
          </View>
        </Pressable>
      </Pressable>
      </View>
    </Modal>
  );
}

function SegmentOption({
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
        styles.segmentOption,
        active && styles.segmentOptionActive,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? SAVINGS_ACCENT : APP_COLORS.textSecondary} />
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
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
        style={styles.input}
        {...props}
      />
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
  closeButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
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
    fontWeight: '400',
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
  pressed: {
    opacity: 0.72,
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
    fontWeight: '400',
  },
  segmented: {
    backgroundColor: '#F8FAFC',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    padding: 4,
  },
  segmentOption: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 38,
  },
  segmentOptionActive: {
    backgroundColor: '#FFFFFF',
    borderColor: APP_COLORS.border,
    borderWidth: 1,
  },
  segmentText: {
    color: APP_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: APP_COLORS.textPrimary,
  },
  title: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 21,
    fontWeight: MODAL_TITLE_FONT_WEIGHT,
  },
});
