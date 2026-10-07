// Canned answers for the backend routes in demo mode. The plate builder runs a
// small greedy version of the real one over the demo menus; the assistant
// gives a menu-aware stock reply since there's no Claude call without a backend.
import { ME, TIMEZONE, campusDate } from './data';

function currentMeal() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  return 'dinner';
}

function remainingToday(db) {
  const me = db.users.find((u) => u.id === ME);
  const goals = me?.dailyValues || {};
  const sum = (key) => (me?.log || []).reduce((total, e) => total + Number(e.nutrition_facts?.[key] || 0), 0);
  return {
    calories: Math.max(0, (goals.dailyCalories || 2000) - sum('calories')),
    protein: Math.max(0, (goals.dailyProtein || 50) - sum('protein')),
  };
}

// Highest protein-per-calorie dishes first, adding servings until the protein
// target is met or the next one would blow the calorie budget.
function plateFor(items, target, maxItems = 5) {
  const ranked = [...items].sort((a, b) => b.nutrition_facts.protein / b.nutrition_facts.calories - a.nutrition_facts.protein / a.nutrition_facts.calories);
  const chosen = new Map();
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const add = (item) => {
    const entry = chosen.get(item.id) || { ...item, servings: 0 };
    entry.servings += 1;
    chosen.set(item.id, entry);
    totals.calories += item.nutrition_facts.calories;
    totals.protein += item.nutrition_facts.protein;
    totals.carbs += item.nutrition_facts.total_carbohydrate;
    totals.fat += item.nutrition_facts.total_fat;
  };

  for (const item of ranked) {
    if (totals.protein >= target.protein || chosen.size >= maxItems) break;
    for (let servings = 0; servings < 2 && totals.protein < target.protein; servings++) {
      if (totals.calories + item.nutrition_facts.calories > target.calories) break;
      add(item);
    }
  }
  // Fill leftover calories with a carb side, like a real plate.
  const side = items.find((i) => /rice|pasta|oatmeal|toast/i.test(i.name) && !chosen.has(i.id));
  if (side && totals.calories + side.nutrition_facts.calories <= target.calories) add(side);

  return { items: [...chosen.values()], totals: { ...totals, calories: Math.round(totals.calories) } };
}

function plate(db, body) {
  const meal = body.meal || currentMeal();
  const left = remainingToday(db);
  const target = {
    protein: body.protein_g ?? Math.round(left.protein),
    calories: body.calories ?? Math.round(left.calories),
  };
  if (!body.protein_g && !body.calories && target.calories < 150) {
    return { day: 'today', meal, target, plates: [], message: "You're within 150 calories of your goal for today, so there's no plate to build." };
  }
  // One meal shouldn't try to cover a whole day.
  target.protein = Math.min(target.protein, 80);
  target.calories = Math.min(target.calories, 1100);

  const hallQuery = (body.hall || '').trim().toLowerCase();
  const today = campusDate(0);
  const plates = db.dining_halls
    .filter((hall) => !hallQuery || hall.name.toLowerCase().includes(hallQuery) || hall.slug === hallQuery)
    .map((hall) => {
      const items = db.menu_items_flat.filter((i) => i.hall_id === hall.id && i.menu_date === today && i.meals.includes(meal));
      return { hall: hall.name, ...plateFor(items, target) };
    })
    .filter((p) => p.items.length > 0)
    .sort((a, b) => Math.abs(a.totals.protein - target.protein) - Math.abs(b.totals.protein - target.protein));

  return {
    day: 'today',
    meal,
    target,
    excluded_allergens: [],
    plates: plates.slice(0, hallQuery ? 1 : 5),
    message: plates.length === 0 ? `No ${meal} menu ${hallQuery ? `at ${body.hall} ` : ''}today.` : null,
  };
}

function chat(db, messages) {
  const question = (messages[messages.length - 1]?.content || '').toLowerCase();
  const meal = currentMeal();
  const today = campusDate(0);
  const menu = db.menu_items_flat.filter((i) => i.menu_date === today && i.meals.includes(meal));
  const top = [...menu]
    .sort((a, b) => b.nutrition_facts.protein - a.nutrition_facts.protein)
    .filter((item, index, all) => all.findIndex((other) => other.name === item.name) === index)
    .slice(0, 3);
  const left = remainingToday(db);
  const note = '\n\n(Demo mode: sample data. Run npm run dev with your keys for the real assistant.)';

  if (/gym|busy|crowd|ccrb|ncrb/.test(question)) {
    return `CCRB is the busiest right now (about 70% on the weight floor). NCRB is quieter, around 30%, and Maya is at CCRB.${note}`;
  }
  if (/friend|who/.test(question)) {
    return `Jordan is at South Quad, Priya is at Mosher-Jordan and Maya is lifting at CCRB.${note}`;
  }
  const picks = top.map((item) => `• ${item.name} at ${item.hall_name}: ${item.nutrition_facts.protein}g protein, ${item.nutrition_facts.calories} cal`).join('\n');
  return `You have about ${Math.round(left.protein)}g protein and ${Math.round(left.calories)} calories left today. Best ${meal} protein on campus right now:\n${picks}${note}`;
}

const LIVE = {
  facilities: [
    {
      name: 'CCRB',
      areas: [
        { area: 'Weight Room', count: 142, capacity: 200, percent: 71 },
        { area: 'Cardio Deck', count: 38, capacity: 90, percent: 42 },
        { area: 'Basketball Courts', count: 22, capacity: 60, percent: 37 },
        { area: 'Pool', closed: true, count: 0, capacity: 80, percent: null },
      ],
    },
    {
      name: 'NCRB',
      areas: [
        { area: 'Weight Room', count: 31, capacity: 110, percent: 28 },
        { area: 'Cardio', count: 12, capacity: 50, percent: 24 },
      ],
    },
  ],
};

export function createDemoBackend(client) {
  const db = client.db;
  return async function demoBackend(method, path, body) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (path === '/plate') return plate(db, body || {});
    if (path === '/chat') return { reply: chat(db, body?.messages || []) };
    if (path === '/gyms/live') return { ...LIVE, fetched_at: new Date().toISOString() };
    if (path === '/menus/photo') {
      const error = new Error('Snapping a menu needs the real backend. Run npm run dev with your keys.');
      error.status = 501;
      throw error;
    }
    const error = new Error(`Demo mode doesn't implement ${method} ${path}.`);
    error.status = 404;
    throw error;
  };
}
