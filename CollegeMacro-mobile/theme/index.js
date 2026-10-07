import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts, liveGradient, motion, palettes, radius, space, type } from './tokens';

export { fonts, liveGradient, motion, palettes, radius, space, type };

// Current palette plus the shared scales: const { c, isDark } = useAppTheme();
export function useAppTheme() {
  const { isDarkMode } = useTheme() || {};
  return useMemo(
    () => ({ c: isDarkMode ? palettes.dark : palettes.light, isDark: Boolean(isDarkMode), space, radius, type, fonts }),
    [isDarkMode]
  );
}

// Theme-aware StyleSheet: const styles = useStyles((c) => ({ box: { backgroundColor: c.surface } }));
export function useStyles(factory) {
  const theme = useAppTheme();
  return useMemo(() => StyleSheet.create(factory(theme.c, theme)), [theme, factory]);
}
