// Runs one school's adapter for today and saves every response it fetched
// under tests/fixtures/captured/<school>/, so tests can use real payloads:
//   npm run capture -- --school=ohio-state
const fs = require('fs');
const path = require('path');

const { getSchoolConfig } = require('../config/schools');
const { getAdapter } = require('../adapters');
const { createFetcher } = require('../ingest/fetchHtml');
const { localDate } = require('../ingest/dates');

function readArg(name, fallback = '') {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function fileNameFor(url, extension) {
  const slug = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return `${slug.slice(-150)}.${extension}`;
}

async function main() {
  const school = getSchoolConfig(readArg('school'));
  if (!school) throw new Error('Pass --school=<slug> for a configured school.');

  const adapter = getAdapter(school.adapter);
  if (typeof adapter.fetchMenus !== 'function') {
    throw new Error(`${school.slug} uses an HTML adapter; save its pages from a browser instead.`);
  }

  const outDir = path.join(__dirname, '..', '..', 'tests', 'fixtures', 'captured', school.slug);
  fs.mkdirSync(outDir, { recursive: true });
  const inner = await createFetcher({ mode: school.fetchMode });

  const recording = {
    ...inner,
    json: async (url, headers) => {
      const data = await inner.json(url, headers);
      fs.writeFileSync(path.join(outDir, fileNameFor(url, 'json')), JSON.stringify(data, null, 2));
      return data;
    },
    binary: async (url) => {
      const result = await inner.binary(url);
      const extension = /pdf/.test(result.contentType) ? 'pdf' : 'html';
      fs.writeFileSync(path.join(outDir, fileNameFor(url, extension)), result.data);
      return result;
    },
  };

  try {
    const date = localDate(school.timezone);
    const halls = await adapter.fetchMenus({ school, date, fetch: recording });
    console.log(`Captured ${halls.length} halls for ${school.slug} on ${date} into ${outDir}`);
  } finally {
    await inner.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
