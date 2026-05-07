import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { ALL_CATEGORY_KEYS, CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';

interface IconPickerProps {
  value: string;
  colorId: string;
  keys?: string[];
  onChange: (value: string) => void;
}

export function IconPicker({ value, colorId, keys, onChange }: IconPickerProps) {
  const color = getIconColor(colorId);
  const categoryKeys = keys ?? ALL_CATEGORY_KEYS;

  return (
    <View style={styles.grid}>
      {categoryKeys.map((key) => {
        const category = CATEGORIES[key];
        if (!category) return null;
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={({ pressed }) => [
              styles.item,
              active && { borderColor: color.color, backgroundColor: color.bg },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={category.icon}
              size={22}
              color={active ? color.color : APP_COLORS.textSecondary}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  item: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 48,
  },
  pressed: {
    opacity: 0.72,
  },
});
