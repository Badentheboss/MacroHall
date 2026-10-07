const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { findFoods, getMyDay, listDiningHalls } = require('../src/chat/tools');
const { answer, validateHistory, webSearchTool } = require('../src/chat/chat');
const { createApp } = require('../src/server');

function item(overrides) {
  return {
    hall_name: 'Bursley',
    menu_date: '2026-10-07',
    name: 'Dish',
    subheader: 'Grill',
    meals: ['dinner'],
    allergens: [],
    traits: [],
    nutrition_facts: {},
    nutrition_source: 'official',
    ...overrides,
  };
}

const ctx = {
  school: { id: 1, name: 'University of Michigan', timezone: 'America/Detroit', email_domains: ['umich.edu'] },
  dates: { today: '2026-10-07', tomorrow: '2026-10-08' },
  user: {
    dailyValues: { dailyCalories: 2600, dailyProtein: 180, dailyCarbs: 280, dailyFat: 80 },
    log: [
      { name: 'Oatmeal', servings: 2, baseNutrition: { calories: '183', protein: '6', total_carbohydrate: '33', total_fat: '3' } },
      { name: 'Eggs', nutrition_facts: { calories: 140, protein: 12, total_carbohydrate: 1, total_fat: 10 } },
    ],
    allergens: ['peanut'],
    preferences: ['Halal'],
  },
  menuItems: [
    item({ name: 'Grilled Chicken', nutrition_facts: { calories: 210, protein: 40, total_carbohydrate: 1, total_fat: 4.5 }, traits: ['Halal'] }),
    item({ name: 'Satay Tofu', allergens: ['peanut', 'soy'], nutrition_facts: { calories: 300, protein: 18 } }),
    item({ name: 'Mac and Cheese', subheader: 'Comfort', nutrition_facts: { calories: 520, protein: 18 }, nutrition_source: 'ai_estimated' }),
    item({ name: 'Omelet', hall_name: 'South Quad', meals: ['breakfast'], nutrition_facts: { calories: 250, protein: 20 } }),
    item({ name: 'Tomorrow Steak', menu_date: '2026-10-08', nutrition_facts: { calories: 400, protein: 45 } }),
  ],
};

const baseQuery = {
  day: 'today',
  meal: null,
  hall: null,
  query: null,
  min_protein_g: null,
  max_calories: null,
  sort_by: 'menu_order',
  respect_my_allergens: true,
  limit: 10,
};

test('find_foods ranks protein, filters allergens and flags estimates', () => {
  const result = findFoods(ctx, { ...baseQuery, meal: 'dinner', sort_by: 'protein' });
  assert.deepEqual(result.dishes.map((d) => d.name), ['Grilled Chicken', 'Mac and Cheese']);
  assert.deepEqual(result.excluded_allergens, ['peanut']);
  assert.equal(result.dishes[1].nutrition_is_estimate, true);
  assert.deepEqual(
    { calories: result.dishes[0].calories, protein_g: result.dishes[0].protein_g, fat_g: result.dishes[0].fat_g },
    { calories: 210, protein_g: 40, fat_g: 4.5 }
  );

  const withAllergens = findFoods(ctx, { ...baseQuery, respect_my_allergens: false, min_protein_g: 15, max_calories: 400 });
  assert.deepEqual(withAllergens.dishes.map((d) => d.name).sort(), ['Grilled Chicken', 'Omelet', 'Satay Tofu']);

  assert.deepEqual(findFoods(ctx, { ...baseQuery, query: 'halal' }).dishes.map((d) => d.name), ['Grilled Chicken']);
  assert.deepEqual(findFoods(ctx, { ...baseQuery, hall: 'south' }).dishes.map((d) => d.name), ['Omelet']);
  assert.deepEqual(findFoods(ctx, { ...baseQuery, day: 'tomorrow' }).dishes.map((d) => d.name), ['Tomorrow Steak']);
});

test('list_dining_halls summarizes the day', () => {
  assert.deepEqual(listDiningHalls(ctx, { day: 'today' }), {
    day: 'today',
    halls: [
      { hall: 'Bursley', meals: ['dinner'], dishes: 3 },
      { hall: 'South Quad', meals: ['breakfast'], dishes: 1 },
    ],
  });
});

test('get_my_day matches the dashboard math', () => {
  const day = getMyDay(ctx);
  assert.deepEqual(day.eaten_so_far, { calories: 506, protein_g: 24, carbs_g: 67, fat_g: 16 });
  assert.deepEqual(day.remaining, { calories: 2094, protein_g: 156, carbs_g: 213, fat_g: 64 });
  assert.deepEqual(day.logged_today, [
    { name: 'Oatmeal', servings: 2, meal: null },
    { name: 'Eggs', servings: 1, meal: null },
  ]);
  assert.equal(getMyDay({ ...ctx, user: { log: [] } }).targets.calories, 2000);
});

test('conversation history is validated and trimmed', () => {
  assert.throws(() => validateHistory([]), /non-empty/);
  assert.throws(() => validateHistory([{ role: 'assistant', content: 'hi' }]), /last message/);
  assert.throws(() => validateHistory([{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }]), /alternate/);
  assert.throws(() => validateHistory([{ role: 'user', content: 'x'.repeat(2001) }]), /limited/);

  const long = Array.from({ length: 25 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `m${i}` }));
  const trimmed = validateHistory(long);
  assert.equal(trimmed[0].role, 'user');
  assert.equal(trimmed.at(-1).content, 'm24');
  assert.ok(trimmed.length <= 20);
});

