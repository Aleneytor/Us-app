import type { TextStyle } from 'react-native';

export const MODAL_TITLE_FONT_WEIGHT = 550 as unknown as TextStyle['fontWeight'];

/**
 * Familia tipográfica obligatoria para todo título de sección de la app.
 * Cada título conserva su fontSize propio; no combinar con fontWeight
 * (la variante Medium ya define el peso).
 */
export const SECTION_TITLE_FONT_FAMILY: TextStyle['fontFamily'] = 'Poppins_500Medium';
