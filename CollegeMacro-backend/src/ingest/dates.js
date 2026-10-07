// Menus are published per campus-local day, so "today" must be computed in the
// school's timezone. A cron run at 05:00 UTC is still the previous evening in
// California.
function localDate(timezone, offsetDays = 0, now = new Date()) {
  const shifted = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(shifted);

  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function splitDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return { year, month, day };
}

module.exports = {
  localDate,
  splitDate,
};
