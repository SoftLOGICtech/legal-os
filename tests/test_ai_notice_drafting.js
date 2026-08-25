/**
 * test_ai_notice_drafting.js
 * Verifies that clicking standard notice templates triggers SocaBot drafting smoothly.
 */

const http = require('http');

function postJson(urlPath, data, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': token ? `Bearer ${token}` : ''
      }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTest() {
  console.log('🧪 Testing SocaBot AI Notice Template Drafting...\n');

  // Authenticate
  await postJson('/api/auth/recover', { recovery_passcode: 'RECOVER_SOCA_2026', new_password: 'password123' });
  const loginRes = await postJson('/api/auth/login', { username: 'admin', password: 'password123' });
  const token = loginRes.data.token;
  console.log('✅ Authenticated as Admin.');

  // Test standard notice drafting via /api/soca-pa/chat
  const draftRes = await postJson('/api/soca-pa/chat', {
    message: `Act as the Executive Advocate for Sam Ogola & Co. Advocates. Draft a formal, clear WhatsApp client message for:
Client: John Doe
Phone: +254712345678
Matter: Doe v. Republic (SO-ABCD12)
Court Station: Milimani Law Courts
Assigned Counsel: Sam Ogola
Outstanding Balance: KES 30,000

Instruction: Draft a formal mention adjournment notice explaining that the court took mention dates and matter was stood over.

Format rules: Clean WhatsApp formatting with professional emojis and bullet points. Include advocate sign-off.`,
    matter_id: 'c_test_1'
  }, token);

  console.log('Draft response status:', draftRes.status);
  console.log('Draft generated preview:', (draftRes.data?.reply || '').slice(0, 150) + '...\n');

  if (draftRes.status !== 200 || !draftRes.data?.reply) {
    console.error('❌ Failed to generate notice draft:', draftRes);
    process.exit(1);
  }

  // Also test alias /api/ai/assistant/chat
  const aliasRes = await postJson('/api/ai/assistant/chat', {
    message: 'Draft a brief fee balance reminder for Jane Smith regarding KES 15,000.',
    matter_id: 'c_test_2'
  }, token);

  console.log('Alias endpoint /api/ai/assistant/chat status:', aliasRes.status);
  if (aliasRes.status !== 200 || !aliasRes.data?.reply) {
    console.error('❌ Alias endpoint failed:', aliasRes);
    process.exit(1);
  }

  console.log('🎉 ALL NOTICE TEMPLATE DRAFTING TESTS PASSED 100%!');
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
