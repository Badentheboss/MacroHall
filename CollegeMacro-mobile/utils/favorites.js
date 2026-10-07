import { supabase } from './config';

export const dishKey = (name) => (name || '').trim().toLowerCase();

// Set of hearted dish keys for the signed-in student.
export async function fetchFavoriteKeys() {
  const { data, error } = await supabase.from('favorite_dishes').select('dish_key');
  if (error) throw error;
  return new Set((data || []).map((row) => row.dish_key));
}

export async function setFavorite(dishName, favorite) {
  if (favorite) {
    const { error } = await supabase.from('favorite_dishes').insert({ dish_name: dishName.trim() });
    if (error && !/duplicate|favorite_dishes_pkey/i.test(error.message)) throw error;
  } else {
    const { error } = await supabase.from('favorite_dishes').delete().eq('dish_key', dishKey(dishName));
    if (error) throw error;
  }
}

// [{ day, dish_name, hall_id, hall_name, meals, calories, protein }] for today and tomorrow.
export async function fetchFavoritesOnMenu() {
  const { data, error } = await supabase.rpc('favorites_on_menu');
  if (error) throw error;
  return data || [];
}
