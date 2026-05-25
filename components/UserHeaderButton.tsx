import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface UserHeaderButtonProps {
  variant?: 'default' | 'light';
  tintColor?: string;
}

export function UserHeaderButton({ variant = 'default', tintColor }: UserHeaderButtonProps) {
  const router = useRouter();
  const theme = useTheme();
  const light = variant === 'light';

  // If light variant (on colorful gradients), use a premium glassmorphic style:
  // - Background: semi-transparent white (rgba(255, 255, 255, 0.22))
  // - Icon color: solid white (#FFFFFF) for maximum contrast and elegant look
  // If default variant (on solid backgrounds), use standard theme styles:
  // - Background: theme.softSurface
  // - Icon color: theme.textPrimary
  const buttonBg = light ? 'rgba(255, 255, 255, 0.22)' : theme.softSurface;
  const iconColor = light ? '#FFFFFF' : (tintColor ?? theme.textPrimary);

  return (
    <Pressable
      accessibilityLabel="Abrir usuario"
      onPress={() => router.push('/perfil')}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: buttonBg },
        pressed && styles.pressed,
      ]}
      hitSlop={8}
    >
      <Ionicons name="person-outline" size={20} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 18,
    flexShrink: 0,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  pressed: {
    opacity: 0.7,
  },
});
