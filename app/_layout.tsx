import 'react-native-url-polyfill/auto'; // must be first import
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { initialize } from '../store/useAppStore';
import { requestNotificationPermissions } from '../services/notifications';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_700Bold: require('../assets/fonts/Inter_700Bold.ttf'),
    Inter_600SemiBold: require('../assets/fonts/Inter_600SemiBold.ttf'),
    DMSerifDisplay_400Regular: require('../assets/fonts/DMSerifDisplay_400Regular.ttf'),
  });

  useEffect(() => {
    void initialize();
    void requestNotificationPermissions();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
