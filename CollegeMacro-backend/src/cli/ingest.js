const { ingestSchool } = require('../ingest/ingestSchool');
const { schools } = require('../config/schools');

function readArg(name, fallback = '') {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

async function main() {
  const schoolSlug = readArg('school', 'umich');
  const persist = readArg('persist', 'false') === 'true';

  if (schoolSlug === 'all') {
    for (const school of schools) {
      console.log(`Ingesting ${school.slug}...`);
      await ingestSchool({ schoolSlug: school.slug, persist });
    }
    console.log('Ingestion complete for all schools.');
    return;
  }

  const result = await ingestSchool({ schoolSlug, persist });
  console.log(`Ingested ${result.halls.length} halls for ${result.school.slug}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
