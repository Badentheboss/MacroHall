// Dine On Campus (dineoncampus.com, Chartwells/Compass schools such as Texas
// A&M, Pitt, Houston). Menu endpoints, as consumed by working open-source
// clients:
//   GET https://api.dineoncampus.com/v1/location/{locationId}/periods?platform=0&date=YYYY-MM-DD
//       -> { periods: [{ id, name }] }
//   GET https://api.dineoncampus.com/v1/location/{locationId}/periods/{periodId}?platform=0&date=YYYY-MM-DD
//       -> { menu: { periods: { categories: [{ name, items: [{ name, portion,
//            nutrients: [{ name, value, uom, value_numeric }],
//            filters: [{ name, type: 'allergen' | 'label' }] }] }] } } }
// The API sits behind bot protection, so schools on this platform should use
// fetchMode 'browser'. Location ids can be pinned in config; otherwise they are
// discovered through the site endpoints the dineoncampus.com web app calls
// (verify on the first live run).
const { mergeMenuItems } = require('./shared/normalizeItem');
const { buildNutrition, normalizeNutritionKey } = require('./shared/nutrition');
const { normalizeMeals } = require('./shared/tags');
const { cleanText, toSlug } = require('./shared/text');
const { sleep } = require('./shared/http');

const API = 'https://api.dineoncampus.com/v1';

function parseNutrients(nutrients) {
  return buildNutrition(
    (nutrients || []).map((nutrient) => ({
      key: normalizeNutritionKey(nutrient.name),
      amount: nutrient.value_numeric !== undefined && nutrient.value_numeric !== '' ? nutrient.value_numeric : nutrient.value,
      unit: nutrient.uom,
    }))
  );
}

function parsePeriodMenu(menuJson, periodName) {
  const meals = normalizeMeals(periodName);
  const categories = menuJson?.menu?.periods?.categories || [];
  const items = [];

  for (const category of categories) {
    for (const item of category.items || []) {
      const name = cleanText(item.name);
      if (!name) continue;

      const filters = item.filters || [];
      const nutrition = parseNutrients(item.nutrients);
      if (Object.keys(nutrition).length === 0) continue;

      items.push({
        name,
        subheader: cleanText(category.name),
        meals,
        allergens: filters.filter((f) => f.type === 'allergen').map((f) => cleanText(f.name).toLowerCase()),
        traits: filters.filter((f) => f.type === 'label').map((f) => cleanText(f.name)),
        nutrition,
      });
    }
  }

  return items;
}

async function discoverLocations(config, fetch) {
  if (Array.isArray(config.locations) && config.locations.length > 0) {
    return config.locations;
  }

  const info = await fetch.json(`${API}/sites/${config.site}/info`);
  const siteId = info?.site?.id;
  if (!siteId) {
    throw new Error(`Dine On Campus site "${config.site}" returned no id; pin locations in the school config.`);
  }

  const listing = await fetch.json(
    `${API}/locations/all_locations?platform=0&site_id=${siteId}&for_menus=true&with_address=false&with_buildings=true`
  );
  const exclude = new Set(config.excludeLocations || []);
  return (listing.locations || [])
    .map((location) => ({ id: location.id, name: location.name }))
    .filter((location) => location.id && !exclude.has(location.name));
}

async function fetchMenus({ school, date, fetch }) {
  const config = school.dineOnCampus;
  const delayMs = config.requestDelayMs ?? 2000;
  const locations = await discoverLocations(config, fetch);
  const halls = [];

  for (const location of locations) {
    const periodsJson = await fetch.json(`${API}/location/${location.id}/periods?platform=0&date=${date}`);
    await sleep(delayMs);
    const rawItems = [];

    for (const period of periodsJson.periods || []) {
      const menuJson = await fetch.json(
        `${API}/location/${location.id}/periods/${period.id}?platform=0&date=${date}`
      );
      rawItems.push(...parsePeriodMenu(menuJson, period.name));
      await sleep(delayMs);
    }

    const items = mergeMenuItems(rawItems);
    if (items.length === 0) continue;

    halls.push({
      hall: {
        name: cleanText(location.name),
        slug: toSlug(location.name),
        sourceUrl: `https://dineoncampus.com/${config.site}`,
      },
      items,
    });
  }

  return halls;
}

module.exports = {
  id: 'dineoncampus',
  fetchMenus,
  parsePeriodMenu,
};
