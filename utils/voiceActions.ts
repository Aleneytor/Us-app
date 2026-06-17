import { CATEGORIES } from '../constants/categories';
import { getDefaultColorForGroup, getCategoryGroupForKey } from '../constants/categories';
import type {
  AppPayload,
  BudgetCategory,
  Plan,
  PlanMember,
  SavingPlan,
  Transaction,
  UserData,
  UserId,
} from '../types';
import { MEMBER_COLORS } from '../types';
import { todayStr } from './format';
import { getPartnerId, getUserData } from './users';

export type VoiceActionType = 'transaction' | 'budgetCategory' | 'savingPlan' | 'plan' | 'unknown';

export interface VoiceActionContext {
  payload: AppPayload;
  currentUser: UserId;
  users: Record<string, UserData>;
  partnerForUser: Record<string, string>;
}

interface BaseParsedAction<TType extends VoiceActionType> {
  type: TType;
  transcript: string;
  summary: string;
  confidence: number;
  missing: string[];
}

export interface ParsedTransactionAction extends BaseParsedAction<'transaction'> {
  kind: Transaction['kind'];
  title: string;
  amount: number;
  date: string;
  frequency: Transaction['type'];
  categoryKey: string;
  iconColor: string;
  budgetCatId?: number;
}

export interface ParsedBudgetCategoryAction extends BaseParsedAction<'budgetCategory'> {
  name: string;
  amount: number;
  icon: string;
  iconColor: string;
  personal: boolean;
}

export interface ParsedSavingPlanAction extends BaseParsedAction<'savingPlan'> {
  title: string;
  amount: number;
  months?: number;
  planType: 'joint' | 'personal';
  icon: string;
  iconColor: string;
}

export interface ParsedPlanAction extends BaseParsedAction<'plan'> {
  title: string;
  description?: string;
  memberNames: string[];
  includePartner: boolean;
  icon: string;
  iconColor: string;
}

export type UnknownVoiceAction = BaseParsedAction<'unknown'>;

export type ParsedVoiceAction =
  | ParsedTransactionAction
  | ParsedBudgetCategoryAction
  | ParsedSavingPlanAction
  | ParsedPlanAction
  | UnknownVoiceAction;

interface AmountCandidate {
  amount: number;
  index: number;
  length: number;
  score: number;
}

const ACTION_WORDS = [
  'agrega',
  'agregar',
  'anade',
  'crear',
  'crea',
  'gasto',
  'gaste',
  'guarda',
  'guardar',
  'ingreso',
  'nuevo',
  'nueva',
  'pague',
  'registrar',
  'registra',
];

const TRANSACTION_EXPENSE_WORDS = [
  'compra',
  'compre',
  'gasta',
  'gaste',
  'gasto',
  'paga',
  'pague',
  'pago',
  'salida',
];

const TRANSACTION_INCOME_WORDS = [
  'abono',
  'cobre',
  'cobro',
  'deposito',
  'entrada',
  'ingresa',
  'ingrese',
  'ingreso',
  'me pagaron',
  'nomina',
  'sueldo',
  'salario',
];

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  restaurant: ['restaurante', 'restaurantes', 'cena', 'almuerzo', 'comer fuera'],
  groceries: ['mercado', 'super', 'supermercado', 'compras del super'],
  coffee: ['cafe', 'cafeteria'],
  fastfood: ['hamburguesa', 'fast food', 'comida rapida'],
  drinks: ['bebida', 'bebidas', 'bar'],
  food: ['comida', 'delivery', 'comer'],
  travel: ['viaje', 'viajes', 'vuelo', 'vuelos'],
  hotel: ['hotel', 'hospedaje'],
  transport: ['transporte', 'uber', 'taxi', 'bus', 'metro'],
  car: ['carro', 'auto', 'coche', 'gasolina', 'combustible'],
  health: ['salud', 'medico', 'doctor'],
  pharmacy: ['farmacia', 'medicina', 'medicinas'],
  gym: ['gym', 'gimnasio'],
  clothing: ['ropa', 'camisa', 'pantalon'],
  beauty: ['belleza', 'peluqueria', 'unas'],
  shopping: ['compras', 'shopping', 'tienda'],
  home: ['casa', 'hogar'],
  rent: ['renta', 'alquiler', 'arriendo'],
  utilities: ['servicios', 'luz', 'agua', 'electricidad'],
  wifi: ['internet', 'wifi'],
  phone: ['telefono', 'celular', 'movil'],
  tech: ['tecnologia', 'electronica'],
  subscriptions: ['suscripcion', 'suscripciones', 'netflix', 'spotify'],
  education: ['escuela', 'universidad', 'curso', 'educacion'],
  salary: ['sueldo', 'nomina', 'salario'],
  freelance: ['freelance', 'cliente'],
  pets: ['mascota', 'mascotas', 'perro', 'gato', 'veterinario', 'animales'],
  other: ['otro', 'varios'],
};

