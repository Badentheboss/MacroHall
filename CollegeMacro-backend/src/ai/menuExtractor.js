// Turns an unstructured menu (web page text, a PDF, or a photo of a menu board)
// into the normalized item shape the adapters produce. This is the fallback for
// dining halls without a parsable platform, and the engine behind crowdsourced
// menu photos.
const cheerio = require('cheerio');
const { createMessage, getModel, outputConfig, textOf } = require('./claude');
const { buildNutrition } = require('../adapters/shared/nutrition');
const { mergeMenuItems } = require('../adapters/shared/normalizeItem');
const { cleanText } = require('../adapters/shared/text');

const MEALS = ['breakfast', 'brunch', 'lunch', 'dinner', 'late night'];
const MAX_TEXT_CHARS = 200000;

const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] };

const MENU_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'station', 'meals', 'allergens', 'traits', 'nutrition', 'nutrition_source'],
        properties: {
          name: { type: 'string' },
          station: { type: 'string' },
          meals: { type: 'array', items: { type: 'string', enum: MEALS } },
          allergens: { type: 'array', items: { type: 'string' } },
          traits: { type: 'array', items: { type: 'string' } },
          nutrition: {
            type: 'object',
            additionalProperties: false,
            required: ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'],
            properties: {
              calories: nullableNumber,
              protein_g: nullableNumber,
              carbs_g: nullableNumber,
              fat_g: nullableNumber,
              fiber_g: nullableNumber,
              sugar_g: nullableNumber,
              sodium_mg: nullableNumber,
            },
          },
          nutrition_source: { type: 'string', enum: ['printed', 'estimated', 'none'] },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You extract dining hall menus for a college nutrition app.
Return every food item served on the requested date, one entry per distinct dish. If the source covers several days (e.g. a weekly menu), include only the requested date. Use the station or section heading as "station" (empty string if none). "meals" lists which meals the dish is served at; if the source does not say, infer from the section (e.g. eggs at a breakfast station) and otherwise list all meals the menu covers.
Allergens: lowercase common names (milk, egg, wheat, soy, peanut, tree nut, fish, shellfish, sesame). Traits: dietary labels shown on the menu (Vegan, Vegetarian, Halal, Gluten Free).
Nutrition: when the source prints values, copy them and set nutrition_source "printed". When it does not and estimation is allowed, estimate one standard dining-hall serving and set nutrition_source "estimated". Otherwise set every nutrition field to null and nutrition_source "none".
Skip condiments, beverages, and non-food text such as hours or announcements. Never invent dishes that are not in the source.`;

function htmlToText(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, nav, footer, header, iframe').remove();
  $('br, p, div, li, tr, h1, h2, h3, h4, h5, h6').each((_, el) => {
    $(el).append('\n');
  });
  return $('body')
    .text()
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

// source: { kind: 'html' | 'text' | 'pdf' | 'image', text?, data?: Buffer, mediaType? }
function sourceBlock(source) {
  if (source.kind === 'pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: source.data.toString('base64') },
    };
  }

  if (source.kind === 'image') {
    return {
      type: 'image',
      source: { type: 'base64', media_type: source.mediaType, data: source.data.toString('base64') },
    };
  }

  const text = source.kind === 'html' ? htmlToText(source.text) : cleanText(source.text);
  if (text.length > MAX_TEXT_CHARS) {
    throw new Error(`Menu text is ${text.length} characters; split the source page before extracting.`);
  }
  return { type: 'text', text: `<menu_source>\n${text}\n</menu_source>` };
}

function toNormalizedItems(extracted, { keepWithoutNutrition = false } = {}) {
  const items = [];

  for (const item of extracted.items || []) {
    const name = cleanText(item.name);
    if (!name) continue;

    const n = item.nutrition || {};
    const nutrition = buildNutrition([
      { key: 'calories', amount: n.calories, unit: 'kcal' },
      { key: 'protein', amount: n.protein_g, unit: 'g' },
      { key: 'total_carbohydrate', amount: n.carbs_g, unit: 'g' },
      { key: 'total_fat', amount: n.fat_g, unit: 'g' },
      { key: 'dietary_fiber', amount: n.fiber_g, unit: 'g' },
      { key: 'sugars', amount: n.sugar_g, unit: 'g' },
      { key: 'sodium', amount: n.sodium_mg, unit: 'mg' },
    ]);

    if (Object.keys(nutrition).length === 0 && !keepWithoutNutrition) continue;

    items.push({
      name,
      subheader: cleanText(item.station),
      meals: item.meals || [],
      allergens: (item.allergens || []).map((a) => cleanText(a).toLowerCase()).filter(Boolean),
      traits: (item.traits || []).map(cleanText).filter(Boolean),
      nutrition,
      nutritionSource: item.nutrition_source === 'estimated' ? 'ai_estimated' : 'ai_extracted',
    });
  }

  return mergeMenuItems(items);
}

async function extractMenu({ hallName, date, source, estimateMissingNutrition = true, anthropic }) {
  const instructions =
    `Dining hall: ${hallName}\nDate: ${date}\n` +
    (estimateMissingNutrition
      ? 'Estimation of missing nutrition is allowed.'
      : 'Do not estimate nutrition; use null when values are not printed.');

  const message = await createMessage(
    {
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: outputConfig(getModel(), 'low', { format: { type: 'json_schema', schema: MENU_SCHEMA } }),
      messages: [{ role: 'user', content: [sourceBlock(source), { type: 'text', text: instructions }] }],
    },
    anthropic
  );

  if (message.stop_reason === 'refusal') {
    throw new Error(`Menu extraction was declined for ${hallName}.`);
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error(`Menu for ${hallName} is too long to extract in one request; split the source.`);
  }

  return toNormalizedItems(JSON.parse(textOf(message)));
}

module.exports = {
  MENU_SCHEMA,
  extractMenu,
  htmlToText,
  toNormalizedItems,
};
