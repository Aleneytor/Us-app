import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export interface CategoryInfo {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}

export type CategoryGroupId = 'food' | 'travel' | 'health' | 'fashion' | 'home' | 'tech';

export const CATEGORIES: Record<string, CategoryInfo> = {
  savings:     { label: 'Ahorro',      icon: 'bookmark-outline' },

  restaurant:  { label: 'Restaurante', icon: 'restaurant-outline' },
  groceries:   { label: 'Mercado',     icon: 'basket-outline' },
  coffee:      { label: 'Cafe',        icon: 'cafe-outline' },
  fastfood:    { label: 'Fast food',   icon: 'fast-food-outline' },
  drinks:      { label: 'Bebidas',     icon: 'wine-outline' },
  food:        { label: 'Comida',      icon: 'nutrition-outline' },

  travel:      { label: 'Vuelo',       icon: 'airplane-outline' },
  hotel:       { label: 'Hotel',       icon: 'bed-outline' },
  transport:   { label: 'Transporte',  icon: 'bus-outline' },
  car:         { label: 'Auto',        icon: 'car-outline' },
  train:       { label: 'Tren',        icon: 'train-outline' },
  map:         { label: 'Destino',     icon: 'map-outline' },

  health:      { label: 'Medico',      icon: 'medical-outline' },
  pharmacy:    { label: 'Farmacia',    icon: 'medkit-outline' },
  gym:         { label: 'Gym',         icon: 'barbell-outline' },
  wellness:    { label: 'Bienestar',   icon: 'heart-outline' },
  dental:      { label: 'Dental',      icon: 'happy-outline' },

  clothing:    { label: 'Ropa',        icon: 'shirt-outline' },
  shoes:       { label: 'Zapatos',     icon: 'footsteps-outline' },
  beauty:      { label: 'Belleza',     icon: 'sparkles-outline' },
  accessories: { label: 'Accesorios',  icon: 'watch-outline' },
  shopping:    { label: 'Compras',     icon: 'bag-handle-outline' },

  home:        { label: 'Hogar',       icon: 'home-outline' },
  rent:        { label: 'Renta',       icon: 'business-outline' },
  utilities:   { label: 'Servicios',   icon: 'flash-outline' },
  repairs:     { label: 'Reparacion',  icon: 'construct-outline' },
  furniture:   { label: 'Muebles',     icon: 'cube-outline' },

  tech:        { label: 'Tecnologia',  icon: 'desktop-outline' },
  phone:       { label: 'Telefono',    icon: 'phone-portrait-outline' },
  laptop:      { label: 'Laptop',      icon: 'laptop-outline' },
  wifi:        { label: 'Internet',    icon: 'wifi-outline' },
  gaming:      { label: 'Juegos',      icon: 'game-controller-outline' },
  camera:      { label: 'Camara',      icon: 'camera-outline' },

  pizza:       { label: 'Pizza',       icon: 'pizza-outline' },
  bike:        { label: 'Bici',        icon: 'bicycle-outline' },
  cart:        { label: 'Carrito',     icon: 'cart-outline' },
  entertainment: { label: 'Ocio',      icon: 'film-outline' },
  music:       { label: 'Musica',      icon: 'musical-notes-outline' },
  subscriptions: { label: 'Suscripcion', icon: 'card-outline' },
  education:   { label: 'Educacion',   icon: 'school-outline' },
  events:      { label: 'Eventos',     icon: 'calendar-outline' },
  outings:     { label: 'Salidas',     icon: 'ticket-outline' },
  scissors:    { label: 'Corte',       icon: 'cut-outline' },
  gifts:       { label: 'Regalos',     icon: 'gift-outline' },
  pets:        { label: 'Mascota',     icon: 'paw-outline' },
  globe:       { label: 'Mundo',       icon: 'globe-outline' },
  umbrella:    { label: 'Paraguas',    icon: 'umbrella-outline' },
  flame:       { label: 'Fuego',       icon: 'flame-outline' },
  cloud:       { label: 'Nube',        icon: 'cloud-outline' },
  sun:         { label: 'Sol',         icon: 'sunny-outline' },
  moon:        { label: 'Luna',        icon: 'moon-outline' },
  lightning:   { label: 'Rayo',        icon: 'flash-outline' },
  feather:     { label: 'Pluma',       icon: 'leaf-outline' },
  anchor:      { label: 'Ancla',       icon: 'boat-outline' },
  eye:         { label: 'Ojo',         icon: 'eye-outline' },
  key:         { label: 'Llave',       icon: 'key-outline' },
  flag:        { label: 'Bandera',     icon: 'flag-outline' },
  rental:      { label: 'Alquiler',    icon: 'business-outline' },

  salary:      { label: 'Nomina',      icon: 'cash-outline' },
  freelance:   { label: 'Freelance',   icon: 'briefcase-outline' },
  investment:  { label: 'Inversion',   icon: 'trending-up-outline' },
  refund:      { label: 'Reembolso',   icon: 'refresh-outline' },
  sale:        { label: 'Venta',       icon: 'pricetag-outline' },
  bonus:       { label: 'Bonus',       icon: 'star-outline' },
  other:       { label: 'Otro',        icon: 'ellipsis-horizontal-outline' },
};

