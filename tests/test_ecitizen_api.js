// test_ecitizen_api.js
const http = require('http');

async function testECitizenApi() {
    console.log('======================================================================');
    console.log('🧪 TESTING ECITIZEN OAUTH 2.0 & IPRS KYC API ENDPOINTS');
    console.log('======================================================================');

    // 1. Auth URL
    const authUrlRes = await new Promise((resolve, reject) => {
        http.get('http://localhost:3001/api/ecitizen/auth-url', (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });

    console.log('🔑 Auth URL Response:', authUrlRes);
    if (authUrlRes.success && authUrlRes.authUrl) {
        console.log('✅ PASS: eCitizen Auth URL generated successfully.');
    } else {
        console.error('❌ FAIL: Auth URL failed.');
        process.exit(1);
    }

    // Step 1: Login to get token
    const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });
    const loginRes = await new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
        }, res => {
            let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject); req.write(loginData); req.end();
    });
    const token = loginRes.token;

    // 2. Client KYC Verification
    const kycData = JSON.stringify({ id_number: '34892019', kra_pin: 'A019283749B' });
    const kycOptions = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/ecitizen/verify-kyc',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(kycData)
        }
    };

    const kycRes = await new Promise((resolve, reject) => {
        const req = http.request(kycOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.write(kycData);
        req.end();
    });

    console.log('🔍 Client KYC Verification Response:', kycRes);
    if (kycRes.success && kycRes.kyc && kycRes.kyc.full_name === 'John Muthomi Doe') {
        console.log('✅ PASS: Client KYC Verification against eCitizen / IPRS returned valid verified identity!');
    } else {
        console.error('❌ FAIL: KYC Verification failed.');
        process.exit(1);
    }
}

testECitizenApi().catch(console.error);
