const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const https = require('https');

const key = process.env.GROQ_SOCA_API_KEY || process.env.GROQ_PDF_API_KEY;
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testModel(modelName) {
  return new Promise((resolve) => {
    console.log(`Testing model: ${modelName}...`);
    const payload = JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe what you see in this image in 1 short sentence.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${testImageBase64}` } }
          ]
        }
      ]
    });

    const req = https.request({
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log(`${modelName} Status: ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const parsed = JSON.parse(body);
          console.log(`✅ ${modelName} Response:\n`, parsed.choices?.[0]?.message?.content);
          resolve(true);
        } else {
          console.log(`❌ ${modelName} Error:\n`, body);
          resolve(false);
        }
      });
    });
    req.on('error', e => { console.error(e); resolve(false); });
    req.write(payload);
    req.end();
  });
}

async function run() {
  await testModel('groq/compound');
  await testModel('qwen/qwen3.6-27b');
  await testModel('openai/gpt-oss-120b');
  process.exit(0);
}

run();
