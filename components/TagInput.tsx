import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { APP_COLORS } from '../constants/colors';
import { TagChip } from './TagChip';

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
}

function normalizeTag(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, '-');
  if (!cleaned) return '';
  return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
}

export function TagInput({ value, onChange }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const tag = normalizeTag(draft);
    if (!tag) return;
    if (!value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {value.map((tag) => (
          <Pressable key={tag} onPress={() => onChange(value.filter((item) => item !== tag))}>
            <TagChip tag={tag} small />
          </Pressable>
        ))}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          autoCapitalize="none"
          onChangeText={setDraft}
          onSubmitEditing={addTag}
          placeholder="Agregar tag"
          placeholderTextColor={APP_COLORS.textMuted}
          returnKeyType="done"
          style={styles.input}
          value={draft}
        />
        <Pressable onPress={addTag} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.blue,
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  input: {
    color: APP_COLORS.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  inputRow: {
    alignItems: 'center',
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    paddingHorizontal: 10,
  },
  pressed: {
    opacity: 0.72,
  },
  wrap: {
    gap: 8,
  },
});
