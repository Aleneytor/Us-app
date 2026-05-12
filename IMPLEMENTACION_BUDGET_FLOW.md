# Implementación: Budget Category Flow + Eliminación de lógica "Confirmar"

## Resumen del cambio

### 🗑️ LO QUE MURIÓ (ELIMINADO)
La lógica de **confirmar/marcar como pagado** un gasto pendiente:
- ✅ Swipe izquierdo en `TransactionTile` para "Confirmar"
- ✅ Switch de "Ingresado / Pendiente" en `TransactionDetailModal`
- ✅ Texto "Confirmado / Pendiente" en cada fila de `TransactionTile`
- ✅ Prop `onConfirm` en `TransactionTile`
- ✅ Prop `onTogglePaid` en `TransactionDetailModal`
- ✅ Funciones `toggleTx`, `togglePaid`, `togglePaidFromList` en pantallas
- ✅ Hint de swipe "Desliza hacia la izquierda para marcar como listo" en index.tsx
- ✅ Imports de `getPaid`, `setPaid`, `todayStr` donde ya no se usan

> Los campos `paid` y `paidAt` en Transaction se CONSERVAN en el tipo de dato
> para no romper datos existentes, pero ya no se manipulan desde la UI.

### ✅ LO QUE NACE / YA EXISTE
Las **categorías de presupuesto** son el centro del tracking financiero:
- Al crear una categoría con presupuesto mensual (ej: Comida = €120/mes),
  la app automáticamente muestra cuánto se ha gastado vs el presupuesto.
- Las transacciones vinculadas a una categoría (via `budgetCatId`) se suman al gasto real.
- El usuario puede ver el estado de cada categoría en el Home.
- Las categorías que no tienen gastos vinculados muestran €0 / €120.
- Las categorías PUEDEN excederse (sobregiro visible en rojo).

---

## Estado de implementación por archivo

| Archivo | Cambio | Estado |
|---|---|---|
| `components/TransactionTile.tsx` | Eliminado onConfirm, swipe confirm, texto Pendiente/Confirmado. Ahora muestra account en su lugar. | ✅ COMPLETO |
| `components/TransactionDetailModal.tsx` | Eliminado Switch "Ingresado/Pendiente", onTogglePaid prop, estilos toggle orphan | ✅ COMPLETO |
| `app/(tabs)/index.tsx` | Eliminado toggleTx, onConfirm, onTogglePaid, swipeHint, imports unused | ✅ COMPLETO |
| `app/(tabs)/movimientos.tsx` | Eliminado togglePaid, togglePaidFromList, onConfirm, onTogglePaid, imports unused | ✅ COMPLETO |
| `modals/BudgetCategoryDetailModal.tsx` | Eliminado toggleTx, onConfirm, onTogglePaid, imports unused | ✅ COMPLETO |
| `IMPLEMENTACION_BUDGET_FLOW.md` | Tracking document | ✅ COMPLETO |

---

## Lo que YA ESTABA implementado antes de este sprint

- [x] Modelo `BudgetCategory` en `types/index.ts`
- [x] Campo `budgetCatId` en `Transaction`
- [x] `budgetCategories` en `AppPayload`
- [x] CRUD en `store/useAppStore.ts` (addBudgetCategory, updateBudgetCategory, deleteBudgetCategory)
- [x] `calcBudgetCategorySpending` en `utils/calculations.ts`
- [x] `components/BudgetCategoryCard.tsx` con barra de progreso
- [x] `modals/BudgetCategoryModal.tsx` para crear/editar categorías
- [x] `modals/BudgetCategoryDetailModal.tsx` con detalle + lista de transacciones vinculadas
- [x] Sección de categorías en `app/(tabs)/index.tsx` (carousel paginado)
- [x] Selector de `budgetCatId` en `modals/TransactionModal.tsx` (paso 3)

---

## Comportamiento resultante del flujo

1. **Usuario crea una categoría**: ej. "Comida" con €120/mes presupuesto.
2. **El home muestra la categoría** con barra de progreso verde (€0 / €120 = 0%).
3. **Usuario agrega un gasto** de €30, vinculándolo a "Comida" en el paso 3 del TransactionModal.
4. **La barra se actualiza** automáticamente a €30 / €120 (25% verde).
5. **Si se excede** (ej. €150 total), la barra se pone roja y dice "Excediste por €30".
6. **Fin de mes**: el gasto acumulado en "Comida" para ese mes es €150 (o lo que sea).
7. **Cambiando de mes** con el navegador de meses, cada mes muestra su propio total acumulado.

No hay confirmaciones, no hay "pendiente/confirmado". El gasto existe o no existe.

---

## Próximos pasos posibles (futuros sprints)

- [ ] Filtrar la lista de movimientos por `budgetCatId` desde la tab Movimientos
- [ ] Mostrar el nombre de la categoría vinculada en el TransactionDetailModal
- [ ] Resumen de presupuesto mensual por categoría en la tab Movimientos
- [ ] Notificación push cuando una categoría supera el 80% del presupuesto
- [ ] **Ingresos estimados por categoría** ← ver sección siguiente

