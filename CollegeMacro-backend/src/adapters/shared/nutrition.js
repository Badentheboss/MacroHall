const { cleanText } = require('./text');

// Canonical nutrition contract shared by every adapter and by the mobile app
// (CollegeMacro-mobile/utils/nutrients.js):
//   calories            kcal
//   protein, total_carbohydrate, total_fat, saturated_fat, trans_fat,
//   dietary_fiber, sugars, added_sugars, serving_size        grams
//   sodium, cholesterol, potassium                           milligrams
//   iron, calcium, vitamin_a, vitamin_c                      % Daily Value
// Values are stored as numeric strings ("430"), matching the UMich data the app
// was built against. Sources that report micronutrients as absolute amounts are
// converted to %DV with toPercentDailyValue().

// Ordered most-specific first: "calories from fat" must not become calories and
// "added sugars" must not become sugars.
const KEY_ALIASES = [
  ['calories from fat', 'calories_from_fat'],
  ['calories', 'calories'],
  ['protein', 'protein'],
  ['added sugar', 'added_sugars'],
  ['sugar', 'sugars'],
  ['sodium', 'sodium'],
  ['cholesterol', 'cholesterol'],
  ['potassium', 'potassium'],
  ['saturated fat', 'saturated_fat'],
  ['trans fat', 'trans_fat'],
  ['total fat', 'total_fat'],
  ['total carbohydrate', 'total_carbohydrate'],
  ['carbohydrate', 'total_carbohydrate'],
  ['dietary fiber', 'dietary_fiber'],
  ['fiber', 'dietary_fiber'],
  ['calcium', 'calcium'],
  ['iron', 'iron'],
  ['vitamin a', 'vitamin_a'],
  ['vitamin c', 'vitamin_c'],
  ['serving size', 'serving_size'],
];

// FDA reference Daily Values used to turn absolute amounts into %DV.
const DAILY_VALUES = {
  iron: { amount: 18, unit: 'mg' },
  calcium: { amount: 1300, unit: 'mg' },
  vitamin_a: { amount: 900, unit: 'mcg' },
  vitamin_c: { amount: 90, unit: 'mg' },
};

const PERCENT_DV_KEYS = new Set(Object.keys(DAILY_VALUES));

function normalizeNutritionKey(label) {
  const normalized = cleanText(label)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[*:]/g, '')
    .replace(/^amount per serving$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';

  for (const [needle, alias] of KEY_ALIASES) {
    if (normalized.includes(needle)) {
      return alias;
    }
  }

  return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeNutritionValue(value) {
  const text = cleanText(value);
  if (!text) return '';

  const number = text.match(/\d+(?:\.\d+)?/);
  return number ? number[0] : text;
}

function formatNumber(value) {
  const rounded = Math.round(Number(value) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// Converts an absolute micronutrient amount to %DV. Returns null when the unit
// cannot be converted (e.g. vitamin A in IU, whose RAE depends on the source).
function toPercentDailyValue(key, amount, unit) {
  const reference = DAILY_VALUES[key];
  const numeric = Number(amount);
  if (!reference || !Number.isFinite(numeric)) return null;

  const normalizedUnit = String(unit || reference.unit).toLowerCase().replace('µ', 'mc');
  if (normalizedUnit === '%' || normalizedUnit === '%dv') return numeric;

  let inReferenceUnit = numeric;
  if (normalizedUnit === 'g' && reference.unit === 'mg') inReferenceUnit = numeric * 1000;
  else if (normalizedUnit === 'mg' && reference.unit === 'mcg') inReferenceUnit = numeric * 1000;
  else if (normalizedUnit === 'mcg' && reference.unit === 'mg') inReferenceUnit = numeric / 1000;
  else if (normalizedUnit === 're' && reference.unit === 'mcg') inReferenceUnit = numeric;
  else if (normalizedUnit !== reference.unit) return null;

  return (inReferenceUnit / reference.amount) * 100;
}

// Builds a canonical nutrition map from (key, amount, unit) triples. Drops
// empty values and converts %DV keys. Keys must already be canonical.
function buildNutrition(entries) {
  const nutrition = {};

  for (const { key, amount, unit } of entries) {
    if (!key || amount === null || amount === undefined || amount === '') continue;
    const numeric = Number(String(amount).replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(numeric)) continue;

    if (PERCENT_DV_KEYS.has(key)) {
      const percent = toPercentDailyValue(key, numeric, unit);
      if (percent !== null) nutrition[key] = formatNumber(percent);
      continue;
    }

    let value = numeric;
    const lowerUnit = String(unit || '').toLowerCase();
    if ((key === 'sodium' || key === 'cholesterol' || key === 'potassium') && lowerUnit === 'g') {
      value = numeric * 1000;
    }
    nutrition[key] = formatNumber(value);
  }

  return nutrition;
}

module.exports = {
  DAILY_VALUES,
  PERCENT_DV_KEYS,
  buildNutrition,
  normalizeNutritionKey,
  normalizeNutritionValue,
  toPercentDailyValue,
};
