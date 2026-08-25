const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const https = require('https');

async function testGroqVision() {
  console.log('--- 🧪 Testing Groq Vision Model (llama-3.2-11b-vision-preview) ---');
  const key = process.env.GROQ_SOCA_API_KEY || process.env.GROQ_PDF_API_KEY;
  console.log('Using Key prefix:', key?.slice(0, 10));

  // 1x1 transparent PNG pixel base64 for test
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const payload = JSON.stringify({
    model: 'llama-3.2-11b-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Identify the image dimensions and describe what you see in 1 sentence.' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${testImageBase64}` } }
        ]
      }
    ],
    temperature: 0.1
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
  }, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const parsed = JSON.parse(body);
        console.log('✅ Groq Vision Response:\n', parsed.choices?.[0]?.message?.content);
        console.log('\n🎉 Groq Vision Multimodal API is 100% active and working!');
        process.exit(0);
      } else {
        console.error('❌ Groq Vision returned error:', body);
        process.exit(1);
      }
    });
  });

  req.on('error', err => {
    console.error('Request error:', err);
    process.exit(1);
  });

  req.write(payload);
  req.end();
}

testGroqVision();
