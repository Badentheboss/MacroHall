import { supabase } from './config';

// Adds dishes to today's food log the same way AddFood does: one entry per
// dish with base nutrition, servings stacked on repeat adds.
// items: menu rows (name, nutrition_facts, ...) with an optional `servings`.
export async function addItemsToLog(items, mealTime) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in again.');

  const { data, error } = await supabase.from('users').select('log').eq('id', user.id).single();
  if (error) throw error;

  const log = Array.isArray(data?.log) ? [...data.log] : [];
  for (const item of items) {
    const servings = item.servings || 1;
    const { servings: _ignored, ...foodItem } = item;
    const existing = log.find((entry) => entry.name === foodItem.name);

    if (existing) {
      existing.servings = (existing.servings || 1) + servings;
      const base = existing.baseNutrition || existing.nutrition_facts || {};
      existing.nutrition_facts = {
        calories: base.calories * existing.servings,
        protein: base.protein * existing.servings,
        total_carbohydrate: base.total_carbohydrate * existing.servings,
        total_fat: base.total_fat * existing.servings,
      };
    } else {
      const base = foodItem.nutrition_facts || {};
      log.push({
        ...foodItem,
        servings,
        baseNutrition: { ...base },
        mealTime,
        nutrition_facts:
          servings === 1
            ? base
            : {
                calories: base.calories * servings,
                protein: base.protein * servings,
                total_carbohydrate: base.total_carbohydrate * servings,
                total_fat: base.total_fat * servings,
              },
      });
    }
  }

  const { error: updateError } = await supabase.from('users').update({ log }).eq('id', user.id);
  if (updateError) throw updateError;
}
