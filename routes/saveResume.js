const express = require('express');
const{ admin, auth, db } = require('../firebaseAdmin');


const router = express.Router();

router.post('/save-resume', async (req, res) => {
    const idToken = req.headers.authorization;
    if (!idToken || !idToken.startsWith('Bearer ')) {
        return res.status(401).send("Unauthorized: No token provided");
    }
    try {
        const decodedToken = await auth.verifyIdToken(idToken.substring(7));
        const userId = decodedToken.uid;
        const resumeData = req.body;
        // Save the resume to Firestore
        const resumeSnapshot = await db.collection('users').doc(userId).collection('resumes')
        .orderBy('uploadedAt', 'desc').limit(1).get();
        if (!resumeSnapshot.empty) {
            const recentResumeRef = resumeSnapshot.docs[0].ref;
      
            await recentResumeRef.update({
              finalResumeHtml: resumeData.finalResume,
              finalUpdateAt: new Date()
            });
          }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Save resume error:", error);
        return res.status(500).json({  // Ensure JSON response for errors
            success: false,
            error: error.message
        });
    }
});  

module.exports = router;