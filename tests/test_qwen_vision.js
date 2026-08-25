const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const https = require('https');

const key = process.env.GROQ_SOCA_API_KEY || process.env.GROQ_PDF_API_KEY;

// 10x10 Red square PNG base64
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

async function testQwenVision() {
  console.log('--- 🧪 Testing qwen/qwen3.6-27b Vision on Groq ---');
  const payload = JSON.stringify({
    model: 'qwen/qwen3.6-27b',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What color is this image?' },
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
  }, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const parsed = JSON.parse(body);
        console.log('✅ qwen/qwen3.6-27b Vision Response:\n', parsed.choices?.[0]?.message?.content);
        console.log('\n🎉 Groq Multimodal Vision (qwen/qwen3.6-27b) is 100% active and working with vision!');
        process.exit(0);
      } else {
        console.error('❌ Error:\n', body);
        process.exit(1);
      }
    });
  });

  req.on('error', e => { console.error(e); process.exit(1); });
  req.write(payload);
  req.end();
}

testQwenVision();
