// Live rec-center occupancy. Connect2Concepts ("GoBoard") is the counter system
// behind many campuses' "facility counts" widgets:
//   GET https://goboardapi.azurewebsites.net/api/FacilityCount/GetCountsByAccount?AccountAPIKey=<key>
//   -> [{ FacilityName, LocationName, LastCount, TotalCapacity, IsClosed, LastUpdatedDateAndTime }]
// Counters refresh about every 30s, so responses are cached briefly per school.
const { occupancy } = require('../config/catalog');
const { fetchJsonWithHttp } = require('../ingest/fetchHtml');

const CACHE_MS = 60 * 1000;
const cache = new Map();

function fromConnect2(rows) {
  const facilities = new Map();
  for (const row of rows || []) {
    const facility = (row.FacilityName || 'Rec center').trim();
    const capacity = Number(row.TotalCapacity) || 0;
    const count = Number(row.LastCount) || 0;
    if (!facilities.has(facility)) facilities.set(facility, []);
    facilities.get(facility).push({
      area: String(row.LocationName || '').trim(),
      count,
      capacity,
      percent: capacity > 0 ? Math.min(100, Math.round((count / capacity) * 100)) : null,
      closed: Boolean(row.IsClosed),
      updated_at: row.LastUpdatedDateAndTime || null,
    });
  }

  return [...facilities.entries()].map(([name, areas]) => ({
    name,
    areas: areas.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)),
  }));
}

async function liveOccupancy(schoolSlug, { fetchJson = fetchJsonWithHttp, now = Date.now() } = {}) {
  const source = occupancy[schoolSlug];
  if (!source) return { provider: null, facilities: [] };

  const cached = cache.get(schoolSlug);
  if (cached && now - cached.at < CACHE_MS) return cached.value;

  if (source.provider !== 'connect2') throw new Error(`Unknown occupancy provider: ${source.provider}`);
  const rows = await fetchJson(
    `https://goboardapi.azurewebsites.net/api/FacilityCount/GetCountsByAccount?AccountAPIKey=${encodeURIComponent(source.accountKey)}`
  );
  const value = { provider: 'connect2', facilities: fromConnect2(rows), fetched_at: new Date(now).toISOString() };
  cache.set(schoolSlug, { at: now, value });
  return value;
}

module.exports = {
  fromConnect2,
  liveOccupancy,
};
