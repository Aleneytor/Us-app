# Plan: Light Mode totalmente funcional

## 1. Análisis del estado actual

### Sistema de colores

Toda la app usa un único objeto estático `APP_COLORS` en `constants/colors.ts`:

```ts
export const APP_COLORS = {
  background:    '#0B1119',                  // fondo oscuro navy
  surface:       '#262D33',                  // superficie (cards, modales)
  border:        'rgba(255, 255, 255, 0.12)',
  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  textMuted:     'rgba(255, 255, 255, 0.48)',
  blue:          '#2563EB',
  green:         '#16A34A',
  red:           '#EC1147',
  income:        '#16A34A',
  expense:       '#EC1147',
};
```

Además hay colores hardcodeados en ficheros individuales:
- `'rgba(255, 255, 255, 0.08)'` — superficie suave (botones, inputs) → ~20 usos
- `'rgba(255, 255, 255, 0.12)'` — borde sutil → ~8 usos
- `SOFT_SURFACE = 'rgba(255, 255, 255, 0.08)'` en `TransactionModal`
- `ACTIVE_SURFACE = 'rgba(124, 58, 237, 0.18)'` en `TransactionModal`

### Problema estructural: `StyleSheet.create()` es estático

`StyleSheet.create()` se evalúa **una sola vez** al cargar el módulo. Los colores quedan baked-in. Para temas dinámicos hay dos opciones:

| Enfoque | Descripción | Impacto |
|---|---|---|
| **Inline styles** | Pasar colores como `style={{ backgroundColor: theme.background }}` | Simple pero verboso |
| **Factory de estilos** | `const styles = useMemo(() => makeStyles(theme), [theme])` | Limpio y testeable — **elegido** |

### Archivos que consumen `APP_COLORS` (scope completo)

**Pantallas (tabs)**
- `app/(tabs)/index.tsx`
- `app/(tabs)/movimientos.tsx`
- `app/(tabs)/ahorros.tsx`
- `app/(tabs)/ahorro.tsx`
- `app/(tabs)/categorias.tsx`
- `app/(tabs)/extras.tsx`

**Pantalla raíz**
- `app/perfil.tsx` ← aquí va el toggle

**Layout**
- `app/_layout.tsx` ← usa `DarkTheme` de React Navigation

**Componentes compartidos (alto impacto)**
- `components/ModalScreen.tsx` ← base de todos los modales
- `components/BalanceCard.tsx`
- `components/BudgetCategoryCard.tsx`
- `components/DonutChart.tsx`
- `components/EmojiPicker.tsx`
- `components/FinanceDetailModal.tsx`
- `components/FinanceTrendCard.tsx`
- `components/GoalCard.tsx`
- `components/GuidelineCard.tsx`
- `components/IconPicker.tsx`
- `components/MonthNavigator.tsx`
- `components/ProximoMovimientoCard.tsx`
- `components/SavingPlanPreviewCard.tsx`
- `components/SavingsCard.tsx`
- `components/SpendingGaugeCard.tsx`
- `components/TransactionDetailModal.tsx`
- `components/TransactionTile.tsx`
- `components/UserHeaderButton.tsx`
- `components/UserSwitcher.tsx`

**Modales**
- `modals/TransactionModal.tsx`
- `modals/BudgetCategoryModal.tsx`
- `modals/BudgetCategoryDetailModal.tsx`
- `modals/SavingPlanModal.tsx`
- `modals/SavingPlanDetailModal.tsx`
- `modals/GoalModal.tsx`
- `modals/ContributionModal.tsx`
- `modals/PlanModal.tsx`
- `modals/PlanDetailModal.tsx`
- `modals/PlanExpenseModal.tsx`
- `modals/PlanSettlementModal.tsx`

---

## 2. Paleta Light Mode

