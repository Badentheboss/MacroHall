const umich = require('./umich');
const cssSelectors = require('./cssSelectors');
const nutrislice = require('./nutrislice');
const dineOnCampus = require('./dineOnCampus');
const purdue = require('./purdue');
const aiExtract = require('./aiExtract');

// Two adapter shapes are supported:
// - HTML adapters export listHalls(listingHtml, school) + parseHall(html, hallMeta, school);
//   ingestSchool fetches the pages for them.
// - API adapters export fetchMenus({ school, date, fetch }) and do their own
//   requests through the injected fetcher, returning [{ hall, items }].
const adapters = {
  [umich.id]: umich,
  [cssSelectors.id]: cssSelectors,
  [nutrislice.id]: nutrislice,
  [dineOnCampus.id]: dineOnCampus,
  [purdue.id]: purdue,
  [aiExtract.id]: aiExtract,
};

function getAdapter(adapterId) {
  const adapter = adapters[adapterId];
  if (!adapter) {
    throw new Error(`No parser adapter registered for: ${adapterId}`);
  }
  return adapter;
}

module.exports = {
  adapters,
  getAdapter,
};
