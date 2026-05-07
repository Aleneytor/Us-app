# Feature: Categorías con Presupuesto Mensual

## Qué reemplaza

La sección de **"Próximos Movimientos"** en el home (`app/(tabs)/index.tsx`) — actualmente una fila horizontal de tarjetas `ProximoMovimientoCard` — se reemplaza por una sección de **Categorías de Presupuesto**. El componente `ProximoMovimientoCard.tsx` quedaría obsoleto.

---

## Concepto

El usuario (o la pareja) puede crear **categorías de presupuesto** con un límite mensual de gasto. Cada categoría actúa como un "sobre" de dinero: muestra cuánto fue asignado, cuánto se gastó y cuánto queda disponible en el mes actual.

**Ejemplo:**
- Categoría "Uñas" → presupuesto $50/mes → gastado $25 → disponible $25
- Categoría "Comida" → presupuesto €120/mes → gastado €30 → disponible €90

---

## Modelo de datos nuevo

### `BudgetCategory`

```ts
interface BudgetCategory {
  id: number;
  name: string;           // "Uñas", "Comida", nombre libre
  icon: string;           // clave de Ionicons, ej. 'cut-outline'
  iconColor: string;      // color hex del icono, ej. '#7C3AED'
  monthlyBudget: number;  // importe mensual asignado
  uid?: UserId;           // si es personal; undefined = compartida con la pareja
  notes?: string;
}
```

### Cambio en `Transaction`

Agregar campo opcional que vincula la transacción a una categoría de presupuesto:

```ts
interface Transaction {
  // ... campos existentes ...
  budgetCatId?: number;   // id de BudgetCategory, si aplica
}
```

### Cambio en `AppPayload`

```ts
interface AppPayload {
  expenses: Transaction[];
  wishlist: Wish[];
  goals: Goal[];
  contribs: Contribution[];
  budgetCategories: BudgetCategory[];   // NUEVO
}
```

---

## Lógica de negocio

### Cálculo mensual
- Se filtra `expenses` por el mes seleccionado (`selectedYM`) y por `budgetCatId === category.id` y `kind === 'expense'` y `!del`.
- `gastado = sum(transactions.amt)`
- `disponible = category.monthlyBudget - gastado`
- `porcentaje = gastado / category.monthlyBudget` (clamped 0–1 para la barra de progreso)

### Categorías personales vs. compartidas
- `uid === undefined` → la pareja entera la ve y puede agregar gastos
- `uid === currentUser` → solo ese usuario la ve (presupuesto personal)

### Sin reset automático
El presupuesto es el mismo todos los meses; el gasto se recalcula según el mes seleccionado en el navegador de meses. No hay reset ni historial de presupuesto por mes (el límite es fijo).

---

## UI — Sección en el Home

### Ubicación
En `app/(tabs)/index.tsx`, donde hoy está la sección de "Próximos Movimientos" (la `ScrollView` horizontal con `ProximoMovimientoCard`).

### Layout de la sección
```
[ Categorías                    Ver todas → ]
[ + Nueva categoría ]

[ 🍔 Comida          €30 / €120  ████░░░░  €90 disponible ]
[ 💅 Uñas            $25 / $50   █████░░░  $25 disponible ]
[ 🏠 Renta           €600/ €600  ████████  €0 disponible  ]
```

- Máximo 3–4 categorías visibles; botón "Ver todas →" abre listado completo.
- Cada fila es una tarjeta con: icono coloreado, nombre, barra de progreso, importe gastado / presupuesto, importe disponible.
- Barra de progreso: verde si < 75%, naranja si 75–99%, rojo si ≥ 100%.
- Si `disponible < 0` → texto en rojo "Excediste por X".

### Tarjeta vacía (sin categorías)
Si no hay categorías: ilustración pequeña + texto "Crea tu primera categoría de presupuesto" + botón "+ Nueva categoría".

---

## UI — Crear/Editar Categoría

Modal `BudgetCategoryModal` (similar a `TransactionModal`):

| Campo | Control |
|---|---|
| Nombre | `TextInput` libre |
| Ícono | `IconPicker` (ya existe) |
| Color del ícono | `ColorPicker` (ya existe) |
| Presupuesto mensual | `TextInput` numérico |
| Visible para | Selector: "Solo yo" / "Ambos" |
| Notas | `TextInput` opcional |

---

## UI — Detalle de Categoría

Al tocar una categoría se abre un **modal** o **pantalla** `CategoryDetailScreen` con:

1. **Cabecera**: nombre, icono, presupuesto mensual, barra de progreso grande.
2. **Lista de transacciones** del mes actual vinculadas a esta categoría (mismo componente `TransactionTile`).
3. **Botón flotante** "+ Agregar gasto" → abre `TransactionModal` con `budgetCatId` pre-llenado y `kind = 'expense'`.

Navegación sugerida: modal stack (no tab), para no romper la navegación actual.

---

## Cambios en el Store (`useAppStore`)

```ts
// Nuevas acciones
addBudgetCategory: (bc: BudgetCategory) => void;
updateBudgetCategory: (bc: BudgetCategory) => void;
deleteBudgetCategory: (id: number) => void;
```

`AppPayload` ya se sincroniza con Supabase en bloque, por lo que agregar `budgetCategories` al payload es suficiente para persistencia y sync en tiempo real.

---

## Cambios en `TransactionModal`

- Agregar campo opcional `initialBudgetCatId?: number` en las props.
- En el formulario: selector de categoría de presupuesto (dropdown) para poder vincular un gasto manual a una categoría existente.
- No es obligatorio; si no se selecciona, `budgetCatId` queda `undefined`.

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `types/index.ts` | Agregar `BudgetCategory`, `budgetCatId` en `Transaction`, actualizar `AppPayload` |
| `store/useAppStore.ts` | Nuevas acciones CRUD para `budgetCategories` |
| `components/BudgetCategoryCard.tsx` | Tarjeta de fila con barra de progreso (NUEVO) |
| `modals/BudgetCategoryModal.tsx` | Modal crear/editar categoría (NUEVO) |
| `app/(tabs)/index.tsx` | Reemplazar sección ProximosMovimientos por nueva sección |
| `modals/TransactionModal.tsx` | Agregar selector de `budgetCatId` |
| `components/ProximoMovimientoCard.tsx` | Marcar como obsoleto / eliminar |
| `utils/calculations.ts` | Agregar `calcBudgetCategorySpending(payload, catId, ym)` |

---

## Orden de implementación sugerido

1. Actualizar `types/index.ts` con nuevos modelos.
2. Actualizar `store/useAppStore.ts` con acciones y persistencia.
3. Crear `utils/calculations.ts` helper de gasto por categoría.
4. Crear `components/BudgetCategoryCard.tsx`.
5. Crear `modals/BudgetCategoryModal.tsx`.
6. Actualizar `app/(tabs)/index.tsx` para reemplazar la sección.
7. Actualizar `modals/TransactionModal.tsx` con selector de categoría de presupuesto.

---

## Decisiones abiertas

- **¿Las categorías de presupuesto aparecen también en la tab Movimientos?** No está definido; por ahora solo en el Home.
- **¿Se puede filtrar la lista de movimientos por categoría de presupuesto?** Podría ser un filtro adicional en `movimientos.tsx` a futuro.
- **¿Historial de presupuesto por mes?** No por ahora; el límite es fijo.
- **Orden de las categorías**: por defecto, orden de creación. Sin drag-to-reorder por ahora.
