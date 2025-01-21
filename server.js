const express = require('express');
const cors = require('cors');
const scrapeRoutes = require('./routes/scrapeRoute');
const uploadResume = require('./routes/uploadResume');

const app = express();

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',  
  credentials: true
}));


app.use('/api', scrapeRoutes);
app.use('/api', uploadResume);


app.get('/', async (req, res)=>{
  return res.status(200).send("halo");
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
