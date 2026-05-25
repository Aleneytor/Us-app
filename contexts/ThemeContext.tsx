import { createContext, useContext, type ReactNode } from 'react';
import { DARK_THEME, LIGHT_THEME, type AppTheme } from '../constants/colors';
import { useAppStore } from '../store/useAppStore';

const ThemeContext = createContext<AppTheme>(DARK_THEME);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themeMode === 'light' ? LIGHT_THEME : DARK_THEME;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  return useContext(ThemeContext);
}