---

## Feature pendiente: Ingresos mensuales estimados por categoría

### Objetivo

Implementar soporte para que una categoría pueda tener, de forma **opcional**, un **ingreso mensual estimado** además de su presupuesto mensual de gasto.

Actualmente la lógica principal de categorías está orientada a presupuestos de gasto. Sin embargo, hay categorías que pueden representar áreas donde el usuario **gana y gasta dinero al mismo tiempo**.

**Ejemplo:**
```
Categoría: Trabajo
Presupuesto de gasto mensual: 100 €
Ingreso estimado mensual:    1200 €
```

---

### Cambio en el modelo de datos

#### `BudgetCategory` — agregar campo opcional

```ts
interface BudgetCategory {
  id: number;
  name: string;
  icon: string;
  iconColor: string;
  monthlyBudget: number;       // presupuesto de GASTO mensual (ya existe)
  monthlyIncomeEstimate?: number;  // NUEVO: ingreso estimado mensual (opcional)
  uid?: UserId;
  notes?: string;
}
```

> No requiere migración destructiva. Los registros existentes sin `monthlyIncomeEstimate`
> simplemente valen `undefined` y se tratan como "sin ingreso estimado".

---

### Lógica de negocio

#### Cálculo de ingreso real vs estimado

```ts
// En utils/calculations.ts — nueva función a crear
function calcBudgetCategoryIncome(
  payload: AppPayload,
  catId: number,
  ym: string,
): number {
  return payload.expenses
    .filter((t) =>
      !t.del &&
      t.kind === 'income' &&
      String(t.budgetCatId) === String(catId) &&
      isMonthVisible(t, ym),
    )
    .reduce((sum, t) => sum + t.amt, 0);
}
```

- **`ingresoReal`** = suma de transacciones `kind === 'income'` vinculadas a la categoría en el mes.
- **`ingresoEstimado`** = `category.monthlyIncomeEstimate` (puede ser `undefined`).
- **`balance`** = `ingresoReal - gastoReal` (útil para categorías mixtas como "Trabajo").

---

### UI — `BudgetCategoryCard.tsx`

Cuando `monthlyIncomeEstimate` existe, la tarjeta muestra una segunda línea de ingreso:

```
[ 💼 Trabajo              ]
[ Gasto: €100 / €100  ████ ]
[ Ingreso: €950 / €1200    ]  ← solo si monthlyIncomeEstimate existe
```

- La barra de progreso sigue siendo solo del **gasto**.
- El ingreso se muestra como texto secundario debajo, sin barra (es informativo).
- Si el ingreso real supera el estimado: texto verde "↑ Superaste el estimado".
- Si el ingreso real es menor: texto naranja "↓ Falta €250 del estimado".

---

### UI — `BudgetCategoryDetailModal.tsx`

Nueva sección "Ingresos del mes" dentro del modal de detalle, debajo de la sección de progreso de gastos:

```
[ Progreso de gasto: barra existente ]

[ Ingresos este mes ]
  Real:     €950
  Estimado: €1.200
  Diferencia: -€250 (naranja)
```

Lista de transacciones separada por tipo (gastos arriba, ingresos abajo), o filtro por tipo.

---

### UI — `BudgetCategoryModal.tsx` (crear/editar)

Agregar campo opcional en el formulario:

| Campo | Control |
|---|---|
| Ingreso mensual estimado | `TextInput` numérico, placeholder "Opcional" |

- Aparece solo si el usuario activa un toggle "Esta categoría también genera ingresos".
- Si se deja vacío o en 0, se guarda como `undefined`.

---

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `types/index.ts` | Agregar `monthlyIncomeEstimate?: number` a `BudgetCategory` |
| `utils/calculations.ts` | Nueva función `calcBudgetCategoryIncome(payload, catId, ym)` |
| `components/BudgetCategoryCard.tsx` | Mostrar línea de ingreso si `monthlyIncomeEstimate` existe |
| `modals/BudgetCategoryModal.tsx` | Agregar campo opcional de ingreso estimado |
| `modals/BudgetCategoryDetailModal.tsx` | Sección de ingresos reales vs estimado |

> **No requiere cambios en el Store** — `updateBudgetCategory` ya persiste el objeto completo.
> **No requiere cambios en `TransactionModal`** — el campo `budgetCatId` ya funciona para `kind === 'income'`.

---

### Estado de implementación

| Paso | Descripción | Estado |
|---|---|---|
| 1 | Agregar `monthlyIncomeEstimate` al tipo `BudgetCategory` | ✅ COMPLETO |
| 2 | Crear `calcBudgetCategoryIncome` en calculations.ts | ✅ COMPLETO |
| 3 | Actualizar `BudgetCategoryCard` con línea de ingreso | ✅ COMPLETO |
| 4 | Actualizar `BudgetCategoryModal` con campo de ingreso estimado | ✅ COMPLETO |
| 5 | Actualizar `BudgetCategoryDetailModal` con sección de ingresos | ✅ COMPLETO |

---
_Última actualización: ingresos estimados por categoría implementados completamente_
