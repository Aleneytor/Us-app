import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';

interface EmojiPickerProps {
  options: string[];
  value?: string;
  onChange: (value: string) => void;
}

export function EmojiPicker({ options, value, onChange }: EmojiPickerProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const columns = options.reduce<string[][]>((acc, emoji, index) => {
    const columnIndex = Math.floor(index / 3);
    if (!acc[columnIndex]) acc[columnIndex] = [];
    acc[columnIndex].push(emoji);
    return acc;
  }, []);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.grid}
    >
      {columns.map((column, columnIndex) => (
        <View key={`emoji-column-${columnIndex}`} style={styles.column}>
          {column.map((emoji) => {
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
      ))}
    </ScrollView>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
  active: {
    backgroundColor: 'rgba(37, 99, 235, 0.18)',
    borderColor: theme.blue,
  },
  emoji: {
    fontSize: 22,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 2,
  },
  column: {
    gap: 8,
  },
  item: {
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pressed: {
    opacity: 0.72,
  },
  scroller: {
    maxHeight: 148,
  },
});
