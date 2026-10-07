import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { elevation, fonts, liveGradient, motion, palettes, radius, space, type } from './tokens';
import { schoolTones } from './school';

export { elevation, fonts, liveGradient, motion, palettes, radius, space, type };

// Current palette (base style + the student's school tint) and shared scales:
// const { c, isDark, school } = useAppTheme();
// c.school / c.onSchool / c.schoolSoft / c.schoolAlt carry the school colors.
export function useAppTheme() {
  const { isDarkMode, school } = useTheme() || {};
  return useMemo(() => {
    const base = isDarkMode ? palettes.dark : palettes.light;
    const c = { ...base, ...schoolTones(school, base, Boolean(isDarkMode)) };
    return { c, isDark: Boolean(isDarkMode), school: school || null, space, radius, type, fonts };
  }, [isDarkMode, school]);
}

// Theme-aware StyleSheet: const styles = useStyles(makeStyles), where
// makeStyles = (c, theme) => ({ ... }) is defined at module scope.
export function useStyles(factory) {
  const theme = useAppTheme();
  return useMemo(() => StyleSheet.create(factory(theme.c, theme)), [theme, factory]);
}
