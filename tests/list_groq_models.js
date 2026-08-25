const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const https = require('https');

const key = process.env.GROQ_SOCA_API_KEY || process.env.GROQ_PDF_API_KEY;

https.get({
  hostname: 'api.groq.com',
  port: 443,
  path: '/openai/v1/models',
  headers: { 'Authorization': `Bearer ${key}` }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const data = JSON.parse(body);
    console.log('--- Current Active Groq Models ---');
    (data.data || []).forEach(m => {
      console.log(`- ${m.id} (owned by: ${m.owned_by}, context: ${m.context_window})`);
    });
    process.exit(0);
  });
});
