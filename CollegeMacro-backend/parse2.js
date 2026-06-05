const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const websiteURL = 'https://dining.umich.edu/menus-locations/dining-halls/';
const folderPath = path.join(__dirname, 'dining_halls');

const HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://google.com'
};

function clearDirectoryContents(directory) {
  fs.readdir(directory, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(directory, file), err => {
        if (err) throw err;
      });
    }
  });
}

async function configurePage(page) {
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders(HEADERS);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPageHTML(page, url, waitSelector) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  if (waitSelector) {
    try {
      await page.waitForSelector(waitSelector, { timeout: 15000 });
    } catch (err) {
      console.warn(`Timeout waiting for selector ${waitSelector} on ${url}`);
    }
  }
  await sleep(1500); // allow Cloudflare challenge to finish if present
  return page.content();
}

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    } else {
      clearDirectoryContents(folderPath);
    }

    const page = await browser.newPage();
    await configurePage(page);
    await fetchPageHTML(page, websiteURL, '.level_2');
    const links = await page.$$eval('.level_2', elements =>
      elements
        .map(el => el.getAttribute('href'))
        .filter(Boolean)
    );

    for (const link of links) {
      const url = new URL(link, websiteURL).toString();
      const fileName = url.split('/').slice(-2, -1)[0];

      if (fileName === 'select-access') {
        console.log(`Skipping ${fileName} as it matches the exclusion criteria.`);
        continue;
      }

      const detailPage = await browser.newPage();
      await configurePage(detailPage);

      try {
        const detailHTML = await fetchPageHTML(detailPage, url);
        const filePath = path.join(folderPath, `${fileName}.html`);
        fs.writeFile(filePath, detailHTML, err => {
          if (err) {
            console.error(`Error writing file ${fileName}.html:`, err);
            return;
          }
          console.log(`HTML for ${fileName} has been written to ${fileName}.html`);
        });
      } catch (error) {
        console.error(`Error processing ${fileName}:`, error);
      } finally {
        await detailPage.close();
      }
    }

    await page.close();
    console.log('Scrape completed.');
  } catch (error) {
    console.error('Error during Puppeteer scraping:', error);
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Unexpected error:', err);
});
