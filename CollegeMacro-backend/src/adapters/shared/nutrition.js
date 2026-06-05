const { cleanText } = require('./text');

const KEY_ALIASES = {
  calories: 'calories',
  protein: 'protein',
  sugars: 'sugars',
  sodium: 'sodium',
  cholesterol: 'cholesterol',
  'total fat': 'total_fat',
  'saturated fat': 'saturated_fat',
  'total carbohydrate': 'total_carbohydrate',
  'dietary fiber': 'dietary_fiber',
  calcium: 'calcium',
  iron: 'iron',
  'vitamin a': 'vitamin_a',
  'vitamin c': 'vitamin_c',
  'serving size': 'serving_size',
};

function normalizeNutritionKey(label) {
  const normalized = cleanText(label)
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/:/g, '')
    .replace(/^amount per serving$/i, '')
    .trim();

  if (!normalized) return '';

  for (const [needle, alias] of Object.entries(KEY_ALIASES)) {
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

module.exports = {
  normalizeNutritionKey,
  normalizeNutritionValue,
};
