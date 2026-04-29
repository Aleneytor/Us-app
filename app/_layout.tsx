import 'react-native-url-polyfill/auto'; // must be first import
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initialize } from '../store/useAppStore';

export default function RootLayout() {
  useEffect(() => {
    initialize();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
