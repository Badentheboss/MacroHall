let client;

function getSupabase() {
  if (client) return client;
  const supabaseClient = require('../../supabaseClient');
  client = supabaseClient();
  return client;
}

const CHUNK_SIZE = 500;

function chunk(rows, size = CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

async function insertRows(supabase, table, rows) {
  for (const part of chunk(rows)) {
    const { error } = await supabase.from(table).insert(part);
    if (error) throw error;
  }
}

// Writes school metadata from the catalog. Never touches `status`: going live
// is a deliberate manual step once menus look right.
async function upsertSchool(school, supabase = getSupabase()) {
  const payload = {
    slug: school.slug,
    name: school.name,
    short_name: school.short_name || null,
    listing_url: school.listing_url || null,
    email_domains: school.email_domains || [],
    city: school.city || null,
    state: school.state || null,
    timezone: school.timezone,
    menu_platform: school.menu_platform || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('schools')
    .upsert(payload, { onConflict: 'slug' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function upsertHall(schoolId, hall, supabase = getSupabase()) {
  const payload = {
    school_id: schoolId,
    slug: hall.slug,
    name: hall.name,
    source_url: hall.sourceUrl || null,
    updated_at: new Date().toISOString(),
    last_ingested_at: new Date().toISOString(),
  };

  // Only send coordinates the source actually provides, so ingestion never
  // erases a geofence someone set by hand.
  if (Number.isFinite(hall.latitude) && Number.isFinite(hall.longitude)) {
    payload.latitude = hall.latitude;
    payload.longitude = hall.longitude;
  }

  const { data, error } = await supabase
    .from('dining_halls')
    .upsert(payload, { onConflict: 'school_id,slug' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// Replaces one hall's menu for one day. Child rows (meals, allergens, traits,
// nutrition) are removed by ON DELETE CASCADE.
async function replaceHallMenu(hallId, menuDate, items, supabase = getSupabase()) {
  const { error: deleteError } = await supabase
    .from('menu_items')
    .delete()
    .eq('hall_id', hallId)
    .eq('menu_date', menuDate);
  if (deleteError) throw deleteError;

  if (items.length === 0) return;

  const idByKey = new Map();
  const keyOf = (name, subheader) => `${name}::${subheader || ''}`;

  for (const part of chunk(items)) {
    const { data, error } = await supabase
      .from('menu_items')
      .insert(
        part.map((item) => ({
          hall_id: hallId,
          menu_date: menuDate,
          name: item.name,
          subheader: item.subheader || null,
          nutrition_source: item.nutritionSource || 'official',
        }))
      )
      .select('id, name, subheader');
    if (error) throw error;
    for (const row of data) idByKey.set(keyOf(row.name, row.subheader), row.id);
  }

  const meals = [];
  const allergens = [];
  const traits = [];
  const nutrition = [];

  for (const item of items) {
    const menuItemId = idByKey.get(keyOf(item.name, item.subheader || null));
    if (!menuItemId) continue;

    for (const meal of new Set(item.meals || [])) meals.push({ menu_item_id: menuItemId, meal });
    for (const allergen of new Set(item.allergens || [])) allergens.push({ menu_item_id: menuItemId, allergen });
    for (const trait of new Set(item.traits || [])) traits.push({ menu_item_id: menuItemId, trait });
    for (const [nutrientKey, value] of Object.entries(item.nutrition || {})) {
      if (nutrientKey && value !== '' && value !== null && value !== undefined) {
        nutrition.push({ menu_item_id: menuItemId, nutrient_key: nutrientKey, nutrient_value: String(value) });
      }
    }
  }

  await insertRows(supabase, 'menu_item_meals', meals);
  await insertRows(supabase, 'menu_item_allergens', allergens);
  await insertRows(supabase, 'menu_item_traits', traits);
  await insertRows(supabase, 'menu_item_nutrition', nutrition);
}

async function syncSchoolSnapshot(snapshot, supabase = getSupabase()) {
  const schoolId = await upsertSchool(snapshot.school, supabase);

  for (const menu of snapshot.menus) {
    for (const hallPayload of menu.halls) {
      const hallId = await upsertHall(schoolId, hallPayload.hall, supabase);
      await replaceHallMenu(hallId, menu.date, hallPayload.items, supabase);
    }
  }
}

module.exports = {
  replaceHallMenu,
  syncSchoolSnapshot,
  upsertHall,
  upsertSchool,
};
