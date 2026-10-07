const { ingestSchool } = require('../ingest/ingestSchool');
const { schools } = require('../config/schools');

function readArg(name, fallback = '') {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

function summarize(result) {
  return result.menus
    .map((menu) => {
      const items = menu.halls.reduce((sum, hall) => sum + hall.items.length, 0);
      return `${menu.date}: ${menu.halls.length} halls, ${items} items`;
    })
    .join(' | ');
}

async function main() {
  const schoolSlug = readArg('school', 'umich');
  const persist = readArg('persist', 'false') === 'true';
  const targets = schoolSlug === 'all' ? schools.map((school) => school.slug) : [schoolSlug];
  const failures = [];

  // One school failing (a site redesign, a timeout) must not stop the others.
  for (const slug of targets) {
    try {
      const result = await ingestSchool({ schoolSlug: slug, persist });
      console.log(`${slug}: ${summarize(result)}`);
      for (const warning of result.errors) console.warn(`${slug}: ${warning}`);
    } catch (error) {
      failures.push(slug);
      console.error(`${slug}: FAILED - ${error.message}`);
    }
  }

  if (failures.length > 0) {
    console.error(`Ingestion failed for: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

main();
