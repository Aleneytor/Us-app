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

export interface TagColorSet {
  bg: string;
  c: string;
}

export const TAG_COLOR_SETS: TagColorSet[] = [
  { bg: '#DBEAFE', c: '#2563EB' },
  { bg: '#CCFBF1', c: '#0D9488' },
  { bg: '#FFE4E6', c: '#EC1147' },
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
  red: '#EC1147',
  income: '#16A34A',
  expense: '#EC1147',
} as const;
