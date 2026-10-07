import { supabase } from './config';

export const GOALS = [
  { key: 'bulk', label: 'Bulking', emoji: '📈' },
  { key: 'cut', label: 'Cutting', emoji: '🔥' },
  { key: 'maintain', label: 'Maintaining', emoji: '⚖️' },
  { key: 'recomp', label: 'Recomp', emoji: '🔄' },
];

export const AVATARS = [
  '🍽️', '💪', '🏋️', '🔥', '⚡', '🎯', '🏃', '🚴',
  '🥗', '🍗', '🥩', '🍳', '🥑', '🍓', '🍜', '🌮',
  '🍕', '☕', '🦁', '🐻', '🦅', '🐺', '🏀', '⚽',
];

export const ACCENTS = [
  '#32745f', '#2E7D32', '#00897B', '#1E88E5', '#3949AB',
  '#8E24AA', '#D81B60', '#E53935', '#FB8C00', '#6D4C41',
];

export const VISIBILITY = [
  { key: 'everyone', label: 'Everyone at my school', hint: 'Classmates can see your calendar and usuals.' },
  { key: 'friends', label: 'Friends', hint: 'Only accepted friends see what you eat.' },
  { key: 'only_me', label: 'Only me', hint: 'Your food log stays private.' },
];

export const goalFor = (key) => GOALS.find((goal) => goal.key === key) || null;

export async function getMyUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Profile page payload, or null when the viewer may not see this person.
export async function fetchProfile(userId) {
  const { data, error } = await supabase.rpc('get_profile', { p_user: userId });
  if (error) throw error;
  return data;
}

// monthStart: 'YYYY-MM-01'. Returns { 'YYYY-MM-DD': { calories, protein, carbs, fat, items } }.
export async function fetchLogMonth(userId, monthStart) {
  const { data, error } = await supabase.rpc('get_log_month', { p_user: userId, p_month: monthStart });
  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.day, row]));
}

export async function fetchLogDay(userId, day) {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('day, entries, calories, protein, carbs, fat')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(fields) {
  const id = await getMyUserId();
  const { error } = await supabase.from('profiles').update(fields).eq('id', id);
  if (error) {
    if (/idx_profiles_username|duplicate/i.test(error.message)) throw new Error('That username is taken.');
    if (/username_format/i.test(error.message)) {
      throw new Error('Usernames are 3–20 characters: letters, numbers, dots and underscores.');
    }
    throw error;
  }
}

export async function searchPeople(query) {
  const { data, error } = await supabase.rpc('search_people', { p_query: query });
  if (error) throw error;
  return data || [];
}
