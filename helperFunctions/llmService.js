const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');


const openai = new OpenAI({
  apiKey: 'aforapple'
});

const genAI = new GoogleGenerativeAI('AIzaSyBh6Mc_h_P9HWRK9zR2o9a5Qhvl_M-FzvI');
// const genAI = new GoogleGenerativeAI('AIzaSyB_1xpdJwxr409IPtqtpBFUr561ZWEaNCk');

async function getTemplate() {
    const templatePath = path.join(__dirname, '../templates/temp1.html');
    return await fs.readFile(templatePath, 'utf8');
  }
  

  async function processWithOpenAI(resumeData, jobData, template) {
    const prompt = `
      Use the following resume data and job posting to fill out this HTML template.
      Make the resume highly relevant to the job posting while maintaining truthfulness.
      
      Resume Data: ${JSON.stringify(resumeData)}
      Job Posting: ${JSON.stringify(jobData)}
      HTML Template: ${template}
      
      Return only the filled HTML template.`;
  
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a professional resume writer." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });
  
    return completion.choices[0].message.content;
  }
  
  async function processWithGemini(resumeData, jobData, template) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
    const prompt = `
      Use the resume data and job posting to fill out this HTML template.
      Return ONLY the raw HTML content without:
      - Any markdown formatting
      - Code blocks (\`\`\`)
      - Explanations
      - Extra text
      
      Requirements:
      1. Maintain original HTML structure from template
      2. Only use the data from resume and job post
      3. Return pure HTML that can be directly rendered

      Resume Data: ${JSON.stringify(resumeData)}
      Job Posting: ${JSON.stringify(jobData)}
      HTML Template: ${template}
    `;
  
    const result = await model.generateContent(prompt);
    return result.response.text()
    .replace(/```html/g, '')
    .replace(/```/g, '')
    .trim();
  }
  
  async function processResumeWithLLM(resumeData, jobData, service = 'gemini') {
    try {
      const template = await getTemplate();
      
      if (service === 'gemini') {
        return await processWithGemini(resumeData, jobData, template);
      } else {
        return await processWithOpenAI(resumeData, jobData, template);
      }
    } catch (error) {
      throw new Error(`LLM Processing failed: ${error.message}`);
    }
  }


async function formatResumeContent(extractedContent) {
  try {
    const templatePath = path.join(__dirname, '../templates/temp1.html');
    const template = await fs.readFile(templatePath, 'utf8');
    console.log("template", template)
    
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `
      Format this extracted resume content into the provided HTML template.
      Maintain the original structure and styling of the template.
      Only fill in the content sections with relevant information.
      make sure your reponse should contain only the html content and absolutely nothing else so that i can render it directly
      
      Extracted Resume Content:
      ${extractedContent}
      
      HTML Template:
      ${template}
      
      Return only valid HTML.`;

    const result = await model.generateContent(prompt);
    return result.response.text()
    .replace(/```html/g, '')
    .replace(/```/g, '')
    .trim();
  } catch (error) {
    throw new Error(`LLM Processing failed: ${error.message}`);
  }
}

  
  module.exports = { formatResumeContent, processResumeWithLLM };