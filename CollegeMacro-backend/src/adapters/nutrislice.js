// Nutrislice (nutrislice.com) powers menus at Ohio State, Wisconsin, Georgia
// Tech, Virginia Tech, Indiana, CU Boulder and many more. Its public JSON API
// needs no key:
//   GET https://{district}.api.nutrislice.com/menu/api/schools/
//       -> [{ slug, name, active_menu_types: [{ slug, name }] }]
//   GET https://{district}.api.nutrislice.com/menu/api/weeks/school/{school}/menu-type/{type}/{yyyy}/{mm}/{dd}/
//       -> { days: [{ date, menu_items: [...] }] }
// A Nutrislice "school" is one dining location. The district is the subdomain
// in the school's public menu link, e.g. osu.nutrislice.com -> "osu".
const { mergeMenuItems } = require('./shared/normalizeItem');
const { buildNutrition } = require('./shared/nutrition');
const { normalizeMeals, splitTags } = require('./shared/tags');
const { cleanText, toSlug } = require('./shared/text');
const { isNotFound, sleep } = require('./shared/http');
const { splitDate } = require('../ingest/dates');

const NUTRIENTS = {
  calories: ['calories', 'kcal'],
  g_protein: ['protein', 'g'],
  g_carbs: ['total_carbohydrate', 'g'],
  g_fat: ['total_fat', 'g'],
  g_saturated_fat: ['saturated_fat', 'g'],
  g_trans_fat: ['trans_fat', 'g'],
  mg_cholesterol: ['cholesterol', 'mg'],
  mg_sodium: ['sodium', 'mg'],
  mg_potassium: ['potassium', 'mg'],
  g_fiber: ['dietary_fiber', 'g'],
  g_sugar: ['sugars', 'g'],
  g_added_sugar: ['added_sugars', 'g'],
  mg_iron: ['iron', 'mg'],
  mg_calcium: ['calcium', 'mg'],
  mg_vitamin_c: ['vitamin_c', 'mg'],
  re_vitamin_a: ['vitamin_a', 're'],
};

function apiBase(district) {
  return `https://${district}.api.nutrislice.com/menu/api`;
}

function parseNutrition(food) {
  const info = food.rounded_nutrition_info || {};
  const entries = Object.entries(NUTRIENTS).map(([field, [key, unit]]) => ({
    key,
    amount: info[field],
    unit,
  }));

  const serving = food.serving_size_info || {};
  if (/^(g|grams?)$/i.test(cleanText(serving.serving_size_unit))) {
    entries.push({ key: 'serving_size', amount: serving.serving_size_amount, unit: 'g' });
  }

  return buildNutrition(entries);
}

// Turns one day's menu_items into normalized items. Section-title rows name the
// station for the food rows that follow them.
function parseDay(menuItems, meals) {
  const items = [];
  let station = '';

  for (const row of menuItems || []) {
    if (row.is_section_title) {
      station = cleanText(row.text);
      continue;
    }

    const food = row.food;
    const name = cleanText(food?.name);
    if (!name) continue;

    const iconNames = (food.icons?.food_icons || []).map((icon) => icon.name || icon.synced_name);
    const { allergens, traits } = splitTags(iconNames);
    const nutrition = parseNutrition(food);
    if (Object.keys(nutrition).length === 0) continue;

    items.push({ name, subheader: station, meals, allergens, traits, nutrition });
  }

  return items;
}

function selectLocations(locations, config) {
  const include = new Set(config.includeSchools || []);
  const exclude = new Set(config.excludeSchools || []);

  return locations.filter((location) => {
    if (include.size > 0) return include.has(location.slug);
    return !exclude.has(location.slug);
  });
}

async function fetchMenus({ school, date, fetch }) {
  const config = school.nutrislice;
  const base = apiBase(config.district);
  const { year, month, day } = splitDate(date);
  const delayMs = config.requestDelayMs ?? 250;

  const locations = selectLocations(await fetch.json(`${base}/schools/`), config);
  const halls = [];

  for (const location of locations) {
    const menuTypes = (location.active_menu_types || []).filter(
      (type) => !config.menuTypes || config.menuTypes.includes(type.slug)
    );
    const rawItems = [];

    for (const menuType of menuTypes) {
      const url = `${base}/weeks/school/${location.slug}/menu-type/${menuType.slug}/${year}/${month}/${day}/?format=json`;
      let week;
      try {
        week = await fetch.json(url);
      } catch (error) {
        if (isNotFound(error)) continue; // menu type not published for this week
        throw error;
      }

      const today = (week.days || []).find((entry) => entry.date === date);
      if (today) {
        rawItems.push(...parseDay(today.menu_items, normalizeMeals(menuType.name || menuType.slug)));
      }
      await sleep(delayMs);
    }

    const items = mergeMenuItems(rawItems);
    if (items.length === 0) continue;

    halls.push({
      hall: {
        name: cleanText(location.name),
        slug: toSlug(location.slug || location.name),
        sourceUrl: `https://${config.district}.nutrislice.com/menu/${location.slug}`,
      },
      items,
    });
  }

  return halls;
}

module.exports = {
  id: 'nutrislice',
  fetchMenus,
  parseDay,
};
