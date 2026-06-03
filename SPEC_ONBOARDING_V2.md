# Spec: Nuevo Sistema de Onboarding — Nosotros

## Contexto del Proyecto

**Stack**: React Native + Expo 54, `expo-router` (file-based routing), Zustand (`useAppStore`), AsyncStorage, StyleSheet-only (no Tailwind/NativeWind).

**Arquitectura de archivos clave:**
- `app/_layout.tsx` — RootLayout: monta `SafeAreaProvider → ThemeProvider → ResponsiveWebShell → AppNavigator`. Llama a `initialize()` (carga AsyncStorage → conecta Supabase).
- `app/(tabs)/_layout.tsx` — TabLayout: FAB flotante con voz, FloatingTabBar, modales de creación (Transacción, Categoría, Ahorro, Plan).
- `app/(tabs)/index.tsx` — DashboardScreen: BalanceCard + swipe, quickActions, tendencia, categories pager, movimientos recientes.
- `store/useAppStore.ts` — Zustand store único. `payload.expenses`, `payload.budgetCategories`, `payload.savings`, `payload.plans` son los arrays de datos.
- `contexts/ThemeContext.tsx` — `useTheme()` devuelve `AppTheme` con tokens: `theme.background`, `theme.surface`, `theme.textPrimary`, `theme.textSecondary`, `theme.textMuted`, `theme.border`, `theme.green`, `theme.red`, `theme.blue`.
- `constants/colors.ts` — Define `AppTheme`, `DARK_THEME`, `LIGHT_THEME`, `ICON_COLORS`.

**Usuarios pre-definidos** (hardcoded en `types/index.ts`):
```ts
export const USERS = {
  demo_a: { name: 'Demo', initials: 'DM', color: '#7C3AED', bg: '#EDE9FE' },
  demo_b: { name: 'Pareja Demo', initials: 'PD', color: '#E11D48', bg: '#FFE4E6' },
  alan:   { name: 'Alan', initials: 'AL', color: '#4F46E5', bg: '#E0E7FF', photo: ... },
  gabi:   { name: 'Gabi', initials: 'GA', color: '#DB2777', bg: '#FCE7F3', photo: ... },
};
```
`initialize()` carga el usuario desde `AsyncStorage.getItem('nosotros_user')`. Si no hay nada, usa `Object.keys(users)[0]` (= `demo_a`).

**Routing**: La ruta `/onboarding` ya está registrada en `app/_layout.tsx` línea 60:
```tsx
<Stack.Screen name="onboarding" options={{ animation: 'slide_from_bottom' }} />
```
El directorio `app/onboarding/` fue eliminado — hay que recrearlo.

---

## Diseño UX — Fundamentos

### Por qué el tutorial overlay fue eliminado

El sistema anterior usaba un overlay de blur por secciones que creaba "cajas negras" visibles en los bordes, interrumpía el flujo natural del usuario, y necesitaba conocer la estructura interna de cada pantalla. Era frágil y confuso.

### Patrón elegido: "Getting Started + Contextual Hints"

Basado en cómo lo hacen Notion, Linear, Mailchimp:
1. **Primera apertura**: pantalla de bienvenida minimalista (0 formularios, solo orientación).
2. **Lista de tareas en home**: card "Primeros pasos" que muestra qué falta hacer — basada en datos reales del store, no en estado artificial.
3. **Hint contextual del FAB**: único tooltip que aparece la primera vez que el usuario ve el FAB, enseñando el long-press para voz.

---

## AsyncStorage Keys

```ts
const ONBOARDING_DONE_KEY   = 'nosotros_onboarding_done';   // '1' cuando onboarding completado
const GETTING_STARTED_KEY   = 'nosotros_getting_started_dismissed'; // '1' cuando usuario la cierra
const HINT_VOICE_KEY        = 'nosotros_hint_voice_seen';   // '1' cuando tooltip FAB se mostró
```

---

## Archivos a Crear

### 1. `app/onboarding/index.tsx` (nuevo)

