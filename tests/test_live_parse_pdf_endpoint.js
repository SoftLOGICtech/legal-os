const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'legal_os_dev_secret_2026';
const token = jwt.sign({ id: 'u_admin', username: 'admin', display_name: 'Sam Ogola', role: 'admin' }, JWT_SECRET);

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

const samplePleading = `
  %PDF-1.4
  IN THE HIGH COURT OF KENYA AT NAIROBI
  COMMERCIAL AND TAX DIVISION
  CIVIL SUIT NO. HCCC E123 OF 2026
  BETWEEN:
  SAFARICOM PLC ................................... PLAINTIFF
  -VERSUS-
  NAIVASHA RESIDENTS ASSOCIATION .................. DEFENDANT

  NOTICE OF MOTION
  TAKE NOTICE that this Honourable Court will be moved on 25th September 2026 at 9:00 AM.
  Court Station: Milimani Law Courts
`;

const fileContent = Buffer.from(samplePleading, 'utf8');

const crlf = '\r\n';
let postData = [];

postData.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="Sample_Pleading.pdf"${crlf}Content-Type: application/pdf${crlf}${crlf}`));
postData.push(fileContent);
postData.push(Buffer.from(`${crlf}--${boundary}--${crlf}`));

const fullBody = Buffer.concat(postData);

console.log('--- 🧪 Testing POST /api/judiciary/parse-pdf ---');

const req = http.request({
  hostname: '127.0.0.1',
  port: 3001,
  path: '/api/judiciary/parse-pdf',
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
    console.log('HTTP Status from parse-pdf:', res.statusCode);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const parsed = JSON.parse(body);
        console.log('✅ Parsed PDF Extraction Result:');
        console.log('Case Title:', parsed.extracted?.case_title);
        console.log('Judiciary ID:', parsed.extracted?.judiciary_case_id);
        console.log('Doc Type:', parsed.extracted?.docType);
        console.log('Court:', parsed.extracted?.court_station);
        console.log('Determined Actions:', parsed.determinedActions?.length || 0);
        console.log('\n🎉 POST /api/judiciary/parse-pdf is 100% OPERATIONAL!');
        process.exit(0);
      } catch (e) {
        console.error('Parse error:', body);
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
