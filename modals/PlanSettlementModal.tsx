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
import { ModalScreen } from '../components/ModalScreen';
import { type AppTheme } from '../constants/colors';
import type { Plan, PlanMember, PlanSettlement } from '../types';
import { parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../contexts/ThemeContext';
import { runAfterKeyboardDismiss } from '../utils/keyboard';

const ACCENT = '#7C3AED';
const ACCENT_BG = 'rgba(124, 58, 237, 0.18)';

interface PlanSettlementModalProps {
  visible: boolean;
  plan: Plan;
  fromMember?: PlanMember;
  toMember?: PlanMember;
  suggestedAmount?: number;
  onClose: () => void;
}

export function PlanSettlementModal({
  visible,
  plan,
  fromMember,
  toMember,
  suggestedAmount,
  onClose,
}: PlanSettlementModalProps) {
  const currency = useAppStore((s) => s.currency);
  const addPlanSettlement = useAppStore((s) => s.addPlanSettlement);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [amtText, setAmtText] = useState('');

  useEffect(() => {
    if (!visible) return;
    setAmtText(suggestedAmount != null ? String(suggestedAmount).replace('.', ',') : '');
  }, [visible, suggestedAmount]);

  if (!fromMember || !toMember) return null;

  const amount = parseAmt(amtText);
  const maxAmount = suggestedAmount ?? 0;

  const save = () => {
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Monto inválido', 'Escribe un monto mayor a cero.');
      return;
    }
    if (maxAmount > 0 && amount > maxAmount + 0.01) {
      Alert.alert('Monto inválido', 'El monto no puede ser mayor que la deuda pendiente.');
      return;
    }

    const settlement: PlanSettlement = {
      id: Date.now(),
      fromMemberId: fromMember.id,
      toMemberId: toMember.id,
      amount,
      date: todayStr(),
    };
    addPlanSettlement(plan.id, settlement);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <ModalScreen
        title={`Saldar deuda con ${toMember.name}`}
        onBack={onClose}
        contentContainerStyle={{ padding: 0 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.amountCard}>
            <Text style={styles.fieldLabel}>Monto</Text>
            <View style={styles.amountRow}>
              <TextInput
                value={amtText}
                onChangeText={setAmtText}
                placeholder="0,00"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                style={styles.amountInput}
              />
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyText}>{currency}</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => runAfterKeyboardDismiss(save)}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
          >
            <Text style={styles.saveBtnText}>Saldar</Text>
          </Pressable>
        </ScrollView>
      </ModalScreen>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  scroll: {
    gap: 12,
    padding: 16,
    paddingBottom: 32,
  },
  amountCard: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  fieldLabel: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  amountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  amountInput: {
    backgroundColor: t.background,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    color: t.textPrimary,
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 28,
    lineHeight: 34,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 8,
    textAlign: 'center',
  },
  currencyBadge: {
    alignItems: 'center',
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT,
    borderRadius: 12,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  currencyText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: { opacity: 0.72 },
});