const UNIT_WORDS: Record<string, number> = {
  cero: 0,
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};

const TENS_WORDS: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

const HUNDRED_WORDS: Record<string, number> = {
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
};

export function getVoiceContextualStrings(context: VoiceActionContext): string[] {
  const budgetNames = (context.payload.budgetCategories ?? []).map((category) => category.name);
  const userNames = Object.values(context.users).map((user) => user.name);
  const categoryLabels = Object.values(CATEGORIES).map((category) => category.label);

  return Array.from(new Set([
    ...ACTION_WORDS,
    ...TRANSACTION_EXPENSE_WORDS,
    ...TRANSACTION_INCOME_WORDS,
    'ahorro',
    'ahorrar',
    'categoria',
    'presupuesto',
    'plan',
    'movimiento',
    'gasto',
    'ingreso',
    ...budgetNames,
    ...userNames,
    ...categoryLabels,
  ])).slice(0, 120);
}

export function parseVoiceAction(transcript: string, context: VoiceActionContext): ParsedVoiceAction {
  const clean = normalizeText(transcript);
  if (!clean) return unknownAction(transcript, ['texto']);

  const intent = detectIntent(clean);
  if (intent === 'budgetCategory') return parseBudgetCategory(transcript, clean);
  if (intent === 'savingPlan') return parseSavingPlan(transcript, clean);
  if (intent === 'plan') return parsePlan(transcript, clean, context);
  if (intent === 'transaction') return parseTransaction(transcript, clean, context);

  return unknownAction(transcript, ['intencion']);
}

export function buildVoiceActionRecord(
  action: ParsedVoiceAction,
  context: VoiceActionContext,
  seed = Date.now(),
): Transaction | BudgetCategory | SavingPlan | Plan | null {
  if (action.type === 'transaction') {
    return {
      id: seed,
      uid: context.currentUser,
      cat: action.categoryKey,
      iconColor: action.iconColor,
      desc: action.title,
      account: '',
      amt: action.amount,
      date: action.date,
      type: action.frequency,
      kind: action.kind,
      notes: voiceNote(action.transcript),
      budgetCatId: action.budgetCatId,
    };
  }

  if (action.type === 'budgetCategory') {
    return {
      id: seed,
      name: action.name,
      icon: action.icon,
      iconColor: action.iconColor,
      monthlyBudget: action.amount,
      uid: action.personal ? context.currentUser : undefined,
      notes: voiceNote(action.transcript),
    };
  }

  if (action.type === 'savingPlan') {
    return {
      id: seed,
      type: action.planType,
      uid: action.planType === 'personal' ? context.currentUser : undefined,
      icon: action.icon,
      iconColor: action.iconColor,
      title: action.title,
      targetAmount: action.amount,
      months: action.months,
      notes: voiceNote(action.transcript),
      date: todayStr(),
      history: [],
    };
  }

  if (action.type === 'plan') {
    return {
      id: seed,
      title: action.title,
      icon: action.icon,
      iconColor: action.iconColor,
      description: action.description || voiceNote(action.transcript),
      date: todayStr(),
      members: buildPlanMembers(action, context),
      categories: [],
      expenses: [],
      settlements: [],
      splitMode: 'equal',
    };
  }

  return null;
}

export function getVoiceActionReady(action: ParsedVoiceAction): boolean {
  return action.type !== 'unknown' && action.missing.length === 0;
}

