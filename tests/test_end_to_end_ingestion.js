// test_end_to_end_ingestion.js — Integration test for /api/judiciary/ingest
const fs = require('fs');
const path = require('path');
const http = require('http');

async function runTest() {
    console.log('======================================================================');
    console.log('🧪 TESTING END-TO-END INGESTION VIA BACKEND HTTP API (/api/judiciary/ingest)');
    console.log('======================================================================');

    // Step 1: Login to get JWT
    const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });
    const loginOptions = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(loginData)
        }
    };

    const loginRes = await new Promise((resolve, reject) => {
        const req = http.request(loginOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.write(loginData);
        req.end();
    });

    if (!loginRes.token) {
        console.error('❌ Login failed:', loginRes);
        process.exit(1);
    }

    console.log('✅ Authenticated Admin Token obtained successfully.');
    const token = loginRes.token;

    // Step 2: Upload & Ingest a test PDF into a brand new Legal OS matter
    const testPdfPath = path.join(__dirname, 'fixtures', 'pdf_test_cases', 'receipt_01_pristine.pdf');
    const pdfBuffer = fs.readFileSync(testPdfPath);

    const boundary = '----WebKitFormBoundary' + Math.random().toString(16);
    let body = [];

    const appendField = (name, val) => {
        body.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${val}\r\n`));
    };

    appendField('case_id', 'CREATE_NEW');
    appendField('case_title', 'Matter MIL-CC-101-2026 Ingestion Test');
    appendField('docType', 'RECEIPT');
    appendField('judiciary_case_id', 'MIL-CC-101-2026');
    appendField('payment_ref', 'SGH1111AAA');
    appendField('prn_number', 'PRN-2026-1001');
    appendField('amount', '5200');
    appendField('court_station', 'Milimani Law Courts');
    appendField('client_name', 'Samuel Ogola');
    appendField('update_case_id', 'true');
    appendField('create_payment', 'true');
    appendField('create_invoice', 'true');
    appendField('advance_milestone', 'true');

    // File
    body.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="receipt_01_pristine.pdf"\r\nContent-Type: application/pdf\r\n\r\n`));
    body.push(pdfBuffer);
    body.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const totalBody = Buffer.concat(body);

    const ingestOptions = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/judiciary/ingest',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': totalBody.length
        }
    };

    const ingestRes = await new Promise((resolve, reject) => {
        const req = http.request(ingestOptions, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => resolve(JSON.parse(resBody)));
        });
        req.on('error', reject);
        req.write(totalBody);
        req.end();
    });

    console.log('📥 Ingestion API Response:', ingestRes);

    if (ingestRes.success && ingestRes.case_id) {
        console.log(`✅ SUCCESS: Brand new case created (${ingestRes.case_id}) and synchronized across Legal OS!`);
    } else {
        console.error('❌ Ingestion failed:', ingestRes);
        process.exit(1);
    }
}

runTest().catch(console.error);
