// Ohio State publishes every dining location on Nutrislice (osu.nutrislice.com).
// Locations are discovered from the district on each run; list slugs in
// includeSchools to limit ingestion to the all-you-care-to-eat halls once the
// first live run shows which locations exist.
module.exports = {
  slug: 'ohio-state',
  adapter: 'nutrislice',
  fetchMode: 'http',
  nutrislice: {
    district: 'osu',
    includeSchools: [],
    excludeSchools: [],
  },
};
