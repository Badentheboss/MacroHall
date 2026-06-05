const { schools } = require('./src/config/schools');
const { ingestSchool } = require('./src/ingest/ingestSchool');

async function run() {
  for (const school of schools) {
    console.log(`Ingesting ${school.name} (${school.slug})`);
    await ingestSchool({ schoolSlug: school.slug, persist: true });
  }
  console.log('All school ingestions completed.');
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