test('web search is limited to the school domains and matches the model generation', () => {
  assert.deepEqual(webSearchTool('claude-opus-5-5', ['umich.edu']), {
    type: 'web_search_20260209',
    name: 'web_search',
    max_uses: 3,
    allowed_domains: ['umich.edu'],
  });
  assert.equal(webSearchTool('claude-haiku-4-5', ['umich.edu']).type, 'web_search_20250305');
  assert.equal(webSearchTool('claude-opus-5-5', []), null);
});

function fakeAnthropic(responses) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        create: async (params) => {
          calls.push(JSON.parse(JSON.stringify(params)));
          return responses.shift();
        },
      },
    },
  };
}

test('answer runs tools server-side and returns the final text', async () => {
  const anthropic = fakeAnthropic([
    {
      stop_reason: 'tool_use',
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'tool_use', id: 'tu1', name: 'get_my_day', input: {} },
        { type: 'tool_use', id: 'tu2', name: 'find_foods', input: { ...baseQuery, sort_by: 'protein', meal: 'dinner' } },
      ],
    },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Grilled Chicken at Bursley: 40g protein / 210 cal.' }] },
  ]);

  const result = await answer({ ctx, messages: [{ role: 'user', content: 'High protein dinner?' }], anthropic });
  assert.equal(result.reply, 'Grilled Chicken at Bursley: 40g protein / 210 cal.');

  const [first, second] = anthropic.calls;
  assert.equal(first.model, 'claude-opus-5-5');
  assert.equal(first.fallbacks, 'default');
  assert.deepEqual(first.betas, ['server-side-fallback-2026-07-01']);
  assert.deepEqual(first.output_config, { effort: 'low' });
  assert.ok(first.tools.every((tool) => tool.type || tool.strict === true));
  assert.deepEqual(first.tools.find((tool) => tool.name === 'web_search').allowed_domains, ['umich.edu']);
  assert.equal(first.system[0].cache_control.type, 'ephemeral');
  assert.match(first.system[1].text, /University of Michigan/);

  // The assistant turn (with its thinking block) is replayed unchanged, and
  // both tool results come back in one user message.
  assert.deepEqual(second.messages[1].content[0], { type: 'thinking', thinking: '', signature: 'sig' });
  const results = second.messages[2].content;
  assert.deepEqual(results.map((r) => r.tool_use_id), ['tu1', 'tu2']);
  assert.equal(JSON.parse(results[0].content).remaining.protein_g, 156);
  assert.equal(JSON.parse(results[1].content).dishes[0].name, 'Grilled Chicken');
});

test('answer handles refusals, pause_turn and bad tool input', async () => {
  const refusal = await answer({
    ctx,
    messages: [{ role: 'user', content: 'hi' }],
    anthropic: fakeAnthropic([{ stop_reason: 'refusal', content: [] }]),
  });
  assert.match(refusal.reply, /can't help/);

  const anthropic = fakeAnthropic([
    { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'rec hours' } }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu1', name: 'nope', input: {} }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'The CCRB closes at 11pm.' }] },
  ]);
  const result = await answer({ ctx, messages: [{ role: 'user', content: 'When does the rec close?' }], anthropic });
  assert.equal(result.reply, 'The CCRB closes at 11pm.');
  assert.equal(anthropic.calls[1].messages.at(-1).role, 'assistant', 'paused turn is resent to continue');
  assert.equal(anthropic.calls[2].messages.at(-1).content[0].is_error, true);
});

// Minimal Supabase stand-in for the HTTP routes.
function fakeSupabase({ quotaOk = true } = {}) {
  const query = (table) => {
    const rows = {
      users: { school_id: 1, dailyValues: ctx.user.dailyValues, log: [], allergens: [], preferences: [] },
      schools: ctx.school,
    };
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      single: async () => ({ data: rows[table], error: null }),
      range: async () => ({ data: table === 'menu_items_flat' ? ctx.menuItems : [], error: null }),
    };
    return builder;
  };
  return {
    auth: {
      getUser: async (token) =>
        token === 'good' ? { data: { user: { id: 'user-1' } }, error: null } : { data: { user: null }, error: new Error('bad') },
    },
    rpc: async () => ({ data: quotaOk, error: null }),
    from: query,
  };
}

async function request(app, { method = 'POST', path, token, body }) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  } finally {
    server.close();
  }
}

test('POST /chat authenticates, enforces the daily quota and answers', async () => {
  const messages = [{ role: 'user', content: 'What should I eat?' }];
  const anthropic = fakeAnthropic([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Try the chicken.' }] }]);

  const ok = await request(createApp({ getSupabase: () => fakeSupabase(), anthropic }), { path: '/chat', token: 'good', body: { messages } });
  assert.deepEqual(ok, { status: 200, body: { reply: 'Try the chicken.' } });

  const unauthenticated = await request(createApp({ getSupabase: () => fakeSupabase(), anthropic }), { path: '/chat', body: { messages } });
  assert.equal(unauthenticated.status, 401);

  const overQuota = await request(createApp({ getSupabase: () => fakeSupabase({ quotaOk: false }), anthropic }), {
    path: '/chat',
    token: 'good',
    body: { messages },
  });
  assert.equal(overQuota.status, 429);

  const badHistory = await request(createApp({ getSupabase: () => fakeSupabase(), anthropic }), {
    path: '/chat',
    token: 'good',
    body: { messages: [{ role: 'assistant', content: 'hi' }] },
  });
  assert.equal(badHistory.status, 400);
});

test('POST /ingest is closed without the operator secret', async () => {
  delete process.env.INGEST_SECRET;
  const response = await request(createApp({ getSupabase: () => fakeSupabase() }), { path: '/ingest?school=umich', token: 'anything' });
  assert.equal(response.status, 403);
});
