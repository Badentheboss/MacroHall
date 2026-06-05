const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { getSchoolConfig } = require('../src/config/schools');
const { getAdapter } = require('../src/adapters');

function fixturePath(...parts) {
  return path.join(__dirname, 'fixtures', ...parts);
}

function readFixture(...parts) {
  return fs.readFileSync(fixturePath(...parts), 'utf8');
}

test('UMich adapter parses hall links and menu items from fixture', () => {
  const school = getSchoolConfig('umich');
  const adapter = getAdapter(school.adapter);

  const listingHtml = readFixture('umich', 'listing.html');
  const halls = adapter.listHalls(listingHtml, school);

  assert.ok(halls.length >= 7);
  assert.ok(halls.some((hall) => hall.slug === 'bursley'));
  assert.ok(!halls.some((hall) => hall.slug === 'select-access'));

  const bursley = halls.find((hall) => hall.slug === 'bursley');
  const bursleyHtml = readFixture('umich', 'bursley.html');
  const parsed = adapter.parseHall(bursleyHtml, bursley, school);

  assert.equal(parsed.hall.slug, 'bursley');
  assert.ok(parsed.items.length > 0);

  const oatmeal = parsed.items.find((item) => item.name.toLowerCase() === 'oatmeal');
  assert.ok(oatmeal);
  assert.ok(oatmeal.meals.includes('breakfast'));
  assert.ok(oatmeal.nutrition.calories);
});

test('UT Austin adapter merges duplicate menu item across meals', () => {
  const school = getSchoolConfig('ut-austin');
  const adapter = getAdapter(school.adapter);

  const listingHtml = readFixture('ut-austin', 'listing.html');
  const halls = adapter.listHalls(listingHtml, school);

  assert.equal(halls.length, 2);
  const kins = halls.find((hall) => hall.slug === 'kinsolving');

  const hallHtml = readFixture('ut-austin', 'kinsolving.html');
  const parsed = adapter.parseHall(hallHtml, kins, school);

  assert.equal(parsed.hall.name, 'Kins Dining');
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.items[0].meals.sort(), ['breakfast', 'lunch']);
  assert.equal(parsed.items[0].nutrition.calories, '120');
  assert.equal(parsed.items[0].nutrition.protein, '20');
});

test('Ohio State adapter parses normalized nutrition and tags', () => {
  const school = getSchoolConfig('ohio-state');
  const adapter = getAdapter(school.adapter);

  const listingHtml = readFixture('ohio-state', 'listing.html');
  const halls = adapter.listHalls(listingHtml, school);

  assert.equal(halls.length, 2);
  const scott = halls.find((hall) => hall.slug === 'scott-traditions');

  const hallHtml = readFixture('ohio-state', 'scott-traditions.html');
  const parsed = adapter.parseHall(hallHtml, scott, school);

  assert.equal(parsed.hall.slug, 'scott-traditions');
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.items[0].meals, ['dinner']);
  assert.deepEqual(parsed.items[0].allergens, ['Soy']);
  assert.equal(parsed.items[0].nutrition.calories, '430');
  assert.equal(parsed.items[0].nutrition.protein, '36');
});
