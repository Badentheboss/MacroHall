const fs = require('fs');
const path = require('path');

const { getSchoolConfig } = require('../config/schools');
const { getAdapter } = require('../adapters');
const { createFetcher } = require('./fetchHtml');
const { localDate } = require('./dates');
const { syncSchoolSnapshot } = require('../db/supabaseRepository');

// Ingest today and tomorrow (campus time) so the app always has the next
// meal's menu, whatever time zone the cron runs in.
const DEFAULT_DAY_OFFSETS = [0, 1];

function ensureOutputDir() {
  const outputDir = path.join(process.cwd(), 'parsed_results_json');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

function writeHallOutput(outputDir, schoolSlug, date, hall, items) {
  const fileName = `${schoolSlug}-${date}-${hall.slug}.json`;
  const payload = {
    school: schoolSlug,
    date,
    hall,
    item_count: items.length,
    items,
  };

  fs.writeFileSync(path.join(outputDir, fileName), JSON.stringify(payload, null, 2));
}

// HTML adapters scrape whatever the hall pages show right now, which is today.
async function fetchHtmlAdapterMenus(adapter, school, fetch) {
  const listingHtml = await fetch.html(school.listingUrl, school.selectors.listingHallLinks);
  const halls = adapter.listHalls(listingHtml, school);
  const parsedHalls = [];

  for (const hallMeta of halls) {
    const hallHtml = await fetch.html(hallMeta.sourceUrl, school.selectors.itemName);
    parsedHalls.push(adapter.parseHall(hallHtml, hallMeta, school));
  }

  return parsedHalls;
}

async function ingestSchool({ schoolSlug, persist = false, dayOffsets = DEFAULT_DAY_OFFSETS, fetcher }) {
  const school = getSchoolConfig(schoolSlug);
  if (!school) {
    throw new Error(`Unknown school slug: ${schoolSlug}`);
  }

  const adapter = getAdapter(school.adapter);
  const isApiAdapter = typeof adapter.fetchMenus === 'function';
  const offsets = isApiAdapter ? dayOffsets : [0];
  const outputDir = ensureOutputDir();
  const fetch = fetcher || (await createFetcher({ mode: school.fetchMode }));

  try {
    const menus = [];
    const errors = [];

    for (const offset of offsets) {
      const date = localDate(school.timezone, offset);
      try {
        const halls = isApiAdapter
          ? await adapter.fetchMenus({ school, date, fetch })
          : await fetchHtmlAdapterMenus(adapter, school, fetch);

        for (const { hall, items } of halls) {
          writeHallOutput(outputDir, school.slug, date, hall, items);
        }
        menus.push({ date, halls });
      } catch (error) {
        errors.push(`${date}: ${error.message}`);
      }
    }

    if (menus.length === 0) {
      throw new Error(`No menus ingested for ${school.slug}. ${errors.join('; ')}`);
    }

    const snapshot = {
      school: {
        slug: school.slug,
        name: school.name,
        short_name: school.shortName,
        listing_url: school.listingUrl || null,
        email_domains: school.emailDomains,
        city: school.city,
        state: school.state,
        timezone: school.timezone,
        menu_platform: school.platform,
      },
      menus,
      errors,
      updated_at: new Date().toISOString(),
    };

    if (persist) {
      await syncSchoolSnapshot(snapshot);
    }

    return snapshot;
  } finally {
    if (!fetcher) {
      await fetch.close();
    }
  }
}

module.exports = {
  DEFAULT_DAY_OFFSETS,
  ingestSchool,
};
