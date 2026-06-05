let client;

function getSupabase() {
  if (client) return client;
  const supabaseClient = require('../../supabaseClient');
  client = supabaseClient();
  return client;
}

async function upsertSchool(school) {
  const supabase = getSupabase();
  const payload = {
    slug: school.slug,
    name: school.name,
    listing_url: school.listing_url || null,
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

async function upsertHall(schoolId, hall) {
  const supabase = getSupabase();
  const payload = {
    school_id: schoolId,
    slug: hall.slug,
    name: hall.name,
    source_url: hall.sourceUrl || null,
    updated_at: new Date().toISOString(),
    last_ingested_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('dining_halls')
    .upsert(payload, { onConflict: 'school_id,slug' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function clearHallItems(hallId) {
  const supabase = getSupabase();

  const { data: existingItems, error: loadError } = await supabase
    .from('menu_items')
    .select('id')
    .eq('hall_id', hallId);

  if (loadError) throw loadError;
  if (!existingItems || existingItems.length === 0) return;

  const itemIds = existingItems.map((item) => item.id);

  const deleteOperations = [
    supabase.from('menu_item_meals').delete().in('menu_item_id', itemIds),
    supabase.from('menu_item_allergens').delete().in('menu_item_id', itemIds),
    supabase.from('menu_item_traits').delete().in('menu_item_id', itemIds),
    supabase.from('menu_item_nutrition').delete().in('menu_item_id', itemIds),
  ];

  for (const operation of deleteOperations) {
    const { error } = await operation;
    if (error) throw error;
  }

  const { error: deleteItemsError } = await supabase
    .from('menu_items')
    .delete()
    .eq('hall_id', hallId);

  if (deleteItemsError) throw deleteItemsError;
}

async function insertItemDetails(itemId, item) {
  const supabase = getSupabase();

  const meals = [...new Set(item.meals || [])]
    .filter(Boolean)
    .map((meal) => ({ menu_item_id: itemId, meal }));

  const allergens = [...new Set(item.allergens || [])]
    .filter(Boolean)
    .map((allergen) => ({ menu_item_id: itemId, allergen }));

  const traits = [...new Set(item.traits || [])]
    .filter(Boolean)
    .map((trait) => ({ menu_item_id: itemId, trait }));

  const nutrition = Object.entries(item.nutrition || {})
    .filter(([key, value]) => key && value)
    .map(([nutrient_key, nutrient_value]) => ({
      menu_item_id: itemId,
      nutrient_key,
      nutrient_value: String(nutrient_value),
    }));

  if (meals.length > 0) {
    const { error } = await supabase.from('menu_item_meals').insert(meals);
    if (error) throw error;
  }

  if (allergens.length > 0) {
    const { error } = await supabase.from('menu_item_allergens').insert(allergens);
    if (error) throw error;
  }

  if (traits.length > 0) {
    const { error } = await supabase.from('menu_item_traits').insert(traits);
    if (error) throw error;
  }

  if (nutrition.length > 0) {
    const { error } = await supabase.from('menu_item_nutrition').insert(nutrition);
    if (error) throw error;
  }
}

async function insertHallItems(hallId, items) {
  const supabase = getSupabase();

  for (const item of items) {
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        hall_id: hallId,
        name: item.name,
        subheader: item.subheader || null,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    await insertItemDetails(data.id, item);
  }
}

async function syncSchoolSnapshot(snapshot) {
  const schoolId = await upsertSchool(snapshot.school);

  for (const hallPayload of snapshot.halls) {
    const hallId = await upsertHall(schoolId, hallPayload.hall);
    await clearHallItems(hallId);
    await insertHallItems(hallId, hallPayload.items);
  }
}

module.exports = {
  syncSchoolSnapshot,
};
