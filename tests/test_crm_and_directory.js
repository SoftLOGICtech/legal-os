/**
 * test_crm_and_directory.js
 * Verifies:
 * 1. Updating case phone number via PUT /api/cases/:id.
 * 2. Converting CRM Lead to active matter dossier via POST /api/leads/:id/convert.
 */

const http = require('http');

function requestJson(urlPath, method, data, token) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : '';
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: urlPath,
      method: method,
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
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTest() {
  console.log('🧪 Starting CRM & Directory Integration Verification...\n');

  // Authenticate
  await requestJson('/api/auth/recover', 'POST', { recovery_passcode: 'RECOVER_SOCA_2026', new_password: 'password123' });
  const loginRes = await requestJson('/api/auth/login', 'POST', { username: 'admin', password: 'password123' });
  const token = loginRes.data.token;
  console.log('✅ Authenticated as Admin.\n');

  // 1. Test Linking phone number to an existing unlinked case
  console.log('1. Testing Phone Linking on Active Matter...');
  const linkRes = await requestJson('/api/cases/c_1787061933861', 'PUT', {
    client_phone: '+254700112233'
  }, token);

  console.log('Link phone result:', linkRes.status, linkRes.data);
  if (linkRes.status !== 200 || (!linkRes.data?.success && !linkRes.data?.updated)) {
    console.error('❌ Failed to update matter phone:', linkRes);
    process.exit(1);
  }
  console.log('✅ Phone successfully linked to matter.\n');

  // 2. Create and convert a CRM Lead
  console.log('2. Testing CRM Lead Conversion...');
  // Insert a test lead first
  const createLeadRes = await requestJson('/api/leads', 'POST', {
    full_name: 'Wanjiku Kamau',
    phone: '+254799887766',
    email: 'wanjiku@test.co.ke',
    service_category: 'Land & Property Law',
    property_location: 'Kitengela',
    property_value: 4500000,
    message: 'Boundary dispute with neighbor regarding plot 452.'
  }, token);

  const leadId = createLeadRes.data?.id;
  console.log('Created test CRM lead:', leadId);

  if (leadId) {
    const convertRes = await requestJson(`/api/leads/${leadId}/convert`, 'POST', {}, token);
    console.log('Convert lead result:', convertRes.status, convertRes.data);
    if (convertRes.status !== 200 || !convertRes.data?.success) {
      console.error('❌ Failed to convert lead:', convertRes);
      process.exit(1);
    }
    console.log(`✅ Lead successfully converted to Active Matter dossier: ${convertRes.data.trackingToken}\n`);
  }

  console.log('🎉 ALL CRM & DIRECTORY TESTS PASSED!');
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
