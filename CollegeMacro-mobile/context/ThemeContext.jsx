import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { supabase } from '../utils/config';
import { fetchMySchool } from '../utils/schools';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const systemTheme = useColorScheme();
  const [themePreference, setThemePreference] = useState('system');
  const [isDarkMode, setIsDarkMode] = useState(false);
  // The signed-in student's school; its colors tint the base style.
  const [school, setSchool] = useState(null);

  useEffect(() => {
    loadUserThemePreference();
    const loadSchool = () => fetchMySchool().then(setSchool).catch(() => setSchool(null));
    loadSchool();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setSchool(null);
      else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') loadSchool();
    });
    return () => data?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    updateThemeMode();
  }, [systemTheme, themePreference]);

  const loadUserThemePreference = async () => {
    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;

    const { data, error } = await supabase
      .from('users')
      .select('theme_preference')
      .eq('id', user.data.user.id)
      .single();

    if (!error && data?.theme_preference) {
      setThemePreference(data.theme_preference);
    }
  };

  const updateThemeMode = () => {
    if (themePreference === 'system') {
      setIsDarkMode(systemTheme === 'dark');
    } else {
      setIsDarkMode(themePreference === 'dark');
    }
  };

  const changeTheme = async (newTheme) => {
    const user = await supabase.auth.getUser();
    if (!user.data?.user) return;

    await supabase
      .from('users')
      .update({ theme_preference: newTheme })
      .eq('id', user.data.user.id);

    setThemePreference(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, themePreference, changeTheme, school }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext); 