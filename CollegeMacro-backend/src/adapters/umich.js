const cheerio = require('cheerio');
const { mergeMenuItems } = require('./shared/normalizeItem');
const { normalizeNutritionKey, normalizeNutritionValue } = require('./shared/nutrition');
const { cleanText, toAbsoluteUrl, toSlug } = require('./shared/text');

function listHalls(listingHtml, schoolConfig) {
  const $ = cheerio.load(listingHtml);
  const selectors = schoolConfig.selectors;
  const ignore = new Set(schoolConfig.ignoreHallSlugs || []);
  const halls = [];

  $(selectors.listingHallLinks).each((_, el) => {
    const href = $(el).attr('href');
    const name = cleanText($(el).text());
    const slugFromUrl = href ? href.split('/').filter(Boolean).pop() : '';
    const slug = toSlug(slugFromUrl || name);

    if (!name || ignore.has(slug)) return;

    halls.push({
      name,
      slug,
      sourceUrl: toAbsoluteUrl(schoolConfig.listingUrl, href),
    });
  });

  return halls;
}

function parseNutrition($, $item, selectors) {
  const nutrition = {};

  $item.find(selectors.nutritionRows).each((_, row) => {
    const label = cleanText($(row).find(selectors.nutritionRowLabel).first().text());
    const value = cleanText($(row).find(selectors.nutritionRowValue).first().text());

    const key = normalizeNutritionKey(label);
    if (!key || key === 'amount_per_serving') return;

    const parsedValue = normalizeNutritionValue(value || label);
    if (parsedValue) {
      nutrition[key] = parsedValue;
    }
  });

  return nutrition;
}

function parseHall(hallHtml, hallMeta, schoolConfig) {
  const $ = cheerio.load(hallHtml);
  const selectors = schoolConfig.selectors;

  const hallName = cleanText($(selectors.hallName).first().text()) || hallMeta.name;

  $(selectors.mealHeading).each((_, mealHeading) => {
    const mealName = cleanText($(mealHeading).text().replace(/^[-+]/, '')).toLowerCase();
    const $container = $(mealHeading).parent().next();

    if (!$container || !mealName) return;

    $container.find(selectors.mealHeadingItemsSelector).each((__, itemRow) => {
      $(itemRow).attr('data-meal', mealName);
    });
  });

  const rawItems = [];

  $(selectors.courseSections).each((_, courseSection) => {
    const subheader = cleanText($(courseSection).find(selectors.courseTitle).first().text());

    $(courseSection).find(selectors.courseItems).each((__, itemEl) => {
      const $item = $(itemEl);
      const name = cleanText($item.find(selectors.itemName).first().text());
      if (!name) return;

      const meal = cleanText($item.attr('data-meal')).toLowerCase();

      const allergens = $item
        .find(selectors.itemAllergens)
        .map((___, n) => cleanText($(n).text()))
        .get()
        .filter(Boolean);

      const traits = $item
        .find(selectors.itemTraits)
        .map((___, n) => cleanText($(n).text()))
        .get()
        .filter(Boolean);

      const nutrition = parseNutrition($, $item, selectors);

      rawItems.push({
        name,
        subheader,
        meals: meal ? [meal] : [],
        allergens,
        traits,
        nutrition,
      });
    });
  });

  return {
    hall: {
      name: hallName,
      slug: hallMeta.slug || toSlug(hallName),
      sourceUrl: hallMeta.sourceUrl,
    },
    items: mergeMenuItems(rawItems).filter((item) => Object.keys(item.nutrition).length > 0),
  };
}

module.exports = {
  id: 'umich',
  listHalls,
  parseHall,
};
