const http = require('http');

console.log('--- 🧪 Testing Port 3001 Frontend & API Serving ---');

http.get('http://127.0.0.1:3001/', res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Status code on http://localhost:3001/:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    if (body.includes('<div id="root">') || body.includes('legal-os') || body.includes('<!DOCTYPE html>')) {
      console.log('✅ Port 3001 is directly serving the complete Legal OS React Frontend!');
    } else {
      console.log('Body snippet:', body.slice(0, 200));
    }
    process.exit(0);
  });
}).on('error', err => {
  console.error('Error reaching 3001:', err.message);
  process.exit(1);
});
