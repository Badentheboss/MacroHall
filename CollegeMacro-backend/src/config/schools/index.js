const { getCatalogEntry } = require('../catalog');

// Ingestion configs. Each one names an adapter plus that adapter's settings;
// school metadata (name, email domains, timezone, status) comes from the
// catalog so it is defined once.
const configs = [
  require('./umich'),
  require('./ohioState'),
  require('./purdue'),
  require('./texasAm'),
  require('./pitt'),
  require('./houston'),
  require('./fresnoState'),
];

const schools = configs.map((config) => {
  const entry = getCatalogEntry(config.slug);
  if (!entry) {
    throw new Error(`School config "${config.slug}" has no catalog entry in src/config/catalog.js`);
  }
  return { ...entry, ...config };
});

function getSchoolConfig(schoolSlug) {
  return schools.find((school) => school.slug === schoolSlug);
}

module.exports = {
  schools,
  getSchoolConfig,
};
