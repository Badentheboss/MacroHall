function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpStatus(error) {
  return error?.response?.status ?? error?.status ?? null;
}

function isNotFound(error) {
  return httpStatus(error) === 404;
}

// Runs fn over items with at most `limit` in flight, preserving order.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

module.exports = {
  httpStatus,
  isNotFound,
  mapLimit,
  sleep,
};
