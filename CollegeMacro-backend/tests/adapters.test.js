const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { getSchoolConfig } = require('../src/config/schools');
const { getAdapter } = require('../src/adapters');
const { ingestSchool } = require('../src/ingest/ingestSchool');

function fixturePath(...parts) {
  return path.join(__dirname, 'fixtures', ...parts);
}

function readFixture(...parts) {
  return fs.readFileSync(fixturePath(...parts), 'utf8');
}

function readJson(...parts) {
  return JSON.parse(readFixture(...parts));
}

function notFound() {
  const error = new Error('Not Found');
  error.response = { status: 404 };
  return error;
}

// Fake fetcher: routes URLs to fixtures by regex; unknown URLs 404.
function fakeFetcher(routes) {
  const requested = [];
  const resolve = (url) => {
    requested.push(url);
    const route = routes.find(([pattern]) => pattern.test(url));
    if (!route) throw notFound();
    return typeof route[1] === 'function' ? route[1](url) : route[1];
  };
  return {
    requested,
    json: async (url) => resolve(url),
    html: async (url) => resolve(url),
    binary: async (url) => resolve(url),
    close: async () => {},
  };
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

  // Amounts come from the label cell, not the %DV column next to it.
  assert.deepEqual(oatmeal.nutrition, {
    serving_size: '253',
    calories: '183',
    total_fat: '3',
    saturated_fat: '1',
    trans_fat: '0',
    cholesterol: '0',
    sodium: '3',
    total_carbohydrate: '33',
    dietary_fiber: '5',
    sugars: '1',
    protein: '6',
    vitamin_a: '0',
    vitamin_c: '0',
    calcium: '3',
    iron: '11',
  });
});

test('UMich school config carries catalog metadata', () => {
  const school = getSchoolConfig('umich');
  assert.equal(school.status, 'live');
  assert.deepEqual(school.emailDomains, ['umich.edu']);
  assert.equal(school.timezone, 'America/Detroit');
});

const stationLayout = {
  listingUrl: 'https://example.edu/dining/menu',
  selectors: {
    listingHallLinks: '.location-list .hall-link',
    hallName: '.hall-name',
    mealBlocks: '.meal-block',
    mealName: '.meal-title',
    stationBlocks: '.station',
    stationName: '.station-title',
    items: '.menu-item',
    itemName: '.name',
    itemAllergens: '.allergens li',
    itemTraits: '.traits li',
    nutritionRows: '.nutrition > div',
    nutritionRowLabel: 'dt',
    nutritionRowValue: 'dd',
  },
};

const daypartLayout = {
  listingUrl: 'https://example.edu/locations',
  selectors: {
    listingHallLinks: '#locations [data-location]',
    hallName: '.venue-title',
    mealBlocks: '.daypart',
    mealName: '.daypart-name',
    stationBlocks: '.category',
    stationName: '.category-title',
    items: '.entry',
    itemName: '.entry-name',
    itemAllergens: '.entry-allergens li',
    itemTraits: '.entry-traits li',
    nutritionRows: '.entry-nutrition tr',
    nutritionRowLabel: 'th',
    nutritionRowValue: 'td',
  },
};

test('css-selectors adapter merges duplicate menu item across meals', () => {
  const adapter = getAdapter('css-selectors');
  const halls = adapter.listHalls(readFixture('css-selectors-station-layout', 'listing.html'), stationLayout);

  assert.equal(halls.length, 2);
  const kins = halls.find((hall) => hall.slug === 'kinsolving');
  const parsed = adapter.parseHall(readFixture('css-selectors-station-layout', 'kinsolving.html'), kins, stationLayout);

  assert.equal(parsed.hall.name, 'Kins Dining');
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.items[0].meals.sort(), ['breakfast', 'lunch']);
  assert.equal(parsed.items[0].nutrition.calories, '120');
  assert.equal(parsed.items[0].nutrition.protein, '20');
});

