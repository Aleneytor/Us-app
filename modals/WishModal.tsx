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
import { EmojiPicker } from '../components/EmojiPicker';
import { IconPicker } from '../components/IconPicker';
import { TagInput } from '../components/TagInput';
import { APP_COLORS } from '../constants/colors';
import { WISH_EMOJIS } from '../constants/emojis';
import type { Wish } from '../types';
import { parseAmt, todayStr } from '../utils/format';
import { useAppStore } from '../store/useAppStore';

interface WishModalProps {
  visible: boolean;
  wish?: Wish | null;
  onClose: () => void;
}

export function WishModal({ visible, wish, onClose }: WishModalProps) {
  const currentUser = useAppStore((s) => s.currentUser);
  const addWish = useAppStore((s) => s.addWish);
  const updateWish = useAppStore((s) => s.updateWish);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [months, setMonths] = useState('');
  const [link, setLink] = useState('');
  const [date, setDate] = useState(todayStr());
  const [cat, setCat] = useState('shopping');
  const [iconColor, setIconColor] = useState('pink');
  const [emoji, setEmoji] = useState<string | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const priceNumber = useMemo(() => parseAmt(price), [price]);
  const monthsNumber = Number.parseInt(months, 10);
  const editing = !!wish;

  useEffect(() => {
    if (!visible) return;
    setName(wish?.name ?? '');
    setPrice(wish ? String(wish.price) : '');
    setMonths(wish?.months ? String(wish.months) : '');
    setLink(wish?.link ?? '');
    setDate(wish?.date ?? todayStr());
    setCat(wish?.cat ?? 'shopping');
    setIconColor(wish?.iconColor ?? 'pink');
    setEmoji(wish?.em);
    setTags(wish?.tags ?? []);
    setNotes(wish?.notes ?? '');
  }, [visible, wish]);

  const save = () => {
    if (!name.trim() || !Number.isFinite(priceNumber) || priceNumber <= 0) {
      Alert.alert('Datos incompletos', 'Revisa el nombre y el precio.');
      return;
    }

    const next: Wish = {
      id: wish?.id ?? Date.now(),
      uid: wish?.uid ?? currentUser,
      cat,
      iconColor,
      name: name.trim(),
      price: priceNumber,
      months: Number.isFinite(monthsNumber) && monthsNumber > 0 ? monthsNumber : null,
      link: link.trim(),
      tags,
      date: date.trim() || todayStr(),
      em: emoji,
      notes: notes.trim() || undefined,
    };

    if (editing) updateWish(next);
    else addWish(next);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>{editing ? 'Editar deseo' : 'Nuevo deseo'}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={23} color={APP_COLORS.textPrimary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Auriculares" autoFocus />
          <Field label="Precio" value={price} onChangeText={setPrice} placeholder="0,00" keyboardType="decimal-pad" />
          <Field label="Meses" value={months} onChangeText={setMonths} placeholder="Opcional" keyboardType="number-pad" />
          <Field label="Link" value={link} onChangeText={setLink} placeholder="https://..." keyboardType="url" autoCapitalize="none" />
          <Field label="Fecha" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          <Text style={styles.label}>Emoji</Text>
          <EmojiPicker options={WISH_EMOJIS} value={emoji} onChange={setEmoji} />
          <Text style={styles.label}>Categoria</Text>
          <IconPicker value={cat} colorId={iconColor} onChange={setCat} />
          <Text style={styles.label}>Color</Text>
          <ColorPicker value={iconColor} onChange={setIconColor} />
          <Text style={styles.label}>Tags</Text>
          <TagInput value={tags} onChange={setTags} />
          <Field label="Notas" value={notes} onChangeText={setNotes} placeholder="Opcional" multiline />
        </ScrollView>
        <View style={styles.footer}>
          <Pressable onPress={onClose} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={save} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Guardar</Text>
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

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
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
  label: {
    color: APP_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
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
  textarea: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  title: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 21,
    fontWeight: '900',
  },
});
