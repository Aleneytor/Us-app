import 'react-native-url-polyfill/auto'; // must be first import
import { useEffect, useRef } from 'react';
import {
  AppState,
  type AppStateStatus,
  Platform,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { initialize, foregroundRefresh, useAppStore } from '../store/useAppStore';
import { requestNotificationPermissions } from '../services/notifications';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';

function AppNavigator() {
  const theme = useTheme();
  const navTheme = theme.mode === 'light'
    ? {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.background,
          card: theme.surface,
          text: theme.textPrimary,
          border: theme.border,
        },
      }
    : {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.background,
          card: theme.surface,
          text: theme.textPrimary,
          border: theme.border,
        },
      };

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={theme.mode === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="perfil" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}

function ResponsiveWebShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  
  const currentUser = useAppStore((s) => s.currentUser);
  const users = useAppStore((s) => s.users);
  const currency = useAppStore((s) => s.currency);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const themeMode = useAppStore((s) => s.themeMode);

  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (a: Animated.Value, duration: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(a, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ).start();
    };

    loop(anim1, 16000);
    loop(anim2, 22000);
  }, [anim1, anim2]);

  if (Platform.OS !== 'web' || width <= 600) {
    return <>{children}</>;
  }

  const user = users[currentUser] ?? { name: currentUser, initials: '?', color: '#6B7280', bg: '#F3F4F6' };
  const partnerId = useAppStore.getState().partnerForUser[currentUser];
  const partner = partnerId && partnerId !== currentUser ? users[partnerId] : null;

  const syncInfo = {
    live: { label: 'Conexión activa', color: '#16A34A', icon: 'checkmark-circle' as const },
    connecting: { label: 'Conectando Supabase...', color: '#94A3B8', icon: 'sync' as const },
    error: { label: 'Error de sincronización', color: '#EC1147', icon: 'alert-circle' as const },
  }[syncStatus] ?? { label: 'Conectando...', color: '#94A3B8', icon: 'sync' as const };

  const translateX1 = anim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });
  const translateY1 = anim2.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 60],
  });

  const translateX2 = anim2.interpolate({
    inputRange: [0, 1],
    outputRange: [120, -120],
  });
  const translateY2 = anim1.interpolate({
    inputRange: [0, 1],
    outputRange: [80, -80],
  });

  const styles = makeStyles(theme);

  return (
    <View style={styles.webContainer}>
      <Head>
        <title>Nosotros — Finanzas en Pareja</title>
        <meta name="description" content="Nosotros es la aplicación premium para controlar las finanzas y presupuestos en pareja de forma sincronizada y sencilla." />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
      </Head>

      {/* Drifting background blobs */}
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.blob,
            styles.blob1,
            { transform: [{ translateX: translateX1 }, { translateY: translateY1 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob2,
            { transform: [{ translateX: translateX2 }, { translateY: translateY2 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.blob,
            styles.blob3,
            { transform: [{ translateX: translateY1 }, { translateY: translateX2 }] },
          ]}
        />
      </View>

      <View style={styles.webContentContainer}>
        {/* Left glass panel with desktop widgets */}
        <View style={styles.leftPanel}>
          <View style={styles.brandRow}>
            <View style={styles.logoWrap}>
              <Ionicons name="sparkles" size={24} color="#7C3AED" />
            </View>
            <View>
              <Text style={styles.brandTitle}>Nosotros</Text>
              <Text style={styles.brandSubtitle}>Finanzas Compartidas</Text>
            </View>
          </View>

          <View style={styles.glassDivider} />

          {/* Sync widget */}
          <View style={styles.widgetCard}>
            <View style={[styles.widgetIconWrap, { backgroundColor: syncInfo.color + '16' }]}>
              <Ionicons name={syncInfo.icon} size={20} color={syncInfo.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.widgetLabel}>Estado de Nube</Text>
              <Text style={[styles.widgetValue, { color: syncInfo.color }]}>{syncInfo.label}</Text>
            </View>
          </View>

          {/* Household widget */}
          <View style={styles.widgetCard}>
            <View style={[styles.widgetIconWrap, { backgroundColor: '#7C3AED16' }]}>
              <Ionicons name="people-outline" size={20} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.widgetLabel}>Hogar Activo</Text>
              <View style={styles.avatarsRow}>
                <View style={[styles.avatarBadge, { backgroundColor: user.bg }]}>
                  <Text style={[styles.avatarText, { color: user.color }]}>{user.initials}</Text>
                </View>
                {partner && (
                  <>
                    <Ionicons name="heart" size={14} color="#EC1147" style={{ marginHorizontal: 4 }} />
                    <View style={[styles.avatarBadge, { backgroundColor: partner.bg }]}>
                      <Text style={[styles.avatarText, { color: partner.color }]}>{partner.initials}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Preferences widget */}
          <View style={styles.widgetCard}>
            <View style={[styles.widgetIconWrap, { backgroundColor: '#0EA5E916' }]}>
              <Ionicons name="settings-outline" size={20} color="#0EA5E9" />
            </View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.widgetLabel}>Moneda</Text>
                <Text style={styles.widgetText}>{currency}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.widgetLabel}>Tema</Text>
                <Text style={styles.widgetText}>{themeMode === 'light' ? 'Claro' : 'Oscuro'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.glassDivider} />

          {/* Voice actions guide */}
          <View style={styles.voiceGuide}>
            <Text style={styles.guideTitle}>
              <Ionicons name="mic-outline" size={16} color="#7C3AED" /> Creación por Voz
            </Text>
            <Text style={styles.guideIntro}>
              En móvil, mantén presionado el botón central de añadir (+) para usar comandos en español:
            </Text>
            <View style={styles.guideExamples}>
              <Text style={styles.guideExample}>🗣️ &quot;gasté 32 en comida hoy&quot;</Text>
              <Text style={styles.guideExample}>🗣️ &quot;ingreso de 1200 por nómina&quot;</Text>
              <Text style={styles.guideExample}>🗣️ &quot;ahorrar 350 para viaje de verano&quot;</Text>
              <Text style={styles.guideExample}>🗣️ &quot;crea plan viaje playa con {partner?.name ?? 'pareja'}&quot;</Text>
            </View>
          </View>
        </View>

        {/* Right Phone container */}
        <View style={styles.phoneFrame}>
          <View style={styles.phoneInnerContainer}>
            {children}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    void initialize();
    void requestNotificationPermissions();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current !== 'active' && nextState === 'active') {
        void foregroundRefresh();
      }
      appState.current = nextState;
    });

    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ResponsiveWebShell>
          <AppNavigator />
        </ResponsiveWebShell>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: t.background,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        width: '100vw',
        height: '100vh',
      } as any,
      default: {},
    }),
  },
  webContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    padding: 24,
  },
  blob: {
    position: 'absolute',
    borderRadius: 300,
    ...Platform.select({
      web: {
        filter: 'blur(90px)',
      } as any,
      default: {},
    }),
  },
  blob1: {
    backgroundColor: t.mode === 'dark' ? 'rgba(124, 58, 237, 0.14)' : 'rgba(167, 139, 250, 0.26)',
    width: 450,
    height: 450,
    top: '10%',
    left: '15%',
  },
  blob2: {
    backgroundColor: t.mode === 'dark' ? 'rgba(22, 163, 74, 0.11)' : 'rgba(167, 243, 208, 0.24)',
    width: 480,
    height: 480,
    bottom: '12%',
    right: '18%',
  },
  blob3: {
    backgroundColor: t.mode === 'dark' ? 'rgba(234, 88, 12, 0.11)' : 'rgba(254, 215, 170, 0.24)',
    width: 380,
    height: 380,
    top: '25%',
    right: '30%',
  },
  leftPanel: {
    width: 360,
    marginRight: 48,
    padding: 28,
    borderRadius: 24,
    backgroundColor: t.mode === 'dark' ? 'rgba(38, 45, 51, 0.45)' : 'rgba(255, 255, 255, 0.55)',
    borderColor: t.border,
    borderWidth: 1,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        boxShadow: t.mode === 'dark' 
          ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' 
          : '0 8px 32px 0 rgba(31, 38, 135, 0.08)',
      } as any,
      default: {},
    }),
    gap: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    color: t.textPrimary,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
  },
  brandSubtitle: {
    color: t.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: -2,
  },
  glassDivider: {
    height: 1,
    backgroundColor: t.border,
    marginVertical: 4,
  },
  widgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: t.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    borderColor: t.border,
    borderWidth: 0.5,
    gap: 12,
  },
  widgetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  widgetLabel: {
    color: t.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  widgetValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  widgetText: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  avatarBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '800',
  },
  voiceGuide: {
    gap: 6,
  },
  guideTitle: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  guideIntro: {
    color: t.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
  },
  guideExamples: {
    gap: 4,
    marginTop: 4,
  },
  guideExample: {
    color: t.mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.65)',
    fontSize: 11,
    fontStyle: 'italic',
  },
  phoneFrame: {
    width: 412,
    height: 840,
    borderRadius: 40,
    borderWidth: 10,
    borderColor: t.mode === 'dark' ? '#1C2228' : '#3E424B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: t.mode === 'dark' ? 0.6 : 0.28,
    shadowRadius: 36,
    elevation: 24,
    overflow: 'hidden',
  },
  phoneInnerContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
