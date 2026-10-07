// Fallback for dining halls with no parsable platform: menus published as
// free-form web pages, PDFs (e.g. Fresno State's weekly menu PDFs) or images.
// Each configured hall URL is fetched and handed to Claude for structured
// extraction. Items are tagged ai_extracted / ai_estimated so the app can show
// that the numbers are approximate.
//
// Config:
//   aiExtract: {
//     estimateMissingNutrition: true,
//     halls: [{ name: 'University Dining Hall', url: 'https://.../menu-{yyyy}-{m}-{d}.pdf', weekStartsOn: 0 }],
//   }
// `urls` (an array) may replace `url` when a site names files inconsistently;
// the first URL that does not 404 is used.
// URL tokens: {date} {yyyy} {mm} {dd} {m} {d}. With weekStartsOn (0 = Sunday),
// tokens use the start of the week containing the date, for weekly menus.
const { extractMenu } = require('../ai/menuExtractor');
const { isNotFound } = require('./shared/http');
const { toSlug } = require('./shared/text');

function weekStart(isoDate, weekStartsOn) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const diff = (date.getUTCDay() - weekStartsOn + 7) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

function fillUrl(template, isoDate, weekStartsOn) {
  const effective = Number.isInteger(weekStartsOn) ? weekStart(isoDate, weekStartsOn) : isoDate;
  const [yyyy, mm, dd] = effective.split('-');
  return template
    .replace(/\{date\}/g, effective)
    .replace(/\{yyyy\}/g, yyyy)
    .replace(/\{mm\}/g, mm)
    .replace(/\{dd\}/g, dd)
    .replace(/\{m\}/g, String(Number(mm)))
    .replace(/\{d\}/g, String(Number(dd)));
}

function detectKind(contentType, url) {
  if (/pdf/i.test(contentType) || /\.pdf($|\?)/i.test(url)) return 'pdf';
  if (/^image\//i.test(contentType)) return 'image';
  return 'html';
}

async function loadSource(url, fetch) {
  const { data, contentType } = await fetch.binary(url);
  const kind = detectKind(contentType, url);
  if (kind === 'html') return { kind, text: data.toString('utf8') };
  return { kind, data, mediaType: contentType };
}

async function loadFirstAvailable(urls, fetch) {
  for (const url of urls) {
    try {
      return { url, source: await loadSource(url, fetch) };
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  return null;
}

async function fetchMenus({ school, date, fetch, extract = extractMenu }) {
  const config = school.aiExtract;
  const halls = [];

  for (const hallConfig of config.halls || []) {
    const templates = hallConfig.urls || [hallConfig.url];
    const urls = templates.map((template) => fillUrl(template, date, hallConfig.weekStartsOn));
    const loaded = await loadFirstAvailable(urls, fetch);
    if (!loaded) continue; // menu not published yet for this date
    const { url, source } = loaded;
    const items = await extract({
      hallName: hallConfig.name,
      date,
      source,
      estimateMissingNutrition: config.estimateMissingNutrition !== false,
    });

    halls.push({
      hall: { name: hallConfig.name, slug: hallConfig.slug || toSlug(hallConfig.name), sourceUrl: url },
      items,
    });
  }

  return halls;
}

module.exports = {
  id: 'ai-extract',
  fetchMenus,
  fillUrl,
};
