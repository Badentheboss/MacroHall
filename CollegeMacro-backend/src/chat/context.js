const { localDate } = require('../ingest/dates');

const PAGE_SIZE = 1000; // PostgREST caps responses at 1000 rows by default

async function fetchAll(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// Everything the chatbot's tools need, loaded once per request with the
// service-role client.
async function loadChatContext(supabase, userId) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('school_id, dailyValues, log, allergens, preferences')
    .eq('id', userId)
    .single();
  if (userError) throw userError;

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('id, name, short_name, timezone, email_domains')
    .eq('id', user.school_id)
    .single();
  if (schoolError) throw schoolError;

  const dates = { today: localDate(school.timezone), tomorrow: localDate(school.timezone, 1) };
  const menuItems = await fetchAll(() =>
    supabase
      .from('menu_items_flat')
      .select('id, hall_id, hall_name, menu_date, name, subheader, meals, allergens, traits, nutrition_facts, nutrition_source')
      .eq('school_id', school.id)
      .in('menu_date', [dates.today, dates.tomorrow])
      .order('id')
  );

  return { user, school, dates, menuItems };
}

module.exports = {
  fetchAll,
  loadChatContext,
};
