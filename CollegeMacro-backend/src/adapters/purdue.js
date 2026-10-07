// Purdue Housing & Food Services publishes an official, public, unauthenticated
// JSON API (send Accept: application/json):
//   GET https://api.hfs.purdue.edu/menus/v2/locations
//       -> { Location: [{ Name, FormalName, Type, Latitude, Longitude, ... }] }
//   GET https://api.hfs.purdue.edu/menus/v2/locations/{Name}/{YYYY-MM-DD}
//       -> { Meals: [{ Name, Status, Stations: [{ Name, Items: [{ ID, Name, IsVegetarian, Allergens: [{ Name, Value }] }] }] }] }
//   GET https://api.hfs.purdue.edu/menus/v2/items/{ID}
//       -> { Nutrition: [{ Name, LabelValue, DailyValue }] }
const { mergeMenuItems } = require('./shared/normalizeItem');
const { buildNutrition, normalizeNutritionKey, PERCENT_DV_KEYS } = require('./shared/nutrition');
const { normalizeMeals, splitTags } = require('./shared/tags');
const { cleanText, toSlug } = require('./shared/text');
const { mapLimit } = require('./shared/http');

const API = 'https://api.hfs.purdue.edu/menus/v2';
const JSON_HEADERS = { Accept: 'application/json' };

function parseItemNutrition(itemJson) {
  const entries = (itemJson?.Nutrition || []).map((row) => {
    const key = normalizeNutritionKey(row.Name);
    const percent = cleanText(row.DailyValue).match(/(\d+(?:\.\d+)?)\s*%/);

    if (PERCENT_DV_KEYS.has(key) && percent) {
      return { key, amount: percent[1], unit: '%' };
    }

    const label = cleanText(row.LabelValue);
    const match = label.match(/(\d+(?:\.\d+)?)\s*([a-zµ%]*)/i);
    return { key, amount: match ? match[1] : null, unit: match ? match[2] : '' };
  });

  return buildNutrition(entries);
}

function itemTags(item) {
  const names = (item.Allergens || []).filter((a) => a.Value).map((a) => a.Name);
  if (item.IsVegetarian && !names.includes('Vegetarian')) names.push('Vegetarian');
  return splitTags(names);
}

async function fetchMenus({ school, date, fetch }) {
  const config = school.purdue || {};
  const listing = await fetch.json(`${API}/locations`, JSON_HEADERS);
  const wanted = new Set(config.locations || []);
  const locations = (listing.Location || []).filter((location) =>
    wanted.size > 0 ? wanted.has(location.Name) : location.Type === 'Dining Court'
  );

  const nutritionCache = new Map();
  const halls = [];

  for (const location of locations) {
    const menu = await fetch.json(`${API}/locations/${encodeURIComponent(location.Name)}/${date}`, JSON_HEADERS);
    const pending = [];

    for (const meal of menu.Meals || []) {
      for (const station of meal.Stations || []) {
        for (const item of station.Items || []) {
          if (!cleanText(item.Name)) continue;
          pending.push({ meal, station, item });
        }
      }
    }

    // Each item needs its own nutrition request; dining courts repeat items
    // across meals, so cache by id and keep concurrency polite.
    await mapLimit([...new Set(pending.map((p) => p.item.ID).filter(Boolean))], 4, async (id) => {
      if (!nutritionCache.has(id)) {
        nutritionCache.set(id, parseItemNutrition(await fetch.json(`${API}/items/${id}`, JSON_HEADERS)));
      }
    });

    const rawItems = pending
      .map(({ meal, station, item }) => ({
        name: cleanText(item.Name),
        subheader: cleanText(station.Name),
        meals: normalizeMeals(meal.Name),
        ...itemTags(item),
        nutrition: nutritionCache.get(item.ID) || {},
      }))
      .filter((item) => Object.keys(item.nutrition).length > 0);

    const items = mergeMenuItems(rawItems);
    if (items.length === 0) continue;

    halls.push({
      hall: {
        name: cleanText(location.FormalName || location.Name),
        slug: toSlug(location.Name),
        sourceUrl: `https://dining.purdue.edu/menus/${encodeURIComponent(location.Name)}/`,
        latitude: Number.isFinite(location.Latitude) ? location.Latitude : null,
        longitude: Number.isFinite(location.Longitude) ? location.Longitude : null,
      },
      items,
    });
  }

  return halls;
}

module.exports = {
  id: 'purdue-hfs',
  fetchMenus,
  parseItemNutrition,
};
