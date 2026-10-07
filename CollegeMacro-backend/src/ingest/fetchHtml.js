const axios = require('axios');
const puppeteer = require('puppeteer');

const DEFAULT_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://google.com',
};

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36';

async function fetchWithHttp(url) {
  const response = await axios.get(url, {
    timeout: 60000,
    headers: DEFAULT_HEADERS,
  });

  return response.data;
}

async function fetchJsonWithHttp(url, headers = {}) {
  const response = await axios.get(url, {
    timeout: 60000,
    headers: { Accept: 'application/json', 'User-Agent': BROWSER_USER_AGENT, ...headers },
    responseType: 'json',
  });

  if (typeof response.data === 'string') {
    return JSON.parse(response.data);
  }
  return response.data;
}

async function fetchBinaryWithHttp(url) {
  const response = await axios.get(url, {
    timeout: 60000,
    headers: { 'User-Agent': BROWSER_USER_AGENT },
    responseType: 'arraybuffer',
  });

  return {
    data: Buffer.from(response.data),
    contentType: String(response.headers['content-type'] || '').split(';')[0].trim(),
  };
}

async function createBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

async function fetchWithBrowser(browser, url, waitSelector) {
  const page = await browser.newPage();

  try {
    await page.setUserAgent(BROWSER_USER_AGENT);
    await page.setExtraHTTPHeaders(DEFAULT_HEADERS);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout: 15000 }).catch(() => undefined);
    }

    return page.content();
  } finally {
    await page.close();
  }
}

// Some vendor APIs (e.g. Dine On Campus) sit behind bot protection that blocks
// plain HTTP clients. Loading the JSON URL in a real browser and reading the
// rendered body gets past the challenge the same way a student's browser does.
async function fetchJsonWithBrowser(browser, url) {
  const page = await browser.newPage();

  try {
    await page.setUserAgent(BROWSER_USER_AGENT);
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    const body = await page.evaluate(() => document.body.innerText);

    try {
      return JSON.parse(body);
    } catch (_) {
      const status = response ? response.status() : 'no response';
      throw new Error(`Expected JSON from ${url} (HTTP ${status}), got: ${body.slice(0, 120)}`);
    }
  } finally {
    await page.close();
  }
}

// Gives adapters one interface regardless of how a school must be fetched.
// Callers must call close() when done.
async function createFetcher({ mode = 'http' } = {}) {
  const browser = mode === 'browser' ? await createBrowser() : null;

  return {
    mode,
    html: (url, waitSelector) =>
      browser ? fetchWithBrowser(browser, url, waitSelector) : fetchWithHttp(url),
    json: (url, headers) => (browser ? fetchJsonWithBrowser(browser, url) : fetchJsonWithHttp(url, headers)),
    binary: (url) => fetchBinaryWithHttp(url),
    close: async () => {
      if (browser) await browser.close();
    },
  };
}

module.exports = {
  createBrowser,
  createFetcher,
  fetchBinaryWithHttp,
  fetchJsonWithBrowser,
  fetchJsonWithHttp,
  fetchWithBrowser,
  fetchWithHttp,
};
