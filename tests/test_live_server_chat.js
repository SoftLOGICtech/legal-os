const jwt = require('jsonwebtoken');
const https = require('http');

const JWT_SECRET = 'legal_os_dev_secret_2026';
const token = jwt.sign({ id: 'u_admin', username: 'admin', display_name: 'Advocate Admin', role: 'admin' }, JWT_SECRET);

const payload = JSON.stringify({
  message: 'yo',
  messages: [{ role: 'user', content: 'yo' }],
  user_role: 'advocate'
});

const req = https.request({
  hostname: '127.0.0.1',
  port: 3001,
  path: '/api/soca-pa/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('HTTP Status from running server (PID 2888):', res.statusCode);
    console.log('Response Body:', body);
    process.exit(0);
  });
});

req.on('error', e => {
  console.error('Request failed:', e.message);
  process.exit(1);
});

req.write(payload);
req.end();
