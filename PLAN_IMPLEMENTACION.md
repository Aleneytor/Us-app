# Plan de Implementación — Rediseño UI/UX "nosotros"

> Fecha: 2026-05-05  
> Objetivo: Transformar la app actual en el prototipo de la imagen de referencia, conservando toda la lógica de datos existente.

---

## Vista General de Cambios

La app pasa de un hero carousel con 3 slides a una pantalla estructurada con:
1. **Header fijo** — saludo + subtítulo dinámico (cambia según el estado del card)
2. **BalanceCard deslizable verticalmente** — 3 estados que ciclan con swipe up/down:
   - Estado 0 (verde): Saldo Actual confirmado + Saldo proyectado fin de mes
   - Estado 1 (rojo): Gastos confirmados hasta hoy + Gastos totales a fin de mes
   - Estado 2 (verde oscuro): Ingresos confirmados hasta hoy + Ingresos totales a fin de mes
   - El botón derecho (verde/rojo según estado) abre el **FinanceDetailModal** con lista detallada
3. **Próximos Movimientos** — sección colapsable con tarjetas horizontales de pagos próximos
4. **Movimientos Recientes** — lista con swipe gestures (izquierda = confirmar, derecha = editar)
5. **Navegación inferior** — 5 tabs: Home, Recurrentes (movimientos), FAB central (+), Deseos, Perfil

El sistema `paid` existente (`paid?: Record<string, boolean>`) ya cubre el concepto de **Confirmado/Pendiente** — no se toca la estructura de datos core.

---

## Mapa Completo de Archivos

```
MODIFICAR:
  types/index.ts                       → Agregar CurrencyCode + CURRENCIES
  utils/format.ts                      → fmt() currency-aware + splitAmount helper
  utils/calculations.ts                → calcSaldoActual + calcSaldoProyectado
                                         + calcGastosActual + calcGastosProyectados
                                         + calcIngresosActual + calcIngresosProyectados
                                         + getProximosMovimientos
  store/useAppStore.ts                 → currency state + setCurrency + confirmTransaction
  app/(tabs)/index.tsx                 → Rediseño completo (pantalla principal)
  app/(tabs)/_layout.tsx               → 5 tabs + FAB central + modal de creación global
  components/TransactionTile.tsx       → Swipe gestures + currency-aware + layout refinado

CREAR:
  components/BalanceCard.tsx           → Card deslizable vertical (3 estados + PanResponder)
  components/FinanceDetailModal.tsx    → Popup de detalle de ingresos/gastos con búsqueda
  components/ProximoMovimientoCard.tsx → Tarjeta de próximo movimiento
  app/(tabs)/perfil.tsx                → Pantalla de perfil y configuración
  services/notifications.ts           → Notificaciones push de pagos próximos

INSTALAR:
  expo-notifications                   → Notificaciones locales programadas
  react-native-gesture-handler        → (ya incluido en Expo 54, verificar setup)
```

---

## Dependencias a Instalar `[ ]`

**Checklist:**
- [ ] Ejecutar `npx expo install expo-notifications`
- [x] Verificar que `react-native-gesture-handler` esté disponible (viene con Expo 54)
- [ ] Si el swipe no funciona, ejecutar `npx expo install react-native-gesture-handler` y envolver root layout en `<GestureHandlerRootView>`

```bash
npx expo install expo-notifications
```

`react-native-gesture-handler` ya viene con Expo SDK 54 como dependencia de `expo-router`. Si el swipe no funciona, ejecutar:
```bash
npx expo install react-native-gesture-handler
```
Y envolver el root layout en `<GestureHandlerRootView style={{ flex: 1 }}>` dentro de `app/_layout.tsx`.

---

## FASE 1 — Fundación: Tipos, Formato y Cálculos `[x]`

> Sin cambios visuales. Establece la base de datos que las fases siguientes consumen.

**Checklist:**
- [x] 1.1 `types/index.ts` — agregar `CurrencyCode` + `CurrencyConfig` + `CURRENCIES`
- [x] 1.2 `utils/format.ts` — actualizar `fmt()` con parámetro `currency` + agregar `splitAmount()`
- [x] 1.3 `utils/calculations.ts` — agregar `calcSaldoActual()` + `calcSaldoProyectado()` + `getProximosMovimientos()`
- [x] 1.4 `store/useAppStore.ts` — agregar `currency` state, `setCurrency`, `confirmTransaction`, cargar currency en `initialize()`

---

### 1.1 `types/index.ts`

**Agregar al final del archivo**, antes de la última línea:

```typescript
// ─── Currency ─────────────────────────────────────────────────────────────────

export type CurrencyCode = 'EUR' | 'USD' | 'BS' | 'COP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  label: string;
  locale: string;  // locale para toLocaleString
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  EUR: { code: 'EUR', symbol: '€',   label: 'Euro (€)',            locale: 'es-ES' },
  USD: { code: 'USD', symbol: '$',   label: 'Dólar ($)',            locale: 'en-US' },
  BS:  { code: 'BS',  symbol: 'Bs.', label: 'Bolívar (Bs.)',        locale: 'es-VE' },
  COP: { code: 'COP', symbol: '$',   label: 'Peso Colombiano ($)',  locale: 'es-CO' },
};
```

---

### 1.2 `utils/format.ts`

**Cambios:**

