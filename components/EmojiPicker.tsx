import { Pressable, StyleSheet, Text, View } from 'react-native';
import { APP_COLORS } from '../constants/colors';

interface EmojiPickerProps {
  options: string[];
  value?: string;
  onChange: (value: string) => void;
}

export function EmojiPicker({ options, value, onChange }: EmojiPickerProps) {
  return (
    <View style={styles.grid}>
      {options.map((emoji) => {
        const active = emoji === value;
        return (
          <Pressable
            key={emoji}
            onPress={() => onChange(emoji)}
            style={({ pressed }) => [
              styles.item,
              active && styles.active,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  active: {
    backgroundColor: '#DBEAFE',
    borderColor: APP_COLORS.blue,
  },
  emoji: {
    fontSize: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  item: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pressed: {
    opacity: 0.72,
  },
});
