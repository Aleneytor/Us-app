import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 58; // tabPill height from _layout.tsx
const TAB_BAR_BOTTOM_GAP = 12; // min distance from screen bottom
const CONTENT_GAP = 16; // breathing room above the tab bar

export function useTabPadding(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, TAB_BAR_BOTTOM_GAP) + TAB_BAR_HEIGHT + CONTENT_GAP;
}
