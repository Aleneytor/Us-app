# Plan de Implementación: Expansión de la Feature "Planes" v2

> Basado en el análisis de Tricount by bunq, adaptado al nicho de finanzas personales para parejas.

---

## 1. Análisis de Tricount

### Lo que vimos en las pantallas

| Pantalla | Insight clave |
|---|---|
| Lista de planes | Tarjetas minimalistas: icono + nombre + chevron. FAB central para crear. |
| Tab "Gastos" | Stats bar (Mis Gastos / Gastos Totales). Lista agrupada por fecha. Cada fila: icono categoría, título, "Pagado por X", monto. FAB "Añadir gasto". |
| Tab "Saldos" | Banner "Te deben X €" con emoji. Lista de miembros con saldo neto: verde = te deben, rojo = debes. Botón de ordenar. |
| Formulario de gasto | Título + emoji picker + cámara. Campo cantidad + selector moneda. Picker "Pagado por" + "Cuando". Sección "Dividir" con modos: Partes (Nx por miembro con – / +), Igual, Porcentaje. Botón full-width "Añadir". |

### Diferencias clave a adaptar para nuestra app
- Somos una app de pareja, no de grupos grandes → el caso común es 2 personas (usuario + pareja) más invitados externos ocasionales.
- Ya tenemos `categories` dentro de un `Plan` con presupuesto por categoría → las conservamos como estructura de presupuesto, pero el flujo de "añadir gasto" se simplifica.
- Tenemos `splitMode: 'equal' | 'custom'` que expandimos a `'equal' | 'parts' | 'percentage'`.
- Agregamos **liquidaciones (settlements)** para registrar cuando alguien salda su deuda.

---

## 2. Cambios en los Tipos (`types/index.ts`)

### 2.1 Expandir `PlanExpense` — agregar splits explícitos

```ts
export interface PlanExpenseSplit {
  memberId: string;
  parts?: number;      // usado en modo 'parts'
  pct?: number;        // usado en modo 'percentage'
  amount: number;      // monto calculado que le toca
}

export interface PlanExpense {
  id: number;
  categoryId?: number;          // opcional — se puede registrar sin categoría
  memberId: string;             // quien pagó
  memberName: string;
  title: string;                // NUEVO — título del gasto (antes era 'note')
  amount: number;               // monto total pagado
  date: string;                 // 'YYYY-MM-DD'
  splitMode: 'equal' | 'parts' | 'percentage';  // NUEVO
  splits: PlanExpenseSplit[];   // NUEVO — cómo se divide entre miembros
  note?: string;
}
```

### 2.2 Expandir `Plan` — agregar splitMode granular y settlements

```ts
export interface PlanSettlement {
  id: number;
  fromMemberId: string;   // quien paga
  toMemberId: string;     // quien recibe
  amount: number;
  date: string;
  note?: string;
}

export interface Plan {
  id: number;
  title: string;
  icon: string;
  iconColor?: string;
  description?: string;
  date: string;
  members: PlanMember[];
  categories: PlanCategory[];
  expenses: PlanExpense[];
  settlements: PlanSettlement[];  // NUEVO
  splitMode: 'equal' | 'parts' | 'percentage';  // expandido
  defaultSplitMode?: 'equal' | 'parts' | 'percentage';  // NUEVO — default para nuevos gastos
}
```

---

## 3. Nuevas Utilidades (`utils/planCalculations.ts`)

Archivo nuevo con toda la lógica financiera de planes:

```ts
// Calcula el saldo neto de cada miembro:
// saldo = lo que pagó - lo que debe (según splits de gastos)
// Menos settlements recibidos/enviados
export function computeMemberBalances(plan: Plan): MemberBalance[]

// Para un gasto dado, calcula los splits según el modo
export function computeSplits(
  amount: number,
  members: PlanMember[],
  mode: 'equal' | 'parts' | 'percentage',
  params: Record<string, number>  // memberId -> parts o pct
): PlanExpenseSplit[]

// Resuelve deudas: simplifica al mínimo de transacciones necesarias
// Ej: A debe a B 10, B debe a C 10 → A paga a C 10
export function resolveDebts(balances: MemberBalance[]): DebtEdge[]

export interface MemberBalance {
  member: PlanMember;
  totalPaid: number;    // suma de gastos donde memberId === member.id
  totalOwed: number;    // suma de splits donde memberId === member.id
  netBalance: number;   // totalPaid - totalOwed (positivo = te deben, negativo = debes)
  settledIn: number;    // lo que ya le pagaron
  settledOut: number;   // lo que ya pagó
}

export interface DebtEdge {
  from: PlanMember;
  to: PlanMember;
  amount: number;
}
```

