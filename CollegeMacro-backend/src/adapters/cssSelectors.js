// Generic HTML adapter for schools whose menu pages follow a
// listing -> hall page -> meal -> station -> item layout. Everything school
// specific lives in the config's `selectors`; capture a real page into
// tests/fixtures before relying on a new selector set.
const { extractHallLinksFromListing, parseHallHtmlFromBlocks } = require('./shared/blockParser');

module.exports = {
  id: 'css-selectors',
  listHalls: extractHallLinksFromListing,
  parseHall: parseHallHtmlFromBlocks,
};
