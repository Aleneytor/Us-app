export interface IconColorSet {
  id: string;
  color: string;
  bg: string;
}

export const ICON_COLORS: IconColorSet[] = [
  { id: 'blue',   color: '#2563EB', bg: '#DBEAFE' },
  { id: 'blueLight', color: '#60A5FA', bg: '#EFF6FF' },
  { id: 'sky',    color: '#0284C7', bg: '#E0F2FE' },
  { id: 'indigo', color: '#4F46E5', bg: '#E0E7FF' },
  { id: 'teal',   color: '#0D9488', bg: '#CCFBF1' },
  { id: 'green',  color: '#16A34A', bg: '#DCFCE7' },
  { id: 'lime',   color: '#84CC16', bg: '#ECFCCB' },
  { id: 'yellow', color: '#FACC15', bg: '#FEF9C3' },
  { id: 'amber',  color: '#D97706', bg: '#FEF3C7' },
  { id: 'orange', color: '#EA580C', bg: '#FFF7ED' },
  { id: 'red',    color: '#DC2626', bg: '#FEE2E2' },
  { id: 'rose',   color: '#E11D48', bg: '#FFE4E6' },
  { id: 'pink',   color: '#DB2777', bg: '#FCE7F3' },
  { id: 'pinkLight', color: '#F472B6', bg: '#FDF2F8' },
  { id: 'purple', color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'slate',  color: '#475569', bg: '#F1F5F9' },
  { id: 'grayLight', color: '#94A3B8', bg: '#F8FAFC' },
];

export function getIconColor(id: string): IconColorSet {
  return ICON_COLORS.find((c) => c.id === id) ?? ICON_COLORS[0];
}

// ─── Theme system ─────────────────────────────────────────────────────────────

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

export const DARK_THEME: AppTheme = {
  mode: 'dark',
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
  navBorder:     'rgba(255, 255, 255, 0.08)',
  inputBg:       'rgba(255, 255, 255, 0.06)',
  shadowColor:   '#7E7E7E',
};

export const LIGHT_THEME: AppTheme = {
  mode: 'light',
  background:    '#F2F2F7',
  surface:       '#FFFFFF',
  surfaceSecond: '#F8F8FA',
  border:        'rgba(0, 0, 0, 0.10)',
  softSurface:   'rgba(0, 0, 0, 0.05)',
  textPrimary:   '#0F172A',
  textSecondary: 'rgba(15, 23, 42, 0.65)',
  textMuted:     'rgba(15, 23, 42, 0.40)',
  blue:          '#2563EB',
  green:         '#16A34A',
  red:           '#EC1147',
  income:        '#16A34A',
  expense:       '#EC1147',
  navBg:         '#FFFFFF',
  navBorder:     'rgba(0, 0, 0, 0.08)',
  inputBg:       '#F0F0F5',
  shadowColor:   '#A0A0A0',
};

