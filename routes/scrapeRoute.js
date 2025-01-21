const express = require('express');
const{ admin, auth, db } = require('../firebaseAdmin');
const scrapeJoraWebsite = require('../scrapers/indeed_scraper');
const scrapeSeekWebsite = require('../scrapers/jora_scraper');
const scrapeIndeedWebsite = require('../scrapers/seek_scraper');

const router = express.Router();

router.post('/scrape', async (req, res) => {
  const jobPostUrl = req.body.jobPostURL;
  if (!jobPostUrl) {
    return res.status(400).send("Job post URL is required.");
  }

  const idToken = req.headers.authorization;
  if (!idToken || !idToken.startsWith('Bearer ')) {
    return res.status(401).send("Unauthorized: No token provided");
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken.substring(7));
    const userId = decodedToken.uid;

    let pageData;

    if (jobPostUrl.includes('jora.com')) {
      pageData = await scrapeJoraWebsite(jobPostUrl);
    } else if (jobPostUrl.includes('seek.com')) {
      pageData = await scrapeSeekWebsite(jobPostUrl);
    } else if (jobPostUrl.includes('indeed.com')) {
      pageData = await scrapeIndeedWebsite(jobPostUrl);
    } else {
      return res.status(400).send("Unsupported website.");
    }

    res.status(200).json({ success: true, data: pageData });
    
    const jobData = pageData;

    // Find the most recent resume document
    const resumeSnapshot = await db.collection('users').doc(userId).collection('resumes')
      .orderBy('uploadedAt', 'desc').limit(1).get();

    if (!resumeSnapshot.empty) {
      const recentResumeRef = resumeSnapshot.docs[0].ref;
      await recentResumeRef.update({
        scaredJobLink: jobPostUrl,
        scrapedJobTitle: jobData.title,
        scrapedCompanyName: jobData.company,
        scrapedJobDescription: jobData.description,
        scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return res.status(200).send("Job post scraped and resume updated successfully.");
  } catch (error) {
    return res.status(500).send(`An error occurred: ${error.message}`);
  }
});

module.exports = router;