const { cleanText } = require('./text');

// Vendor platforms mix allergens and dietary labels in one icon list. Anything
// matching these words is treated as an allergen; everything else is a trait.
const ALLERGEN_PATTERNS = [
  /\bmilk\b/i,
  /\bdairy\b/i,
  /\beggs?\b/i,
  /\bfish\b/i,
  /shellfish/i,
  /crustacean/i,
  /tree ?nuts?/i,
  /peanuts?/i,
  /\bwheat\b/i,
  /gluten(?! ?free)/i,
  /\bsoy/i,
  /sesame/i,
  /mustard/i,
  /coconut/i,
];

const FREE_FROM_PATTERN = /\b(free|friendly|without|no)\b/i;

function stripContainsPrefix(name) {
  return cleanText(name).replace(/^contains:?\s+/i, '');
}

function isAllergenName(name) {
  const text = cleanText(name);
  if (!text || FREE_FROM_PATTERN.test(text)) return false;
  return ALLERGEN_PATTERNS.some((pattern) => pattern.test(text));
}

function splitTags(names) {
  const allergens = [];
  const traits = [];

  for (const raw of names || []) {
    const name = cleanText(raw);
    if (!name) continue;
    if (isAllergenName(name)) {
      const allergen = stripContainsPrefix(name).toLowerCase();
      if (!allergens.includes(allergen)) allergens.push(allergen);
    } else if (!traits.includes(name)) {
      traits.push(name);
    }
  }

  return { allergens, traits };
}

const MEAL_PATTERNS = [
  [/brunch/i, 'brunch'],
  [/breakfast/i, 'breakfast'],
  [/lunch/i, 'lunch'],
  [/dinner|supper/i, 'dinner'],
  [/late ?night/i, 'late night'],
];

// "Breakfast & Lunch" (a combined Nutrislice menu type) maps to both meals.
function normalizeMeals(label) {
  const text = cleanText(label);
  const meals = MEAL_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, meal]) => meal);
  if (meals.includes('brunch')) return ['brunch'];
  if (meals.length > 0) return meals;
  return text ? [text.toLowerCase()] : [];
}

module.exports = {
  isAllergenName,
  normalizeMeals,
  splitTags,
};
