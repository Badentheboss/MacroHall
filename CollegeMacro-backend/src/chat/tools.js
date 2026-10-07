// Tools the campus chatbot can call. Each runs against a context loaded once
// per request (the student's school, today's and tomorrow's menus, their
// targets and food log), so tool calls never hit the database.

const MEALS = ['breakfast', 'brunch', 'lunch', 'dinner', 'late night'];

const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });

const TOOL_DEFINITIONS = [
  {
    name: 'list_dining_halls',
    description:
      "Lists the student's campus dining halls that have a menu for the given day, with the meals each serves and how many dishes are listed.",
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['day'],
      properties: {
        day: { type: 'string', enum: ['today', 'tomorrow'] },
      },
    },
  },
  {
    name: 'find_foods',
    description:
      "Searches the student's campus dining menus and returns matching dishes with calories and macros. Use it to show a hall's menu (set hall and meal), to find dishes by name (query), or to rank options for a goal such as high protein (sort_by). Dishes containing the student's saved allergens are excluded unless respect_my_allergens is false.",
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['day', 'meal', 'hall', 'query', 'min_protein_g', 'max_calories', 'sort_by', 'respect_my_allergens', 'limit'],
      properties: {
        day: { type: 'string', enum: ['today', 'tomorrow'] },
        meal: nullable({ type: 'string', enum: MEALS }),
        hall: nullable({ type: 'string', description: 'Dining hall name or part of it' }),
        query: nullable({ type: 'string', description: 'Words to match in the dish name, station or dietary labels' }),
        min_protein_g: nullable({ type: 'number' }),
        max_calories: nullable({ type: 'number' }),
        sort_by: { type: 'string', enum: ['menu_order', 'protein', 'protein_per_calorie', 'calories_low', 'calories_high'] },
        respect_my_allergens: { type: 'boolean' },
        limit: { type: 'integer', description: 'At most 40' },
      },
    },
  },
  {
    name: 'build_plate',
    description:
      "Builds the plate that best hits a macro target from real dining hall menus: picks dishes and servings (up to 2 each) per hall and ranks halls. With protein_g and calories null it targets what the student has left today. Use it for questions like \"I have 60g protein left, what should I eat at South Quad?\". Saved allergens are excluded unless respect_my_allergens is false.",
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['day', 'meal', 'hall', 'protein_g', 'calories', 'carbs_g', 'fat_g', 'max_items', 'respect_my_allergens'],
      properties: {
        day: { type: 'string', enum: ['today', 'tomorrow'] },
        meal: nullable({ type: 'string', enum: MEALS }),
        hall: nullable({ type: 'string', description: 'Limit to one dining hall (name or part of it)' }),
        protein_g: nullable({ type: 'number', description: 'Protein target for this plate; null = remaining today' }),
        calories: nullable({ type: 'number', description: 'Calorie target for this plate; null = remaining today' }),
        carbs_g: nullable({ type: 'number' }),
        fat_g: nullable({ type: 'number' }),
        max_items: nullable({ type: 'integer', description: 'Most distinct dishes on the plate (default 4)' }),
        respect_my_allergens: { type: 'boolean' },
      },
    },
  },
  {
    name: 'get_my_day',
    description:
      "Returns the student's daily calorie and macro targets, what they have logged today, what remains, and their saved allergens and dietary preferences.",
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: [], properties: {} },
  },
];

function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function macros(item) {
  const n = item.nutrition_facts || {};
  return {
    calories: num(n.calories),
    protein_g: num(n.protein),
    carbs_g: num(n.total_carbohydrate),
    fat_g: num(n.total_fat),
  };
}

function itemsForDay(ctx, day) {
  const date = day === 'tomorrow' ? ctx.dates.tomorrow : ctx.dates.today;
  return ctx.menuItems.filter((item) => item.menu_date === date);
}

function listDiningHalls(ctx, { day }) {
  const halls = new Map();
  for (const item of itemsForDay(ctx, day)) {
    const hall = halls.get(item.hall_name) || { hall: item.hall_name, meals: new Set(), dishes: 0 };
    for (const meal of item.meals || []) hall.meals.add(meal);
    hall.dishes += 1;
    halls.set(item.hall_name, hall);
  }
  return {
    day,
    halls: [...halls.values()].map((hall) => ({ ...hall, meals: [...hall.meals] })),
  };
}

function containsAny(haystack, needles) {
  const lower = (haystack || []).map((value) => String(value).toLowerCase());
  return needles.some((needle) => lower.some((value) => value.includes(String(needle).toLowerCase())));
}