Pantalla de bienvenida. Se muestra una sola vez. Sin formularios.

```tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { AppTheme } from '../../constants/colors';

const ONBOARDING_DONE_KEY = 'nosotros_onboarding_done';

const FEATURES = [
  { icon: 'wallet-outline' as const, title: 'Balance compartido', desc: 'Ve tus ingresos y gastos en tiempo real.' },
  { icon: 'pie-chart-outline' as const, title: 'Presupuestos', desc: 'Crea categorías con límite mensual.' },
  { icon: 'trending-up-outline' as const, title: 'Ahorra juntos', desc: 'Define metas y sigue tu progreso.' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in on mount
  Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

  const handleStart = async () => {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1');
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Logo / Hero */}
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Ionicons name="heart" size={36} color="#EC1147" />
          </View>
          <Text style={styles.appName}>Nosotros</Text>
          <Text style={styles.tagline}>Finanzas en pareja, sin complicaciones</Text>
        </View>

        {/* Feature list */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.icon} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon} size={22} color={theme.green} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={handleStart}
        >
          <Text style={styles.ctaText}>Empezar</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: 12,
  },
  logoWrap: {
    alignItems: 'center',
    backgroundColor: '#FFF0F3',
    borderRadius: 24,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  appName: {
    color: t.textPrimary,
    fontSize: 34,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.5,
  },
  tagline: {
    color: t.textSecondary,
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },
  features: {
    gap: 20,
    paddingVertical: 32,
  },
  featureRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
  },
  featureIconWrap: {
    alignItems: 'center',
    backgroundColor: t.softSurface,
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    color: t.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  featureDesc: {
    color: t.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    alignItems: 'center',
    backgroundColor: '#EC1147',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    height: 56,
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Poppins_600SemiBold',
  },
});
```

---

### 2. `components/GettingStartedCard.tsx` (nuevo)

Card "Primeros pasos" para la home screen. Se auto-calcula desde el store, se puede cerrar.

```tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAppStore } from '../store/useAppStore';
import type { AppTheme } from '../constants/colors';

const GETTING_STARTED_KEY = 'nosotros_getting_started_dismissed';

interface Task {
  id: string;
  label: string;
  done: boolean;
  hint: string;    // short instruction if not done
}

export function GettingStartedCard() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [dismissed, setDismissed] = useState<boolean | null>(null); // null = loading
  const [celebrateAnim] = useState(new Animated.Value(0));

  const payload = useAppStore((s) => s.payload);
  const currentUser = useAppStore((s) => s.currentUser);

  useEffect(() => {
    AsyncStorage.getItem(GETTING_STARTED_KEY).then((v) => setDismissed(v === '1'));
  }, []);

  const tasks: Task[] = useMemo(() => {
    const expenses = payload.expenses ?? [];
    const categories = payload.budgetCategories ?? [];
    const savings = payload.savings ?? [];

    return [
      {
        id: 'first_expense',
        label: 'Registra tu primer movimiento',
        done: expenses.some((e) => e.uid === currentUser),
        hint: 'Pulsa el botón + para añadir',
      },
      {
        id: 'first_category',
        label: 'Crea una categoría de presupuesto',
        done: categories.length > 0,
        hint: 'En Categorías → Crear categoría',
      },
      {
        id: 'first_saving',
        label: 'Crea tu primera meta de ahorro',
        done: savings.length > 0,
        hint: 'En Extras → Ahorros',
      },
    ];
  }, [payload, currentUser]);

  const allDone = tasks.every((t) => t.done);
  const doneCount = tasks.filter((t) => t.done).length;

  // When all tasks complete, celebrate then auto-dismiss after 2.5s
  useEffect(() => {
    if (!allDone || dismissed) return;
    Animated.timing(celebrateAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const timer = setTimeout(() => handleDismiss(), 2500);
    return () => clearTimeout(timer);
  }, [allDone]);

  const handleDismiss = () => {
    void AsyncStorage.setItem(GETTING_STARTED_KEY, '1');
    setDismissed(true);
  };

  // Not ready (loading) or dismissed — render nothing
  if (dismissed !== false) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {allDone ? (
            <Text style={styles.title}>🎉 ¡Todo listo!</Text>
          ) : (
            <>
              <Text style={styles.title}>Primeros pasos</Text>
              <Text style={styles.progress}>{doneCount}/{tasks.length}</Text>
            </>
          )}
        </View>
        <Pressable onPress={handleDismiss} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={theme.textMuted} />
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(doneCount / tasks.length) * 100}%` as any }]} />
      </View>

      {/* Task list */}
      {tasks.map((task) => (
        <View key={task.id} style={styles.taskRow}>
          <View style={[styles.taskCheck, task.done && styles.taskCheckDone]}>
            {task.done && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
          </View>
          <View style={styles.taskContent}>
            <Text style={[styles.taskLabel, task.done && styles.taskLabelDone]}>
              {task.label}
            </Text>
            {!task.done && <Text style={styles.taskHint}>{task.hint}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  card: {
    backgroundColor: t.surface,
    borderColor: t.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  title: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  progress: {
    backgroundColor: t.softSurface,
    borderRadius: 99,
    color: t.textMuted,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  closeBtn: {
    padding: 4,
  },
  progressBar: {
    backgroundColor: t.softSurface,
    borderRadius: 99,
    height: 4,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: t.green,
    borderRadius: 99,
    height: '100%',
  },
  taskRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  taskCheck: {
    alignItems: 'center',
    borderColor: t.border,
    borderRadius: 99,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    marginTop: 1,
    width: 20,
  },
  taskCheckDone: {
    backgroundColor: t.green,
    borderColor: t.green,
  },
  taskContent: {
    flex: 1,
    gap: 2,
  },
  taskLabel: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  taskLabelDone: {
    color: t.textMuted,
    textDecorationLine: 'line-through',
  },
  taskHint: {
    color: t.textMuted,
    fontSize: 12,
  },
});
```

---

### 3. `hooks/useOnboardingState.ts` (nuevo)

Hook compartido para leer/escribir el estado de onboarding.

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const ONBOARDING_DONE_KEY = 'nosotros_onboarding_done';
const HINT_VOICE_KEY      = 'nosotros_hint_voice_seen';

export function useOnboardingDone() {
  const [done, setDone] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_DONE_KEY).then((v) => setDone(v === '1'));
  }, []);
  return done;
}

export function useVoiceHintSeen() {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(HINT_VOICE_KEY).then((v) => setSeen(v === '1'));
  }, []);
  const markSeen = () => {
    setSeen(true);
    void AsyncStorage.setItem(HINT_VOICE_KEY, '1');
  };
  return { seen, markSeen };
}
```

---

## Archivos a Modificar

### 4. `app/_layout.tsx` — Agregar redirect al onboarding

**Qué hacer**: En `RootLayout`, después de que `initialize()` se resuelva, verificar si el usuario ya hizo onboarding. Si no, navegar a `/onboarding`.

**Dónde**: En el `useEffect` existente (líneas 276-288), al final del callback asíncrono. Hay que importar `useRouter` de `expo-router`.

**Cambio actual (líneas 276-288):**
```tsx
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
```

**Cambio propuesto** — extraer a función async y añadir check:
```tsx
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Dentro de RootLayout():
const router = useRouter();

useEffect(() => {
  const boot = async () => {
    await initialize();
    void requestNotificationPermissions();
    const done = await AsyncStorage.getItem('nosotros_onboarding_done');
    if (done !== '1') {
      router.replace('/onboarding');
    }
  };
  void boot();

  const sub = AppState.addEventListener('change', (nextState) => {
    if (appState.current !== 'active' && nextState === 'active') {
      void foregroundRefresh();
    }
    appState.current = nextState;
  });

  return () => sub.remove();
}, []);
```

> **IMPORTANTE**: `useRouter()` solo funciona dentro de componentes que están dentro del árbol de expo-router. `RootLayout` ya es el componente raíz del Stack, por lo que `useRouter()` aquí es válido. Sin embargo, si hay error de hooks, mover el check a un componente hijo que se monte después de `<Stack>`. Ver nota abajo.

> **Alternativa robusta**: Si `useRouter()` en RootLayout da problemas, crear un componente `<BootRedirect />` y montarlo dentro de `AppNavigator` con `<Stack>`:
> ```tsx
> function BootRedirect() {
>   const router = useRouter();
>   useEffect(() => {
>     AsyncStorage.getItem('nosotros_onboarding_done').then((v) => {
>       if (v !== '1') router.replace('/onboarding');
>     });
>   }, []);
>   return null;
> }
> // En AppNavigator, antes del cierre de </Stack>:
> <BootRedirect />
> ```

---

### 5. `app/(tabs)/index.tsx` — Agregar GettingStartedCard

**Qué hacer**: Renderizar `<GettingStartedCard />` como primer elemento después del heroSection (la tarjeta verde de balance).

**Localización actual del ScrollView content**: La home screen tiene un `ScrollView` con `ref={screenScrollRef}`. Dentro hay un `View style={styles.heroSection}` con la BalanceCard, y luego `quickActions`, `tendencia`, `Categorías pager`, `Movimientos recientes`.

**Cambio**: Agregar `<GettingStartedCard />` después del hero y antes de quickActions.

```tsx
// Import al inicio del archivo:
import { GettingStartedCard } from '../../components/GettingStartedCard';

// En el JSX, dentro del ScrollView, después de </View> del heroSection:
<GettingStartedCard />

// Continúa con quickActions...
```

**Cómo encontrar el lugar correcto**: Buscar en `app/(tabs)/index.tsx` el bloque que contiene `<BalanceCard`. Justo después del `</Animated.View>` o `</View>` que cierra ese bloque hero, agregar `<GettingStartedCard />`.

---

### 6. `app/(tabs)/_layout.tsx` — Agregar hint FAB voice

**Qué hacer**: Mostrar una burbuja de texto la primera vez que el usuario ve el FAB. Desaparece en 6 segundos o cuando el usuario interactúa con el FAB.

**Localización**: En `TabLayout()`, después del bloque `<Animated.View ... style={[styles.floatingFabShadow, styles.standalonefab, ...]}>` que contiene el `TouchableOpacity` del FAB.

**Imports a agregar** al inicio del archivo:
```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
```

**Estado a agregar** dentro de `TabLayout()`:
```tsx
const [showVoiceHint, setShowVoiceHint] = useState(false);
const voiceHintAnim = useRef(new Animated.Value(0)).current;
```

**useEffect a agregar** dentro de `TabLayout()`:
```tsx
useEffect(() => {
  AsyncStorage.getItem('nosotros_hint_voice_seen').then((v) => {
    if (v !== '1') {
      // Mostrar después de 1.5s para que el usuario vea el FAB primero
      const showTimer = setTimeout(() => {
        setShowVoiceHint(true);
        Animated.spring(voiceHintAnim, {
          toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220,
        }).start();
      }, 1500);
      // Auto-ocultar a los 6s
      const hideTimer = setTimeout(() => dismissVoiceHint(), 7500);
      return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
    }
  });
}, []);
```

**Función dismissVoiceHint a agregar**:
```tsx
const dismissVoiceHint = () => {
  Animated.timing(voiceHintAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
    setShowVoiceHint(false);
  });
  void AsyncStorage.setItem('nosotros_hint_voice_seen', '1');
};
```

**Modificar `handleCreatePress` y `startVoiceAction`** para ocultar el hint al interactuar:
```tsx
const handleCreatePress = () => {
  dismissVoiceHint(); // añadir esta línea al inicio
  // ... resto del código existente
};

const startVoiceAction = async () => {
  dismissVoiceHint(); // añadir esta línea al inicio
  // ... resto del código existente
};
```

**JSX del hint** — colocar JUSTO ANTES del `</>`  final del return de `TabLayout`, después del bloque de modales:
```tsx
{showVoiceHint && (
  <Animated.View
    pointerEvents="none"
    style={[
      styles.voiceHintBubble,
      {
        bottom: fabBottom + fabSize + 12,
        right: 14,
        opacity: voiceHintAnim,
        transform: [{ scale: voiceHintAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
      },
    ]}
  >
    <View style={styles.voiceHintInner}>
      <Ionicons name="mic-outline" size={14} color="#7C3AED" />
      <Text style={styles.voiceHintText}>Mantén pulsado para crear con voz</Text>
    </View>
    <View style={styles.voiceHintArrow} />
  </Animated.View>
)}
```

**Estilos a agregar** en `makeStyles(t: AppTheme)`:
```tsx
voiceHintBubble: {
  position: 'absolute',
  right: 14,
  alignItems: 'flex-end',
},
voiceHintInner: {
  alignItems: 'center',
  backgroundColor: t.surface,
  borderColor: t.border,
  borderRadius: 12,
  borderWidth: 1,
  elevation: 8,
  flexDirection: 'row',
  gap: 6,
  paddingHorizontal: 12,
  paddingVertical: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.14,
  shadowRadius: 12,
},
voiceHintText: {
  color: t.textPrimary,
  fontSize: 13,
  fontWeight: '600',
},
voiceHintArrow: {
  borderLeftColor: 'transparent',
  borderLeftWidth: 7,
  borderRightColor: 'transparent',
  borderRightWidth: 7,
  borderTopColor: t.border,
  borderTopWidth: 7,
  marginRight: 20,
},
```

---

## Orden de Implementación

1. Crear `app/onboarding/index.tsx` (pantalla de bienvenida)
2. Crear `components/GettingStartedCard.tsx`
3. Crear `hooks/useOnboardingState.ts`
4. Modificar `app/_layout.tsx` (redirect check)
5. Modificar `app/(tabs)/index.tsx` (añadir GettingStartedCard)
6. Modificar `app/(tabs)/_layout.tsx` (voice hint)
7. Correr `npx tsc --noEmit` para verificar tipos

---

## Puntos de Atención

- **`fontFamily`**: Usar solo `'Poppins_700Bold'`, `'Poppins_600SemiBold'`, `'Poppins_400Regular'` — son las únicas cargadas en `app/_layout.tsx`. Para `fontWeight` sin font personalizada, usar strings (`'700'`, `'600'`, etc.).
- **No usar hooks en condicionales**: `GettingStartedCard` retorna `null` DESPUÉS de haber ejecutado todos los hooks si `dismissed !== false`, no antes.
- **`StyleSheet.create` con theme**: Todos los componentes nuevos siguen el patrón `const styles = useMemo(() => makeStyles(theme), [theme])`.
- **No hay `gap` en StyleSheet en React Native < 0.71**: Este proyecto usa Expo 54 (RN ~0.76) así que `gap` está soportado.
- **`expo-router` redirect**: Usar `router.replace()` (no `router.push()`) para el redirect de onboarding, así el usuario no puede volver atrás con el botón de retroceso.
- **`pointerEvents="none"` en el hint**: El hint del FAB usa `pointerEvents="none"` en su Animated.View para no bloquear toques al FAB.
- **AsyncStorage is async**: El `dismissed !== false` check en `GettingStartedCard` es `null` (loading) inicialmente. Retornar `null` en ese caso evita un flash del card que desaparece.

---

## Estructura de Archivos Final

```
app/
  onboarding/
    index.tsx          ← NUEVO: pantalla de bienvenida
  (tabs)/
    _layout.tsx        ← MODIFICADO: voice hint
    index.tsx          ← MODIFICADO: GettingStartedCard
  _layout.tsx          ← MODIFICADO: boot redirect
components/
  GettingStartedCard.tsx  ← NUEVO
hooks/
  useOnboardingState.ts   ← NUEVO (opcional, el hook puede ir inline)
```