---

## 4. Rediseño del PlanDetailModal

### 4.1 Estructura con tabs

El modal pasa a tener dos tabs principales + una vista de detalle de gasto:

```
PlanDetailModal
├── Header (icono, título, breadcrumbs, botones editar/eliminar)
├── Hero card (presupuesto total / gastado, barra progreso, avatares miembros)
├── Tab bar: [Gastos] [Saldos]
│
├── Tab Gastos
│   ├── Stats bar: "Mis gastos: X" | "Total: Y"
│   ├── FAB "Añadir gasto"
│   └── Lista agrupada por fecha
│       └── ExpenseRow: icono cat + título + "Pagado por X" + monto
│           └── onPress → ExpenseDetailSheet
│
└── Tab Saldos
    ├── Banner situación ("Te deben X" / "Debes X" / "Todo saldado")
    ├── Lista miembros con saldo neto (verde/rojo)
    └── Lista de deudas simplificadas con botón "Saldar"
```

### 4.2 Hero card (siempre visible sobre los tabs)

```
┌─────────────────────────────────────┐
│  🏝️  Viaje a Madrid                  │
│  Presupuesto: €500  ·  Gastado: €320│
│  [████████████░░░] 64%              │
│  [A] [G] +2 miembros               │
└─────────────────────────────────────┘
```

- Icono grande a la izquierda
- Título + descripción
- Barra de progreso presupuesto vs gastado (solo si hay categorías con presupuesto)
- Avatares de miembros en fila

### 4.3 Tab Gastos

**Stats bar** — siempre visible debajo del tab bar:
```
Mis gastos          |    Total del plan
   €120,50          |      €320,00
```

**Lista de gastos** agrupada por fecha (secciones "hoy", "ayer", "lun 12 mayo"...):

```
hoy
┌──────────────────────────────────────┐
│  🍽️  Cena en Casa Lucio             €85,00│
│     Pagado por Alan                  │
└──────────────────────────────────────┘

ayer
┌──────────────────────────────────────┐
│  🏨  Hotel primera noche           €180,00│
│     Pagado por Gabi                  │
└──────────────────────────────────────┘
```

- Al tocar un gasto → sheet de detalle mostrando splits por miembro
- Long press → opciones (editar, eliminar)

### 4.4 Tab Saldos

**Banner superior** (similar al emoji de Tricount, pero en nuestro estilo):
```
┌─────────────────────────────────────┐
│  💚  Todo saldado                   │  ← si netBalance ≈ 0
│  📥  Gabi te debe €45,50            │  ← si te deben
│  📤  Debes €45,50 a Gabi            │  ← si debes
└─────────────────────────────────────┘
```

**Lista de saldos por miembro**:
```
[A]  Alan (Yo)       +€120,50   ← verde
[G]  Gabi            -€80,00    ← rojo
[F]  Fabi            -€40,50    ← rojo
```

**Deudas simplificadas** (resueltas con el algoritmo de resolución):
```
─── Cómo saldar ──────────────────────
Gabi  →  Alan        €80,00   [Saldar]
Fabi  →  Alan        €40,50   [Saldar]
```

El botón "Saldar" abre un mini-sheet para confirmar el monto y la fecha.

---

## 5. Nuevo Formulario de Gasto (`modals/PlanExpenseModal.tsx`)

Formulario dedicado (modal sobre modal o sheet nativo) para añadir/editar un gasto dentro de un plan.

### Secciones del formulario

**1. Título**
```
Título          [Cena en Casa Lucio    ] [😊] [📷]
```
- TextInput para el nombre del gasto
- Opcional: picker de emoji como icono rápido
- Opcional: foto (para el futuro)

**2. Cantidad**
```
Cantidad
[ 85,00                              ] [€ ↕]
```

**3. Quién pagó + Cuándo**
```
Pagado por          Cuando
[ Alan (Yo) ↕ ]    [ 12 may. 2026 ↕ ]
```
- Picker de miembro (scroll horizontal de pills como el existente)
- DatePicker nativo o input de fecha

**4. Categoría (opcional)**
```
Categoría (opcional)
[ 🍽️ Restaurante ↕ ]  ← solo si el plan tiene categorías definidas
```

**5. Dividir**
```
Dividir                    [Igual ↕]  ← selector de modo
```