```ts
LIGHT_THEME = {
  background:    '#F2F2F7',   // gris iOS clarísimo
  surface:       '#FFFFFF',   // blanco puro para cards
  surfaceSecond: '#F8F8FA',   // superficie ligeramente elevada
  border:        'rgba(0, 0, 0, 0.10)',
  softSurface:   'rgba(0, 0, 0, 0.05)',  // reemplaza rgba(255,255,255,0.08)
  textPrimary:   '#0F172A',   // casi negro
  textSecondary: 'rgba(15, 23, 42, 0.65)',
  textMuted:     'rgba(15, 23, 42, 0.40)',
  blue:          '#2563EB',   // igual que dark
  green:         '#16A34A',   // igual que dark
  red:           '#EC1147',   // igual que dark
  income:        '#16A34A',
  expense:       '#EC1147',
  // ---- extras para UI específica
  navBg:         '#FFFFFF',   // fondo de tab bar
  navBorder:     'rgba(0,0,0,0.08)',
  inputBg:       '#F0F0F5',
  shadowColor:   '#A0A0A0',
}

DARK_THEME = {
  background:    '#0B1119',
  surface:       '#262D33',
  surfaceSecond: '#1C2228',
  border:        'rgba(255, 255, 255, 0.12)',
  softSurface:   'rgba(255, 255, 255, 0.08)',
  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  textMuted:     'rgba(255, 255, 255, 0.48)',
  blue:          '#2563EB',
  green:         '#16A34A',
  red:           '#EC1147',
  income:        '#16A34A',
  expense:       '#EC1147',
  navBg:         '#151C23',
  navBorder:     'rgba(255,255,255,0.08)',
  inputBg:       'rgba(255,255,255,0.06)',
  shadowColor:   '#7E7E7E',
}
```

> Los colores de acento (verde/rojo/azul/morado) **no cambian** entre modos — son identitarios.
> La UI del hero (gradiente de la pantalla principal) tampoco cambia — es una pieza visual independiente del tema.

---

## 3. Arquitectura propuesta

### 3.1 Nuevo type + dos paletas en `constants/colors.ts`

```ts
export type ThemeMode = 'dark' | 'light';

export interface AppTheme {
  mode: ThemeMode;
  background: string;
  surface: string;
  surfaceSecond: string;
  border: string;
  softSurface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  blue: string;
  green: string;
  red: string;
  income: string;
  expense: string;
  navBg: string;
  navBorder: string;
  inputBg: string;
  shadowColor: string;
}

export const DARK_THEME: AppTheme = { mode: 'dark', ...dark values };
export const LIGHT_THEME: AppTheme = { mode: 'light', ...light values };

// Backwards-compat: exportar APP_COLORS como alias del dark theme
// (se elimina progresivamente durante la migración)
export const APP_COLORS = DARK_THEME;
```

### 3.2 ThemeContext en `contexts/ThemeContext.tsx`

```tsx
const ThemeContext = createContext<AppTheme>(DARK_THEME);
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themeMode === 'light' ? LIGHT_THEME : DARK_THEME;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
```

### 3.3 Estado en `useAppStore.ts`

Agregar al store:
```ts
themeMode: ThemeMode;           // 'dark' (default)
setThemeMode: (m: ThemeMode) => Promise<void>;
```

Persistido en `AsyncStorage` con clave `'nosotros_theme'`.

Inicializado en `initialize()` leyendo del storage.

### 3.4 Actualizar `app/_layout.tsx`

```tsx
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';

function AppNavigator() {
  const theme = useTheme();
  const navTheme = theme.mode === 'light'
    ? { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.background, card: theme.surface, text: theme.textPrimary, border: theme.border } }
    : { ...DarkTheme,    colors: { ...DarkTheme.colors,    background: theme.background, card: theme.surface, text: theme.textPrimary, border: theme.border } };

  return (
    <NavigationThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="perfil" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  // ...fonts, appstate...
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

### 3.5 Patrón de migración por componente

Cada archivo sigue el mismo patrón:

```tsx
// ANTES
import { APP_COLORS } from '../constants/colors';
// estilos estáticos
const styles = StyleSheet.create({
  screen: { backgroundColor: APP_COLORS.background },
  title:  { color: APP_COLORS.textPrimary },
});

// DESPUÉS
import { useTheme } from '../contexts/ThemeContext';
// factory fuera del componente
const makeStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { backgroundColor: theme.background },
  title:  { color: theme.textPrimary },
});
// dentro del componente
const theme  = useTheme();
const styles = useMemo(() => makeStyles(theme), [theme]);
```

Para componentes muy simples con 1–2 propiedades de color, se puede usar inline:
```tsx
<View style={{ backgroundColor: theme.surface }}>
```

---

## 4. Toggle en pantalla de perfil (`app/perfil.tsx`)

En la sección **Preferencias**, agregar una nueva fila tipo switch:

```
┌──────────────────────────────────────────────────────┐
│  ☀️  Modo claro                              [ ○●  ] │
└──────────────────────────────────────────────────────┘
```

Implementación:
```tsx
import { Switch } from 'react-native';
const themeMode    = useAppStore((s) => s.themeMode);
const setThemeMode = useAppStore((s) => s.setThemeMode);

