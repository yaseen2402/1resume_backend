const express = require('express');
const{ admin, auth, db } = require('../firebaseAdmin');
const {scrapeWebsite} = require('../scrapers/index'); 
const { processResumeWithLLM } = require('../helperFunctions/llmService');

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

    const pageData = await scrapeWebsite(jobPostUrl);
    console.log(pageData);
    
    if (!pageData) {
      return res.status(500).send("Failed to scrape the website.");
    }
    
    const jobData = pageData;
    
    // Find the most recent resume document
    const resumeSnapshot = await db.collection('users').doc(userId).collection('resumes')
      .orderBy('uploadedAt', 'desc').limit(1).get();

    let tailoredResume = null;
    if (!resumeSnapshot.empty) {
      const recentResumeRef = resumeSnapshot.docs[0].ref;
      const resumeData = resumeSnapshot.docs[0].data();

      tailoredResume = await processResumeWithLLM(resumeData, jobData);
      console.log(tailoredResume);

      await recentResumeRef.update({
        scrapedJobLink: jobPostUrl,
        scrapedJobTitle: jobData.title || "not found",
        scrapedCompanyName: jobData.company || "not found",
        scrapedJobDescription: jobData.description || "not found",
        scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
        tailoredResumeHtml: tailoredResume
      });
    }
    return res.status(200).json({ 
      success: true, 
      data: jobData,
      tailoredResume: tailoredResume });
  } catch (error) {
    console.error("Scrape error:", error);
    return res.status(500).json({  // Ensure JSON response for errors
      success: false,
      error: error.message || "Internal server error"
    });
  }
});

module.exports = router;