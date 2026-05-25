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
import { fmt, parseAmt, todayStr } from '../utils/format';
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
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setAmtText(suggestedAmount != null ? String(suggestedAmount).replace('.', ',') : '');
    setDate(todayStr());
    setNote('');
  }, [visible, suggestedAmount]);

  if (!fromMember || !toMember) return null;

  const amount = parseAmt(amtText);

  const save = () => {
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Monto inválido', 'Escribe un monto mayor a cero.');
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD.');
      return;
    }
    const settlement: PlanSettlement = {
      id: Date.now(),
      fromMemberId: fromMember.id,
      toMemberId: toMember.id,
      amount,
      date,
      note: note.trim() || undefined,
    };
    addPlanSettlement(plan.id, settlement);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <ModalScreen
        title="Saldar deuda"
        onBack={onClose}
        contentContainerStyle={{ padding: 0 }}
        footer={(
          <Pressable
            onPress={() => runAfterKeyboardDismiss(save)}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
          >
            <Text style={styles.saveBtnText}>Registrar liquidación</Text>
          </Pressable>
        )}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.transferCard}>
            <MemberBubble member={fromMember} label="Paga" />
            <View style={styles.arrowWrap}>
              <View style={styles.arrowLine} />
              <Text style={styles.arrowAmt}>
                {Number.isFinite(amount) && amount > 0 ? fmt(amount, currency) : ''}
              </Text>
              <View style={styles.arrowLine} />
              <View style={styles.arrowHead} />
            </View>
            <MemberBubble member={toMember} label="Recibe" />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Monto</Text>
            <View style={styles.amountRow}>
              <TextInput
                value={amtText}
                onChangeText={setAmtText}
                placeholder="0,00"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                style={[styles.input, styles.amountInput]}
                autoFocus
              />
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyText}>{currency}</Text>
              </View>
            </View>
          </View>

          {suggestedAmount != null && suggestedAmount > 0 && (
            <Pressable
              onPress={() => setAmtText(String(suggestedAmount).replace('.', ','))}
              style={({ pressed }) => [styles.suggestionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.suggestionText}>
                Usar monto sugerido: {fmt(suggestedAmount, currency)}
              </Text>
            </Pressable>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Fecha</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nota (opcional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Ej. Transferencia por Bizum"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.noteInput]}
              multiline
            />
          </View>
        </ScrollView>
      </ModalScreen>
    </Modal>
  );
}

function MemberBubble({ member, label }: { member: PlanMember; label: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.bubble}>
      <View style={[styles.bubbleAvatar, { backgroundColor: member.bg }]}>
        <Text style={[styles.bubbleInitials, { color: member.color }]}>{member.initials}</Text>
      </View>
      <Text style={styles.bubbleName} numberOfLines={1}>{member.name}</Text>
      <Text style={styles.bubbleLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  scroll: {
    gap: 8,
    padding: 16,
    paddingBottom: 32,
  },

  transferCard: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 20,
  },
  bubble: {
    alignItems: 'center',
    gap: 6,
    width: 72,
  },
  bubbleAvatar: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  bubbleInitials: {
    fontSize: 16,
    fontWeight: '800',
  },
  bubbleName: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  bubbleLabel: {
    color: t.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  arrowWrap: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  arrowLine: {
    backgroundColor: t.border,
    height: 1.5,
    width: '80%',
  },
  arrowAmt: {
    color: ACCENT,
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    textAlign: 'center',
  },
  arrowHead: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 5,
    borderLeftColor: t.border,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderTopWidth: 5,
  },

  field: {
    gap: 8,
    paddingVertical: 8,
  },
  fieldLabel: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlignVertical: 'center',
  },
  amountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  amountInput: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 24,
    letterSpacing: -1.2,
    textAlign: 'center',
  },
  currencyBadge: {
    alignItems: 'center',
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  currencyText: {
    color: t.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  suggestionBtn: {
    alignItems: 'center',
    backgroundColor: ACCENT_BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestionText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },

  saveBtn: {
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 14,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: { opacity: 0.72 },
});
