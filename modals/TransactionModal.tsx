import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ColorPicker } from '../components/ColorPicker';
import { IconPicker } from '../components/IconPicker';
import { TagInput } from '../components/TagInput';
import { APP_COLORS } from '../constants/colors';
import type { Transaction } from '../types';
import { parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';

interface TransactionModalProps {
  visible: boolean;
  transaction?: Transaction | null;
  initialKind?: 'expense' | 'income';
  onClose: () => void;
}

const ACCOUNTS = ['Efectivo', 'Tarjeta', 'Cuenta'];

export function TransactionModal({ visible, transaction, initialKind = 'expense', onClose }: TransactionModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const updateTransaction = useAppStore((s) => s.updateTransaction);

  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState<'monthly' | 'once'>('once');
  const [account, setAccount] = useState('Tarjeta');
  const [tags, setTags] = useState<string[]>([]);
  const [cat, setCat] = useState('food');
  const [iconColor, setIconColor] = useState('blue');
  const [notes, setNotes] = useState('');

  const editing = !!transaction;

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setKind(transaction?.kind ?? initialKind);
    setDesc(transaction?.desc ?? '');
    setAmt(transaction ? String(transaction.amt) : '');
    setDate(transaction?.date ?? todayStr());
    setType(transaction?.type ?? 'once');
    setAccount(transaction?.account || 'Tarjeta');
    setTags(transaction?.tags ?? []);
    setCat(transaction?.cat ?? 'food');
    setIconColor(transaction?.iconColor ?? 'blue');
    setNotes(transaction?.notes ?? '');
  }, [initialKind, transaction, visible]);

  const amountNumber = useMemo(() => parseAmt(amt), [amt]);

  const goNext = () => {
    if (step === 0 && !desc.trim()) {
      Alert.alert('Falta descripcion', 'Ponle un nombre al movimiento.');
      return;
    }
    if (step === 1 && (!Number.isFinite(amountNumber) || amountNumber <= 0)) {
      Alert.alert('Monto invalido', 'Escribe un monto mayor a cero.');
      return;
    }
    setStep((value) => Math.min(2, value + 1));
  };

  const save = () => {
    if (!desc.trim() || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      Alert.alert('Datos incompletos', 'Revisa la descripcion y el monto.');
      return;
    }

    const next: Transaction = {
      id: transaction?.id ?? Date.now(),
      uid: transaction?.uid ?? currentUser,
      cat,
      iconColor,
      desc: desc.trim(),
      account: account.trim(),
      amt: amountNumber,
      date: date.trim() || todayStr(),
      type,
      kind,
      tags,
      notes: notes.trim(),
      del: transaction?.del,
      paid: transaction?.paid,
      paidAt: transaction?.paidAt,
    };

    if (editing) updateTransaction(next);
    else addTransaction(next);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{editing ? 'Editar movimiento' : 'Nuevo movimiento'}</Text>
            <Text style={styles.subtitle}>Paso {step + 1} de 3</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={23} color={APP_COLORS.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.steps}>
          {[0, 1, 2].map((item) => (
            <View key={item} style={[styles.stepDot, item <= step && styles.stepDotActive]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 0 ? (
            <View style={styles.block}>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.choiceRow}>
                <Choice label="Gasto" active={kind === 'expense'} tone="expense" onPress={() => setKind('expense')} />
                <Choice label="Ingreso" active={kind === 'income'} tone="income" onPress={() => setKind('income')} />
              </View>
              <Field label="Descripcion" value={desc} onChangeText={setDesc} placeholder="Ej. Supermercado" autoFocus />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.block}>
              <Field label="Monto" value={amt} onChangeText={setAmt} placeholder="0,00" keyboardType="decimal-pad" />
              <Field label="Fecha" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
              <Text style={styles.label}>Frecuencia</Text>
              <View style={styles.choiceRow}>
                <Choice label="Unico" active={type === 'once'} onPress={() => setType('once')} />
                <Choice label="Mensual" active={type === 'monthly'} onPress={() => setType('monthly')} />
              </View>
              <Text style={styles.label}>Cuenta</Text>
              <View style={styles.choiceRow}>
                {ACCOUNTS.map((item) => (
                  <Choice key={item} label={item} active={account === item} onPress={() => setAccount(item)} />
                ))}
              </View>
              <Text style={styles.label}>Tags</Text>
              <TagInput value={tags} onChange={setTags} />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.block}>
              <Text style={styles.label}>Categoria</Text>
              <IconPicker value={cat} colorId={iconColor} onChange={setCat} />
              <Text style={styles.label}>Color</Text>
              <ColorPicker value={iconColor} onChange={setIconColor} />
              <Field
                label="Notas"
                value={notes}
                onChangeText={setNotes}
                placeholder="Opcional"
                multiline
              />
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 ? (
            <Pressable onPress={() => setStep((value) => Math.max(0, value - 1))} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Atras</Text>
            </Pressable>
          ) : (
            <View style={styles.secondaryButton} />
          )}
          <Pressable onPress={step === 2 ? save : goNext} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{step === 2 ? 'Guardar' : 'Siguiente'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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

function Choice({
  label,
  active,
  tone,
  onPress,
}: {
  label: string;
  active: boolean;
  tone?: 'income' | 'expense';
  onPress: () => void;
}) {
  const activeColor = tone === 'income' ? APP_COLORS.income : tone === 'expense' ? APP_COLORS.expense : APP_COLORS.blue;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        active && { backgroundColor: activeColor, borderColor: activeColor },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 14,
  },
  choice: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceText: {
    color: APP_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
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
    fontWeight: '900',
  },
  stepDot: {
    backgroundColor: '#CBD5E1',
    borderRadius: 999,
    flex: 1,
    height: 5,
  },
  stepDotActive: {
    backgroundColor: APP_COLORS.blue,
  },
  steps: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  subtitle: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  textarea: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  title: {
    color: APP_COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '900',
  },
});
