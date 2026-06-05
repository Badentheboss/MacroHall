function cleanText(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function toSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toAbsoluteUrl(baseUrl, maybeRelativeUrl) {
  if (!maybeRelativeUrl) return '';
  try {
    return new URL(maybeRelativeUrl, baseUrl).toString();
  } catch (_) {
    return maybeRelativeUrl;
  }
}

module.exports = {
  cleanText,
  toSlug,
  toAbsoluteUrl,
};
