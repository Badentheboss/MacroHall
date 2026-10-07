import { supabase } from './config';

const EDU_EMAIL = /^[^@\s]+@[a-z0-9.-]+\.edu$/i;

export const normalizeEmail = (email) => (email || '').trim().toLowerCase();

export const emailDomain = (email) => normalizeEmail(email).split('@')[1] || '';

export const isEduEmail = (email) => EDU_EMAIL.test(normalizeEmail(email));

// buckeyemail.osu.edu belongs to a school whose domain is osu.edu.
export const emailMatchesSchool = (email, school) => {
  const domain = emailDomain(email);
  return (school?.email_domains || []).some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`)
  );
};

// YYYY-MM-DD in the school's time zone, falling back to the device's date if
// the runtime lacks time zone data.
export const todayInTimezone = (timezone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
};

const SCHOOL_COLUMNS = 'id, slug, name, short_name, email_domains, timezone, status, city, state, primary_color, secondary_color';

export async function fetchSchools() {
  const { data, error } = await supabase.from('schools').select(SCHOOL_COLUMNS).order('name');
  if (error) throw error;
  return data;
}

export async function fetchMySchool() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', user.id)
    .single();
  if (error || !profile?.school_id) return null;

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select(SCHOOL_COLUMNS)
    .eq('id', profile.school_id)
    .single();
  if (schoolError) return null;
  return school;
}

export async function fetchHalls(schoolId) {
  const { data, error } = await supabase
    .from('dining_halls')
    .select('id, slug, name')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data;
}

/**
 * @param {{ school?: { id: number, name: string } | null, schoolName?: string, email: string }} request
 */
export async function joinWaitlist({ school = null, schoolName = '', email }) {
  const { error } = await supabase.from('school_requests').insert({
    school_id: school?.id ?? null,
    school_name: school?.name ?? schoolName,
    email: normalizeEmail(email),
  });
  if (error) throw error;
}
