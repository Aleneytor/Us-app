import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ALL_CATEGORY_KEYS, CATEGORIES } from '../constants/categories';
import { APP_COLORS, getIconColor } from '../constants/colors';

interface IconPickerProps {
  value: string;
  colorId: string;
  onChange: (value: string) => void;
}

export function IconPicker({ value, colorId, onChange }: IconPickerProps) {
  const color = getIconColor(colorId);

  return (
    <View style={styles.grid}>
      {ALL_CATEGORY_KEYS.map((key) => {
        const category = CATEGORIES[key];
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
              size={21}
              color={active ? color.color : APP_COLORS.textSecondary}
            />
            <Text numberOfLines={1} style={[styles.label, active && { color: color.color }]}>
              {category.label}
            </Text>
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
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    height: 64,
    justifyContent: 'center',
    width: 74,
  },
  label: {
    color: APP_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 62,
  },
  pressed: {
    opacity: 0.72,
  },
});
