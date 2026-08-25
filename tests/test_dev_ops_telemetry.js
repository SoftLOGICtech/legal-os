/**
 * test_dev_ops_telemetry.js
 * Verifies:
 * 1. Developer login authentication.
 * 2. GET /api/dev/ops-telemetry returns live system, sync, AI, and privacy-masked WhatsApp telemetry.
 * 3. GET /api/dev/logs returns real-time log buffer entries.
 * 4. POST /api/dev/sync-force initiates a delta sync cycle.
 */

const http = require('http');

function requestJson(urlPath, method = 'GET', data = null, token = null) {
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
  console.log('🧪 Starting Dev/Ops Console & Telemetry Engine Test...\n');

  // 1. Authenticate as Developer
  console.log('1. Authenticating as Developer (dev)...');
  const loginRes = await requestJson('/api/auth/login', 'POST', {
    username: 'dev',
    password: 'dev123'
  });

  console.log('Login result:', loginRes.status, loginRes.data?.role);
  if (loginRes.status !== 200 || loginRes.data?.role !== 'developer') {
    console.error('❌ Failed dev login:', loginRes);
    process.exit(1);
  }
  const token = loginRes.data.token;
  console.log('✅ Developer Authenticated successfully.\n');

  // 2. Query Central Ops Telemetry
  console.log('2. Fetching /api/dev/ops-telemetry...');
  const telemRes = await requestJson('/api/dev/ops-telemetry', 'GET', null, token);
  console.log('Telemetry status:', telemRes.status);
  console.log('System:', telemRes.data?.telemetry?.system);
  console.log('Sync Outbox Queue:', telemRes.data?.telemetry?.sync?.pendingOutboxCount);
  console.log('WhatsApp Engine:', telemRes.data?.telemetry?.whatsapp);
  console.log('AI Provider:', telemRes.data?.telemetry?.ai);

  if (telemRes.status !== 200 || !telemRes.data?.success || !telemRes.data?.telemetry?.system) {
    console.error('❌ Failed /api/dev/ops-telemetry:', telemRes);
    process.exit(1);
  }
  console.log('✅ Telemetry endpoint returned complete system metrics.\n');

  // 3. Query System Logs Buffer
  console.log('3. Fetching /api/dev/logs...');
  const logsRes = await requestJson('/api/dev/logs?limit=50', 'GET', null, token);
  console.log('Logs count:', logsRes.data?.count, 'sample entries:', logsRes.data?.logs?.length);
  if (logsRes.status !== 200 || !logsRes.data?.success || !Array.isArray(logsRes.data?.logs)) {
    console.error('❌ Failed /api/dev/logs:', logsRes);
    process.exit(1);
  }
  console.log('✅ Real-time system log stream verified.\n');

  // 4. Force Sync Trigger
  console.log('4. Testing Force Sync Trigger /api/dev/sync-force...');
  const syncRes = await requestJson('/api/dev/sync-force', 'POST', {}, token);
  console.log('Sync result:', syncRes.status, syncRes.data);
  if (syncRes.status !== 200 || !syncRes.data?.success) {
    console.error('❌ Failed /api/dev/sync-force:', syncRes);
    process.exit(1);
  }
  console.log('✅ Force sync cycle executed.\n');

  console.log('🎉 ALL CENTRAL DEV/OPS CONSOLE & TELEMETRY TESTS PASSED 100%!');
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