function parseTransaction(
  transcript: string,
  clean: string,
  context: VoiceActionContext,
): ParsedTransactionAction {
  const amount = findBestAmount(clean);
  const kind = includesAny(clean, TRANSACTION_INCOME_WORDS) && !includesAny(clean, ['pague', 'pago'])
    ? 'income'
    : 'expense';
  const frequency = detectFrequency(clean, kind);
  const date = detectDate(clean);
  const categoryMatch = matchCategory(clean, context);
  const title = extractTransactionTitle(clean, amount, categoryMatch.name);
  const missing = [
    !title ? 'título' : '',
    !amount ? 'monto' : '',
  ].filter(Boolean);
  const summary = amount
    ? `${kind === 'income' ? 'Ingreso' : 'Gasto'}: ${title || 'sin título'} por ${amount.amount}`
    : `${kind === 'income' ? 'Ingreso' : 'Gasto'} detectado`;

  return {
    type: 'transaction',
    transcript,
    summary,
    confidence: confidenceScore(0.58, missing, [amount?.score ?? 0, categoryMatch.score]),
    missing,
    kind,
    title: title || categoryMatch.name || 'Movimiento',
    amount: amount?.amount ?? 0,
    date,
    frequency,
    categoryKey: categoryMatch.key,
    iconColor: categoryMatch.iconColor,
    budgetCatId: categoryMatch.budgetCatId,
  };
}

function parseBudgetCategory(transcript: string, clean: string): ParsedBudgetCategoryAction {
  const amount = findAmountNear(clean, ['presupuesto', 'limite', 'mensual', 'de']) ?? findBestAmount(clean);
  const name = extractAfterKeywords(clean, ['categoria', 'rubro'], ['con', 'presupuesto', 'limite', 'mensual', 'de']) ||
    extractAfterKeywords(clean, ['crear', 'crea', 'nueva', 'nuevo'], ['con', 'presupuesto', 'limite', 'mensual']) ||
    '';
  const category = matchCatalogCategory(name || clean);
  const personal = includesAny(clean, ['solo yo', 'personal', 'mio', 'mia']);
  const missing = [!name ? 'nombre' : ''].filter(Boolean);

  return {
    type: 'budgetCategory',
    transcript,
    summary: `Categoría: ${titleCase(name || category.name)}${amount ? ` con ${amount.amount}` : ''}`,
    confidence: confidenceScore(0.64, missing, [amount?.score ?? 0, category.score]),
    missing,
    name: titleCase(name || category.name || 'Categoría'),
    amount: amount?.amount ?? 0,
    icon: category.key,
    iconColor: category.iconColor,
    personal,
  };
}

function parseSavingPlan(transcript: string, clean: string): ParsedSavingPlanAction {
  const amount = findBestAmount(clean);
  const months = findMonths(clean);
  const title = extractSavingTitle(clean, amount);
  const category = matchCatalogCategory(title || clean, 'savings');
  const planType = includesAny(clean, ['juntos', 'conjunto', 'ambos', 'pareja']) ? 'joint' : 'personal';
  const missing = [
    !title ? 'título' : '',
    !amount ? 'monto' : '',
  ].filter(Boolean);

  return {
    type: 'savingPlan',
    transcript,
    summary: `Ahorro: ${title || 'sin título'}${amount ? ` por ${amount.amount}` : ''}`,
    confidence: confidenceScore(0.62, missing, [amount?.score ?? 0, months ? 0.12 : 0, category.score]),
    missing,
    title: titleCase(title || 'Ahorro'),
    amount: amount?.amount ?? 0,
    months,
    planType,
    icon: category.key,
    iconColor: category.iconColor,
  };
}

function parsePlan(transcript: string, clean: string, context: VoiceActionContext): ParsedPlanAction {
  const title = extractPlanTitle(clean);
  const memberNames = extractPlanMemberNames(clean, context);
  const includePartner = shouldIncludePartner(clean, context);
  const category = matchCatalogCategory(title || clean, 'map');
  const missing = [!title ? 'título' : ''].filter(Boolean);

  return {
    type: 'plan',
    transcript,
    summary: `Plan: ${title || 'sin título'}`,
    confidence: confidenceScore(0.6, missing, [memberNames.length ? 0.12 : 0, includePartner ? 0.1 : 0]),
    missing,
    title: titleCase(title || 'Plan'),
    description: voiceNote(transcript),
    memberNames,
    includePartner,
    icon: category.key,
    iconColor: category.iconColor,
  };
}

