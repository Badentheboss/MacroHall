// dineoncampus.com/tamu. Pin location ids here after the first discovery run
// (npm run discover -- --school=texas-am) to skip discovery requests.
module.exports = {
  slug: 'texas-am',
  adapter: 'dineoncampus',
  fetchMode: 'browser',
  dineOnCampus: {
    site: 'tamu',
    locations: [],
  },
};
