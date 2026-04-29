import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { ICON_COLORS } from '../constants/colors';

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <View style={styles.row}>
      {ICON_COLORS.map((item) => {
        const active = item.id === value;
        return (
          <Pressable
            accessibilityLabel={`Color ${item.id}`}
            key={item.id}
            onPress={() => onChange(item.id)}
            style={({ pressed }) => [
              styles.swatch,
              { backgroundColor: item.color },
              active && styles.active,
              pressed && styles.pressed,
            ]}
          >
            {active ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  active: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  pressed: {
    opacity: 0.72,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
