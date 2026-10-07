// Demo mode runs the whole app on sample data with no Supabase project or
// backend: on with EXPO_PUBLIC_DEMO_MODE=1 (`npm run demo` from the repo
// root), or automatically in development when the Supabase keys are missing.
export const DEMO_MODE =
  process.env.EXPO_PUBLIC_DEMO_MODE === '1' ||
  (typeof __DEV__ !== 'undefined' && __DEV__ && !process.env.EXPO_PUBLIC_SUPABASE_URL);
