const express = require('express');
const admin = require('firebase-admin');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const cheerio = require('cheerio');
const uuid = require('uuid');
// const serviceAccount = require("C:/Users/hp/keys/resume-67dd4-firebase-adminsdk-fbsvc-7056bc8ade.json"); 

//this is only needed for local testing 

admin.initializeApp({
  // credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://resume-67dd4.firebasestorage.app'  
});



const db = admin.firestore();
const bucket = admin.storage().bucket();
const cors = require('cors');
// Express app setup
const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',  // Replace with your frontend URL
  credentials: true
}));

// Multer setup for file handling
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Function to extract text from PDF
const extractTextFromPdf = async (pdfBuffer) => {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text || "No text extracted from the PDF.";
  } catch (error) {
    throw new Error(`Error extracting text: ${error.message}`);
  }
};

app.get('/', async (req, res)=>{
  return res.status(200).send("halo");
});

// Endpoint to upload resume
app.post('/upload-resume', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file provided.");
  }

  console.log("received resume")
  const idToken = req.headers.authorization;
  if (!idToken || !idToken.startsWith('Bearer ')) {
    return res.status(401).send("Unauthorized: No token provided");
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken.substring(7));  // Strip "Bearer "
    const userId = decodedToken.uid;

    // Validate PDF
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).send("Invalid file type. Only PDF files are allowed.");
    }

    const extractedText = await extractTextFromPdf(req.file.buffer);

    // Create a unique file name and upload to Firebase Storage
    const fileName = `${uuid.v4()}.pdf`;
    const filePath = `resumes/${userId}/${fileName}`;

    const file = bucket.file(filePath);
    await file.save(req.file.buffer, {
      contentType: 'application/pdf'
    });

    const pdfUrl = `https://storage.googleapis.com/${bucket.name}/resumes/${userId}/${fileName}`;

    // Store resume information in Firestore
    await db.collection('users').doc(userId).collection('resumes').add({
      originalResumeURL: pdfUrl,
      extractedText: extractedText,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).send("PDF uploaded successfully.");
  } catch (error) {
    return res.status(500).send(`An error occurred: ${error.message}`);
  }
});

// Function to scrape job post data
const scrapeJobPostData = async (jobPostUrl) => {
  try {
    const response = await axios.get(jobPostUrl);
    if (response.status !== 200) {
      throw new Error("Failed to scrape the job post");
    }

    const $ = cheerio.load(response.data);

    const jobTitle = $('h1.jobsearch-JobInfoHeader-title').text().trim() || null;
    const companyName = $('a.css-1gcjz36').text().trim() || null;
    const locationText = $('div[data-testid="inlineHeader-companyLocation"]').text().trim() || null;
    const payText = $('span.js-match-insights-provider-4pmm6z').text().trim() || null;

    let jobType = null;
    $('span.js-match-insights-provider-4pmm6z').each((_, element) => {
      if ($(element).text().trim() === 'Casual') {
        jobType = 'Casual';
      }
    });

    const jobDescription = $('#jobDescriptionText').text().trim() || null;

    return {
      title: jobTitle,
      company: companyName,
      location: locationText,
      pay: payText,
      job_type: jobType,
      description: jobDescription,
    };
  } catch (error) {
    throw new Error(`Error scraping job post: ${error.message}`);
  }
};

// Endpoint to scrape job post and update resume
app.post('/scrape-job-post', async (req, res) => {
  const jobPostUrl = req.body.jobPostURL;
  if (!jobPostUrl) {
    return res.status(400).send("Job post URL is required.");
  }

  const idToken = req.headers.authorization;
  if (!idToken || !idToken.startsWith('Bearer ')) {
    return res.status(401).send("Unauthorized: No token provided");
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken.substring(7));
    const userId = decodedToken.uid;

    // Scrape job post data
    const jobData = await scrapeJobPostData(jobPostUrl);

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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
