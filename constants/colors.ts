export interface IconColorSet {
  id: string;
  color: string;
  bg: string;
}

export const ICON_COLORS: IconColorSet[] = [
  { id: 'blue',   color: '#2563EB', bg: '#DBEAFE' },
  { id: 'rose',   color: '#E11D48', bg: '#FFE4E6' },
  { id: 'green',  color: '#16A34A', bg: '#DCFCE7' },
  { id: 'purple', color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'amber',  color: '#D97706', bg: '#FEF3C7' },
  { id: 'teal',   color: '#0D9488', bg: '#CCFBF1' },
  { id: 'pink',   color: '#DB2777', bg: '#FCE7F3' },
  { id: 'indigo', color: '#4F46E5', bg: '#E0E7FF' },
  { id: 'orange', color: '#EA580C', bg: '#FFF7ED' },
  { id: 'slate',  color: '#475569', bg: '#F1F5F9' },
];

export function getIconColor(id: string): IconColorSet {
  return ICON_COLORS.find((c) => c.id === id) ?? ICON_COLORS[0];
}

export interface TagColorSet {
  bg: string;
  c: string;
}

export const TAG_COLOR_SETS: TagColorSet[] = [
  { bg: '#DBEAFE', c: '#2563EB' },
  { bg: '#CCFBF1', c: '#0D9488' },
  { bg: '#FFE4E6', c: '#E11D48' },
  { bg: '#FEF3C7', c: '#D97706' },
  { bg: '#DCFCE7', c: '#16A34A' },
  { bg: '#EDE9FE', c: '#7C3AED' },
  { bg: '#FCE7F3', c: '#BE185D' },
  { bg: '#FEF9C3', c: '#CA8A04' },
  { bg: '#E0F2FE', c: '#0284C7' },
  { bg: '#FEE2E2', c: '#DC2626' },
];

export function tagColorFor(tag: string): TagColorSet {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash * 31) + tag.charCodeAt(i)) & 0xffff;
  }
  return TAG_COLOR_SETS[hash % TAG_COLOR_SETS.length];
}

export const APP_COLORS = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  blue: '#2563EB',
  green: '#16A34A',
  red: '#E11D48',
  income: '#16A34A',
  expense: '#E11D48',
} as const;
