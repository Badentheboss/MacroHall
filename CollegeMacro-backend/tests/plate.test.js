const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { buildPlate, buildPlatesByHall } = require('../src/plate/buildPlate');
const { currentMeal, planPlates } = require('../src/plate/planForUser');
const { runTool } = require('../src/chat/tools');
const { fromConnect2 } = require('../src/gyms/occupancy');
const { createApp } = require('../src/server');

function dish(name, calories, protein, carbs = 0, fat = 0, extra = {}) {
  return {
    hall_id: 1,
    hall_name: 'Bursley',
    menu_date: '2026-10-07',
    name,
    subheader: 'Main',
    meals: ['dinner'],
    allergens: [],
    traits: [],
    nutrition_facts: { calories: String(calories), protein, total_carbohydrate: carbs, total_fat: fat },
    nutrition_source: 'official',
    ...extra,
  };
}

const MENU = [
  dish('Grilled Chicken', 210, 40, 1, 4.5),
  dish('Brown Rice', 200, 4, 42, 1.5),
  dish('Steamed Broccoli', 50, 4, 8, 0.5),
  dish('Mac and Cheese', 520, 18, 55, 24),
  dish('Chocolate Chip Cookie', 300, 3, 40, 14),
  dish('Ketchup', 15, 0, 4, 0),
];

test('plate builder hits protein without blowing the calorie target', () => {
  const plate = buildPlate(MENU, { protein: 60, calories: 650 });
  assert.ok(plate.totals.protein >= 54, `protein ${plate.totals.protein}`);
  assert.ok(plate.totals.calories <= 700, `calories ${plate.totals.calories}`);
  assert.ok(plate.items.length <= 4);
  assert.ok(plate.items.every((item) => item.servings >= 1 && item.servings <= 2));
  assert.ok(!plate.items.some((item) => item.name === 'Ketchup'), 'condiments are skipped');
  assert.equal(plate.items[0].name, 'Grilled Chicken', 'biggest protein source listed first');
  assert.equal(plate.items[0].nutrition_facts.calories, '210', 'original menu rows are returned for logging');
});

test('plate builder doubles up when one dish is the efficient choice', () => {
  const plate = buildPlate(MENU, { protein: 80, calories: 450 });
  const chicken = plate.items.find((item) => item.name === 'Grilled Chicken');
  assert.equal(chicken.servings, 2);
  assert.ok(plate.totals.calories <= 520);
});

test('plates are ranked across halls', () => {
  const rows = [
    ...MENU,
    dish('Fried Rice', 450, 10, 60, 16, { hall_id: 2, hall_name: 'Markley' }),
    dish('Pizza', 300, 12, 34, 12, { hall_id: 2, hall_name: 'Markley' }),
  ];
  const plates = buildPlatesByHall(rows, { protein: 60, calories: 650 });
  assert.deepEqual(plates.map((p) => p.hall), ['Bursley', 'Markley']);
  assert.ok(plates[0].score < plates[1].score);
  assert.equal(plates[0].hall_id, 1);
});

const ctx = {
  school: { timezone: 'America/Detroit', email_domains: ['umich.edu'] },
  dates: { today: '2026-10-07', tomorrow: '2026-10-08' },
  user: {
    dailyValues: { dailyCalories: 2400, dailyProtein: 180 },
    log: [{ name: 'Oatmeal', servings: 1, baseNutrition: { calories: 1750, protein: 120 } }],
    allergens: ['milk'],
  },
  menuItems: [...MENU, dish('Protein Shake', 160, 30, 6, 3, { allergens: ['milk'] })],
};

test('planPlates targets what is left today and respects allergens', () => {
  const result = planPlates(ctx, { meal: 'dinner' });
  assert.deepEqual(result.target, { protein: 60, calories: 650, carbs: null, fat: null });
  const names = result.plates[0].items.map((item) => item.name);
  assert.ok(!names.includes('Protein Shake'), 'milk allergen excluded');
  assert.deepEqual(result.excluded_allergens, ['milk']);

  const anything = planPlates(ctx, { meal: 'dinner', respect_my_allergens: false, protein_g: 30, calories: 170 });
  assert.ok(anything.plates[0].items.some((item) => item.name === 'Protein Shake'));

  const full = planPlates({ ...ctx, user: { ...ctx.user, log: [{ name: 'Feast', baseNutrition: { calories: 2300, protein: 170 } }] } }, { meal: 'dinner' });
  assert.deepEqual(full.plates, []);
  assert.match(full.message, /within 150 calories/);

  assert.match(planPlates(ctx, { meal: 'breakfast' }).message, /No breakfast menu/);
});

