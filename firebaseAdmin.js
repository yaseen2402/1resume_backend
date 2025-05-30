const admin = require('firebase-admin');
// const serviceAccount = require("C:/Users/hp/keys/resume-67dd4-firebase-adminsdk-fbsvc-7056bc8ade.json"); 
//this is only needed for local testing 

admin.initializeApp({
  // credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://resume-67dd4.firebasestorage.app'  
});

const auth = admin.auth();
const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { admin, auth, db, bucket };
