// Every school the sign-up picker knows about. `live` schools can be chosen at
// sign-up; `coming_soon` schools collect waitlist requests until their menus
// are ingesting reliably (then flip status to live).
//
// emailDomains: sign-up emails must be on one of these domains or a subdomain
//   of one (buckeyemail.osu.edu matches osu.edu).
// platform: the menu system behind the school's dining site. platformVerified
//   marks schools whose platform was confirmed from the school's own pages or a
//   working client during research (Oct 2026); unverified ones are best
//   guesses to confirm before writing an ingestion config.
// See docs/EXPANSION_PLAN.md for sources and rollout order.

const ET = 'America/New_York';
const CT = 'America/Chicago';
const MT = 'America/Denver';
const AZ = 'America/Phoenix';
const PT = 'America/Los_Angeles';
const MI = 'America/Detroit';
const IN = 'America/Indiana/Indianapolis';

function school(slug, name, shortName, emailDomains, city, state, timezone, platform, platformVerified, status = 'coming_soon') {
  return { slug, name, shortName, emailDomains, city, state, timezone, platform, platformVerified, status };
}

const catalog = [
  // Live today
  school('umich', 'University of Michigan', 'Michigan', ['umich.edu'], 'Ann Arbor', 'MI', MI, 'custom-html', true, 'live'),

  // Nutrislice (verified)
  school('ohio-state', 'The Ohio State University', 'Ohio State', ['osu.edu'], 'Columbus', 'OH', ET, 'nutrislice', true),
  school('wisconsin', 'University of Wisconsin–Madison', 'Wisconsin', ['wisc.edu'], 'Madison', 'WI', CT, 'nutrislice', true),
  school('georgia-tech', 'Georgia Institute of Technology', 'Georgia Tech', ['gatech.edu'], 'Atlanta', 'GA', ET, 'nutrislice', true),
  school('virginia-tech', 'Virginia Tech', 'Virginia Tech', ['vt.edu'], 'Blacksburg', 'VA', ET, 'nutrislice', true),
  school('indiana', 'Indiana University Bloomington', 'Indiana', ['iu.edu', 'indiana.edu'], 'Bloomington', 'IN', IN, 'nutrislice', true),
  school('cu-boulder', 'University of Colorado Boulder', 'CU Boulder', ['colorado.edu'], 'Boulder', 'CO', MT, 'nutrislice', true),
  school('unlv', 'University of Nevada, Las Vegas', 'UNLV', ['unlv.edu', 'unlv.nevada.edu'], 'Las Vegas', 'NV', PT, 'nutrislice', true),

  // Dine On Campus (verified)
  school('texas-am', 'Texas A&M University', 'Texas A&M', ['tamu.edu'], 'College Station', 'TX', CT, 'dineoncampus', true),
  school('pitt', 'University of Pittsburgh', 'Pitt', ['pitt.edu'], 'Pittsburgh', 'PA', ET, 'dineoncampus', true),
  school('houston', 'University of Houston', 'Houston', ['uh.edu'], 'Houston', 'TX', CT, 'dineoncampus', true),
  school('michigan-tech', 'Michigan Technological University', 'Michigan Tech', ['mtu.edu'], 'Houghton', 'MI', MI, 'dineoncampus', true),

  // Own public API (verified)
  school('purdue', 'Purdue University', 'Purdue', ['purdue.edu'], 'West Lafayette', 'IN', IN, 'purdue-hfs', true),

  // FoodPro (verified) - native adapter needs a captured page; AI extraction works meanwhile
  school('penn-state', 'Penn State University Park', 'Penn State', ['psu.edu'], 'University Park', 'PA', ET, 'foodpro', true),
  school('rutgers', 'Rutgers University–New Brunswick', 'Rutgers', ['rutgers.edu'], 'New Brunswick', 'NJ', ET, 'foodpro', true),
  school('uconn', 'University of Connecticut', 'UConn', ['uconn.edu'], 'Storrs', 'CT', ET, 'foodpro', true),
  school('ut-austin', 'The University of Texas at Austin', 'UT Austin', ['utexas.edu'], 'Austin', 'TX', CT, 'foodpro', true),
  school('uc-riverside', 'University of California, Riverside', 'UC Riverside', ['ucr.edu'], 'Riverside', 'CA', PT, 'foodpro', true),

  // School-run sites that are parsable but need their own adapter (verified)
  school('michigan-state', 'Michigan State University', 'Michigan State', ['msu.edu'], 'East Lansing', 'MI', MI, 'custom-html', true),
  school('maryland', 'University of Maryland', 'Maryland', ['umd.edu'], 'College Park', 'MD', ET, 'custom-html', true),
  school('ucla', 'University of California, Los Angeles', 'UCLA', ['ucla.edu'], 'Los Angeles', 'CA', PT, 'custom-html', true),

  // CBORD NetNutrition (verified)
  school('colorado-state', 'Colorado State University', 'Colorado State', ['colostate.edu'], 'Fort Collins', 'CO', MT, 'netnutrition', true),
  school('oklahoma-state', 'Oklahoma State University', 'Oklahoma State', ['okstate.edu'], 'Stillwater', 'OK', CT, 'netnutrition', true),

  // PDF menus - the AI extraction example
  school('fresno-state', 'California State University, Fresno', 'Fresno State', ['fresnostate.edu', 'csufresno.edu'], 'Fresno', 'CA', PT, 'pdf', true),

  // High-priority targets, platform not yet confirmed
  school('minnesota', 'University of Minnesota Twin Cities', 'Minnesota', ['umn.edu'], 'Minneapolis', 'MN', CT, 'unknown', false),
  school('illinois', 'University of Illinois Urbana-Champaign', 'Illinois', ['illinois.edu'], 'Champaign', 'IL', CT, 'unknown', false),
  school('iowa', 'University of Iowa', 'Iowa', ['uiowa.edu'], 'Iowa City', 'IA', CT, 'unknown', false),
  school('nebraska', 'University of Nebraska–Lincoln', 'Nebraska', ['unl.edu'], 'Lincoln', 'NE', CT, 'unknown', false),
  school('florida', 'University of Florida', 'Florida', ['ufl.edu'], 'Gainesville', 'FL', ET, 'unknown', false),
  school('georgia', 'University of Georgia', 'Georgia', ['uga.edu'], 'Athens', 'GA', ET, 'unknown', false),
  school('alabama', 'The University of Alabama', 'Alabama', ['ua.edu'], 'Tuscaloosa', 'AL', CT, 'unknown', false),
  school('auburn', 'Auburn University', 'Auburn', ['auburn.edu'], 'Auburn', 'AL', CT, 'unknown', false),
  school('lsu', 'Louisiana State University', 'LSU', ['lsu.edu'], 'Baton Rouge', 'LA', CT, 'unknown', false),
  school('tennessee', 'University of Tennessee, Knoxville', 'Tennessee', ['utk.edu'], 'Knoxville', 'TN', ET, 'unknown', false),
  school('arizona-state', 'Arizona State University', 'Arizona State', ['asu.edu'], 'Tempe', 'AZ', AZ, 'unknown', false),
  school('arizona', 'University of Arizona', 'Arizona', ['arizona.edu'], 'Tucson', 'AZ', AZ, 'unknown', false),
  school('utah', 'University of Utah', 'Utah', ['utah.edu'], 'Salt Lake City', 'UT', MT, 'unknown', false),
  school('florida-state', 'Florida State University', 'Florida State', ['fsu.edu'], 'Tallahassee', 'FL', ET, 'unknown', false),
  school('ucf', 'University of Central Florida', 'UCF', ['ucf.edu'], 'Orlando', 'FL', ET, 'unknown', false),
  school('clemson', 'Clemson University', 'Clemson', ['clemson.edu'], 'Clemson', 'SC', ET, 'unknown', false),
  school('unc', 'University of North Carolina at Chapel Hill', 'UNC', ['unc.edu'], 'Chapel Hill', 'NC', ET, 'unknown', false),
  school('nc-state', 'North Carolina State University', 'NC State', ['ncsu.edu'], 'Raleigh', 'NC', ET, 'unknown', false),
  school('virginia', 'University of Virginia', 'UVA', ['virginia.edu'], 'Charlottesville', 'VA', ET, 'unknown', false),
  school('iowa-state', 'Iowa State University', 'Iowa State', ['iastate.edu'], 'Ames', 'IA', CT, 'unknown', false),
  school('texas-tech', 'Texas Tech University', 'Texas Tech', ['ttu.edu'], 'Lubbock', 'TX', CT, 'unknown', false),
  school('kentucky', 'University of Kentucky', 'Kentucky', ['uky.edu'], 'Lexington', 'KY', ET, 'unknown', false),
  school('missouri', 'University of Missouri', 'Mizzou', ['missouri.edu', 'umsystem.edu'], 'Columbia', 'MO', CT, 'unknown', false),
  school('arkansas', 'University of Arkansas', 'Arkansas', ['uark.edu'], 'Fayetteville', 'AR', CT, 'unknown', false),
  school('south-carolina', 'University of South Carolina', 'South Carolina', ['sc.edu'], 'Columbia', 'SC', ET, 'unknown', false),
  school('oklahoma', 'University of Oklahoma', 'Oklahoma', ['ou.edu'], 'Norman', 'OK', CT, 'unknown', false),
  school('kansas-state', 'Kansas State University', 'K-State', ['ksu.edu'], 'Manhattan', 'KS', CT, 'unknown', false),
  school('cincinnati', 'University of Cincinnati', 'Cincinnati', ['uc.edu'], 'Cincinnati', 'OH', ET, 'unknown', false),
  school('west-virginia', 'West Virginia University', 'WVU', ['wvu.edu'], 'Morgantown', 'WV', ET, 'unknown', false),
  school('uc-berkeley', 'University of California, Berkeley', 'Cal', ['berkeley.edu'], 'Berkeley', 'CA', PT, 'unknown', false),
  school('uc-san-diego', 'University of California San Diego', 'UC San Diego', ['ucsd.edu'], 'La Jolla', 'CA', PT, 'unknown', false),
  school('uc-davis', 'University of California, Davis', 'UC Davis', ['ucdavis.edu'], 'Davis', 'CA', PT, 'unknown', false),
  school('umass', 'University of Massachusetts Amherst', 'UMass', ['umass.edu'], 'Amherst', 'MA', ET, 'unknown', false),
  school('oregon', 'University of Oregon', 'Oregon', ['uoregon.edu'], 'Eugene', 'OR', PT, 'unknown', false),
];

// Rec centers students can check in at. Coordinates are set in the database
// (see docs/EXPANSION_PLAN.md) so geofences can be tuned without a release.
const gyms = {
  umich: [
    { slug: 'ccrb', name: 'Central Campus Recreation Building' },
    { slug: 'ncrb', name: 'North Campus Recreation Building' },
    { slug: 'imsb', name: 'Intramural Sports Building' },
  ],
  purdue: [{ slug: 'corec', name: 'France A. Córdova Recreational Sports Center (CoRec)' }],
};

// Live occupancy feeds. Connect2Concepts ("GoBoard") powers many rec centers'
// "facility counts" widgets; the account key is public in that widget. Purdue's
// is the one its RecWell site ships (used by the open-source purdue-mcp).
const occupancy = {
  purdue: { provider: 'connect2', accountKey: 'aedeaf92-036d-4848-980b-7eb5526ea40c' },
};

function getCatalogEntry(slug) {
  return catalog.find((entry) => entry.slug === slug);
}

module.exports = {
  catalog,
  getCatalogEntry,
  gyms,
  occupancy,
};
