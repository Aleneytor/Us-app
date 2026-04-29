import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatYM, nextYM, prevYM } from '../utils/format';
import { APP_COLORS } from '../constants/colors';

interface MonthNavigatorProps {
  ym: string;
  onChange: (ym: string) => void;
}

export function MonthNavigator({ ym, onChange }: MonthNavigatorProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel="Mes anterior"
        onPress={() => onChange(prevYM(ym))}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={APP_COLORS.textPrimary} />
      </Pressable>

      <Text style={styles.label}>{formatYM(ym)}</Text>

      <Pressable
        accessibilityLabel="Mes siguiente"
        onPress={() => onChange(nextYM(ym))}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-forward" size={22} color={APP_COLORS.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: APP_COLORS.surface,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
  },
  button: {
    alignItems: 'center',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  label: {
    color: APP_COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    backgroundColor: '#F1F5F9',
  },
});