1. Agregar import al inicio del archivo:
```typescript
import type { CurrencyCode } from '../types';
import { CURRENCIES } from '../types';
```

2. Reemplazar la función `fmt()` existente (línea 34-41):
```typescript
export function fmt(n: number, currency: CurrencyCode = 'EUR'): string {
  const cfg = CURRENCIES[currency];
  const formatted = Math.abs(n).toLocaleString(cfg.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${cfg.symbol}`;
}
```

3. Agregar helper `splitAmount()` para separar enteros y decimales (usado en BalanceCard):
```typescript
export function splitAmount(n: number, currency: CurrencyCode = 'EUR'): {
  sign: string; whole: string; decimals: string; symbol: string;
} {
  const cfg = CURRENCIES[currency];
  const sign = n < 0 ? '-' : '';
  const separator = ['es-ES', 'es-VE', 'es-CO'].includes(cfg.locale) ? ',' : '.';
  const [whole, decimals = '00'] = Math.abs(n)
    .toLocaleString(cfg.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(separator);
  return { sign, whole, decimals, symbol: cfg.symbol };
}
```

---

### 1.3 `utils/calculations.ts`

**Agregar imports que faltan** al inicio:
```typescript
import type { Transaction } from '../types';
import { getPaid } from './filters';
import { todayStr } from './format';
```

**Agregar las siguientes funciones nuevas** (después de `calcDashboard`):

```typescript
// Balance real: solo transacciones con paid=true (confirmadas)
// Recorre TODA la historia del usuario, no solo el mes seleccionado
export function calcSaldoActual(payload: AppPayload, uid: UserId): number {
  let total = 0;
  for (const t of payload.expenses) {
    if (t.del || t.uid !== uid) continue;

    if (t.type === 'once') {
      const ym = t.date.slice(0, 7);
      if (getPaid(t, ym)) {
        total += t.kind === 'income' ? t.amt : -t.amt;
      }
    } else {
      // monthly: sumar cada mes que tenga paid[ym] = true
      for (const [, isPaid] of Object.entries(t.paid ?? {})) {
        if (isPaid) {
          total += t.kind === 'income' ? t.amt : -t.amt;
        }
      }
    }
  }
  return total;
}

// Proyección: saldo actual + todos los pendientes del mes seleccionado
export function calcSaldoProyectado(payload: AppPayload, uid: UserId, ym: string): number {
  const actual = calcSaldoActual(payload, uid);
  let pending = 0;
  for (const t of payload.expenses) {
    if (t.del || t.uid !== uid) continue;
    if (!isMonthVisible(t, ym)) continue;
    if (getPaid(t, ym)) continue; // ya confirmado, ya está en actual
    pending += t.kind === 'income' ? t.amt : -t.amt;
  }
  return actual + pending;
}

// Retorna transacciones no confirmadas cuya fecha de vencimiento
// cae dentro de los próximos `daysAhead` días desde hoy
export function getProximosMovimientos(
  payload: AppPayload,
  uid: UserId,
  daysAhead: number = 7,
): Array<{ transaction: Transaction; dueDate: string; daysLeft: number }> {
  const today = todayStr();
  const [ty, tm, td] = today.split('-').map(Number);
  const todayMs = new Date(ty, tm - 1, td).getTime();
  const limitMs = todayMs + daysAhead * 86_400_000;

  const results: Array<{ transaction: Transaction; dueDate: string; daysLeft: number }> = [];

  for (const t of payload.expenses) {
    if (t.del || t.uid !== uid) continue;

    let dueDate: string;
    if (t.type === 'monthly') {
      const dayOfMonth = t.date.slice(8, 10);
      const currentYM = today.slice(0, 7);
      dueDate = `${currentYM}-${dayOfMonth}`;
      if (dueDate < today) continue;
      if (getPaid(t, currentYM)) continue;
    } else {
      dueDate = t.date;
      const ym = t.date.slice(0, 7);
      if (dueDate < today) continue;
      if (getPaid(t, ym)) continue;
    }

    const [dy, dm, dd] = dueDate.split('-').map(Number);
    const dueDateMs = new Date(dy, dm - 1, dd).getTime();

    if (dueDateMs > limitMs) continue;

    const daysLeft = Math.round((dueDateMs - todayMs) / 86_400_000);
    results.push({ transaction: t, dueDate, daysLeft });
  }

  return results.sort((a, b) => a.daysLeft - b.daysLeft);
}
```

---

### 1.4 `store/useAppStore.ts`

**Cambios:**

1. Agregar `currency` al import de types:
```typescript
import type { AppPayload, Transaction, Wish, Goal, Contribution, UserId, CurrencyCode } from '../types';
```

2. Agregar a `AppState` (dentro del interface):
```typescript
currency: CurrencyCode;
```

3. Agregar a `AppActions` (dentro del interface):
```typescript
setCurrency: (c: CurrencyCode) => Promise<void>;
confirmTransaction: (id: number, ym: string, date: string) => void;
```

4. Agregar constante de storage key (junto a las otras):
```typescript
const STORAGE_CURRENCY_KEY = 'nosotros_currency';
```

5. Agregar al estado inicial del store:
```typescript
currency: 'EUR' as CurrencyCode,
```

6. Agregar implementación de `setCurrency` (después de `setSelectedYM`):
```typescript
setCurrency: async (c) => {
  await AsyncStorage.setItem(STORAGE_CURRENCY_KEY, c);
  set({ currency: c });
},
```

7. Agregar implementación de `confirmTransaction` (después de `updateTransaction`):
```typescript
confirmTransaction: (id, ym, date) => {
  set((s) => ({
    payload: {
      ...s.payload,
      expenses: s.payload.expenses.map((e) => {
        if (String(e.id) !== String(id)) return e;
        const paid = { ...(e.paid ?? {}), [ym]: true };
        const paidAt = { ...(e.paidAt ?? {}), [ym]: date };
        return { ...e, paid, paidAt };
      }),
    },
  }));
  _syncToCloud();
},
```

8. En la función `initialize()` (final del archivo), agregar carga de currency:
```typescript
export async function initialize(): Promise<void> {
  const savedUser = ((await AsyncStorage.getItem(STORAGE_USER_KEY)) as UserId | null) ?? 'a';
  const savedCurrency = ((await AsyncStorage.getItem(STORAGE_CURRENCY_KEY)) as CurrencyCode | null) ?? 'EUR';
  useAppStore.setState({ currentUser: savedUser, selectedYM: currentYM(), currency: savedCurrency });
  await _connectToRoom(savedUser);
}
```

---

## FASE 1-B — Cálculos de Gastos e Ingresos del Mes `[x]`

> Necesarios para los 3 estados del BalanceCard deslizable.

**Checklist:**
- [x] 1-B.1 Agregar `calcGastosActual()` en `utils/calculations.ts`
- [x] 1-B.2 Agregar `calcGastosProyectados()` en `utils/calculations.ts`
- [x] 1-B.3 Agregar `calcIngresosActual()` en `utils/calculations.ts`
- [x] 1-B.4 Agregar `calcIngresosProyectados()` en `utils/calculations.ts`

---

### Agregar a `utils/calculations.ts`

```typescript
// Gastos confirmados (paid=true) en el mes seleccionado
export function calcGastosActual(payload: AppPayload, uid: UserId, ym: string): number {
  return payload.expenses
    .filter((t) => t.uid === uid && !t.del && t.kind === 'expense' && isMonthVisible(t, ym) && getPaid(t, ym))
    .reduce((s, t) => s + t.amt, 0);
}

// Gastos proyectados a fin de mes (confirmed + pending) en el mes seleccionado
export function calcGastosProyectados(payload: AppPayload, uid: UserId, ym: string): number {
  return payload.expenses
    .filter((t) => t.uid === uid && !t.del && t.kind === 'expense' && isMonthVisible(t, ym))
    .reduce((s, t) => s + t.amt, 0);
}

// Ingresos confirmados (paid=true) en el mes seleccionado
export function calcIngresosActual(payload: AppPayload, uid: UserId, ym: string): number {
  return payload.expenses
    .filter((t) => t.uid === uid && !t.del && t.kind === 'income' && isMonthVisible(t, ym) && getPaid(t, ym))
    .reduce((s, t) => s + t.amt, 0);
}

// Ingresos proyectados a fin de mes (confirmed + pending) en el mes seleccionado
export function calcIngresosProyectados(payload: AppPayload, uid: UserId, ym: string): number {
  return payload.expenses
    .filter((t) => t.uid === uid && !t.del && t.kind === 'income' && isMonthVisible(t, ym))
    .reduce((s, t) => s + t.amt, 0);
}
```

**Diferencia importante:**
- `calcSaldoActual` — itera TODO el historial (balance acumulado de por vida)
- `calcGastosActual` / `calcIngresosActual` — solo el mes seleccionado (vista mensual)

---

## FASE 2 — Componentes Nuevos y Modificados `[x]`

**Checklist:**
- [x] 2.1 Crear `components/BalanceCard.tsx` — card deslizable con PanResponder (3 estados)
- [x] 2.2 Crear `components/FinanceDetailModal.tsx` — popup de detalle con búsqueda y CTA
- [x] 2.3 Crear `components/ProximoMovimientoCard.tsx` — tarjeta de pago próximo
- [x] 2.4 Modificar `components/TransactionTile.tsx` — swipe gestures + categoría en meta + currency

---

### 2.1 `components/BalanceCard.tsx` — CREAR

Este componente es **el corazón visual de la pantalla home**. Tiene 3 estados que ciclan con swipe vertical usando `PanResponder` nativo.

**Los 3 estados del card:**

| Estado | Color acento | Número principal | Pill inferior | Etiqueta pill |
|--------|-------------|-----------------|---------------|---------------|
| 0 `saldo` | `#22C55E` (verde) | `calcSaldoActual` | `calcSaldoProyectado` | "Saldo después de gastos del mes" |
| 1 `gastos` | `#E11D48` (rojo) | `calcGastosActual` | `calcGastosProyectados` | "Gastos a final del mes (DD/MM/YY)" |
| 2 `ingresos` | `#16A34A` (verde oscuro) | `calcIngresosActual` | `calcIngresosProyectados` | "Ingresos a final del mes (DD/MM/YY)" |

**El header del padre cambia con el estado:**
- Estado 0: "Este es tu **Saldo Actual**"
- Estado 1: "Estos son tus **Gastos hasta hoy**"
- Estado 2: "Estos son tus **Ingresos hasta hoy**"

**Props interface:**
```typescript
type CardState = 'saldo' | 'gastos' | 'ingresos';

interface BalanceCardProps {
  saldoActual: number;
  saldoProyectado: number;
  gastosActual: number;
  gastosProyectados: number;
  ingresosActual: number;
  ingresosProyectados: number;
  currency: CurrencyCode;
  selectedYM: string;
  onStateChange: (state: CardState) => void;
  onDetailPress: (kind: 'income' | 'expense' | 'saldo') => void;
}
```

**Implementación del swipe con PanResponder:**
```typescript
const STATES: CardState[] = ['saldo', 'gastos', 'ingresos'];
const [stateIndex, setStateIndex] = useState(0);

const panResponder = useRef(
  PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dy, dx }) =>
      Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 1.5,
    onPanResponderRelease: (_, { dy }) => {
      if (dy < -35) {
        setStateIndex((i) => {
          const next = (i + 1) % STATES.length;
          onStateChange(STATES[next]);
          return next;
        });
      } else if (dy > 35) {
        setStateIndex((i) => {
          const prev = (i - 1 + STATES.length) % STATES.length;
          onStateChange(STATES[prev]);
          return prev;
        });
      }
    },
  })
).current;
```

**Estructura visual del card:**
```
┌───────────────────────────────────────────────┐
│ ▌  [número principal grande]         [botón] │  ← barra de color izquierda
│ ▌                                            │
│    ┌─────────────────────────────────────┐   │
│    │ [número secundario]  [etiqueta]     │   │  ← pill con fondo suave
│    └─────────────────────────────────────┘   │
│                      • • •                   │  ← indicador de estado (3 puntos)
└───────────────────────────────────────────────┘
```

**Indicador de estado (dots):**
```tsx
<View style={styles.stateDots}>
  {STATES.map((s, i) => (
    <View
      key={s}
      style={[
        styles.stateDot,
        i === stateIndex && { backgroundColor: accentColor, width: 16 },
      ]}
    />
  ))}
</View>
```

**Botón derecho — mapa de kind según estado:**
```typescript
const detailKindMap: Record<CardState, 'income' | 'expense' | 'saldo'> = {
  saldo:    'income',
  gastos:   'expense',
  ingresos: 'income',
};
```

**Notas de implementación:**
- El card es un `View` con `...panResponder.panHandlers` spread
- Animar la transición entre estados: `Animated.timing` con opacity
- Barra de color izquierda: `View` absoluto, `height: '60%'`, `width: 4`, `borderRadius: 2`
- Número principal: font 52px bold; decimales en `#94A3B8` 26px; símbolo 22px
- Pill: `borderRadius: 999`, `paddingHorizontal: 10`, `paddingVertical: 4`
- Background del pill por estado: saldo/ingresos → `#DCFCE7` / `#16A34A`; gastos → `#FFE4E6` / `#E11D48`

---

### 2.2 `components/FinanceDetailModal.tsx` — CREAR

Popup que se abre al tocar el botón derecho del BalanceCard. Muestra detalle de ingresos o gastos del mes con búsqueda y opción de agregar.

**Apariencia:**
```
┌─── Modal overlay (semi-transparente) ──────────┐
│  ┌────────────────────────────────────────┐    │
│  │ Estos son los                          │    │
│  │ detalles de tus ingresos               │    │  ← "ingresos/gastos" en verde/rojo
│  │                                        │    │
│  │  ▌ 184,56 €  ── Saldo actual           │    │  ← mini balance (siempre saldo)
│  │    1.621,37 €   Saldo después...       │    │
│  │                                        │    │
│  │  🔍 Buscar...              [▼]         │    │
│  │  ─────────────────────────────         │    │
│  │  ○  Sueldo              1.050,28€      │    │
│  │     30/04/26 · Pendiente  Trabajo      │    │
│  │  (FlatList scrollable...)              │    │
│  │                                        │    │
│  │  [ Añadir Ingreso / Añadir Gasto ]     │    │
│  └────────────────────────────────────────┘    │
└────────────────────────────────────────────────┘
```

**Props interface:**
```typescript
interface FinanceDetailModalProps {
  visible: boolean;
  kind: 'income' | 'expense';
  saldoActual: number;
  saldoProyectado: number;
  currency: CurrencyCode;
  uid: UserId;
  selectedYM: string;
  payload: AppPayload;
  onClose: () => void;
  onAdd: () => void;
}
```

**Lógica de filtrado interno:**
```typescript
const [search, setSearch] = useState('');

const transactions = useMemo(() => {
  const q = search.trim().toLowerCase();
  return payload.expenses
    .filter((t) =>
      t.uid === uid && !t.del && t.kind === kind && isMonthVisible(t, selectedYM) &&
      (q === '' || `${t.desc} ${t.account} ${t.tags.join(' ')}`.toLowerCase().includes(q))
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}, [payload.expenses, uid, kind, selectedYM, search]);
```

**Título dinámico:**
```typescript
const titleAction = kind === 'income' ? 'ingresos' : 'gastos';
const btnLabel = kind === 'income' ? 'Añadir Ingreso' : 'Añadir Gasto';
const btnColor = kind === 'income' ? '#22C55E' : '#E11D48';
```

**Implementación del modal:**
- `Modal` con `animationType="slide"` y `transparent`
- Card interior con `borderRadius: 24` en esquinas superiores (bottom sheet style)
- Lista usa `FlatList` para performance
- Cada item usa `TransactionTile` existente sin swipe (solo visualización)
- La mini BalanceCard es no interactiva (sin swipe, sin botón derecho)

---

### 2.3 `components/ProximoMovimientoCard.tsx` — CREAR

**Estructura visual:**
```
┌─────────────────────────────┐
│ ⚪  ⋮                        │  ← ícono + menú
│ Arriendo                    │
│ 380€/mes                    │  ← amt + frequency label
│ Debes pagar en 1 Día        │  ← daysLeft label
└─────────────────────────────┘
Color fondo: rojo #E11D48 para monthly, gris #94A3B8 para once
```

**Props interface:**
```typescript
interface ProximoMovimientoCardProps {
  transaction: Transaction;
  daysLeft: number;
  currency: CurrencyCode;
  onPress?: () => void;
  onMenuPress?: () => void;
}
```

**Lógica de etiqueta de días:**
```typescript
const daysLabel =
  daysLeft === 0 ? 'Hoy'
  : daysLeft === 1 ? 'Debes pagar en 1 Día'
  : `Debes pagar en ${daysLeft} Días`;

const freq = transaction.type === 'monthly' ? '/mes' : '/único';
const bgColor = transaction.type === 'monthly' ? '#E11D48' : '#94A3B8';
```

**Dimensiones:** `width: 160`, `height: 130`, `borderRadius: 16`, `padding: 14`

---

### 2.4 `components/TransactionTile.tsx` — MODIFICAR

**Dependencia:** `Swipeable` de `react-native-gesture-handler`

```typescript
import Swipeable from 'react-native-gesture-handler/Swipeable';
```

**Nuevas props a agregar:**
```typescript
interface TransactionTileProps {
  // ... props existentes ...
  onConfirm?: () => void;   // swipe izquierda → confirmar
  onEdit?: () => void;      // swipe derecha → editar
}
```

**Acción izquierda (confirmar — swipe izquierda del usuario):**
```tsx
const renderRightActions = () => (
  <View style={styles.swipeConfirm}>
    <Ionicons name="checkmark" size={22} color="white" />
    <Text style={styles.swipeText}>
      {transaction.kind === 'income' ? 'Confirmar\nIngreso' : 'Confirmar\nGasto'}
    </Text>
  </View>
);
// backgroundColor: '#16A34A', width: 90
```

**Acción derecha (editar — swipe derecha del usuario):**
```tsx
const renderLeftActions = () => (
  <View style={styles.swipeEdit}>
    <Ionicons name="pencil" size={20} color="white" />
    <Text style={styles.swipeText}>Editar</Text>
  </View>
);
// backgroundColor: '#2563EB', width: 75
```

**Cambio en meta line** — mostrar categoría en lugar de tipo (línea 47):
```typescript
// Antes: muestra 'Mensual' o 'Unico'
// Después:
<Text style={styles.meta}>{category.label}</Text>
```
Ver screenshot: muestra "Familia", "Trabajo", "Deportes" (labels de categoría).

**Agregar currency-awareness:**
```typescript
const currency = useAppStore((s) => s.currency);
// fmt(transaction.amt) → fmt(transaction.amt, currency)
```

**Nota:** swipe confirmar solo activo cuando `!getPaid(transaction, ym)`.

---

## FASE 3 — Rediseño de la Pantalla Principal `[x]`

**Checklist:**
- [x] 3.1 Reescribir `app/(tabs)/index.tsx` completo con nueva estructura
- [ ] 3.1a Verificar que el header cambia dinámicamente al deslizar el BalanceCard
- [ ] 3.1b Verificar que la sección "Próximos Movimientos" colapsa/expande correctamente
- [ ] 3.1c Verificar que el swipe en TransactionTile confirma y lanza sync

---

### 3.1 `app/(tabs)/index.tsx` — REESCRIBIR COMPLETO

**Nueva estructura del ScrollView:**

```
ScrollView (fondo blanco #FFFFFF)
├── Header (¡Hola Name! + subtítulo dinámico + hamburguesa)
├── BalanceCard (deslizable, 3 estados)
├── FinanceDetailModal (modal oculto, se muestra al tocar botón del card)
├── ProximosMovimientosSection
│   ├── SectionHeader ("Próximos Movimientos" + chevron colapsable)
│   └── ScrollView horizontal → [ProximoMovimientoCard × N]
└── MovimientosRecientesSection
    ├── SectionHeader ("Movimientos Recientes")
    ├── Subtitle instructivo (hint de swipe)
    └── [TransactionTile (con swipe) × N]
```

**Estado local necesario:**
```typescript
type CardState = 'saldo' | 'gastos' | 'ingresos';

const [cardState, setCardState] = useState<CardState>('saldo');
const [proximosCollapsed, setProximosCollapsed] = useState(false);
const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
const [detailModal, setDetailModal] = useState<{
  visible: boolean;
  kind: 'income' | 'expense';
}>({ visible: false, kind: 'income' });
```

**Datos del store:**
```typescript
const payload        = useAppStore((s) => s.payload);
const currentUser    = useAppStore((s) => s.currentUser);
const selectedYM     = useAppStore((s) => s.selectedYM);
const currency       = useAppStore((s) => s.currency);
const confirmTx      = useAppStore((s) => s.confirmTransaction);
```

**Cálculos:**
```typescript
const saldoActual         = calcSaldoActual(payload, currentUser);
const saldoProyectado     = calcSaldoProyectado(payload, currentUser, selectedYM);
const gastosActual        = calcGastosActual(payload, currentUser, selectedYM);
const gastosProyectados   = calcGastosProyectados(payload, currentUser, selectedYM);
const ingresosActual      = calcIngresosActual(payload, currentUser, selectedYM);
const ingresosProyectados = calcIngresosProyectados(payload, currentUser, selectedYM);
const proximos            = getProximosMovimientos(payload, currentUser, 7);

const recent = payload.expenses
  .filter((t) => t.uid === currentUser && !t.del && isMonthVisible(t, selectedYM))
  .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  .slice(0, 8);
```

**Subtítulo del header (dinámico según cardState):**
```typescript
const CARD_SUBTITLES: Record<CardState, { prefix: string; accent: string; color: string }> = {
  saldo:    { prefix: 'Este es tu ',    accent: 'Saldo Actual',       color: '#22C55E' },
  gastos:   { prefix: 'Estos son tus ', accent: 'Gastos hasta hoy',   color: '#E11D48' },
  ingresos: { prefix: 'Estos son tus ', accent: 'Ingresos hasta hoy', color: '#16A34A' },
};
const subtitle = CARD_SUBTITLES[cardState];
```

**Header JSX:**
```tsx
<View style={styles.header}>
  <View>
    <Text style={styles.greeting}>¡Hola {user.name}!</Text>
    <Text style={styles.subtitle}>
      {subtitle.prefix}
      <Text style={[styles.subtitleAccent, { color: subtitle.color }]}>
        {subtitle.accent}
      </Text>
    </Text>
  </View>
  <TouchableOpacity style={styles.menuBtn}>
    <Ionicons name="menu" size={24} color="#0F172A" />
  </TouchableOpacity>
</View>
```

**BalanceCard + FinanceDetailModal en el JSX:**
```tsx
<BalanceCard
  saldoActual={saldoActual}
  saldoProyectado={saldoProyectado}
  gastosActual={gastosActual}
  gastosProyectados={gastosProyectados}
  ingresosActual={ingresosActual}
  ingresosProyectados={ingresosProyectados}
  currency={currency}
  selectedYM={selectedYM}
  onStateChange={setCardState}
  onDetailPress={(kind) =>
    setDetailModal({ visible: true, kind: kind === 'saldo' ? 'income' : kind })
  }
/>

<FinanceDetailModal
  visible={detailModal.visible}
  kind={detailModal.kind}
  saldoActual={saldoActual}
  saldoProyectado={saldoProyectado}
  currency={currency}
  uid={currentUser}
  selectedYM={selectedYM}
  payload={payload}
  onClose={() => setDetailModal((s) => ({ ...s, visible: false }))}
  onAdd={() => {
    setDetailModal((s) => ({ ...s, visible: false }));
    // el TransactionModal global se abre desde _layout FAB
  }}
/>
```

**Sección "Próximos Movimientos":**
```tsx
<View style={styles.section}>
  <TouchableOpacity
    style={styles.sectionHead}
    onPress={() => setProximosCollapsed(!proximosCollapsed)}
  >
    <Text style={styles.sectionTitle}>Próximos Movimientos</Text>
    <Ionicons
      name={proximosCollapsed ? 'chevron-forward' : 'chevron-down'}
      size={20} color="#64748B"
    />
  </TouchableOpacity>

  {!proximosCollapsed && (
    proximos.length === 0 ? (
      <Text style={styles.emptyProximos}>Sin pagos próximos</Text>
    ) : (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 24 }}>
        {proximos.map(({ transaction: t, daysLeft }) => (
          <ProximoMovimientoCard key={t.id} transaction={t} daysLeft={daysLeft} currency={currency} />
        ))}
      </ScrollView>
    )
  )}
</View>
```

**Sección "Movimientos Recientes":**
```tsx
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Movimientos Recientes</Text>
  <Text style={styles.swipeHint}>
    Desliza tus movimientos a la izquierda para confirmarlos o a la derecha para editarlos
  </Text>
  {recent.map((t) => (
    <TransactionTile
      key={t.id}
      transaction={t}
      ym={selectedYM}
      onPress={() => setEditTransaction(t)}
      onConfirm={() => confirmTx(t.id, selectedYM, todayStr())}
      onEdit={() => setEditTransaction(t)}
    />
  ))}
</View>
```

**Estilos clave:**
```typescript
scroll:         { flex: 1, backgroundColor: '#FFFFFF' }
header:         { paddingHorizontal: 24, paddingTop: 52, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#FFFFFF' }
greeting:       { fontSize: 24, fontWeight: '800', color: '#0F172A' }
subtitleAccent: { fontWeight: '700' }
sectionTitle:   { fontSize: 18, fontWeight: '800', color: '#0F172A' }
swipeHint:      { fontSize: 12, color: '#94A3B8', marginBottom: 12, fontWeight: '500' }
```

---

## FASE 4 — Navegación y Pantalla de Perfil `[ ]`

**Checklist:**
- [ ] 4.1 Crear `app/(tabs)/create.tsx` — placeholder vacío
- [ ] 4.2 Reescribir `app/(tabs)/_layout.tsx` — 5 tabs + FAB central + TransactionModal global
- [ ] 4.3 Crear `app/(tabs)/perfil.tsx` — pantalla de perfil con selector de moneda y UserSwitcher

---

### 4.1 `app/(tabs)/create.tsx` — CREAR (placeholder)

```typescript
// Nunca se renderiza — el FAB intercepta antes de navegar
export default function CreateScreen() { return null; }
```

---

### 4.2 `app/(tabs)/_layout.tsx` — REESCRIBIR COMPLETO

**Nuevo diseño de 5 tabs:**

```
Tab 1: index       → Home          (home-outline / home)
Tab 2: movimientos → Recurrentes   (repeat-outline / repeat)
Tab 3: create      → FAB central   (botón verde, no navega a ninguna pantalla)
Tab 4: deseos      → Deseos        (star-outline / star)
Tab 5: perfil      → Perfil        (person-outline / person)
```

**Estrategia del FAB central:**

El tab "create" usa `tabBarButton` personalizado que **no navega** — intercepta el tap y abre un modal de creación declarado en el mismo `_layout.tsx`.

```typescript
const [showCreate, setShowCreate] = useState(false);
```

```tsx
<Tabs.Screen
  name="create"
  options={{
    title: '',
    tabBarButton: () => (
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    ),
  }}
/>

{/* TransactionModal global — accesible desde cualquier tab */}
<TransactionModal
  visible={showCreate}
  initialKind="expense"
  onClose={() => setShowCreate(false)}
/>
```

**Estilos del FAB:**
```typescript
fab: {
  width: 64, height: 64, borderRadius: 32,
  backgroundColor: '#22C55E',
  alignItems: 'center', justifyContent: 'center',
  marginBottom: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.18, shadowRadius: 8, elevation: 8,
}
```

**TabBar styling:**
```typescript
tabBarStyle: {
  backgroundColor: '#FFFFFF',
  borderTopColor: '#E2E8F0',
  height: 72,
  paddingBottom: 12,
  paddingTop: 8,
}
```

**Cambios en el header:**
- Quitar `UserSwitcher` (pasa a la pantalla Perfil)
- Quitar `headerTitle: 'nosotros'` global (cada pantalla maneja su header o no tiene)
- `SyncStatus` puede moverse al header de Perfil o mantenerse aquí

---

### 4.3 `app/(tabs)/perfil.tsx` — CREAR

**Secciones de la pantalla:**

```
ScrollView
├── Header de perfil (avatar + nombre + usuario activo)
├── Sección "Cuenta"
│   └── [Cambiar usuario] → abre UserSwitcher o selector inline
├── Sección "Preferencias"
│   └── [Moneda] → selector de currency (EUR | USD | BS | COP)
├── Sección "Sincronización"
│   └── [Estado sync] + botón "Actualizar"
└── Sección "Acerca de"
    └── Versión de la app
```

**Selector de moneda:**
```tsx
{Object.values(CURRENCIES).map((c) => (
  <TouchableOpacity
    key={c.code}
    style={[styles.currencyOption, currency === c.code && styles.currencySelected]}
    onPress={() => setCurrency(c.code)}
  >
    <Text style={styles.currencySymbol}>{c.symbol}</Text>
    <Text style={styles.currencyLabel}>{c.label}</Text>
    {currency === c.code && <Ionicons name="checkmark" size={18} color="#22C55E" />}
  </TouchableOpacity>
))}
```

**Datos del store:**
```typescript
const currentUser    = useAppStore((s) => s.currentUser);
const setCurrentUser = useAppStore((s) => s.setCurrentUser);
const currency       = useAppStore((s) => s.currency);
const setCurrency    = useAppStore((s) => s.setCurrency);
const syncStatus     = useAppStore((s) => s.syncStatus);
```

---

## FASE 5 — Notificaciones Push `[ ]`

**Checklist:**
- [ ] 5.1 Crear `services/notifications.ts` con schedule + cancel + permisos
- [ ] 5.2 Integrar `cancelTransactionReminders` en `confirmTransaction` del store
- [ ] 5.3 Integrar `scheduleTransactionReminder` en `addTransaction` del store
- [ ] 5.4 Llamar `requestNotificationPermissions()` en `app/_layout.tsx` al iniciar

---

### 5.1 `services/notifications.ts` — CREAR

```typescript
import * as Notifications from 'expo-notifications';
import type { Transaction } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleTransactionReminder(
  transaction: Transaction,
  dueDate: string,
  daysAhead: number[] = [3, 1],
): Promise<void> {
  const [dy, dm, dd] = dueDate.split('-').map(Number);

  for (const days of daysAhead) {
    const triggerDate = new Date(dy, dm - 1, dd);
    triggerDate.setDate(triggerDate.getDate() - days);
    if (triggerDate <= new Date()) continue;

    const label = days === 1 ? 'mañana' : `en ${days} días`;
    await Notifications.scheduleNotificationAsync({
      identifier: `tx-${transaction.id}-${days}d`,
      content: {
        title: `Pago próximo: ${transaction.desc}`,
        body: `Debes ${transaction.kind === 'expense' ? 'pagar' : 'recibir'} ${label}`,
        data: { transactionId: transaction.id },
      },
      trigger: { date: triggerDate },
    });
  }
}

export async function cancelTransactionReminders(transactionId: number): Promise<void> {
  for (const days of [7, 3, 1]) {
    await Notifications.cancelScheduledNotificationAsync(`tx-${transactionId}-${days}d`);
  }
}
```

---

### 5.2 Integración en `store/useAppStore.ts`

**En `confirmTransaction`** (ya creado en Fase 1.4), agregar al final del callback:
```typescript
import { cancelTransactionReminders } from '../services/notifications';
// dentro de confirmTransaction, después de _syncToCloud():
cancelTransactionReminders(id); // fire-and-forget
```

**En `addTransaction`**, programar recordatorio si la fecha es futura:
```typescript
import { scheduleTransactionReminder } from '../services/notifications';
// al final de addTransaction:
if (t.date > todayStr()) {
  scheduleTransactionReminder(t, t.date, [3, 1]); // fire-and-forget
}
```

**En `app/_layout.tsx`** (root layout), pedir permisos al iniciar:
```typescript
import { requestNotificationPermissions } from '../services/notifications';
// en useEffect de inicialización:
requestNotificationPermissions();
```

---

## FASE 6 — Moneda Global en Toda la App `[ ]`

> Actualizar todos los archivos que llaman `fmt()` sin pasar `currency`.

**Checklist:**
- [ ] 6.1 `components/GoalCard.tsx` — `fmt(total)`, `fmt(goal.target)`, `fmt(remaining)`
- [ ] 6.2 `components/WishCard.tsx` — `fmt(wish.price)`, `fmt(monthly)`
- [ ] 6.3 `modals/TransactionModal.tsx` — displays de amount
- [ ] 6.4 `modals/GoalModal.tsx` — displays de amount
- [ ] 6.5 `modals/WishModal.tsx` — displays de amount
- [ ] 6.6 `modals/ContributionModal.tsx` — displays de amount
- [ ] 6.7 `app/(tabs)/movimientos.tsx` — resúmenes de totales
- [ ] 6.8 `app/(tabs)/ahorros.tsx` — totales de goals
- [ ] 6.9 `app/(tabs)/deseos.tsx` — precios de deseos

**Patrón estándar para cada archivo:**
```typescript
// Agregar al inicio del componente/screen:
const currency = useAppStore((s) => s.currency);
// Cambiar todas las llamadas:
fmt(amount)  →  fmt(amount, currency)
```

---

## Notas de Implementación

### Orden de implementación

```
0. Instalar dependencias (expo-notifications)
1. Fase 1 + 1-B  → tipos, store, todos los cálculos
2. Fase 2.1      → BalanceCard (con swipe PanResponder)
3. Fase 2.2      → FinanceDetailModal
4. Fase 2.3      → ProximoMovimientoCard
5. Fase 3        → index.tsx (integra todo lo anterior)
6. Fase 4.1-4.2  → create.tsx + _layout.tsx (nueva navegación)
7. Fase 4.3      → perfil.tsx
8. Fase 2.4      → TransactionTile con swipe
9. Fase 5        → Notificaciones
10. Fase 6       → Moneda global en toda la app
```

---

### Puntos de atención

- **`GestureHandlerRootView`**: Para que `Swipeable` funcione, el root de la app debe estar envuelto. Verificar `app/_layout.tsx` y agregar si no está presente.
- **Conflicto PanResponder vs ScrollView**: El swipe vertical del `BalanceCard` puede competir con el scroll del `ScrollView` padre. Solución: `onMoveShouldSetPanResponder` con umbral angular — solo captura si el gesto es más vertical que horizontal.
- **Swipe horizontal en listas dentro de ScrollView vertical**: Posible conflicto. Solución: usar `simultaneousHandlers` en `Swipeable` o migrar la lista a `FlatList`.
- **Estado del card sincronizado con el header**: `onStateChange` actualiza `cardState` en `index.tsx`, que cambia el subtítulo. Prop drilling intencional y necesario.
- **Notificaciones en desarrollo**: Requieren dispositivo físico o Expo Go. En simulador iOS pueden no dispararse.
- **`confirmTransaction` en transacciones `monthly`**: El `ym` que se pasa debe ser `selectedYM` del store, no el de la fecha de la transacción.
- **`calcSaldoActual` con historial largo**: Itera TODO el historial. Memoizar con `useMemo` en `index.tsx` si hay degradación de performance.
- **Backward compatibility de `fmt()`**: El parámetro `currency` tiene default `'EUR'`, todos los llamados existentes siguen funcionando sin cambios hasta la Fase 6.
- **FinanceDetailModal → TransactionModal**: El botón "Añadir" cierra el modal y luego abre el `TransactionModal`. Manejar con estado en `index.tsx` o con callback global desde `_layout.tsx`.

---

### Consideraciones de diseño

- **Color primario nuevo**: Verde `#22C55E` reemplaza al azul `#2563EB` como acento de la home. El azul se mantiene para acciones secundarias (editar).
- **Fondo home**: `#EDF2F7` → `#FFFFFF` (blanco puro).
- **Tab bar**: `height: 72` para acomodar el FAB elevado sobre el nivel del borde.
- **Hamburger menu**: `TouchableOpacity` sin acción por ahora (placeholder).
- **Chart button en BalanceCard**: `onPress` vacío, marcado con `// TODO: stats screen`.

---

*Plan generado el 2026-05-05. Marcar cada fase con `[x]` al completarla.*
