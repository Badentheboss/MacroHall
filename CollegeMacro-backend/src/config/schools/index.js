const umich = require('./umich');
const utAustin = require('./utAustin');
const ohioState = require('./ohioState');

const schools = [umich, utAustin, ohioState];

function getSchoolConfig(schoolSlug) {
  return schools.find((school) => school.slug === schoolSlug);
}

module.exports = {
  schools,
  getSchoolConfig,
};
