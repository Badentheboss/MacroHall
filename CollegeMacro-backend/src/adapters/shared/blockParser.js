const cheerio = require('cheerio');
const { mergeMenuItems } = require('./normalizeItem');
const { normalizeNutritionKey, normalizeNutritionValue } = require('./nutrition');
const { cleanText, toAbsoluteUrl, toSlug } = require('./text');

function extractHallLinksFromListing(html, schoolConfig) {
  const $ = cheerio.load(html);
  const halls = [];

  $(schoolConfig.selectors.listingHallLinks).each((_, el) => {
    const name = cleanText($(el).text());
    const href = $(el).attr('href');
    const sourceUrl = toAbsoluteUrl(schoolConfig.listingUrl, href);
    const urlSlug = href ? href.split('/').filter(Boolean).pop() : '';

    halls.push({
      name,
      slug: toSlug(urlSlug || name),
      sourceUrl,
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
    if (!key) return;

    const parsedValue = normalizeNutritionValue(value || label);
    if (parsedValue) {
      nutrition[key] = parsedValue;
    }
  });

  return nutrition;
}

function parseHallHtmlFromBlocks(html, hallMeta, schoolConfig) {
  const $ = cheerio.load(html);
  const selectors = schoolConfig.selectors;
  const hallName = cleanText($(selectors.hallName).first().text()) || hallMeta.name;
  const items = [];

  $(selectors.mealBlocks).each((_, mealEl) => {
    const $meal = $(mealEl);
    const meal = cleanText($meal.find(selectors.mealName).first().text()).toLowerCase();

    $meal.find(selectors.stationBlocks).each((__, stationEl) => {
      const $station = $(stationEl);
      const subheader = cleanText($station.find(selectors.stationName).first().text());

      $station.find(selectors.items).each((___, itemEl) => {
        const $item = $(itemEl);
        const name = cleanText($item.find(selectors.itemName).first().text());
        if (!name) return;

        const allergens = $item
          .find(selectors.itemAllergens)
          .map((_, n) => cleanText($(n).text()))
          .get()
          .filter(Boolean);

        const traits = $item
          .find(selectors.itemTraits)
          .map((_, n) => cleanText($(n).text()))
          .get()
          .filter(Boolean);

        const nutrition = parseNutrition($, $item, selectors);

        items.push({
          name,
          subheader,
          meals: meal ? [meal] : [],
          allergens,
          traits,
          nutrition,
        });
      });
    });
  });

  return {
    hall: {
      name: hallName,
      slug: hallMeta.slug || toSlug(hallName),
      sourceUrl: hallMeta.sourceUrl,
    },
    items: mergeMenuItems(items),
  };
}

module.exports = {
  extractHallLinksFromListing,
  parseHallHtmlFromBlocks,
};
