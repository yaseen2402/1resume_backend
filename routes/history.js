const express = require('express');
const{ admin, auth, db } = require('../firebaseAdmin');

const router = express.Router();

router.get('/history', async (req, res) => {   
    const idToken = req.headers.authorization;
    if (!idToken || !idToken.startsWith('Bearer ')) {
        return res.status(401).send("Unauthorized: No token provided");
    }
    
    try {
        const decodedToken = await auth.verifyIdToken(idToken.substring(7));
        const userId = decodedToken.uid;
    
        const resumeSnapshot = await db.collection('users').doc(userId).collection('resumes')
        .orderBy('uploadedAt', 'desc')
        .limit(10)
        .get();
    
        const resumes = [];
        resumeSnapshot.forEach((doc) => {
            const resumeData = doc.data();
            resumes.push({
                id: doc.id,
                title: resumeData.scrapedJobTitle || "Untitled Resume",
                company: resumeData.scrapedCompanyName || "No company",
                updatedAt: resumeData.finalUpdateAt || null,
                finalResumeHtml: resumeData.finalResumeHtml || null
            });
        });
        
        console.log(resumes);
        return res.status(200).json({ 
        success: true, 
        data: resumes 
        });
    } catch (error) {
        console.error("History error:", error);
        return res.status(500).json({  // Ensure JSON response for errors
        success: false,
        error: error.message
        });
    }
});

module.exports = router;