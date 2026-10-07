import { supabase } from './config';

// Creates the public.users row for a newly verified account from the details
// saved at sign-up (auth user metadata). Safe to call on every sign-in:
// returns false when the row already exists.
export async function ensureUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (existing) return false;

  const meta = user.user_metadata || {};
  const { error } = await supabase.from('users').insert({
    username: meta.username || null,
    email: user.email,
    birthday: meta.birthday || null,
    school_id: meta.school_id ?? null,
  });
  if (error) throw error;
  return true;
}
