import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { DEMO_MODE } from './demo';
import { createDemoClient } from './demo/client';

// Expo will automatically inject EXPO_PUBLIC_* env vars
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Choose correct storage implementation
let storage;
if (Platform.OS === 'web') {
  storage = typeof window !== 'undefined' ? window.localStorage : undefined;
} else {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  storage = AsyncStorage;
}

// Warn instead of crashing in Expo Go
if (!DEMO_MODE && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.warn(
    '⚠️ Missing Supabase environment variables. ' +
    'Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
    'are set in your .env file or EAS environment.'
  );
}

export { SUPABASE_URL, DEMO_MODE };

// Demo mode swaps in an in-memory client with sample data. Otherwise a
// placeholder URL keeps the app rendering when .env is missing; requests then
// fail with a network error until the keys are set.
export const supabase = DEMO_MODE
  ? createDemoClient()
  : createClient(SUPABASE_URL || 'https://missing-env.supabase.co', SUPABASE_ANON_KEY || 'missing-anon-key', {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
