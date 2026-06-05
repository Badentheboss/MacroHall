const { extractHallLinksFromListing, parseHallHtmlFromBlocks } = require('./shared/blockParser');

function listHalls(listingHtml, schoolConfig) {
  return extractHallLinksFromListing(listingHtml, schoolConfig);
}

function parseHall(hallHtml, hallMeta, schoolConfig) {
  return parseHallHtmlFromBlocks(hallHtml, hallMeta, schoolConfig);
}

module.exports = {
  id: 'ut-austin',
  listHalls,
  parseHall,
};
