const { cleanText } = require('./text');

function mergeMenuItems(items) {
  const map = new Map();

  for (const item of items) {
    const name = cleanText(item.name);
    if (!name) continue;

    const subheader = cleanText(item.subheader);
    const key = `${name.toLowerCase()}::${subheader.toLowerCase()}`;

    if (!map.has(key)) {
      map.set(key, {
        name,
        subheader,
        meals: [],
        allergens: [],
        traits: [],
        nutrition: {},
        nutritionSource: item.nutritionSource || 'official',
      });
    }

    const existing = map.get(key);

    for (const meal of item.meals || []) {
      const cleanMeal = cleanText(meal).toLowerCase();
      if (cleanMeal && !existing.meals.includes(cleanMeal)) {
        existing.meals.push(cleanMeal);
      }
    }

    for (const allergen of item.allergens || []) {
      const cleanAllergen = cleanText(allergen);
      if (cleanAllergen && !existing.allergens.includes(cleanAllergen)) {
        existing.allergens.push(cleanAllergen);
      }
    }

    for (const trait of item.traits || []) {
      const cleanTrait = cleanText(trait);
      if (cleanTrait && !existing.traits.includes(cleanTrait)) {
        existing.traits.push(cleanTrait);
      }
    }

    for (const [keyName, value] of Object.entries(item.nutrition || {})) {
      if (value !== '' && value !== null && value !== undefined) {
        existing.nutrition[keyName] = String(value);
      }
    }
  }

  return [...map.values()];
}

module.exports = {
  mergeMenuItems,
};
