const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

console.log('--- 🧪 Testing Multimodal Architecture Integration ---');
console.log('Configured keys:');
console.log('GROQ_SOCA_API_KEY:', !!process.env.GROQ_SOCA_API_KEY);
console.log('GROQ_PDF_API_KEY:', !!process.env.GROQ_PDF_API_KEY);
console.log('GEMINI_API_KEY:', !!process.env.GEMINI_API_KEY);

console.log('\nMultimodal routing strategy:');
console.log('1. Scanned PDFs & Images -> Visual Extraction + Compound LLM Parsing');
console.log('2. Digital PDFs & Word Docs -> High-speed text extraction + LPU Reasoning');
console.log('3. SocaBot Chat with Attachments -> Multimodal image inspection');
