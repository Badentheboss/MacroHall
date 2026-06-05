const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function fetchAndParseHTML(url) {
  try {
    const response = await axios.get(url, { httpsAgent: new https.Agent({ rejectUnauthorized: false }) });
    const html = response.data;
    const $ = cheerio.load(html);
    return $;
  } catch (error) {
    console.error('Error fetching or parsing HTML:', error);
    throw error;
  }
}

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

const websiteURL = 'https://dining.umich.edu/menus-locations/dining-halls/';
const folderPath = path.join(__dirname, 'dining_halls');

// Ensure the directory exists
if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath);
} else {
  // Clear the directory contents if it already exists
  clearDirectoryContents(folderPath);
}

fetchAndParseHTML(websiteURL)
  .then($ => {
    $('.level_2').each(async function () {
      const link = $(this).attr('href');
      // Extract the last part of the URL as the file name
      const fileName = link ? link.split('/').slice(-2, -1)[0] : '';
    
      // Check if the fileName is "select-access" and skip it if true
      if (fileName === 'select-access') {
        console.log(`Skipping ${fileName} as it matches the exclusion criteria.`);
        return; // Skip this iteration
      }
    
      try {
        const parsedHTML = await fetchAndParseHTML(link);
        const filePath = path.join(folderPath, `${fileName}.html`);
        fs.writeFile(filePath, parsedHTML.html(), (err) => {
          if (err) {
            console.error(`Error writing file ${fileName}.html:`, err);
            return;
          }
          console.log(`HTML for ${fileName} has been written to ${fileName}.html`);
        });
      } catch (error) {
        console.error(`Error processing ${fileName}:`, error);
      }
    });    
  })
  .catch(error => {
    console.error('Error fetching or parsing HTML:', error);
  });
