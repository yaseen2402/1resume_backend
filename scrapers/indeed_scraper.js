const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const path = require('path');
const fs = require('fs');

// Add stealth and adblocker plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

// Sleep function using Promise
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeIndeedWebsite(url, browser) {
    const page = await browser.newPage();
    
    // Set reasonable timeouts
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    // Create output directory
    const outputDir = path.join(__dirname, 'scrap_output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const timestamp = Date.now();

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
      },
      banner: null,
      icon: null,
      jobTitle: null,
      company: null,
      viewAllJobsUrl: null,
      location: null,
      jobType: null,
      payRate: null,
      postedTime: null,
      jobDescription: null,
      shiftAndSchedule: [],
       content: {
        headings: {},
        text: '',
        links: [],
        images: []
      }
    };

    // Safe evaluation with error handling
    for (const level of ['h1', 'h2', 'h3']) {
      try {
        pageData.content.headings[level] = await page.$$eval(
          level,
          els => els.map(e => e.textContent.trim())
        );
      } catch (error) {
        console.warn(`Failed to extract ${level} headings:`, error.message);
        pageData.content.headings[level] = [];
      }
    }
    
    try {
        pageData.banner = await page.$eval('.jobsearch-InfoHeaderContainer img[src^="https://"]', img => img.src).catch(() => null);
        pageData.icon = await page.$eval('.jobsearch-CompanyLogo img[src^="https://"]', img => img.src).catch(() => null);
        pageData.jobTitle = await page.$eval('.jobsearch-JobInfoHeader-title', el => el.textContent.trim()).catch(() => null);
        pageData.company = await page.$eval('[data-testid="jobsearch-CompanyInfoContainer"] a', el => el.textContent.trim()).catch(() => null);
        pageData.viewAllJobsUrl = await page.$eval('[data-testid="jobsearch-CompanyInfoContainer"] a', el => el.href).catch(() => null);
        pageData.location = await page.$eval('[data-testid="jobsearch-JobInfoHeader-companyLocation"]', el => el.textContent.trim()).catch(() => null);
        pageData.jobType = await page.$eval('#salaryInfoAndJobType > span:last-child', el => el.textContent.trim()).catch(() => null);
        pageData.payRate = await page.$eval('#salaryInfoAndJobType > span:first-child', el => el.textContent.trim()).catch(() => null);
        pageData.postedTime = await page.$eval('.jobsearch-JobMetadataFooter > div:first-child > span:nth-child(2)', el => el.textContent.trim()).catch(() => null);
        pageData.jobDescription = await page.$eval('#jobDescriptionText', el => el.textContent.trim()).catch(() => null);
        let shiftAndScheduleElements = await page.$$eval('.js-match-insights-provider-vai3to > div > div > div > span', els => els.map(el => el.textContent.trim()));
        shiftAndScheduleElements = shiftAndScheduleElements.filter(text => text !== pageData.jobType && text !== pageData.payRate);
        pageData.shiftAndSchedule = shiftAndScheduleElements;
    } catch (error) {
      console.warn('Failed to extract job details:', error.message);
    }

    try {
      pageData.content.text = await page.$$eval('p', ps => 
        ps.map(p => p.textContent.trim())
          .filter(t => t.length > 0)
          .join('\n\n')
      );
    }  catch (error) {
      console.warn('Failed to extract text content:', error.message);
    }

    try {
      pageData.content.links = await page.$$eval('a', as => 
        as.map(a => ({
          text: a.textContent.trim(),
          href: a.href
        }))
        .filter(l => l.text.length > 0 && l.href)
        .slice(0, 20)
      );
    } catch (error) {
      console.warn('Failed to extract links:', error.message);
    }

    try {
      pageData.content.images = await page.$$eval('img', imgs => 
        imgs.map(img => ({
          description: img.alt || img.title || '',
          src: img.src
        }))
        .filter(i => i.description.length > 0)
        .slice(0, 5)
      );
    } catch (error) {
      console.warn('Failed to extract images:', error.message);
    }

    // Save results
    const outputPath = path.join(outputDir, `indeed_${timestamp}.json`);
    const { content, ...dataToSave } = pageData;
    fs.writeFileSync(outputPath, JSON.stringify(dataToSave, null, 2));
    
    console.log('Scraping succeeded!');
    console.log(`Results saved to: ${outputPath}`);
    
    return {
      title: pageData.jobTitle,       // Map jobTitle → title
      company: pageData.company,      // Keep company
      description: pageData.jobDescription, // Map jobDescription → description
      location: pageData.location,
      url: pageData.page.url,         // Use the actual URL (not job URL)
      // Add other fields your route expects:
      payRate: pageData.payRate,
      postedTime: pageData.postedTime,
      jobType: pageData.jobType
    };
}

module.exports = { scrapeIndeedWebsite };
