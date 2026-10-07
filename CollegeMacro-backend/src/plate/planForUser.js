const { buildPlatesByHall } = require('./buildPlate');
const { getMyDay } = require('../chat/tools');

// Meal a student is most likely planning, from the campus-local hour.
function currentMeal(timezone, now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(now)
  );
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  return 'dinner';
}

function containsAny(values, needles) {
  const lower = (values || []).map((v) => String(v).toLowerCase());
  return needles.some((needle) => lower.some((v) => v.includes(String(needle).toLowerCase())));
}

// Best plates per hall for the student's remaining macros (or explicit
// targets). input: { day, meal, hall, protein_g, calories, carbs_g, fat_g,
// max_items, respect_my_allergens } - all optional.
function planPlates(ctx, input = {}) {
  const day = input.day === 'tomorrow' ? 'tomorrow' : 'today';
  const meal = input.meal || currentMeal(ctx.school.timezone);
  const remaining = getMyDay(ctx).remaining;

  const target = {
    protein: Math.max(0, input.protein_g ?? remaining.protein_g ?? 0),
    calories: Math.max(0, input.calories ?? remaining.calories ?? 0),
    carbs: input.carbs_g ?? null,
    fat: input.fat_g ?? null,
  };

  if (target.calories < 150) {
    return { day, meal, target, plates: [], message: "You're within 150 calories of your goal for today, so there's no plate to build." };
  }
  if (target.protein <= 0) target.protein = Math.round((target.calories * 0.3) / 4); // ~30% of calories from protein

  const date = day === 'tomorrow' ? ctx.dates.tomorrow : ctx.dates.today;
  const hall = (input.hall || '').trim().toLowerCase();
  const allergens = input.respect_my_allergens === false ? [] : ctx.user.allergens || [];

  const rows = ctx.menuItems.filter(
    (item) =>
      item.menu_date === date &&
      (item.meals || []).includes(meal) &&
      (!hall || item.hall_name.toLowerCase().includes(hall)) &&
      !(allergens.length > 0 && containsAny(item.allergens, allergens))
  );

  const plates = buildPlatesByHall(rows, target, { maxItems: Math.min(Math.max(input.max_items || 4, 1), 6) });
  return {
    day,
    meal,
    target,
    excluded_allergens: allergens,
    plates: plates.slice(0, hall ? 1 : 5),
    message: plates.length === 0 ? `No ${meal} menu with nutrition data${hall ? ` at ${input.hall}` : ''} ${day}.` : null,
  };
}

module.exports = {
  currentMeal,
  planPlates,
};
