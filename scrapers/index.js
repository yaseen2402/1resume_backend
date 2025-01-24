const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const fs = require('fs');
const path = require('path');
const { scrapeSeekWebsite } = require('./seek_scraper');
const { scrapeIndeedWebsite } = require('./indeed_scraper');
// const { scrapeLinkedInWebsite } = require('./linkedin_scraper');
const { scrapeJoraWebsite } = require('./jora_scraper');

// Add stealth and adblocker plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));


// Main scraping function
async function scrapeWebsite(url) {
  let browser = null;
  
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      defaultViewport: { width: 1280, height: 800 },
      timeout: 60000 
    });

    if (url.includes('seek.com.au')) {
      console.log('Using seek.com.au scraper...');
      return await scrapeSeekWebsite(url, browser);
    } else if (url.includes('indeed.com')) {
        console.log('Using indeed.com scraper...');
        return await scrapeIndeedWebsite(url, browser);
    } else if (url.includes('linkedin.com')) {
        console.log('Using linkedin.com scraper...');
        return await scrapeLinkedInWebsite(url, browser);
    } else if (url.includes('jora.com')) {
      console.log('Using jora.com scraper...');
      return await scrapeJoraWebsite(url, browser);
    }
     else {
      console.log('Using generic scraper...');
      const page = await browser.newPage();
      
      // Set reasonable timeouts
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);

      console.log(`Navigating to: ${url}`);
      await page.goto(url, { 
        waitUntil: 'networkidle0', 
        timeout: 30000 
      });

      const pageTitle = await page.title();
      if (pageTitle === 'Just a moment...') {
        throw new Error('Encountered "Just a moment..." page, likely a CAPTCHA or bot detection.');
      }

      const pageData = {
        page: {
          title: await page.title(),
          url: await page.url()
        }
      };

      // Create output directory
      const outputDir = path.join(__dirname, 'scrap_output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }
      
      const timestamp = Date.now();
      const outputPath = path.join(outputDir, `generic_${timestamp}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(pageData, null, 2));
      
      console.log('Scraping succeeded!');
      console.log(`Results saved to: ${outputPath}`);
      return pageData;
    }
  }  catch (error) {
    console.error('Fatal error during scraping:', error);
    console.log('Scraping failed.');
    throw error;
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
}


module.exports = {scrapeWebsite};