export interface CategoryGroupInfo {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  keys: string[];
  colorIds: string[];
}

export const CATEGORY_GROUPS: Record<CategoryGroupId, CategoryGroupInfo> = {
  food: {
    label: 'Comida',
    icon: 'restaurant-outline',
    keys: ['restaurant', 'groceries', 'coffee', 'fastfood', 'drinks', 'food'],
    colorIds: ['amber', 'orange', 'rose'],
  },
  travel: {
    label: 'Viajes',
    icon: 'airplane-outline',
    keys: ['travel', 'hotel', 'transport', 'car', 'train', 'map'],
    colorIds: ['blue', 'teal', 'indigo'],
  },
  health: {
    label: 'Salud',
    icon: 'medical-outline',
    keys: ['health', 'pharmacy', 'gym', 'wellness', 'dental'],
    colorIds: ['green', 'teal', 'rose'],
  },
  fashion: {
    label: 'Moda',
    icon: 'shirt-outline',
    keys: ['clothing', 'shoes', 'beauty', 'accessories', 'shopping'],
    colorIds: ['pink', 'purple', 'rose'],
  },
  home: {
    label: 'Casa',
    icon: 'home-outline',
    keys: ['home', 'rent', 'utilities', 'repairs', 'furniture'],
    colorIds: ['slate', 'amber', 'green'],
  },
  tech: {
    label: 'Tecnologia',
    icon: 'desktop-outline',
    keys: ['tech', 'phone', 'laptop', 'wifi', 'gaming', 'camera'],
    colorIds: ['indigo', 'blue', 'slate'],
  },
};

export const CATEGORY_GROUP_ORDER: CategoryGroupId[] = ['food', 'travel', 'health', 'fashion', 'home', 'tech'];

export const ALL_CATEGORY_KEYS = CATEGORY_GROUP_ORDER.flatMap((groupId) => CATEGORY_GROUPS[groupId].keys);

export interface BudgetCategoryPreset {
  name: string;
  icon: string;
  iconColor: string;
}

export const BUDGET_CATEGORY_PRESETS: BudgetCategoryPreset[] = [
  { name: 'Sueldo', icon: 'salary', iconColor: 'green' },
  { name: 'Freelance', icon: 'freelance', iconColor: 'blue' },
  { name: 'Servicios', icon: 'utilities', iconColor: 'yellow' },
  { name: 'Casa', icon: 'home', iconColor: 'slate' },
  { name: 'Comida', icon: 'food', iconColor: 'orange' },
  { name: 'Carro', icon: 'car', iconColor: 'blueLight' },
  { name: 'Ropa', icon: 'clothing', iconColor: 'pink' },
  { name: 'Salidas', icon: 'outings', iconColor: 'purple' },
  { name: 'Eventos', icon: 'events', iconColor: 'teal' },
  { name: 'Viajes', icon: 'travel', iconColor: 'sky' },
  { name: 'Escuela', icon: 'education', iconColor: 'indigo' },
];

export const BUDGET_CATEGORY_ICON_KEYS = Array.from(new Set([
  ...ALL_CATEGORY_KEYS,
  ...BUDGET_CATEGORY_PRESETS.map((preset) => preset.icon),
  'savings',
  'education',
  'entertainment',
  'events',
  'outings',
  'salary',
  'freelance',
  'other',
])).filter((key) => !!CATEGORIES[key]);

export const SAVING_ICON_KEYS = [
  'savings',
  'travel',
  'hotel',
  'map',
  'car',
  'home',
  'furniture',
  'tech',
  'phone',
  'laptop',
  'gaming',
  'camera',
  'shopping',
  'clothing',
  'beauty',
  'accessories',
  'gifts',
  'education',
  'health',
  'gym',
  'music',
  'entertainment',
  'pets',
  'globe',
  'key',
  'flag',
].filter((key) => !!CATEGORIES[key]);

export function getCategoryGroupForKey(key: string): CategoryGroupId {
  return CATEGORY_GROUP_ORDER.find((groupId) => CATEGORY_GROUPS[groupId].keys.includes(key)) ?? 'food';
}

export function getDefaultCategoryForGroup(groupId: CategoryGroupId): string {
  return CATEGORY_GROUPS[groupId].keys[0];
}

export function getDefaultColorForGroup(groupId: CategoryGroupId): string {
  return CATEGORY_GROUPS[groupId].colorIds[0];
}
