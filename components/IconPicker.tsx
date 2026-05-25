import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ALL_CATEGORY_KEYS, CATEGORIES } from '../constants/categories';
import { getIconColor, type AppTheme } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';

interface IconPickerProps {
  value: string;
  colorId: string;
  keys?: string[];
  horizontalInset?: number;
  onChange: (value: string) => void;
}

export function IconPicker({ value, colorId, keys, horizontalInset = 0, onChange }: IconPickerProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const color = getIconColor(colorId);
  const categoryKeys = keys ?? ALL_CATEGORY_KEYS;
  const columns = categoryKeys.reduce<string[][]>((acc, key, index) => {
    const columnIndex = Math.floor(index / 3);
    if (!acc[columnIndex]) acc[columnIndex] = [];
    acc[columnIndex].push(key);
    return acc;
  }, []);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[
        styles.scroller,
        horizontalInset > 0 && { marginHorizontal: -horizontalInset },
      ]}
      contentContainerStyle={[
        styles.grid,
        horizontalInset > 0 && { paddingHorizontal: horizontalInset },
      ]}
    >
      {columns.map((column, columnIndex) => (
        <View key={`icon-column-${columnIndex}`} style={styles.column}>
          {column.map((key) => {
            const category = CATEGORIES[key];
            if (!category) return null;
            const active = key === value;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onChange(key);
                }}
                style={({ pressed }) => [
                  styles.item,
                  active && { borderColor: color.color, backgroundColor: color.color },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={category.icon}
                  size={22}
                  color={active ? '#FFFFFF' : theme.textSecondary}
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (theme: AppTheme) => StyleSheet.create({
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
    borderRadius: 16,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 48,
  },
  pressed: {
    opacity: 0.72,
  },
  scroller: {
    maxHeight: 154,
  },
});
