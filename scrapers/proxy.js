const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const readline = require('readline');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { scrapeSeekWebsite } = require('./seek_scraper');
const { scrapeIndeedWebsite } = require('./indeed_scraper');
// const { scrapeLinkedInWebsite } = require('./linkedin_scraper');
const { scrapeJoraWebsite } = require('./jora_scraper');
const https = require('https');

// Add stealth and adblocker plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

// Proxy configuration
const proxyList = [
  'http://0ef5e48760752be9d2a1cr.au:7766eda92528b29a@gw.dataimpulse.com:823',
  'http://0ef5e48760752be9d2a1cr.au:7766eda92528b29a@gw.dataimpulse.com:823',
  'http://0ef5e48760752be9d2a1cr.au:7766eda92528b29a@gw.dataimpulse.com:823'
];

// Function to get a random proxy from the list
function getRandomProxy() {
  const proxyUrl = new URL(proxyList[Math.floor(Math.random() * proxyList.length)]);
  return {
    server: `${proxyUrl.protocol}//${proxyUrl.host}`,
    username: proxyUrl.username,
    password: proxyUrl.password
  };
}

// Function to validate URL
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Sleep function using Promise
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main scraping function
async function scrapeWebsite(url) {
  let browser = null;
  let lastError;
  
  try {
    
    // Try each proxy until one works
    for (let i = 0; i < proxyList.length; i++) {
      const proxyConfig = getRandomProxy();
      console.log(`Launching browser with proxy ${i + 1}/${proxyList.length}...`);
      
      try {
        browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            `--proxy-server=${proxyConfig.server}`,
            '--ignore-certificate-errors'
          ],
          defaultViewport: { width: 1280, height: 800 },
          timeout: 60000
        });

        // Set up authentication for the proxy
        browser.on('targetcreated', async (target) => {
          const page = await target.page();
          if (page) {
            await page.authenticate({
              username: proxyConfig.username,
              password: proxyConfig.password
            });
          }
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
        } else {
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
      } catch (error) {
        lastError = error;
        console.error(`Proxy ${i + 1} failed:`, error.message);
        if (browser) await browser.close();
        continue;
      }
      break;
    }
    
    if (!browser) {
      console.error('All proxies failed. Last error:', lastError);
      throw new Error('All proxies failed');
    }
  } catch (error) {
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

// Main execution
(async () => {
  try {
    let url = await question('Enter website URL to scrape: ');
    
    // Add https:// if missing
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    // Validate URL
    if (!isValidUrl(url)) {
      throw new Error('Invalid URL format');
    }

    await scrapeWebsite(url);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
})();

module.exports = {scrapeWebsite};
