const test = require('node:test');
const assert = require('node:assert/strict');

const { buildNutrition, normalizeNutritionKey, toPercentDailyValue } = require('../src/adapters/shared/nutrition');
const { normalizeMeals, splitTags } = require('../src/adapters/shared/tags');
const { localDate } = require('../src/ingest/dates');
const { catalog } = require('../src/config/catalog');
const { schools } = require('../src/config/schools');

test('nutrition keys map specific labels before generic ones', () => {
  assert.equal(normalizeNutritionKey('Calories From Fat'), 'calories_from_fat');
  assert.equal(normalizeNutritionKey('Calories'), 'calories');
  assert.equal(normalizeNutritionKey('Added Sugars'), 'added_sugars');
  assert.equal(normalizeNutritionKey('Sugar (g)'), 'sugars');
  assert.equal(normalizeNutritionKey('Total Carbohydrates (g)'), 'total_carbohydrate');
  assert.equal(normalizeNutritionKey('Saturated Fat'), 'saturated_fat');
  assert.equal(normalizeNutritionKey('Total Fat'), 'total_fat');
  assert.equal(normalizeNutritionKey('Amount Per Serving'), '');
});

test('micronutrients convert to percent daily value', () => {
  assert.equal(toPercentDailyValue('iron', 9, 'mg'), 50);
  assert.equal(toPercentDailyValue('calcium', 25, '%'), 25);
  assert.equal(toPercentDailyValue('vitamin_a', 90, 're'), 10);
  assert.equal(toPercentDailyValue('vitamin_a', 500, 'IU'), null);
  assert.deepEqual(
    buildNutrition([
      { key: 'iron', amount: 1.8, unit: 'mg' },
      { key: 'sodium', amount: '0.5', unit: 'g' },
      { key: 'protein', amount: '12.25', unit: 'g' },
      { key: 'fiber', amount: null, unit: 'g' },
    ]),
    { iron: '10', sodium: '500', protein: '12.3' }
  );
});

test('tags split allergens from dietary labels', () => {
  assert.deepEqual(splitTags(['Contains Milk', 'Vegan', 'Gluten Free', 'Tree Nuts', 'Halal', 'Dairy Free']), {
    allergens: ['milk', 'tree nuts'],
    traits: ['Vegan', 'Gluten Free', 'Halal', 'Dairy Free'],
  });
});

test('meal names normalize, including combined menu types', () => {
  assert.deepEqual(normalizeMeals('Breakfast & Lunch'), ['breakfast', 'lunch']);
  assert.deepEqual(normalizeMeals('Weekend Brunch'), ['brunch']);
  assert.deepEqual(normalizeMeals('Late Night'), ['late night']);
  assert.deepEqual(normalizeMeals('All Day'), ['all day']);
});

test('local dates follow the campus time zone', () => {
  const lateEveningPacific = new Date('2026-10-08T05:00:00Z'); // 10pm Oct 7 in California
  assert.equal(localDate('America/Los_Angeles', 0, lateEveningPacific), '2026-10-07');
  assert.equal(localDate('America/New_York', 0, lateEveningPacific), '2026-10-08');
  assert.equal(localDate('America/Los_Angeles', 1, lateEveningPacific), '2026-10-08');
});

test('catalog entries are well formed and every config has one', () => {
  const slugs = new Set();
  for (const entry of catalog) {
    assert.ok(!slugs.has(entry.slug), `duplicate slug ${entry.slug}`);
    slugs.add(entry.slug);
    assert.ok(entry.emailDomains.length > 0, entry.slug);
    for (const domain of entry.emailDomains) assert.match(domain, /^[a-z0-9.-]+\.edu$/, entry.slug);
    assert.doesNotThrow(() => localDate(entry.timezone), entry.slug);
    assert.ok(['live', 'coming_soon'].includes(entry.status), entry.slug);
  }
  assert.ok(schools.length >= 7);
});
