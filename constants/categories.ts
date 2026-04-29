import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export interface CategoryInfo {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}

export const CATEGORIES: Record<string, CategoryInfo> = {
  food:          { label: 'Comida',       icon: 'restaurant-outline' },
  pizza:         { label: 'Fast Food',    icon: 'pizza-outline' },
  coffee:        { label: 'Café',         icon: 'cafe-outline' },
  drinks:        { label: 'Bebidas',      icon: 'wine-outline' },
  transport:     { label: 'Transporte',   icon: 'bus-outline' },
  car:           { label: 'Auto',         icon: 'car-outline' },
  bike:          { label: 'Bici',         icon: 'bicycle-outline' },
  home:          { label: 'Hogar',        icon: 'home-outline' },
  shopping:      { label: 'Compras',      icon: 'bag-handle-outline' },
  cart:          { label: 'Carrito',      icon: 'cart-outline' },
  health:        { label: 'Salud',        icon: 'medical-outline' },
  gym:           { label: 'Gym',          icon: 'barbell-outline' },
  dumbbell:      { label: 'Pesas',        icon: 'fitness-outline' },
  entertainment: { label: 'Ocio',         icon: 'film-outline' },
  gaming:        { label: 'Juegos',       icon: 'game-controller-outline' },
  music:         { label: 'Música',       icon: 'musical-notes-outline' },
  subscriptions: { label: 'Suscripción',  icon: 'card-outline' },
  education:     { label: 'Educación',    icon: 'school-outline' },
  clothing:      { label: 'Ropa',         icon: 'shirt-outline' },
  scissors:      { label: 'Corte',        icon: 'cut-outline' },
  gifts:         { label: 'Gift',         icon: 'gift-outline' },
  tech:          { label: 'Tech',         icon: 'desktop-outline' },
  phone:         { label: 'Teléfono',     icon: 'phone-portrait-outline' },
  wifi:          { label: 'Internet',     icon: 'wifi-outline' },
  pets:          { label: 'Mascota',      icon: 'paw-outline' },
  travel:        { label: 'Viajes',       icon: 'airplane-outline' },
  globe:         { label: 'Mundo',        icon: 'globe-outline' },
  camera:        { label: 'Cámara',       icon: 'camera-outline' },
  umbrella:      { label: 'Paraguas',     icon: 'umbrella-outline' },
  flame:         { label: 'Fuego',        icon: 'flame-outline' },
  cloud:         { label: 'Nube',         icon: 'cloud-outline' },
  sun:           { label: 'Sol',          icon: 'sunny-outline' },
  moon:          { label: 'Luna',         icon: 'moon-outline' },
  lightning:     { label: 'Rayo',         icon: 'flash-outline' },
  feather:       { label: 'Pluma',        icon: 'leaf-outline' },
  anchor:        { label: 'Ancla',        icon: 'boat-outline' },
  eye:           { label: 'Ojo',          icon: 'eye-outline' },
  key:           { label: 'Llave',        icon: 'key-outline' },
  flag:          { label: 'Bandera',      icon: 'flag-outline' },
  salary:        { label: 'Nómina',       icon: 'cash-outline' },
  freelance:     { label: 'Freelance',    icon: 'briefcase-outline' },
  investment:    { label: 'Inversión',    icon: 'trending-up-outline' },
  refund:        { label: 'Reembolso',    icon: 'refresh-outline' },
  sale:          { label: 'Venta',        icon: 'pricetag-outline' },
  bonus:         { label: 'Bonus',        icon: 'star-outline' },
  rental:        { label: 'Alquiler',     icon: 'business-outline' },
  beauty:        { label: 'Belleza',      icon: 'sparkles-outline' },
  other:         { label: 'Otro',         icon: 'ellipsis-horizontal-outline' },
};

export const ALL_CATEGORY_KEYS = Object.keys(CATEGORIES);