**Modo Igual** (default):
```
[✓] Alan      €42,50
[✓] Gabi      €42,50
```
- Checkboxes para incluir/excluir miembros
- Monto calculado automáticamente

**Modo Partes** (como Tricount):
```
[✓] Alan      2x    [ − | + ]    €56,67
[✓] Gabi      1x    [ − | + ]    €28,33
```
- Botones − / + para cambiar el multiplicador de partes
- Monto calculado: `(partes_miembro / total_partes) * total`

**Modo Porcentaje**:
```
[✓] Alan      60%   [──────────] €51,00
[✓] Gabi      40%   [────────  ] €34,00
```
- Slider o input numérico de porcentaje
- Validación: suma debe dar 100%

**Botón principal**:
```
[         Añadir gasto          ]  ← purple, full width
```

---

## 6. Sheet de Detalle de Gasto (`ExpenseDetailSheet`)

Al tocar un gasto en la lista, se abre un sheet (bottom sheet o modal pequeño):

```
┌──────────────────────────────────┐
│  🍽️  Cena en Casa Lucio          │
│  Pagado por Alan · 12 may 2026  │
│  ─────────────────────────────  │
│  Total pagado:         €85,00   │
│  ─────────────────────────────  │
│  Cómo se dividió:               │
│  [A] Alan   2 partes   €56,67  │
│  [G] Gabi   1 parte    €28,33  │
│  ─────────────────────────────  │
│  Nota: Reserva con antelación  │
│  ─────────────────────────────  │
│  [  Editar  ]  [  Eliminar  ]  │
└──────────────────────────────────┘
```

---

## 7. Modal de Liquidación (`PlanSettlementModal.tsx`)

Sheet pequeño para registrar un pago entre miembros:

```
┌──────────────────────────────────┐
│  Saldar deuda                    │
│                                  │
│  Gabi paga a Alan               │
│                                  │
│  Monto         [ €80,00       ] │
│  Fecha         [ 12 may 2026  ] │
│  Nota          [ (opcional)   ] │
│                                  │
│  [ Cancelar ]  [ Registrar   ] │
└──────────────────────────────────┘
```

- Pre-rellena el monto de la deuda simplificada
- Permite ajustar el monto (pago parcial)
- Registra como `PlanSettlement` en el store

---

## 8. Rediseño de Tarjetas de Plan en la Lista (`ahorro.tsx`)

### Tarjeta actual
Actualmente los planes se muestran como tarjetas grandes con mucha información. Inspirados en Tricount, simplificamos la lista:

### Nueva tarjeta de plan

```
┌─────────────────────────────────────────┐
│  🏝️              Viaje a Madrid         › │
│              €320 gastados de €500      │
│  [A][G][F]   ████████░░░░  64%         │
│              3 gastos · 2 miembros     │
└─────────────────────────────────────────┘
```

Elementos:
- Icono grande (izquierda)
- Título y descripción
- Avatares de miembros superpuestos
- Barra de progreso compacta si hay presupuesto
- Total gastado / presupuesto total
- Contador de gastos
- Chevron a la derecha
- Sin presupuesto → solo "€X gastados · N gastos"

---

## 9. Rediseño de la Pantalla Lista de Planes (en `ahorro.tsx`, tab "Planes")

### Header
```
┌─────────────────────────────────────────┐
│  Planes                                 │
│  Organiza gastos compartidos de         │
│  viajes, eventos y más                  │
│                                         │
│  Total invertido en planes: €1.240,00  │
└─────────────────────────────────────────┘
```

### Filtros y búsqueda
- Search bar igual al de ahorros
- Pills: [Todos] [Activos] [Saldados]

### Lista
- FlatList de PlanCard rediseñadas
- Empty state con ilustración + texto invitando a crear el primer plan

### FAB
- Botón "Nuevo plan" al estilo actual, centrado abajo

---

## 10. Cambios al Store (`store/useAppStore.ts`)

### Nuevas acciones

```ts
// Expenses
addPlanExpense(planId: number, expense: PlanExpense): void
updatePlanExpense(planId: number, expense: PlanExpense): void
deletePlanExpense(planId: number, expenseId: number): void

// Settlements
addPlanSettlement(planId: number, settlement: PlanSettlement): void
deletePlanSettlement(planId: number, settlementId: number): void

// Plan (ya existentes, confirmar)
addPlan(plan: Plan): void
updatePlan(plan: Plan): void
deletePlan(planId: number): void
addPlanCategory(planId: number, category: PlanCategory): void
updatePlanCategory(planId: number, category: PlanCategory): void
deletePlanCategory(planId: number, categoryId: number): void
```

