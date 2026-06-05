const axios = require('axios');
const puppeteer = require('puppeteer');

const DEFAULT_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://google.com',
};

async function fetchWithHttp(url) {
  const response = await axios.get(url, {
    timeout: 60000,
    headers: DEFAULT_HEADERS,
  });

  return response.data;
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
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/120.0.0.0 Safari/537.36'
    );
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

module.exports = {
  fetchWithHttp,
  createBrowser,
  fetchWithBrowser,
};
