// Lists the dining locations a school's platform exposes, to fill in or trim
// its ingestion config:
//   npm run discover -- --school=ohio-state
//   npm run discover -- --platform=nutrislice --district=wisc-housingdining
//   npm run discover -- --platform=dineoncampus --site=tamu
const { getSchoolConfig } = require('../config/schools');
const { createFetcher } = require('../ingest/fetchHtml');

function readArg(name, fallback = '') {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function discoverNutrislice(district, fetch) {
  const schools = await fetch.json(`https://${district}.api.nutrislice.com/menu/api/schools/`);
  return schools.map((school) => ({
    slug: school.slug,
    name: school.name,
    menuTypes: (school.active_menu_types || []).map((type) => type.slug),
  }));
}

async function discoverDineOnCampus(site, fetch) {
  const info = await fetch.json(`https://api.dineoncampus.com/v1/sites/${site}/info`);
  const siteId = info?.site?.id;
  const listing = await fetch.json(
    `https://api.dineoncampus.com/v1/locations/all_locations?platform=0&site_id=${siteId}&for_menus=true&with_address=false&with_buildings=true`
  );
  return (listing.locations || []).map((location) => ({ id: location.id, name: location.name }));
}

async function discoverPurdue(fetch) {
  const listing = await fetch.json('https://api.hfs.purdue.edu/menus/v2/locations', { Accept: 'application/json' });
  return (listing.Location || []).map((l) => ({ name: l.Name, type: l.Type, latitude: l.Latitude, longitude: l.Longitude }));
}

async function main() {
  const school = readArg('school') ? getSchoolConfig(readArg('school')) : null;
  const platform = readArg('platform') || school?.adapter;
  const mode = readArg('mode') || school?.fetchMode || (platform === 'dineoncampus' ? 'browser' : 'http');
  const fetch = await createFetcher({ mode });

  try {
    let result;
    if (platform === 'nutrislice') {
      result = await discoverNutrislice(readArg('district') || school.nutrislice.district, fetch);
    } else if (platform === 'dineoncampus') {
      result = await discoverDineOnCampus(readArg('site') || school.dineOnCampus.site, fetch);
    } else if (platform === 'purdue-hfs') {
      result = await discoverPurdue(fetch);
    } else {
      throw new Error(`Discovery is not supported for platform "${platform}".`);
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await fetch.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