const SORTERS = {
  protein: (a, b) => (b.protein_g ?? -1) - (a.protein_g ?? -1),
  protein_per_calorie: (a, b) =>
    (b.protein_g ?? 0) / Math.max(b.calories ?? Infinity, 1) - (a.protein_g ?? 0) / Math.max(a.calories ?? Infinity, 1),
  calories_low: (a, b) => (a.calories ?? Infinity) - (b.calories ?? Infinity),
  calories_high: (a, b) => (b.calories ?? -1) - (a.calories ?? -1),
};

function findFoods(ctx, input) {
  const myAllergens = ctx.user.allergens || [];
  const query = (input.query || '').trim().toLowerCase();
  const hall = (input.hall || '').trim().toLowerCase();

  let results = itemsForDay(ctx, input.day)
    .filter((item) => !input.meal || (item.meals || []).includes(input.meal))
    .filter((item) => !hall || item.hall_name.toLowerCase().includes(hall))
    .filter(
      (item) =>
        !query ||
        [item.name, item.subheader, ...(item.traits || [])].some((text) => String(text || '').toLowerCase().includes(query))
    )
    .filter((item) => !(input.respect_my_allergens && myAllergens.length > 0 && containsAny(item.allergens, myAllergens)))
    .map((item) => ({
      name: item.name,
      hall: item.hall_name,
      station: item.subheader || null,
      meals: item.meals,
      ...macros(item),
      allergens: item.allergens,
      labels: item.traits,
      nutrition_is_estimate: item.nutrition_source === 'ai_estimated' || item.nutrition_source === 'crowdsourced',
    }))
    .filter((item) => input.min_protein_g == null || (item.protein_g ?? 0) >= input.min_protein_g)
    .filter((item) => input.max_calories == null || (item.calories ?? Infinity) <= input.max_calories);

  if (SORTERS[input.sort_by]) results = [...results].sort(SORTERS[input.sort_by]);

  const limit = Math.min(Math.max(Number(input.limit) || 15, 1), 40);
  return {
    day: input.day,
    total_matches: results.length,
    dishes: results.slice(0, limit),
    excluded_allergens: input.respect_my_allergens ? myAllergens : [],
  };
}

// Mirrors the Dashboard's math: base nutrition x servings, 2000 kcal default.
function getMyDay(ctx) {
  const targets = ctx.user.dailyValues || {};
  const goal = {
    calories: num(targets.dailyCalories) ?? 2000,
    protein_g: num(targets.dailyProtein),
    carbs_g: num(targets.dailyCarbs),
    fat_g: num(targets.dailyFat),
  };

  const eaten = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const logged = [];
  for (const entry of ctx.user.log || []) {
    const servings = num(entry.servings) || 1;
    const base = entry.baseNutrition || entry.nutrition_facts || {};
    eaten.calories += (num(base.calories) || 0) * servings;
    eaten.protein_g += (num(base.protein) || 0) * servings;
    eaten.carbs_g += (num(base.total_carbohydrate) || 0) * servings;
    eaten.fat_g += (num(base.total_fat) || 0) * servings;
    logged.push({ name: entry.name, servings, meal: entry.mealTime || null });
  }

  const remaining = {};
  for (const key of Object.keys(goal)) {
    remaining[key] = goal[key] == null ? null : Math.round(goal[key] - eaten[key]);
    eaten[key] = Math.round(eaten[key]);
  }

  return {
    targets: goal,
    eaten_so_far: eaten,
    remaining,
    logged_today: logged,
    allergens: ctx.user.allergens || [],
    dietary_preferences: ctx.user.preferences || [],
  };
}

// Compact plates for the model: names, servings and macros only.
function buildPlateTool(ctx, input) {
  const { planPlates } = require('../plate/planForUser');
  const result = planPlates(ctx, input);
  return {
    ...result,
    plates: result.plates.slice(0, 3).map((plate) => ({
      hall: plate.hall,
      totals: plate.totals,
      items: plate.items.map((item) => ({
        name: item.name,
        station: item.subheader || null,
        servings: item.servings,
        calories_each: macros(item).calories,
        protein_each_g: macros(item).protein_g,
        nutrition_is_estimate: item.nutrition_source === 'ai_estimated' || item.nutrition_source === 'crowdsourced',
      })),
    })),
  };
}

function runTool(name, input, ctx) {
  switch (name) {
    case 'build_plate':
      return buildPlateTool(ctx, input);
    case 'list_dining_halls':
      return listDiningHalls(ctx, input);
    case 'find_foods':
      return findFoods(ctx, input);
    case 'get_my_day':
      return getMyDay(ctx);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  findFoods,
  getMyDay,
  listDiningHalls,
  runTool,
};
