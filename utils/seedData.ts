import type {
  AppPayload,
  BudgetCategory,
  Plan,
  PlanCategory,
  PlanExpense,
  PlanMember,
  SavingPlan,
  Transaction,
} from '../types';

export function buildSeedPayload(
  userAId: string,
  userBId: string,
  userAName: string,
  userBName: string,
): AppPayload {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  let _seq = 9000;
  const nid = () => ++_seq;

  // Local YYYY-MM-DD, avoids UTC timezone shift
  const date = (monthsAgo: number, day: number): string => {
    const dt = new Date(year, month - monthsAgo, day);
    const y  = dt.getFullYear();
    const m  = String(dt.getMonth() + 1).padStart(2, '0');
    const d  = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const ym = (monthsAgo: number): string => {
    const dt = new Date(year, month - monthsAgo, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };

  const ym0 = ym(0);
  const ym1 = ym(1);
  const ym2 = ym(2);

  const paidPast   = { [ym2]: true, [ym1]: true } as Record<string, boolean>;
  const paidAtPast = { [ym2]: date(2, 2), [ym1]: date(1, 2) } as Record<string, string>;
  const paidAll    = { ...paidPast, [ym0]: true };
  const paidAtAll  = { ...paidAtPast, [ym0]: date(0, 2) };

  // ─── Budget categories — IDs generados primero para poder referenciarlos ──

  const catAlimentacionId = nid();
  const catHogarId        = nid();
  const catTransporteId   = nid();
  const catSaludId        = nid();
  const catOcioId         = nid();
  const catComprasId      = nid();

  const budgetCategories: BudgetCategory[] = [
    { id: catAlimentacionId, name: 'Alimentación',          icon: 'groceries',     iconColor: 'green',  monthlyBudget: 500 },
    { id: catHogarId,        name: 'Hogar y Servicios',     icon: 'home',          iconColor: 'purple', monthlyBudget: 1050 },
    { id: catTransporteId,   name: 'Transporte',            icon: 'transport',     iconColor: 'blue',   monthlyBudget: 120 },
    { id: catSaludId,        name: 'Salud y Bienestar',     icon: 'health',        iconColor: 'teal',   monthlyBudget: 100 },
    { id: catOcioId,         name: 'Ocio y Entretenimiento', icon: 'entertainment', iconColor: 'indigo', monthlyBudget: 180 },
    { id: catComprasId,      name: 'Compras y Ropa',        icon: 'shopping',      iconColor: 'rose',   monthlyBudget: 150 },
  ];

  // ─── Transactions ──────────────────────────────────────────────────────────

  const expenses: Transaction[] = [
    // Ingresos mensuales (sin categoría de presupuesto — son ingresos)
    {
      id: nid(), uid: userAId, cat: 'savings', iconColor: 'green',
      desc: 'Salario', account: 'Cuenta nómina',
      amt: 1800, date: date(2, 1), type: 'monthly', kind: 'income', notes: '', paid: paidPast, paidAt: paidAtPast,
    },
    {
      id: nid(), uid: userBId, cat: 'savings', iconColor: 'teal',
      desc: 'Salario', account: 'Cuenta nómina',
      amt: 1500, date: date(2, 1), type: 'monthly', kind: 'income', notes: '', paid: paidPast, paidAt: paidAtPast,
    },
    {
      id: nid(), uid: userAId, cat: 'tech', iconColor: 'blue',
      desc: 'Proyecto freelance', account: 'Cuenta personal',
      amt: 350, date: date(1, 18), type: 'once', kind: 'income', notes: '',
    },

    // Hogar y Servicios
    {
      id: nid(), uid: userAId, cat: 'rent', iconColor: 'purple',
      desc: 'Renta apartamento', account: 'Cuenta personal',
      amt: 850, date: date(2, 1), type: 'monthly', kind: 'expense', notes: '', paid: paidPast, paidAt: paidAtPast,
      budgetCatId: catHogarId,
    },
    {
      id: nid(), uid: userAId, cat: 'utilities', iconColor: 'amber',
      desc: 'Luz y agua', account: 'Cuenta personal',
      amt: 78, date: date(2, 5), type: 'monthly', kind: 'expense', notes: '', paid: paidAll, paidAt: paidAtAll,
      budgetCatId: catHogarId,
    },
    {
      id: nid(), uid: userAId, cat: 'wifi', iconColor: 'sky',
      desc: 'Internet en casa', account: 'Cuenta personal',
      amt: 35, date: date(2, 5), type: 'monthly', kind: 'expense', notes: '', paid: paidAll, paidAt: paidAtAll,
      budgetCatId: catHogarId,
    },
    {
      id: nid(), uid: userAId, cat: 'phone', iconColor: 'indigo',
      desc: 'Plan celular', account: 'Cuenta personal',
      amt: 25, date: date(2, 5), type: 'monthly', kind: 'expense', notes: '', paid: paidAll, paidAt: paidAtAll,
      budgetCatId: catHogarId,
    },

    // Ocio y Entretenimiento
    {
      id: nid(), uid: userBId, cat: 'music', iconColor: 'green',
      desc: 'Spotify Duo', account: 'Tarjeta',
      amt: 13.99, date: date(2, 10), type: 'monthly', kind: 'expense', notes: '', paid: paidAll, paidAt: paidAtAll,
      budgetCatId: catOcioId,
    },
    {
      id: nid(), uid: userBId, cat: 'entertainment', iconColor: 'red',
      desc: 'Netflix', account: 'Tarjeta',
      amt: 17.99, date: date(2, 10), type: 'monthly', kind: 'expense', notes: '', paid: paidAll, paidAt: paidAtAll,
      budgetCatId: catOcioId,
    },

    // Salud y Bienestar
    {
      id: nid(), uid: userAId, cat: 'gym', iconColor: 'orange',
      desc: 'Membresía gimnasio', account: 'Tarjeta',
      amt: 30, date: date(2, 8), type: 'monthly', kind: 'expense', notes: '', paid: paidAll, paidAt: paidAtAll,
      budgetCatId: catSaludId,
    },
    {
      id: nid(), uid: userBId, cat: 'gym', iconColor: 'pink',
      desc: 'Membresía gimnasio', account: 'Tarjeta',
      amt: 30, date: date(2, 8), type: 'monthly', kind: 'expense', notes: '', paid: paidAll, paidAt: paidAtAll,
      budgetCatId: catSaludId,
    },

    // Gastos únicos — hace 2 meses
    {
      id: nid(), uid: userAId, cat: 'groceries', iconColor: 'lime',
      desc: 'Supermercado', account: 'Tarjeta',
      amt: 148, date: date(2, 14), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catAlimentacionId,
    },
    {
      id: nid(), uid: userBId, cat: 'restaurant', iconColor: 'amber',
      desc: 'Cena romántica', account: 'Tarjeta',
      amt: 72, date: date(2, 16), type: 'once', kind: 'expense', notes: 'Aniversario',
      budgetCatId: catAlimentacionId,
    },
    {
      id: nid(), uid: userAId, cat: 'coffee', iconColor: 'amber',
      desc: 'Cafés de la semana', account: 'Efectivo',
      amt: 18, date: date(2, 20), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catAlimentacionId,
    },
    {
      id: nid(), uid: userBId, cat: 'pharmacy', iconColor: 'teal',
      desc: 'Farmacia', account: 'Efectivo',
      amt: 32, date: date(2, 22), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catSaludId,
    },
    {
      id: nid(), uid: userBId, cat: 'clothing', iconColor: 'purple',
      desc: 'Ropa primavera', account: 'Tarjeta',
      amt: 95, date: date(2, 25), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catComprasId,
    },
    {
      id: nid(), uid: userAId, cat: 'transport', iconColor: 'blue',
      desc: 'Transporte', account: 'Efectivo',
      amt: 22, date: date(2, 27), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catTransporteId,
    },

    // Gastos únicos — mes pasado
    {
      id: nid(), uid: userBId, cat: 'groceries', iconColor: 'green',
      desc: 'Supermercado', account: 'Tarjeta',
      amt: 162, date: date(1, 6), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catAlimentacionId,
    },
    {
      id: nid(), uid: userAId, cat: 'restaurant', iconColor: 'orange',
      desc: 'Restaurante con amigos', account: 'Tarjeta',
      amt: 85, date: date(1, 12), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catAlimentacionId,
    },
    {
      id: nid(), uid: userAId, cat: 'coffee', iconColor: 'amber',
      desc: 'Cafés', account: 'Efectivo',
      amt: 24, date: date(1, 15), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catAlimentacionId,
    },
    {
      id: nid(), uid: userBId, cat: 'entertainment', iconColor: 'indigo',
      desc: 'Cine', account: 'Tarjeta',
      amt: 28, date: date(1, 19), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catOcioId,
    },
    {
      id: nid(), uid: userAId, cat: 'shopping', iconColor: 'blue',
      desc: 'Amazon – varios', account: 'Tarjeta',
      amt: 67, date: date(1, 21), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catComprasId,
    },
    {
      id: nid(), uid: userAId, cat: 'car', iconColor: 'slate',
      desc: 'Gasolina', account: 'Tarjeta',
      amt: 55, date: date(1, 24), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catTransporteId,
    },
    {
      id: nid(), uid: userBId, cat: 'events', iconColor: 'rose',
      desc: 'Regalo cumpleaños amiga', account: 'Efectivo',
      amt: 45, date: date(1, 28), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catOcioId,
    },
    {
      id: nid(), uid: userAId, cat: 'groceries', iconColor: 'lime',
      desc: 'Supermercado', account: 'Tarjeta',
      amt: 88, date: date(1, 28), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catAlimentacionId,
    },

    // Gastos únicos — mes actual
    {
      id: nid(), uid: userAId, cat: 'groceries', iconColor: 'green',
      desc: 'Supermercado', account: 'Tarjeta',
      amt: 78, date: date(0, 3), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catAlimentacionId,
    },
    {
      id: nid(), uid: userBId, cat: 'coffee', iconColor: 'amber',
      desc: 'Café', account: 'Efectivo',
      amt: 11, date: date(0, 8), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catAlimentacionId,
    },
    {
      id: nid(), uid: userAId, cat: 'restaurant', iconColor: 'orange',
      desc: 'Almuerzo trabajo', account: 'Tarjeta',
      amt: 58, date: date(0, 10), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catAlimentacionId,
    },
    {
      id: nid(), uid: userBId, cat: 'subscriptions', iconColor: 'indigo',
      desc: 'Adobe Creative Cloud', account: 'Tarjeta',
      amt: 24.99, date: date(0, 12), type: 'once', kind: 'expense', notes: '',
      budgetCatId: catOcioId,
    },
  ];

  // ─── Saving plans ──────────────────────────────────────────────────────────

  const savings: SavingPlan[] = [
    {
      id: nid(), type: 'joint', icon: 'travel', iconColor: 'sky',
      title: 'Vacaciones en Grecia', targetAmount: 3000, months: 12,
      date: date(4, 1), notes: 'Planificando para el verano del próximo año',
      history: [
        { id: nid(), uid: userAId, amount: 150, date: date(4, 5), note: 'Aportación inicial' },
        { id: nid(), uid: userBId, amount: 150, date: date(4, 5) },
        { id: nid(), uid: userAId, amount: 150, date: date(3, 5) },
        { id: nid(), uid: userBId, amount: 150, date: date(3, 5) },
        { id: nid(), uid: userAId, amount: 150, date: date(2, 5) },
        { id: nid(), uid: userBId, amount: 150, date: date(2, 5) },
        { id: nid(), uid: userAId, amount: 150, date: date(1, 5) },
        { id: nid(), uid: userBId, amount: 150, date: date(1, 5) },
      ],
    },
    {
      id: nid(), type: 'joint', icon: 'savings', iconColor: 'green',
      title: 'Fondo de emergencia', targetAmount: 6000,
      date: date(6, 1), notes: 'Meta: 3 meses de gastos fijos',
      history: [
        { id: nid(), uid: userAId, amount: 200, date: date(5, 10) },
        { id: nid(), uid: userBId, amount: 200, date: date(5, 10) },
        { id: nid(), uid: userAId, amount: 250, date: date(4, 10) },
        { id: nid(), uid: userBId, amount: 150, date: date(4, 10) },
        { id: nid(), uid: userAId, amount: 200, date: date(3, 10) },
        { id: nid(), uid: userBId, amount: 200, date: date(3, 10) },
        { id: nid(), uid: userAId, amount: 250, date: date(2, 10) },
        { id: nid(), uid: userBId, amount: 200, date: date(2, 10) },
        { id: nid(), uid: userAId, amount: 200, date: date(1, 10) },
        { id: nid(), uid: userBId, amount: 200, date: date(1, 10) },
      ],
    },
    {
      id: nid(), type: 'personal', uid: userAId, icon: 'laptop', iconColor: 'blue',
      title: 'Laptop nueva', targetAmount: 1400, months: 6,
      date: date(2, 1), notes: 'MacBook Pro',
      history: [
        { id: nid(), uid: userAId, amount: 230, date: date(2, 15), note: 'Primer aporte' },
        { id: nid(), uid: userAId, amount: 230, date: date(1, 15) },
        { id: nid(), uid: userAId, amount: 230, date: date(0, 14) },
      ],
    },
  ];

  // ─── Plans ─────────────────────────────────────────────────────────────────

  const memberA: PlanMember = {
    id: userAId, uid: userAId, name: userAName,
    initials: userAName.slice(0, 2).toUpperCase(),
    color: '#7C3AED', bg: '#EDE9FE',
  };
  const memberB: PlanMember = {
    id: userBId, uid: userBId, name: userBName,
    initials: userBName.slice(0, 2).toUpperCase(),
    color: '#E11D48', bg: '#FFE4E6',
  };
  const memberCarlos: PlanMember = {
    id: 'm_seed_carlos', name: 'Carlos',
    initials: 'CA', color: '#059669', bg: '#D1FAE5',
  };
  const memberLaura: PlanMember = {
    id: 'm_seed_laura', name: 'Laura',
    initials: 'LA', color: '#F59E0B', bg: '#FEF3C7',
  };

  const dinnerFoodCatId   = nid();
  const dinnerDrinksCatId = nid();
  const tripTransCatId    = nid();
  const tripHotelCatId    = nid();
  const tripFoodCatId     = nid();

  const dinnerFoodCat: PlanCategory   = { id: dinnerFoodCatId,   name: 'Comida',      icon: 'restaurant', totalAmount: 165 };
  const dinnerDrinksCat: PlanCategory = { id: dinnerDrinksCatId, name: 'Bebidas',      icon: 'drinks',     totalAmount: 68 };
  const tripTransCat: PlanCategory    = { id: tripTransCatId,    name: 'Transporte',  icon: 'car',        totalAmount: 120 };
  const tripHotelCat: PlanCategory    = { id: tripHotelCatId,    name: 'Alojamiento', icon: 'hotel',      totalAmount: 270 };
  const tripFoodCat: PlanCategory     = { id: tripFoodCatId,     name: 'Comida',      icon: 'food',       totalAmount: 95 };

  const dinner: Plan = {
    id: nid(),
    title: 'Cena de cumpleaños',
    icon: 'restaurant',
    iconColor: 'rose',
    description: 'Cena para celebrar el cumpleaños',
    date: date(0, 8),
    splitMode: 'equal',
    members: [memberA, memberB, memberCarlos, memberLaura],
    categories: [dinnerFoodCat, dinnerDrinksCat],
    expenses: [
      {
        id: nid(), categoryId: dinnerFoodCatId,
        memberId: userAId, memberName: userAName,
        title: 'Cena principal', amount: 165, date: date(0, 8),
        splitMode: 'equal',
        splits: [
          { memberId: userAId,         amount: 41.25 },
          { memberId: userBId,         amount: 41.25 },
          { memberId: 'm_seed_carlos', amount: 41.25 },
          { memberId: 'm_seed_laura',  amount: 41.25 },
        ],
      } as PlanExpense,
      {
        id: nid(), categoryId: dinnerDrinksCatId,
        memberId: userBId, memberName: userBName,
        title: 'Bebidas y postres', amount: 68, date: date(0, 8),
        splitMode: 'equal',
        splits: [
          { memberId: userAId,         amount: 17 },
          { memberId: userBId,         amount: 17 },
          { memberId: 'm_seed_carlos', amount: 17 },
          { memberId: 'm_seed_laura',  amount: 17 },
        ],
      } as PlanExpense,
    ],
    settlements: [],
  };

  const beach: Plan = {
    id: nid(),
    title: 'Fin de semana en la playa',
    icon: 'map',
    iconColor: 'sky',
    description: 'Escapada de tres días',
    date: date(1, 15),
    splitMode: 'equal',
    members: [memberA, memberB, memberCarlos],
    categories: [tripTransCat, tripHotelCat, tripFoodCat],
    expenses: [
      {
        id: nid(), categoryId: tripTransCatId,
        memberId: userAId, memberName: userAName,
        title: 'Gasolina ida y vuelta', amount: 120, date: date(1, 15),
        splitMode: 'equal',
        splits: [
          { memberId: userAId,         amount: 40 },
          { memberId: userBId,         amount: 40 },
          { memberId: 'm_seed_carlos', amount: 40 },
        ],
      } as PlanExpense,
      {
        id: nid(), categoryId: tripHotelCatId,
        memberId: 'm_seed_carlos', memberName: 'Carlos',
        title: 'Casa de alquiler', amount: 270, date: date(1, 16),
        splitMode: 'equal',
        splits: [
          { memberId: userAId,         amount: 90 },
          { memberId: userBId,         amount: 90 },
          { memberId: 'm_seed_carlos', amount: 90 },
        ],
      } as PlanExpense,
      {
        id: nid(), categoryId: tripFoodCatId,
        memberId: userBId, memberName: userBName,
        title: 'Supermercado del fin de semana', amount: 95, date: date(1, 17),
        splitMode: 'equal',
        splits: [
          { memberId: userAId,         amount: 31.67 },
          { memberId: userBId,         amount: 31.67 },
          { memberId: 'm_seed_carlos', amount: 31.66 },
        ],
      } as PlanExpense,
    ],
    settlements: [
      { id: nid(), fromMemberId: userAId, toMemberId: 'm_seed_carlos', amount: 50, date: date(0, 2), note: 'Parte de la casa' },
      { id: nid(), fromMemberId: userBId, toMemberId: 'm_seed_carlos', amount: 50, date: date(0, 2), note: 'Parte de la casa' },
    ],
  };

  return {
    expenses,
    savings,
    goals: [],
    contribs: [],
    budgetCategories,
    plans: [dinner, beach],
  };
}
