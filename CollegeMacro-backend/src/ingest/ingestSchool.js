const fs = require('fs');
const path = require('path');

const { getSchoolConfig } = require('../config/schools');
const { getAdapter } = require('../adapters');
const { fetchWithHttp, createBrowser, fetchWithBrowser } = require('./fetchHtml');
const { syncSchoolSnapshot } = require('../db/supabaseRepository');

function ensureOutputDir() {
  const outputDir = path.join(process.cwd(), 'parsed_results_json');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

function writeHallOutput(outputDir, schoolSlug, hall, items) {
  const fileName = `${schoolSlug}-${hall.slug}.json`;
  const payload = {
    school: schoolSlug,
    hall,
    item_count: items.length,
    items,
  };

  fs.writeFileSync(path.join(outputDir, fileName), JSON.stringify(payload, null, 2));
}

async function ingestSchool({ schoolSlug, persist = false }) {
  const schoolConfig = getSchoolConfig(schoolSlug);
  if (!schoolConfig) {
    throw new Error(`Unknown school slug: ${schoolSlug}`);
  }

  const adapter = getAdapter(schoolConfig.adapter);
  const outputDir = ensureOutputDir();

  let browser;
  const useBrowser = schoolConfig.fetchMode === 'browser';

  try {
    if (useBrowser) {
      browser = await createBrowser();
    }

    const listingHtml = useBrowser
      ? await fetchWithBrowser(browser, schoolConfig.listingUrl, schoolConfig.selectors.listingHallLinks)
      : await fetchWithHttp(schoolConfig.listingUrl);

    const halls = adapter.listHalls(listingHtml, schoolConfig);
    const parsedHalls = [];

    for (const hallMeta of halls) {
      const hallHtml = useBrowser
        ? await fetchWithBrowser(browser, hallMeta.sourceUrl, schoolConfig.selectors.itemName)
        : await fetchWithHttp(hallMeta.sourceUrl);

      const parsed = adapter.parseHall(hallHtml, hallMeta, schoolConfig);
      parsedHalls.push(parsed);
      writeHallOutput(outputDir, schoolConfig.slug, parsed.hall, parsed.items);
    }

    const snapshot = {
      school: {
        slug: schoolConfig.slug,
        name: schoolConfig.name,
        listing_url: schoolConfig.listingUrl,
      },
      halls: parsedHalls,
      updated_at: new Date().toISOString(),
    };

    if (persist) {
      await syncSchoolSnapshot(snapshot);
    }

    return snapshot;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  ingestSchool,
};
