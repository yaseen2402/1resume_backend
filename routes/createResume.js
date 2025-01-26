const express = require("express");
const uuid = require("uuid");
const { admin, auth, db, bucket } = require("../firebaseAdmin");
const router = express.Router();

router.post("/create-resume", async (req, res) => {
  console.log("creating resume");
  const idToken = req.headers.authorization;
  if (!idToken || !idToken.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized: No token provided");
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken.substring(7)); // Strip "Bearer "
    const userId = decodedToken.uid;

    // Validate PDF
    //1: swe
    //2: lawyer
    //3: 
    const { type } = req.body;
    if (!type || ![1, 2, 3, 4, 5].includes(parseInt(type))) {
      return res.status(400).send("Invalid or missing type");
    }

    // Resolve the template file path
    const templateFileName = `temp${type}.html`;
    const templateFilePath = path.join(
      __dirname,
      "templates",
      templateFileName
    );

    // Read the content of the template file
    const responseHtml = fs.readFileSync(templateFilePath, "utf8");

    await db.collection("users").doc(userId).collection("resumes").add({
      formattedHtml: responseHtml,
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("stored in firestore");
    console.log(responseHtml);
    return res.status(200).json({ htmlContent: responseHtml });
  } catch (error) {
    console.log(error.message);
    return res.status(500).send(`An error occurred: ${error.message}`);
  }
});

module.exports = router;