<View style={styles.themeTile}>
  <Ionicons name={themeMode === 'light' ? 'sunny' : 'moon'} size={22} color={theme.textSecondary} />
  <Text style={styles.themeLabel}>
    {themeMode === 'light' ? 'Modo claro' : 'Modo oscuro'}
  </Text>
  <Switch
    value={themeMode === 'light'}
    onValueChange={(v) => setThemeMode(v ? 'light' : 'dark')}
    trackColor={{ false: theme.softSurface, true: '#7C3AED' }}
    thumbColor="#FFFFFF"
  />
</View>
```

---

## 5. Plan de implementación (fases)

### Fase 1 — Fundamentos (sin romper nada)
1. Expandir `constants/colors.ts`: tipos + `DARK_THEME` + `LIGHT_THEME` + mantener `APP_COLORS = DARK_THEME`
2. Agregar `themeMode` / `setThemeMode` al store con persistencia en AsyncStorage
3. Crear `contexts/ThemeContext.tsx` con `useTheme` hook
4. Envolver la app en `ThemeProvider` dentro de `app/_layout.tsx`
5. Actualizar `app/_layout.tsx` para servir el `navTheme` correcto a React Navigation
6. Verificar que la app sigue funcionando idéntica (todo en dark por defecto)

### Fase 2 — Componentes base (mayor impacto por reutilización)
7. `components/ModalScreen.tsx` — base de todos los modales de criación/edición
8. `components/TransactionTile.tsx` — aparece en todas las pantallas
9. `components/BalanceCard.tsx`
10. `app/(tabs)/_layout.tsx` — tab bar (colores de fondo, borde, iconos activos/inactivos)
11. `components/MonthNavigator.tsx`

### Fase 3 — Pantalla de perfil + toggle
12. `app/perfil.tsx` — migrar a `makeStyles(theme)` y agregar el toggle de tema

### Fase 4 — Modales (usar ModalScreen ya migrado como base)
13. `modals/TransactionModal.tsx` (más complejo: eliminar `SOFT_SURFACE` hardcodeado → `theme.softSurface`)
14. `modals/BudgetCategoryModal.tsx`
15. `modals/SavingPlanModal.tsx` y `SavingPlanDetailModal.tsx`
16. `modals/GoalModal.tsx` y `ContributionModal.tsx`
17. `modals/PlanModal.tsx`, `PlanDetailModal.tsx`, `PlanExpenseModal.tsx`, `PlanSettlementModal.tsx`
18. `modals/BudgetCategoryDetailModal.tsx`

### Fase 5 — Pantallas principales
19. `app/(tabs)/index.tsx` (dashboard)
20. `app/(tabs)/movimientos.tsx`
21. `app/(tabs)/ahorros.tsx`
22. `app/(tabs)/ahorro.tsx`
23. `app/(tabs)/categorias.tsx`
24. `app/(tabs)/extras.tsx`

### Fase 6 — Componentes restantes
25. `components/FinanceTrendCard.tsx`
26. `components/DonutChart.tsx`
27. `components/BudgetCategoryCard.tsx`
28. `components/FinanceDetailModal.tsx`
29. `components/TransactionDetailModal.tsx`
30. `components/GoalCard.tsx`
31. `components/SavingsCard.tsx`
32. `components/SpendingGaugeCard.tsx`
33. `components/UserHeaderButton.tsx`
34. `components/UserSwitcher.tsx`
35. `components/IconPicker.tsx`
36. `components/EmojiPicker.tsx`
37. `components/GuidelineCard.tsx`
38. `components/SavingPlanPreviewCard.tsx`
39. `components/ProximoMovimientoCard.tsx`

### Fase 7 — Limpieza
40. Eliminar la exportación `APP_COLORS` de `constants/colors.ts` (reemplazar usos restantes)
41. Verificar que no queda ningún `rgba(255, 255, 255, 0.08)` hardcodeado
42. Verificar que no queda ningún `rgba(255, 255, 255, 0.12)` hardcodeado
43. Verificar que los StatusBar icons cambian con el tema (`light-content` / `dark-content`)

---

## 6. Casos especiales a considerar

### Hero gradient (pantalla principal)
El gradiente animado verde/rojo del header principal **no debe cambiar** con el tema — es una pieza visual identitaria. En light mode el gradiente queda igual de vivo, solo cambia el fondo de las secciones inferiores.

### Tab bar
En `app/(tabs)/_layout.tsx` hay configuración de `tabBarStyle` con colores hardcodeados. Migrar a `theme.navBg` / `theme.navBorder`.

### Iconos activos/inactivos
El color del icono activo (`tabBarActiveTintColor`) puede ser `'#7C3AED'` en ambos modos (purple funciona en ambos). El inactivo: `theme.textMuted`.

### React Navigation header
Ya se maneja mediante el `navTheme` en `_layout.tsx`. Al actualizarlo se propaga automáticamente a headers que estén visibles.

### `ActivityIndicator` y `RefreshControl`
Necesitan `color={theme.textPrimary}` para que sean visibles en ambos modos.

### Sombras
`shadowColor` en dark es `'#7E7E7E'`; en light es `'#A0A0A0'` con mayor `shadowOpacity`. Añadir a `AppTheme`.

### `ACTIVE_SURFACE` en TransactionModal
```ts
const ACTIVE_SURFACE = 'rgba(124, 58, 237, 0.18)';
// Se mantiene igual — el morado funciona en ambos modos
```

### Inputs de texto
En dark: fondo `rgba(255,255,255,0.06)` → en light: `theme.inputBg = '#F0F0F5'`.

### `DevIconWrap` (pantalla perfil)
```ts
backgroundColor: '#FEF3C7'  // amarillo claro
// Funciona en ambos modos, no necesita cambio
```

---

## 7. Checklist de validación

- [ ] Toggle en pantalla de perfil funciona y persiste entre sesiones
- [ ] Al cambiar de tema, **todas** las pantallas cambian instantáneamente (sin restart)
- [ ] Modal de transacción: fondo, inputs, selectors de categoría, calendario
- [ ] Modal de plan de ahorro: header, cuerpo, footer
- [ ] Modal de goal + contribución
- [ ] Modal de presupuesto
- [ ] Tab bar visible con iconos legibles en light mode
- [ ] Dashboard: cards de balance/gasto, sección de categorías, movimientos recientes
- [ ] Pantalla de movimientos: lista, filtros por mes
- [ ] Pantalla de ahorros: lista, barra de progreso
- [ ] Pantalla de categorías: cards con presupuesto
- [ ] Pantalla de perfil: todos los tiles, formulario de nuevo usuario
- [ ] El gradiente hero permanece igual en ambos modos
- [ ] StatusBar `barStyle` es `'dark-content'` en light y `'light-content'` en dark
- [ ] Preferencia persiste tras cerrar y reabrir la app
- [ ] El partner (segundo usuario) ve el mismo tema en su dispositivo (tema es local, no sincronizado — eso es correcto)

---

## 8. Notas de implementación

### Por qué no usar `useColorScheme()` del sistema
La app tiene su propio toggle manual, por lo que el tema del sistema se ignora intencionalmente. Si en el futuro se quiere añadir "seguir sistema", basta con leer `useColorScheme()` cuando `themeMode === 'system'` (extensible sin romper nada).

### Orden de prioridad si se hace incremental
Si se quiere lanzar en fases, el orden mínimo viable para que el toggle sea "funcional" aunque no perfecto es:
1. Fase 1 completa (fundamentos)
2. `ModalScreen.tsx` (Fase 2, paso 7)
3. `app/perfil.tsx` (Fase 3)
4. `app/(tabs)/_layout.tsx` (tab bar)

Con eso el toggle existe, persiste y aplica color en la mayoría de las pantallas que el usuario ve primero. El resto se completa iterativamente.

### Consistencia de `makeStyles`
Para garantizar consistencia en el naming, usar siempre:
```ts
const makeStyles = (t: AppTheme) => StyleSheet.create({ ... });
// y dentro del componente:
const theme  = useTheme();
const styles = useMemo(() => makeStyles(theme), [theme]);
```

Evitar mezclar `t` y `theme` como nombre del parámetro — elegir uno solo en todo el proyecto.
