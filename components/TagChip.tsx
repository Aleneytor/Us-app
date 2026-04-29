import { Pressable, StyleSheet, Text } from 'react-native';
import { tagColorFor } from '../constants/colors';

interface TagChipProps {
  tag: string;
  onPress?: (tag: string) => void;
  small?: boolean;
}

export function TagChip({ tag, onPress, small = false }: TagChipProps) {
  const colors = tagColorFor(tag);

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.(tag)}
      style={({ pressed }) => [
        styles.chip,
        small && styles.small,
        { backgroundColor: colors.bg },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, small && styles.smallText, { color: colors.c }]} numberOfLines={1}>
        {tag}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pressed: {
    opacity: 0.72,
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  smallText: {
    fontSize: 11,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