test('currentMeal follows the campus clock', () => {
  assert.equal(currentMeal('America/Detroit', new Date('2026-10-07T12:00:00Z')), 'breakfast'); // 8am
  assert.equal(currentMeal('America/Detroit', new Date('2026-10-07T17:00:00Z')), 'lunch'); // 1pm
  assert.equal(currentMeal('America/Detroit', new Date('2026-10-07T23:00:00Z')), 'dinner'); // 7pm
});

test('chatbot build_plate tool returns compact plates', () => {
  const result = runTool(
    'build_plate',
    { day: 'today', meal: 'dinner', hall: 'burs', protein_g: null, calories: null, carbs_g: null, fat_g: null, max_items: null, respect_my_allergens: true },
    ctx
  );
  assert.equal(result.plates.length, 1);
  assert.equal(result.plates[0].hall, 'Bursley');
  assert.deepEqual(Object.keys(result.plates[0].items[0]).sort(), ['calories_each', 'name', 'nutrition_is_estimate', 'protein_each_g', 'servings', 'station']);
});

test('Connect2 counts are grouped by facility, busiest area first', () => {
  const facilities = fromConnect2([
    { FacilityName: 'CoRec', LocationName: ' Upper Gym ', LastCount: 30, TotalCapacity: 120, IsClosed: false, LastUpdatedDateAndTime: '2026-10-07T17:31:00' },
    { FacilityName: 'CoRec', LocationName: 'Weight Room', LastCount: 90, TotalCapacity: 100, IsClosed: false, LastUpdatedDateAndTime: '2026-10-07T17:32:00' },
    { FacilityName: 'Aquatics', LocationName: 'Pool', LastCount: 0, TotalCapacity: 0, IsClosed: true },
  ]);
  assert.deepEqual(facilities.map((f) => f.name), ['CoRec', 'Aquatics']);
  assert.deepEqual(facilities[0].areas.map((a) => [a.area, a.percent]), [['Weight Room', 90], ['Upper Gym', 25]]);
  assert.equal(facilities[1].areas[0].percent, null);
  assert.equal(facilities[1].areas[0].closed, true);
});

function fakeSupabase() {
  const rows = {
    users: { school_id: 1, dailyValues: ctx.user.dailyValues, log: ctx.user.log, allergens: [], preferences: [], schools: { slug: 'purdue' } },
    schools: { id: 1, name: 'Purdue University', timezone: 'America/Indiana/Indianapolis', email_domains: ['purdue.edu'] },
  };
  return {
    auth: { getUser: async (token) => ({ data: { user: token === 'good' ? { id: 'u1' } : null }, error: token === 'good' ? null : new Error('bad') }) },
    from: (table) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        single: async () => ({ data: rows[table], error: null }),
        range: async () => ({ data: table === 'menu_items_flat' ? MENU.map((m) => ({ ...m, menu_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Indiana/Indianapolis' }).format(new Date()) })) : [], error: null }),
      };
      return builder;
    },
  };
}

async function call(app, method, path, body) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  } finally {
    server.close();
  }
}

test('POST /plate and GET /gyms/live', async () => {
  const fetched = [];
  const app = createApp({
    getSupabase: fakeSupabase,
    occupancyFetch: async (url) => {
      fetched.push(url);
      return [{ FacilityName: 'CoRec', LocationName: 'Weight Room', LastCount: 50, TotalCapacity: 100, IsClosed: false }];
    },
  });

  const plate = await call(app, 'POST', '/plate', { meal: 'dinner', protein_g: 60, calories: 650 });
  assert.equal(plate.status, 200);
  assert.equal(plate.body.plates[0].hall, 'Bursley');
  assert.deepEqual(plate.body.target, { protein: 60, calories: 650, carbs: null, fat: null });

  const live = await call(app, 'GET', '/gyms/live');
  assert.equal(live.status, 200);
  assert.equal(live.body.provider, 'connect2');
  assert.equal(live.body.facilities[0].areas[0].percent, 50);
  assert.match(fetched[0], /goboardapi\.azurewebsites\.net\/api\/FacilityCount\/GetCountsByAccount\?AccountAPIKey=/);
});