test('css-selectors adapter parses normalized nutrition and tags', () => {
  const adapter = getAdapter('css-selectors');
  const halls = adapter.listHalls(readFixture('css-selectors-daypart-layout', 'listing.html'), daypartLayout);

  assert.equal(halls.length, 2);
  const scott = halls.find((hall) => hall.slug === 'scott-traditions');
  const parsed = adapter.parseHall(readFixture('css-selectors-daypart-layout', 'scott-traditions.html'), scott, daypartLayout);

  assert.equal(parsed.hall.slug, 'scott-traditions');
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.items[0].meals, ['dinner']);
  assert.deepEqual(parsed.items[0].allergens, ['Soy']);
  assert.equal(parsed.items[0].nutrition.calories, '430');
  assert.equal(parsed.items[0].nutrition.protein, '36');
});

test('Nutrislice adapter reads stations, nutrition, %DV and tags for the requested day', async () => {
  const school = getSchoolConfig('ohio-state');
  const fetch = fakeFetcher([
    [/\/menu\/api\/schools\/$/, readJson('nutrislice', 'schools.json')],
    [/traditions-at-scott\/menu-type\/dinner\/2026\/10\/07\//, readJson('nutrislice', 'week-dinner.json')],
  ]);

  const halls = await getAdapter('nutrislice').fetchMenus({
    school: { ...school, nutrislice: { ...school.nutrislice, requestDelayMs: 0 } },
    date: '2026-10-07',
    fetch,
  });

  assert.ok(fetch.requested[0].startsWith('https://osu.api.nutrislice.com/menu/api/schools/'));
  assert.equal(halls.length, 1, 'locations with no published menu are skipped');
  const [{ hall, items }] = halls;
  assert.equal(hall.slug, 'traditions-at-scott');
  assert.equal(hall.sourceUrl, 'https://osu.nutrislice.com/menu/traditions-at-scott');

  assert.deepEqual(
    items.map((item) => item.name),
    ['Grilled Chicken Breast', 'Penne Alfredo'],
    'text rows and items without nutrition are dropped'
  );

  const chicken = items[0];
  assert.equal(chicken.subheader, 'Grill');
  assert.deepEqual(chicken.meals, ['dinner']);
  assert.equal(chicken.nutrition.calories, '210');
  assert.equal(chicken.nutrition.protein, '40');
  assert.equal(chicken.nutrition.total_carbohydrate, '1');
  assert.equal(chicken.nutrition.sodium, '430');
  assert.equal(chicken.nutrition.serving_size, '113');
  assert.equal(chicken.nutrition.iron, '10', '1.8 mg iron is 10% DV');
  assert.equal(chicken.nutrition.calcium, '2');
  assert.deepEqual(chicken.traits, ['Halal', 'Gluten Free']);
  assert.deepEqual(chicken.allergens, []);

  const pasta = items[1];
  assert.equal(pasta.subheader, 'Pasta');
  assert.deepEqual(pasta.allergens, ['milk', 'wheat']);
  assert.deepEqual(pasta.traits, ['Vegetarian']);
  assert.equal(pasta.nutrition.serving_size, undefined, 'non-gram serving sizes are not stored');
});

test('Dine On Campus adapter merges periods and reads nutrients and filters', async () => {
  const school = {
    ...getSchoolConfig('texas-am'),
    dineOnCampus: { site: 'tamu', locations: [{ id: 'loc-sbisa', name: 'Sbisa Dining Center' }], requestDelayMs: 0 },
  };
  const fetch = fakeFetcher([
    [/location\/loc-sbisa\/periods\?platform=0&date=2026-10-07$/, readJson('dineoncampus', 'periods.json')],
    [/periods\/p-lunch\?/, readJson('dineoncampus', 'period-lunch.json')],
    [/periods\/p-dinner\?/, readJson('dineoncampus', 'period-dinner.json')],
  ]);

  const halls = await getAdapter('dineoncampus').fetchMenus({ school, date: '2026-10-07', fetch });

  assert.equal(halls.length, 1);
  const [{ hall, items }] = halls;
  assert.equal(hall.slug, 'sbisa-dining-center');
  assert.equal(items.length, 1, 'items without nutrients (Water) are dropped');

  const meatloaf = items[0];
  assert.equal(meatloaf.subheader, 'Homestyle');
  assert.deepEqual(meatloaf.meals.sort(), ['dinner', 'lunch']);
  assert.equal(meatloaf.nutrition.calories, '260', '"Calories From Fat" must not overwrite calories');
  assert.equal(meatloaf.nutrition.calories_from_fat, '99');
  assert.equal(meatloaf.nutrition.protein, '28');
  assert.equal(meatloaf.nutrition.total_carbohydrate, '12');
  assert.equal(meatloaf.nutrition.sugars, '4');
  assert.equal(meatloaf.nutrition.iron, '15');
  assert.deepEqual(meatloaf.allergens, ['egg', 'wheat']);
  assert.deepEqual(meatloaf.traits, ['Balanced U']);
});

test('Purdue adapter fetches item nutrition once and keeps hall coordinates', async () => {
  const fetch = fakeFetcher([
    [/menus\/v2\/locations$/, readJson('purdue', 'locations.json')],
    [/locations\/Wiley\/2026-10-07$/, readJson('purdue', 'menu-wiley.json')],
    [/items\/item-1$/, readJson('purdue', 'item-1.json')],
    [/items\/item-2$/, readJson('purdue', 'item-2.json')],
  ]);

  const school = { ...getSchoolConfig('purdue'), purdue: { locations: ['Wiley'] } };
  const halls = await getAdapter('purdue-hfs').fetchMenus({ school, date: '2026-10-07', fetch });

  assert.equal(halls.length, 1);
  const [{ hall, items }] = halls;
  assert.equal(hall.name, 'Wiley Dining Court');
  assert.equal(hall.latitude, 40.4285);
  assert.equal(fetch.requested.filter((url) => url.endsWith('/items/item-1')).length, 1);

  assert.equal(items.length, 1, 'items with an empty nutrition panel are dropped');
  const burger = items[0];
  assert.deepEqual(burger.meals.sort(), ['dinner', 'lunch']);
  assert.equal(burger.nutrition.calories, '290');
  assert.equal(burger.nutrition.protein, '15');
  assert.equal(burger.nutrition.sodium, '640');
  assert.equal(burger.nutrition.iron, '20');
  assert.deepEqual(burger.allergens, ['soy']);
  assert.deepEqual(burger.traits.sort(), ['Vegan', 'Vegetarian']);
});

test('AI extract adapter fills weekly URL templates and falls back across URLs', async () => {
  const school = getSchoolConfig('fresno-state');
  const pdf = Buffer.from('%PDF-1.4 fake');
  const fetch = fakeFetcher([[/menu-2026-10-04\.pdf$/, { data: pdf, contentType: 'application/pdf' }]]);
  const calls = [];

  const halls = await getAdapter('ai-extract').fetchMenus({
    school,
    date: '2026-10-07', // a Wednesday; the weekly PDF is named for Sunday 2026-10-04
    fetch,
    extract: async (args) => {
      calls.push(args);
      return [{ name: 'Veggie Lasagna', subheader: 'Entrees', meals: ['dinner'], allergens: [], traits: [], nutrition: { calories: '410' }, nutritionSource: 'ai_estimated' }];
    },
  });

  assert.deepEqual(fetch.requested.map((url) => url.split('/').pop()), ['menu-2026-10-4.pdf', 'menu-2026-10-04.pdf']);
  assert.equal(calls[0].source.kind, 'pdf');
  assert.equal(calls[0].date, '2026-10-07');
  assert.equal(halls[0].hall.slug, 'university-dining-hall');
  assert.equal(halls[0].items[0].nutritionSource, 'ai_estimated');
});

test('ingestSchool ingests today and tomorrow in campus time without persisting', async () => {
  const fetch = fakeFetcher([
    [/menus\/v2\/locations$/, readJson('purdue', 'locations.json')],
    [/locations\/Wiley\/\d{4}-\d{2}-\d{2}$/, readJson('purdue', 'menu-wiley.json')],
    [/items\/item-\d$/, (url) => readJson('purdue', `${url.split('/').pop()}.json`)],
  ]);

  const cwd = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-'));
  process.chdir(tmp);
  try {
    const result = await ingestSchool({ schoolSlug: 'purdue', persist: false, fetcher: fetch });
    assert.equal(result.menus.length, 2);
    assert.notEqual(result.menus[0].date, result.menus[1].date);
    assert.equal(result.school.timezone, 'America/Indiana/Indianapolis');
    assert.deepEqual(result.school.email_domains, ['purdue.edu']);
    assert.equal(fs.readdirSync(path.join(tmp, 'parsed_results_json')).length, 2);
  } finally {
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