function detectIntent(clean: string): VoiceActionType {
  if (includesAny(clean, ['categoria', 'rubro', 'presupuesto mensual'])) return 'budgetCategory';
  if (includesAny(clean, ['ahorro', 'ahorrar', 'meta de ahorro', 'guardar dinero'])) return 'savingPlan';
  if (includesAny(clean, ['crear plan', 'crea plan', 'nuevo plan', 'nueva salida', 'viaje con'])) return 'plan';
  if (includesAny(clean, [...TRANSACTION_EXPENSE_WORDS, ...TRANSACTION_INCOME_WORDS, 'movimiento'])) return 'transaction';
  if (findBestAmount(clean)) return 'transaction';
  return 'unknown';
}

function findBestAmount(clean: string): AmountCandidate | null {
  const candidates = findAmountCandidates(clean);
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.score - a.score || b.amount - a.amount)[0];
}

function findAmountNear(clean: string, keywords: string[]): AmountCandidate | null {
  return findAmountCandidates(clean)
    .map((candidate) => ({
      ...candidate,
      score: candidate.score + (keywords.some((word) => clean.slice(Math.max(0, candidate.index - 24), candidate.index).includes(word)) ? 0.4 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0] ?? null;
}

function findAmountCandidates(clean: string): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  const numeric = /(?:^|\s)(?:eur|euro|euros|usd|dolar|dolares|\$|€|bs\.?|cop)?\s*(\d+(?:[.,]\d+)?)\s*(?:eur|euro|euros|usd|dolar|dolares|\$|€|bs\.?|cop)?(?=\s|$)/g;
  let match: RegExpExecArray | null;

  while ((match = numeric.exec(clean))) {
    const raw = match[1];
    const amount = parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const index = match.index + match[0].indexOf(raw);
    const nearby = clean.slice(Math.max(0, index - 18), index + raw.length + 18);
    const monthPenalty = /\b(mes|meses|dia|dias|ano|anos)\b/.test(nearby) ? -0.45 : 0;
    const moneyBoost = /\b(euro|euros|eur|dolar|dolares|usd|bs|cop)\b|[$€]/.test(nearby) ? 0.28 : 0;
    const budgetBoost = /\b(de|por|presupuesto|limite|monto|meta|objetivo|ahorrar)\b/.test(nearby) ? 0.18 : 0;
    candidates.push({ amount, index, length: raw.length, score: 0.5 + moneyBoost + budgetBoost + monthPenalty });
  }

  const tokens = clean.split(/\s+/);
  for (let start = 0; start < tokens.length; start += 1) {
    for (let size = 1; size <= 6 && start + size <= tokens.length; size += 1) {
      const words = tokens.slice(start, start + size);
      const amount = parseNumberWords(words);
      if (!amount || amount <= 0) continue;
      const before = tokens.slice(Math.max(0, start - 3), start).join(' ');
      const after = tokens.slice(start + size, start + size + 3).join(' ');
      const score = 0.44 +
        (/\b(euros?|dolares?|pesos?|bolivares?)\b/.test(after) ? 0.28 : 0) +
        (/\b(de|por|presupuesto|limite|monto|meta|objetivo|ahorrar)\b/.test(before) ? 0.16 : 0) -
        (/\b(mes|meses|dias?|anos?)\b/.test(after) ? 0.35 : 0);
      candidates.push({
        amount,
        index: clean.indexOf(words.join(' ')),
        length: words.join(' ').length,
        score,
      });
    }
  }

  return candidates.filter((candidate) => candidate.score > 0.2);
}

function parseNumberWords(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let consumed = false;

  for (const word of words) {
    if (word === 'y') continue;
    if (UNIT_WORDS[word] !== undefined) {
      current += UNIT_WORDS[word];
      consumed = true;
      continue;
    }
    if (TENS_WORDS[word] !== undefined) {
      current += TENS_WORDS[word];
      consumed = true;
      continue;
    }
    if (HUNDRED_WORDS[word] !== undefined) {
      current += HUNDRED_WORDS[word];
      consumed = true;
      continue;
    }
    if (word === 'mil') {
      total += (current || 1) * 1000;
      current = 0;
      consumed = true;
      continue;
    }
    return null;
  }

  return consumed ? total + current : null;
}

function matchCategory(clean: string, context: VoiceActionContext): {
  key: string;
  name: string;
  iconColor: string;
  budgetCatId?: number;
  score: number;
} {
  const available = (context.payload.budgetCategories ?? [])
    .filter((category) => category.uid === undefined || category.uid === context.currentUser);

  for (const category of available) {
    const normalizedName = normalizeText(category.name);
    if (clean.includes(normalizedName)) {
      return {
        key: category.icon,
        name: category.name,
        iconColor: category.iconColor,
        budgetCatId: category.id,
        score: 0.35,
      };
    }
  }

  const catalog = matchCatalogCategory(clean);
  return {
    key: catalog.key,
    name: catalog.name,
    iconColor: catalog.iconColor,
    score: catalog.score,
  };
}

function matchCatalogCategory(text: string, fallback = 'other'): {
  key: string;
  name: string;
  iconColor: string;
  score: number;
} {
  const clean = normalizeText(text);
  let best = { key: fallback, name: CATEGORIES[fallback]?.label ?? 'Otro', iconColor: 'purple', score: 0 };

  for (const [key, info] of Object.entries(CATEGORIES)) {
    const label = normalizeText(info.label);
    const synonyms = CATEGORY_SYNONYMS[key] ?? [];
    const matchesLabel = label && clean.includes(label);
    const synonym = synonyms.find((item) => clean.includes(normalizeText(item)));
    if (!matchesLabel && !synonym) continue;
    const group = getCategoryGroupForKey(key);
    const score = matchesLabel ? 0.28 : 0.22;
    if (score > best.score) {
      best = {
        key,
        name: info.label,
        iconColor: getDefaultColorForGroup(group),
        score,
      };
    }
  }

  return best;
}

function extractTransactionTitle(clean: string, amount: AmountCandidate | null, categoryName: string): string {
  const afterAmount = amount
    ? clean.slice(amount.index + amount.length).replace(/^(euros?|dolares?|eur|usd|bs|cop)\b/, '').trim()
    : '';
  const fromAfterAmount = stripNoise(afterAmount.replace(/^(en|por|para|de)\s+/, ''));
  if (fromAfterAmount) return fromAfterAmount;

  const beforeAmount = amount ? clean.slice(0, amount.index) : clean;
  const fromBefore = stripNoise(removeActionWords(beforeAmount));
  if (fromBefore) return fromBefore;

  return categoryName || '';
}

function extractSavingTitle(clean: string, amount: AmountCandidate | null): string {
  const afterPara = extractAfterKeywords(clean, ['para'], ['en', 'con', 'de']);
  if (afterPara) return stripNoise(afterPara);

  if (amount) {
    const afterAmount = clean.slice(amount.index + amount.length);
    const title = stripNoise(afterAmount.replace(/^(euros?|dolares?|eur|usd|bs|cop|para|por|de)\s+/, ''));
    if (title) return title;
  }

  return stripNoise(removeActionWords(clean.replace(/\bahorrar\b|\bahorro\b/g, '')));
}

function extractPlanTitle(clean: string): string {
  const afterPlan = extractAfterKeywords(clean, ['plan'], ['con', 'junto', 'para']);
  if (afterPlan) return stripNoise(afterPlan);

  const afterCreate = extractAfterKeywords(clean, ['crear', 'crea', 'nuevo', 'nueva'], ['con', 'junto', 'para']);
  return stripNoise(afterCreate || clean.replace(/\bplan\b/g, ''));
}

function extractAfterKeywords(clean: string, keywords: string[], stopWords: string[]): string {
  const tokens = clean.split(/\s+/);
  const start = tokens.findIndex((token) => keywords.includes(token));
  if (start < 0) return '';
  const words: string[] = [];

  for (let i = start + 1; i < tokens.length; i += 1) {
    if (stopWords.includes(tokens[i])) break;
    words.push(tokens[i]);
  }

  return stripNoise(words.join(' '));
}

function extractPlanMemberNames(clean: string, context: VoiceActionContext): string[] {
  const conIndex = clean.indexOf(' con ');
  if (conIndex < 0) return [];
  const segment = clean.slice(conIndex + 5).replace(/\b(y|e)\b/g, ',');
  const parts = segment.split(/,|;|\smas\s/).map((part) => titleCase(stripNoise(part))).filter(Boolean);
  const existingNames = new Set(Object.values(context.users).map((user) => normalizeText(user.name)));

  return parts.filter((name) => {
    const normalized = normalizeText(name);
    return normalized.length > 1 && !['ambos', 'pareja', 'mi pareja'].includes(normalized) && !existingNames.has(normalized);
  });
}

function shouldIncludePartner(clean: string, context: VoiceActionContext): boolean {
  const partnerId = getPartnerId(context.partnerForUser, context.currentUser);
  const partner = context.users[partnerId];
  if (!partner || partnerId === context.currentUser) return false;
  return includesAny(clean, ['pareja', 'ambos', 'juntos', normalizeText(partner.name)]);
}

function buildPlanMembers(action: ParsedPlanAction, context: VoiceActionContext): PlanMember[] {
  const partnerId = getPartnerId(context.partnerForUser, context.currentUser);
  const current = getUserData(context.users, context.currentUser);
  const members: PlanMember[] = [{
    id: context.currentUser,
    uid: context.currentUser,
    name: current.name,
    initials: current.initials,
    color: current.color,
    bg: current.bg,
  }];

  if (action.includePartner && partnerId !== context.currentUser) {
    const partner = getUserData(context.users, partnerId);
    members.push({
      id: partnerId,
      uid: partnerId,
      name: partner.name,
      initials: partner.initials,
      color: partner.color,
      bg: partner.bg,
    });
  }

  action.memberNames.forEach((name, index) => {
    const colorSet = MEMBER_COLORS[index % MEMBER_COLORS.length];
    members.push({
      id: `ext_${Date.now()}_${index}`,
      name,
      initials: name.slice(0, 2).toUpperCase(),
      color: colorSet.color,
      bg: colorSet.bg,
    });
  });

  return members;
}

function detectFrequency(clean: string, kind: Transaction['kind']): Transaction['type'] {
  if (includesAny(clean, ['mensual', 'cada mes', 'al mes', 'suscripcion', 'renta', 'alquiler'])) return 'monthly';
  if (includesAny(clean, ['quincenal', 'bi semanal', 'bisemanal', 'cada dos semanas'])) return 'biweekly';
  if (includesAny(clean, ['semanal', 'cada semana'])) return 'weekly';
  if (kind === 'income' && includesAny(clean, ['sueldo', 'nomina', 'salario'])) return 'monthly';
  return 'once';
}

function detectDate(clean: string): string {
  const date = new Date();
  if (clean.includes('ayer')) date.setDate(date.getDate() - 1);
  if (clean.includes('manana')) date.setDate(date.getDate() + 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function findMonths(clean: string): number | undefined {
  const numeric = clean.match(/(\d+)\s*(mes|meses)/);
  if (numeric) return Number.parseInt(numeric[1], 10);

  const tokens = clean.split(/\s+/);
  const monthIndex = tokens.findIndex((token) => token === 'mes' || token === 'meses');
  if (monthIndex > 0) {
    const value = parseNumberWords(tokens.slice(Math.max(0, monthIndex - 4), monthIndex));
    if (value && value > 0) return value;
  }

  return undefined;
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(normalizeText(word)));
}

function removeActionWords(text: string): string {
  return text
    .split(/\s+/)
    .filter((token) => !ACTION_WORDS.includes(token) && !TRANSACTION_EXPENSE_WORDS.includes(token) && !TRANSACTION_INCOME_WORDS.includes(token))
    .join(' ');
}

function stripNoise(text: string): string {
  return text
    .replace(/\b(hoy|ayer|manana|mensual|semanal|quincenal|unico|una vez)\b/g, '')
    .replace(/\b(euros?|dolares?|eur|usd|bs|cop|pesos?|bolivares?)\b/g, '')
    .replace(/\b(con|de|del|la|el|los|las|un|una|por|para|en)\b$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function confidenceScore(base: number, missing: string[], boosts: number[]): number {
  const total = base + boosts.reduce((sum, boost) => sum + boost, 0) - (missing.length * 0.26);
  return Math.max(0.1, Math.min(0.98, Number(total.toFixed(2))));
}

function unknownAction(transcript: string, missing: string[]): UnknownVoiceAction {
  return {
    type: 'unknown',
    transcript,
    summary: 'No entendí la acción',
    confidence: 0.1,
    missing,
  };
}

function voiceNote(transcript: string): string {
  return `Creado por voz: "${transcript.trim()}"`;
}

function titleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1) : word)
    .join(' ');
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s.,$€-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
