const test = require('node:test');
const assert = require('node:assert/strict');

const { extractMenu, htmlToText, MENU_SCHEMA } = require('../src/ai/menuExtractor');

function fakeAnthropic(response) {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async (params) => (calls.push(params), response) } },
  };
}

const extracted = {
  items: [
    {
      name: 'Veggie Lasagna',
      station: 'Entrees',
      meals: ['dinner'],
      allergens: ['Milk', 'wheat'],
      traits: ['Vegetarian'],
      nutrition: { calories: 410, protein_g: 18, carbs_g: 44, fat_g: 17, fiber_g: null, sugar_g: 6, sodium_mg: 690 },
      nutrition_source: 'estimated',
    },
    {
      name: 'Turkey Chili',
      station: 'Soup',
      meals: ['lunch', 'dinner'],
      allergens: [],
      traits: [],
      nutrition: { calories: 280, protein_g: 24, carbs_g: 22, fat_g: 9, fiber_g: 6, sugar_g: 5, sodium_mg: 820 },
      nutrition_source: 'printed',
    },
    {
      name: 'Chef Special',
      station: '',
      meals: ['dinner'],
      allergens: [],
      traits: [],
      nutrition: { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, sugar_g: null, sodium_mg: null },
      nutrition_source: 'none',
    },
  ],
};

test('extractMenu sends a PDF with a strict JSON schema and normalizes the result', async () => {
  const anthropic = fakeAnthropic({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(extracted) }] });

  const items = await extractMenu({
    hallName: 'University Dining Hall',
    date: '2026-10-07',
    source: { kind: 'pdf', data: Buffer.from('%PDF-1.4') },
    anthropic,
  });

  const [request] = anthropic.calls;
  assert.equal(request.output_config.format.type, 'json_schema');
  assert.equal(request.output_config.format.schema, MENU_SCHEMA);
  assert.equal(request.messages[0].content[0].type, 'document');
  assert.equal(request.messages[0].content[0].source.media_type, 'application/pdf');
  assert.match(request.messages[0].content[1].text, /2026-10-07/);

  assert.deepEqual(items.map((item) => item.name), ['Veggie Lasagna', 'Turkey Chili'], 'dishes without nutrition are dropped');
  assert.deepEqual(items[0], {
    name: 'Veggie Lasagna',
    subheader: 'Entrees',
    meals: ['dinner'],
    allergens: ['milk', 'wheat'],
    traits: ['Vegetarian'],
    nutrition: { calories: '410', protein: '18', total_carbohydrate: '44', total_fat: '17', sugars: '6', sodium: '690' },
    nutritionSource: 'ai_estimated',
  });
  assert.equal(items[1].nutritionSource, 'ai_extracted');
});

test('extractMenu reports refusals and truncation instead of storing partial menus', async () => {
  const source = { kind: 'text', text: 'Grilled cheese' };
  await assert.rejects(
    extractMenu({ hallName: 'Hall', date: '2026-10-07', source, anthropic: fakeAnthropic({ stop_reason: 'refusal', content: [] }) }),
    /declined/
  );
  await assert.rejects(
    extractMenu({ hallName: 'Hall', date: '2026-10-07', source, anthropic: fakeAnthropic({ stop_reason: 'max_tokens', content: [] }) }),
    /too long/
  );
});

test('htmlToText keeps menu lines and drops page chrome', () => {
  const text = htmlToText(
    '<html><head><script>track()</script></head><body><nav>Home | About</nav><h2>Dinner</h2><ul><li>Turkey Chili</li><li>Garden Salad</li></ul><footer>(c) 2026</footer></body></html>'
  );
  assert.equal(text, 'Dinner\nTurkey Chili\nGarden Salad');
});
