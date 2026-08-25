const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'legal_os_dev_secret_2026';
const token = jwt.sign({ id: 'u_admin', username: 'admin', display_name: 'Sam Ogola', role: 'admin' }, JWT_SECRET);

// Construct multipart/form-data payload with a dummy PDF file
const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

const samplePdfText = `
  %PDF-1.4
  IN THE SENIOR RESIDENT MAGISTRATES COURT AT NAIVASHA
  CIVIL SUIT NO. 45 OF 2026
  BETWEEN:
  NAIVASHA RESIDENTS ASSOCIATION .................. PLAINTIFF
  -VERSUS-
  LAKE COUNTY WATER & SEWERAGE CO. ................ DEFENDANT

  ASSESSMENT INVOICE & FEE NOTE
  Invoice No: INV-NV-2026-098
  Date: 12th August 2026
  Professional assessment and filing fees: KES 150,000.
  Status: Due for Settlement
`;

const fileContent = Buffer.from(samplePdfText, 'utf8');

const crlf = '\r\n';
let postData = [];

postData.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="prompt"${crlf}${crlf}Review and summarize this legal assessment invoice.${crlf}`));
postData.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="message"${crlf}${crlf}Review and summarize this legal assessment invoice.${crlf}`));
postData.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="5_Naivasha_Assessment_Invoice_Meet.pdf"${crlf}Content-Type: application/pdf${crlf}${crlf}`));
postData.push(fileContent);
postData.push(Buffer.from(`${crlf}--${boundary}--${crlf}`));

const fullBody = Buffer.concat(postData);

console.log('--- 🧪 Testing /api/soca-pa/analyze-doc with Attached PDF ---');

const req = http.request({
  hostname: '127.0.0.1',
  port: 3001,
  path: '/api/soca-pa/analyze-doc',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': fullBody.length
  }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('HTTP Status from server:', res.statusCode);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const parsed = JSON.parse(body);
        console.log('✅ SocaBot AI Analysis Reply:\n', parsed.reply || parsed.analysis);
        console.log('\n✅ Parsed Document Data:', parsed.documentInfo?.parsedDoc);
        console.log('\n🎉 Document Upload to SocaBot is 100% working!');
        process.exit(0);
      } catch (e) {
        console.log('Parse error on response:', body);
        process.exit(1);
      }
    } else {
      console.error('Server returned error:', res.statusCode, body);
      process.exit(1);
    }
  });
});

req.on('error', e => {
  console.error('Connection error:', e.message);
  process.exit(1);
});

req.write(fullBody);
req.end();