### Migración de datos
Al cargar el payload, migrar `PlanExpense` viejos que no tengan `splits` ni `title`:
```ts
function migratePlanExpense(exp: any): PlanExpense {
  return {
    ...exp,
    title: exp.note ?? exp.memberName ?? 'Gasto',
    splitMode: exp.splitMode ?? 'equal',
    splits: exp.splits ?? plan.members.map(m => ({
      memberId: m.id,
      amount: exp.amount / plan.members.length,
    })),
  }
}
```

---

## 11. Orden de Implementación

### Sprint 1 — Tipos y utilidades base
1. [ ] Actualizar `types/index.ts`: expandir `PlanExpense`, `Plan`, añadir `PlanSettlement`
2. [ ] Crear `utils/planCalculations.ts`: `computeMemberBalances`, `computeSplits`, `resolveDebts`
3. [ ] Actualizar store: nuevas acciones de settlements y migración
4. [ ] Tests unitarios de `computeSplits` y `resolveDebts`

### Sprint 2 — Formulario de gasto
5. [ ] Crear `modals/PlanExpenseModal.tsx` con los 3 modos de split
6. [ ] Integrar con store y plan

### Sprint 3 — PlanDetailModal rediseñado
7. [ ] Añadir tab bar "Gastos" / "Saldos"
8. [ ] Implementar tab Gastos: stats bar + lista agrupada por fecha
9. [ ] Implementar `ExpenseDetailSheet`
10. [ ] Implementar tab Saldos: banner situación + lista miembros + deudas simplificadas

### Sprint 4 — Liquidaciones
11. [ ] Crear `modals/PlanSettlementModal.tsx`
12. [ ] Integrar botón "Saldar" en tab Saldos
13. [ ] Reflejar settlements en cálculo de balances

### Sprint 5 — Rediseño visual
14. [ ] Rediseñar `PlanCard` en lista de planes
15. [ ] Rediseñar header de pantalla de planes
16. [ ] Pills de filtrado (Todos / Activos / Saldados)
17. [ ] Animaciones de entrada coherentes con el resto de la app

---

## 12. Consideraciones de UX / Diseño

### Paleta y tipografía
- Acento principal de planes: `#7C3AED` (morado, ya establecido como `PLAN_ACCENT`)
- Fondo de iconos: `#EDE9FE` (`PLAN_BG`)
- Saldo positivo (te deben): `#059669`
- Saldo negativo (debes): `APP_COLORS.expense`
- Fuente de montos grandes: `DMSerifDisplay_400Regular`
- Fuente de labels: `Inter_700Bold` / `Inter_600SemiBold`

### Interacciones
- Tab bar animado con underline deslizante (Animated.Value)
- Stats bar se sticky debajo del tab bar al hacer scroll
- Expense rows: press feedback con `opacity: 0.72`
- Sheet de detalle con spring animation (ya establecido en el resto de la app)
- FAB "Añadir gasto" aparece / desaparece con scroll (como en movimientos)

### Vacío / estados especiales
- Plan sin gastos → empty state en tab Gastos con icono `receipt-outline`
- Plan con todos los saldos en cero → banner verde "Todo saldado 🎉"
- Plan con presupuesto agotado → barra roja con "Presupuesto superado"

### Diferencias respecto a Tricount (adaptaciones a nuestro nicho)
| Tricount | Nosotros |
|---|---|
| Grupos de cualquier tamaño | Optimizado para 2–5 personas |
| Foto de recibo | No (por ahora) |
| Emoji picker en gasto | Selector de categoría del plan |
| Moneda por gasto | Moneda global de la app |
| "Nuevo tricount" siempre visible | FAB contextual por modo (ahorros / planes) |
| Sin presupuesto | Presupuesto por categoría dentro del plan |
| Sin integración bancaria | Integración con movimientos existentes (futuro) |

---

## 13. Funcionalidades Futuras (fuera de este sprint)

- **Vincular movimientos existentes a un plan**: al registrar un gasto en Movimientos, asignarlo a un Plan activo.
- **Fotos de recibos**: OCR para extraer el monto automáticamente.
- **Notificaciones**: recordatorio cuando un plan tiene deudas pendientes.
- **Exportar plan**: generar un resumen PDF del plan para compartir.
- **Templates de plan**: "Viaje", "Cena grupal", "Mudanza" con categorías pre-definidas.
- **Historial de liquidaciones**: timeline de quién pagó a quién.

---

*Generado: 12 mayo 2026*
