const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const cheerio = require('cheerio');
const uuid = require('uuid');
const{ db, bucket } = require('../firebaseAdmin');
const router = express.Router();

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


router.post('/upload-resume', upload.single('file'), async (req, res) => {
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

module.exports = router;